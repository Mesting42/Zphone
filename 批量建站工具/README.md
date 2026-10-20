# SiteFoundry 批量资讯站生成器

当前源码版本：**1.1.2**。

本版新增“广告模板复用”：保留已加广告静态模板的布局、导航、页脚与公共页，替换内容、主题配色和广告单元；支持 JSON/图片 ZIP 或另一份静态站 ZIP，按新内容数量生成详情页，并可使用新 TXT 的域名导出。版本按用户确认的顺序编号：`1.0.0 → … → 1.0.9 → 1.1.0 → 1.1.1 → 1.1.2`。详情见 [1.1.2 发布说明](docs/release-1.1.2.md) 和 [版本编号映射](docs/version-numbering-2026-10-20.md)。本次不重打安装包，既有 Windows/Android 1.0.1 包保留原身份。

这是一个完全在浏览器本地运行的中文工作台，用来把英文文章 JSON 和本地图片 ZIP 转换为可部署的静态网站。它提供质量风险检查和递审导出门禁，但不保证 Google AdSense 审核通过。

## 独立资讯模板开发

科技领域新增“科技·纸墨杂志”独立模板，预览和导出复用原生成器与广告流程。
新增 8 套参考本地资讯站的完整视觉模板，所有领域均可选择：田野·纸感编辑、像素·青蓝媒体、森绿·现代品牌、荧绿·工业观察、浅森·生活编辑、绿光·深色阅读、青绿·图像图鉴、纸墨·印刷杂志。每套包含独立导航、首页、列表、阅读页与页脚呈现；选择时应用默认配色，随后仍可换色。
两端工作台的模板与配色选区默认折叠，标题旁显示当前选择，支持键盘展开和收起；差异化选区采用相同行为。
运行 `npm run template:new -- my-template "模板名称" --domain tech` 可创建并自动登记新模板。
配置协议、目录所有权和广告兼容要求见 [独立模板开发说明](docs/template-packages.md)。

## 游戏建站

首页“游戏建站”入口已将原游戏站工具并入当前发布包。该工作流提供内置游戏源、开源本地游戏目录、自定义 JSON/ZIP/RAR/7Z 导入、封面和本地游戏文件打包、IndexedDB 本地目录保存、实时预览以及静态网站 ZIP 导出。它与资讯建站共用同一部署与构建产物，但保留独立运行时，避免两套生成器的状态相互干扰。

## 启动

需要 Node.js 20.19+ 或 22.12+。

```bash
npm install
npm run dev
```

浏览器打开终端输出的本地地址。生产构建和本地预览：

```bash
npm run build
npm run preview
```

### 离线运行

当前本地改造保留 SiteFoundry 图标和标题。完成生产构建后，可运行：

```bash
npm run offline:start
```

浏览器打开 `http://127.0.0.1:5174/`。请先关闭占用同一端口的开发预览。
也可以将完整 `dist` 文件夹复制到已安装 Node.js 的设备，运行其中的
`start-sitefoundry.cmd`；启动时无需 npm、依赖安装或互联网。必须通过本机
HTTP 服务打开，不能双击 HTML。自定义广告模板保存在用户目录的
`.sitefoundry/ad-templates`，首次启动从分发包初始化，后续重建不会覆盖。

工具自带的解压组件、字体和品牌资源均在本地。导入素材中的远程图片、
外部游戏和广告/统计服务保留原地址；离线且发现这些依赖时显示提示，
联网时隐藏。字体维护命令 `npm run fonts:vendor` 需要联网，普通构建和运行不执行它。
改造与验证范围见 [离线版说明](docs/offline-2026-10-13.md)。

## 使用流程

1. 导入 JSON，或导入含一个 JSON 与 `images/` 的 ZIP。
2. 工具在浏览器本地分析字段名和内容样本，自动推荐内容领域、显示置信度与命中依据；识别不准时可手动修正。识别领域页面的上一步、下一步操作栏固定在视口底部，滚动长列表时始终可用。
3. 检查字段映射。支持 JSON 数组、`{"articles": [...]}` 和 `{"data": [...]}`。
4. 从当前领域专属的 5 套页面蓝图中选择方案，再调整品牌、结构、配色和组件样式；实时预览支持全屏查看，并可继续切换桌面、平板和手机尺寸。
5. 确认配置，直接在浏览器生成并下载完整静态网站 ZIP，无需 Python 环境。普通建站的导出包包含首页、全部详情页、样式、脚本及数据；添加广告后同时包含所配置的广告运行时。

## 成品站加广告与源码导出

上传完整源码压缩包和对应的广告 TXT，配置广告版本与位置后，在第三步选择导出内容：

- **静态站点副本**：仅导出加入广告后的页面、脚本和资源，用于直接部署。
- **含广告的完整源码**：保留原工程文件及广告配置，方便继续修改和重新构建。

下载 ZIP 和写入新目录均使用当前选择。对于包含 `package.json`、`scripts.build` 和独立构建输出目录的静态源码工程，源码副本会把自动注入步骤接入 `postbuild`，保留原有命令。执行 `npm run build` 后，广告会重新写入 `dist` 等输出目录；部署该目录中的内容。注入辅助代码已包含所需运行代码，无需为原工程新增 npm 依赖。

直接编写 HTML 的工程会直接加入广告页面与脚本。React 源码需要在原项目环境完成生产构建；上传包包含有效构建产物时可选择静态导出，没有产物时界面会提示导出完整源码。构建输出与源码处于同一根目录的 Node 工程须先配置独立输出目录，才能安全接入自动注入步骤。

## 批量广告策略

首页的“批量广告策略”是独立工具，不需要重走 5 步建站流程：

1. 推荐直接选择包含多个站点文件夹的总目录，不必把十几个站点逐个压缩；仍兼容多选 `.zip`、`.tar.gz`、`.tgz`。
2. 工具从源站现有及已注释的 `bannerPath1/2/3`、`interstitialPath`、`anchorPath` 和 GA 配置中自动提取原广告单元，不需要额外上传 TXT。
3. 先设置一套应用于全部站点的全局方案，再为少量特殊站点开启“单站覆盖”。首页与详情页各有广告位 1/2/3，每个广告位都能同时选择显示位置和使用的 `banner1`、`banner2`、`banner3`（或关闭），例如把头部广告位从 banner1 直接改成 banner3；插屏与锚点也可分别控制首页和详情页。
4. 内置“完全恢复默认广告”“强限流：首页头部仅 banner3”“首页头尾：banner1 + banner3”三个快速方案，也可以自由组合。
5. 关闭广告时不会删除广告路径：路径保留在 `js/ad.js` 和新生成的 `ad-policy.json` 中。默认还会把关闭的 banner 写成 HTML 源码注释，并在 `ad.js` 中写明被关闭的插屏/锚点页面范围。
6. 默认选择一个输出位置并创建全新的带时间站点总目录，不覆盖源文件；不支持目录写入的浏览器会自动下载一个批量 ZIP。无法可靠识别或校验失败的站点不会进入输出结果。

处理过程仅调整广告容器、GPT/`ad.js` 引用、动态首页广告映射和 `js/ad.js`，其他 HTML、CSS、JS、JSON 及图片文件原样保留。处理全程在当前浏览器内完成。

如果只需要取回广告配置，可使用“仅识别并导出广告代码”：它不修改站点。单站导出可重新上传到普通建站流程的 `.txt`；多站导出包含多个 TXT 的 ZIP。

## 差异化精品建站（1.0.2）

首页新增第三种建站方式。该模式仍然以上传 ZIP/JSON 数据源为入口，但每个上传包独立确定领域、读者、栏目、来源规则、设计家族和确定性种子，不把原有 32 个领域目录当作限制。它支持：

- 资讯站：至少 40 篇（建议 40–50 篇）、每篇正文至少 600 个可见英文单词、唯一本地封面、来源与事实核验硬门禁；
- 工具站：至少 25 个真实运行的工具，每项具有输入/输出示例、说明、限制与错误状态；
- 草稿、递审版、过审后广告版三档静态导出；
- 设计历史和设计指纹，用构图与内容节奏变化降低批量站点的同质化；
- 全英文输出、静态 SEO、法律页、404、审计报告、内容来源记录和设计参考记录。

完整结构与字段见 [差异化精品建站数据包规范](docs/differentiated-site-package.md)。

当前可识别 32 个领域，覆盖科技、游戏、美食、动漫、财经、健康、旅游、体育、汽车、教育、时尚、家居、娱乐、影视、音乐、图书、科学、环境、时政、法律、房产、职场、营销、电商、宠物、母婴、户外、摄影、历史、农业和能源，并提供通用资讯兜底。领域选择器支持中英文搜索。识别过程不上传文件；分类器综合专属字段以及标题、分类、摘要、正文中的中英文关键词打分。

递审版与广告版的核心门禁包括：至少 35 篇有效文章；每篇最终可见英文正文至少 801 词；内容与封面不重复；本地封面可解码且有宽高、哈希和权属确认；作者、真实日期、来源、事实核验者与核验日期完整；四个信任页面与 Footer 链接存在；生成后内部链接错误为零。

## 输入字段

常用字段为 `title`、`content`、`image`、`image_alt`、`excerpt`、`category`、`slug`、`author`、`published_at`、`updated_at`、`sources`、`fact_checked_by`、`fact_checked_at`、`cover_image_source`。`sources` 可以是 HTTPS URL 数组、逗号分隔字符串或换行分隔字符串。

ZIP 示例：

```text
upload.zip
├── data.json
└── images/
    ├── descriptive-cover.svg
    └── another-cover.webp
```

## 测试

Windows 与安卓手机 / 平板安装应用的构建、使用和本机源码构建说明见 [安装应用说明](apps/README.md)。各端共用当前建站核心，构建依赖与安装产物位于独立的 `apps/` 目录。

```bash
npm run fixtures
npm test
npm run build
```

`examples/development-sample.json` 是脚本生成的合成测试数据，明确缺少真实作者、日期和来源，必须被递审门禁阻止。它不可发布，也不可用于 AdSense 递审。

自动化覆盖 JSON 三种结构、本地图片 ZIP、Markdown/XSS 清洗、599/600 词边界、34/35 篇边界、重复正文、改名重复图片、重复 slug、四个主题静态详情页、预渲染正文和生成后内部链接检查。

## 导出目录

ZIP 中包含首页、分类页、每篇文章独立目录页、About、Contact、Privacy、Terms、404、站内 CSS/JS/图片、favicon、robots、sitemap、HTML/JSON 审计报告和公开站点配置。只有真实 `ads.txt` 记录与 Publisher ID 匹配时才会输出 `ads.txt`。

## 视口渐显与卡片交互

普通建站、游戏建站、批量建站和广告移植建站默认启用视口渐显与卡片悬浮交互。在“配置网站 → 样式”可分别关闭，设置领域圆标、装饰箭头及光晕颜色（主题色、七种预设、自定义颜色）。模板切换保留这些偏好。开发接入、广告边界和验证说明见 [视口渐显与卡片交互](docs/site-motion.md)。

## 已知限制

- 浏览器跨域策略阻止工具可靠读取所有外链 HTTP 状态，因此来源相关性和可达性必须由站长逐项人工确认。
- SHA-256 能发现相同文件和改名副本；8×8 平均哈希只能筛出部分视觉近似图片，不能代替逐图版权与相似性审核。
- 文本相似度、重复度、词数和危险模式是确定性风险规则，不能自动证明文章事实真实、原创、有帮助或符合法律要求。
- 自动生成的 Privacy 与 Terms 是可编辑起点，不构成法律意见。分析工具、Cookie、表单、广告、第三方嵌入和目标地区变化后必须重新复核。
- AdSense 政策和产品流程会变化；发布前必须重新核对 Google 官方资料。当前实现依据包括 [网站未准备好展示广告](https://support.google.com/adsense/answer/12176698?hl=en)、[隐私政策必需披露](https://support.google.com/adsense/answer/1348695?hl=en)、[广告位置最佳实践](https://support.google.com/adsense/answer/1282097?hl=en)、[CMP 要求](https://support.google.com/adsense/answer/13554020?hl=en-GB)、[ads.txt 指南](https://support.google.com/adsense/answer/12171612?hl=en)、[垃圾内容政策](https://developers.google.com/search/docs/essentials/spam-policies)、[以用户为先的内容](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)、[生成式 AI 内容指南](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content?hl=en)、[图片 SEO](https://developers.google.com/search/docs/appearance/google-images)、[Sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) 和 [Canonical](https://developers.google.com/search/docs/crawling-indexing/canonicalization)。
