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

/* Menu motion owns only visibility and feedback. Template colors, spacing,
 * borders and placement continue to come from their existing navigation skin. */
.navbar { --menu-enter-ms:240; --menu-exit-ms:180; --menu-offset:-8px; --menu-scale:1; --menu-scale-y:1; --menu-stagger-ms:0; --menu-enter-ease:cubic-bezier(.16,1,.3,1); --menu-exit-ease:cubic-bezier(.4,0,1,1); }
body[data-template-package="field-notes"] .navbar { --menu-enter-ms:280; --menu-exit-ms:280; --menu-offset:-12px; --menu-scale-y:.98; --menu-enter-ease:cubic-bezier(.22,.8,.2,1); --menu-exit-ease:cubic-bezier(.22,.8,.2,1); }
body[data-template-package="daily-skillet"] .navbar { --menu-enter-ms:220; --menu-exit-ms:180; --menu-enter-ease:cubic-bezier(.23,1,.32,1); --menu-exit-ease:cubic-bezier(.77,0,.175,1); }
body[data-template-package="stone-crumb"] .navbar { --menu-enter-ms:200; --menu-exit-ms:200; --menu-offset:-5.6px; --menu-enter-ease:cubic-bezier(.23,1,.32,1); }
body[data-template-package="pixelwire-editorial"] .navbar { --menu-enter-ms:180; --menu-exit-ms:150; --menu-offset:-5px; --menu-enter-ease:ease-out; }
body[data-template-package="print-field"] .navbar { --menu-enter-ms:220; --menu-exit-ms:160; --menu-scale:.99; --menu-exit-ease:ease-in; }
body[data-template-package="vitalpulse-journal"] .navbar { --menu-enter-ms:180; --menu-exit-ms:180; --menu-stagger-ms:30; --menu-enter-ease:cubic-bezier(.23,1,.32,1); }
body[data-template-package="deep-life-atlas"] .navbar { --menu-enter-ms:220; --menu-exit-ms:180; --menu-stagger-ms:30; --menu-enter-ease:cubic-bezier(.22,.8,.2,1); }
.navbar .nav-links[hidden], .side-drawer-panel[hidden], .drawer-overlay[hidden] { display:none!important; }
.navbar.nav-collapsed .nav-links.nav-menu-present { display:flex!important; transform-origin:top center; }
.navbar.nav-collapsed .nav-links.nav-menu-present:not(.active) { pointer-events:none; }
.navbar[data-nav-interaction-ready] .hamburger span { transition:transform 200ms cubic-bezier(.2,.7,.2,1),opacity 140ms ease; }
.navbar[data-nav-interaction-ready] .hamburger[aria-expanded="true"] span:nth-child(1) { transform:translateY(7px) rotate(45deg); }
.navbar[data-nav-interaction-ready] .hamburger[aria-expanded="true"] span:nth-child(2) { opacity:0; }
.navbar[data-nav-interaction-ready] .hamburger[aria-expanded="true"] span:nth-child(3) { transform:translateY(-7px) rotate(-45deg); }
.side-drawer-panel[data-nav-motion] { left:0!important; transform:none; transition:none; max-width:calc(100vw - 24px); }
.drawer-overlay.nav-menu-present { display:block; }
.drawer-overlay.nav-menu-present:not(.active) { pointer-events:none; }
@media(prefers-reduced-motion:reduce) {
  .navbar[data-nav-interaction-ready] .hamburger span { transition:opacity 100ms ease; }
}
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
                // The interaction controller cancels pending animations and
                // restores hidden/inert state whenever width fitting changes.
                navbar.dispatchEvent(new CustomEvent('navbar:modechange', { detail: { collapsed: collapsed } }));
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
            probeLinks.classList.remove('nav-menu-present');
            probeLinks.removeAttribute('hidden');
            probeLinks.removeAttribute('inert');
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

    /** Serialized into preview and exported pages. No tool state, third-party
     * library or network request is needed by the interaction controller. */
    function initializeInteraction() {
        var navbar = document.querySelector('.navbar');
        if (!navbar || navbar.dataset.navInteractionReady) return;
        navbar.dataset.navInteractionReady = 'true';
        var toggle = navbar.querySelector('.hamburger');
        var drawer = document.querySelector('.side-drawer-panel');
        var menu = drawer || navbar.querySelector('.nav-links');
        var overlay = document.querySelector('.drawer-overlay');
        if (!toggle || !menu) return;
        var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
        var expanded = false;
        var revision = 0;
        var animations = [];
        var overflowBeforeDrawer = null;
        menu.dataset.navMotion = 'closed';

        function cancelAnimations() {
            animations.forEach(function(animation) { animation.cancel(); });
            animations = [];
        }
        function mobile() { return !!drawer || navbar.classList.contains('nav-collapsed'); }
        function setAccessible(open) {
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
            menu.inert = !open && mobile();
            if (mobile()) menu.setAttribute('aria-hidden', open ? 'false' : 'true');
            else menu.removeAttribute('aria-hidden');
        }
        function releaseScroll() {
            if (overflowBeforeDrawer !== null) {
                document.body.style.overflow = overflowBeforeDrawer;
                overflowBeforeDrawer = null;
            }
        }
        function reset() {
            ++revision;
            cancelAnimations();
            expanded = false;
            menu.classList.remove('active', 'open', 'nav-menu-present');
            menu.hidden = mobile();
            menu.dataset.navMotion = 'closed';
            if (overlay) { overlay.hidden = true; overlay.classList.remove('active', 'nav-menu-present'); }
            setAccessible(false);
            releaseScroll();
        }
        function animate(element, from, to, duration, easing, delay) {
            if (!element.animate) return Promise.resolve();
            var animation = element.animate([from, to], { duration: duration, delay: delay || 0, easing: easing, fill: 'both' });
            animations.push(animation);
            return animation.finished.catch(function() {});
        }
        function change(open, restoreFocus) {
            if (!mobile() || open === expanded) return;
            var wasPresent = menu.classList.contains('nav-menu-present');
            // Snapshot BEFORE cancelling: an interrupted close/open continues
            // from its current frame, so rapid clicks never jump or hide late.
            var current = getComputedStyle(menu);
            var start = { opacity: wasPresent ? current.opacity : '0', transform: current.transform };
            var overlayOpacity = overlay && wasPresent ? getComputedStyle(overlay).opacity : '0';
            var items = Array.from(menu.querySelectorAll(':scope > li'));
            var itemStarts = items.map(function(item) {
                var itemStyle = getComputedStyle(item);
                return { opacity: wasPresent ? itemStyle.opacity : '0', transform: wasPresent ? itemStyle.transform : 'translateY(-6px)' };
            });
            cancelAnimations();
            var currentRevision = ++revision;
            expanded = open;
            if (!open && (restoreFocus || menu.contains(document.activeElement))) toggle.focus();
            menu.hidden = false;
            menu.classList.add('nav-menu-present');
            menu.classList.toggle(drawer ? 'open' : 'active', open);
            menu.dataset.navMotion = open ? 'opening' : 'closing';
            setAccessible(open);
            var style = getComputedStyle(navbar);
            var closedTransform = drawer ? 'translateX(-100%)' :
                'translateY(' + (style.getPropertyValue('--menu-offset').trim() || '-8px') + ') scale(' +
                (style.getPropertyValue('--menu-scale').trim() || '1') + ') scaleY(' +
                (style.getPropertyValue('--menu-scale-y').trim() || '1') + ')';
            if (!wasPresent) start.transform = closedTransform;
            var finish = { opacity: open ? '1' : '0', transform: open ? 'none' : closedTransform };
            var duration = parseFloat(style.getPropertyValue(open ? '--menu-enter-ms' : '--menu-exit-ms')) || (open ? 240 : 180);
            var easing = style.getPropertyValue(open ? '--menu-enter-ease' : '--menu-exit-ease').trim() || 'ease';
            if (reduced.matches) { duration = 100; start.transform = 'none'; finish.transform = 'none'; }
            var jobs = [animate(menu, start, finish, duration, easing)];
            var stagger = parseFloat(style.getPropertyValue('--menu-stagger-ms')) || 0;
            // Explicit keyframes also stagger the first reveal from display:none;
            // CSS transitions alone have no previous painted frame in that case.
            // Bound total delay even for imported categories with long lists.
            if (stagger && !reduced.matches) items.forEach(function(item, index) {
                var step = open ? index : items.length - 1 - index;
                jobs.push(animate(item, itemStarts[index], { opacity: open ? '1' : '0', transform: open ? 'none' : 'translateY(-6px)' },
                    open ? 140 : 100, easing, Math.min(step, 5) * stagger));
            });
            if (drawer && overlay) {
                overlay.hidden = false;
                overlay.classList.add('nav-menu-present');
                overlay.classList.toggle('active', open);
                jobs.push(animate(overlay, { opacity: overlayOpacity }, { opacity: open ? '1' : '0' }, duration, 'ease'));
                if (open && overflowBeforeDrawer === null) {
                    overflowBeforeDrawer = document.body.style.overflow;
                    document.body.style.overflow = 'hidden';
                }
                if (open) (menu.querySelector('.drawer-close') || menu.querySelector('a'))?.focus();
            }
            Promise.all(jobs).then(function() {
                if (currentRevision !== revision) return;
                cancelAnimations();
                menu.dataset.navMotion = open ? 'open' : 'closed';
                // Keep the closing panel painted until its last animation frame;
                // only then remove it from layout. It became inert immediately.
                if (!open) {
                    menu.hidden = true;
                    menu.classList.remove('nav-menu-present');
                    if (overlay) { overlay.hidden = true; overlay.classList.remove('nav-menu-present'); }
                    releaseScroll();
                }
            });
        }
        toggle.addEventListener('click', function() { change(!expanded, false); });
        menu.querySelectorAll('a, .drawer-close').forEach(function(link) {
            link.addEventListener('click', function() { change(false, true); });
        });
        if (overlay) overlay.addEventListener('click', function() { change(false, true); });
        document.addEventListener('click', function(event) {
            if (!drawer && expanded && !navbar.contains(event.target)) change(false, false);
        });
        document.addEventListener('keydown', function(event) {
            if (!expanded) return;
            if (event.key === 'Escape') { event.preventDefault(); change(false, true); }
            // Only the modal side drawer traps focus; the dropdown remains a
            // normal navigation list and never prevents page keyboard traversal.
            if (drawer && event.key === 'Tab') {
                var targets = Array.from(menu.querySelectorAll('a[href],button:not([disabled])'));
                var first = targets[0], last = targets[targets.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
        });
        navbar.addEventListener('navbar:modechange', reset);
        reset();
    }

    /** Opt-in material from 12/assets/site.css. Keep the literal reference
     * colors instead of mixing them with the selected template palette: the
     * frosted white surface, aquatic glow and inset highlight define this skin.
     * Generator appends it AFTER template skins so every template can use it.
     * Navigation text/content and its animation controller are still separate. */
    function softGlassCSS() {
        return `
body .navbar.soft-glass {
    --nav-category-idle-color:#39565d;
    --nav-category-selected-color:#147767;
    position:sticky;top:20px;left:auto;right:auto;
    width:min(calc(100% - 48px),1280px);height:auto;min-height:68px;
    margin:20px auto 0;padding:9px 13px 9px 19px;
    border:1px solid rgba(255,255,255,.82);border-radius:999px;
    background:rgba(248,252,250,.78);color:#15323b;
    box-shadow:0 10px 30px rgba(22,54,57,.09),0 0 30px rgba(90,190,181,.13),inset 0 1px 0 rgba(255,255,255,.92);
    -webkit-backdrop-filter:blur(18px) saturate(150%);backdrop-filter:blur(18px) saturate(150%);
}
body .navbar.soft-glass .container {
    width:100%;max-width:none;margin:0;padding:0;min-height:48px;height:auto;column-gap:28px;
}
body .navbar.soft-glass.has-boxed-logo .container {min-height:48px}
body .navbar.soft-glass .logo {color:#15323b}
body .navbar.soft-glass .ref-brand small {color:#5b7378}
body .navbar.soft-glass .nav-links {
    gap:clamp(12px,1.65vw,23px);padding:0;border:0;border-radius:0;
    background:transparent;box-shadow:none;
}
body .navbar.soft-glass .nav-links a {
    min-height:0;height:auto;padding:8px 10px;border:0;border-radius:999px;
    background:transparent;color:#39565d;box-shadow:none;
}
body .navbar.soft-glass .nav-links li:last-child a {border:0;border-radius:999px}
body .navbar.soft-glass .nav-links a:hover {background:rgba(230,243,238,.66);color:#147767}
body .navbar.soft-glass .nav-links a[aria-current="page"] {
    background:#e6f3ee;color:#0f5c51;border:0;
    box-shadow:inset 0 0 0 1px rgba(20,119,103,.1);
}
body .navbar.soft-glass.nav-compact .nav-links {column-gap:var(--nav-compact-gap,10px)}
body .navbar.soft-glass.nav-compact .nav-links a {
    padding-left:var(--nav-compact-left,8px);padding-right:var(--nav-compact-right,8px);
}
body .navbar.soft-glass .hamburger {color:#15323b;border-radius:999px}
body .navbar.soft-glass .hamburger span {background:#15323b}
body .navbar.soft-glass .hamburger:focus-visible,
body .navbar.soft-glass .nav-links a:focus-visible,
body .navbar.soft-glass .logo:focus-visible {outline:3px solid #2a9d88;outline-offset:4px}
/* Use the floating capsule as the menu's positioning ancestor, including when
 * content-width fitting collapses a long desktop title before a media query. */
body .navbar.soft-glass.nav-collapsed .container {position:static;padding-right:0;column-gap:28px}
body .navbar.soft-glass.nav-collapsed .nav-links {
    top:calc(100% + 8px);left:0;right:0;gap:10px;padding:14px;
    border:1px solid rgba(255,255,255,.78);border-radius:18px;
    background:rgba(248,252,250,.84);color:#15323b;
    box-shadow:0 12px 28px rgba(22,54,57,.1),0 0 28px rgba(90,190,181,.12),inset 0 1px 0 rgba(255,255,255,.9);
    -webkit-backdrop-filter:blur(18px) saturate(150%);backdrop-filter:blur(18px) saturate(150%);
}
body .navbar.soft-glass.nav-collapsed .nav-links a {
    min-height:44px;padding:10px 7px;border-radius:10px;
    border-bottom:1px solid #edf1ef;color:#39565d;
}
body .navbar.soft-glass.nav-collapsed .nav-links a[aria-current="page"] {border-bottom-color:transparent;color:#0f5c51}
@media(max-width:900px) {
    body .navbar.soft-glass {width:min(calc(100% - 38px),1200px);min-height:63px;padding-left:14px}
    body .navbar.soft-glass .container {min-height:43px}
}
@media(max-width:680px) {
    body .navbar.soft-glass {top:10px;width:min(calc(100vw - 30px),1200px);min-height:59px;margin-top:10px;padding:7px 8px 7px 13px}
    body .navbar.soft-glass .container {min-height:43px;column-gap:10px}
    body .navbar.soft-glass.nav-collapsed .container {column-gap:10px}
}
/* An opaque fallback keeps navigation readable when backdrop filtering is not
 * supported. The default remains the exact translucent reference material. */
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))) {
    body .navbar.soft-glass,body .navbar.soft-glass.nav-collapsed .nav-links {background:#f8fcfa}
}
`;
    }

    /** Page destinations use a filled state; in-page destinations use only
     * text color. Low-specificity page defaults preserve package/material skins,
     * while explicit transparent section rules prevent their hover fills from
     * leaking into the category state. No dimensions or link order change. */
    function selectionCSS() {
        return `
.navbar .nav-links a[data-nav-page][aria-current="page"],
.side-drawer-panel .drawer-nav a[data-nav-page][aria-current="page"] {
    background:var(--color-bg-secondary);color:var(--color-primary);border-radius:999px;
}
body .navbar .nav-links a[data-nav-page]:not([aria-current="page"]),
body .side-drawer-panel .drawer-nav a[data-nav-page]:not([aria-current="page"]),
body .navbar .nav-links a[data-nav-category],
body .side-drawer-panel .drawer-nav a[data-nav-category] {
    background:transparent!important;box-shadow:none!important;
}
/* Monochrome palettes may use the same ink for body text and their primary
 * color. A muted idle state still makes the selected category visibly change. */
body .navbar .nav-links a[data-nav-category]:not([aria-current="location"]),
body .side-drawer-panel .drawer-nav a[data-nav-category]:not([aria-current="location"]) {
    color:var(--nav-category-idle-color,var(--color-text-secondary,var(--color-text)));
}
body .navbar .nav-links a[data-nav-category][aria-current="location"],
body .navbar .nav-links a[data-nav-category]:hover,
body .side-drawer-panel .drawer-nav a[data-nav-category][aria-current="location"],
body .side-drawer-panel .drawer-nav a[data-nav-category]:hover {
    color:var(--nav-category-selected-color,var(--color-primary))!important;
}
.category-section[id] {scroll-margin-top:var(--navigation-scroll-offset,calc(var(--navbar-height,68px) + 32px))}
`;
    }

    /** Serialized independently from menu open/close and width fitting. Page
     * state stays declarative (aria-current=page); this controller owns only
     * aria-current=location on home sections and never rewrites page links. */
    function initializeSelection() {
        var navbar = document.querySelector('.navbar[data-navigation-page]');
        if (!navbar || navbar.dataset.navSelectionReady) return;
        navbar.dataset.navSelectionReady = 'true';
        var links = Array.from(document.querySelectorAll('.navbar .nav-links a[data-nav-category], .side-drawer-panel .drawer-nav a[data-nav-category]'));
        var isHome = navbar.dataset.navigationPage === 'home';
        var entries = isHome ? links.map(function(link) {
            return { link: link, id: link.dataset.navCategory, section: document.getElementById(link.dataset.navCategory) };
        }).filter(function(entry) { return entry.section; }) : [];
        var sections = isHome ? Array.from(document.querySelectorAll('.category-section[id]')) : [];
        var frame = 0;
        var pending = null;
        var pendingTimer = 0;

        function setSection(id) {
            links.forEach(function(link) {
                if (link.dataset.navCategory === id) link.setAttribute('aria-current', 'location');
                else link.removeAttribute('aria-current');
            });
            navbar.dataset.activeCategory = id || '';
        }
        function offset() {
            var edge = Math.max(0, navbar.getBoundingClientRect().bottom) + 16;
            document.documentElement.style.setProperty('--navigation-scroll-offset', edge + 'px');
            return edge;
        }
        function clearPending() {
            pending = null;
            if (pendingTimer) clearTimeout(pendingTimer);
            pendingTimer = 0;
        }
        function refresh() {
            frame = 0;
            if (!isHome) { setSection(''); return; }
            var edge = offset();
            var scrolling = document.scrollingElement || document.documentElement;
            var atBottom = scrolling.scrollTop > 0 && scrolling.scrollTop + window.innerHeight >= scrolling.scrollHeight - 2;
            if (pending) {
                if (Math.abs(pending.section.getBoundingClientRect().top - edge) <= 3 || atBottom) clearPending();
                else { setSection(pending.id); return; }
            }
            // Include unlinked sections when finding the reading position. An
            // extra category or footer must not leave a previous link selected.
            var current = null;
            sections.forEach(function(section) {
                var rect = section.getBoundingClientRect();
                if (rect.top <= edge + 1) current = rect.bottom > edge ? section : null;
            });
            if (!current && atBottom) {
                sections.forEach(function(section) {
                    var rect = section.getBoundingClientRect();
                    if (rect.top > edge && rect.top < window.innerHeight && rect.bottom > edge) current = section;
                });
            }
            var entry = current && entries.find(function(item) { return item.section === current; });
            setSection(entry ? entry.id : '');
        }
        function queue() { if (!frame) frame = window.requestAnimationFrame(refresh); }
        function goToSection(entry, smooth) {
            clearPending();
            pending = entry;
            setSection(entry.id);
            var scrolling = document.scrollingElement || document.documentElement;
            var top = Math.max(0, scrolling.scrollTop + entry.section.getBoundingClientRect().top - offset());
            var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.scrollTo({ top: top, behavior: smooth && !reduce ? 'smooth' : 'instant' });
            // Native smooth scrolling may be interrupted before a scrollend
            // event, or a short last section cannot align with the header.
            pendingTimer = window.setTimeout(function() { clearPending(); queue(); }, 1800);
            queue();
        }
        entries.forEach(function(entry) {
            entry.link.addEventListener('click', function(event) {
                if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                // srcdoc has no writable HTTP URL. Standalone sites retain a
                // navigable hash; failures never prevent the local scroll.
                if (/^(https?:|file:)$/.test(window.location.protocol)) {
                    try { window.history.pushState(null, '', '#' + entry.id); } catch (_) {}
                }
                goToSection(entry, true);
            });
        });
        window.addEventListener('scroll', queue, { passive: true });
        window.addEventListener('resize', queue, { passive: true });
        window.addEventListener('scrollend', function() { clearPending(); queue(); });
        // A user's own scroll takes precedence over a pending category click.
        window.addEventListener('wheel', function() { clearPending(); queue(); }, { passive: true });
        window.addEventListener('touchstart', function() { clearPending(); queue(); }, { passive: true });
        window.addEventListener('keydown', function(event) {
            if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)) { clearPending(); queue(); }
        });
        if (window.ResizeObserver && isHome) {
            var observer = new ResizeObserver(queue);
            observer.observe(navbar);
            sections.forEach(function(section) { observer.observe(section); });
        }
        if (document.fonts) document.fonts.ready.then(queue);
        window.addEventListener('load', queue);
        var initialId = navbar.dataset.initialCategory || window.location.hash.slice(1);
        var initial = entries.find(function(entry) { return entry.id === initialId; });
        if (initial) window.requestAnimationFrame(function() { goToSection(initial, false); });
        else queue();
    }

    function script() { return '(' + initialize.toString() + ')();'; }
    function interactionScript() { return '(' + initializeInteraction.toString() + ')();'; }
    function selectionScript() { return '(' + initializeSelection.toString() + ')();'; }
    root.NavbarLayout = Object.freeze({ css: css, script: script, interactionScript: interactionScript,
        softGlassCSS: softGlassCSS, selectionCSS: selectionCSS, selectionScript: selectionScript });
})(typeof globalThis !== 'undefined' ? globalThis : this);
