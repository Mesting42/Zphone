/** Real uploads -> actual menus -> computed preview styles -> downloaded ZIP.
 * Differentiated workflows are deliberately excluded by the user's test scope. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import JSZip from 'jszip';
import {expandPicker,interceptAdsOnly,waitPreviewChange} from './workbench-browser-helpers.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH||'C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const round=resolve(process.env.CONFIGURATION_ROUND_ROOT||'coverage/full-regression-20261013/configuration-controls-1');
const output=resolve(round,'configuration-controls');await mkdir(output,{recursive:true});
const base='http://127.0.0.1:5174/';
const browser=await chromium.launch({channel:'msedge',headless:true});
const report={workflows:[],errors:[]};
async function choose(page,id,value){
 const trigger=page.locator('#'+id).locator('..').locator('button[aria-haspopup="listbox"]');
 const menu=await trigger.getAttribute('aria-controls');
 // 先完成滚动再打开 portal 菜单，避免面板的滚动关闭事件与点击竞争。
 await trigger.scrollIntoViewIfNeeded();await page.waitForTimeout(180);
 await waitPreviewChange(page,async()=>{
  await trigger.click();await page.locator('#'+menu).waitFor({state:'visible'});
  try{await page.locator('#'+menu+' [data-value="'+value+'"]').click();}
  catch(error){await page.screenshot({path:resolve(output,'menu-failure-'+id+'.png')});throw error;}
 });
 assert.equal(await page.locator('#'+id).inputValue(),value);
}
async function cardValues(frame){return frame.locator('.items-grid .item-card').first().evaluate(card=>{
 const s=getComputedStyle(card),body=card.querySelector('.card-body'),image=card.querySelector('.card-image'),grid=card.closest('.items-grid');
 const matched=[];function scan(rules){for(const rule of rules){if(rule.selectorText){try{if(image&&(image.matches(rule.selectorText)||image.parentElement.matches(rule.selectorText))&&(rule.style.height||rule.style.maxHeight||rule.style.flex))matched.push({selector:rule.selectorText,css:rule.style.cssText});}catch{}}if(rule.cssRules)scan(rule.cssRules);}}for(const sheet of document.styleSheets){try{scan(sheet.cssRules);}catch{}}
 return {radius:s.borderTopLeftRadius,border:s.borderTopStyle,padding:body&&getComputedStyle(body).paddingLeft,imageHeight:image&&getComputedStyle(image).height,frameCss:image&&getComputedStyle(image.parentElement).cssText,frameFlex:image&&getComputedStyle(image.parentElement).flex,frameMaxHeight:image&&getComputedStyle(image.parentElement).maxHeight,frameHeight:image&&getComputedStyle(image.parentElement).height,imageVariable:getComputedStyle(card).getPropertyValue('--card-image-height'),matched,gap:getComputedStyle(grid).gap,columns:getComputedStyle(grid).gridTemplateColumns,cardDisplay:s.display};
});}
async function sticky(page){
 const panel=page.locator('.config-panel:visible').first();
 return panel.evaluate(panel=>{
  const nav=panel.querySelector(':scope > .config-tabs');panel.scrollTop=panel.scrollHeight;
  const s=getComputedStyle(nav),p=panel.getBoundingClientRect(),r=nav.getBoundingClientRect();
  const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
  return {position:s.position,offset:r.top-p.top,zIndex:s.zIndex,uncovered:hit===nav||nav.contains(hit),scroll:panel.scrollTop};
 });
}
try{
 for(const game of [false,true]){
  const page=await browser.newPage({viewport:{width:1920,height:1050},acceptDownloads:true});page.setDefaultTimeout(45000);
  page.on('pageerror',e=>report.errors.push(e.message));await interceptAdsOnly(page);await page.goto(base+(game?'game-builder/index.html':''));
  const data=game?resolve('game-builder/assets/builtin-game-sources/game-source-1.zip'):resolve(round,'input/data/摇滚乐史.rar');
  const ad=resolve(round,'input/ads/'+(game?'zpau108a.synvexia.top.txt':'zpau108.shipyardy.com.txt'));
  if(game){
   await page.locator('#source-status').filter({hasText:'已加载'}).waitFor();
   await page.locator('#game-json-upload').setInputFiles(data);
   await page.waitForFunction(()=>document.getElementById('source-status').classList.contains('is-success')&&/已加载/.test(document.getElementById('source-status').textContent),null,{timeout:180000});
  }else{
   await page.locator('#upload-area[data-upload-ready="true"]').waitFor();await page.locator('#file-input').setInputFiles(data);
   await page.waitForFunction(()=>/已解析|导入成功/.test(document.getElementById('upload-import-progress-text')?.textContent||''),null,{timeout:180000});
   await page.locator('#btn-next').click();await page.locator('.theme-card:visible').first().click();await page.locator('#btn-next').click();await page.locator('#step-3.active').waitFor();await page.locator('#btn-next').click();
  }
  console.log((game?'game':'editorial')+': real data upload completed');
  await page.locator('.config-tab[data-tab="ads"]').click();await page.locator('#ad-code-upload').setInputFiles(ad);
  await page.waitForFunction(()=>/成功|识别|已上传|有效/.test(document.getElementById('ad-code-status').textContent));
  await page.locator('.config-tab[data-tab="style"]').click();
  await expandPicker(page,game?'layout-template-grid':'template-grid');
  await waitPreviewChange(page,()=>page.locator(game?'[data-layout-id^="portal-"]':'[data-template-id*="-blueprint-"]').first().click());
  const emptySelections=await page.locator('#tab-structure select,#tab-style select').evaluateAll(selects=>selects.filter(select=>select.options.length&&!select.disabled&&select.selectedIndex<0).map(select=>select.id));
  assert.deepEqual(emptySelections,[],'every visible configuration must show its actual selected value');
  const pin=await sticky(page);assert.equal(pin.position,'sticky');assert.ok(pin.scroll>0);assert.ok(pin.offset>=0&&pin.offset<20,JSON.stringify(pin));assert.ok(pin.uncovered);console.log((game?'game':'editorial')+': sticky navigation passed');
  await page.screenshot({path:resolve(output,game?'game-sticky.png':'editorial-sticky.png')});
  const frame=page.frameLocator('#preview-frame'),steps=[];
  // These assertions inspect final computed styles, rather than saved values or generated text.
  for(const [id,value,property,expected] of [['card-radius','24px','radius','24px'],['card-border','dashed','border','dashed'],['card-spacing','40px','padding','40px'],['card-image-height','260px','imageHeight','260px'],['grid-gap','30px','gap','30px']]){
   await choose(page,id,value);const actual=await cardValues(frame);assert.equal(actual[property],expected,id+': '+JSON.stringify(actual));steps.push({id,value,actual});
  }
  if(!game){
   await expandPicker(page,'template-grid');await waitPreviewChange(page,()=>page.locator('[data-template-id="deep-life-atlas"]').click());
   for(const [id,value,property,expected] of [['card-radius','24px','radius','24px'],['card-border','dashed','border','dashed'],['card-spacing','40px','padding','40px'],['card-image-height','260px','imageHeight','260px'],['grid-gap','30px','gap','30px']]){
    await choose(page,id,value);const actual=await cardValues(frame);assert.equal(actual[property],expected,'reference template '+id+': '+JSON.stringify(actual));steps.push({template:'deep-life-atlas',id,value,actual});
   }
  }
  await choose(page,'transition-speed','0.8s');
  const duration=await frame.locator('.sf-card-interactive').first().evaluate(e=>getComputedStyle(e).transitionDuration);assert.ok(duration.split(',').every(v=>v.trim()==='0.8s'),duration);
  await page.locator('.config-tab[data-tab="structure"]').click();await choose(page,'card-columns','3');
  assert.equal((await cardValues(frame)).columns.split(' ').length,3);
  await page.locator('.config-tab[data-tab="style"]').click();
  await choose(page,'card-view-mode','list');assert.equal((await cardValues(frame)).columns.split(' ').length,1);
  // Conditional controls must recover immediately when their prerequisite is enabled.
  assert.ok(await page.locator('#hero-style').isDisabled());
  await page.locator('.config-tab[data-tab="structure"]').click();
  await waitPreviewChange(page,()=>page.locator('label[for="hero-enabled"]').click());
  await page.locator('.config-tab[data-tab="style"]').click();assert.equal(await page.locator('#hero-style').isDisabled(),false);
  await choose(page,'hero-style','minimal');assert.ok(await frame.locator('.hero').count());
  // Reopen downloaded HTML through HTTP, with its real stylesheet and resources.
  await page.locator('#btn-next').click();const [download]=await Promise.all([page.waitForEvent('download',{timeout:180000}),page.locator('#btn-export').click()]);
  const archive=resolve(output,game?'game-configured.zip':'editorial-configured.zip');await download.saveAs(archive);
  const zip=await JSZip.loadAsync(await readFile(archive));const home=Object.keys(zip.files).find(p=>/^[^/]+\/index\.html$/.test(p));assert.ok(home);
  const html=await zip.file(home).async('string'),cssPath=Object.keys(zip.files).find(p=>/\/css\/style\.css$/.test(p));
  const css=await zip.file(cssPath).async('string');assert.match(css,/Explicit configuration overrides/);assert.match(html,/--sf-motion-speed:0\.8s/);
  const server=createServer(async(req,res)=>{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1);const file=zip.file(path);if(!file){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':'application/octet-stream');res.end(await file.async('nodebuffer'));});
  await new Promise(done=>server.listen(0,'127.0.0.1',done));const exported=await browser.newPage({viewport:{width:1400,height:1000}});await interceptAdsOnly(exported);
  try{await exported.goto('http://127.0.0.1:'+server.address().port+'/'+home);const actual=await cardValues(exported);assert.equal(actual.radius,'24px');assert.equal(actual.border,'dashed');assert.equal(actual.padding,'40px');assert.equal(actual.imageHeight,'260px');assert.equal(actual.columns.split(' ').length,1);steps.push({exported:actual});}finally{await exported.close();await new Promise(done=>server.close(done));}
  report.workflows.push({workflow:game?'game':'editorial',data,ad,pin,duration,steps,archive});await page.close();
 }
 assert.deepEqual(report.errors,[]);
}finally{await writeFile(resolve(output,'results.json'),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report,null,2));
