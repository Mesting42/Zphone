/** Real-file regression for the batch UI and the three downloaded sites.
 * DATA_DIR and AD_DIR point to caller-provided fixtures; their originals are read only.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import { createServer } from 'node:http';
import { parseHTML } from 'linkedom';
import JSZip from 'jszip';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
assert.ok(process.env.DATA_DIR && process.env.AD_DIR, 'Provide DATA_DIR and AD_DIR');
const archives = (await readdir(process.env.DATA_DIR)).filter(n => /\.(zip|rar|7z)$/i.test(n)).sort();
const ads = (await readdir(process.env.AD_DIR)).filter(n => /^(?:zp|wd).*\.txt$/i.test(n)).sort();
assert.equal(archives.length, 3, 'Use the three reproduction data sources');
assert.equal(ads.length, 3, 'Use three advertisement files');
const output = resolve('coverage/ad-page-isolation');
await mkdir(output, { recursive: true });
const results = { archives, ads, pageErrors: [], previews: [], exports: [] };
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
page.setDefaultTimeout(30000);
page.on('pageerror', error => results.pageErrors.push(error.message));

async function switchPage(type) {
  await refreshPreview(() => page.locator('.preview-tab[data-page="' + type + '"]').click());
  await page.frameLocator('#preview-frame').locator(type === 'all' ? '#all-articles' : type === 'detail' ? '.detail-title' : '.main-content').waitFor();
}

// The app debounces rendering and assigns srcdoc after two animation frames.
// Every check waits for the replacement document; an existing selector may belong to the previous site.
async function refreshPreview(action) {
  await page.evaluate(() => {
    const frame = document.getElementById('preview-frame');
    frame.__testAwaitingLoad = true;
    frame.addEventListener('load', () => { frame.__testAwaitingLoad = false; }, { once: true });
  });
  await action();
  await page.waitForFunction(() => {
    const frame = document.getElementById('preview-frame');
    return frame.__testAwaitingLoad === false && !frame.hasAttribute('data-refreshing');
  });
}

async function selectSite(index) {
  const tab = page.locator('[data-batch-preview-site-index="' + index + '"]');
  await refreshPreview(() => tab.click());
  await tab.waitFor({ state: 'visible' });
  await page.waitForFunction(i => document.querySelector('[data-batch-preview-site-index="' + i + '"]')?.getAttribute('aria-selected') === 'true', index);
}

async function placement(type, position) {
  await switchPage(type);
  await refreshPreview(() => page.locator('.ad-select-btn[data-ad="adv2"]').click());
  const marker = page.frameLocator('#preview-frame').locator('.insert-marker[data-page="' + type + '"][data-position="' + position + '"]');
  await refreshPreview(() => marker.click());
  await page.frameLocator('#preview-frame').locator('#adv2').waitFor();
}

async function inspectPreview() {
  return page.frameLocator('#preview-frame').locator('body').evaluate(body => {
    const ad = body.querySelector('#adv2'), cards = Array.from(body.querySelectorAll('#all-articles .item-card'));
    const rect = ad?.getBoundingClientRect();
    return { adCount: body.querySelectorAll('#adv2').length, cards: cards.length,
      beforeCards: cards.filter(card => card.compareDocumentPosition(ad) & 4).length,
      afterCards: cards.filter(card => ad.compareDocumentPosition(card) & 4).length,
      centered: rect ? Math.abs(rect.left + rect.width / 2 - body.ownerDocument.documentElement.clientWidth / 2) < 2 : null,
      middle: !!ad?.closest('[data-sitefoundry-middle-ad]'),
      beforeBody: !!ad && !!body.querySelector('.detail-page p') && !!(ad.compareDocumentPosition(body.querySelector('.detail-page p')) & 4) };
  });
}

try {
  await page.goto(process.env.BUILDER_URL || 'http://127.0.0.1:5174/', { waitUntil: 'domcontentloaded' });
  assert.match(await page.title(), /建站工具/);
  await page.locator('[data-build-mode="batch-ad-build"]').click();
  await page.locator('#batch-data-input').setInputFiles(archives.map(n => join(process.env.DATA_DIR, n)));
  await page.waitForFunction(() => document.querySelectorAll('#batch-data-list .batch-ad-data-item').length === 3, null, { timeout: 120000 });
  results.import = await page.locator('#batch-data-list').innerText();
  console.log('Three real archives imported');
  for (const step of [2, 3, 4]) {
    await page.locator('#btn-next').click();
    await page.locator('#step-' + step + '.active').waitFor();
  }
  await page.locator('.config-tab[data-tab="ads"]').click();
  await page.locator('#batch-ad-code-input').setInputFiles(ads.map(n => join(process.env.AD_DIR, n)));
  await page.waitForFunction(() => document.querySelectorAll('.batch-ad-code-select option').length >= 12);
  const selectors = page.locator('.batch-ad-code-select');
  for (let i = 0; i < 3; i++) {
    const values = await selectors.nth(i).locator('option').evaluateAll(options => options.map(o => o.value).filter(Boolean));
    await selectors.nth(i).selectOption(values[i], { force: true });
  }
  await page.locator('input[name="direct-ad-placement-mode"][value="manual"]').check({ force: true });
  await switchPage('all');
  const initial = await inspectPreview();
  assert.ok(initial.middle && initial.beforeCards > 0 && initial.afterCards > 0);
  await placement('detail', 'detail-before-content');
  assert.ok((await inspectPreview()).beforeBody, 'Article banner2 precedes article text');
  await switchPage('all');
  assert.deepEqual(await inspectPreview(), initial, 'Article changes must not affect the listing');
  results.previews.push({ check: 'article change leaves listing unchanged', ...initial });

  // The listing supports its own moves, cancellation and removal/restoration.
  await refreshPreview(() => page.locator('.ad-select-btn[data-ad="adv2"]').click());
  await refreshPreview(() => page.locator('.ad-select-btn[data-ad="adv2"]').click());
  assert.deepEqual(await inspectPreview(), initial, 'Cancel must retain saved positions');
  await placement('all', 'content-bottom');
  assert.equal((await inspectPreview()).afterCards, 0);
  await switchPage('detail');
  assert.ok((await inspectPreview()).beforeBody);
  await placement('home', 'content-top');
  await switchPage('all');
  assert.equal((await inspectPreview()).afterCards, 0, 'Home changes must not affect listing');
  await refreshPreview(() => page.locator('.ad-remove-btn[data-ad="adv2"]').click());
  await page.frameLocator('#preview-frame').locator('#adv2').waitFor({ state: 'detached' });
  await switchPage('detail');
  assert.ok((await inspectPreview()).beforeBody, 'Listing removal must preserve article ad');
  await switchPage('all');
  await placement('all', 'content-middle');
  // Multi-category home pages expose section boundaries rather than a grid-middle marker.
  await placement('home', 'after-section-0');

  // Shared settings reach all three sites; overriding site 2 only changes that site.
  for (let i = 0; i < 3; i++) {
    await selectSite(i);
    await switchPage('detail');
    assert.ok((await inspectPreview()).beforeBody);
    await switchPage('all');
    assert.ok((await inspectPreview()).middle);
  }
  await selectSite(1);
  await refreshPreview(() => page.locator('#batch-code-placement-override').check({ force: true }));
  await placement('all', 'content-top');
  assert.equal((await inspectPreview()).beforeCards, 0);
  for (const i of [0, 2]) {
    await selectSite(i);
    await switchPage('all');
    const sharedCheck = await inspectPreview();
    assert.ok(sharedCheck.middle, 'Site override must not alter shared defaults for site ' + i + ': ' + JSON.stringify(sharedCheck));
  }
  await page.screenshot({ path: join(output, 'builder-listing.png'), fullPage: false });
  await switchPage('detail');
  await page.screenshot({ path: join(output, 'builder-article.png'), fullPage: false });
  console.log('UI moves, cancellation, removal/restoration and site override passed');

  const downloads = [];
  const downloaded = new Promise(resolveAll => page.on('download', download => {
    downloads.push(download); if (downloads.length === 3) resolveAll();
  }));
  await page.locator('#btn-next').click();
  await page.locator('#step-5.active').waitFor();
  await page.locator('#btn-export').click();
  await Promise.race([downloaded, new Promise((_, reject) => setTimeout(() => reject(new Error('Three export downloads did not finish')), 120000).unref())]);
  console.log('Three ZIP downloads received');
  for (const download of downloads) {
    const name = download.suggestedFilename();
    await download.saveAs(join(output, name));
    const zip = await JSZip.loadAsync(await readFile(join(output, name)));
    const paths = Object.keys(zip.files).filter(p => !zip.files[p].dir);
    const listingPath = paths.find(p => p.endsWith('/all-articles.html'));
    const root = listingPath.slice(0, -'all-articles.html'.length);
    const report = JSON.parse(await zip.file(root + 'BATCH_AD_EXPORT_REPORT.json').async('string'));
    assert.equal(report.preflight.valid, true);
    const data = JSON.parse(await zip.file(root + 'data.json').async('string'));
    const listingHtml = await zip.file(listingPath).async('string');
    const doc = parseHTML(listingHtml).document;
    assert.equal(doc.querySelectorAll('#all-articles .item-card').length, data.length);
    const detailPaths = paths.filter(p => /\/details\/[^/]+\.html$/.test(p));
    assert.equal(detailPaths.length, data.length);
    for (const path of detailPaths) {
      const article = parseHTML(await zip.file(path).async('string')).document;
      assert.ok(article.querySelector('#adv2').compareDocumentPosition(article.querySelector('.detail-content')) & 4);
    }
    const expectedTop = report.sites[0].dataSource === archives[1];
    assert.equal(!!doc.querySelector('#adv2').closest('[data-sitefoundry-middle-ad]'), !expectedTop);

    // Serve the actual ZIP contents to check layout at desktop and mobile widths.
    const served = new Map(await Promise.all(paths.map(async p => [p.slice(root.length), await zip.file(p).async('nodebuffer')])));
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };
    const server = createServer((req, res) => {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname.slice(1)) || 'index.html';
      const body = served.get(path); res.writeHead(body ? 200 : 404, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' }); res.end(body || 'Missing');
    });
    await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
    const verifyPage = await browser.newPage();
    // Prevent live ad impressions and analytics during a layout regression.
    await verifyPage.route(/https:\/\//, route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    const layouts = [];
    try {
      for (const width of [1366, 390]) {
        await verifyPage.setViewportSize({ width, height: 900 });
        await verifyPage.goto('http://127.0.0.1:' + server.address().port + '/all-articles.html', { waitUntil: 'load' });
        await verifyPage.locator('#adv2').waitFor();
        await verifyPage.evaluate(() => new Promise(resolveFrames => requestAnimationFrame(() => requestAnimationFrame(resolveFrames))));
        const layout = await verifyPage.evaluate(() => {
          const ad = document.getElementById('adv2'), rect = ad.getBoundingClientRect();
          const cards = Array.from(document.querySelectorAll('#all-articles .item-card'));
          const before = cards.filter(c => c.getBoundingClientRect().bottom <= rect.top + 1);
          const after = cards.filter(c => c.getBoundingClientRect().top >= rect.bottom - 1);
          return { width: document.documentElement.clientWidth, centerError: Math.abs(rect.left + rect.width / 2 - document.documentElement.clientWidth / 2),
            before: before.length, after: after.length, cards: cards.length,
            overlaps: cards.some(c => { const r = c.getBoundingClientRect(); return r.top < rect.bottom - 1 && r.bottom > rect.top + 1; }) };
        });
        assert.ok(layout.centerError < 2 && !layout.overlaps, JSON.stringify(layout));
        assert.ok(expectedTop ? layout.before === 0 : layout.before > 0 && layout.after > 0);
        layouts.push(layout);
        if (width === 1366) await verifyPage.screenshot({ path: join(output, name.replace(/\.zip$/, '') + '-listing.png'), fullPage: true });
      }
    } finally { await verifyPage.close(); await new Promise(resolveClose => server.close(resolveClose)); }
    results.exports.push({ name, articles: data.length, detailPages: detailPaths.length, files: paths.length, preflight: report.preflight.valid, listingPlacement: expectedTop ? 'content-top (site override)' : 'content-middle', layouts });
  }
  assert.deepEqual(results.pageErrors, []);
  results.passed = true;
} catch (error) {
  results.failure = error.stack;
  await page.screenshot({ path: join(output, 'failure.png'), fullPage: false });
  await writeFile(join(output, 'failure-page.txt'), await page.locator('body').innerText());
  throw error;
} finally {
  await writeFile(join(output, 'results.json'), JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(JSON.stringify(results.exports, null, 2));
