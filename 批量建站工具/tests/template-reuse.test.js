import { describe, expect, it } from 'vitest';
import { DOMParser } from 'linkedom';
import { parseContentJson, extractStaticSiteContent, inspectTemplate, reuseTemplateSite, applyThemePalette } from '../js/template-reuse.js';
import { entryText, textEntry } from '../js/template-reuse-content.js';
globalThis.DOMParser = DOMParser;
const card = id => `<a class="item-card" href="details/article${id}.html"><img src="old.webp"><div class="card-body"><div class="card-title">Old ${id}</div><p class="card-desc">Old summary</p></div></a>`;
const shell = content => '<!doctype html><html><head><title>Template</title></head><body><nav>Keep nav</nav>' + content + '<footer>Keep footer</footer></body></html>';
function template(runtime = false) {
    const entries = [textEntry('index.html', shell('<main><h2 class="category-title">Template section</h2><div class="items-grid">' + (runtime ? '' : card(1) + card(2)) + '</div></main><div id="adv2"><div id="div-gpt-ad-banner2"></div></div>')),
        ...[1, 2].map(id => textEntry(`details/article${id}.html`, shell(`<div class="detail-page"><h1 class="detail-title">Old ${id}</h1><img class="detail-hero-image" src="old.webp"><div class="detail-content"><p>OLD BODY ${id}</p></div><div id="adv2"><div id="div-gpt-ad-banner2"></div></div><div class="related-grid"><a class="related-card" href="article${id === 1 ? 2 : 1}.html"><span class="related-name">Old related</span><img src="old.webp"></a></div></div>`))),
        textEntry('privacy.html', shell('<main><h1>Privacy</h1><p>Keep legal</p></main>')), textEntry('css/style.css', '.item-card{display:grid;gap:23px}'), textEntry('js/ad.js', 'const originalAd=true;')];
    if (runtime) {
        entries.push(textEntry('js/script.js', `var CONFIG={dataFile:'data.json',fieldMapping:{"title":"name","content":"description","image":"thumb"},categories:[{"name":"Old category","count":2}],imageField:'thumb'}; function createCard(item){return 'details/article'+item.id+'.html'}; fetch(CONFIG.dataFile);`));
        entries.push(textEntry('data.json', JSON.stringify([{ id: 1, name: 'Old 1' }, { id: 2, name: 'Old 2' }])));
    }
    return { id: 'template', name: 'template', entries, metadata: { siteRoot: '', homePath: 'index.html', detailPaths: ['details/article1.html', 'details/article2.html'], listingPaths: [], adPath: 'js/ad.js', detectedHost: 'old.example.com' } };
}
const rows = count => parseContentJson(Array.from({ length: count }, (_, i) => ({ title: 'New ' + i, content: 'New body ' + i, category: 'New category' })));
const docOf = (site, path) => new DOMParser().parseFromString(entryText(site.entries.find(entry => entry.path === path)), 'text/html');

describe('static template reuse acceptance', () => {
    it('rejects malformed, empty, null-row and missing-body JSON imports', () => {
        for (const input of ['{bad', [], [null], [{ title: 'No body' }]]) expect(() => parseContentJson(input)).toThrow();
    });
    it('replaces homepage cards and corresponding detail bodies, retaining shell/ads/public pages', () => {
        const source = template(), output = reuseTemplateSite(source, { contentItems: rows(2) });
        const home = docOf(output, 'index.html');
        expect(home.querySelector('.category-title').textContent).toBe('Template section');
        for (const link of home.querySelectorAll('.item-card')) {
            const detail = docOf(output, link.getAttribute('href'));
            expect(detail.querySelector('.detail-title').textContent).toBe(link.querySelector('.card-title').textContent);
            expect(detail.querySelector('.detail-content').textContent).toContain('New body');
            expect(detail.querySelector('#adv2').parentElement.className).toBe('detail-page');
            expect(detail.querySelector('nav').textContent).toBe('Keep nav');
        }
        expect(entryText(output.entries.find(e => e.path === 'privacy.html'))).toBe(entryText(source.entries.find(e => e.path === 'privacy.html')));
        expect(entryText(output.entries.find(e => e.path === 'css/style.css'))).toBe(entryText(source.entries.find(e => e.path === 'css/style.css')));
        expect(output.entries.filter(e => /html$/.test(e.path)).map(entryText).join('')).not.toMatch(/OLD BODY|Old related/);
    });
    it('reduces detail pages without cycling content or retaining links to deleted old pages', () => {
        const result = reuseTemplateSite(template(), { contentItems: rows(1) });
        expect(result.metadata.detailPaths).toEqual(['details/article1.html']);
        expect(result.entries.some(e => e.path === 'details/article2.html')).toBe(false);
        expect(docOf(result, 'index.html').querySelectorAll('.item-card')).toHaveLength(1);
        expect(docOf(result, 'details/article1.html').querySelectorAll('.related-card')).toHaveLength(0);
    });
    it('creates additional detail pages from the same template and corresponding cards', () => {
        const result = reuseTemplateSite(template(), { contentItems: rows(3) });
        expect(result.metadata.detailPaths).toHaveLength(3);
        expect(docOf(result, 'index.html').querySelectorAll('.item-card')).toHaveLength(3);
        expect(docOf(result, result.metadata.detailPaths[2]).querySelector('.detail-title').textContent).toBe('New 2');
    });
    it('updates local data instead of replacing a section heading while leaving runtime cards old', () => {
        const source = template(true), output = reuseTemplateSite(source, { contentItems: rows(3) });
        const data = JSON.parse(entryText(output.entries.find(e => e.path === 'data.json')));
        expect(data).toHaveLength(3);
        for (const row of data) expect(docOf(output, 'details/article' + row.id + '.html').querySelector('.detail-title').textContent).toBe(row.name);
        expect(entryText(output.entries.find(e => e.path === 'data.json'))).not.toContain('Old');
        expect(output.templateReuseReport.localDataUpdated).toBe(true);
        expect(entryText(source.entries.find(e => e.path === 'data.json'))).toContain('Old 1');
    });
    it('retains same-named cover files in separate directories and rewrites inline/hero image paths', () => {
        const contentItems = parseContentJson([{ title: 'A', content: '<p>A</p><img src="a/cover.webp">', image: 'a/cover.webp' }, { title: 'B', content: 'B body', image: 'b/cover.webp' }]);
        const output = reuseTemplateSite(template(), { contentItems, assets: [{ path: 'a/cover.webp', bytes: new Uint8Array([1]) }, { path: 'b/cover.webp', bytes: new Uint8Array([2]) }] });
        expect(output.entries.find(e => e.path === 'assets/template-reuse/a/cover.webp').bytes[0]).toBe(1);
        expect(output.entries.find(e => e.path === 'assets/template-reuse/b/cover.webp').bytes[0]).toBe(2);
        expect(docOf(output, 'details/article1.html').querySelector('.detail-content img').getAttribute('src')).toBe('../assets/template-reuse/a/cover.webp');
        expect(docOf(output, 'details/article2.html').querySelector('.detail-hero-image').getAttribute('src')).toBe('../assets/template-reuse/b/cover.webp');
    });
    it('blocks missing local images instead of exporting broken references', () => {
        expect(() => reuseTemplateSite(template(), { contentItems: parseContentJson([{ title: 'A', content: 'A body', image: 'missing.webp' }]) })).toThrow(/图片不存在/);
    });
    it('rewrites raw image aliases as well as a template-specific thumb field', () => {
        const output = reuseTemplateSite(template(true), { contentItems: parseContentJson([{ title: 'A', content: 'New prose', image: 'images/a.webp' }]), assets: [{ path: 'images/a.webp', bytes: new Uint8Array([1]) }] });
        const row = JSON.parse(entryText(output.entries.find(entry => entry.path === 'data.json')))[0];
        expect(row.image).toBe('assets/template-reuse/images/a.webp');
        expect(row.thumb).toBe(row.image);
    });
    it('extracts full detail prose once and excludes legal/home/related duplicates', () => {
        const entries = template().entries;
        const items = extractStaticSiteContent(entries);
        expect(items).toHaveLength(2);
        expect(items[0].body).toContain('OLD BODY 1');
        expect(items[0].sourcePath).toBe('details/article1.html');
    });
    it('keeps middle ad nodes while stripping foreign layout and executable content from prose', () => {
        const source = template();
        source.entries.find(e => e.path === 'details/article1.html').bytes = new TextEncoder().encode(shell('<h1>Old</h1><div class="detail-content"><p>old</p><div id="adv2"><div id="div-gpt-ad-banner2"></div></div></div>'));
        const output = reuseTemplateSite(source, { contentItems: parseContentJson([{ title: 'New', content: '<p class="foreign" onclick="bad()">Text</p><script>bad()</script><style>body{display:none}</style>' }]) });
        const doc = docOf(output, 'details/article1.html');
        expect(doc.querySelector('.detail-content #div-gpt-ad-banner2')).not.toBeNull();
        expect(doc.querySelector('.detail-content').innerHTML).not.toMatch(/bad|foreign|<style/);
    });
    it('rejects an unknown dynamic homepage at upload inspection', () => {
        const source = template(); source.entries[0] = textEntry('index.html', shell('<div id="root"></div>'));
        expect(() => inspectTemplate(source)).toThrow(/不支持直接复用/);
    });
    it('applies colour tokens only and replaces an existing override instead of stacking styles', () => {
        const palette = { vars: { '--color-primary': '#123456', '--color-bg': '#fff', '--content-width': '900px' } };
        const once = applyThemePalette(template().entries, palette), twice = applyThemePalette(once.entries, palette);
        const doc = docOf({ entries: twice.entries }, 'index.html');
        expect(doc.querySelectorAll('style[data-sitefoundry-template-theme]')).toHaveLength(1);
        expect(doc.querySelector('style').textContent).not.toContain('--content-width');
    });
});
