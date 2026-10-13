/** Reopen genuine generator output over HTTP. Inspect live WAAPI effects and
 * pointer variables, not just screenshots or marker presence. No real ad fill. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import JSZip from 'jszip';
import {loadBuilder,createState} from './template-fixtures.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || 'C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output=resolve(process.env.SITE_MOTION_OUTPUT || 'coverage/site-motion-20261012');
await mkdir(output,{recursive:true});
const exports=new Map(),report={checks:[],errors:[]};
async function generate(name,game,domain='tech',options={},mode='migration',preset) {
  const builder=loadBuilder(game,!game,true);
  preset=preset||builder.presets.find(p=>game||p.domainId===domain);
  const state=createState(builder,preset,mode);
  Object.assign(state.config,options);
  await builder.generator.exportWebsite(state,()=>{});
  const files=builder.files(),zip=new JSZip();
  const entries=Object.entries(files).map(([path,source])=>[path.replace(/^website\//,''),source]);
  for(const [path,source] of entries)zip.file(path,source);
  await writeFile(resolve(output,name+'.zip'),await zip.generateAsync({type:'nodebuffer'}));
  exports.set(name,new Map(entries));
}
await generate('tech',false);
await generate('game',true);
await generate('health',false,'health');
await generate('off',false,'tech',{viewportRevealEnabled:false,cardInteractionEnabled:false,cardDomainIconEnabled:false,cardArrowEnabled:false});
await generate('custom',false,'tech',{cardGlowColor:'custom',cardGlowCustom:'#c355dd'});
const server=createServer((request,response)=>{
  const path=decodeURIComponent(new URL(request.url,'http://localhost').pathname).slice(1).split('/');
  const name=path.shift(),file=path.join('/')||'index.html',value=exports.get(name)?.get(file);
  if(value===undefined){response.writeHead(404);response.end();return;}
  response.writeHead(200,{'Content-Type':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html;charset=utf-8':'text/plain'});
  response.end(typeof value==='string'?value:Buffer.from(value));
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true});
async function page(context,init) {
  const p=await context.newPage();
  await p.addInitScript(()=>{window.__motionPageshows=[];addEventListener('pageshow',e=>window.__motionPageshows.push(e.persisted));});
  p.on('pageerror',e=>report.errors.push(e.message));
  await p.route(/https?:\/\/[^/]*(?:googletagservices|googlesyndication|doubleclick|googletagmanager|google-analytics)\.[^/]+\//i,r=>r.fulfill({body:'',contentType:'application/javascript'}));
  // createState supplies this reserved example URL as a synthetic game source.
  // Its network availability must not block a generated-page motion check.
  await p.route('https://games.example.com/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Local game fixture</title>'}));
  if(init)await p.addInitScript(init);
  return p;
}
async function ready(p,name='tech',route='index.html') {
  await p.goto(base+'/'+name+'/'+route);
  await p.waitForFunction(()=>!!window.SiteMotionController);
  await p.waitForTimeout(1200);
}
async function readable(p) {
  return p.evaluate(()=>({hidden:[...document.querySelectorAll('.item-card,.detail-content>p,.page-content>p')].filter(e=>Number(getComputedStyle(e).opacity)<.99).length,overflow:document.documentElement.scrollWidth-innerWidth}));
}
try {
  const desktop=await browser.newContext({viewport:{width:1366,height:900}}),p=await page(desktop);
  await ready(p);
  const first=p.locator('.item-card').first();
  await first.scrollIntoViewIfNeeded();await p.waitForTimeout(1100);
  const original=await first.getAttribute('href');
  const geometry=await first.boundingBox();
  await p.mouse.move(geometry.x+geometry.width*.8,geometry.y+geometry.height*.2);
  await p.waitForTimeout(400);
  const hovered=await first.evaluate(e=>({x:e.style.getPropertyValue('--sf-tilt-x'),y:e.style.getPropertyValue('--sf-tilt-y'),glowX:e.style.getPropertyValue('--sf-glow-x'),transform:getComputedStyle(e).transform,glow:getComputedStyle(e.querySelector('.sf-card-glow')).opacity,icon:e.querySelectorAll('.sf-card-orb').length,arrow:e.querySelectorAll('.sf-card-arrow').length}));
  assert.ok(parseFloat(hovered.x)>0);assert.ok(parseFloat(hovered.y)>0);assert.equal(hovered.glow,'1');assert.equal(hovered.icon,1);assert.equal(hovered.arrow,1);assert.equal(await first.getAttribute('href'),original);
  await p.screenshot({path:resolve(output,'desktop-hover.png')});
  await p.mouse.move(0,0);await p.waitForTimeout(350);
  assert.equal(await first.evaluate(e=>e.style.getPropertyValue('--sf-tilt-x')),'');
  await first.dispatchEvent('pointermove',{pointerType:'mouse',clientX:geometry.x+2,clientY:geometry.y+2});
  await first.dispatchEvent('pointercancel');await p.waitForTimeout(40);
  assert.equal(await first.evaluate(e=>e.style.getPropertyValue('--sf-glow-x')),'');
  await first.focus();assert.equal(await first.evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
  report.checks.push({name:'pointer-hover-reset-cancel-keyboard',hovered});
  await p.locator('body').click({position:{x:2,y:2}});
  await p.evaluate(()=>scrollTo(0,document.body.scrollHeight));await p.waitForTimeout(180);
  assert.equal(await first.evaluate(e=>e.classList.contains('sf-reveal-visible')),false);
  await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(120);
  assert.ok(await first.evaluate(e=>e.getAnimations().some(a=>a.playState==='running')));
  await p.waitForTimeout(1100);
  assert.ok(await first.evaluate(e=>Number(getComputedStyle(e).opacity)>.99));
  report.checks.push({name:'full-exit-reentry-replay'});
  // Observe an explicit persisted pageshow and also perform real history traversal.
  await p.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await p.waitForTimeout(100);assert.ok(await first.evaluate(e=>e.getAnimations().some(a=>a.playState==='running')));
  await p.waitForTimeout(1100);await first.click();await p.waitForURL('**/details/**');
  await p.goBack();await p.waitForTimeout(1200);assert.ok(await p.locator('.item-card').first().evaluate(e=>Number(getComputedStyle(e).opacity)>.99));
  report.checks.push({name:'persisted-pageshow-and-real-history',actualHistoryPersisted:await p.evaluate(()=>window.__motionPageshows.includes(true))});
  await p.setViewportSize({width:390,height:844});await p.waitForTimeout(100);
  const mobileFrames=await p.locator('.item-card').first().evaluate(e=>e.getAnimations().flatMap(a=>a.effect.getKeyframes()).filter(k=>k.translate));
  assert.ok(mobileFrames.every(k=>k.translate.startsWith('0px')));
  await p.waitForTimeout(1100);assert.equal((await readable(p)).overflow,0);
  report.checks.push({name:'responsive-keyframes',mobileFrames});
  await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(100);
  assert.equal((await readable(p)).hidden,0);assert.equal(await p.locator('.sf-reveal').count(),0);
  await p.emulateMedia({reducedMotion:'no-preference'});await p.waitForTimeout(1200);assert.ok(await p.locator('.sf-reveal').count()>0);
  report.checks.push({name:'live-reduced-motion-change'});
  const adProtection=await p.evaluate(()=>[...document.querySelectorAll('[id^="div-gpt-ad"]')].every(ad=>!ad.closest('.sf-reveal,[data-sf-card]')&&getComputedStyle(ad).opacity==='1'));
  assert.ok(adProtection);report.checks.push({name:'ads-outside-motion'});
  // All cards in a grid row share the same ad boundary, including cards which
  // are not the advertisement's immediate preceding DOM sibling.
  const boundary = await p.evaluate(async () => {
    const grid=document.createElement('div');
    grid.id='motion-ad-boundary-fixture';grid.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:0;width:100%';
    for(let i=0;i<3;i++){
      const card=document.createElement('a');card.className='item-card';card.href='#';card.textContent='Boundary article '+i;
      card.style.cssText='height:100px;margin:0;width:auto';grid.appendChild(card);
    }
    const ad=document.createElement('div');ad.className='ad-region';ad.style.cssText='grid-column:1/-1;height:250px;width:100%';grid.appendChild(ad);
    document.body.appendChild(grid);window.SiteMotionController.refresh();
    await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
    const adBounds=ad.getBoundingClientRect();
    const results=[...grid.querySelectorAll('.item-card')].map(card=>({
      outside:card.getBoundingClientRect().bottom<=adBounds.top+1,
      keyframes:card.getAnimations().flatMap(animation=>animation.effect.getKeyframes()).filter(frame=>frame.translate).map(frame=>frame.translate)
    }));
    grid.remove();window.SiteMotionController.refresh();return results;
  });
  // Browsers may serialize a zero two-axis translate as the equivalent "0px".
  assert.ok(boundary.every(card=>card.outside&&card.keyframes.length===2&&card.keyframes.every(value=>/^0px(?: 0px)?$/.test(value))),JSON.stringify(boundary));
  report.checks.push({name:'entire-grid-row-keeps-ad-boundary',boundary});
  // Pagination/search can insert cards after the original observer was created.
  const before=await p.locator('[data-sf-card]').count();
  await p.evaluate(()=>{
    const original=document.querySelector('.item-card'),card=original.cloneNode(true);
    card.removeAttribute('data-sf-card');card.classList.remove('sf-reveal','sf-reveal-visible','sf-card-interactive');
    card.querySelectorAll('.sf-card-glow,.sf-card-orb,.sf-card-arrow').forEach(e=>e.remove());
    original.parentElement.appendChild(card);
  });
  await p.waitForFunction(count=>document.querySelectorAll('[data-sf-card]').length===count+1,before);
  assert.equal(await p.locator('[data-sf-card]').last().locator('.sf-card-orb').count(),1);
  report.checks.push({name:'dynamic-card-registration'});
  for(const name of ['tech','game','health']) {
    for(const route of ['index.html',name==='game'?'all-games.html':'all-articles.html','details/article1.html','about.html','contact.html','privacy.html','terms.html']) {
      for(const width of [1366,768,390,320]) {
        await p.setViewportSize({width,height:900});await ready(p,name,route);
        const stats=await readable(p);assert.equal(stats.overflow,0,name+'/'+route+'/'+width+' overflow');
        if(route.includes('html')&&!route.includes('index')&&!route.includes('all-')&&!route.includes('details'))assert.ok(await p.locator('.sf-reveal').count()>0,'legal content animated');
        report.checks.push({name:'route-layout',site:name,route,width,...stats});
      }
    }
  }
  await ready(p,'health');await p.locator('.item-card').first().scrollIntoViewIfNeeded();
  // Health now uses the user-selected color stethoscope rather than the former
  // outline ECG. Confirm the actual image decoded on a touch viewport.
  assert.ok(await p.locator('.sf-card-orb img[data-domain-icon="health"]').count()>0);
  assert.ok(await p.locator('.sf-card-orb img').first().evaluate(image=>image.complete&&image.naturalWidth>0));
  await p.screenshot({path:resolve(output,'health-mobile.png')});
  await ready(p,'off');assert.equal(await p.locator('.sf-reveal,.sf-card-interactive,.sf-card-orb,.sf-card-arrow').count(),0);assert.equal((await readable(p)).hidden,0);
  await ready(p,'custom');assert.equal(await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--sf-glow-color').trim()),'#c355dd');
  report.checks.push({name:'all-off-and-custom-color'});
  // Failure injection happens before any application script creates animations.
  for(const [name,init] of [
    ['missing-observer',()=>{window.IntersectionObserver=undefined;}],
    ['missing-animate',()=>{Element.prototype.animate=undefined;}],
    ['partial-animation-failure',()=>{const original=Element.prototype.animate;let n=0;Element.prototype.animate=function(...args){if(++n===2)throw Error('test failure');return original.apply(this,args);};}],
    ['observer-constructor-failure',()=>{window.IntersectionObserver=function(){throw Error('test observer');};}]
  ]) {
    const failed=await page(desktop,init);await ready(failed);assert.equal((await readable(failed)).hidden,0);assert.equal(await failed.locator('.sf-reveal').count(),0);report.checks.push({name});await failed.close();
  }
  const touch=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const tp=await page(touch);await ready(tp);await tp.locator('.item-card').first().dispatchEvent('pointermove',{pointerType:'touch',clientX:100,clientY:150});
  assert.equal(await tp.locator('.item-card').first().evaluate(e=>e.style.getPropertyValue('--sf-tilt-x')),'');
  report.checks.push({name:'touch-no-pointer-tilt'});await touch.close();
  await p.setViewportSize({width:320,height:900});await ready(p);
  await p.emulateMedia({reducedMotion:'reduce'});
  await p.evaluate(()=>{document.documentElement.style.fontSize='200%';document.querySelector('.card-title').textContent='A very long article heading for narrow screen and enlarged text verification';});
  assert.equal((await readable(p)).overflow,0);report.checks.push({name:'320-long-title-enlarged-text'});
  await desktop.close();assert.deepEqual(report.errors,[]);
} finally {
  await writeFile(resolve(output,'browser-results.json'),JSON.stringify(report,null,2));
  await browser.close();server.close();
}
console.log(JSON.stringify({checks:report.checks.length,errors:report.errors}));
