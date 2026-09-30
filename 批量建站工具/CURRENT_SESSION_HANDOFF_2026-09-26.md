# 当前会话交接（2026-09-26）

## 接手入口

- 唯一长期工作目录：`D:\Min\建站工具`。
- 应用、预览和命令执行目录：`D:\Min\建站工具\批量建站工具`。
- 当前分支：`main`。
- 当前 HEAD：`9081bf37652a80fe9e81447a5026acb87fe9b0ef`（`docs: add changelog entry for v1.0.5`）。
- 项目版本：`1.0.5`。
- 本地预览：`http://127.0.0.1:5173/index.html`；游戏工作台：`http://127.0.0.1:5173/game-builder/index.html`。
- 交接时 5173 端口由 PID `19840` 监听，命令行指向 `D:\Min\建站工具\批量建站工具\node_modules\vite\bin\vite.js`。
- 每次修改、测试、启动预览或提交前，先在应用目录执行 `git rev-parse --show-toplevel`，结果必须是 `D:/Min/建站工具`。不要使用 `C:\Users\zyt\.codex\worktrees\...` 临时工作树。
- 当前工作树包含多项用户已确认、尚未提交的工作。不得重置、清理、覆盖或丢弃未知改动。

## 当前最新状态

用户最新确认基于 `D:\Min\数据源` 新增 4 个模板领域，该修改已完成：

- 普通建站领域从 32 个增加到 36 个，每个领域 30 套模板，总数从 960 增至 1,080。
- 新领域：自然史与生物多样性、海洋与水域科学、地球与大气科学、文化遗产与传统工艺。
- 数据源依据：`D:\Min\数据源\资讯\未用数据源` 有 73 个主题目录、93 个文章 JSON，合计 4,487 篇文章记录和 4,487 张配图；91 个 JSON 满足每包至少 40 篇和 40 张图的门槛。真菌学与菌丝材料（36/36）和钟表学与制表工艺（34/34）未作为新增领域依据。
- 领域定义、品牌、图标、配色、识别词和模板元数据已接入；数量断言更新为 36 个领域和 1,080 套。
- 对应说明：`docs/template-expansion-2026-09-26.md`。本次未运行测试。

### 前一项完成：导航标题间距

修复部分模板中导航菜单过于靠近站点标题的问题。该修改已完成：

- 新增 `js/navbar-layout.js`，普通建站和独立游戏共用。
- 标题会参与真实宽度分配，修复居中导航绝对定位导致的重叠风险。
- 标题与菜单保留 24–48px 间距；空间不足时先压缩菜单空白，仍放不下时折叠为菜单按钮。
- 按实际字体宽度计算，窗口、预览容器宽度及字体加载变化时会重新测量。
- 折叠菜单保留原有点击、分类跳转与 Escape 关闭行为，并支持长标题换行和纵向滚动。
- 预览与导出页面均已接入；HTML 资源查询参数已更新为 `20260926-nav-fit-1`。
- 广告解析、广告 ID、广告脚本和广告位置代码没有因该修复改变。

对应说明：`docs/navbar-spacing-2026-09-26.md`。

### 导航修复验证

- `node --check js/navbar-layout.js`、两套 `generator.js` 语法检查通过。
- `git diff --check` 通过；输出只有现有 LF/CRLF 提示。
- `npm run build` 通过，日志：`coverage/navbar-build.log`。只有已知的大包体积提示。
- 已查看普通等宽字体、普通无衬线字体、居中导航、游戏导航在 1440、1100、960、860、390px 下的导出截图，以及 960px 实时预览和展开菜单。
- 浏览器记录没有 JavaScript 异常或横向溢出；截图和测量结果：`coverage/navbar-review/`。
- **导航修复后未重新运行 `npm test` 或模板全量浏览器矩阵。**

## 本轮较早完成：模板扩充

- 模板扩充第一阶段：普通建站的 32 个领域（含通用领域）各由 12 套扩充至 30 套，共 960 套，新增 576 套。
- 后续基于数据源再新增 4 个领域，各 30 套；当前普通建站共 36 个领域、1,080 套模板。
- 独立游戏由 4 套扩充至 30 套，新增 26 套。
- 普通建站、广告移植和批量建站加广告共享领域模板；差异化建站与批量广告策略未扩充。
- 新增 `js/template-catalog.js` 和 `js/template-layouts.js`，将模板元数据、领域配置与内容布局解耦。
- 样式面板新增“显示分类标题图标”全局开关；默认开启，关闭后只隐藏显示，已选图标仍保留。切换模板或随机组装不会重置该偏好。
- 所有新增模板固定附加的 Hero 介绍区和分类快捷入口后来按用户要求移除；现在导航栏下面直接进入第一个分类内容，普通与游戏预览、导出同步生效。
- 模板说明和完整验证细节：`docs/template-expansion-2026-09-26.md`。

### 模板扩充测试时间线

- 在模板扩充完成后曾运行完整测试：16 个测试文件、244 项测试全部通过；差异化工作流副本检查及完整游戏 smoke 通过。
- 602 个新增模板逐一实际导出并比较 ad.js；覆盖无广告、固定位置、手动位置、旧站迁移、四个内置 ad.js 版本及自定义模板渲染。
- 曾完成 447 个浏览器页面场景检查和普通、游戏工作台完整点击流程。
- 日志：`coverage/template-full-test.log`；浏览器结果：`coverage/template-layout-review/`、`coverage/template-layout-review-narrow/`。
- 随后进行的“移除新增模板 Hero/快捷入口”和“导航标题间距”两次修改，只做了针对性的语法、构建与浏览器视觉检查，因此上述 244/447 结果不能视为最新两次修改后的全量回归结论。

## 本轮更早完成：广告模板与导出

以下均为当前未提交工作的一部分，必须保留：

- 支持从工具上传新的 ad.js 模板版本；上传后保存到项目目录、添加为新版本选项并设为默认，重新启动工具后仍存在。
- 新版本模板应用到所有支持 ad.js 的工作流；导出会按新模板替换识别出的广告 ID，同时保留模板其余源码。
- 核心文件：`js/ad-template-catalog.js`、`server/ad-template-store.js`、`public/ad-templates/manifest.json`、`vite.config.js`，并接入两套应用/生成器。
- 按广告代码识别出的子域名命名 ZIP；ZIP 内仍保留一层目录，有广告代码时目录名为子域名，无广告代码时为 `website`。
- 核心文件：`js/archive-naming.js`，并接入普通、游戏、广告移植、成品加广告和批量导出路径。
- 增加导出前完整性检查 `js/export-preflight.js`，并覆盖相关工作流。
- 之前还修复了配置面板下拉框高度和内容溢出，以及所有工作流的自定义下拉菜单显示与浮层裁切问题。

## 广告核心兼容情况

- `js/ad.js` 与 `game-builder/js/ad.js` 在模板扩充中未修改。
- 广告 ID 解析、内置/自定义 ad.js 模板选择、固定位置、手动位置和旧站迁移仍使用原有广告模块。
- 回归过程中修复了普通建站手动卡片间广告未在 GPT 初始化前出现的问题；游戏预览也会显示已保存的卡片间广告。
- 真实 Google 广告填充、账号投放状态和收益无法由本地替身测试证明；本地验证覆盖的是代码、容器、ID、脚本调用和导出结果。

## 当前工作树

接手后必须重新执行 `git status --short`；交接时主要状态如下：

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
?? server/
?? tests/archive-naming.test.js
?? tests/export-preflight.test.js
?? tests/template-controls.browser.mjs
?? tests/template-expansion.test.js
?? tests/template-fixtures.mjs
?? tests/template-layouts.browser.mjs
```

## 重要文件索引

- `js/template-catalog.js`：30 套模板目录、领域/游戏配置。
- `js/template-layouts.js`：新增模板的首页内容容器、分类标题、卡片和详情页排版。
- `js/navbar-layout.js`：标题/菜单间距、宽度测量与自适应折叠。
- `js/ad-template-catalog.js`：上传 ad.js 模板目录、加载与渲染。
- `server/ad-template-store.js`：本地项目内 ad.js 模板持久化接口。
- `js/archive-naming.js`：ZIP 名称和内层目录名称。
- `js/export-preflight.js`：导出前完整性检查。
- `tests/template-expansion.test.js`：模板与广告矩阵回归。
- `tests/template-layouts.browser.mjs`：导出页面浏览器检查。
- `tests/template-controls.browser.mjs`：普通/游戏工作台点击与下载检查。

## 新会话接手规则

1. 先阅读本文以及 `D:\Min\建站工具\AGENTS.md`，再检查 Git 根目录、分支、工作树和 5173 监听进程。
2. 不要清理或还原任何现有改动，也不要把 Codex 临时 worktree 当作用户正在使用的项目。
3. 用户将在新会话继续提出后续任务；在没有新指令前，只确认已经接管上下文，不主动提交、推送、重跑耗时全量测试或改动产品代码。
4. 新需求仍遵守项目 `AGENTS.md`：一次只问一个问题，理解达到足够把握后给出方案，用户确认后再实施。已经在本会话明确授权和完成的工作无需重新询问。
5. 如果下一项任务涉及上述最新导航或首页布局，先以当前工作区为基线，不要根据旧交接文档覆盖新改动。
