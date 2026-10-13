import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { loadBuilder,createState } from './template-fixtures.mjs';
const context={};vm.runInNewContext(readFileSync(new URL('../js/site-motion.js',import.meta.url),'utf8'),context);
const motion=context.SiteMotion;

describe('Shared generated site motion',()=>{
  it('honors valid template durations between the UI presets',()=>{
    expect(motion.normalize({config:{transitionSpeed:'0.4s'}}).speed).toBe('0.4s');
    expect(motion.normalize({config:{transitionSpeed:'99s'}}).speed).toBe('0.3s');
  });
  it.each(['normal','batch-ad-build','ad-migration'])('defaults on for %s',mode=>{
    const settings=motion.normalize({siteBuildMode:mode,selectedTheme:'tech',config:{}});
    expect(settings).toMatchObject({reveal:true,hover:true,icon:true,arrow:true,domain:'tech'});
  });
  it.each(['ad-injection','differentiated','ad-policy','batch-ad-policy','ad-restore'])('excludes %s',mode=>{
    expect(motion.normalize({siteBuildMode:mode,config:{}})).toBeNull();
  });
  it('validates custom colors and keeps independent switches',()=>{
    const settings=motion.normalize({config:{viewportRevealEnabled:false,cardInteractionEnabled:false,cardDomainIconEnabled:false,cardArrowEnabled:false,cardGlowColor:'custom',cardGlowCustom:'</style><script>bad()'}});
    expect(settings).toMatchObject({reveal:false,hover:false,icon:false,arrow:false,color:'#68c492'});
    expect(motion.normalize({config:{cardGlowColor:'custom',cardGlowCustom:'#123AbC'}}).color).toBe('#123AbC');
  });
  it.each(['green','cyan','blue','purple','pink','orange','gold'])('supports %s preset',color=>{
    expect(motion.normalize({config:{cardGlowColor:color}}).color).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('does not rewrite content/ad DOM, and is idempotent',()=>{
    const html='<html><head></head><body><a class="item-card" href="details/article1.html">Title</a><div id="div-gpt-ad-banner1"></div></body></html>';
    const config={style:{siteMotion:motion.normalize({config:{}})}};
    const enhanced=motion.documentHTML(html,config);
    expect(enhanced).toContain('<a class="item-card" href="details/article1.html">Title</a><div id="div-gpt-ad-banner1"></div>');
    expect(motion.documentHTML(enhanced,config)).toBe(enhanced);
    expect(motion.documentHTML(html,{style:{siteMotion:null}})).toBe(html);
  });
  it('links nested detail assets correctly and inlines previews',()=>{
    const config={style:{siteMotion:motion.normalize({config:{}})}};
    const html='<html><head><link rel="stylesheet" href="../css/style.css"></head><body></body></html>';
    const exported=motion.documentHTML(html,config);
    expect(exported).toContain('src="../js/site-motion-runtime.js"');
    expect(motion.documentHTML(exported,config,true)).not.toContain('src="../js/site-motion-runtime.js"');
    expect(motion.documentHTML(exported,config,true)).toContain('data-site-motion-runtime>');
  });
  it('runtime is standalone, includes lifecycle/fallback, and has no scroll listener',()=>{
    expect(()=>new vm.Script(motion.runtime)).not.toThrow();
    expect(motion.runtime).toContain('pageshow');expect(motion.runtime).toContain('pointercancel');
    expect(motion.runtime).toContain('MutationObserver');expect(motion.runtime).not.toMatch(/addEventListener\(["']scroll/);
    expect(motion.css).toContain('prefers-reduced-motion');
  });
  it.each([false,true])('real %s generator includes motion in all exported pages',async game=>{
    const builder=loadBuilder(game,false,true),state=createState(builder,undefined,'migration');
    const config=builder.generator.buildConfig(state);
    expect(config.style.animationEnter).toBe('none');expect(config.style.cardHover).toBe('none');
    expect(config.style.siteMotion.domain).toBe(game?'game':state.selectedTheme);
    await builder.generator.exportWebsite(state,()=>{});
    const files=builder.files();
    const pages=Object.entries(files).filter(([path])=>path.endsWith('.html'));
    expect(pages.length).toBeGreaterThan(20);
    for(const [path,html] of pages) {
      expect(html,path).toContain('data-site-motion-settings');
      expect(html,path).toContain('site-motion-runtime.js');
    }
    expect(files['website/js/site-motion-runtime.js']).toBe(motion.runtimeFor(config.style.siteMotion.domain));
    expect(files['website/ICONS-LICENSE.txt']).toContain('Apache');
    expect(files['website/ICONS-LICENSE.txt']).toContain('Lisa Wischofsky');
    expect(files['website/assets/domain-icon.svg']).toBe(context.DomainIcons.get(config.style.siteMotion.domain).svg);
  });
  it('preview/export signature responds to settings, and excluded generator path stays clear',()=>{
    const builder=loadBuilder(false,false,true),state=createState(builder);
    const first=builder.generator.buildConfig(state).renderSignature;
    state.config.cardGlowColor='blue';expect(builder.generator.buildConfig(state).renderSignature).not.toBe(first);
    state.siteBuildMode='ad-policy';expect(builder.generator.buildConfig(state).style.siteMotion).toBeNull();
  });
  it('all catalog domains have vetted local SVG mappings',()=>{
    const builder=loadBuilder(false),icons=JSON.parse(readFileSync(new URL('../motion/domain-icons.json',import.meta.url),'utf8'));
    for(const id of Object.keys(builder.TemplateCatalog.domains)) {
      expect(icons[id],id).toContain('<svg');
      expect(icons[id]).not.toMatch(/<script\b|<foreignObject\b|\son\w+\s*=|(?:href|xlink:href)\s*=\s*["'](?!#)/i);
    }
  });
});
