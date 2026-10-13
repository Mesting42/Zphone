/** Production workbench reflow and actual entry/exit animation, using native UI. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {loadBuilder,createState} from './template-fixtures.mjs';
import {interceptAdsOnly} from './workbench-browser-helpers.mjs';
import {createAdTemplateApiMiddleware} from '../server/ad-template-store.js';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH||'C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output=resolve(process.env.DISCLOSURE_OUTPUT || 'coverage/reference-templates-20261012/production');await mkdir(output,{recursive:true});
const root=resolve('dist'),missing=[],checks=[],errors=[];
// The workbench has an existing API in both Vite dev and Vite preview. Use that
// same middleware when reopening dist, rather than silently faking its response.
const api=createAdTemplateApiMiddleware(resolve(root,'ad-templates'));
const server=createServer((req,res)=>api(req,res,async()=>{try{let file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!extname(file))file=resolve(file,'index.html');const data=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html;charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.json':'application/json'})[extname(file)]||'application/octet-stream');res.end(data);}catch{missing.push(req.url);res.writeHead(404);res.end();}}));await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}});await interceptAdsOnly(page);page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
 const b=loadBuilder(false,true),state=createState(b,b.presets.find(p=>p.domainId==='tech'));
 await page.locator('#upload-area[data-upload-ready="true"]').waitFor();await page.locator('#file-input').setInputFiles({name:'technology.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(state.data))});
 await page.waitForFunction(()=>Number(document.getElementById('data-count')?.textContent)===20);await page.locator('#btn-next').click();await page.locator('.theme-card[data-theme="tech"]').click();await page.locator('#btn-next').click();await page.locator('#step-3.active').waitFor();await page.locator('#btn-next').click();await page.locator('#step-4.active').waitFor();await page.locator('.config-tab[data-tab="style"]').click();
 const button=page.locator('[aria-controls="template-grid-panel"]'),panel=page.locator('#template-grid-panel');
 const height=()=>panel.evaluate(e=>e.getBoundingClientRect().height);
 assert.equal(await height(),0);await button.focus();await button.press('Enter');await page.waitForTimeout(120);const opening=await height();await page.waitForTimeout(350);const opened=await height();assert.ok(opening>0&&opening<opened);assert.equal(await panel.evaluate(e=>e.inert),false);
 await button.click();assert.equal(await panel.evaluate(e=>e.inert),true);await page.waitForTimeout(110);
 // 同一浏览器帧采集退出高度和 hidden，避免两次 RPC 跨过动画终点。
 const closingState=await panel.evaluate(e=>({height:e.getBoundingClientRect().height,hidden:e.hidden}));
 const closing=closingState.height;assert.ok(closing>0&&closing<opened);assert.equal(closingState.hidden,false);
 await page.waitForTimeout(350);assert.equal(await panel.evaluate(e=>e.hidden),true);assert.equal(await height(),0);
 checks.push({animation:{opening,opened,closing,closed:0},keyboard:true,inertDuringExit:true});
 await page.emulateMedia({reducedMotion:'reduce'});await button.click();assert.equal(await button.getAttribute('aria-expanded'),'true');assert.equal(await panel.evaluate(e=>e.inert),false);
 const chosen=page.locator('[data-template-id="deep-life-atlas"]');await chosen.focus();await chosen.press('Enter');await page.frameLocator('#preview-frame').locator('body[data-template-package="deep-life-atlas"]').waitFor();assert.match(await button.textContent(),/青绿·图像图鉴/);await button.click();assert.equal(await panel.evaluate(e=>e.hidden),true);
 for(const width of [1366,768,390,320]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(100);
  const box=await button.boundingBox();assert.ok(box.width>100);assert.ok(box.height>=44);assert.ok(await button.isVisible());assert.match(await button.textContent(),/青绿·图像图鉴/);
  checks.push({width,button:box,summary:true});await page.screenshot({path:output+'/controls-'+width+'.png'});
 }
 await page.close();
 const game=await browser.newPage({viewport:{width:1500,height:1000},reducedMotion:'reduce'});await interceptAdsOnly(game);game.on('pageerror',e=>errors.push(e.message));await game.goto(origin+'/game-builder/index.html');await game.locator('.config-tab[data-tab="style"]').click();await game.locator('[aria-controls="style-grid-panel"]').click();assert.ok(await game.locator('#style-grid').isVisible());const style=await game.locator('[aria-controls="style-grid-panel"]').evaluate(e=>getComputedStyle(e).display);assert.equal(style,'flex');checks.push({gameProductionSharedCSS:true,gameProductionSharedJS:true});await game.close();
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
}finally{await browser.close();await new Promise(r=>server.close(r));await writeFile(output+'/results.json',JSON.stringify({checks,errors,missing},null,2));}
console.log('PASS production shell, 4 widths, keyboard, entry/exit animation and reduced motion.');
