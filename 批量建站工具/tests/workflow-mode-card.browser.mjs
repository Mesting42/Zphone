// Verify that workflow status stays inside the shared navigation card at desktop and mobile widths.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.WORKFLOW_PREVIEW_URL || 'http://127.0.0.1:5173';
const screenshotDir = mkdtempSync(join(tmpdir(), 'workflow-mode-card-'));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];

async function inspectCard(page) {
    return page.locator('.workflow-command-bar').evaluate(function (shell) {
        function bounds(element) {
            var rect = element.getBoundingClientRect();
            return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
        }
        var rail = shell.querySelector('.step-progress');
        var mode = shell.querySelector('.workflow-mode-indicator');
        var returnLink = document.querySelector('.game-workbench-command > .tool-return-link');
        return {
            direction: getComputedStyle(shell).flexDirection,
            shell: bounds(shell),
            rail: bounds(rail),
            mode: bounds(mode),
            modeText: mode.textContent.trim(),
            modeOnly: shell.classList.contains('is-mode-only'),
            railHidden: rail.hidden,
            modeInsideShell: shell.contains(mode),
            railInsideShell: shell.contains(rail),
            returnLink: returnLink ? bounds(returnLink) : null,
            shellBackground: getComputedStyle(shell).backgroundImage,
            modeBackground: getComputedStyle(mode).backgroundImage
        };
    });
}

async function openPage(path, viewport) {
    var page = await browser.newPage({ viewport: viewport });
    page.setDefaultTimeout(15000);
    await page.route('**/*', function (route) {
        var url = new URL(route.request().url());
        if (url.origin === new URL(base).origin || url.hostname === 'cdnjs.cloudflare.com') return route.continue();
        return route.fulfill({ status: 200, body: '', contentType: 'text/javascript' });
    });
    await page.goto(base + path, { waitUntil: 'domcontentloaded' });
    await page.locator('.workflow-command-bar .workflow-mode-indicator').waitFor();
    return page;
}

try {
    var mainPage = await openPage('/index.html', { width: 1500, height: 960 });
    var mainDesktop = await inspectCard(mainPage);
    assert.equal(mainDesktop.direction, 'row');
    assert.ok(mainDesktop.modeInsideShell && mainDesktop.railInsideShell, 'main mode and rail must share one card');
    assert.ok(mainDesktop.mode.left >= mainDesktop.rail.right - 1, 'desktop mode badge should sit to the right of the step rail');
    assert.ok(mainDesktop.mode.right <= mainDesktop.shell.right + 1, 'desktop mode badge must stay inside the card');
    assert.match(mainDesktop.shellBackground, /gradient/i);
    assert.match(mainDesktop.modeBackground, /gradient/i);
    await mainPage.screenshot({ path: join(screenshotDir, 'main-desktop.png') });

    var mainModes = [
        ['normal', '普通建站'],
        ['ad-migration', '广告移植建站'],
        ['ad-injection', '成品站加广告'],
        ['batch-ad-build', '批量建站加广告'],
        ['ad-restoration', '批量广告策略'],
        ['differentiated', '差异化精品建站']
    ];
    for (const [mode, label] of mainModes) {
        await mainPage.locator('[data-build-mode="' + mode + '"]').click();
        await mainPage.waitForFunction(function (expected) {
            return document.getElementById('workflow-mode-label').textContent === expected;
        }, label);
    }
    await mainPage.locator('[data-build-mode="ad-restoration"]').click();
    await mainPage.waitForFunction(function () {
        return document.getElementById('workflow-mode-label').textContent === '批量广告策略';
    });
    var restorationCard = await inspectCard(mainPage);
    assert.equal(restorationCard.modeText, '当前工作流批量广告策略');
    assert.equal(restorationCard.modeOnly, true, 'the standalone strategy workflow keeps its mode card when steps are hidden');
    assert.equal(restorationCard.railHidden, true);
    report.push({ surface: 'main', desktop: mainDesktop, standaloneMode: restorationCard.modeText, workflows: mainModes.length });

    await mainPage.locator('[data-build-mode="normal"]').click();
    await mainPage.setViewportSize({ width: 390, height: 844 });
    var mainMobile = await inspectCard(mainPage);
    assert.equal(mainMobile.direction, 'column');
    assert.ok(mainMobile.modeInsideShell && mainMobile.railInsideShell);
    assert.ok(mainMobile.mode.top >= mainMobile.shell.top && mainMobile.mode.bottom <= mainMobile.shell.bottom);
    assert.ok(mainMobile.mode.right <= mainMobile.shell.right + 1);
    assert.ok(mainMobile.rail.top >= mainMobile.mode.bottom - 1);
    await mainPage.screenshot({ path: join(screenshotDir, 'main-mobile.png') });
    report.push({ surface: 'main', mobile: mainMobile });
    await mainPage.close();

    var gamePage = await openPage('/game-builder/index.html', { width: 1500, height: 960 });
    var gameDesktop = await inspectCard(gamePage);
    assert.equal(gameDesktop.direction, 'row');
    assert.ok(gameDesktop.mode.left >= gameDesktop.rail.right - 1);
    assert.ok(gameDesktop.mode.right <= gameDesktop.shell.right + 1);
    assert.ok(gameDesktop.returnLink.left >= gameDesktop.shell.right - 1, 'desktop return link must not overlap the unified card');
    await gamePage.screenshot({ path: join(screenshotDir, 'game-desktop.png') });

    var gameModes = [
        ['normal', '游戏建站 · 普通建站'],
        ['ad-migration', '游戏建站 · 广告移植建站'],
        ['differentiated', '游戏建站 · 差异化精品建站']
    ];
    for (const [mode, label] of gameModes) {
        await gamePage.locator('[data-build-mode="' + mode + '"]').click();
        await gamePage.waitForFunction(function (expected) {
            return document.getElementById('workflow-mode-label').textContent === expected;
        }, label);
    }
    await gamePage.setViewportSize({ width: 390, height: 844 });
    var gameMobile = await inspectCard(gamePage);
    assert.equal(gameMobile.direction, 'column');
    assert.ok(gameMobile.mode.right <= gameMobile.shell.right + 1);
    assert.ok(gameMobile.returnLink.top >= gameMobile.shell.bottom, 'mobile return link must flow below the card');
    await gamePage.screenshot({ path: join(screenshotDir, 'game-mobile.png') });
    report.push({ surface: 'game-builder', desktop: gameDesktop, mobile: gameMobile, workflows: gameModes.length });
    await gamePage.close();
} finally {
    await browser.close();
}

console.log(JSON.stringify({ screenshots: resolve(screenshotDir), report }, null, 2));
