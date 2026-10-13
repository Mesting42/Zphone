/** Exercises the differentiated game-site upload, controls, gates, and ZIP exports. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import JSZip from 'jszip';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.GAME_BUILDER_URL || 'http://127.0.0.1:5173/game-builder/';
const outputDir = resolve('coverage/differentiated-flow');
await mkdir(outputDir, { recursive: true });

const fixtureZip = new JSZip();
fixtureZip.file('manifest.json', JSON.stringify({
  schema_version: 1,
  site_type: 'games',
  site: {
    name: 'Fixture Arcade',
    vertical: 'Local puzzle games',
    audience: 'Players testing browser-based puzzles',
    scope: 'A small local package used to verify differentiated game-site import, preview, audit, and export.',
    base_url: 'https://arcade-fixture.test',
    sections: ['Arcade']
  }
}));
fixtureZip.file('design.json', JSON.stringify({ family: 'auto', seed: 'differentiated-flow-smoke' }));
fixtureZip.file('legal.json', JSON.stringify({ contact_email: 'qa@arcade-fixture.test' }));
fixtureZip.file('provenance/content-provenance.json', JSON.stringify({ source: 'Synthetic test fixture; no external content.' }));
fixtureZip.file('provenance/design-references.json', JSON.stringify({ references: [] }));
fixtureZip.file('content/games.json', JSON.stringify([{
  title: 'Fixture Arcade Puzzle',
  slug: 'fixture-arcade-puzzle',
  category: 'Arcade',
  description: 'A small test game with a local entry point and a clear interaction.',
  controls: 'Click the button to increase the score.',
  cover: 'assets/covers/fixture.svg',
  local_entry: 'games/fixture.html',
  provider: 'Local test fixture',
  source_url: 'https://fixture.invalid/source-record',
  license: 'Test-only fixture content'
}]));
fixtureZip.file('assets/covers/fixture.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#243d35"/><circle cx="320" cy="200" r="95" fill="#f2b34b"/><text x="320" y="210" fill="#18211e" text-anchor="middle" font-size="36">TEST</text></svg>');
fixtureZip.file('games/fixture.html', '<!doctype html><meta charset="utf-8"><title>Fixture game</title><button id="score">Score: 0</button><script>let n=0;document.getElementById("score").onclick=()=>document.getElementById("score").textContent="Score: "+(++n);</script>');
const fixturePath = join(outputDir, 'differentiated-game-fixture.zip');
await writeFile(fixturePath, await fixtureZip.generateAsync({ type: 'nodebuffer' }));

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = {
  fixture: fixturePath,
  import: null,
  blueprints: [],
  stylePresets: [],
  selectors: [],
  logoIcons: 0,
  logoPointerBlocked: [],
  previewTabs: [],
  sizeModes: [],
  exports: [],
  pageErrors: []
};

async function chooseEveryVisibleSelectOption(page, item) {
  const control = page.locator(`#${item.id}`);
  const trigger = control.locator('xpath=..').locator('.custom-select-trigger');
  const menuId = await trigger.getAttribute('aria-controls');
  assert.ok(menuId, `${item.id} should expose its custom-select menu`);
  for (const value of item.values) {
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await page.waitForFunction((id) => {
      const menu = document.getElementById(id);
      return menu && !menu.hidden;
    }, menuId);
    const option = page.locator(`#${menuId} [data-value=${JSON.stringify(value)}]`);
    assert.equal(await option.isVisible(), true, `${item.id} option ${value} should be visible after opening its menu`);
    await option.evaluate((element) => element.click());
    assert.equal(await control.evaluate((element) => element.value), value, `${item.id} should accept ${value}`);
    results.selectors.push({ id: item.id, value });
  }
}

try {
  const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1500, height: 1000 } });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (error) => results.pageErrors.push(error.message));
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin || url.hostname === 'cdnjs.cloudflare.com') return route.continue();
    return route.fulfill({ status: 200, body: '', contentType: 'text/javascript' });
  });

  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-build-mode="differentiated"]').click();
  await page.locator('#differentiated-setup').waitFor({ state: 'visible' });
  await page.locator('#game-json-upload').waitFor({ state: 'attached' });

  const setupSelects = await page.locator('#differentiated-setup select').evaluateAll((elements) => elements.map((element) => ({
    id: element.id,
    values: [...element.options].filter((option) => option.value && !option.disabled && !(option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled)).map((option) => option.value)
  })));
  for (const item of setupSelects) await chooseEveryVisibleSelectOption(page, item);

  await page.locator('#game-json-upload').setInputFiles(fixturePath);
  await page.waitForFunction(() => {
    const status = document.getElementById('source-status');
    const packageStatus = document.getElementById('differentiated-package-result');
    return status?.classList.contains('is-success') && packageStatus?.textContent.includes('已读取');
  }, null, { timeout: 60000 });
  const importedStatus = await page.locator('#source-status').textContent();
  assert.match(importedStatus, /已加载\s*1\s*个游戏/);
  results.import = { status: importedStatus, package: await page.locator('#differentiated-package-result').textContent() };

  const previewFrame = page.locator('#preview-frame');
  const previewBody = page.frameLocator('#preview-frame').locator('body');
  await previewBody.waitFor({ state: 'visible', timeout: 30000 });
  assert.ok((await previewBody.textContent()).length > 50, 'the generated game preview should contain rendered content');

  await page.locator('[aria-controls="diff-domain-blueprint-grid-panel"]').click();
  const blueprintCards = page.locator('#diff-domain-blueprint-grid [data-diff-blueprint]');
  const blueprintIds = await blueprintCards.evaluateAll((cards) => cards.map((card) => card.dataset.diffBlueprint));
  assert.equal(blueprintIds.length, 12, 'game domain must expose all 12 differentiated blueprints');
  for (const id of blueprintIds) {
    await page.locator(`#diff-domain-blueprint-grid [data-diff-blueprint="${id}"]`).click();
    await page.locator(`#diff-domain-blueprint-grid [data-diff-blueprint="${id}"].is-selected`).waitFor();
    results.blueprints.push(id);
  }

  await page.locator('#differentiated-customizer').waitFor({ state: 'visible' });
  await page.locator('.diff-config-tab[data-diff-tab="style"]').click();
  await page.locator('[aria-controls="diff-style-preset-grid-panel"]').click();

  const styleCards = page.locator('#diff-style-preset-grid [data-diff-style]');
  const styleIds = await styleCards.evaluateAll((cards) => cards.map((card) => card.dataset.diffStyle));
  for (const id of styleIds) {
    await page.locator(`#diff-style-preset-grid [data-diff-style="${id}"]`).click();
    await page.locator(`#diff-style-preset-grid [data-diff-style="${id}"].selected`).waitFor();
    results.stylePresets.push(id);
  }

  const tabs = page.locator('.diff-config-tab');
  const tabCount = await tabs.count();
  for (let tabIndex = 0; tabIndex < tabCount; tabIndex++) {
    const tab = tabs.nth(tabIndex);
    await tab.click();
    const section = await tab.getAttribute('data-diff-tab');
    const selects = await page.locator(`#differentiated-customizer [data-diff-section="${section}"] select`).evaluateAll((elements) => elements.map((element) => ({
      id: element.id,
      values: [...element.options].filter((option) => option.value && !option.disabled && !(option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled)).map((option) => option.value)
    })));
    for (const item of selects) await chooseEveryVisibleSelectOption(page, item);
  }
  await page.locator('.diff-config-tab[data-diff-tab="identity"]').click();

  const iconTrigger = page.locator('#diff-logo-icon-trigger');
  await iconTrigger.scrollIntoViewIfNeeded();
  await iconTrigger.click();
  const iconOptions = page.locator('#diff-logo-icon-grid [data-diff-logo-icon]');
  const iconValues = await iconOptions.evaluateAll((buttons) => buttons.map((button) => button.dataset.diffLogoIcon));
  for (const icon of iconValues) {
    if (await page.locator('#diff-logo-icon-panel').getAttribute('hidden') !== null) await iconTrigger.click();
    const option = page.locator(`#diff-logo-icon-grid [data-diff-logo-icon=${JSON.stringify(icon)}]`);
    assert.equal(await option.isVisible(), true, `Logo icon ${icon} should be rendered in its open picker`);
    const pointerTarget = await option.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return { isTarget: hit === element || element.contains(hit), interceptedBy: hit?.outerHTML.slice(0, 180) || '' };
    });
    if (!pointerTarget.isTarget) results.logoPointerBlocked.push({ icon, ...pointerTarget });
    await option.evaluate((element) => element.click());
    results.logoIcons++;
  }

  const contactCheckboxes = await page.locator('#diff-contact-fields-config input[type="checkbox"]').count();
  for (let index = 0; index < contactCheckboxes; index++) {
    const checkbox = page.locator('#diff-contact-fields-config input[type="checkbox"]').nth(index);
    await checkbox.uncheck();
    await checkbox.check();
  }
  const footerCheckboxes = await page.locator('#diff-footer-links-config input[type="checkbox"]').count();
  for (let index = 0; index < footerCheckboxes; index++) {
    const checkbox = page.locator('#diff-footer-links-config input[type="checkbox"]').nth(index);
    await checkbox.uncheck();
    await checkbox.check();
  }

  for (const tab of await page.locator('.preview-tab').evaluateAll((elements) => elements.map((element) => element.dataset.page))) {
    await page.locator(`.preview-tab[data-page="${tab}"]`).click();
    const body = page.frameLocator('#preview-frame').locator('body');
    await body.waitFor({ state: 'visible', timeout: 10000 });
    assert.ok((await body.textContent()).trim().length > 0, `preview tab ${tab} should render page content`);
    results.previewTabs.push(tab);
  }
  for (const size of await page.locator('.size-btn').evaluateAll((elements) => elements.map((element) => element.dataset.size))) {
    await page.locator(`.size-btn[data-size="${size}"]`).click();
    assert.ok(await page.locator(`.size-btn[data-size="${size}"].active`).count());
    results.sizeModes.push(size);
  }

  await page.locator('#btn-next').click();
  await page.locator('#differentiated-export-options').first().waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.getElementById('export-summary')?.textContent.includes('质量门禁'), null, { timeout: 30000 });

  async function exportVariant(variant) {
    const button = page.locator('#differentiated-export-options').first().locator(`[data-diff-export="${variant}"]`);
    const disabled = await button.isDisabled();
    if (disabled) return { variant, disabled: true, progress: await page.locator('#progress-text').textContent().catch(() => '') };
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
    await button.click();
    await page.waitForFunction(() => {
      const progress = document.getElementById('progress-text')?.textContent || '';
      return progress.includes('导出失败') || progress.includes('导出成功');
    }, null, { timeout: 60000 });
    const progress = (await page.locator('#progress-text').textContent()) || '';
    const download = progress.includes('导出成功') ? await downloadPromise : null;
    if (!download) {
      const notice = await page.locator('#notice-message').textContent().catch(() => '');
      if (await page.locator('#notice-overlay').isVisible()) {
        await page.keyboard.press('Escape');
        await page.locator('#notice-overlay').waitFor({ state: 'hidden' });
      }
      return { variant, disabled: false, downloaded: false, progress, notice };
    }
    const outputPath = await download.path();
    const zip = await JSZip.loadAsync(await readFile(outputPath));
    const fileNames = Object.keys(zip.files).filter((path) => !zip.files[path].dir);
    const auditName = fileNames.find((path) => /site-audit-report\.json$/i.test(path));
    return { variant, downloaded: true, suggestedFilename: download.suggestedFilename(), fileCount: fileNames.length,
      hasHomepage: fileNames.some((path) => /(?:^|\/)index\.html$/i.test(path)),
      hasAuditReport: !!auditName, auditName };
  }

  for (const variant of ['draft', 'review', 'ad-ready']) {
    const result = await exportVariant(variant);
    results.exports.push(result);
  }

  await page.close();
} finally {
  await browser.close();
}

await writeFile(join(outputDir, 'results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify({
  import: results.import,
  blueprintCount: results.blueprints.length,
  stylePresetCount: results.stylePresets.length,
  selectedOptionCount: results.selectors.length,
  logoIconCount: results.logoIcons,
  logoPointerBlockedCount: results.logoPointerBlocked.length,
  previewTabs: results.previewTabs,
  sizeModes: results.sizeModes,
  exports: results.exports,
  pageErrors: results.pageErrors,
  report: join(outputDir, 'results.json')
}, null, 2));
assert.equal(results.exports.find((item) => item.variant === 'draft')?.downloaded, true, 'draft export should produce a ZIP');
assert.equal(results.exports.find((item) => item.variant === 'review')?.downloaded, true, 'complete fixture should pass review export gates');
assert.equal(results.exports.find((item) => item.variant === 'ad-ready')?.disabled, true, 'ad-ready export should remain disabled without validated ad code');
assert.deepEqual(results.pageErrors, []);
