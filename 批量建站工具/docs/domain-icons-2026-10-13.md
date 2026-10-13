# 36 个领域彩色 SVG 接入与回归（2026-10-13）

## 工作位置

- 当前使用的 Git 根：`D:\Min\建站工具`；应用：`D:\Min\建站工具\批量建站工具`。
- 分支：`main`；预览：<http://127.0.0.1:5174/>，从应用目录启动。
- 根据用户“按原目录测试”的指示保留当前目录；旧 AGENTS.md 的 Zphone 路径已由用户覆盖。

## 用户确认的范围

工作台 36 个领域选择卡片与生成站点文章卡片右上角共用每领域一枚彩色 SVG。动漫使用用户最终确认的粉色双马尾 DiceBear Adventurer 头像，原始文件 SHA-256：`7b13ed18b5dc9fd0afb4536c3fa8bbe147b528628127309db5cf6c183056ec85`。

保留现有圆标显示开关、36px 圆形容器、悬浮反馈、动态列表装饰和减少动态效果设置。网站 Logo 与分类标题继续由原有配置管理。

## 结构与导出

- `motion/icons/*.svg`：36 枚原始素材，按确认文件哈希保存，不改颜色或路径。
- `motion/icons-provenance.json`：来源、版本、许可、作者、选型列和哈希。
- `motion/domain-icons.js`：独立映射、未知领域回退、图片 URL 缓存与署名。
- `motion/registry.js`：`runtimeFor(domain, enabled)` 与两端统一的 `exportAssets(folder, settings)`。
- `scripts/vendor-motion-icons.mjs`：离线校验并打包；`npm run motion:build` 与常规构建不请求网络。
- 两端生成器导出单个领域的运行时，不把完整 36 枚素材嵌入每个站点。图片以本地 SVG data URL 使用，隔离页面 CSS 和 SVG ID，复用浏览器解码缓存。
- ZIP 保留 `assets/domain-icon.svg`、`ICONS-PROVENANCE.json`、`ICONS-LICENSE.txt`。关闭圆标时不携带该图片或 SVG 文件。
- 工作台包含五个图标库署名；开启圆标的站点页脚包含本领域图标来源、作者和许可。

## 许可

IconPark 为 Apache-2.0，Noto SVG 为 Apache-2.0，OpenMoji 为 CC BY-SA 4.0，Twemoji 图形与 DiceBear Adventurer 图形为 CC BY 4.0。DiceBear 作者为 Lisa Wischofsky。

核对并纠正了旧预览误存的 Noto 字体许可：本轮采用官方固定提交的 [2D/svg/LICENSE](https://github.com/googlefonts/noto-emoji/blob/e20cbc2bbec1926686be9f9bee7d1d2cfa1fea0e/2D/svg/LICENSE)，其原始通知与完整 Apache 文本均进入许可合集。

## 选型

| 编号 | 领域 | 图标来源 |
| --- | --- | --- |
| 01 | 科技资讯 | OpenMoji |
| 02 | 游戏资讯 | Twemoji |
| 03 | 美食餐饮 | Noto Emoji |
| 04 | 动漫二次元 | DiceBear Adventurer |
| 05 | 财经商业 | Twemoji |
| 06 | 健康医疗 | Noto Emoji |
| 07 | 旅游出行 | Noto Emoji |
| 08 | 体育赛事 | Noto Emoji |
| 09 | 汽车出行 | Noto Emoji |
| 10 | 教育学习 | Noto Emoji |
| 11 | 时尚美妆 | Noto Emoji |
| 12 | 家居生活 | Noto Emoji |
| 13 | 通用资讯 | Noto Emoji |
| 14 | 娱乐明星 | Noto Emoji |
| 15 | 影视电影 | OpenMoji |
| 16 | 音乐音频 | IconPark |
| 17 | 图书阅读 | Noto Emoji |
| 18 | 科学研究 | OpenMoji |
| 19 | 环境生态 | Noto Emoji |
| 20 | 时政公共 | IconPark |
| 21 | 法律法务 | IconPark |
| 22 | 房产地产 | Noto Emoji |
| 23 | 职场招聘 | Noto Emoji |
| 24 | 营销运营 | Noto Emoji |
| 25 | 电商产品 | Noto Emoji |
| 26 | 宠物动物 | IconPark |
| 27 | 母婴育儿 | Noto Emoji |
| 28 | 户外运动 | Noto Emoji |
| 29 | 摄影影像 | Noto Emoji |
| 30 | 历史人文 | Noto Emoji |
| 31 | 农业园艺 | Noto Emoji |
| 32 | 能源产业 | OpenMoji |
| 33 | 自然史与生物多样性 | Noto Emoji |
| 34 | 海洋与水域科学 | Noto Emoji |
| 35 | 地球与大气科学 | Noto Emoji |
| 36 | 文化遗产与传统工艺 | Noto Emoji |

## 测试与证据

- 新增 `tests/domain-icons.test.js`：36 枚原始哈希、选型、隔离图片、回退、关闭行为、三种工作流的全部领域 ZIP 与预览一致性。
- 新增 `tests/domain-icons.browser.mjs`：真实 RAR 导入后的工作台 36 枚图标，以及 36 份重新解压的 ZIP 和预览首页、全部文章、详情页，共 144 个浏览器视图；含动态插入、纯文字卡片、广告排除和移动端。
- 首次专项检查定位并修复预览署名判断错误；脚本中的属性名称不再被误认成已存在的署名元素。
- 完整第一轮 `domain-icons-final-1` 的 552 个断言通过，但 Vitest worker 通信超时，因此该轮失败。测试 ZIP 替身增加事件循环让步，保持真实 ZIP 的异步语义；同时复用已编译脚本并保留每个测试的独立 VM，未放宽失败判定。
- 第二轮：`coverage/full-regression-20261013/domain-icons-final-2`。用户要求暂不继续测试，已在广告恢复阶段停止；此前 11 个阶段通过，含 34 个文件、552 项基础测试和 144 个图标浏览器视图。整轮未完成，没有最终源码一致性结果，不能作为完整通过报告。停止状态见该目录 `interrupted.json`。用户完成后续修改并明确恢复测试后，另开新轮从头执行。
- 回归继续排除差异化建站。广告/分析外部请求使用隔离响应，验证代码、参数、位置、ZIP 和运行行为，不代表线上广告填充或收益。
