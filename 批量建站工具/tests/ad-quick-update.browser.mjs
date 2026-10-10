/** 快速更新的真实文件闭环；原包只读，变体、ZIP 和目录输出均写 coverage。 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { createServer } from 'node:http';
import vm from 'node:vm';
import JSZip from 'jszip';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const output = resolve('coverage/ad-quick-update');
await mkdir(join(output, 'fixtures'), { recursive: true });
const context = { TextEncoder, TextDecoder, Blob, JSZip, window: {} };
for (const file of ['template-catalog.js', 'template-layouts.js', 'navbar-layout.js', 'data.js', 'domain.js', 'ad-migration.js', 'ad.js', 'generator.js', 'finished-site-ads.js', 'ad-restoration.js']) {
    vm.runInNewContext(await readFile(resolve('js', file), 'utf8'), context);
}
const engine = context.window.AdRestoration, generator = vm.runInNewContext('Generator', context);
const decoder = new TextDecoder();
const sources = ['coverage/ad-page-isolation/zpau108a.synvexia.top.zip', 'coverage/ad-page-isolation/zpau108a.zentropy.top.zip', 'coverage/ad-core-audit/2026-10-08/exports/game-built-in.zip'];
const fixtures = [];
for (const [index, source] of sources.entries()) {
    const zip = await JSZip.loadAsync(await readFile(resolve(source)));
    let entries = await Promise.all(Object.values(zip.files).filter(file => !file.dir).map(async file => ({ path: file.name, bytes: await file.async('uint8array') })));
    let metadata = engine.inspectSiteEntries(entries, source);
    assert.ok(metadata.valid, JSON.stringify(metadata.errors));
    const root = metadata.siteRoot;
    entries = entries.filter(entry => entry.path.startsWith(root)).map(entry => ({ ...entry, path: entry.path.slice(root.length) }));
    const config = { ...metadata.embeddedConfig, analyticsID: 'G-OLD123' };
    const runtime = entries.find(entry => entry.path === 'js/ad.js');
    runtime.bytes = new TextEncoder().encode(generator.generateSelectedAdJs(config, index ? 'initial' : 'v1.0.0'));
    metadata = engine.inspectSiteEntries(entries, source);
    const host = metadata.detectedHost;
    const newConfig = Object.fromEntries(Object.entries(config).map(([key, value]) => [key, key === 'analyticsID' ? (index === 0 ? 'G-NEW456' : '') : value.replace(/banner([123])$/, 'banner$1$1').replace(/-(INT|ANC)$/i, '-$11')]));
    const txt = join(output, 'fixtures', host + '.txt');
    await writeFile(txt, generator.generateSelectedAdJs(newConfig, 'v1.0.2.1'));
    const archive = new JSZip(); entries.forEach(entry => archive.file(entry.path, entry.bytes));
    const path = join(output, 'fixtures', host + '.zip');
    await writeFile(path, await archive.generateAsync({ type: 'nodebuffer' }));
    fixtures.push({ id: host, host, name: host, entries, metadata, path, txt, config: newConfig });
}
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
page.setDefaultTimeout(30000);
const results = process.env.QUICK_EXPORTED_ONLY ? JSON.parse(await readFile(join(output, 'results.json'), 'utf8')) : { errors: [], layouts: [], exportedPages: [], fileComparisons: [] };
results.exportedPages = [];
page.on('pageerror', error => results.errors.push(error.message));
let server;
async function upload(sites, codes) {
    await page.locator('#restoration-sites-input').setInputFiles(sites);
    await page.waitForFunction(count => document.getElementById('restoration-scan-progress-text').textContent.startsWith('已识别 ' + count + ' 个站点'), sites.length);
    await page.locator('#btn-next').click();
    await page.locator('#ad-quick-config').waitFor({ state: 'visible' });
    await page.locator('#ad-quick-code-input').setInputFiles(codes);
}
async function download(name) {
    await page.locator('#btn-next').click();
    const pending = page.waitForEvent('download');
    await page.locator('#restoration-run-zip').click();
    const file = await pending; await file.saveAs(join(output, name));
    return JSZip.loadAsync(await readFile(join(output, name)));
}
async function compare(zip, fixture) {
    let identical = 0;
    for (const entry of fixture.entries) {
        const file = zip.file(fixture.host + '/' + entry.path);
        assert.ok(file, entry.path);
        // HTML 只允许广告页类型和 ad.js 缓存参数改变；其他原文件逐字节一致。
        if (entry.path === 'js/ad.js' || entry.path === 'ad-policy.json' || /\.html?$/i.test(entry.path) && [fixture.metadata.homePath, ...fixture.metadata.detailPaths, ...fixture.metadata.listingPaths].includes(entry.path)) continue;
        assert.deepEqual(await file.async('uint8array'), entry.bytes, entry.path); identical++;
    }
    for (const path of [fixture.metadata.homePath, ...fixture.metadata.detailPaths, ...fixture.metadata.listingPaths]) {
        const before = decoder.decode(fixture.entries.find(entry => entry.path === path).bytes);
        const after = await zip.file(fixture.host + '/' + path).async('string');
        const normalize = html => html.replace(/\sdata-sitefoundry-ad-page=["'][^"']*["']/g, '').replace(/(js\/ad\.js)(?:\?[^"']*)?/g, '$1');
        assert.equal(normalize(after), normalize(before), path + ': original content and ad gaps');
    }
    const runtime = await zip.file(fixture.host + '/js/ad.js').async('string');
    assert.ok(runtime.includes('ad.js v1.0.2.1'));
    for (const key of ['bannerPath1', 'bannerPath2', 'bannerPath3', 'interstitialPath', 'anchorPath']) assert.ok(runtime.includes(fixture.config[key]), key);
    assert.ok(runtime.includes(fixture.config.analyticsID || 'G-OLD123'));
    results.fileComparisons.push({ host: fixture.host, identicalFiles: identical, pages: fixture.metadata.detailPaths.length + fixture.metadata.listingPaths.length + 1 });
}
try {
    let batch;
    if (!process.env.QUICK_EXPORTED_ONLY) {
    await page.goto(process.env.BUILDER_URL || 'http://127.0.0.1:5174/', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-build-mode="ad-restoration"]').click();
    await page.locator('[name="ad-policy-task"][value="quick"]').check();
    await upload([fixtures[0].path], [fixtures[1].txt]);
    await page.waitForFunction(() => document.getElementById('ad-quick-code-status').textContent.includes('0/1'));
    assert.ok(await page.locator('#restoration-run-zip').isDisabled());
    await page.locator('#ad-quick-code-input').setInputFiles(fixtures[0].txt);
    await page.waitForFunction(() => document.getElementById('ad-quick-code-status').textContent.includes('1/1'));
    await page.frameLocator('#preview-frame').locator('#adv2').waitFor();
    const single = await download('single.zip');
    assert.equal(Object.keys(single.files).filter(path => /\/js\/ad\.js$/.test(path)).length, 1);
    await compare(single, fixtures[0]);
    console.log('Single-site replacement, wrong-host rejection and GA override passed');

    await page.locator('#btn-prev').click(); await page.locator('#btn-prev').click();
    await page.locator('[name="ad-quick-scope"][value="batch"]').check();
    await upload(fixtures.map(item => item.path), fixtures.map(item => item.txt));
    await page.waitForFunction(() => document.getElementById('ad-quick-code-status').textContent.includes('3/3'));
    for (const width of [1600, 1920, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.waitForTimeout(180);
        const layout = await page.evaluate(() => {
            const panel = document.getElementById('ad-quick-config');
            return { width: innerWidth, overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
                controlsOverflow: [...panel.querySelectorAll('select,button,article')].filter(element => element.getBoundingClientRect().right > panel.getBoundingClientRect().right + 1).length };
        });
        assert.equal(layout.overflow, 0); assert.equal(layout.controlsOverflow, 0); results.layouts.push(layout);
        await page.screenshot({ path: join(output, 'quick-' + width + '.png'), fullPage: true });
    }
    await page.setViewportSize({ width: 1600, height: 1000 });
    // 模式切换保留两套状态，详细工作台仍能使用原控件。
    await page.locator('#btn-prev').click();
    await page.locator('[name="ad-policy-task"][value="advanced"]').check();
    await page.locator('#btn-next').click();
    assert.ok(await page.locator('#ad-policy-active-override').isVisible());
    await page.locator('#btn-prev').click();
    await page.locator('[name="ad-policy-task"][value="quick"]').check();
    await page.locator('#btn-next').click();
    assert.ok((await page.locator('#ad-quick-code-status').textContent()).includes('3/3'));
    batch = await download('batch.zip');
    for (const fixture of fixtures) await compare(batch, fixture);

    // 控制目录选择结果，仍执行真实浏览器导出处理和 writer，将字节实际写入专用测试目录。
    await page.exposeFunction('__quickWriteFile', async (path, bytes) => {
        const target = resolve(output, 'directory-output', path);
        assert.ok(target.startsWith(resolve(output, 'directory-output') + '\\'));
        await mkdir(dirname(target), { recursive: true }); await writeFile(target, new Uint8Array(bytes));
    });
    await page.evaluate(() => {
        function directory(path = '') { return {
            async getDirectoryHandle(name) { return directory(path + name + '/'); },
            async getFileHandle(name) { return { async createWritable() { return {
                async write(data) { const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data; await window.__quickWriteFile(path + name, Array.from(bytes)); }, async close() {}
            }; } }; }
        }; }
        window.showDirectoryPicker = async () => directory();
    });
    await page.locator('#restoration-run').click();
    await page.waitForFunction(() => document.getElementById('restoration-result').textContent.includes('已生成新的站点总目录'), null, { timeout: 120000 });
    results.directoryWrite = true;
    console.log('Mixed article/game batch, unchanged files, responsive UI and actual directory output passed');

    const closedPolicy = engine.createPolicy('traffic-limit', { pageIsolation: true });
    const closed = engine.preparePolicySite(fixtures[0], closedPolicy);
    assert.ok(closed.valid);
    const closedZip = new JSZip(); closed.entries.forEach(entry => closedZip.file(entry.path, Array.from(entry.bytes)));
    const closedPath = join(output, 'fixtures', 'closed.zip');
    await writeFile(closedPath, await closedZip.generateAsync({ type: 'nodebuffer' }));
    await page.locator('#btn-prev').click(); await page.locator('#btn-prev').click();
    await page.locator('[name="ad-quick-scope"][value="single"]').check();
    await upload([closedPath], [fixtures[0].txt]);
    await page.waitForFunction(() => document.getElementById('ad-quick-code-status').textContent.includes('1/1'));
    await page.locator('#ad-quick-switches').selectOption('preserve');
    const preservedZip = await download('preserved-switches.zip');
    const preservedDetail = await preservedZip.file(fixtures[0].host + '/' + fixtures[0].metadata.detailPaths[0]).async('string');
    assert.equal(/id="div-gpt-ad-banner[123]"/.test(preservedDetail.replace(/<!--[\s\S]*?-->/g, '')), false);
    const preservedManifest = JSON.parse(await preservedZip.file(fixtures[0].host + '/ad-policy.json').async('string'));
    assert.equal(preservedManifest.policy.outOfPage.interstitial.home, false);
    await page.locator('#btn-prev').click();
    await page.locator('#ad-quick-switches').selectOption('template');
    const restoredZip = await download('template-restored.zip');
    const restoredDetail = await restoredZip.file(fixtures[0].host + '/' + fixtures[0].metadata.detailPaths[0]).async('string');
    assert.equal((restoredDetail.replace(/<!--[\s\S]*?-->/g, '').match(/id="div-gpt-ad-banner[123]"/g) || []).length, 3);
    results.switchOptions = true;
    console.log('Preserved closed page switches and restored template defaults passed');
    } else batch = await JSZip.loadAsync(await readFile(join(output, 'batch.zip')));

    // 各站按实际部署方式位于域名根目录；模板首页判断本来就使用 /index.html。
    let servedHost = fixtures[0].host;
    server = createServer(async (req, res) => {
        const path = servedHost + '/' + decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
        const file = batch.file(path);
        if (!file) { res.writeHead(404); res.end(); return; }
        const type = /\.html?$/.test(path) ? 'text/html;charset=utf-8' : /\.js$/.test(path) ? 'application/javascript' : /\.css$/.test(path) ? 'text/css' : /\.webp$/.test(path) ? 'image/webp' : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type }); res.end(await file.async('nodebuffer'));
    });
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    const port = server.address().port;
    const exported = await browser.newPage();
    exported.on('pageerror', error => results.errors.push(error.message));
    await exported.route(/(?:securepubads\.g\.doubleclick\.net|googletagmanager\.com)/, route => route.fulfill({ contentType: 'application/javascript', body: '' }));
    await exported.addInitScript(() => {
        window.__adCalls = []; const slot = { addService() { return this; }, setConfig() {} };
        window.googletag = { cmd: { push: fn => fn() }, setConfig() {}, pubads: () => ({}), defineSlot: path => { window.__adCalls.push(path); return slot; },
            defineOutOfPageSlot: (path, format) => { window.__adCalls.push(format); return slot; }, enums: { OutOfPageFormat: { INTERSTITIAL: 'INT', BOTTOM_ANCHOR: 'ANC' } }, enableServices() {}, display() {} };
    });
    for (const fixture of fixtures) for (const [kind, path] of [['home', fixture.metadata.homePath], ['detail', fixture.metadata.detailPaths[0]], ['all', fixture.metadata.listingPaths[0]]]) {
        servedHost = fixture.host;
        await exported.goto('http://127.0.0.1:' + port + '/' + path, { waitUntil: 'load' });
        // 离屏图片可能尚未触发原站的懒加载，主动探测实际 URL，不把未请求当作损坏。
        const stats = await exported.evaluate(async () => {
            const images = await Promise.all([...document.images].map(image => new Promise(done => {
                const probe = new Image(); const timeout = setTimeout(() => done(image.src), 10000);
                probe.onload = () => { clearTimeout(timeout); done(null); };
                probe.onerror = () => { clearTimeout(timeout); done(image.src); }; probe.src = image.src;
            })));
            return { calls: window.__adCalls, ads: document.querySelectorAll('[id^="div-gpt-ad-banner"]').length, broken: images.filter(Boolean).length, brokenUrls: images.filter(Boolean) };
        });
        assert.equal(stats.ads, 3); assert.equal(stats.broken, 0);
        assert.ok(stats.calls.includes('ANC')); assert.equal(stats.calls.includes('INT'), kind === 'home');
        results.exportedPages.push({ host: fixture.host, kind, ...stats });
    }
    assert.deepEqual(results.errors, []);
    console.log('Nine exported pages reopened with new units and template OOP behavior');
} finally {
    await writeFile(join(output, 'results.json'), JSON.stringify(results, null, 2));
    if (server) await new Promise(done => server.close(done));
    await browser.close();
}
