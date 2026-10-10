import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import JSZip from 'jszip';
const context = { TextEncoder, TextDecoder, Blob, Response, DecompressionStream, JSZip, window: {} };
const source = name => readFileSync(new URL('../js/' + name, import.meta.url), 'utf8');
for (const file of ['template-catalog.js', 'template-layouts.js', 'navbar-layout.js', 'data.js', 'domain.js', 'ad-migration.js', 'ad.js', 'generator.js', 'finished-site-ads.js', 'zip-archive-worker-client.js', 'ad-restoration.js']) vm.runInNewContext(source(file), context);
const engine = context.window.AdRestoration;
const generator = vm.runInNewContext('Generator', context);
const config = { bannerPath1: '/23334460889/fixture.example.pro-banner1', bannerPath2: '/23334460889/fixture.example.pro-banner2', bannerPath3: '/23334460889/fixture.example.pro-banner3', interstitialPath: '/23334460889/fixture.example.pro-INT', anchorPath: '/23334460889/fixture.example.pro-ANC', analyticsID: '' };
const home = '<!doctype html><html><head></head><body><nav class="navbar"></nav><main><section class="hero">Intro</section><section class="category-section">One</section><section class="category-section">Two</section></main><footer class="footer"></footer></body></html>';
const detail = '<!doctype html><html><head></head><body><nav class="navbar"></nav><main class="detail-page"><h1>Title</h1><article class="detail-content"><p>First</p><p>Second</p><p>Third</p><p>Fourth</p></article></main><footer class="footer"></footer></body></html>';
const all = '<!doctype html><html><head></head><body><nav class="navbar"></nav><main><h1>All articles</h1><div class="items-grid">' + Array.from({ length: 12 }, (_, i) => '<article class="item-card">Card ' + i + '</article>').join('') + '</div></main><footer class="footer"></footer></body></html>';
function site(id = 'a', version = 'v1.0.2.1') {
    const entries = [{ path: 'index.html', text: home }, { path: 'details/one.html', text: detail }, { path: 'all-articles.html', text: all }, { path: 'js/ad.js', text: generator.generateSelectedAdJs(config, version) }, { path: 'images/cover.webp', bytes: new Uint8Array([1, 5, 8, 13]) }];
    return { id, name: id, entries, metadata: engine.inspectSiteEntries(entries, id) };
}
const text = (result, path) => new TextDecoder().decode(result.entries.find(entry => entry.path === path).bytes);
const policy = () => engine.createPolicy(undefined, { pageIsolation: true });
describe('batch ad policy workbench', () => {
    it('keeps the legacy API while normalizing three independent page policies', () => {
        expect(engine.createPolicy().slots.all).toBeUndefined();
        const p = policy(); p.slots.detail[1].position = 'detail-before-content';
        expect(engine.normalizePolicy(p).slots.all[1].position).toBe('content-middle');
        expect(engine.normalizePolicy(p).slots.detail[1].position).toBe('detail-before-content');
    });
    it('places listing ads between cards and keeps detail positions independent without changing binary assets', () => {
        const p = policy(); p.slots.detail[1].position = 'detail-before-content';
        const input = site(), output = engine.preparePolicySite(input, p);
        expect(output.valid).toBe(true);
        const listing = text(output, 'all-articles.html'), article = text(output, 'details/one.html');
        expect(listing.indexOf('Card 5')).toBeLessThan(listing.indexOf('id="adv2"'));
        expect(listing.indexOf('id="adv2"')).toBeLessThan(listing.indexOf('Card 6'));
        expect(listing).toContain('data-sitefoundry-middle-ad');
        expect(article.indexOf('id="adv2"')).toBeLessThan(article.indexOf('<p>First'));
        expect(Array.from(output.entries.find(entry => entry.path === 'images/cover.webp').bytes)).toEqual([1, 5, 8, 13]);
        expect(input.entries[1].text).toBe(detail);
    });
    it.each(['v1.0.0', 'v1.0.1', 'v1.0.2', 'v1.0.2.1'])('uses independent listing interstitial/anchor gates in exported %s runtime', version => {
        const p = policy(); p.outOfPage.anchor.all = false; p.outOfPage.interstitial.all = true;
        const output = engine.preparePolicySite(site('a', version), p);
        expect(output.valid).toBe(true);
        const calls = [], listeners = [];
        const slot = { addService() { return this; }, setConfig() {} };
        const runtime = { window: { location: { pathname: '/all-articles.html' } }, document: { documentElement: { getAttribute: () => 'all' }, getElementById: () => ({}), addEventListener: (_, listener) => listeners.push(listener) }, console };
        runtime.googletag = runtime.window.googletag = { cmd: { push: callback => callback() }, setConfig() {}, defineSlot: () => slot, pubads: () => ({}), defineOutOfPageSlot: (path, format) => { calls.push(format); return slot; }, enums: { OutOfPageFormat: { INTERSTITIAL: 'INT', BOTTOM_ANCHOR: 'ANC' } }, enableServices() {}, display() {} };
        vm.runInNewContext(text(output, 'js/ad.js'), runtime); listeners.forEach(listener => listener());
        expect(calls).toEqual(['INT']);
        expect(text(output, 'all-articles.html')).toContain('data-sitefoundry-ad-page="all"');
    });
    it('rejects a foreign advertiser host and applies matched TXT in the shared preparation and batch export', async () => {
        const input = site();
        const foreign = engine.inspectCodeText(generator.generateSelectedAdJs(Object.fromEntries(Object.entries(config).map(([key, value]) => [key, value.replace('fixture.example.pro', 'foreign.example.pro')])), 'v1.0.2.1'), 'foreign.txt');
        expect(engine.preparePolicySite(input, policy(), { codeOverride: foreign }).errors[0].code).toBe('POLICY_CODE_HOST_MISMATCH');
        const replacement = engine.inspectCodeText(generator.generateSelectedAdJs(Object.fromEntries(Object.entries(config).map(([key, value]) => [key, value.replace('/23334460889/', '/29999999999/')])), 'v1.0.2.1'), 'matched.txt');
        const output = engine.preparePolicySite(input, policy(), { codeOverride: replacement });
        const batch = await engine.applyPolicyBatch([input, site('b')], policy(), {}, null, { codeOverrides: { a: replacement } });
        expect(text(output, 'js/ad.js')).toContain('/29999999999/fixture.example.pro-banner1');
        expect(text(batch.sites[0], 'js/ad.js')).toBe(text(output, 'js/ad.js'));
        expect(text(batch.sites[1], 'js/ad.js')).toContain('/23334460889/fixture.example.pro-banner1');
    });
    it('keeps all disabled units recoverable after an export and reimport', () => {
        const input = site(), p = policy();
        Object.values(p.slots).forEach(slots => slots.forEach(slot => { slot.unit = 'off'; }));
        Object.values(p.outOfPage).forEach(settings => { settings.home = settings.detail = settings.all = false; });
        const closed = engine.preparePolicySite(input, p);
        const imported = { ...input, entries: closed.entries, metadata: engine.inspectSiteEntries(closed.entries, input.name) };
        expect(imported.metadata.valid).toBe(true);
        expect(imported.metadata.embeddedConfig.bannerPath2).toBe(config.bannerPath2);
        const reopened = engine.preparePolicySite(imported, policy());
        expect(reopened.valid).toBe(true);
        expect(text(reopened, 'all-articles.html')).toContain('id="div-gpt-ad-banner2"');
        expect(text(reopened, 'js/ad.js')).toContain(config.interstitialPath);
    });
    it('fails safely when a custom DOM path does not exist on a target page', () => {
        const p = policy(); p.slots.all[1].position = 'custom-after-99';
        expect(engine.preparePolicySite(site(), p).valid).toBe(false);
    });

    it('restores each HTML page at its own original gap and keeps a grid-spanning listing row', () => {
        const input = site();
        const ad = number => generator.getAdTemplate('adv' + number);
        input.entries[0].text = home.replace('</section><section class="category-section">One', '</section>' + ad(2) + '<section class="category-section">One');
        input.entries[1].text = detail.replace('<p>Second', ad(2) + '<p>Second');
        input.entries[2].text = all.replace('<article class="item-card">Card 3', '<div data-sitefoundry-middle-ad style="grid-column:1 / -1">' + ad(2) + '</div><article class="item-card">Card 3');
        // 同类详情页也不强行统一为第一篇的段落位置。
        input.entries.push({ path: 'details/two.html', text: detail.replace('<p>Fourth', ad(2) + '<p>Fourth') });
        input.metadata = engine.inspectSiteEntries(input.entries, input.name);
        const original = engine.createPolicy('restore-original', { pageIsolation: true });
        const restored = engine.preparePolicySite(input, original);
        expect(restored.valid).toBe(true);
        const h = text(restored, 'index.html'), d = text(restored, 'details/one.html'), d2 = text(restored, 'details/two.html'), a = text(restored, 'all-articles.html');
        expect(h.indexOf('Intro')).toBeLessThan(h.indexOf('id="adv2"'));
        expect(h.indexOf('id="adv2"')).toBeLessThan(h.indexOf('>One</section>'));
        expect(d.indexOf('First')).toBeLessThan(d.indexOf('id="adv2"'));
        expect(d.indexOf('id="adv2"')).toBeLessThan(d.indexOf('<p>Second'));
        expect(d2.indexOf('Third')).toBeLessThan(d2.indexOf('id="adv2"'));
        expect(d2.indexOf('id="adv2"')).toBeLessThan(d2.indexOf('<p>Fourth'));
        expect(a.indexOf('Card 2')).toBeLessThan(a.indexOf('id="adv2"'));
        expect(a.indexOf('id="adv2"')).toBeLessThan(a.indexOf('Card 3'));
        expect(a).toMatch(/data-sitefoundry-middle-ad[^>]*>[\s\S]*?id="adv2"[\s\S]*?<\/div>\s*<article/);
        expect(input.entries[1].text).not.toContain('SITEFOUNDRY_AD_ORIGIN');
    });

    it.each([true, false])('keeps HTML original gaps through closing, exporting and reopening (disabled comments: %s)', writeDisabledComments => {
        const input = site();
        input.entries[1].text = detail.replace('<p>Second', generator.getAdTemplate('adv2') + '<p>Second');
        const closedPolicy = engine.createPolicy('restore-original', { pageIsolation: true });
        closedPolicy.writeDisabledComments = writeDisabledComments;
        Object.values(closedPolicy.slots).forEach(slots => slots.forEach(slot => { slot.unit = 'off'; }));
        const closed = engine.preparePolicySite(input, closedPolicy);
        expect(closed.valid).toBe(true);
        const imported = { ...input, entries: closed.entries, metadata: engine.inspectSiteEntries(closed.entries, input.name) };
        const reopen = engine.preparePolicySite(imported, engine.createPolicy('restore-original', { pageIsolation: true }));
        expect(reopen.valid).toBe(true);
        const html = text(reopen, 'details/one.html');
        expect(html.indexOf('First')).toBeLessThan(html.indexOf('id="adv2"'));
        expect(html.indexOf('id="adv2"')).toBeLessThan(html.indexOf('<p>Second'));
        const again = engine.preparePolicySite({ ...input, entries: reopen.entries }, engine.createPolicy('restore-original', { pageIsolation: true }));
        expect(again.valid).toBe(true);
        expect(text(again, 'details/one.html').match(/SITEFOUNDRY_AD_ORIGIN banner2/g)).toHaveLength(1);
        expect(text(again, 'details/one.html').match(/id="adv2"/g)).toHaveLength(1);
    });

    it('uses saved independent positions before legacy disabled comments placed at the footer', () => {
        const input = site(), p = policy();
        p.slots.home[1].position = 'after-hero';
        p.slots.detail[1].position = 'detail-between-p-1';
        p.slots.all[1].position = 'content-top';
        Object.values(p.slots).forEach(slots => slots.forEach(slot => { slot.unit = 'off'; }));
        input.entries.push({ path: 'ad-policy.json', text: JSON.stringify({ policy: p }) });
        input.entries[1].text = detail.replace('<footer', '<!-- AD_POLICY_DISABLED_START banner2 page=detail\n' + generator.getAdTemplate('adv2') + '\nAD_POLICY_DISABLED_END --><footer');
        const output = engine.preparePolicySite(input, engine.createPolicy('restore-original', { pageIsolation: true }));
        expect(output.valid).toBe(true);
        expect(output.policy.slots.home[1].position).toBe('after-hero');
        expect(output.policy.slots.detail[1].position).toBe('detail-between-p-1');
        expect(output.policy.slots.all[1].position).toBe('content-top');
        const html = text(output, 'details/one.html');
        expect(html.indexOf('id="adv2"')).toBeLessThan(html.indexOf('<p>Second'));
    });

    it('remembers an edited gap before a close preset and keeps separate positions for another site', () => {
        const one = site('one'), two = site('two'), p1 = policy(), p2 = policy();
        p1.slots.detail[1].position = 'detail-before-content';
        p2.slots.detail[1].position = 'detail-between-p-3';
        engine.rememberPolicyPositions(one, p1); engine.rememberPolicyPositions(two, p2);
        const closed = engine.preparePolicySite(one, engine.createPolicy('traffic-limit', { pageIsolation: true }));
        expect(closed.valid).toBe(true);
        const restored1 = engine.preparePolicySite({ ...one, restorePositions: undefined, entries: closed.entries }, engine.createPolicy('restore-original', { pageIsolation: true }));
        const restored2 = engine.preparePolicySite(two, engine.createPolicy('restore-original', { pageIsolation: true }));
        expect(restored1.policy.slots.detail[1].position).toBe('detail-before-content');
        expect(restored2.policy.slots.detail[1].position).toBe('detail-between-p-3');
    });

    it('does not replace original positions with the temporary limit preset when exporting it', async () => {
        const input = site(), original = policy();
        original.slots.home[0].position = 'content-bottom';
        original.slots.detail[1].position = 'detail-between-p-1';
        engine.rememberPolicyPositions(input, original);
        const limited = await engine.applyPolicyBatch([input], engine.createPolicy('traffic-limit', { pageIsolation: true }), {}, null, { preserveOriginalPlacements: true });
        const snapshot = JSON.parse(text(limited.sites[0], 'ad-policy.json'));
        expect(snapshot.policy.slots.home[0].position).toBe('after-navbar');
        expect(snapshot.originalPlacements.positions.home[0]).toBe('content-bottom');
        const imported = { ...input, restorePositions: undefined, entries: limited.sites[0].entries };
        const restored = engine.preparePolicySite(imported, engine.createPolicy('restore-original', { pageIsolation: true }));
        expect(restored.valid).toBe(true);
        expect(restored.policy.slots.home[0].position).toBe('content-bottom');
        expect(restored.policy.slots.detail[1].position).toBe('detail-between-p-1');
    });

    it('updates only the edited site and slot during a temporary limit preset', async () => {
        const one = site('one'), two = site('two'), before = policy();
        before.slots.home[0].position = 'content-bottom';
        before.slots.detail[1].position = 'detail-between-p-1';
        engine.rememberPolicyPositions(one, before); engine.rememberPolicyPositions(two, before);
        const limited = engine.createPolicy('traffic-limit', { pageIsolation: true });
        const override = engine.normalizePolicy(limited); override.slots.detail[1].position = 'detail-between-p-3';
        engine.rememberPolicyPositions(one, override, 'slots.detail.1.position');
        engine.rememberPolicyPositions(two, limited, 'slots.home.0.unit');
        const batch = await engine.applyPolicyBatch([one, two], limited, { one: override }, null, { preserveOriginalPlacements: true });
        const restored = batch.sites.map(output => engine.preparePolicySite({ ...output, name: output.name }, engine.createPolicy('restore-original', { pageIsolation: true })));
        expect(restored.every(output => output.valid)).toBe(true);
        expect(restored.map(output => output.policy.slots.home[0].position)).toEqual(['content-bottom', 'content-bottom']);
        expect(restored.map(output => output.policy.slots.detail[1].position)).toEqual(['detail-between-p-3', 'detail-between-p-1']);
    });

    it('falls back to default gaps for unknown legacy positions and ignores script HTML strings', () => {
        const input = site();
        input.entries[2].text = all.replace('</head>', '<script>const html = \'<div id="adv2"></div>\';</script></head>');
        input.entries.push({ path: 'ad-policy.json', text: '{invalid' });
        const output = engine.preparePolicySite(input, engine.createPolicy('restore-original', { pageIsolation: true }));
        expect(output.valid).toBe(true);
        const listing = text(output, 'all-articles.html');
        expect(listing).toContain('const html = \'<div id="adv2"></div>\';');
        expect(listing.indexOf('Card 5')).toBeLessThan(listing.lastIndexOf('id="adv2"'));
        expect(listing.lastIndexOf('id="adv2"')).toBeLessThan(listing.indexOf('Card 6'));
        expect(listing).toContain('data-sitefoundry-middle-ad');
    });

    it('recognizes an original commented container at its gap', () => {
        const input = site();
        input.entries[1].text = detail.replace('<p>Third', '<!-- ' + generator.getAdTemplate('adv2') + ' --><p>Third');
        const output = engine.preparePolicySite(input, engine.createPolicy('restore-original', { pageIsolation: true }));
        expect(output.valid).toBe(true);
        const visible = text(output, 'details/one.html').replace(/<!--[\s\S]*?-->/g, '');
        expect(visible.indexOf('Second')).toBeLessThan(visible.indexOf('id="adv2"'));
        expect(visible.indexOf('id="adv2"')).toBeLessThan(visible.indexOf('<p>Third'));
    });

    it('preserves the original dynamic homeAds placement after a disabled export is reopened', () => {
        const input = site();
        const homeAds = { 'after-section-1': generator.getAdTemplate('adv2') };
        input.entries.push({ path: 'js/app.js', text: 'const CONFIG = { homeAds: ' + JSON.stringify(homeAds) + ' }; document.querySelector(".main-content .container").innerHTML = ""; void CONFIG.homeAds;' });
        const original = engine.createPolicy('restore-original', { pageIsolation: true });
        const closedPolicy = engine.createPolicy('restore-original', { pageIsolation: true }); closedPolicy.slots.home[1].unit = 'off';
        const closed = engine.preparePolicySite(input, closedPolicy);
        const reopened = engine.preparePolicySite({ ...input, entries: closed.entries }, original);
        expect(reopened.valid).toBe(true);
        const match = text(reopened, 'js/app.js').match(/homeAds: (\{[\s\S]*?\})(?=\s*[,}])/);
        expect(JSON.parse(match[1])['after-section-1']).toContain('id="adv2"');
    });
});
