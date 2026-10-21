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
    // Some uploads prefix copied build folders with the site name, for example
    // `03-OrbitTools工具站-_dist/`. They are still auxiliary output trees and
    // must not be treated as visitor-facing pages during placement or export.
    const RESOURCE_PATH = /(?:^|\/)(?:vendor-games|assets|node_modules|scripts|templates?|(?:[^/]+-)?_dist|\.git|\.tmp[^/]*|\.site-build)(?:\/|$)/i;
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

    /**
     * Limit preview, injection and export checks to pages that belong to the
     * selected deployment tree. Source packages often keep duplicate HTML in
     * public/ while the real site lives at the project root or in a build
     * output. Those copies must remain byte-identical and must not create extra
     * detail-page types or export failures.
     */
    function isDeployableContentPath(path, project) {
        const normalized = String(path || '').replace(/\\/g, '/');
        if (!isContentPath(normalized)) return false;
        if (!project) return true;
        const deploymentRoot = String(project.deploymentRoot || '').replace(/\\/g, '/');
        if (deploymentRoot && normalized.indexOf(deploymentRoot) !== 0) return false;
        const publicMatch = normalized.match(/^(.*?)(?:public)\//i);
        if (!publicMatch || deploymentRoot) return true;
        const publicRoot = publicMatch[1] + 'public/';
        const entryPath = String(project.entryPath || '').replace(/\\/g, '/');
        // public/ is deployable only when it is itself the selected site root.
        // CRA/Vite source public/ copies are handled by their source injector.
        return project.kind !== 'react-source' && entryPath.indexOf(publicRoot) === 0;
    }

    function isHomePath(path, homePath) {
        return String(path || '').replace(/\\/g, '/').toLowerCase() === String(homePath || '').replace(/\\/g, '/').toLowerCase();
    }

    /**
     * Keep manual placement ownership separate for article, tool and game pages.
     * Paths are the strongest signal for static exports; DOM evidence covers
     * generic route names and client-rendered applications.
     */
    function contentPageType(path, doc, homePath) {
        const normalized = String(path || '').replace(/\\/g, '/').toLowerCase();
        if (isHomePath(normalized, homePath) || /^(?:\/|index\.html?)?$/.test(normalized)) return 'home';
        if (/(?:^|\/)(?:tools?|calculators?|converters?|generators?)(?:\/|$)/.test(normalized)) return 'tool';
        if (/(?:^|\/)(?:games?|play)(?:\/|$)/.test(normalized)) return 'game';
        if (/(?:^|\/)(?:articles?|news|posts?|stories?|guides?|blog|details?)(?:\/|$)/.test(normalized)) return 'article';
        if (doc) {
            const main = contentRoot(doc);
            if (main && main.querySelector('canvas, [class*="game"], [id*="game"], [class*="player"], [id*="player"]')) return 'game';
            if (main && main.querySelector('form, input, select, textarea, [class*="calculator"], [class*="converter"], [class*="tool"]')) return 'tool';
            if (main && main.querySelector('article, .article-body, .article-content, .prose')) return 'article';
        }
        return 'article';
    }

    function activeUnits(config) {
        return UNITS.filter(function(unit) {
            return !!(config && config['bannerPath' + unit.slice(-1)]);
        });
    }

    function contentChildren(node) {
        return Array.from(node && node.children || []).filter(function(child) {
            return !/^(?:script|style|template|header|nav|footer|aside)$/i.test(child.tagName || '')
                && !child.matches('[data-sitefoundry-fixed-ad], [data-sitefoundry-preview-ad], [data-sitefoundry-runtime-ad]');
        });
    }

    function contentRoot(doc) {
        return doc.querySelector('main, [role="main"]') || doc.body;
    }

    function navigationAnchor(doc) {
        const contentRegion = 'main, [role="main"], article, footer, [role="contentinfo"], aside';
        const semanticNodes = Array.from(doc.querySelectorAll('header, nav, [role="banner"], [role="navigation"]'));
        // A nav inside the hero, a tool form or an article is local content
        // navigation. It must never become banner1's site-shell boundary.
        const semantic = semanticNodes.find(function(node) { return !node.closest(contentRegion); });
        if (semantic) return semantic;

        // Static HTML can expose an empty mount point and populate its header
        // later from a shared script. Recognize only explicit site-level mount
        // names here so generic article-header containers are not promoted.
        const deferredHost = Array.from(doc.querySelectorAll('[id], [class]')).find(function(node) {
            if (node.closest(contentRegion)) return false;
            const className = node.className && node.className.baseVal || node.className || '';
            const identity = String(className) + ' ' + String(node.id || '');
            return /(?:^|\s)(?:(?:site|global|page)[-_]?(?:header|navbar|navigation|nav)|(?:header|navbar|navigation|nav)[-_]?(?:root|mount|host))(?:\s|$)/i.test(identity);
        });
        if (deferredHost) return deferredHost;

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
        return candidates[0] || semanticNodes[0] || null;
    }

    /**
     * Return the complete navigation-only host used as the insertion boundary.
     *
     * Some static sites render <header> into a body-level placeholder such as
     * #site-header. The placeholder, rather than the inner header, may own the
     * sticky/fixed positioning. Inserting banner1 after the inner header would
     * therefore trap the advertisement inside that positioned host and make it
     * follow the viewport. Climb only through wrappers whose other children are
     * navigation helpers; application roots that also contain page content are
     * intentionally left in place.
     */
    function navigationPlacementAnchor(doc) {
        let anchor = navigationAnchor(doc);
        if (!anchor) return null;
        const harmlessSibling = function(node) {
            return /^(?:script|style|template|noscript|link)$/i.test(node.tagName || '')
                || isCustomScrollProgress(node);
        };
        while (anchor.parentElement && anchor.parentElement !== doc.body
            && anchor.parentElement !== doc.documentElement) {
            const parent = anchor.parentElement;
            if (/^(?:main|footer|article|section|aside)$/i.test(parent.tagName || '')
                || parent.matches('[role="main"], [role="contentinfo"]')) break;
            const otherChildren = Array.from(parent.children || []).filter(function(child) {
                return child !== anchor && !harmlessSibling(child);
            });
            if (otherChildren.length) break;
            anchor = parent;
        }
        return anchor;
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

    /** Structural evidence only: works before CSS loads and in source export's
     * DOM parser. Real row boundaries are measured later by the layout runtime. */
    function collectionCards(container) {
        if (!container || container.closest('a[href], button, form, [role="button"], [role="link"]')) return [];
        // An image link and a copy panel are two parts of one card, even when
        // both contain links/headings. They cannot be treated as two grid items.
        const containerName = String(container.className || '');
        if (/^(?:article|li)$/i.test(container.tagName || '')
            || (/(?:card|tile)/i.test(containerName) && !/(?:grid|list|collection)/i.test(containerName))) return [];
        const children = contentChildren(container);
        // A primary article beside a related-stories section is page structure,
        // not two cards. Never pull its in-body advertisement out into that shell.
        if (children.some(function(child) {
            return child.matches('.article-content, .article-body, .detail-content, .prose, h1') || child.querySelector('h1');
        })) return [];
        const cards = children.filter(function(child) {
            const name = String(child.className || '');
            return /^(?:article|li)$/i.test(child.tagName || '') || child.matches('a[href]')
                || /(?:card|item|tile)/i.test(name)
                || (!!child.querySelector('a[href]') && !!child.querySelector('img, h2, h3'));
        });
        return cards.length >= 2 && cards.length === children.length ? cards : [];
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
        return Array.from(candidates).filter(function(node) {
            // 卡片内部的 card-title/card-excerpt/card-footer 也可能组成四个
            // 子节点，但它们属于一个可点击卡片，不是可以插广告的卡片集合。
            // 排除链接和按钮内的候选，保留外层列表及真实正文段落回退。
            return !node.closest('a[href], button, [role="button"], [role="link"]');
        }).map(function(node) {
            const cards = collectionCards(node);
            return { node: node, cards: cards };
        }).filter(function(item) {
            return item.cards.length >= 2;
        }).sort(function(a, b) {
            return b.cards.length - a.cards.length;
        })[0] || null;
    }

    function placeholder(doc, unit) {
        const n = unit.slice(-1);
        const outer = doc.createElement('div');
        outer.id = 'adv' + n;
        outer.setAttribute('data-sitefoundry-fixed-ad', n);
        // A 300px creative may be wider than a phone's padded content column.
        // The layout runtime centers it in the viewport; clipping this wrapper
        // would silently crop a valid ad even though its bounding box fits.
        // Ads belong to the document flow. Clear positional properties as well
        // as position itself so an uploaded site's old #adv1 sticky/fixed rule
        // cannot make the preview follow the viewport while the page scrolls.
        outer.style.cssText = 'width:100%!important;text-align:center!important;padding:10px!important;display:flex!important;flex-direction:column!important;align-items:center!important;overflow:visible!important;box-sizing:border-box!important;grid-column:1 / -1!important;flex-basis:100%!important;position:relative!important;inset:auto!important;top:auto!important;right:auto!important;bottom:auto!important;left:auto!important;float:none!important;z-index:2!important;visibility:visible!important;opacity:1!important;';
        const label = doc.createElement('div');
        label.textContent = 'Advertisement';
        // Inherit the site's text color so the placement marker remains visible on dark and light themes.
        label.style.cssText = 'display:block!important;position:relative;z-index:1;text-align:center;color:inherit!important;-webkit-text-fill-color:currentColor!important;font:13px/1.4 system-ui,sans-serif!important;text-indent:0!important;visibility:visible!important;opacity:1!important;';
        const area = doc.createElement('div');
        area.id = 'div-gpt-ad-banner' + n;
        area.style.cssText = 'min-width:300px;min-height:250px;';
        outer.append(label, area);
        return outer;
    }

    /**
     * Preserve the original visual rows, independent of the number of columns.
     * This function is embedded verbatim into exports: keep every dependency
     * inside it so preview, static exports and SPA routing use the same code.
     */
    function gridRowRuntime() {
        if (typeof window.__sitefoundryGridRuntimeRefresh === 'function') {
            window.__sitefoundryGridRuntimeRefresh();
            return;
        }
        const adSelector = '[data-sitefoundry-fixed-ad], [data-sitefoundry-preview-ad], [data-sitefoundry-runtime-ad]';
        const widths = new WeakMap();
        let queued = false;
        function schedule() {
            if (queued) return;
            queued = true;
            requestAnimationFrame(function() { queued = false; position(); });
        }
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(function(entries) {
            // Reflow caused by our own ad height must not start an observer loop.
            // A container-width change, however, can alter the column count even
            // when the browser viewport itself has not been resized.
            entries.forEach(function(entry) {
                const width = entry.target.clientWidth;
                if (widths.get(entry.target) !== width) {
                    widths.set(entry.target, width);
                    schedule();
                }
            });
        }) : null;

        function positionCardRows(grid, ads) {
            const style = getComputedStyle(grid);
            if (!/^(?:inline-)?(?:grid|flex)$/.test(style.display)) return;
            if (style.display.indexOf('flex') !== -1 && style.flexDirection.indexOf('column') === 0) return;
            const cards = Array.from(grid.children).filter(function(node) {
                return !node.matches(adSelector + ', script, style, template');
            });
            if (!cards.length) return;
            if (observer && !widths.has(grid)) { widths.set(grid, grid.clientWidth); observer.observe(grid); }

            // Measure the unmodified layout. Measuring with a full-width ad in
            // place would mistake the partial row it created for an original row.
            // Never detach/reorder cards: their event handlers and state survive.
            const display = ads.map(function(ad) {
                const value = { ad: ad, value: ad.style.getPropertyValue('display'), priority: ad.style.getPropertyPriority('display') };
                ad.style.setProperty('display', 'none', 'important');
                return value;
            });
            try {
                const rows = [];
                cards.forEach(function(card, index) {
                    const rect = card.getBoundingClientRect();
                    if (rect.width < 2 || rect.height < 2) return;
                    // offsetTop ignores per-card reveal/hover transforms. Those
                    // visual effects must not be mistaken for additional rows.
                    const top = card.offsetTop;
                    let row = rows.find(function(item) { return Math.abs(item.top - top) < 3; });
                    if (!row) { row = { top: top, start: index, end: index + 1 }; rows.push(row); }
                    row.end = index + 1;
                });
                if (!rows.length) return;
                const boundaries = [0].concat(rows.map(function(row) { return row.end; }));
                const used = new Set();
                ads.forEach(function(ad) {
                    const saved = Number(ad.getAttribute('data-sitefoundry-grid-target'));
                    const target = Number.isFinite(saved) ? saved : Math.floor(cards.length / 2);
                    const candidates = boundaries.filter(function(count) { return !used.has(count); });
                    if (!candidates.length) return;
                    // Prefer an internal row boundary when one exists. A list
                    // with only a single row uses its closest outer edge rather
                    // than manufacturing two incomplete rows around the ad.
                    const internal = target > 0 && target < cards.length
                        ? candidates.filter(function(count) { return count > 0 && count < cards.length; }) : [];
                    const choices = internal.length ? internal : candidates;
                    const selected = choices.reduce(function(best, count) {
                        return Math.abs(count - target) < Math.abs(best - target) ? count : best;
                    }, choices[0]);
                    used.add(selected);
                    const next = cards[selected];
                    if (next) {
                        if (ad.nextElementSibling !== next) grid.insertBefore(ad, next);
                    } else if (grid.lastElementChild !== ad) grid.appendChild(ad);
                    ad.style.setProperty('grid-column', '1 / -1', 'important');
                    ad.style.setProperty('grid-row', 'auto', 'important');
                    ad.style.setProperty('flex', '0 0 100%', 'important');
                    ad.style.setProperty('width', '100%', 'important');
                });
            } finally {
                display.forEach(function(item) {
                    if (item.value) item.ad.style.setProperty('display', item.value, item.priority);
                    else item.ad.style.removeProperty('display');
                });
            }
        }

        function position() {
            document.querySelectorAll('[data-sitefoundry-after-navigation]').forEach(function(ad) {
                const navigation = ad.previousElementSibling;
                if (!navigation || typeof getComputedStyle !== 'function') return;
                const style = getComputedStyle(navigation);
                const height = style.position === 'fixed' ? navigation.getBoundingClientRect().height + Math.max(0, parseFloat(style.top) || 0) : 0;
                ad.style.setProperty('padding-top', (10 + height) + 'px', 'important');
            });
            const grids = new Map();
            document.querySelectorAll('[data-sitefoundry-grid-ad]').forEach(function(ad) {
                const grid = ad.parentElement;
                if (!grid) return;
                if (!grids.has(grid)) grids.set(grid, []);
                grids.get(grid).push(ad);
            });
            grids.forEach(function(ads, grid) { positionCardRows(grid, ads); });
            document.querySelectorAll(adSelector).forEach(function(ad) {
                ad.style.transform = 'none';
                const rect = ad.getBoundingClientRect();
                const offset = document.documentElement.clientWidth / 2 - (rect.left + rect.width / 2);
                ad.style.transform = 'translateX(' + Math.round(offset * 100) / 100 + 'px)';
            });
        }
        window.__sitefoundryGridRuntimeReady = true;
        window.__sitefoundryGridRuntimeRefresh = position;
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', position, { once: true });
        else position();
        window.addEventListener('resize', schedule);
        window.addEventListener('load', schedule, true);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    }

    function addGridRuntime(doc) {
        const source = '(' + gridRowRuntime.toString() + ')();';
        const existing = doc.querySelector('script[data-sitefoundry-grid-runtime]');
        if (existing) {
            // Re-imported exports can contain an older row planner. Replace its
            // serialized source rather than carrying that bug into a new export.
            if (existing.textContent !== source) existing.textContent = source;
            return;
        }
        const script = doc.createElement('script');
        script.setAttribute('data-sitefoundry-grid-runtime', '');
        script.textContent = source;
        doc.body.appendChild(script);
    }

    /** Find a content boundary, independently of route names or template classes.
     * Never enter a clickable card, a form or an interactive player. A middle
     * boundary must leave original content on both sides of the advertisement.
     */
    function middleBoundary(doc) {
        const main = contentRoot(doc);
        const excluded = 'script, style, template, nav, footer, aside, [data-sitefoundry-fixed-ad], [data-sitefoundry-preview-ad], [data-sitefoundry-runtime-ad]';
        const protectedArea = 'a, button, form, canvas, iframe, video, audio, [role="application"], [contenteditable="true"]';
        function useful(node) {
            return node && !node.matches(excluded) && !node.hidden
                && (String(node.textContent || '').trim() || node.querySelector('img, canvas, iframe, video, input'));
        }
        function children(node) { return Array.from(node.children || []).filter(useful); }
        function inside(node) {
            if (!node || node.matches(protectedArea) || node.closest('a, button, form, [role="application"]')) return null;
            const list = children(node);
            if (list.length >= 2) {
                const weight = child => Math.max(1, String(child.textContent || '').trim().length + child.querySelectorAll('img, canvas, iframe, video').length * 100);
                const total = list.reduce((sum, child) => sum + weight(child), 0);
                // A title plus one body wrapper is not the body's midpoint.
                // Descend into the dominant content wrapper before selecting a
                // boundary; skip controls, links and player containers.
                const dominant = list.find(child => children(child).length >= 2 && weight(child) > total * 0.6
                    && !child.matches(protectedArea + ', [role="link"], [class*="card"], [class*="tile"]')
                    && !child.querySelector('canvas, iframe, video, form, input, select, textarea'));
                const nested = dominant && inside(dominant);
                if (nested) return nested;
                let accumulated = 0, distance = Infinity, selected = 1;
                for (let index = 1; index < list.length; index++) {
                    accumulated += weight(list[index - 1]);
                    if (Math.abs(accumulated - total / 2) < distance) { distance = Math.abs(accumulated - total / 2); selected = index; }
                }
                return { anchor: list[selected], relation: 'before' };
            }
            if (list.length === 1) return inside(list[0]);
            // Extremely short text-only pages still need three distinct slots.
            // Split only plain text paragraphs; never duplicate rich markup,
            // interactive nodes, IDs or event handlers.
            if (/^p$/i.test(node.tagName || '') && node.childNodes.length === 1 && node.firstChild.nodeType === 3) {
                const words = node.textContent.trim().split(/\s+/);
                if (words.length >= 2) {
                    return { anchor: node, relation: 'split-text', words: words };
                }
            }
            return null;
        }
        // Prefer the actual body over excerpts in related cards. Collection
        // roots are handled by their own children, including two-card lists.
        const body = main.querySelector('.article-body, .detail-content, .prose') || main.querySelector('.article-content') || main.querySelector('article');
        if (body && (main.querySelectorAll('article').length <= 1 || body.querySelector('h1')
            || body.matches('.detail-content, .article-content, .article-body, .prose'))
            && !body.closest('a') && !/card|tile|related/i.test(String(body.className || ''))) {
            const gap = inside(body);
            if (gap) return gap;
        }
        const grid = cardGrid(main);
        if (grid) return { anchor: grid.cards[Math.max(1, Math.floor(grid.cards.length / 2))], relation: 'before', grid: true };
        return inside(main);
    }

    /**
     * A visual custom click is persisted as progress through meaningful content,
     * not as a brittle child-number path. Every sibling page resolves that
     * progress against its own safe blocks.
     */
    function semanticBoundaries(doc) {
        const main = contentRoot(doc);
        if (!main) return [];
        const excluded = 'script, style, template, nav, footer, aside, [data-sitefoundry-fixed-ad], [data-sitefoundry-preview-ad], [data-sitefoundry-runtime-ad], .related-section, [class*="related"]';
        const protectedArea = 'a, button, form, [role="button"], [role="link"], [role="application"], [contenteditable="true"]';
        const candidates = Array.from(main.querySelectorAll('p, li, h2, h3, h4, section, article, figure, blockquote, div')).filter(function(node) {
            if (!node.parentNode || node.matches(excluded) || node.closest(protectedArea)) return false;
            if (node.closest('[data-sitefoundry-fixed-ad], [data-sitefoundry-preview-ad], [data-sitefoundry-runtime-ad]')) return false;
            const identity = String(node.className || '') + ' ' + String(node.id || '');
            if (/related|recommend/i.test(identity)) return false;
            return !!(String(node.textContent || '').trim() || node.querySelector('img, canvas, iframe, video'));
        }).filter(function(node, index, values) {
            // Prefer the deepest readable block. Keeping both a wrapper and its
            // only paragraph would make equal pages resolve to different gaps.
            return !values.some(function(other) {
                return other !== node && node.contains(other)
                    && /^(?:p|li|h2|h3|h4|figure|blockquote)$/i.test(other.tagName || '');
            });
        });
        candidates.sort(function(a, b) {
            if (a === b) return 0;
            return a.compareDocumentPosition(b) & 4 ? -1 : 1;
        });
        return candidates.map(function(anchor, index) {
            return { anchor: anchor, relation: 'after', ratio: Math.round(((index + 1) / (candidates.length + 1)) * 1000) };
        });
    }

    function ratioBoundary(doc, value) {
        const candidates = semanticBoundaries(doc);
        if (!candidates.length) {
            const middle = middleBoundary(doc);
            if (middle) middle.adjusted = true;
            return middle;
        }
        const ratio = Math.max(0, Math.min(1000, Number(value) || 0));
        const selected = candidates.reduce(function(best, candidate) {
            return Math.abs(candidate.ratio - ratio) < Math.abs(best.ratio - ratio) ? candidate : best;
        }, candidates[0]);
        return { anchor: selected.anchor, relation: selected.relation, ratio: selected.ratio, adjusted: selected.ratio !== ratio };
    }

    /** One semantic resolver shared by static export, preview and SPA routing. */
    function placementBoundary(doc, pageType, position) {
        const main = contentRoot(doc);
        const header = navigationPlacementAnchor(doc);
        const footer = pageFooter(doc);
        const content = main.querySelector('.detail-content, .article-content, .article-body, .prose, article') || main;
        if (position === 'after-navbar') return header ? { anchor: header, relation: 'after' } : { anchor: main, relation: 'before' };
        if (position === 'footer-top') return footer ? { anchor: footer, relation: 'before' } : null;
        if (/^(?:content-middle|detail-middle|detail-after-content)$/.test(position)) return middleBoundary(doc);
        if (position === 'detail-before-content') return content === main
            ? { anchor: main.firstElementChild, relation: 'before' } : { anchor: content, relation: 'before' };
        if (position === 'content-top') return { anchor: main.firstElementChild, relation: 'before' };
        if (position === 'content-bottom') return { anchor: main.lastElementChild, relation: 'after' };
        if (position === 'after-hero') return { anchor: main.querySelector('.hero, [class*="hero"]') || main.firstElementChild, relation: 'after' };
        const section = /^after-section-(\d+)$/.exec(position || '');
        if (section) {
            const sections = Array.from(main.children || []).filter(function(node) { return /^section$/i.test(node.tagName || ''); });
            return { anchor: sections[Number(section[1])], relation: 'after' };
        }
        const paragraph = /^detail-between-p-(\d+)$/.exec(position || '');
        if (paragraph) return { anchor: content.querySelectorAll('p')[Number(paragraph[1]) - 1], relation: 'after' };
        if (/^detail-(?:before|after)-related$/.test(position)) return {
            anchor: main.querySelector('.related-section, [class*="related"], [id*="related"]'),
            relation: position === 'detail-before-related' ? 'before' : 'after'
        };
        const ratio = /^content-ratio-(\d{1,4})$/.exec(position || '');
        if (ratio) return ratioBoundary(doc, Number(ratio[1]));
        const custom = /^custom-after-((?:\d+)(?:-\d+)*)$/.exec(position || '');
        if (custom) {
            let target = main;
            for (const index of custom[1].split('-').map(Number)) {
                const candidates = contentChildren(target).filter(function(node) {
                    return !node.hasAttribute('data-sitefoundry-preview-ad') && !node.hasAttribute('data-sitefoundry-runtime-ad');
                });
                target = candidates[index];
                if (!target) {
                    const fallback = middleBoundary(doc);
                    if (fallback) fallback.adjusted = true;
                    return fallback;
                }
            }
            return { anchor: target, relation: 'after' };
        }
        return null;
    }

    /** A semantic click can target a paragraph inside a card. Promote that gap
     * to the whole card and retain its logical index for responsive row snapping.
     * No column count is guessed while the document is detached from layout. */
    function cardSafeBoundary(doc, gap) {
        if (!gap || !gap.anchor || gap.relation === 'split-text') return gap;
        let card = gap.anchor;
        const main = contentRoot(doc);
        while (card && card !== main && card !== doc.body) {
            const parent = card.parentElement;
            const cards = collectionCards(parent);
            const index = cards.indexOf(card);
            if (index !== -1) {
                return Object.assign({}, gap, {
                    anchor: card, grid: true,
                    gridTarget: index + (gap.relation === 'before' ? 0 : 1),
                    adjusted: !!gap.adjusted || card !== gap.anchor
                });
            }
            card = parent;
        }
        return gap;
    }

    function insertResolvedBoundary(doc, originalGap, node) {
        const gap = cardSafeBoundary(doc, originalGap);
        if (!gap || !gap.anchor || !gap.anchor.parentNode) return false;
        node.removeAttribute('data-sitefoundry-grid-ad');
        node.removeAttribute('data-sitefoundry-grid-target');
        if (gap.grid) {
            node.setAttribute('data-sitefoundry-grid-ad', '');
            node.setAttribute('data-sitefoundry-grid-target', String(gap.gridTarget));
        }
        if (gap.adjusted) node.setAttribute('data-sitefoundry-placement-adjusted', '');
        gap.anchor.parentNode.insertBefore(node, gap.relation === 'before' ? gap.anchor : gap.anchor.nextSibling);
        return true;
    }

    function insertAtPosition(doc, pageType, position, node) {
        const gap = placementBoundary(doc, pageType, position);
        if (!gap || !gap.anchor || !gap.anchor.parentNode) return false;
        if (gap.relation === 'split-text') {
            const tail = doc.createElement('p');
            tail.textContent = gap.words.slice(Math.ceil(gap.words.length / 2)).join(' ');
            gap.anchor.firstChild.textContent = gap.words.slice(0, Math.ceil(gap.words.length / 2)).join(' ') + ' ';
            gap.anchor.parentNode.insertBefore(tail, gap.anchor.nextSibling);
            gap.anchor = tail;
            gap.relation = 'before';
        }
        if (position === 'after-navbar') node.setAttribute('data-sitefoundry-after-navigation', '');
        if (position === 'after-navbar' && node.id === 'adv1') applyAfterNavigationOffset(doc, node, navigationAnchor(doc));
        if (/^(?:custom-after-|content-ratio-)/.test(position)) {
            node.classList.add('sitefoundry-ad-custom-placement');
            node.style.setProperty('--sitefoundry-ad-center-offset', '0px');
        }
        return insertResolvedBoundary(doc, gap, node);
    }

    function orderedAds(doc) {
        // querySelectorAll is already in document order. Keeping that native
        // order also avoids compareDocumentPosition bit differences in the
        // lightweight DOM used by source export verification.
        return Array.from(doc.querySelectorAll('[data-sitefoundry-fixed-ad]'));
    }

    function originalContentBetween(doc, first, second) {
        let active = false;
        let done = false;
        let found = false;
        function visit(node) {
            if (!node || done || found) return;
            if (node === first) { active = true; return; }
            if (node === second) { done = true; return; }
            if (node.nodeType === 1 && node.matches('[data-sitefoundry-fixed-ad], [data-sitefoundry-preview-ad], [data-sitefoundry-runtime-ad], script, style, template')) return;
            if (active && node.nodeType === 3 && String(node.textContent || '').trim()) { found = true; return; }
            if (active && node.nodeType === 1 && node.matches('img, canvas, iframe, video, audio')) { found = true; return; }
            Array.from(node.childNodes || []).forEach(visit);
        }
        visit(doc.body);
        return found;
    }

    function splitPlainContent(doc) {
        const paragraphs = Array.from(contentRoot(doc).querySelectorAll('p, li')).filter(function(node) {
            return node.childNodes.length === 1 && node.firstChild.nodeType === 3 && !node.closest('a, button, form, [role="application"]');
        }).sort(function(a, b) { return String(b.textContent || '').length - String(a.textContent || '').length; });
        const paragraph = paragraphs[0];
        if (!paragraph) return false;
        const source = String(paragraph.textContent || '').trim();
        let parts = source.split(/\s+/);
        let separator = ' ';
        if (parts.length < 2 && source.length >= 2) { parts = Array.from(source); separator = ''; }
        if (parts.length < 2) return false;
        const midpoint = Math.ceil(parts.length / 2);
        paragraph.textContent = parts.slice(0, midpoint).join(separator);
        const tail = doc.createElement(String(paragraph.tagName || 'p').toLowerCase());
        tail.textContent = parts.slice(midpoint).join(separator);
        paragraph.parentNode.insertBefore(tail, paragraph.nextSibling);
        return true;
    }

    function preferredRatio(position) {
        const ratio = /^content-ratio-(\d{1,4})$/.exec(position || '');
        if (ratio) return Math.max(0, Math.min(1000, Number(ratio[1])));
        if (position === 'after-navbar' || position === 'content-top' || position === 'detail-before-content') return 0;
        if (position === 'footer-top' || position === 'content-bottom' || position === 'detail-after-related') return 1000;
        return 500;
    }

    /** Move only an adjacent advertisement, preserving the selected order and
     * the original content. Short plain paragraphs may be split once per retry. */
    function repairPlacementSeparation(doc, slots, result) {
        const slotByUnit = {};
        (slots || []).forEach(function(slot) { if (slot && /^banner[123]$/.test(slot.unit)) slotByUnit[slot.unit] = slot; });
        for (let attempt = 0; attempt < 8; attempt++) {
            const ads = orderedAds(doc);
            let badIndex = -1;
            for (let index = 0; index + 1 < ads.length; index++) {
                if (!originalContentBetween(doc, ads[index], ads[index + 1])) { badIndex = index; break; }
            }
            if (badIndex < 0) return;
            const moving = ads[badIndex + 1];
            const unit = 'banner' + moving.getAttribute('data-sitefoundry-fixed-ad');
            const originalParent = moving.parentNode;
            const originalNext = moving.nextSibling;
            moving.remove();
            let candidates = semanticBoundaries(doc);
            if (!candidates.length || candidates.length < ads.length - 1) {
                splitPlainContent(doc);
                candidates = semanticBoundaries(doc);
            }
            const wanted = preferredRatio(slotByUnit[unit] && slotByUnit[unit].position);
            candidates.sort(function(a, b) { return Math.abs(a.ratio - wanted) - Math.abs(b.ratio - wanted); });
            let repaired = false;
            for (const candidate of candidates) {
                insertResolvedBoundary(doc, candidate, moving);
                const ordered = orderedAds(doc);
                const at = ordered.indexOf(moving);
                const beforeOk = at <= 0 || originalContentBetween(doc, ordered[at - 1], moving);
                const afterOk = at < 0 || at + 1 >= ordered.length || originalContentBetween(doc, moving, ordered[at + 1]);
                if (beforeOk && afterOk) { repaired = true; break; }
                moving.remove();
            }
            if (!repaired && splitPlainContent(doc)) {
                candidates = semanticBoundaries(doc).sort(function(a, b) { return Math.abs(a.ratio - wanted) - Math.abs(b.ratio - wanted); });
                for (const candidate of candidates) {
                    insertResolvedBoundary(doc, candidate, moving);
                    const ordered = orderedAds(doc);
                    const at = ordered.indexOf(moving);
                    if ((at <= 0 || originalContentBetween(doc, ordered[at - 1], moving))
                        && (at + 1 >= ordered.length || originalContentBetween(doc, moving, ordered[at + 1]))) { repaired = true; break; }
                    moving.remove();
                }
            }
            if (!repaired) {
                if (originalNext && originalNext.parentNode === originalParent) originalParent.insertBefore(moving, originalNext);
                else originalParent.appendChild(moving);
                result.skipped.push({ unit: unit, reason: '页面内容不足，无法让相邻广告之间保留原站内容' });
                return;
            }
            if (result.adjusted.indexOf(unit) === -1) result.adjusted.push(unit);
        }
    }

    function decoratePreview(doc) {
        // This is called only by the tool preview. No generated source or
        // exported runtime calls it unless previewPageType was explicitly set.
        [1, 2, 3].forEach(function(n) {
            const area = doc.getElementById('div-gpt-ad-banner' + n);
            if (!area || area.querySelector('[data-sitefoundry-preview-creative]')) return;
            const creative = doc.createElement('div');
            creative.setAttribute('data-sitefoundry-preview-creative', String(n));
            creative.textContent = 'banner' + n + ' · 广告预览';
            creative.style.cssText = 'width:300px;height:250px;max-width:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:center;background:#bbc6d6;color:#245a8d;border:1px dashed #7895bc;font:12px/1.4 system-ui,sans-serif;';
            area.appendChild(creative);
        });
    }

    function placePolicy(doc, pageType, slots) {
        const result = { placed: [], skipped: [], adjusted: [] };
        (slots || []).forEach(function(slot) {
            if (!slot || !/^banner[123]$/.test(slot.unit) || slot.position === 'off') return;
            const node = placeholder(doc, slot.unit);
            if (insertAtPosition(doc, pageType, slot.position, node)) {
                result.placed.push(slot.unit);
                if (node.hasAttribute('data-sitefoundry-placement-adjusted')) {
                    result.adjusted.push(slot.unit);
                    node.removeAttribute('data-sitefoundry-placement-adjusted');
                }
            }
            else result.skipped.push({ unit: slot.unit, reason: '无法定位 ' + slot.position });
        });
        repairPlacementSeparation(doc, slots, result);
        // Manual previews previously skipped this runtime entirely. Install it
        // from the shared entry point used by every placement mode and export.
        addGridRuntime(doc);
        return result;
    }

    function validatePlacements(doc, slots) {
        const errors = [];
        (slots || []).forEach(function(slot) {
            if (!slot || !/^banner[123]$/.test(slot.unit) || slot.position === 'off') return;
            const matches = doc.querySelectorAll('#div-gpt-ad-' + slot.unit);
            if (matches.length !== 1) { errors.push(slot.unit + ' 必须且只能有一个广告容器'); return; }
            const ad = doc.getElementById('adv' + slot.unit.slice(-1));
            if (!ad) return;
        });
        const ads = orderedAds(doc);
        for (let index = 0; index + 1 < ads.length; index++) {
            if (!originalContentBetween(doc, ads[index], ads[index + 1])) {
                errors.push('banner' + ads[index].getAttribute('data-sitefoundry-fixed-ad') + ' 与 banner'
                    + ads[index + 1].getAttribute('data-sitefoundry-fixed-ad') + ' 之间没有原站内容');
            }
        }
        return errors;
    }

    function place(doc, pageType, config, options) {
        const positions = ['after-navbar', 'content-middle', 'footer-top'];
        const slots = activeUnits(config).map(function(unit) {
            return { unit: unit, position: positions[Number(unit.slice(-1)) - 1] };
        });
        const result = placePolicy(doc, pageType, slots);
        if (options && options.live) gridRowRuntime();
        else addGridRuntime(doc);
        return result;
    }

    function serialize(doc) {
        return '<!doctype html>\n' + doc.documentElement.outerHTML;
    }

    function previewPlaceholder(doc, unit) {
        const node = placeholder(doc, unit);
        node.removeAttribute('data-sitefoundry-fixed-ad');
        node.setAttribute('data-sitefoundry-preview-ad', unit.slice(-1));
        const area = node.querySelector('[id^="div-gpt-ad-banner"]');
        const previewDoc = { getElementById: function(id) { return area && area.id === id ? area : null; }, createElement: function(tag) { return doc.createElement(tag); } };
        decoratePreview(previewDoc);
        return node;
    }

    return { normalizeVersion: normalizeVersion, isContentPath: isContentPath, isDeployableContentPath: isDeployableContentPath, isHomePath: isHomePath, contentPageType: contentPageType,
        activeUnits: activeUnits, navigationAnchor: navigationAnchor, pageFooter: pageFooter,
        previewPlaceholder: previewPlaceholder, isCustomScrollProgress: isCustomScrollProgress,
        adjacentScrollProgress: adjacentScrollProgress, applyAfterNavigationOffset: applyAfterNavigationOffset,
        place: place, placePolicy: placePolicy, insertAtPosition: insertAtPosition, createPlaceholder: placeholder,
        repairPlacements: repairPlacementSeparation,
        decoratePreview: decoratePreview, placementBoundary: placementBoundary, semanticBoundaries: semanticBoundaries,
        validatePlacements: validatePlacements, refreshLayout: gridRowRuntime,
        installLayout: addGridRuntime, serialize: serialize };
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
        previewPageType: options && options.previewPageType || '', waitForLoad: !!(options && options.waitForLoad),
        previewPath: options && options.previewPath || '',
        policy: options && options.policy || null })
        .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
    function runtime(input) {
        const planner = createFinishedSiteAds();
        const paths = input.paths;
        const version = input.version;
        const state = { route: '', slots: [], services: false, timer: 0, observers: [], generation: 0 };
        window.googletag = window.googletag || { cmd: [] };
        function refreshAds(home, content, page) {
            const generation = ++state.generation;
            state.observers.forEach(function(observer) { observer.disconnect(); });
            state.observers = [];
            googletag.cmd.push(function() {
                if (generation !== state.generation) return;
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
                        if (generation !== state.generation || !element.isConnected) return;
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
                    if (paths.interstitialPath && (input.policy
                        ? (input.policy.outOfPage.interstitial[page] == null ? input.policy.outOfPage.interstitial.detail : input.policy.outOfPage.interstitial[page])
                        : home)) {
                        const interstitial = googletag.defineOutOfPageSlot(paths.interstitialPath, googletag.enums.OutOfPageFormat.INTERSTITIAL);
                        if (interstitial) {
                            state.slots.push(interstitial.addService(googletag.pubads()));
                            if (version === 'v1.0.1' && interstitial.setConfig) interstitial.setConfig({ interstitial: {
                                triggers: { unhideWindow: true, navBar: true, inactivity: true, endOfArticle: true, continueReading: true }
                            } });
                            readyToDisplay.push(interstitial);
                        }
                    }
                    if (paths.anchorPath && (!input.policy
                        || (input.policy.outOfPage.anchor[page] == null ? input.policy.outOfPage.anchor.detail : input.policy.outOfPage.anchor[page]))) {
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
            const page = pageScope();
            const pageSlots = input.policy ? (input.policy.slots[page] || input.policy.slots.detail || []) : [];
            const wanted = input.policy ? pageSlots
                .filter(function(slot) { return /^banner[123]$/.test(slot.unit) && slot.position !== 'off'; }).length : planner.activeUnits(paths).length;
            if (route === state.route && existing === wanted) {
                if (input.previewPageType) planner.decoratePreview(document);
                return;
            }
            document.querySelectorAll('[data-sitefoundry-fixed-ad]').forEach(function(node) { node.remove(); });
            const content = input.previewPath ? planner.isContentPath(input.previewPath) : input.previewPageType ? true : planner.isContentPath(location.pathname);
            const home = input.previewPath ? input.previewPath === '/' || /^\/index\.html?$/.test(input.previewPath) : input.previewPageType ? input.previewPageType === 'home'
                : location.pathname === '/' || /^\/index\.html?$/i.test(location.pathname);
            const plan = !content ? { placed: [], skipped: [] } : input.policy
                ? planner.placePolicy(document, page, pageSlots)
                : planner.place(document, home ? 'home' : 'detail', paths, { live: true });
            centerCustom();
            if (input.previewPageType) planner.decoratePreview(document);
            if (plan.skipped.length) {
                console.warn('[SiteFoundry Ads] 固定广告位已跳过，请手动选择：', plan.skipped);
            }
            if (input.previewPageType && window.parent !== window) {
                window.parent.postMessage({ type: 'ad-injection-fixed-skipped', skipped: plan.skipped }, '*');
            }
            state.route = route;
            if (!input.previewPageType && (plan.placed.length || state.slots.length)) refreshAds(home, content, page);
        }
        function centerCustom() { planner.refreshLayout(); }
        function pageScope() {
            if (input.previewPageType) return input.previewPageType;
            const path = input.previewPath || location.pathname;
            return planner.contentPageType(path, document, '/');
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
        new MutationObserver(function(records) {
            // Observe application rendering, not our own slot creation or GPT
            // creative updates. This also catches delayed clientLoader content
            // and partial route renders without starting an insertion loop.
            const own = '[data-sitefoundry-fixed-ad], [data-sitefoundry-grid-runtime], [data-sitefoundry-preview-creative], script, style, link, meta, [id^="google_"]';
            const changed = records.some(function(record) {
                if (record.target.nodeType === 1 && record.target.closest(own)) return false;
                return Array.from(record.addedNodes).concat(Array.from(record.removedNodes)).some(function(node) {
                    return node.nodeType === 1 && !node.matches(own) && !node.closest(own);
                });
            });
            if (changed) { state.route = ''; schedule(); }
        }).observe(document.documentElement, { childList: true, subtree: true });
        if (paths.analyticsID && !input.previewPageType) {
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
    return '/** 成品站 ad.js ' + FinishedSiteAds.normalizeVersion(version) + ' · ' + (options && options.policy ? 'manual SPA runtime' : 'responsive runtime') + ' */\n' +
        '(function(createFinishedSiteAds){(' + runtime.toString() + ')(' + payload + ');})(' + createFinishedSiteAds.toString() + ');\n';
};

if (typeof module !== 'undefined' && module.exports) module.exports = FinishedSiteAds;
