import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import JSZip from 'jszip';
import { QUICK_AD_VERSION, planQuickAdUpdate, prepareQuickAdUpdate, applyQuickAdUpdate } from '../js/ad-quick-update.js';

// 与真实工具一样加载模板及共享引擎，验证生成结果而非模拟其内部实现。
const context = { TextEncoder, TextDecoder, Blob, JSZip, window: {} };
for (const name of ['template-catalog.js', 'template-layouts.js', 'navbar-layout.js', 'data.js', 'domain.js', 'ad-migration.js', 'ad.js', 'generator.js', 'finished-site-ads.js', 'ad-restoration.js']) {
    vm.runInNewContext(readFileSync(new URL('../js/' + name, import.meta.url), 'utf8'), context);
}
const engine = context.window.AdRestoration;
const generator = vm.runInNewContext('Generator', context);
const config = (host, aliases = false, ga = 'G-OLD123') => ({
    bannerPath1: '/23334460889/' + host + (aliases ? '-banner11' : '-banner1'),
    bannerPath2: '/23334460889/' + host + (aliases ? '-banner22' : '-banner2'),
    bannerPath3: '/23334460889/' + host + (aliases ? '-banner33' : '-banner3'),
    interstitialPath: '/23334460889/' + host + (aliases ? '-INT1' : '-INT'),
    anchorPath: '/23334460889/' + host + (aliases ? '-ANC1' : '-ANC'), analyticsID: ga
});
const decode = (output, path) => new TextDecoder().decode(output.entries.find(entry => entry.path === path).bytes);
const page = (kind, ads = [1, 2, 3]) => '<!doctype html><html><head><title>Keep title</title><link rel="stylesheet" href="css/site.css"></head><body><nav class="navbar">Navigation</nav>' +
    '<main class="' + (kind === 'detail' ? 'detail-page' : '') + '">' + ads.map(index => generator.getAdTemplate('adv' + index)).join('') +
    (kind === 'detail' ? '<article class="detail-content"><p>Original text.</p><p>Second paragraph.</p></article>' : '<section class="category-section">Original content.</section>') +
    '</main><footer class="footer">Original footer</footer><script src="' + (kind === 'detail' ? '../' : '') + 'js/ad.js?v=old"></script></body></html>';
function fixture(host = 'one.example.com', version = 'v1.0.0', game = false) {
    const entries = [{ path: 'index.html', text: page('home') }, { path: 'details/one.html', text: page('detail') },
        { path: game ? 'all-games.html' : 'all-articles.html', text: page('all') },
        { path: 'js/ad.js', text: generator.generateSelectedAdJs(config(host), version) },
        { path: 'css/site.css', text: 'body{color:#123456}' }, { path: 'about.html', text: '<h1>Original legal page</h1>' },
        { path: 'images/cover.webp', bytes: new Uint8Array([0, 255, 1, 6]) }];
    if (game) entries.push({ path: 'vendor-games/test/index.html', text: '<canvas id="game"></canvas>' });
    return { id: host, name: host, entries, metadata: engine.inspectSiteEntries(entries, host) };
}
function staticGameFixture(host = 'launchy.example.com') {
    const entries = [
        { path: 'index.html', text: page('home') },
        { path: 'games.html', text: page('all') },
        { path: 'games/one.html', text: page('detail') },
        { path: 'js/ad.js', text: generator.generateSelectedAdJs(config(host), 'v1.0.0') },
        { path: 'about.html', text: '<!doctype html><html><body><h1>About</h1></body></html>' },
        { path: 'contact.html', text: '<!doctype html><html><body><h1>Contact</h1></body></html>' },
        { path: 'privacy.html', text: '<!doctype html><html><body><h1>Privacy</h1></body></html>' },
        { path: 'cookie.html', text: '<!doctype html><html><body><h1>Cookie</h1></body></html>' },
        { path: 'terms.html', text: '<!doctype html><html><body><h1>Terms</h1></body></html>' },
        { path: 'styles.css', bytes: new Uint8Array([1, 2, 3]) }
    ];
    return { id: host, name: host, entries, metadata: engine.inspectSiteEntries(entries, host) };
}
const code = (host = 'one.example.com', ga = '') => engine.inspectCodeText(generator.generateSelectedAdJs(config(host, true, ga), QUICK_AD_VERSION), host + '.txt');
function reopened(source, result) {
    return { ...source, entries: result.entries, metadata: engine.inspectSiteEntries(result.entries, source.name) };
}
function oopCalls(source, page) {
    const calls = [], listeners = [], slot = { addService() { return this; }, setConfig() {} };
    const runtime = { console, window: { location: { pathname: page === 'home' ? '/index.html' : page === 'all' ? '/all-articles.html' : '/details/one.html' } },
        document: { documentElement: { getAttribute: () => page }, getElementById: () => ({}), addEventListener: (_, listener) => listeners.push(listener) } };
    runtime.googletag = runtime.window.googletag = { cmd: { push: callback => callback() }, setConfig() {}, defineSlot: () => slot, pubads: () => ({}),
        defineOutOfPageSlot: (path, format) => { calls.push(format); return slot; }, enums: { OutOfPageFormat: { INTERSTITIAL: 'INT', BOTTOM_ANCHOR: 'ANC' } }, enableServices() {}, display() {} };
    vm.runInNewContext(source.replace(/const gaMeasurementId = [^\r\n]*;/, 'const gaMeasurementId = "";'), runtime);
    listeners.forEach(listener => listener());
    return calls;
}

describe('quick ad update inside the policy workbench', () => {
    it('recognizes the colleague static game layout and leaves legal pages byte-identical', () => {
        const site = staticGameFixture();
        expect(site.metadata.valid).toBe(true);
        expect(site.metadata.homePath).toBe('index.html');
        expect(site.metadata.detailPaths).toEqual(['games/one.html']);
        expect(site.metadata.listingPaths).toEqual(['games.html']);
        const result = prepareQuickAdUpdate(site, code(site.id), {}, engine);
        expect(result.valid, JSON.stringify(result.errors)).toBe(true);
        expect(decode(result, 'js/ad.js')).toContain('ad.js v1.0.2.1');
        for (const legal of ['about.html', 'contact.html', 'privacy.html', 'cookie.html', 'terms.html']) {
            expect(Array.from(result.entries.find(entry => entry.path === legal).bytes)).toEqual(
                Array.from(site.entries.find(entry => entry.path === legal).bytes || new TextEncoder().encode(site.entries.find(entry => entry.path === legal).text))
            );
        }
        expect(decode(result, 'index.html')).toContain('data-sitefoundry-ad-page="home"');
        expect(decode(result, 'games.html')).toContain('data-sitefoundry-ad-page="all"');
    });
    it.each(['initial', 'v1.0.0', 'v1.0.1', 'v1.0.2', 'v1.0.2.1'])('upgrades %s and preserves every unrelated file and original active advertising gap', version => {
        const site = fixture(undefined, version);
        const result = prepareQuickAdUpdate(site, code(), {}, engine);
        expect(result.valid, JSON.stringify(result.errors)).toBe(true);
        const runtime = decode(result, 'js/ad.js');
        expect(runtime).toContain('ad.js v1.0.2.1');
        expect(runtime).toContain('one.example.com-banner11');
        expect(runtime).toContain('one.example.com-banner22');
        expect(runtime).toContain('one.example.com-banner33');
        expect(runtime).toContain('one.example.com-INT1');
        expect(runtime).toContain('one.example.com-ANC1');
        expect(runtime).toContain('if (isIndex && adUnitInterstitial)');
        expect(runtime).toContain('if (adUnitAnchor)');
        expect(result.updatedConfig.analyticsID).toBe('G-OLD123');
        for (const entry of site.entries) {
            if (entry.path === 'js/ad.js') continue;
            const exported = result.entries.find(item => item.path === entry.path);
            if (['index.html', 'details/one.html', 'all-articles.html'].includes(entry.path)) {
                expect(decode(result, entry.path).replace(/ data-sitefoundry-ad-page="[^"]*"/, '').replace(/\?v=quick-ad-[a-f0-9]+/, '?v=old')).toBe(entry.text);
            } else expect(Array.from(exported.bytes)).toEqual(Array.from(entry.bytes || new TextEncoder().encode(entry.text)));
        }
        expect(site.entries[3].text).toContain(version === 'initial' ? 'delayLoadBanner' : 'ad.js ' + version);
    });
    it('uses a new GA ID, falls back to the old GA, and handles both IDs being empty', () => {
        const site = fixture();
        expect(prepareQuickAdUpdate(site, code(undefined, 'G-NEW456'), {}, engine).updatedConfig.analyticsID).toBe('G-NEW456');
        expect(prepareQuickAdUpdate(site, code(), {}, engine).gaSource).toBe('原站');
        site.entries[3].text = generator.generateSelectedAdJs(config(site.id, false, ''), 'v1.0.0');
        site.metadata = engine.inspectSiteEntries(site.entries, site.name);
        expect(prepareQuickAdUpdate(site, code(), {}, engine).updatedConfig.analyticsID).toBe('');
    });
    it('changes the ad.js cache URL when the replacement changes, while keeping repeated output stable', () => {
        const site = fixture();
        const first = prepareQuickAdUpdate(site, code(), {}, engine);
        const second = prepareQuickAdUpdate(site, code(undefined, 'G-NEW456'), {}, engine);
        const url = output => decode(output, 'index.html').match(/js\/ad\.js\?v=quick-ad-[a-f0-9]+/)[0];
        expect(url(first)).not.toBe(url(second));
        expect(url(first)).toBe(url(prepareQuickAdUpdate(site, code(), {}, engine)));
    });
    it('rejects mismatched, duplicate, conflicting and missing TXT instead of using a single-file fallback', () => {
        const site = fixture();
        for (const codes of [[], [code('foreign.example.com')], [code(), code()]]) {
            expect(planQuickAdUpdate([site], codes).validCount).toBe(0);
        }
        const bad = engine.inspectCodeText(generator.generateSelectedAdJs(config(site.id, true), QUICK_AD_VERSION) + '\n// /23334460889/one.example.com-banner1', 'bad.txt');
        expect(bad.valid).toBe(false);
        expect(planQuickAdUpdate([site], [bad]).validCount).toBe(0);
    });
    it('updates only the chosen single site and binds multiple sites independently', async () => {
        const sites = [fixture(), fixture('two.example.com', 'initial', true)];
        const codes = [code(), code('two.example.com', 'G-TWO789')];
        const single = await applyQuickAdUpdate(sites, codes, { scope: 'single', siteId: sites[1].id }, engine);
        expect(single.sites.map(site => site.name)).toEqual(['two.example.com']);
        const batch = await applyQuickAdUpdate(sites, codes, { scope: 'batch' }, engine);
        expect(batch.sites).toHaveLength(2);
        expect(decode(batch.sites[0], 'js/ad.js')).not.toContain('two.example.com');
        expect(decode(batch.sites[1], 'js/ad.js')).not.toContain('one.example.com');
        expect(decode(batch.sites[1], 'vendor-games/test/index.html')).toBe('<canvas id="game"></canvas>');
        expect(decode(batch.sites[1], 'all-games.html')).toContain('data-sitefoundry-ad-page="all"');
    });
    it('preserves disabled page switches and per-file banners, while the default restores them with template OOP gates', () => {
        const original = fixture();
        const policy = engine.createPolicy('restore-original', { pageIsolation: true });
        policy.slots.detail[1].unit = 'off';
        policy.outOfPage.interstitial.home = false;
        policy.outOfPage.anchor.all = false;
        const disabled = engine.preparePolicySite(original, policy);
        const site = reopened(original, disabled);
        const preserved = prepareQuickAdUpdate(site, code(), { preserveSwitches: true }, engine);
        expect(preserved.valid).toBe(true);
        expect(decode(preserved, 'details/one.html').replace(/<!--[\s\S]*?-->/g, '')).not.toMatch(/<div[^>]*id="div-gpt-ad-banner2"/);
        expect(preserved.policy.outOfPage.interstitial.home).toBe(false);
        expect(preserved.policy.outOfPage.anchor.all).toBe(false);
        const restored = prepareQuickAdUpdate(site, code(), {}, engine);
        expect(restored.valid).toBe(true);
        expect(decode(restored, 'details/one.html')).toMatch(/<div[^>]*id="div-gpt-ad-banner2"/);
        expect(restored.policy.outOfPage.interstitial).toEqual({ home: true, detail: false, all: false });
        expect(restored.policy.outOfPage.anchor).toEqual({ home: true, detail: true, all: true });
        expect(oopCalls(decode(restored, 'js/ad.js'), 'home')).toEqual(['INT', 'ANC']);
        expect(oopCalls(decode(restored, 'js/ad.js'), 'detail')).toEqual(['ANC']);
        expect(oopCalls(decode(preserved, 'js/ad.js'), 'home')).toEqual(['ANC']);
        expect(oopCalls(decode(preserved, 'js/ad.js'), 'all')).toEqual([]);
    });
    it('preserves switches without a manifest and retains different banner visibility between details', () => {
        const site = fixture();
        site.entries[1].text = page('detail', [1, 3]);
        site.entries.push({ path: 'details/two.html', text: page('detail') });
        site.entries[3].text = site.entries[3].text.replace('if (isIndex && adUnitInterstitial)', 'if (adUnitInterstitial && (isIndex ? false : true))');
        site.metadata = engine.inspectSiteEntries(site.entries, site.name);
        const output = prepareQuickAdUpdate(site, code(), { preserveSwitches: true }, engine);
        expect(output.valid, JSON.stringify(output.errors)).toBe(true);
        expect(output.policy.outOfPage.interstitial).toEqual({ home: false, detail: true, all: true });
        expect(decode(output, 'details/one.html')).not.toContain('id="div-gpt-ad-banner2"');
        expect(decode(output, 'details/two.html')).toContain('id="div-gpt-ad-banner2"');
    });
    it('reports a failed site and excludes it from exports while retaining valid bindings', async () => {
        const batch = await applyQuickAdUpdate([fixture(), fixture('missing.example.com')], [code()], { scope: 'batch' }, engine);
        expect(batch.sites).toHaveLength(1);
        expect(batch.results.filter(item => !item.valid)).toHaveLength(1);
        await expect(applyQuickAdUpdate([fixture()], [], {}, engine)).rejects.toThrow('没有站点通过');
    });
});
