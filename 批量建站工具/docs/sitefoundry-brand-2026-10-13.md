# SiteFoundry 品牌图标接入

## 现场与范围

- 应用工作目录及本地预览启动目录：`D:\Min\建站工具\批量建站工具`；Git 根：`D:\Min\建站工具`，沿用用户后续指定的原目录。
- 当前分支：`main`；现有预览：`http://127.0.0.1:5174/`。
- 用户确认“抽象网页与模块组合”方向，并确认设计预览后授权接入浏览器标签页及工作台 Logo。
- 此次改动仅属于工作台品牌呈现；不更改生成器中的网站 Logo 选项与导出站点标识。

## 文件职责

| 文件 | 职责 |
| --- | --- |
| `assets/sitefoundry-logo.svg` | 顶部 40px 品牌标识，蓝色叠页与三块布局模块 |
| `assets/sitefoundry-icon.svg` | 16px 网格构造的浏览器图标 |
| `assets/sitefoundry-icon-32.png` | PNG favicon 回退 |
| `assets/sitefoundry.ico` | 包含 16、32、48px 图像的兼容图标 |
| `assets/sitefoundry-apple-touch.png` | 180px 触屏收藏图标 |
| `public/favicon.ico` | 浏览器请求根路径默认图标时的回退 |
| `css/workbench-brand.css` | 共用品牌与响应式布局，独立于生成站点的品牌样式 |
| `identity/sitefoundry-icon-concept/` | 已确认的原创矢量、单色版、预览板及素材导出工具 |

两套工作台在原有顶部流程卡片中显示相同标识，手机窄屏仅显示图形；品牌组保留完整无障碍名称。该标识是静态品牌内容，点击不会触发跳转或清空已上传文件。

主入口图像由 Vite 处理；游戏工作台 HTML 保留相对路径，构建插件明确复制原名图标和共享品牌 CSS。HTML 引用带独立资源版本，生产构建另外使用 Vite 内容哈希。

## 构建及呈现记录

`npm run build` 完成。使用独立 Edge 浏览器查看构建产物，两套工作台的桌面、手机及资讯端平板页面均正常显示顶部品牌；图标引用的 SVG、PNG、ICO 和 Apple touch 资源返回 HTTP 200，根路径 `favicon.ico` 也返回 HTTP 200。检查过程中未记录页面脚本异常。

证据保存在本地 `coverage/brand-20261013/`：截图与 `observations.json`。本轮仅检查品牌资源及页面呈现，未运行功能回归或差异化建站工作流，未执行真实数据上传测试。此前 `1.0.6.4` 的功能回归结果见对应报告。

本次品牌改动未提交或推送 GitHub；已发布的 `v1.0.6.4` 标签保持原样。
