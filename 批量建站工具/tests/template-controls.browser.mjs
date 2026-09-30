// 真实操作工作台，确认新模板可选、图标开关随切换保留，且广告上传仍可导出。
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import JSZip from 'jszip';
import { loadBuilder, createState } from './template-fixtures.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.TEMPLATE_PREVIEW_URL || 'http://127.0.0.1:5173';
const output = resolve('coverage/template-layout-review');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const checks = [];
try {
  for (const game of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.log('Browser error (' + (game ? 'game' : 'main') + '): ' + error.stack); });
    // 不请求外部广告、字体或游戏。工作台本地脚本及真实导出逻辑照常运行。
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      // 保留工作台现有的文件下载依赖，让浏览器执行真实的 saveAs。
      if (url.origin === new URL(base).origin || url.hostname === 'cdnjs.cloudflare.com') return route.continue();
      return route.fulfill({ status: 200, body: '', contentType: 'text/javascript' });
    });
    await page.goto(base + (game ? '/game-builder/index.html' : '/index.html'));
    const builder = loadBuilder(game);
    const preset = game ? builder.presets[4] : builder.presets.find(item => item.domainId === 'tech' && item.variant === 13);
    const state = createState(builder, preset);
    if (!game) {
      await page.locator('#file-input').setInputFiles({ name: 'technology.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(state.data)) });
      await page.locator('#btn-next').click();
      await page.locator('.theme-card[data-theme="tech"]').click();
      await page.locator('#btn-next').click();
      await page.locator('#btn-next').click();
    }
    await page.locator('.config-tab[data-tab="style"]').click();
    const cards = page.locator(game ? '.layout-template-card' : '#template-grid .template-card');
    assert.equal(await cards.count(), 30, 'UI must show all 30 templates');
    await page.locator(game ? '[data-layout-id="' + preset.id + '"]' : '[data-template-id="' + preset.id + '"]').click();
    const frame = page.frameLocator('#preview-frame');
    await frame.locator('body[data-template-layout="' + (game ? preset.id : preset.structure.homeLayout) + '"]').waitFor();
    assert.ok(await frame.locator('.category-title-icon').count() > 0);
    await page.locator('label[for="category-icons-enabled"]').click();
    await page.waitForFunction(() => document.getElementById('category-icons-enabled').checked === false);
    await frame.locator('.category-title-icon').first().waitFor({ state: 'detached' });
    assert.equal(await frame.locator('.category-title-icon').count(), 0);
    const second = game ? builder.presets[6] : builder.presets.find(item => item.domainId === 'tech' && item.variant === 16);
    await page.locator(game ? '[data-layout-id="' + second.id + '"]' : '[data-template-id="' + second.id + '"]').click();
    await frame.locator('body[data-template-layout="' + (game ? second.id : second.structure.homeLayout) + '"]').waitFor();
    assert.equal(await page.locator('#category-icons-enabled').isChecked(), false);
    assert.equal(await frame.locator('.category-title-icon').count(), 0);
    await page.locator('#random-assemble-btn').click();
    assert.equal(await page.locator('#category-icons-enabled').isChecked(), false, 'random assembly must preserve visibility preference');
    assert.equal(await frame.locator('.category-title-icon').count(), 0);
    await page.locator('label[for="category-icons-enabled"]').click();
    await frame.locator('.category-title-icon').first().waitFor({ state: 'attached' });
    assert.ok(await frame.locator('.category-title-icon').count() > 0, 'chosen icons must be restorable');
    await page.locator(game ? '[data-layout-id="' + preset.id + '"]' : '[data-template-id="' + preset.id + '"]').click();
    await frame.locator('body[data-template-layout="' + (game ? preset.id : preset.structure.homeLayout) + '"]').waitFor();
    await page.screenshot({ path: resolve(output, game ? 'game-template-controls.png' : 'domain-template-controls.png') });

    await page.locator('.config-tab[data-tab="ads"]').click();
    const adSource = [1, 2, 3].map(n => `googletag.defineSlot('/123456/template.example.com-banner${n}', [300,250], 'div-gpt-ad-banner${n}');`).join('\n');
    await page.locator('#ad-code-upload').setInputFiles({ name: 'template.example.com.txt', mimeType: 'text/plain', buffer: Buffer.from(adSource) });
    await frame.locator('#div-gpt-ad-banner1').waitFor();
    const ids = await frame.locator('[id^="div-gpt-ad-banner"]').count();
    assert.equal(ids, 3, 'uploaded code must populate all fixed homepage slots');
    await page.locator('#btn-next').click();
    const exportButton = page.locator('#btn-export');
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), exportButton.click()]);
    assert.equal(download.suggestedFilename(), 'template.example.com.zip');
    const zip = await JSZip.loadAsync(readFileSync(await download.path()));
    const runtime = await zip.file('template.example.com/js/ad.js').async('string');
    for (const n of [1, 2, 3]) assert.ok(runtime.includes('/123456/template.example.com-banner' + n));
    const home = await zip.file('template.example.com/index.html').async('string');
    assert.ok(home.includes('data-template-layout="portal-'));
    assert.equal((home.match(/id="div-gpt-ad-banner[123]"/g) || []).length, 3);
    assert.deepEqual(errors, []);
    checks.push({ workflow: game ? 'game-builder' : 'normal', templates: 30, iconToggle: 'passed', randomPreservesIcons: 'passed', uploadedAds: 'passed', zipNameAndFolder: 'passed', errors });
    await page.close();
  }
} finally { await browser.close(); }
writeFileSync(resolve(output, 'controls.json'), JSON.stringify(checks, null, 2));
console.log(JSON.stringify(checks, null, 2));
