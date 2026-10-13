import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {loadBuilder,createState} from './template-fixtures.mjs';
const context={};vm.runInNewContext(readFileSync(new URL('../js/configuration-controls.js',import.meta.url),'utf8'),context);
const view=context.ConfigurationControls;
describe('explicit configuration overrides',()=>{
 it('keeps template defaults intact until the operator changes a control',()=>{
  expect(view.css({structure:{cardColumns:'3'},style:{cardRadius:'24px'}})).toBe('');
 });
 it('ignores stale override values after a template changes the selected value',()=>{
  expect(view.css({structure:{},style:{cardRadius:'8px',controlOverrides:{cardRadius:'24px'}}})).toBe('');
 });
 it('restricts CSS values to built-in enums and existing variables',()=>{
  const config={structure:{cardColumns:'9;bad()'},style:{cardBorder:'bad(){}',controlOverrides:{cardColumns:'9;bad()',cardBorder:'bad(){}'}}};
  expect(view.css(config)).toBe('');
 });
 it.each([false,true])('snapshots the same overrides for preview and exported CSS (game=%s)',async game=>{
  const builder=loadBuilder(game,false,true),state=createState(builder);
  Object.assign(state.config,{cardRadius:'24px',cardSpacing:'40px',cardBorder:'dashed',cardImageHeight:'260px',cardViewMode:'list',gridGap:'30px',controlOverrides:{cardRadius:'24px',cardSpacing:'40px',cardBorder:'dashed',cardImageHeight:'260px',cardViewMode:'list',gridGap:'30px'}});
  const config=builder.generator.buildConfig(state),rules=builder.ConfigurationControls.css(config);
  expect(rules).toContain('border-radius:var(--card-radius)!important');
  expect(rules).toContain('padding:var(--card-spacing)!important');
  expect(rules).toContain('grid-template-columns:minmax(0,1fr)!important');
  expect(builder.generator.generatePreviewHtml(state,'home')).toContain(rules);
  await builder.generator.exportWebsite(state,()=>{});
  const css=Object.entries(builder.files()).find(([path])=>path.endsWith('/css/style.css'))?.[1];
  expect(css).toContain(rules);
 });
 it('uses a configured raw URL field in both editorial preview and export',async()=>{
  const builder=loadBuilder(false,false,true),state=createState(builder);
  Object.assign(state.config,{actionButtonEnabled:true,actionButtonLinkField:'url',actionButtonText:'Read source'});
  const preview=builder.generator.generatePreviewHtml(state,'detail');
  expect(preview).toContain('href="https://games.example.com/play-0" target="_blank" rel="noopener noreferrer">Read source');
  await builder.generator.exportWebsite(state,()=>{});
  const details=Object.entries(builder.files()).filter(([path])=>path.includes('/details/'));
  expect(details.some(([,html])=>String(html).includes('href="https://games.example.com/play-0" target="_blank" rel="noopener noreferrer">Read source'))).toBe(true);
  state.data.forEach(item=>{item.url='';});
  expect(builder.generator.generatePreviewHtml(state,'detail')).not.toContain('<a class="action-btn"');
 });
});
