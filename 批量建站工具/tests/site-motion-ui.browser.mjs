/** Actual controls -> template switch -> ZIP download, on both workbenches. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import JSZip from 'jszip';
import {loadBuilder,createState} from './template-fixtures.mjs';
import {expandPicker} from './workbench-browser-helpers.mjs';
const {chromium}=createRequire(import.meta.url)('C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output=resolve('coverage/site-motion-20261012/ui');await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});const checks=[];
// A new iframe Window proves the control refreshed the document; inspecting an
// old frame before the debounce finishes would report a false pass.
async function waitPreviewChange(page,action) {
  const frame=await (await page.locator('#preview-frame').elementHandle()).contentFrame();
  const marker='motion-'+Date.now();
  await frame.evaluate(value=>{window.__motionUITest=value;},marker);
  await action();
  await frame.waitForFunction(value=>document.body&&window.__motionUITest!==value&&window.SiteMotionController,marker,{timeout:60000});
  await page.waitForFunction(()=>!document.getElementById('preview-frame').hasAttribute('data-refreshing'));
}
async function selectUI(page,id,value) {
  const select=page.locator('#'+id);
  if(await select.isVisible()) {await select.selectOption(value);return;}
  // The game workbench exposes an accessible custom menu over its native select.
  const label=await select.evaluate(e=>e.labels[0].textContent.trim());
  const text=await select.locator('option[value="'+value+'"]').textContent();
  await page.getByRole('button',{name:label,exact:true}).click();
  await page.getByRole('option',{name:text.trim(),exact:true}).click();
}
try {
  for(const game of [false,true]) {
    const p=await browser.newPage({viewport:{width:1500,height:1000},acceptDownloads:true});
    const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.route(/https?:\/\/[^/]*(?:googletagservices|googlesyndication|doubleclick|googletagmanager|google-analytics)\.[^/]+\//i,r=>r.fulfill({body:'',contentType:'application/javascript'}));
    await p.goto('http://127.0.0.1:5174/'+(game?'game-builder/index.html':''));
    const builder=loadBuilder(game,!game),state=createState(builder);
    if(!game) {
      await p.locator('#upload-area[data-upload-ready="true"]').waitFor();
      await p.locator('#file-input').setInputFiles({name:'technology.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(state.data))});
      await p.waitForFunction(()=>Number(document.getElementById('data-count')?.textContent)===20,null,{timeout:30000});
      await p.locator('#btn-next').click();await p.locator('#step-2.active').waitFor();
      await p.locator('.theme-card[data-theme="tech"]').click();
      await p.locator('#btn-next').click();await p.locator('#step-3.active').waitFor();
      await p.locator('#btn-next').click();await p.locator('#step-4.active').waitFor();
    }
    const frame=p.frameLocator('#preview-frame');await frame.locator('[data-sf-card]').first().waitFor();
    // Game catalog initialization can restore the default structure tab. Wait for
    // its first decorated preview before selecting the style panel.
    await p.locator('.config-tab[data-tab="style"]').click();
    await expandPicker(p,game?'layout-template-grid':'template-grid');
    assert.equal(await p.locator('#viewport-reveal-enabled').inputValue(),'on');assert.equal(await p.locator('#card-interaction-enabled').inputValue(),'on');
    assert.equal(await p.locator('#animation-enter').isVisible(),false);assert.equal(await p.locator('#card-hover').isVisible(),false);
    for(const color of ['green','cyan','blue','purple','pink','orange','gold','theme']) {
      await waitPreviewChange(p,()=>selectUI(p,'card-glow-color',color));
      const chosen=await frame.locator('[data-site-motion-settings]').evaluate(e=>JSON.parse(e.textContent).color);
      assert.ok(color==='theme'?chosen.startsWith('var('):chosen.startsWith('#'));
    }
    await waitPreviewChange(p,()=>selectUI(p,'card-glow-color','custom'));
    await p.locator('#card-glow-hex').fill('#6543ab');
    await waitPreviewChange(p,()=>p.locator('#card-glow-hex').dispatchEvent('change'));
    assert.equal(await p.locator('#card-glow-custom').inputValue(),'#6543ab');
    for(const id of ['viewport-reveal-enabled','card-interaction-enabled','card-domain-icon-enabled','card-arrow-enabled'])await waitPreviewChange(p,()=>selectUI(p,id,'off'));
    const templates=p.locator(game?'.layout-template-card':'#template-grid .template-card');
    await waitPreviewChange(p,()=>templates.nth(3).click());
    assert.equal(await p.locator('#viewport-reveal-enabled').inputValue(),'off');assert.equal(await p.locator('#card-glow-hex').inputValue(),'#6543ab');
    assert.equal(await frame.locator('.sf-reveal,.sf-card-interactive,.sf-card-orb,.sf-card-arrow').count(),0);
    await waitPreviewChange(p,()=>p.locator('#random-assemble-btn').click());
    assert.equal(await p.locator('#viewport-reveal-enabled').inputValue(),'off');
    assert.equal(await p.locator('#card-interaction-enabled').inputValue(),'off');
    assert.equal(await p.locator('#card-glow-hex').inputValue(),'#6543ab');
    for(const id of ['viewport-reveal-enabled','card-interaction-enabled','card-domain-icon-enabled','card-arrow-enabled'])await waitPreviewChange(p,()=>selectUI(p,id,'on'));
    await frame.locator('.sf-card-orb').first().waitFor();
    await p.waitForTimeout(1200);
    await p.locator('#viewport-reveal-enabled').scrollIntoViewIfNeeded();
    await p.screenshot({path:resolve(output,game?'game-controls.png':'editorial-controls.png')});
    await p.locator('#btn-next').click();
    const [download]=await Promise.all([p.waitForEvent('download',{timeout:120000}),p.locator('#btn-export').click()]);
    const path=resolve(output,game?'game-controls.zip':'editorial-controls.zip');await download.saveAs(path);
    const zip=await JSZip.loadAsync(await readFile(path));const homePath=Object.keys(zip.files).find(path=>/(^|\/)index.html$/.test(path));const home=await zip.file(homePath).async('string');
    assert.ok(home.includes('"color":"#6543ab"'));assert.ok(home.includes('site-motion-runtime.js'));
    assert.deepEqual(errors,[]);checks.push({game,colors:9,templatePreservesSettings:true,download:download.suggestedFilename(),errors});await p.close();
  }
} finally {await browser.close();await writeFile(resolve(output,'results.json'),JSON.stringify(checks,null,2));}
console.log(JSON.stringify(checks));
