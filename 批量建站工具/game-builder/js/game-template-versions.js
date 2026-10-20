/** Template version seam: configuration ownership and compatibility belong here.
 * Legacy source functions/palettes stay private to LegacyGameTemplateSource;
 * current presets and the advertising runtime are never changed by switching.
 */
const GameTemplateVersions = (function() {
    const copy = value => JSON.parse(JSON.stringify(value));
    const sharedKeys = ['siteTitle', 'siteSubtitle', 'contactEmail', 'adPlacements', 'adCodePlacements'];
    const snapshots = Object.create(null);
    const currentOptions = new Map();

    function isLegacy(config) { return config && config.templateVersion === 'legacy'; }

    function switchVersion(config, version) {
        const previous = isLegacy(config) ? 'legacy' : 'current';
        const next = version === 'legacy' ? 'legacy' : 'current';
        snapshots[previous] = copy(config);
        if (next === previous) return config;
        const target = snapshots[next] ? copy(snapshots[next]) : LegacyGameTemplateSource.defaults();
        sharedKeys.forEach(key => { if (config[key] !== undefined) target[key] = copy(config[key]); });
        target.templateVersion = next;
        return target;
    }

    function buildConfig(state, current) {
        if (!isLegacy(state.config)) return current;
        const legacy = LegacyGameTemplateSource.buildConfig(state);
        const originalTheme = copy(legacy.theme);
        // User-entered branding and source data are shared workbench features.
        // Page definitions, category counts and navigation remain the old ones.
        originalTheme.siteTitle = current.theme.siteTitle;
        originalTheme.logoText = current.theme.logoText;
        originalTheme.siteSubtitle = current.theme.siteSubtitle;
        for (const page of Object.values(originalTheme.pages)) {
            for (const key of Object.keys(page)) {
                if (typeof page[key] === 'string') page[key] = page[key]
                    .replace(/GameHub/g, () => originalTheme.siteTitle)
                    .replace(/contact@gamehub\.com/gi, () => state.config.contactEmail || 'contact@gamehub.com');
            }
        }
        const placements = copy(current.adPlacements);
        // Resolve shared semantic ad positions to the locations understood by
        // the copied renderer. No ad code or slot IDs are owned by this module.
        for (const pages of Object.values(placements)) {
            if (pages.home === 'content-middle') pages.home = legacy.structure.categories.length > 1
                ? 'after-section-' + Math.max(0, Math.ceil(legacy.structure.categories.length / 2) - 1)
                : 'cat-0-after-last';
            if (pages.detail === 'detail-middle') pages.detail = 'detail-before-related';
        }
        return Object.assign({}, current, legacy, {
            theme: originalTheme,
            templateVersion: 'legacy',
            adPlacements: placements,
            structure: Object.assign({}, legacy.structure, { hasAllItemsPage: false }),
            style: Object.assign({}, legacy.style, { siteMotion: null, ambientEffect: 'none' })
        });
    }

    function finishHTML(html, config, options) {
        // The copied templates used unconditional ad script tags. Script
        // ownership stays with the host, including its selected ad.js version.
        html = html.replace(/<script\b[^>]*src=["'][^"']*(?:securepubads\.g\.doubleclick\.net|(?:^|\/)ad\.js)[^"']*["'][^>]*>\s*<\/script>/gi, '');
        if (options.adScripts) html = html.replace('</head>', options.adScripts + '\n</head>');
        html = html.replace('<body>', '<body data-game-template-version="legacy">');
        return html;
    }

    function render(name, args, config, options) {
        options = options || {};
        let renderingConfig = config;
        if (name === 'generateScriptJs') {
            // data.json already contains paths resolved by the host asset
            // exporter. Avoid prefixing inline images or images/ twice.
            renderingConfig = Object.assign({}, config, { isLocalImages: false });
            args = [renderingConfig];
        } else if (name === 'generateDetailHtml') {
            // Resolve only export-relative image paths. All page markup and
            // image positioning remain in the original renderer.
            const mapping = config.fieldMapping;
            const items = args[2].map(item => {
                const record = Object.assign({}, item);
                const image = String(record[mapping.image] || '').replace(/\\/g, '/');
                if (image && !/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(image)) {
                    record[mapping.image] = config.isLocalImages ? '../images/' + image.split('/').pop() : '../' + image.replace(/^\.\//, '');
                }
                return record;
            });
            renderingConfig = Object.assign({}, config, { isLocalImages: false });
            args = [items[args[1]], args[1], items, renderingConfig];
        }
        // Prime the original font link before rendering any exported page.
        if (name !== 'generateCSS') LegacyGameTemplateSource.render('generateCSS', [config], config, options.adTemplates || {});
        const result = LegacyGameTemplateSource.render(name, args, renderingConfig, options.adTemplates || {});
        if (name === 'generateCSS' || name === 'generateScriptJs') return result;
        let html = finishHTML(result, config, options);
        if (name === 'generateDetailHtml') {
            // Local source entries live beside the catalog, one level above
            // details/. This adjusts only relative asset URLs, not the layout.
            html = html.replace(/(href|src)="(games\/[^"<>]+)"/g, '$1="../$2"');
        }
        return html;
    }

    function preview(state, page, config, options) {
        const mapping = state.fieldMapping;
        const images = state.localImageDataUrls || {};
        const cached = state.isLocalImages && typeof PreviewImageCache !== 'undefined'
            ? PreviewImageCache.acquire(state.localImages || {}) : null;
        if (cached) state._previewBlobUrls = cached.urls;
        const records = state.data.map(item => {
            const result = Object.assign({}, item);
            const path = String(item[mapping.image] || '').replace(/\\/g, '/');
            if (state.isLocalImages) result[mapping.image] = images[path] || images[path.split('/').pop()]
                || (cached && cached.byFilename[path.split('/').pop()]) || item[mapping.image];
            return result;
        });
        // The old detail preview renders the first record. Reorder a private
        // view so clicking a card in the host still previews that exact game.
        const selected = Number(state.selectedPreviewGameIndex) || 0;
        const previewData = page === 'detail' && records[selected]
            ? [records[selected], ...records.filter((_, index) => index !== selected)] : records;
        const previewState = Object.assign({}, state, { data: previewData, isLocalImages: false, _previewBlobUrls: [] });
        const previewConfig = Object.assign({}, config, { isLocalImages: false });
        const containers = {};
        for (const [id, markup] of Object.entries(options.adTemplates || {})) {
            containers[id] = markup.replace(/(<div id="div-gpt-ad-banner\d"[^>]*>)/,
                '$1<div style="width:300px;height:250px;display:grid;place-items:center;background:#e5f2ff;color:#185891;border:1px dashed #75a7e8;box-sizing:border-box">' + id + ' · 广告预览</div>');
        }
        let html = render('generatePreviewHtml', [previewState, page === 'all' ? 'home' : page], previewConfig,
            { adTemplates: containers });
        // The existing host owns preview navigation. Capture card clicks before
        // the copied preview's generic link handler; no exported-site listener is changed.
        const script = `<script>
document.addEventListener('click',function(event){
  var card=event.target.closest('.item-card');
  if(!card)return;
  event.preventDefault();event.stopImmediatePropagation();
  var cards=Array.from(document.querySelectorAll('.item-card'));
  window.parent.postMessage({type:'preview-game',index:cards.indexOf(card)},'*');
},true);
</script>`;
        return html.replace('</body>', script + '</body>');
    }

    function syncControls(document, config) {
        const legacy = isLegacy(config);
        document.querySelectorAll('[data-game-template-only]').forEach(element => {
            element.hidden = element.dataset.gameTemplateOnly !== (legacy ? 'legacy' : 'current');
        });
        const picker = document.getElementById('game-template-version');
        if (picker) picker.value = legacy ? 'legacy' : 'current';
        // Swap option definitions rather than appending old-only values to the
        // current system. Thus each version keeps its actual supported choices.
        for (const [id, choices] of Object.entries(LegacyGameTemplateSource.controls)) {
            const select = document.getElementById(id);
            if (!select || !choices.length) continue;
            if (!currentOptions.has(id)) currentOptions.set(id, { html: select.innerHTML, disabled: select.disabled });
            const current = currentOptions.get(id);
            select.innerHTML = legacy ? choices.map(option => '<option value="' + option.value + '">' + option.label + '</option>').join('') : current.html;
            select.disabled = legacy ? false : current.disabled;
        }
        document.querySelectorAll('#legacy-nav-links-config input').forEach(input => {
            input.checked = (config.navLinks || []).includes(input.value);
        });
        // Hide controls which have no meaning in the copied renderer.
        ['ambient-effect', 'icon-set-select', 'category-icons-enabled', 'card-description-mode'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const row = element.closest('.config-item');
                row.hidden = legacy;
                row.style.display = legacy ? 'none' : '';
            }
        });
        const ambient = document.getElementById('ambient-effect');
        if (ambient) ambient.closest('.config-group').style.display = legacy ? 'none' : '';
        ['viewport-reveal-enabled', 'card-interaction-enabled', 'card-domain-icon-enabled', 'card-arrow-enabled', 'card-glow-color', 'card-glow-custom-row', 'logo-icon-trigger'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const row = element.closest('.config-item') || element;
                row.hidden = legacy;
                row.style.display = legacy ? 'none' : '';
            }
        });
        // SiteMotion intentionally hides these for the current renderer. The
        // copied renderer supports them, so expose its original controls again.
        ['animation-enter', 'card-hover'].forEach(id => {
            const element = document.getElementById(id);
            if (!element) return;
            const row = element.closest('.config-item');
            row.style.display = legacy ? '' : 'none';
            const label = row.querySelector('label');
            if (label) label.hidden = !legacy && id === 'animation-enter';
        });
        const buttonNote = document.getElementById('btn-style-condition-note');
        if (buttonNote) { buttonNote.hidden = legacy; buttonNote.style.display = legacy ? 'none' : ''; }
    }

    return { isLegacy, switchVersion, buildConfig, render, preview, syncControls };
})();
