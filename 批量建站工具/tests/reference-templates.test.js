/** Validate actual preview/export behavior, with the existing advertising parser. */
import {describe,it,expect} from 'vitest';
import {parseHTML} from 'linkedom';
import {loadBuilder,createState} from './template-fixtures.mjs';
import {validateManifest,createTemplateRegistry} from '../template-system/registry.js';
import {findTemplateOwner} from '../template-system/availability.js';
const ids=['field-notes','pixelwire-editorial','stone-crumb','evwired-studio','daily-skillet','vitalpulse-journal','deep-life-atlas','print-field'];
const adNodes=html=>[...parseHTML(html).document.querySelectorAll('#adv1,#adv2,#adv3')].map(e=>e.outerHTML);
describe('complete reference templates',()=>{
 it('keeps operator typography, border, spacing and image adjustments effective',()=>{
  const b=loadBuilder(false,true),s=createState(b,{...b.presets.find(p=>p.id==='field-notes'),domainId:'tech'});
  Object.assign(s.config,{fontStyle:'monospace',cardRadius:'0',cardBorder:'none',cardSpacing:'40px',cardImageHeight:'300px'});
  const html=b.generator.generatePreviewHtml(s,'home');
  expect(html).toMatch(/--ref-body:[^;]*Courier/);expect(html).toContain('border:0!important;box-shadow:none!important');
  expect(html).toContain('padding:var(--card-spacing)!important');expect(html).toContain('height:var(--card-image-height)!important');
  expect(html).toContain('border-radius:var(--card-radius)!important');
 });
 it('keeps batch uniqueness within a field while allowing shared packages across fields',()=>{
  const tech={themeId:'tech',config:{templateId:'field-notes'}},health={themeId:'health',config:{templateId:'field-notes'}};
  expect(findTemplateOwner([tech], 'field-notes', health, 'health')).toBeNull();
  expect(findTemplateOwner([tech,health], 'field-notes', {themeId:'tech'}, 'tech')).toBe(tech);
  expect(findTemplateOwner([tech], 'field-notes', tech, 'tech')).toBeNull();
 });
 it('treats replacement-string symbols as literal branding in the new footer',()=>{
  const b=loadBuilder(false,true),s=createState(b,{...b.presets.find(p=>p.id==='field-notes'),domainId:'tech'});
  s.config.logoText='A $& journal';const doc=parseHTML(b.generator.generatePreviewHtml(s,'home')).document;
  expect(doc.querySelectorAll('footer')).toHaveLength(1);expect(doc.querySelector('.ref-footer-masthead').textContent).toBe('A $& journal');
 });
 it('offers exactly eight global templates and palettes after every existing domain list',()=>{
  const b=loadBuilder(false,true),old=loadBuilder();
  expect(b.presets.filter(p=>p.domainId==='*').map(p=>p.id).sort()).toEqual([...ids].sort());
  for(const id of Object.keys(b.domains)) {
   expect(b.domains[id].blueprints.slice(0,30)).toEqual(old.domains[id].blueprints);
   for(const template of ids)expect(b.domains[id].blueprints).toContain(template);
  }
  expect(b.TemplateRegistry.list().filter(m=>m.schemaVersion===2)).toHaveLength(8);
 });
 it.each(ids.flatMap(id=>['code','manual','fixed','migration'].map(mode=>[id,mode])))('%s keeps ad configuration/runtime/slots in %s export',async(id,mode)=>{
  const b=loadBuilder(false,true,true),preset={...b.presets.find(p=>p.id===id),domainId:'tech'};
  const s=createState(b,preset,mode),base=createState(b,b.presets.find(p=>p.domainId==='tech'),mode);
  await b.generator.exportWebsite(base,()=>{});const original={...b.files()};
  await b.generator.exportWebsite(s,()=>{});const files=b.files();
  expect(files['website/js/ad.js']).toBe(original['website/js/ad.js']);
  expect(b.generator.buildConfig(s).adPlacements).toEqual(b.generator.buildConfig(base).adPlacements);
  for(const path of ['index.html','all-articles.html','details/article1.html']){
   const html=files['website/'+path];
   expect(adNodes(html)).toEqual(adNodes(original['website/'+path]));
   expect(html).toContain('data-template-package="'+id+'"');
   const doc=parseHTML(html).document;
   expect(doc.querySelector('.ref-brand')).toBeTruthy();expect(doc.querySelector('.ref-footer-masthead')).toBeTruthy();
   expect(doc.querySelector('.hamburger').getAttribute('aria-controls')).toBe('site-navigation');
   if(path.startsWith('details/')){expect(doc.querySelector('.ref-article-lead').firstElementChild.tagName).toBe('H1');expect(doc.querySelector('.footer a').getAttribute('href')).toMatch(/^\.\.\//);}
  }
  for(const page of ['home','detail','all','about','contact','privacy','terms'])expect(b.generator.generatePreviewHtml(s,page,0)).toContain('data-template-package="'+id+'"');
  expect(files['website/css/style.css']).toContain('body[data-template-package="'+id+'"]');
 });
 it('supports every domain and operator-selected columns/theme without importing reference branding',()=>{
  const b=loadBuilder(false,true);
  for(const domainId of Object.keys(b.domains)) {
   const p={...b.presets.find(p=>p.id==='deep-life-atlas'),domainId};
   const s=createState(b,p);s.config.cardColumns='1';s.config.selectedStyle='minimal';s.config.siteTitle='Imported publication';s.config.logoText='Imported brand';
   const html=b.generator.generatePreviewHtml(s,'home');
   expect(html).toContain('Imported brand');expect(html).not.toContain('The Deep Life Atlas');
   expect(html).toContain('--ref-columns:1;--ref-lead-span:1');
  }
 });
 it('rejects incomplete v2 modules and unscoped/protected CSS',()=>{
  const b=loadBuilder(false,true),m=b.TemplateRegistry.list().find(m=>m.id==='field-notes');
  expect(()=>validateManifest({...m,palette:{...m.palette,primary:'url(secret)'}})).toThrow();
  const pages={home:{rules:[]},detail:{rules:[]},all:{rules:[]}};
  expect(()=>createTemplateRegistry().register({manifest:m,pages})).toThrow(/modules/);
  for(const css of ['.navbar{color:red}',':scope #adv1{display:none}',':scope .card-title{background:url(https://example.com)}']){
   expect(()=>createTemplateRegistry().register({manifest:m,pages,presentation:{shell:{css},navigation:{},footer:{}}})).toThrow();
  }
 });
});
