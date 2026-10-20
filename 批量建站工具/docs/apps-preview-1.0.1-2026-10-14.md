# SiteFoundry 1.0.1 预览修复与本地验收

日期：2026-10-14，Asia/Shanghai。应用目录：D:\Min\建站工具\批量建站工具；Git 根：D:\Min\建站工具；分支 main；HEAD 337a87a81efdecca6a2320088188983ebd20acab。工作区包含未提交代码，HEAD 不能单独代表交付内容。

## 问题与修复

真实 Windows 打包 EXE 复现了成品站缺少样式、批量广告策略出现 Failed to load data。浏览器报告 Windows 响应 CSP 拦截了 Data URL 样式／脚本，以及 Blob 样式／JSON 请求。CSS link.sheet 存在不能证明样式已生效，原检查存在遗漏。

- apps/windows/src/content-security-policy.mjs 集中定义工作台响应策略，允许预览所需的本地 Data／Blob 资源。保留 sandbox、主框架身份和原生接口限制，没有关闭 webSecurity。
- js/preview-css.js 由两个预览适配器共用，处理 url() 与带引号的 @import，保留媒体、layer 和 supports 条件以及未解析的外部引用。成品站递归构造 CSS 依赖，避免 ZIP 顺序导致多层导入丢失。
- 成品站关闭 3D 时仍映射本地运行时 fetch，并仅允许 Data URL 数据连接；预先映射已有图片和字体链接，减少解析时错误请求工作台路径。
- 详情识别同时支持 details/article1.html 与 articles/slug/index.html，排除内容目录自身的列表 index。资源回归明确断言详情正文存在，防止首页冒充详情页通过。
- 根包、Windows、Android 的公开版本均为 1.0.1。Windows 文件／产品版本实测 1.0.1；Android versionName 1.0.1，内部 versionCode 10605，继续使用原发行证书。

产品代码不包含素材目录名或域名判断。真实素材为 D:\Min\合集\资讯站\12-科技趋势全景解读\dist 和 D:\project-zlm\张\限流链接广告修改\fintriza.top；两份素材逐文件留存哈希。另有两组新命名、独立目录结构的合成 ZIP，覆盖根相对／页面相对路径、查询参数、嵌套输出目录、多层 CSS 导入、本地字体、含空格图片名及运行时拼接 JSON 路径。验证范围是这些资源模式，不承诺缺少资源或不受支持的任意工程都能运行。

## 最终冻结轮次

round-3 的全部 11 项任务退出码为 0。183 个相关产品文件在打包、回归和最终核对间哈希一致；没有把前后不同代码的局部结果拼接为通过。

| 检查 | 本轮结果 |
| --- | --- |
| 共享单元／Windows 原生单元 | 41 个共享文件，598＋6＝604 项通过 |
| 普通／游戏建站、批量建站、广告移植 | 真实 RAR／广告 TXT、预览、原生 ZIP 保存通过 |
| 详细与快速广告策略、成品站 | 独立配置、匹配、开关／恢复、静态与源码导出通过 |
| 文件夹导入 | 普通／两个批量站各 48 篇／48 张封面；多 JSON、返回、取消及焦点通过 |
| Next 源码 | 联网准备后断网构建；77 页／245 文件／17350326 字节；两次启动 18／17 项检查通过 |
| 导出重开 | 19 个站点、61 页、122 个桌面／手机布局，0 错误 |
| 真实广告 TXT | 12 份，36 组预览和 72 次重开通过 |
| 新增预览资源检查 | 10 个站点／页面场景、20 个桌面／手机布局；实际字体／背景、JSON 卡片、图片和本地字体验证通过 |
| Android 包 | 3061／3061 资源／原生库检查；Release、lint、v2 签名及 16 KiB 对齐通过 |

工作台由真实打包 EXE sitefoundry://app/ 驱动，使用隔离配置目录。新资源检查主动阻断 HTTP／HTTPS，使本地 CSS、字体、图片、JSON 的通过不依赖外网。导出物在独立浏览器重开。Windows 已安装程序没有被替换。

第一整轮在游戏图片检查期间发生 Execution context was destroyed，保留为失败证据。只修正测试驱动，等待文档连续稳定 500 ms 后再读取图片；原内容断言保留。随后从普通建站开始完整重跑本轮。早期复现和中间检查失败也保留。

第二轮后人工复核新增截图，发现“详情页”检查实际仍展示首页。补充失败单元并修复通用扁平详情路径识别，增加正文断言；重新构建两个平台安装包并执行第三整轮。第二轮不能作为此次路由修复后的验收证据。

## 安装包身份

| 平台 | 文件 | 字节数 | SHA-256 |
| --- | --- | --- | --- |
| Windows x64 | apps/windows/release/SiteFoundry-1.0.1-Windows-x64-Setup.exe | 247510263 | 2de9ebb5baa55f10a703ac62768f7290c69b3edb862ae791362a1bfda8c09511 |
| Android 手机／平板 | apps/android/release/SiteFoundry-1.0.1-android-release.apk | 168610004 | 2471cff30d803e29467c332fc32ee997e0ef78d92fc0b0a1ea1ad1386604c813 |

Android 证书 SHA-256：68a22702b3e827467f5211e2e869cd9764284505657ec7dba47c49fe95600fec。旧 1.0.6.4 安装包及修改前源码在 coverage/apps-preview-20261014-v1.0.1/baseline 留有备份；历史同名包／旧清单不作为本轮身份依据。

## 边界与后续

差异化建站继续排除。Android 真机的 RAR／SAF、硬件返回、离线编译、手机／平板及最低系统兼容、覆盖安装仍待设备验收。Windows 11、现有 Windows 安装升级、线上广告投放／收益／GA 接收仍未验收。Windows 安装包未配置代码签名。

没有提交、推送、公开发布、安装、卸载或清理工作树。原有修改、相邻目录 28 项用户删除、.firecrawl、原素材和历史证据保留。主要证据：coverage/apps-preview-20261014-v1.0.1/delivery-manifest.json、frozen-source.json、round-3/task-status.json、round-3/preview-resources/results.json、shared-units.log、windows-native-units.log、android-package-audit.json、android-signature.txt、android-align.txt。

本轮没有启动浏览器开发预览。历史端口 5174／5175 不能作为当前服务证据；以后启动目录仍为上述唯一应用工作目录。后续产品修改后重新构建，并从头完整回归，冻结源码下全部通过后才能形成新的验收结论。

2026-10-14 后续清理说明：用户随后明确要求删除 coverage 中历史测试产物，保留正式安装包、报告及测试脚本。原始日志、截图、导出包、测试副本、隔离配置和旧包备份现已清理；以上结果记录及身份清单仍保留，1.0.1 正式包哈希未变。相关旧文件链接不再代表当前可用证据，后续复验需重新生成输入。详见 coverage-cleanup-2026-10-14.md。
