/*
 * 已导出站点的批量广告恢复器。
 * 所有读取、识别、修改和打包均在当前浏览器内完成。
 */
const AdRestoration = (function() {
    'use strict';

    const AD_IDS = ['adv1', 'adv2', 'adv3'];
    const CONTAINER_IDS = ['div-gpt-ad-banner1', 'div-gpt-ad-banner2', 'div-gpt-ad-banner3'];
    const CONFIG_KEYS = ['bannerPath1', 'bannerPath2', 'bannerPath3', 'bannerPath4', 'interstitialPath', 'anchorPath', 'analyticsID'];
    const CONFIG_ALIASES = {
        bannerPath1: 'adUnitBanner1', bannerPath2: 'adUnitBanner2', bannerPath3: 'adUnitBanner3',
        interstitialPath: 'adUnitInterstitial', anchorPath: 'adUnitAnchor', analyticsID: 'gaMeasurementId'
    };
    const HOME_PLACEMENTS = ['off', 'after-navbar', 'after-hero', 'content-top', 'content-middle', 'after-section-0', 'after-section-1', 'after-section-2', 'content-bottom', 'footer-top'];
    const DETAIL_PLACEMENTS = ['off', 'after-navbar', 'detail-before-content', 'detail-middle', 'detail-between-p-1', 'detail-between-p-2', 'detail-between-p-3', 'detail-after-content', 'detail-before-related', 'detail-after-related', 'footer-top'];
    const BANNER_UNITS = ['off', 'banner1', 'banner2', 'banner3'];
    const ALL_PLACEMENTS = ['off', 'after-navbar', 'content-top', 'content-middle', 'content-bottom', 'footer-top'];
    const BATCH_AD_JS_VERSIONS = ['v1.0.0', 'v1.0.1', 'v1.0.2', 'v1.0.2.1'];
    // New finished-site policies store a semantic progress ratio. Legacy
    // child-index paths remain readable so existing saved work is not lost.
    const CUSTOM_PLACEMENT_PATTERN = /^(?:content-ratio-\d{1,4}|custom-after-(?:\d{1,3})(?:-\d{1,3}){0,7})$/;
    const ORIGINAL_PLACEMENT_PATTERN = /^original-banner([123])$/;
    const DEFAULT_POLICY = {
        version: 1,
        writeDisabledComments: true,
        slots: {
            home: [
                { position: 'after-navbar', unit: 'banner1' },
                { position: 'content-middle', unit: 'banner2' },
                { position: 'footer-top', unit: 'banner3' }
            ],
            detail: [
                { position: 'after-navbar', unit: 'banner1' },
                { position: 'detail-middle', unit: 'banner2' },
                { position: 'footer-top', unit: 'banner3' }
            ]
        },
        placements: {
            banner1: { home: 'after-navbar', detail: 'after-navbar' },
            banner2: { home: 'content-middle', detail: 'detail-middle' },
            banner3: { home: 'footer-top', detail: 'footer-top' }
        },
        outOfPage: {
            interstitial: { home: true, detail: false },
            anchor: { home: true, detail: true }
        }
    };

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeBatchAdJsVersionMode(value) {
        return BATCH_AD_JS_VERSIONS.indexOf(value) !== -1 ? value : 'original';
    }

    function syncPlacementsFromSlots(policy) {
        policy.placements = {
            banner1: { home: 'off', detail: 'off' },
            banner2: { home: 'off', detail: 'off' },
            banner3: { home: 'off', detail: 'off' }
        };
        policyPages(policy).forEach(function(page) {
            Object.keys(policy.placements).forEach(function(unit) { policy.placements[unit][page] = 'off'; });
            (policy.slots[page] || []).forEach(function(slot) {
                if (slot.unit !== 'off' && policy.placements[slot.unit]) policy.placements[slot.unit][page] = slot.position;
            });
        });
        return policy;
    }

    // Keep a deterministic order in manifests and the editor while allowing
    // finished sites to own independent article, tool and game detail rules.
    function policyPages(policy) {
        const order = ['home', 'detail', 'article', 'tool', 'game', 'all'];
        return order.filter(function(page) { return !!(policy && policy.slots && policy.slots[page]); });
    }

    function createPolicy(preset, options) {
        const policy = clone(DEFAULT_POLICY);
        if (options && options.pageIsolation) {
            policy.version = 2;
            policy.slots.all = [
                { position: 'after-navbar', unit: 'banner1' },
                { position: 'content-middle', unit: 'banner2' },
                { position: 'footer-top', unit: 'banner3' }
            ];
            policy.outOfPage.interstitial.all = false;
            policy.outOfPage.anchor.all = true;
        }
        if (options && options.contentTypeIsolation) {
            policy.version = 3;
            ['article', 'tool', 'game'].forEach(function(page) {
                policy.slots[page] = clone(policy.slots.detail);
                policy.outOfPage.interstitial[page] = policy.outOfPage.interstitial.detail;
                policy.outOfPage.anchor[page] = policy.outOfPage.anchor.detail;
            });
        }
        if (preset === 'restore-original') {
            policyPages(policy).forEach(function(page) {
                policy.slots[page].forEach(function(slot, index) { slot.position = 'original-banner' + (index + 1); });
            });
        }
        if (preset === 'traffic-limit') {
            policy.slots.home = [
                { position: 'after-navbar', unit: 'banner3' },
                { position: 'after-section-0', unit: 'off' },
                { position: 'after-section-1', unit: 'off' }
            ];
            policy.slots.detail.forEach(function(slot) { slot.unit = 'off'; });
            policy.outOfPage.interstitial = { home: false, detail: false };
            policy.outOfPage.anchor = { home: false, detail: false };
            if (policy.slots.all) {
                policy.slots.all.forEach(function(slot) { slot.unit = 'off'; });
                policy.outOfPage.interstitial.all = false;
                policy.outOfPage.anchor.all = false;
            }
        } else if (preset === 'home-head-footer') {
            policy.slots.home = [
                { position: 'after-navbar', unit: 'banner1' },
                { position: 'after-section-0', unit: 'off' },
                { position: 'footer-top', unit: 'banner3' }
            ];
        }
        // 新工作台的预设关闭广告时不重设其位置；旧 API 的预设保持兼容。
        if (policy.slots.all && preset !== 'restore-original') {
            policyPages(policy).forEach(function(page) {
                policy.slots[page].forEach(function(slot, index) {
                    if (slot.unit === 'off') slot.position = 'original-banner' + (index + 1);
                });
            });
        }
        return syncPlacementsFromSlots(policy);
    }

    function isAllowedPlacement(position, allowedPositions) {
        return allowedPositions.indexOf(position) !== -1 || CUSTOM_PLACEMENT_PATTERN.test(String(position || '')) || ORIGINAL_PLACEMENT_PATTERN.test(String(position || ''));
    }

    function normalizePolicy(input) {
        const source = input || {};
        const hasContentScopes = !!(source.slots && (source.slots.article || source.slots.tool || source.slots.game)) || source.version >= 3;
        const policy = createPolicy(undefined, {
            pageIsolation: !!(source.slots && source.slots.all) || (source.version >= 2 && source.version < 3),
            contentTypeIsolation: hasContentScopes
        });
        policy.writeDisabledComments = source.writeDisabledComments !== false;
        if (source.slots && Array.isArray(source.slots.home) && Array.isArray(source.slots.detail)) {
            policyPages(policy).forEach(function(page) {
                const allowedPositions = page === 'home' ? HOME_PLACEMENTS : page === 'all' ? ALL_PLACEMENTS : DETAIL_PLACEMENTS;
                policy.slots[page] = policy.slots[page].map(function(defaultSlot, index) {
                    const sourceSlots = source.slots[page] || (['article', 'tool', 'game'].indexOf(page) !== -1 ? source.slots.detail : null) || [];
                    const item = sourceSlots[index] || defaultSlot;
                    return {
                        position: isAllowedPlacement(item.position, allowedPositions) && item.position !== 'off' ? item.position : defaultSlot.position,
                        unit: BANNER_UNITS.indexOf(item.unit) !== -1 ? item.unit : defaultSlot.unit
                    };
                });
            });
        } else {
            policyPages(policy).forEach(function(page) {
                const bannerKeys = ['banner1', 'banner2', 'banner3'];
                policy.slots[page] = bannerKeys.map(function(key, index) {
                    const item = source.placements && source.placements[key] ? source.placements[key] : {};
                    const position = item[page] == null && ['article', 'tool', 'game'].indexOf(page) !== -1 ? item.detail : item[page];
                    const allowed = page === 'home' ? HOME_PLACEMENTS : page === 'all' ? ALL_PLACEMENTS : DETAIL_PLACEMENTS;
                    return {
                        position: isAllowedPlacement(position, allowed) && position !== 'off' ? position : policy.slots[page][index].position,
                        unit: position === 'off' ? 'off' : key
                    };
                });
            });
        }
        ['interstitial', 'anchor'].forEach(function(key) {
            const item = source.outOfPage && source.outOfPage[key] ? source.outOfPage[key] : null;
            if (!item) return;
            policy.outOfPage[key].home = item.home !== false;
            policy.outOfPage[key].detail = item.detail !== false;
            if (policy.slots.all) policy.outOfPage[key].all = item.all == null ? policy.outOfPage[key].detail : item.all !== false;
            ['article', 'tool', 'game'].forEach(function(page) {
                if (policy.slots[page]) policy.outOfPage[key][page] = item[page] == null ? policy.outOfPage[key].detail : item[page] !== false;
            });
        });
        return syncPlacementsFromSlots(policy);
    }

    function validatePolicy(policyInput) {
        const policy = normalizePolicy(policyInput);
        const errors = [];
        policyPages(policy).forEach(function(page) {
            const used = {};
            policy.slots[page].forEach(function(slot, index) {
                if (slot.unit === 'off') return;
                if (used[slot.unit] != null) {
                    const pageLabel = { home: '首页', detail: '详情页', article: '文章详情页', tool: '工具详情页', game: '游戏详情页', all: '全部文章页' }[page] || page;
                    errors.push(issue(pageLabel + '广告位 ' + (used[slot.unit] + 1) + ' 和广告位 ' + (index + 1) + ' 重复使用 ' + slot.unit + '。同一页面的同一 banner 只能使用一次。', 'AD_POLICY_DUPLICATE_UNIT'));
                } else used[slot.unit] = index;
            });
        });
        return errors;
    }

    function issue(message, code) {
        return { message: message, code: code || 'AD_RESTORATION_FAILED' };
    }

    function normalizePath(value) {
        return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '').replace(/\/{2,}/g, '/');
    }

    // Keep a local export-boundary check as well as the shared planner check.
    // Classic browser scripts can be refreshed independently, so the final
    // injector must never let copied build/template trees become site pages.
    const FINISHED_SITE_AUXILIARY_PATH = /(?:^|\/)(?:vendor-games|assets|node_modules|scripts|templates?|(?:[^/]+-)?_dist|\.git|\.tmp[^/]*|\.site-build)(?:\/|$)/i;

    function isFinishedSiteDeployablePath(path, project) {
        const normalized = normalizePath(path);
        if (FINISHED_SITE_AUXILIARY_PATH.test(normalized)) return false;
        if (typeof FinishedSiteAds === 'undefined') return true;
        if (typeof FinishedSiteAds.isDeployableContentPath === 'function') {
            return FinishedSiteAds.isDeployableContentPath(normalized, project);
        }
        return typeof FinishedSiteAds.isContentPath !== 'function' || FinishedSiteAds.isContentPath(normalized);
    }

    /**
     * Pages explicitly excluded from search indexing are usually retired-route
     * notices, preview shells or private QA documents. Preserve them byte for
     * byte, but do not require the public site's three-banner layout on them.
     */
    function hasNoindexDirective(html) {
        const tags = String(html || '').match(/<meta\b[^>]*>/gi) || [];
        return tags.some(function(tag) {
            const name = tag.match(/\bname\s*=\s*(["'])(.*?)\1/i);
            const content = tag.match(/\bcontent\s*=\s*(["'])(.*?)\1/i);
            return !!(name && content && /^(?:robots|googlebot)$/i.test(name[2].trim())
                && /(?:^|[,\s])noindex(?:$|[,\s])/i.test(content[2]));
        });
    }

    /**
     * Find HTML documents that are loaded inside another page's iframe.
     * They are deployment resources rather than standalone site pages, so
     * inserting the host page's three banners into them breaks both layout and
     * export validation. Keep the files byte-identical and validate their host
     * page instead.
     */
    function referencedEmbeddedHtmlPaths(entries) {
        const htmlEntries = (entries || []).filter(function(entry) { return /\.html?$/i.test(normalizePath(entry.path)); });
        const available = htmlEntries.map(function(entry) { return normalizePath(entry.path).toLowerCase(); });
        const embedded = new Set();

        function resolveTarget(sourcePath, value) {
            let source = String(value || '').trim();
            if (!source || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(source)) return '';
            source = source.split('#')[0].split('?')[0].replace(/\\/g, '/');
            try { source = decodeURIComponent(source); } catch (_) {}
            const parts = source.charAt(0) === '/' ? [] : directoryName(sourcePath).split('/').filter(Boolean);
            source.replace(/^\/+/, '').split('/').forEach(function(part) {
                if (!part || part === '.') return;
                if (part === '..') parts.pop();
                else parts.push(part);
            });
            return parts.join('/').toLowerCase();
        }

        htmlEntries.forEach(function(entry) {
            const iframe = /<iframe\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
            let match;
            while ((match = iframe.exec(entryText(entry))) !== null) {
                const rawSource = match[1] || match[2] || match[3] || '';
                const target = resolveTarget(entry.path, rawSource);
                if (!target || !/\.html?$/i.test(target)) continue;
                available.forEach(function(candidate) {
                    if (candidate === target || (rawSource.trim().charAt(0) === '/' && candidate.endsWith('/' + target))) {
                        embedded.add(candidate);
                    }
                });
            }
        });
        return embedded;
    }

    function isSafePath(value) {
        const path = normalizePath(value);
        return !!path && path.indexOf('\0') === -1 && !/^__MACOSX(?:\/|$)/i.test(path) && !path.split('/').some(function(part) { return part === '..'; });
    }

    function directoryName(path) {
        const normalized = normalizePath(path);
        const slash = normalized.lastIndexOf('/');
        return slash === -1 ? '' : normalized.slice(0, slash + 1);
    }

    function relativeAdScriptPath(pagePath, siteRoot) {
        const pageDir = directoryName(pagePath).slice((siteRoot || '').length);
        const depth = pageDir.split('/').filter(Boolean).length;
        return '../'.repeat(depth) + 'js/ad.js';
    }

    function decodeJavaScriptString(value) {
        return String(value || '')
            .replace(/\\([\\'"`])/g, '$1')
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t');
    }

    function extractAssignment(source, key) {
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Prefer an active nonempty declaration, even when an earlier comment
        // contains an empty placeholder. A policy export has the opposite
        // shape: an active empty placeholder and the original path in a
        // comment, which must remain recoverable on the next import.
        const activeSource = String(source || '').replace(/\/\*[\s\S]*?\*\//g, '');
        const activePattern = new RegExp('^\\s*(?:(?:const|let|var)\\s+)?' + escapedKey + "\\s*=\\s*(['\"])((?:\\\\.|(?!\\1)[\\s\\S])*)\\1", 'gm');
        let match;
        let activeValue = '';
        while ((match = activePattern.exec(activeSource)) !== null) {
            const value = decodeJavaScriptString(match[2]);
            if (value) activeValue = value;
        }
        if (activeValue) return activeValue;
        const pattern = new RegExp('(?:\\b(?:const|let|var)\\s+)?\\b' + escapedKey + "\\s*=\\s*(['\"])((?:\\\\.|(?!\\1)[\\s\\S])*)\\1", 'gm');
        while ((match = pattern.exec(String(source || ''))) !== null) {
            const value = decodeJavaScriptString(match[2]);
            if (value) return value;
        }
        return '';
    }

    function readExistingConfig(source) {
        return CONFIG_KEYS.reduce(function(config, key) {
            config[key] = extractAssignment(source, key) || (CONFIG_ALIASES[key] ? extractAssignment(source, CONFIG_ALIASES[key]) : '');
            return config;
        }, {});
    }

    function detectAdRuntimeFormat(source) {
        // Detect the variable family, not a version comment: disabled units can
        // have empty active declarations while their original paths are commented.
        return /\b(?:const|let|var)\s+adUnit(?:Banner[123]|Interstitial|Anchor)\s*=/.test(String(source || ''))
            ? 'ad-unit' : 'legacy';
    }

    function detectAdJsVersion(source) {
        const text = String(source || '');
        const markers = Array.from(text.matchAll(/\bad\.js\s+v(\d+(?:\.\d+){2,3}(?:-[0-9a-z.-]+)?)/gi), function(match) {
            return 'v' + match[1];
        });
        const versions = Array.from(new Set(markers));
        const runtimeFormat = detectAdRuntimeFormat(text);
        const hasInitialFingerprint = /\bfunction\s+delayLoadBanner\s*\(/.test(text)
            && /\bnew\s+IntersectionObserver\s*\(/.test(text)
            && /\bconst\s+bannerPath1\s*=/.test(text);
        const catalog = typeof window !== 'undefined' && window.AdTemplateCatalog;
        const customVersions = versions.filter(function(version) { return catalog && catalog.getTemplate(version); });
        if (customVersions.length === 1 && !hasInitialFingerprint) return customVersions[0];
        if (versions.length === 1 && runtimeFormat === 'ad-unit' && !hasInitialFingerprint) return versions[0];
        if (versions.length) return '';

        // The initial template predates version headers. Its delayed Banner
        // loader and IntersectionObserver form a stable fingerprint that does
        // not appear in the numbered ad-unit templates.
        if (hasInitialFingerprint) return 'initial';
        return '';
    }

    function detectedHost(config) {
        const paths = CONFIG_KEYS.filter(function(key) { return key !== 'analyticsID'; })
            .map(function(key) { return config && config[key]; }).filter(Boolean);
        for (let index = 0; index < paths.length; index++) {
            const unit = String(paths[index]).replace(/-(?:banner\d+|int\d*|anc\d*)$/i, '');
            const host = unit.split('/').pop();
            if (host) return host.toLowerCase();
        }
        return '';
    }

    function discoverEmbeddedAdConfig(entries, existingConfig) {
        const config = CONFIG_KEYS.reduce(function(result, key) {
            result[key] = existingConfig && existingConfig[key] ? existingConfig[key] : '';
            return result;
        }, {});
        const discovered = [];
        const source = (entries || []).filter(function(entry) {
            return /\.(?:js|html?)$/i.test(entry.path || '');
        }).map(function(entry) { return entry.text || ''; }).join('\n');
        const pathPattern = /(\/[A-Za-z0-9_./-]+-(?:banner[1-4]|INT|ANC))\b/gi;
        let match;
        while ((match = pathPattern.exec(source)) !== null) {
            const path = match[1];
            const lower = path.toLowerCase();
            let key = '';
            if (/-banner1$/.test(lower)) key = 'bannerPath1';
            else if (/-banner2$/.test(lower)) key = 'bannerPath2';
            else if (/-banner3$/.test(lower)) key = 'bannerPath3';
            else if (/-banner4$/.test(lower)) key = 'bannerPath4';
            else if (/-int$/.test(lower)) key = 'interstitialPath';
            else if (/-anc$/.test(lower)) key = 'anchorPath';
            if (key && !config[key]) {
                config[key] = path;
                discovered.push(key);
            }
        }
        if (!config.analyticsID) {
            const gaMatch = source.match(/(?:gtag\(\s*['"]config['"]\s*,\s*['"]|\b)(G-[A-Z0-9]+)(?:['"]|\b)/i);
            if (gaMatch) {
                config.analyticsID = gaMatch[1].toUpperCase();
                discovered.push('analyticsID');
            }
        }

        const derived = [];
        const banner2 = config.bannerPath2 || '';
        if (/-banner2$/i.test(banner2)) {
            const base = banner2.replace(/-banner2$/i, '');
            [
                ['bannerPath1', base + '-banner1'],
                ['bannerPath3', base + '-banner3'],
                ['interstitialPath', base + '-INT'],
                ['anchorPath', base + '-ANC']
            ].forEach(function(pair) {
                if (!config[pair[0]]) {
                    config[pair[0]] = pair[1];
                    derived.push(pair[0]);
                }
            });
        }
        const missing = ['bannerPath1', 'bannerPath2', 'bannerPath3', 'interstitialPath', 'anchorPath'].filter(function(key) {
            return !config[key];
        });
        return { config: config, discovered: discovered, derived: derived, missing: missing };
    }

    function inspectCodeText(text, fileName) {
        const base = typeof AdMigration !== 'undefined'
            ? AdMigration.inspectAdCodeText(text, fileName)
            : { valid: false, errors: [issue('广告代码解析器未加载。', 'AD_PARSER_UNAVAILABLE')], warnings: [], config: {}, detectedHost: '' };
        const errors = (base.errors || []).slice();
        if (base.valid && !base.config.interstitialPath) errors.push(issue('未识别到 INT 插屏广告位，无法完整恢复。', 'RESTORE_INT_REQUIRED'));
        if (base.valid && !base.config.anchorPath) errors.push(issue('未识别到 ANC 锚点广告位，无法完整恢复。', 'RESTORE_ANC_REQUIRED'));
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: (base.warnings || []).filter(function(item) {
                return item.code !== 'OPTIONAL_INT_MISSING' && item.code !== 'OPTIONAL_ANC_MISSING';
            }),
            config: base.config || {},
            detectedHost: base.detectedHost || detectedHost(base.config || {}),
            fileName: fileName || ''
        };
    }

    function entryText(entry) {
        if (typeof entry.text === 'string') return entry.text;
        if (typeof entry.content === 'string') return entry.content;
        if (entry.bytes) return new TextDecoder('utf-8').decode(entry.bytes);
        return '';
    }

    function inspectSiteEntries(rawEntries, archiveName, options) {
        const entries = (rawEntries || []).map(function(entry) {
            return { path: normalizePath(entry.path || entry.name), text: entryText(entry), source: entry };
        }).filter(function(entry) { return isSafePath(entry.path); });
        const embeddedDocuments = referencedEmbeddedHtmlPaths(entries);
        // Finished-site previews and both placement modes share the same page
        // scope. Embedded game documents stay in entries for lossless export.
        const htmlEntries = entries.filter(function(entry) {
            return /\.html?$/i.test(entry.path) && (!(options && options.finishedSite)
                || (isFinishedSiteDeployablePath(entry.path, options && options.project)
                    && !hasNoindexDirective(entry.text)
                    && !embeddedDocuments.has(entry.path.toLowerCase())));
        });
        const indexCandidates = htmlEntries.filter(function(entry) { return /(?:^|\/)index\.html?$/i.test(entry.path); })
            .sort(function(a, b) { return a.path.split('/').length - b.path.split('/').length; });
        let home = null;
        let siteRoot = '';
        let details = [];

        for (let i = 0; i < indexCandidates.length; i++) {
            const candidate = indexCandidates[i];
            const root = candidate.path.replace(/index\.html?$/i, '');
            // 同事建站工具生成的静态游戏站以 games.html + games/*.html 为边界。
            // 识别该完整形状后，详细策略与快速更新都能复用同一页范围；
            // 仅有零散 games 子目录的普通站点不会被误判。
            const staticGameLayout = !!(options && (options.quickUpdate || options.staticGame))
                || (htmlEntries.some(function(entry) { return entry.path.toLowerCase() === (root + 'games.html').toLowerCase(); })
                    && htmlEntries.some(function(entry) { return entry.path.indexOf(root + 'games/') === 0; }));
            const detailDirectory = staticGameLayout
                ? /^(?:details?|articles?|games)\//i
                : options && options.finishedSite
                    ? /^(?:details?|articles?|news|posts?|stories?|guides?|blog)\//i
                    : /^(?:details?|articles?)\//i;
            const candidateDetails = htmlEntries.filter(function(entry) {
                if (entry.path === candidate.path || entry.path.indexOf(root) !== 0) return false;
                const relative = entry.path.slice(root.length);
                return detailDirectory.test(relative) || /class\s*=\s*["'][^"']*\bdetail-page\b/i.test(entry.text)
                    || !!(options && options.finishedSite && /\.html?$/i.test(relative)
                        && !/^games\.html?$/i.test(relative)
                        && !/(?:^|\/)(?:about(?:-us)?|contact(?:-us)?|privacy(?:-policy)?|cookie(?:-policy)?|terms(?:-of-service)?|legal|faq|404)(?:[\/.]|$)/i.test(relative));
            });
            if (candidateDetails.length) {
                home = candidate;
                siteRoot = root;
                details = candidateDetails;
                break;
            }
        }

        if (!home && indexCandidates.length) {
            home = indexCandidates[0];
            siteRoot = home.path.replace(/index\.html?$/i, '');
        }

        const adPath = siteRoot + 'js/ad.js';
        const adEntry = entries.find(function(entry) { return entry.path.toLowerCase() === adPath.toLowerCase(); }) || null;
        const existingConfig = adEntry ? readExistingConfig(adEntry.text) : {};
        const adRuntimeFormat = detectAdRuntimeFormat(adEntry && adEntry.text);
        const adJsVersion = detectAdJsVersion(adEntry && adEntry.text);
        const embedded = discoverEmbeddedAdConfig(entries, existingConfig);
        const errors = [];
        const warnings = [];
        if (!home) errors.push(issue('压缩包中未识别到站点首页 index.html。', 'RESTORE_HOME_NOT_FOUND'));
        if (!details.length && !(options && options.finishedSite)) errors.push(issue(options && options.finishedSite
            ? '压缩包中未识别到详情页（details/articles/news/posts/blog 等内容目录或 detail-page 结构）。'
            : '压缩包中未识别到详情页（details/articles 目录或 detail-page 结构）。', 'RESTORE_DETAILS_NOT_FOUND'));
        if (!adEntry && home) warnings.push(issue('未找到原 js/ad.js，恢复时将在站点目录中新建。', 'RESTORE_AD_JS_CREATE'));
        if (embedded.derived.length) warnings.push(issue('源站限流配置中有广告路径被清空；已根据同一广告单元的 banner2 命名恢复：' + embedded.derived.join('、') + '。', 'RESTORE_PATHS_DERIVED'));
        if (embedded.missing.length) errors.push(issue('源文件中无法识别完整广告单元，缺少：' + embedded.missing.join('、') + '。', 'RESTORE_EMBEDDED_CONFIG_INCOMPLETE'));

        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            archiveName: archiveName || '',
            siteRoot: siteRoot,
            homePath: home ? home.path : '',
            detailPaths: details.map(function(entry) { return entry.path; }),
            embeddedDocumentPaths: Array.from(embeddedDocuments),
            // Listing pages follow the detail-page policy but have a card grid,
            // not a prose container. Keep them separate for placement planning.
            listingPaths: htmlEntries.filter(function(entry) {
                const relative = entry.path.slice(siteRoot.length);
                const staticGameListing = (options && (options.quickUpdate || options.staticGame))
                    || (htmlEntries.some(function(candidate) { return candidate.path.toLowerCase() === (siteRoot + 'games.html').toLowerCase(); })
                        && htmlEntries.some(function(candidate) { return candidate.path.indexOf(siteRoot + 'games/') === 0; }));
                const quickStaticGameListing = staticGameListing && /^games\.html?$/i.test(relative);
                return entry.path.indexOf(siteRoot) === 0 && (quickStaticGameListing || /(?:^|\/)all-(?:articles|games)\.html?$/i.test(entry.path))
                    && !details.some(function(detail) { return detail.path === entry.path; });
            }).map(function(entry) { return entry.path; }),
            adPath: adPath,
            adRuntimeFormat: adRuntimeFormat,
            adJsVersion: adJsVersion,
            existingConfig: existingConfig,
            embeddedConfig: embedded.config,
            configDerivedKeys: embedded.derived,
            detectedHost: detectedHost(embedded.config)
        };
    }

    function classValue(tag) {
        const match = String(tag || '').match(/\bclass\s*=\s*(["'])([\s\S]*?)\1/i);
        return match ? match[2] : '';
    }

    function hasClass(tag, name) {
        return classValue(tag).split(/\s+/).indexOf(name) !== -1;
    }

    function findMatchingElementEnd(html, start, tagName) {
        const token = new RegExp('<\\/?' + tagName + '\\b[^>]*>', 'gi');
        token.lastIndex = start;
        let depth = 0;
        let match;
        while ((match = token.exec(html)) !== null) {
            const closing = /^<\//.test(match[0]);
            const selfClosing = /\/\s*>$/.test(match[0]);
            if (closing) depth--;
            else if (!selfClosing) depth++;
            if (depth === 0) return token.lastIndex;
        }
        return -1;
    }

    function removeMatchingDivs(html, predicate) {
        let output = String(html || '');
        let changed = true;
        while (changed) {
            changed = false;
            const opener = /<div\b[^>]*>/gi;
            let match;
            while ((match = opener.exec(output)) !== null) {
                const end = findMatchingElementEnd(output, match.index, 'div');
                if (end === -1) break;
                const whole = output.slice(match.index, end);
                if (predicate(match[0], whole)) {
                    // 原位置标记与广告开关分离。移除容器时留下标记，关闭后可在同一间隙恢复。
                    const origins = whole.match(/<!-- SITEFOUNDRY_AD_ORIGIN banner[123] -->/g) || [];
                    output = output.slice(0, match.index) + origins.join('\n') + output.slice(end);
                    changed = true;
                    break;
                }
            }
        }
        return output;
    }

    function removeExistingAds(html) {
        let output = String(html || '');
        // 字符串中的示例容器不是页面 DOM，不能在清理广告时破坏站点脚本。
        const protectedBlocks = [];
        let prefix = 'SITEFOUNDRY_PROTECTED_BLOCK_';
        while (output.indexOf(prefix) !== -1) prefix += '_';
        output = output.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, function(block) {
            protectedBlocks.push(block);
            return '<!--' + prefix + (protectedBlocks.length - 1) + '-->';
        }).replace(/<!--\s*AD_POLICY_DISABLED_START[\s\S]*?AD_POLICY_DISABLED_END\s*-->/gi, '');
        output = removeMatchingDivs(output, function(openTag, whole) {
            return hasClass(openTag, 'ad-region') && /\bid\s*=\s*["'](?:adv[123]|div-gpt-ad-banner[123])["']/i.test(whole);
        });
        output = removeMatchingDivs(output, function(openTag) {
            return /\bid\s*=\s*["'](?:adv[123]|div-gpt-ad-banner[123])["']/i.test(openTag);
        });
        output = removeMatchingDivs(output, function(openTag, whole) {
            if (!hasClass(openTag, 'ad-region')) return false;
            const inner = whole.replace(/^<div\b[^>]*>/i, '').replace(/<\/div>$/i, '').replace(/<!--[\s\S]*?-->/g, '').trim();
            return inner === '';
        });
        return output.replace(new RegExp('<!--' + prefix + '(\\d+)-->', 'g'), function(match, index) { return protectedBlocks[Number(index)]; });
    }

    function removeAdScripts(html) {
        return String(html || '').replace(/<script\b[^>]*\bsrc\s*=\s*(["'])([^"']+)\1[^>]*>[\s\S]*?<\/script\s*>/gi, function(whole, quote, src) {
            const clean = String(src || '').split('?')[0].split('#')[0];
            return /securepubads\.g\.doubleclick\.net\/tag\/js\/gpt\.js/i.test(clean) || /(?:^|\/|\\)js\/ad\.js$/i.test(clean) ? '' : whole;
        });
    }

    function findElementByClass(html, tagName, className, fromIndex) {
        const opener = new RegExp('<' + tagName + '\\b[^>]*>', 'gi');
        opener.lastIndex = fromIndex || 0;
        let match;
        while ((match = opener.exec(html)) !== null) {
            if (!hasClass(match[0], className)) continue;
            return { start: match.index, openEnd: opener.lastIndex, end: findMatchingElementEnd(html, match.index, tagName), openTag: match[0], tag: tagName.toLowerCase() };
        }
        return null;
    }

    function insertAt(html, index, content) {
        return html.slice(0, index) + '\n    ' + content + '\n    ' + html.slice(index);
    }

    function navbarStyle(html) {
        const match = String(html || '').match(/<nav\b[^>]*\bclass\s*=\s*(["'])([^"']*)\1/i);
        const classes = match ? match[2].split(/\s+/) : [];
        return ['glass-sticky', 'dark-fixed', 'transparent', 'side-drawer', 'bottom-fixed'].find(function(name) {
            return classes.indexOf(name) !== -1;
        }) || '';
    }

    function template(adId) {
        if (typeof Generator !== 'undefined' && typeof Generator.getAdTemplate === 'function') return Generator.getAdTemplate(adId);
        const number = adId.replace(/\D/g, '');
        // Keep the fallback marker readable by inheriting the active page theme.
        return '<div id="' + adId + '" style="text-align:center;padding:10px;display:flex;flex-direction:column;align-items:center;overflow:hidden;margin-top:1px;"><div style="text-align:center;color:inherit!important;-webkit-text-fill-color:currentColor!important;font-size:13px;">advertisement</div><div id="div-gpt-ad-banner' + number + '" style="min-width:300px;min-height:250px;"></div></div>';
    }

    function adOneRegion(html) {
        return '<div class="ad-region ad-after-navbar ad-nav-' + navbarStyle(html) + '">' + template('adv1') + '</div>';
    }

    function findFooter(html) {
        return findElementByClass(html, 'footer', 'footer') || (function() {
            const match = /<footer\b/i.exec(html);
            if (!match) return null;
            return { start: match.index, openEnd: match.index, end: findMatchingElementEnd(html, match.index, 'footer') };
        })();
    }

    function findNavigationElement(html) {
        const semantic = findFirstElement(html, 'nav') || findFirstElement(html, 'header');
        if (semantic) return semantic;

        // Finished sites sometimes render their top navigation as a styled div.
        // Require several links so an unrelated section with “nav” in its name
        // does not become an insertion point.
        const source = String(html || '');
        const opener = /<(div|section)\b[^>]*>/gi;
        let match;
        while ((match = opener.exec(source)) !== null) {
            const tag = match[1].toLowerCase();
            const className = classValue(match[0]);
            const idMatch = match[0].match(/\bid\s*=\s*(["'])(.*?)\1/i);
            const name = className + ' ' + (idMatch ? idMatch[2] : '');
            if (!/(?:header|navbar|navigation|(?:^|[\s_-])nav(?:[\s_-]|$))/i.test(name)
                || /pagination|breadcrumb|footer|social|share/i.test(name)) continue;
            const end = findMatchingElementEnd(source, match.index, tag);
            if (end <= opener.lastIndex) continue;
            const links = source.slice(opener.lastIndex, end).match(/<a\b[^>]*>/gi) || [];
            if (links.length >= 2) {
                return { start: match.index, openEnd: opener.lastIndex, end: end, openTag: match[0], tag: tag };
            }
        }
        return null;
    }

    function customScrollProgressOpenTag(openTag) {
        const source = String(openTag || '');
        if (/\bdata-(?:scroll|reading|page)-(?:progress|indicator)\b/i.test(source)) return true;
        const idMatch = source.match(/\bid\s*=\s*(["'])(.*?)\1/i);
        const identity = classValue(source) + ' ' + (idMatch ? idMatch[2] : '');
        return /(?:^|[-_\s])(?:scroll|reading|page)[-_\s]*(?:progress|indicator)(?:$|[-_\s])/i.test(identity);
    }

    function hasAdjacentScrollProgressAfterNavigation(html) {
        // Prefer the outer header because a semantic nav is commonly nested in
        // it; the custom progress rail is then the header's adjacent sibling.
        const navigation = findFirstElement(html, 'header') || findFirstElement(html, 'nav') || findNavigationElement(html);
        if (!navigation || navigation.end < 0) return false;
        const navigationSource = String(html || '').slice(navigation.openEnd, navigation.end);
        const progressInsideNavigation = navigationSource.match(/<([a-z][\w:-]*)\b[^>]*>/gi) || [];
        if (progressInsideNavigation.some(customScrollProgressOpenTag)) return true;
        const tail = String(html || '').slice(navigation.end);
        const sibling = tail.match(/^(?:\s|<!--[\s\S]*?-->)*<([a-z][\w:-]*)\b[^>]*>/i);
        return !!(sibling && customScrollProgressOpenTag(sibling[0]));
    }

    function afterNavigationOffsetStyle() {
        return '<style data-sitefoundry-after-nav-offset-style>@media (min-width:720px){[data-sitefoundry-after-nav-offset]{margin-top:24px!important;}}</style>';
    }

    function closeStart(html, element, tagName) {
        if (!element || element.end === -1) return -1;
        const slice = html.slice(element.start, element.end);
        const pattern = new RegExp('<\\/' + tagName + '\\s*>', 'gi');
        let match;
        let last = null;
        while ((match = pattern.exec(slice)) !== null) last = match;
        return last ? element.start + last.index : -1;
    }

    function elementsByClass(html, tagName, className, fromIndex, beforeIndex) {
        const result = [];
        let offset = fromIndex || 0;
        let element;
        while ((element = findElementByClass(html, tagName, className, offset)) !== null) {
            if (beforeIndex != null && element.start >= beforeIndex) break;
            if (element.end === -1) break;
            result.push(element);
            offset = element.end;
        }
        return result;
    }

    function adGroupMarkup(html, position, adIds, offsetAfterNavigation) {
        const markup = adIds.map(template).join('\n');
        if (position === 'after-navbar') {
            const offsetAttribute = offsetAfterNavigation ? ' data-sitefoundry-after-nav-offset' : '';
            const offsetStyle = offsetAfterNavigation ? afterNavigationOffsetStyle() : '';
            return offsetStyle + '<div class="ad-region ad-after-navbar ad-nav-' + navbarStyle(html) + '"' + offsetAttribute + '>' + markup + '</div>';
        }
        if (CUSTOM_PLACEMENT_PATTERN.test(String(position || ''))) {
            // The selected gap can be inside one column of a multi-column page.
            // The runtime sets the CSS variable from the rendered viewport so the
            // creative is centered relative to the complete page, not that column.
            return '<div class="ad-region sitefoundry-ad-custom-placement" style="position:relative;transform:translateX(var(--sitefoundry-ad-center-offset, 0px));">' + markup + '</div>';
        }
        return markup;
    }

    function disabledBannerComment(adId, pageType) {
        const banner = adId.replace('adv', 'banner');
        return '<!-- AD_POLICY_DISABLED_START ' + banner + ' page=' + pageType + '\n' +
            template(adId) + '\nAD_POLICY_DISABLED_END -->';
    }

    function relatedElement(html) {
        return findElementByClass(html, 'div', 'related-section') ||
            findElementByClass(html, 'section', 'related-section') ||
            findElementByClass(html, 'div', 'related-articles') ||
            findElementByClass(html, 'section', 'related-articles');
    }

    function detailContentMiddleIndex(html, detailContent) {
        if (!detailContent || detailContent.end === -1) return -1;
        // Articles are best divided between paragraphs; tool and game detail
        // pages commonly use semantic sections instead. Keep the fallback
        // inside the content container when neither structure is available.
        const tagGroups = [['p'], ['section'], ['h2', 'h3'], ['div']];
        let singleBlockEnd = -1;
        for (let groupIndex = 0; groupIndex < tagGroups.length; groupIndex++) {
            const matches = [];
            const pattern = new RegExp('<(' + tagGroups[groupIndex].join('|') + ')\\b[^>]*>', 'gi');
            pattern.lastIndex = detailContent.openEnd;
            let match;
            while ((match = pattern.exec(html)) !== null && match.index < detailContent.end) {
                const end = findMatchingElementEnd(html, match.index, match[1]);
                if (end > match.index && end <= detailContent.end) matches.push({ start: match.index, end: end });
            }
            if (matches.length >= 2) return matches[Math.max(0, Math.ceil(matches.length / 2) - 1)].end;
            if (singleBlockEnd < 0 && matches.length === 1) singleBlockEnd = matches[0].end;
        }
        return singleBlockEnd >= 0 ? singleBlockEnd : detailContent.openEnd;
    }

    function findFirstElement(html, tagName) {
        const opener = new RegExp('<' + tagName + '\\b[^>]*>', 'i');
        const match = opener.exec(html);
        if (!match) return null;
        return { start: match.index, openEnd: match.index + match[0].length, end: findMatchingElementEnd(html, match.index, tagName), openTag: match[0], tag: tagName.toLowerCase() };
    }

    function directHtmlElementChildren(html, parent) {
        if (!parent || parent.end === -1) return [];
        const children = [];
        const stack = [];
        const voidTags = { area: true, base: true, br: true, col: true, embed: true, hr: true, img: true, input: true, link: true, meta: true, param: true, source: true, track: true, wbr: true };
        const token = /<\/?([a-z][\w:-]*)\b[^>]*>/gi;
        token.lastIndex = parent.openEnd;
        let current = null;
        let match;
        while ((match = token.exec(html)) !== null && match.index < parent.end) {
            const tag = match[1].toLowerCase();
            const closing = /^<\//.test(match[0]);
            if (closing) {
                if (!stack.length) continue;
                stack.pop();
                if (!stack.length && current) {
                    current.end = token.lastIndex;
                    children.push(current);
                    current = null;
                }
                continue;
            }
            const selfClosing = /\/\s*>$/.test(match[0]) || !!voidTags[tag];
            if (!stack.length) current = { start: match.index, openEnd: token.lastIndex, end: selfClosing ? token.lastIndex : -1, openTag: match[0], tag: tag };
            if (!selfClosing) stack.push(tag);
            else if (!stack.length && current) {
                children.push(current);
                current = null;
            }
        }
        return children;
    }

    function meaningfulHtmlElementChildren(html, parent) {
        const excludedTags = { script: true, style: true, template: true, header: true, nav: true, footer: true, aside: true };
        return directHtmlElementChildren(html, parent).filter(function(child) {
            if (excludedTags[child.tag]) return false;
            if (/\bdata-sitefoundry-(?:preview|runtime)-ad\b/i.test(child.openTag)) return false;
            if (/\bid\s*=\s*["']adv[123]["']/i.test(child.openTag) || /\bdata-sitefoundry-middle-ad\b/i.test(child.openTag)) return false;
            return !/\b(?:class|id)\s*=\s*["'][^"']*related/i.test(child.openTag);
        });
    }

    function customPlacementIndex(html, position) {
        if (!CUSTOM_PLACEMENT_PATTERN.test(String(position || ''))) return -1;
        const path = String(position).replace('custom-after-', '').split('-').map(Number);
        let target = findFirstElement(html, 'main') || findFirstElement(html, 'body');
        for (let index = 0; target && index < path.length; index++) {
            const children = meaningfulHtmlElementChildren(html, target);
            // 自定义路径必须在每个目标页面真实存在；不能静默夹到另一内容块。
            target = children[path[index]] || null;
        }
        return target && target.end !== -1 ? target.end : -1;
    }

    function insertPlacement(html, pageType, position, adIds, options) {
        const original = String(position || '').match(ORIGINAL_PLACEMENT_PATTERN);
        if (original) {
            const marker = '<!-- SITEFOUNDRY_AD_ORIGIN banner' + original[1] + ' -->';
            const markerIndex = html.indexOf(marker);
            if (markerIndex >= 0) {
                const index = markerIndex + marker.length;
                const markup = options && options.previewMarkup || adGroupMarkup(html, position, adIds, false);
                return { html: insertAt(html, index, markup), index: index, markup: markup };
            }
            // 旧站既无位置清单，也无可靠容器/注释时，按用户确认采用统一默认位置。
            const defaults = createPolicy(undefined, { pageIsolation: true });
            return insertPlacement(html, pageType, defaults.slots[pageType][Number(original[1]) - 1].position, adIds, options);
        }
        const offsetAfterNavigation = position === 'after-navbar' && adIds.indexOf('adv1') !== -1
            && hasAdjacentScrollProgressAfterNavigation(html);
        let markup = options && options.previewMarkup || adGroupMarkup(html, position, adIds, offsetAfterNavigation);
        if (options && options.finishedSite && typeof DOMParser !== 'undefined' && typeof FinishedSiteAds !== 'undefined') {
            // Finished sites do not share our generated template classes. Use
            // exactly the rendered-DOM resolver used by their live preview.
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const adjusted = [];
            for (const id of adIds) {
                const node = FinishedSiteAds.createPlaceholder(doc, 'banner' + id.replace('adv', ''));
                if (!FinishedSiteAds.insertAtPosition(doc, pageType, position, node)) {
                    return { html: html, error: issue('无法定位广告位置 ' + position + '。', 'AD_POLICY_POSITION_NOT_FOUND') };
                }
                if (node.hasAttribute('data-sitefoundry-placement-adjusted')) {
                    adjusted.push('banner' + id.replace('adv', ''));
                    node.removeAttribute('data-sitefoundry-placement-adjusted');
                }
            }
            FinishedSiteAds.installLayout(doc);
            return { html: FinishedSiteAds.serialize(doc), adjusted: adjusted };
        }
        let anchor = null;
        let index = -1;

        if (CUSTOM_PLACEMENT_PATTERN.test(String(position || ''))) {
            index = customPlacementIndex(html, position);
        } else if (position === 'footer-top') {
            anchor = findFooter(html);
            index = anchor ? anchor.start : -1;
        } else if (options && options.listingPage) {
            const main = findFirstElement(html, 'main');
            const nav = findNavigationElement(html);
            const grid = findElementByClass(html, 'div', 'items-grid')
                || findElementByClass(html, 'div', 'games-grid')
                || findElementByClass(html, 'div', 'grid');
            if (position === 'after-navbar') index = nav ? nav.end : main ? main.start : -1;
            else if (position === 'detail-before-content' || position === 'content-top') index = grid ? grid.start : main ? main.openEnd : -1;
            else if (position === 'detail-before-related' || position === 'detail-after-related' || position === 'detail-after-content' || position === 'content-bottom') {
                const footer = findFooter(html);
                index = footer ? footer.start : closeStart(html, main, 'main');
            } else {
                const cards = grid ? directHtmlElementChildren(html, grid) : [];
                if (cards.length) {
                    index = cards[Math.max(0, Math.ceil(cards.length / 2) - 1)].end;
                    markup = '<div data-sitefoundry-middle-ad style="grid-column:1 / -1;flex-basis:100%;width:100%;min-width:0;order:0;">' + markup + '</div>';
                }
            }
        } else if (pageType === 'home') {
            const main = findElementByClass(html, 'main', 'main-content') || findFirstElement(html, 'main');
            const hero = findElementByClass(html, 'section', 'hero') || (options && options.finishedSite ? findElementByClass(html, 'div', 'hero') : null);
            if (position === 'after-navbar') {
                anchor = hero || main;
                index = anchor ? anchor.start : -1;
            } else if (position === 'after-hero') {
                index = hero ? hero.end : -1;
            } else if (position === 'content-middle') {
                const sections = elementsByClass(html, 'section', 'category-section');
                if (sections.length > 1) index = sections[Math.floor((sections.length - 1) / 2)].end;
                else {
                    const grid = findElementByClass(html, 'div', 'items-grid', main && main.openEnd)
                        || findElementByClass(html, 'div', 'games-grid', main && main.openEnd)
                        || findElementByClass(html, 'div', 'grid');
                    const cards = grid ? directHtmlElementChildren(html, grid).filter(function(child) { return !/\bid=["']adv[123]/i.test(child.openTag || ''); }) : [];
                    if (cards.length) {
                        index = cards[Math.max(0, Math.ceil(cards.length / 2) - 1)].end;
                        markup = '<div data-sitefoundry-middle-ad style="grid-column:1 / -1;flex-basis:100%;width:100%;min-width:0;order:0;">' + markup + '</div>';
                    } else index = detailContentMiddleIndex(html, main || hero || findFirstElement(html, 'body'));
                }
            } else if (position === 'content-top' || position === 'content-bottom') {
                const container = main && findElementByClass(html, 'div', 'container', main.openEnd);
                const target = container && container.start < main.end ? container : main;
                index = position === 'content-top' ? (target ? target.openEnd : -1) : closeStart(html, target, target === main ? 'main' : 'div');
            } else if (/^after-section-\d+$/.test(position)) {
                const sectionIndex = parseInt(position.replace('after-section-', ''), 10);
                let sections = elementsByClass(html, 'section', 'category-section');
                if (!sections.length && options && options.finishedSite && main) {
                    sections = directHtmlElementChildren(html, main).filter(function(child) { return child.tag === 'section'; });
                }
                index = sections[sectionIndex] ? sections[sectionIndex].end : -1;
                if (index < 0 && options && options.batchPolicy && !sections.length) {
                    // Some exported grid sites have no category-section at all:
                    // their original banner2/3 gaps survive as empty ad-slot
                    // wrappers after the old ad container is removed.
                    const footer = findFooter(html);
                    const slots = elementsByClass(html, 'div', 'ad-slot').filter(function(slot) {
                        return !footer || slot.start < footer.start;
                    });
                    const slot = slots[sectionIndex];
                    index = slot ? closeStart(html, slot, 'div') : -1;
                }
            }
        } else {
            const detailPage = findElementByClass(html, 'div', 'detail-page') || findElementByClass(html, 'main', 'detail-page') || (options && options.finishedSite ? findFirstElement(html, 'main') || findFirstElement(html, 'article') : null);
            const detailContent = findElementByClass(html, 'div', 'detail-content') || findElementByClass(html, 'article', 'detail-content') || (options && (options.finishedSite || options.batchPolicy) ? findElementByClass(html, 'div', 'prose') || findElementByClass(html, 'article', 'prose') || findElementByClass(html, 'div', 'article-content') || findFirstElement(html, 'article') : null);
            const related = relatedElement(html);
            if (position === 'after-navbar') {
                // Legacy detail pages may have no detail-page wrapper, but a
                // semantic nav still gives an exact, safe top-of-content gap.
                const nav = detailPage ? null : findNavigationElement(html);
                index = detailPage ? detailPage.start
                    : nav && nav.end > 0 && (!detailContent || nav.end <= detailContent.start) ? nav.end : -1;
            }
            else if (position === 'detail-before-content') index = detailContent ? detailContent.start : -1;
            else if (position === 'detail-after-content' || position === 'detail-middle') index = detailContentMiddleIndex(html, detailContent);
            else if (position === 'detail-before-related') index = related ? related.start : -1;
            else if (position === 'detail-after-related') index = related ? related.end : -1;
            else if (/^detail-between-p-\d+$/.test(position) && detailContent) {
                const paragraphNumber = parseInt(position.replace('detail-between-p-', ''), 10);
                const paragraphPattern = /<p\b[^>]*>/gi;
                paragraphPattern.lastIndex = detailContent.openEnd;
                let paragraph = null;
                for (let p = 0; p < paragraphNumber; p++) {
                    paragraph = paragraphPattern.exec(html);
                    if (!paragraph || paragraph.index >= detailContent.end) break;
                }
                index = paragraph && paragraph.index < detailContent.end
                    ? findMatchingElementEnd(html, paragraph.index, 'p')
                    : -1;
            }
        }

        if (index < 0) {
            return {
                html: html,
                error: issue((pageType === 'home' ? '首页' : '详情页') + '无法定位广告位置 ' + position + '。', 'AD_POLICY_POSITION_NOT_FOUND')
            };
        }
        return { html: insertAt(html, index, markup), error: null, index: index, markup: markup };
    }

    /**
     * 预览候选位直接使用导出的定位器，无法定位的选项不展示。
     * 先独立计算所有索引，再从后往前插入，避免候选按钮改变后续 DOM 路径。
     * 返回的按钮只进入 iframe，绝不传入站点导出数据。
     */
    function previewPlacementHtml(source, page, candidates, occupied) {
        if (['home', 'detail', 'all'].indexOf(page) === -1) return source;
        const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const options = { batchPolicy: true, listingPage: page === 'all', previewMarkup: '<!-- SF_POLICY_PREVIEW -->' };
        // 原站位置注释、现有广告和空白不构成新的内容间隙，避免同一位置以不同名称重复出现。
        const gapKey = index => removeExistingAds(source.slice(0, index)).replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, '');
        const blocked = new Set((occupied || []).map(position => insertPlacement(source, page, position, [], options).index).filter(index => index != null).map(gapKey));
        const markers = [];
        (candidates || []).forEach(function(candidate) {
            if (!isAllowedPlacement(candidate.position, allowedPagePositions(page)) || candidate.position === 'off') return;
            const markup = '<button type="button" class="sf-policy-place sf-policy-common" data-policy-position="' + escape(candidate.position) + '" title="点击在此放置广告">＋ 常用广告位 · ' + escape(candidate.label) + '</button>';
            const placed = insertPlacement(source, page, candidate.position, [], Object.assign({}, options, { previewMarkup: markup }));
            if (placed.error || placed.index == null || blocked.has(gapKey(placed.index))) return;
            blocked.add(gapKey(placed.index));
            markers.push(placed);
        });
        return markers.sort((a, b) => b.index - a.index).reduce((html, marker) => insertAt(html, marker.index, marker.markup), source);
    }

    function injectAdScripts(html, scriptPath) {
        const scripts = '<script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js" crossorigin="anonymous"></script>\n    <script defer src="' + scriptPath + '"></script>';
        const closingHead = html.search(/<\/head\s*>/i);
        return closingHead === -1 ? html : insertAt(html, closingHead, scripts);
    }

    function countMatches(source, pattern) {
        const matches = String(source || '').match(pattern);
        return matches ? matches.length : 0;
    }

    function validateRestoredHtml(html, pageType, scriptPath, requestedPolicy, options) {
        const errors = [];
        const policy = normalizePolicy(requestedPolicy);
        if (options && options.finishedSite && typeof FinishedSiteAds !== 'undefined' && typeof DOMParser !== 'undefined') {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            FinishedSiteAds.validatePlacements(doc, policy.slots[pageType]).forEach(function(message) {
                errors.push(issue(message, 'AD_EXPORT_PLACEMENT_INVALID'));
            });
        }
        const visibleHtml = String(html || '').replace(/<!--[\s\S]*?-->/g, '')
            .replace(/(<script\b[^>]*>)[\s\S]*?(<\/script\s*>)/gi, '$1$2').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
        const escapedPath = scriptPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (countMatches(visibleHtml, /<script\b[^>]*\bsrc=["']https:\/\/securepubads\.g\.doubleclick\.net\/tag\/js\/gpt\.js["'][^>]*>/gi) !== 1) {
            errors.push(issue('页面 GPT 脚本数量不是 1。', 'RESTORE_GPT_COUNT'));
        }
        if (countMatches(visibleHtml, new RegExp('<script\\b[^>]*\\bsrc=["\\\']' + escapedPath + '["\\\'][^>]*>', 'gi')) !== 1) {
            errors.push(issue('页面 ad.js 引用数量不是 1。', 'RESTORE_AD_SCRIPT_COUNT'));
        }
        CONTAINER_IDS.forEach(function(id, index) {
            const key = 'banner' + (index + 1);
            const enabled = policy.slots[pageType].some(function(slot) { return slot.unit === key; });
            const count = countMatches(visibleHtml, new RegExp('\\bid\\s*=\\s*["\\\']' + id + '["\\\']', 'gi'));
            if (count !== (enabled ? 1 : 0)) errors.push(issue(id + ' 可见容器数量为 ' + count + '，应为 ' + (enabled ? 1 : 0) + '。', 'RESTORE_CONTAINER_COUNT'));
        });
        const orderedDefaults = pageType === 'home'
            ? policy.slots.home[0].unit === 'banner1' && policy.slots.home[0].position === 'after-navbar' && policy.slots.home[1].unit === 'banner2' && policy.slots.home[1].position === 'after-section-0' && policy.slots.home[2].unit === 'banner3' && policy.slots.home[2].position === 'after-section-1'
            : policy.slots.detail[0].unit === 'banner1' && policy.slots.detail[0].position === 'after-navbar' && policy.slots.detail[1].unit === 'banner2' && policy.slots.detail[1].position === 'detail-after-content' && policy.slots.detail[2].unit === 'banner3' && policy.slots.detail[2].position === 'footer-top';
        const p1 = visibleHtml.indexOf(CONTAINER_IDS[0]);
        const p2 = visibleHtml.indexOf(CONTAINER_IDS[1]);
        const p3 = visibleHtml.indexOf(CONTAINER_IDS[2]);
        if (orderedDefaults && !(p1 < p2 && p2 < p3)) errors.push(issue('三个 banner 的页面顺序不正确。', 'RESTORE_CONTAINER_ORDER'));
        const banner1Top = (policy.slots[pageType] || policy.slots.detail).some(function(slot) { return slot.unit === 'banner1' && slot.position === 'after-navbar'; });
        let detailStart = visibleHtml.search(/\bclass\s*=\s*["'][^"']*\bdetail-page\b/i);
        if (detailStart < 0 && options && options.finishedSite) {
            const semanticDetail = findFirstElement(visibleHtml, 'main') || findFirstElement(visibleHtml, 'article');
            detailStart = semanticDetail ? semanticDetail.start : -1;
        }
        if (!(options && options.finishedSite) && pageType === 'detail' && banner1Top && detailStart >= 0 && p1 > detailStart) {
            errors.push(issue('详情页第一个广告未恢复到正文容器之前。', 'RESTORE_DETAIL_FIRST_POSITION'));
        }
        return errors;
    }

    // A template's ad markup is part of its layout (spacing/classes/labels),
    // not just a place to regenerate the builder's standard ad wrapper.
    function originalAdElement(source, id) {
        const masked = String(source).replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<!--[\s\S]*?-->/gi, block => ' '.repeat(block.length));
        const match = new RegExp('<([a-z][\\w:-]*)\\b[^>]*\\bid\\s*=\\s*["\\\']' + id + '["\\\'][^>]*>', 'i').exec(masked);
        if (!match) return null;
        return { start: match.index, end: findMatchingElementEnd(source, match.index, match[1]) };
    }

    function restoreTemplateAdMarkup(html, source, slots) {
        slots.forEach(function(slot) {
            const origin = slot.position.match(ORIGINAL_PLACEMENT_PATTERN);
            if (!origin || slot.unit === 'off') return; // Manual placements remain independently editable.
            const oldId = 'adv' + origin[1], newId = 'adv' + slot.unit.replace('banner', '');
            const original = originalAdElement(source, oldId) || originalAdElement(source, 'div-gpt-ad-banner' + origin[1]);
            const generated = originalAdElement(html, newId);
            if (!original || !generated || original.end <= original.start) return;
            let markup = removeAdScripts(source.slice(original.start, original.end));
            if (oldId !== newId) markup = markup.replace(new RegExp('(\\bid\\s*=\\s*["\\\'])(?:' + oldId + '|div-gpt-ad-banner' + origin[1] + ')(["\\\'])', 'gi'), function(match, prefix, quote) {
                return prefix + (match.indexOf('div-gpt') >= 0 ? 'div-gpt-ad-' + slot.unit : newId) + quote;
            });
            html = html.slice(0, generated.start) + markup + html.slice(generated.end);
        });
        return html;
    }

    function restoreHtml(source, pageType, scriptPath, requestedPolicy, options) {
        const policy = normalizePolicy(requestedPolicy);
        let html = removeAdScripts(removeExistingAds(source));
        const errors = validatePolicy(policy);
        const adjusted = [];

        const groups = {};
        policy.slots[pageType].forEach(function(slot) {
            const position = slot.position;
            if (slot.unit === 'off') return;
            if (!groups[position]) groups[position] = [];
            groups[position].push('adv' + slot.unit.replace('banner', ''));
        });
        Object.keys(groups).forEach(function(position) {
            if (errors.length) return;
            const placed = insertPlacement(html, pageType, position, groups[position], options);
            html = placed.html;
            if (placed.error) errors.push(placed.error);
            if (placed.adjusted) placed.adjusted.forEach(function(unit) {
                if (adjusted.indexOf(unit) === -1) adjusted.push(unit);
            });
        });
        if (options && options.preserveTemplateContainers) html = restoreTemplateAdMarkup(html, source, policy.slots[pageType]);

        // A manual position can resolve to the same gap on a shorter sibling
        // page. Move only the later ad to the nearest safe semantic boundary;
        // do not fail the whole export merely because templates vary slightly.
        if (!errors.length && options && options.finishedSite && typeof DOMParser !== 'undefined'
            && typeof FinishedSiteAds !== 'undefined' && FinishedSiteAds.repairPlacements) {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const repair = { skipped: [], adjusted: [] };
            FinishedSiteAds.repairPlacements(doc, policy.slots[pageType], repair);
            repair.skipped.forEach(function(item) {
                errors.push(issue(item.unit + '：' + item.reason, 'AD_EXPORT_PLACEMENT_SEPARATION_FAILED'));
            });
            if (!repair.skipped.length) {
                adjusted.push.apply(adjusted, repair.adjusted);
                FinishedSiteAds.installLayout(doc);
                html = FinishedSiteAds.serialize(doc);
            }
        }

        if (policy.writeDisabledComments) {
            ['banner1', 'banner2', 'banner3'].forEach(function(key, index) {
                if (policy.slots[pageType].some(function(slot) { return slot.unit === key; })) return;
                const footer = findFooter(html);
                const bodyClose = html.search(/<\/body\s*>/i);
                const insertIndex = footer ? footer.start : bodyClose;
                if (insertIndex >= 0) html = insertAt(html, insertIndex, disabledBannerComment('adv' + (index + 1), pageType));
                else errors.push(issue('页面缺少 footer 或 </body>，无法写入禁用广告注释。', 'AD_POLICY_COMMENT_ANCHOR'));
            });
        }

        html = injectAdScripts(html, scriptPath);
        // Keep policy output responsive and remove the prior copy on re-import.
        html = html.replace(/<script\b[^>]*data-sitefoundry-ad-layout[^>]*>[\s\S]*?<\/script>/gi, '');
        if (typeof AdMigration !== 'undefined' && AdMigration.layoutRuntimeSource) {
            html = html.replace(/<\/body\s*>/i, '<script data-sitefoundry-ad-layout>' + AdMigration.layoutRuntimeSource() + '</script></body>');
        }
        if (!/<\/head\s*>/i.test(source)) errors.push(issue('页面缺少 </head>，无法恢复广告脚本。', 'RESTORE_HEAD_MISSING'));
        if (policy.slots.all) {
            // 运行时使用明确页面类型，避免把列表页的插屏/锚点开关并入详情页。
            html = html.replace(/<html\b([^>]*)>/i, function(match, attrs) {
                return '<html' + attrs.replace(/\sdata-sitefoundry-ad-page=["'][^"']*["']/gi, '') + ' data-sitefoundry-ad-page="' + pageType + '">';
            });
        }
        if (!errors.length) errors.push.apply(errors, validateRestoredHtml(html, pageType, scriptPath, policy, options));
        // 移除旧容器后只会留下空白行；统一收敛，保证重复恢复不会不断增加空白。
        html = html.replace(/^[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n')
            .replace(/\s+(<div id="adv[123]")/g, '\n    $1');
        return { valid: errors.length === 0, errors: errors, html: html, adjusted: adjusted };
    }

    function textBytes(text) {
        return new TextEncoder().encode(String(text || ''));
    }

    function restoreDynamicHomeAds(entries, metadata, requestedPolicy) {
        const errors = [];
        const changedScripts = [];
        const policy = normalizePolicy(requestedPolicy);
        const siteRoot = metadata.siteRoot || '';
        const adPath = (metadata.adPath || '').toLowerCase();
        const dynamicHomeAds = {};
        policy.slots.home.forEach(function(slot) {
            if (slot.unit === 'off' || slot.position === 'footer-top') return;
            const home = entries.find(function(entry) { return entry.path === metadata.homePath; });
            const sections = home ? elementsByClass(entryText(home), 'section', 'category-section') : [];
            const position = slot.position === 'content-middle' ? 'after-section-' + Math.max(0, Math.floor((sections.length - 1) / 2)) : slot.position;
            dynamicHomeAds[position] = (dynamicHomeAds[position] || '') + template('adv' + slot.unit.replace('banner', ''));
        });
        const standardHomeAds = JSON.stringify(dynamicHomeAds);

        entries.forEach(function(entry) {
            const lowerPath = entry.path.toLowerCase();
            if (!/\.js$/i.test(entry.path) || lowerPath === adPath || entry.path.indexOf(siteRoot) !== 0) return;
            const source = entryText(entry);
            const rewritesHome = /\.main-content\s+\.container/.test(source)
                && /\.innerHTML\s*=\s*['"]{2}/.test(source)
                && /\bCONFIG\.homeAds\b/.test(source);
            if (!rewritesHome) return;

            const homeAdsPattern = /(\bhomeAds\s*:\s*)\{[\s\S]*?\}(?=\s*[,}])/;
            if (!homeAdsPattern.test(source)) {
                errors.push(issue(entry.path + '：检测到首页动态重绘，但无法更新 homeAds 配置。', 'RESTORE_DYNAMIC_HOME_ADS'));
                return;
            }
            entry.bytes = textBytes(source.replace(homeAdsPattern, '$1' + standardHomeAds));
            changedScripts.push(entry.path);

            const homeEntry = entries.find(function(candidate) { return candidate.path === metadata.homePath; });
            const relativeScriptPath = entry.path.slice(siteRoot.length);
            if (homeEntry && relativeScriptPath) {
                const escapedScriptPath = relativeScriptPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const scriptPattern = new RegExp('(<script\\b[^>]*\\bsrc\\s*=\\s*)(["\\\'])' + escapedScriptPath + '(?:\\?[^"\\\']*)?\\2', 'gi');
                const homeSource = entryText(homeEntry).replace(scriptPattern, function(match, prefix, quote) {
                    return prefix + quote + relativeScriptPath + (requestedPolicy ? '?v=ad-policy-1' : '?v=ads-restored-1') + quote;
                });
                homeEntry.bytes = textBytes(homeSource);
            }
        });

        return { errors: errors, changedScripts: changedScripts };
    }

    function generateRecognizedAdCode(config, archiveName) {
        const p = config || {};
        const lines = [
            '// 由批量建站工具从源站已有及注释代码中识别',
            '// 源文件：' + String(archiveName || '未知'),
            "googletag.defineSlot(" + JSON.stringify(p.bannerPath1 || '') + ", [[300, 250]], 'div-gpt-ad-banner1').addService(googletag.pubads());",
            "googletag.defineSlot(" + JSON.stringify(p.bannerPath2 || '') + ", [[300, 250]], 'div-gpt-ad-banner2').addService(googletag.pubads());",
            "googletag.defineSlot(" + JSON.stringify(p.bannerPath3 || '') + ", [[300, 250]], 'div-gpt-ad-banner3').addService(googletag.pubads());",
            "googletag.defineSlot(" + JSON.stringify(p.interstitialPath || '') + ", [[320, 480]], 'div-gpt-ad-interstitial').addService(googletag.pubads());",
            "googletag.defineSlot(" + JSON.stringify(p.anchorPath || '') + ", [320, 50], 'div-gpt-ad-anchor').addService(googletag.pubads());"
        ];
        if (p.analyticsID) lines.push("gtag('config', " + JSON.stringify(p.analyticsID) + ');');
        return lines.join('\n') + '\n';
    }

    function recognizedCodeFileName(metadata) {
        const base = (metadata && metadata.detectedHost) || archiveBaseName(metadata && metadata.archiveName) || 'recognized-ad-code';
        return String(base).replace(/[^A-Za-z0-9._-]+/g, '-') + '-ad-code.txt';
    }

    function hasExternalBannerConfig(config) {
        return !!(config && (config.bannerPath1 || config.bannerPath2 || config.bannerPath3));
    }

    function disablePolicyAdPaths(adSource, policy, adRuntimeFormat) {
        let output = String(adSource || '');
        if (!policy.writeDisabledComments) return output;
        const enabledOnAnyPage = function(unit) {
            return policyPages(policy).some(function(page) {
                return policy.slots[page].some(function(slot) { return slot.unit === unit; });
            });
        };
        const disabled = [
            ['bannerPath1', !enabledOnAnyPage('banner1')],
            ['bannerPath2', !enabledOnAnyPage('banner2')],
            ['bannerPath3', !enabledOnAnyPage('banner3')],
            ['interstitialPath', !policyPages(policy).some(function(page) { return policy.outOfPage.interstitial[page]; })],
            ['anchorPath', !policyPages(policy).some(function(page) { return policy.outOfPage.anchor[page]; })]
        ];
        disabled.forEach(function(pair) {
            if (!pair[1]) return;
            const key = adRuntimeFormat === 'ad-unit' ? CONFIG_ALIASES[pair[0]] : pair[0];
            const declaration = new RegExp('^const ' + key + ' = [^\\r\\n]*;', 'm');
            output = output.replace(declaration, function(line) {
                // Keep a defined empty variable because the shared runtime
                // still references these names even when the slots are off.
                return '// ' + line + '\nconst ' + key + ' = "";';
            });
        });
        return output;
    }

    function generateAdUnitPolicySource(config, policy, version) {
        const source = Generator.generateSelectedAdJs(config || {}, version);
        const interstitial = policy.outOfPage.interstitial;
        const anchor = policy.outOfPage.anchor;
        const interstitialGate = 'if (isIndex && adUnitInterstitial) {';
        const anchorGate = 'if (adUnitAnchor) {';
        if (!source.includes(interstitialGate) || !source.includes(anchorGate)) return null;
        // v1.0.2.1 默认策略保留模板原有简写；自定义页面范围仍按策略添加条件，
        // 避免简化写法时改变首页/详情页的插屏和锚点开关。其他版本保持原输出。
        const keepDefaultGates = version === 'v1.0.2.1';
        const interstitialCondition = keepDefaultGates && interstitial.home && !interstitial.detail
            ? interstitialGate
            : 'if (adUnitInterstitial && (isIndex ? ' + interstitial.home + ' : ' + interstitial.detail + ')) {';
        const anchorCondition = keepDefaultGates && anchor.home && anchor.detail
            ? anchorGate
            : 'if (adUnitAnchor && (isIndex ? ' + anchor.home + ' : ' + anchor.detail + ')) {';
        if (policy.slots.all && (interstitial.all !== interstitial.detail || anchor.all !== anchor.detail)) {
            const scopedGate = function(name, values) {
                return 'if (' + name + ' && (isIndex ? ' + values.home + ' : document.documentElement.getAttribute("data-sitefoundry-ad-page") === "all" ? ' + values.all + ' : ' + values.detail + ')) {';
            };
            return source.replace(interstitialGate, scopedGate('adUnitInterstitial', interstitial))
                .replace(anchorGate, scopedGate('adUnitAnchor', anchor));
        }
        return source
            .replace(interstitialGate, interstitialCondition)
            .replace(anchorGate, anchorCondition);
    }

    function generateInitialPolicySource(config, policy) {
        const source = Generator.generateSelectedAdJs(config || {}, 'initial');
        const interstitialGate = 'if (isIndex && interstitialPath) {';
        const anchorGate = 'if (anchorPath) {';
        if (!source.includes(interstitialGate) || !source.includes(anchorGate)) return null;
        if (policy.slots.all) {
            const scopedGate = function(name, values) {
                return 'if (' + name + ' && (isIndex ? ' + values.home + ' : document.documentElement.getAttribute("data-sitefoundry-ad-page") === "all" ? ' + values.all + ' : ' + values.detail + ')) {';
            };
            return source.replace(interstitialGate, scopedGate('interstitialPath', policy.outOfPage.interstitial))
                .replace(anchorGate, scopedGate('anchorPath', policy.outOfPage.anchor));
        }
        return source
            .replace(interstitialGate,
                'if (interstitialPath && (isIndex ? ' + policy.outOfPage.interstitial.home + ' : ' + policy.outOfPage.interstitial.detail + ')) {')
            .replace(anchorGate,
                'if (anchorPath && (isIndex ? ' + policy.outOfPage.anchor.home + ' : ' + policy.outOfPage.anchor.detail + ')) {');
    }

    function restoreEntries(rawEntries, config, archiveName, requestedPolicy, options) {
        const policyMode = !!requestedPolicy;
        const policy = normalizePolicy(requestedPolicy);
        const entries = (rawEntries || []).map(function(entry) {
            return { path: normalizePath(entry.path || entry.name), bytes: entry.bytes ? new Uint8Array(entry.bytes) : textBytes(entryText(entry)) };
        }).filter(function(entry) { return isSafePath(entry.path); });
        const metadata = inspectSiteEntries(entries, archiveName, options);
        if (hasExternalBannerConfig(config)) {
            metadata.errors = metadata.errors.filter(function(error) { return error.code !== 'RESTORE_EMBEDDED_CONFIG_INCOMPLETE'; });
            metadata.valid = metadata.errors.length === 0;
            metadata.embeddedConfig = Object.assign({}, config);
            metadata.detectedHost = detectedHost(config) || metadata.detectedHost;
        }
        if (!metadata.valid) return { valid: false, errors: metadata.errors, warnings: metadata.warnings, entries: entries, metadata: metadata };
        const policyErrors = validatePolicy(policy);
        if (policyErrors.length) return { valid: false, errors: policyErrors, warnings: metadata.warnings, entries: entries, metadata: metadata, policy: policy };
        if (options && options.batchPolicy && !metadata.adJsVersion) {
            return {
                valid: false,
                errors: [issue('无法可靠识别该站点的 js/ad.js 版本；为避免恢复或限流时替换成错误模板，已阻止导出。', 'RESTORE_AD_VERSION_UNKNOWN')],
                warnings: metadata.warnings,
                entries: entries,
                metadata: metadata,
                policy: policy
            };
        }

        const byPath = {};
        entries.forEach(function(entry) { byPath[entry.path.toLowerCase()] = entry; });
        const pageErrors = [];
        const changedPages = [];
        const adjustedPages = [];
        const outputWarnings = (metadata.warnings || []).slice();

        function finishedContentType(path, entry) {
            if (!(options && options.finishedSite) || typeof FinishedSiteAds === 'undefined') return 'detail';
            let doc = null;
            if (typeof DOMParser !== 'undefined' && entry) doc = new DOMParser().parseFromString(entryText(entry), 'text/html');
            const type = FinishedSiteAds.contentPageType(path, doc, metadata.homePath);
            return policy.slots[type] ? type : 'detail';
        }
        const pages = [{ path: metadata.homePath, type: 'home' }].concat(metadata.detailPaths.map(function(path) {
            const entry = byPath[path.toLowerCase()];
            return { path: path, type: finishedContentType(path, entry) };
        })).concat((metadata.listingPaths || []).map(function(path) {
            const entry = byPath[path.toLowerCase()];
            return { path: path, type: policy.slots.all ? 'all' : finishedContentType(path, entry), listingPage: true };
        })).filter(function(page, index, values) {
            if (!page.path) return false;
            if (options && options.finishedSite && !isFinishedSiteDeployablePath(page.path, options.project)) return false;
            return values.findIndex(function(other) { return other.path.toLowerCase() === page.path.toLowerCase(); }) === index;
        });
        pages.forEach(function(page) {
            const entry = byPath[page.path.toLowerCase()];
            if (!entry) return;
            const scriptPath = relativeAdScriptPath(page.path, metadata.siteRoot) + (policyMode ? '?v=ad-policy-1' : '');
            const result = restoreHtml(entryText(entry), page.type, scriptPath, policy, Object.assign({}, options, { listingPage: !!page.listingPage }));
            if (!result.valid) {
                result.errors.forEach(function(error) {
                    pageErrors.push(issue(page.path + '：' + error.message, error.code));
                });
                return;
            }
            entry.bytes = textBytes(result.html);
            changedPages.push(page.path);
            if (result.adjusted && result.adjusted.length) {
                adjustedPages.push({ path: page.path, pageType: page.type, units: result.adjusted.slice() });
                outputWarnings.push(issue(page.path + '：页面结构与示例页不同，已把 ' + result.adjusted.join('、') + ' 调整到最近的安全内容间隙。', 'AD_EXPORT_PLACEMENT_ADJUSTED'));
            }
        });

        if (pageErrors.length) return { valid: false, errors: pageErrors, warnings: outputWarnings, entries: entries, metadata: metadata };

        const dynamicPolicy = options && options.dynamicHomePolicy || (policyMode ? policy : null);
        const dynamicHomeResult = restoreDynamicHomeAds(entries, metadata, dynamicPolicy);
        if (dynamicHomeResult.errors.length) {
            return { valid: false, errors: dynamicHomeResult.errors, warnings: metadata.warnings, entries: entries, metadata: metadata };
        }
        if (typeof Generator === 'undefined' || typeof Generator.generateAdJs !== 'function') {
            return { valid: false, errors: [issue('建站器广告模板未加载。', 'RESTORE_GENERATOR_UNAVAILABLE')], warnings: metadata.warnings, entries: entries, metadata: metadata };
        }

        const useBatchPolicyTemplate = !!(options && options.batchPolicy);
        // 批量策略默认沿用源站版本；只有显式选择时才统一切换模板。
        // 广告路径仍来自该站 config，版本切换不会在站点之间共享配置。
        const requestedBatchVersion = normalizeBatchAdJsVersionMode(options && options.batchAdJsVersion);
        const outputAdJsVersion = useBatchPolicyTemplate && requestedBatchVersion !== 'original'
            ? requestedBatchVersion : metadata.adJsVersion;
        if ((useBatchPolicyTemplate || (options && options.finishedSite && options.adJsVersion))
            && typeof Generator.generateSelectedAdJs !== 'function') {
            return { valid: false, errors: [issue('所需的 ad.js 版本模板未加载。', 'RESTORE_VERSION_GENERATOR_UNAVAILABLE')], warnings: metadata.warnings, entries: entries, metadata: metadata };
        }
        let generatedAdSource;
        try {
            generatedAdSource = useBatchPolicyTemplate
                ? outputAdJsVersion === 'initial'
                    ? generateInitialPolicySource(config, policy)
                    : generateAdUnitPolicySource(config, policy, outputAdJsVersion)
                : options && options.finishedSite && options.adJsVersion
                    ? Generator.generateSelectedAdJs(config || {}, options.adJsVersion)
                    : Generator.generateAdJs(config || {}, policyMode ? policy : null);
        } catch (error) {
            return {
                valid: false,
                errors: [issue('无法生成 ad.js ' + (outputAdJsVersion || metadata.adJsVersion || '版本') + ' 模板：' + (error && error.message ? error.message : '模板生成失败。'), 'RESTORE_AD_VERSION_TEMPLATE_FAILED')],
                warnings: metadata.warnings,
                entries: entries,
                metadata: metadata
            };
        }
        if (generatedAdSource == null) {
            return { valid: false, errors: [issue('识别到的 ad.js 模板结构已变化，无法安全应用批量广告策略。', 'RESTORE_NEW_TEMPLATE_UNSUPPORTED')], warnings: metadata.warnings, entries: entries, metadata: metadata };
        }
        const outputAdRuntimeFormat = useBatchPolicyTemplate
            ? outputAdJsVersion === 'initial' ? 'legacy' : 'ad-unit'
            : metadata.adRuntimeFormat;
        const adSource = policyMode && options && options.batchPolicy
            ? disablePolicyAdPaths(generatedAdSource, policy, outputAdRuntimeFormat) : generatedAdSource;
        const adKey = metadata.adPath.toLowerCase();
        if (byPath[adKey]) byPath[adKey].bytes = textBytes(adSource);
        else entries.push({ path: metadata.adPath, bytes: textBytes(adSource) });

        if (policyMode) {
            const manifestPath = metadata.siteRoot + 'ad-policy.json';
            const manifest = {
                schema: 'sitefoundry-ad-policy/v1',
                generatedAt: new Date().toISOString(),
                source: archiveName || metadata.detectedHost || 'site-directory',
                host: metadata.detectedHost,
                adRuntimeFormat: outputAdRuntimeFormat,
                adPaths: config || {},
                policy: policy,
                ...(options && options.originalPlacements ? { originalPlacements: options.originalPlacements } : {}),
                ...(options && options.batchPolicy ? {
                    sourceAdJsVersion: metadata.adJsVersion,
                    adJsVersion: outputAdJsVersion
                } : {}),
                ...(options && options.finishedSite && options.adJsVersion ? { adJsVersion: options.adJsVersion, placementMode: 'manual' } : {})
            };
            const existingManifest = entries.find(function(entry) { return entry.path.toLowerCase() === manifestPath.toLowerCase(); });
            if (existingManifest) existingManifest.bytes = textBytes(JSON.stringify(manifest, null, 2) + '\n');
            else entries.push({ path: manifestPath, bytes: textBytes(JSON.stringify(manifest, null, 2) + '\n') });
        }

        return {
            valid: true,
            errors: [],
            warnings: outputWarnings,
            entries: entries,
            metadata: metadata,
            changedPages: changedPages,
            adjustedPages: adjustedPages,
            changedScripts: dynamicHomeResult.changedScripts,
            restoredConfig: config || {},
            sourceAdJsVersion: metadata.adJsVersion,
            adJsVersion: outputAdJsVersion,
            policy: policy
        };
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

    function extractTarEntries(buffer) {
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
            const body = bytes.slice(bodyStart, bodyEnd);
            const path = normalizePath(pendingPath || (prefix ? prefix + '/' + name : name));
            pendingPath = '';
            if (type === 'x' || type === 'g') pendingPath = paxPath(body);
            else if (type === 'L') pendingPath = tarText(body).replace(/\0.*$/, '');
            else if ((type === '\0' || type === '0' || type === '7') && isSafePath(path)) entries.push({ path: path, bytes: body });
            offset = bodyStart + Math.ceil(size / 512) * 512;
        }
        return entries;
    }

    function archiveType(fileName) {
        const lower = String(fileName || '').toLowerCase();
        if (/\.zip$/.test(lower)) return 'zip';
        if (/\.(?:tar\.gz|tgz)$/.test(lower)) return 'tar-gz';
        if (/\.tar$/.test(lower)) return 'tar';
        if (/\.(?:rar|7z)$/.test(lower)) return 'archive-runtime';
        return '';
    }

    function waitForArchiveOperation(operation, timeoutMs, timeoutMessage, worker) {
        // 单元测试和部分嵌入式 WebView 不提供 timer；此时仍执行解析，只省略超时兜底。
        if (typeof setTimeout !== 'function' || typeof clearTimeout !== 'function') return Promise.resolve(operation);
        function terminateWorker() {
            if (!worker || typeof worker.terminate !== 'function') return;
            try { worker.terminate(); } catch (_) {}
        }
        let timer = 0;
        const timeout = new Promise(function(_, reject) {
            timer = setTimeout(function() {
                terminateWorker();
                reject(new Error(timeoutMessage));
            }, timeoutMs);
        });
        let onWorkerError = null;
        let workerFailure = null;
        if (worker && typeof worker.addEventListener === 'function') {
            workerFailure = new Promise(function(_, reject) {
                onWorkerError = function(event) {
                    if (event && typeof event.preventDefault === 'function') event.preventDefault();
                    const detail = event && (event.message || event.type);
                    terminateWorker();
                    reject(new Error('压缩包解析 Worker 出错' + (detail ? '：' + detail : '。')));
                };
                worker.addEventListener('error', onWorkerError, { once: true });
                worker.addEventListener('messageerror', onWorkerError, { once: true });
            });
        }
        const operations = [Promise.resolve(operation), timeout];
        if (workerFailure) operations.push(workerFailure);
        return Promise.race(operations).finally(function() {
            if (timer) clearTimeout(timer);
            if (onWorkerError && worker && typeof worker.removeEventListener === 'function') {
                worker.removeEventListener('error', onWorkerError);
                worker.removeEventListener('messageerror', onWorkerError);
            }
        });
    }

    // Bound cleanup too: a stuck close() must not block the RAR fallback or UI recovery.
    async function closeArchiveSafely(archive, fileName) {
        if (!archive || typeof archive.close !== 'function') return;
        try {
            await waitForArchiveOperation(
                archive.close(),
                5000,
                String(fileName || '压缩包') + ' 关闭解析 Worker 超时。',
                archive.worker
            );
        } catch (_) {
            if (archive.worker && typeof archive.worker.terminate === 'function') {
                try { archive.worker.terminate(); } catch (_) {}
            }
        }
    }

    function reportArchiveProgress(onStage, stage, percent) {
        if (typeof onStage !== 'function') return;
        if (percent === null || percent === undefined || !Number.isFinite(Number(percent))) {
            onStage(stage, null);
            return;
        }
        onStage(stage, Math.max(0, Math.min(100, Number(percent))));
    }

    // 浏览器 FileReader 能报告压缩包读取字节数；不支持时保留不定向状态，不伪造百分比。
    function readArchiveBytes(file, onStage, stage, progressLimit) {
        stage = stage || '正在读取压缩包数据…';
        progressLimit = Number.isFinite(Number(progressLimit)) ? Math.max(0, Math.min(100, Number(progressLimit))) : 12;
        if (typeof FileReader !== 'function' || !file || typeof file.slice !== 'function' || !Number.isFinite(Number(file.size))) {
            reportArchiveProgress(onStage, stage, null);
            return file && typeof file.arrayBuffer === 'function' ? file.arrayBuffer() : Promise.resolve(file);
        }

        return new Promise(function(resolve, reject) {
            const reader = new FileReader();
            reader.onprogress = function(event) {
                if (event && event.lengthComputable && event.total > 0) {
                    reportArchiveProgress(onStage, stage, progressLimit * event.loaded / event.total);
                }
            };
            reader.onload = function() { resolve(reader.result); };
            reader.onerror = function() { reject(reader.error || new Error('读取压缩包失败。')); };
            reader.onabort = function() { reject(new Error('压缩包读取已取消。')); };
            try {
                reader.readAsArrayBuffer(file);
            } catch (error) {
                reject(error);
            }
        });
    }

    function isIgnoredArchivePath(path) {
        return /(?:^|\/)(?:node_modules|\.git|\.vite|__MACOSX)(?:\/|$)/i.test(path);
    }

    function archiveErrorText(error, fallback) {
        if (typeof error === 'string' && error.trim()) return error.trim();
        if (error && typeof error.message === 'string' && error.message.trim()) return error.message.trim();
        if (error && typeof error.reason === 'string' && error.reason.trim()) {
            return error.reason.trim() + (error.file ? '（' + error.file + '）' : '');
        }
        if (error && typeof error.name === 'string' && error.name && error.name !== 'Error') return error.name;
        return fallback || '压缩包解析器没有返回具体错误。';
    }

    async function readRarWithOfficialFallback(file, onStage) {
        if (typeof globalThis === 'undefined' || typeof globalThis.loadRarFallbackRuntime !== 'function') {
            throw new Error('RAR5 回退解析组件未加载。请刷新页面后重试。');
        }
        reportArchiveProgress(onStage, '内置解析器不兼容，正在切换 RAR5 / solid RAR 解析器…', null);
        const runtime = await waitForArchiveOperation(
            globalThis.loadRarFallbackRuntime(),
            90000,
            '加载 RAR5 / solid RAR 解析组件超时。请刷新页面后重试。'
        );
        reportArchiveProgress(onStage, '正在读取 RAR5 文件清单，并自动跳过 node_modules…', null);
        const data = await waitForArchiveOperation(
            readArchiveBytes(file, onStage, '正在读取 RAR5 压缩包数据…', 12),
            90000,
            '读取 RAR 文件超时。请重新选择文件后重试。'
        );
        const extractor = await waitForArchiveOperation(
            runtime.createExtractorFromData({
                data: data,
                wasmBinary: runtime.wasmBinary
            }),
            90000,
            '打开 RAR5 压缩包超时。请确认压缩包未加密且不是分卷压缩包。'
        );
        let headers;
        try {
            headers = [];
            let listed = 0;
            const fileHeaders = extractor.getFileList().fileHeaders || [];
            for (const header of fileHeaders) {
                headers.push(header);
                listed += 1;
                if (listed % 256 === 0) {
                    reportArchiveProgress(onStage, '正在读取 RAR5 文件清单：' + listed + ' 项…', null);
                    // 清单按迭代器逐项生成；分批让出主线程，避免大清单期间界面失去响应。
                    if (typeof setTimeout === 'function') await new Promise(function(resolve) { setTimeout(resolve, 0); });
                }
            }
        } catch (error) {
            throw new Error('RAR5 文件清单读取失败：' + archiveErrorText(error));
        }
        const candidates = headers.filter(function(header) {
            const path = normalizePath(header && header.name);
            return header && !header.flags?.directory && isSafePath(path) && !isIgnoredArchivePath(path);
        });
        reportArchiveProgress(onStage, '目录读取完成：共 ' + headers.length + ' 项，正在提取 ' + candidates.length + ' 个源码文件…', 16);
        if (!candidates.length) throw new Error('RAR 文件清单中没有可提取的普通文件；该压缩包可能为空、已加密、已损坏或缺少分卷。');
        let extracted;
        try {
            reportArchiveProgress(onStage, '正在解压 RAR5 文件；解析器暂不提供内部百分比…', null);
            extracted = extractor.extract({ files: candidates.map(function(header) { return header.name; }) });
        } catch (error) {
            throw new Error('RAR5 源码提取失败：' + archiveErrorText(error));
        }
        const entries = [];
        let completed = 0;
        const extractionStart = 16;
        const extractionRange = 80;
        const reportEvery = Math.max(1, Math.ceil(candidates.length / 60));
        try {
            for (const item of extracted.files) {
                const path = normalizePath(item && item.fileHeader && item.fileHeader.name);
                if (item && item.extraction && isSafePath(path) && !isIgnoredArchivePath(path)) {
                    entries.push({ path: path, bytes: new Uint8Array(item.extraction) });
                    completed += 1;
                    if (completed === candidates.length || completed % reportEvery === 0) {
                        reportArchiveProgress(onStage, '正在提取并整理 RAR5 源码文件：' + completed + ' / ' + candidates.length + '…', extractionStart + extractionRange * completed / candidates.length);
                        // RAR5 回退解析器逐文件同步解压；定期让出主线程，及时绘制进度变化。
                        if (completed < candidates.length && typeof setTimeout === 'function') {
                            await new Promise(function(resolve) { setTimeout(resolve, 0); });
                        }
                    }
                }
            }
        } catch (error) {
            throw new Error('RAR5 源码提取失败：' + archiveErrorText(error));
        }
        return entries;
    }

    async function readRarArchive(file, onStage) {
        // RAR/7z 运行时是按需加载的。成品站加广告不能假设普通数据导入已经先触发过它。
        onStage = typeof onStage === 'function' ? onStage : function() {};
        let archive = null;
        try {
            const runtime = typeof globalThis !== 'undefined'
                ? (globalThis.ArchiveRuntimeReady || (typeof globalThis.loadArchiveRuntime === 'function' ? globalThis.loadArchiveRuntime() : null))
                : null;
            if (!runtime) throw new Error('RAR 解析组件未加载。请刷新页面后重试。');
            reportArchiveProgress(onStage, '正在加载 RAR / 7Z 本地解析组件…', null);
            const Archive = await waitForArchiveOperation(runtime, 90000, '加载 RAR / 7Z 解析组件超时。请刷新页面后重试。');
            // libarchive 的打开和列目录阶段没有可用的进度事件，后续按实际完成的文件数报告。
            reportArchiveProgress(onStage, '正在打开 RAR / 7Z 压缩包…', null);
            const openError = '打开 RAR / 7Z 超时。该压缩包可能已损坏或包含过多文件；请重新压缩源码并排除 node_modules 后重试。';
            archive = typeof globalThis.openArchiveWithTimeout === 'function'
                ? await globalThis.openArchiveWithTimeout(Archive, file, 90000, openError)
                : await waitForArchiveOperation(Archive.open(file), 90000, openError);
            // 不先 extractFiles()：React 项目常将 node_modules 打进 RAR，完整解压会
            // 无谓占用内存。先读取目录，再按需解出真正会保留到导出副本的文件。
            reportArchiveProgress(onStage, '正在列出压缩包目录，并自动跳过 node_modules…', null);
            // libarchive 的 getFilesArray() 会先在主线程为数万个依赖文件递归构造完整树。
            // 真实运行时直接使用 worker 的清单，再只按需提取源码；测试替身仍可走旧接口。
            const canListDirectly = archive.client && typeof archive.client.listFiles === 'function' && typeof archive.extractSingleFile === 'function';
            const files = await waitForArchiveOperation(
                canListDirectly ? archive.client.listFiles() : archive.getFilesArray(),
                90000,
                '读取 RAR / 7Z 目录超时。该压缩包包含过多依赖文件；请重新压缩源码并排除 node_modules 后重试。',
                archive.worker
            );
            const candidates = (files || []).filter(function(entry) {
                const path = normalizePath(canListDirectly ? entry.path : String(entry.path || '') + String(entry.file && entry.file.name || ''));
                return (canListDirectly ? entry.type === 'FILE' : entry.file) && isSafePath(path) && !isIgnoredArchivePath(path);
            });
            reportArchiveProgress(onStage, '目录读取完成：共 ' + (files || []).length + ' 个文件，正在提取 ' + candidates.length + ' 个源码文件…', 12);
            if (!candidates.length) throw new Error('RAR 文件清单中没有可提取的普通文件；该压缩包可能为空、已加密、已损坏或缺少分卷。');

            const entries = [];
            const batchSize = 8;
            const reportEvery = Math.max(1, Math.ceil(candidates.length / 60));
            let completed = 0;
            let lastReported = 0;
            for (let start = 0; start < candidates.length; start += batchSize) {
                const batch = candidates.slice(start, start + batchSize);
                const extracted = await Promise.all(batch.map(async function(entry) {
                    const path = normalizePath(canListDirectly ? entry.path : String(entry.path || '') + String(entry.file && entry.file.name || ''));
                    const source = canListDirectly
                        ? await waitForArchiveOperation(archive.extractSingleFile(entry.path), 90000, '提取文件超时：' + path, archive.worker)
                        : (typeof entry.file.extract === 'function'
                            ? await waitForArchiveOperation(entry.file.extract(), 90000, '提取文件超时：' + path, archive.worker)
                            : entry.file);
                    const bytes = await waitForArchiveOperation(source.arrayBuffer(), 90000, '读取提取文件超时：' + path, archive.worker);
                    completed += 1;
                    if (completed === candidates.length || completed - lastReported >= reportEvery) {
                        lastReported = completed;
                        reportArchiveProgress(onStage, '正在提取源码文件：' + completed + ' / ' + candidates.length + '…', 12 + 84 * completed / candidates.length);
                    }
                    return { path: path, bytes: new Uint8Array(bytes) };
                }));
                entries.push.apply(entries, extracted);
            }
            return entries;
        } catch (error) {
            const isRar = /\.rar$/i.test(String(file && file.name || ''));
            if (archive && typeof archive.close === 'function') {
                await closeArchiveSafely(archive, file && file.name);
                archive = null;
            }
            if (isRar && typeof globalThis !== 'undefined' && typeof globalThis.loadRarFallbackRuntime === 'function') {
                try {
                    return await readRarWithOfficialFallback(file, onStage);
                } catch (fallbackError) {
                    throw new Error(
                        String(file && file.name || 'RAR 文件') + ' 读取失败。内置解析器：' + archiveErrorText(error) +
                        '；RAR5 / solid RAR 回退解析器：' + archiveErrorText(fallbackError) +
                        '。请确认文件未加密、未损坏且不是缺少卷的分卷压缩包。'
                    );
                }
            }
            throw new Error(String(file && file.name || '压缩包') + ' 读取失败：' + archiveErrorText(error));
        } finally {
            if (archive) await closeArchiveSafely(archive, file && file.name);
        }
    }

    async function readArchive(file, onStage) {
        const type = archiveType(file && file.name);
        if (!type) throw new Error('源文件仅支持 .zip、.rar、.7z、.tar、.tar.gz 或 .tgz。');
        if (type === 'zip') {
            if (typeof JSZip === 'undefined') throw new Error('ZIP 解析组件未加载。');
            const archiveData = await readArchiveBytes(file, onStage, '正在读取 ZIP 压缩包数据…', 12);
            const workerClient = globalThis.ZipArchiveWorkerClient;
            if (workerClient && typeof workerClient.read === 'function') {
                // 把 JSZip 的同步目录扫描移出主线程，确保不定向进度动画在大型压缩包上持续运行。
                reportArchiveProgress(onStage, '正在后台解析 ZIP 目录…', null);
                try {
                    const workerEntries = await workerClient.read(archiveData, function(stage, percent) {
                        reportArchiveProgress(onStage, stage, percent);
                    });
                    if (workerEntries) return workerEntries;
                } catch (error) {
                    if (!error || error.code !== 'ZIP_WORKER_UNAVAILABLE') throw error;
                    reportArchiveProgress(onStage, '后台解析器不可用，正在使用兼容模式读取 ZIP…', null);
                }
            }
            // 兼容不支持 Worker 的旧环境；JSZip 在该模式下不公开目录解析百分比。
            reportArchiveProgress(onStage, '正在解析 ZIP 目录…', null);
            const zip = await JSZip.loadAsync(archiveData);
            const paths = Object.keys(zip.files).filter(function(path) { return !zip.files[path].dir && isSafePath(path); });
            reportArchiveProgress(onStage, 'ZIP 目录读取完成：共 ' + paths.length + ' 个源码文件。', 12);
            if (!paths.length) {
                reportArchiveProgress(onStage, 'ZIP 文件提取完成：没有可读取的普通文件。', 96);
                return [];
            }
            const weights = paths.map(function(path) {
                const rawSize = zip.files[path] && zip.files[path]._data && Number(zip.files[path]._data.uncompressedSize);
                return Number.isFinite(rawSize) && rawSize > 0 ? rawSize : 1;
            });
            const totalWeight = weights.reduce(function(sum, weight) { return sum + weight; }, 0);
            const extractionProgress = paths.map(function() { return 0; });
            let lastProgress = 12;
            function reportZipExtraction(path, index, complete) {
                if (complete) extractionProgress[index] = 1;
                const weightedProgress = extractionProgress.reduce(function(sum, progress, progressIndex) {
                    return sum + weights[progressIndex] * progress;
                }, 0);
                const nextProgress = Math.max(lastProgress, 12 + 84 * weightedProgress / totalWeight);
                if (complete || nextProgress - lastProgress >= 0.35) {
                    lastProgress = nextProgress;
                    reportArchiveProgress(onStage, '正在解压源码文件：' + path, nextProgress);
                }
            }
            const entries = await Promise.all(paths.map(async function(path, index) {
                const bytes = await zip.files[path].async('uint8array', function(metadata) {
                    const percent = Number(metadata && metadata.percent);
                    if (!Number.isFinite(percent)) return;
                    extractionProgress[index] = Math.max(extractionProgress[index], Math.max(0, Math.min(100, percent)) / 100);
                    reportZipExtraction(path, index, false);
                });
                reportZipExtraction(path, index, true);
                return { path: normalizePath(path), bytes: bytes };
            }));
            reportArchiveProgress(onStage, 'ZIP 文件提取完成：共 ' + entries.length + ' 个源码文件。', 96);
            return entries;
        }
        if (type === 'archive-runtime') return readRarArchive(file, onStage);
        if (type === 'tar') {
            // Plain TAR has no compression layer; reuse the same path filtering
            // and PAX/long-name handling as the established TAR.GZ reader.
            const tarBytes = await readArchiveBytes(file, onStage, '正在读取 TAR 归档数据…', 80);
            const entries = extractTarEntries(tarBytes);
            reportArchiveProgress(onStage, 'TAR 文件提取完成：共 ' + entries.length + ' 个源码文件。', 96);
            return entries;
        }
        if (typeof DecompressionStream === 'undefined') throw new Error('当前浏览器不支持 TAR.GZ 解压，请使用新版 Chrome 或 Edge。');
        const stream = file.stream ? file.stream() : new Blob([await file.arrayBuffer()]).stream();
        let compressedBytes = 0;
        let inputStream = stream;
        const size = Number(file && file.size);
        if (typeof TransformStream === 'function' && Number.isFinite(size) && size > 0) {
            inputStream = stream.pipeThrough(new TransformStream({
                transform: function(chunk, controller) {
                    compressedBytes += chunk.byteLength || 0;
                    reportArchiveProgress(onStage, '正在读取并解压 TAR.GZ 数据…', Math.min(80, 80 * compressedBytes / size));
                    controller.enqueue(chunk);
                }
            }));
        } else {
            reportArchiveProgress(onStage, '正在读取并解压 TAR.GZ 数据…', null);
        }
        const decompressed = inputStream.pipeThrough(new DecompressionStream('gzip'));
        const tarBytes = await new Response(decompressed).arrayBuffer();
        reportArchiveProgress(onStage, 'GZIP 解压完成，正在读取 TAR 文件清单…', null);
        const entries = extractTarEntries(tarBytes);
        reportArchiveProgress(onStage, 'TAR 文件提取完成：共 ' + entries.length + ' 个源码文件。', 96);
        return entries;
    }

    function archiveBaseName(fileName) {
        return String(fileName || 'site').replace(/\.(?:tar\.gz|tgz|zip|rar|7z|tar)$/i, '');
    }

    function siteFolderName(value, fallback) {
        const parts = normalizePath(value).replace(/\/$/, '').split('/').filter(Boolean);
        return String(parts[parts.length - 1] || fallback || 'site').replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-');
    }

    function splitSiteEntries(rawEntries, options) {
        const entries = (rawEntries || []).map(function(entry) {
            return {
                path: normalizePath(entry.path || entry.name),
                bytes: entry.bytes ? new Uint8Array(entry.bytes) : textBytes(entryText(entry))
            };
        }).filter(function(entry) { return isSafePath(entry.path); });
        const roots = [];
        entries.forEach(function(entry) {
            if (!/(?:^|\/)index\.html?$/i.test(entry.path)) return;
            const root = entry.path.replace(/index\.html?$/i, '');
            if (roots.indexOf(root) === -1) roots.push(root);
        });
        roots.sort(function(a, b) { return a.split('/').length - b.split('/').length; });

        const sites = [];
        roots.forEach(function(root, index) {
            const subset = entries.filter(function(entry) { return !root || entry.path.indexOf(root) === 0; });
            const relativeEntries = subset.map(function(entry) {
                return { path: root ? entry.path.slice(root.length) : entry.path, bytes: entry.bytes };
            }).filter(function(entry) { return entry.path; });
            const name = siteFolderName(root, 'site-' + (index + 1));
            const metadata = inspectSiteEntries(relativeEntries, name, options);
            if (!metadata.homePath || !metadata.detailPaths.length) return;
            sites.push({
                id: root || name,
                name: name,
                sourceRoot: root,
                entries: relativeEntries,
                metadata: metadata
            });
        });

        return sites.filter(function(site, index) {
            return !sites.some(function(other, otherIndex) {
                return otherIndex !== index && other.sourceRoot && site.sourceRoot.indexOf(other.sourceRoot) === 0 && other.sourceRoot.length < site.sourceRoot.length;
            });
        });
    }

    async function readSiteDirectoryFiles(files, onProgress, options) {
        const list = Array.from(files || []);
        if (!list.length) throw new Error('请选择包含站点源码的总目录。');
        onProgress = typeof onProgress === 'function' ? onProgress : function() {};
        const descriptors = list.map(function(file) {
            return { file: file, path: normalizePath(file.webkitRelativePath || file.name) };
        }).filter(function(item) { return isSafePath(item.path); });
        let roots = [];
        descriptors.forEach(function(item) {
            if (!/(?:^|\/)index\.html?$/i.test(item.path)) return;
            const root = item.path.replace(/index\.html?$/i, '');
            const hasAdScript = descriptors.some(function(candidate) { return candidate.path.toLowerCase() === (root + 'js/ad.js').toLowerCase(); });
            const hasDetailCandidate = descriptors.some(function(candidate) {
                return candidate.path.indexOf(root) === 0 && candidate.path !== item.path && /\.html?$/i.test(candidate.path) &&
                (/^(?:details?|articles?)\//i.test(candidate.path.slice(root.length))
                    || (options && options.quickUpdate && /^(?:games)\//i.test(candidate.path.slice(root.length)))
                    || (options && options.quickUpdate && /^games\.html?$/i.test(candidate.path.slice(root.length)))
                    || hasAdScript);
            });
            if (hasDetailCandidate && roots.indexOf(root) === -1) roots.push(root);
        });
        roots.sort(function(a, b) { return a.length - b.length; });
        roots = roots.filter(function(root, index) {
            return !roots.some(function(other, otherIndex) {
                return otherIndex !== index && other && root.indexOf(other) === 0 && other.length < root.length;
            });
        });
        if (!roots.length) throw new Error('所选目录中未识别到站点首页、详情页和广告脚本。');
        const relevant = descriptors.filter(function(item) {
            return roots.some(function(root) { return !root || item.path.indexOf(root) === 0; });
        });
        const entries = [];
        for (let index = 0; index < relevant.length; index++) {
            const item = relevant[index];
            entries.push({ path: item.path, bytes: new Uint8Array(await item.file.arrayBuffer()) });
            if (index % 20 === 0 || index === relevant.length - 1) {
                onProgress(Math.round((index + 1) / relevant.length * 100), '正在读取站点文件 ' + (index + 1) + '/' + relevant.length + '…');
            }
        }
        const sites = splitSiteEntries(entries, options);
        if (!sites.length) throw new Error('所选目录中未识别到同时包含 index.html 和详情页的站点。');
        return { sites: sites, fileCount: entries.length };
    }

    async function readSiteDirectoryHandle(directoryHandle, onProgress, options) {
        if (!directoryHandle || directoryHandle.kind !== 'directory' || typeof directoryHandle.entries !== 'function') {
            throw new Error('请选择包含站点源码的总目录。');
        }
        onProgress = typeof onProgress === 'function' ? onProgress : function() {};
        const rootName = siteFolderName(directoryHandle.name, 'selected-sites');
        const files = [];
        onProgress(2, '正在识别目录结构…');

        async function collect(handle, relativePath) {
            const children = [];
            for await (const pair of handle.entries()) children.push(pair);
            children.sort(function(a, b) { return String(a[0]).localeCompare(String(b[0])); });
            for (let index = 0; index < children.length; index++) {
                const name = children[index][0];
                const child = children[index][1];
                const childPath = relativePath ? relativePath + '/' + name : name;
                if (child.kind === 'directory') {
                    await collect(child, childPath);
                } else if (child.kind === 'file' && typeof child.getFile === 'function') {
                    files.push({
                        name: name,
                        webkitRelativePath: rootName + '/' + childPath,
                        arrayBuffer: async function() {
                            const file = await child.getFile();
                            return file.arrayBuffer();
                        }
                    });
                }
            }
        }

        await collect(directoryHandle, '');
        if (!files.length) throw new Error('所选目录中没有可读取的文件。');
        return readSiteDirectoryFiles(files, onProgress, options);
    }

    async function readSiteArchiveFiles(files, onProgress, options) {
        const list = Array.from(files || []);
        if (!list.length) throw new Error('请至少选择一个站点压缩包。');
        onProgress = typeof onProgress === 'function' ? onProgress : function() {};
        const sites = [];
        for (let index = 0; index < list.length; index++) {
            const file = list[index];
            const baseProgress = Math.round(index / list.length * 100);
            onProgress(baseProgress, '正在读取 ' + file.name + '…');
            const archiveEntries = await readArchive(file, function(stage) {
                onProgress(baseProgress, file.name + '：' + stage);
            });
            // Batch exports contain multiple independent roots. Split before
            // stripping a wrapper; otherwise selecting one root loses siblings.
            const containedSites = splitSiteEntries(archiveEntries, options);
            if (containedSites.length > 1) {
                containedSites.forEach(function(site, siteIndex) {
                    site.id = 'archive:' + index + ':' + siteIndex + ':' + site.name;
                    sites.push(site);
                });
                continue;
            }
            const originalMetadata = inspectSiteEntries(archiveEntries, file.name, options);
            let entries = archiveEntries;
            if (originalMetadata.siteRoot) {
                entries = archiveEntries.filter(function(entry) { return entry.path.indexOf(originalMetadata.siteRoot) === 0; }).map(function(entry) {
                    return { path: entry.path.slice(originalMetadata.siteRoot.length), bytes: entry.bytes };
                });
            }
            const name = siteFolderName(archiveBaseName(file.name), 'site-' + (index + 1));
            sites.push({
                id: 'archive:' + index + ':' + name,
                name: name,
                sourceRoot: originalMetadata.siteRoot || '',
                entries: entries,
                metadata: inspectSiteEntries(entries, file.name, options)
            });
        }
        onProgress(100, '站点压缩包读取完成');
        return { sites: sites, fileCount: sites.reduce(function(sum, site) { return sum + site.entries.length; }, 0) };
    }

    function parsePackageEntry(entry) {
        if (!entry) return null;
        try { return JSON.parse(entryText(entry)); } catch (error) { return null; }
    }

    function packageUses(packageData, dependency) {
        const dependencies = Object.assign({}, packageData && packageData.dependencies, packageData && packageData.devDependencies);
        return !!dependencies[dependency];
    }

    function staticGeneratorPreviewRoot(rawEntries) {
        const entries = (rawEntries || []).map(function(entry) {
            return { path: normalizePath(entry.path || entry.name), text: entryText(entry) };
        });
        const paths = new Set(entries.map(function(entry) { return entry.path.toLowerCase(); }));
        const packages = entries.filter(function(entry) { return /(?:^|\/)package\.json$/i.test(entry.path); })
            .sort(function(a, b) { return a.path.split('/').length - b.path.split('/').length; });
        for (let index = 0; index < packages.length; index++) {
            let packageData;
            try { packageData = JSON.parse(packages[index].text); } catch (error) { continue; }
            const command = String(packageData && packageData.scripts && packageData.scripts.build || '');
            const match = command.match(/(?:^|&&\s*)node\s+(?:--[^\s]+\s+)*["']?([^"'\s]+\.(?:mjs|cjs|js))["']?/i);
            if (!match) continue;
            const root = packages[index].path.replace(/package\.json$/i, '');
            if (paths.has(normalizePath(root + match[1]).toLowerCase())) return root;
        }
        return null;
    }

    function classifyInjectableSiteEntries(rawEntries, archiveName) {
        const entries = (rawEntries || []).map(function(entry) {
            return { path: normalizePath(entry.path || entry.name), text: entryText(entry), source: entry };
        }).filter(function(entry) { return isSafePath(entry.path); });
        const byPath = {};
        entries.forEach(function(entry) { byPath[entry.path.toLowerCase()] = entry; });
        const packageEntries = entries.filter(function(entry) { return /(?:^|\/)package\.json$/i.test(entry.path); })
            .sort(function(a, b) { return a.path.split('/').length - b.path.split('/').length; });

        for (let index = 0; index < packageEntries.length; index++) {
            const packageEntry = packageEntries[index];
            const packageData = parsePackageEntry(packageEntry);
            if (!packageUses(packageData, 'react') && !packageUses(packageData, 'react-dom')) continue;
            const root = packageEntry.path.replace(/package\.json$/i, '');
            if (packageUses(packageData, 'next')) {
                const nextLayout = entries.find(function(entry) {
                    return entry.path.indexOf(root) === 0 && /(?:^|\/)(?:app\/layout|pages\/_document)\.(?:tsx?|jsx?)$/i.test(entry.path.slice(root.length));
                });
                const staticExport = byPath[(root + 'out/index.html').toLowerCase()];
                if (nextLayout) return {
                    valid: true, kind: 'react-source', framework: 'Next.js React 源码工程', siteRoot: root,
                    entryPath: '', previewEntryPath: staticExport ? staticExport.path : '',
                    runtimePath: root + 'public/js/ad.js', runtimeSrc: '/js/ad.js',
                    buildCommand: 'npm run build', errors: [], warnings: []
                };
                if (staticExport) return {
                    valid: true, kind: 'static-html', framework: 'React 已构建静态产物（按静态 HTML 注入）',
                    siteRoot: root, deploymentRoot: root + 'out/', entryPath: staticExport.path,
                    previewEntryPath: staticExport.path, runtimePath: root + 'out/js/ad.js', runtimeSrc: '/js/ad.js',
                    hydratedPages: true,
                    buildCommand: '已提供 Next.js 静态导出', errors: [], warnings: []
                };
                return {
                    valid: false,
                    kind: 'react-unsupported',
                    framework: 'Next.js 源码工程',
                    siteRoot: root,
                    entryPath: '',
                    errors: [issue('检测到 Next.js 源码工程。请先执行静态导出或生产构建，再上传生成的 out/dist 目录。', 'AD_INJECTION_NEXT_BUILD_REQUIRED')],
                    warnings: []
                };
            }
            const viteIndex = byPath[(root + 'index.html').toLowerCase()];
            const craIndex = byPath[(root + 'public/index.html').toLowerCase()];
            const hasTanStackStart = packageUses(packageData, '@tanstack/react-start') || packageUses(packageData, '@tanstack/start');
            const hasTanStackRouter = hasTanStackStart || packageUses(packageData, '@tanstack/react-router') || entries.some(function(entry) { return /(?:^|\/)src\/routes\/(?:__root|root)\.(?:tsx?|jsx?)$/i.test(entry.path); });
            const hasVite = packageUses(packageData, 'vite') || entries.some(function(entry) { return /(?:^|\/)vite\.config\.[cm]?[jt]sx?$/i.test(entry.path); });
            const hasReactSource = entries.some(function(entry) {
                return entry.path.indexOf(root) === 0 && /^(?:src|app|pages)\//i.test(entry.path.slice(root.length))
                    && /\.(?:tsx?|jsx?)$/i.test(entry.path);
            });
            const buildCommand = packageData && packageData.scripts && packageData.scripts.build ? 'npm run build' : '请按项目说明执行生产构建';
            const builtPreviewIndex = entries.filter(function(entry) {
                return entry.path.indexOf(root) === 0 && /(?:^|\/)(?:dist|build|out|output|export|www|_site|public|\.output\/public|\.vercel\/output\/static)\/(?:client\/)?index\.html?$/i.test(entry.path);
            }).sort(function(a, b) {
                const aClient = /\/client\/index\.html?$/i.test(a.path) ? 0 : 1;
                const bClient = /\/client\/index\.html?$/i.test(b.path) ? 0 : 1;
                return aClient - bClient || a.path.split('/').length - b.path.split('/').length;
            })[0];
            // A source archive may contain an old dist directory.  It is never a
            // safe substitute for a fresh build.  Conversely, a package which
            // contains no editable source but does contain a completed output is
            // a legitimate deployable artifact and is exported from that output
            // root only (without package.json or other project files).
            if (!hasReactSource && builtPreviewIndex) {
                const deploymentRoot = builtPreviewIndex.path.replace(/index\.html?$/i, '');
                return {
                    valid: true,
                    kind: 'static-html',
                    framework: 'React 已构建静态产物（按静态 HTML 注入）',
                    siteRoot: root,
                    deploymentRoot: deploymentRoot,
                    entryPath: builtPreviewIndex.path,
                    previewEntryPath: builtPreviewIndex.path,
                    runtimePath: deploymentRoot + 'js/ad.js',
                    runtimeSrc: '/js/ad.js',
                    buildCommand: packageData && packageData.scripts && packageData.scripts.build ? 'npm run build' : '已提供构建产物',
                    errors: [], warnings: []
                };
            }
            if (viteIndex) {
                const built = !hasReactSource && /\/(?:assets|static)\/[^"']+\.(?:js|mjs)/i.test(viteIndex.text) && !/\/src\/[^"']+\.(?:jsx?|tsx?)/i.test(viteIndex.text);
                return {
                    valid: true,
                    kind: built ? 'static-html' : 'react-source',
                    framework: built ? 'React 已构建静态产物（按静态 HTML 注入）' : (hasTanStackStart ? 'React + TanStack Start 源码工程' : hasTanStackRouter ? 'React + TanStack Router 源码工程' : hasVite ? 'React / Vite 源码工程' : 'React 源码工程'),
                    siteRoot: root,
                    entryPath: viteIndex.path,
                    previewEntryPath: builtPreviewIndex ? builtPreviewIndex.path : viteIndex.path,
                    runtimePath: root + (built ? 'js/ad.js' : 'public/js/ad.js'),
                    runtimeSrc: '/js/ad.js',
                    buildCommand: built ? '已提供构建产物' : buildCommand,
                    errors: [],
                    warnings: []
                };
            }
            if (craIndex) {
                return {
                    valid: true,
                    kind: 'react-source',
                    framework: hasTanStackRouter ? 'React + TanStack Router 源码工程' : 'React / CRA 源码工程',
                    siteRoot: root,
                    entryPath: craIndex.path,
                    previewEntryPath: builtPreviewIndex ? builtPreviewIndex.path : craIndex.path,
                    runtimePath: root + 'public/js/ad.js',
                    runtimeSrc: '%PUBLIC_URL%/js/ad.js',
                    buildCommand: buildCommand,
                    errors: [],
                    warnings: []
                };
            }
            return {
                valid: hasReactSource,
                kind: hasReactSource ? 'react-source' : 'react-unsupported',
                framework: hasTanStackStart ? 'React + TanStack Start 源码工程' : hasTanStackRouter ? 'React + TanStack Router 源码工程' : 'React 源码工程',
                siteRoot: root,
                entryPath: '',
                previewEntryPath: builtPreviewIndex ? builtPreviewIndex.path : '',
                buildCommand: buildCommand,
                errors: hasReactSource ? [] : [issue('检测到 React 依赖，但没有找到可安全修改的 JSX/TSX 源码。请上传源码或构建后的 dist。', 'AD_INJECTION_REACT_ENTRY_MISSING')],
                warnings: hasReactSource ? [issue('未找到标准 Vite/CRA HTML 入口；将仅在可安全定位的 React 根布局中修改源码，并在报告中标出构建说明。', 'AD_INJECTION_REACT_NONSTANDARD_ENTRY')] : []
            };
        }

        // A standalone Next out/ archive has no package.json or #root marker.
        // Its HTML is still hydrated by React, so statically inserting banners
        // into that server-rendered body would be removed during hydration.
        const nextBuildEntry = entries.filter(function(entry) {
            return /(?:^|\/)index\.html?$/i.test(entry.path)
                && /<script\b[^>]*(?:src\s*=\s*["'][^"']*\/_next\/static\/|id\s*=\s*["']__NEXT_DATA__["'])|self\.__next_f\s*\.|window\.__reactRouter(?:Context|Manifest)|__reactRouterContext/i.test(entry.text);
        }).sort(function(a, b) { return a.path.split('/').length - b.path.split('/').length; })[0];
        if (nextBuildEntry) {
            const root = nextBuildEntry.path.replace(/index\.html?$/i, '');
            return {
                valid: true, kind: 'static-html', framework: 'React 已构建静态产物（hydrated 多页面）',
                siteRoot: root, deploymentRoot: root, entryPath: nextBuildEntry.path,
                previewEntryPath: nextBuildEntry.path, runtimePath: root + 'js/ad.js', runtimeSrc: '/js/ad.js',
                hydratedPages: true, buildCommand: '已提供 Next.js 静态导出', errors: [], warnings: []
            };
        }

        const reactBuildEntry = entries.filter(function(entry) {
            return /(?:^|\/)index\.html?$/i.test(entry.path) && /\bid\s*=\s*["']root["']/i.test(entry.text) && /<script\b[^>]*(?:type\s*=\s*["']module["']|\/(?:assets|static)\/)/i.test(entry.text);
        }).sort(function(a, b) { return a.path.split('/').length - b.path.split('/').length; })[0];
        if (reactBuildEntry) {
            const root = reactBuildEntry.path.replace(/index\.html?$/i, '');
            return {
                valid: true,
                kind: 'static-html',
                framework: 'React 已构建静态产物（按静态 HTML 注入）',
                siteRoot: root,
                entryPath: reactBuildEntry.path,
                previewEntryPath: reactBuildEntry.path,
                runtimePath: root + 'js/ad.js',
                runtimeSrc: '/js/ad.js',
                deploymentRoot: root,
                buildCommand: '已提供构建产物',
                errors: [],
                warnings: []
            };
        }

        const metadata = inspectSiteEntries(rawEntries, archiveName, { finishedSite: true });
        metadata.errors = metadata.errors.filter(function(error) { return error.code !== 'RESTORE_EMBEDDED_CONFIG_INCOMPLETE'; });
        metadata.valid = metadata.errors.length === 0;
        const generatorRoot = !metadata.valid ? staticGeneratorPreviewRoot(rawEntries) : null;
        if (generatorRoot !== null) return {
            valid: true, kind: 'static-html', framework: '静态网站源码工程（预览时构建）',
            siteRoot: generatorRoot, entryPath: '', previewEntryPath: '', runtimePath: '',
            buildCommand: 'npm run build', errors: [], warnings: []
        };
        const generatorPackage = packageEntries.find(function(entry) {
            const pkg = parsePackageEntry(entry);
            return entry.path === 'package.json' && pkg && pkg.scripts && pkg.scripts.build && metadata.siteRoot;
        });
        return {
            valid: metadata.valid,
            kind: 'static-html',
            framework: '静态 HTML 多页面站',
            siteRoot: metadata.siteRoot,
            entryPath: metadata.homePath,
            previewEntryPath: metadata.homePath,
            runtimePath: metadata.adPath,
            runtimeSrc: '',
            ...(generatorPackage ? { deploymentRoot: metadata.siteRoot, buildCommand: 'npm run build' } : {}),
            errors: metadata.errors,
            warnings: metadata.warnings,
            metadata: metadata
        };
    }

    function staticDeploymentSite(site) {
        if (!site || !site.project || site.project.kind !== 'react-source') return site;
        const homePath = normalizePath(site.project.previewEntryPath || '');
        const root = homePath.replace(/index\.html?$/i, '');
        if (!homePath || !/(?:^|\/)(?:dist|build|out|output|export|www|_site|\.output\/public|\.vercel\/output\/static)\//i.test(homePath)) {
            throw new Error(site.name + ' 没有可导出的静态构建产物，请选择“含广告的完整源码”，或先生产构建后上传输出目录。');
        }
        const entries = (site.entries || []).filter(function(entry) { return normalizePath(entry.path).indexOf(root) === 0; }).map(function(entry) {
            return { path: normalizePath(entry.path).slice(root.length), bytes: entry.bytes || textBytes(entryText(entry)) };
        });
        const home = entryByPath(entries, 'index.html');
        if (!home || /<script\b[^>]*src=["'][^"']*\/src\/[^"']+\.(?:jsx?|tsx?)/i.test(entryText(home))) {
            throw new Error(site.name + ' 的静态入口仍引用源码，请先完成生产构建，或选择“含广告的完整源码”。');
        }
        const project = classifyInjectableSiteEntries(entries, site.name);
        if (!project.valid) throw new Error(site.name + ' 的静态构建产物无法识别为可部署站点。');
        return Object.assign({}, site, { entries: entries, project: project,
            sourceEntries: site.sourceEntries || site.entries, sourceDeploymentRoot: root });
    }

    function injectableRootsFromDescriptors(descriptors) {
        const paths = descriptors.map(function(item) { return item.path; });
        let roots = [];
        paths.forEach(function(path) {
            if (!/(?:^|\/)package\.json$/i.test(path) || /(?:^|\/)(?:node_modules|\.git|\.tmp[^/]*|vendor-games)(?:\/|$)/i.test(path)) return;
            const root = path.replace(/package\.json$/i, '');
            if (roots.indexOf(root) === -1) roots.push(root);
        });
        paths.forEach(function(path) {
            if (!/(?:^|\/)index\.html?$/i.test(path)) return;
            let root = path.replace(/index\.html?$/i, '');
            let ancestor = root.replace(/\/$/, '');
            while (ancestor) {
                const slash = ancestor.lastIndexOf('/');
                const parent = slash < 0 ? '' : ancestor.slice(0, slash + 1);
                if (paths.some(function(candidate) { return candidate.toLowerCase() === (parent + 'package.json').toLowerCase(); })) { root = parent; break; }
                ancestor = parent.replace(/\/$/, '');
            }
            if (/public\/$/i.test(root)) {
                const projectRoot = root.replace(/public\/$/i, '');
                if (paths.some(function(candidate) { return candidate.toLowerCase() === (projectRoot + 'package.json').toLowerCase(); })) root = projectRoot;
            }
            if (roots.indexOf(root) === -1) roots.push(root);
        });
        roots.sort(function(a, b) { return a.length - b.length; });
        return roots.filter(function(root, index) {
            return !roots.some(function(other, otherIndex) {
                return otherIndex !== index && other && root.indexOf(other) === 0 && other.length < root.length;
            });
        });
    }

    async function readInjectableDirectoryFiles(files, onProgress) {
        const list = Array.from(files || []);
        if (!list.length) throw new Error('请选择一个成品站目录或包含多个成品站的总目录。');
        onProgress = typeof onProgress === 'function' ? onProgress : function() {};
        const descriptors = list.map(function(file) {
            return { file: file, path: normalizePath(file.webkitRelativePath || file.name) };
        }).filter(function(item) { return isSafePath(item.path); });
        const roots = injectableRootsFromDescriptors(descriptors);
        if (!roots.length) throw new Error('所选目录中没有找到站点入口 index.html。');
        const relevant = descriptors.filter(function(item) { return roots.some(function(root) { return item.path.indexOf(root) === 0; }); });
        const entries = [];
        for (let index = 0; index < relevant.length; index++) {
            entries.push({ path: relevant[index].path, bytes: new Uint8Array(await relevant[index].file.arrayBuffer()) });
            if (index % 20 === 0 || index === relevant.length - 1) onProgress(Math.round((index + 1) / relevant.length * 100), '正在读取成品站文件 ' + (index + 1) + '/' + relevant.length + '…');
        }
        const sites = roots.map(function(root, index) {
            const relativeEntries = entries.filter(function(entry) { return entry.path.indexOf(root) === 0; }).map(function(entry) {
                return { path: entry.path.slice(root.length), bytes: entry.bytes };
            }).filter(function(entry) { return entry.path; });
            const name = siteFolderName(root, 'site-' + (index + 1));
            return { id: 'inject-directory:' + root, name: name, sourceRoot: root, entries: relativeEntries, project: classifyInjectableSiteEntries(relativeEntries, name) };
        });
        if (!sites.length) throw new Error('所选目录中没有可处理的成品站。');
        return { sites: sites, fileCount: entries.length };
    }

    async function readInjectableDirectoryHandle(directoryHandle, onProgress) {
        if (!directoryHandle || directoryHandle.kind !== 'directory' || typeof directoryHandle.entries !== 'function') throw new Error('请选择成品站目录。');
        const rootName = siteFolderName(directoryHandle.name, 'selected-sites');
        const files = [];
        onProgress = typeof onProgress === 'function' ? onProgress : function() {};
        onProgress(2, '正在识别成品站目录结构…');
        async function collect(handle, relativePath) {
            const children = [];
            for await (const pair of handle.entries()) children.push(pair);
            children.sort(function(a, b) { return String(a[0]).localeCompare(String(b[0])); });
            for (let index = 0; index < children.length; index++) {
                const name = children[index][0];
                const child = children[index][1];
                const childPath = relativePath ? relativePath + '/' + name : name;
                if (child.kind === 'directory') await collect(child, childPath);
                else if (child.kind === 'file' && typeof child.getFile === 'function') {
                    files.push({ name: name, webkitRelativePath: rootName + '/' + childPath, arrayBuffer: async function() { return (await child.getFile()).arrayBuffer(); } });
                }
            }
        }
        await collect(directoryHandle, '');
        return readInjectableDirectoryFiles(files, onProgress);
    }

    async function readInjectableArchiveFiles(files, onProgress) {
        const list = Array.from(files || []);
        if (!list.length) throw new Error('请至少选择一个成品站压缩包。');
        onProgress = typeof onProgress === 'function' ? onProgress : function() {};
        const sites = [];
        for (let index = 0; index < list.length; index++) {
            const file = list[index];
            // 为每个压缩包留出独立区间，并把末段留给站点结构识别，100% 只在整批完成时报告。
            const progressEnd = 92;
            const archiveSpan = progressEnd / list.length;
            const baseProgress = index * archiveSpan;
            const parseEnd = baseProgress + archiveSpan * 0.9;
            const archiveEnd = baseProgress + archiveSpan;
            let lastProgress = baseProgress;
            onProgress(lastProgress, '正在读取 ' + file.name + '…', { indeterminate: true });
            const archiveEntries = await readArchive(file, function(stage, localPercent) {
                const message = file.name + '：' + stage;
                if (localPercent === null || localPercent === undefined || !Number.isFinite(Number(localPercent))) {
                    onProgress(lastProgress, message, { indeterminate: true });
                    return;
                }
                const boundedPercent = Math.max(0, Math.min(100, Number(localPercent)));
                lastProgress = Math.max(lastProgress, baseProgress + (parseEnd - baseProgress) * boundedPercent / 100);
                onProgress(lastProgress, message, { indeterminate: false });
            });
            onProgress(lastProgress, file.name + '：压缩包已读取，正在识别站点结构…', { indeterminate: true });
            const project = classifyInjectableSiteEntries(archiveEntries, file.name);
            const root = project.siteRoot || '';
            const entries = root ? archiveEntries.filter(function(entry) { return entry.path.indexOf(root) === 0; }).map(function(entry) {
                return { path: entry.path.slice(root.length), bytes: entry.bytes };
            }) : archiveEntries;
            const previewRoot = staticGeneratorPreviewRoot(archiveEntries);
            const previewSourceEntries = previewRoot !== null ? archiveEntries.filter(function(entry) {
                return entry.path.indexOf(previewRoot) === 0 && !/(?:^|\/)(?:node_modules|\.git|\.tmp[^/]*|coverage)(?:\/|$)/i.test(entry.path.slice(previewRoot.length));
            }).map(function(entry) {
                return { path: entry.path.slice(previewRoot.length), bytes: entry.bytes };
            }) : null;
            const name = siteFolderName(archiveBaseName(file.name), 'site-' + (index + 1));
            const packageRoots = archiveEntries.filter(function(entry) {
                return /(?:^|\/)package\.json$/i.test(entry.path) && !/(?:^|\/)(?:node_modules|\.git|\.tmp[^/]*)(?:\/|$)/i.test(entry.path);
            }).map(function(entry) { return entry.path.replace(/package\.json$/i, ''); }).filter(function(candidate) {
                return root.indexOf(candidate) === 0;
            }).sort(function(a, b) { return b.length - a.length; });
            const sourceRoot = previewRoot !== null ? previewRoot : packageRoots.length ? packageRoots[0] : root;
            const sourceEntries = archiveEntries.filter(function(entry) { return entry.path.indexOf(sourceRoot) === 0; }).map(function(entry) {
                return { path: entry.path.slice(sourceRoot.length), bytes: entry.bytes };
            }).filter(function(entry) { return entry.path; });
            sites.push({ id: 'inject-archive:' + index + ':' + name, name: name, sourceRoot: root, entries: entries,
                sourceEntries: sourceEntries, sourceDeploymentRoot: root.slice(sourceRoot.length),
                previewSourceEntries: previewSourceEntries, project: classifyInjectableSiteEntries(entries, name) });
            lastProgress = Math.max(lastProgress, archiveEnd);
            onProgress(lastProgress, file.name + '：站点结构识别完成。', { indeterminate: false });
        }
        onProgress(100, '成品站压缩包读取完成', { indeterminate: false });
        return { sites: sites, fileCount: sites.reduce(function(sum, site) { return sum + site.entries.length; }, 0) };
    }

    async function readAdvertiserCodeFiles(files) {
        const list = Array.from(files || []);
        if (!list.length) throw new Error('请至少选择一个广告代码 TXT 文件。');
        return Promise.all(list.map(async function(file) {
            let text = '';
            if (typeof file.text === 'function') text = await file.text();
            else text = new TextDecoder('utf-8').decode(await file.arrayBuffer());
            const parsed = typeof AdMigration !== 'undefined'
                ? AdMigration.inspectAdCodeText(text, file.name || '')
                : { valid: false, errors: [issue('广告代码解析器未加载。', 'AD_PARSER_UNAVAILABLE')], warnings: [], config: {}, detectedHost: '' };
            return Object.assign({ fileName: file.name || 'ad-code.txt' }, parsed);
        }));
    }

    function siteHostCandidates(site) {
        const hosts = [];
        function add(value) {
            const source = String(value || '').toLowerCase();
            const matches = source.match(/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}/g) || [];
            matches.forEach(function(host) { if (hosts.indexOf(host) === -1) hosts.push(host); });
        }
        add(site && site.name);
        add(site && site.sourceRoot);
        (site && site.entries || []).filter(function(entry) { return /\.(?:html?|json)$/i.test(entry.path || ''); }).slice(0, 20).forEach(function(entry) { add(entryText(entry)); });
        return hosts;
    }

    function matchAdCodesToSites(siteGroups, codeResults) {
        const sites = Array.from(siteGroups || []);
        const codes = Array.from(codeResults || []);
        const validCodes = codes.filter(function(code) { return code && (code.valid || code.allowPartial) && code.detectedHost; });
        const duplicateHosts = {};
        validCodes.forEach(function(code) { duplicateHosts[code.detectedHost] = (duplicateHosts[code.detectedHost] || 0) + 1; });
        const mappings = sites.map(function(site) {
            const project = site.project || classifyInjectableSiteEntries(site.entries, site.name);
            const candidates = siteHostCandidates(site);
            let code = validCodes.find(function(item) { return candidates.indexOf(String(item.detectedHost || '').toLowerCase()) !== -1; }) || null;
            const warnings = [];
            const errors = (project.errors || []).slice();
            if (!code && sites.length === 1 && validCodes.length === 1) {
                code = validCodes[0];
                warnings.push(issue('无法从站点文件名或页面内容确认域名，已按单站单代码配对为 ' + code.detectedHost + '。', 'AD_INJECTION_SINGLE_PAIR_ASSUMED'));
            }
            if (!code) errors.push(issue('没有找到与此站点域名匹配的有效广告代码 TXT。', 'AD_INJECTION_CODE_NOT_MATCHED'));
            else if (duplicateHosts[code.detectedHost] > 1) errors.push(issue('检测到多个 ' + code.detectedHost + ' 广告代码文件，请只保留一份。', 'AD_INJECTION_DUPLICATE_CODE'));
            return {
                valid: errors.length === 0,
                site: site,
                siteName: site.name,
                project: project,
                framework: project.framework,
                code: code,
                host: code ? code.detectedHost : '',
                errors: errors,
                warnings: warnings.concat(code ? (code.warnings || []) : [])
            };
        });
        return { mappings: mappings, validCount: mappings.filter(function(item) { return item.valid; }).length };
    }

    function generateSpaAdRuntime(config, requestedPolicy, version, options) {
        // Rendered source and compiled SPA exports share the exact same DOM
        // semantics as static injection. There is no separate footer fallback.
        return FinishedSiteAds.dynamicRuntimeSource(config, version, Object.assign({}, options, {
            policy: normalizePolicy(requestedPolicy)
        }));
    }

    function generateReactSourceAdRuntime(config, version) {
        function literal(value) {
            return JSON.stringify(String(value || '')).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
        }
        let source = [
            'const bannerPath1 = ' + literal(config && config.bannerPath1) + ';',
            'const bannerPath2 = ' + literal(config && config.bannerPath2) + ';',
            'const bannerPath3 = ' + literal(config && config.bannerPath3) + ';',
            'const bannerPath4 = ' + literal(config && config.bannerPath4) + ';',
            'const interstitialPath = ' + literal(config && config.interstitialPath) + ';',
            'const anchorPath = ' + literal(config && config.anchorPath) + ';',
            'const analyticsID = ' + literal(config && config.analyticsID) + ';',
            '',
            'var bannerSlot1, bannerSlot2, bannerSlot3, bannerSlot4;',
            'var interstitialSlot, anchorSlot;',
            'var bannerObservers = [];',
            'var bannerScanPath = "";',
            'var bannerScanTimer;',
            'var isIndex = window.location.pathname === "/" || window.location.pathname === "/index.html";',
            'window.googletag = window.googletag || { cmd: [] };',
            '',
            'function centerCustomAdPlacements() {',
            '  document.querySelectorAll(".sitefoundry-ad-custom-placement").forEach(function (node) {',
            '    node.style.setProperty("--sitefoundry-ad-center-offset", "0px");',
            '    var rect = node.getBoundingClientRect();',
            '    var offset = window.innerWidth / 2 - (rect.left + rect.width / 2);',
            '    node.style.setProperty("--sitefoundry-ad-center-offset", Math.round(offset * 100) / 100 + "px");',
            '  });',
            '}',
            '',
            'function queueCustomAdPlacementCenter() {',
            '  window.requestAnimationFrame(centerCustomAdPlacements);',
            '}',
            '',
            'function delayLoadBanner(slotName, slotPath, domId, size = [300, 250]) {',
            '  const element = document.getElementById(domId);',
            '  if (!element || !slotPath) return;',
            '  let hasDefined = false;',
            '  let hasDisplayed = false;',
            '  console.log(`[LazyLoad] 初始化监控: ${slotName}`);',
            '  const observer = new IntersectionObserver((entries) => {',
            '    entries.forEach((entry) => {',
            '      if (!entry.isIntersecting) return;',
            '      if (!hasDefined) {',
            '        console.log(`[LazyLoad] ${slotName} 进入视口，定义广告位...`);',
            '        googletag.cmd.push(function () {',
            '          window[slotName] = googletag.defineSlot(slotPath, size, domId).addService(googletag.pubads());',
            '          console.log(`[LazyLoad] ${slotName} 已定义`);',
            '        });',
            '        hasDefined = true;',
            '      }',
            '      if (!hasDisplayed) {',
            '        console.log(`[LazyLoad] ${slotName} 第一次 display()，请求广告...`);',
            '        googletag.cmd.push(function () {',
            '          googletag.display(domId);',
            '          console.log(`[LazyLoad] ${slotName} display() 完成`);',
            '        });',
            '        hasDisplayed = true;',
            '      }',
            '      observer.disconnect();',
            '    });',
            '  }, { threshold: 0.1 });',
            '  bannerObservers.push(observer);',
            '  observer.observe(element);',
            '}',
            '',
            'function scanBannersForCurrentPage() {',
            '  var currentPath = window.location.pathname + window.location.search;',
            '  if (bannerScanPath === currentPath) return;',
            '  googletag.cmd.push(function () {',
            '    bannerObservers.forEach(function (observer) { observer.disconnect(); });',
            '    bannerObservers = [];',
            '    var previousSlots = [bannerSlot1, bannerSlot2, bannerSlot3, bannerSlot4].filter(Boolean);',
            '    if (previousSlots.length) {',
            '      googletag.destroySlots(previousSlots);',
            '      console.log("[LazyLoad] 已销毁上一页 Banner 广告位");',
            '    }',
            '    bannerSlot1 = bannerSlot2 = bannerSlot3 = bannerSlot4 = undefined;',
            '    bannerScanPath = currentPath;',
            '    delayLoadBanner("bannerSlot1", bannerPath1, "div-gpt-ad-banner1");',
            '    delayLoadBanner("bannerSlot2", bannerPath2, "div-gpt-ad-banner2");',
            '    delayLoadBanner("bannerSlot3", bannerPath3, "div-gpt-ad-banner3");',
            '    if (bannerPath4 && document.getElementById("div-gpt-ad-banner4")) {',
            '      bannerSlot4 = googletag.defineSlot(bannerPath4, [300, 250], "div-gpt-ad-banner4").addService(googletag.pubads());',
            '      googletag.display("div-gpt-ad-banner4");',
            '      console.log("[Display] banner4 正常加载 display()");',
            '    }',
            '  });',
            '}',
            '',
            'window.refreshClarivoBanners = function () {',
            '  queueCustomAdPlacementCenter();',
            '  var currentPath = window.location.pathname + window.location.search;',
            '  if (bannerScanPath === currentPath) return;',
            '  clearTimeout(bannerScanTimer);',
            '  bannerScanTimer = setTimeout(scanBannersForCurrentPage, 0);',
            '};',
            '',
            'googletag.cmd.push(function () {',
            '  if (bannerPath4 && document.getElementById("div-gpt-ad-banner4")) {',
            '    bannerSlot4 = googletag.defineSlot(bannerPath4, [300, 250], "div-gpt-ad-banner4").addService(googletag.pubads());',
            '    console.log("[Init] banner4 已定义（非延迟加载）");',
            '  }',
            '  if (isIndex && interstitialPath) {',
            '    interstitialSlot = googletag.defineOutOfPageSlot(interstitialPath, googletag.enums.OutOfPageFormat.INTERSTITIAL);',
            '    if (interstitialSlot) {',
            '      interstitialSlot.addService(googletag.pubads());',
            '      console.log("[Init] Interstitial 已定义");',
            '    }',
            '  }',
            '  if (anchorPath) {',
            '    anchorSlot = googletag.defineOutOfPageSlot(anchorPath, googletag.enums.OutOfPageFormat.BOTTOM_ANCHOR);',
            '    if (anchorSlot) {',
            '      anchorSlot.addService(googletag.pubads());',
            '      console.log("[Init] Anchor 已定义");',
            '    }',
            '  }',
            '  googletag.pubads().enableSingleRequest();',
            '  googletag.enableServices();',
            '});',
            '',
            'window.addEventListener("load", window.refreshClarivoBanners);',
            'window.addEventListener("resize", queueCustomAdPlacementCenter);',
            'if (analyticsID) {',
            '  const gtagScript = document.createElement("script");',
            '  gtagScript.async = true;',
            '  gtagScript.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(analyticsID);',
            '  document.head.appendChild(gtagScript);',
            '  gtagScript.onload = function () {',
            '    window.dataLayer = window.dataLayer || [];',
            '    function gtag() { dataLayer.push(arguments); }',
            '    gtag("js", new Date());',
            '    gtag("config", analyticsID);',
            '  };',
            '} else {',
            '  console.warn("Analytics ID is empty. Skipping Google Analytics initialization.");',
            '}',
            ''
        ].join('\n');
        if (version === 'initial') return '/** 成品站 ad.js initial */\n' + source;
        source = source.replace(/function delayLoadBanner\([\s\S]*?\n}\n\nfunction scanBannersForCurrentPage\(\)/, [
            'function loadNativeBanner(slotName, slotPath, domId, size = [300, 250]) {',
            '  if (!slotPath || !document.getElementById(domId)) return;',
            '  window[slotName] = googletag.defineSlot(slotPath, size, domId).addService(googletag.pubads());',
            '  googletag.display(domId);',
            '}',
            '',
            'function scanBannersForCurrentPage()'
        ].join('\n'));
        source = source.replace(/delayLoadBanner\(/g, 'loadNativeBanner(');
        source = source.replace('googletag.cmd.push(function () {\n  if (bannerPath4', 'googletag.cmd.push(function () {\n  if (googletag.setConfig) googletag.setConfig({ lazyLoad: { fetchMarginPercent: 50, renderMarginPercent: 0, mobileScaling: 1 }, singleRequest: false });\n  if (bannerPath4');
        if (version === 'v1.0.2') source = source.replace('googletag.setConfig({ lazyLoad: { fetchMarginPercent: 50, renderMarginPercent: 0, mobileScaling: 1 }, singleRequest: false });', 'googletag.setConfig({ lazyLoad: null, singleRequest: false });');
        // v1.0.2.1 inherits v1.0.2's disabled extra interstitial triggers.
        if (version !== 'v1.0.0' && version !== 'v1.0.2' && version !== 'v1.0.2.1') source = source.replace('      interstitialSlot.addService(googletag.pubads());',
            '      interstitialSlot.addService(googletag.pubads());\n      if (interstitialSlot.setConfig) interstitialSlot.setConfig({ interstitial: { triggers: { unhideWindow: true, navBar: true, inactivity: true, endOfArticle: true, continueReading: true } } });');
        return '/** 成品站 ad.js ' + (version || 'v1.0.1') + ' */\n' + source;
    }

    function injectReactEntry(rawEntries, project, config, archiveName, requestedPolicy, settings) {
        const entries = (rawEntries || []).map(function(entry) {
            return { path: normalizePath(entry.path || entry.name), bytes: entry.bytes ? new Uint8Array(entry.bytes) : textBytes(entryText(entry)) };
        }).filter(function(entry) { return isSafePath(entry.path); });
        const entry = entries.find(function(item) { return item.path.toLowerCase() === project.entryPath.toLowerCase(); });
        if (!entry) return { valid: false, errors: [issue('没有找到 React 入口页 ' + project.entryPath + '。', 'AD_INJECTION_REACT_ENTRY_MISSING')], warnings: [], entries: entries, project: project };
        const scripts = '<script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js" crossorigin="anonymous" data-sitefoundry-ad-runtime="gpt"></script>\n    <script defer src="' + project.runtimeSrc + '?v=1" data-sitefoundry-ad-runtime="loader"></script>';
        // Next static exports have independent HTML entry points. Install only
        // script loaders on every content route and preserve the SSR body, so
        // direct detail/listing requests and later hydration keep working.
        const embeddedDocuments = referencedEmbeddedHtmlPaths(entries);
        const pages = project.hydratedPages ? entries.filter(function(item) {
            return item.path.indexOf(project.deploymentRoot || project.siteRoot || '') === 0
                && /\.html?$/i.test(item.path)
                && isFinishedSiteDeployablePath(item.path, project)
                && !hasNoindexDirective(entryText(item))
                && !embeddedDocuments.has(item.path.toLowerCase());
        }) : [entry];
        for (const page of pages) {
            let html = removeAdScripts(entryText(page));
            html = html.replace(/\s*<script\b[^>]*data-sitefoundry-ad-runtime[^>]*>[\s\S]*?<\/script\s*>/gi, '');
            const headEnd = html.search(/<\/head\s*>/i);
            if (headEnd === -1) return { valid: false, errors: [issue(page.path + ' 缺少 </head>，无法加入广告运行时。', 'AD_INJECTION_HEAD_MISSING')], warnings: [], entries: entries, project: project };
            page.bytes = textBytes(insertAt(html, headEnd, scripts));
        }
        const fixed = settings && settings.mode === 'fixed';
        const runtimeOptions = { waitForLoad: !!project.hydratedPages };
        const runtimeBytes = textBytes(fixed && typeof FinishedSiteAds !== 'undefined'
            ? FinishedSiteAds.dynamicRuntimeSource(config, settings.version, runtimeOptions)
            : generateSpaAdRuntime(config, requestedPolicy, settings && settings.version, runtimeOptions));
        const existingRuntime = entries.find(function(item) { return item.path.toLowerCase() === project.runtimePath.toLowerCase(); });
        if (existingRuntime) existingRuntime.bytes = runtimeBytes;
        else entries.push({ path: project.runtimePath, bytes: runtimeBytes });
        const manifest = { schema: 'sitefoundry-ad-injection/v1', generatedAt: new Date().toISOString(), source: archiveName || 'finished-site', framework: project.framework, host: detectedHost(config), adPaths: config, policy: normalizePolicy(requestedPolicy),
            placementMode: fixed ? 'fixed' : 'manual', adJsVersion: settings && settings.version || 'v1.0.1' };
        const manifestPath = (project.deploymentRoot || project.siteRoot || '') + 'ad-injection.json';
        const existingManifest = entries.find(function(item) { return item.path.toLowerCase() === manifestPath.toLowerCase(); });
        if (existingManifest) existingManifest.bytes = textBytes(JSON.stringify(manifest, null, 2) + '\n');
        else entries.push({ path: manifestPath, bytes: textBytes(JSON.stringify(manifest, null, 2) + '\n') });
        return { valid: true, errors: [], warnings: project.warnings || [], entries: entries, project: project, changedPages: pages.map(function(page) { return page.path; }), changedScripts: [project.runtimePath], restoredConfig: config };
    }

    /**
     * 固定模式只修改可识别的内容页。每页独立记录跳过原因，避免某个站型
     * 的未知结构让整批站点误插到卡片中间。
     */
    function injectFixedSiteEntries(rawEntries, project, config, archiveName, version) {
        if (typeof FinishedSiteAds === 'undefined' || typeof DOMParser === 'undefined') {
            return { valid: false, errors: [issue('成品站固定广告位规划器未加载。', 'AD_FIXED_PLANNER_UNAVAILABLE')], warnings: [], entries: rawEntries };
        }
        if (typeof Generator === 'undefined' || typeof Generator.generateSelectedAdJs !== 'function') {
            return { valid: false, errors: [issue('ad.js 版本模板未加载。', 'AD_VERSION_TEMPLATE_UNAVAILABLE')], warnings: [], entries: rawEntries };
        }
        const entries = (rawEntries || []).map(function(entry) {
            return { path: normalizePath(entry.path || entry.name), bytes: entry.bytes ? new Uint8Array(entry.bytes) : textBytes(entryText(entry)) };
        }).filter(function(entry) { return isSafePath(entry.path); });
        const home = project.entryPath;
        const root = project.siteRoot || project.deploymentRoot || '';
        const changedPages = [];
        const warnings = [];
        const pagePlacements = {};
        const errors = [];
        const embeddedDocuments = referencedEmbeddedHtmlPaths(entries);
        const htmlEntries = entries.filter(function(entry) {
            return entry.path.indexOf(root) === 0 && /\.html?$/i.test(entry.path)
                && isFinishedSiteDeployablePath(entry.path, project)
                && !hasNoindexDirective(entryText(entry))
                && !embeddedDocuments.has(entry.path.toLowerCase());
        });
        if (!htmlEntries.length) return { valid: false, errors: [issue('未找到可添加广告的内容页。', 'AD_FIXED_CONTENT_MISSING')], warnings: [], entries: entries };
        for (const entry of htmlEntries) {
            // Re-imported sites may already contain one or all known slots.
            // Re-plan those slots instead of treating a partial old layout as
            // a successful injection. Content and unrelated widgets are kept.
            const source = removeAdScripts(removeExistingAds(entryText(entry)));
            if (!/<head\b[^>]*>[\s\S]*?<\/head\s*>/i.test(source) || !/<body\b/i.test(source)) {
                errors.push(issue(entry.path + '：缺少完整 head/body，无法完整加入三个广告位。', 'AD_FIXED_DOCUMENT_INCOMPLETE'));
                continue;
            }
            const doc = new DOMParser().parseFromString(source, 'text/html');
            const pageType = FinishedSiteAds.isHomePath(entry.path, home) ? 'home' : 'detail';
            const result = FinishedSiteAds.place(doc, pageType, config);
            result.skipped.forEach(function(item) {
                errors.push(issue(entry.path + '：' + item.unit + ' ' + item.reason + '；未完整加入已确认的广告位。', 'AD_FIXED_SLOT_SKIPPED'));
            });
            pagePlacements[entry.path] = result;
            if (!result.placed.length) continue;
            const gpt = doc.createElement('script');
            gpt.async = true;
            gpt.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';
            gpt.crossOrigin = 'anonymous';
            const runtime = doc.createElement('script');
            runtime.defer = true;
            runtime.src = relativeAdScriptPath(entry.path, root) + '?v=' + encodeURIComponent(version || 'v1.0.1');
            doc.head.append(gpt, runtime);
            entry.bytes = textBytes(FinishedSiteAds.serialize(doc));
            changedPages.push(entry.path);
        }
        const adPath = root + 'js/ad.js';
        const adSource = Generator.generateSelectedAdJs(config, version);
        const oldRuntime = entries.find(function(entry) { return entry.path.toLowerCase() === adPath.toLowerCase(); });
        if (oldRuntime) oldRuntime.bytes = textBytes(adSource);
        else entries.push({ path: adPath, bytes: textBytes(adSource) });
        const manifestPath = root + 'ad-injection.json';
        const manifest = {
            schema: 'sitefoundry-ad-injection/v3', generatedAt: new Date().toISOString(),
            source: archiveName || 'finished-site', adPaths: config, adJsVersion: version || 'v1.0.1',
            placementMode: 'fixed', pagePlacements: pagePlacements
        };
        const oldManifest = entries.find(function(entry) { return entry.path.toLowerCase() === manifestPath.toLowerCase(); });
        if (oldManifest) oldManifest.bytes = textBytes(JSON.stringify(manifest, null, 2) + '\n');
        else entries.push({ path: manifestPath, bytes: textBytes(JSON.stringify(manifest, null, 2) + '\n') });
        return { valid: errors.length === 0, errors: errors, warnings: warnings, entries: entries, project: project,
            changedPages: changedPages, changedScripts: [adPath], pagePlacements: pagePlacements };
    }

    function injectAdsIntoSiteEntries(rawEntries, config, archiveName, requestedPolicy, settings) {
        const project = classifyInjectableSiteEntries(rawEntries, archiveName);
        if (!project.valid) return { valid: false, errors: project.errors, warnings: project.warnings || [], entries: rawEntries, project: project };
        if (!hasExternalBannerConfig(config)) return { valid: false, errors: [issue('广告代码至少需要一个 banner1、banner2 或 banner3。', 'AD_INJECTION_CODE_INCOMPLETE')], warnings: [], entries: rawEntries, project: project };
        if (project.kind === 'static-html' && settings && settings.mode === 'fixed' && !/React 已构建静态产物/.test(project.framework || '')) {
            return injectFixedSiteEntries(rawEntries, project, config, archiveName, settings.version);
        }
        if (project.kind === 'static-html' && !/React 已构建静态产物/.test(project.framework || '')) {
            const restored = restoreEntries(rawEntries, config, archiveName, requestedPolicy || createPolicy(), {
                finishedSite: true,
                adJsVersion: settings && settings.version,
                project: project
            });
            restored.project = project;
            return restored;
        }
        return injectReactEntry(rawEntries, project, config, archiveName, requestedPolicy || createPolicy(), settings);
    }

    function entryByPath(entries, path) {
        const wanted = String(path || '').toLowerCase();
        return (entries || []).find(function(entry) { return normalizePath(entry.path || entry.name).toLowerCase() === wanted; });
    }

    function countText(source, pattern) {
        const matches = String(source || '').match(pattern);
        return matches ? matches.length : 0;
    }

    function deploymentEntries(entries, project) {
        const root = normalizePath(project && project.deploymentRoot || '');
        if (!root) return (entries || []).map(function(entry) {
            return { path: normalizePath(entry.path || entry.name), bytes: entry.bytes || textBytes(entryText(entry)) };
        });
        return (entries || []).filter(function(entry) {
            return normalizePath(entry.path || entry.name).indexOf(root) === 0;
        }).map(function(entry) {
            return { path: normalizePath(entry.path || entry.name).slice(root.length), bytes: entry.bytes ? new Uint8Array(entry.bytes) : textBytes(entryText(entry)) };
        });
    }

    function outputProject(project) {
        const root = normalizePath(project && project.deploymentRoot || '');
        function relative(path) { return root && normalizePath(path).indexOf(root) === 0 ? normalizePath(path).slice(root.length) : normalizePath(path); }
        return Object.assign({}, project, { siteRoot: '', deploymentRoot: '', entryPath: relative(project && project.entryPath), runtimePath: relative(project && project.runtimePath) });
    }

    function verifyFixedInjectedOutput(entries, project, config, settings, changedPages) {
        const errors = [];
        const warnings = [];
        const checkedPages = [];
        const output = outputProject(project || {});
        const manifestEntry = entryByPath(entries, 'ad-injection.json');
        let manifest = null;
        try { manifest = manifestEntry ? JSON.parse(entryText(manifestEntry)) : null; }
        catch (error) { errors.push(issue('成品站固定模式清单不是有效 JSON。', 'AD_FIXED_MANIFEST_INVALID')); }
        const expectedMode = settings.mode === 'fixed' ? 'fixed' : 'manual';
        if (!manifest || manifest.placementMode !== expectedMode || manifest.adJsVersion !== settings.version) {
            errors.push(issue('成品站固定模式或 ad.js 版本未写入导出清单。', 'AD_FIXED_MANIFEST_MISMATCH'));
        }
        ['bannerPath1', 'bannerPath2', 'bannerPath3', 'interstitialPath', 'anchorPath', 'analyticsID'].forEach(function(key) {
            if (manifest && String((manifest.adPaths || {})[key] || '') !== String((config || {})[key] || '')) {
                errors.push(issue('成品站固定模式广告路径 ' + key + ' 与确认代码不一致。', 'AD_FIXED_PATH_MISMATCH'));
            }
        });
        const runtimePath = output.kind === 'react-source' ? 'public/js/ad.js' : 'js/ad.js';
        const runtime = entryByPath(entries, runtimePath);
        if (!runtime) errors.push(issue('导出内容缺少 ' + runtimePath + '。', 'AD_FIXED_RUNTIME_MISSING'));
        else if (output.kind === 'react-source' || /React 已构建静态产物/.test(output.framework || '')) {
            const runtimeMarker = settings.mode === 'fixed' ? 'responsive runtime' : 'manual SPA runtime';
            if (entryText(runtime).indexOf(runtimeMarker) === -1) errors.push(issue('React 广告模式缺少匹配的广告运行时。', 'AD_FIXED_RUNTIME_MODE'));
        } else if (settings.version === 'initial' && entryText(runtime).indexOf('IntersectionObserver') === -1) {
            errors.push(issue('初版 ad.js 未包含 IntersectionObserver。', 'AD_FIXED_VERSION_MISMATCH'));
        } else if (settings.version !== 'initial' && entryText(runtime).indexOf('ad.js ' + settings.version) === -1) {
            errors.push(issue('导出 ad.js 版本与选项不一致。', 'AD_FIXED_VERSION_MISMATCH'));
        }
        if (output.kind === 'react-source') {
            const source = entries.map(function(entry) { return entryText(entry); }).join('\n');
            if (!/securepubads\.g\.doubleclick\.net\/tag\/js\/gpt\.js/.test(source) || !/["']\/js\/ad\.js["']/.test(source)) {
                errors.push(issue('React 源码未加载 GPT 或固定广告运行时。', 'AD_FIXED_REACT_HEAD_MISSING'));
            }
        } else if (/React 已构建静态产物/.test(output.framework || '')) {
            const entry = entryByPath(entries, output.entryPath || 'index.html');
            if (!entry || !/js\/ad\.js/.test(entryText(entry))) errors.push(issue('React 构建产物入口未引用固定广告运行时。', 'AD_FIXED_BUILD_HEAD_MISSING'));
        } else if (typeof DOMParser !== 'undefined') {
            (changedPages || []).forEach(function(path) {
                const deploymentRoot = normalizePath(project && (project.deploymentRoot || project.siteRoot) || '');
                const relative = deploymentRoot && path.indexOf(deploymentRoot) === 0 ? path.slice(deploymentRoot.length) : path;
                const entry = entryByPath(entries, relative) || entryByPath(entries, path);
                if (!entry) { errors.push(issue('导出内容缺少页面 ' + path + '。', 'AD_FIXED_PAGE_MISSING')); return; }
                checkedPages.push(entry.path);
                const doc = new DOMParser().parseFromString(entryText(entry), 'text/html');
                const plan = manifest && manifest.pagePlacements && (manifest.pagePlacements[path] || manifest.pagePlacements[relative]);
                if (!plan) { errors.push(issue(path + '：缺少固定广告位清单。', 'AD_FIXED_PAGE_PLAN_MISSING')); return; }
                const required = FinishedSiteAds.activeUnits(config).map(function(unit) {
                    return { unit: unit, position: unit === 'banner2' ? 'content-middle' : unit === 'banner1' ? 'after-navbar' : 'footer-top' };
                });
                FinishedSiteAds.validatePlacements(doc, required).forEach(function(message) {
                    errors.push(issue(path + '：' + message, 'AD_FIXED_PLACEMENT_INVALID'));
                });
                (plan.placed || []).forEach(function(unit) {
                    const count = doc.querySelectorAll('#div-gpt-ad-' + unit).length;
                    if (count !== 1) errors.push(issue(path + '：' + unit + ' 容器数量应为 1，实际为 ' + count + '。', 'AD_FIXED_SLOT_COUNT'));
                });
                if (!doc.querySelector('script[src*="js/ad.js"]')) errors.push(issue(path + '：未引用 ad.js。', 'AD_FIXED_SCRIPT_MISSING'));
            });
            entries.filter(function(entry) { return /\.html?$/i.test(entry.path) && typeof FinishedSiteAds !== 'undefined' && !FinishedSiteAds.isContentPath(entry.path); }).forEach(function(entry) {
                if (/data-sitefoundry-fixed-ad=/i.test(entryText(entry))) errors.push(issue(entry.path + '：法律或联系页面出现广告位。', 'AD_FIXED_UTILITY_AD'));
            });
        }
        return { valid: errors.length === 0, errors: errors, warnings: warnings, checkedPages: checkedPages,
            manifestPath: 'ad-injection.json', exportScope: output.kind === 'react-source' ? '完整 React 源码' : '站点部署产物' };
    }

    // This checks the exact bytes that will be written/downloaded.  Do not turn
    // it into a best-effort warning: callers use its failure to block export.
    function verifyInjectedOutput(entries, project, config, requestedPolicy, changedPages, settings) {
        const errors = [];
        const warnings = [];
        const checkedPages = [];
        const policy = normalizePolicy(requestedPolicy);
        const output = outputProject(project || {});
        const reactBuild = /React 已构建静态产物/.test(output.framework || '');
        const reactSource = output.kind === 'react-source';
        const manifestPath = reactBuild || reactSource ? 'ad-injection.json' : 'ad-policy.json';
        const manifestEntry = entryByPath(entries, manifestPath);
        let manifest = null;
        if (!manifestEntry) errors.push(issue('部署产物缺少 ' + manifestPath + '，无法追溯广告路径与位置策略。', 'AD_EXPORT_MANIFEST_MISSING'));
        else {
            try { manifest = JSON.parse(entryText(manifestEntry)); }
            catch (error) { errors.push(issue(manifestPath + ' 不是有效 JSON。', 'AD_EXPORT_MANIFEST_INVALID')); }
        }
        ['bannerPath1', 'bannerPath2', 'bannerPath3', 'interstitialPath', 'anchorPath', 'analyticsID'].forEach(function(key) {
            if (!manifest) return;
            if (String((manifest.adPaths || {})[key] || '') !== String((config || {})[key] || '')) {
                errors.push(issue(manifestPath + ' 中的 ' + key + ' 与已确认广告代码不一致。', 'AD_EXPORT_PATH_MISMATCH'));
            }
        });
        if (manifest && JSON.stringify(normalizePolicy(manifest.policy)) !== JSON.stringify(policy)) {
            errors.push(issue(manifestPath + ' 中的位置策略与预览确认结果不一致。', 'AD_EXPORT_POLICY_MISMATCH'));
        }
        if (settings && settings.version && manifest && manifest.adJsVersion !== settings.version) {
            errors.push(issue(manifestPath + ' 中的 ad.js 版本与选项不一致。', 'AD_EXPORT_VERSION_MISMATCH'));
        }
        if (settings && settings.mode && manifest && manifest.placementMode !== settings.mode) {
            errors.push(issue(manifestPath + ' 中的放置模式与选项不一致。', 'AD_EXPORT_MODE_MISMATCH'));
        }
        const policyErrors = validatePolicy(policy);
        if (policyErrors.length) errors.push.apply(errors, policyErrors);

        if (reactBuild) {
            const index = entryByPath(entries, output.entryPath || 'index.html');
            const runtime = entryByPath(entries, output.runtimePath || 'js/ad.js');
            if (!index) errors.push(issue('部署产物缺少 React 入口 ' + (output.entryPath || 'index.html') + '。', 'AD_EXPORT_ENTRY_MISSING'));
            else {
                const html = entryText(index);
                checkedPages.push(index.path);
                if (countText(html, /securepubads\.g\.doubleclick\.net\/tag\/js\/gpt\.js/gi) !== 1) errors.push(issue(index.path + '：GPT 只能加载一次。', 'AD_EXPORT_GPT_COUNT'));
                if (countText(html, /(?:src=)["'](?:\/)?js\/ad\.js(?:\?[^"']*)?["']/gi) !== 1) errors.push(issue(index.path + '：/js/ad.js 只能加载一次。', 'AD_EXPORT_RUNTIME_COUNT'));
            }
            if (!runtime) errors.push(issue('部署产物缺少广告运行时 ' + (output.runtimePath || 'js/ad.js') + '。', 'AD_EXPORT_RUNTIME_MISSING'));
            else {
                const source = entryText(runtime);
                ['div-gpt-ad-banner', 'refreshClarivoBanners'].forEach(function(token) {
                    if (source.indexOf(token) === -1) errors.push(issue(runtime.path + ' 缺少 ' + token + '，SPA 广告重扫不完整。', 'AD_EXPORT_SPA_RUNTIME_INCOMPLETE'));
                });
                if (!/'pushState',\s*'replaceState'/.test(source)) errors.push(issue(runtime.path + ' 缺少路由切换重扫。', 'AD_EXPORT_SPA_RUNTIME_INCOMPLETE'));
                ['bannerPath1', 'bannerPath2', 'bannerPath3', 'interstitialPath', 'anchorPath', 'analyticsID'].forEach(function(key) {
                    const value = String((config || {})[key] || '');
                    if (value && source.indexOf(value) === -1) errors.push(issue(runtime.path + ' 未包含已确认的 ' + key + '。', 'AD_EXPORT_RUNTIME_PATH_MISMATCH'));
                });
            }
            (entries || []).forEach(function(entry) {
                if (/^(?:src|node_modules)(?:\/|$)|^package(?:-lock)?\.json$/i.test(normalizePath(entry.path))) errors.push(issue('React 部署 ZIP 不得包含源码或依赖：' + entry.path, 'AD_EXPORT_REACT_SOURCE_LEAK'));
            });
        } else if (reactSource) {
            const runtime = entryByPath(entries, 'public/js/ad.js');
            const component = (entries || []).find(function(entry) { return /^src\/components\/advertisement\.(?:tsx|jsx)$/i.test(normalizePath(entry.path || entry.name)); });
            const sourceText = (entries || []).map(function(entry) { return entryText(entry); }).join('\n');
            if (!component) errors.push(issue('React 源码缺少可复用广告组件 src/components/advertisement.tsx 或 .jsx。', 'AD_EXPORT_REACT_COMPONENT_MISSING'));
            else {
                const componentText = entryText(component);
                ['adv1', 'div-gpt-ad-banner1', 'refreshClarivoBanners'].forEach(function(token) {
                    if (componentText.indexOf(token) === -1) errors.push(issue(component.path + ' 缺少 ' + token + '，广告组件不完整。', 'AD_EXPORT_REACT_COMPONENT_INCOMPLETE'));
                });
            }
            if (!runtime) errors.push(issue('React 源码缺少广告运行时 public/js/ad.js。', 'AD_EXPORT_RUNTIME_MISSING'));
            else {
                const runtimeText = entryText(runtime);
                const runtimeTokens = settings && settings.version && settings.version !== 'initial'
                    ? ['div-gpt-ad-banner', 'refreshClarivoBanners', 'function loadNativeBanner', 'googletag.setConfig', 'googletag.destroySlots(previousSlots)', '[Init] Interstitial 已定义', '[Init] Anchor 已定义']
                    : ['div-gpt-ad-banner', 'refreshClarivoBanners', 'function delayLoadBanner', 'new IntersectionObserver', 'googletag.destroySlots(previousSlots)', '[LazyLoad] 初始化监控:', '[Init] Interstitial 已定义', '[Init] Anchor 已定义'];
                runtimeTokens.forEach(function(token) {
                    if (runtimeText.indexOf(token) === -1) errors.push(issue(runtime.path + ' 缺少 ' + token + '，SPA 广告重扫不完整。', 'AD_EXPORT_SPA_RUNTIME_INCOMPLETE'));
                });
                ['data-sitefoundry-runtime-ad', 'new MutationObserver'].forEach(function(token) {
                    if (runtimeText.indexOf(token) !== -1) errors.push(issue(runtime.path + ' 不应在 React 源码站动态创建或全页监听广告容器：' + token + '。', 'AD_EXPORT_REACT_RUNTIME_MODE_MISMATCH'));
                });
                ['bannerPath1', 'bannerPath2', 'bannerPath3', 'interstitialPath', 'anchorPath', 'analyticsID'].forEach(function(key) {
                    const value = String((config || {})[key] || '');
                    if (value && runtimeText.indexOf(value) === -1) errors.push(issue(runtime.path + ' 未包含已确认的 ' + key + '。', 'AD_EXPORT_RUNTIME_PATH_MISMATCH'));
                });
            }
            if (countText(sourceText, /securepubads\.g\.doubleclick\.net\/tag\/js\/gpt\.js/gi) !== 1) errors.push(issue('React 源码中的 GPT 加载脚本必须且只能存在一次。', 'AD_EXPORT_GPT_COUNT'));
            if (countText(sourceText, /["']\/js\/ad\.js["']/gi) !== 1) errors.push(issue('React 源码中的 /js/ad.js 加载脚本必须且只能存在一次。', 'AD_EXPORT_RUNTIME_COUNT'));
            (changedPages || []).forEach(function(path) {
                const page = entryByPath(entries, path);
                if (!page) { errors.push(issue('导出源码缺少已修改页面 ' + path + '。', 'AD_EXPORT_PAGE_MISSING')); return; }
                checkedPages.push(page.path);
                const pageText = entryText(page);
                if (!/Advertisement/.test(pageText) || !/components\/advertisement/.test(pageText)) errors.push(issue(path + '：未找到广告组件导入与广告位。', 'AD_EXPORT_REACT_PAGE_INCOMPLETE'));
            });
            warnings.push(issue('浏览器未执行 npm install 或生产构建；本次导出的是已加入广告代码的完整 React 源码，请在项目环境完成构建。', 'AD_EXPORT_REACT_SOURCE_BUILD_REQUIRED'));
        } else {
            (changedPages || []).forEach(function(path) {
                const deploymentRoot = normalizePath(project && project.deploymentRoot || '');
                const relative = deploymentRoot && path.indexOf(deploymentRoot) === 0 ? path.slice(deploymentRoot.length) : path;
                const page = entryByPath(entries, relative) || entryByPath(entries, path);
                if (!page) { errors.push(issue('导出内容缺少已修改页面 ' + path + '。', 'AD_EXPORT_PAGE_MISSING')); return; }
                checkedPages.push(page.path);
                // Injection treats only the detected entry as home. Use that
                // identity here too: games/news/category routes use detail slots.
                let pageType = normalizePath(page.path).toLowerCase() === normalizePath(output.entryPath || 'index.html').toLowerCase() ? 'home' : 'detail';
                if (pageType !== 'home' && typeof FinishedSiteAds !== 'undefined') {
                    const doc = typeof DOMParser !== 'undefined' ? new DOMParser().parseFromString(entryText(page), 'text/html') : null;
                    const typed = FinishedSiteAds.contentPageType(page.path, doc, output.entryPath || 'index.html');
                    if (policy.slots[typed]) pageType = typed;
                }
                const relativePath = relativeAdScriptPath(page.path, '');
                const checks = validateRestoredHtml(entryText(page), pageType, relativePath + '?v=ad-policy-1', policy, { finishedSite: true });
                checks.forEach(function(check) { errors.push(issue(path + '：' + check.message, check.code)); });
            });
            const runtime = entryByPath(entries, 'js/ad.js');
            if (!runtime) warnings.push(issue('未在根目录找到 js/ad.js；已按每页相对路径校验其引用。', 'AD_EXPORT_STATIC_RUNTIME_NESTED'));
        }
        return { valid: errors.length === 0, errors: errors, warnings: warnings, checkedPages: checkedPages, manifestPath: manifestPath, exportScope: reactBuild ? '仅部署产物（构建输出目录）' : reactSource ? '已注入广告的完整 React 源码（需要在项目环境构建）' : '完整静态站源码' };
    }

    function injectionReportText(results) {
        const lines = ['成品站广告注入与导出核验报告', '生成时间：' + new Date().toISOString(), '规则：静态副本仅包含加入广告后的部署文件；源码副本保留原工程并加入广告，具有构建流程的静态源码会自动接入构建后的广告注入步骤。原上传文件保持不变。', ''];
        results.forEach(function(result) {
            lines.push((result.valid ? '[成功] ' : '[失败] ') + result.siteName);
            if (result.framework) lines.push('  识别类型：' + result.framework);
            if (result.host) lines.push('  广告域名：' + result.host);
            if (result.changedPages != null) lines.push('  修改入口/页面：' + result.changedPages + ' 个');
            if (result.valid && result.runtimePath) lines.push('  广告脚本已写入（导出包内路径）：' + result.runtimePath);
            if (result.adJsVersion) lines.push('  ad.js 版本：' + result.adJsVersion);
            if (result.changedScripts && result.changedScripts.length) lines.push('  修改/新增脚本：' + result.changedScripts.join('、'));
            if (result.buildCommand) lines.push('  构建命令：' + result.buildCommand);
            if (result.buildHook) lines.push('  构建后自动注入广告：' + result.buildHook);
            if (result.exportScope) lines.push('  ZIP 内容范围：' + result.exportScope);
            if (result.verification) lines.push('  已核验页面：' + (result.verification.checkedPages || []).join('、'));
            (result.errors || []).forEach(function(error) { lines.push('  错误：' + error.message); });
            (result.warnings || []).forEach(function(warning) {
                const message = result.valid && result.runtimePath && warning.code === 'RESTORE_AD_JS_CREATE'
                    ? '源站未提供 js/ad.js；本次已新建广告脚本并写入导出包。'
                    : warning.message;
                lines.push('  提示：' + message);
            });
            lines.push('');
        });
        return lines.join('\r\n');
    }

    async function applyAdCodeBatch(siteGroups, codeResults, onProgress, requestedPolicy, reactSourceInjector, sourceExporter) {
        const exportMode = requestedPolicy && requestedPolicy.exportMode || 'auto';
        if (['auto', 'static', 'source'].indexOf(exportMode) === -1) throw new Error('无法识别导出内容，请重新选择静态副本或完整源码。');
        const inputs = exportMode === 'static' ? Array.from(siteGroups || []).map(staticDeploymentSite) : siteGroups;
        const match = matchAdCodesToSites(inputs, codeResults);
        onProgress = typeof onProgress === 'function' ? onProgress : function() {};
        const outputs = [];
        const results = [];
        const usedNames = {};
        for (let index = 0; index < match.mappings.length; index++) {
            const mapping = match.mappings[index];
            onProgress(Math.round(index / Math.max(1, match.mappings.length) * 82), '正在为 ' + mapping.siteName + ' 加入广告…');
            if (!mapping.valid) {
                results.push({ valid: false, siteName: mapping.siteName, framework: mapping.framework, host: mapping.host, errors: mapping.errors, warnings: mapping.warnings });
                continue;
            }
            const batchSettings = requestedPolicy && requestedPolicy.mode
                ? requestedPolicy : { mode: 'manual', version: 'initial', policy: requestedPolicy };
            const override = batchSettings.overrides && batchSettings.overrides[mapping.site.id];
            const settings = override || batchSettings;
            const effectivePolicy = normalizePolicy(settings.policy);
            ['banner1', 'banner2', 'banner3'].forEach(function(unit) {
                if (mapping.code.config[unit.replace('banner', 'bannerPath')]) return;
                policyPages(effectivePolicy).forEach(function(page) {
                    effectivePolicy.slots[page].forEach(function(slot) {
                        if (slot.unit === unit) { slot.unit = 'off'; slot.position = 'off'; }
                    });
                });
            });
            if (mapping.project.kind === 'react-source' && typeof reactSourceInjector !== 'function') {
                results.push({
                    valid: false, siteName: mapping.siteName, framework: mapping.framework, host: mapping.host,
                    errors: [issue('React 源码注入器未加载，无法安全修改 JSX/TSX。请刷新工具后重试。', 'AD_EXPORT_REACT_SOURCE_INJECTOR_UNAVAILABLE')],
                    warnings: mapping.warnings, buildCommand: mapping.project.buildCommand || 'npm run build'
                });
                continue;
            }
            // Source JSX is not the rendered page: one component may expand to
            // a whole directory or a client-loaded article. Resolve all React
            // workflow positions against the same DOM used by the preview,
            // including ordinary Vite projects with a root index.html.
            const dynamicManual = settings.mode === 'manual' && mapping.project.kind === 'react-source';
            const runtimeOptions = { waitForLoad: /Next\.js|React/.test(mapping.project.framework || '') };
            const fixedRuntime = settings.mode === 'fixed' && typeof FinishedSiteAds !== 'undefined'
                ? FinishedSiteAds.dynamicRuntimeSource(mapping.code.config, settings.version, runtimeOptions) : '';
            const manualRuntime = dynamicManual ? generateSpaAdRuntime(mapping.code.config, effectivePolicy, settings.version, runtimeOptions) : '';
            const injected = mapping.project.kind === 'react-source'
                ? reactSourceInjector(mapping.site.entries, mapping.project, mapping.code.config, effectivePolicy, mapping.siteName,
                    fixedRuntime || manualRuntime || generateReactSourceAdRuntime(mapping.code.config, settings.version),
                    Object.assign({}, settings, { renderedPlacement: dynamicManual }))
                : injectAdsIntoSiteEntries(mapping.site.entries, mapping.code.config, mapping.siteName, effectivePolicy, settings);
            if (!injected.valid) {
                results.push({ valid: false, siteName: mapping.siteName, framework: mapping.framework, host: mapping.host, errors: injected.errors, warnings: mapping.warnings.concat(injected.warnings || []) });
                continue;
            }
            const exportedEntries = deploymentEntries(injected.entries, mapping.project);
            const verification = settings.mode === 'fixed' || dynamicManual
                ? verifyFixedInjectedOutput(exportedEntries, mapping.project, mapping.code.config, settings, injected.changedPages || [])
                : verifyInjectedOutput(exportedEntries, mapping.project, mapping.code.config, effectivePolicy, injected.changedPages || [], settings);
            if (!verification.valid) {
                results.push({
                    valid: false, siteName: mapping.siteName, framework: mapping.framework, host: mapping.host,
                    errors: verification.errors, warnings: mapping.warnings.concat(injected.warnings || [], verification.warnings || []),
                    verification: verification, buildCommand: mapping.project.buildCommand || '', exportScope: verification.exportScope
                });
                continue;
            }
            const baseName = siteFolderName(mapping.siteName, mapping.host || 'site');
            const key = baseName.toLowerCase();
            usedNames[key] = (usedNames[key] || 0) + 1;
            const outputName = usedNames[key] === 1 ? baseName : baseName + '-' + usedNames[key];
            const runtime = entryByPath(exportedEntries, outputProject(mapping.project).runtimePath || 'js/ad.js');
            const originalDeployment = deploymentEntries(mapping.site.entries, mapping.project);
            let sourceOutput = null;
            if (exportMode === 'source') {
                if (typeof sourceExporter !== 'function') throw new Error('源码导出组件未加载，请刷新工具后重试。');
                sourceOutput = await sourceExporter({
                    sourceEntries: mapping.site.sourceEntries || mapping.site.entries, injectedEntries: exportedEntries,
                    deploymentRoot: mapping.site.sourceDeploymentRoot || mapping.project.deploymentRoot || mapping.project.siteRoot || '',
                    config: mapping.code.config, policy: effectivePolicy, settings: settings, siteName: mapping.siteName, project: mapping.project
                });
            }
            outputs.push({ name: outputName, entries: sourceOutput ? sourceOutput.entries : exportedEntries, policy: effectivePolicy,
                sourcePublicRoot: mapping.project.kind === 'react-source' ? 'public/' : undefined,
                sourceProject: mapping.project.kind === 'react-source',
                preflightEntries: sourceOutput ? exportedEntries : undefined,
                sourceOriginalEntries: sourceOutput ? mapping.site.sourceEntries || mapping.site.entries : undefined,
                originalEntries: originalDeployment });
            results.push({ valid: true, siteName: mapping.siteName, outputName: outputName, framework: mapping.framework, host: mapping.host,
                runtimePath: sourceOutput ? outputName + '/' + sourceOutput.runtimePath : runtime ? outputName + '/' + normalizePath(runtime.path) : '',
                adJsVersion: runtime ? settings.version || detectAdJsVersion(entryText(runtime)) : '',
                buildHook: sourceOutput && sourceOutput.buildHook || '',
                changedPages: (injected.changedPages || []).length, changedScripts: injected.changedScripts || [], errors: [], warnings: mapping.warnings.concat(injected.warnings || [], verification.warnings || []), verification: verification,
                buildCommand: sourceOutput ? sourceOutput.buildCommand : mapping.project.buildCommand || '',
                exportScope: sourceOutput ? sourceOutput.exportScope : exportMode === 'static' ? '仅静态站点部署副本' : verification.exportScope });
        }
        if (results.some(function(result) { return !result.valid; })) {
            const error = new Error('至少一个成品站未通过构建/广告/位置核验；为避免下载不完整批次，已阻止整个导出。');
            error.results = results;
            throw error;
        }
        if (!outputs.length) {
            const error = new Error('没有任何成品站通过结构识别与广告代码匹配校验。');
            error.results = results;
            throw error;
        }
        const batch = {
            folderName: outputFolderName().replace('广告策略处理-', '成品站广告注入-'),
            sites: outputs,
            results: results,
            reportName: '成品站广告注入报告.txt',
            report: injectionReportText(results)
        };
        onProgress(100, '成品站广告注入完成');
        return batch;
    }

    async function exportRecognizedCodesForGroups(siteGroups) {
        const sites = Array.from(siteGroups || []);
        if (!sites.length) throw new Error('请先识别站点。');
        const exports = [];
        const results = [];
        const usedNames = {};
        sites.forEach(function(site) {
            const metadata = site.metadata && site.metadata.valid ? site.metadata : inspectSiteEntries(site.entries, site.name);
            if (!metadata.valid) {
                results.push({ valid: false, archiveName: site.name, errors: metadata.errors, warnings: metadata.warnings });
                return;
            }
            const baseName = recognizedCodeFileName(metadata);
            const nameKey = baseName.toLowerCase();
            const occurrence = (usedNames[nameKey] || 0) + 1;
            usedNames[nameKey] = occurrence;
            const name = occurrence === 1 ? baseName : baseName.replace(/\.txt$/i, '') + '-' + occurrence + '.txt';
            exports.push({ name: name, text: generateRecognizedAdCode(metadata.embeddedConfig, site.name) });
            results.push({ valid: true, archiveName: site.name, host: metadata.detectedHost, outputName: name, errors: [], warnings: metadata.warnings });
        });
        if (!exports.length) {
            const error = new Error('没有任何站点可以完整识别广告代码。');
            error.results = results;
            throw error;
        }
        if (exports.length === 1 && results.length === 1) {
            return { blob: new Blob([exports[0].text], { type: 'text/plain;charset=utf-8' }), fileName: exports[0].name, results: results };
        }
        const zip = new JSZip();
        exports.forEach(function(item) { zip.folder('recognized-ad-codes').file(item.name, item.text); });
        const blob = await packArchive(zip, { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        return { blob: blob, fileName: 'recognized-ad-codes-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.zip', results: results };
    }

    function policySummary(policy) {
        const normalized = normalizePolicy(policy);
        const active = { home: [], detail: [], all: [] };
        policyPages(normalized).forEach(function(page) {
            normalized.slots[page].forEach(function(slot, index) {
                if (slot.unit !== 'off') active[page].push('广告位' + (index + 1) + '=' + slot.position + '→' + slot.unit);
            });
        });
        return {
            home: active.home.length ? active.home.join('，') : '全部关闭',
            detail: active.detail.length ? active.detail.join('，') : '全部关闭',
            all: active.all.length ? active.all.join('，') : '全部关闭',
            interstitial: '首页' + (normalized.outOfPage.interstitial.home ? '开' : '关') + '/详情' + (normalized.outOfPage.interstitial.detail ? '开' : '关'),
            anchor: '首页' + (normalized.outOfPage.anchor.home ? '开' : '关') + '/详情' + (normalized.outOfPage.anchor.detail ? '开' : '关')
        };
    }

    function policyReportText(results, globalPolicy, adJsVersionMode) {
        const summary = policySummary(globalPolicy);
        const versionRule = adJsVersionMode !== 'original'
            ? '统一切换到 ' + adJsVersionMode + '（保留各站广告路径和 GA ID）'
            : '保留各站识别到的原版本';
        const lines = [
            '批量广告策略处理报告',
            '生成时间：' + new Date().toISOString(),
            '输出规则：新建站点总目录，不覆盖源文件；关闭的广告路径保留在 ad-policy.json，启用源码注释时也保留在 js/ad.js 的注释中。',
            'ad.js 模板：' + versionRule,
            '全局首页：' + summary.home,
            '全局详情：' + summary.detail,
            '全局全部文章页：' + (normalizePolicy(globalPolicy).slots.all ? summary.all : '沿用旧详情页配置'),
            '全局插屏：' + summary.interstitial,
            '全局锚点：' + summary.anchor,
            ''
        ];
        results.forEach(function(result) {
            lines.push((result.valid ? '[成功] ' : '[失败] ') + result.siteName + (result.overridden ? '（单站覆盖）' : '（全局方案）'));
            if (result.host) lines.push('  广告域名：' + result.host);
            if (result.sourceAdJsVersion && result.adJsVersion && result.sourceAdJsVersion !== result.adJsVersion) {
                lines.push('  ad.js 版本：' + result.sourceAdJsVersion + ' → ' + result.adJsVersion);
            } else if (result.adJsVersion) {
                lines.push('  ad.js 版本：' + result.adJsVersion);
            }
            if (result.changedPages != null) lines.push('  修改页面：' + result.changedPages + ' 个');
            (result.errors || []).forEach(function(error) { lines.push('  错误：' + error.message); });
            (result.warnings || []).forEach(function(warning) { lines.push('  提示：' + warning.message); });
            lines.push('');
        });
        return lines.join('\r\n');
    }

    function outputFolderName(now) {
        const date = now || new Date();
        const pad = function(value) { return String(value).padStart(2, '0'); };
        return '广告策略处理-' + date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()) + '-' + pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds()) + '-' + String(date.getMilliseconds()).padStart(3, '0');
    }

    // 预览与导出共用纯处理入口；替换代码仅覆盖广告配置，不写回原包。
    function allowedPagePositions(page) {
        return page === 'home' ? HOME_PLACEMENTS : page === 'all' ? ALL_PLACEMENTS : DETAIL_PLACEMENTS;
    }

    // 原位置以独立数据保存，不能从已经删除的广告容器或统一默认值反推。
    // 工作台只在用户实际编辑位置时调用，可指定一个字段，避免带入其他临时预设位置。
    function rememberPolicyPositions(site, requestedPolicy, field) {
        const selected = field && String(field).match(/^slots\.(home|detail|all)\.([012])\.position$/);
        if (field && !selected) return;
        const policy = normalizePolicy(requestedPolicy);
        const positions = site.restorePositions || (site.restorePositions = {});
        policyPages(policy).forEach(function(page) {
            positions[page] = positions[page] || [];
            policy.slots[page].forEach(function(slot, index) {
                if (selected && (selected[1] !== page || Number(selected[2]) !== index)) return;
                if (selected && ORIGINAL_PLACEMENT_PATTERN.test(slot.position)) {
                    delete positions[page][index];
                    return;
                }
                if (!ORIGINAL_PLACEMENT_PATTERN.test(slot.position)) positions[page][index] = slot.position;
            });
        });
    }

    function originMarker(index) { return '<!-- SITEFOUNDRY_AD_ORIGIN banner' + (index + 1) + ' -->'; }

    // 使用实际容器所在的间隙，保留每篇详情的原位置；不把脚本字符串当作 DOM。
    // 旧版禁用块统一写在页脚，不能将其误当作关闭前的位置。
    function markOriginalAdGaps(source) {
        let html = String(source || '');
        for (let index = 0; index < 3; index++) {
            if (html.indexOf(originMarker(index)) >= 0) continue;
            const masked = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<!--[\s\S]*?-->/gi, function(block) { return ' '.repeat(block.length); });
            const id = '(?:adv' + (index + 1) + '|div-gpt-ad-banner' + (index + 1) + ')';
            const container = new RegExp('<div\\b[^>]*\\bid\\s*=\\s*["\']' + id + '["\'][^>]*>', 'i').exec(masked);
            let at = container ? container.index : -1;
            if (at < 0) {
                const comments = /<!--[\s\S]*?-->/g;
                const commentSource = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, function(block) { return ' '.repeat(block.length); });
                let comment;
                while ((comment = comments.exec(commentSource))) {
                    if (/AD_POLICY_DISABLED_START|SITEFOUNDRY_AD_ORIGIN/.test(comment[0])) continue;
                    if (new RegExp('<div\\b[^>]*\\bid\\s*=\\s*["\']' + id + '["\']', 'i').test(comment[0])) { at = comment.index; break; }
                }
            }
            if (at >= 0) html = html.slice(0, at) + originMarker(index) + html.slice(at);
        }
        return html;
    }

    function capturePolicyOrigins(site, metadata) {
        const manifestEntry = site.entries.find(function(entry) { return normalizePath(entry.path).toLowerCase() === (metadata.siteRoot + 'ad-policy.json').toLowerCase(); });
        let saved = {};
        try { saved = manifestEntry ? JSON.parse(entryText(manifestEntry)) : {}; } catch (error) { /* 旧清单损坏时回退到 HTML，不阻止可靠识别的站点。 */ }
        const positions = {};
        ['home', 'detail', 'all'].forEach(function(page) {
            positions[page] = [0, 1, 2].map(function(index) {
                const savedSlots = saved.policy && saved.policy.slots && saved.policy.slots[page];
                const candidates = [site.restorePositions && site.restorePositions[page] && site.restorePositions[page][index],
                    saved.originalPlacements && saved.originalPlacements.positions && saved.originalPlacements.positions[page] && saved.originalPlacements.positions[page][index],
                    savedSlots && savedSlots[index] && savedSlots[index].position];
                return candidates.find(function(position) { return position !== 'off' && isAllowedPlacement(position, allowedPagePositions(page)); }) || 'original-banner' + (index + 1);
            });
        });
        const pagePaths = [metadata.homePath].concat(metadata.detailPaths, metadata.listingPaths || []);
        const entries = site.entries.map(function(entry) {
            return pagePaths.indexOf(entry.path) < 0 ? entry : { path: entry.path, bytes: textBytes(markOriginalAdGaps(entryText(entry))) };
        });
        // 部分旧站会用 CONFIG.homeAds 重绘首页。同步它的原位置，避免重绘后又跳回统一位置。
        const dynamicHomePositions = Object.assign({}, saved.originalPlacements && saved.originalPlacements.dynamicHomePositions);
        entries.forEach(function(entry) {
            if (!/\.js$/i.test(entry.path) || !/CONFIG\.homeAds/.test(entryText(entry))) return;
            const match = entryText(entry).match(/\bhomeAds\s*:\s*(\{[\s\S]*?\})(?=\s*[,}])/);
            if (!match) return;
            try {
                const homeAds = JSON.parse(match[1]);
                Object.keys(homeAds).forEach(function(position) {
                    if (!isAllowedPlacement(position, HOME_PLACEMENTS)) return;
                    [0, 1, 2].forEach(function(index) {
                        if (new RegExp('(?:adv' + (index + 1) + '|div-gpt-ad-banner' + (index + 1) + ')').test(homeAds[position]) && !dynamicHomePositions[index]) dynamicHomePositions[index] = position;
                    });
                });
            } catch (error) { /* 非 JSON 的第三方配置不执行，使用静态原位置或默认位置。 */ }
        });
        return { entries: entries, positions: positions, dynamicHomePositions: dynamicHomePositions };
    }

    function preparePolicySite(site, requestedPolicy, options) {
        options = options || {};
        const metadata = site.metadata && site.metadata.valid ? site.metadata : inspectSiteEntries(site.entries, site.name);
        if (!metadata.valid) return { valid: false, metadata: metadata, errors: metadata.errors, warnings: metadata.warnings };
        if (!metadata.adJsVersion) return { valid: false, metadata: metadata, errors: [issue('无法可靠识别原站 ad.js 版本。', 'RESTORE_AD_VERSION_UNKNOWN')], warnings: metadata.warnings };
        const code = options.codeOverride;
        if (code) {
            if (!code.valid) return { valid: false, metadata: metadata, errors: code.errors || [issue('替换广告代码无效。', 'POLICY_CODE_INVALID')], warnings: [] };
            if (!code.detectedHost || code.detectedHost.toLowerCase() !== String(metadata.detectedHost || '').toLowerCase()) {
                return { valid: false, metadata: metadata, errors: [issue('广告代码域名 ' + (code.detectedHost || '未识别') + ' 与当前站点 ' + metadata.detectedHost + ' 不匹配。', 'POLICY_CODE_HOST_MISMATCH')], warnings: [] };
            }
        }
        const mode = normalizeBatchAdJsVersionMode(options.adJsVersionMode);
        const config = code ? code.config : metadata.embeddedConfig;
        const origins = capturePolicyOrigins(site, metadata);
        const policy = normalizePolicy(requestedPolicy);
        const savedPositions = {};
        policyPages(policy).forEach(function(page) {
            policy.slots[page].forEach(function(slot) {
                const original = slot.position.match(ORIGINAL_PLACEMENT_PATTERN);
                if (original) {
                    // In template reuse, the currently uploaded DOM is the
                    // original layout even when an older manifest records a
                    // semantic preset. Only explicit manual edits override it.
                    const paths = page === 'home' ? [metadata.homePath] : page === 'all' ? metadata.listingPaths || [] : metadata.detailPaths;
                    const hasTemplateNode = site.preserveTemplateLayout && paths.some(function(path) {
                        const entry = site.entries.find(entry => entry.path === path);
                        return entry && (originalAdElement(entryText(entry), 'adv' + original[1]) || originalAdElement(entryText(entry), 'div-gpt-ad-banner' + original[1]));
                    });
                    if (!hasTemplateNode) slot.position = origins.positions[page][Number(original[1]) - 1];
                }
            });
            // 关闭时也记录当前选择的间隙，导出后重新导入仍能恢复。
            // 限流预设只生成临时布局，其原位置清单必须继续使用进入预设前的记录。
            savedPositions[page] = policy.slots[page].map(function(slot, index) {
                return options.preserveOriginalPlacements ? origins.positions[page][index] : slot.position;
            });
        });
        const originalDynamicPositions = Object.assign({}, origins.dynamicHomePositions);
        const dynamicPolicy = normalizePolicy(policy);
        dynamicPolicy.slots.home.forEach(function(slot, index) {
            const original = slot.position.match(ORIGINAL_PLACEMENT_PATTERN);
            if (original) slot.position = origins.dynamicHomePositions[Number(original[1]) - 1] || DEFAULT_POLICY.slots.home[index].position;
            origins.dynamicHomePositions[index] = slot.position;
        });
        const result = restoreEntries(origins.entries, config, site.name, policy, {
            batchPolicy: true, batchAdJsVersion: mode === 'original' ? metadata.adJsVersion : mode,
            preserveTemplateContainers: !!site.preserveTemplateLayout,
            dynamicHomePolicy: dynamicPolicy,
            originalPlacements: { version: 1, positions: savedPositions, dynamicHomePositions: options.preserveOriginalPlacements ? originalDynamicPositions : origins.dynamicHomePositions }
        });
        result.metadata = metadata;
        result.config = config;
        return result;
    }

    async function applyPolicyBatch(siteGroups, globalPolicy, overrides, onProgress, options) {
        const sites = Array.from(siteGroups || []);
        if (!sites.length) throw new Error('请先选择并识别站点总目录。');
        const normalizedGlobal = normalizePolicy(globalPolicy);
        overrides = overrides || {};
        options = options || {};
        // 只接受内置且经过验证的模板版本；未知值统一回落到保留原版。
        const adJsVersionMode = normalizeBatchAdJsVersionMode(options.adJsVersionMode);
        onProgress = typeof onProgress === 'function' ? onProgress : function() {};
        const results = [];
        const outputs = [];
        const usedNames = {};

        for (let index = 0; index < sites.length; index++) {
            const site = sites[index];
            const override = overrides[site.id] || overrides[site.name] || null;
            const policy = normalizePolicy(override || normalizedGlobal);
            onProgress(Math.round(index / sites.length * 82), '正在处理 ' + site.name + '…');
            const metadata = site.metadata && site.metadata.valid ? site.metadata : inspectSiteEntries(site.entries, site.name);
            if (!metadata.valid) {
                results.push({ valid: false, siteName: site.name, host: metadata.detectedHost, overridden: !!override, errors: metadata.errors, warnings: metadata.warnings });
                continue;
            }
            if (!metadata.adJsVersion) {
                results.push({
                    valid: false,
                    siteName: site.name,
                    host: metadata.detectedHost,
                    overridden: !!override,
                    adJsVersion: '',
                    errors: [issue('无法可靠识别该站点的 js/ad.js 版本；为避免恢复或限流时替换成错误模板，已阻止导出。', 'RESTORE_AD_VERSION_UNKNOWN')],
                    warnings: metadata.warnings
                });
                continue;
            }
            const outputAdJsVersion = adJsVersionMode === 'original' ? metadata.adJsVersion : adJsVersionMode;
            const restored = preparePolicySite(site, policy, {
                adJsVersionMode: adJsVersionMode,
                preserveOriginalPlacements: !!options.preserveOriginalPlacements,
                codeOverride: options.codeOverrides && options.codeOverrides[site.id]
            });
            if (!restored.valid) {
                results.push({ valid: false, siteName: site.name, host: metadata.detectedHost, overridden: !!override, sourceAdJsVersion: metadata.adJsVersion, adJsVersion: outputAdJsVersion, errors: restored.errors, warnings: restored.warnings });
                continue;
            }
            const baseName = siteFolderName(site.name, metadata.detectedHost || 'site');
            const nameKey = baseName.toLowerCase();
            const occurrence = (usedNames[nameKey] || 0) + 1;
            usedNames[nameKey] = occurrence;
            const outputName = occurrence === 1 ? baseName : baseName + '-' + occurrence;
            outputs.push({ name: outputName, entries: restored.entries, policy: policy });
            results.push({
                valid: true,
                siteName: site.name,
                outputName: outputName,
                host: metadata.detectedHost,
                sourceAdJsVersion: metadata.adJsVersion,
                adJsVersion: restored.adJsVersion || outputAdJsVersion,
                overridden: !!override,
                changedPages: restored.changedPages.length,
                errors: [],
                warnings: restored.warnings
            });
        }
        if (!outputs.length) {
            const error = new Error('没有任何站点通过广告策略校验。');
            error.results = results;
            throw error;
        }
        onProgress(88, '正在生成策略报告…');
        const batch = {
            folderName: outputFolderName(),
            sites: outputs,
            results: results,
            report: policyReportText(results, normalizedGlobal, adJsVersionMode)
        };
        onProgress(100, '策略处理完成');
        return batch;
    }

    async function writePolicyBatchToDirectory(batch, destinationHandle, onProgress) {
        if (!batch || !batch.sites || !destinationHandle || typeof destinationHandle.getDirectoryHandle !== 'function') {
            throw new Error('无法访问输出目录。');
        }
        onProgress = typeof onProgress === 'function' ? onProgress : function() {};
        const rootHandle = await destinationHandle.getDirectoryHandle(batch.folderName, { create: true });
        let completed = 0;
        const total = batch.sites.reduce(function(sum, site) { return sum + site.entries.length; }, 1) + 1;

        async function writeEntry(siteHandle, entry) {
            const parts = normalizePath(entry.path).split('/').filter(Boolean);
            const fileName = parts.pop();
            let directory = siteHandle;
            for (let index = 0; index < parts.length; index++) {
                directory = await directory.getDirectoryHandle(parts[index], { create: true });
            }
            const fileHandle = await directory.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(entry.bytes);
            await writable.close();
        }

        for (let siteIndex = 0; siteIndex < batch.sites.length; siteIndex++) {
            const site = batch.sites[siteIndex];
            const siteHandle = await rootHandle.getDirectoryHandle(site.name, { create: true });
            for (let entryIndex = 0; entryIndex < site.entries.length; entryIndex++) {
                await writeEntry(siteHandle, site.entries[entryIndex]);
                completed++;
                if (completed % 20 === 0) onProgress(Math.round(completed / total * 100), '正在写入 ' + site.name + '…');
            }
        }
        const reportHandle = await rootHandle.getFileHandle(batch.reportName || '广告策略处理报告.txt', { create: true });
        const reportWritable = await reportHandle.createWritable();
        await reportWritable.write(batch.report);
        await reportWritable.close();
        onProgress(100, '已写入新的站点总目录');
        return batch.folderName;
    }

    async function zipPolicyBatch(batch) {
        if (typeof JSZip === 'undefined') throw new Error('ZIP 打包组件未加载。');
        const zip = new JSZip();
        batch.sites.forEach(function(site) {
            const folder = zip.folder(site.name);
            site.entries.forEach(function(entry) { folder.file(entry.path, archiveBytes(entry.bytes)); });
        });
        zip.file(batch.reportName || '广告策略处理报告.txt', batch.report);
        return packArchive(zip, { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    }

    // Packaging stays separate from the ad planner. Legacy embedders retain the
    // old JSZip path when they have not loaded the shared performance helpers.
    function packArchive(zip, options) {
        return typeof ArchiveExport !== 'undefined' ? ArchiveExport.generate(zip, options) : zip.generateAsync(options);
    }

    function archiveBytes(value) {
        return typeof ArchiveExport !== 'undefined' ? ArchiveExport.bytes(value) : Array.from(value || []);
    }

    async function zipEntries(entries, outputType) {
        if (typeof JSZip === 'undefined') throw new Error('ZIP 打包组件未加载。');
        const zip = new JSZip();
        // Shared helpers normalize cross-realm byte views without expanding
        // every byte into a boxed number; legacy callers retain array fallback.
        entries.forEach(function(entry) { zip.file(entry.path, archiveBytes(entry.bytes)); });
        return packArchive(zip, { type: outputType || 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    }

    function reportText(results) {
        const lines = [
            '批量广告恢复报告',
            '生成时间：' + new Date().toISOString(),
            '规则：从源站现有及注释代码提取广告单元，恢复为普通建站的默认导出效果。',
            ''
        ];
        results.forEach(function(result) {
            lines.push((result.valid ? '[成功] ' : '[失败] ') + result.archiveName);
            if (result.host) lines.push('  子域名：' + result.host);
            lines.push('  广告配置：从源站已有代码（包括注释代码）中自动恢复');
            if (result.changedPages) lines.push('  恢复页面：' + result.changedPages + ' 个');
            (result.errors || []).forEach(function(error) { lines.push('  错误：' + error.message); });
            (result.warnings || []).forEach(function(warning) { lines.push('  提示：' + warning.message); });
            lines.push('');
        });
        return lines.join('\r\n');
    }

    async function restoreBatch(siteFiles, onProgress) {
        const sites = Array.from(siteFiles || []);
        if (!sites.length) throw new Error('请至少选择一个站点压缩包。');
        onProgress = typeof onProgress === 'function' ? onProgress : function() {};

        const results = [];
        const restoredArchives = [];
        for (let index = 0; index < sites.length; index++) {
            const file = sites[index];
            onProgress(Math.round(index / sites.length * 82), '正在识别 ' + file.name + '…');
            try {
                const entries = await readArchive(file);
                const metadata = inspectSiteEntries(entries, file.name);
                if (!metadata.valid) {
                    results.push({ valid: false, archiveName: file.name, errors: metadata.errors, warnings: metadata.warnings });
                    continue;
                }
                const restored = restoreEntries(entries, metadata.embeddedConfig, file.name);
                if (!restored.valid) {
                    results.push({ valid: false, archiveName: file.name, host: metadata.detectedHost, errors: restored.errors, warnings: restored.warnings });
                    continue;
                }
                const archiveBytes = await zipEntries(restored.entries, 'uint8array');
                const outputName = archiveBaseName(file.name) + '-ads-restored.zip';
                restoredArchives.push({ name: outputName, bytes: archiveBytes });
                results.push({
                    valid: true,
                    archiveName: file.name,
                    outputName: outputName,
                    host: metadata.detectedHost,
                    changedPages: restored.changedPages.length,
                    errors: [],
                    warnings: restored.warnings
                });
            } catch (error) {
                results.push({ valid: false, archiveName: file.name, errors: [issue(error.message, 'RESTORE_ARCHIVE_READ_FAILED')], warnings: [] });
            }
        }

        if (!restoredArchives.length) {
            const error = new Error('没有任何站点通过识别与恢复校验。');
            error.results = results;
            throw error;
        }

        onProgress(88, '正在生成恢复报告…');
        const report = reportText(results);
        if (sites.length === 1 && results.length === 1 && results[0].valid) {
            onProgress(100, '恢复完成');
            return { blob: new Blob([restoredArchives[0].bytes], { type: 'application/zip' }), fileName: restoredArchives[0].name, results: results, report: report };
        }

        const outer = new JSZip();
        restoredArchives.forEach(function(archive) { outer.file(archive.name, archive.bytes); });
        outer.file('广告恢复报告.txt', report);
        onProgress(94, '正在打包批量结果…');
        const blob = await packArchive(outer, { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        onProgress(100, '恢复完成');
        return { blob: blob, fileName: 'ads-restored-batch-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.zip', results: results, report: report };
    }

    async function exportRecognizedAdCodes(siteFiles, onProgress) {
        const sites = Array.from(siteFiles || []);
        if (!sites.length) throw new Error('请至少选择一个站点压缩包。');
        onProgress = typeof onProgress === 'function' ? onProgress : function() {};
        const results = [];
        const exports = [];
        const usedNames = {};

        for (let index = 0; index < sites.length; index++) {
            const file = sites[index];
            onProgress(Math.round(index / sites.length * 82), '正在识别 ' + file.name + ' 中的广告代码…');
            try {
                const entries = await readArchive(file);
                const metadata = inspectSiteEntries(entries, file.name);
                if (!metadata.valid) {
                    results.push({ valid: false, archiveName: file.name, host: metadata.detectedHost, errors: metadata.errors, warnings: metadata.warnings });
                    continue;
                }
                const baseName = recognizedCodeFileName(metadata);
                const nameKey = baseName.toLowerCase();
                const occurrence = (usedNames[nameKey] || 0) + 1;
                usedNames[nameKey] = occurrence;
                const name = occurrence === 1 ? baseName : baseName.replace(/\.txt$/i, '') + '-' + occurrence + '.txt';
                const text = generateRecognizedAdCode(metadata.embeddedConfig, file.name);
                exports.push({ name: name, text: text });
                results.push({ valid: true, archiveName: file.name, host: metadata.detectedHost, outputName: name, errors: [], warnings: metadata.warnings });
            } catch (error) {
                results.push({ valid: false, archiveName: file.name, errors: [issue(error.message, 'RECOGNIZED_CODE_READ_FAILED')], warnings: [] });
            }
        }

        if (!exports.length) {
            const error = new Error('没有任何站点可以完整识别 banner1/2/3、INT 和 ANC。');
            error.results = results;
            throw error;
        }

        if (sites.length === 1 && exports.length === 1 && results.length === 1 && results[0].valid) {
            onProgress(100, '广告代码识别完成');
            return { blob: new Blob([exports[0].text], { type: 'text/plain;charset=utf-8' }), fileName: exports[0].name, results: results };
        }

        onProgress(90, '正在打包识别到的广告代码…');
        const zip = new JSZip();
        exports.forEach(function(item) { zip.folder('recognized-ad-codes').file(item.name, item.text); });
        const reportLines = ['广告代码识别报告', '生成时间：' + new Date().toISOString(), ''];
        results.forEach(function(result) {
            reportLines.push((result.valid ? '[成功] ' : '[失败] ') + result.archiveName);
            if (result.outputName) reportLines.push('  导出文件：' + result.outputName);
            (result.errors || []).forEach(function(error) { reportLines.push('  错误：' + error.message); });
            (result.warnings || []).forEach(function(warning) { reportLines.push('  提示：' + warning.message); });
            reportLines.push('');
        });
        zip.file('广告代码识别报告.txt', reportLines.join('\r\n'));
        const blob = await packArchive(zip, { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        onProgress(100, '广告代码识别完成');
        return { blob: blob, fileName: 'recognized-ad-codes-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.zip', results: results };
    }

    return {
        inspectCodeText: inspectCodeText,
        inspectSiteEntries: inspectSiteEntries,
        restoreHtml: restoreHtml,
        restoreEntries: restoreEntries,
        preparePolicySite: preparePolicySite,
        rememberPolicyPositions: rememberPolicyPositions,
        extractTarEntries: extractTarEntries,
        restoreBatch: restoreBatch,
        exportRecognizedAdCodes: exportRecognizedAdCodes,
        generateRecognizedAdCode: generateRecognizedAdCode,
        createPolicy: createPolicy,
        normalizePolicy: normalizePolicy,
        validatePolicy: validatePolicy,
        splitSiteEntries: splitSiteEntries,
        readSiteDirectoryFiles: readSiteDirectoryFiles,
        readSiteDirectoryHandle: readSiteDirectoryHandle,
        readSiteArchiveFiles: readSiteArchiveFiles,
        // Generic path/byte entries also serve content sources without requiring
        // them to be classified as complete advertising sites.
        readArchiveEntries: readArchive,
        readRarArchiveEntries: readRarArchive,
        classifyInjectableSiteEntries: classifyInjectableSiteEntries,
        staticDeploymentSite: staticDeploymentSite,
        readInjectableDirectoryFiles: readInjectableDirectoryFiles,
        readInjectableDirectoryHandle: readInjectableDirectoryHandle,
        readInjectableArchiveFiles: readInjectableArchiveFiles,
        readAdvertiserCodeFiles: readAdvertiserCodeFiles,
        matchAdCodesToSites: matchAdCodesToSites,
        generateSpaAdRuntime: generateSpaAdRuntime,
        generateReactSourceAdRuntime: generateReactSourceAdRuntime,
        verifyInjectedOutput: verifyInjectedOutput,
        verifyFixedInjectedOutput: verifyFixedInjectedOutput,
        injectAdsIntoSiteEntries: injectAdsIntoSiteEntries,
        applyAdCodeBatch: applyAdCodeBatch,
        exportRecognizedCodesForGroups: exportRecognizedCodesForGroups,
        applyPolicyBatch: applyPolicyBatch,
        writePolicyBatchToDirectory: writePolicyBatchToDirectory,
        zipPolicyBatch: zipPolicyBatch,
        policySummary: policySummary,
        homePlacements: HOME_PLACEMENTS.slice(),
        previewPlacementHtml: previewPlacementHtml,
        detailPlacements: DETAIL_PLACEMENTS.slice(),
        allPlacements: ALL_PLACEMENTS.slice(),
        bannerUnits: BANNER_UNITS.slice(),
        batchAdJsVersions: BATCH_AD_JS_VERSIONS.slice(),
        normalizeBatchAdJsVersionMode: normalizeBatchAdJsVersionMode,
        readExistingConfig: readExistingConfig,
        siteHostCandidates: siteHostCandidates,
        detectedHost: detectedHost,
        relativeAdScriptPath: relativeAdScriptPath
    };
})();

// app.js is an ES module, so expose the classic-script API explicitly on the
// window object for reliable access across the two script loading models.
if (typeof window !== 'undefined') window.AdRestoration = AdRestoration;
