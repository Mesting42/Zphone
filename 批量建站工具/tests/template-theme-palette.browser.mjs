/** Render every shipped palette on arbitrary uploaded-style markup. Checks
 * computed contrast, dynamic content, fonts, geometry, icons and ad exclusion.
 * Run against a built preview with BUILDER_URL / PLAYWRIGHT_MODULE_PATH. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || 'C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=resolve('coverage/template-theme-palette-fixtures');await mkdir(root,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage(),fixturePage=await browser.newPage();
const report={fixtures:[],errors:[]};fixturePage.on('pageerror',e=>report.errors.push(e.message));
const selectors=['#nav-link','#badge','#title','#summary','#link','#input','#unknown'];
const fixture = `<!doctype html><html><head><style>
body{background:#0b0b0f;color:#e5e7eb;font:16px Georgia;margin:8px}nav{background:#131326;padding:12px}
.pg-card,.xyz-unknown{background:#17171f;padding:20px;border:1px solid #303040;border-radius:12px;margin:12px 0}h3{font:700 20px Georgia}a{color:inherit}.summary{opacity:.85}
.pg-badge{display:inline-block;background:#34d399;color:white;padding:4px}.photo{padding:20px;background:linear-gradient(white,#eee);color:#111}.photo h3{color:#111}
.icon{display:inline-block;width:20px}input{background:#17171f;color:#fff;border:1px solid #444}
</style></head><body><nav><a id="nav-link">Navigation</a></nav><article class="pg-card"><span class="icon">⚔️</span><span class="pg-badge" id="badge">Category</span><h3 id="title" style="color:#eee!important">Title</h3><p class="summary" id="summary">Summary text</p><a id="link">Read more</a><input id="input" value="Text"></article><div class="xyz-unknown"><h3 id="unknown">Inline unknown class</h3></div><div class="photo"><h3 id="overlay">Light image overlay</h3></div><div id="adv2" style="color:white;background:#222"><span>AD unchanged</span></div><div id="dynamic"></div></body></html>`;

// Read rendered pairs, not CSS variable values. This also accounts for alpha
// colors and the representative summary's inherited opacity.
function sample(selectors) {
 const rgba = value => { const n = value.match(/[\d.]+/g).map(Number);return n.length===3?[...n,1]:n; };
 const blend=(f,b)=>[0,1,2].map(i=>f[i]*f[3]+b[i]*(1-f[3])).concat(1);
 const lum=c=>c.slice(0,3).reduce((s,v,i)=>{v/=255;return s+(v<=.04045?v/12.92:((v+.055)/1.055)**2.4)*[.2126,.7152,.0722][i]},0);
 return selectors.map(selector=>{
  const n=document.querySelector(selector);if(!n)throw new Error('Missing '+selector);
  const s=getComputedStyle(n),r=n.getBoundingClientRect();let chain=[],p=n,bg=[255,255,255,1],opacity=1;
  while(p){chain.unshift(p);p=p.parentElement;}for(const a of chain){const cs=getComputedStyle(a);bg=blend(rgba(cs.backgroundColor),bg);opacity*=Number(cs.opacity);}
  let fg=rgba(s.color);fg[3]*=opacity;fg=blend(fg,bg);const a=lum(fg),b=lum(bg);
  return {selector,color:s.color,background:s.backgroundColor,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),font:s.fontFamily,fontSize:s.fontSize,rect:[r.x,r.y,r.width,r.height]};
 });
}

try {
 await page.goto(process.env.BUILDER_URL || 'http://127.0.0.1:5191/');
 await page.locator('[data-build-mode="ad-template-reuse"]').waitFor();
 const palettes=await page.evaluate(()=>STYLE_PRESETS);
 for(const width of [1280,390]){
  await fixturePage.setViewportSize({width,height:1000});await fixturePage.setContent(fixture);const baseline=await fixturePage.evaluate(sample,selectors);
  const originalProtected=await fixturePage.evaluate(()=>({ad:document.querySelector('#adv2').outerHTML,icon:document.querySelector('.icon').outerHTML,overlay:getComputedStyle(document.querySelector('#overlay')).color}));
  for(const palette of palettes){
   const html=await page.evaluate(async({fixture,palette})=>{const {applyThemePalette}=await import('/js/template-theme-palette.js');return new TextDecoder().decode(applyThemePalette([{path:'index.html',text:fixture}],palette).entries[0].bytes);},{fixture,palette});
   await fixturePage.setContent(html);await fixturePage.locator('html[data-sitefoundry-palette-ready]').waitFor();const samples=await fixturePage.evaluate(sample,selectors);
   for(let i=0;i<samples.length;i++){assert.ok(samples[i].contrast>=4.5-0.01,JSON.stringify({palette:palette.id,width,...samples[i]}));assert.deepEqual(samples[i].rect,baseline[i].rect);assert.equal(samples[i].font,baseline[i].font);assert.equal(samples[i].fontSize,baseline[i].fontSize);}
   assert.deepEqual(await fixturePage.evaluate(()=>({ad:document.querySelector('#adv2').outerHTML,icon:document.querySelector('.icon').outerHTML,overlay:getComputedStyle(document.querySelector('#overlay')).color})),originalProtected);
   await fixturePage.evaluate(()=>{document.querySelector('#dynamic').innerHTML='<div class="pg-card"><h3 id="late">Dynamically rendered</h3><p>Late summary</p></div>';});
   await fixturePage.waitForFunction(()=>document.querySelector('#late')?.style.getPropertyPriority('color')==='important');
   const [late]=await fixturePage.evaluate(sample,['#late']);assert.ok(late.contrast>=4.49,JSON.stringify({palette:palette.id,width,late}));
   report.fixtures.push({palette:palette.id,width,minimumContrast:Math.min(...samples.map(s=>s.contrast),late.contrast),geometryAndFonts:true,adAndIconUnchanged:true,photoInkUnchanged:true,dynamic:true});
  }
 }

 assert.deepEqual(report.errors,[]);report.passed=true;
 console.log(JSON.stringify({passed:true,checks:report.fixtures.length}));
} catch(error) {report.failure=error.stack;throw error;}
finally {await writeFile(join(root,'results.json'),JSON.stringify(report,null,2));await browser.close();}
