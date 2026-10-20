# SiteFoundry 三端安装应用交付记录

日期：2026-10-13。当前显示版本保持 `1.0.6.4`。此记录覆盖 Windows 安装程序、安卓手机和平板通用 APK，以及本轮针对性检查。

## 工作目录和基线

- 唯一应用工作目录：`D:\Min\建站工具\批量建站工具`。
- Git 根：`D:\Min\建站工具`；分支：`main`；基线 HEAD：`337a87a81efdecca6a2320088188983ebd20acab`。
- 原浏览器预览端口：5174；备份预览端口：5175；两者的启动目录均为上述应用目录。本轮应用不依赖这些端口；交付检查时未确认它们处于监听状态。
- Windows 安装应用使用 `sitefoundry://app/` 稳定来源及系统分配的本机内部端口；安卓工作台使用稳定的 `https://localhost` 来源。
- 开始前保存的可恢复备份：`coverage/apps-20261013/baseline/source-before-apps.zip`，715 个文件、113,696,426 字节，并附清单、Git 状态和原有改动补丁。
- 已保留原有未提交修改、相邻游戏工具目录的 28 项删除状态、用户素材和历史证据。此次没有提交、推送或公开发布。

## 安装包

| 平台 | 安装文件 | 支持范围 |
| --- | --- | --- |
| Windows | `apps/windows/release/SiteFoundry-1.0.6.4-Windows-x64-Setup.exe` | Windows 10 / 11，x64 |
| 安卓手机、平板 | `apps/android/release/SiteFoundry-1.0.6.4-android-release.apk` | Android 10 及以上，arm64-v8a / x86_64 |

手机和平板共用一个 APK。小米 14 Pro 使用 arm64-v8a 运行时。安卓还需要支持受来源限制消息桥的 System WebView；首次有网时更新 WebView，之后可以离线打开。旧版 WebView 不满足要求时，应用显示更新提示。

最终文件大小、SHA-256、签名和验证状态见 `coverage/apps-20261013/delivery-manifest.json`。Windows 当前未配置代码签名；安装时可能出现系统的未知发布者提示。安卓使用本机私有发行密钥签名，后续覆盖安装必须沿用该密钥。

- Windows 安装程序：247,492,574 字节；SHA-256 `50ccf373c4251cc0f2e1398440ecdadceae052dab0b1178953257433e0821d11`。
- 安卓最终发布 APK：168,589,536 字节；SHA-256 `15d2ed8a9aeb717a16ade4404e5aaa185fd0c2106d83cbe96b1ba489718522ea`。
- 安卓发行证书 SHA-256：`68a22702b3e827467f5211e2e869cd9764284505657ec7dba47c49fe95600fec`；APK v2 签名有效。

## 实现内容

三端继续共用现有 HTML / CSS / JavaScript / Vite 建站核心。Windows 增加 Electron 容器；安卓增加 Capacitor / Kotlin 容器。文件读写、模板存储和源码构建分别通过明确的原生接口连接，网页生成器无需复制成三个版本。

- 普通 ZIP 导出改为等待系统保存完成，取消或写入失败会明确反馈。
- 手机和平板支持系统文件选择、授权目录读取、目录树输出、分块读写、返回键及安全区域适配。
- 新增“源码工程”窗口，提供 ZIP 导入、依赖准备、离线构建、日志、取消、隔离预览和成品导出。
- 本地字体、ZIP / RAR 解析 Worker / WASM 和 npm 随应用打包；使用者无需安装 Node 或开发工具。
- 源码项目和准备后的依赖保存在应用数据目录；检查锁文件、运行时及依赖文件哈希后才报告“已准备”。依赖改变或损坏时要求重新准备。
- 构建预览没有原生桥；生成页面 iframe 不能调用文件或构建接口。Windows 模板 API 同时检查发起窗口、框架和受信任页面。
- 安卓构建客户端在同一应用进程内复用；前台服务独立跟踪任务，界面离开后任务结束可自动清除通知。
- 安卓覆盖安装时更新 Node 入口链接，包括指向已移除旧安装目录的失效链接。运行时资源先完整暂存再替换，复制失败保留旧运行时，已移除的旧工具文件不残留；源码项目和准备依赖位于独立兄弟目录。

## 离线源码构建的使用条件

每个项目首次需要联网准备目标设备的依赖，之后在同一设备本地构建。电脑准备的 Windows 原生依赖不能直接搬到安卓使用。

首批支持具有 `package-lock.json` 和构建命令、能生成 `out`、`dist` 或 `build` 静态目录的 npm 工程。Next 静态导出使用 `out`。随包字体目录覆盖的静态 `next/font/google` 调用会在应用内项目副本中转换为本地字体，并保留许可证；原始输入 ZIP 不变。

动态服务端工程、需要远程 API 的内容、未支持的安卓原生扩展或自定义编译工具链不能据此承诺离线完成。失败时显示原因，不以源码 ZIP 冒充构建成品。构建阶段的 Node 网络拦截覆盖 HTTP / HTTPS / fetch / TCP / TLS / DNS / UDP，并向子进程传递；它不是任意原生程序的系统级网络沙箱。

安卓使用固定哈希的 Node mobile `24.21.0-0` 分发版本，它属于移动端预发布分发。来源、许可证、ABI 和各二进制哈希保存在 `apps/android/native-runtime/runtime-provenance.json`。Windows 使用官方 Node `24.21.0`。移动端运行时仍需结合实际项目在真机上的构建结果验收。

联网后台构建为后续可选扩展，本轮没有部署后台。远程游戏、远程图片和真实广告 / GA 服务仍需网络。

## 已完成的针对性验证

| 检查 | 已取得的证据 | 证明范围 |
| --- | --- | --- |
| 共享单元检查 | 6 个测试文件，45 / 45 通过；`coverage/apps-20261013/shared-unit-final.log` | 分块桥接、SAF 目录恢复、模板 AST、压缩包工具、源码导出和本地字体 |
| 共享生产构建 | `coverage/apps-20261013/shared-build.log`，构建成功 | 主工作台和游戏工作台可打包；保留已有大包体提示 |
| 浏览器响应式检查 | `coverage/apps-20261013/shared-browser/results.json`，11 项通过 | 390、800、1280、1440 宽度下两工作台源码窗口；焦点恢复；真实资讯 RAR 生成和游戏 ZIP 导出 |
| Windows 真实源码编译 | `coverage/apps-20261013/runtime-raw-next-bundled-20261013-2025/result-fea29ab8-b6cc-4159-9134-18ab5f51f235.json` | 使用随包 Node 编译原始 PixelWire Next 15.5.4 副本，77 个静态页面、244 个产物文件、17,268,111 字节；产物可重新打开，依赖损坏会撤销准备状态 |
| Windows 打包应用 | `coverage/apps-20261013/windows/` 与最终交付清单 | 实际 EXE 的工作台、文件接口、来源隔离、源码流程与安装检查分别记录 |
| Android 安装包 | `coverage/apps-20261013/android-package-verification.json`，641 / 641 项通过；签名、badging 与 zipalign 均退出 0 | 发布构建、工作台与源码构建字体摘要、npm / 子进程适配器资源完整性、SDK / ABI、APK 签名与 16 KiB 对齐；不等同于设备运行验收 |
| 构建运行时针对性检查 | `coverage/apps-20261013/runtime-targeted-2026-10-13T15-32-01-135Z/tests.tap` 和 `test-summary.json`，5 / 5 通过 | ZIP 边界、网络拦截、任务恢复与独立产物、本地字体、Android 子进程适配器；检查在 Windows 执行，不计作安卓实际框架构建 |
| 安卓运行时目录更新 | `coverage/apps-20261013/android-runtime-upgrade-summary.json`，3 / 3 项通过 | 使用当前 Kotlin 源码在 Windows JVM 的实际文件系统上检查旧文件移除、复制失败保留及未知文件保护；不计作 Android 原生链接或实际覆盖安装验收 |

浏览器检查使用模拟原生桥，源码任务状态也由模拟桥提供；其中资讯和游戏生成器实际运行，但此项不能证明安卓原生文件接口或安卓源码编译已在设备上通过。

Windows 实测主机为 Windows 10 IoT Enterprise LTSC 2021、10.0.19044、x64。Windows 11 尚无独立系统验收。同版本重装检查不能替代未来跨版本升级检查。

最终 Windows 打包 EXE 的首次启动 19 项、再次启动 18 项检查通过，实际源码窗口完成了已转换本地字体的 Next 样本导入、依赖准备、离线构建、预览和字节一致的 ZIP 保存。该 UI 样本产生 245 个文件，与上表原始 Next 字体转换样本的 244 个文件分别记录。

Windows 安装包保留已验收的运行时快照，`apps/windows/build/staging-manifest.json` 固定其输入哈希。最后加入的 Android 专用子进程适配器不改变 Windows 执行路径；两个包的运行时文件不宣称逐字一致。

最终安装检查：实际 NSIS 安装、同版本重装、每轮两次启动以及自带卸载通过，测试配置和模板保留。卸载完成后本轮注册表项、快捷方式及安装缓存均已清除。最初脚本只等待 EXE 消失，误将仍在运行的卸载辅助进程判为快捷方式残留；修正等待全部清理并复跑后通过。失败记录保留为 `windows/installer/installer-summary-uninstaller-delay.json`，最终结论见 `windows/installer/installer-summary.json`。

安卓运行时目录更新测试最初在 Gradle 加载测试类时遇到 `ClassNotFoundException`，尚未进入用例。保留该日志后，使用缓存 Kotlin 编译器重新编译当前源码并在独立 ASCII 路径执行 JDK 21 / JUnitCore，3 项实际文件系统检查通过。此处没有将 Gradle 测试任务记为通过。

## 尚待设备验收

用户表示小米 14 Pro 暂时不方便通过 USB 连接，要求先完成安装包。本轮不因真机缺席延迟交付，也不将安卓运行能力写为已完成验收。

本机较新的安卓模拟器启动崩溃；较旧模拟器可进入 Android 10 启动过程，但系统服务尚未就绪，安装返回 `Failure calling service package: Broken pipe (32)`，未取得实际安装应用的运行证据。因此下列项目仍待验证：

1. 小米 Android 16 的安装、冷启动、文件选择、授权目录和成品 ZIP 保存。
2. 准备好项目依赖后关闭网络，实际完成一次 React / Next 源码构建、预览和导出。
3. 切到后台、返回工作台、取消任务、应用重开后的状态与通知。
4. 使用同一发行签名覆盖安装，确认工程、准备依赖、广告模板及目录授权保留。
5. 安卓平板竖屏 / 横屏、Android 10 设备、系统返回键及大文件导出。

本轮没有运行全部历史回归；差异化精品建站的实际流程继续沿用此前排除验收的约定。

## 数据保留和交接

Windows 数据位于 `%APPDATA%/SiteFoundry`；安卓数据位于应用私有目录。覆盖安装应保留数据；清除安卓应用数据或卸载会删除其私有工程与准备依赖，重要输入和成品应另存到授权目录。

原浏览器版与安装应用的存储来源不同。浏览器保存的游戏目录不会自动同步到 Windows 或安卓，需要携带原始游戏 ZIP 重新导入。Windows 首次启动可在校验通过时复制原离线服务的广告模板，保留原目录。

后续开发从 `apps/README.md`、`apps/windows/README.md`、`apps/android/README.md` 和 `apps/build-runtime/README.md` 开始。修改后先构建共享 `dist`，再分别打包两个容器。安卓发行密钥保存在本机私有构建签名目录，不进入源码或安装包。
