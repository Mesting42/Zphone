/** Checks every untested edge of every responsive breakpoint in generated CSS. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadBuilder, createState } from './template-fixtures.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const outputDir = resolve('coverage/template-breakpoint-full');
mkdirSync(outputDir, { recursive: true });

const baseWidths = [320, 390, 768, 1024, 1440, 1920];
const declaredWidths = {
  ordinary: [400, 480, 520, 600, 720, 768, 769, 800, 960, 1000],
  game: [400, 480, 600, 720, 768, 769, 819, 820, 960, 1000, 1080]
};
const baselineWidths = (game) => new Set([...baseWidths, ...declaredWidths[game ? 'game' : 'ordinary'].flatMap((width) => [width - 1, width, width + 1])]);
const makeKey = (game, preset) => `${game ? 'game' : 'ordinary'}-${preset.domainId || 'game'}-${preset.id}`.replace(/[^a-z0-9_-]+/gi, '-');

function extractMediaWidths(files) {
  const widths = new Set();
  for (const [path, value] of Object.entries(files)) {
    if (!/\.(?:html|css)$/i.test(path) || typeof value !== 'string') continue;
    for (const media of value.matchAll(/@media\s*([^{}]+)\{/gi)) {
      for (const condition of media[1].matchAll(/\b(?:min|max)-width\s*:\s*(\d+(?:\.\d+)?)px/gi)) {
        const breakpoint = Math.round(Number(condition[1]));
        if (Number.isFinite(breakpoint)) widths.add(breakpoint);
      }
    }
  }
  return [...widths].sort((a, b) => a - b);
}

function missingEdgeWidths(mediaWidths, baseline) {
  const widths = new Set();
  for (const point of mediaWidths) {
    for (const width of [point - 1, point, point + 1]) {
      if (width >= 320 && width <= 1920 && !baseline.has(width)) widths.add(width);
    }
  }
  return [...widths].sort((a, b) => a - b);
}

const selected = [];
const observedMediaWidths = new Set();
for (const game of [false, true]) {
  const inventoryBuilder = loadBuilder(game);
  const baseline = baselineWidths(game);
  for (let index = 0; index < inventoryBuilder.presets.length; index++) {
    const preset = inventoryBuilder.presets[index];
    await inventoryBuilder.generator.exportWebsite(createState(inventoryBuilder, preset), () => {});
    const mediaWidths = extractMediaWidths(inventoryBuilder.files());
    mediaWidths.forEach((width) => observedMediaWidths.add(width));
    const widths = missingEdgeWidths(mediaWidths, baseline);
    if (widths.length) selected.push({ game, index, key: makeKey(game, preset), mediaWidths, widths });
  }
}

const summary = {
  inspectedPresets: { ordinary: 1080, game: 30 },
  uniqueDeclaredBreakpointValues: [...observedMediaWidths].sort((a, b) => a - b),
  presetsWithUntestedEdges: selected.length,
  declaredBreakpointCount: selected.reduce((total, item) => total + item.mediaWidths.length, 0),
  expectedViewportChecks: selected.reduce((total, item) => total + item.widths.length * 3, 0),
  checkedPresets: 0,
  renderedPages: 0,
  viewportChecks: 0,
  failures: []
};
console.log(`Found ${selected.length} presets with untested declared breakpoint edges; running ${summary.expectedViewportChecks} additional checks`);

const gptStub = `(() => {
  const queued = window.googletag && window.googletag.cmd || [];
  window.__adCalls = { displays: [] };
  const service = { enableSingleRequest(){}, addEventListener(){}, refresh(){} };
  function slot(path, size, id) { return {path,id,size,addService(){return this},setConfig(){return this},getSlotElementId(){return id}}; }
  window.googletag = { cmd:{push(fn){fn()}}, pubads:()=>service, setConfig(){}, enableServices(){}, defineSlot:slot,
    defineOutOfPageSlot:(path,type)=>slot(path,type,type), enums:{OutOfPageFormat:{INTERSTITIAL:'INTERSTITIAL',BOTTOM_ANCHOR:'BOTTOM_ANCHOR'}},
    display(value){const id=typeof value==='string'?value:value.id;window.__adCalls.displays.push(id);const el=document.getElementById(id);if(el){el.style.background='#dbe5ed';el.innerHTML='<span style="display:block;padding:100px 15px;color:#304958;font:13px sans-serif">Advertisement test container</span>';}}
  }; queued.forEach(fn=>fn());
})();`;
function contentType(path) {
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.js')) return 'text/javascript';
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.html')) return 'text/html';
  return 'application/octet-stream';
}

const queue = selected.slice();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
async function worker() {
  const page = await browser.newPage();
  let active = null;
  const pageErrors = [];
  const missingAssets = new Set();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'securepubads.g.doubleclick.net') return route.fulfill({ contentType: 'text/javascript', body: gptStub });
    if (url.hostname !== 'template-review.local') return route.fulfill({ contentType: 'text/javascript', body: '' });
    const path = 'website' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname));
    const content = active?.files[path];
    if (content === undefined) {
      missingAssets.add(`${active?.key || 'unknown'}:${url.pathname}`);
      return route.fulfill({ status: 404, body: `Missing generated asset: ${url.pathname}` });
    }
    return route.fulfill({ contentType: contentType(url.pathname), body: String(content) });
  });

  while (queue.length) {
    const target = queue.shift();
    const builder = loadBuilder(target.game);
    const preset = builder.presets[target.index];
    active = { key: target.key, files: null };
    pageErrors.length = 0;
    try {
      await builder.generator.exportWebsite(createState(builder, preset), () => {});
      active.files = builder.files();
      const pages = [
        { type: 'home', path: 'index.html', selector: '.item-card' },
        { type: 'detail', path: 'details/article1.html', selector: '.detail-page' },
        { type: 'all', path: target.game ? 'all-games.html' : 'all-articles.html', selector: '.item-card' }
      ];
      for (const pageTarget of pages) {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto(`http://template-review.local/${pageTarget.path}`, { waitUntil: 'load' });
        await page.locator(pageTarget.selector).first().waitFor();
        summary.renderedPages++;
        for (const width of target.widths) {
          await page.setViewportSize({ width, height: 1000 });
          const metrics = await page.evaluate(() => {
            const selected = [...document.querySelectorAll('.tpl-home,.tpl-section-heading,.item-card,.detail-page')];
            const overflowing = selected.filter((element) => {
              const rect = element.getBoundingClientRect();
              return rect.left < -1 || rect.right > innerWidth + 1;
            }).map((element) => String(element.className));
            const ads = [1, 2, 3].map((number) => {
              const element = document.getElementById(`div-gpt-ad-banner${number}`);
              const rect = element?.getBoundingClientRect();
              return { number, count: document.querySelectorAll(`#div-gpt-ad-banner${number}`).length,
                hidden: !!element && !element.checkVisibility(), width: rect?.width || 0,
                left: rect?.left || 0, right: rect?.right || 0,
                displayed: !!window.__adCalls?.displays.includes(`div-gpt-ad-banner${number}`) };
            });
            const anchors = [...document.querySelectorAll('.navbar a[href^="#category-"],.side-drawer-panel a[href^="#category-"]')];
            return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, overflowing,
              brokenAnchors: anchors.filter((anchor) => !document.getElementById(anchor.hash.slice(1))).map((anchor) => anchor.hash), ads };
          });
          summary.viewportChecks++;
          const problems = [];
          if (metrics.scrollWidth > width + 1 || metrics.overflowing.length) problems.push('horizontal overflow');
          if (metrics.brokenAnchors.length) problems.push('broken topic anchor');
          if (metrics.ads.some((ad) => ad.count !== 1 || ad.hidden || ad.width < 300 || ad.left < -1 || ad.right > width + 1 || !ad.displayed)) {
            problems.push('banner slot missing, hidden, narrow, outside viewport, or not executed');
          }
          if (pageErrors.length) problems.push(...pageErrors.map((error) => `page error: ${error}`));
          if ([...missingAssets].some((asset) => asset.startsWith(target.key + ':'))) problems.push('missing generated asset');
          if (problems.length) summary.failures.push({ preset: target.key, page: pageTarget.type, width, problems, metrics });
        }
      }
    } catch (error) {
      summary.failures.push({ preset: target.key, page: 'export-or-render', problems: [error.stack || error.message] });
    }
    summary.checkedPresets++;
    if (summary.checkedPresets % 50 === 0) console.log(`breakpoint presets completed ${summary.checkedPresets}/${selected.length}`);
  }
  await page.close();
}

try {
  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, () => worker()));
} finally {
  await browser.close();
}

writeFileSync(resolve(outputDir, 'results.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, firstFailures: summary.failures.slice(0, 10), outputDir }, null, 2));
process.exitCode = summary.failures.length ? 1 : 0;
