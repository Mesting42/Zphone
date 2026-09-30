/**
 * Imports every JSON and archive supplied in the local game source folders
 * through the real game-builder UI and records the resulting counts.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const dataRoot = process.env.GAME_SOURCE_ROOT || 'D:/Min/数据源/游戏';
const appUrl = process.env.GAME_BUILDER_URL || 'http://127.0.0.1:5173/game-builder/';
const outputDir = resolve('coverage/game-source-imports');
await mkdir(outputDir, { recursive: true });

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return paths.flat();
}

const candidates = [];
for (const category of ['游戏', '资讯']) {
  const categoryPath = join(dataRoot, category);
  const rootEntries = await readdir(categoryPath, { withFileTypes: true });
  const sources = rootEntries
    .filter((entry) => entry.isDirectory());
  for (const entry of rootEntries) {
    if (entry.isFile() && /\.(?:json|zip|rar|7z)$/i.test(entry.name)) {
      candidates.push({ category, source: '目录根', path: join(categoryPath, entry.name) });
    }
  }
  for (const source of sources) {
    const sourcePath = join(categoryPath, source.name);
    for (const path of await walk(sourcePath)) {
      if (/\.(?:json|zip|rar|7z)$/i.test(path)) {
        candidates.push({ category, source: source.name, path });
      }
    }
  }
}
assert.ok(candidates.length, `No JSON or archive data found under ${dataRoot}`);

// User-provided data currently has no 7z package. Try the bundled archive
// runtime's writer to create a tiny valid 7z fixture for the real import path.
let synthetic7z = { created: false, error: '' };

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
try {
  try {
    const imagePath = (await walk(join(dataRoot, '游戏', '游戏源1')))
      .find((path) => /\.(?:png|jpe?g)$/i.test(path));
    assert.ok(imagePath, 'No source image is available for the 7z import fixture');
    const imageBase64 = (await readFile(imagePath)).toString('base64');
    const imageExtension = imagePath.match(/\.([a-z0-9]+)$/i)[1].toLowerCase();
    const fixturePage = await browser.newPage();
    await fixturePage.goto(appUrl, { waitUntil: 'domcontentloaded' });
    const fixtureBase64 = await fixturePage.evaluate(async ({ encodedImage, extension }) => {
      const Archive = await window.GameArchiveRuntime.load();
      const binary = atob(encodedImage);
      const imageBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) imageBytes[i] = binary.charCodeAt(i);
      const imagePath = `images/fixture-cover.${extension}`;
      const payload = [{
        id: 'seven-zip-fixture',
        title: '7z Import Fixture',
        description: 'Archive importer validation record',
        url: 'games/fixture.html',
        thumb: imagePath
      }];
      const archive = await Archive.write({
        files: [
          { file: new File([JSON.stringify(payload)], 'gamesData.json'), pathname: 'fixture/gamesData.json' },
          { file: new File([imageBytes], `fixture-cover.${extension}`), pathname: `fixture/${imagePath}` }
        ],
        outputFileName: 'generated-game-import-fixture.7z',
        compression: 'none',
        format: '7zip',
        passphrase: null
      });
      const bytes = new Uint8Array(await archive.arrayBuffer());
      let binaryOutput = '';
      for (let i = 0; i < bytes.length; i++) binaryOutput += String.fromCharCode(bytes[i]);
      return btoa(binaryOutput);
    }, { encodedImage: imageBase64, extension: imageExtension });
    await fixturePage.close();
    const fixturePath = join(outputDir, 'generated-game-import-fixture.7z');
    const fixtureBytes = Buffer.from(fixtureBase64, 'base64');
    await writeFile(fixturePath, fixtureBytes);
    candidates.push({ category: 'synthetic', source: '7z-import-fixture', path: fixturePath });
    synthetic7z = { created: true, bytes: fixtureBytes.length };
  } catch (error) {
    synthetic7z.error = error.stack || error.message;
    console.warn(`Could not create a 7z import fixture: ${error.message}`);
  }

  for (const candidate of candidates) {
    const fileName = basename(candidate.path);
    const expectedLabel = fileName.replace(/\.(?:json|zip|rar|7z)$/i, '');
    console.log(`Importing ${candidate.category}/${candidate.source}/${fileName}`);
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    try {
      await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
      await page.locator('#game-json-upload').waitFor({ state: 'attached' });
      await page.locator('#game-json-upload').setInputFiles(candidate.path);
      await page.waitForFunction((label) => {
        const status = document.getElementById('source-status');
        if (!status) return false;
        return status.classList.contains('is-error') ||
          (status.classList.contains('is-success') && status.textContent.includes(label));
      }, expectedLabel, { timeout: 180000 });
      const state = await page.evaluate(() => ({
        status: document.getElementById('source-status')?.textContent || '',
        fingerprint: document.getElementById('source-fingerprint')?.textContent || ''
      }));
      const imported = await page.locator('#source-status').evaluate((el) => el.classList.contains('is-success'));
      const count = Number((state.status.match(/已加载\s*(\d+)\s*个游戏/) || [])[1] || 0);
      const extractedImages = Number((state.status.match(/已提取\s*(\d+)\s*张本地图片/) || [])[1] || 0);
      const isJson = /\.json$/i.test(candidate.path);
      const expectedJsonRejection = isJson && !imported && state.status.includes('没有找到同时包含标题、游戏地址和图片地址的有效游戏');
      const entry = {
        category: candidate.category,
        source: candidate.source,
        path: relative(dataRoot, candidate.path).replaceAll('\\', '/'),
        imported,
        count,
        extractedImages,
        status: state.status,
        fingerprint: state.fingerprint,
        expectedJsonRejection,
        pageErrors
      };
      if (pageErrors.length || (!imported && !expectedJsonRejection) || (imported && !count)) {
        entry.error = pageErrors.length ? 'Browser page error' : (!imported ? state.status : 'Imported zero records');
      }
      results.push(entry);
    } catch (error) {
      results.push({
        category: candidate.category,
        source: candidate.source,
        path: relative(dataRoot, candidate.path).replaceAll('\\', '/'),
        imported: false,
        error: error.stack || error.message,
        pageErrors
      });
    } finally {
      await page.close();
    }
    if (results.length % 5 === 0) console.log(`Imported ${results.length}/${candidates.length} source files`);
  }
} finally {
  await browser.close();
}

const report = {
  root: dataRoot,
  synthetic7z,
  total: candidates.length,
  imported: results.filter((result) => result.imported).length,
  expectedJsonRejections: results.filter((result) => result.expectedJsonRejection).length,
  failed: results.filter((result) => result.error).length,
  results
};
await writeFile(join(outputDir, 'results.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  total: report.total,
  imported: report.imported,
  expectedJsonRejections: report.expectedJsonRejections,
  failed: report.failed,
  synthetic7z: report.synthetic7z,
  failures: results.filter((result) => result.error),
  report: join(outputDir, 'results.json')
}, null, 2));
assert.equal(report.failed, 0, `${report.failed}/${report.total} source files had unexpected import failures`);
