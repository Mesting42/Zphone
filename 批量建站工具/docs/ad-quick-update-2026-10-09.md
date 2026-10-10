# 批量广告策略：快速更新广告

日期：2026-10-09。已按用户确认的整合方案实现，功能保存在本地工作区。

## 工作目录与运行状态

- Git 根目录：`D:\Min\建站工具`；分支 `main`，HEAD `d391edf`。
- 应用及预览启动目录：`D:\Min\建站工具\批量建站工具`。
- 预览：`http://127.0.0.1:5174/`；版本号仍为 `1.0.6.2`。
- 本次没有提交、推送、打标签或发布。既有广告工作台修改、用户删除的独立游戏工具和 `.firecrawl` 资料均保留。
- 旧 AGENTS 中的 `D:\掌峰\Zphone` 已由用户在原会话明确纠正，本机继续使用上述实际目录。

## 使用与规则

进入“批量广告策略”，选择“快速更新广告”。原来的“详细广告策略”继续可用，两套模式分别保存配置。

1. 选择“单个处理”或“多个批量处理”，读取网站压缩包或本地目录。
2. 进入“配置网站”并上传新广告 TXT。单个处理只更新当前选中的网站；批量处理按原站广告域名逐站匹配。
3. 核对每站的旧／新横幅、插屏、锚点路径，模板版本与 GA 来源，然后下载 ZIP 或写入新目录。

站点范围为本工具生成的资讯站和游戏站。目标模板固定为当前最新版 `v1.0.2.1`；默认以模板为准开启广告，插屏仅首页，锚点按模板开启。另提供“保留原站各页面广告开关”选项。

TXT 直接复用 `AdMigration.inspectAdCodeText`，支持 `banner11/22/33`、`INT1/ANC1`，保留完整路径。错域名、同域名多份 TXT、广告位路径冲突和重复站点域名会阻止对应站点处理。批量中其他有效匹配仍可导出，失败站点列出原因。

新 TXT 有有效 GA ID 就使用新的，否则沿用原站 ID；两者皆空时不生成 GA 初始化。缺少可选广告单元时显示提示，对应单元不启用。

默认保留已有广告 DOM 与间隙；恢复缺失广告时沿用共享引擎的原位置捕获、清单和默认回退规则。保留开关模式保留每个原 HTML 文件的实际横幅状态，并识别已有插屏／锚点运行时条件，不执行上传脚本。正文、图片、样式、导航、游戏资源及非广告文件保持原内容。广告相关变化包括 `js/ad.js`、页面广告容器或脚本引用、页面类型标记、动态首页广告配置及 `ad-policy.json`。

每份生成的 `ad.js` 有内容指纹，页面引用以此更新查询参数；再次更换广告路径、GA 或开关时会更新缓存地址。

## 代码入口

- `js/ad-quick-update.js`：不依赖 DOM 的编排模块；严格 TXT 匹配、GA 合并、开关读取、缓存指纹、预览准备和批量处理。
- `js/app.js`：独立快速模式状态、文件选择、匹配结果、预览与既有导出入口接线。
- `index.html`、`css/tool.css`：模式与处理范围选择、配置面板、旧／新单元清单及窄屏换行。资源版本 `20261009-quick-ad-2`。
- 继续复用 `AdRestoration.preparePolicySite`、原位置恢复、站点读取、目录写入、ZIP 打包及导出前体检。导出同时传入原文件清单，阻止新增资源丢失并报告继承的源站引用问题。
- `tests/ad-policy-original-positions.browser.mjs`：样式断言改为读取入口中实际版本，并确认 CSSOM 已加载，保留原布局和位置断言。

## 本次实际验证

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 全量 Vitest，单 worker 串行 | 28 文件、380 项全部通过，52.25 秒 | `coverage/full-regression-20261009/full-vitest-after-static.log` |
| 新增快速更新引擎回归 | 12 项通过，覆盖初版及四种内置版本、别名单元、GA、开关、缓存、单站／批量与错误拒绝 | `tests/ad-quick-update.test.js` |
| 快速模式真实浏览器 | 两份真实 48 篇资讯站与一个真实游戏站导出包；单站、混合批量、错站 TXT、重选与模式切换、两种开关、ZIP 和目录输出通过 | `coverage/ad-quick-update/results.json`、四份下载 ZIP |
| 原文件与广告间隙 | 各站所有内容页原内容及原广告间隙比对；无关原文件逐字节一致，游戏资源保留 | 同上 `fileComparisons` |
| 导出页面重新打开 | 三站首页／详情／列表共 9 页；新广告路径、插屏仅首页、锚点调用正确，图片错误 0，JS 错误 0 | 同上 `exportedPages` |
| 快速模式布局 | 1600、1920、390px，页面／控件横向溢出均为 0 | 同目录 `quick-*.png`、`layouts` |
| 既有三源批量建站 | 三站各 48 篇／48 详情，上传、配置、取消、恢复、覆盖、下载和体检通过 | `page-isolation-regression.log` |
| 既有详细策略工作台 | 三页隔离、TXT、手动放置、ZIP 导出及重导入通过 | `workbench-regression.log` |
| 原位置恢复 | 三站五阶段 × 三页，共 45 次页面／135 个 banner 检查及 1600／1920／390px 布局通过 | `original-positions-regression.log`、`coverage/ad-policy-original-positions/results.json` |
| 差异化副本／游戏 smoke | 两项通过 | `node tests/verify-differentiated-copies.cjs`、`node tests/game-builder.smoke.cjs` |
| 生产构建 | 通过，2.72 秒；仍有既有经典脚本及大 chunk 提示 | `coverage/ad-quick-update/build.log` |
| whitespace | `git diff --check` 通过 | 既有 LF/CRLF 提示不影响结果 |

目录输出测试使用受控 `showDirectoryPicker` 返回值，执行真实浏览器处理与共享 writer，并通过测试桥将文件实际写入 `coverage/ad-quick-update/directory-output`；原生目录权限弹窗未自动化。广告运行时用 GPT 桩核对调用，未执行线上投放或发布。

浏览器检查中的离屏懒加载图片使用独立 Image 主动请求实际 URL；各导出站按域名根目录方式打开，匹配原模板的首页识别规则。最终导出页复核复用已实际下载的 `batch.zip`，源码在整个最终回归期间保持不变。

## 复核命令

在应用目录先执行 `git rev-parse --show-toplevel`，再依次运行，重型测试不并行：

```powershell
npx vitest run --maxWorkers=1 --no-file-parallelism
$env:PLAYWRIGHT_MODULE_PATH = 'C:\Users\zyt\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
node tests/ad-quick-update.browser.mjs
node tests/verify-differentiated-copies.cjs
node tests/game-builder.smoke.cjs
npm run build
git diff --check
```

快速浏览器测试只读取既有三站 fixture 和游戏导出包；变体、下载与目录输出全部位于 `coverage/ad-quick-update`。`QUICK_EXPORTED_ONLY=1` 可单独复核已经下载的批量 ZIP 的 9 个页面，完整运行时不要设置它。

## 2026-10-09 静态游戏站适配增量

已按用户确认适配同事建站工具生成的静态游戏站。识别边界为 `index.html`、`games.html` 和 `games/*.html`；`about.html`、`contact.html`、`privacy.html`、`cookie.html`、`terms.html` 等法律页不进入广告处理范围。列表页的 `.games-grid` 已加入版位定位器，详情页沿用 `.detail-grid` / `.prose` 内容结构。

快速更新仍只替换广告配置与 `ad.js` 模板：桌面源的旧模板可以直接升级到 `v1.0.2.1`，TXT 中的 `banner11/22/33`、`INT1/ANC1` 会按域名严格匹配；新 TXT 没有 GA 时沿用原站 GA。目标 HTML 只更新广告运行时所需的页面标记和 `js/ad.js` 缓存查询参数，法律页逐字节保留。工具清单 `ad-policy.json` 是导出时新增的恢复元数据，不属于法律页或正文内容。

真实输入与证据：

- 桌面目录 `C:\Users\zyt\Desktop\zpnews827.launchy.vip` + `zpnews827.launchy.vip.txt`：单站快速更新 UI、1600/390px、220 个目标页运行时检查通过，证据为 `coverage/full-regression-20261009/launchy/quick-results.json`。
- 下载包 `C:\Users\zyt\Downloads\zpnews827.launchy.vip_WJLGP.tar.gz` + 同 TXT：快速更新通过，源站 GA `G-KNM2M7ZSRW` 在新 TXT 无 GA 时保留，证据为 `coverage/full-regression-20261009/launchy/quick-archive-results.json`。
- 同一下载包的“详细广告策略”模式：首页、游戏列表、游戏详情预览均为 3 个广告容器，218 个游戏详情页和 `games.html` 均被纳入导出，1600/1920/390px 无横向溢出，法律页 SHA-256 未变化，证据为 `coverage/full-regression-20261009/launchy/detailed-launchy-results.json`。

实现入口补充：`js/ad-restoration.js` 的站点识别、目录/压缩包读取和 `.games-grid` 列表定位；`js/ad-quick-update.js` 的非目标 HTML 保留；`js/app.js` 的快速扫描选项。静态游戏布局有完整 `games.html` 与 `games/` 目录时才启用该页范围，普通零散 `games` 资源不会因此被识别为详情页。

## 2026-10-10 全量回归收尾

- 直接串行运行 Vitest：28 个测试文件、380 个测试全部通过；`npm run build` 通过；5174 预览已从 `D:\Min\建站工具\批量建站工具` 启动并核验 HTTP 200、标题和监听进程。
- 既有快速更新回归在预览稳定后重跑通过：`coverage/full-regression-20261009/quick-existing-rerun.log`、`quick-desktop-rerun.log`。
- `zpnews827.launchy.vip` 的快速更新、详细策略和成品站加广告真实包测试均通过；证据在 `coverage/full-regression-20261009/launchy/`。
- 首轮总 runner 的 `quick-existing`、`quick-desktop` 是预览/临时服务器超时，`full-vitest` 是 runner 未传入 Playwright/PowerShell 环境导致的启动问题；三项均已在正确环境单独重跑通过。差异化导出和工作流卡片脚本的两项旧断言已按当前界面契约修正并重跑通过。汇总见 `coverage/full-regression-20261009/regression-final-status.json`；首轮原始记录仍保留在 `regression-results.json`。
