import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';

const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

/** Hydrated apps inside an opaque-origin srcdoc must see their selected route,
 * not the builder's URL. Change only free browser references in the preview
 * copy; lexical variables, literal strings and exported source stay untouched.
 */
export function rewriteFrameworkPreview(source) {
    const ast = parse(source, { sourceType: 'unambiguous', plugins: ['jsx', 'importAttributes'] });
    const previewWindow = () => t.memberExpression(t.identifier('window'), t.identifier('__sitefoundryPreviewWindow'));
    traverse(ast, {
        MemberExpression(path) {
            const node = path.node;
            if (!node.computed && t.isIdentifier(node.object, { name: 'document' })
                && !path.scope.hasBinding('document') && t.isIdentifier(node.property, { name: 'defaultView' })) {
                path.replaceWith(previewWindow()); path.skip();
            }
        },
        ReferencedIdentifier(path) {
            const name = path.node.name;
            if (!['window', 'location', 'history'].includes(name) || path.scope.hasBinding(name)) return;
            path.replaceWith(name === 'window' ? previewWindow() : t.memberExpression(previewWindow(), t.identifier(name)));
            path.skip();
        }
    });
    return generate(ast, { compact: true, comments: false }, source).code;
}

export function frameworkPreviewRuntime(route, fromPath) {
    function install(route, fromPath) {
        let url = new URL(route, 'https://sitefoundry-preview.invalid');
        let state = { idx: 0, key: 'default' };
        const notify = () => parent.postMessage({ type: 'ad-injection-preview-navigate',
            href: url.pathname + url.search + url.hash, fromPath }, '*');
        const location = new Proxy({}, { get(_target, key) {
            if (key === 'assign' || key === 'replace') return value => { url = new URL(value, url); notify(); };
            if (key === 'reload') return notify;
            if (key === 'toString') return () => url.href;
            return url[key];
        }});
        const history = {
            get state() { return state; }, scrollRestoration: 'auto',
            replaceState(value, _title, href) { state = value; if (href) url = new URL(href, url); },
            pushState(value, _title, href) { state = value; if (href) url = new URL(href, url); notify(); },
            go() {}, back() {}, forward() {}
        };
        window.__sitefoundryPreviewWindow = new Proxy(window, { get(target, key) {
            if (key === 'location') return location;
            if (key === 'history') return history;
            const value = Reflect.get(target, key, target);
            return typeof value === 'function' ? value.bind(target) : value;
        }});
    }
    return '(' + install.toString() + ')(' + JSON.stringify(route).replace(/</g, '\\u003c') + ','
        + JSON.stringify(fromPath).replace(/</g, '\\u003c') + ');';
}
