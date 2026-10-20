/**
 * 主应用逻辑
 * 管理步骤导航、状态、UI交互、实时预览
 */

(function() {
    'use strict';

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
        adPlacementMode: null,  // null or 'adv1'|'adv2'|'adv3'
        _previewBlobUrls: []    // 预览中本地图片的blob URL，用于清理
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
        });

        // 更新按钮
        btnPrev.style.display = step > 1 ? 'inline-block' : 'none';
        btnNext.textContent = step === 5 ? '完成' : '下一步 →';
        btnNext.style.display = step === 5 ? 'none' : 'inline-block';

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
                if (!appState.selectedTheme) {
                    alert('请先选择一个主题');
                    return false;
                }
                return true;
            case 2:
                if (!appState.data || appState.data.length === 0) {
                    alert('请先上传数据文件');
                    return false;
                }
                return true;
            case 3:
                var theme = THEMES[appState.selectedTheme];
                var requiredFields = theme.fields.filter(function(f) { return f.required; });
                for (var i = 0; i < requiredFields.length; i++) {
                    if (!appState.fieldMapping[requiredFields[i].id]) {
                        alert('请匹配所有必填字段：' + requiredFields[i].labelZh);
                        return false;
                    }
                }
                return true;
            case 4:
                return true;
            default:
                return true;
        }
    }

    btnPrev.addEventListener('click', function() {
        goToStep(appState.currentStep - 1);
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

    // ========== Step 1: 主题选择 ==========
    var themeCards = document.querySelectorAll('.theme-card');
    themeCards.forEach(function(card) {
        card.addEventListener('click', function() {
            themeCards.forEach(function(c) { c.classList.remove('selected'); });
            this.classList.add('selected');
            appState.selectedTheme = this.dataset.theme;

            // 初始化配置
            var theme = THEMES[appState.selectedTheme];
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
                adPlacements: {}  // { adv1: { position: 'after-hero', page: 'home' }, adv2: ... }
            };
        });
    });

    // ========== Step 2: 数据上传 ==========
    var uploadArea = document.getElementById('upload-area');
    var fileInput = document.getElementById('file-input');
    var dataOverview = document.getElementById('data-overview');

    uploadArea.addEventListener('click', function() {
        fileInput.click();
    });

    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', function() {
        this.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            handleFile(this.files[0]);
        }
    });

    function handleFile(file) {
        var ext = file.name.split('.').pop().toLowerCase();

        if (ext === 'json') {
            var reader = new FileReader();
            reader.onload = function(e) {
                try {
                    var data = JSON.parse(e.target.result);
                    processData(data, false, {});
                } catch (err) {
                    alert('JSON文件解析失败: ' + err.message);
                }
            };
            reader.readAsText(file);
        } else if (ext === 'zip' || ext === 'rar' || ext === '7z') {
            handleZipFile(file);
        } else {
            alert('请上传 .json 文件或压缩包（.zip/.rar/.7z）');
        }
    }

    function handleZipFile(file) {
        var reader = new FileReader();
        reader.onload = function(e) {
            JSZip.loadAsync(e.target.result).then(function(zip) {
                var jsonFile = null;
                var images = {};

                // 查找JSON文件和图片文件
                zip.forEach(function(relativePath, zipEntry) {
                    if (!zipEntry.dir) {
                        var entryExt = relativePath.split('.').pop().toLowerCase();
                        if (entryExt === 'json' && !jsonFile) {
                            jsonFile = zipEntry;
                        } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].indexOf(entryExt) !== -1) {
                            images[relativePath] = zipEntry;
                        }
                    }
                });

                if (!jsonFile) {
                    alert('ZIP文件中未找到JSON文件');
                    return;
                }

                // 读取JSON
                jsonFile.async('string').then(function(jsonStr) {
                    try {
                        var data = JSON.parse(jsonStr);
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
                                processData(data, true, imageMap);
                            });
                        } else {
                            processData(data, false, {});
                        }
                    } catch (err) {
                        alert('JSON解析失败: ' + err.message);
                    }
                });
            }).catch(function(err) {
                var ext = file.name.split('.').pop().toLowerCase();
                if (ext === 'rar' || ext === '7z') {
                    alert('暂不支持 .' + ext + ' 格式的直接解析。请将压缩包解压后重新打包为 .zip 格式再上传。');
                } else {
                    alert('压缩包读取失败: ' + err.message);
                }
            });
        };
        reader.readAsArrayBuffer(file);
    }

    function processData(data, isLocalImages, localImages) {
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
            alert('JSON数据格式不正确或为空');
            return;
        }

        appState.data = data;
        appState.isLocalImages = isLocalImages;
        appState.localImages = localImages;

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

        // 检测图片类型
        var imageField = null;
        var theme = THEMES[appState.selectedTheme];
        if (theme) {
            imageField = theme.fields.find(function(f) { return f.id === 'image'; });
        }
        var hasOnlineImages = false;
        var hasLocalImgs = false;
        if (imageField) {
            data.forEach(function(item) {
                var imgKeys = Object.keys(item);
                imgKeys.forEach(function(k) {
                    var val = item[k];
                    if (typeof val === 'string') {
                        if (val.match(/^https?:\/\//)) hasOnlineImages = true;
                        else if (val.match(/\.(jpg|jpeg|png|gif|webp|svg)/i)) hasLocalImgs = true;
                    }
                });
            });
        }

        // 如果是本地图片且没有上传ZIP中的图片，提示
        if (hasLocalImgs && !hasOnlineImages && !isLocalImages) {
            if (!confirm('检测到图片可能为本地路径。如需包含本地图片，请将JSON和图片打包成ZIP重新上传。\n\n是否继续使用在线图片模式？')) {
                return;
            }
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
            fieldListHtml += '<span class="field-tag">' + f.name +
                '<span class="field-type">(' + f.type + ')</span></span>';
        });
        document.getElementById('field-list').innerHTML = fieldListHtml;

        // 数据预览表
        var previewData = data.slice(0, 3);
        var tableHtml = '<thead><tr><th>#</th>';
        fields.forEach(function(f) { tableHtml += '<th>' + f.name + '</th>'; });
        tableHtml += '</tr></thead><tbody>';
        previewData.forEach(function(item, idx) {
            tableHtml += '<tr><td>' + (idx + 1) + '</td>';
            fields.forEach(function(f) {
                var val = item[f.name];
                if (val === undefined || val === null) val = '-';
                var str = String(val);
                if (str.length > 50) str = str.substring(0, 50) + '...';
                tableHtml += '<td>' + str + '</td>';
            });
            tableHtml += '</tr>';
        });
        tableHtml += '</tbody>';
        document.getElementById('preview-table').innerHTML = tableHtml;

        dataOverview.style.display = 'block';
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
        bindConfigEvents();
        initStyleGrid();
        initConfigTabs();
        initPreviewControls();
        initAdConfig();
    }

    function updateCategoryConfig(count) {
        var theme = THEMES[appState.selectedTheme];
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
        // 通用配置项绑定
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
        var theme = THEMES[appState.selectedTheme];
        var container = document.getElementById('card-fields-config');
        var html = '';
        theme.fields.forEach(function(f) {
            if (f.id === 'id') return;
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
        var theme = THEMES[appState.selectedTheme];
        var container = document.getElementById('related-card-fields-config');
        var html = '';
        theme.fields.forEach(function(f) {
            if (f.id === 'id' || f.id === 'content') return;
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
        var theme = THEMES[appState.selectedTheme];

        // 设置select的初始值
        if (c.navbarLayout) document.getElementById('navbar-layout').value = c.navbarLayout;
        if (c.footerStyle) document.getElementById('footer-style').value = c.footerStyle;
        if (c.backLinkStyle) document.getElementById('back-link-style').value = c.backLinkStyle;
        if (c.cardColumns) document.getElementById('card-columns').value = c.cardColumns;
        if (c.metaLayout) document.getElementById('meta-layout').value = c.metaLayout;
        if (c.contentRender) document.getElementById('content-render').value = c.contentRender;
        if (c.selectedStyle) document.getElementById('navbar-style').value = c.navbarStyle;
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

        // 提取 defineSlot 路径
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

        // bannerPath4 = bannerPath3
        paths.bannerPath4 = paths.bannerPath3;

        // 提取 GA ID
        var gaMatch = text.match(/gtag\(\s*'config'\s*,\s*'([^']+)'\s*\)/);
        if (gaMatch) paths.analyticsID = gaMatch[1];

        // 检查是否至少提取到一项
        var hasAny = paths.bannerPath1 || paths.bannerPath2 || paths.bannerPath3 ||
                     paths.interstitialPath || paths.anchorPath || paths.analyticsID;
        return hasAny ? paths : null;
    }

    // ========== 广告放置模式 ==========
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
    }

    function enterAdPlacementMode(adId) {
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
            btn.style.background = 'transparent';
            btn.style.color = 'var(--color-primary,#4a9eff)';
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
                var html = Generator.generatePreviewHtml(appState, pageType);
                var blob = new Blob([html], { type: 'text/html' });
                var url = URL.createObjectURL(blob);
                previewFrame.src = url;
                // 清理旧的blob URL
                previewFrame.onload = function() {
                    URL.revokeObjectURL(url);
                };
            } catch(e) {
                console.error('Preview error:', e);
            }
        }, 300);
    }

    // ========== Step 5: 导出 ==========
    function generateExportSummary() {
        var theme = THEMES[appState.selectedTheme];
        var config = appState.config;
        var mapping = appState.fieldMapping;
        var mappedCount = Object.keys(mapping).length;
        var unmappedCount = theme.fields.length - mappedCount;

        var selectedStyleName = '';
        STYLE_PRESETS.forEach(function(s) {
            if (s.id === config.selectedStyle) selectedStyleName = s.name;
        });

        var summaryHtml = '<h4>配置摘要</h4><div class="summary-grid">';
        summaryHtml += makeSummaryItem('主题', theme.name);
        summaryHtml += makeSummaryItem('数据条数', appState.data.length + '条');
        summaryHtml += makeSummaryItem('已匹配字段', mappedCount + '个');
        summaryHtml += makeSummaryItem('未匹配字段', unmappedCount + '个（不展示）');
        summaryHtml += makeSummaryItem('网站标题', theme.siteTitle);
        summaryHtml += makeSummaryItem('视觉风格', selectedStyleName);
        summaryHtml += makeSummaryItem('Hero区域', config.heroEnabled ? '开启' : '关闭');
        summaryHtml += makeSummaryItem('分类数量', config.categories.length + '个');
        summaryHtml += makeSummaryItem('内容渲染', config.contentRender === 'markdown' ? 'Markdown转HTML' : '纯文本');
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
            var theme = THEMES[appState.selectedTheme];
            saveAs(blob, theme.siteTitle.replace(/\s+/g, '-').toLowerCase() + '-website.zip');
            progressText.textContent = '✅ 导出成功！文件已开始下载';
            btn.disabled = false;
        }).catch(function(err) {
            progressText.textContent = '❌ 导出失败: ' + err.message;
            btn.disabled = false;
            console.error('Export error:', err);
        });
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

    function generateRandomConfig() {
        var c = appState.config;

        // ===== 高影响项（必须随机，决定整体视觉差异） =====

        // 颜色主题 — 24个预设随机选
        var styleIds = STYLE_PRESETS.map(function(s) { return s.id; });
        c.selectedStyle = randomPick(styleIds);

        // 字体风格 — 14种字体
        var fontOptions = ['sans-serif', 'serif', 'monospace', 'cursive', 'condensed',
            'rounded', 'elegant', 'modern', 'tech', 'handwrite', 'retro', 'clean', 'display', 'literary'];
        c.fontStyle = randomPick(fontOptions);

        // 分类标题样式
        var catTitleStyles = ['single', 'none', 'double', 'dotted', 'gradient', 'left-accent'];
        c.categoryTitleStyle = randomPick(catTitleStyles);

        // 分类标题对齐
        c.categoryTitleAlign = randomPick(['left', 'center']);

        // 卡片视图模式
        c.cardViewMode = randomPick(['card', 'list']);

        // 导航栏样式
        c.navbarStyle = randomPick(['glass-sticky', 'normal', 'transparent', 'dark-fixed', 'side-drawer', 'bottom-fixed']);

        // 卡片边框样式
        c.cardBorder = randomPick(['rounded', 'shadow', 'thin', 'double', 'dashed', 'thick', 'none']);

        // 详情页布局
        c.detailLayout = randomPick(['single', 'sidebar']);

        // Hero区域样式
        c.heroStyle = randomPick(['gradient', 'solid', 'minimal', 'pattern']);

        // ===== 中影响项 =====

        // 卡片hover效果
        c.cardHover = randomPick(['float', 'scale', 'flip', 'glow', 'bounce', 'tilt', 'border-glow', 'slide-up', 'none']);

        // 卡片圆角
        c.cardRadius = randomPick(['0', '2px', '4px', '8px', '12px', '16px', '24px']);

        // 按钮样式
        c.btnStyle = randomPick(['gradient', 'solid', 'rounded', 'square', '3d', 'outline', 'pill', 'ghost']);

        // 详情页图片展示
        c.detailImgStyle = randomPick(['fullwidth', 'centered', 'float-left', 'float-right', 'banner']);

        // Logo样式
        c.logoStyle = randomPick(['text', 'text-icon', 'icon', 'gradient-text', 'boxed']);

        // 入场动画
        c.animationEnter = randomPick(['fadeIn', 'slideUp', 'zoomIn', 'slideLeft', 'slideRight', 'rotateIn', 'flipIn', 'none']);

        // ===== 低影响项（细节微调） =====

        c.navbarHeight = randomPick(['40px', '50px', '60px', '70px', '80px']);
        c.cardImageHeight = randomPick(['120px', '150px', '180px', '220px', '260px']);
        c.cardSpacing = randomPick(['8px', '12px', '20px', '30px', '40px']);
        c.gridGap = randomPick(['5px', '10px', '20px', '30px', '40px']);
        c.btnSize = randomPick(['xsmall', 'small', 'medium', 'large', 'xlarge']);
        c.contentMaxWidth = randomPick(['900px', '1000px', '1100px', '1200px', '1400px', 'full']);
        c.transitionSpeed = randomPick(['0.1s', '0.2s', '0.3s', '0.5s', '0.8s']);
        c.metaBg = randomPick(['dark', 'light', 'transparent', 'primary', 'bordered']);
        c.cardColumns = randomPick(['auto', '2', '3', '4']);
    }

    function applyConfigToUI() {
        var c = appState.config;

        // 通用select绑定
        var selectIds = [
            'navbar-layout', 'footer-style', 'back-link-style', 'card-columns',
            'meta-layout', 'content-render', 'navbar-style', 'navbar-height',
            'logo-style', 'card-hover', 'card-border', 'card-radius', 'card-spacing',
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
            'card-spacing': 'cardSpacing', 'btn-style': 'btnStyle',
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
