import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

/** Only an explicitly pinned 2.0.5 cache substitutes for CDN transport. A fresh
 * checkout can use the normal product URL, or supply FILESAVER_CACHE itself. */
export async function interceptAdsOnly(page){
 const cache=process.env.FILESAVER_CACHE || 'coverage/site-motion-20261012/full-regression/FileSaver-2.0.5.min.js';
 const body=await readFile(resolve(cache),'utf8').catch(()=>null);
 if(body)await page.route('https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js',r=>r.fulfill({body,contentType:'application/javascript'}));
 await page.route(/https?:\/\/[^/]*(?:googletagservices|googlesyndication|doubleclick|googletagmanager|google-analytics)\.[^/]+\//i,r=>r.fulfill({body:'',contentType:'application/javascript'}));
}

/** Wait for a new iframe Window rather than inspecting a previous preview. */
export async function waitPreviewChange(page,action,selector=''){
 const marker='qa-'+Date.now()+'-'+Math.random();let frame;
 for(let attempt=0;attempt<10;attempt++){
  frame=await(await page.locator('#preview-frame').elementHandle()).contentFrame();
  try{await frame.evaluate(m=>{window.__regressionDocumentMarker=m;},marker);break;}
  catch(e){if(attempt===9||!/context was destroyed|frame was detached/i.test(e.message))throw e;await page.waitForTimeout(50);}
 }
 await action();await frame.waitForFunction(({marker,selector})=>document.body&&document.readyState!=='loading'&&window.__regressionDocumentMarker!==marker&&(!selector||document.querySelector(selector)),{marker,selector},{timeout:60000});
 await page.waitForFunction(()=>!document.getElementById('preview-frame').hasAttribute('data-refreshing'));
}

/** Tests select cards through the same disclosure button as the operator. */
export async function expandPicker(page,id){
 const button=page.locator('[aria-controls="'+id+'-panel"]');
 if(await button.count() && await button.getAttribute('aria-expanded')==='false')await button.click();
}
