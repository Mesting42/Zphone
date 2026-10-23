import { describe, expect, it } from 'vitest';
import { DOMParser } from 'linkedom';
import { applyThemePalette } from '../js/template-theme-palette.js';
import { entryText, textEntry } from '../js/template-reuse-content.js';

globalThis.DOMParser = DOMParser;
const palette = { id: 'minimal', vars: { '--color-bg': '#fff', '--color-text': '#212529', '--color-card-bg': '#fff' } };
const source = () => [textEntry('index.html', '<html><head><style>.unknown{color:var(--fg);background:#17171f}</style></head><body><article class="unknown"><h2>Title</h2><span data-icon>★</span><div id="adv2">Original ad</div></article></body></html>'), textEntry('games/play.html', '<html><body>Owned by game</body></html>'), textEntry('style.css', 'body{margin:23px}')];

describe('independent template palette installation', () => {
    it('returns pristine entries for original colors, without serializing uploaded HTML', () => {
        const entries = source();
        expect(applyThemePalette(entries, null)).toEqual({ entries, applied: false, warnings: [] });
        expect(applyThemePalette(entries, null).entries).toBe(entries);
    });
    it('does not mutate source bytes, uploaded styles, ad markup or icon markup', () => {
        const entries = source(), original = entries.map(entryText);
        const output = applyThemePalette(entries, palette, { paths: ['index.html'] }).entries;
        expect(entries.map(entryText)).toEqual(original);
        expect(output[1]).toBe(entries[1]);
        expect(output[2]).toBe(entries[2]);
        const doc = new DOMParser().parseFromString(entryText(output[0]), 'text/html');
        expect(doc.querySelector('style').textContent).toBe('.unknown{color:var(--fg);background:#17171f}');
        expect(doc.querySelector('[data-icon]').outerHTML).toBe('<span data-icon="">★</span>');
        expect(doc.querySelector('#adv2').outerHTML).toBe('<div id="adv2">Original ad</div>');
        expect(output[0].text).toBeUndefined();
        expect(doc.querySelector('script[data-sitefoundry-template-theme-runtime]')).toBeTruthy();
    });
    it('replaces a prior palette instead of stacking competing runtimes', () => {
        const once = applyThemePalette(source(), palette).entries;
        const twice = applyThemePalette(once, { vars: { '--color-bg': '#111' } }, { id: 'dark' }).entries;
        const doc = new DOMParser().parseFromString(entryText(twice[0]), 'text/html');
        expect(doc.querySelectorAll('[data-sitefoundry-template-theme]')).toHaveLength(1);
        expect(doc.querySelectorAll('[data-sitefoundry-template-theme-runtime]')).toHaveLength(1);
        expect(doc.querySelector('[data-sitefoundry-template-theme]').textContent).toBe(':root{--sf-theme-color-bg:#111}');
    });
    it('filters non-color variables and CSS/HTML injection from palette input', () => {
        const result = applyThemePalette(source(), { vars: { ...palette.vars, '--content-width': '200px', '--color-primary': 'red;}body{display:none', '--color-bad': '</style>' } });
        const doc = new DOMParser().parseFromString(entryText(result.entries[0]), 'text/html');
        const added = doc.querySelector('[data-sitefoundry-template-theme]').textContent;
        expect(added).not.toMatch(/content-width|color-primary|color-bad|display/);
        expect(() => applyThemePalette(source(), { vars: { '--width': '99px' } })).toThrow(/有效的颜色/);
    });
});
