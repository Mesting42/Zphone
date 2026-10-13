/** Per-category presentation settings shared by the workbench and templates.
 * This module accepts plain category data; it never reads app state, article
 * content, or advertising configuration. Old categories default to auto. */
export const CATEGORY_LAYOUT_MODES = Object.freeze([
  { value: 'auto', label: '自动（按文章数量）' },
  { value: 'grid', label: '常规网格' },
  { value: 'featured', label: '首篇大卡＋下方网格' }
]);
export const CATEGORY_LAYOUT_COLUMNS = Object.freeze([
  { value: 'auto', label: '自动' },
  ...[1, 2, 3, 4].map(value => ({ value: String(value), label: value + ' 列' }))
]);

/** Whitelist values at the rendering boundary. Never interpolate uploaded or
 * stale configuration values directly into HTML attributes or CSS. */
export function categoryLayoutSettings(category) {
  return {
    layout: CATEGORY_LAYOUT_MODES.some(mode => mode.value === category?.layout) ? category.layout : 'auto',
    columns: CATEGORY_LAYOUT_COLUMNS.some(column => column.value === String(category?.columns))
      ? String(category.columns) : 'auto'
  };
}

/** Choose columns from the actual cards, after the generator allocates data.
 * A featured card consumes its own row: three articles therefore become 1+2.
 * Explicit columns are retained in state even if this category has fewer cards. */
export function categoryGridAttributes(category, renderedCount) {
  const { layout, columns } = categoryLayoutSettings(category);
  if (layout === 'auto') return '';
  const total = Math.max(0, Math.floor(Number(renderedCount) || 0));
  const regularCount = Math.max(1, total - (layout === 'featured' ? 1 : 0));
  const automaticColumns = regularCount === 1 ? 1 : regularCount % 3 === 0 ? 3 : 2;
  const resolvedColumns = Math.min(regularCount, columns === 'auto' ? automaticColumns : Number(columns));
  return ' data-category-layout="' + layout + '" data-category-columns="' + columns +
    '" style="--category-requested-columns:' + resolvedColumns + '"';
}

/** Flex rows let a partial last row share all available width. Grid's fixed
 * tracks leave vacant cells; flex-grow fills them without changing DOM order.
 * Non-card children (ad slots/placement markers) remain full-width rows at their
 * original positions. All selectors are explicitly scoped by the registry. */
export const categoryLayoutCSS = `
:scope .tpl-sections .items-grid[data-category-layout] {--category-columns:var(--category-requested-columns);display:flex!important;flex-wrap:wrap;align-items:stretch;column-count:initial!important;gap:var(--grid-gap)}
:scope .tpl-sections .items-grid[data-category-layout] > .item-card {flex:1 1 calc((100% - (var(--category-columns) - 1)*var(--grid-gap))/var(--category-columns))!important;grid-column:auto!important;min-width:0;max-width:none!important;align-self:stretch}
:scope .tpl-sections .items-grid[data-category-layout="featured"] > .item-card:first-child {flex-basis:100%!important;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center}
:scope .tpl-sections .items-grid[data-category-layout] > :not(.item-card) {flex:0 0 100%!important;width:100%!important;max-width:none!important;min-width:0}
@media(max-width:1000px){
:scope .tpl-sections .items-grid[data-category-layout] {--category-columns:min(2,var(--category-requested-columns))}
}
@media(max-width:720px){
:scope .tpl-sections .items-grid[data-category-layout] {gap:12px}
:scope .tpl-sections .items-grid[data-category-layout] > .item-card {flex-basis:calc((100% - (var(--category-columns) - 1)*12px)/var(--category-columns))!important}
:scope .tpl-sections .items-grid[data-category-layout="featured"] > .item-card:first-child {flex-basis:100%!important}
}
@media(max-width:440px){
:scope .tpl-sections .items-grid[data-category-layout] {--category-columns:1}
}
`;
