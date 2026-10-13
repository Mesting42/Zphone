/** Render all approved artwork in the real workbench and in reopened ZIPs.
 * External services are blocked: icon rendering must be fully local. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
import {loadBuilder,createState} from './template-fixtures.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH||'C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output=resolve(process.env.DOMAIN_ICONS_OUTPUT||'coverage/domain-icons-implementation-20261013/browser');
await mkdir(output,{recursive:true});
const manifest=JSON.parse(await readFile('motion/icons-provenance.json','utf8'));
const sites=new Map(),report={workbench:null,domains:[],errors:[]};
const builder=loadBuilder(false,true,true);
for(const icon of manifest.icons){
  const state=createState(builder,builder.presets.find(preset=>preset.domainId===icon.id),'migration');
  state.data=state.data.slice(0,4);
  await builder.generator.exportWebsite(state,()=>{});
  const zip=new JSZip();
  for(const [path,value] of Object.entries(builder.files()))zip.file(path.replace(/^website\//,''),value);
  const bytes=await zip.generateAsync({type:'nodebuffer'});
  await writeFile(resolve(output,icon.id+'.zip'),bytes);
  // Read back the ZIP, rather than serving pre-compression in-memory values.
  const reopened=await JSZip.loadAsync(bytes),files=new Map();
  for(const entry of Object.values(reopened.files))if(!entry.dir)files.set(entry.name,await entry.async('nodebuffer'));
  assert.equal(createHash('sha256').update(files.get('assets/domain-icon.svg')).digest('hex'),icon.sha256);
  files.set('preview.html',Buffer.from(builder.generator.generatePreviewHtml(state,'home')));
  sites.set(icon.id,files);
}
const server=createServer((request,response)=>{
  const parts=decodeURIComponent(new URL(request.url,'http://localhost').pathname).slice(1).split('/');
  const domain=parts.shift(),path=parts.join('/')||'index.html',value=sites.get(domain)?.get(path);
  if(!value){response.writeHead(404);response.end();return;}
  response.writeHead(200,{'Content-Type':path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':path.endsWith('.svg')?'image/svg+xml':'text/html;charset=utf-8'});
  response.end(value);
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage();
  page.on('pageerror',error=>report.errors.push(error.message));
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    return ['127.0.0.1','localhost'].includes(url.hostname)?route.continue():route.fulfill({body:'',contentType:'application/javascript'});
  });
  await page.goto(process.env.BUILDER_URL||'http://127.0.0.1:5174/');
  await page.locator('#upload-area[data-upload-ready="true"]').waitFor();
  const realData='D:/Min/数据源/资讯/未用数据源/2026-9/9.21-9.27/冰川学与冰芯气候记录.rar';
  await page.locator('#file-input').setInputFiles(realData);
  await page.waitForFunction(()=>/已解析|导入成功/.test(document.getElementById('upload-import-progress-text')?.textContent||''),null,{timeout:180000});
  await page.locator('#btn-next').click();
  await page.locator('#step-2.active').waitFor();
  await page.waitForFunction(()=>{
    const images=[...document.querySelectorAll('#theme-grid img[data-domain-icon]')];
    return images.length===36&&images.every(image=>image.complete&&image.naturalWidth>0);
  });
  const workbench=await page.locator('#theme-grid').evaluate(grid=>[...grid.querySelectorAll('[data-theme]')].map(card=>({id:card.dataset.theme,src:card.querySelector('img').src,width:card.querySelector('img').getBoundingClientRect().width})));
  assert.deepEqual(workbench.map(icon=>icon.id),manifest.icons.map(icon=>icon.id));
  assert.ok(workbench.every(icon=>icon.src.startsWith('data:image/svg+xml')&&icon.width===32));
  assert.equal(await page.locator('#domain-icon-credits [data-domain-icon-credits]').count(),5);
  await page.locator('#theme-grid').screenshot({path:resolve(output,'workbench-36.png')});
  await page.locator('.theme-card[data-theme="anime"]').click();
  await page.locator('#btn-next').click();await page.locator('#step-3.active').waitFor();
  await page.locator('#btn-next').click();await page.locator('#step-4.active').waitFor();
  const frame=page.frameLocator('#preview-frame');
  await frame.locator('.sf-card-orb img[data-domain-icon="anime"]').first().waitFor();
  await frame.locator('.sf-card-orb img').first().evaluate(image=>image.decode());
  await page.screenshot({path:resolve(output,'anime-workbench-preview.png')});
  report.workbench={realData,icons:36,credits:5,animePreview:true};
  for(const icon of manifest.icons){
    const views=[];
    for(const path of ['index.html','preview.html','all-articles.html','details/article1.html']){
      await page.goto(base+'/'+icon.id+'/'+path);
      await page.waitForFunction(()=>!!window.SiteMotionController);
      const images=page.locator('.sf-card-orb img');
      assert.ok(await images.count()>0,icon.id+' '+path+' missing corner icons');
      await images.first().evaluate(image=>image.decode());
      const src=await images.first().getAttribute('src');
      assert.equal(src,workbench.find(item=>item.id===icon.id).src,icon.id+' '+path+' differs from workbench');
      assert.equal(await images.first().getAttribute('data-domain-icon'),icon.id);
      assert.ok(await images.first().evaluate(image=>image.complete&&image.naturalWidth>0&&getComputedStyle(image).width==='24px'));
      assert.equal(await page.locator('[data-domain-icon-credits]').count(),1,icon.id+' '+path+' attribution');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      views.push(path);
      if(path==='index.html'){
        // Dynamic pagination and text-only cards must receive one icon each;
        // ad-protected cards must never receive a decoration.
        await page.evaluate(()=>{
          const host=document.createElement('section');host.id='icon-regression-dynamic';
          host.innerHTML='<a class="item-card" href="#">Text only</a><div class="ad-container"><a class="item-card" href="#">Ad</a></div>';
          document.querySelector('main').appendChild(host);
        });
        await page.locator('#icon-regression-dynamic>.item-card.sf-card-no-image .sf-card-orb').waitFor();
        assert.equal(await page.locator('#icon-regression-dynamic .ad-container .sf-card-orb').count(),0);
        assert.equal(await page.locator('#icon-regression-dynamic>.item-card .sf-card-orb').count(),1);
      }
    }
    report.domains.push({id:icon.id,library:icon.library,views,localImage:true,originalSVGSHA256:icon.sha256});
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'/anime/index.html');
  await page.waitForFunction(()=>!!window.SiteMotionController);
  await page.locator('.sf-card-orb img').first().evaluate(image=>image.decode());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:resolve(output,'anime-mobile.png'),fullPage:true});
  assert.deepEqual(report.errors,[]);
}finally{
  await browser.close();server.close();
  await writeFile(resolve(output,'results.json'),JSON.stringify(report,null,2));
}
console.log(JSON.stringify({workbench:report.workbench,domains:report.domains.length,views:report.domains.reduce((sum,domain)=>sum+domain.views.length,0),errors:report.errors}));
