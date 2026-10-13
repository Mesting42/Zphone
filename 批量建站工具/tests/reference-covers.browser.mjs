/** Focused cover check for the eight imported-image editorial templates.
 * This intentionally checks only home, All Articles, and article detail media. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { extname } from 'node:path';
import { createState, loadBuilder } from './template-fixtures.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH ||
  'C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ids = ['field-notes', 'pixelwire-editorial', 'stone-crumb', 'evwired-studio',
  'daily-skillet', 'vitalpulse-journal', 'deep-life-atlas', 'print-field'];
const builder = loadBuilder(false, true, true);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let exportedFiles = {};
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).slice(1);
  const entry = exportedFiles['website/' + (path || 'index.html')];
  if (entry === undefined) { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css',
    '.js': 'application/javascript', '.svg': 'image/svg+xml' })[extname(path)] || 'application/octet-stream');
  response.end(typeof entry === 'string' ? entry : Buffer.from(await entry.arrayBuffer()));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;

async function inspectCovers(page, tag, detail, localImport) {
  const result = await page.evaluate(async detailPage => {
    const covers = [...document.querySelectorAll(detailPage ? '.detail-hero-image' : '.item-card .card-image')];
    for (const image of covers) image.loading = 'eager';
    await Promise.all(covers.map(image => image.decode().catch(() => {})));
    return covers.map(image => {
      const rect = image.getBoundingClientRect();
      const frame = image.closest('.card-image-frame');
      const frameRect = frame?.getBoundingClientRect();
      const style = getComputedStyle(image);
      return { src: image.getAttribute('src'), naturalWidth: image.naturalWidth,
        width: rect.width, height: rect.height, frameHeight: frameRect?.height,
        position: style.position, display: style.display, visibility: style.visibility,
        opacity: Number(style.opacity) };
    });
  }, detail);
  assert.ok(result.length > 0, tag + ': missing cover elements');
  for (const [index, cover] of result.entries()) {
    const label = tag + ' cover ' + (index + 1);
    assert.ok(cover.src && cover.naturalWidth > 0, label + ': image did not load');
    if (localImport) assert.match(cover.src, /(?:^|\/)images\/imported-\d+\.svg$/, label + ': not the imported image');
    assert.ok(cover.width > 20 && cover.height > 20, label + ': image has no visible size');
    if (!detail) {
      assert.ok(cover.frameHeight > 20, label + ': image frame collapsed');
      assert.notEqual(cover.position, 'absolute', label + ': image is out of flow');
    }
    assert.notEqual(cover.display, 'none', label + ': image is hidden');
    assert.notEqual(cover.visibility, 'hidden', label + ': image is hidden');
    assert.ok(cover.opacity > 0, label + ': image is transparent');
  }
  return result.length;
}

try {
  for (const id of ids) {
    const preset = { ...builder.presets.find(item => item.id === id), domainId: 'tech' };
    assert.ok(preset.id, 'Unknown template: ' + id);
    const state = createState(builder, preset, 'manual');
    // Export real local image blobs while keeping data URIs for the preview
    // path, whose blob URLs belong to the builder VM rather than this browser.
    const localImages = Object.fromEntries(state.data.map((item, index) => [
      'assets/imported-' + (index + 1) + '.svg',
      new Blob([Buffer.from(item.image.split(',')[1], 'base64')], { type: 'image/svg+xml' })
    ]));
    const exportState = { ...state, isLocalImages: true, localImages,
      data: state.data.map((item, index) => ({ ...item, image: 'assets/imported-' + (index + 1) + '.svg' })) };
    await builder.generator.exportWebsite(exportState, () => {});
    exportedFiles = builder.files();
    const detail = Object.keys(exportedFiles).find(path => /^website\/details\/article\d+\.html$/.test(path));
    assert.ok(detail, id + ': missing exported detail page');
    const routes = [['home', 'index.html'], ['all', 'all-articles.html'],
      ['detail', detail.slice('website/'.length)]];
    for (const width of [1366, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      try {
        for (const [type, route] of routes) {
          await page.goto(origin + '/' + route, { waitUntil: 'load' });
          const count = await inspectCovers(page, id + '/' + type + '/' + width + '/export', type === 'detail', true);
          if (process.env.REFERENCE_COVER_SCREENSHOT && id === 'daily-skillet' &&
              type === 'home' && width === 1366) {
            await mkdir(process.env.REFERENCE_COVER_SCREENSHOT, { recursive: true });
            await page.screenshot({ path: process.env.REFERENCE_COVER_SCREENSHOT + '/daily-skillet-home.png' });
          }
          console.log('PASS', id, type, width, 'export', count + ' covers');
        }
        // Preview uses the same generator but a distinct page-rendering path.
        if (width === 1366) {
          for (const [type] of routes) {
            await page.setContent(builder.generator.generatePreviewHtml(state, type, 0), { waitUntil: 'load' });
            const count = await inspectCovers(page, id + '/' + type + '/preview', type === 'detail', false);
            console.log('PASS', id, type, 'preview', count + ' covers');
          }
        }
      } finally { await page.close(); }
    }
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
