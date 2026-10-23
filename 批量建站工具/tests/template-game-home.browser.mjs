/** Exercise the JSON-rendered path using local games/assets. Homepage data is
 * specialized without removing the first game from the shared all-games page. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { DOMParser } from 'linkedom';
import { reuseTemplateSite } from '../js/template-reuse.js';
import { gameCatalogContent } from '../js/template-reuse-games.js';
import { textEntry } from '../js/template-reuse-content.js';
globalThis.DOMParser = DOMParser;
const { chromium } = await import('file:///C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const root = resolve('coverage/template-game-home-20261022'); await mkdir(root, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true }), page = await browser.newPage(), report = [];
page.on('pageerror', error => console.log('Fixture page error: ' + error.message));
let files;
const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://local').pathname).slice(1) || 'index.html', entry = files.get(path);
    if (!entry) return res.writeHead(404).end();
    res.setHeader('Content-Type', ({ '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' })[extname(path)] || 'application/octet-stream'); res.end(entry.bytes);
});
await new Promise(done => server.listen(0, '127.0.0.1', done)); const origin = 'http://127.0.0.1:' + server.address().port;
const shell = body => '<html><head><style>body{font:16px/1.5 Arial;margin:20px}.hero,.item-card{display:block;color:inherit;text-decoration:none}img{width:120px;height:80px}#grid0,#grid1{display:flex;gap:12px;flex-wrap:wrap}.item-card{width:180px}.hero{max-width:500px}h1{font-size:26px}h2{font-size:20px}</style></head><body>' + body + '</body></html>';
const listing = '<section><h2 class="category-title">Original A</h2><div id="grid0"></div></section><div id="adv2">Middle ad</div><section><h2 class="category-title">Original B</h2><div id="grid1"></div></section><script src="js/render.js"></script>';
const feature = '<a class="hero" href="details/article1.html"><img src="old.svg"><h1>Old feature</h1><p>Original introduction</p></a>';
const renderer = 'var CONFIG={dataFile:"data.json",categories:[{"name":"Original A","count":1},{"name":"Original B","count":1}],fieldMapping:{},imageField:"image"};function createCard(item){var node=document.createElement("a");node.className="item-card";node.href="details/article"+item.id+".html";node.innerHTML="<h3>"+item.title+"</h3><p class=card-desc>"+item.excerpt+"</p>";var image=document.createElement("img");image.src=item.image;node.prepend(image);return node;}fetch(CONFIG.dataFile).then(r=>r.json()).then(rows=>{var offset=0;CONFIG.categories.forEach((cat,index)=>{rows.slice(offset,offset+cat.count).forEach(row=>document.getElementById("grid"+index).appendChild(createCard(row)));offset+=cat.count;});document.body.dataset.rendered="yes";});';
try {
    for (const count of [1, 3, 8]) {
        const catalog = { id: 'saved-local', games: [], localImages: {}, localGameFiles: {} };
        for (let n = 1; n <= count; n++) { catalog.games.push({ title: 'Game ' + n, description: 'Play game ' + n, url: 'games/g' + n + '.html', thumb: n + '.svg' }); catalog.localImages[n + '.svg'] = new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><path fill="teal" d="M0 0h120v80H0z"/></svg>']); catalog.localGameFiles['g' + n + '.html'] = '<html><body>Local game ' + n + '</body></html>'; }
        const parsed = await gameCatalogContent(catalog);
        const entries = [textEntry('index.html', shell(feature + listing)), textEntry('all-games.html', shell(listing)), textEntry('data.json', '[{"id":1,"excerpt":"Old A"},{"id":2,"excerpt":"Old B"}]'), textEntry('js/render.js', renderer), ...[1, 2].map(n => textEntry('details/article' + n + '.html', shell('<h1>Old title</h1><div class="detail-content">Old prose</div>')))];
        const result = reuseTemplateSite({ entries, metadata: { siteRoot: '', homePath: 'index.html', detailPaths: ['details/article1.html', 'details/article2.html'] } }, { ...parsed, contentItems: parsed.items }); files = new Map(result.entries.map(entry => [entry.path, entry]));
        for (const width of [1280, 390]) {
            await page.setViewportSize({ width, height: 1000 });
            for (const path of ['index.html', 'all-games.html']) {
                await page.goto(origin + '/' + path); await page.locator('body[data-rendered="yes"]').waitFor();
                const titles = await page.locator('.item-card h3').allTextContents(), expected = Array.from({ length: count - (path === 'index.html' ? 1 : 0) }, (_, i) => 'Game ' + (i + (path === 'index.html' ? 2 : 1)));
                assert.deepEqual(titles, expected);
                if (path === 'index.html') assert.equal(await page.locator('.hero h1').innerText(), 'Game 1');
                assert.deepEqual(await page.locator('.category-title').allTextContents(), ['Original A', 'Original B']); assert.equal(await page.locator('#adv2').innerText(), 'Middle ad');
                if (expected.length) assert.equal(await page.locator('#grid0 .item-card').count(), 1);
                for (const image of await page.locator('img').all()) await image.evaluate(node => node.decode());
                const hrefs = await page.locator('.hero,.item-card').evaluateAll(nodes => nodes.map(n => n.getAttribute('href'))); assert.equal(new Set(hrefs).size, count);
                if (count === 3) await page.screenshot({ path: resolve(root, `dynamic-${path.replace('.html', '')}-${width}.png`) });
                report.push({ count, width, path, titles, uniqueGames: new Set(hrefs).size, loaded: true });
            }
        }
    }
    console.log('Dynamic homepage/all-games browser checks passed: ' + report.length);
} catch (error) { await writeFile(resolve(root, 'dynamic-failure.html'), await page.content()); throw error; }
finally { await writeFile(resolve(root, 'dynamic-browser-results.json'), JSON.stringify(report, null, 2)); await browser.close(); await new Promise(done => server.close(done)); }
