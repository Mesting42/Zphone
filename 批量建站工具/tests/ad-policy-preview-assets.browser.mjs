/** Public preview contract: local CSS, runtime JSON and images must load even
 * after switching from the sandboxed finished-site workflow. No remote calls. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH
  || 'C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = resolve('.');
const server = createServer(async (request, response) => {
  if (request.url === '/') { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><html><body></body></html>'); return; }
  if (request.url === '/favicon.ico') { response.writeHead(204).end(); return; }
  // innerHTML 可能在 MutationObserver 改写前预取旧图片路径。空响应不会
  // 提供可用图片；下方仍要求每张图片最终通过 data URL 成功解码。
  if (new URL(request.url, 'http://localhost').pathname.endsWith('/images/cover.png')) { response.writeHead(204).end(); return; }
  const file = resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
  if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  try {
    const bytes = await readFile(file);
    response.setHeader('Content-Type', extname(file) === '.js' ? 'application/javascript' : 'application/octet-stream');
    response.end(bytes);
  } catch { response.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
const fontBytes = [...await readFile(resolve('public/fonts/worksans/c982517386b8c9f8a2f6.woff2'))];
try {
  for (const sandbox of ['', 'allow-scripts']) for (const prefix of ['', 'outer/site/']) for (const nested of [false, true]) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.log('SCRIPT_ERROR', error.message.slice(0, 250)); });
    page.on('console', message => { if (message.type() === 'error') { errors.push(message.text()); console.log('CONSOLE_ERROR', message.text().slice(0, 250)); } });
    await page.goto(origin);
    await page.evaluate(async ({ prefix, sandbox, nested, fontBytes }) => {
      const { createPolicyPreview } = await import('/js/ad-policy-preview.js');
      const bytes = value => new TextEncoder().encode(value);
      const entryPath = prefix + (nested ? 'pages/detail.html' : 'index.html');
      const relative = nested ? '../' : '';
      const entries = [
        { path: entryPath, text: '<html><head><link rel="stylesheet" href="/css/site.css"><script defer src="' + relative + 'js/content.js"></script><script type="module" src="/js/module.mjs"></script><script src="/js/ad.js"></script></head><body><nav>Source navigation</nav><main class="cards"></main><div id="div-gpt-ad-banner2"></div></body></html>' },
        { path: prefix + 'css/site.css', text: '@import "./palette.css"; @font-face{font-family:PreviewFont;src:url("../fonts/site.woff2") format("woff2")} .cards{display:grid;grid-template-columns:repeat(2,1fr);font-family:PreviewFont} nav{background-image:url(../images/cover.png)}' },
        { path: prefix + 'css/palette.css', text: 'nav{background-color:rgb(18,52,86)}' },
        { path: prefix + 'js/content.js', text: 'localStorage.setItem("theme","source");sessionStorage.setItem("preview","active");fetch("' + relative + 'data.json?v=1").then(r=>r.json()).then(items=>{document.querySelector(".cards").innerHTML=items.map(x=>`<article class="card"><h2>${x.title}</h2><img src="' + relative + 'images/cover.png"></article>`).join("")})' },
        { path: prefix + 'js/module.mjs', text: 'import {label} from "./label.mjs";document.querySelector("nav").dataset.module=label;' },
        { path: prefix + 'js/label.mjs', text: 'export const label="模块已加载";' },
        { path: prefix + 'data.json', bytes: bytes(JSON.stringify([{ title: '中文 One 🐚' }, { title: 'Two' }])) },
        { path: prefix + 'fonts/site.woff2', bytes: Uint8Array.from(fontBytes) },
        { path: prefix + 'images/cover.png', bytes: Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ioAAAAASUVORK5CYII='), c => c.charCodeAt(0)) },
        { path: prefix + 'js/ad.js', text: 'throw new Error("Real ads must not execute in preview")' }
      ];
      const original = JSON.stringify(entries);
      const adapter = createPolicyPreview();
      const frame = document.createElement('iframe'); frame.id = 'preview'; frame.style.cssText = 'width:1000px;height:700px';
      if (sandbox) frame.setAttribute('sandbox', sandbox);
      document.body.appendChild(frame);
      // 同一 iframe 重建，覆盖从一个已有预览进入下一次策略预览的生命周期。
      const metadata = { siteRoot: prefix, adPath: prefix + 'js/ad.js' };
      frame.srcdoc = adapter.build(entries, entryPath, metadata);
      adapter.dispose();
      frame.srcdoc = adapter.build(entries, entryPath, metadata);
      if (JSON.stringify(entries) !== original) throw new Error('Preview mutated source/export entries');
    }, { prefix, sandbox, nested, fontBytes });
    const frame = page.frameLocator('#preview');
    await frame.locator('nav').waitFor({ state: 'attached' });
    await frame.locator('.card').first().waitFor({ state: 'attached' });
    await frame.locator('nav[data-module]').waitFor({ state: 'attached' });
    const stats = await frame.locator('body').evaluate(async body => ({
      background: getComputedStyle(body.querySelector('nav')).backgroundColor,
      cards: body.querySelectorAll('.card').length,
      images: Array.from(body.querySelectorAll('img')).filter(img => img.naturalWidth > 0 && img.src.startsWith('data:image/png;')).length,
      layout: getComputedStyle(body.querySelector('.cards')).display,
      module: body.querySelector('nav').dataset.module,
      font: (await document.fonts.load('16px PreviewFont')).length,
      title: body.querySelector('.card h2').textContent,
      storage: [localStorage.getItem('theme'), sessionStorage.getItem('preview')],
      opaque: (() => { try { void parent.document.body; return false; } catch { return true; } })()
    }));
    console.log(JSON.stringify({ sandbox, prefix, nested, stats, errors }));
    assert.equal(stats.background, 'rgb(18, 52, 86)', 'Uploaded stylesheet was lost');
    assert.equal(stats.layout, 'grid', 'Original card layout was lost');
    assert.equal(stats.cards, 2, 'Local JSON/content script did not render');
    assert.equal(stats.images, 2, 'Local dynamic images did not load');
    assert.equal(stats.module, '模块已加载', 'Local module dependencies did not load');
    assert.equal(stats.font, 1, 'Local font did not load');
    assert.equal(stats.title, '中文 One 🐚', 'UTF-8 content was corrupted');
    assert.deepEqual(stats.storage, ['source', 'active'], 'Source theme storage stopped content rendering');
    if (sandbox) assert.equal(stats.opaque, true, 'Uploaded scripts must remain isolated from the builder');
    assert.deepEqual(errors, [], 'Unexpected script/resource errors');
    results.push({ sandbox, prefix, nested, passed: true });
    await page.close();
  }
  console.log(JSON.stringify({ passed: true, results }));
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}
