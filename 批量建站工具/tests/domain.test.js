import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = {};
const dataSource = readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
const domainSource = readFileSync(new URL('../js/domain.js', import.meta.url), 'utf8');
const generatorSource = readFileSync(new URL('../js/generator.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
vm.runInNewContext(`${dataSource}\nthis.__catalog = DOMAIN_CATALOG; this.__templates = TEMPLATE_PRESETS; this.__styles = STYLE_PRESETS; this.__brands = BRAND_PRESETS; this.__logoIconGroups = LOGO_ICON_GROUPS; this.__logoIconDefaults = LOGO_ICON_DEFAULTS; this.__allCategoryEmojiIcons = ALL_CATEGORY_EMOJI_ICONS; this.__categoryEmojiPools = DOMAIN_CATEGORY_EMOJI_POOLS; this.__themes = THEMES; this.__iconSets = ICON_SET_PRESETS;`, context);
vm.runInNewContext(domainSource, context);
vm.runInNewContext(`${generatorSource}\nthis.__generator = Generator;`, context);

const { DomainEngine, __catalog: catalog, __templates: templates, __styles: styles, __brands: brands, __logoIconGroups: logoIconGroups, __logoIconDefaults: logoIconDefaults, __allCategoryEmojiIcons: allCategoryEmojiIcons, __categoryEmojiPools: categoryEmojiPools, __themes: themes, __iconSets: iconSets, __generator: generator } = context;

describe('local domain detection', () => {
  it.each([
    ['finance', { ticker: 'NVDA', market: 'NASDAQ', title: 'Stock market earnings and investment outlook' }],
    ['food', { title: 'Mediterranean Diet Recipes and Superfood Meal Ideas', summary: 'A culinary guide to hydration, cooking, and seasonal ingredients.' }],
    ['travel', { destination: 'Kyoto', hotel: 'Machiya Stay', title: 'A practical Japan travel guide' }],
    ['health', { condition: 'sleep', reviewed_by: 'Clinical reviewer', title: 'Health and wellness guide' }],
    ['anime', { studio: 'Bones', episodes: 24, title: 'Anime season review' }],
    ['automotive', { make: 'Volvo', model: 'EX90', engine: 'electric vehicle', title: 'New car review' }],
    ['film', { director: 'Jane Doe', runtime: 126, title: 'Independent cinema review' }],
    ['legal', { jurisdiction: 'California', case_number: 'A-102', title: 'New court regulation explained' }],
    ['pets', { pet_type: 'dog', breed: 'Shiba Inu', title: 'Puppy care and training guide' }],
    ['photography', { camera: 'X-T5', lens: '35mm', aperture: 'f/2', title: 'Street photography techniques' }],
    ['energy', { energy_type: 'solar', capacity_mw: 500, title: 'Renewable electricity project' }]
  ])('recognizes %s from domain fields and content', (expected, row) => {
    const result = DomainEngine.detect([row], catalog);
    expect(result.id).toBe(expected);
    expect(result.reliable).toBe(true);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it('flags generic data for manual confirmation', () => {
    const result = DomainEngine.detect([{ title: 'Weekly update', content: 'A general collection of notes.' }], catalog);
    expect(result.id).toBeNull();
    expect(result.reliable).toBe(false);
    expect(result.suggestedId).toBe('general');
    expect(result.fallbackUsed).toBe(true);
  });

  it('does not force a vertical domain when signals are tied', () => {
    const result = DomainEngine.detect([{ title: 'New release', release_date: '2026-09-10' }], catalog);
    expect(result.reliable).toBe(false);
    expect(result.suggestedId).toBe('general');
  });

  it('uses technology category labels to classify broad AI and frontier-tech editorial datasets', () => {
    const rows = [
      ['Artificial Intelligence', 'Synthetic data models reshape AI training.'],
      ['Semiconductors', 'Chip manufacturers race to build faster accelerators.'],
      ['Hardware', 'New device architectures improve compute efficiency.'],
      ['Cybersecurity', 'Security teams defend cloud infrastructure.'],
      ['Developer Tools', 'Software developers adopt new AI coding tools.'],
      ['Space', 'Satellite technology expands global connectivity.']
    ].map(([category, content], index) => ({
      id: index + 1,
      title: category + ' frontier report',
      category,
      content
    }));
    const result = DomainEngine.detect(rows, catalog);
    expect(result.id).toBe('tech');
    expect(result.reliable).toBe(true);
    expect(result.evidence).toContain('分类关键词 “artificial intelligence”');
  });

  it('uses upload names as supporting evidence without requiring a local file path', () => {
    const result = DomainEngine.detect([
      { title: 'Frontier models update', content: 'A weekly editorial update.', category: 'Research' }
    ], catalog, { fileName: '01-AI与前沿科技全景.rar', entryPath: 'technology_articles.json' });
    expect(result.id).toBe('tech');
    expect(result.evidence).toContain('来源关键词 “科技”');
  });

  it('recognizes historic photographic-process archives as photography instead of falling back to general', () => {
    const articles = Array.from({ length: 12 }, (_, index) => ({
      title: index % 3 === 0
        ? 'The Daguerreotype: The First Permanent Image'
        : index % 3 === 1
          ? 'Calotype and Talbotype: Photography from Negative to Positive'
          : 'The Wet-Plate Collodion Process',
      category: 'Historical Processes',
      tags: index % 2 === 0
        ? ['Daguerreotype', 'Early photography', 'Silver process']
        : ['Calotype', 'Paper photography', 'Glass negative'],
      content: 'Early photography used a camera, lens, darkroom, negative and photographic print to make lasting images.'
    }));
    const result = DomainEngine.detect(articles, catalog, {
      fileName: '古典摄影工艺.rar',
      entryPath: 'HistoricPhotoProcesses_articles.json'
    });
    expect(result.id).toBe('photography');
    expect(result.reliable).toBe(true);
  });

  it('prioritizes medical evidence over an incidental AI reference', () => {
    const result = DomainEngine.detect([
      {
        title: 'FDA clears an AI-assisted medical device for cancer patients',
        category: 'Medical Devices',
        content: 'The clinical trial evaluated patient safety and treatment outcomes.'
      }
    ], catalog);
    expect(result.id).toBe('health');
    expect(result.reliable).toBe(true);
  });

  it('treats repeated category labels as stronger evidence than incidental body words', () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      title: `Dog profile ${index + 1}`,
      category: 'Dog',
      content: 'A companion animal profile with a historical note.'
    }));
    const result = DomainEngine.detect(rows, catalog, { fileName: 'pets_articles.json' });
    expect(result.id).toBe('pets');
    expect(result.reliable).toBe(true);
  });

  it('provides twelve valid exclusive blueprints for every supported domain', () => {
    const templateIds = new Set(templates.map((template) => template.id));
    expect(Object.keys(catalog)).toHaveLength(32);
    expect(templates).toHaveLength(384);
    Object.values(catalog).forEach((profile) => {
      expect(profile.blueprints).toHaveLength(12);
      profile.blueprints.forEach((id) => expect(templateIds.has(id)).toBe(true));
    });
  });

  it('uses food-specific blueprints with regular navigation and Hero disabled by default', () => {
    const foodTemplates = templates.filter((template) => template.domainId === 'food');
    expect(foodTemplates.map((template) => template.name).slice(0, 5)).toEqual([
      '美食·食谱厨房', '美食·餐桌灵感', '美食·时令食材', '美食·餐馆指南', '美食·甜点画册'
    ]);
    expect(foodTemplates).toHaveLength(12);
    foodTemplates.forEach((template) => {
      expect(template.structure.heroEnabled).toBe(false);
      expect(template.structure.navbarLayout).toBe('normal');
    });
  });

  it('keeps every domain blueprint exclusive and structurally unique', () => {
    const allReferences = Object.entries(catalog).flatMap(([domainId, profile]) =>
      profile.blueprints.map((templateId) => ({ domainId, templateId }))
    );
    const ids = allReferences.map((item) => item.templateId);
    const names = templates.map((template) => template.name);
    const signatures = templates.map((template) => {
      const visualStyle = { ...template.style };
      delete visualStyle.transitionSpeed;
      return JSON.stringify({ structure: template.structure, style: visualStyle });
    });

    expect(new Set(ids).size).toBe(384);
    expect(new Set(names).size).toBe(384);
    expect(new Set(signatures).size).toBe(384);
    allReferences.forEach(({ domainId, templateId }) => {
      const template = templates.find((item) => item.id === templateId);
      expect(template.domainId).toBe(domainId);
      expect(template.id.startsWith(`${domainId}-blueprint-`)).toBe(true);
      expect(allReferences.filter((item) => item.templateId === templateId)).toHaveLength(1);
    });
  });

  it('provides at least 50 complete and visually distinct color themes', () => {
    const requiredVars = [
      '--color-bg', '--color-bg-secondary', '--color-surface', '--color-primary',
      '--color-text', '--color-text-secondary', '--color-border', '--color-card-bg',
      '--color-card-hover', '--navbar-bg', '--color-primary-rgb'
    ];
    expect(styles.length).toBeGreaterThanOrEqual(50);
    expect(new Set(styles.map((style) => style.id)).size).toBe(styles.length);
    expect(new Set(styles.map((style) => style.name)).size).toBe(styles.length);
    expect(new Set(styles.map((style) => style.previewBg)).size).toBe(styles.length);
    styles.forEach((style) => {
      requiredVars.forEach((variable) => expect(style.vars[variable]).toBeTruthy());
    });
  });

  it('provides a broad Logo icon library and a valid default for every domain', () => {
    const icons = logoIconGroups.flatMap((group) => group.icons.map((item) => item[0]));
    const oldAbstractSymbols = new Set(['◆','○','△','□','◇','◎','◉','◒','◫','▦','⊕','⌁','※','✦','↗','▤']);
    expect(logoIconGroups.length).toBeGreaterThanOrEqual(12);
    expect(new Set(icons).size).toBeGreaterThanOrEqual(150);
    Object.keys(catalog).forEach((domainId) => {
      expect(icons).toContain(logoIconDefaults[domainId]);
      expect(catalog[domainId].icon).toBe(logoIconDefaults[domainId]);
      expect(oldAbstractSymbols.has(catalog[domainId].icon)).toBe(false);
    });
  });

  it('provides 50 unique, domain-specific brand titles for every domain', () => {
    Object.keys(catalog).forEach((domainId) => {
      const options = brands[domainId];
      expect(options).toHaveLength(50);
      expect(new Set(options.map((option) => option.name.toLowerCase()))).toHaveLength(50);
      options.forEach((option) => {
        expect(option.siteTitle).toBe(option.name);
        expect(option.logoText).toBe(option.name);
      });
    });
  });

  it('uses 48 current-domain Emoji icons for random combinations and retains a broad manual library', () => {
    const oldAbstractSymbols = new Set(['◆','○','△','□','◇','◎','◉','◒','◫','▦','⊕','⌁','※','✦','↗','▤','♟️','🪙']);
    expect(Object.keys(categoryEmojiPools)).toHaveLength(32);
    expect(allCategoryEmojiIcons.length).toBeGreaterThanOrEqual(200);
    expect(new Set(allCategoryEmojiIcons).size).toBe(allCategoryEmojiIcons.length);
    Object.keys(catalog).forEach((domainId) => {
      const pool = categoryEmojiPools[domainId];
      expect(pool).toHaveLength(48);
      expect(new Set(pool).size).toBe(48);
      pool.forEach((icon) => expect(oldAbstractSymbols.has(icon)).toBe(false));
      expect(Array.from(themes[domainId].iconPool)).toEqual(Array.from(pool));
      expect(iconSets[domainId]).toHaveLength(50);
      iconSets[domainId].forEach((set) => {
        set.icons.forEach((icon) => expect(pool).toContain(icon));
      });
    });
    expect(categoryEmojiPools.health).toEqual(expect.arrayContaining(['🩺', '💊', '🏥', '🏃', '🥗']));
  });

  it('uses Emoji rather than abstract glyphs for every configurable template icon', () => {
    const oldAbstractSymbols = new Set(['⌘','✦','⌛','▦','▣','☾','◈','♛','✹']);
    templates.forEach((template) => expect(oldAbstractSymbols.has(template.icon)).toBe(false));
  });

  it('carries a chosen Logo icon into the generated navigation', () => {
    const appState = {
      selectedTheme: 'anime',
      data: [{ title: 'Test Anime', content: 'Preview content', image: 'cover.jpg' }],
      fieldMapping: { title: 'title', content: 'content', image: 'image' },
      config: {
        siteTitle: 'Otaku Signal',
        logoText: 'OtakuSignal',
        logoStyle: 'text-icon',
        logoIcon: '🦊',
        navLinks: ['home'],
        categories: [{ name: 'Anime', icon: '🌸', count: 1 }]
      },
      adPlacementMode: null,
      isLocalImages: false
    };
    const config = generator.buildConfig(appState);
    const html = generator.generatePreviewHtml(appState, 'home');
    expect(config.style.logoIcon).toBe('🦊');
    expect(html).toContain('<span class="logo-mark" aria-hidden="true">🦊</span><span>OtakuSignal</span>');
  });

  it('gives boxed wordmarks a safe header height in every compact template', () => {
    const appState = {
      selectedTheme: 'science',
      data: [{ title: 'Research update', content: 'Preview content', image: 'cover.jpg' }],
      fieldMapping: { title: 'title', content: 'content', image: 'image' },
      config: {
        siteTitle: 'Lab Brief',
        logoText: 'LabBrief',
        logoStyle: 'boxed',
        navbarHeight: '50px',
        navLinks: ['home'],
        categories: [{ name: 'Research', icon: '🔬', count: 1 }]
      },
      adPlacementMode: null,
      isLocalImages: false
    };
    const preview = generator.generatePreviewHtml(appState, 'home');

    expect(preview).toContain('--navbar-height: 72px;');
    expect(preview).toMatch(/<nav class="navbar(?: [^"]+)? has-boxed-logo">/);
    expect(preview).toContain('class="logo logo-boxed">LabBrief</a>');
    expect(preview).toContain('.navbar.has-boxed-logo .container');
    expect(preview).toContain('min-height: 42px;');
    expect(preview).not.toContain('style="border: 2px solid var(--color-primary)');
  });

  it('honors a fixed one-column layout instead of applying automatic item-count balancing', () => {
    const appState = {
      selectedTheme: 'food',
      data: [
        { title: 'One', content: 'Preview content', image: 'one.jpg' },
        { title: 'Two', content: 'Preview content', image: 'two.jpg' },
        { title: 'Three', content: 'Preview content', image: 'three.jpg' },
        { title: 'Four', content: 'Preview content', image: 'four.jpg' }
      ],
      fieldMapping: { title: 'title', content: 'content', image: 'image' },
      config: {
        siteTitle: 'Daily Journal',
        logoText: 'DailyJournal',
        cardColumns: '1',
        cardViewMode: 'list',
        navLinks: ['home'],
        categories: [{ name: 'Latest', icon: '📰', count: 3 }]
      },
      adPlacementMode: null,
      isLocalImages: false
    };
    const preview = generator.generatePreviewHtml(appState, 'home');
    const listStyles = preview.slice(preview.indexOf('/* 列表视图模式 */'), preview.indexOf('/* 入场动画 */'));

    expect(preview).toContain('<div class="items-grid item-count-3">');
    expect(preview).toContain('grid-template-columns: repeat(1, 1fr);');
    expect(preview).not.toContain('grid-template-columns: repeat(3, minmax(0, 1fr)) !important;');
    expect(listStyles).toMatch(/\.items-grid\.item-count-1,\s*\.items-grid\.item-count-2,\s*\.items-grid\.item-count-3,\s*\.items-grid\.item-count-4,\s*\.items-grid\.item-count-5,\s*\.items-grid\.item-count-6,\s*\.items-grid\.item-count-7\s*\{\s*grid-template-columns: minmax\(0, 1fr\) !important;/);

    const autoPreview = generator.generatePreviewHtml({
      ...appState,
      config: { ...appState.config, cardColumns: 'auto', cardViewMode: 'card' }
    }, 'home');
    expect(autoPreview).toContain('grid-template-columns: repeat(3, minmax(0, 1fr)) !important;');
  });

  it('keeps list templates single-column when a fixed card-column preference is present', () => {
    const preview = generator.generatePreviewHtml({
      selectedTheme: 'general',
      data: [
        { title: 'One', content: 'A short summary.', image: 'one.jpg' },
        { title: 'Two', content: 'A much longer summary used to ensure the list card remains a readable horizontal row.', image: 'two.jpg' }
      ],
      fieldMapping: { title: 'title', content: 'content', image: 'image' },
      config: {
        siteTitle: 'DailyJournal',
        logoText: 'DailyJournal',
        cardColumns: '4',
        cardViewMode: 'list',
        homeLayout: 'masonry',
        navLinks: ['home'],
        categories: [{ name: 'Latest', icon: '📰', count: 2 }]
      },
      adPlacementMode: null,
      isLocalImages: false
    }, 'home');

    const fixedColumnStyles = preview.slice(preview.indexOf('/* 固定列数时'), preview.indexOf('/* 卡片样式 */'));
    const listStyles = preview.slice(preview.indexOf('/* 列表视图模式 */'), preview.indexOf('/* 入场动画 */'));

    expect(fixedColumnStyles).toBe('');
    expect(listStyles).toContain('grid-template-columns: minmax(0, 1fr) !important;');
    expect(listStyles).toContain('flex-direction: row;');
    expect(listStyles).toContain('min-width: 240px;');
  });

  it('keeps six-card categories in a readable three-by-two grid even when a fixed column preference is present', () => {
    const preview = generator.generatePreviewHtml({
      selectedTheme: 'photography',
      data: Array.from({ length: 6 }, (_, index) => ({
        title: 'Article ' + (index + 1), content: 'Summary ' + (index + 1), image: 'image-' + (index + 1) + '.jpg'
      })),
      fieldMapping: { title: 'title', content: 'content', image: 'image' },
      config: {
        siteTitle: 'DailySignal',
        logoText: 'DailySignal',
        cardColumns: '4',
        cardViewMode: 'card',
        homeLayout: 'compact',
        navLinks: ['home'],
        categories: [{ name: 'Latest', icon: '📷', count: 6 }]
      },
      adPlacementMode: null,
      isLocalImages: false
    }, 'home');

    expect(preview).toContain('<div class="items-grid item-count-6">');
    expect(preview).toContain('/* 分类数量布局不变量：2→2；3→3；4→2+2；5→1+2+2；6→3+3；7→1+2+2+2。');
    expect(preview).toContain('.items-grid.item-count-6 {\n        display: grid !important;\n        width: 100%;\n        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;');
    expect(preview).toContain('.items-grid.item-count-2 > .item-card,\n    .items-grid.item-count-3 > .item-card,\n    .items-grid.item-count-4 > .item-card,\n    .items-grid.item-count-5 > .item-card,\n    .items-grid.item-count-6 > .item-card,\n    .items-grid.item-count-7 > .item-card {\n        display: flex !important;\n        flex: none !important;');
  });

  it('fills a two-card row and keeps its fixed-layout cards equal in height', () => {
    const appState = {
      selectedTheme: 'finance',
      data: [
        { title: 'One', content: 'Preview content', image: 'one.jpg' },
        { title: 'Two', content: 'Preview content', image: 'two.jpg' }
      ],
      fieldMapping: { title: 'title', content: 'content', image: 'image' },
      config: {
        siteTitle: 'ClearLedger',
        logoText: 'ClearLedger',
        cardColumns: '3',
        homeLayout: 'split',
        gridGap: '20px',
        navLinks: ['home'],
        categories: [{ name: 'Latest', icon: '🧭', count: 2 }]
      },
      adPlacementMode: null,
      isLocalImages: false
    };
    const preview = generator.generatePreviewHtml(appState, 'home');

    expect(preview).toContain('grid-template-columns: repeat(3, 1fr);');
    expect(preview).toContain('display: flex;\n        flex-wrap: wrap;\n        justify-content: center;');
    expect(preview).toContain('flex: 0 0 calc((100% - 40px) / 3);');
    expect(preview).toContain('align-items: stretch;');
    expect(preview).toContain('height: auto;\n        align-self: stretch;');
    expect(preview).toContain('/* 分类数量布局不变量：2→2；3→3；4→2+2；5→1+2+2；6→3+3；7→1+2+2+2。');
    expect(preview).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;');
    expect(preview).toContain('max-width: none !important;');
    expect(preview).not.toContain('.main-content.layout-split .category-section:nth-child(even) .items-grid {');
  });

  it('enforces the two-through-seven card grid invariants across every domain card template', () => {
    const failures = [];

    templates.forEach((template) => {
      if (template.structure.cardViewMode === 'list') return;
      [2, 3, 4, 5, 6, 7].forEach((count) => {
        const data = Array.from({ length: count }, (_, index) => ({
          title: index === 0 ? 'Short title' : 'A much longer title that wraps onto another line',
          content: index === 0 ? 'Short summary.' : 'A longer summary that deliberately occupies more lines than its neighbor so unequal card heights are detectable.',
          image: 'image-' + index + '.jpg'
        }));
        const preview = generator.generatePreviewHtml({
          selectedTheme: template.domainId,
          data,
          fieldMapping: { title: 'title', content: 'content', excerpt: 'content', image: 'image' },
          config: {
            ...template.structure,
            ...template.style,
            ...template.brand,
            templateId: template.id,
            categories: [{ name: 'First category', icon: '🧪', count }]
          },
          adPlacementMode: null,
          isLocalImages: false
        }, 'home');

        const checks = [
          '<div class="items-grid item-count-' + count + '">',
          '/* 分类数量布局不变量：2→2；3→3；4→2+2；5→1+2+2；6→3+3；7→1+2+2+2。',
          'grid-template-columns: repeat(' + ({ 2: 2, 3: 3, 4: 2, 5: 2, 6: 3, 7: 2 }[count]) + ', minmax(0, 1fr)) !important;',
          'align-items: stretch !important;',
          'width: auto !important;',
          'max-width: none !important;',
          'height: auto !important;',
          'align-self: stretch !important;'
        ];
        if (count === 5 || count === 7) {
          checks.push('.items-grid.item-count-' + count + ' > .item-card:first-child {\n        grid-column: 1 / -1;');
        }
        const missing = checks.filter((fragment) => !preview.includes(fragment));
        if (missing.length) failures.push({ template: template.id, count, missing });
      });
    });

    expect(failures).toEqual([]);
  });

  it('keeps every news header variant navigable and renders a visible gradient Logo', () => {
    const appState = {
      selectedTheme: 'science',
      data: [{ title: 'Research update', content: 'Preview content', image: 'cover.jpg' }],
      fieldMapping: { title: 'title', content: 'content', image: 'image' },
      config: {
        siteTitle: 'Signal Journal',
        logoText: 'Signal Journal',
        logoStyle: 'gradient-text',
        navbarLayout: 'normal',
        navLinks: ['home'],
        categories: [{ name: 'Research', icon: '🔬', count: 1 }]
      },
      adPlacementMode: null,
      isLocalImages: false
    };
    const gradientPreview = generator.generatePreviewHtml(appState, 'home');
    expect(gradientPreview).toContain('class="logo logo-gradient-text"');
    expect(gradientPreview).toContain('linear-gradient(100deg, #22d3ee 0%, #7c3aed 34%, #ec4899 67%, #f59e0b 100%)');
    expect(gradientPreview).not.toContain('linear-gradient(135deg, var(--color-primary), var(--color-text))');

    ['glass-sticky', 'normal', 'transparent', 'dark-fixed', 'side-drawer', 'bottom-fixed'].forEach((navbarStyle) => {
      const preview = generator.generatePreviewHtml({
        ...appState,
        config: { ...appState.config, navbarStyle }
      }, 'contact');
      const inlineScript = preview.match(/<script>([\s\S]*?)<\/script>/);
      expect(() => new Function(inlineScript[1])).not.toThrow();
      expect(preview).toContain('aria-expanded="false"');
      expect(preview).toContain("event.key === 'Escape'");
      expect(preview).toContain('function closeNavigation()');
      if (navbarStyle === 'side-drawer') {
        const nav = preview.slice(preview.indexOf('<nav'), preview.indexOf('</nav>') + 6);
        expect(nav).not.toContain('class="nav-links"');
        expect(preview).toContain('id="site-navigation-drawer" class="side-drawer-panel"');
        expect(preview).toContain('class="drawer-nav"');
      } else {
        expect(preview).toContain('id="site-navigation" class="nav-links"');
        expect(preview).toContain('href="index.html#category-research"');
      }
    });
  });

  it('keeps every generated header full-width, top-sticky, and its mobile menu attached', () => {
    expect(generatorSource).toContain('--navbar-frame-gap: 0px;');
    expect(generatorSource).toContain('--navbar-menu-offset: 0px;');
    expect(generatorSource).toMatch(/\.navbar\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;[^}]*width:\s*100%;[^}]*margin:\s*0;/);
    expect(generatorSource).toContain('position: absolute;\n        top: 100%;');
    expect(generatorSource).toContain('scroll-margin-top: calc(var(--navbar-height) + var(--navbar-scroll-offset));');
  });

  it('gives every domain twelve meaningfully different layout compositions', () => {
    const meaningfulKeys = [
      'heroEnabled', 'homeLayout', 'cardColumns', 'cardViewMode', 'navbarLayout',
      'footerStyle', 'metaLayout', 'detailLayout', 'navbarStyle', 'logoStyle',
      'cardBorder', 'cardRadius', 'cardHover', 'categoryTitleStyle',
      'categoryTitleAlign', 'heroStyle', 'detailImgStyle', 'btnStyle', 'btnSize'
    ];
    Object.keys(catalog).forEach((domainId) => {
      const variants = templates.filter((template) => template.domainId === domainId);
      const fingerprints = variants.map((template) => JSON.stringify(Object.fromEntries(
        meaningfulKeys.map((key) => [key, template.structure[key] ?? template.style[key]])
      )));
      expect(new Set(fingerprints).size).toBe(12);
    });
  });

  it('gives every domain twelve non-repeating visible template identities', () => {
    Object.keys(catalog).forEach((domainId) => {
      const variants = templates.filter((template) => template.domainId === domainId);
      expect(variants).toHaveLength(12);
      expect(new Set(variants.map((template) => template.style.selectedStyle)).size).toBe(12);
      expect(new Set(variants.map((template) => template.style.fontStyle)).size).toBe(12);
      expect(new Set(variants.map((template) => template.brand.id)).size).toBe(12);
      expect(new Set(variants.map((template) => template.brand.siteTitle.toLowerCase())).size).toBe(12);
      variants.forEach((template, index) => {
        expect(template.brand).toEqual({
          id: brands[domainId][index].id,
          siteTitle: brands[domainId][index].siteTitle,
          logoText: brands[domainId][index].logoText
        });
        expect(styles.some((style) => style.id === template.style.selectedStyle)).toBe(true);
      });
    });
  });

  it('keeps every midnight radio blueprint genuinely dark', () => {
    const darkPaletteIds = new Set(['minimaldark', 'nightflight', 'starry', 'navy', 'wine', 'tealnight', 'dark']);
    const midnightTemplates = templates.filter((template) => template.name.endsWith('·午夜电台'));
    expect(midnightTemplates.length).toBeGreaterThan(0);
    midnightTemplates.forEach((template) => {
      expect(darkPaletteIds.has(template.style.selectedStyle)).toBe(true);
    });
  });

  it('shows four populated categories in horizontal headers when the uploaded data can populate them', () => {
    const categories = [
      { name: 'Hardware', icon: '🖥️', count: 1 },
      { name: 'Software', icon: '💾', count: 1 },
      { name: 'AI & ML', icon: '🤖', count: 1 },
      { name: 'Cybersecurity', icon: '🔒', count: 1 },
      { name: 'Tech Industry', icon: '🏭', count: 1 }
    ];
    const appState = {
      selectedTheme: 'science',
      data: categories.map((category, index) => ({
        title: `${category.name} update`, content: 'Preview content', image: `cover-${index}.jpg`
      })),
      fieldMapping: { title: 'title', content: 'content', image: 'image' },
      config: { siteTitle: 'Signal Journal', logoText: 'Signal Journal', categories },
      adPlacementMode: null,
      isLocalImages: false
    };
    const preview = generator.generatePreviewHtml(appState, 'home');
    const nav = preview.slice(preview.indexOf('<nav'), preview.indexOf('</nav>') + 6);

    expect((nav.match(/<li>/g) || []).length).toBe(5);
    expect(nav).toContain('>Home</a>');
    ['Hardware', 'Software', 'AI &amp; ML', 'Cybersecurity'].forEach((name) => expect(nav).toContain(`>${name}</a>`));
    expect(nav).not.toContain('>Tech Industry</a>');
    expect(preview).toContain('id="category-cybersecurity"');
    expect(preview).toContain('id="category-tech-industry"');
  });

  it('falls back to three category links when the uploaded data cannot populate a fourth section', () => {
    const categories = [
      { name: 'Wellness', icon: '🩺', count: 1 },
      { name: 'Nutrition', icon: '🥗', count: 1 },
      { name: 'Fitness', icon: '💪', count: 1 },
      { name: 'Conditions', icon: '🧬', count: 1 }
    ];
    const appState = {
      selectedTheme: 'health',
      data: [
        { title: 'Wellness update', content: 'Preview content', image: 'one.jpg' },
        { title: 'Nutrition update', content: 'Preview content', image: 'two.jpg' },
        { title: 'Fitness update', content: 'Preview content', image: 'three.jpg' }
      ],
      fieldMapping: { title: 'title', content: 'content', image: 'image' },
      config: { siteTitle: 'Vital Journal', logoText: 'Vital Journal', categories },
      adPlacementMode: null,
      isLocalImages: false
    };
    const preview = generator.generatePreviewHtml(appState, 'home');
    const nav = preview.slice(preview.indexOf('<nav'), preview.indexOf('</nav>') + 6);

    expect((nav.match(/<li>/g) || []).length).toBe(4);
    ['Wellness', 'Nutrition', 'Fitness'].forEach((name) => expect(nav).toContain(`>${name}</a>`));
    expect(nav).not.toContain('>Conditions</a>');
  });

  it('builds four domain-aware trust pages and applies the configured contact email everywhere', () => {
    const appState = {
      selectedTheme: 'finance',
      data: [{ title: 'Market update', content: 'Example', image: 'cover.jpg' }],
      fieldMapping: { title: 'title', content: 'content', image: 'image' },
      config: {
        siteTitle: 'Northstar Markets',
        logoText: 'Northstar Markets',
        contactEmail: 'editor@northstar.example',
        categories: [
          { name: 'Market News', icon: '📈', count: 2 },
          { name: 'Personal Finance', icon: '💳', count: 6 }
        ]
      },
      adPlacementMode: null,
      isLocalImages: false
    };
    const config = generator.buildConfig(appState);
    const pages = config.theme.pages;
    const contactPreview = generator.generatePreviewHtml(appState, 'contact');

    expect(pages.about.intro).toContain('finance &amp; business');
    expect(pages.about.coverage).toContain('Market News, Personal Finance');
    expect(pages.contact.email).toBe('editor@northstar.example');
    expect(pages.privacy.full).toContain('Northstar Markets');
    expect(pages.terms.full).toContain('investment, financial, tax, or legal advice');
    expect(contactPreview).toContain('mailto:editor@northstar.example');
    expect(contactPreview).not.toContain('contact@financejournal.com');
  });

  it('uses the deployment-email placeholder when the configured email is invalid', () => {
    const config = generator.buildConfig({
      selectedTheme: 'health', data: [], fieldMapping: {},
      config: { contactEmail: 'not an email', categories: [{ name: 'Wellness', icon: '🩺', count: 2 }] },
      adPlacementMode: null, isLocalImages: false
    });
    expect(config.theme.pages.contact.email).toBe('contact@your-domain.com');
    expect(config.theme.pages.terms.full).toContain('not medical advice, diagnosis, or treatment');
  });
});
