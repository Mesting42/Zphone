# 旧版本模板原始来源

以下文件从用户指定的 `D:\project-zlm\张\运营站批量生成\游戏站批量工具` 原样复制：
`index.html`、`js/data.js`、`js/generator.js`、`js/app.js`。

这些文件是只读的来源快照，不作为工作台入口运行，不要在这里修复或改写旧版布局。
`scripts/build-legacy-game-template.mjs` 提取原有页面、配色、配置默认值、控件选项和随机规则，
生成独立作用域的 `game-builder/js/legacy-template-source.js`，并记录原文件 SHA-256。

网页版接入代码位于 `game-builder/js/game-template-versions.js`。新旧配置分开保存，
广告校验、广告脚本、导出文件处理继续由现有工作台负责；来源中的旧广告运行时不被加载。
