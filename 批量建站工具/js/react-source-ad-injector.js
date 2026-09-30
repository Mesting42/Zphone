import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';

// React 源码修改器：仅在 Babel 能解析且能定位 <main> 的文件中写入 JSX。
// 找不到安全锚点时返回报告，不以字符串替换破坏用户工程。
const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

function pathOf(entry) { return String(entry.path || entry.name || '').replace(/\\/g, '/').replace(/^\/+/, ''); }
function bytes(text) { return encoder.encode(String(text)); }
function textOf(entry) { return decoder.decode(entry.bytes || bytes(entry.text || '')); }
function issue(message, code) { return { message, code }; }

function adComponentSource(typed) {
    return `import { useEffect } from 'react';

${typed ? `
export type AdvertisementId = 'banner1' | 'banner2' | 'banner3';
` : ''}

const AD_SLOTS = {
  banner1: { containerId: 'adv1', elementId: 'div-gpt-ad-banner1', label: 'advertisement1' },
  banner2: { containerId: 'adv2', elementId: 'div-gpt-ad-banner2', label: 'advertisement2' },
  banner3: { containerId: 'adv3', elementId: 'div-gpt-ad-banner3', label: 'advertisement3' },
}${typed ? ' as const' : ''};

export function Advertisement({ id, className = '' }${typed ? `: { id: AdvertisementId; className?: string }` : ''}) {
  const { containerId, elementId, label } = AD_SLOTS[id];
  useEffect(() => { window.refreshClarivoBanners?.(); }, []);
  return <div className={className}>
    <div id={containerId} style={{ textAlign: 'center', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden', marginTop: '1px' }}>
      {/* Inherit the page theme so this marker stays legible on dark and light pages. */}
      <div style={{ textAlign: 'center', color: 'inherit', WebkitTextFillColor: 'currentColor', fontSize: '13px' }}>{label}</div>
      <div id={elementId} style={{ minWidth: '300px', minHeight: '250px' }} />
    </div>
  </div>;
}

export default Advertisement;
`;
}

function typesSource() {
    return `export {};
declare global { interface Window { refreshClarivoBanners?: () => void; } }
`;
}

function jsxAd(id, customCentered) {
    const advertisement = t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('Advertisement'), [t.jsxAttribute(t.jsxIdentifier('id'), t.stringLiteral(id))], true),
        null,
        [],
        true
    );
    if (!customCentered) return advertisement;
    const style = t.objectExpression([
        t.objectProperty(t.identifier('position'), t.stringLiteral('relative')),
        t.objectProperty(t.identifier('transform'), t.stringLiteral('translateX(var(--sitefoundry-ad-center-offset, 0px))'))
    ]);
    return t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('div'), [
            t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral('sitefoundry-ad-custom-placement')),
            t.jsxAttribute(t.jsxIdentifier('style'), t.jsxExpressionContainer(style))
        ], false),
        t.jsxClosingElement(t.jsxIdentifier('div')),
        [t.jsxText('\n    '), advertisement, t.jsxText('\n    ')],
        false
    );
}

function addImport(ast, relativePath, importKind) {
    const declarations = ast.program.body.filter((node) => t.isImportDeclaration(node) && node.source.value === relativePath);
    const already = declarations.some((node) => node.specifiers.some((specifier) => t.isIdentifier(specifier.local, { name: 'Advertisement' })));
    if (already) return;
    const specifier = importKind === 'named'
        ? t.importSpecifier(t.identifier('Advertisement'), t.identifier('Advertisement'))
        : t.importDefaultSpecifier(t.identifier('Advertisement'));
    if (declarations[0]) declarations[0].specifiers.push(specifier);
    else ast.program.body.unshift(t.importDeclaration([specifier], t.stringLiteral(relativePath)));
}

function jsxAttributeString(opening, name) {
    const attribute = opening.attributes.find((item) => t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name }));
    return attribute && t.isStringLiteral(attribute.value) ? attribute.value.value : '';
}

function meaningfulChildIndexes(target) {
    const indexes = [];
    (target.children || []).forEach((child, index) => {
        if (t.isJSXText(child) && !child.value.trim()) return;
        if (t.isJSXExpressionContainer(child) && t.isJSXEmptyExpression(child.expression)) return;
        indexes.push(index);
    });
    return indexes;
}

function fractionIndex(target, fraction) {
    const indexes = meaningfulChildIndexes(target);
    if (!indexes.length) return target.children.length;
    const count = Math.max(1, Math.ceil(indexes.length * fraction));
    return indexes[Math.min(count - 1, indexes.length - 1)] + 1;
}

function jsxTagName(element) {
    return t.isJSXIdentifier(element && element.openingElement && element.openingElement.name)
        ? element.openingElement.name.name
        : '';
}

function detailContentTarget(outerTarget) {
    // The finished-site preview treats every non-root URL as a detail-policy
    // page. A flat directory route such as /tools can still contain multiple
    // top-level sections; its "content middle" is the gap between those
    // sections, not the middle of the richer heading/search section inside it.
    const directSections = meaningfulChildIndexes(outerTarget).filter((index) => {
        const child = outerTarget.children[index];
        return t.isJSXElement(child) && jsxTagName(child).toLowerCase() === 'section';
    });
    if (directSections.length >= 2) return outerTarget;
    let best = outerTarget;
    let bestCount = meaningfulChildIndexes(outerTarget).length;
    const allowed = new Set(['main', 'article', 'div', 'section']);
    const excluded = new Set(['nav', 'header', 'footer', 'aside', 'ul', 'ol', 'table']);
    function visit(node) {
        (node.children || []).forEach((child) => {
            if (!t.isJSXElement(child)) return;
            const tag = jsxTagName(child).toLowerCase();
            if (!excluded.has(tag) && allowed.has(tag)) {
                const count = meaningfulChildIndexes(child).length;
                if (count >= 2 && count > bestCount) {
                    best = child;
                    bestCount = count;
                }
            }
            if (!excluded.has(tag)) visit(child);
        });
    }
    visit(outerTarget);
    return best;
}

function customPlacementPath(position) {
    const match = String(position || '').match(/^custom-after-((?:\d+)(?:-\d+)*)$/);
    return match ? match[1].split('-').map(Number) : null;
}

function customMeaningfulChildIndexes(target) {
    const excluded = new Set(['script', 'style', 'template', 'header', 'nav', 'footer', 'aside']);
    return meaningfulChildIndexes(target).filter((index) => {
        const child = target.children[index];
        if (!t.isJSXElement(child)) return true;
        const tag = jsxTagName(child).toLowerCase();
        return tag !== 'advertisement' && !excluded.has(tag);
    });
}

function resolveCustomPlacement(root, position) {
    const path = customPlacementPath(position);
    if (!path || !root) return null;
    let parent = root;
    for (let depth = 0; depth < path.length; depth++) {
        const indexes = customMeaningfulChildIndexes(parent);
        if (!indexes.length) return null;
        const actualIndex = indexes[Math.min(path[depth], indexes.length - 1)];
        if (depth === path.length - 1) return { target: parent, index: actualIndex + 1 };
        const child = parent.children[actualIndex];
        if (!t.isJSXElement(child)) return { target: parent, index: actualIndex + 1 };
        if (!customMeaningfulChildIndexes(child).length) return { target: parent, index: actualIndex + 1 };
        parent = child;
    }
    return null;
}

function placementIndex(target, position) {
    const children = target.children;
    if (/^(?:after-navbar|after-hero|content-top|detail-before-content)$/i.test(position)) return 0;
    const sectionMatch = String(position || '').match(/after-section-(\d+)/i);
    if (sectionMatch) {
        const wanted = Number(sectionMatch[1]);
        const sections = [];
        children.forEach((child, index) => {
            if (t.isJSXElement(child) && t.isJSXIdentifier(child.openingElement.name, { name: 'section' })) sections.push(index);
        });
        return sections[wanted] == null ? Math.ceil(children.length / 2) : sections[wanted] + 1;
    }
    if (/between-p-1/i.test(position)) return fractionIndex(target, 1 / 3);
    if (/between-p-2|between-p-3/i.test(position)) return fractionIndex(target, 2 / 3);
    if (/after-content/i.test(position)) return fractionIndex(target, 1 / 2);
    if (/before-related/i.test(position)) return fractionIndex(target, 2 / 3);
    return children.length;
}

function targetForPlacement(pageTarget, contentTarget, pageType, position) {
    if (pageType !== 'detail') return pageTarget;
    if (/^detail-(?:before-content|between-p-[123]|after-content|before-related)$/i.test(String(position || ''))) return contentTarget;
    return pageTarget;
}

function injectPage(source, extension, importPath, importKind, pageType, slots) {
    let ast;
    try {
        ast = parse(source, { sourceType: 'module', plugins: ['jsx', extension === 'tsx' ? 'typescript' : null].filter(Boolean) });
    } catch (error) {
        return { changed: false, error: issue('Babel 无法安全解析该 React 页面：' + error.message, 'REACT_AD_AST_PARSE_FAILED') };
    }
    let target = null;
    let routeShell = null;
    const existingAds = new Set();
    traverse(ast, {
        ReturnStatement(path) {
            if (routeShell || !t.isJSXElement(path.node.argument)) return;
            const opening = path.node.argument.openingElement;
            if (t.isJSXIdentifier(opening.name) && /^[A-Z]/.test(opening.name.name) && path.node.argument.closingElement) {
                routeShell = path.node.argument;
            }
        },
        JSXElement(path) {
            const opening = path.node.openingElement;
            if (!target && t.isJSXIdentifier(opening.name, { name: 'main' })) target = path.node;
            if (t.isJSXIdentifier(opening.name, { name: 'Advertisement' })) {
                const id = jsxAttributeString(opening, 'id');
                if (/^banner[123]$/.test(id)) existingAds.add(id);
            }
        }
    });
    if (existingAds.size === 3) return { changed: false, verified: true };
    // TanStack/React Router pages often return <SiteLayout> while the actual
    // <main> lives inside that reusable layout. Adding route children to the
    // returned shell is still an AST-safe, page-specific insertion point.
    if (!target && routeShell) target = routeShell;
    if (!target) return { changed: false, error: issue('未找到 <main> 语义容器，且页面广告位不完整；未修改该页面。', 'REACT_AD_SAFE_ANCHOR_MISSING') };
    const existing = new Set();
    traverse(ast, { JSXAttribute(path) { if (t.isJSXIdentifier(path.node.name, { name: 'id' }) && t.isStringLiteral(path.node.value)) existing.add(path.node.value.value); } });
    const requested = Array.isArray(slots) && slots.length
        ? slots.filter((slot) => slot && /^banner[123]$/.test(slot.unit) && slot.position !== 'off')
        : [
            { unit: 'banner1', position: 'after-navbar' },
            { unit: 'banner2', position: 'after-section-0' },
            { unit: 'banner3', position: 'footer-top' }
        ];
    const contentTarget = pageType === 'detail' ? detailContentTarget(target) : target;
    const planned = [];
    for (const slot of requested) {
        const custom = resolveCustomPlacement(target, slot.position);
        if (customPlacementPath(slot.position)) {
            if (!custom) return { changed: false, error: issue('无法把预览中选择的自定义广告位置映射回 React 源码；未修改该页面。', 'REACT_AD_CUSTOM_ANCHOR_MISSING') };
            planned.push({ id: slot.unit, target: custom.target, index: custom.index, customCentered: true });
            continue;
        }
        const placementTarget = targetForPlacement(target, contentTarget, pageType, slot.position);
        planned.push({ id: slot.unit, target: placementTarget, index: placementIndex(placementTarget, slot.position), customCentered: false });
    }
    const offsets = new Map();
    planned.forEach(({ id, target: placementTarget, index, customCentered }) => {
        const domId = 'div-gpt-ad-' + id;
        if (existing.has(domId) || existingAds.has(id)) return;
        const offset = offsets.get(placementTarget) || 0;
        placementTarget.children.splice(Math.min(index + offset, placementTarget.children.length), 0, t.jsxText('\n    '), jsxAd(id, customCentered), t.jsxText('\n    '));
        offsets.set(placementTarget, offset + 3);
    });
    addImport(ast, importPath, importKind);
    return { changed: true, text: generate(ast, { retainLines: false, comments: true }, source).code + '\n' };
}

function isCandidate(path) {
    return /^src\/(?:routes|pages)\/.+\.(?:tsx|jsx)$/i.test(path) || /^src\/(?:App|app)\.(?:tsx|jsx)$/i.test(path);
}

const UTILITY_ROUTE_TOKENS = new Set([
    '__root', '_root', 'root', 'layout', '_layout', 'route',
    'error', '_error', 'not-found', 'notfound', '404', 'api',
    'sitemap', 'robots', 'manifest', '_app', '_document',
    'about', 'contact', 'faq', 'privacy', 'terms', 'legal',
    'login', 'signin', 'signup', 'auth', 'account', 'settings', 'admin', 'dashboard'
]);

function routeStem(path) {
    const normalized = pathOf({ path });
    if (/^src\/(?:App|app)\.(?:tsx|jsx)$/i.test(normalized)) return 'index';
    const match = normalized.match(/^src\/(?:routes|pages)\/(.+)\.(?:tsx|jsx)$/i);
    return match ? match[1] : '';
}

function routeTokens(stem) {
    return String(stem || '')
        .replace(/\[(?:\.{3})?([^\]]+)\]/g, '/$1/')
        .replace(/\$([A-Za-z0-9_]+)/g, '/$1/')
        .split(/[\/._-]+/)
        .map((token) => token.toLowerCase())
        .filter(Boolean);
}

function isUtilityRoute(path) {
    const normalized = pathOf({ path });
    if (/^src\/pages\/(?:_app|_document|_error)\.(?:tsx|jsx)$/i.test(normalized)) return true;
    const stem = routeStem(normalized);
    if (!stem) return true;
    return routeTokens(stem).some((token) => UTILITY_ROUTE_TOKENS.has(token));
}

function pageTypeFor(path) {
    const normalized = pathOf({ path });
    if (/^src\/(?:App|app)\.(?:tsx|jsx)$/i.test(normalized)) return 'home';
    const stem = routeStem(normalized);
    if (!stem || isUtilityRoute(normalized)) return null;
    // Match the preview router: only the site's root route receives the home
    // policy. /tools, /blog and other non-root listing routes use the detail
    // policy the user actually saw and configured in the preview.
    return /^(?:_?index)$/i.test(stem) ? 'home' : 'detail';
}

function choosePages(entries) {
    return entries.filter((entry) => {
        const path = pathOf(entry);
        return isCandidate(path) && pageTypeFor(path) != null;
    });
}

function componentStatus(entries) {
    const entry = entries.find((item) => /^src\/components\/advertisement\.(?:tsx|jsx)$/i.test(pathOf(item)));
    if (!entry) return { entry: null, compatible: false };
    const source = textOf(entry);
    const hasNamedExport = /export\s+(?:function|class|const|let|var)\s+Advertisement\b|export\s*\{[^}]*\bAdvertisement\b/i.test(source);
    const hasDefaultExport = /export\s+default\s+(?:function\s+Advertisement\b|Advertisement\b)/i.test(source);
    return {
        entry,
        compatible: (hasNamedExport || hasDefaultExport)
            && /div-gpt-ad-banner1/.test(source)
            && /refreshClarivoBanners/.test(source),
        importKind: hasDefaultExport ? 'default' : 'named'
    };
}

function scriptElement(src, asyncScript) {
    const attributes = [];
    if (asyncScript) attributes.push(t.jsxAttribute(t.jsxIdentifier('async'), null));
    else attributes.push(t.jsxAttribute(t.jsxIdentifier('defer'), null));
    attributes.push(t.jsxAttribute(t.jsxIdentifier('src'), t.stringLiteral(src)));
    if (asyncScript) attributes.push(t.jsxAttribute(t.jsxIdentifier('crossOrigin'), t.stringLiteral('anonymous')));
    return t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('script'), attributes, true), null, [], true);
}

function injectRootShellScripts(entries) {
    const root = entries.find((entry) => /^(?:src\/)?(?:routes\/__root|app\/(?:layout|root)|pages\/_document)\.(?:tsx|jsx)$/i.test(pathOf(entry)));
    if (!root) return null;
    const source = textOf(root);
    const hasGpt = /securepubads\.g\.doubleclick\.net\/tag\/js\/gpt\.js/.test(source);
    const hasRuntime = /["']\/js\/ad\.js["']/.test(source);
    if (hasGpt && hasRuntime) return { verified: pathOf(root) };
    let ast;
    try {
        ast = parse(source, { sourceType: 'module', plugins: ['jsx', /\.tsx$/i.test(pathOf(root)) ? 'typescript' : null].filter(Boolean) });
    } catch (error) {
        return { warning: issue(pathOf(root) + '：Babel 无法解析根布局，未注入全局广告脚本：' + error.message, 'REACT_AD_ROOT_AST_PARSE_FAILED') };
    }
    let head = null;
    let html = null;
    traverse(ast, { JSXElement(path) {
        const name = path.node.openingElement.name;
        if (!t.isJSXIdentifier(name)) return;
        if (!head && /^(?:head|Head)$/.test(name.name)) head = path.node;
        if (!html && /^(?:html|Html)$/.test(name.name)) html = path.node;
    } });
    if (!head && html && /(?:^|\/)app\/layout\./i.test(pathOf(root))) {
        // Next App Router layouts normally have <html><body> but no explicit
        // <head>. Add the standard head before body without moving content.
        head = t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('head'), [], false),
            t.jsxClosingElement(t.jsxIdentifier('head')), [], false);
        html.children.unshift(t.jsxText('\n      '), head);
    }
    if (!head) return { warning: issue(pathOf(root) + '：未找到可确认的 <head> 或根 <html>，未注入全局广告脚本。', 'REACT_AD_ROOT_HEAD_MISSING') };
    if (head.openingElement.selfClosing) {
        head.openingElement.selfClosing = false;
        head.closingElement = t.jsxClosingElement(t.cloneNode(head.openingElement.name));
    }
    if (!hasGpt) head.children.push(t.jsxText('\n        '), scriptElement('https://securepubads.g.doubleclick.net/tag/js/gpt.js', true));
    if (!hasRuntime) head.children.push(t.jsxText('\n        '), scriptElement('/js/ad.js', false));
    head.children.push(t.jsxText('\n      '));
    root.bytes = bytes(generate(ast, { retainLines: false, comments: true }, source).code + '\n');
    return { changed: pathOf(root) };
}

function injectIndexScripts(entries, project) {
    // Only a source-root index.html is a React entry point. A nested
    // dist/client/index.html is a build artifact and must not replace the
    // TanStack/Next root-shell injection path.
    const index = entries.find((entry) => /^index\.html?$/i.test(pathOf(entry)));
    if (!index) {
        const rootResult = injectRootShellScripts(entries);
        return rootResult || { warning: issue('未找到全局 index.html 或可识别的根布局；GPT/ad.js 需要人工确认。', 'REACT_AD_HEAD_MANUAL_REVIEW') };
    }
    let html = textOf(index)
        .replace(/\s*<script\b[^>]*data-sitefoundry-ad-runtime[^>]*>[\s\S]*?<\/script\s*>/gi, '');
    const scripts = '<script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js" crossorigin="anonymous" data-sitefoundry-ad-runtime="gpt"></script>\n    <script src="/js/ad.js" data-sitefoundry-ad-runtime="loader"></script>';
    const at = html.search(/<\/head\s*>/i);
    if (at < 0) return { warning: issue('index.html 缺少 </head>；未注入全局广告脚本。', 'REACT_AD_HEAD_MISSING') };
    html = html.slice(0, at) + scripts + '\n    ' + html.slice(at);
    index.bytes = bytes(html);
    return { changed: pathOf(index) };
}

export function injectReactSource(entriesInput, project, config, policy, archiveName, runtimeSource, settings) {
    // ZIPs commonly wrap a project in one directory. Emit a deployable project
    // root so the injected public/js/ad.js lands beside its actual index.html.
    const sourceRoot = String(project && project.siteRoot || '').replace(/\\/g, '/');
    const entries = entriesInput.filter((entry) => !sourceRoot || pathOf(entry).startsWith(sourceRoot)).map((entry) => ({
        path: sourceRoot ? pathOf(entry).slice(sourceRoot.length) : pathOf(entry),
        bytes: entry.bytes ? new Uint8Array(entry.bytes) : bytes(entry.text || '')
    }));
    const dynamicPlacement = settings && (settings.mode === 'fixed' || !project.entryPath);
    if (dynamicPlacement) {
        // Fixed placement is resolved against the rendered DOM on each route.
        // Next.js manual placement also runs after hydration so the policy can
        // be applied without mutating server route components by guesswork.
        if (!runtimeSource) return { valid: false, entries, errors: [issue('固定广告运行时未生成。', 'REACT_AD_RUNTIME_UNAVAILABLE')], warnings: [] };
        const head = injectIndexScripts(entries, project);
        if (head.warning) return { valid: false, entries, errors: [head.warning], warnings: [] };
        function upsert(path, source) {
            const old = entries.find((entry) => pathOf(entry).toLowerCase() === path.toLowerCase());
            if (old) old.bytes = bytes(source);
            else entries.push({ path, bytes: bytes(source) });
        }
        upsert('public/js/ad.js', runtimeSource);
        upsert('ad-injection.json', JSON.stringify({
            schema: 'sitefoundry-ad-injection/v3', generatedAt: new Date().toISOString(),
            source: archiveName || 'finished-site', framework: project.framework, adPaths: config,
            placementMode: settings.mode, adJsVersion: settings.version, policy,
            build: 'React 源码已注入广告位运行时；安装依赖并生产构建后部署。'
        }, null, 2) + '\n');
        return { valid: true, entries, errors: [], warnings: [],
            changedPages: [head.changed || head.verified], changedScripts: ['public/js/ad.js'], framework: project.framework };
    }
    const pages = choosePages(entries);
    if (!pages.length) return { valid: false, entries, errors: [issue('未找到 src/routes、src/pages 或 App.tsx 中可安全修改的 React 页面。', 'REACT_AD_PAGE_NOT_FOUND')], warnings: [] };
    const changedPages = [];
    const verifiedPages = [];
    const warnings = [];
    const component = componentStatus(entries);
    if (component.entry && !component.compatible) {
        return { valid: false, entries, errors: [issue(pathOf(component.entry) + ' 已存在，但无法确认它与 adv1/2/3 及 SPA 重扫协议兼容；为避免覆盖现有广告集成，已停止导出。', 'REACT_AD_COMPONENT_CONFLICT')], warnings };
    }
    pages.forEach((page) => {
        const currentPath = pathOf(page);
        const extension = /\.tsx$/i.test(currentPath) ? 'tsx' : 'jsx';
        const nestedDirectories = currentPath.split('/').slice(1, -1);
        const importPath = nestedDirectories.length ? '../'.repeat(nestedDirectories.length) + 'components/advertisement' : './components/advertisement';
        const pageType = pageTypeFor(currentPath);
        const result = injectPage(textOf(page), extension, importPath, component.compatible ? component.importKind : 'default', pageType, policy && policy.slots && policy.slots[pageType]);
        if (result.changed) { page.bytes = bytes(result.text); changedPages.push(currentPath); }
        else if (result.verified) verifiedPages.push(currentPath);
        else if (result.error) warnings.push(Object.assign(result.error, { message: currentPath + '：' + result.error.message }));
    });
    if (!changedPages.length && !verifiedPages.length) return { valid: false, entries, errors: [issue('没有任何 React 页面通过 AST 安全锚点检查，已停止导出以避免破坏源码。', 'REACT_AD_NO_SAFE_MUTATION')], warnings };
    const typed = pages.some((page) => /\.tsx$/i.test(pathOf(page)));
    const componentPath = 'src/components/advertisement.' + (typed ? 'tsx' : 'jsx');
    const typePath = 'src/types/sitefoundry-ads.d.ts';
    function upsert(path, source) { const old = entries.find((entry) => entry.path.toLowerCase() === path.toLowerCase()); if (old) old.bytes = bytes(source); else entries.push({ path, bytes: bytes(source) }); }
    if (!component.compatible) upsert(componentPath, adComponentSource(typed));
    if (typed) upsert(typePath, typesSource());
    const head = injectIndexScripts(entries, project);
    if (head.warning) warnings.push(head.warning);
    const runtime = String(runtimeSource || '');
    if (!runtime) return { valid: false, entries, errors: [issue('内置广告运行时不可用，未导出 React 源码。', 'REACT_AD_RUNTIME_UNAVAILABLE')], warnings };
    upsert('public/js/ad.js', runtime);
    upsert('ad-injection.json', JSON.stringify({ schema: 'sitefoundry-ad-injection/v2', generatedAt: new Date().toISOString(), source: archiveName || 'finished-site', framework: project.framework, adPaths: config, policy, placementMode: 'manual', adJsVersion: settings && settings.version || 'v1.0.1', build: 'React 源码已修改：执行 npm install 后 npm run build；node_modules 不会被处理。' }, null, 2) + '\n');
    return { valid: true, entries, errors: [], warnings, changedPages, verifiedPages, changedScripts: ['public/js/ad.js'], framework: project.framework };
}
