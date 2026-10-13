/** Real RAR/TXT -> eight UI selections -> downloaded ZIPs -> static reopen.
 * Requests for ad delivery are isolated; this does not measure ad fill/revenue. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createServer} from 'node:http';
import JSZip from 'jszip';
import {interceptAdsOnly,waitPreviewChange} from './workbench-browser-helpers.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || 'C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output=resolve(process.env.REFERENCE_OUTPUT || 'coverage/reference-templates-20261012/browser');await mkdir(output,{recursive:true});
const ids=['field-notes','pixelwire-editorial','stone-crumb','evwired-studio','daily-skillet','vitalpulse-journal','deep-life-atlas','print-field'];
const browser=await chromium.launch({channel:'msedge',headless:true});
const report={generatedAt:new Date().toISOString(),ui:[],layouts:[],errors:[],missingResources:[]};
const origin=process.env.BUILDER_URL || 'http://127.0.0.1:5174/';
async function accordion(page,id,expanded){const button=page.locator('[aria-controls="'+id+'-panel"]');if(await button.getAttribute('aria-expanded')!==String(expanded)){await button.click();await page.waitForTimeout(300);}assert.equal(await button.getAttribute('aria-expanded'),String(expanded));}
async function wizard(page){
 await page.locator('#upload-area[data-upload-ready="true"]').waitFor();
 await page.locator('#file-input').setInputFiles(resolve(process.env.REFERENCE_DATA || 'coverage/site-motion-20261012/full-regression/input/data/摇滚乐史.rar'));
 await page.waitForFunction(()=>/已解析|导入成功/.test(document.getElementById('upload-import-progress-text')?.textContent||''),null,{timeout:180000});
 if(await page.locator('[data-build-mode="differentiated"][aria-pressed="true"]').count())await page.locator('#differentiated-package-result.valid').waitFor({timeout:180000});
 await page.locator('#btn-next').click();
 await page.locator('#step-2.active, #step-4.active').waitFor({state:'visible'});
 // Differentiated workflows intentionally use [1,4,5]. Ordinary generation uses
 // the field and mapping screens, so do not operate invisible skipped steps.
 if(!await page.locator('#step-4.active').isVisible()){
  await page.locator('.theme-card[data-theme="tech"]').click();await page.locator('#btn-next').click();
  await page.locator('#step-3.active').waitFor();await page.locator('#btn-next').click();
 }
 await page.locator('#step-4.active').waitFor();
}
async function errors(page){page.on('pageerror',e=>report.errors.push(e.message));await interceptAdsOnly(page);}
async function importGameFixture(page){
 const zip=new JSZip();
 zip.file('manifest.json',JSON.stringify({schema_version:1,site_type:'games',site:{name:'Accordion Fixture',vertical:'Local puzzle games',audience:'Test operators',scope:'A local package for configuration checks.',base_url:'https://accordion-fixture.test',sections:['Arcade']}}));
 zip.file('design.json',JSON.stringify({family:'auto',seed:'accordion'}));zip.file('legal.json',JSON.stringify({contact_email:'qa@accordion-fixture.test'}));
 zip.file('provenance/content-provenance.json',JSON.stringify({source:'Synthetic test fixture.'}));zip.file('provenance/design-references.json',JSON.stringify({references:[]}));
 zip.file('content/games.json',JSON.stringify([{title:'Accordion puzzle',slug:'accordion-puzzle',category:'Arcade',description:'A local game for UI checks.',controls:'Click the button.',cover:'assets/cover.svg',local_entry:'games/puzzle.html',provider:'Test fixture',source_url:'https://fixture.invalid/record',license:'Test fixture'}]));
 zip.file('assets/cover.svg','<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#245342"/></svg>');zip.file('games/puzzle.html','<!doctype html><title>Local puzzle</title><button>Play</button>');
 await page.locator('#game-json-upload').setInputFiles({name:'accordion-fixture.zip',mimeType:'application/zip',buffer:await zip.generateAsync({type:'nodebuffer'})});
 await page.waitForFunction(()=>document.getElementById('source-status')?.classList.contains('is-success'),null,{timeout:60000});
}
async function audit(page,tag){
 await page.waitForFunction(()=>[...document.images].filter(i=>!i.loading||i.loading!=='lazy').every(i=>i.complete),null,{timeout:30000});
 // Trigger lazy media without waiting for animation-hidden elements.
 await page.evaluate(async()=>{for(const image of document.images){image.loading='eager';}await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
 const result=await page.evaluate(()=>{
  const width=document.documentElement.clientWidth;
  const cards=[...document.querySelectorAll('.item-card,.related-card')].map(e=>e.getBoundingClientRect());
  const slots=[...document.querySelectorAll('#adv1,#adv2,#adv3')].map(e=>e.getBoundingClientRect());
  const underfilled=[...document.querySelectorAll('.items-grid > .item-card')].filter(card=>{
   const grid=card.parentElement,css=getComputedStyle(grid),columns=css.gridTemplateColumns.split(/\s+/).map(parseFloat);
   const style=getComputedStyle(card),gap=parseFloat(css.columnGap)||0;
   const span=style.gridColumnEnd==='-1'?columns.length:parseInt(style.gridColumnEnd.replace('span ',''))||parseInt(style.gridColumnStart.replace('span ',''))||1;
   const expected=columns.slice(0,Math.min(span,columns.length)).reduce((a,b)=>a+b,0)+gap*(span-1);
   return Number.isFinite(expected)&&card.getBoundingClientRect().width<expected-3;
  }).length;
  return {title:document.title,overflow:document.documentElement.scrollWidth-width,broken:[...document.images].filter(i=>!i.naturalWidth).length,
   underfilled,
   overlap:cards.some(c=>slots.some(s=>s.width&&s.height&&c.left<s.right-1&&c.right>s.left+1&&c.top<s.bottom-1&&c.bottom>s.top+1)),
   navbar:!!document.querySelector('.ref-brand'),footer:!!document.querySelector('.ref-footer-masthead'),slots:slots.length};
 });
 assert.ok(result.overflow<=1,tag+': overflow '+result.overflow);assert.equal(result.broken,0,tag+': images');assert.equal(result.overlap,false,tag+': card/ad overlap');assert.ok(result.navbar&&result.footer,tag+': shared shell');
 assert.equal(result.underfilled,0,tag+': inherited flex widths must not shrink grid cards');
 report.layouts.push({tag,...result});
}
try{
 if(!process.env.REFERENCE_UI_ONLY){
 const p=await browser.newPage({viewport:{width:1600,height:1000},acceptDownloads:true,reducedMotion:'reduce'});await errors(p);await p.goto(origin);await wizard(p);
 await p.locator('.config-tab[data-tab="ads"]').click();await p.locator('#ad-code-upload').setInputFiles(resolve(process.env.REFERENCE_AD || 'coverage/site-motion-20261012/full-regression/input/ads/zpau108.shipyardy.com.txt'));await p.waitForFunction(()=>/成功|识别|已上传|有效/.test(document.getElementById('ad-code-status')?.textContent||''));
 await p.locator('.config-tab[data-tab="style"]').click();
 for(const grid of ['template-grid','style-grid']){assert.equal(await p.locator('#'+grid+'-panel').isVisible(),false);assert.equal(await p.locator('#'+grid+'-panel').evaluate(e=>e.inert),true);}
 assert.equal(await p.locator('#template-grid .template-card').count(),39);
 await p.screenshot({path:output+'/collapsed-controls.png'});
 await accordion(p,'template-grid',true);
 for(const id of ids){
  await waitPreviewChange(p,()=>p.locator('[data-template-id="'+id+'"]').click(),'body[data-template-package="'+id+'"]');
  const summary=p.locator('[aria-controls="template-grid-panel"] .config-disclosure-summary');assert.ok((await summary.textContent()).length>2);
  await p.waitForFunction(id=>document.querySelector('#style-grid .selected')?.dataset.styleId==='reference-'+id,id);
  // All three previews must be rebuilt from the chosen package.
  for(const type of ['home','detail','all']){await waitPreviewChange(p,()=>p.locator('.preview-tab[data-page="'+type+'"]').click(),'body[data-template-package="'+id+'"]');assert.ok(await p.frameLocator('#preview-frame').locator('.ref-brand').count());}
  await accordion(p,'style-grid',true);
  const theme=p.locator('#style-grid [data-style-id="minimal"]');await theme.focus();await waitPreviewChange(p,()=>theme.press('Enter'));
  assert.equal(await p.locator('#style-grid .selected').getAttribute('data-style-id'),'minimal');
  await waitPreviewChange(p,()=>p.locator('#style-grid [data-style-id="reference-'+id+'"]').click());await accordion(p,'style-grid',false);
  await p.locator('#btn-next').click();
  const [download]=await Promise.all([p.waitForEvent('download',{timeout:120000}),p.locator('#btn-export').click()]);
  const path=output+'/'+id+'.zip';await download.saveAs(path);
  report.ui.push({id,download:path,summary:await summary.textContent()});
  const zip=await JSZip.loadAsync(await readFile(path));const names=Object.keys(zip.files).filter(k=>!zip.files[k].dir);const root=names.find(k=>/(^|\/)index.html$/.test(k)).replace(/index.html$/,'');const detail=names.find(k=>k.startsWith(root+'details/')&&k.endsWith('.html')).slice(root.length);
  const server=createServer(async(req,res)=>{const filename=root+(decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html');const f=zip.file(filename);if(!f){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html;charset=utf-8','.css':'text/css','.js':'application/javascript','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'})[extname(filename)]||'application/octet-stream');res.end(await f.async('nodebuffer'));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{for(const width of [1366,768,390,320]){
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});await errors(page);const local='http://127.0.0.1:'+server.address().port;
   page.on('response',r=>{if(r.url().startsWith(local)&&r.status()>=400)report.missingResources.push(r.url());});
   for(const [type,file] of [['home','index.html'],['detail',detail],['all','all-articles.html'],...(width===1366||width===320?['about','contact','privacy','terms'].map(t=>[t,t+'.html']):[])]){
    await page.goto(local+'/'+file,{waitUntil:'load'});await audit(page,id+'/'+type+'/'+width);
    if(type==='home'&&(width===1366||width===390))await page.screenshot({path:output+'/'+id+'-'+width+'.png'});
    if(width<=390){const button=page.locator('.hamburger');await button.click();assert.equal(await button.getAttribute('aria-expanded'),'true');assert.ok(await page.locator('.nav-links').isVisible());await button.press('Escape');assert.equal(await button.getAttribute('aria-expanded'),'false');assert.equal(await page.locator('.nav-links').isVisible(),false);}
   }
   // Full text reflow with an unusually long imported brand at enlarged root type.
   if(width===320){await page.goto(local+'/index.html');await page.evaluate(()=>{document.documentElement.style.fontSize='20px';document.querySelector('.ref-brand strong').textContent='An unusually long publication title that must fit narrow navigation';});await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=1);}
   await page.close();
  }}finally{await new Promise(r=>server.close(r));}
  console.log('PASS '+id+' real export + reflow');
  await p.locator('#btn-prev').click();await p.locator('#step-4.active').waitFor();await p.locator('.config-tab[data-tab="style"]').click();
 }
 // The source domains have all been unit-checked. These actual UI transitions
 // verify that shared IDs also survive switching across unrelated fields.
 for(const domain of ['health','environment','culturalheritage','general']){
  await p.locator('.step-item[data-step="2"]').click();await p.locator('.theme-card[data-theme="'+domain+'"]').click();await p.locator('#btn-next').click();await p.locator('#btn-next').click();await p.locator('.config-tab[data-tab="style"]').click();
  for(const id of ids)assert.equal(await p.locator('[data-template-id="'+id+'"]').count(),1);
  report.ui.push({domain,globalTemplates:8});
 }
 // Both workbenches expose identical accordions, including differentiated grids.
 await p.close();
 }
 for(const game of [false,true]){
  let page=await browser.newPage({viewport:{width:1500,height:1000},reducedMotion:'reduce'});await errors(page);await page.goto(origin+(game?'game-builder/index.html':''));if(!game)await wizard(page);
  await page.locator('.config-tab[data-tab="style"]').click();
  for(const id of game?['layout-template-grid','style-grid']:['template-grid','style-grid']){assert.equal(await page.locator('#'+id+'-panel').isVisible(),false);await accordion(page,id,true);await accordion(page,id,false);}
  // Each workflow requires its own import. Begin on its actual entry page rather
  // than reusing normal import progress/status from the previous workflow.
  await page.close();page=await browser.newPage({viewport:{width:1500,height:1000},reducedMotion:'reduce'});await errors(page);await page.goto(origin+(game?'game-builder/index.html':''));
  await page.locator('[data-build-mode="differentiated"]').click();
  // Changing workflow intentionally invalidates previously visited steps. Walk
  // through the import/configuration again instead of clicking a disabled step.
  if(!game)await wizard(page);
  else await importGameFixture(page);
  for(const id of ['diff-domain-blueprint-grid','diff-style-preset-grid']){
   await page.locator('.diff-config-tab[data-diff-tab="'+(id==='diff-style-preset-grid'?'style':'identity')+'"]').click();
   await page.locator('[aria-controls="'+id+'-panel"]').waitFor({state:'visible'});assert.equal(await page.locator('#'+id+'-panel').isVisible(),false);await accordion(page,id,true);const card=page.locator('#'+id+' > *').nth(1);await card.click();await page.waitForTimeout(100);assert.notEqual(await page.locator('[aria-controls="'+id+'-panel"] .config-disclosure-summary').textContent(),'未选择');await accordion(page,id,false);
  }
  report.ui.push({workbench:game?'game':'editorial',accordions:true});await page.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.missingResources,[]);
}catch(e){report.failure=e.stack;throw e;}finally{await writeFile(output+'/results.json',JSON.stringify(report,null,2));await browser.close();}
console.log('PASS '+report.layouts.length+' exported layouts; '+report.ui.length+' UI checks; zero page errors/missing resources.');
