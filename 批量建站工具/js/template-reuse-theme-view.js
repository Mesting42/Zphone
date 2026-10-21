/** 复用普通建站的配色卡片样式；只呈现内置主题，不保存业务状态。 */
export function renderTemplateThemeCards(target, presets, selectedId) {
    const escape = value => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const choices = [{ id: '', name: '保留模板原配色', previewBg: 'linear-gradient(135deg,#edf4fc,#c3d2e5)' }, ...presets];
    target.innerHTML = choices.map(preset => {
        const selected = preset.id === selectedId;
        return '<button type="button" class="style-card' + (selected ? ' selected' : '') + '" data-template-theme="' + escape(preset.id) + '" aria-pressed="' + selected + '">' +
            '<span class="style-preview" aria-hidden="true" style="background:' + escape(preset.previewBg || '#eef3f8') + '"></span>' +
            '<span class="style-name">' + escape(preset.name) + '</span></button>';
    }).join('');
}
