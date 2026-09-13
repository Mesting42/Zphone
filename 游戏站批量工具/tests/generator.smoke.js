const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { gzipSync } = require('node:zlib');

const root = path.resolve(__dirname, '..');
let generatedFiles = {};

vm.runInThisContext(
    fs.readFileSync(path.join(root, 'js', 'data.js'), 'utf8') +
    '\n; PrincipalTheme = THEMES; PrincipalStyles = STYLE_PRESETS; PrincipalGameBrands = GAME_BRAND_PRESETS; PrincipalGameEmojiIcons = GAME_EMOJI_ICONS; PrincipalGameIconSets = GAME_ICON_SET_PRESETS;'
);
vm.runInThisContext(
    fs.readFileSync(path.join(root, 'js', 'ad-migration.js'), 'utf8') +
    '\n; PrincipalAdMigration = AdMigration;'
);
vm.runInThisContext(
    fs.readFileSync(path.join(root, 'js', 'generator.js'), 'utf8') +
    '\n; PrincipalGenerator = Generator;'
);

class ZipMock {
    constructor(prefix = '', rootNode = null) {
        this.prefix = prefix;
        this.rootNode = rootNode || { files: {} };
    }

    folder(name) {
        return new ZipMock(this.prefix + name + '/', this.rootNode);
    }

    file(name, contents) {
        this.rootNode.files[this.prefix + name] = contents;
        return this;
    }

    async generateAsync(options, onProgress) {
        if (onProgress) onProgress({ percent: 100 });
        generatedFiles = this.rootNode.files;
        return new Blob(['ok']);
    }
}

globalThis.JSZip = ZipMock;
vm.runInThisContext(
    fs.readFileSync(path.join(root, 'js', 'game-zip-import.js'), 'utf8') +
    '\n; PrincipalGameZipImport = GameZipImport;'
);
vm.runInThisContext(
    fs.readFileSync(path.join(root, 'js', 'saved-game-catalogs.js'), 'utf8') +
    '\n; PrincipalSavedGameCatalogs = SavedGameCatalogs;'
);

const baseGames = JSON.parse(fs.readFileSync(path.join(root, 'gamesData.json'), 'utf8'));
const embeddedGamesScript = fs.readFileSync(path.join(root, 'js', 'games-data.js'), 'utf8');

const parsedAdCode = PrincipalAdMigration.inspectAdCodeText(`
    googletag.defineSlot('/233344606889/zp0903a.vibory.pro-banner1', [[300, 250]], 'slot-1');
    googletag.defineSlot('/233344606889/zp0903a.vibory.pro-banner2', [[300, 250]], 'slot-2');
    googletag.defineSlot('/233344606889/zp0903a.vibory.pro-banner3', [[300, 250]], 'slot-3');
    googletag.defineSlot('/233344606889/zp0903a.vibory.pro-int', [[320, 480]], 'slot-int');
    googletag.defineSlot('/233344606889/zp0903a.vibory.pro-anc', [[320, 50]], 'slot-anc');
    gtag('config', 'G-Z5JQ643FJG');
`, 'zp0903a.vibory.pro.txt');
assert.equal(parsedAdCode.valid, true, 'matching TXT ad slots should be accepted');
assert.equal(parsedAdCode.detectedHost, 'zp0903a.vibory.pro', 'ad host must omit slot suffixes');

function relativeLuminanceFromHex(hex) {
    const normalized = String(hex).replace('#', '');
    const components = [0, 2, 4].map(function(index) {
        const channel = parseInt(normalized.slice(index, index + 2), 16) / 255;
        return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return components[0] * 0.2126 + components[1] * 0.7152 + components[2] * 0.0722;
}

function contrastRatioFromHex(first, second) {
    const firstLuminance = relativeLuminanceFromHex(first);
    const secondLuminance = relativeLuminanceFromHex(second);
    return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

function createTar(entries) {
    const encoder = new TextEncoder();
    const encoded = entries.map(function(entry) { return { path: entry.path, body: encoder.encode(entry.text) }; });
    const length = encoded.reduce(function(total, entry) {
        return total + 512 + Math.ceil(entry.body.length / 512) * 512;
    }, 1024);
    const archive = new Uint8Array(length);
    let offset = 0;
    encoded.forEach(function(entry) {
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

const embeddedContext = { window: {} };
vm.runInNewContext(embeddedGamesScript, embeddedContext);
assert.deepEqual(
    JSON.parse(JSON.stringify(embeddedContext.window.BUILTIN_GAME_DATA)),
    baseGames,
    'file protocol data bundle must stay in sync with gamesData.json'
);
const openSourceContext = { window: {} };
vm.runInNewContext(
    fs.readFileSync(path.join(root, 'js', 'open-source-games-bundle.js'), 'utf8'),
    openSourceContext
);
const openSourceBundle = openSourceContext.window.OPEN_SOURCE_GAME_BUNDLE;
assert.equal(openSourceBundle.games.length, 72, 'first open-source batch must contain 72 games');
assert.equal(openSourceBundle.source.license, 'MIT', 'open-source bundle must declare its license');
assert.equal(new Set(openSourceBundle.games.map(game => game.id)).size, 72, 'open-source game ids must be unique');
const openSourceAssetDependencies = [];
openSourceBundle.games.forEach(function(game) {
    assert.match(game.url, /^games\/[a-z0-9._-]+\.html$/i, 'bundled game must use a safe local URL');
    assert.match(game.coverData, /^data:image\/(?:webp|png|svg\+xml);base64,/, 'bundled game must include an exportable cover');
    assert.match(game.gameHtml, /<!doctype html/i, 'bundled game source must contain a complete HTML document');
    const refs = game.gameHtml.matchAll(/<(?:script|img|audio|video|source|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi);
    for (const match of refs) {
        if (!/^(?:data:|blob:|#|javascript:)/i.test(match[1])) {
            openSourceAssetDependencies.push(game.gameFile + ': ' + match[1]);
        }
    }
});
assert.deepEqual(openSourceAssetDependencies, [], 'bundled games must not depend on external asset files');
const bundledSourcesContext = { window: {} };
vm.runInNewContext(
    fs.readFileSync(path.join(root, 'js', 'built-in-game-sources.js'), 'utf8'),
    bundledSourcesContext
);
const bundledSources = bundledSourcesContext.window.BUILTIN_GAME_SOURCES;
assert.equal(bundledSources.length, 5, 'five supplied game sources must be available as built-in choices');
bundledSources.forEach(function(source, index) {
    assert.equal(source.gameCount, 84, 'built-in game source ' + (index + 1) + ' must declare 84 games');
    assert.ok(fs.existsSync(path.join(root, source.archive)), 'built-in game archive must be included: ' + source.archive);
});
const testGames = baseGames.map(item => ({ ...item }));
assert.ok(PrincipalTheme.game.cardFields.includes('content'), 'game cards must show descriptions by default');
assert.equal(typeof PrincipalSavedGameCatalogs.save, 'function', 'saved local catalog module must expose save');
assert.equal(typeof PrincipalSavedGameCatalogs.list, 'function', 'saved local catalog module must expose list');
assert.equal(typeof PrincipalSavedGameCatalogs.rename, 'function', 'saved local catalog module must expose rename');
assert.equal(typeof PrincipalSavedGameCatalogs.fingerprintData, 'function', 'saved local catalog module must expose content fingerprints');
assert.notEqual(
    PrincipalSavedGameCatalogs.fingerprintData(baseGames.slice(0, 2)),
    PrincipalSavedGameCatalogs.fingerprintData(baseGames.slice(1, 3)),
    'different game rows must not share a content fingerprint'
);
testGames[0].title = '<img src=x onerror=alert(1)>';
testGames[0].url = 'javascript:alert(1)';
testGames[1].thumbFallback = 'https://images.example.com/tower-small.png';

const state = {
    selectedTheme: 'game',
    data: testGames,
    fieldMapping: {
        title: 'title',
        content: 'description',
        image: 'thumb',
        store_url: 'url',
        id: 'id'
    },
    isLocalImages: false,
    localImages: {},
    adPlacementMode: null,
    _previewBlobUrls: [],
    config: {
        siteTitle: 'Arcade & Co',
        siteSubtitle: 'Play <fast>',
        contactEmail: 'hello@example.com',
        navLinks: ['home', 'about', 'contact', 'privacy', 'terms'],
        aboutEnabled: false,
        navbarLayout: 'centered',
        categories: [{ name: 'Featured', icon: '🌟', count: 8 }],
        cardFields: ['image', 'title', 'content'],
        relatedCount: 7,
        relatedCardFields: ['image', 'title'],
        adPlacements: { adv1: { home: 'cat-0-between-0-1' } },
        selectedStyle: 'dark',
        logoStyle: 'text-icon',
        logoIcon: '👾',
        randomSort: false
    }
};

(async function run() {
    const exportZipEngine = globalThis.JSZip;
    const zipFixturePayload = [{
        id: 'zip-demo-1', title: 'ZIP Demo One', description: 'A local ZIP cover test.',
        url: 'https://games.example.com/one', thumb: 'images/cover-one.png'
    }, {
        id: 'zip-demo-2', title: 'ZIP Demo Two', description: 'A second local ZIP cover test.',
        url: 'https://games.example.com/two', thumb: 'images/cover-two.jpg'
    }];
    const zipEntry = function(value) {
        return {
            dir: false,
            async: async function(type) {
                if (type === 'text') return value;
                if (type === 'base64') return Buffer.from(value).toString('base64');
                throw new Error('Unexpected ZIP fixture output type: ' + type);
            }
        };
    };
    globalThis.JSZip = {
        loadAsync: async function() {
            return { files: {
                'game-source-4/gamesData.json': zipEntry(JSON.stringify(zipFixturePayload)),
                'game-source-4/images/cover-one.png': zipEntry('png-bytes'),
                'game-source-4/images/cover-two.jpg': zipEntry('jpg-bytes')
            } };
        }
    };
    try {
        const importedZip = await PrincipalGameZipImport.importArchive(
            { name: 'game-source-4.zip' },
            function(payload) { return payload.filter(function(item) { return item.title && item.url && item.thumb; }); }
        );
        assert.equal(importedZip.recordCount, 2, 'nested ZIP imports must preserve every valid game');
        assert.equal(importedZip.jsonPath, 'game-source-4/gamesData.json', 'nested ZIP imports must locate gamesData.json');
        assert.match(importedZip.localImageDataUrls['cover-one.png'], /^data:image\/png;base64,/, 'PNG covers must become sandbox-safe data URLs');
        assert.match(importedZip.localImageDataUrls['cover-two.jpg'], /^data:image\/jpeg;base64,/, 'JPEG covers must become sandbox-safe data URLs');

        globalThis.JSZip = {
            loadAsync: async function() {
                return { files: {
                    'game-source-4/gamesData.json': zipEntry(JSON.stringify(zipFixturePayload))
                } };
            }
        };
        await assert.rejects(
            function() {
                return PrincipalGameZipImport.importArchive(
                    { name: 'missing-cover.zip' },
                    function(payload) { return payload.filter(function(item) { return item.title && item.url && item.thumb; }); }
                );
            },
            /ZIP 中缺少 2 张引用图片/,
            'missing local covers must name the ZIP image failure clearly'
        );
    } finally {
        globalThis.JSZip = exportZipEngine;
    }

    await PrincipalGenerator.exportWebsite(state, function() {});

    const indexHtml = generatedFiles['website/index.html'];
    const navigationHtml = indexHtml.slice(indexHtml.indexOf('<nav'), indexHtml.indexOf('</nav>') + 6);
    const footerHtml = indexHtml.slice(indexHtml.indexOf('<footer'));
    const siteCss = generatedFiles['website/css/style.css'];
    const allGamesHtml = generatedFiles['website/all-games.html'];
    const detailHtml = generatedFiles['website/details/article1.html'];
    const playableDetailHtml = generatedFiles['website/details/article2.html'];
    const browserScript = generatedFiles['website/js/script.js'];
    const homePreview = PrincipalGenerator.generatePreviewHtml(state, 'home');
    const detailPreview = PrincipalGenerator.generatePreviewHtml(state, 'detail');
    const selectedDetailPreview = PrincipalGenerator.generatePreviewHtml({
        ...state,
        selectedPreviewGameIndex: 1,
        _previewBlobUrls: []
    }, 'detail');

    assert.ok(indexHtml.includes('&lt;img src=x onerror=alert(1)&gt;'), 'title must be escaped');
    assert.ok(!indexHtml.includes('<img src=x onerror=alert(1)>'), 'raw title must not reach HTML');
    assert.ok(indexHtml.includes('data-static-rendered="true"'), 'home cards must be statically rendered');
    assert.equal((navigationHtml.match(/<li>/g) || []).length, 3, 'header navigation must contain Home, each configured category, and the all-games page when the homepage is capped');
    assert.ok(navigationHtml.includes('>Home</a>'), 'header navigation must retain Home');
    assert.ok(!navigationHtml.includes('Privacy Policy'), 'legal links must not be repeated in the header');
    assert.ok(navigationHtml.includes('href="#category-featured">Featured</a>'), 'header navigation must link to the configured category');
    assert.ok(navigationHtml.includes('href="all-games.html">All Games</a>'), 'header navigation must expose the complete game list');
    assert.ok(indexHtml.includes('href="all-games.html">View All ' + testGames.length + ' Games</a>'), 'homepage must link to all items after its featured cap');
    assert.ok(indexHtml.includes('<section id="category-featured"'), 'category section must have a matching anchor');
    assert.ok(detailHtml.includes('href="../index.html#category-featured">Featured</a>'), 'detail navigation must return to the category anchor on the homepage');
    assert.ok(detailHtml.includes('href="../all-games.html">All Games</a>'), 'detail navigation must expose the complete game list');
    assert.ok(allGamesHtml, 'a complete game list page must be exported when the homepage is capped');
    assert.equal((allGamesHtml.match(/class="item-card"/g) || []).length, testGames.length, 'all-games page must render every imported game');
    assert.ok(footerHtml.includes('href="privacy.html"'), 'privacy link must remain in the footer');
    assert.ok(footerHtml.includes('href="terms.html"'), 'terms link must remain in the footer');
    assert.ok(footerHtml.includes('href="contact.html"'), 'contact link must remain in the footer');
    assert.ok(!indexHtml.includes('id="adv1"'), 'normal build must ignore legacy manual ad placements');
    assert.ok(indexHtml.includes('navbar-centered'), 'navbar layout must affect markup');
    assert.ok(indexHtml.includes('category-section category-featured'), 'first game group must use the featured two-card layout');
    assert.ok(indexHtml.includes('class="card-desc"'), 'game descriptions must be rendered by default');
    assert.ok(!indexHtml.includes('<section class="hero">'), 'Hero must be disabled by default');
    assert.equal((indexHtml.match(/class="item-card"/g) || []).length, 2, 'first category must be capped at two games');
    assert.ok(indexHtml.includes('layout-classic'), 'generated pages must include a layout template class');
    assert.ok(indexHtml.includes('data-fallback-src="https://images.example.com/tower-small.png"'), 'high-resolution covers must keep a safe fallback image');
    assert.ok(indexHtml.includes('<title>Arcade &amp; Co</title>'), 'custom site title must be escaped');
    assert.ok(indexHtml.includes('class="logo-emoji" aria-hidden="true">👾</span> Arcade &amp; Co'), 'selected game emoji must be rendered beside the custom brand title');
    [detailHtml, generatedFiles['website/contact.html'], generatedFiles['website/privacy.html'], generatedFiles['website/terms.html']].forEach(function(pageHtml) {
        const inlineScripts = pageHtml.matchAll(/<script>([\s\S]*?)<\/script>/g);
        for (const match of inlineScripts) assert.doesNotThrow(function() { new Function(match[1]); }, 'every fixed page must emit a parsable navigation script');
    });
    assert.ok(siteCss.includes('@media (max-width: 480px)'), 'generated site must include compact mobile card styles');
    assert.ok(siteCss.includes('.footer-content { grid-template-columns: repeat(2, minmax(0, 1fr));'), 'mobile detailed footer must use a compact two-column flow');
    assert.ok(siteCss.includes('.footer-section:last-child {\n        grid-column: 1 / -1;'), 'mobile contact information must stay compact on one footer row');
    assert.ok(!siteCss.includes('.item-card .card-desc {\n        display: none;'), 'mobile cards must not hide an enabled game description');
    assert.ok(siteCss.includes('-webkit-line-clamp: 2;\n        overflow: hidden;\n        margin-bottom: 0;'), 'mobile game descriptions must use a compact two-line clamp');
    assert.ok(!indexHtml.includes('href="about.html"'), 'disabled About page must not leave a link');
    assert.ok(!generatedFiles['website/about.html'], 'disabled About page must not be generated');
    assert.ok(!generatedFiles['website/generate_details.py'], 'placeholder Python export must not be included');
    assert.ok(!detailHtml.includes('javascript:alert(1)'), 'unsafe action URL must be removed');
    assert.ok(homePreview.includes('data-preview-game-index="0"'), 'home preview cards must expose their game index');
    assert.ok(homePreview.includes('data-preview-page="all"'), 'homepage preview must expose the complete game list');
    assert.equal((PrincipalGenerator.generatePreviewHtml(state, 'all').match(/class="item-card"/g) || []).length, testGames.length, 'all-games preview must render every imported game');
    assert.ok(homePreview.includes("type: 'preview-game'"), 'preview card clicks must notify the parent controls');
    const previewScriptMatch = homePreview.match(/<script>([\s\S]*?)<\/script>/);
    const previewListeners = {};
    const previewMessages = [];
    const previewDocument = {
        querySelector: function() { return null; },
        addEventListener: function(type, listener) { previewListeners[type] = listener; }
    };
    assert.doesNotThrow(function() {
        new Function('document', 'window', previewScriptMatch[1])(
            previewDocument,
            { parent: { postMessage: function(message) { previewMessages.push(message); } } }
        );
    }, 'preview click interception script must parse and initialize');
    const previewCardTarget = {
        dataset: { previewGameIndex: '1' },
        closest: function(selector) { return selector === '[data-preview-game-index]' ? this : null; }
    };
    previewListeners.click({
        target: previewCardTarget,
        preventDefault: function() {},
        stopPropagation: function() {}
    });
    assert.deepEqual(previewMessages, [{ type: 'preview-game', index: 1 }], 'clicking a preview game card must request its detail preview instead of navigating the iframe');
    assert.ok(selectedDetailPreview.includes('<h1 class="detail-title">TowerBuster</h1>'), 'detail preview must render the game selected from a card');
    assert.ok(selectedDetailPreview.includes('data-preview-page="home"'), 'detail preview back link must preserve parent-controlled navigation');
    const buttonBackLinkPreview = PrincipalGenerator.generatePreviewHtml({
        ...state,
        config: { ...state.config, backLinkStyle: 'button' },
        _previewBlobUrls: []
    }, 'detail', testGames[0], 0);
    assert.ok(buttonBackLinkPreview.includes('class="back-link button"'), 'detail preview must apply the configured return-home button class');
    assert.ok(buttonBackLinkPreview.includes('.back-link.button {'), 'detail preview must include the return-home button CSS');
    const glassBackLinkPreview = PrincipalGenerator.generatePreviewHtml({
        ...state,
        config: { ...state.config, backLinkStyle: 'glass' },
        _previewBlobUrls: []
    }, 'detail', testGames[0], 0);
    assert.ok(glassBackLinkPreview.includes('class="back-link glass"'), 'detail preview must apply the extended glass return-home style');
    assert.ok(glassBackLinkPreview.includes('.back-link.glass {'), 'detail preview must include extended return-home CSS');

    const iconBackLinkPreview = PrincipalGenerator.generatePreviewHtml({
        ...state,
        config: { ...state.config, backLinkStyle: 'icon' },
        _previewBlobUrls: []
    }, 'detail', testGames[0], 0);
    assert.ok(iconBackLinkPreview.includes('class="back-link icon"'), 'detail preview must apply the icon-square return-home style');
    assert.ok(iconBackLinkPreview.includes('class="back-link-icon-svg"'), 'icon-square return-home style must render the dedicated SVG arrow');
    assert.ok(iconBackLinkPreview.includes('align-items: center;') && iconBackLinkPreview.includes('justify-content: center;'), 'icon-square return-home style must center its icon on both axes');
    const directAdConfig = PrincipalGenerator.buildConfig({
        ...state,
        siteBuildMode: 'normal',
        adCodeMigration: { valid: true, config: { bannerPath1: '/1/demo-banner1', bannerPath2: '/1/demo-banner2', bannerPath3: '/1/demo-banner3' } }
    });
    assert.equal(directAdConfig.adMigration.valid, true, 'validated TXT ad code must be forwarded for a normal game site');
    assert.deepEqual(directAdConfig.adPaths.bannerPath1, '/1/demo-banner1', 'normal game-site ads must use the validated TXT paths');
    assert.deepEqual(directAdConfig.adPlacements, {
        adv1: { home: 'after-navbar', detail: 'after-navbar' },
        adv2: { home: 'after-section-0', detail: 'detail-after-content' },
        adv3: { home: 'after-section-1', detail: 'footer-top' }
    }, 'validated TXT ads must use the same automatic placements as the news tool');
    const directAdPreview = PrincipalGenerator.generatePreviewHtml({
        ...state,
        siteBuildMode: 'normal',
        adCodeMigration: { valid: true, config: { bannerPath1: '/1/demo-banner1', bannerPath2: '/1/demo-banner2', bannerPath3: '/1/demo-banner3' } },
        _previewBlobUrls: []
    }, 'home');
    assert.ok(directAdPreview.includes('div-gpt-ad-banner1'), 'validated TXT ads must render an automatic first ad container in preview');
    const manualAdPreview = PrincipalGenerator.generatePreviewHtml({
        ...state,
        config: { ...state.config, adPlacements: { adv1: { home: 'after-navbar' } } },
        adCodeMigration: null,
        _previewBlobUrls: []
    }, 'home');
    assert.ok(manualAdPreview.includes('div-gpt-ad-banner1'), 'manual placement must remain visible as an ad placeholder in preview before TXT validation');
    assert.ok(homePreview.includes('#adv1 + .main-content'), 'a homepage ad must not be followed by the default large content padding');
    assert.ok(selectedDetailPreview.includes('#adv1 + .detail-page'), 'a detail-page ad must not be followed by the default large detail padding');
    const manualAdExportConfig = PrincipalGenerator.buildConfig({
        ...state,
        config: { ...state.config, adPlacements: { adv1: { home: 'after-navbar' } } },
        adCodeMigration: null
    });
    assert.deepEqual(manualAdExportConfig.adPlacements, {}, 'manual preview placeholders must not produce empty ad slots in exported sites without validated TXT code');
    const adPlacementPreview = PrincipalGenerator.generatePreviewHtml({
        ...state,
        adPlacementMode: 'adv3',
        _previewBlobUrls: []
    }, 'home');
    assert.ok(adPlacementPreview.includes('data-position="cat-0-after-last"'), 'ad placement mode must retain markers outside the card grid');
    assert.ok(!adPlacementPreview.includes('data-position="cat-0-between-0-1"'), 'ad placement mode must not insert markers between cards and disrupt the card grid');
    assert.ok(adPlacementPreview.includes('常用广告位 · 导航栏下方'), 'ad placement mode must visibly label common placement targets');
    const detailAdPlacementPreview = PrincipalGenerator.generatePreviewHtml({
        ...state,
        adPlacementMode: 'adv3',
        _previewBlobUrls: []
    }, 'detail');
    assert.ok(detailAdPlacementPreview.includes('常用广告位 · 正文后'), 'detail placement mode must clearly expose the common after-content target');
    assert.ok(playableDetailHtml.includes('<iframe src="https://xp1.gamecenter.top/TowerBuster"'), 'valid games must be playable inside the detail page');
    assert.ok(!indexHtml.includes('securepubads'), 'ad network must not load without configured paths');
    assert.ok(!generatedFiles['website/js/ad.js'], 'normal build must not output ad.js');
    assert.equal(PrincipalGameBrands.length, 50, 'brand menu must provide 50 game title presets');
    assert.equal(PrincipalGameEmojiIcons.length, 48, 'game emoji picker must provide 48 icons');
    assert.equal(PrincipalGameIconSets.length, 24, 'category menu must provide 24 icon combinations');
    assert.equal(new Set(PrincipalGameBrands).size, PrincipalGameBrands.length, 'brand title presets must be unique');
    assert.equal((detailPreview.match(/class="related-card"/g) || []).length, 7, 'preview must honor related count');
    assert.equal(
        Object.keys(generatedFiles).filter(file => /^website\/details\/article/.test(file)).length,
        testGames.length,
        'one detail page must be generated per game'
    );
    assert.doesNotThrow(() => new Function(browserScript), 'generated browser script must parse');

    const sideDrawerPreview = PrincipalGenerator.generatePreviewHtml({
        ...state,
        config: { ...state.config, navbarStyle: 'side-drawer' },
        _previewBlobUrls: []
    }, 'home');
    const sideDrawerNav = sideDrawerPreview.slice(sideDrawerPreview.indexOf('<nav'), sideDrawerPreview.indexOf('</nav>') + 6);
    assert.ok(!sideDrawerNav.includes('class="nav-links"'), 'side-drawer navigation must not render a second primary menu');
    assert.ok(sideDrawerPreview.includes('<ul class="drawer-nav">'), 'side-drawer navigation must retain its single drawer menu');
    assert.equal((sideDrawerPreview.match(/class="drawer-nav"/g) || []).length, 1, 'side-drawer navigation must render exactly one drawer menu');
    assert.ok(sideDrawerPreview.includes('aria-controls="site-navigation-drawer"') && sideDrawerPreview.includes('aria-expanded="false"'), 'drawer controls must expose their target and initial state to assistive technology');
    assert.ok(sideDrawerPreview.includes("event.key === 'Escape'") && sideDrawerPreview.includes('function closeNavigation()'), 'every preview navigation must support Escape-to-close and a shared close path');

    const gradientLogoPreview = PrincipalGenerator.generatePreviewHtml({
        ...state,
        config: { ...state.config, logoStyle: 'gradient-text' },
        _previewBlobUrls: []
    }, 'home');
    assert.ok(gradientLogoPreview.includes('class="logo logo-gradient-text"'), 'gradient Logo selection must use the dedicated gradient class');
    assert.ok(gradientLogoPreview.includes('linear-gradient(100deg, #22d3ee 0%, #7c3aed 34%, #ec4899 67%, #f59e0b 100%)'), 'gradient Logo must retain distinct, visible color stops');
    assert.ok(!gradientLogoPreview.includes('linear-gradient(135deg, var(--color-primary), var(--color-text))'), 'gradient Logo must not fall back to theme colors that can collapse into a solid color');

    const navbarToolHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const navbarOptionBlock = navbarToolHtml.match(/<select id="navbar-style">([\s\S]*?)<\/select>/);
    assert.ok(navbarOptionBlock, 'the header-style selector must be present in the tool');
    const navbarStyles = Array.from(navbarOptionBlock[1].matchAll(/<option value="([^"]+)">/g), function(match) { return match[1]; });
    assert.equal(navbarStyles.length, 15, 'every game header style must be covered by the navigation regression check');
    navbarStyles.forEach(function(navbarStyle) {
        const preview = PrincipalGenerator.generatePreviewHtml({
            ...state,
            config: { ...state.config, navbarStyle: navbarStyle },
            _previewBlobUrls: []
        }, 'detail');
        assert.ok(preview.includes('nav-' + navbarStyle), navbarStyle + ' must retain its generated navbar class');
        assert.ok(preview.includes("event.key === 'Escape'") && preview.includes('aria-expanded'), navbarStyle + ' must retain the shared accessible menu controls');
        if (navbarStyle === 'side-drawer') {
            const nav = preview.slice(preview.indexOf('<nav'), preview.indexOf('</nav>') + 6);
            assert.ok(!nav.includes('class="nav-links"') && preview.includes('class="drawer-nav"'), 'side-drawer must expose exactly one interactive menu');
        } else {
            assert.ok(preview.includes('id="site-navigation" class="nav-links"'), navbarStyle + ' must retain the regular menu target');
        }
    });

    const modernNavigationPreview = PrincipalGenerator.generatePreviewHtml({
        ...state,
        config: { ...state.config, navbarStyle: 'floating-pill', footerStyle: 'brand-grid' },
        _previewBlobUrls: []
    }, 'home');
    assert.ok(modernNavigationPreview.includes('nav-floating-pill'), 'floating navigation must receive its generated style class');
    assert.ok(modernNavigationPreview.includes('footer-brand-grid'), 'brand-grid footer must receive its generated style class');
    assert.ok(modernNavigationPreview.includes('.navbar.nav-floating-pill'), 'floating navigation CSS must be exported to preview');

    const expandedNavigationPreview = PrincipalGenerator.generatePreviewHtml({
        ...state,
        config: { ...state.config, navbarStyle: 'split-brand' },
        _previewBlobUrls: []
    }, 'home');
    assert.ok(expandedNavigationPreview.includes('nav-split-brand'), 'brand split navigation must receive its generated style class');
    assert.ok(expandedNavigationPreview.includes('.navbar.nav-command-bar'), 'expanded navigation CSS must include the command bar variant');
    assert.ok(expandedNavigationPreview.includes('.navbar.nav-editorial'), 'expanded navigation CSS must include the editorial variant');
    assert.ok(expandedNavigationPreview.includes('height: auto !important;'), 'mobile menus must override desktop full-height navigation variants');
    assert.ok(expandedNavigationPreview.includes('min-height: 44px;'), 'mobile menu links must remain full-width, tap-friendly rows for every header style');

    const staleBottomFixedConfig = PrincipalGenerator.buildConfig({
        ...state,
        config: { ...state.config, navbarStyle: 'bottom-fixed' }
    });
    assert.equal(staleBottomFixedConfig.style.navbarStyle, 'glass-sticky', 'legacy bottom-fixed selections must fall back to the standard sticky navigation');
    const toolHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const toolCss = fs.readFileSync(path.join(root, 'css', 'tool.css'), 'utf8');
    const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
    assert.ok(toolHtml.includes('id="card-description-mode"'), 'card description controls must appear in the structure configuration');
    assert.ok(toolHtml.includes('class="ad-slot-header"') && toolHtml.includes('class="ad-slot-actions"'), 'ad placement cards must expose structured header and action regions');
    assert.ok(toolHtml.includes('class="config-item contact-email-control"'), 'contact-email help text must use a dedicated layout control');
    assert.ok(toolCss.includes('.config-item.contact-email-control'), 'contact-email help text must not share the input row on desktop');
    assert.ok(toolCss.includes('box-sizing: border-box;') && toolCss.includes('border: 1px solid #b9cce0;'), 'preview iframe must retain a visible border on every edge');
    assert.ok(toolCss.includes('.custom-select-menu') && toolCss.includes('position: fixed;'), 'configuration select menus must use the custom fixed-layer menu instead of browser-native option popups');
    assert.ok(toolCss.includes('.ad-container-config') && toolCss.includes('background: linear-gradient(135deg, #fff 0%, #f5f9fe 100%);'), 'ad placement cards must match the light configuration-panel visual system');
    assert.ok(toolCss.includes('.custom-select-menu::-webkit-scrollbar') && toolCss.includes('scrollbar-color: #8ba3c0 transparent;'), 'custom select menus must use the shared, non-native scrollbar styling');
    assert.ok(toolCss.includes('.custom-select-menu.is-scrollable') && appSource.includes("control.menu.classList.toggle('is-scrollable', shouldScroll)"), 'short custom-select menus must avoid scrolling until their content exceeds the available space');
    assert.ok(toolCss.includes('.preview-frame-wrapper::-webkit-scrollbar-thumb') && toolCss.includes('background: #7891af;'), 'preview workspace scrolling must use the styled light-tool scrollbar');
    assert.ok(homePreview.includes('--preview-scrollbar-track:') && homePreview.includes('html::-webkit-scrollbar-thumb'), 'the generated preview site must style its own internal scrollbar');
    assert.ok(appSource.includes('function initCustomConfigSelects()'), 'configuration selects must initialize a reusable custom-select control');
    assert.ok(appSource.includes("#tab-structure .config-item select, #tab-style .config-item select"), 'all configuration-panel selects must receive the custom-select treatment');
    assert.ok(appSource.includes('configLayout.dataset.previewSize = normalizedSize'), 'preview device selection must update the shared configuration workspace state');
    assert.ok(toolCss.includes('.config-layout[data-preview-size="tablet"] { --preview-workspace-height: 1094px; }'), 'tablet preview must expand the shared configuration workspace height');
    assert.ok(toolCss.includes('.config-layout[data-preview-size="mobile"] { --preview-workspace-height: 882px; }'), 'mobile preview must expand the shared configuration workspace height');
    assert.ok(!toolHtml.includes('id="card-desc-lines"'), 'description length must not be hidden in the style configuration');
    assert.ok(homePreview.includes('-webkit-line-clamp: 2;'), 'game cards must default to a short two-line description');
    const oneLineDescriptionPreview = PrincipalGenerator.generatePreviewHtml({
        ...state,
        config: { ...state.config, cardDescLines: '1' }
    }, 'home');
    const threeLineDescriptionPreview = PrincipalGenerator.generatePreviewHtml({
        ...state,
        config: { ...state.config, cardDescLines: '3' }
    }, 'home');
    const fullDescriptionPreview = PrincipalGenerator.generatePreviewHtml({
        ...state,
        config: { ...state.config, cardDescLines: '0' }
    }, 'home');
    assert.ok(oneLineDescriptionPreview.includes('font-size: 11px;\n        display: -webkit-box;\n        -webkit-line-clamp: 1;'), 'one-line descriptions must remain one line in the mobile card rules');
    assert.ok(threeLineDescriptionPreview.includes('font-size: 11px;\n        display: -webkit-box;\n        -webkit-line-clamp: 3;'), 'three-line descriptions must remain three lines in the mobile card rules');
    assert.ok(fullDescriptionPreview.includes('font-size: 11px;\n        display: block;\n        -webkit-line-clamp: unset;'), 'full descriptions must not be clamped in the mobile card rules');
    assert.ok(!toolHtml.includes('<option value="bottom-fixed">'), 'bottom-fixed must not remain selectable in the tool');
    assert.ok(!/randomPick\(\['glass-sticky', 'normal', 'transparent', 'dark-fixed', 'side-drawer', 'bottom-fixed'\]\)/.test(appSource), 'random assembly must not choose bottom-fixed');
    assert.ok(appSource.includes('delete currentPlacement[currentPage];'), 'repositioning an ad must remove its old placement on the active preview page');
    assert.ok(appSource.includes('appState.adPlacementMode = adId;'), 'repositioning an ad must immediately enter placement mode');
    assert.ok(toolHtml.includes('<option value="floating-pill">浮动胶囊</option>'), 'the tool must provide modern floating navigation');
    assert.ok(toolHtml.includes('<option value="segmented">分段导航</option>'), 'the tool must provide modern segmented navigation');
    assert.ok(toolHtml.includes('<option value="brand-grid">品牌分栏</option>'), 'the tool must provide a modern brand-grid footer');
    assert.ok(!toolHtml.includes('GamePix 在线目录'), 'online GamePix catalog must not remain selectable in the tool');
    assert.ok(!appSource.includes('games.gamepix.com'), 'online GamePix request logic must be removed');
    assert.ok(toolHtml.includes('id="rename-saved-catalog"'), 'saved catalogs must provide a rename control');
    assert.ok(toolHtml.includes('<option value="builtin-source-5">内置游戏源 5 · 84 款</option>'), 'all five supplied sources must appear in the source menu');
    assert.ok(appSource.includes('loadBundledGameSource'), 'built-in source choices must load their packaged archive on demand');
    assert.match(appSource, /replaceGameData\(archive\.payload, isZip \? 'json-zip' : 'json-archive', sourceLabel, \{/, 'ZIP and extended-archive imports must retain their local image assets');
    assert.ok(toolHtml.includes('id="btn-reupload"'), 'an imported game catalog must expose a re-upload action');
    assert.ok(toolHtml.includes('id="notice-overlay"'), 'the tool must use an in-app notice dialog');
    assert.ok(!/\balert\s*\(/.test(appSource), 'browser alert prompts must not remain in the game workflow');
    assert.ok(!/\bconfirm\s*\(/.test(appSource), 'browser confirm prompts must not remain in the game workflow');
    assert.ok(toolHtml.includes('.rar,.7z'), 'game data import must accept RAR and 7z archives');
    assert.ok(toolHtml.includes('<option value="glass">玻璃标签</option>'), 'the extended return-home styles must be available');
    assert.ok(toolHtml.includes('id="source-fingerprint"'), 'the active source must expose a content identity');
    assert.ok(appSource.includes('sourceLoadRevision'), 'stale saved-catalog loads must not overwrite a newly imported source');
    assert.ok(!toolHtml.includes('<option value="gradient">渐变</option>'), 'gradient buttons must not remain selectable in the tool');
    assert.ok(toolHtml.includes('<option value="soft">柔和填充</option>'), 'the tool must provide non-gradient button styles');
    assert.ok(toolHtml.includes('class="config-help-block"'), 'button-style guidance must render outside the horizontal setting row');
    assert.ok(toolHtml.includes('id="ambient-effect"'), 'the tool must provide an ambient motion selector');
    assert.ok(PrincipalStyles.length >= 36, 'game builder must provide an expanded set of game-oriented color themes');
    ['laser-grid', 'boss-rush', 'loot-gold', 'toxic-slime', 'spacefleet', 'pixel-candy', 'racing-redline', 'void-terminal', 'royal-quest'].forEach(function(id) {
        assert.ok(PrincipalStyles.some(function(preset) { return preset.id === id; }), 'missing game-oriented color theme: ' + id);
    });
    const legacyGradientButtonConfig = PrincipalGenerator.buildConfig({
        ...state,
        config: { ...state.config, btnStyle: 'gradient' }
    });
    assert.equal(legacyGradientButtonConfig.style.btnStyle, 'solid', 'legacy gradient buttons must fall back to solid buttons');
    const actionButtonCss = homePreview.slice(homePreview.indexOf('.action-btn {'), homePreview.indexOf('.detail-content {'));
    assert.ok(!actionButtonCss.includes('linear-gradient'), 'generated action buttons must not use gradients');
    assert.ok(actionButtonCss.includes('color: var(--color-btn-text);'), 'solid action buttons must use a contrast-aware text color');
    const auroraPreview = PrincipalGenerator.generatePreviewHtml({
        ...state,
        config: { ...state.config, ambientEffect: 'aurora' },
        _previewBlobUrls: []
    }, 'home');
    assert.ok(auroraPreview.includes('animation: ambient-aurora'), 'selected ambient motion must be written into preview CSS');
    assert.ok(auroraPreview.includes('@keyframes ambient-aurora'), 'selected ambient motion must include its keyframes');
    assert.ok(auroraPreview.includes('body::before'), 'ambient motion must render as a visible atmosphere layer above the page background');
    assert.ok(auroraPreview.includes('pointer-events: none'), 'ambient layer must not block game navigation or card clicks');
    assert.ok(auroraPreview.includes('@media (prefers-reduced-motion: reduce)'), 'ambient motion must respect reduced-motion preferences');
    const radarPreview = PrincipalGenerator.generatePreviewHtml({
        ...state,
        config: { ...state.config, ambientEffect: 'radar-sweep' },
        _previewBlobUrls: []
    }, 'home');
    assert.ok(radarPreview.includes('animation: ambient-radar-sweep'), 'radar animation must be emitted when selected');
    assert.ok(radarPreview.includes('@keyframes ambient-radar-sweep'), 'radar animation keyframes must be included in generated CSS');
    PrincipalStyles.forEach(function(preset) {
        const themedPreview = PrincipalGenerator.generatePreviewHtml({
            ...state,
            config: { ...state.config, selectedStyle: preset.id, btnStyle: 'solid' },
            _previewBlobUrls: []
        }, 'home');
        const textMatch = themedPreview.match(/--color-btn-text:\s*(#[\da-f]{6});/i);
        assert.ok(textMatch, 'every theme must emit a button text color: ' + preset.id);
        assert.ok(
            contrastRatioFromHex(preset.vars['--color-primary'], textMatch[1]) >= 4.5,
            'solid button text must meet contrast requirements: ' + preset.id
        );
    });

    Object.keys(generatedFiles).filter(file => file.endsWith('.html')).forEach(function(file) {
        const html = generatedFiles[file];
        const refs = html.matchAll(/(?:href|src)="([^"]+)"/g);
        for (const match of refs) {
            const ref = match[1];
            if (!ref || /^(?:https?:|mailto:|tel:|data:|#|\/\/)/i.test(ref)) continue;
            const cleanRef = ref.split('#')[0].split('?')[0];
            if (!cleanRef) continue;
            const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), cleanRef));
            assert.ok(generatedFiles[target], 'dead local reference in ' + file + ': ' + ref);
        }
    });

    const pokiState = {
        ...state,
        data: [{ ...testGames[1], id: 'poki-demo', title: 'Poki Demo', url: 'https://poki.com/en/g/poki-demo' }]
    };
    await PrincipalGenerator.exportWebsite(pokiState, function() {});
    const pokiDetailHtml = generatedFiles['website/details/articlepoki-demo.html'];
    assert.ok(pokiDetailHtml.includes('class="game-stage-preview"'), 'Poki detail pages must show a visible cover fallback instead of an empty iframe');
    assert.match(pokiDetailHtml, /class="game-stage-preview">[\s\S]*<img /, 'Poki fallback must retain the game cover');
    assert.ok(pokiDetailHtml.includes('PLAY ON POKI'), 'Poki fallback must explain where the game can be played');
    assert.ok(!pokiDetailHtml.includes('<iframe src="https://poki.com/'), 'Poki pages must not be embedded after their CSP blocks framing');
    assert.ok(pokiDetailHtml.includes('href="https://poki.com/en/g/poki-demo" target="_blank"'), 'Play Now must keep opening the original Poki game page');

    const localState = {
        ...state,
        data: [{
            ...testGames[1],
            id: 'oss-demo',
            title: 'Local Demo',
            url: 'games/demo.html'
        }],
        isLocalImages: false,
        localImages: {},
        localGameFiles: {
            'demo.html': '<!doctype html><html><head><title>Demo</title></head><body>Playable</body></html>'
        },
        sourceNotice: {
            repository: 'https://github.com/example/demo',
            revision: 'test',
            license: 'MIT',
            licenseText: 'MIT License\nCopyright (c) Test'
        }
    };
    await PrincipalGenerator.exportWebsite(localState, function() {});
    assert.ok(generatedFiles['website/games/demo.html'], 'local game source must be included in the ZIP');
    assert.ok(generatedFiles['website/details/articleoss-demo.html'].includes('src="../games/demo.html"'), 'detail page must resolve a local game from its nested directory');
    assert.ok(generatedFiles['website/OPEN_SOURCE_NOTICES.txt'], 'open-source attribution notice must be exported');
    assert.ok(generatedFiles['website/licenses/mini-browser-games-MIT.txt'].includes('MIT License'), 'MIT license text must be exported');

    const libraryGames = openSourceBundle.games.map(function(game) {
        const item = { ...game };
        delete item.gameHtml;
        delete item.coverData;
        return item;
    });
    const libraryState = {
        ...state,
        data: libraryGames,
        isLocalImages: true,
        localImages: Object.fromEntries(openSourceBundle.games.map(game => [game.coverFile, Buffer.from(game.coverData.split(',')[1], 'base64')])),
        localGameFiles: Object.fromEntries(openSourceBundle.games.map(game => [game.gameFile, game.gameHtml])),
        sourceNotice: openSourceBundle.source,
        config: {
            ...state.config,
            categories: openSourceBundle.categoryPreset
        }
    };
    await PrincipalGenerator.exportWebsite(libraryState, function() {});
    const libraryNavigation = generatedFiles['website/index.html'].slice(generatedFiles['website/index.html'].indexOf('<nav'), generatedFiles['website/index.html'].indexOf('</nav>') + 6);
    assert.equal(Object.keys(generatedFiles).filter(file => /^website\/games\/.*\.html$/.test(file)).length, 72, 'the complete first batch must be exported as local game files');
    assert.equal(Object.keys(generatedFiles).filter(file => /^website\/images\//.test(file)).length, 72, 'the complete first batch must export one HD cover per game');
    assert.equal(Object.keys(generatedFiles).filter(file => /^website\/details\/article/.test(file)).length, 72, 'the complete first batch must export one detail page per game');
    assert.ok(generatedFiles['website/details/articleoss-ball-arena.html'].includes('src="../games/ball-arena.html"'), 'first-batch detail pages must iframe their local games');
    assert.equal((libraryNavigation.match(/<li>/g) || []).length, 6, 'large dynamic catalogs must keep the header to Home, four distinct categories, and All Games');
    assert.ok(!libraryNavigation.includes('Action Games 2'), 'chunk suffixes must not become duplicate navigation entries');
    assert.ok(generatedFiles['website/all-games.html'], 'large dynamic catalogs must always export a complete collection page');
    assert.equal((generatedFiles['website/all-games.html'].match(/class="item-card"/g) || []).length, 72, 'complete collection page must retain every dynamic source item');
    const libraryIcons = PrincipalGenerator.buildConfig(libraryState).structure.categories.map(category => category.icon);
    ['✦', '◆', '◇', '◉', '▣', '◎', '♟'].forEach(function(symbol) {
        assert.ok(!libraryIcons.includes(symbol), 'legacy symbol ' + symbol + ' must be normalized to an Emoji');
    });
    assert.equal(libraryIcons[0], '🌟', 'featured source categories must use a standard Emoji');
    assert.equal(libraryIcons[1], '⚔️', 'action source categories must use a standard Emoji');

    const localCoverPreviewState = {
        ...localState,
        isLocalImages: true,
        localImages: {
            'local-demo.webp': new Blob(['cover'], { type: 'image/webp' })
        },
        localImageDataUrls: {
            'local-demo.webp': 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA=='
        },
        data: [{
            ...localState.data[0],
            thumb: 'local-demo.webp'
        }],
        _previewBlobUrls: []
    };
    const localCoverPreview = PrincipalGenerator.generatePreviewHtml(localCoverPreviewState, 'home');
    assert.match(localCoverPreview, /<img[^>]+src="data:image\/webp;base64,/, 'bundled cover data URLs must render inside the sandboxed live preview');

    const legacyEntries = [
        { path: 'old-site/js/ad.js', text: [
            'const bannerPath1 = "/123/banner-1";', 'const bannerPath2 = "/123/banner-2";',
            'const bannerPath3 = "/123/banner-3";', 'const bannerPath4 = "/123/banner-4";',
            'const interstitialPath = "/123/interstitial";', 'const anchorPath = "/123/anchor";',
            'const analyticsID = "G-TEST123";'
        ].join('\n') },
        { path: 'old-site/index.html', text: '<div id="div-gpt-ad-banner1"></div><div id="div-gpt-ad-banner2"></div><div id="div-gpt-ad-banner3"></div>' },
        { path: 'old-site/details/article1.html', text: '<div id="div-gpt-ad-banner1"></div><div id="div-gpt-ad-banner2"></div><div id="div-gpt-ad-banner3"></div>' }
    ];
    const migration = PrincipalAdMigration.inspectEntries(legacyEntries);
    assert.equal(migration.valid, true, 'nested legacy ZIP layout must be recognized');
    assert.equal(migration.config.bannerPath2, '/123/banner-2', 'legacy ad.js values must be extracted without reading page content');
    const tarMigration = PrincipalAdMigration.inspectTarBytes(createTar(legacyEntries));
    assert.equal(tarMigration.valid, true, 'nested legacy TAR layout must be recognized');
    assert.equal(tarMigration.detectedFiles.detail, 'old-site/details/article1.html', 'TAR parsing must retain the detected page structure');
    const tarGzMigration = await PrincipalAdMigration.inspectArchive(namedArchive(gzipSync(createTar(legacyEntries)), 'zp0903b.snulash.com_L8KZd.tar.gz'));
    assert.equal(tarGzMigration.valid, true, 'BaoTa-style TAR.GZ layout must be recognized');
    assert.equal(tarGzMigration.config.analyticsID, 'G-TEST123', 'TAR.GZ parsing must retain the ad configuration only');

    const migrationState = {
        ...state,
        siteBuildMode: 'ad-migration',
        legacyAdMigration: migration,
        config: {
            ...state.config,
            categories: [
                { name: 'Featured', icon: '🌟', count: 2 },
                { name: 'Action', icon: '⚔️', count: 2 },
                { name: 'Puzzle', icon: '🧩', count: 2 }
            ],
            adPlacements: { adv1: { home: 'content-top' } },
            adPaths: { bannerPath1: '/ignore/manual' }
        }
    };
    await PrincipalGenerator.exportWebsite(migrationState, function() {});
    const migratedHome = generatedFiles['website/index.html'];
    const migratedDetail = generatedFiles['website/details/article1.html'];
    const migratedPreview = PrincipalGenerator.generatePreviewHtml(migrationState, 'home');
    const migratedNavigation = migratedHome.slice(migratedHome.indexOf('<nav'), migratedHome.indexOf('</nav>') + 6);
    const count = function(source, needle) { return (source.match(new RegExp(needle, 'g')) || []).length; };
    assert.equal((migratedNavigation.match(/<li>/g) || []).length, 5, 'migrated header navigation must contain Home, all migrated-site categories, and the complete game list');
    assert.ok(!migratedNavigation.includes('Privacy Policy'), 'migrated header must not repeat footer links');
    assert.ok(migratedNavigation.includes('href="#category-action">Action</a>'), 'migrated header must link to dynamic categories');
    assert.ok(migratedNavigation.includes('href="all-games.html">All Games</a>'), 'migrated header must still expose every imported game');
    assert.equal(count(migratedHome, 'securepubads\\.g\\.doubleclick\\.net/tag/js/gpt\\.js'), 1, 'migrated home must have one GPT script');
    assert.equal(count(migratedHome, 'src="js/ad\\.js"'), 1, 'migrated home must have one ad.js');
    assert.equal(count(migratedDetail, 'securepubads\\.g\\.doubleclick\\.net/tag/js/gpt\\.js'), 1, 'migrated detail must have one GPT script');
    assert.equal(count(migratedDetail, 'src="\\.\\./js/ad\\.js"'), 1, 'migrated detail must have one relative ad.js');
    assert.equal(count(migratedHome, '>advertisement</div>'), 3, 'migrated homepage must visibly label every ad slot');
    assert.equal(count(migratedDetail, '>advertisement</div>'), 3, 'migrated detail page must visibly label every ad slot');
    assert.equal(count(migratedPreview, '>advertisement</div>'), 3, 'migration preview must visibly label every ad slot');
    assert.ok(migratedHome.includes('color:var(--color-text,#111)'), 'ad labels must remain visible on dark themes');
    ['banner1', 'banner2', 'banner3'].forEach(function(name) {
        assert.equal(count(migratedHome, 'id="div-gpt-ad-' + name + '"'), 1, 'migrated home must have one ' + name);
        assert.equal(count(migratedDetail, 'id="div-gpt-ad-' + name + '"'), 1, 'migrated detail must have one ' + name);
    });
    assert.ok(migratedHome.indexOf('div-gpt-ad-banner1') > migratedHome.indexOf('</nav>'), 'banner1 must be immediately after the homepage navigation');
    assert.ok(migratedHome.indexOf('div-gpt-ad-banner1') < migratedHome.indexOf('div-gpt-ad-banner2'), 'banner2 must follow the first category');
    assert.ok(migratedHome.indexOf('div-gpt-ad-banner2') < migratedHome.indexOf('div-gpt-ad-banner3'), 'banner3 must follow the second category');
    assert.ok(migratedDetail.indexOf('div-gpt-ad-banner1') < migratedDetail.indexOf('class="detail-page"'), 'detail banner1 must be before the detail content starts');
    assert.ok(migratedDetail.indexOf('div-gpt-ad-banner2') > migratedDetail.indexOf('class="detail-content"'), 'detail banner2 must follow the body');
    assert.ok(migratedDetail.indexOf('div-gpt-ad-banner3') > migratedDetail.indexOf('class="related-section"'), 'detail banner3 must be before the footer after the detail page');
    assert.ok(generatedFiles['website/js/ad.js'].includes('"/123/banner-1"'), 'migrated ad.js must contain extracted configuration');
    assert.ok(!migratedHome.includes('old-site/'), 'legacy source paths must not be copied into the new homepage');

    const invalidMigration = PrincipalAdMigration.inspectEntries([{ path: 'js/ad.js', text: 'const bannerPath1 = "/only-one";' }]);
    assert.equal(invalidMigration.valid, false, 'missing old-page structure must block migration');
    assert.ok(invalidMigration.errors.some(error => error.code === 'HOME_STRUCTURE_INVALID'), 'failure reason must name the unrecognized homepage structure');

    console.log('Generator smoke test passed.');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
