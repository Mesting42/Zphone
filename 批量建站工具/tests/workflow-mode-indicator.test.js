import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const helperSource = readFileSync(new URL('../js/workflow-mode-indicator.js', import.meta.url), 'utf8');

function loadIndicator() {
    const window = {};
    runInNewContext(helperSource, { window });
    return window.WorkflowModeIndicator;
}

describe('workflow mode indicator', () => {
    it('provides labels for every main workflow mode', () => {
        const indicator = loadIndicator();

        expect(indicator.getLabel('normal', 'main')).toBe('普通建站');
        expect(indicator.getLabel('game-builder', 'main')).toBe('游戏建站');
        expect(indicator.getLabel('ad-migration', 'main')).toBe('广告移植建站');
        expect(indicator.getLabel('ad-injection', 'main')).toBe('成品站加广告');
        expect(indicator.getLabel('batch-ad-build', 'main')).toBe('批量建站加广告');
        expect(indicator.getLabel('ad-restoration', 'main')).toBe('批量广告策略');
        expect(indicator.getLabel('differentiated', 'main')).toBe('差异化精品建站');
    });

    it('distinguishes the game builder modes from the main builder modes', () => {
        const indicator = loadIndicator();

        expect(indicator.getLabel('normal', 'game')).toBe('游戏建站 · 普通建站');
        expect(indicator.getLabel('ad-migration', 'game')).toBe('游戏建站 · 广告移植建站');
        expect(indicator.getLabel('differentiated', 'game')).toBe('游戏建站 · 差异化精品建站');
        expect(indicator.getLabel('unknown', 'game')).toBe('游戏建站 · 当前模式');
    });

    it('updates only the supplied display node and tolerates a missing node', () => {
        const indicator = loadIndicator();
        const target = { textContent: '', dataset: {} };

        expect(indicator.sync(target, 'batch-ad-build', 'main')).toBe('批量建站加广告');
        expect(target.textContent).toBe('批量建站加广告');
        expect(target.dataset.workflowMode).toBe('batch-ad-build');
        expect(indicator.sync(null, 'normal', 'main')).toBe('');
    });

    it('loads the shared helper before each workflow app and includes a live label', () => {
        const mainHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
        const gameHtml = readFileSync(new URL('../game-builder/index.html', import.meta.url), 'utf8');
        const mainApp = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
        const gameApp = readFileSync(new URL('../game-builder/js/app.js', import.meta.url), 'utf8');
        const glassCss = readFileSync(new URL('../css/liquid-glass.css', import.meta.url), 'utf8');
        const glassScript = readFileSync(new URL('../js/liquid-glass.js', import.meta.url), 'utf8');

        expect(mainHtml).toContain('id="workflow-mode-label"');
        expect(gameHtml).toContain('id="workflow-mode-label"');
        expect(mainHtml).toContain('<div class="workflow-command-bar liquid-glass-surface">');
        expect(gameHtml).toContain('<div class="workflow-command-bar game-workflow-command-bar liquid-glass-surface">');
        expect(mainHtml.indexOf('class="workflow-mode-indicator"')).toBeGreaterThan(mainHtml.indexOf('class="workflow-command-bar liquid-glass-surface"'));
        expect(gameHtml.indexOf('class="workflow-mode-indicator"')).toBeGreaterThan(gameHtml.indexOf('class="workflow-command-bar game-workflow-command-bar liquid-glass-surface"'));
        expect(mainHtml.indexOf('workflow-mode-indicator.js')).toBeLessThan(mainHtml.indexOf('js/app.js'));
        expect(gameHtml.indexOf('workflow-mode-indicator.js')).toBeLessThan(gameHtml.indexOf('js/app.js'));
        expect(mainHtml).toContain('aria-live="polite"');
        expect(gameHtml).toContain('aria-live="polite"');
        expect(mainApp).toContain("window.WorkflowModeIndicator.sync(document.getElementById('workflow-mode-label'), appState.siteBuildMode, 'main')");
        expect(gameApp).toContain("window.WorkflowModeIndicator.sync(document.getElementById('workflow-mode-label'), appState.siteBuildMode, 'game')");
        expect(glassCss).toContain('.workflow-command-bar.liquid-glass-surface');
        expect(glassCss).toContain('@media (max-width: 1100px)');
        expect(glassScript).toContain("surface.closest('.workflow-command-bar')");
    });
});
