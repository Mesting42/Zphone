import './differentiated-builder.js?v=20260915-industrial-catalog-1';
import { findTemplateOwner } from '../template-system/availability.js';
import { renderCategoryLayoutControls, bindCategoryLayoutControls } from './category-layout-controls.js';
import { previewErrorDocument } from './preview-error-document.js';
import { injectReactSource } from './react-source-ad-injector.js?v=20260923-export-parity-2';
import { availablePreviewContentTypes, isPreviewDetailEntry, previewPageTypeForEntry, previewContentTypeForEntry, resolvePreviewHtmlEntry, isPreviewInternalHref } from './ad-injection-preview-router.js?v=20261021-content-types-2';
import { buildPreviewSite, previewBuildPlan } from './ad-injection-preview-builder.js?v=20260923-artifact-first-1';
import { rewriteFrameworkPreview, frameworkPreviewRuntime } from './ad-injection-preview-framework.js';
import { batchRarStageProgress, readBatchRarEntries } from './batch-archive-data.js?v=20260928-rar-timeout-fallback-2';
import { createPolicyPreview } from './ad-policy-preview.js?v=20261021-sandbox-assets-1';
import { QUICK_AD_VERSION, planQuickAdUpdate, prepareQuickAdUpdate, applyQuickAdUpdate } from './ad-quick-update.js?v=20261009-quick-ad-2';
import { mapWithConcurrency, yieldToBrowser } from './async-work.js?v=20261013-performance-1';
import { renderExportConfiguration, renderDifferentiatedExportConfiguration } from './export-summary-view.js?v=sha256-3f2b9900e822a4dc';
import { updateWorkflowExportProgress, setWorkflowExportButtonLabel } from './export-progress-view.js?v=sha256-cd8cc888fe9e8d8a';
import { createFieldMappingView } from './field-mapping-view.js?v=sha256-59b066db4b8e1535';
import { collectDataDirectory, directoryFileEntries, readDataDirectory } from './data-directory-import.js';
import { rewritePreviewCss } from './preview-css.js';
import { previewResourceUrl, previewResourceMime } from './preview-resource-url.js';
import { inspectTemplate, reuseTemplateSite } from './template-reuse.js';
import { templateOriginalPolicy, siteForReplacementCode, retargetTemplateHost } from './template-reuse-policy.js';
import { readTemplateReuseContent } from './template-reuse-import.js';
import { commonPolicyPlacements, policyPlacementLabel, editPolicyPlacement } from './ad-policy-placement.js';
import { renderTemplateThemeCards } from './template-reuse-theme-view.js';
import { listGameCatalogs, loadGameCatalog } from './game-catalog-source.js';
import { gameCatalogContent } from './template-reuse-games.js';

/**
 * 主应用逻辑
 * 管理步骤导航、状态、UI交互、实时预览
 */

(async function() {
    'use strict';

    // 在初始化流程前保留视图引用，恢复页面状态时也能同步更新匹配摘要。
    var fieldMappingView = null;

    // Load the local template catalog before defaults and radio listeners initialize.
    if (window.AdTemplateCatalog) await window.AdTemplateCatalog.ready;

    var REQUIRED_DIFFERENTIATED_BUILDER_VERSION = '20260914-template-library-13';

    // ========== 应用状态 ==========
    var appState = {
        currentStep: 1,
        workflowStepProgress: {},
        selectedTheme: null,
        data: [],
        jsonFields: [],
        isLocalImages: false,
        localImages: {},
        fieldMapping: {},
        config: {},
        randomTemplateHistory: [],
        brandHistory: {},
        iconHistory: {},
        iconSetHistory: {},
        domainDetection: null,
        domainSelectionSource: null,
        previewDetailIndex: 0,
        previewSectionSlug: '',
        adPlacementMode: null,  // null or 'adv1'|'adv2'|'adv3'
        normalAdMode: 'code',   // code: 上传 TXT 自动接入；reserve: 先导出空 ad.js 与预留广告位
        adJsVersion: 'v1.0.2.1',
        reservePlacementMode: 'manual',
        directAdPlacementMode: 'fixed', // 上传广告代码后默认沿用自动位置，可切换手动调整
        siteBuildMode: 'normal',
        legacyAdMigration: null,
        adCodeMigration: null,
        adRestorationSiteFiles: [],
        adPolicySites: [],
        adPolicySourceMode: '',
        adPolicyGlobal: null,
        adPolicyOverrides: {},
        adPolicyCodeOverrides: {}, // 原包保留不变，仅记录用户明确替换的代码。
        adPolicyTask: 'advanced',
        templateReuse: newTemplateReuseState(),
        adQuickScope: 'single',
        adQuickCodes: [],
        adQuickPreserveSwitches: false,
        adPolicyActiveSiteId: '',
        adPolicyPreviewPath: '',
        adPolicyPlacementMode: 'fixed',
        adPolicyPlacingSlot: null,
        adPolicyAdJsVersion: 'original', // original: 保留各站原版；其他值用于批量统一升级模板
        adInjectionSites: [],
        adInjectionSourceMode: '',
        adInjectionArchiveFiles: [],
        adInjectionCodeFiles: [],
        adInjectionCodes: [],
        adInjectionAllowPartial: false,
        adInjectionPolicy: null,
        adInjectionPlacementModeDefault: 'fixed',
        adInjectionExportMode: 'static',
        adInjectionAdJsVersion: 'v1.0.2.1',
        adInjectionSiteOverrides: {},
        adInjectionPreviewSiteId: '',
        adInjectionPreviewEntryPath: '',
        adInjectionPreviewEffectsEnabled: false,
        adInjectionPlacementMode: null,
        batchAdBuild: {
            sites: [], codes: [], activeSiteIndex: 0, adMode: 'code',
            reserveDefaults: { placementMode: 'manual', adJsVersion: 'v1.0.2.1', adPlacements: {} },
            codePlacementDefaults: { placementMode: 'fixed', adPlacements: null }
        },
        differentiated: {
            siteType: 'editorial', vertical: '', audience: '', scope: '', baseUrl: '',
            contactEmail: '', contactLayout: 'split', contactFields: ['name', 'email', 'subject', 'message'], footerStyle: 'simple', footerLinks: ['privacy', 'terms', 'contact', 'about'], siteTitle: '', brandMark: 'auto', logoIcon: '', typography: 'auto', designFamily: 'auto', domainId: 'auto', seed: '', cardAlignment: 'compact', homeIntro: 'compact', featuredCard: 'highlight', navCategoryLimit: 4, homeCategoryLayout: false, homeCategoryLimit: 4, categoryOverrides: [], summaryMode: 'standard', tone: 'auto', themePreset: 'auto', themePalette: {}, contentDensity: 'comfortable', cardRadius: 'auto', cardHover: 'lift', cardColumns: 'template', categoryCardColumns: 'inherit', cardViewMode: 'auto', cardBorder: 'auto', cardSpacing: 'auto', cardExcerptLines: 'auto', cardImageHeight: 'auto', cardHeight: 'template', coverFit: 'smart', contentMaxWidth: 'auto', metaBg: 'auto', detailImgStyle: 'auto', categoryTitleStyle: 'auto', categoryTitleAlign: 'auto', heroStyle: 'auto', detailLayout: 'auto', fontStyle: 'auto', logoStyle: 'mark-text', navLayout: 'split', navStyle: 'glass', navHeight: 'regular', gridGap: 'regular', buttonStyle: 'solid', buttonSize: 'auto', backLinkStyle: 'arrow', animationEnter: 'fade', transitionSpeed: 'normal', exportVariant: 'draft'
        },
        differentiatedPackage: null,
        packageAssets: {},
        differentiatedImportName: '',
        _previewBlobUrls: []    // 预览中本地图片的blob URL，用于清理
    };

    if (window.AdTemplateCatalog) {
        var defaultAdJsVersion = window.AdTemplateCatalog.getDefaultVersion();
        appState.adJsVersion = defaultAdJsVersion;
        appState.adInjectionAdJsVersion = defaultAdJsVersion;
    }

    // ========== DOM引用 ==========
    var stepPanels = document.querySelectorAll('.step-panel');
    var stepItems = document.querySelectorAll('.step-item');
    var stepLines = document.querySelectorAll('.step-line');
    var btnPrev = document.getElementById('btn-prev');
    var btnReupload = document.getElementById('btn-reupload');
    var btnNext = document.getElementById('btn-next');
    var workflowActionMessage = document.getElementById('workflow-action-message');
    var workflowActionDock = document.querySelector('.workflow-action-dock');
    var previewFrame = document.getElementById('preview-frame');
    var previewRefreshTimer = null;
    var previewDocumentRevision = 0;
    var previewPendingLoadRevision = 0;
    var workflowModeTransitionTimer = null;

    // Keep iframe refreshes visually continuous without changing the preview
    // document itself. The load event restores full clarity; the timeout also
    // recovers if a preview has slow or blocked external resources.
    function clearPreviewRefreshState() {
        if (!previewFrame || previewPendingLoadRevision !== previewDocumentRevision) return;
        previewPendingLoadRevision = 0;
        if (previewRefreshTimer) {
            clearTimeout(previewRefreshTimer);
            previewRefreshTimer = null;
        }
        previewFrame.removeAttribute('data-refreshing');
    }

    if (previewFrame) previewFrame.addEventListener('load', clearPreviewRefreshState);

    function setPreviewDocument(html) {
        if (!previewFrame) return;
        if (previewRefreshTimer) {
            clearTimeout(previewRefreshTimer);
            previewRefreshTimer = null;
        }

        var revision = ++previewDocumentRevision;
        previewPendingLoadRevision = 0;
        previewFrame.setAttribute('data-refreshing', 'true');
        var assignDocument = function() {
            if (revision !== previewDocumentRevision) return;
            previewPendingLoadRevision = revision;
            previewFrame.srcdoc = html;
            previewRefreshTimer = setTimeout(function() {
                if (revision === previewDocumentRevision && previewPendingLoadRevision === revision) clearPreviewRefreshState();
            }, 1400);
        };
        if (typeof window.requestAnimationFrame === 'function' && document.visibilityState !== 'hidden') {
            // Let the dimmed state reach a paint before replacing the iframe document.
            window.requestAnimationFrame(function() {
                window.requestAnimationFrame(assignDocument);
            });
        } else {
            setTimeout(assignDocument, 16);
        }
    }

    function markWorkflowModeTransition() {
        if (!document.body) return;
        document.body.classList.add('workflow-mode-transitioning');
        if (workflowModeTransitionTimer) clearTimeout(workflowModeTransitionTimer);
        workflowModeTransitionTimer = setTimeout(function() {
            document.body.classList.remove('workflow-mode-transitioning');
            workflowModeTransitionTimer = null;
        }, 260);
    }

    var noticeOverlay = document.getElementById('notice-overlay');
    var noticeDialog = document.getElementById('notice-dialog');
    var noticeMessage = document.getElementById('notice-message');
    var noticeSymbol = document.getElementById('notice-symbol');
    var noticeEyebrow = document.getElementById('notice-eyebrow');
    var noticeConfirm = document.getElementById('notice-confirm');
    var noticeClose = document.getElementById('notice-close');
    var noticeCancel = document.getElementById('notice-cancel');
    var noticeLastFocus = null;
    var noticeResolve = null;

    function updateNextButtonLabel(text) {
        if (window.SiteFoundryJellyButton && typeof window.SiteFoundryJellyButton.setLabel === 'function') {
            window.SiteFoundryJellyButton.setLabel(btnNext, text);
            return;
        }
        btnNext.textContent = text;
    }
    function updateWorkflowActionContext(step) {
        if (!workflowActionMessage) return;
        if (isAdPolicyWorkflow()) {
            workflowActionMessage.textContent = isQuickAdUpdate()
                ? step === 1 ? '下一步：匹配新广告 TXT' : step === 4 ? '下一步：导出广告更新副本' : '当前步骤：导出网站新副本'
                : step === 1 ? '下一步：配置网站与广告策略' : step === 4 ? '下一步：导出策略新副本' : '当前步骤：导出网站新副本';
            return;
        }
        if (isAdInjectionWorkflow()) {
            var injectionMessages = {
                1: '下一步：配置网站与广告位',
                4: '下一步：导出加广告后的新副本',
                5: '当前步骤：导出网站新副本'
            };
            workflowActionMessage.textContent = injectionMessages[step] || '成品站加广告';
            return;
        }
        var messages = {
            1: '下一步：识别领域',
            2: '下一步：字段匹配',
            3: '下一步：配置网站',
            4: '下一步：导出网站',
            5: '当前步骤：导出网站'
        };
        workflowActionMessage.textContent = messages[step] || '流程操作';
    }

    function isAdInjectionWorkflow() {
        return appState.siteBuildMode === 'ad-injection';
    }
    function isTemplateReuseWorkflow() { return appState.siteBuildMode === 'ad-template-reuse'; }
    function isAdPolicyWorkflow() { return appState.siteBuildMode === 'ad-restoration' || isTemplateReuseWorkflow(); }
    function isQuickAdUpdate() { return appState.siteBuildMode === 'ad-restoration' && appState.adPolicyTask === 'quick'; }
    function quickUpdateOptions() {
        return { scope: appState.adQuickScope, siteId: appState.adPolicyActiveSiteId, preserveSwitches: appState.adQuickPreserveSwitches };
    }
    function isThreeStepWorkflow() { return isAdInjectionWorkflow() || isAdPolicyWorkflow(); }

    function injectionWorkflowSteps() {
        return [1, 4, 5];
    }

    function injectionWorkflowPosition(step) {
        return injectionWorkflowSteps().indexOf(step) + 1;
    }

    function currentWorkflowSteps() {
        return isThreeStepWorkflow() ? injectionWorkflowSteps() : [1, 2, 3, 4, 5];
    }

    function currentWorkflowProgressKey() {
        return appState.siteBuildMode || 'normal';
    }

    function getWorkflowHighestReachedStep(workflowKey, steps) {
        var key = workflowKey || currentWorkflowProgressKey();
        var sequence = steps || currentWorkflowSteps();
        var progress = appState.workflowStepProgress || (appState.workflowStepProgress = {});
        progress[key] = window.WorkflowStepNavigation.normalizeHighestReachedStep(sequence, progress[key]);
        return progress[key];
    }

    function recordWorkflowStepReached(step, workflowKey, steps) {
        var key = workflowKey || currentWorkflowProgressKey();
        var sequence = steps || currentWorkflowSteps();
        var progress = appState.workflowStepProgress || (appState.workflowStepProgress = {});
        progress[key] = window.WorkflowStepNavigation.recordHighestReachedStep(sequence, progress[key], step);
        return progress[key];
    }

    function resetWorkflowStepProgress(workflowKey, steps) {
        var key = workflowKey || currentWorkflowProgressKey();
        var sequence = steps || (key === 'ad-injection' || key === 'ad-restoration' || key === 'ad-template-reuse' ? injectionWorkflowSteps() : [1, 2, 3, 4, 5]);
        var progress = appState.workflowStepProgress || (appState.workflowStepProgress = {});
        progress[key] = window.WorkflowStepNavigation.getFirstStep(sequence);
        if (key === currentWorkflowProgressKey()) syncWorkflowNavigation();
    }

    function syncStepProgressState() {
        var steps = currentWorkflowSteps();
        var highestStep = getWorkflowHighestReachedStep(currentWorkflowProgressKey(), steps);
        var highestIndex = window.WorkflowStepNavigation.getStepIndex(steps, highestStep);

        stepItems.forEach(function(item, index) {
            var step = steps[index];
            var stepIndex = window.WorkflowStepNavigation.getStepIndex(steps, step);
            if (stepIndex === -1) return;

            item.classList.toggle('active', step === appState.currentStep);
            item.classList.toggle('completed', stepIndex < highestIndex);
            item.classList.toggle('is-visited', stepIndex <= highestIndex || step === appState.currentStep);
            if (step === appState.currentStep) item.setAttribute('aria-current', 'step');
            else item.removeAttribute('aria-current');

            // Keep the active item operable even if another workflow was just
            // selected; only steps beyond this workflow's high-water mark lock.
            item.disabled = stepIndex > highestIndex && step !== appState.currentStep;
        });
    }

    function nextWorkflowStep() {
        if (!isThreeStepWorkflow()) return appState.currentStep < 5 ? appState.currentStep + 1 : 0;
        var steps = injectionWorkflowSteps();
        var position = steps.indexOf(appState.currentStep);
        // The finished-site workflow deliberately skips domain detection and
        // field mapping. If stale UI state ever reports an unknown step, route
        // forward to configuration instead of silently yielding undefined.
        if (position < 0) return appState.currentStep < 4 ? 4 : appState.currentStep < 5 ? 5 : 0;
        return steps[position + 1] || 0;
    }

    function previousWorkflowStep() {
        if (!isThreeStepWorkflow()) return appState.currentStep > 1 ? appState.currentStep - 1 : 0;
        var steps = injectionWorkflowSteps();
        var position = steps.indexOf(appState.currentStep);
        return position > 0 ? steps[position - 1] : 0;
    }

    function syncWorkflowNavigation() {
        var injection = isThreeStepWorkflow();
        var step = appState.currentStep;
        var visualPosition = injection ? injectionWorkflowPosition(step) : step;
        syncStepProgressState();
        btnPrev.style.display = visualPosition > 1 ? 'inline-block' : 'none';
        if (btnReupload) {
            var canReupload = isAdPolicyWorkflow() ? appState.adPolicySites.length > 0 : injection ? (appState.adInjectionSites || []).length > 0 : appState.data && appState.data.length;
            btnReupload.hidden = !(step === 1 && canReupload);
        }
        updateNextButtonLabel(injection ? (step === 1 ? '进入配置网站 →' : step === 4 ? '进入导出 →' : '完成') : (step === 5 ? '完成' : '下一步 →'));
        btnNext.style.display = step === 5 ? 'none' : 'inline-block';
        btnNext.dataset.nextStep = String(nextWorkflowStep() || '');
        updateWorkflowActionContext(step);
    }

    function syncInjectionWorkflowChrome() {
        var active = isThreeStepWorkflow();
        var labels = active
            ? [isAdPolicyWorkflow() ? '上传站点' : '上传过审网站', '配置网站', '导出网站']
            : ['上传数据', '识别领域', '字段匹配', '配置网站', '导出网站'];
        var stepProgress = document.querySelector('.step-progress');
        if (stepProgress) stepProgress.classList.toggle('is-ad-injection', active);
        stepItems.forEach(function(item, index) {
            var visible = !active || index < 3;
            item.hidden = !visible;
            if (visible) {
                var step = active ? injectionWorkflowSteps()[index] : index + 1;
                item.dataset.step = String(step);
                var label = item.querySelector('.step-label');
                if (label) label.textContent = labels[index];
            }
        });
        stepLines.forEach(function(line, index) { line.hidden = active && index >= 2; });
    }
    var uploadArea = document.getElementById('upload-area');
    var fileInput = document.getElementById('file-input');
    var dataOverview = document.getElementById('data-overview');

    // ========== 统一站内提示 ==========
    function closeNotice(confirmed) {
        if (!noticeOverlay || noticeOverlay.hidden) return;
        var resolve = noticeResolve;
        noticeResolve = null;
        noticeOverlay.hidden = true;
        if (noticeLastFocus && typeof noticeLastFocus.focus === 'function') noticeLastFocus.focus();
        noticeLastFocus = null;
        if (resolve) resolve(confirmed === true);
    }

    function showNotice(message, title) {
        if (!noticeOverlay || !noticeMessage) return;
        noticeLastFocus = document.activeElement;
        if (noticeDialog) noticeDialog.dataset.variant = 'default';
        if (noticeSymbol) noticeSymbol.textContent = '!';
        if (noticeEyebrow) noticeEyebrow.textContent = '需要处理';
        document.getElementById('notice-title').textContent = title || '操作提示';
        noticeMessage.textContent = message;
        noticeResolve = null;
        noticeConfirm.textContent = '我知道了';
        if (noticeCancel) noticeCancel.hidden = true;
        noticeOverlay.hidden = false;
        window.requestAnimationFrame(function() { noticeConfirm.focus(); });
    }

    function showConfirm(message, title, confirmLabel, callback) {
        if (!noticeOverlay || !noticeMessage) return;
        var options = arguments[4] || {};
        noticeLastFocus = document.activeElement;
        if (noticeDialog) noticeDialog.dataset.variant = options.variant || 'default';
        if (noticeSymbol) noticeSymbol.textContent = options.symbol || '!';
        if (noticeEyebrow) noticeEyebrow.textContent = options.eyebrow || '需要处理';
        document.getElementById('notice-title').textContent = title || '请确认操作';
        noticeMessage.textContent = message;
        noticeConfirm.textContent = confirmLabel || '继续';
        if (noticeCancel) {
            noticeCancel.hidden = false;
            noticeCancel.textContent = options.cancelLabel || '返回';
        }
        noticeResolve = callback;
        noticeOverlay.hidden = false;
        window.requestAnimationFrame(function() { noticeConfirm.focus(); });
    }

    if (noticeConfirm) noticeConfirm.addEventListener('click', function() { closeNotice(true); });
    if (noticeCancel) noticeCancel.addEventListener('click', function() { closeNotice(false); });
    if (noticeClose) noticeClose.addEventListener('click', function() { closeNotice(false); });
    if (noticeOverlay) noticeOverlay.addEventListener('click', function(event) {
        if (event.target === noticeOverlay) closeNotice(false);
    });
    document.addEventListener('keydown', function(event) {
        if (!noticeOverlay || noticeOverlay.hidden) return;
        if (event.key === 'Tab') {
            // Keep JSON selection/error confirmation inside its modal surface;
            // keyboard users must not change the workflow behind an import.
            var focusable = Array.from(noticeDialog.querySelectorAll('button, select, input, a[href], [tabindex="0"]')).filter(function(control) {
                return !control.disabled && !control.hidden && control.getClientRects().length > 0;
            });
            var first = focusable[0];
            var last = focusable[focusable.length - 1];
            if (first && (!noticeDialog.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last))) {
                event.preventDefault();
                (event.shiftKey ? last : first).focus();
            }
        } else if (event.key === 'Escape') {
            event.preventDefault();
            closeNotice(false);
        } else if (event.key === 'Enter' && event.target === noticeConfirm) {
            event.preventDefault();
            closeNotice(true);
        }
    });

    // ========== 建站方式与旧站广告移植 ==========
    function migrationResultHtml(result) {
        if (!result) return '等待上传旧网站源码压缩包（.zip、.tar.gz 或 .tgz）。顶层额外目录也可识别。';
        var messages = (result.valid ? ['校验通过：已识别旧站广告配置与首页、详情页的三个广告容器。'] : []).concat((result.errors || []).map(function(item) { return item.message; }));
        var warnings = (result.warnings || []).map(function(item) { return item.message; });
        var files = result.valid && result.detectedFiles ? '已识别：' + [result.detectedFiles.adJs, result.detectedFiles.home, result.detectedFiles.detail].filter(Boolean).join(' · ') : '';
        return '<strong>' + (result.valid ? '广告移植校验通过' : '广告移植校验未通过') + '</strong>' +
            (files ? '<div>' + escapeHtml(files) + '</div>' : '') +
            (messages.length ? '<ul>' + messages.map(function(message) { return '<li>' + escapeHtml(message) + '</li>'; }).join('') + '</ul>' : '') +
            (warnings.length ? '<ul><li>提示：' + warnings.map(escapeHtml).join('</li><li>提示：') + '</li></ul>' : '');
    }

    function renderMigrationResult() {
        var target = document.getElementById('legacy-site-result');
        if (!target) return;
        var result = appState.legacyAdMigration;
        target.className = 'migration-result ' + (result ? (result.valid ? 'valid' : 'invalid') : 'pending');
        target.innerHTML = migrationResultHtml(result);
    }

    function syncAllArticlesUI() {
        // All generated-content workflows export the same listing page.
        var normalMode = ['normal', 'ad-migration', 'batch-ad-build'].indexOf(appState.siteBuildMode) !== -1;
        normalMode = normalMode && !EditorialTemplateVersions.isLegacy(appState.config);
        var enabled = normalMode && appState.config && appState.config.allArticlesEnabled !== false && !!(appState.data && appState.data.length);
        var settings = document.getElementById('all-articles-settings');
        var input = document.getElementById('all-articles-enabled');
        var tab = document.querySelector('.preview-tab[data-page="all"]');
        if (settings) settings.hidden = !normalMode;
        if (input) input.checked = !!(appState.config && appState.config.allArticlesEnabled !== false);
        if (tab) {
            tab.hidden = !enabled;
            if (!enabled && tab.classList.contains('active')) {
                tab.classList.remove('active');
                var homeTab = document.querySelector('.preview-tab[data-page="home"]');
                if (homeTab) homeTab.classList.add('active');
            }
        }
    }

    function syncBuildModeUI() {
        var isMigration = appState.siteBuildMode === 'ad-migration';
        var isDifferentiated = appState.siteBuildMode === 'differentiated';
        var isRestoration = isAdPolicyWorkflow();
        var isTemplateReuse = isTemplateReuseWorkflow();
        var isInjection = appState.siteBuildMode === 'ad-injection';
        var isBatchAdBuild = appState.siteBuildMode === 'batch-ad-build';
        var isStandaloneTool = false;
        // Keep the visible label in sync with the selected mode; this helper only touches presentation.
        if (window.WorkflowModeIndicator) {
            window.WorkflowModeIndicator.sync(document.getElementById('workflow-mode-label'), appState.siteBuildMode, 'main');
        }
        var workflowCommandBar = document.querySelector('.workflow-command-bar');
        if (workflowCommandBar) workflowCommandBar.classList.toggle('is-mode-only', isStandaloneTool);
        syncInjectionWorkflowChrome();
        document.querySelectorAll('[data-build-mode]').forEach(function(button) {
            var selected = button.dataset.buildMode === appState.siteBuildMode;
            button.classList.toggle('is-selected', selected);
            button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
        var legacySection = document.getElementById('legacy-site-upload');
        if (legacySection) legacySection.hidden = !isMigration;
        var differentiatedSection = document.getElementById('differentiated-setup');
        if (differentiatedSection) differentiatedSection.hidden = !isDifferentiated;
        var restorationSection = document.getElementById('ad-restoration-setup');
        if (restorationSection) restorationSection.hidden = !isRestoration;
        var restorationTitle = document.getElementById('ad-restoration-title');
        if (restorationTitle) restorationTitle.textContent = isTemplateReuse ? '广告模板复用' : '批量广告策略编辑器';
        var restorationIntro = restorationSection && restorationSection.querySelector('.ad-restoration-intro');
        if (restorationIntro) restorationIntro.textContent = isTemplateReuse
            ? '上传已经加过广告的静态源码压缩包，保留原站布局、视觉、导航与广告位置，只替换内容、主题配色和广告单元。'
            : '上传站点压缩包或读取站点目录，选择快速更新广告或详细配置策略，再导出新副本。';
        var templateReuseSource = document.getElementById('template-reuse-source');
        if (templateReuseSource) templateReuseSource.hidden = !isTemplateReuse;
        document.getElementById('template-reuse-config').hidden = !isTemplateReuse;
        if (restorationSection) restorationSection.querySelector('.ad-quick-mode-options').hidden = isTemplateReuse;
        if (isTemplateReuse) {
            appState.adPolicyTask = 'advanced';
            document.querySelector('[name="ad-policy-task"][value="advanced"]').checked = true;
        }
        var injectionSection = document.getElementById('ad-injection-setup');
        if (injectionSection) injectionSection.hidden = !isInjection;
        var batchSection = document.getElementById('batch-ad-setup');
        if (batchSection) batchSection.hidden = !isBatchAdBuild;
        if (uploadArea) uploadArea.hidden = isRestoration || isInjection || isBatchAdBuild;
        var directoryActions = document.getElementById('data-directory-actions');
        if (directoryActions) directoryActions.hidden = isRestoration || isInjection || isBatchAdBuild || isDifferentiated;
        if (dataOverview) dataOverview.hidden = isRestoration || isInjection || isBatchAdBuild;
        var stepProgress = document.querySelector('.step-progress');
        if (stepProgress) stepProgress.hidden = isStandaloneTool;
        if (workflowActionDock) workflowActionDock.hidden = isStandaloneTool;
        if (btnReupload) {
            var hasUploadForMode = isInjection
                ? (appState.adInjectionSites || []).length > 0
                : isRestoration ? appState.adPolicySites.length > 0 : isBatchAdBuild ? (appState.batchAdBuild.sites || []).length > 0 : !!(appState.data && appState.data.length);
            btnReupload.hidden = isStandaloneTool || appState.currentStep !== 1 || !hasUploadForMode;
        }
        var standardConfigPanel = document.querySelector('#step-4 .config-panel:not(.ad-injection-config-panel):not(.ad-policy-config-panel)');
        if (standardConfigPanel) standardConfigPanel.hidden = isDifferentiated || isInjection || isRestoration;
        var policyConfigPanel = document.getElementById('ad-policy-config-panel');
        if (policyConfigPanel) policyConfigPanel.hidden = !isRestoration;
        var policyExportPanel = document.getElementById('ad-policy-export-panel');
        if (policyExportPanel) policyExportPanel.hidden = !isRestoration;
        var policyPagePicker = document.getElementById('ad-policy-page-picker');
        if (policyPagePicker) policyPagePicker.hidden = !isRestoration;
        if (!isRestoration) document.querySelectorAll('.preview-tab').forEach(function(tab) { if (tab.dataset.page !== 'all') tab.hidden = false; });
        if (isInjection) {
            var injectionSite = (appState.adInjectionSites || []).find(function(site) { return site.id === appState.adInjectionPreviewSiteId; }) || (appState.adInjectionSites || [])[0] || null;
            syncAdInjectionPageTabs(injectionSite);
        } else {
            document.querySelectorAll('.preview-tab[data-page="article"], .preview-tab[data-page="tool"], .preview-tab[data-page="game"]').forEach(function(tab) { tab.hidden = true; });
        }
        var injectionConfigPanel = document.getElementById('ad-injection-config-panel');
        if (injectionConfigPanel) injectionConfigPanel.hidden = !isInjection;
        syncAdInjectionPreviewEffectsControl();
        var differentiatedCustomizer = document.getElementById('differentiated-customizer');
        if (differentiatedCustomizer) differentiatedCustomizer.hidden = !isDifferentiated;
        // 广告代码模式在模板配置后可用；旧站移植仍只接受完整旧站源码压缩包。
        var adsTab = document.querySelector('.config-tab[data-tab="ads"]');
        var adsSection = document.getElementById('tab-ads');
        if (adsTab) adsTab.hidden = isInjection;
        if (adsSection) adsSection.hidden = isInjection;
        if (adsSection) adsSection.querySelectorAll(':scope > .config-group').forEach(function(group) {
            group.hidden = isInjection || (isBatchAdBuild && group.id !== 'ad-js-version-group');
        });
        var adJsVersionGroup = document.getElementById('ad-js-version-group');
        if (adJsVersionGroup) adJsVersionGroup.hidden = isInjection || isRestoration || isDifferentiated;
        var batchCodeWorkspace = document.getElementById('batch-ad-code-workspace');
        if (batchCodeWorkspace) batchCodeWorkspace.hidden = !isBatchAdBuild;
        // 批量流程先选择接入方式，再显示共用的 ad.js 版本和广告位控件；
        // 离开批量流程时恢复普通建站原有顺序。
        if (adsSection && batchCodeWorkspace && adJsVersionGroup) {
            if (isBatchAdBuild && batchCodeWorkspace.nextElementSibling !== adJsVersionGroup) {
                adsSection.insertBefore(batchCodeWorkspace, adJsVersionGroup);
            } else if (!isBatchAdBuild && adJsVersionGroup.nextElementSibling !== batchCodeWorkspace) {
                adsSection.insertBefore(adJsVersionGroup, batchCodeWorkspace);
            }
        }
        var legacyExport = document.getElementById('legacy-export-options');
        var differentiatedExport = document.getElementById('differentiated-export-options');
        var defaultExportButton = document.getElementById('btn-export');
        var injectionExport = document.getElementById('ad-injection-export-options');
        if (legacyExport) legacyExport.hidden = isDifferentiated || isBatchAdBuild || isInjection || isRestoration;
        if (differentiatedExport) differentiatedExport.hidden = !isDifferentiated;
        if (defaultExportButton) {
            defaultExportButton.hidden = isDifferentiated || isInjection || isRestoration;
            var exportButtonLabel = defaultExportButton.querySelector('.export-button-label');
            if (exportButtonLabel) exportButtonLabel.textContent = isBatchAdBuild ? '分别导出各站 ZIP' : '导出网站 ZIP';
            defaultExportButton.title = isBatchAdBuild ? '会为每个站点分别下载 ZIP；若浏览器询问，请允许多个文件下载。' : '';
        }
        if (injectionExport) injectionExport.hidden = !isInjection;
        var uploadHint = document.getElementById('upload-hint');
        if (uploadHint) uploadHint.textContent = isDifferentiated
            ? '推荐上传规范 ZIP（manifest + content + assets + provenance）；也支持单个 JSON 草稿'
            : '支持 .json 文件 或压缩包（.zip/.rar/.7z，含JSON+图片）';
        if (isMigration) renderMigrationResult();
        if (isRestoration) updateAdRestorationControls();
        if (isInjection) {
            updateAdInjectionControls();
            renderAdInjectionConfig();
        }
        if (isBatchAdBuild) {
            renderBatchDataList();
            renderBatchAdCodeWorkspace();
        }
        if (isDifferentiated) {
            renderDifferentiatedPackageStatus();
            populateDifferentiatedDesigns();
        }
        syncAllArticlesUI();
        syncDirectAdPlacementUI();
        // Switching workflow cards happens without changing the numeric step.
        // Keep the sticky action dock in sync immediately; otherwise it still
        // advertises and may attempt the normal 1 → 2 route.
        syncWorkflowNavigation();
    }

    function selectBuildMode(mode) {
        // 游戏建站保留独立的经典运行时，避免与资讯工具的全局生成器和状态相互覆盖。
        // 它位于同一发布包内，会随 Vite 构建一并输出。
        if (mode === 'game-builder') {
            window.location.assign('game-builder/index.html');
            return;
        }
        var nextMode = mode === 'ad-migration' || mode === 'differentiated' || mode === 'ad-restoration' || mode === 'ad-template-reuse' || mode === 'ad-injection' || mode === 'batch-ad-build' ? mode : 'normal';
        if (nextMode !== appState.siteBuildMode) {
            markWorkflowModeTransition();
            if (typeof PreviewImageCache !== 'undefined') PreviewImageCache.acquire({});
        }
        if (!['normal', 'batch-ad-build'].includes(nextMode) && EditorialTemplateVersions.isLegacy(appState.config)) {
            appState.config = EditorialTemplateVersions.switchVersion(appState.config, 'current', appState.selectedTheme, createThemeConfig);
        }
        appState.siteBuildMode = nextMode;
        appState.adPlacementMode = null;
        appState.directAdPlacementMode = 'fixed';
        if (appState.config) {
            appState.config.adPlacements = {};
            appState.config.adCodePlacements = null;
            appState.config.adPaths = {};
        }
        if (appState.siteBuildMode !== 'ad-migration') appState.legacyAdMigration = null;
        else appState.adCodeMigration = null;
        if (!isTemplateReuseWorkflow()) {
            templateReuseImportToken = (templateReuseImportToken || 0) + 1;
            appState.templateReuse = newTemplateReuseState();
        }
        syncBuildModeUI();
        updatePreview();
    }

    function initBuildModeControls() {
        document.querySelectorAll('[data-build-mode]').forEach(function(button) {
            button.addEventListener('click', function() { selectBuildMode(this.dataset.buildMode); });
        });
        var selectButton = document.getElementById('legacy-site-select');
        var input = document.getElementById('legacy-site-file');
        if (selectButton && input) selectButton.addEventListener('click', function() { input.click(); });
        if (input) input.addEventListener('change', async function() {
            var file = input.files && input.files[0];
            if (!file) return;
            resetWorkflowStepProgress('ad-migration');
            appState.legacyAdMigration = { valid: false, errors: [], warnings: [], config: {}, detectedFiles: {} };
            var result = document.getElementById('legacy-site-result');
            if (result) {
                result.className = 'migration-result pending';
                result.textContent = '正在本地检查 ' + file.name + '…';
            }
            appState.legacyAdMigration = await AdMigration.inspectArchive(file);
            renderMigrationResult();
            updatePreview();
            input.value = '';
        });
        initAdRestorationControls();
        initAdInjectionControls();
        syncBuildModeUI();
    }

    var adRestorationRunning = false;
    // Preserve the actual read failure for navigation; a structure/import
    // failure must not be reported as a missing advertisement configuration.
    var adRestorationReadError = '';
    var adInjectionRunning = false;

    function fileSelectionSummary(files, unit) {
        files = files || [];
        if (!files.length) return '尚未选择';
        var names = files.slice(0, 2).map(function(file) { return file.name; }).join('、');
        return files.length + ' 个' + unit + (files.length > 2 ? '：' + names + ' 等' : '：' + names);
    }

    function cloneAdPolicy(policy) {
        return JSON.parse(JSON.stringify(policy));
    }

    var policyPlacementLabels = {
        off: '关闭（保留路径）',
        'after-navbar': '头部导航栏下方',
        'after-hero': '首屏/主视觉之后',
        'content-top': '内容区顶部',
        'after-section-0': '第 1 个栏目之后',
        'after-section-1': '第 2 个栏目之后',
        'after-section-2': '第 3 个栏目之后',
        'content-bottom': '内容区底部',
        'detail-before-content': '正文之前',
        'detail-between-p-1': '第 1 段之后',
        'detail-between-p-2': '第 2 段之后',
        'detail-between-p-3': '第 3 段之后',
        'detail-middle': '正文中部', 'content-middle': '内容中段', 'detail-after-content': '正文中部',
        'detail-before-related': '相关推荐之前',
        'detail-after-related': '相关推荐之后',
        'footer-top': '页脚上方'
    };

    function policyValue(policy, path) {
        return path.split('.').reduce(function(value, key) { return value && value[key]; }, policy);
    }

    function setPolicyValue(policy, path, value) {
        var keys = path.split('.');
        var target = policy;
        keys.slice(0, -1).forEach(function(key) {
            if (!target[key]) target[key] = {};
            target = target[key];
        });
        target[keys[keys.length - 1]] = value;
    }

    function normalizePolicyAdJsVersion(value) {
        // 版本白名单由恢复核心统一维护，避免界面新增版本后与导出逻辑不一致。
        return AdRestoration.normalizeBatchAdJsVersionMode(value);
    }

    function policyPositionOptions(page, selected, slotIndex) {
        var values = (page === 'home' ? AdRestoration.homePlacements : page === 'all' ? AdRestoration.allPlacements : AdRestoration.detailPlacements).slice();
        values.unshift('original-banner' + (slotIndex + 1));
        if (/^original-banner/.test(selected) && values.indexOf(selected) === -1) values.push(selected);
        if (/^custom-after-/.test(selected)) values.push(selected);
        return values.filter(function(value) { return value !== 'off'; }).map(function(value) {
            var original = value.match(/^original-banner([123])$/);
            var label = original ? '原站位置 ' + original[1] : policyPlacementLabels[value] || value;
            return '<option value="' + escapeHtml(value) + '"' + (value === selected ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
        }).join('');
    }

    function policyUnitOptions(selected) {
        var labels = { off: '关闭此广告位', banner1: '使用 banner1', banner2: '使用 banner2', banner3: '使用 banner3' };
        return AdRestoration.bannerUnits.map(function(value) {
            return '<option value="' + value + '"' + (value === selected ? ' selected' : '') + '>' + labels[value] + '</option>';
        }).join('');
    }

    function policyValidationMarkup(policy) {
        var errors = AdRestoration.validatePolicy(policy);
        return '<div class="ad-policy-validation' + (errors.length ? ' is-error' : '') + '" data-policy-validation role="status">' +
            (errors.length ? escapeHtml(errors.map(function(item) { return item.message; }).join('；')) : '配置有效：同一页面的每个 banner 单元最多使用一次。') + '</div>';
    }

    function policyEditorBody(policy) {
        policy = AdRestoration.normalizePolicy(policy);
        function pageCard(page, title, description) {
            return '<section class="ad-policy-page-card" data-policy-page="' + page + '" aria-label="' + title + '广告位配置"><header><div><strong>' + title + '广告位</strong><small>' + description + '</small></div><span>位置 + 单元</span></header>' +
                '<div class="ad-policy-slot-head"><span>序号</span><span>显示位置</span><span>使用单元</span></div>' +
                policy.slots[page].map(function(slot, index) {
                    return '<div class="ad-policy-slot-row"><strong>广告位 ' + (index + 1) + '</strong>' +
                        '<select data-policy-field="slots.' + page + '.' + index + '.position" aria-label="' + title + '广告位 ' + (index + 1) + ' 显示位置">' + policyPositionOptions(page, slot.position, index) + '</select>' +
                        '<select data-policy-field="slots.' + page + '.' + index + '.unit" aria-label="' + title + '广告位 ' + (index + 1) + ' 使用单元">' + policyUnitOptions(slot.unit) + '</select></div>';
                }).join('') + '</section>';
        }
        function checked(field) { return policyValue(policy, field) ? ' checked' : ''; }
        return '<div class="ad-policy-page-grid">' +
            pageCard('home', '首页', '每个位置可换成 banner1、2、3 或关闭') +
            pageCard('detail', '详情页', '三个位置与首页分开设置') +
            (policy.slots.all ? pageCard('all', '全部文章页', '独立位置；内容中段独占整行居中') : '') +
            '</div><p class="ad-policy-unit-hint">选择一个已在本页使用的 banner 时，原广告位会自动关闭；这样可以直接把广告位 1 从 banner1 换成 banner2 或 banner3。</p>' +
            '<div class="ad-policy-oop"><strong>插屏</strong><label><input type="checkbox" data-policy-field="outOfPage.interstitial.home"' + checked('outOfPage.interstitial.home') + '>首页</label><label><input type="checkbox" data-policy-field="outOfPage.interstitial.detail"' + checked('outOfPage.interstitial.detail') + '>详情页</label>' +
            (policy.slots.all ? '<label><input type="checkbox" data-policy-field="outOfPage.interstitial.all"' + checked('outOfPage.interstitial.all') + '>全部文章页</label>' : '') +
            '<strong>锚点</strong><label><input type="checkbox" data-policy-field="outOfPage.anchor.home"' + checked('outOfPage.anchor.home') + '>首页</label><label><input type="checkbox" data-policy-field="outOfPage.anchor.detail"' + checked('outOfPage.anchor.detail') + '>详情页</label>' +
            (policy.slots.all ? '<label><input type="checkbox" data-policy-field="outOfPage.anchor.all"' + checked('outOfPage.anchor.all') + '>全部文章页</label>' : '') + '</div>' +
            '<label class="ad-policy-comment-option"><input type="checkbox" data-policy-field="writeDisabledComments"' + checked('writeDisabledComments') + '><span><strong>关闭项同时写入源码注释</strong><small>关闭的 banner 保留为 HTML 注释；插屏与锚点在 ad.js 中写入策略注释。所有原广告路径仍保留。</small></span></label>' +
            policyValidationMarkup(policy);
    }

    function populatePolicyEditor(editor, policy) {
        if (!editor || typeof AdRestoration === 'undefined') return;
        editor.innerHTML = policyEditorBody(policy);
    }

    function readPolicyEditor(editor) {
        var policy = AdRestoration.createPolicy(undefined, { pageIsolation: true });
        if (!editor) return policy;
        editor.querySelectorAll('[data-policy-field]').forEach(function(control) {
            setPolicyValue(policy, control.dataset.policyField, control.type === 'checkbox' ? control.checked : control.value);
        });
        return AdRestoration.normalizePolicy(policy);
    }

    function policyEditorMarkup(policy, siteIndex) {
        policy = AdRestoration.normalizePolicy(policy);
        return '<div class="ad-policy-editor" data-site-policy-index="' + siteIndex + '">' + policyEditorBody(policy) + '</div>';
    }

    function updatePolicyValidation(editor, policy) {
        var target = editor && editor.querySelector('[data-policy-validation]');
        if (!target) return;
        var errors = AdRestoration.validatePolicy(policy);
        target.classList.toggle('is-error', errors.length > 0);
        target.textContent = errors.length
            ? errors.map(function(item) { return item.message; }).join('；')
            : '配置有效：同一页面的每个 banner 单元最多使用一次。';
    }

    function readChangedPolicyEditor(editor, changedControl) {
        var field = changedControl && changedControl.dataset ? changedControl.dataset.policyField || '' : '';
        var unitMatch = field.match(/^slots\.(home|detail|all)\.(\d+)\.unit$/);
        if (unitMatch && changedControl.value !== 'off') {
            editor.querySelectorAll('select[data-policy-field$=".unit"]').forEach(function(control) {
                if (control !== changedControl && control.dataset.policyField.indexOf('slots.' + unitMatch[1] + '.') === 0 && control.value === changedControl.value) {
                    control.value = 'off';
                }
            });
        }
        var policy = readPolicyEditor(editor);
        updatePolicyValidation(editor, policy);
        return policy;
    }

    function markAdPolicyCustom() {
        var preset = document.getElementById('ad-policy-preset');
        if (preset) preset.value = 'custom';
    }

    function renderAdPolicySites() {
        var list = document.getElementById('ad-policy-site-list');
        var title = document.getElementById('ad-policy-sites-title');
        var sites = appState.adPolicySites || [];
        if (title) title.textContent = '已识别 ' + sites.length + ' 个站点';
        if (!list) return;
        if (!sites.length) {
            list.innerHTML = '<div class="ad-policy-empty">选择站点总目录或压缩包后，这里会列出识别结果。</div>';
            return;
        }
        list.innerHTML = sites.map(function(site, index) {
            var metadata = site.metadata || {};
            var valid = !!metadata.valid;
            var policyCompatible = valid && !!metadata.adJsVersion;
            var override = appState.adPolicyOverrides[site.id];
            var selectedVersion = normalizePolicyAdJsVersion(appState.adPolicyAdJsVersion);
            var outputVersion = selectedVersion === 'original' ? metadata.adJsVersion : selectedVersion;
            var versionText = metadata.adJsVersion
                ? ' · ad.js ' + metadata.adJsVersion + (outputVersion !== metadata.adJsVersion ? ' → 输出 ' + outputVersion : '')
                : ' · ad.js 版本无法识别，不能批量恢复/限流';
            var meta = valid
                ? (metadata.detectedHost || '已识别广告路径') + ' · ' + metadata.detailPaths.length + ' 个详情页' +
                    versionText
                : (metadata.errors || []).map(function(item) { return item.message; }).join('；');
            return '<article class="ad-policy-site' + (policyCompatible ? '' : ' is-invalid') + '">' +
                '<div class="ad-policy-site-summary"><span class="ad-policy-site-index">' + (index + 1) + '</span><div class="ad-policy-site-copy"><strong>' + escapeHtml(site.name) + '</strong><small>' + escapeHtml(meta) + '</small></div>' +
                '<label class="ad-policy-override-toggle"><input type="checkbox" data-policy-override-index="' + index + '"' + (override ? ' checked' : '') + (policyCompatible ? '' : ' disabled') + '>单站覆盖</label></div>' +
                (override && site.id === appState.adPolicyActiveSiteId ? '<div class="ad-policy-override"><button type="button" class="ad-policy-override-copy" data-policy-copy-index="' + index + '">重新复制全局方案</button>' + policyEditorMarkup(override, index) + '</div>' : '') +
                '</article>';
        }).join('');

        list.querySelectorAll('[data-policy-override-index]').forEach(function(control) {
            control.addEventListener('change', function() {
                var site = appState.adPolicySites[Number(this.dataset.policyOverrideIndex)];
                if (!site) return;
                if (this.checked) appState.adPolicyOverrides[site.id] = cloneAdPolicy(appState.adPolicyGlobal);
                else delete appState.adPolicyOverrides[site.id];
                markAdPolicyCustom();
                renderAdPolicySites();
                updateAdRestorationControls();
            });
        });
        list.querySelectorAll('[data-policy-copy-index]').forEach(function(button) {
            button.addEventListener('click', function() {
                var site = appState.adPolicySites[Number(this.dataset.policyCopyIndex)];
                if (!site) return;
                appState.adPolicyOverrides[site.id] = cloneAdPolicy(appState.adPolicyGlobal);
                AdRestoration.rememberPolicyPositions(site, appState.adPolicyOverrides[site.id]);
                markAdPolicyCustom();
                renderAdPolicySites();
                updateAdRestorationControls();
            });
        });
        list.querySelectorAll('[data-site-policy-index]').forEach(function(editor) {
            editor.addEventListener('change', function(event) {
                var site = appState.adPolicySites[Number(editor.dataset.sitePolicyIndex)];
                if (site) {
                    appState.adPolicyOverrides[site.id] = readChangedPolicyEditor(editor, event.target);
                    AdRestoration.rememberPolicyPositions(site, appState.adPolicyOverrides[site.id], event.target.dataset.policyField || 'none');
                    markAdPolicyCustom();
                }
                updateAdRestorationControls();
            });
        });
    }

    // 快速模式使用独立状态；切回详细策略时不覆盖原来的预设、单站配置或 TXT。
    function renderQuickAdUpdate() {
        var quick = isQuickAdUpdate();
        var batch = appState.adQuickScope === 'batch';
        document.getElementById('ad-quick-scope-options').hidden = !quick;
        document.getElementById('ad-quick-config').hidden = !quick;
        document.getElementById('ad-policy-detailed-config').hidden = quick;
        document.getElementById('restoration-export-code').hidden = quick;
        document.getElementById('ad-policy-config-title').textContent = isTemplateReuseWorkflow() ? '配置模板内容与广告' : quick ? '快速更新广告' : '配置广告策略';
        document.querySelector('#ad-policy-config-panel > .panel-desc').textContent = isTemplateReuseWorkflow() ? '核对新内容、主题配色和广告单元。上传新 TXT 后，以其域名导出站点。' : quick ? '匹配新 TXT，核对广告单元、模板和 GA。' : '预览原站，分别调整首页、详情页和全部文章页的广告。';
        setWorkflowExportButtonLabel('restoration-run', quick ? '更新广告并写入新目录' : '应用策略并生成新总目录');
        setWorkflowExportButtonLabel('restoration-run-zip', quick ? (batch ? '下载更新后的批量 ZIP' : '下载更新后的站点 ZIP') : '下载批量站点 ZIP');
        document.getElementById('ad-policy-export-panel').querySelector('h3').textContent = quick ? '更新广告并导出新副本' : '应用策略并导出新副本';
        document.getElementById('restoration-sites-input').multiple = !quick || batch;
        document.getElementById('ad-quick-code-input').multiple = batch;
        document.getElementById('ad-quick-code-button').textContent = batch ? '选择多个新广告 TXT' : '选择新广告 TXT';
        document.getElementById('ad-quick-code-button').disabled = adRestorationRunning;
        document.getElementById('ad-quick-code-clear').disabled = adRestorationRunning || !appState.adQuickCodes.length;
        document.querySelectorAll('[name="ad-policy-task"], [name="ad-quick-scope"], #ad-quick-switches').forEach(function(control) { control.disabled = adRestorationRunning; });
        if (!quick) return;
        var plan = planQuickAdUpdate(appState.adPolicySites, appState.adQuickCodes, quickUpdateOptions());
        var badCodes = appState.adQuickCodes.filter(function(code) { return !code.valid; });
        document.getElementById('ad-quick-code-status').textContent = '已选择 ' + appState.adQuickCodes.length + ' 份 TXT；' + plan.validCount + '/' + plan.mappings.length + ' 个目标站匹配成功。' + badCodes.map(function(code) { return code.fileName + '：' + code.errors.map(function(error) { return error.message; }).join('；'); }).join('；');
        document.getElementById('ad-quick-matches').innerHTML = plan.mappings.map(function(mapping) {
            var metadata = mapping.site.metadata;
            var code = mapping.code;
            var rows = [['bannerPath1', '横幅 1'], ['bannerPath2', '横幅 2'], ['bannerPath3', '横幅 3'], ['interstitialPath', '插屏'], ['anchorPath', '锚点']];
            return '<article class="ad-quick-match' + (mapping.valid ? '' : ' is-invalid') + '"><h4>' + escapeHtml(mapping.site.name) + '</h4><p>' + escapeHtml((metadata.adJsVersion || '版本未识别') + ' → ' + QUICK_AD_VERSION) + '</p>' +
                (mapping.valid ? '<p>' + escapeHtml('匹配 TXT：' + code.fileName) + '</p><dl>' + rows.map(function(row) {
                    return '<div><dt>' + row[1] + '</dt><dd><span>原：' + escapeHtml(metadata.embeddedConfig[row[0]] || '未配置') + '</span><span>新：' + escapeHtml(code.config[row[0]] || '未配置（不开启）') + '</span></dd></div>';
                }).join('') + '</dl><p>' + escapeHtml('GA：' + (code.config.analyticsID || metadata.embeddedConfig.analyticsID || '未配置') + '（' + (code.config.analyticsID ? '来自新 TXT' : '沿用原站') + '）') + '</p>' +
                ((code.warnings || []).length ? '<p>' + escapeHtml(code.warnings.map(function(item) { return item.message; }).filter(function(message) { return !/未识别到 Google Analytics/.test(message); }).join('；')) + '</p>' : '')
                    : '<p role="status">' + escapeHtml(mapping.errors.map(function(error) { return error.message; }).join('；')) + '</p>') + '</article>';
        }).join('') || '<p class="group-hint">请先导入网站。</p>';
    }

    function initQuickAdUpdate() {
        document.querySelectorAll('[name="ad-policy-task"], [name="ad-quick-scope"]').forEach(function(control) {
            control.addEventListener('change', function() {
                if (adRestorationRunning) return;
                if (control.name === 'ad-policy-task') appState.adPolicyTask = control.value;
                else appState.adQuickScope = control.value;
                appState.adPolicyPlacingSlot = null;
                updateWorkflowActionContext(appState.currentStep);
                updateAdRestorationControls();
            });
        });
        document.getElementById('ad-quick-switches').addEventListener('change', function() {
            appState.adQuickPreserveSwitches = this.value === 'preserve'; updateAdRestorationControls();
        });
        var input = document.getElementById('ad-quick-code-input');
        var selectionToken = 0;
        document.getElementById('ad-quick-code-button').addEventListener('click', function() { input.value = ''; input.click(); });
        input.addEventListener('change', async function() {
            var token = ++selectionToken;
            if (!input.files.length) return;
            adRestorationRunning = true;
            appState.adQuickCodes = [];
            updateAdRestorationControls();
            document.getElementById('ad-quick-code-status').textContent = '正在读取并匹配新广告 TXT…';
            try {
                var codes = await AdRestoration.readAdvertiserCodeFiles(Array.from(input.files));
                if (token === selectionToken) { appState.adQuickCodes = codes; updateAdRestorationControls(); }
            } catch (error) { showNotice(error.message, 'TXT 读取未完成'); }
            finally { adRestorationRunning = false; updateAdRestorationControls(); }
        });
        document.getElementById('ad-quick-code-clear').addEventListener('click', function() {
            selectionToken++; appState.adQuickCodes = []; input.value = ''; updateAdRestorationControls();
        });
    }

    function updateAdRestorationControls() {
        var siteStatus = document.getElementById('restoration-sites-status');
        var directoryStatus = document.getElementById('restoration-directory-status');
        var runButton = document.getElementById('restoration-run');
        var codeExportButton = document.getElementById('restoration-export-code');
        var workspace = document.getElementById('ad-policy-workspace');
        var sites = appState.adPolicySites || [];
        var validCount = sites.filter(function(site) { return site.metadata && site.metadata.valid; }).length;
        var policyCompatibleCount = sites.filter(function(site) {
            return site.metadata && site.metadata.valid && site.metadata.adJsVersion;
        }).length;
        var policyInvalid = appState.adPolicyGlobal && AdRestoration.validatePolicy(appState.adPolicyGlobal).length > 0;
        Object.keys(appState.adPolicyOverrides || {}).forEach(function(key) {
            if (AdRestoration.validatePolicy(appState.adPolicyOverrides[key]).length) policyInvalid = true;
        });
        if (siteStatus) {
            siteStatus.textContent = appState.adPolicySourceMode === 'archives' ? fileSelectionSummary(appState.adRestorationSiteFiles || [], '站点包') : '尚未选择';
            siteStatus.classList.toggle('is-ready', appState.adPolicySourceMode === 'archives' && sites.length > 0);
        }
        if (directoryStatus) {
            directoryStatus.textContent = appState.adPolicySourceMode === 'directory' && sites.length ? '已识别 ' + sites.length + ' 个站点' : '尚未选择';
            directoryStatus.classList.toggle('is-ready', appState.adPolicySourceMode === 'directory' && sites.length > 0);
        }
        if (workspace) workspace.hidden = sites.length === 0;
        if (runButton) runButton.disabled = adRestorationRunning || policyCompatibleCount === 0 || policyInvalid;
        if (runButton && isTemplateReuseWorkflow() && (appState.templateReuse.error || appState.templateReuse.loading || !appState.templateReuse.contentItems.length)) runButton.disabled = true;
        var zipButton = document.getElementById('restoration-run-zip');
        if (zipButton) zipButton.disabled = !runButton || runButton.disabled;
        if (codeExportButton) codeExportButton.disabled = adRestorationRunning || validCount === 0;
        if (isQuickAdUpdate()) {
            var quickPlan = planQuickAdUpdate(sites, appState.adQuickCodes, quickUpdateOptions());
            runButton.disabled = adRestorationRunning || quickPlan.validCount === 0;
            zipButton.disabled = runButton.disabled;
        }
        renderQuickAdUpdate();
        refreshAdPolicyContext();
    }

    async function inspectExportBlob(blob, siteName) {
        if (typeof SiteExportPreflight === 'undefined') throw new Error('导出前全站体检组件未加载，请刷新页面后重试。');
        var report = await SiteExportPreflight.inspectBlob(blob, window.JSZip, { siteName: siteName || '当前站点' });
        SiteExportPreflight.assertValid(report);
        return report;
    }

    function inspectOutputSites(output) {
        if (typeof SiteExportPreflight === 'undefined') throw new Error('导出前全站体检组件未加载，请刷新页面后重试。');
        var report = SiteExportPreflight.inspectSites(output && output.sites || []);
        if (output) output.preflightReport = report;
        SiteExportPreflight.assertValid(report);
        if (output && report.inheritedIssues && report.inheritedIssues.length) {
            output.report += '\r\n\r\n源站中已有的本地引用提示（原文件已保留）\r\n' + report.inheritedIssues.map(function(issue) {
                return (issue.siteName ? issue.siteName + '：' : '') + issue.message;
            }).join('\r\n') + '\r\n';
        }
        return report;
    }

    function renderExportPreflight(report, targetId) {
        if (typeof SiteExportPreflight === 'undefined' || !report) return;
        var target = typeof targetId === 'string' ? document.getElementById(targetId) : targetId;
        SiteExportPreflight.renderInto(target, report);
    }

    function renderAdRestorationResult(results, outputName, failedMessage, isFolder) {
        var target = document.getElementById('restoration-result');
        if (!target) return;
        results = results || [];
        var successful = results.filter(function(item) { return item.valid; });
        var failed = results.filter(function(item) { return !item.valid; });
        target.hidden = false;
        target.className = 'restoration-result ' + (successful.length && !failedMessage ? 'is-success' : 'is-error');
        var heading = failedMessage || (successful.length
            ? '已处理 ' + successful.length + ' 个站点' + (failed.length ? '，' + failed.length + ' 个未通过校验' : '')
            : '策略处理未完成');
        var html = '<h4>' + escapeHtml(heading) + '</h4>';
        if (outputName) html += '<p>' + (isFolder ? '已生成新的站点总目录：' : '已开始下载：') + '<strong>' + escapeHtml(outputName) + '</strong></p>';
        if (results.length) {
            html += '<ul>' + results.map(function(item) {
                var versionLabel = item.sourceAdJsVersion && item.adJsVersion && item.sourceAdJsVersion !== item.adJsVersion
                    ? item.sourceAdJsVersion + ' → ' + item.adJsVersion
                    : (item.adJsVersion || '版本未知');
                var detail = item.valid
                    ? '成功：' + (item.siteName || item.archiveName) + '（ad.js ' + versionLabel + '，' + (item.gaSource ? '快速更新，GA 来源：' + item.gaSource : item.overridden ? '单站覆盖' : '全局方案') + '，共 ' + item.changedPages + ' 个页面）'
                    : '失败：' + (item.siteName || item.archiveName) + (item.adJsVersion ? '（ad.js ' + item.adJsVersion + '）' : '') + '—' + (item.errors || []).map(function(error) { return error.message; }).join('；');
                return '<li>' + escapeHtml(detail) + '</li>';
            }).join('') + '</ul>';
        }
        target.innerHTML = html;
    }

    function renderRecognizedCodeResult(results, outputName, failedMessage) {
        var target = document.getElementById('restoration-result');
        if (!target) return;
        results = results || [];
        var successful = results.filter(function(item) { return item.valid; });
        var failed = results.filter(function(item) { return !item.valid; });
        target.hidden = false;
        target.className = 'restoration-result ' + (successful.length ? 'is-success' : 'is-error');
        var heading = successful.length
            ? '已导出 ' + successful.length + ' 个识别到的广告代码文件' + (failed.length ? '，' + failed.length + ' 个站点未通过识别' : '')
            : (failedMessage || '广告代码识别未完成');
        var html = '<h4>' + escapeHtml(heading) + '</h4>';
        if (outputName) html += '<p>已开始下载：<strong>' + escapeHtml(outputName) + '</strong></p>';
        if (results.length) {
            html += '<ul>' + results.map(function(item) {
                var detail = item.valid
                    ? item.archiveName + ' → ' + item.outputName
                    : '失败：' + item.archiveName + '—' + (item.errors || []).map(function(error) { return error.message; }).join('；');
                return '<li>' + escapeHtml(detail) + '</li>';
            }).join('') + '</ul>';
        }
        target.innerHTML = html;
    }

    async function saveRestorationBlob(blob, fileName) {
        // Native exports resolve after the actual file writer finishes.
        if (window.ArchiveExport && window.ArchiveExport.save) return await window.ArchiveExport.save(blob, fileName);
        if (typeof saveAs === 'function') {
            saveAs(blob, fileName);
            return;
        }
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    }

    var adPolicyPreview = createPolicyPreview();
    var adPolicyPreviewToken = '';
    var adPolicyPreviewTimer = null;

    function activeAdPolicySite() {
        return appState.adPolicySites.find(function(site) { return site.id === appState.adPolicyActiveSiteId; }) || appState.adPolicySites[0];
    }
    function adPolicyPageType(path, metadata) {
        if (path === metadata.homePath) return 'home';
        if ((metadata.listingPaths || []).indexOf(path) !== -1) return 'all';
        if ((metadata.detailPaths || []).indexOf(path) !== -1) return 'detail';
        return previewPageTypeForEntry(path, metadata.siteRoot);
    }

    /** 卡片仅展示策略；选择/取消不改值，放置和移除才保存单站覆盖。 */
    function renderAdPolicyPlacementCards(pageType) {
        var site = activeAdPolicySite();
        var reuseReady = isTemplateReuseWorkflow() && appState.templateReuse.contentItems.length
            && !appState.templateReuse.error && site && !site.templateReuseError;
        var metadata = site && (reuseReady ? templateReuseSiteFor(site).metadata : site.metadata);
        var page = pageType || (metadata && adPolicyPageType(appState.adPolicyPreviewPath, metadata));
        var manual = appState.adPolicyPlacementMode === 'manual';
        var placing = manual && appState.adPolicyPlacingSlot != null;
        var policy = site && (appState.adPolicyOverrides[site.id] || appState.adPolicyGlobal);
        var supported = policy && policy.slots[page];
        document.querySelectorAll('[name="ad-policy-placement-mode"]').forEach(function(input) { input.checked = input.value === appState.adPolicyPlacementMode; });
        document.getElementById('ad-policy-manual-controls').hidden = !manual;
        document.getElementById('ad-policy-placement-note').textContent = manual
            ? '手动放置以当前配置为起点；取消或切换页面不会丢失已保存的位置。'
            : '固定位置已生效，预览沿用当前策略；切换到手动放置时，会带入当前广告位置供你调整。';
        document.getElementById('ad-policy-placement-hint').hidden = !placing;
        document.getElementById('ad-policy-place-cancel').hidden = !placing;
        var names = { home: '首页', detail: '详情页', all: '全部文章' };
        var target = document.getElementById('ad-policy-slot-cards');
        if (!site) { target.innerHTML = ''; return; }
        target.innerHTML = [0, 1, 2].map(function(index) {
            var slot = supported && supported[index];
            var active = placing && appState.adPolicyPlacingSlot === index;
            var enabled = slot && slot.unit !== 'off';
            var positions = ['home', 'detail', 'all'].filter(function(type) { return policy.slots[type]; }).map(function(type) {
                var item = policy.slots[type][index];
                return names[type] + '：' + (item.unit === 'off' ? '未放置' : policyPlacementLabel(item.position));
            }).join(' | ');
            var unit = enabled ? slot.unit : 'banner' + (index + 1);
            return '<div class="ad-container-config' + (active ? ' is-placing' : '') + '"><div class="ad-slot-header"><span class="ad-slot-name">广告' + (index + 1) + '</span><div class="ad-slot-actions">' +
                '<button type="button" class="ad-select-btn" data-policy-place-slot="' + index + '" aria-pressed="' + active + '"' + (!supported || adRestorationRunning ? ' disabled' : '') + '>' + (active ? '取消放置' : enabled ? '重新放置' : '选择位置') + '</button>' +
                '<button type="button" class="ad-remove-btn" data-policy-remove-slot="' + index + '"' + (!enabled ? ' hidden' : '') + (adRestorationRunning ? ' disabled' : '') + '>移除</button></div></div>' +
                '<div class="ad-slot-meta">ID: div-gpt-ad-' + unit + ' · 位置 <span class="ad-position-label">' + escapeHtml(positions) + '</span></div></div>';
        }).join('');
        if (!supported) document.getElementById('ad-policy-placement-note').textContent = '请切换到首页、详情页或全部文章页放置广告；公共页面不参与广告放置。';
    }

    function saveAdPolicyPlacement(index, position, page) {
        var site = activeAdPolicySite();
        if (!site || adRestorationRunning || appState.adPolicyPlacementMode !== 'manual') return;
        var policy = editPolicyPlacement(appState.adPolicyOverrides[site.id] || appState.adPolicyGlobal, page, index, position);
        if (!policy) return;
        appState.adPolicyOverrides[site.id] = AdRestoration.normalizePolicy(policy);
        AdRestoration.rememberPolicyPositions(site, appState.adPolicyOverrides[site.id], 'slots.' + page + '.' + index + (position == null ? '.unit' : '.position'));
        markAdPolicyCustom();
        appState.adPolicyPlacingSlot = null;
        renderAdPolicySites(); updateAdRestorationControls();
    }

    // 状态同步不改写策略。全局与单站编辑器分别保留，切换站点不会丢失设置。
    function refreshAdPolicyContext() {
        var site = activeAdPolicySite();
        var select = document.getElementById('ad-policy-preview-site');
        if (!select) return;
        var signature = appState.adPolicySites.map(function(item) { return item.id; }).join('|');
        if (select.dataset.sites !== signature) {
            select.dataset.sites = signature;
            select.innerHTML = appState.adPolicySites.map(function(item) { return '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(item.name) + '</option>'; }).join('');
        }
        if (site) { appState.adPolicyActiveSiteId = site.id; select.value = site.id; }
        select.disabled = adRestorationRunning || !site;
        var override = site && appState.adPolicyOverrides[site.id];
        var toggle = document.getElementById('ad-policy-active-override');
        toggle.checked = !!override;
        toggle.disabled = !site || adRestorationRunning;
        document.getElementById('ad-policy-global-editor').hidden = !!override;
        document.getElementById('ad-policy-scope-status').textContent = override ? '正在编辑当前站点的独立策略。' : '正在编辑全局策略；没有开启单站覆盖的站点共同使用。';
        var code = site && appState.adPolicyCodeOverrides[site.id];
        document.getElementById('ad-policy-code-status').textContent = site ? (code ? '已替换：' + code.fileName : '使用原站 ad.js') + ' · ' + (isTemplateReuseWorkflow() && code ? '输出域名：' + code.detectedHost : site.metadata.detectedHost || '域名未识别') : '请先上传站点。';
        document.getElementById('ad-policy-code-upload').disabled = !site || adRestorationRunning;
        document.getElementById('ad-policy-code-restore').disabled = !code || adRestorationRunning;
        renderAdPolicyPlacementCards();
        if (isAdPolicyWorkflow() && appState.currentStep === 4) {
            if (adPolicyPreviewTimer) clearTimeout(adPolicyPreviewTimer);
            adPolicyPreviewTimer = setTimeout(function() { updateAdPolicyPreview(); }, 120);
        }
    }

    function templateReuseSiteFor(site) {
        if (!isTemplateReuseWorkflow() || !site) return site;
        var code = appState.adPolicyCodeOverrides[site.id];
        var host = code && code.detectedHost || site.metadata.detectedHost;
        var cached = site.templateReuseCache;
        if (cached && cached.items === appState.templateReuse.contentItems && cached.palette === appState.templateReuse.palette && cached.cardExcerptLines === appState.templateReuse.cardExcerptLines && cached.host === host) return cached.result;
        var original = Object.assign({}, site, { entries: site.templateEntries || site.entries });
        var result = reuseTemplateSite(original, appState.templateReuse, { host: host });
        appState.templateReuse.report = result.templateReuseReport;
        var reportTarget = document.getElementById('template-reuse-config-report');
        if (reportTarget) reportTarget.textContent = result.templateReuseReport.detailPages + ' 个新详情页 · ' + result.templateReuseReport.copiedAssets + ' 张本地图片' + (result.templateReuseReport.gameFiles ? ' · ' + result.templateReuseReport.gameFiles + ' 个本地游戏页面' : '') + ' · 广告默认保留原位置及开关';
        result = retargetTemplateHost(result, host);
        site.templateReuseCache = { items: appState.templateReuse.contentItems, palette: appState.templateReuse.palette, cardExcerptLines: appState.templateReuse.cardExcerptLines, host: host, result: result };
        return result;
    }

    function templateReuseSites() {
        return (appState.adPolicySites || []).map(templateReuseSiteFor);
    }

    function validateTemplateReuse() {
        if (!isTemplateReuseWorkflow()) return '';
        if (appState.templateReuse.readError) return appState.templateReuse.error = appState.templateReuse.readError;
        if (appState.templateReuse.loading) return '';
        try {
            (appState.adPolicySites || []).forEach(function(site) { inspectTemplate(site); });
            if (appState.templateReuse.contentItems.length) templateReuseSites();
            appState.templateReuse.error = '';
        } catch (error) { appState.templateReuse.error = error.message; }
        return appState.templateReuse.error;
    }

    function updateTemplateReuseControls() {
        var source = document.getElementById('template-reuse-source');
        if (!source) return;
        source.hidden = !isTemplateReuseWorkflow();
        var result = document.getElementById('template-reuse-result');
        var reuse = appState.templateReuse;
        document.getElementById('template-reuse-site-type').value = reuse.siteType;
        document.getElementById('template-reuse-article-source').hidden = reuse.siteType === 'games';
        document.getElementById('template-reuse-game-source').hidden = reuse.siteType !== 'games';
        document.getElementById('template-reuse-game-catalog').value = reuse.gameCatalogId;
        document.getElementById('template-reuse-game-retry').disabled = reuse.loading;
        validateTemplateReuse();
        if (result) {
            result.className = reuse.error ? 'migration-result error' : !reuse.loading && reuse.contentItems.length ? 'migration-result success' : 'migration-result pending';
            result.textContent = reuse.loading ? '正在读取内容并建立模板适配…' : reuse.error || (reuse.contentItems.length
                ? `已读取 ${reuse.contentItems.length} 项内容 · ${reuse.sourceName || reuse.sourceKind} · 将生成 ${reuse.contentItems.length} 个新详情页并移除多余旧内容页`
                : '尚未选择内容来源。');
        }
        var select = document.getElementById('template-reuse-theme');
        if (select && typeof STYLE_PRESETS !== 'undefined' && select.options.length <= 1) {
            STYLE_PRESETS.forEach(function(preset) {
                var option = document.createElement('option'); option.value = preset.id; option.textContent = preset.name; select.appendChild(option);
            });
        }
        if (select) select.value = reuse.paletteId || '';
        var excerptSelect = document.getElementById('template-reuse-excerpt-lines');
        if (excerptSelect) excerptSelect.value = reuse.cardExcerptLines || 'auto';
        var grid = document.getElementById('template-reuse-theme-grid');
        var presets = typeof STYLE_PRESETS !== 'undefined' ? STYLE_PRESETS : [];
        if (grid) {
            // 普通状态刷新不重建卡片，保留键盘焦点与面板的滚动位置。
            if (grid.childElementCount !== presets.length + 1) renderTemplateThemeCards(grid, presets, reuse.paletteId || '');
            grid.querySelectorAll('[data-template-theme]').forEach(function(button) {
                var selected = button.dataset.templateTheme === (reuse.paletteId || '');
                button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
            });
        }
        document.getElementById('template-reuse-theme-count').textContent = presets.length + ' 套';
        document.getElementById('template-reuse-theme-name').textContent = (presets.find(function(preset) { return preset.id === reuse.paletteId; }) || { name: '保留模板原配色' }).name;
    }

    var templateReuseImportToken = 0;
    function newTemplateReuseState() {
        return { siteType: 'editorial', gameCatalogId: 'builtin', contentItems: [], assets: [], gameFiles: {},
            sourceNotice: null, sourceName: '', sourceKind: '', paletteId: '', palette: null, cardExcerptLines: 'auto', report: null,
            sources: {}, readError: '', error: '', loading: false };
    }

    /** A source switch restores the last accepted data for that type. Pending
     * reads are invalidated, so an older archive cannot overwrite a newer choice. */
    function acceptTemplateReuseSource(parsed, name) {
        var reuse = appState.templateReuse;
        var accepted = { contentItems: parsed.items, assets: parsed.assets || [], sourceName: name || parsed.name,
            sourceKind: parsed.kind, gameFiles: parsed.gameFiles || {}, sourceNotice: parsed.sourceNotice || null,
            categories: parsed.categories || [] };
        reuse.sources[reuse.siteType] = accepted;
        Object.assign(reuse, accepted, { readError: '', error: '' });
    }

    async function handleTemplateGameSource(refreshChoices) {
        var token = ++templateReuseImportToken;
        var reuse = appState.templateReuse;
        reuse.loading = true; reuse.readError = ''; reuse.error = ''; reuse.contentItems = [];
        updateTemplateReuseControls(); updateAdRestorationControls();
        try {
            if (refreshChoices) {
                var choices = await listGameCatalogs();
                if (token !== templateReuseImportToken) return;
                var select = document.getElementById('template-reuse-game-catalog');
                select.replaceChildren();
                choices.forEach(function(choice) { var option = document.createElement('option'); option.value = choice.id; option.textContent = choice.name; select.appendChild(option); });
                if (!choices.some(function(choice) { return choice.id === reuse.gameCatalogId; })) reuse.gameCatalogId = 'builtin';
                select.value = reuse.gameCatalogId;
            }
            var catalog = await loadGameCatalog(reuse.gameCatalogId);
            var parsed = await gameCatalogContent(catalog);
            if (token !== templateReuseImportToken) return;
            acceptTemplateReuseSource(parsed);
        } catch (error) {
            if (token !== templateReuseImportToken) return;
            reuse.readError = error.message; reuse.error = error.message;
        } finally {
            if (token === templateReuseImportToken) {
                reuse.loading = false; updateTemplateReuseControls(); updateAdRestorationControls();
                if (!reuse.error && appState.currentStep === 4) updateAdPolicyPreview();
            }
        }
    }

    async function handleTemplateReuseContent(file, kind) {
        var token = ++templateReuseImportToken;
        appState.templateReuse.loading = true;
        appState.templateReuse.readError = ''; appState.templateReuse.error = '';
        var result = document.getElementById('template-reuse-result');
        if (result) { result.className = 'migration-result pending'; result.textContent = '正在读取内容并建立模板适配…'; }
        try {
            var engine = typeof AdRestoration !== 'undefined' ? AdRestoration : {};
            var parsed = await readTemplateReuseContent(file, kind, {
                readArchive: engine.readArchiveEntries,
                onStage: function(stage) {
                    // A superseded upload must not replace the newer file's status.
                    if (token === templateReuseImportToken && result && stage) result.textContent = stage;
                }
            });
            if (token !== templateReuseImportToken) return;
            acceptTemplateReuseSource(parsed, file.name);
            updateTemplateReuseControls();
            if (!appState.templateReuse.error && appState.currentStep === 4) updateAdPolicyPreview();
        } catch (error) {
            if (token !== templateReuseImportToken) return;
            appState.templateReuse.contentItems = [];
            appState.templateReuse.assets = [];
            appState.templateReuse.error = error.message;
            appState.templateReuse.readError = error.message;
            if (result) { result.className = 'migration-result error'; result.textContent = '内容读取失败：' + error.message; }
        } finally { if (token === templateReuseImportToken) { appState.templateReuse.loading = false; updateTemplateReuseControls(); updateAdRestorationControls(); } }
    }

    function updateAdPolicyPreview(pageType) {
        if (!isAdPolicyWorkflow() || appState.currentStep !== 4) return;
        var site = activeAdPolicySite();
        if (!site) return;
        // An unsupported template remains listed for its ad recognition, but
        // background preview/control refreshes must not attempt transformation.
        if (isTemplateReuseWorkflow() && (appState.templateReuse.error || site.templateReuseError)) {
            setPreviewDocument(previewErrorDocument(new Error(appState.templateReuse.error || site.templateReuseError)));
            return;
        }
        var previewSite = templateReuseSiteFor(site);
        var metadata = previewSite.metadata;
        var paths = appState.adPolicySites.length && previewSite.entries.filter(function(entry) { return /\.html?$/i.test(entry.path) && entry.path.indexOf(metadata.siteRoot) === 0 && !/(?:^|\/)vendor-games\//i.test(entry.path); }).map(function(entry) { return entry.path; });
        if (pageType) {
            appState.adPolicyPlacingSlot = null;
            appState.adPolicyPreviewPath = pageType === 'home' ? metadata.homePath : pageType === 'all' ? (metadata.listingPaths || [])[0] : pageType === 'detail' ? metadata.detailPaths[0] : paths.find(function(path) { return adPolicyPageType(path, metadata) === pageType; });
        }
        if (paths.indexOf(appState.adPolicyPreviewPath) === -1) appState.adPolicyPreviewPath = metadata.homePath;
        var path = appState.adPolicyPreviewPath;
        var type = adPolicyPageType(path, metadata);
        renderAdPolicyPlacementCards(type);
        var picker = document.getElementById('ad-policy-preview-page');
        picker.innerHTML = paths.map(function(item) { return '<option value="' + escapeHtml(item) + '">' + escapeHtml(item.slice(metadata.siteRoot.length)) + '</option>'; }).join('');
        picker.value = path;
        document.getElementById('preview-site-switcher').hidden = true;
        document.querySelectorAll('.preview-tab').forEach(function(tab) {
            var name = tab.dataset.page;
            tab.hidden = name === 'all' ? !metadata.listingPaths.length : name === 'detail' ? !metadata.detailPaths.length : name === 'home' ? false : !paths.some(function(item) { return adPolicyPageType(item, metadata) === name; });
            tab.classList.toggle('active', name === type);
        });
        var policy = appState.adPolicyOverrides[site.id] || appState.adPolicyGlobal;
        var quickMapping = isQuickAdUpdate() && planQuickAdUpdate(appState.adPolicySites, appState.adQuickCodes, quickUpdateOptions()).mappings.find(function(item) { return item.site.id === site.id; });
        var prepared = isQuickAdUpdate()
            ? quickMapping && quickMapping.valid ? prepareQuickAdUpdate(site, quickMapping.code, quickUpdateOptions(), AdRestoration) : { valid: false, errors: quickMapping ? quickMapping.errors : [{ message: '当前站点不在本次更新范围中。' }] }
            : AdRestoration.preparePolicySite(previewSite, policy, { adJsVersionMode: appState.adPolicyAdJsVersion, codeOverride: appState.adPolicyCodeOverrides[site.id], preserveOriginalPlacements: true });
        if (!prepared.valid) {
            setPreviewDocument('<!doctype html><html><meta charset="utf-8"><body><p>' + escapeHtml(prepared.errors.map(function(error) { return error.message; }).join('；')) + '</p></body></html>');
            return;
        }
        adPolicyPreviewToken = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now());
        previewFrame.removeAttribute('src');
        // 每次进入策略/模板复用均显式设置，避免依赖前一个工作流留下的状态。
        // 上传脚本可执行，但始终不能读取工作台 DOM、Cookie 或真实存储。
        previewFrame.setAttribute('sandbox', 'allow-scripts');
        var placing = !isQuickAdUpdate() && appState.adPolicyPlacementMode === 'manual' && ['home', 'detail', 'all'].indexOf(type) !== -1 ? appState.adPolicyPlacingSlot : null;
        var resolvedSlots = (prepared.policy || policy).slots[type] || [];
        var occupied = resolvedSlots.filter(function(slot, index) { return index !== placing && slot.unit !== 'off'; }).map(function(slot) { return slot.position; });
        setPreviewDocument(adPolicyPreview.build(prepared.entries, path, metadata, {
            token: adPolicyPreviewToken, page: type, placing: placing,
            selectedUnit: placing != null && resolvedSlots[placing] && resolvedSlots[placing].unit,
            showCustom: document.getElementById('ad-policy-show-custom').checked,
            placeMarkers: function(html) { return AdRestoration.previewPlacementHtml(html, type, commonPolicyPlacements(type), occupied); }
        }));
    }

    function initAdPolicyWorkbench() {
        var config = document.getElementById('ad-policy-config-content');
        config.appendChild(document.getElementById('ad-policy-workspace'));
        var exportPanel = document.getElementById('ad-policy-export-panel');
        var upload = document.getElementById('ad-restoration-setup');
        ['.restoration-rule-note', '.restoration-actions', '.restoration-action-help', '#restoration-result'].forEach(function(selector) {
            var element = upload.querySelector(selector); if (element) exportPanel.appendChild(element);
        });
        document.getElementById('ad-policy-preview-site').addEventListener('change', function() {
            appState.adPolicyActiveSiteId = this.value; appState.adPolicyPreviewPath = ''; appState.adPolicyPlacingSlot = null;
            renderAdPolicySites(); updateAdRestorationControls();
        });
        document.getElementById('ad-policy-preview-page').addEventListener('change', function() {
            appState.adPolicyPreviewPath = this.value; appState.adPolicyPlacingSlot = null; updateAdPolicyPreview();
        });
        document.getElementById('ad-policy-active-override').addEventListener('change', function() {
            var site = activeAdPolicySite(); if (!site) return;
            if (this.checked) appState.adPolicyOverrides[site.id] = cloneAdPolicy(appState.adPolicyGlobal);
            else delete appState.adPolicyOverrides[site.id];
            markAdPolicyCustom();
            renderAdPolicySites(); updateAdRestorationControls();
        });
        document.querySelectorAll('[name="ad-policy-placement-mode"]').forEach(function(input) {
            input.addEventListener('change', function() {
                appState.adPolicyPlacementMode = input.value; appState.adPolicyPlacingSlot = null; updateAdRestorationControls();
            });
        });
        document.getElementById('ad-policy-slot-cards').addEventListener('click', function(event) {
            var button = event.target.closest('[data-policy-place-slot], [data-policy-remove-slot]');
            var site = activeAdPolicySite();
            if (!button || button.disabled || !site || appState.adPolicyPlacementMode !== 'manual') return;
            if (button.hasAttribute('data-policy-remove-slot')) {
                saveAdPolicyPlacement(Number(button.dataset.policyRemoveSlot), null, adPolicyPageType(appState.adPolicyPreviewPath, templateReuseSiteFor(site).metadata));
                return;
            }
            var index = Number(button.dataset.policyPlaceSlot);
            appState.adPolicyPlacingSlot = appState.adPolicyPlacingSlot === index ? null : index;
            updateAdPolicyPreview();
        });
        document.getElementById('ad-policy-show-custom').addEventListener('change', function() { updateAdPolicyPreview(); });
        document.getElementById('ad-policy-place-cancel').addEventListener('click', function() { appState.adPolicyPlacingSlot = null; updateAdPolicyPreview(); });
        var codeFile = document.getElementById('ad-policy-code-file');
        var codeTargetId = '';
        document.getElementById('ad-policy-code-upload').addEventListener('click', function() {
            var site = activeAdPolicySite(); codeTargetId = site && site.id || ''; codeFile.value = ''; codeFile.click();
        });
        codeFile.addEventListener('change', async function() {
            var site = appState.adPolicySites.find(function(item) { return item.id === codeTargetId; }) || activeAdPolicySite();
            var file = codeFile.files[0]; if (!site || !file) return;
            var code = AdRestoration.inspectCodeText(await file.text(), file.name);
            // Template reuse explicitly pairs this TXT to the selected template;
            // other ad workflows retain strict original-domain matching.
            var candidateSite = isTemplateReuseWorkflow() ? siteForReplacementCode(site, code) : site;
            var candidate = AdRestoration.preparePolicySite(candidateSite, appState.adPolicyOverrides[site.id] || appState.adPolicyGlobal, { codeOverride: code, adJsVersionMode: appState.adPolicyAdJsVersion });
            if (!candidate.valid) { showNotice(candidate.errors.map(function(error) { return error.message; }).join('；'), '广告代码替换未通过校验'); return; }
            appState.adPolicyCodeOverrides[site.id] = code;
            updateAdRestorationControls();
        });
        document.getElementById('ad-policy-code-restore').addEventListener('click', function() {
            var site = activeAdPolicySite(); if (site) delete appState.adPolicyCodeOverrides[site.id]; updateAdRestorationControls();
        });
        window.addEventListener('message', function(event) {
            var data = event.data || {};
            if (!isAdPolicyWorkflow() || appState.currentStep !== 4 || event.source !== previewFrame.contentWindow || data.token !== adPolicyPreviewToken) return;
            var site = activeAdPolicySite(); if (!site) return;
            if (data.type === 'ad-policy-nav') {
                var navigationSite = templateReuseSiteFor(site);
                var entry = adPolicyPreview.resolveNavigation(navigationSite.entries, data.href, appState.adPolicyPreviewPath, site.metadata.siteRoot, [site.metadata.detectedHost, navigationSite.metadata.detectedHost]);
                if (entry) { appState.adPolicyPreviewPath = entry.path; appState.adPolicyPlacingSlot = null; updateAdPolicyPreview(); }
                return;
            }
            if (data.type !== 'ad-policy-place' || appState.adPolicyPlacingSlot == null || data.page !== adPolicyPageType(appState.adPolicyPreviewPath, templateReuseSiteFor(site).metadata)) return;
            var allowed = commonPolicyPlacements(data.page).some(function(candidate) { return candidate.position === data.position; });
            if (!allowed && !/^custom-after-\d{1,3}(?:-\d{1,3}){0,7}$/.test(data.position)) return;
            // 所有预览点击保存到当前站点；不会把某个模板的 DOM 位置推广到其他站点。
            saveAdPolicyPlacement(appState.adPolicyPlacingSlot, data.position, data.page);
        });
    }

    function initAdRestorationControls() {
        var directoryButton = document.getElementById('restoration-directory-button');
        var directoryInput = document.getElementById('restoration-directory-input');
        var siteButton = document.getElementById('restoration-sites-button');
        var siteInput = document.getElementById('restoration-sites-input');
        var runButton = document.getElementById('restoration-run');
        var codeExportButton = document.getElementById('restoration-export-code');
        if (!runButton || runButton.dataset.ready === 'true') return;
        runButton.dataset.ready = 'true';
        initAdPolicyWorkbench();
        initQuickAdUpdate();
        appState.adPolicyGlobal = AdRestoration.createPolicy('restore-original', { pageIsolation: true });
        populatePolicyEditor(document.getElementById('ad-policy-global-editor'), appState.adPolicyGlobal);
        renderAdPolicySites();

        async function scanSource(mode, files) {
            adRestorationReadError = '';
            var scanProgress = document.getElementById('restoration-scan-progress');
            var scanFill = document.getElementById('restoration-scan-progress-fill');
            var scanText = document.getElementById('restoration-scan-progress-text');
            var resultTarget = document.getElementById('restoration-result');
            if (scanProgress) scanProgress.hidden = false;
            if (scanFill) scanFill.style.width = '0%';
            if (resultTarget) resultTarget.hidden = true;
            adRestorationRunning = true;
            updateAdRestorationControls();
            try {
                var progressCallback = function(percent, message) { if (scanFill) scanFill.style.width = percent + '%'; if (scanText) scanText.textContent = message; };
                // 同事建站工具生成的静态游戏站使用 games.html 与 games/*.html。
                // 仅在“快速更新广告”模式打开这一识别分支，详细策略继续使用原有站点边界。
                var scanOptions = isQuickAdUpdate() ? { quickUpdate: true } : undefined;
                var scan = mode === 'directory-handle'
                    ? await AdRestoration.readSiteDirectoryHandle(files, progressCallback, scanOptions)
                    : mode === 'directory'
                        ? await AdRestoration.readSiteDirectoryFiles(files, progressCallback, scanOptions)
                        : await AdRestoration.readSiteArchiveFiles(files, progressCallback, scanOptions);
                appState.adPolicySites = scan.sites;
                if (isTemplateReuseWorkflow()) {
                    appState.adPolicySites.forEach(function(site) {
                        site.templateEntries = (site.entries || []).map(function(entry) { return { path: entry.path, bytes: entry.bytes ? new Uint8Array(entry.bytes) : entry.bytes }; });
                        // Ad recognition and template compatibility are separate
                        // results. Keep the recognized site even if its content
                        // structure is unsupported, so its real error survives.
                        try { inspectTemplate(site); site.templateReuseError = ''; }
                        catch (error) { site.templateReuseError = error.message; }
                    });
                }
                appState.adQuickCodes = [];
                appState.adPolicySourceMode = mode === 'archives' ? 'archives' : 'directory';
                appState.adPolicyOverrides = {};
                appState.adPolicyCodeOverrides = {};
                // 重新导入策略副本时延续已保存的开关、映射和位置，仍可一键恢复默认。
                scan.sites.forEach(function(site) {
                    if (isTemplateReuseWorkflow()) {
                        appState.adPolicyOverrides[site.id] = templateOriginalPolicy(site, AdRestoration);
                        return;
                    }
                    var entry = site.entries.find(function(item) { return item.path === site.metadata.siteRoot + 'ad-policy.json'; });
                    if (!entry) return;
                    try {
                        var saved = JSON.parse(entryTextForPreview(entry));
                        if (saved.policy && saved.policy.slots) appState.adPolicyOverrides[site.id] = AdRestoration.normalizePolicy(Object.assign({}, saved.policy, { version: 2 }));
                    } catch (error) { /* 不完整的旧清单不覆盖新工作台的安全默认值。 */ }
                });
                var importedPreset = document.getElementById('ad-policy-preset');
                if (importedPreset && Object.keys(appState.adPolicyOverrides).length) {
                    importedPreset.value = 'custom';
                }
                appState.adPolicyActiveSiteId = scan.sites[0] && scan.sites[0].id || '';
                appState.adPolicyPreviewPath = '';
                resetWorkflowStepProgress(currentWorkflowProgressKey());
                if (scanFill) scanFill.style.width = '100%';
                if (scanText) scanText.textContent = '已识别 ' + scan.sites.length + ' 个站点、' + scan.fileCount + ' 个文件';
                renderAdPolicySites();
            } catch (error) {
                adRestorationReadError = error.message;
                appState.adPolicySites = [];
                appState.adPolicySourceMode = '';
                if (scanText) scanText.textContent = '目录识别未完成：' + error.message;
                renderAdRestorationResult([], '', error.message, false);
            } finally {
                adRestorationRunning = false;
                updateAdRestorationControls();
                updateTemplateReuseControls();
            }
        }

        if (directoryButton && directoryInput) directoryButton.addEventListener('click', function() {
            var supportsLocalDirectory = typeof window.showDirectoryPicker === 'function';
            var message = supportsLocalDirectory
                ? '工具只在当前浏览器中读取所选目录，用于识别站点和广告配置；不会上传到服务器，也不会修改源文件。\n\n确认后，请选择包含多个站点文件夹的总目录。'
                : '当前浏览器不支持新版的本地目录读取，将改用兼容方式。浏览器可能继续显示批量文件确认；这是浏览器安全提示，网页无法更改它的样式。';
            showConfirm(message, supportsLocalDirectory ? '读取站点总目录' : '使用兼容目录选择', supportsLocalDirectory ? '选择目录' : '使用兼容方式', async function(confirmed) {
                if (!confirmed) return;
                if (!supportsLocalDirectory) {
                    directoryInput.value = '';
                    directoryInput.click();
                    return;
                }
                try {
                    var directoryHandle = await window.showDirectoryPicker({ mode: 'read', id: 'ad-policy-source' });
                    await scanSource('directory-handle', directoryHandle);
                } catch (error) {
                    if (error && error.name === 'AbortError') return;
                    renderAdRestorationResult([], '', '无法读取所选目录：' + (error && error.message ? error.message : '请重新选择目录。'), false);
                }
            }, { variant: 'directory', symbol: '↗', eyebrow: '仅在本机处理', cancelLabel: '取消' });
        });
        if (directoryInput) directoryInput.addEventListener('change', function() {
            if (this.files && this.files.length) scanSource('directory', Array.from(this.files));
        });

        if (siteButton && siteInput) siteButton.addEventListener('click', function() {
            siteInput.value = '';
            siteInput.click();
        });
        if (siteInput) siteInput.addEventListener('change', function() {
            if (this.files && this.files.length) {
                appState.adRestorationSiteFiles = Array.from(this.files);
                scanSource('archives', appState.adRestorationSiteFiles);
            }
        });
        var templateContentButton = document.getElementById('template-reuse-content-button');
        document.getElementById('template-reuse-site-type').addEventListener('change', function() {
            ++templateReuseImportToken;
            var reuse = appState.templateReuse;
            reuse.siteType = this.value === 'games' ? 'games' : 'editorial';
            Object.assign(reuse, { contentItems: [], assets: [], gameFiles: {}, sourceNotice: null, sourceName: '', sourceKind: '', readError: '', error: '', loading: false }, reuse.sources[reuse.siteType] || {});
            updateTemplateReuseControls();
            if (reuse.siteType === 'games') handleTemplateGameSource(true);
            else { updateAdRestorationControls(); if (reuse.contentItems.length && appState.currentStep === 4) updateAdPolicyPreview(); }
        });
        document.getElementById('template-reuse-game-catalog').addEventListener('change', function() {
            appState.templateReuse.gameCatalogId = this.value;
            handleTemplateGameSource(false);
        });
        document.getElementById('template-reuse-game-retry').addEventListener('click', function() { handleTemplateGameSource(true); });
        var templateContentInput = document.getElementById('template-reuse-content-input');
        var templateSiteButton = document.getElementById('template-reuse-site-button');
        var templateSiteInput = document.getElementById('template-reuse-site-input');
        if (templateContentButton && templateContentInput) templateContentButton.addEventListener('click', function() { templateContentInput.value = ''; templateContentInput.click(); });
        if (templateContentInput) templateContentInput.addEventListener('change', function() { var file = this.files && this.files[0]; if (file) handleTemplateReuseContent(file, 'content'); });
        if (templateSiteButton && templateSiteInput) templateSiteButton.addEventListener('click', function() { templateSiteInput.value = ''; templateSiteInput.click(); });
        if (templateSiteInput) templateSiteInput.addEventListener('change', function() { var file = this.files && this.files[0]; if (file) handleTemplateReuseContent(file, 'static'); });
        var templateTheme = document.getElementById('template-reuse-theme');
        var templateExcerpt = document.getElementById('template-reuse-excerpt-lines');
        if (templateExcerpt) {
            // Copy the ordinary builder's option labels and values. Additional
            // numeric choices extend the confirmed 1–10 range without changing
            // the ordinary workflow's defaults or existing control state.
            var ordinaryExcerpt = document.getElementById('card-excerpt-lines');
            for (var lines = 1; lines <= 10; lines++) {
                var sourceOption = ordinaryExcerpt && ordinaryExcerpt.querySelector('option[value="' + lines + '"]');
                var option = sourceOption ? sourceOption.cloneNode(true) : new Option(lines + ' 行', String(lines));
                option.removeAttribute('selected'); templateExcerpt.appendChild(option);
            }
            var fullOption = ordinaryExcerpt && ordinaryExcerpt.querySelector('option[value="none"]');
            templateExcerpt.appendChild(fullOption ? fullOption.cloneNode(true) : new Option('完整显示（不截断）', 'none'));
            templateExcerpt.value = appState.templateReuse.cardExcerptLines;
            templateExcerpt.addEventListener('change', function() {
                appState.templateReuse.cardExcerptLines = templateExcerpt.value;
                updateTemplateReuseControls();
                if (appState.currentStep === 4) updateAdPolicyPreview();
            });
        }
        document.getElementById('template-reuse-theme-grid').addEventListener('click', function(event) {
            var button = event.target.closest('[data-template-theme]');
            if (!button || adRestorationRunning) return;
            templateTheme.value = button.dataset.templateTheme;
            templateTheme.dispatchEvent(new Event('change', { bubbles: true }));
        });
        if (templateTheme) templateTheme.addEventListener('change', function() {
            var preset = typeof STYLE_PRESETS !== 'undefined' ? STYLE_PRESETS.find(function(item) { return item.id === templateTheme.value; }) : null;
            appState.templateReuse.paletteId = templateTheme.value;
            appState.templateReuse.palette = preset || null;
            updateTemplateReuseControls();
            if (appState.currentStep === 4) updateAdPolicyPreview();
        });
        var globalEditor = document.getElementById('ad-policy-global-editor');
        if (globalEditor) globalEditor.addEventListener('change', function(event) {
            appState.adPolicyGlobal = readChangedPolicyEditor(globalEditor, event.target);
            // 全局位置编辑只影响使用全局方案的站点；单站原位置不会被顺带改写。
            appState.adPolicySites.forEach(function(site) {
                if (!appState.adPolicyOverrides[site.id]) AdRestoration.rememberPolicyPositions(site, appState.adPolicyGlobal, event.target.dataset.policyField || 'none');
            });
            markAdPolicyCustom();
            updateAdRestorationControls();
        });
        var presetSelect = document.getElementById('ad-policy-preset');
        if (presetSelect) presetSelect.addEventListener('change', function() {
            if (this.value === 'custom') return;
            // 位置记录由真实编辑更新，预设生成的临时位置不回写各站原位置。
            var presetName = this.value === 'restore' ? 'restore-original' : this.value;
            appState.adPolicyGlobal = AdRestoration.createPolicy(presetName, { pageIsolation: true });
            // “完全恢复”明确作用于全部站点；原有单站位置已分别保存，TXT 仍属于指定站点。
            if (this.value === 'restore') appState.adPolicyOverrides = {};
            populatePolicyEditor(globalEditor, appState.adPolicyGlobal);
            renderAdPolicySites();
            updateAdRestorationControls();
        });
        var adVersionSelect = document.getElementById('ad-policy-ad-version');
        if (adVersionSelect) {
            adVersionSelect.value = appState.adPolicyAdJsVersion;
            adVersionSelect.addEventListener('change', function() {
                // 版本选择只控制输出模板，广告路径与页面策略继续使用各站已识别配置。
                appState.adPolicyAdJsVersion = normalizePolicyAdJsVersion(this.value);
                renderAdPolicySites();
                updateAdRestorationControls();
            });
        }
        async function exportAdPolicy(useDirectory) {
            if (adRestorationRunning || typeof AdRestoration === 'undefined') return;
            if (isTemplateReuseWorkflow() && (appState.templateReuse.loading || validateTemplateReuse())) {
                showNotice(appState.templateReuse.error || '内容仍在读取中，请稍候。', '模板复用尚未通过校验');
                return;
            }
            var destinationHandle = null;
            if (useDirectory && typeof window.showDirectoryPicker === 'function') {
                try {
                    destinationHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                } catch (pickerError) {
                    if (pickerError && pickerError.name === 'AbortError') return;
                }
            }
            adRestorationRunning = true;
            updateAdRestorationControls();
            var resultTarget = document.getElementById('restoration-result');
            if (resultTarget) resultTarget.hidden = true;
            updateWorkflowExportProgress('restoration-progress', 0, '正在准备广告策略导出…');
            try {
                appState.adPolicyGlobal = readPolicyEditor(globalEditor);
                // 业务任务仍报告原有进度，最后 12% 留给目录写入或 ZIP 打包。
                var reportProgress = function(percent, message) {
                    updateWorkflowExportProgress('restoration-progress', Math.min(percent, 88), message);
                };
                var policySites = isTemplateReuseWorkflow() ? templateReuseSites() : appState.adPolicySites;
                var output = isQuickAdUpdate()
                    ? await applyQuickAdUpdate(policySites, appState.adQuickCodes, quickUpdateOptions(), AdRestoration, reportProgress)
                    : await AdRestoration.applyPolicyBatch(
                    policySites,
                    appState.adPolicyGlobal,
                    appState.adPolicyOverrides,
                    reportProgress,
                    { adJsVersionMode: appState.adPolicyAdJsVersion, codeOverrides: appState.adPolicyCodeOverrides, preserveOriginalPlacements: true }
                );
                updateWorkflowExportProgress('restoration-progress', null, '正在进行导出前全站体检…');
                var preflightReport = inspectOutputSites(output);
                if (destinationHandle) {
                    await AdRestoration.writePolicyBatchToDirectory(output, destinationHandle, function(percent, message) {
                        updateWorkflowExportProgress('restoration-progress', 88 + Math.round(percent * .12), message);
                    });
                    renderAdRestorationResult(output.results, output.folderName, '', true);
                } else {
                    updateWorkflowExportProgress('restoration-progress', 88, '正在生成批量 ZIP…');
                    var blob = await AdRestoration.zipPolicyBatch(output);
                    var fileName = output.folderName + '.zip';
                    await saveRestorationBlob(blob, fileName);
                    renderAdRestorationResult(output.results, fileName, '', false);
                }
                // 部分站点失败时显示结果提示，避免将整个批次标成全部成功。
                var policyHasFailures = output.results.some(function(result) { return !result.valid; });
                updateWorkflowExportProgress('restoration-progress', 100, policyHasFailures ? '处理结束，部分站点未导出，请查看处理结果。' : '广告策略导出完成。', policyHasFailures ? 'error' : 'success');
                renderExportPreflight(preflightReport, 'restoration-result');
            } catch (error) {
                updateWorkflowExportProgress('restoration-progress', null, '策略处理未完成：' + error.message, 'error');
                renderAdRestorationResult(error.results || [], '', error.message, false);
                renderExportPreflight(error.preflightReport, 'restoration-result');
            } finally {
                adRestorationRunning = false;
                updateAdRestorationControls();
            }
        }
        runButton.addEventListener('click', function() { exportAdPolicy(true); });
        document.getElementById('restoration-run-zip').addEventListener('click', function() { exportAdPolicy(false); });
        if (codeExportButton) codeExportButton.addEventListener('click', async function() {
            if (adRestorationRunning || typeof AdRestoration === 'undefined') return;
            adRestorationRunning = true;
            updateAdRestorationControls();
            var resultTarget = document.getElementById('restoration-result');
            if (resultTarget) resultTarget.hidden = true;
            updateWorkflowExportProgress('restoration-progress', 0, '正在导出识别到的广告代码…');
            try {
                var output = await AdRestoration.exportRecognizedCodesForGroups(appState.adPolicySites.map(function(site) {
                    var code = appState.adPolicyCodeOverrides[site.id];
                    return code ? Object.assign({}, site, { metadata: Object.assign({}, site.metadata, { embeddedConfig: code.config, detectedHost: code.detectedHost }) }) : site;
                }));
                await saveRestorationBlob(output.blob, output.fileName);
                var codeHasFailures = output.results.some(function(result) { return !result.valid; });
                updateWorkflowExportProgress('restoration-progress', 100, codeHasFailures ? '处理结束，部分站点未通过识别，请查看结果。' : '广告代码导出完成，请查看识别结果。', codeHasFailures ? 'error' : 'success');
                renderRecognizedCodeResult(output.results, output.fileName, '');
            } catch (error) {
                updateWorkflowExportProgress('restoration-progress', null, '广告代码识别未完成：' + error.message, 'error');
                renderRecognizedCodeResult(error.results || [], '', error.message);
            } finally {
                adRestorationRunning = false;
                updateAdRestorationControls();
            }
        });
        updateAdRestorationControls();
        updateTemplateReuseControls();
    }

    function renderAdInjectionMappings() {
        var panel = document.getElementById('injection-mapping');
        var title = document.getElementById('injection-mapping-title');
        var list = document.getElementById('injection-mapping-list');
        var sites = appState.adInjectionSites || [];
        var codes = appState.adInjectionCodes || [];
        if (!panel || !list) return { mappings: [], validCount: 0 };
        panel.hidden = sites.length === 0;
        if (!sites.length) {
            list.innerHTML = '';
            return { mappings: [], validCount: 0 };
        }
        var match = AdRestoration.matchAdCodesToSites(sites, codes);
        if (title) title.textContent = '已识别 ' + sites.length + ' 个站点，' + match.validCount + ' 个可处理';
        var items = match.mappings.map(function(mapping) {
            var messages = (mapping.errors || []).map(function(error) { return error.message; });
            var state = mapping.valid ? '已匹配 ' + mapping.host : (messages[0] || '等待匹配广告代码');
            return '<div class="injection-mapping-item ' + (mapping.valid ? 'is-valid' : 'is-invalid') + '">' +
                '<strong title="' + escapeHtml(mapping.siteName) + '">' + escapeHtml(mapping.siteName) + '</strong>' +
                '<span>' + escapeHtml(mapping.framework || '未识别站点类型') + '</span>' +
                '<span class="injection-match-state">' + escapeHtml(state) + '</span></div>';
        });
        codes.filter(function(code) { return !code.valid; }).forEach(function(code) {
            var message = (code.errors || []).map(function(error) { return error.message; }).join('；') || '广告代码无效';
            items.push('<div class="injection-mapping-item is-invalid"><strong>' + escapeHtml(code.fileName || '广告代码 TXT') + '</strong><span>广告代码校验未通过</span><span class="injection-match-state">' + escapeHtml(message) + '</span></div>');
        });
        list.innerHTML = items.join('');
        return match;
    }

    var AD_INJECTION_FIELDS = [
        ['bannerPath1', 'Banner 1'], ['bannerPath2', 'Banner 2'], ['bannerPath3', 'Banner 3'],
        ['interstitialPath', 'Interstitial（INT）'], ['anchorPath', 'Anchor（ANC）'], ['analyticsID', 'Google Analytics']
    ];

    function isAdPathValue(value) { return /^\/[A-Za-z0-9_./-]+$/.test(String(value || '')); }
    function isGaValue(value) { return /^G-[A-Z0-9]+$/i.test(String(value || '')); }

    function refreshAdInjectionCodeValidity(code) {
        if (!code) return;
        var config = code.config || {};
        var missing = ['bannerPath1', 'bannerPath2', 'bannerPath3'].filter(function(key) { return !isAdPathValue(config[key]); });
        code.errors = (code.errors || []).filter(function(error) { return error.code !== 'AD_CODE_SLOT_MISSING' && error.code !== 'AD_CODE_MANUAL_INVALID'; });
        if (missing.length && !appState.adInjectionAllowPartial) code.errors.push({ code: 'AD_CODE_SLOT_MISSING', message: '广告代码中未识别到 ' + missing.join('、') + '。' });
        if (config.analyticsID && !isGaValue(config.analyticsID)) code.errors.push({ code: 'AD_CODE_MANUAL_INVALID', message: 'GA Measurement ID 必须以 G- 开头，不能填写 GAM 广告路径。' });
        var primaryPath = config.bannerPath1 || config.bannerPath2 || config.bannerPath3 || '';
        var hostMatch = String(primaryPath).match(/\/([^/]+)-(?:banner[123]|int|anc)$/i);
        if (hostMatch) code.detectedHost = hostMatch[1].toLowerCase();
        code.valid = code.errors.length === 0 || (appState.adInjectionAllowPartial && Object.keys(config).some(function(key) { return /^bannerPath[123]$/.test(key) && isAdPathValue(config[key]); }));
        code.allowPartial = appState.adInjectionAllowPartial;
    }

    function renderAdInjectionFields() {
        var container = document.getElementById('injection-fields');
        if (!container) return;
        var code = (appState.adInjectionCodes || [])[0];
        if (!code) { container.innerHTML = '<p class="group-hint">上传或粘贴广告代码后，将在这里确认并手动修正六个字段。</p>'; return; }
        var config = code.config || {};
        container.innerHTML = '<h4 class="group-title">确认广告单元</h4><p class="group-hint">红色字段尚未识别。GAM 路径与 GA 衡量 ID 分开校验，修改后即时生效。</p>' + AD_INJECTION_FIELDS.map(function(item) {
            var key = item[0], value = config[key] || '', valid = key === 'analyticsID' ? (!value || isGaValue(value)) : isAdPathValue(value);
            return '<label class="injection-field ' + (valid ? '' : 'is-missing') + '"><span>' + item[1] + '</span><input data-injection-config-key="' + key + '" value="' + escapeHtml(value) + '" placeholder="' + (key === 'analyticsID' ? 'G-XXXXXXXXXX' : '/123456/example-' + item[1].replace(/[^A-Za-z0-9]/g, '').toLowerCase()) + '"></label>';
        }).join('');
    }

    function updateAdInjectionControls() {
        var sites = appState.adInjectionSites || [];
        var codes = appState.adInjectionCodes || [];
        var directoryStatus = document.getElementById('injection-directory-status');
        var archiveStatus = document.getElementById('injection-sites-status');
        var codeStatus = document.getElementById('injection-code-status');
        if (directoryStatus) {
            directoryStatus.textContent = appState.adInjectionSourceMode === 'directory' && sites.length ? '已识别 ' + sites.length + ' 个站点' : '尚未选择';
            directoryStatus.classList.toggle('is-ready', appState.adInjectionSourceMode === 'directory' && sites.length > 0);
        }
        if (archiveStatus) {
            archiveStatus.textContent = appState.adInjectionSourceMode === 'archives' ? fileSelectionSummary(appState.adInjectionArchiveFiles || [], '站点包') : '尚未选择';
            archiveStatus.classList.toggle('is-ready', appState.adInjectionSourceMode === 'archives' && sites.length > 0);
        }
        if (codeStatus) {
            var validCodes = codes.filter(function(code) { return code.valid; }).length;
            codeStatus.textContent = codes.length ? '已读取 ' + codes.length + ' 份，' + validCodes + ' 份有效' : '尚未选择';
            codeStatus.classList.toggle('is-ready', validCodes > 0);
        }
        var match = renderAdInjectionMappings();
        syncAdInjectionExportControls();
        var runButton = document.getElementById('injection-run');
        if (runButton) runButton.disabled = adInjectionRunning || match.validCount === 0;
        var directoryButton = document.getElementById('injection-run-directory');
        if (directoryButton) {
            directoryButton.hidden = typeof window.showDirectoryPicker !== 'function';
            directoryButton.disabled = adInjectionRunning || match.validCount === 0;
        }
    }

    function adInjectionPlacementLabel(position) {
        var labels = {
            off: '不放置', 'after-navbar': '导航栏后', 'after-hero': '首屏后', 'content-top': '内容顶部',
            'after-section-0': '第 1 个区块后', 'after-section-1': '第 2 个区块后', 'after-section-2': '第 3 个区块后',
            'content-bottom': '内容底部', 'footer-top': '页脚前', 'detail-before-content': '详情正文前',
            'detail-between-p-1': '详情第 1 段后', 'detail-between-p-2': '详情第 2 段后', 'detail-between-p-3': '详情第 3 段后',
            'content-middle': '内容中段', 'detail-middle': '正文中部', 'detail-after-content': '详情内容中部', 'detail-before-related': '相关推荐前', 'detail-after-related': '相关推荐后'
        };
        if (/^(?:custom-after-(?:\d+)(?:-\d+)*|content-ratio-\d{1,4})$/.test(String(position || ''))) return '自定义内容位置';
        return labels[position] || position;
    }

    function syncAdInjectionExportControls() {
        var staticUnavailable = (appState.adInjectionSites || []).some(function(site) {
            try { AdRestoration.staticDeploymentSite(site); return false; } catch (error) { return true; }
        });
        if (staticUnavailable && appState.adInjectionExportMode === 'static') appState.adInjectionExportMode = 'source';
        document.querySelectorAll('input[name="injection-export-content"]').forEach(function(input) {
            input.checked = input.value === appState.adInjectionExportMode;
            input.disabled = adInjectionRunning || (input.value === 'static' && staticUnavailable);
        });
        var sourceMode = appState.adInjectionExportMode === 'source';
        var help = document.getElementById('injection-export-content-help');
        if (help) help.textContent = staticUnavailable
            ? '这批站点包含没有静态构建产物的 React 源码，当前可导出完整源码。要导出静态副本，请先生产构建并上传输出目录。'
            : sourceMode ? '源码副本保留上传的工程文件，并接入广告配置；有构建流程的静态工程会在 npm run build 完成后自动注入广告。'
                : '当前导出可直接部署的静态文件。React 站点使用上传包中已有的构建产物；需要修改工程时请选择完整源码。';
        setWorkflowExportButtonLabel('injection-run', sourceMode ? '下载广告源码 ZIP' : '下载静态站点 ZIP');
    }

    function getAdInjectionPolicy() {
        if (!appState.adInjectionPolicy && typeof AdRestoration !== 'undefined') appState.adInjectionPolicy = createAdInjectionPolicy();
        var override = appState.adInjectionSiteOverrides[appState.adInjectionPreviewSiteId];
        if (override && override.policy && (!override.policy.slots || !override.policy.slots.article)) override.policy = createAdInjectionPolicy(override.policy);
        if (appState.adInjectionPolicy && (!appState.adInjectionPolicy.slots || !appState.adInjectionPolicy.slots.article)) appState.adInjectionPolicy = createAdInjectionPolicy(appState.adInjectionPolicy);
        return (override && override.policy) || appState.adInjectionPolicy || { slots: { home: [], detail: [], article: [], tool: [], game: [] } };
    }

    function createAdInjectionPolicy(source) {
        var policy = AdRestoration.createPolicy(undefined, { contentTypeIsolation: true });
        if (!source) return policy;
        if (source.slots && source.slots.home) policy.slots.home = JSON.parse(JSON.stringify(source.slots.home));
        if (source.slots && source.slots.detail) policy.slots.detail = JSON.parse(JSON.stringify(source.slots.detail));
        ['article', 'tool', 'game'].forEach(function(page) {
            policy.slots[page] = JSON.parse(JSON.stringify(source.slots && source.slots[page] || policy.slots.detail));
        });
        if (source.outOfPage) policy.outOfPage = Object.assign(policy.outOfPage, JSON.parse(JSON.stringify(source.outOfPage)));
        return AdRestoration.normalizePolicy(policy);
    }

    // The batch settings are inherited until a site explicitly opts into its
    // own copy. This keeps a manual edit on one site from changing its peers.
    function getAdInjectionSettings(siteId) {
        var override = appState.adInjectionSiteOverrides[siteId || appState.adInjectionPreviewSiteId];
        return override || {
            mode: appState.adInjectionPlacementModeDefault,
            version: appState.adInjectionAdJsVersion,
            policy: appState.adInjectionPolicy || (typeof AdRestoration !== 'undefined' ? createAdInjectionPolicy() : null)
        };
    }

    function syncAdInjectionSettingsControls() {
        var override = appState.adInjectionSiteOverrides[appState.adInjectionPreviewSiteId];
        var settings = getAdInjectionSettings();
        var toggle = document.getElementById('injection-site-override');
        if (toggle) { toggle.checked = !!override; toggle.disabled = !appState.adInjectionPreviewSiteId; }
        var scope = document.getElementById('injection-settings-scope');
        if (scope) scope.textContent = override ? '当前站点单独配置；其他站点仍使用共用设置。' : '当前使用整批站点的共用设置。';
        document.querySelectorAll('input[name="injection-placement-mode"]').forEach(function(input) { input.checked = input.value === settings.mode; });
        document.querySelectorAll('input[name="injection-ad-version"]').forEach(function(input) { input.checked = input.value === settings.version; });
        var manual = document.getElementById('injection-manual-controls');
        if (manual) manual.hidden = settings.mode !== 'manual';
        var fixedNote = document.getElementById('injection-fixed-note');
        if (fixedNote) fixedNote.hidden = settings.mode !== 'fixed';
        if (settings.mode !== 'manual') appState.adInjectionPlacementMode = null;
    }

    function entryTextForPreview(entry) {
        if (!entry) return '';
        if (typeof entry.text === 'string') return entry.text;
        if (typeof entry.content === 'string') return entry.content;
        if (entry.bytes) return new TextDecoder('utf-8').decode(entry.bytes);
        return '';
    }

    function clearAdInjectionPreviewUrls() {
        if (typeof PreviewImageCache !== 'undefined') PreviewImageCache.clear();
        (appState._previewBlobUrls || []).forEach(function(url) { URL.revokeObjectURL(url); });
        appState._previewBlobUrls = [];
        appState._previewAssetUrls = {};
    }

    function adInjectionPreviewDataUrl(value, mime) {
        return previewResourceUrl(value, mime);
    }

    function normalizeAdInjectionPreviewPath(value) {
        var parts = String(value || '').replace(/\\/g, '/').split('/');
        var normalized = [];
        parts.forEach(function(part) {
            if (!part || part === '.') return;
            if (part === '..') normalized.pop();
            else normalized.push(part);
        });
        return normalized.join('/');
    }

    function adInjectionPreviewMime(path) {
        return previewResourceMime(path);
    }

    function adInjectionPreviewRoot(entryPath) {
        var path = normalizeAdInjectionPreviewPath(entryPath);
        var match = path.match(/^(.*?(?:dist|build|out|output|export|www|_site|public|\.output\/public|\.vercel\/output\/static)\/(?:client\/)?)index\.html?$/i);
        return match ? match[1] : path.replace(/[^/]+$/, '');
    }

    function adInjectionPreviewEntries(site) {
        return site && site._previewBuild && site._previewBuild.status === 'ready'
            ? site._previewBuild.entries
            : site && site.entries || [];
    }

    function adInjectionPreviewSourceEntries(site) {
        return site && site.previewSourceEntries && site.previewSourceEntries.length
            ? site.previewSourceEntries
            : site && site.entries || [];
    }

    function isAdInjectionDeployableHtml(site, entry) {
        if (!entry || !/\.html?$/i.test(entry.path || '')) return false;
        if (typeof FinishedSiteAds === 'undefined' || !FinishedSiteAds.isDeployableContentPath) return true;
        var project = site && site.project || null;
        var build = site && site._previewBuild;
        if (build && build.status === 'ready') {
            project = Object.assign({}, project || {}, {
                deploymentRoot: normalizeAdInjectionPreviewPath(build.outputRoot || ''),
                entryPath: normalizeAdInjectionPreviewPath(build.entryPath || '')
            });
        }
        return FinishedSiteAds.isDeployableContentPath(entry.path, project);
    }

    function adInjectionPreviewAllowedHosts(site) {
        var hosts = typeof AdRestoration !== 'undefined' && AdRestoration.siteHostCandidates
            ? AdRestoration.siteHostCandidates(site)
            : [];
        if (typeof AdRestoration !== 'undefined' && AdRestoration.matchAdCodesToSites) {
            var mapping = AdRestoration.matchAdCodesToSites([site], appState.adInjectionCodes || []).mappings[0];
            if (mapping && mapping.host) hosts.push(mapping.host);
        }
        return hosts.map(function(host) {
            return String(host || '').trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
        }).filter(function(host, index, values) { return !!host && values.indexOf(host) === index; });
    }

    function adInjectionUploadedPreviewArtifact(site, entries) {
        var sourceEntries = entries || [];
        var htmlEntries = sourceEntries.filter(function(entry) { return isAdInjectionDeployableHtml(site, entry); });
        var outputIndex = htmlEntries.filter(function(entry) {
            var path = normalizeAdInjectionPreviewPath(entry.path);
            if (!/(?:^|\/)(?:dist|build|out|output|export|www|_site|\.output\/public|\.vercel\/output\/static)\/(?:client\/)?index\.html?$/i.test(path)) return false;
            if (site && site.project && site.project.kind === 'react-source' && /(?:^|\/)public\/(?:client\/)?index\.html?$/i.test(path) && isAdInjectionPreviewSourceShell(site, entry)) return false;
            return true;
        }).sort(function(a, b) {
            var aPath = normalizeAdInjectionPreviewPath(a.path);
            var bPath = normalizeAdInjectionPreviewPath(b.path);
            var aClient = /\/client\/index\.html?$/i.test(aPath) ? 0 : 1;
            var bClient = /\/client\/index\.html?$/i.test(bPath) ? 0 : 1;
            return aClient - bClient || aPath.split('/').length - bPath.split('/').length;
        })[0];
        var rootIndex = htmlEntries.find(function(entry) { return /^index\.html?$/i.test(normalizeAdInjectionPreviewPath(entry.path)); });
        var entry = outputIndex || (rootIndex && !isAdInjectionPreviewSourceShell(site, rootIndex) ? rootIndex : null);
        if (!entry) return null;
        var root = normalizeAdInjectionPreviewPath(entry.path).replace(/index\.html?$/i, '');
        var artifactEntries = root ? sourceEntries.filter(function(item) {
            return normalizeAdInjectionPreviewPath(item.path).indexOf(root) === 0;
        }) : sourceEntries;
        return { status: 'ready', entries: artifactEntries, entryPath: normalizeAdInjectionPreviewPath(entry.path), outputRoot: root, omittedCount: 0, uploadedArtifact: true, promise: null };
    }

    function findAdInjectionPreviewEntry(site, pageType) {
        var entries = adInjectionPreviewEntries(site).filter(function(entry) { return isAdInjectionDeployableHtml(site, entry); });
        if (!entries.length) return null;
        var project = site.project || {};
        var builtEntryPath = site && site._previewBuild && site._previewBuild.status === 'ready' ? site._previewBuild.entryPath : '';
        var preferredPath = normalizeAdInjectionPreviewPath(builtEntryPath || project.previewEntryPath || project.entryPath || '');
        var preferred = entries.find(function(entry) { return normalizeAdInjectionPreviewPath(entry.path).toLowerCase() === preferredPath.toLowerCase(); });
        if (!pageType || pageType === 'home') return preferred || entries.find(function(entry) { return /(?:^|\/)index\.html?$/i.test(entry.path || ''); }) || entries[0];
        var root = adInjectionPreviewRoot(preferredPath);
        var namedPage = entries.filter(function(entry) {
            var path = normalizeAdInjectionPreviewPath(entry.path).toLowerCase();
            if (pageType === 'detail') return isPreviewDetailEntry(path, root);
            if (['article', 'tool', 'game'].indexOf(pageType) !== -1) {
                return isPreviewDetailEntry(path, root) && adInjectionEntryPageType(entry, root, preferredPath) === pageType;
            }
            return new RegExp('/' + pageType + '(?:/index)?\\.html?$').test('/' + path);
        }).sort(function(a, b) { return String(a.path).split('/').length - String(b.path).split('/').length; })[0];
        return namedPage || preferred || entries[0];
    }

    function adInjectionEntryPageType(entry, root, homePath) {
        var path = normalizeAdInjectionPreviewPath(entry && entry.path || '');
        var type = previewContentTypeForEntry(path, root);
        if (type !== 'article' || typeof FinishedSiteAds === 'undefined' || typeof DOMParser === 'undefined') return type;
        // Generic route names need DOM evidence to distinguish a tool or game
        // from an article. This mirrors the static export classifier.
        var doc = new DOMParser().parseFromString(entryTextForPreview(entry), 'text/html');
        return FinishedSiteAds.contentPageType(path, doc, homePath || '');
    }

    function syncAdInjectionPageTabs(site) {
        var injection = isAdInjectionWorkflow();
        var detailTab = document.querySelector('.preview-tab[data-page="detail"]');
        var typedTabs = Array.from(document.querySelectorAll('.preview-tab[data-page="article"], .preview-tab[data-page="tool"], .preview-tab[data-page="game"]'));
        if (!injection) {
            typedTabs.forEach(function(tab) { tab.hidden = true; });
            return;
        }
        if (detailTab) detailTab.hidden = true;
        var entries = adInjectionPreviewEntries(site).filter(function(entry) { return isAdInjectionDeployableHtml(site, entry); });
        var home = site ? findAdInjectionPreviewEntry(site, 'home') : null;
        var root = adInjectionPreviewRoot(home && home.path || '');
        var available = availablePreviewContentTypes(entries, root, function(entry) {
            return adInjectionEntryPageType(entry, root, home && home.path);
        });
        typedTabs.forEach(function(tab) { tab.hidden = !available[tab.dataset.page]; });
        var active = document.querySelector('.preview-tab.active');
        if (active && active.hidden) {
            active.classList.remove('active', 'is-jelly-active');
            var homeTab = document.querySelector('.preview-tab[data-page="home"]');
            if (homeTab) homeTab.classList.add('active', 'is-jelly-active');
        }
    }

    function resolveAdInjectionPreviewAsset(reference, fromPath, root, entryByPath) {
        var raw = String(reference || '').trim();
        if (!raw || /^(?:[a-z]+:|#|\/\/)/i.test(raw)) return '';
        try { raw = decodeURIComponent(raw); } catch (error) {}
        raw = raw.split(/[?#]/)[0];
        var candidate = raw.charAt(0) === '/'
            ? normalizeAdInjectionPreviewPath(root + raw.slice(1))
            : normalizeAdInjectionPreviewPath(fromPath.replace(/[^/]+$/, '') + raw);
        if (entryByPath[candidate.toLowerCase()]) return candidate;
        var bare = normalizeAdInjectionPreviewPath(raw.replace(/^\/+/, '')).toLowerCase();
        if (entryByPath[bare]) return bare;
        var paths = Object.keys(entryByPath).filter(function(path) { return path.endsWith('/' + bare); });
        return paths.length === 1 ? entryByPath[paths[0]].path : '';
    }

    function rewriteAdInjectionPreviewCss(css, fromPath, root, entryByPath, assetUrls) {
        return rewritePreviewCss(css, fromPath, function(reference, ownerPath) {
            var resolved = resolveAdInjectionPreviewAsset(reference, ownerPath, root, entryByPath);
            return resolved && assetUrls[resolved.toLowerCase()] || '';
        });
    }

    function adInjectionPreviewModuleId(path) {
        return 'sitefoundry-module:' + normalizeAdInjectionPreviewPath(path);
    }

    function rewriteAdInjectionPreviewModule(source, fromPath, root, entryByPath, assetUrls) {
        // Preload hints are an optimization, not an execution dependency. Vite's
        // generated helper resolves them relative to import.meta.url, which has no
        // directory when the preview module is a data URL, so omit only that hint
        // list and keep the actual dynamic import below intact.
        var rewritten = String(source || '').replace(/__vite__mapDeps\(\[[^\]]*\]\)/g, '[]').replace(/(\b(?:from|import)\s*(?:\(\s*)?)(['"])([^'"]+)\2/g, function(match, prefix, quote, reference) {
            var resolved = resolveAdInjectionPreviewAsset(reference, fromPath, root, entryByPath);
            if (!resolved) return match;
            if (/\.(?:[cm]?js|jsx|tsx)$/i.test(resolved)) return prefix + quote + adInjectionPreviewModuleId(resolved) + quote;
            return assetUrls[resolved.toLowerCase()] ? prefix + quote + assetUrls[resolved.toLowerCase()] + quote : match;
        });
        // Vite records lazy-route dependencies as plain strings and later feeds
        // them to new URL(..., import.meta.url). A data: module has no
        // hierarchical base, so give those local dependencies stable import-map
        // identifiers before the uploaded bundle executes.
        rewritten = rewritten.replace(/(['"])((?:\.?\.?\/|\/)?assets\/[^'"]+\.(?:[cm]?js|css|wasm))\1/g, function(match, quote, reference) {
            var resolved = resolveAdInjectionPreviewAsset(reference, fromPath, root, entryByPath);
            if (!resolved) return match;
            if (/\.(?:[cm]?js)$/i.test(resolved)) return quote + adInjectionPreviewModuleId(resolved) + quote;
            return assetUrls[resolved.toLowerCase()] ? quote + assetUrls[resolved.toLowerCase()] + quote : match;
        });
        rewritten = rewritten.replace(/new\s+URL\(\s*(['"])([^'"]+)\1\s*,\s*import\.meta\.url\s*\)/g, function(match, quote, reference) {
            var resolved = resolveAdInjectionPreviewAsset(reference, fromPath, root, entryByPath);
            return resolved && assetUrls[resolved.toLowerCase()] ? 'new URL(' + JSON.stringify(assetUrls[resolved.toLowerCase()]) + ')' : match;
        });
        // Plain HTML sites often create cards and images from JavaScript data.
        // Rewrite those quoted local asset strings before the script executes;
        // otherwise srcdoc resolves them against the tool itself and shows broken
        // images even though the archive contains the files.
        return rewritten.replace(/(['"])([^'"\r\n<>]+\.(?:avif|gif|ico|jpe?g|png|svg|webp|woff2?|ttf|otf|mp4|webm|glb|gltf|bin|hdr|exr|ktx2?|basis|dds|tga|obj|mtl|fbx|stl|ply|dae|3mf|draco|wasm|json)(?:[?#][^'"\r\n<>]*)?)\1/gi, function(match, quote, reference) {
            var resolved = resolveAdInjectionPreviewAsset(reference, fromPath, root, entryByPath);
            return resolved && assetUrls[resolved.toLowerCase()] ? quote + assetUrls[resolved.toLowerCase()] + quote : match;
        });
    }

    function adInjectionPreviewRuntimeAssetResolver(entryPath, root, assetUrls, effectsEnabled) {
        var token = 'preview-assets-' + Math.random().toString(36).slice(2);
        var scriptConfig = JSON.stringify({
            entryPath: normalizeAdInjectionPreviewPath(entryPath),
            root: normalizeAdInjectionPreviewPath(root),
            token: token,
            effectsEnabled: !!effectsEnabled,
            assets: Object.keys(assetUrls)
        }).replace(/</g, '\\u003c');
        return '(function(){' +
            'var config=' + scriptConfig + ';' +
            'function installMemoryStorage(name){try{void window[name];return;}catch(error){}var values=Object.create(null);var storage={get length(){return Object.keys(values).length;},key:function(index){return Object.keys(values)[index]||null;},getItem:function(key){key=String(key);return Object.prototype.hasOwnProperty.call(values,key)?values[key]:null;},setItem:function(key,value){values[String(key)]=String(value);},removeItem:function(key){delete values[String(key)];},clear:function(){values=Object.create(null);}};try{Object.defineProperty(window,name,{value:storage,configurable:true});}catch(error){}}installMemoryStorage("localStorage");installMemoryStorage("sessionStorage");' +
            'var assets=Object.create(null),waiting=Object.create(null),urlWaiting=Object.create(null),requested=Object.create(null);config.assets.forEach(function(path){assets[path]=true;});' +
            'var nativeSetAttribute=Element.prototype.setAttribute;' +
            'function normalize(path){var parts=[];String(path||"").replace(/\\\\/g,"/").split("/").forEach(function(part){if(!part||part===".")return;if(part==="..")parts.pop();else parts.push(part);});return parts.join("/");}' +
            'function resolve(value){var raw=String(value||"").trim();if(!raw||/^(?:[a-z]+:|#|\\/\\/)/i.test(raw))return "";try{raw=decodeURIComponent(raw);}catch(error){}raw=raw.split(/[?#]/)[0];var candidate=(raw.charAt(0)==="/"?normalize(config.root+raw.slice(1)):normalize(config.entryPath.replace(/[^/]+$/,"")+raw)).toLowerCase();if(assets[candidate])return candidate;var bare=normalize(raw.replace(/^\\/+/,"")).toLowerCase();if(assets[bare])return bare;var matches=config.assets.filter(function(path){return path.endsWith("/"+bare);});return matches.length===1?matches[0]:"";}' +
            'function request(node,name,value){var path=resolve(value);if(!path)return;(waiting[path]||(waiting[path]=[])).push({node:node,name:name});if(requested[path])return;requested[path]=true;parent.postMessage({type:"sitefoundry-preview-asset-request",token:config.token,path:path},"*");}' +
            'function requestUrl(path){return new Promise(function(done){(urlWaiting[path]||(urlWaiting[path]=[])).push(done);if(requested[path])return;requested[path]=true;parent.postMessage({type:"sitefoundry-preview-asset-request",token:config.token,path:path},"*");});}' +
            'function requestSrcset(node,value){String(value||"").split(",").forEach(function(candidate){var parts=candidate.trim().split(/\\s+/);request(node,"srcset:"+parts.slice(1).join(" "),parts[0]);});}' +
            'function requestStyle(node,value){String(value||"").replace(/url\\(\\s*([\'\"]?)([^)\'\"\\s]+)\\1\\s*\\)/gi,function(match,quote,url){request(node,"style:"+url,url);return match;});}' +
            'function apply(node){if(!node||node.nodeType!==1)return;["src","href","poster"].forEach(function(name){if(node.hasAttribute(name))request(node,name,node.getAttribute(name));});if(node.hasAttribute("srcset"))requestSrcset(node,node.getAttribute("srcset"));if(node.hasAttribute("style"))requestStyle(node,node.getAttribute("style"));node.querySelectorAll&&node.querySelectorAll("[src],[href],[poster],[srcset],[style]").forEach(apply);}' +
            'addEventListener("message",function(event){var data=event.data||{};if(event.source!==parent||data.type!=="sitefoundry-preview-asset-response"||data.token!==config.token||!data.path||!data.url)return;(waiting[data.path]||[]).forEach(function(item){if(!item.node||!item.node.isConnected)return;if(item.name.indexOf("srcset:")===0){var descriptor=item.name.slice(7);nativeSetAttribute.call(item.node,"srcset",data.url+(descriptor?" "+descriptor:""));}else if(item.name.indexOf("style:")===0){var original=item.name.slice(6);nativeSetAttribute.call(item.node,"style",String(item.node.getAttribute("style")||"").split(original).join(data.url));}else nativeSetAttribute.call(item.node,item.name,data.url);});(urlWaiting[data.path]||[]).forEach(function(done){done(data.url);});delete waiting[data.path];delete urlWaiting[data.path];});' +
            // Local data belongs to ordinary site rendering, including when 3D
            // effects are off. Computed fetch paths cannot be rewritten as JS
            // literals; resolve them against the uploaded HTML at runtime.
            'if(window.fetch){var nativeFetch=window.fetch.bind(window);window.fetch=function(input,init){var value=typeof input==="string"?input:input&&input.url||"";var path=resolve(value);return path?requestUrl(path).then(function(url){return nativeFetch(url,init);}):nativeFetch(input,init);};}' +
            'new MutationObserver(function(records){records.forEach(function(record){apply(record.target);record.addedNodes&&record.addedNodes.forEach(apply);});}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["src","href","poster","srcset","style"]});' +
            'if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){apply(document.documentElement);},{once:true});else apply(document.documentElement);' +
            '})();';
    }

    function adInjectionPreviewCsp(effectsEnabled) {
        if (!effectsEnabled) return "default-src 'none'; img-src data:; style-src data: 'unsafe-inline'; font-src data:; media-src data:; script-src 'unsafe-inline' data:; connect-src data:";
        return "default-src 'none'; img-src data: blob: https: http:; style-src data: blob: https: http: 'unsafe-inline'; font-src data: blob: https: http:; media-src data: blob: https: http:; script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' data: blob: https: http:; connect-src data: blob: https: http: ws: wss:; worker-src data: blob:; child-src data: blob:; frame-src data: blob: https: http:";
    }

    function buildAdInjectionEmbeddedPreviewDocument(entry, root, entryByPath, assetUrls, moduleImports) {
        var doc = new DOMParser().parseFromString(entryTextForPreview(entry), 'text/html');
        doc.querySelectorAll('meta[http-equiv="Content-Security-Policy"], base').forEach(function(node) { node.remove(); });
        doc.querySelectorAll('script[src]').forEach(function(node) {
            if (/(?:^|\/)js\/ad\.js(?:[?#]|$)/i.test(node.getAttribute('src') || '') || node.hasAttribute('data-sitefoundry-ad-runtime')) {
                node.remove();
                return;
            }
            var source = node.getAttribute('src') || '';
            var resolved = resolveAdInjectionPreviewAsset(source, entry.path, root, entryByPath);
            if (resolved && assetUrls[resolved.toLowerCase()]) node.setAttribute('src', assetUrls[resolved.toLowerCase()]);
            else if (!/^(?:https?:)?\/\//i.test(source)) node.remove();
        });
        doc.querySelectorAll('script:not([src]):not([type="application/ld+json"]):not([type="application/json"])').forEach(function(node) {
            node.textContent = rewriteAdInjectionPreviewModule(node.textContent, entry.path, root, entryByPath, assetUrls);
        });
        doc.querySelectorAll('link[rel="modulepreload"], link[rel="preload"][as="script"]').forEach(function(node) { node.remove(); });
        doc.querySelectorAll('[src], [href], [poster]').forEach(function(node) {
            ['src', 'href', 'poster'].forEach(function(attribute) {
                if (!node.hasAttribute(attribute)) return;
                var resolved = resolveAdInjectionPreviewAsset(node.getAttribute(attribute), entry.path, root, entryByPath);
                if (resolved && assetUrls[resolved.toLowerCase()]) node.setAttribute(attribute, assetUrls[resolved.toLowerCase()]);
            });
        });
        doc.querySelectorAll('style').forEach(function(node) {
            node.textContent = rewriteAdInjectionPreviewCss(node.textContent, entry.path, root, entryByPath, assetUrls);
        });
        doc.querySelectorAll('[style]').forEach(function(node) {
            node.setAttribute('style', rewriteAdInjectionPreviewCss(node.getAttribute('style'), entry.path, root, entryByPath, assetUrls));
        });
        var csp = doc.createElement('meta');
        csp.httpEquiv = 'Content-Security-Policy';
        csp.content = adInjectionPreviewCsp(true);
        doc.head.prepend(csp);
        if (Object.keys(moduleImports).length) {
            var importMap = doc.createElement('script');
            importMap.type = 'importmap';
            importMap.textContent = JSON.stringify({ imports: moduleImports }).replace(/</g, '\\u003c');
            csp.after(importMap);
        }
        return '<!doctype html>\n' + doc.documentElement.outerHTML;
    }

    function isAdInjectionPreviewSourceShell(site, entry) {
        if (!site || !entry || !site.project || site.project.kind !== 'react-source') return false;
        var path = normalizeAdInjectionPreviewPath(entry.path);
        if (/(?:^|\/)(?:dist|build|out|output|export|www|_site|public|\.output\/public|\.vercel\/output\/static)\/(?:client\/)?index\.html?$/i.test(path)) return false;
        var html = entryTextForPreview(entry);
        return /<script\b[^>]*\bsrc\s*=\s*["'][^"']*(?:\/src\/|\.(?:jsx|tsx)(?:[?#"']|$))/i.test(html) || /<div\b[^>]*\bid\s*=\s*["']root["'][^>]*>\s*<\/div>/i.test(html);
    }

    function shouldExecuteAdInjectionPreviewScripts(site, entry) {
        var project = site && site.project || {};
        var isFrameworkBuild = project.kind === 'react-source' || /React|TanStack|Next\.js|Gatsby/i.test(project.framework || '');
        if (!isFrameworkBuild) return true;
        var parsed = new DOMParser().parseFromString(entryTextForPreview(entry), 'text/html');
        var content = parsed.querySelector('main, article, [role="main"]') || parsed.body;
        // Streaming scripts contain long diagnostics but are not rendered body
        // content. A clientLoader shell must still execute its application.
        content = content && content.cloneNode(true);
        if (content) content.querySelectorAll('script, style, template, [hidden]').forEach(function(node) { node.remove(); });
        var text = String(content && content.textContent || '').replace(/\s+/g, ' ').trim();
        // A prerendered/SSR framework export already contains the exact page the
        // user selected. Re-hydrating it inside srcdoc gives the app the parent
        // tool's URL and can replace that page with a 404. Preserve the complete
        // server-rendered document; execute framework JS only for an actual SPA
        // shell that needs JavaScript to create its content.
        return text.length < 120;
    }

    function adInjectionPreviewPage(pageType) {
        return ['detail', 'article', 'tool', 'game'].indexOf(pageType) !== -1 ? pageType : 'home';
    }

    function adInjectionPolicyPlacement(unit, page) {
        var slot = (getAdInjectionPolicy().slots[page] || []).find(function(item) { return item && item.unit === unit; });
        return slot ? slot.position : '';
    }

    function setAdInjectionPolicyPlacement(unit, page, position) {
        var index = Number(String(unit || '').replace('banner', '')) - 1;
        var policy = getAdInjectionPolicy();
        if (!policy.slots[page] || index < 0 || index > 2) return;
        policy.slots[page][index] = position
            ? { position: position, unit: unit }
            : { position: 'off', unit: 'off' };
        var normalized = AdRestoration.normalizePolicy(policy);
        var override = appState.adInjectionSiteOverrides[appState.adInjectionPreviewSiteId];
        if (override) override.policy = normalized;
        else appState.adInjectionPolicy = normalized;
    }

    function adInjectionOccupiedPositions(page, ignoredUnit) {
        var occupied = {};
        (getAdInjectionPolicy().slots[page] || []).forEach(function(slot) {
            if (slot && slot.unit === ignoredUnit) return;
            if (slot && slot.unit !== 'off' && slot.position !== 'off') occupied[slot.position] = true;
        });
        return occupied;
    }

    function adInjectionMeaningfulChildren(target) {
        return target ? Array.from(target.children || []).filter(function(child) {
            var tag = String(child.tagName || '').toLowerCase();
            if (['script', 'style', 'template', 'header', 'nav', 'footer', 'aside'].indexOf(tag) !== -1) return false;
            return !child.matches('[data-sitefoundry-preview-ad], .sitefoundry-injection-marker, .related-section, [class*="related"]');
        }) : [];
    }

    function adInjectionDetailContentTarget(doc, main) {
        var target = doc.querySelector('.detail-content, .article-content, [class*="article-content"], article') || main;
        // Only unwrap layout containers. Searching for the descendant with the
        // most children can mistake an FAQ or card grid for the whole article.
        for (var depth = 0; target && depth < 8; depth++) {
            var children = adInjectionMeaningfulChildren(target);
            if (children.length !== 1 || !/^(?:main|article|div|section)$/i.test(children[0].tagName || '')) break;
            target = children[0];
        }
        return target || main;
    }

    function insertAdInjectionContentMiddle(target, node) {
        if (!target || !node) return;
        var children = adInjectionMeaningfulChildren(target);
        if (!children.length) {
            target.appendChild(node);
            return;
        }
        var anchor = children[Math.max(0, Math.ceil(children.length / 2) - 1)];
        anchor.parentNode.insertBefore(node, anchor.nextSibling);
    }

    function adInjectionCustomPath(position) {
        var match = String(position || '').match(/^custom-after-((?:\d+)(?:-\d+)*)$/);
        return match ? match[1].split('-').map(Number) : null;
    }

    function adInjectionResolveCustomTarget(root, position) {
        var path = adInjectionCustomPath(position);
        var target = root;
        if (!path || !target) return null;
        for (var index = 0; index < path.length; index++) {
            var children = adInjectionMeaningfulChildren(target);
            if (!children.length) return target;
            target = children[Math.min(path[index], children.length - 1)];
        }
        return target;
    }

    function collectAdInjectionCustomPlacements(root) {
        if (root && typeof FinishedSiteAds !== 'undefined' && FinishedSiteAds.semanticBoundaries) {
            return FinishedSiteAds.semanticBoundaries(root.ownerDocument).filter(function(candidate) {
                return root === candidate.anchor || root.contains(candidate.anchor);
            }).map(function(candidate) {
                return {
                    target: candidate.anchor,
                    next: candidate.anchor.nextElementSibling,
                    position: 'content-ratio-' + candidate.ratio,
                    label: '自定义位置 · 放在此处'
                };
            });
        }
        var placements = [];
        // The exported policy accepts at most eight path segments. Do not show
        // a preview target that the exported site cannot resolve.
        var maxDepth = 7;
        // A finished site can nest article sections, card grids and rich text
        // several levels deep.  Keep a generous catalogue so a visual gap late
        // in the page is never lost merely because the hero had many elements.
        var maxPlacements = 2400;
        var excludedTags = ['script', 'style', 'template', 'header', 'nav', 'footer', 'aside', 'svg', 'path', 'button', 'input', 'select', 'textarea', 'label', 'option', 'video', 'audio', 'canvas'];
        var layoutTags = ['main', 'article', 'section', 'div', 'ul', 'ol', 'table', 'tbody', 'thead', 'tfoot', 'figure', 'details', 'fieldset', 'blockquote', 'dl'];
        // Visit broad page structure first.  A deep hero must not consume the
        // entire placement budget before a later tool/article grid is reached.
        var queue = [{ container: root, path: [], depth: 0 }];
        while (queue.length && placements.length < maxPlacements) {
            var current = queue.shift();
            var container = current.container;
            var path = current.path;
            var depth = current.depth;
            if (!container || depth > maxDepth) continue;
            var children = adInjectionMeaningfulChildren(container);
            if (children.length) {
                // Keep structural endpoints.  The interactive overlay below
                // merges cards sharing a grid row into one horizontal gap.
                for (var index = 0; index < children.length; index++) {
                    var child = children[index];
                    placements.push({
                        target: child,
                        next: children[index + 1] || null,
                        position: 'custom-after-' + path.concat(index).join('-'),
                        label: '自定义位置 · 放在此处'
                    });
                    if (placements.length >= maxPlacements) break;
                }
            }
            children.forEach(function(child, index) {
                var tag = String(child.tagName || '').toLowerCase();
                if (excludedTags.indexOf(tag) !== -1 || child.matches('.related-section, [class*="related"], [id*="related"]')) return;
                if (layoutTags.indexOf(tag) === -1) return;
                if (!adInjectionMeaningfulChildren(child).length) return;
                queue.push({ container: child, path: path.concat(index), depth: depth + 1 });
            });
        }
        return placements;
    }

    function mountAdInjectionPlacementOverlay(doc, page, candidates) {
        var ids = new Map();
        var nextId = 0;
        function idFor(element) {
            if (!element) return '';
            if (!ids.has(element)) {
                nextId += 1;
                ids.set(element, String(nextId));
                element.setAttribute('data-sitefoundry-placement-anchor', String(nextId));
            }
            return ids.get(element);
        }
        var descriptors = candidates.map(function(candidate) {
            return {
                position: candidate.position,
                label: candidate.label,
                kind: candidate.kind || 'custom',
                relation: candidate.relation || 'after',
                anchor: idFor(candidate.target),
                next: idFor(candidate.next)
            };
        }).filter(function(candidate) { return candidate.anchor; });
        if (!descriptors.length) return;

        var script = doc.createElement('script');
        script.type = 'module';
        // The button is deliberately created only for the gap under the pointer.
        // Unlike the prototype's in-flow dashed bars, this overlay never becomes
        // part of the uploaded page's layout and therefore cannot move its cards.
        script.textContent = `(function(){
            var candidates=${JSON.stringify(descriptors)},page=${JSON.stringify(page)};
            var overlay,customButton,active,geometries=[],commonButtons=[],customByAnchor={};
            candidates.forEach(function(candidate){if(candidate.kind==='custom')customByAnchor[candidate.anchor]=candidate;});
            function byId(id){if(!id)return null;var found=document.querySelector('[data-sitefoundry-placement-anchor="'+id+'"]');if(found)return found;var candidate=customByAnchor[id],match=candidate&&/^custom-after-((?:\d+)(?:-\d+)*)$/.exec(candidate.position);if(!match)return null;var target=document.querySelector('main')||document.body;match[1].split('-').map(Number).forEach(function(index){var children=Array.prototype.filter.call(target.children||[],function(child){return !/^(?:SCRIPT|STYLE|TEMPLATE|HEADER|NAV|FOOTER|ASIDE)$/.test(child.tagName||'')&&!child.hasAttribute('data-sitefoundry-preview-ad')&&!child.matches('.related-section, [class*="related"]');});target=children[Math.min(index,children.length-1)]||target;});if(target&&target.setAttribute)target.setAttribute('data-sitefoundry-placement-anchor',id);return target;}
            function relevantNext(candidate,anchor){var next=byId(candidate.next);if(next)return next;return candidate.relation==='before'?anchor.previousElementSibling:anchor.nextElementSibling;}
            function rowBounds(anchor,rect){var parent=anchor.parentElement;if(!parent)return{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom};var row=Array.prototype.filter.call(parent.children,function(node){var r=node.getBoundingClientRect();return r.width>1&&r.height>1&&Math.abs(r.top-rect.top)<4;});return row.reduce(function(bounds,node){var r=node.getBoundingClientRect();return{left:Math.min(bounds.left,r.left),right:Math.max(bounds.right,r.right),top:Math.min(bounds.top,r.top),bottom:Math.max(bounds.bottom,r.bottom)};},{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom});}
            function geometry(candidate,anchor){var rect=anchor.getBoundingClientRect(),near=relevantNext(candidate,anchor),nearRect=near&&near.getBoundingClientRect(),bounds=rowBounds(anchor,rect),top,bottom;if(rect.width<1||rect.height<1)return null;if(candidate.relation==='before'){bottom=bounds.top;top=nearRect&&nearRect.bottom<bottom-2?nearRect.bottom:bottom-18;}else{top=bounds.bottom;if(nearRect&&Math.abs(nearRect.top-bounds.top)<4)return null;bottom=nearRect&&nearRect.top>top+2?nearRect.top:top+18;}if(bottom-top<3)return null;return{left:Math.max(6,bounds.left),right:Math.min(window.innerWidth-6,bounds.right),y:(top+bottom)/2,top:top,bottom:bottom};}
            function rebuild(){geometries=[];candidates.forEach(function(candidate){var anchor=byId(candidate.anchor),gap=anchor&&geometry(candidate,anchor);if(gap)geometries.push({candidate:candidate,gap:gap});});}
            function overlapsCommon(gap){return geometries.some(function(entry){if(entry.candidate.kind!=='common')return false;var common=entry.gap;return gap.right>common.left-10&&gap.left<common.right+10&&gap.bottom>common.top-18&&gap.top<common.bottom+18;});}
            function candidateAt(event){var x=event.clientX,y=event.clientY,best=null;geometries.forEach(function(entry){if(entry.candidate.kind!=='custom'||overlapsCommon(entry.gap))return;var gap=entry.gap;if(x<gap.left-10||x>gap.right+10||y<gap.top-16||y>gap.bottom+16)return;var distance=Math.abs(y-gap.y);if(!best||distance<best.distance)best={candidate:entry.candidate,gap:gap,distance:distance};});return best;}
            function fallbackAt(event){var x=event.clientX,y=event.clientY,best=null;candidates.forEach(function(candidate){if(candidate.kind!=='custom'||candidate.relation==='before')return;var anchor=byId(candidate.anchor);if(!anchor)return;var rect=anchor.getBoundingClientRect(),bounds=rowBounds(anchor,rect),next=relevantNext(candidate,anchor),nextRect=next&&next.getBoundingClientRect(),top=bounds.bottom,bottom=nextRect&&nextRect.top>top+2?nextRect.top:top+180;if(nextRect&&Math.abs(nextRect.top-bounds.top)<4)return;var fallbackGap={left:Math.max(6,bounds.left),right:Math.min(window.innerWidth-6,bounds.right),y:y,top:top,bottom:bottom};if(overlapsCommon(fallbackGap))return;if(x<bounds.left-10||x>bounds.right+10||y<top-3||y>Math.min(top+180,bottom+16))return;var distance=y-top;if(!best||distance<best.distance)best={candidate:candidate,gap:fallbackGap,distance:distance};});return best;}
            function whitespaceAt(event){var x=event.clientX,y=event.clientY,root=document.querySelector('main')||document.body;var hit=(document.elementsFromPoint?document.elementsFromPoint(x,y):[document.elementFromPoint(x,y)]).find(function(node){return node&&node.nodeType===1&&node!==overlay&&!overlay.contains(node);});for(var parent=hit;parent&&root.contains(parent);parent=parent.parentElement){var frame=parent.getBoundingClientRect();if(x<frame.left||x>frame.right||y<frame.top||y>frame.bottom)continue;var rows=[];Array.prototype.forEach.call(parent.children,function(child){if(child===overlay||child.hasAttribute('data-sitefoundry-preview-ad')||child.hasAttribute('data-sitefoundry-runtime-ad'))return;var rect=child.getBoundingClientRect();if(rect.width<2||rect.height<2)return;var row=rows.find(function(item){return Math.abs(item.top-rect.top)<4;});if(!row){row={top:rect.top,bottom:rect.bottom,last:child};rows.push(row);}else{row.bottom=Math.max(row.bottom,rect.bottom);row.last=child;}});rows.sort(function(a,b){return a.top-b.top;});for(var i=0;i<rows.length;i++){var upper=rows[i],lower=rows[i+1],top=upper.bottom,bottom=lower?lower.top:frame.bottom;if(bottom-top<18||y<top||y>bottom)continue;var candidate=customByAnchor[upper.last.getAttribute('data-sitefoundry-placement-anchor')];if(!candidate)continue;var gap={left:Math.max(6,frame.left),right:Math.min(window.innerWidth-6,frame.right),top:top,bottom:bottom,y:(top+bottom)/2};if(gap.right-gap.left<100||overlapsCommon(gap))continue;return{candidate:candidate,gap:gap,distance:0};}}return null;}
            function hideCustom(){active=null;if(customButton){customButton.hidden=true;customButton.style.display='none';}}
            function showCustom(match){active=match.candidate;customButton.hidden=false;customButton.style.display='flex';customButton.title=match.candidate.label;customButton.style.left=Math.round(match.gap.left)+'px';customButton.style.top=Math.round(match.gap.top)+'px';customButton.style.width=Math.max(96,Math.round(match.gap.right-match.gap.left))+'px';customButton.style.height=Math.max(24,Math.round(match.gap.bottom-match.gap.top))+'px';}
            function pointerMove(event){var match=whitespaceAt(event)||candidateAt(event);if(!match){rebuild();match=whitespaceAt(event)||candidateAt(event)||fallbackAt(event);}if(match)showCustom(match);else hideCustom();}
            function commonButton(candidate){var node=document.createElement('button');node.type='button';node.className='sitefoundry-injection-marker sitefoundry-injection-common-marker';node.textContent='＋ '+candidate.label.replace(/^常用广告位\\s*·\\s*/, '');node.title=candidate.label;node.style.cssText='position:fixed;height:28px;margin:0;padding:0 10px;z-index:2147483647;pointer-events:auto;cursor:pointer;border:1px dashed #2683df;border-radius:6px;background:rgba(238,247,255,.97);color:#174f87;font:700 11px/26px system-ui,sans-serif;box-shadow:0 1px 5px rgba(13,67,112,.16);';node.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();window.parent.postMessage({type:'ad-injection-place',position:candidate.position,page:page},'*');});overlay.appendChild(node);return{candidate:candidate,node:node};}
            function render(){rebuild();hideCustom();commonButtons.forEach(function(item){var entry=geometries.find(function(value){return value.candidate===item.candidate;});if(!entry){item.node.hidden=true;return;}var gap=entry.gap;item.node.hidden=false;item.node.style.left=Math.round(gap.left)+'px';item.node.style.top=Math.round(gap.y-14)+'px';item.node.style.width=Math.max(116,Math.round(gap.right-gap.left))+'px';});}
            function queue(){requestAnimationFrame(render);}
            overlay=document.createElement('div');overlay.id='sitefoundry-ad-placement-overlay';overlay.style.cssText='position:fixed;inset:0;z-index:2147483646;pointer-events:none;overflow:hidden;';
            customButton=document.createElement('button');customButton.type='button';customButton.className='sitefoundry-injection-marker sitefoundry-injection-custom-marker';customButton.hidden=true;customButton.style.cssText='position:fixed;display:none;align-items:center;justify-content:center;margin:0;padding:0;z-index:2147483647;pointer-events:auto;cursor:pointer;border:1px dashed rgba(38,131,223,.65);border-radius:6px;background:rgba(238,247,255,.22);color:#174f87;font:700 11px/22px system-ui,sans-serif;';var customLabel=document.createElement('span');customLabel.textContent='＋ 点击放置广告';customLabel.style.cssText='padding:0 12px;border:1px dashed #2683df;border-radius:6px;background:rgba(238,247,255,.97);box-shadow:0 1px 5px rgba(13,67,112,.16);';customButton.appendChild(customLabel);
            customButton.addEventListener('click',function(event){if(!active)return;event.preventDefault();event.stopPropagation();window.parent.postMessage({type:'ad-injection-place',position:active.position,page:page},'*');});
            overlay.appendChild(customButton);candidates.filter(function(candidate){return candidate.kind==='common';}).forEach(function(candidate){commonButtons.push(commonButton(candidate));});document.body.appendChild(overlay);document.addEventListener('pointerover',pointerMove,true);document.addEventListener('mouseover',pointerMove,true);document.addEventListener('pointermove',pointerMove,true);document.addEventListener('mousemove',pointerMove,true);document.documentElement.addEventListener('mouseleave',hideCustom);
            function ensureOverlay(){if(!document.getElementById('sitefoundry-ad-placement-overlay')&&document.body)document.body.appendChild(overlay);queue();}
            if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureOverlay,{once:true});else ensureOverlay();addEventListener('resize',queue);document.addEventListener('scroll',queue,true);new MutationObserver(ensureOverlay).observe(document.documentElement,{childList:true,subtree:true});[50,250,1000,2000].forEach(function(delay){setTimeout(ensureOverlay,delay);});
        })();`;
        doc.body.appendChild(script);
    }

    function addAdInjectionPlacementMarkers(doc, pageType) {
        if (!appState.adInjectionPlacementMode) return;
        var page = adInjectionPreviewPage(pageType);
        var occupied = adInjectionOccupiedPositions(page, appState.adInjectionPlacementMode);
        var main = doc.querySelector('main') || doc.body;
        var sections = main ? Array.from(main.querySelectorAll(':scope > section, :scope > article, section')) : [];
        var content = adInjectionDetailContentTarget(doc, main);
        var related = doc.querySelector('.related-section, [class*="related"], [id*="related"]');
        var footer = typeof FinishedSiteAds !== 'undefined' && FinishedSiteAds.pageFooter
            ? FinishedSiteAds.pageFooter(doc) : doc.querySelector('footer, [role="contentinfo"]');
        var navigation = typeof FinishedSiteAds !== 'undefined' && FinishedSiteAds.navigationAnchor
            ? FinishedSiteAds.navigationAnchor(doc) : doc.querySelector('header, nav');
        var customPlacements = collectAdInjectionCustomPlacements(main);
        var candidates = page !== 'home' ? [
            ['after-navbar', navigation, 'after', '导航栏下方'],
            ['detail-before-content', content, 'before', '正文前'],
            ['detail-middle', content, 'middle', '正文中部'],
            ['detail-after-related', related, 'after', '相关推荐后'],
            ['footer-top', footer, 'before', '页脚上方']
        ] : [
            ['after-navbar', navigation, 'after', '导航栏下方'],
            ['after-hero', doc.querySelector('.hero, [class*="hero"], main > section'), 'after', '首屏区下方'],
            ['content-top', main && main.firstElementChild, 'before', '内容区顶部'],
            ['after-section-0', sections[0], 'after', '第一个分类后'],
            ['after-section-1', sections[1], 'after', '第二个分类后'],
            ['content-bottom', main && main.lastElementChild, 'after', '内容区底部'],
            ['footer-top', footer, 'before', '页脚上方']
        ];
        var candidatesForOverlay = [];
        function addCandidate(position, target, next, relation, label, kind) {
            if (!target || !target.parentNode || occupied[position]) return;
            var duplicate = candidatesForOverlay.some(function(item) { return item.target === target && item.relation === relation; });
            if (duplicate) return;
            var savedUnits = (getAdInjectionPolicy().slots[page] || []).filter(function(slot) {
                return slot && slot.unit !== 'off' && slot.position === position;
            }).map(function(slot) { return 'advertisement' + String(slot.unit).replace('banner', ''); });
            var confirmation = savedUnits.length ? ' · ' + savedUnits.join(' / ') : '';
            candidatesForOverlay.push({ position: position, target: target, next: next || null, relation: relation, label: label + confirmation, kind: kind });
        }
        candidates.forEach(function(candidate) {
            var position = candidate[0];
            var gap = FinishedSiteAds.placementBoundary(doc, page, position);
            if (gap && gap.anchor) {
                addCandidate(position, gap.anchor, gap.anchor.nextElementSibling, gap.relation, '常用广告位 · ' + candidate[3], 'common');
            }

        });
        customPlacements.forEach(function(candidate) {
            addCandidate(candidate.position, candidate.target, candidate.next, 'after', candidate.label, 'custom');
        });
        mountAdInjectionPlacementOverlay(doc, page, candidatesForOverlay);
    }

    function addAdInjectionPreviewNavigation(doc, entryPath, allowedHosts) {
        var navigationScript = doc.createElement('script');
        navigationScript.setAttribute('data-sitefoundry-preview-navigation', '');
        // Use a classic capture-phase listener. It runs reliably in a sandboxed
        // srcdoc and sees link clicks before an uploaded theme can stop bubbling.
        navigationScript.textContent = "(function(){var fromPath=" + JSON.stringify(normalizeAdInjectionPreviewPath(entryPath))
            + ",allowedHosts=" + JSON.stringify(allowedHosts || []) + ";"
            + "function host(value){return String(value||'').trim().toLowerCase().replace(/^www\\./,'').replace(/\\.$/,'');}"
            + "function linkFor(event){var path=typeof event.composedPath==='function'?event.composedPath():[];for(var i=0;i<path.length;i++){if(path[i]&&path[i].tagName==='A'&&path[i].hasAttribute('href'))return path[i];}return event.target&&event.target.closest?event.target.closest('a[href]'):null;}"
            + "function block(event){event.preventDefault();event.stopPropagation();if(event.stopImmediatePropagation)event.stopImmediatePropagation();}"
            + "function internal(href){if(!/^(?:https?:)?\\/\\//i.test(href))return true;try{var url=new URL(href,'https://sitefoundry-preview.invalid/');return /^https?:$/i.test(url.protocol)&&allowedHosts.indexOf(host(url.hostname))!==-1;}catch(error){return false;}}"
            + "document.addEventListener('click',function(event){var link=linkFor(event);if(!link)return;var href=String(link.getAttribute('href')||'').trim();if(!href||href.charAt(0)==='#')return;if(link.hasAttribute('download')||/^(?:mailto|tel|javascript|data|blob):/i.test(href)||!internal(href)){block(event);return;}block(event);window.parent.postMessage({type:'ad-injection-preview-navigate',href:href,fromPath:fromPath},'*');},true);})();";
        doc.body.appendChild(navigationScript);
    }

    function centerAdInjectionCustomPlacements(doc) {
        // DOMParser documents have no layout box until the preview iframe loads.
        // Run this small, local helper in that iframe and recompute after resizing.
        var script = doc.createElement('script');
        script.type = 'module';
        script.textContent = "(function(){function center(){document.querySelectorAll('.sitefoundry-ad-custom-placement').forEach(function(node){node.style.setProperty('--sitefoundry-ad-center-offset','0px');var rect=node.getBoundingClientRect();var offset=window.innerWidth/2-(rect.left+rect.width/2);node.style.setProperty('--sitefoundry-ad-center-offset',Math.round(offset*100)/100+'px');});}function queue(){requestAnimationFrame(center);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue,{once:true});else queue();addEventListener('resize',queue);})();";
        doc.body.appendChild(script);
    }

    function addAdInjectionPreviewSlots(doc, pageType, entryPath, homePath, config) {
        var warnings = document.getElementById('injection-fixed-warnings');
        if (warnings) warnings.textContent = '';
        if (typeof FinishedSiteAds !== 'undefined' && !FinishedSiteAds.isContentPath(entryPath)) return;
        var settings = getAdInjectionSettings();
        if (settings.mode === 'fixed' && typeof FinishedSiteAds !== 'undefined') {
            // The selected preview tab is authoritative for the root page;
            // uploaded React builds can use aliases that do not equal index.html.
            var fixedPage = adInjectionPreviewPage(pageType);
            var plan = FinishedSiteAds.place(doc, fixedPage, config || {
                bannerPath1: 'preview', bannerPath2: 'preview', bannerPath3: 'preview'
            });
            FinishedSiteAds.decoratePreview(doc);
            if (warnings) warnings.textContent = plan.skipped.length
                ? plan.skipped.map(function(item) { return item.unit + '：' + item.reason + '。'; }).join(' ') + '可勾选单站配置并改用手动放置。'
                : '';
            return;
        }
        var page = adInjectionPreviewPage(pageType);
        var slots = (getAdInjectionPolicy().slots[page] || []).filter(function(slot) {
            if (!slot || slot.unit === 'off' || slot.position === 'off') return false;
            // Hide only this unit's old custom position while it is being moved.
            // Common placements and other units remain visible as placement references.
            return !(slot.unit === appState.adInjectionPlacementMode && /^(?:custom-after-|content-ratio-)/.test(String(slot.position || '')));
        });
        // Use the export resolver instead of a separate preview-only set of
        // fallbacks; candidate selection commits the same semantic position.
        var plan = FinishedSiteAds.placePolicy(doc, page, slots);
        FinishedSiteAds.decoratePreview(doc);
        if (warnings && plan.skipped.length) warnings.textContent = plan.skipped.map(function(item) {
            return item.unit + '：' + item.reason;
        }).join('；');
        centerAdInjectionCustomPlacements(doc);
    }

    function buildAdInjectionPreviewDocument(site, pageType, entryPath) {
        var normalizedEntryPath = normalizeAdInjectionPreviewPath(entryPath);
        var entry = normalizedEntryPath
            ? adInjectionPreviewEntries(site).find(function(item) { return normalizeAdInjectionPreviewPath(item.path).toLowerCase() === normalizedEntryPath.toLowerCase(); })
            : findAdInjectionPreviewEntry(site, pageType);
        if (!entry || isAdInjectionPreviewSourceShell(site, entry)) return '<!doctype html><html><body style="font-family:system-ui;padding:32px;line-height:1.65;color:#172033"><h2>该源码包还没有浏览器可运行的预览产物</h2><p>源码型 React 项目需要先完成自身的依赖安装与生产构建。请把构建后的 <strong>dist、build、out、public、.output/public</strong> 等目录一并放入压缩包后重新上传；纯 HTML/CSS/JavaScript 站点和任何框架的已构建静态产物都可直接预览。</p><p>当前仍可继续配置并导出源码，随后在原项目环境执行构建命令。</p></body></html>';
        clearAdInjectionPreviewUrls();
        var entries = adInjectionPreviewEntries(site);
        var entryByPath = {};
        entries.forEach(function(item) { entryByPath[normalizeAdInjectionPreviewPath(item.path).toLowerCase()] = item; });
        var homeEntry = findAdInjectionPreviewEntry(site, 'home');
        var root = adInjectionPreviewRoot(homeEntry ? homeEntry.path : entry.path);
        var effectsEnabled = !!appState.adInjectionPreviewEffectsEnabled;
        var assetUrls = {};
        entries.filter(function(item) { return !/\.(?:html?|css|[cm]?jsx?|tsx?|map)$/i.test(item.path || ''); }).forEach(function(item) {
            var path = normalizeAdInjectionPreviewPath(item.path);
            assetUrls[path.toLowerCase()] = adInjectionPreviewDataUrl(item.bytes || new Uint8Array(), adInjectionPreviewMime(path));
        });
        // Build imports before their owners, independent of ZIP entry order.
        // A cycle is retained as an unresolved reference and blocked by the
        // frame policy, rather than recursing indefinitely or reading host files.
        var buildingStylesheets = new Set();
        function stylesheetUrl(path) {
            var key = path.toLowerCase();
            if (assetUrls[key]) return assetUrls[key];
            if (buildingStylesheets.has(key) || !entryByPath[key]) return '';
            buildingStylesheets.add(key);
            var css = rewritePreviewCss(entryTextForPreview(entryByPath[key]), path, function(reference, ownerPath) {
                var resolved = resolveAdInjectionPreviewAsset(reference, ownerPath, root, entryByPath);
                if (!resolved) return '';
                return /\.css$/i.test(resolved) ? stylesheetUrl(resolved) : assetUrls[resolved.toLowerCase()] || '';
            });
            buildingStylesheets.delete(key);
            return assetUrls[key] = adInjectionPreviewDataUrl(css, 'text/css;charset=utf-8');
        }
        entries.filter(function(item) { return /\.css$/i.test(item.path || ''); }).forEach(function(item) {
            stylesheetUrl(normalizeAdInjectionPreviewPath(item.path));
        });
        var executeSiteScripts = effectsEnabled || shouldExecuteAdInjectionPreviewScripts(site, entry);
        var frameworkShell = executeSiteScripts && /React|TanStack|Next\.js/i.test(site.project && site.project.framework || '');
        var moduleImports = {};
        entries.filter(function(item) { return executeSiteScripts && /\.(?:[cm]?js|jsx|tsx)$/i.test(item.path || ''); }).forEach(function(item) {
            var path = normalizeAdInjectionPreviewPath(item.path);
            var source = rewriteAdInjectionPreviewModule(entryTextForPreview(item), path, root, entryByPath, assetUrls);
            if (frameworkShell) source = rewriteFrameworkPreview(source);
            var url = adInjectionPreviewDataUrl(source, 'text/javascript;charset=utf-8');
            assetUrls[path.toLowerCase()] = url;
            moduleImports[adInjectionPreviewModuleId(path)] = url;
            var rootedPath = path.indexOf(root) === 0 ? path.slice(root.length) : path;
            moduleImports['/' + rootedPath] = url;
            moduleImports['./' + rootedPath] = url;
        });
        if (effectsEnabled) {
            entries.filter(function(item) {
                return /\.html?$/i.test(item.path || '') && normalizeAdInjectionPreviewPath(item.path).toLowerCase() !== normalizeAdInjectionPreviewPath(entry.path).toLowerCase();
            }).forEach(function(item) {
                var path = normalizeAdInjectionPreviewPath(item.path);
                var embeddedHtml = buildAdInjectionEmbeddedPreviewDocument(item, root, entryByPath, assetUrls, moduleImports);
                assetUrls[path.toLowerCase()] = adInjectionPreviewDataUrl(embeddedHtml, 'text/html;charset=utf-8');
            });
        }
        var doc = new DOMParser().parseFromString(entryTextForPreview(entry), 'text/html');
        doc.querySelectorAll('meta[http-equiv="Content-Security-Policy"], base').forEach(function(node) { node.remove(); });
        doc.querySelectorAll('script[src]').forEach(function(node) {
            if (!executeSiteScripts || /(?:^|\/)js\/ad\.js(?:[?#]|$)/i.test(node.getAttribute('src') || '') || node.hasAttribute('data-sitefoundry-ad-runtime')) {
                node.remove();
                return;
            }
            var source = node.getAttribute('src') || '';
            var resolved = resolveAdInjectionPreviewAsset(source, entry.path, root, entryByPath);
            if (resolved && assetUrls[resolved.toLowerCase()]) node.setAttribute('src', assetUrls[resolved.toLowerCase()]);
            else if (!effectsEnabled || !/^(?:https?:)?\/\//i.test(source)) node.remove();
        });
        if (!executeSiteScripts) doc.querySelectorAll('script:not([type="application/ld+json"]):not([type="application/json"])').forEach(function(node) { node.remove(); });
        doc.querySelectorAll('script[type="module"]:not([src])').forEach(function(node) {
            node.textContent = rewriteAdInjectionPreviewModule(node.textContent, entry.path, root, entryByPath, assetUrls);
            if (frameworkShell) node.textContent = rewriteFrameworkPreview(node.textContent);
        });
        doc.querySelectorAll('link[rel="modulepreload"], link[rel="preload"][as="script"]').forEach(function(node) { node.remove(); });
        doc.querySelectorAll('*').forEach(function(node) {
            Array.from(node.attributes || []).forEach(function(attribute) {
                if ((attribute.name === 'href' || attribute.name === 'src') && /^\s*javascript:/i.test(attribute.value)) node.removeAttribute(attribute.name);
            });
        });
        doc.querySelectorAll('[src], [href], [poster]').forEach(function(node) {
            ['src', 'href', 'poster'].forEach(function(attribute) {
                if (!node.hasAttribute(attribute)) return;
                var reference = node.getAttribute(attribute);
                var resolved = resolveAdInjectionPreviewAsset(reference, entry.path, root, entryByPath);
                if (effectsEnabled && String(node.tagName || '').toLowerCase() === 'iframe' && attribute === 'src' && (!resolved || !assetUrls[resolved.toLowerCase()])) {
                    var bareHtmlPath = normalizeAdInjectionPreviewPath(String(reference || '').replace(/^\/+/, '')).toLowerCase();
                    var htmlMatches = entries.filter(function(item) {
                        var candidatePath = normalizeAdInjectionPreviewPath(item.path).toLowerCase();
                        return /\.html?$/.test(candidatePath) && (candidatePath === bareHtmlPath || candidatePath.endsWith('/' + bareHtmlPath));
                    });
                    if (htmlMatches.length === 1) resolved = normalizeAdInjectionPreviewPath(htmlMatches[0].path);
                }
                // Resolve images and font preload links before the document is
                // parsed, avoiding a first request against the workbench origin.
                var previewableAsset = !/\.html?$/i.test(resolved) || (effectsEnabled && String(node.tagName || '').toLowerCase() === 'iframe');
                if (resolved && previewableAsset && assetUrls[resolved.toLowerCase()]) node.setAttribute(attribute, assetUrls[resolved.toLowerCase()]);
            });
        });
        doc.querySelectorAll('iframe').forEach(function(node) {
            if (!effectsEnabled) {
                var placeholder = doc.createElement('div');
                placeholder.setAttribute('role', 'status');
                placeholder.setAttribute('aria-label', '3D 与嵌套效果预览已关闭');
                placeholder.style.cssText = 'min-height:240px;display:grid;place-items:center;padding:24px;box-sizing:border-box;border:1px dashed #7b8492;border-radius:10px;background:rgba(127,132,146,.08);color:inherit;font:600 14px/1.5 system-ui,sans-serif;text-align:center;';
                placeholder.textContent = '3D / 嵌套效果预览已关闭';
                node.replaceWith(placeholder);
                return;
            }
            var source = String(node.getAttribute('src') || '').trim();
            if (source && !/^(?:data:|https?:|\/\/|about:)/i.test(source)) {
                node.removeAttribute('src');
                node.setAttribute('srcdoc', '<!doctype html><meta charset="utf-8"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#f5f7fa;color:#27364a;font:14px/1.6 system-ui,sans-serif;text-align:center}</style><body>压缩包中没有找到此嵌套页面，已阻止它回退到建站工具地址。</body>');
            }
        });
        doc.querySelectorAll('style').forEach(function(node) {
            node.textContent = rewriteAdInjectionPreviewCss(node.textContent, entry.path, root, entryByPath, assetUrls);
        });
        doc.querySelectorAll('[style]').forEach(function(node) {
            node.setAttribute('style', rewriteAdInjectionPreviewCss(node.getAttribute('style'), entry.path, root, entryByPath, assetUrls));
        });
        var csp = doc.createElement('meta');
        csp.httpEquiv = 'Content-Security-Policy';
        csp.content = adInjectionPreviewCsp(effectsEnabled);
        doc.head.prepend(csp);
        if (frameworkShell) {
            var routePath = normalizeAdInjectionPreviewPath(entry.path).slice(root.length)
                .replace(/(?:^|\/)index\.html?$/i, '').replace(/\.html?$/i, '');
            var frameworkRuntime = doc.createElement('script');
            frameworkRuntime.textContent = frameworkPreviewRuntime(appState.adInjectionPreviewRoute || '/' + routePath, entry.path);
            csp.after(frameworkRuntime);
        }
        if (Object.keys(moduleImports).length) {
            var importMap = doc.createElement('script');
            importMap.type = 'importmap';
            importMap.textContent = JSON.stringify({ imports: moduleImports }).replace(/</g, '\\u003c');
            csp.after(importMap);
        }
        if (Object.keys(assetUrls).length) {
            var runtimeAssetResolver = doc.createElement('script');
            runtimeAssetResolver.setAttribute('data-sitefoundry-preview-assets', '');
            runtimeAssetResolver.textContent = adInjectionPreviewRuntimeAssetResolver(entry.path, root, assetUrls, effectsEnabled);
            var importMapNode = doc.querySelector('script[type="importmap"]');
            (importMapNode || csp).after(runtimeAssetResolver);
        }
        appState._previewAssetUrls = assetUrls;
        var previewMatch = typeof AdRestoration !== 'undefined'
            ? AdRestoration.matchAdCodesToSites([site], appState.adInjectionCodes || []).mappings[0] : null;
        var previewPaths = previewMatch && previewMatch.valid && previewMatch.code
            ? previewMatch.code.config
            : { bannerPath1: 'preview', bannerPath2: 'preview', bannerPath3: 'preview' };
        addAdInjectionPreviewSlots(doc, pageType, entry.path, homeEntry && homeEntry.path, previewPaths);
        if (executeSiteScripts
            && typeof FinishedSiteAds !== 'undefined' && FinishedSiteAds.isContentPath(entry.path)) {
            // Hydrated React pages can replace the uploaded HTML after the
            // initial preview plan. Re-run the same planner after hydration.
            var fixedPreviewPage = adInjectionPreviewPage(pageType);
            var fixedPreviewRuntime = doc.createElement('script');
            fixedPreviewRuntime.textContent = FinishedSiteAds.dynamicRuntimeSource(previewPaths, getAdInjectionSettings().version, {
                previewPageType: fixedPreviewPage,
                previewPath: String(appState.adInjectionPreviewRoute || '').split(/[?#]/)[0],
                policy: getAdInjectionSettings().mode === 'manual' ? getAdInjectionPolicy() : null
            });
            doc.body.appendChild(fixedPreviewRuntime);
        }
        if (getAdInjectionSettings().mode === 'manual' && (typeof FinishedSiteAds === 'undefined' || FinishedSiteAds.isContentPath(entry.path))) {
            addAdInjectionPlacementMarkers(doc, pageType);
        }
        addAdInjectionPreviewNavigation(doc, entry.path, adInjectionPreviewAllowedHosts(site));
        return '<!doctype html>\n' + doc.documentElement.outerHTML;
    }

    function currentAdInjectionPreviewPage() {
        var activeTab = document.querySelector('.preview-tab.active');
        return adInjectionPreviewPage(activeTab ? activeTab.dataset.page : 'home');
    }

    function adInjectionPlacementSummary(unit) {
        var parts = [];
        [['home', '首页'], ['article', '文章'], ['tool', '工具'], ['game', '游戏']].forEach(function(item) {
            var position = adInjectionPolicyPlacement(unit, item[0]);
            if (position) parts.push(item[1] + ': ' + adInjectionPlacementLabel(position));
        });
        return parts.length ? parts.join(' | ') : '未放置';
    }

    function syncAdInjectionPlacementControls() {
        var page = currentAdInjectionPreviewPage();
        var activeUnit = appState.adInjectionPlacementMode;
        document.querySelectorAll('.injection-ad-select-btn').forEach(function(button) {
            var unit = button.dataset.injectionAdUnit;
            var isActive = activeUnit === unit;
            var hasCurrent = !!adInjectionPolicyPlacement(unit, page);
            var hasOther = ['home', 'article', 'tool', 'game'].some(function(other) {
                return other !== page && !!adInjectionPolicyPlacement(unit, other);
            });
            button.textContent = isActive ? '取消放置' : hasCurrent ? '重新放置' : hasOther ? '放置到当前页' : '选择位置';
            button.disabled = !!activeUnit && !isActive;
            button.classList.toggle('is-active', isActive);
        });
        document.querySelectorAll('.injection-ad-position-label').forEach(function(label) {
            label.textContent = adInjectionPlacementSummary(label.dataset.injectionAdUnit);
        });
        document.querySelectorAll('.injection-ad-remove-btn').forEach(function(button) {
            var unit = button.dataset.injectionAdUnit;
            button.hidden = !adInjectionPolicyPlacement(unit, page);
            button.textContent = '移除当前页';
        });
        var hint = document.getElementById('injection-ad-placement-hint');
        if (hint) hint.hidden = !activeUnit;
    }

    function renderAdInjectionPlacementControls(grid) {
        if (!grid) return;
        grid.innerHTML = ['banner1', 'banner2', 'banner3'].map(function(unit, index) {
            return '<article class="ad-container-config injection-policy-card">' +
                '<div class="ad-slot-header"><span class="ad-slot-name">广告' + (index + 1) + '</span>' +
                '<div class="ad-slot-actions"><button type="button" class="ad-select-btn injection-ad-select-btn" data-injection-ad-unit="' + unit + '">选择位置</button>' +
                '<button type="button" class="ad-remove-btn injection-ad-remove-btn" data-injection-ad-unit="' + unit + '">移除</button></div></div>' +
                '<div class="ad-slot-meta">ID: div-gpt-ad-banner' + (index + 1) + ' <span aria-hidden="true">·</span> 位置: ' +
                '<span class="ad-position-label injection-ad-position-label" data-injection-ad-unit="' + unit + '">' + escapeHtml(adInjectionPlacementSummary(unit)) + '</span></div></article>';
        }).join('') + '<div class="ad-placement-hint injection-ad-placement-hint" id="injection-ad-placement-hint" hidden>已选择广告。右侧仍显示常用广告位；也可将鼠标移动到上下内容之间的留白，整块留白会变为可点击的自定义位置。重新放置时仅隐藏当前自定义广告，不会挤压原页面布局。</div>';
        syncAdInjectionPlacementControls();
    }

    function syncAdInjectionPreviewEffectsControl() {
        var button = document.getElementById('preview-effects-toggle');
        if (!button) return;
        var available = isAdInjectionWorkflow() && appState.currentStep === 4;
        var enabled = available && !!appState.adInjectionPreviewEffectsEnabled;
        var label = button.querySelector('.preview-effects-label');
        button.hidden = !available;
        button.classList.toggle('is-active', enabled);
        button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        button.setAttribute('aria-label', enabled ? '关闭 3D 与外部效果预览' : '打开 3D 与外部效果预览');
        button.title = enabled
            ? '关闭完整效果并重新加载安全预览'
            : '打开 Three.js、WebGL、嵌套页面与外部资源效果';
        if (label) label.textContent = enabled ? '3D 已开' : '3D 关闭';
    }

    function renderAdInjectionConfig() {
        syncAdInjectionPreviewEffectsControl();
        var sites = appState.adInjectionSites || [];
        var policy = getAdInjectionPolicy();
        var selectedId = appState.adInjectionPreviewSiteId;
        if (!sites.some(function(site) { return site.id === selectedId; })) selectedId = sites[0] ? sites[0].id : '';
        appState.adInjectionPreviewSiteId = selectedId;
        syncAdInjectionSettingsControls();
        var activeSite = sites.find(function(site) { return site.id === selectedId; }) || null;
        syncAdInjectionPageTabs(activeSite);
        var structure = document.getElementById('injection-structure-summary');
        var select = document.getElementById('injection-preview-site');
        if (select) {
            select.disabled = !sites.length;
            select.innerHTML = sites.length
                ? sites.map(function(site) { return '<option value="' + escapeHtml(site.id) + '">' + escapeHtml(site.name) + ' · ' + escapeHtml((site.project && site.project.framework) || '待识别') + '</option>'; }).join('')
                : '<option>等待上传站点</option>';
            select.value = selectedId;
            if (sites.length) {
                rebuildStyledSelect(select);
                var trigger = select.closest('.select-shell').querySelector('.select-trigger');
                if (trigger) trigger.setAttribute('aria-label', '实时预览站点');
                syncStyledSelects();
            }
        }
        if (structure) structure.innerHTML = activeSite
            ? '<strong>' + escapeHtml(activeSite.name) + '</strong><br>站点类型：' + escapeHtml((activeSite.project && activeSite.project.framework) || '正在识别') + '<br>源码入口：' + escapeHtml((activeSite.project && activeSite.project.entryPath) || '由框架路由管理') + '<br>预览入口：' + escapeHtml((activeSite.project && activeSite.project.previewEntryPath) || (activeSite.project && activeSite.project.entryPath) || '未包含构建产物') + '<br>本次识别到 ' + activeSite.entries.length + ' 个源文件。'
            : '请先上传已过审网站压缩包。';
        var grid = document.getElementById('injection-policy-grid');
        if (grid && typeof AdRestoration !== 'undefined') {
            renderAdInjectionPlacementControls(grid);
        }
        renderAdInjectionFields();
    }

    function adInjectionPreviewNotice(title, message) {
        return '<!doctype html><html><body style="font-family:system-ui;padding:32px;line-height:1.65;color:#172033;background:#fff"><h2>' + escapeHtml(title) + '</h2><p>' + escapeHtml(message) + '</p></body></html>';
    }

    function ensureAdInjectionPreviewBuild(site) {
        var sourceEntries = adInjectionPreviewSourceEntries(site);
        if (!site || !previewBuildPlan(sourceEntries)) return null;
        if (site._previewBuild) return site._previewBuild.promise || null;
        var state = site._previewBuild = { status: 'building', entries: [], entryPath: '', error: '', promise: null };
        state.promise = buildPreviewSite(sourceEntries).then(function(result) {
            state.status = 'ready';
            state.entries = result.entries || [];
            state.entryPath = result.entryPath || '';
            state.outputRoot = result.outputRoot || '';
            state.omittedCount = result.omittedCount || 0;
            state.promise = null;
            if (site.id === appState.adInjectionPreviewSiteId && isAdInjectionWorkflow() && appState.currentStep === 4) {
                appState.adInjectionPreviewEntryPath = '';
                renderAdInjectionConfig();
                updateAdInjectionPreview();
            }
            return result;
        }).catch(function(error) {
            state.status = 'error';
            state.error = formatUiError(error, '浏览器内预览构建失败。');
            state.promise = null;
            if (site.id === appState.adInjectionPreviewSiteId && isAdInjectionWorkflow() && appState.currentStep === 4) {
                renderAdInjectionConfig();
                updateAdInjectionPreview();
            }
        });
        return state.promise;
    }

    /**
     * 将源码包在隔离预览环境中生成的静态产物转换为广告注入输入。
     * 预览和最终导出必须使用同一份构建结果，否则源码包里的审计目录、
     * 示例游戏或旧产物可能被误识别为成品站根目录。
     */
    async function prepareAdInjectionExportSites(sites, exportMode) {
        var prepared = [];
        for (const site of Array.from(sites || [])) {
            if (site.project && site.project.kind === 'react-source') {
                prepared.push(exportMode === 'source' ? site : AdRestoration.staticDeploymentSite(site));
                continue;
            }
            var sourceEntries = adInjectionPreviewSourceEntries(site);
            if (!previewBuildPlan(sourceEntries)) {
                prepared.push(site);
                continue;
            }

            var pendingBuild = ensureAdInjectionPreviewBuild(site);
            if (pendingBuild) await pendingBuild;
            var build = site && site._previewBuild;
            if (!build || build.status !== 'ready' || !build.entries || !build.entries.length) {
                throw new Error((site && site.name || '当前站点') + ' 的静态生成结果不可用，无法安全加入广告。' + (build && build.error ? ' ' + build.error : ''));
            }

            var outputRoot = normalizeAdInjectionPreviewPath(build.outputRoot || adInjectionPreviewRoot(build.entryPath || ''));
            var entries = build.entries.filter(function(entry) {
                var path = normalizeAdInjectionPreviewPath(entry.path || '');
                return !outputRoot || path.indexOf(outputRoot) === 0;
            }).map(function(entry) {
                var path = normalizeAdInjectionPreviewPath(entry.path || '');
                return {
                    path: outputRoot ? path.slice(outputRoot.length) : path,
                    bytes: entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes || [])
                };
            }).filter(function(entry) { return !!entry.path; });
            var project = AdRestoration.classifyInjectableSiteEntries(entries, site.name);
            if (!project.valid) {
                throw new Error((site.name || '当前站点') + ' 的静态生成结果无法识别为可部署网站。');
            }
            prepared.push(Object.assign({}, site, {
                entries: entries,
                previewSourceEntries: null,
                sourceEntries: site.sourceEntries || sourceEntries,
                sourceDeploymentRoot: outputRoot,
                sourceRoot: String(site.sourceRoot || '') + outputRoot,
                project: project
            }));
        }
        return prepared;
    }

    function updateAdInjectionPreview(pageType, entryPath, virtualRoute) {
        if (!isAdInjectionWorkflow() || appState.currentStep !== 4) return;
        syncAdInjectionPreviewEffectsControl();
        var sites = appState.adInjectionSites || [];
        var site = sites.find(function(item) { return item.id === appState.adInjectionPreviewSiteId; }) || sites[0];
        if (!site) return;
        var hasExplicitPage = typeof pageType === 'string' && !!pageType;
        if (hasExplicitPage || virtualRoute) appState.adInjectionPreviewRoute = virtualRoute || '';
        if (!pageType) {
            var activeTab = document.querySelector('.preview-tab.active');
            pageType = activeTab ? activeTab.dataset.page : 'home';
        }
        if (entryPath) appState.adInjectionPreviewEntryPath = normalizeAdInjectionPreviewPath(entryPath);
        else if (hasExplicitPage) appState.adInjectionPreviewEntryPath = '';
        syncAdInjectionPlacementControls();
        var previewSourceEntries = adInjectionPreviewSourceEntries(site);
        var hasDedicatedPreviewSource = previewSourceEntries !== site.entries;
        if (!site._previewBuild) {
            site._previewBuild = adInjectionUploadedPreviewArtifact(site, previewSourceEntries);
        }
        var currentEntry = findAdInjectionPreviewEntry(site, pageType);
        var hasUploadedArtifact = !!(site._previewBuild && site._previewBuild.status === 'ready' && site._previewBuild.uploadedArtifact);
        var needsPreviewBuild = (hasDedicatedPreviewSource && !hasUploadedArtifact) || !currentEntry || isAdInjectionPreviewSourceShell(site, currentEntry);
        if (needsPreviewBuild && previewBuildPlan(previewSourceEntries)) {
            ensureAdInjectionPreviewBuild(site);
            previewFrame.setAttribute('sandbox', 'allow-scripts');
            previewFrame.removeAttribute('src');
            if (!site._previewBuild || site._previewBuild.status === 'building') {
                setPreviewDocument(adInjectionPreviewNotice('正在准备完整预览', '正在当前浏览器的隔离环境中执行该站点自带的静态生成脚本；源压缩包和导出内容不会被修改。'));
                return;
            }
            if (site._previewBuild.status === 'error') {
                setPreviewDocument(adInjectionPreviewNotice('预览构建失败', site._previewBuild.error));
                return;
            }
        }
        var html = buildAdInjectionPreviewDocument(site, pageType, appState.adInjectionPreviewEntryPath);
        previewFrame.setAttribute('sandbox', 'allow-scripts');
        previewFrame.removeAttribute('src');
        setPreviewDocument(html);
    }

    function initAdInjectionConfig() {
        var panel = document.getElementById('ad-injection-config-panel');
        if (!panel || panel.dataset.ready === 'true') return;
        panel.dataset.ready = 'true';
        var siteSelect = document.getElementById('injection-preview-site');
        if (siteSelect) siteSelect.addEventListener('change', function() { appState.adInjectionPreviewSiteId = this.value; appState.adInjectionPreviewEntryPath = ''; appState.adInjectionPreviewRoute = ''; renderAdInjectionConfig(); updateAdInjectionPreview(); });
        var overrideToggle = document.getElementById('injection-site-override');
        if (overrideToggle) overrideToggle.addEventListener('change', function() {
            var id = appState.adInjectionPreviewSiteId;
            if (!id) return;
            if (this.checked) appState.adInjectionSiteOverrides[id] = {
                mode: appState.adInjectionPlacementModeDefault,
                version: appState.adInjectionAdJsVersion,
                policy: JSON.parse(JSON.stringify(appState.adInjectionPolicy || createAdInjectionPolicy()))
            };
            else delete appState.adInjectionSiteOverrides[id];
            renderAdInjectionConfig();
            updateAdInjectionPreview();
        });
        document.querySelectorAll('input[name="injection-placement-mode"]').forEach(function(input) {
            input.addEventListener('change', function() {
                if (!this.checked) return;
                var override = appState.adInjectionSiteOverrides[appState.adInjectionPreviewSiteId];
                if (override) override.mode = this.value;
                else appState.adInjectionPlacementModeDefault = this.value;
                syncAdInjectionSettingsControls();
                updateAdInjectionPreview();
            });
        });
        var injectionVersionGroup = panel.querySelector('input[name="injection-ad-version"]')?.closest('.ad-js-version-grid');
        if (injectionVersionGroup) injectionVersionGroup.addEventListener('change', function(event) {
            var input = event.target;
            if (!input.matches('input[name="injection-ad-version"]') || !input.checked) return;
            var version = typeof FinishedSiteAds !== 'undefined' ? FinishedSiteAds.normalizeVersion(input.value) : input.value;
            var override = appState.adInjectionSiteOverrides[appState.adInjectionPreviewSiteId];
            if (override) override.version = version;
            else appState.adInjectionAdJsVersion = version;
            syncAdInjectionSettingsControls();
        });
        var policyGrid = document.getElementById('injection-policy-grid');
        if (policyGrid) policyGrid.addEventListener('click', function(event) {
            var selectButton = event.target.closest('.injection-ad-select-btn');
            var removeButton = event.target.closest('.injection-ad-remove-btn');
            var unit = (selectButton || removeButton) && (selectButton || removeButton).dataset.injectionAdUnit;
            if (!unit || typeof AdRestoration === 'undefined') return;
            if (removeButton) {
                setAdInjectionPolicyPlacement(unit, currentAdInjectionPreviewPage(), '');
                if (appState.adInjectionPlacementMode === unit) appState.adInjectionPlacementMode = null;
            } else if (appState.adInjectionPlacementMode === unit) {
                appState.adInjectionPlacementMode = null;
            } else {
                appState.adInjectionPlacementMode = unit;
            }
            renderAdInjectionPlacementControls(policyGrid);
            updateAdInjectionPreview();
        });
        window.addEventListener('message', function(event) {
            if (event.source !== previewFrame.contentWindow || !event.data) return;
            if (event.data.type === 'sitefoundry-preview-asset-request') {
                var assetUrl = (appState._previewAssetUrls || {})[String(event.data.path || '').toLowerCase()];
                if (assetUrl) event.source.postMessage({
                    type: 'sitefoundry-preview-asset-response',
                    token: event.data.token,
                    path: event.data.path,
                    url: assetUrl
                }, '*');
                return;
            }
            if (event.data.type === 'ad-injection-preview-navigate') {
                var sites = appState.adInjectionSites || [];
                var site = sites.find(function(item) { return item.id === appState.adInjectionPreviewSiteId; }) || sites[0];
                if (!site) return;
                var homeEntry = findAdInjectionPreviewEntry(site, 'home');
                var root = adInjectionPreviewRoot(homeEntry ? homeEntry.path : event.data.fromPath);
                var targetEntry = resolvePreviewHtmlEntry(
                    adInjectionPreviewEntries(site), event.data.href, event.data.fromPath, root,
                    adInjectionPreviewAllowedHosts(site)
                );
                var virtualRoute = '';
                if (!targetEntry && homeEntry && /React|TanStack|Next\.js/i.test(site.project && site.project.framework || '')
                    && isPreviewInternalHref(event.data.href, adInjectionPreviewAllowedHosts(site))) {
                    // A SPA has one HTML entry for many real routes. Recreate
                    // its isolated preview at the selected virtual pathname,
                    // rather than requiring a nonexistent route/index.html.
                    var fromRoute = appState.adInjectionPreviewRoute || '/' + String(event.data.fromPath || '').slice(root.length);
                    var virtualUrl = new URL(event.data.href, 'https://sitefoundry-preview.invalid' + fromRoute);
                    virtualRoute = virtualUrl.pathname + virtualUrl.search + virtualUrl.hash;
                    targetEntry = homeEntry;
                }
                if (!targetEntry) return;
                var targetPath = virtualRoute ? virtualRoute.split(/[?#]/)[0] : targetEntry.path;
                var targetPage = previewContentTypeForEntry(targetPath, virtualRoute ? '' : root);
                if (targetPage === 'article' && !virtualRoute) targetPage = adInjectionEntryPageType(targetEntry, root, homeEntry && homeEntry.path);
                var targetTypedTab = document.querySelector('.preview-tab[data-page="' + targetPage + '"]');
                if (targetTypedTab && ['article', 'tool', 'game'].indexOf(targetPage) !== -1) targetTypedTab.hidden = false;
                document.querySelectorAll('.preview-tab').forEach(function(tab) {
                    var active = tab.dataset.page === targetPage;
                    tab.classList.toggle('active', active);
                    tab.classList.toggle('is-jelly-active', active);
                });
                updateAdInjectionPreview(targetPage, targetEntry.path, virtualRoute);
                return;
            }
            if (event.data.type === 'ad-injection-fixed-skipped') {
                var fixedWarnings = document.getElementById('injection-fixed-warnings');
                if (fixedWarnings) fixedWarnings.textContent = (Array.isArray(event.data.skipped) ? event.data.skipped : [])
                    .filter(function(item) { return item && /^banner[123]$/.test(item.unit); })
                    .map(function(item) { return item.unit + '：' + String(item.reason || '未找到可靠位置'); })
                    .join('。');
                return;
            }
            if (event.data.type !== 'ad-injection-place' || !appState.adInjectionPlacementMode) return;
            var placementPage = ['home', 'article', 'tool', 'game'].indexOf(event.data.page) !== -1 ? event.data.page : 'article';
            setAdInjectionPolicyPlacement(appState.adInjectionPlacementMode, placementPage, event.data.position);
            appState.adInjectionPlacementMode = null;
            renderAdInjectionPlacementControls(policyGrid);
            updateAdInjectionPreview();
        });
    }

    function renderAdInjectionResult(results, outputName, failedMessage, isFolder) {
        var target = document.getElementById('injection-result');
        if (!target) return;
        results = results || [];
        var successful = results.filter(function(item) { return item.valid; });
        var failed = results.filter(function(item) { return !item.valid; });
        target.hidden = false;
        target.className = 'injection-result ' + (successful.length && !failedMessage ? 'is-success' : 'is-error');
        var heading = failedMessage || (successful.length
            ? '已为 ' + successful.length + ' 个成品站完成广告与部署产物核验' + (failed.length ? '，' + failed.length + ' 个未通过校验' : '')
            : '成品站广告注入未完成');
        var html = '<h4>' + escapeHtml(heading) + '</h4>';
        if (outputName) html += '<p>' + (isFolder ? '已生成新目录：' : '已开始下载：') + '<strong>' + escapeHtml(outputName) + '</strong></p>';
        if (results.length) html += '<ul>' + results.map(function(item) {
            var detail = item.valid
                ? '成功：' + item.siteName + '（' + item.framework + '，' + item.host + '，核验 ' + ((item.verification && item.verification.checkedPages || []).length) + ' 个页面，' + (item.exportScope || '完整静态源码') + '）'
                : '失败：' + item.siteName + '—' + (item.errors || []).map(function(error) { return error.message; }).join('；');
            return '<li>' + escapeHtml(detail) + '</li>';
        }).join('') + '</ul>';
        target.innerHTML = html;
    }

    function initAdInjectionControls() {
        var directoryButton = document.getElementById('injection-directory-button');
        var directoryInput = document.getElementById('injection-directory-input');
        var siteButton = document.getElementById('injection-sites-button');
        var siteInput = document.getElementById('injection-sites-input');
        var codeButton = document.getElementById('injection-code-button');
        var codeInput = document.getElementById('injection-code-input');
        var pasteButton = document.getElementById('injection-paste-button');
        var pastePanel = document.getElementById('injection-paste-panel');
        var pasteInput = document.getElementById('injection-code-paste');
        var parsePaste = document.getElementById('injection-parse-paste');
        var fields = document.getElementById('injection-fields');
        var allowPartial = document.getElementById('injection-allow-partial');
        var runButton = document.getElementById('injection-run');
        if (!runButton || runButton.dataset.ready === 'true') return;
        runButton.dataset.ready = 'true';
        initAdInjectionConfig();

        if (pasteButton && pastePanel) pasteButton.addEventListener('click', function() {
            pastePanel.hidden = !pastePanel.hidden;
            if (!pastePanel.hidden && pasteInput) pasteInput.focus();
        });
        if (parsePaste) parsePaste.addEventListener('click', function() {
            var pasted = pasteInput && pasteInput.value || '';
            if (!pasted.trim()) return;
            var parsed = AdMigration.inspectAdCodeText(pasted, 'pasted-ad-code.txt');
            parsed.fileName = 'pasted-ad-code.txt';
            appState.adInjectionCodes = [parsed];
            refreshAdInjectionCodeValidity(parsed);
            renderAdInjectionConfig();
            updateAdInjectionControls();
            updateAdInjectionPreview();
        });
        if (allowPartial) allowPartial.addEventListener('change', function() {
            appState.adInjectionAllowPartial = !!this.checked;
            (appState.adInjectionCodes || []).forEach(refreshAdInjectionCodeValidity);
            renderAdInjectionConfig();
            updateAdInjectionControls();
        });
        if (fields) fields.addEventListener('input', function(event) {
            var key = event.target && event.target.dataset && event.target.dataset.injectionConfigKey;
            var code = (appState.adInjectionCodes || [])[0];
            if (!key || !code) return;
            code.config[key] = String(event.target.value || '').trim();
            refreshAdInjectionCodeValidity(code);
            renderAdInjectionFields();
            updateAdInjectionControls();
            updateAdInjectionPreview();
        });

        async function scanSource(mode, source) {
            var progress = document.getElementById('injection-scan-progress');
            var fill = document.getElementById('injection-scan-progress-fill');
            var textTarget = document.getElementById('injection-scan-progress-text');
            var resultTarget = document.getElementById('injection-result');
            var lastProgress = 0;
            if (progress) progress.hidden = false;
            if (progress) progress.classList.remove('is-indeterminate');
            if (fill) fill.style.width = '0%';
            if (resultTarget) resultTarget.hidden = true;
            resetWorkflowStepProgress('ad-injection');
            adInjectionRunning = true;
            updateAdInjectionControls();
            try {
                // 解析器不可量化的阶段显示不定向动画；可量化进度只增不减，避免回退造成误导。
                var progressCallback = function(percent, message, state) {
                    var indeterminate = percent === null || percent === undefined || (state && state.indeterminate === true);
                    if (progress) progress.classList.toggle('is-indeterminate', indeterminate);
                    if (fill) {
                        if (indeterminate) {
                            fill.style.width = '';
                        } else {
                            var nextProgress = Number(percent);
                            if (!Number.isFinite(nextProgress)) nextProgress = lastProgress;
                            nextProgress = Math.max(lastProgress, Math.max(0, Math.min(100, nextProgress)));
                            lastProgress = nextProgress;
                            fill.style.width = nextProgress + '%';
                        }
                    }
                    if (textTarget) textTarget.textContent = message;
                };
                var selectedArchives = mode === 'archives' ? Array.from(source || []) : [];
                var needsArchiveRuntime = selectedArchives.some(function(file) { return /\.(?:rar|7z)$/i.test(String(file && file.name || '')); });
                if (needsArchiveRuntime) {
                    progressCallback(null, '正在加载 RAR / 7Z 本地解析组件…', { indeterminate: true });
                    var archiveRuntime = await ensureArchiveRuntime();
                    // readRarArchive 通过同一 Promise 获取实例，避免重复加载或竞态。
                    window.ArchiveRuntimeReady = Promise.resolve(archiveRuntime);
                }
                var scan = mode === 'directory-handle'
                    ? await AdRestoration.readInjectableDirectoryHandle(source, progressCallback)
                    : mode === 'directory'
                        ? await AdRestoration.readInjectableDirectoryFiles(source, progressCallback)
                        : await AdRestoration.readInjectableArchiveFiles(source, progressCallback);
                appState.adInjectionSites = scan.sites;
                appState.adInjectionSourceMode = mode === 'archives' ? 'archives' : 'directory';
                appState.adInjectionPreviewSiteId = scan.sites[0] ? scan.sites[0].id : '';
                appState.adInjectionPolicy = typeof AdRestoration !== 'undefined' ? createAdInjectionPolicy() : null;
                appState.adInjectionSiteOverrides = {};
                if (progress) progress.classList.remove('is-indeterminate');
                if (fill) fill.style.width = '100%';
                if (textTarget) textTarget.textContent = '已识别 ' + scan.sites.length + ' 个成品站、' + scan.fileCount + ' 个文件';
            } catch (error) {
                appState.adInjectionSites = [];
                appState.adInjectionSourceMode = '';
                if (progress) progress.classList.remove('is-indeterminate');
                var scanError = formatUiError(error, '压缩包解析器未返回错误详情，请刷新页面后重试；RAR 文件会自动切换 RAR5 解析器。');
                if (textTarget) textTarget.textContent = '成品站识别失败：' + scanError;
                renderAdInjectionResult([], '', scanError, false);
            } finally {
                adInjectionRunning = false;
                updateAdInjectionControls();
                renderAdInjectionConfig();
                syncWorkflowNavigation();
            }
        }

        if (directoryButton && directoryInput) directoryButton.addEventListener('click', function() {
            var supported = typeof window.showDirectoryPicker === 'function';
            var message = supported
                ? '工具只在当前浏览器中读取成品站目录，用于识别静态 HTML 或 React 结构；不会上传文件，也不会修改源站。\n\n确认后请选择单个站点目录，或包含多个站点文件夹的总目录。'
                : '当前浏览器不支持新版的本地目录读取，将改用兼容方式。浏览器可能显示批量文件确认。';
            showConfirm(message, '读取成品站目录', supported ? '选择目录' : '使用兼容方式', async function(confirmed) {
                if (!confirmed) return;
                if (!supported) {
                    directoryInput.value = '';
                    directoryInput.click();
                    return;
                }
                try {
                    var handle = await window.showDirectoryPicker({ mode: 'read', id: 'finished-site-ad-source' });
                    await scanSource('directory-handle', handle);
                } catch (error) {
                    if (error && error.name === 'AbortError') return;
                    renderAdInjectionResult([], '', '无法读取所选目录：' + (error && error.message ? error.message : '请重新选择目录。'), false);
                }
            }, { variant: 'directory', symbol: '+', eyebrow: '仅在本机处理', cancelLabel: '取消' });
        });
        if (directoryInput) directoryInput.addEventListener('change', function() {
            if (this.files && this.files.length) scanSource('directory', Array.from(this.files));
        });
        if (siteButton && siteInput) siteButton.addEventListener('click', function() { siteInput.value = ''; siteInput.click(); });
        if (siteInput) siteInput.addEventListener('change', function() {
            if (!this.files || !this.files.length) return;
            appState.adInjectionArchiveFiles = Array.from(this.files);
            scanSource('archives', appState.adInjectionArchiveFiles);
        });
        if (codeButton && codeInput) codeButton.addEventListener('click', function() { codeInput.value = ''; codeInput.click(); });
        if (codeInput) codeInput.addEventListener('change', async function() {
            if (!this.files || !this.files.length) return;
            appState.adInjectionCodeFiles = Array.from(this.files);
            adInjectionRunning = true;
            updateAdInjectionControls();
            try {
                appState.adInjectionCodes = await AdRestoration.readAdvertiserCodeFiles(appState.adInjectionCodeFiles);
                appState.adInjectionCodes.forEach(refreshAdInjectionCodeValidity);
            } catch (error) {
                appState.adInjectionCodes = [];
                renderAdInjectionResult([], '', error.message, false);
            } finally {
                adInjectionRunning = false;
                updateAdInjectionControls();
                renderAdInjectionConfig();
                updateAdInjectionPreview();
            }
        });
        async function runAdInjectionExport(useDirectory) {
            if (adInjectionRunning) return;
            var destinationHandle = null;
            if (useDirectory && typeof window.showDirectoryPicker === 'function') {
                try { destinationHandle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'finished-site-ad-output' }); }
                catch (pickerError) { if (pickerError && pickerError.name === 'AbortError') return; throw pickerError; }
            }
            adInjectionRunning = true;
            updateAdInjectionControls();
            var resultTarget = document.getElementById('injection-result');
            if (resultTarget) resultTarget.hidden = true;
            updateWorkflowExportProgress('injection-progress', 0, appState.adInjectionExportMode === 'source' ? '正在准备完整源码副本…' : '正在准备可部署的静态站产物…');
            try {
                var exportMode = appState.adInjectionExportMode;
                var exportSites = await prepareAdInjectionExportSites(appState.adInjectionSites, exportMode);
                var sourceExporter = exportMode === 'source'
                    ? (await import('./finished-source-export.js')).createFinishedSourceExport : null;
                var output = await AdRestoration.applyAdCodeBatch(exportSites, appState.adInjectionCodes, function(percent, message) {
                    updateWorkflowExportProgress('injection-progress', Math.min(percent, 88), message);
                }, {
                    mode: appState.adInjectionPlacementModeDefault,
                    version: appState.adInjectionAdJsVersion,
                    policy: appState.adInjectionPolicy,
                    overrides: appState.adInjectionSiteOverrides,
                    exportMode: exportMode
                }, injectReactSource, sourceExporter);
                updateWorkflowExportProgress('injection-progress', null, '正在进行导出前全站体检…');
                var preflightReport = inspectOutputSites(output);
                if (destinationHandle) {
                    await AdRestoration.writePolicyBatchToDirectory(output, destinationHandle, function(percent, message) {
                        updateWorkflowExportProgress('injection-progress', 88 + Math.round(percent * .12), message);
                    });
                    renderAdInjectionResult(output.results, output.folderName, '', true);
                } else {
                    updateWorkflowExportProgress('injection-progress', 88, '正在生成成品站广告注入 ZIP…');
                    var blob = await AdRestoration.zipPolicyBatch(output);
                    var fileName = output.folderName + '.zip';
                    await saveRestorationBlob(blob, fileName);
                    renderAdInjectionResult(output.results, fileName, '', false);
                }
                var injectionHasFailures = output.results.some(function(result) { return !result.valid; });
                updateWorkflowExportProgress('injection-progress', 100, injectionHasFailures ? '处理结束，部分站点未导出，请查看处理结果。' : '成品站广告注入导出完成。', injectionHasFailures ? 'error' : 'success');
                renderExportPreflight(preflightReport, 'injection-result');
            } catch (error) {
                updateWorkflowExportProgress('injection-progress', null, '成品站广告注入未完成：' + error.message, 'error');
                renderAdInjectionResult(error.results || [], '', error.message, false);
                renderExportPreflight(error.preflightReport, 'injection-result');
            } finally {
                adInjectionRunning = false;
                updateAdInjectionControls();
            }
        }
        runButton.addEventListener('click', function() { runAdInjectionExport(false); });
        document.querySelectorAll('input[name="injection-export-content"]').forEach(function(input) {
            input.addEventListener('change', function() {
                if (!this.checked || adInjectionRunning) return;
                appState.adInjectionExportMode = this.value;
                var result = document.getElementById('injection-result');
                if (result) result.hidden = true;
                generateExportSummary();
            });
        });
        var directoryButton = document.getElementById('injection-run-directory');
        if (directoryButton) directoryButton.addEventListener('click', function() { runAdInjectionExport(true); });
        updateAdInjectionControls();
    }

    function differentiatedManifestSite() {
        var packageData = appState.differentiatedPackage || {};
        var manifest = packageData.manifest || {};
        return manifest.site || {};
    }

    function populateDifferentiatedDesigns() {
        var selects = document.querySelectorAll('#diff-design-family,#diff-config-design-family');
        if (!selects.length || typeof DifferentiatedBuilder === 'undefined') return;
        var type = appState.differentiated.siteType || 'editorial';
        var requestedDomain = appState.differentiated.domainId;
        var domainId = requestedDomain && requestedDomain !== 'auto' ? requestedDomain : appState.selectedTheme;
        var families = DifferentiatedBuilder.getDesignFamilies(type, domainId) || [];
        var profile = DifferentiatedBuilder.DOMAIN_PROFILES[domainId] || DifferentiatedBuilder.DOMAIN_PROFILES.general || null;
        var options = '<option value="auto">自动选择当前领域未使用蓝图</option>' + families.map(function(family) {
            return '<option value="' + escapeHtml(family.id) + '">' + escapeHtml(family.name) + '</option>';
        }).join('');
        selects.forEach(function(select) {
            select.innerHTML = options;
            select.value = families.some(function(family) { return family.id === appState.differentiated.designFamily; }) ? appState.differentiated.designFamily : 'auto';
        });
        renderDifferentiatedBlueprints(families, profile);
    }

    function renderDifferentiatedBlueprints(families, profile) {
        var grid = document.getElementById('diff-domain-blueprint-grid');
        if (!grid || typeof DifferentiatedBuilder === 'undefined') return;
        families = families || [];
        var count = document.getElementById('diff-domain-blueprint-count');
        var status = document.getElementById('diff-domain-blueprint-status');
        var type = appState.differentiated.siteType || 'editorial';
        var domainId = (profile && profile.label) ? families[0] && families[0].domainId : (appState.differentiated.domainId !== 'auto' ? appState.differentiated.domainId : appState.selectedTheme);
        profile = profile || DifferentiatedBuilder.DOMAIN_PROFILES[domainId] || DifferentiatedBuilder.DOMAIN_PROFILES.general || null;
        var profileLabel = profile && profile.label ? profile.label : '当前领域';
        if (count) count.textContent = families.length + ' 个蓝图';
        if (status) status.textContent = profile
            ? '已识别领域：' + profile.label + '。以下蓝图只在该领域显示，并会写入本次导出。'
            : '等待领域识别；上传数据并确认领域后将显示该领域的 12 个专属蓝图。';
        var blueprintLabels = { 'lead-grid':'杂志头版', 'rail-index':'专著索引', 'banded-list':'田野笔记', 'catalog-grid':'馆藏目录', 'split-feature':'技术档案', 'mosaic':'视觉日志', 'swiss-index':'瑞士索引', 'broadsheet':'新闻大报', 'timeline-ledger':'时间档案', 'cinematic-strip':'影像长卷', 'soft-showcase':'柔和展厅', 'industrial-board':'工业看板' };
        var directionLabels = { 'editorial-command':'封面叙事', 'quiet-reading':'安静长读', 'field-notes':'田野记录', 'collection-system':'馆藏系统', 'technical-record':'技术文档', 'visual-flow':'图片流', 'swiss-grid':'瑞士网格', 'newsroom':'新闻编辑室', 'chronological-archive':'时间轴档案', 'cinematic-story':'电影化叙事', 'soft-structural':'柔和结构主义', 'industrial-brutalist':'工业粗野主义' };
        var blueprintIcons = { 'lead-grid':'📰', 'rail-index':'📚', 'banded-list':'🗂️', 'catalog-grid':'🗃️', 'split-feature':'🪟', 'mosaic':'🧩', 'swiss-index':'▦', 'broadsheet':'🗞️', 'timeline-ledger':'↳', 'cinematic-strip':'🎞️', 'soft-showcase':'◯', 'industrial-board':'▤' };
        grid.innerHTML = families.map(function(family, index) {
            var selected = appState.differentiated.designFamily === family.id;
            return '<button type="button" class="diff-blueprint-card' + (selected ? ' is-selected' : '') + '" data-diff-blueprint="' + escapeHtml(family.id) + '" role="listitem" aria-pressed="' + (selected ? 'true' : 'false') + '"><span class="diff-blueprint-icon" aria-hidden="true">' + (blueprintIcons[family.layout] || '🧱') + '</span><span><strong>' + escapeHtml(profileLabel + '·' + (blueprintLabels[family.layout] || '专属蓝图')) + '</strong><small>' + escapeHtml((directionLabels[family.direction] || family.direction || '独立版式') + ' · ' + (index + 1) + ' 号结构') + '</small></span></button>';
        }).join('');
        grid.querySelectorAll('[data-diff-blueprint]').forEach(function(button) {
            button.addEventListener('click', function() {
                appState.differentiated.designFamily = this.dataset.diffBlueprint;
                populateDifferentiatedDesigns();
                updatePreview();
            });
        });
    }

    function populateDifferentiatedCustomizer() {
        if (typeof DifferentiatedBuilder === 'undefined') return;
        var state = appState.differentiated;
        var mark = document.getElementById('diff-brand-mark');
        var typography = document.getElementById('diff-typography');
        if (mark) {
            mark.innerHTML = '<option value="auto">自动按本次数据源生成</option>' + DifferentiatedBuilder.BRAND_MARKS.map(function(item) { return '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(item.glyph + ' · ' + item.name) + '</option>'; }).join('');
            mark.value = DifferentiatedBuilder.BRAND_MARKS.some(function(item) { return item.id === state.brandMark; }) ? state.brandMark : 'auto';
        }
        if (typography) {
            typography.innerHTML = '<option value="auto">自动匹配本次数据源</option>' + DifferentiatedBuilder.TYPOGRAPHY_PAIRS.map(function(item) { return '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(item.name) + '</option>'; }).join('');
            typography.value = DifferentiatedBuilder.TYPOGRAPHY_PAIRS.some(function(item) { return item.id === state.typography; }) ? state.typography : 'auto';
        }
        [['diff-site-title', state.siteTitle], ['diff-config-seed', state.seed], ['diff-card-alignment', state.cardAlignment || 'compact'], ['diff-home-intro', state.homeIntro || 'compact'], ['diff-featured-card', state.featuredCard || 'highlight'], ['diff-nav-category-limit', state.navCategoryLimit || 4], ['diff-home-category-limit', state.homeCategoryLimit || 4], ['diff-contact-layout', state.contactLayout || 'split'], ['diff-footer-style', state.footerStyle || 'simple'], ['diff-summary-mode', state.summaryMode || 'standard'], ['diff-tone', state.tone || 'auto'], ['diff-content-density', state.contentDensity || 'comfortable'], ['diff-card-radius', state.cardRadius || 'auto'], ['diff-card-hover', state.cardHover || 'lift'], ['diff-card-columns', state.cardColumns || 'template'], ['diff-category-card-columns', state.categoryCardColumns || 'inherit'], ['diff-card-view-mode', state.cardViewMode || 'auto'], ['diff-card-border', state.cardBorder || 'auto'], ['diff-card-spacing', state.cardSpacing || 'auto'], ['diff-card-excerpt-lines', state.cardExcerptLines || 'auto'], ['diff-card-image-height', state.cardImageHeight || 'auto'], ['diff-cover-fit', state.coverFit || 'smart'], ['diff-card-height', state.cardHeight || 'template'], ['diff-content-max-width', state.contentMaxWidth || 'auto'], ['diff-meta-bg', state.metaBg || 'auto'], ['diff-detail-img-style', state.detailImgStyle || 'auto'], ['diff-category-title-style', state.categoryTitleStyle || 'auto'], ['diff-category-title-align', state.categoryTitleAlign || 'auto'], ['diff-hero-style', state.heroStyle || 'auto'], ['diff-detail-layout', state.detailLayout || 'auto'], ['diff-font-style', state.fontStyle || 'auto'], ['diff-logo-style', state.logoStyle || 'mark-text'], ['diff-nav-layout', state.navLayout || 'split'], ['diff-nav-style', state.navStyle || 'glass'], ['diff-nav-height', state.navHeight || 'regular'], ['diff-grid-gap', state.gridGap || 'regular'], ['diff-button-style', state.buttonStyle || 'solid'], ['diff-button-size', state.buttonSize || 'auto'], ['diff-back-link-style', state.backLinkStyle || 'arrow'], ['diff-animation-enter', state.animationEnter || 'fade'], ['diff-transition-speed', state.transitionSpeed || 'normal']].forEach(function(pair) { var element = document.getElementById(pair[0]); if (element) element.value = pair[1]; });
        renderDifferentiatedPageControls();
        populateDifferentiatedDesigns();
        renderDifferentiatedVisualPickers();
        renderDifferentiatedCategories();
        renderDifferentiatedHomeCategories();
    }

    function renderDifferentiatedPageControls() {
        var state = appState.differentiated;
        [['#diff-contact-fields-config', state.contactFields || []], ['#diff-footer-links-config', state.footerLinks || []]].forEach(function(pair) {
            document.querySelectorAll(pair[0] + ' input[type="checkbox"]').forEach(function(input) {
                input.checked = pair[1].indexOf(input.value) !== -1;
            });
        });
    }

    function saveDifferentiatedCategoryOverride(state, category, patch) {
        var overrides = Array.isArray(state.categoryOverrides) ? state.categoryOverrides.slice() : [];
        var position = overrides.findIndex(function(item) { return item && item.slug === category.slug; });
        var current = position === -1 ? { slug: category.slug, name: category.name, icon: '' } : Object.assign({}, overrides[position]);
        Object.assign(current, patch || {});
        if (position === -1) overrides.push(current); else overrides[position] = current;
        state.categoryOverrides = overrides;
    }

    // 随机组合只会读取 theme.iconPool；这里仅为人工逐个挑选补充全量 Emoji，
    // 并始终把当前领域的图标放在前面，方便快速选择。
    function getCategoryIconPickerChoices(domainPool, activeIcon, categoryName, domainId) {
        var choices = [];
        var addIcon = function(icon) {
            icon = getCompatibleCategoryEmoji(icon);
            if (icon && choices.indexOf(icon) === -1) choices.push(icon);
        };
        if (typeof getRecommendedCategoryEmojiOptions === 'function') {
            getRecommendedCategoryEmojiOptions(domainId, categoryName).forEach(addIcon);
        }
        (domainPool || []).forEach(addIcon);
        (typeof ALL_CATEGORY_EMOJI_ICONS !== 'undefined' ? ALL_CATEGORY_EMOJI_ICONS : []).forEach(addIcon);
        activeIcon = getCompatibleCategoryEmoji(activeIcon);
        if (activeIcon && choices.indexOf(activeIcon) === -1) choices.unshift(activeIcon);
        return choices.length ? choices : ['📌', '🌐', '💡', '📰', '⭐', '🏷️'];
    }

    function getCompatibleCategoryEmoji(icon) {
        return typeof getWindowsSafeEmoji === 'function' ? getWindowsSafeEmoji(icon) : icon;
    }

    function renderDifferentiatedCategories() {
        var target = document.getElementById('diff-auto-category-list');
        if (!target || typeof DifferentiatedBuilder === 'undefined') return;
        var state = appState.differentiated;
        var config = DifferentiatedBuilder.buildConfig({ data: appState.data || [], differentiated: state, differentiatedPackage: appState.differentiatedPackage || {} }, { siteType: state.siteType || 'editorial' });
        var pool = typeof DOMAIN_CATEGORY_EMOJI_POOLS !== 'undefined' ? (DOMAIN_CATEGORY_EMOJI_POOLS[config.domain.id] || []) : [];
        var maximum = Math.max(2, Math.min(6, config.categories.length || 6));
        var requested = Number(state.navCategoryLimit) || 4;
        var limit = Math.max(2, Math.min(maximum, requested));
        var slider = document.getElementById('diff-nav-category-limit');
        var value = document.getElementById('diff-nav-category-limit-value');
        if (slider) { slider.min = '2'; slider.max = String(maximum); slider.value = String(limit); }
        if (value) value.textContent = String(limit);
        var visible = config.categories.slice(0, limit);
        function iconChoices(category, index) {
            var choices = getCategoryIconPickerChoices(pool, category.icon, category.name, config.domain.id);
            var active = getCompatibleCategoryEmoji(category.icon || choices[index % Math.max(1, choices.length)] || '📌');
            return { active: active, choices: choices.length ? choices : ['📌', '✦', '◆', '●', '■', '▲'] };
        }
        target.innerHTML = '<p class="diff-auto-category-title">已识别的导航分类</p>' + (visible.length ? '<p class="diff-auto-category-help">分类来自本次数据源；可在此修改导航显示名称与图标，链接和文章归属保持不变。</p>' + visible.map(function(category, index) {
            var icons = iconChoices(category, index);
            return '<div class="category-config-item diff-category-config-item" role="listitem"><div class="cat-icon-picker"><button type="button" class="cat-icon-trigger" title="当前领域图标优先，也可选择全部 Emoji" aria-label="选择第 ' + (index + 1) + ' 个分类图标（当前领域图标优先，可选择全部 Emoji）" aria-expanded="false">' + escapeHtml(icons.active) + '</button><div class="cat-icon-menu" role="listbox" aria-label="分类图标选项：当前领域优先，包含全部 Emoji">' + icons.choices.map(function(icon) { return '<button type="button" class="cat-icon-option' + (icons.active === icon ? ' selected' : '') + '" role="option" aria-selected="' + (icons.active === icon ? 'true' : 'false') + '" data-diff-category-icon="' + escapeHtml(icon) + '" data-diff-category-slug="' + escapeHtml(category.slug) + '">' + escapeHtml(icon) + '</button>'; }).join('') + '</div></div><input type="text" class="cat-name-input" value="' + escapeHtml(category.name) + '" maxlength="64" aria-label="第 ' + (index + 1) + ' 个分类名称" data-diff-category-name data-diff-category-slug="' + escapeHtml(category.slug) + '"><output class="diff-category-record-count" aria-label="' + category.count + ' 篇文章">' + category.count + ' 篇</output></div>';
        }).join('') : '<p class="diff-auto-category-empty">上传数据后将在此显示自动识别的分类。</p>');
        target.querySelectorAll('[data-diff-category-name]').forEach(function(input) {
            input.addEventListener('input', function() {
                var category = config.categories.find(function(item) { return item.slug === input.dataset.diffCategorySlug; });
                if (!category) return;
                saveDifferentiatedCategoryOverride(state, category, { name: input.value });
                updatePreview();
            });
        });
        target.querySelectorAll('.cat-icon-trigger').forEach(function(trigger) {
            trigger.addEventListener('click', function(event) {
                event.stopPropagation();
                var picker = trigger.closest('.cat-icon-picker');
                var willOpen = !picker.classList.contains('open');
                closeStyledSelects();
                closeCategoryIconPickers(picker);
                setCategoryPickerOpenState(picker, willOpen);
                if (willOpen) moveCategoryPickerMenuToPortal(picker);
                trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
            });
        });
        target.querySelectorAll('[data-diff-category-icon]').forEach(function(button) {
            button.addEventListener('click', function(event) {
                event.stopPropagation();
                var category = config.categories.find(function(item) { return item.slug === button.dataset.diffCategorySlug; });
                if (!category) return;
                var picker = getCategoryPickerForMenu(button.closest('.cat-icon-menu'));
                setCategoryPickerOpenState(picker, false);
                saveDifferentiatedCategoryOverride(state, category, { icon: button.dataset.diffCategoryIcon });
                renderDifferentiatedCategories();
                renderDifferentiatedHomeCategories();
                updatePreview();
            });
        });
        if (!appState._diffCategoryPickerBound) {
            document.addEventListener('click', function() {
                closeCategoryIconPickers();
            });
            appState._diffCategoryPickerBound = true;
        }
    }

    function renderDifferentiatedHomeCategories() {
        var target = document.getElementById('diff-home-category-list');
        var settings = document.getElementById('diff-home-category-settings');
        var toggle = document.getElementById('diff-home-category-layout');
        if (!target || typeof DifferentiatedBuilder === 'undefined') return;
        var state = appState.differentiated;
        if (toggle) toggle.checked = state.homeCategoryLayout === true;
        if (settings) settings.hidden = state.homeCategoryLayout !== true;
        if (state.homeCategoryLayout !== true) { target.innerHTML = ''; return; }
        var config = DifferentiatedBuilder.buildConfig({ data: appState.data || [], differentiated: state, differentiatedPackage: appState.differentiatedPackage || {} }, { siteType: state.siteType || 'editorial' });
        var maximum = Math.max(2, Math.min(6, config.categories.length || 6));
        var limit = Math.max(2, Math.min(maximum, Number(state.homeCategoryLimit) || 4));
        state.homeCategoryLimit = limit;
        var slider = document.getElementById('diff-home-category-limit');
        var value = document.getElementById('diff-home-category-limit-value');
        if (slider) { slider.min = '2'; slider.max = String(maximum); slider.value = String(limit); }
        if (value) value.textContent = String(limit);
        var visible = config.categories.slice(0, limit);
        target.innerHTML = '<p class="diff-auto-category-title">首页分类与卡片数量</p>' + (visible.length ? '<p class="diff-auto-category-help">每个分类只展示设定数量的内容；其余内容仍保留在“查看全部”分类页中。</p>' + visible.map(function(category) {
            var sourceCount = Math.max(1, Number(category.count) || 1);
            var homeCount = Math.max(1, Math.min(sourceCount, Number(category.homeCount) || Math.min(6, sourceCount)));
            return '<div class="diff-home-category-row" role="listitem"><span class="diff-home-category-name">' + escapeHtml((category.icon ? category.icon + ' ' : '') + category.name) + '<small>数据源共 ' + sourceCount + ' 条</small></span><label>首页卡片<input type="number" min="1" max="' + sourceCount + '" value="' + homeCount + '" inputmode="numeric" aria-label="' + escapeHtml(category.name) + ' 在首页显示的卡片数量" data-diff-home-category-count data-diff-category-slug="' + escapeHtml(category.slug) + '"></label></div>';
        }).join('') : '<p class="diff-auto-category-empty">上传并识别数据后，可在此安排首页分类与卡片数量。</p>');
        target.querySelectorAll('[data-diff-home-category-count]').forEach(function(input) {
            input.addEventListener('input', function() {
                var category = config.categories.find(function(item) { return item.slug === input.dataset.diffCategorySlug; });
                if (!category) return;
                var count = Math.max(1, Math.min(Number(category.count) || 1, Number(input.value) || 1));
                input.value = String(count);
                saveDifferentiatedCategoryOverride(state, category, { homeCount: count });
                updatePreview();
            });
        });
    }

    function renderDifferentiatedVisualPickers() {
        var state = appState.differentiated;
        var styleGrid = document.getElementById('diff-style-preset-grid');
        var styleCount = document.getElementById('diff-style-preset-count');
        if (styleGrid && typeof STYLE_PRESETS !== 'undefined') {
            if (styleCount) styleCount.textContent = STYLE_PRESETS.length + ' 套';
            styleGrid.innerHTML = STYLE_PRESETS.map(function(preset) { var selected = state.themePreset === preset.id; return '<button type="button" class="style-card' + (selected ? ' selected' : '') + '" data-diff-style="' + escapeHtml(preset.id) + '" role="option" aria-selected="' + (selected ? 'true' : 'false') + '"><span class="style-preview" style="background:' + escapeHtml(preset.previewBg || '#eef3f8') + '"></span><span class="style-name">' + escapeHtml(preset.name) + '</span></button>'; }).join('');
            styleGrid.querySelectorAll('[data-diff-style]').forEach(function(button) { button.addEventListener('click', function() { var preset = STYLE_PRESETS.find(function(item) { return item.id === button.dataset.diffStyle; }); if (!preset) return; state.themePreset = preset.id; state.themePalette = Object.assign({}, preset.vars || {}); renderDifferentiatedVisualPickers(); updatePreview(); }); });
        }
        var iconGrid = document.getElementById('diff-logo-icon-grid');
        var iconTrigger = document.getElementById('diff-logo-icon-trigger');
        var iconPanel = document.getElementById('diff-logo-icon-panel');
        var iconPreview = document.getElementById('diff-logo-icon-preview');
        var iconName = document.getElementById('diff-logo-icon-name');
        var iconCount = document.getElementById('diff-logo-icon-count');
        if (!iconGrid || !iconTrigger || !iconPanel) return;
        var entries = typeof LOGO_ICON_GROUPS !== 'undefined' ? LOGO_ICON_GROUPS.reduce(function(all, group) { return all.concat(group.icons.map(function(item) { return { icon:item[0], name:item[1] }; })); }, []) : [];
        if (!entries.length) entries = DifferentiatedBuilder.BRAND_MARKS.map(function(item) { return { icon:item.glyph, name:item.name }; });
        if (iconCount) iconCount.textContent = entries.length + ' 款可选';
        var active = state.logoIcon || '';
        if (iconPreview) iconPreview.textContent = active || '✦';
        if (iconName) iconName.textContent = (entries.find(function(item) { return item.icon === active; }) || { name:'自动图标' }).name;
        iconGrid.innerHTML = entries.map(function(item) { var selected = item.icon === active; return '<button type="button" class="logo-icon-option' + (selected ? ' selected' : '') + '" data-diff-logo-icon="' + escapeHtml(item.icon) + '" title="' + escapeHtml(item.name) + '" role="option" aria-selected="' + (selected ? 'true' : 'false') + '">' + escapeHtml(item.icon) + '</button>'; }).join('');
        iconTrigger.onclick = function(event) { event.stopPropagation(); iconPanel.hidden = !iconPanel.hidden; iconTrigger.setAttribute('aria-expanded', iconPanel.hidden ? 'false' : 'true'); };
        iconGrid.querySelectorAll('[data-diff-logo-icon]').forEach(function(button) { button.onclick = function() { state.logoIcon = button.dataset.diffLogoIcon; iconPanel.hidden = true; iconTrigger.setAttribute('aria-expanded', 'false'); renderDifferentiatedVisualPickers(); updatePreview(); }; });
        if (!appState._diffLogoPickerBound) { document.addEventListener('click', function() { if (!iconPanel.hidden) { iconPanel.hidden = true; iconTrigger.setAttribute('aria-expanded', 'false'); } }); appState._diffLogoPickerBound = true; }
    }

    function renderDifferentiatedPackageStatus(message, stateClass) {
        var target = document.getElementById('differentiated-package-result');
        if (!target) return;
        if (message) {
            target.className = 'migration-result ' + (stateClass || 'pending');
            target.textContent = message;
            return;
        }
        var typeNames = { editorial: '资讯站', tools: '工具站' };
        var manifest = differentiatedManifestSite();
        var source = appState.differentiatedImportName;
        target.className = 'migration-result ' + (source ? 'valid' : 'pending');
        target.textContent = source
            ? '已读取 ' + source + ' · ' + (typeNames[appState.differentiated.siteType] || '站点') + ' · ' + appState.data.length + ' 条记录' + (manifest.name ? ' · ' + manifest.name : '')
            : '等待上传本次站点的数据源；普通 JSON 也可作为草稿导入。';
    }

    function applyDifferentiatedImport(imported, fileName) {
        resetWorkflowStepProgress('differentiated');
        appState.differentiatedPackage = imported.packageData || {};
        appState.packageAssets = imported.packageAssets || {};
        appState.differentiatedImportName = fileName || '本次数据源';
        appState.differentiated.siteType = imported.siteType === 'tools' ? 'tools' : 'editorial';
        var manifest = (imported.packageData && imported.packageData.manifest) || {};
        var site = manifest.site || {};
        var design = (imported.packageData && imported.packageData.design) || {};
        appState.differentiated.vertical = String(site.vertical || site.topic || manifest.vertical || '');
        appState.differentiated.audience = String(site.audience || '');
        appState.differentiated.scope = String(site.scope || site.description || '');
        appState.differentiated.baseUrl = String(site.base_url || site.url || '');
        appState.differentiated.contactEmail = String(((imported.packageData && imported.packageData.legal) || {}).contact_email || '');
        appState.differentiated.siteTitle = String(site.name || site.title || manifest.site_name || '');
        appState.differentiated.brandMark = String(design.brand_mark || design.logo_mark || 'auto');
        appState.differentiated.typography = String(design.typography || design.font_pair || 'auto');
        appState.differentiated.designFamily = String(design.family || design.design_family || 'auto');
        appState.differentiated.domainId = String(design.domain_id || design.domain || site.domain_id || site.domain || manifest.domain_id || manifest.domain || 'auto');
        appState.differentiated.seed = String(design.seed || '');
        appState.differentiated.cardAlignment = design.card_alignment === 'aligned' ? 'aligned' : 'compact';
        appState.differentiated.homeIntro = ['compact', 'hidden'].indexOf(design.home_intro || design.hero_style) !== -1 ? (design.home_intro || design.hero_style) : 'compact';
        appState.differentiated.featuredCard = design.featured_card === 'standard' ? 'standard' : 'highlight';
        appState.differentiated.navCategoryLimit = [2, 3, 4, 5, 6].indexOf(Number(design.nav_category_limit || design.category_limit)) !== -1 ? Number(design.nav_category_limit || design.category_limit) : 4;
        appState.differentiated.homeCategoryLayout = design.home_category_layout === true || design.group_home_categories === true || design.home_category_layout === 'true';
        appState.differentiated.homeCategoryLimit = [2, 3, 4, 5, 6].indexOf(Number(design.home_category_limit)) !== -1 ? Number(design.home_category_limit) : 4;
        appState.differentiated.categoryOverrides = Array.isArray(design.category_overrides || design.categories) ? (design.category_overrides || design.categories).map(function(category) { category = category && typeof category === 'object' ? category : {}; return { slug: String(category.slug || ''), name: String(category.name || ''), icon: String(category.icon || ''), homeCount: Number(category.home_count || category.homeCount) || undefined }; }).filter(function(category) { return category.slug; }) : [];
        appState.differentiated.contactLayout = ['direct', 'form', 'split'].indexOf(design.contact_layout || design.contact_template) !== -1 ? (design.contact_layout || design.contact_template) : 'split';
        appState.differentiated.contactFields = Array.isArray(design.contact_fields) ? design.contact_fields.filter(function(field, index, fields) { return ['name', 'email', 'subject', 'message'].indexOf(field) !== -1 && fields.indexOf(field) === index; }) : ['name', 'email', 'subject', 'message'];
        appState.differentiated.footerStyle = ['simple', 'detailed'].indexOf(design.footer_style) !== -1 ? design.footer_style : 'simple';
        appState.differentiated.footerLinks = Array.isArray(design.footer_links) ? design.footer_links.filter(function(link, index, links) { return ['privacy', 'terms', 'contact', 'about'].indexOf(link) !== -1 && links.indexOf(link) === index; }) : ['privacy', 'terms', 'contact', 'about'];
        appState.differentiated.summaryMode = ['standard', 'brief', 'hidden'].indexOf(design.summary_mode || design.card_summary) !== -1 ? (design.summary_mode || design.card_summary) : 'standard';
        appState.differentiated.tone = ['auto', 'paper-olive', 'canvas-forest', 'stone-wine', 'slate-cyan', 'cream-cobalt', 'paper-blue', 'canvas-orange', 'ink-lime'].indexOf(design.tone || design.color_tone) !== -1 ? (design.tone || design.color_tone) : 'auto';
        appState.differentiated.contentDensity = ['compact', 'comfortable', 'spacious'].indexOf(design.content_density || design.density) !== -1 ? (design.content_density || design.density) : 'comfortable';
        appState.differentiated.cardRadius = ['auto', '0', '8px', '18px', '28px'].indexOf(design.card_radius || design.radius) !== -1 ? (design.card_radius || design.radius) : 'auto';
        appState.differentiated.cardHover = ['lift', 'image-zoom', 'none'].indexOf(design.card_hover || design.hover_effect) !== -1 ? (design.card_hover || design.hover_effect) : 'lift';
        appState.differentiated.logoStyle = ['mark-text', 'mark', 'boxed', 'text'].indexOf(design.logo_style) !== -1 ? design.logo_style : 'mark-text';
        appState.differentiated.navLayout = ['split', 'centered', 'left'].indexOf(design.nav_layout || design.navbar_layout) !== -1 ? (design.nav_layout || design.navbar_layout) : 'split';
        appState.differentiated.navStyle = ['glass', 'underline', 'accent', 'minimal'].indexOf(design.nav_style || design.navbar_style) !== -1 ? (design.nav_style || design.navbar_style) : 'glass';
        appState.differentiated.navHeight = ['compact', 'regular', 'roomy'].indexOf(design.nav_height || design.navbar_height) !== -1 ? (design.nav_height || design.navbar_height) : 'regular';
        appState.differentiated.gridGap = ['compact', 'regular', 'relaxed'].indexOf(design.grid_gap) !== -1 ? design.grid_gap : 'regular';
        appState.differentiated.buttonStyle = ['solid', 'outline', 'pill'].indexOf(design.button_style) !== -1 ? design.button_style : 'solid';
        appState.differentiated.backLinkStyle = ['arrow', 'button', 'crumb'].indexOf(design.back_link_style) !== -1 ? design.back_link_style : 'arrow';
        appState.differentiated.animationEnter = ['none', 'fade', 'rise'].indexOf(design.animation_enter) !== -1 ? design.animation_enter : 'fade';
        appState.differentiated.transitionSpeed = ['fast', 'normal', 'slow'].indexOf(design.transition_speed) !== -1 ? design.transition_speed : 'normal';
        if (!appState.differentiated.vertical && typeof DifferentiatedBuilder !== 'undefined' && imported.data && imported.data.length) {
            var inferredConfig = DifferentiatedBuilder.buildConfig({
                data: imported.data,
                differentiated: appState.differentiated,
                differentiatedPackage: appState.differentiatedPackage
            }, { siteType: appState.differentiated.siteType });
            appState.differentiated.vertical = inferredConfig.vertical;
            if (!appState.differentiated.audience) appState.differentiated.audience = inferredConfig.audience;
            if (!appState.differentiated.scope) appState.differentiated.scope = inferredConfig.scope;
        }
        var values = {
            'diff-site-type': appState.differentiated.siteType,
            'diff-vertical': appState.differentiated.vertical,
            'diff-audience': appState.differentiated.audience,
            'diff-scope': appState.differentiated.scope,
            'diff-base-url': appState.differentiated.baseUrl,
            'diff-contact-email': appState.differentiated.contactEmail,
            'diff-seed': appState.differentiated.seed
        };
        Object.keys(values).forEach(function(id) { var element = document.getElementById(id); if (element) element.value = values[id]; });
        populateDifferentiatedDesigns();
        populateDifferentiatedCustomizer();
        renderDifferentiatedPackageStatus();
    }

    function clearDifferentiatedImport() {
        resetWorkflowStepProgress('differentiated');
        appState.differentiatedPackage = null;
        appState.packageAssets = {};
        appState.differentiatedImportName = '';
        appState.adCodeMigration = null;
        appState.directAdPlacementMode = 'fixed';
        if (appState.config) {
            appState.config.adPlacements = {};
            appState.config.adCodePlacements = null;
            appState.config.adPaths = {};
        }
        appState.domainDetection = null;
        appState.domainSelectionSource = null;
        appState.differentiated.vertical = '';
        appState.differentiated.audience = '';
        appState.differentiated.scope = '';
        appState.differentiated.baseUrl = '';
        appState.differentiated.contactEmail = '';
        appState.differentiated.siteTitle = '';
        appState.differentiated.brandMark = 'auto';
        appState.differentiated.logoIcon = '';
        appState.differentiated.themePreset = 'auto';
        appState.differentiated.themePalette = {};
        appState.differentiated.typography = 'auto';
        appState.differentiated.cardAlignment = 'compact';
        appState.differentiated.homeIntro = 'compact';
        appState.differentiated.featuredCard = 'highlight';
        appState.differentiated.navCategoryLimit = 4;
        appState.differentiated.homeCategoryLayout = false;
        appState.differentiated.homeCategoryLimit = 4;
        appState.differentiated.categoryOverrides = [];
        appState.differentiated.contactLayout = 'split';
        appState.differentiated.contactFields = ['name', 'email', 'subject', 'message'];
        appState.differentiated.footerStyle = 'simple';
        appState.differentiated.footerLinks = ['privacy', 'terms', 'contact', 'about'];
        appState.differentiated.summaryMode = 'standard';
        appState.differentiated.tone = 'auto';
        appState.differentiated.contentDensity = 'comfortable';
        appState.differentiated.cardRadius = 'auto';
        appState.differentiated.cardHover = 'lift';
        appState.differentiated.cardColumns = 'template';
        appState.differentiated.cardViewMode = 'auto';
        appState.differentiated.cardBorder = 'auto';
        appState.differentiated.cardSpacing = 'auto';
        appState.differentiated.cardExcerptLines = 'auto';
        appState.differentiated.cardImageHeight = 'auto';
        appState.differentiated.coverFit = 'smart';
        appState.differentiated.cardHeight = 'template';
        appState.differentiated.categoryCardColumns = 'inherit';
        appState.differentiated.contentMaxWidth = 'auto';
        appState.differentiated.metaBg = 'auto';
        appState.differentiated.detailImgStyle = 'auto';
        appState.differentiated.categoryTitleStyle = 'auto';
        appState.differentiated.categoryTitleAlign = 'auto';
        appState.differentiated.heroStyle = 'auto';
        appState.differentiated.detailLayout = 'auto';
        appState.differentiated.fontStyle = 'auto';
        appState.differentiated.logoStyle = 'mark-text';
        appState.differentiated.navLayout = 'split';
        appState.differentiated.navStyle = 'glass';
        appState.differentiated.navHeight = 'regular';
        appState.differentiated.gridGap = 'regular';
        appState.differentiated.buttonStyle = 'solid';
        appState.differentiated.buttonSize = 'auto';
        appState.differentiated.backLinkStyle = 'arrow';
        appState.differentiated.animationEnter = 'fade';
        appState.differentiated.transitionSpeed = 'normal';
        appState.differentiated.designFamily = 'auto';
        appState.differentiated.domainId = 'auto';
        appState.differentiated.seed = '';
    }

    function initDifferentiatedControls() {
        if (typeof DifferentiatedBuilder === 'undefined') return;
        var controls = { 'diff-site-type': 'siteType', 'diff-vertical': 'vertical', 'diff-audience': 'audience', 'diff-scope': 'scope', 'diff-base-url': 'baseUrl', 'diff-contact-email': 'contactEmail', 'diff-contact-layout': 'contactLayout', 'diff-footer-style': 'footerStyle', 'diff-design-family': 'designFamily', 'diff-seed': 'seed', 'diff-site-title': 'siteTitle', 'diff-brand-mark': 'brandMark', 'diff-typography': 'typography', 'diff-config-design-family': 'designFamily', 'diff-config-seed': 'seed', 'diff-card-alignment': 'cardAlignment', 'diff-home-intro': 'homeIntro', 'diff-featured-card': 'featuredCard', 'diff-nav-category-limit': 'navCategoryLimit', 'diff-home-category-limit': 'homeCategoryLimit', 'diff-summary-mode': 'summaryMode', 'diff-tone': 'tone', 'diff-content-density': 'contentDensity', 'diff-card-radius': 'cardRadius', 'diff-card-hover': 'cardHover', 'diff-card-columns': 'cardColumns', 'diff-category-card-columns': 'categoryCardColumns', 'diff-card-view-mode': 'cardViewMode', 'diff-card-border': 'cardBorder', 'diff-card-spacing': 'cardSpacing', 'diff-card-excerpt-lines': 'cardExcerptLines', 'diff-card-image-height': 'cardImageHeight', 'diff-cover-fit': 'coverFit', 'diff-card-height': 'cardHeight', 'diff-content-max-width': 'contentMaxWidth', 'diff-meta-bg': 'metaBg', 'diff-detail-img-style': 'detailImgStyle', 'diff-category-title-style': 'categoryTitleStyle', 'diff-category-title-align': 'categoryTitleAlign', 'diff-hero-style': 'heroStyle', 'diff-detail-layout': 'detailLayout', 'diff-font-style': 'fontStyle', 'diff-logo-style': 'logoStyle', 'diff-nav-layout': 'navLayout', 'diff-nav-style': 'navStyle', 'diff-nav-height': 'navHeight', 'diff-grid-gap': 'gridGap', 'diff-button-style': 'buttonStyle', 'diff-button-size': 'buttonSize', 'diff-back-link-style': 'backLinkStyle', 'diff-animation-enter': 'animationEnter', 'diff-transition-speed': 'transitionSpeed' };
        Object.keys(controls).forEach(function(id) {
            var element = document.getElementById(id);
            if (!element) return;
            element.addEventListener(element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' ? 'input' : 'change', function() {
                appState.differentiated[controls[id]] = this.value.trim ? this.value.trim() : this.value;
                if (controls[id] === 'siteType' || controls[id] === 'designFamily') populateDifferentiatedDesigns();
                if (controls[id] === 'seed') populateDifferentiatedCustomizer();
                if (controls[id] === 'navCategoryLimit') renderDifferentiatedCategories();
                if (controls[id] === 'homeCategoryLimit') { appState.differentiated.homeCategoryLayout = true; renderDifferentiatedHomeCategories(); }
                updatePreview();
            });
        });
        var homeCategoryToggle = document.getElementById('diff-home-category-layout');
        if (homeCategoryToggle) homeCategoryToggle.addEventListener('change', function() {
            appState.differentiated.homeCategoryLayout = this.checked;
            renderDifferentiatedHomeCategories();
            updatePreview();
        });
        [['#diff-contact-fields-config', 'contactFields'], ['#diff-footer-links-config', 'footerLinks']].forEach(function(pair) {
            document.querySelectorAll(pair[0] + ' input[type="checkbox"]').forEach(function(input) {
                input.addEventListener('change', function() {
                    appState.differentiated[pair[1]] = Array.prototype.slice.call(document.querySelectorAll(pair[0] + ' input[type="checkbox"]:checked')).map(function(item) { return item.value; });
                    updatePreview();
                });
            });
        });
        document.querySelectorAll('.diff-config-tab').forEach(function(tab) { tab.addEventListener('click', function() { var name = this.dataset.diffTab; document.body.classList.add('has-config-transition'); document.querySelectorAll('.diff-config-tab').forEach(function(item) { var active = item === tab; item.classList.toggle('active', active); item.setAttribute('aria-selected', active ? 'true' : 'false'); }); document.querySelectorAll('.diff-config-section').forEach(function(section) { var active = section.dataset.diffSection === name; section.hidden = !active; section.classList.toggle('active', active); }); }); });
        populateDifferentiatedDesigns();
        populateDifferentiatedCustomizer();
    }

    function openFilePicker() {
        if (isBatchAdBuild()) {
            var batchInput = document.getElementById('batch-data-input');
            if (batchInput) { batchInput.value = ''; batchInput.click(); }
            return;
        }
        if (!fileInput || fileInput.disabled) return;
        fileInput.value = '';
        fileInput.click();
    }

    function initUploadControls() {
        if (!uploadArea || !fileInput || uploadArea.dataset.uploadReady === 'true') return;
        uploadArea.dataset.uploadReady = 'true';
        initDataDirectoryControls();

        // 原生文件输入框覆盖整个上传区域；这里保留非输入框区域的点击回退。
        uploadArea.addEventListener('click', function(event) {
            if (event.target === fileInput) return;
            openFilePicker();
        });
        uploadArea.addEventListener('dragenter', function(event) {
            event.preventDefault();
            this.classList.add('dragover');
        });
        uploadArea.addEventListener('dragover', function(event) {
            event.preventDefault();
            this.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', function(event) {
            if (!this.contains(event.relatedTarget)) this.classList.remove('dragover');
        });
        uploadArea.addEventListener('drop', function(event) {
            event.preventDefault();
            this.classList.remove('dragover');
            if (event.dataTransfer.files.length > 0) handleFile(event.dataTransfer.files[0]);
        });
        fileInput.addEventListener('change', function() {
            if (this.files.length > 0) handleFile(this.files[0]);
        });
    }

    // Folder selection uses the existing native directory boundary on Windows
    // and Android. Browser fallback carries the same relative paths via Files.
    // Commit generated state only after all required JSON/image reads succeed.
    var directoryImportRunning = false;
    function chooseDirectoryJson(candidates) {
        return new Promise(function(resolve) {
            var select = document.createElement('select');
            select.id = 'data-directory-json-choice';
            select.setAttribute('aria-label', '选择要导入的 JSON 数据源');
            candidates.forEach(function(item) {
                var option = document.createElement('option');
                option.value = item.path;
                option.textContent = item.path + '（' + item.data.length + ' 条）';
                select.appendChild(option);
            });
            showConfirm('文件夹中发现多份有效 JSON，请选择本次要导入的数据源。', '选择 JSON 数据源', '导入所选数据源', function(confirmed) {
                resolve(confirmed ? select.value : null);
            });
            noticeMessage.appendChild(select);
            window.requestAnimationFrame(function() { select.focus(); });
        });
    }

    async function importDataDirectory(entries, batch, trigger) {
        if (directoryImportRunning) return;
        directoryImportRunning = true;
        var controls = ['data-directory-button', 'batch-directory-button', 'data-directory-input', 'batch-directory-input', 'file-input', 'batch-data-input', 'batch-data-button'];
        controls.forEach(function(id) { var control = document.getElementById(id); if (control) control.disabled = true; });
        var sourceName = entries[0] && entries[0].path.split('/')[0] || '数据源文件夹';
        try {
            var result = await readDataDirectory(entries, {
                parseJson: parseUploadedJson, normalizeData: BatchAdBuilder.normalizeData,
                chooseJson: chooseDirectoryJson,
                onProgress: function(progress, message) {
                    if (batch) setBatchDataImportProgress(Math.round(progress * 85), message, 'loading');
                    else setSingleImportProgress(Math.round(progress * 95), message, 'loading');
                }
            });
            if (batch) {
                await importBatchDataFiles([{ name: sourceName, directoryData: result }], { append: true });
            } else {
                processData(result.data, Object.keys(result.localImages).length > 0, result.localImages, false, { fileName: sourceName, entryPath: result.entryPath });
                finishSingleDataImport({ name: sourceName + '（文件夹）' });
            }
        } catch (error) {
            var cancelled = error.name === 'AbortError';
            if (batch) setBatchDataImportProgress(100, error.message, cancelled ? 'cancelled' : 'error');
            else setSingleImportProgress(100, error.message, cancelled ? 'cancelled' : 'error');
            if (!cancelled) showNotice(error.message, '无法读取数据源文件夹');
        } finally {
            directoryImportRunning = false;
            controls.forEach(function(id) { var control = document.getElementById(id); if (control) control.disabled = false; });
            // The trigger is disabled while files are read, so the generic
            // notice closer cannot restore focus until this cleanup completes.
            if (trigger && typeof trigger.focus === 'function') {
                if (noticeOverlay && !noticeOverlay.hidden) noticeLastFocus = trigger;
                else trigger.focus();
            }
        }
    }

    function initDataDirectoryControls() {
        ['data', 'batch'].forEach(function(kind) {
            var button = document.getElementById(kind === 'data' ? 'data-directory-button' : 'batch-directory-button');
            var input = document.getElementById(kind === 'data' ? 'data-directory-input' : 'batch-directory-input');
            if (!button || !input || button.dataset.ready) return;
            button.dataset.ready = 'true';
            button.addEventListener('click', async function() {
                if (directoryImportRunning) return;
                if (typeof window.showDirectoryPicker !== 'function') { input.value = ''; input.click(); return; }
                button.disabled = true;
                try {
                    var handle = await window.showDirectoryPicker({ mode: 'read' });
                    await importDataDirectory(await collectDataDirectory(handle), kind === 'batch', button);
                } catch (error) {
                    if (error.name !== 'AbortError') showNotice(error.message, '无法选择数据源文件夹');
                } finally {
                    button.disabled = false;
                    if (noticeOverlay && !noticeOverlay.hidden) noticeLastFocus = button;
                    else button.focus();
                }
            });
            input.addEventListener('change', function() {
                if (input.files.length) importDataDirectory(directoryFileEntries(input.files), kind === 'batch', button);
            });
        });
    }

    // ========== 批量新建站 + 广告代码 ==========
    function isBatchAdBuild() {
        return appState.siteBuildMode === 'batch-ad-build';
    }

    function batchRequiredFields(theme) {
        return theme && theme.fields ? theme.fields.filter(function(field) { return field.required; }) : [];
    }

    function cloneBatchConfig(value) {
        return JSON.parse(JSON.stringify(value || {}));
    }

    function defaultBatchReserveSettings() {
        return { placementMode: 'manual', adJsVersion: appState.adJsVersion || 'v1.0.2.1', adPlacements: {} };
    }

    // 老会话或热更新可能没有新字段；在一个入口补齐，避免 UI、预览和导出各自猜测默认值。
    function ensureBatchAdBuildState() {
        if (!appState.batchAdBuild) appState.batchAdBuild = { sites: [], codes: [], activeSiteIndex: 0 };
        var batch = appState.batchAdBuild;
        batch.adMode = batch.adMode === 'reserve' ? 'reserve' : 'code';
        if (!batch.reserveDefaults) batch.reserveDefaults = defaultBatchReserveSettings();
        if (!batch.reserveDefaults.adPlacements) batch.reserveDefaults.adPlacements = {};
        batch.reserveDefaults.placementMode = batch.reserveDefaults.placementMode === 'fixed' ? 'fixed' : 'manual';
        batch.reserveDefaults.adJsVersion = batch.reserveDefaults.adJsVersion || 'v1.0.2.1';
        if (!batch.codePlacementDefaults) batch.codePlacementDefaults = { placementMode: 'fixed', adPlacements: null };
        batch.codePlacementDefaults.placementMode = batch.codePlacementDefaults.placementMode === 'manual' ? 'manual' : 'fixed';
        if (batch.codePlacementDefaults.adPlacements !== null && (!batch.codePlacementDefaults.adPlacements || typeof batch.codePlacementDefaults.adPlacements !== 'object' || Array.isArray(batch.codePlacementDefaults.adPlacements))) {
            batch.codePlacementDefaults.adPlacements = null;
        }
        if (!batch.editorialTemplateDefaults) batch.editorialTemplateDefaults = { version: 'current', legacyThemeId: null };
        return batch;
    }

    function getBatchReserveEditingTarget(site) {
        var batch = ensureBatchAdBuildState();
        if (site && site.reserveOverrideEnabled) {
            if (!site.reserveSettings) site.reserveSettings = cloneBatchConfig(batch.reserveDefaults);
            if (!site.reserveSettings.adPlacements) site.reserveSettings.adPlacements = {};
            return site.reserveSettings;
        }
        return batch.reserveDefaults;
    }

    // 上传代码的手动广告位置使用独立状态；默认位置在各站间共享，单站覆盖则只作用于当前站。
    function getBatchCodePlacementEditingTarget(site) {
        var batch = ensureBatchAdBuildState();
        if (site && site.codePlacementOverrideEnabled) {
            if (!site.codePlacementSettings) site.codePlacementSettings = cloneBatchConfig(batch.codePlacementDefaults);
            site.codePlacementSettings.placementMode = site.codePlacementSettings.placementMode === 'manual' ? 'manual' : 'fixed';
            return site.codePlacementSettings;
        }
        return batch.codePlacementDefaults;
    }

    function getActiveBatchSite() {
        var batch = appState.batchAdBuild || { sites: [] };
        var sites = batch.sites || [];
        if (!sites.length) return null;
        var index = Number(batch.activeSiteIndex);
        if (!Number.isInteger(index) || index < 0 || index >= sites.length) index = 0;
        batch.activeSiteIndex = index;
        return sites[index];
    }

    // An intentional shared-setting edit makes inactive previews stale too.
    // Only discard their old certification; the next actual preview records a
    // fresh signature and the generator still checks preview/export equality.
    function invalidateBatchSitePreviews(sites) {
        (sites || []).forEach(function(site) { site.previewSignature = ''; });
    }

    // 批量流程仍复用单站预览与配置面板；切换时必须把当前站的图片、字段与配置完整带入，
    // 否则归档包内的相对图片路径会被当成在线 URL，从而在 iframe 中显示为破图。
    function syncBatchActiveSiteToApp() {
        if (!isBatchAdBuild()) return null;
        var batch = ensureBatchAdBuildState();
        var site = getActiveBatchSite();
        if (!site) return null;
        if (!site.config) site.config = cloneBatchConfig(appState.config);
        // 领域识别是站点级状态：批量数据源可以同时来自医疗、科技、金融等不同领域。
        // 切换当前站点时，预览、字段和模板库都必须恢复这一站自己的领域上下文。
        appState.selectedTheme = site.themeId || null;
        appState.domainDetection = site.domainDetection || null;
        appState.domainSelectionSource = site.domainSelectionSource || null;
        appState.data = site.data;
        appState.jsonFields = site.jsonFields || [];
        appState.fieldMapping = site.fieldMapping || {};
        appState.isLocalImages = !!site.isLocalImages;
        appState.localImages = site.localImages || {};
        appState.config = site.config;
        if (batch.adMode === 'reserve') {
            var reserveTarget = getBatchReserveEditingTarget(site);
            var reserveDomain = BatchAdBuilder.normalizeDomainInput(site.adDomain);
            appState.normalAdMode = 'reserve';
            appState.reservePlacementMode = reserveTarget.placementMode;
            appState.adJsVersion = reserveTarget.adJsVersion;
            // 保持同一个对象引用，手动放置器的增删会直接写回全局方案或当前单站覆盖。
            appState.config.adPlacements = reserveTarget.adPlacements;
            appState.config.adPaths = {};
            appState.config.contactEmail = 'contact@' + reserveDomain.effective;
            appState.adCodeMigration = null;
        } else {
            appState.normalAdMode = 'code';
            var codePlacementTarget = getBatchCodePlacementEditingTarget(site);
            appState.directAdPlacementMode = codePlacementTarget.placementMode;
            // 保持相同对象引用，让预览中的移动立即写回全局位置或当前站点覆盖。
            appState.config.adCodePlacements = codePlacementTarget.adPlacements;
            appState.adCodeMigration = (batch.codes || []).find(function(code) {
                return code.id === site.codeId && code.valid;
            }) || null;
            if (appState.adCodeMigration) {
                appState.config.adPaths = cloneBatchConfig(appState.adCodeMigration.config);
                if (appState.adCodeMigration.detectedHost) appState.config.contactEmail = 'contact@' + String(appState.adCodeMigration.detectedHost).toLowerCase();
            }
        }
        if (appState.currentStep === 4) initStyleGrid();
        return site;
    }

    function getBatchTemplateOwner(templateId, exceptSite) {
        if (!isBatchAdBuild() || !templateId) return null;
        return findTemplateOwner(appState.batchAdBuild.sites.filter(function(site) { return !EditorialTemplateVersions.isLegacy(site.config); }), templateId, exceptSite,
            exceptSite && exceptSite.themeId || appState.selectedTheme);
    }

    function getBatchTemplateIssue(site) {
        if (!site || !THEMES[site.themeId]) return '尚未确认领域';
        if (EditorialTemplateVersions.isLegacy(site.config)) return '';
        if (!site || !site.config || !site.config.templateId) return '尚未分配独立模板';
        var owner = getBatchTemplateOwner(site.config.templateId, site);
        return owner ? '与“' + (owner.fileName || '另一个站点') + '”重复使用模板' : '';
    }

    function batchSiteDisplayName(site) {
        var fileName = String(site && site.fileName || '未命名数据源').trim();
        // 顶部切换器空间有限；展示用户命名的来源名，同时隐藏仅用于导入的归档扩展名。
        return fileName.replace(/\.(?:json|zip|rar|7z)$/i, '') || '未命名数据源';
    }

    function renderBatchPreviewSiteTabs() {
        var target = document.getElementById('batch-preview-site-tabs');
        var switcher = document.getElementById('preview-site-switcher');
        if (!target) return;
        var sites = isBatchAdBuild() && appState.batchAdBuild ? appState.batchAdBuild.sites || [] : [];
        if (sites.length < 2) {
            if (switcher) switcher.hidden = true;
            target.innerHTML = '';
            return;
        }
        var activeSite = getActiveBatchSite();
        if (switcher) switcher.hidden = false;
        target.innerHTML = sites.map(function(site, index) {
            var selected = site === activeSite;
            var displayName = batchSiteDisplayName(site);
            var label = '站点 ' + (index + 1) + '：' + (site.fileName || '未命名数据源');
            return '<button type="button" class="batch-preview-site-tab" role="tab" id="batch-preview-site-tab-' + index + '" aria-selected="' + (selected ? 'true' : 'false') + '" aria-controls="preview-frame" aria-label="' + escapeHtml(label) + '" title="' + escapeHtml(label) + '" tabindex="' + (selected ? '0' : '-1') + '" data-batch-preview-site-index="' + index + '">' + escapeHtml(displayName) + '</button>';
        }).join('');
        target.querySelectorAll('[data-batch-preview-site-index]').forEach(function(button) {
            button.addEventListener('click', function() {
                switchBatchPreviewSite(Number(button.dataset.batchPreviewSiteIndex), true);
            });
        });
        target.onkeydown = function(event) {
            var buttons = Array.from(target.querySelectorAll('[data-batch-preview-site-index]'));
            if (!buttons.length || ['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(event.key) === -1) return;
            event.preventDefault();
            var current = Math.max(0, buttons.indexOf(document.activeElement));
            var next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
            switchBatchPreviewSite(next, true);
        };
    }

    function renderBatchDomainSiteTabs() {
        var target = document.getElementById('batch-domain-site-tabs');
        var switcher = document.getElementById('batch-domain-site-switcher');
        if (!target) return;
        var sites = isBatchAdBuild() && appState.batchAdBuild ? appState.batchAdBuild.sites || [] : [];
        if (sites.length < 2) {
            if (switcher) switcher.hidden = true;
            target.innerHTML = '';
            return;
        }
        var activeSite = getActiveBatchSite();
        if (switcher) switcher.hidden = false;
        target.innerHTML = sites.map(function(site, index) {
            var selected = site === activeSite;
            var profile = DOMAIN_CATALOG[site.themeId];
            var displayName = batchSiteDisplayName(site);
            var label = '站点 ' + (index + 1) + '：' + (site.fileName || '未命名数据源') + (profile ? '，' + profile.label : '，等待确认领域');
            return '<button type="button" class="batch-domain-site-tab" role="tab" id="batch-domain-site-tab-' + index + '" aria-selected="' + (selected ? 'true' : 'false') + '" aria-controls="domain-detection" aria-label="' + escapeHtml(label) + '" title="' + escapeHtml(label) + '" tabindex="' + (selected ? '0' : '-1') + '" data-batch-domain-site-index="' + index + '">' + escapeHtml(displayName) + '</button>';
        }).join('');
        target.querySelectorAll('[data-batch-domain-site-index]').forEach(function(button) {
            button.addEventListener('click', function() {
                switchBatchDomainSite(Number(button.dataset.batchDomainSiteIndex), true);
            });
        });
        target.onkeydown = function(event) {
            var buttons = Array.from(target.querySelectorAll('[data-batch-domain-site-index]'));
            if (!buttons.length || ['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(event.key) === -1) return;
            event.preventDefault();
            var current = Math.max(0, buttons.indexOf(document.activeElement));
            var next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
            switchBatchDomainSite(next, true);
        };
    }

    function switchBatchDomainSite(index, shouldFocus) {
        if (!isBatchAdBuild()) return;
        var sites = appState.batchAdBuild.sites || [];
        if (!Number.isInteger(index) || index < 0 || index >= sites.length) return;
        appState.batchAdBuild.activeSiteIndex = index;
        syncBatchActiveSiteToApp();
        updateThemeCardSelection(appState.selectedTheme);
        renderBatchDomainSiteTabs();
        renderDomainDetection();
        renderBatchDataList();
        if (shouldFocus) {
            var activeButton = document.getElementById('batch-domain-site-tab-' + index);
            if (activeButton) activeButton.focus();
        }
    }

    function switchBatchPreviewSite(index, shouldFocus) {
        if (!isBatchAdBuild()) return;
        var sites = appState.batchAdBuild.sites || [];
        if (!Number.isInteger(index) || index < 0 || index >= sites.length) return;
        appState.batchAdBuild.activeSiteIndex = index;
        appState.adPlacementMode = null;
        syncBatchActiveSiteToApp();
        renderBatchPreviewSiteTabs();
        renderBatchDataList();
        renderBatchAdCodeWorkspace();
        if (appState.currentStep === 4) {
            initTemplateGrid();
            applyConfigToUI();
            syncDirectAdPlacementUI();
            updateAdPlacementUI();
            updatePreview();
        }
        if (shouldFocus) {
            var activeButton = document.getElementById('batch-preview-site-tab-' + index);
            if (activeButton) activeButton.focus();
        }
    }

    function configureBatchSiteTheme(site, themeId, source) {
        var theme = THEMES[themeId];
        if (!site || !theme || typeof BatchAdBuilder === 'undefined') return false;
        site.themeId = themeId;
        site.domainSelectionSource = source || 'manual';
        site.jsonFields = site.jsonFields || BatchAdBuilder.collectFields(site.data);
        site.fieldMapping = BatchAdBuilder.autoMapFields(theme, site.jsonFields);
        site.config = createThemeConfig(themeId);
        // 只有领域相同的站点才需要错开蓝图；不同领域各自从专属模板库开始。
        var template = getBlueprintsForTheme(themeId).find(function(candidate) {
            return !getBatchTemplateOwner(candidate.id, site);
        });
        if (template) applyTemplateToConfig(site.config, template);
        else site.config.templateId = '';
        applyBatchEditorialVersion(site);
        return true;
    }

    function selectBatchSiteTheme(themeId, source) {
        var site = getActiveBatchSite();
        if (!configureBatchSiteTheme(site, themeId, source)) return;
        syncBatchActiveSiteToApp();
        updateThemeCardSelection(themeId);
        renderBatchDomainSiteTabs();
        renderDomainDetection();
        renderBatchDataList();
        if (appState.currentStep === 3) renderBatchFieldMapping();
        if (appState.currentStep === 4) {
            initTemplateGrid();
            applyConfigToUI();
            updatePreview();
        }
    }

    function refreshBatchMappings() {
        if (!isBatchAdBuild() || typeof BatchAdBuilder === 'undefined') return;
        appState.batchAdBuild.sites.forEach(function(site) {
            if (site.themeId) configureBatchSiteTheme(site, site.themeId, site.domainSelectionSource);
        });
        appState.batchAdBuild.activeSiteIndex = 0;
        syncBatchActiveSiteToApp();
        renderBatchDataList();
        renderBatchPreviewSiteTabs();
    }

    function batchSiteIssues(site) {
        var theme = site && THEMES[site.themeId];
        return batchRequiredFields(theme).filter(function(field) {
            return !site.fieldMapping || !site.fieldMapping[field.id];
        });
    }

    function renderBatchDataList() {
        var target = document.getElementById('batch-data-list');
        var status = document.getElementById('batch-data-status');
        if (!target || !status) return;
        var sites = appState.batchAdBuild && appState.batchAdBuild.sites || [];
        if (!sites.length) {
            target.hidden = true;
            status.textContent = '尚未选择数据源';
            status.classList.remove('is-ready');
            return;
        }
        var allThemesReady = sites.every(function(site) { return !!THEMES[site.themeId]; });
        target.hidden = false;
        var activeSite = getActiveBatchSite();
        target.innerHTML = '<div class="batch-ad-list-head"><strong>已读取 ' + sites.length + ' 个站点数据源</strong><span>' + (allThemesReady ? '领域、字段与模板将逐站检查' : '下一步逐站确认领域') + '</span></div>' + sites.map(function(site, index) {
            var themeReady = !!THEMES[site.themeId];
            var profile = DOMAIN_CATALOG[site.themeId];
            var missing = themeReady ? batchSiteIssues(site) : [];
            var templateIssue = themeReady ? getBatchTemplateIssue(site) : '';
            var state = !themeReady ? '待确认领域' : (missing.length ? (profile.label + ' · 缺少：' + missing.map(function(field) { return field.labelZh; }).join('、')) : (profile.label + ' · ' + (templateIssue || '字段与模板已就绪')));
            return '<article class="batch-ad-data-item ' + (!themeReady ? '' : (missing.length || templateIssue ? 'is-invalid' : 'is-valid')) + (site === activeSite ? ' is-active-preview' : '') + '"><span class="batch-ad-item-index">' + (index + 1) + '</span><div><strong>' + escapeHtml(site.fileName) + '</strong><span>' + site.data.length + ' 条 · ' + site.jsonFields.length + ' 个字段' + (site === activeSite ? ' · 当前站点' : '') + '</span></div><em>' + escapeHtml(state) + '</em></article>';
        }).join('');
        status.textContent = '已读取 ' + sites.length + ' 份数据源';
        status.classList.add('is-ready');
    }

    function setBatchDataImportProgress(percent, message, state) {
        var panel = document.getElementById('batch-data-progress');
        var fill = document.getElementById('batch-data-progress-fill');
        var text = document.getElementById('batch-data-progress-text');
        var status = document.getElementById('batch-data-status');
        var card = document.querySelector('.batch-ad-file-card');
        var button = document.getElementById('batch-data-button');
        var input = document.getElementById('batch-data-input');
        var isLoading = state === 'loading';
        if (panel) {
            panel.hidden = false;
            panel.dataset.state = state || 'loading';
        }
        if (fill) fill.style.width = Math.max(0, Math.min(100, Number(percent) || 0)) + '%';
        if (text) text.textContent = message;
        if (status && isLoading) {
            status.textContent = message;
            status.classList.remove('is-ready');
        }
        if (card) card.classList.toggle('is-importing', isLoading);
        if (button) button.disabled = isLoading;
        if (input) input.disabled = isLoading;
        ['batch-directory-button', 'batch-directory-input'].forEach(function(id) {
            var control = document.getElementById(id);
            if (control) control.disabled = isLoading || directoryImportRunning;
        });
    }

    async function importBatchDataFiles(files, options) {
        if (typeof BatchAdBuilder === 'undefined') {
            showNotice('批量建站组件未加载。请刷新页面后重试。', '无法读取数据源');
            return;
        }
        var list = Array.from(files || []);
        var append = options && options.append === true;
        var previous = ensureBatchAdBuildState();
        var previousSites = append ? previous.sites.slice() : [];
        if (list.length < (append ? 1 : 2)) {
            showNotice('批量建站至少需要选择两份 JSON、ZIP、RAR 或 7Z 数据源。', '数据源数量不足');
            return;
        }
        setBatchDataImportProgress(0, '准备读取 ' + list.length + ' 份数据源…', 'loading');
        try {
            var fileProgresses = list.map(function() { return 0; });
            var lastProgressPaint = 0;
            var lastProgressPercent = -1;
            // Two parsers overlap I/O while bounding transient decompression memory.
            // Ordered results preserve site/TXT associations regardless of finish order.
            var loaded = await mapWithConcurrency(list, 2, async function(file, index) {
                await yieldToBrowser();
                return readBatchDataSource(file, index, function(fileProgress, phase) {
                    fileProgresses[index] = Math.max(fileProgresses[index], Math.max(0, Math.min(1, Number(fileProgress) || 0)));
                    var percent = Math.floor(fileProgresses.reduce(function(sum, value) { return sum + value; }, 0) / list.length * 88);
                    var now = Date.now();
                    if (percent === lastProgressPercent && now - lastProgressPaint < 80) return;
                    lastProgressPaint = now;
                    lastProgressPercent = percent;
                    setBatchDataImportProgress(percent, '正在读取第 ' + (index + 1) + '/' + list.length + ' 份：' + file.name + ' · ' + phase, 'loading');
                });
            });
            appState.batchAdBuild = {
                sites: previousSites.concat(loaded),
                codes: append ? previous.codes : [],
                activeSiteIndex: previousSites.length,
                adMode: append ? previous.adMode : 'code',
                reserveDefaults: append ? previous.reserveDefaults : defaultBatchReserveSettings()
            };
            resetWorkflowStepProgress('batch-ad-build');
            appState.adCodeMigration = null;
            // 每个数据源独立分析，严禁把第一份数据的医疗/科技等结果套用给同批其他站点。
            for (var detectedIndex = 0; detectedIndex < loaded.length; detectedIndex++) {
                var site = loaded[detectedIndex];
                site.domainDetection = DomainEngine.detect(site.data, DOMAIN_CATALOG, { fileName: site.fileName });
                if (site.domainDetection.suggestedId) configureBatchSiteTheme(site, site.domainDetection.suggestedId, 'auto');
                setBatchDataImportProgress(88 + Math.floor((detectedIndex + 1) / loaded.length * 10), '正在分析领域 ' + (detectedIndex + 1) + '/' + loaded.length, 'loading');
                // Domain detection stays per-site; release the main thread between
                // sites so a 50-site import does not become one long blocking task.
                await yieldToBrowser();
            }
            syncBatchActiveSiteToApp();
            updateThemeCardSelection(appState.selectedTheme);
            renderBatchDomainSiteTabs();
            renderDomainDetection();
            renderBatchDataList();
            renderBatchPreviewSiteTabs();
            setBatchDataImportProgress(100, '已完成解析 ' + loaded.length + ' 份数据源，当前共 ' + appState.batchAdBuild.sites.length + ' 站，可继续逐站确认领域。', 'success');
        } catch (error) {
            setBatchDataImportProgress(100, '解析失败：' + (error && error.message ? error.message : '请检查数据源后重试。'), 'error');
            showNotice(error.message, '无法读取批量数据源');
        }
    }

    // Archive parser calls are bounded so an unresponsive worker cannot leave the batch UI busy forever.
    function waitForBatchArchiveOperation(operation, timeoutMessage, worker, timeoutMs) {
        if (typeof setTimeout !== 'function' || typeof clearTimeout !== 'function') return Promise.resolve(operation);
        var timeoutDuration = Number(timeoutMs);
        if (!Number.isFinite(timeoutDuration) || timeoutDuration < 1) timeoutDuration = 90000;
        function terminateWorker() {
            if (!worker || typeof worker.terminate !== 'function') return;
            try { worker.terminate(); } catch (_) {}
        }
        var timer = 0;
        var timeout = new Promise(function(_, reject) {
            timer = setTimeout(function() {
                terminateWorker();
                reject(new Error(timeoutMessage));
            }, timeoutDuration);
        });
        var workerError = null;
        var onWorkerError = null;
        if (worker && typeof worker.addEventListener === 'function') {
            workerError = new Promise(function(_, reject) {
                onWorkerError = function(event) {
                    if (event && typeof event.preventDefault === 'function') event.preventDefault();
                    var detail = event && (event.message || event.type);
                    terminateWorker();
                    reject(new Error('压缩包解析 Worker 出错' + (detail ? '：' + detail : '。')));
                };
                worker.addEventListener('error', onWorkerError, { once: true });
                worker.addEventListener('messageerror', onWorkerError, { once: true });
            });
        }
        var operations = [Promise.resolve(operation), timeout];
        if (workerError) operations.push(workerError);
        return Promise.race(operations).finally(function() {
            if (timer) clearTimeout(timer);
            if (onWorkerError && worker && typeof worker.removeEventListener === 'function') {
                worker.removeEventListener('error', onWorkerError);
                worker.removeEventListener('messageerror', onWorkerError);
            }
        });
    }

    // Never let archive cleanup keep the batch import controls disabled indefinitely.
    async function closeBatchArchiveSafely(archive, fileName) {
        if (!archive || typeof archive.close !== 'function') return;
        try {
            await waitForBatchArchiveOperation(
                archive.close(),
                String(fileName || '压缩包') + ' 关闭解析 Worker 超时。',
                archive.worker,
                5000
            );
        } catch (_) {
            if (archive.worker && typeof archive.worker.terminate === 'function') {
                try { archive.worker.terminate(); } catch (_) {}
            }
        }
    }

    async function readBatchDataSource(file, index, onProgress) {
        function report(progress, phase) {
            if (typeof onProgress === 'function') onProgress(progress, phase);
        }
        var ext = String(file && file.name || '').split('.').pop().toLowerCase();
        var data;
        var localImages = {};
        if (file.directoryData) {
            data = file.directoryData.data;
            localImages = file.directoryData.localImages;
            report(0.82, '正在分析文件夹数据');
        } else if (ext === 'json') {
            report(0.08, '正在读取 JSON 文件');
            data = BatchAdBuilder.normalizeData(parseUploadedJson(await file.text()));
            report(0.82, '正在分析 JSON 数据');
        } else if (ext === 'zip') {
            if (!window.JSZip) throw new Error('ZIP 解析组件未加载，请刷新页面后重试。');
            report(0.08, '正在打开 ZIP 压缩包');
            var zip = await window.JSZip.loadAsync(await file.arrayBuffer());
            var selectedJson = await BatchAdBuilder.selectDataJson(Object.keys(zip.files).filter(function(path) { return !zip.files[path].dir; }).map(function(path) { return { path: path }; }), function(entry) { return zip.files[entry.path].async('text'); });
            var jsonPath = selectedJson.path;
            if (!jsonPath) throw new Error(file.name + ' 中没有找到 JSON 数据文件。');
            report(0.42, '正在读取压缩包内 JSON');
            data = BatchAdBuilder.normalizeData(parseUploadedJson(await zip.files[jsonPath].async('text')));
            var imagePaths = Object.keys(zip.files).filter(function(path) { return !zip.files[path].dir && /\.(?:jpg|jpeg|png|gif|webp|svg)$/i.test(path); });
            for (var imageIndex = 0; imageIndex < imagePaths.length; imageIndex++) {
                var imagePath = imagePaths[imageIndex];
                report(0.55 + (imageIndex / Math.max(1, imagePaths.length)) * 0.38, '正在读取图片 ' + (imageIndex + 1) + '/' + imagePaths.length);
                localImages[imagePath] = await zip.files[imagePath].async('blob');
            }
        } else if (ext === 'rar') {
            if (typeof AdRestoration === 'undefined' || typeof AdRestoration.readRarArchiveEntries !== 'function') {
                throw new Error('RAR 回退解析组件未加载，请刷新页面后重试。');
            }
            report(0.08, '正在加载 RAR 解析组件');
            var latestRarProgress = 0.08;
            var rarEntries = await AdRestoration.readRarArchiveEntries(file, function(stage) {
                latestRarProgress = batchRarStageProgress(stage, latestRarProgress);
                report(latestRarProgress, stage);
            });
            var rarData = await readBatchRarEntries(file, rarEntries, {
                normalizeData: BatchAdBuilder.normalizeData,
                parseUploadedJson: parseUploadedJson,
                onProgress: report
            });
            data = rarData.data;
            localImages = rarData.localImages;
        } else if (ext === '7z') {
            report(0.08, '正在加载 7Z 解析组件');
            var Archive = await waitForBatchArchiveOperation(ensureArchiveRuntime(), file.name + ' 加载解析组件超过 90 秒，请刷新页面后重试。');
            report(0.22, '正在打开 7Z 压缩包');
            var archive = null;
            var entries;
            try {
                var openOperation = typeof window.openArchiveWithTimeout === 'function'
                    ? window.openArchiveWithTimeout(Archive, file, 90000, file.name + ' 打开 7Z 压缩包超时。')
                    : Archive.open(file);
                archive = await waitForBatchArchiveOperation(openOperation, file.name + ' 打开 7Z 压缩包超过 90 秒。');
                report(0.42, '正在解压文件目录');
                await waitForBatchArchiveOperation(archive.extractFiles(), file.name + ' 解压 7Z 文件目录超过 90 秒。', archive.worker);
                entries = await waitForBatchArchiveOperation(archive.getFilesArray(), file.name + ' 读取 7Z 文件目录超过 90 秒。', archive.worker);
            } catch (error) {
                throw new Error(file.name + ' 读取失败：' + formatUiError(error, '7Z 压缩包无法解析。'));
            } finally {
                if (archive) await closeBatchArchiveSafely(archive, file.name);
            }
            var jsonEntry = entries.find(function(entry) { return entry.file && /\.json$/i.test(String(entry.path || '') + String(entry.file.name || '')); });
            if (!jsonEntry) throw new Error(file.name + ' 中没有找到 JSON 数据文件。');
            report(0.72, '正在读取压缩包内 JSON');
            data = BatchAdBuilder.normalizeData(parseUploadedJson(await jsonEntry.file.text()));
            entries.filter(function(entry) { return entry.file && /\.(?:jpg|jpeg|png|gif|webp|svg)$/i.test(String(entry.path || '') + String(entry.file.name || '')); }).forEach(function(entry) {
                localImages[(String(entry.path || '') + String(entry.file.name || '')).replace(/\\/g, '/')] = entry.file;
            });
        } else {
            throw new Error(file.name + ' 不支持；批量建站只接受 .json 或包含 JSON+图片的 .zip、.rar、.7z。');
        }
        if (!data.length) throw new Error(file.name + ' 不是包含对象列表的有效数据源。');
        var prepared = BatchAdBuilder.prepareSource(data, localImages);
        data = prepared.data;
        localImages = prepared.localImages;
        report(1, '数据解析完成');
        return {
            id: 'batch-site-' + index + '-' + Date.now(), fileName: file.name, data: data,
            jsonFields: BatchAdBuilder.collectFields(data), fieldMapping: {}, codeId: '',
            isLocalImages: Object.keys(localImages).length > 0, localImages: localImages,
            themeId: '', domainDetection: null, domainSelectionSource: null, config: null,
            adDomain: '', reserveOverrideEnabled: false, reserveSettings: null,
            codePlacementOverrideEnabled: false, codePlacementSettings: null
        };
    }

    function renderBatchAdCodeWorkspace() {
        var target = document.getElementById('batch-ad-code-list');
        var summary = document.getElementById('batch-ad-code-summary');
        if (!target || !summary || !isBatchAdBuild()) return;
        var batch = ensureBatchAdBuildState();
        var reservePanel = document.getElementById('batch-ad-reserve-panel');
        var codePanel = document.getElementById('batch-ad-code-panel');
        var reserveList = document.getElementById('batch-reserve-site-list');
        var activeSite = getActiveBatchSite();
        if (!batch.sites.length) {
            target.innerHTML = '<p class="batch-ad-empty">请先完成第一步的数据源导入。</p>';
            summary.textContent = '等待数据源';
            return;
        }
        var report = typeof BatchAdBuilder !== 'undefined' ? BatchAdBuilder.validateAssignments(batch.sites, batch.codes, batch) : { valid: false, errors: [] };
        document.querySelectorAll('input[name="batch-ad-mode"]').forEach(function(input) {
            input.checked = input.value === batch.adMode;
        });
        if (codePanel) codePanel.hidden = batch.adMode !== 'code';
        if (reservePanel) reservePanel.hidden = batch.adMode !== 'reserve';

        if (batch.adMode === 'reserve') {
            var placeholderCount = report.assignments.filter(function(item) { return item.domain && item.domain.placeholder; }).length;
            summary.textContent = report.valid
                ? (batch.sites.length + ' 站可预留' + (placeholderCount ? ' · ' + placeholderCount + ' 站使用占位域名' : ''))
                : (report.errors.length + ' 项需要处理');
            summary.className = report.valid ? 'is-valid' : '';
            target.innerHTML = '';
            var scopeTitle = document.getElementById('batch-reserve-scope-title');
            var scopeNote = document.getElementById('batch-reserve-scope-note');
            var overrideToggle = document.getElementById('batch-reserve-site-override');
            if (scopeTitle) scopeTitle.textContent = activeSite && activeSite.reserveOverrideEnabled ? '正在编辑当前站点的单独方案' : '正在编辑全局广告位方案';
            if (scopeNote) scopeNote.textContent = activeSite
                ? (activeSite.reserveOverrideEnabled ? '仅影响“' + batchSiteDisplayName(activeSite) + '”。' : '未开启覆盖的站点统一使用这套位置与 ad.js 版本。')
                : '选择站点后可设置是否单独覆盖。';
            if (overrideToggle) {
                overrideToggle.checked = !!(activeSite && activeSite.reserveOverrideEnabled);
                overrideToggle.disabled = !activeSite;
            }
            var codeScope = document.getElementById('batch-code-placement-scope');
            if (codeScope) codeScope.hidden = true;
            if (reserveList) {
                reserveList.innerHTML = batch.sites.map(function(site, index) {
                    var domain = BatchAdBuilder.normalizeDomainInput(site.adDomain);
                    var selected = site === activeSite;
                    var state = domain.valid ? ('将导出到 ' + domain.normalized) : domain.warning;
                    return '<article class="batch-ad-code-item batch-reserve-site ' + (domain.valid ? 'is-ready' : '') + (selected ? ' is-active-preview' : '') + '">' +
                        '<button type="button" class="batch-ad-item-index" data-batch-reserve-site-index="' + index + '" aria-label="配置站点 ' + (index + 1) + '" title="切换到此站配置">' + (index + 1) + '</button>' +
                        '<div><strong>' + escapeHtml(site.fileName) + '</strong><span>' + escapeHtml(state) + (site.reserveOverrideEnabled ? ' · 单站覆盖' : ' · 使用全局方案') + '</span></div>' +
                        '<label><span>站点域名</span><input type="text" inputmode="url" autocomplete="off" placeholder="例如 news.example.com" value="' + escapeHtml(site.adDomain || '') + '" data-batch-domain-site="' + escapeHtml(site.id) + '"></label></article>';
                }).join('') +
                    (report.errors.length ? '<div class="batch-ad-validation invalid"><strong>尚不能导出</strong><ul>' + report.errors.map(function(error) { return '<li>' + escapeHtml(error.message) + '</li>'; }).join('') + '</ul></div>' :
                        '<div class="batch-ad-validation"><strong>预留广告位配置可导出</strong><span>' + (report.warnings.length ? '存在占位域名提示，但不会阻止导出。' : '所有有效域名均唯一。') + '</span></div>');
                reserveList.querySelectorAll('[data-batch-domain-site]').forEach(function(input) {
                    input.addEventListener('input', function() {
                        var site = batch.sites.find(function(candidate) { return candidate.id === input.dataset.batchDomainSite; });
                        if (site) site.adDomain = input.value;
                    });
                    input.addEventListener('change', function() {
                        var site = batch.sites.find(function(candidate) { return candidate.id === input.dataset.batchDomainSite; });
                        if (site) {
                            site.adDomain = input.value.trim().toLowerCase();
                            invalidateBatchSitePreviews([site]);
                        }
                        if (site === getActiveBatchSite()) {
                            syncBatchActiveSiteToApp();
                            var contactEmailInput = document.getElementById('contact-email');
                            if (contactEmailInput) contactEmailInput.value = appState.config.contactEmail;
                            updatePreview();
                        }
                        renderBatchAdCodeWorkspace();
                    });
                });
                reserveList.querySelectorAll('[data-batch-reserve-site-index]').forEach(function(button) {
                    button.addEventListener('click', function() {
                        switchBatchPreviewSite(Number(button.dataset.batchReserveSiteIndex), false);
                        renderBatchAdCodeWorkspace();
                    });
                });
            }
            return;
        }

        var validCodes = batch.codes.filter(function(code) { return code.valid; }).length;
        summary.textContent = batch.codes.length ? (validCodes + '/' + batch.codes.length + ' 份代码可用') : '尚未上传';
        summary.className = report.valid ? 'is-valid' : '';
        var codeScope = document.getElementById('batch-code-placement-scope');
        var codeScopeTitle = document.getElementById('batch-code-placement-scope-title');
        var codeScopeNote = document.getElementById('batch-code-placement-scope-note');
        var codeOverrideToggle = document.getElementById('batch-code-placement-override');
        if (codeScope) codeScope.hidden = false;
        if (codeScopeTitle) codeScopeTitle.textContent = activeSite && activeSite.codePlacementOverrideEnabled ? '正在编辑当前站点的单独广告位置' : '正在编辑全局广告位置';
        if (codeScopeNote) codeScopeNote.textContent = activeSite
            ? (activeSite.codePlacementOverrideEnabled ? '仅影响“' + batchSiteDisplayName(activeSite) + '”；未修改广告代码与广告单元 ID。' : '未开启覆盖的站点共用这套位置；每个站仍使用各自分配的广告代码。')
            : '选择站点后可设置是否单独覆盖。';
        if (codeOverrideToggle) {
            codeOverrideToggle.checked = !!(activeSite && activeSite.codePlacementOverrideEnabled);
            codeOverrideToggle.disabled = !activeSite;
        }
        var options = '<option value="">-- 请选择独占代码 --</option>' + batch.codes.map(function(code) {
            var label = (code.valid ? '✓ ' : '✕ ') + code.fileName + (code.detectedHost ? ' · ' + code.detectedHost : '');
            return '<option value="' + escapeHtml(code.id) + '" title="' + escapeHtml(label) + '">' + escapeHtml(label) + '</option>';
        }).join('');
        target.innerHTML = batch.sites.map(function(site, index) {
            var assigned = batch.codes.find(function(code) { return code.id === site.codeId; });
            var problem = !THEMES[site.themeId] ? '领域待确认' : (batchSiteIssues(site).length ? '字段未完成' : (assigned && assigned.valid ? '等待导出复检' : '需要有效广告代码'));
            var selectedOptions = options.replace('value="' + escapeHtml(site.codeId) + '"', 'value="' + escapeHtml(site.codeId) + '" selected');
            return '<article class="batch-ad-code-item ' + (assigned && assigned.valid ? 'is-ready' : 'is-invalid') + '"><span class="batch-ad-item-index">' + (index + 1) + '</span><div><strong>' + escapeHtml(site.fileName) + '</strong><span>' + escapeHtml(problem) + '</span></div><label><span>广告 TXT</span><select class="batch-ad-code-select" data-batch-ad-site="' + escapeHtml(site.id) + '">' + selectedOptions + '</select></label></article>';
        }).join('') + (report.errors.length ? '<div class="batch-ad-validation invalid"><strong>尚不能导出</strong><ul>' + report.errors.map(function(error) { return '<li>' + escapeHtml(error.message) + '</li>'; }).join('') + '</ul></div>' : '<div class="batch-ad-validation"><strong>一对一分配校验通过</strong><span>导出时还会检查每个生成站的首页、详情页与广告运行时。</span></div>');
        target.querySelectorAll('[data-batch-ad-site]').forEach(function(select) {
            select.addEventListener('change', function() {
                var site = batch.sites.find(function(candidate) { return candidate.id === select.dataset.batchAdSite; });
                if (site) site.codeId = select.value;
                if (site === getActiveBatchSite()) {
                    syncBatchActiveSiteToApp();
                    syncDirectAdPlacementUI();
                    updateAdPlacementUI();
                    updatePreview();
                }
                renderBatchAdCodeWorkspace();
            });
        });
    }

    async function importBatchAdCodes(files) {
        var list = Array.from(files || []);
        if (!list.length) return;
        try {
            var codes = await Promise.all(list.map(async function(file, index) {
                var result = AdMigration.inspectAdCodeText(await file.text(), file.name);
                return Object.assign({ id: 'batch-code-' + index + '-' + Date.now(), fileName: file.name }, result);
            }));
            var sites = appState.batchAdBuild.sites || [];
            appState.batchAdBuild.codes = codes;
            sites.forEach(function(site, index) { site.codeId = codes[index] ? codes[index].id : ''; });
            syncBatchActiveSiteToApp();
            renderBatchAdCodeWorkspace();
            syncDirectAdPlacementUI();
            updateAdPlacementUI();
            updatePreview();
        } catch (error) {
            showNotice(error.message, '无法读取广告代码');
        }
    }

    function initBatchAdControls() {
        var dataButton = document.getElementById('batch-data-button');
        var dataInput = document.getElementById('batch-data-input');
        var codeButton = document.getElementById('batch-ad-code-button');
        var codeInput = document.getElementById('batch-ad-code-input');
        if (dataButton && dataInput && !dataButton.dataset.ready) {
            dataButton.dataset.ready = 'true';
            dataButton.addEventListener('click', function() { dataInput.value = ''; dataInput.click(); });
            dataInput.addEventListener('change', function() { importBatchDataFiles(dataInput.files); });
        }
        if (codeButton && codeInput && !codeButton.dataset.ready) {
            codeButton.dataset.ready = 'true';
            codeButton.addEventListener('click', function() { codeInput.value = ''; codeInput.click(); });
            codeInput.addEventListener('change', function() { importBatchAdCodes(codeInput.files); });
        }
        document.querySelectorAll('input[name="batch-ad-mode"]').forEach(function(input) {
            if (input.dataset.ready) return;
            input.dataset.ready = 'true';
            input.addEventListener('change', function() {
                if (!input.checked) return;
                var batch = ensureBatchAdBuildState();
                batch.adMode = input.value === 'reserve' ? 'reserve' : 'code';
                invalidateBatchSitePreviews(batch.sites);
                appState.adPlacementMode = null;
                syncBatchActiveSiteToApp();
                renderBatchAdCodeWorkspace();
                syncDirectAdPlacementUI();
                updateAdPlacementUI();
                updatePreview();
            });
        });
        var overrideToggle = document.getElementById('batch-reserve-site-override');
        if (overrideToggle && !overrideToggle.dataset.ready) {
            overrideToggle.dataset.ready = 'true';
            overrideToggle.addEventListener('change', function() {
                var site = getActiveBatchSite();
                if (!site) return;
                var batch = ensureBatchAdBuildState();
                site.reserveOverrideEnabled = overrideToggle.checked;
                // 开启时复制当前全局方案，确保用户从眼前所见的状态继续微调。
                if (site.reserveOverrideEnabled) site.reserveSettings = cloneBatchConfig(batch.reserveDefaults);
                appState.adPlacementMode = null;
                syncBatchActiveSiteToApp();
                renderBatchAdCodeWorkspace();
                syncDirectAdPlacementUI();
                updateAdPlacementUI();
                updatePreview();
            });
        }
        var codeOverrideToggle = document.getElementById('batch-code-placement-override');
        if (codeOverrideToggle && !codeOverrideToggle.dataset.ready) {
            codeOverrideToggle.dataset.ready = 'true';
            codeOverrideToggle.addEventListener('change', function() {
                var site = getActiveBatchSite();
                if (!site) return;
                var batch = ensureBatchAdBuildState();
                site.codePlacementOverrideEnabled = codeOverrideToggle.checked;
                if (site.codePlacementOverrideEnabled) site.codePlacementSettings = cloneBatchConfig(batch.codePlacementDefaults);
                appState.adPlacementMode = null;
                syncBatchActiveSiteToApp();
                renderBatchAdCodeWorkspace();
                syncDirectAdPlacementUI();
                updateAdPlacementUI();
                updatePreview();
            });
        }
    }

    // 第一屏的关键交互优先绑定，后续配置区即使出现异常也不会拖垮上传和建站方式切换。
    initBuildModeControls();
    initUploadControls();
    initDifferentiatedControls();
    initBatchAdControls();

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatUiError(error, fallback) {
        if (typeof error === 'string' && error.trim()) return error.trim();
        if (error && typeof error.message === 'string' && error.message.trim()) return error.message.trim();
        if (error && typeof error.reason === 'string' && error.reason.trim()) return error.reason.trim() + (error.file ? '（' + error.file + '）' : '');
        if (error && typeof error.name === 'string' && error.name && error.name !== 'Error') return error.name;
        return fallback || '操作失败，请重试。';
    }

    // ========== 步骤导航 ==========
    function goToStep(step) {
        if (window.OfflineStatus) window.OfflineStatus.trackState(appState);
        var steps = currentWorkflowSteps();
        var targetIndex = window.WorkflowStepNavigation.getStepIndex(steps, step);
        if (targetIndex === -1) return;

        var previousStep = appState.currentStep;
        var highestReachedStep = getWorkflowHighestReachedStep(currentWorkflowProgressKey(), steps);
        var isUnlocked = window.WorkflowStepNavigation.canNavigateToStep(steps, highestReachedStep, step);
        var isNext = window.WorkflowStepNavigation.isNextStep(steps, appState.currentStep, step);
        if (!isUnlocked && !isNext) return;

        // A direct jump to a visited later step must not bypass validations for
        // earlier steps whose data may have changed since the user went back.
        var stepsToValidate = window.WorkflowStepNavigation.getStepsToValidate(steps, appState.currentStep, step);
        for (var index = 0; index < stepsToValidate.length; index++) {
            var validationStep = stepsToValidate[index];
            if (validateStep(validationStep)) continue;
            if (validationStep !== appState.currentStep) renderWorkflowStep(validationStep, previousStep);
            return;
        }

        recordWorkflowStepReached(step);
        renderWorkflowStep(step, previousStep);
    }

    function renderWorkflowStep(step, previousStep) {
        appState.currentStep = step;

        // 更新面板显示
        stepPanels.forEach(function(panel) {
            panel.classList.remove('active');
        });
        var activePanel = document.getElementById('step-' + step);
        if (!activePanel) return;
        if (step !== previousStep) {
            document.body.classList.add('has-workflow-transition');
            activePanel.dataset.transitionDirection = step > previousStep ? 'forward' : 'back';
        }
        activePanel.classList.add('active');

        // 更新按钮
        var injectionStep = isAdInjectionWorkflow();
        syncWorkflowNavigation();

        // 步骤5：生成导出摘要
        if (step === 5) {
            generateExportSummary();
        }

        // 步骤4：更新预览
        if (step === 4) {
            if (isAdPolicyWorkflow()) initPreviewControls();
            if (injectionStep) {
                initPreviewControls();
                renderAdInjectionConfig();
            }
            updatePreview();
        }
    }

    function validateStep(step) {
        switch(step) {
            case 1:
                if (isAdPolicyWorkflow()) {
                    if (isTemplateReuseWorkflow() && appState.templateReuse.loading) { showNotice('内容仍在读取中，请稍候。', '请等待读取完成'); return false; }
                    if (adRestorationReadError) { showNotice(adRestorationReadError, '站点读取未完成'); return false; }
                    if (adRestorationRunning) { showNotice('站点仍在读取和识别中，请稍候。', '请等待读取完成'); return false; }
                    if (isTemplateReuseWorkflow() && validateTemplateReuse()) { showNotice(appState.templateReuse.error, '模板复用尚未通过校验'); return false; }
                    if (adRestorationRunning || !(appState.adPolicySites || []).some(function(site) { return site.metadata && site.metadata.valid && site.metadata.adJsVersion; })) {
                        showNotice('请上传可识别广告配置和 ad.js 版本的站点，并等待读取完成。', '还不能进入配置网站');
                        return false;
                    }
                    if (isTemplateReuseWorkflow() && !appState.templateReuse.contentItems.length) {
                        showNotice(appState.templateReuse.siteType === 'games' ? '请选择有效的游戏目录并等待读取完成。' : '模板复用模式还没有内容来源。请选择 JSON/内容压缩包或静态网站压缩包。', '请先选择新内容');
                        return false;
                    }
                    if (isTemplateReuseWorkflow() && validateTemplateReuse()) {
                        showNotice(appState.templateReuse.error, '模板复用尚未通过校验');
                        return false;
                    }
                    return true;
                }
                if (isAdInjectionWorkflow()) {
                    if (!(appState.adInjectionSites || []).length) {
                        showNotice('请先上传至少一个已过审网站压缩包，并等待结构识别完成。', '还不能进入配置网站');
                        return false;
                    }
                    return true;
                }
                if (isBatchAdBuild()) {
                    if (!appState.batchAdBuild.sites || appState.batchAdBuild.sites.length < 2) {
                        showNotice('请先选择至少两份 JSON、ZIP、RAR 或 7Z 数据源。', '还不能继续');
                        return false;
                    }
                    return true;
                }
                if (!appState.data || appState.data.length === 0) {
                    showNotice('请先上传数据文件。', '还不能继续');
                    return false;
                }
                if (appState.siteBuildMode === 'differentiated' && !appState.differentiatedImportName) {
                    showNotice('差异化精品建站必须上传本次站点的数据源，不能继承上一次或内置内容。', '请上传独立数据包');
                    return false;
                }
                if (appState.siteBuildMode === 'ad-migration' && !(appState.legacyAdMigration && appState.legacyAdMigration.valid)) {
                    showNotice('广告移植建站需要通过旧网站源码压缩包校验后才能继续。请查看失败原因并重新上传。', '还不能继续');
                    return false;
                }
                return true;
            case 2:
                if (isBatchAdBuild()) {
                    var unconfirmedSite = (appState.batchAdBuild.sites || []).find(function(site) { return !THEMES[site.themeId]; });
                    if (unconfirmedSite) {
                        showNotice('“' + unconfirmedSite.fileName + '”尚未确认领域。请使用上方站点切换器逐站检查并选择领域。', '仍有站点待确认');
                        return false;
                    }
                    return true;
                }
                if (!appState.selectedTheme) {
                    showNotice('暂时无法可靠识别领域，请手动选择一个最接近的领域。', '请选择网站领域');
                    return false;
                }
                return true;
            case 3:
                if (isBatchAdBuild()) {
                    var invalidSite = (appState.batchAdBuild.sites || []).find(function(site) { return batchSiteIssues(site).length > 0; });
                    if (invalidSite) {
                        showNotice('“' + invalidSite.fileName + '”仍缺少所选领域的必填字段。请在本步骤完成每个站点的字段映射。', '字段尚未完成');
                        return false;
                    }
                    var templateIssueSite = (appState.batchAdBuild.sites || []).find(function(site) { return getBatchTemplateIssue(site); });
                    if (templateIssueSite) {
                        showNotice('“' + templateIssueSite.fileName + '”' + getBatchTemplateIssue(templateIssueSite) + '。同一领域的批量站点必须使用不同模板。', '模板需要区分');
                        return false;
                    }
                    return true;
                }
                var theme = THEMES[appState.selectedTheme];
                var requiredFields = theme.fields.filter(function(f) { return f.required; });
                for (var i = 0; i < requiredFields.length; i++) {
                    if (!appState.fieldMapping[requiredFields[i].id]) {
                        showNotice('请匹配所有必填字段：' + requiredFields[i].labelZh, '字段尚未完成');
                        return false;
                    }
                }
                return true;
            case 4:
                if (isAdPolicyWorkflow()) {
                    if (isQuickAdUpdate()) {
                        var quickPlan = planQuickAdUpdate(appState.adPolicySites, appState.adQuickCodes, quickUpdateOptions());
                        if (!quickPlan.validCount) { showNotice('请上传与目标站域名匹配的新广告 TXT，并检查匹配结果。', '广告代码尚未完成'); return false; }
                        return !adRestorationRunning;
                    }
                    var policyErrors = AdRestoration.validatePolicy(appState.adPolicyGlobal);
                    Object.values(appState.adPolicyOverrides).forEach(function(policy) { policyErrors = policyErrors.concat(AdRestoration.validatePolicy(policy)); });
                    if (policyErrors.length) { showNotice(policyErrors[0].message, '广告策略尚未完成'); return false; }
                    return !adRestorationRunning;
                }
                if (isAdInjectionWorkflow()) {
                    var injectionMatch = typeof AdRestoration !== 'undefined'
                        ? AdRestoration.matchAdCodesToSites(appState.adInjectionSites || [], appState.adInjectionCodes || [])
                        : { validCount: 0 };
                    if (!appState.adInjectionSites.length || injectionMatch.validCount !== appState.adInjectionSites.length) {
                        showNotice('请在广告配置中上传并通过每个站点的广告代码 TXT 配对校验。', '广告代码尚未完成');
                        return false;
                    }
                    return true;
                }
                if (isBatchAdBuild()) {
                    var batchReport = typeof BatchAdBuilder !== 'undefined' ? BatchAdBuilder.validateAssignments(appState.batchAdBuild.sites, appState.batchAdBuild.codes, appState.batchAdBuild) : { valid: false, errors: [{ message: '批量建站组件未加载。' }] };
                    if (!batchReport.valid) {
                        showNotice(batchReport.errors[0] ? batchReport.errors[0].message : '请完成批量广告配置。', '广告配置尚未完成');
                        return false;
                    }
                }
                return true;
            default:
                return true;
        }
    }

    btnPrev.addEventListener('click', function() {
        var targetStep = previousWorkflowStep();
        if (targetStep) goToStep(targetStep);
    });

    if (btnReupload) btnReupload.addEventListener('click', function() {
        // 取消文件选择时保留已成功导入的数据，避免用户意外丢失当前工作。
        if (isAdPolicyWorkflow()) { document.getElementById('restoration-sites-button').click(); return; }
        if (isAdInjectionWorkflow()) {
            var injectionInput = document.getElementById('injection-sites-input');
            if (injectionInput) { injectionInput.value = ''; injectionInput.click(); }
            return;
        }
        openFilePicker();
    });

    btnNext.addEventListener('click', function() {
        try {
            var targetStep = nextWorkflowStep();
            if (targetStep) goToStep(targetStep);
        } catch (error) {
            console.error('Workflow navigation error:', error);
            showNotice('无法进入下一步：' + formatUiError(error, '页面状态异常，请刷新后重新上传。'), '步骤切换失败');
        }
    });

    // 点击步骤进度条跳转（仅已完成的步骤）
    stepItems.forEach(function(item) {
        item.addEventListener('click', function() {
            var step = parseInt(this.dataset.step);
            var steps = currentWorkflowSteps();
            var highestReachedStep = getWorkflowHighestReachedStep(currentWorkflowProgressKey(), steps);
            if (window.WorkflowStepNavigation.canNavigateToStep(steps, highestReachedStep, step)) goToStep(step);
        });
    });

    // ========== Step 2: 自动识别并确认领域 ==========
    function getBlueprintsForTheme(themeId) {
        var profile = DOMAIN_CATALOG[themeId];
        var ids = profile && profile.blueprints ? profile.blueprints : [];
        var matches = ids.map(function(id) {
            return TEMPLATE_PRESETS.find(function(template) { return template.id === id; });
        }).filter(function(template) {
            return template && (template.domainId === themeId || template.domainId === '*');
        });
        return matches;
    }

    function renderThemeCards() {
        var grid = document.getElementById('theme-grid');
        if (!grid) return;
        grid.innerHTML = Object.keys(DOMAIN_CATALOG).map(function(themeId) {
            var profile = DOMAIN_CATALOG[themeId];
            var theme = THEMES[themeId];
            var fields = theme.fields.slice(0, 6).map(function(field) { return field.labelZh; }).join('、');
            var searchText = [profile.label, profile.nameEn, profile.description].concat(profile.keywords || []).join(' ').toLowerCase();
            return '<div class="theme-card" data-theme="' + themeId + '" data-search="' + escapeHtml(searchText) + '" role="radio" aria-checked="false" tabindex="0" style="--theme-accent:' + profile.accent + ';--theme-soft:' + profile.soft + '">' +
                '<div class="theme-card-head"><div class="theme-icon domain-glyph" aria-hidden="true">' + DomainIcons.imageHTML(themeId) + '</div>' +
                '<span class="theme-choice" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m5 10 3 3 7-7"></path></svg></span></div>' +
                '<h3>' + profile.label + '</h3><p class="theme-name-en">' + profile.nameEn + '</p>' +
                '<p class="theme-desc">' + profile.description + '</p><ul class="theme-fields-preview"><li>' + fields + '</li></ul></div>';
        }).join('');
        // Artwork attribution is separate from selectable cards and their search.
        var credits = document.getElementById('domain-icon-credits');
        if (credits) credits.innerHTML = DomainIcons.workbenchCreditsHTML();
        document.getElementById('theme-count').textContent = Object.keys(DOMAIN_CATALOG).length + ' 个可识别领域';
        document.getElementById('domain-visible-count').textContent = Object.keys(DOMAIN_CATALOG).length;
    }

    function createThemeConfig(themeId) {
        var theme = THEMES[themeId];
        var defaultTemplate = getBlueprintsForTheme(themeId)[0];
        return {
                editorialTemplateVersion: 'current',
                brandId: themeId + '-brand-01',
                siteTitle: theme.siteTitle,
                logoText: theme.logoText,
                logoIcon: (typeof LOGO_ICON_DEFAULTS !== 'undefined' && LOGO_ICON_DEFAULTS[themeId]) || '🌐',
                contactEmail: 'contact@your-domain.com',
                navLinks: ['home'],
                footerLinks: ['privacy', 'terms', 'contact', 'about'],
                navbarLayout: 'normal',
                footerStyle: 'simple',
                backLinkStyle: 'text',
                heroEnabled: false,
                allArticlesEnabled: true,
                homeLayout: 'standard',
                heroTitle: theme.hero.title,
                heroSubtitle: theme.hero.subtitle,
                categories: JSON.parse(JSON.stringify(theme.categories)),
                cardColumns: 'auto',
                randomSort: true,
                cardFields: theme.cardFields.slice(),
                metaLayout: theme.detail.metaLayout,
                contentRender: theme.detail.contentRender,
                actionButtonEnabled: theme.detail.actionButton.enabled,
                actionButtonText: theme.detail.actionButton.text,
                actionButtonLinkField: theme.detail.actionButton.linkField,
                relatedCount: 4,
                relatedCardFields: theme.relatedCardFields.slice(),
                aboutEnabled: true,
                contactFields: ['name', 'email', 'subject', 'message'],
                privacyLength: 'full',
                termsLength: 'full',
                templateId: defaultTemplate ? defaultTemplate.id : null,
                iconSetId: 'custom',
                selectedStyle: 'dark',
                navbarStyle: 'glass-sticky',
                navbarHeight: '60px',
                logoStyle: 'text',
                cardHover: 'float',
                cardBorder: 'rounded',
                cardRadius: '8px',
                cardSpacing: '20px',
                cardExcerptLines: '3',
                btnStyle: 'gradient',
                btnSize: 'medium',
                gridGap: '20px',
                fontStyle: 'sans-serif',
                animationEnter: 'fadeIn',
                transitionSpeed: '0.3s',
                metaBg: 'dark',
                detailImgStyle: 'fullwidth',
                // 编号是站点级显示偏好；新站点默认关闭，批量站点各自保存。
                categoryNumbersEnabled: false,
                categoryTitleStyle: 'single',
                categoryTitleAlign: 'left',
                cardImageHeight: '180px',
                contentMaxWidth: '1200px',
                heroStyle: 'gradient',
                detailLayout: 'single',
                cardViewMode: 'card',
                adPlacements: {}  // { adv1: { position: 'after-hero', page: 'home' }, adv2: ... }
        };
    }

    function renderDomainDetection() {
        var container = document.getElementById('domain-detection');
        if (!container) return;
        if (isBatchAdBuild()) renderBatchDomainSiteTabs();
        var detection = appState.domainDetection;
        if (!detection) {
            container.innerHTML = '<div class="detection-card waiting"><span class="detection-mark">···</span><div><strong>等待分析</strong><p>上传数据后，这里会显示领域、置信度和判断依据。</p></div></div>';
            return;
        }

        var selectedProfile = appState.selectedTheme && DOMAIN_CATALOG[appState.selectedTheme];
        var manual = appState.domainSelectionSource === 'manual';
        var title = selectedProfile ? selectedProfile.label : '未能可靠识别';
        var status = manual ? '人工确认' : (detection.reliable ? '自动识别完成' : (detection.fallbackUsed ? '通用兜底已启用' : '低置信度建议'));
        var evidence = manual
            ? '<span>已覆盖自动建议：' + escapeHtml(detection.label || '无明确候选') + '</span>'
            : (detection.evidence.length
            ? detection.evidence.map(function(item) { return '<span>' + escapeHtml(item) + '</span>'; }).join('')
            : '<span>缺少明确的领域字段或关键词</span>');
        var top = detection.scores.slice(0, 3).filter(function(item) { return item.score > 0; }).map(function(item) {
            return '<li><span>' + escapeHtml(item.label) + '</span><b>' + item.score + ' 分</b></li>';
        }).join('');

        container.innerHTML = '<div class="detection-card ' + (detection.reliable || manual ? 'confirmed' : 'uncertain') + '">' +
            '<span class="detection-mark">' + (detection.reliable || manual ? '✓' : '?') + '</span><div class="detection-main">' +
            '<div class="detection-eyebrow">' + status + '</div><h3>' + escapeHtml(title) +
            (!manual && !detection.fallbackUsed && detection.confidence ? '<em>' + detection.confidence + '% 置信度</em>' : '') + '</h3>' +
            '<p>' + (manual ? '你已手动确认该领域，后续将使用对应字段与专属蓝图。' :
            (detection.reliable ? '系统将自动套用该领域的字段、分类、品牌和模板蓝图。' :
            (detection.fallbackUsed ? '未发现足够一致的垂直领域信号，已安全使用通用资讯方案；你也可以在下方搜索并修正。' : '建议检查候选结果，并在下方手动确认最接近的领域。'))) + '</p>' +
            '<div class="evidence-list">' + evidence + '</div></div>' +
            (top ? '<ol class="score-list">' + top + '</ol>' : '') + '</div>';
    }

    function updateThemeCardSelection(themeId) {
        if (!themeCards) return;
        themeCards.forEach(function(card) {
            var selected = card.dataset.theme === themeId;
            card.classList.toggle('selected', selected);
            card.setAttribute('aria-checked', selected ? 'true' : 'false');
        });
    }

    function selectTheme(themeId, source) {
        if (!THEMES[themeId]) return;
        if (isBatchAdBuild()) {
            selectBatchSiteTheme(themeId, source);
            return;
        }
        appState.selectedTheme = themeId;
        appState.domainSelectionSource = source || 'manual';
        appState.randomTemplateHistory = [];
        appState.config = createThemeConfig(themeId);
        applyTemplatePreset(appState.config.templateId, false);
        applyRandomIconSet(false);
        if (appState.jsonFields.length) autoMapFields();
        if (appState.siteBuildMode === 'differentiated') {
            appState.differentiated.domainId = themeId;
            // Field recognition happens after an import, so refresh the picker
            // here rather than leaving the customizer on a generic family.
            populateDifferentiatedDesigns();
        }

        updateThemeCardSelection(themeId);
        renderDomainDetection();
    }

    renderThemeCards();
    renderDomainDetection();
    var themeCards = document.querySelectorAll('.theme-card');
    themeCards.forEach(function(card) {
        card.addEventListener('click', function() {
            selectTheme(this.dataset.theme, 'manual');
        });

        card.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.click();
            }
        });
    });

    var domainSearch = document.getElementById('domain-search');
    var domainVisibleCount = document.getElementById('domain-visible-count');
    if (domainSearch) {
        domainSearch.addEventListener('input', function() {
            var query = this.value.trim().toLowerCase();
            var visible = 0;
            themeCards.forEach(function(card) {
                var matches = !query || card.dataset.search.indexOf(query) !== -1;
                card.hidden = !matches;
                if (matches) visible += 1;
            });
            domainVisibleCount.textContent = visible;
        });
    }

    // ========== Step 1: 数据上传 ==========
    function parseUploadedJson(text) {
        return JSON.parse(String(text == null ? '' : text).replace(/^\uFEFF/, ''));
    }

    function setSingleImportProgress(percent, message, state) {
        var panel = document.getElementById('upload-import-progress');
        var fill = document.getElementById('upload-import-progress-fill');
        var value = document.getElementById('upload-import-progress-value');
        var text = document.getElementById('upload-import-progress-text');
        var isLoading = state === 'loading';
        var numericPercent = Number(percent);
        var safePercent = Number.isFinite(numericPercent)
            ? Math.max(0, Math.min(100, Math.round(numericPercent)))
            : Number(panel && panel.dataset.progress) || 0;
        if (panel) {
            panel.hidden = false;
            panel.dataset.state = state || 'loading';
            panel.dataset.progress = String(safePercent);
        }
        if (fill) fill.style.width = safePercent + '%';
        if (value) value.textContent = safePercent + '%';
        if (text) text.textContent = message;
        if (uploadArea) {
            uploadArea.classList.toggle('is-importing', isLoading);
            uploadArea.setAttribute('aria-busy', isLoading ? 'true' : 'false');
        }
        if (fileInput) fileInput.disabled = isLoading;
        var directoryButton = document.getElementById('data-directory-button');
        if (directoryButton) directoryButton.disabled = isLoading || directoryImportRunning;
    }

    function beginSingleDataImport(file) {
        // The successful-import overview hides its upload area. Re-open it only
        // after a replacement file has actually been selected, so its progress
        // feedback remains visible while a cancelled picker keeps prior data intact.
        if (uploadArea) uploadArea.hidden = false;
        setSingleImportProgress(3, '正在读取 ' + file.name + '…', 'loading');
    }

    function finishSingleDataImport(file) {
        setSingleImportProgress(100, '已解析 ' + file.name + '，正在展示数据概览。', 'success');
    }

    function failSingleDataImport(file, error) {
        var reason = error && error.message ? error.message : '请检查数据源后重试。';
        setSingleImportProgress(100, '解析失败：' + reason, 'error');
    }

    function handleFile(file) {
        var ext = file.name.split('.').pop().toLowerCase();

        if (['json', 'zip', 'rar', '7z'].indexOf(ext) !== -1) beginSingleDataImport(file);

        if (ext === 'json') {
            if (appState.siteBuildMode === 'differentiated') clearDifferentiatedImport();
            var reader = new FileReader();
            reader.onprogress = function(event) {
                var fraction = event.lengthComputable && event.total ? event.loaded / event.total : 0.35;
                setSingleImportProgress(5 + Math.round(fraction * 52), '正在读取 JSON：' + file.name, 'loading');
            };
            reader.onload = function(e) {
                try {
                    setSingleImportProgress(68, '正在解析 JSON 结构…', 'loading');
                    var data = parseUploadedJson(e.target.result);
                    if (appState.siteBuildMode === 'differentiated') {
                        var imported = DifferentiatedBuilder.importJsonData(data, appState.differentiated.siteType);
                        applyDifferentiatedImport(imported, file.name);
                        processData(imported.data, false, {}, false, { fileName: file.name });
                        finishSingleDataImport(file);
                        return;
                    }
                    processData(data, false, {}, false, { fileName: file.name });
                    finishSingleDataImport(file);
                } catch (err) {
                    failSingleDataImport(file, err);
                    showNotice('JSON 文件解析失败：' + err.message, '无法读取文件');
                }
            };
            reader.onerror = function() {
                var error = reader.error || new Error('浏览器无法读取该文件。');
                failSingleDataImport(file, error);
                showNotice('JSON 文件读取失败：' + error.message, '无法读取文件');
            };
            reader.readAsText(file);
        } else if (ext === 'zip') {
            handleZipFile(file);
        } else if (ext === 'rar' || ext === '7z') {
            handleArchiveFile(file, ext);
        } else {
            showNotice('请上传 .json 文件，或包含 JSON 与图片的 .zip、.rar、.7z 压缩包。', '不支持的文件类型');
        }
    }

    function handleZipFile(file) {
        if (appState.siteBuildMode === 'differentiated') {
            handleDifferentiatedZipFile(file);
            return;
        }
        if (typeof window.JSZip === 'undefined') {
            failSingleDataImport(file, new Error('ZIP 解析组件未加载。'));
            showNotice('ZIP 解析组件未加载。请刷新页面后重试；工具会优先从本地加载该组件。', '无法读取压缩包');
            return;
        }
        var reader = new FileReader();
        reader.onprogress = function(event) {
            var fraction = event.lengthComputable && event.total ? event.loaded / event.total : 0.35;
            setSingleImportProgress(5 + Math.round(fraction * 28), '正在读取 ZIP：' + file.name, 'loading');
        };
        reader.onload = function(e) {
            window.JSZip.loadAsync(e.target.result).then(async function(zip) {
                setSingleImportProgress(42, '正在检查 ZIP 内的数据与图片…', 'loading');
                var jsonFile = null;
                var jsonFilePath = '';
                var images = {};
                var archiveFiles = zip && zip.files && typeof zip.files === 'object' ? zip.files : null;

                if (!archiveFiles) {
                    throw new Error('ZIP 解析结果不完整。请刷新页面后重新选择该压缩包。');
                }

                // 查找JSON文件和图片文件
                Object.keys(archiveFiles).forEach(function(relativePath) {
                    var zipEntry = archiveFiles[relativePath];
                    if (!zipEntry.dir) {
                        var entryExt = relativePath.split('.').pop().toLowerCase();
                        if (entryExt === 'json' && !jsonFile) {
                            jsonFile = zipEntry;
                            jsonFilePath = relativePath;
                        } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].indexOf(entryExt) !== -1) {
                            images[relativePath] = zipEntry;
                        }
                    }
                });

                if (!jsonFile) {
                    failSingleDataImport(file, new Error('ZIP 文件中未找到 JSON 数据文件。'));
                    showNotice('ZIP 文件中未找到 JSON 数据文件。请确认压缩包内包含可用的 JSON 文件。', '找不到数据文件');
                    return;
                }

                var selectedJson = await BatchAdBuilder.selectDataJson(Object.keys(archiveFiles).filter(function(path) { return !archiveFiles[path].dir; }).map(function(path) { return { path: path }; }), function(entry) { return archiveFiles[entry.path].async('text'); });
                jsonFilePath = selectedJson.path;
                jsonFile = archiveFiles[jsonFilePath];
                // 读取JSON
                return jsonFile.async('string').then(function(jsonStr) {
                    try {
                        setSingleImportProgress(64, '正在解析 ZIP 内的 JSON…', 'loading');
                        var data = parseUploadedJson(jsonStr);
                        var hasLocalImages = Object.keys(images).length > 0;

                        // 如果有本地图片，需要读取图片为blob
                        if (hasLocalImages) {
                            var imageMap = {};
                            var imagePaths = Object.keys(images);
                            var completedImages = 0;
                            // Bound decompression memory and overlap asynchronous
                            // image reads. Populate the map in archive order so
                            // duplicate basenames retain their original precedence.
                            return mapWithConcurrency(imagePaths, 2, async function(path) {
                                var blob = await images[path].async('blob');
                                completedImages++;
                                var percent = 70 + Math.round((completedImages / imagePaths.length) * 24);
                                setSingleImportProgress(percent, '正在读取图片 ' + completedImages + '/' + imagePaths.length + '：' + path, 'loading');
                                return blob;
                            }).then(function(blobs) {
                                imagePaths.forEach(function(path, index) { imageMap[path] = blobs[index]; });
                                processData(data, true, imageMap, false, { fileName: file.name, entryPath: jsonFilePath });
                                finishSingleDataImport(file);
                            });
                        } else {
                            processData(data, false, {}, false, { fileName: file.name, entryPath: jsonFilePath });
                            finishSingleDataImport(file);
                        }
                    } catch (err) {
                        failSingleDataImport(file, err);
                        showNotice('JSON 文件解析失败：' + err.message, '无法读取数据');
                    }
                });
            }).catch(function(err) {
                failSingleDataImport(file, err);
                var ext = file.name.split('.').pop().toLowerCase();
                if (ext === 'rar' || ext === '7z') {
                    showNotice('暂不支持 .' + ext + ' 格式的直接解析。请将压缩包解压后重新打包为 .zip 格式再上传。', '无法读取压缩包');
                } else {
                    showNotice('压缩包读取失败：' + err.message, '无法读取压缩包');
                }
            });
        };
        reader.onerror = function() {
            var error = reader.error || new Error('浏览器无法读取该压缩包。');
            failSingleDataImport(file, error);
            showNotice('压缩包读取失败：' + error.message, '无法读取压缩包');
        };
        reader.readAsArrayBuffer(file);
    }

    async function handleDifferentiatedZipFile(file) {
        if (typeof window.JSZip === 'undefined' || typeof DifferentiatedBuilder === 'undefined') {
            failSingleDataImport(file, new Error('差异化 ZIP 解析组件未加载。'));
            showNotice('差异化 ZIP 解析组件未加载，请刷新页面后重试。', '无法读取压缩包');
            return;
        }
        clearDifferentiatedImport();
        setSingleImportProgress(18, '正在读取差异化数据包…', 'loading');
        uploadArea.classList.add('is-reading-archive');
        uploadArea.setAttribute('aria-busy', 'true');
        fileInput.disabled = true;
        renderDifferentiatedPackageStatus('正在读取 manifest、内容、素材与来源记录…', 'pending');
        try {
            var imported = await DifferentiatedBuilder.importZip(file, appState.differentiated.siteType, { JSZip: window.JSZip });
            setSingleImportProgress(76, '正在分析内容、素材与来源记录…', 'loading');
            applyDifferentiatedImport(imported, file.name);
            processData(imported.data, Object.keys(imported.localImages || {}).length > 0, imported.localImages || {}, true, { fileName: file.name });
            finishSingleDataImport(file);
        } catch (error) {
            failSingleDataImport(file, error);
            renderDifferentiatedPackageStatus('读取失败：' + error.message, 'invalid');
            showNotice('差异化数据包读取失败：' + error.message, '无法读取压缩包');
        } finally {
            uploadArea.classList.remove('is-reading-archive');
            uploadArea.setAttribute('aria-busy', 'false');
            fileInput.disabled = false;
        }
    }

    function ensureArchiveRuntime() {
        if (window.ArchiveRuntimeReady) return window.ArchiveRuntimeReady;
        if (window.__archiveRuntimeFallbackLoad) return window.__archiveRuntimeFallbackLoad;

        // Prefer the shared loader so Archive.open() captures its Worker for timeout cleanup.
        if (typeof window.loadArchiveRuntime === 'function') {
            window.__archiveRuntimeFallbackLoad = Promise.resolve(window.loadArchiveRuntime());
            return window.__archiveRuntimeFallbackLoad;
        }

        // 某些静态服务器会命中旧的 index 缓存而漏载初始化脚本。
        // 此处直接按绝对地址导入模块，不再依赖动态 script 标签的 currentScript 状态。
        var moduleUrl = new URL('js/vendor/libarchive/libarchive.js?v=20260912-archive-runtime-2', document.baseURI).href;
        var workerUrl = new URL('js/vendor/libarchive/worker-bundle.js?v=20260912-archive-runtime-2', document.baseURI).href;
        window.__archiveRuntimeFallbackLoad = import(moduleUrl).then(function(module) {
            if (typeof window.configureArchiveRuntime === 'function') return window.configureArchiveRuntime(module);
            module.Archive.init({ workerUrl: workerUrl });
            return module.Archive;
        });
        return window.__archiveRuntimeFallbackLoad;
    }

    function handleArchiveFile(file, archiveType) {
        setSingleImportProgress(16, '正在加载 ' + archiveType.toUpperCase() + ' 解析组件…', 'loading');
        uploadArea.classList.add('is-reading-archive');
        uploadArea.setAttribute('aria-busy', 'true');
        fileInput.disabled = true;
        ensureArchiveRuntime().then(function(Archive) {
            setSingleImportProgress(30, '正在打开 ' + archiveType.toUpperCase() + ' 压缩包…', 'loading');
            return Archive.open(file).then(function(archive) {
                return archive.extractFiles().then(function() {
                    setSingleImportProgress(56, '正在解压数据与图片目录…', 'loading');
                    return archive.getFilesArray();
                }).finally(function() {
                    archive.close();
                });
            });
        }).then(function(entries) {
            var jsonEntry = entries.find(function(entry) {
                return entry.file && /\.json$/i.test(entry.path + entry.file.name);
            });
            if (!jsonEntry) {
                failSingleDataImport(file, new Error(archiveType.toUpperCase() + ' 文件中未找到 JSON 数据文件。'));
                showNotice(archiveType.toUpperCase() + ' 文件中未找到 JSON 数据文件。请确认压缩包内包含可用的 JSON 文件。', '找不到数据文件');
                return;
            }

            return jsonEntry.file.text().then(function(jsonStr) {
                setSingleImportProgress(76, '正在解析压缩包内的 JSON…', 'loading');
                var data;
                try {
                    data = parseUploadedJson(jsonStr);
                } catch (err) {
                    failSingleDataImport(file, err);
                    showNotice('JSON 文件解析失败：' + err.message, '无法读取数据');
                    return;
                }

                if (appState.siteBuildMode === 'differentiated') {
                    clearDifferentiatedImport();
                    var imported = DifferentiatedBuilder.importJsonData(data, appState.differentiated.siteType);
                    imported.localImages = {};
                    imported.packageAssets = {};
                    applyDifferentiatedImport(imported, archiveType.toUpperCase() + ' · ' + (jsonEntry.path || '') + jsonEntry.file.name);
                    data = imported.data;
                }

                var imageMap = {};
                entries.forEach(function(entry) {
                    if (!entry.file || !/\.(?:jpg|jpeg|png|gif|webp|svg)$/i.test(entry.path + entry.file.name)) return;
                    imageMap[(entry.path + entry.file.name).replace(/\\/g, '/')] = entry.file;
                });
                processData(data, Object.keys(imageMap).length > 0, imageMap, false, { fileName: file.name, entryPath: (jsonEntry.path || '') + jsonEntry.file.name });
                finishSingleDataImport(file);
            });
        }).catch(function(err) {
            failSingleDataImport(file, err);
            var details = err && err.message ? '：' + err.message : '';
            showNotice(archiveType.toUpperCase() + ' 压缩包读取失败' + details + '。请确认文件未加密、未分卷且未损坏；若问题持续，请刷新页面后重试。', '无法读取压缩包');
        }).finally(function() {
            uploadArea.classList.remove('is-reading-archive');
            uploadArea.setAttribute('aria-busy', 'false');
            fileInput.disabled = false;
        });
    }

    function processData(data, isLocalImages, localImages, skipLocalImageWarning, source) {
        // Single and batch imports share normalization, aliases and asset naming.
        const prepared = BatchAdBuilder.prepareSource(data, localImages);
        data = prepared.data;
        localImages = prepared.localImages;
        if (!data.length) throw new Error('JSON 数据为空或没有可识别的对象列表。');

        appState.data = data;
        resetWorkflowStepProgress(currentWorkflowProgressKey());
        appState.isLocalImages = isLocalImages;
        appState.localImages = localImages;
        if (appState.siteBuildMode === 'differentiated') renderDifferentiatedPackageStatus();

        // 分析字段
        var fields = {};
        data.forEach(function(item) {
            Object.keys(item).forEach(function(key) {
                if (!fields[key]) {
                    fields[key] = typeof item[key];
                }
            });
        });
        appState.jsonFields = Object.keys(fields).map(function(key) {
            return { name: key, type: fields[key] };
        });

        // 综合上传文件名、包内 JSON 路径、字段名与前 30 条内容样本识别领域；全部在浏览器本地完成。
        appState.domainDetection = DomainEngine.detect(data, DOMAIN_CATALOG, source);
        if (appState.domainDetection.suggestedId) {
            selectTheme(appState.domainDetection.suggestedId, 'auto');
        } else {
            appState.selectedTheme = null;
            appState.domainSelectionSource = null;
            themeCards.forEach(function(card) {
                card.classList.remove('selected');
                card.setAttribute('aria-checked', 'false');
            });
            renderDomainDetection();
        }

        // 检测图片类型
        var hasOnlineImages = false;
        var hasLocalImgs = false;
        data.forEach(function(item) {
            var imgKeys = Object.keys(item);
            imgKeys.forEach(function(k) {
                var val = item[k];
                if (typeof val === 'string') {
                    if (val.match(/^https?:\/\//) && val.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)) hasOnlineImages = true;
                    else if (val.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)) hasLocalImgs = true;
                }
            });
        });

        // 如果是本地图片且没有上传ZIP中的图片，提示
        if (hasLocalImgs && !hasOnlineImages && !isLocalImages && !skipLocalImageWarning) {
            showConfirm('检测到图片可能为本地路径。如需在导出网站中包含这些图片，请将 JSON 和图片一起打包为 ZIP、RAR 或 7z 后重新上传。', '未找到本地图片', '仍然导入', function(shouldContinue) {
                if (shouldContinue) processData(data, isLocalImages, localImages, true, source);
            });
            return;
        }

        // 更新UI
        displayDataOverview(data, appState.jsonFields, hasOnlineImages ? '在线' : (isLocalImages ? '本地' : '未知'));

        // 自动尝试匹配字段
        autoMapFields();
    }

    function displayDataOverview(data, fields, imageType) {
        document.getElementById('data-count').textContent = data.length;
        document.getElementById('field-count').textContent = fields.length;
        document.getElementById('image-type').textContent = imageType;

        // 字段列表
        var fieldListHtml = '';
        fields.forEach(function(f) {
            fieldListHtml += '<span class="field-tag">' + escapeHtml(f.name) +
                '<span class="field-type">(' + escapeHtml(f.type) + ')</span></span>';
        });
        document.getElementById('field-list').innerHTML = fieldListHtml;

        // 数据预览表
        var previewData = data.slice(0, 3);
        var tableHtml = '<thead><tr><th>#</th>';
        fields.forEach(function(f) { tableHtml += '<th>' + escapeHtml(f.name) + '</th>'; });
        tableHtml += '</tr></thead><tbody>';
        previewData.forEach(function(item, idx) {
            tableHtml += '<tr><td>' + (idx + 1) + '</td>';
            fields.forEach(function(f) {
                var val = item[f.name];
                if (val === undefined || val === null) val = '-';
                var str = String(val);
                if (str.length > 50) str = str.substring(0, 50) + '...';
                tableHtml += '<td>' + escapeHtml(str) + '</td>';
            });
            tableHtml += '</tr>';
        });
        tableHtml += '</tbody>';
        document.getElementById('preview-table').innerHTML = tableHtml;

        dataOverview.style.display = 'block';
        uploadArea.hidden = true;
        if (btnReupload) btnReupload.hidden = false;
    }

    // ========== Step 3: 字段匹配 ==========
    function autoMapFields() {
        var theme = THEMES[appState.selectedTheme];
        if (!theme) return;

        appState.fieldMapping = BatchAdBuilder.autoMapFields(theme, appState.jsonFields);
    }

    function renderFieldMapping() {
        if (isBatchAdBuild()) {
            fieldMappingView = null;
            renderBatchFieldMapping();
            return;
        }
        var theme = THEMES[appState.selectedTheme];
        if (!theme) return;

        fieldMappingView = createFieldMappingView({
            container: document.getElementById('mapping-container'),
            summary: document.getElementById('mapping-summary'),
            fields: theme.fields,
            jsonFields: appState.jsonFields,
            mapping: appState.fieldMapping,
            onChange: function(themeField, value) {
                // 主应用保留原有保存逻辑，视图模块只接收结果并更新显示。
                if (value) {
                    appState.fieldMapping[themeField] = value;
                } else {
                    delete appState.fieldMapping[themeField];
                }
                updateMappingSummary();
            }
        });
    }

    function updateMappingSummary() {
        if (fieldMappingView) fieldMappingView.update(appState.fieldMapping);
    }

    // ========== Step 4: 配置面板 ==========
    function initConfigPanel() {
        var theme = EditorialTemplateVersions.theme(appState);
        if (!theme) return;

        // Hero开关
        var heroToggle = document.getElementById('hero-enabled');
        var heroConfig = document.getElementById('hero-config');
        heroToggle.addEventListener('change', function() {
            appState.config.heroEnabled = this.checked;
            heroConfig.style.display = this.checked ? 'block' : 'none';
            if (this.checked) {
                document.getElementById('hero-title').value = appState.config.heroTitle;
                document.getElementById('hero-subtitle').value = appState.config.heroSubtitle;
            }
            updatePreview();
        });

        var allArticlesToggle = document.getElementById('all-articles-enabled');
        if (allArticlesToggle) allArticlesToggle.addEventListener('change', function() {
            appState.config.allArticlesEnabled = this.checked;
            syncAllArticlesUI();
            updatePreview();
        });

        document.getElementById('hero-title').addEventListener('input', function() {
            appState.config.heroTitle = this.value;
            updatePreview();
        });

        document.getElementById('hero-subtitle').addEventListener('input', function() {
            appState.config.heroSubtitle = this.value;
            updatePreview();
        });

        // 分类数量
        var catCountSlider = document.getElementById('category-count');
        var catCountValue = document.getElementById('cat-count-value');
        catCountSlider.addEventListener('input', function() {
            catCountValue.textContent = this.value;
            updateCategoryConfig(parseInt(this.value));
            updatePreview();
        });

        // 初始化分类配置
        updateCategoryConfig(EditorialTemplateVersions.isLegacy(appState.config) ? appState.config.categories.length : theme.categories.length);

        // 其他配置事件
        initFontOptions();
        initBrandControls();
        initLogoIconControls();
        initTemplateGrid();
        initIconSetControls();
        initStyleGrid();
        bindConfigEvents();
        initEditorialTemplateVersionControls();
        initConfigTabs();
        initPreviewControls();
        initAdConfig();
    }

    // ========== 页面模板蓝图 ==========
    function getTemplateById(id) {
        var match = TEMPLATE_PRESETS.find(function(template) { return template.id === id && (template.domainId === appState.selectedTheme || template.domainId === '*'); });
        return match || getBlueprintsForTheme(appState.selectedTheme)[0] || null;
    }

    function applyTemplatePreset(templateId, shouldRender) {
        var template = getTemplateById(templateId);
        if (!template) return;
        var activeSite = getActiveBatchSite();
        var owner = isBatchAdBuild() ? getBatchTemplateOwner(template.id, activeSite) : null;
        if (owner) {
            showNotice('“' + template.name + '”已分配给“' + owner.fileName + '”。同一领域的批量站点不能重复使用同一模板。', '请选择另一个模板');
            return false;
        }
        var c = appState.config;
        applyTemplateToConfig(c, template);

        if (shouldRender !== false) {
            if (isBatchAdBuild()) initTemplateGrid();
            applyConfigToUI();
            updatePreview();
        }
        return true;
    }

    function applyTemplateToConfig(c, template) {
        if (!c || !template) return;
        // 选择新蓝图时一并清除旧模板的人工覆盖标记，后续微调重新记录。
        c.controlOverrides = {};
        c.templateId = template.id;

        Object.keys(template.structure || {}).forEach(function(key) {
            // Hero visibility and navigation layout are operator preferences, not template side effects.
            // New sites start with Hero off and regular navigation; templates must not change either choice.
            if (key !== 'heroEnabled' && key !== 'navbarLayout' && key !== 'categoryNumbersEnabled') c[key] = template.structure[key];
        });
        Object.keys(template.style || {}).forEach(function(key) {
            // The optional reference material is an explicit operator choice.
            // Keep it when switching/randomizing templates; choosing a different
            // navbar style restores the original template-default behavior.
            if (key === 'navbarStyle' && c.navbarStyle === 'soft-glass') return;
            // 手动切换和随机组装共用此入口，蓝图不能覆盖用户的编号选择。
            if (key !== 'categoryNumbersEnabled') c[key] = template.style[key];
        });
        // 品牌是模板可见身份的一部分。选择蓝图时必须同步标题，避免不同
        // 模板只改布局却仍保留上一个模板的导航栏名称。
        if (template.brand) {
            c.brandId = template.brand.id;
            c.siteTitle = template.brand.siteTitle;
            c.logoText = template.brand.logoText;
        }
    }

    // ========== 网站品牌标题 ==========
    function getBrandPresetsForTheme() {
        return (typeof BRAND_PRESETS !== 'undefined' && BRAND_PRESETS[appState.selectedTheme]) || [];
    }

    function applyBrandPreset(brandId, shouldRender) {
        var preset = getBrandPresetsForTheme().find(function(item) { return item.id === brandId; });
        if (!preset) return;
        appState.config.brandId = preset.id;
        appState.config.siteTitle = preset.siteTitle;
        appState.config.logoText = preset.logoText;
        var select = document.getElementById('brand-preset');
        if (select) select.value = preset.id;
        if (shouldRender !== false) {
            syncStyledSelects();
            updatePreview();
        }
    }

    function applyRandomBrand(shouldRender) {
        var presets = getBrandPresetsForTheme();
        if (!presets.length) return;
        var themeId = appState.selectedTheme;
        var recent = appState.brandHistory[themeId] || [];
        var candidates = presets.filter(function(item) { return recent.indexOf(item.id) === -1; });
        if (!candidates.length) {
            recent = [];
            candidates = presets.slice();
        }
        var chosen = randomPick(candidates);
        recent.push(chosen.id);
        appState.brandHistory[themeId] = recent.slice(-8);
        applyBrandPreset(chosen.id, shouldRender);
    }

    function initBrandControls() {
        var select = document.getElementById('brand-preset');
        var shuffleButton = document.getElementById('shuffle-brand');
        var count = document.getElementById('brand-option-count');
        var help = document.getElementById('brand-title-help');
        if (!select) return;
        var presets = getBrandPresetsForTheme();
        var profile = DOMAIN_CATALOG[appState.selectedTheme];
        select.innerHTML = presets.map(function(item) {
            return '<option value="' + item.id + '">' + item.name + '</option>';
        }).join('');
        if (count) count.textContent = (profile ? profile.label : '当前领域') + ' · ' + presets.length + ' 个';
        if (help && profile) help.textContent = '已按“' + profile.label + '”领域准备专属名称，并同步用于导航栏 Logo、页面标题和品牌正文。';
        select.value = appState.config.brandId || (presets[0] && presets[0].id) || '';
        select.onchange = function() {
            applyBrandPreset(this.value, true);
        };
        if (shuffleButton) {
            shuffleButton.onclick = function() {
                applyRandomBrand(true);
            };
        }
    }

    // ========== 网站 Logo 图标 ==========
    function getLogoIconEntries() {
        var entries = [];
        var seen = {};
        (typeof LOGO_ICON_GROUPS !== 'undefined' ? LOGO_ICON_GROUPS : []).forEach(function(group) {
            (group.icons || []).forEach(function(item) {
                if (seen[item[0]]) return;
                seen[item[0]] = true;
                entries.push({ icon: item[0], name: item[1], groupId: group.id, groupName: group.name, keywords: group.keywords || '' });
            });
        });
        return entries;
    }

    function getLogoIconName(icon) {
        var match = getLogoIconEntries().find(function(item) { return item.icon === icon; });
        return match ? match.name : '自定义图标';
    }

    function syncLogoIconPicker() {
        var icon = appState.config.logoIcon || '🌐';
        var preview = document.getElementById('logo-icon-preview');
        var name = document.getElementById('logo-icon-name');
        var grid = document.getElementById('logo-icon-grid');
        if (preview) preview.textContent = icon;
        if (name) name.textContent = getLogoIconName(icon);
        if (grid) {
            grid.querySelectorAll('.logo-icon-option').forEach(function(button) {
                var selected = button.dataset.icon === icon;
                button.classList.toggle('selected', selected);
                button.setAttribute('aria-selected', selected ? 'true' : 'false');
            });
        }
    }

    function initLogoIconControls() {
        var trigger = document.getElementById('logo-icon-trigger');
        var panel = document.getElementById('logo-icon-panel');
        var search = document.getElementById('logo-icon-search');
        var tabs = document.getElementById('logo-icon-tabs');
        var grid = document.getElementById('logo-icon-grid');
        var empty = document.getElementById('logo-icon-empty');
        var count = document.getElementById('logo-icon-count');
        if (!trigger || !panel || !search || !tabs || !grid) return;

        var groups = typeof LOGO_ICON_GROUPS !== 'undefined' ? LOGO_ICON_GROUPS : [];
        var entries = getLogoIconEntries();
        var activeGroup = 'all';
        if (count) count.textContent = entries.length + ' 款可选';

        tabs.innerHTML = '<button type="button" class="logo-icon-tab selected" data-group="all" role="tab" aria-selected="true">全部</button>' + groups.map(function(group) {
            return '<button type="button" class="logo-icon-tab" data-group="' + group.id + '" role="tab" aria-selected="false">' + group.name + '</button>';
        }).join('');

        function renderOptions() {
            var query = search.value.trim().toLowerCase();
            var filtered = entries.filter(function(item) {
                var inGroup = activeGroup === 'all' || item.groupId === activeGroup;
                var searchable = [item.icon, item.name, item.groupName, item.keywords].join(' ').toLowerCase();
                return inGroup && (!query || searchable.indexOf(query) !== -1);
            });
            grid.innerHTML = filtered.map(function(item) {
                var selected = item.icon === appState.config.logoIcon;
                return '<button type="button" class="logo-icon-option' + (selected ? ' selected' : '') + '" data-icon="' + item.icon + '" title="' + item.name + ' · ' + item.groupName + '" aria-label="选择' + item.name + '图标" aria-selected="' + (selected ? 'true' : 'false') + '" role="option"><span aria-hidden="true">' + item.icon + '</span></button>';
            }).join('');
            if (empty) empty.hidden = filtered.length > 0;

            grid.querySelectorAll('.logo-icon-option').forEach(function(button) {
                button.onclick = function() {
                    appState.config.logoIcon = this.dataset.icon;
                    if (appState.config.logoStyle !== 'icon' && appState.config.logoStyle !== 'text-icon') {
                        appState.config.logoStyle = 'text-icon';
                        var logoStyle = document.getElementById('logo-style');
                        if (logoStyle) logoStyle.value = 'text-icon';
                        syncStyledSelects();
                    }
                    syncLogoIconPicker();
                    updatePreview();
                };
            });
        }

        trigger.onclick = function() {
            panel.hidden = !panel.hidden;
            this.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
            if (!panel.hidden) {
                renderOptions();
                search.focus();
            }
        };
        search.oninput = renderOptions;
        search.onkeydown = function(event) {
            if (event.key === 'Escape') {
                panel.hidden = true;
                trigger.setAttribute('aria-expanded', 'false');
                trigger.focus();
            }
        };
        tabs.querySelectorAll('.logo-icon-tab').forEach(function(tab) {
            tab.onclick = function() {
                activeGroup = this.dataset.group;
                tabs.querySelectorAll('.logo-icon-tab').forEach(function(item) {
                    var selected = item.dataset.group === activeGroup;
                    item.classList.toggle('selected', selected);
                    item.setAttribute('aria-selected', selected ? 'true' : 'false');
                });
                renderOptions();
            };
        });
        renderOptions();
        syncLogoIconPicker();
    }

    function initTemplateGrid() {
        var grid = document.getElementById('template-grid');
        if (!grid) return;
        if (EditorialTemplateVersions.isLegacy(appState.config)) { grid.innerHTML = ''; return; }

        var html = '';
        var profile = DOMAIN_CATALOG[appState.selectedTheme];
        var activeSite = getActiveBatchSite();
        getBlueprintsForTheme(appState.selectedTheme).forEach(function(template, index) {
            var selected = appState.config.templateId === template.id ? ' selected' : '';
            var owner = isBatchAdBuild() ? getBatchTemplateOwner(template.id, activeSite) : null;
            var unavailable = !!owner;
            html += '<div class="template-card' + selected + (unavailable ? ' is-unavailable' : '') + '" data-template-id="' + template.id + '"' + (unavailable ? ' data-template-unavailable="true" tabindex="-1" aria-disabled="true" aria-label="' + escapeHtml(template.name + '模板已用于' + owner.fileName) + '"' : ' tabindex="0" role="button" aria-label="应用' + template.name + '模板"') + '>';
            html += TemplateLayouts.thumbnail(template.structure.homeLayout) || '<div class="template-icon">' + template.icon + '</div>';
            html += '<div><div class="template-name">' + template.name + (index === 0 ? '<span class="recommended-badge">首选</span>' : '') + '</div>' +
                '<div class="template-domain">' + (unavailable ? '已用于站点 ' + ((appState.batchAdBuild.sites || []).indexOf(owner) + 1) : (template.description || profile.label + '专属')) + '</div></div>';
            html += '</div>';
        });
        grid.innerHTML = html;

        grid.querySelectorAll('.template-card').forEach(function(card) {
            var choose = function() {
                if (this.dataset.templateUnavailable === 'true') return;
                applyTemplatePreset(this.dataset.templateId);
            };
            card.addEventListener('click', choose);
            card.addEventListener('keydown', function(event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    choose.call(this);
                }
            });
        });
    }

    // ========== 图标组合选择 ==========
    function getIconSetsForTheme() {
        return ICON_SET_PRESETS[appState.selectedTheme] || [];
    }

    function getIconSetById(iconSetId) {
        if (!iconSetId || iconSetId === 'custom') return null;
        return getIconSetsForTheme().find(function(set) { return set.id === iconSetId; }) || null;
    }

    function applyIconSet(iconSetId, shouldRender) {
        var iconSet = getIconSetById(iconSetId);
        if (!iconSet) return;
        appState.config.iconSetId = iconSet.id;
        var setMatch = iconSet.id.match(/-icons-(\d+)$/);
        var setIndex = setMatch ? Number.parseInt(setMatch[1], 10) - 1 : 0;
        var semanticRecommendations = typeof getDomainRecommendedCategoryIconSet === 'function'
            ? getDomainRecommendedCategoryIconSet(appState.selectedTheme, appState.config.categories || [], setIndex)
            : null;
        (appState.config.categories || []).forEach(function(category, index) {
            var recommended = semanticRecommendations && semanticRecommendations[index];
            var icon = recommended || iconSet.icons[index];
            if (icon) category.icon = icon;
        });
        if (shouldRender !== false) {
            updateCategoryConfig(appState.config.categories.length);
            applyConfigToUI();
            updatePreview();
        }
    }

    function applyRandomIconSet(shouldRender) {
        var sets = getIconSetsForTheme();
        if (!sets.length) return;
        var themeId = appState.selectedTheme;
        var recent = appState.iconSetHistory[themeId] || [];
        var candidates = sets.filter(function(set) { return recent.indexOf(set.id) === -1; });
        if (!candidates.length) {
            recent = [];
            candidates = sets.slice();
        }

        // 优先选择与最近图标重叠较少的组合，降低“换了组合但视觉没变”的感觉。
        var previousIcons = appState.iconHistory[themeId] || [];
        var minOverlap = Math.min.apply(null, candidates.map(function(set) {
            return set.icons.filter(function(icon) { return previousIcons.indexOf(icon) !== -1; }).length;
        }));
        candidates = candidates.filter(function(set) {
            return set.icons.filter(function(icon) { return previousIcons.indexOf(icon) !== -1; }).length === minOverlap;
        });

        var chosen = randomPick(candidates);
        recent.push(chosen.id);
        appState.iconSetHistory[themeId] = recent.slice(-12);
        var pickedIcons = chosen.icons.slice(0, (appState.config.categories || []).length);
        appState.iconHistory[themeId] = (previousIcons.concat(pickedIcons)).slice(-18);
        applyIconSet(chosen.id, false);
        if (shouldRender !== false) {
            applyConfigToUI();
            updatePreview();
        }
    }

    function initIconSetControls() {
        var select = document.getElementById('icon-set-select');
        var shuffleButton = document.getElementById('shuffle-icon-set');
        if (!select) return;

        var sets = getIconSetsForTheme();
        var html = '<option value="custom">自定义组合</option>';
        sets.forEach(function(set) {
            html += '<option value="' + set.id + '">' + set.name + '  ' + set.icons.slice(0, 5).join(' ') + '</option>';
        });
        select.innerHTML = html;
        select.value = appState.config.iconSetId || (sets[0] && sets[0].id) || 'custom';

        // 领域切换后原生 option 已变化；若自定义菜单已存在，必须同时重建，避免显示上一个领域的旧图标。
        if (select.closest('.select-shell')) rebuildStyledSelect(select);
        syncStyledSelects();

        // 使用属性赋值避免重复进入步骤 4 时叠加事件监听。
        select.onchange = function() {
            if (this.value === 'custom') {
                appState.config.iconSetId = 'custom';
                return;
            }
            applyIconSet(this.value);
        };
        if (shuffleButton) {
            shuffleButton.onclick = function() {
                applyRandomIconSet(true);
            };
        }
    }

    // 保留原生 select 作为数据源，用自定义菜单统一各工作流的展开样式。
    function getStyledSelectAccessibleLabel(select) {
        var explicitLabel = select.getAttribute('aria-label');
        if (explicitLabel) return explicitLabel;
        var labels = select.labels;
        if (labels && labels.length) {
            var clone = labels[0].cloneNode(true);
            clone.querySelectorAll('select, .select-shell').forEach(function(control) { control.remove(); });
            var labelText = clone.textContent.replace(/\s+/g, ' ').trim();
            if (labelText) return labelText;
        }
        return '选择选项';
    }

    function syncStyledSelects() {
        document.querySelectorAll('select.select-native').forEach(function(select) {
            var control = select._styledSelectControl;
            if (!control) return;
            var selected = select.options[select.selectedIndex];
            var selectedText = selected ? selected.textContent.trim() : '请选择';
            control.trigger.textContent = selectedText;
            control.trigger.title = selectedText;
            control.trigger.disabled = !!select.disabled;
            control.trigger.setAttribute('aria-disabled', select.disabled ? 'true' : 'false');
            var accessibleLabel = getStyledSelectAccessibleLabel(select);
            control.trigger.setAttribute('aria-label', accessibleLabel);
            control.menu.setAttribute('aria-label', accessibleLabel);
            control.menu.querySelectorAll('.select-option').forEach(function(optionButton) {
                var active = optionButton.dataset.value === select.value;
                optionButton.classList.toggle('selected', active);
                optionButton.setAttribute('aria-selected', active ? 'true' : 'false');
            });
        });
    }

    function getCategoryPickerMenu(picker) {
        return picker && (picker._floatingCategoryMenu || picker.querySelector('.cat-icon-menu'));
    }

    function renderBatchFieldMapping() {
        var container = document.getElementById('mapping-container');
        if (!container) return;
        var sites = appState.batchAdBuild.sites || [];
        container.innerHTML = '<div class="batch-field-mapping"><div class="batch-field-mapping-head"><div><span class="section-kicker">每站独立映射</span><h4>逐站确认必填字段</h4></div><span>模板、样式与字段映射均逐站独立</span></div>' + sites.map(function(site, siteIndex) {
            var theme = THEMES[site.themeId];
            var profile = DOMAIN_CATALOG[site.themeId];
            if (!theme) {
                return '<section class="batch-field-site is-invalid"><header><div><strong>' + escapeHtml(site.fileName) + '</strong><span>' + site.data.length + ' 条数据</span></div><em>尚未确认领域</em></header></section>';
            }
            var rows = theme.fields.map(function(field) {
                var options = '<option value="">-- 不匹配 --</option>' + site.jsonFields.map(function(jsonField) {
                    var selected = site.fieldMapping[field.id] === jsonField.name ? ' selected' : '';
                    return '<option value="' + escapeHtml(jsonField.name) + '"' + selected + '>' + escapeHtml(jsonField.name) + ' (' + escapeHtml(jsonField.type) + ')</option>';
                }).join('');
                return '<label class="batch-field-row ' + (field.required ? 'is-required' : '') + '"><span><strong>' + escapeHtml(field.labelZh) + '</strong><small>' + escapeHtml(field.label) + (field.required ? ' · 必填' : '') + '</small></span><select data-batch-site-index="' + siteIndex + '" data-batch-theme-field="' + escapeHtml(field.id) + '">' + options + '</select></label>';
            }).join('');
            var missing = batchSiteIssues(site);
            return '<section class="batch-field-site ' + (missing.length ? 'is-invalid' : 'is-valid') + '"><header><div><strong>' + escapeHtml(site.fileName) + '</strong><span>' + (profile ? profile.label + ' · ' : '') + site.data.length + ' 条数据</span></div><em>' + (missing.length ? '还缺 ' + missing.length + ' 项必填字段' : '必填字段已完成') + '</em></header><div class="batch-field-rows">' + rows + '</div></section>';
        }).join('') + '</div>';
        container.querySelectorAll('[data-batch-site-index]').forEach(function(select) {
            select.addEventListener('change', function() {
                var site = sites[Number(select.dataset.batchSiteIndex)];
                if (!site) return;
                if (select.value) site.fieldMapping[select.dataset.batchThemeField] = select.value;
                else delete site.fieldMapping[select.dataset.batchThemeField];
                if (site === getActiveBatchSite()) appState.fieldMapping = site.fieldMapping;
                renderBatchFieldMapping();
                renderBatchDataList();
                if (site === getActiveBatchSite() && appState.currentStep === 4) updatePreview();
            });
        });
    }

    function getCategoryPickerForMenu(menu) {
        return menu && (menu._categoryPickerOwner || menu.closest('.cat-icon-picker'));
    }

    function positionCategoryPickerMenu(picker) {
        var menu = getCategoryPickerMenu(picker);
        var trigger = picker && picker.querySelector('.cat-icon-trigger');
        if (!menu || !trigger || menu._categoryPickerOwner !== picker) return;
        var triggerRect = trigger.getBoundingClientRect();
        var margin = 8;
        var menuWidth = menu.offsetWidth || 220;
        var menuHeight = menu.offsetHeight || 0;
        var left = Math.max(margin, Math.min(triggerRect.left - 4, window.innerWidth - menuWidth - margin));
        var top = triggerRect.bottom + 7;
        if (menuHeight && top + menuHeight > window.innerHeight - margin && triggerRect.top - menuHeight - 7 >= margin) {
            top = triggerRect.top - menuHeight - 7;
        }
        menu.style.left = Math.round(left) + 'px';
        menu.style.top = Math.round(top) + 'px';
    }

    function moveCategoryPickerMenuToPortal(picker) {
        var menu = getCategoryPickerMenu(picker);
        if (!menu || menu._categoryPickerOwner === picker) {
            positionCategoryPickerMenu(picker);
            return;
        }
        menu._categoryPickerOwner = picker;
        picker._floatingCategoryMenu = menu;
        menu.classList.add('is-portal-open');
        document.body.appendChild(menu);
        positionCategoryPickerMenu(picker);
    }

    function restoreCategoryPickerMenu(picker) {
        var menu = getCategoryPickerMenu(picker);
        if (!menu || menu._categoryPickerOwner !== picker) return;
        menu.classList.remove('is-portal-open');
        menu.style.removeProperty('left');
        menu.style.removeProperty('top');
        picker.appendChild(menu);
        delete menu._categoryPickerOwner;
        delete picker._floatingCategoryMenu;
    }

    function setCategoryPickerOpenState(picker, isOpen) {
        if (!picker) return;
        if (!isOpen) restoreCategoryPickerMenu(picker);
        picker.classList.toggle('open', isOpen);
        var row = picker.closest('.category-config-item');
        if (row) row.classList.toggle('picker-open-row', isOpen);
        var configGroup = picker.closest('.config-group');
        if (configGroup) configGroup.classList.toggle('picker-open-group', isOpen);
    }

    function repositionOpenCategoryPickerMenus() {
        document.querySelectorAll('.cat-icon-picker.open').forEach(positionCategoryPickerMenu);
    }

    function getOpenStyledDropdownInteractionElements() {
        return Array.from(document.querySelectorAll('.select-shell.open, .select-menu.is-open, .cat-icon-picker.open, .cat-icon-menu.is-portal-open'));
    }

    function isStyledDropdownInteraction(event) {
        var guards = window.SiteFoundryDropdownEventGuards;
        return !!(guards && guards.isInteractionWithinAny(event, getOpenStyledDropdownInteractionElements()));
    }

    function isStyledDropdownScroll(event) {
        var guards = window.SiteFoundryDropdownEventGuards;
        if (!guards) return false;
        var menus = document.querySelectorAll('.select-menu.is-open, .cat-icon-picker.open .cat-icon-menu, .cat-icon-menu.is-portal-open');
        return guards.isScrollWithinAny(event, menus);
    }

    function closeStyledSelectsOnOutsideClick(event) {
        if (isStyledDropdownInteraction(event)) return;
        closeStyledSelects();
    }

    function closeStyledSelectsOnPageScroll(event) {
        if (isStyledDropdownScroll(event)) return;
        closeStyledSelects();
    }

    function closeCategoryPickersOnOutsideClick(event) {
        var guards = window.SiteFoundryDropdownEventGuards;
        var openPickers = document.querySelectorAll('.cat-icon-picker.open, .cat-icon-menu.is-portal-open');
        if (guards && guards.isInteractionWithinAny(event, openPickers)) return;
        closeCategoryIconPickers();
    }

    function closeStyledSelects() {
        closeCategoryIconPickers();
        document.querySelectorAll('.select-shell.open').forEach(function(shell) {
            shell.classList.remove('open');
            var configItem = shell.closest('.config-item');
            if (configItem) configItem.classList.remove('select-open');
            var configGroup = shell.closest('.config-group');
            if (configGroup) configGroup.classList.remove('select-open-group');
            var select = shell.querySelector('select.select-native');
            var control = select && select._styledSelectControl;
            if (control) {
                control.menu.classList.remove('is-open');
                control.trigger.setAttribute('aria-expanded', 'false');
            }
        });
    }

    function closeCategoryIconPickers(exceptPicker) {
        document.querySelectorAll('.cat-icon-picker.open').forEach(function(picker) {
            if (picker === exceptPicker) return;
            setCategoryPickerOpenState(picker, false);
            var trigger = picker.querySelector('.cat-icon-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
        });
    }

    function positionStyledSelectMenu(select) {
        var control = select && select._styledSelectControl;
        if (!control) return;
        var rect = control.trigger.getBoundingClientRect();
        var maxHeight = control.maxHeight || 245;
        var preferredWidth = select.classList.contains('batch-ad-code-select') ? Math.max(rect.width, 340) : rect.width;
        var menuWidth = Math.min(preferredWidth, Math.max(0, window.innerWidth - 24));
        var menuLeft = Math.max(12, Math.min(rect.left, window.innerWidth - menuWidth - 12));

        // 先应用最终宽度，再测量内容高度，确保长选项换行后的高度被完整计算。
        control.menu.style.left = Math.round(menuLeft) + 'px';
        control.menu.style.width = Math.round(menuWidth) + 'px';
        var naturalHeight = control.menu.scrollHeight;
        var topBelow = rect.bottom + 6;
        var spaceBelow = window.innerHeight - topBelow - 12;
        var spaceAbove = rect.top - 18;
        var openAbove = spaceBelow < Math.min(150, naturalHeight) && spaceAbove > spaceBelow;
        var availableSpace = openAbove ? spaceAbove : spaceBelow;
        var visibleHeight = Math.min(naturalHeight, maxHeight, Math.max(0, availableSpace));
        var menuTop = openAbove ? Math.max(12, rect.top - visibleHeight - 6) : topBelow;
        control.menu.style.top = Math.round(menuTop) + 'px';
        control.menu.style.maxHeight = Math.max(0, Math.round(visibleHeight)) + 'px';
    }

    function focusStyledSelectOption(select, direction) {
        var control = select && select._styledSelectControl;
        if (!control) return;
        var options = Array.from(control.menu.querySelectorAll('.select-option:not(:disabled)'));
        if (!options.length) return;
        var activeIndex = options.indexOf(document.activeElement);
        var selectedIndex = options.findIndex(function(option) { return option.dataset.value === select.value; });
        var nextIndex = activeIndex >= 0
            ? activeIndex + direction
            : selectedIndex >= 0 ? selectedIndex : (direction > 0 ? 0 : options.length - 1);
        nextIndex = (nextIndex + options.length) % options.length;
        options[nextIndex].focus();
    }

    function releaseStyledSelect(select) {
        if (!select || select.isConnected) return;
        var control = select._styledSelectControl;
        if (!control) return;
        if (control.menu.parentNode) control.menu.remove();
        if (control.changeHandler) select.removeEventListener('change', control.changeHandler);
        select.classList.remove('select-native');
        if (control.originalTabIndex === null) select.removeAttribute('tabindex');
        else select.setAttribute('tabindex', control.originalTabIndex);
        if (control.originalAriaHidden === null) select.removeAttribute('aria-hidden');
        else select.setAttribute('aria-hidden', control.originalAriaHidden);
        delete select._styledSelectControl;
    }

    function rebuildStyledSelect(select) {
        if (!select || select.multiple || select.size > 1) return;
        var control = select._styledSelectControl;
        if (!control) {
            var shell = select.closest('.select-shell');
            if (!shell) {
                shell = document.createElement('div');
                shell.className = 'select-shell';
                select.parentNode.insertBefore(shell, select);
                shell.appendChild(select);
            }

            if (!select.id) {
                appState._styledSelectSequence = (appState._styledSelectSequence || 0) + 1;
                select.id = 'workflow-select-' + appState._styledSelectSequence;
            }
            var trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.className = 'select-trigger';
            trigger.setAttribute('aria-haspopup', 'listbox');
            trigger.setAttribute('aria-expanded', 'false');
            trigger.setAttribute('aria-controls', 'styled-select-menu-' + select.id);
            trigger.setAttribute('aria-label', getStyledSelectAccessibleLabel(select));

            var menu = document.createElement('div');
            menu.id = 'styled-select-menu-' + select.id;
            menu.className = 'select-menu';
            menu.setAttribute('role', 'listbox');
            menu.setAttribute('aria-label', getStyledSelectAccessibleLabel(select));
            var injectionSiteSelect = shell.closest('.injection-site-select');
            if (injectionSiteSelect) menu.classList.add('injection-site-select-menu');
            if (select.classList.contains('batch-ad-code-select')) menu.classList.add('batch-ad-code-select-menu');
            document.body.appendChild(menu);
            shell.appendChild(trigger);

            var originalTabIndex = select.getAttribute('tabindex');
            var originalAriaHidden = select.getAttribute('aria-hidden');
            select.classList.add('select-native');
            select.tabIndex = -1;
            select.setAttribute('aria-hidden', 'true');
            control = {
                shell: shell,
                trigger: trigger,
                menu: menu,
                maxHeight: injectionSiteSelect ? 210 : 245,
                originalTabIndex: originalTabIndex,
                originalAriaHidden: originalAriaHidden
            };
            select._styledSelectControl = control;

            trigger.addEventListener('click', function(event) {
                event.stopPropagation();
                if (trigger.disabled) return;
                var willOpen = !shell.classList.contains('open');
                closeStyledSelects();
                shell.classList.toggle('open', willOpen);
                var configItem = shell.closest('.config-item');
                if (configItem) configItem.classList.toggle('select-open', willOpen);
                var configGroup = shell.closest('.config-group');
                if (configGroup) configGroup.classList.toggle('select-open-group', willOpen);
                trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
                menu.classList.toggle('is-open', willOpen);
                if (willOpen) positionStyledSelectMenu(select);
            });
            trigger.addEventListener('keydown', function(event) {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    if (!shell.classList.contains('open')) trigger.click();
                    focusStyledSelectOption(select, event.key === 'ArrowDown' ? 1 : -1);
                } else if (event.key === 'Escape' && shell.classList.contains('open')) {
                    event.preventDefault();
                    closeStyledSelects();
                } else if (event.key === 'Tab' && shell.classList.contains('open')) {
                    closeStyledSelects();
                }
            });
            menu.addEventListener('keydown', function(event) {
                if (event.key === 'Tab') closeStyledSelects();
            });
            control.changeHandler = syncStyledSelects;
            select.addEventListener('change', control.changeHandler);
        }

        var menu = control.menu;
        menu.innerHTML = '';
        var addOption = function(option) {
            var optionButton = document.createElement('button');
            optionButton.type = 'button';
            optionButton.className = 'select-option';
            optionButton.dataset.value = option.value;
            optionButton.textContent = option.textContent.trim();
            optionButton.title = option.title || optionButton.textContent;
            optionButton.setAttribute('role', 'option');
            optionButton.setAttribute('aria-label', option.title || optionButton.textContent);
            optionButton.setAttribute('aria-selected', 'false');
            optionButton.disabled = !!option.disabled || !!(option.parentElement && option.parentElement.disabled);
            optionButton.addEventListener('click', function(event) {
                event.stopPropagation();
                if (optionButton.disabled) return;
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                closeStyledSelects();
                control.trigger.focus();
            });
            optionButton.addEventListener('keydown', function(event) {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    focusStyledSelectOption(select, event.key === 'ArrowDown' ? 1 : -1);
                } else if (event.key === 'Home' || event.key === 'End') {
                    event.preventDefault();
                    var options = menu.querySelectorAll('.select-option:not(:disabled)');
                    if (options.length) options[event.key === 'Home' ? 0 : options.length - 1].focus();
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    closeStyledSelects();
                    control.trigger.focus();
                }
            });
            menu.appendChild(optionButton);
        };

        Array.from(select.children).forEach(function(child) {
            if (child.tagName === 'OPTGROUP') {
                var groupLabel = document.createElement('div');
                groupLabel.className = 'select-menu-label';
                groupLabel.textContent = child.label;
                menu.appendChild(groupLabel);
                Array.from(child.children).forEach(addOption);
            } else if (child.tagName === 'OPTION') {
                addOption(child);
            }
        });
        syncStyledSelects();
    }

    function initStyledSelects() {
        document.querySelectorAll('select:not([multiple])').forEach(rebuildStyledSelect);

        if (!appState._styledSelectDocumentBound) {
            document.addEventListener('click', closeStyledSelectsOnOutsideClick);
            window.addEventListener('resize', closeStyledSelects);
            window.addEventListener('scroll', closeStyledSelectsOnPageScroll, true);
            appState._styledSelectMutationObserver = new MutationObserver(function(records) {
                var changedSelects = new Set();
                records.forEach(function(record) {
                    var target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
                    var targetSelect = target && target.closest && target.closest('select.select-native');
                    if (targetSelect) changedSelects.add(targetSelect);
                    Array.from(record.addedNodes).forEach(function(node) {
                        if (node.nodeType !== 1) return;
                        if (node.matches && node.matches('select:not([multiple])')) changedSelects.add(node);
                        node.querySelectorAll('select:not([multiple])').forEach(function(select) { changedSelects.add(select); });
                    });
                    Array.from(record.removedNodes).forEach(function(node) {
                        if (node.nodeType !== 1) return;
                        if (node.matches && node.matches('select.select-native')) releaseStyledSelect(node);
                        node.querySelectorAll('select.select-native').forEach(releaseStyledSelect);
                    });
                });
                changedSelects.forEach(function(select) {
                    if (select.isConnected && !select.multiple && select.size <= 1) rebuildStyledSelect(select);
                });
            });
            appState._styledSelectMutationObserver.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: ['disabled', 'selected', 'aria-label']
            });
            appState._styledSelectDocumentBound = true;
        }
        syncStyledSelects();
    }

    function updateCategoryConfig(count) {
        var theme = EditorialTemplateVersions.theme(appState);
        var container = document.getElementById('categories-config');
        closeCategoryIconPickers();
        var currentCats = appState.config.categories || theme.categories;
        // 分类排版属于分类本身；仅八套独立资讯模板展示编辑入口。
        // 切到旧模板时保留设置，切回来后仍可继续编辑。
        var packageRecord = typeof TemplateRegistry !== 'undefined' && TemplateRegistry.get(appState.config.templateId);
        var supportsCategoryLayouts = packageRecord && packageRecord.manifest.schemaVersion === 2;

        // 调整分类数量
        while (currentCats.length < count) {
            var iconPool = theme.iconPool || ['📌'];
            var activeSet = getIconSetById(appState.config.iconSetId);
            var nextIcon = activeSet && activeSet.icons[currentCats.length] ? activeSet.icons[currentCats.length] : iconPool[currentCats.length % iconPool.length];
            currentCats.push({ name: 'Category ' + (currentCats.length + 1), icon: nextIcon, count: 6 });
        }
        appState.config.categories = currentCats.slice(0, count);

        var html = '';
        appState.config.categories.forEach(function(cat, i) {
            cat.icon = getCompatibleCategoryEmoji(cat.icon || '📌');
            var iconPool = theme.iconPool || [cat.icon || '📌'];
            var pickerIcons = getCategoryIconPickerChoices(iconPool, cat.icon, cat.name, appState.selectedTheme);
            html += '<div class="category-config-item' + (supportsCategoryLayouts ? ' category-config-custom-layout' : '') + '">';
            html += '<div class="cat-icon-picker" data-cat-idx="' + i + '">';
            html += '<button type="button" class="cat-icon-trigger" title="当前领域图标优先，也可选择全部 Emoji" aria-label="选择第' + (i + 1) + '个分类图标（当前领域图标优先，可选择全部 Emoji）" aria-expanded="false" data-cat-idx="' + i + '">' + (cat.icon || '📌') + '</button>';
            html += '<div class="cat-icon-menu" role="listbox" aria-label="分类图标选项：当前领域优先，包含全部 Emoji">';
            pickerIcons.forEach(function(icon) {
                var safeIcon = String(icon).replace(/"/g, '&quot;');
                html += '<button type="button" class="cat-icon-option' + (cat.icon === icon ? ' selected' : '') + '" role="option" aria-label="使用图标 ' + safeIcon + '" aria-selected="' + (cat.icon === icon ? 'true' : 'false') + '" data-icon="' + safeIcon + '" data-cat-idx="' + i + '">' + icon + '</button>';
            });
            html += '</div></div>';
            html += '<input type="text" class="cat-name-input" value="' + cat.name + '" data-cat-idx="' + i + '" data-cat-field="name">';
            html += '<input type="number" class="cat-count-input" value="' + cat.count + '" min="1" max="20" data-cat-idx="' + i + '" data-cat-field="count">';
            if (supportsCategoryLayouts) html += renderCategoryLayoutControls(cat, i);
            html += '</div>';
        });
        container.innerHTML = html;
        if (supportsCategoryLayouts) bindCategoryLayoutControls(container, appState.config.categories, updatePreview);

        // 文本和数量字段
        container.querySelectorAll('input').forEach(function(input) {
            function commitCategoryInput() {
                var idx = parseInt(this.dataset.catIdx);
                var field = this.dataset.catField;
                if (field === 'count') {
                    var normalizedCount = Math.max(1, Math.min(20, parseInt(this.value, 10) || 1));
                    this.value = normalizedCount;
                    appState.config.categories[idx][field] = normalizedCount;
                } else {
                    appState.config.categories[idx][field] = this.value;
                    // 分类改名后重建语义候选；预设图标跟随新名称，自定义图标则保留用户选择。
                    var iconSetId = appState.config.iconSetId;
                    if (iconSetId && iconSetId !== 'custom') applyIconSet(iconSetId, false);
                    updateCategoryConfig(appState.config.categories.length);
                }
                updatePreview();
            }
            // 数量必须在键入时立即进入站点配置，不能等失焦后才写入，否则用户
            // 直接点“下一步/导出”时可能仍打包旧数量。名称继续在 change 时提交，
            // 避免输入过程中重建整行导致光标丢失。
            if (input.dataset.catField === 'count') input.addEventListener('input', commitCategoryInput);
            input.addEventListener('change', commitCategoryInput);
        });

        // 紧凑图标面板，避免原生下拉菜单撑开左栏
        container.querySelectorAll('.cat-icon-trigger').forEach(function(trigger) {
            trigger.addEventListener('click', function(event) {
                event.stopPropagation();
                var picker = this.closest('.cat-icon-picker');
                var willOpen = !picker.classList.contains('open');
                closeStyledSelects();
                closeCategoryIconPickers(picker);
                setCategoryPickerOpenState(picker, willOpen);
                if (willOpen) moveCategoryPickerMenuToPortal(picker);
                this.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
            });
        });
        container.querySelectorAll('.cat-icon-option').forEach(function(option) {
            option.addEventListener('click', function(event) {
                event.stopPropagation();
                var idx = parseInt(this.dataset.catIdx);
                var menu = this.closest('.cat-icon-menu');
                var picker = getCategoryPickerForMenu(menu);
                var icon = this.dataset.icon;
                if (!picker) return;
                appState.config.categories[idx].icon = icon;
                appState.config.iconSetId = 'custom';
                picker.querySelector('.cat-icon-trigger').textContent = icon;
                menu.querySelectorAll('.cat-icon-option').forEach(function(item) {
                    var selected = item === option;
                    item.classList.toggle('selected', selected);
                    item.setAttribute('aria-selected', selected ? 'true' : 'false');
                });
                setCategoryPickerOpenState(picker, false);
                picker.querySelector('.cat-icon-trigger').setAttribute('aria-expanded', 'false');
                var iconSetSelect = document.getElementById('icon-set-select');
                if (iconSetSelect) iconSetSelect.value = 'custom';
                updatePreview();
            });
        });
        if (!appState._iconPickerDocumentBound) {
            document.addEventListener('click', closeCategoryPickersOnOutsideClick);
            document.addEventListener('scroll', repositionOpenCategoryPickerMenus, true);
            window.addEventListener('resize', repositionOpenCategoryPickerMenus);
            appState._iconPickerDocumentBound = true;
        }
    }

    function bindConfigEvents() {
        ConfigurationControls.bind(function() { return appState.config; });
        // User motion preferences are independent of template defaults.
        if (typeof SiteMotion !== 'undefined') SiteMotion.bindControls(function() { return appState.config; }, updatePreview);
        // 通用配置项绑定
        var configMap = {
            'contact-email': 'contactEmail',
            'navbar-layout': 'navbarLayout',
            'footer-style': 'footerStyle',
            'back-link-style': 'backLinkStyle',
            'card-columns': 'cardColumns',
            'meta-layout': 'metaLayout',
            'content-render': 'contentRender',
            'action-btn-link-field': 'actionButtonLinkField',
            'navbar-style': 'navbarStyle',
            'navbar-height': 'navbarHeight',
            'logo-style': 'logoStyle',
            'card-hover': 'cardHover',
            'card-border': 'cardBorder',
            'card-radius': 'cardRadius',
            'card-spacing': 'cardSpacing',
            'card-excerpt-lines': 'cardExcerptLines',
            'btn-style': 'btnStyle',
            'btn-size': 'btnSize',
            'grid-gap': 'gridGap',
            'font-style': 'fontStyle',
            'animation-enter': 'animationEnter',
            'transition-speed': 'transitionSpeed',
            'meta-bg': 'metaBg',
            'detail-img-style': 'detailImgStyle',
            'category-title-style': 'categoryTitleStyle',
            'category-title-align': 'categoryTitleAlign',
            'card-image-height': 'cardImageHeight',
            'content-max-width': 'contentMaxWidth',
            'hero-style': 'heroStyle',
            'detail-layout': 'detailLayout',
            'card-view-mode': 'cardViewMode',
            'privacy-length': 'privacyLength',
            'terms-length': 'termsLength'
        };

        Object.keys(configMap).forEach(function(elemId) {
            var elem = document.getElementById(elemId);
            if (elem) {
                elem.addEventListener(elem.tagName === 'SELECT' ? 'change' : 'input', function() {
                    appState.config[configMap[elemId]] = this.value;
                    updatePreview();
                });
            }
        });

        // 操作按钮
        var actionBtnToggle = document.getElementById('action-btn-enabled');
        var actionBtnConfig = document.getElementById('action-btn-config');
        actionBtnToggle.addEventListener('change', function() {
            appState.config.actionButtonEnabled = this.checked;
            actionBtnConfig.style.display = this.checked ? 'block' : 'none';
            updatePreview();
        });
        document.getElementById('action-btn-text').addEventListener('input', function() {
            appState.config.actionButtonText = this.value;
            updatePreview();
        });

        // 相关推荐数量
        var relatedSlider = document.getElementById('related-count');
        var relatedValue = document.getElementById('related-count-value');
        relatedSlider.addEventListener('input', function() {
            relatedValue.textContent = this.value;
            appState.config.relatedCount = parseInt(this.value);
            updatePreview();
        });

        // 图标显隐只更新显示偏好，保留每个分类已有的图标选择。
        document.getElementById('category-icons-enabled').addEventListener('change', function() {
            appState.config.categoryIconsEnabled = this.checked;
            updatePreview();
        });

        // 批量编辑时 appState.config 引用当前站点配置，导出沿用同一字段。
        document.getElementById('category-numbers-enabled').addEventListener('change', function() {
            appState.config.categoryNumbersEnabled = this.checked;
            updatePreview();
        });

        // 关于我们
        document.getElementById('about-enabled').addEventListener('change', function() {
            appState.config.aboutEnabled = this.checked;
            if (!this.checked) {
                var aboutFooterLink = document.querySelector('#footer-links-config input[value="about"]');
                if (aboutFooterLink) aboutFooterLink.checked = false;
                appState.config.footerLinks = (appState.config.footerLinks || []).filter(function(link) {
                    return link !== 'about';
                });
            }
            updatePreview();
        });

        // 页脚链接
        document.querySelectorAll('#footer-links-config input[type="checkbox"]').forEach(function(cb) {
            cb.addEventListener('change', function() {
                appState.config.footerLinks = [];
                document.querySelectorAll('#footer-links-config input[type="checkbox"]:checked').forEach(function(c) {
                    appState.config.footerLinks.push(c.value);
                });
                updatePreview();
            });
        });

        // 联系表单字段
        document.querySelectorAll('#contact-fields-config input[type="checkbox"]').forEach(function(cb) {
            cb.addEventListener('change', function() {
                appState.config.contactFields = [];
                document.querySelectorAll('#contact-fields-config input[type="checkbox"]:checked').forEach(function(c) {
                    appState.config.contactFields.push(c.value);
                });
            });
        });

        // 卡片展示字段
        updateCardFieldsConfig();

        // 推荐卡片展示字段
        updateRelatedCardFieldsConfig();

        // 设置初始值
        setInitialConfigValues();
        syncAllArticlesUI();
        initStyledSelects();
    }

    function updateCardFieldsConfig() {
        var theme = EditorialTemplateVersions.theme(appState);
        var container = document.getElementById('card-fields-config');
        var html = '';
        theme.fields.forEach(function(f) {
            if (f.id === 'id') return;
            var checked = appState.config.cardFields.indexOf(f.id) !== -1 ? ' checked' : '';
            html += '<label class="checkbox-label"><input type="checkbox" value="' + escapeHtml(f.id) + '"' + checked + '> <span>' + escapeHtml(f.labelZh) + '</span></label>';
        });
        container.innerHTML = html;
        bindFieldPicker(container, 'cardFields', 'card-fields-count', true);
    }

    function updateRelatedCardFieldsConfig() {
        var theme = EditorialTemplateVersions.theme(appState);
        var container = document.getElementById('related-card-fields-config');
        var html = '';
        theme.fields.forEach(function(f) {
            if (f.id === 'id' || f.id === 'content') return;
            var checked = appState.config.relatedCardFields.indexOf(f.id) !== -1 ? ' checked' : '';
            html += '<label class="checkbox-label"><input type="checkbox" value="' + escapeHtml(f.id) + '"' + checked + '> <span>' + escapeHtml(f.labelZh) + '</span></label>';
        });
        container.innerHTML = html;

        bindFieldPicker(container, 'relatedCardFields', 'related-card-fields-count', false);
    }

    function bindFieldPicker(container, stateKey, countId, shouldUpdatePreview) {
        if (!container) return;

        var picker = container.closest('.field-picker');
        var count = document.getElementById(countId);
        var inputs = Array.prototype.slice.call(container.querySelectorAll('input[type="checkbox"]'));

        function commitSelection(skipPreview) {
            appState.config[stateKey] = inputs.filter(function(input) {
                return input.checked;
            }).map(function(input) {
                return input.value;
            });

            inputs.forEach(function(input) {
                input.closest('.checkbox-label').classList.toggle('is-selected', input.checked);
            });

            if (count) count.textContent = '已选 ' + appState.config[stateKey].length + '/' + inputs.length;
            if (shouldUpdatePreview && !skipPreview) updatePreview();
        }

        inputs.forEach(function(input) {
            input.addEventListener('change', function() { commitSelection(false); });
        });

        if (picker) {
            var selectAll = picker.querySelector('[data-action="select-all"]');
            var clearAll = picker.querySelector('[data-action="clear-all"]');

            if (selectAll) selectAll.onclick = function() {
                inputs.forEach(function(input) { input.checked = true; });
                commitSelection(false);
            };

            if (clearAll) clearAll.onclick = function() {
                inputs.forEach(function(input) { input.checked = false; });
                commitSelection(false);
            };
        }

        commitSelection(true);
    }

    function initFontOptions() {
        var select = document.getElementById('font-style');
        if (!select || typeof FONT_PRESETS === 'undefined') return;

        var categories = [];
        var grouped = {};
        FONT_PRESETS.forEach(function(font) {
            var category = font.category || '其他';
            if (!grouped[category]) {
                grouped[category] = [];
                categories.push(category);
            }
            grouped[category].push(font);
        });

        var html = '';
        categories.forEach(function(category) {
            html += '<optgroup label="' + category + '">';
            grouped[category].forEach(function(font) {
                html += '<option value="' + font.id + '">' + font.name + '</option>';
            });
            html += '</optgroup>';
        });
        select.innerHTML = html;
    }

    function setInitialConfigValues() {
        var c = appState.config;
        var theme = EditorialTemplateVersions.theme(appState);

        // 设置select的初始值
        if (c.navbarLayout) document.getElementById('navbar-layout').value = c.navbarLayout;
        if (c.footerStyle) document.getElementById('footer-style').value = c.footerStyle;
        if (c.backLinkStyle) document.getElementById('back-link-style').value = c.backLinkStyle;
        if (c.cardColumns) document.getElementById('card-columns').value = c.cardColumns;
        if (c.metaLayout) document.getElementById('meta-layout').value = c.metaLayout;
        if (c.contentRender) document.getElementById('content-render').value = c.contentRender;
        if (c.navbarStyle) document.getElementById('navbar-style').value = c.navbarStyle;
        if (c.navbarHeight) document.getElementById('navbar-height').value = c.navbarHeight;
        if (c.logoStyle) document.getElementById('logo-style').value = c.logoStyle;
        if (c.cardHover) document.getElementById('card-hover').value = c.cardHover;
        if (c.cardBorder) document.getElementById('card-border').value = c.cardBorder;
        if (c.cardRadius) document.getElementById('card-radius').value = c.cardRadius;
        if (c.cardSpacing) document.getElementById('card-spacing').value = c.cardSpacing;
        if (c.cardExcerptLines) document.getElementById('card-excerpt-lines').value = c.cardExcerptLines;
        if (c.btnStyle) document.getElementById('btn-style').value = c.btnStyle;
        if (c.btnSize) document.getElementById('btn-size').value = c.btnSize;
        if (c.gridGap) document.getElementById('grid-gap').value = c.gridGap;
        if (c.fontStyle) document.getElementById('font-style').value = c.fontStyle;
        if (c.animationEnter) document.getElementById('animation-enter').value = c.animationEnter;
        if (c.transitionSpeed) document.getElementById('transition-speed').value = c.transitionSpeed;
        if (c.metaBg) document.getElementById('meta-bg').value = c.metaBg;
        if (c.detailImgStyle) document.getElementById('detail-img-style').value = c.detailImgStyle;
        document.getElementById('category-icons-enabled').checked = c.categoryIconsEnabled !== false;
        document.getElementById('category-numbers-enabled').checked = c.categoryNumbersEnabled === true;
        if (c.categoryTitleStyle) document.getElementById('category-title-style').value = c.categoryTitleStyle;
        if (c.categoryTitleAlign) document.getElementById('category-title-align').value = c.categoryTitleAlign;
        if (c.cardImageHeight) document.getElementById('card-image-height').value = c.cardImageHeight;
        if (c.contentMaxWidth) document.getElementById('content-max-width').value = c.contentMaxWidth;
        if (c.heroStyle) document.getElementById('hero-style').value = c.heroStyle;
        if (c.detailLayout) document.getElementById('detail-layout').value = c.detailLayout;
        if (c.cardViewMode) document.getElementById('card-view-mode').value = c.cardViewMode;
        if (c.privacyLength) document.getElementById('privacy-length').value = c.privacyLength;
        if (c.termsLength) document.getElementById('terms-length').value = c.termsLength;
        var contactEmailInput = document.getElementById('contact-email');
        if (contactEmailInput) contactEmailInput.value = c.contactEmail || 'contact@your-domain.com';
        syncLogoIconPicker();

        // 开关
        document.getElementById('action-btn-enabled').checked = c.actionButtonEnabled;
        document.getElementById('about-enabled').checked = c.aboutEnabled !== false;
        document.getElementById('action-btn-text').value = c.actionButtonText || theme.detail.actionButton.text;
        document.getElementById('action-btn-config').style.display = c.actionButtonEnabled ? 'block' : 'none';

        // 分类数量
        document.getElementById('category-count').value = c.categories.length;
        document.getElementById('cat-count-value').textContent = c.categories.length;
    }

    // ========== 样式网格 ==========
    function initStyleGrid() {
        var grid = document.getElementById('style-grid');
        var count = document.getElementById('style-preset-count');
        var html = '';
        var presets = EditorialTemplateVersions.isLegacy(appState.config) && EditorialTemplateVersions.eligible(appState) ? LegacyEditorialTemplateSource.presets : STYLE_PRESETS;
        if (count) count.textContent = presets.length + ' 套';
        presets.forEach(function(preset) {
            var selected = appState.config.selectedStyle === preset.id ? ' selected' : '';
            html += '<div class="style-card' + selected + '" data-style-id="' + preset.id + '">';
            html += '<div class="style-preview" style="background:' + preset.previewBg + '"></div>';
            html += '<div class="style-name">' + preset.name + '</div>';
            html += '</div>';
        });
        grid.innerHTML = html;

        grid.querySelectorAll('.style-card').forEach(function(card) {
            card.addEventListener('click', function() {
                grid.querySelectorAll('.style-card').forEach(function(c) { c.classList.remove('selected'); });
                this.classList.add('selected');
                appState.config.selectedStyle = this.dataset.styleId;
                updatePreview();
            });
        });
    }

    // Template defaults belong to the batch; snapshots belong to each site.
    // Advertising defaults/overrides use their existing, independent path.
    function applyBatchEditorialVersion(site) {
        if (!site || !site.config || site.editorialTemplateOverrideEnabled) return;
        var previousConfig = site.config;
        var defaults = ensureBatchAdBuildState().editorialTemplateDefaults;
        site.config = EditorialTemplateVersions.switchVersion(site.config, defaults.version, site.themeId, createThemeConfig);
        if (defaults.version === 'legacy' && defaults.legacyThemeId && site.config.legacyThemeId !== defaults.legacyThemeId) {
            site.config = EditorialTemplateVersions.changeTheme(site.config, defaults.legacyThemeId);
        }
        if (site.config !== previousConfig) invalidateBatchSitePreviews([site]);
    }

    function syncEditorialTemplateScope() {
        var batch = isBatchAdBuild();
        var scope = document.getElementById('batch-editorial-template-scope');
        if (!scope) return;
        scope.hidden = !batch;
        var site = batch ? getActiveBatchSite() : null;
        document.getElementById('batch-editorial-template-override').checked = !!(site && site.editorialTemplateOverrideEnabled);
        document.getElementById('batch-editorial-template-scope-hint').textContent = site && site.editorialTemplateOverrideEnabled
            ? '正在编辑当前站点，其他站点的版本选择不变。' : '正在编辑整批默认版本；已开启单站覆盖的站点不受影响。';
    }

    function refreshEditorialTemplateUI() {
        if (isBatchAdBuild()) syncBatchActiveSiteToApp();
        initStyleGrid();
        initTemplateGrid();
        applyConfigToUI();
        setInitialConfigValues();
        document.querySelectorAll('#footer-links-config input').forEach(function(input) {
            input.checked = (appState.config.footerLinks || []).includes(input.value);
        });
        document.getElementById('related-count').value = appState.config.relatedCount || 4;
        document.getElementById('related-count-value').textContent = appState.config.relatedCount || 4;
        document.querySelectorAll('#contact-fields-config input').forEach(function(input) {
            input.checked = (appState.config.contactFields || []).includes(input.value);
        });
        syncStyledSelects();
        if (isBatchAdBuild()) renderBatchDataList();
        updatePreview();
    }

    function initEditorialTemplateVersionControls() {
        var picker = document.getElementById('editorial-template-version');
        var oldTheme = document.getElementById('editorial-legacy-theme');
        if (!picker.dataset.versionBound) {
            picker.dataset.versionBound = 'true';
            oldTheme.innerHTML = Object.keys(LegacyEditorialTemplateSource.themes).map(function(id) {
                return '<option value="' + id + '">' + LegacyEditorialTemplateSource.themes[id].name + '</option>';
            }).join('');
            picker.addEventListener('change', function() {
                var site = isBatchAdBuild() ? getActiveBatchSite() : null;
                if (site && !site.editorialTemplateOverrideEnabled) {
                    var batch = ensureBatchAdBuildState();
                    batch.editorialTemplateDefaults.version = this.value;
                    batch.sites.forEach(applyBatchEditorialVersion);
                } else {
                    appState.config = EditorialTemplateVersions.switchVersion(appState.config, this.value, appState.selectedTheme, createThemeConfig);
                    if (site) site.config = appState.config;
                }
                refreshEditorialTemplateUI();
            });
            oldTheme.addEventListener('change', function() {
                var site = isBatchAdBuild() ? getActiveBatchSite() : null;
                if (site && !site.editorialTemplateOverrideEnabled) {
                    var batch = ensureBatchAdBuildState();
                    batch.editorialTemplateDefaults.legacyThemeId = this.value;
                    batch.sites.forEach(applyBatchEditorialVersion);
                } else {
                    appState.config = EditorialTemplateVersions.changeTheme(appState.config, this.value);
                    if (site) site.config = appState.config;
                }
                refreshEditorialTemplateUI();
            });
            document.getElementById('batch-editorial-template-override').addEventListener('change', function() {
                var site = getActiveBatchSite();
                if (!site) return;
                site.editorialTemplateOverrideEnabled = this.checked;
                if (!this.checked) applyBatchEditorialVersion(site);
                refreshEditorialTemplateUI();
            });
            document.querySelectorAll('#editorial-legacy-nav-links input').forEach(function(input) {
                input.addEventListener('change', function() {
                    if (!EditorialTemplateVersions.isLegacy(appState.config)) return;
                    appState.config.navLinks = Array.from(document.querySelectorAll('#editorial-legacy-nav-links input:checked')).map(function(e) { return e.value; });
                    updatePreview();
                });
            });
        }
        EditorialTemplateVersions.syncControls(document, appState);
        syncEditorialTemplateScope();
    }

    // ========== 配置标签页 ==========
    function initConfigTabs() {
        var tabs = document.querySelectorAll('.config-tab');
        var sections = document.querySelectorAll('.config-section');

        tabs.forEach(function(tab) {
            tab.addEventListener('click', function() {
                document.body.classList.add('has-config-transition');
                tabs.forEach(function(t) { t.classList.remove('active'); });
                sections.forEach(function(s) { s.classList.remove('active'); });
                this.classList.add('active');
                document.getElementById('tab-' + this.dataset.tab).classList.add('active');
            });
        });
    }

    // ========== 预览控制 ==========
    function initPreviewControls() {
        if (!previewFrame || previewFrame.dataset.previewControlsReady === 'true') return;
        previewFrame.dataset.previewControlsReady = 'true';

        function applyPreviewSize(size) {
            var normalizedSize = ['desktop', 'tablet', 'mobile'].indexOf(size) !== -1 ? size : 'desktop';
            var configLayout = document.querySelector('.config-layout');
            previewFrame.className = 'preview-frame ' + normalizedSize;
            if (configLayout) {
                configLayout.dataset.previewSize = normalizedSize;
            }
        }

        function initFullscreenPreview() {
            var previewPanel = document.querySelector('#step-4 .preview-panel');
            var fullscreenButton = document.getElementById('preview-fullscreen-btn');
            var fullscreenStatus = document.getElementById('preview-fullscreen-status');
            if (!previewPanel || !fullscreenButton || fullscreenButton.dataset.fullscreenBound === 'true') return;
            fullscreenButton.dataset.fullscreenBound = 'true';
            var wasActive = false;

            function fullscreenElement() {
                return document.fullscreenElement || document.webkitFullscreenElement || null;
            }

            function isActive() {
                return fullscreenElement() === previewPanel || previewPanel.classList.contains('is-preview-fullscreen');
            }

            function syncFullscreenState() {
                var active = isActive();
                var fallbackActive = previewPanel.classList.contains('is-preview-fullscreen');
                var label = fullscreenButton.querySelector('.preview-fullscreen-label');
                fullscreenButton.classList.toggle('is-active', active);
                fullscreenButton.setAttribute('aria-pressed', active ? 'true' : 'false');
                fullscreenButton.setAttribute('aria-label', active ? '退出全屏预览' : '进入全屏预览');
                fullscreenButton.title = active ? '退出全屏预览（Esc）' : '全屏预览';
                if (label) label.textContent = active ? '退出' : '全屏';
                document.body.classList.toggle('preview-fullscreen-open', fallbackActive);
                if (fullscreenStatus && active !== wasActive) fullscreenStatus.textContent = active ? '已进入全屏预览，按 Esc 可退出。' : '已退出全屏预览。';
                if (!active && wasActive) setTimeout(function() { fullscreenButton.focus(); }, 0);
                wasActive = active;
            }

            function enterFallbackFullscreen() {
                previewPanel.classList.add('is-preview-fullscreen');
                syncFullscreenState();
            }

            function exitFallbackFullscreen() {
                previewPanel.classList.remove('is-preview-fullscreen');
                syncFullscreenState();
            }

            fullscreenButton.addEventListener('click', function() {
                if (isActive()) {
                    if (fullscreenElement() === previewPanel) {
                        var exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;
                        if (exitFullscreen) {
                            try { Promise.resolve(exitFullscreen.call(document)).catch(syncFullscreenState); }
                            catch (error) { syncFullscreenState(); }
                        }
                    } else {
                        exitFallbackFullscreen();
                    }
                    return;
                }
                var requestFullscreen = previewPanel.requestFullscreen || previewPanel.webkitRequestFullscreen;
                if (!requestFullscreen) {
                    enterFallbackFullscreen();
                    return;
                }
                try { Promise.resolve(requestFullscreen.call(previewPanel)).catch(enterFallbackFullscreen); }
                catch (error) { enterFallbackFullscreen(); }
            });
            document.addEventListener('fullscreenchange', syncFullscreenState);
            document.addEventListener('webkitfullscreenchange', syncFullscreenState);
            document.addEventListener('keydown', function(event) {
                if (event.key === 'Escape' && previewPanel.classList.contains('is-preview-fullscreen')) exitFallbackFullscreen();
            });
            syncFullscreenState();
        }

        initFullscreenPreview();

        var effectsButton = document.getElementById('preview-effects-toggle');
        var effectsStatus = document.getElementById('preview-effects-status');
        if (effectsButton && effectsButton.dataset.effectsBound !== 'true') {
            effectsButton.dataset.effectsBound = 'true';
            effectsButton.addEventListener('click', function() {
                if (!isAdInjectionWorkflow() || appState.currentStep !== 4) return;
                appState.adInjectionPreviewEffectsEnabled = !appState.adInjectionPreviewEffectsEnabled;
                syncAdInjectionPreviewEffectsControl();
                if (effectsStatus) effectsStatus.textContent = appState.adInjectionPreviewEffectsEnabled
                    ? '已打开 3D 与外部效果预览。预览页面将重新加载。'
                    : '已关闭 3D 与外部效果预览。预览页面将重新加载。';
                updateAdInjectionPreview();
            });
        }
        syncAdInjectionPreviewEffectsControl();

        // 页面切换
        document.querySelectorAll('.preview-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.preview-tab').forEach(function(t) { t.classList.remove('active'); });
                this.classList.add('active');
                updateAdPlacementUI();
                updatePreview(this.dataset.page);
            });
        });

        // 尺寸切换
        document.querySelectorAll('.size-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.size-btn').forEach(function(b) { b.classList.remove('active'); });
                this.classList.add('active');
                applyPreviewSize(this.dataset.size);
            });
        });

        var activeSizeButton = document.querySelector('.size-btn.active');
        applyPreviewSize(activeSizeButton ? activeSizeButton.dataset.size : 'desktop');

        // 监听iframe内的导航消息
        window.addEventListener('message', function(e) {
            if (e.source !== previewFrame.contentWindow) return;
            if (e.data && e.data.type === 'preview-nav') {
                var page = e.data.page;
                // Route and section state are separate; only a valid home anchor
                // is carried into the next preview document, never into exports.
                appState.previewHomeAnchor = page === 'home' && /^category-[a-z0-9-]+$/i.test(e.data.categoryAnchor || '')
                    ? e.data.categoryAnchor : '';
                if (page === 'detail' && Number.isInteger(e.data.itemIndex)) {
                    appState.previewDetailIndex = e.data.itemIndex;
                }
                if (page === 'section' && typeof e.data.categorySlug === 'string') {
                    appState.previewSectionSlug = e.data.categorySlug;
                }
                // 更新预览tab高亮
                document.querySelectorAll('.preview-tab').forEach(function(t) {
                    t.classList.remove('active');
                    if (t.dataset.page === page) t.classList.add('active');
                });
                updateAdPlacementUI();
                updatePreview(page);
            }
            // 广告放置消息
            if (e.data && e.data.type === 'ad-place' && appState.adPlacementMode) {
                var adId = appState.adPlacementMode;
                var position = e.data.position;
                var page = e.data.page || 'home';
                // 消息携带真实页面类型，三个页面分别保存位置，不再把 all 映射为 detail。
                if (['home', 'detail', 'all'].indexOf(page) === -1) return;
                var placements = getEditableAdPlacements();
                // 新增广告从三页都为空开始，避免被旧配置补齐规则当成历史详情页广告。
                if (!placements[adId]) placements[adId] = { home: '', detail: '', all: '' };
                placements[adId][page] = position;
                persistBatchReserveUiState();
                persistBatchCodePlacementUiState();
                // 退出放置模式
                exitAdPlacementMode();
                // 更新UI显示
                updateAdPlacementUI();
                if (isBatchAdBuild()) renderBatchAdCodeWorkspace();
                // 重新生成预览（不带标记）
                updatePreview();
            }
        });
    }

    // ========== 广告放置模式 ==========
    function syncContactEmailFromAdCode(result) {
        var host = result && result.detectedHost ? String(result.detectedHost).trim().toLowerCase() : '';
        // 广告代码解析器已识别出子域名；再次限制字符，避免把无效文本写入邮箱字段。
        if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(host)) return '';
        var email = 'contact@' + host;
        appState.config.contactEmail = email;
        var contactEmailInput = document.getElementById('contact-email');
        if (contactEmailInput) contactEmailInput.value = email;
        return email;
    }

    function hasValidatedDirectAdCode() {
        var directCodeWorkflow = (appState.siteBuildMode === 'normal' && appState.normalAdMode !== 'reserve') ||
            (isBatchAdBuild() && ensureBatchAdBuildState().adMode === 'code');
        return directCodeWorkflow && !!(appState.adCodeMigration && appState.adCodeMigration.valid);
    }

    function isReservedDirectAdMode() {
        return (appState.siteBuildMode === 'normal' && appState.normalAdMode === 'reserve') ||
            (isBatchAdBuild() && ensureBatchAdBuildState().adMode === 'reserve');
    }

    function isDirectCodeAdPlacementMode() {
        return hasValidatedDirectAdCode();
    }

    function isManualAdPlacementModeActive() {
        if (isReservedDirectAdMode()) return appState.reservePlacementMode !== 'fixed';
        return isDirectCodeAdPlacementMode() && appState.directAdPlacementMode === 'manual';
    }

    function getEditableAdPlacements() {
        var config = appState.config || (appState.config = {});
        // 上传代码与预留模式分开保存，切换接入方式时不会串用位置配置。
        var key = isDirectCodeAdPlacementMode() && appState.directAdPlacementMode === 'manual'
            ? 'adCodePlacements'
            : 'adPlacements';
        var placements = config[key];
        if (!placements || typeof placements !== 'object' || Array.isArray(placements)) {
            placements = {};
            config[key] = placements;
        }
        // 首次编辑旧配置时补齐独立列表页位置；不让后续详情页调整影响列表页。
        if (typeof AdMigration !== 'undefined') {
            placements = AdMigration.normalizePagePlacements(placements);
            config[key] = placements;
        }
        return placements;
    }

    function getDisplayedAdPlacements() {
        if (isDirectCodeAdPlacementMode()) {
            if (appState.directAdPlacementMode !== 'manual') {
                return typeof AdMigration !== 'undefined' ? AdMigration.fixedPlacements() : {};
            }
            return AdMigration.normalizePagePlacements(appState.config && appState.config.adCodePlacements || {});
        }
        var placements = appState.config && appState.config.adPlacements || {};
        return typeof AdMigration !== 'undefined' ? AdMigration.normalizePagePlacements(placements) : placements;
    }

    function initializeDirectManualPlacements() {
        var config = appState.config || (appState.config = {});
        // Null means manual positions have not been initialized. An empty object is
        // preserved because it may reflect a user's deliberate removal of all slots.
        if (config.adCodePlacements !== null && config.adCodePlacements !== undefined) return;
        config.adCodePlacements = typeof AdMigration !== 'undefined'
            ? AdMigration.fixedPlacements()
            : {};
    }

    function persistBatchReserveUiState() {
        if (!isBatchAdBuild() || ensureBatchAdBuildState().adMode !== 'reserve') return;
        var activeSite = getActiveBatchSite();
        var target = getBatchReserveEditingTarget(activeSite);
        target.placementMode = appState.reservePlacementMode === 'fixed' ? 'fixed' : 'manual';
        target.adJsVersion = appState.adJsVersion || 'v1.0.2.1';
        target.adPlacements = appState.config.adPlacements || {};
        invalidateBatchSitePreviews(ensureBatchAdBuildState().sites.filter(function(site) {
            return activeSite && activeSite.reserveOverrideEnabled ? site === activeSite : !site.reserveOverrideEnabled;
        }));
    }

    function persistBatchCodePlacementUiState() {
        if (!isBatchAdBuild() || ensureBatchAdBuildState().adMode !== 'code') return;
        var activeSite = getActiveBatchSite();
        var target = getBatchCodePlacementEditingTarget(activeSite);
        target.placementMode = appState.directAdPlacementMode === 'manual' ? 'manual' : 'fixed';
        target.adPlacements = appState.config.adCodePlacements || target.adPlacements || null;
        invalidateBatchSitePreviews(ensureBatchAdBuildState().sites.filter(function(site) {
            return activeSite && activeSite.codePlacementOverrideEnabled ? site === activeSite : !site.codePlacementOverrideEnabled;
        }));
    }

    function reservedAdPlacementCount() {
        if (appState.reservePlacementMode === 'fixed') return appState.config.allArticlesEnabled !== false ? 9 : 6;
        var placements = getDisplayedAdPlacements();
        return Object.keys(placements).reduce(function(total, adId) {
            var pages = placements[adId] || {};
            return total + (pages.home ? 1 : 0) + (pages.detail ? 1 : 0) + (appState.config.allArticlesEnabled !== false && pages.all ? 1 : 0);
        }, 0);
    }

    // 上传代码默认使用固定位置；手动模式复用预留广告位的预览选择器并单独保存位置。
    function syncDirectAdPlacementUI() {
        var automatic = hasValidatedDirectAdCode();
        var reserved = isReservedDirectAdMode();
        var directCodeMode = isDirectCodeAdPlacementMode() && automatic && !reserved;
        var reserveFixed = reserved && appState.reservePlacementMode === 'fixed';
        var directCodeFixed = directCodeMode && appState.directAdPlacementMode !== 'manual';
        var manualPlacementActive = (reserved && appState.reservePlacementMode !== 'fixed') ||
            (directCodeMode && appState.directAdPlacementMode === 'manual');
        var manualGroup = document.getElementById('ad-placement-group');
        var codePanel = document.getElementById('ad-code-mode-panel');
        var automaticNote = document.getElementById('ad-auto-placement-note');
        var modeGroup = document.getElementById('normal-ad-mode-group');
        var directModeGroup = document.getElementById('direct-ad-placement-mode-group');
        var reserveModeGroup = document.getElementById('reserve-placement-mode-group');
        var description = document.getElementById('ad-placement-description');
        var manualControls = document.getElementById('ad-manual-placement-controls');
        var manualDescription = document.getElementById('ad-manual-placement-description');
        var fixedNote = document.getElementById('ad-fixed-placement-note');
        var normalWorkflow = appState.siteBuildMode === 'normal';
        var batchCodeWorkflow = isBatchAdBuild() && ensureBatchAdBuildState().adMode === 'code';
        if (modeGroup) modeGroup.hidden = !normalWorkflow;
        if (manualGroup) manualGroup.hidden = !(reserved || directCodeMode);
        var codePlacementScope = document.getElementById('batch-code-placement-scope');
        if (codePlacementScope) codePlacementScope.hidden = !batchCodeWorkflow;
        if (codePanel) codePanel.hidden = reserved || !normalWorkflow;
        if (automaticNote) automaticNote.hidden = !directCodeFixed;
        if (directModeGroup) directModeGroup.hidden = !directCodeMode;
        if (reserveModeGroup) reserveModeGroup.hidden = !reserved;
        if (manualControls) manualControls.hidden = !manualPlacementActive;
        if (fixedNote) fixedNote.hidden = !(reserveFixed || directCodeFixed);
        if (description) {
            description.textContent = directCodeMode
                ? '上传代码模式可沿用自动固定位置，也可手动调整；手动调整会保留广告单元 ID 与广告位的对应关系。'
                : '选择预留位置方式。导出会保留广告容器、GPT 引用和空配置的 js/ad.js；以后只需填写广告单元路径与 GA ID。';
        }
        if (manualDescription) {
            manualDescription.textContent = directCodeMode
                ? '选择广告容器后，切换首页、详情页或全部文章页，再点击预览中的广告位；三个页面的位置分别独立。每个广告会先带入当前自动位置。'
                : '选择广告容器后，切换首页、详情页或全部文章页，再点击预览中的广告位；三个页面的位置分别独立。';
        }
        if (fixedNote) {
            fixedNote.textContent = directCodeFixed
                ? '固定位置已生效，预览会显示三个广告容器；切换到手动放置时，会带入当前自动位置供你调整。'
                : '固定位置已生效，预览会显示三个广告容器；切回手动放置后，原有手动位置仍会保留。';
        }
        document.querySelectorAll('input[name="normal-ad-mode"]').forEach(function(input) {
            input.checked = input.value === appState.normalAdMode;
        });
        document.querySelectorAll('input[name="ad-js-version"]').forEach(function(input) {
            input.checked = input.value === appState.adJsVersion;
        });
        document.querySelectorAll('input[name="reserve-placement-mode"]').forEach(function(input) {
            input.checked = input.value === appState.reservePlacementMode;
        });
        document.querySelectorAll('input[name="direct-ad-placement-mode"]').forEach(function(input) {
            input.checked = input.value === appState.directAdPlacementMode;
        });
        if (!manualPlacementActive) appState.adPlacementMode = null;
    }

    function initAdConfig() {
        // 广告代码文件上传
        var adCodeUpload = document.getElementById('ad-code-upload');
        var adCodeBtn = document.getElementById('ad-code-btn');
        var adCodeStatus = document.getElementById('ad-code-status');
        var adCodePreview = document.getElementById('ad-code-preview');
        document.querySelectorAll('.ad-js-version-grid').forEach(function(versionGroup) {
            versionGroup.addEventListener('change', function(event) {
                var input = event.target;
                if (!input.matches('input[name="ad-js-version"]') || !input.checked) return;
                appState.adJsVersion = input.value;
                persistBatchReserveUiState();
                if (isBatchAdBuild()) renderBatchAdCodeWorkspace();
                updatePreview();
            });
        });
        document.querySelectorAll('input[name="normal-ad-mode"]').forEach(function(input) {
            input.addEventListener('change', function() {
                if (!this.checked) return;
                exitAdPlacementMode();
                appState.normalAdMode = this.value === 'reserve' ? 'reserve' : 'code';
                syncDirectAdPlacementUI();
                updateAdPlacementUI();
                updatePreview();
            });
        });
        document.querySelectorAll('input[name="reserve-placement-mode"]').forEach(function(input) {
            input.addEventListener('change', function() {
                if (!this.checked) return;
                exitAdPlacementMode();
                appState.reservePlacementMode = this.value === 'fixed' ? 'fixed' : 'manual';
                persistBatchReserveUiState();
                if (isBatchAdBuild()) renderBatchAdCodeWorkspace();
                syncDirectAdPlacementUI();
                updateAdPlacementUI();
                updatePreview();
            });
        });
        document.querySelectorAll('input[name="direct-ad-placement-mode"]').forEach(function(input) {
            input.addEventListener('change', function() {
                if (!this.checked) return;
                exitAdPlacementMode();
                if (this.value === 'manual') initializeDirectManualPlacements();
                appState.directAdPlacementMode = this.value === 'manual' ? 'manual' : 'fixed';
                persistBatchCodePlacementUiState();
                syncDirectAdPlacementUI();
                if (isBatchAdBuild()) renderBatchAdCodeWorkspace();
                updateAdPlacementUI();
                updatePreview();
            });
        });
        // 自定义按钮触发文件选择
        if (adCodeBtn && adCodeUpload) {
            adCodeBtn.addEventListener('click', function() {
                adCodeUpload.click();
            });
        }
        if (adCodeUpload) {
            adCodeUpload.addEventListener('change', function(e) {
                var file = e.target.files[0];
                if (!file) return;
                var reader = new FileReader();
                reader.onload = function(evt) {
                    var text = evt.target.result;
                    var result = AdMigration.inspectAdCodeText(text, file.name);
                    appState.adCodeMigration = result;
                    if (result.valid) {
                        var paths = result.config;
                        var syncedContactEmail = syncContactEmailFromAdCode(result);
                        appState.config.adPaths = paths;
                        if (adCodeBtn) adCodeBtn.textContent = '重新选择';
                        if (adCodeStatus) {
                            adCodeStatus.textContent = '已识别：' + (result.detectedHost || '广告代码') + (syncedContactEmail ? ' · 邮箱已同步' : '');
                            adCodeStatus.style.color = '#4caf50';
                        }
                        if (adCodePreview) {
                            adCodePreview.style.display = 'block';
                            adCodePreview.innerHTML =
                                '<div><span style="color:#aaa;">banner1:</span> <span style="color:#4caf50;">' + (paths.bannerPath1 || '-') + '</span></div>' +
                                '<div><span style="color:#aaa;">banner2:</span> <span style="color:#4caf50;">' + (paths.bannerPath2 || '-') + '</span></div>' +
                                '<div><span style="color:#aaa;">banner3:</span> <span style="color:#4caf50;">' + (paths.bannerPath3 || '-') + '</span></div>' +
                                '<div><span style="color:#aaa;">banner4:</span> <span style="color:#4caf50;">' + (paths.bannerPath4 || '-') + '</span></div>' +
                                '<div><span style="color:#aaa;">INT:</span> <span style="color:#4caf50;">' + (paths.interstitialPath || '-') + '</span></div>' +
                                '<div><span style="color:#aaa;">ANC:</span> <span style="color:#4caf50;">' + (paths.anchorPath || '-') + '</span></div>' +
                                '<div><span style="color:#aaa;">GA:</span> <span style="color:#4caf50;">' + (paths.analyticsID || '-') + '</span></div>';
                        }
                    } else {
                        appState.config.adPaths = {};
                        if (adCodeStatus) {
                            adCodeStatus.textContent = '无法识别：' + (result.errors[0] ? result.errors[0].message : '格式不受支持');
                            adCodeStatus.style.color = '#e74c3c';
                        }
                        if (adCodePreview) adCodePreview.style.display = 'none';
                    }
                    syncDirectAdPlacementUI();
                    updateAdPlacementUI();
                    updatePreview();
                };
                reader.readAsText(file);
            });
        }

        // 选择放置按钮
        document.querySelectorAll('.ad-select-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var adId = this.dataset.ad;
                if (appState.adPlacementMode === adId) {
                    // 再次点击取消
                    exitAdPlacementMode();
                } else {
                    enterAdPlacementMode(adId);
                }
            });
        });
        // 移除按钮
        document.querySelectorAll('.ad-remove-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var adId = this.dataset.ad;
                var placements = getEditableAdPlacements();
                if (placements[adId]) {
                    // 移除只作用于当前页。all 的空值同时防止旧配置兼容逻辑恢复该位置。
                    var activeTab = document.querySelector('.preview-tab.active');
                    var currentPage = activeTab ? activeTab.dataset.page : 'home';
                    if (['home', 'detail', 'all'].indexOf(currentPage) === -1) return;
                    placements[adId][currentPage] = '';
                    persistBatchReserveUiState();
                    persistBatchCodePlacementUiState();
                    updateAdPlacementUI();
                    if (isBatchAdBuild()) renderBatchAdCodeWorkspace();
                    updatePreview();
                }
            });
        });
        syncDirectAdPlacementUI();
        updateAdPlacementUI();
    }

    function enterAdPlacementMode(adId) {
        if (!isManualAdPlacementModeActive()) {
            showNotice('请切换到“手动放置”后，再分别调整首页、详情页和全部文章页的广告位置。', '请选择广告位放置方式');
            return;
        }

        // 选择新位置之前不修改保存值；取消放置或切换预览不会丢失原来的位置。
        var activeTab = document.querySelector('.preview-tab.active');
        var currentPage = activeTab ? activeTab.dataset.page : 'home';
        if (['home', 'detail', 'all'].indexOf(currentPage) === -1) {
            showNotice('请先切换到首页、详情页或全部文章页，再调整广告位置。', '请选择页面');
            return;
        }
        updateAdPlacementUI();
        appState.adPlacementMode = adId;
        // 更新按钮状态
        document.querySelectorAll('.ad-select-btn').forEach(function(btn) {
            if (btn.dataset.ad === adId) {
                btn.textContent = '取消放置';
                btn.style.background = 'var(--color-primary,#4a9eff)';
                btn.style.color = '#fff';
            } else {
                btn.disabled = true;
                btn.style.opacity = '0.4';
            }
        });
        // 显示提示
        document.getElementById('ad-placement-hint').style.display = 'block';
        // 重新生成带标记的预览
        updatePreview();
    }

    function exitAdPlacementMode() {
        appState.adPlacementMode = null;
        // 恢复按钮状态
        document.querySelectorAll('.ad-select-btn').forEach(function(btn) {
            btn.textContent = '选择放置';
            btn.style.background = '';
            btn.style.color = '';
            btn.disabled = false;
            btn.style.opacity = '1';
        });
        // 隐藏提示
        document.getElementById('ad-placement-hint').style.display = 'none';
        // 重新生成不带标记的预览
        updatePreview();
    }

    function updateAdPlacementUI() {
        var placements = getDisplayedAdPlacements();
        var currentPage = 'home';
        var activeTab = document.querySelector('.preview-tab.active');
        if (activeTab) currentPage = activeTab.dataset.page;

        ['adv1', 'adv2', 'adv3'].forEach(function(adId) {
            var label = document.querySelector('.ad-position-label[data-ad="' + adId + '"]');
            var removeBtn = document.querySelector('.ad-remove-btn[data-ad="' + adId + '"]');
            var selectBtn = document.querySelector('.ad-select-btn[data-ad="' + adId + '"]');
            var p = placements[adId] || {};
            var hasHome = !!p.home;
            var hasDetail = !!p.detail;
            var hasAll = !!p.all && appState.config.allArticlesEnabled !== false;
            var hasAny = hasHome || hasDetail || hasAll;

            // 显示位置信息
            var parts = [];
            if (hasHome) parts.push('首页: ' + translatePosition(p.home));
            if (hasDetail) parts.push('详情页: ' + translatePosition(p.detail));
            if (hasAll) parts.push('全部文章: ' + translatePosition(p.all));
            if (label) label.textContent = hasAny ? parts.join(' | ') : '未放置';

            // 移除按钮
            if (removeBtn) {
                removeBtn.style.display = p[currentPage] ? 'inline-block' : 'none';
                removeBtn.title = '仅移除当前页面的广告位';
            }

            // 选择放置按钮 - 根据当前预览页面决定按钮文字
            if (selectBtn) {
                var currentPagePlaced = !!p[currentPage];
                if (currentPagePlaced) {
                    selectBtn.textContent = '重新放置';
                } else if (hasAny) {
                    selectBtn.textContent = '放置到当前页';
                } else {
                    selectBtn.textContent = '选择放置';
                }
            }
        });
    }

    function translatePosition(pos) {
        var map = {
            'after-navbar': '导航栏下方',
            'after-hero': 'Hero区下方',
            'content-top': '内容区顶部',
            'content-bottom': '内容区底部',
            'footer-top': '页脚上方',
            'detail-before-content': '正文前',
            'detail-middle': '正文中部', 'content-middle': '内容中段', 'detail-after-content': '正文中部',
            'detail-before-related': '相关推荐前',
            'detail-after-related': '相关推荐后'
        };
        // 分类区块之间
        if (pos.indexOf('after-section-') === 0) {
            var idx = pos.replace('after-section-', '');
            return '分类' + (parseInt(idx) + 1) + '下方';
        }
        // 分类标题后
        if (pos.indexOf('cat-') === 0 && pos.indexOf('-after-title') !== -1) {
            var parts = pos.split('-');
            return '分类' + (parseInt(parts[1]) + 1) + '标题后';
        }
        // 卡片之间
        if (pos.indexOf('cat-') === 0 && pos.indexOf('-between-') !== -1) {
            var m = pos.match(/^cat-(\d+)-between-(\d+)-(\d+)$/);
            if (m) return '分类' + (parseInt(m[1]) + 1) + '卡片' + (parseInt(m[2]) + 1) + '与' + (parseInt(m[3]) + 1) + '之间';
        }
        // 分类最后卡片后
        if (pos.indexOf('cat-') === 0 && pos.indexOf('-after-last') !== -1) {
            var m2 = pos.match(/^cat-(\d+)-after-last$/);
            if (m2) return '分类' + (parseInt(m2[1]) + 1) + '末尾';
        }
        // 详情页段落之间
        if (pos.indexOf('detail-between-p-') === 0) {
            var pIdx = pos.replace('detail-between-p-', '');
            return '段落' + pIdx + '与' + (parseInt(pIdx) + 1) + '之间';
        }
        return map[pos] || pos;
    }

    var previewTimeout = null;
    function updatePreview(pageType) {
        ConfigurationControls.sync(appState.config, appState);
        if (appState.currentStep !== 4) return;
        if (isAdPolicyWorkflow()) { updateAdPolicyPreview(pageType); return; }
        if (isAdInjectionWorkflow()) {
            updateAdInjectionPreview(pageType);
            return;
        }
        if (appState.siteBuildMode === 'differentiated' && (typeof DifferentiatedBuilder === 'undefined' || DifferentiatedBuilder.BUILD_VERSION !== REQUIRED_DIFFERENTIATED_BUILDER_VERSION)) {
            if (previewTimeout) clearTimeout(previewTimeout);
            previewFrame.removeAttribute('src');
            setPreviewDocument('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#f4f7fb;color:#15243a;font:16px/1.6 system-ui,sans-serif}.notice{max-width:560px;padding:32px;border:1px solid #f0b8b8;background:#fff;box-shadow:8px 8px 0 #d33}h1{margin:0 0 12px;font-size:24px}</style><body><section class="notice"><h1>模板引擎版本未同步</h1><p>当前页面拒绝运行旧模板。请刷新页面后重新上传本次数据源。</p></section></body></html>');
            return;
        }
        if (appState.siteBuildMode === 'differentiated' && !appState.differentiatedImportName && typeof DifferentiatedBuilder !== 'undefined') {
            if (previewTimeout) clearTimeout(previewTimeout);
            previewFrame.removeAttribute('src');
            setPreviewDocument(DifferentiatedBuilder.generateWaitingPreviewHtml(appState.differentiated.siteType));
            return;
        }
        if (!appState.data || appState.data.length === 0) return;

        // 防抖
        if (previewTimeout) clearTimeout(previewTimeout);
        previewTimeout = setTimeout(function() {
            var activeTab = document.querySelector('.preview-tab.active');
            if (!pageType) pageType = activeTab ? activeTab.dataset.page : 'home';

            try {
                // Shared cached images keep their URLs across style changes;
                // legacy/differentiated renderers retain their original cleanup.
                if ((appState.siteBuildMode === 'differentiated' || typeof PreviewImageCache === 'undefined') && appState._previewBlobUrls.length > 0) {
                    if (typeof PreviewImageCache !== 'undefined') PreviewImageCache.clear();
                    appState._previewBlobUrls.forEach(function(u) { URL.revokeObjectURL(u); });
                    appState._previewBlobUrls = [];
                }
                // Resolve the active batch site's derived email, ads and page
                // flags through the same seam as export. A domain edit on an
                // inactive site must not leave the UI's cached state in charge.
                var renderState = appState;
                if (isBatchAdBuild()) {
                    var previewBatch = ensureBatchAdBuildState();
                    var renderingSite = getActiveBatchSite();
                    var renderingCode = previewBatch.codes.find(function(code) { return code.id === renderingSite.codeId; });
                    renderState = BatchAdBuilder.createSiteState(appState, renderingSite, renderingCode, previewBatch);
                }
                var html = appState.siteBuildMode === 'differentiated' && typeof DifferentiatedBuilder !== 'undefined'
                    ? DifferentiatedBuilder.generatePreviewHtml(appState, pageType, {
                        siteType: appState.differentiated.siteType,
                        itemIndex: appState.previewDetailIndex,
                        categorySlug: appState.previewSectionSlug
                    })
                    : Generator.generatePreviewHtml(renderState, pageType, appState.previewDetailIndex);
                if (appState.siteBuildMode !== 'differentiated') appState.previewHomeAnchor = '';
                // 记录这次真正写入 iframe 的配置签名。普通与批量导出会核对该值，
                // 防止界面显示一套配置、ZIP 却从另一个站点或旧状态读取配置。
                if (appState.siteBuildMode !== 'differentiated' && typeof Generator.getBuildSignature === 'function') {
                    var previewSignature = Generator.getBuildSignature(renderState);
                    if (isBatchAdBuild()) {
                        var previewSite = getActiveBatchSite();
                        if (previewSite) previewSite.previewSignature = previewSignature;
                    } else {
                        appState._lastPreviewSignature = previewSignature;
                    }
                }
                previewFrame.removeAttribute('sandbox');
                previewFrame.removeAttribute('src');
                setPreviewDocument(html);
            } catch(e) {
                console.error('Preview error:', e);
                // A failed render must replace an empty/stale iframe with an
                // actionable notice, and must not certify an earlier preview
                // as matching the current configuration during ZIP export.
                appState._lastPreviewSignature = null;
                if (isBatchAdBuild()) {
                    var failedPreviewSite = getActiveBatchSite();
                    if (failedPreviewSite) failedPreviewSite.previewSignature = null;
                }
                previewFrame.removeAttribute('sandbox');
                previewFrame.removeAttribute('src');
                setPreviewDocument(previewErrorDocument(e));
            }
        }, 300);
    }

    // ========== Step 5: 导出 ==========
    function generateExportSummary(afterRender) {
        if (isAdPolicyWorkflow()) {
            var policySummary = document.getElementById('export-summary');
            // 快速模式使用自己的 TXT 与目标站范围，不显示详细策略的旧覆盖计数。
            var quickSummary = isQuickAdUpdate();
            var quickSummaryPlan = quickSummary ? planQuickAdUpdate(appState.adPolicySites, appState.adQuickCodes, quickUpdateOptions()) : null;
            policySummary.innerHTML = renderExportConfiguration({
                title: isTemplateReuseWorkflow() ? '广告模板复用' : quickSummary ? '快速更新广告' : '批量广告策略', themeName: isTemplateReuseWorkflow() ? '保留模板，替换内容与广告' : '广告策略更新',
                metrics: quickSummary
                    ? [['目标站点', quickSummaryPlan.mappings.length], ['匹配成功', quickSummaryPlan.validCount], ['新广告 TXT', appState.adQuickCodes.length]]
                    : [['站点数量', appState.adPolicySites.length], ['单站覆盖', Object.keys(appState.adPolicyOverrides).length], ['广告代码替换', Object.keys(appState.adPolicyCodeOverrides).length]],
                groups: [
                    { title: '处理配置', items: [['更新模式', quickSummary ? '快速更新' : '详细策略'], ['输出模板', quickSummary ? QUICK_AD_VERSION : appState.adPolicyAdJsVersion]] },
                    { title: '输出方式', items: [['页面策略', quickSummary ? '保持原站广告位置' : '首页、详情页、全部文章页分别保存'], ['站点输出', '新目录或批量 ZIP'], ['广告代码', quickSummary ? '按目标站匹配新广告 TXT' : '支持单独导出 TXT']] }
                ]
            });
            updateAdRestorationControls();
            return;
        }
        if (isAdInjectionWorkflow()) {
            syncAdInjectionExportControls();
            var injectionSites = appState.adInjectionSites || [];
            var injectionCodes = appState.adInjectionCodes || [];
            var injectionReport = typeof AdRestoration !== 'undefined'
                ? AdRestoration.matchAdCodesToSites(injectionSites, injectionCodes)
                : { validCount: 0 };
            var reactSourceSites = injectionSites.filter(function(site) { return site && site.project && site.project.kind === 'react-source'; });
            var injectionReady = injectionSites.length > 0 && injectionReport.validCount === injectionSites.length;
            var summary = document.getElementById('export-summary');
            if (summary) summary.innerHTML = renderExportConfiguration({
                title: '成品站加广告', themeName: '广告注入',
                metrics: [['已过审站点', injectionSites.length], ['有效广告 TXT', injectionCodes.filter(function(code) { return code.valid; }).length + '/' + injectionCodes.length], ['完成域名配对', injectionReport.validCount + '/' + injectionSites.length]],
                groups: [
                    { title: '广告配置', items: [['广告位策略', appState.adInjectionPlacementModeDefault === 'fixed' ? '固定位置自动适配' : '手动放置'], ['ad.js 版本', appState.adInjectionAdJsVersion + (Object.keys(appState.adInjectionSiteOverrides || {}).length ? '；含单站覆盖' : '')]] },
                    { title: '导出配置', items: [['导出内容', appState.adInjectionExportMode === 'source' ? '含广告的完整源码' : '静态站点副本'], ['输出方式', 'ZIP 或新目录']] }
                ]
            }) + '<section class="migration-validation ' + (injectionReady ? '' : 'invalid') + '"><h5>' + (injectionReady ? '广告代码与站点配对校验通过' : '导出仍被阻止') + '</h5><p>' + (injectionReady ? '导出只向新副本增加广告脚本和已确认广告位；上传的已过审源站保持不变。' : '请返回“配置网站”上传广告代码 TXT，并确保每个站点都有一份有效且域名匹配的代码。') + '</p></section>';
            if (summary && reactSourceSites.length && appState.adInjectionExportMode === 'source') summary.innerHTML += '<section class="migration-validation"><h5>React 源码将完整导出</h5><p>浏览器不会执行 npm install 或 npm run build；工具会导出加入广告后的完整工程。请下载后在项目环境安装依赖并执行生产构建，再部署新生成的 dist、build 或框架输出目录。</p></section>';
            updateAdInjectionControls();
            if (typeof afterRender === 'function') afterRender();
            return;
        }
        if (isBatchAdBuild()) {
            var batchTarget = document.getElementById('export-summary');
            var batch = ensureBatchAdBuildState();
            var batchReport = typeof BatchAdBuilder !== 'undefined' ? BatchAdBuilder.validateAssignments(batch.sites, batch.codes, batch) : { valid: false, errors: [{ message: '批量建站组件未加载。' }], warnings: [] };
            var reserveMode = batch.adMode === 'reserve';
            var ready = reserveMode
                ? batchReport.assignments.filter(function(item) { return !batchSiteIssues(item.site).length && BatchAdBuilder.countReservedPlacements(item.reserveSettings); }).length
                : batch.sites.filter(function(site) { return !batchSiteIssues(site).length && batch.codes.some(function(code) { return code.id === site.codeId && code.valid; }); }).length;
            var validDomains = reserveMode ? batchReport.assignments.filter(function(item) { return item.domain.valid; }).length : 0;
            batchTarget.innerHTML = renderExportConfiguration({
                title: '批量广告建站', themeName: reserveMode ? '预留广告位' : '一对一广告接入',
                metrics: [['站点数量', batch.sites.length], [reserveMode ? '字段与广告位就绪' : '字段与代码就绪', ready + '/' + batch.sites.length], [reserveMode ? '有效唯一域名' : '有效广告代码', reserveMode ? validDomains + '/' + batch.sites.length : batch.codes.filter(function(code) { return code.valid; }).length + '/' + batch.codes.length]],
                groups: [
                    { title: '建站配置', items: [['广告接入', reserveMode ? '先预留广告位，后填 ID' : '逐站配对有效广告 TXT'], ['模板与样式', '逐站独立配置']] },
                    { title: '导出配置', items: [['导出格式', '每个站点独立 ZIP'], ['站点校验', '导出期间逐站验证']] }
                ]
            }) + '<section class="migration-validation ' + (batchReport.valid ? '' : 'invalid') + '"><h5>' + (batchReport.valid ? (reserveMode ? '预留广告位校验通过' : '一对一广告代码校验通过') : '导出已阻止') + '</h5>' +
                (batchReport.valid ? '<p>' + (reserveMode ? '导出期间会逐站验证 GPT、广告容器和空配置 js/ad.js；占位域名提示不会阻止导出。' : '导出期间会逐站重新生成，然后验证首页、全部详情页、GPT 脚本、三个广告容器以及 js/ad.js 中的对应广告路径。') + '</p>' : '<ul>' + batchReport.errors.map(function(error) { return '<li>' + escapeHtml(error.message) + '</li>'; }).join('') + '</ul>') + '</section>';
            document.getElementById('btn-export').disabled = !batchReport.valid;
            if (typeof afterRender === 'function') afterRender();
            return;
        }
        if (appState.siteBuildMode === 'differentiated' && typeof DifferentiatedBuilder !== 'undefined') {
            var target = document.getElementById('export-summary');
            target.innerHTML = '<h4>差异化精品建站审计</h4><p>正在检查内容、来源、图片、功能、链接、法律信息与设计指纹…</p>';
            document.querySelectorAll('[data-diff-export]').forEach(function(button) { button.disabled = true; });
            DifferentiatedBuilder.audit(appState, { variant: 'review', siteType: appState.differentiated.siteType }).then(function(outcome) {
                var config = outcome.config;
                target.innerHTML = renderDifferentiatedExportConfiguration(config, outcome.report.counts) +
                    DifferentiatedBuilder.renderAuditSummary(outcome.report);
                document.querySelectorAll('[data-diff-export]').forEach(function(button) {
                    button.disabled = button.dataset.diffExport !== 'draft' && outcome.report.counts.blockers > 0;
                });
                if (typeof afterRender === 'function') afterRender();
            }).catch(function(error) {
                target.innerHTML = '<section class="migration-validation invalid"><h5>审计无法完成</h5><p>' + escapeHtml(error.message) + '</p></section>';
                document.querySelectorAll('[data-diff-export]').forEach(function(button) { button.disabled = button.dataset.diffExport !== 'draft'; });
                if (typeof afterRender === 'function') afterRender();
            });
            return;
        }
        var theme = EditorialTemplateVersions.theme(appState);
        var config = appState.config;
        var legacyEditorial = EditorialTemplateVersions.eligible(appState) && EditorialTemplateVersions.isLegacy(config);
        var mapping = appState.fieldMapping;
        var mappedCount = Object.keys(mapping).length;
        var unmappedCount = theme.fields.length - mappedCount;

        var selectedStyleName = '';
        // The export summary describes the selected generation's own palette.
        (legacyEditorial ? LegacyEditorialTemplateSource.presets : STYLE_PRESETS).forEach(function(s) {
            if (s.id === config.selectedStyle) selectedStyleName = s.name;
        });
        var template = getTemplateById(config.templateId);
        var iconSet = getIconSetById(config.iconSetId);

        var migration = appState.legacyAdMigration;
        var isMigration = appState.siteBuildMode === 'ad-migration';
        var isReservedAds = appState.siteBuildMode === 'normal' && appState.normalAdMode === 'reserve';
        // 只调整展示顺序，配置取值与后续导出资格判断均沿用原有逻辑。
        var adSummaryItems = [['建站方式', isMigration ? '广告移植建站' : '普通建站']];
        if (!isMigration) {
            var adModeSummary = isReservedAds
                ? '先预留广告位（' + (appState.reservePlacementMode === 'fixed' ? '固定位置' : '手动放置') + '），后填 ID'
                : (appState.siteBuildMode === 'normal'
                    ? '上传代码自动添加（' + (appState.directAdPlacementMode === 'manual' ? '手动放置' : '固定位置') + '）'
                    : '上传代码自动添加');
            adSummaryItems.push(['广告接入', adModeSummary]);
        }
        var summaryHtml = renderExportConfiguration({
            title: config.siteTitle || theme.siteTitle,
            themeName: theme.name,
            metrics: [
                ['数据条数', appState.data.length],
                ['已匹配字段', mappedCount],
                ['未匹配字段 · 不展示', unmappedCount]
            ],
            groups: [
                { title: '网站与内容', items: [
                    ['联系邮箱', config.contactEmail || 'contact@your-domain.com'],
                    ['分类数量', config.categories.length + '个'],
                    ['内容渲染', config.contentRender === 'markdown' ? 'Markdown转HTML' : '纯文本'],
                    ['相关推荐', config.relatedCount + '条']
                ] },
                { title: '外观与功能', items: [
                    ['页面模板', legacyEditorial ? '旧版本 · 随机搭配' : template.name],
                    ['图标组合', legacyEditorial ? '旧版原始分类图标' : (iconSet ? iconSet.name : '自定义组合')],
                    ['视觉风格', selectedStyleName],
                    ['Hero区域', config.heroEnabled ? '开启' : '关闭'],
                    ['操作按钮', config.actionButtonEnabled ? config.actionButtonText : '关闭']
                ] },
                { title: '广告配置', wide: true, items: adSummaryItems }
            ]
        });
        var adCode = appState.adCodeMigration;
        var isAdCodeBuild = !isMigration && !isReservedAds && !!adCode;
        var adCodeValid = !adCode || adCode.valid;
        var reservedCount = isReservedAds ? reservedAdPlacementCount() : 0;
        if (isMigration) {
            summaryHtml += '<section class="migration-validation ' + (migration && migration.valid ? '' : 'invalid') + '"><h5>广告移植导出前校验</h5>' + migrationResultHtml(migration) + '</section>';
        } else if (isReservedAds) {
            summaryHtml += '<section class="migration-validation ' + (reservedCount ? '' : 'invalid') + '"><h5>' + (reservedCount ? '广告位预留配置完成' : '尚未放置广告位') + '</h5><p>' + (reservedCount ? '将导出 ' + reservedCount + ' 个首页、详情页和全部文章页广告位置，并生成路径为空的 js/ad.js。拿到运营代码后，只需填写 adUnitBanner1/2/3、adUnitInterstitial、adUnitAnchor 和 gaMeasurementId。' : '请返回“广告代码”标签，至少在首页、详情页或全部文章页放置一个广告容器后再导出。') + '</p></section>';
        } else if (isAdCodeBuild) {
            summaryHtml += '<section class="migration-validation ' + (adCodeValid ? '' : 'invalid') + '"><h5>广告代码建站校验</h5>' + migrationResultHtml(adCode) + '</section>';
        } else {
            summaryHtml += '<section class="migration-validation"><h5>普通建站校验通过</h5><p>本次不会读取旧网站源码，也不会生成 GPT 脚本、ad.js 或广告容器。</p></section>';
        }

        document.getElementById('export-summary').innerHTML = summaryHtml;
        document.getElementById('btn-export').disabled = (isMigration && !(migration && migration.valid)) || (!isMigration && isAdCodeBuild && !adCodeValid) || (isReservedAds && !reservedCount);
        if (typeof afterRender === 'function') afterRender();
    }

    function updateExportProgress(percent, message, state) {
        updateWorkflowExportProgress('export-progress', percent, message, state);
    }

    // Resolve the ad-code host once for the ZIP filename and its site directory.
    function getGeneratedSiteAdSource() {
        var adSource = null;
        if (appState.siteBuildMode === 'ad-migration') {
            adSource = appState.legacyAdMigration;
        } else if (appState.siteBuildMode === 'normal' && appState.normalAdMode !== 'reserve') {
            adSource = appState.adCodeMigration;
        }
        return adSource;
    }

    function getGeneratedSiteArchiveDescriptor(exportTitle) {
        var adSource = getGeneratedSiteAdSource();
        var fallbackName = String(exportTitle || 'website').replace(/\s+/g, '-').toLowerCase() + '-website.zip';
        return ArchiveNaming.siteZipDescriptor(adSource && adSource.detectedHost, fallbackName);
    }

    // 导出按钮
    document.getElementById('btn-export').addEventListener('click', function() {
        if (isBatchAdBuild()) {
            var report = BatchAdBuilder.validateAssignments(appState.batchAdBuild.sites, appState.batchAdBuild.codes, appState.batchAdBuild);
            if (!report.valid) {
                showNotice(report.errors[0] ? report.errors[0].message : '请完成广告代码分配。', '暂时不能导出');
                generateExportSummary();
                return;
            }
            var batchButton = this;
            batchButton.disabled = true;
            batchButton.setAttribute('aria-busy', 'true');
            updateExportProgress(3, appState.batchAdBuild.adMode === 'reserve' ? '正在准备批量站点与预留广告位…' : '正在准备批量站点与广告代码…', 'loading');
            var batchPreflightReport = null;
            BatchAdBuilder.exportBatch(appState, function(percent, text) {
                updateExportProgress(percent, text, 'loading');
            }, window.JSZip).then(async function(result) {
                batchPreflightReport = result.preflightReport || null;
                var downloads = result.downloads || [];
                if (!downloads.length) throw new Error('批量导出没有生成可下载的站点 ZIP。');
                for (var download of downloads) await ArchiveExport.save(download.blob, download.fileName);
                updateExportProgress(100, result.reports.length + ' 个站点已完成运行时广告检查，并分别下载域名 ZIP。若浏览器拦截，请允许多个文件下载。', 'success');
            }).catch(function(error) {
                batchPreflightReport = error.preflightReport || null;
                updateExportProgress(null, '批量导出失败：' + error.message, 'error');
                showNotice(error.message, '批量导出未完成');
            }).finally(function() {
                batchButton.disabled = false;
                batchButton.removeAttribute('aria-busy');
                generateExportSummary(function() { renderExportPreflight(batchPreflightReport, 'export-summary'); });
            });
            return;
        }
        if (appState.siteBuildMode === 'ad-migration' && !(appState.legacyAdMigration && appState.legacyAdMigration.valid)) {
            showNotice('广告移植校验尚未通过，不能导出不完整站点。请先处理校验结果中的问题。', '暂时不能导出');
            return;
        }
        if (appState.siteBuildMode === 'normal' && appState.normalAdMode === 'reserve' && !reservedAdPlacementCount()) {
            showNotice('请先在首页、详情页或全部文章页至少放置一个广告容器。导出后，这些位置会保留并由空配置的 js/ad.js 管理。', '尚未放置广告位');
            return;
        }
        if (appState.siteBuildMode === 'normal' && appState.normalAdMode !== 'reserve' && appState.adCodeMigration && !appState.adCodeMigration.valid) {
            showNotice('广告代码尚未通过校验。请重新上传对应子域名的广告代码 TXT 文件。', '暂时不能导出');
            return;
        }
        var btn = this;
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        updateExportProgress(3, '正在准备导出文件…', 'loading');
        var theme = THEMES[appState.selectedTheme];
        var exportTitle = appState.config.siteTitle || theme.siteTitle;
        var archiveDescriptor = getGeneratedSiteArchiveDescriptor(exportTitle);

        Generator.exportWebsite(appState, function(percent, text) {
            updateExportProgress(percent, text, 'loading');
        }, { siteFolderName: archiveDescriptor.siteFolderName }).then(async function(blob) {
            updateExportProgress(96, '正在进行导出前全站体检…', 'loading');
            var preflightReport = await inspectExportBlob(blob, exportTitle || '普通建站');
            renderExportPreflight(preflightReport, 'export-summary');
            await ArchiveExport.save(blob, archiveDescriptor.fileName);
            updateExportProgress(100, '导出成功，ZIP 文件已开始下载。', 'success');
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
        }).catch(function(err) {
            renderExportPreflight(err.preflightReport, 'export-summary');
            updateExportProgress(null, '导出失败：' + err.message, 'error');
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
            console.error('Export error:', err);
        });
    });

    function exportDifferentiatedSite(variant, button) {
        appState.differentiated.exportVariant = variant;
        document.querySelectorAll('[data-diff-export]').forEach(function(item) { item.disabled = true; });
        if (button) button.setAttribute('aria-busy', 'true');
        updateExportProgress(3, '正在准备差异化站点的导出文件…', 'loading');
        DifferentiatedBuilder.exportWebsite(appState, function(percent, text) {
            updateExportProgress(percent, text, 'loading');
        }, { variant: variant, siteType: appState.differentiated.siteType, JSZip: window.JSZip }).then(async function(blob) {
            var config = DifferentiatedBuilder.buildConfig(appState, { variant: variant, siteType: appState.differentiated.siteType });
            updateExportProgress(96, '正在进行导出前全站体检…', 'loading');
            var preflightReport = await inspectExportBlob(blob, config.siteTitle || '差异化站点');
            await ArchiveExport.save(blob, DifferentiatedBuilder.slugify(config.siteTitle, 'static-site') + '-' + variant + '.zip');
            updateExportProgress(100, '差异化静态站导出成功，ZIP 已开始下载。', 'success');
            generateExportSummary(function() { renderExportPreflight(preflightReport, 'export-summary'); });
        }).catch(function(error) {
            if (error.preflightReport) {
                generateExportSummary(function() { renderExportPreflight(error.preflightReport, 'export-summary'); });
            }
            updateExportProgress(null, '导出失败：' + error.message, 'error');
            showNotice(error.message, '差异化导出未完成');
            if (!error.preflightReport) generateExportSummary();
        }).finally(function() {
            if (button) button.removeAttribute('aria-busy');
        });
    }

    document.querySelectorAll('[data-diff-export]').forEach(function(button) {
        button.addEventListener('click', function() { exportDifferentiatedSite(this.dataset.diffExport, this); });
    });

    // ========== 步骤切换时的初始化 ==========
    function onStepEnter(step) {
        switch(step) {
            case 3:
                renderFieldMapping();
                break;
            case 4:
                initConfigPanel();
                updatePreview();
                break;
        }
    }

    // 覆盖goToStep以添加步骤进入逻辑
    var originalGoToStep = goToStep;
    goToStep = function(step) {
        var prevStep = appState.currentStep;
        originalGoToStep(step);
        if (appState.currentStep === step && step !== prevStep) {
            onStepEnter(step);
        }
    };

    // ========== 一键随机组装 ==========
    function randomPick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function randomPickWithoutRecent(arr, recent, historySize) {
        if (!arr.length) return null;
        var candidates = arr.filter(function(value) { return recent.indexOf(value) === -1; });
        if (!candidates.length) {
            candidates = arr.slice();
            recent.length = 0;
        }
        var picked = randomPick(candidates);
        recent.push(picked);
        while (recent.length > (historySize || 3)) recent.shift();
        return picked;
    }

    function generateRandomConfig() {
        var c = appState.config;
        if (EditorialTemplateVersions.isLegacy(c) && EditorialTemplateVersions.eligible(appState)) {
            LegacyEditorialTemplateSource.randomize(c);
            return;
        }

        // 先换页面蓝图，确保每次随机都有结构级变化；最近三次不重复。
        var domainTemplates = getBlueprintsForTheme(appState.selectedTheme);
        var templateId = randomPickWithoutRecent(domainTemplates.map(function(t) { return t.id; }), appState.randomTemplateHistory, 3);
        applyTemplatePreset(templateId, false);
        applyRandomIconSet(false);
        // 新模板保留完整的领域设计，防止随机配色、字体和列数破坏布局。
        if (TemplateCatalog.getLayout(c.homeLayout)) return;
        // 每次都从完整配色主题库抽取，模板和配色共同构成随机结果。
        c.selectedStyle = randomPick(STYLE_PRESETS.map(function(s) { return s.id; }));

        // 再做少量可控扰动，保留模板的设计意图。
        c.categoryTitleStyle = randomPick(['single', 'none', 'double', 'dotted', 'gradient', 'left-accent']);
        c.categoryTitleAlign = randomPick(['left', 'center']);
        c.cardHover = randomPick(['float', 'scale', 'glow', 'slide-up', 'image-zoom', 'color-reveal', 'title-underline', 'accent-line', 'none']);
        c.cardRadius = randomPick(['0', '4px', '8px', '12px', '16px']);
        c.gridGap = randomPick(['10px', '20px', '30px', '40px']);
        c.cardImageHeight = randomPick(['120px', '150px', '180px', '220px', '260px']);
        c.navbarHeight = randomPick(['50px', '60px', '70px', '80px']);
        c.transitionSpeed = randomPick(['0.2s', '0.3s', '0.5s']);
        c.animationEnter = randomPick(['fadeIn', 'slideUp', 'zoomIn', 'slideLeft', 'none']);
        if (Math.random() > 0.35) c.fontStyle = randomPick(FONT_PRESETS.map(function(font) { return font.id; }));

        // 仅小概率改动高影响项，仍然让模板之间保持明显识别度。
        if (Math.random() > 0.65) c.cardColumns = randomPick(['auto', '2', '3', '4']);
    }

    function applyConfigToUI() {
        if (typeof SiteMotion !== 'undefined') SiteMotion.syncControls(appState.config);
        EditorialTemplateVersions.syncControls(document, appState);
        syncEditorialTemplateScope();
        var c = appState.config;
        document.getElementById('category-icons-enabled').checked = c.categoryIconsEnabled !== false;
        document.getElementById('category-numbers-enabled').checked = c.categoryNumbersEnabled === true;

        // 同步模板选择和首页开关，避免随机组装后面板仍显示旧值
        var templateCards = document.querySelectorAll('.template-card');
        templateCards.forEach(function(card) {
            card.classList.toggle('selected', card.dataset.templateId === c.templateId);
        });
        var iconSetSelect = document.getElementById('icon-set-select');
        if (iconSetSelect && c.iconSetId) iconSetSelect.value = c.iconSetId;
        var brandSelect = document.getElementById('brand-preset');
        if (brandSelect && c.brandId) brandSelect.value = c.brandId;
        var heroToggle = document.getElementById('hero-enabled');
        var heroConfig = document.getElementById('hero-config');
        if (heroToggle) heroToggle.checked = !!c.heroEnabled;
        if (heroConfig) heroConfig.style.display = c.heroEnabled ? 'block' : 'none';
        syncAllArticlesUI();
        var heroTitle = document.getElementById('hero-title');
        var heroSubtitle = document.getElementById('hero-subtitle');
        if (heroTitle) heroTitle.value = c.heroTitle || '';
        if (heroSubtitle) heroSubtitle.value = c.heroSubtitle || '';
        syncLogoIconPicker();

        // 通用select绑定
        var selectIds = [
            'navbar-layout', 'footer-style', 'back-link-style', 'card-columns',
            'meta-layout', 'content-render', 'navbar-style', 'navbar-height',
            'logo-style', 'card-hover', 'card-border', 'card-radius', 'card-spacing', 'card-excerpt-lines',
            'btn-style', 'btn-size', 'grid-gap', 'font-style', 'animation-enter',
            'transition-speed', 'meta-bg', 'detail-img-style', 'privacy-length',
            'terms-length', 'category-title-style', 'category-title-align',
            'card-image-height', 'content-max-width', 'hero-style', 'detail-layout',
            'card-view-mode'
        ];
        var selectToConfig = {
            'navbar-layout': 'navbarLayout', 'footer-style': 'footerStyle',
            'back-link-style': 'backLinkStyle', 'card-columns': 'cardColumns',
            'meta-layout': 'metaLayout', 'content-render': 'contentRender',
            'navbar-style': 'navbarStyle', 'navbar-height': 'navbarHeight',
            'logo-style': 'logoStyle', 'card-hover': 'cardHover',
            'card-border': 'cardBorder', 'card-radius': 'cardRadius',
            'card-spacing': 'cardSpacing', 'card-excerpt-lines': 'cardExcerptLines', 'btn-style': 'btnStyle',
            'btn-size': 'btnSize', 'grid-gap': 'gridGap',
            'font-style': 'fontStyle', 'animation-enter': 'animationEnter',
            'transition-speed': 'transitionSpeed', 'meta-bg': 'metaBg',
            'detail-img-style': 'detailImgStyle', 'privacy-length': 'privacyLength',
            'terms-length': 'termsLength', 'category-title-style': 'categoryTitleStyle',
            'category-title-align': 'categoryTitleAlign', 'card-image-height': 'cardImageHeight',
            'content-max-width': 'contentMaxWidth', 'hero-style': 'heroStyle',
            'detail-layout': 'detailLayout', 'card-view-mode': 'cardViewMode'
        };

        selectIds.forEach(function(id) {
            var elem = document.getElementById(id);
            if (elem && c[selectToConfig[id]] !== undefined) {
                // Complete packages may use an identity-specific numeric size
                // (for example 1240px). Represent it without changing the existing
                // operator choices or showing a blank custom-select trigger.
                elem.querySelectorAll('option[data-template-default]').forEach(function(option) { option.remove(); });
                var value = String(c[selectToConfig[id]]);
                var packageRecord = typeof TemplateRegistry !== 'undefined' ? TemplateRegistry.get(c.templateId) : null;
                if (packageRecord && packageRecord.manifest.schemaVersion === 2 &&
                    !Array.prototype.some.call(elem.options, function(option) { return option.value === value; }) &&
                    /^(?:0|\d+(?:\.\d+)?(?:px|s)|full)$/.test(value)) {
                    var option = document.createElement('option');
                    option.value = value;
                    option.textContent = '模板默认（' + value + '）';
                    option.dataset.templateDefault = 'true';
                    elem.appendChild(option);
                }
                elem.value = c[selectToConfig[id]];
            }
        });

        // 更新样式网格的选中状态
        var styleCards = document.querySelectorAll('.style-card');
        styleCards.forEach(function(card) {
            card.classList.toggle('selected', card.dataset.styleId === c.selectedStyle);
        });

        // 同步分类、卡片字段等动态区域
        if (c.categories && document.getElementById('category-count')) {
            document.getElementById('category-count').value = c.categories.length;
            document.getElementById('cat-count-value').textContent = c.categories.length;
            updateCategoryConfig(c.categories.length);
        }
        if (document.getElementById('card-fields-config') && appState.selectedTheme) updateCardFieldsConfig();
        if (document.getElementById('related-card-fields-config') && appState.selectedTheme) updateRelatedCardFieldsConfig();
        syncStyledSelects();
    }

    document.getElementById('random-assemble-btn').addEventListener('click', function() {
        generateRandomConfig();
        applyConfigToUI();
        updatePreview();

        // 按钮反馈动画
        var btn = this;
        btn.style.background = '#ff9800';
        btn.style.color = '#fff';
        setTimeout(function() {
            btn.style.background = 'transparent';
            btn.style.color = '#ff9800';
        }, 400);
    });

    window.addEventListener('sitefoundry-ad-template-default-changed', function(event) {
        var version = event.detail && event.detail.version;
        if (!version) return;
        appState.adJsVersion = version;
        appState.adInjectionAdJsVersion = version;
        persistBatchReserveUiState();
        if (isBatchAdBuild()) renderBatchAdCodeWorkspace();
        syncDirectAdPlacementUI();
        syncAdInjectionSettingsControls();
        updatePreview();
    });

    // 初始化
    goToStep(1);
    initStyledSelects();

})();
