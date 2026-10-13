/**
 * 工作台配置展示适配器：业务状态由各工作流管理。
 * 记录人工微调并生成共用 CSS，避免模板覆盖用户的选择；
 * 说明前置条件，不参与数据解析、广告处理或文件下载。
 */
(function(root) {
    'use strict';
    var fields = {'card-radius':'cardRadius','card-border':'cardBorder','card-spacing':'cardSpacing','card-image-height':'cardImageHeight','card-view-mode':'cardViewMode','card-columns':'cardColumns','grid-gap':'gridGap','category-title-style':'categoryTitleStyle','category-title-align':'categoryTitleAlign'};
    /** 记录值而非布尔值，切换模板后不会将旧微调误套到不同配置上。 */
    function bind(getConfig) {
        if (document.documentElement.dataset.configurationControlsReady) return;
        document.documentElement.dataset.configurationControlsReady = 'true';
        document.addEventListener('change', function(event) {
            var key = fields[event.target.id];
            if (!key) return;
            var config = getConfig();
            (config.controlOverrides || (config.controlOverrides = {}))[key] = event.target.value;
        }, true);
        sync(getConfig());
    }
    /** 保留有用途的控件，用明确前置条件解释暂时不可用的原因。 */
    function condition(id, available, message) {
        var control = document.getElementById(id);
        if (!control) return;
        var row = control.closest('.config-item');
        if (!row) return;
        control.disabled = !available;
        var custom = control._styledSelectControl || control._customSelectControl;
        if (custom) {
            custom.trigger.disabled = !available;
            custom.trigger.setAttribute('aria-disabled', available ? 'false' : 'true');
            custom.trigger.setAttribute('aria-describedby', id + '-condition-note');
        }
        row.classList.toggle('configuration-unavailable', !available);
        var note = document.getElementById(id + '-condition-note');
        if (!note) {
            note = document.createElement('p');
            note.id = id + '-condition-note';
            note.className = 'configuration-condition-note';
            row.insertAdjacentElement('afterend', note);
            var existing = control.getAttribute('aria-describedby');
            control.setAttribute('aria-describedby', (existing ? existing + ' ' : '') + note.id);
        }
        note.hidden = !message;
        note.textContent = message || '';
    }
    /** 操作按钮可绑定本次数据实际提供的网址字段。 */
    function syncActionFields(config, state) {
        var select = document.getElementById('action-btn-link-field');
        if (!select || !state) return null;
        var data = state.data || [], mapping = state.fieldMapping || {};
        var names = Array.from(new Set(data.slice(0, 30).reduce(function(keys, item) { return keys.concat(Object.keys(item || {})); }, [])));
        var game = state.selectedTheme === 'game';
        var candidates = names.filter(function(name) { return data.some(function(item) {
            // 图片地址也是 URL，但不能误当作文章来源或游戏入口。
            if (name === mapping.image || /(?:image|cover|thumbnail|avatar|logo)(?:_url)?$/i.test(name)) return false;
            if (typeof item[name] !== 'string') return false;
            return /^https?:\/\//i.test(item[name]) || (game && (name === mapping.store_url || /^(?:url|store_url|iframe_url|game_url|local_entry)$/.test(name)) && /^(?:blob:|\.?\/)|\.html?(?:[?#]|$)/i.test(item[name]));
        }); });
        var signature = candidates.join('|');
        if (select.dataset.fields !== signature) {
            select.dataset.fields = signature;
            select.replaceChildren();
            (candidates.length ? candidates : ['']).forEach(function(name) {
                var option = document.createElement('option');
                option.value = name;
                option.textContent = name || '没有可用的网址字段';
                select.appendChild(option);
            });
        }
        var current = mapping[config.actionButtonLinkField] || config.actionButtonLinkField;
        if (candidates.length && candidates.indexOf(current) === -1) config.actionButtonLinkField = current = candidates[0];
        select.value = current || '';
        condition('action-btn-link-field', candidates.length > 0, candidates.length ? (game ? '使用该字段中的游戏网址或包内 HTML 路径；没有有效地址的条目不显示按钮。' : '使用该字段中的 http/https 地址；没有有效地址的条目不显示按钮。') : '当前数据没有可用的网址字段，补充网址后才能显示操作按钮。');
        return candidates.length > 0;
    }
    /** 保留模板合法但下拉框未列举的参数，避免当前值显示成“请选择”。 */
    function syncValues(config) {
        var controls = Object.assign({}, fields, {'navbar-layout':'navbarLayout','navbar-style':'navbarStyle','navbar-height':'navbarHeight','logo-style':'logoStyle','footer-style':'footerStyle','back-link-style':'backLinkStyle','meta-layout':'metaLayout','content-render':'contentRender','btn-style':'btnStyle','btn-size':'btnSize','font-style':'fontStyle','transition-speed':'transitionSpeed','meta-bg':'metaBg','detail-img-style':'detailImgStyle','content-max-width':'contentMaxWidth','hero-style':'heroStyle','detail-layout':'detailLayout','ambient-effect':'ambientEffect','privacy-length':'privacyLength','terms-length':'termsLength'});
        Object.keys(controls).forEach(function(id) {
            var select = document.getElementById(id), value = config[controls[id]];
            if (!select || value == null || typeof value === 'object') return;
            value = String(value);
            select.querySelectorAll('option[data-template-current]').forEach(function(option) { if (option.value !== value) option.remove(); });
            if (!Array.from(select.options).some(function(option) { return option.value === value; })) {
                var option = document.createElement('option');
                option.value = value;
                option.dataset.templateCurrent = 'true';
                option.textContent = '跟随模板（' + value + '）';
                select.appendChild(option);
            }
            select.value = value;
            var custom = select._styledSelectControl || select._customSelectControl;
            if (custom) {
                var label = custom.label || custom.trigger;
                label.textContent = select.options[select.selectedIndex].textContent;
                custom.trigger.title = label.textContent;
            }
        });
    }
    function sync(config, state) {
        syncValues(config);
        condition('hero-style', !!config.heroEnabled, config.heroEnabled ? '' : '先在结构配置中开启首页 Hero 区域。');
        var hasActionField = syncActionFields(config, state);
        var action = !!config.actionButtonEnabled && hasActionField !== false;
        var actionHint = config.actionButtonEnabled ? '当前数据缺少有效网址，请先配置操作按钮的链接字段。' : '先在结构配置中开启详情页操作按钮。';
        condition('btn-style', action, action ? '' : actionHint);
        condition('btn-size', action, action ? '' : actionHint);
        var image = (config.cardFields || []).indexOf('image') !== -1;
        condition('card-image-height', image, image ? '' : '先在首页卡片展示字段中选择图片。');
        condition('navbar-height', true, config.logoStyle === 'boxed' && !(state && state.selectedTheme === 'game') ? '带边框标题的导航最小高度为 72px；低于此值时会自动留足标题空间。' : '');
    }
    /** 仅拼接受限枚举与既有 CSS 变量，不拼接用户任意输入。 */
    function css(config) {
        var style = config.style || {}, selected = style.controlOverrides || {};
        // 覆盖按分类数量细分的自适应规则；限定内容卡，不影响广告和详情头图。
        var rules = '', scope = ':root body ', grid = scope + '.main-content .category-section .items-grid', card = grid + ' .item-card';
        var changed = function(key) { return selected[key] != null && String(selected[key]) === String(key === 'cardColumns' ? config.structure.cardColumns : style[key]); };
        if (changed('cardRadius')) rules += card + '{border-radius:var(--card-radius)!important}';
        if (changed('cardSpacing')) rules += card + ' .card-body{padding:var(--card-spacing)!important}' + card + ':has(.sf-card-arrow) .card-body{padding-inline-end:max(var(--card-spacing),38px)!important}' + card + '.sf-card-corner-icon .card-body{padding-inline-end:max(var(--card-spacing),52px)!important}';
        if (changed('cardImageHeight')) rules += card + ' .card-image,' + card + ' .card-image-frame{height:var(--card-image-height)!important;min-height:0!important;aspect-ratio:auto!important}';
        var borders = {none:'border:0;box-shadow:none',thin:'border:1px solid var(--color-border);box-shadow:none',rounded:'border:1px solid var(--color-border);box-shadow:0 2px 8px #0002',shadow:'border:0;box-shadow:0 4px 16px #0003',double:'border:3px double var(--color-border);box-shadow:none',dashed:'border:2px dashed var(--color-border);box-shadow:none',thick:'border:3px solid var(--color-border);box-shadow:none'};
        if (changed('cardBorder') && borders[style.cardBorder]) rules += card + '{' + borders[style.cardBorder].split(';').join('!important;') + '!important}';
        if (changed('gridGap')) rules += grid + '{gap:var(--grid-gap)!important}';
        // 固定列数只用于桌面，窄屏保留响应式折行。
        var columns = Number(config.structure.cardColumns);
        if (changed('cardColumns') && [1,2,3,4].indexOf(columns) !== -1) rules += '@media(min-width:1001px){' + grid + '{display:grid!important;grid-template-columns:repeat(' + columns + ',minmax(0,1fr))!important}' + card + '{width:auto!important;max-width:none!important;grid-column:auto!important}}';
        if (changed('cardViewMode') && style.cardViewMode === 'list') rules += grid + '{display:grid!important;grid-template-columns:minmax(0,1fr)!important}' + card + '{grid-column:auto!important;width:auto!important;max-width:none!important;margin:0!important}@media(min-width:721px){' + card + '{display:grid!important;grid-template-columns:minmax(120px,30%) minmax(0,1fr)!important;direction:ltr!important}' + card + ':not(:has(.card-image)){grid-template-columns:minmax(0,1fr)!important}}';
        if (changed('categoryTitleAlign')) {
            var align = style.categoryTitleAlign === 'center' ? 'center' : 'left';
            rules += scope + '.tpl-section-heading{justify-content:' + (align === 'center' ? 'center' : 'flex-start') + '!important}' + scope + '.tpl-section-heading>div{flex:1;text-align:' + align + '!important}' + scope + '.category-title{text-align:' + align + '!important}';
        }
        if (changed('categoryTitleStyle')) {
            var headings = {none:'border:0;background:transparent',single:'border:0;border-bottom:1px solid var(--color-border);background:transparent',double:'border:0;border-bottom:3px double var(--color-border);background:transparent',dotted:'border:0;border-bottom:2px dotted var(--color-border);background:transparent',gradient:'border:0;background:linear-gradient(90deg,var(--color-primary),transparent)', 'left-accent':'border:0;border-left:4px solid var(--color-primary);padding-left:16px;background:transparent'};
            if (headings[style.categoryTitleStyle]) rules += scope + '.tpl-section-heading{' + headings[style.categoryTitleStyle].split(';').join('!important;') + '!important}';
        }
        return rules ? '\n/* Explicit configuration overrides shared by preview and export. */\n' + rules : '';
    }
    root.ConfigurationControls = { bind: bind, sync: sync, css: css };
})(globalThis);
