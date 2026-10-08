/**
 * 网站生成与导出模块
 * 负责根据配置生成所有网站文件并打包导出
 */

const Generator = (function() {

    // The renderer can also be used without ad integration (for example in
    // domain-only previews); keep that path independent of the migration module.
    const adLayoutTools = typeof AdMigration !== 'undefined' ? AdMigration : {
        matchesPlacement: function(saved, position) { return saved === position; },
        middleGridMarkup: function(markup) { return markup || ''; },
        middleParagraphNumber: function(html) { return Math.max(1, Math.ceil((String(html || '').match(/<\/p>/gi) || []).length / 2)); },
        layoutRuntimeSource: function() { return ''; }
    };


    // 模块级变量：Google Fonts链接（由generateCSS计算，供HTML生成使用）
    var _googleFontLink = '';

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safeUrl(value, allowRelative) {
        const url = String(value == null ? '' : value).trim();
        if (!url) return '';
        if (/^https?:\/\//i.test(url)) return url;
        if (allowRelative && /^blob:/i.test(url)) return url;
        if (allowRelative && /^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,/i.test(url)) return url;
        if (allowRelative && !/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith('//')) return url;
        return '';
    }

    function detailPageUrl(value) {
        const url = safeUrl(value, true);
        if (!url || /^https?:\/\//i.test(url)) return url;
        const normalized = url.replace(/^\.\//, '').replace(/^\/+/, '');
        if (normalized.split('/').includes('..')) return '';
        return '../' + normalized;
    }

    function isPokiPageUrl(value) {
        return /^https?:\/\/(?:www\.)?poki\.com(?:\/|$)/i.test(String(value || '').trim());
    }

    function safeItemId(value, fallback) {
        const normalized = String(value == null ? fallback : value)
            .normalize('NFKC')
            .replace(/[^a-zA-Z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return normalized || String(fallback);
    }

    function serializeForScript(value) {
        return JSON.stringify(value)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026');
    }

    function hasConfiguredAds(config) {
        return !!(config && (config.adRuntimeEnabled || (config.adMigration && config.adMigration.valid)));
    }

    function hasValidatedAdConfig(config) {
        return !!(config && config.adMigration && config.adMigration.valid);
    }

    function validateMigratedPage(html, pageType) {
        return typeof AdMigration !== 'undefined' ? AdMigration.validateGeneratedPage(html, pageType) : [];
    }

    // ========== 简易Markdown转HTML ==========
    function simpleMarkdownToHtml(md) {
        if (!md) return '';
        let html = escapeHtml(md);
        // h3
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        // h2
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        // 粗体
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // 斜体
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        // 链接
        html = html.replace(/\[(.+?)\]\((.+?)\)/g, function(_, label, url) {
            const href = safeUrl(url.replace(/&amp;/g, '&'), false);
            return href ? '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>' : label;
        });
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
        // 主题关键词
        const themeKeywords = {
            tech: 'technology, AI, software, cybersecurity, innovation',
            game: 'gaming, games, review, PC, console',
            food: 'recipe, cooking, food, cuisine, kitchen',
            anime: 'anime, manga, series, review, Japanese'
        };
        words.push(themeKeywords[themeId] || '');
        return words.filter(w => w).join(', ').substring(0, 200);
    }

    // ========== 获取数据项ID ==========
    function getItemId(item, index) {
        return safeItemId(item.id, index + 1);
    }

    // ========== 获取数据项图片路径 ==========
    function getImageSrc(item, imageField, isLocalImages) {
        const imgVal = item[imageField];
        if (!imgVal) return '';
        if (isLocalImages && !/^https?:\/\//i.test(imgVal)) {
            // 本地图片：重写路径
            const filename = imgVal.split('/').pop().split('\\').pop();
            return 'images/' + filename;
        }
        return imgVal;
    }

    function getImageFallbackAttr(item) {
        const fallback = safeUrl(item && item.thumbFallback, true);
        return fallback
            ? ` data-fallback-src="${escapeHtml(fallback)}" onerror="this.onerror=null;this.src=this.dataset.fallbackSrc"`
            : '';
    }

    function parseHexColor(value) {
        const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(String(value || '').trim());
        if (!match) return null;
        const hex = match[1].length === 3
            ? match[1].split('').map(function(character) { return character + character; }).join('')
            : match[1];
        return [
            parseInt(hex.slice(0, 2), 16),
            parseInt(hex.slice(2, 4), 16),
            parseInt(hex.slice(4, 6), 16)
        ];
    }

    function relativeLuminance(rgb) {
        const channels = rgb.map(function(channel) {
            const normalized = channel / 255;
            return normalized <= 0.04045
                ? normalized / 12.92
                : Math.pow((normalized + 0.055) / 1.055, 2.4);
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    }

    function contrastRatio(first, second) {
        const firstLuminance = relativeLuminance(first);
        const secondLuminance = relativeLuminance(second);
        return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
    }

    function getButtonTextColor(background) {
        const backgroundRgb = parseHexColor(background);
        if (!backgroundRgb) return '#ffffff';
        const ink = [0, 0, 0];
        const paper = [255, 255, 255];
        return contrastRatio(backgroundRgb, ink) >= contrastRatio(backgroundRgb, paper) ? '#000000' : '#ffffff';
    }

    function getAmbientEffectCss(effect, primaryRgb) {
        const accent = Array.isArray(primaryRgb) ? primaryRgb.join(', ') : '87, 230, 187';
        const layer = `content: '';
    position: fixed;
    inset: -12%;
    z-index: 0;
    pointer-events: none;`;
        const effects = {
            aurora: `body::before {
    ${layer}
    opacity: .82;
    background:
        radial-gradient(ellipse at 14% 8%, rgba(${accent}, .52), transparent 35%),
        radial-gradient(ellipse at 82% 14%, rgba(${accent}, .30), transparent 30%),
        radial-gradient(ellipse at 52% 100%, rgba(${accent}, .38), transparent 38%);
    background-size: 155% 155%, 145% 145%, 170% 170%;
    filter: blur(12px);
    animation: ambient-aurora 12s ease-in-out infinite alternate;
}`,
            stardust: `body::before {
    ${layer}
    opacity: .9;
    background-image:
        radial-gradient(circle at 3px 3px, rgba(${accent}, .95) 1.35px, transparent 2.2px),
        radial-gradient(circle at 2px 2px, rgba(255,255,255,.72) 1px, transparent 1.8px),
        radial-gradient(circle at 4px 4px, rgba(${accent}, .46) 1.7px, transparent 2.8px);
    background-size: 92px 92px, 147px 147px, 219px 219px;
    filter: drop-shadow(0 0 5px rgba(${accent}, .5));
    animation: ambient-stardust 14s linear infinite;
}`,
            'grid-scan': `body::before {
    ${layer}
    opacity: .72;
    background-image:
        linear-gradient(rgba(${accent}, .20) 1px, transparent 1px),
        linear-gradient(90deg, rgba(${accent}, .20) 1px, transparent 1px),
        linear-gradient(115deg, transparent 46%, rgba(${accent}, .22) 50%, transparent 54%);
    background-size: 42px 42px, 42px 42px, 280% 100%;
    animation: ambient-grid-scan 10s linear infinite;
}`,
            prism: `body::before {
    ${layer}
    opacity: .82;
    background:
        radial-gradient(circle at 18% 22%, rgba(${accent}, .52), transparent 28%),
        radial-gradient(circle at 78% 18%, rgba(255,255,255,.24), transparent 21%),
        radial-gradient(circle at 62% 85%, rgba(${accent}, .46), transparent 34%);
    background-size: 145% 145%, 135% 135%, 165% 165%;
    filter: blur(16px);
    animation: ambient-prism 10s ease-in-out infinite alternate;
}`,
            'arcade-pulse': `body::before {
    ${layer}
    opacity: .78;
    background:
        radial-gradient(circle at 18% 20%, rgba(${accent}, .52), transparent 16%),
        radial-gradient(circle at 82% 70%, rgba(${accent}, .34), transparent 22%),
        repeating-radial-gradient(circle at 50% 50%, rgba(${accent}, .10) 0 1px, transparent 2px 26px);
    background-size: 145% 145%, 155% 155%, 100% 100%;
    filter: blur(4px);
    animation: ambient-arcade-pulse 8s ease-in-out infinite alternate;
}`,
            'pixel-drift': `body::before {
    ${layer}
    opacity: .74;
    background-image:
        linear-gradient(90deg, rgba(${accent}, .38) 2px, transparent 2px),
        linear-gradient(rgba(${accent}, .26) 2px, transparent 2px),
        radial-gradient(circle at 3px 3px, rgba(255,255,255,.58) 1px, transparent 1.7px);
    background-size: 56px 56px, 56px 56px, 104px 104px;
    mask-image: linear-gradient(135deg, transparent 2%, #000 20%, #000 80%, transparent 98%);
    animation: ambient-pixel-drift 16s linear infinite;
}`,
            'comet-trails': `body::before {
    ${layer}
    opacity: .68;
    background-image:
        linear-gradient(124deg, transparent 42%, rgba(${accent}, 0) 46%, rgba(${accent}, .70) 49%, rgba(255,255,255,.82) 50%, rgba(${accent}, .42) 51%, transparent 55%),
        linear-gradient(124deg, transparent 18%, rgba(${accent}, 0) 22%, rgba(${accent}, .34) 24%, transparent 27%);
    background-size: 210% 210%, 250% 250%;
    filter: drop-shadow(0 0 8px rgba(${accent}, .34));
    animation: ambient-comet-trails 12s linear infinite;
}`,
            'radar-sweep': `body::before {
    ${layer}
    inset: -32%;
    opacity: .42;
    background: conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 294deg, rgba(${accent}, .05) 310deg, rgba(${accent}, .56) 348deg, transparent 360deg);
    transform-origin: 50% 50%;
    filter: blur(1px);
    animation: ambient-radar-sweep 14s linear infinite;
}`
        };
        return effects[effect] ? `${effects[effect]}
body > * { position: relative; z-index: 1; }
.navbar, .side-drawer-panel, .drawer-overlay { z-index: inherit; }` : '';
    }

    // ========== 广告代码模板 ==========
    const AD_TEMPLATES = {
        adv1: '<div id="adv1" style="text-align:center;padding:10px;display:flex;flex-direction:column;align-items:center;overflow:hidden;margin-top:1px;"><div style="text-align:center;color:var(--color-text,#111);font-size:13px;">advertisement</div><div id="div-gpt-ad-banner1" style="min-width:300px;min-height:250px;"></div></div>',
        adv2: '<div id="adv2" style="text-align:center;padding:10px;display:flex;flex-direction:column;align-items:center;overflow:hidden;margin-top:1px;"><div style="text-align:center;color:var(--color-text,#111);font-size:13px;">advertisement</div><div id="div-gpt-ad-banner2" style="min-width:300px;min-height:250px;"></div></div>',
        adv3: '<div id="adv3" style="text-align:center;padding:10px;display:flex;flex-direction:column;align-items:center;overflow:hidden;margin-top:1px;"><div style="text-align:center;color:var(--color-text,#111);font-size:13px;">advertisement</div><div id="div-gpt-ad-banner3" style="min-width:300px;min-height:250px;"></div></div>'
    };

    // "全部游戏"没有文章段落或相关推荐，但使用与详情页相同的广告配置。
    function getAllGamesDetailAds(adPlacements, positions) {
        let code = '';
        for (const [adId, pages] of Object.entries(adPlacements || {})) {
            const position = pages && pages.detail;
            if (position && (positions.includes(position) || (positions.includes('detail-between-p-*') && /^detail-between-p-\d+$/.test(position)))) {
                code += AD_TEMPLATES[adId] || '';
            }
        }
        return code;
    }

    function getAllGamesMiddleRowEnd(cardCount, columns) {
        const fullRowsBeforeEnd = Math.floor((cardCount - 1) / columns);
        if (fullRowsBeforeEnd < 1) return cardCount;
        return Math.max(1, Math.min(fullRowsBeforeEnd, Math.round(cardCount / (2 * columns)))) * columns;
    }

    function buildAllGamesCardGrid(adPlacements, cards) {
        const middleAds = getAllGamesDetailAds(adPlacements, ['detail-middle', 'detail-between-p-*', 'detail-after-content', 'detail-before-related']);
        if (!middleAds) return '<div class="items-grid">' + cards.join('') + '</div>';
        const columns = Math.max(1, parseInt(3, 10) || 2);
        const gap = Math.min(cards.length - 1, Math.max(1, Math.ceil(cards.length / 2 / columns) * columns));
        return '<div class="items-grid">' + cards.slice(0, gap).join('') + adLayoutTools.middleGridMarkup(middleAds) + cards.slice(gap).join('') + '</div>';
    }

    const AD_RUNTIME_CACHE_VERSION = '20260928-ad-runtime-v1021';
    const BUILT_IN_AD_JS_VERSIONS = ['initial', 'v1.0.0', 'v1.0.1', 'v1.0.2', 'v1.0.2.1'];

    function normalizeAdJsVersion(version) {
        if (BUILT_IN_AD_JS_VERSIONS.indexOf(version) !== -1) return version;
        const catalog = typeof window !== 'undefined' && window.AdTemplateCatalog;
        return catalog && catalog.isKnownVersion(version) ? version : 'v1.0.2.1';
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
    function generateLegacyAdJs(adPaths) {
        var p = adPaths || {};
        return `const bannerPath1 = ${serializeForScript(p.bannerPath1 || '')};
const bannerPath2 = ${serializeForScript(p.bannerPath2 || '')};
const bannerPath3 = ${serializeForScript(p.bannerPath3 || '')};
const bannerPath4 = ${serializeForScript(p.bannerPath4 || '')};
const interstitialPath = ${serializeForScript(p.interstitialPath || '')};
const anchorPath = ${serializeForScript(p.anchorPath || '')};
const analyticsID = ${serializeForScript(p.analyticsID || '')};

var bannerSlot1, bannerSlot2, bannerSlot3, bannerSlot4;
var interstitialSlot, anchorSlot;

var isIndex = (window.location.pathname === '/' || window.location.pathname === '/index.html');

window.googletag = window.googletag || { cmd: [] };

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

    if (isIndex && interstitialPath) {
        interstitialSlot = googletag.defineOutOfPageSlot(
            interstitialPath,
            googletag.enums.OutOfPageFormat.INTERSTITIAL
        );
        if (interstitialSlot) {
            interstitialSlot.addService(googletag.pubads());
            console.log("[Init] Interstitial 已定义");
        }
    }

    if (anchorPath) {
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
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBannerObservers, { once: true });
} else {
    initializeBannerObservers();
}

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

    // 游戏建站与游戏广告移植按版本选择输出；这里保留 v1.0.1 作为兼容底稿。
    function generateAdJs(adPaths) {
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

    // Keep this version configurable per generated site while disabling both
    // native lazy loading and the optional interstitial triggers by default.
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

    // v1.0.2.1 changes only the native lazy-load default. Building on v1.0.2
    // preserves its disabled interstitial triggers and per-site identifiers.
    function generateV1021AdJs(baseSource) {
        const source = generateV102AdJs(baseSource)
            .replace('ad.js v1.0.2', 'ad.js v1.0.2.1')
            .replace('Updated: 2026-09-24', 'Updated: 2026-09-28')
            .replace(
                'const enableLazyLoad = false;              // 关闭广告延迟加载',
                'const enableLazyLoad = true;               // 开启 GPT 原生懒加载'
            );
        if (!/const enableLazyLoad = true;/.test(source)) {
            throw new Error('v1.0.2.1 广告模板生成失败：无法启用 GPT 原生懒加载。');
        }
        return source;
    }

    function generateSelectedAdJs(adPaths, version) {
        const selectedVersion = normalizeAdJsVersion(version);
        const catalog = typeof window !== 'undefined' && window.AdTemplateCatalog;
        // Keep the uploaded runtime intact while substituting its mapped game ad IDs.
        if (catalog && catalog.getTemplate(selectedVersion)) return catalog.render(selectedVersion, adPaths || {});
        if (selectedVersion === 'initial') {
            const source = typeof window !== 'undefined' && window.AD_JS_SOURCE;
            if (!source) throw new Error('初版 ad.js 模板未加载。');
            const paths = adPaths || {};
            return source.replace(/^const (bannerPath[1-4]|interstitialPath|anchorPath|analyticsID) = "";$/gm, function(line, key) {
                return 'const ' + key + ' = ' + serializeForScript(paths[key] || '') + ';';
            });
        }
        const latest = generateAdJs(adPaths);
        if (selectedVersion === 'v1.0.1') return latest;
        if (selectedVersion === 'v1.0.2') return generateV102AdJs(latest);
        if (selectedVersion === 'v1.0.2.1') return generateV1021AdJs(latest);
        const triggerBlock = /\n\s*\/\/ 触发器\n\s*interstitialSlot\.setConfig\(\{[\s\S]*?\n\s*\}\);/;
        if (!triggerBlock.test(latest)) throw new Error('v1.0.0 广告模板生成失败：找不到插页广告触发器。');
        return latest.replace('ad.js v1.0.1', 'ad.js v1.0.0').replace(triggerBlock, '');
    }

    // ========== 生成CSS ==========
    function generateCSS(config) {
        const style = config.style;
        const preset = STYLE_PRESETS.find(s => s.id === style.selectedStyle) || STYLE_PRESETS[0];
        const vars = { ...preset.vars };
        const buttonTextColor = getButtonTextColor(vars['--color-primary']);
        const primaryRgb = parseHexColor(vars['--color-primary']);
        const ambientEffectCss = getAmbientEffectCss(style.ambientEffect, primaryRgb);

        // 覆盖组件级配置
        const radiusMap = { '0': '0', '2px': '2px', '4px': '4px', '8px': '8px', '12px': '12px', '16px': '16px', '24px': '24px' };
        const spacingMap = { '8px': '8px', '12px': '12px', '20px': '20px', '30px': '30px', '40px': '40px' };
        const gapMap = { '5px': '5px', '10px': '10px', '20px': '20px', '30px': '30px', '40px': '40px' };

        const cardRadius = radiusMap[style.cardRadius] || '8px';
        const cardSpacing = spacingMap[style.cardSpacing] || '20px';
        const gridGap = gapMap[style.gridGap] || '20px';
        const fontMap = {
            'sans-serif': '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
            'serif': 'Georgia, "Times New Roman", serif',
            'monospace': '"Courier New", monospace',
            'cursive': '"Comic Sans MS", "Segoe Script", cursive',
            'condensed': '"Arial Narrow", "Helvetica Neue", sans-serif',
            'rounded': '"Nunito", "Varela Round", "Segoe UI", sans-serif',
            'elegant': '"Playfair Display", Georgia, serif',
            'modern': '"Montserrat", "Segoe UI", sans-serif',
            'tech': '"Rajdhani", "Segoe UI", sans-serif',
            'handwrite': '"Caveat", "Comic Sans MS", cursive',
            'retro': '"Press Start 2P", monospace',
            'clean': '"Inter", "Segoe UI", sans-serif',
            'display': '"Oswald", "Arial Narrow", sans-serif',
            'literary': '"Lora", Georgia, serif'
        };
        const googleFontsMap = {
            'elegant': 'Playfair+Display:wght@400;600;700',
            'modern': 'Montserrat:wght@400;500;600;700',
            'tech': 'Rajdhani:wght@400;500;600;700',
            'handwrite': 'Caveat:wght@400;600;700',
            'retro': 'Press+Start+2P',
            'clean': 'Inter:wght@400;500;600;700',
            'display': 'Oswald:wght@400;500;600;700',
            'literary': 'Lora:wght@400;500;600;700',
            'rounded': 'Nunito:wght@400;600;700'
        };
        const fontFamily = fontMap[style.fontStyle] || fontMap['sans-serif'];
        const googleFontLink = googleFontsMap[style.fontStyle]
            ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=${googleFontsMap[style.fontStyle]}&display=swap" rel="stylesheet">`
            : '';
        _googleFontLink = googleFontLink;
        const transitionSpeed = style.transitionSpeed || '0.3s';
        const navbarHeight = style.navbarHeight || '60px';

        return `/* 网站样式 - 由批量建站工具生成 */
:root {
    --color-bg: ${vars['--color-bg']};
    --color-bg-secondary: ${vars['--color-bg-secondary']};
    --color-surface: ${vars['--color-surface']};
    --color-primary: ${vars['--color-primary']};
    --color-btn-text: ${buttonTextColor};
    --color-text: ${vars['--color-text']};
    --color-text-secondary: ${vars['--color-text-secondary']};
    --color-border: ${vars['--color-border']};
    --color-card-bg: ${vars['--color-card-bg']};
    --color-card-hover: ${vars['--color-card-hover'] || vars['--color-bg-secondary']};
    --navbar-bg: ${vars['--navbar-bg'] || vars['--color-nav-bg'] || vars['--color-bg']};
    --color-primary-rgb: ${primaryRgb ? primaryRgb.join(', ') : '87, 230, 187'};
    --card-radius: ${cardRadius};
    --card-spacing: ${cardSpacing};
    --grid-gap: ${gridGap};
    --transition-speed: ${transitionSpeed};
    --navbar-height: ${navbarHeight};
    --card-image-height: ${style.cardImageHeight || '180px'};
    --content-max-width: ${style.contentMaxWidth === 'full' ? '100%' : (style.contentMaxWidth || '1200px')};
    --preview-scrollbar-track: color-mix(in srgb, var(--color-bg) 88%, var(--color-text));
    --preview-scrollbar-thumb: color-mix(in srgb, var(--color-primary) 68%, var(--color-text));
}

* { margin: 0; padding: 0; box-sizing: border-box; }

html {
    scrollbar-width: thin;
    scrollbar-color: var(--preview-scrollbar-thumb) var(--preview-scrollbar-track);
}

html::-webkit-scrollbar,
body::-webkit-scrollbar { width: 10px; height: 10px; }

html::-webkit-scrollbar-track,
body::-webkit-scrollbar-track { background: var(--preview-scrollbar-track); }

html::-webkit-scrollbar-thumb,
body::-webkit-scrollbar-thumb {
    min-height: 44px;
    border: 2px solid var(--preview-scrollbar-track);
    border-radius: 999px;
    background: var(--preview-scrollbar-thumb);
}

html::-webkit-scrollbar-thumb:hover,
body::-webkit-scrollbar-thumb:hover { background: var(--color-primary); }

html::-webkit-scrollbar-corner,
body::-webkit-scrollbar-corner { background: var(--preview-scrollbar-track); }

body {
    font-family: ${fontFamily};
    background: var(--color-bg);
    color: var(--color-text);
    line-height: 1.6;
    min-height: 100vh;
}

${ambientEffectCss}

a { color: var(--color-primary); text-decoration: none; transition: color var(--transition-speed); }
a:hover { opacity: 0.85; }

img { max-width: 100%; height: auto; }

.container { max-width: var(--content-max-width); margin: 0 auto; padding: 0 20px; }

/* 300×250 广告位已有自身预留高度；其后不再叠加首页或详情页的大块通用留白。 */
#adv1 + .main-content,
#adv2 + .main-content,
#adv3 + .main-content { padding-top: 16px; }

#adv1 + .detail-page,
#adv2 + .detail-page,
#adv3 + .detail-page { padding-top: 16px; }

/* 导航栏 */
.navbar {
    position: sticky;
    top: 0;
    left: 0;
    width: 100%;
    background: var(--navbar-bg);
    height: var(--navbar-height);
    z-index: 1000;
}

.navbar .container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 100%;
}

.navbar.navbar-centered .container { position: relative; justify-content: center; }
.navbar.navbar-centered .logo { position: absolute; left: 20px; }
.navbar.navbar-left .container { justify-content: flex-start; gap: 36px; }

.navbar.glass-sticky {
    position: sticky;
    top: 0;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
}

.navbar.dark-fixed {
    /* 名称为兼容旧配置保留；所有页眉统一吸顶，避免固定栏遮住首屏内容。 */
    position: sticky;
    top: 0;
    background: var(--color-bg);
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
}

.navbar.transparent {
    /* 透明是视觉效果，不应让页眉脱离文档流并遮住首屏内容。 */
    position: sticky;
    top: 0;
    background: color-mix(in srgb, var(--navbar-bg) 46%, transparent);
    box-shadow: 0 1px 0 rgba(var(--color-primary-rgb), .12);
    backdrop-filter: blur(12px) saturate(1.08);
    -webkit-backdrop-filter: blur(12px) saturate(1.08);
}

/* 现代导航变体：保留统一 HTML 结构，仅改变层级与链接交互。 */
.navbar.nav-floating-pill {
    position: sticky;
    top: 0;
    height: calc(var(--navbar-height) + 18px);
    padding: 9px clamp(10px, 2vw, 28px) 0;
    background: transparent;
}
.navbar.nav-floating-pill .container {
    max-width: min(var(--content-max-width), 1320px);
    padding-inline: clamp(16px, 2.6vw, 30px);
    border: 1px solid rgba(var(--color-primary-rgb), .24);
    border-radius: 999px;
    background: var(--navbar-bg);
    box-shadow: 0 12px 30px rgba(0,0,0,.18);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
}
.navbar.nav-floating-pill .nav-links a,
.navbar.nav-segmented .nav-links a {
    padding: 8px 11px;
    border-radius: 999px;
}
.navbar.nav-floating-pill .nav-links a:hover,
.navbar.nav-floating-pill .nav-links a.nav-current {
    color: var(--color-btn-text);
    background: var(--color-primary);
}

.navbar.nav-segmented {
    position: sticky;
    top: 0;
    border-bottom: 1px solid var(--color-border);
    background: var(--navbar-bg);
}
.navbar.nav-segmented .nav-links {
    gap: 4px;
    padding: 4px;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: rgba(var(--color-primary-rgb), .06);
}
.navbar.nav-segmented .nav-links a:hover,
.navbar.nav-segmented .nav-links a.nav-current {
    color: var(--color-btn-text);
    background: var(--color-primary);
}

.navbar.nav-underline {
    position: sticky;
    top: 0;
    border-bottom: 1px solid var(--color-border);
    background: var(--navbar-bg);
}
.navbar.nav-underline .nav-links { gap: clamp(14px, 2.1vw, 30px); }
.navbar.nav-underline .nav-links a {
    position: relative;
    padding-block: 10px;
}
.navbar.nav-underline .nav-links a::after {
    content: '';
    position: absolute;
    right: 0;
    bottom: 2px;
    left: 0;
    height: 2px;
    transform: scaleX(0);
    transform-origin: center;
    background: var(--color-primary);
    transition: transform var(--transition-speed);
}
.navbar.nav-underline .nav-links a:hover::after,
.navbar.nav-underline .nav-links a.nav-current::after { transform: scaleX(1); }

.navbar.nav-accent-bar {
    position: sticky;
    top: 0;
    border-top: 3px solid var(--color-primary);
    border-bottom: 1px solid var(--color-border);
    background: var(--navbar-bg);
    box-shadow: 0 8px 22px rgba(0,0,0,.12);
}
.navbar.nav-accent-bar .logo { letter-spacing: -.02em; }
.navbar.nav-accent-bar .nav-links a:hover,
.navbar.nav-accent-bar .nav-links a.nav-current { color: var(--color-primary); }

/* 应用工具栏：紧凑、分隔明确，适合目录型游戏站。 */
.navbar.nav-command-bar {
    position: sticky;
    top: 0;
    height: calc(var(--navbar-height) + 10px);
    padding-top: 5px;
    background: transparent;
}
.navbar.nav-command-bar .container {
    max-width: min(var(--content-max-width), 1320px);
    padding: 0 clamp(12px, 2vw, 24px);
    border-top: 1px solid var(--color-border);
    border-bottom: 1px solid var(--color-border);
    background: var(--navbar-bg);
}
.navbar.nav-command-bar .logo {
    padding-right: clamp(16px, 2vw, 28px);
    font-size: 16px;
    letter-spacing: .06em;
    text-transform: uppercase;
}
.navbar.nav-command-bar .nav-links { gap: 0; height: 100%; border-left: 1px solid var(--color-border); }
.navbar.nav-command-bar .nav-links li { height: 100%; }
.navbar.nav-command-bar .nav-links a {
    display: flex;
    height: 100%;
    align-items: center;
    padding: 0 clamp(9px, 1.2vw, 16px);
    border-right: 1px solid var(--color-border);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .04em;
    text-transform: uppercase;
}
.navbar.nav-command-bar .nav-links a:hover,
.navbar.nav-command-bar .nav-links a.nav-current { color: var(--color-btn-text); background: var(--color-primary); }

/* 杂志分隔：细规则与紧凑大写文字，适合编辑感内容页。 */
.navbar.nav-editorial {
    position: sticky;
    top: 0;
    border-top: 4px solid var(--color-primary);
    border-bottom: 1px solid var(--color-border);
    background: var(--navbar-bg);
}
.navbar.nav-editorial .container { max-width: min(var(--content-max-width), 1320px); }
.navbar.nav-editorial .logo {
    position: relative;
    padding-right: clamp(20px, 3vw, 42px);
    color: var(--color-text);
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 24px;
    letter-spacing: -.04em;
}
.navbar.nav-editorial .logo::after {
    position: absolute;
    top: 50%;
    right: 0;
    width: 1px;
    height: 22px;
    background: var(--color-border);
    content: '';
    transform: translateY(-50%);
}
.navbar.nav-editorial .nav-links { gap: clamp(12px, 1.8vw, 24px); }
.navbar.nav-editorial .nav-links a {
    position: relative;
    padding: 10px 0 8px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .075em;
    text-transform: uppercase;
}
.navbar.nav-editorial .nav-links a::after {
    position: absolute;
    right: 0;
    bottom: 3px;
    left: 0;
    height: 2px;
    background: var(--color-primary);
    content: '';
    opacity: 0;
    transform: translateY(3px);
    transition: opacity var(--transition-speed), transform var(--transition-speed);
}
.navbar.nav-editorial .nav-links a:hover::after,
.navbar.nav-editorial .nav-links a.nav-current::after { opacity: 1; transform: translateY(0); }

/* 品牌分栏：用品牌色切开识别区和内容导航。 */
.navbar.nav-split-brand { position: sticky; top: 0; background: var(--navbar-bg); border-bottom: 1px solid var(--color-border); }
.navbar.nav-split-brand .container { max-width: min(var(--content-max-width), 1320px); padding: 0; }
.navbar.nav-split-brand .logo {
    align-self: stretch;
    display: flex;
    align-items: center;
    padding: 0 clamp(18px, 2.8vw, 34px);
    color: var(--color-btn-text);
    background: var(--color-primary);
    font-size: 18px;
}
.navbar.nav-split-brand .nav-links { height: 100%; gap: 0; margin-left: auto; }
.navbar.nav-split-brand .nav-links li { height: 100%; }
.navbar.nav-split-brand .nav-links a {
    display: flex;
    height: 100%;
    align-items: center;
    padding: 0 clamp(10px, 1.5vw, 19px);
    border-left: 1px solid var(--color-border);
    font-size: 13px;
    font-weight: 650;
}
.navbar.nav-split-brand .nav-links a:hover,
.navbar.nav-split-brand .nav-links a.nav-current { color: var(--color-primary); box-shadow: inset 0 -3px 0 var(--color-primary); }

/* 线框面板：双层边界，保留开阔感而不依赖阴影。 */
.navbar.nav-outline-frame {
    position: sticky;
    top: 0;
    height: calc(var(--navbar-height) + 18px);
    padding: 9px clamp(10px, 2vw, 28px) 0;
    background: transparent;
}
.navbar.nav-outline-frame .container {
    max-width: min(var(--content-max-width), 1320px);
    padding-inline: clamp(16px, 2.6vw, 30px);
    border: 1px solid var(--color-primary);
    outline: 1px solid rgba(var(--color-primary-rgb), .26);
    outline-offset: 4px;
    background: var(--navbar-bg);
}
.navbar.nav-outline-frame .logo { letter-spacing: .02em; }
.navbar.nav-outline-frame .nav-links { gap: 6px; }
.navbar.nav-outline-frame .nav-links a { padding: 7px 10px; border: 1px solid transparent; }
.navbar.nav-outline-frame .nav-links a:hover,
.navbar.nav-outline-frame .nav-links a.nav-current { color: var(--color-primary); border-color: var(--color-primary); }

/* 聚焦高亮：当前入口像产品工作台中的已选工具，其他链接保持低调。 */
.navbar.nav-spotlight {
    position: sticky;
    top: 0;
    border-bottom: 1px solid rgba(var(--color-primary-rgb), .32);
    background: var(--navbar-bg);
    box-shadow: inset 0 -1px 0 rgba(var(--color-primary-rgb), .1), 0 10px 24px rgba(0,0,0,.1);
}
.navbar.nav-spotlight .container { max-width: min(var(--content-max-width), 1320px); }
.navbar.nav-spotlight .logo { font-size: 19px; letter-spacing: -.03em; }
.navbar.nav-spotlight .nav-links { gap: 6px; padding: 5px; border: 1px solid var(--color-border); border-radius: 10px; }
.navbar.nav-spotlight .nav-links a { padding: 7px 10px; border-radius: 7px; color: var(--color-text-secondary); font-size: 13px; }
.navbar.nav-spotlight .nav-links a:hover,
.navbar.nav-spotlight .nav-links a.nav-current {
    color: var(--color-btn-text);
    background: var(--color-primary);
    box-shadow: 0 5px 14px rgba(var(--color-primary-rgb), .3);
}

/* 左侧导轨：品牌、分隔线与导航形成一条有方向感的水平导轨。 */
.navbar.nav-rail { position: sticky; top: 0; border-bottom: 1px solid var(--color-border); background: var(--navbar-bg); }
.navbar.nav-rail .container { max-width: min(var(--content-max-width), 1320px); padding: 0 clamp(14px, 2vw, 26px); }
.navbar.nav-rail .logo {
    align-self: stretch;
    display: flex;
    align-items: center;
    padding-right: clamp(18px, 2.5vw, 34px);
    border-right: 2px solid var(--color-primary);
    font-size: 18px;
}
.navbar.nav-rail .nav-links { height: 100%; gap: 0; margin-left: clamp(14px, 2vw, 28px); }
.navbar.nav-rail .nav-links li { height: 100%; }
.navbar.nav-rail .nav-links a {
    position: relative;
    display: flex;
    height: 100%;
    align-items: center;
    padding: 0 clamp(9px, 1.3vw, 16px);
    font-size: 13px;
}
.navbar.nav-rail .nav-links a::before {
    position: absolute;
    top: 50%;
    left: 0;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--color-border);
    content: '';
    transform: translateY(-50%);
}
.navbar.nav-rail .nav-links a:hover,
.navbar.nav-rail .nav-links a.nav-current { color: var(--color-primary); }
.navbar.nav-rail .nav-links a.nav-current::before { width: 6px; height: 6px; background: var(--color-primary); }

/* 侧边抽屉：导航栏保持顶部，链接在侧边面板中 */
.navbar.side-drawer { position: sticky; top: 0; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.navbar.side-drawer .nav-links { display: none; }
.navbar.side-drawer .hamburger { display: block; }

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

.navbar .logo {
    font-size: 22px;
    font-weight: 700;
    color: var(--color-primary);
}

/* Logo 渐变使用固定的高对比品牌色，不依赖主题正文色。
   许多深色主题的主色与正文色接近，旧写法会退化得像普通单色文字。 */
.navbar .logo.logo-gradient-text {
    display: inline-block;
    color: #7c3aed;
    background-image: linear-gradient(100deg, #22d3ee 0%, #7c3aed 34%, #ec4899 67%, #f59e0b 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
}

.navbar .nav-links {
    display: flex;
    list-style: none;
    min-width: 0;
    align-items: center;
    gap: clamp(10px, 1.8vw, 24px);
    white-space: nowrap;
}

.navbar .nav-links li {
    flex: 0 0 auto;
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

@media (min-width: 769px) and (max-width: 1080px) {
    .navbar .nav-links { gap: 12px; }
    .navbar .nav-links a { font-size: 13px; }
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
    scroll-margin-top: calc(var(--navbar-height) + 16px);
    margin-bottom: 48px;
    ${style.categoryTitleAlign === 'center' ? 'text-align: center;' : ''}
}

.view-all-games {
    margin: 8px 0 48px;
    text-align: center;
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
}

/* 全部游戏页的广告独占一整行；宽屏按三列、窄屏按两列计算中段位置。 */
#all-games .all-games-middle-ads { grid-column: 1 / -1; order: var(--desktop-ad-order); }
@media (max-width: 819px) {
    #all-games .all-games-middle-ads { order: var(--mobile-ad-order); }
}

/* 卡片样式 */
.item-card {
    display: block;
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

.item-card .card-image {
    width: 100%;
    height: var(--card-image-height);
    object-fit: cover;
}

.item-card .card-body {
    padding: var(--card-spacing);
}

.item-card .card-title {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--color-text);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.item-card .card-desc {
    font-size: 13px;
    color: var(--color-text-secondary);
    display: ${style.cardDescLines === '0' ? 'block' : '-webkit-box'};
    ${style.cardDescLines !== '0' ? '-webkit-line-clamp: ' + style.cardDescLines + ';' : ''}
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-bottom: 8px;
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
    grid-template-columns: 1fr !important;
}
.items-grid .item-card {
    display: flex;
    flex-direction: row;
    align-items: stretch;
}
.items-grid .item-card .card-image {
    width: 240px;
    min-width: 240px;
    height: auto;
    min-height: 160px;
}
.items-grid .item-card .card-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
}
@media (max-width: 600px) {
    .items-grid .item-card {
        flex-direction: column;
    }
    .items-grid .item-card .card-image {
        width: 100%;
        min-width: 100%;
        height: var(--card-image-height);
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
@keyframes ambient-aurora {
    from { background-position: 0% 0%, 100% 0%, 50% 100%; }
    to { background-position: 100% 28%, 0% 68%, 34% 0%; }
}
@keyframes ambient-stardust {
    from { background-position: 0 0, 0 0, 0 0; }
    to { background-position: 92px 184px, -147px 147px, 219px -110px; }
}
@keyframes ambient-grid-scan {
    from { background-position: 0 0, 0 0, 0 0; }
    to { background-position: 42px 84px, 42px 84px, -280% 0; }
}
@keyframes ambient-prism {
    from { background-position: 0% 0%, 100% 0%, 50% 100%; }
    to { background-position: 82% 38%, 8% 76%, 0% 14%; }
}
@keyframes ambient-arcade-pulse {
    from { background-position: 0% 0%, 100% 100%, 50% 50%; transform: scale(.98); }
    to { background-position: 100% 58%, 8% 16%, 50% 50%; transform: scale(1.03); }
}
@keyframes ambient-pixel-drift {
    from { background-position: 0 0, 0 0, 0 0; }
    to { background-position: 112px 56px, -56px 112px, 104px 208px; }
}
@keyframes ambient-comet-trails {
    from { background-position: 120% -120%, -70% 160%; }
    to { background-position: -120% 150%, 160% -80%; }
}
@keyframes ambient-radar-sweep {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

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
    display: inline-block;
    margin-bottom: 20px;
    color: var(--color-text-secondary);
    font-size: 14px;
}

.back-link.breadcrumb {
    padding-bottom: 4px;
    border-bottom: 1px solid var(--color-border);
    font-size: 13px;
    letter-spacing: .015em;
}
.back-link.button {
    display: inline-flex;
    min-height: 42px;
    align-items: center;
    padding: 9px 16px;
    border: 1px solid var(--color-primary);
    border-radius: 8px;
    color: var(--color-btn-text);
    background: var(--color-primary);
    box-shadow: 0 5px 13px rgba(var(--color-primary-rgb), .22);
    font-weight: 700;
    transition: transform var(--transition-speed), box-shadow var(--transition-speed), opacity var(--transition-speed);
}
.back-link.button:hover { color: var(--color-btn-text); opacity: 1; transform: translateY(-1px); box-shadow: 0 8px 18px rgba(var(--color-primary-rgb), .3); }
.back-link.minimal { display: inline-flex; align-items: center; gap: 7px; font-weight: 700; color: var(--color-primary); }
.back-link.minimal .back-link-arrow { transition: transform var(--transition-speed); }
.back-link.minimal:hover .back-link-arrow { transform: translateX(-3px); }
.back-link.underline { position: relative; color: var(--color-text); font-weight: 700; }
.back-link.underline::after { content: ''; position: absolute; right: 0; bottom: -5px; left: 0; height: 2px; transform: scaleX(.34); transform-origin: left; background: var(--color-primary); transition: transform var(--transition-speed); }
.back-link.underline:hover::after { transform: scaleX(1); }
.back-link.outline { display: inline-flex; align-items: center; min-height: 40px; padding: 8px 14px; border: 1px solid var(--color-primary); border-radius: 9px; color: var(--color-primary); font-weight: 700; }
.back-link.outline:hover { color: var(--color-btn-text); background: var(--color-primary); }
.back-link.pill { display: inline-flex; align-items: center; min-height: 38px; padding: 8px 16px; border-radius: 999px; color: var(--color-btn-text); background: var(--color-primary); font-weight: 700; box-shadow: 0 5px 13px rgba(var(--color-primary-rgb), .2); }
.back-link.pill:hover { color: var(--color-btn-text); transform: translateY(-1px); }
.back-link.icon {
    display: inline-flex;
    width: 44px;
    height: 44px;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    border-radius: 11px;
    color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    line-height: 0;
}
.back-link.icon .back-link-icon-svg { display: block; width: 21px; height: 21px; flex: 0 0 21px; stroke: currentColor; stroke-width: 2.25; stroke-linecap: round; stroke-linejoin: round; }
.back-link.icon:hover { color: var(--color-btn-text); background: var(--color-primary); }
.back-link.glass { display: inline-flex; align-items: center; min-height: 38px; padding: 8px 14px; border: 1px solid rgba(255,255,255,.34); border-radius: 999px; color: var(--color-text); background: rgba(255,255,255,.12); backdrop-filter: blur(10px); font-weight: 700; }
.back-link.glass:hover { border-color: var(--color-primary); color: var(--color-primary); }

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
    font-weight: 700;
    letter-spacing: 0.01em;
    text-decoration: none;
    transition: background-color var(--transition-speed), color var(--transition-speed), border-color var(--transition-speed), transform var(--transition-speed);
    cursor: pointer;
    border-radius: ${style.btnStyle === 'square' ? '2px' : style.btnStyle === 'pill' ? '999px' : '6px'};
    ${style.btnStyle === 'outline' ? 'background: transparent; color: var(--color-primary); border: 1px solid var(--color-primary);' :
      style.btnStyle === 'soft' ? 'background: rgba(var(--color-primary-rgb), 0.12); color: var(--color-primary); border: 1px solid rgba(var(--color-primary-rgb), 0.32);' :
      style.btnStyle === 'text' ? 'padding-left: 0; padding-right: 0; background: transparent; color: var(--color-primary); border: none; border-radius: 0; border-bottom: 1px solid currentColor;' :
      'background: var(--color-primary); color: var(--color-btn-text); border: 1px solid var(--color-primary);'}
}

.action-btn:hover {
    ${style.btnStyle === 'outline' ? 'background: var(--color-primary); color: var(--color-btn-text);' :
      style.btnStyle === 'soft' ? 'background: rgba(var(--color-primary-rgb), 0.2); border-color: var(--color-primary);' :
      style.btnStyle === 'text' ? 'opacity: 0.78; transform: none;' :
      'opacity: 0.9; transform: translateY(-1px);'}
}

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
    padding: 28px 0 16px;
    margin-top: 44px;
}

.footer-content {
    display: grid;
    grid-template-columns: minmax(220px, 1.45fr) repeat(3, minmax(120px, .72fr));
    gap: 22px;
    margin-bottom: 18px;
}

.footer-section h3 {
    font-size: 14px;
    margin-bottom: 8px;
    color: var(--color-primary);
}

.footer-section p {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin-bottom: 5px;
    line-height: 1.55;
}

.footer-links {
    list-style: none;
}

.footer-links a {
    display: block;
    font-size: 13px;
    color: var(--color-text-secondary);
    padding: 3px 0;
}

.footer-links a:hover {
    color: var(--color-primary);
}

.footer-bottom {
    text-align: center;
    padding-top: 14px;
    border-top: 1px solid var(--color-border);
    font-size: 13px;
    color: var(--color-text-secondary);
}

.footer-simple-content {
    text-align: center;
    padding: 24px 0;
}

.footer-simple-content .footer-copy {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin-bottom: 12px;
}

.footer-simple-content .footer-links {
    display: flex;
    justify-content: center;
    gap: 24px;
    list-style: none;
}

/* 页脚导航变体：均为普通文档流页脚，不使用底部固定。 */
.footer-compact { padding: 0; border-top: 1px solid var(--color-border); }
.footer-compact .footer-compact-content {
    min-height: 76px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
}
.footer-compact .footer-copy { color: var(--color-text-secondary); font-size: 13px; }
.footer-compact .footer-links,
.footer-ribbon .footer-links {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px 16px;
}
.footer-compact .footer-links a { padding: 6px 0; }

.footer-ribbon { padding: 16px 0; border-top: 1px solid var(--color-border); }
.footer-ribbon .footer-ribbon-content {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 20px;
    align-items: center;
    padding: 14px 18px;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background: rgba(var(--color-primary-rgb), .055);
}
.footer-ribbon .footer-copy { color: var(--color-text-secondary); font-size: 13px; }
.footer-ribbon .footer-links a {
    padding: 6px 10px;
    border: 1px solid transparent;
    border-radius: 999px;
}
.footer-ribbon .footer-links a:hover { border-color: rgba(var(--color-primary-rgb), .38); background: rgba(var(--color-primary-rgb), .10); }

.footer-brand-grid { padding-block: 46px 22px; border-top: 1px solid var(--color-border); }
.footer-brand-grid .footer-brand-grid-content {
    display: grid;
    grid-template-columns: minmax(220px, 1.6fr) repeat(2, minmax(130px, .7fr));
    gap: clamp(24px, 5vw, 72px);
    padding-bottom: 30px;
}
.footer-brand-grid .footer-brand {
    color: var(--color-primary);
    font-size: 22px;
    font-weight: 750;
    letter-spacing: -.03em;
}
.footer-brand-grid .footer-brand p { max-width: 38ch; margin-top: 10px; color: var(--color-text-secondary); font-size: 13px; font-weight: 400; letter-spacing: normal; }
.footer-brand-grid .footer-nav-title { margin-bottom: 10px; color: var(--color-text); font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.footer-brand-grid .footer-links a { padding-block: 5px; }
.footer-brand-grid .footer-bottom { text-align: left; }

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
    .navbar {
        position: sticky;
        top: 0;
    }

    .navbar .nav-links {
        /* 以页眉容器的下边缘为锚点，菜单紧贴导航栏展开，不留悬空间隔。 */
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
        z-index: 1001;
    }

    .navbar .nav-links.active {
        display: flex;
    }

    /* 所有桌面页眉变体在手机上共用纵向菜单。
       工具栏、品牌分栏和导轨样式的 height:100% 只适用于桌面横排，
       若保留在 fixed 的手机菜单中会把链接拉成整屏的窄长列。 */
    .navbar .nav-links {
        align-items: stretch;
        max-height: calc(100vh - var(--navbar-height));
        overflow-y: auto;
    }
    .navbar .nav-links,
    .navbar .nav-links li,
    .navbar .nav-links a {
        height: auto !important;
    }
    .navbar .nav-links li {
        width: 100%;
        flex: 0 0 auto;
    }
    .navbar .nav-links a {
        display: flex;
        width: 100%;
        min-height: 44px;
        align-items: center;
        justify-content: flex-start;
        padding: 10px 12px;
        border-right: 0 !important;
        border-bottom: 1px solid var(--color-border);
    }
    .navbar .nav-links li:last-child a { border-bottom: 0; }
    .navbar.nav-command-bar .nav-links,
    .navbar.nav-split-brand .nav-links,
    .navbar.nav-rail .nav-links {
        margin-left: 0;
        border-left: 0;
    }

    .navbar .hamburger {
        display: block;
    }

    .navbar.nav-floating-pill { height: calc(var(--navbar-height) + 14px); padding-top: 7px; }
    .navbar.nav-floating-pill .container { padding-inline: 16px; }
    .navbar.nav-segmented .nav-links { border-radius: 12px; }
    .footer-compact .footer-compact-content,
    .footer-ribbon .footer-ribbon-content { grid-template-columns: 1fr; justify-items: center; text-align: center; padding-block: 18px; }
    .footer-compact .footer-compact-content { display: grid; }
    .footer-compact .footer-links,
    .footer-ribbon .footer-links { justify-content: center; }
    .footer-brand-grid .footer-brand-grid-content { grid-template-columns: 1fr 1fr; gap: 26px 18px; }
    .footer-brand-grid .footer-brand { grid-column: 1 / -1; }

    /* 详情页脚：移动端将说明、链接和联系信息收为紧凑的两列内容流，避免四段纵向拉长。 */
    .footer { padding: 24px 0 14px; margin-top: 34px; }
    .footer-content { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 14px; margin-bottom: 14px; }
    .footer-section:first-child { grid-column: 1 / -1; }
    .footer-section:first-child p { max-width: 62ch; }
    .footer-section:last-child {
        grid-column: 1 / -1;
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 3px 12px;
        padding-top: 3px;
        border-top: 1px solid var(--color-border);
    }
    .footer-section:last-child h3,
    .footer-section:last-child p { margin: 0; }
    .footer-section h3 { margin-bottom: 6px; font-size: 13px; }
    .footer-section p,
    .footer-links a { font-size: 12px; }
    .footer-links a { padding-block: 2px; }
    .footer-bottom { padding-top: 12px; font-size: 12px; }

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

    /* 卡片移动端适配：缩小内部尺寸 */
    .items-grid {
        gap: 8px !important;
    }
    .item-card .card-image {
        height: 100px;
    }
    .item-card .card-body {
        padding: 6px;
    }
    .item-card .card-title {
        font-size: 12px;
        margin-bottom: 4px;
        -webkit-line-clamp: 2;
    }
    .item-card .card-desc {
        font-size: 11px;
        display: ${style.cardDescLines === '0' ? 'block' : '-webkit-box'};
        -webkit-line-clamp: ${style.cardDescLines === '0' ? 'unset' : style.cardDescLines};
        -webkit-box-orient: vertical;
        overflow: hidden;
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
    .item-card .card-image {
        height: 80px;
    }
    .item-card .card-body {
        padding: 4px;
    }
    .item-card .card-title {
        font-size: 11px;
        line-height: 1.3;
        margin-bottom: 3px;
        -webkit-line-clamp: 1;
    }
    .item-card .card-desc {
        display: ${style.cardDescLines === '0' ? 'block' : '-webkit-box'};
        -webkit-box-orient: vertical;
        -webkit-line-clamp: ${style.cardDescLines === '0' ? 'unset' : style.cardDescLines};
        overflow: hidden;
        margin-bottom: 0;
        font-size: 10px;
        line-height: 1.35;
    }
    .item-card .card-genres,
    .item-card .card-cuisine {
        font-size: 9px;
    }
    .item-card .card-price {
        font-size: 10px;
    }
}

/* 固定的游戏目录节奏：首组 2 个重点游戏，其余每组 6 个 */
.category-section .items-grid,
.category-featured .items-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
}

.category-featured .card-image { height: clamp(150px, 25vw, 320px); }

@media (min-width: 820px) {
    .category-section:not(.category-featured) .items-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    }
}

/* 可游玩游戏区域 */
.game-stage {
    margin: 24px 0 30px;
    padding: 8px;
    border: 1px solid var(--color-border);
    border-radius: var(--card-radius);
    background: #070909;
}
.game-frame-shell {
    width: 100%;
    min-height: 420px;
    overflow: hidden;
    border-radius: calc(var(--card-radius) - 3px);
    background: #050505;
}
.game-frame-shell iframe {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 420px;
    border: 0;
    background: #050505;
}
.game-stage-note {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 9px 4px 2px;
    color: var(--color-text-secondary);
    font-size: 12px;
}
.game-stage-note a { font-weight: 700; }
.game-stage-preview {
    min-height: 280px;
    display: grid;
    place-items: center;
    background-position: center;
    background-size: cover;
    position: relative;
    overflow: hidden;
}
.game-stage-preview img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.game-stage-preview::before {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, .62);
}
.game-stage-preview span {
    position: relative;
    z-index: 1;
    padding: 10px 16px;
    border: 1px solid rgba(255,255,255,.55);
    color: #fff;
    font-weight: 700;
}

/* 海报画廊：封面成为主界面，标题叠放 */
.layout-poster .item-card { position: relative; min-height: 190px; background: #080b0c; }
.layout-poster .item-card .card-image { height: 100%; min-height: 190px; position: absolute; inset: 0; object-fit: cover; }
.layout-poster .item-card .card-body {
    min-height: 190px;
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    background: linear-gradient(180deg, transparent 28%, rgba(3,5,6,.94) 100%);
}
.layout-poster .item-card .card-title { color: #fff; font-size: 18px; text-shadow: 0 1px 14px #000; }
.layout-poster .category-featured .item-card,
.layout-poster .category-featured .item-card .card-body { min-height: clamp(220px, 34vw, 430px); }
.layout-poster .category-title { border: 0; letter-spacing: .04em; }

/* 编辑精选：用排版和规则线制造杂志分区感 */
.layout-editorial .navbar { border-bottom: 3px solid var(--color-primary); }
.layout-editorial .category-section { border-top: 1px solid var(--color-border); padding-top: 14px; }
.layout-editorial .category-title {
    display: block;
    border: 0;
    padding: 0;
    text-transform: uppercase;
    letter-spacing: .14em;
    font-size: 15px;
}
.layout-editorial .item-card { border-radius: 0; box-shadow: none; border-width: 0 0 1px; }
.layout-editorial .category-featured .card-title { font-size: clamp(18px, 2vw, 28px); }
.layout-editorial .category-featured .card-body { padding-inline: 0; }

/* 街机目录：编号和硬边框强化目录辨识度 */
.layout-arcade .items-grid { counter-reset: arcade-card; }
.layout-arcade .item-card { counter-increment: arcade-card; position: relative; border-radius: 2px; border: 2px solid var(--color-border); }
.layout-arcade .item-card::before {
    content: counter(arcade-card, decimal-leading-zero);
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 3;
    padding: 4px 7px;
    color: var(--color-bg);
    background: var(--color-primary);
    font: 800 11px/1 monospace;
    letter-spacing: .08em;
}
.layout-arcade .category-title { display: block; border: 0; padding: 9px 12px; color: var(--color-bg); background: var(--color-primary); }

@media (max-width: 600px) {
    .game-frame-shell,
    .game-frame-shell iframe { min-height: 58vh; }
    .game-stage-note { flex-direction: column; }
    .layout-poster .item-card,
    .layout-poster .item-card .card-body { min-height: 150px; }
    .layout-poster .category-featured .item-card,
    .layout-poster .category-featured .item-card .card-body { min-height: 190px; }
}

@media (prefers-reduced-motion: reduce) {
    body { animation: none !important; }
    *, *::before, *::after {
        scroll-behavior: auto !important;
        animation-duration: .01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: .01ms !important;
    }
}
${TemplateLayouts.css(config)}
${NavbarLayout.css()}
/* 保留 300px 固定广告槽位；窄屏时避免详情页广告包装层裁切它。 */
@media (min-width: 300px) and (max-width: 400px) {
    .detail-page #adv1,
    .detail-page #adv2,
    .detail-page #adv3 { overflow: visible !important; }
}
`;
    }

    // ========== 生成导航栏HTML ==========
    function categoryAnchorId(category, index) {
        const label = String(category && category.name || '').trim().toLowerCase();
        const slug = label.normalize ? label.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '';
        return 'category-' + (slug || String(index + 1));
    }

    function normalizeCategoryEmoji(category, index) {
        const allowedIcons = typeof GAME_CATEGORY_EMOJI_ICONS !== 'undefined' ? GAME_CATEGORY_EMOJI_ICONS : [];
        const currentIcon = String(category && category.icon || '');
        if (allowedIcons.includes(currentIcon)) return currentIcon;

        const name = String(category && category.name || '').toLowerCase();
        const semanticIcons = [
            ['featured', '🌟'], ['action', '⚔️'], ['puzzle', '🧩'], ['adventure', '🗺️'],
            ['arcade', '👾'], ['strategy', '🎯'], ['simulation', '🤖'], ['sports', '⚽']
        ];
        const semanticMatch = semanticIcons.find(function(entry) { return name.includes(entry[0]); });
        return semanticMatch ? semanticMatch[1] : (allowedIcons[index % allowedIcons.length] || '🎮');
    }

    function escapeNavigationText(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function categoryNavigationHref(anchorId, pageContext) {
        if (pageContext === 'home') return '#' + anchorId;
        if (pageContext === 'detail') return '../index.html#' + anchorId;
        return 'index.html#' + anchorId;
    }

    function getHeaderCategories(categories) {
        const seen = new Set();
        return (categories || []).filter(function(category) {
            return category && String(category.name || '').trim() && Number(category.count) !== 0;
        }).reduce(function(result, category, index) {
            // 开源目录会把同一类游戏按每 6 条拆成多个区块（例如 “Arcade Games 2”）。
            // 首页仍保留所有区块；顶部导航只显示每个真实分类的第一个入口，避免重复和折行。
            const label = String(category.name).trim().replace(/\s+\d+\s*$/, '');
            const key = label.toLocaleLowerCase();
            if (seen.has(key) || result.length >= 4) return result;
            seen.add(key);
            result.push({ category: category, index: index, label: label });
            return result;
        }, []);
    }

    function generateNavbar(config, pageContext) {
        const theme = config.theme;
        const navLinks = ['home'];
        const homeHref = pageContext === 'detail' ? '../index.html' : 'index.html';
        const allGamesHref = pageContext === 'detail' ? '../all-games.html' : 'all-games.html';
        const categories = getHeaderCategories(config.structure.categories);
        const layoutClass = 'navbar-' + (config.structure.navbarLayout || 'normal');
        const navbarClass = 'nav-' + (config.style.navbarStyle || 'glass-sticky') + ' ' + (config.style.navbarStyle === 'glass-sticky' ? 'glass-sticky' :
                           config.style.navbarStyle === 'dark-fixed' ? 'dark-fixed' :
                           config.style.navbarStyle === 'transparent' ? 'transparent' :
                           config.style.navbarStyle === 'side-drawer' ? 'side-drawer' : '');

        const logoIcon = escapeHtml(theme.logoIcon || '🎮');
        const isSideDrawer = config.style.navbarStyle === 'side-drawer';
        const navigationId = isSideDrawer ? 'site-navigation-drawer' : 'site-navigation';
        const logoHtml = config.style.logoStyle === 'icon' ?
            `<a href="${homeHref}" class="logo logo-icon-only" aria-label="${escapeHtml(theme.logoText)}">${logoIcon}</a>` :
            config.style.logoStyle === 'text-icon' ?
            `<a href="${homeHref}" class="logo"><span class="logo-emoji" aria-hidden="true">${logoIcon}</span> ${escapeHtml(theme.logoText)}</a>` :
            config.style.logoStyle === 'gradient-text' ?
            `<a href="${homeHref}" class="logo logo-gradient-text">${escapeHtml(theme.logoText)}</a>` :
            config.style.logoStyle === 'boxed' ?
            `<a href="${homeHref}" class="logo" style="border: 2px solid var(--color-primary); padding: 4px 12px; border-radius: 6px;">${escapeHtml(theme.logoText)}</a>` :
            `<a href="${homeHref}" class="logo">${escapeHtml(theme.logoText)}</a>`;

        let linksHtml = '';
        if (navLinks.includes('home')) linksHtml += `<li><a class="${pageContext === 'home' ? 'nav-current' : ''}" href="${homeHref}">Home</a></li>`;
        categories.forEach(function(entry) {
            const anchorId = categoryAnchorId(entry.category, entry.index);
            linksHtml += `<li><a href="${categoryNavigationHref(anchorId, pageContext)}">${escapeNavigationText(entry.label)}</a></li>`;
        });
        if (config.structure.hasAllItemsPage) {
            linksHtml += `<li><a class="${pageContext === 'all' ? 'nav-current' : ''}" href="${allGamesHref}">All Games</a></li>`;
        }

        const drawerLinksHtml = linksHtml; // reuse the same links for drawer
        // 抽屉导航只有抽屉本身承载链接，避免移动端同时展开普通菜单与抽屉菜单。
        const primaryLinksHtml = isSideDrawer ? '' : `<ul id="${navigationId}" class="nav-links">
            ${linksHtml}
        </ul>`;

        return `<nav class="navbar ${navbarClass} ${layoutClass}">
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
        <a href="${homeHref}" class="drawer-logo">${escapeHtml(theme.logoText)}</a>
        <button class="drawer-close" aria-label="Close menu">&times;</button>
    </div>
    <ul class="drawer-nav">
        ${drawerLinksHtml}
    </ul>
</div>` : ''}`;
    }

    function generateNavbarInteractionScript() {
        return `${NavbarLayout.script()}
${adLayoutTools.layoutRuntimeSource()}
(function() {
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
        const siteName = escapeHtml(theme.siteTitle);
        const footerLinks = config.structure.footerLinks || [];
        const pages = theme.pages;
        const linkItems = [];
        if (footerLinks.includes('privacy')) linkItems.push('<li><a href="privacy.html">Privacy Policy</a></li>');
        if (footerLinks.includes('terms')) linkItems.push('<li><a href="terms.html">Terms of Service</a></li>');
        if (footerLinks.includes('contact')) linkItems.push('<li><a href="contact.html">Contact Us</a></li>');
        if (footerLinks.includes('about')) linkItems.push('<li><a href="about.html">About Us</a></li>');
        const linksHtml = linkItems.join('');
        const legalLinksHtml = linkItems.slice(0, 2).join('');
        const companyLinksHtml = linkItems.slice(2).join('');

        if (config.structure.footerStyle === 'simple') {
            return `<footer class="footer footer-simple">
    <div class="container footer-simple-content">
        <p class="footer-copy">&copy; 2026 ${siteName}. All rights reserved.</p>
        <ul class="footer-links">${linksHtml}</ul>
    </div>
</footer>`;
        }

        if (config.structure.footerStyle === 'compact') {
            return `<footer class="footer footer-compact">
    <div class="container footer-compact-content">
        <p class="footer-copy">&copy; 2026 ${siteName}. All rights reserved.</p>
        <ul class="footer-links">${linksHtml}</ul>
    </div>
</footer>`;
        }

        if (config.structure.footerStyle === 'ribbon') {
            return `<footer class="footer footer-ribbon">
    <div class="container footer-ribbon-content">
        <p class="footer-copy">${siteName} <span aria-hidden="true">·</span> Play instantly, wherever you are.</p>
        <ul class="footer-links">${linksHtml}</ul>
    </div>
</footer>`;
        }

        if (config.structure.footerStyle === 'brand-grid') {
            return `<footer class="footer footer-brand-grid">
    <div class="container">
        <div class="footer-brand-grid-content">
            <div class="footer-brand">${siteName}<p>${escapeHtml(theme.siteSubtitle)}</p></div>
            <div>
                <p class="footer-nav-title">Explore</p>
                <ul class="footer-links"><li><a href="index.html">Home</a></li>${companyLinksHtml}</ul>
            </div>
            <div>
                <p class="footer-nav-title">Information</p>
                <ul class="footer-links">${legalLinksHtml}</ul>
            </div>
        </div>
        <div class="footer-bottom"><p>&copy; 2026 ${siteName}. All rights reserved.</p></div>
    </div>
</footer>`;
        }

        // 详细信息页脚
        return `<footer class="footer footer-detailed">
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
                <ul class="footer-links">${legalLinksHtml}</ul>
            </div>
            <div class="footer-section">
                <h3>Contact Us</h3>
                <p>📧 ${escapeHtml(pages.contact.email)}</p>
                <p>🌐 ${escapeHtml(pages.contact.address)}</p>
            </div>
        </div>
        <div class="footer-bottom">
            <p>&copy; 2026 ${siteName}. All rights reserved.</p>
        </div>
    </div>
</footer>`;
    }

    function generateHomeCardHtml(item, index, config) {
        const mapping = config.fieldMapping;
        const itemId = getItemId(item, index);
        const title = escapeHtml(item[mapping.title] || 'Untitled');
        const image = escapeHtml(safeUrl(getImageSrc(item, mapping.image, config.isLocalImages), true));
        let fieldsHtml = '';

        config.structure.cardFields.forEach(field => {
            if (field === 'image') return;
            const key = mapping[field] || field;
            const value = item[key];
            if (value === undefined || value === null) return;
            if (field === 'title') {
                fieldsHtml += `<div class="card-title">${escapeHtml(value)}</div>`;
            } else if (field === 'excerpt' || field === 'content') {
                fieldsHtml += `<p class="card-desc">${escapeHtml(value)}</p>`;
            } else {
                const isFree = field === 'price' && String(value).toLowerCase() === 'free';
                fieldsHtml += `<div class="card-${escapeHtml(field)}${isFree ? ' price-free' : ''}">${escapeHtml(value)}</div>`;
            }
        });

        return `<a class="item-card" href="details/article${itemId}.html">
            ${image && config.structure.cardFields.includes('image') ? `<img class="card-image" src="${image}"${getImageFallbackAttr(item)} alt="${title}" loading="lazy" decoding="async">` : ''}
            <div class="card-body">${fieldsHtml}</div>
        </a>`;
    }

    // ========== 生成首页 index.html ==========
    function generateIndexHtml(config, data) {
        const theme = config.theme;
        const layoutClass = 'layout-' + (config.style.layoutTemplate || 'classic');
        const siteName = escapeHtml(theme.siteTitle);
        const navbar = generateNavbar(config, 'home');
        const footer = generateFooter(config);
        const adPlacements = config.adPlacements || {};
        const adRuntimeVersion = getAdRuntimeVersion(config.adPaths, config.adJsVersion);
        const adScripts = hasConfiguredAds(config)
            ? '<script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js" crossorigin="anonymous"><\/script>\n    <script defer src="js/ad.js?v=' + adRuntimeVersion + '"><\/script>'
            : '';

        // 获取首页静态位置广告（容器外部的位置）
        function getHomeAd(position) {
            let code = '';
            for (const [adId, pages] of Object.entries(adPlacements)) {
                if (pages && adLayoutTools.matchesPlacement(pages.home, position, 'home', config.structure.categories.length)) {
                    code += AD_TEMPLATES[adId] || '';
                }
            }
            return code;
        }

        const heroHtml = config.structure.heroEnabled ? `
    <section class="hero">
        <div class="container">
            <h1 class="hero-title">${escapeHtml(config.structure.heroTitle || theme.hero.title)}</h1>
            <p class="hero-subtitle">${escapeHtml(config.structure.heroSubtitle || theme.hero.subtitle)}</p>
        </div>
    </section>` : '';

        // 分类容器：广告容器静态写入，卡片grid由JS动态填充
        const categories = config.structure.categories;
        let categoriesHtml = '';
        // 内容区顶部广告
        categoriesHtml += '\n' + getHomeAd('content-top');
        // 内容布局不接触广告内容，原广告位置仍由 getHomeAd 负责。
        categoriesHtml += TemplateLayouts.openHome(config, data, categoryAnchorId);
        let itemIndex = 0;
        categories.forEach((cat, i) => {
            let cardsHtml = '';
            const count = Math.min(cat.count, Math.max(0, data.length - itemIndex));
            for (let cardIndex = 0; cardIndex < count; cardIndex++, itemIndex++) {
                cardsHtml += generateHomeCardHtml(data[itemIndex], itemIndex, config);
                if (cardIndex < count - 1) {
                    cardsHtml += getHomeAd('cat-' + i + '-between-' + cardIndex + '-' + (cardIndex + 1));
                }
            }
            if (categories.length === 1) cardsHtml += adLayoutTools.middleGridMarkup(getHomeAd('content-middle'));
            categoriesHtml += `
        <section id="${categoryAnchorId(cat, i)}" class="category-section${i === 0 ? ' category-featured' : ''}">
            ${TemplateLayouts.categoryHeader(config, cat, i)}
            ${getHomeAd('cat-' + i + '-after-title')}
            <div class="items-grid" data-category="cat-${i}">${cardsHtml}</div>
            ${getHomeAd('cat-' + i + '-after-last')}
        </section>`;
            // 分类区块之间广告
            if (i < categories.length - 1) {
                categoriesHtml += '\n' + getHomeAd('after-section-' + i);
            }
        });
        if (config.structure.hasAllItemsPage && data.length > itemIndex) {
            categoriesHtml += `
        <div class="view-all-games">
            <a class="action-btn" href="all-games.html">View All ${data.length} Games</a>
        </div>`;
        }
        // 内容区底部广告
        categoriesHtml += TemplateLayouts.closeHome(config);
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
    ${_googleFontLink}
    <link rel="stylesheet" href="css/style.css">
</head>
<body class="${layoutClass}"${TemplateLayouts.bodyAttributes(config)}>
    ${navbar}
    ${getHomeAd('after-navbar')}
    ${heroHtml}
    ${getHomeAd('after-hero')}
    <main class="main-content" data-static-rendered="true">
        <div class="container">
            ${categoriesHtml}
        </div>
    </main>
    ${getHomeAd('footer-top')}
    ${footer}
</body>
</html>`;
    }

    // ========== 生成完整游戏列表页 ==========
    function generateAllGamesHtml(config, data) {
        const theme = config.theme;
        const layoutClass = 'layout-' + (config.style.layoutTemplate || 'classic');
        const siteName = escapeHtml(theme.siteTitle);
        const navbar = generateNavbar(config, 'all');
        const footer = generateFooter(config);
        const adPlacements = config.adPlacements || {};
        const adRuntimeVersion = getAdRuntimeVersion(config.adPaths, config.adJsVersion);
        const adScripts = hasConfiguredAds(config)
            ? '<script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js" crossorigin="anonymous"><\/script>\n    <script defer src="js/ad.js?v=' + adRuntimeVersion + '"><\/script>'
            : '';
        const getAllGamesAd = function() { return getAllGamesDetailAds(adPlacements, Array.from(arguments)); };
        const cards = data.map(function(item, index) {
            return generateHomeCardHtml(item, index, config);
        });

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>All Games | ${siteName}</title>
    <meta name="description" content="Browse all ${data.length} games on ${siteName}.">
    <script defer src="js/script.js"></script>
    ${adScripts}
    ${_googleFontLink}
    <link rel="stylesheet" href="css/style.css">
</head>
<body class="${layoutClass}"${TemplateLayouts.bodyAttributes(config)}>
    ${navbar}
    ${getAllGamesAd('after-navbar')}
    <main class="main-content" data-static-rendered="true">
        <div class="container">
            ${getAllGamesAd('detail-before-content')}
            <section id="all-games" class="category-section">
                <h1 class="category-title">All Games</h1>
                ${buildAllGamesCardGrid(adPlacements, cards)}
            </section>
        </div>
    </main>
    ${getAllGamesAd('detail-after-related', 'footer-top')}
    ${footer}
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
        const homeInlineAds = {};
        Object.entries(config.adPlacements || {}).forEach(([adId, pages]) => {
            if (pages && pages.home && pages.home.indexOf('-between-') !== -1 && AD_TEMPLATES[adId]) {
                homeInlineAds[pages.home] = (homeInlineAds[pages.home] || '') + AD_TEMPLATES[adId];
            }
        });

        // 分类配置
        const catConfig = categories.map((cat, i) => ({
            name: cat.name,
            key: `cat-${i}`,
            count: cat.count
        }));

        return `${adLayoutTools.layoutRuntimeSource()}
(function() {
    // 网站配置
    var CONFIG = {
        dataFile: 'data.json',
        categories: ${serializeForScript(catConfig)},
        cardFields: ${serializeForScript(cardFields)},
        randomSort: ${randomSort},
        siteName: ${serializeForScript(theme.siteTitle)},
        imageField: ${serializeForScript(imageField)},
        fieldMapping: ${serializeForScript(config.fieldMapping || {})},
        homeInlineAds: ${serializeForScript(homeInlineAds)},
        hasId: ${config.fieldMapping.id ? 'true' : 'false'}
    };

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safeUrl(value, allowRelative) {
        var url = String(value == null ? '' : value).trim();
        if (!url) return '';
        if (/^https?:\\/\\//i.test(url)) return url;
        if (allowRelative && !/^[a-z][a-z0-9+.-]*:/i.test(url) && url.indexOf('//') !== 0) return url;
        return '';
    }

    function safeItemId(value, fallback) {
        var normalized = String(value == null ? fallback : value)
            .replace(/[^a-zA-Z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return normalized || String(fallback);
    }

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
            .then(function(res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
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
                if (!Array.isArray(data)) throw new Error('Invalid data format');
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
        var rawItemId = item.id !== undefined && item.id !== null ? item.id : (item._index || idx + 1);
        var itemId = safeItemId(rawItemId, idx + 1);
        card.className = 'item-card';
        card.href = 'details/article' + itemId + '.html';

        var html = '';
        // 图片
        if (CONFIG.cardFields.indexOf('image') !== -1 && item[CONFIG.imageField]) {
            var imageUrl = safeUrl(item[CONFIG.imageField], true);
            var titleKey = CONFIG.fieldMapping.title || 'title';
            if (imageUrl) html += '<img class="card-image" src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(item[titleKey] || '') + '" loading="lazy" decoding="async">';
        }
        html += '<div class="card-body">';

        // 遍历配置的展示字段
        for (var i = 0; i < CONFIG.cardFields.length; i++) {
            var field = CONFIG.cardFields[i];
            if (field === 'image') continue;
            var dataKey = CONFIG.fieldMapping[field] || field;
            var val = item[dataKey];
            if (val === undefined || val === null) continue;

            if (field === 'title') {
                html += '<div class="card-title">' + escapeHtml(val) + '</div>';
            } else if (field === 'excerpt' || field === 'content') {
                html += '<p class="card-desc">' + escapeHtml(val) + '</p>';
            } else if (field === 'price') {
                var isFree = String(val).toLowerCase() === 'free';
                html += '<div class="card-price' + (isFree ? ' price-free' : '') + '">' + escapeHtml(val) + '</div>';
            } else if (field === 'genres' || field === 'cuisine') {
                html += '<div class="card-' + field + '">' + escapeHtml(val) + '</div>';
            } else {
                html += '<div class="card-' + field + '">' + escapeHtml(val) + '</div>';
            }
        }
        html += '</div>';
        card.innerHTML = html;
        return card;
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
            for (var i = 0; i < count; i++) {
                var card = createCard(available[i], i);
                grid.appendChild(card);
                usedItems.push(available[i]);
                var inlineAd = CONFIG.homeInlineAds['cat-' + c + '-between-' + i + '-' + (i + 1)];
                if (inlineAd && i < count - 1) grid.insertAdjacentHTML('beforeend', inlineAd);
            }
        }
    }

    // 汉堡菜单交互
    function initNavbar() {
        ${NavbarLayout.script()}
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
        if (mainContent && mainContent.dataset.staticRendered !== 'true') {
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

    // ========== 生成详情页HTML ==========
    function renderBackLink(href, style, isPreview) {
        const value = ['text', 'breadcrumb', 'button', 'minimal', 'underline', 'outline', 'pill', 'icon', 'glass'].includes(style) ? style : 'text';
        const target = isPreview ? ' data-preview-page="home"' : '';
        if (value === 'breadcrumb') return `<a href="${href}" class="back-link breadcrumb"${target} aria-label="Back to Home"><span class="breadcrumb-home">Home</span><span class="breadcrumb-separator" aria-hidden="true">/</span><span class="breadcrumb-current">Game</span></a>`;
        if (value === 'minimal') return `<a href="${href}" class="back-link minimal"${target}><span class="back-link-arrow" aria-hidden="true">←</span><span>Back to Home</span></a>`;
        if (value === 'underline') return `<a href="${href}" class="back-link underline"${target}>← Back to Home</a>`;
        if (value === 'outline') return `<a href="${href}" class="back-link outline"${target}>← Back to Home</a>`;
        if (value === 'pill') return `<a href="${href}" class="back-link pill"${target}>← Back to Home</a>`;
        if (value === 'icon') return `<a href="${href}" class="back-link icon"${target} aria-label="Back to Home"><svg class="back-link-icon-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 12H5M11 18l-6-6 6-6"/></svg></a>`;
        if (value === 'glass') return `<a href="${href}" class="back-link glass"${target}>← Back to Home</a>`;
        return `<a href="${href}" class="back-link${value === 'button' ? ' button' : ''}"${target}>← Back to Home</a>`;
    }

    function generateDetailHtml(item, index, allItems, config) {
        const theme = config.theme;
        const style = config.style;
        const layoutClass = 'layout-' + (style.layoutTemplate || 'classic');
        const mapping = config.fieldMapping;
        const itemId = getItemId(item, index);
        const siteName = escapeHtml(theme.siteTitle);
        const adRuntimeVersion = getAdRuntimeVersion(config.adPaths, config.adJsVersion);
        const adScripts = hasConfiguredAds(config)
            ? '<script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js" crossorigin="anonymous"><\/script>\n    <script defer src="../js/ad.js?v=' + adRuntimeVersion + '"><\/script>'
            : '';

        const navbar = generateNavbar(config, 'detail');

        const footer = generateFooter(config).replace(/href="([^"]*)"/g, function(match, href) {
            return 'href="../' + href + '"';
        });

        // 标题
        const titleRaw = item[mapping.title] || 'Untitled';
        const title = escapeHtml(titleRaw);

        // 图片
        let imageSrc = item[mapping.image] || '';
        // 本地图片需要加 ../ 前缀，因为详情页在 details/ 子目录
        if (imageSrc && !/^(?:https?:|data:|blob:|\/\/)/i.test(imageSrc) && config.isLocalImages) {
            const filename = imageSrc.split('/').pop().split('\\').pop();
            imageSrc = '../images/' + filename;
        }
        imageSrc = escapeHtml(safeUrl(imageSrc, true));
        const imgClass = 'detail-hero-image';

        // 内容
        const rawContent = item[mapping.content] || '';
        const renderedContent = config.structure.contentRender === 'markdown' ?
            simpleMarkdownToHtml(rawContent) :
            '<p>' + escapeHtml(rawContent).replace(/\n\n/g, '</p><p>') + '</p>';

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
    <span class="meta-label">${escapeHtml(label)}</span>
    <span class="meta-value${isFreePrice ? ' price-free' : ''}">${escapeHtml(val)}</span>
</div>`;
            }
        });

        // 游戏直接嵌入详情页；已知禁止嵌入的 Poki 页面改为展示封面与原站入口。
        const gameUrl = detailPageUrl(item[mapping.store_url]);
        const gameWidth = Number(item.width);
        const gameHeight = Number(item.height);
        const gameRatio = gameWidth > 0 && gameHeight > 0 ? gameWidth + ' / ' + gameHeight : '16 / 9';

        // 操作按钮
        let actionBtnHtml = '';
        if (config.structure.actionButtonEnabled && config.structure.actionButtonLinkField) {
            const url = item[mapping[config.structure.actionButtonLinkField]];
            const safeActionUrl = detailPageUrl(url);
            if (safeActionUrl) {
                actionBtnHtml = `<a class="action-btn" href="${escapeHtml(safeActionUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(config.structure.actionButtonText)}</a>`;
            }
        }

        const gameStageHtml = gameUrl ? (isPokiPageUrl(gameUrl) ? `<section class="game-stage" aria-label="Play ${title}">
            <div class="game-stage-preview">
                ${imageSrc ? `<img src="${imageSrc}"${getImageFallbackAttr(item)} alt="${title}">` : ''}
                <span>PLAY ON POKI</span>
            </div>
            <div class="game-stage-note"><span>This game can only be played on Poki.</span><a href="${escapeHtml(gameUrl)}" target="_blank" rel="noopener noreferrer">Open game on Poki ↗</a></div>
        </section>` : `<section class="game-stage" aria-label="Play ${title}">
            <div class="game-frame-shell" style="aspect-ratio:${escapeHtml(gameRatio)}">
                <iframe src="${escapeHtml(gameUrl)}" title="${title}" loading="eager" allow="autoplay; fullscreen; gamepad; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
            </div>
            <div class="game-stage-note"><span>Game not loading?</span><a href="${escapeHtml(gameUrl)}" target="_blank" rel="noopener noreferrer">Open game in a new tab ↗</a></div>
        </section>`) : '';

        // 相关推荐
        const related = [];
        const relatedLimit = Math.min(config.structure.relatedCount, Math.max(0, allItems.length - 1));
        for (let offset = 1; offset <= relatedLimit; offset++) {
            const relIdx = (index + offset) % allItems.length;
            related.push({ item: allItems[relIdx], index: relIdx });
        }

        let relatedHtml = '';
        related.forEach(entry => {
            const relItem = entry.item;
            const relIdx = entry.index;
            const relId = getItemId(relItem, relIdx);
            const relTitle = escapeHtml(relItem[mapping.title] || '');
            let relImage = relItem[mapping.image] || '';
            // 本地图片需要加 ../ 前缀
            if (relImage && !/^(?:https?:|data:|blob:|\/\/)/i.test(relImage) && config.isLocalImages) {
                const filename = relImage.split('/').pop().split('\\').pop();
                relImage = '../images/' + filename;
            }
            relImage = escapeHtml(safeUrl(relImage, true));
            const relatedFields = config.structure.relatedCardFields;
            let additionalHtml = '';
            relatedFields.forEach(f => {
                if (f === 'image' || f === 'title') return;
                const val = relItem[mapping[f]];
                if (val) additionalHtml += `<div class="related-${escapeHtml(f)}">${escapeHtml(val)}</div>`;
            });
            relatedHtml += `<a class="related-card" href="article${relId}.html">
    ${relImage ? `<img src="${relImage}"${getImageFallbackAttr(relItem)} alt="${relTitle}" loading="lazy" decoding="async">` : ''}
    <div class="related-info">
        <div class="related-name">${relTitle}</div>
        ${additionalHtml}
    </div>
</a>`;
        });

        const backLink = renderBackLink('../index.html', config.structure.backLinkStyle, false);

        // 关键词
        const keywords = generateKeywords(item, theme.id);

        // 详情页广告代码
        const adPlacements = config.adPlacements || {};
        function getDetailAd(position) {
            let code = '';
            for (const [adId, pages] of Object.entries(adPlacements)) {
                if (pages && adLayoutTools.matchesPlacement(pages.detail, position, 'detail', 0, renderedContent)) {
                    code += AD_TEMPLATES[adId] || '';
                }
            }
            return code;
        }

        // 正文内容中插入段落间广告
        let contentWithAds = renderedContent;
        if (Object.values(adPlacements).some(pages => pages && (pages.detail === 'detail-middle' || /^detail-between-p-/.test(pages.detail || '')))) {
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
    <meta name="keywords" content="${escapeHtml(keywords)}">
    <meta name="description" content="${escapeHtml(String(item[mapping.excerpt] || titleRaw).substring(0, 160))}">
    ${adScripts}
    ${_googleFontLink}
    <link rel="stylesheet" href="../css/style.css">
</head>
<body class="${layoutClass}"${TemplateLayouts.bodyAttributes(config)}>
    ${navbar}
    ${getDetailAd('after-navbar')}
    <div class="detail-page">
        ${style.detailLayout === 'sidebar' ? '<div class="detail-main">' : ''}
        ${backLink}
        ${imageSrc ? `<img class="${imgClass}" src="${imageSrc}"${getImageFallbackAttr(item)} alt="${title}">` : ''}
        <h1 class="detail-title">${title}</h1>
        ${metaHtml ? '<div class="detail-meta">' + metaHtml + '</div>' : ''}
        ${gameStageHtml}
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
        const fields = config.structure.contactFields;

        let formHtml = '<form class="contact-form" action="#" onsubmit="return false;">';
        if (fields.includes('name')) formHtml += '<div class="form-group"><label for="name">Name</label><input type="text" id="name" name="name"></div>';
        if (fields.includes('email')) formHtml += '<div class="form-group"><label for="email">Email</label><input type="email" id="email" name="email"></div>';
        if (fields.includes('subject')) formHtml += '<div class="form-group"><label for="subject">Subject</label><input type="text" id="subject" name="subject"></div>';
        if (fields.includes('message')) formHtml += '<div class="form-group"><label for="message">Message</label><textarea id="message" name="message"></textarea></div>';
        formHtml += '<button type="submit" class="submit-btn">Send Message</button></form>';

        return `<div class="page-content">
            <h1>${pages.title}</h1>
            <p>${pages.desc}</p>
            ${formHtml}
            <div style="margin-top:30px;">
                <p>📧 ${escapeHtml(pages.email)}</p>
                <p>📍 ${escapeHtml(pages.address)}</p>
            </div>
        </div>`;
    }

    function generateAboutBody(config) {
        const theme = config.theme;
        const pages = theme.pages.about;
        return `<div class="page-content">
            <h1>${pages.title}</h1>
            <p>${pages.intro}</p>
            <h2>Our Mission</h2>
            <p>${pages.mission}</p>
            <h2>Contact</h2>
            <p>📧 ${escapeHtml(pages.email)}</p>
            <p>📍 ${escapeHtml(pages.address)}</p>
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
    <title>Contact Us - ${escapeHtml(theme.siteTitle)}</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body${TemplateLayouts.bodyAttributes(config)}>
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
    <title>About Us - ${escapeHtml(theme.siteTitle)}</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body${TemplateLayouts.bodyAttributes(config)}>
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
    <title>Privacy Policy - ${escapeHtml(theme.siteTitle)}</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body${TemplateLayouts.bodyAttributes(config)}>
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
    <title>Terms of Service - ${escapeHtml(theme.siteTitle)}</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body${TemplateLayouts.bodyAttributes(config)}>
    ${navbar}
    ${generateTermsBody(config)}
    ${footer}
    <script>
    ${generateNavbarInteractionScript()}
    </script>
</body>
</html>`;
    }

    // ========== 主导出函数 ==========
    async function exportWebsite(appState, onProgress, exportOptions) {
        const config = buildConfig(appState);
        const data = appState.data;
        const isLocalImages = appState.isLocalImages;
        const localImages = appState.localImages || {};
        const localGameFiles = appState.localGameFiles || {};
        const sourceNotice = appState.sourceNotice || null;

        onProgress(5, '正在生成CSS...');

        const zip = new JSZip();
        // Keep one directory around the site source. Ad exports use the
        // validated host supplied by the app; other exports keep `website`.
        const requestedFolderName = exportOptions && exportOptions.siteFolderName;
        const safeFolderName = typeof requestedFolderName === 'string'
            && /^[a-z0-9.-]+$/i.test(requestedFolderName)
            && requestedFolderName.indexOf('..') === -1
            ? requestedFolderName
            : 'website';
        const siteFolder = zip.folder(safeFolderName);

        // CSS
        siteFolder.folder('css').file('style.css', generateCSS(config));
        onProgress(15, '正在生成首页...');

        // index.html
        const homeHtml = generateIndexHtml(config, data);
        if (hasValidatedAdConfig(config)) {
            const errors = validateMigratedPage(homeHtml, 'home');
            if (errors.length) throw new Error('广告移植首页校验失败：' + errors.map(item => item.message).join(' '));
        }
        siteFolder.file('index.html', homeHtml);

        if (config.structure.hasAllItemsPage) {
            const allGamesHtml = generateAllGamesHtml(config, data);
            if (hasValidatedAdConfig(config)) {
                const errors = validateMigratedPage(allGamesHtml, 'all');
                if (errors.length) throw new Error('广告移植全部游戏页校验失败：' + errors.map(item => item.message).join(' '));
            }
            siteFolder.file('all-games.html', allGamesHtml);
        }

        onProgress(25, '正在生成script.js...');

        // script.js
        siteFolder.folder('js').file('script.js', generateScriptJs(config));

        // 仅在已配置广告代码且放置了广告位时生成广告脚本
        if (hasConfiguredAds(config)) {
            siteFolder.folder('js').file('ad.js', generateSelectedAdJs(config.adPaths, config.adJsVersion));
        }

        // data.json - 处理本地图片路径
        let dataForJson = JSON.parse(JSON.stringify(data));
        if (isLocalImages) {
            const imageField = config.fieldMapping.image;
            dataForJson = dataForJson.map(item => {
                if (item[imageField] && !/^(?:https?:|data:|blob:|\/\/)/i.test(item[imageField])) {
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
                if (errors.length) throw new Error('广告移植详情页校验失败（第 ' + (i + 1) + ' 页）：' + errors.map(item => item.message).join(' '));
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

        if (hasConfiguredAds(config) && !hasValidatedAdConfig(config)) {
            siteFolder.file('AD_PLACEHOLDER_SETUP.txt', '本网站已预留广告容器，并生成路径为空的 js/ad.js。拿到运营广告代码后，请填写 adUnitBanner1、adUnitBanner2、adUnitBanner3、adUnitInterstitial、adUnitAnchor 与 gaMeasurementId；不需要重新生成页面。\n');
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

        // 自托管开源游戏文件
        if (Object.keys(localGameFiles).length > 0) {
            onProgress(90, '正在添加本地游戏文件...');
            const gamesFolder = siteFolder.folder('games');
            for (const [path, contents] of Object.entries(localGameFiles)) {
                const filename = path.split('/').pop().split('\\').pop();
                if (!/^[a-z0-9][a-z0-9._-]*\.html$/i.test(filename)) {
                    throw new Error('本地游戏文件名不安全：' + path);
                }
                gamesFolder.file(filename, contents);
            }
        }

        // MIT 等第三方许可证必须随导出站点保留
        if (sourceNotice && sourceNotice.licenseText) {
            const repository = safeUrl(sourceNotice.repository, false);
            const notice = [
                'Open-source game attribution',
                '',
                'Source: ' + (repository || 'Not provided'),
                'Revision: ' + String(sourceNotice.revision || 'Not provided'),
                'License: ' + String(sourceNotice.license || 'See bundled license'),
                '',
                'The game source files and captured game covers are distributed under the license included in licenses/mini-browser-games-MIT.txt.'
            ].join('\n');
            siteFolder.file('OPEN_SOURCE_NOTICES.txt', notice);
            siteFolder.folder('licenses').file('mini-browser-games-MIT.txt', String(sourceNotice.licenseText));
        }

        onProgress(92, '正在校验网站文件...');
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
        const mapping = appState.fieldMapping;
        const siteTitle = String(appState.config.siteTitle || baseTheme.siteTitle).trim() || baseTheme.siteTitle;
        const siteSubtitle = String(appState.config.siteSubtitle || baseTheme.siteSubtitle).trim() || baseTheme.siteSubtitle;
        const contactEmail = String(appState.config.contactEmail || baseTheme.pages.contact.email).trim() || baseTheme.pages.contact.email;
        const personalize = value => typeof value === 'string'
            ? value.replace(/GameHub/g, () => escapeHtml(siteTitle)).replace(/contact@gamehub\.com/gi, () => escapeHtml(contactEmail))
            : value;
        const personalizePage = page => Object.fromEntries(
            Object.entries(page).map(([key, value]) => [key, personalize(value)])
        );
        const theme = {
            ...baseTheme,
            siteTitle: siteTitle,
            siteSubtitle: siteSubtitle,
            logoText: siteTitle,
            logoIcon: String(appState.config.logoIcon || '🎮'),
            pages: {
                ...baseTheme.pages,
                about: personalizePage(baseTheme.pages.about),
                contact: { ...personalizePage(baseTheme.pages.contact), email: contactEmail },
                privacy: personalizePage(baseTheme.pages.privacy),
                terms: personalizePage(baseTheme.pages.terms)
            }
        };
        const requestedFooterLinks = appState.config.footerLinks || ['privacy', 'terms', 'contact', 'about'];
        const footerLinks = requestedFooterLinks.filter(link => link !== 'about' || appState.config.aboutEnabled !== false);
        const migration = appState.siteBuildMode === 'ad-migration' && appState.legacyAdMigration && appState.legacyAdMigration.valid
            ? appState.legacyAdMigration
            : null;
        const reserveAds = appState.siteBuildMode === 'normal' && appState.normalAdMode === 'reserve';
        const directAdCode = appState.siteBuildMode === 'normal' && !reserveAds && appState.adCodeMigration && appState.adCodeMigration.valid
            ? appState.adCodeMigration
            : null;
        const activeAdCode = migration || directAdCode;
        const directCodeManualAds = !!directAdCode && appState.directAdPlacementMode === 'manual';
        const fixedReserveAds = reserveAds && appState.reservePlacementMode === 'fixed';
        const useAutomaticAdPlacements = (activeAdCode && !directCodeManualAds) || fixedReserveAds;
        const automaticAdPlacements = useAutomaticAdPlacements && typeof AdMigration !== 'undefined' ? AdMigration.fixedPlacements() : {};
        const homeCategoryCount = (appState.config.categories || theme.categories).length;
        if (fixedReserveAds && automaticAdPlacements.adv3 && homeCategoryCount < 2) automaticAdPlacements.adv3.home = 'footer-top';
        const manualAdPlacements = directCodeManualAds
            ? (appState.config.adCodePlacements || {})
            : (appState.config.adPlacements || {});
        const exportedAdPlacements = useAutomaticAdPlacements
            ? automaticAdPlacements
            : (reserveAds || directCodeManualAds ? manualAdPlacements : {});
        const categories = (appState.config.categories || theme.categories).map(function(category, index) {
            return { ...category, icon: normalizeCategoryEmoji(category, index), count: index === 0 ? 2 : 6 };
        });

        return {
            theme: theme,
            templateDomain: 'game',
            fieldMapping: mapping,
            structure: {
                navLinks: ['home'],
                footerLinks: footerLinks,
                navbarLayout: appState.config.navbarLayout || 'normal',
                footerStyle: appState.config.footerStyle || 'simple',
                backLinkStyle: appState.config.backLinkStyle || 'text',
                heroEnabled: appState.config.heroEnabled || false,
                heroTitle: appState.config.heroTitle || theme.hero.title,
                heroSubtitle: appState.config.heroSubtitle || theme.hero.subtitle,
                categories: categories,
                // 用户可关闭完整目录入口；关闭时不会生成 all-games.html，首页也不会显示入口。
                hasAllItemsPage: appState.config.allGamesEnabled !== false && Array.isArray(appState.data) && appState.data.length > 0,
                cardColumns: appState.config.cardColumns || 'auto',
                randomSort: appState.config.randomSort === true,
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
                navbarStyle: appState.config.navbarStyle === 'bottom-fixed' ? 'glass-sticky' : (appState.config.navbarStyle || 'glass-sticky'),
                navbarHeight: appState.config.navbarHeight || '60px',
                logoStyle: appState.config.logoStyle || 'text',
                cardHover: appState.config.cardHover || 'float',
                cardBorder: appState.config.cardBorder || 'rounded',
                cardRadius: appState.config.cardRadius || '8px',
                cardSpacing: appState.config.cardSpacing || '20px',
                btnStyle: ({ gradient: 'solid', rounded: 'pill', '3d': 'solid', ghost: 'text' })[appState.config.btnStyle] || appState.config.btnStyle || 'solid',
                btnSize: appState.config.btnSize || 'medium',
                gridGap: appState.config.gridGap || '20px',
                fontStyle: appState.config.fontStyle || 'sans-serif',
                ambientEffect: appState.config.ambientEffect || 'none',
                animationEnter: appState.config.animationEnter || 'fadeIn',
                transitionSpeed: appState.config.transitionSpeed || '0.3s',
                metaLayout: appState.config.metaLayout || 'grid',
                metaBg: appState.config.metaBg || 'dark',
                detailImgStyle: appState.config.detailImgStyle || 'fullwidth',
                // 缺省保持现有图标可见，隐藏时不修改分类保存的 icon。
                categoryIconsEnabled: appState.config.categoryIconsEnabled !== false,
                categoryTitleStyle: appState.config.categoryTitleStyle || 'single',
                categoryTitleAlign: appState.config.categoryTitleAlign || 'left',
                cardImageHeight: appState.config.cardImageHeight || '180px',
                contentMaxWidth: appState.config.contentMaxWidth || '1200px',
                heroStyle: appState.config.heroStyle || 'gradient',
                detailLayout: appState.config.detailLayout || 'single',
                cardViewMode: appState.config.cardViewMode || 'card',
                cardDescLines: appState.config.cardDescLines || '2',
                layoutTemplate: appState.config.layoutTemplate || 'classic'
            },
            siteBuildMode: migration ? 'ad-migration' : (reserveAds ? 'ad-placeholder' : 'normal'),
            adMigration: activeAdCode,
            adRuntimeEnabled: !!activeAdCode || reserveAds,
            adPlacements: exportedAdPlacements,
            adPaths: activeAdCode ? activeAdCode.config : {},
            adJsVersion: normalizeAdJsVersion(appState.adJsVersion),
            adPlacementMode: appState.adPlacementMode || null,
            isLocalImages: appState.isLocalImages || false
        };
    }

    // ========== 生成预览HTML ==========
    function generatePreviewHtml(appState, pageType) {
        const config = buildConfig(appState, { previewManualAds: true });
        const theme = config.theme;
        const data = appState.data;
        const mapping = appState.fieldMapping;
        const isLocalImages = appState.isLocalImages;
        const adPlacements = config.adPlacements;
        const isPlacingAds = !!config.adPlacementMode;

        // 本地图片路径 → 可预览URL映射。内置开源封面优先使用 data URL，
        // 因为 sandboxed srcdoc iframe 无法读取父页面创建的 blob URL。
        const localImageUrls = {};
        if (isLocalImages && appState.localImages) {
            for (const [path, blob] of Object.entries(appState.localImages)) {
                const filename = path.split('/').pop().split('\\').pop();
                const embeddedDataUrl = appState.localImageDataUrls && appState.localImageDataUrls[filename];
                if (embeddedDataUrl) {
                    localImageUrls[filename] = embeddedDataUrl;
                    continue;
                }
                const blobUrl = URL.createObjectURL(blob);
                localImageUrls[filename] = blobUrl;
                appState._previewBlobUrls.push(blobUrl);
            }
        }

        // 根据映射获取图片URL（本地图片用blob URL替代）
        function getPreviewImageSrc(item) {
            let src = item[mapping.image] || '';
            if (!src || !isLocalImages) return src;
            if (/^(?:https?:|data:|blob:|\/\/)/i.test(src)) return src;
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
                'detail-middle': '正文中部',
                'content-middle': '内容中段',
                'detail-after-related': '相关推荐后'
            };
            if (position === 'after-section-0') return '第一个分类后';
            if (position === 'after-section-1') return '第二个分类后';
            if (/^cat-\d+-after-title$/.test(position)) return '分类标题后';
            if (/^cat-\d+-after-last$/.test(position)) return '分类末尾';
            return labels[position] || '';
        }

        // 广告标记生成器（仅放置模式）
        function genMarker(position, page) {
            const label = getCommonAdPlacementLabel(position, page);
            if (!label) return '';
            return '<div class="insert-marker" data-position="' + position + '" data-page="' + page + '" title="点击在此放置广告">＋ 常用广告位 · ' + label + '</div>';
        }

        // 获取指定位置的广告代码
        function getAdCodeAt(position, page, placements, content) {
            let code = '';
            for (const [adId, pages] of Object.entries(placements)) {
                // 新结构: { adv1: { home: 'after-hero', detail: '...' } }
                if (pages && adLayoutTools.matchesPlacement(pages[page], position, page, config.structure.categories.length, content)) {
                    code += AD_TEMPLATES[adId] || '';
                }
            }
            return code;
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
                        <h1 class="hero-title" style="color:${heroTitleColor}">${escapeHtml(config.structure.heroTitle)}</h1>
                        <p class="hero-subtitle" style="color:${heroSubColor}">${escapeHtml(config.structure.heroSubtitle)}</p>
                    </div>
                </section>`;
                if (isPlacingAds) bodyContent += genMarker('after-hero', pageType);
                bodyContent += getAdCodeAt('after-hero', pageType, adPlacements);
            }

            bodyContent += '<main class="main-content"><div class="container">';
            if (isPlacingAds) bodyContent += genMarker('content-top', pageType);
            bodyContent += getAdCodeAt('content-top', pageType, adPlacements);
            bodyContent += TemplateLayouts.openHome(config, data, categoryAnchorId);

            // 用前几条数据渲染预览
            const categories = config.structure.categories;
            let itemIndex = 0;
            categories.forEach((cat, ci) => {
                bodyContent += `<section id="${categoryAnchorId(cat, ci)}" class="category-section${ci === 0 ? ' category-featured' : ''}">
                    ${TemplateLayouts.categoryHeader(config, cat, ci)}`;
                if (isPlacingAds) bodyContent += genMarker('cat-' + ci + '-after-title', pageType);
                bodyContent += getAdCodeAt('cat-' + ci + '-after-title', pageType, adPlacements);
                bodyContent += '<div class="items-grid">';

                for (let i = 0; i < cat.count && itemIndex < data.length; i++, itemIndex++) {
                    const item = data[itemIndex];
                    const title = escapeHtml(item[mapping.title] || 'Untitled');
                    const image = escapeHtml(safeUrl(getPreviewImageSrc(item), true));

                    bodyContent += `<a class="item-card" href="#" data-preview-game-index="${itemIndex}" aria-label="Preview ${title} details">
                        ${image ? `<img class="card-image" src="${image}"${getImageFallbackAttr(item)} alt="${title}">` : ''}
                        <div class="card-body">
                            <div class="card-title">${title}</div>`;

                    // 其他字段
                    config.structure.cardFields.forEach(field => {
                        if (field === 'image' || field === 'title') return;
                        const val = item[mapping[field]];
                        if (val !== undefined && val !== null) {
                            const isFreePrice = field === 'price' && String(val).toLowerCase() === 'free';
                            const cssClass = field === 'content' || field === 'excerpt' ? 'card-desc' : ('card-' + field);
                            const tag = field === 'content' || field === 'excerpt' ? 'p' : 'div';
                            bodyContent += `<${tag} class="${cssClass}${isFreePrice ? ' price-free' : ''}">${escapeHtml(val)}</${tag}>`;
                        }
                    });

                    bodyContent += '</div></a>';

                    // 不在卡片网格内部放置选择标记：即使标记跨列，也会把后续卡片推到新行，
                    // 尤其会破坏手机端的两列布局。广告可放在标题后、分类末尾和分类之间。
                    // 已保存的卡片间广告仍须预览，保持与导出结果一致。
                    if (i < cat.count - 1 && itemIndex + 1 < data.length) {
                        bodyContent += getAdCodeAt('cat-' + ci + '-between-' + i + '-' + (i + 1), pageType, adPlacements);
                    }
                }

                if (categories.length === 1) bodyContent += adLayoutTools.middleGridMarkup(getAdCodeAt('content-middle', pageType, adPlacements));
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

            bodyContent += TemplateLayouts.closeHome(config);
            if (isPlacingAds) bodyContent += genMarker('content-bottom', pageType);
            bodyContent += getAdCodeAt('content-bottom', pageType, adPlacements);
            if (config.structure.hasAllItemsPage && data.length > itemIndex) {
                bodyContent += `<div class="view-all-games"><a class="action-btn" href="#" data-preview-page="all">View All ${data.length} Games</a></div>`;
            }
            bodyContent += '</div></main>';
            if (isPlacingAds) bodyContent += genMarker('footer-top', pageType);
            bodyContent += getAdCodeAt('footer-top', pageType, adPlacements);
            bodyContent += generateFooter(config);

        } else if (pageType === 'all') {
            const getAllGamesPreviewAd = function() { return getAllGamesDetailAds(adPlacements, Array.from(arguments)); };
            bodyContent = generateNavbar(config, 'all');
            bodyContent += getAllGamesPreviewAd('after-navbar');
            bodyContent += '<main class="main-content"><div class="container">';
            bodyContent += getAllGamesPreviewAd('detail-before-content');
            const allGamesCards = data.map(function(item, index) {
                const title = escapeHtml(item[mapping.title] || 'Untitled');
                const image = escapeHtml(safeUrl(getPreviewImageSrc(item), true));
                let cardHtml = `<a class="item-card" href="#" data-preview-game-index="${index}" aria-label="Preview ${title} details">
                    ${image ? `<img class="card-image" src="${image}"${getImageFallbackAttr(item)} alt="${title}">` : ''}
                    <div class="card-body"><div class="card-title">${title}</div>`;
                config.structure.cardFields.forEach(function(field) {
                    if (field === 'image' || field === 'title') return;
                    const value = item[mapping[field]];
                    if (value === undefined || value === null) return;
                    const isFreePrice = field === 'price' && String(value).toLowerCase() === 'free';
                    const cssClass = field === 'content' || field === 'excerpt' ? 'card-desc' : ('card-' + field);
                    const tag = field === 'content' || field === 'excerpt' ? 'p' : 'div';
                    cardHtml += `<${tag} class="${cssClass}${isFreePrice ? ' price-free' : ''}">${escapeHtml(value)}</${tag}>`;
                });
                return cardHtml + '</div></a>';
            });
            bodyContent += '<section id="all-games" class="category-section"><h1 class="category-title">All Games</h1>';
            bodyContent += buildAllGamesCardGrid(adPlacements, allGamesCards);
            bodyContent += '</section>';
            bodyContent += '</div></main>';
            bodyContent += getAllGamesPreviewAd('detail-after-related', 'footer-top');
            bodyContent += generateFooter(config);

        } else if (pageType === 'detail') {
            // 详情页预览
            if (data.length === 0) return '<html><body><p>No data to preview</p></body></html>';

            const requestedPreviewIndex = Number(appState.selectedPreviewGameIndex);
            const previewItemIndex = Number.isInteger(requestedPreviewIndex) && requestedPreviewIndex >= 0 && requestedPreviewIndex < data.length
                ? requestedPreviewIndex
                : 0;
            const item = data[previewItemIndex];
            const title = escapeHtml(item[mapping.title] || 'Untitled');
            const image = escapeHtml(safeUrl(getPreviewImageSrc(item), true));
            const rawContent = item[mapping.content] || '';
            const renderedContent = config.structure.contentRender === 'markdown' ?
                simpleMarkdownToHtml(rawContent) :
                '<p>' + escapeHtml(rawContent).replace(/\n\n/g, '</p><p>') + '</p>';

            bodyContent = generateNavbar(config, 'detail');
            if (isPlacingAds) bodyContent += genMarker('after-navbar', pageType);
            bodyContent += getAdCodeAt('after-navbar', pageType, adPlacements);
            bodyContent += `<div class="detail-page">
                ${config.style.detailLayout === 'sidebar' ? '<div class="detail-main">' : ''}
                ${renderBackLink('#', config.structure.backLinkStyle, true)}
                ${image ? `<img class="detail-hero-image" src="${image}"${getImageFallbackAttr(item)} alt="${title}">` : ''}
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
                            <span class="meta-label">${escapeHtml(label)}</span>
                            <span class="meta-value${isFreePrice ? ' price-free' : ''}">${escapeHtml(val)}</span>
                        </div>`;
                    }
                });
                bodyContent += '</div>';
            }

            const previewGameUrl = safeUrl(item[mapping.store_url], true);
            if (previewGameUrl) {
                bodyContent += `<section class="game-stage">
                    <div class="game-stage-preview">${image ? `<img src="${image}"${getImageFallbackAttr(item)} alt="">` : ''}<span>PLAYABLE GAME FRAME</span></div>
                    <div class="game-stage-note"><span>导出后此处直接加载游戏</span><a href="#">Open game ↗</a></div>
                </section>`;
            }

            // 操作按钮
            if (config.structure.actionButtonEnabled && config.structure.actionButtonLinkField) {
                const actionUrl = item[mapping[config.structure.actionButtonLinkField]];
                const safeActionUrl = safeUrl(actionUrl, true);
                if (safeActionUrl) {
                    bodyContent += `<a class="action-btn" href="${escapeHtml(safeActionUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(config.structure.actionButtonText)}</a>`;
                }
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
                        bodyContent += getAdCodeAt('detail-between-p-' + pCount, pageType, adPlacements, renderedContent);
                    }
                }
            }

            if (isPlacingAds) bodyContent += genMarker('detail-after-content', pageType);
            bodyContent += getAdCodeAt('detail-after-content', pageType, adPlacements, renderedContent);

            if (isPlacingAds) bodyContent += genMarker('detail-before-related', pageType);
            bodyContent += getAdCodeAt('detail-before-related', pageType, adPlacements);

            bodyContent += `<div class="related-section">
                    <h2 class="related-title">You May Also Like</h2>
                    <div class="related-grid">`;

            // 相关推荐
            for (let i = 1; i <= Math.min(config.structure.relatedCount, data.length - 1); i++) {
                const relIndex = (previewItemIndex + i) % data.length;
                const relItem = data[relIndex];
                if (!relItem) continue;
                const relTitle = escapeHtml(relItem[mapping.title] || '');
                const relImage = escapeHtml(safeUrl(getPreviewImageSrc(relItem), true));
                let relFields = '';
                config.structure.relatedCardFields.forEach(field => {
                    if (field === 'image' || field === 'title') return;
                    const value = relItem[mapping[field]];
                    if (value !== undefined && value !== null && value !== '') {
                        relFields += `<div class="related-${escapeHtml(field)}">${escapeHtml(value)}</div>`;
                    }
                });
                bodyContent += `<a class="related-card" href="#" data-preview-game-index="${relIndex}" aria-label="Preview ${relTitle} details">
                    ${relImage ? `<img src="${relImage}"${getImageFallbackAttr(relItem)} alt="${relTitle}">` : ''}
                    <div class="related-info">
                        <div class="related-name">${relTitle}</div>
                        ${relFields}
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
                        for (let i = 1; i <= Math.min(config.structure.relatedCount, data.length - 1); i++) {
                            const relIndex = (previewItemIndex + i) % data.length;
                            const relItem = data[relIndex];
                            if (!relItem) continue;
                            const relTitle = escapeHtml(relItem[mapping.title] || '');
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
    ${_googleFontLink}
    <style>${css}</style>
</head>
<body class="layout-${escapeHtml(config.style.layoutTemplate || 'classic')}"${TemplateLayouts.bodyAttributes(config)}>${bodyContent}
<script>
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
        var gameCard = e.target.closest('[data-preview-game-index]');
        if (gameCard) {
            e.preventDefault();
            e.stopPropagation();
            window.parent.postMessage({ type: 'preview-game', index: Number(gameCard.dataset.previewGameIndex) }, '*');
            return;
        }
        var pageLink = e.target.closest('[data-preview-page]');
        if (pageLink) {
            e.preventDefault();
            window.parent.postMessage({ type: 'preview-nav', page: pageLink.dataset.previewPage }, '*');
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
            if (href.indexOf('contact') !== -1) page = 'contact';
            else if (href.indexOf('about') !== -1) page = 'about';
            else if (href.indexOf('privacy') !== -1) page = 'privacy';
            else if (href.indexOf('terms') !== -1) page = 'terms';
            else if (href.indexOf('all-games') !== -1) page = 'all';
            else if (href.indexOf('details') !== -1 || href.indexOf('article') !== -1) page = 'detail';
            window.parent.postMessage({ type: 'preview-nav', page: page }, '*');
        }
    });
</script>
</body>
</html>`;
    }

    // 公开接口
    return {
        exportWebsite: exportWebsite,
        generatePreviewHtml: generatePreviewHtml,
        buildConfig: buildConfig,
        generateSelectedAdJs: generateSelectedAdJs
    };
})();
