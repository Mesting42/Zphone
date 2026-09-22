# 成品站加广告工作流交接（2026-09-21）

## 1. 必须使用的工作树

- 唯一正确、最新工作树：`C:\Users\zyt\.codex\worktrees\1a60\建站工具\批量建站工具`
- 当前提交：`71d48f6`（该工作树目前为 detached HEAD，且包含大量未提交修改；不要切换、重置、清理或覆盖这些改动）
- 不要在会话默认目录 `C:\Users\zyt\.codex\worktrees\8e06\建站工具\批量建站工具` 中实现。
- 每次终端调用都应显式把 `workdir` 指向上述 `1a60` 目录。

## 2. 用户目标与边界

用户要完善现有“成品站加广告”工作流，必须在现有流程/界面上扩展，不得另做孤立页面，也不得破坏普通建站、批量建站加广告、广告移植或批量广告策略等现有核心广告功能。

既有目标流程：

1. 上传已经过审的网站源码压缩包。
2. 支持 ZIP、RAR、7Z、TAR.GZ、TGZ，沿用现有浏览器本地解压能力。
3. 自动定位真实站点根目录，识别纯静态 HTML、React/Vite、React + TanStack Router/Start、其他可安全识别 React 源码，以及 React 已构建静态产物。
4. 进入现有“配置网站”界面，在原站实时预览旁上传/粘贴广告代码、确认六个广告字段、手动放置广告位。
5. 自动加入 banner1/2/3、INT、ANC、GA，并在导出前严格校验。
6. 导出新副本，不覆盖上传的原压缩包。

## 3. 本会话已经完成的内容

### 3.1 压缩包读取与流程导航

- 修复真实 RAR5 压缩包长期卡在“读取中”或显示未知错误的问题。
- 修复识别完成后点击“进入配置网站”无响应的问题（原因为 `pasteButton is not defined`）。
- 成品站工作流步骤为：上传过审网站 → 配置网站 → 导出新副本。
- 真实测试包可识别为 `React + TanStack Start 源码工程`，共保留 254 个文件。

### 3.2 成品站原样预览

- 修复 `srcdoc` 沙箱 iframe 无法加载父页面创建的 `blob:` CSS/图片资源的问题。
- 预览资源现在转成 Data URL；CSS 内 `url(...)`、`<style>`、行内 style、src、href、poster、srcset 都会重写。
- 上传站点自身脚本会在预览中移除，只允许本工具自己的广告位选择辅助脚本；预览 iframe 使用 `sandbox="allow-scripts"`，不加 `allow-same-origin`。
- 修复后真实站点恢复深色主题、Inter 字体和原结构，控制台不再有 `Not allowed to load local resource: blob:...`。

### 3.3 手动广告位放置

- 成品站手动放置交互已改为与普通建站一致的模式：
  - 左侧广告1/2/3卡片；
  - “选择位置/重新放置”“移除”；
  - 右侧实时预览出现有名称的常用广告位；
  - 点击预览广告位后写回当前页面策略并自动退出放置模式；
  - 首页与详情页分别配置。
- 成品站专用状态为 `appState.adInjectionPlacementMode`，消息类型为 `ad-injection-place`，并核验 `event.source === previewFrame.contentWindow`，避免影响其他工作流。
- 已用真实页面验证广告1从“首页：导航栏后”改为“首页：内容顶部”，标记消失且控制台 0 错误。

### 3.4 React 广告源码支持

- 新增 `js/react-source-ad-injector.js`，通过 AST 创建/复用 `Advertisement` 组件，处理 React 源码插入与 SPA 路由重新扫描。
- 内置广告运行时来自项目资源，不依赖外部绝对路径。
- 原始参考脚本仍可读取：`C:\Users\zyt\Desktop\张\广告脚本集\ad.js`，但成品运行不得依赖该路径。

## 4. 本会话最后一次验证结果

真实压缩包：

`C:\Users\zyt\Desktop\project-zlm\资讯站\8月站\资讯站\无线电工具站.rar`

验证结果：

- 识别成功：1 个成品站、254 个文件。
- 成功进入配置网站。
- 预览计算样式：原站深色背景、`Inter` 字体。
- 预览 HTML 中 `blob:` 引用数量为 0。
- 浏览器控制台 error 数量为 0。
- 手动广告位点击与策略回写成功。

自动测试：

- `npm test -- --run`：9 个测试文件、129 项测试全部通过；差异化副本校验和生成器 smoke test 通过。
- `npm run build`：成功。只有既有的非 module script 提示和约 1 MB 主 chunk 体积警告，不是构建失败。
- `git diff --check`：通过（仅有 Git 的 LF/CRLF 提示）。

## 5. 新会话必须完成的新增任务（用户明确要求）

当前会话到此不再修改功能代码。以下任务必须由新会话实现。

### 5.1 React 导出只包含构建后的部署产物

当上传的是 React 源码工程，且广告代码已经识别、广告组件/位置已经成功加入后：

- 导出时只导出完成构建后的 `dist` 部署目录内容，不再额外导出完整 React 源码。
- ZIP 根目录建议直接是可部署文件（即原 `dist` 内文件），或用清楚的站点目录包裹；不要让用户再执行一次 `npm install` / `npm run build`。
- 必须先确认当前浏览器端工具是否真的具备执行 React 构建的能力；不能仅把改过的源码目录改名为 `dist`。
- 对 Vite/TanStack Start/其他 React 项目，需要依据 package.json、构建脚本、框架输出目录（如 `dist`、`build`、`.output/public` 等）确定真正的静态部署产物。
- 如果无法在当前工具环境安全完成构建，应明确阻止“已构建 dist”导出并给出原因，不能输出看似完成但实际未编译的源码。
- 如果上传包已经有旧 `dist/build`，必须确保它与最新广告源码一致；不得直接导出未包含本次广告修改的旧构建产物。
- 纯静态 HTML/CSS/JS 网站仍然导出完整站点源码，不执行 React 构建逻辑。

### 5.2 导出前强制核验

在允许导出之前必须执行一次可见、可报告、可阻断的校验，至少确认：

- banner1/2/3 的广告路径与配置输入一致；
- INT、ANC、GA 均按用户确认结果写入；
- GPT 和 `/js/ad.js` 只加载一次；
- React `Advertisement` 组件存在且引用位置符合首页/列表/详情策略；
- `adv1/2/3` 与 `div-gpt-ad-banner1/2/3` 一一对应，没有重复 DOM ID；
- SPA 重新扫描入口存在，且不会重复定义 INT/ANC；
- 预览/策略中的位置与最终构建产物中的位置一致；
- 构建产物真实包含广告运行时和广告容器；
- 缺失字段、冲突、重复广告、构建失败或位置不一致时阻止导出，并在报告里指出文件、页面和原因。

校验通过后才可以生成下载包。导出报告应列出框架、实际构建命令/输出目录、检查过的页面、修改文件、广告位置、广告路径、警告和最终 ZIP 内容范围。

### 5.3 成品站广告占位模板与普通建站一致

用户截图说明：

- 普通建站工作流在上传并识别广告代码后，预览广告位只显示普通建站使用的 `advertisement1`（以及 advertisement2/3）占位模板。
- 当前成品站预览多显示了一个白色卡片 `Banner 1 · 300 × 250`，这与普通建站不一致。

要求：

- 复用普通建站已有的广告容器/占位模板和样式，不要在成品站建立另一套视觉模板。
- `adv1 / div-gpt-ad-banner1 / advertisement1`、`adv2 / ...banner2 / advertisement2`、`adv3 / ...banner3 / advertisement3` 的 DOM 对应关系保持不变。
- 预览阶段应与普通建站一样只呈现 advertisement 占位效果；真实广告仍在导出部署后由 GPT 加载。
- 修改后同时检查桌面、平板、手机预览，保证占位区域居中且不会覆盖原站内容/侧栏。

用户提供的对比截图：

- 普通建站占位：`C:\Users\zyt\AppData\Local\Temp\codex-clipboard-2fcece5e-a9bb-4cf2-98e0-055c5ae5954a.png`
- 当前成品站占位：`C:\Users\zyt\AppData\Local\Temp\codex-clipboard-a7a65dab-fe5f-4220-a4df-bbb8af18447b.png`

## 6. 实现前优先检查的代码

- `index.html`：成品站配置区、广告字段、导出步骤和资源缓存版本。
- `js/app.js`：成品站读取、预览、手动位置、导出入口与报告。
- `js/ad-restoration.js`：静态站广告注入/恢复与打包。
- `js/react-source-ad-injector.js`：React AST 注入、组件和 SPA 刷新。
- `js/ad-migration.js`：GAM/GA 解析与校验。
- `js/ad.js`：内置广告运行时模板。
- `js/batch-ad-builder.js`、`js/generator.js`：既有广告核心，必须避免回归。
- `css/tool.css`：成品站配置与广告位选择样式。
- `tests/batch-ad-ui-static.test.js`、`tests/react-source-ad-injector.test.js`、`tests/ad-restoration.test.js`、`tests/ad-migration.test.js`、`tests/batch-ad-builder.test.js`。

本轮关键实现大致位于：

- `js/app.js`：`adInjectionPreviewDataUrl`、`rewriteAdInjectionPreviewCss`、`addAdInjectionPlacementMarkers`、`renderAdInjectionPlacementControls`、`ad-injection-place` 消息监听。
- `index.html`：成品站广告配置说明和缓存版本。
- `tests/batch-ad-ui-static.test.js`：Data URL 预览、沙箱、手动位置回归断言。

## 7. 测试要求

新增任务完成后至少执行：

1. 针对 React 构建输出/导出范围的新测试：ZIP 中只有最终部署产物，没有 `src`、`node_modules`、原 package 源码等。
2. 纯静态站仍导出完整站点测试。
3. 导出前校验成功、广告位置错误、广告路径错误、重复 ID、旧 dist、构建失败等正反向测试。
4. 普通建站与成品站广告占位结构/文案一致性测试。
5. React Vite、TanStack Router/Start、已构建 React dist、纯静态站夹具。
6. 完整运行 `npm test -- --run`、`npm run build`、`git diff --check`。
7. 使用上述真实 `无线电工具站.rar` 做浏览器端到端验证：上传 → 识别 → 配置 → 上传广告代码 → 放置广告位 → 导出前核验 → 下载 ZIP → 检查 ZIP 内容与部署入口。

## 8. 工作区安全提醒

- 工作树已有用户及前序任务的大量未提交修改，必须保留；不要使用 `git reset --hard`、`git checkout --` 或清理未跟踪文件。
- 修改前先阅读当前实现和现有测试，不要重新搭建一套平行的广告系统。
- 当前工作流以浏览器本地处理为主，React 构建能力是新增任务的核心技术风险；实现必须是真构建、真校验、真部署产物，不能只调整 UI 文案。
