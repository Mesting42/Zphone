/**
 * 手动执行：PLAYWRIGHT_MODULE_PATH 可指向本机已有 Playwright，不修改产品依赖。
 * 渲染真实导出页，以 GPT 替身检查广告调用；不会向广告服务请求或点击广告。
 * 结果与截图写入被 Git 忽略的 coverage/template-layout-review/。
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadBuilder, createState } from './template-fixtures.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const narrow = process.argv.includes('--narrow');
const output = resolve('coverage/template-layout-review' + (narrow ? '-narrow' : ''));
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
const jobs = [];

// 覆盖每种独立布局的桌面/手机首页、详情和完整目录，以及每个领域的视觉主题。
for (const game of [false, true]) {
  const builder = loadBuilder(game);
  const presets = builder.presets.filter(preset => game
    ? builder.TemplateCatalog.getLayout(preset.id)
    : preset.domainId === 'tech' && builder.TemplateCatalog.getLayout(preset.structure.homeLayout));
  for (const preset of presets) {
    const state = createState(builder, preset);
    await builder.generator.exportWebsite(state, () => {});
    const files = builder.files();
    for (const width of (narrow ? [320] : [1440, 390])) {
      for (const pageType of ['home', 'detail', 'all']) jobs.push({ builder, preset, state, files, width, pageType, screenshot: pageType === 'home' });
    }
  }
  if (!game && !narrow) {
    for (const domain of Object.keys(builder.domains).filter(id => id !== 'tech')) {
      const preset = builder.presets.find(item => item.domainId === domain && item.variant === 14);
      const state = createState(builder, preset);
      await builder.generator.exportWebsite(state, () => {});
      jobs.push({ builder, preset, state, files: builder.files(), width: 1440, pageType: 'home', screenshot: true });
    }
  }
  // 手动广告与长标题压力检查，覆盖侧栏、目录和强调首卡布局。
  for (const preset of presets.slice(0, 5)) {
    const state = createState(builder, preset, 'manual');
    state.config.categories[0].name = 'A long category heading with several words that must wrap safely';
    state.config.categoryIconsEnabled = false;
    await builder.generator.exportWebsite(state, () => {});
    jobs.push({ builder, preset, state, files: builder.files(), width: 360, pageType: 'home', manual: true });
  }
}

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

let completed = 0;
async function worker() {
  const page = await browser.newPage();
  let active;
  let errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'securepubads.g.doubleclick.net') return route.fulfill({ contentType: 'text/javascript', body: gptStub });
    if (url.hostname !== 'template-review.local') return route.fulfill({ contentType: 'text/javascript', body: '' });
    const file = active.files['website' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname))];
    if (file === undefined) return route.fulfill({ status: 404, body: 'Fixture missing: ' + url.pathname });
    const contentType = url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.js') ? 'text/javascript' : url.pathname.endsWith('.json') ? 'application/json' : 'text/html';
    await route.fulfill({ contentType, body: String(file) });
  });
  while (jobs.length) {
    active = jobs.shift(); errors = [];
    const { builder, preset, state, width, pageType } = active;
    const path = pageType === 'home' ? 'index.html' : pageType === 'detail' ? 'details/article1.html' : builder.game ? 'all-games.html' : 'all-articles.html';
    const id = (builder.game ? 'games' : state.selectedTheme) + '-' + preset.id + '-' + width + '-' + pageType + (active.manual ? '-manual' : '');
    try {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('http://template-review.local/' + path, { waitUntil: 'load' });
      await page.locator(pageType === 'detail' ? '.detail-page' : '.item-card').first().waitFor();
      const metrics = await page.evaluate(() => {
        const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
        const ads = [1, 2, 3].map(n => { const el = document.getElementById('div-gpt-ad-banner' + n); return { n, count: document.querySelectorAll('#div-gpt-ad-banner' + n).length, box: el && rect(el), parent: el && rect(el.parentElement), hidden: !!el && !el.checkVisibility() }; });
        const brokenAnchors = [...document.querySelectorAll('.navbar a[href^="#category-"],.side-drawer-panel a[href^="#category-"]')].filter(a => !document.getElementById(a.hash.slice(1))).map(a => a.hash);
        const overflow = [...document.querySelectorAll('.tpl-home,.tpl-section-heading,.item-card')].filter(el => { const r=el.getBoundingClientRect();return r.x < -1 || r.right > innerWidth + 1; }).map(el => ({class:el.className,...rect(el)}));
        return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, ads, brokenAnchors, overflow,
          calls: window.__adCalls || null, cards: document.querySelectorAll('.item-card').length,
          grid: document.querySelector('.tpl-sections .items-grid') && getComputedStyle(document.querySelector('.tpl-sections .items-grid')).gridTemplateColumns,
          icons: document.querySelectorAll('.category-title-icon').length };
      });
      const failures = [];
      if (metrics.scrollWidth > width + 1 || metrics.overflow.length) failures.push('horizontal overflow');
      if (metrics.brokenAnchors.length) failures.push('broken topic anchor');
      if (metrics.ads.some(ad => ad.count !== 1 || ad.hidden || ad.box.w < 300 || ad.parent.w < ad.box.w)) failures.push('ad missing, hidden or clipped');
      if (!active.manual) {
        for (const n of [1, 2, 3]) if (!metrics.calls?.displays.includes('div-gpt-ad-banner' + n)) failures.push('banner ' + n + ' did not display');
        if (pageType === 'home' && !metrics.calls?.displays.includes('INTERSTITIAL')) failures.push('homepage interstitial missing');
      }
      if (active.manual && metrics.icons) failures.push('icon toggle ignored');
      if (errors.length) failures.push(...errors);
      if (active.screenshot || failures.length) await page.screenshot({ path: resolve(output, id + '.png') });
      // 分类入口使用原导航栏；移动端和抽屉样式先展开菜单。
      if (pageType === 'home') {
        const toggle = page.locator('.hamburger');
        if (await toggle.isVisible()) await toggle.click();
        await page.locator('.navbar a[href^="#category-"],.side-drawer-panel a[href^="#category-"]').last().focus();
        await page.keyboard.press('Enter');
        if (!new URL(page.url()).hash.startsWith('#category-')) failures.push('keyboard topic navigation failed');
      }
      results.push({ id, failures, metrics });
    } catch (error) { results.push({ id, failures: [error.message] }); }
    completed++;
    if (completed % 40 === 0) console.log('Rendered ' + completed + ' pages');
  }
  await page.close();
}
try { await Promise.all([worker(), worker(), worker()]); } finally { await browser.close(); }
writeFileSync(resolve(output, 'results.json'), JSON.stringify(results, null, 2));
const failures = results.filter(result => result.failures.length);
console.log(JSON.stringify({ checked: results.length, failures: failures.map(({ id, failures }) => ({ id, failures })), output }, null, 2));
process.exitCode = failures.length ? 1 : 0;
