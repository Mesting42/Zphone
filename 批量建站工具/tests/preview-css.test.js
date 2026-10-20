import { describe, expect, it } from 'vitest';
import { rewritePreviewCss } from '../js/preview-css.js';

describe('uploaded stylesheet dependency references', () => {
    it('resolves quoted imports and URL imports without losing conditions', () => {
        const seen = [];
        const css = rewritePreviewCss('@import "nested/theme.css?v=4" layer(theme) screen; @import url(colors.css) supports(display:grid);', 'css/main.css', (reference, owner) => {
            seen.push([reference, owner]);
            return 'data:text/css;base64,' + (reference.startsWith('nested') ? 'THEME' : 'COLORS');
        });
        expect(seen).toEqual([['colors.css', 'css/main.css'], ['nested/theme.css?v=4', 'css/main.css']]);
        expect(css).toContain('@import "data:text/css;base64,THEME" layer(theme) screen');
        expect(css).toContain('@import url("data:text/css;base64,COLORS") supports(display:grid)');
    });
    it('supports quoted spaces in image/font filenames', () => {
        expect(rewritePreviewCss('src:url("../fonts/local font.woff2")', 'css/main.css', reference => reference === '../fonts/local font.woff2' ? 'blob:font' : '')).toBe('src:url("blob:font")');
    });
    it('preserves missing resources, external URLs and data URLs for the owning policy', () => {
        const source = '@import "https://example.org/style.css";a{background:url(data:image/png;base64,abc)}b{background:url(missing.png)}';
        expect(rewritePreviewCss(source, 'main.css', () => '')).toBe(source);
    });
});
