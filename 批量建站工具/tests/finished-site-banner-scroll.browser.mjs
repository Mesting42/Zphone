import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH
  || 'C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const plannerSource = readFileSync(new URL('../js/finished-site-ads.js', import.meta.url), 'utf8')
  + '\nwindow.__finishedSiteAds = FinishedSiteAds;';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.setContent(`<!doctype html><html><head><style>
    html,body{margin:0}.site-header-host{position:sticky;top:0;z-index:20;background:#102030}
    header{height:72px;color:white}main{min-height:2400px;padding-top:24px}footer{height:120px}
  </style></head><body>
    <div id="site-header" class="site-header-host"><header><nav><a href="#">Home</a><a href="#">Tools</a></nav></header></div>
    <main><section><h1>Tool directory</h1><p>Original content before the cards.</p></section>
      <section><p>Middle content.</p><p>More original content.</p></section></main><footer>Footer</footer>
  </body></html>`);
  await page.addScriptTag({ content: plannerSource });
  const before = await page.evaluate(() => {
    const slots = [
      { unit: 'banner1', position: 'after-navbar' },
      { unit: 'banner2', position: 'content-middle' },
      { unit: 'banner3', position: 'footer-top' }
    ];
    window.__finishedSiteAds.placePolicy(document, 'tool', slots);
    const banner = document.getElementById('adv1');
    const positionedAncestor = (() => {
      let node = banner.parentElement;
      while (node && node !== document.body) {
        if (/^(?:sticky|fixed)$/.test(getComputedStyle(node).position)) return node.id || node.className || node.tagName;
        node = node.parentElement;
      }
      return '';
    })();
    return {
      top: banner.getBoundingClientRect().top,
      parent: banner.parentElement === document.body ? 'BODY' : banner.parentElement.id || banner.parentElement.tagName,
      positionedAncestor
    };
  });
  await page.evaluate(() => scrollTo(0, 900));
  await page.waitForTimeout(50);
  const afterTop = await page.locator('#adv1').evaluate(node => node.getBoundingClientRect().top);

  if (before.parent !== 'BODY') throw new Error('banner1 remained inside navigation host: ' + JSON.stringify(before));
  if (before.positionedAncestor) throw new Error('banner1 inherited a sticky/fixed ancestor: ' + JSON.stringify(before));
  if (!(afterTop < before.top - 850)) {
    throw new Error('banner1 followed the viewport instead of scrolling with the document: '
      + JSON.stringify({ beforeTop: before.top, afterTop }));
  }
  console.log(JSON.stringify({ passed: true, before, afterTop }));

  // Optional local-project verification. CI keeps the deterministic fixture
  // above; maintainers can point this at any uploaded static site preview.
  if (process.env.FINISHED_SITE_URL) {
    await page.goto(process.env.FINISHED_SITE_URL, { waitUntil: 'networkidle' });
    await page.addScriptTag({ content: plannerSource });
    const actualBefore = await page.evaluate(() => {
      window.__finishedSiteAds.placePolicy(document, 'home', [
        { unit: 'banner1', position: 'after-navbar' }
      ]);
      const banner = document.getElementById('adv1');
      return {
        top: banner.getBoundingClientRect().top,
        parent: banner.parentElement.id || banner.parentElement.tagName,
        parentIsBody: banner.parentElement === document.body
      };
    });
    await page.evaluate(() => scrollTo(0, 900));
    await page.waitForTimeout(50);
    const actualAfterTop = await page.locator('#adv1').evaluate(node => node.getBoundingClientRect().top);
    if (!actualBefore.parentIsBody || !(actualAfterTop < actualBefore.top - 850)) {
      throw new Error('uploaded site banner1 did not stay in document flow: '
        + JSON.stringify({ before: actualBefore, afterTop: actualAfterTop }));
    }
    console.log(JSON.stringify({ passed: true, site: process.env.FINISHED_SITE_URL, before: actualBefore, afterTop: actualAfterTop }));
  }
} finally {
  await browser.close();
}
