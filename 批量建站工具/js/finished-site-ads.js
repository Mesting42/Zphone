/**
 * 成品站固定广告位规划器。
 *
 * 预览和静态导出共用此 DOM 规划器。它只在能够确认结构锚点时插入
 * 广告容器；无法确认的位置返回提示，由界面引导用户手动放置。
 */
function createFinishedSiteAds() {
    'use strict';

    const UNITS = ['banner1', 'banner2', 'banner3'];
    // 法律、联系和编辑透明度页面保持原样，不加入广告容器或运行时。
    const UTILITY_PATH = /(?:^|\/)(?:about(?:-us)?|contact(?:-us)?|privacy(?:-policy)?|cookie(?:-policy)?|terms(?:-of-(?:service|use))?|legal|faq|404|accessibility|editorial(?:-policy|-standards)?|sources?-methodology|corrections|disclaimer|disclosures|copyright)(?:[/.]|$)/i;
    // These HTML files run inside content pages or belong to project resources.
    // Preserve them in the export without applying the host site's ad layout.
    const RESOURCE_PATH = /(?:^|\/)(?:vendor-games|assets|node_modules|\.git|\.tmp[^/]*)(?:\/|$)/i;
    const BUILT_IN_AD_JS_VERSIONS = ['initial', 'v1.0.0', 'v1.0.1', 'v1.0.2', 'v1.0.2.1'];

    function normalizeVersion(version) {
        if (BUILT_IN_AD_JS_VERSIONS.indexOf(version) !== -1) return version;
        const catalog = typeof window !== 'undefined' && window.AdTemplateCatalog;
        return catalog && catalog.isKnownVersion(version) ? version : 'v1.0.2.1';
    }

    function isContentPath(path) {
        const normalized = String(path || '').replace(/\\/g, '/');
        return !UTILITY_PATH.test(normalized) && !RESOURCE_PATH.test(normalized);
    }

    function isHomePath(path, homePath) {
        return String(path || '').replace(/\\/g, '/').toLowerCase() === String(homePath || '').replace(/\\/g, '/').toLowerCase();
    }

    function activeUnits(config) {
        return UNITS.filter(function(unit) {
            return !!(config && config['bannerPath' + unit.slice(-1)]);
        });
    }

    function contentChildren(node) {
        return Array.from(node && node.children || []).filter(function(child) {
            return !/^(?:script|style|template|header|nav|footer|aside)$/i.test(child.tagName || '')
                && !child.hasAttribute('data-sitefoundry-fixed-ad');
        });
    }

    function contentRoot(doc) {
        return doc.querySelector('main, [role="main"]') || doc.body;
    }

    function navigationAnchor(doc) {
        const semantic = doc.querySelector('header, nav, [role="banner"], [role="navigation"]');
        if (semantic) return semantic;

        // Some compiled React themes render the site header as a div. Only
        // accept a header/nav-like wrapper that contains multiple real links.
        const candidates = Array.from(doc.querySelectorAll(
            '[class*="header"], [id*="header"], [class*="navbar"], [id*="navbar"], '
            + '[class*="navigation"], [id*="navigation"], [class~="nav"], [class*="nav-"], [class*="-nav"]'
        )).filter(function(node) {
            const name = String(node.className || '') + ' ' + String(node.id || '');
            return !/pagination|breadcrumb|social|share|footer/i.test(name)
                && !/^(?:main|footer|aside)$/i.test(node.tagName || '')
                && node.querySelectorAll('a[href]').length >= 2;
        });
        function depth(node) {
            let value = 0;
            while (node && node.parentElement) { value++; node = node.parentElement; }
            return value;
        }
        candidates.sort(function(a, b) { return depth(a) - depth(b); });
        return candidates[0] || null;
    }

    function isCustomScrollProgress(node) {
        if (!node || node.nodeType !== 1) return false;
        if (node.matches('[data-scroll-progress], [data-reading-progress], [data-page-progress], [data-scroll-indicator]')) return true;
        const className = node.className && node.className.baseVal || node.className || '';
        const identity = String(className) + ' ' + String(node.id || '');
        return /(?:^|[-_\s])(?:scroll|reading|page)[-_\s]*(?:progress|indicator)(?:$|[-_\s])/i.test(identity);
    }

    function adjacentScrollProgress(navigation) {
        if (!navigation) return null;
        if (isCustomScrollProgress(navigation.nextElementSibling)) return navigation.nextElementSibling;
        // Some themes keep the rail as the header's final child while positioning
        // it immediately below the visible navigation with absolute CSS.
        if (isCustomScrollProgress(navigation.lastElementChild)) return navigation.lastElementChild;
        return null;
    }

    function ensureAfterNavigationOffsetStyle(doc) {
        if (doc.querySelector('style[data-sitefoundry-after-nav-offset-style]')) return;
        const style = doc.createElement('style');
        style.setAttribute('data-sitefoundry-after-nav-offset-style', '');
        // The tool's tablet preview is 768px wide and this site's mobile layout
        // ends at 719px. Keep phones untouched while clearing a 24px progress rail.
        style.textContent = '@media (min-width:720px){[data-sitefoundry-after-nav-offset]{margin-top:24px!important;}}';
        (doc.head || doc.documentElement || doc.body).appendChild(style);
    }

    function applyAfterNavigationOffset(doc, adNode, navigation) {
        if (!doc || !adNode || !adjacentScrollProgress(navigation)) return false;
        adNode.setAttribute('data-sitefoundry-after-nav-offset', '');
        ensureAfterNavigationOffsetStyle(doc);
        return true;
    }

    function pageFooter(doc) {
        const main = doc.querySelector('main, [role="main"]');
        const candidates = Array.from(doc.querySelectorAll(
            'footer, [role="contentinfo"], [class*="footer"], [id*="footer"]'
        ));
        function nameOf(node) {
            const className = node.className && node.className.baseVal || node.className || '';
            return String(className) + ' ' + String(node.id || '');
        }
        function isGlobalName(name) {
            return /(?:^|[-_\s])(?:site|global|page|main)[-_\s]*footer(?:$|[-_\s])/i.test(name)
                || /(?:^|[-_\s])footer[-_\s]*(?:site|global|page|main)(?:$|[-_\s])/i.test(name);
        }
        function isFooterRegion(node) {
            if (/^footer$/i.test(node.tagName || '') || node.matches('[role="contentinfo"]')) return true;
            return String(node.className && node.className.baseVal || node.className || '')
                .split(/\s+/).concat([String(node.id || '')]).some(function(token) {
                    return /(?:^|[-_])(?:site|global|page|main)[-_]?footer(?:$|[-_]|[A-Z])/i.test(token)
                        || /(?:^|[-_])footer(?:$|[-_](?:container|wrapper|area|region|section|inner|bottom|content|main|site|global|page)|[A-Z])/i.test(token);
                });
        }
        function hasGlobalAncestor(node) {
            let current = node;
            while (current && current !== doc.body) {
                if (isGlobalName(nameOf(current))) return true;
                current = current.parentElement;
            }
            return false;
        }
        function isInsideLocalBlock(node) {
            let current = node;
            while (current && current !== doc.body && current !== main) {
                if (isGlobalName(nameOf(current))) return false;
                const name = nameOf(current);
                if (/^(?:article)$/i.test(current.tagName || '')
                    || /(?:^|[-_\s])(?:article|post|entry|story|card|tile|widget|related|comment|author|cta)(?:[-_\s]|$)/i.test(name)) return true;
                current = current.parentElement;
            }
            return false;
        }
        function depth(node) {
            let value = 0;
            while (node && node.parentElement) { value++; node = node.parentElement; }
            return value;
        }
        const viable = candidates.filter(function(node) {
            const name = nameOf(node);
            const localFooterName = /(?:^|[-_\s])(?:article|post|entry|card|tile|widget|comment|author|related|cta)[-_\s]*footer(?:$|[-_\s])/i.test(name);
            return isFooterRegion(node) && !localFooterName && (!isInsideLocalBlock(node) || hasGlobalAncestor(node));
        });
        if (!viable.length) return null;
        const outermost = viable.filter(function(node) {
            return !viable.some(function(other) { return other !== node && other.contains(node); });
        });
        return outermost.map(function(node, index) {
            const name = nameOf(node);
            const global = isGlobalName(name) || hasGlobalAncestor(node);
            const outsideMain = !main || !main.contains(node);
            let score = 0;
            if (node.matches('[role="contentinfo"]')) score += 100;
            if (/^footer$/i.test(node.tagName || '')) score += 40;
            if (global) score += 150;
            if (outsideMain) score += 70;
            // When names are generic, the last and shallowest page-level footer
            // is the safest candidate. Local card footers were filtered above.
            score += index * 0.1;
            score -= depth(node) * 2;
            return { node: node, score: score };
        }).sort(function(a, b) { return b.score - a.score; })[0].node;
    }

    function homepageContentModules(main) {
        const candidates = [];
        const excludedName = /(?:^|[\s_-])(?:hero|intro|masthead|featured|banner|advert(?:isement)?|ad-slot|footer|related|breadcrumb|pagination|navigation|navbar|toolbar)(?:$|[\s_-])/i;
        const controls = 'input, select, textarea, button, [role="button"], [role="application"], canvas, iframe, video';

        function nameOf(node) {
            const className = node.className && node.className.baseVal || node.className || '';
            return [className, node.id, node.getAttribute && node.getAttribute('aria-label'),
                node.getAttribute && node.getAttribute('role')].filter(Boolean).join(' ');
        }

        function isHidden(node) {
            return !!(node.hidden || node.hasAttribute('hidden') || node.hasAttribute('inert')
                || String(node.getAttribute('aria-hidden') || '').toLowerCase() === 'true');
        }

        // Names are only used to skip known non-content areas. Candidate
        // discovery itself is based on headings, links, controls, and DOM shape.
        function isExcluded(node) {
            let current = node;
            while (current && current !== main.parentElement) {
                const tag = String(current.tagName || '').toLowerCase();
                if (/^(?:header|nav|footer|aside)$/.test(tag)
                    || current.matches('[role="banner"], [role="navigation"], [role="contentinfo"], [role="complementary"]')
                    || current.hasAttribute('data-sitefoundry-fixed-ad')
                    || current.hasAttribute('data-sitefoundry-preview-ad')
                    || isHidden(current) || excludedName.test(nameOf(current))) return true;
                if (current === main) break;
                current = current.parentElement;
            }
            return false;
        }

        function hasOwnHeroHeading(node) {
            return !!node.querySelector('h1');
        }

        function textLength(node) {
            return String(node && node.textContent || '').replace(/\s+/g, ' ').trim().length;
        }

        function hasActionOrMedia(node) {
            return !!node.querySelector('a[href], button, [role="button"], input, select, textarea, img, picture, canvas, iframe, video');
        }

        function isOrderedProcessItem(node) {
            return !!node.closest('ol');
        }

        function isContentUnit(node) {
            if (!node || isExcluded(node)) return false;
            const tag = String(node.tagName || '').toLowerCase();
            if (tag === 'a') return node.hasAttribute('href') && (textLength(node) >= 3 || !!node.querySelector('img'));
            if (tag === 'article') return !!node.querySelector('a[href], img, h2, h3, h4');
            if (tag === 'li') return !isOrderedProcessItem(node)
                && !!node.querySelector('a[href], button, [role="button"], img');
            if (tag === 'button') return textLength(node) >= 2;
            const customElement = tag.indexOf('-') >= 0;
            if (tag !== 'div' && tag !== 'figure' && !customElement
                && !node.matches('[role="listitem"], [role="article"]')) return false;

            // A card-like generic element has an action or media plus a useful
            // label. Large wrappers containing an entire nested card collection
            // are left to that inner collection instead of becoming one item.
            const nestedUnits = Array.from(node.children || []).filter(function(child) {
                const childTag = String(child.tagName || '').toLowerCase();
                return childTag === 'a' || childTag === 'article' || childTag === 'li'
                    || child.matches('button, [role="button"], [role="listitem"], [role="article"]');
            });
            if (nestedUnits.length >= 2) return false;
            return hasActionOrMedia(node) && textLength(node) >= 3;
        }

        function visibleHeadings(node) {
            return Array.from(node.querySelectorAll('h2, h3, h4')).filter(function(heading) {
                if (isExcluded(heading) || textLength(heading) < 2) return false;
                let parent = heading.parentElement;
                while (parent && parent !== node) {
                    const tag = String(parent.tagName || '').toLowerCase();
                    if (/^(?:a|article|li|button)$/.test(tag)
                        || parent.matches('[role="listitem"], [role="article"], [role="button"]')
                        || isContentUnit(parent)) return false;
                    parent = parent.parentElement;
                }
                return true;
            });
        }

        function hasStandaloneContent(node) {
            return !!node.querySelector(controls);
        }

        function moduleHeadingAncestor(container) {
            let current = container;
            while (current && current !== main) {
                if (!isExcluded(current) && !hasOwnHeroHeading(current) && visibleHeadings(current).length) return current;
                current = current.parentElement;
            }
            return null;
        }

        function addCandidate(node, units, hasHeading, source) {
            if (!node || node === main || isExcluded(node) || hasOwnHeroHeading(node)) return;
            candidates.push({ node: node, units: units || [], hasHeading: !!hasHeading, source: source || 'structure' });
        }

        const containers = [main].concat(Array.from(main.querySelectorAll('*')));
        containers.forEach(function(container) {
            if (isExcluded(container)) return;
            const children = contentChildren(container).filter(function(child) {
                return !isExcluded(child) && !/^h[1-6]$/i.test(child.tagName || '');
            });
            const units = children.filter(isContentUnit);
            const sameKind = units.some(function(unit, index) {
                return units.slice(index + 1).some(function(other) {
                    return String(unit.tagName || '').toLowerCase() === String(other.tagName || '').toLowerCase();
                });
            });
            if (units.length < 2 || (!sameKind && !children.every(isContentUnit))) return;

            const headingRoot = moduleHeadingAncestor(container);
            if (headingRoot) addCandidate(headingRoot, units, true, 'repeated-content');
            else if (container !== main) addCandidate(container, units, false, 'repeated-content');
        });

        // Tool and game homepages often use a single interactive module instead
        // of a category grid. Recognize headed modules from controls and copy,
        // while ignoring lead headings, prose-only editorial notes, and ordered
        // how-to steps that are not independent content collections.
        containers.slice(1).forEach(function(node) {
            if (isExcluded(node) || hasOwnHeroHeading(node)) return;
            const headings = visibleHeadings(node);
            if (!headings.length || !hasStandaloneContent(node)) return;
            if (node.querySelector('ol') && !node.querySelector(controls)) return;
            addCandidate(node, [], true, 'headed-module');
        });

        // When nested wrappers describe one module, keep its outer headed
        // boundary. Prefer repeated content evidence, then broader semantic
        // headings, and finally retain independent modules in page order.
        candidates.sort(function(a, b) {
            const scoreA = (a.hasHeading ? 4 : 0) + (a.source === 'repeated-content' ? 2 : 0)
                + (/^section$/i.test(a.node.tagName || '') ? 1 : 0);
            const scoreB = (b.hasHeading ? 4 : 0) + (b.source === 'repeated-content' ? 2 : 0)
                + (/^section$/i.test(b.node.tagName || '') ? 1 : 0);
            if (scoreA !== scoreB) return scoreB - scoreA;
            if (a.node === b.node) return 0;
            return a.node.compareDocumentPosition(b.node) & 4 ? -1 : 1;
        });
        const blocks = [];
        candidates.forEach(function(candidate) {
            const duplicate = blocks.some(function(existing) {
                const sameContent = candidate.units.length && existing.units.length
                    && candidate.units.some(function(unit) { return existing.units.indexOf(unit) >= 0; });
                return candidate.node === existing.node || sameContent
                    || existing.node.contains(candidate.node) || candidate.node.contains(existing.node);
            });
            if (!duplicate) blocks.push(candidate);
        });
        blocks.sort(function(a, b) {
            if (a.node === b.node) return 0;
            return a.node.compareDocumentPosition(b.node) & 4 ? -1 : 1;
        });
        return blocks.map(function(candidate) { return candidate.node; });
    }

    function cardGrid(main) {
        // Third-party sites may use arbitrary grid class names. Repeated article
        // and image-card parents provide structural evidence without a theme ID.
        const candidates = new Set(main.querySelectorAll('[class*="grid"], [class*="list"], ul, ol'));
        main.querySelectorAll('article, [class*="card"], [class*="tile"], img').forEach(function(node) {
            if (node.parentElement) candidates.add(node.parentElement);
            if (node.tagName === 'IMG' && node.parentElement && node.parentElement.parentElement) {
                candidates.add(node.parentElement.parentElement);
            }
        });
        return Array.from(candidates).map(function(node) {
            const children = contentChildren(node);
            const cards = children.filter(function(child) {
                const name = String(child.className || '');
                return /^article$/i.test(child.tagName || '') || /(?:card|item|tile)/i.test(name)
                    || (!!child.querySelector('a[href]') && !!child.querySelector('img'));
            });
            return { node: node, cards: cards };
        }).filter(function(item) {
            return item.cards.length >= 4 && item.cards.length === contentChildren(item.node).length;
        }).sort(function(a, b) {
            return b.cards.length - a.cards.length;
        })[0] || null;
    }

    function placeholder(doc, unit) {
        const n = unit.slice(-1);
        const outer = doc.createElement('div');
        outer.id = 'adv' + n;
        outer.setAttribute('data-sitefoundry-fixed-ad', n);
        outer.style.cssText = 'width:100%!important;text-align:center!important;padding:10px!important;display:flex!important;flex-direction:column!important;align-items:center!important;overflow:hidden!important;box-sizing:border-box!important;grid-column:1 / -1!important;flex-basis:100%!important;position:relative!important;z-index:2!important;visibility:visible!important;opacity:1!important;';
        const label = doc.createElement('div');
        label.textContent = 'advertisement' + n;
        // Inherit the site's text color so the placement marker remains visible on dark and light themes.
        label.style.cssText = 'display:block!important;position:relative;z-index:1;text-align:center;color:inherit!important;-webkit-text-fill-color:currentColor!important;font:13px/1.4 system-ui,sans-serif!important;text-indent:0!important;visibility:visible!important;opacity:1!important;';
        const area = doc.createElement('div');
        area.id = 'div-gpt-ad-banner' + n;
        area.style.cssText = 'min-width:300px;min-height:250px;';
        outer.append(label, area);
        return outer;
    }

    // The grid may have three columns on a wide screen and two on a narrow
    // screen. Measure rendered rows, then move the ad between two full rows.
    // No card is detached, and resize recalculates the boundary.
    function gridRowRuntime() {
        function position() {
            document.querySelectorAll('[data-sitefoundry-grid-ad]').forEach(function(ad) {
                const grid = ad.parentElement;
                if (!grid) return;
                const cards = Array.from(grid.children).filter(function(node) {
                    return node !== ad && !node.hasAttribute('data-sitefoundry-fixed-ad');
                });
                const rows = [];
                cards.forEach(function(card) {
                    const rect = card.getBoundingClientRect();
                    if (rect.width < 2 || rect.height < 2) return;
                    let row = rows.find(function(item) { return Math.abs(item.top - rect.top) < 4; });
                    if (!row) { row = { top: rect.top, cards: [] }; rows.push(row); }
                    row.cards.push(card);
                });
                rows.sort(function(a, b) { return a.top - b.top; });
                const columns = Math.max.apply(null, rows.map(function(row) { return row.cards.length; }).concat([0]));
                const boundaries = [];
                for (let i = 0; i + 1 < rows.length; i++) {
                    if (rows[i].cards.length === columns && rows[i + 1].cards.length === columns) boundaries.push(i);
                }
                // A one-column phone layout still needs its middle ad. Short
                // lists keep the placement visible instead of silently hiding it.
                if (!boundaries.length) { ad.hidden = false; return; }
                const selected = boundaries.reduce(function(best, index) {
                    return Math.abs(index - (rows.length - 1) / 2) < Math.abs(best - (rows.length - 1) / 2) ? index : best;
                }, boundaries[0]);
                const next = rows[selected + 1].cards[0];
                if (next && ad.nextElementSibling !== next) grid.insertBefore(ad, next);
                ad.hidden = false;
            });
            document.querySelectorAll('[data-sitefoundry-fixed-ad]').forEach(function(ad) {
                // Center against the page, including layouts with a side column.
                // Reset before measuring so resize never accumulates offsets.
                ad.style.transform = 'none';
                const rect = ad.getBoundingClientRect();
                const offset = document.documentElement.clientWidth / 2 - (rect.left + rect.width / 2);
                ad.style.transform = 'translateX(' + Math.round(offset * 100) / 100 + 'px)';
            });
        }
        if (window.__sitefoundryGridRuntimeReady) { position(); return; }
        window.__sitefoundryGridRuntimeReady = true;
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', position, { once: true });
        else position();
        window.addEventListener('resize', function() { requestAnimationFrame(position); });
    }

    function addGridRuntime(doc) {
        if (doc.querySelector('script[data-sitefoundry-grid-runtime]')) return;
        const script = doc.createElement('script');
        script.setAttribute('data-sitefoundry-grid-runtime', '');
        script.textContent = '(' + gridRowRuntime.toString() + ')();';
        doc.body.appendChild(script);
    }

    function place(doc, pageType, config, options) {
        const placed = [];
        const skipped = [];
        const wanted = activeUnits(config);
        const main = contentRoot(doc);
        const header = navigationAnchor(doc);
        const footer = pageFooter(doc);
        // 页面缺少可识别的导航栏时，仍将 banner1 放在主要内容前，
        // 让实时预览和固定模式导出都有可见且一致的首个广告位。
        const bodyContentStart = main === doc.body
            ? Array.from(doc.body && doc.body.children || []).find(function(node) {
                return !/^(?:script|style|template)$/i.test(node.tagName || '');
            })
            : main;
        function add(unit, anchor, relation, reason) {
            if (wanted.indexOf(unit) < 0) return;
            if (!anchor || !anchor.parentNode) {
                skipped.push({ unit: unit, reason: reason });
                return;
            }
            const node = placeholder(doc, unit);
            // Only banner1 belongs to the top-of-page slot. When a custom page
            // progress rail is the navigation's immediate sibling, reserve its
            // visual height on tablet and desktop without changing phone layout.
            if (unit === 'banner1' && anchor === header && relation === 'after') {
                applyAfterNavigationOffset(doc, node, header);
            }
            if (relation === 'before') anchor.parentNode.insertBefore(node, anchor);
            else anchor.parentNode.insertBefore(node, anchor.nextSibling);
            placed.push(unit);
        }
        add('banner1', header || bodyContentStart, header ? 'after' : 'before', '未识别到导航栏或可用的主要内容位置');
        const blocks = pageType === 'home' ? homepageContentModules(main) : [];
        if (pageType === 'home' && blocks.length >= 2) {
            add('banner2', blocks[Math.floor((blocks.length - 1) / 2)], 'after', '未识别到内容中段');
        } else {
            const grid = cardGrid(main);
            if (grid && wanted.indexOf('banner2') >= 0) {
                const node = placeholder(doc, 'banner2');
                node.setAttribute('data-sitefoundry-grid-ad', '');
                grid.node.appendChild(node);
                placed.push('banner2');
                if (options && options.live) gridRowRuntime();
                else addGridRuntime(doc);
            } else {
                const article = doc.querySelector('main article, article, .detail-content, .article-content') || main;
                const paragraphs = Array.from(article.querySelectorAll('p')).filter(function(p) { return p.textContent.trim().length >= 30; });
                add('banner2', paragraphs.length >= 2 ? paragraphs[Math.floor((paragraphs.length - 1) / 2)] : null,
                    'after', '未识别到完整卡片行或足够的正文段落');
            }
        }
        add('banner3', footer, 'before', '未识别到页脚');
        // Both the card boundary and page-level centering are shared by static
        // exports and live React routing; run the same runtime in both modes.
        if (options && options.live) gridRowRuntime();
        else addGridRuntime(doc);
        return { placed: placed, skipped: skipped };
    }

    function serialize(doc) {
        return '<!doctype html>\n' + doc.documentElement.outerHTML;
    }

    function previewPlaceholder(doc, unit) {
        const node = placeholder(doc, unit);
        node.removeAttribute('data-sitefoundry-fixed-ad');
        node.setAttribute('data-sitefoundry-preview-ad', unit.slice(-1));
        return node;
    }

    return { normalizeVersion: normalizeVersion, isContentPath: isContentPath, isHomePath: isHomePath,
        activeUnits: activeUnits, navigationAnchor: navigationAnchor, pageFooter: pageFooter,
        previewPlaceholder: previewPlaceholder, isCustomScrollProgress: isCustomScrollProgress,
        adjacentScrollProgress: adjacentScrollProgress, applyAfterNavigationOffset: applyAfterNavigationOffset,
        place: place, serialize: serialize };
}

// Expose the planner as a window property so classic scripts and the Vite
// module that drives the UI resolve the same object in every browser.
var FinishedSiteAds = createFinishedSiteAds();

/**
 * React 源码站和仅有构建产物的 SPA 需要随路由重新放置广告。
 * 运行时内嵌同一个规划器，避免预览与导出各自猜测位置。
 */
FinishedSiteAds.dynamicRuntimeSource = function(config, version, options) {
    const payload = JSON.stringify({ paths: config || {}, version: FinishedSiteAds.normalizeVersion(version),
        previewPageType: options && options.previewPageType || '', waitForLoad: !!(options && options.waitForLoad) })
        .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
    function runtime(input) {
        const planner = createFinishedSiteAds();
        const paths = input.paths;
        const version = input.version;
        const state = { route: '', slots: [], services: false, timer: 0, observers: [] };
        window.googletag = window.googletag || { cmd: [] };
        function refreshAds(home, content) {
            state.observers.forEach(function(observer) { observer.disconnect(); });
            state.observers = [];
            googletag.cmd.push(function() {
                if (state.slots.length && googletag.destroySlots) googletag.destroySlots(state.slots);
                state.slots = [];
                if (version !== 'initial' && googletag.setConfig) {
                    // v1.0.2 remains the historical no-lazy-load release;
                    // v1.0.2.1 and the other native GPT releases enable it.
                    googletag.setConfig({ lazyLoad: version === 'v1.0.2' ? null : { fetchMarginPercent: 50, renderMarginPercent: 0, mobileScaling: 1 }, singleRequest: false });
                }
                const readyToDisplay = [];
                [1, 2, 3].forEach(function(n) {
                    const id = 'div-gpt-ad-banner' + n;
                    const path = paths['bannerPath' + n];
                    const element = document.getElementById(id);
                    if (!path || !element) return;
                    function defineAndDisplay() {
                        const slot = googletag.defineSlot(path, [300, 250], id);
                        if (!slot) return;
                        state.slots.push(slot.addService(googletag.pubads()));
                        if (state.services) googletag.display(id);
                        else readyToDisplay.push(id);
                    }
                    if (version === 'initial' && typeof IntersectionObserver === 'function') {
                        const observer = new IntersectionObserver(function(entries) {
                            if (!entries.some(function(entry) { return entry.isIntersecting; })) return;
                            observer.disconnect();
                            googletag.cmd.push(defineAndDisplay);
                        }, { threshold: 0.1 });
                        observer.observe(element);
                        state.observers.push(observer);
                    } else defineAndDisplay();
                });
                if (version === 'initial' && paths.bannerPath4 && document.getElementById('div-gpt-ad-banner4')) {
                    const fourth = googletag.defineSlot(paths.bannerPath4, [300, 250], 'div-gpt-ad-banner4');
                    if (fourth) { state.slots.push(fourth.addService(googletag.pubads())); readyToDisplay.push('div-gpt-ad-banner4'); }
                }
                if (content) {
                    if (home && paths.interstitialPath) {
                        const interstitial = googletag.defineOutOfPageSlot(paths.interstitialPath, googletag.enums.OutOfPageFormat.INTERSTITIAL);
                        if (interstitial) {
                            state.slots.push(interstitial.addService(googletag.pubads()));
                            if (version === 'v1.0.1' && interstitial.setConfig) interstitial.setConfig({ interstitial: {
                                triggers: { unhideWindow: true, navBar: true, inactivity: true, endOfArticle: true, continueReading: true }
                            } });
                            readyToDisplay.push(interstitial);
                        }
                    }
                    if (paths.anchorPath) {
                        const anchor = googletag.defineOutOfPageSlot(paths.anchorPath, googletag.enums.OutOfPageFormat.BOTTOM_ANCHOR);
                        if (anchor) { state.slots.push(anchor.addService(googletag.pubads())); readyToDisplay.push(anchor); }
                    }
                }
                if (!state.services) { googletag.enableServices(); state.services = true; }
                readyToDisplay.forEach(function(target) { googletag.display(target); });
            });
        }
        function mount() {
            if (!document.body) return;
            const route = location.pathname + location.search;
            const existing = document.querySelectorAll('[data-sitefoundry-fixed-ad]').length;
            if (route === state.route && existing) return;
            document.querySelectorAll('[data-sitefoundry-fixed-ad]').forEach(function(node) { node.remove(); });
            const content = input.previewPageType ? true : planner.isContentPath(location.pathname);
            const home = input.previewPageType ? input.previewPageType === 'home'
                : location.pathname === '/' || /^\/index\.html?$/i.test(location.pathname);
            const plan = content ? planner.place(document, home ? 'home' : 'detail', paths, { live: true }) : { placed: [], skipped: [] };
            if (plan.skipped.length) {
                console.warn('[SiteFoundry Ads] 固定广告位已跳过，请手动选择：', plan.skipped);
                if (input.previewPageType && window.parent !== window) {
                    window.parent.postMessage({ type: 'ad-injection-fixed-skipped', skipped: plan.skipped }, '*');
                }
            }
            state.route = route;
            if (plan.placed.length || state.slots.length) refreshAds(home, content);
        }
        function schedule() {
            clearTimeout(state.timer);
            // Preserve the server-rendered tree until Next's application
            // scripts load; DOMContentLoaded alone can race React hydration.
            if (input.waitForLoad && document.readyState !== 'complete') return;
            state.timer = setTimeout(mount, 120);
        }
        window.refreshClarivoBanners = schedule;
        ['pushState', 'replaceState'].forEach(function(method) {
            const original = history[method];
            if (!original || original.__sitefoundryWrapped) return;
            const wrapped = function() { const result = original.apply(this, arguments); schedule(); return result; };
            wrapped.__sitefoundryWrapped = true;
            history[method] = wrapped;
        });
        addEventListener('popstate', schedule);
        if (input.waitForLoad) addEventListener('load', schedule, { once: true });
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
        else schedule();
        new MutationObserver(function() {
            if (!document.querySelector('[data-sitefoundry-fixed-ad]')) schedule();
        }).observe(document.documentElement, { childList: true, subtree: true });
        if (paths.analyticsID) {
            const ga = document.createElement('script');
            ga.async = true;
            ga.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(paths.analyticsID);
            document.head.appendChild(ga);
            window.dataLayer = window.dataLayer || [];
            window.gtag = window.gtag || function() { dataLayer.push(arguments); };
            gtag('js', new Date());
            gtag('config', paths.analyticsID);
        }
    }
    return '/** 成品站 ad.js ' + FinishedSiteAds.normalizeVersion(version) + ' · responsive runtime */\n' +
        '(function(createFinishedSiteAds){(' + runtime.toString() + ')(' + payload + ');})(' + createFinishedSiteAds.toString() + ');\n';
};

if (typeof module !== 'undefined' && module.exports) module.exports = FinishedSiteAds;
