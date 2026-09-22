# 当前会话交接文档（2026-09-19）

## 目的与工作区

- 当前工具工作区：`D:\Min\建站工具\批量建站工具`
- Git 根目录：`D:\Min\建站工具`
- 当前会话重点已从界面打磨转为：排查已部署站点 `zpls918b.fintriza.top` 的广告为什么不展示。
- 工作区本来就有大量未提交的界面、游戏建站工具和广告相关改动。**不要使用 `git reset --hard`、`git checkout --` 或清理未追踪文件**；应在现有改动基础上继续。

## 最近完成的主要工作

### 界面与建站流程

- 已为主工具和 `game-builder/` 接入共享的液态玻璃样式 `css/liquid-glass.css`，并改造工作流卡片、顶部步骤、操作坞、图标与滚动条。
- 工作流步骤连接线改为只在前一步完成后显示，避免提前显示“下一步”的流程线。
- 底部操作坞改为居中；“上一步”“重新上传”“下一步”等按钮共用悬浮交互，相关实现位于 `js/jelly-button.js`。
- 游戏建站流程已迁入 `game-builder/`，使用同一套视觉和广告导出逻辑。

### 广告导出运行时

此前导出的 `js/ad.js` 会生成无效 JavaScript：

```js
var isDetail = //(?:details?|articles?)//i.test(window.location.pathname);
const adPolicy = null;
```

这会在浏览器报 `Unexpected token 'const'`，并中断全部 GPT 广告逻辑。已在下列文件中改为不用正则的路径分段判断，生成的运行时能够通过 `new Function()` 解析：

- `js/generator.js`
- `game-builder/js/generator.js`

为避免站点 CDN/浏览器缓存旧版 `ad.js`，导出 HTML 改为带版本查询参数：

```html
<script defer src="js/ad.js?v=20260918-ad-runtime-fix-2-…"></script>
```

详情页对应 `../js/ad.js?...`。版本值由广告路径哈希生成；导出运行时代码变更时，必须同步提高 `AD_RUNTIME_CACHE_VERSION`，否则相同路径仍可能复用旧 CDN 缓存。

验证逻辑也已改为接受版本查询参数：

- `js/ad-migration.js`
- `game-builder/js/ad-migration.js`

回归测试已覆盖导出 runtime 的语法有效性和版本化路径：

- `tests/ad-migration.test.js`
- `tests/game-builder.smoke.cjs`

最后一次已知验证结果（缓存版本改动后）：

```powershell
npm test       # 73 tests passed，5 个测试文件
npm run build  # 通过
git diff --check # 通过；只有 LF/CRLF 提示
```

本地开发服务此前使用：

```powershell
npm run dev -- --port 5173
```

当前交接时未确认 5173 是否仍在监听；如需要请重新启动。不要动可能由 VS Code Live Server 占用的 5502 端口。

## 最新线上排查：`zpls918b.fintriza.top`

用户最新请求是“`zpls918b.fintriza.top` 这个广告显示不出来，帮我排查下”。以下是已完成且可复核的结论。

| 项目 | 结论 | 证据/说明 |
| --- | --- | --- |
| 首页与运行时 | 正常返回，`ad.js` 当前为修复后的语法 | 页面引入 `js/ad.js?v=20260918-ad-runtime-fix-2-ddn5vn`；其中使用 `detailPathSegments`，不再有错误的 `//` 正则。 |
| GA | 已配置 | 运行时含 `analyticsID = "G-GLHVJ8MHDB"`。 |
| 广告容器 | 已生成 3 个 300×250 容器 | `div-gpt-ad-banner1/2/3` 均存在。 |
| GPT | 已加载且可用 | `googletag.apiReady === true`、`pubadsReady === true`。 |
| `ads.txt` | 当前 404 | `https://zpls918b.fintriza.top/ads.txt` 返回 HTTP 404。它是投放/审核配置问题，非本次横幅初始化不执行的直接原因，但必须让运营/广告平台提供正确内容后发布。 |
| 普通横幅未初始化 | **当前最主要的前端问题** | 页面 `document.readyState` 长时间停在 `interactive`；导出 runtime 把 `delayLoadBanner(...)` 放在 `window.addEventListener('load', ...)` 内。页面上的延迟图片使 `load` 事件迟迟不触发，因此 banner1/2/3 根本没有被定义。 |

### 关键现场验证

在真实浏览器中，首次加载时只看到插屏和锚定广告的 GPT slot；横幅 slot 没有被创建，也没有横幅广告请求。手动执行导出 runtime 的以下初始化后：

```js
delayLoadBanner('bannerSlot1', bannerPath1, 'div-gpt-ad-banner1');
delayLoadBanner('bannerSlot2', bannerPath2, 'div-gpt-ad-banner2');
delayLoadBanner('bannerSlot3', bannerPath3, 'div-gpt-ad-banner3');
```

GPT 的实测返回如下：

- `bannerSlot2`：`isEmpty: false`，尺寸 `[300, 250]`
- `bannerSlot3`：`isEmpty: false`，尺寸 `[300, 250]`（滚动至视口后）
- 插屏：`isEmpty: false`
- `bannerSlot1`：`isEmpty: true`
- 锚定广告：`isEmpty: true`

这说明广告服务器对至少 banner2 / banner3 **有可投放素材**；主要故障是页面因等待整个 `window.load` 而没有启动横幅观察器，不是 GA ID 或 GPT 账户完全无填充。

## 建议新会话优先完成的修复

1. 在下列两个生成器中找到生成 `window.addEventListener('load', function () { delayLoadBanner(...); ... })` 的广告模板：
   - `js/generator.js`
   - `game-builder/js/generator.js`
2. 改为在 DOM 可用后初始化横幅观察器，不要等待全页资源完成。推荐做成一次性函数：

```js
var bannerObserversInitialized = false;
function initializeBannerObservers() {
  if (bannerObserversInitialized) return;
  bannerObserversInitialized = true;
  delayLoadBanner('bannerSlot1', bannerPath1, 'div-gpt-ad-banner1');
  delayLoadBanner('bannerSlot2', bannerPath2, 'div-gpt-ad-banner2');
  delayLoadBanner('bannerSlot3', bannerPath3, 'div-gpt-ad-banner3');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeBannerObservers, { once: true });
} else {
  initializeBannerObservers();
}
```

导出脚本使用 `defer`，通常已在 DOM 解析后执行；无论采用直接调用还是 `DOMContentLoaded`，都要确保不重复定义 slot。

3. 因为生成的 `ad.js` 内容会改变，必须把两个生成器内的 `AD_RUNTIME_CACHE_VERSION` 从 `20260918-ad-runtime-fix-2` 提升为新的版本（例如 `20260919-ad-runtime-init-1`），确保重新导出的 HTML 请求全新 URL。
4. 增加/更新回归测试，至少断言导出 runtime 不再包含 `window.addEventListener('load'` 的横幅初始化，并继续通过 `new Function(generatedAdRuntime)`。
5. 执行：

```powershell
npm test
npm run build
git diff --check
```

6. 请用户重新导出并部署 `zpls918b.fintriza.top`，在 Cloudflare/CDN 做对应缓存刷新（或依赖新版带 `?v=` 的路径），再用真实浏览器确认 banner2/3 的 `slotRenderEnded` 与可见渲染。
7. 另行提醒运营补齐根路径 `/ads.txt`。这不能替代上述代码修复。

## 非阻断但可跟进事项

- Chrome 控制台出现 `pubads_impl.js` 对 `enableSingleRequest` 的弃用提示；目前不影响广告请求。若要处理，应先核对当前 GPT 官方用法，再将其替为推荐的 `googletag.setConfig({ singleRequest: true })`，不要和本次核心修复混在一起而失去验证边界。
- `/favicon.ico` 404 不影响广告投放。
- 用户之前在其他站点看到的 `Unexpected token 'const'` 已由 runtime 语法修复和 cache-busting 解决；重新部署时应始终通过工具重新导出，不要只手工覆盖旧 `ad.js`。

## 当前变更状态提醒

`git status --short` 显示主工具、游戏建站工具和新样式文件都有未提交改动，包括但不限于：

- `README.md`
- `css/tool.css`、`css/liquid-glass.css`
- `index.html`
- `js/app.js`、`js/generator.js`、`js/ad-migration.js`
- `js/jelly-button.js`
- `game-builder/`
- `tests/ad-migration.test.js`、`tests/game-builder.smoke.cjs`
- `package.json`、`vite.config.js`

这些改动中不少来自连续 UI 需求，不能假定都是本次广告排查新增。继续修改时仅处理与当前问题相关的代码，保留其他用户改动。

