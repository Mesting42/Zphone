/** Browser-only coverage for responsive image selection and CSS backgrounds.
 * Run after unit tests: node tests/template-featured-content.browser.mjs. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { DOMParser } from 'linkedom';
import { reuseTemplateSite, parseContentJson } from '../js/template-reuse.js';
import { entryText, textEntry } from '../js/template-reuse-content.js';

globalThis.DOMParser = DOMParser;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'file:///C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const root = resolve('coverage/template-featured-20261022'); await mkdir(root, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
let files;
const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://local').pathname).replace(/^\//, '') || 'index.html';
    const file = files.get(path); if (!file) return res.writeHead(404).end();
    res.setHeader('Content-Type', ({ '.html': 'text/html;charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(path)] || 'application/octet-stream');
    res.end(file.bytes);
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port;
const report = [];
try {
    for (const kind of ['picture', 'stylesheet', 'inline']) {
        const media = kind === 'picture' ? '<picture><source media="(max-width:600px)" srcset="old-small.svg"><source srcset="old-large.svg"><img src="old.svg" srcset="old-large.svg 2x" data-src="old.svg" width="240" height="160"></picture>' : '';
        const heroStyle = kind === 'inline' ? ' style="background-image:linear-gradient(transparent,#333),url(old.svg)"' : '';
        const shell = body => '<html><head><title>Brand</title><link rel="stylesheet" href="site.css"></head><body><nav>Brand</nav>' + body + '</body></html>';
        const original = { entries: [textEntry('index.html', shell('<a class="hero" href="details/two.html"' + heroStyle + '>' + media + '<h1>Old headline</h1><p>Old summary</p><input id="search" placeholder="Search" oninput="window.searchValue=this.value"><span class="icon" style="background-image:url(icon.svg)">★</span><div id="adv-feature">Ad copy</div></a><h2 class="category-title">Original category</h2><div class="grid">' + ['one', 'two'].map(id => '<a class="item-card" href="details/' + id + '.html"><h3>Old card</h3></a>').join('') + '<div id="adv2">Tail ad</div></div>')),
            ...['one', 'two'].map(id => textEntry('details/' + id + '.html', shell('<h1>Old</h1><div class="detail-content">Old prose</div>'))),
            textEntry('site.css', '.hero{display:block;min-height:240px;max-width:650px;color:#111}' + (kind === 'stylesheet' ? '.hero{background-image:linear-gradient(transparent,#ddd),url(old.svg)}' : '')),
            textEntry('icon.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><path fill="green" d="M0 0h10v10H0z"/></svg>')], metadata: { siteRoot: '', homePath: 'index.html', detailPaths: ['details/one.html', 'details/two.html'] } };
        const contentItems = parseContentJson([1, 2, 3].map(n => ({ title: 'New headline ' + n, content: 'New summary ' + n, image: 'new.svg' })));
        const output = reuseTemplateSite(original, { contentItems, assets: [textEntry('new.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><path fill="blue" d="M0 0h240v160H0z"/></svg>')] });
        files = new Map(output.entries.map(entry => [entry.path, entry]));
        for (const width of [1280, 390]) {
            await page.setViewportSize({ width, height: 800 }); await page.goto(origin);
            const result = await page.evaluate(async () => {
                const hero = document.querySelector('.hero'), image = hero.querySelector('img');
                let cover;
                if (image) { await image.decode(); cover = image.currentSrc; }
                else { cover = getComputedStyle(hero).backgroundImage.match(/url\(["']?(.*?)["']?\)/)[1]; const probe = new Image(); probe.src = cover; await probe.decode(); }
                return { title: hero.querySelector('h1').textContent, href: hero.getAttribute('href'), cover, cards: document.querySelectorAll('.item-card').length, category: document.querySelector('.category-title').textContent, icon: hero.querySelector('.icon').getAttribute('style'), ad: document.querySelector('#adv2').textContent, tail: document.querySelector('.grid').lastElementChild.id };
            });
            assert.equal(result.title, 'New headline 1'); assert.equal(result.href, 'details/one.html');
            assert.match(result.cover, /assets\/template-reuse\/new\.svg$/); assert.equal(result.cards, 3);
            assert.equal(result.category, 'Original category'); assert.equal(result.icon, 'background-image:url(icon.svg)');
            assert.equal(result.ad, 'Tail ad'); assert.equal(result.tail, 'adv2');
            await page.locator('#search').fill('test'); assert.equal(await page.evaluate(() => window.searchValue), 'test');
            await page.screenshot({ path: resolve(root, `fixture-${kind}-${width}.png`) }); report.push({ kind, width, ...result });
        }
    }
    console.log('Featured browser fixtures passed: ' + report.length);
} finally { await writeFile(resolve(root, 'fixture-browser-results.json'), JSON.stringify(report, null, 2)); await browser.close(); await new Promise(done => server.close(done)); }
