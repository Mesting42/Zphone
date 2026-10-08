import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import JSZip from 'jszip';
import { createFinishedSourceExport } from '../js/finished-source-export.js';

const { DOMParser } = createRequire(import.meta.url)('../js/source-export-dom.cjs');
const context = { TextEncoder, TextDecoder, Uint8Array, Blob, DOMParser, JSZip, window: {} };
const source = name => readFileSync(new URL('../js/' + name, import.meta.url), 'utf8');
for (const filename of ['template-catalog.js', 'template-layouts.js', 'navbar-layout.js', 'data.js', 'domain.js', 'ad-migration.js', 'ad.js', 'generator.js', 'finished-site-ads.js', 'ad-restoration.js', 'export-preflight.js']) vm.runInNewContext(source(filename), context);
vm.runInNewContext('this.ads = AdRestoration; this.preflight = SiteExportPreflight;', context);
const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    if (!resolve(root).startsWith(resolve(tmpdir()) + sep + 'zphone-source-ads-test-')) throw new Error('Unexpected test cleanup path');
    rmSync(root, { recursive: true, force: true });
  }
});

const home = '<!doctype html><html><head><title>Original site</title></head><body><nav><a href="/">Home</a><a href="/games/2048/">2048</a></nav><main><section class="hero"><h1>Games</h1><p>Original content</p></section><section class="category-section"><h2>Games</h2><div class="items-grid">' + Array.from({ length: 8 }, (_, index) => '<article class="game-card"><a href="/games/2048/">Game ' + index + '</a></article>').join('') + '</div></section><section class="category-section"><h2>More games</h2><p>More original content</p></section></main><footer>Footer</footer></body></html>';
const detail = '<!doctype html><html><head><title>Game</title></head><body><nav><a href="/">Home</a><a href="/games/2048/">2048</a></nav><main><article><h1>2048</h1><p>First instructions</p><p>Second instructions</p><p>Third instructions</p><iframe src="/vendor-games/2048/index.html"></iframe></article></main><footer>Footer</footer></body></html>';
const vendor = '<!doctype html><html><head><title>Embedded game</title></head><body><canvas></canvas></body></html>';
const utf8 = value => new TextEncoder().encode(value);
const entry = (path, text) => ({ path, bytes: utf8(text) });
function projectEntries(extra = []) {
  return [
    entry('package.json', JSON.stringify({ name: 'original-site', private: true, type: 'module', scripts: { build: 'node scripts/build.mjs', postbuild: 'node scripts/after-build.cjs' } })),
    entry('scripts/build.mjs', `import { mkdirSync, rmSync, writeFileSync } from 'node:fs';\nrmSync('dist',{recursive:true,force:true});\nfor(const dir of ['dist/games/2048','dist/vendor-games/2048']) mkdirSync(dir,{recursive:true});\nwriteFileSync('dist/index.html',${JSON.stringify(home)});\nwriteFileSync('dist/games/2048/index.html',${JSON.stringify(detail)});\nwriteFileSync('dist/vendor-games/2048/index.html',${JSON.stringify(vendor)});`),
    entry('scripts/after-build.cjs', `require('node:fs').writeFileSync('original-postbuild-ran.txt','yes');`),
    entry('src/data/content.json', '{"title":"Editable source"}'),
    { path: 'src/assets/photo.bin', bytes: new Uint8Array([0, 255, 128, 37]) },
    entry('.tmp-audit/backup.txt', 'Original backup must remain.'),
    entry('LICENSE.txt', 'Original license must remain.'),
    entry('dist/index.html', home), entry('dist/games/2048/index.html', detail), entry('dist/vendor-games/2048/index.html', vendor),
    ...extra
  ];
}
function config(host = 'fixture.example.pro') {
  return { bannerPath1: '/123/' + host + '-banner1', bannerPath2: '/123/' + host + '-banner2', bannerPath3: '/123/' + host + '-banner3', interstitialPath: '/123/' + host + '-INT', anchorPath: '/123/' + host + '-ANC', analyticsID: 'G-FIXTURE123' };
}
function input(entries, host = 'fixture.example.pro') {
  const project = context.ads.classifyInjectableSiteEntries(entries, host);
  return { id: host, name: host, entries, project };
}
function settings(mode = 'manual', exportMode = 'source') {
  return { mode, version: 'v1.0.2.1', exportMode, policy: context.ads.createPolicy() };
}
async function exportBatch(entries, options = settings(), host = 'fixture.example.pro') {
  return context.ads.applyAdCodeBatch([input(entries, host)], [{ valid: true, detectedHost: host, config: config(host), warnings: [] }], undefined, options, undefined, createFinishedSourceExport);
}
function files(batch) { return new Map(batch.sites[0].entries.map(item => [item.path, Buffer.from(item.bytes)])); }
function unpack(entries) {
  const root = mkdtempSync(join(tmpdir(), 'zphone-source-ads-test-'));
  roots.push(root);
  for (const item of entries) {
    const filename = resolve(root, item.path);
    if (!filename.startsWith(root + sep)) throw new Error('Unsafe test fixture');
    mkdirSync(dirname(filename), { recursive: true });
    writeFileSync(filename, item.bytes);
  }
  return root;
}

describe('finished-site source export', () => {
  it('classifies editable React source correctly when root HTML references a built UI bundle', () => {
    const entries = [entry('package.json', JSON.stringify({ dependencies: { react: '19' }, scripts: { build: 'node scripts/build.mjs' } })),
      entry('index.html', '<html><head><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>'),
      entry('src/main.jsx', 'export default function App(){return <main>Source</main>}'), entry('dist/index.html', home)];
    const project = context.ads.classifyInjectableSiteEntries(entries, 'mixed-react');
    expect(project.kind).toBe('react-source');
    expect(context.ads.staticDeploymentSite({ name: 'mixed-react', entries, project }).entries.some(entry => entry.path === 'src/main.jsx')).toBe(false);
  });
  it('re-plans partially injected pages and stays free of duplicates on re-import', async () => {
    const partial = home.replace('</nav>', '</nav><div id="adv2"><div id="div-gpt-ad-banner2"></div></div>');
    const first = await exportBatch([entry('index.html', partial), entry('games/2048/index.html', detail)], settings('fixed', 'static'));
    const second = await exportBatch(first.sites[0].entries, settings('fixed', 'static'));
    for (const batch of [first, second]) {
      const html = files(batch).get('index.html').toString();
      for (const n of [1, 2, 3]) expect((html.match(new RegExp('id="div-gpt-ad-banner' + n + '"', 'g')) || []).length).toBe(1);
      expect((html.match(/securepubads\.g\.doubleclick\.net\/tag\/js\/gpt\.js/g) || []).length).toBe(1);
      expect(html.indexOf('id="adv3"')).toBeLessThan(html.indexOf('<footer'));
    }
  });
  it('exports only deployment files when static content is selected', async () => {
    const batch = await exportBatch(projectEntries(), settings('manual', 'static'));
    const output = files(batch);
    expect([...output.keys()]).toEqual(expect.arrayContaining(['index.html', 'games/2048/index.html', 'js/ad.js', 'ad-policy.json']));
    expect([...output.keys()].some(filename => /^(?:src|scripts|dist|\.sitefoundry-ads)\//.test(filename) || filename === 'package.json')).toBe(false);
    expect(batch.results[0].exportScope).toBe('仅静态站点部署副本');
    expect(context.preflight.inspectSites(batch.sites).valid).toBe(true);
  });

  for (const mode of ['manual', 'fixed']) it('preserves the complete source and restores ads after npm run build: ' + mode, async () => {
    const original = projectEntries();
    const before = original.map(item => Buffer.from(item.bytes));
    const batch = await exportBatch(original, settings(mode));
    const output = files(batch);
    for (const item of original) expect(output.has(item.path), item.path).toBe(true);
    for (const filename of ['scripts/build.mjs', 'src/data/content.json', 'src/assets/photo.bin', '.tmp-audit/backup.txt', 'LICENSE.txt', 'dist/vendor-games/2048/index.html']) {
      expect(output.get(filename)).toEqual(Buffer.from(original.find(item => item.path === filename).bytes));
    }
    original.forEach((item, index) => expect(Buffer.from(item.bytes)).toEqual(before[index]));
    expect(JSON.parse(output.get('package.json')).scripts.postbuild).toBe('node scripts/after-build.cjs && node .sitefoundry-ads/inject.cjs');
    expect(batch.report).toContain('构建后自动注入广告：.sitefoundry-ads/inject.cjs');
    expect(batch.report).toContain('fixture.example.pro/dist/js/ad.js');
    expect(context.preflight.inspectSites(batch.sites).valid).toBe(true);
    const zip = await JSZip.loadAsync(await (await context.ads.zipPolicyBatch(batch)).arrayBuffer());
    expect(zip.file('fixture.example.pro/src/assets/photo.bin')).not.toBeNull();
    const root = unpack(batch.sites[0].entries);
    expect(process.env.npm_execpath && existsSync(process.env.npm_execpath)).toBeTruthy();
    const rebuild = spawnSync(process.execPath, [process.env.npm_execpath, 'run', 'build'], { cwd: root, encoding: 'utf8', windowsHide: true });
    expect(rebuild.status, rebuild.stdout + rebuild.stderr).toBe(0);
    expect(readFileSync(join(root, 'original-postbuild-ran.txt'), 'utf8')).toBe('yes');
    expect(readFileSync(join(root, 'dist/js/ad.js'), 'utf8')).toContain('/123/fixture.example.pro-banner1');
    for (const filename of ['dist/index.html', 'dist/games/2048/index.html']) {
      const html = readFileSync(join(root, filename), 'utf8');
      expect(html).toContain('js/ad.js');
      expect((html.match(/id="div-gpt-ad-banner1"/g) || []).length).toBe(1);
      if (mode === 'manual') for (const n of [2, 3]) expect((html.match(new RegExp('id="div-gpt-ad-banner' + n + '"', 'g')) || []).length).toBe(1);
    }
    expect(readFileSync(join(root, 'dist/vendor-games/2048/index.html'), 'utf8')).toBe(vendor);
    expect(rebuild.stdout).not.toContain('恢复时将在');
    const again = spawnSync(process.execPath, [join(root, '.sitefoundry-ads/inject.cjs')], { cwd: root, encoding: 'utf8', windowsHide: true });
    expect(again.status, again.stdout + again.stderr).toBe(0);
    expect((readFileSync(join(root, 'dist/index.html'), 'utf8').match(/id="div-gpt-ad-banner1"/g) || []).length).toBe(1);
  }, 15000);

  it('retains all original project files when importing a wrapped source ZIP', async () => {
    const zip = new JSZip();
    for (const item of projectEntries()) zip.file('original-project/' + item.path, item.bytes);
    const archive = await zip.generateAsync({ type: 'uint8array' });
    Object.defineProperty(archive, 'name', { value: 'fixture.example.pro.zip' });
    const scan = await context.ads.readInjectableArchiveFiles([archive]);
    expect(scan.sites[0].sourceEntries.map(item => item.path)).toEqual(expect.arrayContaining(['package.json', 'scripts/build.mjs', 'src/data/content.json', '.tmp-audit/backup.txt']));
    const batch = await context.ads.applyAdCodeBatch(scan.sites, [{ valid: true, detectedHost: 'fixture.example.pro', config: config(), warnings: [] }], undefined, settings(), undefined, createFinishedSourceExport);
    expect(files(batch).has('dist/js/ad.js')).toBe(true);
    expect(files(batch).has('dist/dist/index.html')).toBe(false);
  });

  it('recognizes source-only static generators and retains the complete directory upload', async () => {
    const entries = projectEntries().filter(item => !item.path.startsWith('dist/'));
    expect(context.ads.classifyInjectableSiteEntries(entries, 'fixture.example.pro')).toMatchObject({ valid: true, framework: '静态网站源码工程（预览时构建）' });
    const inputFiles = entries.map(item => ({ name: item.path.split('/').pop(), webkitRelativePath: 'original-project/' + item.path, arrayBuffer: async () => item.bytes.buffer }));
    const scan = await context.ads.readInjectableDirectoryFiles(inputFiles);
    expect(scan.sites).toHaveLength(1);
    expect(scan.sites[0].project.valid).toBe(true);
    expect(scan.sites[0].entries.map(item => item.path)).toEqual(expect.arrayContaining(['package.json', 'scripts/build.mjs', 'src/assets/photo.bin']));
  });

  it('does not accumulate lifecycle hooks when an exported source project is reimported', async () => {
    const first = await exportBatch(projectEntries());
    const second = await exportBatch(first.sites[0].entries);
    const pkg = JSON.parse(files(second).get('package.json'));
    expect(pkg.scripts.postbuild.match(/sitefoundry-ads\/inject\.cjs/g)).toHaveLength(1);
    expect(JSON.parse(files(second).get('.sitefoundry-ads/config.json')).originalPostbuild).toBe('node scripts/after-build.cjs');
  });

  it('writes the complete source and hidden build helper through the directory export path', async () => {
    const batch = await exportBatch(projectEntries());
    const saved = new Map();
    function handle(prefix = '') {
      return {
        kind: 'directory', getDirectoryHandle: async name => handle(prefix + name + '/'),
        getFileHandle: async name => ({ createWritable: async () => ({ write: async value => saved.set(prefix + name, value), close: async () => {} }) })
      };
    }
    await context.ads.writePolicyBatchToDirectory(batch, handle());
    const prefix = batch.folderName + '/fixture.example.pro/';
    expect(saved.has(prefix + '.sitefoundry-ads/inject.cjs')).toBe(true);
    expect(saved.has(prefix + 'dist/js/ad.js')).toBe(true);
    expect(Buffer.from(saved.get(prefix + 'src/assets/photo.bin'))).toEqual(Buffer.from([0, 255, 128, 37]));
  });

  it('blocks source output if an original unreferenced file is dropped or an unsafe path is added', async () => {
    const batch = await exportBatch(projectEntries());
    batch.sites[0].entries = batch.sites[0].entries.filter(item => item.path !== 'src/assets/photo.bin');
    batch.sites[0].entries.push(entry('../outside.js', 'bad'));
    const report = context.preflight.inspectSites(batch.sites);
    expect(report.valid).toBe(false);
    expect(report.errors.map(item => item.code)).toEqual(expect.arrayContaining(['EXPORT_SOURCE_FILE_MISSING', 'EXPORT_UNSAFE_ARCHIVE_PATH']));
  });

  it('keeps plain HTML source editable without adding a build hook', async () => {
    const batch = await exportBatch([entry('index.html', home), entry('games/2048/index.html', detail), entry('vendor-games/2048/index.html', vendor)]);
    const output = files(batch);
    expect(output.has('js/ad.js')).toBe(true);
    expect(output.has('package.json')).toBe(false);
    expect(output.has('.sitefoundry-ads/inject.cjs')).toBe(false);
    expect(batch.results[0].buildHook).toBe('');
  });

  it('rejects unknown export modes and collisions with user-owned helper files', async () => {
    await expect(exportBatch(projectEntries(), settings('manual', 'unknown'))).rejects.toThrow('无法识别导出内容');
    await expect(exportBatch(projectEntries([entry('.sitefoundry-ads/notes.txt', 'user-owned')]))).rejects.toThrow('已有同名目录');
    const rootBuild = projectEntries().filter(item => !item.path.startsWith('dist/')).concat([entry('index.html', home), entry('games/2048/index.html', detail)]);
    await expect(exportBatch(rootBuild)).rejects.toThrow('构建输出位于源码根目录');
  });

  it('exports the provided React deployment when explicitly selected and requires source output when none exists', async () => {
    const entries = [entry('package.json', '{"dependencies":{"react":"19"}}'), entry('src/App.jsx', 'export default () => <main>Original</main>;'), entry('dist/index.html', '<html><head></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>'), entry('dist/assets/app.js', 'document.getElementById("root").innerHTML="<nav>Menu</nav><main>Original</main>";')];
    const site = input(entries);
    expect(context.ads.staticDeploymentSite(site).entries.map(item => item.path)).toEqual(['index.html', 'assets/app.js']);
    const batch = await exportBatch(entries, settings('fixed', 'static'));
    expect(files(batch).has('src/App.jsx')).toBe(false);
    expect(files(batch).has('js/ad.js')).toBe(true);
    const withoutBuild = input(entries.slice(0, 2));
    expect(() => context.ads.staticDeploymentSite(withoutBuild)).toThrow('没有可导出的静态构建产物');
  });
});
