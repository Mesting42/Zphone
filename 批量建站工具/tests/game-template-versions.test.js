import { describe, it, expect } from 'vitest';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { parseHTML } from 'linkedom';

const root = resolve('game-builder');
const read = path => readFileSync(resolve(root, path), 'utf8');
function createRuntime(random = Math.random) {
    const context = vm.createContext({ console, setTimeout, URL, Blob, JSZip, Math: Object.assign(Object.create(Math), { random }), ArchiveExport: {
        generate(zip, options) { return zip.generateAsync({ ...options, type: 'nodebuffer' }); }
    } });
    for (const path of ['../js/template-catalog.js', '../js/template-layouts.js', '../js/navbar-layout.js',
        'js/data.js', 'js/ad-migration.js', 'js/legacy-template-source.js', 'js/game-template-versions.js', 'js/generator.js']) {
        vm.runInContext(read(path), context, { filename: path });
    }
    vm.runInContext('globalThis.api={versions:GameTemplateVersions,source:LegacyGameTemplateSource,generator:Generator,presets:LAYOUT_PRESETS,styles:STYLE_PRESETS}', context);
    return context.api;
}
function state(config) {
    return {
        selectedTheme: 'game', siteBuildMode: 'normal', normalAdMode: 'none', isLocalImages: false,
        fieldMapping: { id: 'id', title: 'title', content: 'description', image: 'thumb', store_url: 'url' },
        data: Array.from({ length: 18 }, (_, i) => ({ id: i + 1, title: 'Game ' + (i + 1),
            description: 'A description.\n\nSecond paragraph.', thumb: 'https://example.test/game.webp', url: 'https://example.test/play' })),
        localImages: {}, localImageDataUrls: {}, localGameFiles: {}, _previewBlobUrls: [], config
    };
}

describe('independent new and legacy game templates', () => {
    it('reflects visibility instead of showing a stale line limit, and enables mapped descriptions', () => {
        const { versions, source } = createRuntime();
        const config = { ...source.defaults(), templateVersion: 'legacy' };
        expect(versions.cardSummaryValue(config)).toBe('none');
        versions.setCardSummary(config, '2');
        expect(config.cardFields).toEqual(['image', 'title', 'content']);
        expect(versions.cardSummaryValue(config)).toBe('2');
        versions.setCardSummary(config, 'none');
        expect(config.cardFields).toEqual(['image', 'title']);
        expect(config.cardDescLines).toBe('2');
        config.cardFields = ['title', 'excerpt', 'image'];
        versions.setCardSummary(config, '4');
        expect(config.cardFields).toEqual(['title', 'excerpt', 'image']);
        versions.setCardSummary(config, 'none');
        expect(config.cardFields).toEqual(['title', 'image']);
    });

    it.each(['1', '2', '3', '4', '0'])('keeps enabled summary limit %s in preview and exported CSS after mobile rules', async value => {
        const { versions, source, generator } = createRuntime();
        const config = { ...source.defaults(), templateVersion: 'legacy' };
        versions.setCardSummary(config, value);
        const app = state(config);
        const built = generator.buildConfig(app);
        const preview = generator.generatePreviewHtml(app, 'home');
        const { document } = parseHTML(preview);
        expect(document.querySelector('.card-desc').textContent).toContain('A description.');
        const css = versions.render('generateCSS', [built], built);
        const override = css.slice(css.lastIndexOf('/* Legacy card summary:'));
        expect(override).toContain('display: ' + (value === '0' ? 'block' : '-webkit-box'));
        expect(override).toContain('-webkit-line-clamp: ' + (value === '0' ? 'unset' : value));
        expect(document.querySelector('style').textContent).toBe(css);
        const zip = await JSZip.loadAsync(await generator.exportWebsite(app, () => {}));
        expect(await zip.file('website/css/style.css').async('string')).toBe(css);
        expect(await zip.file('website/js/script.js').async('string')).toContain('"content"');
        expect(app.config.cardFields).toEqual(['image', 'title', 'content']);
    });

    it('restores independent summary choices when switching template versions', () => {
        const { versions } = createRuntime();
        const current = { templateVersion: 'current', cardFields: ['image', 'title', 'content'], cardDescLines: '3' };
        const legacy = versions.switchVersion(current, 'legacy');
        expect(versions.cardSummaryValue(legacy)).toBe('none');
        versions.setCardSummary(legacy, '4');
        const restored = versions.switchVersion(legacy, 'current');
        expect(versions.cardSummaryValue(restored)).toBe('3');
        expect(versions.cardSummaryValue(versions.switchVersion(restored, 'legacy'))).toBe('4');
    });

    it('preserves the copied source bytes and exposes only presentation/configuration', () => {
        const { source } = createRuntime();
        for (const [path, hash] of Object.entries(source.hashes)) {
            expect(createHash('sha256').update(readFileSync(resolve(root, 'legacy-source', path))).digest('hex')).toBe(hash);
        }
        expect(source.hashes['js/generator.js']).toBe('8e135262e80c11369693d2b5736d060238a21f4da62764364e7a2b6b6903e78b');
        expect(source.exportWebsite).toBeUndefined();
        expect(source.generateAdJs).toBeUndefined();
    });

    it('restores both versions deeply without overwriting the shared ad settings', () => {
        const { versions, source } = createRuntime();
        const current = { templateVersion: 'current', layoutTemplate: 'poster', selectedStyle: 'light',
            categories: [{ name: 'New category', icon: '🎮', count: 2 }], adPlacements: { adv1: { home: 'footer-top' } } };
        let legacy = versions.switchVersion(current, 'legacy');
        expect(legacy.navLinks).toEqual(['home', 'privacy', 'terms', 'contact', 'about']);
        expect(legacy.categories).toEqual(source.defaults().categories);
        legacy.navbarStyle = 'bottom-fixed';
        legacy.categories[0].count = 9;
        legacy.adPlacements.adv1.home = 'after-navbar';
        const restored = versions.switchVersion(legacy, 'current');
        expect(restored.layoutTemplate).toBe('poster');
        expect(restored.categories[0].count).toBe(2);
        expect(restored.adPlacements.adv1.home).toBe('after-navbar');
        legacy = versions.switchVersion(restored, 'legacy');
        expect(legacy.navbarStyle).toBe('bottom-fixed');
        expect(legacy.categories[0].count).toBe(9);
        expect(current.categories[0].count).toBe(2);
    });

    it('runs the actual original randomizer against the original palette collection', () => {
        function seeded() { let value = 42; return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; }; }
        const { source, presets, styles } = createRuntime(seeded());
        const original = vm.createContext({ console, document: {
            querySelectorAll: () => [], getElementById: () => ({ addEventListener() {}, style: {} }),
        }, Math: Object.assign(Object.create(Math), { random: seeded() }) });
        // Extract the original random function without starting its application.
        const app = read('legacy-source/js/app.js');
        const start = app.indexOf('    function randomPick(');
        const end = app.indexOf('    function applyConfigToUI()', start);
        vm.runInContext(read('legacy-source/js/data.js') + '\nconst appState={config:{}};\n' + app.slice(start, end) + '\nglobalThis.randomize=generateRandomConfig;globalThis.state=appState;', original);
        const config = source.defaults();
        original.state.config = JSON.parse(JSON.stringify(config));
        const oldLayouts = JSON.stringify(presets);
        const oldStyles = JSON.stringify(styles);
        const values = new Set();
        for (let i = 0; i < 200; i++) {
            source.randomize(config);
            original.randomize();
            expect(JSON.parse(JSON.stringify(config))).toEqual(JSON.parse(JSON.stringify(original.state.config)));
            expect(source.presets.some(item => item.id === config.selectedStyle)).toBe(true);
            expect(['card', 'list']).toContain(config.cardViewMode);
            expect(['single', 'sidebar']).toContain(config.detailLayout);
            values.add(config.navbarStyle);
        }
        expect(values.has('bottom-fixed')).toBe(true);
        expect(JSON.stringify(presets)).toBe(oldLayouts);
        expect(JSON.stringify(styles)).toBe(oldStyles);
    });

    it('keeps original CSS, category counts, fixed navigation and the old detail layout', () => {
        const { source, generator } = createRuntime();
        const config = { ...source.defaults(), templateVersion: 'legacy', navbarStyle: 'bottom-fixed', btnStyle: '3d',
            cardViewMode: 'list', detailLayout: 'sidebar', selectedStyle: 'lavender' };
        config.categories[0].count = 7;
        const app = state(config);
        const built = generator.buildConfig(app);
        expect(built.structure.categories[0].count).toBe(7);
        expect(built.style.navbarStyle).toBe('bottom-fixed');
        expect(built.style.btnStyle).toBe('3d');
        expect(built.structure.hasAllItemsPage).toBe(false);
        const home = generator.generatePreviewHtml(app, 'home');
        const { document } = parseHTML(home);
        expect(Array.from(document.querySelectorAll('.nav-links a')).map(a => a.getAttribute('href'))).toEqual([
            'index.html', 'privacy.html', 'terms.html', 'contact.html', 'about.html'
        ]);
        expect(document.querySelectorAll('.category-section')[0].querySelectorAll('.item-card').length).toBe(7);
        expect(home).not.toContain('category-featured');
        expect(home).not.toContain('data-template-layout');
        expect(document.querySelector('style').textContent).toBe(source.render('generateCSS', [built], built, {}));
        expect(generator.generatePreviewHtml(app, 'detail')).toContain('detail-sidebar');
        for (const page of ['about', 'contact', 'privacy', 'terms']) {
            expect(generator.generatePreviewHtml(app, page)).toContain('data-game-template-version="legacy"');
        }
    });

    it('exports a complete legacy site, local games and current ad runtime without adding the new catalog page', async () => {
        const { source, generator } = createRuntime();
        const app = state({ ...source.defaults(), templateVersion: 'legacy', selectedStyle: 'lavender' });
        app.normalAdMode = 'reserve';
        app.reservePlacementMode = 'fixed';
        app.localGameFiles = { 'sample.html': '<!doctype html><title>Sample</title>' };
        app.data[0].url = 'games/sample.html';
        app.isLocalImages = true;
        app.localImages = { 'covers/sample.webp': Buffer.from('local-cover') };
        app.data[0].thumb = 'covers/sample.webp';
        app.data[1].thumb = 'data:image/png;base64,iVBORw0KGgo=';
        app.data[2].id = 'source/../game';
        const bytes = await generator.exportWebsite(app, () => {});
        const zip = await JSZip.loadAsync(bytes);
        for (const path of ['index.html', 'about.html', 'contact.html', 'privacy.html', 'terms.html',
            'css/style.css', 'js/script.js', 'js/ad.js', 'data.json', 'details/article1.html', 'games/sample.html']) {
            expect(zip.file('website/' + path), path).not.toBeNull();
        }
        expect(zip.file('website/all-games.html')).toBeNull();
        const home = await zip.file('website/index.html').async('string');
        expect(home.match(/securepubads\.g\.doubleclick\.net/g)).toHaveLength(1);
        for (const slot of ['adv1', 'adv2', 'adv3']) expect(home).toContain('id="' + slot + '"');
        const detail = await zip.file('website/details/article1.html').async('string');
        expect(detail).toContain('href="../games/sample.html"');
        expect(detail).toContain('src="../images/sample.webp"');
        const inlineImagePage = await zip.file('website/details/article2.html').async('string');
        expect(inlineImagePage).toContain('src="data:image/png;base64,iVBORw0KGgo="');
        const data = JSON.parse(await zip.file('website/data.json').async('string'));
        expect(zip.file('website/details/article' + data[2].id + '.html')).not.toBeNull();
        expect(app.data[2].id).toBe('source/../game');
        expect(detail).toContain('../js/ad.js?v=');
        expect(home).not.toContain('data-template-layout');
    });
});
