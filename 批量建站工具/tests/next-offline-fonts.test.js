import {describe,it,expect} from 'vitest';
import {localizeNextFonts} from '../js/next-offline-fonts.js';
const encoder=new TextEncoder(),decoder=new TextDecoder();
const css=[400,600,700].map(weight=>`@font-face {font-style: normal; font-weight: ${weight}; src: url(latin.woff2); unicode-range: U+0000-00FF;}`).join('\n')+'\n@font-face {font-style: normal; font-weight: 400; src: url(cyrillic.woff2); unicode-range: U+0400-045F;}';
const assets=name=>({family:name,css,license:'inter/LICENSE.txt',files:[{path:'inter/font.css',bytes:encoder.encode(css)},{path:'inter/latin.woff2',bytes:new Uint8Array([1,2,3])},{path:'inter/cyrillic.woff2',bytes:new Uint8Array([4,5])},{path:'inter/LICENSE.txt',bytes:encoder.encode('OFL license')}]});
const fixture=source=>new Map([['app/nested/layout.tsx',{path:'app/nested/layout.tsx',bytes:encoder.encode(source)}],['package.json',{path:'package.json',bytes:encoder.encode('{"name":"original"}')}]]);
const source='import {Inter as BodyFont} from "next/font/google";\nconst inter = BodyFont({subsets:["latin"],variable:"--font-inter",display:"swap"});\nexport default function Layout(){return <body className={inter.variable}>Original</body>;}';
describe('Next offline font export adapter',()=>{
 it('converts aliases with correct relative paths while retaining CSS variables and JSX',async()=>{
  const files=fixture(source),original=files.get('package.json').bytes;
  const manifest=await localizeNextFonts(files,async name=>assets(name));
  const transformed=decoder.decode(files.get('app/nested/layout.tsx').bytes);
  expect(transformed).toContain('from "next/font/local"');expect(transformed).not.toContain('next/font/google');
  expect(transformed).toContain('../../.sitefoundry-fonts/inter/latin.woff2');
  expect(transformed).toContain('variable:"--font-inter"');expect(transformed).toContain('display:"swap"');
  expect(transformed).toContain('<body className={inter.variable}>Original</body>');
  expect(transformed).toContain('weight: "400 700"');expect(transformed).not.toContain('cyrillic.woff2');
  expect(transformed).toContain('path: "');expect(transformed).not.toContain('"path":');
  expect(files.get('package.json').bytes).toBe(original);
  expect(decoder.decode(files.get('.sitefoundry-fonts/inter/LICENSE.txt').bytes)).toBe('OFL license');
  expect(decoder.decode(files.get('public/sitefoundry-fonts/inter/LICENSE.txt').bytes)).toBe('OFL license');
  expect(manifest[0].family).toBe('Inter');
 });
 it('is unchanged on re-export and does not duplicate bundled resources',async()=>{
  const files=fixture(source);await localizeNextFonts(files,async name=>assets(name));const size=files.size;
  expect(await localizeNextFonts(files,async()=>{throw Error('should not load');})).toEqual([]);expect(files.size).toBe(size);
 });
 it.each([
  ['subsets:["cyrillic"]','仅支持 latin'],
  ['subsets:chooseSubsets()','静态字体选项'],
  ['...options','动态字体选项'],
  ['axes:["slnt"]','不支持的字体选项'],
  ['weight:"900"','未覆盖请求'],
  ['style:"italic"','未覆盖请求']
 ])('rejects unsupported %s without rewriting the export',async(options,message)=>{
  const files=fixture('import {Inter} from "next/font/google"; const font=Inter({'+options+'});');
  const before=files.get('app/nested/layout.tsx').bytes;
  await expect(localizeNextFonts(files,async name=>assets(name))).rejects.toThrow(message);
  expect(files.get('app/nested/layout.tsx').bytes).toBe(before);expect(files.size).toBe(2);
 });
 it('rejects unknown families and user directory collisions',async()=>{
  await expect(localizeNextFonts(fixture(source),async()=>{throw Error('本地字体库尚未包含');})).rejects.toThrow('本地字体库');
  const files=fixture(source);files.set('.sitefoundry-fonts/user.txt',{path:'.sitefoundry-fonts/user.txt',bytes:encoder.encode('user')});
  await expect(localizeNextFonts(files,async name=>assets(name))).rejects.toThrow('源码已有');
  expect(decoder.decode(files.get('.sitefoundry-fonts/user.txt').bytes)).toBe('user');
 });
});
