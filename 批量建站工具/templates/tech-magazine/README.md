# 科技·纸墨杂志

首期独立资讯模板，登记在科技领域原模板之后。纸墨配色、衬线文章标题与清晰栏目线条适合长期技术文章。

- `template.json`：身份、版本、领域、基础布局和允许的默认样式。
- `home.js` / `detail.js` / `all.js`：各页面内容元素的声明式样式规则。
- `thumbnail.svg`：模板选择器缩略图，开发者维护的静态素材。

基础布局复用 `portal-topic-matrix`。完整页面、资源处理、首页/详情/列表广告位置仍由现有生成器提供；本目录不生成广告容器、不读取广告配置，也不新增运行时脚本。

修改后运行 `npm run templates:build`。注册文件由目录自动生成，不手动编辑 `js/template-packages.js`。配置协议见 `docs/template-packages.md`。
