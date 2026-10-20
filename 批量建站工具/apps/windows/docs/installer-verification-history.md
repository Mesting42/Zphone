# 2026-10-13 Windows 安装验收记录

本轮操作目标：应用 `D:\Min\建站工具\批量建站工具`，Git 根 `D:\Min\建站工具`，分支 `main`，基线 HEAD `337a87a81efdecca6a2320088188983ebd20acab`。浏览器预览 5174/5175 未更换或重启；Windows 应用监听自己的随机内部端口。

安装程序与解压程序使用同一最终冻结资源。安装包 SHA-256：`50ccf373c4251cc0f2e1398440ecdadceae052dab0b1178953257433e0821d11`，大小 247,492,574 字节。

第一次安装验收已通过两个安装周期、四次实际应用启动和数据保留，但脚本在临时卸载 helper 删除主 EXE 之后立即读取开始菜单链接。该时间点链接尚未被 helper 删除，所以 `coverage/apps-20261013/windows/installer/installer-summary-uninstaller-delay.json` 为历史失败报告。

随后只读检查发现链接、安装目录已自然消失；没有手工删除链接或安装目录。验证脚本改为等待 EXE、注册和链接共同完成清理。同时修复注册表匹配：实际卸载登记显示名是 `SiteFoundry 1.0.6-4`，键名是应用 GUID `e0e1123b-7f0a-5b02-a0fb-b4f8752595ae`，此前只匹配精确 `SiteFoundry` 会漏记。

重跑安装程序完成两个周期：首次安装与同版本重装，各自启动两次、每次 18 项检查通过，隔离数据标记和模板保留。成功报告 `installer-summary.json` 结束时间为北京时间 23:39:32，`ok: true`。

卸载 helper 运行期间另一次即时注册/链接快照曾显示仍存在，随后已由 helper 自然删除。最新 `actual-registry-after.json` 是卸载完成后重新读取的最终状态：卸载键、`HKCU\Software\{APP_GUID}` 安装键及开始菜单链接均不存在。历史失败报告保留以说明过早读取问题，最终状态由 `final-summary.json` 再次校验。此过程未使用用户真实 `%APPDATA%\SiteFoundry`，也未修改其他已有安装。

这次证明同版本重装的数据保留和本包安装/卸载行为。Windows 11 独立系统、跨版本升级及发布签名仍有明确边界。
