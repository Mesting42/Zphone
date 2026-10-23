# 测试素材清理依赖核查

## 后续执行更新

清理后功能复验完成：生成器 smoke、副本一致性通过；真实浏览器导入 3 款本地 HTTP 样例，旧版摘要 6 项配置、桌面/平板/手机预览、6 次 UI ZIP 导出及 3 宽度重开检查共 36 组通过，工作台 pageerror 0，详情正文完整。首次自动上传早于控件初始化而超时，测试增加等待首张预览卡片后重跑通过，仅修改测试同步等待，未修改产品代码。复验生成的临时 ZIP、截图、日志已再次删除，coverage 最终仍只剩 toolchain。HTTP 200、标题 SiteFoundry，PID 255204。未重新打包或测试原生客户端，也不代表完整历史工作流回归通过。

用户要求排查并重试后，使用原 PowerShell 工具、明确的绝对路径和不带 Force 的 Remove-Item，先删除单个已核验目录成功，再清理其余 102 个已列举目标成功，无删除错误。未改用其他删除工具。原拒绝未给具体原因，不能断言是权限或文件占用；已确认小范围明确目标操作通过。

清理后 coverage 仅保留 apps-20261013/toolchain，D:\Min\SiteFoundryAppTools 联接目标完整。源码、apps、正式发布包、依赖和 dist 未删除。按此前目录大小估算移除约 13.97 GiB 测试材料，非磁盘实际释放量测量。生成器 smoke 与副本一致性检查通过。预览已从应用目录恢复，PID 255204，端口 5191。浏览器功能验证结果随后补充。以下为清理前审计记录。

2026-10-23，Asia/Shanghai。用户授权清理 coverage 测试素材，保留运行环境、源码、apps 及正式发布包；本轮先完成只读依赖检查，没有删除文件。

## 工作目录

- 应用目录：D:\Min\建站工具\批量建站工具。
- Git 根：D:\Min\建站工具；分支 main；操作前已核验。
- 预览启动目录应为上述应用目录，命令 `node dist/sitefoundry-server.mjs --port 5191`。本轮检查未发现 5191 监听，不代表清理造成故障：清理从未执行。本轮没有启动或测试预览。

## 必须保留

- coverage/apps-20261013/toolchain 整个目录，约 15.887 GiB 可统计文件。含 Android SDK、JDK、Gradle 缓存、Node Mobile、模拟器及工具安装材料，暂不拆分删除。
- D:\Min\SiteFoundryAppTools 为指向该 toolchain 的目录联接，不能破坏目标或入口。
- coverage 以外所有目录保持原样，尤其 dist、node_modules、apps/build-runtime/vendor、apps/windows/build/node-runtime、apps/windows/build/source-runtime、apps/android、apps/windows、release、public、游戏内置素材及 Git 数据。
- 上述主要运行资源均检查存在；未验证完整性或实际可运行性。

## 可清理候选

- coverage 下除 apps-20261013/toolchain 外的历史截图、日志、单元报告、测试隔离数据、复制素材、导出归档及解压副本。
- 原 coverage 统计约 29.858 GiB，扣除保留工具环境约 15.887 GiB，候选释放约 13.97 GiB。统计跳过无法 stat 的条目，属于估算，不能当作实际释放量。
- coverage 没有 Git 跟踪文件。删除测试副本不等于删除外部原始素材，但仍会丢失历史证据。

## 依赖证据与边界

- 对 js、game-builder/js、server、scripts、apps、package.json、vite.config.js 搜索 coverage 引用。网页运行路径没有发现依赖 coverage 的代码；Vite 仅排除其文件监听。审计脚本将其用作输出位置。
- apps/android/scripts/build.mjs 和 native-runtime/prepare-android-runtime.mjs 默认引用 toolchain；verify-runtime-upgrade.ps1 也依赖此工具链。因此“coverage 全部可删”不成立。
- apps/windows/src/main.mjs 从应用 build/或安装资源目录加载 node-runtime、source-runtime；stage.mjs 从 dist 和 apps/build-runtime 复制打包资源，没有从 coverage 装载正式运行资源。
- 部分历史自动化仍读取 coverage 输入：Windows verify-build-runtime/smoke、Android fixture 生成器、tests/native-workbench、offline-workbench、reference-templates、ad-quick-update、ad-policy 等。删除这些素材不影响已识别的日常运行路径，但相应历史回归脚本需要重新准备输入，历史报告链接也会失效。
- 当前实际删除为零；不能声称“清理后启动/导入/预览/导出通过”。真正清理后必须重新执行这些功能验证，原生设备和客户端构建另行区分。

## 执行状态

先前批量递归删除请求被自动审批安全检查拒绝，仅返回 blocked by policy，未给具体原因。本轮没有更换方式绕过该拒绝，也没有执行删除。只读核查完成，实际清理及清理后验证仍未完成。
