/** Real legacy workbench choices, rendered line limits, and reopened ZIPs.
 * Local fixture text/images avoid making summary checks depend on game hosts. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createServer } from 'node:http';
import JSZip from 'jszip';
import { interceptAdsOnly, waitPreviewChange } from './workbench-browser-helpers.mjs';

const { chromium } = createRequire(import.meta.url)('C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = resolve('coverage/legacy-game-summary-20261022');
await mkdir(output, { recursive: true });
const report = { checks: [], errors: [] };
let files = new Map();
const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://local').pathname).slice(1);
    if (path === 'fixture.svg') {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.end('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180"><path fill="teal" d="M0 0h300v180H0z"/></svg>'); return;
    }
    if (!files.has(path)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' })[extname(path)] || 'application/octet-stream');
    res.end(files.get(path));
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true });
page.setDefaultTimeout(30000);
page.on('pageerror', error => report.errors.push(error.message));

async function choose(id, value) {
    const trigger = page.locator('#' + id).locator('..').locator('button[aria-haspopup="listbox"]');
    await trigger.scrollIntoViewIfNeeded();
    const menu = await trigger.getAttribute('aria-controls');
    await waitPreviewChange(page, async () => {
        await trigger.click();
        await page.locator('#' + menu + ' [data-value="' + value + '"]').click();
    });
    assert.equal(await page.locator('#' + id).inputValue(), value);
}

async function summaryState(target, value) {
    const actual = await target.locator('.item-card').first().evaluate(card => {
        const node = card.querySelector('.card-desc');
        if (!node) return { present: false };
        const style = getComputedStyle(node);
        const range = document.createRange(); range.selectNodeContents(node);
        const rect = node.getBoundingClientRect();
        const lineHeight = parseFloat(style.lineHeight);
        return { present: true, text: node.textContent, display: style.display, clamp: style.webkitLineClamp,
            height: rect.height, lineHeight, width: rect.width, textHeight: range.getBoundingClientRect().height };
    });
    assert.equal(actual.present, value !== 'none');
    if (value !== 'none') {
        assert.ok(actual.text.includes('Summary fixture'), JSON.stringify(actual));
        assert.notEqual(actual.display, 'none');
        assert.ok(actual.width > 0 && actual.height > 0, JSON.stringify(actual));
        assert.equal(actual.clamp, value === '0' ? 'none' : value);
        if (value !== '0') {
            // Long text must actually occupy the selected lines, rather than
            // merely reporting a correct CSS property on invisible content.
            assert.ok(Math.abs(actual.height - Number(value) * actual.lineHeight) < 2, JSON.stringify(actual));
        } else assert.ok(actual.height > 4 * actual.lineHeight, JSON.stringify(actual));
    }
    return actual;
}

try {
    await interceptAdsOnly(page);
    await page.goto(process.env.GAME_BUILDER_URL || 'http://127.0.0.1:5191/game-builder/', { waitUntil: 'domcontentloaded' });
    await page.locator('#source-status').filter({ hasText: '已加载' }).waitFor();
    // The built-in status is rendered before deferred control initialization.
    // Wait for the first preview before dispatching a synthetic file change.
    await page.frameLocator('#preview-frame').locator('.item-card').first().waitFor();
    const thumb = origin + '/fixture.svg';
    const data = Array.from({ length: 3 }, (_, index) => ({ id: index + 1, title: 'Summary Game ' + (index + 1),
        description: 'Summary fixture. ' + 'Explore a colorful world and solve puzzles to finish each level. '.repeat(90), thumb, url: origin + '/play-' + index + '.html' }));
    await page.locator('#game-json-upload').setInputFiles({ name: 'summary-games.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
    await page.locator('#source-status').filter({ hasText: '已加载 3 个游戏' }).waitFor();
    await page.frameLocator('#preview-frame').locator('.item-card').filter({ hasText: 'Summary Game' }).first().waitFor();
    await page.locator('.config-tab[data-tab="style"]').click();
    await choose('game-template-version', 'legacy');
    assert.equal(await page.locator('#legacy-card-desc-lines').inputValue(), 'none');
    await choose('card-view-mode', 'list');

    for (const value of ['2', '1', '3', '4', '0', 'none']) {
        await choose('legacy-card-desc-lines', value);
        const preview = [];
        for (const size of ['desktop', 'tablet', 'mobile']) {
            await page.locator('.size-btn[data-size="' + size + '"]').click();
            preview.push({ size, actual: await summaryState(page.frameLocator('#preview-frame'), value) });
        }
        if (value === '2') await page.screenshot({ path: resolve(output, 'two-lines-mobile-workbench.png') });
        await page.locator('#btn-next').click();
        const [download] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.locator('#btn-export').click()]);
        const archive = resolve(output, 'summary-' + value + '.zip'); await download.saveAs(archive);
        const zip = await JSZip.loadAsync(await readFile(archive));
        files = new Map(await Promise.all(Object.values(zip.files).filter(file => !file.dir).map(async file => [file.name, await file.async('nodebuffer')])));
        const home = [...files.keys()].find(path => /^[^/]+\/index\.html$/.test(path)); assert.ok(home);
        const reopened = await browser.newPage();
        const exported = [];
        for (const width of [1280, 700, 390]) {
            await reopened.setViewportSize({ width, height: 1000 });
            await reopened.goto(origin + '/' + home);
            await reopened.locator('.item-card').first().waitFor();
            exported.push({ width, actual: await summaryState(reopened, value) });
            if (value === '2') await reopened.screenshot({ path: resolve(output, 'two-lines-export-' + width + '.png') });
        }
        // Summary control must not truncate the actual detail-page prose.
        await reopened.goto(origin + '/' + home.replace('index.html', 'details/article1.html'));
        assert.equal((await reopened.locator('.detail-content').textContent()).trim(), data[0].description.trim());
        await reopened.close();
        report.checks.push({ value, archive, preview, exported });
        console.log('Legacy summary ' + value + ': preview and export passed at three widths.');
        await page.locator('#btn-prev').click();
        await page.locator('.config-tab[data-tab="style"]').click();
    }
    // Version snapshots and field-checkbox changes must be reflected in the
    // visible summary picker, without silently enabling a disabled summary.
    await choose('legacy-card-desc-lines', '4');
    await choose('game-template-version', 'current');
    await choose('game-template-version', 'legacy');
    assert.equal(await page.locator('#legacy-card-desc-lines').inputValue(), '4');
    await page.locator('.config-tab[data-tab="structure"]').click();
    await waitPreviewChange(page, () => page.locator('#card-fields-config input[value="content"]').uncheck());
    assert.equal(await page.locator('#legacy-card-desc-lines').inputValue(), 'none');
    await summaryState(page.frameLocator('#preview-frame'), 'none');
    assert.deepEqual(report.errors, []);
    report.passed = true;
} catch (error) {
    report.failure = error.stack;
    report.sourceStatus = await page.locator('#source-status').textContent().catch(() => 'unavailable');
    await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
    await writeFile(resolve(output, 'failure.html'), await page.content().catch(() => ''));
    throw error;
} finally {
    await writeFile(resolve(output, 'browser-results.json'), JSON.stringify(report, null, 2));
    await browser.close();
    await new Promise(done => server.close(done));
}
console.log(JSON.stringify({ passed: report.passed, choices: report.checks.length, errors: report.errors }, null, 2));
