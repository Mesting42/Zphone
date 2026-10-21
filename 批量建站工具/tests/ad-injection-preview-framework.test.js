import { describe, expect, it } from 'vitest';
import vm from 'node:vm';
import { rewriteFrameworkPreview, frameworkPreviewRuntime } from '../js/ad-injection-preview-framework.js';

describe('isolated framework preview route', () => {
    it('provides the selected route without changing native history or removing the sandbox', () => {
        const messages = [];
        const real = { location: { pathname: '/builder' }, history: { state: 'native' } };
        const context = { window: real, URL, Proxy, Reflect, parent: { postMessage: message => messages.push(message) } };
        vm.runInNewContext(frameworkPreviewRuntime('/articles/example', 'build/client/articles/example/index.html'), context);
        vm.runInNewContext(rewriteFrameworkPreview('window.result = [window.location.pathname, document.defaultView.history.state.idx];'), { ...context, document: { defaultView: real } });
        expect(real.result).toEqual(['/articles/example', 0]);
        expect(real.location.pathname).toBe('/builder');
        vm.runInNewContext(rewriteFrameworkPreview('history.pushState({idx:1}, "", "/tools");'), context);
        expect(messages[0].href).toBe('/tools');
        expect(real.history.state).toBe('native');
    });
    it('preserves local variables and strings that happen to use browser names', () => {
        const source = 'function f(window,location){return window + location;} const literal="window.location"; window.result=f(2,3);';
        const result = rewriteFrameworkPreview(source);
        const actual = {};
        vm.runInNewContext(result, { window: { __sitefoundryPreviewWindow: actual } });
        expect(actual.result).toBe(5);
        expect(result).toContain('"window.location"');
    });
});
