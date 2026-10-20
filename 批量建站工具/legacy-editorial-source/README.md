# 旧版资讯模板来源快照

`index.html`、`js/data.js`、`js/generator.js`、`js/app.js` 原样复制自用户指定的
`D:\project-zlm\张\运营站批量生成\批量建站工具`。不修改这些来源文件。

`scripts/build-legacy-editorial-template.mjs` 提取原始页面、默认配置、控件选项和随机规则，
生成独立作用域的 `js/legacy-editorial-template-source.js` 并记录每个来源文件的 SHA-256。
旧工具的应用入口、上传器、ZIP 写入器及广告脚本不加载到当前工具中。

版本配置和宿主兼容逻辑集中在 `js/editorial-template-versions.js`。
普通站与每个批量站都在自己的配置对象中保存新旧快照，避免跨站污染。
