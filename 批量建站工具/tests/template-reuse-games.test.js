import { describe, it, expect } from 'vitest';
import { DOMParser } from 'linkedom';
import { gameCatalogContent } from '../js/template-reuse-games.js';
import { normalizeGameCatalog } from '../js/game-catalog-source.js';
import { reuseTemplateSite } from '../js/template-reuse.js';
import { createPolicyPreview } from '../js/ad-policy-preview.js';
import { textEntry, entryText } from '../js/template-reuse-content.js';
globalThis.DOMParser = DOMParser;

function template(prefix = '', dynamic = false) {
    const shell = value => '<html><head><title>Original template</title><link rel="stylesheet" href="' + prefix + 'css/site.css"></head><body><nav>Original navigation</nav>' + value + '<footer>Original footer</footer></body></html>';
    const entries = [textEntry(prefix + 'index.html', shell('<main><h2 class="category-title">Old category</h2><div class="items-grid">' + (dynamic ? '' : '<a class="item-card" href="details/article1.html"><img><h2 class="card-title">Old title</h2><p class="card-desc">Old summary</p></a>') + '</div><div id="adv2">Middle ad</div></main>')),
        textEntry(prefix + 'details/article1.html', shell('<h1 class="detail-title">Old title</h1><div class="detail-content"><p>Old prose</p><div id="adv2">Middle ad</div></div>')),
        textEntry(prefix + 'css/site.css', '.items-grid{display:grid;gap:23px}'), textEntry(prefix + 'js/ad.js', 'const keepOriginalAds=true;')];
    if (dynamic) entries.push(textEntry(prefix + 'js/script.js', 'var CONFIG={dataFile:"data.json",fieldMapping:{"title":"title","image":"thumb"},categories:[{"name":"Old category","count":1}],imageField:"thumb"}; function createCard(x){return "details/article"+x.id+".html"} fetch(CONFIG.dataFile);'), textEntry(prefix + 'data.json', '[{"id":1,"title":"Old title"}]'));
    return { entries, metadata: { siteRoot: prefix, homePath: prefix + 'index.html', detailPaths: [prefix + 'details/article1.html'], adPath: prefix + 'js/ad.js' } };
}
const remote = index => ({ title: 'Game ' + index, description: 'Game instructions ' + index, url: 'https://games.example/' + index, thumb: 'https://covers.example/' + index + '.webp' });
const doc = (site, path) => new DOMParser().parseFromString(entryText(site.entries.find(entry => entry.path === path)), 'text/html');

describe('game catalog template reuse', () => {
    it('normalizes game aliases and rejects unsafe entries and duplicate URLs', () => {
        expect(normalizeGameCatalog({ games: [{ name: 'Alias', gameUrl: 'https://games.example/1', image: 'https://covers.example/1.webp' }, remote(1), { ...remote(2), url: 'javascript:bad()' }] }, 'builtin').map(game => game.title)).toEqual(['Alias']);
        expect(normalizeGameCatalog([{ ...remote(1), url: '../outside.html' }], 'saved-local')).toEqual([]);
    });
    it('converts an article template to playable games while retaining shell, CSS and ads', async () => {
        const source = template();
        const parsed = await gameCatalogContent({ id: 'builtin', name: 'Default', games: [remote(1), remote(2)] });
        const output = reuseTemplateSite(source, { contentItems: parsed.items });
        expect(doc(output, 'index.html').querySelectorAll('.item-card')).toHaveLength(2);
        const page = doc(output, 'details/article1.html');
        expect(page.querySelector('iframe').getAttribute('src')).toBe('https://games.example/1');
        expect(page.querySelector('iframe').getAttribute('title')).toBe('Game 1');
        expect(page.querySelector('nav').textContent).toBe('Original navigation');
        expect(page.querySelector('.detail-content #adv2').textContent).toBe('Middle ad');
        for (const path of ['css/site.css', 'js/ad.js']) expect(entryText(output.entries.find(entry => entry.path === path))).toBe(entryText(source.entries.find(entry => entry.path === path)));
        expect(doc(source, 'details/article1.html').querySelector('iframe')).toBeNull();
    });
    it('keeps every game when the catalog exceeds the original dynamic card counts', async () => {
        const parsed = await gameCatalogContent({ id: 'builtin', games: Array.from({ length: 83 }, (_, i) => remote(i)) });
        const output = reuseTemplateSite(template('', true), { contentItems: parsed.items });
        const config = entryText(output.entries.find(entry => entry.path === 'js/script.js'));
        expect(config).toContain('"count":83');
        expect(JSON.parse(entryText(output.entries.find(entry => entry.path === 'data.json')))).toHaveLength(83);
        expect(output.metadata.detailPaths).toHaveLength(83);
    });
    it('copies nested local game dependencies, local covers and the source license', async () => {
        const parsed = await gameCatalogContent({ id: 'saved-local', name: 'Saved', games: [{ ...remote(1), url: 'games/puzzle/index.html', thumb: 'cover.webp' }],
            localImages: { 'cover.webp': new Blob([new Uint8Array([1, 2, 3])]) },
            localGameFiles: { 'puzzle/index.html': '<html><head><script src="game.js"></script></head><body><a href="index.html">Game catalog</a></body></html>', 'puzzle/game.js': 'window.started=true;' }, sourceNotice: { licenseText: 'MIT license', repository: 'https://example.com/source' } });
        const output = reuseTemplateSite(template('outer/site/'), { ...parsed, contentItems: parsed.items });
        expect(doc(output, 'outer/site/details/article1.html').querySelector('iframe').getAttribute('src')).toBe('../assets/template-reuse-games/puzzle/index.html');
        expect(output.entries.some(entry => entry.path === 'outer/site/assets/template-reuse-games/puzzle/game.js')).toBe(true);
        expect(entryText(output.entries.find(entry => /LICENSE.txt$/.test(entry.path)))).toBe('MIT license');
        expect(doc(output, 'outer/site/assets/template-reuse-games/puzzle/index.html').querySelector('a').getAttribute('href')).toBe('../../../index.html');
        expect(output.entries.find(entry => /template-reuse\/cover.webp$/.test(entry.path)).bytes).toEqual(new Uint8Array([1, 2, 3]));
        const preview = createPolicyPreview().build(output.entries, 'outer/site/details/article1.html', output.metadata);
        const frame = new DOMParser().parseFromString(preview, 'text/html').querySelector('iframe');
        expect(frame.getAttribute('src')).toMatch(/^data:text\/html;base64,/);
        const localHtml = atob(frame.getAttribute('src').split(',')[1]);
        expect(localHtml).toContain('data:text/javascript;base64,');
        expect(entryText(output.entries.find(entry => /puzzle\/index.html$/.test(entry.path)))).toContain('src="game.js"');
    });
    it('blocks a missing local entry rather than exporting a broken player', async () => {
        const parsed = await gameCatalogContent({ id: 'saved-local', games: [{ ...remote(1), url: 'games/missing.html' }] });
        expect(() => reuseTemplateSite(template(), { ...parsed, contentItems: parsed.items })).toThrow(/缺少本地游戏文件/);
    });
    it('rewrites raw entry-file and cover aliases used by export preflight', async () => {
        const parsed = await gameCatalogContent({ id: 'saved-local', games: [{ ...remote(1), url: 'games/ball.html', gameFile: 'ball.html', thumb: 'ball.webp', coverFile: 'ball.webp' }],
            localImages: { 'ball.webp': new Blob(['cover']) }, localGameFiles: { 'ball.html': '<html><body>Game</body></html>' } });
        const output = reuseTemplateSite(template('', true), { ...parsed, contentItems: parsed.items });
        const row = JSON.parse(entryText(output.entries.find(entry => entry.path === 'data.json')))[0];
        expect(row.gameFile).toBe('assets/template-reuse-games/ball.html');
        expect(row.url).toBe(row.gameFile);
        expect(row.coverFile).toBe('assets/template-reuse/ball.webp');
        expect(row.thumb).toBe(row.coverFile);
    });
    it('reuses the native player outside the prose without duplicating it', async () => {
        const source = template();
        source.entries[1] = textEntry('details/article1.html', '<html><head></head><body><h1>Old</h1><div class="game-frame-shell"><iframe src="old.html"></iframe></div><div class="detail-content">Old</div></body></html>');
        const parsed = await gameCatalogContent({ id: 'builtin', games: [remote(1)] });
        const output = reuseTemplateSite(source, { contentItems: parsed.items });
        const page = doc(output, 'details/article1.html');
        expect(page.querySelectorAll('iframe')).toHaveLength(1);
        expect(page.querySelector('.game-frame-shell iframe').getAttribute('src')).toBe('https://games.example/1');
    });
    it('supports JFIF covers found in bundled catalogs and replaces the old game fallback', async () => {
        const source = template();
        source.entries[1] = textEntry('details/article1.html', '<html><head></head><body><h1>Old</h1><section class="game-stage"><div class="game-stage-preview">OLD GAME</div></section><div class="detail-content">Old</div><a class="action-btn">Old action</a></body></html>');
        const parsed = await gameCatalogContent({ id: 'saved-local', games: [{ ...remote(1), thumb: 'cover.jfif' }], localImages: { 'cover.jfif': new Blob(['cover']) } });
        const output = reuseTemplateSite(source, { ...parsed, contentItems: parsed.items });
        expect(output.entries.some(entry => /cover.jfif$/.test(entry.path))).toBe(true);
        const page = doc(output, 'details/article1.html');
        expect(page.body.textContent).not.toContain('OLD GAME');
        expect(page.querySelector('.action-btn').getAttribute('href')).toBe('https://games.example/1');
        expect(page.querySelectorAll('iframe')).toHaveLength(1);
    });
});
