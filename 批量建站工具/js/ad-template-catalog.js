(function (window, document) {
    'use strict';

    // Loaded before both classic generators; its manifest is the shared source
    // of version cards, the local default, and custom ad.js rendering.
    var API_URL = '/__sitefoundry/ad-templates';
    var BUILT_IN_VERSIONS = ['initial', 'v1.0.0', 'v1.0.1', 'v1.0.2', 'v1.0.2.1'];
    var FIELD_NAMES = ['bannerPath1', 'bannerPath2', 'bannerPath3', 'bannerPath4', 'interstitialPath', 'anchorPath', 'analyticsID'];
    var REQUIRED_FIELDS = ['bannerPath1', 'bannerPath2', 'bannerPath3'];
    var currentScript = document.currentScript;
    var assetRoot = currentScript && currentScript.src
        ? new URL('../', currentScript.src).href
        : new URL('./', window.location.href).href;
    var snapshot = { manifest: { defaultVersion: 'v1.0.2.1', templates: [] }, templates: [], uploadAvailable: false };
    var isSettingDefault = false;

    function isBuiltIn(version) {
        return BUILT_IN_VERSIONS.indexOf(String(version || '')) !== -1;
    }

    function validSnapshot(value) {
        if (!value || !value.manifest || !Array.isArray(value.manifest.templates) || !Array.isArray(value.templates)) return null;
        var templates = value.templates.filter(function (item) {
            return item && typeof item.version === 'string' && typeof item.source === 'string' && item.fields;
        });
        var customVersions = templates.map(function (item) { return item.version; });
        var defaultVersion = value.manifest.defaultVersion;
        if (!isBuiltIn(defaultVersion) && customVersions.indexOf(defaultVersion) === -1) defaultVersion = 'v1.0.2.1';
        return {
            manifest: { defaultVersion: defaultVersion, templates: value.manifest.templates },
            templates: templates,
            uploadAvailable: !!value.uploadAvailable
        };
    }

    function requestJson(url, options) {
        if (window.SiteFoundryPlatform && window.SiteFoundryPlatform.kind === 'android'
            && new URL(url, window.location.href).pathname.indexOf(API_URL) === 0) {
            return window.SiteFoundryPlatform.requestTemplate(url, options);
        }
        return window.fetch(url, options).then(function (response) {
            return response.json().catch(function () { return {}; }).then(function (body) {
                if (!response.ok) throw new Error(body.error || '模板请求失败（HTTP ' + response.status + '）。');
                return body;
            });
        });
    }

    function loadStaticCatalog() {
        return requestJson(new URL('ad-templates/manifest.json', assetRoot).href, { cache: 'no-store' }).then(function (manifest) {
            var items = Array.isArray(manifest.templates) ? manifest.templates : [];
            return Promise.all(items.map(function (entry) {
                if (!entry || typeof entry.file !== 'string' || !/^custom\/[\w.-]+\.json$/.test(entry.file)) return null;
                return requestJson(new URL('ad-templates/' + entry.file, assetRoot).href, { cache: 'no-store' }).catch(function () { return null; });
            })).then(function (templates) {
                return validSnapshot({ manifest: manifest, templates: templates.filter(Boolean), uploadAvailable: false })
                    || { manifest: { defaultVersion: 'v1.0.2.1', templates: [] }, templates: [], uploadAvailable: false };
            });
        }).catch(function () {
            return { manifest: { defaultVersion: 'v1.0.2.1', templates: [] }, templates: [], uploadAvailable: false };
        });
    }

    function loadCatalog() {
        return requestJson(API_URL, { cache: 'no-store' }).then(function (value) {
            return validSnapshot({ manifest: value.manifest, templates: value.templates, uploadAvailable: true })
                || loadStaticCatalog();
        }).catch(loadStaticCatalog);
    }

    function getTemplate(version) {
        return snapshot.templates.find(function (template) { return template.version === version; }) || null;
    }

    function isKnownVersion(version) {
        return isBuiltIn(version) || !!getTemplate(version);
    }

    function render(version, paths) {
        var template = getTemplate(version);
        if (!template) throw new Error('找不到 ad.js 模板 ' + version + '，请重新加载工具后再导出。');
        var source = template.source;
        var values = paths || {};
        var replacements = [];
        FIELD_NAMES.forEach(function (field) {
            var name = String(template.fields[field] || '');
            if (!name) return;
            if (!/^[A-Za-z_$][\w$]*$/.test(name)) throw new Error('模板字段 ' + field + ' 的变量名无效。');
            var range = template.ranges && template.ranges[field];
            if (!range || !Number.isInteger(range.start) || !Number.isInteger(range.end)
                || range.start < 0 || range.end <= range.start || range.end > source.length) {
                throw new Error('模板变量 ' + name + '（' + field + '）缺少有效的替换位置，请重新上传模板。');
            }
            replacements.push({ start: range.start, end: range.end, value: JSON.stringify(String(values[field] || ''))
                .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029') });
        });
        replacements.sort(function (left, right) { return right.start - left.start; });
        // Apply AST source ranges from right to left so earlier offsets remain valid.
        replacements.forEach(function (replacement) {
            source = source.slice(0, replacement.start) + replacement.value + source.slice(replacement.end);
        });
        return '/** ad.js ' + template.version + ' · 自定义模板 */\n' + source;
    }

    function setStatus(node, message, kind) {
        if (!node) return;
        node.textContent = message;
        node.classList.toggle('is-error', kind === 'error');
        node.classList.toggle('is-success', kind === 'success');
    }

    function updateDefaultLabel(input) {
        var strong = input.closest('label') && input.closest('label').querySelector('strong');
        if (!strong) return;
        if (input.value === 'v1.0.2.1') {
            strong.dataset.adTemplateBaseLabel = isBuiltIn(snapshot.manifest.defaultVersion)
                ? '最新版 v1.0.2.1'
                : '内置版本 v1.0.2.1';
        } else if (!strong.dataset.adTemplateBaseLabel) {
            strong.dataset.adTemplateBaseLabel = strong.textContent.replace(/\s*（默认）$/, '');
        }
        strong.textContent = strong.dataset.adTemplateBaseLabel;
    }

    // Keep the radio label and its independent action in one visual row without nesting controls in a label.
    function ensureVersionOption(card, version) {
        if (!card) return null;
        var option = card.parentElement && card.parentElement.classList.contains('ad-template-version-option')
            ? card.parentElement
            : null;
        if (!option) {
            option = document.createElement('div');
            option.className = 'ad-template-version-option';
            if (card.parentNode) card.parentNode.insertBefore(option, card);
            option.appendChild(card);
        }

        var button = option.querySelector('[data-ad-template-default-action]');
        if (!button) {
            button = document.createElement('button');
            button.type = 'button';
            button.className = 'ad-template-default-action';
            button.dataset.adTemplateDefaultAction = 'true';
            option.appendChild(button);
        }
        var isDefault = version === snapshot.manifest.defaultVersion;
        button.dataset.adTemplateVersion = version;
        button.textContent = isDefault ? '当前默认' : '设为默认';
        button.disabled = isDefault || !snapshot.uploadAvailable || isSettingDefault;
        button.title = !snapshot.uploadAvailable
            ? '请从本机启动工具后修改默认版本。'
            : isDefault ? '此版本已是默认版本。' : '设置后，重新打开工具仍会使用此版本。';
        button.setAttribute('aria-label', isDefault
            ? '当前默认模板版本 ' + version
            : '将 ' + version + ' 设为默认模板版本');
        button.classList.toggle('is-current-default', isDefault);
        return option;
    }

    function setAllManagerStatuses(message, kind) {
        document.querySelectorAll('.ad-template-manager').forEach(function (manager) {
            setStatus(manager.querySelector('[data-ad-template-status]'), message, kind);
        });
    }

    function syncDefaultVersionSelection(version) {
        document.querySelectorAll('input[name="ad-js-version"]').forEach(function (input) {
            input.checked = input.value === version;
        });
    }

    function setDefaultVersion(version) {
        if (isSettingDefault) return;
        if (!snapshot.uploadAvailable) {
            setAllManagerStatuses('默认版本只能在本机启动的工具中修改。', 'error');
            return;
        }
        if (!isKnownVersion(version)) {
            setAllManagerStatuses('找不到版本 ' + version + '，请重新加载工具后再试。', 'error');
            return;
        }

        isSettingDefault = true;
        renderVersionCards();
        setAllManagerStatuses('正在将 ' + version + ' 设为默认版本…', '');
        requestJson(API_URL + '/default', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ version: version })
        }).then(function (result) {
            var next = validSnapshot({
                manifest: result.manifest,
                templates: snapshot.templates,
                uploadAvailable: true
            });
            if (!next || next.manifest.defaultVersion !== version) {
                throw new Error('默认版本未能保存，请重新加载工具确认。');
            }
            snapshot = next;
            renderVersionCards();
            syncDefaultVersionSelection(version);
            setAllManagerStatuses('默认版本已设为 ' + version + '；之后上传新模板仍会自动设为默认。', 'success');
            window.dispatchEvent(new CustomEvent('sitefoundry-ad-template-default-changed', { detail: { version: version } }));
        }).catch(function (error) {
            setAllManagerStatuses(error.message, 'error');
        }).finally(function () {
            isSettingDefault = false;
            renderVersionCards();
        });
    }

    // One delegated handler survives card rerenders after uploads and default changes.
    function wireDefaultActions(radioGroup) {
        if (radioGroup.dataset.adTemplateDefaultActionsReady === 'true') return;
        radioGroup.dataset.adTemplateDefaultActionsReady = 'true';
        radioGroup.addEventListener('click', function (event) {
            var button = event.target.closest && event.target.closest('[data-ad-template-default-action]');
            if (!button || !radioGroup.contains(button)) return;
            event.preventDefault();
            setDefaultVersion(button.dataset.adTemplateVersion);
        });
    }

    function buildCustomCard(template, groupName, isDefault) {
        var label = document.createElement('label');
        label.className = 'normal-ad-mode-card ad-template-version-card';
        var input = document.createElement('input');
        input.type = 'radio';
        input.name = groupName;
        input.value = template.version;
        input.dataset.adTemplateCustomVersion = 'true';
        input.checked = isDefault;
        var content = document.createElement('span');
        var title = document.createElement('strong');
        title.dataset.adTemplateBaseLabel = '新增模板 ' + template.version;
        title.textContent = title.dataset.adTemplateBaseLabel;
        var detail = document.createElement('small');
        detail.textContent = '使用上传的完整 ad.js 模板，并自动填入当前广告 ID。';
        content.appendChild(title);
        content.appendChild(detail);
        label.appendChild(input);
        label.appendChild(content);
        return label;
    }

    function renderVersionCards() {
        document.querySelectorAll('.ad-template-manager').forEach(function (manager) {
            var configGroup = manager.parentElement;
            var radioGroup = configGroup && configGroup.querySelector('.ad-js-version-grid');
            if (!radioGroup) return;
            radioGroup.querySelectorAll('.ad-template-version-card').forEach(function (card) {
                var option = card.closest('.ad-template-version-option');
                if (option && option.parentElement === radioGroup) option.remove();
                else card.remove();
            });
            var defaultVersion = snapshot.manifest.defaultVersion;
            radioGroup.querySelectorAll('input[type="radio"]').forEach(function (input) {
                updateDefaultLabel(input);
                ensureVersionOption(input.closest('label'), input.value);
            });
            snapshot.templates.slice().reverse().forEach(function (template) {
                var card = buildCustomCard(template, radioGroup.querySelector('input[type="radio"]')?.name || 'ad-js-version', template.version === defaultVersion);
                var option = ensureVersionOption(card, template.version);
                radioGroup.insertBefore(option, radioGroup.firstChild);
            });
            wireDefaultActions(radioGroup);
        });
    }

    function fillMappingOptions(manager, analysis) {
        var variables = Array.isArray(analysis.variables) ? analysis.variables : [];
        manager.querySelectorAll('[data-ad-template-mapping]').forEach(function (select) {
            var field = select.dataset.adTemplateMapping;
            select.replaceChildren();
            var prompt = document.createElement('option');
            prompt.value = '';
            prompt.textContent = REQUIRED_FIELDS.indexOf(field) !== -1 ? '请选择变量' : '不使用此字段';
            select.appendChild(prompt);
            variables.forEach(function (name) {
                var option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                select.appendChild(option);
            });
            select.value = analysis.fields && analysis.fields[field] || '';
        });
    }

    function openMappingEditor(manager, file, source, analysis) {
        var editor = manager.querySelector('[data-ad-template-editor]');
        manager._adTemplateSource = source;
        manager._adTemplateFileName = file.name;
        manager.querySelector('[data-ad-template-version]').value = analysis.version || '';
        fillMappingOptions(manager, analysis);
        editor.hidden = false;
        setStatus(manager.querySelector('[data-ad-template-status]'), analysis.version
            ? '已识别版本 ' + analysis.version + '，请确认版本号和广告 ID 对应后保存。'
            : '未从注释中读取到版本号，请填写版本号后保存。', '');
    }

    function closeMappingEditor(manager) {
        var editor = manager.querySelector('[data-ad-template-editor]');
        var fileInput = manager.querySelector('[data-ad-template-file]');
        if (editor) editor.hidden = true;
        if (fileInput) fileInput.value = '';
        delete manager._adTemplateSource;
        delete manager._adTemplateFileName;
    }

    function wireManager(manager) {
        var uploadButton = manager.querySelector('[data-ad-template-upload]');
        var fileInput = manager.querySelector('[data-ad-template-file]');
        var status = manager.querySelector('[data-ad-template-status]');
        var saveButton = manager.querySelector('[data-ad-template-save]');
        var cancelButton = manager.querySelector('[data-ad-template-cancel]');
        if (!uploadButton || !fileInput || manager.dataset.adTemplateReady === 'true') return;
        manager.dataset.adTemplateReady = 'true';
        if (!snapshot.uploadAvailable) {
            uploadButton.disabled = true;
            setStatus(status, '上传模板或修改默认版本需要从本机启动此工具；静态发布副本只读。', '');
            return;
        }
        uploadButton.addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', function () {
            var file = fileInput.files && fileInput.files[0];
            if (!file) return;
            if (!/\.js$/i.test(file.name)) {
                setStatus(status, '请选择 .js 格式的完整 ad.js 模板。', 'error');
                fileInput.value = '';
                return;
            }
            if (file.size > 1024 * 1024) {
                setStatus(status, '模板不能超过 1 MB，请精简后重试。', 'error');
                fileInput.value = '';
                return;
            }
            setStatus(status, '正在检查 JavaScript 语法并识别广告 ID 变量…', '');
            file.text().then(function (source) {
                return requestJson(API_URL + '/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ source: source, fileName: file.name })
                }).then(function (analysis) {
                    openMappingEditor(manager, file, source, analysis);
                    var allRequiredFieldsRecognized = REQUIRED_FIELDS.every(function (field) {
                        return !!(analysis.fields && analysis.fields[field]);
                    });
                    if (analysis.version && allRequiredFieldsRecognized) {
                        manager.querySelector('[data-ad-template-editor]').hidden = true;
                        setStatus(status, '已识别版本和广告 ID，正在自动保存并设为默认…', '');
                        manager.querySelector('[data-ad-template-save]').click();
                    }
                });
            }).catch(function (error) {
                setStatus(status, error.message, 'error');
            });
        });
        if (cancelButton) cancelButton.addEventListener('click', function () { closeMappingEditor(manager); });
        if (saveButton) saveButton.addEventListener('click', function () {
            var version = manager.querySelector('[data-ad-template-version]').value.trim();
            var fields = {};
            manager.querySelectorAll('[data-ad-template-mapping]').forEach(function (select) {
                fields[select.dataset.adTemplateMapping] = select.value;
            });
            var missing = REQUIRED_FIELDS.filter(function (field) { return !fields[field]; });
            if (!version) {
                setStatus(status, '请填写模板版本号，例如 v1.0.3。', 'error');
                manager.querySelector('[data-ad-template-version]').focus();
                return;
            }
            if (missing.length) {
                setStatus(status, '请为 Banner 1–3、插屏 INT、锚点 ANC 和 GA ID 选择模板变量后再保存。', 'error');
                return;
            }
            saveButton.disabled = true;
            setStatus(status, '正在保存模板并设置为默认版本…', '');
            requestJson(API_URL + '/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ version: version, source: manager._adTemplateSource, fields: fields })
            }).then(function (result) {
                var next = validSnapshot({
                    manifest: result.manifest,
                    templates: snapshot.templates.concat(result.template || []),
                    uploadAvailable: true
                });
                if (!next) throw new Error('模板已保存，但返回的版本数据无效。请重新加载工具确认。');
                snapshot = next;
                renderVersionCards();
                document.querySelectorAll('.ad-template-manager').forEach(function (item) {
                    setStatus(item.querySelector('[data-ad-template-status]'), '已保存 ' + result.template.version + '，并设为所有支持流程的默认版本。', 'success');
                    closeMappingEditor(item);
                });
                window.dispatchEvent(new CustomEvent('sitefoundry-ad-template-default-changed', { detail: { version: result.template.version } }));
            }).catch(function (error) {
                manager.querySelector('[data-ad-template-editor]').hidden = false;
                setStatus(status, error.message, 'error');
            }).finally(function () {
                saveButton.disabled = false;
            });
        });
    }

    var ready = loadCatalog().then(function (loaded) {
        snapshot = loaded;
        renderVersionCards();
        document.querySelectorAll('.ad-template-manager').forEach(wireManager);
        window.dispatchEvent(new CustomEvent('sitefoundry-ad-template-catalog-ready', { detail: { version: snapshot.manifest.defaultVersion } }));
        return snapshot;
    });

    window.AdTemplateCatalog = {
        ready: ready,
        getDefaultVersion: function () { return snapshot.manifest.defaultVersion; },
        getTemplate: getTemplate,
        isKnownVersion: isKnownVersion,
        render: render
    };
})(window, document);
