/** Regression for imported-site previews in the real packaged Windows app.
 * Fixtures are copied into coverage; source sites and installed app data stay intact.
 * Assertions require rendered stylesheet effects and JSON-created content, so a
 * visible advertisement placeholder alone cannot make this check pass.
 */
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { launchWorkbench } from './electron-workbench.mjs';

const output = resolve(process.env.PREVIEW_RUN_OUTPUT || 'coverage/apps-preview-20261014-v1.0.1/probe-before');
process.env.NATIVE_RUN_OUTPUT = join(output, 'native');
await mkdir(output, { recursive: true });
const report = { at: new Date().toISOString(), scenarios: [], console: [], failures: [], preservation: [] };

/** Archive relative paths without changing or rebuilding the supplied sites. */
async function archive(directory, name) {
    const zip = new JSZip();
    async function visit(folder, prefix = '') {
        for (const item of await readdir(folder, { withFileTypes: true })) {
            const file = join(folder, item.name), path = prefix + item.name;
            if (item.isDirectory()) await visit(file, path + '/');
            else {
                const bytes = await readFile(file);
                zip.file(name + '/' + path, bytes);
                report.preservation.push({ source: file, sha256: createHash('sha256').update(bytes).digest('hex') });
            }
        }
    }
    await visit(directory);
    const path = join(output, name + '.zip');
    await writeFile(path, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
    return path;
}

const fixtures = [
    { mode: 'ad-injection', name: 'deep-life', source: 'D:/Min/合集/资讯站/12-科技趋势全景解读/dist', input: '#injection-sites-input', progress: '#injection-scan-progress-text', panel: '#ad-injection-config-panel', font: 'Switzer' },
    { mode: 'ad-restoration', name: 'fintriza.top', source: 'D:/project-zlm/张/限流链接广告修改/fintriza.top', input: '#restoration-sites-input', progress: '#restoration-scan-progress-text', panel: '#ad-policy-config-panel', cards: true, font: 'Rajdhani' }
];
for (const fixture of fixtures) fixture.archive = await archive(fixture.source, fixture.name);
/** Invented names and directory structures exercise future uploads. The only
 * reused binary is a local font; no product code knows these fixture paths.
 */
async function syntheticArchive(kind) {
    const zip = new JSZip(), root = kind === 'rooted' ? 'unrelated-company/out/' : 'another-upload/';
    const rooted = kind === 'rooted';
    const ref = (path, detail) => (rooted ? '/' : detail ? '../' : '') + path;
    const page = detail => `<!doctype html><html><head><meta charset="utf-8"><title>Preview resource fixture</title>
        <link rel="stylesheet" href="${ref('assets/css/main.css?v=42', detail)}">
        <script>window.fixtureDataPath=${JSON.stringify(ref('data' + '.json', detail))};</script>
        <script defer src="${ref('js/site.js?build=99', detail)}"></script><script defer src="${ref('js/ad.js', detail)}"></script>
        </head><body><nav class="navbar"><a href="${ref('index.html', detail)}">Home</a><a href="${ref('details/article1.html', detail)}">Detail</a></nav>
        <main class="${detail ? 'detail-page' : 'main-content'}"><h1>Future upload</h1>${detail ? '<article class="detail-content"><p>First paragraph of the source article.</p><p>Second paragraph of the source article.</p><p>Third paragraph of the source article.</p></article>' : '<section class="hero">Introduction</section><section class="category-section">Section one</section><section class="category-section">Section two</section>'}<div class="fixture-cards"></div></main><footer class="footer">Footer</footer></body></html>`;
    zip.file(root + 'index.html', page(false));
    zip.file(root + 'details/article1.html', page(true));
    zip.file(root + 'data.json', JSON.stringify([{ title: 'Loaded from local JSON', image: ref('assets/pictures/cover one.svg', false) }]));
    zip.file(root + 'assets/css/main.css', `@import "./nested/theme.css?v=2"; @font-face{font-family:PreviewFixture;src:url('../fonts/font.woff2')} body{font-family:PreviewFixture,sans-serif;background:var(--preview-bg)} .navbar{display:flex} .fixture-cover{width:64px;height:64px}`);
    zip.file(root + 'assets/css/nested/theme.css', `@import url('./colors.css'); .fixture-cards{border:3px solid rgb(37,98,164)}`);
    zip.file(root + 'assets/css/nested/colors.css', `:root{--preview-bg:rgb(18,52,86)}`);
    zip.file(root + 'assets/fonts/font.woff2', await readFile('D:/Min/合集/资讯站/12-科技趋势全景解读/dist/assets/fonts/switzer-variable.woff2'));
    zip.file(root + 'assets/pictures/cover one.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="green"/></svg>');
    zip.file(root + 'js/site.js', `document.addEventListener('DOMContentLoaded',async()=>{try{const value=window.fixtureDataPath;const response=await fetch(value.slice(0,-4)+'json');const rows=await response.json();for(const row of rows){const card=document.createElement('article');card.className='item-card';card.textContent=row.title;const image=new Image();image.className='fixture-cover';image.src=(document.querySelector('.detail-content')&&!row.image.startsWith('/')?'../':'')+row.image;card.append(image);document.querySelector('.fixture-cards').append(card)}}catch(error){document.querySelector('main').textContent='Failed to load data.'}});`);
    zip.file(root + 'js/ad.js', await readFile('D:/project-zlm/张/限流链接广告修改/fintriza.top/js/ad.js'));
    const path = join(output, 'future-' + kind + '.zip');
    await writeFile(path, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
    return path;
}
for (const kind of ['relative', 'rooted']) {
    const archive = await syntheticArchive(kind);
    for (const mode of ['ad-injection', 'ad-restoration']) {
        fixtures.push({ ...fixtures.find(fixture => fixture.mode === mode), name: 'future-' + kind + '-' + mode, archive, font: 'PreviewFixture', cards: true, synthetic: true });
    }
}
const browser = await launchWorkbench();
try {
    const page = browser.page;
    page.on('console', message => {
        if (message.type() === 'error') report.console.push(message.text().slice(0, 450));
    });
    // Capture browser-enforced failures, which do not fire pageerror events.
    await page.addInitScript(() => {
        window.__resourceViolations = [];
        document.addEventListener('securitypolicyviolation', event => {
            window.__resourceViolations.push({ directive: event.effectiveDirective, blocked: event.blockedURI.slice(0, 120) });
        });
    });
    await page.route(/^https?:\/\//, route => route.abort());
    for (const fixture of fixtures) {
        await page.goto('sitefoundry://app/');
        await page.locator('[data-build-mode="' + fixture.mode + '"]').click();
        await page.locator(fixture.input).setInputFiles(fixture.archive);
        await page.waitForFunction(selector => /已识别 1 个/.test(document.querySelector(selector)?.textContent || ''), fixture.progress, { timeout: 120000 });
        await page.locator('#btn-next').click();
        await page.locator(fixture.panel).waitFor({ state: 'visible' });
        for (const pageType of fixture.synthetic ? ['home', 'detail'] : ['home']) {
        if (pageType === 'detail') {
            const old = await page.locator('#preview-frame').getAttribute('srcdoc');
            await page.locator('.preview-tab[data-page="detail"]').click();
            await page.waitForFunction(previous => document.querySelector('#preview-frame').srcdoc !== previous && !document.querySelector('#preview-frame').hasAttribute('data-refreshing'), old);
        }
        const frame = await (await page.locator('#preview-frame').elementHandle()).contentFrame();
        await frame.waitForFunction(() => document.readyState === 'complete');
        await page.waitForTimeout(1500);
        const stats = await frame.evaluate(async () => {
            await document.fonts.ready;
            return {
            styles: [...document.querySelectorAll('link[rel="stylesheet"]')].filter(link => /^(data:|blob:)/.test(link.href)).map(link => ({ scheme: link.href.split(':')[0], loaded: !!link.sheet })),
            font: getComputedStyle(document.body).fontFamily,
            background: getComputedStyle(document.body).backgroundColor,
            cards: document.querySelectorAll('.item-card').length,
            detailContent: !!document.querySelector('.detail-content'),
            dataFailure: /Failed to load data/.test(document.body.textContent),
            violations: window.__resourceViolations || [],
            nativeBridgePresent: !!window.SiteFoundryNative,
            localFontsLoaded: [...document.fonts].some(font => font.family.includes('PreviewFixture')) && [...document.fonts].filter(font => font.family.includes('PreviewFixture')).every(font => font.status === 'loaded'),
            fixtureImages: [...document.querySelectorAll('.fixture-cover')].map(image => ({ loaded: image.complete && image.naturalWidth > 0 }))
        }; });
        await page.screenshot({ path: join(output, fixture.name + '-' + pageType + '.png') });
        // Size switches keep the same document and must preserve original styles.
        await page.locator('.size-btn[data-size="mobile"]').click();
        const mobileFont = await frame.evaluate(() => getComputedStyle(document.body).fontFamily);
        await page.screenshot({ path: join(output, fixture.name + '-' + pageType + '-mobile.png') });
        await page.locator('.size-btn[data-size="desktop"]').click();
        report.scenarios.push({ name: fixture.name, mode: fixture.mode, pageType, mobileFont, ...stats });
        try {
            assert.ok(stats.styles.length > 0 && stats.styles.every(style => style.loaded), fixture.name + ': imported CSS did not load');
            assert.ok(stats.font.includes(fixture.font), fixture.name + ': original CSS did not apply (' + stats.font + ')');
            assert.ok(!stats.nativeBridgePresent, fixture.name + ': preview must not expose native operations');
            assert.ok(mobileFont.includes(fixture.font), fixture.name + ': CSS was lost after switching to mobile');
            if (fixture.synthetic) assert.equal(stats.detailContent, pageType === 'detail', fixture.name + ': toolbar did not display the requested page');
            if (fixture.cards) assert.ok(stats.cards > 0 && !stats.dataFailure, fixture.name + ': JSON-backed content did not render');
            if (fixture.synthetic) {
                assert.equal(stats.background, 'rgb(18, 52, 86)', fixture.name + ': nested CSS imports did not apply');
                assert.ok(stats.localFontsLoaded, fixture.name + ': local font bytes did not load');
                assert.ok(stats.fixtureImages.length > 0 && stats.fixtureImages.every(image => image.loaded), fixture.name + ': computed image paths did not load');
            }
        } catch (error) { report.failures.push(error.message); }
        }
    }
} finally {
    await browser.close();
    await writeFile(join(output, 'results.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ scenarios: report.scenarios, failures: report.failures }, null, 2));
if (report.failures.length) process.exitCode = 1;
