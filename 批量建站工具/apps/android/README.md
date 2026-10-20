# SiteFoundry Android 应用

当前源码版本为 **1.1.1**；本次仅推送源码，没有重新构建安装包。已交付的 1.0.1 安装包保持原文件名和哈希，不包含后续新旧模板功能。历史报告和下方历史构建信息保留原版本语境。

手机和平板共用安装包。当前已交付文件为 `release/SiteFoundry-1.0.1-android-release.apk`；下一次从本源码构建时将输出 `SiteFoundry-1.1.1-android-release.apk`，本次未生成新包。支持 Android 10 及以上的 64 位 ARM 设备；同时包含 x86_64 运行时用于模拟器。应用内带工作台、本地字体、归档组件、npm 和 Node 运行时，日常启动不要求设备安装 Node 或连接电脑。

## 安装与升级

1. 把 APK 传到手机或平板，用系统文件管理器打开；按系统提示允许该文件管理器安装应用。
2. 打开 SiteFoundry。如提示更新 Android System WebView，先在联网环境更新，再重新打开应用。旧版 WebView 无法提供隔离预览所需的受限原生桥接能力。
3. 后续版本直接覆盖安装，应用私有目录中的项目、依赖和广告模板会保留。内置工具先完整暂存再替换，删除新版不再提供的旧工具文件；Node 入口会更新到新安装位置。卸载或在系统设置中清除应用数据会删除这些内容。

发布签名为本机生成并持久保存的 SiteFoundry RSA 3072 位密钥。维护者应保留 `%LOCALAPPDATA%\SiteFoundry\build-signing`，后续安装包使用相同密钥才能覆盖升级；密钥和密码不随安装包分发。

## 真机检查步骤

以下检查仍需在小米 14 Pro / Android 16 和实际平板上完成。安装包通过构建与静态检查不代表这些设备流程已经验收。

1. **启动与页面**：首次打开，确认 SiteFoundry 图标和标题；分别进入资讯和游戏工作台，检查手机窄屏、平板横竖屏、输入法弹出及返回键。返回键应先关闭当前弹窗，再返回页面或退出应用。
2. **系统目录与文件**：在应用中选择导出目录，按 Android 系统文件选择器授予访问权限。导入 ZIP/RAR/7z 和站点目录，完成一次 ZIP 导出及含子目录的目录导出；用系统文件管理器检查文件和目录链接。应用重开后应保留授权目录。
3. **普通建站断网流程**：先准备本地数据文件，再开启飞行模式并关闭 Wi-Fi，重开应用。分别生成资讯站和游戏站，查看预览并导出 ZIP；重新打开导出包，检查 HTML、封面、本地字体和广告配置。
4. **源码依赖准备与离线构建**：联网导入实际 React/Vite 或静态导出的 Next 工程 ZIP，在源码构建窗口执行依赖准备，等待明确成功。之后开启飞行模式并关闭 Wi-Fi，重新进入同一项目执行构建，打开构建预览、导出网站产物并解压检查。原始工程含 `next/font/google` 的样本也应覆盖此流程。依赖按项目及设备准备，电脑的依赖缓存不能直接视为安卓已经准备完成。
5. **前后台与取消**：启动依赖准备或构建，返回桌面，再打开应用，确认任务仍可查询。任务结束后构建通知应消失；任务取消、失败及重新执行应有明确结果。
6. **覆盖安装保留数据**：保存自定义广告模板，准备一个源码项目并选择导出目录，然后覆盖安装同一签名的新版 APK，确认模板、项目准备状态和目录授权仍在。

实际源码兼容性以项目构建结果为准。必须依赖无法在 Android 运行的原生插件、外部服务或服务器部署的项目，需要单独处理；成功导出源码包不能算作网站构建成功。

## 构建与检查证据

唯一应用工作目录是 `D:\Min\建站工具\批量建站工具`，Git 根为 `D:\Min\建站工具`，当前工作分支为 `main`。旧 AGENTS 的 Zphone 路径已由用户后续原目录指令替代，记录见 `docs/regression-materials.md`。浏览器预览端口 5174 的启动目录仍为上述应用目录；开发前应重新核对端口进程，APK 自身不依赖该预览服务。

开发工具隔离放在 `coverage/apps-20261013/toolchain`，其 ASCII 路径入口为 `D:\Min\SiteFoundryAppTools`。构建需要 JDK 21、Android SDK/NDK、CMake 和 Gradle；这些是开发工具，不要求安装应用的用户另外安装。

从应用目录构建共享页面，再执行 `npm run apps:android`。已有本机工具链可以通过 `SITEFOUNDRY_TOOLCHAIN`、`JAVA_HOME`、`ANDROID_HOME` 指定。`scripts/build.mjs` 会同步真实 `dist`，核对归档及字体资源、打包 npm 的内部依赖、生成运行时内容指纹，并使用持久签名密钥构建 APK。

当前交付检查包含 Release 构建与 Android lint、APK v2 签名、最低 API 29 / 目标 API 36、手机和平板屏幕声明、arm64-v8a / x86_64、归档资源和本地字体字节校验、运行时依赖完整性，以及六个原生 ELF 的 16 KB 对齐。具体文件哈希与结果以最新证据为准：

- `coverage/apps-20261013/android-package-verification.json`
- `coverage/apps-20261013/android-signature-verification.txt`
- `coverage/apps-20261013/android-package-badging.txt`
- `coverage/apps-20261013/toolchain/build-release-upgrade-safe.log`
- `coverage/apps-20261013/toolchain/android-runtime-upgrade-tests.log`
- `coverage/apps-20261013/android-runtime-upgrade-summary.json`：ASCII classpath 的 Kotlin/JUnit JVM 检查 3 项通过；原 Gradle 测试加载失败日志保留，实际安卓覆盖升级仍需真机检查。
- `coverage/apps-20261013/android-emulation-summary.json`

本机未检测到可用的硬件虚拟化加速。官方模拟器 37/35 的软件模式未能启动完整系统；32.1.15 软件模式的 Android 10 平板进入了 adb，但系统未完成启动，APK 安装尝试返回 PackageManager Broken pipe。本轮没有完成 Android 安装后的构建或真机验收，相关日志保留在 `coverage/apps-20261013/toolchain/emulator29-*.log` 和 `coverage/apps-20261013/android-emulator-install.log`。
