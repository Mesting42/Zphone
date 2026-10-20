/**
 * 网站生成与导出模块
 * 负责根据配置生成所有网站文件并打包导出
 */

const Generator = (function() {

    // 模块级变量：Google Fonts链接（由generateCSS计算，供HTML生成使用）
    var _googleFontLink = '';

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
        adv1: '<div id="adv1" style="text-align:center;padding:10px;display:flex;flex-direction:column;align-items:center;overflow:hidden;margin-top:1px;"><div style="text-align:center;color:black;font-size:13px;">advertisement</div><div id="div-gpt-ad-banner1" style="min-width:300px;min-height:250px;"></div></div>',
        adv2: '<div id="adv2" style="text-align:center;padding:10px;display:flex;flex-direction:column;align-items:center;overflow:hidden;margin-top:1px;"><div style="text-align:center;color:black;font-size:13px;">advertisement</div><div id="div-gpt-ad-banner2" style="min-width:300px;min-height:250px;"></div></div>',
        adv3: '<div id="adv3" style="text-align:center;padding:10px;display:flex;flex-direction:column;align-items:center;overflow:hidden;margin-top:1px;"><div style="text-align:center;color:black;font-size:13px;">advertisement</div><div id="div-gpt-ad-banner3" style="min-width:300px;min-height:250px;"></div></div>'
    };

    // ========== 生成 ad.js ==========
    function generateAdJs(adPaths) {
        var p = adPaths || {};
        return `const bannerPath1 = "${p.bannerPath1 || ''}";
const bannerPath2 = "${p.bannerPath2 || ''}";
const bannerPath3 = "${p.bannerPath3 || ''}";
const bannerPath4 = "${p.bannerPath4 || ''}";
const interstitialPath = "${p.interstitialPath || ''}";
const anchorPath = "${p.anchorPath || ''}";
const analyticsID = "${p.analyticsID || ''}";

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
   浏览器 load 后开始监控广告位进入视口
--------------------------------*/
window.addEventListener('load', function () {

    delayLoadBanner("bannerSlot1", bannerPath1, "div-gpt-ad-banner1");
    delayLoadBanner("bannerSlot2", bannerPath2, "div-gpt-ad-banner2");
    delayLoadBanner("bannerSlot3", bannerPath3, "div-gpt-ad-banner3");

    if (bannerPath4 && document.getElementById('div-gpt-ad-banner4')) {
        console.log("[Display] banner4 正常加载 display()");
        googletag.cmd.push(() => googletag.display("div-gpt-ad-banner4"));
    }
});

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
    --card-image-height: ${style.cardImageHeight || '180px'};
    --content-max-width: ${style.contentMaxWidth === 'full' ? '100%' : (style.contentMaxWidth || '1200px')};
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: ${fontFamily};
    background: var(--color-bg);
    color: var(--color-text);
    line-height: 1.6;
    min-height: 100vh;
    ${style.navbarStyle === 'bottom-fixed' ? 'padding-bottom: var(--navbar-height);' : ''}
    ${style.navbarStyle === 'transparent' || style.navbarStyle === 'dark-fixed' ? 'padding-top: var(--navbar-height);' : ''}
}

a { color: var(--color-primary); text-decoration: none; transition: color var(--transition-speed); }
a:hover { opacity: 0.85; }

img { max-width: 100%; height: auto; }

.container { max-width: var(--content-max-width); margin: 0 auto; padding: 0 20px; }

/* 导航栏 */
.navbar {
    background: var(--navbar-bg);
    height: var(--navbar-height);
    position: relative;
    z-index: 1000;
}

.navbar .container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 100%;
}

.navbar.glass-sticky {
    position: sticky;
    top: 0;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
}

.navbar.dark-fixed {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: var(--color-bg);
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
}

.navbar.transparent {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    background: transparent;
}

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

.navbar.bottom-fixed {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    box-shadow: 0 -2px 10px rgba(0,0,0,0.3);
}

.navbar .logo {
    font-size: 22px;
    font-weight: 700;
    color: var(--color-primary);
}

.navbar .nav-links {
    display: flex;
    list-style: none;
    gap: 24px;
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

.back-link.breadcrumb { font-size: 13px; }
.back-link.button {
    padding: 8px 16px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
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
    .navbar {
        position: sticky;
        top: 0;
    }

    .navbar .nav-links {
        position: fixed;
        top: var(--navbar-height);
        left: 0;
        right: 0;
        background: var(--color-bg);
        flex-direction: column;
        padding: 20px;
        gap: 12px;
        display: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 1001;
    }

    .navbar .nav-links.active {
        display: flex;
    }

    .navbar .hamburger {
        display: block;
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
        -webkit-line-clamp: 2;
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
        -webkit-line-clamp: 1;
    }
    .item-card .card-desc {
        display: none;
    }
    .item-card .card-genres,
    .item-card .card-cuisine {
        font-size: 9px;
    }
    .item-card .card-price {
        font-size: 10px;
    }
}
`;
    }

    // ========== 生成导航栏HTML ==========
    function generateNavbar(config) {
        const theme = config.theme;
        const navLinks = config.structure.navLinks;
        const navbarClass = config.style.navbarStyle === 'glass-sticky' ? 'glass-sticky' :
                           config.style.navbarStyle === 'dark-fixed' ? 'dark-fixed' :
                           config.style.navbarStyle === 'transparent' ? 'transparent' :
                           config.style.navbarStyle === 'side-drawer' ? 'side-drawer' :
                           config.style.navbarStyle === 'bottom-fixed' ? 'bottom-fixed' : '';

        const logoHtml = config.style.logoStyle === 'icon' ?
            `<a href="index.html" class="logo">${theme.logoText.charAt(0)}</a>` :
            config.style.logoStyle === 'text-icon' ?
            `<a href="index.html" class="logo">🌐 ${theme.logoText}</a>` :
            config.style.logoStyle === 'gradient-text' ?
            `<a href="index.html" class="logo" style="background: linear-gradient(135deg, var(--color-primary), var(--color-text)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">${theme.logoText}</a>` :
            config.style.logoStyle === 'boxed' ?
            `<a href="index.html" class="logo" style="border: 2px solid var(--color-primary); padding: 4px 12px; border-radius: 6px;">${theme.logoText}</a>` :
            `<a href="index.html" class="logo">${theme.logoText}</a>`;

        let linksHtml = '';
        if (navLinks.includes('home')) linksHtml += `<li><a href="index.html">Home</a></li>`;
        if (navLinks.includes('privacy')) linksHtml += `<li><a href="privacy.html">Privacy Policy</a></li>`;
        if (navLinks.includes('terms')) linksHtml += `<li><a href="terms.html">Terms of Service</a></li>`;
        if (navLinks.includes('contact')) linksHtml += `<li><a href="contact.html">Contact Us</a></li>`;
        if (navLinks.includes('about')) linksHtml += `<li><a href="about.html">About Us</a></li>`;

        const drawerLinksHtml = linksHtml; // reuse the same links for drawer

        return `<nav class="navbar ${navbarClass}">
    <div class="container">
        ${logoHtml}
        <ul class="nav-links">
            ${linksHtml}
        </ul>
        <button class="hamburger" aria-label="Toggle navigation">
            <span></span><span></span><span></span>
        </button>
    </div>
</nav>
${config.style.navbarStyle === 'side-drawer' ? `
<div class="drawer-overlay"></div>
<div class="side-drawer-panel">
    <div class="drawer-header">
        <a href="index.html" class="drawer-logo">${theme.logoText}</a>
        <button class="drawer-close" aria-label="Close menu">&times;</button>
    </div>
    <ul class="drawer-nav">
        ${drawerLinksHtml}
    </ul>
</div>` : ''}`;
    }

    // ========== 生成页脚HTML ==========
    function generateFooter(config) {
        const theme = config.theme;
        const siteName = theme.siteTitle;

        if (config.structure.footerStyle === 'simple') {
            const links = [];
            if (config.structure.navLinks.includes('privacy')) links.push('<li><a href="privacy.html">Privacy Policy</a></li>');
            if (config.structure.navLinks.includes('terms')) links.push('<li><a href="terms.html">Terms of Service</a></li>');
            if (config.structure.navLinks.includes('contact')) links.push('<li><a href="contact.html">Contact Us</a></li>');
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
                    ${config.structure.navLinks.includes('about') ? '<li><a href="about.html">About Us</a></li>' : ''}
                    ${config.structure.navLinks.includes('contact') ? '<li><a href="contact.html">Contact Us</a></li>' : ''}
                </ul>
            </div>
            <div class="footer-section">
                <h3>Legal</h3>
                <ul class="footer-links">
                    ${config.structure.navLinks.includes('privacy') ? '<li><a href="privacy.html">Privacy Policy</a></li>' : ''}
                    ${config.structure.navLinks.includes('terms') ? '<li><a href="terms.html">Terms of Service</a></li>' : ''}
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
    function generateIndexHtml(config) {
        const theme = config.theme;
        const siteName = theme.siteTitle;
        const navbar = generateNavbar(config);
        const footer = generateFooter(config);
        const adPlacements = config.adPlacements || {};

        // 获取首页静态位置广告（容器外部的位置）
        function getHomeAd(position) {
            let code = '';
            for (const [adId, pages] of Object.entries(adPlacements)) {
                if (pages && pages.home === position) {
                    code += AD_TEMPLATES[adId] || '';
                }
            }
            return code;
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
        <section class="category-section">
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
        // 内容区底部广告
        categoriesHtml += '\n' + getHomeAd('content-bottom');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${siteName}</title>
    <meta name="description" content="${theme.siteSubtitle}">
    <script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js" crossorigin="anonymous"></script>
    <script defer src="js/script.js"></script>
    <script defer src="js/ad.js"></script>
    ${_googleFontLink}
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    ${navbar}
    ${getHomeAd('after-navbar')}
    ${heroHtml}
    ${getHomeAd('after-hero')}
    <main class="main-content">
        <div class="container">
            ${categoriesHtml}
        </div>
    </main>
    ${getHomeAd('footer-top')}
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
        const fieldMappingStr = JSON.stringify(config.fieldMapping || {});

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
        fieldMapping: ${fieldMappingStr},
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
            html += '<img class="card-image" src="' + item[CONFIG.imageField] + '" alt="' + (item.title || '') + '" loading="lazy">';
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
                html += '<div class="card-title">' + val + '</div>';
            } else if (field === 'excerpt' || field === 'content') {
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
            }
        }
    }

    // 汉堡菜单交互
    function initNavbar() {
        var hamburger = document.querySelector('.hamburger');
        var navLinks = document.querySelector('.nav-links');
        if (hamburger && navLinks) {
            hamburger.addEventListener('click', function() {
                navLinks.classList.toggle('active');
                hamburger.classList.toggle('active');
            });
            var links = navLinks.querySelectorAll('a');
            for (var i = 0; i < links.length; i++) {
                links[i].addEventListener('click', function() {
                    navLinks.classList.remove('active');
                    hamburger.classList.remove('active');
                });
            }
        }
        // 侧边抽屉交互
        var drawerPanel = document.querySelector('.side-drawer-panel');
        var drawerOverlay = document.querySelector('.drawer-overlay');
        var drawerClose = document.querySelector('.drawer-close');
        if (drawerPanel) {
            function openDrawer() {
                drawerPanel.classList.add('open');
                if (drawerOverlay) drawerOverlay.classList.add('active');
            }
            function closeDrawer() {
                drawerPanel.classList.remove('open');
                if (drawerOverlay) drawerOverlay.classList.remove('active');
            }
            if (hamburger) hamburger.addEventListener('click', openDrawer);
            if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
            if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);
            var dLinks = drawerPanel.querySelectorAll('a');
            for (var j = 0; j < dLinks.length; j++) {
                dLinks[j].addEventListener('click', closeDrawer);
            }
        }
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

    // ========== 生成详情页HTML ==========
    function generateDetailHtml(item, index, allItems, config) {
        const theme = config.theme;
        const style = config.style;
        const mapping = config.fieldMapping;
        const itemId = getItemId(item, index);
        const siteName = theme.siteTitle;

        const navbar = generateNavbar(config).replace(/href="([^"]*)"/g, function(match, href) {
            return 'href="../' + href + '"';
        });

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

        // 返回链接样式
        const backLinkClass = config.structure.backLinkStyle === 'breadcrumb' ? 'breadcrumb' :
                             config.structure.backLinkStyle === 'button' ? 'button' : '';
        const backLinkText = '← Back to Home';

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
            return code;
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
    <script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js" crossorigin="anonymous"></script>
    <script defer src="../js/ad.js"></script>
    ${_googleFontLink}
    <link rel="stylesheet" href="../css/style.css">
</head>
<body>
    ${navbar}
    ${getDetailAd('after-navbar')}
    <div class="detail-page">
        ${style.detailLayout === 'sidebar' ? '<div class="detail-main">' : ''}
        <a href="../index.html" class="back-link ${backLinkClass}">${backLinkText}</a>
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
    (function() {
        var hamburger = document.querySelector('.hamburger');
        var navLinks = document.querySelector('.nav-links');
        if (hamburger && navLinks) {
            hamburger.addEventListener('click', function() {
                navLinks.classList.toggle('active');
            });
        }
        var drawerPanel = document.querySelector('.side-drawer-panel');
        var drawerOverlay = document.querySelector('.drawer-overlay');
        var drawerClose = document.querySelector('.drawer-close');
        if (drawerPanel) {
            if (hamburger) hamburger.addEventListener('click', function() { drawerPanel.classList.add('open'); if (drawerOverlay) drawerOverlay.classList.add('active'); });
            if (drawerClose) drawerClose.addEventListener('click', function() { drawerPanel.classList.remove('open'); if (drawerOverlay) drawerOverlay.classList.remove('active'); });
            if (drawerOverlay) drawerOverlay.addEventListener('click', function() { drawerPanel.classList.remove('open'); drawerOverlay.classList.remove('active'); });
        }
    })();
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
                <p>📧 ${pages.email}</p>
                <p>📍 ${pages.address}</p>
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
            <p>📧 ${pages.email}</p>
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
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    ${navbar}
    ${generateContactBody(config)}
    ${footer}
    <script>
    (function() {
        var hamburger = document.querySelector('.hamburger');
        var navLinks = document.querySelector('.nav-links');
        if (hamburger && navLinks) {
            hamburger.addEventListener('click', function() { navLinks.classList.toggle('active'); });
        }
        var drawerPanel = document.querySelector('.side-drawer-panel');
        var drawerOverlay = document.querySelector('.drawer-overlay');
        var drawerClose = document.querySelector('.drawer-close');
        if (drawerPanel) {
            if (hamburger) hamburger.addEventListener('click', function() { drawerPanel.classList.add('open'); if (drawerOverlay) drawerOverlay.classList.add('active'); });
            if (drawerClose) drawerClose.addEventListener('click', function() { drawerPanel.classList.remove('open'); if (drawerOverlay) drawerOverlay.classList.remove('active'); });
            if (drawerOverlay) drawerOverlay.addEventListener('click', function() { drawerPanel.classList.remove('open'); drawerOverlay.classList.remove('active'); });
        }
    })();
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
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    ${navbar}
    ${generateAboutBody(config)}
    ${footer}
    <script>
    (function() {
        var hamburger = document.querySelector('.hamburger');
        var navLinks = document.querySelector('.nav-links');
        if (hamburger && navLinks) {
            hamburger.addEventListener('click', function() { navLinks.classList.toggle('active'); });
        }
        var drawerPanel = document.querySelector('.side-drawer-panel');
        var drawerOverlay = document.querySelector('.drawer-overlay');
        var drawerClose = document.querySelector('.drawer-close');
        if (drawerPanel) {
            if (hamburger) hamburger.addEventListener('click', function() { drawerPanel.classList.add('open'); if (drawerOverlay) drawerOverlay.classList.add('active'); });
            if (drawerClose) drawerClose.addEventListener('click', function() { drawerPanel.classList.remove('open'); if (drawerOverlay) drawerOverlay.classList.remove('active'); });
            if (drawerOverlay) drawerOverlay.addEventListener('click', function() { drawerPanel.classList.remove('open'); drawerOverlay.classList.remove('active'); });
            var dLinks = drawerPanel.querySelectorAll('.drawer-nav a');
            for (var i = 0; i < dLinks.length; i++) {
                dLinks[i].addEventListener('click', function() { drawerPanel.classList.remove('open'); if (drawerOverlay) drawerOverlay.classList.remove('active'); });
            }
        }
    })();
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
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    ${navbar}
    ${generatePrivacyBody(config)}
    ${footer}
    <script>
    (function() {
        var hamburger = document.querySelector('.hamburger');
        var navLinks = document.querySelector('.nav-links');
        if (hamburger && navLinks) {
            hamburger.addEventListener('click', function() { navLinks.classList.toggle('active'); });
        }
        var drawerPanel = document.querySelector('.side-drawer-panel');
        var drawerOverlay = document.querySelector('.drawer-overlay');
        var drawerClose = document.querySelector('.drawer-close');
        if (drawerPanel) {
            if (hamburger) hamburger.addEventListener('click', function() { drawerPanel.classList.add('open'); if (drawerOverlay) drawerOverlay.classList.add('active'); });
            if (drawerClose) drawerClose.addEventListener('click', function() { drawerPanel.classList.remove('open'); if (drawerOverlay) drawerOverlay.classList.remove('active'); });
            if (drawerOverlay) drawerOverlay.addEventListener('click', function() { drawerPanel.classList.remove('open'); drawerOverlay.classList.remove('active'); });
        }
    })();
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
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    ${navbar}
    ${generateTermsBody(config)}
    ${footer}
    <script>
    (function() {
        var hamburger = document.querySelector('.hamburger');
        var navLinks = document.querySelector('.nav-links');
        if (hamburger && navLinks) {
            hamburger.addEventListener('click', function() { navLinks.classList.toggle('active'); });
        }
        var drawerPanel = document.querySelector('.side-drawer-panel');
        var drawerOverlay = document.querySelector('.drawer-overlay');
        var drawerClose = document.querySelector('.drawer-close');
        if (drawerPanel) {
            if (hamburger) hamburger.addEventListener('click', function() { drawerPanel.classList.add('open'); if (drawerOverlay) drawerOverlay.classList.add('active'); });
            if (drawerClose) drawerClose.addEventListener('click', function() { drawerPanel.classList.remove('open'); if (drawerOverlay) drawerOverlay.classList.remove('active'); });
            if (drawerOverlay) drawerOverlay.addEventListener('click', function() { drawerPanel.classList.remove('open'); drawerOverlay.classList.remove('active'); });
        }
    })();
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
    theme_kw = {'tech': 'technology, AI, software', 'game': 'gaming, games, review',
                'food': 'recipe, cooking, food', 'anime': 'anime, series, review'}
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

        // CSS
        siteFolder.folder('css').file('style.css', generateCSS(config));
        onProgress(15, '正在生成首页...');

        // index.html
        siteFolder.file('index.html', generateIndexHtml(config));

        onProgress(25, '正在生成script.js...');

        // script.js
        siteFolder.folder('js').file('script.js', generateScriptJs(config));

        // ad.js
        siteFolder.folder('js').file('ad.js', generateAdJs(appState.config.adPaths));

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

        // Python脚本
        onProgress(92, '正在生成Python脚本...');
        siteFolder.file('generate_details.py', generatePythonScript(config));

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
    function buildConfig(appState) {
        const theme = THEMES[appState.selectedTheme];
        const mapping = appState.fieldMapping;

        return {
            theme: theme,
            fieldMapping: mapping,
            structure: {
                navLinks: appState.config.navLinks || ['home', 'privacy', 'terms', 'contact', 'about'],
                navbarLayout: appState.config.navbarLayout || 'normal',
                footerStyle: appState.config.footerStyle || 'simple',
                backLinkStyle: appState.config.backLinkStyle || 'text',
                heroEnabled: appState.config.heroEnabled || false,
                heroTitle: appState.config.heroTitle || theme.hero.title,
                heroSubtitle: appState.config.heroSubtitle || theme.hero.subtitle,
                categories: appState.config.categories || theme.categories,
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
                cardHover: appState.config.cardHover || 'float',
                cardBorder: appState.config.cardBorder || 'rounded',
                cardRadius: appState.config.cardRadius || '8px',
                cardSpacing: appState.config.cardSpacing || '20px',
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
                cardViewMode: appState.config.cardViewMode || 'card',
                cardDescLines: appState.config.cardDescLines || '2'
            },
            adPlacements: appState.config.adPlacements || {},
            adPlacementMode: appState.adPlacementMode || null,
            isLocalImages: appState.isLocalImages || false
        };
    }

    // ========== 生成预览HTML ==========
    function generatePreviewHtml(appState, pageType) {
        const config = buildConfig(appState);
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

        // 广告标记生成器（仅放置模式）
        function genMarker(position, page) {
            return '<div class="insert-marker" data-position="' + position + '" data-page="' + page + '" title="点击放置广告">＋ 点击放置广告</div>';
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
            return code;
        }

        // 生成CSS
        let css = generateCSS(config);

        // 放置模式下添加标记样式
        if (isPlacingAds) {
            css += `
.insert-marker {
    height: 6px; margin: 2px 0; cursor: pointer; transition: all 0.2s; border-radius: 2px;
    overflow: hidden; text-indent: -9999px; font-size: 0;
}
.insert-marker:hover {
    height: 36px; border: 2px dashed var(--color-primary, #4a9eff); border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    color: var(--color-primary, #4a9eff); font-size: 13px; text-indent: 0;
    background: rgba(74, 158, 255, 0.08); margin: 4px 0;
}
.insert-marker.active-highlight {
    height: 36px; border: 2px solid var(--color-primary, #4a9eff); border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 13px; text-indent: 0;
    background: rgba(74, 158, 255, 0.3); margin: 4px 0;
}`;
        }

        let bodyContent = '';

        if (pageType === 'home') {
            // 首页预览
            bodyContent = generateNavbar(config);
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

            bodyContent += '<main class="main-content"><div class="container">';
            if (isPlacingAds) bodyContent += genMarker('content-top', pageType);
            bodyContent += getAdCodeAt('content-top', pageType, adPlacements);

            // 用前几条数据渲染预览
            const categories = config.structure.categories;
            let itemIndex = 0;
            categories.forEach((cat, ci) => {
                bodyContent += `<section class="category-section">
                    <h2 class="category-title">${cat.icon} ${cat.name}</h2>`;
                if (isPlacingAds) bodyContent += genMarker('cat-' + ci + '-after-title', pageType);
                bodyContent += getAdCodeAt('cat-' + ci + '-after-title', pageType, adPlacements);
                bodyContent += '<div class="items-grid">';

                for (let i = 0; i < cat.count && itemIndex < data.length; i++, itemIndex++) {
                    const item = data[itemIndex];
                    const title = item[mapping.title] || 'Untitled';
                    const image = getPreviewImageSrc(item);

                    bodyContent += `<a class="item-card" href="#">
                        ${image ? `<img class="card-image" src="${image}" alt="${title}">` : ''}
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
                            bodyContent += `<${tag} class="${cssClass}${isFreePrice ? ' price-free' : ''}">${val}</${tag}>`;
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
            bodyContent += '</div></main>';
            if (isPlacingAds) bodyContent += genMarker('footer-top', pageType);
            bodyContent += getAdCodeAt('footer-top', pageType, adPlacements);
            bodyContent += generateFooter(config);

        } else if (pageType === 'detail') {
            // 详情页预览
            if (data.length === 0) return '<html><body><p>No data to preview</p></body></html>';

            const item = data[0];
            const title = item[mapping.title] || 'Untitled';
            const image = getPreviewImageSrc(item);
            const rawContent = item[mapping.content] || '';
            const renderedContent = config.structure.contentRender === 'markdown' ?
                simpleMarkdownToHtml(rawContent) :
                '<p>' + rawContent.replace(/\n\n/g, '</p><p>') + '</p>';

            bodyContent = generateNavbar(config);
            if (isPlacingAds) bodyContent += genMarker('after-navbar', pageType);
            bodyContent += getAdCodeAt('after-navbar', pageType, adPlacements);
            bodyContent += `<div class="detail-page">
                ${config.style.detailLayout === 'sidebar' ? '<div class="detail-main">' : ''}
                <a href="#" class="back-link">← Back to Home</a>
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
            if (config.structure.actionButtonEnabled && config.structure.actionButtonLinkField) {
                const actionUrl = item[mapping[config.structure.actionButtonLinkField]];
                if (actionUrl) {
                    bodyContent += `<a class="action-btn" href="${actionUrl}" target="_blank">${config.structure.actionButtonText}</a>`;
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
    var hamburger = document.querySelector('.hamburger');
    var navLinks = document.querySelector('.nav-links');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function() { navLinks.classList.toggle('active'); });
    }
    var drawerPanel = document.querySelector('.side-drawer-panel');
    var drawerOverlay = document.querySelector('.drawer-overlay');
    var drawerClose = document.querySelector('.drawer-close');
    if (drawerPanel) {
        if (hamburger) hamburger.addEventListener('click', function() { drawerPanel.classList.add('open'); if (drawerOverlay) drawerOverlay.classList.add('active'); });
        if (drawerClose) drawerClose.addEventListener('click', function() { drawerPanel.classList.remove('open'); if (drawerOverlay) drawerOverlay.classList.remove('active'); });
        if (drawerOverlay) drawerOverlay.addEventListener('click', function() { drawerPanel.classList.remove('open'); drawerOverlay.classList.remove('active'); });
    }
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
            var page = 'home';
            if (href.indexOf('contact') !== -1) page = 'contact';
            else if (href.indexOf('about') !== -1) page = 'about';
            else if (href.indexOf('privacy') !== -1) page = 'privacy';
            else if (href.indexOf('terms') !== -1) page = 'terms';
            else if (href.indexOf('details') !== -1 || href.indexOf('article') !== -1) page = 'detail';
            window.parent.postMessage({ type: 'preview-nav', page: page }, '*');
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
        buildConfig: buildConfig
    };
})();
