/** Independent editorial template generations.
 * The config owns its snapshots, so cloning/switching a batch site cannot read
 * another site's history. Old renderers and palettes stay in their own scope.
 */
const EditorialTemplateVersions = (function() {
    const copy = value => JSON.parse(JSON.stringify(value));
    const shared = ['siteTitle', 'logoText', 'logoIcon', 'contactEmail', 'adPlacements', 'adCodePlacements', 'adPaths'];
    const optionsByElement = new WeakMap();
    function isLegacy(config) { return !!config && config.editorialTemplateVersion === 'legacy'; }
    function eligible(state) { return state && ['normal', 'batch-ad-build'].includes(state.siteBuildMode || 'normal'); }
    function themeId(config, domainId) {
        return LegacyEditorialTemplateSource.themes[config && config.legacyThemeId] ? config.legacyThemeId
            : LegacyEditorialTemplateSource.themes[domainId] ? domainId : 'tech';
    }
    function theme(state) {
        return isLegacy(state.config) && eligible(state)
            ? LegacyEditorialTemplateSource.themes[themeId(state.config, state.selectedTheme)] : THEMES[state.selectedTheme];
    }
    function snapshot(config) {
        const value = copy(config);
        delete value.editorialTemplateSnapshots;
        return value;
    }
    function switchVersion(config, version, domainId, createCurrent) {
        const previous = isLegacy(config) ? 'legacy' : 'current';
        const next = version === 'legacy' ? 'legacy' : 'current';
        if (previous === next) return config;
        const snapshots = copy(config.editorialTemplateSnapshots || {});
        snapshots[previous] = snapshot(config);
        const target = snapshots[next] ? copy(snapshots[next]) : next === 'legacy'
            ? LegacyEditorialTemplateSource.defaults(themeId(config, domainId)) : createCurrent(domainId);
        // Ad placement objects are intentionally shared with the active batch
        // editing target; copying them here would break manual placement edits.
        shared.forEach(key => { if (config[key] !== undefined) target[key] = config[key]; });
        target.editorialTemplateVersion = next;
        if (next === 'legacy') {
            target.legacyThemeId = themeId(target, domainId);
            target.templateId = null;
            target.allArticlesEnabled = false;
        }
        target.editorialTemplateSnapshots = snapshots;
        return target;
    }
    function changeTheme(config, id) {
        const defaults = LegacyEditorialTemplateSource.defaults(id);
        shared.forEach(key => { if (config[key] !== undefined) defaults[key] = config[key]; });
        return Object.assign(defaults, { editorialTemplateVersion: 'legacy', legacyThemeId: id, templateId: null, allArticlesEnabled: false,
            editorialTemplateSnapshots: config.editorialTemplateSnapshots || {} });
    }
    function buildConfig(state, current) {
        const id = themeId(state.config, state.selectedTheme);
        const automatic = typeof BatchAdBuilder !== 'undefined' ? BatchAdBuilder.autoMapFields(LegacyEditorialTemplateSource.themes[id], state.jsonFields || []) : {};
        const mapping = Object.assign({}, automatic, state.fieldMapping);
        const legacy = LegacyEditorialTemplateSource.buildConfig(Object.assign({}, state, { selectedTheme: id, fieldMapping: mapping }));
        const original = copy(legacy.theme);
        const title = state.config.siteTitle || original.siteTitle;
        const oldTitle = original.siteTitle, oldEmail = original.pages.contact.email;
        original.siteTitle = title;
        original.logoText = state.config.logoText || original.logoText;
        for (const page of Object.values(original.pages)) {
            for (const key of Object.keys(page)) if (typeof page[key] === 'string') {
                page[key] = page[key].split(oldTitle).join(title).split(oldEmail).join(state.config.contactEmail || oldEmail);
            }
        }
        const placements = copy(current.adPlacements);
        for (const pages of Object.values(placements)) {
            if (pages.home === 'content-middle') pages.home = legacy.structure.categories.length > 1
                ? 'after-section-' + Math.max(0, Math.ceil(legacy.structure.categories.length / 2) - 1) : 'cat-0-after-last';
            if (pages.detail === 'detail-middle') pages.detail = 'detail-before-related';
        }
        return Object.assign({}, current, legacy, {
            editorialTemplateVersion: 'legacy', legacyThemeId: id, templateId: null,
            theme: original, adPlacements: placements,
            structure: Object.assign({}, legacy.structure, { hasAllArticlesPage: false }),
            style: Object.assign({}, legacy.style, { siteMotion: null })
        });
    }
    function render(name, args, config, host = {}) {
        let renderingConfig = config;
        if (name === 'generateScriptJs') {
            // The host already resolves exported data.json image paths.
            renderingConfig = Object.assign({}, config, { isLocalImages: false });
            args = [renderingConfig];
        } else if (name === 'generateDetailHtml') {
            const imageField = config.fieldMapping.image;
            const records = args[2].map(item => {
                const record = Object.assign({}, item);
                const image = String(record[imageField] || '').replace(/\\/g, '/');
                if (image && !/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(image)) {
                    record[imageField] = config.isLocalImages ? '../images/' + image.split('/').pop() : '../' + image.replace(/^\.\//, '');
                }
                return record;
            });
            renderingConfig = Object.assign({}, config, { isLocalImages: false });
            args = [records[args[1]], args[1], records, renderingConfig];
        }
        const containers = host.adTemplates || {};
        if (name !== 'generateCSS') LegacyEditorialTemplateSource.render('generateCSS', [config], config, containers);
        let result = LegacyEditorialTemplateSource.render(name, args, renderingConfig, containers);
        if (name === 'generateCSS' || name === 'generateScriptJs') return result;
        // Preserve the host's validated ad runtime, CSS fallback and immutable
        // asset names. These compatibility operations do not rewrite layouts.
        result = result.replace(/<script\b[^>]*src=["'][^"']*(?:securepubads\.g\.doubleclick\.net|(?:^|\/)ad\.js)[^"']*["'][^>]*>\s*<\/script>/gi, '');
        if (host.adScripts) result = result.replace('</head>', host.adScripts + '\n</head>');
        if (config.generatedAssets) {
            result = result.replace(/(href="(?:\.\.\/)?css\/)style\.css"/g, '$1' + config.generatedAssets.style + '"')
                .replace(/(src="(?:\.\.\/)?js\/)script\.js"/g, '$1' + config.generatedAssets.script + '"');
        }
        if (config.inlineStyleTag) result = result.replace('</head>', config.inlineStyleTag + '\n</head>');
        return result.replace('<body>', '<body data-editorial-template-version="legacy">');
    }
    function preview(state, page, detailIndex, config, host) {
        const imageField = config.fieldMapping.image;
        const cached = state.isLocalImages && typeof PreviewImageCache !== 'undefined' ? PreviewImageCache.acquire(state.localImages || {}) : null;
        if (cached) state._previewBlobUrls = cached.urls;
        let records = state.data.map(item => {
            const record = Object.assign({}, item);
            const name = String(record[imageField] || '').replace(/\\/g, '/').split('/').pop();
            if (cached && cached.byFilename[name]) record[imageField] = cached.byFilename[name];
            return record;
        });
        const selected = Number(detailIndex) || 0;
        if (page === 'detail' && records[selected]) records = [records[selected], ...records.filter((_, i) => i !== selected)];
        const previewState = Object.assign({}, state, { data: records, fieldMapping: config.fieldMapping, isLocalImages: false, _previewBlobUrls: [] });
        const previewConfig = Object.assign({}, config, { isLocalImages: false });
        const containers = {};
        for (const [id, markup] of Object.entries(host.adTemplates || {})) {
            containers[id] = markup.replace(/(<div id="div-gpt-ad-banner\d"[^>]*>)/,
                '$1<div style="width:300px;height:250px;display:grid;place-items:center;background:#e5f2ff;color:#185891;border:1px dashed #75a7e8;box-sizing:border-box">' + id + ' · 广告预览</div>');
        }
        const html = render('generatePreviewHtml', [previewState, page === 'all' ? 'home' : page], previewConfig, { adTemplates: containers });
        // Bridge the old '#' cards to the current preview's selected article.
        const script = `<script>document.addEventListener('click',function(e){
var card=e.target.closest('.item-card');if(!card)return;e.preventDefault();e.stopImmediatePropagation();
window.parent.postMessage({type:'preview-nav',page:'detail',itemIndex:Array.from(document.querySelectorAll('.item-card')).indexOf(card)},'*');
},true);</script>`;
        return html.replace('</body>', script + '</body>');
    }
    function syncControls(document, state) {
        const active = eligible(state), legacy = active && isLegacy(state.config), config = state.config;
        const picker = document.getElementById('editorial-template-version');
        if (!picker) return;
        picker.value = legacy ? 'legacy' : 'current';
        const random = document.getElementById('random-assemble-btn');
        random.textContent = legacy ? '🎲 随机搭配' : '🎲 随机换模板';
        random.title = legacy ? '按旧工具原始规则随机搭配样式与页面布局' : '随机应用一套领域专属模板与配色主题，并微调细节';
        document.getElementById('editorial-template-version-controls').hidden = !active;
        document.querySelectorAll('[data-editorial-template-only]').forEach(e => {
            e.hidden = e.dataset.editorialTemplateOnly !== (legacy ? 'legacy' : 'current');
        });
        const oldTheme = document.getElementById('editorial-legacy-theme');
        oldTheme.value = themeId(config, state.selectedTheme);
        for (const [id, choices] of Object.entries(LegacyEditorialTemplateSource.controls)) {
            const select = document.getElementById(id);
            if (!select || !choices.length) continue;
            if (!optionsByElement.has(select)) optionsByElement.set(select, { html: select.innerHTML, disabled: select.disabled });
            const saved = optionsByElement.get(select);
            select.innerHTML = legacy ? choices.map(o => '<option value="' + o.value + '">' + o.label + '</option>').join('') : saved.html;
            select.disabled = legacy ? false : saved.disabled;
        }
        document.querySelectorAll('#editorial-legacy-nav-links input').forEach(input => { input.checked = (config.navLinks || []).includes(input.value); });
        ['icon-set-select', 'category-icons-enabled', 'category-numbers-enabled', 'card-excerpt-lines', 'logo-icon-trigger',
            'viewport-reveal-enabled', 'card-interaction-enabled', 'card-domain-icon-enabled', 'card-arrow-enabled', 'card-glow-color', 'card-glow-custom-row'].forEach(id => {
            const e = document.getElementById(id);
            if (e) (e.closest('.config-item') || e).style.display = legacy ? 'none' : '';
        });
        ['animation-enter', 'card-hover'].forEach(id => {
            const e = document.getElementById(id);
            if (!e) return;
            const row = e.closest('.config-item');
            row.style.display = legacy ? '' : 'none';
            const label = row.querySelector('label');
            if (label) label.hidden = !legacy && id === 'animation-enter';
        });
    }
    return { isLegacy, eligible, themeId, theme, switchVersion, changeTheme, buildConfig, render, preview, syncControls };
})();
