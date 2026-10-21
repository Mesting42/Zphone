/** Real archive acceptance for the shared policy preview. Original archives are
 * read only; replacement content, downloads and screenshots live in coverage. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import JSZip from 'jszip';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH
    || 'C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const source = process.env.REUSE_ARCHIVE || 'C:/Users/zyt/Downloads/wdg97b.vibory.pro_zJFzC.tar.gz';
const output = resolve('coverage/template-reuse-preview');
await mkdir(output, { recursive: true });
const sourceBytes = await readFile(source);
const cover = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ioAAAAASUVORK5CYII=';
const items = Array.from({ length: 15 }, (_, i) => ({ title: 'Replacement article ' + (i + 1),
    content: '<p>New article body ' + (i + 1) + ' with enough prose to verify the original detail layout.</p>',
    category: ['Silk and webs', 'Senses', 'Habitats', 'Conservation', 'Field notes'][i % 5], image: cover }));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
try {
    for (const scenario of ['reuse-direct', 'injection-to-reuse', 'policy-direct']) {
        console.log('START', scenario);
        const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        // This is a local preview test. Original remote covers get a controlled
        // image response; ad requests and unrelated third-party calls are blocked.
        await page.route('**/*', route => {
            const url = route.request().url();
            if (/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/.test(url) || !/^https?:/.test(url)) return route.continue();
            if (/\.(?:jpg|png|webp)(?:\?|$)/i.test(url)) return route.fulfill({ contentType: 'image/png', body: Buffer.from(cover.split(',')[1], 'base64') });
            return route.abort();
        });
        await page.goto(process.env.BUILDER_URL || 'http://127.0.0.1:5191/', { waitUntil: 'domcontentloaded' });
        console.log('LOADED', scenario);
        const frame = () => page.frameLocator('#preview-frame');
        if (scenario === 'injection-to-reuse') {
            await page.locator('[data-build-mode="ad-injection"]').click();
            await page.locator('#injection-sites-input').setInputFiles(source);
            await page.waitForFunction(() => document.getElementById('injection-scan-progress-text').textContent.includes('已识别'));
            await page.locator('#btn-next').click();
            await frame().locator('.navbar').waitFor();
            assert.equal(await page.locator('#preview-frame').getAttribute('sandbox'), 'allow-scripts');
            await page.locator('#btn-prev').click();
        }
        const reuse = scenario !== 'policy-direct';
        await page.locator('[data-build-mode="' + (reuse ? 'ad-template-reuse' : 'ad-restoration') + '"]').click();
        await page.locator('#restoration-sites-input').setInputFiles(source);
        console.log('UPLOADED', scenario);
        await page.waitForFunction(() => document.getElementById('restoration-scan-progress-text').textContent.includes('已识别 1 个站点'));
        if (reuse) {
            await page.locator('#template-reuse-content-input').setInputFiles({ name: 'replacement.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(items)) });
            await page.waitForFunction(() => document.getElementById('template-reuse-result').textContent.includes('已读取 15 项内容'));
        }
        await page.locator('#btn-next').click();
        console.log('CONFIGURING', scenario);
        await frame().locator('.item-card').first().waitFor();
        console.log('CARDS_RENDERED', scenario);
        const stats = await frame().locator('body').evaluate(async body => {
            await Promise.all([...body.querySelectorAll('.item-card img')].map(img => {
                img.loading = 'eager';
                return Promise.race([img.decode().catch(() => {}), new Promise(done => setTimeout(done, 5000))]);
            }));
            const nav = body.querySelector('.navbar');
            const cards = [...body.querySelectorAll('.item-card')];
            return { cards: cards.length, images: cards.filter(card => card.querySelector('img')?.naturalWidth > 0).length,
                grid: getComputedStyle(body.querySelector('.items-grid')).display,
                nav: getComputedStyle(nav).position, background: getComputedStyle(body).backgroundColor,
                titles: cards.map(card => card.querySelector('.card-title').textContent),
                ads: [...body.querySelectorAll('[id^="div-gpt-ad-banner"]')].map(node => node.id),
                opaque: (() => { try { void parent.document.body; return false; } catch { return true; } })() };
        });
        assert.equal(stats.cards, reuse ? 15 : 26, 'All source/replacement cards must render');
        assert.equal(stats.images, stats.cards, 'Cover mapping must render images');
        assert.equal(stats.grid, 'grid', 'Source card layout must remain styled');
        assert.notEqual(stats.background, 'rgba(0, 0, 0, 0)', 'Source CSS must load');
        assert.ok(stats.opaque, 'Uploaded scripts must remain sandboxed');
        assert.deepEqual(stats.ads.sort(), ['div-gpt-ad-banner1', 'div-gpt-ad-banner2', 'div-gpt-ad-banner3']);
        if (reuse) assert.ok(stats.titles.every(title => title.startsWith('Replacement article')));
        // Let the source site's entry animation finish before capturing evidence.
        await page.waitForTimeout(800);
        await page.screenshot({ path: resolve(output, scenario + '-home.png') });
        let expectedBackground = stats.background;
        let theme;
        if (scenario === 'reuse-direct') {
            // Match the reported screenshot's palette selection: switching to
            // white may change colors, but must retain cards/layout/ad positions.
            await page.locator('[data-template-theme="minimal"]').click();
            await frame().locator('.item-card').first().waitFor();
            await frame().locator('body').evaluate(body => new Promise((done, reject) => {
                const start = Date.now();
                const check = () => getComputedStyle(body).backgroundColor === 'rgb(255, 255, 255)' ? done()
                    : Date.now() - start > 5000 ? reject(new Error('Palette did not update')) : setTimeout(check, 50);
                check();
            }));
            theme = await frame().locator('body').evaluate(body => ({ background: getComputedStyle(body).backgroundColor,
                cards: body.querySelectorAll('.item-card').length, grid: getComputedStyle(body.querySelector('.items-grid')).display,
                ads: body.querySelectorAll('[id^="div-gpt-ad-banner"]').length }));
            assert.deepEqual(theme, { background: 'rgb(255, 255, 255)', cards: 15, grid: 'grid', ads: 3 });
            expectedBackground = theme.background;
            await page.waitForTimeout(800);
            await page.screenshot({ path: resolve(output, scenario + '-minimal.png') });
        }
        // An internal card link must return through the workbench router and
        // retain parent-relative CSS, the new detail body and existing ads.
        await frame().locator('.item-card').first().click();
        await frame().locator('.detail-title').waitFor();
        const detail = await frame().locator('body').evaluate(body => ({
            title: body.querySelector('.detail-title').textContent,
            text: body.querySelector('.detail-content').textContent,
            background: getComputedStyle(body).backgroundColor,
            ads: body.querySelectorAll('[id^="div-gpt-ad-banner"]').length
        }));
        assert.equal(detail.background, expectedBackground);
        assert.equal(detail.ads, 3);
        if (reuse) assert.match(detail.text, /New article body/);
        await page.screenshot({ path: resolve(output, scenario + '-detail.png') });
        if (scenario === 'injection-to-reuse') {
            // Exercise the real ZIP action, then compare unchanged stylesheet
            // bytes against the original archive via the public archive reader.
            const original = await page.evaluate(async ({ bytes, name }) => {
                const entries = await window.AdRestoration.readArchiveEntries(new File([Uint8Array.from(bytes)], name));
                return entries.filter(entry => /(?:\.css|\/js\/ad\.js)$/.test(entry.path))
                    .map(entry => ({ path: entry.path, bytes: Array.from(entry.bytes) }));
            }, { bytes: [...sourceBytes], name: basename(source) });
            await page.locator('#btn-next').click();
            const downloading = page.waitForEvent('download', { timeout: 120000 });
            await page.locator('#restoration-run-zip').click();
            const download = await downloading;
            const destination = resolve(output, download.suggestedFilename());
            await download.saveAs(destination);
            const zip = await JSZip.loadAsync(await readFile(destination));
            for (const entry of original.filter(entry => /\.css$/.test(entry.path))) {
                // 导出目录按域名重建，不要求保持源包外层的包装目录名。
                const relative = entry.path.slice(entry.path.indexOf('/') + 1);
                const path = Object.keys(zip.files).find(path => path.endsWith('/' + relative) || path === relative);
                assert.ok(path, 'Stylesheet must remain present in export');
                assert.deepEqual(await zip.file(path).async('uint8array'), Uint8Array.from(entry.bytes), 'Preview must not change exported CSS');
            }
            const htmlPaths = Object.keys(zip.files).filter(path => /\/details\/[^/]+\.html$/.test(path));
            assert.equal(htmlPaths.length, items.length);
            const adPath = Object.keys(zip.files).find(path => path.endsWith('/js/ad.js'));
            const sourceAd = new TextDecoder().decode(Uint8Array.from(original.find(entry => /\/js\/ad\.js$/.test(entry.path)).bytes));
            const exportedAd = await zip.file(adPath).async('string');
            const units = sourceAd.match(/\/\d+\/[^"'\s;]+/g);
            for (const unit of units) assert.ok(exportedAd.includes(unit), 'Original ad units must remain intact');
            const exportedHome = await zip.file(Object.keys(zip.files).find(path => path.endsWith('/index.html'))).async('string');
            assert.doesNotMatch(exportedHome, /previewRuntime|sf-policy-place|data:text\/(?:css|javascript)/);
            report.push({ scenario, stats, detail, export: { file: destination, detailPages: htmlPaths.length, stylesheetBytesUnchanged: true, adUnitsPreserved: true } });
        } else report.push({ scenario, stats, detail, theme });
        assert.deepEqual(errors, [], 'No uncaught errors should interrupt preview');
        console.log(JSON.stringify(report.at(-1)));
        await page.close();
    }
    await writeFile(resolve(output, 'report.json'), JSON.stringify({ passed: true, source, report }, null, 2));
} finally { await browser.close(); }
