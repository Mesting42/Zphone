import { describe, expect, it } from 'vitest';
import { DOMParser } from 'linkedom';
import { reuseTemplateSite, parseContentJson } from '../js/template-reuse.js';
import { gameCatalogContent } from '../js/template-reuse-games.js';
import { entryText, textEntry } from '../js/template-reuse-content.js';

globalThis.DOMParser = DOMParser;
const shell = body => '<html><head><title>Brand</title><link rel="stylesheet" href="assets/site.css"></head><body><nav><h1>Brand</h1><a href="details/item-1.html">Navigation</a></nav>' + body + '</body></html>';
const card = n => '<a class="tile" href="details/item-' + n + '.html"><img src="old.webp"><h3>Old ' + n + '</h3><p>Old summary</p></a>';
const feature = (media = '<img src="old.webp">', href = 'details/item-2.html') => '<a class="hero" href="' + href + '"><div class="cover">' + media + '</div><div><h1><span aria-hidden="true">★</span><strong>Mini-Game</strong></h1><p>Old introduction</p><span>Read featured</span></div><div onclick="event.stopPropagation();event.preventDefault()"><input id="search" placeholder="Search" oninput="filterCards(this.value)"></div><div id="adv-feature">Original ad</div></a>';
function template(hero = feature()) {
    return { entries: [textEntry('index.html', shell(hero + '<section><h2 class="category-title"><svg><use href="#star"/></svg>Original category</h2><div class="grid">' + card(1) + '<div id="adv2">Original middle ad</div>' + card(2) + '</div></section>')),
        ...[1, 2].map(n => textEntry('details/item-' + n + '.html', shell('<h1>Old title</h1><div class="detail-content">Old prose</div>'))), textEntry('assets/site.css', '.hero .cover{background-image:linear-gradient(transparent,black),url("old.webp")}')],
    metadata: { homePath: 'index.html', siteRoot: '', detailPaths: ['details/item-1.html', 'details/item-2.html'], detectedHost: 'old.example' } };
}
const source = count => ({ contentItems: parseContentJson(Array.from({ length: count }, (_, i) => ({ title: 'New ' + i, content: 'New prose ' + i, image: 'cover' + i + '.webp' }))), assets: Array.from({ length: count }, (_, i) => ({ path: 'cover' + i + '.webp', bytes: new Uint8Array([i]) })) });
const doc = output => new DOMParser().parseFromString(entryText(output.entries.find(e => e.path === 'index.html')), 'text/html');

describe('featured content and category allocation', () => {
    it.each([1, 2, 3, 5])('binds the feature to the first record with %i records without losing overflow or consuming card capacity', count => {
        const original = template(), before = doc(original), output = reuseTemplateSite(original, source(count)), after = doc(output);
        expect(after.querySelector('.hero h1 strong').textContent).toBe('New 0');
        expect(after.querySelector('.hero h1 span').textContent).toBe('★');
        expect(after.querySelector('.hero p').textContent).toBe('New prose 0');
        expect(after.querySelector('.hero').getAttribute('href')).toBe('details/item-1.html');
        expect(after.querySelector('.hero img').getAttribute('src')).toBe('assets/template-reuse/cover0.webp');
        expect([...after.querySelectorAll('.tile h3')].map(n => n.textContent)).toEqual(Array.from({ length: count }, (_, i) => 'New ' + i));
        for (const selector of ['nav', '.category-title', '#adv2', '#adv-feature', '#search']) expect(after.querySelector(selector).outerHTML).toBe(before.querySelector(selector).outerHTML);
        expect(after.querySelector('#adv2').previousElementSibling.querySelector('h3').textContent).toBe('New 0');
        expect(after.title).toBe('Brand');
        expect(entryText(original.entries[0])).toContain('Mini-Game');
    });
    it('uses the first game in the feature and detail, with later games in cards and original category titles', async () => {
        const parsed = await gameCatalogContent({ id: 'builtin', games: [1, 2, 3].map(n => ({ title: 'Game ' + n, description: 'Play ' + n, url: 'https://games.example/' + n, thumb: 'https://covers.example/' + n + '.webp' })) });
        const output = reuseTemplateSite(template(), { contentItems: parsed.items }), after = doc(output);
        expect(after.querySelector('.hero h1 strong').textContent).toBe('Game 1');
        expect(after.querySelector('.hero p').textContent).toBe('Play 1');
        expect(after.querySelector('.hero img').getAttribute('src')).toBe('https://covers.example/1.webp');
        expect(after.querySelector('.category-title').textContent).toBe('Original category');
        expect([...after.querySelectorAll('.tile h3')].map(node => node.textContent)).toEqual(['Game 2', 'Game 3']);
        const detail = new DOMParser().parseFromString(entryText(output.entries.find(e => e.path === 'details/item-1.html')), 'text/html');
        expect(detail.querySelector('.detail-content iframe').getAttribute('title')).toBe('Game 1');
    });
    it('replaces picture and lazy-loading variants without touching icon images', () => {
        const after = doc(reuseTemplateSite(template(feature('<span class="icon"><img src="icon.svg"></span><picture><source srcset="old-wide.webp" type="image/webp"><img src="old.webp" srcset="old2.webp 2x" data-src="old-lazy.webp" data-srcset="old3.webp"></picture>')), source(2)));
        expect(after.querySelector('.icon img').getAttribute('src')).toBe('icon.svg');
        const image = after.querySelector('picture img');
        expect(image.getAttribute('src')).toBe('assets/template-reuse/cover0.webp');
        for (const attr of ['srcset', 'data-src', 'data-srcset']) expect(image.hasAttribute(attr)).toBe(false);
        expect(after.querySelector('picture source').hasAttribute('srcset')).toBe(false);
    });
    it.each(['inline', 'stylesheet'])('replaces a %s background cover while retaining gradients and stylesheet bytes', mode => {
        const original = template(feature('').replace('class="cover"', 'class="cover"' + (mode === 'inline' ? ' style="background-image:linear-gradient(red,blue),url(old.webp)"' : '')));
        const output = reuseTemplateSite(original, source(2)), after = doc(output);
        const value = after.querySelector('.hero .cover').getAttribute('style');
        expect(value).toContain('assets/template-reuse/cover0.webp');
        expect(value).toContain('linear-gradient(');
        expect(value).not.toContain('old.webp');
        expect(entryText(output.entries.find(e => e.path === 'assets/site.css'))).toBe(entryText(original.entries.find(e => e.path === 'assets/site.css')));
    });
    it('removes stale responsive and background images when the first record has no cover', () => {
        const input = source(2); input.contentItems[0].image = '';
        const after = doc(reuseTemplateSite(template(feature('<picture><source srcset="old-wide.webp"><img src="old.webp"></picture>')), input));
        expect(after.querySelector('.hero img').hasAttribute('src')).toBe(false);
        expect(after.querySelector('.hero img').hasAttribute('hidden')).toBe(true);
        expect(after.querySelector('.cover').getAttribute('style')).not.toContain('old.webp');
    });
    it('recognizes literal onclick features and same-host absolute routes, preserving search handlers', () => {
        const markup = feature().replace('<a class="hero" href="details/item-2.html">', '<div class="spotlight" onclick="window.location.href=\'https://old.example/details/item-2.html\'">').replace('</a>', '</div>');
        const after = doc(reuseTemplateSite(template(markup), source(3)));
        expect(after.querySelector('.spotlight').getAttribute('onclick')).toContain('details/item-1.html');
        expect(after.querySelector('.spotlight h1 strong').textContent).toBe('New 0');
        expect(after.querySelector('#search').getAttribute('oninput')).toBe('filterCards(this.value)');
    });
    it('does not clone the feature when it is the only static listing region', () => {
        const original = template(); original.entries[0] = textEntry('index.html', shell(feature()));
        const after = doc(reuseTemplateSite(original, source(5)));
        expect(after.querySelectorAll('.hero')).toHaveLength(1);
        expect(after.querySelector('.hero h1 strong').textContent).toBe('New 0');
    });
    it('preserves ad copy and icon backgrounds inside a featured region', () => {
        const original = template(feature('<span class="icon" style="background-image:url(icon.svg)">Icon</span><img src="old.webp">').replace('<div><h1>', '<div id="adv-description"><p>Ad summary</p><span class="source">Ad source</span></div><div><h1>'));
        const before = doc(original), after = doc(reuseTemplateSite(original, source(2)));
        expect(after.querySelector('#adv-description').outerHTML).toBe(before.querySelector('#adv-description').outerHTML);
        expect(after.querySelector('.icon').outerHTML).toBe(before.querySelector('.icon').outerHTML);
        expect(after.querySelector('.hero h1').nextElementSibling.textContent).toBe('New prose 0');
    });
    it('synchronizes a repeated video caption while preserving a category heading in the same feature', () => {
        const after = doc(reuseTemplateSite(template(feature('').replace('</a>', '<div class="video-caption"><h3>Old caption</h3></div><h2 class="category-title">Original section</h2></a>')), source(2)));
        expect(after.querySelector('.hero h1 strong').textContent).toBe('New 0');
        expect(after.querySelector('.video-caption h3').textContent).toBe('New 0');
        expect(after.querySelector('.hero .category-title').textContent).toBe('Original section');
    });
    it('counts repeated ordinary cards by their route rather than losing the final new record', () => {
        const original = template(); original.entries[0] = textEntry('index.html', entryText(original.entries[0]).replace(card(2), card(1) + card(2)));
        const after = doc(reuseTemplateSite(original, source(3)));
        expect([...after.querySelectorAll('.tile h3')].map(n => n.textContent)).toEqual(['New 0', 'New 0', 'New 1', 'New 2']);
    });
});
