import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import { categoryGridAttributes, categoryLayoutSettings } from '../template-system/category-layout.js';
import { createState, loadBuilder } from './template-fixtures.mjs';

describe('per-category editorial layout settings', () => {
  it('keeps old/invalid settings automatic and never interpolates arbitrary values', () => {
    expect(categoryLayoutSettings(undefined)).toEqual({ layout: 'auto', columns: 'auto' });
    expect(categoryGridAttributes({ layout: 'injected" onclick="bad', columns: '99;bad' }, 3)).toBe('');
    expect(categoryGridAttributes({ layout: 'grid', columns: '99;bad' }, 3))
      .toBe(' data-category-layout="grid" data-category-columns="auto" style="--category-requested-columns:3"');
  });

  it('uses actual rendered articles while retaining the requested column preference', () => {
    expect(categoryGridAttributes({ layout: 'featured', columns: '4', count: 20 }, 3))
      .toBe(' data-category-layout="featured" data-category-columns="4" style="--category-requested-columns:2"');
  });

  it('keeps batch site configurations independent through the real export-state factory', () => {
    const context = {};
    vm.runInNewContext(readFileSync(new URL('../js/batch-ad-builder.js', import.meta.url), 'utf8') +
      '\nthis.batchFactory = BatchAdBuilder;', context);
    const factory = context.batchFactory;
    const builder = loadBuilder(false, true, true);
    const base = createState(builder, { ...builder.presets.find(preset => preset.id === 'evwired-studio'), domainId: 'tech' });
    const first = { themeId: 'tech', data: base.data, fieldMapping: base.fieldMapping, adDomain: 'one.example.com',
      config: { ...base.config, categories: [{ name: 'First', count: 3, layout: 'featured', columns: '2' }] } };
    const second = { ...first, adDomain: 'two.example.com',
      config: { ...base.config, categories: [{ name: 'Second', count: 3, layout: 'grid', columns: '3' }] } };
    const batch = { adMode: 'reserve', reserveDefaults: { placementMode: 'manual', adPlacements: {} } };
    const firstState = factory.createSiteState(base, first, null, batch);
    const secondState = factory.createSiteState(base, second, null, batch);
    expect(firstState.config.categories[0].layout).toBe('featured');
    expect(secondState.config.categories[0].layout).toBe('grid');
    firstState.config.categories[0].columns = '1';
    expect(first.config.categories[0].columns).toBe('2');
    expect(secondState.config.categories[0].columns).toBe('3');
  });

  it.each(['manual', 'code', 'migration'])('preserves advertising and settings in the %s generation path', async mode => {
    const builder = loadBuilder(false, true, true);
    const state = createState(builder, { ...builder.presets.find(preset => preset.id === 'evwired-studio'), domainId: 'tech' }, mode);
    state.config.categories[0].count = 3;
    await builder.generator.exportWebsite(state, () => {});
    const before = { ...builder.files() };
    state.config.categories[0].layout = 'featured';
    state.config.categories[0].columns = '2';
    state.config.categories[1].layout = 'grid';
    state.config.categories[1].columns = '4';
    await builder.generator.exportWebsite(state, () => {});
    const after = builder.files();
    expect(after['website/js/ad.js']).toBe(before['website/js/ad.js']);
    const adOrder = html => [...parseHTML(html).document.querySelectorAll('[id]')]
      .filter(node => /^(adv[123]|div-gpt-ad-)/.test(node.id)).map(node => node.id);
    expect(adOrder(after['website/index.html'])).toEqual(adOrder(before['website/index.html']));
    expect(after['website/index.html']).toContain('data-category-layout="featured" data-category-columns="2"');
    expect(builder.generator.generatePreviewHtml(state, 'home')).toContain('data-category-layout="grid" data-category-columns="4"');
    const settings = JSON.parse(after['website/SITE_RENDER_MANIFEST.json']).categories;
    expect(settings[0]).toMatchObject({ count: 3, layout: 'featured', columns: '2' });
    // The already-rendered categories must not be repopulated by script.js and
    // lose their saved attributes after an exported page loads.
    expect(after['website/index.html']).toContain('data-static-rendered="true" data-category-layout="featured"');
  });

  it('does not apply stored presentation preferences to a legacy template', () => {
    const builder = loadBuilder(false, true, true);
    const state = createState(builder, builder.presets.find(preset => preset.domainId === 'tech'));
    state.config.categories[0].layout = 'featured';
    state.config.categories[0].columns = '4';
    expect(builder.generator.generatePreviewHtml(state, 'home')).not.toContain('data-category-layout="featured"');
  });
});
