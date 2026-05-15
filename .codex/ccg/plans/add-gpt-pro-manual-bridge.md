# CCG 计划：新增 GPT Pro 人工桥接第二视角

**生成者**：Codex CCG Planner
**任务类型**：工具 / 文档 / 测试 / CI
**计划路径**：`.codex/ccg/plans/add-gpt-pro-manual-bridge.md`
**Gemini 模型**：`gemini-3.1-pro-preview`
**Gemini 预览**：`http://127.0.0.1:56576/`；浏览器已打开：是
**Gemini 响应文件**：`C:\Users\29933\.codex\ccg\logs\gemini-preview-20260515-105712.response.txt`

## 1. 增强需求

### 目标

在现有 Codex-native CCG 插件中新增 ChatGPT Pro 人工桥接能力，为规划、审阅、执行伴侣三个场景提供用户手动粘贴 prompt 和手动回填 response 的第二视角。

新增命令：

- `/ccg:gptpro-plan`：规划第二视角。
- `/ccg:gptpro-review`：审阅第二视角。
- `/ccg:gptpro-exc`：执行阶段只读实现伴侣。

### 范围内

- 新增三个命令文件、三个入口 skill、一个共享 bridge skill、一个 Python 标准库桥接脚本和五个 prompt 模板。
- 所有 GPT Pro 桥接产物写入 `.codex/ccg/gptpro/<timestamp>-<mode>-<slug>/`。
- `status.json` 固定记录人工提问预算、安全边界和 round 状态。
- 本地 preview 页面只服务本机页面、prompt 展示、手动复制、手动粘贴响应和保存响应。
- 更新命令索引、skill 索引、doctor、command bridge installer、validator、fixture tests、README、parity matrix、CI。
- 补充 `docs/gptpro-manual-bridge.md`，明确这是人工桥接，不是 ChatGPT 网页自动化。

### 不在范围内

- 不接管 `/ccg:plan`、`/ccg:review`、`/ccg:execute` 的默认流程。
- 不自动登录 ChatGPT。
- 不自动提交 prompt。
- 不读取 ChatGPT 网页 DOM。
- 不自动提取 ChatGPT 输出。
- 不保存 cookie、session、token 或账号凭据。
- 不绕过 rate limits、restrictions 或 protective measures。
- 不调用 OpenAI API；若以后需要全自动，应另起方案使用官方 API。

### 约束

- Codex 始终是最终规划、执行、审阅和验证负责人。
- GPT Pro 输出只是不可信的辅助证据，必须由 Codex 独立判断。
- 每个 GPT Pro bridge 命令默认人工提问 1 次，最多 2 次。
- 第 2 轮只允许 blocker 复查、修订计划对比、已应用 diff 复审或高风险 follow-up。
- 超过 2 次时应拆分任务，或回到 `/ccg:plan`、`/ccg:spec-*`、`/ccg:review` 等 Codex-native CCG 工作流。
- Python bridge 优先使用标准库，不引入 Flask、FastAPI、pyperclip 等额外依赖。
- 本地 server 只绑定 `127.0.0.1`，端口动态分配或冲突时自动换端口。

### 验收标准

- [ ] 三个新命令文件存在，并能清楚路由到对应 skill。
- [ ] 四个新 skill 都包含 frontmatter、`agents/openai.yaml` 和人工桥接边界。
- [ ] `gptpro_bridge.py` 可创建 `status.json`、`round-1/prompt.md`、`round-1/response.md`，并能通过本地 endpoint 保存手动响应。
- [ ] `status.json` 包含 `manual_questions_expected: 1`、`manual_questions_max: 2`、`web_automation: false`、`dom_extraction: false`、`manual_copy_required: true` 等字段。
- [ ] follow-up 只创建 `round-2`，并拒绝 `--round` 大于 2。
- [ ] validator、fixture、doctor、README、parity matrix、CI 都覆盖新桥接面。
- [ ] 本地验收命令全部通过。

## 2. 上下文证据

| 区域 | 证据 |
| --- | --- |
| 命令目录 | `plugins/ccg/commands/*.md` 使用 frontmatter 和简短路由说明，例如 `review.md` 路由到 CCG skill。 |
| skill 目录 | `plugins/ccg/skills/<skill>/SKILL.md` 加 `agents/openai.yaml`，`validateSkills()` 会检查 frontmatter 的 `name` 和 `description`。 |
| 命令索引 | `plugins/ccg/commands/ccg.md` 列出所有 `/ccg:*` 命令。 |
| skill 索引 | `plugins/ccg/skills/ccg/SKILL.md` 同步列出命令，并说明 Codex/Gemini 分工。 |
| command bridge | `scripts/install-codex-command-bridge.ps1` 用 `Copy-Command` 从 `plugins/ccg/commands` 复制到 `~/.codex/commands/ccg/*.md`。 |
| doctor | `plugins/ccg/scripts/doctor.ps1` 通过数组检查 command、skill、cache key、cached skill、prompt-visible skill 和 bridge file。 |
| validator | `scripts/validate-plugin.js` 通过 `validateScripts()`、`validateFullParitySurface()`、`validateSkills()`、`validateCiActions()` 等函数做文件和关键短语契约检查。 |
| fixture harness | `scripts/run-fixture-tests.js` 自带 `test()`、`assert()`、`run()`、`tempDir()`、`writeFile()`，已有 `fixture:*` marker 可延续。 |
| CI | `.github/workflows/ci.yml` 已跑 validator、Gemini helper py_compile 和 fixture tests。 |
| 文档 | `README.md` 和 `docs/original-ccg-parity-matrix.md` 是命令表述与 parity 状态的来源。 |
| 外部合规依据 | OpenAI Terms of Use 当前页面显示 `Effective: January 1, 2026`，并限制自动或程序化提取数据或 Output、绕过限制或保护措施；Responses API 是官方 API 参考入口。 |

## 3. 多模型分析

### Codex 分析

这次变更是插件命令面、辅助脚本、文档和验证体系的扩展，不应改动已有 Gemini preview 逻辑，也不应把 GPT Pro 桥接强制接入现有 `/ccg:plan` 门禁。最安全的第一版是独立命令：生成本地 artifacts 和本地 preview，让用户手动完成 ChatGPT Pro 的输入输出传递。

实现时要重点保持现有仓库风格：

- 命令文件保持薄路由。
- 场景入口 skill 只描述行为，公共逻辑沉到 `ccg-gptpro-bridge`。
- validator 负责结构和关键边界短语。
- fixture tests 直接验证 helper 行为，而不是依赖真实 ChatGPT。
- CI 只编译新 helper，不调用外部服务。

### Gemini 分析

Gemini 认可用户方案的主线，并补充了三个实现风险：

- 不要用 `pyperclip`，避免跨平台和依赖问题；复制按钮应由本地 HTML 使用 `navigator.clipboard.writeText()` 实现。
- 本地 server 使用 Python 标准库 `http.server` 即可，避免新增依赖。
- 端口应动态分配或冲突后自动切换，避免固定端口失败。

Gemini 还建议 fixture 通过子进程启动 helper、访问本地页面、POST mock response 到 `/save-response`，再断言 `response.md` 和 `status.json`。

### 分歧与最终决策

| 主题 | 决策 | 原因 |
| --- | --- | --- |
| 是否新增 `/shutdown` endpoint | 第一版不作为必需项；只在不扩大验收范围时可作为实现细节加入。 | 用户给出的 endpoint 契约没有要求它，核心验收是手动保存响应和 round 限制。 |
| 是否用 Python 剪贴板库 | 不使用。 | 本地浏览器按钮能完成复制，且不引入依赖。 |
| 是否强接入 `/ccg:plan` | 不强接入。 | 用户明确第一版先实现独立命令。 |
| 是否自动打开 ChatGPT | 只允许 `webbrowser.open("https://chatgpt.com/")`。 | 这是用户可见的普通打开页面，不读取、不提交、不提取网页内容。 |
| session 生命周期 | `--wait-response` 才阻塞等待；否则创建 artifacts 和 preview 后返回。 | 避免用户手动流程让 Codex 长时间挂起。 |

## 4. WBS 实施步骤

### 模块 A：共享 bridge 脚本与模板（8 点）

**文件**：`plugins/ccg/skills/ccg-gptpro-bridge/**`

- [ ] **任务 A.1**：创建共享 skill 与 agent（1 点）
  - **输入**：用户方案第 7 节。
  - **输出**：`SKILL.md`、`agents/openai.yaml`。
  - **步骤**：
    1. 写入 hard boundaries、manual question budget、workflow。
    2. 明确 Codex final owner 与 GPT Pro output untrusted。

- [ ] **任务 A.2**：创建 prompt 模板（2 点）
  - **输入**：用户方案第 5 节。
  - **输出**：`base.md`、`plan.md`、`review.md`、`exc.md`、`followup.md`。
  - **步骤**：
    1. 保留模式化输出要求。
    2. 在 `followup.md` 中强调只处理 stated follow-up reason。

- [ ] **任务 A.3**：实现 `gptpro_bridge.py` 参数解析和 artifacts（2 点）
  - **输入**：用户方案第 3、4 节。
  - **输出**：可创建 session、round 文件和 `status.json` 的标准库脚本。
  - **步骤**：
    1. 支持 `--mode plan|review|exc`、`--workdir`、`--prompt`、`--prompt-file`、`--slug`、`--output-root`、`--round`、`--followup-session`、`--followup-reason`、`--open-preview`、`--open-chatgpt`、`--copy-prompt`、`--wait-response`、`--hold-seconds`。
    2. 默认创建 `round-1`；只有 `--followup-session` 或 `--round 2` 创建 `round-2`。
    3. 拒绝 `--round` 大于 2。
    4. 写入相对路径友好的 `status.json`，同时保证 stdout 打印绝对可定位路径。

- [ ] **任务 A.4**：实现本地 preview server（3 点）
  - **输入**：用户方案第 4.3、4.4 节。
  - **输出**：`GET /`、`GET /state`、`POST /save-response`、`POST /mark-copied`。
  - **步骤**：
    1. 用 `ThreadingHTTPServer` 绑定 `127.0.0.1` 和动态端口。
    2. 页面展示 prompt、手动步骤、textarea、Save Response、status panel。
    3. `Open ChatGPT` 按钮只打开 `https://chatgpt.com/`。
    4. `Copy Prompt` 优先用浏览器 `navigator.clipboard.writeText()`。
    5. `/save-response` 写入当前 round 的 `response.md` 并更新 `response_saved: true`。

### 模块 B：三个命令和三个入口 skill（5 点）

**文件**：`plugins/ccg/commands/gptpro-*.md`、`plugins/ccg/skills/ccg-gptpro-*`

- [ ] **任务 B.1**：新增 `/ccg:gptpro-plan`（2 点）
  - **输入**：用户方案第 6.1 节。
  - **输出**：命令文件、skill、agent。
  - **步骤**：
    1. 命令路由到 `ccg:gptpro-plan`。
    2. skill 加载共享 bridge，使用 `--mode plan`。
    3. 文档化第 2 轮只用于 blocker re-check 或 revised plan comparison。

- [ ] **任务 B.2**：新增 `/ccg:gptpro-review`（2 点）
  - **输入**：用户方案第 6.2 节。
  - **输出**：命令文件、skill、agent。
  - **步骤**：
    1. 命令路由到 `ccg:gptpro-review`。
    2. skill 要求收集 plan、diff、touched files、test summary 或用户提供目标。
    3. 响应保存后按 blocking、non-blocking、false positive、Codex actions 分类。

- [ ] **任务 B.3**：新增 `/ccg:gptpro-exc`（1 点）
  - **输入**：用户方案第 6.3 节。
  - **输出**：命令文件、skill、agent。
  - **步骤**：
    1. 命令路由到 `ccg:gptpro-exc`。
    2. skill 使用 `--mode exc`。
    3. 明确第 2 轮应尽量转 `/ccg:gptpro-review --from-exc <session>`。

### 模块 C：索引、doctor、bridge installer、CI（5 点）

**文件**：`plugins/ccg/commands/ccg.md`、`plugins/ccg/skills/ccg/SKILL.md`、`plugins/ccg/scripts/doctor.ps1`、`scripts/install-codex-command-bridge.ps1`、`.github/workflows/ci.yml`

- [ ] **任务 C.1**：更新命令索引和 skill 索引（1 点）
  - **输出**：三个新命令出现在用户可见索引中。

- [ ] **任务 C.2**：更新 doctor 检查（2 点）
  - **输出**：doctor 检查三条 command、四个 skill、bridge script 和 templates。
  - **步骤**：
    1. 加入 `GPT Pro manual bridge: PASS` 风格摘要。
    2. 明确 `ChatGPT web automation: intentionally unsupported`。
    3. 不检查 ChatGPT 登录状态。

- [ ] **任务 C.3**：更新 command bridge installer（1 点）
  - **输出**：`gptpro-plan.md`、`gptpro-review.md`、`gptpro-exc.md` 被复制到本地 command bridge。

- [ ] **任务 C.4**：更新 CI（1 点）
  - **输出**：新增 `python -m py_compile plugins/ccg/skills/ccg-gptpro-bridge/scripts/gptpro_bridge.py`。

### 模块 D：validator 和 fixture tests（8 点）

**文件**：`scripts/validate-plugin.js`、`scripts/run-fixture-tests.js`

- [ ] **任务 D.1**：新增 `validateGptProManualBridge()`（3 点）
  - **输出**：验证新文件、模板和关键短语。
  - **步骤**：
    1. 检查三个 command、四个 skill、bridge script、五个模板。
    2. 检查关键短语：`Do not automate ChatGPT web login`、`Do not read ChatGPT web DOM`、`Do not extract ChatGPT Output programmatically`、`manual bridge`、`Codex remains final owner`、`Expected manual questions: 1`、`Maximum manual questions: 2`、`web_automation`、`dom_extraction`。
    3. 在 `main()` 中调用。

- [ ] **任务 D.2**：新增 bridge script fixture（3 点）
  - **输出**：覆盖创建 artifacts、保存响应、follow-up、拒绝 round > 2。
  - **步骤**：
    1. 使用临时目录运行 `gptpro_bridge.py --mode plan --prompt ... --output-root ... --hold-seconds 0`。
    2. 断言 `prompt.md`、`response.md`、`status.json`。
    3. 用本地 endpoint `POST /save-response` 写入 mock response，断言 `response_saved: true`。
    4. 用 `--followup-session` 验证只创建 `round-2`。
    5. 用 `--round 3` 验证失败。

- [ ] **任务 D.3**：新增 command / skill / index fixture（2 点）
  - **输出**：`fixture:gptpro-*` marker 能被 full parity surface 或 validator 检测到。
  - **步骤**：
    1. 检查 commands exist、skills exist、commands route to skills。
    2. 检查 skills forbid DOM extraction。
    3. 检查 templates exist、question budget documented。
    4. 检查 command index、bridge installer、doctor 诊断包含新命令。

### 模块 E：README 和文档（4 点）

**文件**：`README.md`、`docs/gptpro-manual-bridge.md`、`docs/original-ccg-parity-matrix.md`

- [ ] **任务 E.1**：更新 README（1 点）
  - **输出**：新增 `ChatGPT Pro Manual Bridge` 节。
  - **步骤**：
    1. 列出三个命令。
    2. 写明人工粘贴 prompt 和 response。
    3. 加入 manual question budget 表。
    4. 中文补充“这是人工桥接，不是 ChatGPT 网页自动化工具。”

- [ ] **任务 E.2**：新增完整文档（2 点）
  - **输出**：`docs/gptpro-manual-bridge.md`。
  - **步骤**：
    1. 包含 Purpose、Hard Boundaries、Manual Question Budget、Commands、Session Artifacts、Follow-up Rules、Why web automation is not supported、How Codex uses GPT Pro output、Troubleshooting。
    2. 引用官方 OpenAI Terms 和 Responses API 链接，但避免把法律解释写成绝对保证。

- [ ] **任务 E.3**：更新 parity matrix（1 点）
  - **输出**：记录 GPT Pro manual bridge 是新增 Codex-native assistance path，不是原 Claude parity 的强制替代。

## 5. 关键文件

| 文件 | 动作 | 说明 |
| --- | --- | --- |
| `plugins/ccg/commands/gptpro-plan.md` | 新建 | 规划第二视角命令。 |
| `plugins/ccg/commands/gptpro-review.md` | 新建 | 审阅第二视角命令。 |
| `plugins/ccg/commands/gptpro-exc.md` | 新建 | 执行伴侣命令。 |
| `plugins/ccg/skills/ccg-gptpro-plan/SKILL.md` | 新建 | plan 场景入口 skill。 |
| `plugins/ccg/skills/ccg-gptpro-review/SKILL.md` | 新建 | review 场景入口 skill。 |
| `plugins/ccg/skills/ccg-gptpro-exc/SKILL.md` | 新建 | exc 场景入口 skill。 |
| `plugins/ccg/skills/ccg-gptpro-bridge/SKILL.md` | 新建 | 共享人工桥接 skill。 |
| `plugins/ccg/skills/ccg-gptpro-bridge/scripts/gptpro_bridge.py` | 新建 | 本地 bridge server 和 artifact writer。 |
| `plugins/ccg/skills/ccg-gptpro-bridge/templates/gptpro/*.md` | 新建 | 模式 prompt 模板。 |
| `docs/gptpro-manual-bridge.md` | 新建 | 完整用户和维护者文档。 |
| `plugins/ccg/commands/ccg.md` | 修改 | 命令索引新增三条命令。 |
| `plugins/ccg/skills/ccg/SKILL.md` | 修改 | skill 索引新增三条命令。 |
| `plugins/ccg/scripts/doctor.ps1` | 修改 | 新增 bridge 诊断。 |
| `scripts/install-codex-command-bridge.ps1` | 修改 | 安装三条 command bridge stub。 |
| `scripts/validate-plugin.js` | 修改 | 新增 GPT Pro manual bridge validator。 |
| `scripts/run-fixture-tests.js` | 修改 | 新增 GPT Pro bridge fixture。 |
| `.github/workflows/ci.yml` | 修改 | 新增 bridge helper py_compile。 |
| `README.md` | 修改 | 新增人工桥接说明和使用表。 |
| `docs/original-ccg-parity-matrix.md` | 修改 | 记录新增 assistance path。 |

## 6. 测试策略

- **结构验证**：
  - `node .\scripts\validate-plugin.js --phase-one`
  - `node .\scripts\validate-plugin.js --full-parity-surface`
  - `node .\scripts\validate-plugin.js --full-parity-behavior`
- **Python 语法验证**：
  - `python -m py_compile .\plugins\ccg\skills\ccg-executor\scripts\invoke_gemini_preview.py`
  - `python -m py_compile .\plugins\ccg\skills\ccg-gptpro-bridge\scripts\gptpro_bridge.py`
- **fixture 验证**：
  - `node .\scripts\run-fixture-tests.js`
- **diff 质量验证**：
  - `git diff --check`
- **人工冒烟**：
  - 运行新 bridge 命令或直接运行 `gptpro_bridge.py --mode plan --prompt "..." --open-preview --hold-seconds 0`。
  - 确认本地页面可复制 prompt、可保存 response、`status.json` 更新。
  - 确认不会访问或读取 ChatGPT DOM。

## 7. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 误做 ChatGPT 网页自动化 | 在 skill、docs、validator、status 和代码注释中重复记录禁止 DOM、禁止自动提交、禁止自动提取。 |
| 本地 server 端口冲突 | 使用 `127.0.0.1` 动态端口，stdout 打印实际 URL。 |
| 剪贴板跨平台失败 | 页面提供 `Copy Prompt`，失败时用户仍可手动选中 prompt。 |
| 用户长时间不保存 response | 默认不永久阻塞；`--wait-response` 才等待，`--hold-seconds` 控制生命周期。 |
| GPT Pro 输出被当成权威 | skill 和文档要求 Codex 独立验证，并在中文汇报中分类 GPT Pro findings。 |
| fixture 依赖真实浏览器或 ChatGPT | fixture 只测本地 artifacts 和 HTTP endpoint，不调用外部服务。 |
| 新命令漏同步到缓存检查 | doctor 和 validator 同时覆盖 source、cache key、cached skill、bridge installer。 |

## 8. Codex 原生交接

审阅后手动运行：

```text
/ccg:execute .codex/ccg/plans/add-gpt-pro-manual-bridge.md
```

Gemini 模型：`gemini-3.1-pro-preview`
Gemini 预览 URL：`http://127.0.0.1:56576/`
Gemini 浏览器已打开：是
Gemini 响应文件：`C:\Users\29933\.codex\ccg\logs\gemini-preview-20260515-105712.response.txt`
