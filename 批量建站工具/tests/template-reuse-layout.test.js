import { describe, it, expect } from 'vitest';
import { DOMParser } from 'linkedom';
import { retainCategoryAllocation, setTemplateText } from '../js/template-reuse-layout.js';
import { reuseTemplateSite, parseContentJson } from '../js/template-reuse.js';
import { textEntry, entryText } from '../js/template-reuse-content.js';
globalThis.DOMParser = DOMParser;
const shell = body => '<html><head><title>Template</title></head><body><nav>Nav</nav>' + body + '<footer>Footer</footer></body></html>';
const content = count => parseContentJson(Array.from({ length: count }, (_, i) => ({ title: 'New ' + i, content: 'New prose ' + i, category: 'Different content category' })));
const icons = ['⚔️', '<span class="icon" aria-hidden="true">✦</span>', '<svg viewBox="0 0 10 10"><use href="#category-star"/></svg>', '<img src="icons/category.svg" alt="">', '<i class="category-mark"></i>'];
const card = index => '<article class="tile"><a href="details/article' + index + '.html"><img src="old.webp"><h3 class="tile-title"><span aria-hidden="true">★</span><strong>Old ' + index + '</strong></h3></a><p>Old summary</p></article>';
function template(icon, dynamic = false) {
    const sections = [1, 2].map(i => '<section class="collection"><h2 class="category-title">' + icon + '<span class="label">Original ' + i + '</span></h2><div class="cards" data-category="cat-' + (i - 1) + '">' + (dynamic ? '' : card(i)) + '</div></section>');
    const entries = [textEntry('index.html', shell('<main>' + sections[0] + '<div id="adv2" class="sponsor" style="padding:17px"><div id="div-gpt-ad-banner2"></div></div>' + sections[1] + '</main>')),
        ...[1, 2].map(i => textEntry('details/article' + i + '.html', shell('<h1>Old ' + i + '</h1><div class="detail-content">Old prose</div>'))), textEntry('js/ad.js', 'const ads=true;')];
    if (dynamic) entries.push(textEntry('js/render.js', 'var CONFIG={dataFile:"data.json",categories:[{"name":"Original 1","key":"cat-0","count":1},{"name":"Original 2","key":"cat-1","count":1}],fieldMapping:{},imageField:"image"};function createCard(x){return "details/article"+x.id+".html"};fetch(CONFIG.dataFile);'), textEntry('data.json', '[{"id":1},{"id":2}]'));
    return { entries, metadata: { siteRoot: '', homePath: 'index.html', detailPaths: ['details/article1.html', 'details/article2.html'], adPath: 'js/ad.js' } };
}
const documentOf = site => new DOMParser().parseFromString(entryText(site.entries.find(e => e.path === 'index.html')), 'text/html');

describe('layout-preserving template reuse', () => {
    it('retains preceding category capacities and all metadata, appending overflow only at the tail', () => {
        const categories = [{ name: 'A', icon: '★', count: 2 }, { name: 'B', key: 'second', count: 6 }, { name: 'C', count: 3 }];
        expect(retainCategoryAllocation(categories, 20)).toEqual([{ name: 'A', icon: '★', count: 2 }, { name: 'B', key: 'second', count: 6 }, { name: 'C', count: 12 }]);
        expect(retainCategoryAllocation(categories, 1)).toEqual(categories);
        expect(categories[2].count).toBe(3);
    });
    it.each(icons)('preserves static category icon markup %s and arbitrary linked-card containers', icon => {
        const source = template(icon), before = documentOf(source);
        const output = reuseTemplateSite(source, { contentItems: content(5) }), after = documentOf(output);
        expect([...after.querySelectorAll('.category-title')].map(h => h.outerHTML)).toEqual([...before.querySelectorAll('.category-title')].map(h => h.outerHTML));
        expect(after.querySelectorAll('.collection')[0].querySelectorAll('.tile')).toHaveLength(1);
        expect(after.querySelectorAll('.collection')[1].querySelectorAll('.tile')).toHaveLength(4);
        expect(after.querySelector('#adv2').outerHTML).toBe(before.querySelector('#adv2').outerHTML);
        expect(after.querySelector('#adv2').previousElementSibling.className).toBe('collection');
        expect(after.querySelector('.tile .tile-title strong').textContent).toBe('New 0');
        expect(after.querySelector('.tile .tile-title span').textContent).toBe('★');
        expect(after.querySelector('.tile > p').textContent).toBe('New prose 0');
        expect(after.body.textContent).not.toContain('Old summary');
    });
    it.each(icons)('keeps dynamic category headers %s intact for overflow and short content sources', icon => {
        const source = template(icon, true);
        for (const count of [1, 9]) {
            const output = reuseTemplateSite(source, { contentItems: content(count) });
            expect(entryText(output.entries.find(e => e.path === 'index.html'))).toBe(entryText(source.entries.find(e => e.path === 'index.html')));
            const script = entryText(output.entries.find(e => e.path === 'js/render.js'));
            expect(script).toContain('"name":"Original 1","key":"cat-0","count":1');
            expect(script).toContain('"name":"Original 2","key":"cat-1","count":' + (count > 2 ? count - 1 : 1));
        }
    });
    it('preserves inline field decoration while replacing its content', () => {
        const doc = new DOMParser().parseFromString('<html><body><h2><svg><title>Icon description</title></svg><strong>Old</strong><span aria-hidden="true">★</span></h2></body></html>', 'text/html');
        setTemplateText(doc.querySelector('h2'), 'New');
        expect(doc.querySelector('strong').textContent).toBe('New');
        expect(doc.querySelector('svg title').textContent).toBe('Icon description');
        expect(doc.querySelector('span').textContent).toBe('★');
    });
    it('clones the whole card when a differently named div wraps the link and summary', () => {
        const source = template('★');
        source.entries[0] = textEntry('index.html', entryText(source.entries[0]).replaceAll('<article class="tile">', '<div class="catalog-entry">').replaceAll('</article>', '</div>'));
        const output = reuseTemplateSite(source, { contentItems: content(5) });
        const doc = documentOf(output);
        expect(doc.querySelectorAll('.catalog-entry')).toHaveLength(5);
        expect(doc.querySelectorAll('.collection')[0].querySelectorAll('.catalog-entry')).toHaveLength(1);
        expect(doc.querySelector('.catalog-entry > p').textContent).toBe('New prose 0');
    });
    it('rejects unknown dynamic allocation rather than silently changing its layout', () => {
        expect(() => retainCategoryAllocation([{ name: 'Unknown', limit: 'auto' }], 8)).toThrow(/无法可靠识别/);
    });
});
