/** Compare original/reused layouts from archive evidence, not site-name rules.
 * All original archives stay read-only; third-party ad/image requests controlled. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import JSZip from 'jszip';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || 'C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const origin = process.env.BUILDER_URL || 'http://127.0.0.1:5191/';
const archive = process.env.REUSE_ARCHIVE || 'C:/Users/zyt/Downloads/wdg97b.vibory.pro_MNcEz.tar.gz';
const output = resolve('coverage/template-reuse-layout'); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
const errors = [], checks = [];
page.on('pageerror', e => errors.push(e.message));
try {
    await page.route('**/*', route => {
        const url = route.request().url();
        if (/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/.test(url) || !/^https?:/.test(url)) return route.continue();
        if (/\.(?:webp|jpg|png)(?:\?|$)/i.test(url)) return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ioAAAAASUVORK5CYII=', 'base64') });
        return route.abort();
    });
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-build-mode="ad-template-reuse"]').click();
    await page.locator('#restoration-sites-input').setInputFiles(archive);
    await page.waitForFunction(() => document.getElementById('restoration-scan-progress-text').textContent.includes('已识别 1 个站点'));
    const original = await page.evaluate(async () => {
        const entries = await AdRestoration.readArchiveEntries(document.getElementById('restoration-sites-input').files[0]);
        const metadata = AdRestoration.inspectSiteEntries(entries, 'comparison');
        window.layoutOriginal = { entries, metadata };
        const doc = new DOMParser().parseFromString(new TextDecoder().decode(entries.find(entry => entry.path === metadata.homePath).bytes), 'text/html');
        return { headings: [...doc.querySelectorAll('.category-title')].map(h => h.outerHTML),
            ads: [1, 2, 3].map(n => doc.getElementById('adv' + n).outerHTML),
            boundaries: [1, 2, 3].map(n => { const ad = doc.getElementById('adv' + n); return [ad.previousElementSibling?.outerHTML.includes('cat-0') ? 'cat-0' : ad.previousElementSibling?.outerHTML.includes('cat-1') ? 'cat-1' : ad.previousElementSibling?.tagName, ad.nextElementSibling?.tagName]; }) };
    });
    await page.locator('#template-reuse-site-type').selectOption('games');
    await page.waitForFunction(() => document.getElementById('template-reuse-result').textContent.includes('已读取 83 项内容'));
    await page.locator('#btn-next').click();
    const frame = page.frameLocator('#preview-frame');
    await frame.locator('.item-card').first().waitFor();
    for (const width of [1280, 768, 390]) {
        const sourcePreview = await page.evaluate(async ({ width }) => {
            const { createPolicyPreview } = await import('/js/ad-policy-preview.js');
            const iframe = document.createElement('iframe'); iframe.id = 'source-layout-comparison';
            iframe.setAttribute('sandbox', 'allow-scripts'); iframe.style = 'position:fixed;left:-20000px;top:0;width:' + width + 'px;height:900px;';
            iframe.srcdoc = createPolicyPreview().build(window.layoutOriginal.entries, window.layoutOriginal.metadata.homePath, window.layoutOriginal.metadata);
            document.getElementById('source-layout-comparison')?.remove(); document.body.appendChild(iframe);
            const current = document.getElementById('preview-frame'); current.style.width = width + 'px'; current.style.maxWidth = 'none';
            return true;
        }, { width });
        assert.ok(sourcePreview);
        const signature = async target => {
            await target.locator('.item-card').first().waitFor();
            return target.locator('body').evaluate(body => ({
                headings: [...body.querySelectorAll('.category-title')].map(h => h.outerHTML),
                cards: body.querySelectorAll('.item-card').length,
                allocations: [...body.querySelectorAll('.items-grid')].map(grid => grid.querySelectorAll('.item-card').length),
                ads: [1, 2, 3].map(n => { const ad = body.querySelector('#adv' + n), bounds = ad.querySelector('[id^="div-gpt"]').getBoundingClientRect(); return {
                    className: ad.className, style: Object.fromEntries(['padding', 'margin-top', 'margin-bottom', 'display', 'flex-direction', 'align-items', 'overflow'].map(property => [property, getComputedStyle(ad).getPropertyValue(property)])), previous: ad.previousElementSibling?.outerHTML.includes('cat-0') ? 'cat-0' : ad.previousElementSibling?.outerHTML.includes('cat-1') ? 'cat-1' : ad.previousElementSibling?.tagName,
                    next: ad.nextElementSibling?.tagName, width: bounds.width, height: bounds.height }; })
            }));
        };
        const before = await signature(page.frameLocator('#source-layout-comparison'));
        const after = await signature(frame);
        assert.deepEqual(after.headings, original.headings, 'Keep category names and complete icon markup');
        assert.deepEqual(after.headings, before.headings);
        assert.equal(after.cards, 83);
        assert.deepEqual(after.allocations.slice(0, -1), before.allocations.slice(0, -1), 'Do not redistribute earlier sections');
        assert.deepEqual(after.ads, before.ads, 'Keep ad gaps, source wrappers, spacing and preview dimensions');
        checks.push({ width, source: before, reused: after });
    }
    await page.evaluate(() => { document.getElementById('source-layout-comparison')?.remove(); const iframe = document.getElementById('preview-frame'); iframe.style.width = ''; iframe.style.maxWidth = ''; });
    await page.screenshot({ path: resolve(output, 'original-placement-preview.png') });
    async function downloadZip() {
        await page.locator('#btn-next').click();
        const downloading = page.waitForEvent('download', { timeout: 120000 });
        await page.locator('#restoration-run-zip').click();
        const download = await downloading; const path = resolve(output, download.suggestedFilename()); await download.saveAs(path);
        const zip = await JSZip.loadAsync(await readFile(path));
        const home = Object.keys(zip.files).find(path => /\/index.html$/.test(path) && !path.includes('/assets/'));
        return { path, html: await zip.file(home).async('string') };
    }
    const exported = await downloadZip();
    const exportedSignature = await page.evaluate(html => { const doc = new DOMParser().parseFromString(html, 'text/html'); return { headings: [...doc.querySelectorAll('.category-title')].map(h => h.outerHTML), ads: [1, 2, 3].map(n => doc.getElementById('adv' + n).outerHTML) }; }, exported.html);
    assert.deepEqual(exportedSignature, { headings: original.headings, ads: original.ads }, 'Export must retain exact source headings and ad container markup');
    await page.locator('#btn-prev').click();
    await page.locator('[name="ad-policy-placement-mode"][value="manual"]').check();
    await page.locator('[data-policy-place-slot="1"]').click();
    await frame.locator('[data-policy-position="footer-top"]').first().click();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-policy-field="slots.home.1.position"]')].some(select => select.value === 'footer-top'));
    const moved = await frame.locator('#adv2').evaluate(ad => ({ previous: ad.previousElementSibling?.tagName, next: ad.nextElementSibling?.tagName }));
    assert.equal(moved.next, 'FOOTER');
    const manual = await downloadZip();
    assert.ok(manual.html.indexOf('id="adv2"') > manual.html.indexOf('</main>'));
    assert.ok(manual.html.indexOf('id="adv2"') < manual.html.indexOf('<footer'));
    const fixtureChecks = [];
    // Independent layouts have different markup and icons, with no archive
    // names/domains from the reported site. Compare rendered geometry too.
    for (const icon of ['emoji', 'svg', 'image', 'css']) for (const width of [1280, 768, 390]) {
        const built = await page.evaluate(async ({ icon, width }) => {
            const { reuseTemplateSite, parseContentJson } = await import('/js/template-reuse.js');
            const { textEntry } = await import('/js/template-reuse-content.js');
            const { createPolicyPreview } = await import('/js/ad-policy-preview.js');
            const picture = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="9" fill="teal"/></svg>');
            const icons = { emoji: '★ ', svg: '<svg width="20" height="20"><circle cx="10" cy="10" r="9"/></svg>', image: '<img src="' + picture + '" width="20" height="20" alt="">', css: '<i class="category-icon"></i>' };
            const shell = html => '<html><head><style>.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:11px}.tile{height:80px}.category-icon:before{content:"★"}[id^="adv"]{padding:13px;margin:7px}.slot{width:min(100%,728px);height:90px}@media(max-width:600px){.cards{grid-template-columns:1fr}}</style></head><body><nav>Original nav</nav><main>' + html + '</main><footer>Original footer</footer></body></html>';
            const card = id => '<article class="tile"><a href="stories/' + id + '.html"><h3 class="tile-title">Old ' + id + '</h3></a><p>Old summary</p></article>';
            const sections = ['first', 'second'].map(id => '<section class="collection"><h2 class="category-title">' + icons[icon] + '<span class="label">Original ' + id + '</span></h2><div class="cards">' + card(id) + '</div></section>');
            const site = { entries: [textEntry('pack/index.html', shell(sections[0] + '<div id="adv2"><div id="div-gpt-ad-banner2" class="slot"></div></div>' + sections[1])), ...['first', 'second'].map(id => textEntry('pack/stories/' + id + '.html', shell('<h1>Old</h1><div class="detail-content">Old body</div>')))], metadata: { siteRoot: 'pack/', homePath: 'pack/index.html', detailPaths: ['pack/stories/first.html', 'pack/stories/second.html'] } };
            const reused = reuseTemplateSite(site, { contentItems: parseContentJson(Array.from({ length: 5 }, (_, i) => ({ title: 'New ' + i, content: 'New body ' + i }))) });
            for (const [id, target] of [['fixture-original', site], ['fixture-reused', reused]]) {
                document.getElementById(id)?.remove(); const iframe = document.createElement('iframe'); iframe.id = id; iframe.sandbox = 'allow-scripts';
                iframe.style = 'position:fixed;left:-20000px;width:' + width + 'px;height:900px;border:0';
                iframe.srcdoc = createPolicyPreview().build(target.entries, target.metadata.homePath, target.metadata); document.body.appendChild(iframe);
            }
            return true;
        }, { icon, width });
        assert.ok(built);
        const inspectFixture = async id => {
            const target = page.frameLocator('#' + id); await target.locator('.tile').first().waitFor();
            return target.locator('body').evaluate(body => ({
                headings: [...body.querySelectorAll('.category-title')].map(node => node.outerHTML),
                firstCount: body.querySelector('.collection').querySelectorAll('.tile').length,
                cards: body.querySelectorAll('.tile').length,
                columns: getComputedStyle(body.querySelector('.cards')).gridTemplateColumns,
                ad: { previous: body.querySelector('#adv2').previousElementSibling.className, next: body.querySelector('#adv2').nextElementSibling.className,
                    width: body.querySelector('.slot').getBoundingClientRect().width, height: body.querySelector('.slot').getBoundingClientRect().height }
            }));
        };
        const before = await inspectFixture('fixture-original'), after = await inspectFixture('fixture-reused');
        assert.deepEqual(after.headings, before.headings); assert.equal(after.cards, 5); assert.equal(after.firstCount, before.firstCount);
        assert.equal(after.columns, before.columns); assert.deepEqual(after.ad, before.ad); assert.equal(after.ad.height, 90);
        fixtureChecks.push({ icon, width, passed: true });
    }
    assert.deepEqual(errors, []);
    await writeFile(resolve(output, 'report.json'), JSON.stringify({ passed: true, archive, checks, fixtureChecks, defaultExport: exported.path, manualExport: manual.path, manualPlacement: moved }, null, 2));
    console.log(JSON.stringify({ passed: true, archive, widths: checks.map(check => check.width), defaultExport: exported.path, manualExport: manual.path }));
} finally { await browser.close(); }
