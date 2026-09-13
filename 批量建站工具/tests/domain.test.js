import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = {};
const dataSource = readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
const domainSource = readFileSync(new URL('../js/domain.js', import.meta.url), 'utf8');
const generatorSource = readFileSync(new URL('../js/generator.js', import.meta.url), 'utf8');
vm.runInNewContext(`${dataSource}\nthis.__catalog = DOMAIN_CATALOG; this.__templates = TEMPLATE_PRESETS; this.__styles = STYLE_PRESETS; this.__brands = BRAND_PRESETS; this.__logoIconGroups = LOGO_ICON_GROUPS; this.__logoIconDefaults = LOGO_ICON_DEFAULTS; this.__categoryEmojiPools = DOMAIN_CATEGORY_EMOJI_POOLS; this.__themes = THEMES; this.__iconSets = ICON_SET_PRESETS;`, context);
vm.runInNewContext(domainSource, context);
vm.runInNewContext(`${generatorSource}\nthis.__generator = Generator;`, context);

const { DomainEngine, __catalog: catalog, __templates: templates, __styles: styles, __brands: brands, __logoIconGroups: logoIconGroups, __logoIconDefaults: logoIconDefaults, __categoryEmojiPools: categoryEmojiPools, __themes: themes, __iconSets: iconSets, __generator: generator } = context;

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

  it('provides five valid blueprints for every supported domain', () => {
    const templateIds = new Set(templates.map((template) => template.id));
    expect(Object.keys(catalog)).toHaveLength(32);
    expect(templates).toHaveLength(160);
    Object.values(catalog).forEach((profile) => {
      expect(profile.blueprints).toHaveLength(5);
      profile.blueprints.forEach((id) => expect(templateIds.has(id)).toBe(true));
    });
  });

  it('uses food-specific blueprints with regular navigation and Hero disabled by default', () => {
    const foodTemplates = templates.filter((template) => template.domainId === 'food');
    expect(foodTemplates.map((template) => template.name)).toEqual([
      '美食·食谱厨房', '美食·餐桌灵感', '美食·时令食材', '美食·餐馆指南', '美食·甜点画册'
    ]);
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

    expect(new Set(ids).size).toBe(160);
    expect(new Set(names).size).toBe(160);
    expect(new Set(signatures).size).toBe(160);
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

  it('uses a 24-item Emoji category pool and 50 rebuilt combinations for every domain', () => {
    const oldAbstractSymbols = new Set(['◆','○','△','□','◇','◎','◉','◒','◫','▦','⊕','⌁','※','✦','↗','▤','♟️','🪙']);
    expect(Object.keys(categoryEmojiPools)).toHaveLength(32);
    Object.keys(catalog).forEach((domainId) => {
      const pool = categoryEmojiPools[domainId];
      expect(pool).toHaveLength(24);
      expect(new Set(pool).size).toBe(24);
      pool.forEach((icon) => expect(oldAbstractSymbols.has(icon)).toBe(false));
      expect(Array.from(themes[domainId].iconPool)).toEqual(Array.from(pool));
      expect(iconSets[domainId]).toHaveLength(50);
      iconSets[domainId].forEach((set) => {
        set.icons.forEach((icon) => expect(pool).toContain(icon));
      });
    });
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
