# 当前会话交接（2026-09-27）

## 接手入口

- 唯一长期工作目录：`D:\Min\建站工具`。
- 应用、预览和命令执行目录：`D:\Min\建站工具\批量建站工具`。
- 当前分支：`main`。
- 当前 HEAD：`9081bf37652a80fe9e81447a5026acb87fe9b0ef`（`docs: add changelog entry for v1.0.5`）。
- 项目版本：`1.0.5`。
- 交接时没有发现项目常用端口 `3000`、`4173`、`5173`、`5500`、`8000`、`8080`、`8088` 正在监听，当前没有已确认的项目预览服务。
- 如需启动预览，必须从 `D:\Min\建站工具\批量建站工具` 启动，并核对监听进程命令行和工作目录。
- 每次修改、测试、启动预览或提交前，先在应用目录执行 `git rev-parse --show-toplevel`；结果必须是 `D:/Min/建站工具`。
- 不要使用 `C:\Users\zyt\.codex\worktrees\...` 下的临时工作树。
- 当前工作树包含大量用户已经确认、尚未提交的工作。不得重置、清理、覆盖、还原或丢弃未知改动。

## 新会话的直接任务

立即继续排查并修复“批量新建站 + 独占广告代码”工作流中 RAR 压缩包一直停在“正在打开 RAR 压缩包”的问题。

用户已经确认以下修复方案，新会话无需再次询问是否实施：

1. 给 `Archive.open(file)` 和后续解压操作增加受控超时及明确错误信息，避免界面永久等待。
2. RAR 主解析器失败或超时后，自动使用项目已有的 `node-unrar-js` 回退解析器，覆盖 RAR5、固实压缩等主解析器不兼容的情况。
3. 保持 ZIP、7Z 和其他工作流的现有行为不受影响。
4. 用问题文件复现，并覆盖正常 RAR、异常 RAR、回退解析、批量多文件进度和错误恢复。
5. 修复后从规定应用目录启动预览，完成界面复测。

编码时遵守项目 `AGENTS.md`：写好必要注释，尽可能解耦设计，便于后续接手。用户已对上述具体方案明确回复“确认”，可直接实施；若发现会改变产品行为的新范围，再一次只问一个问题。

## 用户看到的故障

- 工作流：`批量建站加广告`，界面标题为“批量新建站 + 独占广告代码”。
- 用户一次选择了 2 份数据源。
- 第一份显示：`04-FDA监管与药物警戒数据.rar · 正在打开 RAR 压缩包`。
- 总进度约停在 10% 至 11%，长时间不再变化。
- 截图路径：`C:\Users\zyt\AppData\Local\Temp\codex-clipboard-430301c0-fb58-47a7-a4f7-bd6e9af36c1c.png`。临时文件可能失效，故障文字和位置以上述记录为准。

## 已完成的只读诊断

### 卡点已定位

`js/app.js` 中的 `readBatchDataSource(file, index, onProgress)` 处理 `.rar`/`.7z` 时依次执行：

1. 加载本地 libarchive 运行时。
2. 报告子进度 `0.22`，状态为“正在打开 RAR 压缩包”。
3. 执行 `await Archive.open(file)`。
4. 成功后才报告子进度 `0.42`，状态为“正在解压文件目录”。

截图停在第 2、3 步之间，所以直接等待点是 `js/app.js` 约第 3176 行的 `await Archive.open(file)`。

批处理总进度按 `(index + progress) / list.length` 计算。第一份文件的子进度约 22%，共有两份文件，因此界面总进度约 11%，与截图一致。

### 无限等待的代码原因

- 当前批量导入路径直接等待 `Archive.open(file)`，没有超时、Worker 错误兜底或 RAR 专用回退。
- 本地 `js/vendor/libarchive/libarchive.js` 中 `Archive.open()` 返回的 Promise 只在 Worker 回调成功时 resolve；虽然 Promise 构造函数接收 reject，但实现没有完整使用失败通路，也没有超时。
- 如果 Worker 对特定 RAR 格式不回调，上层 Promise 会永久 pending，批处理 `catch` 也不会执行，因此界面一直停在“正在打开”。

### 项目已有可复用实现

- `js/rar-import.js` 已暴露 `global.loadRarFallbackRuntime()`，使用项目已有的 `node-unrar-js` WASM，注释说明用于 RAR5/solid RAR 回退。
- `js/ad-restoration.js` 约第 1136 行已有 `waitForArchiveOperation(operation, timeoutMs, timeoutMessage)`。
- 同文件约第 1163 行开始已有 `readRarWithOfficialFallback(file, onStage)`，会加载 RAR 回退运行时、读取文件列表并按需解压。
- 同文件约第 1224 行对 libarchive 的打开和解压设置了 90 秒超时，并在 RAR 主路径失败后调用回退解析器。
- 批量数据源导入目前没有复用这套成熟逻辑，建议抽取共享归档读取层或以最小风险复用等价逻辑，避免两处继续分叉。

### 本地归档运行时状态

以下本地文件存在，故不是单纯缺少静态资源：

- `js/vendor/libarchive/libarchive.js`
- `js/vendor/libarchive/worker-bundle.js`
- `js/vendor/libarchive/libarchive.wasm`

批量导入的 `ensureArchiveRuntime()` 使用这些本地资源，不是游戏建站流程中曾出现过的 CDN Worker。因此不要把本问题直接归因于此前游戏建站的跨域 Worker 故障。

### 尚未确认的外部条件

- 只读搜索没有在 `D:\Min\数据源` 中找到文件名完全匹配的 `04-FDA监管与药物警戒数据.rar`；用户可能从其他目录选取文件。
- 尚未确认该 RAR 是否加密、分卷、损坏，或是否能被本机压缩软件正常打开。
- 即使无法获得原始问题文件，也应先修复“无限等待”缺陷，并使用仓库现有或临时测试夹具验证超时、错误呈现与回退路径；需要精确兼容该文件时再向用户询问它的实际路径，一次只问一个问题。

## 建议实施结构

1. 先检查 `D:\Min\建站工具\AGENTS.md` 和本文，并重新执行 Git 根目录、分支、状态、监听进程检查。
2. 阅读 `js/app.js` 的批量数据源解析调用链、`js/rar-import.js` 的回退运行时，以及 `js/ad-restoration.js` 的超时和 RAR 回退实现。
3. 优先抽取或增加小型共享函数，明确区分：运行时加载、归档打开、目录读取、候选文件选择、内容解码、超时与错误包装。
4. RAR 流程建议为：libarchive 主路径 → 超时或异常 → `node-unrar-js` 回退 → 两者都失败时显示包含文件名和原因的可操作错误。
5. 超时后应终止或释放相应 Worker/归档实例（在当前库 API 支持的范围内），避免后台任务和资源泄漏。
6. 进度文案应体现主解析、回退解析及最终失败状态；不能在回退过程中倒退或永久停留。
7. ZIP、7Z 继续使用 libarchive；可以共享超时保护，但不要错误地进入 RAR 专用回退。
8. 不要改动与本故障无关的广告模板、模板领域、导航布局和导出命名逻辑。

## 验证要求

用户明确要求修复后复测。至少覆盖：

- 普通 RAR 可以完成打开、读取 JSON 和图片、进入下一步。
- 触发 libarchive 不兼容或模拟超时时，自动进入 RAR 回退并成功完成。
- 损坏、加密或无法解析的 RAR 在有限时间内结束，显示明确错误，界面可重新选择文件。
- 两个及以上数据源的批量流程不会因第一份失败或回退而永久卡住，进度计算正确。
- ZIP 与 7Z 正常解析，未受 RAR 分支影响。
- 现有广告代码分配、导出前检查和 ZIP 导出行为不回归。
- 若运行自动测试，保留结果日志；若启动浏览器复测，记录预览端口、启动目录和关键界面结果。

## 当前工作树

接手后必须重新执行 `git status --short`。交接时状态如下，全部视为需要保留的现有工作：

```text
 M css/tool.css
 M game-builder/css/tool.css
 M game-builder/index.html
 M game-builder/js/ad-migration.js
 M game-builder/js/app.js
 M game-builder/js/data.js
 M game-builder/js/game-archive-runtime.js
 M game-builder/js/generator.js
 M index.html
 M js/ad-migration.js
 M js/ad-restoration.js
 M js/app.js
 M js/batch-ad-builder.js
 M js/data.js
 M js/finished-site-ads.js
 M js/generator.js
 M scripts/evaluate-domain-corpus.mjs
 M tests/ad-migration.test.js
 M tests/ad-restoration.test.js
 M tests/batch-ad-builder.test.js
 M tests/domain.test.js
 M tests/game-builder.smoke.cjs
 M tests/jelly-button.test.js
 M tests/ui-layering.test.js
 M vite.config.js
?? .firecrawl/template-expansion-references.json
?? CURRENT_SESSION_HANDOFF_2026-09-25.md
?? CURRENT_SESSION_HANDOFF_2026-09-26.md
?? docs/navbar-spacing-2026-09-26.md
?? docs/template-expansion-2026-09-26.md
?? js/ad-template-catalog.js
?? js/archive-naming.js
?? js/export-preflight.js
?? js/navbar-layout.js
?? js/template-catalog.js
?? js/template-layouts.js
?? public/
?? scripts/audit-domain-source-imports.mjs
?? server/
?? tests/ad-migration-flow.browser.mjs
?? tests/archive-naming.test.js
?? tests/differentiated-flow.browser.mjs
?? tests/export-preflight.test.js
?? tests/game-source-imports.browser.mjs
?? tests/template-ad-containment-audit.browser.mjs
?? tests/template-breakpoints.full.browser.mjs
?? tests/template-controls.browser.mjs
?? tests/template-expansion.test.js
?? tests/template-fixtures.mjs
?? tests/template-layouts.browser.mjs
?? tests/template-layouts.full.browser.mjs
?? tests/template-selectors.full.browser.mjs
```

本文创建后，`CURRENT_SESSION_HANDOFF_2026-09-27.md` 也会成为一个未跟踪文件。

## 相关历史背景

- 普通建站已有 36 个领域、每领域 30 套模板，共 1,080 套。
- 当前未提交工作还包含广告模板上传、按广告域名命名 ZIP、导出前完整性检查、导航间距、自定义下拉框和多项全量浏览器测试资产。
- 详细历史见 `CURRENT_SESSION_HANDOFF_2026-09-26.md`，但其中预览 PID、端口状态和测试时点可能已过时，应以本文和现场检查为准。
- 用户此前要求最全面的功能测试；差异化问题可以稍后处理，其他问题应修复并复测。当前首要任务已经明确切换为 RAR 卡死修复。

## 新会话行为要求

- 新会话使用 `gpt-6-luna`，推理强度 `max`。
- 打开本文后立即开展诊断和实现，不要只复述交接内容。
- 保持用户现有改动，不进行 reset、clean、checkout 覆盖或批量格式化。
- 需要修改文件时，先读取当前内容和相关 diff，避免覆盖同文件中的既有工作。
- 完成后向用户说明：根因、修改内容、测试证据、仍有限制以及预览端口和启动目录。
