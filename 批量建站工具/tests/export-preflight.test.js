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

  it('reports unchanged source references as warnings when adding ads to a finished site', () => {
    const original = {
      'index.html': '<main>Approved site</main><iframe src="vendor-games/game/index.html"></iframe>',
      'vendor-games/game/index.html': '<script src="engine.js"></script>',
      'vendor-games/game/engine.js': 'require("./BundledInternalModule");',
      'vendor-games/game/theme.css': 'body { background: url("optional.png"); }'
    };
    const output = { ...original, 'index.html': original['index.html'] + '<script src="js/ad.js"></script>', 'js/ad.js': 'window.googletag = {};' };
    const report = preflight.inspectEntries(output, { originalEntries: original });
    expect(report.valid).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.inheritedIssues).toHaveLength(2);
    expect(report.warnings).toEqual([expect.objectContaining({ code: 'EXPORT_SOURCE_REFERENCE_UNCHANGED', count: 2 })]);
    expect(preflight.inspectEntries(output).valid).toBe(false);
  });

  it('resolves public assets only when checking framework source output', () => {
    const files = {
      'package.json': '{"dependencies":{"react":"19"}}',
      'index.html': '<script type="module" src="/src/main.jsx"></script><script defer src="/js/ad.js"></script>',
      'src/main.jsx': 'export default function App() { return null; }',
      'public/js/ad.js': 'window.googletag = { cmd: [] };'
    };
    expect(preflight.inspectEntries(files, { sourcePublicRoot: 'public/' }).valid).toBe(true);
    expect(preflight.inspectEntries(files).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'EXPORT_REFERENCE_MISSING', reference: '/js/ad.js' })]));
    delete files['public/js/ad.js'];
    expect(preflight.inspectEntries(files, { sourcePublicRoot: 'public/' }).valid).toBe(false);
  });

  it('still blocks new missing references and dropped original files even with inherited source issues', () => {
    const original = {
      'index.html': '<main>Approved site</main>',
      'vendor-games/theme.css': 'body { background: url("optional.png"); }',
      'images/unreferenced-cover.png': new Uint8Array([0, 255, 128])
    };
    const output = { ...original, 'index.html': original['index.html'] + '<script src="js/ad.js"></script>' };
    delete output['images/unreferenced-cover.png'];
    const report = preflight.inspectEntries(output, { originalEntries: original });
    expect(report.valid).toBe(false);
    expect(report.inheritedIssues).toHaveLength(1);
    expect(report.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'EXPORT_REFERENCE_MISSING', reference: 'js/ad.js' }),
      expect.objectContaining({ code: 'EXPORT_SOURCE_FILE_MISSING', path: 'images/unreferenced-cover.png' })
    ]));
  });

  it('matches inherited references to their originating script rather than another script at the same site root', () => {
    const original = { 'index.html': '<script src="js/site.js"></script>', 'js/site.js': 'fetch("./missing.json");' };
    const output = { ...original, 'index.html': original['index.html'] + '<script src="js/ad.js"></script>', 'js/ad.js': 'fetch("./missing.json");' };
    const report = preflight.inspectEntries(output, { originalEntries: original });
    expect(report.valid).toBe(false);
    expect(report.inheritedIssues).toHaveLength(1);
    expect(report.errors).toEqual([expect.objectContaining({ code: 'EXPORT_REFERENCE_MISSING', sourcePath: 'js/ad.js', reference: './missing.json' })]);
  });

  it('keeps source-reference comparisons scoped to each finished site in a batch', () => {
    const entries = [{ path: 'index.html', bytes: new TextEncoder().encode('<img src="missing.png">') }];
    const report = preflight.inspectSites([
      { name: 'inherited', entries, originalEntries: entries },
      { name: 'new-error', entries, originalEntries: [{ path: 'index.html', bytes: new TextEncoder().encode('<main>Healthy original</main>') }] }
    ]);
    expect(report.valid).toBe(false);
    expect(report.inheritedIssues).toEqual([expect.objectContaining({ siteName: 'inherited', reference: 'missing.png' })]);
    expect(report.errors).toEqual([expect.objectContaining({ siteName: 'new-error', code: 'EXPORT_REFERENCE_MISSING' })]);
  });

  it('does not downgrade invalid JSON or unsafe paths already present in a source archive', () => {
    const original = { 'index.html': '<main>Approved site</main>', 'manifest.json': '{', '../unsafe.js': '' };
    const report = preflight.inspectEntries(original, { originalEntries: original });
    expect(report.valid).toBe(false);
    expect(report.inheritedIssues).toEqual([]);
    expect(report.errors.map((error) => error.code)).toEqual(expect.arrayContaining(['EXPORT_JSON_INVALID', 'EXPORT_UNSAFE_ARCHIVE_PATH']));
  });
});
