import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..');
const runtime = readFileSync(resolve(projectRoot, 'js/jelly-button.js'), 'utf8');
const liquidGlassRuntime = readFileSync(resolve(projectRoot, 'js/liquid-glass.js'), 'utf8');

describe('Jelly Explore button', () => {
    it('decorates existing navigation controls without replacing their behavior', () => {
        const mainIndex = readFileSync(resolve(projectRoot, 'index.html'), 'utf8');
        const gameIndex = readFileSync(resolve(projectRoot, 'game-builder/index.html'), 'utf8');
        const mainApp = readFileSync(resolve(projectRoot, 'js/app.js'), 'utf8');
        const gameApp = readFileSync(resolve(projectRoot, 'game-builder/js/app.js'), 'utf8');
        const mainCss = readFileSync(resolve(projectRoot, 'css/tool.css'), 'utf8');
        const gameCss = readFileSync(resolve(projectRoot, 'game-builder/css/tool.css'), 'utf8');

        expect(runtime).toContain("document.querySelectorAll('.btn-next, .btn-prev, .btn-reupload, .tool-return-link, .preview-tab, .size-btn, .preview-fullscreen-btn')");
        expect(runtime).toContain("control.classList.add('jelly-hover-only')");
        expect(runtime).toContain("control.classList.add('jelly-workflow-secondary')");
        expect(runtime).toContain("control.classList.add('jelly-toolbar-button')");
        expect(runtime).toContain('sitefoundry-jelly-goo');
        expect(runtime).toContain('stdDeviation="10"');
        expect(runtime).toContain("control.style.setProperty('--jelly-label-x'");
        expect(runtime).toContain('pointermove');
        expect(runtime).toContain('function setLabel(control, text)');
        expect(runtime).toContain('window.SiteFoundryJellyButton = { setLabel: setLabel }');
        [mainApp, gameApp].forEach((app) => {
            expect(app).toContain('function updateNextButtonLabel(text)');
            expect(app).toContain('function updateWorkflowActionContext(step)');
            expect(app).toContain('window.SiteFoundryJellyButton.setLabel(btnNext, text)');
            expect(app).not.toMatch(/btnNext\.textContent\s*=\s*step/);
        });
        expect(mainIndex).toContain('js/jelly-button.js');
        expect(gameIndex).toContain('../js/jelly-button.js');
        expect(mainIndex).toContain('css/liquid-glass.css');
        expect(gameIndex).toContain('../css/liquid-glass.css');
        expect(mainIndex).toContain('js/liquid-glass.js');
        expect(mainIndex).toContain('liquid-command-progress');
        expect(mainIndex).not.toContain('liquid-command-deck');
        expect(mainIndex).not.toContain('header-brand');
        expect(mainIndex).toContain('workflow-action-dock');
        expect(mainIndex).toContain('class="btn-export btn-next"');
        expect(mainIndex).toContain('data-lucide-icon="package"');
        expect(mainIndex).toContain('data-size="tablet" title="平板" aria-label="平板预览"');
        expect(mainIndex).toContain('aria-label="平板预览">📟</button>');
        expect(mainIndex).not.toContain('📦 导出网站ZIP');
        expect(mainIndex).toContain('id="export-progress" role="status" aria-live="polite"');
        ['panels-top-left', 'gamepad-2', 'file-input', 'badge-plus', 'sliders-horizontal', 'wand-sparkles'].forEach((icon) => {
            expect(mainIndex).toContain(`data-lucide-icon="${icon}"`);
        });
        expect(mainIndex).toContain('build-mode-card-migration');
        expect(mainCss).toContain('.build-mode-card-games .build-mode-icon { background: #f0ebff; color: #7157c8; }');
        expect(gameIndex).toContain('../js/liquid-glass.js');
        expect(gameIndex).toContain('game-workbench-command');
        expect(gameIndex).toContain('game-command-progress');
        expect(gameIndex).not.toContain('<header class="tool-header">');
        expect(gameIndex).toContain('workflow-action-dock');
        expect(liquidGlassRuntime).toContain('requestAnimationFrame(updateHighlight)');
        expect(liquidGlassRuntime).toContain("surface.classList.add('liquid-glass-surface')");
        expect(liquidGlassRuntime).toContain("'.build-mode-card'");
        expect(gameIndex).toContain('class="config-item header-nav-config"');
        [mainCss, gameCss].forEach((css) => {
            expect(css).toContain('.jelly-explore-button');
            expect(css).toContain('.jelly-toolbar-button');
            expect(css).toContain('.preview-tabs::-webkit-scrollbar { display: none; }');
            expect(css).toContain('border-radius: 8px !important');
            expect(css).toContain('prefers-reduced-motion: reduce');
        });
        expect(gameCss).toContain('.header-nav-config');
        expect(gameCss).toContain('grid-template-columns: 148px minmax(0, 1fr)');
        expect(gameCss).toContain('.header-nav-config > .config-help-block');
        const liquidGlassCss = readFileSync(resolve(projectRoot, 'css/liquid-glass.css'), 'utf8');
        expect(liquidGlassCss).toContain('.liquid-glass-surface::before');
        expect(liquidGlassCss).toContain('/* Page scrollbar: a quiet glass rail shared by both tools, leaving nested scrollers independent. */');
        expect(liquidGlassCss).toContain('html::-webkit-scrollbar-thumb,');
        expect(liquidGlassCss).toContain('scrollbar-gutter: stable;');
        expect(liquidGlassCss).toContain('.liquid-glass-surface > .build-mode-selected-mark');
        expect(liquidGlassCss).toContain('.btn-next.jelly-explore-button.jelly-hover-only');
        expect(liquidGlassCss).toContain('.btn-prev.jelly-explore-button.jelly-workflow-secondary');
        expect(liquidGlassCss).toContain('.btn-reupload.jelly-explore-button.jelly-workflow-secondary');
        expect(liquidGlassCss).toContain('Secondary controls sit side-by-side');
        expect(liquidGlassCss).toContain('opacity: 0.32;');
        expect(liquidGlassCss).toContain('Baseline geometry must not depend on the decoration script');
  expect(liquidGlassCss).toContain('border-radius: 28px !important');
  expect(liquidGlassCss).toContain('border-radius 220ms cubic-bezier(.16, 1, .3, 1)');
  expect(runtime).not.toContain('is-jelly-exiting');
        expect(liquidGlassCss).toContain('transform: translateY(-1px) scale(1.02) !important');
        expect(liquidGlassCss).toContain('transform: translateY(0) scale(0.94) !important');
        expect(liquidGlassCss).toContain('.liquid-command-progress');
        expect(liquidGlassCss).toContain('/* A segment appears only after its preceding step is complete; future steps do not get a preview rail. */');
        expect(liquidGlassCss).toContain('The rail uses the same vertical axis as the numbered circles');
        expect(liquidGlassCss).toContain('/* Each segment starts and ends at the actual centers of adjacent flexed steps. */');
        expect(liquidGlassCss).toContain('top: calc(var(--step-circle-center-y) - 1px);');
        expect(liquidGlassCss).toContain('left: calc(10% + var(--step-rail-double-trim));');
        expect(liquidGlassCss).toContain('width: calc(20% - var(--step-rail-trim));');
        expect(liquidGlassCss).toContain('opacity: 0;');
        expect(liquidGlassCss).toContain('opacity: 1;');
        expect(liquidGlassCss).toContain('.game-command-progress > .step-line { left: calc(25% + 9px); width: calc(50% - 18px); }');
        expect(liquidGlassCss).toContain('margin-top: clamp(24px, 4vh, 44px)');
        expect(liquidGlassCss).toContain('.game-workbench-command');
        expect(liquidGlassCss).toContain('.step-nav.workflow-action-dock');
        expect(liquidGlassCss).toContain('margin: 18px auto 0;');
        expect(liquidGlassCss).toContain('.tool-return-link.jelly-explore-button .jelly-explore-body');
        expect(liquidGlassCss).toContain('.tool-return-link.jelly-explore-button.is-jelly-active .jelly-explore-body { opacity: 1; }');
    });

    it('keeps export feedback determinate and distinguishes success from failure', () => {
        const mainApp = readFileSync(resolve(projectRoot, 'js/app.js'), 'utf8');
        const mainCss = readFileSync(resolve(projectRoot, 'css/tool.css'), 'utf8');

        expect(mainApp).toContain('function updateExportProgress(percent, message, state)');
        expect(mainApp).toContain("updateExportProgress(100, '导出成功，ZIP 文件已开始下载。', 'success')");
        expect(mainApp).toContain("updateExportProgress(null, '导出失败：' + err.message, 'error')");
        expect(mainCss).toContain('.export-progress[data-state="success"]');
        expect(mainCss).toContain('.export-progress[data-state="error"]');
        expect(mainCss).toContain('font-variant-numeric: tabular-nums;');
        expect(mainCss).toContain('.export-button-icon svg');
    });
});

describe('configuration select layering', () => {
    it('raises the complete glass group while a custom select is open', () => {
        const app = readFileSync(resolve(projectRoot, 'js/app.js'), 'utf8');
        const css = readFileSync(resolve(projectRoot, 'css/tool.css'), 'utf8');

        expect(app).toContain("var configGroup = shell.closest('.config-group');");
        expect(app).toContain("configGroup.classList.toggle('select-open-group', willOpen)");
        expect(app).toContain("configGroup.classList.remove('select-open-group')");
        expect(css).toMatch(/\.config-group\.select-open-group\s*\{[^}]*z-index:\s*80;/);
        expect(css).toMatch(/\.config-item\.select-open\s*\{[^}]*z-index:\s*70;/);
        expect(css).toMatch(/\.select-shell\.open\s*\{[^}]*z-index:\s*71;/);
        expect(css).toMatch(/\.select-menu\s*\{[^}]*z-index:\s*72;/);
    });

    it('raises category icon menus above later glass groups and uses an Emoji font stack', () => {
        const app = readFileSync(resolve(projectRoot, 'js/app.js'), 'utf8');
        const css = readFileSync(resolve(projectRoot, 'css/tool.css'), 'utf8');

        expect(app).toContain('function closeCategoryIconPickers(exceptPicker)');
        expect(app).toContain('function setCategoryPickerOpenState(picker, isOpen)');
        expect(app).toContain("configGroup.classList.toggle('picker-open-group', isOpen)");
        expect(app).toContain('function moveCategoryPickerMenuToPortal(picker)');
        expect(app).toContain('function restoreCategoryPickerMenu(picker)');
        expect(app).toContain('closeStyledSelects();\n                closeCategoryIconPickers(picker);');
        expect(app).toContain('setCategoryPickerOpenState(picker, willOpen);');
        expect(css).toMatch(/\.config-group\.picker-open-group\s*\{[^}]*z-index:\s*80;/);
        expect(css).toMatch(/\.cat-icon-picker\.open\s*\{[^}]*z-index:\s*90;/);
        expect(css).toMatch(/\.cat-icon-menu\s*\{[^}]*z-index:\s*91;/);
        expect(css).toMatch(/\.cat-icon-menu\s*\{[^}]*max-height:\s*min\(332px, calc\(100vh - 180px\)\);[\s\S]*overflow-y:\s*auto;/);
        expect(css).toMatch(/\.cat-icon-menu\.is-portal-open\s*\{[^}]*position:\s*fixed;[^}]*z-index:\s*20000;/);
        expect(css).toMatch(/\.cat-icon-trigger\s*\{[^}]*Segoe UI Emoji/);
        expect(css).toMatch(/\.cat-icon-option\s*\{[^}]*Segoe UI Emoji/);
    });
});
