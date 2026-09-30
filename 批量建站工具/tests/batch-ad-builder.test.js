import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import JSZip from 'jszip';

class ZipMock {
  constructor(prefix = '', root = null) { this.prefix = prefix; this.root = root || { files: {} }; }
  folder(name) { return new ZipMock(this.prefix + name + '/', this.root); }
  file(name, content) { this.root.files[this.prefix + name] = content; return this; }
  async generateAsync() { globalThis.__batchGeneratedFiles = this.root.files; return new Blob(['ok']); }
}

const source = (name) => readFileSync(new URL('../js/' + name, import.meta.url), 'utf8');
const context = { JSZip: ZipMock, Blob, URL, TextDecoder, window: {}, setTimeout: (callback) => callback() };
vm.runInNewContext(source('ad.js'), context);
vm.runInNewContext(source('template-catalog.js') + source('template-layouts.js') + source('navbar-layout.js') + source('data.js') + '\nthis.__themes = THEMES; this.__templates = TEMPLATE_PRESETS;', context);
vm.runInNewContext(source('archive-naming.js'), context);
context.ArchiveNaming = context.window.ArchiveNaming;
vm.runInNewContext(source('ad-migration.js') + '\nthis.__migration = AdMigration;', context);
vm.runInNewContext(source('generator.js') + '\nthis.__generator = Generator;', context);
vm.runInNewContext(source('batch-ad-builder.js') + '\nthis.__batch = BatchAdBuilder;', context);

function code(host, id) {
  return Object.assign({ id, fileName: host + '.txt' }, context.__migration.inspectAdCodeText([
    `googletag.defineSlot('/publisher/${host}-banner1', [300, 250], 'div-gpt-ad-banner1');`,
    `googletag.defineSlot('/publisher/${host}-banner2', [300, 250], 'div-gpt-ad-banner2');`,
    `googletag.defineSlot('/publisher/${host}-banner3', [300, 250], 'div-gpt-ad-banner3');`,
    `googletag.defineSlot('/publisher/${host}-int', [1, 1], 'div-int');`,
    `googletag.defineSlot('/publisher/${host}-anc', [1, 1], 'div-anc');`,
    `gtag('config', 'G-${host.replace(/[^a-z0-9]/gi, '').toUpperCase()}');`
  ].join('\n'), host + '.txt'));
}

function site(id, codeId) {
  return {
    id, codeId, fileName: id + '.json',
    data: [{ id: 1, title: 'Title', description: 'Body', image: 'https://example.com/a.jpg' }],
    jsonFields: [{ name: 'id', type: 'number' }, { name: 'title', type: 'string' }, { name: 'description', type: 'string' }, { name: 'image', type: 'string' }],
    fieldMapping: { id: 'id', title: 'title', content: 'description', image: 'image' }
  };
}

describe('batch ad build guards', () => {
  it('preserves each new domain template and the icon preference in batch exports', async () => {
    for (const [index, domainId] of ['tech', 'food', 'science', 'general'].entries()) {
      const template = context.__templates.find(item => item.domainId === domainId && item.variant === 13 + index);
      const adCode = code('new-' + domainId + '.example.com', domainId);
      const sourceSite = Object.assign(site(domainId, domainId), {
        themeId: domainId,
        config: { ...template.structure, ...template.style, ...template.brand, templateId: template.id,
          categoryIconsEnabled: false, categories: context.__themes[domainId].categories,
          cardFields: ['image', 'title'], relatedCardFields: ['image', 'title'], relatedCount: 1 }
      });
      const state = context.__batch.createSiteState({ selectedTheme: 'game', siteBuildMode: 'batch-ad-build', adJsVersion: 'v1.0.2' }, sourceSite, adCode);
      expect(state.config.templateId).toBe(template.id);
      expect(state.selectedTheme).toBe(domainId);
      await context.__generator.exportWebsite(state, () => {});
      const files = globalThis.__batchGeneratedFiles;
      expect(context.__batch.validateGeneratedSiteFiles(files, adCode).valid).toBe(true);
      expect(files['website/index.html']).toContain('data-template-layout="' + template.structure.homeLayout + '"');
      expect(files['website/index.html']).not.toContain('class="category-title-icon"');
      expect(files['website/js/ad.js']).toContain('ad.js v1.0.2');
      expect(files['website/js/ad.js']).toContain(adCode.config.bannerPath1);
    }
  });

  it('blocks a TXT assignment reused by two generated sites', () => {
    const shared = code('site-one', 'one');
    const report = context.__batch.validateAssignments([site('a', 'one'), site('b', 'one')], [shared]);
    expect(report.valid).toBe(false);
    expect(report.errors.some((entry) => entry.code === 'BATCH_AD_CODE_REUSED')).toBe(true);
  });

  it('blocks different TXT files that contain the same advertising unit', () => {
    const first = code('same-unit', 'one');
    const duplicate = Object.assign({}, first, { id: 'two', fileName: 'copy.txt' });
    const report = context.__batch.validateAssignments([site('a', 'one'), site('b', 'two')], [first, duplicate]);
    expect(report.valid).toBe(false);
    expect(report.errors.some((entry) => entry.code === 'BATCH_AD_UNIT_DUPLICATE')).toBe(true);
  });

  it('blocks two same-domain sites from exporting with the same template', () => {
    const first = code('site-one', 'one');
    const second = code('site-two', 'two');
    const firstSite = Object.assign(site('a', 'one'), { config: { templateId: 'medical-blueprint-01' } });
    const secondSite = Object.assign(site('b', 'two'), { config: { templateId: 'medical-blueprint-01' } });
    const report = context.__batch.validateAssignments([firstSite, secondSite], [first, second]);
    expect(report.valid).toBe(false);
    expect(report.errors.some((entry) => entry.code === 'BATCH_TEMPLATE_REUSED')).toBe(true);
  });

  it('accepts one distinct valid code per site and preserves its paths in the generated runtime', async () => {
    const first = code('site-one', 'one');
    const second = code('site-two', 'two');
    const report = context.__batch.validateAssignments([site('a', 'one'), site('b', 'two')], [first, second]);
    expect(report.valid).toBe(true);

    const sourceSite = site('a', 'one');
    const state = context.__batch.createSiteState({
      selectedTheme: 'game', siteBuildMode: 'batch-ad-build', data: sourceSite.data,
      fieldMapping: sourceSite.fieldMapping, config: { siteTitle: 'Batch Site', logoText: 'Batch Site', categories: context.__themes.game.categories, cardFields: ['image', 'title'], relatedCardFields: ['image', 'title'], relatedCount: 1 }
    }, sourceSite, first);
    expect(state.directAdPlacementMode).toBe('fixed');
    await context.__generator.exportWebsite(state, () => {});
    const checked = context.__batch.validateGeneratedSiteFiles(globalThis.__batchGeneratedFiles, first);
    expect(checked.valid).toBe(true);
    expect(globalThis.__batchGeneratedFiles['website/js/ad.js']).toContain(first.config.bannerPath1);
    expect(globalThis.__batchGeneratedFiles['website/js/ad.js']).toContain('ad.js v1.0.2.1');
    expect(globalThis.__batchGeneratedFiles['website/js/ad.js']).toContain('const enableLazyLoad = true;');
    expect(globalThis.__batchGeneratedFiles['website/js/ad.js']).toContain('interstitialSlot.setConfig({');
  });

  it('uses shared manual code placements in preview and export while allowing a site override', async () => {
    const firstCode = code('placement-one', 'placement-one');
    const secondCode = code('placement-two', 'placement-two');
    const globalPlacements = {
      adv1: { home: 'footer-top', detail: 'detail-before-content' },
      adv2: { home: 'content-top', detail: 'detail-after-content' },
      adv3: { home: 'after-navbar', detail: 'footer-top' }
    };
    const overridePlacements = {
      adv1: { home: 'after-navbar', detail: 'detail-after-content' },
      adv2: { home: 'footer-top', detail: 'detail-before-content' },
      adv3: { home: 'content-top', detail: 'footer-top' }
    };
    const firstSite = site('placement-first', 'placement-one');
    const sharedSecondSite = site('placement-shared-second', 'placement-two');
    const secondSite = Object.assign(site('placement-second', 'placement-two'), {
      codePlacementOverrideEnabled: true,
      codePlacementSettings: { placementMode: 'manual', adPlacements: overridePlacements }
    });
    const batch = {
      adMode: 'code',
      sites: [firstSite, secondSite],
      codePlacementDefaults: { placementMode: 'manual', adPlacements: globalPlacements }
    };
    const base = {
      selectedTheme: 'game', siteBuildMode: 'batch-ad-build',
      config: { siteTitle: 'Placement Site', logoText: 'Placement Site', categories: context.__themes.game.categories, cardFields: ['image', 'title'], relatedCardFields: ['image', 'title'], relatedCount: 1 }
    };
    const firstState = context.__batch.createSiteState(base, firstSite, firstCode, batch);
    const secondState = context.__batch.createSiteState(base, secondSite, secondCode, batch);

    expect(firstState.directAdPlacementMode).toBe('manual');
    expect(firstState.config.adCodePlacements).toEqual(globalPlacements);
    expect(secondState.config.adCodePlacements).toEqual(overridePlacements);
    expect(context.__batch.resolveCodePlacementSettings(batch, firstSite).adPlacements).toEqual(globalPlacements);
    expect(context.__batch.resolveCodePlacementSettings(batch, sharedSecondSite).adPlacements).toEqual(globalPlacements);
    expect(context.__batch.resolveCodePlacementSettings(batch, secondSite).adPlacements).toEqual(overridePlacements);

    const sharedPreview = context.__generator.generatePreviewHtml(firstState, 'home');
    const sharedDetailPreview = context.__generator.generatePreviewHtml(firstState, 'detail', 0);
    expect(sharedPreview.indexOf('id="adv3"')).toBeLessThan(sharedPreview.indexOf('id="adv2"'));
    expect(sharedPreview.indexOf('id="adv2"')).toBeLessThan(sharedPreview.indexOf('id="adv1"'));
    expect(sharedDetailPreview.indexOf('id="adv1"')).toBeLessThan(sharedDetailPreview.indexOf('id="adv2"'));
    expect(sharedDetailPreview.indexOf('id="adv2"')).toBeLessThan(sharedDetailPreview.indexOf('id="adv3"'));

    await context.__generator.exportWebsite(firstState, () => {});
    const sharedExport = globalThis.__batchGeneratedFiles['website/index.html'];
    const sharedDetailExport = Object.entries(globalThis.__batchGeneratedFiles).find(([path]) => /^website\/details\/.*\.html?$/i.test(path))[1];
    expect(sharedExport.indexOf('id="adv3"')).toBeLessThan(sharedExport.indexOf('id="adv2"'));
    expect(sharedExport.indexOf('id="adv2"')).toBeLessThan(sharedExport.indexOf('id="adv1"'));
    expect(sharedDetailExport.indexOf('id="adv1"')).toBeLessThan(sharedDetailExport.indexOf('id="adv2"'));
    expect(sharedDetailExport.indexOf('id="adv2"')).toBeLessThan(sharedDetailExport.indexOf('id="adv3"'));
    expect(globalThis.__batchGeneratedFiles['website/js/ad.js']).toContain(firstCode.config.bannerPath2);

    await context.__generator.exportWebsite(secondState, () => {});
    const overrideExport = globalThis.__batchGeneratedFiles['website/index.html'];
    expect(overrideExport.indexOf('id="adv1"')).toBeLessThan(overrideExport.indexOf('id="adv3"'));
    expect(overrideExport.indexOf('id="adv3"')).toBeLessThan(overrideExport.indexOf('id="adv2"'));
    expect(globalThis.__batchGeneratedFiles['website/js/ad.js']).toContain(secondCode.config.bannerPath2);
  });

  it('carries the batch ad.js version into each generated site', async () => {
    const first = code('site-old', 'one');
    const sourceSite = site('a', 'one');
    const base = {
      selectedTheme: 'game', siteBuildMode: 'batch-ad-build', data: sourceSite.data,
      fieldMapping: sourceSite.fieldMapping,
      config: { siteTitle: 'Batch Site', logoText: 'Batch Site', categories: context.__themes.game.categories, cardFields: ['image', 'title'], relatedCardFields: ['image', 'title'], relatedCount: 1 }
    };
    for (const version of ['v1.0.0', 'initial']) {
      const state = context.__batch.createSiteState({ ...base, adJsVersion: version }, sourceSite, first);
      await context.__generator.exportWebsite(state, () => {});
      const output = globalThis.__batchGeneratedFiles['website/js/ad.js'];
      expect(context.__batch.validateGeneratedSiteFiles(globalThis.__batchGeneratedFiles, first).valid).toBe(true);
      if (version === 'initial') expect(output).toContain('const bannerPath1 = "/publisher/site-old-banner1";');
      else expect(output).toContain('ad.js v1.0.0');
    }
  });

  it('exports the selected template and style configuration stored for each site', () => {
    const first = code('site-one', 'one');
    const sourceSite = Object.assign(site('a', 'one'), {
      config: { siteTitle: 'Second preview', selectedStyle: 'magazine', templateId: 'medical-magazine' }
    });
    const state = context.__batch.createSiteState({
      config: { siteTitle: 'Currently visible site', selectedStyle: 'minimal', templateId: 'medical-minimal' }
    }, sourceSite, first);
    expect(state.config.siteTitle).toBe('Second preview');
    expect(state.config.selectedStyle).toBe('magazine');
    expect(state.config.templateId).toBe('medical-magazine');
  });

  it('exports the domain selected for each site instead of the currently visible batch domain', () => {
    const first = code('site-one', 'one');
    const sourceSite = Object.assign(site('a', 'one'), {
      themeId: 'medical',
      config: { siteTitle: 'Medical site', templateId: 'medical-blueprint-01' }
    });
    const state = context.__batch.createSiteState({
      selectedTheme: 'technology',
      config: { siteTitle: 'Visible technology site', templateId: 'technology-blueprint-01' }
    }, sourceSite, first);
    expect(state.selectedTheme).toBe('medical');
    expect(state.config.templateId).toBe('medical-blueprint-01');
  });

  it('renders archived local images as preview blob URLs instead of their unresolved archive paths', () => {
    const previewState = {
      selectedTheme: 'game',
      data: [{ id: 1, title: 'Local cover', description: 'Preview body', image: 'assets/cover.png' }],
      fieldMapping: { id: 'id', title: 'title', content: 'description', image: 'image' },
      isLocalImages: true,
      localImages: { 'assets/cover.png': new Blob(['image-bytes'], { type: 'image/png' }) },
      _previewBlobUrls: [],
      config: {
        siteTitle: 'Local asset preview', logoText: 'Local asset preview', categories: context.__themes.game.categories,
        cardFields: ['image', 'title'], relatedCardFields: ['image', 'title'], relatedCount: 1
      }
    };
    const html = context.__generator.generatePreviewHtml(previewState, 'home', 0);
    expect(html).toContain('blob:');
    expect(html).not.toContain('src="assets/cover.png"');
    previewState._previewBlobUrls.forEach((url) => URL.revokeObjectURL(url));
  });

  it('exports one domain-named ZIP per site after each generated ad runtime passes inspection', async () => {
    const realContext = { JSZip, Blob, TextDecoder, setTimeout: (callback) => callback() };
    vm.runInNewContext(source('template-catalog.js') + source('template-layouts.js') + source('navbar-layout.js') + source('data.js') + '\nthis.__themes = THEMES;', realContext);
    vm.runInNewContext(source('archive-naming.js'), realContext);
    vm.runInNewContext(source('ad-migration.js') + '\nthis.__migration = AdMigration;', realContext);
    vm.runInNewContext(source('export-preflight.js'), realContext);
    vm.runInNewContext(source('generator.js') + '\nthis.__generator = Generator;', realContext);
    vm.runInNewContext(source('batch-ad-builder.js') + '\nthis.__batch = BatchAdBuilder;', realContext);
    const firstHost = 'site-one.example.com';
    const secondHost = 'site-two.example.com';
    const first = Object.assign({ id: 'one', fileName: firstHost + '.txt' }, realContext.__migration.inspectAdCodeText([
      `googletag.defineSlot('/publisher/${firstHost}-banner1', [300, 250], 'div-gpt-ad-banner1');`, `googletag.defineSlot('/publisher/${firstHost}-banner2', [300, 250], 'div-gpt-ad-banner2');`, `googletag.defineSlot('/publisher/${firstHost}-banner3', [300, 250], 'div-gpt-ad-banner3');`
    ].join('\n'), firstHost + '.txt'));
    const second = Object.assign({ id: 'two', fileName: secondHost + '.txt' }, realContext.__migration.inspectAdCodeText([
      `googletag.defineSlot('/publisher/${secondHost}-banner1', [300, 250], 'div-gpt-ad-banner1');`, `googletag.defineSlot('/publisher/${secondHost}-banner2', [300, 250], 'div-gpt-ad-banner2');`, `googletag.defineSlot('/publisher/${secondHost}-banner3', [300, 250], 'div-gpt-ad-banner3');`
    ].join('\n'), secondHost + '.txt'));
    const firstSite = site('first', 'one');
    const secondSite = site('second', 'two');
    const result = await realContext.__batch.exportBatch({
      selectedTheme: 'game', siteBuildMode: 'batch-ad-build', data: firstSite.data,
      fieldMapping: firstSite.fieldMapping,
      config: { siteTitle: 'Batch Site', logoText: 'Batch Site', categories: realContext.__themes.game.categories, cardFields: ['image', 'title'], relatedCardFields: ['image', 'title'], relatedCount: 1 },
      batchAdBuild: { sites: [firstSite, secondSite], codes: [first, second] }
    }, () => {}, JSZip);
    expect(result.downloads).toHaveLength(2);
    expect(result.downloads.map((file) => file.fileName)).toEqual([firstHost + '.zip', secondHost + '.zip']);
    const firstExport = await JSZip.loadAsync(await result.downloads[0].blob.arrayBuffer());
    const secondExport = await JSZip.loadAsync(await result.downloads[1].blob.arrayBuffer());
    expect(result.reports).toHaveLength(2);
    expect(firstExport.file(firstHost + '/index.html')).toBeTruthy();
    expect(secondExport.file(secondHost + '/js/ad.js')).toBeTruthy();
    expect(Object.keys(firstExport.files).some((path) => path.startsWith(firstHost + '/'))).toBe(true);
    expect(Object.keys(secondExport.files).some((path) => path.startsWith(secondHost + '/'))).toBe(true);
    expect(await secondExport.file(secondHost + '/js/ad.js').async('text')).toContain(second.config.bannerPath2);
    expect(await secondExport.file(secondHost + '/js/ad.js').async('text')).toContain('const enableInterstitialTriggers = false;');
    expect(secondExport.file(secondHost + '/BATCH_AD_EXPORT_REPORT.json')).toBeTruthy();
  });
});
