import { describe, expect, it } from 'vitest';
import { loadBuilder, createState } from './template-fixtures.mjs';
import { parseHTML } from 'linkedom';

const builder = loadBuilder();

function manualState() {
  const state = createState(builder);
  state.directAdPlacementMode = 'manual';
  state.config.adCodePlacements = builder.migration.fixedPlacements();
  return state;
}

describe('independent home, article and listing advertisements', () => {
  it('keeps the listing and home unchanged when article banner2 moves before the body', async () => {
    const state = manualState();
    const beforeHome = builder.generator.generatePreviewHtml(state, 'home');
    const beforeListing = builder.generator.generatePreviewHtml(state, 'all');
    await builder.generator.exportWebsite(state, () => {});
    const exportedListing = builder.files()['website/all-articles.html'];

    state.config.adCodePlacements.adv2.detail = 'detail-before-content';

    expect(builder.generator.generatePreviewHtml(state, 'all')).toBe(beforeListing);
    expect(builder.generator.generatePreviewHtml(state, 'home')).toBe(beforeHome);
    const detail = builder.generator.generatePreviewHtml(state, 'detail', 0);
    const { document } = parseHTML(detail);
    expect(Boolean(document.getElementById('adv2').compareDocumentPosition(document.querySelector('.detail-page p')) & 4)).toBe(true);
    await builder.generator.exportWebsite(state, () => {});
    expect(builder.files()['website/all-articles.html']).toBe(exportedListing);
  });

  it('supports moving or removing only the listing banner without changing home or detail', async () => {
    const state = manualState();
    const beforeHome = builder.generator.generatePreviewHtml(state, 'home');
    const beforeDetail = builder.generator.generatePreviewHtml(state, 'detail', 0);
    state.config.adCodePlacements.adv2.all = 'content-bottom';
    for (const page of ['home', 'detail']) {
      expect(builder.generator.generatePreviewHtml(state, page, 0)).toBe(page === 'home' ? beforeHome : beforeDetail);
    }
    await builder.generator.exportWebsite(state, () => {});
    const listing = builder.files()['website/all-articles.html'];
    expect(listing.indexOf('id="adv2"')).toBeGreaterThan(listing.lastIndexOf('class="item-card"'));
    expect(listing.indexOf('id="adv2"')).toBeLessThan(listing.indexOf('<footer'));
    state.config.adCodePlacements.adv2.all = '';
    expect(builder.generator.generatePreviewHtml(state, 'all')).not.toContain('id="adv2"');
    expect(builder.generator.generatePreviewHtml(state, 'detail', 0)).toBe(beforeDetail);
    await builder.generator.exportWebsite(state, () => {});
    expect(builder.files()['website/all-articles.html']).not.toContain('id="adv2"');
  });

  it('offers listing placement markers that target the listing rather than the article', () => {
    const state = manualState();
    state.adPlacementMode = 'adv2';
    state.config.adCodePlacements.adv2.all = '';
    const html = builder.generator.generatePreviewHtml(state, 'all');
    for (const position of ['content-top', 'content-middle', 'content-bottom']) {
      expect(html).toContain('data-position="' + position + '" data-page="all"');
    }
    expect(html).not.toContain('data-page="detail"');
  });

  it('gives old settings listing defaults without copying custom article positions or restoring removed banners', () => {
    const legacy = { adv1: { home: 'after-navbar', detail: 'footer-top' }, adv2: { detail: 'detail-before-content' } };
    const normalized = builder.migration.normalizePagePlacements(legacy);
    expect(normalized.adv1.all).toBe('after-navbar');
    expect(normalized.adv2.all).toBe('content-middle');
    expect(normalized.adv2.detail).toBe('detail-before-content');
    expect(normalized.adv3).toBeUndefined();
    expect(legacy.adv2.all).toBeUndefined();
    normalized.adv2.all = '';
    expect(builder.migration.normalizePagePlacements(normalized).adv2.all).toBe('');
    expect(builder.migration.normalizePagePlacements({})).toEqual({});
  });
});
