/** 原位置恢复与窄配置栏回归：读取真实三站，变体与下载仅写 coverage。 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import JSZip from 'jszip';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const hosts = ['zpau108a.synvexia.top', 'zpau108a.zentropy.top', 'zpau108b.synvexia.top'];
const output = resolve('coverage/ad-policy-original-positions');
// 与实际入口的资源版本比较，后续功能升级缓存标记时仍验证最新样式确实加载。
const stylesheetVersion = (await readFile(resolve('index.html'), 'utf8')).match(/css\/tool\.css\?v=([^"]+)/)[1];
await mkdir(output, { recursive: true });
const choices = [
    ['content-top', 'detail-before-content', 'content-middle'],
    ['content-middle', 'detail-between-p-1', 'content-top'],
    ['footer-top', 'detail-between-p-3', 'content-bottom']
];
const inputs = [];
for (const [index, host] of hosts.entries()) {
    const zip = await JSZip.loadAsync(await readFile(resolve('coverage/ad-page-isolation', host + '.zip')));
    const manifestPath = Object.keys(zip.files).find(path => /ad-policy\.json$/.test(path)) ||
        Object.keys(zip.files).filter(path => /(?:^|\/)index\.html$/.test(path)).sort((a, b) => a.length - b.length)[0].replace(/index\.html$/, 'ad-policy.json');
    const manifest = zip.file(manifestPath) ? JSON.parse(await zip.file(manifestPath).async('string')) : {
        policy: { version: 2, writeDisabledComments: true, slots: Object.fromEntries(['home', 'detail', 'all'].map(type => [type,
            ['after-navbar', type === 'detail' ? 'detail-middle' : 'content-middle', 'footer-top'].map((position, i) => ({ position, unit: 'banner' + (i + 1) }))])),
            outOfPage: { interstitial: { home: true, detail: false, all: false }, anchor: { home: true, detail: true, all: true } } }
    };
    delete manifest.originalPlacements;
    ['home', 'detail', 'all'].forEach((page, pageIndex) => {
        // 广告位1也采用非默认原位置，防止限流预设的顶部位置污染恢复记录。
        manifest.policy.slots[page][0].position = page === 'home' ? 'content-bottom' : page === 'detail' ? 'detail-before-content' : 'content-top';
        manifest.policy.slots[page][1].position = choices[index][pageIndex];
        manifest.policy.slots[page][1].unit = 'banner2';
    });
    zip.file(manifestPath, JSON.stringify(manifest));
    const path = join(output, host + '.zip');
    await writeFile(path, await zip.generateAsync({ type: 'nodebuffer' }));
    inputs.push(path);
}
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const results = { errors: [], layouts: [], baselines: [], restored: [], limitedReimported: [], afterOverrideReset: [], reimported: [] };
page.on('pageerror', error => results.errors.push(error.message));
page.setDefaultTimeout(30000);
const frame = () => page.frameLocator('#preview-frame');
async function refresh(action) {
    const old = await page.locator('#preview-frame').getAttribute('srcdoc');
    await action();
    await page.waitForFunction(old => {
        const iframe = document.getElementById('preview-frame');
        return iframe.srcdoc !== old && !iframe.hasAttribute('data-refreshing');
    }, old);
}
async function importSites(files) {
    await page.locator('#restoration-sites-input').setInputFiles(files);
    await page.waitForFunction(() => document.getElementById('restoration-scan-progress-text').textContent.includes('已识别 3 个站点'));
    await page.locator('#btn-next').click();
    await page.locator('#ad-policy-config-panel').waitFor({ state: 'visible' });
    await frame().locator('#adv2').waitFor();
}
async function inspect() {
    await frame().locator('#adv2').waitFor();
    await page.waitForTimeout(120);
    return frame().locator('body').evaluate(body => {
        const ad = body.querySelector('#adv2'), rect = ad.getBoundingClientRect();
        const content = [...body.querySelectorAll('.item-card, .detail-content p')].filter(node => !node.closest('[id^="adv"]'));
        return { before: content.filter(node => node.compareDocumentPosition(ad) & 4).length,
            after: content.filter(node => ad.compareDocumentPosition(node) & 4).length,
            ads: body.querySelectorAll('[id^="div-gpt-ad-banner"]').length,
            centered: Math.abs(rect.left + rect.width / 2 - body.ownerDocument.documentElement.clientWidth / 2) < 2,
            allBanners: [1, 2, 3].map(number => {
                const banner = body.querySelector('#adv' + number);
                const box = banner.getBoundingClientRect();
                return { before: content.filter(node => node.compareDocumentPosition(banner) & 4).length,
                    after: content.filter(node => banner.compareDocumentPosition(node) & 4).length,
                    centered: Math.abs(box.left + box.width / 2 - body.ownerDocument.documentElement.clientWidth / 2) < 2 };
            }) };
    });
}
async function checkAll(destination) {
    const siteIds = await page.locator('#ad-policy-preview-site option').evaluateAll(options => options.map(option => option.value));
    for (const [index, id] of siteIds.entries()) {
        if (await page.locator('#ad-policy-preview-site').inputValue() !== id) await refresh(() => page.locator('#ad-policy-preview-site').selectOption(id));
        for (const type of ['home', 'detail', 'all']) {
            await refresh(() => page.locator('.preview-tab[data-page="' + type + '"]').click());
            const check = { host: hosts[index], type, ...await inspect() };
            assert.equal(check.ads, 3); assert.ok(check.centered);
            assert.ok(check.allBanners.every(banner => banner.centered), 'Every banner must be centered across the complete page');
            destination.push(check);
        }
    }
}
async function layout(width) {
    await page.setViewportSize({ width, height: 1000 });
    const stats = await page.locator('#ad-policy-config-panel').evaluate((panel, stylesheetVersion) => {
        const visible = node => node.getBoundingClientRect().width > 0;
        const cards = [...panel.querySelectorAll('.ad-policy-page-card')].filter(visible).map(node => node.getBoundingClientRect());
        const controls = [...panel.querySelectorAll('select, button, .ad-policy-toolbar > div')].filter(visible);
        return { pageOverflow: document.documentElement.scrollWidth > innerWidth + 2,
            overflowing: controls.filter(node => node.getBoundingClientRect().right > panel.getBoundingClientRect().right + 1).map(node => node.id || node.className),
            cardColumns: new Set(cards.map(rect => Math.round(rect.left))).size,
            toolbarDirection: getComputedStyle(panel.querySelector('.ad-policy-toolbar')).flexDirection,
            toolbarHeight: panel.querySelector('.ad-policy-toolbar').getBoundingClientRect().height,
            stylesheet: [...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href.includes('css/tool.css?v=' + stylesheetVersion) && link.sheet && link.sheet.cssRules.length > 0) };
    }, stylesheetVersion);
    assert.equal(stats.pageOverflow, false); assert.deepEqual(stats.overflowing, []);
    assert.equal(stats.cardColumns, 1); assert.equal(stats.toolbarDirection, 'column');
    assert.ok(stats.toolbarHeight < 450 && stats.stylesheet);
    results.layouts.push({ width, ...stats });
}
async function downloadZip(name) {
    await page.locator('#btn-next').click();
    const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
    await page.locator('#restoration-run-zip').click();
    const download = await downloadPromise;
    const path = join(output, name); await download.saveAs(path);
    return path;
}
try {
    await page.goto(process.env.BUILDER_URL || 'http://127.0.0.1:5174/', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-build-mode="ad-restoration"]').click();
    await importSites(inputs);
    await layout(1600); await layout(1920); await layout(390); await page.setViewportSize({ width: 1600, height: 1000 });
    await checkAll(results.baselines);
    // 限流再恢复，单站覆盖中的不同原位置也必须保留。
    await refresh(() => page.locator('#ad-policy-preset').selectOption('traffic-limit'));
    await refresh(() => page.locator('#ad-policy-preset').selectOption('restore'));
    assert.equal(await page.locator('#ad-policy-active-override').isChecked(), false);
    await checkAll(results.restored);
    assert.deepEqual(results.restored, results.baselines);
    await page.locator('#ad-policy-preset').scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(output, 'configuration-restored.png') });
    await page.locator('#ad-policy-global-editor [data-policy-page="detail"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(output, 'position-controls.png') });
    // 临时限流布局也必须保留进入预设之前的位置，而不是把顶部的新位置当作原位置。
    await refresh(() => page.locator('#ad-policy-preset').selectOption('traffic-limit'));
    await refresh(() => page.locator('#ad-policy-active-override').check());
    const activeEditor = '#ad-policy-site-list [data-site-policy-index]';
    // 只修改第三站的详情广告2；另外两站和广告1的原位置均应保留。
    await refresh(() => page.locator(activeEditor + ' [data-policy-field="slots.detail.1.position"]').selectOption('detail-between-p-2'));
    const limitedZip = await downloadZip('limited-sites.zip');
    await page.locator('#btn-prev').click(); await page.locator('#btn-prev').click();
    await page.locator('#restoration-sites-input').setInputFiles(limitedZip);
    await page.waitForFunction(() => document.getElementById('restoration-scan-progress-text').textContent.includes('已识别 3 个站点'));
    await page.locator('#btn-next').click();
    await page.locator('#ad-policy-config-panel').waitFor({ state: 'visible' });
    await refresh(() => page.locator('#ad-policy-preset').selectOption('restore'));
    await checkAll(results.limitedReimported);
    const editedBaseline = structuredClone(results.baselines);
    const edited = editedBaseline.find(item => item.host === hosts[2] && item.type === 'detail');
    const paragraphs = edited.before + edited.after;
    edited.before = 2; edited.after = paragraphs - 2;
    edited.allBanners[1].before = 2; edited.allBanners[1].after = paragraphs - 2;
    assert.deepEqual(results.limitedReimported, editedBaseline);
    // 恢复原测试位置后再导出全关闭副本，单站编辑与全局恢复仍应兼容。
    await refresh(() => page.locator('#ad-policy-active-override').check());
    await refresh(() => page.locator(activeEditor + ' [data-policy-field="slots.detail.1.position"]').selectOption('detail-between-p-3'));
    await refresh(() => page.locator('#ad-policy-active-override').uncheck());
    await checkAll(results.afterOverrideReset);
    assert.deepEqual(results.afterOverrideReset, results.baselines);
    // 全部关闭仍保留每个站点的位置记录，实际下载后重新导入。
    for (const type of ['home', 'detail', 'all']) for (let index = 0; index < 3; index++) {
        await refresh(() => page.locator('#ad-policy-global-editor [data-policy-field="slots.' + type + '.' + index + '.unit"]').selectOption('off'));
    }
    const closedZip = await downloadZip('closed-sites.zip');
    const closed = await JSZip.loadAsync(await readFile(closedZip));
    for (const [path, file] of Object.entries(closed.files)) if (/ad-policy\.json$/.test(path)) {
        const manifest = JSON.parse(await file.async('string'));
        assert.ok(manifest.originalPlacements);
        for (const slots of Object.values(manifest.policy.slots)) assert.ok(slots.every(slot => slot.unit === 'off'));
    }
    await page.locator('#btn-prev').click(); await page.locator('#btn-prev').click();
    // 关闭包预览没有 adv2，直接进入后选择恢复再等待容器。
    await page.locator('#restoration-sites-input').setInputFiles(closedZip);
    await page.waitForFunction(() => document.getElementById('restoration-scan-progress-text').textContent.includes('已识别 3 个站点'));
    await page.locator('#btn-next').click();
    await page.locator('#ad-policy-config-panel').waitFor({ state: 'visible' });
    await refresh(() => page.locator('#ad-policy-preset').selectOption('restore'));
    await checkAll(results.reimported);
    assert.deepEqual(results.reimported, results.baselines);
    const restoredZip = await downloadZip('restored-sites.zip');
    const restored = await JSZip.loadAsync(await readFile(restoredZip));
    for (const [path, file] of Object.entries(restored.files)) if (/ad-policy\.json$/.test(path)) {
        const manifest = JSON.parse(await file.async('string'));
        const index = hosts.indexOf(manifest.host);
        assert.ok(index >= 0);
        assert.deepEqual(['home', 'detail', 'all'].map(type => manifest.policy.slots[type][1].position), choices[index]);
    }
    assert.deepEqual(results.errors, []);
    console.log('Layout at 1600/1920/390, three-site original positions, close/export/reimport/restore passed');
} catch (error) {
    await page.screenshot({ path: join(output, 'failure.png') });
    await writeFile(join(output, 'failure.txt'), await page.locator('body').innerText());
    throw error;
} finally {
    await writeFile(join(output, 'results.json'), JSON.stringify(results, null, 2));
    await browser.close();
}
