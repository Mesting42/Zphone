/**
 * 字段匹配页的展示层。
 * 不修改映射对象、不参与自动匹配或导出；选择变化交由主应用保存，
 * 再通过 update() 同步显示状态，避免重建下拉框导致焦点丢失。
 */
function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 图标仅作装饰；状态同时用文字表达，不依赖颜色或图形识别。
const icons = {
    template: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h4"/></svg>',
    source: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 4 16 4 16 0V5M4 12v7c0 4 16 4 16 0v-7"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>'
};

function renderTemplateField(field, jsonFields, mapping, index) {
    const controlId = 'mapping-field-' + index;
    const options = jsonFields.map(function(jsonField) {
        return '<option value="' + escapeHtml(jsonField.name) + '"' +
            (mapping[field.id] === jsonField.name ? ' selected' : '') + '>' +
            escapeHtml(jsonField.name) + ' (' + escapeHtml(jsonField.type) + ')</option>';
    }).join('');
    return '<div class="mapping-item mapping-target-row">' +
        '<label class="mapping-field-label" for="' + controlId + '">' +
            '<span class="mapping-field-title"><span class="field-label-zh">' + escapeHtml(field.labelZh) + '</span>' +
            (field.required ? '<span class="mapping-required">必填</span>' : '') + '</span>' +
            '<span class="field-name" lang="en">' + escapeHtml(field.label) + '</span></label>' +
        '<div class="mapping-control"><select id="' + controlId + '" class="mapping-select" data-theme-field="' +
            escapeHtml(field.id) + '"' + (field.required ? ' data-required="true" aria-required="true"' : '') +
            ' aria-describedby="mapping-state-' + index + '"><option value="">不匹配此字段</option>' + options + '</select>' +
            '<span class="mapping-row-state" id="mapping-state-' + index + '"></span></div></div>';
}

function renderSourceField(field) {
    return '<div class="mapping-item mapping-source-row" data-source-field="' + escapeHtml(field.name) + '">' +
        '<div class="mapping-source-identity"><span class="field-name">' + escapeHtml(field.name) + '</span>' +
        '<span class="mapping-type">' + escapeHtml(field.type) + '</span></div>' +
        '<span class="mapping-source-state"></span></div>';
}

/**
 * 挂载单站字段映射界面。fields/jsonFields 是只读配置；onChange 是唯一写入入口。
 * 批量建站继续使用原有逐站映射界面，不经过此模块。
 */
export function createFieldMappingView({ container, summary, fields, jsonFields, mapping, onChange }) {
    container.innerHTML = '<section class="mapping-column left" aria-labelledby="mapping-target-title">' +
        '<header class="mapping-column-header"><span class="mapping-section-icon">' + icons.template + '</span>' +
        '<div><h3 id="mapping-target-title">网站模板字段</h3><p>为每个字段选择对应的 JSON 数据</p></div>' +
        '<span class="mapping-count">' + fields.length + ' 个字段</span></header>' +
        '<div class="mapping-field-list">' + fields.map(function(field, index) {
            return renderTemplateField(field, jsonFields, mapping, index);
        }).join('') + '</div></section>' +
        '<section class="mapping-column right" aria-labelledby="mapping-source-title">' +
        '<header class="mapping-column-header"><span class="mapping-section-icon">' + icons.source + '</span>' +
        '<div><h3 id="mapping-source-title">JSON 数据字段</h3><p>查看数据类型与当前使用状态</p></div>' +
        '<span class="mapping-count">' + jsonFields.length + ' 个字段</span></header>' +
        '<div class="mapping-field-list">' + jsonFields.map(renderSourceField).join('') + '</div></section>';

    const selects = Array.from(container.querySelectorAll('.mapping-select'));
    const sourceRows = Array.from(container.querySelectorAll('.mapping-source-row'));
    // 保存节点引用，后续只更新文本与样式，保留原生 select 的键盘交互。
    const summaryText = summary.querySelector('#mapping-summary-text');
    const summaryStatus = summary.querySelector('[data-mapping-summary-status]');
    const mappedCount = summary.querySelector('[data-mapping-mapped]');
    const unmappedCount = summary.querySelector('[data-mapping-unmapped]');
    const requiredCount = summary.querySelector('[data-mapping-required]');

    selects.forEach(function(select) {
        select.addEventListener('change', function() {
            onChange(select.dataset.themeField, select.value);
        });
    });

    function update(currentMapping) {
        const usedFields = new Set(Object.values(currentMapping));
        const requiredFields = fields.filter(function(field) { return field.required; });
        const mapped = fields.filter(function(field) { return Boolean(currentMapping[field.id]); }).length;
        const requiredMapped = requiredFields.filter(function(field) { return Boolean(currentMapping[field.id]); }).length;
        const missingRequired = requiredFields.length - requiredMapped;

        selects.forEach(function(select, index) {
            const field = fields[index];
            const matched = Boolean(currentMapping[field.id]);
            const missing = field.required && !matched;
            const row = select.closest('.mapping-target-row');
            select.classList.toggle('mapped', matched);
            row.classList.toggle('is-mapped', matched);
            row.classList.toggle('is-missing', missing);
            // 仅提供必填缺失提示，不改变主应用既有的下一步校验规则。
            select.setAttribute('aria-invalid', missing ? 'true' : 'false');
            row.querySelector('.mapping-row-state').textContent = matched ? '已匹配' : (missing ? '请选择对应字段' : '选填 · 暂未匹配');
        });
        let usedCount = 0;
        sourceRows.forEach(function(row) {
            const used = usedFields.has(row.dataset.sourceField);
            if (used) usedCount += 1;
            row.classList.toggle('mapped', used);
            row.querySelector('.mapping-source-state').innerHTML = (used ? icons.check : '') + (used ? '已使用' : '未使用');
        });
        mappedCount.textContent = String(mapped);
        unmappedCount.textContent = String(fields.length - mapped);
        requiredCount.textContent = requiredMapped + ' / ' + requiredFields.length;
        summary.dataset.state = missingRequired ? 'attention' : 'ready';
        summaryStatus.textContent = missingRequired ? '还有 ' + missingRequired + ' 项必填待匹配' : '必填字段已完成';
        // 区分必填缺失与可选字段未使用，避免把缺失必填项表达为可直接忽略。
        summaryText.textContent = missingRequired
            ? '请完成必填字段匹配，再进入网站配置。JSON 数据已使用 ' + usedCount + ' / ' + jsonFields.length + ' 个字段。'
            : '可继续配置网站；未匹配的选填字段将不在网站中展示。JSON 数据已使用 ' + usedCount + ' / ' + jsonFields.length + ' 个字段。';
        summary.style.display = 'grid';
    }

    update(mapping);
    return { update };
}
