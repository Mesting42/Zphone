/** Shared UI acceptance in a real Chromium browser. Native calls are mocked here
 * to isolate UI states; packaged Windows and Android checks provide host proof. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createOfflineServer } from '../server/offline-server.js';
import JSZip from 'jszip';

const { chromium } = createRequire(import.meta.url)('C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = resolve('coverage/apps-20261013/shared-browser');
await mkdir(output, { recursive: true });
const server = await createOfflineServer(resolve('dist'), resolve(output, 'server-data'));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { kind: 'browser UI with a mocked native bridge', checks: [], errors: [], localFailures: [], externalBlocked: [] };

async function newPage(width, height, native = true) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 1000 });
    await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (/^https?:$/.test(url.protocol) && url.hostname !== '127.0.0.1') {
            report.externalBlocked.push(url.href);
            return route.abort('internetdisconnected');
        }
        return route.continue();
    });
    await context.addInitScript(({ native }) => {
        Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
        if (!native || window.top !== window.self) return;
        window.__nativeCheck = { projects: [], tasks: {}, exports: [], events: [], prepared: false };
        const state = window.__nativeCheck;
        window.SiteFoundryNative = {
            getPlatformInfo: async () => ({ platform: 'windows', appVersion: '1.0.6.4', capabilities: { offlineBuild: true } }),
            selectDirectory: async () => ({ token: 'chosen-directory', name: 'Exports' }),
            selectImportDirectory: async () => ({ name: 'Sites', files: [] }),
            readImportFile: async () => ({ dataBase64: '', eof: true, size: 0 }),
            startFile: async options => { const id = String(state.exports.length); state.exports.push({ ...options, parts: [] }); return { id }; },
            appendFile: async options => { state.exports[Number(options.id)].parts.push(options.base64); },
            finishFile: async options => ({ saved: true, name: state.exports[Number(options.id)].name }),
            cancelFile: async () => ({}),
            importProject: async () => { state.projects = [{ id: 'project-1', name: 'Example Next source' }]; return state.projects[0]; },
            listProjects: async () => state.projects,
            inspectProject: async () => ({ id: 'project-1', prepared: state.prepared, preparationReasons: state.prepared ? [] : [{ message: '尚未准备依赖' }] }),
            prepareProject: async () => { state.prepared = true; const task = { id: 'prepare-1', operation: 'prepare', state: 'succeeded', logs: ['Dependencies prepared'] }; state.tasks[task.id] = task; return task; },
            startBuild: async () => { const task = { id: 'build-1', operation: 'build', state: 'succeeded', logs: ['Offline build complete'] }; state.tasks[task.id] = task; return task; },
            taskStatus: async options => state.tasks[options.taskId],
            cancelTask: async () => ({ state: 'cancelled' }),
            previewArtifact: async options => { state.events.push({ preview: options }); return { opened: true }; },
            exportArtifact: async options => { state.events.push({ export: options }); return { saved: true }; },
        };
    }, { native });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(origin)) report.localFailures.push({ url: response.url(), status: response.status() }); });
    return page;
}

try {
    for (const [width, height] of [[390, 844], [800, 1280], [1280, 800], [1440, 900]]) {
        for (const route of ['/', '/game-builder/']) {
            const page = await newPage(width, height);
            await page.goto(origin + route);
            await page.locator('.native-app-toolbar').waitFor();
            assert.equal(await page.title(), 'SiteFoundry');
            await page.locator('.workbench-brand-mark').evaluate(image => image.decode());
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
            if (overflow > 1) {
                report.overflowElements = await page.evaluate(() => Array.from(document.querySelectorAll('body *')).map(element => ({ tag: element.tagName, id: element.id, class: element.className, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right })).filter(item => item.right > innerWidth + 1 || item.left < -1).slice(0, 30));
                await page.screenshot({ path: resolve(output, 'overflow-failure.png') });
            }
            assert.ok(overflow <= 1, `${width} ${route} horizontal overflow: ${overflow}`);
            await page.getByRole('button', { name: '源码工程', exact: true }).click();
            await page.getByRole('dialog').waitFor();
            assert.equal(await page.locator('[data-project-build]').isDisabled(), true);
            await page.locator('[data-project-import]').click();
            await page.locator('select#native-project-select option[value="project-1"]').waitFor({ state: 'attached' });
            await page.locator('[data-project-prepare]').click();
            await page.waitForFunction(() => !document.querySelector('[data-project-build]').disabled);
            await page.locator('[data-project-build]').click();
            await page.waitForFunction(() => !document.querySelector('[data-project-export]').disabled);
            await page.locator('[data-project-preview]').click();
            await page.locator('[data-project-export]').click();
            await page.waitForFunction(() => document.querySelector('[data-project-status]').textContent.includes('已保存'));
            assert.equal((await page.evaluate(() => window.__nativeCheck.events)).length, 2);
            const bounds = await page.getByRole('dialog').boundingBox();
            assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, 'Dialog exceeds viewport');
            const closeBounds = await page.locator('[data-project-close]').boundingBox();
            assert.ok(closeBounds.y >= bounds.y && closeBounds.y + closeBounds.height <= height, 'Close action must remain visible after scrolling');
            await page.screenshot({ path: resolve(output, `dialog-${width}-${route === '/' ? 'main' : 'game'}.png`) });
            await page.keyboard.press('Escape');
            await page.getByRole('dialog').waitFor({ state: 'hidden' });
            assert.equal(await page.getByRole('button', { name: '源码工程', exact: true }).evaluate(button => document.activeElement === button), true);
            report.checks.push({ name: 'responsive-source-dialog', width, height, route, focusRestored: true, overflow });
            await page.close();
        }
    }
    const editorial = await newPage(390, 844);
    await editorial.goto(origin);
    await editorial.locator('#upload-area[data-upload-ready="true"]').waitFor();
    await editorial.locator('#file-input').setInputFiles(resolve('coverage/full-regression-20261013/configuration-controls-final-2/input/data/摇滚乐史.rar'));
    await editorial.waitForFunction(() => /已解析|导入成功/.test(document.getElementById('upload-import-progress-text')?.textContent || ''), null, { timeout: 180000 });
    await editorial.locator('#btn-next').click();
    await editorial.locator('.theme-card:visible').first().click();
    await editorial.locator('#btn-next').click();
    await editorial.locator('#step-3.active').waitFor();
    await editorial.locator('#btn-next').click();
    await editorial.locator('#step-4.active').waitFor();
    await editorial.screenshot({ path: resolve(output, 'editorial-phone-config.png') });
    await editorial.locator('#btn-next').click();
    await editorial.locator('#btn-export').click();
    await editorial.waitForFunction(() => window.__nativeCheck.exports.length > 0 && document.querySelector('#btn-export').disabled === false, null, { timeout: 180000 });
    const exported = await editorial.evaluate(() => window.__nativeCheck.exports[0]);
    const zipBytes = Buffer.concat(exported.parts.map(part => Buffer.from(part, 'base64')));
    const zip = await JSZip.loadAsync(zipBytes);
    assert.ok(Object.values(zip.files).some(file => !file.dir && /index\.html$/.test(file.name)));
    await writeFile(resolve(output, exported.name), zipBytes);
    report.checks.push({ name: 'editorial-real-rar-to-native-export', bytes: zipBytes.length, entries: Object.keys(zip.files).length });
    await editorial.close();

    const game = await newPage(800, 1280);
    await game.goto(origin + '/game-builder/');
    await game.locator('#game-source[data-custom-select="true"]').waitFor();
    await game.locator('#source-status').filter({ hasText: '已加载' }).waitFor();
    await game.locator('#btn-next').click();
    await game.locator('#btn-export').click();
    await game.waitForFunction(() => window.__nativeCheck.exports.length > 0 && document.querySelector('#btn-export').disabled === false, null, { timeout: 180000 });
    const gameExport = await game.evaluate(() => window.__nativeCheck.exports[0]);
    const gameZip = await JSZip.loadAsync(Buffer.concat(gameExport.parts.map(part => Buffer.from(part, 'base64'))));
    assert.ok(Object.values(gameZip.files).some(file => !file.dir && /index\.html$/.test(file.name)));
    report.checks.push({ name: 'game-native-export', entries: Object.keys(gameZip.files).length });
    await game.close();

    const browserPage = await newPage(1440, 900, false);
    await browserPage.goto(origin);
    await browserPage.locator('#upload-area[data-upload-ready="true"]').waitFor();
    assert.equal(await browserPage.locator('.native-app-toolbar').count(), 0);
    report.checks.push({ name: 'browser-workbench-keeps-browser-export' });
    await browserPage.close();
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.localFailures, []);
    report.passed = true;
} catch (error) {
    report.passed = false;
    report.failure = error.stack;
    throw error;
} finally {
    await writeFile(resolve(output, 'results.json'), JSON.stringify(report, null, 2));
    await browser.close();
    await new Promise(resolve => server.close(resolve));
    console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, errors: report.errors.length, failure: report.failure }));
}
