import { describe, it, expect } from 'vitest';
import { DOMParser } from 'linkedom';
import { reuseTemplateSite, parseContentJson } from '../js/template-reuse.js';
import { gameCatalogContent } from '../js/template-reuse-games.js';
import { textEntry, entryText, resolveLocal } from '../js/template-reuse-content.js';
globalThis.DOMParser = DOMParser;
const shell = body => '<html><head><title>Brand</title></head><body><nav>Keep brand</nav>' + body + '<footer>Keep footer</footer></body></html>';
const card = n => '<a class="item-card" href="details/article' + n + '.html"><img src="old.png"><h3>Old ' + n + '</h3><p class="card-desc">Original summary</p></a>';
const hero = '<a class="hero" href="details/article1.html"><img src="old.png"><h1>Old feature</h1><p>Original intro</p></a>';
function template({ feature = true, exclusive = false, dynamic = false } = {}) {
    const category = '<h2 class="category-title"><svg><use href="#star"/></svg>Original category</h2>';
    const markup = '<section>' + category + '<div id="grid">' + (dynamic ? '' : (exclusive ? '' : card(1)) + '<div id="adv2">Keep ad</div>' + card(2)) + '</div></section>';
    const entries = [textEntry('index.html', shell((feature ? hero : '') + markup + (dynamic ? '<script src="js/render.js"></script>' : ''))),
        textEntry('all-games.html', shell(markup + (dynamic ? '<script src="js/render.js"></script>' : ''))),
        ...[1, 2].map(n => textEntry('details/article' + n + '.html', shell('<img class="hero-img" src="old.png"><h1>Old</h1><div class="detail-content">Old prose</div>')))];
    if (dynamic) entries.push(textEntry('data.json', JSON.stringify([1, 2].map(id => ({ id, title: 'Old ' + id, excerpt: 'Old summary ' + id })))), textEntry('js/render.js', 'var CONFIG={dataFile:"data.json",categories:[{"name":"Original category","count":2}],fieldMapping:{},imageField:"image"};function createCard(item){var node=document.createElement("a");node.className="item-card";node.href="details/article"+item.id+".html";node.innerHTML="<h3>"+item.title+"</h3><p class=card-desc>"+item.excerpt+"</p>";return node;}fetch(CONFIG.dataFile).then(r=>r.json()).then(rows=>rows.forEach(row=>document.getElementById("grid").appendChild(createCard(row))));'));
    return { entries, metadata: { homePath: 'index.html', siteRoot: '', detailPaths: ['details/article1.html', 'details/article2.html'] } };
}
const games = async count => ({ contentItems: (await gameCatalogContent({ id: 'builtin', games: Array.from({ length: count }, (_, i) => ({ title: 'Game ' + (i + 1), description: 'Play ' + (i + 1), url: 'https://games.example/' + i, thumb: 'https://covers.example/' + i + '.webp' })) })).items });
const doc = (site, path = 'index.html') => new DOMParser().parseFromString(entryText(site.entries.find(entry => entry.path === path)), 'text/html');
const titles = page => [...page.querySelectorAll('.item-card h3')].map(node => node.textContent);

describe('game homepage featured allocation', () => {
    it.each([1, 2, 3, 8])('uses one featured slot and %i source records without duplicates or missing games', async count => {
        const original = template(), before = doc(original), output = reuseTemplateSite(original, await games(count)), after = doc(output);
        expect(after.querySelector('.hero h1').textContent).toBe('Game 1');
        expect(titles(after)).toEqual(Array.from({ length: count - 1 }, (_, i) => 'Game ' + (i + 2)));
        expect([after.querySelector('.hero h1').textContent, ...titles(after)]).toHaveLength(count);
        for (const selector of ['.category-title', '#adv2', 'nav', 'footer']) expect(after.querySelector(selector).outerHTML).toBe(before.querySelector(selector).outerHTML);
        if (count > 1) expect(after.querySelector('#adv2').previousElementSibling.querySelector('h3').textContent).toBe('Game 2');
        expect(output.metadata.detailPaths).toHaveLength(count);
        const all = doc(output, 'all-games.html'); expect(titles(all)).toEqual(Array.from({ length: count }, (_, i) => 'Game ' + (i + 1)));
        for (const anchor of after.querySelectorAll('.hero,.item-card')) {
            const detail = doc(output, resolveLocal(anchor.getAttribute('href'), 'index.html'));
            expect(detail.querySelector('h1').textContent).toBe(anchor.querySelector('h1,h3').textContent);
            expect(detail.querySelector('.hero-img').getAttribute('alt')).toBe(detail.querySelector('h1').textContent);
        }
        expect(entryText(original.entries[0])).toContain('Old feature');
    });
    it('retains existing category capacities and ad boundaries while refilling slots', async () => {
        const original = template(); original.entries[0] = textEntry('index.html', entryText(original.entries[0]).replace('</section>', '</section><section id="second"><h2>Second category</h2>' + card(1) + card(2) + '<div id="adv3">Tail ad</div></section>'));
        const after = doc(reuseTemplateSite(original, await games(8)));
        expect(after.querySelector('section').querySelectorAll('.item-card')).toHaveLength(2);
        expect(after.querySelector('#second').querySelectorAll('.item-card')).toHaveLength(5);
        expect(after.querySelector('#second').lastElementChild.id).toBe('adv3');
        expect(titles(after)).toEqual(['Game 2', 'Game 3', 'Game 4', 'Game 5', 'Game 6', 'Game 7', 'Game 8']);
    });
    it('does not skip game two when the template already reserves game one for the feature', async () => {
        expect(titles(doc(reuseTemplateSite(template({ exclusive: true }), await games(5))))).toEqual(['Game 2', 'Game 3', 'Game 4', 'Game 5']);
    });
    it('keeps every game in homepage cards when the template has no feature', async () => {
        expect(titles(doc(reuseTemplateSite(template({ feature: false }), await games(3))))).toEqual(['Game 1', 'Game 2', 'Game 3']);
    });
    it('preserves editorial featured duplication exactly as the original allocation', () => {
        const output = reuseTemplateSite(template(), { contentItems: parseContentJson([1, 2, 3].map(n => ({ title: 'Article ' + n, content: 'Article prose ' + n }))) });
        expect(doc(output).querySelector('.hero h1').textContent).toBe('Article 1'); expect(titles(doc(output))).toEqual(['Article 1', 'Article 2', 'Article 3']);
    });
    it.each([1, 3, 8])('creates homepage-only renderer/data copies for %i games and keeps the all-games source complete', async count => {
        const original = template({ dynamic: true }), output = reuseTemplateSite(original, await games(count)), home = doc(output), all = doc(output, 'all-games.html');
        const homeScript = resolveLocal(home.querySelector('script[src]').getAttribute('src'), 'index.html');
        expect(homeScript).not.toBe('js/render.js'); expect(all.querySelector('script[src]').getAttribute('src')).toBe('js/render.js');
        const script = entryText(output.entries.find(entry => entry.path === homeScript));
        const dataRef = script.match(/dataFile:\s*["']([^"']+)["']/)[1], homeRows = JSON.parse(entryText(output.entries.find(entry => entry.path === dataRef)));
        const fullRows = JSON.parse(entryText(output.entries.find(entry => entry.path === 'data.json')));
        expect(homeRows.map(row => row.title)).toEqual(Array.from({ length: count - 1 }, (_, i) => 'Game ' + (i + 2)));
        expect(fullRows.map(row => row.title)).toEqual(Array.from({ length: count }, (_, i) => 'Game ' + (i + 1)));
        expect(entryText(original.entries.find(entry => entry.path === 'js/render.js'))).not.toContain('sitefoundry-home');
    });
    it('avoids collisions with existing archive files when creating dynamic homepage copies', async () => {
        const original = template({ dynamic: true }); original.entries.push(textEntry('data-sitefoundry-home.json', 'ORIGINAL'), textEntry('js/render-sitefoundry-home.js', 'KEEP'));
        const output = reuseTemplateSite(original, await games(3)), script = doc(output).querySelector('script[src]').getAttribute('src');
        expect(script).not.toBe('js/render-sitefoundry-home.js');
        expect(entryText(output.entries.find(e => e.path === 'data-sitefoundry-home.json'))).toBe('ORIGINAL');
        expect(entryText(output.entries.find(e => e.path === 'js/render-sitefoundry-home.js'))).toBe('KEEP');
    });
    it('refreshes the homepage-only copy when a prior export becomes a template again', async () => {
        const first = reuseTemplateSite(template({ dynamic: true }), await games(3));
        const second = reuseTemplateSite(first, await games(5));
        const scriptPath = doc(second).querySelector('script[src]').getAttribute('src');
        const script = entryText(second.entries.find(e => e.path === scriptPath));
        const dataRef = script.match(/dataFile:\s*["']([^"']+)["']/)[1];
        const homeRows = JSON.parse(entryText(second.entries.find(e => e.path === dataRef)));
        expect(homeRows.map(row => row.title)).toEqual(['Game 2', 'Game 3', 'Game 4', 'Game 5']);
        expect(JSON.parse(entryText(second.entries.find(e => e.path === 'data.json')))).toHaveLength(5);
    });
});
