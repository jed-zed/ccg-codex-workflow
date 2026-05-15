#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parseCliArgs, buildReport, hasFatal } = require(path.join(__dirname, '..', '..', 'lib', 'shared.js'));

// 质量规则配置
const MAX_LINE_LENGTH = 120;
const MAX_FUNCTION_LENGTH = 50;
const MAX_FILE_LENGTH = 500;
const MAX_COMPLEXITY = 10;
const MAX_PARAMETERS = 5;
const MIN_FUNCTION_NAME_LENGTH = 2;

const EXCLUDE_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.venv', 'venv', 'dist', 'build', '.tox']);
const CODE_EXTENSIONS = new Set([
  '.py', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.mts', '.cts',
  '.go', '.java', '.rs', '.c', '.cpp',
]);
const JSTS_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.mts', '.cts']);

const COMMENT_PREFIXES = {
  '.js': '//', '.ts': '//', '.jsx': '//', '.tsx': '//',
  '.mjs': '//', '.cjs': '//', '.mts': '//', '.cts': '//',
  '.go': '//', '.java': '//',
  '.c': '//', '.cpp': '//', '.rs': '//',
};

// --- Analysis ---

function buildLineStarts(content) {
  const starts = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

function lineNumberAt(lineStarts, index) {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid] <= index) low = mid + 1;
    else high = mid - 1;
  }
  return high + 1;
}

function skipWhitespace(text, index) {
  let i = index;
  while (i < text.length && /\s/.test(text[i])) i++;
  return i;
}

function previousNonSpace(text, index) {
  for (let i = index; i >= 0; i--) {
    if (!/\s/.test(text[i])) return text[i];
  }
  return '';
}

function nextNonSpace(text, index) {
  for (let i = index; i < text.length; i++) {
    if (!/\s/.test(text[i])) return text[i];
  }
  return '';
}

function maskJsTsSource(content) {
  const chars = content.split('');
  let state = 'normal';
  let quote = '';

  function blank(index) {
    if (chars[index] !== '\n' && chars[index] !== '\r') chars[index] = ' ';
  }

  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const next = chars[i + 1];

    if (state === 'normal') {
      if (c === '/' && next === '/') {
        blank(i);
        blank(i + 1);
        i++;
        state = 'lineComment';
      } else if (c === '/' && next === '*') {
        blank(i);
        blank(i + 1);
        i++;
        state = 'blockComment';
      } else if (c === '"' || c === "'") {
        quote = c;
        blank(i);
        state = 'quotedString';
      } else if (c === '`') {
        blank(i);
        state = 'templateString';
      }
      continue;
    }

    if (state === 'lineComment') {
      if (c === '\n' || c === '\r') state = 'normal';
      else blank(i);
      continue;
    }

    if (state === 'blockComment') {
      if (c === '*' && next === '/') {
        blank(i);
        blank(i + 1);
        i++;
        state = 'normal';
      } else {
        blank(i);
      }
      continue;
    }

    if (state === 'quotedString') {
      if (c === '\\') {
        blank(i);
        if (i + 1 < chars.length) {
          blank(i + 1);
          i++;
        }
      } else if (c === quote) {
        blank(i);
        state = 'normal';
      } else {
        blank(i);
      }
      continue;
    }

    if (state === 'templateString') {
      if (c === '\\') {
        blank(i);
        if (i + 1 < chars.length) {
          blank(i + 1);
          i++;
        }
      } else if (c === '`') {
        blank(i);
        state = 'normal';
      } else {
        blank(i);
      }
    }
  }

  return chars.join('');
}

function findMatching(text, openIndex, openChar, closeChar) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === openChar) depth++;
    else if (text[i] === closeChar) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findBodyStart(text, index) {
  let i = index;
  while (i < text.length) {
    const c = text[i];
    if (c === ';') return -1;
    if (c === '(') {
      const end = findMatching(text, i, '(', ')');
      if (end < 0) return -1;
      i = end + 1;
      continue;
    }
    if (c === '[') {
      const end = findMatching(text, i, '[', ']');
      if (end < 0) return -1;
      i = end + 1;
      continue;
    }
    if (c === '{') {
      const prev = previousNonSpace(text, i - 1);
      if (prev === ':' || prev === '=') {
        const end = findMatching(text, i, '{', '}');
        if (end > i) {
          i = end + 1;
          continue;
        }
      }
      return i;
    }
    i++;
  }
  return -1;
}

function splitTopLevelParameters(paramsText) {
  const params = [];
  let current = '';
  let paren = 0;
  let square = 0;
  let brace = 0;
  let angle = 0;

  for (let i = 0; i < paramsText.length; i++) {
    const c = paramsText[i];
    if (c === '(') paren++;
    else if (c === ')' && paren > 0) paren--;
    else if (c === '[') square++;
    else if (c === ']' && square > 0) square--;
    else if (c === '{') brace++;
    else if (c === '}' && brace > 0) brace--;
    else if (c === '<') angle++;
    else if (c === '>' && angle > 0) angle--;

    if (c === ',' && paren === 0 && square === 0 && brace === 0 && angle === 0) {
      const param = current.trim();
      if (param && !/^this\b/.test(param)) params.push(param);
      current = '';
      continue;
    }
    current += c;
  }

  const tail = current.trim();
  if (tail && !/^this\b/.test(tail)) params.push(tail);
  return params;
}

function findAssignmentEquals(text, index) {
  let paren = 0;
  let square = 0;
  let brace = 0;
  let angle = 0;

  for (let i = index; i < text.length; i++) {
    const c = text[i];
    if (c === ';' && paren === 0 && square === 0 && brace === 0 && angle === 0) return -1;
    if (c === '=' && paren === 0 && square === 0 && brace === 0 && angle === 0) return i;
    if (c === '(') paren++;
    else if (c === ')' && paren > 0) paren--;
    else if (c === '[') square++;
    else if (c === ']' && square > 0) square--;
    else if (c === '{') brace++;
    else if (c === '}' && brace > 0) brace--;
    else if (c === '<') angle++;
    else if (c === '>' && angle > 0) angle--;
  }

  return -1;
}

function findArrowAfterParams(text, index, allowReturnType) {
  if (!allowReturnType) {
    const i = skipWhitespace(text, index);
    return text.slice(i, i + 2) === '=>' ? i : -1;
  }

  let paren = 0;
  let square = 0;
  let brace = 0;
  let angle = 0;
  for (let i = index; i < text.length; i++) {
    const c = text[i];
    if (c === ';' && paren === 0 && square === 0 && brace === 0 && angle === 0) return -1;
    if (c === '=' && text[i + 1] === '>' && paren === 0 && square === 0 && brace === 0 && angle === 0) return i;
    if (c === '(') paren++;
    else if (c === ')' && paren > 0) paren--;
    else if (c === '[') square++;
    else if (c === ']' && square > 0) square--;
    else if (c === '{') brace++;
    else if (c === '}' && brace > 0) brace--;
    else if (c === '<') angle++;
    else if (c === '>' && angle > 0) angle--;
  }
  return -1;
}

function skipTypeParameters(text, index) {
  const i = skipWhitespace(text, index);
  if (text[i] !== '<') return i;
  const end = findMatching(text, i, '<', '>');
  if (end < 0) return i;
  return skipWhitespace(text, end + 1);
}

function findExpressionBodyEnd(text, index) {
  let paren = 0;
  let square = 0;
  let brace = 0;
  for (let i = index; i < text.length; i++) {
    const c = text[i];
    if ((c === ';' || c === '\n') && paren === 0 && square === 0 && brace === 0) return i;
    if (c === '(') paren++;
    else if (c === ')' && paren > 0) paren--;
    else if (c === '[') square++;
    else if (c === ']' && square > 0) square--;
    else if (c === '{') brace++;
    else if (c === '}' && brace > 0) brace--;
  }
  return text.length - 1;
}

function parseArrowFunction(text, index) {
  let i = skipWhitespace(text, index);
  if (/^async\b/.test(text.slice(i))) i = skipWhitespace(text, i + 5);
  i = skipTypeParameters(text, i);

  let params = [];
  let afterParams = i;
  let allowReturnType = false;
  if (text[i] === '(') {
    const paramsEnd = findMatching(text, i, '(', ')');
    if (paramsEnd < 0) return null;
    params = splitTopLevelParameters(text.slice(i + 1, paramsEnd));
    afterParams = paramsEnd + 1;
    allowReturnType = true;
  } else {
    const single = /^[A-Za-z_$][a-zA-Z0-9_$]*/.exec(text.slice(i));
    if (!single) return null;
    params = [single[0]];
    afterParams = i + single[0].length;
  }

  const arrowIndex = findArrowAfterParams(text, afterParams, allowReturnType);
  if (arrowIndex < 0) return null;
  const bodyStart = skipWhitespace(text, arrowIndex + 2);
  const bodyEnd = text[bodyStart] === '{'
    ? findMatching(text, bodyStart, '{', '}')
    : findExpressionBodyEnd(text, bodyStart);
  if (bodyEnd < bodyStart) return null;
  return { bodyStart, bodyEnd, parameters: params.length };
}

function countTernaryOperators(text) {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '?') continue;
    if (text[i + 1] === '.' || text[i + 1] === '?' || text[i - 1] === '?') continue;
    if (nextNonSpace(text, i + 1) === ':') continue;
    count++;
  }
  return count;
}

function estimateJsTsComplexity(maskedBody) {
  let complexity = 1;
  const control = maskedBody.match(/\b(if|for|while|catch|case|switch)\b/g);
  const boolOps = maskedBody.match(/&&|\|\|/g);
  complexity += control ? control.length : 0;
  complexity += boolOps ? boolOps.length : 0;
  complexity += countTernaryOperators(maskedBody);
  return complexity;
}

function isValidJsTsFunctionName(name) {
  if (!name || name === '<anonymous>' || name === 'constructor') return true;
  if (name.startsWith('_')) return true;
  return /^[a-z_$][a-zA-Z0-9_$]*$/.test(name) || /^[A-Z][a-zA-Z0-9_$]*$/.test(name);
}

function addJsTsFunction(functions, seenBodyStarts, node) {
  if (node.bodyStart < 0 || node.bodyEnd < node.bodyStart) return;
  if (seenBodyStarts.has(node.bodyStart)) return;
  seenBodyStarts.add(node.bodyStart);
  functions.push(node);
}

function analyzeJSTSFile(filePath) {
  const metrics = {
    path: filePath, lines: 0, code_lines: 0, comment_lines: 0,
    blank_lines: 0, functions: 0, classes: 0,
    max_complexity: 0, avg_function_length: 0,
  };
  const issues = [];
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch { return { metrics, issues }; }

  const lines = content.split('\n');
  const lineStarts = buildLineStarts(content);
  metrics.lines = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].trim();
    if (!stripped) metrics.blank_lines++;
    else if (
      stripped.startsWith('//') ||
      stripped.startsWith('/*') ||
      stripped.startsWith('*')
    ) metrics.comment_lines++;
    else metrics.code_lines++;

    if (lines[i].length > MAX_LINE_LENGTH) {
      issues.push({
        severity: 'info', category: 'format',
        message: `Line too long (${lines[i].length} > ${MAX_LINE_LENGTH})`,
        file_path: filePath, line_number: i + 1,
        suggestion: null,
      });
    }
  }

  if (metrics.code_lines > MAX_FILE_LENGTH) {
    issues.push({
      severity: 'warning', category: 'complexity',
      message: `File too long (${metrics.code_lines} code lines > ${MAX_FILE_LENGTH})`,
      file_path: filePath, suggestion: 'Consider splitting this file into smaller modules',
      line_number: null,
    });
  }

  const masked = maskJsTsSource(content);
  const functions = [];
  const seenBodyStarts = new Set();

  let match;
  const classRegex = /\bclass\s+([A-Za-z_$][a-zA-Z0-9_$]*)/g;
  while ((match = classRegex.exec(masked)) !== null) {
    const name = match[1];
    const lineNum = lineNumberAt(lineStarts, match.index);
    metrics.classes++;
    if (!/^[A-Z][a-zA-Z0-9_$]*$/.test(name)) {
      issues.push({
        severity: 'warning', category: 'naming',
        message: `Class '${name}' should use PascalCase`,
        file_path: filePath, line_number: lineNum,
        suggestion: 'Use PascalCase for class names',
      });
    }
  }

  const funcRegex = /\b(?:export\s+)?(?:default\s+)?(?:async\s+)?function\b\s*\*?\s*([A-Za-z_$][a-zA-Z0-9_$]*)?/g;
  while ((match = funcRegex.exec(masked)) !== null) {
    const name = match[1] || '<anonymous>';
    const paramsStart = masked.indexOf('(', funcRegex.lastIndex);
    if (paramsStart < 0) continue;
    const paramsEnd = findMatching(masked, paramsStart, '(', ')');
    if (paramsEnd < 0) continue;
    const bodyStart = findBodyStart(masked, paramsEnd + 1);
    if (bodyStart < 0) continue;
    const bodyEnd = findMatching(masked, bodyStart, '{', '}');
    if (bodyEnd < 0) continue;
    addJsTsFunction(functions, seenBodyStarts, {
      name,
      line: lineNumberAt(lineStarts, match.index),
      bodyStart,
      bodyEnd,
      parameters: splitTopLevelParameters(masked.slice(paramsStart + 1, paramsEnd)).length,
    });
  }

  const varRegex = /\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][a-zA-Z0-9_$]*)\b/g;
  while ((match = varRegex.exec(masked)) !== null) {
    const name = match[1];
    const equalsIndex = findAssignmentEquals(masked, varRegex.lastIndex);
    if (equalsIndex < 0) continue;
    const arrow = parseArrowFunction(masked, equalsIndex + 1);
    if (!arrow) continue;
    addJsTsFunction(functions, seenBodyStarts, {
      name,
      line: lineNumberAt(lineStarts, match.index),
      bodyStart: arrow.bodyStart,
      bodyEnd: arrow.bodyEnd,
      parameters: arrow.parameters,
    });
  }

  const fieldRegex = new RegExp(
    String.raw`(?:^|[{\n;])\s*` +
    String.raw`(?:(?:public|private|protected|readonly|static|declare|abstract)\s+)*` +
    String.raw`([A-Za-z_$][a-zA-Z0-9_$]*)\s*[!?]?\s*(?::[^=;]+)?=`,
    'g'
  );
  while ((match = fieldRegex.exec(masked)) !== null) {
    const name = match[1];
    const equalsIndex = masked.indexOf('=', match.index);
    if (equalsIndex < 0) continue;
    const arrow = parseArrowFunction(masked, equalsIndex + 1);
    if (!arrow) continue;
    const nameIndex = match.index + match[0].lastIndexOf(name);
    addJsTsFunction(functions, seenBodyStarts, {
      name,
      line: lineNumberAt(lineStarts, nameIndex),
      bodyStart: arrow.bodyStart,
      bodyEnd: arrow.bodyEnd,
      parameters: arrow.parameters,
    });
  }

  const methodSkip = new Set([
    'if', 'for', 'while', 'switch', 'catch', 'function', 'return',
    'do', 'else', 'try', 'finally', 'new', 'class',
  ]);
  const methodRegex = /\b(?:async\s+)?(?:static\s+)?([A-Za-z_$][a-zA-Z0-9_$]*)\s*(?:<[^>{};=()]*>)?\s*\(/g;
  while ((match = methodRegex.exec(masked)) !== null) {
    const name = match[1];
    if (methodSkip.has(name)) continue;
    const prev = previousNonSpace(masked, match.index - 1);
    if (prev && !['{', '}', ';', ','].includes(prev)) continue;

    const paramsStart = masked.indexOf('(', match.index);
    const paramsEnd = findMatching(masked, paramsStart, '(', ')');
    if (paramsEnd < 0) continue;
    const bodyStart = findBodyStart(masked, paramsEnd + 1);
    if (bodyStart < 0) continue;
    const bodyEnd = findMatching(masked, bodyStart, '{', '}');
    if (bodyEnd < 0) continue;
    addJsTsFunction(functions, seenBodyStarts, {
      name,
      line: lineNumberAt(lineStarts, match.index),
      bodyStart,
      bodyEnd,
      parameters: splitTopLevelParameters(masked.slice(paramsStart + 1, paramsEnd)).length,
    });
  }

  for (const fn of functions) {
    const startLine = lineNumberAt(lineStarts, fn.bodyStart);
    const endLine = lineNumberAt(lineStarts, fn.bodyEnd);
    const length = endLine - startLine + 1;
    const complexity = estimateJsTsComplexity(masked.slice(fn.bodyStart, fn.bodyEnd + 1));
    fn.length = length;
    fn.complexity = complexity;
    metrics.max_complexity = Math.max(metrics.max_complexity, complexity);

    if (length > MAX_FUNCTION_LENGTH) {
      issues.push({
        severity: 'warning', category: 'complexity',
        message: `Function '${fn.name}' is too long (${length} lines > ${MAX_FUNCTION_LENGTH})`,
        file_path: filePath, line_number: fn.line,
        suggestion: 'Consider splitting this function into smaller functions',
      });
    }
    if (complexity > MAX_COMPLEXITY) {
      issues.push({
        severity: 'warning', category: 'complexity',
        message: `Function '${fn.name}' cyclomatic complexity is high (${complexity} > ${MAX_COMPLEXITY})`,
        file_path: filePath, line_number: fn.line,
        suggestion: 'Reduce branching or extract helper functions',
      });
    }
    if (fn.parameters > MAX_PARAMETERS) {
      issues.push({
        severity: 'warning', category: 'design',
        message: `Function '${fn.name}' has too many parameters (${fn.parameters} > ${MAX_PARAMETERS})`,
        file_path: filePath, line_number: fn.line,
        suggestion: 'Consider using an options object',
      });
    }
    if (!isValidJsTsFunctionName(fn.name)) {
      issues.push({
        severity: 'info', category: 'naming',
        message: `Function '${fn.name}' should use camelCase or PascalCase`,
        file_path: filePath, line_number: fn.line,
        suggestion: 'Use camelCase for functions or PascalCase for components/classes',
      });
    }
    if (fn.name.length < MIN_FUNCTION_NAME_LENGTH) {
      issues.push({
        severity: 'warning', category: 'naming',
        message: `Function '${fn.name}' name is too short`,
        file_path: filePath, line_number: fn.line,
        suggestion: 'Use a more descriptive function name',
      });
    }
  }

  metrics.functions = functions.length;
  if (functions.length > 0) {
    metrics.avg_function_length = functions.reduce((sum, fn) => sum + fn.length, 0) / functions.length;
  }

  return { metrics, issues };
}

function analyzeGenericFile(filePath) {
  const metrics = {
    path: filePath, lines: 0, code_lines: 0, comment_lines: 0,
    blank_lines: 0, functions: 0, classes: 0,
    max_complexity: 0, avg_function_length: 0,
  };
  const issues = [];
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch { return { metrics, issues }; }

  const lines = content.split('\n');
  metrics.lines = lines.length;
  const prefix = COMMENT_PREFIXES[
    path.extname(filePath).toLowerCase()
  ] || '//';

  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].trim();
    if (!stripped) metrics.blank_lines++;
    else if (
      stripped.startsWith(prefix) ||
      stripped.startsWith('/*') ||
      stripped.startsWith('*')
    ) metrics.comment_lines++;
    else metrics.code_lines++;

    if (lines[i].length > MAX_LINE_LENGTH) {
      issues.push({
        severity: 'info', category: '格式',
        message: `行过长 (${lines[i].length} > ${MAX_LINE_LENGTH})`,
        file_path: filePath, line_number: i + 1,
        suggestion: null,
      });
    }
  }

  if (metrics.code_lines > MAX_FILE_LENGTH) {
    issues.push({
      severity: 'warning', category: '复杂度',
      message: `文件过长 (${metrics.code_lines} 行代码 > ${MAX_FILE_LENGTH})`,
      file_path: filePath, suggestion: '考虑拆分为多个模块',
      line_number: null,
    });
  }

  return { metrics, issues };
}

function analyzePythonFile(filePath) {
  const metrics = {
    path: filePath, lines: 0, code_lines: 0, comment_lines: 0,
    blank_lines: 0, functions: 0, classes: 0,
    max_complexity: 0, avg_function_length: 0,
  };
  const issues = [];
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    issues.push({
      severity: 'error', category: '文件',
      message: `无法读取文件: ${e.message}`,
      file_path: filePath, line_number: null, suggestion: null,
    });
    return { metrics, issues };
  }

  const lines = content.split('\n');
  metrics.lines = lines.length;
  let inMultiline = false;

  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].trim();
    if (!stripped) { metrics.blank_lines++; }
    else if (stripped.startsWith('#')) { metrics.comment_lines++; }
    else if (stripped.includes('"""') || stripped.includes("'''")) {
      const dq = (stripped.match(/"""/g) || []).length;
      const sq = (stripped.match(/'''/g) || []).length;
      if (dq === 2 || sq === 2) { metrics.comment_lines++; }
      else { inMultiline = !inMultiline; metrics.comment_lines++; }
    } else if (inMultiline) { metrics.comment_lines++; }
    else { metrics.code_lines++; }

    if (lines[i].length > MAX_LINE_LENGTH) {
      issues.push({
        severity: 'info', category: '格式',
        message: `行过长 (${lines[i].length} > ${MAX_LINE_LENGTH})`,
        file_path: filePath, line_number: i + 1,
        suggestion: null,
      });
    }
  }

  if (metrics.code_lines > MAX_FILE_LENGTH) {
    issues.push({
      severity: 'warning', category: '复杂度',
      message: `文件过长 (${metrics.code_lines} 行代码 > ${MAX_FILE_LENGTH})`,
      file_path: filePath, suggestion: '考虑拆分为多个模块',
      line_number: null,
    });
  }

  // Regex-based Python analysis (no AST available in Node)
  const funcRegex = /^( *)(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/gm;
  const classRegex = /^( *)class\s+(\w+)/gm;
  const functions = [];
  let match;

  while ((match = funcRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    const name = match[2];
    const indent = match[1].length;
    const params = match[3].trim()
      ? match[3].split(',').map(p => p.trim())
        .filter(p => p && p !== 'self' && p !== 'cls')
      : [];

    // Calculate function length by finding next line at same or lesser indent
    const funcLines = lines.slice(lineNum); // lines after def
    let length = 1;
    for (let j = 1; j < funcLines.length; j++) {
      const l = funcLines[j];
      if (l.trim() === '') { length++; continue; }
      const curIndent = l.match(/^(\s*)/)[1].length;
      if (curIndent <= indent && l.trim() !== '') break;
      length++;
    }

    // Estimate complexity from function body
    const bodyLines = lines.slice(lineNum, lineNum + length - 1);
    let complexity = 1;
    for (const bl of bodyLines) {
      const s = bl.trim();
      if (/^(if|elif|while|for)\s/.test(s) || /^(if|elif|while|for)\(/.test(s)) complexity++;
      if (/^except(\s|:)/.test(s)) complexity++;
      if (/\s(and|or)\s/.test(s)) complexity++;
      if (/\sfor\s/.test(s) && /\sin\s/.test(s) && (s.includes('[') || s.includes('('))) complexity++;
    }

    functions.push({ name, line: lineNum, length, complexity, parameters: params.length });
    metrics.max_complexity = Math.max(metrics.max_complexity, complexity);

    // Check function length
    if (length > MAX_FUNCTION_LENGTH) {
      issues.push({
        severity: 'warning', category: '复杂度',
        message: `函数 '${name}' 过长 (${length} 行 > ${MAX_FUNCTION_LENGTH})`,
        file_path: filePath, line_number: lineNum,
        suggestion: '考虑拆分为多个小函数',
      });
    }
    // Check complexity
    if (complexity > MAX_COMPLEXITY) {
      issues.push({
        severity: 'warning', category: '复杂度',
        message: `函数 '${name}' 圈复杂度过高 (${complexity} > ${MAX_COMPLEXITY})`,
        file_path: filePath, line_number: lineNum,
        suggestion: '减少嵌套层级，提取子函数',
      });
    }
    // Check parameter count
    if (params.length > MAX_PARAMETERS) {
      issues.push({
        severity: 'warning', category: '设计',
        message: `函数 '${name}' 参数过多 (${params.length} > ${MAX_PARAMETERS})`,
        file_path: filePath, line_number: lineNum,
        suggestion: '考虑使用配置对象或数据类封装参数',
      });
    }
    // Check naming
    const SPECIAL = new Set([
      'setUp', 'tearDown', 'setUpClass',
      'tearDownClass', 'setUpModule', 'tearDownModule',
    ]);
    if (!name.startsWith('_') && !SPECIAL.has(name) && !name.startsWith('visit_')) {
      if (!/^[a-z][a-z0-9_]*$/.test(name)) {
        issues.push({
          severity: 'info', category: '命名',
          message: `函数名 '${name}' 不符合 snake_case 规范`,
          file_path: filePath, line_number: lineNum,
          suggestion: '函数名应使用 snake_case',
        });
      }
    }
    if (name.length < MIN_FUNCTION_NAME_LENGTH) {
      issues.push({
        severity: 'warning', category: '命名',
        message: `函数名 '${name}' 过短`,
        file_path: filePath, line_number: lineNum,
        suggestion: '使用更具描述性的函数名',
      });
    }
  }

  while ((match = classRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    const name = match[2];
    metrics.classes++;
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
      issues.push({
        severity: 'warning', category: '命名',
        message: `类名 '${name}' 不符合 PascalCase 规范`,
        file_path: filePath, line_number: lineNum,
        suggestion: '类名应使用 PascalCase，如 MyClassName',
      });
    }
  }

  metrics.functions = functions.length;
  if (functions.length > 0) {
    metrics.avg_function_length = functions.reduce((s, f) => s + f.length, 0) / functions.length;
  }

  return { metrics, issues };
}

// --- Directory scan ---

function analyzeResolvedFile(full) {
  const ext = path.extname(full).toLowerCase();
  if (!CODE_EXTENSIONS.has(ext)) {
    return {
      metrics: {
        path: full, lines: 0, code_lines: 0, comment_lines: 0,
        blank_lines: 0, functions: 0, classes: 0,
        max_complexity: 0, avg_function_length: 0,
      },
      issues: [],
      skipped: true,
    };
  }
  if (ext === '.py') return analyzePythonFile(full);
  if (JSTS_EXTENSIONS.has(ext)) return analyzeJSTSFile(full);
  return analyzeGenericFile(full);
}

function scanDirectory(scanPath, excludeDirs) {
  const resolved = path.resolve(scanPath);
  const exclude = excludeDirs || EXCLUDE_DIRS;
  const result = {
    scan_path: resolved, files_scanned: 0,
    total_lines: 0, total_code_lines: 0,
    issues: [], file_metrics: [],
  };

  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch {
    return result;
  }

  if (stat.isFile()) {
    const analysis = analyzeResolvedFile(resolved);
    if (!analysis.skipped) {
      result.files_scanned++;
      result.file_metrics.push(analysis.metrics);
      result.issues.push(...analysis.issues);
      result.total_lines += analysis.metrics.lines;
      result.total_code_lines += analysis.metrics.code_lines;
    }
    return result;
  }

  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (exclude.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      const ext = path.extname(entry.name).toLowerCase();
      if (!CODE_EXTENSIONS.has(ext)) continue;

      const { metrics, issues } = analyzeResolvedFile(full);
      result.files_scanned++;
      result.file_metrics.push(metrics);
      result.issues.push(...issues);
      result.total_lines += metrics.lines;
      result.total_code_lines += metrics.code_lines;
    }
  }

  walk(resolved);
  return result;
}

// --- Reporting ---

function passed(result) { return !hasFatal(result.issues); }

function formatReport(result, verbose) {
  const errs = result.issues.filter(i => i.severity === 'error').length;
  const warns = result.issues.filter(i => i.severity === 'warning').length;
  const fields = {
    '扫描路径': result.scan_path,
    '扫描文件': result.files_scanned,
    '总行数': result.total_lines,
    '代码行数': result.total_code_lines,
    '检查结果': passed(result) ? '✓ 通过' : '✗ 需要关注',
    '统计': `错误: ${errs} | 警告: ${warns}`,
  };
  let report = buildReport(
    '代码质量检查报告', fields, result.issues, verbose, 'category'
  );

  if (verbose && result.file_metrics.length) {
    const complex = result.file_metrics
      .filter(m => m.max_complexity > 0)
      .sort((a, b) => b.max_complexity - a.max_complexity)
      .slice(0, 5);
    if (complex.length) {
      const lines = ['\n' + '-'.repeat(40), '复杂度最高的文件:', '-'.repeat(40)];
      for (const m of complex) lines.push(`  ${m.path}: 复杂度 ${m.max_complexity}, ${m.functions} 个函数`);
      report += '\n' + lines.join('\n');
    }
  }
  return report;
}

// --- CLI ---

function main() {
  const opts = parseCliArgs(process.argv);

  const result = scanDirectory(opts.target);

  if (opts.json) {
    const output = {
      scan_path: result.scan_path,
      files_scanned: result.files_scanned,
      total_lines: result.total_lines,
      total_code_lines: result.total_code_lines,
      passed: passed(result),
      error_count: result.issues.filter(i => i.severity === 'error').length,
      warning_count: result.issues.filter(i => i.severity === 'warning').length,
      file_metrics: result.file_metrics,
      issues: result.issues
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(formatReport(result, opts.verbose));
  }

  process.exit(passed(result) ? 0 : 1);
}

main();
