import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import JSZip from 'jszip';

const context = { TextEncoder, TextDecoder, Blob, Response, DecompressionStream, JSZip };
const source = (name) => readFileSync(new URL('../js/' + name, import.meta.url), 'utf8');
vm.runInNewContext(source('data.js') + '\nthis.__themes = THEMES;', context);
vm.runInNewContext(source('domain.js'), context);
vm.runInNewContext(source('ad-migration.js') + '\nthis.__migration = AdMigration;', context);
vm.runInNewContext(source('generator.js') + '\nthis.__generator = Generator;', context);
vm.runInNewContext(source('ad-restoration.js') + '\nthis.__restoration = AdRestoration;', context);

const oldAdJs = `
// const bannerPath1 = "/23334460889/zp0903a.example.pro-banner1";
const bannerPath2 = "/23334460889/zp0903a.example.pro-banner2";
// const bannerPath3 = "/23334460889/zp0903a.example.pro-banner3";
// const bannerPath4 = "/23334460889/zp0903a.example.pro-banner3";
// const interstitialPath = "/23334460889/zp0903a.example.pro-INT";
// const anchorPath = "/23334460889/zp0903a.example.pro-ANC";
const analyticsID = "G-RESTORE123";`;

const wrongAd = '<div id="adv2"><div>advertisement</div><div id="div-gpt-ad-banner2"></div></div>';
const homeHtml = `<!doctype html><html><head>
<script defer src="js/ad.js"></script><script defer src="js/ad.js"></script>
</head><body><nav class="navbar glass-sticky"></nav>${wrongAd}
<section class="hero"></section><main class="main-content"><div class="container">
<section class="category-section"><div class="items-grid"></div></section>
<section class="category-section"><div class="items-grid"></div></section>
<section class="category-section"><div class="items-grid"></div></section>
</div></main><footer class="footer"></footer></body></html>`;

const detailHtml = `<!doctype html><html><head></head><body><nav class="navbar dark-fixed"></nav>
${wrongAd}<div class="detail-page"><h1>Title</h1><div class="detail-content"><p>Body</p></div>
${wrongAd}<div class="related-section"></div></div><footer class="footer"></footer></body></html>`;

const legacyDynamicHomeScript = `(function() {
  var CONFIG = {
    categories: [{ name: 'One' }, { name: 'Two' }, { name: 'Three' }],
    homeAds: {"after-navbar":"<div id=\\"adv1\\"><div id=\\"div-gpt-ad-banner1\\"></div></div>"}
  };
  function renderCategories() {
    var mainContent = document.querySelector('.main-content .container');
    mainContent.innerHTML = '';
    for (var c = 0; c < CONFIG.categories.length; c++) {
      var section = document.createElement('section');
      section.className = 'category-section';
      mainContent.appendChild(section);
      var afterSectionKey = 'after-section-' + c;
      if (CONFIG.homeAds && CONFIG.homeAds[afterSectionKey]) {
        var ad = document.createElement('div');
        ad.innerHTML = CONFIG.homeAds[afterSectionKey];
        mainContent.appendChild(ad);
      }
    }
  }
})();`;

function count(sourceText, needle) {
  return sourceText.split(needle).length - 1;
}

async function siteArchive(name, adSource = oldAdJs) {
  const input = new JSZip();
  input.file('website/index.html', homeHtml);
  input.file('website/details/article1.html', detailHtml);
  input.file('website/js/ad.js', adSource);
  input.file('website/images/cover.jpg', new Uint8Array([10, 20, 30, 40]));
  const bytes = await input.generateAsync({ type: 'uint8array' });
  Object.defineProperty(bytes, 'name', { value: name });
  return bytes;
}

describe('batch ad restoration', () => {
  it('reads the original ad units directly from commented source code', () => {
    const result = context.__restoration.inspectSiteEntries([
      { path: 'website/index.html', text: homeHtml },
      { path: 'website/details/article1.html', text: detailHtml },
      { path: 'website/js/ad.js', text: oldAdJs }
    ], 'backup.zip');
    expect(result.valid).toBe(true);
    expect(result.detectedHost).toBe('zp0903a.example.pro');
    expect(result.siteRoot).toBe('website/');
    expect(result.detailPaths).toEqual(['website/details/article1.html']);
    expect(result.embeddedConfig).toMatchObject({
      bannerPath1: '/23334460889/zp0903a.example.pro-banner1',
      bannerPath2: '/23334460889/zp0903a.example.pro-banner2',
      bannerPath3: '/23334460889/zp0903a.example.pro-banner3',
      bannerPath4: '/23334460889/zp0903a.example.pro-banner3',
      interstitialPath: '/23334460889/zp0903a.example.pro-INT',
      anchorPath: '/23334460889/zp0903a.example.pro-ANC'
    });
    expect(result.configDerivedKeys).toEqual([]);
  });

  it('keeps bannerPath4 empty when a source only defines banner1 through banner3', () => {
    const threeBannerSource = [
      'const bannerPath1 = "/23334460889/zp0903a.example.pro-banner1";',
      'const bannerPath2 = "/23334460889/zp0903a.example.pro-banner2";',
      'const bannerPath3 = "/23334460889/zp0903a.example.pro-banner3";',
      'const interstitialPath = "/23334460889/zp0903a.example.pro-INT";',
      'const anchorPath = "/23334460889/zp0903a.example.pro-ANC";'
    ].join('\n');
    const result = context.__restoration.inspectSiteEntries([
      { path: 'website/index.html', text: homeHtml },
      { path: 'website/details/article1.html', text: detailHtml },
      { path: 'website/js/ad.js', text: threeBannerSource }
    ], 'three-banners.zip');
    expect(result.valid).toBe(true);
    expect(result.embeddedConfig.bannerPath4).toBe('');
    expect(result.configDerivedKeys).not.toContain('bannerPath4');
  });

  it('can recover cleared paths from the surviving standard banner2 unit', () => {
    const result = context.__restoration.inspectSiteEntries([
      { path: 'website/index.html', text: homeHtml },
      { path: 'website/details/article1.html', text: detailHtml },
      { path: 'website/js/ad.js', text: 'const bannerPath2 = "/23334460889/zp0903a.example.pro-banner2";' }
    ], 'limited.zip');
    expect(result.valid).toBe(true);
    expect(result.embeddedConfig.interstitialPath).toBe('/23334460889/zp0903a.example.pro-INT');
    expect(result.embeddedConfig.anchorPath).toBe('/23334460889/zp0903a.example.pro-ANC');
    expect(result.warnings.map((item) => item.code)).toContain('RESTORE_PATHS_DERIVED');
  });

  it('exports recognized source ads as a TXT accepted by the normal builder', () => {
    const metadata = context.__restoration.inspectSiteEntries([
      { path: 'website/index.html', text: homeHtml },
      { path: 'website/details/article1.html', text: detailHtml },
      { path: 'website/js/ad.js', text: oldAdJs }
    ], 'source.zip');
    const text = context.__restoration.generateRecognizedAdCode(metadata.embeddedConfig, 'source.zip');
    const parsed = context.__migration.inspectAdCodeText(text, 'zpls512.vizocean.top.txt');
    expect(parsed.valid).toBe(true);
    expect(parsed.config).toMatchObject({
      bannerPath1: '/23334460889/zp0903a.example.pro-banner1',
      bannerPath2: '/23334460889/zp0903a.example.pro-banner2',
      bannerPath3: '/23334460889/zp0903a.example.pro-banner3',
      interstitialPath: '/23334460889/zp0903a.example.pro-INT',
      anchorPath: '/23334460889/zp0903a.example.pro-ANC',
      analyticsID: 'G-RESTORE123'
    });
  });

  it('replaces disabled and duplicated containers with default placements', () => {
    const entries = [
      { path: 'website/index.html', text: homeHtml },
      { path: 'website/details/article1.html', text: detailHtml },
      { path: 'website/js/ad.js', text: oldAdJs },
      { path: 'website/images/cover.jpg', bytes: new Uint8Array([1, 2, 3]) }
    ];
    const config = context.__restoration.inspectSiteEntries(entries, 'backup.zip').embeddedConfig;
    const result = context.__restoration.restoreEntries(entries, config, 'backup.zip');

    expect(result.valid).toBe(true);
    const files = Object.fromEntries(result.entries.map((entry) => [entry.path, entry]));
    const home = new TextDecoder().decode(files['website/index.html'].bytes);
    const detail = new TextDecoder().decode(files['website/details/article1.html'].bytes);
    const adJs = new TextDecoder().decode(files['website/js/ad.js'].bytes);

    ['banner1', 'banner2', 'banner3'].forEach((name) => {
      expect(count(home, 'id="div-gpt-ad-' + name + '"')).toBe(1);
      expect(count(detail, 'id="div-gpt-ad-' + name + '"')).toBe(1);
    });
    expect(count(home, 'securepubads.g.doubleclick.net/tag/js/gpt.js')).toBe(1);
    expect(count(home, 'src="js/ad.js"')).toBe(1);
    expect(count(detail, 'src="../js/ad.js"')).toBe(1);
    expect(home.indexOf('div-gpt-ad-banner1')).toBeLessThan(home.indexOf('class="hero"'));
    expect(home.indexOf('div-gpt-ad-banner2')).toBeLessThan(home.indexOf('div-gpt-ad-banner3'));
    expect(detail.indexOf('div-gpt-ad-banner1')).toBeLessThan(detail.indexOf('class="detail-page"'));
    expect(detail.indexOf('div-gpt-ad-banner2')).toBeGreaterThan(detail.indexOf('class="detail-content"'));
    expect(detail.indexOf('div-gpt-ad-banner3')).toBeLessThan(detail.indexOf('class="footer"'));
    expect(adJs).toContain('const bannerPath1 = "/23334460889/zp0903a.example.pro-banner1";');
    expect(adJs).toContain('const interstitialPath = "/23334460889/zp0903a.example.pro-INT";');
    expect(adJs).toContain('const anchorPath = "/23334460889/zp0903a.example.pro-ANC";');
    expect(Array.from(files['website/images/cover.jpg'].bytes)).toEqual([1, 2, 3]);
  });

  it('is idempotent and does not stack scripts or containers on a second pass', () => {
    const first = context.__restoration.restoreHtml(homeHtml, 'home', 'js/ad.js');
    const second = context.__restoration.restoreHtml(first.html, 'home', 'js/ad.js');
    expect(first.valid).toBe(true);
    expect(second.valid).toBe(true);
    expect(second.html).toBe(first.html);
    expect(context.__generator.generateAdJs(context.__restoration.readExistingConfig(oldAdJs))).toContain('BOTTOM_ANCHOR');
  });

  it('uses the correct relative ad.js path for nested detail pages', () => {
    expect(context.__restoration.relativeAdScriptPath('website/details/article1.html', 'website/')).toBe('../js/ad.js');
    expect(context.__restoration.relativeAdScriptPath('website/articles/2026/article1.html', 'website/')).toBe('../../js/ad.js');
  });

  it('round-trips a real ZIP and keeps non-page assets intact', async () => {
    const siteFile = await siteArchive('zp0903a.example.pro-backup.zip');

    const output = await context.__restoration.restoreBatch([siteFile]);
    expect(output.fileName).toBe('zp0903a.example.pro-backup-ads-restored.zip');
    expect(output.results[0]).toMatchObject({ valid: true, changedPages: 2 });

    const restored = await JSZip.loadAsync(await output.blob.arrayBuffer());
    expect(await restored.file('website/index.html').async('text')).toContain('div-gpt-ad-banner1');
    expect(await restored.file('website/details/article1.html').async('text')).toContain('src="../js/ad.js"');
    expect(Array.from(await restored.file('website/images/cover.jpg').async('uint8array'))).toEqual([10, 20, 30, 40]);
  });

  it('restores banner2/3 in legacy dynamic home renderers that replace the static HTML', () => {
    const dynamicHomeHtml = homeHtml.replace('</body>', '<script src="js/script.js"></script></body>');
    const restored = context.__restoration.restoreEntries([
      { path: 'website/index.html', text: dynamicHomeHtml },
      { path: 'website/details/article1.html', text: detailHtml },
      { path: 'website/js/ad.js', text: oldAdJs },
      { path: 'website/js/script.js', text: legacyDynamicHomeScript }
    ], context.__restoration.inspectSiteEntries([
      { path: 'website/index.html', text: dynamicHomeHtml },
      { path: 'website/details/article1.html', text: detailHtml },
      { path: 'website/js/ad.js', text: oldAdJs }
    ], 'legacy.zip').embeddedConfig, 'legacy.zip');

    expect(restored.valid).toBe(true);
    const runtimeScript = restored.entries.find((entry) => entry.path === 'website/js/script.js');
    const runtimeSource = new TextDecoder().decode(runtimeScript.bytes);
    expect(runtimeSource).toContain('"after-section-0"');
    expect(runtimeSource).toContain('div-gpt-ad-banner2');
    expect(runtimeSource).toContain('"after-section-1"');
    expect(runtimeSource).toContain('div-gpt-ad-banner3');
    const restoredHome = restored.entries.find((entry) => entry.path === 'website/index.html');
    expect(new TextDecoder().decode(restoredHome.bytes)).toContain('src="js/script.js?v=ads-restored-1"');
  });

  it('reads RAR site packages for both ad workflows through the local archive runtime', async () => {
    const cleanHome = homeHtml.replace(/<script defer src="js\/ad\.js"><\/script>/g, '').replaceAll(wrongAd, '');
    const cleanDetail = detailHtml.replaceAll(wrongAd, '');
    let opened = 0;
    let closed = 0;
    context.ArchiveRuntimeReady = Promise.resolve({
      open: async () => {
        opened += 1;
        return {
          extractFiles: async () => {},
          getFilesArray: async () => [
            { path: 'rar-site/', file: { name: 'index.html', arrayBuffer: async () => new TextEncoder().encode(cleanHome).buffer } },
            { path: 'rar-site/details/', file: { name: 'article1.html', arrayBuffer: async () => new TextEncoder().encode(cleanDetail).buffer } }
          ],
          close: async () => { closed += 1; }
        };
      }
    });
    const rar = new Blob(['mock-rar']);
    Object.defineProperty(rar, 'name', { value: 'rar-site.rar' });

    const policyScan = await context.__restoration.readSiteArchiveFiles([rar]);
    const injectionScan = await context.__restoration.readInjectableArchiveFiles([rar]);

    expect(policyScan.sites).toHaveLength(1);
    expect(injectionScan.sites).toHaveLength(1);
    expect(injectionScan.sites[0].project).toMatchObject({ valid: true, kind: 'static-html' });
    expect(opened).toBe(2);
    expect(closed).toBe(2);
  });

  it('restores multiple sites independently from each archive source', async () => {
    const hostB = 'zp0903b.example.pro';
    const oldAdJsB = oldAdJs.replaceAll('zp0903a.example.pro', hostB);
    const output = await context.__restoration.restoreBatch(
      [await siteArchive('first-backup.zip'), await siteArchive('second-backup.zip', oldAdJsB)]
    );

    expect(output.results.map((item) => [item.archiveName, item.host])).toEqual([
      ['first-backup.zip', 'zp0903a.example.pro'],
      ['second-backup.zip', hostB]
    ]);
    const batch = await JSZip.loadAsync(await output.blob.arrayBuffer());
    expect(batch.file('first-backup-ads-restored.zip')).not.toBeNull();
    expect(batch.file('second-backup-ads-restored.zip')).not.toBeNull();
    expect(await batch.file('广告恢复报告.txt').async('text')).toContain('[成功] second-backup.zip');
  });

  it('exports one TXT for one site and a ZIP of TXT files for multiple sites', async () => {
    const single = await context.__restoration.exportRecognizedAdCodes([await siteArchive('single.zip')]);
    expect(single.fileName).toBe('zp0903a.example.pro-ad-code.txt');
    expect(await single.blob.text()).toContain('zp0903a.example.pro-ANC');

    const hostB = 'zp0903b.example.pro';
    const batchOutput = await context.__restoration.exportRecognizedAdCodes([
      await siteArchive('first.zip'),
      await siteArchive('second.zip', oldAdJs.replaceAll('zp0903a.example.pro', hostB))
    ]);
    const batch = await JSZip.loadAsync(await batchOutput.blob.arrayBuffer());
    expect(batch.file('recognized-ad-codes/zp0903a.example.pro-ad-code.txt')).not.toBeNull();
    expect(batch.file('recognized-ad-codes/' + hostB + '-ad-code.txt')).not.toBeNull();
    expect(await batch.file('广告代码识别报告.txt').async('text')).toContain('[成功] second.zip');
  });

  it('applies a traffic-limit policy while preserving every original ad path', () => {
    const entries = [
      { path: 'index.html', text: homeHtml },
      { path: 'details/article1.html', text: detailHtml },
      { path: 'js/ad.js', text: oldAdJs },
      { path: 'js/script.js', text: legacyDynamicHomeScript }
    ];
    const metadata = context.__restoration.inspectSiteEntries(entries, 'site-a');
    const policy = context.__restoration.createPolicy('traffic-limit');
    const result = context.__restoration.restoreEntries(entries, metadata.embeddedConfig, 'site-a', policy);

    expect(result.valid).toBe(true);
    const files = Object.fromEntries(result.entries.map((entry) => [entry.path, new TextDecoder().decode(entry.bytes)]));
    const visibleHome = files['index.html'].replace(/<!--[\s\S]*?-->/g, '');
    const visibleDetail = files['details/article1.html'].replace(/<!--[\s\S]*?-->/g, '');
    expect(visibleHome).not.toContain('div-gpt-ad-banner1');
    expect(visibleHome).not.toContain('div-gpt-ad-banner2');
    expect(visibleHome).toContain('div-gpt-ad-banner3');
    expect(visibleHome.indexOf('div-gpt-ad-banner3')).toBeLessThan(visibleHome.indexOf('class="hero"'));
    expect(visibleDetail).not.toContain('div-gpt-ad-banner1');
    expect(visibleDetail).not.toContain('div-gpt-ad-banner2');
    expect(visibleDetail).not.toContain('div-gpt-ad-banner3');
    expect(files['index.html']).toContain('AD_POLICY_DISABLED_START banner1 page=home');
    expect(files['details/article1.html']).toContain('AD_POLICY_DISABLED_START banner3 page=detail');
    expect(files['js/ad.js']).toContain('const bannerPath1 = "/23334460889/zp0903a.example.pro-banner1";');
    expect(files['js/ad.js']).toContain('// AD_POLICY_DISABLED interstitial page=home (广告路径保留)');
    expect(files['js/ad.js']).toContain('// AD_POLICY_DISABLED anchor page=detail (广告路径保留)');
    expect(JSON.parse(files['ad-policy.json']).policy).toMatchObject(policy);
    expect(files['js/script.js']).toContain('div-gpt-ad-banner3');
    expect(files['js/script.js']).not.toContain('div-gpt-ad-banner1');
  });

  it('supports policy-only closure without emitting literal source comments', () => {
    const entries = [
      { path: 'index.html', text: homeHtml },
      { path: 'details/article1.html', text: detailHtml },
      { path: 'js/ad.js', text: oldAdJs }
    ];
    const metadata = context.__restoration.inspectSiteEntries(entries, 'site-a');
    const policy = context.__restoration.createPolicy('traffic-limit');
    policy.writeDisabledComments = false;
    const result = context.__restoration.restoreEntries(entries, metadata.embeddedConfig, 'site-a', policy);
    const files = Object.fromEntries(result.entries.map((entry) => [entry.path, new TextDecoder().decode(entry.bytes)]));
    expect(result.valid).toBe(true);
    expect(files['index.html']).not.toContain('AD_POLICY_DISABLED_START');
    expect(files['js/ad.js']).not.toContain('AD_POLICY_DISABLED interstitial');
    expect(files['js/ad.js']).toContain('const interstitialPath = "/23334460889/zp0903a.example.pro-INT";');
    expect(JSON.parse(files['ad-policy.json']).policy.writeDisabledComments).toBe(false);
  });

  it('supports a global policy with one independent site override', async () => {
    function group(name, host) {
      const adSource = oldAdJs.replaceAll('zp0903a.example.pro', host);
      const entries = [
        { path: 'index.html', text: homeHtml },
        { path: 'details/article1.html', text: detailHtml },
        { path: 'js/ad.js', text: adSource }
      ];
      return { id: name, name, entries, metadata: context.__restoration.inspectSiteEntries(entries, name) };
    }
    const globalPolicy = context.__restoration.createPolicy('traffic-limit');
    const override = context.__restoration.createPolicy('home-head-footer');
    override.slots.detail.find((slot) => slot.unit === 'banner2').unit = 'off';
    const output = await context.__restoration.applyPolicyBatch(
      [group('site-a', 'site-a.example'), group('site-b', 'site-b.example')],
      globalPolicy,
      { 'site-b': override }
    );

    expect(output.sites).toHaveLength(2);
    expect(output.results.map((item) => item.overridden)).toEqual([false, true]);
    const siteA = Object.fromEntries(output.sites[0].entries.map((entry) => [entry.path, new TextDecoder().decode(entry.bytes)]));
    const siteB = Object.fromEntries(output.sites[1].entries.map((entry) => [entry.path, new TextDecoder().decode(entry.bytes)]));
    const visibleA = siteA['index.html'].replace(/<!--[\s\S]*?-->/g, '');
    const visibleB = siteB['index.html'].replace(/<!--[\s\S]*?-->/g, '');
    expect(visibleA).toContain('div-gpt-ad-banner3');
    expect(visibleA).not.toContain('div-gpt-ad-banner1');
    expect(visibleB).toContain('div-gpt-ad-banner1');
    expect(visibleB).toContain('div-gpt-ad-banner3');
    expect(visibleB).not.toContain('div-gpt-ad-banner2');
    expect(output.report).toContain('site-b（单站覆盖）');
  });

  it('can replace the banner unit used by any ad position', () => {
    const entries = [
      { path: 'index.html', text: homeHtml },
      { path: 'details/article1.html', text: detailHtml },
      { path: 'js/ad.js', text: oldAdJs }
    ];
    const metadata = context.__restoration.inspectSiteEntries(entries, 'unit-remap');
    const policy = context.__restoration.createPolicy();
    policy.slots.home = [
      { position: 'after-navbar', unit: 'banner3' },
      { position: 'after-section-0', unit: 'banner1' },
      { position: 'footer-top', unit: 'banner2' }
    ];
    policy.slots.detail = [
      { position: 'after-navbar', unit: 'banner2' },
      { position: 'detail-after-content', unit: 'banner3' },
      { position: 'footer-top', unit: 'banner1' }
    ];
    const result = context.__restoration.restoreEntries(entries, metadata.embeddedConfig, 'unit-remap', policy);
    expect(result.valid).toBe(true);
    const files = Object.fromEntries(result.entries.map((entry) => [entry.path, new TextDecoder().decode(entry.bytes)]));
    const home = files['index.html'].replace(/<!--[\s\S]*?-->/g, '');
    const detail = files['details/article1.html'].replace(/<!--[\s\S]*?-->/g, '');
    expect(home.indexOf('div-gpt-ad-banner3')).toBeLessThan(home.indexOf('class="hero"'));
    expect(home.indexOf('div-gpt-ad-banner1')).toBeGreaterThan(home.indexOf('class="category-section"'));
    expect(home.indexOf('div-gpt-ad-banner2')).toBeLessThan(home.indexOf('class="footer"'));
    expect(detail.indexOf('div-gpt-ad-banner2')).toBeLessThan(detail.indexOf('class="detail-page"'));
    expect(detail.indexOf('div-gpt-ad-banner3')).toBeGreaterThan(detail.indexOf('class="detail-content"'));
    expect(detail.indexOf('div-gpt-ad-banner1')).toBeLessThan(detail.indexOf('class="footer"'));
  });

  it('rejects duplicate banner units on the same page', () => {
    const policy = context.__restoration.createPolicy();
    policy.slots.home[0].unit = 'banner3';
    expect(context.__restoration.validatePolicy(policy).map((item) => item.code)).toContain('AD_POLICY_DUPLICATE_UNIT');
  });

  it('splits a directly selected parent directory into independent sites', () => {
    const allEntries = [];
    ['alpha.test', 'beta.test'].forEach((name) => {
      allEntries.push({ path: 'parent/' + name + '/index.html', text: homeHtml });
      allEntries.push({ path: 'parent/' + name + '/details/article1.html', text: detailHtml });
      allEntries.push({ path: 'parent/' + name + '/js/ad.js', text: oldAdJs.replaceAll('zp0903a.example.pro', name) });
    });
    const sites = context.__restoration.splitSiteEntries(allEntries);
    expect(sites.map((site) => site.name)).toEqual(['alpha.test', 'beta.test']);
    expect(sites.every((site) => site.entries.some((entry) => entry.path === 'index.html'))).toBe(true);
    expect(sites.map((site) => site.metadata.detectedHost)).toEqual(['alpha.test', 'beta.test']);
  });

  it('reads only detected site folders from a selected parent directory', async () => {
    const encoder = new TextEncoder();
    function localFile(relativePath, text) {
      return {
        name: relativePath.split('/').pop(),
        webkitRelativePath: relativePath,
        arrayBuffer: async () => encoder.encode(text).buffer
      };
    }
    const files = [
      localFile('Downloads/site.test/index.html', homeHtml),
      localFile('Downloads/site.test/details/article1.html', detailHtml),
      localFile('Downloads/site.test/js/ad.js', oldAdJs.replaceAll('zp0903a.example.pro', 'site.test')),
      {
        name: 'large-unrelated.bin',
        webkitRelativePath: 'Downloads/large-unrelated.bin',
        arrayBuffer: async () => { throw new Error('unrelated file should not be read'); }
      }
    ];
    const scan = await context.__restoration.readSiteDirectoryFiles(files);
    expect(scan.fileCount).toBe(3);
    expect(scan.sites).toHaveLength(1);
    expect(scan.sites[0].name).toBe('site.test');
  });

  it('reads a local directory handle without loading unrelated file contents', async () => {
    const encoder = new TextEncoder();
    let unrelatedRead = false;
    function fileHandle(name, text, onRead) {
      return {
        kind: 'file',
        name,
        getFile: async () => {
          if (onRead) onRead();
          return { arrayBuffer: async () => encoder.encode(text).buffer };
        }
      };
    }
    function directoryHandle(name, children) {
      return {
        kind: 'directory',
        name,
        async *entries() {
          for (const child of children) yield [child.name, child];
        }
      };
    }
    const site = directoryHandle('site.test', [
      fileHandle('index.html', homeHtml),
      directoryHandle('details', [fileHandle('article1.html', detailHtml)]),
      directoryHandle('js', [fileHandle('ad.js', oldAdJs.replaceAll('zp0903a.example.pro', 'site.test'))])
    ]);
    const root = directoryHandle('Downloads', [
      site,
      fileHandle('large-unrelated.bin', 'unused', () => { unrelatedRead = true; })
    ]);
    const scan = await context.__restoration.readSiteDirectoryHandle(root);
    expect(scan.fileCount).toBe(3);
    expect(scan.sites).toHaveLength(1);
    expect(scan.sites[0].name).toBe('site.test');
    expect(unrelatedRead).toBe(false);
  });

  it('injects advertiser code into an ad-free static finished site', () => {
    const cleanHome = homeHtml.replace(/<script defer src="js\/ad\.js"><\/script>/g, '').replaceAll(wrongAd, '');
    const cleanDetail = detailHtml.replaceAll(wrongAd, '');
    const config = context.__restoration.readExistingConfig(oldAdJs);
    const project = context.__restoration.classifyInjectableSiteEntries([
      { path: 'index.html', text: cleanHome },
      { path: 'details/article1.html', text: cleanDetail }
    ], 'zp0903a.example.pro');
    expect(project).toMatchObject({ valid: true, kind: 'static-html', framework: '静态 HTML 多页面站' });

    const output = context.__restoration.injectAdsIntoSiteEntries([
      { path: 'index.html', text: cleanHome },
      { path: 'details/article1.html', text: cleanDetail }
    ], config, 'zp0903a.example.pro');
    expect(output.valid).toBe(true);
    const files = Object.fromEntries(output.entries.map((entry) => [entry.path, new TextDecoder().decode(entry.bytes)]));
    expect(files['index.html']).toContain('div-gpt-ad-banner1');
    expect(files['details/article1.html']).toContain('src="../js/ad.js?v=ad-policy-1"');
    expect(files['js/ad.js']).toContain('zp0903a.example.pro-ANC');
  });

  it('injects a route-aware runtime into a built React site', () => {
    const reactIndex = '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module" src="/assets/index-AbC123.js"></script></body></html>';
    const config = context.__restoration.readExistingConfig(oldAdJs);
    const project = context.__restoration.classifyInjectableSiteEntries([
      { path: 'index.html', text: reactIndex },
      { path: 'assets/index-AbC123.js', text: 'document.getElementById("root")' }
    ], 'zp0903a.example.pro');
    expect(project).toMatchObject({ valid: true, kind: 'react-build', runtimePath: 'js/ad-spa-runtime.js' });

    const output = context.__restoration.injectAdsIntoSiteEntries([
      { path: 'index.html', text: reactIndex },
      { path: 'assets/index-AbC123.js', text: 'document.getElementById("root")' }
    ], config, 'zp0903a.example.pro');
    expect(output.valid).toBe(true);
    const files = Object.fromEntries(output.entries.map((entry) => [entry.path, new TextDecoder().decode(entry.bytes)]));
    expect(files['index.html']).toContain('data-sitefoundry-ad-runtime="loader"');
    expect(files['js/ad-spa-runtime.js']).toContain('MutationObserver');
    expect(files['js/ad-spa-runtime.js']).toContain("'pushState','replaceState'");
    expect(files['js/ad-spa-runtime.js']).toContain('zp0903a.example.pro-banner3');
    expect(files['ad-injection.json']).toContain('React 构建产物');
  });

  it('supports Vite React source projects and blocks unbuilt Next.js projects', () => {
    const vitePackage = JSON.stringify({ dependencies: { react: '^19.0.0' }, devDependencies: { vite: '^7.0.0' } });
    const vite = context.__restoration.classifyInjectableSiteEntries([
      { path: 'package.json', text: vitePackage },
      { path: 'index.html', text: '<html><head></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>' },
      { path: 'src/main.jsx', text: 'import React from "react";' }
    ], 'react-source');
    expect(vite).toMatchObject({ valid: true, kind: 'react-vite-source', runtimePath: 'public/js/ad-spa-runtime.js', runtimeSrc: '/js/ad-spa-runtime.js' });

    const nextPackage = JSON.stringify({ dependencies: { react: '^19.0.0', next: '^15.0.0' } });
    const next = context.__restoration.classifyInjectableSiteEntries([
      { path: 'package.json', text: nextPackage },
      { path: 'app/page.jsx', text: 'export default function Page(){}' }
    ], 'next-source');
    expect(next.valid).toBe(false);
    expect(next.errors.map((item) => item.code)).toContain('AD_INJECTION_NEXT_BUILD_REQUIRED');
  });

  it('matches multiple finished sites to advertiser TXT files by domain', () => {
    const cleanHome = homeHtml.replace(/<script defer src="js\/ad\.js"><\/script>/g, '').replaceAll(wrongAd, '');
    const cleanDetail = detailHtml.replaceAll(wrongAd, '');
    function site(name) {
      const entries = [{ path: 'index.html', text: cleanHome }, { path: 'details/article1.html', text: cleanDetail }];
      return { id: name, name, entries, project: context.__restoration.classifyInjectableSiteEntries(entries, name) };
    }
    function code(host) {
      const text = context.__restoration.generateRecognizedAdCode(context.__restoration.readExistingConfig(oldAdJs.replaceAll('zp0903a.example.pro', host)), host);
      return context.__migration.inspectAdCodeText(text, host + '.txt');
    }
    const matched = context.__restoration.matchAdCodesToSites(
      [site('main.example.pro'), site('child.main.example.pro')],
      [code('child.main.example.pro'), code('main.example.pro')]
    );
    expect(matched.validCount).toBe(2);
    expect(matched.mappings.map((item) => item.host)).toEqual(['main.example.pro', 'child.main.example.pro']);
  });
});
