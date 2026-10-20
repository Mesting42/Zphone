# SiteFoundry Windows 应用

当前源码版本为 **1.1.2**；本次仅推送源码，没有重新构建安装包。已交付的 1.0.1 安装包保持原文件名和哈希，不包含后续新旧模板和广告模板复用功能。历史报告和下方历史构建信息保留原版本语境。

此工程把现有工作台打包为 Windows 10 / Windows 11 的 x64 安装应用。采用 Electron 44.7.0、Chromium 和打包后的工作台；源码构建另带官方 Node 24.21.0 与 npm 10.9.4。使用者无需安装 Node、npm，也无需启动 5174 的浏览器服务。

## 工作目录与构建

- 唯一应用工作目录：`D:\Min\建站工具\批量建站工具`。
- Git 根：`D:\Min\建站工具`；本轮分支 `main`，基线 HEAD `337a87a81efdecca6a2320088188983ebd20acab`。
- 原浏览器预览：5174，启动目录为唯一应用工作目录；备份预览：5175。本工程不会占用或重启它们。
- Electron 使用 `sitefoundry://app/` 稳定来源；内部资源服务监听系统分配的本机随机端口，随应用关闭。

先在唯一应用工作目录完成共享生产构建，再在 `apps/windows` 执行：

```powershell
npm ci
npm run dist
```

`stage` 从共享 `dist` 复制资源，打包模板解析器、Worker、WASM、本地字体、品牌图标、源码构建模块及 npm。首次准备 Windows Node 运行时会联网下载官方二进制，按官方 SHA-256 校验并记录来源和许可证；再次构建使用验证通过的缓存。

输出目录：`apps/windows/release`。下一次按本源码构建时，安装包名称为 `SiteFoundry-1.1.2-Windows-x64-Setup.exe`；当前没有生成该文件。既有正式包仍为 `SiteFoundry-1.0.1-Windows-x64-Setup.exe`。Windows 源码中的应用、文件和构建版本统一为 `1.1.2`。

## 用户数据与更新

广告模板、本机源码项目、已准备依赖和浏览器数据位于 `%APPDATA%\SiteFoundry`，与安装目录分离。更换安装版本保留这些数据，卸载配置也保留应用数据。源码工程首次联网准备依赖后才能断网构建；工程依赖或运行时变化时需要重新准备。构建成功必须产生可部署的静态网站目录才会提供最终 ZIP。

应用首次启动且尚无自身模板清单时，会检查浏览器离线服务的 `%USERPROFILE%\.sitefoundry\ad-templates`：清单、文件范围与模板 JavaScript AST 校验通过后复制到应用存储，保留默认版本并重新计算替换范围；原目录保持完整。无旧存储时使用随包模板。已有应用模板不会被覆盖；旧清单无效或应用目录已有未知文件时显示具体导入提示，用户可重新选择模板。

浏览器版的游戏目录和其他 IndexedDB 数据使用浏览器来源，应用使用独立来源；首次使用需重新导入游戏 ZIP 或目录。应用内的本机目录导入通过 Windows 文件夹对话框授权，按分块读取；导出通过系统保存对话框或明确选择的文件夹保存。

## 平台接口与隔离

`src/preload.cjs` 只向受信任的顶层工作台公开 `window.SiteFoundryNative`。渲染器禁用 Node，启用 context isolation、sandbox 与 web security。主进程重新检查每次 IPC 的窗口、主框架及工作台地址。

- 普通保存：`saveFile({name,mime,base64|bytes})`。
- 分块保存：`startFile({name,size,directoryToken?,relativePath?})`、`appendFile({id,base64|bytes})`、`finishFile({id})`；取消使用 `cancelFile({id})`。每块上限 4 MiB，单文件上限 1 GiB。
- 目录导出：`selectDirectory()` 返回不暴露实际路径的授权 token，分块保存只能写入该目录下的相对路径。
- 目录导入：`selectImportDirectory()` 返回文件元数据和不透明 `uri`；`readImportFile({uri,offset,length})` 每块上限 512 KiB，并复核实际路径。
- 广告模板：既有 `/__sitefoundry/ad-templates` API 与 native templates 方法使用同一个用户数据存储。
- 源码构建：`importProject({pick:true})` 使用系统 ZIP 选择器；其余方法与共享构建管理器对应。`exportArtifact({taskId})` 直接保存最终 ZIP。
- 构建预览：`previewArtifact({taskId})` 打开独立只读来源 `sitefoundry-preview://随机标识/`，仅提供该任务的产物文件。预览窗口没有 preload 或 native bridge。

生成页面 iframe 和构建预览均不能调用文件/构建接口。模板 API 在转发到内部服务前检查原始来源，拒绝不透明 iframe 的读写请求。预览路径经过目录范围与 realpath 校验，不会提供一般文件系统访问。退出应用时等待本管理器的构建进程取消与任务状态保存，并清理尚未完成的分块临时文件。

## 本轮针对性检查

```powershell
npm test
node scripts/verify-build-runtime.mjs
node scripts/smoke.mjs --ui-build
powershell -ExecutionPolicy Bypass -File scripts/verify-installer.ps1
```

检查记录写入共享 `coverage/apps-20261013/windows` 与 `windows-build`，测试使用隔离数据目录。`verify-build-runtime` 使用真实 PixelWire Next 15.5.4 样本的副本，使用打包的 Node，限定 PATH 到该运行时和 Windows System32，先准备依赖再启用网络拦截断网构建。`smoke --ui-build` 从实际打包 EXE 启动，操作源码对话框完成 ZIP 导入、依赖准备、本机离线构建、隔离预览与成品保存，并逐字节比较产物 ZIP；同时检查主/游戏工作台、稳定存储、原生字节/分块/目录读写、模板、Worker/WASM、来源隔离与本地资源，保存渲染截图。

最终检查：6/6 Windows 针对性单元通过；最终解压版两次启动分别通过 19/18 项，源码 UI 工作流生成 245 个文件且导出 ZIP 与构建任务产物逐字节相同；实际安装和同版本重装各启动两次，四次各通过 18 项，卸载后本轮注册、开始菜单快捷方式和安装缓存均清理，隔离数据保留。安装验收第一次过早读取临时卸载 helper 尚未删掉的链接，历史失败报告保留；改为等待 helper 的完整清理后重跑通过，应用包本身未因该等待问题修改。

安装验收脚本拒绝触碰已存在的 SiteFoundry 安装、真实用户数据或快捷方式，只在 coverage 子目录安装；两次安装分别启动两次并核对隔离数据，最后通过本轮安装的卸载程序清理安装登记和快捷方式，保留测试数据证据。此项检查证明同版本重装的数据保留；跨版本升级需要后续实际版本包才能独立确认。

交付汇总为 `coverage/apps-20261013/windows/final-summary.json`。最终安装包 247,492,574 字节，SHA-256 为 `50ccf373c4251cc0f2e1398440ecdadceae052dab0b1178953257433e0821d11`。`build/staging-manifest.json` 固定共享页面和原生适配资源的散列，Windows 包内 `source-runtime/index.mjs` 散列为 `19a7b34e6a95c1d60df10a7abda4f372c52f714ec0b5ef0fe8b4f98a5626d309`；后续仅 Android 的进程适配器改动未重新纳入本次已经验收的 Windows 包。

测试主机为 Windows 10 IoT Enterprise LTSC 2021、10.0.19044、x64；Windows 11 的独立系统验收仍需相应设备或虚拟机。发布签名尚未配置。本轮未提交、推送或发布安装包。
