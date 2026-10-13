# 独立资讯模板开发（内容样式与完整视觉）

唯一仓库根目录：`D:\Min\建站工具`。应用目录：`D:\Min\建站工具\批量建站工具`。实现时分支为 `main`；本地预览端口为 `5174`，从应用目录执行 `npm run dev -- --host 127.0.0.1 --port 5174 --strictPort`。开始修改或运行前执行 `git rev-parse --show-toplevel` 核对仓库。

## 范围与协议版本

独立包用于普通资讯建站，也能随该生成器进入批量建站和广告移植流程。游戏建站、差异化建站继续使用各自的原模板。领域包追加到对应领域；v2 的 `domainId: "*"` 包追加到全部 36 个领域。原模板 ID、排序和默认选择保持原样。

v1 提供**基于现有布局的独立内容样式包**，继续兼容科技·纸墨杂志与原创建命令。v2 提供**完整视觉包**，独立维护导航、页脚、首页、列表及详情呈现；站点数据、真实链接、图片路径、广告解析和插入继续由原生成器负责。不提供第三方模板上传。

## 创建和登记

```powershell
Set-Location -LiteralPath 'D:\Min\建站工具\批量建站工具'
git rev-parse --show-toplevel
npm run template:new -- field-journal "田野日志" --domain environment
```

使用 `js/data.js` 中现有的领域 ID。命令建立新目录，发现同名目录立即失败；然后自动生成注册文件。其他已有包不会被覆盖。创建后如果配置校验失败，保留新包供修正，原注册文件保持原样。

```text
templates/field-journal/
  template.json    名称、版本、领域、基础布局、默认样式
  home.js          首页内容样式
  detail.js        详情页内容样式
  all.js           全部文章页内容样式
  thumbnail.svg    选择器缩略图
  README.md        模板接手说明
```

`scripts/build-template-packages.mjs` 自动发现完整目录，无须新增 HTML script 标签或修改 app.js。以下划线开头的目录不参与登记。修改模板后运行 `npm run templates:build`；`npm run dev` 和 `npm run build` 会先运行该命令。开发服务器运行期间新增模板后也要运行该命令，重载工具会清空当前上传状态，应先保存工作。

## 配置与页面规则

`template.json` 的 `schemaVersion` 为 1 或 2。`id` 必须与目录名一致，只使用小写英文、数字和中划线。模板 `version` 独立于工具版本及广告版本。`baseLayout` 引用 `js/template-catalog.js` 中的已有布局。以下内容样式白名单约束适用于 v1。

允许的 structure/style 字段由 `template-system/registry.js` 的白名单定义；未知字段会阻止构建。模板不配置广告路径、广告开关、GA、正文或图片数据，也不保存广告恢复记录。

页面模块导出声明式规则，例如：

```js
/** 仅调整正文段落，不改动可能包含广告的正文外层。 */
export const rules = [
  {
    selector: '.detail-content > p',
    declarations: { 'font-size': '18px', 'line-height': '1.8' }
  },
  {
    selector: '.detail-content > p',
    maxWidth: 720,
    declarations: { 'font-size': '17px' }
  }
];
```

选择器和属性都通过白名单检查。规则自动限定在 `body[data-template-package="模板ID"]` 内；不允许给广告容器或可能包含广告的布局祖先添加裁切、变换、隐藏、重排等规则。白名单降低意外改动风险，仍须检查实际输出。源码包是仓库内受信任的开发文件，此机制不是任意第三方代码的沙箱。

## 执行链路与所有权

1. 原 template-catalog/layouts/data 脚本建立原有目录。
2. 生成的 `js/template-packages.js` 校验所有包，追加预设，并安装小型兼容适配层。
3. 非独立包调用直接委托原布局函数。独立包复用基础布局，仅追加包标识和内容样式。
4. Generator 继续负责三类页面的广告插入，广告模块继续负责 TXT、单元、GA、策略和恢复。
5. 预览和导出读取同一包和同一套原生成器。

`js/template-packages.js` 是生成文件，应与模板源一起提交，但不要手改。`template-system/` 负责协议、发现与适配；`scripts/` 负责创建和打包；`templates/` 由模板开发者维护。注释、模板 README 和本文共同说明接手入口。

### 分类标题编号偏好

资讯工作台的“样式配置”在图标开关旁提供“显示分类标题编号”，新配置默认关闭。站点保存 `config.categoryNumbersEnabled`，资讯生成器统一转换为 `style.categoryNumbersEnabled === true`；缺少字段也按关闭处理。普通、批量和广告移植的预览与导出经过同一转换，批量继续使用各站自己的配置快照。

此字段属于操作人员的显示偏好，模板切换与随机组装不能覆盖它，也不写入模板默认值白名单。旧蓝图在 `js/template-layouts.js` 中条件生成 `.tpl-section-number`，关闭时收回编号网格列及专用边距；v2 的共享 `heading` 条件生成 `.ref-section-index`，Flex 自动收回占位。分类图标、标题文本、卡片编号与广告位置使用原有配置。

共享排版器对未传入该布尔字段的游戏调用方保持原行为。本次不扩展游戏或差异化建站的配置控件。详细实施范围与待验收边界见 [编号开关实施记录](category-heading-numbers-2026-10-12.md)。

## 验证要求

修改独立模板后，检查首页、详情、全部文章页及 1366/768/390/320px；检查图片、长标题、键盘选择、预览与真实 ZIP 导出重开。新模板的 `ad.js` 应与同领域基础配置输出逐字一致，位置、单元和页面开关应一致。

修改适配层或共享广告/生成链路后，运行必要自动化，并按当前交接要求完成六类广告工作流真实文件回归。历史证据在 `coverage/full-regression-20261010`；新回归使用新目录，保留历史证据。禁止用未运行的旧结果代替本次验证。

新增模板自动化为 `npx vitest run tests/template-packages.test.js`。真实界面检查运行 `node tests/template-packages.browser.mjs`，先设置 `PLAYWRIGHT_MODULE_PATH`（本机 Playwright）、`BUILDER_URL`、`TEMPLATE_PACKAGE_INPUT`（真实资讯数据包）和 `AD_CODE_INPUT`（匹配的真实广告 TXT）。它执行键盘选模板、三页预览、ZIP 下载和 1366/768/390/320px 重开检查；广告调用使用记录替身，不验证线上填充。

## 完整视觉包（v2）

每个 v2 包除原六个文件外，还必须提供 `shell.js`、`navigation.js`、`footer.js`。缺文件会阻止登记，保留现有生成文件。首页/详情/列表仍导出 `rules` 数组；完整视觉规则另外导出 `css` 字符串，每个选择器均以 `:scope` 开头，由注册器替换为该包的 body 标识。常规构建会解析 CSS 语法后再替换输出。

- `shell.js` 负责通用重排、全站字体与表面。
- `navigation.js` 的 `render(legacyMarkup, config)` 保留链接、菜单按钮、ARIA 目标及原响应式菜单行为，装饰品牌锁定组合；CSS 定义本包导航外观。
- `footer.js` 保留生成器的法律链接、联系字段和详情页路径修正，只增加品牌呈现。
- `home.js` 的 `heading(config, category, index)` 输出分类标题；CSS 定义首卡、网格和栏目节奏。
- `detail.js` 的 `render(html, config)` 只调整连续的图片/标题组合，不跨过广告或重排正文。它在预览与导出完成后、动效装配前执行。
- `all.js` 维护文章列表呈现，广告仍跨原网格的整行。

`template.json` 必须提供 `reference` 和九项十六进制 `palette`：`bg/secondary/surface/primary/text/muted/border/card/hover`。注册器把它登记为 `reference-模板ID` 配色主题；`style.selectedStyle` 指向该 ID。所有呈现颜色应引用现有主题变量，切换配色才能完整生效。

v2 源码是仓库内受信任的开发文件，作用域校验不是第三方代码沙箱。禁止针对广告节点、其祖先、iframe、canvas 和游戏运行区域写裁切、位移、固定高度或重排规则。不得读取、改变广告配置或 GA。共享底层在 `template-system/reference-presentation.js`，各包保留独立的导航、内容和页脚样式。

完整视觉检查：`npx vitest run tests/reference-templates.test.js` 与 `node tests/reference-templates.browser.mjs`。浏览器脚本可通过 `REFERENCE_DATA`、`REFERENCE_AD`、`REFERENCE_OUTPUT`、`PLAYWRIGHT_MODULE_PATH`、`BUILDER_URL` 指定输入和现场；`REFERENCE_UI_ONLY=1` 只检查两端折叠控件。`FILESAVER_CACHE` 可提供同版本 2.0.5 的本地传输缓存，不更改产品依赖。

## 工作台折叠控件

`js/config-disclosures.js` 与 `css/config-disclosures.css` 由两端 HTML 加载。它们包装模板/配色选区，默认折叠、展示当前选择和真实数量，以一个合并的观察器跟踪原网格重新生成与选择变化。展开状态不进入站点配置或 ZIP。收起期间内容 inert，动画结束后 hidden；减少动态效果时直接切换。普通、游戏、差异化的卡片选择逻辑仍由各自 app 所有。

本轮范围与验收入口见 [8 套参考模板与折叠控件](reference-templates-2026-10-12.md)。

`template-selectors.full.browser.mjs` 和 `template-controls.browser.mjs` 已按注册目录计算界面模板数。其他历史布局全量脚本默认保留原模板矩阵；独立包由新增检查覆盖，不能把历史矩阵结果声称为新包全部已验证。
