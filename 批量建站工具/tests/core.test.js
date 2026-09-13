import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { createDefaultState } from '../src/config.js';
import { auditContent } from '../src/core/audit.js';
import { buildSite, siteToZip } from '../src/core/generator.js';
import { importDataFile, parseJsonPayload } from '../src/core/importer.js';
import { countEnglishWords, safeMarkdown, uniqueSlugs } from '../src/core/utils.js';

const prefixes = ['alpha','bravo','cedar','delta','ember','fjord','grove','harbor','indigo','juniper','kelp','linen','meadow','nectar','olive','prairie','quartz','river','saffron','timber','umber','violet','willow','xenon','yarrow','zephyr','amber','birch','coral','dahlia','elmwood','feather','granite','heather','island','jasper','kindred','lagoon','marble','north'];

function letters(number) {
  let value = number + 1; let result = '';
  while (value) { value -= 1; result = String.fromCharCode(97 + (value % 26)) + result; value = Math.floor(value / 26); }
  return result;
}

function body(prefix, count = 801) {
  return Array.from({ length: count }, (_, index) => `${prefix}-${letters(index)}`).join(' ');
}

function validState(count = 35, wordCount = 801) {
  const state = createDefaultState();
  state.identity = {
    ...state.identity, siteName: 'Development Test Publication', tagline: 'Deterministic fixture validation',
    description: 'A local development fixture used only to verify static generation behavior.', baseUrl: 'https://test.invalid/',
    publisherName: 'Local Test Operator', contactEmail: 'test@test.invalid', copyrightOwner: 'Local Test Operator',
    defaultAuthor: 'Local Test Author', editorialProcess: 'Fixtures are generated and checked by the automated test suite.',
    contentOrigin: 'Synthetic development fixture, never for publication.', targetRegions: 'Local development only'
  };
  state.policy.privacyEffectiveDate = '2026-09-04';
  state.confirmations = { imageRights: true, sourceLinks: true, visualImages: true, externalLinks: true, cmp: true };
  state.articles = Array.from({ length: count }, (_, index) => {
    const prefix = prefixes[index] || `topic${letters(index)}`;
    const image = { originalPath: `images/${prefix}.svg`, outputPath: `assets/images/${prefix}.svg`, bytes: new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><rect width="1200" height="675" fill="#${String(index + 100).padStart(6, '0')}"/></svg>`), hash: `hash-${prefix}`, fingerprint: '', width: 1200, height: 675, mime: 'image/svg+xml' };
    state.data.images.push(image);
    return { title: `${prefix} editorial guide`, content: body(prefix, wordCount), image: image.originalPath, _image: image, image_alt: `${prefix} development illustration`, excerpt: `A synthetic ${prefix} fixture for local generator testing.`, category: index % 2 ? 'Software' : 'Hardware', slug: `${prefix}-guide`, author: 'Local Test Author', published_at: '2026-01-01', updated_at: '', sources: [`https://source.invalid/${prefix}`], fact_checked_by: 'Local Test Checker', fact_checked_at: '2026-01-02', cover_image_source: 'Synthetic test asset generated locally.' };
  });
  return state;
}

describe('import and sanitization', () => {
  it('accepts array and wrapped JSON payloads', () => {
    expect(parseJsonPayload('[{"title":"A"}]')).toHaveLength(1);
    expect(parseJsonPayload('{"articles":[{"title":"A"}]}')).toHaveLength(1);
    expect(parseJsonPayload('{"data":[{"title":"A"}]}')).toHaveLength(1);
  });

  it('imports one JSON and local SVG from ZIP', async () => {
    const zip = new JSZip();
    zip.file('data.json', JSON.stringify([{ title: 'Alpha', image: 'images/alpha.svg' }]));
    zip.file('images/alpha.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"></svg>');
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const file = new File([bytes], 'upload.zip', { type: 'application/zip' });
    const imported = await importDataFile(file);
    expect(imported.rows).toHaveLength(1);
    expect(imported.images[0]).toMatchObject({ width: 1200, height: 675 });
    expect(imported.images[0].hash).toHaveLength(64);
  });

  it('escapes malicious HTML and permits only HTTPS Markdown links', () => {
    const html = safeMarkdown('<script>alert(1)</script> [bad](javascript:alert(1)) [good](https://safe.invalid/page)');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});

describe('hard quality gates', () => {
  it('counts hyphenated and apostrophe words consistently at 800/801 boundary', () => {
    expect(countEnglishWords(body('alpha', 800))).toBe(800);
    expect(countEnglishWords(`${body('alpha', 799)} don't state-of-the-art`)).toBe(801);
  });

  it('blocks 34 valid articles and accepts 35', async () => {
    const audit34 = await auditContent(validState(34));
    expect(audit34.validCount).toBe(34);
    expect(audit34.canExportReview).toBe(false);
    const audit35 = await auditContent(validState(35));
    expect(audit35.validCount).toBe(35);
    expect(audit35.canExportReview).toBe(true);
  });

  it('blocks exactly 800 words and passes the word gate at 801', async () => {
    const result800 = (await auditContent(validState(1, 800))).articleResults[0];
    expect(result800.blockers.some((item) => item.includes('至少 801'))).toBe(true);
    const result801 = (await auditContent(validState(1, 801))).articleResults[0];
    expect(result801.blockers.some((item) => item.includes('至少 801'))).toBe(false);
  });

  it('blocks duplicate bodies and renamed duplicate images', async () => {
    const state = validState(2);
    state.articles[1].content = state.articles[0].content;
    state.articles[1]._image = { ...state.articles[1]._image, hash: state.articles[0]._image.hash };
    const audit = await auditContent(state);
    expect(audit.articleResults.every((item) => item.blockers.some((reason) => reason.includes('重复')))).toBe(true);
  });

  it('blocks lightly rewritten and highly templated article pairs', async () => {
    const lightlyRewritten = validState(2);
    lightlyRewritten.articles[1].content = lightlyRewritten.articles[0].content.replace(/alpha-/g, (match, offset) => offset < 180 ? 'bravo-' : match);
    let audit = await auditContent(lightlyRewritten);
    expect(audit.articleResults.some((item) => item.blockers.some((reason) => reason.includes('相似度')))).toBe(true);

    const templated = validState(2);
    const shared = body('shared', 700);
    templated.articles[0].content = `${shared} ${body('alpha', 101)}`;
    templated.articles[1].content = `${shared} ${body('bravo', 101)}`;
    audit = await auditContent(templated);
    expect(audit.articleResults.every((item) => item.blockers.some((reason) => reason.includes('相似度')))).toBe(true);
  });

  it('blocks same image path/content and requires review for visual near-duplicates', async () => {
    const samePath = validState(2);
    samePath.articles[1].image = samePath.articles[0].image;
    samePath.articles[1]._image = samePath.articles[0]._image;
    let audit = await auditContent(samePath);
    expect(audit.articleResults.every((item) => item.blockers.some((reason) => reason.includes('封面图片重复')))).toBe(true);

    const near = validState(2);
    near.confirmations.visualImages = false;
    near.articles[0]._image.fingerprint = '0'.repeat(64);
    near.articles[1]._image.fingerprint = `${'0'.repeat(61)}111`;
    audit = await auditContent(near);
    expect(audit.articleResults.every((item) => item.manual.some((reason) => reason.includes('视觉高度近似')))).toBe(true);
  });

  it('reports missing sources, unchecked links, and missing fact checker accurately', async () => {
    const state = validState(1);
    state.confirmations.sourceLinks = false;
    state.confirmations.externalLinks = false;
    state.articles[0].sources = [];
    state.articles[0].fact_checked_by = '';
    const audit = await auditContent(state);
    expect(audit.articleResults[0].blockers).toContain('缺少事实来源或原始证据');
    expect(audit.articleResults[0].blockers).toContain('缺少真实事实核验者');
    expect(audit.canExportReview).toBe(false);
  });

  it('resolves duplicate and special-character slugs deterministically', () => {
    expect(uniqueSlugs([{ title: 'Hello, World!' }, { title: 'Hello World' }, { title: '東京' }]).map((item) => item.slug)).toEqual(['hello-world', 'hello-world-2', 'article-3']);
  });
});

describe('static site generation', () => {
  it('builds a review site with zero internal link errors and pre-rendered content', async () => {
    const state = validState(35);
    const audit = await auditContent(state);
    const site = await buildSite(state, 'review', audit);
    expect(site.linkAudit.errorCount).toBe(0);
    expect(site.files.has('sitemap.xml')).toBe(true);
    expect(site.files.has('robots.txt')).toBe(true);
    expect(site.files.has('404.html')).toBe(true);
    expect([...site.files.keys()].filter((path) => path.startsWith('articles/') && path.endsWith('/index.html'))).toHaveLength(35);
    expect(site.files.get('articles/alpha-guide/index.html')).toContain('alpha-aa');
    expect(site.files.get('index.html')).not.toContain('href="#"');
    expect(site.files.get('contact/index.html')).not.toContain('<form');
    expect(site.files.get('articles/alpha-guide/index.html')).not.toContain('adsbygoogle');
    expect(site.files.get('articles/alpha-guide/index.html')).toMatch(/<title>[^<]+<\/title>/);
    expect(site.files.get('articles/alpha-guide/index.html')).toMatch(/<link rel="canonical" href="https:\/\//);
  });

  it('creates a ZIP that can be decompressed with every static article present', async () => {
    const state = validState(35);
    const audit = await auditContent(state);
    const site = await buildSite(state, 'review', audit);
    const blob = await siteToZip(site);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer(), { checkCRC32: true });
    expect(zip.file('index.html')).toBeTruthy();
    expect(zip.file('site-audit-report.html')).toBeTruthy();
    expect(Object.keys(zip.files).filter((path) => /^articles\/[^/]+\/index\.html$/.test(path))).toHaveLength(35);
    const articleHtml = await zip.file('articles/alpha-guide/index.html').async('string');
    expect(articleHtml).toContain('alpha-aa');
  });

  it('loads the AdSense script once only in explicitly enabled ad exports', async () => {
    const state = validState(35);
    state.policy.adsEnabled = true;
    state.policy.publisherId = 'ca-pub-1234567890123456';
    state.policy.adMode = 'manual';
    state.policy.adSlot = '1234567890';
    state.policy.adsTxt = 'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0';
    const audit = await auditContent(state);
    const site = await buildSite(state, 'ads', audit);
    const html = site.files.get('articles/alpha-guide/index.html');
    expect((html.match(/pagead2\.googlesyndication\.com/g) || [])).toHaveLength(1);
    expect(html).toContain('Advertisements');
    expect(site.files.has('ads.txt')).toBe(true);
  });

  it('generates one article page for every required topic', async () => {
    for (const topic of ['tech', 'game', 'food', 'anime']) {
      const state = validState(1); state.topic = topic;
      const audit = await auditContent(state);
      const site = await buildSite(state, 'draft', audit);
      expect(site.files.has('articles/alpha-guide/index.html')).toBe(true);
    }
  });
});
