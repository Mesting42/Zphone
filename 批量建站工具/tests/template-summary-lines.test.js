import { describe, expect, it } from 'vitest';
import { DOMParser } from 'linkedom';
import { normalizeExcerptLines, markTemplateSummary, applyTemplateSummaryLines } from '../js/template-summary-lines.js';
import { reuseTemplateSite, parseContentJson } from '../js/template-reuse.js';
import { textEntry, entryText } from '../js/template-reuse-content.js';
globalThis.DOMParser = DOMParser;
const parse = html => new DOMParser().parseFromString(html, 'text/html');
const shell = content => '<html><head><title>Brand</title></head><body>' + content + '</body></html>';
function template() {
    return { entries: [textEntry('index.html', shell('<a class="hero" href="details/article1.html"><h1>Old</h1><p>Original short hero</p></a><section><h2 class="category-title">Category</h2><a class="item-card" href="details/article1.html"><h3>Old</h3><p class="card-desc">Original card</p></a><a class="item-card" href="details/article2.html"><h3>Without summary</h3></a><div id="adv2"><p>Ad description</p></div></section>')),
        ...[1, 2].map(n => textEntry('details/article' + n + '.html', shell('<h1>Old</h1><div class="detail-content"><p>Old prose</p></div><a class="related-card" href="article1.html"><span class="related-name">Old</span><p class="related-excerpt">Old related summary</p></a>'))), textEntry('privacy.html', shell('<p>Legal</p>'))], metadata: { homePath: 'index.html', siteRoot: '', detailPaths: ['details/article1.html', 'details/article2.html'] } };
}
describe('template card excerpt configuration', () => {
    it.each(['auto', 'none', ...Array.from({ length: 10 }, (_, i) => String(i + 1))])('accepts the shared cardExcerptLines value %s', value => expect(normalizeExcerptLines(value)).toBe(value));
    it.each([undefined, null, '', '0', '11', '-2', '2.5', 'auto<script>', {}, NaN])('falls back to template for invalid input %s', value => expect(normalizeExcerptLines(value)).toBe('auto'));
    it('captures the template before replacement and retains that baseline when a card is filled again', () => {
        const node = parse(shell('<p>Original</p>')).querySelector('p');
        markTemplateSummary(node); node.textContent = 'New'; markTemplateSummary(node);
        expect(node.getAttribute('data-sitefoundry-card-summary')).toBe('Original');
    });
    it.each(['auto', '1', '4', '10', 'none'])('binds hero, regular and related summaries in mode %s without marking prose, ads or absent fields', cardExcerptLines => {
        const original = template(), output = reuseTemplateSite(original, { cardExcerptLines, contentItems: parseContentJson([1, 2, 3].map(n => ({ title: 'New ' + n, content: 'Full new body ' + n }))) });
        const home = parse(entryText(output.entries.find(e => e.path === 'index.html')));
        expect(home.querySelector('.hero p').getAttribute('data-sitefoundry-card-summary')).toBe('Original short hero');
        expect(home.querySelector('.card-desc').getAttribute('data-sitefoundry-card-summary')).toBe('Original card');
        expect(home.querySelectorAll('.item-card')[1].querySelector('p')).toBeNull();
        expect(home.querySelector('#adv2 [data-sitefoundry-card-summary]')).toBeNull();
        expect(home.querySelectorAll('[data-sitefoundry-summary-runtime]')).toHaveLength(1);
        expect(home.querySelector('[data-sitefoundry-summary-runtime]').getAttribute('data-sitefoundry-summary-runtime')).toBe(cardExcerptLines);
        const detail = parse(entryText(output.entries.find(e => e.path === 'details/article2.html')));
        expect(detail.querySelector('.detail-content').textContent).toBe('Full new body 2');
        expect(detail.querySelector('.detail-content [data-sitefoundry-card-summary]')).toBeNull();
        expect(detail.querySelector('.related-excerpt').hasAttribute('data-sitefoundry-card-summary')).toBe(true);
        expect(entryText(output.entries.find(e => e.path === 'privacy.html'))).toBe(entryText(original.entries.find(e => e.path === 'privacy.html')));
        expect(entryText(original.entries[0])).not.toContain('data-sitefoundry-card-summary');
    });
    it('does not inject or serialize pages without card summaries', () => {
        const entries = [textEntry('index.html', shell('<h1>Headline</h1>'))];
        const result = applyTemplateSummaryLines(entries, { paths: ['index.html'], cardExcerptLines: '2' });
        expect(result[0]).toBe(entries[0]);
    });
    it('does not treat a paragraph inside a card-owned advertisement as the summary', () => {
        const original = template(); original.entries[0] = textEntry('index.html', entryText(original.entries[0]).replace('<p class="card-desc">', '<div class="ad-slot"><p>Keep inner ad</p></div><p class="card-desc">'));
        const output = reuseTemplateSite(original, { contentItems: parseContentJson([{ title: 'New', content: 'New summary' }]) });
        const doc = parse(entryText(output.entries[0]));
        expect(doc.querySelector('.ad-slot p').textContent).toBe('Keep inner ad');
        expect(doc.querySelector('.ad-slot [data-sitefoundry-card-summary]')).toBeNull();
    });
    it('replaces the runtime instead of stacking copies and safely serializes original dynamic text', () => {
        const entries = [textEntry('index.html', shell('<p data-sitefoundry-card-summary="Old">New</p>'))];
        const options = { paths: ['index.html'], dynamic: { path: 'index.html', originals: [{ id: '1', text: '</script><script>unsafe()</script>' }] } };
        const once = applyTemplateSummaryLines(entries, options), twice = applyTemplateSummaryLines(once, { ...options, cardExcerptLines: '3' });
        const doc = parse(entryText(twice[0]));
        expect(doc.querySelectorAll('script')).toHaveLength(1);
        expect(doc.querySelector('script').textContent).toContain('\\u003c/script>');
        expect(doc.querySelector('script').getAttribute('data-sitefoundry-summary-runtime')).toBe('3');
    });
});
