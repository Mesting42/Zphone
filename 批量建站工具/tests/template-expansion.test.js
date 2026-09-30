import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { loadBuilder, createState } from './template-fixtures.mjs';

describe('domain template category heading matrix', () => {
  const builder = loadBuilder(false);

  it('assigns all 1,080 domain template IDs a stable and unique heading composition', () => {
    const templateIds = Object.values(builder.domains).flatMap(domain => Array.from(domain.blueprints));
    const signatures = [];

    expect(templateIds).toHaveLength(1080);
    expect(new Set(templateIds).size).toBe(1080);

    for (const templateId of templateIds) {
      const recipe = builder.TemplateLayouts.headingDesign({ templateId });
      const domainId = templateId.replace(/-blueprint-\d+$/, '');
      const config = {
        templateId,
        templateDomain: domainId,
        theme: { id: domainId },
        structure: { homeLayout: 'standard' },
        style: { categoryIconsEnabled: true }
      };
      const firstHeader = builder.TemplateLayouts.categoryHeader(config, { name: '首个分类', icon: '🌊' }, 0);
      const laterHeader = builder.TemplateLayouts.categoryHeader(config, { name: '后续分类', icon: '🐟' }, 1);
      const styles = builder.TemplateLayouts.css(config);

      expect(recipe, templateId).toBeTruthy();
      expect(recipe, templateId).toEqual(builder.TemplateLayouts.headingDesign({ templateId }));
      expect(firstHeader, templateId).toContain(`data-heading-composition="${recipe.composition}"`);
      expect(laterHeader, templateId).toContain(`data-heading-composition="${recipe.composition}"`);
      expect(builder.TemplateLayouts.bodyAttributes(config), templateId).toContain(`data-template-heading="${recipe.signature}"`);
      expect(styles, templateId).toContain(`body[data-template-heading="${recipe.signature}"]`);
      expect(styles, templateId).not.toContain('undefined');
      signatures.push(recipe.signature);
    }

    expect(new Set(signatures).size).toBe(1080);
  }, 60000);
});

describe('compact domain-specific category title icons', () => {
  const builder = loadBuilder(false);

  it('keeps the original single-icon title row across every domain template', () => {
    const presets = new Map(builder.presets.map(preset => [preset.id, preset]));

    expect(Object.keys(builder.domains)).toHaveLength(36);
    for (const [domainId, domain] of Object.entries(builder.domains)) {
      for (const templateId of domain.blueprints) {
        const preset = presets.get(templateId);
        const config = {
          ...preset,
          templateDomain: domainId,
          theme: { id: domainId },
          style: { ...preset.style, categoryIconsEnabled: true }
        };
        const header = builder.TemplateLayouts.categoryHeader(config, { name: '分类标题', icon: '🌊' }, 0);
        expect(header, templateId).toContain('<span class="category-title-icon" aria-hidden="true">🌊</span>');
        expect(header, templateId).toContain('<span class="category-title-text">分类标题</span>');
        expect(header, templateId).not.toContain('tpl-domain-emblem');
      }
    }
  });

  it('shows no standalone field emblem when category icons are disabled', () => {
    const domainId = 'marinescience';
    const config = {
      templateId: domainId + '-blueprint-01',
      templateDomain: domainId,
      theme: { id: domainId },
      structure: { homeLayout: 'standard' },
      style: { categoryIconsEnabled: false }
    };
    const header = builder.TemplateLayouts.categoryHeader(config, { name: '海洋研究', icon: '🌊' }, 0);

    expect(header).not.toContain('tpl-domain-emblem');
    expect(header).not.toContain('class="category-title-icon"');
    expect(header).toContain('<span class="category-title-text">海洋研究</span>');
  });

  it('uses small inline icon-size variations without adding heading height', () => {
    const domainId = 'marinescience';
    const preset = builder.presets.find(item => item.id === domainId + '-blueprint-14');
    const config = {
      ...preset,
      templateDomain: domainId,
      theme: { id: domainId },
      style: { ...preset.style, categoryIconsEnabled: true }
    };
    const header = builder.TemplateLayouts.categoryHeader(config, { name: '海洋研究', icon: '🌊' }, 0);
    const recipe = builder.TemplateLayouts.headingDesign(config);
    const css = builder.TemplateLayouts.css(config);

    expect(header).toContain('data-heading-icon-size="' + recipe.iconSize.toFixed(2) + '"');
    expect(header).not.toContain('tpl-domain-emblem');
    expect(css).not.toContain('tpl-domain-emblem');
    expect(css).toContain('.category-title-icon{font-size:' + recipe.iconSize.toFixed(2) + 'em}');
    expect(css).toContain('@media(max-width:720px)');
    expect(css).toContain('overflow-wrap:anywhere');
    const iconSizes = [...new Set(builder.presets.map(item => builder.TemplateLayouts.headingDesign({ ...item, templateId: item.id }).iconSize))].sort((a, b) => a - b);
    expect(iconSizes).toEqual([0.62, 0.64, 0.66, 0.68, 0.70]);
  });

  it.each([false, true])('keeps preview and export free of extra emblems (game builder: %s)', async game => {
    const targetBuilder = loadBuilder(game);
    const preset = game
      ? targetBuilder.presets[0]
      : targetBuilder.presets.find(item => item.domainId === 'marinescience');
    const state = createState(targetBuilder, preset);
    const extractCategoryIcons = html => html.match(/<span class="category-title-icon"[^>]*>[\s\S]*?<\/span>/g) || [];
    const preview = targetBuilder.generator.generatePreviewHtml(state, 'home');
    const previewIcons = extractCategoryIcons(preview);

    await targetBuilder.generator.exportWebsite(state, () => {});
    const exported = targetBuilder.files()['website/index.html'];
    const exportedIcons = extractCategoryIcons(exported);

    expect(preview).not.toContain('tpl-domain-emblem');
    expect(exported).not.toContain('tpl-domain-emblem');
    expect(previewIcons).toHaveLength(state.config.categories.length);
    expect(exportedIcons).toEqual(previewIcons);
  });
});

// 对照同一领域的原模板逐字比较广告运行时，结构扩充不能改写广告逻辑。
describe.each([false, true])('template expansion (game builder: %s)', game => {
  const builder = loadBuilder(game);
  const expanded = builder.presets.filter(preset => builder.TemplateCatalog.getLayout(game ? preset.id : preset.structure.homeLayout));

  it('registers exactly 30 templates per domain and preserves original IDs', () => {
    if (game) {
      expect(builder.presets).toHaveLength(30);
      expect(Array.from(builder.presets.slice(0, 4), item => item.id)).toEqual(['classic', 'poster', 'editorial', 'arcade']);
    } else {
      expect(Object.keys(builder.domains)).toHaveLength(36);
      expect(builder.presets).toHaveLength(1080);
      Object.entries(builder.domains).forEach(([id, profile]) => {
        expect(profile.blueprints).toHaveLength(30);
        expect(Array.from(profile.blueprints)).toEqual(Array.from({ length: 30 }, (_, i) => `${id}-blueprint-${String(i + 1).padStart(2, '0')}`));
        expect(builder.TemplateCatalog.getDomain(id).id).toBe(id);
      });
    }
  });

  it('exports every added template with the same IDs, placements and ad.js as its original domain template', async () => {
    const baselines = {};
    for (const preset of expanded) {
      const state = createState(builder, preset);
      const key = state.selectedTheme;
      if (!baselines[key]) {
        const original = game ? builder.presets[0] : builder.presets.find(item => item.domainId === key);
        await builder.generator.exportWebsite(createState(builder, original), () => {}, { siteFolderName: 'template.example.com' });
        baselines[key] = builder.files()['template.example.com/js/ad.js'];
      }
      await builder.generator.exportWebsite(state, () => {}, { siteFolderName: 'template.example.com' });
      const files = builder.files();
      const config = builder.generator.buildConfig(state);
      expect(files['template.example.com/js/ad.js'], preset.id).toBe(baselines[key]);
      expect(config.adPaths).toEqual(builder.paths);
      const pageNames = ['index.html', 'details/article1.html', game ? 'all-games.html' : 'all-articles.html'];
      for (const name of pageNames) {
        const page = files['template.example.com/' + name];
        expect(page, preset.id + '/' + name).toContain('data-template-layout="portal-');
        for (const slot of [1, 2, 3]) expect(page.match(new RegExp('id="div-gpt-ad-banner' + slot + '"', 'g')), preset.id + '/' + name).toHaveLength(1);
        expect(page).toContain('js/ad.js?');
      }
      expect(files['template.example.com/css/style.css']).not.toContain('undefined');
      const home = files['template.example.com/index.html'];
      expect(home).toMatch(/<div class="tpl-sections">\s*<section/);
      expect(home.match(/class="category-title-icon"/g)).toHaveLength(state.config.categories.length);
      // 首页排版器只打开分类容器，广告由生成器在原位置写入。
      const contentWrapper = builder.TemplateLayouts.openHome(config);
      expect(contentWrapper).toBe('<div class="tpl-home" data-template-composition="' + builder.TemplateLayouts.design(config).layout.id + '"><div class="tpl-sections">');
      expect(Object.keys(files).every(path => path.startsWith('template.example.com/'))).toBe(true);
    }
  }, 60000);

  it.each(['none', 'manual', 'fixed', 'migration'])('preserves the %s workflow on every new layout', async mode => {
    const representatives = game ? expanded : expanded.filter(preset => preset.domainId === 'tech');
    const original = game ? builder.presets[0] : builder.presets.find(item => item.domainId === 'tech');
    await builder.generator.exportWebsite(createState(builder, original, mode), () => {});
    const baseline = builder.files()['website/js/ad.js'];
    const baselineHome = builder.files()['website/index.html'];
    const baselinePreview = builder.generator.generatePreviewHtml(createState(builder, original, mode), 'home');
    const baselineConfig = builder.generator.buildConfig(createState(builder, original, mode));
    for (const preset of representatives) {
      const state = createState(builder, preset, mode);
      await builder.generator.exportWebsite(state, () => {});
      const files = builder.files();
      expect(files['website/js/ad.js']).toBe(baseline);
      expect(builder.generator.buildConfig(state).adPlacements).toEqual(baselineConfig.adPlacements);
      expect(builder.generator.buildConfig(state).adRuntimeEnabled).toBe(mode !== 'none');
      // 手动位置与旧模板保持一致，且卡片间广告在 HTML 内已经就绪。
      expect(files['website/index.html'].match(/id="(?:adv[123]|div-gpt-ad-banner[123])"/g)).toEqual(baselineHome.match(/id="(?:adv[123]|div-gpt-ad-banner[123])"/g));
      expect(builder.generator.generatePreviewHtml(state, 'home').match(/id="(?:adv[123]|div-gpt-ad-banner[123])"/g)).toEqual(baselinePreview.match(/id="(?:adv[123]|div-gpt-ad-banner[123])"/g));
      expect(files['website/index.html'].includes('id="div-gpt-ad-banner1"')).toBe(mode !== 'none');
      expect(builder.generator.generatePreviewHtml(state, 'home').includes('id="div-gpt-ad-banner1"')).toBe(mode !== 'none');
    }
  });

  it('supports icon hiding on both original and new templates without changing saved icons or ad slots', () => {
    // 标题矩阵测试已经逐一覆盖 1,080 个模板；这里按领域各取原版与最后一个
    // 扩展模板做生成器集成验证，避免重复生成整套 CSS 两千余次。
    const representatives = game
      ? [builder.presets[0], builder.presets[builder.presets.length - 1]]
      : Object.keys(builder.domains).flatMap(domainId => {
          const domainPresets = builder.presets.filter(preset => preset.domainId === domainId);
          return [domainPresets[0], domainPresets[domainPresets.length - 1]];
        });
    for (const preset of representatives) {
      const state = createState(builder, preset);
      const saved = JSON.stringify(state.config.categories);
      state.config.categoryIconsEnabled = false;
      const html = builder.generator.generatePreviewHtml(state, 'home');
      expect(html).not.toContain('class="category-title-icon"');
      expect(html).toContain('class="category-title-text"');
      expect(html).toContain('id="div-gpt-ad-banner1"');
      expect(JSON.stringify(state.config.categories)).toBe(saved);
      state.config.categoryIconsEnabled = true;
      expect(builder.generator.generatePreviewHtml(state, 'home')).toContain('class="category-title-icon"');
    }
  }, 20000);

  it.each(['initial', 'v1.0.0', 'v1.0.1', 'v1.0.2'])('preserves the complete %s runtime across every new layout', async version => {
    const representatives = game ? expanded : expanded.filter(preset => preset.domainId === 'tech');
    const expected = builder.generator.generateSelectedAdJs(builder.paths, version);
    for (const preset of representatives) {
      const state = createState(builder, preset);
      state.adJsVersion = version;
      await builder.generator.exportWebsite(state, () => {});
      expect(builder.files()['website/js/ad.js']).toBe(expected);
    }
  });

  it('continues using an uploaded template as the default without losing its custom source or mapped IDs', async () => {
    // 使用真实目录加载与 render()，通过接口响应注入测试模板，不写入用户的模板存储。
    const source = builder.generator.generateSelectedAdJs({}, 'v1.0.2') + '\n/* custom-template-preserved */';
    const declarations = { bannerPath1: 'adUnitBanner1', bannerPath2: 'adUnitBanner2', bannerPath3: 'adUnitBanner3',
      interstitialPath: 'adUnitInterstitial', anchorPath: 'adUnitAnchor', analyticsID: 'gaMeasurementId' };
    const ranges = {};
    for (const [field, name] of Object.entries(declarations)) {
      const match = new RegExp('const ' + name + ' = ("[^"\\n]*")').exec(source);
      if (!match) throw new Error('Fixture missing variable ' + name);
      ranges[field] = { start: match.index + match[0].length - match[1].length, end: match.index + match[0].length };
    }
    const template = { version: 'v9.9.9', source, fields: declarations, ranges };
    const catalogWindow = { location: { href: 'http://127.0.0.1:5173/', protocol: 'http:', hostname: '127.0.0.1' }, dispatchEvent() {} };
    const context = { window: catalogWindow, document: { querySelectorAll: () => [] }, URL, CustomEvent: class {},
      fetch: async () => ({ ok: true, json: async () => ({ manifest: { defaultVersion: 'v9.9.9', templates: [{ version: 'v9.9.9' }] }, templates: [template] }) }) };
    catalogWindow.fetch = context.fetch;
    vm.runInNewContext(readFileSync(new URL('../js/ad-template-catalog.js', import.meta.url), 'utf8'), context);
    await catalogWindow.AdTemplateCatalog.ready;
    builder.window.AdTemplateCatalog = catalogWindow.AdTemplateCatalog;
    try {
      for (const preset of (game ? expanded : expanded.filter(item => item.domainId === 'tech'))) {
        const state = createState(builder, preset);
        state.adJsVersion = catalogWindow.AdTemplateCatalog.getDefaultVersion();
        await builder.generator.exportWebsite(state, () => {});
        const runtime = builder.files()['website/js/ad.js'];
        expect(runtime).toContain('ad.js v9.9.9');
        expect(runtime).toContain('custom-template-preserved');
        expect(runtime).toContain(builder.paths.bannerPath1);
        expect(runtime).toContain(builder.paths.interstitialPath);
        expect(() => new Function(runtime)).not.toThrow();
      }
    } finally { delete builder.window.AdTemplateCatalog; }
  });
});
