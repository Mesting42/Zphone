/**
 * 网站生成与导出模块
 * 负责根据配置生成所有网站文件并打包导出
 */

const Generator = (function() {

    // 模块级变量：Google Fonts链接（由generateCSS计算，供HTML生成使用）
    var _googleFontLink = '';

    function serializeForScript(value) {
        return JSON.stringify(String(value == null ? '' : value))
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026');
    }

    function hasAdRuntime(config) {
        return !!(config && (config.adRuntimeEnabled || (config.siteBuildMode === 'ad-migration' && config.adMigration && config.adMigration.valid)));
    }

    function hasValidatedAdConfig(config) {
        return !!(config && config.adMigration && config.adMigration.valid);
    }

    // 导出页以内联样式作为外部 CSS 的兜底。部分静态托管会错误地跳过 css/
    // 目录或返回错误 MIME 类型；页面仍使用与预览完全相同的生成样式。
    function renderExportStyles(config, stylesheetHref) {
        const inlineFallback = config && config.inlineStyleTag ? config.inlineStyleTag + '\n    ' : '';
        return `${_googleFontLink || ''}
    ${inlineFallback}<link rel="stylesheet" href="${stylesheetHref}">`;
    }

    function validateMigratedPage(html, pageType) {
        return typeof AdMigration !== 'undefined' ? AdMigration.validateGeneratedPage(html, pageType) : [];
    }

    // ========== 简易Markdown转HTML ==========
    function simpleMarkdownToHtml(md) {
        if (!md) return '';
        let html = md;
        // h3
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        // h2
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        // 粗体
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // 斜体
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        // 链接
        html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
        // 无序列表
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
        // 段落：非标签行包裹<p>
        html = html.replace(/^(?!<[huplo]|<li|<ul|<\/)(.+)$/gm, '<p>$1</p>');
        // 清理多余空行
        html = html.replace(/<p>\s*<\/p>/g, '');
        return html;
    }

    // ========== 生成SEO关键词 ==========
    function generateKeywords(item, themeId) {
        const words = [];
        if (item.title) words.push(item.title);
        if (item.genres) words.push(item.genres);
        if (item.cuisine) words.push(item.cuisine);
        // 主题关键词直接读取领域目录，新增领域无需再维护第二份映射。
        const profile = typeof DOMAIN_CATALOG !== 'undefined' ? DOMAIN_CATALOG[themeId] : null;
        words.push(profile ? profile.keywords.slice(0, 5).join(', ') : '');
        return words.filter(w => w).join(', ').substring(0, 200);
    }

    // ========== 获取数据项ID ==========
    function getItemId(item, index) {
        if (item.id !== undefined && item.id !== null) return item.id;
        return index + 1;
    }

    // ========== 获取数据项图片路径 ==========
    function getImageSrc(item, imageField, isLocalImages) {
        const imgVal = item[imageField];
        if (!imgVal) return '';
        if (isLocalImages) {
            // 本地图片：重写路径
            const filename = imgVal.split('/').pop().split('\\').pop();
            return 'images/' + filename;
        }
        return imgVal;
    }

    // ========== 广告代码模板 ==========
    const AD_TEMPLATES = {
        adv1: '<div id="adv1" style="text-align:center;padding:10px;display:flex;flex-direction:column;align-items:center;overflow:hidden;margin-top:1px;"><div style="text-align:center;color:black;font-size:13px;">advertisement1</div><div id="div-gpt-ad-banner1" style="min-width:300px;min-height:250px;"></div></div>',
        adv2: '<div id="adv2" style="text-align:center;padding:10px;display:flex;flex-direction:column;align-items:center;overflow:hidden;margin-top:1px;"><div style="text-align:center;color:black;font-size:13px;">advertisement2</div><div id="div-gpt-ad-banner2" style="min-width:300px;min-height:250px;"></div></div>',
        adv3: '<div id="adv3" style="text-align:center;padding:10px;display:flex;flex-direction:column;align-items:center;overflow:hidden;margin-top:1px;"><div style="text-align:center;color:black;font-size:13px;">advertisement3</div><div id="div-gpt-ad-banner3" style="min-width:300px;min-height:250px;"></div></div>'
    };

    // 全部文章页沿用详情页广告配置；正文相关广告位在文章列表中段展示。
    function getAllArticlesDetailAds(config, positions) {
        let code = '';
        for (const [adId, pages] of Object.entries(config.adPlacements || {})) {
            const position = pages && pages.detail;
            if (position && (positions.includes(position) || (positions.includes('detail-between-p-*') && /^detail-between-p-\d+$/.test(position)))) {
                code += AD_TEMPLATES[adId] || '';
            }
        }
        return positions.includes('after-navbar') && code
            ? '<div class="ad-region ad-after-navbar ad-nav-' + config.style.navbarStyle + '">' + code + '</div>'
            : code;
    }

    function buildAllArticlesCardGrid(config, cards) {
        const middleAds = getAllArticlesDetailAds(config, ['detail-between-p-*', 'detail-after-content', 'detail-before-related']);
        if (!middleAds) return '<div class="items-grid">' + cards.join('') + '</div>';
        const requestedColumns = Number(config.structure.cardColumns);
        const columns = config.style.cardViewMode === 'list' ? 1 :
            (Number.isInteger(requestedColumns) && requestedColumns >= 2 && requestedColumns <= 4 ? requestedColumns : 2);
        const completeRowsBeforeEnd = Math.floor((cards.length - 1) / columns);
        // 广告必须接在完整卡片行之后；不能按文章数一半截断网格，留下孤立卡片。
        const middleRow = completeRowsBeforeEnd > 0
            ? Math.max(1, Math.min(completeRowsBeforeEnd, Math.round(cards.length / (2 * columns))))
            : 0;
        const middleIndex = middleRow ? middleRow * columns : cards.length;
        const firstGrid = middleIndex ? '<div class="items-grid">' + cards.slice(0, middleIndex).join('') + '</div>' : '';
        const lastGrid = middleIndex < cards.length ? '<div class="items-grid">' + cards.slice(middleIndex).join('') + '</div>' : '';
        return firstGrid + middleAds + lastGrid;
    }

    const AD_RUNTIME_CACHE_VERSION = '20260923-ad-runtime-v101';

    function normalizeAdJsVersion(version) {
        return version === 'initial' || version === 'v1.0.0' || version === 'v1.0.2' ? version : 'v1.0.1';
    }

    function getAdRuntimeVersion(adPaths, version) {
        const selectedVersion = normalizeAdJsVersion(version);
        const source = JSON.stringify({ paths: adPaths || {}, version: selectedVersion });
        let hash = 2166136261;
        for (let index = 0; index < source.length; index += 1) {
            hash ^= source.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        const cacheVersion = selectedVersion === 'v1.0.1' ? AD_RUNTIME_CACHE_VERSION : '20260924-ad-runtime-' + selectedVersion.replace(/[^a-z0-9]/gi, '');
        return cacheVersion + '-' + (hash >>> 0).toString(36);
    }

    // ========== 生成 ad.js ==========
    function generateAdJs(adPaths, adPolicy) {
        var p = adPaths || {};
        var runtimePolicy = adPolicy && adPolicy.outOfPage ? {
            interstitial: {
                home: adPolicy.outOfPage.interstitial ? adPolicy.outOfPage.interstitial.home !== false : true,
                detail: !!(adPolicy.outOfPage.interstitial && adPolicy.outOfPage.interstitial.detail)
            },
            anchor: {
                home: adPolicy.outOfPage.anchor ? adPolicy.outOfPage.anchor.home !== false : true,
                detail: adPolicy.outOfPage.anchor ? adPolicy.outOfPage.anchor.detail !== false : true
            }
        } : null;
        var runtimePolicySource = JSON.stringify(runtimePolicy)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026');
        var disabledPolicyComments = [];
        if (runtimePolicy && adPolicy.writeDisabledComments !== false) {
            ['interstitial', 'anchor'].forEach(function(kind) {
                ['home', 'detail'].forEach(function(page) {
                    if (!runtimePolicy[kind][page]) disabledPolicyComments.push('// AD_POLICY_DISABLED ' + kind + ' page=' + page + ' (广告路径保留)');
                });
            });
        }
        return `const bannerPath1 = ${serializeForScript(p.bannerPath1 || '')};
const bannerPath2 = ${serializeForScript(p.bannerPath2 || '')};
const bannerPath3 = ${serializeForScript(p.bannerPath3 || '')};
const bannerPath4 = ${serializeForScript(p.bannerPath4 || '')};
const interstitialPath = ${serializeForScript(p.interstitialPath || '')};
const anchorPath = ${serializeForScript(p.anchorPath || '')};
const analyticsID = ${serializeForScript(p.analyticsID || '')};
${disabledPolicyComments.join('\n')}

var bannerSlot1, bannerSlot2, bannerSlot3, bannerSlot4;
var interstitialSlot, anchorSlot;

var isIndex = (window.location.pathname === '/' || window.location.pathname === '/index.html');
// Use path segments instead of a slash-delimited regular expression so generated ad.js stays valid JavaScript.
var detailPathSegments = window.location.pathname.toLowerCase().split('/');
var isDetail = detailPathSegments.indexOf('detail') !== -1 ||
    detailPathSegments.indexOf('details') !== -1 ||
    detailPathSegments.indexOf('article') !== -1 ||
    detailPathSegments.indexOf('articles') !== -1;
const adPolicy = ${runtimePolicySource};

function isAdPolicyEnabled(kind) {
    if (!adPolicy) return kind === 'interstitial' ? isIndex : true;
    if (isIndex) return !!adPolicy[kind].home;
    if (isDetail) return !!adPolicy[kind].detail;
    return false;
}

window.googletag = window.googletag || { cmd: [] };

// A user-selected gap may belong to a narrow column. Only custom placement
// wrappers use this class, so standard ad locations keep their native layout.
function centerCustomAdPlacements() {
    document.querySelectorAll('.sitefoundry-ad-custom-placement').forEach(function (node) {
        node.style.setProperty('--sitefoundry-ad-center-offset', '0px');
        var rect = node.getBoundingClientRect();
        var offset = window.innerWidth / 2 - (rect.left + rect.width / 2);
        node.style.setProperty('--sitefoundry-ad-center-offset', Math.round(offset * 100) / 100 + 'px');
    });
}

function queueCustomAdPlacementCenter() {
    window.requestAnimationFrame(centerCustomAdPlacements);
}

/* -------------------------------
   专业延迟加载广告模块
--------------------------------*/
function delayLoadBanner(slotName, slotPath, domId, size = [300, 250]) {
    const element = document.getElementById(domId);
    if (!element || !slotPath) return;

    let hasDefined = false;
    let hasDisplayed = false;

    console.log(\`[LazyLoad] 初始化监控: \${slotName}\`);

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {

                if (!hasDefined) {
                    console.log(\`[LazyLoad] \${slotName} 进入视口，定义广告位...\`);

                    googletag.cmd.push(function () {
                        window[slotName] = googletag.defineSlot(slotPath, size, domId)
                            .addService(googletag.pubads());
                        console.log(\`[LazyLoad] \${slotName} 已定义\`);
                    });

                    hasDefined = true;
                }

                if (!hasDisplayed) {
                    console.log(\`[LazyLoad] \${slotName} 第一次 display()，请求广告...\`);

                    googletag.cmd.push(function () {
                        googletag.display(domId);
                        console.log(\`[LazyLoad] \${slotName} display() 完成\`);
                    });

                    hasDisplayed = true;
                }

                observer.disconnect();
            }
        });
    }, { threshold: 0.1 });

    observer.observe(element);
}

/* -------------------------------
   GPT 定义阶段（不 display）
--------------------------------*/
googletag.cmd.push(function () {

    if (bannerPath4 && document.getElementById('div-gpt-ad-banner4')) {
        bannerSlot4 = googletag.defineSlot(bannerPath4, [300, 250], 'div-gpt-ad-banner4')
            .addService(googletag.pubads());
        console.log("[Init] banner4 已定义（非延迟加载）");
    }

    // AD_POLICY: 路径始终保留，只按首页/详情页策略决定是否定义插屏。
    if (interstitialPath && isAdPolicyEnabled('interstitial')) {
        interstitialSlot = googletag.defineOutOfPageSlot(
            interstitialPath,
            googletag.enums.OutOfPageFormat.INTERSTITIAL
        );
        if (interstitialSlot) {
            interstitialSlot.addService(googletag.pubads());
            console.log("[Init] Interstitial 已定义");
        }
    }

    // AD_POLICY: 路径始终保留，只按首页/详情页策略决定是否定义锚点。
    if (anchorPath && isAdPolicyEnabled('anchor')) {
        anchorSlot = googletag.defineOutOfPageSlot(
            anchorPath,
            googletag.enums.OutOfPageFormat.BOTTOM_ANCHOR
        );
        if (anchorSlot) {
            anchorSlot.addService(googletag.pubads());
            console.log("[Init] Anchor 已定义");
        }
    }

    googletag.pubads().enableSingleRequest();
    googletag.enableServices();
});

/* -------------------------------
   DOM 就绪后开始监控广告位进入视口
 --------------------------------*/
var bannerObserversInitialized = false;
function initializeBannerObservers() {
    if (bannerObserversInitialized) return;
    bannerObserversInitialized = true;

    delayLoadBanner("bannerSlot1", bannerPath1, "div-gpt-ad-banner1");
    delayLoadBanner("bannerSlot2", bannerPath2, "div-gpt-ad-banner2");
    delayLoadBanner("bannerSlot3", bannerPath3, "div-gpt-ad-banner3");

    if (bannerPath4 && document.getElementById('div-gpt-ad-banner4')) {
        console.log("[Display] banner4 正常加载 display()");
        googletag.cmd.push(() => googletag.display("div-gpt-ad-banner4"));
    }
    queueCustomAdPlacementCenter();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBannerObservers, { once: true });
} else {
    initializeBannerObservers();
}

window.addEventListener('resize', queueCustomAdPlacementCenter);

if (analyticsID) {
    const gtagScript = document.createElement('script');
    gtagScript.async = true;
    gtagScript.src = \`https://www.googletagmanager.com/gtag/js?id=\${analyticsID}\`;
    document.head.appendChild(gtagScript);

    gtagScript.onload = function() {
        window.dataLayer = window.dataLayer || [];

        function gtag() {
            dataLayer.push(arguments);
        }

        gtag('js', new Date());
        gtag('config', analyticsID);
    };
} else {
    console.warn('Analytics ID is empty. Skipping Google Analytics initialization.');
}`;
    }

    // 普通建站、广告移植与批量建站按所选版本输出；这里保留 v1.0.1 模板作为兼容底稿。
    // 广告恢复的策略运行时仍由 generateAdJs 单独生成。
    function generateNormalAdJs(adPaths) {
        var p = adPaths || {};
        return `/**
 * ad.js v1.0.1
 * Updated: 2026-09-23
 */

/* ========================================= */
// 广告单元
const adUnitBanner1 = ${serializeForScript(p.bannerPath1 || '')};
const adUnitBanner2 = ${serializeForScript(p.bannerPath2 || '')};
const adUnitBanner3 = ${serializeForScript(p.bannerPath3 || '')};
const adUnitInterstitial = ${serializeForScript(p.interstitialPath || '')};
const adUnitAnchor = ${serializeForScript(p.anchorPath || '')};

// Google Analytics
const gaMeasurementId = ${serializeForScript(p.analyticsID || '')};
/* ========================================= */

const isIndex = window.location.pathname === "/" || window.location.pathname === "/index.html";
window.googletag = window.googletag || { cmd: [] };

let bannerSlot1 = null;
let bannerSlot2 = null;
let bannerSlot3 = null;
let interstitialSlot = null;
let anchorSlot = null;

document.addEventListener("DOMContentLoaded",
    function () {
        googletag.cmd.push(function () {

            // GPT 原生 Lazy Load
            googletag.setConfig({
                lazyLoad: {
                    fetchMarginPercent: 50,
                    renderMarginPercent: 0,
                    mobileScaling: 1
                },
                singleRequest: false
            });

            // Banner
            if (adUnitBanner1 && document.getElementById("div-gpt-ad-banner1")) {
                bannerSlot1 = googletag.defineSlot(adUnitBanner1, [300, 250], "div-gpt-ad-banner1").addService(googletag.pubads());
            }
            if (adUnitBanner2 && document.getElementById("div-gpt-ad-banner2")) {
                bannerSlot2 = googletag.defineSlot(adUnitBanner2, [300, 250], "div-gpt-ad-banner2").addService(googletag.pubads());
            }
            if (adUnitBanner3 && document.getElementById("div-gpt-ad-banner3")) {
                bannerSlot3 = googletag.defineSlot(adUnitBanner3, [300, 250], "div-gpt-ad-banner3").addService(googletag.pubads());
            }

            // Interstitial 仅首页
            if (isIndex && adUnitInterstitial) {
                interstitialSlot = googletag.defineOutOfPageSlot(adUnitInterstitial, googletag.enums.OutOfPageFormat.INTERSTITIAL);
                if (interstitialSlot) {
                    interstitialSlot.addService(googletag.pubads());

                    // 触发器
                    interstitialSlot.setConfig({
                        interstitial: {
                            triggers: {
                                unhideWindow: true,
                                navBar: true,
                                inactivity: true,
                                endOfArticle: true,
                                continueReading: true
                            }
                        }
                    });
                }
            }

            // Bottom Anchor
            if (adUnitAnchor) {
                anchorSlot = googletag.defineOutOfPageSlot(adUnitAnchor, googletag.enums.OutOfPageFormat.BOTTOM_ANCHOR);
                if (anchorSlot) {
                    anchorSlot.addService(googletag.pubads());
                }
            }

            // 启动 GPT
            googletag.enableServices();

            // Banner display
            if (bannerSlot1) {
                googletag.display("div-gpt-ad-banner1");
            }
            if (bannerSlot2) {
                googletag.display("div-gpt-ad-banner2");
            }
            if (bannerSlot3) {
                googletag.display("div-gpt-ad-banner3");
            }

            // Out-of-page display
            if (interstitialSlot) {
                googletag.display(interstitialSlot);
            }
            if (anchorSlot) {
                googletag.display(anchorSlot);
            }
        });
    });

// Google Analytics
if (gaMeasurementId) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
        dataLayer.push(arguments);
    };
    gtag("js", new Date());
    gtag("config", gaMeasurementId);
    const gtagScript = document.createElement("script");
    gtagScript.async = true;
    gtagScript.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(gaMeasurementId);
    document.head.appendChild(gtagScript);
} else {
    console.warn("GA ID is empty.");
}`;
    }

    // Build v1.0.2 from the configurable v1.0.1 template so ad paths and GA IDs
    // continue to come from each workflow's settings rather than fixed values.
    function generateV102AdJs(baseSource) {
        let source = baseSource
            .replace('ad.js v1.0.1', 'ad.js v1.0.2')
            .replace('Updated: 2026-09-23', 'Updated: 2026-09-24');
        const lazyLoadBlock = /\/\/ GPT 原生 Lazy Load\s+googletag\.setConfig\(\{[\s\S]*?singleRequest: false\s*\}\);/;
        const analyticsBlock = /const gaMeasurementId = ([^\r\n]+);\r?\n\/\* ========================================= \*\//;
        if (!lazyLoadBlock.test(source) || !analyticsBlock.test(source)) {
            throw new Error('v1.0.2 广告模板生成失败：缺少懒加载或 GA 配置段。');
        }
        source = source.replace(lazyLoadBlock, `// GPT 设置：可通过开关控制原生懒加载
            if (enableLazyLoad) {
                googletag.setConfig({
                    lazyLoad: {
                        fetchMarginPercent: 50,
                        renderMarginPercent: 0,
                        mobileScaling: 1
                    },
                    singleRequest: false
                });
            } else {
                googletag.setConfig({
                    lazyLoad: null,
                    singleRequest: false
                });
            }`);
        source = source.replace(analyticsBlock, function(match, analyticsId) {
            return 'const gaMeasurementId = ' + analyticsId + ';\n\n' +
                '// 选项\n' +
                'const enableLazyLoad = false;              // 关闭广告延迟加载\n' +
                'const enableInterstitialTriggers = false;  // 关闭插屏广告额外触发器\n' +
                '/* ========================================= */';
        });
        let triggerCount = 0;
        source = source.replace(/(unhideWindow|navBar|inactivity|endOfArticle|continueReading): true/g, function(match, trigger) {
            triggerCount += 1;
            return trigger + ': enableInterstitialTriggers';
        });
        if (triggerCount !== 5) throw new Error('v1.0.2 广告模板生成失败：插屏触发器配置不完整。');
        return source;
    }

    function generateSelectedAdJs(adPaths, version) {
        const selectedVersion = normalizeAdJsVersion(version);
        if (selectedVersion === 'initial') {
            const source = typeof window !== 'undefined' && window.AD_JS_SOURCE;
            if (!source) throw new Error('初版 ad.js 模板未加载。');
            const paths = adPaths || {};
            return source.replace(/^const (bannerPath[1-4]|interstitialPath|anchorPath|analyticsID) = "";$/gm, function(line, key) {
                return 'const ' + key + ' = ' + serializeForScript(paths[key] || '') + ';';
            });
        }
        const latest = generateNormalAdJs(adPaths);
        if (selectedVersion === 'v1.0.1') return latest;
        if (selectedVersion === 'v1.0.2') return generateV102AdJs(latest);
        const triggerBlock = /\n\s*\/\/ 触发器\n\s*interstitialSlot\.setConfig\(\{[\s\S]*?\n\s*\}\);/;
        if (!triggerBlock.test(latest)) throw new Error('v1.0.0 广告模板生成失败：找不到插页广告触发器。');
        return latest.replace('ad.js v1.0.1', 'ad.js v1.0.0').replace(triggerBlock, '');
    }

    // ========== 生成CSS ==========
    function generateCSS(config) {
        const style = config.style;
        const preset = STYLE_PRESETS.find(s => s.id === style.selectedStyle) || STYLE_PRESETS[0];
        const vars = { ...preset.vars };

        // 覆盖组件级配置
        const radiusMap = { '0': '0', '2px': '2px', '4px': '4px', '8px': '8px', '12px': '12px', '16px': '16px', '24px': '24px' };
        const spacingMap = { '8px': '8px', '12px': '12px', '20px': '20px', '30px': '30px', '40px': '40px' };
        const gapMap = { '5px': '5px', '10px': '10px', '20px': '20px', '30px': '30px', '40px': '40px' };

        const cardRadius = radiusMap[style.cardRadius] || '8px';
        const cardSpacing = spacingMap[style.cardSpacing] || '20px';
        const gridGap = gapMap[style.gridGap] || '20px';
        const fixedColumnCount = Number(config.structure.cardColumns);
        // 列表视图永远是一列横向卡片；不能混入固定列数的 Flex 布局。
        const usesFixedDesktopColumns = style.cardViewMode !== 'list' && Number.isInteger(fixedColumnCount) && fixedColumnCount >= 2 && fixedColumnCount <= 4;
        const fixedCardWidth = usesFixedDesktopColumns
            ? `calc((100% - ${Number.parseFloat(gridGap) * (fixedColumnCount - 1)}px) / ${fixedColumnCount})`
            : null;
        const excerptLines = ['2', '3', '4'].includes(String(style.cardExcerptLines)) ? String(style.cardExcerptLines) : '3';
        const fontPreset = FONT_PRESETS.find(function(font) { return font.id === style.fontStyle; }) || FONT_PRESETS[0];
        const fontFamily = fontPreset.family;
        const fontStyleRule = fontPreset.style === 'italic' ? 'font-style: italic;' : '';
        const googleFontLink = fontPreset.google
            ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=${fontPreset.google}&display=swap" rel="stylesheet">`
            : '';
        _googleFontLink = googleFontLink;
        const transitionSpeed = style.transitionSpeed || '0.3s';
        const requestedNavbarHeight = style.navbarHeight || '60px';
        const requestedNavbarPixels = /^\d+(?:\.\d+)?px$/i.test(requestedNavbarHeight)
            ? Number.parseFloat(requestedNavbarHeight)
            : null;
        // A boxed wordmark needs a visibly breathable header even when a compact
        // template requests a 50px or 60px navigation height.
        const navbarHeight = style.logoStyle === 'boxed' && requestedNavbarPixels !== null && requestedNavbarPixels < 72
            ? '72px'
            : requestedNavbarHeight;

        return `/* 网站样式 - 由批量建站工具生成 */
:root {
    --color-bg: ${vars['--color-bg']};
    --color-bg-secondary: ${vars['--color-bg-secondary']};
    --color-surface: ${vars['--color-surface']};
    --color-primary: ${vars['--color-primary']};
    --color-text: ${vars['--color-text']};
    --color-text-secondary: ${vars['--color-text-secondary']};
    --color-border: ${vars['--color-border']};
    --color-card-bg: ${vars['--color-card-bg']};
    --color-card-hover: ${vars['--color-card-hover']};
    --navbar-bg: ${vars['--navbar-bg']};
    --color-primary-rgb: ${vars['--color-primary-rgb']};
    --card-radius: ${cardRadius};
    --card-spacing: ${cardSpacing};
    --grid-gap: ${gridGap};
    --transition-speed: ${transitionSpeed};
    --navbar-height: ${navbarHeight};
    --navbar-frame-gap: 0px;
    --navbar-menu-offset: 0px;
    --navbar-scroll-offset: 16px;
    --card-image-height: ${style.cardImageHeight || '180px'};
    --content-max-width: ${style.contentMaxWidth === 'full' ? '100%' : (style.contentMaxWidth || '1200px')};
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    scrollbar-width: thin;
    scrollbar-color: var(--color-primary) var(--color-bg-secondary);
}

*::-webkit-scrollbar {
    width: 12px;
    height: 12px;
}

*::-webkit-scrollbar-track {
    background: var(--color-bg-secondary);
}

*::-webkit-scrollbar-thumb {
    min-height: 48px;
    border: 3px solid var(--color-bg-secondary);
    border-radius: 999px;
    background: var(--color-primary);
}

*::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-secondary);
}

*::-webkit-scrollbar-button {
    display: none;
    width: 0;
    height: 0;
}

*::-webkit-scrollbar-corner {
    background: var(--color-bg-secondary);
}

body {
    font-family: ${fontFamily};
    ${fontStyleRule}
    background: var(--color-bg);
    color: var(--color-text);
    line-height: 1.6;
    min-height: 100vh;
}

a { color: var(--color-primary); text-decoration: none; transition: color var(--transition-speed); }
a:hover { opacity: 0.85; }

img { max-width: 100%; height: auto; }

.container { max-width: var(--content-max-width); margin: 0 auto; padding: 0 20px; }

/* 广告容器本身会为 300×250 创意预留空间；紧随其后的内容不再重复叠加大块顶部留白。 */
.ad-region + .main-content,
#adv1 + .main-content,
#adv2 + .main-content,
#adv3 + .main-content { padding-top: 16px; }

.ad-region + .detail-page,
#adv1 + .detail-page,
#adv2 + .detail-page,
#adv3 + .detail-page { padding-top: 16px; }

/* 广告区域与导航栏完全分层，避免绝对/固定导航覆盖广告内容。 */
.ad-region {
    position: relative;
    z-index: 1;
    clear: both;
    display: block;
    flex: 0 0 100%;
    width: 100%;
    overflow: hidden;
    background: var(--color-bg);
}

/* 导航栏 */
.navbar {
    position: sticky;
    top: 0;
    left: 0;
    right: 0;
    background: var(--color-bg);
    background: var(--navbar-bg);
    height: var(--navbar-height);
    width: 100%;
    margin: 0;
    z-index: 1000;
    isolation: isolate;
    box-shadow: 0 6px 18px rgba(0,0,0,0.10);
    backdrop-filter: blur(14px) saturate(1.15);
    -webkit-backdrop-filter: blur(14px) saturate(1.15);
}

.navbar.has-boxed-logo,
.navbar.has-boxed-logo .container {
    min-height: 72px;
}

.navbar .container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 100%;
}

.navbar.glass-sticky {
    backdrop-filter: blur(18px) saturate(1.25);
    -webkit-backdrop-filter: blur(18px) saturate(1.25);
}

.navbar.dark-fixed {
    background: var(--color-bg);
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
}

.navbar.transparent {
    /* 透明页眉保留在文档流中，避免覆盖 Hero、广告或正文的首行。 */
    position: sticky;
    top: 0;
    background: color-mix(in srgb, var(--navbar-bg) 46%, transparent);
    box-shadow: 0 1px 0 rgba(var(--color-primary-rgb), .12);
    backdrop-filter: blur(12px) saturate(1.08);
    -webkit-backdrop-filter: blur(12px) saturate(1.08);
}

/* 侧边抽屉：导航栏保持顶部，链接在侧边面板中 */
.navbar.side-drawer { backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.navbar.side-drawer .nav-links { display: none; }
.navbar.side-drawer .container { position: relative; }
.navbar.side-drawer .hamburger { display: block; margin-left: auto; }

.side-drawer-panel {
    position: fixed;
    top: 0;
    left: -280px;
    width: 280px;
    height: 100vh;
    background: var(--color-bg);
    z-index: 2000;
    transition: left 0.3s ease;
    box-shadow: 2px 0 10px rgba(0,0,0,0.3);
    padding: 20px;
    overflow-y: auto;
}
.side-drawer-panel.open { left: 0; }
.side-drawer-panel .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--color-border);
}
.side-drawer-panel .drawer-header .drawer-logo {
    display: inline-flex;
    align-items: center;
    gap: 0.38em;
    font-size: 20px;
    font-weight: 700;
    color: var(--color-primary);
    text-decoration: none;
}
.side-drawer-panel .drawer-close {
    background: none;
    border: none;
    color: var(--color-text);
    font-size: 24px;
    cursor: pointer;
    padding: 4px 8px;
    line-height: 1;
}
.side-drawer-panel .drawer-nav {
    list-style: none;
    padding: 0;
    margin: 0;
}
.side-drawer-panel .drawer-nav li {
    border-bottom: 1px solid var(--color-border);
}
.side-drawer-panel .drawer-nav a {
    display: block;
    padding: 12px 0;
    color: var(--color-text);
    text-decoration: none;
    font-size: 15px;
    transition: color 0.2s;
}
.side-drawer-panel .drawer-nav a:hover {
    color: var(--color-primary);
}

.drawer-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 1999;
}
.drawer-overlay.active { display: block; }

.navbar.bottom-fixed {
    position: sticky;
    top: 0;
    bottom: auto;
    z-index: 1000;
    box-shadow: 0 -2px 10px rgba(0,0,0,0.3);
}

.navbar .logo {
    display: inline-flex;
    align-items: center;
    gap: 0.38em;
    font-size: 22px;
    font-weight: 700;
    color: var(--color-primary);
}

.navbar .logo.logo-boxed {
    min-height: 42px;
    padding: 6px 12px;
    border: 2px solid var(--color-primary);
    border-radius: 6px;
    line-height: 1.2;
    white-space: nowrap;
}

/* 保持渐变 Logo 的色阶独立于正文色：某些深色主题中主色与正文色接近，
   旧写法会在视觉上退化为单色文字。 */
.navbar .logo.logo-gradient-text {
    display: inline-block;
    color: #7c3aed;
    background-image: linear-gradient(100deg, #22d3ee 0%, #7c3aed 34%, #ec4899 67%, #f59e0b 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
}

.logo-mark {
    display: inline-grid;
    place-items: center;
    flex: 0 0 auto;
    font-family: "Segoe UI Emoji", "Apple Color Emoji", sans-serif;
    font-style: normal;
    line-height: 1;
}

.navbar .nav-links {
    display: flex;
    list-style: none;
    gap: 24px;
}

.navbar.navbar-centered .container {
    justify-content: center;
    position: relative;
}

.navbar.navbar-centered .logo {
    position: absolute;
    left: 20px;
}

.navbar.navbar-left .container {
    justify-content: flex-start;
    gap: 32px;
}

.navbar .nav-links a {
    color: var(--color-text);
    font-size: 14px;
    padding: 8px 0;
    transition: color var(--transition-speed);
}

.navbar .nav-links a:hover {
    color: var(--color-primary);
}

.navbar .hamburger {
    display: none;
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
}

.navbar .hamburger span {
    display: block;
    width: 24px;
    height: 2px;
    background: var(--color-text);
    margin: 5px 0;
    transition: all var(--transition-speed);
}

/* Hero区域 */
.hero {
    padding: 80px 20px;
    text-align: center;
    ${config.structure.heroEnabled ? `background: ${config.theme.hero.bgStyle};` : ''}
    ${style.heroStyle === 'solid' ? 'background: var(--color-surface) !important;' :
      style.heroStyle === 'minimal' ? 'background: transparent !important; border-bottom: 1px solid var(--color-border);' :
      style.heroStyle === 'pattern' ? 'background: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.03) 10px, rgba(255,255,255,0.03) 20px) !important; background-color: var(--color-bg-secondary) !important;' :
      ''}
}

.hero-title {
    font-size: 42px;
    margin-bottom: 16px;
    ${style.heroStyle === 'minimal' ? 'color: var(--color-primary);' : 'color: #fff;'}
}

.hero-subtitle {
    font-size: 18px;
    color: ${style.heroStyle === 'minimal' ? 'var(--color-text-secondary)' : 'rgba(255,255,255,0.8)'};
    max-width: 600px;
    margin: 0 auto;
}

/* 主内容区域 */
.main-content {
    padding: 40px 0;
}

/* 分类区域 */
.category-section {
    scroll-margin-top: calc(var(--navbar-height) + var(--navbar-scroll-offset));
    margin-bottom: 48px;
    ${style.categoryTitleAlign === 'center' ? 'text-align: center;' : ''}
}

.category-title {
    font-size: 24px;
    margin-bottom: 20px;
    padding-bottom: 10px;
    display: ${style.categoryTitleAlign === 'center' ? 'block' : 'inline-block'};
    ${style.categoryTitleStyle === 'none' ? 'border-bottom: none; padding-bottom: 0;' :
      style.categoryTitleStyle === 'double' ? 'border-bottom: 4px double var(--color-primary);' :
      style.categoryTitleStyle === 'dotted' ? 'border-bottom: 2px dotted var(--color-primary);' :
      style.categoryTitleStyle === 'gradient' ? 'border-bottom: none; padding-bottom: 0; position: relative;' :
      style.categoryTitleStyle === 'left-accent' ? 'border-bottom: none; padding-bottom: 0; border-left: 4px solid var(--color-primary); padding-left: 12px;' :
      'border-bottom: 2px solid var(--color-primary);'}
}
${style.categoryTitleStyle === 'gradient' ? `.category-title::after { content: ''; position: absolute; bottom: 0; left: 0; width: 100%; height: 3px; background: linear-gradient(90deg, var(--color-primary), transparent); border-radius: 2px; }` : ''}

/* 资讯/游戏网格 */
.items-grid {
    display: grid;
    ${config.structure.cardColumns === 'auto' ?
        'grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));' :
        `grid-template-columns: repeat(${config.structure.cardColumns}, 1fr);`
    }
    gap: var(--grid-gap);
    align-items: stretch;
}

${config.structure.cardColumns === 'auto' ? `
/* 全部文章页的中段广告将列表分成两段；收起未使用的自动列，避免广告前出现空列。 */
#all-articles .items-grid { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
` : ''}

${config.structure.cardColumns === 'auto' ? `
/* 仅在自动列数时，按实际文章数补齐均衡网格；固定列数必须完全遵从用户选择。 */
@media (min-width: 769px) {
    .items-grid.item-count-1 {
        display: grid !important;
        column-count: initial !important;
        grid-template-columns: minmax(0, 1fr) !important;
    }
    .items-grid.item-count-2 {
        display: grid !important;
        column-count: initial !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
    .items-grid.item-count-2 .card-image-frame {
        height: auto !important;
        min-height: 0;
        aspect-ratio: 16 / 9;
    }
    .items-grid.item-count-2 .card-image {
        height: 100% !important;
        aspect-ratio: auto;
        object-fit: cover !important;
        background-image: none !important;
    }
    .items-grid.item-count-3 {
        display: grid !important;
        column-count: initial !important;
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    }
    .items-grid.item-count-4 {
        display: grid !important;
        column-count: initial !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
    .items-grid.item-count-6 {
        display: grid !important;
        column-count: initial !important;
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    }
}
` : ''}

${config.structure.cardColumns === 'auto' ? `
/* 自动列数时才使用模板蓝图：让模板改变内容编排，而不只是换配色。
   3、4、6 条内容采用完整网格；5 条内容保留首卡强调，形成 1 + 2 + 2 的平衡节奏。 */
.main-content.layout-featured .category-section:first-child .items-grid:not(.item-count-3):not(.item-count-4):not(.item-count-6) .item-card:first-child:nth-last-child(n + 4) {
    grid-column: span 2;
}
.main-content.layout-featured .category-section:first-child .items-grid:not(.item-count-3):not(.item-count-4):not(.item-count-6) .item-card:first-child:nth-last-child(n + 4) .card-image-frame {
    height: calc(var(--card-image-height) * 1.25);
}
.main-content.layout-masonry .items-grid {
    display: block;
    column-count: 3;
    column-gap: var(--grid-gap);
}
.main-content.layout-masonry .item-card {
    display: inline-block;
    width: 100%;
    margin-bottom: var(--grid-gap);
    break-inside: avoid;
}
.main-content.layout-split .category-section:nth-child(even) .items-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
}
` : ''}
.main-content.layout-compact .category-section {
    margin-bottom: 28px;
}
.main-content.layout-compact .items-grid {
    gap: 10px;
}
@media (max-width: 800px) {
    .main-content.layout-featured .category-section:first-child .item-card:first-child {
        grid-column: auto;
    }
    .main-content.layout-masonry .items-grid {
        column-count: 2;
    }
}
@media (max-width: 520px) {
    .main-content.layout-masonry .items-grid {
        column-count: 1;
    }
}

${usesFixedDesktopColumns ? `
/* 固定列数时，完整行保持指定列数；未满的一行作为卡片组居中。 */
@media (min-width: 769px) {
    .items-grid {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: stretch;
    }
    .items-grid .item-card {
        flex: 0 0 ${fixedCardWidth};
        max-width: ${fixedCardWidth};
        height: auto;
        align-self: stretch;
    }
}
` : ''}

/* 卡片样式 */
.item-card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    position: relative;
    height: 100%;
    background: var(--color-card-bg);
    border-radius: var(--card-radius);
    overflow: hidden;
    transition: all var(--transition-speed);
    ${style.cardBorder === 'thin' ? 'border: 1px solid var(--color-border);' :
      style.cardBorder === 'rounded' ? 'border: 1px solid var(--color-border); box-shadow: 0 2px 8px rgba(0,0,0,0.2);' :
      style.cardBorder === 'shadow' ? 'box-shadow: 0 4px 12px rgba(0,0,0,0.3);' :
      style.cardBorder === 'double' ? 'border: 3px double var(--color-border);' :
      style.cardBorder === 'dashed' ? 'border: 1px dashed var(--color-border);' :
      style.cardBorder === 'thick' ? 'border: 3px solid var(--color-border);' :
      'border: none;'}
}

.item-card:hover {
    ${style.cardHover === 'float' ? 'transform: translateY(-5px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); border-color: var(--color-primary);' :
      style.cardHover === 'scale' ? 'transform: scale(1.03);' :
      style.cardHover === 'flip' ? 'transform: rotateY(5deg);' :
      style.cardHover === 'glow' ? 'box-shadow: 0 0 20px rgba(var(--color-primary-rgb), 0.5);' :
      style.cardHover === 'bounce' ? 'transform: translateY(-3px); animation: bounce 0.4s;' :
      style.cardHover === 'tilt' ? 'transform: perspective(600px) rotateX(5deg);' :
      style.cardHover === 'border-glow' ? 'border-color: var(--color-primary); box-shadow: 0 0 12px rgba(var(--color-primary-rgb), 0.4);' :
      style.cardHover === 'slide-up' ? 'transform: translateY(-8px); transition: transform 0.4s cubic-bezier(0.22,1,0.36,1);' :
      ''}
}

@keyframes bounce {
    0%, 100% { transform: translateY(-3px); }
    50% { transform: translateY(-8px); }
}

${style.cardHover === 'image-zoom' ? `
.item-card:hover .card-image,
.item-card:focus-visible .card-image {
    transform: scale(1.075);
}
` : ''}

${style.cardHover === 'color-reveal' ? `
.item-card .card-image {
    filter: grayscale(0.72) saturate(0.68) contrast(0.94);
}
.item-card:hover .card-image,
.item-card:focus-visible .card-image {
    filter: none;
}
` : ''}

${style.cardHover === 'title-underline' ? `
.item-card .card-title {
    position: relative;
    width: fit-content;
    max-width: 100%;
}
.item-card .card-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: -4px;
    width: 100%;
    height: 2px;
    background: var(--color-primary);
    transform: scaleX(0);
    transform-origin: left center;
    transition: transform var(--transition-speed);
}
.item-card:hover .card-title::after,
.item-card:focus-visible .card-title::after {
    transform: scaleX(1);
}
` : ''}

${style.cardHover === 'accent-line' ? `
.item-card::after {
    content: '';
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 4px;
    background: var(--color-primary);
    pointer-events: none;
    transform: scaleX(0);
    transform-origin: left center;
    transition: transform var(--transition-speed);
}
.item-card:hover::after,
.item-card:focus-visible::after {
    transform: scaleX(1);
}
` : ''}

.item-card:focus-visible {
    outline: 3px solid var(--color-primary);
    outline-offset: 3px;
}

.item-card .card-image-frame {
    position: relative;
    flex: 0 0 auto;
    width: 100%;
    height: var(--card-image-height);
    overflow: hidden;
    background: var(--color-bg-secondary);
}

.item-card .card-image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    min-width: 100%;
    min-height: 100%;
    max-width: none;
    object-fit: cover !important;
    object-position: center center;
    transition: transform var(--transition-speed), filter var(--transition-speed), object-position var(--transition-speed);
}

.item-card .card-body {
    flex: 1;
    min-width: 0;
    padding: var(--card-spacing);
}

.item-card .card-title {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--color-text);
    overflow-wrap: anywhere;
}

.item-card .card-desc {
    font-size: 13px;
    line-height: 1.55;
    color: var(--color-text-secondary);
    overflow-wrap: anywhere;
    margin-bottom: 8px;
    ${style.cardExcerptLines === 'none' ? '' : `display: -webkit-box;
    overflow: hidden;
    min-height: ${Number(excerptLines) * 1.55}em;
    max-height: ${Number(excerptLines) * 1.55}em;
    -webkit-box-orient: vertical;
    line-clamp: ${excerptLines};
    -webkit-line-clamp: ${excerptLines};`}
}

.item-card .card-genres,
.item-card .card-cuisine {
    font-size: 12px;
    color: var(--color-text-secondary);
    margin-bottom: 6px;
}

.item-card .card-price {
    font-size: 14px;
    font-weight: 600;
}

.item-card .card-price.price-free {
    color: #4caf50;
}

.item-card .card-difficulty,
.item-card .card-cook-time,
.item-card .card-rating,
.item-card .card-episodes {
    font-size: 12px;
    color: var(--color-text-secondary);
    margin-bottom: 4px;
}

/* 列表视图模式 */
${style.cardViewMode === 'list' ? `
.items-grid {
    grid-template-columns: minmax(0, 1fr) !important;
}
.items-grid.item-count-1,
.items-grid.item-count-2,
.items-grid.item-count-3,
.items-grid.item-count-4,
.items-grid.item-count-5,
.items-grid.item-count-6,
.items-grid.item-count-7 {
    grid-template-columns: minmax(0, 1fr) !important;
}
.items-grid .item-card {
    display: flex;
    flex-direction: row;
    align-items: stretch;
}
.items-grid .item-card .card-image-frame {
    width: 240px;
    min-width: 240px;
    height: auto;
    min-height: 160px;
}
.items-grid .item-card .card-image {
    width: 100%;
    min-width: 0;
    height: 100%;
}
.items-grid .item-card .card-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
}
@media (max-width: 600px) {
    .items-grid .item-card {
        flex-direction: column;
    }
    .items-grid .item-card .card-image-frame {
        width: 100%;
        min-width: 100%;
        height: var(--card-image-height);
    }
}
` : ''}

${style.cardViewMode !== 'list' ? `
/* 分类数量布局不变量：2→2；3→3；4→2+2；5→1+2+2；6→3+3；7→1+2+2+2。
   此规则位于模板和固定列数规则之后，保证分类数量优先决定卡片编排。 */
@media (min-width: 769px) {
    .items-grid.item-count-2 {
        display: grid !important;
        width: 100%;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        grid-auto-rows: 1fr;
        align-items: stretch !important;
        column-count: initial !important;
    }
    .items-grid.item-count-3 {
        display: grid !important;
        width: 100%;
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        grid-auto-rows: 1fr;
        align-items: stretch !important;
        column-count: initial !important;
    }
    .items-grid.item-count-4 {
        display: grid !important;
        width: 100%;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        grid-auto-rows: 1fr;
        align-items: stretch !important;
        column-count: initial !important;
    }
    .items-grid.item-count-5 {
        display: grid !important;
        width: 100%;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        grid-auto-rows: 1fr;
        align-items: stretch !important;
        column-count: initial !important;
    }
    .items-grid.item-count-6 {
        display: grid !important;
        width: 100%;
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        grid-auto-rows: 1fr;
        align-items: stretch !important;
        column-count: initial !important;
    }
    .items-grid.item-count-7 {
        display: grid !important;
        width: 100%;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        grid-auto-rows: 1fr;
        align-items: stretch !important;
        column-count: initial !important;
    }
    .items-grid.item-count-5 > .item-card:first-child {
        grid-column: 1 / -1;
    }
    .items-grid.item-count-7 > .item-card:first-child {
        grid-column: 1 / -1;
    }
    .items-grid.item-count-2 > .item-card,
    .items-grid.item-count-3 > .item-card,
    .items-grid.item-count-4 > .item-card,
    .items-grid.item-count-5 > .item-card,
    .items-grid.item-count-6 > .item-card,
    .items-grid.item-count-7 > .item-card {
        display: flex !important;
        flex: none !important;
        flex-direction: column;
        width: auto !important;
        min-width: 0;
        max-width: none !important;
        height: auto !important;
        margin-bottom: 0 !important;
        align-self: stretch !important;
        break-inside: auto;
    }
}
` : ''}

/* 入场动画 */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes zoomIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
@keyframes slideLeft { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
@keyframes slideRight { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
@keyframes rotateIn { from { opacity: 0; transform: rotate(-10deg); } to { opacity: 1; transform: rotate(0); } }
@keyframes flipIn { from { opacity: 0; transform: perspective(600px) rotateY(-90deg); } to { opacity: 1; transform: perspective(600px) rotateY(0); } }

${style.animationEnter !== 'none' ? `
.items-grid .item-card {
    animation: ${style.animationEnter} ${transitionSpeed} ease forwards;
}
` : ''}

/* 详情页 */
.detail-page {
    max-width: ${style.detailLayout === 'sidebar' ? 'calc(var(--content-max-width) + 330px)' : 'var(--content-max-width)'};
    margin: 0 auto;
    padding: 30px 20px;
    ${style.detailLayout === 'sidebar' ? 'display: grid; grid-template-columns: 1fr 300px; gap: 30px;' : ''}
}

${style.detailLayout === 'sidebar' ? `
.detail-main { min-width: 0; }
.detail-sidebar { position: sticky; top: calc(var(--navbar-height) + 20px); align-self: start; }
.detail-sidebar .sidebar-box { background: var(--color-card-bg); border-radius: var(--card-radius); padding: 20px; margin-bottom: 20px; }
.detail-sidebar .sidebar-box h4 { font-size: 14px; color: var(--color-text-secondary); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
@media (max-width: 960px) {
    .detail-page { grid-template-columns: 1fr; max-width: var(--content-max-width); }
    .detail-sidebar { position: static; }
}
` : ''}

.back-link {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-top: 16px;
    margin-bottom: 24px;
    color: var(--color-text-secondary);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    transition: color var(--transition-speed), background var(--transition-speed), border-color var(--transition-speed), transform var(--transition-speed), box-shadow var(--transition-speed);
}

.back-link:hover { color: var(--color-primary); }
.back-link.breadcrumb {
    gap: 8px;
    padding: 7px 10px;
    border: 1px solid var(--color-border);
    border-radius: 7px;
    background: rgba(var(--color-primary-rgb), .06);
    color: var(--color-text-secondary);
    font-size: 13px;
}
.back-link.breadcrumb .breadcrumb-home { color: var(--color-primary); }
.back-link.breadcrumb .breadcrumb-separator { color: var(--color-text-secondary); opacity: .65; }
.back-link.breadcrumb .breadcrumb-current { color: var(--color-text); }
.back-link.button {
    padding: 10px 17px;
    border: 1px solid var(--color-primary);
    border-radius: 8px;
    margin-top: 20px;
    background: var(--color-primary);
    color: #fff;
    box-shadow: 0 6px 15px rgba(var(--color-primary-rgb), .24);
}
.back-link.button:hover {
    color: #fff;
    background: var(--color-primary);
    filter: brightness(1.07);
    transform: translateY(-1px);
    box-shadow: 0 9px 19px rgba(var(--color-primary-rgb), .3);
}
.back-link.minimal {
    gap: 5px;
    min-height: 32px;
    color: var(--color-text-secondary);
    font-size: 13px;
}
.back-link.minimal .back-link-arrow { transition: transform var(--transition-speed); }
.back-link.minimal:hover .back-link-arrow { transform: translateX(-3px); }
.back-link.underline {
    position: relative;
    padding-bottom: 4px;
    color: var(--color-text);
}
.back-link.underline::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 2px;
    border-radius: 2px;
    background: var(--color-primary);
    transform: scaleX(.35);
    transform-origin: left;
    transition: transform var(--transition-speed);
}
.back-link.underline:hover::after { transform: scaleX(1); }
.back-link.outline {
    min-height: 42px;
    padding: 9px 15px;
    border: 1px solid var(--color-primary);
    border-radius: 8px;
    color: var(--color-primary);
}
.back-link.outline:hover { background: var(--color-primary); color: #fff; }
.back-link.pill {
    min-height: 42px;
    padding: 9px 17px;
    border: 1px solid rgba(var(--color-primary-rgb), .24);
    border-radius: 999px;
    background: rgba(var(--color-primary-rgb), .11);
    color: var(--color-primary);
}
.back-link.pill:hover { background: var(--color-primary); color: #fff; }
.back-link.icon {
    position: relative;
    justify-content: center;
    width: 44px;
    min-width: 44px;
    min-height: 44px;
    gap: 0;
    border: 1px solid rgba(var(--color-primary-rgb), .2);
    border-radius: 10px;
    background: rgba(var(--color-primary-rgb), .1);
    color: var(--color-primary);
    font-size: 21px;
    box-shadow: 0 4px 12px rgba(var(--color-primary-rgb), .12);
}
.back-link.icon:hover {
    background: var(--color-primary);
    color: #fff;
    transform: translateY(-1px);
    box-shadow: 0 8px 17px rgba(var(--color-primary-rgb), .24);
}
.back-link .back-link-label {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}
.back-link.glass {
    min-height: 42px;
    padding: 9px 15px;
    border: 1px solid rgba(var(--color-primary-rgb), .27);
    border-radius: 10px;
    background: rgba(var(--color-primary-rgb), .1);
    color: var(--color-text);
    box-shadow: 0 5px 16px rgba(var(--color-primary-rgb), .08);
    backdrop-filter: blur(10px);
}
.back-link.glass:hover { background: rgba(var(--color-primary-rgb), .19); color: var(--color-primary); }
@media (prefers-reduced-motion: reduce) {
    .back-link, .back-link * { transition: none !important; }
}

.detail-hero-image {
    width: 100%;
    border-radius: var(--card-radius);
    margin-bottom: 24px;
    ${style.detailImgStyle === 'centered' ? 'max-width: 80%; margin-left: auto; margin-right: auto; display: block;' :
      style.detailImgStyle === 'float-left' ? 'float: left; max-width: 50%; margin-right: 24px; margin-bottom: 12px;' :
      style.detailImgStyle === 'float-right' ? 'float: right; max-width: 50%; margin-left: 24px; margin-bottom: 12px;' :
      style.detailImgStyle === 'banner' ? 'max-height: 200px; object-fit: cover; width: 100%;' :
      ''}
}

.detail-title {
    font-size: 32px;
    margin-bottom: 20px;
}

.detail-meta {
    display: ${style.metaLayout === 'list' ? 'flex; flex-direction: column;' :
                style.metaLayout === 'tags' ? 'flex; flex-wrap: wrap; gap: 8px;' :
                'grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));'};
    gap: 12px;
    margin-bottom: 24px;
    padding: 20px;
    border-radius: var(--card-radius);
    ${style.metaBg === 'dark' ? 'background: var(--color-card-bg);' :
      style.metaBg === 'light' ? 'background: rgba(255,255,255,0.05);' :
      style.metaBg === 'primary' ? 'background: var(--color-surface);' :
      style.metaBg === 'bordered' ? 'background: transparent; border: 1px solid var(--color-border);' :
      'background: transparent;'}
}

.meta-item {
    ${style.metaLayout === 'tags' ? 'display: inline-block; padding: 4px 12px; background: var(--color-surface); border-radius: 20px; font-size: 13px;' : ''}
}

.meta-label {
    font-size: 12px;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.meta-value {
    font-size: 14px;
    font-weight: 600;
}

.meta-value.price-free {
    color: #4caf50;
}

.action-btn {
    display: inline-block;
    padding: ${style.btnSize === 'xsmall' ? '6px 14px' : style.btnSize === 'small' ? '8px 20px' : style.btnSize === 'large' ? '14px 36px' : style.btnSize === 'xlarge' ? '18px 44px' : '12px 28px'};
    font-size: ${style.btnSize === 'xsmall' ? '12px' : style.btnSize === 'small' ? '13px' : style.btnSize === 'large' ? '16px' : style.btnSize === 'xlarge' ? '18px' : '14px'};
    font-weight: 600;
    text-decoration: none;
    transition: all var(--transition-speed);
    cursor: pointer;
    border-radius: ${style.btnStyle === 'square' ? '4px' : style.btnStyle === 'rounded' ? '24px' : style.btnStyle === 'pill' ? '50px' : '8px'};
    ${style.btnStyle === 'gradient' ? 'background: linear-gradient(135deg, var(--color-primary), var(--color-surface)); color: #fff; border: none;' :
      style.btnStyle === '3d' ? 'background: var(--color-primary); color: #fff; border: none; box-shadow: 0 4px 0 rgba(0,0,0,0.3); transform: translateY(0);' :
      style.btnStyle === 'outline' ? 'background: transparent; color: var(--color-primary); border: 2px solid var(--color-primary);' :
      style.btnStyle === 'pill' ? 'background: var(--color-primary); color: #fff; border: none;' :
      style.btnStyle === 'ghost' ? 'background: transparent; color: var(--color-primary); border: none;' :
      'background: var(--color-primary); color: #fff; border: none;'}
}

.action-btn:hover {
    ${style.btnStyle === '3d' ? 'transform: translateY(-2px); box-shadow: 0 6px 0 rgba(0,0,0,0.3);' :
      style.btnStyle === 'outline' ? 'background: var(--color-primary); color: #fff;' :
      style.btnStyle === 'ghost' ? 'background: rgba(var(--color-primary-rgb), 0.1);' :
      'opacity: 0.9;'}
}

.view-all-articles { text-align: center; margin: 28px 0 12px; }

.detail-content {
    margin-top: 30px;
    line-height: 1.8;
}

.detail-content h2 {
    font-size: 24px;
    margin: 30px 0 16px;
}

.detail-content h3 {
    font-size: 20px;
    margin: 24px 0 12px;
}

.detail-content p {
    margin-bottom: 16px;
}

.detail-content ul, .detail-content ol {
    margin: 16px 0;
    padding-left: 24px;
}

.detail-content li {
    margin-bottom: 8px;
}

/* 相关推荐 */
.related-section {
    margin-top: 48px;
    padding-top: 32px;
    border-top: 1px solid var(--color-border);
}

.related-title {
    font-size: 22px;
    margin-bottom: 20px;
}

.related-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--grid-gap);
}

.related-card {
    display: block;
    background: var(--color-card-bg);
    border-radius: var(--card-radius);
    overflow: hidden;
    transition: all var(--transition-speed);
}

.related-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.related-card img {
    width: 100%;
    height: 140px;
    object-fit: cover;
}

.related-info {
    padding: 12px;
}

.related-name {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 4px;
}

.related-genre,
.related-cuisine {
    font-size: 12px;
    color: var(--color-text-secondary);
}

/* 页脚 */
.footer {
    background: var(--color-bg-secondary);
    padding: 40px 0 20px;
    margin-top: 60px;
}

.footer-content {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 30px;
    margin-bottom: 30px;
}

.footer-section h3 {
    font-size: 16px;
    margin-bottom: 12px;
    color: var(--color-primary);
}

.footer-section p {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin-bottom: 8px;
}

.footer-links {
    list-style: none;
}

.footer-links a {
    display: block;
    font-size: 13px;
    color: var(--color-text-secondary);
    padding: 4px 0;
}

.footer-links a:hover {
    color: var(--color-primary);
}

.footer-bottom {
    text-align: center;
    padding-top: 20px;
    border-top: 1px solid var(--color-border);
    font-size: 13px;
    color: var(--color-text-secondary);
}

.footer-simple {
    text-align: center;
    padding: 24px 0;
}

.footer-simple .footer-copy {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin-bottom: 12px;
}

.footer-simple .footer-links {
    display: flex;
    justify-content: center;
    gap: 24px;
    list-style: none;
}

/* 通用页面（Contact/About/Privacy/Terms） */
.page-content {
    max-width: 800px;
    margin: 40px auto;
    padding: 0 20px;
}

.page-content h1 {
    font-size: 28px;
    margin-bottom: 24px;
}

.page-content h2 {
    font-size: 22px;
    margin: 24px 0 12px;
}

.page-content p {
    margin-bottom: 16px;
    line-height: 1.8;
}

.page-content ul {
    margin: 16px 0;
    padding-left: 24px;
}

.contact-form {
    max-width: 500px;
}

.form-group {
    margin-bottom: 16px;
}

.form-group label {
    display: block;
    font-size: 14px;
    margin-bottom: 6px;
    color: var(--color-text-secondary);
}

.form-group input,
.form-group textarea {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-card-bg);
    color: var(--color-text);
    font-size: 14px;
}

.form-group textarea {
    min-height: 120px;
    resize: vertical;
}

.submit-btn {
    padding: 12px 32px;
    background: var(--color-primary);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: opacity var(--transition-speed);
}

.submit-btn:hover {
    opacity: 0.85;
}

/* 响应式 */
@media (max-width: 768px) {
    .navbar .container,
    .navbar.navbar-centered .container,
    .navbar.navbar-left .container {
        position: relative;
        justify-content: space-between !important;
        gap: 12px;
        padding-right: 64px;
    }

    .navbar.navbar-centered .logo,
    .navbar.navbar-left .logo {
        position: static;
        left: auto;
    }

    .navbar .nav-links {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--color-bg);
        flex-direction: column;
        padding: 20px;
        gap: 12px;
        display: none;
        border: 1px solid var(--color-border);
        border-radius: 0 0 14px 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 1001;
    }

    .navbar .nav-links.active {
        display: flex;
    }

    .navbar .hamburger {
        display: block;
        flex: 0 0 auto;
        position: absolute;
        top: 50%;
        right: 20px;
        margin: 0 !important;
        transform: translateY(-50%);
    }

    .detail-meta {
        grid-template-columns: 1fr;
    }

    .hero-title {
        font-size: 28px;
    }

    .detail-title {
        font-size: 24px;
    }

    .detail-hero-image.float-left,
    .detail-hero-image.float-right {
        float: none;
        max-width: 100%;
        margin-left: 0;
        margin-right: 0;
    }

    .detail-hero-image {
        display: block;
        width: 100%;
        max-width: 100% !important;
        height: auto;
        object-fit: contain;
        margin-left: 0;
        margin-right: 0;
    }

    /* 卡片移动端适配：缩小内部尺寸 */
    .items-grid {
        gap: 8px !important;
        grid-template-columns: 1fr !important;
    }
    .item-card .card-image-frame {
        width: 100%;
        height: auto;
        min-height: 0;
        aspect-ratio: 16 / 9;
    }
    .item-card .card-image {
        width: 100%;
        height: 100%;
        min-height: 0;
        aspect-ratio: auto;
        object-fit: cover;
    }
    .main-content.layout-featured .category-section:first-child .item-card:first-child .card-image-frame {
        height: auto !important;
        min-height: 0;
        aspect-ratio: 16 / 9;
    }
    .item-card .card-body {
        padding: 6px;
    }
    .item-card .card-title {
        font-size: 12px;
        margin-bottom: 4px;
    }
    .item-card .card-desc {
        font-size: 11px;
        margin-bottom: 4px;
    }
    .item-card .card-genres,
    .item-card .card-cuisine {
        font-size: 10px;
        margin-bottom: 2px;
    }
    .item-card .card-price {
        font-size: 11px;
    }
    .item-card .card-difficulty,
    .item-card .card-cook-time,
    .item-card .card-rating,
    .item-card .card-episodes {
        font-size: 10px;
        margin-bottom: 2px;
    }

    /* Compact the detailed footer into a readable mobile information block. */
    .footer {
        padding: 26px 0 14px;
        margin-top: 40px;
    }

    .footer-content {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px 16px;
        margin-bottom: 18px;
    }

    .footer-section h3 {
        font-size: 15px;
        margin-bottom: 7px;
    }

    .footer-section p {
        font-size: 12px;
        line-height: 1.5;
        margin-bottom: 4px;
    }

    .footer-section:first-child,
    .footer-section:last-child {
        grid-column: 1 / -1;
    }

    .footer-section:first-child p {
        display: -webkit-box;
        overflow: hidden;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
    }

    .footer-section:last-child {
        display: grid;
        grid-template-columns: auto 1fr;
        column-gap: 10px;
        align-items: center;
    }

    .footer-section:last-child h3 {
        grid-column: 1 / -1;
        margin-bottom: 2px;
    }

    .footer-section:last-child p {
        margin: 0;
    }

    .footer-links a {
        padding: 2px 0;
    }

    .footer-bottom {
        padding-top: 14px;
        font-size: 12px;
    }

    .footer-simple {
        padding: 18px 0;
    }

    .footer-simple .footer-copy {
        margin-bottom: 8px;
    }

    .footer-simple .footer-links {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 2px 12px;
    }
}

@media (max-width: 480px) {
    .container {
        padding: 0 8px;
    }

    .category-title {
        font-size: 20px;
    }

    /* 更小屏幕进一步缩小卡片 */
    .items-grid {
        gap: 6px !important;
    }
    .item-card .card-image-frame {
        height: auto;
        min-height: 0;
        aspect-ratio: 16 / 9;
    }
    .main-content.layout-featured .category-section:first-child .item-card:first-child .card-image-frame {
        height: auto !important;
        min-height: 0;
        aspect-ratio: 16 / 9;
    }
    .item-card .card-body {
        padding: 12px;
    }
    .item-card .card-title {
        font-size: 14px;
    }
    .item-card .card-desc {
        font-size: 12px;
    }
    .item-card .card-genres,
    .item-card .card-cuisine {
        font-size: 11px;
    }
    .item-card .card-price {
        font-size: 12px;
    }

    .back-link {
        margin-top: 22px;
        margin-bottom: 28px;
    }
}
`;
    }

    // ========== 生成导航栏HTML ==========
    function categoryAnchorId(category, index) {
        const label = String(category && category.name || '').trim().toLowerCase();
        const slug = label.normalize ? label.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '';
        return 'category-' + (slug || String(index + 1));
    }

    function escapeNavigationText(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function resolveContactEmail(value) {
        const email = String(value == null ? '' : value).trim().toLowerCase();
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : 'contact@your-domain.com';
    }

    function pageEmailLink(email) {
        const safeEmail = escapeNavigationText(email);
        return '<a href="mailto:' + safeEmail + '">' + safeEmail + '</a>';
    }

    function domainEditorialNotice(themeId) {
        const notices = {
            finance: ['Financial information notice', 'Nothing on this site is investment, financial, tax, or legal advice. Markets and business conditions can change quickly; verify material decisions with qualified advisers and primary sources.'],
            health: ['Health information notice', 'The content is for general education only and is not medical advice, diagnosis, or treatment. Seek a qualified health professional for personal medical decisions or urgent symptoms.'],
            legal: ['Legal information notice', 'The content is general legal information, not legal advice. Laws and regulations vary by jurisdiction; consult a qualified legal professional about a specific matter.'],
            realestate: ['Property information notice', 'Property coverage is informational only and is not legal, financial, lending, valuation, or property advice. Availability and local requirements must be checked independently.'],
            food: ['Food and nutrition notice', 'Recipes and food coverage are informational. Readers are responsible for ingredient safety, allergies, storage, and adapting guidance to their own needs.'],
            travel: ['Travel information notice', 'Travel availability, prices, entry rules, and local conditions can change. Confirm bookings and official requirements directly before making plans.'],
            automotive: ['Vehicle information notice', 'Vehicle specifications, pricing, safety information, and availability can change. Confirm important details with official documentation and qualified service professionals.'],
            education: ['Learning information notice', 'Guides and learning resources are editorial material. Course requirements, credentials, and institutional policies should be confirmed with the relevant provider.'],
            pets: ['Pet-care information notice', 'Pet-care content is general information and does not replace advice from a qualified veterinarian, trainer, or animal-care professional.'],
            parenting: ['Parenting information notice', 'Parenting content is general information and does not replace medical, developmental, or professional support for a child or family.'],
            outdoors: ['Outdoor safety notice', 'Outdoor conditions and risks vary by location and season. Readers are responsible for planning safely, following local rules, and using suitable equipment.'],
            energy: ['Industry information notice', 'Energy coverage is editorial information, not engineering, investment, safety, or regulatory advice. Verify operational decisions with qualified professionals and official sources.'],
            politics: ['Public-affairs information notice', 'Political and public-affairs coverage is editorial information. Readers should consult official documents and multiple reliable sources for decisions or civic action.'],
            science: ['Research information notice', 'Research findings can evolve as new evidence becomes available. Summaries are not a substitute for reading the original research or consulting qualified specialists.'],
            ecommerce: ['Product information notice', 'Product descriptions, prices, availability, and retailer terms can change. Check the seller or manufacturer before purchasing.'],
            career: ['Career information notice', 'Career guidance is general information and does not guarantee employment, compensation, or outcomes. Verify opportunities and requirements with the relevant employer or institution.'],
            marketing: ['Marketing information notice', 'Marketing examples and analysis are informational. Results vary by audience, platform, budget, market, and implementation.'],
            home: ['Home-project information notice', 'Home and renovation content is general information. Assess safety, permits, and professional requirements before starting work.']
        };
        return notices[themeId] || ['Editorial information notice', 'This site publishes editorial information for general reference. Verify important facts, requirements, and decisions with primary sources or qualified professionals.'];
    }

    function buildDomainTrustPages(themeId, profile, theme, categories, contactEmail) {
        const safeTitle = escapeNavigationText(theme.siteTitle);
        const safeDomainName = escapeNavigationText((profile && profile.nameEn) || 'General Editorial');
        const categoryNames = (categories || []).map(function(category) {
            return escapeNavigationText(category && category.name);
        }).filter(Boolean).slice(0, 5);
        const coverageList = categoryNames.length ? categoryNames : ['News', 'Guides', 'Features'];
        const coverage = coverageList.join(', ');
        const email = resolveContactEmail(contactEmail);
        const mailLink = pageEmailLink(email);
        const updatedDate = new Date().toISOString().slice(0, 10);
        const notice = domainEditorialNotice(themeId);

        return {
            about: {
                title: 'About ' + safeTitle,
                intro: safeTitle + ' is an editorial publication covering ' + coverage + ' within the wider ' + safeDomainName.toLowerCase() + ' field. We create explainers, reporting, and practical context for readers who want to understand a subject beyond a single headline.',
                coverage: '<p>Our coverage is organized around ' + coverage + '.</p><ul><li>We explain developments, decisions, and terminology in clear language.</li><li>We distinguish reported facts, attributed claims, and editorial analysis whenever the format allows.</li><li>We revisit published pages when a material update, correction, or clarification is warranted.</li></ul>',
                mission: 'Our aim is to make ' + safeDomainName.toLowerCase() + ' information more useful and easier to evaluate. We value clarity, context, and transparent sourcing over unsupported certainty.',
                standards: 'We work to use relevant sources, identify commentary and recommendations, preserve appropriate attribution, and correct substantive errors as soon as reasonably practical. Published material may be edited for accuracy, clarity, or currency after publication.',
                corrections: 'To report an error or missing context, email us with the page URL, the specific statement at issue, and a reliable source or explanation where available. We review good-faith correction requests and update or clarify content when the evidence supports a change.',
                email: email,
                emailLink: mailLink,
                address: 'Editorial desk · online publication'
            },
            contact: {
                title: 'Contact ' + safeTitle,
                desc: 'The editorial desk welcomes corrections, source material, rights enquiries, reader feedback, and questions about our ' + safeDomainName.toLowerCase() + ' coverage.',
                response: 'Email is the official contact route for this site. Messages are read by the site operator or editorial team and are handled as promptly as practical. Please do not send passwords, payment details, government identification, health records, or other sensitive personal information.',
                guidance: 'For a correction, include the page URL, the statement you believe needs attention, and a reliable supporting source where possible. For copyright or image-rights enquiries, identify the work, the relevant URL, and your relationship to the rights holder. For privacy requests, tell us enough to locate the message or information involved without sending sensitive data.',
                email: email,
                emailLink: mailLink,
                address: 'Editorial desk · online publication'
            },
            privacy: {
                title: 'Privacy Policy',
                brief: '<p>Last updated: ' + updatedDate + '</p><p>This policy describes how ' + safeTitle + ' handles information when readers visit this ' + safeDomainName.toLowerCase() + ' publication, including pages covering ' + coverage + '.</p><p>We may process technical information needed to deliver and protect the site, as well as information you choose to send to the editorial desk. Cookies, analytics, advertising, and embedded services may add their own processing; please review the services actually active on this site. For privacy questions or requests, contact ' + mailLink + '.</p>',
                full: '<p>Last updated: ' + updatedDate + '</p><p>This Privacy Policy explains how ' + safeTitle + ' ("we," "us," or "our") handles information when you visit or contact this ' + safeDomainName.toLowerCase() + ' publication. It applies to the site in its published configuration, including the editorial areas covering ' + coverage + '.</p><h2>1. Information we may process</h2><p>When you visit the site, hosting, security, and delivery systems may process technical information such as IP address, browser and device type, requested pages, referring URLs, timestamps, and diagnostic logs. If you email us, we may receive the name, email address, and message content you choose to provide, together with any attachments or information included in that message.</p><h2>2. Why we use information</h2><p>We use information as needed to operate and secure the site, diagnose technical problems, respond to legitimate enquiries, protect our rights and users, comply with applicable obligations, and understand whether pages and site features are functioning as intended. We do not ask visitors to create an account in order to read public editorial pages.</p><h2>3. Cookies, analytics, advertising, and third-party services</h2><p>The site may use cookies or similar technologies where the operator enables them. Analytics providers, advertising partners, embedded media, social features, and other third-party services may collect or receive information under their own terms and privacy policies. Their use can vary by page, region, browser settings, and the site configuration. Where consent, notice, opt-out controls, or regional disclosures are required, the operator should provide them before activating the relevant service.</p><h2>4. Sharing and retention</h2><p>Information may be available to service providers that help host, secure, measure, or operate the site, and may be disclosed where required by law or necessary to protect rights, safety, and the integrity of the service. We retain correspondence and technical records only for as long as reasonably necessary for the purposes described above, to resolve disputes, or to meet applicable legal obligations.</p><h2>5. Your choices and rights</h2><p>You can manage many cookies through your browser or device settings. Depending on your location and applicable law, you may have rights to request access to, correction of, deletion of, restriction of, or objection to certain processing of your personal information. To make a request related to an email or other information you provided, contact ' + mailLink + '. We may need reasonable information to verify the request and protect other people\'s information.</p><h2>6. Children\'s privacy</h2><p>This site is not intended for children where parental consent is required for online data processing. If you believe a child has provided personal information to us, please contact us so that we can review the matter.</p><h2>7. Changes and contact</h2><p>We may revise this policy when the site, its services, or applicable requirements change. The date at the top identifies the latest version. Questions, requests, or concerns about this policy can be sent to ' + mailLink + '.</p>',
                email: email
            },
            terms: {
                title: 'Terms of Service',
                brief: '<p>Last updated: ' + updatedDate + '</p><p>By accessing or using ' + safeTitle + ', you agree to use this ' + safeDomainName.toLowerCase() + ' publication lawfully and without interfering with its operation or other readers\' access.</p><p>' + notice[1] + '</p><p>Questions about these terms can be sent to ' + mailLink + '.</p>',
                full: '<p>Last updated: ' + updatedDate + '</p><p>These Terms of Service govern access to and use of ' + safeTitle + ', including editorial content covering ' + coverage + '. By using the site, you agree to these terms. If you do not agree, please do not use the site.</p><h2>1. Editorial content</h2><p>Articles, guides, references, and other materials are provided for general informational purposes. We work to present useful and accurate information, but content can become incomplete, outdated, or unsuitable for a particular purpose. We may update, correct, remove, or reorganize content as information changes or editorial review requires.</p><h2>2. ' + escapeNavigationText(notice[0]) + '</h2><p>' + escapeNavigationText(notice[1]) + '</p><h2>3. Acceptable use</h2><p>You may access and share public pages for lawful personal or editorial purposes. You must not disrupt or overload the site, bypass security controls, introduce harmful code, impersonate the site or its operator, collect data in a way that harms service availability, or use the site or its content in violation of applicable law or third-party rights.</p><h2>4. Intellectual property</h2><p>Unless otherwise identified, the site\'s original editorial content, design, and branding are protected by applicable intellectual-property laws. You may quote or link to material in a lawful manner with appropriate attribution, but you may not reproduce, republish, distribute, or create derivative works from substantial portions of the site without permission. Third-party names, logos, images, and other materials remain the property of their respective owners.</p><h2>5. External links and services</h2><p>Links to external websites and services are provided for context or convenience. We do not control their content, availability, security, or privacy practices, and a link does not necessarily indicate endorsement. Review the terms and privacy policies of third-party services before using them.</p><h2>6. Disclaimers and liability</h2><p>The site is provided on an "as available" basis without a promise that it will be uninterrupted, error-free, complete, or suitable for every purpose. To the extent permitted by applicable law, the site operator is not liable for indirect, incidental, special, consequential, or punitive losses arising from use of, or reliance on, the site.</p><h2>7. Changes and contact</h2><p>We may revise these terms when the site, its services, or applicable requirements change. Continued use after an update means that you accept the revised terms. Questions can be sent to ' + mailLink + '.</p>',
                email: email
            }
        };
    }

    function categoryNavigationHref(anchorId, pageContext) {
        if (pageContext === 'home') return '#' + anchorId;
        if (pageContext === 'detail') return '../index.html#' + anchorId;
        return 'index.html#' + anchorId;
    }

    // 导航只能链接到本次导出中确实会被分配到内容的分类。分类内容的分配规则
    // 与 generateScriptJs 中 renderCategories 保持一致：按配置顺序消耗数据，
    // 每个分类最多使用其配置数量的文章。
    function getPopulatedNavigationCategories(categories, dataLength) {
        var remaining = Math.max(0, Number(dataLength) || 0);
        var result = [];

        (categories || []).forEach(function(category, index) {
            var requestedCount = Math.max(0, Math.floor(Number(category && category.count) || 0));
            if (!category || !String(category.name || '').trim() || requestedCount < 1 || remaining < 1) return;

            result.push({ category: category, index: index });
            remaining -= Math.min(requestedCount, remaining);
        });

        return result;
    }

    function generateNavbar(config, pageContext) {
        const theme = config.theme;
        const navLinks = ['home'];
        const homeHref = pageContext === 'detail' ? '../index.html' : 'index.html';
        const populatedCategories = Array.isArray(config.structure.populatedNavigationCategories)
            ? config.structure.populatedNavigationCategories
            : getPopulatedNavigationCategories(config.structure.categories, Number.MAX_SAFE_INTEGER);
        // 有四个真实内容分类时显示四个；不足四个时最多显示三个，避免导航链接到空区块。
        const headerCategoryLimit = populatedCategories.length >= 4 ? 4 : Math.min(3, populatedCategories.length);
        const categories = populatedCategories.slice(0, headerCategoryLimit);
        const logoIcon = config.style.logoIcon || '🌐';
        const navbarClass = config.style.navbarStyle === 'glass-sticky' ? 'glass-sticky' :
                           config.style.navbarStyle === 'dark-fixed' ? 'dark-fixed' :
                           config.style.navbarStyle === 'transparent' ? 'transparent' :
                           config.style.navbarStyle === 'side-drawer' ? 'side-drawer' :
                           config.style.navbarStyle === 'bottom-fixed' ? 'bottom-fixed' : '';

        const isSideDrawer = config.style.navbarStyle === 'side-drawer';
        const navigationId = isSideDrawer ? 'site-navigation-drawer' : 'site-navigation';
        const isBoxedLogo = config.style.logoStyle === 'boxed';
        const logoHtml = config.style.logoStyle === 'icon' ?
            `<a href="${homeHref}" class="logo" aria-label="${theme.logoText}"><span class="logo-mark" aria-hidden="true">${logoIcon}</span></a>` :
            config.style.logoStyle === 'text-icon' ?
            `<a href="${homeHref}" class="logo"><span class="logo-mark" aria-hidden="true">${logoIcon}</span><span>${theme.logoText}</span></a>` :
            config.style.logoStyle === 'gradient-text' ?
            `<a href="${homeHref}" class="logo logo-gradient-text">${theme.logoText}</a>` :
            isBoxedLogo ?
            `<a href="${homeHref}" class="logo logo-boxed">${theme.logoText}</a>` :
            `<a href="${homeHref}" class="logo">${theme.logoText}</a>`;

        function buildLinks(categoryItems) {
            let html = '';
            if (navLinks.includes('home')) html += `<li><a href="${homeHref}">Home</a></li>`;
            categoryItems.forEach(function(entry) {
                const anchorId = categoryAnchorId(entry.category, entry.index);
                html += `<li><a href="${categoryNavigationHref(anchorId, pageContext)}">${escapeNavigationText(entry.category.name)}</a></li>`;
            });
            if (config.structure.hasAllArticlesPage) {
                const allHref = pageContext === 'detail' ? '../all-articles.html' : 'all-articles.html';
                html += `<li><a href="${allHref}"${pageContext === 'all' ? ' aria-current="page"' : ''}>All Articles</a></li>`;
            }
            return html;
        }

        const linksHtml = buildLinks(categories);
        // 移动端抽屉与横向导航使用相同的、已验证有内容的入口，避免两处显示不一致。
        const drawerLinksHtml = linksHtml;

        const layoutClass = config.structure.navbarLayout === 'centered' ? 'navbar-centered' :
                            config.structure.navbarLayout === 'left' ? 'navbar-left' : '';

        const primaryLinksHtml = isSideDrawer ? '' : `<ul id="${navigationId}" class="nav-links">
            ${linksHtml}
        </ul>`;

        const navbarClasses = ['navbar', navbarClass, layoutClass, isBoxedLogo ? 'has-boxed-logo' : ''].filter(Boolean).join(' ');
        return `<nav class="${navbarClasses}">
    <div class="container">
        ${logoHtml}
        ${primaryLinksHtml}
        <button class="hamburger" type="button" aria-label="Toggle navigation" aria-controls="${navigationId}" aria-expanded="false">
            <span></span><span></span><span></span>
        </button>
    </div>
</nav>
${config.style.navbarStyle === 'side-drawer' ? `
<div class="drawer-overlay"></div>
<div id="${navigationId}" class="side-drawer-panel">
    <div class="drawer-header">
        <a href="${homeHref}" class="drawer-logo">${config.style.logoStyle === 'icon' || config.style.logoStyle === 'text-icon' ? `<span class="logo-mark" aria-hidden="true">${logoIcon}</span>` : ''}${config.style.logoStyle === 'icon' ? '' : `<span>${theme.logoText}</span>`}</a>
        <button class="drawer-close" aria-label="Close menu">&times;</button>
    </div>
    <ul class="drawer-nav">
        ${drawerLinksHtml}
    </ul>
</div>` : ''}`;
    }

    function generateNavbarInteractionScript() {
        return `(function() {
    var hamburger = document.querySelector('.hamburger');
    var navLinks = document.querySelector('.nav-links');
    var drawerPanel = document.querySelector('.side-drawer-panel');
    var drawerOverlay = document.querySelector('.drawer-overlay');
    var drawerClose = document.querySelector('.drawer-close');

    function setExpanded(expanded) {
        if (hamburger) hamburger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }
    function closeNavigation() {
        if (navLinks) navLinks.classList.remove('active');
        if (drawerPanel) drawerPanel.classList.remove('open');
        if (drawerOverlay) drawerOverlay.classList.remove('active');
        setExpanded(false);
    }
    function openDrawer() {
        if (drawerPanel) drawerPanel.classList.add('open');
        if (drawerOverlay) drawerOverlay.classList.add('active');
        setExpanded(true);
    }

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function() {
            var willOpen = !navLinks.classList.contains('active');
            navLinks.classList.toggle('active', willOpen);
            setExpanded(willOpen);
        });
        var links = navLinks.querySelectorAll('a');
        for (var i = 0; i < links.length; i++) links[i].addEventListener('click', closeNavigation);
    }
    if (drawerPanel) {
        if (hamburger) hamburger.addEventListener('click', openDrawer);
        if (drawerClose) drawerClose.addEventListener('click', closeNavigation);
        if (drawerOverlay) drawerOverlay.addEventListener('click', closeNavigation);
        var drawerLinks = drawerPanel.querySelectorAll('a');
        for (var j = 0; j < drawerLinks.length; j++) drawerLinks[j].addEventListener('click', closeNavigation);
    }
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') closeNavigation();
    });
})();`;
    }

    // ========== 生成页脚HTML ==========
    function generateFooter(config) {
        const theme = config.theme;
        const siteName = theme.siteTitle;
        const footerLinks = config.structure.footerLinks || [];

        if (config.structure.footerStyle === 'simple') {
            const links = [];
            if (footerLinks.includes('privacy')) links.push('<li><a href="privacy.html">Privacy Policy</a></li>');
            if (footerLinks.includes('terms')) links.push('<li><a href="terms.html">Terms of Service</a></li>');
            if (footerLinks.includes('contact')) links.push('<li><a href="contact.html">Contact Us</a></li>');
            if (footerLinks.includes('about')) links.push('<li><a href="about.html">About Us</a></li>');
            return `<footer class="footer">
    <div class="container footer-simple">
        <p class="footer-copy">&copy; 2026 ${siteName}. All rights reserved.</p>
        <ul class="footer-links">${links.join('')}</ul>
    </div>
</footer>`;
        }

        // 详细页脚
        const pages = theme.pages;
        return `<footer class="footer">
    <div class="container">
        <div class="footer-content">
            <div class="footer-section">
                <h3>About ${siteName}</h3>
                <p>${pages.about.intro.substring(0, 120)}...</p>
            </div>
            <div class="footer-section">
                <h3>Quick Links</h3>
                <ul class="footer-links">
                    <li><a href="index.html">Home</a></li>
                    ${footerLinks.includes('about') ? '<li><a href="about.html">About Us</a></li>' : ''}
                    ${footerLinks.includes('contact') ? '<li><a href="contact.html">Contact Us</a></li>' : ''}
                </ul>
            </div>
            <div class="footer-section">
                <h3>Legal</h3>
                <ul class="footer-links">
                    ${footerLinks.includes('privacy') ? '<li><a href="privacy.html">Privacy Policy</a></li>' : ''}
                    ${footerLinks.includes('terms') ? '<li><a href="terms.html">Terms of Service</a></li>' : ''}
                </ul>
            </div>
            <div class="footer-section">
                <h3>Contact Us</h3>
                <p>📧 ${pages.contact.email}</p>
                <p>🌐 ${pages.contact.address}</p>
            </div>
        </div>
        <div class="footer-bottom">
            <p>&copy; 2026 ${siteName}. All rights reserved.</p>
        </div>
    </div>
</footer>`;
    }

    // ========== 生成首页 index.html ==========
    function generateIndexHtml(config, data) {
        const theme = config.theme;
        const siteName = theme.siteTitle;
        const navbar = generateNavbar(config, 'home');
        const footer = generateFooter(config);
        const adPlacements = config.adPlacements || {};
        const adRuntimeVersion = getAdRuntimeVersion(config.adPaths, config.adJsVersion);
        const adScripts = hasAdRuntime(config)
            ? '<script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js" crossorigin="anonymous"><\/script>\n    <script defer src="js/ad.js?v=' + adRuntimeVersion + '"><\/script>'
            : '';

        // 获取首页静态位置广告（容器外部的位置）
        function getHomeAd(position) {
            let code = '';
            for (const [adId, pages] of Object.entries(adPlacements)) {
                if (pages && pages.home === position) {
                    code += AD_TEMPLATES[adId] || '';
                }
            }
            return position === 'after-navbar' && code ? '<div class="ad-region ad-after-navbar ad-nav-' + config.style.navbarStyle + '">' + code + '</div>' : code;
        }

        const heroHtml = config.structure.heroEnabled ? `
    <section class="hero">
        <div class="container">
            <h1 class="hero-title">${config.structure.heroTitle || theme.hero.title}</h1>
            <p class="hero-subtitle">${config.structure.heroSubtitle || theme.hero.subtitle}</p>
        </div>
    </section>` : '';

        // 分类容器：广告容器静态写入，卡片grid由JS动态填充
        const categories = config.structure.categories;
        let categoriesHtml = '';
        // 内容区顶部广告
        categoriesHtml += '\n' + getHomeAd('content-top');
        categories.forEach((cat, i) => {
            categoriesHtml += `
        <section id="${categoryAnchorId(cat, i)}" class="category-section">
            <h2 class="category-title">${cat.icon} ${cat.name}</h2>
            ${getHomeAd('cat-' + i + '-after-title')}
            <div class="items-grid" data-category="cat-${i}"></div>
            ${getHomeAd('cat-' + i + '-after-last')}
        </section>`;
            // 分类区块之间广告
            if (i < categories.length - 1) {
                categoriesHtml += '\n' + getHomeAd('after-section-' + i);
            }
        });
        const homeCapacity = categories.reduce(function(total, category) { return total + Math.max(0, Number(category.count) || 0); }, 0);
        if (config.structure.hasAllArticlesPage && data.length > homeCapacity) {
            categoriesHtml += '\n<div class="view-all-articles"><a class="action-btn" href="all-articles.html">View All ' + data.length + ' Articles</a></div>';
        }
        // 内容区底部广告
        categoriesHtml += '\n' + getHomeAd('content-bottom');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${siteName}</title>
    <meta name="description" content="${theme.siteSubtitle}">
    <script defer src="js/script.js"></script>
    ${adScripts}
    ${renderExportStyles(config, 'css/style.css')}
</head>
<body>
    ${navbar}
    ${getHomeAd('after-navbar')}
    ${heroHtml}
    ${getHomeAd('after-hero')}
    <main class="main-content layout-${config.structure.homeLayout || 'standard'}">
        <div class="container">
            ${categoriesHtml}
        </div>
    </main>
    ${getHomeAd('footer-top')}
    ${footer}
</body>
</html>`;
    }

    function generateAllArticlesCard(item, index, config, imageSource, preview) {
        const mapping = config.fieldMapping || {};
        const title = escapeNavigationText(item[mapping.title] || 'Untitled');
        const href = preview ? '#detail-item-' + index : 'details/article' + escapeNavigationText(getItemId(item, index)) + '.html';
        const previewAttribute = preview ? ' data-preview-item="' + index + '"' : '';
        const image = imageSource && config.structure.cardFields.includes('image')
            ? '<div class="card-image-frame"><img class="card-image image-cover" src="' + escapeNavigationText(imageSource) + '" alt="' + title + '" loading="lazy"></div>'
            : '';
        let fields = '';
        (config.structure.cardFields || []).forEach(function(field) {
            if (field === 'image') return;
            const value = field === 'title' ? title : item[mapping[field] || field];
            if (value === undefined || value === null || value === '') return;
            if (field === 'title') {
                fields += '<div class="card-title">' + title + '</div>';
                return;
            }
            const className = field === 'excerpt' || field === 'content' ? 'desc' : /^[a-z0-9-]+$/i.test(field) ? field : 'extra';
            const text = escapeNavigationText(value);
            const freeClass = field === 'price' && text.toLowerCase() === 'free' ? ' price-free' : '';
            fields += '<div class="card-' + className + freeClass + '">' + text + '</div>';
        });
        return '<a class="item-card" href="' + href + '"' + previewAttribute + '>' + image + '<div class="card-body">' + fields + '</div></a>';
    }

    function generateAllArticlesHtml(config, data) {
        const siteName = escapeNavigationText(config.theme.siteTitle);
        const adRuntimeVersion = getAdRuntimeVersion(config.adPaths, config.adJsVersion);
        const adScripts = hasAdRuntime(config)
            ? '<script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js" crossorigin="anonymous"><\/script>\n    <script defer src="js/ad.js?v=' + adRuntimeVersion + '"><\/script>'
            : '';
        const cards = data.map(function(item, index) {
            return generateAllArticlesCard(item, index, config, getImageSrc(item, config.fieldMapping.image, config.isLocalImages), false);
        });
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>All Articles | ${siteName}</title>
    <meta name="description" content="Browse all ${data.length} articles on ${siteName}.">
    ${adScripts}
    ${renderExportStyles(config, 'css/style.css')}
</head>
<body>
    ${generateNavbar(config, 'all')}
    ${getAllArticlesDetailAds(config, ['after-navbar'])}
    <main class="main-content layout-standard">
        <div class="container">
            ${getAllArticlesDetailAds(config, ['detail-before-content'])}
            <section id="all-articles" class="category-section">
                <h1 class="category-title">All Articles</h1>
                ${buildAllArticlesCardGrid(config, cards)}
            </section>
        </div>
    </main>
    ${getAllArticlesDetailAds(config, ['detail-after-related', 'footer-top'])}
    ${generateFooter(config)}
    <script>${generateNavbarInteractionScript()}</script>
</body>
</html>`;
    }

    // ========== 生成JS script.js ==========
    function generateScriptJs(config) {
        const theme = config.theme;
        const categories = config.structure.categories;
        const cardFields = config.structure.cardFields;
        const randomSort = config.structure.randomSort;
        const imageField = config.fieldMapping.image || 'image';

        // 分类配置
        const catConfig = categories.map((cat, i) => ({
            name: cat.name,
            key: `cat-${i}`,
            count: cat.count
        }));

        return `(function() {
    // 网站配置
    var CONFIG = {
        dataFile: 'data.json',
        categories: ${JSON.stringify(catConfig)},
        cardFields: ${JSON.stringify(cardFields)},
        randomSort: ${randomSort},
        siteName: '${theme.siteTitle}',
        imageField: '${imageField}',
        hasId: ${config.fieldMapping.id ? 'true' : 'false'}
    };

    // Fisher-Yates洗牌算法
    function shuffleArray(arr) {
        var array = arr.slice();
        for (var i = array.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
        return array;
    }

    // 数据加载
    function loadData(callback) {
        fetch(CONFIG.dataFile)
            .then(function(res) { return res.json(); })
            .then(function(data) {
                if (!Array.isArray(data)) {
                    // 兼容对象包裹格式
                    var keys = Object.keys(data);
                    for (var i = 0; i < keys.length; i++) {
                        if (Array.isArray(data[keys[i]])) {
                            data = data[keys[i]];
                            break;
                        }
                    }
                }
                // 确保每条数据有id或_index
                for (var i = 0; i < data.length; i++) {
                    if (!data[i].id && data[i].id !== 0) {
                        data[i]._index = i + 1;
                    }
                }
                callback(data);
            })
            .catch(function(err) {
                console.error('Failed to load data:', err);
                var main = document.querySelector('.main-content');
                if (main) main.innerHTML = '<p>Failed to load data.</p>';
            });
    }

    // 创建卡片DOM
    function createCard(item, idx) {
        var card = document.createElement('a');
        var itemId = item.id !== undefined && item.id !== null ? item.id : (item._index || idx + 1);
        card.className = 'item-card';
        card.href = 'details/article' + itemId + '.html';

        var html = '';
        // 图片
        if (CONFIG.cardFields.indexOf('image') !== -1 && item[CONFIG.imageField]) {
            html += '<div class="card-image-frame"><img class="card-image image-cover" src="' + item[CONFIG.imageField] + '" alt="' + (item.title || '') + '" loading="lazy"></div>';
        }
        html += '<div class="card-body">';

        // 遍历配置的展示字段
        for (var i = 0; i < CONFIG.cardFields.length; i++) {
            var field = CONFIG.cardFields[i];
            if (field === 'image') continue;
            var val = item[field];
            if (val === undefined || val === null) continue;

            if (field === 'title') {
                html += '<div class="card-title">' + val + '</div>';
            } else if (field === 'excerpt') {
                html += '<p class="card-desc">' + val + '</p>';
            } else if (field === 'price') {
                var isFree = String(val).toLowerCase() === 'free';
                html += '<div class="card-price' + (isFree ? ' price-free' : '') + '">' + val + '</div>';
            } else if (field === 'genres' || field === 'cuisine') {
                html += '<div class="card-' + field + '">' + val + '</div>';
            } else {
                html += '<div class="card-' + field + '">' + val + '</div>';
            }
        }
        html += '</div>';
        card.innerHTML = html;
        return card;
    }

    // 所有模板共用统一封面框，图片始终铺满容器。
    function adaptCardImage(img) {
        if (!img) return;
        var frame = img.parentElement;
        if (!frame || !frame.classList.contains('card-image-frame')) {
            frame = document.createElement('div');
            frame.className = 'card-image-frame';
            img.parentNode.insertBefore(frame, img);
            frame.appendChild(img);
        }
        img.classList.add('image-cover');
    }

    // 渲染分类和卡片
    function renderCategories(data) {
        var usedItems = [];

        for (var c = 0; c < CONFIG.categories.length; c++) {
            var cat = CONFIG.categories[c];
            var grid = document.querySelector('.items-grid[data-category="cat-' + c + '"]');
            if (!grid) continue;

            // 分配卡片到分类
            var available = data.filter(function(d) {
                return usedItems.indexOf(d) === -1;
            });
            if (CONFIG.randomSort) {
                available = shuffleArray(available);
            }
            var count = Math.min(cat.count, available.length);
            grid.classList.remove('item-count-1', 'item-count-2', 'item-count-3', 'item-count-4', 'item-count-5', 'item-count-6', 'item-count-7');
            if (count === 1) grid.classList.add('item-count-1');
            if (count === 2) grid.classList.add('item-count-2');
            if (count === 3) grid.classList.add('item-count-3');
            if (count === 4) grid.classList.add('item-count-4');
            if (count === 5) grid.classList.add('item-count-5');
            if (count === 6) grid.classList.add('item-count-6');
            if (count === 7) grid.classList.add('item-count-7');
            for (var i = 0; i < count; i++) {
                var card = createCard(available[i], i);
                grid.appendChild(card);
                adaptCardImage(card.querySelector('.card-image'));
                usedItems.push(available[i]);
            }
        }
    }

    window.addEventListener('resize', function() {
        var images = document.querySelectorAll('.item-card .card-image');
        for (var i = 0; i < images.length; i++) adaptCardImage(images[i]);
    });

    // 汉堡菜单交互
    function initNavbar() {
        var hamburger = document.querySelector('.hamburger');
        var navLinks = document.querySelector('.nav-links');
        var drawerPanel = document.querySelector('.side-drawer-panel');
        var drawerOverlay = document.querySelector('.drawer-overlay');
        var drawerClose = document.querySelector('.drawer-close');
        function setExpanded(expanded) {
            if (hamburger) hamburger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        }
        function closeNavigation() {
            if (navLinks) navLinks.classList.remove('active');
            if (drawerPanel) drawerPanel.classList.remove('open');
            if (drawerOverlay) drawerOverlay.classList.remove('active');
            setExpanded(false);
        }
        if (hamburger && navLinks) {
            hamburger.addEventListener('click', function() {
                var willOpen = !navLinks.classList.contains('active');
                navLinks.classList.toggle('active', willOpen);
                setExpanded(willOpen);
            });
            var links = navLinks.querySelectorAll('a');
            for (var i = 0; i < links.length; i++) {
                links[i].addEventListener('click', closeNavigation);
            }
        }
        // 侧边抽屉交互
        if (drawerPanel) {
            function openDrawer() {
                drawerPanel.classList.add('open');
                if (drawerOverlay) drawerOverlay.classList.add('active');
                setExpanded(true);
            }
            if (hamburger) hamburger.addEventListener('click', openDrawer);
            if (drawerClose) drawerClose.addEventListener('click', closeNavigation);
            if (drawerOverlay) drawerOverlay.addEventListener('click', closeNavigation);
            var dLinks = drawerPanel.querySelectorAll('a');
            for (var j = 0; j < dLinks.length; j++) {
                dLinks[j].addEventListener('click', closeNavigation);
            }
        }
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') closeNavigation();
        });
    }

    // 初始化
    function init() {
        initNavbar();
        var mainContent = document.querySelector('.main-content');
        if (mainContent) {
            loadData(function(data) {
                if (data && data.length > 0) {
                    renderCategories(data);
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();`;
    }

    function generateBackLinkHtml(href, backLinkStyle) {
        if (backLinkStyle === 'breadcrumb') {
            return `<a href="${href}" class="back-link breadcrumb" aria-label="Back to Home"><span class="breadcrumb-home">Home</span><span class="breadcrumb-separator" aria-hidden="true">/</span><span class="breadcrumb-current">Article</span></a>`;
        }
        if (backLinkStyle === 'icon') {
            return `<a href="${href}" class="back-link icon" aria-label="Back to Home"><span aria-hidden="true">←</span><span class="back-link-label">Back to Home</span></a>`;
        }
        if (backLinkStyle === 'minimal') {
            return `<a href="${href}" class="back-link minimal"><span class="back-link-arrow" aria-hidden="true">←</span><span>Home</span></a>`;
        }
        const variants = ['button', 'underline', 'outline', 'pill', 'glass'];
        const variantClass = variants.includes(backLinkStyle) ? ` ${backLinkStyle}` : '';
        return `<a href="${href}" class="back-link${variantClass}">← Back to Home</a>`;
    }

    // ========== 生成详情页HTML ==========
    function generateDetailHtml(item, index, allItems, config) {
        const theme = config.theme;
        const style = config.style;
        const mapping = config.fieldMapping;
        const itemId = getItemId(item, index);
        const siteName = theme.siteTitle;
        const adRuntimeVersion = getAdRuntimeVersion(config.adPaths, config.adJsVersion);
        const adScripts = hasAdRuntime(config)
            ? '<script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js" crossorigin="anonymous"><\/script>\n    <script defer src="../js/ad.js?v=' + adRuntimeVersion + '"><\/script>'
            : '';

        const navbar = generateNavbar(config, 'detail');

        const footer = generateFooter(config).replace(/href="([^"]*)"/g, function(match, href) {
            return 'href="../' + href + '"';
        });

        // 标题
        const title = item[mapping.title] || 'Untitled';

        // 图片
        let imageSrc = item[mapping.image] || '';
        // 本地图片需要加 ../ 前缀，因为详情页在 details/ 子目录
        if (imageSrc && !imageSrc.startsWith('http') && config.isLocalImages) {
            const filename = imageSrc.split('/').pop().split('\\').pop();
            imageSrc = '../images/' + filename;
        }
        const imgClass = 'detail-hero-image';

        // 内容
        const rawContent = item[mapping.content] || '';
        const renderedContent = config.structure.contentRender === 'markdown' ?
            simpleMarkdownToHtml(rawContent) :
            '<p>' + rawContent.replace(/\n\n/g, '</p><p>') + '</p>';

        // 元信息
        let metaHtml = '';
        const metaFields = Object.keys(mapping).filter(k =>
            k !== 'title' && k !== 'content' && k !== 'image' && k !== 'id' &&
            theme.fields.find(f => f.id === k && f.detailDisplay === 'meta')
        );
        metaFields.forEach(fieldId => {
            const val = item[mapping[fieldId]];
            if (val !== undefined && val !== null) {
                const fieldDef = theme.fields.find(f => f.id === fieldId);
                const label = fieldDef ? fieldDef.label : fieldId;
                const isFreePrice = fieldId === 'price' && String(val).toLowerCase() === 'free';
                metaHtml += `<div class="meta-item">
    <span class="meta-label">${label}</span>
    <span class="meta-value${isFreePrice ? ' price-free' : ''}">${val}</span>
</div>`;
            }
        });

        // 操作按钮
        let actionBtnHtml = '';
        if (config.structure.actionButtonEnabled && config.structure.actionButtonLinkField) {
            const url = item[mapping[config.structure.actionButtonLinkField]];
            if (url) {
                actionBtnHtml = `<a class="action-btn" href="${url}" target="_blank">${config.structure.actionButtonText}</a>`;
            }
        }

        // 相关推荐
        const others = allItems.filter((d, i) => i !== index);
        const shuffled = others.sort(() => Math.random() - 0.5);
        const related = shuffled.slice(0, config.structure.relatedCount);

        let relatedHtml = '';
        related.forEach(relItem => {
            const relIdx = allItems.indexOf(relItem);
            const relId = getItemId(relItem, relIdx);
            const relTitle = relItem[mapping.title] || '';
            let relImage = relItem[mapping.image] || '';
            // 本地图片需要加 ../ 前缀
            if (relImage && !relImage.startsWith('http') && config.isLocalImages) {
                const filename = relImage.split('/').pop().split('\\').pop();
                relImage = '../images/' + filename;
            }
            const relatedFields = config.structure.relatedCardFields;
            let additionalHtml = '';
            relatedFields.forEach(f => {
                if (f === 'image' || f === 'title') return;
                const val = relItem[mapping[f]];
                if (val) additionalHtml += `<div class="related-${f}">${val}</div>`;
            });
            relatedHtml += `<a class="related-card" href="article${relId}.html">
    <img src="${relImage}" alt="${relTitle}" loading="lazy">
    <div class="related-info">
        <div class="related-name">${relTitle}</div>
        ${additionalHtml}
    </div>
</a>`;
        });

        // 关键词
        const keywords = generateKeywords(item, theme.id);

        // 详情页广告代码
        const adPlacements = config.adPlacements || {};
        function getDetailAd(position) {
            let code = '';
            for (const [adId, pages] of Object.entries(adPlacements)) {
                if (pages && pages.detail === position) {
                    code += AD_TEMPLATES[adId] || '';
                }
            }
            return position === 'after-navbar' && code ? '<div class="ad-region ad-after-navbar ad-nav-' + config.style.navbarStyle + '">' + code + '</div>' : code;
        }

        // 正文内容中插入段落间广告
        let contentWithAds = renderedContent;
        if (Object.keys(adPlacements).some(([, pages]) => pages && pages.detail && pages.detail.indexOf('detail-between-p-') === 0)) {
            const paragraphs = renderedContent.split(/(<\/p>)/);
            let pCount = 0;
            let rebuilt = '';
            for (let pi = 0; pi < paragraphs.length; pi++) {
                rebuilt += paragraphs[pi];
                if (paragraphs[pi] === '</p>') {
                    pCount++;
                    if (pi < paragraphs.length - 2) {
                        rebuilt += getDetailAd('detail-between-p-' + pCount);
                    }
                }
            }
            contentWithAds = rebuilt;
        }

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - ${siteName}</title>
    <meta name="keywords" content="${keywords}">
    <meta name="description" content="${(item[mapping.excerpt] || title).substring(0, 160)}">
    ${adScripts}
    ${renderExportStyles(config, '../css/style.css')}
</head>
<body>
    ${navbar}
    ${getDetailAd('after-navbar')}
    <div class="detail-page">
        ${style.detailLayout === 'sidebar' ? '<div class="detail-main">' : ''}
        ${generateBackLinkHtml('../index.html', config.structure.backLinkStyle)}
        <img class="${imgClass}" src="${imageSrc}" alt="${title}">
        <h1 class="detail-title">${title}</h1>
        ${metaHtml ? '<div class="detail-meta">' + metaHtml + '</div>' : ''}
        ${actionBtnHtml}
        ${getDetailAd('detail-before-content')}
        <div class="detail-content">${contentWithAds}</div>
        ${getDetailAd('detail-after-content')}
        ${getDetailAd('detail-before-related')}
        <div class="related-section">
            <h2 class="related-title">You May Also Like</h2>
            <div class="related-grid">${relatedHtml}</div>
        </div>
        ${style.detailLayout === 'sidebar' ? `</div>
        <div class="detail-sidebar">
            <div class="sidebar-box">
                <h4>Details</h4>
                ${metaHtml ? '<div class="detail-meta" style="padding:0;background:transparent;border:none;">' + metaHtml + '</div>' : ''}
            </div>
            <div class="sidebar-box">
                <h4>Related</h4>
                ${relatedHtml}
            </div>
        </div>` : ''}
    </div>
    ${getDetailAd('detail-after-related')}
    ${getDetailAd('footer-top')}
    ${footer}
    <script>
    ${generateNavbarInteractionScript()}
    </script>
</body>
</html>`;
    }

    // ========== 生成页面主体内容（供预览复用） ==========
    function generateContactBody(config) {
        const theme = config.theme;
        const pages = theme.pages.contact;

        return `<div class="page-content">
            <h1>${pages.title}</h1>
            <p>${pages.desc}</p>
            <h2>Editorial contact</h2>
            <p>${pages.response}</p>
            <div style="margin-top:30px;">
                <p>📧 ${pages.emailLink || pageEmailLink(pages.email)}</p>
                <p>📍 ${pages.address}</p>
            </div>
            <h2>What to include</h2>
            <p>${pages.guidance}</p>
            <h2>Before you write</h2>
            <p>Sending an email does not create a confidential, professional, or contractual relationship. Please keep your message focused on the page or issue you want us to review.</p>
        </div>`;
    }

    function generateAboutBody(config) {
        const theme = config.theme;
        const pages = theme.pages.about;
        return `<div class="page-content">
            <h1>${pages.title}</h1>
            <p>${pages.intro}</p>
            <h2>What we cover</h2>
            ${pages.coverage || ''}
            <h2>Our Mission</h2>
            <p>${pages.mission}</p>
            <h2>Editorial approach</h2>
            <p>${pages.standards || ''}</p>
            <h2>Corrections and updates</h2>
            <p>${pages.corrections || ''}</p>
            <h2>Contact</h2>
            <p>📧 ${pages.emailLink || pageEmailLink(pages.email)}</p>
            <p>📍 ${pages.address}</p>
        </div>`;
    }

    function generatePrivacyBody(config) {
        const theme = config.theme;
        const content = config.structure.privacyLength === 'brief' ?
            theme.pages.privacy.brief : theme.pages.privacy.full;
        return `<div class="page-content">
            <h1>${theme.pages.privacy.title}</h1>
            ${content}
        </div>`;
    }

    function generateTermsBody(config) {
        const theme = config.theme;
        const content = config.structure.termsLength === 'brief' ?
            theme.pages.terms.brief : theme.pages.terms.full;
        return `<div class="page-content">
            <h1>${theme.pages.terms.title}</h1>
            ${content}
        </div>`;
    }

    // ========== 生成Contact页面 ==========
    function generateContactHtml(config) {
        const theme = config.theme;
        const navbar = generateNavbar(config);
        const footer = generateFooter(config);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contact Us - ${theme.siteTitle}</title>
    ${renderExportStyles(config, 'css/style.css')}
</head>
<body>
    ${navbar}
    ${generateContactBody(config)}
    ${footer}
    <script>
    ${generateNavbarInteractionScript()}
    </script>
</body>
</html>`;
    }

    // ========== 生成About页面 ==========
    function generateAboutHtml(config) {
        const theme = config.theme;
        const navbar = generateNavbar(config);
        const footer = generateFooter(config);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>About Us - ${theme.siteTitle}</title>
    ${renderExportStyles(config, 'css/style.css')}
</head>
<body>
    ${navbar}
    ${generateAboutBody(config)}
    ${footer}
    <script>
    ${generateNavbarInteractionScript()}
    </script>
</body>
</html>`;
    }

    // ========== 生成Privacy页面 ==========
    function generatePrivacyHtml(config) {
        const theme = config.theme;
        const navbar = generateNavbar(config);
        const footer = generateFooter(config);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy - ${theme.siteTitle}</title>
    ${renderExportStyles(config, 'css/style.css')}
</head>
<body>
    ${navbar}
    ${generatePrivacyBody(config)}
    ${footer}
    <script>
    ${generateNavbarInteractionScript()}
    </script>
</body>
</html>`;
    }

    // ========== 生成Terms页面 ==========
    function generateTermsHtml(config) {
        const theme = config.theme;
        const navbar = generateNavbar(config);
        const footer = generateFooter(config);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terms of Service - ${theme.siteTitle}</title>
    ${renderExportStyles(config, 'css/style.css')}
</head>
<body>
    ${navbar}
    ${generateTermsBody(config)}
    ${footer}
    <script>
    ${generateNavbarInteractionScript()}
    </script>
</body>
</html>`;
    }

    // ========== 生成Python脚本 ==========
    function generatePythonScript(config) {
        const theme = config.theme;
        const mapping = config.fieldMapping;
        const contentRender = config.structure.contentRender;

        return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
详情页生成脚本 - 由批量建站工具自动生成
运行方式: python generate_details.py
"""

import json
import os
import re
import random

# 配置
DATA_FILE = 'data.json'
OUTPUT_DIR = 'details'
THEME_ID = '${theme.id}'
SITE_NAME = '${theme.siteTitle}'
CONTENT_RENDER = '${contentRender}'
IMAGE_FIELD = '${mapping.image || 'image'}'
TITLE_FIELD = '${mapping.title || 'title'}'
CONTENT_FIELD = '${mapping.content || 'content'}'
ACTION_BTN_ENABLED = ${config.structure.actionButtonEnabled ? 'True' : 'False'}
ACTION_BTN_TEXT = '${config.structure.actionButtonText || ''}'
ACTION_BTN_LINK_FIELD = '${config.structure.actionButtonLinkField || ''}'
RELATED_COUNT = ${config.structure.relatedCount || 4}
BACK_LINK_STYLE = '${config.structure.backLinkStyle || 'text'}'

# 字段映射
FIELD_MAPPING = ${JSON.stringify(mapping, null, 4)}

def read_data(file_path):
    """读取JSON数据文件"""
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if not isinstance(data, list):
        for key in data:
            if isinstance(data[key], list):
                data = data[key]
                break
    for i, item in enumerate(data):
        if 'id' not in item:
            item['_index'] = i + 1
    return data

def simple_markdown_to_html(text):
    """简易Markdown转HTML"""
    if not text:
        return ''
    html = text
    html = re.sub(r'^### (.+)$', r'<h3>\\1</h3>', html, flags=re.MULTILINE)
    html = re.sub(r'^## (.+)$', r'<h2>\\1</h2>', html, flags=re.MULTILINE)
    html = re.sub(r'\\*\\*(.+?)\\*\\*', r'<strong>\\1</strong>', html)
    html = re.sub(r'\\*(.+?)\\*', r'<em>\\1</em>', html)
    html = re.sub(r'\\[(.+?)\\]\\((.+?)\\)', r'<a href="\\2" target="_blank">\\1</a>', html)
    html = re.sub(r'^- (.+)$', r'<li>\\1</li>', html, flags=re.MULTILINE)
    html = re.sub(r'^(?!<[huplo]|<li|<ul|<\\/)(.+)$', r'<p>\\1</p>', html, flags=re.MULTILINE)
    return html

def generate_keywords(item):
    """生成SEO关键词"""
    words = []
    if item.get(TITLE_FIELD):
        words.append(item[TITLE_FIELD])
    theme_kw = ${JSON.stringify(Object.keys(DOMAIN_CATALOG).reduce(function(map, domainId) {
        map[domainId] = (DOMAIN_CATALOG[domainId].keywords || []).slice(0, 5).join(', ')
        return map
    }, {}))}
    words.append(theme_kw.get(THEME_ID, ''))
    return ', '.join(w for w in words if w)[:200]

def get_item_id(item):
    """获取数据项ID"""
    return item.get('id', item.get('_index', 0))

def generate_detail_pages(data):
    """批量生成详情页"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for idx, item in enumerate(data):
        item_id = get_item_id(item)
        # 此处应使用与浏览器端生成相同的模板逻辑
        # 为简化，此处仅生成占位文件
        filename = f'article{item_id}.html'
        filepath = os.path.join(OUTPUT_DIR, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(f'<!-- Detail page for item {item_id} -->\\n')
            f.write(f'<!-- Please use browser-side generation for full HTML -->\\n')
        print(f'Generated: {filepath}')
    print(f'\\nTotal: {len(data)} detail pages generated.')

if __name__ == '__main__':
    data = read_data(DATA_FILE)
    print(f'Loaded {len(data)} items from {DATA_FILE}')
    generate_detail_pages(data)
`;
    }

    // ========== 主导出函数 ==========
    async function exportWebsite(appState, onProgress) {
        const config = buildConfig(appState);
        const data = appState.data;
        const isLocalImages = appState.isLocalImages;
        const localImages = appState.localImages || {};

        onProgress(5, '正在生成CSS...');

        const zip = new JSZip();
        const siteFolder = zip.folder('website');

        // CSS：保留独立文件给正常托管；同一份样式也内联至所有页面，作为
        // 忽略 css/ 目录或错误返回 MIME 类型的静态托管环境的可靠兜底。
        const generatedCss = generateCSS(config);
        config.inlineStyleTag = '<style data-generated-site-style>' + generatedCss.replace(/<\/style/gi, '<\\/style') + '</style>';
        siteFolder.folder('css').file('style.css', generatedCss);
        onProgress(15, '正在生成首页...');

        // index.html
        const homeHtml = generateIndexHtml(config, data);
        if (hasValidatedAdConfig(config)) {
            const errors = validateMigratedPage(homeHtml, 'home');
            if (errors.length) throw new Error('广告移植首页校验失败：' + errors.map(function(item) { return item.message; }).join(' '));
        }
        siteFolder.file('index.html', homeHtml);

        if (config.structure.hasAllArticlesPage) {
            const allArticlesHtml = generateAllArticlesHtml(config, data);
            if (hasValidatedAdConfig(config)) {
                const errors = validateMigratedPage(allArticlesHtml, 'all');
                if (errors.length) throw new Error('全部文章页广告校验失败：' + errors.map(function(item) { return item.message; }).join(' '));
            }
            siteFolder.file('all-articles.html', allArticlesHtml);
        }

        onProgress(25, '正在生成script.js...');

        // script.js
        siteFolder.folder('js').file('script.js', generateScriptJs(config));

        // 本生成器负责普通建站、广告移植和批量建站加广告，按广告配置输出所选版本。
        if (hasAdRuntime(config)) {
            siteFolder.folder('js').file('ad.js', generateSelectedAdJs(config.adPaths, config.adJsVersion));
        }

        // data.json - 处理本地图片路径
        let dataForJson = JSON.parse(JSON.stringify(data));
        if (isLocalImages) {
            const imageField = config.fieldMapping.image;
            dataForJson = dataForJson.map(item => {
                if (item[imageField] && !item[imageField].startsWith('http')) {
                    const filename = item[imageField].split('/').pop().split('\\').pop();
                    item[imageField] = 'images/' + filename;
                }
                return item;
            });
        }
        siteFolder.file('data.json', JSON.stringify(dataForJson, null, 2));

        onProgress(35, '正在生成通用页面...');

        // 通用页面
        siteFolder.file('contact.html', generateContactHtml(config));
        if (config.structure.aboutEnabled) {
            siteFolder.file('about.html', generateAboutHtml(config));
        }
        siteFolder.file('privacy.html', generatePrivacyHtml(config));
        siteFolder.file('terms.html', generateTermsHtml(config));

        // 详情页
        const detailsFolder = siteFolder.folder('details');
        const total = data.length;

        for (let i = 0; i < total; i++) {
            const detailHtml = generateDetailHtml(data[i], i, data, config);
            if (hasValidatedAdConfig(config)) {
                const errors = validateMigratedPage(detailHtml, 'detail');
                if (errors.length) throw new Error('广告移植详情页校验失败（第 ' + (i + 1) + ' 页）：' + errors.map(function(item) { return item.message; }).join(' '));
            }
            const itemId = getItemId(data[i], i);
            detailsFolder.file('article' + itemId + '.html', detailHtml);

            if (i % 10 === 0 || i === total - 1) {
                const progress = 35 + Math.round((i + 1) / total * 50);
                onProgress(progress, `正在生成详情页 (${i + 1}/${total})...`);
                // 让UI有时间更新
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        // 本地图片
        if (isLocalImages && Object.keys(localImages).length > 0) {
            onProgress(88, '正在添加图片文件...');
            const imagesFolder = siteFolder.folder('images');
            for (const [path, file] of Object.entries(localImages)) {
                const filename = path.split('/').pop().split('\\').pop();
                imagesFolder.file(filename, file);
            }
        }

        // 带广告运行时的站点必须通过本生成器重新生成详情页，避免简化脚本覆盖广告容器。
        onProgress(92, hasAdRuntime(config) ? '正在写入广告运行时说明...' : '正在生成Python脚本...');
        if (hasValidatedAdConfig(config)) {
            siteFolder.file('AD_MIGRATION_REGENERATION.txt', '广告移植站的详情页必须使用本建站工具重新导出。生成器模板会在所有详情页保留 GPT、../js/ad.js 与 banner1/2/3 容器，并在打包前重新校验数量。请勿使用旧版 generate_details.py 覆盖详情页。\n');
        } else if (hasAdRuntime(config)) {
            siteFolder.file('AD_PLACEHOLDER_SETUP.txt', '本网站已预留广告容器，并生成路径为空的 js/ad.js。拿到运营广告代码后，请填写 adUnitBanner1、adUnitBanner2、adUnitBanner3、adUnitInterstitial、adUnitAnchor 与 gaMeasurementId；不需要重新生成页面。请勿使用旧版 generate_details.py 覆盖详情页。\n');
        } else {
            siteFolder.file('generate_details.py', generatePythonScript(config));
        }

        onProgress(95, '正在打包ZIP...');

        const blob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        }, function(metadata) {
            onProgress(95 + Math.round(metadata.percent / 20), '正在压缩...');
        });

        onProgress(100, '导出完成！');
        return blob;
    }

    // ========== 构建配置对象 ==========
    function buildConfig(appState, options) {
        const baseTheme = THEMES[appState.selectedTheme];
        const profile = typeof DOMAIN_CATALOG !== 'undefined' ? DOMAIN_CATALOG[appState.selectedTheme] : null;
        const selectedCategories = appState.config.categories || baseTheme.categories || [];
        const populatedNavigationCategories = getPopulatedNavigationCategories(selectedCategories, (appState.data || []).length);
        const contactEmail = resolveContactEmail(appState.config.contactEmail);
        const theme = Object.assign({}, baseTheme, {
            siteTitle: appState.config.siteTitle || baseTheme.siteTitle,
            logoText: appState.config.logoText || baseTheme.logoText,
            pages: {}
        });
        // 四个信任页面必须跟随当前领域、分类、品牌和联系邮箱，而不是复用某个默认资讯主题的文案。
        theme.pages = buildDomainTrustPages(appState.selectedTheme, profile, theme, selectedCategories, contactEmail);
        const mapping = appState.fieldMapping;
        const reserveAds = appState.siteBuildMode === 'normal' && appState.normalAdMode === 'reserve';
        const migration = appState.siteBuildMode === 'ad-migration' && appState.legacyAdMigration && appState.legacyAdMigration.valid
            ? appState.legacyAdMigration
            : (appState.siteBuildMode === 'normal' && !reserveAds && appState.adCodeMigration && appState.adCodeMigration.valid
                ? appState.adCodeMigration
                : null);
        // 已验证广告代码及固定预留使用相同布局；手动预留保留用户选择的位置。
        const fixedReserveAds = reserveAds && appState.reservePlacementMode === 'fixed';
        const automaticAdPlacements = (migration || fixedReserveAds) && typeof AdMigration !== 'undefined' ? AdMigration.fixedPlacements() : {};
        if (fixedReserveAds && automaticAdPlacements.adv2 && selectedCategories.length < 2) automaticAdPlacements.adv2.home = 'content-bottom';
        if (fixedReserveAds && automaticAdPlacements.adv3 && selectedCategories.length < 2) automaticAdPlacements.adv3.home = 'footer-top';
        const manualAdPlacements = appState.config.adPlacements || {};
        const exportedAdPlacements = migration || fixedReserveAds ? automaticAdPlacements : (reserveAds ? manualAdPlacements : {});

        return {
            theme: theme,
            templateId: appState.config.templateId || ((DOMAIN_CATALOG[appState.selectedTheme] && DOMAIN_CATALOG[appState.selectedTheme].blueprints[0]) || null),
            fieldMapping: mapping,
            structure: {
                navLinks: ['home'],
                footerLinks: (appState.config.footerLinks || ['privacy', 'terms', 'contact', 'about']).filter(function(link) {
                    return link !== 'about' || appState.config.aboutEnabled !== false;
                }),
                navbarLayout: appState.config.navbarLayout || 'normal',
                footerStyle: appState.config.footerStyle || 'simple',
                backLinkStyle: appState.config.backLinkStyle || 'text',
                heroEnabled: appState.config.heroEnabled || false,
                homeLayout: appState.config.homeLayout || 'standard',
                heroTitle: appState.config.heroTitle || theme.hero.title,
                heroSubtitle: appState.config.heroSubtitle || theme.hero.subtitle,
                categories: selectedCategories,
                populatedNavigationCategories: populatedNavigationCategories,
                hasAllArticlesPage: appState.siteBuildMode === 'normal' && appState.config.allArticlesEnabled !== false && Array.isArray(appState.data) && appState.data.length > 0,
                cardColumns: appState.config.cardColumns || 'auto',
                randomSort: true,
                cardFields: appState.config.cardFields || theme.cardFields,
                metaLayout: appState.config.metaLayout || theme.detail.metaLayout,
                contentRender: appState.config.contentRender || theme.detail.contentRender,
                actionButtonEnabled: appState.config.actionButtonEnabled !== undefined ?
                    appState.config.actionButtonEnabled : theme.detail.actionButton.enabled,
                actionButtonText: appState.config.actionButtonText || theme.detail.actionButton.text,
                actionButtonLinkField: appState.config.actionButtonLinkField || theme.detail.actionButton.linkField,
                relatedCount: appState.config.relatedCount || 4,
                relatedCardFields: appState.config.relatedCardFields || theme.relatedCardFields,
                aboutEnabled: appState.config.aboutEnabled !== undefined ? appState.config.aboutEnabled : true,
                contactFields: appState.config.contactFields || ['name', 'email', 'subject', 'message'],
                privacyLength: appState.config.privacyLength || 'full',
                termsLength: appState.config.termsLength || 'full'
            },
            style: {
                selectedStyle: appState.config.selectedStyle || 'dark',
                navbarStyle: appState.config.navbarStyle || 'glass-sticky',
                navbarHeight: appState.config.navbarHeight || '60px',
                logoStyle: appState.config.logoStyle || 'text',
                logoIcon: appState.config.logoIcon || '🌐',
                cardHover: appState.config.cardHover || 'float',
                cardBorder: appState.config.cardBorder || 'rounded',
                cardRadius: appState.config.cardRadius || '8px',
                cardSpacing: appState.config.cardSpacing || '20px',
                cardExcerptLines: appState.config.cardExcerptLines || '3',
                btnStyle: appState.config.btnStyle || 'gradient',
                btnSize: appState.config.btnSize || 'medium',
                gridGap: appState.config.gridGap || '20px',
                fontStyle: appState.config.fontStyle || 'sans-serif',
                animationEnter: appState.config.animationEnter || 'fadeIn',
                transitionSpeed: appState.config.transitionSpeed || '0.3s',
                metaLayout: appState.config.metaLayout || 'grid',
                metaBg: appState.config.metaBg || 'dark',
                detailImgStyle: appState.config.detailImgStyle || 'fullwidth',
                categoryTitleStyle: appState.config.categoryTitleStyle || 'single',
                categoryTitleAlign: appState.config.categoryTitleAlign || 'left',
                cardImageHeight: appState.config.cardImageHeight || '180px',
                contentMaxWidth: appState.config.contentMaxWidth || '1200px',
                heroStyle: appState.config.heroStyle || 'gradient',
                detailLayout: appState.config.detailLayout || 'single',
                cardViewMode: appState.config.cardViewMode || 'card'
            },
            siteBuildMode: migration ? 'ad-migration' : (reserveAds ? 'ad-placeholder' : 'normal'),
            adMigration: migration,
            adRuntimeEnabled: !!migration || reserveAds,
            adPlacements: exportedAdPlacements,
            adPaths: migration ? migration.config : {},
            adJsVersion: normalizeAdJsVersion(appState.adJsVersion),
            adPlacementMode: appState.adPlacementMode || null,
            isLocalImages: appState.isLocalImages || false
        };
    }

    // ========== 生成预览HTML ==========
    function generatePreviewHtml(appState, pageType, detailIndex) {
        const config = buildConfig(appState, { previewManualAds: true });
        const theme = config.theme;
        const data = appState.data;
        const mapping = appState.fieldMapping;
        const isLocalImages = appState.isLocalImages;
        const adPlacements = config.adPlacements;
        const isPlacingAds = !!config.adPlacementMode;

        // 本地图片路径 → blob URL 映射（供预览使用）
        const localImageUrls = {};
        if (isLocalImages && appState.localImages) {
            for (const [path, blob] of Object.entries(appState.localImages)) {
                const filename = path.split('/').pop().split('\\').pop();
                const blobUrl = URL.createObjectURL(blob);
                localImageUrls[filename] = blobUrl;
                appState._previewBlobUrls.push(blobUrl);
            }
        }

        // 根据映射获取图片URL（本地图片用blob URL替代）
        function getPreviewImageSrc(item) {
            let src = item[mapping.image] || '';
            if (!src || !isLocalImages) return src;
            if (src.startsWith('http') || src.startsWith('blob:')) return src;
            const filename = src.split('/').pop().split('\\').pop();
            return localImageUrls[filename] || src;
        }

        // 仅显示不会破坏布局、且最常用的广告位置，避免细小且难辨认的点击区域。
        function getCommonAdPlacementLabel(position, page) {
            const labels = {
                'after-navbar': '导航栏下方',
                'after-hero': '首屏区下方',
                'content-top': '内容区顶部',
                'content-bottom': '内容区底部',
                'footer-top': '页脚上方',
                'detail-before-content': '正文前',
                'detail-after-content': '正文后',
                'detail-after-related': '相关推荐后'
            };
            if (position === 'after-section-0') return '第一个分类后';
            if (position === 'after-section-1') return '第二个分类后';
            if (/^cat-\d+-after-title$/.test(position)) return '分类标题后';
            if (/^cat-\d+-after-last$/.test(position)) return '分类末尾';
            return labels[position] || '';
        }

        function isAdPlacementOccupied(position, page, placements) {
            return Object.keys(placements || {}).some(function(adId) {
                var pages = placements[adId];
                return pages && pages[page] === position;
            });
        }

        // 广告标记生成器（仅放置模式）
        function genMarker(position, page) {
            const label = getCommonAdPlacementLabel(position, page);
            // 同一页面的同一位置仅保留一个广告。已经放过广告的位置显示实际广告，
            // 不再把它作为其它广告的可选预览位，避免用户误以为可以叠加投放。
            if (!label || isAdPlacementOccupied(position, page, adPlacements)) return '';
            return '<div class="insert-marker" data-position="' + position + '" data-page="' + page + '" title="点击在此放置广告">＋ 常用广告位 · ' + label + '</div>';
        }

        // 获取指定位置的广告代码
        function getAdCodeAt(position, page, placements) {
            let code = '';
            for (const [adId, pages] of Object.entries(placements)) {
                // 新结构: { adv1: { home: 'after-hero', detail: '...' } }
                if (pages && pages[page] === position) {
                    code += AD_TEMPLATES[adId] || '';
                }
            }
            return position === 'after-navbar' && code ? '<div class="ad-region ad-after-navbar ad-nav-' + config.style.navbarStyle + '">' + code + '</div>' : code;
        }

        // 生成CSS
        let css = generateCSS(config);

        // 放置模式下添加标记样式
        if (isPlacingAds) {
            css += `
.insert-marker {
    min-height: 46px; margin: 12px 0; padding: 8px 12px; cursor: pointer;
    transition: border-color 0.2s, background 0.2s, transform 0.2s, box-shadow 0.2s;
    border: 2px dashed var(--color-primary, #4a9eff); border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    color: var(--color-text, #111); font-size: 13px; font-weight: 700; line-height: 1.35;
    text-align: center; background: rgba(74, 158, 255, 0.12);
}
.insert-marker:hover {
    border-style: solid; background: rgba(74, 158, 255, 0.22);
    transform: translateY(-1px); box-shadow: 0 4px 14px rgba(74, 158, 255, 0.2);
}
.insert-marker.active-highlight {
    border-style: solid; background: rgba(74, 158, 255, 0.3);
}`;
        }

        let bodyContent = '';

        if (pageType === 'home') {
            // 首页预览
            bodyContent = generateNavbar(config, 'home');
            if (isPlacingAds) bodyContent += genMarker('after-navbar', pageType);
            bodyContent += getAdCodeAt('after-navbar', pageType, adPlacements);

            if (config.structure.heroEnabled) {
                const heroBgStyle = config.style.heroStyle === 'solid' ? 'var(--color-surface)' :
                    config.style.heroStyle === 'minimal' ? 'transparent' :
                    config.style.heroStyle === 'pattern' ? 'var(--color-bg-secondary)' :
                    theme.hero.bgStyle;
                const heroTitleColor = config.style.heroStyle === 'minimal' ? 'var(--color-primary)' : '#fff';
                const heroSubColor = config.style.heroStyle === 'minimal' ? 'var(--color-text-secondary)' : 'rgba(255,255,255,0.8)';
                bodyContent += `<section class="hero" style="background:${heroBgStyle}">
                    <div class="container">
                        <h1 class="hero-title" style="color:${heroTitleColor}">${config.structure.heroTitle}</h1>
                        <p class="hero-subtitle" style="color:${heroSubColor}">${config.structure.heroSubtitle}</p>
                    </div>
                </section>`;
                if (isPlacingAds) bodyContent += genMarker('after-hero', pageType);
                bodyContent += getAdCodeAt('after-hero', pageType, adPlacements);
            }

            bodyContent += '<main class="main-content layout-' + (config.structure.homeLayout || 'standard') + '"><div class="container">';
            if (isPlacingAds) bodyContent += genMarker('content-top', pageType);
            bodyContent += getAdCodeAt('content-top', pageType, adPlacements);

            // 用前几条数据渲染预览
            const categories = config.structure.categories;
            let itemIndex = 0;
            categories.forEach((cat, ci) => {
                const previewItemCount = Math.min(cat.count, Math.max(0, data.length - itemIndex));
                const itemCountClass = previewItemCount === 1 ? ' item-count-1' :
                    (previewItemCount === 2 ? ' item-count-2' :
                    (previewItemCount === 3 ? ' item-count-3' :
                    (previewItemCount === 4 ? ' item-count-4' :
                    (previewItemCount === 5 ? ' item-count-5' :
                    (previewItemCount === 6 ? ' item-count-6' :
                    (previewItemCount === 7 ? ' item-count-7' : ''))))));
                bodyContent += `<section id="${categoryAnchorId(cat, ci)}" class="category-section">
                    <h2 class="category-title">${cat.icon} ${cat.name}</h2>`;
                if (isPlacingAds) bodyContent += genMarker('cat-' + ci + '-after-title', pageType);
                bodyContent += getAdCodeAt('cat-' + ci + '-after-title', pageType, adPlacements);
                bodyContent += '<div class="items-grid' + itemCountClass + '">';

                for (let i = 0; i < cat.count && itemIndex < data.length; i++, itemIndex++) {
                    const item = data[itemIndex];
                    const title = item[mapping.title] || 'Untitled';
                    const image = getPreviewImageSrc(item);

                    bodyContent += `<a class="item-card" href="#detail-item-${itemIndex}" data-preview-item="${itemIndex}">
                        ${image ? `<div class="card-image-frame"><img class="card-image image-cover" src="${image}" alt="${title}"></div>` : ''}
                        <div class="card-body">
                            <div class="card-title">${title}</div>`;

                    // 其他字段
                    config.structure.cardFields.forEach(field => {
                        if (field === 'image' || field === 'title') return;
                        const val = item[mapping[field]];
                        if (val !== undefined && val !== null) {
                            const isFreePrice = field === 'price' && String(val).toLowerCase() === 'free';
                            const fieldClass = field === 'excerpt' ? 'desc' : field;
                            bodyContent += `<div class="card-${fieldClass}${isFreePrice ? ' price-free' : ''}">${val}</div>`;
                        }
                    });

                    bodyContent += '</div></a>';

                    // 卡片之间的标记和广告
                    if (i < cat.count - 1 && itemIndex + 1 < data.length) {
                        if (isPlacingAds) bodyContent += genMarker('cat-' + ci + '-between-' + i + '-' + (i + 1), pageType);
                        bodyContent += getAdCodeAt('cat-' + ci + '-between-' + i + '-' + (i + 1), pageType, adPlacements);
                    }
                }

                bodyContent += '</div>';
                if (isPlacingAds) bodyContent += genMarker('cat-' + ci + '-after-last', pageType);
                bodyContent += getAdCodeAt('cat-' + ci + '-after-last', pageType, adPlacements);
                bodyContent += '</section>';

                // 分类区块之间
                if (ci < categories.length - 1) {
                    if (isPlacingAds) bodyContent += genMarker('after-section-' + ci, pageType);
                    bodyContent += getAdCodeAt('after-section-' + ci, pageType, adPlacements);
                }
            });

            if (isPlacingAds) bodyContent += genMarker('content-bottom', pageType);
            bodyContent += getAdCodeAt('content-bottom', pageType, adPlacements);
            if (config.structure.hasAllArticlesPage && data.length > itemIndex) {
                bodyContent += '<div class="view-all-articles"><a class="action-btn" href="all-articles.html" data-preview-page="all">View All ' + data.length + ' Articles</a></div>';
            }
            bodyContent += '</div></main>';
            if (isPlacingAds) bodyContent += genMarker('footer-top', pageType);
            bodyContent += getAdCodeAt('footer-top', pageType, adPlacements);
            bodyContent += generateFooter(config);

        } else if (pageType === 'all' && config.structure.hasAllArticlesPage) {
            bodyContent = generateNavbar(config, 'all');
            bodyContent += getAllArticlesDetailAds(config, ['after-navbar']);
            bodyContent += '<main class="main-content layout-standard"><div class="container">';
            bodyContent += getAllArticlesDetailAds(config, ['detail-before-content']);
            bodyContent += '<section id="all-articles" class="category-section"><h1 class="category-title">All Articles</h1>';
            bodyContent += buildAllArticlesCardGrid(config, data.map(function(item, index) {
                return generateAllArticlesCard(item, index, config, getPreviewImageSrc(item), true);
            }));
            bodyContent += '</section>';
            bodyContent += '</div></main>';
            bodyContent += getAllArticlesDetailAds(config, ['detail-after-related', 'footer-top']);
            bodyContent += generateFooter(config);

        } else if (pageType === 'detail') {
            // 详情页预览
            if (data.length === 0) return '<html><body><p>No data to preview</p></body></html>';

            const selectedIndex = Number.isInteger(detailIndex) && detailIndex >= 0 && detailIndex < data.length ? detailIndex : 0;
            const item = data[selectedIndex];
            const title = item[mapping.title] || 'Untitled';
            const image = getPreviewImageSrc(item);
            const rawContent = item[mapping.content] || '';
            const renderedContent = config.structure.contentRender === 'markdown' ?
                simpleMarkdownToHtml(rawContent) :
                '<p>' + rawContent.replace(/\n\n/g, '</p><p>') + '</p>';

            bodyContent = generateNavbar(config, 'detail');
            if (isPlacingAds) bodyContent += genMarker('after-navbar', pageType);
            bodyContent += getAdCodeAt('after-navbar', pageType, adPlacements);
            bodyContent += `<div class="detail-page">
                ${config.style.detailLayout === 'sidebar' ? '<div class="detail-main">' : ''}
                ${generateBackLinkHtml('#', config.structure.backLinkStyle)}
                ${image ? `<img class="detail-hero-image" src="${image}" alt="${title}">` : ''}
                <h1 class="detail-title">${title}</h1>`;

            // 元信息
            const metaFields = Object.keys(mapping).filter(k =>
                k !== 'title' && k !== 'content' && k !== 'image' && k !== 'id' &&
                theme.fields.find(f => f.id === k && f.detailDisplay === 'meta')
            );
            if (metaFields.length > 0) {
                bodyContent += '<div class="detail-meta">';
                metaFields.forEach(fieldId => {
                    const val = item[mapping[fieldId]];
                    if (val !== undefined && val !== null) {
                        const fieldDef = theme.fields.find(f => f.id === fieldId);
                        const label = fieldDef ? fieldDef.label : fieldId;
                        const isFreePrice = fieldId === 'price' && String(val).toLowerCase() === 'free';
                        bodyContent += `<div class="meta-item">
                            <span class="meta-label">${label}</span>
                            <span class="meta-value${isFreePrice ? ' price-free' : ''}">${val}</span>
                        </div>`;
                    }
                });
                bodyContent += '</div>';
            }

            // 操作按钮
            if (config.structure.actionButtonEnabled) {
                bodyContent += `<a class="action-btn" href="#">${config.structure.actionButtonText}</a>`;
            }

            if (isPlacingAds) bodyContent += genMarker('detail-before-content', pageType);
            bodyContent += getAdCodeAt('detail-before-content', pageType, adPlacements);

            // 正文内容 - 在段落之间插入标记
            const paragraphs = renderedContent.split(/(<\/p>)/);
            let pCount = 0;
            for (let pi = 0; pi < paragraphs.length; pi++) {
                bodyContent += paragraphs[pi];
                if (paragraphs[pi] === '</p>') {
                    pCount++;
                    // 在段落之间插入标记（跳过最后一对）
                    if (pi < paragraphs.length - 2) {
                        if (isPlacingAds) bodyContent += genMarker('detail-between-p-' + pCount, pageType);
                        bodyContent += getAdCodeAt('detail-between-p-' + pCount, pageType, adPlacements);
                    }
                }
            }

            if (isPlacingAds) bodyContent += genMarker('detail-after-content', pageType);
            bodyContent += getAdCodeAt('detail-after-content', pageType, adPlacements);

            if (isPlacingAds) bodyContent += genMarker('detail-before-related', pageType);
            bodyContent += getAdCodeAt('detail-before-related', pageType, adPlacements);

            bodyContent += `<div class="related-section">
                    <h2 class="related-title">You May Also Like</h2>
                    <div class="related-grid">`;

            // 相关推荐
            for (let i = 1; i <= Math.min(4, data.length - 1); i++) {
                const relItem = data[i];
                if (!relItem) continue;
                const relTitle = relItem[mapping.title] || '';
                const relImage = getPreviewImageSrc(relItem);
                bodyContent += `<a class="related-card" href="#">
                    ${relImage ? `<img src="${relImage}" alt="${relTitle}">` : ''}
                    <div class="related-info">
                        <div class="related-name">${relTitle}</div>
                    </div>
                </a>`;
            }

            bodyContent += '</div></div>';
            if (config.style.detailLayout === 'sidebar') {
                bodyContent += '</div>'; // close detail-main
                bodyContent += `<div class="detail-sidebar">
                    <div class="sidebar-box"><h4>Related</h4>
                    ${(() => {
                        let sidebarHtml = '';
                        for (let i = 1; i <= Math.min(4, data.length - 1); i++) {
                            const relItem = data[i];
                            if (!relItem) continue;
                            const relTitle = relItem[mapping.title] || '';
                            sidebarHtml += `<div style="margin-bottom:8px;font-size:13px;">${relTitle}</div>`;
                        }
                        return sidebarHtml;
                    })()}
                    </div>
                </div>`;
            }
            bodyContent += '</div>'; // close detail-page
            if (isPlacingAds) bodyContent += genMarker('detail-after-related', pageType);
            bodyContent += getAdCodeAt('detail-after-related', pageType, adPlacements);
            if (isPlacingAds) bodyContent += genMarker('footer-top', pageType);
            bodyContent += getAdCodeAt('footer-top', pageType, adPlacements);
            bodyContent += generateFooter(config);

        } else if (pageType === 'contact') {
            bodyContent = generateNavbar(config);
            bodyContent += generateContactBody(config);
            bodyContent += generateFooter(config);
        } else if (pageType === 'about') {
            bodyContent = generateNavbar(config);
            bodyContent += generateAboutBody(config);
            bodyContent += generateFooter(config);
        } else if (pageType === 'privacy') {
            bodyContent = generateNavbar(config);
            bodyContent += generatePrivacyBody(config);
            bodyContent += generateFooter(config);
        } else if (pageType === 'terms') {
            bodyContent = generateNavbar(config);
            bodyContent += generateTermsBody(config);
            bodyContent += generateFooter(config);
        }

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview</title>
    <script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js" crossorigin="anonymous"></script>
    ${_googleFontLink}
    <style>${css}</style>
</head>
<body>${bodyContent}
<script>
(function() {
    function adaptCardImage(img) {
        if (!img) return;
        var frame = img.parentElement;
        if (!frame || !frame.classList.contains('card-image-frame')) {
            frame = document.createElement('div');
            frame.className = 'card-image-frame';
            img.parentNode.insertBefore(frame, img);
            frame.appendChild(img);
        }
        img.classList.add('image-cover');
    }
    document.querySelectorAll('.item-card .card-image').forEach(adaptCardImage);
    window.addEventListener('resize', function() {
        document.querySelectorAll('.item-card .card-image').forEach(adaptCardImage);
    });

    ${generateNavbarInteractionScript()}
    // 拦截导航链接点击，通知父窗口切换预览页面
    document.addEventListener('click', function(e) {
        // 广告标记点击
        var marker = e.target.closest('.insert-marker');
        if (marker) {
            e.preventDefault();
            e.stopPropagation();
            window.parent.postMessage({ type: 'ad-place', position: marker.dataset.position, page: marker.dataset.page }, '*');
            return;
        }
        var target = e.target.closest('a');
        if (target && target.href) {
            e.preventDefault();
            var href = target.getAttribute('href') || '';
            var categoryMatch = href.match(/^#(category-[a-z0-9-]+)$/i);
            if (categoryMatch) {
                var categorySection = document.getElementById(categoryMatch[1]);
                if (categorySection) categorySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }
            var page = 'home';
            var itemIndex = target.getAttribute('data-preview-item');
            if (href.indexOf('contact') !== -1) page = 'contact';
            else if (href.indexOf('about') !== -1) page = 'about';
            else if (href.indexOf('privacy') !== -1) page = 'privacy';
            else if (href.indexOf('terms') !== -1) page = 'terms';
            else if (target.getAttribute('data-preview-page') === 'all' || href.indexOf('all-articles') !== -1) page = 'all';
            else if (href.indexOf('details') !== -1 || href.indexOf('article') !== -1) page = 'detail';
            if (itemIndex !== null) {
                page = 'detail';
                window.parent.postMessage({ type: 'preview-nav', page: page, itemIndex: parseInt(itemIndex, 10) }, '*');
            } else {
                window.parent.postMessage({ type: 'preview-nav', page: page }, '*');
            }
        }
    });
})();
</script>
</body>
</html>`;
    }

    // 公开接口
    return {
        exportWebsite: exportWebsite,
        generatePreviewHtml: generatePreviewHtml,
        buildConfig: buildConfig,
        // 广告恢复保留带策略的运行时；静态新建站流程由 generateNormalAdJs 生成。
        generateAdJs: generateAdJs,
        generateNormalAdJs: generateNormalAdJs,
        generateSelectedAdJs: generateSelectedAdJs,
        getAdTemplate: function(adId) { return AD_TEMPLATES[adId] || ''; }
    };
})();
