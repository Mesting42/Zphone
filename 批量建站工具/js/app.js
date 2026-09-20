import './differentiated-builder.js?v=20260915-industrial-catalog-1';

/**
 * 主应用逻辑
 * 管理步骤导航、状态、UI交互、实时预览
 */

(function() {
    'use strict';

    var REQUIRED_DIFFERENTIATED_BUILDER_VERSION = '20260914-template-library-13';

    // ========== 应用状态 ==========
    var appState = {
        currentStep: 1,
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
        siteBuildMode: 'normal',
        legacyAdMigration: null,
        adCodeMigration: null,
        adRestorationSiteFiles: [],
        adPolicySites: [],
        adPolicySourceMode: '',
        adPolicyGlobal: null,
        adPolicyOverrides: {},
        adInjectionSites: [],
        adInjectionSourceMode: '',
        adInjectionArchiveFiles: [],
        adInjectionCodeFiles: [],
        adInjectionCodes: [],
        batchAdBuild: { sites: [], codes: [], activeSiteIndex: 0 },
        differentiated: {
            siteType: 'editorial', vertical: '', audience: '', scope: '', baseUrl: '',
            contactEmail: '', contactLayout: 'split', contactFields: ['name', 'email', 'subject', 'message'], footerStyle: 'simple', footerLinks: ['privacy', 'terms', 'contact', 'about'], siteTitle: '', brandMark: 'auto', logoIcon: '', typography: 'auto', designFamily: 'auto', domainId: 'auto', seed: '', cardAlignment: 'compact', homeIntro: 'compact', featuredCard: 'highlight', navCategoryLimit: 4, homeCategoryLayout: false, homeCategoryLimit: 4, categoryOverrides: [], summaryMode: 'standard', tone: 'auto', themePreset: 'auto', themePalette: {}, contentDensity: 'comfortable', cardRadius: 'auto', cardHover: 'lift', cardColumns: 'template', categoryCardColumns: 'inherit', cardViewMode: 'auto', cardBorder: 'auto', cardSpacing: 'auto', cardExcerptLines: 'auto', cardImageHeight: 'auto', cardHeight: 'template', coverFit: 'smart', contentMaxWidth: 'auto', metaBg: 'auto', detailImgStyle: 'auto', categoryTitleStyle: 'auto', categoryTitleAlign: 'auto', heroStyle: 'auto', detailLayout: 'auto', fontStyle: 'auto', logoStyle: 'mark-text', navLayout: 'split', navStyle: 'glass', navHeight: 'regular', gridGap: 'regular', buttonStyle: 'solid', buttonSize: 'auto', backLinkStyle: 'arrow', animationEnter: 'fade', transitionSpeed: 'normal', exportVariant: 'draft'
        },
        differentiatedPackage: null,
        packageAssets: {},
        differentiatedImportName: '',
        _previewBlobUrls: []    // 预览中本地图片的blob URL，用于清理
    };

    // ========== DOM引用 ==========
    var stepPanels = document.querySelectorAll('.step-panel');
    var stepItems = document.querySelectorAll('.step-item');
    var stepLines = document.querySelectorAll('.step-line');
    var btnPrev = document.getElementById('btn-prev');
    var btnReupload = document.getElementById('btn-reupload');
    var btnNext = document.getElementById('btn-next');
    var workflowActionMessage = document.getElementById('workflow-action-message');
    var previewFrame = document.getElementById('preview-frame');
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
        var messages = {
            1: '下一步：识别领域',
            2: '下一步：字段匹配',
            3: '下一步：配置网站',
            4: '下一步：导出网站',
            5: '当前步骤：导出网站'
        };
        workflowActionMessage.textContent = messages[step] || '流程操作';
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
        if (event.key === 'Escape') {
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

    function syncBuildModeUI() {
        var isMigration = appState.siteBuildMode === 'ad-migration';
        var isDifferentiated = appState.siteBuildMode === 'differentiated';
        var isRestoration = appState.siteBuildMode === 'ad-restoration';
        var isInjection = appState.siteBuildMode === 'ad-injection';
        var isBatchAdBuild = appState.siteBuildMode === 'batch-ad-build';
        var isStandaloneTool = isRestoration || isInjection;
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
        var injectionSection = document.getElementById('ad-injection-setup');
        if (injectionSection) injectionSection.hidden = !isInjection;
        var batchSection = document.getElementById('batch-ad-setup');
        if (batchSection) batchSection.hidden = !isBatchAdBuild;
        if (uploadArea) uploadArea.hidden = isStandaloneTool || isBatchAdBuild;
        if (dataOverview) dataOverview.hidden = isStandaloneTool || isBatchAdBuild;
        var stepProgress = document.querySelector('.step-progress');
        if (stepProgress) stepProgress.hidden = isStandaloneTool;
        if (btnNext && appState.currentStep === 1) btnNext.style.display = isStandaloneTool ? 'none' : 'inline-block';
        if (btnReupload) {
            var hasUploadForMode = isBatchAdBuild ? (appState.batchAdBuild.sites || []).length > 0 : !!(appState.data && appState.data.length);
            btnReupload.hidden = isStandaloneTool || appState.currentStep !== 1 || !hasUploadForMode;
        }
        var standardConfigPanel = document.querySelector('#step-4 .config-panel');
        if (standardConfigPanel) standardConfigPanel.hidden = isDifferentiated;
        var differentiatedCustomizer = document.getElementById('differentiated-customizer');
        if (differentiatedCustomizer) differentiatedCustomizer.hidden = !isDifferentiated;
        // 广告代码模式在模板配置后可用；旧站移植仍只接受完整旧站源码压缩包。
        var adsTab = document.querySelector('.config-tab[data-tab="ads"]');
        var adsSection = document.getElementById('tab-ads');
        if (adsTab) adsTab.hidden = isMigration;
        if (adsSection) adsSection.hidden = isMigration;
        if (adsSection) adsSection.querySelectorAll(':scope > .config-group').forEach(function(group) { group.hidden = isBatchAdBuild; });
        var batchCodeWorkspace = document.getElementById('batch-ad-code-workspace');
        if (batchCodeWorkspace) batchCodeWorkspace.hidden = !isBatchAdBuild;
        var legacyExport = document.getElementById('legacy-export-options');
        var differentiatedExport = document.getElementById('differentiated-export-options');
        var defaultExportButton = document.getElementById('btn-export');
        if (legacyExport) legacyExport.hidden = isDifferentiated || isBatchAdBuild;
        if (differentiatedExport) differentiatedExport.hidden = !isDifferentiated;
        if (defaultExportButton) defaultExportButton.hidden = isDifferentiated;
        var uploadHint = document.getElementById('upload-hint');
        if (uploadHint) uploadHint.textContent = isDifferentiated
            ? '推荐上传规范 ZIP（manifest + content + assets + provenance）；也支持单个 JSON 草稿'
            : '支持 .json 文件 或压缩包（.zip/.rar/.7z，含JSON+图片）';
        if (isMigration) renderMigrationResult();
        if (isRestoration) updateAdRestorationControls();
        if (isInjection) updateAdInjectionControls();
        if (isBatchAdBuild) {
            renderBatchDataList();
            renderBatchAdCodeWorkspace();
        }
        if (isDifferentiated) {
            renderDifferentiatedPackageStatus();
            populateDifferentiatedDesigns();
        }
    }

    function selectBuildMode(mode) {
        // 游戏建站保留独立的经典运行时，避免与资讯工具的全局生成器和状态相互覆盖。
        // 它位于同一发布包内，会随 Vite 构建一并输出。
        if (mode === 'game-builder') {
            window.location.assign('game-builder/index.html');
            return;
        }
        appState.siteBuildMode = mode === 'ad-migration' || mode === 'differentiated' || mode === 'ad-restoration' || mode === 'ad-injection' || mode === 'batch-ad-build' ? mode : 'normal';
        appState.adPlacementMode = null;
        if (appState.config) {
            appState.config.adPlacements = {};
            appState.config.adPaths = {};
        }
        if (appState.siteBuildMode !== 'ad-migration') appState.legacyAdMigration = null;
        else appState.adCodeMigration = null;
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
        'detail-after-content': '正文之后',
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

    function policyPositionOptions(page, selected) {
        var values = page === 'home' ? AdRestoration.homePlacements : AdRestoration.detailPlacements;
        return values.filter(function(value) { return value !== 'off'; }).map(function(value) {
            return '<option value="' + escapeHtml(value) + '"' + (value === selected ? ' selected' : '') + '>' + escapeHtml(policyPlacementLabels[value] || value) + '</option>';
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
            return '<section class="ad-policy-page-card" aria-label="' + title + '广告位配置"><header><div><strong>' + title + '广告位</strong><small>' + description + '</small></div><span>位置 + 单元</span></header>' +
                '<div class="ad-policy-slot-head"><span>序号</span><span>显示位置</span><span>使用单元</span></div>' +
                policy.slots[page].map(function(slot, index) {
                    return '<div class="ad-policy-slot-row"><strong>广告位 ' + (index + 1) + '</strong>' +
                        '<select data-policy-field="slots.' + page + '.' + index + '.position" aria-label="' + title + '广告位 ' + (index + 1) + ' 显示位置">' + policyPositionOptions(page, slot.position) + '</select>' +
                        '<select data-policy-field="slots.' + page + '.' + index + '.unit" aria-label="' + title + '广告位 ' + (index + 1) + ' 使用单元">' + policyUnitOptions(slot.unit) + '</select></div>';
                }).join('') + '</section>';
        }
        function checked(field) { return policyValue(policy, field) ? ' checked' : ''; }
        return '<div class="ad-policy-page-grid">' +
            pageCard('home', '首页', '每个位置可换成 banner1、2、3 或关闭') +
            pageCard('detail', '详情页', '三个位置与首页分开设置') +
            '</div><p class="ad-policy-unit-hint">选择一个已在本页使用的 banner 时，原广告位会自动关闭；这样可以直接把广告位 1 从 banner1 换成 banner2 或 banner3。</p>' +
            '<div class="ad-policy-oop"><strong>插屏</strong><label><input type="checkbox" data-policy-field="outOfPage.interstitial.home"' + checked('outOfPage.interstitial.home') + '>首页</label><label><input type="checkbox" data-policy-field="outOfPage.interstitial.detail"' + checked('outOfPage.interstitial.detail') + '>详情页</label>' +
            '<strong>锚点</strong><label><input type="checkbox" data-policy-field="outOfPage.anchor.home"' + checked('outOfPage.anchor.home') + '>首页</label><label><input type="checkbox" data-policy-field="outOfPage.anchor.detail"' + checked('outOfPage.anchor.detail') + '>详情页</label></div>' +
            '<label class="ad-policy-comment-option"><input type="checkbox" data-policy-field="writeDisabledComments"' + checked('writeDisabledComments') + '><span><strong>关闭项同时写入源码注释</strong><small>关闭的 banner 保留为 HTML 注释；插屏与锚点在 ad.js 中写入策略注释。所有原广告路径仍保留。</small></span></label>' +
            policyValidationMarkup(policy);
    }

    function populatePolicyEditor(editor, policy) {
        if (!editor || typeof AdRestoration === 'undefined') return;
        editor.innerHTML = policyEditorBody(policy);
    }

    function readPolicyEditor(editor) {
        var policy = AdRestoration.createPolicy();
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
        var unitMatch = field.match(/^slots\.(home|detail)\.(\d+)\.unit$/);
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
            var override = appState.adPolicyOverrides[site.id];
            var meta = valid
                ? (metadata.detectedHost || '已识别广告路径') + ' · ' + metadata.detailPaths.length + ' 个详情页'
                : (metadata.errors || []).map(function(item) { return item.message; }).join('；');
            return '<article class="ad-policy-site' + (valid ? '' : ' is-invalid') + '">' +
                '<div class="ad-policy-site-summary"><span class="ad-policy-site-index">' + (index + 1) + '</span><div class="ad-policy-site-copy"><strong>' + escapeHtml(site.name) + '</strong><small>' + escapeHtml(meta) + '</small></div>' +
                '<label class="ad-policy-override-toggle"><input type="checkbox" data-policy-override-index="' + index + '"' + (override ? ' checked' : '') + (valid ? '' : ' disabled') + '>单站覆盖</label></div>' +
                (override ? '<div class="ad-policy-override"><button type="button" class="ad-policy-override-copy" data-policy-copy-index="' + index + '">重新复制全局方案</button>' + policyEditorMarkup(override, index) + '</div>' : '') +
                '</article>';
        }).join('');

        list.querySelectorAll('[data-policy-override-index]').forEach(function(control) {
            control.addEventListener('change', function() {
                var site = appState.adPolicySites[Number(this.dataset.policyOverrideIndex)];
                if (!site) return;
                if (this.checked) appState.adPolicyOverrides[site.id] = cloneAdPolicy(appState.adPolicyGlobal);
                else delete appState.adPolicyOverrides[site.id];
                renderAdPolicySites();
                updateAdRestorationControls();
            });
        });
        list.querySelectorAll('[data-policy-copy-index]').forEach(function(button) {
            button.addEventListener('click', function() {
                var site = appState.adPolicySites[Number(this.dataset.policyCopyIndex)];
                if (!site) return;
                appState.adPolicyOverrides[site.id] = cloneAdPolicy(appState.adPolicyGlobal);
                renderAdPolicySites();
            });
        });
        list.querySelectorAll('[data-site-policy-index]').forEach(function(editor) {
            editor.addEventListener('change', function(event) {
                var site = appState.adPolicySites[Number(editor.dataset.sitePolicyIndex)];
                if (site) appState.adPolicyOverrides[site.id] = readChangedPolicyEditor(editor, event.target);
                updateAdRestorationControls();
            });
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
        if (runButton) runButton.disabled = adRestorationRunning || validCount === 0 || policyInvalid;
        if (codeExportButton) codeExportButton.disabled = adRestorationRunning || validCount === 0;
    }

    function renderAdRestorationResult(results, outputName, failedMessage, isFolder) {
        var target = document.getElementById('restoration-result');
        if (!target) return;
        results = results || [];
        var successful = results.filter(function(item) { return item.valid; });
        var failed = results.filter(function(item) { return !item.valid; });
        target.hidden = false;
        target.className = 'restoration-result ' + (successful.length ? 'is-success' : 'is-error');
        var heading = successful.length
            ? '已处理 ' + successful.length + ' 个站点' + (failed.length ? '，' + failed.length + ' 个未通过校验' : '')
            : (failedMessage || '策略处理未完成');
        var html = '<h4>' + escapeHtml(heading) + '</h4>';
        if (outputName) html += '<p>' + (isFolder ? '已生成新的站点总目录：' : '已开始下载：') + '<strong>' + escapeHtml(outputName) + '</strong></p>';
        if (results.length) {
            html += '<ul>' + results.map(function(item) {
                var detail = item.valid
                    ? '成功：' + (item.siteName || item.archiveName) + '（' + (item.overridden ? '单站覆盖' : '全局方案') + '，共 ' + item.changedPages + ' 个页面）'
                    : '失败：' + (item.siteName || item.archiveName) + '—' + (item.errors || []).map(function(error) { return error.message; }).join('；');
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

    function saveRestorationBlob(blob, fileName) {
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

    function initAdRestorationControls() {
        var directoryButton = document.getElementById('restoration-directory-button');
        var directoryInput = document.getElementById('restoration-directory-input');
        var siteButton = document.getElementById('restoration-sites-button');
        var siteInput = document.getElementById('restoration-sites-input');
        var runButton = document.getElementById('restoration-run');
        var codeExportButton = document.getElementById('restoration-export-code');
        if (!runButton || runButton.dataset.ready === 'true') return;
        runButton.dataset.ready = 'true';
        appState.adPolicyGlobal = AdRestoration.createPolicy();
        populatePolicyEditor(document.getElementById('ad-policy-global-editor'), appState.adPolicyGlobal);
        renderAdPolicySites();

        async function scanSource(mode, files) {
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
                var scan = mode === 'directory-handle'
                    ? await AdRestoration.readSiteDirectoryHandle(files, progressCallback)
                    : mode === 'directory'
                        ? await AdRestoration.readSiteDirectoryFiles(files, progressCallback)
                        : await AdRestoration.readSiteArchiveFiles(files, progressCallback);
                appState.adPolicySites = scan.sites;
                appState.adPolicySourceMode = mode === 'archives' ? 'archives' : 'directory';
                appState.adPolicyOverrides = {};
                if (scanFill) scanFill.style.width = '100%';
                if (scanText) scanText.textContent = '已识别 ' + scan.sites.length + ' 个站点、' + scan.fileCount + ' 个文件';
                renderAdPolicySites();
            } catch (error) {
                appState.adPolicySites = [];
                appState.adPolicySourceMode = '';
                if (scanText) scanText.textContent = '目录识别未完成';
                renderAdRestorationResult([], '', error.message, false);
            } finally {
                adRestorationRunning = false;
                updateAdRestorationControls();
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
        var globalEditor = document.getElementById('ad-policy-global-editor');
        if (globalEditor) globalEditor.addEventListener('change', function(event) {
            appState.adPolicyGlobal = readChangedPolicyEditor(globalEditor, event.target);
            var preset = document.getElementById('ad-policy-preset');
            if (preset) preset.value = 'custom';
            updateAdRestorationControls();
        });
        var presetSelect = document.getElementById('ad-policy-preset');
        if (presetSelect) presetSelect.addEventListener('change', function() {
            if (this.value === 'custom') return;
            var presetName = this.value === 'restore' ? undefined : this.value;
            appState.adPolicyGlobal = AdRestoration.createPolicy(presetName);
            populatePolicyEditor(globalEditor, appState.adPolicyGlobal);
            updateAdRestorationControls();
        });
        runButton.addEventListener('click', async function() {
            if (adRestorationRunning || typeof AdRestoration === 'undefined') return;
            var destinationHandle = null;
            if (typeof window.showDirectoryPicker === 'function') {
                try {
                    destinationHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                } catch (pickerError) {
                    if (pickerError && pickerError.name === 'AbortError') return;
                }
            }
            adRestorationRunning = true;
            updateAdRestorationControls();
            var progress = document.getElementById('restoration-progress');
            var fill = document.getElementById('restoration-progress-fill');
            var textTarget = document.getElementById('restoration-progress-text');
            var resultTarget = document.getElementById('restoration-result');
            if (progress) progress.hidden = false;
            if (resultTarget) resultTarget.hidden = true;
            if (fill) fill.style.width = '0%';
            try {
                appState.adPolicyGlobal = readPolicyEditor(globalEditor);
                var output = await AdRestoration.applyPolicyBatch(
                    appState.adPolicySites,
                    appState.adPolicyGlobal,
                    appState.adPolicyOverrides,
                    function(percent, message) {
                        if (fill) fill.style.width = Math.min(percent, 88) + '%';
                        if (textTarget) textTarget.textContent = message;
                    }
                );
                if (destinationHandle) {
                    await AdRestoration.writePolicyBatchToDirectory(output, destinationHandle, function(percent, message) {
                        if (fill) fill.style.width = (88 + Math.round(percent * .12)) + '%';
                        if (textTarget) textTarget.textContent = message;
                    });
                    renderAdRestorationResult(output.results, output.folderName, '', true);
                } else {
                    if (textTarget) textTarget.textContent = '当前浏览器不支持目录写入，正在生成批量 ZIP…';
                    var blob = await AdRestoration.zipPolicyBatch(output);
                    var fileName = output.folderName + '.zip';
                    saveRestorationBlob(blob, fileName);
                    if (fill) fill.style.width = '100%';
                    renderAdRestorationResult(output.results, fileName, '', false);
                }
            } catch (error) {
                if (textTarget) textTarget.textContent = '策略处理未完成';
                renderAdRestorationResult(error.results || [], '', error.message, false);
            } finally {
                adRestorationRunning = false;
                updateAdRestorationControls();
            }
        });
        if (codeExportButton) codeExportButton.addEventListener('click', async function() {
            if (adRestorationRunning || typeof AdRestoration === 'undefined') return;
            adRestorationRunning = true;
            updateAdRestorationControls();
            var progress = document.getElementById('restoration-progress');
            var fill = document.getElementById('restoration-progress-fill');
            var textTarget = document.getElementById('restoration-progress-text');
            var resultTarget = document.getElementById('restoration-result');
            if (progress) progress.hidden = false;
            if (resultTarget) resultTarget.hidden = true;
            if (fill) fill.style.width = '0%';
            try {
                if (textTarget) textTarget.textContent = '正在导出识别到的广告代码…';
                var output = await AdRestoration.exportRecognizedCodesForGroups(appState.adPolicySites);
                if (fill) fill.style.width = '100%';
                saveRestorationBlob(output.blob, output.fileName);
                renderRecognizedCodeResult(output.results, output.fileName, '');
            } catch (error) {
                if (textTarget) textTarget.textContent = '广告代码识别未完成';
                renderRecognizedCodeResult(error.results || [], '', error.message);
            } finally {
                adRestorationRunning = false;
                updateAdRestorationControls();
            }
        });
        updateAdRestorationControls();
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
        var runButton = document.getElementById('injection-run');
        if (runButton) runButton.disabled = adInjectionRunning || match.validCount === 0;
    }

    function renderAdInjectionResult(results, outputName, failedMessage, isFolder) {
        var target = document.getElementById('injection-result');
        if (!target) return;
        results = results || [];
        var successful = results.filter(function(item) { return item.valid; });
        var failed = results.filter(function(item) { return !item.valid; });
        target.hidden = false;
        target.className = 'injection-result ' + (successful.length ? 'is-success' : 'is-error');
        var heading = successful.length
            ? '已为 ' + successful.length + ' 个成品站加入广告' + (failed.length ? '，' + failed.length + ' 个未通过校验' : '')
            : (failedMessage || '成品站广告注入未完成');
        var html = '<h4>' + escapeHtml(heading) + '</h4>';
        if (outputName) html += '<p>' + (isFolder ? '已生成新目录：' : '已开始下载：') + '<strong>' + escapeHtml(outputName) + '</strong></p>';
        if (results.length) html += '<ul>' + results.map(function(item) {
            var detail = item.valid
                ? '成功：' + item.siteName + '（' + item.framework + '，' + item.host + '，修改 ' + item.changedPages + ' 个入口/页面）'
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
        var runButton = document.getElementById('injection-run');
        if (!runButton || runButton.dataset.ready === 'true') return;
        runButton.dataset.ready = 'true';

        async function scanSource(mode, source) {
            var progress = document.getElementById('injection-scan-progress');
            var fill = document.getElementById('injection-scan-progress-fill');
            var textTarget = document.getElementById('injection-scan-progress-text');
            var resultTarget = document.getElementById('injection-result');
            if (progress) progress.hidden = false;
            if (fill) fill.style.width = '0%';
            if (resultTarget) resultTarget.hidden = true;
            adInjectionRunning = true;
            updateAdInjectionControls();
            try {
                var progressCallback = function(percent, message) { if (fill) fill.style.width = percent + '%'; if (textTarget) textTarget.textContent = message; };
                var scan = mode === 'directory-handle'
                    ? await AdRestoration.readInjectableDirectoryHandle(source, progressCallback)
                    : mode === 'directory'
                        ? await AdRestoration.readInjectableDirectoryFiles(source, progressCallback)
                        : await AdRestoration.readInjectableArchiveFiles(source, progressCallback);
                appState.adInjectionSites = scan.sites;
                appState.adInjectionSourceMode = mode === 'archives' ? 'archives' : 'directory';
                if (fill) fill.style.width = '100%';
                if (textTarget) textTarget.textContent = '已识别 ' + scan.sites.length + ' 个成品站、' + scan.fileCount + ' 个文件';
            } catch (error) {
                appState.adInjectionSites = [];
                appState.adInjectionSourceMode = '';
                if (textTarget) textTarget.textContent = '成品站识别未完成';
                renderAdInjectionResult([], '', error.message, false);
            } finally {
                adInjectionRunning = false;
                updateAdInjectionControls();
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
            } catch (error) {
                appState.adInjectionCodes = [];
                renderAdInjectionResult([], '', error.message, false);
            } finally {
                adInjectionRunning = false;
                updateAdInjectionControls();
            }
        });
        runButton.addEventListener('click', async function() {
            if (adInjectionRunning) return;
            var destinationHandle = null;
            if (typeof window.showDirectoryPicker === 'function') {
                try { destinationHandle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'finished-site-ad-output' }); }
                catch (pickerError) { if (pickerError && pickerError.name === 'AbortError') return; }
            }
            adInjectionRunning = true;
            updateAdInjectionControls();
            var progress = document.getElementById('injection-progress');
            var fill = document.getElementById('injection-progress-fill');
            var textTarget = document.getElementById('injection-progress-text');
            var resultTarget = document.getElementById('injection-result');
            if (progress) progress.hidden = false;
            if (fill) fill.style.width = '0%';
            if (resultTarget) resultTarget.hidden = true;
            try {
                var output = await AdRestoration.applyAdCodeBatch(appState.adInjectionSites, appState.adInjectionCodes, function(percent, message) {
                    if (fill) fill.style.width = Math.min(percent, 88) + '%';
                    if (textTarget) textTarget.textContent = message;
                });
                if (destinationHandle) {
                    await AdRestoration.writePolicyBatchToDirectory(output, destinationHandle, function(percent, message) {
                        if (fill) fill.style.width = (88 + Math.round(percent * .12)) + '%';
                        if (textTarget) textTarget.textContent = message;
                    });
                    renderAdInjectionResult(output.results, output.folderName, '', true);
                } else {
                    if (textTarget) textTarget.textContent = '正在生成成品站广告注入 ZIP…';
                    var blob = await AdRestoration.zipPolicyBatch(output);
                    var fileName = output.folderName + '.zip';
                    saveRestorationBlob(blob, fileName);
                    if (fill) fill.style.width = '100%';
                    renderAdInjectionResult(output.results, fileName, '', false);
                }
            } catch (error) {
                if (textTarget) textTarget.textContent = '成品站广告注入未完成';
                renderAdInjectionResult(error.results || [], '', error.message, false);
            } finally {
                adInjectionRunning = false;
                updateAdInjectionControls();
            }
        });
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
    function getCategoryIconPickerChoices(domainPool, activeIcon) {
        var choices = [];
        var addIcon = function(icon) {
            icon = getCompatibleCategoryEmoji(icon);
            if (icon && choices.indexOf(icon) === -1) choices.push(icon);
        };
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
            var choices = getCategoryIconPickerChoices(pool, category.icon);
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
        appState.differentiatedPackage = null;
        appState.packageAssets = {};
        appState.differentiatedImportName = '';
        appState.adCodeMigration = null;
        if (appState.config) {
            appState.config.adPlacements = {};
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
        document.querySelectorAll('.diff-config-tab').forEach(function(tab) { tab.addEventListener('click', function() { var name = this.dataset.diffTab; document.querySelectorAll('.diff-config-tab').forEach(function(item) { var active = item === tab; item.classList.toggle('active', active); item.setAttribute('aria-selected', active ? 'true' : 'false'); }); document.querySelectorAll('.diff-config-section').forEach(function(section) { var active = section.dataset.diffSection === name; section.hidden = !active; section.classList.toggle('active', active); }); }); });
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

    function getActiveBatchSite() {
        var batch = appState.batchAdBuild || { sites: [] };
        var sites = batch.sites || [];
        if (!sites.length) return null;
        var index = Number(batch.activeSiteIndex);
        if (!Number.isInteger(index) || index < 0 || index >= sites.length) index = 0;
        batch.activeSiteIndex = index;
        return sites[index];
    }

    // 批量流程仍复用单站预览与配置面板；切换时必须把当前站的图片、字段与配置完整带入，
    // 否则归档包内的相对图片路径会被当成在线 URL，从而在 iframe 中显示为破图。
    function syncBatchActiveSiteToApp() {
        if (!isBatchAdBuild()) return null;
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
        appState.adCodeMigration = (appState.batchAdBuild.codes || []).find(function(code) {
            return code.id === site.codeId && code.valid;
        }) || null;
        return site;
    }

    function getBatchTemplateOwner(templateId, exceptSite) {
        if (!isBatchAdBuild() || !templateId) return null;
        return (appState.batchAdBuild.sites || []).find(function(site) {
            return site !== exceptSite && site.config && site.config.templateId === templateId;
        }) || null;
    }

    function getBatchTemplateIssue(site) {
        if (!site || !THEMES[site.themeId]) return '尚未确认领域';
        if (!site || !site.config || !site.config.templateId) return '尚未分配独立模板';
        var owner = getBatchTemplateOwner(site.config.templateId, site);
        return owner ? '与“' + (owner.fileName || '另一个站点') + '”重复使用模板' : '';
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
            var label = '站点 ' + (index + 1) + '：' + (site.fileName || '未命名数据源');
            return '<button type="button" class="batch-preview-site-tab" role="tab" id="batch-preview-site-tab-' + index + '" aria-selected="' + (selected ? 'true' : 'false') + '" aria-controls="preview-frame" aria-label="' + escapeHtml(label) + '" title="' + escapeHtml(label) + '" tabindex="' + (selected ? '0' : '-1') + '" data-batch-preview-site-index="' + index + '">' + String(index + 1).padStart(2, '0') + '</button>';
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
            var label = '站点 ' + (index + 1) + '：' + (site.fileName || '未命名数据源') + (profile ? '，' + profile.label : '，等待确认领域');
            return '<button type="button" class="batch-domain-site-tab" role="tab" id="batch-domain-site-tab-' + index + '" aria-selected="' + (selected ? 'true' : 'false') + '" aria-controls="domain-detection" aria-label="' + escapeHtml(label) + '" title="' + escapeHtml(label) + '" tabindex="' + (selected ? '0' : '-1') + '" data-batch-domain-site-index="' + index + '">站点 ' + String(index + 1).padStart(2, '0') + '</button>';
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

    async function importBatchDataFiles(files) {
        if (typeof BatchAdBuilder === 'undefined') {
            showNotice('批量建站组件未加载。请刷新页面后重试。', '无法读取数据源');
            return;
        }
        var list = Array.from(files || []);
        if (list.length < 2) {
            showNotice('批量建站至少需要选择两份 JSON、ZIP、RAR 或 7Z 数据源。', '数据源数量不足');
            return;
        }
        try {
            var loaded = await Promise.all(list.map(function(file, index) { return readBatchDataSource(file, index); }));
            appState.batchAdBuild = { sites: loaded, codes: [], activeSiteIndex: 0 };
            appState.adCodeMigration = null;
            // 每个数据源独立分析，严禁把第一份数据的医疗/科技等结果套用给同批其他站点。
            loaded.forEach(function(site) {
                site.domainDetection = DomainEngine.detect(site.data, DOMAIN_CATALOG, { fileName: site.fileName });
                if (site.domainDetection.suggestedId) configureBatchSiteTheme(site, site.domainDetection.suggestedId, 'auto');
            });
            syncBatchActiveSiteToApp();
            updateThemeCardSelection(appState.selectedTheme);
            renderBatchDomainSiteTabs();
            renderDomainDetection();
            renderBatchDataList();
            renderBatchPreviewSiteTabs();
        } catch (error) {
            showNotice(error.message, '无法读取批量数据源');
        }
    }

    async function readBatchDataSource(file, index) {
        var ext = String(file && file.name || '').split('.').pop().toLowerCase();
        var data;
        var localImages = {};
        if (ext === 'json') {
            data = BatchAdBuilder.normalizeData(parseUploadedJson(await file.text()));
        } else if (ext === 'zip') {
            if (!window.JSZip) throw new Error('ZIP 解析组件未加载，请刷新页面后重试。');
            var zip = await window.JSZip.loadAsync(await file.arrayBuffer());
            var jsonPath = Object.keys(zip.files).find(function(path) { return !zip.files[path].dir && /\.json$/i.test(path); });
            if (!jsonPath) throw new Error(file.name + ' 中没有找到 JSON 数据文件。');
            data = BatchAdBuilder.normalizeData(parseUploadedJson(await zip.files[jsonPath].async('text')));
            var imagePaths = Object.keys(zip.files).filter(function(path) { return !zip.files[path].dir && /\.(?:jpg|jpeg|png|gif|webp|svg)$/i.test(path); });
            await Promise.all(imagePaths.map(async function(path) { localImages[path] = await zip.files[path].async('blob'); }));
        } else if (ext === 'rar' || ext === '7z') {
            var Archive = await ensureArchiveRuntime();
            var archive = await Archive.open(file);
            var entries;
            try {
                await archive.extractFiles();
                entries = await archive.getFilesArray();
            } finally {
                archive.close();
            }
            var jsonEntry = entries.find(function(entry) { return entry.file && /\.json$/i.test(String(entry.path || '') + String(entry.file.name || '')); });
            if (!jsonEntry) throw new Error(file.name + ' 中没有找到 JSON 数据文件。');
            data = BatchAdBuilder.normalizeData(parseUploadedJson(await jsonEntry.file.text()));
            entries.filter(function(entry) { return entry.file && /\.(?:jpg|jpeg|png|gif|webp|svg)$/i.test(String(entry.path || '') + String(entry.file.name || '')); }).forEach(function(entry) {
                localImages[(String(entry.path || '') + String(entry.file.name || '')).replace(/\\/g, '/')] = entry.file;
            });
        } else {
            throw new Error(file.name + ' 不支持；批量建站只接受 .json 或包含 JSON+图片的 .zip、.rar、.7z。');
        }
        if (!data.length) throw new Error(file.name + ' 不是包含对象列表的有效数据源。');
        return {
            id: 'batch-site-' + index + '-' + Date.now(), fileName: file.name, data: data,
            jsonFields: BatchAdBuilder.collectFields(data), fieldMapping: {}, codeId: '',
            isLocalImages: Object.keys(localImages).length > 0, localImages: localImages,
            themeId: '', domainDetection: null, domainSelectionSource: null, config: null
        };
    }

    function renderBatchAdCodeWorkspace() {
        var target = document.getElementById('batch-ad-code-list');
        var summary = document.getElementById('batch-ad-code-summary');
        if (!target || !summary || !isBatchAdBuild()) return;
        var batch = appState.batchAdBuild || { sites: [], codes: [] };
        if (!batch.sites.length) {
            target.innerHTML = '<p class="batch-ad-empty">请先完成第一步的数据源导入。</p>';
            summary.textContent = '等待数据源';
            return;
        }
        var report = typeof BatchAdBuilder !== 'undefined' ? BatchAdBuilder.validateAssignments(batch.sites, batch.codes) : { valid: false, errors: [] };
        var validCodes = batch.codes.filter(function(code) { return code.valid; }).length;
        summary.textContent = batch.codes.length ? (validCodes + '/' + batch.codes.length + ' 份代码可用') : '尚未上传';
        summary.className = report.valid ? 'is-valid' : '';
        var options = '<option value="">-- 请选择独占代码 --</option>' + batch.codes.map(function(code) {
            var label = (code.valid ? '✓ ' : '✕ ') + code.fileName + (code.detectedHost ? ' · ' + code.detectedHost : '');
            return '<option value="' + escapeHtml(code.id) + '">' + escapeHtml(label) + '</option>';
        }).join('');
        target.innerHTML = batch.sites.map(function(site, index) {
            var assigned = batch.codes.find(function(code) { return code.id === site.codeId; });
            var problem = !THEMES[site.themeId] ? '领域待确认' : (batchSiteIssues(site).length ? '字段未完成' : (assigned && assigned.valid ? '等待导出复检' : '需要有效广告代码'));
            var selectedOptions = options.replace('value="' + escapeHtml(site.codeId) + '"', 'value="' + escapeHtml(site.codeId) + '" selected');
            return '<article class="batch-ad-code-item ' + (assigned && assigned.valid ? 'is-ready' : 'is-invalid') + '"><span class="batch-ad-item-index">' + (index + 1) + '</span><div><strong>' + escapeHtml(site.fileName) + '</strong><span>' + escapeHtml(problem) + '</span></div><label><span>广告 TXT</span><select data-batch-ad-site="' + escapeHtml(site.id) + '">' + selectedOptions + '</select></label></article>';
        }).join('') + (report.errors.length ? '<div class="batch-ad-validation invalid"><strong>尚不能导出</strong><ul>' + report.errors.map(function(error) { return '<li>' + escapeHtml(error.message) + '</li>'; }).join('') + '</ul></div>' : '<div class="batch-ad-validation"><strong>一对一分配校验通过</strong><span>导出时还会检查每个生成站的首页、详情页与广告运行时。</span></div>');
        target.querySelectorAll('[data-batch-ad-site]').forEach(function(select) {
            select.addEventListener('change', function() {
                var site = batch.sites.find(function(candidate) { return candidate.id === select.dataset.batchAdSite; });
                if (site) site.codeId = select.value;
                if (site === getActiveBatchSite()) syncBatchActiveSiteToApp();
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

    // ========== 步骤导航 ==========
    function goToStep(step) {
        if (step < 1 || step > 5) return;

        // 验证当前步骤是否完成
        if (step > appState.currentStep) {
            if (!validateStep(appState.currentStep)) return;
        }

        appState.currentStep = step;

        // 更新面板显示
        stepPanels.forEach(function(panel) {
            panel.classList.remove('active');
        });
        document.getElementById('step-' + step).classList.add('active');

        // 更新进度条
        stepItems.forEach(function(item, idx) {
            var s = idx + 1;
            item.classList.remove('active', 'completed');
            if (s < step) item.classList.add('completed');
            if (s === step) item.classList.add('active');
            if (s === step) item.setAttribute('aria-current', 'step');
            else item.removeAttribute('aria-current');
            item.disabled = s >= step;
        });

        // 更新按钮
        btnPrev.style.display = step > 1 ? 'inline-block' : 'none';
        if (btnReupload) btnReupload.hidden = !(step === 1 && appState.data && appState.data.length);
        updateNextButtonLabel(step === 5 ? '完成' : '下一步 →');
        btnNext.style.display = step === 5 ? 'none' : 'inline-block';
        updateWorkflowActionContext(step);

        // 步骤5：生成导出摘要
        if (step === 5) {
            generateExportSummary();
        }

        // 步骤4：更新预览
        if (step === 4) {
            updatePreview();
        }
    }

    function validateStep(step) {
        switch(step) {
            case 1:
                if (appState.siteBuildMode === 'ad-restoration') {
                    showNotice('批量广告策略是第一步内的独立工具。选择站点总目录，设置全局方案和需要的单站覆盖后，直接生成新的站点总目录。', '无需进入后续建站步骤');
                    return false;
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
                if (isBatchAdBuild()) {
                    var batchReport = typeof BatchAdBuilder !== 'undefined' ? BatchAdBuilder.validateAssignments(appState.batchAdBuild.sites, appState.batchAdBuild.codes) : { valid: false, errors: [{ message: '批量建站组件未加载。' }] };
                    if (!batchReport.valid) {
                        showNotice(batchReport.errors[0] ? batchReport.errors[0].message : '请完成每站一份广告代码的独占分配。', '广告代码尚未完成');
                        return false;
                    }
                }
                return true;
            default:
                return true;
        }
    }

    btnPrev.addEventListener('click', function() {
        goToStep(appState.currentStep - 1);
    });

    if (btnReupload) btnReupload.addEventListener('click', function() {
        // 取消文件选择时保留已成功导入的数据，避免用户意外丢失当前工作。
        openFilePicker();
    });

    btnNext.addEventListener('click', function() {
        goToStep(appState.currentStep + 1);
    });

    // 点击步骤进度条跳转（仅已完成的步骤）
    stepItems.forEach(function(item) {
        item.addEventListener('click', function() {
            var step = parseInt(this.dataset.step);
            if (step < appState.currentStep) {
                goToStep(step);
            }
        });
    });

    // ========== Step 2: 自动识别并确认领域 ==========
    function getBlueprintsForTheme(themeId) {
        var profile = DOMAIN_CATALOG[themeId];
        var ids = profile && profile.blueprints ? profile.blueprints : [];
        var matches = ids.map(function(id) {
            return TEMPLATE_PRESETS.find(function(template) { return template.id === id; });
        }).filter(function(template) {
            return template && template.domainId === themeId;
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
                '<div class="theme-card-head"><div class="theme-icon domain-glyph" aria-hidden="true">' + profile.icon + '</div>' +
                '<span class="theme-choice" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m5 10 3 3 7-7"></path></svg></span></div>' +
                '<h3>' + profile.label + '</h3><p class="theme-name-en">' + profile.nameEn + '</p>' +
                '<p class="theme-desc">' + profile.description + '</p><ul class="theme-fields-preview"><li>' + fields + '</li></ul></div>';
        }).join('');
        document.getElementById('theme-count').textContent = Object.keys(DOMAIN_CATALOG).length + ' 个可识别领域';
        document.getElementById('domain-visible-count').textContent = Object.keys(DOMAIN_CATALOG).length;
    }

    function createThemeConfig(themeId) {
        var theme = THEMES[themeId];
        var defaultTemplate = getBlueprintsForTheme(themeId)[0];
        return {
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

    function handleFile(file) {
        var ext = file.name.split('.').pop().toLowerCase();

        if (ext === 'json') {
            if (appState.siteBuildMode === 'differentiated') clearDifferentiatedImport();
            var reader = new FileReader();
            reader.onload = function(e) {
                try {
                    var data = parseUploadedJson(e.target.result);
                    if (appState.siteBuildMode === 'differentiated') {
                        var imported = DifferentiatedBuilder.importJsonData(data, appState.differentiated.siteType);
                        applyDifferentiatedImport(imported, file.name);
                        processData(imported.data, false, {}, false, { fileName: file.name });
                        return;
                    }
                    processData(data, false, {}, false, { fileName: file.name });
                } catch (err) {
                    showNotice('JSON 文件解析失败：' + err.message, '无法读取文件');
                }
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
            showNotice('ZIP 解析组件未加载。请刷新页面后重试；工具会优先从本地加载该组件。', '无法读取压缩包');
            return;
        }
        var reader = new FileReader();
        reader.onload = function(e) {
            window.JSZip.loadAsync(e.target.result).then(function(zip) {
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
                    showNotice('ZIP 文件中未找到 JSON 数据文件。请确认压缩包内包含可用的 JSON 文件。', '找不到数据文件');
                    return;
                }

                // 读取JSON
                jsonFile.async('string').then(function(jsonStr) {
                    try {
                        var data = parseUploadedJson(jsonStr);
                        var hasLocalImages = Object.keys(images).length > 0;

                        // 如果有本地图片，需要读取图片为blob
                        if (hasLocalImages) {
                            var imagePromises = [];
                            var imageMap = {};
                            Object.keys(images).forEach(function(path) {
                                imagePromises.push(
                                    images[path].async('blob').then(function(blob) {
                                        imageMap[path] = blob;
                                    })
                                );
                            });
                            Promise.all(imagePromises).then(function() {
                                processData(data, true, imageMap, false, { fileName: file.name, entryPath: jsonFilePath });
                            });
                        } else {
                            processData(data, false, {}, false, { fileName: file.name, entryPath: jsonFilePath });
                        }
                    } catch (err) {
                        showNotice('JSON 文件解析失败：' + err.message, '无法读取数据');
                    }
                });
            }).catch(function(err) {
                var ext = file.name.split('.').pop().toLowerCase();
                if (ext === 'rar' || ext === '7z') {
                    showNotice('暂不支持 .' + ext + ' 格式的直接解析。请将压缩包解压后重新打包为 .zip 格式再上传。', '无法读取压缩包');
                } else {
                    showNotice('压缩包读取失败：' + err.message, '无法读取压缩包');
                }
            });
        };
        reader.readAsArrayBuffer(file);
    }

    async function handleDifferentiatedZipFile(file) {
        if (typeof window.JSZip === 'undefined' || typeof DifferentiatedBuilder === 'undefined') {
            showNotice('差异化 ZIP 解析组件未加载，请刷新页面后重试。', '无法读取压缩包');
            return;
        }
        clearDifferentiatedImport();
        uploadArea.classList.add('is-reading-archive');
        uploadArea.setAttribute('aria-busy', 'true');
        fileInput.disabled = true;
        renderDifferentiatedPackageStatus('正在读取 manifest、内容、素材与来源记录…', 'pending');
        try {
            var imported = await DifferentiatedBuilder.importZip(file, appState.differentiated.siteType, { JSZip: window.JSZip });
            applyDifferentiatedImport(imported, file.name);
            processData(imported.data, Object.keys(imported.localImages || {}).length > 0, imported.localImages || {}, true, { fileName: file.name });
        } catch (error) {
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

        // 某些静态服务器会命中旧的 index 缓存而漏载初始化脚本。
        // 此处直接按绝对地址导入模块，不再依赖动态 script 标签的 currentScript 状态。
        var moduleUrl = new URL('js/vendor/libarchive/libarchive.js?v=20260912-archive-runtime-2', document.baseURI).href;
        var workerUrl = new URL('js/vendor/libarchive/worker-bundle.js?v=20260912-archive-runtime-2', document.baseURI).href;
        window.__archiveRuntimeFallbackLoad = import(moduleUrl).then(function(module) {
            module.Archive.init({ workerUrl: workerUrl });
            return module.Archive;
        });
        return window.__archiveRuntimeFallbackLoad;
    }

    function handleArchiveFile(file, archiveType) {
        uploadArea.classList.add('is-reading-archive');
        uploadArea.setAttribute('aria-busy', 'true');
        fileInput.disabled = true;
        ensureArchiveRuntime().then(function(Archive) {
            return Archive.open(file).then(function(archive) {
                return archive.extractFiles().then(function() {
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
                showNotice(archiveType.toUpperCase() + ' 文件中未找到 JSON 数据文件。请确认压缩包内包含可用的 JSON 文件。', '找不到数据文件');
                return;
            }

            return jsonEntry.file.text().then(function(jsonStr) {
                var data;
                try {
                    data = parseUploadedJson(jsonStr);
                } catch (err) {
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
            });
        }).catch(function(err) {
            var details = err && err.message ? '：' + err.message : '';
            showNotice(archiveType.toUpperCase() + ' 压缩包读取失败' + details + '。请确认文件未加密、未分卷且未损坏；若问题持续，请刷新页面后重试。', '无法读取压缩包');
        }).finally(function() {
            uploadArea.classList.remove('is-reading-archive');
            uploadArea.setAttribute('aria-busy', 'false');
            fileInput.disabled = false;
        });
    }

    function processData(data, isLocalImages, localImages, skipLocalImageWarning, source) {
        // 兼容对象包裹格式
        if (!Array.isArray(data)) {
            var keys = Object.keys(data);
            for (var i = 0; i < keys.length; i++) {
                if (Array.isArray(data[keys[i]])) {
                    data = data[keys[i]];
                    break;
                }
            }
        }

        if (!Array.isArray(data) || data.length === 0) {
            showNotice('JSON 数据格式不正确或为空。请上传包含对象列表的数据文件。', '无法导入数据');
            return;
        }

        appState.data = data;
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

        appState.fieldMapping = {};

        // 尝试自动匹配：按字段名相同匹配
        theme.fields.forEach(function(tf) {
            var match = appState.jsonFields.find(function(jf) {
                return jf.name.toLowerCase() === tf.id.toLowerCase() ||
                       jf.name.toLowerCase() === tf.label.toLowerCase();
            });
            if (match) {
                appState.fieldMapping[tf.id] = match.name;
            }
        });
    }

    function renderFieldMapping() {
        if (isBatchAdBuild()) {
            renderBatchFieldMapping();
            return;
        }
        var theme = THEMES[appState.selectedTheme];
        if (!theme) return;

        var container = document.getElementById('mapping-container');
        var html = '<div class="mapping-column left"><h4>📝 主题字段</h4>';
        theme.fields.forEach(function(tf) {
            html += '<div class="mapping-item">';
            html += '<span class="field-name">' + tf.label + '</span>';
            html += '<span class="field-label-zh">' + tf.labelZh + '</span>';
            if (tf.required) html += '<span class="required-mark">*</span>';
            html += '<select class="mapping-select" data-theme-field="' + tf.id + '"' +
                (tf.required ? ' data-required="true"' : '') + '>';
            html += '<option value="">-- 不匹配 --</option>';
            appState.jsonFields.forEach(function(jf) {
                var selected = appState.fieldMapping[tf.id] === jf.name ? ' selected' : '';
                html += '<option value="' + jf.name + '"' + selected + '>' + jf.name + ' (' + jf.type + ')</option>';
            });
            html += '</select></div>';
        });
        html += '</div>';

        html += '<div class="mapping-column right"><h4>📊 JSON数据字段</h4>';
        appState.jsonFields.forEach(function(jf) {
            var matched = Object.values(appState.fieldMapping).indexOf(jf.name) !== -1;
            html += '<div class="mapping-item' + (matched ? ' mapped' : '') + '">';
            html += '<span class="field-name">' + jf.name + '</span>';
            html += '<span class="field-label-zh">(' + jf.type + ')</span>';
            html += matched ? ' ✓' : '';
            html += '</div>';
        });
        html += '</div>';

        container.innerHTML = html;

        // 绑定事件
        var selects = container.querySelectorAll('.mapping-select');
        selects.forEach(function(select) {
            select.addEventListener('change', function() {
                var themeField = this.dataset.themeField;
                if (this.value) {
                    appState.fieldMapping[themeField] = this.value;
                    this.classList.add('mapped');
                } else {
                    delete appState.fieldMapping[themeField];
                    this.classList.remove('mapped');
                }
                updateMappingSummary();
            });
        });

        updateMappingSummary();
    }

    function updateMappingSummary() {
        var theme = THEMES[appState.selectedTheme];
        var total = theme.fields.length;
        var mapped = Object.keys(appState.fieldMapping).length;
        var unmapped = total - mapped;

        var summary = document.getElementById('mapping-summary');
        var text = document.getElementById('mapping-summary-text');

        text.textContent = '已匹配 ' + mapped + ' 个字段，未匹配 ' + unmapped + ' 个字段（未匹配字段将不在网站中展示）';
        summary.style.display = 'block';
    }

    // ========== Step 4: 配置面板 ==========
    function initConfigPanel() {
        var theme = THEMES[appState.selectedTheme];
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
        updateCategoryConfig(theme.categories.length);

        // 其他配置事件
        initFontOptions();
        initBrandControls();
        initLogoIconControls();
        initTemplateGrid();
        initIconSetControls();
        initStyleGrid();
        bindConfigEvents();
        initConfigTabs();
        initPreviewControls();
        initAdConfig();
    }

    // ========== 页面模板蓝图 ==========
    function getTemplateById(id) {
        var match = TEMPLATE_PRESETS.find(function(template) { return template.id === id && template.domainId === appState.selectedTheme; });
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
        c.templateId = template.id;

        Object.keys(template.structure || {}).forEach(function(key) {
            // Hero visibility and navigation layout are operator preferences, not template side effects.
            // New sites start with Hero off and regular navigation; templates must not change either choice.
            if (key !== 'heroEnabled' && key !== 'navbarLayout') c[key] = template.structure[key];
        });
        Object.keys(template.style || {}).forEach(function(key) {
            c[key] = template.style[key];
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

        var html = '';
        var profile = DOMAIN_CATALOG[appState.selectedTheme];
        var activeSite = getActiveBatchSite();
        getBlueprintsForTheme(appState.selectedTheme).forEach(function(template, index) {
            var selected = appState.config.templateId === template.id ? ' selected' : '';
            var owner = isBatchAdBuild() ? getBatchTemplateOwner(template.id, activeSite) : null;
            var unavailable = !!owner;
            html += '<div class="template-card' + selected + (unavailable ? ' is-unavailable' : '') + '" data-template-id="' + template.id + '"' + (unavailable ? ' data-template-unavailable="true" tabindex="-1" aria-disabled="true" aria-label="' + escapeHtml(template.name + '模板已用于' + owner.fileName) + '"' : ' tabindex="0" role="button" aria-label="应用' + template.name + '模板"') + '>';
            html += '<div class="template-icon">' + template.icon + '</div>';
            html += '<div><div class="template-name">' + template.name + (index === 0 ? '<span class="recommended-badge">首选</span>' : '') + '</div>' +
                '<div class="template-domain">' + (unavailable ? '已用于站点 ' + ((appState.batchAdBuild.sites || []).indexOf(owner) + 1) : profile.label + '专属') + '</div></div>';
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
        (appState.config.categories || []).forEach(function(category, index) {
            if (iconSet.icons[index]) category.icon = iconSet.icons[index];
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

    // 将配置区原生下拉框替换为统一的轻量菜单，避免系统弹层破坏左侧布局。
    function syncStyledSelects() {
        document.querySelectorAll('.config-panel select.select-native').forEach(function(select) {
            var shell = select.closest('.select-shell');
            if (!shell) return;
            var trigger = shell.querySelector('.select-trigger');
            var selected = select.options[select.selectedIndex];
            if (trigger) {
                trigger.textContent = selected ? selected.textContent : '请选择';
                trigger.title = selected ? selected.textContent : '请选择';
            }
            shell.querySelectorAll('.select-option').forEach(function(optionButton) {
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

    function closeStyledSelects() {
        closeCategoryIconPickers();
        document.querySelectorAll('.select-shell.open').forEach(function(shell) {
            shell.classList.remove('open');
            var configItem = shell.closest('.config-item');
            if (configItem) configItem.classList.remove('select-open');
            var configGroup = shell.closest('.config-group');
            if (configGroup) configGroup.classList.remove('select-open-group');
            var trigger = shell.querySelector('.select-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
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

    function rebuildStyledSelect(select) {
        var shell = select.closest('.select-shell');
        if (!shell) {
            shell = document.createElement('div');
            shell.className = 'select-shell';
            select.parentNode.insertBefore(shell, select);
            shell.appendChild(select);
            select.classList.add('select-native');

            var trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.className = 'select-trigger';
            trigger.setAttribute('aria-haspopup', 'listbox');
            trigger.setAttribute('aria-expanded', 'false');

            var newMenu = document.createElement('div');
            newMenu.className = 'select-menu';
            newMenu.setAttribute('role', 'listbox');

            shell.appendChild(trigger);
            shell.appendChild(newMenu);

            trigger.addEventListener('click', function(event) {
                event.stopPropagation();
                var willOpen = !shell.classList.contains('open');
                closeStyledSelects();
                shell.classList.toggle('open', willOpen);
                var configItem = shell.closest('.config-item');
                if (configItem) configItem.classList.toggle('select-open', willOpen);
                var configGroup = shell.closest('.config-group');
                if (configGroup) configGroup.classList.toggle('select-open-group', willOpen);
                trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
            });
            select.addEventListener('change', syncStyledSelects);
        }

        var menu = shell.querySelector('.select-menu');
        menu.innerHTML = '';
        var addOption = function(option) {
            var optionButton = document.createElement('button');
            optionButton.type = 'button';
            optionButton.className = 'select-option';
            optionButton.dataset.value = option.value;
            optionButton.textContent = option.textContent;
            optionButton.setAttribute('role', 'option');
            optionButton.addEventListener('click', function(event) {
                event.stopPropagation();
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                closeStyledSelects();
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
    }

    function initStyledSelects() {
        var panel = document.querySelector('.config-panel');
        if (!panel) return;

        panel.querySelectorAll('select').forEach(rebuildStyledSelect);

        if (!appState._styledSelectDocumentBound) {
            document.addEventListener('click', closeStyledSelects);
            appState._styledSelectDocumentBound = true;
        }
        syncStyledSelects();
    }

    function updateCategoryConfig(count) {
        var theme = THEMES[appState.selectedTheme];
        var container = document.getElementById('categories-config');
        closeCategoryIconPickers();
        var currentCats = appState.config.categories || theme.categories;

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
            var pickerIcons = getCategoryIconPickerChoices(iconPool, cat.icon);
            html += '<div class="category-config-item">';
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
            html += '</div>';
        });
        container.innerHTML = html;

        // 文本和数量字段
        container.querySelectorAll('input').forEach(function(input) {
            input.addEventListener('change', function() {
                var idx = parseInt(this.dataset.catIdx);
                var field = this.dataset.catField;
                if (field === 'count') {
                    appState.config.categories[idx][field] = parseInt(this.value) || 1;
                } else {
                    appState.config.categories[idx][field] = this.value;
                }
                updatePreview();
            });
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
            document.addEventListener('click', function() {
                closeCategoryIconPickers();
            });
            document.addEventListener('scroll', repositionOpenCategoryPickerMenus, true);
            window.addEventListener('resize', repositionOpenCategoryPickerMenus);
            appState._iconPickerDocumentBound = true;
        }
    }

    function bindConfigEvents() {
        // 通用配置项绑定
        var configMap = {
            'contact-email': 'contactEmail',
            'navbar-layout': 'navbarLayout',
            'footer-style': 'footerStyle',
            'back-link-style': 'backLinkStyle',
            'card-columns': 'cardColumns',
            'meta-layout': 'metaLayout',
            'content-render': 'contentRender',
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
        initStyledSelects();
    }

    function updateCardFieldsConfig() {
        var theme = THEMES[appState.selectedTheme];
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
        var theme = THEMES[appState.selectedTheme];
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
        var theme = THEMES[appState.selectedTheme];

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
        if (count) count.textContent = STYLE_PRESETS.length + ' 套';
        STYLE_PRESETS.forEach(function(preset) {
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

    // ========== 配置标签页 ==========
    function initConfigTabs() {
        var tabs = document.querySelectorAll('.config-tab');
        var sections = document.querySelectorAll('.config-section');

        tabs.forEach(function(tab) {
            tab.addEventListener('click', function() {
                tabs.forEach(function(t) { t.classList.remove('active'); });
                sections.forEach(function(s) { s.classList.remove('active'); });
                this.classList.add('active');
                document.getElementById('tab-' + this.dataset.tab).classList.add('active');
            });
        });
    }

    // ========== 预览控制 ==========
    function initPreviewControls() {
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
                // 保存广告放置信息（每个广告可分别在首页和详情页放置）
                if (!appState.config.adPlacements) appState.config.adPlacements = {};
                if (!appState.config.adPlacements[adId]) appState.config.adPlacements[adId] = {};
                appState.config.adPlacements[adId][page] = position;
                // 退出放置模式
                exitAdPlacementMode();
                // 更新UI显示
                updateAdPlacementUI();
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
        return appState.siteBuildMode !== 'ad-migration' && !!(appState.adCodeMigration && appState.adCodeMigration.valid);
    }

    // 已验证的 TXT 使用固定广告位；没有 TXT 时才允许以预览标记手动挑选位置。
    function syncDirectAdPlacementUI() {
        var automatic = hasValidatedDirectAdCode();
        var manualGroup = document.getElementById('ad-placement-group');
        var automaticNote = document.getElementById('ad-auto-placement-note');
        if (manualGroup) manualGroup.hidden = automatic;
        if (automaticNote) automaticNote.hidden = !automatic;
        if (automatic) appState.adPlacementMode = null;
    }

    function initAdConfig() {
        // 广告代码文件上传
        var adCodeUpload = document.getElementById('ad-code-upload');
        var adCodeBtn = document.getElementById('ad-code-btn');
        var adCodeStatus = document.getElementById('ad-code-status');
        var adCodePreview = document.getElementById('ad-code-preview');
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
                if (appState.config.adPlacements && appState.config.adPlacements[adId]) {
                    delete appState.config.adPlacements[adId];
                    updateAdPlacementUI();
                    updatePreview();
                }
            });
        });
        syncDirectAdPlacementUI();
        updateAdPlacementUI();
    }

    function enterAdPlacementMode(adId) {
        if (hasValidatedDirectAdCode()) {
            showNotice('广告 TXT 已通过校验，系统会自动插入三个广告位，无需手动选择位置。', '已自动放置广告');
            return;
        }

        // “重新放置”仅移除当前预览页面的旧位置，另一页面的设置会被保留。
        var activeTab = document.querySelector('.preview-tab.active');
        var currentPage = activeTab ? activeTab.dataset.page : 'home';
        var placements = appState.config.adPlacements || {};
        var currentPlacement = placements[adId];
        if (currentPlacement && currentPlacement[currentPage]) {
            delete currentPlacement[currentPage];
            if (Object.keys(currentPlacement).length === 0) delete placements[adId];
        }
        appState.config.adPlacements = placements;
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
        var placements = appState.config.adPlacements || {};
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
            var hasAny = hasHome || hasDetail;

            // 显示位置信息
            var parts = [];
            if (hasHome) parts.push('首页: ' + translatePosition(p.home));
            if (hasDetail) parts.push('详情页: ' + translatePosition(p.detail));
            if (label) label.textContent = hasAny ? parts.join(' | ') : '未放置';

            // 移除按钮
            if (removeBtn) removeBtn.style.display = hasAny ? 'inline-block' : 'none';

            // 选择放置按钮 - 根据当前预览页面决定按钮文字
            if (selectBtn) {
                var currentPagePlaced = (currentPage === 'home' && hasHome) || (currentPage === 'detail' && hasDetail);
                if (currentPagePlaced) {
                    selectBtn.textContent = '重新放置';
                } else if (hasAny) {
                    var otherPage = currentPage === 'home' ? '详情页' : '首页';
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
            'detail-after-content': '正文后',
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
        if (appState.currentStep !== 4) return;
        if (appState.siteBuildMode === 'differentiated' && (typeof DifferentiatedBuilder === 'undefined' || DifferentiatedBuilder.BUILD_VERSION !== REQUIRED_DIFFERENTIATED_BUILDER_VERSION)) {
            if (previewTimeout) clearTimeout(previewTimeout);
            previewFrame.removeAttribute('src');
            previewFrame.srcdoc = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#f4f7fb;color:#15243a;font:16px/1.6 system-ui,sans-serif}.notice{max-width:560px;padding:32px;border:1px solid #f0b8b8;background:#fff;box-shadow:8px 8px 0 #d33}h1{margin:0 0 12px;font-size:24px}</style><body><section class="notice"><h1>模板引擎版本未同步</h1><p>当前页面拒绝运行旧模板。请刷新页面后重新上传本次数据源。</p></section></body></html>';
            return;
        }
        if (appState.siteBuildMode === 'differentiated' && !appState.differentiatedImportName && typeof DifferentiatedBuilder !== 'undefined') {
            if (previewTimeout) clearTimeout(previewTimeout);
            previewFrame.removeAttribute('src');
            previewFrame.srcdoc = DifferentiatedBuilder.generateWaitingPreviewHtml(appState.differentiated.siteType);
            return;
        }
        if (!appState.data || appState.data.length === 0) return;

        // 防抖
        if (previewTimeout) clearTimeout(previewTimeout);
        previewTimeout = setTimeout(function() {
            var activeTab = document.querySelector('.preview-tab.active');
            if (!pageType) pageType = activeTab ? activeTab.dataset.page : 'home';

            try {
                // 清理上一次预览中的本地图片blob URL
                if (appState._previewBlobUrls.length > 0) {
                    appState._previewBlobUrls.forEach(function(u) { URL.revokeObjectURL(u); });
                    appState._previewBlobUrls = [];
                }
                var html = appState.siteBuildMode === 'differentiated' && typeof DifferentiatedBuilder !== 'undefined'
                    ? DifferentiatedBuilder.generatePreviewHtml(appState, pageType, {
                        siteType: appState.differentiated.siteType,
                        itemIndex: appState.previewDetailIndex,
                        categorySlug: appState.previewSectionSlug
                    })
                    : Generator.generatePreviewHtml(appState, pageType, appState.previewDetailIndex);
                previewFrame.removeAttribute('src');
                previewFrame.srcdoc = html;
            } catch(e) {
                console.error('Preview error:', e);
            }
        }, 300);
    }

    // ========== Step 5: 导出 ==========
    function generateExportSummary() {
        if (isBatchAdBuild()) {
            var batchTarget = document.getElementById('export-summary');
            var batch = appState.batchAdBuild || { sites: [], codes: [] };
            var batchReport = typeof BatchAdBuilder !== 'undefined' ? BatchAdBuilder.validateAssignments(batch.sites, batch.codes) : { valid: false, errors: [{ message: '批量建站组件未加载。' }] };
            var ready = batch.sites.filter(function(site) {
                return !batchSiteIssues(site).length && batch.codes.some(function(code) { return code.id === site.codeId && code.valid; });
            }).length;
            batchTarget.innerHTML = '<h4>批量广告建站导出前检查</h4><div class="summary-grid">' +
                makeSummaryItem('站点数量', batch.sites.length + ' 个') +
                makeSummaryItem('有效广告代码', batch.codes.filter(function(code) { return code.valid; }).length + '/' + batch.codes.length + ' 份') +
                makeSummaryItem('字段与代码就绪', ready + '/' + batch.sites.length + ' 站') +
                makeSummaryItem('模板与样式', '逐站独立配置') +
                makeSummaryItem('导出格式', '一个批量 ZIP，站点独立文件夹') +
                '</div><section class="migration-validation ' + (batchReport.valid ? '' : 'invalid') + '"><h5>' + (batchReport.valid ? '一对一广告代码校验通过' : '导出已阻止') + '</h5>' +
                (batchReport.valid ? '<p>导出期间会逐站重新生成，然后验证首页、全部详情页、GPT 脚本、三个广告容器以及 js/ad.js 中的对应广告路径。</p>' : '<ul>' + batchReport.errors.map(function(error) { return '<li>' + escapeHtml(error.message) + '</li>'; }).join('') + '</ul>') + '</section>';
            document.getElementById('btn-export').disabled = !batchReport.valid;
            return;
        }
        if (appState.siteBuildMode === 'differentiated' && typeof DifferentiatedBuilder !== 'undefined') {
            var target = document.getElementById('export-summary');
            target.innerHTML = '<h4>差异化精品建站审计</h4><p>正在检查内容、来源、图片、功能、链接、法律信息与设计指纹…</p>';
            document.querySelectorAll('[data-diff-export]').forEach(function(button) { button.disabled = true; });
            DifferentiatedBuilder.audit(appState, { variant: 'review', siteType: appState.differentiated.siteType }).then(function(outcome) {
                var config = outcome.config;
                target.innerHTML = '<h4>配置摘要</h4><div class="summary-grid">' +
                    makeSummaryItem('建站方式', '差异化精品建站') +
                    makeSummaryItem('站点类型', config.type === 'editorial' ? '资讯站' : '工具站') +
                    makeSummaryItem('独立领域', config.vertical) +
                    makeSummaryItem('数据条数', config.items.length + '条') +
                    makeSummaryItem('设计家族', config.design.name) +
                    makeSummaryItem('设计指纹', config.designFingerprint) +
                    makeSummaryItem('正式域名', config.baseUrl || '尚未填写') +
                    makeSummaryItem('联系邮箱', config.contactEmail || '尚未填写') + '</div>' +
                    DifferentiatedBuilder.renderAuditSummary(outcome.report);
                document.querySelectorAll('[data-diff-export]').forEach(function(button) {
                    button.disabled = button.dataset.diffExport !== 'draft' && outcome.report.counts.blockers > 0;
                });
            }).catch(function(error) {
                target.innerHTML = '<section class="migration-validation invalid"><h5>审计无法完成</h5><p>' + escapeHtml(error.message) + '</p></section>';
                document.querySelectorAll('[data-diff-export]').forEach(function(button) { button.disabled = button.dataset.diffExport !== 'draft'; });
            });
            return;
        }
        var theme = THEMES[appState.selectedTheme];
        var config = appState.config;
        var mapping = appState.fieldMapping;
        var mappedCount = Object.keys(mapping).length;
        var unmappedCount = theme.fields.length - mappedCount;

        var selectedStyleName = '';
        STYLE_PRESETS.forEach(function(s) {
            if (s.id === config.selectedStyle) selectedStyleName = s.name;
        });
        var template = getTemplateById(config.templateId);
        var iconSet = getIconSetById(config.iconSetId);

        var summaryHtml = '<h4>配置摘要</h4><div class="summary-grid">';
        summaryHtml += makeSummaryItem('主题', theme.name);
        summaryHtml += makeSummaryItem('数据条数', appState.data.length + '条');
        summaryHtml += makeSummaryItem('已匹配字段', mappedCount + '个');
        summaryHtml += makeSummaryItem('未匹配字段', unmappedCount + '个（不展示）');
        summaryHtml += makeSummaryItem('网站标题', config.siteTitle || theme.siteTitle);
        summaryHtml += makeSummaryItem('联系邮箱', config.contactEmail || 'contact@your-domain.com');
        summaryHtml += makeSummaryItem('页面模板', template.name);
        summaryHtml += makeSummaryItem('图标组合', iconSet ? iconSet.name : '自定义组合');
        summaryHtml += makeSummaryItem('视觉风格', selectedStyleName);
        summaryHtml += makeSummaryItem('Hero区域', config.heroEnabled ? '开启' : '关闭');
        summaryHtml += makeSummaryItem('分类数量', config.categories.length + '个');
        summaryHtml += makeSummaryItem('内容渲染', config.contentRender === 'markdown' ? 'Markdown转HTML' : '纯文本');
        summaryHtml += makeSummaryItem('操作按钮', config.actionButtonEnabled ? config.actionButtonText : '关闭');
        summaryHtml += makeSummaryItem('相关推荐', config.relatedCount + '条');
        var migration = appState.legacyAdMigration;
        var isMigration = appState.siteBuildMode === 'ad-migration';
        summaryHtml += makeSummaryItem('建站方式', isMigration ? '广告移植建站' : '普通建站');
        summaryHtml += '</div>';
        var adCode = appState.adCodeMigration;
        var isAdCodeBuild = !isMigration && !!adCode;
        var adCodeValid = !adCode || adCode.valid;
        if (isMigration) {
            summaryHtml += '<section class="migration-validation ' + (migration && migration.valid ? '' : 'invalid') + '"><h5>广告移植导出前校验</h5>' + migrationResultHtml(migration) + '</section>';
        } else if (isAdCodeBuild) {
            summaryHtml += '<section class="migration-validation ' + (adCodeValid ? '' : 'invalid') + '"><h5>广告代码建站校验</h5>' + migrationResultHtml(adCode) + '</section>';
        } else {
            summaryHtml += '<section class="migration-validation"><h5>普通建站校验通过</h5><p>本次不会读取旧网站源码，也不会生成 GPT 脚本、ad.js 或广告容器。</p></section>';
        }

        document.getElementById('export-summary').innerHTML = summaryHtml;
        document.getElementById('btn-export').disabled = (isMigration && !(migration && migration.valid)) || (!isMigration && isAdCodeBuild && !adCodeValid);
    }

    function makeSummaryItem(label, value) {
        return '<div class="summary-item"><span class="label">' + escapeHtml(label) + '</span><span class="value">' + escapeHtml(value) + '</span></div>';
    }

    // 导出按钮
    document.getElementById('btn-export').addEventListener('click', function() {
        if (isBatchAdBuild()) {
            var report = BatchAdBuilder.validateAssignments(appState.batchAdBuild.sites, appState.batchAdBuild.codes);
            if (!report.valid) {
                showNotice(report.errors[0] ? report.errors[0].message : '请完成广告代码分配。', '暂时不能导出');
                generateExportSummary();
                return;
            }
            var batchButton = this;
            var batchProgress = document.getElementById('export-progress');
            var batchFill = document.getElementById('progress-fill');
            var batchText = document.getElementById('progress-text');
            batchButton.disabled = true;
            batchProgress.style.display = 'block';
            BatchAdBuilder.exportBatch(appState, function(percent, text) {
                batchFill.style.width = percent + '%';
                batchText.textContent = text;
            }, window.JSZip).then(function(result) {
                saveAs(result.blob, 'batch-ad-websites.zip');
                batchText.textContent = '✅ ' + result.reports.length + ' 个站点已完成运行时广告检查并开始下载';
            }).catch(function(error) {
                batchText.textContent = '❌ 批量导出失败：' + error.message;
                showNotice(error.message, '批量导出未完成');
            }).finally(function() {
                batchButton.disabled = false;
                generateExportSummary();
            });
            return;
        }
        if (appState.siteBuildMode === 'ad-migration' && !(appState.legacyAdMigration && appState.legacyAdMigration.valid)) {
            showNotice('广告移植校验尚未通过，不能导出不完整站点。请先处理校验结果中的问题。', '暂时不能导出');
            return;
        }
        if (appState.siteBuildMode === 'normal' && appState.adCodeMigration && !appState.adCodeMigration.valid) {
            showNotice('广告代码尚未通过校验。请重新上传对应子域名的广告代码 TXT 文件。', '暂时不能导出');
            return;
        }
        var btn = this;
        btn.disabled = true;
        var progressDiv = document.getElementById('export-progress');
        var progressFill = document.getElementById('progress-fill');
        var progressText = document.getElementById('progress-text');
        progressDiv.style.display = 'block';

        Generator.exportWebsite(appState, function(percent, text) {
            progressFill.style.width = percent + '%';
            progressText.textContent = text;
        }).then(function(blob) {
            var theme = THEMES[appState.selectedTheme];
            var exportTitle = appState.config.siteTitle || theme.siteTitle;
            saveAs(blob, exportTitle.replace(/\s+/g, '-').toLowerCase() + '-website.zip');
            progressText.textContent = '✅ 导出成功！文件已开始下载';
            btn.disabled = false;
        }).catch(function(err) {
            progressText.textContent = '❌ 导出失败: ' + err.message;
            btn.disabled = false;
            console.error('Export error:', err);
        });
    });

    function exportDifferentiatedSite(variant, button) {
        appState.differentiated.exportVariant = variant;
        var progressDiv = document.getElementById('export-progress');
        var progressFill = document.getElementById('progress-fill');
        var progressText = document.getElementById('progress-text');
        document.querySelectorAll('[data-diff-export]').forEach(function(item) { item.disabled = true; });
        if (button) button.setAttribute('aria-busy', 'true');
        progressDiv.style.display = 'block';
        DifferentiatedBuilder.exportWebsite(appState, function(percent, text) {
            progressFill.style.width = percent + '%';
            progressText.textContent = text;
        }, { variant: variant, siteType: appState.differentiated.siteType, JSZip: window.JSZip }).then(function(blob) {
            var config = DifferentiatedBuilder.buildConfig(appState, { variant: variant, siteType: appState.differentiated.siteType });
            saveAs(blob, DifferentiatedBuilder.slugify(config.siteTitle, 'static-site') + '-' + variant + '.zip');
            progressText.textContent = '✅ 差异化静态站导出成功；ZIP 已开始下载';
            generateExportSummary();
        }).catch(function(error) {
            progressText.textContent = '❌ 导出失败：' + error.message;
            showNotice(error.message, '差异化导出未完成');
            generateExportSummary();
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
        if (step !== prevStep) {
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

        // 先换页面蓝图，确保每次随机都有结构级变化；最近三次不重复。
        var domainTemplates = getBlueprintsForTheme(appState.selectedTheme);
        var templateId = randomPickWithoutRecent(domainTemplates.map(function(t) { return t.id; }), appState.randomTemplateHistory, 3);
        applyTemplatePreset(templateId, false);
        applyRandomIconSet(false);

        // 再做少量可控扰动，保留模板的设计意图，避免随机结果沦为“颜色抽奖”。
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
        if (Math.random() > 0.55) c.selectedStyle = randomPick(STYLE_PRESETS.map(function(s) { return s.id; }));
        if (Math.random() > 0.65) c.cardColumns = randomPick(['auto', '2', '3', '4']);
    }

    function applyConfigToUI() {
        var c = appState.config;

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

    // 初始化
    goToStep(1);

})();
