/** Run the real planner in Chromium: an advertisement must never split an
 * original visual card row, including after responsive layout changes. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, sep, extname } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH
  || 'C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const source = readFileSync(new URL('../js/finished-site-ads.js', import.meta.url), 'utf8')
  + '\nwindow.planner = FinishedSiteAds;';
const { DOMParser } = require('../js/source-export-dom.cjs');
const core = { TextEncoder, TextDecoder, Uint8Array, Blob, DOMParser, window: {} };
for (const name of ['template-catalog', 'template-layouts', 'navbar-layout', 'data', 'domain', 'ad-migration', 'ad', 'generator', 'finished-site-ads', 'ad-restoration']) {
  vm.runInNewContext(readFileSync(new URL('../js/' + name + '.js', import.meta.url), 'utf8'), core);
}
vm.runInNewContext('this.ads = AdRestoration;', core);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
let siteServer;

// Capture row membership rather than a CSS column count. This also checks flex
// wrapping, unnamed classes, hidden cards and naturally incomplete final rows.
function inspectRows() {
  const cards = Array.from(document.querySelectorAll('[data-card]'));
  const ad = document.getElementById('adv2');
  const adBox = ad && ad.getBoundingClientRect();
  const rows = [];
  cards.forEach(card => {
    const rect = card.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    let row = rows.find(item => Math.abs(item.top - rect.top) < 2);
    if (!row) { row = { top: rect.top, ids: [] }; rows.push(row); }
    row.ids.push(card.getAttribute('data-card'));
  });
  return {
    rows: rows.map(row => row.ids),
    order: cards.map(card => card.getAttribute('data-card')),
    insideCard: !!document.querySelector('[data-card] #adv2'),
    ads: document.querySelectorAll('#adv2').length,
    before: ad ? cards.filter(card => card.compareDocumentPosition(ad) & 4).length : 0,
    overlaps: !!adBox && cards.some(card => {
      const box = card.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.top < adBox.bottom - 1 && box.bottom > adBox.top + 1;
    })
  };
}

try {
  for (const mode of ['manual', 'fixed']) for (const layout of ['grid', 'flex']) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 800 } });
    const content = Array.from({ length: 14 }, (_, index) =>
      `<article data-card="${index}"><a href="#${index}"><h2>Item ${index}</h2></a><p>Original card content.</p></article>`).join('');
    const html = `<!doctype html><html><head><style>
      *{box-sizing:border-box}body{margin:0}main{padding:16px}
      .collection{--columns:5;display:${layout};gap:12px;${layout === 'grid' ? 'grid-template-columns:repeat(var(--columns),minmax(0,1fr))' : 'flex-wrap:wrap'}}
      [data-card]{min-width:0;height:140px;background:#e9f3f0;${layout === 'flex' ? 'flex:0 0 calc((100% - (var(--columns) - 1)*12px)/var(--columns))' : ''}}
      @media(max-width:1400px){.collection{--columns:4}}@media(max-width:1100px){.collection{--columns:3}}@media(max-width:800px){.collection{--columns:2}}@media(max-width:500px){.collection{--columns:1}}
    </style></head><body><header>Navigation</header><main><div class="collection">${content}</div></main><footer>Footer</footer></body></html>`;
    await page.setContent(html);
    await page.addScriptTag({ content: source });
    // The fourth-card gap splits a three-column row in the reported bug. Keep
    // this manual target across every width, rather than resetting to middle.
    await page.evaluate(mode => {
      planner.placePolicy(document, 'article', [{ unit: 'banner2', position: mode === 'manual' ? 'custom-after-0-3' : 'content-middle' }]);
      planner.decoratePreview(document);
    }, mode);
    for (const width of [1600, 1280, 1000, 700, 390, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForTimeout(100);
      const actual = await page.evaluate(inspectRows);
      const reference = await browser.newPage({ viewport: { width, height: 800 } });
      await reference.setContent(html);
      const original = await reference.evaluate(inspectRows);
      await reference.close();
      assert.deepEqual(actual.rows, original.rows, `${layout} ${width}px: ad split an original row`);
      assert.deepEqual(actual.order, original.order, 'Card order changed');
      assert.equal(actual.insideCard, false, 'Ad was inserted inside a card');
      assert.equal(actual.ads, 1, 'Banner was lost or duplicated');
      assert.equal(actual.overlaps, false, 'Advertisement overlaps a card row');
      if (mode === 'manual' && width === 1000) assert.equal(actual.before, 3, 'Manual target was replaced by the list midpoint');
      results.push({ mode, layout, width, rows: actual.rows.map(row => row.length) });
    }
    // A serialized export must retain the same behavior when reopened without
    // the builder. Only the export's embedded layout runtime is available here.
    const policy = core.ads.createPolicy();
    policy.slots.home = policy.slots.detail = [
      { unit: 'off', position: 'after-navbar' },
      { unit: 'banner2', position: 'custom-after-0-3' },
      { unit: 'off', position: 'footer-top' }
    ];
    const exportResult = core.ads.injectAdsIntoSiteEntries([{ path: 'index.html', text: html }],
      { bannerPath2: '/123/rows.test-banner2' }, 'rows.test', policy, { mode, version: 'v1.0.2.1' });
    assert.equal(exportResult.valid, true, JSON.stringify(exportResult.errors));
    const exported = new TextDecoder().decode(exportResult.entries.find(entry => entry.path === 'index.html').bytes);
    const reopened = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    await reopened.route('https://**/*', route => route.abort());
    await reopened.setContent(exported);
    await reopened.waitForTimeout(100);
    const exportedRows = await reopened.evaluate(inspectRows);
    assert.deepEqual(exportedRows.rows.map(row => row.length), [3, 3, 3, 3, 2], `${mode} ${layout}: exported row split`);
    await reopened.close();
    await page.close();
  }

  // A fixed viewport can still gain/lose columns when its containing panel is
  // resized. Exercise auto-fit and ResizeObserver without a window resize event.
  const adaptive = await browser.newPage({ viewport: { width: 1400, height: 800 } });
  await adaptive.setContent('<main><div class="collection" style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));width:1300px">'
    + Array.from({ length: 14 }, (_, i) => `<article data-card="${i}" style="height:100px"><h2>${i}</h2></article>`).join('') + '</div></main>');
  await adaptive.addScriptTag({ content: source });
  await adaptive.evaluate(() => planner.placePolicy(document, 'article', [{ unit: 'banner2', position: 'custom-after-0-3' }]));
  for (const width of [1300, 740, 490]) {
    await adaptive.locator('.collection').evaluate((grid, width) => { grid.style.width = width + 'px'; }, width);
    await adaptive.waitForTimeout(100);
    const actual = await adaptive.evaluate(inspectRows);
    const columnCount = width === 1300 ? 5 : width === 740 ? 3 : 2;
    const expected = [];
    for (let i = 0; i < 14; i += columnCount) expected.push(Array.from({ length: Math.min(columnCount, 14 - i) }, (_, j) => String(i + j)));
    assert.deepEqual(actual.rows, expected, `auto-fit ${width}px: container resize split a row`);
  }
  // A one-row collection has no internal gap. The ad must use an outer edge.
  await adaptive.evaluate(() => {
    Array.from(document.querySelectorAll('[data-card]')).slice(3).forEach(card => card.remove());
    document.querySelector('.collection').style.width = '740px';
  });
  await adaptive.waitForTimeout(100);
  assert.deepEqual((await adaptive.evaluate(inspectRows)).rows, [['0', '1', '2']], 'A single original row was split');
  await adaptive.close();

  // Optional real uploaded site, served read-only without extracting/copying its
  // assets. The same manual policy is then passed through the actual exporter.
  if (process.env.FINISHED_SITE_ROOT) {
    const root = resolve(process.env.FINISHED_SITE_ROOT);
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' };
    siteServer = createServer(async (request, response) => {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = resolve(root, '.' + pathname, pathname.endsWith('/') ? 'index.html' : '');
      if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
      try {
        const bytes = await readFile(file);
        response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(bytes);
      }
      catch { response.writeHead(404).end(); }
    });
    await new Promise(done => siteServer.listen(0, '127.0.0.1', done));
    const origin = 'http://127.0.0.1:' + siteServer.address().port;
    const routePath = process.env.FINISHED_SITE_ROUTE || '/';
    const actual = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    await actual.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await actual.goto(origin + routePath, { waitUntil: 'networkidle' });
    await actual.addScriptTag({ content: source });
    const manualPosition = await actual.evaluate(() => {
      const chosen = document.querySelectorAll('.story-grid > article p')[3];
      const gap = planner.semanticBoundaries(document).find(gap => gap.anchor === chosen);
      if (!gap) throw new Error('No semantic manual target in the fourth card');
      return 'content-ratio-' + gap.ratio;
    });
    const policy = core.ads.createPolicy();
    policy.slots.home = policy.slots.detail = [
      { unit: 'off', position: 'after-navbar' }, { unit: 'banner2', position: manualPosition }, { unit: 'off', position: 'footer-top' }
    ];
    const originalHtml = await readFile(resolve(root, '.' + routePath, routePath.endsWith('/') ? 'index.html' : ''), 'utf8');
    const exported = core.ads.injectAdsIntoSiteEntries([{ path: 'index.html', text: originalHtml }],
      { bannerPath2: '/123/rows.test-banner2' }, 'rows.test', policy, { mode: 'manual', version: 'v1.0.2.1' });
    assert.equal(exported.valid, true, JSON.stringify(exported.errors));
    const exportedHtml = new TextDecoder().decode(exported.entries.find(entry => entry.path === 'index.html').bytes);
    const originalRows = () => {
      const rows = [];
      document.querySelectorAll('.story-grid > article').forEach(card => {
        const top = card.offsetTop;
        let row = rows.find(row => row.top === top);
        if (!row) { row = { top, titles: [] }; rows.push(row); }
        row.titles.push(card.querySelector('h3').textContent);
      });
      return rows.map(row => row.titles);
    };
    for (const width of [1280, 900, 390]) {
      await actual.setViewportSize({ width, height: 900 });
      await actual.goto(origin + routePath, { waitUntil: 'networkidle' });
      const baseline = await actual.evaluate(originalRows);
      await actual.setContent(exportedHtml, { waitUntil: 'networkidle' });
      await actual.waitForTimeout(100);
      const after = await actual.evaluate(originalRows);
      assert.deepEqual(after, baseline, `Actual site ${width}px: an original row was split`);
      assert.equal(await actual.locator('.story-grid > #adv2').count(), 1, JSON.stringify(await actual.evaluate(() => {
        const ad = document.getElementById('adv2');
        return { ad: ad && ad.outerHTML.slice(0, 500), parent: ad && ad.parentElement.outerHTML.slice(0, 600) };
      })));
      results.push({ mode: 'real-export', width, rows: after.map(row => row.length) });
      if (width === 1280) {
        // Load lazy covers before capturing evidence, so the screenshot records
        // the real cards rather than their temporary image backgrounds.
        await actual.locator('.story-grid img').evaluateAll(images => Promise.all(images.map(image => {
          image.loading = 'eager';
          return image.decode().catch(() => {});
        })));
        await actual.evaluate(() => {
          const area = document.querySelector('#div-gpt-ad-banner2');
          area.style.cssText += 'background:#bbc6d6;color:#245a8d;display:grid;place-items:center';
          area.textContent = 'banner2 · 广告位置';
        });
        await actual.locator('#adv2').scrollIntoViewIfNeeded();
        await mkdir('coverage/finished-site-card-rows', { recursive: true });
        await actual.screenshot({ path: 'coverage/finished-site-card-rows/actual-export-1280.png' });
      }
    }
    await actual.close();
  }
  console.log(JSON.stringify({ passed: true, checks: results.length, results }, null, 2));
} finally {
  await browser.close();
  if (siteServer) await new Promise(done => siteServer.close(done));
}
