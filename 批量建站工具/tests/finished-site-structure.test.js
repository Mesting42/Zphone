import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const { DOMParser } = createRequire(import.meta.url)('../js/source-export-dom.cjs');
const ctx = { TextEncoder, TextDecoder, Uint8Array, Blob, DOMParser, window: {} };
for (const name of ['template-catalog', 'template-layouts', 'navbar-layout', 'data', 'domain', 'ad-migration', 'ad', 'generator', 'finished-site-ads', 'ad-restoration']) {
  vm.runInNewContext(readFileSync(new URL('../js/' + name + '.js', import.meta.url), 'utf8'), ctx);
}
vm.runInNewContext('this.ads = AdRestoration; this.planner = FinishedSiteAds;', ctx);
const config = { bannerPath1: '/123/shape.test-banner1', bannerPath2: '/123/shape.test-banner2', bannerPath3: '/123/shape.test-banner3' };
const shell = body => '<!doctype html><html><head><title>Shape</title></head><body><header><nav><a href="/">Home</a><a href="/items/">Items</a></nav></header><main>' + body + '</main><footer>Site footer</footer></body></html>';
const shapes = {
  collection: '<h1>Collection</h1><div><article><a href="/a">First card</a></article><article><a href="/b">Second card</a></article></div>',
  category: '<div><h1>Category</h1></div><section><div>First result</div><div>Second result</div></section>',
  game: '<article><header><h1>Game</h1></header><section class="player"><canvas></canvas><button>Start</button></section><section><h2>Instructions</h2><p>Use the controls to play.</p></section></article>',
  playerControls: '<article><h1>Game</h1><section class="player"><canvas></canvas><p>Player status and several detailed control instructions remain part of the live player.</p><button>Start</button><button>Pause</button></section><p>Game guide.</p></article>',
  embedded: '<article><h1>World</h1><div><iframe src="/play"></iframe></div><section><h2>Guide</h2><p>Explore the world.</p></section></article>',
  short: '<h1>Short page</h1><p>One short paragraph.</p>',
  oneParagraph: '<div><p>A single short paragraph with several words.</p></div>',
  tool: '<h1>Tool</h1><form><label>Value<input></label><button>Calculate</button></form><section><p>How to use the tool.</p></section>',
  article: '<article><h1>Article</h1><div class="article-body"><p>First paragraph.</p><p>Second paragraph.</p></div></article>'
  ,articleWithRelatedCards: '<article class="story"><h1>Story</h1><p>First complete paragraph.</p><p>Second complete paragraph.</p><p>Third complete paragraph.</p></article><section class="related"><div class="cards"><article><a href="/a">Related one</a></article><article><a href="/b">Related two</a></article></div></section>'
};

describe('finished-site structure contracts independent of template and domain', () => {
  it('promotes a manual paragraph gap to its card boundary and persists its logical target', () => {
    const cards = Array.from({ length: 12 }, (_, index) => '<article class="entry"><a href="/entry-' + index
      + '"><img alt="Cover"></a><div class="entry-copy"><h2>Entry ' + index
      + '</h2><p>Original card description.</p><a href="/entry-' + index + '">Read more</a></div></article>').join('');
    const doc = new DOMParser().parseFromString(shell('<div class="collection">' + cards + '</div>'), 'text/html');
    const selected = doc.querySelectorAll('.entry p')[3];
    const boundary = ctx.planner.semanticBoundaries(doc).find(gap => gap.anchor === selected);
    const result = ctx.planner.placePolicy(doc, 'article', [{ unit: 'banner2', position: 'content-ratio-' + boundary.ratio }]);
    const ad = doc.getElementById('adv2');
    expect(result.skipped).toEqual([]);
    expect(ad.parentElement.className).toBe('collection');
    expect(ad.getAttribute('data-sitefoundry-grid-target')).toBe('4');
    expect(doc.querySelector('.entry #adv2')).toBeNull();
    expect(doc.querySelectorAll('script[data-sitefoundry-grid-runtime]').length).toBe(1);
  });

  it('updates a re-imported row runtime instead of preserving its outdated source', () => {
    const doc = new DOMParser().parseFromString(shell(shapes.collection), 'text/html');
    const old = doc.createElement('script');
    old.setAttribute('data-sitefoundry-grid-runtime', '');
    old.textContent = '/* outdated runtime */';
    doc.body.appendChild(old);
    ctx.planner.placePolicy(doc, 'article', [{ unit: 'banner2', position: 'content-middle' }]);
    expect(doc.querySelectorAll('script[data-sitefoundry-grid-runtime]').length).toBe(1);
    expect(old.textContent).not.toContain('outdated runtime');
  });

  for (const pageType of ['article', 'tool', 'game']) {
    it(pageType + ': places banner1 outside a sticky navigation-only host', () => {
      const body = pageType === 'article' ? shapes.article : pageType === 'tool' ? shapes.tool : shapes.game;
      const html = '<!doctype html><html><head><title>Sticky host</title></head><body>'
        + '<div id="site-header" style="position:sticky;top:0"><header><nav><a href="/">Home</a><a href="/items/">Items</a></nav></header></div>'
        + '<main>' + body + '</main><footer>Site footer</footer></body></html>';
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const policy = ctx.ads.createPolicy(undefined, { contentTypeIsolation: true });
      ctx.planner.placePolicy(doc, pageType, policy.slots[pageType]);

      const banner = doc.getElementById('adv1');
      expect(banner.parentElement).toBe(doc.body);
      expect(banner.previousElementSibling.id).toBe('site-header');
      expect(banner.closest('[style*="position:sticky"]')).toBeNull();
    });
  }

  it('keeps banner1 inside an application root that also owns page content', () => {
    const html = '<!doctype html><html><head><title>Application root</title></head><body><div id="app">'
      + '<header><nav><a href="/">Home</a><a href="/tools/">Tools</a></nav></header>'
      + '<main>' + shapes.tool + '</main><footer>Site footer</footer></div></body></html>';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const policy = ctx.ads.createPolicy(undefined, { contentTypeIsolation: true });

    ctx.planner.placePolicy(doc, 'tool', policy.slots.tool);

    const banner = doc.getElementById('adv1');
    expect(banner.parentElement.id).toBe('app');
    expect(banner.previousElementSibling.tagName).toBe('HEADER');
  });

  it('prefers an empty deferred site-header host over navigation inside main content', () => {
    const html = '<!doctype html><html><head><title>Deferred header</title></head><body>'
      + '<div id="site-header"></div><main><section><h1>Tool directory</h1>'
      + '<nav aria-label="Popular tools"><a href="/a">A</a><a href="/b">B</a></nav>'
      + '<form><input><button>Calculate</button></form><p>First explanation.</p><p>Second explanation.</p>'
      + '</section></main><footer>Site footer</footer></body></html>';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const policy = ctx.ads.createPolicy(undefined, { contentTypeIsolation: true });

    ctx.planner.placePolicy(doc, 'tool', policy.slots.tool);

    const banner = doc.getElementById('adv1');
    expect(banner.parentElement).toBe(doc.body);
    expect(banner.previousElementSibling.id).toBe('site-header');
    expect(doc.querySelector('main nav #adv1')).toBeNull();
  });

  for (const [shape, body] of Object.entries(shapes)) for (const mode of ['manual', 'fixed']) {
    it(shape + ': ' + mode + ' leaves original content after the middle ad', () => {
      const policy = ctx.ads.createPolicy();
      const entries = [{ path: 'index.html', text: shell(body) }, { path: 'arbitrary/listing/index.html', text: shell(body) }];
      const result = ctx.ads.injectAdsIntoSiteEntries(entries, config, 'shape.test', policy, { mode, version: 'v1.0.2.1' });
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
      for (const entry of result.entries.filter(entry => /html$/.test(entry.path))) {
        const doc = new DOMParser().parseFromString(new TextDecoder().decode(entry.bytes), 'text/html');
        expect(doc.querySelectorAll('[id^="div-gpt-ad-banner"]').length).toBe(3);
        expect(ctx.planner.validatePlacements(doc, policy.slots.detail)).toEqual([]);
        expect(doc.querySelector('a #adv2, button #adv2, form #adv2, .player #adv2')).toBeNull();
        if (shape === 'articleWithRelatedCards') expect(doc.querySelector('.story #adv2')).not.toBeNull();
        expect(doc.querySelectorAll('[data-sitefoundry-preview-creative]').length).toBe(0);
        expect(doc.querySelector('#adv1').firstElementChild.textContent).toBe('Advertisement');
      }
    });
  }
  it('decorates only the preview copy and never the export DOM', () => {
    const doc = new DOMParser().parseFromString(shell(shapes.short), 'text/html');
    ctx.planner.place(doc, 'home', config);
    const original = ctx.planner.serialize(doc);
    ctx.planner.decoratePreview(doc);
    expect(doc.querySelectorAll('[data-sitefoundry-preview-creative]').length).toBe(3);
    expect(original).not.toContain('广告预览');
    ctx.planner.decoratePreview(doc);
    expect(doc.querySelectorAll('[data-sitefoundry-preview-creative]').length).toBe(3);
  });
  it('rejects a middle slot appended immediately before the footer slot', () => {
    const doc = new DOMParser().parseFromString(shell(shapes.short), 'text/html');
    ctx.planner.place(doc, 'home', config);
    doc.querySelector('#adv3').before(doc.querySelector('#adv2'));
    expect(ctx.planner.validatePlacements(doc, ctx.ads.createPolicy().slots.home).length).toBeGreaterThan(0);
  });
  it('distinguishes deployable pages from source templates and public copies', () => {
    const project = { kind: 'static-html', entryPath: 'index.html', deploymentRoot: '' };
    expect(ctx.planner.isDeployableContentPath('tools/orbit-weight/index.html', project)).toBe(true);
    expect(ctx.planner.isDeployableContentPath('templates/blog-article.html', project)).toBe(false);
    expect(ctx.planner.isDeployableContentPath('scripts/article-qa.html', project)).toBe(false);
    expect(ctx.planner.isDeployableContentPath('_dist/orb-gallery.html', project)).toBe(false);
    expect(ctx.planner.isDeployableContentPath('03-OrbitTools工具站-_dist/orb-gallery.html', project)).toBe(false);
    expect(ctx.planner.isDeployableContentPath('public/orb-gallery.html', project)).toBe(false);
    expect(ctx.planner.isDeployableContentPath('.output/public/tools/orbit/index.html', {
      kind: 'static-html', entryPath: '.output/public/index.html', deploymentRoot: '.output/public/'
    })).toBe(true);
  });
});
