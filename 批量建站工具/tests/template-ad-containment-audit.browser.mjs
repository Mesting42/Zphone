/** Checks whether narrow detail-page ad containers actually clip their slots. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadBuilder, createState } from './template-fixtures.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const outputDir = resolve('coverage/template-layout-full');
const matrix = JSON.parse(readFileSync(resolve(outputDir, 'results.json'), 'utf8'));
const ordinaryBuilder = loadBuilder(false);
const gameBuilder = loadBuilder(true);
const failedKeys = new Set(matrix.failures.filter((failure) => failure.page === 'detail' && failure.width === 320).map((failure) => failure.preset));
const selected = [
  ...ordinaryBuilder.presets.map((preset) => ({ builder: ordinaryBuilder, preset,
    key: `ordinary-${preset.domainId || 'game'}-${preset.id}`.replace(/[^a-z0-9_-]+/gi, '-') })),
  ...gameBuilder.presets.map((preset) => ({ builder: gameBuilder, preset,
    key: `game-${preset.domainId || 'game'}-${preset.id}`.replace(/[^a-z0-9_-]+/gi, '-') }))
].filter((item) => failedKeys.has(item.key));
assert.equal(selected.length, failedKeys.size, 'Every ad containment failure must resolve to a template preset');

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { expectedPresets: selected.length, checkedPresets: 0, clippedSlots: 0, failures: [] };
const queue = selected.slice();
const gptStub = `(() => {
  const queued = window.googletag && window.googletag.cmd || [];
  const service = { enableSingleRequest(){}, addEventListener(){}, refresh(){} };
  function slot(path, size, id) { return {path,id,size,addService(){return this},setConfig(){return this},getSlotElementId(){return id}}; }
  window.googletag = { cmd:{push(fn){fn()}}, pubads:()=>service, setConfig(){}, enableServices(){}, defineSlot:slot,
    defineOutOfPageSlot:(path,type)=>slot(path,type,type), enums:{OutOfPageFormat:{INTERSTITIAL:'INTERSTITIAL',BOTTOM_ANCHOR:'BOTTOM_ANCHOR'}},
    display(value){const id=typeof value==='string'?value:value.id;const el=document.getElementById(id);if(el){el.style.background='#dbe5ed';el.innerHTML='<span style="display:block;padding:100px 15px;color:#304958;font:13px sans-serif">Advertisement test container</span>';}}
  }; queued.forEach(fn=>fn());
})();`;

function contentType(path) {
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.js')) return 'text/javascript';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.html')) return 'text/html';
  return 'application/octet-stream';
}

async function worker() {
  const page = await browser.newPage({ viewport: { width: 320, height: 1000 } });
  let active = null;
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'securepubads.g.doubleclick.net') return route.fulfill({ contentType: 'text/javascript', body: gptStub });
    if (url.hostname !== 'template-review.local') return route.fulfill({ contentType: 'text/javascript', body: '' });
    const path = 'website' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname));
    const content = active?.files[path];
    return content === undefined
      ? route.fulfill({ status: 404, body: `Missing generated asset: ${url.pathname}` })
      : route.fulfill({ contentType: contentType(url.pathname), body: String(content) });
  });

  while (queue.length) {
    const { builder, preset, key } = queue.shift();
    try {
      await builder.generator.exportWebsite(createState(builder, preset), () => {});
      active = { files: builder.files() };
      await page.goto('http://template-review.local/details/article1.html', { waitUntil: 'load' });
      const result = await page.evaluate(() => {
        const ads = [1, 2, 3].map((number) => {
          const element = document.getElementById(`div-gpt-ad-banner${number}`);
          if (!element) return { number, missing: true, clippedBy: [] };
          const rect = element.getBoundingClientRect();
          const clippedBy = [];
          for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
            const style = getComputedStyle(node);
            const bounds = node.getBoundingClientRect();
            const clipsX = /^(hidden|clip)$/.test(style.overflowX) &&
              (rect.left < bounds.left - 1 || rect.right > bounds.right + 1);
            const clipsY = /^(hidden|clip)$/.test(style.overflowY) &&
              (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1);
            if (clipsX || clipsY) clippedBy.push({
              tag: node.tagName.toLowerCase(),
              className: String(node.className || ''),
              overflowX: style.overflowX,
              overflowY: style.overflowY,
              bounds: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom }
            });
          }
          return {
            number,
            count: document.querySelectorAll(`#div-gpt-ad-banner${number}`).length,
            rect: { left: rect.left, right: rect.right, width: rect.width },
            directParentWidth: element.parentElement?.getBoundingClientRect().width,
            clippedBy
          };
        });
        return { scrollWidth: document.documentElement.scrollWidth, ads };
      });
      const clipped = result.ads.filter((ad) => ad.missing || ad.count !== 1 || ad.clippedBy.length);
      report.clippedSlots += clipped.length;
      if (clipped.length) report.failures.push({ preset: key, domainId: preset.domainId, clipped, metrics: result });
    } catch (error) {
      report.failures.push({ preset: key, domainId: preset.domainId, error: error.stack || error.message });
    }
    report.checkedPresets++;
    if (report.checkedPresets % 50 === 0) console.log(`audited ${report.checkedPresets}/${report.expectedPresets}`);
  }
  await page.close();
}

try {
  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, () => worker()));
} finally {
  await browser.close();
}

mkdirSync(outputDir, { recursive: true });
writeFileSync(resolve(outputDir, 'ad-containment-audit.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  expectedPresets: report.expectedPresets,
  checkedPresets: report.checkedPresets,
  presetsWithClippedAds: report.failures.length,
  clippedSlots: report.clippedSlots,
  firstFailures: report.failures.slice(0, 5).map((failure) => ({
    preset: failure.preset,
    ads: (failure.clipped || []).map((ad) => ({ number: ad.number, directParentWidth: ad.directParentWidth, clippedBy: ad.clippedBy }))
  })),
  output: resolve(outputDir, 'ad-containment-audit.json')
}, null, 2));
process.exitCode = report.failures.length ? 1 : 0;
