/** Focused offline acceptance. Fresh browser contexts block every external HTTP
 * request while leaving loopback available; navigator's offline signal is
 * controlled separately because browser-wide offline mode also blocks localhost.
 * Differentiated workflows and the full regression suite are intentionally absent.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, extname, sep } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
const { chromium } = createRequire(import.meta.url)('C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = resolve('coverage/offline-20261013');
await mkdir(output, { recursive: true });
const input = resolve('coverage/full-regression-20261013/configuration-controls-final-2/input/data');
const report = { backup: 'D:/Min/建站工具备份/SiteFoundry_20261013_154554_离线改造前', checks: [], errors: [], externalRequests: [], localFailures: [] };

// Generate a small 7z using the installed Windows libarchive tar. Original
// materials stay unchanged; fixture records/covers come from the built-in ZIP.
const fixture = resolve(output, 'fixture'); await mkdir(fixture, { recursive: true });
const originalGame = resolve('game-builder/assets/builtin-game-sources/game-source-1.zip');
const sourceZip = await JSZip.loadAsync(await readFile(originalGame));
const jsonEntry = Object.values(sourceZip.files).find(file => !file.dir && file.name.endsWith('.json'));
const gameRecords = JSON.parse(await jsonEntry.async('text')).slice(0, 2);
await writeFile(resolve(fixture, 'gamesData.json'), JSON.stringify(gameRecords));
for (const item of gameRecords) {
    const entry = Object.values(sourceZip.files).find(file => file.name.endsWith('/' + item.thumb));
    await mkdir(resolve(fixture, 'images'), { recursive: true });
    await writeFile(resolve(fixture, item.thumb), await entry.async('nodebuffer'));
}
const sevenZip = resolve(output, 'games-fixture.7z');
const tar = spawnSync('tar.exe', ['-c', '-f', sevenZip, '--format', '7zip', '-C', fixture, 'gamesData.json', 'images']);
assert.equal(tar.status, 0, tar.stderr.toString());

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json' };
const assets = createServer(async (request, response) => {
    const path = resolve(output, '.' + decodeURIComponent(new URL(request.url, 'http://local').pathname));
    if (!path.startsWith(output + sep)) { response.writeHead(403).end(); return; }
    try { response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' }).end(await readFile(path)); }
    catch { response.writeHead(404).end(); }
});
await new Promise(done => assets.listen(0, '127.0.0.1', done));
const assetOrigin = 'http://127.0.0.1:' + assets.address().port;
await writeFile(resolve(output, 'editorial.rar'), await readFile(resolve(input, '摇滚乐史.rar')));
const portProbe = createServer(); await new Promise(done => portProbe.listen(0, '127.0.0.1', done));
const port = portProbe.address().port; await new Promise(done => portProbe.close(done));
const userData = resolve(output, 'user-data', String(Date.now()));
let serverLog = '';
function startServer() {
    const serverProcess = spawn(process.execPath, [resolve('dist/sitefoundry-server.mjs'), '--port', String(port)], {
        cwd: fixture, env: { ...globalThis.process.env, SITEFOUNDRY_DATA_DIR: userData }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
    });
    serverProcess.stdout.on('data', value => { serverLog += value; }); serverProcess.stderr.on('data', value => { serverLog += value; });
    return serverProcess;
}
let child = startServer();
const base = 'http://127.0.0.1:' + port;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
async function newPage(width = 1440) {
    // Each context starts empty. Do not use Playwright's serviceWorkers:block
    // shim: it reads navigator.serviceWorker inside opaque sandbox iframes and
    // creates a SecurityError unrelated to the application's own resources.
    const context = await browser.newContext({ viewport: { width, height: 960 }, acceptDownloads: true });
    await context.addInitScript(() => {
        window.qaConnected = false;
        Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => window.qaConnected });
    });
    await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (/^https?:$/.test(url.protocol) && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
            report.externalRequests.push(url.href); return route.abort('internetdisconnected');
        }
        return route.continue();
    });
    const page = await context.newPage(); page.setDefaultTimeout(45000);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && /^http:\/\/127\.0\.0\.1/.test(response.url())) report.localFailures.push({ url: response.url(), status: response.status() }); });
    return page;
}
async function fontChoice(page, value, css) {
    await page.locator('.config-tab[data-tab="style"]').click();
    await page.locator('#font-style').evaluate((select, value) => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); }, value);
    const frame = page.frameLocator('#preview-frame');
    await frame.locator('link[data-sitefoundry-font]').first().waitFor({ state: 'attached' });
    await frame.locator('body').evaluate(async (body, css) => {
        const link = document.querySelector('link[data-sitefoundry-font]');
        if (!link.sheet) await new Promise((done, reject) => { link.addEventListener('load', done, { once: true }); link.addEventListener('error', () => reject(Error('Font CSS failed')), { once: true }); });
        const faces = await document.fonts.load(css); if (!faces.length) throw Error('Requested face was not registered');
        await document.fonts.ready;
    }, css);
    assert.equal(await frame.locator('body').evaluate((body, css) => document.fonts.check(css), css), true);
}
async function inspectZip(path, name, css) {
    const zip = await JSZip.loadAsync(await readFile(path));
    const htmlFiles = Object.keys(zip.files).filter(path => /\.html$/.test(path));
    const fontFiles = Object.keys(zip.files).filter(path => /\/fonts\/inter\//.test(path));
    assert.ok(fontFiles.some(path => path.endsWith('LICENSE.txt')));
    assert.ok(fontFiles.some(path => path.endsWith('.woff2')));
    const root = resolve(output, name);
    for (const file of Object.values(zip.files).filter(file => !file.dir)) {
        const target = resolve(root, file.name); assert.ok(target.startsWith(root + sep));
        await mkdir(resolve(target, '..'), { recursive: true }); await writeFile(target, await file.async('nodebuffer'));
    }
    for (const path of [htmlFiles.find(path => /\/index\.html$/.test(path)), htmlFiles.find(path => /\/details\//.test(path))]) {
        assert.ok(path, 'home and detail must exist');
        const html = await zip.file(path).async('text'); assert.doesNotMatch(html, /fonts\.(googleapis|gstatic)\.com/);
        const page = await newPage(); await page.goto(assetOrigin + '/' + name + '/' + path);
        assert.ok(await page.evaluate(async css => { const faces = await document.fonts.load(css); await document.fonts.ready; return faces.length; }, css));
        assert.equal(await page.evaluate(css => document.fonts.check(css), css), true);
        assert.ok(await page.locator('body').innerText()); await page.close();
    }
    report.checks.push({ name: name + '-export', htmlPages: htmlFiles.length, fontFiles: fontFiles.length, zipBytes: (await stat(path)).size });
}
try {
    for (let attempt = 0; attempt < 80; attempt++) {
        try { if ((await fetch(base)).ok) break; } catch {}
        await new Promise(done => setTimeout(done, 100));
    }
    assert.ok(serverLog.includes('SiteFoundry:'), serverLog);
    for (const game of [false, true]) {
        const page = await newPage(); await page.goto(base + (game ? '/game-builder/' : '/'));
        assert.equal(await page.title(), 'SiteFoundry'); await page.locator('.workbench-brand-mark').evaluate(img => img.decode());
        if (game) {
            await page.locator('#source-status').filter({ hasText: '已加载' }).waitFor();
            await page.locator('#game-json-upload').setInputFiles(sevenZip);
            await page.waitForFunction(() => document.getElementById('source-status').classList.contains('is-success') && /已加载 2 个游戏/.test(document.getElementById('source-status').textContent));
            report.checks.push({ name: 'game-7z-ui-import' });
            // ZIP import must still accept the unmodified real game package.
            await page.locator('#game-json-upload').setInputFiles(originalGame);
            await page.waitForFunction(() => document.getElementById('source-status').classList.contains('is-success') && /84/.test(document.getElementById('source-status').textContent));
        } else {
            await page.locator('#upload-area[data-upload-ready="true"]').waitFor();
            await page.locator('#file-input').setInputFiles(resolve(input, '摇滚乐史.rar'));
            await page.waitForFunction(() => /已解析|导入成功/.test(document.getElementById('upload-import-progress-text')?.textContent || ''), null, { timeout: 180000 });
            await page.locator('#btn-next').click(); await page.locator('.theme-card:visible').first().click(); await page.locator('#btn-next').click(); await page.locator('#step-3.active').waitFor(); await page.locator('#btn-next').click();
        }
        await fontChoice(page, game ? 'clean' : 'inter-italic', game ? '16px Inter' : 'italic 16px Inter');
        await page.evaluate(() => {
            OfflineStatus.trackState({ data: [{ image: 'https://example.org/material-cover.png' }] });
            window.qaConnected = true; dispatchEvent(new Event('online'));
        });
        await assert.doesNotReject(() => page.locator('#offline-resource-notice').waitFor({ state: 'hidden' }));
        await page.evaluate(() => { window.qaConnected = false; dispatchEvent(new Event('offline')); });
        await page.locator('#offline-resource-notice').waitFor({ state: 'visible' });
        await page.screenshot({ path: resolve(output, game ? 'game-offline.png' : 'editorial-offline.png') });
        await page.locator('#btn-next').click();
        const [download] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.locator('#btn-export').click()]);
        const zipPath = resolve(output, game ? 'game.zip' : 'editorial.zip'); await download.saveAs(zipPath);
        await inspectZip(zipPath, game ? 'game-export' : 'editorial-export', game ? '16px Inter' : 'italic 16px Inter');
        if (game) {
            const count = await page.evaluate(async origin => {
                const bytes = await (await fetch(origin + '/editorial.rar')).arrayBuffer();
                const Archive = await GameArchiveRuntime.load(); const archive = await Archive.open(new File([bytes], 'editorial.rar'));
                try { await archive.extractFiles(); return (await archive.getFilesArray()).length; } finally { archive.close(); }
            }, assetOrigin);
            assert.ok(count > 0); report.checks.push({ name: 'game-local-rar-engine', extractedFiles: count });
        }
        await page.close(); console.log((game ? 'Game' : 'Editorial') + ' offline import/preview/export passed.');
    }

    // Verify every bundled face and license against the provisioning manifest.
    const catalog = JSON.parse(await readFile('public/fonts/manifest.json', 'utf8'));
    let faceCount = 0;
    for (const family of Object.values(catalog.families)) {
        assert.ok((await readFile(resolve('public/fonts', family.license), 'utf8')).includes('LICENSE'));
        const css = await readFile(resolve('public/fonts', family.css), 'utf8'); assert.doesNotMatch(css, /https?:/);
        for (const file of family.files) {
            const bytes = await readFile(resolve('dist/fonts', file.path));
            assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256); faceCount++;
        }
    }
    report.checks.push({ name: 'bundled-font-integrity', families: Object.keys(catalog.families).length, files: faceCount });

    await writeFile(resolve(output, 'font-probe.html'), '<!doctype html><html><head>' + Object.values(catalog.families).map(family => '<link rel="stylesheet" href="' + base + '/fonts/' + family.css + '">').join('') + '</head><body>Local font validation</body></html>');
    const fontPage = await newPage(); await fontPage.goto(assetOrigin + '/font-probe.html');
    const loaded = await fontPage.evaluate(async families => {
        const result = [];
        for (const family of families) { const faces = await document.fonts.load('16px "' + family + '"'); result.push({ family, faces: faces.length, loaded: faces.every(face => face.status === 'loaded') }); }
        return result;
    }, Object.keys(catalog.families));
    assert.ok(loaded.every(item => item.faces && item.loaded), JSON.stringify(loaded)); await fontPage.close();
    report.checks.push({ name: 'browser-font-families', loaded: loaded.length });

    const mobile = await newPage(390); await mobile.goto(base + '/');
    await mobile.evaluate(() => OfflineStatus.trackState({ data: [{ image: 'https://example.org/cover.png' }] }));
    await mobile.locator('#offline-resource-notice').waitFor({ state: 'visible' });
    const notice = await mobile.locator('#offline-resource-notice').boundingBox(); assert.ok(notice.x >= 0 && notice.x + notice.width <= 390);
    await mobile.screenshot({ path: resolve(output, 'offline-notice-mobile.png') }); await mobile.close();
    report.checks.push({ name: 'offline-notice-390px', width: notice.width });

    // Template saving uses the bundled server and a disposable store; the user's
    // real catalog is neither overwritten nor used as a test fixture.
    const template = '/** ad.js v9.9.9 */\n' + ['bannerPath1', 'bannerPath2', 'bannerPath3', 'interstitialPath', 'anchorPath', 'analyticsID'].map(name => 'var ' + name + '="";').join('\n');
    async function post(path, body) {
        const response = await fetch(base + '/__sitefoundry/ad-templates/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const value = await response.json(); assert.ok(response.ok, JSON.stringify(value)); return value;
    }
    const analyzed = await post('analyze', { source: template });
    await post('save', { source: template, fields: analyzed.fields, version: 'v9.9.9' });
    const saved = await (await fetch(base + '/__sitefoundry/ad-templates')).json();
    assert.ok(saved.templates.some(template => template.version === 'v9.9.9'));
    report.checks.push({ name: 'local-template-analyze-save-read' });
    const stopped = new Promise(done => child.once('exit', done)); child.kill(); await stopped;
    child = startServer();
    for (let attempt = 0; attempt < 80; attempt++) {
        try { if ((await fetch(base)).ok) break; } catch {}
        await new Promise(done => setTimeout(done, 100));
    }
    const reopened = await (await fetch(base + '/__sitefoundry/ad-templates')).json();
    assert.ok(reopened.templates.some(template => template.version === 'v9.9.9'));
    report.checks.push({ name: 'local-template-survives-server-restart' });
    assert.deepEqual(report.errors, []); assert.deepEqual(report.localFailures, []);
    assert.equal(report.externalRequests.filter(url => /fonts\.(googleapis|gstatic)|cdn\.jsdelivr|cdnjs\.cloudflare/.test(url)).length, 0);
    report.status = 'passed';
} catch (error) {
    report.status = 'failed'; report.failure = error.stack;
    for (const context of browser.contexts()) for (const page of context.pages()) await page.screenshot({ path: resolve(output, 'failure-' + Date.now() + '.png') }).catch(() => {});
    throw error;
} finally {
    await writeFile(resolve(output, 'results.json'), JSON.stringify(report, null, 2));
    await writeFile(resolve(output, 'server.log'), serverLog);
    await browser.close(); child.kill(); await new Promise(done => assets.close(done));
}
console.log(JSON.stringify(report, null, 2));
