/**
 * 游戏站建站工具 - 主应用逻辑
 * 管理步骤导航、状态、UI交互、实时预览
 */

(function() {
    'use strict';

    var REQUIRED_DIFFERENTIATED_BUILDER_VERSION = '20260914-template-library-13';

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ========== 应用状态 ==========
        var appState = {
        currentStep: 1,
        selectedPreviewGameIndex: 0,
        previewSectionSlug: '',
        selectedTheme: 'game',  // 固定为game
        data: [],
        jsonFields: [],
        isLocalImages: false,
        localImages: {},
        localImageDataUrls: {},
        localGameFiles: {},
        sourceNotice: null,
        fieldMapping: {
            title: 'title',
            content: 'description',
            image: 'thumb',
            store_url: 'url',
            id: 'id'
        },
        config: {},
        adPlacementMode: null,
        normalAdMode: 'code',
        adJsVersion: 'v1.0.2',
        reservePlacementMode: 'manual',
        siteBuildMode: 'normal',
        legacyAdMigration: null,
        adCodeMigration: null,
        differentiated: {
            siteType: 'games', vertical: '', audience: '', scope: '', baseUrl: '',
            contactEmail: '', contactLayout: 'split', contactFields: ['name', 'email', 'subject', 'message'], footerStyle: 'simple', footerLinks: ['privacy', 'terms', 'contact', 'about'], siteTitle: '', brandMark: 'auto', logoIcon: '', typography: 'auto', designFamily: 'auto', domainId: 'game', seed: '', cardAlignment: 'compact', homeIntro: 'compact', featuredCard: 'highlight', navCategoryLimit: 4, categoryOverrides: [], summaryMode: 'standard', tone: 'auto', themePreset: 'auto', themePalette: {}, contentDensity: 'comfortable', cardRadius: 'auto', cardHover: 'lift', cardColumns: 'template', categoryCardColumns: 'inherit', cardViewMode: 'auto', cardBorder: 'auto', cardSpacing: 'auto', cardExcerptLines: 'auto', cardImageHeight: 'auto', cardHeight: 'template', coverFit: 'smart', contentMaxWidth: 'auto', metaBg: 'auto', detailImgStyle: 'auto', categoryTitleStyle: 'auto', categoryTitleAlign: 'auto', heroStyle: 'auto', detailLayout: 'auto', fontStyle: 'auto', logoStyle: 'mark-text', navLayout: 'split', navStyle: 'glass', navHeight: 'regular', gridGap: 'regular', buttonStyle: 'solid', buttonSize: 'auto', backLinkStyle: 'arrow', animationEnter: 'fade', transitionSpeed: 'normal', exportVariant: 'draft'
        },
        differentiatedPackage: null,
        packageAssets: {},
        differentiatedImportName: '',
        buildModeSelectionVisible: true,
        _previewBlobUrls: []
    };
    var builtInGames = [];
    var activeSourceLabel = '内置目录';
    var activeSourceId = 'builtin';
    var activeSavedCatalogId = '';
    var savedCatalogs = [];

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
    var noticeMessage = document.getElementById('notice-message');
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
        workflowActionMessage.textContent = step === 1 ? '下一步：导出网站' : '当前步骤：导出网站';
    }

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
        noticeLastFocus = document.activeElement;
        document.getElementById('notice-title').textContent = title || '请确认操作';
        noticeMessage.textContent = message;
        noticeConfirm.textContent = confirmLabel || '继续';
        if (noticeCancel) noticeCancel.hidden = false;
        noticeResolve = callback;
        noticeOverlay.hidden = false;
        window.requestAnimationFrame(function() { noticeConfirm.focus(); });
    }

    if (noticeConfirm) noticeConfirm.addEventListener('click', function() { closeNotice(true); });
    if (noticeCancel) noticeCancel.addEventListener('click', function() { closeNotice(false); });
    if (noticeClose) noticeClose.addEventListener('click', function() { closeNotice(false); });
    if (noticeOverlay) noticeOverlay.addEventListener('click', function(event) { if (event.target === noticeOverlay) closeNotice(false); });
    document.addEventListener('keydown', function(event) {
        if (!noticeOverlay || noticeOverlay.hidden) return;
        if (event.key === 'Escape') { event.preventDefault(); closeNotice(false); }
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
        document.querySelectorAll('[data-build-mode]').forEach(function(button) {
            var selected = button.dataset.buildMode === appState.siteBuildMode;
            button.classList.toggle('is-selected', selected);
            button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
        var showSourceConfiguration = !isDifferentiated || !appState.differentiatedImportName || appState.buildModeSelectionVisible;
        var legacySection = document.getElementById('legacy-site-upload');
        if (legacySection) legacySection.hidden = !isMigration;
        var differentiatedSection = document.getElementById('differentiated-setup');
        if (differentiatedSection) differentiatedSection.hidden = !isDifferentiated;
        var standardConfigPanel = document.querySelector('#step-1 > .config-layout > .config-panel:not(.differentiated-customizer)');
        if (standardConfigPanel) {
            // A completed differentiated package owns its own configuration
            // panel. Keep the source panel out of the layout until the user
            // explicitly chooses “重新上传”, then expose it for replacement.
            standardConfigPanel.hidden = !showSourceConfiguration;
            standardConfigPanel.classList.toggle('is-differentiated-mode', isDifferentiated);
            var standardTabs = standardConfigPanel.querySelector('.config-tabs:not(.diff-config-tabs)');
            if (standardTabs) standardTabs.hidden = isDifferentiated;
            if (isDifferentiated) {
                document.querySelectorAll('.config-tab').forEach(function(tab) {
                    tab.classList.toggle('active', tab.dataset.tab === 'structure');
                });
                document.querySelectorAll('.config-section').forEach(function(section) {
                    section.classList.toggle('active', section.id === 'tab-structure');
                });
            }
        }
        var differentiatedCustomizer = document.getElementById('differentiated-customizer');
        if (differentiatedCustomizer) differentiatedCustomizer.hidden = !isDifferentiated;
        // 普通站可上传经过校验的广告 TXT；移植站只使用固定且可校验的旧站广告位置。
        var adsTab = document.querySelector('.config-tab[data-tab="ads"]');
        var adsSection = document.getElementById('tab-ads');
        if (adsTab) adsTab.hidden = false;
        if (adsSection) adsSection.hidden = false;
        var adJsVersionGroup = document.getElementById('ad-js-version-group');
        if (adJsVersionGroup) adJsVersionGroup.hidden = isDifferentiated;
        var legacyExport = document.getElementById('legacy-export-options');
        var differentiatedExport = document.getElementById('differentiated-export-options');
        var defaultExportButton = document.getElementById('btn-export');
        if (legacyExport) legacyExport.hidden = isDifferentiated;
        if (differentiatedExport) differentiatedExport.hidden = !isDifferentiated;
        if (defaultExportButton) defaultExportButton.hidden = isDifferentiated;
        syncDirectAdPlacementUI();
        if (isMigration) renderMigrationResult();
        if (isDifferentiated) {
            renderDifferentiatedPackageStatus();
            populateDifferentiatedDesigns();
        }
    }

    function selectBuildMode(mode) {
        appState.siteBuildMode = mode === 'ad-migration' || mode === 'differentiated' ? mode : 'normal';
        appState.adPlacementMode = null;
        if (appState.config) {
            appState.config.adPlacements = {};
            appState.config.adPaths = {};
        }
        if (appState.siteBuildMode !== 'ad-migration') appState.legacyAdMigration = null;
        syncBuildModeUI();
        updatePreview();
    }

    function populateDifferentiatedDesigns() {
        var selects = document.querySelectorAll('#diff-design-family,#diff-config-design-family');
        if (!selects.length || typeof DifferentiatedBuilder === 'undefined') return;
        var domainId = appState.differentiated.domainId || 'game';
        var families = DifferentiatedBuilder.getDesignFamilies('games', domainId) || [];
        var profile = DifferentiatedBuilder.DOMAIN_PROFILES[domainId];
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
        profile = profile || DifferentiatedBuilder.DOMAIN_PROFILES.game || null;
        var profileLabel = profile && profile.label ? profile.label : '当前领域';
        var count = document.getElementById('diff-domain-blueprint-count');
        var status = document.getElementById('diff-domain-blueprint-status');
        if (count) count.textContent = families.length + ' 个蓝图';
        if (status) status.textContent = profile
            ? '已识别领域：' + profileLabel + '。以下蓝图只在该领域显示，并会写入本次导出。'
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
        [['diff-site-title', state.siteTitle], ['diff-config-seed', state.seed], ['diff-card-alignment', state.cardAlignment || 'compact'], ['diff-home-intro', state.homeIntro || 'compact'], ['diff-featured-card', state.featuredCard || 'highlight'], ['diff-nav-category-limit', state.navCategoryLimit || 4], ['diff-contact-layout', state.contactLayout || 'split'], ['diff-footer-style', state.footerStyle || 'simple'], ['diff-summary-mode', state.summaryMode || 'standard'], ['diff-tone', state.tone || 'auto'], ['diff-content-density', state.contentDensity || 'comfortable'], ['diff-card-radius', state.cardRadius || 'auto'], ['diff-card-hover', state.cardHover || 'lift'], ['diff-card-columns', state.cardColumns || 'template'], ['diff-category-card-columns', state.categoryCardColumns || 'inherit'], ['diff-card-view-mode', state.cardViewMode || 'auto'], ['diff-card-border', state.cardBorder || 'auto'], ['diff-card-spacing', state.cardSpacing || 'auto'], ['diff-card-excerpt-lines', state.cardExcerptLines || 'auto'], ['diff-card-image-height', state.cardImageHeight || 'auto'], ['diff-cover-fit', state.coverFit || 'smart'], ['diff-card-height', state.cardHeight || 'template'], ['diff-content-max-width', state.contentMaxWidth || 'auto'], ['diff-meta-bg', state.metaBg || 'auto'], ['diff-detail-img-style', state.detailImgStyle || 'auto'], ['diff-category-title-style', state.categoryTitleStyle || 'auto'], ['diff-category-title-align', state.categoryTitleAlign || 'auto'], ['diff-hero-style', state.heroStyle || 'auto'], ['diff-detail-layout', state.detailLayout || 'auto'], ['diff-font-style', state.fontStyle || 'auto'], ['diff-logo-style', state.logoStyle || 'mark-text'], ['diff-nav-layout', state.navLayout || 'split'], ['diff-nav-style', state.navStyle || 'glass'], ['diff-nav-height', state.navHeight || 'regular'], ['diff-grid-gap', state.gridGap || 'regular'], ['diff-button-style', state.buttonStyle || 'solid'], ['diff-button-size', state.buttonSize || 'auto'], ['diff-back-link-style', state.backLinkStyle || 'arrow'], ['diff-animation-enter', state.animationEnter || 'fade'], ['diff-transition-speed', state.transitionSpeed || 'normal']].forEach(function(pair) { var element = document.getElementById(pair[0]); if (element) element.value = pair[1]; });
        renderDifferentiatedPageControls();
        populateDifferentiatedDesigns();
        renderDifferentiatedVisualPickers();
        renderDifferentiatedCategories();
    }

    function renderDifferentiatedPageControls() {
        var state = appState.differentiated;
        [['#diff-contact-fields-config', state.contactFields || []], ['#diff-footer-links-config', state.footerLinks || []]].forEach(function(pair) {
            document.querySelectorAll(pair[0] + ' input[type="checkbox"]').forEach(function(input) {
                input.checked = pair[1].indexOf(input.value) !== -1;
            });
        });
    }

    function renderDifferentiatedCategories() {
        var target = document.getElementById('diff-auto-category-list');
        if (!target || typeof DifferentiatedBuilder === 'undefined') return;
        var state = appState.differentiated;
        var config = DifferentiatedBuilder.buildConfig({ data: appState.data || [], differentiated: state, differentiatedPackage: appState.differentiatedPackage || {} }, { siteType: 'games' });
        var pool = typeof GAME_EMOJI_ICONS !== 'undefined' ? GAME_EMOJI_ICONS : [];
        var maximum = Math.max(2, Math.min(6, config.categories.length || 6));
        var requested = Number(state.navCategoryLimit) || 4;
        var limit = Math.max(2, Math.min(maximum, requested));
        var slider = document.getElementById('diff-nav-category-limit');
        var value = document.getElementById('diff-nav-category-limit-value');
        if (slider) { slider.min = '2'; slider.max = String(maximum); slider.value = String(limit); }
        if (value) value.textContent = String(limit);
        var visible = config.categories.slice(0, limit);
        function iconChoices(category, index) {
            var choices = pool.slice(0, 24);
            var active = category.icon || choices[index % Math.max(1, choices.length)] || '🎮';
            if (choices.indexOf(active) === -1) choices.unshift(active);
            return { active: active, choices: choices.length ? choices : ['🎮', '🕹️', '🎲', '🏆', '🧩', '⚔️'] };
        }
        function saveOverride(category, patch) {
            var overrides = Array.isArray(state.categoryOverrides) ? state.categoryOverrides.slice() : [];
            var position = overrides.findIndex(function(item) { return item && item.slug === category.slug; });
            var current = position === -1 ? { slug: category.slug, name: category.name, icon: '' } : Object.assign({}, overrides[position]);
            Object.assign(current, patch || {});
            if (position === -1) overrides.push(current); else overrides[position] = current;
            state.categoryOverrides = overrides;
        }
        target.innerHTML = '<p class="diff-auto-category-title">已识别的导航分类</p>' + (visible.length ? '<p class="diff-auto-category-help">分类来自本次游戏数据；可在此修改导航显示名称与图标，链接和游戏归属保持不变。</p>' + visible.map(function(category, index) {
            var icons = iconChoices(category, index);
            return '<div class="category-config-item diff-category-config-item" role="listitem"><div class="cat-icon-picker"><button type="button" class="cat-icon-trigger" aria-label="选择第 ' + (index + 1) + ' 个分类图标" aria-expanded="false">' + escapeHtml(icons.active) + '</button><div class="cat-icon-menu" role="listbox" aria-label="分类图标选项">' + icons.choices.map(function(icon) { return '<button type="button" class="cat-icon-option' + (icons.active === icon ? ' selected' : '') + '" role="option" aria-selected="' + (icons.active === icon ? 'true' : 'false') + '" data-diff-category-icon="' + escapeHtml(icon) + '" data-diff-category-slug="' + escapeHtml(category.slug) + '">' + escapeHtml(icon) + '</button>'; }).join('') + '</div></div><input type="text" class="cat-name-input" value="' + escapeHtml(category.name) + '" maxlength="64" aria-label="第 ' + (index + 1) + ' 个分类名称" data-diff-category-name data-diff-category-slug="' + escapeHtml(category.slug) + '"><output class="diff-category-record-count" aria-label="' + category.count + ' 个游戏">' + category.count + ' 个</output></div>';
        }).join('') : '<p class="diff-auto-category-empty">上传数据后将在此显示自动识别的分类。</p>');
        target.querySelectorAll('[data-diff-category-name]').forEach(function(input) {
            input.addEventListener('input', function() {
                var category = config.categories.find(function(item) { return item.slug === input.dataset.diffCategorySlug; });
                if (!category) return;
                saveOverride(category, { name: input.value });
                updatePreview();
            });
        });
        target.querySelectorAll('.cat-icon-trigger').forEach(function(trigger) {
            trigger.addEventListener('click', function(event) {
                event.stopPropagation();
                var picker = trigger.closest('.cat-icon-picker');
                target.querySelectorAll('.cat-icon-picker.open').forEach(function(openPicker) {
                    if (openPicker !== picker) { openPicker.classList.remove('open'); openPicker.querySelector('.cat-icon-trigger').setAttribute('aria-expanded', 'false'); }
                });
                var isOpen = picker.classList.toggle('open');
                trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            });
        });
        target.querySelectorAll('[data-diff-category-icon]').forEach(function(button) {
            button.addEventListener('click', function(event) {
                event.stopPropagation();
                var category = config.categories.find(function(item) { return item.slug === button.dataset.diffCategorySlug; });
                if (!category) return;
                saveOverride(category, { icon: button.dataset.diffCategoryIcon });
                renderDifferentiatedCategories();
                updatePreview();
            });
        });
        if (!appState._diffCategoryPickerBound) {
            document.addEventListener('click', function() {
                document.querySelectorAll('#diff-auto-category-list .cat-icon-picker.open').forEach(function(picker) {
                    picker.classList.remove('open');
                    picker.querySelector('.cat-icon-trigger').setAttribute('aria-expanded', 'false');
                });
            });
            appState._diffCategoryPickerBound = true;
        }
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
        var entries = typeof GAME_EMOJI_ICONS !== 'undefined' ? GAME_EMOJI_ICONS.map(function(icon) { return { icon:icon, name:'游戏图标' }; }) : DifferentiatedBuilder.BRAND_MARKS.map(function(item) { return { icon:item.glyph, name:item.name }; });
        if (iconCount) iconCount.textContent = entries.length + ' 款可选';
        var active = state.logoIcon || '';
        if (iconPreview) iconPreview.textContent = active || '🎮';
        if (iconName) iconName.textContent = active ? '已选品牌图标' : '自动图标';
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
        target.className = 'migration-result ' + (appState.differentiatedImportName ? 'valid' : 'pending');
        target.textContent = appState.differentiatedImportName
            ? '已读取 ' + appState.differentiatedImportName + ' · ' + appState.data.length + ' 款游戏 · 本次站点状态已隔离'
            : '等待上传本次游戏站数据包。';
    }

    function applyDifferentiatedImport(imported, fileName) {
        appState.differentiatedPackage = imported.packageData || {};
        appState.packageAssets = imported.packageAssets || {};
        appState.differentiatedImportName = fileName || '本次游戏数据源';
        appState.buildModeSelectionVisible = false;
        var manifest = (imported.packageData && imported.packageData.manifest) || {};
        var site = manifest.site || {};
        var design = (imported.packageData && imported.packageData.design) || {};
        var legal = (imported.packageData && imported.packageData.legal) || {};
        appState.differentiated.vertical = String(site.vertical || site.topic || manifest.vertical || '');
        appState.differentiated.audience = String(site.audience || '');
        appState.differentiated.scope = String(site.scope || site.description || '');
        appState.differentiated.baseUrl = String(site.base_url || site.url || '');
        appState.differentiated.contactEmail = String(legal.contact_email || '');
        appState.differentiated.siteTitle = String(site.name || site.title || manifest.site_name || '');
        appState.differentiated.brandMark = String(design.brand_mark || design.logo_mark || 'auto');
        appState.differentiated.typography = String(design.typography || design.font_pair || 'auto');
        appState.differentiated.designFamily = String(design.family || design.design_family || 'auto');
        appState.differentiated.domainId = String(design.domain_id || design.domain || site.domain_id || site.domain || manifest.domain_id || manifest.domain || 'game');
        appState.differentiated.seed = String(design.seed || '');
        appState.differentiated.cardAlignment = design.card_alignment === 'aligned' ? 'aligned' : 'compact';
        appState.differentiated.homeIntro = ['compact', 'hidden'].indexOf(design.home_intro || design.hero_style) !== -1 ? (design.home_intro || design.hero_style) : 'compact';
        appState.differentiated.featuredCard = design.featured_card === 'standard' ? 'standard' : 'highlight';
        appState.differentiated.navCategoryLimit = [2, 3, 4, 5, 6].indexOf(Number(design.nav_category_limit || design.category_limit)) !== -1 ? Number(design.nav_category_limit || design.category_limit) : 4;
        appState.differentiated.categoryOverrides = Array.isArray(design.category_overrides || design.categories) ? (design.category_overrides || design.categories).map(function(category) { category = category && typeof category === 'object' ? category : {}; return { slug: String(category.slug || ''), name: String(category.name || ''), icon: String(category.icon || '') }; }).filter(function(category) { return category.slug; }) : [];
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
            }, { siteType: 'games' });
            appState.differentiated.vertical = inferredConfig.vertical;
            if (!appState.differentiated.audience) appState.differentiated.audience = inferredConfig.audience;
            if (!appState.differentiated.scope) appState.differentiated.scope = inferredConfig.scope;
        }
        var values = {
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
        appState.differentiated.domainId = 'game';
        appState.differentiated.seed = '';
    }

    function initDifferentiatedControls() {
        if (typeof DifferentiatedBuilder === 'undefined') return;
        var controls = { 'diff-vertical': 'vertical', 'diff-audience': 'audience', 'diff-scope': 'scope', 'diff-base-url': 'baseUrl', 'diff-contact-email': 'contactEmail', 'diff-contact-layout': 'contactLayout', 'diff-footer-style': 'footerStyle', 'diff-design-family': 'designFamily', 'diff-seed': 'seed', 'diff-site-title': 'siteTitle', 'diff-brand-mark': 'brandMark', 'diff-typography': 'typography', 'diff-config-design-family': 'designFamily', 'diff-config-seed': 'seed', 'diff-card-alignment': 'cardAlignment', 'diff-home-intro': 'homeIntro', 'diff-featured-card': 'featuredCard', 'diff-nav-category-limit': 'navCategoryLimit', 'diff-summary-mode': 'summaryMode', 'diff-tone': 'tone', 'diff-content-density': 'contentDensity', 'diff-card-radius': 'cardRadius', 'diff-card-hover': 'cardHover', 'diff-card-columns': 'cardColumns', 'diff-category-card-columns': 'categoryCardColumns', 'diff-card-view-mode': 'cardViewMode', 'diff-card-border': 'cardBorder', 'diff-card-spacing': 'cardSpacing', 'diff-card-excerpt-lines': 'cardExcerptLines', 'diff-card-image-height': 'cardImageHeight', 'diff-cover-fit': 'coverFit', 'diff-card-height': 'cardHeight', 'diff-content-max-width': 'contentMaxWidth', 'diff-meta-bg': 'metaBg', 'diff-detail-img-style': 'detailImgStyle', 'diff-category-title-style': 'categoryTitleStyle', 'diff-category-title-align': 'categoryTitleAlign', 'diff-hero-style': 'heroStyle', 'diff-detail-layout': 'detailLayout', 'diff-font-style': 'fontStyle', 'diff-logo-style': 'logoStyle', 'diff-nav-layout': 'navLayout', 'diff-nav-style': 'navStyle', 'diff-nav-height': 'navHeight', 'diff-grid-gap': 'gridGap', 'diff-button-style': 'buttonStyle', 'diff-button-size': 'buttonSize', 'diff-back-link-style': 'backLinkStyle', 'diff-animation-enter': 'animationEnter', 'diff-transition-speed': 'transitionSpeed' };
        Object.keys(controls).forEach(function(id) {
            var element = document.getElementById(id);
            if (!element) return;
            element.addEventListener(element.tagName === 'SELECT' ? 'change' : 'input', function() {
                appState.differentiated[controls[id]] = this.value.trim ? this.value.trim() : this.value;
                if (controls[id] === 'designFamily') populateDifferentiatedDesigns();
                if (controls[id] === 'seed') populateDifferentiatedCustomizer();
                if (controls[id] === 'navCategoryLimit') renderDifferentiatedCategories();
                updatePreview();
            });
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

    function initBuildModeControls() {
        document.querySelectorAll('[data-build-mode]').forEach(function(button) {
            button.addEventListener('click', function() { selectBuildMode(this.dataset.buildMode); });
        });
        var differentiatedPackageButton = document.getElementById('diff-package-select');
        if (differentiatedPackageButton) differentiatedPackageButton.addEventListener('click', function() {
            var sourceSelect = document.getElementById('game-source');
            var upload = document.getElementById('game-json-upload');
            if (!sourceSelect || !upload) return;
            sourceSelect.value = 'json';
            sourceSelect.dispatchEvent(new Event('change'));
            upload.click();
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
        syncBuildModeUI();
    }

    initDifferentiatedControls();

    // ========== 步骤导航 ==========
    function goToStep(step) {
        if (step < 1 || step > 2) return;
        if (step > appState.currentStep && appState.siteBuildMode === 'differentiated' && !appState.differentiatedImportName) {
            showNotice('差异化精品建站必须先在“游戏数据源”中选择 JSON / 压缩包并上传本次独立数据包。', '请上传独立游戏包');
            return;
        }
        if (step > appState.currentStep && appState.siteBuildMode === 'ad-migration' && !(appState.legacyAdMigration && appState.legacyAdMigration.valid)) {
            showNotice('广告移植建站需要通过旧网站源码压缩包校验后才能继续。请查看失败原因并重新上传。', '还不能继续');
            return;
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
        });

        // 更新按钮
        btnPrev.style.display = step > 1 ? 'inline-block' : 'none';
        updateNextButtonLabel(step === 2 ? '完成' : '下一步 →');
        btnNext.style.display = step === 2 ? 'none' : 'inline-block';
        if (btnReupload) btnReupload.hidden = step !== 1 || !appState.data.length;
        updateWorkflowActionContext(step);

        // 步骤2：生成导出摘要
        if (step === 2) {
            generateExportSummary();
        }

        // 步骤1：更新预览
        if (step === 1) {
            updatePreview();
        }
    }

    btnPrev.addEventListener('click', function() {
        goToStep(appState.currentStep - 1);
    });

    if (btnReupload) btnReupload.addEventListener('click', function() {
        appState.buildModeSelectionVisible = true;
        syncBuildModeUI();
        var sourceSelect = document.getElementById('game-source');
        var upload = document.getElementById('game-json-upload');
        if (sourceSelect) {
            sourceSelect.value = 'json';
            sourceSelect.dispatchEvent(new Event('change'));
        }
        if (upload) upload.click();
    });

    btnNext.addEventListener('click', function() {
        goToStep(appState.currentStep + 1);
    });

    // 点击步骤进度条跳转
    stepItems.forEach(function(item) {
        item.addEventListener('click', function() {
            var step = parseInt(this.dataset.step);
            if (step < appState.currentStep) {
                goToStep(step);
            }
        });
    });

    // ========== 初始化配置 ==========
    function initDefaultConfig() {
        var theme = THEMES.game;
        appState.config = {
            siteTitle: theme.siteTitle,
            siteSubtitle: theme.siteSubtitle,
            contactEmail: theme.pages.contact.email,
            navLinks: ['home'],
            footerLinks: ['privacy', 'terms', 'contact', 'about'],
            navbarLayout: 'normal',
            footerStyle: 'simple',
            backLinkStyle: 'text',
            heroEnabled: false,
            heroTitle: theme.hero.title,
            heroSubtitle: theme.hero.subtitle,
            categories: JSON.parse(JSON.stringify(theme.categories)),
            cardColumns: 'auto',
            randomSort: false,
            cardFields: theme.cardFields.slice(),
            metaLayout: theme.detail.metaLayout,
            contentRender: theme.detail.contentRender,
            actionButtonEnabled: theme.detail.actionButton.enabled,
            actionButtonText: theme.detail.actionButton.text,
            actionButtonLinkField: theme.detail.actionButton.linkField,
            relatedCount: 4,
            relatedCardFields: theme.relatedCardFields.slice(),
            aboutEnabled: true,
            allGamesEnabled: true,
            contactFields: ['name', 'email', 'subject', 'message'],
            privacyLength: 'full',
            termsLength: 'full',
            selectedStyle: 'dark',
            navbarStyle: 'glass-sticky',
            navbarHeight: '60px',
            logoStyle: 'text',
            logoIcon: '🎮',
            iconSetId: 'custom',
            cardHover: 'float',
            cardBorder: 'rounded',
            cardRadius: '8px',
            cardSpacing: '20px',
            btnStyle: 'solid',
            btnSize: 'medium',
            gridGap: '20px',
            fontStyle: 'sans-serif',
            ambientEffect: 'none',
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
                cardDescLines: '2',
                layoutTemplate: 'classic',
                adPlacements: {}
        };
    }

    function unwrapGameArray(payload) {
        if (Array.isArray(payload)) return payload;
        if (!payload || typeof payload !== 'object') return [];
        var preferredKeys = ['games', 'data', 'items', 'results'];
        for (var i = 0; i < preferredKeys.length; i++) {
            if (Array.isArray(payload[preferredKeys[i]])) return payload[preferredKeys[i]];
        }
        var keys = Object.keys(payload);
        for (var j = 0; j < keys.length; j++) {
            if (Array.isArray(payload[keys[j]])) return payload[keys[j]];
        }
        return [];
    }

    function firstValue(item, keys) {
        for (var i = 0; i < keys.length; i++) {
            var value = item[keys[i]];
            if (value !== undefined && value !== null && String(value).trim() !== '') return value;
        }
        return '';
    }

    function isSafeRelativeAsset(value) {
        var path = String(value || '').trim().replace(/\\/g, '/');
        if (!path || path.startsWith('/') || path.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(path)) return false;
        return !path.split('/').some(function(segment) { return segment === '..'; });
    }

    function normalizeGames(payload, sourceId) {
        var rows = unwrapGameArray(payload);
        var seen = {};
        return rows.map(function(item, index) {
            if (!item || typeof item !== 'object') return null;
            var url = String(firstValue(item, ['url', 'gameUrl', 'game_url', 'embedUrl', 'embed_url', 'store_url', 'local_entry', 'game_file'])).trim();
            var originalThumb = String(firstValue(item, ['thumb', 'thumbnailUrl', 'thumbnail', 'image', 'imageUrl', 'cover', 'coverUrl'])).trim();
            var normalized = Object.assign({}, item, {
                id: firstValue(item, ['id', 'gameId', 'game_id', 'slug']) || (sourceId + '-' + (index + 1)),
                title: String(firstValue(item, ['title', 'name', 'gameTitle'])).trim(),
                description: String(firstValue(item, ['description', 'desc_en', 'content', 'summary', 'excerpt'])).trim(),
                url: url,
                thumb: originalThumb,
                thumbFallback: '',
                source: sourceId
            });
            var allowsLocalFiles = sourceId === 'opensource-local' || sourceId === 'json-zip' || sourceId === 'differentiated-zip' || sourceId === 'saved-local' || /^builtin-source-\d+$/.test(sourceId);
            var allowsLocalImages = allowsLocalFiles;
            var validGameUrl = /^https?:\/\//i.test(normalized.url) || (allowsLocalFiles && isSafeRelativeAsset(normalized.url));
            var validThumb = /^https?:\/\//i.test(normalized.thumb) || (allowsLocalImages && isSafeRelativeAsset(normalized.thumb));
            if (!normalized.title || !validGameUrl || !validThumb) return null;
            var duplicateKey = normalized.url.toLowerCase();
            if (seen[duplicateKey]) return null;
            seen[duplicateKey] = true;
            return normalized;
        }).filter(Boolean);
    }

    function updateSourceStatus(message, state) {
        var status = document.getElementById('source-status');
        if (!status) return;
        status.textContent = message;
        status.className = 'source-status' + (state ? ' is-' + state : '');
    }

    function updateSourceFingerprint(data) {
        var target = document.getElementById('source-fingerprint');
        if (!target) return;
        var rows = Array.isArray(data) ? data : [];
        var fingerprint = typeof SavedGameCatalogs !== 'undefined'
            ? SavedGameCatalogs.fingerprintData(rows)
            : 'g' + rows.length;
        var examples = rows.slice(0, 3).map(function(item) { return String(item.title || '').trim(); }).filter(Boolean);
        target.textContent = '内容标识：' + fingerprint + (examples.length ? ' · ' + examples.join(' / ') : '');
        target.title = '相同内容会有相同标识；可据此确认已选游戏源是否正确。';
    }

    function dataUrlToBlob(dataUrl) {
        var parts = String(dataUrl || '').split(',');
        if (parts.length !== 2) throw new Error('封面数据格式不正确');
        var mime = ((parts[0].match(/^data:([^;]+)/i) || [])[1]) || 'application/octet-stream';
        var binary = atob(parts[1]);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: mime });
    }

    function imageMimeTypeForPath(path) {
        var extension = (String(path || '').toLowerCase().match(/\.[a-z0-9]+$/) || [''])[0];
        return {
            '.avif': 'image/avif', '.gif': 'image/gif', '.jfif': 'image/jpeg',
            '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png',
            '.svg': 'image/svg+xml', '.webp': 'image/webp'
        }[extension] || 'application/octet-stream';
    }

    function readImageBlobAsDataUrl(blob, path) {
        return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onload = function() {
                var source = String(reader.result || '');
                resolve(source.replace(/^data:[^;,]*/i, 'data:' + imageMimeTypeForPath(path)));
            };
            reader.onerror = function() { reject(reader.error || new Error('封面读取失败')); };
            reader.readAsDataURL(blob);
        });
    }

    async function createLocalImageDataUrls(localImages) {
        var entries = Object.entries(localImages || {});
        var pairs = await Promise.all(entries.map(async function(entry) {
            return [entry[0], await readImageBlobAsDataUrl(entry[1], entry[0])];
        }));
        return Object.fromEntries(pairs);
    }

    async function importLocalGameArchive(file) {
        if (appState.siteBuildMode === 'differentiated') {
            if (!/\.zip$/i.test(file.name)) {
                throw new Error('差异化精品建站的完整数据包仅支持 ZIP。请将数据包重新压缩为 .zip 后上传；单独 JSON 可用于草稿数据导入。');
            }
            if (typeof DifferentiatedBuilder === 'undefined' || typeof window.JSZip === 'undefined') throw new Error('差异化 ZIP 导入组件未加载，请刷新页面后重试。');
            clearDifferentiatedImport();
            renderDifferentiatedPackageStatus('正在读取游戏清单、封面、可玩文件与授权记录…', 'pending');
            var imported = await DifferentiatedBuilder.importZip(file, 'games', { JSZip: window.JSZip });
            var localImageDataUrls = await createLocalImageDataUrls(imported.localImages);
            applyDifferentiatedImport(imported, file.name);
            replaceGameData(imported.data, 'differentiated-zip', '差异化 ZIP · ' + file.name.replace(/\.zip$/i, ''), {
                localImages: imported.localImages,
                localImageDataUrls: localImageDataUrls,
                localGameFiles: imported.localGameFiles,
                packageAssets: imported.packageAssets
            });
            syncBuildModeUI();
            return;
        }
        if (typeof GameZipImport === 'undefined') {
            throw new Error('游戏压缩包导入模块未加载，请刷新页面后重试。');
        }
        const isZip = /\.zip$/i.test(file.name);
        const archive = await (isZip ? GameZipImport.importArchive(file, function(payload) {
            return normalizeGames(payload, 'json-zip');
        }) : GameZipImport.importExtendedArchive(file, function(payload) {
            return normalizeGames(payload, 'json-archive');
        }));
        const localImages = {};
        Object.keys(archive.localImageDataUrls).forEach(function(filename) {
            localImages[filename] = dataUrlToBlob(archive.localImageDataUrls[filename]);
        });
        const suffix = isZip ? 'ZIP' : file.name.split('.').pop().toUpperCase();
        const sourceLabel = '本地 ' + suffix + ' · ' + file.name.replace(/\.(?:zip|rar|7z)$/i, '');
        replaceGameData(archive.payload, isZip ? 'json-zip' : 'json-archive', sourceLabel, {
            localImages: localImages,
            localImageDataUrls: archive.localImageDataUrls
        });
        updateSourceStatus('已加载 ' + archive.recordCount + ' 个游戏 · 已提取 ' + Object.keys(localImages).length + ' 张本地图片 · ' + sourceLabel, 'success');
    }

    function normalizeSourceCategoryIcon(category, index) {
        var allowedIcons = typeof GAME_EMOJI_ICONS !== 'undefined' ? GAME_EMOJI_ICONS : [];
        var currentIcon = String(category && category.icon || '');
        if (allowedIcons.indexOf(currentIcon) !== -1) return currentIcon;

        var name = String(category && category.name || '').toLowerCase();
        var semanticIcons = [
            ['featured', '🌟'], ['action', '⚔️'], ['puzzle', '🧩'], ['adventure', '🗺️'],
            ['arcade', '👾'], ['strategy', '🎯'], ['simulation', '🤖'], ['sports', '⚽']
        ];
        for (var i = 0; i < semanticIcons.length; i++) {
            if (name.indexOf(semanticIcons[i][0]) !== -1) return semanticIcons[i][1];
        }
        return allowedIcons[index % allowedIcons.length] || '🎮';
    }

    function normalizeSourceCategories(categories) {
        return categories.map(function(category, index) {
            return Object.assign({}, category, { icon: normalizeSourceCategoryIcon(category, index) });
        });
    }

    function replaceGameData(payload, sourceId, sourceLabel, sourceAssets) {
        var games = normalizeGames(payload, sourceId);
        if (!games.length) throw new Error('没有找到同时包含标题、游戏地址和图片地址的有效游戏');

        appState.data = games;
        appState.selectedPreviewGameIndex = 0;
        appState.isLocalImages = !!(sourceAssets && sourceAssets.localImages);
        appState.localImages = sourceAssets && sourceAssets.localImages ? sourceAssets.localImages : {};
        appState.localImageDataUrls = sourceAssets && sourceAssets.localImageDataUrls ? sourceAssets.localImageDataUrls : {};
        appState.localGameFiles = sourceAssets && sourceAssets.localGameFiles ? sourceAssets.localGameFiles : {};
        appState.packageAssets = sourceAssets && sourceAssets.packageAssets ? sourceAssets.packageAssets : (appState.siteBuildMode === 'differentiated' ? appState.packageAssets : {});
        appState.sourceNotice = sourceAssets && sourceAssets.sourceNotice ? sourceAssets.sourceNotice : null;
        activeSourceLabel = sourceLabel;
        activeSourceId = sourceId;
        if (sourceId !== 'saved-local') activeSavedCatalogId = '';
        appState.jsonFields = Object.keys(games[0]).map(function(key) {
            return { name: key, type: typeof games[0][key] };
        });
        var countSummary = document.getElementById('data-count-summary');
        if (countSummary) countSummary.textContent = games.length;
        var badge = document.getElementById('source-badge');
        if (badge) badge.textContent = sourceLabel;
        if (btnReupload) btnReupload.hidden = appState.currentStep !== 1;
        updateSourceFingerprint(games);
        if (sourceAssets && Array.isArray(sourceAssets.categories) && sourceAssets.categories.length) {
            appState.config.categories = normalizeSourceCategories(sourceAssets.categories);
            appState.config.iconSetId = 'custom';
            var iconSetSelect = document.getElementById('icon-set-select');
            if (iconSetSelect) iconSetSelect.value = 'custom';
            var categorySlider = document.getElementById('category-count');
            if (categorySlider) {
                categorySlider.max = Math.max(16, sourceAssets.categories.length);
                categorySlider.value = sourceAssets.categories.length;
            }
            var categoryCountValue = document.getElementById('cat-count-value');
            if (categoryCountValue) categoryCountValue.textContent = sourceAssets.categories.length;
            updateCategoryConfig(sourceAssets.categories.length);
        }
        updateSourceStatus('已加载 ' + games.length + ' 个游戏 · ' + sourceLabel, 'success');
        if (appState.siteBuildMode === 'differentiated') renderDifferentiatedPackageStatus();
        updatePreview();
    }

    function activateOpenSourceLibrary() {
        var bundle = window.OPEN_SOURCE_GAME_BUNDLE;
        if (!bundle || !Array.isArray(bundle.games) || !bundle.games.length) {
            throw new Error('开源游戏包未正确加载');
        }
        var localImages = {};
        var localImageDataUrls = {};
        var localGameFiles = {};
        var catalog = bundle.games.map(function(game) {
            localImages[game.coverFile] = dataUrlToBlob(game.coverData);
            localImageDataUrls[game.coverFile] = game.coverData;
            localGameFiles[game.gameFile] = game.gameHtml;
            var item = Object.assign({}, game);
            delete item.coverData;
            delete item.gameHtml;
            return item;
        });
        replaceGameData(catalog, 'opensource-local', '开源本地 · 首批', {
            localImages: localImages,
            localImageDataUrls: localImageDataUrls,
            localGameFiles: localGameFiles,
            categories: bundle.categoryPreset,
            sourceNotice: bundle.source
        });
    }

    function initDataSourceControls() {
        var sourceSelect = document.getElementById('game-source');
        var openSourceOptions = document.getElementById('opensource-source-options');
        var jsonOptions = document.getElementById('json-source-options');
        var savedOptions = document.getElementById('saved-catalog-options');
        var savedName = document.getElementById('saved-catalog-name');
        var saveCatalogButton = document.getElementById('save-current-catalog');
        var renameCatalogButton = document.getElementById('rename-saved-catalog');
        var deleteCatalogButton = document.getElementById('delete-saved-catalog');
        var jsonUpload = document.getElementById('game-json-upload');
        var sourceLoadRevision = 0;

        function savedIdFromValue(value) {
            var match = /^saved:(.+)$/.exec(String(value || ''));
            return match ? match[1] : '';
        }

        function canPersistCatalogs() {
            return typeof SavedGameCatalogs !== 'undefined' && SavedGameCatalogs.isAvailable();
        }

        function catalogNameSuggestion() {
            return String(activeSourceLabel || '我的游戏目录')
                .replace(/^本地 ZIP\s*·\s*/i, '')
                .replace(/^本地内置\s*·\s*/i, '')
                .slice(0, 60) || '我的游戏目录';
        }

        function updateSavedCatalogControls() {
            var selectedSavedId = savedIdFromValue(sourceSelect.value);
            var importedCatalogActive = sourceSelect.value === 'json' && (activeSourceId === 'json' || activeSourceId === 'json-zip');
            var visible = canPersistCatalogs() && (importedCatalogActive || !!selectedSavedId);
            savedOptions.hidden = !visible;
            if (!visible) return;

            var selectedCatalog = savedCatalogs.find(function(catalog) { return catalog.id === selectedSavedId; });
            if (selectedCatalog) {
                savedName.value = selectedCatalog.name;
            } else if (!savedName.value.trim()) {
                savedName.value = catalogNameSuggestion();
            }
            saveCatalogButton.textContent = selectedSavedId ? '更新当前本地内置目录' : '保存为本地内置目录';
            saveCatalogButton.hidden = !!selectedSavedId;
            renameCatalogButton.hidden = !selectedSavedId;
            deleteCatalogButton.hidden = !selectedSavedId;
        }

        function renderSavedCatalogOptions() {
            sourceSelect.querySelectorAll('option[data-saved-catalog]').forEach(function(option) {
                option.remove();
            });
            var builtInOption = sourceSelect.querySelector('option[value="builtin"]');
            savedCatalogs.forEach(function(catalog) {
                var option = document.createElement('option');
                option.value = 'saved:' + catalog.id;
                option.dataset.savedCatalog = 'true';
                option.textContent = '本地内置 · ' + catalog.name + '（' + catalog.gameCount + ' 款）';
                if (builtInOption && builtInOption.nextSibling) {
                    sourceSelect.insertBefore(option, builtInOption.nextSibling);
                } else {
                    sourceSelect.appendChild(option);
                }
            });
            if (savedIdFromValue(sourceSelect.value) && !savedCatalogs.some(function(catalog) {
                return catalog.id === savedIdFromValue(sourceSelect.value);
            })) {
                sourceSelect.value = 'builtin';
            }
        }

        function refreshSavedCatalogOptions() {
            if (!canPersistCatalogs()) return Promise.resolve();
            return SavedGameCatalogs.list().then(function(catalogs) {
                savedCatalogs = catalogs;
                renderSavedCatalogOptions();
                updateSavedCatalogControls();
            }).catch(function(error) {
                updateSourceStatus('本地内置目录不可用：' + error.message, 'error');
            });
        }

        function readBlobAsDataUrl(blob) {
            return new Promise(function(resolve, reject) {
                var reader = new FileReader();
                reader.onload = function() { resolve(String(reader.result || '')); };
                reader.onerror = function() { reject(reader.error || new Error('本地封面读取失败。')); };
                reader.readAsDataURL(blob);
            });
        }

        function restoreLocalImageDataUrls(localImages) {
            var entries = Object.entries(localImages || {}).filter(function(entry) {
                return entry[1] && typeof entry[1].size === 'number';
            });
            return Promise.all(entries.map(function(entry) {
                return readBlobAsDataUrl(entry[1]).then(function(dataUrl) {
                    return [entry[0], dataUrl];
                });
            })).then(function(pairs) {
                return Object.fromEntries(pairs);
            });
        }

        function loadSavedCatalog(id) {
            if (!canPersistCatalogs()) return;
            var revision = ++sourceLoadRevision;
            updateSourceStatus('正在读取本地内置目录…', 'loading');
            SavedGameCatalogs.get(id).then(async function(catalog) {
                if (!catalog || !Array.isArray(catalog.data)) throw new Error('找不到该本地内置目录。');
                var localImages = catalog.localImages || {};
                var localImageDataUrls = await restoreLocalImageDataUrls(localImages);
                if (revision !== sourceLoadRevision || sourceSelect.value !== 'saved:' + id) return;
                replaceGameData(catalog.data, 'saved-local', '本地内置 · ' + catalog.name, {
                    localImages: localImages,
                    localImageDataUrls: localImageDataUrls,
                    localGameFiles: catalog.localGameFiles || {},
                    sourceNotice: catalog.sourceNotice || null
                });
                activeSavedCatalogId = catalog.id;
                savedName.value = catalog.name;
                updateSavedCatalogControls();
            }).catch(function(error) {
                if (revision !== sourceLoadRevision) return;
                updateSourceStatus('本地内置目录加载失败：' + error.message, 'error');
            });
        }

        function bundledSourceForValue(value) {
            var match = /^builtin-(source-\d+)$/.exec(String(value || ''));
            if (!match || !Array.isArray(window.BUILTIN_GAME_SOURCES)) return null;
            return window.BUILTIN_GAME_SOURCES.find(function(source) { return source && source.id === match[1]; }) || null;
        }

        async function loadBundledGameSource(source, revision) {
            if (!source || !source.archive) return;
            var sourceValue = 'builtin-' + source.id;
            try {
                updateSourceStatus('正在读取' + source.name + '…', 'loading');
                var response = await fetch(source.archive, { cache: 'force-cache' });
                if (!response.ok) throw new Error('资源文件请求失败（HTTP ' + response.status + '）。');
                var blob = await response.blob();
                var archiveName = String(source.archive).split('/').pop() || (source.id + '.zip');
                var archiveFile = new File([blob], archiveName, { type: 'application/zip' });
                var archive = await GameZipImport.importArchive(archiveFile, function(payload) {
                    return normalizeGames(payload, sourceValue);
                });
                if (revision !== sourceLoadRevision || sourceSelect.value !== sourceValue) return;
                var localImages = {};
                Object.keys(archive.localImageDataUrls).forEach(function(filename) {
                    localImages[filename] = dataUrlToBlob(archive.localImageDataUrls[filename]);
                });
                replaceGameData(archive.payload, sourceValue, source.name, {
                    localImages: localImages,
                    localImageDataUrls: archive.localImageDataUrls
                });
                updateSourceStatus('已加载 ' + archive.recordCount + ' 款游戏与 ' + Object.keys(localImages).length + ' 张本地封面 · ' + source.name, 'success');
            } catch (error) {
                if (revision !== sourceLoadRevision || sourceSelect.value !== sourceValue) return;
                updateSourceStatus(source.name + ' 加载失败：' + error.message, 'error');
            }
        }

        function syncSourceOptions() {
            var source = sourceSelect.value;
            openSourceOptions.hidden = source !== 'opensource';
            jsonOptions.hidden = source !== 'json';
            if (source === 'builtin' && builtInGames.length) {
                replaceGameData(builtInGames, 'builtin', '内置目录', {
                    categories: THEMES.game.categories
                });
            } else if (source === 'opensource') {
                var count = window.OPEN_SOURCE_GAME_BUNDLE && window.OPEN_SOURCE_GAME_BUNDLE.games
                    ? window.OPEN_SOURCE_GAME_BUNDLE.games.length
                    : 0;
                updateSourceStatus(count ? '开源本地游戏包已就绪 · ' + count + ' 款' : '开源游戏包不可用', count ? 'ready' : 'error');
            } else if (source === 'json') {
                updateSourceStatus('请选择新的游戏 JSON 文件，或包含 JSON 与 images 的 ZIP、RAR、7z', 'ready');
            } else {
                var bundledSource = bundledSourceForValue(source);
                if (bundledSource) loadBundledGameSource(bundledSource, sourceLoadRevision);
            }
            updateSavedCatalogControls();
        }

        sourceSelect.addEventListener('change', function() {
            var savedId = savedIdFromValue(sourceSelect.value);
            if (savedId) {
                openSourceOptions.hidden = true;
                jsonOptions.hidden = true;
                updateSavedCatalogControls();
                loadSavedCatalog(savedId);
                return;
            }
            sourceLoadRevision += 1;
            syncSourceOptions();
        });

        saveCatalogButton.addEventListener('click', function() {
            if (!canPersistCatalogs()) {
                updateSourceStatus('当前浏览器不支持本地内置目录存储。', 'error');
                return;
            }
            if (!appState.data.length) {
                updateSourceStatus('没有可保存的游戏数据。', 'error');
                return;
            }
            var selectedSavedId = savedIdFromValue(sourceSelect.value);
            var existingCatalog = savedCatalogs.find(function(catalog) { return catalog.id === selectedSavedId; });
            var currentFingerprint = SavedGameCatalogs.fingerprintData(appState.data);
            var duplicateCatalog = savedCatalogs.find(function(catalog) {
                return catalog.id !== selectedSavedId && catalog.fingerprint === currentFingerprint;
            });
            if (duplicateCatalog) {
                updateSourceStatus('未保存：当前导入内容与“' + duplicateCatalog.name + '”完全相同（内容标识 ' + currentFingerprint + '）。', 'error');
                return;
            }
            var button = this;
            button.disabled = true;
            button.textContent = '正在保存本地内置目录…';
            SavedGameCatalogs.save({
                id: selectedSavedId || undefined,
                createdAt: existingCatalog && existingCatalog.createdAt,
                name: savedName.value || catalogNameSuggestion(),
                data: JSON.parse(JSON.stringify(appState.data)),
                localImages: appState.localImages || {},
                localGameFiles: Object.assign({}, appState.localGameFiles || {}),
                sourceNotice: appState.sourceNotice ? JSON.parse(JSON.stringify(appState.sourceNotice)) : null
            }).then(function(catalog) {
                activeSavedCatalogId = catalog.id;
                activeSourceId = 'saved-local';
                activeSourceLabel = '本地内置 · ' + catalog.name;
                var badge = document.getElementById('source-badge');
                if (badge) badge.textContent = activeSourceLabel;
                return refreshSavedCatalogOptions().then(function() {
                    sourceSelect.value = 'saved:' + catalog.id;
                    savedName.value = catalog.name;
                    updateSavedCatalogControls();
                    updateSourceStatus('已保存 ' + appState.data.length + ' 款游戏 · ' + activeSourceLabel, 'success');
                });
            }).catch(function(error) {
                updateSourceStatus('保存本地内置目录失败：' + error.message, 'error');
            }).finally(function() {
                button.disabled = false;
                updateSavedCatalogControls();
            });
        });

        renameCatalogButton.addEventListener('click', function() {
            var selectedSavedId = savedIdFromValue(sourceSelect.value);
            var selectedCatalog = savedCatalogs.find(function(catalog) { return catalog.id === selectedSavedId; });
            var nextName = savedName.value.trim();
            if (!selectedSavedId || !selectedCatalog) return;
            if (!nextName) {
                updateSourceStatus('请先填写新的本地内置目录名称。', 'error');
                savedName.focus();
                return;
            }
            if (nextName === selectedCatalog.name) {
                updateSourceStatus('目录名称未改变。', 'ready');
                return;
            }
            var button = this;
            button.disabled = true;
            button.textContent = '正在重命名…';
            SavedGameCatalogs.rename(selectedSavedId, nextName).then(function(catalog) {
                activeSavedCatalogId = catalog.id;
                activeSourceLabel = '本地内置 · ' + catalog.name;
                var badge = document.getElementById('source-badge');
                if (badge) badge.textContent = activeSourceLabel;
                return refreshSavedCatalogOptions().then(function() {
                    sourceSelect.value = 'saved:' + catalog.id;
                    savedName.value = catalog.name;
                    updateSavedCatalogControls();
                    updateSourceStatus('已重命名本地内置目录为“' + catalog.name + '”。', 'success');
                });
            }).catch(function(error) {
                updateSourceStatus('重命名本地内置目录失败：' + error.message, 'error');
            }).finally(function() {
                button.disabled = false;
                button.textContent = '重命名当前目录';
            });
        });

        deleteCatalogButton.addEventListener('click', function() {
            var selectedSavedId = savedIdFromValue(sourceSelect.value);
            var selectedCatalog = savedCatalogs.find(function(catalog) { return catalog.id === selectedSavedId; });
            if (!selectedSavedId || !selectedCatalog) return;
            showConfirm('确定移除“' + selectedCatalog.name + '”吗？仅删除当前浏览器中保存的目录。', '移除本地内置目录', '确认移除', function(confirmed) {
                if (!confirmed) return;
                deleteCatalogButton.disabled = true;
                SavedGameCatalogs.remove(selectedSavedId).then(function() {
                    activeSavedCatalogId = '';
                    savedName.value = '';
                    sourceSelect.value = 'builtin';
                    return refreshSavedCatalogOptions();
                }).then(function() {
                    syncSourceOptions();
                    updateSourceStatus('已移除本地内置目录。', 'success');
                }).catch(function(error) {
                    updateSourceStatus('移除本地内置目录失败：' + error.message, 'error');
                }).finally(function() {
                    deleteCatalogButton.disabled = false;
                });
            });
        });

        document.getElementById('load-opensource').addEventListener('click', function() {
            var button = this;
            button.disabled = true;
            button.textContent = '正在准备本地游戏…';
            updateSourceStatus('正在解包游戏封面和本地文件…', 'loading');
            setTimeout(function() {
                try {
                    activateOpenSourceLibrary();
                    button.textContent = '已加载 72 款开源游戏';
                    button.disabled = false;
                } catch (error) {
                    updateSourceStatus('开源游戏加载失败：' + error.message, 'error');
                    button.disabled = false;
                    button.textContent = '重新加载首批开源游戏';
                }
            }, 0);
        });
        document.getElementById('choose-game-json').addEventListener('click', function() {
            jsonUpload.click();
        });
        jsonUpload.addEventListener('change', async function() {
            var file = this.files && this.files[0];
            if (!file) return;
            sourceLoadRevision += 1;
            sourceSelect.value = 'json';
            updateSourceStatus('正在读取 ' + file.name + '…', 'loading');
            try {
                if (/\.(?:zip|rar|7z)$/i.test(file.name)) {
                    await importLocalGameArchive(file);
                } else {
                    var payload = JSON.parse(await file.text());
                    if (appState.siteBuildMode === 'differentiated') {
                        clearDifferentiatedImport();
                        var imported = DifferentiatedBuilder.importJsonData(payload, 'games');
                        applyDifferentiatedImport(imported, file.name);
                        replaceGameData(imported.data, 'json', file.name.replace(/\.json$/i, ''), { packageAssets: imported.packageAssets });
                    } else {
                        replaceGameData(payload, 'json', file.name.replace(/\.json$/i, ''));
                    }
                }
                savedName.value = catalogNameSuggestion();
                updateSavedCatalogControls();
            } catch (error) {
                updateSourceStatus('数据导入失败：' + error.message, 'error');
            } finally {
                this.value = '';
            }
        });

        refreshSavedCatalogOptions();
    }

    // ========== 自动加载游戏数据 ==========
    function loadGameData() {
        // file:// 页面不能 fetch 相邻 JSON，优先使用同步加载的内置目录脚本。
        if (Array.isArray(window.BUILTIN_GAME_DATA) && window.BUILTIN_GAME_DATA.length > 0) {
            processData(window.BUILTIN_GAME_DATA);
            return;
        }
        fetch('gamesData.json')
            .then(function(res) {
                if (!res.ok) throw new Error('Failed to load gamesData.json');
                return res.json();
            })
            .then(function(data) {
                processData(data);
            })
            .catch(function(err) {
                console.error('Failed to load game data:', err);
            showNotice('加载游戏数据失败：' + err.message, '无法读取游戏目录');
            });
    }

    function processData(data) {
        data = normalizeGames(data, 'builtin');
        if (data.length === 0) {
            showNotice('游戏数据格式不正确或为空。', '无法读取游戏目录');
            return;
        }

        builtInGames = data.slice();
        appState.data = data;
        var countSummary = document.getElementById('data-count-summary');
        if (countSummary) countSummary.textContent = data.length;

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

        // 初始化配置并渲染UI
        initDefaultConfig();
        initConfigPanel();
        updateSourceFingerprint(data);
        updateSourceStatus('已加载 ' + data.length + ' 个当前游戏', 'success');
        updatePreview();
    }

    // ========== 游戏品牌标题 ==========
    function syncBrandPreset() {
        var select = document.getElementById('brand-preset');
        if (!select) return;
        var currentTitle = String(appState.config.siteTitle || '').trim();
        select.value = GAME_BRAND_PRESETS.indexOf(currentTitle) !== -1 ? currentTitle : 'custom';
    }

    function applyBrandPreset(title, shouldRender) {
        if (!title || title === 'custom') return;
        appState.config.siteTitle = title;
        var input = document.getElementById('site-title');
        if (input) input.value = title;
        syncBrandPreset();
        if (shouldRender !== false) updatePreview();
    }

    function initBrandControls() {
        var select = document.getElementById('brand-preset');
        var shuffle = document.getElementById('shuffle-brand');
        var titleInput = document.getElementById('site-title');
        if (!select || !shuffle || !titleInput) return;

        select.innerHTML = '<option value="custom">自定义标题（手动输入）</option>' + GAME_BRAND_PRESETS.map(function(title) {
            return '<option value="' + escapeHtml(title) + '">' + escapeHtml(title) + '</option>';
        }).join('');
        syncBrandPreset();

        select.addEventListener('change', function() {
            applyBrandPreset(this.value, true);
        });
        shuffle.addEventListener('click', function() {
            var candidates = GAME_BRAND_PRESETS.filter(function(title) {
                return title !== appState.config.siteTitle;
            });
            applyBrandPreset(randomPick(candidates), true);
        });
        titleInput.addEventListener('input', syncBrandPreset);
    }

    // ========== Logo 游戏 Emoji ==========
    function syncLogoIconPicker() {
        var icon = appState.config.logoIcon || '🎮';
        var preview = document.getElementById('logo-icon-preview');
        var grid = document.getElementById('logo-icon-grid');
        if (preview) preview.textContent = icon;
        if (grid) {
            grid.querySelectorAll('.logo-icon-option').forEach(function(button) {
                var selected = button.dataset.icon === icon;
                button.classList.toggle('selected', selected);
                button.setAttribute('aria-selected', selected ? 'true' : 'false');
            });
        }
    }

    function closeLogoIconPanel() {
        var panel = document.getElementById('logo-icon-panel');
        var trigger = document.getElementById('logo-icon-trigger');
        if (panel) panel.hidden = true;
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }

    function initLogoIconControls() {
        var trigger = document.getElementById('logo-icon-trigger');
        var panel = document.getElementById('logo-icon-panel');
        var grid = document.getElementById('logo-icon-grid');
        if (!trigger || !panel || !grid) return;

        grid.innerHTML = GAME_EMOJI_ICONS.map(function(icon) {
            return '<button type="button" class="logo-icon-option" data-icon="' + icon + '" role="option" aria-selected="false" title="使用 ' + icon + '">' + icon + '</button>';
        }).join('');
        syncLogoIconPicker();

        trigger.addEventListener('click', function(event) {
            event.stopPropagation();
            var willOpen = panel.hidden;
            panel.hidden = !willOpen;
            trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        });
        panel.addEventListener('click', function(event) { event.stopPropagation(); });
        grid.querySelectorAll('.logo-icon-option').forEach(function(button) {
            button.addEventListener('click', function() {
                appState.config.logoIcon = this.dataset.icon;
                if (appState.config.logoStyle !== 'icon' && appState.config.logoStyle !== 'text-icon') {
                    appState.config.logoStyle = 'text-icon';
                    document.getElementById('logo-style').value = 'text-icon';
                }
                syncLogoIconPicker();
                closeLogoIconPanel();
                updatePreview();
            });
        });
        document.addEventListener('click', closeLogoIconPanel);
    }

    // ========== 分类 Emoji 组合 ==========
    function getIconSetById(iconSetId) {
        return GAME_ICON_SET_PRESETS.find(function(set) { return set.id === iconSetId; }) || null;
    }

    function applyIconSet(iconSetId, shouldRender) {
        var iconSet = getIconSetById(iconSetId);
        if (!iconSet) return;
        appState.config.iconSetId = iconSet.id;
        (appState.config.categories || []).forEach(function(category, index) {
            category.icon = iconSet.icons[index % iconSet.icons.length];
        });
        if (shouldRender !== false) {
            updateCategoryConfig(appState.config.categories.length);
            updatePreview();
        }
    }

    function initIconSetControls() {
        var select = document.getElementById('icon-set-select');
        var shuffle = document.getElementById('shuffle-icon-set');
        if (!select || !shuffle) return;
        select.innerHTML = '<option value="custom">自定义组合</option>' + GAME_ICON_SET_PRESETS.map(function(set) {
            return '<option value="' + set.id + '">' + set.name + '  ' + set.icons.slice(0, 5).join(' ') + '</option>';
        }).join('');
        select.value = appState.config.iconSetId || 'custom';
        select.addEventListener('change', function() {
            if (this.value === 'custom') {
                appState.config.iconSetId = 'custom';
                return;
            }
            applyIconSet(this.value, true);
        });
        shuffle.addEventListener('click', function() {
            var candidates = GAME_ICON_SET_PRESETS.filter(function(set) {
                return set.id !== appState.config.iconSetId;
            });
            applyIconSet(randomPick(candidates).id, true);
            select.value = appState.config.iconSetId;
        });
    }

    // ========== 配置下拉菜单 ===========
    // 保留原生 select 作为数据源，避免影响既有的配置同步和导出逻辑；
    // 实际交互由自定义菜单完成，以统一各浏览器中的视觉与操作体验。
    var openCustomSelect = null;

    function refreshCustomConfigSelects(target) {
        var selects = target ? [target] : document.querySelectorAll('select[data-custom-select="true"]');
        Array.prototype.forEach.call(selects, function(select) {
            var control = select && select._customSelectControl;
            if (!control) return;
            var selectedOption = select.options[select.selectedIndex];
            control.label.textContent = selectedOption ? selectedOption.textContent.trim() : '请选择';
            control.trigger.disabled = !!select.disabled;
            control.trigger.setAttribute('aria-disabled', select.disabled ? 'true' : 'false');
            control.menu.querySelectorAll('[role="option"]').forEach(function(optionButton) {
                var isSelected = optionButton.dataset.value === select.value;
                optionButton.classList.toggle('is-selected', isSelected);
                optionButton.setAttribute('aria-selected', isSelected ? 'true' : 'false');
            });
        });
    }

    function closeCustomSelect(select) {
        var current = select || openCustomSelect;
        if (!current || !current._customSelectControl) return;
        var control = current._customSelectControl;
        control.menu.hidden = true;
        control.trigger.setAttribute('aria-expanded', 'false');
        control.wrapper.classList.remove('is-open');
        if (openCustomSelect === current) openCustomSelect = null;
    }

    function positionCustomSelectMenu(select) {
        var control = select._customSelectControl;
        var rect = control.trigger.getBoundingClientRect();
        // 先以内容自然高度测量；短列表不应被统一的 max-height 强制产生滚动条。
        control.menu.classList.remove('is-scrollable');
        control.menu.style.maxHeight = 'none';
        var naturalHeight = control.menu.scrollHeight;
        var menuHeightLimit = 320;
        var top = rect.bottom + 6;
        var availableBelow = window.innerHeight - top - 12;
        var availableAbove = rect.top - 18;
        var openAbove = availableBelow < Math.min(180, naturalHeight) && availableAbove > availableBelow;
        var availableSpace = openAbove ? availableAbove : availableBelow;
        var visibleHeight = Math.min(naturalHeight, menuHeightLimit, Math.max(0, availableSpace));
        var shouldScroll = naturalHeight > visibleHeight;
        var finalHeight = shouldScroll ? Math.max(120, visibleHeight) : naturalHeight;

        control.menu.classList.toggle('is-scrollable', shouldScroll);
        control.menu.style.maxHeight = shouldScroll ? finalHeight + 'px' : 'none';

        if (openAbove) {
            control.menu.style.top = Math.max(12, rect.top - finalHeight - 6) + 'px';
        } else {
            control.menu.style.top = top + 'px';
        }
        control.menu.style.left = Math.max(12, Math.min(rect.left, window.innerWidth - rect.width - 12)) + 'px';
        control.menu.style.width = rect.width + 'px';
    }

    function focusCustomSelectOption(select, direction) {
        var options = Array.prototype.filter.call(select._customSelectControl.menu.querySelectorAll('[role="option"]'), function(option) {
            return !option.disabled;
        });
        if (!options.length) return;
        var activeIndex = options.indexOf(document.activeElement);
        var selectedIndex = options.findIndex(function(option) { return option.dataset.value === select.value; });
        var nextIndex = activeIndex >= 0 ? activeIndex + direction : selectedIndex + (direction > 0 ? 1 : -1);
        if (nextIndex < 0) nextIndex = options.length - 1;
        if (nextIndex >= options.length) nextIndex = 0;
        options[nextIndex].focus();
    }

    function renderCustomSelectOptions(select) {
        var control = select && select._customSelectControl;
        if (!control) return;
        var menu = control.menu;
        menu.innerHTML = '';
        Array.prototype.forEach.call(select.options, function(option) {
            var optionButton = document.createElement('button');
            optionButton.type = 'button';
            optionButton.className = 'custom-select-option';
            optionButton.dataset.value = option.value;
            optionButton.setAttribute('role', 'option');
            optionButton.setAttribute('aria-selected', 'false');
            optionButton.disabled = option.disabled;
            optionButton.textContent = option.textContent.trim();
            optionButton.addEventListener('click', function() {
                if (select.value !== option.value) {
                    select.value = option.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                }
                refreshCustomConfigSelects(select);
                closeCustomSelect(select);
                control.trigger.focus();
            });
            optionButton.addEventListener('keydown', function(event) {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    focusCustomSelectOption(select, event.key === 'ArrowDown' ? 1 : -1);
                } else if (event.key === 'Home' || event.key === 'End') {
                    event.preventDefault();
                    var options = menu.querySelectorAll('[role="option"]:not(:disabled)');
                    if (options.length) options[event.key === 'Home' ? 0 : options.length - 1].focus();
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    closeCustomSelect(select);
                    control.trigger.focus();
                }
            });
            menu.appendChild(optionButton);
        });
        refreshCustomConfigSelects(select);
    }

    function createCustomSelect(select) {
        if (!select || select.dataset.customSelect === 'true') return;

        var wrapper = document.createElement('div');
        var trigger = document.createElement('button');
        var label = document.createElement('span');
        var chevron = document.createElement('span');
        var menu = document.createElement('div');
        var menuId = 'custom-select-menu-' + select.id;

        wrapper.className = 'custom-select';
        trigger.type = 'button';
        trigger.className = 'custom-select-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-controls', menuId);
        label.className = 'custom-select-label';
        chevron.className = 'custom-select-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        trigger.appendChild(label);
        trigger.appendChild(chevron);

        menu.id = menuId;
        menu.className = 'custom-select-menu';
        menu.setAttribute('role', 'listbox');
        menu.setAttribute('aria-label', select.getAttribute('aria-label') || (select.labels && select.labels[0] ? select.labels[0].textContent.trim() : '选择选项'));
        menu.hidden = true;

        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);
        wrapper.appendChild(trigger);
        document.body.appendChild(menu);
        select.classList.add('native-select');
        select.dataset.customSelect = 'true';
        select.tabIndex = -1;
        select.setAttribute('aria-hidden', 'true');

        select._customSelectControl = { wrapper: wrapper, trigger: trigger, label: label, menu: menu };
        renderCustomSelectOptions(select);
        new MutationObserver(function() {
            renderCustomSelectOptions(select);
        }).observe(select, { childList: true, subtree: true, characterData: true });
        select.addEventListener('change', function() { refreshCustomConfigSelects(select); });
        trigger.addEventListener('click', function() {
            if (trigger.disabled) return;
            if (openCustomSelect === select) {
                closeCustomSelect(select);
                return;
            }
            closeCustomSelect();
            openCustomSelect = select;
            menu.hidden = false;
            trigger.setAttribute('aria-expanded', 'true');
            wrapper.classList.add('is-open');
            positionCustomSelectMenu(select);
        });
        trigger.addEventListener('keydown', function(event) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (openCustomSelect !== select) trigger.click();
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') focusCustomSelectOption(select, event.key === 'ArrowDown' ? 1 : -1);
            } else if (event.key === 'Escape') {
                closeCustomSelect(select);
            }
        });
    }

    function initCustomConfigSelects() {
        document.querySelectorAll('#tab-structure .config-item select, #tab-style .config-item select').forEach(createCustomSelect);
        if (!appState._customSelectDocumentBound) {
            document.addEventListener('pointerdown', function(event) {
                if (!openCustomSelect || !openCustomSelect._customSelectControl) return;
                var control = openCustomSelect._customSelectControl;
                if (!control.wrapper.contains(event.target) && !control.menu.contains(event.target)) closeCustomSelect();
            });
            window.addEventListener('resize', function() { closeCustomSelect(); });
            window.addEventListener('scroll', function() { closeCustomSelect(); }, true);
            appState._customSelectDocumentBound = true;
        }
    }

    // ========== 配置面板 ==========
    function initConfigPanel() {
        var theme = THEMES.game;

        initDataSourceControls();

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
        bindConfigEvents();
        initBrandControls();
        initLogoIconControls();
        initIconSetControls();
        initStyleGrid();
        initLayoutTemplateGrid();
        initConfigTabs();
        initPreviewControls();
        initAdConfig();
        initCustomConfigSelects();
    }

    function updateCategoryConfig(count) {
        var theme = THEMES.game;
        var container = document.getElementById('categories-config');
        var currentCats = appState.config.categories || theme.categories;

        // 调整分类数量
        while (currentCats.length < count) {
            var activeSet = getIconSetById(appState.config.iconSetId);
            var nextIcon = activeSet ? activeSet.icons[currentCats.length % activeSet.icons.length] : GAME_EMOJI_ICONS[currentCats.length % GAME_EMOJI_ICONS.length];
            currentCats.push({ name: 'Category ' + (currentCats.length + 1), icon: nextIcon, count: 6 });
        }
        appState.config.categories = currentCats.slice(0, count);

        var html = '';
        appState.config.categories.forEach(function(cat, i) {
            cat.count = i === 0 ? 2 : 6;
            html += '<div class="category-config-item">';
            html += '<div class="cat-icon-picker">';
            html += '<button type="button" class="cat-icon-trigger" data-cat-idx="' + i + '" aria-label="选择第 ' + (i + 1) + ' 个分类图标" aria-expanded="false">' + escapeHtml(cat.icon || '🎮') + '</button>';
            html += '<div class="cat-icon-menu" role="listbox" aria-label="游戏分类图标选项">';
            GAME_EMOJI_ICONS.forEach(function(icon) {
                html += '<button type="button" class="cat-icon-option' + (cat.icon === icon ? ' selected' : '') + '" data-cat-idx="' + i + '" data-icon="' + icon + '" role="option" aria-selected="' + (cat.icon === icon ? 'true' : 'false') + '">' + icon + '</button>';
            });
            html += '</div></div>';
            html += '<input type="text" class="cat-name-input" value="' + escapeHtml(cat.name) + '" data-cat-idx="' + i + '" data-cat-field="name" aria-label="分类名称">';
            html += '<input type="number" class="cat-count-input" value="' + cat.count + '" readonly title="版式固定：首组2个，其余每组6个" data-cat-idx="' + i + '" data-cat-field="count">';
            html += '</div>';
        });
        container.innerHTML = html;

        // 绑定事件
        container.querySelectorAll('input').forEach(function(input) {
            input.addEventListener('change', function() {
                var idx = parseInt(this.dataset.catIdx);
                var field = this.dataset.catField;
                if (field !== 'count') {
                    appState.config.categories[idx][field] = this.value;
                }
                updatePreview();
            });
        });

        container.querySelectorAll('.cat-icon-trigger').forEach(function(trigger) {
            trigger.addEventListener('click', function(event) {
                event.stopPropagation();
                var picker = this.closest('.cat-icon-picker');
                document.querySelectorAll('.cat-icon-picker.open').forEach(function(openPicker) {
                    if (openPicker !== picker) {
                        openPicker.classList.remove('open');
                        openPicker.querySelector('.cat-icon-trigger').setAttribute('aria-expanded', 'false');
                    }
                });
                var isOpen = picker.classList.toggle('open');
                this.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            });
        });
        container.querySelectorAll('.cat-icon-option').forEach(function(option) {
            option.addEventListener('click', function(event) {
                event.stopPropagation();
                var idx = parseInt(this.dataset.catIdx);
                var icon = this.dataset.icon;
                appState.config.categories[idx].icon = icon;
                appState.config.iconSetId = 'custom';
                var picker = this.closest('.cat-icon-picker');
                picker.querySelector('.cat-icon-trigger').textContent = icon;
                picker.classList.remove('open');
                picker.querySelector('.cat-icon-trigger').setAttribute('aria-expanded', 'false');
                var select = document.getElementById('icon-set-select');
                if (select) select.value = 'custom';
                updatePreview();
            });
        });
        if (!appState._categoryPickerBound) {
            document.addEventListener('click', function() {
                document.querySelectorAll('.cat-icon-picker.open').forEach(function(picker) {
                    picker.classList.remove('open');
                    picker.querySelector('.cat-icon-trigger').setAttribute('aria-expanded', 'false');
                });
            });
            appState._categoryPickerBound = true;
        }
    }

    function bindConfigEvents() {
        var configMap = {
            'site-title': 'siteTitle',
            'site-subtitle': 'siteSubtitle',
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
            'btn-style': 'btnStyle',
            'btn-size': 'btnSize',
            'grid-gap': 'gridGap',
            'font-style': 'fontStyle',
            'ambient-effect': 'ambientEffect',
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
                var eventName = elem.tagName === 'SELECT' ? 'change' : 'input';
                elem.addEventListener(eventName, function() {
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
            syncAboutNavControl();
            updatePreview();
        });

        // 全部游戏入口
        var allGamesToggle = document.getElementById('all-games-enabled');
        if (allGamesToggle) allGamesToggle.addEventListener('change', function() {
            appState.config.allGamesEnabled = this.checked;
            var switchedToHome = syncAllGamesNavControl();
            updatePreview(switchedToHome ? 'home' : undefined);
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
                updatePreview();
            });
        });

        // 卡片展示字段
        updateCardFieldsConfig();

        var descriptionMode = document.getElementById('card-description-mode');
        if (descriptionMode) {
            descriptionMode.addEventListener('change', function() {
                var linesByMode = { brief: '1', short: '2', standard: '3', full: '0' };
                var currentFields = (appState.config.cardFields || []).filter(function(field) { return field !== 'content'; });
                if (this.value !== 'none') currentFields.push('content');
                appState.config.cardFields = currentFields;
                if (linesByMode[this.value] !== undefined) appState.config.cardDescLines = linesByMode[this.value];
                updateCardFieldsConfig();
                syncCardDescriptionMode();
                updatePreview();
            });
        }

        // 推荐卡片展示字段
        updateRelatedCardFieldsConfig();

        // 设置初始值
        setInitialConfigValues();
    }

    function updateCardFieldsConfig() {
        var theme = THEMES.game;
        var container = document.getElementById('card-fields-config');
        var html = '';
        theme.fields.forEach(function(f) {
            if (f.id === 'id' || f.id === 'store_url') return;  // id和链接不在卡片上展示
            var checked = appState.config.cardFields.indexOf(f.id) !== -1 ? ' checked' : '';
            html += '<label class="checkbox-label"><input type="checkbox" value="' + f.id + '"' + checked + '> ' + f.labelZh + '</label>';
        });
        container.innerHTML = html;

        container.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
            cb.addEventListener('change', function() {
                appState.config.cardFields = [];
                container.querySelectorAll('input[type="checkbox"]:checked').forEach(function(c) {
                    appState.config.cardFields.push(c.value);
                });
                syncCardDescriptionMode();
                updatePreview();
            });
        });
    }

    function syncCardDescriptionMode() {
        var control = document.getElementById('card-description-mode');
        if (!control) return;
        if ((appState.config.cardFields || []).indexOf('content') === -1) {
            control.value = 'none';
            return;
        }
        var modesByLines = { '1': 'brief', '2': 'short', '3': 'standard', '0': 'full' };
        control.value = modesByLines[String(appState.config.cardDescLines)] || 'short';
    }

    function updateRelatedCardFieldsConfig() {
        var theme = THEMES.game;
        var container = document.getElementById('related-card-fields-config');
        var html = '';
        theme.fields.forEach(function(f) {
            if (f.id === 'id' || f.id === 'store_url' || f.id === 'content') return;
            var checked = appState.config.relatedCardFields.indexOf(f.id) !== -1 ? ' checked' : '';
            html += '<label class="checkbox-label"><input type="checkbox" value="' + f.id + '"' + checked + '> ' + f.labelZh + '</label>';
        });
        container.innerHTML = html;

        container.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
            cb.addEventListener('change', function() {
                appState.config.relatedCardFields = [];
                container.querySelectorAll('input[type="checkbox"]:checked').forEach(function(c) {
                    appState.config.relatedCardFields.push(c.value);
                });
                updatePreview();
            });
        });
    }

    function syncAboutNavControl() {
        var aboutLink = document.querySelector('#footer-links-config input[value="about"]');
        if (!aboutLink) return;
        var enabled = appState.config.aboutEnabled !== false;
        var aboutPreviewTab = document.querySelector('.preview-tab[data-page="about"]');
        aboutLink.disabled = !enabled;
        aboutLink.closest('.checkbox-label').classList.toggle('is-disabled', !enabled);
        if (aboutPreviewTab) {
            aboutPreviewTab.hidden = !enabled;
            if (!enabled && aboutPreviewTab.classList.contains('active')) {
                aboutPreviewTab.classList.remove('active');
                document.querySelector('.preview-tab[data-page="home"]').classList.add('active');
            }
        }
        if (!enabled) {
            aboutLink.checked = false;
            appState.config.footerLinks = (appState.config.footerLinks || []).filter(function(link) {
                return link !== 'about';
            });
        }
    }

    function syncAllGamesNavControl() {
        var allGamesPreviewTab = document.querySelector('.preview-tab[data-page="all"]');
        var enabled = appState.config.allGamesEnabled !== false;
        if (!allGamesPreviewTab) return false;
        allGamesPreviewTab.hidden = !enabled;
        if (!enabled && allGamesPreviewTab.classList.contains('active')) {
            allGamesPreviewTab.classList.remove('active');
            var homePreviewTab = document.querySelector('.preview-tab[data-page="home"]');
            if (homePreviewTab) homePreviewTab.classList.add('active');
            return true;
        }
        return false;
    }

    function setInitialConfigValues() {
        var c = appState.config;
        var theme = THEMES.game;

        document.getElementById('site-title').value = c.siteTitle || theme.siteTitle;
        document.getElementById('site-subtitle').value = c.siteSubtitle || theme.siteSubtitle;
        document.getElementById('contact-email').value = c.contactEmail || theme.pages.contact.email;

        // 设置select的初始值
        if (c.navbarLayout) document.getElementById('navbar-layout').value = c.navbarLayout;
        if (c.footerStyle) document.getElementById('footer-style').value = c.footerStyle;
        if (c.backLinkStyle) document.getElementById('back-link-style').value = c.backLinkStyle;
        if (c.cardColumns) document.getElementById('card-columns').value = c.cardColumns;
        if (c.metaLayout) document.getElementById('meta-layout').value = c.metaLayout;
        if (c.contentRender) document.getElementById('content-render').value = c.contentRender;
        if (c.navbarStyle === 'bottom-fixed') c.navbarStyle = 'glass-sticky';
        if (c.navbarStyle) document.getElementById('navbar-style').value = c.navbarStyle;
        if (c.navbarHeight) document.getElementById('navbar-height').value = c.navbarHeight;
        if (c.logoStyle) document.getElementById('logo-style').value = c.logoStyle;
        syncBrandPreset();
        syncLogoIconPicker();
        if (c.cardHover) document.getElementById('card-hover').value = c.cardHover;
        if (c.cardBorder) document.getElementById('card-border').value = c.cardBorder;
        if (c.cardRadius) document.getElementById('card-radius').value = c.cardRadius;
        if (c.cardSpacing) document.getElementById('card-spacing').value = c.cardSpacing;
        var legacyButtonStyles = { gradient: 'solid', rounded: 'pill', '3d': 'solid', ghost: 'text' };
        if (legacyButtonStyles[c.btnStyle]) c.btnStyle = legacyButtonStyles[c.btnStyle];
        if (c.btnStyle) document.getElementById('btn-style').value = c.btnStyle;
        if (c.btnSize) document.getElementById('btn-size').value = c.btnSize;
        if (c.gridGap) document.getElementById('grid-gap').value = c.gridGap;
        if (c.fontStyle) document.getElementById('font-style').value = c.fontStyle;
        if (c.ambientEffect) document.getElementById('ambient-effect').value = c.ambientEffect;
        if (c.animationEnter) document.getElementById('animation-enter').value = c.animationEnter;
        if (c.transitionSpeed) document.getElementById('transition-speed').value = c.transitionSpeed;
        if (c.metaBg) document.getElementById('meta-bg').value = c.metaBg;
        if (c.detailImgStyle) document.getElementById('detail-img-style').value = c.detailImgStyle;
        if (c.categoryTitleStyle) document.getElementById('category-title-style').value = c.categoryTitleStyle;
        if (c.categoryTitleAlign) document.getElementById('category-title-align').value = c.categoryTitleAlign;
        if (c.cardImageHeight) document.getElementById('card-image-height').value = c.cardImageHeight;
        if (c.contentMaxWidth) document.getElementById('content-max-width').value = c.contentMaxWidth;
        refreshCustomConfigSelects();
        if (c.heroStyle) document.getElementById('hero-style').value = c.heroStyle;
        if (c.detailLayout) document.getElementById('detail-layout').value = c.detailLayout;
        if (c.cardViewMode) document.getElementById('card-view-mode').value = c.cardViewMode;
        syncCardDescriptionMode();
        if (c.privacyLength) document.getElementById('privacy-length').value = c.privacyLength;
        if (c.termsLength) document.getElementById('terms-length').value = c.termsLength;

        // 开关
        document.getElementById('hero-enabled').checked = c.heroEnabled === true;
        document.getElementById('hero-config').style.display = c.heroEnabled === true ? 'block' : 'none';
        document.getElementById('action-btn-enabled').checked = c.actionButtonEnabled;
        document.getElementById('about-enabled').checked = c.aboutEnabled !== false;
        document.getElementById('all-games-enabled').checked = c.allGamesEnabled !== false;
        document.getElementById('action-btn-text').value = c.actionButtonText || theme.detail.actionButton.text;
        document.getElementById('action-btn-config').style.display = c.actionButtonEnabled ? 'block' : 'none';
        syncAboutNavControl();
        syncAllGamesNavControl();

        // 分类数量
        document.getElementById('category-count').value = c.categories.length;
        document.getElementById('cat-count-value').textContent = c.categories.length;
    }

    // ========== 样式网格 ==========
    function initStyleGrid() {
        var grid = document.getElementById('style-grid');
        var html = '';
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

    function initLayoutTemplateGrid() {
        var grid = document.getElementById('layout-template-grid');
        if (!grid || typeof LAYOUT_PRESETS === 'undefined') return;
        grid.innerHTML = LAYOUT_PRESETS.map(function(template) {
            var selected = appState.config.layoutTemplate === template.id ? ' selected' : '';
            return '<button type="button" class="layout-template-card' + selected + '" data-layout-id="' + template.id + '">' +
                '<span class="layout-miniature ' + template.previewClass + '"><i></i><i></i><i></i><i></i><i></i></span>' +
                '<strong>' + escapeHtml(template.name) + '</strong>' +
                '<small>' + escapeHtml(template.desc) + '</small>' +
                '</button>';
        }).join('');

        grid.querySelectorAll('.layout-template-card').forEach(function(card) {
            card.addEventListener('click', function() {
                grid.querySelectorAll('.layout-template-card').forEach(function(item) { item.classList.remove('selected'); });
                this.classList.add('selected');
                appState.config.layoutTemplate = this.dataset.layoutId;
                appState.config.detailLayout = 'single';
                document.getElementById('detail-layout').value = 'single';
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
        function activatePreviewTab(page) {
            document.querySelectorAll('.preview-tab').forEach(function(tab) {
                tab.classList.toggle('active', tab.dataset.page === page);
            });
        }

        function applyPreviewSize(size) {
            var normalizedSize = ['desktop', 'tablet', 'mobile'].indexOf(size) !== -1 ? size : 'desktop';
            var configLayout = document.querySelector('.config-layout');
            previewFrame.className = 'preview-frame ' + normalizedSize;
            if (configLayout) {
                configLayout.dataset.previewSize = normalizedSize;
            }
        }

        function initFullscreenPreview() {
            var previewPanel = document.querySelector('#step-1 .preview-panel');
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
                activatePreviewTab(this.dataset.page);
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
            if (e.data && e.data.type === 'preview-game') {
                var gameIndex = Number(e.data.index);
                if (!Number.isInteger(gameIndex) || gameIndex < 0 || gameIndex >= appState.data.length) return;
                appState.selectedPreviewGameIndex = gameIndex;
                activatePreviewTab('detail');
                updateAdPlacementUI();
                updatePreview('detail');
                return;
            }
            if (e.data && e.data.type === 'preview-nav') {
                var page = e.data.page;
                if (page === 'detail' && Number.isInteger(e.data.itemIndex)) {
                    appState.selectedPreviewGameIndex = e.data.itemIndex;
                }
                if (page === 'section' && typeof e.data.categorySlug === 'string') {
                    appState.previewSectionSlug = e.data.categorySlug;
                }
                activatePreviewTab(page);
                updateAdPlacementUI();
                updatePreview(page);
            }
            // 广告放置消息
            if (e.data && e.data.type === 'ad-place' && appState.adPlacementMode) {
                var adId = appState.adPlacementMode;
                var position = e.data.position;
                var page = e.data.page || 'home';
                if (!appState.config.adPlacements) appState.config.adPlacements = {};
                if (!appState.config.adPlacements[adId]) appState.config.adPlacements[adId] = {};
                appState.config.adPlacements[adId][page] = position;
                exitAdPlacementMode();
                updateAdPlacementUI();
                updatePreview();
            }
        });
    }

    // ========== 解析广告代码文件 ==========
    function syncContactEmailFromAdCode(result) {
        var host = result && result.detectedHost ? String(result.detectedHost).trim().toLowerCase() : '';
        if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(host)) return '';
        var email = 'contact@' + host;
        appState.config.contactEmail = email;
        var input = document.getElementById('contact-email');
        if (input) input.value = email;
        return email;
    }

    function hasValidatedDirectAdCode() {
        return appState.siteBuildMode === 'normal' && appState.normalAdMode !== 'reserve' && !!(appState.adCodeMigration && appState.adCodeMigration.valid);
    }

    function isReservedDirectAdMode() {
        return appState.siteBuildMode === 'normal' && appState.normalAdMode === 'reserve';
    }

    function reservedAdPlacementCount() {
        if (appState.reservePlacementMode === 'fixed') return 6;
        var placements = appState.config && appState.config.adPlacements || {};
        return Object.keys(placements).reduce(function(total, adId) {
            var pages = placements[adId] || {};
            return total + (pages.home ? 1 : 0) + (pages.detail ? 1 : 0);
        }, 0);
    }

    function syncDirectAdPlacementUI() {
        var automatic = hasValidatedDirectAdCode();
        var reserved = isReservedDirectAdMode();
        var manualGroup = document.getElementById('ad-placement-group');
        var modeGroup = document.getElementById('normal-ad-mode-group');
        var codePanel = document.getElementById('ad-code-mode-panel');
        var manualControls = document.getElementById('ad-manual-placement-controls');
        var fixedNote = document.getElementById('ad-fixed-placement-note');
        var automaticNote = document.getElementById('ad-auto-placement-note');
        if (modeGroup) modeGroup.hidden = appState.siteBuildMode !== 'normal';
        if (manualGroup) manualGroup.hidden = !reserved;
        if (codePanel) codePanel.hidden = reserved || appState.siteBuildMode !== 'normal';
        if (manualControls) manualControls.hidden = appState.reservePlacementMode === 'fixed';
        if (fixedNote) fixedNote.hidden = appState.reservePlacementMode !== 'fixed';
        if (automaticNote) automaticNote.hidden = !automatic;
        document.querySelectorAll('input[name="normal-ad-mode"]').forEach(function(input) {
            input.checked = input.value === appState.normalAdMode;
        });
        document.querySelectorAll('input[name="ad-js-version"]').forEach(function(input) {
            input.checked = input.value === appState.adJsVersion;
        });
        document.querySelectorAll('input[name="reserve-placement-mode"]').forEach(function(input) {
            input.checked = input.value === appState.reservePlacementMode;
        });
        if (!reserved || appState.reservePlacementMode === 'fixed') appState.adPlacementMode = null;
    }

    // ========== 广告放置模式 ==========
    function initAdConfig() {
        var adCodeUpload = document.getElementById('ad-code-upload');
        var adCodeBtn = document.getElementById('ad-code-btn');
        var adCodeStatus = document.getElementById('ad-code-status');
        var adCodePreview = document.getElementById('ad-code-preview');

        document.querySelectorAll('input[name="ad-js-version"]').forEach(function(input) {
            input.addEventListener('change', function() {
                if (!this.checked) return;
                appState.adJsVersion = this.value;
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
                syncDirectAdPlacementUI();
                updateAdPlacementUI();
                updatePreview();
            });
        });

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
                            adCodePreview.textContent = '';
                            [
                                ['banner1', paths.bannerPath1], ['banner2', paths.bannerPath2],
                                ['banner3', paths.bannerPath3], ['banner4', paths.bannerPath4],
                                ['INT', paths.interstitialPath], ['ANC', paths.anchorPath],
                                ['GA', paths.analyticsID]
                            ].forEach(function(row) {
                                var line = document.createElement('div');
                                var label = document.createElement('span');
                                var value = document.createElement('span');
                                label.className = 'ad-path-label';
                                value.className = 'ad-path-value';
                                label.textContent = row[0] + ': ';
                                value.textContent = row[1] || '-';
                                line.appendChild(label);
                                line.appendChild(value);
                                adCodePreview.appendChild(line);
                            });
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

        document.querySelectorAll('.ad-select-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var adId = this.dataset.ad;
                if (appState.adPlacementMode === adId) {
                    exitAdPlacementMode();
                } else {
                    enterAdPlacementMode(adId);
                }
            });
        });
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
        if (!isReservedDirectAdMode()) {
            showNotice('请先选择“先预留广告位”模式，再手动设置首页和详情页的位置。', '请选择广告接入方式');
            return;
        }
        if (appState.reservePlacementMode === 'fixed') return;
        if (hasValidatedDirectAdCode()) {
            showNotice('广告 TXT 已通过校验，系统会自动插入三个广告位，无需手动选择位置。', '已自动放置广告');
            return;
        }

        // “重新放置”只撤销当前预览页的旧位置，保留该广告在另一页面的位置。
        // 先清理再进入放置模式，避免旧占位留在画面中且没有可点击的新位置。
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
        document.getElementById('ad-placement-hint').style.display = 'block';
        updatePreview();
    }

    function exitAdPlacementMode() {
        appState.adPlacementMode = null;
        document.querySelectorAll('.ad-select-btn').forEach(function(btn) {
            btn.textContent = '选择放置';
            btn.style.background = '';
            btn.style.color = '';
            btn.disabled = false;
            btn.style.opacity = '1';
        });
        document.getElementById('ad-placement-hint').style.display = 'none';
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

            var parts = [];
            if (hasHome) parts.push('首页: ' + translatePosition(p.home));
            if (hasDetail) parts.push('详情页: ' + translatePosition(p.detail));
            if (label) label.textContent = hasAny ? parts.join(' | ') : '未放置';

            if (removeBtn) removeBtn.style.display = hasAny ? 'inline-block' : 'none';

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
        if (pos.indexOf('after-section-') === 0) {
            var idx = pos.replace('after-section-', '');
            return '分类' + (parseInt(idx) + 1) + '下方';
        }
        if (pos.indexOf('cat-') === 0 && pos.indexOf('-after-title') !== -1) {
            var parts = pos.split('-');
            return '分类' + (parseInt(parts[1]) + 1) + '标题后';
        }
        if (pos.indexOf('cat-') === 0 && pos.indexOf('-between-') !== -1) {
            var m = pos.match(/^cat-(\d+)-between-(\d+)-(\d+)$/);
            if (m) return '分类' + (parseInt(m[1]) + 1) + '卡片' + (parseInt(m[2]) + 1) + '与' + (parseInt(m[3]) + 1) + '之间';
        }
        if (pos.indexOf('cat-') === 0 && pos.indexOf('-after-last') !== -1) {
            var m2 = pos.match(/^cat-(\d+)-after-last$/);
            if (m2) return '分类' + (parseInt(m2[1]) + 1) + '末尾';
        }
        if (pos.indexOf('detail-between-p-') === 0) {
            var pIdx = pos.replace('detail-between-p-', '');
            return '段落' + pIdx + '与' + (parseInt(pIdx) + 1) + '之间';
        }
        return map[pos] || pos;
    }

    var previewTimeout = null;
    function updatePreview(pageType) {
        if (appState.currentStep !== 1) return;
        if (appState.siteBuildMode === 'differentiated' && (typeof DifferentiatedBuilder === 'undefined' || DifferentiatedBuilder.BUILD_VERSION !== REQUIRED_DIFFERENTIATED_BUILDER_VERSION)) {
            if (previewTimeout) clearTimeout(previewTimeout);
            previewFrame.removeAttribute('src');
            previewFrame.srcdoc = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#f4f7fb;color:#15243a;font:16px/1.6 system-ui,sans-serif}.notice{max-width:560px;padding:32px;border:1px solid #f0b8b8;background:#fff;box-shadow:8px 8px 0 #d33}h1{margin:0 0 12px;font-size:24px}</style><body><section class="notice"><h1>模板引擎版本未同步</h1><p>当前页面拒绝运行旧模板。请刷新页面后重新上传本次数据源。</p></section></body></html>';
            return;
        }
        if (appState.siteBuildMode === 'differentiated' && !appState.differentiatedImportName && typeof DifferentiatedBuilder !== 'undefined') {
            if (previewTimeout) clearTimeout(previewTimeout);
            previewFrame.removeAttribute('src');
            previewFrame.srcdoc = DifferentiatedBuilder.generateWaitingPreviewHtml('games');
            return;
        }
        if (!appState.data || appState.data.length === 0) return;

        if (previewTimeout) clearTimeout(previewTimeout);
        previewTimeout = setTimeout(function() {
            var activeTab = document.querySelector('.preview-tab.active');
            if (!pageType) pageType = activeTab ? activeTab.dataset.page : 'home';

            try {
                if (appState._previewBlobUrls.length > 0) {
                    appState._previewBlobUrls.forEach(function(u) { URL.revokeObjectURL(u); });
                    appState._previewBlobUrls = [];
                }
                var html = appState.siteBuildMode === 'differentiated' && typeof DifferentiatedBuilder !== 'undefined'
                    ? DifferentiatedBuilder.generatePreviewHtml(appState, pageType, {
                        siteType: 'games',
                        itemIndex: appState.selectedPreviewGameIndex,
                        categorySlug: appState.previewSectionSlug
                    })
                    : Generator.generatePreviewHtml(appState, pageType);
                previewFrame.removeAttribute('src');
                previewFrame.srcdoc = html;
            } catch(e) {
                console.error('Preview error:', e);
            }
        }, 300);
    }

    // ========== Step 2: 导出 ==========
    function generateExportSummary() {
        if (appState.siteBuildMode === 'differentiated' && typeof DifferentiatedBuilder !== 'undefined') {
            var target = document.getElementById('export-summary');
            target.innerHTML = '<h4>差异化精品游戏站审计</h4><p>正在检查可玩地址、本地文件、封面、控制说明、来源授权、法律信息与设计指纹…</p>';
            document.querySelectorAll('[data-diff-export]').forEach(function(button) { button.disabled = true; });
            DifferentiatedBuilder.audit(appState, { variant: 'review', siteType: 'games' }).then(function(outcome) {
                var config = outcome.config;
                target.innerHTML = '<h4>配置摘要</h4><div class="summary-grid">' +
                    makeSummaryItem('建站方式', '差异化精品建站') +
                    makeSummaryItem('独立领域', config.vertical) +
                    makeSummaryItem('游戏数量', config.items.length + '款') +
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
        var config = appState.config;

        var selectedStyleName = '';
        var selectedLayoutName = '';
        STYLE_PRESETS.forEach(function(s) {
            if (s.id === config.selectedStyle) selectedStyleName = s.name;
        });
        LAYOUT_PRESETS.forEach(function(layout) {
            if (layout.id === config.layoutTemplate) selectedLayoutName = layout.name;
        });

        var summaryHtml = '<h4>配置摘要</h4><div class="summary-grid">';
        summaryHtml += makeSummaryItem('游戏来源', activeSourceLabel);
        summaryHtml += makeSummaryItem('数据条数', appState.data.length + '款游戏');
        summaryHtml += makeSummaryItem('网站标题', config.siteTitle || 'GameHub');
        summaryHtml += makeSummaryItem('布局模板', selectedLayoutName || '经典门户');
        summaryHtml += makeSummaryItem('视觉风格', selectedStyleName);
        var ambientNames = {
            none: '静态', aurora: '极光流动', stardust: '星尘漂移', 'grid-scan': '网格扫描', prism: '棱镜光晕',
            'arcade-pulse': '街机脉冲', 'pixel-drift': '像素漂移', 'comet-trails': '彗星掠影', 'radar-sweep': '雷达扫描'
        };
        summaryHtml += makeSummaryItem('动态氛围', ambientNames[config.ambientEffect] || '静态');
        summaryHtml += makeSummaryItem('Hero区域', config.heroEnabled ? '开启' : '关闭');
        summaryHtml += makeSummaryItem('分类数量', config.categories.length + '个');
        summaryHtml += makeSummaryItem('操作按钮', config.actionButtonEnabled ? config.actionButtonText : '关闭');
        summaryHtml += makeSummaryItem('相关推荐', config.relatedCount + '条');
        summaryHtml += makeSummaryItem('建站方式', appState.siteBuildMode === 'ad-migration' ? '广告移植建站' : '游戏建站');
        summaryHtml += '</div>';

        var migration = appState.legacyAdMigration;
        var isMigration = appState.siteBuildMode === 'ad-migration';
        var adCode = appState.adCodeMigration;
        var isReservedAds = isReservedDirectAdMode();
        var reservedCount = isReservedAds ? reservedAdPlacementCount() : 0;
        var directAdValid = !adCode || adCode.valid;
        if (isMigration) {
            summaryHtml += '<section class="migration-validation ' + (migration && migration.valid ? '' : 'invalid') + '"><h5>广告移植导出前校验</h5>' + migrationResultHtml(migration) + '</section>';
        } else if (isReservedAds) {
            summaryHtml += '<section class="migration-validation ' + (reservedCount ? '' : 'invalid') + '"><h5>' + (reservedCount ? '广告位预留配置完成' : '尚未放置广告位') + '</h5><p>' + (reservedCount ? '将导出 ' + reservedCount + ' 个首页/详情页广告位置，并生成路径为空的 js/ad.js。' : '请返回“广告代码”标签，至少在首页或详情页放置一个广告容器后再导出。') + '</p></section>';
        } else if (adCode) {
            var adMessages = (adCode.valid ? ['广告 TXT 已通过校验，将自动生成 ad.js，并在首页和详情页插入三个固定广告位置。'] : []).concat((adCode.errors || []).map(function(item) { return item.message; }));
            var adWarnings = (adCode.warnings || []).map(function(item) { return item.message; });
            summaryHtml += '<section class="migration-validation ' + (adCode.valid ? '' : 'invalid') + '"><h5>广告代码导出前校验</h5>' +
                '<p>' + escapeHtml(adMessages.join(' ')) + '</p>' +
                (adWarnings.length ? '<p>提示：' + escapeHtml(adWarnings.join(' ')) + '</p>' : '') + '</section>';
        } else {
            summaryHtml += '<section class="migration-validation"><h5>普通建站校验通过</h5><p>本次不会读取旧网站源码，也不会生成 GPT 脚本、ad.js 或广告容器。</p></section>';
        }

        document.getElementById('export-summary').innerHTML = summaryHtml;
        document.getElementById('btn-export').disabled = (isMigration && !(migration && migration.valid)) || (!isMigration && !isReservedAds && !directAdValid) || (isReservedAds && !reservedCount);
    }

    function makeSummaryItem(label, value) {
        return '<div class="summary-item"><span class="label">' + escapeHtml(label) + '</span><span class="value">' + escapeHtml(value) + '</span></div>';
    }

    // 导出按钮
    document.getElementById('btn-export').addEventListener('click', function() {
        if (appState.siteBuildMode === 'ad-migration' && !(appState.legacyAdMigration && appState.legacyAdMigration.valid)) {
            showNotice('广告移植校验尚未通过，不能导出不完整站点。', '暂时不能导出');
            return;
        }
        if (isReservedDirectAdMode() && !reservedAdPlacementCount()) {
            showNotice('请先在首页或详情页至少放置一个广告容器，或选择固定位置。', '尚未放置广告位');
            return;
        }
        if (appState.siteBuildMode === 'normal' && appState.normalAdMode !== 'reserve' && appState.adCodeMigration && !appState.adCodeMigration.valid) {
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
            saveAs(blob, 'gamehub-website.zip');
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
        }, { variant: variant, siteType: 'games', JSZip: window.JSZip }).then(function(blob) {
            var config = DifferentiatedBuilder.buildConfig(appState, { variant: variant, siteType: 'games' });
            saveAs(blob, DifferentiatedBuilder.slugify(config.siteTitle, 'game-site') + '-' + variant + '.zip');
            progressText.textContent = '✅ 差异化游戏静态站导出成功；ZIP 已开始下载';
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

    // ========== 一键随机组装 ==========
    function randomPick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function generateRandomConfig() {
        var c = appState.config;

        // 高影响项
        var styleIds = STYLE_PRESETS.map(function(s) { return s.id; });
        c.selectedStyle = randomPick(styleIds);
        c.layoutTemplate = randomPick(LAYOUT_PRESETS.map(function(layout) { return layout.id; }));

        var fontOptions = ['sans-serif', 'serif', 'monospace', 'cursive', 'condensed',
            'rounded', 'elegant', 'modern', 'tech', 'handwrite', 'retro', 'clean', 'display', 'literary'];
        c.fontStyle = randomPick(fontOptions);

        c.categoryTitleStyle = randomPick(['single', 'none', 'double', 'dotted', 'gradient', 'left-accent']);
        c.categoryTitleAlign = randomPick(['left', 'center']);
        c.cardViewMode = 'card';
        c.navbarStyle = randomPick(['glass-sticky', 'normal', 'transparent', 'dark-fixed', 'side-drawer', 'floating-pill', 'segmented', 'underline', 'accent-bar', 'command-bar', 'editorial', 'split-brand', 'outline-frame', 'spotlight', 'rail']);
        c.footerStyle = randomPick(['simple', 'compact', 'ribbon', 'brand-grid', 'detailed']);
        c.cardBorder = randomPick(['rounded', 'shadow', 'thin', 'double', 'dashed', 'thick', 'none']);
        c.detailLayout = 'single';

        // 中影响项
        c.cardHover = randomPick(['float', 'scale', 'flip', 'glow', 'bounce', 'tilt', 'border-glow', 'slide-up', 'none']);
        c.cardRadius = randomPick(['0', '2px', '4px', '8px', '12px', '16px', '24px']);
        c.btnStyle = randomPick(['solid', 'outline', 'soft', 'pill', 'square', 'text']);
        c.detailImgStyle = randomPick(['fullwidth', 'centered', 'float-left', 'float-right', 'banner']);
        c.logoStyle = randomPick(['text', 'text-icon', 'icon', 'gradient-text', 'boxed']);
        c.siteTitle = randomPick(GAME_BRAND_PRESETS);
        c.logoIcon = randomPick(GAME_EMOJI_ICONS);
        applyIconSet(randomPick(GAME_ICON_SET_PRESETS).id, false);
        c.ambientEffect = randomPick([
            'none', 'none', 'aurora', 'stardust', 'grid-scan', 'prism',
            'arcade-pulse', 'pixel-drift', 'comet-trails', 'radar-sweep'
        ]);
        c.animationEnter = randomPick(['fadeIn', 'slideUp', 'zoomIn', 'slideLeft', 'slideRight', 'rotateIn', 'flipIn', 'none']);

        // 低影响项
        c.navbarHeight = randomPick(['40px', '50px', '60px', '70px', '80px']);
        c.cardImageHeight = randomPick(['120px', '150px', '180px', '220px', '260px']);
        c.cardSpacing = randomPick(['8px', '12px', '20px', '30px', '40px']);
        c.gridGap = randomPick(['5px', '10px', '20px', '30px', '40px']);
        c.btnSize = randomPick(['xsmall', 'small', 'medium', 'large', 'xlarge']);
        c.contentMaxWidth = randomPick(['900px', '1000px', '1100px', '1200px', '1400px', 'full']);
        c.transitionSpeed = randomPick(['0.1s', '0.2s', '0.3s', '0.5s', '0.8s']);
        c.metaBg = randomPick(['dark', 'light', 'transparent', 'primary', 'bordered']);
        c.cardColumns = 'auto';
        c.cardDescLines = randomPick(['1', '2', '3']);
    }

    function applyConfigToUI() {
        var c = appState.config;

        var selectIds = [
            'navbar-layout', 'footer-style', 'back-link-style', 'card-columns',
            'meta-layout', 'content-render', 'navbar-style', 'navbar-height',
            'logo-style', 'card-hover', 'card-border', 'card-radius', 'card-spacing',
            'btn-style', 'btn-size', 'grid-gap', 'font-style', 'ambient-effect', 'animation-enter',
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
            'card-spacing': 'cardSpacing', 'btn-style': 'btnStyle',
            'btn-size': 'btnSize', 'grid-gap': 'gridGap',
            'font-style': 'fontStyle', 'ambient-effect': 'ambientEffect', 'animation-enter': 'animationEnter',
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

        document.querySelectorAll('.layout-template-card').forEach(function(card) {
            card.classList.toggle('selected', card.dataset.layoutId === c.layoutTemplate);
        });
        var siteTitleInput = document.getElementById('site-title');
        if (siteTitleInput) siteTitleInput.value = c.siteTitle || '';
        syncBrandPreset();
        syncLogoIconPicker();
        syncCardDescriptionMode();
        var iconSetSelect = document.getElementById('icon-set-select');
        if (iconSetSelect) iconSetSelect.value = c.iconSetId || 'custom';
        updateCategoryConfig((c.categories || []).length);
        refreshCustomConfigSelects();
    }

    document.getElementById('random-assemble-btn').addEventListener('click', function() {
        generateRandomConfig();
        applyConfigToUI();
        updatePreview();

        var btn = this;
        btn.classList.add('is-active');
        setTimeout(function() {
            btn.classList.remove('is-active');
        }, 400);
    });

    // ========== 初始化 ==========
    initBuildModeControls();
    goToStep(1);
    loadGameData();

})();
