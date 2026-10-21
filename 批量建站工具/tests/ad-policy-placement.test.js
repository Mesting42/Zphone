import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { DOMParser } from 'linkedom';
import { commonPolicyPlacements, editPolicyPlacement } from '../js/ad-policy-placement.js';
import { renderTemplateThemeCards } from '../js/template-reuse-theme-view.js';

const context = { TextEncoder, TextDecoder, window: {} };
vm.runInNewContext(readFileSync(new URL('../js/ad-restoration.js', import.meta.url), 'utf8'), context);
const engine = context.window.AdRestoration;
const source = '<!doctype html><html><head></head><body><nav>Navigation</nav><main class="main-content"><div class="container"><section class="category-section">One</section><section class="category-section">Two</section><div class="items-grid"><article>Card 1</article><article>Card 2</article><article>Card 3</article><article>Card 4</article></div></div></main><footer>Footer</footer></body></html>';

describe('policy placement interaction contract', () => {
    it('commits to one page on a copy, leaves other pages intact and prevents an occupied position', () => {
        const policy = engine.createPolicy(undefined, { pageIsolation: true });
        const changed = editPolicyPlacement(policy, 'home', 1, 'content-top');
        expect(changed.slots.home[1].position).toBe('content-top');
        expect(changed.slots.detail).toEqual(policy.slots.detail);
        expect(changed.slots.all).toEqual(policy.slots.all);
        expect(policy.slots.home[1].position).toBe('content-middle');
        expect(editPolicyPlacement(policy, 'home', 1, 'after-navbar')).toBeNull();
        expect(editPolicyPlacement(policy, 'privacy', 1, 'after-navbar')).toBeNull();
    });
    it('removes just the current page and can place the same container again without duplicating a unit', () => {
        const policy = engine.createPolicy(undefined, { pageIsolation: true });
        const removed = editPolicyPlacement(policy, 'detail', 1, null);
        expect(removed.slots.detail[1]).toEqual({ unit: 'off', position: 'detail-middle' });
        expect(removed.slots.home).toEqual(policy.slots.home);
        const restored = editPolicyPlacement(removed, 'detail', 1, 'detail-before-content');
        expect(restored.slots.detail[1].unit).toBe('banner2');
        expect(engine.validatePolicy(engine.normalizePolicy(restored))).toEqual([]);
    });
    it('renders named candidates only at valid export positions, deduplicates gaps and excludes occupied gaps', () => {
        const html = engine.previewPlacementHtml(source, 'home', commonPolicyPlacements('home'), ['after-navbar']);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        expect(doc.querySelector('[data-policy-position="after-navbar"]')).toBeNull();
        expect(doc.querySelector('[data-policy-position="after-section-2"]')).toBeNull();
        expect(doc.querySelector('[data-policy-position="after-section-0"]').previousElementSibling.textContent).toBe('One');
        expect(doc.querySelector('[data-policy-position="footer-top"]').nextElementSibling.tagName).toBe('FOOTER');
        expect(doc.querySelectorAll('[data-policy-position="content-middle"]')).toHaveLength(0);
        expect([...doc.querySelectorAll('button')].every(button => button.textContent.startsWith('＋ 常用广告位 · '))).toBe(true);
        expect(source).not.toContain('data-policy-position');
    });
    it('places a listing middle candidate between complete cards and keeps it spanning the grid', () => {
        const html = engine.previewPlacementHtml(source, 'all', commonPolicyPlacements('all'), []);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const wrapper = doc.querySelector('[data-policy-position="content-middle"]').parentElement;
        expect(wrapper.previousElementSibling.textContent).toBe('Card 2');
        expect(wrapper.nextElementSibling.textContent).toBe('Card 3');
        expect(wrapper.getAttribute('style')).toContain('grid-column:1 / -1');
    });
    it('does not offer a named gap already occupied through an original-position marker', () => {
        const html = source.replace('<main', '<!-- SITEFOUNDRY_AD_ORIGIN banner1 --><div id="adv1"><div id="div-gpt-ad-banner1"></div></div>\n <main');
        const preview = engine.previewPlacementHtml(html, 'home', commonPolicyPlacements('home'), ['original-banner1']);
        const doc = new DOMParser().parseFromString(preview, 'text/html');
        expect(doc.querySelector('[data-policy-position="after-navbar"]')).toBeNull();
        expect(doc.querySelector('[data-policy-position="content-top"]')).not.toBeNull();
        expect(doc.getElementById('adv1')).not.toBeNull();
    });
    it('provides all theme swatches, names, selected state and the original-template reset', () => {
        const doc = new DOMParser().parseFromString('<html><body><div id="grid"></div></body></html>', 'text/html');
        const grid = doc.getElementById('grid');
        renderTemplateThemeCards(grid, [{ id: 'ocean', name: '海洋', previewBg: 'linear-gradient(135deg,#123,#456)' }], 'ocean');
        expect(grid.querySelectorAll('button')).toHaveLength(2);
        expect(grid.querySelector('[data-template-theme=""]').textContent).toBe('保留模板原配色');
        expect(grid.querySelector('[data-template-theme="ocean"]').getAttribute('aria-pressed')).toBe('true');
        expect(grid.querySelector('[data-template-theme="ocean"] .style-preview').getAttribute('style')).toContain('linear-gradient');
    });
});
