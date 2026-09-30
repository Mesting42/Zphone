/** Exercises the browser upload, validation, and export flow for legacy ad migration. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import JSZip from 'jszip';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.GAME_BUILDER_URL || 'http://127.0.0.1:5173/game-builder/';
const outputDir = resolve('coverage/ad-migration-flow');
await mkdir(outputDir, { recursive: true });

const archive = new JSZip();
archive.file('old-site/js/ad.js', [
  'const bannerPath1 = "/100/site.example.com-banner1";',
  'const bannerPath2 = "/100/site.example.com-banner2";',
  'const bannerPath3 = "/100/site.example.com-banner3";',
  'const bannerPath4 = "/100/site.example.com-banner4";',
  'const interstitialPath = "/100/site.example.com-interstitial";',
  'const anchorPath = "/100/site.example.com-anchor";',
  'const analyticsID = "G-NEWS123";'
].join('\n'));
const requiredSlots = [1, 2, 3].map((n) => `<div id="div-gpt-ad-banner${n}"></div>`).join('\n');
archive.file('old-site/index.html', `<!doctype html><html><body>${requiredSlots}</body></html>`);
archive.file('old-site/details/article1.html', `<!doctype html><html><body>${requiredSlots}</body></html>`);
const archivePath = join(outputDir, 'legacy-ad-migration-fixture.zip');
await writeFile(archivePath, await archive.generateAsync({ type: 'nodebuffer' }));

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = { archive: archivePath, validation: null, export: null, pageErrors: [] };
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
  await page.locator('[data-build-mode="ad-migration"]').click();
  await page.locator('#legacy-site-file').setInputFiles(archivePath);
  await page.waitForFunction(() => document.getElementById('legacy-site-result')?.classList.contains('valid'));
  const validation = await page.locator('#legacy-site-result').innerText();
  assert.match(validation, /广告移植校验通过/);
  results.validation = validation;

  await page.locator('#btn-next').click();
  await page.locator('#step-2.active').waitFor({ state: 'visible' });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.locator('#btn-export').click()
  ]);
  const zip = await JSZip.loadAsync(await readFile(await download.path()));
  const files = Object.keys(zip.files).filter((path) => !zip.files[path].dir);
  const migratedAdJs = zip.file('site.example.com/js/ad.js');
  assert.ok(migratedAdJs, 'migration export should preserve the detected host folder');
  const adJs = await migratedAdJs.async('string');
  for (const n of [1, 2, 3]) assert.ok(adJs.includes(`/100/site.example.com-banner${n}`));
  assert.ok(files.includes('site.example.com/index.html'));
  assert.ok(files.includes('site.example.com/details/article1.html'));
  results.export = { suggestedFilename: download.suggestedFilename(), fileCount: files.length,
    hasHome: files.includes('site.example.com/index.html'), hasDetail: files.includes('site.example.com/details/article1.html'),
    preservedBannerPaths: [1, 2, 3].every((n) => adJs.includes(`/100/site.example.com-banner${n}`)) };
  assert.deepEqual(results.pageErrors, []);
  await page.close();
} finally {
  await browser.close();
}

await writeFile(join(outputDir, 'results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify({ validation: results.validation, export: results.export, pageErrors: results.pageErrors,
  report: join(outputDir, 'results.json') }, null, 2));
