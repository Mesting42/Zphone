# 游戏站批量建站工具：会话交接

更新日期：2026-09-12

## 当前目标

继续维护 `D:\Min\建站工具\游戏站批量工具`，优先处理用户后续提出的功能、导入、预览、导出和界面问题。用户使用中文沟通，并希望在 Edge 查看工具。

## 运行方式

项目是原生 HTML/CSS/JavaScript，没有 `npm run dev` 或 `npm run serve`。

```powershell
cd 'D:\Min\建站工具\游戏站批量工具'
python -m http.server 5174 --bind 127.0.0.1
```

在 Edge 打开 `http://127.0.0.1:5174/`。请保持 `127.0.0.1`，不要改成 `localhost`：浏览器对不同 origin 使用不同 IndexedDB，本地保存的目录不会互通。

## 已完成的主要功能

### 导入与数据源

- 支持 `.json`、`.zip`、`.rar`、`.7z` 导入；ZIP 通过 JSZip 解析，RAR/7z 按需加载 `libarchive.js`。
- 导入后显示“重新上传”按钮。
- 已保存目录使用 IndexedDB（`game-site-batch-builder` / `saved-catalogs`）；它只在同一个浏览器和同一个 origin 下可见。
- 已将用户提供的五份游戏源打包为内置目录：
  - `assets/builtin-game-sources/game-source-1.zip`
  - `assets/builtin-game-sources/game-source-2.zip`
  - `assets/builtin-game-sources/game-source-3.zip`
  - `assets/builtin-game-sources/game-source-4.zip`
  - `assets/builtin-game-sources/game-source-5.zip`
- 目录来源下拉菜单包含“内置游戏源 1–5”，每份 84 款游戏。选择后才抓取并解压对应 ZIP，封面会随导出站点保存。
- 内置源清单：`js/built-in-game-sources.js`；加载逻辑：`js/app.js` 中的 `loadBundledGameSource`。

### 广告

- 广告 TXT 解析位于 `js/ad-migration.js` 的 `inspectAdCodeText`，会识别 `banner1/2/3/4`、`INT`、`ANC` 和 GA ID。
- TXT 中的广告位域名会去除 `-banner1/-banner2/-banner3` 等后缀，并自动同步联系邮箱为 `contact@子域名`。
- 校验通过后，游戏站会与资讯工具一样自动插入三处广告位：
  - 首页导航下
  - 首页前两个分类区块之后
  - 详情页相应位置
- 已验证 TXT 时隐藏手动广告容器选择，避免“识别成功但没有实际广告位”。
- 未通过校验的广告 TXT 会阻止导出。

### 预览与导出

- 返回首页新增 `minimal`、`underline`、`outline`、`pill`、`icon`、`glass` 等样式；预览和导出使用同一渲染函数。
- 游戏卡描述默认支持两行截断。
- 详细页脚已压缩：桌面缩小间距；移动端简介单行、快速链接和法律链接双列、联系信息横向收拢。
- 广告、返回首页、页脚等均在 `js/generator.js` 生成，改动生成样式时同时影响实时预览和导出页面。

### 工具界面

- 游戏工具工作台已改为与资讯工具一致的浅色蓝系界面：顶部品牌栏、悬浮步骤条、白色配置卡和点阵预览区。
- 新增应用内提示/确认弹窗，已移除原生 `alert` / `confirm`。

## 关键文件

| 文件 | 作用 |
| --- | --- |
| `index.html` | 工具页面、目录来源下拉选项、资源脚本加载顺序 |
| `css/tool.css` | 工具界面样式；末尾为“资讯工具同源视觉”覆盖规则 |
| `js/app.js` | 状态、数据源选择、内置 ZIP 源加载、广告 TXT、预览控制 |
| `js/game-zip-import.js` | ZIP/RAR/7z 的数据和封面提取 |
| `js/game-archive-runtime.js` | RAR/7z 按需解析运行时 |
| `js/built-in-game-sources.js` | 五份内置游戏源的清单 |
| `js/ad-migration.js` | 广告 TXT 与旧站广告压缩包校验 |
| `js/generator.js` | 预览与导出网站 HTML/CSS/广告脚本 |
| `js/saved-game-catalogs.js` | IndexedDB 本地目录保存、重命名与删除 |
| `tests/generator.smoke.js` | 冒烟测试，覆盖生成器、广告、内置源和关键 UI 标记 |

## 验证命令

每次修改后至少执行：

```powershell
cd 'D:\Min\建站工具\游戏站批量工具'
npm test
npm run check
```

当前这两项均已通过。

## 注意事项

- `D:\Min\建站工具` 不是 Git 仓库，不能使用 `git diff` / `git status`。
- 内置游戏资源约 85 MB，已作为 ZIP 随项目保留；不要将五份内容直接嵌入 JavaScript，以免首次打开过慢。
- 当前项目通过本地 HTTP 服务使用最可靠。`file://` 下无法可靠 fetch 内置 ZIP 或共享浏览器本地目录。
- 用户此前在别的浏览器导入的目录不会自动出现在 Edge；这是浏览器 IndexedDB 隔离，不代表源文件被删除。
- 有过一次内置浏览器自动化连接失败；如需打开页面，使用本地服务并直接用 Edge 即可。

## 后续建议

若用户要把旧浏览器的本地目录迁到 Edge，可新增“导出已保存目录 / 导入目录备份”功能，而不要尝试直接读取另一个浏览器的 IndexedDB。
