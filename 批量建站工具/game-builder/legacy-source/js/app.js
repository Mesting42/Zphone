/**
 * 游戏站建站工具 - 主应用逻辑
 * 管理步骤导航、状态、UI交互、实时预览
 */

(function() {
    'use strict';

    // ========== 应用状态 ==========
    var appState = {
        currentStep: 1,
        selectedTheme: 'game',  // 固定为game
        data: [],
        jsonFields: [],
        isLocalImages: false,
        localImages: {},
        fieldMapping: {
            title: 'title',
            content: 'description',
            image: 'thumb',
            store_url: 'url',
            id: 'id'
        },
        config: {},
        adPlacementMode: null,
        _previewBlobUrls: []
    };

    // ========== DOM引用 ==========
    var stepPanels = document.querySelectorAll('.step-panel');
    var stepItems = document.querySelectorAll('.step-item');
    var stepLines = document.querySelectorAll('.step-line');
    var btnPrev = document.getElementById('btn-prev');
    var btnNext = document.getElementById('btn-next');
    var previewFrame = document.getElementById('preview-frame');

    // ========== 步骤导航 ==========
    function goToStep(step) {
        if (step < 1 || step > 2) return;

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
        btnNext.textContent = step === 2 ? '完成' : '下一步 →';
        btnNext.style.display = step === 2 ? 'none' : 'inline-block';

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
            navLinks: ['home', 'privacy', 'terms', 'contact', 'about'],
            navbarLayout: 'normal',
            footerStyle: 'simple',
            backLinkStyle: 'text',
            heroEnabled: false,
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
            selectedStyle: 'dark',
            navbarStyle: 'glass-sticky',
            navbarHeight: '60px',
            logoStyle: 'text',
            cardHover: 'float',
            cardBorder: 'rounded',
            cardRadius: '8px',
            cardSpacing: '20px',
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
                cardDescLines: '2',
                adPlacements: {}
        };
    }

    // ========== 自动加载游戏数据 ==========
    function loadGameData() {
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
                alert('加载游戏数据失败: ' + err.message);
            });
    }

    function processData(data) {
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
            alert('游戏数据格式不正确或为空');
            return;
        }

        appState.data = data;

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
        updatePreview();
    }

    // ========== 配置面板 ==========
    function initConfigPanel() {
        var theme = THEMES.game;

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
        initStyleGrid();
        initConfigTabs();
        initPreviewControls();
        initAdConfig();
    }

    function updateCategoryConfig(count) {
        var theme = THEMES.game;
        var container = document.getElementById('categories-config');
        var currentCats = appState.config.categories || theme.categories;

        // 调整分类数量
        while (currentCats.length < count) {
            currentCats.push({ name: 'Category ' + (currentCats.length + 1), icon: '📌', count: 6 });
        }
        appState.config.categories = currentCats.slice(0, count);

        var html = '';
        appState.config.categories.forEach(function(cat, i) {
            html += '<div class="category-config-item">';
            html += '<input type="text" class="cat-icon-input" value="' + cat.icon + '" data-cat-idx="' + i + '" data-cat-field="icon">';
            html += '<input type="text" class="cat-name-input" value="' + cat.name + '" data-cat-idx="' + i + '" data-cat-field="name">';
            html += '<input type="number" class="cat-count-input" value="' + cat.count + '" min="1" max="20" data-cat-idx="' + i + '" data-cat-field="count">';
            html += '</div>';
        });
        container.innerHTML = html;

        // 绑定事件
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
    }

    function bindConfigEvents() {
        var configMap = {
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
            'card-desc-lines': 'cardDescLines',
            'privacy-length': 'privacyLength',
            'terms-length': 'termsLength'
        };

        Object.keys(configMap).forEach(function(elemId) {
            var elem = document.getElementById(elemId);
            if (elem) {
                elem.addEventListener('change', function() {
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
            updatePreview();
        });

        // 导航链接
        document.querySelectorAll('#nav-links-config input[type="checkbox"]').forEach(function(cb) {
            cb.addEventListener('change', function() {
                appState.config.navLinks = [];
                document.querySelectorAll('#nav-links-config input[type="checkbox"]:checked').forEach(function(c) {
                    appState.config.navLinks.push(c.value);
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
                updatePreview();
            });
        });
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
            });
        });
    }

    function setInitialConfigValues() {
        var c = appState.config;
        var theme = THEMES.game;

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
        if (c.cardDescLines !== undefined) document.getElementById('card-desc-lines').value = c.cardDescLines;
        if (c.privacyLength) document.getElementById('privacy-length').value = c.privacyLength;
        if (c.termsLength) document.getElementById('terms-length').value = c.termsLength;

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
                previewFrame.className = 'preview-frame ' + this.dataset.size;
            });
        });

        // 监听iframe内的导航消息
        window.addEventListener('message', function(e) {
            if (e.data && e.data.type === 'preview-nav') {
                var page = e.data.page;
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
    function parseAdCodeFile(text) {
        var paths = {
            bannerPath1: '',
            bannerPath2: '',
            bannerPath3: '',
            bannerPath4: '',
            interstitialPath: '',
            anchorPath: '',
            analyticsID: ''
        };

        var slotRegex = /googletag\.defineSlot\(\s*'([^']+)'[^)]*\)\s*\.addService/g;
        var match;
        while ((match = slotRegex.exec(text)) !== null) {
            var slotPath = match[1];
            if (slotPath.indexOf('-banner1') !== -1) paths.bannerPath1 = slotPath;
            else if (slotPath.indexOf('-banner2') !== -1) paths.bannerPath2 = slotPath;
            else if (slotPath.indexOf('-banner3') !== -1) paths.bannerPath3 = slotPath;
            else if (slotPath.indexOf('-INT') !== -1) paths.interstitialPath = slotPath;
            else if (slotPath.indexOf('-ANC') !== -1) paths.anchorPath = slotPath;
        }

        paths.bannerPath4 = paths.bannerPath3;

        var gaMatch = text.match(/gtag\(\s*'config'\s*,\s*'([^']+)'\s*\)/);
        if (gaMatch) paths.analyticsID = gaMatch[1];

        var hasAny = paths.bannerPath1 || paths.bannerPath2 || paths.bannerPath3 ||
                     paths.interstitialPath || paths.anchorPath || paths.analyticsID;
        return hasAny ? paths : null;
    }

    // ========== 广告放置模式 ==========
    function initAdConfig() {
        var adCodeUpload = document.getElementById('ad-code-upload');
        var adCodeBtn = document.getElementById('ad-code-btn');
        var adCodeStatus = document.getElementById('ad-code-status');
        var adCodePreview = document.getElementById('ad-code-preview');

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
                    var paths = parseAdCodeFile(text);
                    if (paths) {
                        appState.config.adPaths = paths;
                        if (adCodeBtn) adCodeBtn.textContent = '重新选择';
                        if (adCodeStatus) {
                            adCodeStatus.textContent = '已提取';
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
                        if (adCodeStatus) {
                            adCodeStatus.textContent = '解析失败';
                            adCodeStatus.style.color = '#e74c3c';
                        }
                    }
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
    }

    function enterAdPlacementMode(adId) {
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
            btn.style.background = 'transparent';
            btn.style.color = 'var(--color-primary,#4a9eff)';
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
                var html = Generator.generatePreviewHtml(appState, pageType);
                var blob = new Blob([html], { type: 'text/html' });
                var url = URL.createObjectURL(blob);
                previewFrame.src = url;
                previewFrame.onload = function() {
                    URL.revokeObjectURL(url);
                };
            } catch(e) {
                console.error('Preview error:', e);
            }
        }, 300);
    }

    // ========== Step 2: 导出 ==========
    function generateExportSummary() {
        var config = appState.config;

        var selectedStyleName = '';
        STYLE_PRESETS.forEach(function(s) {
            if (s.id === config.selectedStyle) selectedStyleName = s.name;
        });

        var summaryHtml = '<h4>配置摘要</h4><div class="summary-grid">';
        summaryHtml += makeSummaryItem('数据条数', appState.data.length + '款游戏');
        summaryHtml += makeSummaryItem('网站标题', 'GameHub');
        summaryHtml += makeSummaryItem('视觉风格', selectedStyleName);
        summaryHtml += makeSummaryItem('Hero区域', config.heroEnabled ? '开启' : '关闭');
        summaryHtml += makeSummaryItem('分类数量', config.categories.length + '个');
        summaryHtml += makeSummaryItem('操作按钮', config.actionButtonEnabled ? config.actionButtonText : '关闭');
        summaryHtml += makeSummaryItem('相关推荐', config.relatedCount + '条');
        summaryHtml += '</div>';

        document.getElementById('export-summary').innerHTML = summaryHtml;
        document.getElementById('btn-export').disabled = false;
    }

    function makeSummaryItem(label, value) {
        return '<div class="summary-item"><span class="label">' + label + '</span><span class="value">' + value + '</span></div>';
    }

    // 导出按钮
    document.getElementById('btn-export').addEventListener('click', function() {
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

    // ========== 一键随机组装 ==========
    function randomPick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function generateRandomConfig() {
        var c = appState.config;

        // 高影响项
        var styleIds = STYLE_PRESETS.map(function(s) { return s.id; });
        c.selectedStyle = randomPick(styleIds);

        var fontOptions = ['sans-serif', 'serif', 'monospace', 'cursive', 'condensed',
            'rounded', 'elegant', 'modern', 'tech', 'handwrite', 'retro', 'clean', 'display', 'literary'];
        c.fontStyle = randomPick(fontOptions);

        c.categoryTitleStyle = randomPick(['single', 'none', 'double', 'dotted', 'gradient', 'left-accent']);
        c.categoryTitleAlign = randomPick(['left', 'center']);
        c.cardViewMode = randomPick(['card', 'list']);
        c.navbarStyle = randomPick(['glass-sticky', 'normal', 'transparent', 'dark-fixed', 'side-drawer', 'bottom-fixed']);
        c.cardBorder = randomPick(['rounded', 'shadow', 'thin', 'double', 'dashed', 'thick', 'none']);
        c.detailLayout = randomPick(['single', 'sidebar']);
        c.heroStyle = randomPick(['gradient', 'solid', 'minimal', 'pattern']);

        // 中影响项
        c.cardHover = randomPick(['float', 'scale', 'flip', 'glow', 'bounce', 'tilt', 'border-glow', 'slide-up', 'none']);
        c.cardRadius = randomPick(['0', '2px', '4px', '8px', '12px', '16px', '24px']);
        c.btnStyle = randomPick(['gradient', 'solid', 'rounded', 'square', '3d', 'outline', 'pill', 'ghost']);
        c.detailImgStyle = randomPick(['fullwidth', 'centered', 'float-left', 'float-right', 'banner']);
        c.logoStyle = randomPick(['text', 'text-icon', 'icon', 'gradient-text', 'boxed']);
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
        c.cardColumns = randomPick(['auto', '2', '3', '4']);
        c.cardDescLines = randomPick(['1', '2', '3', '4', '0']);
    }

    function applyConfigToUI() {
        var c = appState.config;

        var selectIds = [
            'navbar-layout', 'footer-style', 'back-link-style', 'card-columns',
            'meta-layout', 'content-render', 'navbar-style', 'navbar-height',
            'logo-style', 'card-hover', 'card-border', 'card-radius', 'card-spacing',
            'btn-style', 'btn-size', 'grid-gap', 'font-style', 'animation-enter',
            'transition-speed', 'meta-bg', 'detail-img-style', 'privacy-length',
            'terms-length', 'category-title-style', 'category-title-align',
            'card-image-height', 'content-max-width', 'hero-style', 'detail-layout',
            'card-view-mode', 'card-desc-lines'
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
            'font-style': 'fontStyle', 'animation-enter': 'animationEnter',
            'transition-speed': 'transitionSpeed', 'meta-bg': 'metaBg',
            'detail-img-style': 'detailImgStyle', 'privacy-length': 'privacyLength',
            'terms-length': 'termsLength', 'category-title-style': 'categoryTitleStyle',
            'category-title-align': 'categoryTitleAlign', 'card-image-height': 'cardImageHeight',
            'content-max-width': 'contentMaxWidth', 'hero-style': 'heroStyle',
            'detail-layout': 'detailLayout', 'card-view-mode': 'cardViewMode',
            'card-desc-lines': 'cardDescLines'
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
    }

    document.getElementById('random-assemble-btn').addEventListener('click', function() {
        generateRandomConfig();
        applyConfigToUI();
        updatePreview();

        var btn = this;
        btn.style.background = '#ff9800';
        btn.style.color = '#fff';
        setTimeout(function() {
            btn.style.background = 'transparent';
            btn.style.color = '#ff9800';
        }, 400);
    });

    // ========== 初始化 ==========
    goToStep(1);
    loadGameData();

})();
