/** Focused home-category layout checks for the eight editorial packages.
 * Uses the real preview/export generator and browser geometry. This is not a
 * full regression: advertising slots stay outside rows under inspection. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { createState, loadBuilder } from './template-fixtures.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH ||
  'C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ids = ['field-notes', 'pixelwire-editorial', 'stone-crumb', 'evwired-studio',
  'daily-skillet', 'vitalpulse-journal', 'deep-life-atlas', 'print-field'];
const rowsByCount = { 1: [1], 2: [2], 3: [3], 4: [2, 2], 5: [1, 2, 2],
  6: [3, 3], 7: [1, 2, 2, 2] };
const defaultsOnly = process.argv.includes('--default-only');
const output = resolve(process.env.REFERENCE_CATEGORY_OUTPUT || 'coverage/reference-category-layout-20261012');
await mkdir(output, { recursive: true });
const builder = loadBuilder(false, true, true);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let exportedFiles = {};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).slice(1) || 'index.html';
  const entry = exportedFiles['website/' + path];
  if (typeof entry !== 'string') { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8',
    '.css': 'text/css', '.js': 'application/javascript' })[extname(path)] || 'text/plain');
  response.end(entry);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const report = { checks: [], failures: [] };

/** Inspect actual rendered card rows, including their right edge. A test that
 * only checks individual card widths misses the original empty-row defect. */
async function measure(page) {
  return page.evaluate(async () => {
    const images = [...document.querySelectorAll('.tpl-sections .card-image')];
    images.forEach(image => { image.loading = 'eager'; });
    await Promise.all(images.map(image => image.decode().catch(() => {})));
    const box = element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, width: rect.width, height: rect.height };
    };
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sections: [...document.querySelectorAll('.tpl-sections .category-section .items-grid')].map(grid => {
        const rows = [];
        for (const card of grid.querySelectorAll(':scope > .item-card')) {
          const rect = box(card), image = card.querySelector('.card-image');
          let row = rows.find(row => Math.abs(row.top - rect.top) < 2);
          if (!row) { row = { top: rect.top, cards: [] }; rows.push(row); }
          row.cards.push({ ...rect, image: image && box(image), loaded: Boolean(image?.naturalWidth) });
        }
        return { grid: box(grid), rows };
      })
    };
  });
}

function checkLayout(metrics, count, width) {
  assert.ok(metrics.overflow <= 1, 'horizontal overflow');
  assert.equal(metrics.sections.length, 2, 'both category sections must render');
  const expectedRows = width > 768 ? rowsByCount[count] : width > 440 ? [2] : [1, 1];
  for (const section of metrics.sections) {
    assert.deepEqual(section.rows.map(row => row.cards.length), expectedRows, 'incorrect article rows');
    for (const row of section.rows) {
      assert.ok(Math.abs(row.cards[0].left - section.grid.left) < 2, 'empty space at row start');
      assert.ok(Math.abs(row.cards.at(-1).right - section.grid.right) < 2, 'empty space at row end');
      assert.ok(row.cards.every(card => Math.abs(card.width - row.cards[0].width) < 2),
        'ordinary cards in a row must have equal column widths');
      for (const card of row.cards) {
        assert.ok(card.width > 20 && card.height > 20, 'collapsed card');
        assert.ok(card.loaded && card.image.width > 20 && card.image.height > 20, 'collapsed cover');
      }
    }
    if (count === 2) {
      const cards = section.rows.flatMap(row => row.cards);
      assert.ok(Math.abs(cards[0].image.height - cards[1].image.height) < 2,
        'the first ordinary card must not retain featured-image height');
    }
  }
}

try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  // All fixtures are local. Avoid unrelated analytics/ad requests during layout checks.
  await page.route('**/*', route => route.request().url().startsWith(origin)
    ? route.continue() : route.fulfill({ body: '', contentType: 'application/javascript' }));
  for (const id of ids) {
    for (const count of defaultsOnly ? [2] : [1, 2, 3, 4, 5, 6, 7]) {
      const preset = { ...builder.presets.find(preset => preset.id === id), domainId: 'tech' };
      const state = createState(builder, preset, 'manual');
      // Two equal categories exercise the first-category feature and the shared
      // count rules separately. Keep ads at their configured section boundaries.
      state.config.categories = state.config.categories.slice(0, 2).map(category => ({ ...category, count }));
      state.config.adPlacements.adv1.home = 'after-section-0';
      state.config.adPlacements.adv2.home = 'after-section-1';
      await builder.generator.exportWebsite(state, () => {});
      exportedFiles = builder.files();
      for (const width of !defaultsOnly && count === 2 ? [1366, 768, 390] : [1366]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const mode of ['preview', 'export']) {
          const tag = id + '/' + count + '/' + width + '/' + mode;
          try {
            if (mode === 'preview') await page.setContent(builder.generator.generatePreviewHtml(state, 'home'), { waitUntil: 'load' });
            else await page.goto(origin + '/index.html', { waitUntil: 'load' });
            const metrics = await measure(page);
            report.checks.push({ tag, ...metrics });
            checkLayout(metrics, count, width);
            if (count === 2 && width === 1366 && mode === 'export') {
              await page.screenshot({ path: resolve(output, id + '-two-columns.png') });
            }
          } catch (error) {
            report.failures.push({ tag, error: error.message });
            await page.screenshot({ path: resolve(output, tag.replaceAll('/', '-') + '-failure.png') });
          }
        }
      }
    }
    console.log('Checked', id);
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  await writeFile(resolve(output, 'results.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ checked: report.checks.length, failures: report.failures, output }, null, 2));
process.exitCode = report.failures.length ? 1 : 0;
