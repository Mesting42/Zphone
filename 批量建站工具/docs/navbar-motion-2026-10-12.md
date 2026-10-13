# 资讯模板汉堡菜单双向过渡

用户确认范围：当前资讯建站工具的所有模板，涵盖下拉菜单和侧边抽屉。应用唯一目录 `D:\Min\建站工具\批量建站工具`，Git 根 `D:\Min\建站工具`，分支 `main`；本地 Vite 预览端口 5174，启动目录为上述应用目录。修改前已运行 `git rev-parse --show-toplevel`。

## 动画与来源

保持原模板的导航颜色、边框、圆角、位置和链接。只增加开关状态与动画，不改变广告位或文章配置。

| 模板 | 采用的运动参数 | 当前本地来源 |
| --- | --- | --- |
| field-notes | 280ms 面板过渡，上移 12px、纵向缩放 .98 | 04 `styles.css` 的 site-nav |
| daily-skillet | 下滑淡入 220ms，收起 180ms，上移 8px | 08 `assets/css/editorial-theme.css` 的 mobile-nav |
| stone-crumb | 200ms 淡入/收起，上移约 5.6px | 06 `src/styles/site.css` 的 site-nav |
| pixelwire-editorial | 180ms 下滑淡入，上移 5px；补收起 150ms | 05 `app/globals.css` 的 mobile-nav-enter |
| print-field | 220ms 入场、160ms 退出，上移 8px、缩放 .99 | 13 `public/assets/styles.css` 的 mobile-menu |
| vitalpulse-journal | 面板 180ms，上移 8px；菜单项 30ms 错峰 | 09 `src/style.css` 的 main-nav |
| deep-life-atlas | 面板 220ms 入场、180ms 退出；菜单项 30ms 错峰，收起时反向 | 12 `assets/site.css` 的 site-nav |
| evwired-studio 与其余旧模板 | 补通用下滑淡入 240ms、上滑淡出 180ms | 07 的菜单通过 display/hidden 直接切换；按钮三条线使用原有 200ms 节奏 |

模板里的菜单 DOM 与参考站不同，因此迁移方向、时长、缓动及错峰节奏，保留工具原有菜单尺寸和布局。侧边抽屉沿原方向横向滑入/滑出，遮罩同步淡入/淡出，使用 transform 而不是原先的 left 布局过渡。

## 模块与状态

- `js/navbar-layout.js`：原宽度适配器继续处理折叠断点；新增 `interactionScript()` 输出自包含共享交互。使用 Web Animations API，从当前帧接续反向动画；每次请求带修订号，取消旧完成回调，防止快速开关后被延迟隐藏。缺少动画 API 时立即切换且保持功能。
- `js/generator.js`：预览、导出首页脚本、详情、列表和通用页共用上述控制器，删除原来重复的菜单事件实现。
- `scripts/build-template-packages.mjs`：导航适配器加入内容哈希版本更新列表，避免新生成器配上旧导航脚本缓存。

关闭请求立即设置 inert 与 ARIA；退出动画完成后才 hidden。折叠/桌面切换取消进行中的动画，恢复正确的可见性和焦点。支持 Esc、再次点击汉堡、点外部区域/抽屉遮罩和选中链接关闭。抽屉打开时限制背景滚动并约束键盘焦点；关闭后恢复原滚动样式。`prefers-reduced-motion` 下移除面板位移、缩放、菜单项错峰，保留 100ms 淡变反馈。

## 本次检查边界

生产构建完成；检测器只指出生成器已有的分类标题侧线和 bounce 样式，未修改范围以外的旧样式。`git diff --check` 无空白错误。修改前快照保存在 `coverage/navbar-motion-20261012/source-before/`。

自动浏览器连接当前工作台被安全策略拒绝，本次未绕过该限制，也未实际观察手机展开/收起动画、快速点击、减少动态效果或导出网站的浏览器状态。未新增或执行自动化测试、全量回归、提交或发布。用户重新加载工具并重新导出后才会使用新导航行为；已有 ZIP 不会自动更新。
