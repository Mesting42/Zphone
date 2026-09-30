import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/export-preflight.js', import.meta.url), 'utf8');
const context = { TextDecoder, ArrayBuffer, Uint8Array };
vm.runInNewContext(source, context);
const preflight = context.SiteExportPreflight;

describe('export preflight', () => {
  it('accepts a complete static site and resolves references from nested pages and CSS', () => {
    const paths = [
      'website/index.html', 'website/details/story.html', 'website/css/site.css',
      'website/js/site.js', 'website/images/cover.png', 'website/data.json'
    ];
    const report = preflight.inspectEntries({
      'website/index.html': '<link rel="stylesheet" href="css/site.css"><script src="js/site.js"></script><a href="details/story.html">Story</a>',
      'website/details/story.html': '<img src="../images/cover.png"><a href="../index.html">Home</a>',
      'website/css/site.css': 'body { background-image: url("../images/cover.png"); }',
      'website/js/site.js': "fetch('./data.json');"
    }, { paths });

    expect(report.valid).toBe(true);
    expect(report.pageCount).toBe(2);
    expect(report.localReferenceCount).toBe(7);
  });

  it('accepts a complete static site when its files are at the ZIP root', () => {
    const paths = ['index.html', 'details/story.html', 'css/site.css', 'js/site.js', 'images/cover.png', 'data.json'];
    const report = preflight.inspectEntries({
      'index.html': '<link rel="stylesheet" href="css/site.css"><script src="js/site.js"></script><a href="details/story.html">Story</a>',
      'details/story.html': '<img src="../images/cover.png"><a href="../index.html">Home</a>',
      'css/site.css': 'body { background-image: url("../images/cover.png"); }',
      'js/site.js': "fetch('./data.json');"
    }, { paths });

    expect(report.valid).toBe(true);
    expect(report.pageCount).toBe(2);
    expect(report.localReferenceCount).toBe(7);
  });

  it('keeps the ZIP root when nested pages also use index.html', () => {
    const paths = [
      'index.html', 'about/index.html', 'categories/arcade/index.html',
      'assets/css/main.css', 'assets/icons/favicon.svg', 'js/ad.js'
    ];
    const report = preflight.inspectEntries({
      'index.html': '<link rel="stylesheet" href="/assets/css/main.css"><main>Home</main>',
      'about/index.html': '<link rel="icon" href="/assets/icons/favicon.svg"><script src="../js/ad.js"></script>',
      'categories/arcade/index.html': '<link rel="stylesheet" href="/assets/css/main.css"><script src="../../js/ad.js"></script>',
      'assets/css/main.css': 'body { color: #111; }',
      'js/ad.js': 'window.googletag = window.googletag || { cmd: [] };'
    }, { paths });

    expect(report.valid).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it('blocks export when a local static reference is missing', () => {
    const report = preflight.inspectEntries({
      'index.html': '<img src="images/missing.png"><script src="https://cdn.example/app.js"></script>'
    }, { paths: ['index.html'] });

    expect(report.valid).toBe(false);
    expect(report.errors.some((error) => error.code === 'EXPORT_REFERENCE_MISSING')).toBe(true);
    expect(() => preflight.assertValid(report)).toThrow('导出前体检未通过');
  });

  it('checks local images listed in generated data.json', () => {
    const report = preflight.inspectEntries({
      'index.html': '<main>Stories</main>',
      'data.json': JSON.stringify([{ title: 'Story', image: 'images/not-exported.jpg' }])
    }, { paths: ['index.html', 'data.json'] });

    expect(report.valid).toBe(false);
    expect(report.errors.some((error) => error.reference === 'images/not-exported.jpg')).toBe(true);
  });

  it('does not treat Google Ad Manager paths in an ad policy manifest as local files', () => {
    const report = preflight.inspectEntries({
      'index.html': '<main>Restored site</main>',
      'ad-policy.json': JSON.stringify({
        schema: 'sitefoundry-ad-policy/v1',
        adPaths: {
          bannerPath1: '/23333087986/zpnews630.reskamp.com-banner1',
          bannerPath2: '/23333087986/zpnews630.reskamp.com-banner2',
          bannerPath3: '/23333087986/zpnews630.reskamp.com-banner3',
          interstitialPath: '/23333087986/zpnews630.reskamp.com-INT',
          anchorPath: '/23333087986/zpnews630.reskamp.com-ANC'
        },
        preview: { image: 'images/missing-preview.jpg' }
      })
    }, { paths: ['index.html', 'ad-policy.json'] });

    expect(report.errors.some((error) => /banner[123]|-(?:INT|ANC)$/.test(error.reference || ''))).toBe(false);
    expect(report.errors.some((error) => error.reference === 'images/missing-preview.jpg')).toBe(true);
  });

  it('ignores external links and fragment references', () => {
    const report = preflight.inspectEntries({
      'index.html': '<a href="#content">Jump</a><a href="mailto:hello@example.com">Mail</a><img src="https://cdn.example/cover.png">'
    }, { paths: ['index.html'] });

    expect(report.valid).toBe(true);
    expect(report.localReferenceCount).toBe(0);
  });

  it('does not mistake commas inside data URI srcset values for local files', () => {
    const report = preflight.inspectEntries({
      'index.html': '<img srcset="data:image/png;base64,AAAA 1x, images/cover.png 2x">'
    }, { paths: ['index.html', 'images/cover.png'] });

    expect(report.valid).toBe(true);
    expect(report.localReferenceCount).toBe(1);
  });

  it('accepts a complete React source entry without a built index.html', () => {
    const report = preflight.inspectEntries({}, { paths: ['package.json', 'src/main.tsx', 'src/App.tsx'] });

    expect(report.valid).toBe(true);
    expect(report.entrypoint).toBe('React 源码');
  });

  it('aggregates per-site failures without losing site names', () => {
    const report = preflight.inspectSites([
      { name: 'healthy', entries: [{ path: 'index.html', bytes: new TextEncoder().encode('<main>ok</main>') }] },
      { name: 'broken', entries: [{ path: 'index.html', bytes: new TextEncoder().encode('<img src="missing.png">') }] }
    ]);

    expect(report.valid).toBe(false);
    expect(report.siteCount).toBe(2);
    expect(report.errors.some((error) => error.siteName === 'broken')).toBe(true);
  });
});
