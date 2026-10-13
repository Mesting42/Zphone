/** Live workbench checks: real controls, template changes, random assembly,
 * keyboard selection, responsive controls and an actual downloaded ZIP. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import JSZip from 'jszip';
import { createState, loadBuilder } from './template-fixtures.mjs';
import { expandPicker, interceptAdsOnly, waitPreviewChange } from './workbench-browser-helpers.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH ||
  'C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = resolve(process.env.REFERENCE_CATEGORY_UI_OUTPUT || 'coverage/category-layout-customization-20261012/controls');
await mkdir(output, { recursive: true });
const ids = ['field-notes', 'pixelwire-editorial', 'stone-crumb', 'evwired-studio',
  'daily-skillet', 'vitalpulse-journal', 'deep-life-atlas', 'print-field'];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { checks: [], errors: [] };
const builder = loadBuilder(false, true, true);
const fixture = createState(builder, { ...builder.presets.find(preset => preset.id === 'evwired-studio'), domainId: 'tech' });

async function choose(page, selector, value, keyboard = false) {
  const control = page.locator(selector), id = await control.getAttribute('id');
  const trigger = control.locator('..').locator('.select-trigger');
  await waitPreviewChange(page, async () => {
    if (keyboard) { await trigger.focus(); await trigger.press('Enter'); }
    else await trigger.click();
    const option = page.locator('#styled-select-menu-' + id + ' [data-value="' + value + '"]');
    if (keyboard) { await option.focus(); await option.press('Enter'); }
    else await option.click();
  });
  assert.equal(await control.inputValue(), value);
}

async function chooseTemplate(page, id) {
  await page.locator('.config-tab[data-tab="style"]').click();
  await expandPicker(page, 'template-grid');
  await waitPreviewChange(page, () => page.locator('[data-template-id="' + id + '"]').click());
  await page.locator('.config-tab[data-tab="structure"]').click();
}

async function rows(page, index) {
  const frame = page.frameLocator('#preview-frame');
  return frame.locator('.tpl-sections .items-grid').nth(index).evaluate(grid => {
    const tops = [], counts = [];
    for (const card of grid.querySelectorAll(':scope > .item-card')) {
      const top = card.getBoundingClientRect().top;
      let row = tops.findIndex(value => Math.abs(value - top) < 2);
      if (row < 0) { row = tops.length; tops.push(top); counts.push(0); }
      counts[row]++;
    }
    return { mode: grid.dataset.categoryLayout, columns: grid.dataset.categoryColumns, counts };
  });
}

try {
  // The preview iframe has its own responsive viewport; leave room for its
  // desktop breakpoint in addition to the workbench configuration sidebar.
  const page = await browser.newPage({ viewport: { width: 2200, height: 1100 }, reducedMotion: 'reduce', acceptDownloads: true });
  page.on('pageerror', error => report.errors.push(error.message));
  await interceptAdsOnly(page);
  await page.goto(process.env.BUILDER_URL || 'http://127.0.0.1:5174/');
  await page.locator('#upload-area[data-upload-ready="true"]').waitFor();
  await page.locator('#file-input').setInputFiles({ name: 'category-layout-fixture.json',
    mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture.data)) });
  await page.waitForFunction(() => Number(document.getElementById('data-count')?.textContent) === 20);
  await page.locator('#btn-next').click();
  await page.locator('.theme-card[data-theme="tech"]').click();
  await page.locator('#btn-next').click();
  await page.locator('#step-3.active').waitFor();
  await page.locator('#btn-next').click();
  await page.locator('#step-4.active').waitFor();
  await chooseTemplate(page, 'evwired-studio');
  // Numbering is opt-in and must survive the same template/random transitions
  // as the independent category layout choices below.
  assert.equal(await page.locator('#category-numbers-enabled').isChecked(), false);
  assert.equal(await page.frameLocator('#preview-frame').locator('.ref-section-index').count(), 0);
  await page.locator('.config-tab[data-tab="style"]').click();
  await waitPreviewChange(page, () => page.locator('label[for="category-numbers-enabled"]').click());
  assert.equal(await page.frameLocator('#preview-frame').locator('.ref-section-index').first().textContent(), '01');
  await page.locator('.config-tab[data-tab="structure"]').click();
  assert.equal(await page.locator('#category-layout-0').inputValue(), 'auto');
  assert.equal(await page.locator('#category-layout-0-columns').isDisabled(), true);
  assert.equal(await page.locator('.category-layout-columns').first().isVisible(), false);
  assert.deepEqual((await rows(page, 0)).counts, [2]);
  report.checks.push('existing default: two ordinary cards');

  await waitPreviewChange(page, () => page.locator('[data-cat-idx="0"][data-cat-field="count"]').fill('3'));
  await choose(page, '#category-layout-0', 'featured', true);
  await waitPreviewChange(page, () => page.locator('[data-cat-idx="1"][data-cat-field="count"]').fill('3'));
  await choose(page, '#category-layout-1', 'grid');
  await choose(page, '#category-layout-1-columns', '3');
  assert.deepEqual(await rows(page, 0), { mode: 'featured', columns: 'auto', counts: [1, 2] });
  assert.deepEqual(await rows(page, 1), { mode: 'grid', columns: '3', counts: [3] });
  report.checks.push('independent modes, keyboard selection, three articles');

  await choose(page, '#category-layout-0-columns', '4');
  await waitPreviewChange(page, () => page.locator('[data-cat-idx="0"][data-cat-field="count"]').fill('5'));
  assert.deepEqual((await rows(page, 0)).counts, [1, 4]);
  await choose(page, '#category-layout-0', 'auto');
  assert.equal(await page.locator('#category-layout-0-columns').inputValue(), '4');
  assert.equal(await page.locator('#category-layout-0-columns').isDisabled(), true);
  await choose(page, '#category-layout-0', 'featured');
  assert.equal(await page.locator('#category-layout-0-columns').inputValue(), '4');
  await waitPreviewChange(page, () => page.locator('[data-cat-idx="0"][data-cat-field="count"]').fill('3'));
  await choose(page, '#category-layout-0-columns', 'auto');
  report.checks.push('article count changes and auto mode preserve column choice');

  for (const id of ids) {
    await chooseTemplate(page, id);
    assert.equal(await page.locator('#category-numbers-enabled').isChecked(), true);
    assert.equal(await page.frameLocator('#preview-frame').locator('.ref-section-index').first().textContent(), '01');
    assert.equal(await page.locator('#category-layout-0').inputValue(), 'featured');
    assert.equal(await page.locator('#category-layout-1').inputValue(), 'grid');
    assert.equal(await page.locator('#category-layout-1-columns').inputValue(), '3');
    assert.deepEqual((await rows(page, 0)).counts, [1, 2]);
    assert.deepEqual((await rows(page, 1)).counts, [3]);
  }
  report.checks.push('eight template switches preserve settings');
  const legacy = await page.locator('[data-template-id]').evaluateAll((cards, ids) =>
    cards.find(card => !ids.includes(card.dataset.templateId)).dataset.templateId, ids);
  await chooseTemplate(page, legacy);
  assert.equal(await page.locator('select[data-category-layout-field]').count(), 0);
  await page.locator('#random-assemble-btn').click();
  await chooseTemplate(page, 'evwired-studio');
  assert.equal(await page.locator('#category-layout-0').inputValue(), 'featured');
  assert.equal(await page.locator('#category-numbers-enabled').isChecked(), true);
  assert.equal(await page.locator('#category-layout-1-columns').inputValue(), '3');
  report.checks.push('legacy switch and random assembly preserve category choices');

  for (const width of [1600, 768, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.locator('#category-layout-0').locator('..').locator('.select-trigger').scrollIntoViewIfNeeded();
    const overflow = await page.locator('.category-layout-settings').evaluateAll(settings => settings.map(element => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, overflow: element.scrollWidth - element.clientWidth,
        outOfViewport: rect.left < -1 || rect.right > innerWidth + 1 };
    }));
    assert.ok(overflow.every(item => item.width > 100 && item.overflow <= 1 && !item.outOfViewport), 'responsive controls');
    await page.screenshot({ path: resolve(output, 'category-settings-' + width + '.png') });
  }
  report.checks.push('workbench controls at 1600/768/390px');

  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.locator('#btn-next').click();
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.locator('#btn-export').click()]);
  const zipPath = resolve(output, 'category-layout-ui-export.zip');
  await download.saveAs(zipPath);
  const zip = await JSZip.loadAsync(await readFile(zipPath));
  const manifestPath = Object.keys(zip.files).find(path => path.endsWith('/SITE_RENDER_MANIFEST.json'));
  const manifest = JSON.parse(await zip.file(manifestPath).async('string'));
  assert.deepEqual(manifest.categories.slice(0, 2).map(category => [category.count, category.layout, category.columns]),
    [[3, 'featured', 'auto'], [3, 'grid', '3']]);
  const homePath = manifestPath.replace('SITE_RENDER_MANIFEST.json', 'index.html');
  const home = await zip.file(homePath).async('string');
  assert.match(home, /class="ref-section-index"[^>]*>01<\/span>/);
  assert.match(home, /data-category-layout="featured" data-category-columns="auto"/);
  assert.match(home, /data-category-layout="grid" data-category-columns="3"/);
  report.checks.push('actual downloaded ZIP retains both independent settings');
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.stack;
  for (const [index, page] of browser.contexts().flatMap(context => context.pages()).entries()) {
    await page.screenshot({ path: resolve(output, 'failure-' + index + '.png') }).catch(() => {});
  }
  throw error;
} finally {
  await browser.close();
  await writeFile(resolve(output, 'results.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
