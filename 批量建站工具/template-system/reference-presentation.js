/** Shared presentation primitives. Never read advertising settings or move slots. */
import { categoryLayoutCSS } from './category-layout.js';

export function escape(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/** Keep original links, ARIA targets and menu handlers; enrich the brand lockup. */
export function navigation(markup, config) {
  // Current-page attributes are owned by Generator for every template. This
  // adapter enriches only the brand, keeping route and section state separate.
  return markup.replace(/(<a\b[^>]*class="logo[^\"]*"[^>]*>)([\s\S]*?)(<\/a>)/, (_, opening, content, closing) =>
    opening + '<span class="ref-brand"><strong>' + content + '</strong><small>' + escape(config.theme.siteSubtitle) + '</small></span>' + closing);
}

/** Legal links, contact fields and path resolution remain owned by Generator. */
export function footer(markup, config) {
  return markup.replace(/(<footer class="footer">)/, opening => opening + '<div class="container ref-footer-masthead">' + escape(config.theme.logoText) + '</div>');
}

export function heading(config, category, index) {
  // 8 套视觉模板共用生成器的编号偏好。关闭时不生成节点，Flex 自动收回占位。
  const number = config.style.categoryNumbersEnabled === true
    ? '<span class="ref-section-index" aria-hidden="true">' + String(index + 1).padStart(2,'0') + '</span>' : '';
  return '<header class="ref-section-heading">' + number +
    '<h2 class="category-title">' + (config.structure.showCategoryIcon ? '<span class="category-icon" aria-hidden="true">' + escape(category.icon) + '</span>' : '') +
    '<span class="category-title-text">' + escape(category.name) + '</span></h2></header>';
}

/** Only the contiguous image/title pair is rearranged. No advertisement can be
 * inside this pair, so paragraph placements and their original order are intact.
 * The same function runs before SiteMotion on preview and exported documents. */
export function detailLead(html) {
  return html.replace(/(<img\b[^>]*class="detail-hero-image"[^>]*>)\s*(<h1 class="detail-title">[\s\S]*?<\/h1>)/,
    (_, image, title) => '<header class="ref-article-lead">' + title + image + '</header>');
}

/** 自动模式的首页首卡仅在 5/7 篇的既有「1 + 成对卡片」布局中跨栏。
 * 集中定义选择器，让八套模板的图片、标题、顺序与跨栏同时启停；
 * 手动大卡模式适用于任意分类，手动网格模式不会继承自动大卡样式。 */
export function leadCardSelector(descendant = '') {
  // 每个选择器都显式带 :scope，以兼容模板注册器的逐项作用域校验。
  const selectors = [5, 7].map(count => ':scope .tpl-sections .category-section:first-child .items-grid:not([data-category-layout]).item-count-' +
    count + ' > .item-card:first-of-type');
  selectors.push(':scope .tpl-sections .items-grid[data-category-layout="featured"] > .item-card:first-child');
  return selectors.map(selector => selector + descendant).join(',\n');
}

// Common reflow and reading rules; each package supplies its own composition,
// navigation treatment and typography. Advertising ancestors are never clipped,
// transformed, reordered or placed in a fixed-height grid. Imported covers
// stay in normal flow because the base card style absolutely positions images.
export const shellCSS = `
:scope {font-family:var(--ref-body,system-ui,sans-serif);line-height:1.65;background:var(--color-bg);color:var(--color-text)}
:scope .container {max-width:var(--content-max-width);min-width:0}
:scope .main-content {padding-top:36px}
:scope .tpl-home,:scope .tpl-sections {min-width:0}
:scope .category-section {margin-bottom:64px;min-width:0}
:scope .ref-section-heading {display:flex;align-items:baseline;gap:18px;margin:0 0 24px;border-bottom:1px solid var(--color-border);padding:0 0 16px}
:scope .ref-section-index {font:600 11px/1 system-ui,sans-serif;letter-spacing:.12em;color:var(--color-primary)}
:scope .ref-section-heading .category-title {font-family:var(--ref-display,inherit);font-weight:var(--ref-title-weight,650);font-size:clamp(25px,2.8vw,38px);line-height:1.15;letter-spacing:-.035em;background:none;border:0;padding:0;margin:0;color:var(--color-text);min-width:0;overflow-wrap:anywhere}
:scope .category-title::before,:scope .category-title::after {display:none}
:scope .items-grid {display:grid!important;grid-template-columns:repeat(var(--ref-columns,3),minmax(0,1fr));gap:var(--grid-gap);align-items:stretch}
:scope .item-card {width:auto!important;max-width:none!important;min-width:0;flex-basis:auto;display:flex;flex-direction:column;border:1px solid var(--color-border);background:var(--color-card-bg);box-shadow:none;overflow:visible}
:scope .card-image-frame {flex:none;overflow:hidden;border-radius:inherit;min-width:0;height:auto;min-height:0;aspect-ratio:auto}
:scope .card-image {position:relative;inset:auto;display:block;width:100%;min-width:0;min-height:0;max-width:100%;height:var(--card-image-height);object-fit:cover}
:scope .card-body {padding:24px;flex:1;min-width:0}
:scope .card-title {font-family:var(--ref-display,inherit);font-weight:var(--ref-title-weight,650);font-size:clamp(21px,2vw,28px);line-height:1.2;letter-spacing:-.035em;overflow-wrap:anywhere;color:var(--color-text)}
:scope .card-desc,:scope .card-content {font-size:14px;line-height:1.65;color:var(--color-text-secondary)}
:scope .detail-page {background:transparent;border:0;box-shadow:none;max-width:var(--content-max-width);margin:36px auto 72px;padding:0 24px;min-width:0}
:scope .detail-title {font-family:var(--ref-display,inherit);font-size:clamp(34px,5.1vw,68px);font-weight:var(--ref-title-weight,650);line-height:1.06;letter-spacing:-.045em;max-width:24ch;margin:24px 0 32px;padding:0;color:var(--color-text);border:0;background:transparent;overflow-wrap:anywhere}
:scope .detail-hero-image {display:block;width:100%;height:auto;max-height:620px;aspect-ratio:1.9;object-fit:cover;border-radius:var(--card-radius);margin:0 0 28px}
:scope .detail-content {background:transparent;padding:0;border:0}
:scope .detail-content > p,:scope .detail-content > h2,:scope .detail-content > h3,:scope .detail-content > ul,:scope .detail-content > ol {max-width:70ch;margin-left:auto;margin-right:auto}
:scope .detail-content > p {font-size:18px;line-height:1.85;margin-top:1.2em;margin-bottom:1.2em;color:var(--color-text)}
:scope .detail-content > h2 {font-family:var(--ref-display,inherit);font-size:32px;line-height:1.2;margin-top:2em}
:scope .detail-meta {font-size:12px;border:0;background:transparent;padding:12px 0;gap:24px;color:var(--color-text-secondary)}
:scope .related-title {font-family:var(--ref-display,inherit);font-size:28px;margin:48px 0 20px}
:scope .legal-content,:scope .page-content {line-height:1.85;background:transparent;box-shadow:none;border:0}
:scope .page-title,:scope .legal-title {font-family:var(--ref-display,inherit);letter-spacing:-.04em}
:scope .navbar {height:78px;box-shadow:none;border-bottom:1px solid var(--color-border)}
:scope .navbar .container {gap:24px}
:scope .navbar .logo {max-width:42%;font-family:var(--ref-display,inherit);font-size:25px;line-height:1.15;white-space:normal;overflow-wrap:anywhere;color:var(--color-text)}
:scope .ref-brand {display:flex;flex-direction:column;gap:5px;min-width:0}
:scope .ref-brand strong {display:flex;align-items:center;gap:9px;font-weight:var(--ref-title-weight,650);letter-spacing:-.045em}
:scope .ref-brand small {display:block;max-width:35ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:500 9px/1.2 system-ui,sans-serif;letter-spacing:.07em;color:var(--color-text-secondary)}
:scope .navbar .nav-links {gap:5px}
:scope .navbar .nav-links a {font-size:12px;font-family:var(--ref-nav,system-ui,sans-serif);font-weight:650;padding:10px 12px;text-decoration:none;color:var(--color-text-secondary);border:0;min-height:40px;display:flex;align-items:center}
:scope .navbar .nav-links a:hover,:scope .navbar .nav-links a[aria-current="page"] {color:var(--color-primary);background:var(--color-bg-secondary)}
:scope .navbar.nav-collapsed .nav-links {border-radius:14px;background:var(--color-bg);padding:12px}
:scope .navbar.nav-collapsed .nav-links a {min-height:44px;white-space:normal}
:scope .navbar.nav-collapsed .logo {max-width:calc(100% - 68px);overflow:hidden;display:block}
:scope .navbar.nav-collapsed .logo .ref-brand {max-width:100%}
:scope .navbar .logo:focus-visible,:scope .footer a:focus-visible {outline:2px solid var(--color-primary);outline-offset:4px}
:scope .footer {background:var(--color-bg-secondary);border-top:1px solid var(--color-border);padding:40px 0 24px}
:scope .ref-footer-masthead {font-family:var(--ref-display,inherit);font-size:clamp(30px,4vw,56px);font-weight:var(--ref-title-weight,650);letter-spacing:-.04em;line-height:1.1;padding-bottom:30px;overflow-wrap:anywhere}
:scope .footer-content {gap:28px}
:scope .footer-section h3 {font-family:var(--ref-display,inherit);font-size:17px;color:var(--color-text)}
:scope .footer p,:scope .footer a {font-size:13px;line-height:1.7;overflow-wrap:anywhere;color:var(--color-text-secondary)}
/* 首页以实际渲染的文章篇数排版；仅影响内容网格，广告节点的顺序由生成器负责。
 * 这些模板自行提供布局，因此在此恢复工具原有的 1–7 篇编排约定。
 * 更大数量继续使用操作员的列数设置，窄屏继续使用下面的响应式规则。 */
@media(min-width:769px){
:scope .tpl-sections .items-grid.item-count-1 {grid-template-columns:minmax(0,1fr)!important}
:scope .tpl-sections .items-grid.item-count-2,:scope .tpl-sections .items-grid.item-count-4,:scope .tpl-sections .items-grid.item-count-5,:scope .tpl-sections .items-grid.item-count-7 {grid-template-columns:repeat(2,minmax(0,1fr))!important}
:scope .tpl-sections .items-grid.item-count-3,:scope .tpl-sections .items-grid.item-count-6 {grid-template-columns:repeat(3,minmax(0,1fr))!important}
:scope .tpl-sections .items-grid.item-count-5 > .item-card:first-of-type,:scope .tpl-sections .items-grid.item-count-7 > .item-card:first-of-type {grid-column:1/-1}
}
@media(max-width:1000px){
:scope .items-grid {grid-template-columns:repeat(2,minmax(0,1fr))}
:scope .tpl-sections .items-grid {grid-template-columns:repeat(2,minmax(0,1fr))!important}
:scope .tpl-sections .items-grid.item-count-1 {grid-template-columns:minmax(0,1fr)!important}
:scope .navbar .logo {font-size:22px}
}
@media(max-width:720px){
:scope .main-content {padding-top:24px}
:scope .navbar {height:72px}
:scope .ref-brand small {max-width:26ch;font-size:8px}
:scope .ref-section-heading {gap:10px;padding-bottom:12px;margin-bottom:18px}
:scope .category-section {margin-bottom:38px}
:scope .items-grid {grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
:scope .item-card {grid-column:auto!important;display:flex!important;flex-direction:column!important;margin:0!important}
${leadCardSelector(' .card-image')} {height:220px!important}
${leadCardSelector(' .card-image-frame')} {order:0!important}
${leadCardSelector(' .card-body')} {order:0!important;padding:20px}
:scope .card-body {padding:15px}
:scope .card-title {font-size:20px}
:scope .card-desc,:scope .card-content {font-size:13px}
:scope .card-image {height:170px}
:scope .ref-article-lead {display:block!important}
:scope .detail-page {padding:0 16px;margin-top:24px}
:scope .detail-title {font-size:clamp(32px,8vw,48px);margin:18px 0 24px}
:scope .detail-content > p {font-size:17px}
:scope .detail-hero-image {aspect-ratio:1.35}
:scope .footer-content {grid-template-columns:1fr 1fr}
}
@media(max-width:440px){
:scope .items-grid {grid-template-columns:1fr}
:scope .tpl-sections .items-grid {grid-template-columns:1fr!important}
:scope .footer-content {grid-template-columns:1fr}
:scope .navbar .logo {font-size:20px}
}
` + categoryLayoutCSS;
