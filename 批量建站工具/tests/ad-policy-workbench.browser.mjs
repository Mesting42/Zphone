/** 真实导出站点的策略工作台回归；只读取 fixtures，不修改用户原始包。 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import JSZip from 'jszip';
import { createServer } from 'node:http';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const hosts = ['zpau108a.synvexia.top', 'zpau108a.zentropy.top', 'zpau108b.synvexia.top'];
const source = resolve(process.env.POLICY_FIXTURES || 'coverage/ad-page-isolation');
const output = resolve('coverage/ad-policy-workbench');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const results = { errors: [], previews: [] };
let exportedServer;
page.on('pageerror', error => results.errors.push(error.message));
page.setDefaultTimeout(30000);
async function refresh(action) {
    const old = await page.locator('#preview-frame').getAttribute('srcdoc');
    await action();
    await page.waitForFunction(old => { const frame = document.getElementById('preview-frame'); return frame.srcdoc !== old && !frame.hasAttribute('data-refreshing'); }, old);
}
const frame = () => page.frameLocator('#preview-frame');
async function inspect() {
    await frame().locator('#adv2').waitFor();
    await page.waitForTimeout(200);
    return frame().locator('body').evaluate(async body => {
        const imageChecks = await Promise.all([...body.querySelectorAll('img')].map(img => new Promise(resolveImage => {
            const probe = new Image(); probe.onload = () => resolveImage(true); probe.onerror = () => resolveImage(false);
            probe.src = img.src;
        })));
        const ad = body.querySelector('#adv2'), rect = ad.getBoundingClientRect();
        const cards = [...body.querySelectorAll('.item-card')];
        return { images: body.querySelectorAll('img').length, broken: imageChecks.filter(loaded => !loaded).length,
            ads: body.querySelectorAll('[id^="div-gpt-ad-banner"]').length, cards: cards.length,
            middle: !!ad.closest('[data-sitefoundry-middle-ad]'), centered: Math.abs(rect.left + rect.width / 2 - body.ownerDocument.documentElement.clientWidth / 2) < 2,
            before: cards.filter(card => card.compareDocumentPosition(ad) & 4).length, after: cards.filter(card => ad.compareDocumentPosition(card) & 4).length };
    });
}
try {
    await page.goto(process.env.BUILDER_URL || 'http://127.0.0.1:5174/', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-build-mode="ad-restoration"]').click();
    await page.locator('#restoration-sites-input').setInputFiles(hosts.map(host => join(source, host + '.zip')));
    await page.waitForFunction(() => document.getElementById('restoration-scan-progress-text').textContent.includes('已识别 3 个站点'));
    assert.equal(await page.locator('.step-item:visible').count(), 3);
    await page.locator('#btn-next').click();
    await page.locator('#ad-policy-config-panel').waitFor({ state: 'visible' });
    await frame().locator('#adv2').waitFor();
    console.log('Imported three sites and entered configuration');
    results.home = await inspect(); assert.equal(results.home.broken, 0); assert.equal(results.home.ads, 3);
    // 旧包存在策略清单时先切回全局方案，验证三页互不串位置。
    if (await page.locator('#ad-policy-active-override').isChecked()) await refresh(() => page.locator('#ad-policy-active-override').uncheck());
    // 原位置预设会保留三站各自的旧设置；本场景显式选统一中段以验证全局编辑。
    await refresh(() => page.locator('#ad-policy-global-editor [data-policy-field="slots.all.1.position"]').selectOption('content-middle'));
    await refresh(() => page.locator('#ad-policy-global-editor [data-policy-field="slots.detail.1.position"]').selectOption('detail-before-content'));
    await refresh(() => page.locator('.preview-tab[data-page="all"]').click());
    for (let index = 0; index < 3; index++) {
        const values = await page.locator('#ad-policy-preview-site option').evaluateAll(options => options.map(option => option.value));
        if (index) {
            await refresh(() => page.locator('#ad-policy-preview-site').selectOption(values[index]));
            if (await page.locator('#ad-policy-active-override').isChecked()) await refresh(() => page.locator('#ad-policy-active-override').uncheck());
            await refresh(() => page.locator('.preview-tab[data-page="all"]').click());
        }
        const stats = await inspect(); results.previews.push(stats);
        assert.equal(stats.broken, 0); assert.equal(stats.ads, 3); assert.ok(stats.middle && stats.centered && stats.before > 0 && stats.after > 0);
    }
    await page.locator('.size-btn[data-size="mobile"]').click();
    assert.ok((await inspect()).centered);
    await page.locator('.size-btn[data-size="desktop"]').click();
    await refresh(() => page.locator('.preview-tab[data-page="detail"]').click());
    assert.equal((await inspect()).broken, 0);
    // 原站正文与首页链接应留在工具内导航，保留站点页面选择。
    await refresh(() => frame().locator('a[href$="index.html"]').first().click());
    assert.equal(await page.locator('#ad-policy-preview-page').inputValue(), 'index.html');
    await refresh(() => page.locator('.preview-tab[data-page="all"]').click());
    await page.screenshot({ path: join(output, 'configuration.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(output, 'configuration-mobile.png'), fullPage: true });
    if (!(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2))) console.log(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(node => { const r = node.getBoundingClientRect(); return r.right > innerWidth + 2 && r.width > 0; }).map(node => ({ id: node.id, class: node.className, width: node.getBoundingClientRect().width, right: node.getBoundingClientRect().right })).slice(-10)));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Configuration should not overflow a narrow viewport');
    await page.setViewportSize({ width: 1600, height: 1000 });
    // 错站 TXT 必须拒绝；正确域名的替换必须只属于当前站。
    await page.locator('#ad-policy-code-file').setInputFiles({ name: hosts[0] + '.txt', mimeType: 'text/plain', buffer: Buffer.from(await readFile(join(process.env.AD_DIR || 'C:/Users/zyt/Desktop', hosts[0] + '.txt'))) });
    await page.locator('#notice-overlay').waitFor({ state: 'visible' });
    assert.match(await page.locator('#notice-message').innerText(), /不匹配/);
    await page.locator('#notice-confirm').click();
    const originalCode = await readFile(join(process.env.AD_DIR || 'C:/Users/zyt/Desktop', hosts[2] + '.txt'), 'utf8');
    await refresh(() => page.locator('#ad-policy-code-file').setInputFiles({ name: hosts[2] + '.txt', mimeType: 'text/plain', buffer: Buffer.from(originalCode.replace(/\/\d+\//g, '/29999999999/')) }));
    assert.match(await page.locator('#ad-policy-code-status').innerText(), /已替换/);
    // 单站开关、单元映射和恢复。
    await refresh(() => page.locator('#ad-policy-active-override').check());
    const active = '#ad-policy-site-list [data-site-policy-index]';
    await refresh(() => page.locator(active + ' [data-policy-field="slots.home.0.unit"]').selectOption('banner3'));
    assert.equal(await page.locator(active + ' [data-policy-field="slots.home.2.unit"]').inputValue(), 'off');
    await refresh(() => page.locator(active + ' [data-policy-field="slots.home.0.unit"]').selectOption('banner1'));
    await refresh(() => page.locator(active + ' [data-policy-field="slots.home.2.unit"]').selectOption('banner3'));
    await refresh(() => page.locator(active + ' [data-policy-field="outOfPage.anchor.all"]').uncheck());
    // 预览中的任意内容路径只改变本页、本站。
    await page.locator('[name="ad-policy-placement-mode"][value="manual"]').check();
    await refresh(() => page.locator('[data-policy-place-slot="1"]').click());
    await frame().locator('.sf-policy-place').first().waitFor();
    await refresh(() => frame().locator('.sf-policy-place').first().click());
    assert.match(await page.locator(active + ' [data-policy-field="slots.all.1.position"]').inputValue(), /^custom-after-/);
    await refresh(() => page.locator(active + ' [data-policy-field="slots.all.1.position"]').selectOption('content-middle'));
    await page.locator('#btn-next').click();
    await page.locator('#ad-policy-export-panel').waitFor({ state: 'visible' });
    const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
    await page.locator('#restoration-run-zip').click();
    const download = await downloadPromise;
    const destination = join(output, download.suggestedFilename()); await download.saveAs(destination);
    const zip = await JSZip.loadAsync(await readFile(destination));
    const policies = Object.keys(zip.files).filter(path => /ad-policy\.json$/.test(path)); assert.equal(policies.length, 3);
    results.exports = [];
    for (const path of policies) {
        const manifest = JSON.parse(await zip.file(path).async('string'));
        results.exports.push({ host: manifest.host, policy: manifest.policy });
        assert.equal(manifest.policy.slots.detail[1].position, 'detail-before-content');
        assert.equal(manifest.policy.slots.all[1].position, 'content-middle');
        if (manifest.host === hosts[2]) { assert.match(manifest.adPaths.bannerPath1, /^\/29999999999\//); assert.equal(manifest.policy.outOfPage.anchor.all, false); }
        else assert.doesNotMatch(manifest.adPaths.bannerPath1, /^\/29999999999\//);
    }
    // 重开真正导出的静态副本，检查模板运行时、页面广告与完整图片。
    const payloads = new Map();
    for (const [path, file] of Object.entries(zip.files)) if (!file.dir) payloads.set(path, await file.async('nodebuffer'));
    let servingRoot = '';
    const mime = path => /\.js$/i.test(path) ? 'text/javascript' : /\.css$/i.test(path) ? 'text/css' : /\.webp$/i.test(path) ? 'image/webp' : /\.png$/i.test(path) ? 'image/png' : /\.jpe?g$/i.test(path) ? 'image/jpeg' : 'text/html';
    exportedServer = createServer((request, response) => {
        const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\//, '') || 'index.html';
        const data = payloads.get(servingRoot + path);
        response.writeHead(data ? 200 : 404, { 'Content-Type': mime(path) }); response.end(data || 'Missing');
    });
    await new Promise(resolveServer => exportedServer.listen(0, '127.0.0.1', resolveServer));
    const exportedPage = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    exportedPage.on('pageerror', error => results.errors.push(error.message));
    await exportedPage.route(/googletag|google-analytics|googlesyndication|doubleclick/, route => route.fulfill({ status: 200, body: '', contentType: 'text/javascript' }));
    await exportedPage.addInitScript(() => {
        window.__adCalls = [];
        const slot = { addService() { return this; }, setConfig() {} };
        window.googletag = { cmd: { push: callback => callback() }, setConfig() {}, defineSlot: (path, size, id) => { window.__adCalls.push({ path, id }); return slot; }, pubads: () => ({}), defineOutOfPageSlot: (path, format) => { window.__adCalls.push({ path, format }); return slot; }, enums: { OutOfPageFormat: { INTERSTITIAL: 'INT', BOTTOM_ANCHOR: 'ANC' } }, enableServices() {}, display() {} };
        window.gtag = () => {};
    });
    results.reopened = [];
    for (const manifestPath of policies) {
        servingRoot = manifestPath.replace(/ad-policy\.json$/, '');
        const manifest = JSON.parse(payloads.get(manifestPath).toString());
        const original = await JSZip.loadAsync(await readFile(join(source, manifest.host + '.zip')));
        const originalRoot = Object.keys(original.files).filter(path => /(?:^|\/)index\.html$/.test(path)).sort((a, b) => a.length - b.length)[0].replace(/index\.html$/, '');
        for (const [originalPath, file] of Object.entries(original.files)) {
            if (file.dir || /\.(?:html?|js|css|json|txt)$/i.test(originalPath)) continue;
            const actual = payloads.get(servingRoot + originalPath.slice(originalRoot.length));
            assert.ok(actual && actual.equals(await file.async('nodebuffer')), 'Binary resource changed: ' + originalPath);
        }
        const detailPath = [...payloads.keys()].find(path => path.startsWith(servingRoot + 'details/') && /\.html$/.test(path)).slice(servingRoot.length);
        for (const route of ['index.html', detailPath, 'all-articles.html']) {
            await exportedPage.goto('http://127.0.0.1:' + exportedServer.address().port + '/' + route, { waitUntil: 'networkidle' });
            const check = await exportedPage.evaluate(() => ({ calls: window.__adCalls, ads: document.querySelectorAll('[id^="div-gpt-ad-banner"]').length, broken: [...document.images].filter(img => img.complete && !img.naturalWidth).length }));
            assert.equal(check.ads, 3); assert.equal(check.broken, 0);
            assert.equal(check.calls.filter(call => call.id).length, 3);
            const anchorEnabled = !(manifest.host === hosts[2] && route === 'all-articles.html');
            assert.equal(check.calls.some(call => call.format === 'ANC'), anchorEnabled);
            assert.equal(check.calls.some(call => call.format === 'INT'), route === 'index.html');
            results.reopened.push({ host: manifest.host, route, ...check });
        }
    }
    await exportedPage.close();
    // 广告代码单独导出、返回配置、恢复原代码，重复导入保留策略。
    const codeDownloadPromise = page.waitForEvent('download');
    await page.locator('#restoration-export-code').click();
    const codeDownload = await codeDownloadPromise;
    await codeDownload.saveAs(join(output, codeDownload.suggestedFilename()));
    await page.locator('#btn-prev').click();
    await refresh(() => page.locator('#ad-policy-code-restore').click());
    assert.match(await page.locator('#ad-policy-code-status').innerText(), /使用原站/);
    await page.locator('#btn-prev').click();
    await page.locator('#restoration-sites-input').setInputFiles(destination);
    await page.waitForFunction(() => document.querySelector('#restoration-scan-progress-text').textContent.includes('已识别 3 个站点'));
    await page.locator('#btn-next').click();
    await frame().locator('#adv2').waitFor();
    assert.equal(await page.locator('#ad-policy-active-override').isChecked(), true);
    assert.equal(await page.locator(active + ' [data-policy-field="slots.detail.1.position"]').inputValue(), 'detail-before-content');
    assert.equal(results.errors.length, 0, results.errors.join('\n'));
    console.log('Configuration, three-page isolation, TXT matching, manual placement and real ZIP export passed');
} catch (error) {
    await page.screenshot({ path: join(output, 'failure.png') });
    await writeFile(join(output, 'failure.txt'), await page.locator('body').innerText());
    throw error;
} finally { if (exportedServer) await new Promise(done => exportedServer.close(done)); await writeFile(join(output, 'results.json'), JSON.stringify(results, null, 2)); await browser.close(); }
