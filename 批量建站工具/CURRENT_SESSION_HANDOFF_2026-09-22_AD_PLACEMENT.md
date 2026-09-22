# 当前会话交接：成品站加广告的自由广告位

## 工作区与协作边界

- 当前实际工作区：`C:\Users\zyt\.codex\worktrees\1a60\建站工具\批量建站工具`
- 不要在启动目录 `D:\Min\建站工具\批量建站工具` 直接修改；该目录不是本会话工作树。
- 工作树在本次工作开始前已处于脏状态。不要重置、清理或覆盖不相关改动，也不要提交，除非用户明确要求。
- 用户尚未要求部署、提交或导出文件。

## 用户目标

“成品站加广告”工作流必须能服务于静态站、React 源码站、资讯站、游戏站和工具站，而不能为当前 HAMSTATION 工具站写死逻辑。

当前最紧急的问题：用户在成品站广告配置的预览中点“选择位置”后，希望**只要鼠标位于页面中可见的纵向留白，就能出现一条“＋ 点击放置广告”并插入广告**。用户不希望预览默认铺满候选条，也不接受点击候选条导致原页面布局重排。

用户最近截图的位置是工具列表两行卡片之间的网格行间留白（第 2、3 行之间）。此前多次改动后，用户仍反馈“放不了”。必须优先做真实交互复现，而不要继续仅凭静态测试宣称修复成功。

## 已完成的重要功能（本会话及此前连续工作）

- 修复预览中内部导航点击被带回建站工具的问题，支持站内路由预览。
- 成品站加广告工作流支持上传完整源码：
  - 静态站直接导出修改后的静态文件；
  - React 源码站导出注入广告后的完整源码工程，不在浏览器执行 `npm install` / `npm run build`；用户本地构建后部署 `dist` / `build` 等输出。
- 支持不同站点形态，不以工具站页面名称或固定页面结构作为唯一规则。
- 已经处理过详情页广告 2 应置于内容中部、广告 3 接近页脚前等问题。
- 自定义广告容器已尝试相对整页居中，相关运行时也同步修改过：
  - `js/ad-restoration.js`
  - `js/generator.js`
  - `js/react-source-ad-injector.js`
- 本轮引入了“不参与文档流”的预览选择层，目的是替代旧版实际插入的虚线占位条，避免选择阶段把卡片和正文顶开。

## 当前自由放置实现状态

关键文件：`js/app.js`

- `collectAdInjectionCustomPlacements(root)`：约第 1099 行。
  - 以广度优先遍历收集 `custom-after-<path>` 结构路径。
  - 当前最大深度 9、最大候选数 2400，目的是避免深层正文/网格被首屏复杂节点耗尽。
- `mountAdInjectionPlacementOverlay(doc, page, candidates)`：约第 1143 行。
  - 在 `srcdoc` 预览 iframe 内生成一个 `position: fixed` 覆盖层；不再向上传站的内容 DOM 插入选择条。
  - 默认只有一个隐藏按钮；`pointermove` / `mousemove` 到达候选空隙时才显示“＋ 点击放置广告”。
  - `rowBounds()` 合并同一网格行的范围，理论上能把卡片行间变成整行可点击区域。
  - `fallbackAt(event)` 是最新添加的视觉留白回退：若预先计算的空隙未命中，会从鼠标上方的可见锚点找插入位置。
  - 成功点击会 `postMessage({ type: 'ad-injection-place', position, page }, '*')` 给父页，由已有监听写入 `adInjectionPolicy`。
- `addAdInjectionPlacementMarkers(...)`：约第 1204 行。名称保留，但现在只装载覆盖层，不应实际插入 marker 节点。
- 操作提示位于约第 1416 行，文字为鼠标移到留白处后再点击。
- `index.html` 当前 app 缓存参数：`js/app.js?v=20260922-custom-gap-placement-8`（约第 1221 行）。后续改 `app.js` 必须继续递增该版本值，避免用户测试到缓存旧逻辑。

## 重要风险 / 当前未确认问题

1. 用户在 `custom-gap-placement-8` 前后仍反馈卡片网格行间无法放置。静态测试和构建通过，但没有完成端到端交互验证。因此不要把现有实现视为已验收。
2. 要用实际成品站预览复现，尤其是：
   - 工具详情页中 `How it works` / `How to use` / FAQ 之间的留白；
   - `/tools` 全部工具页两行卡片之间的留白。
3. 需要检查 iframe 内是否真的加载了覆盖层、是否存在控制台异常、以及 `pointermove` 是否能到达 `srcdoc` 文档。
4. 如果结构路径插入到 CSS grid 的直接子节点，导出的广告容器可能成为一个普通网格单元。需要确认导出运行时是否给该容器设置 `grid-column: 1 / -1` 或采用不会破坏网格顺序的包装方式。这个问题尚未完整验证。
5. 旧参考项目仅可借鉴交互目标，不能复制其实现：旧版 `legacy/js/generator.js` 的 `genMarker` 把 marker 插入 DOM，正是选择时布局跑偏的原因。

## 推荐下一步（按顺序）

1. 启动本工作树的本地服务，例如 `npm run dev -- --host 127.0.0.1 --port 5190`。结束后关闭自己启动的临时服务。
2. 使用用户此前提供的无线电工具站构建产物或无敏感测试站，完整走“成品站加广告”流程，进入预览后选择 banner2。
3. 在 iframe 里确认：
   - `#sitefoundry-ad-placement-overlay` 是否存在；
   - `data-sitefoundry-placement-anchor` 是否被写入工具卡片；
   - 在两行卡片间移动鼠标时 `button.hidden` 是否变为 `false`；
   - 点击按钮后父页的 banner2 位置摘要是否更新。
4. 若失效，不要继续盲增候选数。优先修正真实根因：事件监听、iframe 坐标、结构锚点路径，或网格行检测。
5. 添加实际行为测试（最好是浏览器/DOM 测试），覆盖“网格第二行和第三行之间可点选”和“默认不显示所有 marker”。
6. 完成后运行：

   ```powershell
   npm test
   npm run build
   git diff --check
   ```

## 最近验证结果

在最后一次代码修改后执行成功：

- `npm test`：10 个测试文件，153 项测试通过；包含 differentiated copies 与 generator smoke。
- `npm run build`：成功。Vite 仅输出既有的非模块脚本提示和大 chunk 警告。
- `node --check js/app.js`：通过。
- 从 `mountAdInjectionPlacementOverlay` 提取生成的 iframe 脚本后用 `new Function(...)` 解析通过，且包含 `fallbackAt`。
- `git diff --check`：无格式错误；仅出现既有 CRLF 警告。

## 测试与相关文件

- `tests/batch-ad-ui-static.test.js`
  - 当前是字符串/静态保护测试；已断言 hover 覆盖层、`fallbackAt`、`mousemove`、不使用 `parentNode.insertBefore(marker)`。
  - 它不能替代真实浏览器鼠标交互验证。
- `tests/ad-restoration.test.js`
- `tests/react-source-ad-injector.test.js`
- `tests/ad-injection-preview-router.test.js`
- `js/ad-restoration.js`
- `js/react-source-ad-injector.js`
- `js/generator.js`

## 用户可参考的原站目录

用户此前给出的已部署无线电工具站源码目录：

`C:\Users\zyt\Desktop\project-zlm\资讯站\8月站\资讯站\无线电工具站`

其中工具详情原始源码位于：

`src\routes\tools_.$toolId.tsx`

它的结构显示：内容区域为 `.min-w-0.space-y-10`，包含“Tool / How it works / How to use / FAQ”等连续 section；工具列表为网格卡片。它适合作为真实复现样本。

## 协作口径

- 用中文和用户沟通。
- 先说明实际证据，再说结论；用户已经多次遇到“声称修复但仍不可用”，必须避免没有浏览器验证就写“已修复”。
- 用户要的是自由度：所有真实纵向空白均应能成为广告插入点；但不可在预览阶段显示满屏候选条，也不可令预览布局重排。
