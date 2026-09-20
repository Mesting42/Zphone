import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import vm from 'node:vm';

class ZipMock {
  constructor(prefix = '', root = null) { this.prefix = prefix; this.root = root || { files: {} }; }
  folder(name) { return new ZipMock(this.prefix + name + '/', this.root); }
  file(name, content) { this.root.files[this.prefix + name] = content; return this; }
  async generateAsync() { globalThis.__legacyGeneratedFiles = this.root.files; return new Blob(['ok']); }
}

const context = { JSZip: ZipMock, Blob, Response, DecompressionStream, TextDecoder, setTimeout: (callback) => callback() };
const source = (name) => readFileSync(new URL('../js/' + name, import.meta.url), 'utf8');
vm.runInNewContext(source('data.js') + '\nthis.__themes = THEMES;', context);
vm.runInNewContext(source('domain.js'), context);
vm.runInNewContext(source('ad-migration.js') + '\nthis.__migration = AdMigration;', context);
vm.runInNewContext(source('generator.js') + '\nthis.__generator = Generator;', context);

const legacyEntries = [
  { path: 'old-site/js/ad.js', text: [
    'const bannerPath1 = "/100/banner-1";', 'const bannerPath2 = "/100/banner-2";',
    'const bannerPath3 = "/100/banner-3";', 'const bannerPath4 = "/100/banner-4";',
    'const interstitialPath = "/100/interstitial";', 'const anchorPath = "/100/anchor";',
    'const analyticsID = "G-NEWS123";'
  ].join('\n') },
  { path: 'old-site/index.html', text: '<div id="div-gpt-ad-banner1"></div><div id="div-gpt-ad-banner2"></div><div id="div-gpt-ad-banner3"></div>' },
  { path: 'old-site/details/article1.html', text: '<div id="div-gpt-ad-banner1"></div><div id="div-gpt-ad-banner2"></div><div id="div-gpt-ad-banner3"></div>' }
];

function createTar(entries) {
  const encoder = new TextEncoder();
  const encoded = entries.map((entry) => ({ path: entry.path, body: encoder.encode(entry.text) }));
  const length = encoded.reduce((total, entry) => total + 512 + Math.ceil(entry.body.length / 512) * 512, 1024);
  const archive = new Uint8Array(length);
  let offset = 0;
  encoded.forEach((entry) => {
    const header = archive.subarray(offset, offset + 512);
    header.set(encoder.encode(entry.path), 0);
    header.set(encoder.encode(entry.body.length.toString(8).padStart(11, '0') + '\0'), 124);
    header[156] = '0'.charCodeAt(0);
    archive.set(entry.body, offset + 512);
    offset += 512 + Math.ceil(entry.body.length / 512) * 512;
  });
  return archive;
}

function namedArchive(bytes, name) {
  const archive = new Blob([bytes], { type: 'application/gzip' });
  Object.defineProperty(archive, 'name', { value: name });
  return archive;
}

function createState(mode = 'normal', migration = null) {
  const categories = context.__themes.game.categories.map((category) => ({ ...category, count: 1 }));
  return {
    selectedTheme: 'game',
    data: [
      { id: 1, title: 'New source title one', description: 'New source body one.', image: 'https://images.example.com/one.jpg' },
      { id: 2, title: 'New source title two', description: 'New source body two.', image: 'https://images.example.com/two.jpg' },
      { id: 3, title: 'New source title three', description: 'New source body three.', image: 'https://images.example.com/three.jpg' }
    ],
    fieldMapping: { id: 'id', title: 'title', content: 'description', image: 'image' },
    isLocalImages: false,
    localImages: {},
    siteBuildMode: mode,
    legacyAdMigration: migration,
    config: {
      siteTitle: 'New Source News', logoText: 'New Source News', categories,
      cardFields: ['image', 'title'], relatedCardFields: ['image', 'title'], relatedCount: 2,
      adPlacements: { adv1: { home: 'content-top' } }, adPaths: { bannerPath1: '/manual/should-not-export' }
    }
  };
}

function count(source, pattern) { return (source.match(new RegExp(pattern, 'g')) || []).length; }

describe('legacy ad migration', () => {
  it('uses the configured excerpt line limit in home-card CSS and supports full text', () => {
    const state = createState();
    state.fieldMapping.excerpt = 'description';
    state.config.cardFields = ['image', 'title', 'excerpt'];
    state.config.cardExcerptLines = '2';
    const compactPreview = context.__generator.generatePreviewHtml(state, 'home');
    const compactCardCss = compactPreview.match(/\.item-card \.card-desc \{[^}]*\}/)[0];
    expect(compactPreview).toContain('class="card-desc"');
    expect(compactPreview).not.toContain('class="card-excerpt"');
    expect(compactCardCss).toContain('-webkit-line-clamp: 2');
    expect(compactCardCss).toContain('max-height: 3.1em');
    expect(compactCardCss).toContain('min-height: 3.1em');
    expect(context.__generator.buildConfig(state).style.cardExcerptLines).toBe('2');

    state.config.cardExcerptLines = 'none';
    const fullPreview = context.__generator.generatePreviewHtml(state, 'home');
    const fullCardCss = fullPreview.match(/\.item-card \.card-desc \{[^}]*\}/)[0];
    expect(fullCardCss).not.toContain('-webkit-line-clamp');
    expect(fullCardCss).not.toContain('min-height');
  });

  it('renders each Back to Home option distinctly in both preview and exported detail pages', async () => {
    const cases = [
      ['text', 'class="back-link"', '← Back to Home'],
      ['breadcrumb', 'class="back-link breadcrumb"', 'breadcrumb-current">Article'],
      ['button', 'class="back-link button"', '← Back to Home'],
      ['minimal', 'class="back-link minimal"', 'back-link-arrow'],
      ['underline', 'class="back-link underline"', '← Back to Home'],
      ['outline', 'class="back-link outline"', '← Back to Home'],
      ['pill', 'class="back-link pill"', '← Back to Home'],
      ['icon', 'class="back-link icon"', 'back-link-label">Back to Home'],
      ['glass', 'class="back-link glass"', '← Back to Home']
    ];
    for (const [style, marker, label] of cases) {
      const state = createState();
      state.config.backLinkStyle = style;
      const preview = context.__generator.generatePreviewHtml(state, 'detail');
      expect(preview).toContain(marker);
      expect(preview).toContain(label);
      await context.__generator.exportWebsite(state, () => {});
      expect(globalThis.__legacyGeneratedFiles['website/details/article1.html']).toContain(marker);
    }
  });

  it('turns a subdomain TXT ad export into a validated generated-ad configuration', () => {
    const txt = `
      googletag.defineSlot('/23334460889/zp0903a.vibory.pro-banner1', [[300, 250]], 'one').addService(googletag.pubads());
      googletag.defineSlot('/23334460889/zp0903a.vibory.pro-banner2', [[300, 250]], 'two').addService(googletag.pubads());
      googletag.defineSlot('/23334460889/zp0903a.vibory.pro-banner3', [[300, 250]], 'three').addService(googletag.pubads());
      googletag.defineSlot('/23334460889/zp0903a.vibory.pro-INT', [[320, 480]], 'four').addService(googletag.pubads());
      googletag.defineSlot('/23334460889/zp0903a.vibory.pro-ANC', [320, 50], 'five').addService(googletag.pubads());
      gtag('config', 'G-Z5JQ643FJG');`;
    const result = context.__migration.inspectAdCodeText(txt, 'zp0903a.vibory.pro.txt');
    expect(result.valid).toBe(true);
    expect(result.detectedHost).toBe('zp0903a.vibory.pro');
    expect(result.config).toMatchObject({
      bannerPath1: '/23334460889/zp0903a.vibory.pro-banner1',
      bannerPath2: '/23334460889/zp0903a.vibory.pro-banner2',
      bannerPath3: '/23334460889/zp0903a.vibory.pro-banner3',
      bannerPath4: '',
      interstitialPath: '/23334460889/zp0903a.vibory.pro-INT',
      anchorPath: '/23334460889/zp0903a.vibory.pro-ANC',
      analyticsID: 'G-Z5JQ643FJG'
    });
    const state = createState();
    state.adCodeMigration = result;
    const config = context.__generator.buildConfig(state);
    expect(config.siteBuildMode).toBe('ad-migration');
    expect(config.adPlacements).toEqual(context.__migration.fixedPlacements());
    expect(config.adPaths.analyticsID).toBe('G-Z5JQ643FJG');
  });

  it('keeps bannerPath4 empty through the archive-based ad-migration export workflow', async () => {
    const threeBannerEntries = [
      {
        ...legacyEntries[0],
        text: legacyEntries[0].text.replace(/\r?\nconst bannerPath4 = "\/100\/banner-4";/, '')
      },
      ...legacyEntries.slice(1)
    ];
    const migration = context.__migration.inspectEntries(threeBannerEntries);
    expect(migration.valid).toBe(true);
    expect(migration.config.bannerPath4).toBe('');

    await context.__generator.exportWebsite(createState('ad-migration', migration), () => {});
    const runtime = globalThis.__legacyGeneratedFiles['website/js/ad.js'];
    expect(runtime).toContain('const bannerPath4 = "";');
    expect(runtime).not.toContain('const bannerPath4 = "/100/banner-3";');
  });

  it('uses manual ad placements in the normal-mode preview only', async () => {
    const state = createState();
    const preview = context.__generator.generatePreviewHtml(state, 'home');
    expect(preview).toContain('div-gpt-ad-banner1');

    const exportConfig = context.__generator.buildConfig(state);
    expect(exportConfig.adPlacements).toEqual({});
    await context.__generator.exportWebsite(state, () => {});
    expect(globalThis.__legacyGeneratedFiles['website/index.html']).not.toContain('div-gpt-ad-banner1');
  });

  it('uses the in-app notice dialog instead of browser alert prompts', () => {
    const app = source('app.js');
    const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(app).toContain('function showNotice(message, title)');
    expect(app).toContain('function showConfirm(message, title, confirmLabel, callback)');
    expect(app).not.toMatch(/\balert\s*\(/);
    expect(app).not.toMatch(/\bconfirm\s*\(/);
    expect(page).toContain('id="notice-overlay"');
    expect(page).toContain('role="alertdialog"');
    expect(page).toContain('class="btn-reupload-icon"');
    expect(page).toContain('M12 16V4');
    expect(page).not.toContain('M20 11a8 8 0 1 0 2 5.2');
    expect(page).toContain('id="ad-placement-group"');
    expect(page).toContain('id="ad-auto-placement-note"');
    expect(app).toContain('function syncDirectAdPlacementUI()');
  });

  it('keeps featured home grids balanced for three, four, and six items', () => {
    [3, 4, 6].forEach((count) => {
      const state = createState();
      state.config.homeLayout = 'featured';
      state.config.categories = [{ name: 'Latest', icon: '•', count }];
      state.data = Array.from({ length: count }, (_, index) => ({
        id: index + 1,
        title: 'Article ' + (index + 1),
        description: 'Article summary.',
        image: 'https://images.example.com/' + index + '.jpg'
      }));
      const preview = context.__generator.generatePreviewHtml(state, 'home');
      expect(preview).toContain('items-grid item-count-' + count);
    });
    const preview = context.__generator.generatePreviewHtml(createState(), 'home');
    expect(preview).toContain('items-grid:not(.item-count-3):not(.item-count-4):not(.item-count-6)');
    expect(preview).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;');
    expect(preview).toContain('grid-template-columns: repeat(3, minmax(0, 1fr)) !important;');
  });

  it('recognizes a nested old-site archive and reports structural failures clearly', () => {
    const result = context.__migration.inspectEntries(legacyEntries);
    expect(result.valid).toBe(true);
    expect(result.config.bannerPath3).toBe('/100/banner-3');
    expect(result.detectedFiles.home).toBe('old-site/index.html');

    const failed = context.__migration.inspectEntries([{ path: 'js/ad.js', text: 'const bannerPath1 = "/only-one";' }]);
    expect(failed.valid).toBe(false);
    expect(failed.errors.map((item) => item.code)).toContain('HOME_STRUCTURE_INVALID');
    expect(failed.errors.map((item) => item.code)).toContain('DETAIL_STRUCTURE_INVALID');
  });

  it('reads a BaoTa-style .tar.gz archive entirely in the browser', async () => {
    const tar = createTar(legacyEntries);
    const directTar = context.__migration.inspectTarBytes(tar);
    expect(directTar.valid).toBe(true);
    expect(directTar.detectedFiles.adJs).toBe('old-site/js/ad.js');

    const compressed = namedArchive(gzipSync(tar), 'zp0903b.snulash.com_L8KZd.tar.gz');
    const result = await context.__migration.inspectArchive(compressed);
    expect(result.valid).toBe(true);
    expect(result.config.analyticsID).toBe('G-NEWS123');

    const tgzResult = await context.__migration.inspectArchive(namedArchive(gzipSync(tar), 'old-site.tgz'));
    expect(tgzResult.valid).toBe(true);
  });

  it('keeps ordinary exports free of migrated ads and validates every migrated page before packaging', async () => {
    const ordinaryState = createState();
    await context.__generator.exportWebsite(ordinaryState, () => {});
    const ordinary = globalThis.__legacyGeneratedFiles;
    ['website/index.html', 'website/contact.html', 'website/details/article1.html'].forEach((path) => {
      expect(ordinary[path]).toContain('<style data-generated-site-style>');
      expect(ordinary[path]).toContain('--color-bg:');
    });
    expect(ordinary['website/index.html']).toContain('href="css/style.css"');
    expect(ordinary['website/details/article1.html']).toContain('href="../css/style.css"');
    expect(ordinary['website/css/style.css']).toContain('--color-bg:');
    const ordinaryNav = ordinary['website/index.html'].slice(ordinary['website/index.html'].indexOf('<nav'), ordinary['website/index.html'].indexOf('</nav>') + 6);
    const ordinaryFooter = ordinary['website/index.html'].slice(ordinary['website/index.html'].indexOf('<footer'));
    expect((ordinaryNav.match(/<li>/g) || []).length).toBe(Math.min(ordinaryState.config.categories.length, 3) + 1);
    expect(ordinaryNav).toContain('>Home</a>');
    expect(ordinaryNav).not.toContain('Privacy Policy');
    expect(ordinaryNav).toMatch(/href="#category-[a-z0-9-]+"/);
    expect(ordinary['website/index.html']).toMatch(/<section id="category-[a-z0-9-]+" class="category-section">/);
    expect(ordinaryFooter).toContain('href="privacy.html"');
    expect(ordinaryFooter).toContain('href="terms.html"');
    expect(ordinaryFooter).toContain('href="contact.html"');
    expect(ordinaryFooter).toContain('href="about.html"');
    expect(ordinary['website/index.html']).not.toContain('securepubads.g.doubleclick.net');
    expect(ordinary['website/index.html']).not.toContain('div-gpt-ad-banner1');
    expect(ordinary['website/js/ad.js']).toBeUndefined();

    const migration = context.__migration.inspectEntries(legacyEntries);
    const migrationPreview = context.__generator.generatePreviewHtml(createState('ad-migration', migration), 'home');
    expect(count(migrationPreview, '>advertisement</div>')).toBe(3);
    await context.__generator.exportWebsite(createState('ad-migration', migration), () => {});
    const migrated = globalThis.__legacyGeneratedFiles;
    const home = migrated['website/index.html'];
    const detail = migrated['website/details/article1.html'];
    const migratedNav = home.slice(home.indexOf('<nav'), home.indexOf('</nav>') + 6);
    expect((migratedNav.match(/<li>/g) || []).length).toBe(Math.min(ordinaryState.config.categories.length, 3) + 1);
    expect(migratedNav).toContain('>Home</a>');
    expect(migratedNav).not.toContain('Contact Us');
    expect(detail).toMatch(/href="\.\.\/index\.html#category-[a-z0-9-]+"/);
    expect(count(home, 'securepubads\\.g\\.doubleclick\\.net/tag/js/gpt\\.js')).toBe(1);
    expect(count(home, 'src="js/ad\\.js\\?v=20260919-ad-runtime-init-1-[a-z0-9]+"')).toBe(1);
    expect(count(detail, 'securepubads\\.g\\.doubleclick\\.net/tag/js/gpt\\.js')).toBe(1);
    expect(count(detail, 'src="\\.\\./js/ad\\.js\\?v=20260919-ad-runtime-init-1-[a-z0-9]+"')).toBe(1);
    expect(count(home, '>advertisement</div>')).toBe(3);
    expect(count(detail, '>advertisement</div>')).toBe(3);
    expect(home).toContain('color:var(--color-text,#111)');
    ['banner1', 'banner2', 'banner3'].forEach((name) => {
      expect(count(home, 'id="div-gpt-ad-' + name + '"')).toBe(1);
      expect(count(detail, 'id="div-gpt-ad-' + name + '"')).toBe(1);
    });
    expect(home.indexOf('div-gpt-ad-banner1')).toBeGreaterThan(home.indexOf('</nav>'));
    expect(home.indexOf('div-gpt-ad-banner1')).toBeLessThan(home.indexOf('div-gpt-ad-banner2'));
    expect(home.indexOf('div-gpt-ad-banner2')).toBeLessThan(home.indexOf('div-gpt-ad-banner3'));
    expect(detail.indexOf('div-gpt-ad-banner1')).toBeLessThan(detail.indexOf('class="detail-page"'));
    expect(detail.indexOf('div-gpt-ad-banner2')).toBeGreaterThan(detail.indexOf('class="detail-content"'));
    expect(detail.indexOf('div-gpt-ad-banner3')).toBeGreaterThan(detail.indexOf('class="related-section"'));
    const generatedAdRuntime = migrated['website/js/ad.js'];
    expect(generatedAdRuntime).toContain('"/100/banner-1"');
    expect(generatedAdRuntime).toContain("var detailPathSegments = window.location.pathname.toLowerCase().split('/');");
    expect(generatedAdRuntime).not.toContain('var isDetail = //');
    expect(generatedAdRuntime).toContain('function initializeBannerObservers()');
    expect(generatedAdRuntime).toContain("document.addEventListener('DOMContentLoaded', initializeBannerObservers, { once: true });");
    expect(generatedAdRuntime).not.toContain("window.addEventListener('load'");
    expect(() => new Function(generatedAdRuntime)).not.toThrow();
    expect(migrated['website/generate_details.py']).toBeUndefined();
    expect(migrated['website/AD_MIGRATION_REGENERATION.txt']).toContain('详情页必须使用本建站工具重新导出');
    expect(migrated['website/data.json']).toContain('New source title one');
    expect(migrated['website/data.json']).not.toContain('old-site/');
    expect(home).not.toContain('old-site/');
  });
});
