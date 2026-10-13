/**
 * 预览和导出共用的模板排版器。
 *
 * 仅接收已构建的站点配置，返回 HTML/CSS；不读取、修改或执行广告代码。
 * openHome/closeHome 只包裹原分类区块。广告仍由生成器按原位置写入，
 * 不会因内容排版而被复制或移动。
 */
(function(root) {
    'use strict';
    function escape(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function(c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function design(config) {
        const id = config.structure.homeLayout || config.style.layoutTemplate;
        const layout = TemplateCatalog.getLayout(id);
        return layout ? { layout: layout, domain: TemplateCatalog.getDomain(config.templateDomain || config.theme.id) } : null;
    }

    let templateHeadingIndexes = null;
    const headingCompositions = [
        'editorial-rule', 'side-rail', 'soft-panel', 'center-stage', 'split-lockup', 'floating-index',
        'outlined-frame', 'stacked-mark', 'color-band', 'chapter-rule', 'offset-ledger', 'open-type'
    ];
    const headingMarkers = ['quiet-index', 'stamp', 'roundel', 'oversized', 'outlined', 'accent-tab'];
    const headingIconSizes = [0.62, 0.64, 0.66, 0.68, 0.70];
    const headingRulePatterns = ['short-rule', 'dot-track', 'corner-tick', 'double-rule'];

    function getTemplateHeadingIndexes() {
        if (templateHeadingIndexes) return templateHeadingIndexes;
        templateHeadingIndexes = new Map();
        const domains = TemplateCatalog.domains || {};
        Object.keys(domains).sort().forEach(function(domainId) {
            for (let variant = 1; variant <= 30; variant++) {
                const templateId = domainId + '-blueprint-' + String(variant).padStart(2, '0');
                templateHeadingIndexes.set(templateId, templateHeadingIndexes.size);
            }
        });
        return templateHeadingIndexes;
    }

    /**
     * Give every domain-template ID a stable point in the heading design matrix.
     * Mixed-radix decoding guarantees a unique composition for all 1,080 IDs.
     */
    function headingDesign(config) {
        const templateId = String(config && config.templateId || '');
        let index = getTemplateHeadingIndexes().get(templateId);
        if (index == null) {
            const layoutId = config && config.structure && config.structure.homeLayout ||
                config && config.style && config.style.layoutTemplate;
            const layout = TemplateCatalog.getLayout(layoutId);
            if (!layout) return null;
            // Standalone game layouts remain distinct without consuming domain-template slots.
            index = getTemplateHeadingIndexes().size + layout.index;
        }

        let remainder = index;
        const composition = remainder % headingCompositions.length;
        remainder = Math.floor(remainder / headingCompositions.length);
        const marker = remainder % headingMarkers.length;
        remainder = Math.floor(remainder / headingMarkers.length);
        const iconSizeIndex = remainder % headingIconSizes.length;
        remainder = Math.floor(remainder / headingIconSizes.length);
        const rule = remainder % headingRulePatterns.length;
        const signature = [composition, marker, iconSizeIndex, rule].join('-');
        return {
            index: index,
            signature: signature,
            composition: headingCompositions[composition],
            marker: headingMarkers[marker],
            iconSize: headingIconSizes[iconSizeIndex],
            rule: headingRulePatterns[rule]
        };
    }

    function bodyAttributes(config) {
        const selected = design(config);
        const heading = headingDesign(config);
        let attributes = '';
        if (selected) attributes += ' data-template-layout="' + selected.layout.id + '" data-template-domain="' + selected.domain.id + '"';
        if (config && config.templateId) attributes += ' data-template-id="' + escape(config.templateId) + '"';
        if (heading) attributes += ' data-template-heading="' + heading.signature + '"';
        return attributes;
    }

    function title(config, category) {
        const icon = config.style.categoryIconsEnabled !== false && category.icon
            ? '<span class="category-title-icon" aria-hidden="true">' + escape(category.icon) + '</span>' : '';
        return icon +
            '<span class="category-title-text">' + escape(category.name) + '</span>';
    }
    function categoryHeader(config, category, index) {
        const selected = design(config);
        const recipe = headingDesign(config);
        const domainId = config.templateDomain || (config.theme && config.theme.id);
        const domain = selected ? selected.domain : TemplateCatalog.getDomain(domainId);
        const headingMarkup = '<h2 class="category-title">' + title(config, category) + '</h2>';
        if (!selected && !recipe) return headingMarkup;
        // 资讯生成器始终传入布尔值；未接入此选项的游戏生成器保留原有行为。
        const numberPreference = config.style.categoryNumbersEnabled;
        const number = numberPreference !== false
            ? '<span class="tpl-section-number" aria-hidden="true">' + String(index + 1).padStart(2, '0') + '</span>' : '';
        const numberAttribute = typeof numberPreference === 'boolean'
            ? ' data-heading-number="' + (numberPreference ? 'on' : 'off') + '"' : '';
        const caption = domain ? '<p class="tpl-section-kicker">' + escape(domain.topicsLabel) + '</p>' : '';
        const navigationClass = selected ? ' tpl-heading-' + selected.layout.navigation : ' tpl-heading-legacy';
        const recipeAttributes = recipe
            ? ' data-heading-composition="' + recipe.composition + '" data-heading-marker="' + recipe.marker +
                '" data-heading-icon-size="' + recipe.iconSize.toFixed(2) + '" data-heading-rule="' + recipe.rule + '"'
            : '';
        return '<header class="tpl-section-heading' + navigationClass + '"' + recipeAttributes + numberAttribute + '>' + number +
            '<div class="tpl-section-copy">' + caption + headingMarkup + '</div>' +
            '<span class="tpl-section-ornament" aria-hidden="true"></span></header>';
    }
    /**
     * 首页直接从首个分类开始，与原有模板使用相同的内容顺序。
     * 这里只保留内容排版所需的容器；广告仍由调用方在原位置插入。
     * 不生成额外的站点介绍、分类快捷入口或占位侧栏。
     */
    function openHome(config) {
        const selected = design(config);
        if (!selected) return '';
        return '<div class="tpl-home" data-template-composition="' + selected.layout.id + '"><div class="tpl-sections">';
    }
    function closeHome(config) { return design(config) ? '</div></div>' : ''; }

    // 这里的规则仅排布内容卡。广告和放置标记明确跨列，永不进入 clip/scroll/折叠区域。
    const cardRules = {
        landscape: '.tpl-sections .item-card{display:grid;grid-template-columns:38% 1fr;align-items:stretch;min-height:170px}.tpl-sections .card-image-frame{height:100%;min-height:170px;aspect-ratio:auto}.tpl-sections .card-image{height:100%;min-height:170px}.tpl-sections .card-body{align-self:center}',
        tiles: '.tpl-sections .item-card{border:0;box-shadow:none;border-radius:0;background:transparent}.tpl-sections .card-body{padding:20px 0}.tpl-sections .card-title{font-size:clamp(19px,1.7vw,27px)}.tpl-sections .card-image-frame{border-radius:8px}',
        rows: '.tpl-sections .items-grid{grid-template-columns:1fr!important;gap:0}.tpl-sections .item-card{display:grid;grid-template-columns:180px 1fr;border-width:0 0 1px;border-radius:0;box-shadow:none;background:transparent;padding:24px 0}.tpl-sections .card-image{height:125px}.tpl-sections .card-image-frame{height:125px}.tpl-sections .card-body{padding:4px 24px}.tpl-sections .card-title{font-size:24px}',
        alternating: '.tpl-sections .items-grid{grid-template-columns:1fr!important;gap:36px}.tpl-sections .item-card{display:grid;grid-template-columns:1.2fr 1fr;align-items:center;border:0;border-radius:0;box-shadow:none}.tpl-sections .item-card:nth-of-type(even){direction:rtl}.tpl-sections .card-body{direction:ltr;padding:32px}.tpl-sections .card-image{height:320px}.tpl-sections .card-image-frame{height:320px}.tpl-sections .card-title{font-size:clamp(24px,2.5vw,34px)}',
        lead: '.tpl-sections .item-card:first-of-type{grid-column:span var(--tpl-lead-span,2);display:grid;grid-template-columns:1fr 1fr;align-items:center}.tpl-sections .item-card:first-of-type .card-image-frame,.tpl-sections .item-card:first-of-type .card-image{height:100%;min-height:240px}.tpl-sections .item-card:first-of-type .card-title{font-size:28px}.tpl-sections .item-card{border-radius:0;border-width:2px 0 0}',
        steps: '.tpl-sections .items-grid{counter-reset:step}.tpl-sections .item-card{counter-increment:step;border-radius:0;border:0;border-left:3px solid var(--color-primary);position:relative}.tpl-sections .item-card:before{content:counter(step,decimal-leading-zero);position:absolute;z-index:1;top:10px;left:10px;background:var(--color-bg);color:var(--color-text);padding:5px 9px;font:700 13px monospace}.tpl-sections .card-body{padding:25px}.tpl-sections .card-image{height:180px}',
        columns: '.tpl-sections .items-grid{align-items:start}.tpl-sections .item-card{border:0;box-shadow:none;background:transparent;border-radius:0}.tpl-sections .card-image,.tpl-sections .card-image-frame{height:290px}.tpl-sections .item-card:nth-of-type(3n+2){margin-top:40px}.tpl-sections .card-body{border-top:3px solid var(--color-primary);padding:22px 8px}.tpl-sections .card-title{font-size:24px}',
        wide: '.tpl-sections .items-grid{gap:36px}.tpl-sections .item-card{border:0;box-shadow:none;background:transparent}.tpl-sections .card-image,.tpl-sections .card-image-frame{height:300px}.tpl-sections .card-body{margin:0 22px;padding:26px;border-bottom:2px solid var(--color-primary)}.tpl-sections .card-title{font-size:clamp(23px,2.2vw,32px)}',
        register: '.tpl-sections .items-grid{grid-template-columns:1fr!important;gap:0;counter-reset:item}.tpl-sections .item-card{counter-increment:item;display:grid;grid-template-columns:38px 100px 1fr;align-items:center;border:0;border-bottom:1px solid var(--color-border);border-radius:0;background:transparent;box-shadow:none;padding:16px 0}.tpl-sections .item-card:before{content:counter(item,decimal-leading-zero);font:600 12px monospace;color:var(--color-text-secondary)}.tpl-sections .card-image-frame,.tpl-sections .card-image{height:76px}.tpl-sections .card-body{padding:0 18px}.tpl-sections .card-title{font-size:18px}.tpl-sections .card-desc,.tpl-sections .card-content{max-height:3em}',
        ribbons: '.tpl-sections .items-grid{gap:1px;background:var(--color-border);padding:1px}.tpl-sections .item-card{border:0;border-radius:0;box-shadow:none;display:flex;flex-direction:column-reverse}.tpl-sections .card-body{min-height:140px;padding:24px}.tpl-sections .card-image,.tpl-sections .card-image-frame{height:180px}',
        squares: '.tpl-sections .item-card{border-radius:0;border:1px solid var(--color-border);box-shadow:none;padding:12px}.tpl-sections .card-image,.tpl-sections .card-image-frame{height:auto;aspect-ratio:1;object-fit:cover}.tpl-sections .card-body{padding:16px 3px}.tpl-sections .card-title{font-size:18px}',
        circles: '.tpl-sections .item-card{border:0;border-radius:0;background:transparent;box-shadow:none;text-align:center}.tpl-sections .card-image-frame{width:min(180px,75%);height:auto;aspect-ratio:1;margin:18px auto;border-radius:50%;overflow:hidden}.tpl-sections .card-image{width:100%;height:100%;aspect-ratio:1;border-radius:50%}.tpl-sections .item-card>img{width:160px;height:160px;margin:18px auto}.tpl-sections .card-body{padding:20px 12px}.tpl-sections .card-title{font-size:22px}',
        pairs: '.tpl-sections .item-card{display:grid;grid-template-columns:120px 1fr;align-items:center;border:0;border-top:2px solid var(--color-primary);border-radius:0;box-shadow:none}.tpl-sections .card-image-frame,.tpl-sections .card-image{height:180px}.tpl-sections .card-body{padding:20px}.tpl-sections .item-card:nth-of-type(2n){border-top-color:var(--color-text);background:var(--color-bg-secondary)}',
        compact: '.tpl-sections .item-card{border:0;border-radius:0;box-shadow:none;display:flex;flex-direction:column-reverse;background:transparent;border-bottom:1px solid var(--color-border)}.tpl-sections .card-body{padding:20px 4px}.tpl-sections .card-image,.tpl-sections .card-image-frame{height:125px}.tpl-sections .card-title{font-size:22px}',
        panels: '.tpl-sections .item-card{border:1px solid var(--color-border);box-shadow:none;border-radius:0;display:grid;grid-template-rows:260px 1fr}.tpl-sections .card-image,.tpl-sections .card-image-frame{height:260px}.tpl-sections .card-body{padding:30px}.tpl-sections .item-card:nth-of-type(even){grid-template-rows:1fr 260px}.tpl-sections .item-card:nth-of-type(even) .card-body{order:-1}.tpl-sections .card-title{font-size:27px}',
        panorama: '.tpl-sections .items-grid{gap:32px}.tpl-sections .item-card{border:0;border-radius:0;box-shadow:none;background:transparent}.tpl-sections .card-image-frame,.tpl-sections .card-image{height:180px}.tpl-sections .card-body{padding:22px 0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}.tpl-sections .card-title{font-size:24px}.tpl-sections .card-desc,.tpl-sections .card-content{margin:0}',
        offset: '.tpl-sections .items-grid{gap:32px}.tpl-sections .item-card{border:0;border-radius:0;box-shadow:none;background:transparent}.tpl-sections .item-card:nth-of-type(3n+2){padding-top:44px}.tpl-sections .card-image-frame,.tpl-sections .card-image{height:205px;border-radius:0 48px 0 0}.tpl-sections .card-body{padding:20px 0}.tpl-sections .card-title{font-size:23px}',
        blocks: '.tpl-sections .item-card{border-radius:16px;border:1px solid var(--color-border);box-shadow:none;padding:16px}.tpl-sections .card-image-frame,.tpl-sections .card-image{height:160px;border-radius:8px}.tpl-sections .item-card:nth-of-type(even){display:flex;flex-direction:column-reverse}.tpl-sections .card-body{padding:20px 4px}'
    };

    const headingCompositionStyles = [
        '.tpl-section-heading{align-items:end;padding:18px 0 14px;border-bottom:1px solid var(--color-border)}',
        '.tpl-section-heading{border-inline-start:3px solid var(--color-primary);padding-inline-start:18px}',
        '.tpl-section-heading{padding:20px;background:var(--color-bg-secondary);border-radius:12px}',
        '.tpl-section-heading{grid-template-columns:minmax(0,1fr);justify-items:center;text-align:center;padding:25px 12px}',
        '.tpl-section-heading{grid-template-columns:minmax(0,1fr) auto;align-items:end;border-bottom:2px solid var(--color-primary);padding-bottom:14px}.tpl-section-number{grid-column:2;grid-row:1}.tpl-section-copy{grid-column:1;grid-row:1}',
        '.tpl-section-heading{grid-template-columns:minmax(0,1fr);padding-inline-start:18px}.tpl-section-number{position:absolute;inset-inline-start:0;inset-block-start:0;z-index:0;font-size:clamp(42px,6vw,72px);line-height:.85;opacity:.16}.tpl-section-copy{position:relative;z-index:1}',
        '.tpl-section-heading{padding:18px 20px;border:1px solid var(--color-border);border-radius:4px}',
        '.tpl-section-heading{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:16px 0}.tpl-section-number{font-size:12px}',
        '.tpl-section-heading{padding:18px 20px;background:var(--color-bg-secondary);border-bottom:3px solid var(--color-primary)}',
        '.tpl-section-heading{display:flex;align-items:baseline;gap:16px;padding:18px 0;border-bottom:1px solid var(--color-border)}.tpl-section-copy{display:flex;align-items:baseline;gap:12px;min-width:0}.tpl-section-kicker{flex:0 0 auto}.tpl-section-copy .category-title{min-width:0}',
        '.tpl-section-heading{grid-template-columns:48px minmax(0,1fr);align-items:start;padding:0}.tpl-section-number{grid-column:1;grid-row:1;padding-top:18px}.tpl-section-copy{grid-column:2;grid-row:1;padding:18px;border-block-start:1px solid var(--color-border);border-inline-start:1px solid var(--color-border)}',
        '.tpl-section-heading{display:block;padding:14px 42px 18px 0}.tpl-section-number{position:absolute;inset-block-start:0;inset-inline-end:0}.tpl-section-copy .category-title{font-size:clamp(28px,4vw,48px);letter-spacing:-.04em}'
    ];
    const headingMarkerStyles = [
        '.tpl-section-number{min-width:2ch;padding-bottom:3px;border-bottom:1px solid var(--color-border);color:var(--color-text-secondary);font-size:13px;font-variant-numeric:tabular-nums}',
        '.tpl-section-number{padding:.5em .7em;border:1px solid var(--color-primary);border-radius:2px;transform:rotate(-2deg);font:600 13px/1 ui-monospace,monospace}',
        '.tpl-section-number{display:grid;place-items:center;width:2.2em;aspect-ratio:1;border:1px solid var(--color-primary);border-radius:50%;background:var(--color-bg-secondary);font-size:14px}',
        '.tpl-section-number{font-size:clamp(42px,5vw,68px);line-height:.8;letter-spacing:-.08em;opacity:.48}',
        '.tpl-section-number{color:transparent;-webkit-text-stroke:1px var(--color-primary);font-size:30px;line-height:1}',
        '.tpl-section-number{padding:.55em .7em;border-inline-start:3px solid var(--color-primary);font-size:12px;line-height:1}'
    ];
    const headingIconStyles = headingIconSizes.map(function(size) {
        return '.category-title-icon{font-size:' + size.toFixed(2) + 'em}';
    });
    const headingRuleStyles = [
        '.tpl-section-ornament{width:min(28%,100px);height:2px;background:var(--color-primary)}',
        '.tpl-section-ornament{width:84px;height:6px;background:radial-gradient(circle at 3px 3px,var(--color-primary) 1.5px,transparent 1.8px) 0 0/10px 6px repeat-x}',
        '.tpl-section-ornament{width:18px;height:18px;border-inline-end:2px solid var(--color-primary);border-block-end:2px solid var(--color-primary)}',
        '.tpl-section-ornament{width:42px;height:5px;border-block:1px solid var(--color-primary)}'
    ];

    function scopeHeadingRules(source, scope) {
        return source.replace(/(^|})\s*([^{}]+)\{/g, function(_, start, selectors) {
            return start + selectors.split(',').map(function(selector) {
                return scope + ' ' + selector.trim();
            }).join(',') + '{';
        });
    }

    function headingCss(recipe) {
        if (!recipe) return '';
        const scope = 'body[data-template-heading="' + recipe.signature + '"]';
        const base = '.tpl-section-heading{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:16px;position:relative;isolation:isolate;min-width:0;margin:0 0 24px;padding:18px 0}' +
            '.tpl-section-copy{min-width:0}.tpl-section-heading .category-title{display:flex;align-items:center;gap:.34em;min-width:0;margin:0;padding:0;border:0!important;background:transparent!important;font-size:clamp(23px,2.5vw,36px);line-height:1.12;letter-spacing:-.025em;overflow-wrap:anywhere;text-wrap:balance}' +
            '.tpl-section-heading .category-title:after{display:none!important}.tpl-section-number{display:grid;place-items:center;flex:0 0 auto;color:var(--color-primary);font-weight:700}' +
            '.tpl-section-kicker{margin:0 0 7px;color:var(--color-primary);font-size:10px;font-weight:650;letter-spacing:.04em;line-height:1.35;text-transform:none}' +
            '.category-title-icon{display:block;margin:0;font-size:.66em;line-height:1}.category-title-text{min-width:0;overflow-wrap:anywhere}' +
            '.tpl-section-ornament{position:absolute;inset-inline-end:0;inset-block-end:0;display:block;pointer-events:none}';
        let styles = scopeHeadingRules(base, scope) +
            scopeHeadingRules(headingCompositionStyles[recipe.index % headingCompositions.length], scope) +
            scopeHeadingRules(headingMarkerStyles[Math.floor(recipe.index / headingCompositions.length) % headingMarkers.length], scope) +
            scopeHeadingRules(headingIconStyles[Math.floor(recipe.index / (headingCompositions.length * headingMarkers.length)) % headingIconSizes.length], scope) +
            scopeHeadingRules(headingRuleStyles[Math.floor(recipe.index / (headingCompositions.length * headingMarkers.length * headingIconSizes.length)) % headingRulePatterns.length], scope);
        styles += '@media(max-width:720px){' + scope + ' .tpl-section-heading{gap:11px;margin-bottom:20px;padding:14px;min-width:0}' +
            scope + ' .tpl-section-heading .category-title{font-size:clamp(20px,6vw,27px);line-height:1.16}' +
            scope + ' .tpl-section-copy{min-width:0}' + scope + ' .tpl-section-ornament{max-width:24vw}' +
            scope + ' .tpl-section-number{font-size:clamp(12px,4vw,20px)}' + '}' +
            '@media(max-width:400px){' + scope + ' .tpl-section-heading{gap:8px;padding:12px}' +
            scope + ' .tpl-section-heading .category-title{font-size:clamp(18px,6vw,22px)}' +
            scope + ' .tpl-section-kicker{font-size:9px}}';
        return '\n/* Template-specific category title: ' + recipe.signature + ' */\n' + styles;
    }

    /**
     * 编号显隐只影响标题中的编号节点和为它预留的空间。
     * 独立于版式配方输出，避免逐个改动 1,080 套蓝图，也不会触及卡片计数器。
     * 未传入偏好的调用方不追加规则，保持共享游戏排版器的原有输出。
     */
    function headingNumberCss(config) {
        if (typeof config.style.categoryNumbersEnabled !== 'boolean') return '';
        const enabled = 'body .tpl-section-heading[data-heading-number="on"]';
        const disabled = 'body .tpl-section-heading[data-heading-number="off"]';
        return '\n/* Category heading number preference */\n' +
            enabled + '>.tpl-section-number{display:grid}' +
            disabled + '{grid-template-columns:minmax(0,1fr)}' +
            disabled + '>.tpl-section-copy{grid-column:1;grid-row:1}' +
            // 这两种构图用额外内边距给绝对定位编号让位；窄屏继续沿用原内边距。
            '@media(min-width:721px){' +
            disabled + '[data-heading-composition="floating-index"]{padding-inline-start:0}' +
            disabled + '[data-heading-composition="open-type"]{padding-inline-end:0}}';
    }

    // 分类标题仍保持模板个性；首页不再分配导航侧栏或介绍区的空间。
    const headingRules = {
        rail: '.tpl-section-number{font-size:18px;width:42px;height:42px;border:1px solid var(--color-border);display:grid;place-items:center}',
        matrix: '.tpl-section-heading{border-bottom:1px solid var(--color-border)}.tpl-section-number{font-size:40px;color:var(--color-primary)}',
        directory: '.tpl-section-number{font:600 15px monospace}.tpl-section-heading{padding:14px 0;border-top:2px solid var(--color-primary)}',
        deck: '.tpl-section-heading{background:var(--color-bg-secondary);padding:24px}.tpl-section-number{font-size:54px}',
        board: '.tpl-section-heading{border-top:4px solid var(--color-primary)}.tpl-section-number{font-size:24px}',
        path: '.tpl-section-heading{border-left:4px solid var(--color-primary);padding-left:22px}.tpl-section-number{font-size:44px}',
        tower: '.tpl-section-heading{border-top:1px solid var(--color-border)}.tpl-section-number{font-size:60px;line-height:1}',
        canvas: '.tpl-section-heading{padding:25px 0}.tpl-section-number{font-size:20px;border-radius:50%;border:1px solid var(--color-primary);padding:12px}',
        register: '.tpl-section-heading{border-bottom:2px solid var(--color-primary)}.tpl-section-number{font:600 16px monospace}',
        ribbon: '.tpl-section-heading{background:var(--color-bg-secondary);border-left:6px solid var(--color-primary);padding:22px}.tpl-section-number{font-size:40px}',
        gateway: '.tpl-section-heading{border-bottom:3px solid var(--color-text)}.tpl-section-number{font-size:20px}',
        lens: '.tpl-section-heading{justify-content:center;text-align:center}.tpl-section-number{display:none}',
        streams: '.tpl-section-heading{padding:22px;border-top:1px solid var(--color-border);border-bottom:1px solid var(--color-border)}.tpl-section-number{font-size:34px}',
        explorer: '.tpl-section-heading{padding:15px;background:var(--color-bg-secondary)}.tpl-section-number{font:600 14px monospace}',
        panels: '.tpl-section-heading{padding:26px 0}.tpl-section-number{font-size:64px;color:var(--color-primary)}',
        shelves: '.tpl-section-heading{border-top:4px solid var(--color-text);padding-top:24px}.tpl-section-number{font-size:34px}',
        radar: '.tpl-section-heading{border-bottom:1px solid var(--color-border)}.tpl-section-number{font-size:34px}',
        modules: '.tpl-section-heading{border:1px solid var(--color-border);border-radius:16px;padding:22px}.tpl-section-number{font-size:24px}',
        console: '.tpl-section-heading{padding:18px 0;border-bottom:2px solid var(--color-primary)}.tpl-section-number{font:600 26px monospace}',
        quest: '.tpl-section-heading{padding:18px;border-left:3px solid var(--color-primary)}',
        lobby: '.tpl-section-heading{padding:20px;border-top:3px solid var(--color-primary);background:var(--color-bg-secondary)}.tpl-section-number{font-size:34px}',
        cartridge: '.tpl-section-heading{border-bottom:5px solid var(--color-border)}',
        brackets: '.tpl-section-heading{border:2px solid var(--color-border);padding:20px;box-shadow:6px 6px 0 var(--color-bg-secondary)}',
        handheld: '.tpl-section-heading{border-radius:24px;background:var(--color-bg-secondary);padding:24px}.tpl-section-number{font:700 28px monospace}',
        levels: '.tpl-section-heading{border-top:2px solid var(--color-primary);border-bottom:2px solid var(--color-primary);padding:20px 0}.tpl-section-number{font:700 32px monospace}',
        speedrun: '.tpl-section-heading{padding:16px 0;border-bottom:2px solid var(--color-primary)}'
    };
    const readerRules = {
        rail: '.detail-page{border-left:4px solid var(--color-primary);padding-left:32px}.detail-title{max-width:20ch}.detail-meta{border-radius:0;border-top:1px solid var(--color-primary)}',
        band: '.detail-title{padding:24px;background:var(--color-bg-secondary);border-top:4px solid var(--color-primary)}.detail-meta{border-radius:0;background:transparent;border-bottom:1px solid var(--color-border)}',
        index: '.detail-page{max-width:1000px}.detail-title{border-bottom:2px solid var(--color-primary);padding-bottom:26px}.detail-meta{font-size:13px;border:1px solid var(--color-border);border-radius:0}.detail-content{max-width:75ch;margin-inline:auto}',
        stage: '.detail-page{max-width:1200px}.detail-hero-image{width:100%;max-height:420px;object-fit:cover}.detail-title{font-size:clamp(30px,4vw,56px);max-width:22ch;line-height:1.1}.detail-content{max-width:76ch;margin-inline:auto}',
        center: '.detail-page{max-width:1020px}.detail-title{text-align:center;margin-inline:auto;max-width:24ch}.detail-meta{justify-content:center;border-radius:30px}.detail-content{max-width:72ch;margin-inline:auto}'
    };
    // 仅输出所选布局的 CSS，避免 990 个模板的规则全部进入每个导出网站。
    function css(config) {
        const selected = design(config);
        const heading = headingDesign(config);
        const templateHeadingCss = headingCss(heading) + headingNumberCss(config);
        if (!selected) return templateHeadingCss;
        const layout = selected.layout;
        const columns = Math.min(4, Math.max(1, Number(config.structure.cardColumns) || layout.columns));
        const scoped = function(source) {
            return source.replace(/(^|})\s*([^{}]+)\{/g, function(_, start, selectors) {
                return start + selectors.split(',').map(function(selector) { return 'body[data-template-layout] ' + selector.trim(); }).join(',') + '{';
            });
        };
        return '\n/* Shared content layout: ' + layout.id + ' */\n' + scoped(
            '.tpl-home{--tpl-columns:' + columns + ';--tpl-lead-span:' + Math.min(columns,2) + ';min-width:0;display:block}.tpl-section-kicker{font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--color-primary);margin:0 0 12px}.tpl-sections{min-width:0}.tpl-sections .category-section{margin:0 0 48px;min-width:0}.tpl-section-heading{display:flex;align-items:center;gap:20px;position:relative;padding:16px 0;margin-bottom:24px;min-width:0}.tpl-section-heading>div{min-width:0}.tpl-section-heading .category-title{border:0;background:transparent;margin:0;padding:0;font-size:clamp(23px,2.5vw,34px);line-height:1.25;overflow-wrap:anywhere}.tpl-section-heading .category-title:after{display:none}.tpl-section-number{color:var(--color-primary);flex-shrink:0;font-weight:700}.tpl-section-kicker{margin-bottom:7px;font-size:10px}.category-title-icon{display:inline-block;margin-right:.2em}.tpl-sections .category-section .items-grid{display:grid;grid-template-columns:repeat(var(--tpl-columns),minmax(0,1fr))!important;gap:var(--grid-gap,20px);align-items:stretch}.tpl-sections .category-section .items-grid>.item-card{width:auto!important;max-width:none;min-width:0;flex:none;margin-bottom:0;box-sizing:border-box}.tpl-sections .card-body{min-width:0}.tpl-sections .card-title{overflow-wrap:anywhere;line-height:1.3}.tpl-sections .card-image-frame{min-width:0}.tpl-sections .card-image{width:100%;object-fit:cover}.tpl-sections .items-grid>[id^="adv"],.tpl-sections .items-grid>.all-games-middle-ads,.tpl-sections .items-grid>.all-articles-middle-ads,.tpl-sections .items-grid>.insert-marker{grid-column:1/-1!important;width:100%!important;min-width:0;clear:both}.tpl-sections>[id^="adv"]{width:100%;clear:both}.tpl-home a{touch-action:manipulation}' +
            headingRules[layout.navigation] + cardRules[layout.cards] +
            '#adv1>div:first-child,#adv2>div:first-child,#adv3>div:first-child{color:var(--color-text)!important}' +
            // 缺图时让文本占满内容卡，不留空图列；广告从不属于 item-card。
            '.tpl-sections .item-card:not(:has(.card-image)) .card-body{grid-column:1/-1}.tpl-sections .item-card:not(:has(.card-image)){grid-template-rows:auto}' +
            readerRules[layout.reader]
        ) +
            '\n@media(max-width:1000px){' + scoped('.tpl-sections .category-section .items-grid{--tpl-columns:2}.tpl-sections .card-title{font-size:20px}') + '}\n' +
            '@media(max-width:720px){' + scoped('.tpl-sections .category-section{margin-bottom:32px}.tpl-section-heading{padding:15px;gap:12px}.tpl-section-heading .category-title{font-size:24px}.tpl-section-kicker{font-size:9px}.tpl-section-number{font-size:24px}.tpl-sections .category-section .items-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important}.tpl-sections .category-section .item-card{display:flex;flex-direction:column;grid-column:auto!important;margin:0!important;padding:0!important;direction:ltr!important}.tpl-sections .category-section .item-card .card-body{order:0;margin:0;padding:14px;display:block}.tpl-sections .category-section .item-card .card-image,.tpl-sections .category-section .item-card .card-image-frame{height:150px;min-height:0;width:100%;aspect-ratio:auto}.tpl-sections .category-section .card-title{font-size:17px}.tpl-sections .category-section .card-desc,.tpl-sections .category-section .card-content{font-size:13px}.tpl-sections .category-section .item-card:before{display:none}.detail-page{padding-left:16px;padding-right:16px;border-width:0}.detail-title{padding:15px;font-size:30px}') + '}\n' +
            '@media(max-width:400px){' + scoped('.detail-page #adv1,.detail-page #adv2,.detail-page #adv3{width:calc(100% + 32px);max-width:none;margin-left:-16px;margin-right:-16px}.tpl-sections .category-section .items-grid{grid-template-columns:1fr!important}.tpl-section-heading .category-title{font-size:22px}') + '}\n' +
            '@media(prefers-reduced-motion:reduce){' + scoped('.tpl-home *{transition:none!important;scroll-behavior:auto!important}') + '}' +
            templateHeadingCss;
    }

    // 模板选择器用实际布局特征的线框缩略图，不用相同图标代替全部新模板。
    function thumbnail(id) {
        const layout = TemplateCatalog.getLayout(id);
        if (!layout) return '';
        let shapes = '<rect x="5" y="5" width="150" height="10" rx="2" opacity=".65"/>';
        // 缩略图从栏目标题和内容卡开始，与实际首页一致。
        shapes += '<rect x="8" y="24" width="68" height="6" rx="1" opacity=".5"/>';
        const left = 8, width = 144;
        const rows = ['rows','register'].includes(layout.cards) ? 3 : 2;
        const cols = rows === 3 ? 1 : Math.min(4, layout.columns);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
            shapes += '<rect x="' + (left + c * width / cols) + '" y="' + (38 + r * (rows === 3 ? 18 : 27)) +
                '" width="' + (width / cols - 6) + '" height="' + (rows === 3 ? 12 : 21) + '" rx="' +
                (layout.cards === 'circles' ? 10 : 2) + '" opacity="' + (c === 0 ? '.65' : '.22') + '"/>';
        return '<svg class="template-wireframe" viewBox="0 0 160 100" fill="currentColor" aria-hidden="true">' + shapes + '</svg>';
    }
    root.TemplateLayouts = Object.freeze({ design: design, headingDesign: headingDesign, bodyAttributes: bodyAttributes,
        categoryHeader: categoryHeader, openHome: openHome, closeHome: closeHome, css: css, thumbnail: thumbnail });
})(typeof globalThis !== 'undefined' ? globalThis : this);
