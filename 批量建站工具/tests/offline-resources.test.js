import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const source = name => readFileSync(new URL('../js/' + name, import.meta.url), 'utf8');
function fonts(fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(2) })) {
    const context = vm.createContext({ URL, fetch, document: { currentScript: { src: 'http://127.0.0.1:5174/js/offline-fonts.js' } } });
    vm.runInContext(source('offline-font-catalog.js'), context);
    vm.runInContext(source('offline-fonts.js'), context);
    return context.OfflineFonts;
}
describe('offline font packaging', () => {
    it.each(['', '../', '../../'])('keeps font paths relative for a page at depth %s', prefix => {
        const config = { style: { fontStyle: 'inter-italic' } };
        const html = fonts().documentHTML('<head><link href="' + prefix + 'css/style.css"></head>', config, false);
        expect(html).toContain('href="' + prefix + 'fonts/inter/font.css"');
        expect(config.offlineFontFamilies).toEqual(['Inter']);
        expect(html).not.toMatch(/https?:/);
    });
    it('uses absolute local URLs in opaque sandbox previews and replaces old font links', () => {
        const config = { style: { fontStyle: 'clean' } };
        const helper = fonts();
        const exported = helper.documentHTML('<head><link href="../css/style.css"></head>', config, false);
        const preview = helper.documentHTML(exported, config, true);
        expect(preview.match(/data-sitefoundry-font/g)).toHaveLength(1);
        expect(preview).toContain('http://127.0.0.1:5174/fonts/inter/font.css');
    });
    it('does not confuse Inter with another family or ordinary article text', () => {
        expect(fonts().familyNames('<style>body{font-family:Interstate, serif}</style><p>Inter</p>', {})).toEqual([]);
    });
    it('ships every selected font, stylesheet and license, without unrelated families', async () => {
        const files = [];
        await fonts().exportAssets({ file: (path, value) => files.push({ path, value }) }, { offlineFontFamilies: ['Inter'] });
        expect(files.some(file => file.path === 'fonts/inter/font.css')).toBe(true);
        expect(files.some(file => file.path === 'fonts/inter/LICENSE.txt')).toBe(true);
        expect(files.some(file => file.path.endsWith('.woff2'))).toBe(true);
        expect(files.every(file => file.path.startsWith('fonts/inter/'))).toBe(true);
    });
    it('fails visibly rather than producing an incomplete archive when a local font is missing', async () => {
        const helper = fonts(async () => ({ ok: false, status: 404 }));
        await expect(helper.exportAssets({ file() {} }, { offlineFontFamilies: ['Inter'] })).rejects.toThrow('本地字体资源缺失');
    });
});

function noticeRuntime() {
    const { document, window } = parseHTML('<html><body><header class="workflow-command-bar"></header></body></html>');
    const navigator = { onLine: true };
    const events = {};
    const api = { addEventListener: (name, callback) => { events[name] = callback; } };
    const context = vm.createContext({ document, window: api, navigator, location: new URL('http://127.0.0.1:5174/'), URL, MutationObserver: window.MutationObserver });
    vm.runInContext(source('offline-status.js'), context);
    return { api: api.OfflineStatus, navigator, events, notice: document.querySelector('#offline-resource-notice') };
}
describe('external-resource notice', () => {
    it('is hidden online, appears offline with external material, and hides again on reconnect', () => {
        const t = noticeRuntime();
        t.api.trackState({ data: [{ cover: 'https://example.org/cover.jpg' }], fieldMapping: { image: 'cover' } });
        expect(t.notice.hidden).toBe(true);
        t.navigator.onLine = false; t.events.offline();
        expect(t.notice.hidden).toBe(false);
        expect(t.notice.getAttribute('role')).toBe('status');
        t.navigator.onLine = true; t.events.online();
        expect(t.notice.hidden).toBe(true);
        expect(t.notice.textContent).toBe('');
    });
    it('stays hidden with local material even when offline', () => {
        const t = noticeRuntime(); t.navigator.onLine = false;
        t.api.trackState({ data: [{ image: 'images/cover.jpg' }] });
        expect(t.notice.hidden).toBe(true);
    });
    it('ignores citations and namespaces but finds remote scripts, srcsets and CSS', () => {
        const t = noticeRuntime();
        const found = t.api.resources('<a href="https://example.org/source">Source</a><svg xmlns="http://www.w3.org/2000/svg"></svg><script src="//example.org/game.js"></script><img srcset="https://example.org/a.jpg 1x, https://example.org/b.jpg 2x"><style>body{background:url(https://example.org/bg.png)}</style>');
        expect(found.size).toBe(4);
        expect(t.api.resources('<img src="http://127.0.0.1:5174/local.png"><img src="data:image/png;base64,AAAA">').size).toBe(0);
    });
    it('clears data dependencies when switching back to an all-local input', () => {
        const t = noticeRuntime(); t.navigator.onLine = false;
        t.api.trackState({ data: [{ image: 'https://example.org/a.jpg' }] });
        expect(t.notice.hidden).toBe(false);
        t.api.trackState({ data: [{ image: 'local.jpg' }] });
        expect(t.notice.hidden).toBe(true);
    });
});
