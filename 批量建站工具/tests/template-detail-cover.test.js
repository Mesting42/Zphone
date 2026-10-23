import { describe, expect, it } from 'vitest';
import { DOMParser } from 'linkedom';
import { findDetailRegions } from '../js/template-detail-regions.js';
import { parseContentJson, reuseTemplateSite, extractStaticSiteContent } from '../js/template-reuse.js';
import { entryText, textEntry } from '../js/template-reuse-content.js';
import { resolveLocal } from '../js/template-reuse-content.js';
globalThis.DOMParser = DOMParser;
const shell = body => '<html><head><title>Old</title><link rel="stylesheet" href="../site.css"></head><body><nav><img class="logo" src="logo.svg"></nav><div id="adv1"><img src="ad.png"></div>' + body + '<footer><img src="footer.svg"></footer></body></html>';
const parse = html => new DOMParser().parseFromString(html, 'text/html');
const article = '<article><h1>Old title</h1><div id="adv2">Keep ad</div><div class="article-body"><p>Old prose</p><figure><img src="inline-old.png"></figure></div></article>';
function template(cover, inside = false) {
    const detail = inside ? article.replace('<h1>', cover + '<h1>') : cover + article;
    return { entries: [textEntry('index.html', '<html><head></head><body>' + [1, 2].map(n => '<a class="item-card" href="details/item-' + n + '.html"><img src="old.png"><h3>Old</h3></a>').join('') + '</body></html>'),
        ...[1, 2].map(n => textEntry('details/item-' + n + '.html', shell(detail))), textEntry('site.css', '.article-cover{background-image:linear-gradient(transparent,black),url(old.png);min-height:240px}')], metadata: { siteRoot: '', homePath: 'index.html', detailPaths: ['details/item-1.html', 'details/item-2.html'] } };
}
const items = () => parseContentJson([1, 2].map(n => ({ title: 'New ' + n, content: '<p>Full prose ' + n + '</p><figure><img src="https://source.example/inline' + n + '.png"></figure>', image: 'covers/' + n + '.svg' })));
const assets = [1, 2].map(n => textEntry('covers/' + n + '.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><path d="M0 0h10v10H0z"/></svg>'));
const doc = (site, path) => parse(entryText(site.entries.find(entry => entry.path === path)));
describe('detail covers agree with their listing records', () => {
    it.each([
        ['hero outside article', '<img class="hero-img" src="old.png">', false],
        ['unclassified preceding image', '<img src="old.png">', false],
        ['preceding figure', '<figure><img src="old.png"></figure>', false],
        ['inside article', '<img class="article-cover" src="old.png">', true],
        ['responsive cover', '<picture class="detail-cover"><source srcset="old-mobile.png" media="(max-width:600px)"><img src="old.png" srcset="old@2x.png 2x" data-src="old-lazy.png"></picture>', false],
        ['inline background', '<div class="article-cover" style="background-image:linear-gradient(red,blue),url(old.png)"></div>', false],
        ['external CSS background', '<div class="article-cover"></div>', false]
    ])('updates %s per route, preserving layout, prose illustrations and chrome', (name, cover, inside) => {
        const original = template(cover, inside), result = reuseTemplateSite(original, { contentItems: items(), assets });
        const home = doc(result, 'index.html');
        for (const [index, path] of result.metadata.detailPaths.entries()) {
            const before = doc(original, path), after = doc(result, path), region = findDetailRegions(after);
            const image = region.image?.getAttribute('src') || region.cover.style.getPropertyValue('background-image').match(/url\(["']?(.*?)["']?\)/)?.[1];
            expect(resolveLocal(image, path)).toBe(resolveLocal(home.querySelectorAll('.item-card img')[index].getAttribute('src'), 'index.html'));
            if (region.image) {
                expect(region.image.getAttribute('alt')).toBe('New ' + (index + 1));
                for (const attr of ['srcset', 'data-src']) expect(region.image.hasAttribute(attr)).toBe(false);
                expect(region.cover.querySelector('source')?.hasAttribute('srcset') || false).toBe(false);
            }
            for (const selector of ['nav', 'footer', '#adv1', '#adv2']) expect(after.querySelector(selector).outerHTML).toBe(before.querySelector(selector).outerHTML);
            expect(after.querySelector('.article-body figure img').getAttribute('src')).toBe('https://source.example/inline' + (index + 1) + '.png');
            expect(after.querySelector('h1').textContent).toBe('New ' + (index + 1));
        }
        expect(entryText(result.entries.find(e => e.path === 'site.css'))).toBe(entryText(original.entries.find(e => e.path === 'site.css')));
        expect(entryText(original.entries[1])).toContain('old.png');
    });
    it('skips logo, advertisement and related thumbnails with cover-like class names', () => {
        const source = template('<div class="ad-slot"><img class="hero-img" src="ad.png"></div><a class="related-card"><img class="article-cover" src="related.png"></a><img class="hero-img" src="old.png">');
        const result = reuseTemplateSite(source, { contentItems: items(), assets }), after = doc(result, 'details/item-1.html');
        expect(after.querySelector('.ad-slot img').getAttribute('src')).toBe('ad.png');
        expect(after.querySelector('nav img').getAttribute('src')).toBe('logo.svg');
        expect(after.querySelector('img.hero-img:not(.ad-slot img)').getAttribute('src')).toContain('assets/template-reuse/covers/1.svg');
    });
    it('does not classify an illustration-only article as having a cover', () => {
        const after = parse(shell(article));
        expect(findDetailRegions(after).cover).toBeNull();
    });
    it('preserves a loose-prose inline illustration when a page-level cover exists', () => {
        const source = template('<img class="hero-img" src="old.png">');
        source.entries[1] = textEntry('details/item-1.html', shell('<img class="hero-img" src="old.png"><article><h1>Old</h1><p>Old prose</p><figure><img src="illustration.png"></figure></article>'));
        const after = doc(reuseTemplateSite(source, { contentItems: items(), assets }), 'details/item-1.html');
        expect([...after.querySelectorAll('article figure img')].map(node => node.getAttribute('src'))).toContain('illustration.png');
        expect(after.querySelector('.hero-img').getAttribute('src')).toBe('../assets/template-reuse/covers/1.svg');
    });
    it('hides the old responsive image when source content has no cover', () => {
        const contentItems = items(); contentItems[0].image = '';
        const after = doc(reuseTemplateSite(template('<picture><source srcset="old.png"><img class="hero-img" src="old.png"></picture>'), { contentItems, assets }), 'details/item-1.html');
        expect(after.querySelector('.hero-img').hasAttribute('src')).toBe(false);
        expect(after.querySelector('.hero-img').hasAttribute('hidden')).toBe(true);
        expect(after.querySelector('source').hasAttribute('srcset')).toBe(false);
    });
    it('extracts a page-level cover when importing a static detail as content', () => {
        const source = template('<img class="hero-img" src="cover.png">');
        expect(extractStaticSiteContent(source.entries)[0].image).toBe('cover.png');
    });
    it('retains a declared cover inside the body while replacing its prose and inline illustrations', () => {
        const source = template('');
        source.entries[1] = textEntry('details/item-1.html', shell('<h1>Old</h1><div class="article-body"><div class="media-shell"><picture><source srcset="old-wide.png"><img data-content-image src="old.png"></picture></div><p>Old prose</p><div id="adv2">Keep ad</div></div>'));
        const after = doc(reuseTemplateSite(source, { contentItems: items(), assets }), 'details/item-1.html');
        expect(after.querySelector('.media-shell img').getAttribute('src')).toBe('../assets/template-reuse/covers/1.svg');
        expect(after.querySelector('.media-shell source').hasAttribute('srcset')).toBe(false);
        expect(after.querySelector('.article-body').textContent).not.toContain('Old prose');
        expect(after.querySelector('#adv2').textContent).toBe('Keep ad');
        expect(after.querySelector('.article-body figure img').getAttribute('src')).toBe('https://source.example/inline1.png');
    });
});
