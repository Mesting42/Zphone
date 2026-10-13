/** Render a self-contained preview failure without exposing uploaded content or
 * raw exception messages. The caller keeps the original error in the console;
 * this module owns only the user-facing document, with no application state. */
export function previewErrorDocument(error) {
  const outdatedTemplates = /TemplateRegistry\.(?:categoryAttributes|categorySettings).*not a function/i
    .test(String(error?.message || ''));
  const title = outdatedTemplates ? '模板版本未同步' : '预览暂时无法生成';
  const message = outdatedTemplates
    ? '当前页面加载了旧版模板。请刷新工具页面后重新上传数据，再进入配置网站。'
    : '请检查数据字段或重新选择模板后重试。如果仍无法显示，请记录当前配置，再刷新工具页面并重新上传数据。';

  // All interpolated text is fixed copy chosen above, never the error message
  // or article data. No scripts, external assets or automatic reload are used.
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;box-sizing:border-box;padding:24px;background:#f4f7fb;color:#243650;font:15px/1.7 system-ui,sans-serif}
main{box-sizing:border-box;width:100%;max-width:520px;padding:28px;border:1px solid #cddcf0;border-radius:16px;background:#fff;overflow-wrap:anywhere}
h1{margin:0 0 12px;font-size:22px;line-height:1.4}p{margin:0}
</style></head><body><main id="preview-render-error" role="alert"><h1>${title}</h1><p>${message}</p></main></body></html>`;
}
