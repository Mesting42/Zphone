# 差异化精品建站数据包规范（schema v1）

此规范用于 `1.0.1` 新增的“差异化精品建站”。每个上传包代表一个独立网站；工具不会把上一次的领域、栏目、审计结论或设计选择带入下一次生成。

## 推荐目录

```text
site-package.zip
├── manifest.json
├── design.json
├── legal.json
├── content/
│   ├── articles/            # 资讯站：单篇 JSON 或 articles.json
│   ├── tools/               # 工具站：单项 JSON 或 tools.json
│   └── games.json           # 游戏站
├── assets/
│   ├── covers/
│   ├── icons/
│   └── fonts/
├── provenance/
│   ├── content-provenance.json
│   └── design-references.json
└── games/                   # 可选：本地静态游戏及其资源
```

ZIP 是完整规范的首选格式。单个 JSON、RAR、7z 仍可用于草稿数据导入，但只有 ZIP 能可靠携带清单、素材、来源记录和本地游戏文件。

## manifest.json

```json
{
  "schema_version": 1,
  "site_type": "editorial",
  "site": {
    "name": "The Material Ledger",
    "vertical": "Traditional textile conservation",
    "audience": "Museum educators, collectors, and craft learners",
    "scope": "Practical, source-backed English guidance about textile materials, care, and documentation.",
    "base_url": "https://publication.example.org",
    "sections": ["Materials", "Care", "Archives", "Practice"]
  }
}
```

`site_type` 可为：

- `editorial`：资讯站；
- `tools`：工具站；
- `games`：游戏站。

`vertical` 不受内置领域目录限制。每个上传包可以属于完全不同的领域，但单个网站必须保持一个连贯、明确的主题和读者范围。

## design.json

```json
{
  "family": "auto",
  "seed": "textile-conservation-autumn-01"
}
```

`family: "auto"` 会优先选择当前浏览器中尚未使用过的构图家族；相同数据和 `seed` 会得到可复现的结果。也可指定界面列出的设计家族。设计差异会影响构图、内容节奏、卡片/列表关系、排版、色彩和移动端组织，不只是换颜色。

## legal.json

```json
{
  "contact_email": "editor@publication.example.org"
}
```

必须使用发布者真实拥有并能接收邮件的地址。生成器不会虚构公司、地址、电话、团队、表单端点或响应时限。

## 资讯记录

```json
{
  "title": "A specific English article headline",
  "slug": "specific-english-article-headline",
  "standfirst": "A concise, article-specific English summary.",
  "category": "Materials",
  "content": "At least 600 visible English words in Markdown or conservative HTML...",
  "author": "Publisher editorial desk",
  "published": "2026-09-13",
  "updated": "2026-09-13",
  "fact_checked": "2026-09-13",
  "writing_assistance": "ai-assisted",
  "cover": "assets/covers/specific-english-article-headline.webp",
  "image_alt": "Accurate English description of the article cover",
  "sources": [
    {
      "publisher": "Authoritative institution",
      "title": "Exact source page title",
      "url": "https://authority.example/source",
      "source_type": "primary",
      "accessed": "2026-09-13"
    }
  ]
}
```

递审版硬门禁：

- 至少 40 篇主题明确且意图不同的文章，建议控制在 40–50 篇；超过 50 篇会提示人工复核导航与逐篇质量，但不会仅因数量阻止导出；
- 每篇正文至少 600 个可见英文单词；
- 全站用户可见内容为英文；
- 每篇有真实署名/编辑部归属、发布日期、事实核验记录和工作来源链接；
- 每篇使用不同的本地封面路径，且封面二进制内容不得重复；
- 高风险或时效性领域需要更强来源，不得用声明替代准确性；
- 不得虚构作者、经历、数据、采访、评论、测试、日期或来源。

自动检查不能证明事实为真。发布者仍需重新打开来源、逐项事实核验，并确认文字、图片和设计素材的权利。

## 工具记录

```json
{
  "title": "JSON Formatter",
  "slug": "json-formatter",
  "category": "Developer Tools",
  "description": "Format valid JSON locally in the browser.",
  "implementation": {
    "operation": "json-format",
    "options": {"spaces": 2}
  },
  "example_input": "{\"name\":\"Ada\"}",
  "example_output": "{\n  \"name\": \"Ada\"\n}",
  "instructions": "Paste valid JSON, optionally set indentation, and run the formatter.",
  "limitations": "Invalid JSON is rejected. The tool does not repair damaged data.",
  "sources": []
}
```

递审版至少需要 25 个工具。每项都必须使用受支持的本地操作、包含输入/输出示例、专属使用说明和限制，并能处理错误状态。门禁会实际执行每个示例，并核对生成结果与 `example_output` 是否一致。当前支持的操作：

`word-count`, `character-count`, `line-count`, `slugify`, `lowercase`, `uppercase`, `title-case`, `sentence-case`, `reverse-text`, `sort-lines`, `dedupe-lines`, `trim-lines`, `remove-empty-lines`, `find-replace`, `json-format`, `json-minify`, `json-validate`, `csv-to-json`, `base64-encode`, `base64-decode`, `url-encode`, `url-decode`, `html-escape`, `html-unescape`, `timestamp-to-date`, `date-to-timestamp`, `percent-change`, `percentage-of`, `ratio-simplify`, `temperature`, `length`, `weight`, `bytes`, `pace`。

部分换算工具可在页面的 Options 中使用 JSON 指定参数，例如：

```json
{"from":"kg","to":"lb"}
```

## 游戏记录

```json
{
  "title": "Signal Maze",
  "slug": "signal-maze",
  "category": "Puzzle",
  "description": "A concise and accurate description of the real game.",
  "cover": "assets/covers/signal-maze.webp",
  "play_url": "https://provider.example/games/signal-maze/",
  "controls": "Use the arrow keys or swipe to route the signal.",
  "tips": ["Plan two turns ahead."],
  "provider": "Named provider",
  "source_url": "https://source.example/project",
  "license": "MIT"
}
```

若游戏随包自托管，可用 `local_entry: "games/signal-maze/index.html"` 替代 `play_url`，并将所需 HTML/CSS/JS/图片全部放在 `games/signal-maze/`。每款游戏必须能真实打开，拥有准确控制说明、封面、来源和授权/使用依据。外链必须为 HTTPS。

## 来源与设计记录

`provenance/content-provenance.json` 记录文章来源、写作方式、核验信息和封面来源。`provenance/design-references.json` 记录外部设计参考的准确 URL、许可/使用依据、影响范围和原创改编说明。公开示例不等于可复制授权；许可不清晰时只能提炼高层设计原则，不复制代码、品牌、文字或素材。

## 三种导出

- 草稿：允许导出未完成内容，同时生成 `site-audit-report.json`；无正式域名时 `robots.txt` 默认禁止抓取。
- 递审版：无广告，必须通过全部自动硬门禁，仍需人工事实、版权、部署和政策复核。
- 过审后广告版：在递审版门禁上，还必须导入经过校验的真实广告代码；广告不放在隐私/条款/联系/404 页面，也不紧邻工具和游戏操作控件。

隐私政策会包含以下两个固定的 Google 用户选择与说明链接：

- https://myadcenter.google.com/personalizationoff
- https://policies.google.com/technologies/partner-sites

生成器不承诺搜索排名、收录或 AdSense 批准；最终决定由 Google 作出。
