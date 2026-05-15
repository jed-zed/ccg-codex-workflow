---
name: plan
description: Create or revise a CCG implementation plan with Codex as planner and Gemini as a read-only analysis helper. Use when the user invokes /ccg:plan, asks to generate a .codex/ccg/plans/*.md CCG plan, asks to revise an existing CCG plan, or wants multi-model Codex+Gemini planning without modifying product code.
---

# CCG Plan

Create decision-complete CCG plans for later `/ccg:execute`. This skill replaces the original Claude-led `/ccg:plan` with a Codex-native planner: Codex gathers context and writes the final plan under `.codex/ccg/plans/`; Gemini contributes read-only analysis from a disposable snapshot.

## Boundaries

- Write new plans only to `.codex/ccg/plans/*.md`. Do not create new `.claude/plan/*.md` files.
- Legacy `.claude/plan/*.md` files are read-compatible inputs. Revise a legacy `.claude/plan/*.md` file only when the user explicitly names that existing legacy file; mention in Chinese that it is a compatibility write.
- Do not modify product code, tests, migrations, package files, or original Claude CCG plugin files.
- Do not call `~/.claude/bin/codeagent-wrapper.exe` or any Claude-side execution wrapper.
- Do not call `/ccg:execute` automatically and do not ask for a Y/N execution handoff.
- If no user requirement is provided, answer in Chinese with usage examples and do not write files.
- If the user explicitly asks to revise an existing plan file, update only that plan file. Otherwise create a new plan and never overwrite an existing plan; use `-v2`, `-v3`, and so on.

## Language Contract

All `/ccg:plan` user-facing output must be Chinese by default. This includes empty-input usage/help, progress summaries, ambiguity questions, Gemini launch or failure reports, saved-plan summaries, and the final `/ccg:execute <plan-path>` handoff. English is allowed only for literal commands, file paths, code identifiers, generated English slugs, model names, environment variables, and raw Gemini excerpts that are clearly labeled as excerpts.

The generated plan file itself must also be Chinese by default. Hard requirement:

- Use Chinese section headings, table headers, checklist labels, narrative text, risk descriptions, test strategy, and handoff explanation.
- Keep English only for literal commands, file paths, code identifiers, model names, environment variables, generated slugs, URLs, and clearly labeled raw Gemini excerpts.
- Do not write an English plan template and then summarize it in Chinese; the saved `.codex/ccg/plans/*.md` content is the final CCG planning output and must be Chinese.
- If Gemini responds in English, synthesize it into Chinese before writing the final plan, while preserving short literal excerpts only when useful.

Internal prompts to tools or Gemini may use English when that improves retrieval or technical precision, but Codex must translate the final planning interaction and the saved plan content back into concise Chinese for the user.

## Gemini gate

For any real plan creation or plan revision, Gemini participation is mandatory. Before you write or present a final plan, you must have all of the following:

- a successful Gemini helper launch using `gemini-3.1-pro-preview` by default, unless the user explicitly provided another model;
- `CCG_GEMINI_PREVIEW_URL` and either `CCG_GEMINI_BROWSER_OPENED=1` or a clear note that the user should open the preview URL manually;
- a real `CCG_GEMINI_RESPONSE_FILE` path printed by the helper;
- a non-empty response read from that response file;
- a final synthesis that includes both Codex analysis and Gemini analysis.

If the Gemini helper cannot start, exits unsuccessfully, does not print `CCG_GEMINI_RESPONSE_FILE`, writes an empty response, or still fails after two retries, stop and report the failure in Chinese. In that case, do not write or present a final plan, do not create or edit `.codex/ccg/plans/*.md` or legacy `.claude/plan/*.md`, and do not emit a fake multi-model `<proposed_plan>`.

This gate does not apply to empty-input usage/help responses.

## Workflow

1. **Preflight**
   - Run `git status --short`.
   - Read relevant project instructions such as `AGENTS.md`, local README files, and existing plan files only when they affect the requested plan.
   - Resolve the absolute project root from the current workspace; do not infer it from home paths.

2. **Enhance the requirement**
   - Convert the user request into structured planning input: goal, in-scope behavior, out-of-scope behavior, constraints, acceptance criteria, likely affected areas, and open questions.
   - If high-impact ambiguity remains, ask the user before writing any plan.

3. **Search project context**
   - Prefer `mcp__ace-tool__search_context` when available.
   - Fall back to `mcp__fast-context__fast_context_search` if available, then `rg`, PowerShell-native search, `Glob`, `Grep`, and targeted file reads.
   - If ace-tool, fast-context, or `rg` fail because credentials are missing or access is denied, continue with targeted reads and exact search instead of aborting.
   - Gather enough evidence to name key files, symbols, existing patterns, and verification commands. Do not invent paths.

4. **Run Gemini read-only analysis**
   - Use the bundled helper from `../ccg-executor/scripts/invoke_gemini_preview.py`.
   - Invoke Gemini with `--approval-mode plan --detach --prompt-template plan`, default model `gemini-3.1-pro-preview`, no `--direct-workdir`, and no `--no-browser` unless the user explicitly asks for headless mode.
   - Confirm the helper prints `CCG_GEMINI_BROWSER_OPENED=1` or report the printed `CCG_GEMINI_PREVIEW_URL` so the user can open it manually.
   - Record `CCG_GEMINI_PROMPT_TEMPLATE=plan` and `CCG_GEMINI_AUTO_CLOSE_BROWSER_SECONDS`; the preview should close itself after completion unless the user explicitly disables auto-close.
   - Treat `CCG_GEMINI_SNAPSHOT_EXCLUDES` as a security boundary. If excluded secret/config files are relevant, ask the user for sanitized details instead of weakening the snapshot exclusions.
   - Include the enhanced requirement, context evidence, and a request for concise analysis: alternative approaches, edge cases, UI/UX concerns when relevant, tests, risks, and recommended plan steps.
   - Retry failed Gemini calls up to 2 times. If all attempts fail, stop and report the failure; do not generate a fake multi-model plan.
   - After detach, Poll `CCG_GEMINI_RESPONSE_FILE` every 5 seconds. Stop only when the file exists and has size > 0, then read it before writing the final plan.
   - If the response file is still missing or empty after 10 minutes, inspect `CCG_GEMINI_LAUNCHER_LOG`; if the launcher log shows a failure, retry the helper call. After two retries or 10 minutes on the final attempt, stop and report failure without writing a plan.

5. **Synthesize the plan**
   - Codex is authoritative for backend, data, architecture, repository patterns, and final sequencing.
   - Treat Gemini as a strong reference for frontend, UX, accessibility, integration risks, and missing test cases.
   - Record disagreements and the final tradeoff instead of hiding them.
   - Translate or synthesize all Gemini findings into Chinese before saving the final plan.

6. **Write the plan**
   - Create `.codex/ccg/plans/` if missing.
   - Generate an English kebab-case slug from the task name. If it cannot be inferred cleanly, use `ccg-plan`.
   - For a new plan, choose `.codex/ccg/plans/<slug>.md`; if it exists, use `.codex/ccg/plans/<slug>-v2.md`, then `-v3`, etc.
   - For an explicit revision request, write only the specified existing plan file. If that file is under `.claude/plan/`, treat it as a legacy compatibility write and say so in Chinese.
   - Ensure the saved plan content follows the Chinese plan template below. Then show the full plan summary in Chinese and stop. Do not continue into implementation.

## Plan Template

Use this Chinese Markdown structure:

```markdown
# CCG 计划：<任务名称>

**生成者**：Codex CCG Planner
**任务类型**：后端 / 前端 / 全栈 / 文档 / 重构
**计划路径**：`.codex/ccg/plans/<file>.md`
**Gemini 模型**：`gemini-3.1-pro-preview`
**Gemini 预览**：`<CCG_GEMINI_PREVIEW_URL>`；浏览器已打开：<是/否>
**Gemini 响应文件**：`<CCG_GEMINI_RESPONSE_FILE>`

## 1. 增强需求

### 目标
<业务或技术目标>

### 范围内
- <包含的行为>

### 不在范围内
- <排除的行为>

### 约束
- <技术或流程约束>

### 验收标准
- [ ] <可观察的验收条件>

## 2. 上下文证据

| 区域 | 证据 |
|------|------|
| <模块> | `<file-or-symbol>` - <关键点> |

## 3. 多模型分析

### Codex 分析
<架构、后端/数据影响、仓库模式适配>

### Gemini 分析
<从响应文件综合后的只读助手发现，用中文表述>

### 分歧与最终决策
| 主题 | 决策 | 原因 |
|------|------|------|

## 4. WBS 实施步骤

### 模块 A：<名称>（<点数> 任务点）

**文件**：`<path>`

- [ ] **任务 A.1**：<任务>（<点数> 点）
  - **输入**：<依赖>
  - **输出**：<交付物>
  - **步骤**：
    1. <机械步骤>
    2. <机械步骤>

## 5. 关键文件

| 文件 | 动作 | 说明 |
|------|------|------|
| `<path>` | 新建 / 修改 / 验证 | <原因> |

## 6. 测试策略

- **单元测试**：<聚焦测试>
- **集成测试**：<API/数据流测试>
- **E2E/手工验证**：<关键用户流程或手工检查>

## 7. 风险与缓解

| 风险 | 缓解 |
|------|------|

## 8. Codex 原生交接

审阅后手动运行：

```text
/ccg:execute .codex/ccg/plans/<file>.md
```

Gemini 模型：`gemini-3.1-pro-preview`
Gemini 预览 URL：`<url>`
Gemini 浏览器已打开：<是/否>
Gemini 响应文件：`<path>`
```

## 交付消息

保存计划后，用中文回复：

- 说明保存路径。
- 概括选定的技术方案。
- 说明 Gemini 是否参与，以及响应文件在哪里。
- 提供准确的手动执行命令：

```text
/ccg:execute .codex/ccg/plans/<file>.md
```

然后停止。不要询问是否要继续执行。
