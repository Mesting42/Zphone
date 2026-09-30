/**
 * 两套工作台共用的导航宽度适配器。
 * 只处理标题、菜单间距与折叠状态；广告、页面内容及链接行为由原生成器负责。
 * script() 输出自包含脚本，导出站点不需要额外加载本工具的模块。
 */
(function(root) {
    'use strict';

    function css() {
        return `
/* 标题始终参与宽度分配，避免居中菜单覆盖绝对定位的品牌标题。 */
.navbar { --nav-brand-gap: clamp(24px, 3vw, 48px); }
.navbar .container,
.navbar.navbar-left .container { column-gap: var(--nav-brand-gap); min-width: 0; }
.navbar .logo { flex: 0 0 auto; white-space: nowrap; }
.navbar .nav-links { flex: 0 0 auto; flex-wrap: nowrap; white-space: nowrap; }
.navbar .nav-links li { flex: 0 0 auto; }
.navbar.navbar-centered:not(.nav-collapsed):not(.side-drawer) .container {
    display: grid;
    grid-template-columns: minmax(0, 1fr) max-content minmax(0, 1fr);
    column-gap: var(--nav-brand-gap);
}
.navbar.navbar-centered:not(.nav-collapsed):not(.side-drawer) .logo {
    position: static; left: auto; justify-self: start; grid-column: 1;
}
.navbar.navbar-centered:not(.nav-collapsed):not(.side-drawer) .nav-links {
    grid-column: 2; margin-inline: 0;
}
/* 先压缩链接之间的空白及较大的按钮内边距，保留模板字体和字号。 */
.navbar.nav-compact .nav-links { column-gap: var(--nav-compact-gap, 10px); }
.navbar.nav-compact .nav-links a {
    padding-left: var(--nav-compact-left, 0px);
    padding-right: var(--nav-compact-right, 0px);
}
/* 放不下时，任意视口宽度都使用同一套可展开菜单。 */
.navbar.nav-collapsed .container {
    display: flex; position: relative; justify-content: space-between !important;
    column-gap: 24px; padding-right: 20px;
}
.navbar.nav-collapsed .logo {
    position: static; left: auto; display: block; min-width: 0;
    max-width: calc(100% - 68px); overflow: hidden; text-overflow: ellipsis;
}
.navbar.nav-collapsed .hamburger {
    display: block; position: static; flex: 0 0 44px;
    width: 44px; min-height: 44px; padding: 10px;
    margin: 0 0 0 auto !important; transform: none;
}
.navbar.nav-collapsed .nav-links {
    display: none; position: absolute; top: 100%; left: 0; right: 0;
    width: auto; height: auto; min-width: 0; margin: 0; padding: 12px;
    flex-direction: column; align-items: stretch; gap: 4px;
    max-height: min(70vh, calc(100vh - var(--navbar-height) - 16px));
    overflow-y: auto; overscroll-behavior: contain;
    background: var(--color-bg); color: var(--color-text);
    border: 1px solid var(--color-border); border-radius: 0 0 12px 12px;
    box-shadow: 0 6px 18px rgba(0,0,0,.16); z-index: 1001;
}
.navbar.nav-collapsed .nav-links.active { display: flex; }
.navbar.nav-collapsed .nav-links li { width: 100%; height: auto; }
.navbar.nav-collapsed .nav-links a {
    display: block; width: 100%; height: auto; min-height: 44px;
    padding: 12px; white-space: normal; overflow-wrap: anywhere;
    text-align: left; border-right: 0;
}
.navbar .hamburger:focus-visible, .navbar .nav-links a:focus-visible {
    outline: 2px solid var(--color-primary); outline-offset: 3px;
}
/* 测量节点不可见、不进入可访问性树，也不占据页面或广告的空间。 */
.navbar.nav-sizing {
    position: fixed !important; left: -100000px !important; right: auto !important;
    top: 0 !important; margin: 0 !important; visibility: hidden !important;
    pointer-events: none !important; transform: none !important;
}
.navbar.nav-sizing .logo { max-width: none; }
`;
    }

    // 此函数序列化后在预览和导出页面中运行，不能引用工具侧的变量。
    function initialize() {
        var navbar = document.querySelector('.navbar');
        if (!navbar || navbar.dataset.navFitReady) return;
        navbar.dataset.navFitReady = 'true';
        var container = navbar.querySelector('.container');
        var logo = navbar.querySelector('.logo');
        var links = navbar.querySelector('.nav-links');
        var toggle = navbar.querySelector('.hamburger');
        if (!container || !logo || !toggle) return;
        var frame = 0;
        var observedWidth = -1;

        function pixels(value) { return parseFloat(value) || 0; }
        function setMode(compact, collapsed) {
            var changed = navbar.classList.contains('nav-collapsed') !== collapsed;
            var active = document.activeElement;
            navbar.classList.toggle('nav-compact', compact);
            navbar.classList.toggle('nav-collapsed', collapsed);
            if (changed && links) {
                links.classList.remove('active');
                toggle.setAttribute('aria-expanded', 'false');
                // 折叠导致焦点所在链接被隐藏时，将焦点移到菜单按钮。
                if (collapsed && links.contains(active)) toggle.focus();
                if (!collapsed && active === toggle) logo.focus();
            }
        }
        function fit() {
            frame = 0;
            if (!navbar.isConnected || !container.clientWidth) return;
            if (!links || navbar.classList.contains('side-drawer')) {
                setMode(false, true);
                return;
            }
            if (window.matchMedia('(max-width: 768px)').matches) {
                setMode(false, true);
                return;
            }

            // 通过不可见副本测量实际字体，避免展开/收起真实菜单造成闪烁或丢失焦点。
            var probe = navbar.cloneNode(true);
            probe.classList.remove('nav-compact', 'nav-collapsed');
            probe.classList.add('nav-sizing');
            probe.setAttribute('aria-hidden', 'true');
            probe.setAttribute('inert', '');
            probe.removeAttribute('id');
            probe.querySelectorAll('[id]').forEach(function(node) { node.removeAttribute('id'); });
            probe.style.width = navbar.getBoundingClientRect().width + 'px';
            var probeLinks = probe.querySelector('.nav-links');
            probeLinks.classList.remove('active');
            document.body.appendChild(probe);
            try {
                var probeContainer = probe.querySelector('.container');
                var probeLogo = probe.querySelector('.logo');
                var containerStyle = getComputedStyle(probeContainer);
                var width = probeContainer.clientWidth - pixels(containerStyle.paddingLeft) - pixels(containerStyle.paddingRight);
                var gap = pixels(containerStyle.columnGap);
                var logoWidth = probeLogo.getBoundingClientRect().width;
                var centered = navbar.classList.contains('navbar-centered');
                function fits() {
                    var linkStyle = getComputedStyle(probeLinks);
                    var menuWidth = probeLinks.getBoundingClientRect().width + pixels(linkStyle.marginLeft) + pixels(linkStyle.marginRight);
                    // 居中布局给左右两侧留出相同宽度，标题不会进入菜单的区域。
                    var required = menuWidth + (centered ? 2 : 1) * (logoWidth + gap);
                    return required <= width - 2;
                }
                if (fits()) {
                    setMode(false, false);
                    return;
                }
                var compactGap = Math.min(10, pixels(getComputedStyle(probeLinks).columnGap)) + 'px';
                probe.style.setProperty('--nav-compact-gap', compactGap);
                navbar.style.setProperty('--nav-compact-gap', compactGap);
                var anchors = links.querySelectorAll('a');
                probeLinks.querySelectorAll('a').forEach(function(anchor, index) {
                    var style = getComputedStyle(anchor);
                    ['Left', 'Right'].forEach(function(side) {
                        var property = '--nav-compact-' + side.toLowerCase();
                        var padding = Math.min(8, pixels(style['padding' + side])) + 'px';
                        anchor.style.setProperty(property, padding);
                        if (anchors[index]) anchors[index].style.setProperty(property, padding);
                    });
                });
                probe.classList.add('nav-compact');
                setMode(true, !fits());
            } finally {
                probe.remove();
            }
        }
        function queueFit() {
            if (!frame) frame = window.requestAnimationFrame(fit);
        }
        fit();
        window.addEventListener('resize', queueFit, { passive: true });
        if (window.ResizeObserver) {
            new ResizeObserver(function(entries) {
                var width = entries[0].contentRect.width;
                if (Math.abs(width - observedWidth) > 0.5) {
                    observedWidth = width;
                    queueFit();
                }
            }).observe(container);
        }
        // 字体下载完成后重算，兼容等宽、像素等字宽差异明显的模板。
        if (document.fonts) {
            document.fonts.ready.then(queueFit);
            if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', queueFit);
        }
    }

    function script() { return '(' + initialize.toString() + ')();'; }
    root.NavbarLayout = Object.freeze({ css: css, script: script });
})(typeof globalThis !== 'undefined' ? globalThis : this);
