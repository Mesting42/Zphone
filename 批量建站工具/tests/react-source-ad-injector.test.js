import { describe, expect, it } from 'vitest';
import { injectReactSource } from '../js/react-source-ad-injector.js';
import { previewPageTypeForEntry } from '../js/ad-injection-preview-router.js';

const runtimeSource = "window.refreshClarivoBanners=function(){};['pushState','replaceState'];div-gpt-ad-banner";

describe('React source ad injector', () => {
  it.each([
    ['src/routes/articles.tsx', 'dist/client/articles/index.html', 'dist/client/'],
    ['src/routes/catalog.tsx', 'dist/client/catalog/index.html', 'dist/client/'],
    ['src/pages/guides/index.jsx', 'dist/guides/index.html', 'dist/'],
    ['src/pages/arcade/index.tsx', 'build/arcade/index.html', 'build/']
  ])('uses the same non-root policy and section gap for %s', (sourcePath, previewPath, previewRoot) => {
    expect(previewPageTypeForEntry(previewPath, previewRoot)).toBe('detail');
    const result = injectReactSource([
      { path: sourcePath, text: 'export default function Page(){ return <main><section data-part="introduction"><h1>Introduction</h1></section><section data-part="collection">Collection</section></main>; }' }
    ], { framework: 'React 源码工程' }, { bannerPath2: '/123/banner2', bannerPath3: '/123/banner3' }, {
      slots: {
        home: [{ position: 'after-section-1', unit: 'banner2' }, { position: 'footer-top', unit: 'banner3' }],
        detail: [{ position: 'detail-after-content', unit: 'banner2' }, { position: 'footer-top', unit: 'banner3' }]
      }
    }, 'generic-route-fixture', runtimeSource);

    expect(result.valid).toBe(true);
    const output = new TextDecoder().decode(result.entries.find((entry) => entry.path === sourcePath).bytes);
    expect(output.indexOf('data-part="introduction"')).toBeLessThan(output.indexOf('<Advertisement id="banner2"'));
    expect(output.indexOf('<Advertisement id="banner2"')).toBeLessThan(output.indexOf('data-part="collection"'));
    expect(output.indexOf('data-part="collection"')).toBeLessThan(output.indexOf('<Advertisement id="banner3"'));
  });

  it('exports a flat /tools route at the same gap shown by its finished-site preview', () => {
    const previewType = previewPageTypeForEntry('dist/client/tools/index.html', 'dist/client/');
    expect(previewType).toBe('detail');
    const result = injectReactSource([
      { path: 'src/routes/__root.tsx', text: 'export function RootShell({children}) { return <html><head></head><body>{children}</body></html>; }' },
      { path: 'src/routes/tools.tsx', text: 'export default function Tools(){ return <SiteLayout><section data-part="intro"><div><h1>All Tools</h1><p>Fourteen tools</p><input /></div></section><section data-part="cards">Cards</section></SiteLayout>; }' }
    ], { framework: 'React + TanStack Start 源码工程' }, { bannerPath2: '/123/example-banner2', bannerPath3: '/123/example-banner3' }, {
      slots: {
        home: [{ position: 'after-section-1', unit: 'banner2' }, { position: 'content-bottom', unit: 'banner3' }],
        detail: [{ position: 'detail-after-content', unit: 'banner2' }, { position: 'footer-top', unit: 'banner3' }]
      }
    }, 'tools-preview-parity', runtimeSource);

    expect(result.valid).toBe(true);
    const output = new TextDecoder().decode(result.entries.find((entry) => entry.path === 'src/routes/tools.tsx').bytes);
    const banner2 = output.indexOf('<Advertisement id="banner2"');
    const banner3 = output.indexOf('<Advertisement id="banner3"');
    expect(banner2).toBeGreaterThan(output.indexOf('</section>'));
    expect(banner2).toBeLessThan(output.indexOf('data-part="cards"'));
    expect(banner3).toBeGreaterThan(output.indexOf('data-part="cards"'));
  });
  it('keeps dynamic tool detail banners inside the tool content rather than moving them to the directory gap', () => {
    const result = injectReactSource([
      { path: 'src/routes/__root.tsx', text: 'export function RootShell({children}) { return <html><head></head><body>{children}</body></html>; }' },
      { path: 'src/routes/tools_.$toolId.tsx', text: 'export default function Tool(){ return <SiteLayout><div>Breadcrumb</div><div><div><section data-part="tool">Tool</section><section data-part="principle">Principle</section><section data-part="how">How to use</section><section data-part="faq">FAQ</section></div><aside>Related</aside></div></SiteLayout>; }' }
    ], { framework: 'React + TanStack Start 源码工程' }, { bannerPath2: '/123/example-banner2', bannerPath3: '/123/example-banner3' }, {
      slots: { home: [], detail: [{ position: 'detail-after-content', unit: 'banner2' }, { position: 'footer-top', unit: 'banner3' }] }
    }, 'tool-detail-parity', runtimeSource);

    expect(result.valid).toBe(true);
    const output = new TextDecoder().decode(result.entries.find((entry) => entry.path === 'src/routes/tools_.$toolId.tsx').bytes);
    const banner2 = output.indexOf('<Advertisement id="banner2"');
    expect(banner2).toBeGreaterThan(output.indexOf('data-part="principle"'));
    expect(banner2).toBeLessThan(output.indexOf('data-part="how"'));
  });
  it('uses AST edits to create one reusable component and only injects into a semantic main landmark', () => {
    const result = injectReactSource([
      { path: 'index.html', text: '<html><head></head><body><div id="root"></div></body></html>' },
      { path: 'src/App.tsx', text: "export default function App(){ return <main><section>content</section></main>; }" }
    ], { framework: 'React / Vite 源码工程' }, {
      bannerPath1: '/123/example-banner1', bannerPath2: '/123/example-banner2', bannerPath3: '/123/example-banner3',
      interstitialPath: '/123/example-INT', anchorPath: '/123/example-ANC', analyticsID: 'G-TEST123'
    }, { slots: { home: [], detail: [] } }, 'fixture', runtimeSource);
    expect(result.valid).toBe(true);
    const files = Object.fromEntries(result.entries.map((entry) => [entry.path, new TextDecoder().decode(entry.bytes)]));
    expect(files['src/App.tsx']).toContain('from "./components/advertisement"');
    expect(files['src/App.tsx']).toContain('<Advertisement id="banner1"');
    expect(files['src/components/advertisement.tsx']).toContain("containerId: 'adv1'");
    expect(files['src/types/sitefoundry-ads.d.ts']).toContain('refreshClarivoBanners');
    expect(files['public/js/ad.js']).toContain('refreshClarivoBanners');
    expect(files['index.html'].match(/securepubads\.g\.doubleclick\.net/g)).toHaveLength(1);
  });

  it('keeps JavaScript React projects JavaScript-only', () => {
    const result = injectReactSource([
      { path: 'index.html', text: '<html><head></head><body><div id="root"></div></body></html>' },
      { path: 'src/App.jsx', text: 'export default () => <main><p>content</p></main>;' }
    ], { framework: 'React / Vite 源码工程' }, { bannerPath1: '/123/example-banner1' }, { slots: { home: [], detail: [] } }, 'fixture', runtimeSource);
    expect(result.valid).toBe(true);
    expect(result.entries.find((entry) => entry.path === 'src/components/advertisement.jsx')).toBeTruthy();
    expect(result.entries.find((entry) => entry.path === 'src/types/sitefoundry-ads.d.ts')).toBeFalsy();
  });

  it('reuses a compatible named Advertisement component and existing TanStack slots', () => {
    const component = `import { useEffect } from "react";
const AD_SLOTS = { banner1: { elementId: "div-gpt-ad-banner1" } };
export function Advertisement({ id, className = "" }) {
  useEffect(() => { window.refreshClarivoBanners?.(); }, []);
  return <div className={className}><div id={"div-gpt-ad-" + id} /></div>;
}`;
    const root = `export function RootShell({ children }) { return <html><head><script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js" /><script src="/js/ad.js" /></head><body>{children}</body></html>; }`;
    const page = `import { Advertisement } from "../components/advertisement";
export default function Home(){ return <Layout><Advertisement id="banner1"/><Advertisement id="banner2"/><Advertisement id="banner3"/></Layout>; }`;
    const result = injectReactSource([
      { path: 'src/components/advertisement.tsx', text: component },
      { path: 'src/routes/__root.tsx', text: root },
      { path: 'src/routes/index.tsx', text: page }
    ], { framework: 'React + TanStack Start 源码工程' }, { bannerPath1: '/123/example-banner1' }, { slots: { home: [], detail: [] } }, 'fixture', runtimeSource);
    expect(result.valid).toBe(true);
    expect(result.changedPages).toEqual([]);
    expect(result.verifiedPages).toEqual(['src/routes/index.tsx']);
    const files = Object.fromEntries(result.entries.map((entry) => [entry.path, new TextDecoder().decode(entry.bytes)]));
    expect(files['src/components/advertisement.tsx']).toBe(component);
    expect(files['src/routes/index.tsx']).toBe(page);
    expect(files['src/routes/__root.tsx'].match(/securepubads\.g\.doubleclick\.net/g)).toHaveLength(1);
  });

  it('injects global scripts into a TanStack RootShell head when index.html is absent', () => {
    const result = injectReactSource([
      { path: 'dist/client/index.html', text: '<html><head></head><body>built preview</body></html>' },
      { path: 'src/routes/__root.tsx', text: 'export function RootShell({children}) { return <html><head></head><body>{children}</body></html>; }' },
      { path: 'src/routes/index.tsx', text: 'export default function Home(){ return <main><section>content</section></main>; }' }
    ], { framework: 'React + TanStack Start 源码工程' }, { bannerPath1: '/123/example-banner1' }, null, 'fixture', runtimeSource);
    expect(result.valid).toBe(true);
    const root = new TextDecoder().decode(result.entries.find((entry) => entry.path === 'src/routes/__root.tsx').bytes);
    expect(root).toContain('securepubads.g.doubleclick.net/tag/js/gpt.js');
    expect(root).toContain('src="/js/ad.js"');
    expect(new TextDecoder().decode(result.entries.find((entry) => entry.path === 'dist/client/index.html').bytes)).toBe('<html><head></head><body>built preview</body></html>');
  });

  it('uses a returned SiteLayout as the safe page anchor when main lives in the shared layout', () => {
    const result = injectReactSource([
      { path: 'src/routes/__root.tsx', text: 'export function RootShell({children}) { return <html><head></head><body>{children}</body></html>; }' },
      { path: 'src/routes/index.tsx', text: 'export default function Home(){ return <SiteLayout><section>hero</section><section>content</section></SiteLayout>; }' }
    ], { framework: 'React + TanStack Start 源码工程' }, { bannerPath1: '/123/example-banner1' }, null, 'fixture', runtimeSource);
    expect(result.valid).toBe(true);
    const page = new TextDecoder().decode(result.entries.find((entry) => entry.path === 'src/routes/index.tsx').bytes);
    expect(page).toContain('<SiteLayout>');
    expect(page.match(/<Advertisement id="banner[123]"/g)).toHaveLength(3);
  });

  it('uses the root policy only for the root route and the preview detail policy for other content routes', () => {
    const page = (title) => `export default function Page(){ return <main><section>${title}</section><section>more</section></main>; }`;
    const result = injectReactSource([
      { path: 'src/routes/__root.tsx', text: 'export function RootShell({children}) { return <html><head></head><body>{children}</body></html>; }' },
      { path: 'src/routes/index.tsx', text: page('home') },
      { path: 'src/routes/tools.tsx', text: page('tool list') },
      { path: 'src/routes/tools_.$toolId.tsx', text: page('tool detail') },
      { path: 'src/routes/news.tsx', text: page('news list') },
      { path: 'src/routes/news_.$slug.tsx', text: page('article detail') },
      { path: 'src/routes/games.tsx', text: page('game list') },
      { path: 'src/routes/games_.$gameId.tsx', text: page('game detail') },
      { path: 'src/routes/about.tsx', text: page('about') },
      { path: 'src/routes/privacy.tsx', text: page('privacy') },
      { path: 'src/routes/404.tsx', text: page('not found') }
    ], { framework: 'React + TanStack Start 源码工程' }, { bannerPath1: '/123/example-banner1' }, {
      slots: {
        home: [{ position: 'after-navbar', unit: 'banner1' }],
        detail: [{ position: 'detail-before-content', unit: 'banner2' }, { position: 'footer-top', unit: 'banner3' }]
      }
    }, 'multi-vertical-fixture', runtimeSource);

    expect(result.valid).toBe(true);
    expect(result.changedPages).toEqual([
      'src/routes/index.tsx',
      'src/routes/tools.tsx',
      'src/routes/tools_.$toolId.tsx',
      'src/routes/news.tsx',
      'src/routes/news_.$slug.tsx',
      'src/routes/games.tsx',
      'src/routes/games_.$gameId.tsx'
    ]);
    const files = Object.fromEntries(result.entries.map((entry) => [entry.path, new TextDecoder().decode(entry.bytes)]));
    expect(files['src/routes/index.tsx']).toContain('<Advertisement id="banner1"');
    expect(files['src/routes/index.tsx']).not.toContain('<Advertisement id="banner2"');
    ['src/routes/tools.tsx', 'src/routes/news.tsx', 'src/routes/games.tsx', 'src/routes/tools_.$toolId.tsx', 'src/routes/news_.$slug.tsx', 'src/routes/games_.$gameId.tsx'].forEach((path) => {
      expect(files[path]).toContain('<Advertisement id="banner2"');
      expect(files[path]).toContain('<Advertisement id="banner3"');
      expect(files[path]).not.toContain('<Advertisement id="banner1"');
    });
    ['src/routes/about.tsx', 'src/routes/privacy.tsx', 'src/routes/404.tsx'].forEach((path) => {
      expect(files[path]).not.toContain('Advertisement');
    });
  });

  it('matches preview policy on nested non-root page folders and preserves a compatible named-only component', () => {
    const component = `import { useEffect } from "react";
const AD_SLOTS = { banner1: { elementId: "div-gpt-ad-banner1" } };
export function Advertisement({ id }) {
  useEffect(() => { window.refreshClarivoBanners?.(); }, []);
  return <div id={"div-gpt-ad-" + id} />;
}`;
    const page = (title) => `export default function Page(){ return <main><section>${title}</section></main>; }`;
    const result = injectReactSource([
      { path: 'index.html', text: '<html><head></head><body><div id="root"></div></body></html>' },
      { path: 'src/components/advertisement.tsx', text: component },
      { path: 'src/pages/index.tsx', text: page('home') },
      { path: 'src/pages/stories/index.tsx', text: page('story list') },
      { path: 'src/pages/stories/[slug].tsx', text: page('story detail') },
      { path: 'src/pages/arcade/index.tsx', text: page('game list') },
      { path: 'src/pages/arcade/[gameId].tsx', text: page('game detail') },
      { path: 'src/pages/contact.tsx', text: page('contact') }
    ], { framework: 'React 源码工程' }, { bannerPath1: '/123/example-banner1' }, {
      slots: {
        home: [{ position: 'content-top', unit: 'banner1' }],
        detail: [{ position: 'detail-before-content', unit: 'banner2' }]
      }
    }, 'nested-fixture', runtimeSource);

    expect(result.valid).toBe(true);
    expect(result.changedPages).toEqual([
      'src/pages/index.tsx',
      'src/pages/stories/index.tsx',
      'src/pages/stories/[slug].tsx',
      'src/pages/arcade/index.tsx',
      'src/pages/arcade/[gameId].tsx'
    ]);
    const files = Object.fromEntries(result.entries.map((entry) => [entry.path, new TextDecoder().decode(entry.bytes)]));
    expect(files['src/pages/stories/index.tsx']).toContain('import { Advertisement } from "../../components/advertisement"');
    expect(files['src/pages/stories/index.tsx']).toContain('<Advertisement id="banner2"');
    expect(files['src/pages/stories/[slug].tsx']).toContain('<Advertisement id="banner2"');
    expect(files['src/pages/contact.tsx']).not.toContain('Advertisement');
    expect(files['src/components/advertisement.tsx']).toBe(component);
  });

  it('puts the second detail ad inside wrapped content while keeping the third ad at the page end', () => {
    const result = injectReactSource([
      { path: 'index.html', text: '<html><head></head><body><div id="root"></div></body></html>' },
      {
        path: 'src/pages/library/[slug].tsx',
        text: `export default function Detail(){ return <main>
          <article>
            <section data-part="intro">intro</section>
            <section data-part="primary">primary content</section>
            <section data-part="guide">guide</section>
            <section data-part="faq">faq</section>
          </article>
        </main>; }`
      }
    ], { framework: 'React 源码工程' }, { bannerPath1: '/123/example-banner1' }, {
      slots: {
        home: [],
        detail: [
          { position: 'after-navbar', unit: 'banner1' },
          { position: 'detail-after-content', unit: 'banner2' },
          { position: 'footer-top', unit: 'banner3' }
        ]
      }
    }, 'wrapped-detail-fixture', runtimeSource);

    expect(result.valid).toBe(true);
    const output = new TextDecoder().decode(result.entries.find((entry) => entry.path === 'src/pages/library/[slug].tsx').bytes);
    const banner2 = output.indexOf('<Advertisement id="banner2"');
    const banner3 = output.indexOf('<Advertisement id="banner3"');
    expect(banner2).toBeGreaterThan(output.indexOf('data-part="primary"'));
    expect(banner2).toBeLessThan(output.indexOf('data-part="guide"'));
    expect(banner2).toBeLessThan(output.indexOf('</article>'));
    expect(banner3).toBeGreaterThan(output.indexOf('</article>'));
  });

  it('maps a custom preview content path to the matching nested React block gap', () => {
    const result = injectReactSource([
      { path: 'index.html', text: '<html><body><div id="root"></div></body></html>' },
      {
        path: 'src/pages/guides/[slug].tsx',
        text: `export default function Detail(){ return <main><header>Heading</header><div>
          <section data-part="one">one</section>
          <section data-part="two">two</section>
          <section data-part="three">three</section>
        </div></main>; }`
      },
      {
        path: 'src/pages/news/[id].tsx',
        text: 'export default function News(){ return <main><article><p>short article</p></article></main>; }'
      }
    ], { framework: 'React 源码工程' }, { bannerPath2: '/123/example-banner2' }, {
      slots: { home: [], detail: [{ position: 'custom-after-0-1', unit: 'banner2' }] }
    }, 'custom-path-fixture', runtimeSource);

    expect(result.valid).toBe(true);
    const output = new TextDecoder().decode(result.entries.find((entry) => entry.path === 'src/pages/guides/[slug].tsx').bytes);
    const banner2 = output.indexOf('<Advertisement id="banner2"');
    expect(banner2).toBeGreaterThan(output.indexOf('data-part="two"'));
    expect(banner2).toBeLessThan(output.indexOf('data-part="three"'));
    expect(output).toContain('sitefoundry-ad-custom-placement');
    expect(output).toContain('--sitefoundry-ad-center-offset');
    const shortOutput = new TextDecoder().decode(result.entries.find((entry) => entry.path === 'src/pages/news/[id].tsx').bytes);
    expect(shortOutput).toContain('<Advertisement id="banner2"');
  });
});
