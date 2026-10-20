# SiteFoundry 安装应用

当前源码版本为 **1.1.2**；本次仅推送源码，没有重新构建安装包。已交付的 1.0.1 安装包保持原文件名和哈希，不包含后续新旧模板和广告模板复用功能。历史报告和下方历史构建信息保留原版本语境。

三端共用现有 HTML、CSS、JavaScript 和 Vite 建站核心。Windows 使用 Electron；安卓手机和平板共用 Capacitor / Kotlin 工程。应用安装后包含工作台、本地字体、压缩包解析器和源码构建运行时。

## 使用范围

- Windows：Windows 10 / 11，x64。
- Android：Android 10 及以上，arm64 手机和平板；x86_64 用于兼容设备与模拟器。Android System WebView 需要支持受来源与主框架限制的消息接口，首次有网时更新 WebView，之后可离线打开。
- 普通资讯、游戏、广告处理等工作流仍由共享生成器完成。导出通过系统文件保存；目录读取与目录输出通过授权的本地目录完成。
- 普通建站可直接上传包含 JSON＋图片的 RAR / ZIP / 7Z，或选择解压后的数据源文件夹。批量建站可连续添加数据源文件夹；每次添加保留已有站点和广告配置，至少两份数据源后继续。多份有效 JSON 会明确要求选择；只上传 JSON 不会读取旁边未授权的图片。
- React / Next 等源码工程使用新增的“源码工程”窗口：导入完整源码 ZIP，联网准备一次项目依赖，然后在本机离线构建、预览和导出网站 ZIP。

“准备完成”会检查项目锁文件、目标设备运行时和已准备文件的哈希。更改依赖、损坏文件或更换平台后需要重新准备。Windows 的原生依赖不能直接复制给安卓使用。

首批构建器处理具有 `package-lock.json` 和构建命令的 npm 工程。Next 静态工程输出到 `out`；其他工程输出到 `dist`、`build` 或 `out`。动态服务端工程、依赖不支持安卓的原生编译扩展、必须访问远程 API 的页面会明确报错；应用不会把失败构建替换成源码 ZIP。随包字体库覆盖的静态 Google 字体调用会转成本地字体，保留许可证。

远程游戏、远程图片和真实广告 / GA 服务仍需网络。联网后台构建目前属于后续可选扩展，本地构建独立运行。

## 开发目录与构建

唯一应用目录为 `D:\Min\建站工具\批量建站工具`；Git 根为 `D:\Min\建站工具`。在执行构建前核对：

```powershell
git rev-parse --show-toplevel
npm run build
```

首次准备各端的独立依赖后：

```powershell
npm run apps:runtime:prepare
npm run apps:windows
npm run apps:android
```

各端依赖分别位于 `apps/windows/node_modules` 与 `apps/android/node_modules`，由对应目录的锁文件固定。Android 构建工具使用 `JAVA_HOME`、`ANDROID_HOME`、`SITEFOUNDRY_TOOLCHAIN` 或此次准备的 `coverage/apps-20261013/toolchain`；不会要求终端用户安装这些开发工具。

- Windows 产物：`apps/windows/release/`。
- Android 产物：`apps/android/release/`，手机和平板使用同一 APK。
- 源码构建模块：`apps/build-runtime/`。
- 桌面容器说明：`apps/windows/README.md`。
- 安卓运行时版本和哈希：`apps/android/native-runtime/runtime-provenance.json`。

发行时只包含明确的应用资源，不包含 `coverage` 历史验证材料、原始网站工程或整份开发目录。Android 发布签名保存在本机私有构建签名目录，后续升级必须继续使用原签名；不要把私钥放进源码或交付包。

## 数据与升级

Windows 用户数据位于 `%APPDATA%/SiteFoundry`；Android 位于应用私有数据目录。工程、准备好的依赖、广告模板与稳定 origin 下的游戏目录独立于安装资源保存。覆盖安装应保留数据；清除应用数据或卸载安卓应用会删除其私有数据，重要输入和成品应另外保存在用户选择的文件目录。

原浏览器、Windows 应用、安卓应用拥有独立存储。浏览器中保存的游戏目录不会自动跨设备同步，需携带原始游戏 ZIP 并重新导入。原浏览器目录、备份和测试材料不会被应用化过程清理。

## 验证边界

历史验证报告与证据仅保留在本地 `docs/apps-adaptation-2026-10-13.md` 和 `coverage/apps-20261013`，不随源码仓库分发；源码和安装包的通过情况分别记录。浏览器中的桥接模拟检查只证明共享界面状态，不能代替安装应用或真机检查。差异化精品建站实际流程沿用此前排除验收的约定。
