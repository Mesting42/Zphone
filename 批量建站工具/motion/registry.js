import css from './site-motion.css';
import { DomainIcons } from './domain-icons.js';
import license from './ICONS-LICENSE.txt';
import { startViewportReveal } from './viewport-reveal.js';
import { startCardPointer } from './card-pointer.js';
import { bootSiteMotion } from './bootstrap.js';

const colors = {green:'#68c492',cyan:'#36b9c7',blue:'#5988e8',purple:'#a27bea',pink:'#e881b1',orange:'#ee9855',gold:'#cda647'};
const runtimes = new Map();
/** Serialize only this site's selected artwork, never the complete 36-icon set. */
function runtimeFor(domain, enabled = true) {
  const icon = enabled ? DomainIcons.get(domain) : null;
  const key = icon ? icon.id : 'off';
  if (!runtimes.has(key)) {
    const glyph = icon ? {id:icon.id,src:icon.src} : null;
    runtimes.set(key, '(' + bootSiteMotion.toString() + ')(' + JSON.stringify(glyph) + ',' + startViewportReveal.toString() + ',' + startCardPointer.toString() + ');');
  }
  return runtimes.get(key);
}
const runtime = runtimeFor('general');

/** Both builders share the same ZIP contract and attribution files. */
function exportAssets(folder, settings) {
  folder.folder('js').file('site-motion-runtime.js', runtimeFor(settings.domain, settings.icon));
  folder.folder('css').file('site-motion.css', css);
  folder.file('ICONS-LICENSE.txt', license);
  if (settings.icon) {
    const icon = DomainIcons.get(settings.domain);
    folder.folder('assets').file('domain-icon.svg', icon.svg);
    folder.file('ICONS-PROVENANCE.json', JSON.stringify({artworkUnmodified:true,icon:{...icon.record,file:'assets/domain-icon.svg',sourceFile:'motion/'+icon.record.file}},null,2));
  }
}
const boolean = value => value !== false && value !== 'false' && value !== 'off';

/** Workflow gate uses the ORIGINAL app mode, before the generator converts ad
 * modes to normal/ad-placeholder. Excluded workflows never receive assets. */
function normalize(state) {
  if (!['normal','batch-ad-build','ad-migration'].includes(state.siteBuildMode || 'normal')) return null;
  const config = state.config || {};
  const choice = config.cardGlowColor || 'theme';
  const custom = /^#[0-9a-f]{6}$/i.test(config.cardGlowCustom || '') ? config.cardGlowCustom : '#68c492';
  // 新版指针动效也读取工作台过渡时长，避免控件只影响已替代的旧动画。
  const requestedSpeed = /^(?:\d+(?:\.\d+)?|\.\d+)s$/.test(config.transitionSpeed || '') ? parseFloat(config.transitionSpeed) : NaN;
  const speed = requestedSpeed >= .05 && requestedSpeed <= 2 ? requestedSpeed + 's' : '0.3s';
  return {reveal:boolean(config.viewportRevealEnabled),hover:boolean(config.cardInteractionEnabled),icon:boolean(config.cardDomainIconEnabled),arrow:boolean(config.cardArrowEnabled),domain:state.selectedTheme || 'general',speed,color:choice==='custom'?custom:colors[choice] || 'var(--color-primary, #68c492)'};
}

/** Generated page assembly only: no rewriting of cards, content or ad markup. */
function documentHTML(html,config,preview=false) {
  const settings = config.style && config.style.siteMotion;
  if (!settings) return html;
  const inlineRuntime = '<script data-site-motion-runtime>' + runtimeFor(settings.domain,settings.icon).replace(/<\/script/gi,'<\\/script') + '</script>';
  if (html.includes('data-site-motion-settings')) {
    return preview ? html.replace(/<script data-site-motion-runtime[^>]*>[\s\S]*?<\/script>/,inlineRuntime) : html;
  }
  const nested = /<link[^>]+href="\.\.\/css\//.test(html);
  const path = nested?'../':'';
  const settingsJSON = JSON.stringify(settings).replace(/</g,'\\u003c');
  html = html.replace(/<body\b/,'<body data-site-motion');
  html = html.replace('</head>','<style data-site-motion-style>:root{--sf-glow-color:'+settings.color+';--sf-motion-speed:'+settings.speed+';}\n'+css+'</style>\n</head>');
  if (settings.icon && !/<(?:span|div)\b[^>]*\sdata-domain-icon-credits\b/.test(html)) {
    const credit = '<div class="sf-icon-credits">' + DomainIcons.attributionHTML(settings.domain) + '</div>';
    // Append a small credit row without rewriting existing footer/legal links.
    html = html.includes('</footer>') ? html.replace('</footer>',credit+'</footer>') : html.replace('</body>',credit+'</body>');
  }
  return html.replace('</body>','<script type="application/json" data-site-motion-settings>'+settingsJSON+'</script>\n'+(preview?inlineRuntime:'<script data-site-motion-runtime src="'+path+'js/site-motion-runtime.js" defer></script>')+'\n</body>');
}

/** Config UI binds once; template changes only synchronize values. New preferences
 * are separate from preset.style so selecting a blueprint cannot reset them. */
const fields = { 'viewport-reveal-enabled':'viewportRevealEnabled','card-interaction-enabled':'cardInteractionEnabled','card-domain-icon-enabled':'cardDomainIconEnabled','card-arrow-enabled':'cardArrowEnabled','card-glow-color':'cardGlowColor','card-glow-custom':'cardGlowCustom' };
function syncControls(config) {
  Object.entries(fields).forEach(([id,key]) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.value = id.endsWith('-enabled')?(boolean(config[key])?'on':'off'):(config[key] || (id==='card-glow-color'?'theme':'#68c492'));
  });
  const custom = document.getElementById('card-glow-custom-row');
  if (custom) { custom.hidden = config.cardGlowColor !== 'custom'; custom.style.display = custom.hidden?'none':''; }
  // Legacy controls remain available to old save/load code but are not a second
  // animation system exposed to the operator.
  ['animation-enter','card-hover'].forEach(id => {
    const control=document.getElementById(id);
    if(control) { const row=control.closest('.config-item');if(row)row.style.display='none'; }
  });
  const text = document.getElementById('card-glow-hex');
  if (text) { text.value = config.cardGlowCustom || '#68c492'; text.setCustomValidity(''); }
}
function bindControls(getConfig,updated) {
  Object.entries(fields).forEach(([id,key]) => {
    const element = document.getElementById(id);
    if (!element || element.dataset.motionBound) return;
    element.dataset.motionBound='true';
    element.addEventListener('change',function() {
      const config=getConfig(); config[key]=id.endsWith('-enabled')?element.value==='on':element.value;
      syncControls(config); updated();
    });
  });
  const text = document.getElementById('card-glow-hex');
  if (text && !text.dataset.motionBound) {
    text.dataset.motionBound='true';
    text.addEventListener('change',function() {
      const valid=/^#[0-9a-f]{6}$/i.test(text.value);
      text.setCustomValidity(valid?'':'请输入 # 开头的六位颜色值，例如 #68c492');
      if (!valid) { text.reportValidity(); return; }
      getConfig().cardGlowCustom=text.value;syncControls(getConfig());updated();
    });
  }
  syncControls(getConfig());
}
globalThis.DomainIcons = DomainIcons;
globalThis.SiteMotion = {normalize,documentHTML,syncControls,bindControls,css,runtime,runtimeFor,exportAssets,license};
