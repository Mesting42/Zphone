/** Real Windows directory authorization/read/preview/save regression using the
 * user's extracted RAR copies. No synthetic bridge or browser download replaces
 * the native interfaces. Input originals remain read only. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, cp, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import JSZip from 'jszip';
import { launchWorkbench } from './electron-workbench.mjs';
const output = resolve(process.env.NATIVE_RUN_OUTPUT);
await mkdir(output, { recursive: true });
const app = await launchWorkbench();
const page = await app.newPage({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(45000);
const report = { errors: [], ordinary: null, batch: null, cancellation: false };
page.on('pageerror', error => report.errors.push(error.message));
await page.route(/https?:\/\/[^/]*(?:googletagservices|googlesyndication|doubleclick|googletagmanager|google-analytics)\.[^/]+\//i,
    route => route.fulfill({ status: 200, body: '', contentType: 'application/javascript' }));
// A new acceptance round owns its input copies; never overwrite an older round.
const inputRoot = resolve(process.env.REGRESSION_INPUT_ROOT || 'coverage/apps-regression-20261014/input');
const glacier = join(inputRoot, 'extracted-glacier');
const tea = join(inputRoot, 'extracted-tea');
const ads = resolve('C:/Users/zyt/Desktop/广告代码测试');
const multiple = join(inputRoot, 'multiple-json-glacier');
await cp(glacier, multiple, { recursive: true });
async function firstJson(directory) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, item.name);
        if (item.isDirectory()) { const found = await firstJson(path); if (found) return found; }
        else if (item.name.endsWith('.json')) return path;
    }
}
await writeFile(join(multiple, 'second-dataset.json'), await readFile(await firstJson(glacier)));
async function inspectSaved(download, name) {
    const path = join(output, name); await download.saveAs(path);
    const zip = await JSZip.loadAsync(await readFile(path));
    const dataPath = Object.keys(zip.files).find(key => /(?:^|\/)data.json$/.test(key));
    const rows = JSON.parse(await zip.file(dataPath).async('string'));
    const prefix = dataPath.slice(0, -'data.json'.length);
    const references = rows.flatMap(row => Object.values(row).filter(value => typeof value === 'string' && /^images\/.*\.(?:webp|png|jpe?g)$/i.test(value)));
    assert.ok(references.length >= 48, 'Every article must retain its imported cover');
    for (const image of references) assert.ok(zip.file(prefix + image), 'Missing saved cover: ' + image);
    return { path, records: rows.length, covers: references.length, files: Object.values(zip.files).filter(file => !file.dir).length };
}
try {
    await page.goto('sitefoundry://app/');
    await app.chooseDirectory(glacier);
    await page.locator('#data-directory-button').click();
    await page.waitForFunction(() => document.querySelector('#upload-import-progress')?.dataset.state === 'success');
    assert.equal(await page.locator('#data-count').textContent(), '48');
    assert.equal(await page.locator('#image-type').textContent(), '本地');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Folder import must fit a phone viewport');
    await page.screenshot({ path: join(output, 'ordinary-folder-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await app.chooseDirectory(null);
    await page.locator('#data-directory-button').click();
    await page.waitForFunction(() => document.activeElement.id === 'data-directory-button');
    assert.equal(await page.locator('#data-count').textContent(), '48');
    report.cancellation = true;
    await app.chooseDirectory(multiple);
    await page.locator('#data-directory-button').click();
    await page.locator('#data-directory-json-choice').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#data-directory-json-choice option').count(), 2);
    for (let tab = 0; tab < 6; tab++) {
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.querySelector('#notice-overlay').contains(document.activeElement)), true);
    }
    assert.equal(await page.evaluate(() => window.SiteFoundryPlatform.handleBack()), true);
    await page.waitForFunction(() => document.querySelector('#notice-overlay').hidden && document.activeElement.id === 'data-directory-button');
    assert.equal(await page.locator('#data-count').textContent(), '48');
    report.multiJsonBackCancelsAndRestoresFocus = true;
    await page.locator('#btn-next').click();
    await page.locator('.theme-card:visible').first().click();
    for (const step of [3, 4]) { await page.locator('#btn-next').click(); await page.locator('#step-' + step + '.active').waitFor(); }
    await page.locator('.config-tab[data-tab="ads"]').click();
    await page.locator('#ad-code-upload').setInputFiles(join(ads, 'zpau108.shipyardy.com.txt'));
    await page.waitForFunction(() => /成功|识别|已上传|有效/.test(document.querySelector('#ad-code-status')?.textContent || ''));
    const images = await page.frameLocator('#preview-frame').locator('body').evaluate(async body => {
        const checks = await Promise.all([...body.querySelectorAll('img')].map(image => new Promise(done => {
            const probe = new Image(); probe.onload = () => done(probe.naturalWidth > 0); probe.onerror = () => done(false); probe.src = image.src;
        })));
        return { images: checks.length, broken: checks.filter(value => !value).length };
    });
    assert.ok(images.images > 0); assert.equal(images.broken, 0);
    await page.screenshot({ path: join(output, 'ordinary-folder.png') });
    await page.locator('#btn-next').click();
    const [ordinary] = await Promise.all([page.waitForEvent('download'), page.locator('#btn-export').click()]);
    report.ordinary = { ...await inspectSaved(ordinary, 'ordinary-folder.zip'), images };

    await page.goto('sitefoundry://app/');
    await page.locator('[data-build-mode="batch-ad-build"]').click();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Batch directory controls must fit a phone viewport');
    await page.screenshot({ path: join(output, 'batch-folder-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const [index, folder] of [glacier, tea].entries()) {
        await app.chooseDirectory(folder); await page.locator('#batch-directory-button').click();
        await page.waitForFunction(count => document.querySelectorAll('#batch-data-list .batch-ad-data-item').length === count, index + 1);
    }
    assert.match(await page.locator('#batch-data-list').innerText(), /48 条/);
    for (const step of [2, 3, 4]) { await page.locator('#btn-next').click(); await page.locator('#step-' + step + '.active').waitFor(); }
    await page.locator('.config-tab[data-tab="ads"]').click();
    await page.locator('#batch-ad-code-input').setInputFiles(['zpau108a.synvexia.top.txt', 'zpau108a.zentropy.top.txt'].map(name => join(ads, name)));
    await page.waitForFunction(() => document.querySelectorAll('.batch-ad-code-select').length === 2 && document.querySelector('.batch-ad-code-select')?.options.length === 3);
    await page.screenshot({ path: join(output, 'batch-folders.png') });
    const downloads = [];
    const complete = new Promise(done => page.on('download', download => { downloads.push(download); if (downloads.length === 2) done(); }));
    await page.locator('#btn-next').click(); await page.locator('#btn-export').click();
    await Promise.race([complete, new Promise((_, reject) => setTimeout(() => reject(Error('Batch native saves timed out')), 120000).unref())]);
    report.batch = [];
    for (const download of downloads) report.batch.push(await inspectSaved(download, download.suggestedFilename()));
    assert.deepEqual(report.errors, []);
} finally {
    await writeFile(join(output, 'results.json'), JSON.stringify(report, null, 2));
    await app.close();
}
console.log(JSON.stringify(report));
