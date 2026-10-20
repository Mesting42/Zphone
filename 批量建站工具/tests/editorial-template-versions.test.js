import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import JSZip from 'jszip';
import { parseHTML } from 'linkedom';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
function seeded() { let v = 73; return () => { v = (v * 1664525 + 1013904223) >>> 0; return v / 4294967296; }; }
function runtime() {
    const context = vm.createContext({ console, URL, Blob, JSZip, setTimeout, window: {},
        Math: Object.assign(Object.create(Math), { random: seeded() }),
        ArchiveExport: { generate(zip, options) { return zip.generateAsync({ ...options, type: 'nodebuffer' }); } }
    });
    // Browser UMD helpers attach to window, which is the global object there.
    context.window = context;
    for (const name of ['template-catalog', 'template-layouts', 'navbar-layout', 'data', 'template-packages', 'archive-naming',
        'ad', 'ad-migration', 'export-preflight', 'legacy-editorial-template-source', 'editorial-template-versions', 'generator', 'batch-ad-builder']) {
        vm.runInContext(read('js/' + name + '.js'), context, { filename: name + '.js' });
    }
    vm.runInContext('this.api={source:LegacyEditorialTemplateSource,versions:EditorialTemplateVersions,generator:Generator,batch:BatchAdBuilder,themes:THEMES,presets:TEMPLATE_PRESETS,migration:AdMigration}', context);
    return context.api;
}
function state(config, domain = 'tech') {
    return { selectedTheme: domain, siteBuildMode: 'normal', normalAdMode: 'none',
        fieldMapping: { title: 'title', content: 'description', image: 'cover', excerpt: 'summary', id: 'id' },
        data: Array.from({ length: 14 }, (_, i) => ({ id: i + 1, title: 'Article ' + (i + 1),
            description: 'Paragraph one.\n\nParagraph two.', summary: 'A useful summary.', cover: 'data:image/png;base64,iVBORw0KGgo=' })),
        jsonFields: [], config, isLocalImages: false, localImages: {}, _previewBlobUrls: [] };
}
function currentConfig(api, domain = 'tech') {
    const theme = api.themes[domain];
    return { ...api.source.defaults('tech'), editorialTemplateVersion: 'current', templateId: domain + '-blueprint-01',
        homeLayout: 'standard', categories: JSON.parse(JSON.stringify(theme.categories)), cardFields: theme.cardFields.slice(),
        siteTitle: 'Current brand', contactEmail: 'hello@example.test' };
}

describe('isolated legacy editorial templates', () => {
    it('keeps all four source themes and byte-identical source snapshots', () => {
        const { source } = runtime();
        expect(Object.keys(source.themes)).toEqual(['tech', 'game', 'food', 'anime']);
        expect(source.presets).toHaveLength(27);
        for (const [name, hash] of Object.entries(source.hashes)) {
            expect(createHash('sha256').update(readFileSync(new URL('../legacy-editorial-source/' + name, import.meta.url))).digest('hex')).toBe(hash);
        }
        expect(source.exportWebsite).toBeUndefined();
        expect(source.generateAdJs).toBeUndefined();
    });

    it('matches the actual original randomizer for 200 seeded combinations without changing current presets', () => {
        const { source, presets } = runtime();
        const original = vm.createContext({ Math: Object.assign(Object.create(Math), { random: seeded() }) });
        const app = read('legacy-editorial-source/js/app.js');
        const start = app.indexOf('    function randomPick('), end = app.indexOf('    function applyConfigToUI()', start);
        vm.runInContext(read('legacy-editorial-source/js/data.js') + '\nconst appState={config:{}};\n' + app.slice(start, end) + '\nthis.randomize=generateRandomConfig;this.state=appState;', original);
        const config = source.defaults('food');
        original.state.config = JSON.parse(JSON.stringify(config));
        const before = JSON.stringify(presets);
        for (let i = 0; i < 200; i++) {
            source.randomize(config); original.randomize();
            expect(JSON.parse(JSON.stringify(config))).toEqual(JSON.parse(JSON.stringify(original.state.config)));
        }
        expect(JSON.stringify(presets)).toBe(before);
    });

    it('keeps snapshots per site and preserves shared ad object references during switching', () => {
        const api = runtime(), a = currentConfig(api), b = currentConfig(api, 'food');
        a.selectedStyle = 'light'; b.selectedStyle = 'dark';
        const placements = a.adPlacements = { adv1: { home: 'after-navbar' } };
        let oldA = api.versions.switchVersion(a, 'legacy', 'tech');
        let oldB = api.versions.switchVersion(b, 'legacy', 'food');
        oldA.navbarStyle = 'bottom-fixed'; oldB.navbarStyle = 'side-drawer';
        oldA.categories[0].count = 8; oldB.categories[0].count = 3;
        expect(oldA.adPlacements).toBe(placements);
        const newA = api.versions.switchVersion(oldA, 'current', 'tech');
        const newB = api.versions.switchVersion(oldB, 'current', 'food');
        expect(newA.selectedStyle).toBe('light'); expect(newB.selectedStyle).toBe('dark');
        oldA = api.versions.switchVersion(newA, 'legacy', 'tech');
        oldB = api.versions.switchVersion(newB, 'legacy', 'food');
        expect(oldA.navbarStyle).toBe('bottom-fixed'); expect(oldB.navbarStyle).toBe('side-drawer');
        expect(oldA.categories[0].count).toBe(8); expect(oldB.categories[0].count).toBe(3);
    });

    it('uses the original CSS/navigation and public pages for all original themes', () => {
        const api = runtime();
        for (const domain of Object.keys(api.source.themes)) {
            const config = { ...api.source.defaults(domain), editorialTemplateVersion: 'legacy', legacyThemeId: domain,
                selectedStyle: 'lavender', cardViewMode: 'list', detailLayout: 'sidebar', navbarStyle: 'bottom-fixed' };
            config.categories[0].count = 7;
            const app = state(config, domain), built = api.generator.buildConfig(app);
            const html = api.generator.generatePreviewHtml(app, 'home');
            const { document } = parseHTML(html);
            expect(document.querySelector('style').textContent).toBe(api.source.render('generateCSS', [built], built, {}));
            expect(Array.from(document.querySelectorAll('.nav-links a')).map(a => a.getAttribute('href'))).toEqual([
                'index.html', 'privacy.html', 'terms.html', 'contact.html', 'about.html'
            ]);
            expect(document.querySelectorAll('.category-section')[0].querySelectorAll('.item-card')).toHaveLength(7);
            expect(html).not.toContain('data-template-heading');
            expect(html).not.toContain('data-template-package');
            for (const page of ['detail', 'about', 'contact', 'privacy', 'terms']) {
                expect(api.generator.generatePreviewHtml(app, page, 1)).toContain('data-editorial-template-version="legacy"');
            }
            expect(api.generator.generatePreviewHtml(app, 'detail', 1)).toContain('Article 2');
        }
    });

    it('retains fingerprinted CSS, inline fallback, manifest and local images in real legacy ZIP exports', async () => {
        const api = runtime();
        const config = { ...api.source.defaults('tech'), editorialTemplateVersion: 'legacy', legacyThemeId: 'tech',
            selectedStyle: 'lavender', cardViewMode: 'list', detailLayout: 'sidebar' };
        const app = state(config);
        app.isLocalImages = true; app.localImages = { 'source/cover.webp': Buffer.from('local-image') };
        app.data[0].cover = 'source/cover.webp';
        app._lastPreviewSignature = api.generator.getBuildSignature(app);
        const zip = await JSZip.loadAsync(await api.generator.exportWebsite(app, () => {}));
        const manifest = JSON.parse(await zip.file('website/SITE_RENDER_MANIFEST.json').async('string'));
        expect(manifest.templateVersion).toBe('legacy');
        expect(manifest.renderSignature).toBe(app._lastPreviewSignature);
        const home = await zip.file('website/index.html').async('string');
        expect(home).toContain('css/' + manifest.assets.style);
        expect(home).toContain('js/' + manifest.assets.script);
        expect(home).toContain('data-generated-site-style');
        expect(home).not.toContain('securepubads.g.doubleclick.net');
        expect(zip.file('website/all-articles.html')).toBeNull();
        expect(zip.file('website/js/ad.js')).toBeNull();
        expect(await zip.file('website/details/article1.html').async('string')).toContain('src="../images/cover.webp"');
        expect(await zip.file('website/details/article2.html').async('string')).toContain('src="data:image/png;base64,iVBORw0KGgo="');
        expect(zip.file('website/images/cover.webp')).not.toBeNull();
    });

    it('allows multiple legacy sites while retaining current duplicate-template validation', async () => {
        const api = runtime();
        const oldConfig = { ...api.source.defaults('tech'), editorialTemplateVersion: 'legacy', legacyThemeId: 'tech', templateId: null, allArticlesEnabled: false };
        const sites = [1, 2].map(n => ({ id: 'site-' + n, fileName: 'site-' + n + '.json', themeId: 'tech',
            data: state(oldConfig).data, fieldMapping: state(oldConfig).fieldMapping, config: JSON.parse(JSON.stringify(oldConfig)), adDomain: 'site' + n + '.example.test' }));
        const batch = { adMode: 'reserve', reserveDefaults: { placementMode: 'fixed', adJsVersion: 'v1.0.2.1', adPlacements: {} } };
        expect(api.batch.validateAssignments(sites, [], batch).valid).toBe(true);
        for (const site of sites) {
            const app = api.batch.createSiteState(state(currentConfig(api)), site, null, batch);
            const zip = await JSZip.loadAsync(await api.generator.exportWebsite(app, () => {}));
            const html = await zip.file('website/index.html').async('string');
            for (const slot of ['adv1', 'adv2', 'adv3']) expect(html).toContain('id="' + slot + '"');
            expect(html.match(/securepubads\.g\.doubleclick\.net/g)).toHaveLength(1);
            expect(api.migration.validateGeneratedPage(html, 'home', api.generator.buildConfig(app).adPlacements)).toHaveLength(0);
        }
        sites.forEach(site => { site.config = currentConfig(api); });
        expect(api.batch.validateAssignments(sites, [], batch).errors.some(e => e.code === 'BATCH_TEMPLATE_REUSED')).toBe(true);
    });

    it('does not route excluded workflows through the legacy renderer', () => {
        const api = runtime(), config = currentConfig(api);
        config.editorialTemplateVersion = 'legacy'; config.legacyThemeId = 'tech';
        const app = state(config); app.siteBuildMode = 'ad-migration';
        expect(api.generator.buildConfig(app).editorialTemplateVersion).not.toBe('legacy');
        expect(api.versions.eligible({ siteBuildMode: 'ad-restoration' })).toBe(false);
        expect(api.versions.eligible({ siteBuildMode: 'differentiated' })).toBe(false);
    });

    it('keeps batch legacy preview and export signatures identical with domain emails and reserved ads', () => {
        const api = runtime();
        const config = { ...api.source.defaults('food'), editorialTemplateVersion: 'legacy', legacyThemeId: 'food', templateId: null, allArticlesEnabled: false,
            contactEmail: 'contact@editorial-a.example.test' };
        const preview = state(config);
        const site = { themeId: 'tech', config, data: preview.data, fieldMapping: preview.fieldMapping, jsonFields: [], adDomain: 'editorial-a.example.test' };
        const batch = { adMode: 'reserve', reserveDefaults: { placementMode: 'fixed', adJsVersion: 'v1.0.2.1', adPlacements: {} } };
        Object.assign(preview, { siteBuildMode: 'batch-ad-build', batchAdBuild: batch, reservePlacementMode: 'fixed', adJsVersion: 'v1.0.2.1' });
        const exportState = api.batch.createSiteState(preview, site, null, batch);
        expect(api.generator.getBuildSignature(preview)).toBe(api.generator.getBuildSignature(exportState));
    });

    it('invalidates inactive previews after changing batch template defaults without touching a site override', () => {
        const api = runtime();
        const sites = [false, true].map(override => ({ themeId: 'tech', config: currentConfig(api), editorialTemplateOverrideEnabled: override, previewSignature: 'previous-preview' }));
        const batch = { sites, editorialTemplateDefaults: { version: 'legacy', legacyThemeId: 'food' } };
        const appSource = read('js/app.js');
        const extract = (name, next) => appSource.slice(appSource.indexOf('    function ' + name + '('), appSource.indexOf('    function ' + next + '('));
        const context = vm.createContext({ EditorialTemplateVersions: api.versions, ensureBatchAdBuildState: () => batch, createThemeConfig: () => currentConfig(api) });
        vm.runInContext(extract('invalidateBatchSitePreviews', 'syncBatchActiveSiteToApp') + extract('applyBatchEditorialVersion', 'syncEditorialTemplateScope') + '\nthis.apply=applyBatchEditorialVersion;', context);
        sites.forEach(context.apply);
        expect(sites[0].config.legacyThemeId).toBe('food');
        expect(sites[0].previewSignature).toBe('');
        expect(sites[1].config.editorialTemplateVersion).toBe('current');
        expect(sites[1].previewSignature).toBe('previous-preview');
    });

    it('exports independently deployable legacy and current ZIPs together after complete batch checks', async () => {
        const api = runtime(), normal = state(currentConfig(api));
        const old = api.versions.switchVersion(currentConfig(api), 'legacy', 'tech');
        const configs = [old, currentConfig(api)];
        const sites = configs.map((config, index) => ({ id: 'mixed-' + index, fileName: 'mixed-' + index + '.json', themeId: 'tech',
            data: normal.data, fieldMapping: normal.fieldMapping, jsonFields: [], config, adDomain: 'mixed-' + index + '.example.test' }));
        const batch = { sites, codes: [], adMode: 'reserve', reserveDefaults: { placementMode: 'fixed', adJsVersion: 'v1.0.2.1', adPlacements: {} } };
        const app = { ...normal, siteBuildMode: 'batch-ad-build', batchAdBuild: batch };
        // Both signatures come from the same resolved site state used by the UI.
        sites.forEach(site => { site.previewSignature = api.generator.getBuildSignature(api.batch.createSiteState(app, site, null, batch)); });
        const result = await api.batch.exportBatch(app, () => {}, JSZip);
        expect(result.reports).toHaveLength(2);
        expect(result.reports.every(report => report.valid)).toBe(true);
        expect(result.preflightReport.valid).toBe(true);
        for (const [index, download] of result.downloads.entries()) {
            const zip = await JSZip.loadAsync(download.blob);
            const root = 'mixed-' + index + '.example.test/';
            const html = await zip.file(root + 'index.html').async('string');
            expect(html.includes('data-editorial-template-version="legacy"')).toBe(index === 0);
            expect(!!zip.file(root + 'all-articles.html')).toBe(index === 1);
            expect(Object.keys(zip.files).filter(name => /details\/[^/]+\.html$/.test(name))).toHaveLength(normal.data.length);
        }
    });
});
