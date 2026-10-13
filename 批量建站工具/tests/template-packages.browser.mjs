/**
 * Opt-in real UI/download/reopen check for the independent editorial package.
 * Supply TEMPLATE_PACKAGE_INPUT and AD_CODE_INPUT; both are read-only inputs.
 * Ads use a local recording GPT substitute, never a real impression request.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
import JSZip from 'jszip';
import {expandPicker} from './workbench-browser-helpers.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
assert.ok(process.env.TEMPLATE_PACKAGE_INPUT && process.env.AD_CODE_INPUT, 'Provide TEMPLATE_PACKAGE_INPUT and AD_CODE_INPUT');
const output = resolve(process.env.TEMPLATE_PACKAGE_OUTPUT || 'coverage/template-packages-20261012/new-template');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const report = { generatedAt: new Date().toISOString(), template: 'tech-magazine', previews: [], layouts: [], errors: [], missingResources: [] };
let server;

async function images(frame) {
  return frame.locator('body').evaluate(async body => {
    const sources = [...new Set([...body.querySelectorAll('img')].map(image => image.src))];
    const checks = await Promise.all(sources.map(src => new Promise(done => {
      const image = new Image();
      const timer = setTimeout(() => done(false), 20000);
      image.onload = () => { clearTimeout(timer); done(image.naturalWidth > 0); };
      image.onerror = () => { clearTimeout(timer); done(false); };
      image.src = src;
    })));
    return { sources: sources.length, broken: checks.filter(value => !value).length };
  });
}

/** Wait for a new iframe document, so checks cannot accidentally inspect the previous page. */
async function refresh(page, action) {
  const handle = await page.locator('#preview-frame').elementHandle();
  const frame = await handle.contentFrame();
  const marker = 'package-' + Date.now();
  await frame.evaluate(value => { window.__packageProbe = value; }, marker);
  await action();
  await frame.waitForFunction(value => document.body && window.__packageProbe !== value, marker);
  await page.waitForFunction(() => !document.getElementById('preview-frame').hasAttribute('data-refreshing'));
}

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  page.on('pageerror', error => report.errors.push(error.message));
  await page.route(/https?:\/\/[^/]*(?:googletagservices|googlesyndication|doubleclick|googletagmanager|google-analytics)\.[^/]+\//i,
    route => route.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.goto(process.env.BUILDER_URL || 'http://127.0.0.1:5174/');
  await page.locator('#file-input').setInputFiles(resolve(process.env.TEMPLATE_PACKAGE_INPUT));
  await page.waitForFunction(() => /已解析|导入成功/.test(document.getElementById('upload-import-progress-text')?.textContent || ''), null, { timeout: 180000 });
  await page.locator('#btn-next').click();
  await page.locator('.theme-card[data-theme="tech"]').click();
  await page.locator('#btn-next').click();
  await page.locator('#step-3.active').waitFor();
  await page.locator('#btn-next').click();
  await page.locator('#step-4.active').waitFor();
  await page.locator('.config-tab[data-tab="style"]').click();
  await expandPicker(page,'template-grid');
  const template = page.locator('[data-template-id="tech-magazine"]');
  assert.equal(await page.locator('.template-card').count(), await page.evaluate(()=>DOMAIN_CATALOG.tech.blueprints.length));
  await template.scrollIntoViewIfNeeded();
  // Keyboard selection uses the existing product handler, not an internal test bridge.
  await refresh(page, async () => { await template.focus(); await template.press('Enter'); });
  await page.locator('.config-tab[data-tab="ads"]').click();
  await refresh(page, async () => {
    await page.locator('#ad-code-upload').setInputFiles(resolve(process.env.AD_CODE_INPUT));
    await page.waitForFunction(() => /成功|识别|已上传|有效/.test(document.getElementById('ad-code-status')?.textContent || ''));
  });
  for (const type of ['home', 'detail', 'all']) {
    await refresh(page, () => page.locator('.preview-tab[data-page="' + type + '"]').click());
    const frame = page.frameLocator('#preview-frame');
    await frame.locator('body[data-template-package="tech-magazine"]').waitFor();
    const stats = await images(frame);
    assert.equal(stats.broken, 0, type + ': preview images');
    assert.equal(await frame.locator('[id^="div-gpt-ad-banner"]').count(), 3);
    report.previews.push({ type, ...stats });
  }
  await page.locator('#btn-next').click();
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.locator('#btn-export').click()]);
  const archive = join(output, 'tech-magazine-real.zip');
  await download.saveAs(archive);
  await page.close();

  const zip = await JSZip.loadAsync(await readFile(archive));
  const paths = Object.keys(zip.files).filter(path => !zip.files[path].dir);
  const root = paths.find(path => /(?:^|\/)index\.html$/.test(path)).replace(/index\.html$/, '');
  const detail = paths.find(path => path.startsWith(root + 'details/') && /\.html$/.test(path)).slice(root.length);
  // Serve the actual downloaded ZIP; no generated preview HTML substitutes for this check.
  server = createServer(async (request, response) => {
    const path = root + (decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\//, '') || 'index.html');
    const file = zip.file(path);
    if (!file) { response.writeHead(404); response.end(); return; }
    const type = /\.html$/.test(path) ? 'text/html;charset=utf-8' : /\.css$/.test(path) ? 'text/css' : /\.js$/.test(path) ? 'application/javascript' : /\.webp$/.test(path) ? 'image/webp' : /\.svg$/.test(path) ? 'image/svg+xml' : /\.png$/.test(path) ? 'image/png' : /\.jpe?g$/.test(path) ? 'image/jpeg' : 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': type }); response.end(await file.async('nodebuffer'));
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const origin = 'http://127.0.0.1:' + server.address().port;
  for (const width of [1366, 768, 390, 320]) {
    for (const [type, path] of [['home', 'index.html'], ['detail', detail], ['all', 'all-articles.html']]) {
      const reopened = await browser.newPage({ viewport: { width, height: 900 } });
      reopened.on('pageerror', error => report.errors.push(error.message));
      reopened.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 400) report.missingResources.push(response.url()); });
      await reopened.route(/https?:\/\/(?!127\.0\.0\.1)/, route => route.fulfill({ body: '', contentType: 'application/javascript' }));
      await reopened.addInitScript(() => {
        window.__packageAdCalls = [];
        const slot = { addService() { return this; }, setConfig() {}, setTargeting() { return this; } };
        const service = { enableSingleRequest() {}, refresh() {}, addEventListener() {} };
        window.googletag = { cmd: { push(callback) { callback(); } }, setConfig() {}, pubads: () => service,
          defineSlot(path, size, id) { window.__packageAdCalls.push({ path, id }); return slot; },
          defineOutOfPageSlot() { return slot; }, enableServices() {}, display() {},
          enums: { OutOfPageFormat: { INTERSTITIAL: 'INT', BOTTOM_ANCHOR: 'ANC' } } };
      });
      await reopened.goto(origin + '/' + path, { waitUntil: 'load' });
      await reopened.waitForFunction(() => window.__packageAdCalls.length >= 3);
      const imageStats = await images(reopened);
      const stats = await reopened.evaluate(() => {
        const width = document.documentElement.clientWidth;
        const units = [...document.querySelectorAll('[id^="div-gpt-ad-banner"]')].map(node => {
          const box = node.getBoundingClientRect();
          return { id: node.id, centered: Math.abs(box.left + box.width / 2 - width / 2) < 3 };
        });
        const cards = [...document.querySelectorAll('#all-articles .item-card')];
        const middle = cards.length && document.getElementById('adv2')?.getBoundingClientRect();
        const listing = middle ? {
          before: cards.filter(card => card.getBoundingClientRect().bottom <= middle.top + 1).length,
          after: cards.filter(card => card.getBoundingClientRect().top >= middle.bottom - 1).length,
          overlaps: cards.some(card => { const box = card.getBoundingClientRect(); return box.top < middle.bottom - 1 && box.bottom > middle.top + 1; })
        } : null;
        const titleWidths = [...document.querySelectorAll('.item-card .card-title')].map(node => node.getBoundingClientRect().width);
        return { overflow: document.documentElement.scrollWidth - width, units, listing, minCardTitleWidth: titleWidths.length ? Math.min(...titleWidths) : null, adCalls: window.__packageAdCalls,
          package: document.body.dataset.templatePackage };
      });
      assert.equal(imageStats.broken, 0);
      assert.equal(stats.package, 'tech-magazine');
      assert.equal(stats.units.length, 3);
      assert.ok(stats.units.every(unit => unit.centered), JSON.stringify({ type, width, stats }));
      assert.ok(stats.overflow <= 1, JSON.stringify({ type, width, overflow: stats.overflow }));
      if (stats.minCardTitleWidth !== null) assert.ok(stats.minCardTitleWidth >= 150, JSON.stringify({ type, width, titleWidth: stats.minCardTitleWidth }));
      if (type === 'all') assert.ok(stats.listing && stats.listing.before > 0 && stats.listing.after > 0 && !stats.listing.overlaps, JSON.stringify(stats.listing));
      report.layouts.push({ type, width, ...stats, ...imageStats });
      // Include page content in screenshots instead of capturing only the header advertisement.
      await reopened.locator(type === 'detail' ? '.detail-title' : '.category-section').first().scrollIntoViewIfNeeded();
      await reopened.screenshot({ path: join(output, type + '-' + width + '.png') });
      if (width === 320) {
        // Stress only a test document; the downloaded ZIP remains untouched.
        await reopened.emulateMedia({ reducedMotion: 'reduce' });
        const stress = await reopened.evaluate(() => {
          const heading = document.querySelector('.detail-title,.card-title');
          if (heading) heading.textContent = 'A long technical explanation with several topics and details that must remain readable on a narrow screen';
          document.documentElement.style.fontSize = '200%';
          return document.documentElement.scrollWidth - document.documentElement.clientWidth;
        });
        assert.ok(stress <= 1, type + ': long title/enlarged text overflow');
      }
      await reopened.close();
    }
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.missingResources, []);
  console.log('Independent template: keyboard selection, 3 previews, real ZIP and 12 reopened layouts passed.');
} finally {
  await writeFile(join(output, 'results.json'), JSON.stringify(report, null, 2));
  await browser.close();
  if (server) await new Promise(done => server.close(done));
}
