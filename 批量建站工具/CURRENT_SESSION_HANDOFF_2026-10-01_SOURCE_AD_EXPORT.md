# 成品站加广告：静态副本 / 完整源码导出 — 2026-10-01

## 工作位置与预览

- 唯一工作目录：`D:\掌峰\Zphone`。用户明确指定该目录，根目录 AGENTS.md 已同步；不要转到旧的 `D:\Min\建站工具` 副本。
- 应用目录、预览及测试启动目录：`D:\掌峰\Zphone\批量建站工具`。
- 当前分支：`main`。本次修复和新功能按用户要求作为 `1.0.6.1` 发布；以 `git log` 和远程引用核对提交及推送状态，不要丢弃工作区改动。
- 建站工具预览：`http://127.0.0.1:5173/`，端口 `5173`，PID `3284`。2026-10-01 核验命令行中的 Vite 入口和目标目录均属于上述应用目录；HTTP 200，包含新的导出选项和缓存版本 `20261001-ad-source-export-1`。
- 用户此前导出的静态站预览：`http://127.0.0.1:4173/`，端口 `4173`，PID `26672`，exec 会话 `55278`。从上述应用目录启动 Python HTTP server，`--directory` 指向 `C:\Users\Mest\Downloads\成品站广告注入-20260930-232001-363\aestro.page`。首页与 `/js/ad.js` HTTP 200。保持运行。
- 之前的导出问题、原站引用提示和历史产物详见 `CURRENT_SESSION_HANDOFF_2026-09-30_FINISHED_SITE_AD_EXPORT.md`。本文件是后续功能交接，以这里的验证结果为准。

## 用户需求与当前行为

用户上传完整网站源码压缩包、配置广告后，可在第三步“导出内容”选择：

1. **静态站点副本**：默认选项，仅导出可直接部署的页面、脚本和资源；该游戏站的 `ad.js` 位于导出站点的 `js/ad.js`。
2. **含广告的完整源码**：保留原工程文件，叠加注入广告后的构建产物。该游戏站的 `ad.js` 位于 `dist/js/ad.js`；`src`、`scripts`、许可证、二进制资源和原备份等均保留。

“下载 ZIP”和“写入新目录”使用同一选择。源压缩包和 Downloads 中的原源码没有修改。

对于具备 `package.json`、`scripts.build` 和独立输出目录的静态源码工程，完整源码导出会加入 `.sitefoundry-ads/`，把 `node .sitefoundry-ads/inject.cjs` 接入 `scripts.postbuild`。已有 postbuild 保留在前面；重复导入导出不会重复添加相同钩子。原构建重新生成输出后，钩子使用保存的广告版本、路径和位置策略重新注入并核验。辅助脚本已内置所需代码，导出的原工程无需新增 npm 依赖。

直接编写 HTML 的静态工程直接修改页面并加入脚本。React 完整源码沿用现有 JSX/TSX 注入器和 `public/js/ad.js`，须在原项目环境完成生产构建；静态导出使用上传包已有的有效构建产物。React 没有构建产物时禁用静态选项并选择源码。构建产物和源码位于同一根目录的 Node 工程，无法安全接入输出钩子，明确阻止源码导出并给出处理说明。

## 主要文件

- `index.html`、`css/tool.css`、`js/app.js`：导出选择、状态提示、批次处理、React 可用性和按需加载。
- `js/finished-source-export.js`：完整文件保留、产物叠加、构建钩子和使用说明。
- `js/source-export-runner.cjs`：导出的可独立运行注入器，复用共享广告逻辑，整批核验后写入，只写变化的文件，拒绝越界路径和输出目录符号链接。
- `js/source-export-dom.cjs`、`js/source-export-dom.LICENSE.txt`：内置 DOM 实现和依赖许可证。由 `npm run build:source-runtime` 生成。
- `scripts/build-source-export-runtime.mjs`、`package.json`、`package-lock.json`：固定开发依赖 `linkedom@0.18.12`、`esbuild@0.25.12`，可重建内置运行代码。
- `js/ad-restoration.js`：源码与产物根目录识别、无 dist 的静态源码预览、目录及压缩包完整源码保留、React 静态产物提取、源码导出回调和实际脚本路径报告。
- `js/export-preflight.js`：检查部署内容，同时确认完整源码没有漏文件和不安全路径；React 源码显式启用 public 资源根映射，静态导出不启用。
- `js/finished-site-ads.js`：保留前一阶段修复，共享内容页范围，资源 HTML 不作为宿主广告页面。
- `tests/finished-source-export.test.js`：真实构建后广告保留、原 postbuild、目录写入、包内源码完整性、重复导入、React 和失败路径等。

## 最终验证

- `npm test`：23 个测试文件、319 项测试全部通过；差异化脚本副本校验和游戏生成器 smoke test 通过。
- `npm run build`：通过。Vite 仍有原有经典 script 和大包提示。源码导出模块仅在选择源码导出时加载。
- `git diff --check`：通过。
- 浏览器使用本机 Edge / Playwright，外部请求被拦截，未验证真实广告填充，也没有将源码或广告代码发到外部服务。
- 桌面与手机导出选项截图已检查；新增控件没有溢出。设计检测在新控件范围内没有发现问题；没有扩大到无关页面改造。
- 来源：`C:\Users\Mest\Downloads\新建文件夹\02-Pocket Parlor口袋游戏厅（已递审）-aestro.page`，广告 TXT：`C:\Users\Mest\Downloads\aestro.page.txt`。
- 实际原源码共 **3,655** 个文件；静态导出 **1,510** 个站点文件；手动与固定两种完整源码导出各 **3,665** 个站点文件。原文件路径全部保留，其中 **3,565** 个逐字节一致；预期变更为 89 个内容 HTML 和 package.json。增加广告运行脚本、配置、构建辅助代码及说明。
- 手动与固定两个源码 ZIP 均解压到 coverage 下独立测试目录，并执行原 `npm run build`；各重新核验 **89** 个页面，`dist/js/ad.js` 和广告容器均保留。资源与原源码输入不变，浏览器无未捕获错误。
- 另用无 dist 的静态生成器源码、无 dist 的 React 源码完成浏览器上传和源码下载；React 静态选项禁用正确，public/js/ad.js 引用预检通过。React 测试样本没有执行实际生产构建，源码注入由已有相关测试覆盖。

## 验证产物及重跑

- 真实源码验证脚本：`coverage\finished-site-export\verify-source-export.mjs`。
- 无 dist 样本浏览器验证脚本：`coverage\finished-site-export\verify-source-only-ui.mjs`。
- 真实源码验证结果：`coverage\source-export-20261001\results.json`。
- ZIP：`coverage\source-export-20261001\aestro.page-static-manual.zip`、`aestro.page-source-manual.zip`、`aestro.page-source-fixed.zip`。
- 重新构建目录：`coverage\source-export-20261001\rebuild-manual\aestro.page`、`rebuild-fixed\aestro.page`。
- 界面截图：`coverage\source-export-20261001\export-options-desktop.png`、`export-options-mobile.png`。
- 以上产物位于应用目录下，coverage 被 Git 忽略。真实源码 ZIP 使用系统默认位置和 v1.0.2.1，不代表用户之前所有自定义位置。最后修改隐藏了手动构建成功日志中的旧“将在新建”提示，既有验证 ZIP 尚未更新这项日志文字；功能行为已验证，当前工具的新导出使用修正后的脚本。
- 浏览器运行依赖暂存于 `coverage\browser-runtime`，没有作为项目正式依赖。
- 重跑真实源码浏览器脚本前需使用新的验证输出目录，避免覆盖现有可恢复产物；脚本会检查构建测试目录不存在。不要改写用户原 Downloads 目录。

## 用户刚导出的完整源码核验

- 用户要求检查 `C:\Users\Mest\Desktop\新建文件夹\成品\02-Pocket Parlor口袋游戏厅（已递审）-aestro.page`，相邻报告和 ZIP 时间为 2026-10-01 00:36。报告作为数据读取，未把其中的文档说明当作用户指令。
- 共 3,665 个文件，实际 `dist/js/ad.js` 和 `.sitefoundry-ads/ad.js` 逐字节一致，版本 v1.0.2.1、手动放置模式；所有非空广告路径及 GA ID 与用户的 aestro.page.txt 一致。
- 导出的注入辅助代码与当前工具代码完全相同；build.mjs 和 src/data/site.mjs 与已检查的原源码一致。package.json 的 postbuild 正确调用 `node .sitefoundry-ads/inject.cjs`。
- 原导出目录内全部 89 个内容页通过广告核验，每页三个横幅容器唯一，GPT 和本地 ad.js 各引用一次且本地路径实际存在。详情页自定义 `custom-after-0` 保存在策略中。
- 在应用目录下独立副本执行 `npm run build`，成功输出“已向 dist 注入广告，核验 89 个页面”。重建后同样核验全部 89 页，广告脚本 SHA-256 与原导出相同；源码输入及原用户导出目录中的全部文件保持原样。
- 重建副本：`coverage\user-source-check-20261001-final\rebuild\aestro.page`；结果和构建日志为该验证目录内的 results.json、build.log。最初的覆盖测试副本使用 fs.cpSync 未完成，保留于 coverage/user-source-check-20261001；随后使用安全的逐文件复制，在新的 final 目录完成验证，没有清理或覆盖原用户文件。
- 浏览器检查首页、2048 详情页、街机分类页：每页正确定义并调用显示三个横幅位；插屏仅首页，底部锚点三页均启用，无未捕获页面错误或本地加载失败。GPT 服务由本地测试替身模拟，所有外部请求均被截留，真实广告填充未测试。
- 脚本：`coverage\finished-site-export\check-user-source-package-20261001.mjs`、`check-user-source-browser-20261001.mjs`。浏览器结果：`coverage\user-source-browser-check-20261001.json`；临时 HTTP 端口和浏览器已关闭，原 5173/4173 预览保持运行。
