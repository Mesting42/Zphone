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
                        position: allowedPositions.indexOf(item.position) !== -1 && item.position !== 'off' ? item.position : defaultSlot.position,
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
                        position: allowed.indexOf(position) !== -1 && position !== 'off' ? position : policy.slots[page][index].position,
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
        return !!path && path.indexOf('\0') === -1 && !path.split('/').some(function(part) { return part === '..'; });
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
        if (!config.bannerPath4 && config.bannerPath3) {
            config.bannerPath4 = config.bannerPath3;
            derived.push('bannerPath4');
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
            return { start: match.index, openEnd: opener.lastIndex, end: findMatchingElementEnd(html, match.index, tagName), openTag: match[0] };
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

    function insertPlacement(html, pageType, position, adIds) {
        const markup = adGroupMarkup(html, position, adIds);
        let anchor = null;
        let index = -1;

        if (position === 'footer-top') {
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
            else if (position === 'detail-after-content') index = detailContent ? detailContent.end : -1;
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
        return !!(config && config.bannerPath1 && config.bannerPath2 && config.bannerPath3);
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
        if (/\.rar$/.test(lower)) return 'rar';
        return '';
    }

    async function readRarArchive(file) {
        const runtime = typeof globalThis !== 'undefined' ? globalThis.ArchiveRuntimeReady : null;
        if (!runtime) throw new Error('RAR 解析组件未加载。请刷新页面后重试。');
        const Archive = await runtime;
        const archive = await Archive.open(file);
        try {
            await archive.extractFiles();
            const files = await archive.getFilesArray();
            const entries = await Promise.all((files || []).map(async function(entry) {
                const path = normalizePath(String(entry.path || '') + String(entry.file && entry.file.name || ''));
                if (!entry.file || !isSafePath(path)) return null;
                return { path: path, bytes: new Uint8Array(await entry.file.arrayBuffer()) };
            }));
            return entries.filter(Boolean);
        } finally {
            if (archive && typeof archive.close === 'function') await archive.close();
        }
    }

    async function readArchive(file) {
        const type = archiveType(file && file.name);
        if (!type) throw new Error('站点源文件仅支持 .zip、.rar、.tar.gz 或 .tgz。');
        if (type === 'zip') {
            if (typeof JSZip === 'undefined') throw new Error('ZIP 解析组件未加载。');
            const zip = await JSZip.loadAsync(file);
            const paths = Object.keys(zip.files).filter(function(path) { return !zip.files[path].dir && isSafePath(path); });
            return Promise.all(paths.map(async function(path) {
                return { path: normalizePath(path), bytes: await zip.files[path].async('uint8array') };
            }));
        }
        if (type === 'rar') return readRarArchive(file);
        if (typeof DecompressionStream === 'undefined') throw new Error('当前浏览器不支持 TAR.GZ 解压，请使用新版 Chrome 或 Edge。');
        const stream = file.stream ? file.stream() : new Blob([await file.arrayBuffer()]).stream();
        const decompressed = stream.pipeThrough(new DecompressionStream('gzip'));
        return extractTarEntries(await new Response(decompressed).arrayBuffer());
    }

    function archiveBaseName(fileName) {
        return String(fileName || 'site').replace(/\.(?:tar\.gz|tgz|zip|rar)$/i, '');
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
            onProgress(Math.round(index / list.length * 100), '正在读取 ' + file.name + '…');
            const archiveEntries = await readArchive(file);
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
            if (!packageUses(packageData, 'react')) continue;
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
            if (viteIndex) {
                const built = /\/(?:assets|static)\/[^"']+\.(?:js|mjs)/i.test(viteIndex.text) && !/\/src\/[^"']+\.(?:jsx?|tsx?)/i.test(viteIndex.text);
                return {
                    valid: true,
                    kind: built ? 'react-build' : 'react-vite-source',
                    framework: built ? 'React 构建产物' : 'React / Vite 源码工程',
                    siteRoot: root,
                    entryPath: viteIndex.path,
                    runtimePath: root + (built ? 'js/ad-spa-runtime.js' : 'public/js/ad-spa-runtime.js'),
                    runtimeSrc: '/js/ad-spa-runtime.js',
                    errors: [],
                    warnings: []
                };
            }
            if (craIndex) {
                return {
                    valid: true,
                    kind: 'react-cra-source',
                    framework: 'React / CRA 源码工程',
                    siteRoot: root,
                    entryPath: craIndex.path,
                    runtimePath: root + 'public/js/ad-spa-runtime.js',
                    runtimeSrc: '%PUBLIC_URL%/js/ad-spa-runtime.js',
                    errors: [],
                    warnings: []
                };
            }
            return {
                valid: false,
                kind: 'react-unsupported',
                framework: 'React 源码工程',
                siteRoot: root,
                entryPath: '',
                errors: [issue('检测到 React 源码，但没有找到 Vite 的 index.html 或 CRA 的 public/index.html。请先构建后上传 dist/build 目录。', 'AD_INJECTION_REACT_ENTRY_MISSING')],
                warnings: []
            };
        }

        const reactBuildEntry = entries.filter(function(entry) {
            return /(?:^|\/)index\.html?$/i.test(entry.path) && /\bid\s*=\s*["']root["']/i.test(entry.text) && /<script\b[^>]*(?:type\s*=\s*["']module["']|\/(?:assets|static)\/)/i.test(entry.text);
        }).sort(function(a, b) { return a.path.split('/').length - b.path.split('/').length; })[0];
        if (reactBuildEntry) {
            const root = reactBuildEntry.path.replace(/index\.html?$/i, '');
            return {
                valid: true,
                kind: 'react-build',
                framework: 'React 构建产物',
                siteRoot: root,
                entryPath: reactBuildEntry.path,
                runtimePath: root + 'js/ad-spa-runtime.js',
                runtimeSrc: '/js/ad-spa-runtime.js',
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
            onProgress(Math.round(index / list.length * 100), '正在读取 ' + file.name + '…');
            const archiveEntries = await readArchive(file);
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
        const validCodes = codes.filter(function(code) { return code && code.valid && code.detectedHost; });
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

    function generateSpaAdRuntime(config) {
        const paths = JSON.stringify({
            banner1: config && config.bannerPath1 || '', banner2: config && config.bannerPath2 || '', banner3: config && config.bannerPath3 || '',
            interstitial: config && config.interstitialPath || '', anchor: config && config.anchorPath || '', analytics: config && config.analyticsID || ''
        }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
        return "(function(){\n" +
            "'use strict';\n" +
            "var paths=" + paths + ";\n" +
            "var state=window.__sitefoundryAds=window.__sitefoundryAds||{route:'',slots:[],services:false,outOfPage:false,timer:0};\n" +
            "window.googletag=window.googletag||{cmd:[]};\n" +
            "function ad(n){var w=document.createElement('div');w.id='adv'+n;w.setAttribute('data-sitefoundry-runtime-ad',String(n));w.style.cssText='width:100%;text-align:center;padding:10px;display:flex;flex-direction:column;align-items:center;overflow:hidden;margin-top:1px;box-sizing:border-box;';var l=document.createElement('div');l.textContent='advertisement';l.style.cssText='text-align:center;color:var(--color-text,#111);font-size:13px;';var s=document.createElement('div');s.id='div-gpt-ad-banner'+n;s.style.cssText='min-width:300px;min-height:250px;';w.appendChild(l);w.appendChild(s);return w;}\n" +
            "function after(t,n){if(t&&t.parentNode)t.parentNode.insertBefore(n,t.nextSibling);else(document.querySelector('main')||document.body).appendChild(n);}\n" +
            "function refresh(home){googletag.cmd.push(function(){if(state.slots.length&&googletag.destroySlots)googletag.destroySlots(state.slots);state.slots=[];[1,2,3].forEach(function(n){var id='div-gpt-ad-banner'+n,p=paths['banner'+n];if(p&&document.getElementById(id)){var slot=googletag.defineSlot(p,[300,250],id);if(slot)state.slots.push(slot.addService(googletag.pubads()));}});if(!state.outOfPage){if(paths.interstitial&&home){var i=googletag.defineOutOfPageSlot(paths.interstitial,googletag.enums.OutOfPageFormat.INTERSTITIAL);if(i)i.addService(googletag.pubads());}if(paths.anchor){var a=googletag.defineOutOfPageSlot(paths.anchor,googletag.enums.OutOfPageFormat.BOTTOM_ANCHOR);if(a)a.addService(googletag.pubads());}state.outOfPage=true;}if(!state.services){googletag.pubads().enableSingleRequest();googletag.enableServices();state.services=true;}[1,2,3].forEach(function(n){var id='div-gpt-ad-banner'+n;if(paths['banner'+n]&&document.getElementById(id))googletag.display(id);});});}\n" +
            "function mount(force){if(!document.body)return;var route=location.pathname+location.search,complete=[1,2,3].every(function(n){return document.getElementById('div-gpt-ad-banner'+n);});if(!force&&state.route===route&&complete)return;document.querySelectorAll('[data-sitefoundry-runtime-ad]').forEach(function(n){n.remove();});var home=location.pathname==='/'||/\\/index\\.html?$/i.test(location.pathname),header=document.querySelector('header')||document.querySelector('nav'),main=document.querySelector('main')||document.querySelector('[role=main]')||document.getElementById('root')||document.body,footer=document.querySelector('footer'),section=main.querySelector('section:not([data-sitefoundry-runtime-ad])'),detail=document.querySelector('article')||document.querySelector('.detail-content')||document.querySelector('[class*=article-content]');after(header||main.firstElementChild,ad(1));after(home?(section||main.firstElementChild):(detail||section||main.firstElementChild),ad(2));var third=ad(3);if(footer&&footer.parentNode)footer.parentNode.insertBefore(third,footer);else main.appendChild(third);state.route=route;refresh(home);}\n" +
            "function schedule(force){clearTimeout(state.timer);state.timer=setTimeout(function(){mount(!!force);},160);}\n" +
            "['pushState','replaceState'].forEach(function(k){var original=history[k];if(!original||original.__sitefoundryWrapped)return;var wrapped=function(){var result=original.apply(this,arguments);schedule(true);return result;};wrapped.__sitefoundryWrapped=true;history[k]=wrapped;});\n" +
            "addEventListener('popstate',function(){schedule(true);});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){schedule(true);});else schedule(true);new MutationObserver(function(){schedule(false);}).observe(document.documentElement,{childList:true,subtree:true});\n" +
            "if(paths.analytics){var g=document.createElement('script');g.async=true;g.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(paths.analytics);document.head.appendChild(g);window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){dataLayer.push(arguments);};gtag('js',new Date());gtag('config',paths.analytics);}\n" +
            "})();\n";
    }

    function injectReactEntry(rawEntries, project, config, archiveName) {
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
        const runtimeBytes = textBytes(generateSpaAdRuntime(config));
        const existingRuntime = entries.find(function(item) { return item.path.toLowerCase() === project.runtimePath.toLowerCase(); });
        if (existingRuntime) existingRuntime.bytes = runtimeBytes;
        else entries.push({ path: project.runtimePath, bytes: runtimeBytes });
        const manifest = { schema: 'sitefoundry-ad-injection/v1', generatedAt: new Date().toISOString(), source: archiveName || 'finished-site', framework: project.framework, host: detectedHost(config), adPaths: config };
        const manifestPath = project.siteRoot + 'ad-injection.json';
        const existingManifest = entries.find(function(item) { return item.path.toLowerCase() === manifestPath.toLowerCase(); });
        if (existingManifest) existingManifest.bytes = textBytes(JSON.stringify(manifest, null, 2) + '\n');
        else entries.push({ path: manifestPath, bytes: textBytes(JSON.stringify(manifest, null, 2) + '\n') });
        return { valid: true, errors: [], warnings: project.warnings || [], entries: entries, project: project, changedPages: [project.entryPath], changedScripts: [project.runtimePath], restoredConfig: config };
    }

    function injectAdsIntoSiteEntries(rawEntries, config, archiveName) {
        const project = classifyInjectableSiteEntries(rawEntries, archiveName);
        if (!project.valid) return { valid: false, errors: project.errors, warnings: project.warnings || [], entries: rawEntries, project: project };
        if (!hasExternalBannerConfig(config)) return { valid: false, errors: [issue('广告代码缺少 banner1、banner2 或 banner3。', 'AD_INJECTION_CODE_INCOMPLETE')], warnings: [], entries: rawEntries, project: project };
        if (project.kind === 'static-html') {
            const restored = restoreEntries(rawEntries, config, archiveName, createPolicy());
            restored.project = project;
            return restored;
        }
        return injectReactEntry(rawEntries, project, config, archiveName);
    }

    function injectionReportText(results) {
        const lines = ['成品站广告注入报告', '生成时间：' + new Date().toISOString(), '规则：静态站直接写入广告位；React 站使用可监听渲染与路由变化的广告运行时。', ''];
        results.forEach(function(result) {
            lines.push((result.valid ? '[成功] ' : '[失败] ') + result.siteName);
            if (result.framework) lines.push('  识别类型：' + result.framework);
            if (result.host) lines.push('  广告域名：' + result.host);
            if (result.changedPages != null) lines.push('  修改入口/页面：' + result.changedPages + ' 个');
            (result.errors || []).forEach(function(error) { lines.push('  错误：' + error.message); });
            (result.warnings || []).forEach(function(warning) { lines.push('  提示：' + warning.message); });
            lines.push('');
        });
        return lines.join('\r\n');
    }

    async function applyAdCodeBatch(siteGroups, codeResults, onProgress) {
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
            const injected = injectAdsIntoSiteEntries(mapping.site.entries, mapping.code.config, mapping.siteName);
            if (!injected.valid) {
                results.push({ valid: false, siteName: mapping.siteName, framework: mapping.framework, host: mapping.host, errors: injected.errors, warnings: mapping.warnings.concat(injected.warnings || []) });
                continue;
            }
            const baseName = siteFolderName(mapping.siteName, mapping.host || 'site');
            const key = baseName.toLowerCase();
            usedNames[key] = (usedNames[key] || 0) + 1;
            const outputName = usedNames[key] === 1 ? baseName : baseName + '-' + usedNames[key];
            outputs.push({ name: outputName, entries: injected.entries, policy: createPolicy() });
            results.push({ valid: true, siteName: mapping.siteName, outputName: outputName, framework: mapping.framework, host: mapping.host, changedPages: (injected.changedPages || []).length, errors: [], warnings: mapping.warnings.concat(injected.warnings || []) });
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
