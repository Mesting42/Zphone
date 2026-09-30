/**
 * Exhaustive rendered-template regression for every ordinary and game preset.
 * It uses the real generators and a local GPT stub; no live ad request is sent.
 * Reports and failure screenshots stay under the Git-ignored coverage directory.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadBuilder, createState } from './template-fixtures.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const output = resolve('coverage/template-layout-full');
mkdirSync(output, { recursive: true });

const baseWidths = [320, 390, 768, 1024, 1440, 1920];
const responsiveThresholds = {
  ordinary: [400, 480, 520, 600, 720, 768, 769, 800, 960, 1000],
  game: [400, 480, 600, 720, 768, 769, 819, 820, 960, 1000, 1080]
};
const widthsFor = (game) => [...new Set([
  ...baseWidths,
  ...responsiveThresholds[game ? 'game' : 'ordinary'].flatMap((width) => [width - 1, width, width + 1])
].filter((width) => width >= 320))].sort((a, b) => a - b);

const gptStub = `(() => {
  const queued = window.googletag && window.googletag.cmd || [];
  window.__adCalls = { slots: [], displays: [], configs: [] };
  const service = { enableSingleRequest(){}, addEventListener(){}, refresh(){} };
  function slot(path, size, id) { const value={path,id,size,addService(){return this},setConfig(config){this.config=config;return this},getSlotElementId(){return id}}; window.__adCalls.slots.push(value); return value; }
  window.googletag = { cmd: {push(fn){fn()}}, pubads:()=>service, setConfig:c=>window.__adCalls.configs.push(c), enableServices(){},
    defineSlot:slot, defineOutOfPageSlot:(path,type)=>slot(path,type,type), enums:{OutOfPageFormat:{INTERSTITIAL:'INTERSTITIAL',BOTTOM_ANCHOR:'BOTTOM_ANCHOR'}},
    display(value){const id=typeof value==='string'?value:value.id;window.__adCalls.displays.push(id);const el=document.getElementById(id);if(el){el.style.background='#dbe5ed';el.style.outline='1px solid #7792a5';el.innerHTML='<span style="display:block;padding:100px 15px;color:#304958;font:13px sans-serif">Advertisement test container</span>';}}
  }; queued.forEach(fn=>fn());
})();`;

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const summary = { ordinary: { expectedPresets: 1080, checkedPresets: 0, renderedPages: 0, viewportChecks: 0 },
  game: { expectedPresets: null, checkedPresets: 0, renderedPages: 0, viewportChecks: 0 }, failures: [] };

function localContentType(path) {
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.js')) return 'text/javascript';
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.html')) return 'text/html';
  return 'application/octet-stream';
}

async function inspectPresetSet(game) {
  const builder = loadBuilder(game);
  const label = game ? 'game' : 'ordinary';
  const queue = builder.presets.slice();
  const viewportWidths = widthsFor(game);
  if (!game) assert.equal(queue.length, 1080, 'all 36 ordinary domains must expose 30 templates');
  summary[label].expectedPresets = queue.length;
  console.log(`Starting ${label}: ${queue.length} presets × 3 pages × ${viewportWidths.length} widths`);

  async function worker() {
    const page = await browser.newPage();
    let active = null;
    let pageErrors = [];
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === 'securepubads.g.doubleclick.net') {
        return route.fulfill({ contentType: 'text/javascript', body: gptStub });
      }
      if (url.hostname !== 'template-review.local') {
        return route.fulfill({ contentType: 'text/javascript', body: '' });
      }
      const path = 'website' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname));
      const content = active?.files[path];
      if (content === undefined) {
        active?.missingAssets.push(url.pathname);
        return route.fulfill({ status: 404, body: `Missing generated asset: ${url.pathname}` });
      }
      return route.fulfill({ contentType: localContentType(url.pathname), body: String(content) });
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    while (queue.length) {
      const preset = queue.shift();
      const presetKey = `${label}-${preset.domainId || 'game'}-${preset.id}`.replace(/[^a-z0-9_-]+/gi, '-');
      active = { files: null, missingAssets: [] };
      pageErrors = [];
      try {
        const state = createState(builder, preset);
        await builder.generator.exportWebsite(state, () => {});
        active.files = builder.files();
        const listPage = game ? 'website/all-games.html' : 'website/all-articles.html';
        const requiredFiles = ['website/index.html', 'website/details/article1.html', listPage];
        const missingFiles = requiredFiles.filter((path) => active.files[path] === undefined);
        if (missingFiles.length) throw new Error(`Export omitted required pages: ${missingFiles.join(', ')}`);

        const pages = [
          { type: 'home', path: 'index.html', selector: '.item-card' },
          { type: 'detail', path: 'details/article1.html', selector: '.detail-page' },
          { type: 'all', path: game ? 'all-games.html' : 'all-articles.html', selector: '.item-card' }
        ];
        for (const target of pages) {
          await page.setViewportSize({ width: 1440, height: 1000 });
          await page.goto(`http://template-review.local/${target.path}`, { waitUntil: 'load' });
          await page.locator(target.selector).first().waitFor();
          summary[label].renderedPages++;

          for (const width of viewportWidths) {
            await page.setViewportSize({ width, height: 1000 });
            const metrics = await page.evaluate(() => {
              const box = (element) => {
                const rect = element.getBoundingClientRect();
                return { x: rect.x, right: rect.right, width: rect.width };
              };
              const ads = [1, 2, 3].map((number) => {
                const element = document.getElementById(`div-gpt-ad-banner${number}`);
                const rect = element?.getBoundingClientRect();
                const clippedBy = [];
                for (let node = element?.parentElement; node && node !== document.documentElement; node = node.parentElement) {
                  const style = getComputedStyle(node);
                  const bounds = node.getBoundingClientRect();
                  const clipsX = /^(hidden|clip|auto|scroll)$/.test(style.overflowX) &&
                    (rect.left < bounds.left - 1 || rect.right > bounds.right + 1);
                  const clipsY = /^(hidden|clip|auto|scroll)$/.test(style.overflowY) &&
                    (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1);
                  if (clipsX || clipsY) clippedBy.push({ id: node.id, className: String(node.className || ''),
                    overflowX: style.overflowX, overflowY: style.overflowY });
                }
                return { number, count: document.querySelectorAll(`#div-gpt-ad-banner${number}`).length,
                  box: element ? box(element) : null, parent: element?.parentElement ? box(element.parentElement) : null,
                  hidden: !!element && !element.checkVisibility(), clippedBy };
              });
              const topicAnchors = [...document.querySelectorAll('.navbar a[href^="#category-"],.side-drawer-panel a[href^="#category-"]')];
              const brokenAnchors = topicAnchors.filter((anchor) => !document.getElementById(anchor.hash.slice(1))).map((anchor) => anchor.hash);
              const overflowing = [...document.querySelectorAll('.tpl-home,.tpl-section-heading,.item-card,.detail-page')]
                .filter((element) => { const rect = element.getBoundingClientRect(); return rect.left < -1 || rect.right > innerWidth + 1; })
                .map((element) => ({ className: String(element.className), ...box(element) }));
              return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, ads, brokenAnchors, overflowing,
                adCalls: window.__adCalls || null, itemCount: document.querySelectorAll('.item-card').length };
            });
            summary[label].viewportChecks++;
            const problems = [];
            if (metrics.scrollWidth > width + 1 || metrics.overflowing.length) problems.push('horizontal overflow');
            if (metrics.brokenAnchors.length) problems.push('broken topic anchor');
            if (metrics.ads.some((ad) => ad.count !== 1 || ad.hidden || ad.box?.width < 300 || ad.clippedBy.length)) {
              problems.push('ad slot missing, hidden, narrow, or clipped');
            }
            if (metrics.adCalls?.slots.some((slot) => slot.id.startsWith('div-gpt-ad-banner') &&
                (!Array.isArray(slot.size) || slot.size[0] !== 300 || slot.size[1] !== 250))) {
              problems.push('banner slot is not configured at 300×250');
            }
            if (metrics.ads.some((ad) => !metrics.adCalls?.displays.includes(`div-gpt-ad-banner${ad.number}`))) {
              problems.push('banner slot did not execute');
            }
            if (target.type === 'home' && !metrics.adCalls?.displays.includes('INTERSTITIAL')) problems.push('homepage interstitial missing');
            if (pageErrors.length) problems.push(...pageErrors.map((error) => `page error: ${error}`));
            if (active.missingAssets.length) problems.push(...active.missingAssets.map((path) => `missing asset: ${path}`));
            if (problems.length) {
              const failure = { preset: presetKey, page: target.type, width, problems, metrics };
              summary.failures.push(failure);
              const screenshotPath = resolve(output, `${presetKey}-${target.type}-${width}.png`);
              await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
            }

            if (target.type === 'home' && width === 390) {
              const hamburger = page.locator('.hamburger');
              if (await hamburger.isVisible()) {
                await hamburger.click();
                await page.locator('.navbar a[href^="#category-"],.side-drawer-panel a[href^="#category-"]').last().focus();
                await page.keyboard.press('Enter');
                if (!new URL(page.url()).hash.startsWith('#category-')) {
                  summary.failures.push({ preset: presetKey, page: target.type, width, problems: ['keyboard topic navigation failed'] });
                }
                await page.goto(`http://template-review.local/${target.path}`, { waitUntil: 'load' });
                await page.locator(target.selector).first().waitFor();
              }
            }
          }
        }
      } catch (error) {
        summary.failures.push({ preset: presetKey, page: 'export-or-render', problems: [error.stack || error.message] });
      }
      summary[label].checkedPresets++;
      if (summary[label].checkedPresets % 20 === 0) {
        console.log(`${label}: completed ${summary[label].checkedPresets}/${summary[label].expectedPresets}`);
      }
    }
    await page.close();
  }

  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, () => worker()));
}

try {
  await inspectPresetSet(false);
  await inspectPresetSet(true);
} finally {
  await browser.close();
}

writeFileSync(resolve(output, 'results.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({
  ordinary: summary.ordinary,
  game: summary.game,
  failureCount: summary.failures.length,
  firstFailures: summary.failures.slice(0, 30).map(({ preset, page, width, problems }) => ({ preset, page, width, problems })),
  output
}, null, 2));
process.exitCode = summary.failures.length ? 1 : 0;
