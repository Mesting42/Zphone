const bannerPath1 = "/23335045480/zpau23b.vizocean.top-banner1";
const bannerPath2 = "/23335045480/zpau23b.vizocean.top-banner2";
const bannerPath3 = "/23335045480/zpau23b.vizocean.top-banner3";
const bannerPath4 = "/23335045480/zpau23b.vizocean.top-banner3";
const interstitialPath = "/23335045480/zpau23b.vizocean.top-INT";
const anchorPath = "/23335045480/zpau23b.vizocean.top-ANC";
const analyticsID = "G-Y1EHMY57V7";


var bannerSlot1, bannerSlot2, bannerSlot3, bannerSlot4;
var interstitialSlot, anchorSlot;

var isIndex = (window.location.pathname === '/' || window.location.pathname === '/index.html');
// Use path segments instead of a slash-delimited regular expression so generated ad.js stays valid JavaScript.
var detailPathSegments = window.location.pathname.toLowerCase().split('/');
var isDetail = detailPathSegments.indexOf('detail') !== -1 ||
    detailPathSegments.indexOf('details') !== -1 ||
    detailPathSegments.indexOf('article') !== -1 ||
    detailPathSegments.indexOf('articles') !== -1;
const adPolicy = null;

function isAdPolicyEnabled(kind) {
    if (!adPolicy) return kind === 'interstitial' ? isIndex : true;
    if (isIndex) return !!adPolicy[kind].home;
    if (isDetail) return !!adPolicy[kind].detail;
    return false;
}

window.googletag = window.googletag || { cmd: [] };

/* -------------------------------
   专业延迟加载广告模块
--------------------------------*/
function delayLoadBanner(slotName, slotPath, domId, size = [300, 250]) {
    const element = document.getElementById(domId);
    if (!element || !slotPath) return;

    let hasDefined = false;
    let hasDisplayed = false;

    console.log(`[LazyLoad] 初始化监控: ${slotName}`);

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {

                if (!hasDefined) {
                    console.log(`[LazyLoad] ${slotName} 进入视口，定义广告位...`);

                    googletag.cmd.push(function () {
                        window[slotName] = googletag.defineSlot(slotPath, size, domId)
                            .addService(googletag.pubads());
                        console.log(`[LazyLoad] ${slotName} 已定义`);
                    });

                    hasDefined = true;
                }

                if (!hasDisplayed) {
                    console.log(`[LazyLoad] ${slotName} 第一次 display()，请求广告...`);

                    googletag.cmd.push(function () {
                        googletag.display(domId);
                        console.log(`[LazyLoad] ${slotName} display() 完成`);
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
   DOM 可用后开始监控广告位进入视口
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
    gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${analyticsID}`;
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
}