# 批量建站工具：当前会话交接

交接日期：2026-09-15（Asia/Shanghai）
工作区：`D:\Min\建站工具`

## 重要约束

- 工作区是脏工作树，含用户和此前任务的大量改动。不要运行 `git reset --hard`、`git checkout --`，不要删除或覆盖无关文件。
- 本次修复所在源目录：`D:\Min\建站工具\批量建站工具`。
- 用户桌面存在一个过时且独立的副本：`C:\Users\zyt\Desktop\新建文件夹\运营站批量生成\批量建站工具`。未经明确授权，不要覆盖它。
- 用户使用中文，偏好简短进度更新。前端任务需要按 `frontend-design` 做渲染验证。

## 已完成实现

### 差异化建站

已在资讯和游戏工具中扩展差异化建站流程。共享引擎位于：

- `shared/differentiated-builder.js`
- `批量建站工具/js/differentiated-builder.js`
- `游戏站批量工具/js/differentiated-builder.js`

已支持领域专属模板、可覆盖默认值的样式和结构设置、分类页独立列数、封面显示策略、卡片高度和间距。用户要求避免巨大 Hero，默认已改为紧凑介绍。

### 普通资讯建站：广告容器放置

已在 `批量建站工具` 的普通建站模式中实现与游戏工具一致的广告容器：

- `index.html` 显示广告 1/2/3 容器，可选择放置、重新放置、移除。
- `js/app.js` 的 `syncDirectAdPlacementUI()`：广告 TXT 校验后隐藏手动容器并采用固定广告位；未上传有效 TXT 时可在预览放置首页/详情页广告。
- `js/generator.js`：未上传有效 TXT 的手动位置只用于预览，导出不生成空广告位；已验证 TXT 会导出固定广告位与 GPT/ad.js。
- `css/tool.css`：广告容器卡片样式已对齐游戏工具。

### 导出 CSS 兜底

已在 `批量建站工具/js/generator.js` 实现导出一致性：

- `generateCSS(config)` 同时写入 `website/css/style.css`。
- 同一 CSS 还会写入每个导出 HTML 的 `<style data-generated-site-style>...</style>`，避免托管端漏传 CSS、错误重写 CSS 或 MIME 异常。
- 保留外部 CSS 链接作为正常路径。
- `index.html` 的生成器资源版本为 `20260914-export-style-fallback-1`。

## 验证记录

最近一次验证（2026-09-14）全部通过：

- `npm test -- --run`：3 个测试文件、49 项测试通过。
- `npm run build`：Vite 生产构建通过。
- `git diff --check`：无内容错误，仅 CRLF 警告。
- 用 JSZip 检查实际导出包：`website/index.html`、`website/contact.html`、`website/details/article1.html` 都同时包含内联样式和外部 CSS 链接。

## 线上部署诊断

用户当前域名：`https://zpxy913a.vizocean.top/`。注意此前还出现过拼写不同的 `zpxxy...`。

通过 `curl` 对当前域名的最后检查结果：

- `/` 返回 `200 text/html`，约 5,543 B，`<title>` 是 **FeastStudio**。
- `/css/style.css` 返回 `200 text/css`，约 28,597 B，确实是旧版生成 CSS。
- 首页没有 `data-generated-site-style`，所以它不是使用 CSS 兜底的新导出包。
- 首页与 CSS Last-Modified 都为 2026-09-14 01:39 UTC（北京时间约 09:39）。
- Cloudflare 响应为 `cf-cache-status: DYNAMIC`，不是简单的 Cloudflare 缓存命中。

结论：域名当前仍提供上午的旧站点，不是当前工作区的新版输出。CSS 请求实际成功，问题是宝塔部署内容或网站根目录不对。

用户应在宝塔中：

1. 网站设置中确认 `zpxy913a.vizocean.top` 的真实网站根目录。
2. 在该根目录直接打开 `index.html`，确认标题和 `data-generated-site-style`；新版首页一般大于 30 KB。
3. 将旧根目录改名备份后，上传工具原生导出的 ZIP（不要用旧目录重新压 RAR）。
4. 把 ZIP 中 `website/` 内的内容直接解压到根目录，目录应直接包含 `index.html`、`css/`、`js/`、`details/`、`images/`，不能多出一层 `website/`。

## 最新讨论：广告标签

用户看见广告创意加载后仍有 `advertisement`，希望删除。

当前 `AD_TEMPLATES`（`批量建站工具/js/generator.js`）仍写有小写单数 `advertisement`，**尚未更改**。

不要直接移除。Google AdSense 要求用户能清晰区分内容与广告；广告上方允许的标签是 `Advertisements` 或 `Sponsored Links`。若用户要求视觉优化，建议改为低调的复数 `Advertisements`：小字号、低对比度、适度间距，不能用箭头、动画或诱导点击元素。

官方参考：

- https://support.google.com/adsense/answer/1346295?hl=en
- https://support.google.com/adsense/answer/1282097?hl=en-EN

## 下一步建议

等待用户的明确后续请求。若继续处理广告标签，先说明合规原因，再改为弱化的 `Advertisements`，不要完全删除。

如果用户授权同步桌面副本，先限定范围；不要递归覆盖。可能涉及 `index.html`、`css/tool.css`、`js/app.js`、`js/generator.js`，以及它们依赖的 `js/differentiated-builder.js` 和 `shared/`。

## 工具备注

- 本会话的 CUA 浏览器一度报 `nodeRepl.fetch request failed`；PowerShell `curl.exe` 可用并已用于线上诊断。
- 可用 `curl.exe -I https://zpxy913a.vizocean.top/` 与 `/css/style.css` 核验远端实际内容。
