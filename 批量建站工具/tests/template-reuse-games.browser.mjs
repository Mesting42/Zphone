/** End-to-end acceptance for game template reuse. Third-party requests are
 * controlled; real local gameplay and the exported ZIP are tested separately. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import JSZip from 'jszip';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || 'C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const origin = process.env.BUILDER_URL || 'http://127.0.0.1:5192/';
const archive = process.env.REUSE_ARCHIVE || 'C:/Users/zyt/Downloads/wdg97b.vibory.pro_zJFzC.tar.gz';
const output = resolve('coverage/template-reuse-games');
await mkdir(output, { recursive: true });
const cover = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ioAAAAASUVORK5CYII=';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
const errors = [], sources = [];
let exportServer;
try {
    await context.route('**/*', route => {
        const url = route.request().url();
        if (/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/.test(url) || !/^https?:/.test(url)) return route.continue();
        if (/\.(?:jpg|png|webp)(?:\?|$)/i.test(url)) return route.fulfill({ contentType: 'image/png', body: Buffer.from(cover, 'base64') });
        return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-build-mode="ad-template-reuse"]').click();
    await page.locator('#restoration-sites-input').setInputFiles(archive);
    await page.waitForFunction(() => document.getElementById('restoration-scan-progress-text').textContent.includes('已识别 1 个站点'));
    // Use the existing store and persist a catalog in this isolated browser
    // context. Nothing is written into the user's actual browser profile.
    const savedId = await page.evaluate(async cover => {
        const reader = await import('/js/game-catalog-source.js');
        await reader.listGameCatalogs();
        const image = new Blob([Uint8Array.from(atob(cover), c => c.charCodeAt(0))], { type: 'image/png' });
        const record = await SavedGameCatalogs.save({ name: 'QA saved games', data: [{ title: 'Saved playable puzzle', description: 'Press the button to score.', url: 'games/puzzle/index.html', thumb: 'cover.png', category: 'Puzzle' }],
            localImages: { 'cover.png': image }, localGameFiles: {
                'puzzle/index.html': '<html><head><link rel="stylesheet" href="style.css"></head><body><button id="play">Score 0</button><script src="game.js"></script></body></html>',
                'puzzle/game.js': 'let score=Number(localStorage.getItem("score")||0);document.getElementById("play").onclick=()=>{localStorage.setItem("score",++score);document.getElementById("play").textContent="Score "+score;};',
                'puzzle/style.css': 'button{background:rgb(20,80,140);color:white;padding:24px;}' }, sourceNotice: { license: 'MIT', licenseText: 'QA fixture license', repository: 'https://example.com/fixture' } });
        return record.id;
    }, cover);
    await page.locator('#template-reuse-content-input').setInputFiles({ name: 'article.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([{ title: 'Retained article selection', content: 'Retained article prose', image: 'data:image/png;base64,' + cover }])) });
    await page.waitForFunction(() => document.getElementById('template-reuse-result').textContent.includes('已读取 1 项内容'));
    await page.locator('#template-reuse-site-type').selectOption('games');
    const waitItems = async count => {
        await page.waitForFunction(count => { const node = document.getElementById('template-reuse-result'); return node.textContent.includes('已读取 ' + count + ' 项内容') || node.classList.contains('error'); }, count, { timeout: 60000 });
        assert.ok((await page.locator('#template-reuse-result').textContent()).includes('已读取 ' + count + ' 项内容'), await page.locator('#template-reuse-result').textContent());
    };
    await waitItems(83);
    assert.equal(await page.locator('#template-reuse-article-source').isVisible(), false);
    const choices = await page.locator('#template-reuse-game-catalog option').evaluateAll(options => options.map(option => option.value));
    assert.equal(choices.length, 8);
    assert.ok(choices.includes('saved:' + savedId));
    for (const id of ['builtin', 'builtin-source-1', 'builtin-source-2', 'builtin-source-3', 'builtin-source-4', 'builtin-source-5', 'opensource', 'saved:' + savedId]) {
        await page.locator('#template-reuse-game-catalog').selectOption(id);
        const count = id === 'builtin' ? 83 : id === 'opensource' ? 72 : id.startsWith('saved:') ? 1 : 84;
        await waitItems(count);
        sources.push({ id, count });
        console.log('CATALOG', id, count);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#template-reuse-game-source').scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(output, 'source-mobile.png') });
    const overflow = await page.locator('#template-reuse-source').evaluate(node => node.scrollWidth > node.clientWidth + 2);
    assert.equal(overflow, false, 'Source controls must fit on mobile');
    await page.setViewportSize({ width: 1500, height: 1000 });
    // A failed directory read blocks export and can be recovered with retry.
    await page.route('**/game-source-5.zip', route => route.fulfill({ status: 503, body: 'QA temporary failure' }));
    await page.locator('#template-reuse-game-catalog').selectOption('builtin-source-5');
    await page.waitForFunction(() => document.getElementById('template-reuse-result').textContent.includes('HTTP 503'));
    await page.unroute('**/game-source-5.zip');
    await page.locator('#template-reuse-game-retry').click();
    await waitItems(84);
    // Switching while a catalog read is pending must retain the article source.
    await page.route('**/game-source-4.zip', async route => { await new Promise(done => setTimeout(done, 800)); await route.continue(); });
    await page.locator('#template-reuse-game-catalog').selectOption('builtin-source-4');
    await page.locator('#template-reuse-site-type').selectOption('editorial');
    await page.waitForTimeout(1100);
    await waitItems(1);
    assert.ok((await page.locator('#template-reuse-result').textContent()).includes('article.json'));
    await page.unroute('**/game-source-4.zip');
    await page.locator('#template-reuse-site-type').selectOption('games');
    await waitItems(84);
    await page.locator('#template-reuse-game-catalog').selectOption('opensource');
    await waitItems(72);
    await page.locator('#btn-next').click();
    const frame = page.frameLocator('#preview-frame');
    await frame.locator('.item-card').first().waitFor();
    assert.equal(await frame.locator('.item-card').count(), 72);
    await frame.locator('.item-card').filter({ hasText: 'Ball Arena' }).first().click();
    await frame.locator('.detail-title').waitFor();
    const player = frame.frameLocator('iframe');
    // The template reveals content on intersection. Scroll the player into the
    // preview viewport before interacting with a control inside its child frame.
    await frame.locator('iframe').scrollIntoViewIfNeeded();
    await player.locator('canvas').first().waitFor();
    const musicBefore = await player.locator('#musicLobbyBtn').textContent();
    await player.locator('#musicLobbyBtn').click();
    assert.notEqual(await player.locator('#musicLobbyBtn').textContent(), musicBefore, 'Real bundled game controls must initialize');
    assert.equal(await frame.locator('[id^="div-gpt-ad-banner"]').count(), 3);
    await frame.locator('iframe').scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(output, 'opensource-game-detail.png') });
    // Also export the actual 72-game catalog, not only the tiny saved fixture.
    await page.locator('#btn-next').click();
    const openSourceDownloading = page.waitForEvent('download', { timeout: 120000 });
    await page.locator('#restoration-run-zip').click();
    const openSourceDownload = await openSourceDownloading;
    const openSourceDestination = resolve(output, openSourceDownload.suggestedFilename());
    await openSourceDownload.saveAs(openSourceDestination);
    const openSourceZip = await JSZip.loadAsync(await readFile(openSourceDestination));
    const openSourcePaths = Object.keys(openSourceZip.files);
    assert.equal(openSourcePaths.filter(path => /\/details\/[^/]+\.html$/.test(path)).length, 72);
    assert.equal(openSourcePaths.filter(path => /\/template-reuse-games\/[^/]+\.html$/.test(path)).length, 72);
    const licensePath = openSourcePaths.find(path => /template-reuse-games\/LICENSE.txt$/.test(path));
    assert.match(await openSourceZip.file(licensePath).async('string'), /MIT License/);
    await page.locator('#btn-prev').click();
    // The source controls stay in step 1. Return, select the saved local fixture,
    // then exercise its actual nested script and style in preview and export.
    await page.locator('#btn-prev').click();
    await page.locator('#template-reuse-game-catalog').selectOption('saved:' + savedId);
    await waitItems(1);
    await page.locator('#btn-next').click();
    await page.locator('.preview-tab[data-page="home"]').click();
    await frame.locator('.item-card').first().waitFor();
    assert.equal(await frame.locator('.item-card').count(), 1);
    await page.locator('[data-template-theme="minimal"]').click();
    await frame.locator('.item-card').first().click();
    await frame.locator('.detail-title').waitFor();
    await player.locator('#play').click();
    assert.equal(await player.locator('#play').textContent(), 'Score 1');
    assert.equal(await player.locator('#play').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(20, 80, 140)');
    assert.equal(await frame.locator('[id^="div-gpt-ad-banner"]').count(), 3);
    await frame.locator('iframe').scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(output, 'saved-game-preview.png') });
    await page.locator('#btn-next').click();
    const downloading = page.waitForEvent('download', { timeout: 120000 });
    await page.locator('#restoration-run-zip').click();
    const download = await downloading;
    const destination = resolve(output, download.suggestedFilename());
    await download.saveAs(destination);
    const zip = await JSZip.loadAsync(await readFile(destination));
    const paths = Object.keys(zip.files).filter(path => !zip.files[path].dir);
    const home = paths.find(path => /\/index.html$/.test(path) && !path.includes('/assets/'));
    assert.ok(home);
    const root = home.replace(/index.html$/, '');
    const detail = paths.find(path => path.startsWith(root + 'details/') && /\.html$/.test(path));
    assert.ok(paths.some(path => /template-reuse-games\/puzzle\/game.js$/.test(path)));
    assert.ok(paths.some(path => /template-reuse-games\/LICENSE.txt$/.test(path)));
    const originalResources = await page.evaluate(async () => {
        const file = document.getElementById('restoration-sites-input').files[0];
        const entries = await AdRestoration.readArchiveEntries(file);
        return entries.filter(entry => /(?:\.css|\/js\/ad\.js)$/.test(entry.path)).map(entry => ({ path: entry.path, text: new TextDecoder().decode(entry.bytes) }));
    });
    const exportedAds = await zip.file(paths.find(path => /\/js\/ad.js$/.test(path))).async('string');
    const originalAds = originalResources.find(entry => /\/js\/ad\.js$/.test(entry.path)).text;
    for (const unit of originalAds.match(/\/\d+\/[^"'\s;]+/g) || []) assert.ok(exportedAds.includes(unit), 'Keep original ad unit paths');
    for (const resource of originalResources.filter(entry => /\.css$/.test(entry.path))) {
        const relative = resource.path.slice(resource.path.indexOf('/') + 1);
        assert.equal(await zip.file(root + relative).async('string'), resource.text, 'Retain source stylesheet');
    }
    exportServer = createServer(async (request, response) => {
        const path = root + decodeURIComponent(new URL(request.url, 'http://local').pathname).replace(/^\//, '');
        const file = zip.file(path);
        if (!file) return response.writeHead(404).end();
        const type = /\.html$/.test(path) ? 'text/html' : /\.js$/.test(path) ? 'text/javascript' : /\.css$/.test(path) ? 'text/css' : /\.png$/.test(path) ? 'image/png' : 'application/octet-stream';
        response.setHeader('Content-Type', type); response.end(await file.async('nodebuffer'));
    });
    await new Promise(done => exportServer.listen(0, '127.0.0.1', done));
    const exported = await context.newPage();
    await exported.goto('http://127.0.0.1:' + exportServer.address().port + '/' + detail.slice(root.length), { waitUntil: 'load' });
    const exportedPlayer = exported.frameLocator('iframe');
    await exportedPlayer.locator('#play').click();
    assert.equal(await exportedPlayer.locator('#play').textContent(), 'Score 1');
    assert.equal(await exported.locator('.detail-hero-image').evaluate(img => img.complete && img.naturalWidth > 0), true);
    await exported.screenshot({ path: resolve(output, 'exported-game.png') });
    // The original game-building page still uses the shared readers successfully.
    const gamePage = await context.newPage();
    gamePage.on('pageerror', error => errors.push(error.message));
    await gamePage.goto(new URL('game-builder/', origin).href, { waitUntil: 'domcontentloaded' });
    await gamePage.waitForFunction(() => !document.getElementById('source-fingerprint').textContent.includes('等待加载'));
    await gamePage.locator('#game-source').selectOption('builtin-source-1');
    await gamePage.waitForFunction(() => document.getElementById('source-status').textContent.includes('84'));
    await gamePage.locator('#game-source').selectOption('saved:' + savedId);
    await gamePage.waitForFunction(() => document.getElementById('source-status').textContent.includes('1 个游戏'));
    assert.deepEqual(errors, []);
    const report = { passed: true, template: archive, sources, savedPreviewPlayable: true, exportPlayable: true,
        originalGameWorkflow: true, openSourceExport: { zip: openSourceDestination, details: 72, localGames: 72, mitLicense: true },
        zip: destination, screenshots: ['source-mobile.png', 'opensource-game-detail.png', 'saved-game-preview.png', 'exported-game.png'], remoteGames: 'Remote endpoints controlled, not verified online' };
    await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
} finally { if (exportServer) await new Promise(done => exportServer.close(done)); await browser.close(); }
