# SiteFoundry 批量资讯站生成器

这是一个完全在浏览器本地运行的中文工作台，用来把英文文章 JSON 和本地图片 ZIP 转换为可部署的静态网站。它提供质量风险检查和递审导出门禁，但不保证 Google AdSense 审核通过。

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

## 使用流程

1. 导入 JSON，或导入含一个 JSON 与 `images/` 的 ZIP。
2. 工具在浏览器本地分析字段名和内容样本，自动推荐内容领域、显示置信度与命中依据；识别不准时可手动修正。
3. 检查字段映射。支持 JSON 数组、`{"articles": [...]}` 和 `{"data": [...]}`。
4. 从当前领域专属的 5 套页面蓝图中选择方案，再调整品牌、结构、配色和组件样式；实时预览支持全屏查看，并可继续切换桌面、平板和手机尺寸。
5. 确认配置并导出静态网站 ZIP。

## 差异化精品建站（1.0.1 开发中）

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

```bash
npm run fixtures
npm test
npm run build
```

`examples/development-sample.json` 是脚本生成的合成测试数据，明确缺少真实作者、日期和来源，必须被递审门禁阻止。它不可发布，也不可用于 AdSense 递审。

自动化覆盖 JSON 三种结构、本地图片 ZIP、Markdown/XSS 清洗、599/600 词边界、34/35 篇边界、重复正文、改名重复图片、重复 slug、四个主题静态详情页、预渲染正文和生成后内部链接检查。

## 导出目录

ZIP 中包含首页、分类页、每篇文章独立目录页、About、Contact、Privacy、Terms、404、站内 CSS/JS/图片、favicon、robots、sitemap、HTML/JSON 审计报告和公开站点配置。只有真实 `ads.txt` 记录与 Publisher ID 匹配时才会输出 `ads.txt`。

## 已知限制

- 浏览器跨域策略阻止工具可靠读取所有外链 HTTP 状态，因此来源相关性和可达性必须由站长逐项人工确认。
- SHA-256 能发现相同文件和改名副本；8×8 平均哈希只能筛出部分视觉近似图片，不能代替逐图版权与相似性审核。
- 文本相似度、重复度、词数和危险模式是确定性风险规则，不能自动证明文章事实真实、原创、有帮助或符合法律要求。
- 自动生成的 Privacy 与 Terms 是可编辑起点，不构成法律意见。分析工具、Cookie、表单、广告、第三方嵌入和目标地区变化后必须重新复核。
- AdSense 政策和产品流程会变化；发布前必须重新核对 Google 官方资料。当前实现依据包括 [网站未准备好展示广告](https://support.google.com/adsense/answer/12176698?hl=en)、[隐私政策必需披露](https://support.google.com/adsense/answer/1348695?hl=en)、[广告位置最佳实践](https://support.google.com/adsense/answer/1282097?hl=en)、[CMP 要求](https://support.google.com/adsense/answer/13554020?hl=en-GB)、[ads.txt 指南](https://support.google.com/adsense/answer/12171612?hl=en)、[垃圾内容政策](https://developers.google.com/search/docs/essentials/spam-policies)、[以用户为先的内容](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)、[生成式 AI 内容指南](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content?hl=en)、[图片 SEO](https://developers.google.com/search/docs/appearance/google-images)、[Sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) 和 [Canonical](https://developers.google.com/search/docs/crawling-indexing/canonicalization)。
