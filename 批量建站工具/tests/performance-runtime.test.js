import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import JSZip from 'jszip';
import {mapWithConcurrency} from '../js/async-work.js';

const source=name=>readFileSync(new URL('../js/'+name,import.meta.url),'utf8');
// JSZip and the helper share the browser realm in production. Expose those same
// constructors to the VM while supplying separate foreign input views below.
function archiveRuntime(){const context={Uint8Array,ArrayBuffer};vm.runInNewContext(source('archive-export.js'),context);return context.ArchiveExport;}
function imageRuntime(){
 const created=[],revoked=[],timers=new Map(),events={};let next=0;
 const context={URL:{createObjectURL(blob){if(!blob)throw Error('invalid blob');const url='blob:fixture-'+created.length;created.push({blob,url});return url;},revokeObjectURL:url=>revoked.push(url)},setTimeout(fn,ms){const id=++next;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),addEventListener:(name,fn)=>{events[name]=fn}};
 vm.runInNewContext(source('preview-image-cache.js'),context);
 return {cache:context.PreviewImageCache,created,revoked,timers,events,flush(){for(const [id,timer] of timers){timers.delete(id);timer.fn();}}};
}

describe('bounded import scheduling',()=>{
 it('limits in-flight work and preserves input order when completion is reversed',async()=>{
  let active=0,peak=0;const results=await mapWithConcurrency([0,1,2,3,4],2,async value=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5-value));active--;return value*2;});
  expect(peak).toBe(2);expect(results).toEqual([0,2,4,6,8]);
 });
 it('drains active operations and starts no queued work after an error',async()=>{
  let release;const pending=new Promise(r=>{release=r}),started=[];let drained=false;
  const operation=mapWithConcurrency([0,1,2,3],2,async value=>{started.push(value);if(value===0)throw Error('bad archive');await pending;drained=true;});
  const caught=operation.catch(error=>error);await Promise.resolve();expect(drained).toBe(false);release();expect((await caught).message).toBe('bad archive');expect(drained).toBe(true);expect(started).toEqual([0,1]);
 });
 it('preserves falsy rejection reasons',async()=>{let completed=false;await mapWithConcurrency([1],2,()=>{throw null;}).then(()=>{completed=true},error=>expect(error).toBeNull());expect(completed).toBe(false);});
 it('accepts an empty list',async()=>expect(await mapWithConcurrency([],2,()=>{throw Error('not called')})).toEqual([]));
 it.each([0,-3,Infinity,NaN])('uses one worker for invalid limit %s',async limit=>{let active=0,peak=0;await mapWithConcurrency([1,2],limit,async()=>{active++;peak=Math.max(peak,active);await Promise.resolve();active--;});expect(peak).toBe(1);});
});

describe('ZIP packaging without content changes',()=>{
 it.each(['jpg','JPEG','png','webp','avif','gif','woff2','zip','rar','7z','mp4'])('stores already compressed %s files and retains byte identity',async extension=>{
  const tool=archiveRuntime(),bytes=new Uint8Array([0,255,2,13,10,128]),zip=new JSZip();zip.file('nested/真实图片.'+extension,bytes);zip.file('nested/js/ad.js','const path="/publisher/banner1";'.repeat(8));
  const packed=await tool.generate(zip,{type:'uint8array',compression:'DEFLATE',compressionOptions:{level:6}});const reopened=await JSZip.loadAsync(packed);
  expect(Array.from(await reopened.file('nested/真实图片.'+extension).async('uint8array'))).toEqual(Array.from(bytes));
  expect(reopened.file('nested/真实图片.'+extension)._data.compression.magic).toBe('\x00\x00');expect(reopened.file('nested/js/ad.js')._data.compression.magic).toBe('\x08\x00');
 });
 it('preserves explicit per-file compression',async()=>{const tool=archiveRuntime(),zip=new JSZip();zip.file('cover.png','repeated'.repeat(100),{compression:'DEFLATE'});const result=await JSZip.loadAsync(await tool.generate(zip,{type:'uint8array',compression:'DEFLATE'}));expect(result.file('cover.png')._data.compression.magic).toBe('\x08\x00');});
 it('uses the existing progress callback and output type',async()=>{let progress=0;const zip=new JSZip();zip.file('a.txt','content');const result=await archiveRuntime().generate(zip,{type:'arraybuffer',compression:'DEFLATE'},m=>{progress=m.percent});expect(result).toBeInstanceOf(ArrayBuffer);expect(progress).toBe(100);});
 it('keeps cross-realm byte views intact without expanding to number arrays',()=>{const foreign=vm.runInNewContext('new Uint8Array([9,0,255,7]).subarray(1,3)'),result=archiveRuntime().bytes(foreign);expect(Array.isArray(result)).toBe(false);expect(Array.from(result)).toEqual([0,255]);expect(result.buffer).toBe(foreign.buffer);expect(Array.from(foreign)).toEqual([0,255]);});
 it('accepts arrays, ArrayBuffers and absent byte content',()=>{const tool=archiveRuntime();expect(Array.from(tool.bytes([1,255]))).toEqual([1,255]);expect(Array.from(tool.bytes(new Uint8Array([7,8]).buffer))).toEqual([7,8]);expect(tool.bytes(null).byteLength).toBe(0);});
 it('can encode the same shared image bytes repeatedly',async()=>{const tool=archiveRuntime(),bytes=new Uint8Array([4,5,6]);for(let i=0;i<2;i++){const zip=new JSZip();zip.file('a.webp',tool.bytes(bytes));const reopened=await JSZip.loadAsync(await tool.generate(zip,{type:'uint8array',compression:'DEFLATE'}));expect(Array.from(await reopened.file('a.webp').async('uint8array'))).toEqual([4,5,6]);}expect(bytes.byteLength).toBe(3);});
});

describe('preview image URL lifetime',()=>{
 it('reuses identical Blobs across preview updates and copied path maps',()=>{const t=imageRuntime(),blob={};const first=t.cache.acquire({'a/1.webp':blob});const second=t.cache.acquire({'a/1.webp':blob});expect(second.byFilename).toEqual(first.byFilename);expect(t.created).toHaveLength(1);expect(t.revoked).toEqual([]);});
 it('shares one Blob URL for aliases',()=>{const t=imageRuntime(),blob={},result=t.cache.acquire({'a.webp':blob,'b.webp':blob});expect(result.byFilename['a.webp']).toBe(result.byFilename['b.webp']);expect(result.urls).toHaveLength(1);});
 it('keeps existing last-path precedence for duplicate basenames',()=>{const t=imageRuntime(),result=t.cache.acquire({'a/cover.webp':{},'b/cover.webp':{}});expect(result.byFilename['cover.webp']).toBe('blob:fixture-1');});
 it('retires only replaced blobs after the iframe refresh window',()=>{const t=imageRuntime(),a={},b={};t.cache.acquire({'a.webp':a,'b.webp':b});const next=t.cache.acquire({'a.webp':a,'b.webp':{}});expect(t.created).toHaveLength(3);expect(t.revoked).toEqual([]);expect([...t.timers.values()][0].ms).toBe(1500);t.flush();expect(t.revoked).toEqual(['blob:fixture-1']);expect(next.urls).toContain('blob:fixture-0');});
 it('retires local images when the next data source uses remote images',()=>{const t=imageRuntime();t.cache.acquire({'a.webp':{}});expect(t.cache.acquire({}).urls).toEqual([]);t.flush();expect(t.revoked).toHaveLength(1);});
 it('clears active and retired URLs and cancels retirement timers',()=>{const t=imageRuntime();t.cache.acquire({'a.webp':{}});t.cache.acquire({'b.webp':{}});t.cache.clear();expect(t.revoked.sort()).toEqual(['blob:fixture-0','blob:fixture-1']);expect(t.timers.size).toBe(0);t.flush();expect(t.revoked).toHaveLength(2);});
 it('does not leak newly created URLs if a render input is invalid',()=>{const t=imageRuntime(),old={};t.cache.acquire({'old.webp':old});expect(()=>t.cache.acquire({'good.webp':{},'bad.webp':null})).toThrow('invalid blob');expect(t.revoked).toEqual(['blob:fixture-1']);expect(t.cache.acquire({'old.webp':old}).urls).toEqual(['blob:fixture-0']);});
 it('preserves URLs for a persisted page and releases them on a normal pagehide',()=>{const t=imageRuntime();t.cache.acquire({'a.webp':{}});t.events.pagehide({persisted:true});expect(t.revoked).toEqual([]);t.events.pagehide({persisted:false});expect(t.revoked).toHaveLength(1);});
});
