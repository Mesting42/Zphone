/** Compact workbench controls for the editorial packages. State lives on each
 * category object, so batch sites and template changes retain their own choices. */
import { CATEGORY_LAYOUT_MODES, CATEGORY_LAYOUT_COLUMNS, categoryLayoutSettings } from '../template-system/category-layout.js';

function options(items, selected) {
  return items.map(item => '<option value="' + item.value + '"' +
    (item.value === selected ? ' selected' : '') + '>' + item.label + '</option>').join('');
}

export function renderCategoryLayoutControls(category, index) {
  const settings = categoryLayoutSettings(category), id = 'category-layout-' + index;
  return '<div class="category-layout-settings">' +
    '<label class="category-layout-mode" for="' + id + '"><span>文章排版</span>' +
    '<select id="' + id + '" data-category-layout-index="' + index + '" data-category-layout-field="layout" aria-label="第 ' +
    (index + 1) + ' 个分类的文章排版">' + options(CATEGORY_LAYOUT_MODES, settings.layout) + '</select></label>' +
    '<label class="category-layout-columns" for="' + id + '-columns"' + (settings.layout === 'auto' ? ' hidden' : '') +
    '><span>网格列数</span><select id="' + id + '-columns" data-category-layout-index="' + index +
    '" data-category-layout-field="columns" aria-label="第 ' + (index + 1) + ' 个分类的网格列数"' +
    (settings.layout === 'auto' ? ' disabled' : '') + '>' + options(CATEGORY_LAYOUT_COLUMNS, settings.columns) +
    '</select></label></div>';
}

/** Change dependent visibility in place to keep keyboard focus on the active
 * select. The workbench's existing select adapter supplies menus/ARIA/focus. */
export function bindCategoryLayoutControls(container, categories, onChange) {
  container.querySelectorAll('select[data-category-layout-field]').forEach(select => {
    select.addEventListener('change', () => {
      const index = Number(select.dataset.categoryLayoutIndex), category = categories[index];
      if (!category) return;
      const field = select.dataset.categoryLayoutField;
      const next = categoryLayoutSettings({ ...category, [field]: select.value });
      category.layout = next.layout;
      category.columns = next.columns;
      const columnsLabel = select.closest('.category-layout-settings').querySelector('.category-layout-columns');
      columnsLabel.hidden = next.layout === 'auto';
      columnsLabel.querySelector('select').disabled = next.layout === 'auto';
      onChange();
    });
  });
}
