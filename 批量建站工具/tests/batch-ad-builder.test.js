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
const context = { JSZip: ZipMock, Blob, URL, TextDecoder, setTimeout: (callback) => callback() };
vm.runInNewContext(source('data.js') + '\nthis.__themes = THEMES;', context);
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
    await context.__generator.exportWebsite(state, () => {});
    const checked = context.__batch.validateGeneratedSiteFiles(globalThis.__batchGeneratedFiles, first);
    expect(checked.valid).toBe(true);
    expect(globalThis.__batchGeneratedFiles['website/js/ad.js']).toContain(first.config.bannerPath1);
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

  it('exports independent site folders only after each generated ad runtime passes inspection', async () => {
    const realContext = { JSZip, Blob, TextDecoder, setTimeout: (callback) => callback() };
    vm.runInNewContext(source('data.js') + '\nthis.__themes = THEMES;', realContext);
    vm.runInNewContext(source('ad-migration.js') + '\nthis.__migration = AdMigration;', realContext);
    vm.runInNewContext(source('generator.js') + '\nthis.__generator = Generator;', realContext);
    vm.runInNewContext(source('batch-ad-builder.js') + '\nthis.__batch = BatchAdBuilder;', realContext);
    const first = Object.assign({ id: 'one', fileName: 'site-one.txt' }, realContext.__migration.inspectAdCodeText([
      "googletag.defineSlot('/publisher/site-one-banner1', [300, 250], 'div-gpt-ad-banner1');", "googletag.defineSlot('/publisher/site-one-banner2', [300, 250], 'div-gpt-ad-banner2');", "googletag.defineSlot('/publisher/site-one-banner3', [300, 250], 'div-gpt-ad-banner3');"
    ].join('\n'), 'site-one.txt'));
    const second = Object.assign({ id: 'two', fileName: 'site-two.txt' }, realContext.__migration.inspectAdCodeText([
      "googletag.defineSlot('/publisher/site-two-banner1', [300, 250], 'div-gpt-ad-banner1');", "googletag.defineSlot('/publisher/site-two-banner2', [300, 250], 'div-gpt-ad-banner2');", "googletag.defineSlot('/publisher/site-two-banner3', [300, 250], 'div-gpt-ad-banner3');"
    ].join('\n'), 'site-two.txt'));
    const firstSite = site('first', 'one');
    const secondSite = site('second', 'two');
    const result = await realContext.__batch.exportBatch({
      selectedTheme: 'game', siteBuildMode: 'batch-ad-build', data: firstSite.data,
      fieldMapping: firstSite.fieldMapping,
      config: { siteTitle: 'Batch Site', logoText: 'Batch Site', categories: realContext.__themes.game.categories, cardFields: ['image', 'title'], relatedCardFields: ['image', 'title'], relatedCount: 1 },
      batchAdBuild: { sites: [firstSite, secondSite], codes: [first, second] }
    }, () => {}, JSZip);
    const exported = await JSZip.loadAsync(await result.blob.arrayBuffer());
    expect(result.reports).toHaveLength(2);
    expect(exported.file('site-one/index.html')).toBeTruthy();
    expect(exported.file('site-two/js/ad.js')).toBeTruthy();
    expect(await exported.file('site-two/js/ad.js').async('text')).toContain(second.config.bannerPath2);
    expect(exported.file('BATCH_AD_EXPORT_REPORT.json')).toBeTruthy();
  });
});
