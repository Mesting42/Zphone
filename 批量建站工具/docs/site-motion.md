# 视口渐显与卡片悬浮交互

## 工作目录与范围

- 唯一当前工作目录：`D:\Min\建站工具`（Git 根），应用目录 `D:\Min\建站工具\批量建站工具`；用户已覆盖旧 AGENTS.md 中的 Zphone 路径。
- 当前分支：`main`。本地预览：`http://127.0.0.1:5174/`，从应用目录启动。
- 覆盖：普通建站、游戏建站、批量建站、广告移植建站。
- 不接入：成品站加广告、差异化建站、批量广告策略。旧站中的既有动画不会被这些排除工作流主动删除。
- 广告移植从旧站提取广告配置，新站内容仍来自新数据；动效作用于新生成的内容。

## 使用

在“配置网站 → 样式”设置视口渐显、卡片悬浮交互、领域圆标、装饰箭头。四项缺省均开启，可分别关闭。

光晕默认跟随主题色，也可选绿色、青色、蓝色、紫色、粉色、橙色、金色或自定义 `#RRGGBB`。圆标容器及装饰箭头同步使用该颜色，圆标内的专属 SVG 保留用户选定的原色。设置作为网站配置保存，切换模板和随机组装不会覆盖它们，批量流程读取每站自己的配置快照。

四个接入工作流不再使用旧的页面入场动画和旧的卡片悬浮变换。原字段仍保留供旧配置兼容，但其控件隐藏。交互过渡时间保留；视口淡入 480ms、运动 900ms，错峰 42ms、最多 168ms。

## 文件职责

| 文件 | 职责 |
| --- | --- |
| `motion/viewport-reveal.js` | IntersectionObserver、暂停 WAAPI、重播、焦点显示、pageshow、响应式及减少动态效果恢复 |
| `motion/card-pointer.js` | 合并指针事件，写入四个倾斜/光晕变量，取消和离开时清理 |
| `motion/bootstrap.js` | 在已有卡片中添加装饰，初始化控制器，处理后续列表插入 |
| `motion/site-motion.css` | 卡片抬升、阴影、图片放大、光晕、彩色圆标、箭头与静态降级 |
| `motion/domain-icons.js` | 两处 UI 共用的图标映射、隔离的图片 URL 缓存、署名生成 |
| `motion/icons/*.svg` | 用户确认的 36 枚原始彩色 SVG，动漫为粉色双马尾头像 |
| `motion/domain-icons.json` | 离线打包的 SVG；未知领域回退通用资讯 |
| `motion/icons-provenance.json` | 五个图标来源、固定版本、用户选型、作者及 SHA-256 |
| `motion/ICONS-LICENSE.txt` | IconPark、Noto、OpenMoji、Twemoji、DiceBear 图形许可合集 |
| `motion/registry.js` | 工作流边界、配置规范化、控件同步、页面装配与导出资源 |
| `scripts/build-site-motion.mjs` | 离线生成两端共用的经典脚本 `js/site-motion.js` |
| `scripts/vendor-motion-icons.mjs` | 离线校验原始文件哈希及安全性，打包素材和许可，不访问网络 |

修改源文件后运行 `npm run motion:build`。`npm run dev`、`npm run build` 也自动生成。不要手改 `js/site-motion.js`。

导出包保留 `js/site-motion-runtime.js`、`css/site-motion.css` 与图标许可；开启圆标时额外保留 `assets/domain-icon.svg` 和 `ICONS-PROVENANCE.json`。每站运行时只携带所选领域的一枚图标，预览内联同份运行时，详情页正确引用 `../`，无远程图标依赖。关闭圆标时运行时不携带图像，也不导出原始 SVG。

工作台和开启圆标的站点页脚包含来源、作者和许可链接。Noto SVG 使用 `2D/svg/LICENSE` 的 Apache-2.0，字体 OFL 许可不适用于此处素材。OpenMoji 的 SVG 为 CC BY-SA 4.0，Twemoji 图形及 DiceBear Adventurer 图形为 CC BY 4.0。原始 SVG 不改色、不修改路径；用于图片 URL 时仅去除 XML 文档头并解析旧的命名空间实体，避免 DTD 网络依赖。

## DOM 与广告约束

保留现有 `.item-card` 和 `.related-card`，不重写整张卡片，不添加链接或交互按钮。领域圆标优先加入现有图片框；没有图片框时使用卡片角落并预留文字空间。光晕使用独立的装饰 span，避免覆盖旧模板用于编号或渐变的伪元素。

视口效果用独立 `translate/rotate/scale`，悬浮用 CSS `transform`，两者可组合。手机不横移；其他宽度按实际页面边距限制水平运动，避免隐藏的待播放卡片产生横向滚动。

广告容器、广告 iframe、canvas、游戏运行区域及包含它们的祖先元素排除。广告解析、位置、加载、恢复与 GA 代码不属于此模块。

紧贴广告区域上方的整行内容会自动改为只淡入，取消位移、旋转、缩放和模糊，避免初始帧侵入广告预留空间。判断使用布局位置，覆盖网格中同一行的所有卡片。

减少动态效果时不创建隐藏动画，停止位移、倾斜、缩放和模糊；保留静态焦点和边框反馈。健康医疗已改用用户选定的彩色听诊器，旧 ECG 路径动画不再适用。缺失动画 API 或创建/播放失败时取消动画，移除运行时类，保持内容可读。键盘焦点进入时立即播放/显示对应内容。

## 验证命令

```powershell
npm run motion:build
npx vitest run --pool=threads --no-file-parallelism --maxWorkers=1 --testTimeout=30000
node tests/site-motion.browser.mjs
node tests/site-motion-ui.browser.mjs
node tests/domain-icons.browser.mjs
npm run build
```

浏览器检查需要 Playwright 和 Edge；允许通过 `PLAYWRIGHT_MODULE_PATH` 指定 Playwright。回归证据放在 `coverage/site-motion-20261012/`，广告/分析请求会隔离，不代表线上填充、收益或 GA 后台已验证。
