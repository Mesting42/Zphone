/*
 * 已导出站点的批量广告恢复器。
 * 所有读取、识别、修改和打包均在当前浏览器内完成。
 */
const AdRestoration = (function() {
    'use strict';

    const AD_IDS = ['adv1', 'adv2', 'adv3'];
    const CONTAINER_IDS = ['div-gpt-ad-banner1', 'div-gpt-ad-banner2', 'div-gpt-ad-banner3'];
    const CONFIG_KEYS = ['bannerPath1', 'bannerPath2', 'bannerPath3', 'bannerPath4', 'interstitialPath', 'anchorPath', 'analyticsID'];
    const HOME_PLACEMENTS = ['off', 'after-navbar', 'after-hero', 'content-top', 'after-section-0', 'after-section-1', 'after-section-2', 'content-bottom', 'footer-top'];
    const DETAIL_PLACEMENTS = ['off', 'after-navbar', 'detail-before-content', 'detail-between-p-1', 'detail-between-p-2', 'detail-between-p-3', 'detail-after-content', 'detail-before-related', 'detail-after-related', 'footer-top'];
    const BANNER_UNITS = ['off', 'banner1', 'banner2', 'banner3'];
    const CUSTOM_PLACEMENT_PATTERN = /^custom-after-(?:\d{1,3})(?:-\d{1,3}){0,7}$/;
    const DEFAULT_POLICY = {
        version: 1,
        writeDisabledComments: true,
        slots: {
            home: [
                { position: 'after-navbar', unit: 'banner1' },
                { position: 'after-section-0', unit: 'banner2' },
                { position: 'after-section-1', unit: 'banner3' }
            ],
            detail: [
                { position: 'after-navbar', unit: 'banner1' },
                { position: 'detail-after-content', unit: 'banner2' },
                { position: 'footer-top', unit: 'banner3' }
            ]
        },
        placements: {
            banner1: { home: 'after-navbar', detail: 'after-navbar' },
            banner2: { home: 'after-section-0', detail: 'detail-after-content' },
            banner3: { home: 'after-section-1', detail: 'footer-top' }
        },
        outOfPage: {
            interstitial: { home: true, detail: false },
            anchor: { home: true, detail: true }
        }
    };

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function syncPlacementsFromSlots(policy) {
        policy.placements = {
            banner1: { home: 'off', detail: 'off' },
            banner2: { home: 'off', detail: 'off' },
            banner3: { home: 'off', detail: 'off' }
        };
        ['home', 'detail'].forEach(function(page) {
            (policy.slots[page] || []).forEach(function(slot) {
                if (slot.unit !== 'off' && policy.placements[slot.unit]) policy.placements[slot.unit][page] = slot.position;
            });
        });
        return policy;
    }

    function createPolicy(preset) {
        const policy = clone(DEFAULT_POLICY);
        if (preset === 'traffic-limit') {
            policy.slots.home = [
                { position: 'after-navbar', unit: 'banner3' },
                { position: 'after-section-0', unit: 'off' },
                { position: 'after-section-1', unit: 'off' }
            ];
            policy.slots.detail.forEach(function(slot) { slot.unit = 'off'; });
            policy.outOfPage.interstitial = { home: false, detail: false };
            policy.outOfPage.anchor = { home: false, detail: false };
        } else if (preset === 'home-head-footer') {
            policy.slots.home = [
                { position: 'after-navbar', unit: 'banner1' },
                { position: 'after-section-0', unit: 'off' },
                { position: 'footer-top', unit: 'banner3' }
            ];
        }
        return syncPlacementsFromSlots(policy);
    }

    function isAllowedPlacement(position, allowedPositions) {
        return allowedPositions.indexOf(position) !== -1 || CUSTOM_PLACEMENT_PATTERN.test(String(position || ''));
    }

    function normalizePolicy(input) {
        const policy = clone(DEFAULT_POLICY);
        const source = input || {};
        policy.writeDisabledComments = source.writeDisabledComments !== false;
        if (source.slots && Array.isArray(source.slots.home) && Array.isArray(source.slots.detail)) {
            ['home', 'detail'].forEach(function(page) {
                const allowedPositions = page === 'home' ? HOME_PLACEMENTS : DETAIL_PLACEMENTS;
                policy.slots[page] = policy.slots[page].map(function(defaultSlot, index) {
                    const item = source.slots[page][index] || {};
                    return {
                        position: isAllowedPlacement(item.position, allowedPositions) && item.position !== 'off' ? item.position : defaultSlot.position,
                        unit: BANNER_UNITS.indexOf(item.unit) !== -1 ? item.unit : defaultSlot.unit
                    };
                });
            });
        } else {
            ['home', 'detail'].forEach(function(page) {
                const bannerKeys = ['banner1', 'banner2', 'banner3'];
                policy.slots[page] = bannerKeys.map(function(key, index) {
                    const item = source.placements && source.placements[key] ? source.placements[key] : {};
                    const position = item[page];
                    const allowed = page === 'home' ? HOME_PLACEMENTS : DETAIL_PLACEMENTS;
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
        });
        return syncPlacementsFromSlots(policy);
    }

    function validatePolicy(policyInput) {
        const policy = normalizePolicy(policyInput);
        const errors = [];
        ['home', 'detail'].forEach(function(page) {
            const used = {};
            policy.slots[page].forEach(function(slot, index) {
                if (slot.unit === 'off') return;
                if (used[slot.unit] != null) {
                    errors.push(issue((page === 'home' ? '首页' : '详情页') + '广告位 ' + (used[slot.unit] + 1) + ' 和广告位 ' + (index + 1) + ' 重复使用 ' + slot.unit + '。同一页面的同一 banner 只能使用一次。', 'AD_POLICY_DUPLICATE_UNIT'));
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
        const pattern = new RegExp('(?:\\b(?:const|let|var)\\s+)?\\b' + escapedKey + "\\s*=\\s*(['\"])((?:\\\\.|(?!\\1)[\\s\\S])*)\\1", 'm');
        const match = pattern.exec(String(source || ''));
        return match ? decodeJavaScriptString(match[2]) : '';
    }

    function readExistingConfig(source) {
        return CONFIG_KEYS.reduce(function(config, key) {
            config[key] = extractAssignment(source, key);
            return config;
        }, {});
    }

    function detectedHost(config) {
        const paths = CONFIG_KEYS.filter(function(key) { return key !== 'analyticsID'; })
            .map(function(key) { return config && config[key]; }).filter(Boolean);
        for (let index = 0; index < paths.length; index++) {
            const unit = String(paths[index]).replace(/-(?:banner[1-4]|int|anc)$/i, '');
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

    function inspectSiteEntries(rawEntries, archiveName) {
        const entries = (rawEntries || []).map(function(entry) {
            return { path: normalizePath(entry.path || entry.name), text: entryText(entry), source: entry };
        }).filter(function(entry) { return isSafePath(entry.path); });
        const htmlEntries = entries.filter(function(entry) { return /\.html?$/i.test(entry.path); });
        const indexCandidates = htmlEntries.filter(function(entry) { return /(?:^|\/)index\.html?$/i.test(entry.path); })
            .sort(function(a, b) { return a.path.split('/').length - b.path.split('/').length; });
        let home = null;
        let siteRoot = '';
        let details = [];

        for (let i = 0; i < indexCandidates.length; i++) {
            const candidate = indexCandidates[i];
            const root = candidate.path.replace(/index\.html?$/i, '');
            const candidateDetails = htmlEntries.filter(function(entry) {
                if (entry.path === candidate.path || entry.path.indexOf(root) !== 0) return false;
                const relative = entry.path.slice(root.length);
                return /^(?:details?|articles?)\//i.test(relative) || /class\s*=\s*["'][^"']*\bdetail-page\b/i.test(entry.text);
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
        const embedded = discoverEmbeddedAdConfig(entries, existingConfig);
        const errors = [];
        const warnings = [];
        if (!home) errors.push(issue('压缩包中未识别到站点首页 index.html。', 'RESTORE_HOME_NOT_FOUND'));
        if (!details.length) errors.push(issue('压缩包中未识别到详情页（details/articles 目录或 detail-page 结构）。', 'RESTORE_DETAILS_NOT_FOUND'));
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
            adPath: adPath,
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
                    output = output.slice(0, match.index) + output.slice(end);
                    changed = true;
                    break;
                }
            }
        }
        return output;
    }

    function removeExistingAds(html) {
        let output = String(html || '').replace(/<!--\s*AD_POLICY_DISABLED_START[\s\S]*?AD_POLICY_DISABLED_END\s*-->/gi, '');
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
        return output;
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
        return '<div id="' + adId + '" style="text-align:center;padding:10px;display:flex;flex-direction:column;align-items:center;overflow:hidden;margin-top:1px;"><div style="text-align:center;color:var(--color-text,#111);font-size:13px;">advertisement</div><div id="div-gpt-ad-banner' + number + '" style="min-width:300px;min-height:250px;"></div></div>';
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

    function adGroupMarkup(html, position, adIds) {
        const markup = adIds.map(template).join('\n');
        if (position === 'after-navbar') {
            return '<div class="ad-region ad-after-navbar ad-nav-' + navbarStyle(html) + '">' + markup + '</div>';
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
            return !/\b(?:class|id)\s*=\s*["'][^"']*related/i.test(child.openTag);
        });
    }

    function customPlacementIndex(html, position) {
        if (!CUSTOM_PLACEMENT_PATTERN.test(String(position || ''))) return -1;
        const path = String(position).replace('custom-after-', '').split('-').map(Number);
        let target = findFirstElement(html, 'main') || findFirstElement(html, 'body');
        for (let index = 0; target && index < path.length; index++) {
            const children = meaningfulHtmlElementChildren(html, target);
            if (!children.length) break;
            target = children[Math.min(path[index], children.length - 1)] || null;
        }
        return target && target.end !== -1 ? target.end : -1;
    }

    function insertPlacement(html, pageType, position, adIds) {
        const markup = adGroupMarkup(html, position, adIds);
        let anchor = null;
        let index = -1;

        if (CUSTOM_PLACEMENT_PATTERN.test(String(position || ''))) {
            index = customPlacementIndex(html, position);
        } else if (position === 'footer-top') {
            anchor = findFooter(html);
            index = anchor ? anchor.start : -1;
        } else if (pageType === 'home') {
            const main = findElementByClass(html, 'main', 'main-content');
            const hero = findElementByClass(html, 'section', 'hero');
            if (position === 'after-navbar') {
                anchor = hero || main;
                index = anchor ? anchor.start : -1;
            } else if (position === 'after-hero') {
                index = hero ? hero.end : -1;
            } else if (position === 'content-top' || position === 'content-bottom') {
                const container = main && findElementByClass(html, 'div', 'container', main.openEnd);
                const target = container && container.start < main.end ? container : main;
                index = position === 'content-top' ? (target ? target.openEnd : -1) : closeStart(html, target, target === main ? 'main' : 'div');
            } else if (/^after-section-\d+$/.test(position)) {
                const sectionIndex = parseInt(position.replace('after-section-', ''), 10);
                const sections = elementsByClass(html, 'section', 'category-section');
                index = sections[sectionIndex] ? sections[sectionIndex].end : -1;
            }
        } else {
            const detailPage = findElementByClass(html, 'div', 'detail-page') || findElementByClass(html, 'main', 'detail-page');
            const detailContent = findElementByClass(html, 'div', 'detail-content') || findElementByClass(html, 'article', 'detail-content');
            const related = relatedElement(html);
            if (position === 'after-navbar') index = detailPage ? detailPage.start : -1;
            else if (position === 'detail-before-content') index = detailContent ? detailContent.start : -1;
            else if (position === 'detail-after-content') index = detailContentMiddleIndex(html, detailContent);
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
        return { html: insertAt(html, index, markup), error: null };
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

    function validateRestoredHtml(html, pageType, scriptPath, requestedPolicy) {
        const errors = [];
        const policy = normalizePolicy(requestedPolicy);
        const visibleHtml = String(html || '').replace(/<!--[\s\S]*?-->/g, '');
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
        const banner1Top = policy.slots.detail.some(function(slot) { return slot.unit === 'banner1' && slot.position === 'after-navbar'; });
        if (pageType === 'detail' && banner1Top && p1 > visibleHtml.search(/\bclass\s*=\s*["'][^"']*\bdetail-page\b/i)) {
            errors.push(issue('详情页第一个广告未恢复到正文容器之前。', 'RESTORE_DETAIL_FIRST_POSITION'));
        }
        return errors;
    }

    function restoreHtml(source, pageType, scriptPath, requestedPolicy) {
        const policy = normalizePolicy(requestedPolicy);
        let html = removeAdScripts(removeExistingAds(source));
        const errors = validatePolicy(policy);

        const groups = {};
        policy.slots[pageType].forEach(function(slot) {
            const position = slot.position;
            if (slot.unit === 'off') return;
            if (!groups[position]) groups[position] = [];
            groups[position].push('adv' + slot.unit.replace('banner', ''));
        });
        Object.keys(groups).forEach(function(position) {
            if (errors.length) return;
            const placed = insertPlacement(html, pageType, position, groups[position]);
            html = placed.html;
            if (placed.error) errors.push(placed.error);
        });

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
        if (!/<\/head\s*>/i.test(source)) errors.push(issue('页面缺少 </head>，无法恢复广告脚本。', 'RESTORE_HEAD_MISSING'));
        if (!errors.length) errors.push.apply(errors, validateRestoredHtml(html, pageType, scriptPath, policy));
        // 移除旧容器后只会留下空白行；统一收敛，保证重复恢复不会不断增加空白。
        html = html.replace(/^[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
        return { valid: errors.length === 0, errors: errors, html: html };
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
            dynamicHomeAds[slot.position] = (dynamicHomeAds[slot.position] || '') + template('adv' + slot.unit.replace('banner', ''));
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

    function restoreEntries(rawEntries, config, archiveName, requestedPolicy) {
        const policyMode = !!requestedPolicy;
        const policy = normalizePolicy(requestedPolicy);
        const entries = (rawEntries || []).map(function(entry) {
            return { path: normalizePath(entry.path || entry.name), bytes: entry.bytes ? new Uint8Array(entry.bytes) : textBytes(entryText(entry)) };
        }).filter(function(entry) { return isSafePath(entry.path); });
        const metadata = inspectSiteEntries(entries, archiveName);
        if (hasExternalBannerConfig(config)) {
            metadata.errors = metadata.errors.filter(function(error) { return error.code !== 'RESTORE_EMBEDDED_CONFIG_INCOMPLETE'; });
            metadata.valid = metadata.errors.length === 0;
            metadata.embeddedConfig = Object.assign({}, config);
            metadata.detectedHost = detectedHost(config) || metadata.detectedHost;
        }
        if (!metadata.valid) return { valid: false, errors: metadata.errors, warnings: metadata.warnings, entries: entries, metadata: metadata };
        const policyErrors = validatePolicy(policy);
        if (policyErrors.length) return { valid: false, errors: policyErrors, warnings: metadata.warnings, entries: entries, metadata: metadata, policy: policy };

        const byPath = {};
        entries.forEach(function(entry) { byPath[entry.path.toLowerCase()] = entry; });
        const pageErrors = [];
        const changedPages = [];

        [{ path: metadata.homePath, type: 'home' }].concat(metadata.detailPaths.map(function(path) {
            return { path: path, type: 'detail' };
        })).forEach(function(page) {
            const entry = byPath[page.path.toLowerCase()];
            const scriptPath = relativeAdScriptPath(page.path, metadata.siteRoot) + (policyMode ? '?v=ad-policy-1' : '');
            const result = restoreHtml(entryText(entry), page.type, scriptPath, policy);
            if (!result.valid) {
                result.errors.forEach(function(error) {
                    pageErrors.push(issue(page.path + '：' + error.message, error.code));
                });
                return;
            }
            entry.bytes = textBytes(result.html);
            changedPages.push(page.path);
        });

        if (pageErrors.length) return { valid: false, errors: pageErrors, warnings: metadata.warnings, entries: entries, metadata: metadata };

        const dynamicHomeResult = restoreDynamicHomeAds(entries, metadata, policyMode ? policy : null);
        if (dynamicHomeResult.errors.length) {
            return { valid: false, errors: dynamicHomeResult.errors, warnings: metadata.warnings, entries: entries, metadata: metadata };
        }
        if (typeof Generator === 'undefined' || typeof Generator.generateAdJs !== 'function') {
            return { valid: false, errors: [issue('建站器广告模板未加载。', 'RESTORE_GENERATOR_UNAVAILABLE')], warnings: metadata.warnings, entries: entries, metadata: metadata };
        }

        const adSource = Generator.generateAdJs(config || {}, policyMode ? policy : null);
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
                adPaths: config || {},
                policy: policy
            };
            const existingManifest = entries.find(function(entry) { return entry.path.toLowerCase() === manifestPath.toLowerCase(); });
            if (existingManifest) existingManifest.bytes = textBytes(JSON.stringify(manifest, null, 2) + '\n');
            else entries.push({ path: manifestPath, bytes: textBytes(JSON.stringify(manifest, null, 2) + '\n') });
        }

        return {
            valid: true,
            errors: [],
            warnings: metadata.warnings,
            entries: entries,
            metadata: metadata,
            changedPages: changedPages,
            changedScripts: dynamicHomeResult.changedScripts,
            restoredConfig: config || {},
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
        if (/\.(?:rar|7z)$/.test(lower)) return 'archive-runtime';
        return '';
    }

    function waitForArchiveOperation(operation, timeoutMs, timeoutMessage) {
        // 单元测试和部分嵌入式 WebView 不提供 timer；此时仍执行解析，只省略超时兜底。
        if (typeof setTimeout !== 'function' || typeof clearTimeout !== 'function') return Promise.resolve(operation);
        let timer = 0;
        const timeout = new Promise(function(_, reject) {
            timer = setTimeout(function() { reject(new Error(timeoutMessage)); }, timeoutMs);
        });
        return Promise.race([Promise.resolve(operation), timeout]).finally(function() {
            if (timer) clearTimeout(timer);
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
        onStage('内置解析器不兼容，正在切换 RAR5 / solid RAR 解析器…');
        const runtime = await waitForArchiveOperation(
            globalThis.loadRarFallbackRuntime(),
            90000,
            '加载 RAR5 / solid RAR 解析组件超时。请刷新页面后重试。'
        );
        onStage('正在读取 RAR5 文件清单，并自动跳过 node_modules…');
        const extractor = await waitForArchiveOperation(
            runtime.createExtractorFromData({ data: await file.arrayBuffer(), wasmBinary: runtime.wasmBinary }),
            90000,
            '打开 RAR5 压缩包超时。请确认压缩包未加密且不是分卷压缩包。'
        );
        let headers;
        try {
            headers = Array.from(extractor.getFileList().fileHeaders || []);
        } catch (error) {
            throw new Error('RAR5 文件清单读取失败：' + archiveErrorText(error));
        }
        const candidates = headers.filter(function(header) {
            const path = normalizePath(header && header.name);
            return header && !header.flags?.directory && isSafePath(path) && !isIgnoredArchivePath(path);
        });
        onStage('目录读取完成：共 ' + headers.length + ' 项，正在提取 ' + candidates.length + ' 个源码文件…');
        if (!candidates.length) return [];
        let extracted;
        try {
            extracted = extractor.extract({ files: candidates.map(function(header) { return header.name; }) });
        } catch (error) {
            throw new Error('RAR5 源码提取失败：' + archiveErrorText(error));
        }
        const entries = [];
        let completed = 0;
        try {
            for (const item of extracted.files) {
                const path = normalizePath(item && item.fileHeader && item.fileHeader.name);
                if (item && item.extraction && isSafePath(path) && !isIgnoredArchivePath(path)) {
                    entries.push({ path: path, bytes: new Uint8Array(item.extraction) });
                    completed += 1;
                    if (completed < candidates.length && (completed % 8 === 0)) onStage('正在提取源码文件：' + completed + ' / ' + candidates.length + '…');
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
        const runtime = typeof globalThis !== 'undefined'
            ? (globalThis.ArchiveRuntimeReady || (typeof globalThis.loadArchiveRuntime === 'function' ? globalThis.loadArchiveRuntime() : null))
            : null;
        if (!runtime) throw new Error('RAR 解析组件未加载。请刷新页面后重试。');
        onStage('正在打开 RAR / 7Z 压缩包…');
        const Archive = await runtime;
        let archive = null;
        try {
            archive = await waitForArchiveOperation(
                Archive.open(file),
                90000,
                '打开 RAR / 7Z 超时。该压缩包可能已损坏或包含过多文件；请重新压缩源码并排除 node_modules 后重试。'
            );
            // 不先 extractFiles()：React 项目常将 node_modules 打进 RAR，完整解压会
            // 无谓占用内存。先读取目录，再按需解出真正会保留到导出副本的文件。
            onStage('正在列出压缩包目录，并自动跳过 node_modules…');
            // libarchive 的 getFilesArray() 会先在主线程为数万个依赖文件递归构造完整树。
            // 真实运行时直接使用 worker 的清单，再只按需提取源码；测试替身仍可走旧接口。
            const canListDirectly = archive.client && typeof archive.client.listFiles === 'function' && typeof archive.extractSingleFile === 'function';
            const files = await waitForArchiveOperation(
                canListDirectly ? archive.client.listFiles() : archive.getFilesArray(),
                90000,
                '读取 RAR / 7Z 目录超时。该压缩包包含过多依赖文件；请重新压缩源码并排除 node_modules 后重试。'
            );
            const candidates = (files || []).filter(function(entry) {
                const path = normalizePath(canListDirectly ? entry.path : String(entry.path || '') + String(entry.file && entry.file.name || ''));
                return (canListDirectly ? entry.type === 'FILE' : entry.file) && isSafePath(path) && !isIgnoredArchivePath(path);
            });
            onStage('目录读取完成：共 ' + (files || []).length + ' 个文件，正在提取 ' + candidates.length + ' 个源码文件…');

            const entries = [];
            const batchSize = 8;
            for (let start = 0; start < candidates.length; start += batchSize) {
                const batch = candidates.slice(start, start + batchSize);
                const extracted = await Promise.all(batch.map(async function(entry) {
                    const path = normalizePath(canListDirectly ? entry.path : String(entry.path || '') + String(entry.file && entry.file.name || ''));
                    const source = canListDirectly
                        ? await archive.extractSingleFile(entry.path)
                        : (typeof entry.file.extract === 'function' ? await entry.file.extract() : entry.file);
                    return { path: path, bytes: new Uint8Array(await source.arrayBuffer()) };
                }));
                entries.push.apply(entries, extracted);
                const completed = Math.min(start + batch.length, candidates.length);
                if (completed < candidates.length) onStage('正在提取源码文件：' + completed + ' / ' + candidates.length + '…');
            }
            return entries;
        } catch (error) {
            const isRar = /\.rar$/i.test(String(file && file.name || ''));
            if (archive && typeof archive.close === 'function') {
                await archive.close();
                archive = null;
            }
            if (isRar && typeof globalThis !== 'undefined' && typeof globalThis.loadRarFallbackRuntime === 'function') {
                try {
                    return await readRarWithOfficialFallback(file, onStage);
                } catch (fallbackError) {
                    throw new Error('RAR 读取失败：' + archiveErrorText(fallbackError, archiveErrorText(error)));
                }
            }
            throw new Error('压缩包读取失败：' + archiveErrorText(error));
        } finally {
            if (archive && typeof archive.close === 'function') await archive.close();
        }
    }

    async function readArchive(file, onStage) {
        const type = archiveType(file && file.name);
        if (!type) throw new Error('站点源文件仅支持 .zip、.rar、.7z、.tar.gz 或 .tgz。');
        if (type === 'zip') {
            if (typeof JSZip === 'undefined') throw new Error('ZIP 解析组件未加载。');
            const zip = await JSZip.loadAsync(file);
            const paths = Object.keys(zip.files).filter(function(path) { return !zip.files[path].dir && isSafePath(path); });
            return Promise.all(paths.map(async function(path) {
                return { path: normalizePath(path), bytes: await zip.files[path].async('uint8array') };
            }));
        }
        if (type === 'archive-runtime') return readRarArchive(file, onStage);
        if (typeof DecompressionStream === 'undefined') throw new Error('当前浏览器不支持 TAR.GZ 解压，请使用新版 Chrome 或 Edge。');
        const stream = file.stream ? file.stream() : new Blob([await file.arrayBuffer()]).stream();
        const decompressed = stream.pipeThrough(new DecompressionStream('gzip'));
        return extractTarEntries(await new Response(decompressed).arrayBuffer());
    }

    function archiveBaseName(fileName) {
        return String(fileName || 'site').replace(/\.(?:tar\.gz|tgz|zip|rar|7z)$/i, '');
    }

    function siteFolderName(value, fallback) {
        const parts = normalizePath(value).replace(/\/$/, '').split('/').filter(Boolean);
        return String(parts[parts.length - 1] || fallback || 'site').replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-');
    }

    function splitSiteEntries(rawEntries) {
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
            const metadata = inspectSiteEntries(relativeEntries, name);
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

    async function readSiteDirectoryFiles(files, onProgress) {
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
                    (/^(?:details?|articles?)\//i.test(candidate.path.slice(root.length)) || hasAdScript);
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
        const sites = splitSiteEntries(entries);
        if (!sites.length) throw new Error('所选目录中未识别到同时包含 index.html 和详情页的站点。');
        return { sites: sites, fileCount: entries.length };
    }

    async function readSiteDirectoryHandle(directoryHandle, onProgress) {
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
        return readSiteDirectoryFiles(files, onProgress);
    }

    async function readSiteArchiveFiles(files, onProgress) {
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
            const originalMetadata = inspectSiteEntries(archiveEntries, file.name);
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
                metadata: inspectSiteEntries(entries, file.name)
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
            const hasReactSource = entries.some(function(entry) { return entry.path.indexOf(root + 'src/') === 0 && /\.(?:tsx?|jsx?)$/i.test(entry.path); });
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
                const built = /\/(?:assets|static)\/[^"']+\.(?:js|mjs)/i.test(viteIndex.text) && !/\/src\/[^"']+\.(?:jsx?|tsx?)/i.test(viteIndex.text);
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

        const metadata = inspectSiteEntries(rawEntries, archiveName);
        metadata.errors = metadata.errors.filter(function(error) { return error.code !== 'RESTORE_EMBEDDED_CONFIG_INCOMPLETE'; });
        metadata.valid = metadata.errors.length === 0;
        return {
            valid: metadata.valid,
            kind: 'static-html',
            framework: '静态 HTML 多页面站',
            siteRoot: metadata.siteRoot,
            entryPath: metadata.homePath,
            previewEntryPath: metadata.homePath,
            runtimePath: '',
            runtimeSrc: '',
            errors: metadata.errors,
            warnings: metadata.warnings,
            metadata: metadata
        };
    }

    function injectableRootsFromDescriptors(descriptors) {
        const paths = descriptors.map(function(item) { return item.path; });
        let roots = [];
        paths.forEach(function(path) {
            if (!/(?:^|\/)index\.html?$/i.test(path)) return;
            let root = path.replace(/index\.html?$/i, '');
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
            const baseProgress = Math.round(index / list.length * 100);
            onProgress(baseProgress, '正在读取 ' + file.name + '…');
            const archiveEntries = await readArchive(file, function(stage) {
                onProgress(baseProgress, file.name + '：' + stage);
            });
            const project = classifyInjectableSiteEntries(archiveEntries, file.name);
            const root = project.siteRoot || '';
            const entries = root ? archiveEntries.filter(function(entry) { return entry.path.indexOf(root) === 0; }).map(function(entry) {
                return { path: entry.path.slice(root.length), bytes: entry.bytes };
            }) : archiveEntries;
            const name = siteFolderName(archiveBaseName(file.name), 'site-' + (index + 1));
            sites.push({ id: 'inject-archive:' + index + ':' + name, name: name, sourceRoot: root, entries: entries, project: classifyInjectableSiteEntries(entries, name) });
        }
        onProgress(100, '成品站压缩包读取完成');
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

    function generateSpaAdRuntime(config, requestedPolicy) {
        const paths = JSON.stringify({
            banner1: config && config.bannerPath1 || '', banner2: config && config.bannerPath2 || '', banner3: config && config.bannerPath3 || '',
            interstitial: config && config.interstitialPath || '', anchor: config && config.anchorPath || '', analytics: config && config.analyticsID || ''
        }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
        const slots = JSON.stringify(normalizePolicy(requestedPolicy).slots).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
        return "(function(){\n" +
            "'use strict';\n" +
            "var paths=" + paths + ";\n" +
            "var slots=" + slots + ";\n" +
            "var state=window.__sitefoundryAds=window.__sitefoundryAds||{route:'',slots:[],services:false,outOfPage:false,timer:0};\n" +
            "window.googletag=window.googletag||{cmd:[]};\n" +
            "function ad(n,custom){var w=document.createElement('div');w.id='adv'+n;w.setAttribute('data-sitefoundry-runtime-ad',String(n));w.style.cssText='width:100%;text-align:center;padding:10px;display:flex;flex-direction:column;align-items:center;overflow:hidden;margin-top:1px;box-sizing:border-box;';if(custom){w.className='sitefoundry-ad-custom-placement';w.style.position='relative';w.style.transform='translateX(var(--sitefoundry-ad-center-offset, 0px))';}var l=document.createElement('div');l.textContent='advertisement'+n;l.style.cssText='text-align:center;color:black;font-size:13px;';var s=document.createElement('div');s.id='div-gpt-ad-banner'+n;s.style.cssText='min-width:300px;min-height:250px;';w.appendChild(l);w.appendChild(s);return w;}\n" +
            "function after(t,n){if(t&&t.parentNode)t.parentNode.insertBefore(n,t.nextSibling);else(document.querySelector('main')||document.body).appendChild(n);}\n" +
            "function centerCustom(){document.querySelectorAll('.sitefoundry-ad-custom-placement').forEach(function(node){node.style.setProperty('--sitefoundry-ad-center-offset','0px');var rect=node.getBoundingClientRect(),offset=window.innerWidth/2-(rect.left+rect.width/2);node.style.setProperty('--sitefoundry-ad-center-offset',Math.round(offset*100)/100+'px');});}\n" +
            "function refresh(home){googletag.cmd.push(function(){if(state.slots.length&&googletag.destroySlots)googletag.destroySlots(state.slots);state.slots=[];[1,2,3].forEach(function(n){var id='div-gpt-ad-banner'+n,p=paths['banner'+n];if(p&&document.getElementById(id)){var slot=googletag.defineSlot(p,[300,250],id);if(slot)state.slots.push(slot.addService(googletag.pubads()));}});if(!state.outOfPage){if(paths.interstitial&&home){var i=googletag.defineOutOfPageSlot(paths.interstitial,googletag.enums.OutOfPageFormat.INTERSTITIAL);if(i)i.addService(googletag.pubads());}if(paths.anchor){var a=googletag.defineOutOfPageSlot(paths.anchor,googletag.enums.OutOfPageFormat.BOTTOM_ANCHOR);if(a)a.addService(googletag.pubads());}state.outOfPage=true;}if(!state.services){googletag.pubads().enableSingleRequest();googletag.enableServices();state.services=true;}[1,2,3].forEach(function(n){var id='div-gpt-ad-banner'+n;if(paths['banner'+n]&&document.getElementById(id))googletag.display(id);});});}\n" +
            "function mount(force){if(!document.body)return;var route=location.pathname+location.search,complete=[1,2,3].every(function(n){return document.getElementById('div-gpt-ad-banner'+n);});if(!force&&state.route===route&&complete)return;document.querySelectorAll('[data-sitefoundry-runtime-ad]').forEach(function(n){n.remove();});var home=location.pathname==='/'||/\\/index\\.html?$/i.test(location.pathname),header=document.querySelector('header')||document.querySelector('nav'),main=document.querySelector('main')||document.querySelector('[role=main]')||document.getElementById('root')||document.body,footer=document.querySelector('footer'),sections=main.querySelectorAll('section:not([data-sitefoundry-runtime-ad])'),detail=document.querySelector('article')||document.querySelector('.detail-content')||document.querySelector('[class*=article-content]');function kids(t){return Array.prototype.filter.call((t||main).children||[],function(n){return !n.hasAttribute('data-sitefoundry-runtime-ad')&&!/^(?:SCRIPT|STYLE|TEMPLATE|HEADER|NAV|FOOTER|ASIDE)$/.test(n.tagName||'')&&!/(?:^|\\s)related(?:-|\\s|$)/i.test(n.className||'');});}function middle(t){var c=kids(t);return c.length?c[Math.max(0,Math.ceil(c.length/2)-1)]:(t||main);}function custom(position){var m=/^custom-after-((?:\\d+)(?:-\\d+)*)$/.exec(position||''),t=main;if(!m)return null;var p=m[1].split('-').map(Number);for(var i=0;i<p.length;i++){var c=kids(t);if(!c.length)return t;t=c[Math.min(p[i],c.length-1)];}return t;}function target(position){var chosen=custom(position);if(chosen)return chosen;if(position==='after-navbar')return header||main.firstElementChild;if(position==='footer-top')return footer||main.lastElementChild;if(position==='detail-after-content')return middle(detail||main);if(position==='content-bottom'||position==='detail-before-related'||position==='detail-after-related')return detail||main.lastElementChild;if(position==='detail-before-content'||position==='detail-between-p-1'||position==='detail-between-p-2'||position==='detail-between-p-3')return detail||main.firstElementChild;if(position==='after-hero'||position==='content-top')return main.firstElementChild;var m=/after-section-(\\d+)/.exec(position||'');return m&&sections[Number(m[1])]||main.firstElementChild;}(home?slots.home:slots.detail).forEach(function(slot){if(!slot||slot.unit==='off')return;var n=Number(String(slot.unit).replace('banner','')),node=ad(n,/^custom-after-(?:\\d+)(?:-\\d+)*$/.test(slot.position||'')),anchor=target(slot.position);if(slot.position==='footer-top'&&footer&&footer.parentNode)footer.parentNode.insertBefore(node,footer);else after(anchor,node);});centerCustom();requestAnimationFrame(centerCustom);state.route=route;refresh(home);}\n" +
            "function schedule(force){clearTimeout(state.timer);state.timer=setTimeout(function(){mount(!!force);},160);}\n" +
            "window.refreshClarivoBanners=function(){console.log('[SiteFoundry Ads] React route refresh requested');schedule(true);};\n" +
            "['pushState','replaceState'].forEach(function(k){var original=history[k];if(!original||original.__sitefoundryWrapped)return;var wrapped=function(){var result=original.apply(this,arguments);schedule(true);return result;};wrapped.__sitefoundryWrapped=true;history[k]=wrapped;});\n" +
            "addEventListener('popstate',function(){schedule(true);});addEventListener('resize',function(){requestAnimationFrame(centerCustom);});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){schedule(true);});else schedule(true);new MutationObserver(function(){schedule(false);}).observe(document.documentElement,{childList:true,subtree:true});\n" +
            "if(paths.analytics){var g=document.createElement('script');g.async=true;g.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(paths.analytics);document.head.appendChild(g);window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){dataLayer.push(arguments);};gtag('js',new Date());gtag('config',paths.analytics);}\n" +
            "})();\n";
    }

    // React source projects already receive <Advertisement> components from the
    // AST injector. Their runtime must consume those containers instead of
    // creating a second set of adv1/2/3 nodes. This mirrors the lazy-loading
    // implementation proven on clarivo.cc while keeping ad paths configurable.
    function generateReactSourceAdRuntime(config) {
        function literal(value) {
            return JSON.stringify(String(value || '')).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
        }
        return [
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
    }

    function injectReactEntry(rawEntries, project, config, archiveName, requestedPolicy) {
        const entries = (rawEntries || []).map(function(entry) {
            return { path: normalizePath(entry.path || entry.name), bytes: entry.bytes ? new Uint8Array(entry.bytes) : textBytes(entryText(entry)) };
        }).filter(function(entry) { return isSafePath(entry.path); });
        const entry = entries.find(function(item) { return item.path.toLowerCase() === project.entryPath.toLowerCase(); });
        if (!entry) return { valid: false, errors: [issue('没有找到 React 入口页 ' + project.entryPath + '。', 'AD_INJECTION_REACT_ENTRY_MISSING')], warnings: [], entries: entries, project: project };
        let html = removeAdScripts(entryText(entry));
        html = html.replace(/\s*<script\b[^>]*data-sitefoundry-ad-runtime[^>]*>[\s\S]*?<\/script\s*>/gi, '');
        const scripts = '<script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js" crossorigin="anonymous" data-sitefoundry-ad-runtime="gpt"></script>\n    <script defer src="' + project.runtimeSrc + '?v=1" data-sitefoundry-ad-runtime="loader"></script>';
        const headEnd = html.search(/<\/head\s*>/i);
        if (headEnd === -1) return { valid: false, errors: [issue('React 入口页缺少 </head>，无法加入广告运行时。', 'AD_INJECTION_HEAD_MISSING')], warnings: [], entries: entries, project: project };
        entry.bytes = textBytes(insertAt(html, headEnd, scripts).replace(/\n{3,}/g, '\n\n'));
        const runtimeBytes = textBytes(generateSpaAdRuntime(config, requestedPolicy));
        const existingRuntime = entries.find(function(item) { return item.path.toLowerCase() === project.runtimePath.toLowerCase(); });
        if (existingRuntime) existingRuntime.bytes = runtimeBytes;
        else entries.push({ path: project.runtimePath, bytes: runtimeBytes });
        const manifest = { schema: 'sitefoundry-ad-injection/v1', generatedAt: new Date().toISOString(), source: archiveName || 'finished-site', framework: project.framework, host: detectedHost(config), adPaths: config, policy: normalizePolicy(requestedPolicy) };
        const manifestPath = (project.deploymentRoot || project.siteRoot || '') + 'ad-injection.json';
        const existingManifest = entries.find(function(item) { return item.path.toLowerCase() === manifestPath.toLowerCase(); });
        if (existingManifest) existingManifest.bytes = textBytes(JSON.stringify(manifest, null, 2) + '\n');
        else entries.push({ path: manifestPath, bytes: textBytes(JSON.stringify(manifest, null, 2) + '\n') });
        return { valid: true, errors: [], warnings: project.warnings || [], entries: entries, project: project, changedPages: [project.entryPath], changedScripts: [project.runtimePath], restoredConfig: config };
    }

    function injectAdsIntoSiteEntries(rawEntries, config, archiveName, requestedPolicy) {
        const project = classifyInjectableSiteEntries(rawEntries, archiveName);
        if (!project.valid) return { valid: false, errors: project.errors, warnings: project.warnings || [], entries: rawEntries, project: project };
        if (!hasExternalBannerConfig(config)) return { valid: false, errors: [issue('广告代码至少需要一个 banner1、banner2 或 banner3。', 'AD_INJECTION_CODE_INCOMPLETE')], warnings: [], entries: rawEntries, project: project };
        if (project.kind === 'static-html' && !/React 已构建静态产物/.test(project.framework || '')) {
            const restored = restoreEntries(rawEntries, config, archiveName, requestedPolicy || createPolicy());
            restored.project = project;
            return restored;
        }
        return injectReactEntry(rawEntries, project, config, archiveName, requestedPolicy || createPolicy());
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
        if (!root) return (entries || []).slice();
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

    // This checks the exact bytes that will be written/downloaded.  Do not turn
    // it into a best-effort warning: callers use its failure to block export.
    function verifyInjectedOutput(entries, project, config, requestedPolicy, changedPages) {
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
                ['div-gpt-ad-banner', 'refreshClarivoBanners', "'pushState','replaceState'"].forEach(function(token) {
                    if (source.indexOf(token) === -1) errors.push(issue(runtime.path + ' 缺少 ' + token + '，SPA 广告重扫不完整。', 'AD_EXPORT_SPA_RUNTIME_INCOMPLETE'));
                });
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
                ['div-gpt-ad-banner', 'refreshClarivoBanners', 'function delayLoadBanner', 'new IntersectionObserver', 'googletag.destroySlots(previousSlots)', '[LazyLoad] 初始化监控:', '[Init] Interstitial 已定义', '[Init] Anchor 已定义'].forEach(function(token) {
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
                const page = entryByPath(entries, path);
                if (!page) { errors.push(issue('导出内容缺少已修改页面 ' + path + '。', 'AD_EXPORT_PAGE_MISSING')); return; }
                checkedPages.push(page.path);
                const pageType = /(?:details?|articles?|blog|tools)\//i.test(path) ? 'detail' : 'home';
                const relativePath = relativeAdScriptPath(path, '');
                const checks = validateRestoredHtml(entryText(page), pageType, relativePath + '?v=ad-policy-1', policy);
                checks.forEach(function(check) { errors.push(issue(path + '：' + check.message, check.code)); });
            });
            const runtime = entryByPath(entries, 'js/ad.js');
            if (!runtime) warnings.push(issue('未在根目录找到 js/ad.js；已按每页相对路径校验其引用。', 'AD_EXPORT_STATIC_RUNTIME_NESTED'));
        }
        return { valid: errors.length === 0, errors: errors, warnings: warnings, checkedPages: checkedPages, manifestPath: manifestPath, exportScope: reactBuild ? '仅部署产物（构建输出目录）' : reactSource ? '已注入广告的完整 React 源码（需要在项目环境构建）' : '完整静态站源码' };
    }

    function injectionReportText(results) {
        const lines = ['成品站广告注入与导出核验报告', '生成时间：' + new Date().toISOString(), '规则：静态站导出加入广告后的静态文件；React 源码工程导出加入广告后的完整源码，并由用户在项目环境执行安装依赖与生产构建；仅上传构建目录时只导出部署产物。', ''];
        results.forEach(function(result) {
            lines.push((result.valid ? '[成功] ' : '[失败] ') + result.siteName);
            if (result.framework) lines.push('  识别类型：' + result.framework);
            if (result.host) lines.push('  广告域名：' + result.host);
            if (result.changedPages != null) lines.push('  修改入口/页面：' + result.changedPages + ' 个');
            if (result.changedScripts && result.changedScripts.length) lines.push('  修改/新增脚本：' + result.changedScripts.join('、'));
            if (result.buildCommand) lines.push('  构建命令：' + result.buildCommand);
            if (result.exportScope) lines.push('  ZIP 内容范围：' + result.exportScope);
            if (result.verification) lines.push('  已核验页面：' + (result.verification.checkedPages || []).join('、'));
            (result.errors || []).forEach(function(error) { lines.push('  错误：' + error.message); });
            (result.warnings || []).forEach(function(warning) { lines.push('  提示：' + warning.message); });
            lines.push('');
        });
        return lines.join('\r\n');
    }

    async function applyAdCodeBatch(siteGroups, codeResults, onProgress, requestedPolicy, reactSourceInjector) {
        const match = matchAdCodesToSites(siteGroups, codeResults);
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
            const effectivePolicy = normalizePolicy(requestedPolicy);
            ['banner1', 'banner2', 'banner3'].forEach(function(unit) {
                if (mapping.code.config[unit.replace('banner', 'bannerPath')]) return;
                ['home', 'detail'].forEach(function(page) { effectivePolicy.slots[page].forEach(function(slot) { if (slot.unit === unit) { slot.unit = 'off'; slot.position = 'off'; } }); });
            });
            if (mapping.project.kind === 'react-source' && typeof reactSourceInjector !== 'function') {
                results.push({
                    valid: false, siteName: mapping.siteName, framework: mapping.framework, host: mapping.host,
                    errors: [issue('React 源码注入器未加载，无法安全修改 JSX/TSX。请刷新工具后重试。', 'AD_EXPORT_REACT_SOURCE_INJECTOR_UNAVAILABLE')],
                    warnings: mapping.warnings, buildCommand: mapping.project.buildCommand || 'npm run build'
                });
                continue;
            }
            const injected = mapping.project.kind === 'react-source'
                ? reactSourceInjector(mapping.site.entries, mapping.project, mapping.code.config, effectivePolicy, mapping.siteName, generateReactSourceAdRuntime(mapping.code.config))
                : injectAdsIntoSiteEntries(mapping.site.entries, mapping.code.config, mapping.siteName, effectivePolicy);
            if (!injected.valid) {
                results.push({ valid: false, siteName: mapping.siteName, framework: mapping.framework, host: mapping.host, errors: injected.errors, warnings: mapping.warnings.concat(injected.warnings || []) });
                continue;
            }
            const exportedEntries = deploymentEntries(injected.entries, mapping.project);
            const verification = verifyInjectedOutput(exportedEntries, mapping.project, mapping.code.config, effectivePolicy, injected.changedPages || []);
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
            outputs.push({ name: outputName, entries: exportedEntries, policy: effectivePolicy });
            results.push({ valid: true, siteName: mapping.siteName, outputName: outputName, framework: mapping.framework, host: mapping.host, changedPages: (injected.changedPages || []).length, changedScripts: injected.changedScripts || [], errors: [], warnings: mapping.warnings.concat(injected.warnings || [], verification.warnings || []), verification: verification, buildCommand: mapping.project.buildCommand || '', exportScope: verification.exportScope });
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
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        return { blob: blob, fileName: 'recognized-ad-codes-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.zip', results: results };
    }

    function policySummary(policy) {
        const normalized = normalizePolicy(policy);
        const active = { home: [], detail: [] };
        ['home', 'detail'].forEach(function(page) {
            normalized.slots[page].forEach(function(slot, index) {
                if (slot.unit !== 'off') active[page].push('广告位' + (index + 1) + '=' + slot.position + '→' + slot.unit);
            });
        });
        return {
            home: active.home.length ? active.home.join('，') : '全部关闭',
            detail: active.detail.length ? active.detail.join('，') : '全部关闭',
            interstitial: '首页' + (normalized.outOfPage.interstitial.home ? '开' : '关') + '/详情' + (normalized.outOfPage.interstitial.detail ? '开' : '关'),
            anchor: '首页' + (normalized.outOfPage.anchor.home ? '开' : '关') + '/详情' + (normalized.outOfPage.anchor.detail ? '开' : '关')
        };
    }

    function policyReportText(results, globalPolicy) {
        const summary = policySummary(globalPolicy);
        const lines = [
            '批量广告策略处理报告',
            '生成时间：' + new Date().toISOString(),
            '输出规则：新建站点总目录，不覆盖源文件；广告路径保留在 js/ad.js 与 ad-policy.json。',
            '全局首页：' + summary.home,
            '全局详情：' + summary.detail,
            '全局插屏：' + summary.interstitial,
            '全局锚点：' + summary.anchor,
            ''
        ];
        results.forEach(function(result) {
            lines.push((result.valid ? '[成功] ' : '[失败] ') + result.siteName + (result.overridden ? '（单站覆盖）' : '（全局方案）'));
            if (result.host) lines.push('  广告域名：' + result.host);
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

    async function applyPolicyBatch(siteGroups, globalPolicy, overrides, onProgress) {
        const sites = Array.from(siteGroups || []);
        if (!sites.length) throw new Error('请先选择并识别站点总目录。');
        const normalizedGlobal = normalizePolicy(globalPolicy);
        overrides = overrides || {};
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
            const restored = restoreEntries(site.entries, metadata.embeddedConfig, site.name, policy);
            if (!restored.valid) {
                results.push({ valid: false, siteName: site.name, host: metadata.detectedHost, overridden: !!override, errors: restored.errors, warnings: restored.warnings });
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
            report: policyReportText(results, normalizedGlobal)
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
            site.entries.forEach(function(entry) { folder.file(entry.path, Array.from(entry.bytes || [])); });
        });
        zip.file(batch.reportName || '广告策略处理报告.txt', batch.report);
        return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    }

    async function zipEntries(entries, outputType) {
        if (typeof JSZip === 'undefined') throw new Error('ZIP 打包组件未加载。');
        const zip = new JSZip();
        // 普通数组同时兼容浏览器、WebView 和测试环境的跨 realm TypedArray。
        entries.forEach(function(entry) { zip.file(entry.path, Array.from(entry.bytes || [])); });
        return zip.generateAsync({ type: outputType || 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
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
        const blob = await outer.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
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
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        onProgress(100, '广告代码识别完成');
        return { blob: blob, fileName: 'recognized-ad-codes-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.zip', results: results };
    }

    return {
        inspectCodeText: inspectCodeText,
        inspectSiteEntries: inspectSiteEntries,
        restoreHtml: restoreHtml,
        restoreEntries: restoreEntries,
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
        classifyInjectableSiteEntries: classifyInjectableSiteEntries,
        readInjectableDirectoryFiles: readInjectableDirectoryFiles,
        readInjectableDirectoryHandle: readInjectableDirectoryHandle,
        readInjectableArchiveFiles: readInjectableArchiveFiles,
        readAdvertiserCodeFiles: readAdvertiserCodeFiles,
        matchAdCodesToSites: matchAdCodesToSites,
        generateSpaAdRuntime: generateSpaAdRuntime,
        generateReactSourceAdRuntime: generateReactSourceAdRuntime,
        verifyInjectedOutput: verifyInjectedOutput,
        injectAdsIntoSiteEntries: injectAdsIntoSiteEntries,
        applyAdCodeBatch: applyAdCodeBatch,
        exportRecognizedCodesForGroups: exportRecognizedCodesForGroups,
        applyPolicyBatch: applyPolicyBatch,
        writePolicyBatchToDirectory: writePolicyBatchToDirectory,
        zipPolicyBatch: zipPolicyBatch,
        policySummary: policySummary,
        homePlacements: HOME_PLACEMENTS.slice(),
        detailPlacements: DETAIL_PLACEMENTS.slice(),
        bannerUnits: BANNER_UNITS.slice(),
        readExistingConfig: readExistingConfig,
        detectedHost: detectedHost,
        relativeAdScriptPath: relativeAdScriptPath
    };
})();
