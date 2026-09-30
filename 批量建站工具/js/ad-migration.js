/*
 * 旧站广告移植的本地检查器。
 * 只读取广告配置和页面中的广告容器标识；不会返回或保存旧站正文、图片、标题等内容。
 */
const AdMigration = (function() {
    'use strict';

    const CONFIG_KEYS = [
        'bannerPath1', 'bannerPath2', 'bannerPath3', 'bannerPath4',
        'interstitialPath', 'anchorPath', 'analyticsID'
    ];
    const CONFIG_ALIASES = {
        bannerPath1: 'adUnitBanner1', bannerPath2: 'adUnitBanner2', bannerPath3: 'adUnitBanner3',
        interstitialPath: 'adUnitInterstitial', anchorPath: 'adUnitAnchor', analyticsID: 'gaMeasurementId'
    };
    const REQUIRED_BANNER_KEYS = ['bannerPath1', 'bannerPath2', 'bannerPath3'];
    const CONTAINER_IDS = ['div-gpt-ad-banner1', 'div-gpt-ad-banner2', 'div-gpt-ad-banner3'];
    const HOST_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
    // Match full terminal suffixes so numbered aliases map intentionally without rewriting IDs.
    const AD_PATH_SLOT_SUFFIXES = [
        { field: 'bannerPath1', pattern: /(?:-|_|\/)banner\s*11$/i, label: 'Banner 1' },
        { field: 'bannerPath2', pattern: /(?:-|_|\/)banner\s*22$/i, label: 'Banner 2' },
        { field: 'bannerPath3', pattern: /(?:-|_|\/)banner\s*33$/i, label: 'Banner 3' },
        { field: 'bannerPath1', pattern: /(?:-|_|\/)banner\s*1$/i, label: 'Banner 1' },
        { field: 'bannerPath2', pattern: /(?:-|_|\/)banner\s*2$/i, label: 'Banner 2' },
        { field: 'bannerPath3', pattern: /(?:-|_|\/)banner\s*3$/i, label: 'Banner 3' },
        { field: 'bannerPath4', pattern: /(?:-|_|\/)banner\s*4$/i, label: 'Banner 4' },
        { field: 'interstitialPath', pattern: /(?:-|_|\/)(?:int1|int|interstitial)$/i, label: 'INT 插屏' },
        { field: 'anchorPath', pattern: /(?:-|_|\/)(?:anc1|anc|anchor)$/i, label: 'ANC 锚点' }
    ];

    function makeIssue(message, code) {
        return { code: code || 'MIGRATION_INVALID', message: message };
    }

    function normalizePath(path) {
        return String(path || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
    }

    function matchAdPathSlot(path) {
        const value = String(path || '');
        for (let index = 0; index < AD_PATH_SLOT_SUFFIXES.length; index++) {
            const definition = AD_PATH_SLOT_SUFFIXES[index];
            const match = value.match(definition.pattern);
            if (match) return { field: definition.field, suffix: match[0], label: definition.label };
        }
        return null;
    }

    function adUnitBaseFromPath(path) {
        const value = String(path || '');
        const slot = matchAdPathSlot(value);
        return slot ? value.slice(0, -slot.suffix.length) : value;
    }

    function assignAdPaths(paths, config, errors) {
        const candidatesByField = {};
        Array.from(new Set(paths)).forEach(function(path) {
            if (!/^\/[A-Za-z0-9_./-]+$/.test(path)) return;
            const slot = matchAdPathSlot(path);
            if (!slot) return;
            if (!candidatesByField[slot.field]) candidatesByField[slot.field] = [];
            candidatesByField[slot.field].push({ path: path, label: slot.label });
        });

        Object.keys(candidatesByField).forEach(function(field) {
            const candidates = candidatesByField[field];
            if (candidates.length > 1) {
                config[field] = '';
                errors.push(makeIssue('广告代码中 ' + candidates[0].label + ' 识别到多个不同路径，请确认后重新上传。', 'AD_CODE_SLOT_CONFLICT'));
                return;
            }
            // Keep the complete source path, including aliases such as banner11.
            config[field] = candidates[0].path;
        });
    }

    function detectedHostFromAdPath(path) {
        // Remove the recognized suffix before extracting the hostname segment.
        const unit = adUnitBaseFromPath(String(path || '').trim());
        const candidate = unit.split('/').filter(Boolean).pop() || '';
        return HOST_PATTERN.test(candidate) ? candidate.toLowerCase() : '';
    }

    function decodeJavaScriptString(value) {
        return String(value || '')
            .replace(/\\([\\'"`])/g, '$1')
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t');
    }

    function extractAssignment(source, key) {
        const names = [key, CONFIG_ALIASES[key]].filter(Boolean);
        const text = String(source || '');
        const active = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        let found = false;
        for (const candidate of [active, text]) {
            for (const name of names) {
                const escapedKey = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pattern = new RegExp('(?:\\b(?:const|let|var)\\s+)?\\b' + escapedKey + "\\s*=\\s*(['\\\"])((?:\\\\.|(?!\\1)[\\s\\S])*)\\1", 'm');
                const match = pattern.exec(candidate);
                if (!match) continue;
                found = true;
                const value = decodeJavaScriptString(match[2]);
                if (value) return { found: true, value: value };
            }
        }
        return { found: found, value: '' };
    }

    function countContainer(html, id) {
        const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const matches = String(html || '').match(new RegExp('\\bid\\s*=\\s*["\\\']' + escapedId + '["\\\']', 'gi'));
        return matches ? matches.length : 0;
    }

    function findPageWithContainers(entries, predicate) {
        return entries.filter(function(entry) { return predicate(entry.path); }).find(function(entry) {
            return CONTAINER_IDS.every(function(id) { return countContainer(entry.text, id) >= 1; });
        }) || null;
    }

    function missingContainers(entry) {
        if (!entry) return CONTAINER_IDS.slice();
        return CONTAINER_IDS.filter(function(id) { return countContainer(entry.text, id) < 1; });
    }

    function isDetailPath(path) {
        return /(?:^|\/)(?:details?|articles?)(?:\/|$)/i.test(path) || /(?:^|\/)(?:detail|article)[^/]*\.html?$/i.test(path);
    }

    function inspectEntries(rawEntries) {
        const entries = (rawEntries || []).map(function(entry) {
            return { path: normalizePath(entry.path || entry.name), text: String(entry.text || entry.content || '') };
        }).filter(function(entry) { return entry.path && !/\/$/.test(entry.path); });
        const errors = [];
        const warnings = [];
        const adFile = entries.find(function(entry) { return /(?:^|\/)js\/ad\.js$/i.test(entry.path); });
        const config = {};

        if (!adFile) {
            errors.push(makeIssue('旧网站源码中未找到 js/ad.js。请上传包含完整站点源码的压缩包。', 'AD_JS_NOT_FOUND'));
        } else {
            CONFIG_KEYS.forEach(function(key) {
                const assignment = extractAssignment(adFile.text, key);
                config[key] = assignment.value;
                if (!assignment.found) warnings.push(makeIssue('旧站 js/ad.js 未声明 ' + key + '，将以空值写入新站配置。', 'OPTIONAL_CONFIG_MISSING'));
            });
            REQUIRED_BANNER_KEYS.forEach(function(key) {
                if (!config[key]) errors.push(makeIssue('旧站 js/ad.js 中未识别到有效的 ' + key + '。', 'BANNER_PATH_MISSING'));
            });
        }

        const homeCandidates = entries.filter(function(entry) { return /(?:^|\/)index\.html?$/i.test(entry.path); });
        const homePage = findPageWithContainers(entries, function(path) { return /(?:^|\/)index\.html?$/i.test(path); });
        if (!homePage) {
            const missing = missingContainers(homeCandidates[0]);
            errors.push(makeIssue(
                homeCandidates.length
                    ? '旧站首页未识别到完整广告容器：' + missing.join('、') + '。'
                    : '旧站首页 index.html 无法识别。',
                'HOME_STRUCTURE_INVALID'
            ));
        }

        const detailCandidates = entries.filter(function(entry) { return /\.html?$/i.test(entry.path) && isDetailPath(entry.path); });
        const detailPage = findPageWithContainers(entries, isDetailPath);
        if (!detailPage) {
            const missing = missingContainers(detailCandidates[0]);
            errors.push(makeIssue(
                detailCandidates.length
                    ? '旧站详情页未识别到完整广告容器：' + missing.join('、') + '。'
                    : '旧站详情页结构无法识别（需要 details/、articles/ 或 article/detail HTML）。',
                'DETAIL_STRUCTURE_INVALID'
            ));
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            config: CONFIG_KEYS.reduce(function(result, key) { result[key] = config[key] || ''; return result; }, {}),
            detectedHost: detectedHostFromAdPath(config.bannerPath1),
            detectedFiles: {
                adJs: adFile ? adFile.path : '',
                home: homePage ? homePage.path : '',
                detail: detailPage ? detailPage.path : ''
            }
        };
    }

    function archiveFailure(message, code) {
        return { valid: false, errors: [makeIssue(message, code)], warnings: [], config: {}, detectedFiles: {} };
    }

    // 广告平台导出的 TXT 只解析经验证的广告位路径和 GA 衡量 ID；绝不执行或原样复制上传文本中的脚本。
    function inspectAdCodeText(text, fileName) {
        const source = String(text || '');
        const config = CONFIG_KEYS.reduce(function(result, key) { result[key] = ''; return result; }, {});
        const errors = [];
        const warnings = [];
        const units = {};
        // GAM 导出的代码在 defineSlot、defineOutOfPageSlot、注释和展示片段中
        // 都可能出现广告单元。先收集所有合法路径，再按单元名称分类，绝不依赖出现顺序。
        const slotRegex = /googletag\.(?:defineSlot|defineOutOfPageSlot)\s*\(\s*['"]\s*(\/[^'"\s]+)\s*['"]/gi;
        const pathRegex = /(?:^|[^A-Za-z0-9_./-])(\/\d{4,}(?:\/[A-Za-z0-9_.-]+)+)(?=$|[^A-Za-z0-9_./-])/g;
        const paths = [];
        let match;

        while ((match = slotRegex.exec(source)) !== null) {
            paths.push(match[1].trim());
        }
        while ((match = pathRegex.exec(source)) !== null) paths.push(match[1].trim());

        assignAdPaths(paths, config, errors);

        const gaMatch = source.match(/(?:gtag\(\s*['"]config['"]\s*,\s*['"]|[?&]id=|\b(?:gaMeasurementId|analyticsID)\s*=\s*['"])(G-[A-Z0-9]+)(?:['"]\s*\)|\b)/i);
        if (gaMatch) config.analyticsID = gaMatch[1].toUpperCase();

        ['bannerPath1', 'bannerPath2', 'bannerPath3'].forEach(function(key) {
            if (!config[key]) errors.push(makeIssue('广告代码中未识别到 ' + key + '。', 'AD_CODE_SLOT_MISSING'));
        });
        if (!config.interstitialPath) warnings.push(makeIssue('未识别到 INT 插屏广告位，将不生成插屏广告。', 'OPTIONAL_INT_MISSING'));
        if (!config.anchorPath) warnings.push(makeIssue('未识别到 ANC 锚定广告位，将不生成底部锚定广告。', 'OPTIONAL_ANC_MISSING'));
        if (!config.analyticsID) warnings.push(makeIssue('未识别到 Google Analytics 衡量 ID，将不生成 GA 脚本。', 'OPTIONAL_GA_MISSING'));

        [config.bannerPath1, config.bannerPath2, config.bannerPath3].filter(Boolean).forEach(function(path) {
            const unit = adUnitBaseFromPath(path);
            units[unit] = true;
        });
        if (Object.keys(units).length > 1) {
            errors.push(makeIssue('banner1、banner2、banner3 必须属于同一个子域名广告单元。', 'AD_CODE_DOMAIN_MISMATCH'));
        }

        const expectedHost = String(fileName || '').replace(/\.txt$/i, '').toLowerCase();
        const unit = Object.keys(units)[0] || '';
        const detectedHost = unit ? unit.split('/').pop().toLowerCase() : '';
        if (expectedHost && detectedHost && expectedHost !== detectedHost) {
            warnings.push(makeIssue('文件名中的子域名与广告单元不同；将以广告单元 ' + detectedHost + ' 为准。', 'AD_CODE_FILENAME_MISMATCH'));
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            config: config,
            detectedFiles: { code: fileName || '' },
            detectedHost: detectedHost
        };
    }

    function archiveType(fileName) {
        const name = String(fileName || '').toLowerCase();
        if (/\.zip$/.test(name)) return 'zip';
        if (/\.(?:tar\.gz|tgz)$/.test(name)) return 'tar-gz';
        return '';
    }

    function tarText(bytes) {
        return new TextDecoder('utf-8').decode(bytes).replace(/\0.*$/, '');
    }

    function tarOctal(bytes) {
        const value = tarText(bytes).trim();
        if (!value) return 0;
        if (!/^[0-7]+$/.test(value)) throw new Error('TAR 文件大小字段无效');
        return parseInt(value, 8);
    }

    function paxPath(bytes) {
        const text = tarText(bytes);
        const match = text.match(/(?:^|\n)\d+ path=([^\n]+)/);
        return match ? match[1] : '';
    }

    function inspectTarBytes(buffer) {
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        const entries = [];
        let offset = 0;
        let pendingPath = '';
        while (offset + 512 <= bytes.length) {
            const header = bytes.subarray(offset, offset + 512);
            if (header.every(function(value) { return value === 0; })) break;
            const size = tarOctal(header.subarray(124, 136));
            const type = String.fromCharCode(header[156] || 0);
            const name = tarText(header.subarray(0, 100));
            const prefix = tarText(header.subarray(345, 500));
            const bodyStart = offset + 512;
            const bodyEnd = bodyStart + size;
            if (bodyEnd > bytes.length) throw new Error('TAR 文件内容不完整');
            const body = bytes.subarray(bodyStart, bodyEnd);
            const path = pendingPath || (prefix ? prefix + '/' + name : name);
            pendingPath = '';
            if (type === 'x' || type === 'g') {
                pendingPath = paxPath(body);
            } else if (type === 'L') {
                pendingPath = tarText(body).replace(/\0.*$/, '');
            } else if ((type === '\0' || type === '0' || type === '7') && /\.(?:html?|js)$/i.test(path)) {
                entries.push({ path: path, text: tarText(body) });
            }
            offset = bodyStart + Math.ceil(size / 512) * 512;
        }
        return inspectEntries(entries);
    }

    async function inspectTarGz(file) {
        if (typeof DecompressionStream === 'undefined') {
            return archiveFailure('当前浏览器不支持 TAR.GZ 解压。请使用最新版 Chrome 或 Edge，或将宝塔备份转存为 ZIP。', 'TAR_GZ_UNSUPPORTED');
        }
        try {
            const compressed = file.stream ? file.stream() : new Blob([await file.arrayBuffer()]).stream();
            const decompressed = compressed.pipeThrough(new DecompressionStream('gzip'));
            return inspectTarBytes(await new Response(decompressed).arrayBuffer());
        } catch (error) {
            return archiveFailure('旧网站 TAR.GZ 无法读取：' + error.message, 'TAR_GZ_READ_FAILED');
        }
    }

    async function inspectZip(file) {
        if (!file) return archiveFailure('请选择旧网站源码压缩包。', 'ARCHIVE_REQUIRED');
        if (archiveType(file.name) !== 'zip') return archiveFailure('旧网站源码必须是 ZIP 文件。', 'ZIP_TYPE_INVALID');
        if (typeof JSZip === 'undefined') return { valid: false, errors: [makeIssue('ZIP 解析组件未加载，无法检查旧网站源码。', 'ZIP_ENGINE_UNAVAILABLE')], warnings: [], config: {}, detectedFiles: {} };
        try {
            const zip = await JSZip.loadAsync(file);
            const readableFiles = Object.keys(zip.files).filter(function(path) {
                return !zip.files[path].dir && /\.(?:html?|js)$/i.test(path);
            });
            const entries = await Promise.all(readableFiles.map(async function(path) {
                return { path: path, text: await zip.files[path].async('text') };
            }));
            return inspectEntries(entries);
        } catch (error) {
            return { valid: false, errors: [makeIssue('旧网站 ZIP 无法读取：' + error.message, 'ZIP_READ_FAILED')], warnings: [], config: {}, detectedFiles: {} };
        }
    }

    async function inspectArchive(file) {
        if (!file) return archiveFailure('请选择旧网站源码压缩包（.zip、.tar.gz 或 .tgz）。', 'ARCHIVE_REQUIRED');
        const type = archiveType(file.name);
        if (type === 'zip') return inspectZip(file);
        if (type === 'tar-gz') return inspectTarGz(file);
        return archiveFailure('旧网站源码仅支持 .zip、.tar.gz 或 .tgz。', 'ARCHIVE_TYPE_INVALID');
    }

    function fixedPlacements() {
        return {
            adv1: { home: 'after-navbar', detail: 'after-navbar' },
            adv2: { home: 'after-section-0', detail: 'detail-after-content' },
            adv3: { home: 'after-section-1', detail: 'footer-top' }
        };
    }

    function countMatch(html, pattern) {
        const matches = String(html || '').match(pattern);
        return matches ? matches.length : 0;
    }

    function validateGeneratedPage(html, pageType) {
        const errors = [];
        const expectedAdPath = pageType === 'detail' ? '../js/ad.js' : 'js/ad.js';
        const pageLabel = pageType === 'home' ? '首页' : pageType === 'all' ? '全部文章页' : '详情页';
        const gptCount = countMatch(html, /<script\b[^>]*\bsrc=["']https:\/\/securepubads\.g\.doubleclick\.net\/tag\/js\/gpt\.js["'][^>]*>/gi);
        const adCount = countMatch(html, new RegExp('<script\\b[^>]*\\bsrc=["\\\']' + expectedAdPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\?v=[a-z0-9-]+)?["\\\'][^>]*>', 'gi'));
        if (gptCount !== 1) errors.push(makeIssue(pageLabel + ' GPT 脚本数量为 ' + gptCount + '，应为 1。', 'GPT_COUNT_INVALID'));
        if (adCount !== 1) errors.push(makeIssue(pageLabel + ' ad.js 数量为 ' + adCount + '，应为 1。', 'AD_JS_COUNT_INVALID'));
        CONTAINER_IDS.forEach(function(id) {
            const count = countContainer(html, id);
            if (count !== 1) errors.push(makeIssue(pageLabel + ' ' + id + ' 数量为 ' + count + '，应为 1。', 'CONTAINER_COUNT_INVALID'));
        });
        return errors;
    }

    function validateGeneratedPages(homeHtml, detailHtmlList) {
        const errors = validateGeneratedPage(homeHtml, 'home');
        (detailHtmlList || []).forEach(function(html, index) {
            validateGeneratedPage(html, 'detail').forEach(function(error) {
                errors.push(makeIssue('详情页 #' + (index + 1) + '：' + error.message, error.code));
            });
        });
        return { valid: errors.length === 0, errors: errors };
    }

    return {
        inspectEntries: inspectEntries,
        inspectTarBytes: inspectTarBytes,
        inspectZip: inspectZip,
        inspectArchive: inspectArchive,
        inspectAdCodeText: inspectAdCodeText,
        fixedPlacements: fixedPlacements,
        validateGeneratedPage: validateGeneratedPage,
        validateGeneratedPages: validateGeneratedPages,
        containerIds: CONTAINER_IDS.slice(),
        configKeys: CONFIG_KEYS.slice()
    };
})();
