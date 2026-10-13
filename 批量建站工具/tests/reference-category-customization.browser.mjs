/** Targeted renderer checks for independent category modes and column settings.
 * Uses generated preview HTML and static export files served over local HTTP. */
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
const output = resolve('coverage/category-layout-customization-20261012/renderer');
await mkdir(output, { recursive: true });
const builder = loadBuilder(false, true, true);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let files = {};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).slice(1) || 'index.html';
  const entry = files['website/' + path];
  if (typeof entry !== 'string') { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css',
    '.js': 'application/javascript' })[extname(path)] || 'text/plain');
  response.end(entry);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const report = { checks: [], failures: [] };

// Explicit expected auto-column choices cover the user's 3 -> 3 / 1+2 case,
// plus both odd/even counts and the UI's maximum of twenty articles.
const cases = [
  [1, 1, 1], [2, 2, 1], [3, 3, 2], [4, 2, 3], [5, 2, 2],
  [6, 3, 2], [7, 2, 3], [8, 2, 2], [20, 2, 2]
].map(([count, gridColumns, featuredColumns]) => ({ count, columns: 'auto', gridColumns, featuredColumns }));
cases.push(...[1, 2, 3, 4].map(columns => ({ count: 7, columns: String(columns),
  gridColumns: columns, featuredColumns: columns })));
cases.push({ count: 3, columns: 'auto', gridColumns: 3, featuredColumns: 2, reversed: true });

function expectedRows(count, columns, featured, width) {
  const effective = width <= 440 ? 1 : width <= 1000 ? Math.min(columns, 2) : columns;
  const rows = featured ? [1] : [];
  for (let remaining = count - (featured ? 1 : 0); remaining > 0; remaining -= effective) {
    rows.push(Math.min(remaining, effective));
  }
  return rows;
}

async function measure(page) {
  return page.evaluate(async () => {
    const images = [...document.querySelectorAll('.tpl-sections .card-image')];
    images.forEach(image => { image.loading = 'eager'; });
    await Promise.all(images.map(image => image.decode().catch(() => {})));
    const box = element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, width: rect.width, height: rect.height };
    };
    return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sections: [...document.querySelectorAll('.tpl-sections .items-grid')].map(grid => {
        const rows = [];
        for (const card of grid.querySelectorAll(':scope > .item-card')) {
          const rect = box(card), image = card.querySelector('.card-image');
          let row = rows.find(row => Math.abs(row.top - rect.top) < 2);
          if (!row) { row = { top: rect.top, cards: [] }; rows.push(row); }
          row.cards.push({ ...rect, title: card.querySelector('.card-title')?.textContent,
            image: image && box(image), loaded: Boolean(image?.naturalWidth), display: getComputedStyle(card).display });
        }
        return { mode: grid.dataset.categoryLayout, columns: grid.dataset.categoryColumns, grid: box(grid), rows };
      }) };
  });
}

try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.route('**/*', route => route.request().url().startsWith(origin)
    ? route.continue() : route.fulfill({ body: '', contentType: 'application/javascript' }));
  for (const id of ids) {
    for (const scenario of cases) {
      const { count, columns, reversed } = scenario;
      const modes = reversed ? ['featured', 'grid'] : ['grid', 'featured'];
      const state = createState(builder, { ...builder.presets.find(preset => preset.id === id), domainId: 'tech' }, 'manual');
      state.data = [...state.data, ...state.data].map((item, index) => ({ ...item, id: index + 1 }));
      state.config.categories = state.config.categories.slice(0, 2).map((category, index) =>
        ({ ...category, count, layout: modes[index], columns }));
      state.config.adPlacements.adv1.home = 'after-section-0';
      state.config.adPlacements.adv2.home = 'after-section-1';
      // The generator must copy settings, not mutate categories while rendering.
      const originalCategories = JSON.stringify(state.config.categories);
      await builder.generator.exportWebsite(state, () => {});
      files = builder.files();
      assert.equal(JSON.stringify(state.config.categories), originalCategories);
      const manifest = JSON.parse(files['website/SITE_RENDER_MANIFEST.json']);
      assert.deepEqual(manifest.categories.map(category => [category.layout, category.columns]), modes.map(mode => [mode, columns]));
      for (const width of count === 3 && !reversed ? [1366, 768, 390] : [1366]) {
        await page.setViewportSize({ width, height: 1000 });
        let preview;
        for (const path of ['preview', 'export']) {
          const tag = [id, count, columns, modes.join('-'), width, path].join('/');
          try {
            if (path === 'preview') await page.setContent(builder.generator.generatePreviewHtml(state, 'home'), { waitUntil: 'load' });
            else await page.goto(origin + '/index.html', { waitUntil: 'load' });
            const metrics = await measure(page);
            assert.ok(metrics.overflow <= 1, 'horizontal overflow');
            assert.equal(metrics.sections.length, 2);
            for (const [index, section] of metrics.sections.entries()) {
              const featured = modes[index] === 'featured';
              const expectedColumns = featured ? scenario.featuredColumns : scenario.gridColumns;
              assert.equal(section.mode, modes[index], 'independent category mode');
              assert.equal(section.columns, columns, 'independent column preference');
              assert.deepEqual(section.rows.map(row => row.cards.length), expectedRows(count, expectedColumns, featured, width), 'article rows');
              for (const row of section.rows) {
                assert.ok(Math.abs(row.cards[0].left - section.grid.left) < 2, 'row start');
                assert.ok(Math.abs(row.cards.at(-1).right - section.grid.right) < 2, 'unfilled last row');
                assert.ok(row.cards.every(card => Math.abs(card.width - row.cards[0].width) < 2), 'equal widths');
                assert.ok(row.cards.every(card => card.loaded && card.image.width > 20 && card.image.height > 20), 'visible covers');
              }
              if (featured && width > 720) assert.equal(section.rows[0].cards[0].display, 'grid', 'horizontal featured card');
            }
            const cards = metrics.sections.map(section => section.rows.flatMap(row => row.cards.map(card => card.title)));
            if (path === 'preview') preview = cards;
            else assert.deepEqual(cards, preview, 'preview and export article order');
            report.checks.push({ tag, metrics });
            if (id === 'evwired-studio' && count === 3 && reversed && width === 1366 && path === 'export') {
              await page.screenshot({ path: resolve(output, 'independent-three-article-layouts.png'), fullPage: true });
            }
          } catch (error) {
            report.failures.push({ tag, error: error.message });
            await page.screenshot({ path: resolve(output, tag.replaceAll('/', '-') + '-failure.png') });
          }
        }
      }
    }
    console.log('Checked manual modes and columns:', id);
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  await writeFile(resolve(output, 'results.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ checked: report.checks.length, failures: report.failures, output }, null, 2));
process.exitCode = report.failures.length ? 1 : 0;
