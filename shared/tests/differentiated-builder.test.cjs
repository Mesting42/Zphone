const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
// Both maintained workbenches live in one application; the former sibling
// game-tool directory is a historical copy and is not a test dependency.
const workbenchRoot = path.resolve(__dirname, '../../批量建站工具');
const gameWorkbenchRoot = path.join(workbenchRoot, 'game-builder');
const JSZip = require(path.join(workbenchRoot, 'node_modules/jszip'));
const Builder = require('../differentiated-builder.js');

function words(prefix, count = 820) {
    const vocabulary = ['material', 'record', 'method', 'context', 'reader', 'evidence', 'practice', 'detail', 'care', 'history'];
    return `${prefix} ` + Array.from({ length: count }, (_, index) => vocabulary[index % vocabulary.length]).join(' ') + ` ${prefix} conclusion.`;
}

function baseState(siteType, data, assets = {}) {
    return {
        data,
        config: { siteTitle: 'Independent Field Notes', contactEmail: 'editor@fieldnotes.test' },
        localImages: assets,
        packageAssets: assets,
        differentiated: {
            siteType,
            vertical: siteType === 'editorial' ? 'Historic material care' : siteType === 'tools' ? 'Browser text utilities' : 'Independent puzzle games',
            audience: 'Curious readers who value specific practical guidance',
            scope: 'Focused English resources with transparent limitations and source information.',
            baseUrl: `https://${siteType}.fieldnotes.test`,
            contactEmail: 'editor@fieldnotes.test',
            designFamily: 'auto',
            seed: `${siteType}-test-seed`
        },
        differentiatedPackage: {
            manifest: { site_type: siteType },
            designReferences: { schema_version: 1, references: [] }
        }
    };
}

async function testEditorialGate() {
    const assets = {};
    const articles = Array.from({ length: 40 }, (_, index) => {
        const cover = `assets/covers/article-${index + 1}.png`;
        assets[cover] = new Blob([`unique-cover-${index + 1}`], { type: 'image/png' });
        return {
            title: `Material Record Number ${index + 1}`,
            slug: `material-record-${index + 1}`,
            standfirst: `A focused explanation of material record number ${index + 1} for careful readers and collection stewards.`,
            category: index % 2 ? 'Care' : 'Records',
            content: words(`Distinct opening for record ${index + 1}`),
            author: 'Publisher editorial desk',
            published: '2026-09-13',
            fact_checked: '2026-09-13',
            cover,
            image_alt: `Material record ${index + 1} reference cover`,
            sources: [{ title: `Institution record ${index + 1}`, publisher: 'Museum authority', url: `https://museum.test/record-${index + 1}`, source_type: 'primary' }]
        };
    });
    const outcome = await Builder.audit(baseState('editorial', articles, assets), { variant: 'review' });
    assert.equal(outcome.report.counts.blockers, 0, JSON.stringify(outcome.report.issues, null, 2));
    assert.equal(outcome.config.items.length, 40);
    assert.ok(outcome.config.items.every(article => article.wordCount >= 600));

    const boundaryArticles = articles.map(article => ({ ...article }));
    boundaryArticles[0].content = Array.from({ length: 600 }, () => 'word').join(' ');
    const atMinimum = await Builder.audit(baseState('editorial', boundaryArticles, assets), { variant: 'review' });
    assert.ok(!atMinimum.report.issues.some(item => item.code === 'ARTICLE_TOO_SHORT' && item.item === boundaryArticles[0].title));
    boundaryArticles[0].content = Array.from({ length: 599 }, () => 'word').join(' ');
    const belowMinimum = await Builder.audit(baseState('editorial', boundaryArticles, assets), { variant: 'review' });
    assert.ok(belowMinimum.report.issues.some(item => item.code === 'ARTICLE_TOO_SHORT' && item.item === boundaryArticles[0].title));

    const previewState = baseState('editorial', articles, assets);
    previewState._previewBlobUrls = [];
    const preview = Builder.generatePreviewHtml(previewState, 'home', { siteType: 'editorial' });
    assert.match(preview, /<style>[^]*\.content-card/);
    assert.match(preview, /src="blob:/);
    assert.doesNotMatch(preview, /href="assets\/site\.css"/);
    previewState._previewBlobUrls.forEach(url => URL.revokeObjectURL(url));

    const sixtyArticles = articles.concat(Array.from({ length: 20 }, (_, offset) => {
        const index = offset + 41;
        const cover = `assets/covers/article-${index}.png`;
        assets[cover] = new Blob([`unique-cover-${index}`], { type: 'image/png' });
        return {
            title: `Material Record Number ${index}`,
            slug: `material-record-${index}`,
            standfirst: `A focused explanation of material record number ${index} for careful readers and collection stewards.`,
            category: index % 2 ? 'Care' : 'Records',
            content: words(`Distinct opening for record ${index}`),
            author: 'Publisher editorial desk', published: '2026-09-13', fact_checked: '2026-09-13',
            cover, image_alt: `Material record ${index} reference cover`,
            sources: [{ title: `Institution record ${index}`, publisher: 'Museum authority', url: `https://museum.test/record-${index}`, source_type: 'primary' }]
        };
    }));
    const aboveRecommended = await Builder.audit(baseState('editorial', sixtyArticles, assets), { variant: 'review' });
    assert.ok(!aboveRecommended.report.issues.some(item => item.code === 'ARTICLE_COUNT' && item.severity === 'BLOCKER'));
    assert.ok(aboveRecommended.report.issues.some(item => item.code === 'ARTICLE_COUNT_ABOVE_RECOMMENDED' && item.severity === 'WARNING'));

    articles[1].cover = articles[0].cover;
    const duplicate = await Builder.audit(baseState('editorial', articles, assets), { variant: 'review' });
    assert.ok(duplicate.report.issues.some(item => item.code === 'COVER_PATH_REUSED'));
}

async function testToolGateAndRuntime() {
    const operations = Builder.TOOL_OPERATIONS.slice(0, 25);
    function exampleFor(operation) {
        const map = {
            'find-replace': { input: 'red blue red', options: { find: 'red', replace: 'green' } },
            'json-format': { input: '{"name":"Ada"}', options: { spaces: 2 } },
            'json-minify': { input: '{ "name": "Ada" }' },
            'json-validate': { input: '{"ok":true}' },
            'csv-to-json': { input: 'name,role\nAda,Engineer' },
            'base64-encode': { input: 'browser tool' },
            'base64-decode': { input: 'YnJvd3NlciB0b29s' },
            'url-encode': { input: 'browser tool' },
            'url-decode': { input: 'browser%20tool' },
            'html-escape': { input: '<strong>Ada</strong>' },
            'html-unescape': { input: '&lt;strong&gt;Ada&lt;/strong&gt;' },
            'timestamp-to-date': { input: '0' },
            'date-to-timestamp': { input: '2026-09-13T00:00:00Z' },
            'percent-change': { input: '100, 125', options: { decimals: 2 } },
            'percentage-of': { input: '25, 200' },
            'ratio-simplify': { input: '12, 18' },
            temperature: { input: '20', options: { from: 'c', to: 'f' } },
            length: { input: '1', options: { from: 'm', to: 'cm' } },
            weight: { input: '1', options: { from: 'kg', to: 'g' } },
            bytes: { input: '1048576', options: { from: 'b', to: 'mib' } },
            pace: { input: '30, 5' }
        };
        const example = map[operation] || { input: 'Sample input value' };
        example.options = example.options || {};
        example.output = Builder.executeToolOperation(operation, example.input, example.options);
        return example;
    }
    const tools = operations.map((operation, index) => ({
        ...(() => {
            const example = exampleFor(operation);
            return { example_input: example.input, example_output: example.output, implementation: { operation, options: example.options } };
        })(),
        title: `Browser Utility ${index + 1}`,
        slug: `browser-utility-${index + 1}`,
        category: index % 2 ? 'Text' : 'Data',
        description: `A local utility that performs the supported ${operation} operation with clear output.`,
        instructions: 'Enter the requested value, review any options, run the utility, and verify the displayed result.',
        limitations: 'The result depends on valid input and the documented browser-side assumptions.'
    }));
    const outcome = await Builder.audit(baseState('tools', tools), { variant: 'review' });
    assert.equal(outcome.report.counts.blockers, 0, JSON.stringify(outcome.report.issues, null, 2));
    assert.equal(Builder.executeToolOperation('word-count', 'one two three', {}), '3');
    assert.equal(Builder.executeToolOperation('slugify', 'A Better Tool', {}), 'a-better-tool');
    assert.equal(Builder.executeToolOperation('json-validate', '{"ok":true}', {}), 'Valid JSON');
    assert.equal(Builder.executeToolOperation('ratio-simplify', '12, 18', {}), '2:3');
    assert.equal(Builder.executeToolOperation('percentage-of', '25, 200', {}), '50');

    const badExampleTools = tools.map(tool => ({ ...tool }));
    badExampleTools[0].example_output = 'incorrect result';
    const badExample = await Builder.audit(baseState('tools', badExampleTools), { variant: 'review' });
    assert.ok(badExample.report.issues.some(item => item.code === 'TOOL_EXAMPLE_MISMATCH'));

    const blob = await Builder.exportWebsite(baseState('tools', tools), () => {}, { variant: 'review', JSZip });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    assert.ok(zip.file('website/index.html'));
    assert.ok(zip.file('website/tools/browser-utility-1/index.html'));
    assert.ok(zip.file('website/site-audit-report.json'));
    assert.ok(zip.file('website/sitemap.xml'));
    const privacy = await zip.file('website/privacy/index.html').async('string');
    assert.match(privacy, /myadcenter\.google\.com\/personalizationoff/);
    assert.match(privacy, /policies\.google\.com\/technologies\/partner-sites/);
    assert.doesNotMatch(privacy, /<form/i);
    const section = await zip.file('website/sections/data/index.html').async('string');
    assert.match(section, /href="\.\.\/\.\.\/tools\/browser-utility-1\/index\.html"/);

    const draftWithoutContact = baseState('tools', tools);
    draftWithoutContact.config.contactEmail = '';
    draftWithoutContact.differentiated.contactEmail = '';
    draftWithoutContact.differentiated.baseUrl = '';
    const privacyDraft = Builder.generatePreviewHtml(draftWithoutContact, 'privacy', { siteType: 'tools' });
    assert.doesNotMatch(privacyDraft, /href="mailto:"/);
    const draftBlob = await Builder.exportWebsite(draftWithoutContact, () => {}, { variant: 'draft', JSZip });
    const draftZip = await JSZip.loadAsync(await draftBlob.arrayBuffer());
    const draftSitemap = await draftZip.file('website/sitemap.xml').async('string');
    assert.match(draftSitemap, /DRAFT ONLY/);
    assert.match(draftSitemap, /https:\/\/draft\.invalid\//);
}

async function testGameGate() {
    const assets = {};
    const games = Array.from({ length: 4 }, (_, index) => {
        const cover = `assets/covers/game-${index + 1}.webp`;
        assets[cover] = new Blob([`game-cover-${index + 1}`], { type: 'image/webp' });
        return {
            title: `Signal Puzzle ${index + 1}`,
            slug: `signal-puzzle-${index + 1}`,
            category: 'Puzzle',
            description: `A playable independent logic game with a distinct board and documented control scheme number ${index + 1}.`,
            cover,
            play_url: `https://games.provider.test/signal-${index + 1}/`,
            controls: 'Use the arrow keys or swipe to route the signal, then use Escape to leave fullscreen.',
            provider: 'Independent game provider',
            source_url: `https://source.provider.test/game-${index + 1}`,
            license: 'Publisher-supplied usage permission'
        };
    });
    const outcome = await Builder.audit(baseState('games', games, assets), { variant: 'review' });
    assert.equal(outcome.report.counts.blockers, 0, JSON.stringify(outcome.report.issues, null, 2));
    const adBlocked = await Builder.audit(baseState('games', games, assets), { variant: 'ad-ready' });
    assert.ok(adBlocked.report.issues.some(item => item.code === 'AD_CODE_REQUIRED'));
}

async function testPackageImport() {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ schema_version: 1, site_type: 'tools', site: { name: 'Archive Tools', vertical: 'Text utilities' } }));
    zip.file('content/tools/tools.json', JSON.stringify({ tools: [{ title: 'Word Counter', operation: 'word-count' }] }));
    zip.file('.editorial/design-settings.json', JSON.stringify({ contact_layout: 'form', contact_fields: ['email', 'message'], footer_style: 'detailed' }));
    zip.file('assets/covers/word-counter.png', new Uint8Array([1, 2, 3, 4]));
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const progress = [];
    const imported = await Builder.importZip(bytes, 'editorial', { JSZip, onProgress: (percent, message) => progress.push({ percent, message }) });
    assert.equal(imported.siteType, 'tools');
    assert.equal(imported.data.length, 1);
    assert.equal(imported.packageData.design.contact_layout, 'form');
    assert.ok(imported.localImages['assets/covers/word-counter.png']);
    assert.equal(progress[0].percent, 12);
    assert.ok(progress.some((update) => update.percent === 32 && /检查文件结构/.test(update.message)));
    assert.equal(progress.at(-1).percent, 96);
    await assert.rejects(
        Builder.importZip(bytes, 'editorial', { JSZip: { loadAsync: async () => ({}) } }),
        /ZIP 解析结果不完整/
    );

    const gameZip = new JSZip();
    gameZip.file('signal-site/manifest.json', JSON.stringify({ schema_version: 1, site_type: 'games', site: { name: 'Signal Games', vertical: 'Logic games' } }));
    gameZip.file('signal-site/content/games/games.json', JSON.stringify({ games: [{ title: 'Signal Maze', cover: 'assets/covers/signal.jfif', local_entry: 'games/signal-maze/index.html' }] }));
    gameZip.file('signal-site/assets/covers/signal.jfif', new Uint8Array([1, 3, 5, 7]));
    gameZip.file('signal-site/games/signal-maze/index.html', '<!doctype html><title>Signal Maze</title><script src="game.js"></script>');
    gameZip.file('signal-site/games/signal-maze/game.js', 'document.body.append("ready")');
    const gameBytes = await gameZip.generateAsync({ type: 'uint8array' });
    const gameImport = await Builder.importZip(gameBytes, 'games', { JSZip });
    const gameState = baseState('games', gameImport.data, gameImport.packageAssets);
    gameState.localImages = gameImport.localImages;
    gameState.localGameFiles = gameImport.localGameFiles;
    assert.ok(gameImport.localImages['signal-site/assets/covers/signal.jfif']);
    gameState.localImageDataUrls = { 'signal-site/assets/covers/signal.jfif': 'data:image/jpeg;base64,AQMF' };
    const gameConfig = Builder.buildConfig(gameState, { siteType: 'games' });
    assert.ok(gameConfig.gameOutputAssets['games/signal-maze/index.html']);
    assert.ok(gameConfig.gameOutputAssets['games/signal-maze/game.js']);
    assert.match(Builder.generatePreviewHtml(gameState, 'home', { siteType: 'games' }), /src="data:image\/jpeg;base64,AQMF"/);
    const gameAudit = await Builder.audit(gameState, { variant: 'draft', siteType: 'games' });
    assert.equal(gameAudit.config.items[0].localEntryOutput, 'games/signal-maze/index.html');
}

function testIndependentBuildState() {
    const state = baseState('tools', []);
    state.config.siteTitle = 'Previous Batch Title';
    state.config.contactEmail = 'previous@fieldnotes.test';
    state.differentiated.vertical = 'Fresh utility topic';
    state.differentiated.contactEmail = '';
    state.differentiated.baseUrl = 'javascript:alert(1)';
    const config = Builder.buildConfig(state, { siteType: 'tools' });
    assert.equal(config.siteTitle, 'Fresh utility topic');
    assert.equal(config.contactEmail, '');
    assert.equal(config.baseUrl, '');

    const dinosaurState = baseState('editorial', [
        { title: 'Triceratops and its fossil record', category: 'Ceratopsians', content: 'Dinosaur fossils reveal how this dinosaur lived among other dinosaurs.' },
        { title: 'Stegosaurus plates explained', category: 'Stegosaurs', content: 'Dinosaur anatomy helps paleontologists compare this dinosaur with other dinosaurs.' }
    ]);
    dinosaurState.differentiated.vertical = '';
    dinosaurState.differentiatedPackage.manifest = { site_type: 'editorial' };
    assert.equal(Builder.buildConfig(dinosaurState, { siteType: 'editorial' }).vertical, 'Dinosaur Reference');
    const dinosaurPreview = Builder.generatePreviewHtml(dinosaurState, 'home', { siteType: 'editorial' });
    assert.match(dinosaurPreview, /2 articles loaded/);
    assert.doesNotMatch(dinosaurPreview, /source-backed articles/);
    assert.match(dinosaurPreview, /preview-nav/);
    [...dinosaurPreview.matchAll(/<script>([^]*?)<\/script>/g)].forEach(match => {
        assert.doesNotThrow(() => new Function(match[1]));
    });
    const secondArticlePreview = Builder.generatePreviewHtml(dinosaurState, 'detail', { siteType: 'editorial', itemIndex: 1 });
    assert.match(secondArticlePreview, /<h1>Stegosaurus plates explained<\/h1>/);
    const sectionPreview = Builder.generatePreviewHtml(dinosaurState, 'section', { siteType: 'editorial', categorySlug: 'stegosaurs' });
    assert.match(sectionPreview, /<h1>Stegosaurs<\/h1>/);
    assert.doesNotMatch(sectionPreview, /<h1>Ceratopsians<\/h1>/);
}

function testDynamicCategoryNavigation() {
    const taggedState = {
        data: [
            { title: 'Cat nutrition basics', category: 'General', tags: ['Cats', 'Nutrition'], summary: 'A practical nutrition note for companion cats.' },
            { title: 'Dog training routines', category: 'General', tags: ['Dogs', 'Training'], summary: 'A practical training note for companion dogs.' }
        ],
        differentiated: { siteType: 'editorial', seed: 'pet-navigation' }
    };
    const taggedConfig = Builder.buildConfig(taggedState, { siteType: 'editorial' });
    assert.deepEqual(taggedConfig.categories.map(category => category.name), ['Cats', 'Dogs']);
    const taggedPreview = Builder.generatePreviewHtml(taggedState, 'home', { siteType: 'editorial' });
    assert.ok(taggedPreview.indexOf('>Home</a>') < taggedPreview.indexOf('>Cats</a>'));
    assert.match(taggedPreview, /href="sections\/cats\/index\.html">Cats<\/a>/);
    const primaryNavigation = taggedPreview.match(/<nav id="site-nav"[^>]*>[^]*?<\/nav>/)[0];
    assert.doesNotMatch(primaryNavigation, /about\/index\.html/);

    const inferredConfig = Builder.buildConfig({
        data: [
            { title: 'Feline nutrition notes', category: 'General', summary: 'Focused guidance for feline diets.' },
            { title: 'Canine training notes', category: 'General', summary: 'Focused guidance for canine routines.' }
        ],
        differentiated: { siteType: 'editorial', seed: 'inferred-navigation' }
    }, { siteType: 'editorial' });
    assert.ok(inferredConfig.categories.some(category => category.name === 'Feline'));
    assert.ok(inferredConfig.categories.some(category => category.name === 'Canine'));
}

function testDifferentiatedCustomizerOptions() {
    const state = {
        data: [
            { title: 'Cat nutrition basics', category: 'General', tags: ['Cats'], summary: 'A practical nutrition note for companion cats.' },
            { title: 'Cat grooming routines', category: 'General', tags: ['Cats'], summary: 'A practical grooming note for companion cats.' },
            { title: 'Cat enrichment ideas', category: 'General', tags: ['Cats'], summary: 'A practical enrichment note for companion cats.' },
            { title: 'Dog training routines', category: 'General', tags: ['Dogs'], summary: 'A practical training note for companion dogs.' },
            { title: 'Dog walking routines', category: 'General', tags: ['Dogs'], summary: 'A practical walking note for companion dogs.' },
            { title: 'Bird enrichment ideas', category: 'General', tags: ['Birds'], summary: 'A practical enrichment note for companion birds.' }
        ],
        differentiated: {
            siteType: 'editorial', seed: 'customizer-options', homeIntro: 'hidden', featuredCard: 'standard', navCategoryLimit: 2,
            homeCategoryLayout: true, homeCategoryLimit: 2, categoryOverrides: [{ slug: 'cats', homeCount: 2 }, { slug: 'dogs', homeCount: 1 }],
            summaryMode: 'hidden', tone: 'paper-blue', contentDensity: 'compact', cardRadius: 'right-round', cardHover: 'image-zoom', cardColumns: '3', categoryCardColumns: '2', cardBorder: 'double', cardSpacing: '40px', gridGap: '40px', cardExcerptLines: '2', cardImageHeight: '220px', cardHeight: '480px', coverFit: 'contain', cardViewMode: 'compact'
        }
    };
    const config = Builder.buildConfig(state, { siteType: 'editorial' });
    assert.equal(config.homeIntro, 'hidden');
    assert.equal(config.featuredCard, 'standard');
    assert.equal(config.navCategoryLimit, 2);
    assert.equal(config.homeCategoryLayout, true);
    assert.equal(config.homeCategoryLimit, 2);
    assert.equal(config.categories.find(category => category.slug === 'cats').homeCount, 2);
    assert.equal(config.summaryMode, 'hidden');
    assert.equal(config.cardHeight, '480px');
    assert.equal(config.categoryCardColumns, '2');
    assert.equal(config.coverFit, 'contain');
    assert.equal(config.design.tone, 'paper-blue');
    const preview = Builder.generatePreviewHtml(state, 'home', { siteType: 'editorial' });
    assert.match(preview, /data-home-intro="hidden" data-density="compact" data-card-radius="right-round"/);
    assert.doesNotMatch(preview, /class="publication-intro"/);
    assert.doesNotMatch(preview, /content-card featured/);
    assert.match(preview, /class="home-category-sections"/);
    assert.match(preview, /data-home-category="cats"/);
    assert.match(preview, /data-home-category="dogs"/);
    assert.doesNotMatch(preview, /Bird enrichment ideas/);
    const navigation = preview.match(/<nav id="site-nav"[^>]*>[^]*?<\/nav>/)[0];
    assert.match(navigation, />Cats<\/a>/);
    assert.match(navigation, />Dogs<\/a>/);
    assert.doesNotMatch(navigation, />Birds<\/a>/);
    const css = Builder.generateCss(config);
    assert.match(css, /--radius:18px/);
    assert.match(css, /border-radius:0 var\(--radius\) var\(--radius\) 0!important/);
    assert.match(css, /--diff-gap:40px/);
    assert.match(css, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
    assert.match(css, /padding:40px!important/);
    assert.match(css, /height:480px!important;min-height:480px!important;max-height:480px!important/);
    assert.match(css, /object-fit:contain!important;object-position:center!important/);
    assert.match(css, /figure img\{transform:scale\(1\.045\)\}/);
}

function testDomainBlueprints() {
    assert.equal(Object.keys(Builder.DOMAIN_PROFILES).length, 32);
    Object.keys(Builder.DOMAIN_PROFILES).forEach(function(domainId) {
        var editorialBlueprints = Builder.getDesignFamilies('editorial', domainId);
        assert.equal(editorialBlueprints.length, 12);
        assert.equal(new Set(editorialBlueprints.map(function(item) { return item.id; })).size, 12);
        editorialBlueprints.forEach(function(item) {
            assert.ok(item.id.indexOf(domainId + '-blueprint-') === 0);
            assert.ok(item.direction);
        });
    });
    assert.equal(Object.keys(Builder.DOMAIN_COMPOSITION_MODES).length, 32);
    assert.equal(Builder.getDesignFamilies('editorial', 'tech')[0].domainMode, 'signal');
    assert.equal(Builder.getDesignFamilies('editorial', 'food')[0].domainMode, 'culture');
    assert.notEqual(Builder.getDesignFamilies('editorial', 'tech')[0].domainMode, Builder.getDesignFamilies('editorial', 'game')[0].domainMode);
    var petState = {
        selectedTheme: 'pets',
        data: [{ title: 'Dog care routines', category: 'Dogs', summary: 'A companion animal care guide.' }],
        differentiated: { siteType: 'editorial', designFamily: 'pets-blueprint-03', seed: 'pet-blueprint' }
    };
    var petConfig = Builder.buildConfig(petState, { siteType: 'editorial' });
    assert.equal(petConfig.domain.id, 'pets');
    assert.equal(petConfig.design.id, 'pets-blueprint-03');
    assert.match(Builder.generatePreviewHtml(petState, 'home', { siteType: 'editorial' }), /Design: Pets &amp; Animals/);
    var generatedCategorySlug = petConfig.categories[0].slug;
    petState.differentiated.categoryOverrides = [{ slug: generatedCategorySlug, name: '犬类护理', icon: '🐕' }];
    petConfig = Builder.buildConfig(petState, { siteType: 'editorial' });
    assert.equal(petConfig.categories.find(function(category) { return category.slug === generatedCategorySlug; }).name, '犬类护理');
    assert.equal(petConfig.categories.find(function(category) { return category.slug === generatedCategorySlug; }).icon, '🐕');
    assert.match(Builder.generatePreviewHtml(petState, 'home', { siteType: 'editorial' }), />犬类护理<\/a>/);
}

function testRichHtmlSanitizing() {
    const article = {
        title: 'Safe rich content',
        category: 'Safety',
        content: '<p onclick="alert(1)">Readable text <a href="javascript:alert(1)">unsafe link</a>.</p><script>alert(1)</script><img src=x onerror="alert(1)">'
    };
    const preview = Builder.generatePreviewHtml(baseState('editorial', [article]), 'detail', { siteType: 'editorial' });
    assert.doesNotMatch(preview, /onclick|onerror|javascript:|<script>alert|<img/i);
    assert.match(preview, /<p>Readable text <a>unsafe link<\/a>\.<\/p>/);
}

function testFullscreenPreviewContracts() {
    [workbenchRoot, gameWorkbenchRoot].forEach(root => {
        const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
        const css = fs.readFileSync(path.join(root, 'css/tool.css'), 'utf8');
        const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
        assert.match(html, /id="preview-fullscreen-btn"[^>]*aria-label="进入全屏预览"[^>]*aria-pressed="false"/);
        assert.match(html, /id="preview-fullscreen-status"[^>]*aria-live="polite"/);
        assert.match(css, /\.preview-panel:fullscreen/);
        assert.match(css, /\.preview-panel\.is-preview-fullscreen/);
        assert.match(css, /\.preview-fullscreen-label\s*\{[^}]*position:\s*absolute/);
        assert.match(app, /requestFullscreen/);
        assert.match(app, /event\.key === 'Escape'/);
        assert.match(app, /fullscreenButton\.focus\(\)/);
        assert.match(app, /categorySlug/);
        assert.match(html, /id="differentiated-customizer"/);
        assert.match(html, /id="diff-site-title"/);
        assert.match(html, /id="diff-brand-mark"/);
        assert.match(html, /id="diff-typography"/);
        assert.match(html, /id="diff-card-alignment"/);
        assert.match(html, /id="diff-home-intro"/);
        assert.match(html, /id="diff-featured-card"/);
        assert.match(html, /id="diff-nav-category-limit"/);
        assert.match(html, /id="diff-summary-mode"/);
        assert.match(html, /id="diff-tone"/);
        assert.match(html, /id="diff-content-density"/);
        assert.match(html, /id="diff-card-radius"/);
        assert.match(html, /id="diff-card-hover"/);
        assert.match(html, /id="diff-card-columns"/);
        assert.match(html, /id="diff-category-card-columns"/);
        assert.match(html, /id="diff-card-view-mode"/);
        assert.match(html, /id="diff-card-border"/);
        assert.match(html, /id="diff-card-spacing"/);
        assert.match(html, /id="diff-card-excerpt-lines"/);
        assert.match(html, /id="diff-card-image-height"/);
        assert.match(html, /id="diff-cover-fit"/);
        assert.match(html, /id="diff-card-height"/);
        assert.match(html, /id="diff-logo-style"/);
        assert.match(html, /id="diff-nav-layout"/);
        assert.match(html, /id="diff-nav-style"/);
        assert.match(html, /id="diff-nav-height"/);
        assert.match(html, /id="diff-grid-gap"/);
        assert.match(html, /id="diff-button-style"/);
        assert.match(html, /id="diff-button-size"/);
        assert.match(html, /id="diff-font-style"/);
        assert.match(html, /id="diff-content-max-width"/);
        assert.match(html, /id="diff-back-link-style"/);
        assert.match(html, /id="diff-animation-enter"/);
        assert.match(html, /id="diff-transition-speed"/);
        assert.match(html, /id="diff-logo-icon-trigger"/);
        assert.match(html, /id="diff-style-preset-grid"/);
        assert.match(html, /id="diff-domain-blueprint-grid"/);
        assert.match(html, /id="diff-domain-blueprint-status"/);
        assert.match(app, /populateDifferentiatedCustomizer/);
        assert.match(app, /getDesignFamilies/);
        assert.match(app, /renderDifferentiatedBlueprints/);
        assert.match(app, /navCategoryLimit/);
        assert.match(app, /contentDensity/);
        assert.match(css, /\.diff-config-tab\.active/);
        if (root === workbenchRoot) {
            assert.match(html, /id="diff-home-category-layout"/);
            assert.match(html, /id="diff-home-category-limit"/);
            assert.match(html, /id="diff-home-category-list"/);
            assert.match(app, /homeCategoryLayout/);
            assert.match(app, /renderDifferentiatedHomeCategories/);
        }
    });
}

async function main() {
    const canonical = fs.readFileSync(path.resolve(__dirname, '../differentiated-builder.js'), 'utf8');
    const infoCopy = fs.readFileSync(path.join(workbenchRoot, 'js/differentiated-builder.js'), 'utf8');
    const gameCopy = fs.readFileSync(path.join(gameWorkbenchRoot, 'js/differentiated-builder.js'), 'utf8');
    const infoApp = fs.readFileSync(path.join(workbenchRoot, 'js/app.js'), 'utf8');
    const gameApp = fs.readFileSync(path.join(gameWorkbenchRoot, 'js/app.js'), 'utf8');
    const infoIndex = fs.readFileSync(path.join(workbenchRoot, 'index.html'), 'utf8');
    const gameIndex = fs.readFileSync(path.join(gameWorkbenchRoot, 'index.html'), 'utf8');
    assert.equal(infoCopy, canonical, '资讯工具中的共享引擎副本需要同步');
    assert.equal(gameCopy, canonical, '游戏工具中的共享引擎副本需要同步');
    [infoApp, gameApp].forEach(app => {
        assert.match(app, /REQUIRED_DIFFERENTIATED_BUILDER_VERSION\s*=\s*'20260914-template-library-13'/);
        assert.match(app, /DifferentiatedBuilder\.BUILD_VERSION\s*!==\s*REQUIRED_DIFFERENTIATED_BUILDER_VERSION/);
        assert.match(app, /previewFrame\.srcdoc\s*=\s*html/);
    });
    assert.match(infoApp, /import '\.\/differentiated-builder\.js\?v=20260915-industrial-catalog-1';/);
    const gameBuilderVersion = createHash('sha256').update(fs.readFileSync(path.join(gameWorkbenchRoot, 'js/differentiated-builder.js'))).digest('hex').slice(0, 16);
    assert.match(gameIndex, new RegExp('differentiated-builder\\.js\\?v=sha256-' + gameBuilderVersion));
    assert.equal(Builder.countEnglishWords(words('Opening', 600)) >= 600, true);
    assert.equal(Object.keys(Builder.DESIGN_FAMILIES).length, 3);
    Object.values(Builder.DESIGN_FAMILIES).forEach(families => assert.equal(families.length, 12));
    const generatedCss = Builder.generateCss({});
    assert.equal(Builder.BUILD_VERSION, '20260914-template-library-13');
    assert.doesNotMatch(generatedCss, /undefined/);
    const compactDefault = Builder.buildConfig({ data: [{ title: 'Compact start', category: 'General', content: 'Record.' }], differentiated: { siteType: 'editorial' } });
    assert.equal(compactDefault.homeIntro, 'compact');
    assert.equal(compactDefault.cardColumns, 'template');
    assert.match(Builder.generateCss(compactDefault), /body\[data-home-intro="compact"\] \.publication-intro\{display:grid!important/);
    assert.match(Builder.generateCss(Object.assign({}, compactDefault, { cardColumns: '3' })), /body\[data-page-type="home"\] \.content-grid\{display:grid!important;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important;column-count:auto!important/);
    assert.match(Builder.generateCss(Object.assign({}, compactDefault, { cardColumns: 'auto' })), /body\[data-page-type="home"\] \.content-grid\{display:grid!important;grid-template-columns:repeat\(auto-fill,minmax\(280px,1fr\)\)!important/);
    assert.match(Builder.generateCss(Object.assign({}, compactDefault, { cardColumns: '4', categoryCardColumns: '2' })), /body\[data-page-type="section"\] \.content-grid\{display:grid!important;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
    assert.match(Builder.generatePreviewHtml({ data: [{ title: 'Cover test', category: 'General', content: 'Record.' }], differentiated: { siteType: 'editorial', coverFit: 'smart' } }, 'home'), /data-page-type="home"/);
    const smartCoverCss = Builder.generateCss(Object.assign({}, compactDefault, { coverFit: 'smart' }));
    assert.match(smartCoverCss, /figure\.has-portrait-cover/);
    assert.match(smartCoverCss, /img\.cover-backdrop/);
    assert.match(Builder.generateRuntimeJs(Object.assign({}, compactDefault, { coverFit: 'smart' })), /is-portrait-cover/);
    assert.match(Builder.generateRuntimeJs(Object.assign({}, compactDefault, { coverFit: 'smart' })), /cover-backdrop/);
    const standardGridCss = Builder.generateCss(Object.assign({}, compactDefault, { cardColumns: '4' }));
    assert.match(standardGridCss, /body\[data-page-type="home"\] \.content-card figure,html\[data-layout\] body\[data-page-type="home"\] \.content-card\.featured figure\{display:block!important[^}]*aspect-ratio:16\/10!important/);
    assert.match(standardGridCss, /content-card \.card-copy\{display:flex!important;flex:1!important[^}]*padding:20px!important/);
    assert.match(standardGridCss, /content-card \.card-copy h2\{display:-webkit-box!important/);
    assert.match(Builder.generateCss(Object.assign({}, compactDefault, { cardHeight: '400px' })), /height:400px!important;min-height:400px!important;max-height:400px!important/);
    assert.doesNotMatch(generatedCss, /grid-row:span 2/);
    assert.doesNotMatch(generatedCss, /translateY\(42px\)/);
    assert.match(generatedCss, /content-grid\{align-items:stretch\}\.content-card\{align-self:stretch;height:100%\}/);
    assert.match(Builder.generateCss({ cardAlignment: 'aligned' }), /content-grid\{align-items:start\}\.content-card\{align-self:start;height:auto\}/);
    assert.match(generatedCss, /--font-body:/);
    assert.match(generatedCss, /\.article-body,\.article \.sources\{width:min\(100%,var\(--measure\)\);margin-left:auto;margin-right:auto\}/);
    assert.match(generatedCss, /content-card:not\(\.featured\) figure\{[^}]*aspect-ratio:16\/10/);
    assert.match(generatedCss, /card-action\{margin-top:18px;padding-top:0\}/);
    assert.match(generatedCss, /lead-grid[^}]+content-grid\{display:flex;flex-wrap:wrap;align-items:stretch/);
    assert.match(generatedCss, /lead-grid[^}]+content-card\.featured\{position:relative;display:block;flex:1 0 100%;height:auto;min-height:0/);
    assert.match(generatedCss, /rail-index[^}]+content-grid\{display:grid;grid-template-columns:1fr;gap:0;border-top:2px solid var\(--ink\);counter-reset:monograph/);
    assert.match(generatedCss, /rail-index[^}]+content-card[^}]+grid-template-columns:minmax\(180px,28%\) minmax\(0,1fr\)/);
    assert.match(generatedCss, /split-feature[^}]+content-card[^}]+grid-row:auto/);
    assert.match(generatedCss, /mosaic[^}]+content-grid\{display:block;column-count:3;column-gap:var\(--diff-gap\)/);
    assert.match(generatedCss, /swiss-index[^}]+content-grid\{display:flex;flex-wrap:wrap;align-items:stretch;gap:1px/);
    assert.match(generatedCss, /broadsheet[^}]+content-grid\{display:flex;flex-wrap:wrap;align-items:stretch;gap:0/);
    assert.match(generatedCss, /timeline-ledger[^}]+content-grid\{display:grid;grid-template-columns:1fr;gap:0;counter-reset:ledger/);
    assert.match(generatedCss, /cinematic-strip[^}]+content-grid\{display:flex;flex-direction:column/);
    assert.match(generatedCss, /cinematic-strip[^}]+content-card[^}]+position:relative;display:block/);
    assert.match(generatedCss, /soft-showcase[^}]+content-grid\{display:flex;flex-wrap:wrap;align-items:stretch/);
    assert.match(generatedCss, /industrial-board[^}]+content-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\);align-items:stretch/);
    assert.match(generatedCss, /industrial-board[^}]+publication-intro\{display:grid;grid-template-columns:minmax\(0,1\.35fr\) minmax\(240px,\.65fr\)/);
    assert.doesNotMatch(generatedCss, /MODULE_/);
    assert.doesNotMatch(generatedCss, /industrial-board"\] body\{background-image/);
    assert.equal(Builder.DESIGN_FAMILIES.editorial[11].tone, 'paper-blue');
    assert.equal(Builder.DESIGN_FAMILIES.editorial[11].direction, 'industrial-catalog');
    assert.match(generatedCss, /data-domain-mode="spectacle"[^}]+content-card p\{display:none/);
    assert.match(generatedCss, /data-home-intro="compact"[^}]+publication-intro\{min-height:0;padding-top:18px;padding-bottom:18px/);
    assert.match(generatedCss, /card-copy\{position:relative;z-index:1;overflow:hidden\}/);
    assert.match(generatedCss, /site-header\{position:sticky;top:0;z-index:100/);
    assert.match(generatedCss, /@media \(max-width:680px\)\{[\s\S]*?\.nav-toggle\{display:inline-flex/);
    assert.match(generatedCss, /@media\(max-width:900px\)\{[\s\S]*?\.site-header\{align-items:center/);
    assert.match(generatedCss, /@media\(max-width:900px\)\{[\s\S]*?\.site-header nav[^}]+display:none/);
    assert.match(generatedCss, /@media\(min-width:681px\) and \(max-width:900px\)\{[\s\S]*?\.content-card[^}]+height:100%;align-self:stretch/);
    assert.match(generatedCss, /html\[data-layout\] \.content-grid\{grid-template-columns:1fr\}/);
    assert.match(generatedCss, /banded-list[^}]+content-grid\{display:flex;flex-wrap:wrap;align-items:stretch/);
    assert.match(generatedCss, /banded-list[^}]+last-child:nth-child\(odd\)[^}]+flex-basis:100%;grid-template-columns/);
    assert.match(generatedCss, /catalog-grid[^}]+content-grid\{display:flex;flex-wrap:wrap;align-items:stretch;gap:1px/);
    assert.match(generatedCss, /catalog-grid[^}]+content-card[^}]+flex:1 1 calc\(25% - 1px\);min-width:220px/);
    assert.match(generatedCss, /counter-reset:catalog/);
    assert.match(generatedCss, /split-feature[^}]+content-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);align-items:stretch/);
    assert.match(generatedCss, /split-feature[^}]+last-child:nth-child\(odd\)[^}]+grid-column:1\/-1/);
    assert.match(generatedCss, /@media\(max-width:680px\)\{html\[data-layout\] \.content-grid\{display:grid;grid-template-columns:1fr;column-count:auto/);
    const firstConfig = Builder.buildConfig({ data: [{ title: 'Orbital Mechanics', category: 'Space', content: 'A short record.' }], differentiated: { siteType: 'editorial', seed: 'one' } });
    const secondConfig = Builder.buildConfig({ data: [{ title: 'Coastal Gardens', category: 'Nature', content: 'A short record.' }], differentiated: { siteType: 'editorial', seed: 'two' } });
    assert.notEqual(firstConfig.brandMark.id + firstConfig.typography.id, secondConfig.brandMark.id + secondConfig.typography.id);
    const manualConfig = Builder.buildConfig({ data: [{ title: 'One', category: 'General', content: 'Record.' }], differentiated: { siteType: 'editorial', siteTitle: 'Signal Atlas', brandMark: 'spark', typography: 'technical' } });
    assert.equal(manualConfig.siteTitle, 'Signal Atlas');
    assert.equal(manualConfig.brandMark.id, 'spark');
    assert.equal(manualConfig.typography.id, 'technical');
    assert.equal(manualConfig.cardAlignment, 'compact');
    const componentConfig = Builder.buildConfig({ data: [{ title: 'One', category: 'General', content: 'Record.' }], differentiated: { siteType: 'editorial', navStyle: 'accent', navHeight: 'roomy', logoStyle: 'boxed', buttonStyle: 'pill', gridGap: 'relaxed', animationEnter: 'rise' } });
    assert.equal(componentConfig.navStyle, 'accent');
    assert.equal(componentConfig.navHeight, 'roomy');
    assert.match(Builder.generateCss(componentConfig), /nav-style-accent/);
    const pageTemplateConfig = Builder.buildConfig({ data: [{ title: 'Contact Record', category: 'General', content: 'Record.' }], differentiated: { siteType: 'editorial', siteTitle: 'Contact Atlas', contactEmail: 'editor@contact.test', contactLayout: 'form', contactFields: ['email', 'message'], footerStyle: 'detailed', footerLinks: ['contact', 'about'] } });
    assert.deepEqual(pageTemplateConfig.contactFields, ['email', 'message']);
    assert.deepEqual(pageTemplateConfig.footerLinks, ['contact', 'about']);
    const contactPreview = Builder.generatePreviewHtml({ data: pageTemplateConfig.items, differentiated: { siteType: 'editorial', siteTitle: 'Contact Atlas', contactEmail: 'editor@contact.test', contactLayout: 'form', contactFields: ['email', 'message'], footerStyle: 'detailed', footerLinks: ['contact', 'about'] } }, 'contact', { siteType: 'editorial' });
    assert.match(contactPreview, /contact-layout-form/);
    assert.match(contactPreview, /action="mailto:editor@contact\.test"/);
    assert.doesNotMatch(contactPreview, /for="contact-name"/);
    assert.match(contactPreview, /site-footer-detailed/);
    assert.match(Builder.generateCss(pageTemplateConfig), /contact-layout-split/);
    const paletteConfig = Builder.buildConfig({ data: [{ title: 'One', category: 'General', content: 'Record.' }], differentiated: { siteType: 'editorial', logoIcon: '🎮', themePreset: 'retro', themePalette: { '--color-bg': '#120b0a', '--color-card-bg': '#261310', '--color-primary': '#ff623d' } } });
    assert.equal(paletteConfig.brandMark.glyph, '🎮');
    assert.equal(paletteConfig.themePreset, 'retro');
    const paletteCss = Builder.generateCss(paletteConfig);
    assert.match(paletteCss, /html\[data-tone\]\{--paper:#120b0a;--surface:#261310;--accent:#ff623d\}/);
    assert.match(paletteCss, /\.site-header\{background:var\(--nav-surface,color-mix/);
    assert.match(paletteCss, /\.content-card:hover\{background:var\(--surface-hover,var\(--surface\)\)\}/);
    assert.match(Builder.generatePreviewHtml({ data: firstConfig.items, differentiated: { siteType: 'editorial', brandMark: 'spark', typography: 'technical' } }, 'home'), /brand-mark mark-spark/);
    assert.match(Builder.generateWaitingPreviewHtml('games'), /previous batch cannot be inherited/i);
    await testEditorialGate();
    await testToolGateAndRuntime();
    await testGameGate();
    await testPackageImport();
    testIndependentBuildState();
    testDynamicCategoryNavigation();
    testDifferentiatedCustomizerOptions();
    testDomainBlueprints();
    testRichHtmlSanitizing();
    testFullscreenPreviewContracts();
    console.log('Differentiated builder tests passed.');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
