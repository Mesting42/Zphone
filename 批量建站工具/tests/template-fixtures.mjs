// 模板回归共用真实生成器；ZIP 记录器让全目录检查不重复压缩同一份图片。
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Reuse compiled source across catalog exports, while creating a fresh global
// context for each builder. The 36 original SVGs need not be parsed thousands
// of times; source text remains the key so edits cannot reuse stale code.
const compiledSources = new Map();
function runSource(source, context) {
  if (!compiledSources.has(source)) compiledSources.set(source, new vm.Script(source));
  compiledSources.get(source).runInNewContext(context);
}

export function loadBuilder(game = false, registeredPackages = false, deterministic = false) {
  let files = {};
  class RecordingZip {
    constructor(prefix = '', root = {}) { this.prefix = prefix; this.root = root; }
    folder(name) { return new RecordingZip(this.prefix + name + '/', this.root); }
    file(name, value) { this.root[this.prefix + name] = value; return this; }
    async generateAsync() {
      // Real ZIP generation is asynchronous. Let worker RPC acknowledgements
      // run between recorded exports instead of starving them with microtasks.
      await new Promise(done => setImmediate(done));
      files = this.root; return new Blob(['fixture']);
    }
  }
  const context = { console, Blob, URL, TextDecoder, JSZip: RecordingZip, setTimeout: callback => callback(), window: {} };
  // Paired whole-export comparisons need the same recommendation/shuffle draws.
  // Normal tests and the product keep their original randomness.
  if (deterministic) context.Math = Object.assign(Object.create(Math), { random: () => 0.5 });
  const source = (name, shared = false) => readFileSync(new URL('../' + (game && !shared ? 'game-builder/' : '') + 'js/' + name, import.meta.url), 'utf8');
  runSource(source('template-catalog.js', true) + source('template-layouts.js', true) + source('navbar-layout.js', true) + source('data.js') +
    '\nthis.themes = THEMES; this.presets = ' + (game ? 'LAYOUT_PRESETS;' : 'TEMPLATE_PRESETS; this.domains = DOMAIN_CATALOG;'), context);
  // Existing regression fixtures keep their original catalog. Package tests opt
  // into the exact generated classic script used by the production tool.
  if (registeredPackages) {
    if (game) throw new Error('Independent editorial packages are not installed in the game builder');
    runSource(source('template-packages.js', true), context);
  }
  runSource(source('configuration-controls.js', true) + source('site-motion.js', true) + source('ad.js') + source('ad-migration.js') + source('generator.js') +
    '\nthis.generator = Generator; this.migration = AdMigration;', context);
  runSource(source('export-preflight.js', true), context);
  const paths = Object.fromEntries(['bannerPath1', 'bannerPath2', 'bannerPath3', 'bannerPath4', 'interstitialPath', 'anchorPath', 'analyticsID']
    .map((key, index) => [key, key === 'analyticsID' ? 'G-TEMPLATE123' : '/123456/template.example.com-' + ['banner1', 'banner2', 'banner3', 'banner4', 'interstitial', 'anchor'][index]]));
  const migration = context.migration.inspectEntries([
    { path: 'old/js/ad.js', text: Object.entries(paths).map(([key, value]) => `const ${key} = "${value}";`).join('\n') },
    { path: 'old/index.html', text: '<div id="div-gpt-ad-banner1"></div><div id="div-gpt-ad-banner2"></div><div id="div-gpt-ad-banner3"></div>' },
    { path: 'old/details/article1.html', text: '<div id="div-gpt-ad-banner1"></div><div id="div-gpt-ad-banner2"></div><div id="div-gpt-ad-banner3"></div>' }
  ]);
  if (!migration.valid) throw new Error('Advertising fixture must pass the real code parser');
  return { ...context, game, paths, migrationFixture: migration, files: () => files };
}

export function createState(builder, preset = builder.presets[0], mode = 'code') {
  const domain = builder.game ? 'game' : preset.domainId;
  const profile = builder.TemplateCatalog.getDomain(domain);
  const titles = builder.game
    ? ['Orbit Runner', 'Circuit Sprint', 'Pixel Trails', 'Gravity Blocks', 'Vector Rally', 'Crystal Route']
    : ['How the system works', 'A practical guide to the essentials', 'The ideas behind the latest changes', 'Understanding the trade-offs', 'From concept to everyday use', 'Where to explore next'];
  const data = Array.from({ length: 20 }, (_, index) => ({ id: index + 1,
    title: (builder.game ? '' : profile.eyebrow + ': ') + titles[index % titles.length],
    content: 'Explore the key concepts, their real-world context, and a clear explanation of how they connect. This sample provides enough text to check line wrapping and card alignment.',
    image: 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><rect width="800" height="500" fill="${['#143a50', '#285e69', '#342e5c', '#205442'][index % 4]}"/><circle cx="${250 + index % 3 * 90}" cy="240" r="160" fill="none" stroke="#8ccce2" stroke-width="12"/><path d="M0 400L800 100M0 480L800 180" stroke="#fff" opacity=".25" stroke-width="40"/><text x="40" y="65" fill="#fff" font-size="24" font-family="sans-serif">${profile.eyebrow.replaceAll('&', '&amp;')}</text></svg>`).toString('base64'),
    url: 'https://games.example.com/play-' + index
  }));
  const state = { selectedTheme: domain, data, siteBuildMode: 'normal',
    fieldMapping: { id: 'id', title: 'title', content: 'content', excerpt: 'content', image: 'image', store_url: 'url' },
    isLocalImages: false, localImages: {}, adJsVersion: 'v1.0.2', adPlacementMode: null,
    config: { ...preset.structure, ...preset.style, ...preset.brand, templateId: preset.id,
      ...(builder.game ? { layoutTemplate: preset.id, siteTitle: 'Vector Arcade' } : {}),
      categories: builder.themes[domain].categories.slice(0, 3).map(category => ({ ...category, count: 6 })),
      cardFields: ['image', 'title', builder.game ? 'content' : 'excerpt'], relatedCardFields: ['image', 'title'], relatedCount: 2,
      contactEmail: 'editor@example.com', allArticlesEnabled: true, allGamesEnabled: true, heroEnabled: false,
      adPlacements: { adv1: { home: 'cat-0-between-0-1', detail: 'detail-before-content' },
        adv2: { home: 'after-section-0', detail: 'detail-before-related' }, adv3: { home: 'content-bottom', detail: 'detail-after-related' } }
    }
  };
  if (mode === 'code') state.adCodeMigration = builder.migrationFixture;
  if (mode === 'migration') { state.siteBuildMode = 'ad-migration'; state.legacyAdMigration = builder.migrationFixture; }
  if (mode === 'manual' || mode === 'fixed') { state.normalAdMode = 'reserve'; state.reservePlacementMode = mode; }
  return state;
}
