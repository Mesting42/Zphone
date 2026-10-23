/** Render template defaults and manual overrides at multiple widths, including
 * resize, dynamic JSON cards, and a palette runtime sharing the same page. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DOMParser } from 'linkedom';
import { applyTemplateSummaryLines } from '../js/template-summary-lines.js';
import { applyThemePalette } from '../js/template-theme-palette.js';
import { textEntry, entryText } from '../js/template-reuse-content.js';
globalThis.DOMParser = DOMParser;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'file:///C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const root = resolve('coverage/template-summary-lines-20261022'); await mkdir(root, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
const original = ['A short template introduction with a second sentence.', 'Original card summary uses a different length and a CSS limit. '.repeat(4)];
const longText = 'New summary with enough content to wrap into many lines at both desktop and phone widths. '.repeat(16);
const html = body => '<html><head><style>body{margin:20px;font:16px/1.5 Arial}.hero{width:calc(100% - 40px);max-width:640px}.item-card{display:block;width:240px}.card-desc{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden}p{margin:8px 0}#prose{width:240px}#adv2{padding:12px}.icon{display:inline-block}</style></head><body>' + body + '</body></html>';
const markup = (fresh = false) => html('<div class="hero"><h1>Heading</h1><p id="hero"' + (fresh ? ' data-sitefoundry-card-summary="' + original[0] + '"' : '') + '>' + (fresh ? longText : original[0]) + '</p></div><a class="item-card" href="details/article1.html"><h3>Card</h3><p id="card" class="card-desc"' + (fresh ? ' data-sitefoundry-card-summary="' + original[1] + '"' : '') + '>' + (fresh ? longText : original[1]) + '</p></a><p id="prose">' + longText + '</p><div id="adv2"><p>Ad unchanged</p></div><h2 class="category-title">Original category</h2><div id="dynamic"></div>');
const samples = [];
function metrics() {
    return ['hero', 'card', 'prose'].map(id => { const node = document.getElementById(id), style = getComputedStyle(node); return { id, height: node.getBoundingClientRect().height, lines: Math.round(node.getBoundingClientRect().height / parseFloat(style.lineHeight)), clamp: style.webkitLineClamp, text: node.textContent, width: node.getBoundingClientRect().width }; });
}
try {
    for (const themed of [false, true]) for (const mode of ['auto', '1', '2', '3', '4', '10', 'none']) {
        const entries = applyTemplateSummaryLines([textEntry('index.html', markup(true))], { paths: ['index.html'], cardExcerptLines: mode, dynamic: { path: 'index.html', originals: original.map((text, i) => ({ id: String(i + 1), text })) } });
        const output = themed ? applyThemePalette(entries, { vars: { '--color-bg': '#fff', '--color-text': '#111', '--color-primary': '#123456' } }).entries : entries;
        for (const width of [1280, 390]) {
            await page.setViewportSize({ width, height: 900 }); await page.setContent(markup(false)); const baseline = await page.evaluate(metrics);
            await page.setContent(entryText(output[0])); await page.locator('html[data-sitefoundry-summaries-ready]').waitFor(); await page.evaluate(() => document.fonts.ready);
            await page.waitForTimeout(80); const actual = await page.evaluate(metrics);
            for (const index of [0, 1]) {
                if (mode === 'auto') assert.equal(actual[index].lines, baseline[index].lines, JSON.stringify({ mode, width, themed, baseline, actual }));
                else if (mode === 'none') assert.ok(actual[index].lines > 10);
                else assert.equal(actual[index].lines, Number(mode), JSON.stringify({ mode, width, themed, actual }));
                assert.equal(actual[index].text, longText);
            }
            assert.equal(actual[2].height, baseline[2].height); assert.equal(actual[2].text, baseline[2].text);
            assert.equal(await page.locator('#adv2').innerText(), 'Ad unchanged');
            // Late insertion exercises the original JSON-renderer row lookup.
            await page.evaluate(text => { document.querySelector('#dynamic').innerHTML = '<a class="item-card" href="details/article2.html"><h3>Late</h3><p class="card-desc" id="late">' + text + '</p></a>'; }, longText);
            await page.locator('#late[data-sitefoundry-summary-lines]').waitFor();
            const late = await page.locator('#late').evaluate(node => ({ lines: Math.round(node.getBoundingClientRect().height / parseFloat(getComputedStyle(node).lineHeight)), original: node.getAttribute('data-sitefoundry-card-summary') }));
            assert.equal(late.original, original[1]); if (mode !== 'none') assert.equal(late.lines, mode === 'auto' ? baseline[1].lines : Number(mode));
            samples.push({ mode, width, themed, baseline: baseline.map(({ id, lines }) => ({ id, lines })), actual: actual.map(({ id, lines }) => ({ id, lines })), late });
            if (mode === 'auto' || mode === '2') await page.screenshot({ path: resolve(root, `fixture-${mode}-${themed ? 'theme' : 'original'}-${width}.png`) });
        }
    }
    // Resize the same document, rather than relying only on fresh page loads.
    const entries = applyTemplateSummaryLines([textEntry('index.html', markup(true))], { paths: ['index.html'] });
    await page.setViewportSize({ width: 1280, height: 900 }); await page.setContent(entryText(entries[0])); await page.locator('html[data-sitefoundry-summaries-ready]').waitFor();
    const wide = await page.locator('#hero').getAttribute('data-sitefoundry-summary-lines');
    await page.setViewportSize({ width: 390, height: 900 }); await page.waitForFunction(previous => document.querySelector('#hero').getAttribute('data-sitefoundry-summary-lines') !== previous, wide);
    await page.evaluate(text => { const card = document.createElement('div'); card.className = 'item-card'; card.style.display = 'none'; card.innerHTML = '<p class="card-desc" data-sitefoundry-card-summary="Original hidden summary" id="revealed">' + text + '</p>'; document.body.appendChild(card); }, longText);
    await page.waitForTimeout(40); await page.locator('#revealed').evaluate(node => { node.parentElement.style.display = 'block'; });
    await page.locator('#revealed[data-sitefoundry-summary-lines]').waitFor();
    console.log('Summary browser cases passed: ' + samples.length + '; same-document resize passed');
} finally { await writeFile(resolve(root, 'fixture-browser-results.json'), JSON.stringify(samples, null, 2)); await browser.close(); }
