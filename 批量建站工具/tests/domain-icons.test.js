import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {loadBuilder,createState} from './template-fixtures.mjs';

const context={};
vm.runInNewContext(readFileSync(new URL('../js/site-motion.js',import.meta.url),'utf8'),context);
const {DomainIcons:icons,SiteMotion:motion}=context;
const manifest=JSON.parse(readFileSync(new URL('../motion/icons-provenance.json',import.meta.url),'utf8'));
const expected={tech:'OpenMoji',game:'Twemoji',food:'Noto Emoji',anime:'DiceBear Adventurer',finance:'Twemoji',health:'Noto Emoji',travel:'Noto Emoji',sports:'Noto Emoji',automotive:'Noto Emoji',education:'Noto Emoji',fashion:'Noto Emoji',home:'Noto Emoji',general:'Noto Emoji',entertainment:'Noto Emoji',film:'OpenMoji',music:'IconPark',books:'Noto Emoji',science:'OpenMoji',environment:'Noto Emoji',politics:'IconPark',legal:'IconPark',realestate:'Noto Emoji',career:'Noto Emoji',marketing:'Noto Emoji',ecommerce:'Noto Emoji',pets:'IconPark',parenting:'Noto Emoji',outdoors:'Noto Emoji',photography:'Noto Emoji',history:'Noto Emoji',agriculture:'Noto Emoji',energy:'OpenMoji',naturalhistory:'Noto Emoji',marinescience:'Noto Emoji',earthscience:'Noto Emoji',culturalheritage:'Noto Emoji'};

describe('Approved domain artwork',()=>{
  it('matches all 36 user selections and keeps the exact pink-pigtails avatar',()=>{
    expect(Object.fromEntries(manifest.icons.map(icon=>[icon.id,icon.library]))).toEqual(expected);
    expect(icons.get('anime').record.sha256).toBe('7b13ed18b5dc9fd0afb4536c3fa8bbe147b528628127309db5cf6c183056ec85');
    expect(icons.get('anime').record.options.hair).toEqual(['long14']);
  });
  it.each(manifest.icons)('$id preserves pinned SVG bytes and caches an isolated local image',record=>{
    const icon=icons.get(record.id);
    const original=readFileSync(new URL('../motion/'+record.file,import.meta.url));
    expect(createHash('sha256').update(original).digest('hex')).toBe(record.sha256);
    expect(icon.svg).toBe(original.toString());
    expect(icons.get(record.id)).toBe(icon);
    expect(icon.src).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    const imageSVG=decodeURIComponent(icon.src.slice(icon.src.indexOf(',')+1));
    expect(imageSVG).toMatch(/^<svg\b/);
    expect(imageSVG).not.toMatch(/<!DOCTYPE|<!ENTITY|&ns_\w+;/);
    expect(icons.imageHTML(record.id)).toContain('data-domain-icon="'+record.id+'"');
    expect(motion.runtimeFor(record.id)).toContain(JSON.stringify(icon.src));
    expect(motion.runtimeFor(record.id)).not.toContain(JSON.stringify(icons.get(record.id==='anime'?'tech':'anime').src));
    expect(()=>new vm.Script(motion.runtimeFor(record.id))).not.toThrow();
  });
  it('handles old/unknown domains and off settings without extra artwork',()=>{
    expect(icons.get('__proto__')).toBe(icons.get('general'));
    expect(icons.get('missing')).toBe(icons.get('general'));
    expect(motion.runtimeFor('anime',false)).not.toContain('data:image/svg');
    const config={style:{siteMotion:{...motion.normalize({config:{}}),icon:false}}};
    expect(motion.documentHTML('<html><head></head><body><footer>Legal</footer></body></html>',config,true)).not.toContain('data-domain-icon-credits');
  });
  it('adds preview attribution even when navigation code mentions the same attribute',()=>{
    const config={style:{siteMotion:motion.normalize({config:{}})}};
    const html='<html><head></head><body><footer>Legal</footer><script>var selector="[data-domain-icon-credits]";</script></body></html>';
    expect(motion.documentHTML(html,config,true)).toContain('<span data-domain-icon-credits>');
  });
  it.each(['normal','batch-ad-build','ad-migration'])('exports all 36 selected assets and matching preview runtimes for %s',async mode=>{
    const builder=loadBuilder(false,false,true);
    for(const record of manifest.icons){
      const preset=builder.presets.find(preset=>preset.domainId===record.id);
      const state=createState(builder,preset,mode==='ad-migration'?'migration':'code');
      state.siteBuildMode=mode;
      state.data=state.data.slice(0,2);
      const config=builder.generator.buildConfig(state);
      await builder.generator.exportWebsite(state,()=>{});
      const files=builder.files();
      const runtime=files['website/js/site-motion-runtime.js'];
      expect(runtime,record.id).toBe(motion.runtimeFor(record.id));
      expect(files['website/assets/domain-icon.svg'],record.id).toBe(icons.get(record.id).svg);
      const exportedRecord=JSON.parse(files['website/ICONS-PROVENANCE.json']).icon;
      expect(exportedRecord.sha256).toBe(record.sha256);
      expect(files['website/'+exportedRecord.file]).toBe(icons.get(record.id).svg);
      const home=files['website/index.html'];
      expect(home).toContain('data-domain-icon-credits');
      expect(home).toContain(record.library);
      expect(motion.documentHTML(home,config,true)).toContain(runtime.replace(/<\/script/gi,'<\\/script'));
      // The decorator must leave the real ad slots and article anchors intact.
      expect(home).toContain('div-gpt-ad-banner1');
      expect(home).toContain('details/article1.html');
    }
  },30000);
});
