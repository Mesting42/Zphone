import JSZip from 'jszip';
import { STYLE_PRESETS, TOPICS } from '../config.js';
import {
  escapeHtml, escapeXml, formatDate, isSafeExternalUrl, makeExcerpt, normalizeBaseUrl, safeJson,
  safeMarkdown, slugify, toStringList, uniqueSlugs
} from './utils.js';

const TRUST_LINKS = [
  ['/about/', 'About Us'], ['/contact/', 'Contact Us'], ['/privacy/', 'Privacy Policy'], ['/terms/', 'Terms of Service']
];

export async function buildSite(state, mode = 'draft', audit = state.audit) {
  const isDraft = mode === 'draft';
  const eligible = audit?.articleResults?.filter((item) => isDraft || item.valid) || [];
  const rawArticles = eligible.map((item) => ({ ...item.article, _audit: item }));
  const articles = uniqueSlugs(rawArticles).map((article) => ({
    ...article,
    category: String(article.category || 'Uncategorized').trim() || 'Uncategorized',
    categorySlug: slugify(article.category || 'uncategorized'),
    author: String(article.author || state.identity.defaultAuthor || '').trim(),
    excerpt: String(article.excerpt || '').trim() || makeExcerpt(article.content)
  }));
  const categoryMap = new Map();
  articles.forEach((article) => {
    if (!categoryMap.has(article.categorySlug)) categoryMap.set(article.categorySlug, { name: article.category, slug: article.categorySlug, articles: [] });
    categoryMap.get(article.categorySlug).articles.push(article);
  });
  const categoryOrder = contextCategoryOrder(state.appearance.categories);
  const categories = [...categoryMap.values()].sort((left, right) => {
    const leftIndex = categoryOrder.indexOf(left.name.toLowerCase());
    const rightIndex = categoryOrder.indexOf(right.name.toLowerCase());
    if (leftIndex === -1 && rightIndex === -1) return left.name.localeCompare(right.name, 'en');
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
  const files = new Map();
  const context = { state, mode, isDraft, articles, categories };
  files.set('assets/css/style.css', siteCss(state.appearance));
  files.set('assets/js/site.js', siteJs());
  files.set('assets/images/image-unavailable.svg', fallbackImage());
  for (const image of state.data.images || []) files.set(image.outputPath, image.bytes);
  files.set('favicon.svg', favicon(state.appearance.preset));
  files.set('index.html', homePage(context));
  for (const category of categories) files.set(`category/${category.slug}/index.html`, categoryPage(context, category));
  for (const article of articles) files.set(`articles/${article.slug}/index.html`, articlePage(context, article));
  files.set('about/index.html', aboutPage(context));
  files.set('contact/index.html', contactPage(context));
  files.set('privacy/index.html', privacyPage(context));
  files.set('terms/index.html', termsPage(context));
  files.set('404.html', notFoundPage(context));
  files.set('robots.txt', robots(context));
  files.set('sitemap.xml', sitemap(context));
  if (validAdsTxt(state.policy.adsTxt, state.policy.publisherId)) files.set('ads.txt', state.policy.adsTxt.trim() + '\n');
  files.set('site-config.json', JSON.stringify(publicConfig(context), null, 2));
  let linkAudit = validateGeneratedFiles(files, normalizeBaseUrl(state.identity.baseUrl));
  files.set('site-audit-report.html', auditReportPage(context, audit, linkAudit));
  files.set('site-audit-report.json', JSON.stringify({ ...serializableAudit(audit), linkAudit }, null, 2));
  linkAudit = validateGeneratedFiles(files, normalizeBaseUrl(state.identity.baseUrl));
  files.set('site-audit-report.json', JSON.stringify({ ...serializableAudit(audit), linkAudit }, null, 2));
  return { files, linkAudit, articles, categories };
}

export async function siteToZip(site, onProgress = () => {}) {
  const zip = new JSZip();
  let index = 0;
  for (const [path, content] of site.files) {
    zip.file(path, content);
    index += 1;
    onProgress(Math.round((index / site.files.size) * 40), `正在收集文件 ${index}/${site.files.size}`);
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }, (meta) => {
    onProgress(40 + Math.round(meta.percent * .6), `正在压缩 ${Math.round(meta.percent)}%`);
  });
}

function siteIdentity(context) {
  const { identity } = context.state;
  return {
    name: identity.siteName || 'Draft Site — identity required',
    tagline: identity.tagline || 'Draft preview — add an accurate site tagline',
    description: identity.description || 'This draft is incomplete and must not be submitted for review.',
    baseUrl: normalizeBaseUrl(identity.baseUrl) || 'https://invalid.local/',
    publisher: identity.publisherName || 'Publisher details required',
    copyright: identity.copyrightOwner || 'Copyright owner required'
  };
}

function pageShell(context, { title, description, path, body, type = 'website', image = '', jsonLd = null, indexable = true }) {
  const site = siteIdentity(context);
  const canonical = new URL(path.replace(/^\//, ''), site.baseUrl).href;
  const categories = context.categories.map((category) => `<a href="/category/${category.slug}/">${escapeHtml(category.name)}</a>`).join('');
  const draftBanner = context.isDraft ? '<div class="draft-banner" role="status">DRAFT EXPORT · Incomplete items may remain · Not for publication or AdSense review</div>' : '';
  const adsScript = adsHead(context);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(canonical)}"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
${indexable ? '' : '<meta name="robots" content="noindex">'}<meta property="og:type" content="${type}"><meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}">${image ? `<meta property="og:image" content="${escapeHtml(new URL(image.replace(/^\//, ''), site.baseUrl).href)}">` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}"><link rel="stylesheet" href="/assets/css/style.css">${adsScript}
${jsonLd ? `<script type="application/ld+json">${safeJson(jsonLd)}</script>` : ''}<style>${appearanceCss(context.state.appearance)}</style></head>
<body class="density-${escapeHtml(context.state.appearance.density)} home-${escapeHtml(context.state.appearance.homeLinkStyle)} meta-${escapeHtml(context.state.appearance.metaLayout)} ${context.state.appearance.animation ? 'motion-enabled' : ''}">${draftBanner}<a class="skip" href="#main">Skip to content</a>
<header class="site-header nav-${escapeHtml(context.state.appearance.navLayout)}"><a class="brand" href="/" aria-label="${escapeHtml(site.name)} home"><span class="brand-mark" aria-hidden="true">SF</span><span>${escapeHtml(site.name)}</span></a>
<button class="menu-button" type="button" aria-expanded="false" aria-controls="site-navigation">Menu</button>
<nav id="site-navigation" aria-label="Primary navigation">${categories}<a href="/about/">About</a></nav></header>
<main id="main">${body}</main>${footer(context)}<script src="/assets/js/site.js" defer></script></body></html>`;
}

function homePage(context) {
  const site = siteIdentity(context);
  const sorted = sortArticles(context.articles, context.state.appearance.sort, context.state.appearance.seed);
  const hero = context.state.appearance.hero ? `<section class="hero"><p class="eyebrow">Independent ${escapeHtml(TOPICS[context.state.topic]?.english || 'Editorial')} coverage</p><h1>${escapeHtml(site.tagline)}</h1><p>${escapeHtml(site.description)}</p></section>` : `<section class="page-intro compact"><p class="eyebrow">${escapeHtml(site.tagline)}</p><h1>${escapeHtml(site.name)}</h1><p>${escapeHtml(site.description)}</p></section>`;
  const categoryLinks = context.categories.map((category) => `<a class="category-chip" href="/category/${category.slug}/">${escapeHtml(category.name)} <span>${category.articles.length}</span></a>`).join('');
  const perCategory = Math.max(3, Math.min(12, Number(context.state.appearance.cardsPerCategory) || 6));
  const categorySections = context.categories.map((category, categoryIndex) => {
    const cards = sortArticles(category.articles, context.state.appearance.sort, context.state.appearance.seed).slice(0, perCategory).map((article, index) => articleCard(article, categoryIndex === 0 && index < 3)).join('');
    return `<section class="content-section"><div class="section-head"><div><p class="eyebrow">Topic desk</p><h2>${escapeHtml(category.name)}</h2></div><a href="/category/${category.slug}/">View all ${category.articles.length}</a></div><div class="article-grid">${cards}</div></section>`;
  }).join('');
  const body = `${hero}<nav class="category-strip" aria-label="Browse categories">${categoryLinks}</nav>${categorySections || `<section class="content-section">${emptyDraft('No valid articles are available yet.')}</section>`}`;
  return pageShell(context, {
    title: `${site.name} — ${site.tagline}`, description: site.description, path: '/', body,
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, url: site.baseUrl, description: site.description, publisher: { '@type': 'Organization', name: site.publisher } }
  });
}

function categoryPage(context, category) {
  const site = siteIdentity(context);
  const body = `${breadcrumb('Home', '/', category.name)}<section class="page-intro"><p class="eyebrow">Topic archive</p><h1>${escapeHtml(category.name)}</h1><p>${category.articles.length} independent articles published by ${escapeHtml(site.name)}.</p></section><div class="article-grid">${category.articles.map(articleCard).join('')}</div>`;
  return pageShell(context, { title: `${category.name} | ${site.name}`, description: `Browse ${category.articles.length} ${category.name} articles from ${site.name}.`, path: `/category/${category.slug}/`, body });
}

function articlePage(context, article) {
  const site = siteIdentity(context);
  const result = article._audit;
  const image = articleImage(article, false);
  const sourceItems = sourceUrls(article.sources).map((url) => `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(new URL(url).hostname)} source</a></li>`).join('');
  const related = context.articles.filter((item) => item.slug !== article.slug && item.categorySlug === article.categorySlug).slice(0, Number(context.state.appearance.relatedCount) || 4);
  const ad = context.mode === 'ads' && context.state.policy.adsEnabled && context.state.policy.adMode === 'manual' ? manualAd(context) : '';
  const body = `${breadcrumb('Home', '/', article.category, `/category/${article.categorySlug}/`)}<article class="article-page"><header class="article-heading"><a class="category-kicker" href="/category/${article.categorySlug}/">${escapeHtml(article.category)}</a><h1>${escapeHtml(article.title)}</h1><p class="article-deck">${escapeHtml(article.excerpt)}</p><div class="byline"><span>By ${escapeHtml(article.author)}</span><span>Published <time datetime="${escapeHtml(formatDate(article.published_at))}">${escapeHtml(formatDate(article.published_at))}</time></span><span>${result?.wordCount || 0} words</span></div></header>${image}${ad}<div class="article-layout"><div class="prose">${safeMarkdown(article.content)}</div><aside class="fact-box"><h2>Editorial record</h2><dl><div><dt>Fact checked by</dt><dd>${escapeHtml(article.fact_checked_by)}</dd></div><div><dt>Checked on</dt><dd>${escapeHtml(formatDate(article.fact_checked_at))}</dd></div><div><dt>Image rights</dt><dd>${escapeHtml(article.cover_image_source)}</dd></div></dl>${sourceItems ? `<h3>Sources</h3><ul>${sourceItems}</ul>` : ''}</aside></div></article>${related.length ? `<section class="related"><p class="eyebrow">Continue reading</p><h2>Related ${escapeHtml(article.category)} coverage</h2><div class="article-grid compact-grid">${related.map(articleCard).join('')}</div></section>` : ''}`;
  const imagePath = imagePathFor(article);
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Article', headline: article.title, description: article.excerpt, image: new URL(imagePath.replace(/^\//, ''), site.baseUrl).href, datePublished: formatDate(article.published_at), ...(formatDate(article.updated_at) ? { dateModified: formatDate(article.updated_at) } : {}), author: { '@type': 'Person', name: article.author }, publisher: { '@type': 'Organization', name: site.publisher }, mainEntityOfPage: new URL(`articles/${article.slug}/`, site.baseUrl).href };
  return pageShell(context, { title: `${article.title} | ${site.name}`, description: article.excerpt, path: `/articles/${article.slug}/`, type: 'article', image: imagePath, jsonLd, body });
}

function aboutPage(context) {
  const site = siteIdentity(context);
  const i = context.state.identity;
  const body = `${breadcrumb('Home', '/', 'About Us')}<article class="policy-page"><p class="eyebrow">Trust & transparency</p><h1>About Us</h1><p>${escapeHtml(site.description)}</p><h2>Who publishes this site</h2><p>${escapeHtml(site.name)} is operated by ${escapeHtml(i.publisherName || site.publisher)} for readers in ${escapeHtml(i.targetRegions || 'the stated target regions')}.</p><h2>Editorial process</h2><p>${escapeHtml(i.editorialProcess || 'Editorial process details are required before publication.')}</p><h2>How our content is made</h2><p>${escapeHtml(i.contentOrigin || 'Content origin details are required before publication.')}</p><p>Corrections can be requested through our <a href="/contact/">contact page</a>.</p></article>`;
  return pageShell(context, { title: `About Us | ${site.name}`, description: `Learn who operates ${site.name} and how its content is created, checked, updated, and corrected.`, path: '/about/', body });
}

function contactPage(context) {
  const site = siteIdentity(context);
  const email = context.state.identity.contactEmail;
  const mailLink = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `<a class="contact-link" href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : '<p class="draft-note">A working contact email is required before publication.</p>';
  const body = `${breadcrumb('Home', '/', 'Contact Us')}<article class="policy-page"><p class="eyebrow">Questions & corrections</p><h1>Contact Us</h1><p>Contact ${escapeHtml(site.name)} about corrections, editorial questions, image rights, or privacy requests.</p>${mailLink}<p>We do not display a form because no verified form-processing endpoint is configured. Email opens in your own mail application.</p></article>`;
  return pageShell(context, { title: `Contact Us | ${site.name}`, description: `Contact ${site.name} about editorial corrections, rights, privacy, or general questions.`, path: '/contact/', body });
}

function privacyPage(context) {
  const site = siteIdentity(context);
  const p = context.state.policy;
  const i = context.state.identity;
  const ads = p.adsEnabled || p.publisherId;
  const body = `${breadcrumb('Home', '/', 'Privacy Policy')}<article class="policy-page"><p class="eyebrow">Effective ${escapeHtml(p.privacyEffectiveDate || 'date required')}</p><h1>Privacy Policy</h1><p>This policy explains how ${escapeHtml(site.name)}, operated by ${escapeHtml(i.publisherName || site.publisher)}, handles information.</p><h2>Information we process</h2><p>${p.analyticsEnabled ? 'The site uses the analytics service configured by the publisher. The publisher must document its provider, cookies, retention, and legal basis before deployment.' : 'This export does not include an analytics script.'} The site itself does not require an account.</p><h2>Contact and retention</h2><p>Messages sent to <a href="mailto:${escapeHtml(i.contactEmail)}">${escapeHtml(i.contactEmail)}</a> are processed to answer the request and retained only as reasonably necessary for that purpose and legal obligations.</p>${ads ? `<h2>Advertising and cookies</h2><p>Google and other third-party vendors may use cookies to serve ads based on a visitor’s prior visits to this site or other sites. Google’s use of advertising cookies enables it and its partners to serve ads based on those visits. Users can manage personalized advertising in <a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer">Google Ads Settings</a>.</p>` : '<h2>Advertising</h2><p>This export does not load advertising scripts.</p>'}<h2>Sharing and user choices</h2><p>Information may be shared with service providers only as needed to operate the services described here, or when required by law. Depending on location, visitors may have rights to access, correct, delete, restrict, or object to processing.</p><h2>Children’s privacy</h2><p>This site is not directed to children under the age required for independent consent in their jurisdiction.</p><h2>Regional requirements</h2><p>The intended audience includes ${escapeHtml(i.targetRegions || 'regions that must be specified')}. The operator must implement any required consent mechanism and region-specific disclosures before deployment.</p><h2>Legal notice</h2><p>This editable template is not legal advice. The operator should obtain advice appropriate to its location, audience, and actual services.</p></article>`;
  return pageShell(context, { title: `Privacy Policy | ${site.name}`, description: `How ${site.name} handles contact information, cookies, advertising, retention, sharing, and visitor choices.`, path: '/privacy/', body });
}

function termsPage(context) {
  const site = siteIdentity(context);
  const i = context.state.identity;
  const topicNote = ({ tech: 'Software, security, compatibility, and product information can change; verify critical steps with the original vendor.', game: 'Prices, availability, ratings, and release information can change; confirm them with the publisher or store.', food: 'Readers must assess allergens, food safety, dietary restrictions, and nutrition information for their own circumstances.', anime: 'Availability, schedules, ratings, and licensing can vary by region and change over time.' })[context.state.topic];
  const body = `${breadcrumb('Home', '/', 'Terms of Service')}<article class="policy-page"><p class="eyebrow">Use of this publication</p><h1>Terms of Service</h1><h2>Scope</h2><p>${escapeHtml(site.name)} provides editorial information for general informational purposes.</p><h2>Acceptable use</h2><p>You may access and link to public pages. You may not disrupt the site, bypass security, misuse content, or falsely represent an affiliation with the publisher.</p><h2>Intellectual property</h2><p>Unless stated otherwise, site text and original assets are controlled by ${escapeHtml(i.copyrightOwner || site.copyright)}. Third-party marks and referenced works remain with their owners.</p><h2>Editorial limitations</h2><p>${escapeHtml(topicNote)}</p><h2>External links</h2><p>External links are provided for context. Their availability and content are controlled by third parties.</p><h2>Disclaimer and liability</h2><p>Information is provided without a promise that it will suit every purpose. To the extent permitted by applicable law, the operator is not responsible for indirect losses caused by reliance on the site.</p><h2>Changes</h2><p>These terms may be updated when the service or legal requirements materially change. Questions can be sent through the <a href="/contact/">contact page</a>.</p></article>`;
  return pageShell(context, { title: `Terms of Service | ${site.name}`, description: `Terms governing access to and use of ${site.name}, including content rights and editorial limitations.`, path: '/terms/', body });
}

function notFoundPage(context) {
  const site = siteIdentity(context);
  const suggestions = context.articles.slice(0, 3).map(articleCard).join('');
  const body = `<section class="not-found"><p class="eyebrow">Error 404</p><h1>That page could not be found</h1><p>The address may have changed. Return to <a href="/">${escapeHtml(site.name)}</a> or continue with recent coverage.</p></section>${suggestions ? `<section class="article-grid">${suggestions}</section>` : ''}`;
  return pageShell(context, { title: `Page Not Found | ${site.name}`, description: `The requested page was not found on ${site.name}.`, path: '/404.html', body, indexable: false });
}

function articleCard(article, eager = false) {
  const image = articleImage(article, true, eager);
  return `<article class="article-card"><a href="/articles/${article.slug}/" aria-label="Read ${escapeHtml(article.title)}"><div class="card-media">${image}</div><div class="card-body"><span class="card-category">${escapeHtml(article.category)}</span><h3>${escapeHtml(article.title)}</h3><p>${escapeHtml(article.excerpt)}</p><span class="card-meta">${escapeHtml(formatDate(article.published_at))} · ${article._audit?.wordCount || 0} words</span></div></a></article>`;
}

function imagePathFor(article) {
  if (article._image?.outputPath) return `/${article._image.outputPath}`;
  if (isSafeExternalUrl(article.image)) return article.image;
  return '/assets/images/image-unavailable.svg';
}

function articleImage(article, card = false, eager = false) {
  const path = imagePathFor(article);
  const width = article._image?.width || 1200;
  const height = article._image?.height || 675;
  const alt = String(article.image_alt || '').trim() || `Cover image for ${article.title}`;
  return `<img src="${escapeHtml(path)}" alt="${escapeHtml(alt)}" width="${width}" height="${height}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} onerror="this.onerror=null;this.src='/assets/images/image-unavailable.svg'"${card ? '' : ' class="article-cover"'}>`;
}

function breadcrumb(label, href, current, parentHref = '') {
  const middle = parentHref ? `<a href="${escapeHtml(parentHref)}">${escapeHtml(current)}</a><span aria-hidden="true">/</span><span>Article</span>` : `<span>${escapeHtml(current)}</span>`;
  return `<nav class="breadcrumb" aria-label="Breadcrumb"><a href="${escapeHtml(href)}">${escapeHtml(label)}</a><span aria-hidden="true">/</span>${middle}</nav>`;
}

function footer(context) {
  const site = siteIdentity(context);
  const links = TRUST_LINKS.map(([href, label]) => `<a href="${href}">${label}</a>`).join('');
  return `<footer class="footer-${escapeHtml(context.state.appearance.footerLayout)}"><div><a class="footer-brand" href="/">${escapeHtml(site.name)}</a><p>${escapeHtml(site.tagline)}</p></div><nav aria-label="Policies">${links}</nav><p>© ${new Date().getUTCFullYear()} ${escapeHtml(site.copyright)}. Content quality checks improve review preparation; they do not guarantee approval.</p></footer>`;
}

function sourceUrls(value) {
  const values = Array.isArray(value) ? value.map((item) => typeof item === 'object' ? item.url || item.href || '' : item) : toStringList(value);
  return values.map(String).filter(isSafeExternalUrl);
}

function contextCategoryOrder(value) {
  return (Array.isArray(value) ? value : toStringList(value)).map((item) => item.toLowerCase());
}

function appearanceCss(appearance) {
  const columns = ['2', '3', '4'].includes(String(appearance.columns)) ? Number(appearance.columns) : 3;
  return `body.density-compact{font-size:16px}body.density-airy{line-height:1.85}.density-compact .card-body{padding:.9rem}.density-airy .card-body{padding:1.6rem}.motion-enabled .article-card:has(a:hover){transform:translateY(-3px)}.motion-enabled .article-card:hover .card-media img{transform:scale(1.03)}.footer-minimal>div p{display:none}.home-button .breadcrumb>a:first-child{padding:.45rem .75rem;background:var(--accent);color:white;border-radius:8px;text-decoration:none}.meta-grid .byline{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}.meta-tags .byline span{padding:.3rem .65rem;border:1px solid var(--line);border-radius:999px}@media(min-width:700px){.article-grid{grid-template-columns:repeat(${columns > 2 ? 2 : columns},1fr)}}@media(min-width:980px){.article-grid{grid-template-columns:repeat(${columns},1fr)}.site-header.nav-center{display:grid;grid-template-columns:1fr auto 1fr}.site-header.nav-center nav{justify-self:end}.site-header.nav-left{justify-content:flex-start}.site-header.nav-left nav{margin-left:2rem}}`;
}

function sortArticles(articles, sort, seed) {
  const result = [...articles];
  if (sort === 'title') result.sort((a, b) => a.title.localeCompare(b.title, 'en'));
  if (sort === 'date') result.sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)));
  if (sort === 'shuffle') result.sort((a, b) => seededScore(a.slug, seed) - seededScore(b.slug, seed));
  return result;
}

function seededScore(value, seed) {
  let score = 0;
  for (const char of `${seed}:${value}`) score = (score * 31 + char.charCodeAt(0)) >>> 0;
  return score;
}

function manualAd(context) {
  const p = context.state.policy;
  return `<aside class="ad-space" aria-label="Advertisement"><span>Advertisements</span><ins class="adsbygoogle" style="display:block" data-ad-client="${escapeHtml(p.publisherId)}" data-ad-slot="${escapeHtml(p.adSlot)}" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></aside>`;
}

function adsHead(context) {
  const p = context.state.policy;
  const verification = /^[a-zA-Z0-9._-]{8,160}$/.test(String(p.adsenseVerification || '')) ? `<meta name="google-adsense-account" content="${escapeHtml(p.adsenseVerification)}">` : '';
  if (context.mode !== 'ads' || !p.adsEnabled || !/^ca-pub-\d{16}$/.test(p.publisherId)) return verification;
  return `${verification}<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${escapeHtml(p.publisherId)}" crossorigin="anonymous"></script>`;
}

function validAdsTxt(value, publisherId) {
  const pub = String(publisherId || '').replace(/^ca-/, '');
  return pub && String(value || '').split('\n').some((line) => line.trim() === `google.com, ${pub}, DIRECT, f08c47fec0942fa0`);
}

function robots(context) {
  const base = siteIdentity(context).baseUrl;
  return `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap.xml', base).href}\n`;
}

function sitemap(context) {
  const base = siteIdentity(context).baseUrl;
  const paths = ['/', ...context.categories.map((item) => `/category/${item.slug}/`), ...context.articles.map((item) => `/articles/${item.slug}/`), '/about/', '/contact/', '/privacy/', '/terms/'];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((path) => `  <url><loc>${escapeXml(new URL(path.replace(/^\//, ''), base).href)}</loc></url>`).join('\n')}\n</urlset>\n`;
}

function publicConfig(context) {
  const { state } = context;
  return { version: state.version, generatedAt: new Date().toISOString(), mode: context.mode, topic: state.topic, site: { name: state.identity.siteName, tagline: state.identity.tagline, description: state.identity.description, baseUrl: normalizeBaseUrl(state.identity.baseUrl), publisherName: state.identity.publisherName, copyrightOwner: state.identity.copyrightOwner, editorialProcess: state.identity.editorialProcess, contentOrigin: state.identity.contentOrigin, targetRegions: state.identity.targetRegions }, appearance: state.appearance, advertising: { enabled: context.mode === 'ads' && state.policy.adsEnabled, mode: state.policy.adMode, publisherId: state.policy.publisherId || null } };
}

function auditReportPage(context, audit, linkAudit) {
  const site = siteIdentity(context);
  const issues = [...(audit?.issues || []), ...linkAudit.issues].map((item) => `<tr><td><span class="audit-tag ${item.severity.toLowerCase().replaceAll(' ', '-')}">${escapeHtml(item.severity)}</span></td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.detail)}</td></tr>`).join('');
  const body = `${breadcrumb('Home', '/', 'Site audit report')}<article class="policy-page wide"><p class="eyebrow">Generated evidence</p><h1>Site Audit Report</h1><p><strong>Status:</strong> ${escapeHtml(audit?.status || 'NOT ASSESSABLE')}</p><p>This report covers deterministic local checks and completed confirmations. It is not a Google score or approval promise.</p><h2>Summary</h2><p>${audit?.validCount || 0} valid articles · ${linkAudit.errorCount} internal link errors · ${context.articles.length} exported articles.</p><div class="table-scroll"><table><thead><tr><th>Level</th><th>Check</th><th>Evidence</th></tr></thead><tbody>${issues}</tbody></table></div></article>`;
  return pageShell(context, { title: `Site Audit Report | ${site.name}`, description: `Automated site quality and link-check evidence for ${site.name}.`, path: '/site-audit-report.html', body, indexable: false });
}

function serializableAudit(audit) {
  if (!audit) return null;
  return { generatedAt: audit.generatedAt, status: audit.status, counts: audit.counts, validCount: audit.validCount, canExportReview: audit.canExportReview, issues: audit.issues, articles: audit.articleResults.map(({ title, wordCount, blockers, manual, warnings, valid, imageHash, imageFingerprint }) => ({ title, wordCount, blockers, manual, warnings, valid, imageHash, imageFingerprint })) };
}

export function validateGeneratedFiles(files, baseUrl = '') {
  const issues = [];
  const htmlFiles = [...files.keys()].filter((path) => path.endsWith('.html'));
  const targetExists = (path) => files.has(path) || files.has(`${path.replace(/\/$/, '')}/index.html`);
  for (const file of htmlFiles) {
    const html = String(files.get(file));
    const attrs = [...html.matchAll(/\b(?:href|src)="([^"]*)"/g)];
    for (const match of attrs) {
      const value = match[1];
      if (!value || value === '#' || /^javascript:/i.test(value)) {
        issues.push({ severity: 'BLOCKER', title: '无效链接', detail: `${file}: ${value || '(empty)'}`, targetStep: 6 });
        continue;
      }
      if (/^(https:|mailto:|tel:|data:)/i.test(value)) continue;
      if (/^http:/i.test(value)) {
        issues.push({ severity: 'HIGH', title: '不安全外链', detail: `${file}: ${value}`, targetStep: 6 });
        continue;
      }
      if (value.startsWith('/')) {
        const clean = decodeURIComponent(value.split(/[?#]/)[0]).replace(/^\//, '');
        const target = clean || 'index.html';
        if (!targetExists(target)) issues.push({ severity: 'BLOCKER', title: '内部资源缺失', detail: `${file} → ${value}`, targetStep: 6 });
      }
    }
    const h1Count = (html.match(/<h1\b/g) || []).length;
    if (h1Count !== 1) issues.push({ severity: 'BLOCKER', title: 'H1 数量错误', detail: `${file} 有 ${h1Count} 个 H1。`, targetStep: 6 });
    if (!/<link rel="canonical" href="https:\/\//.test(html) && baseUrl) issues.push({ severity: 'BLOCKER', title: 'Canonical 缺失', detail: `${file} 没有有效 HTTPS canonical。`, targetStep: 6 });
    for (const [href] of TRUST_LINKS) if (!html.includes(`href="${href}"`)) issues.push({ severity: 'BLOCKER', title: 'Footer 信任链接缺失', detail: `${file} 缺少 ${href}`, targetStep: 6 });
  }
  if (!files.has('sitemap.xml') || !files.has('robots.txt') || !files.has('404.html')) issues.push({ severity: 'BLOCKER', title: '抓取基础文件缺失', detail: '必须同时生成 sitemap.xml、robots.txt 和 404.html。', targetStep: 6 });
  if (!issues.length) issues.push({ severity: 'PASS', title: '内部链接完整', detail: `检查 ${htmlFiles.length} 个 HTML 文件，内部链接和强制 Footer 链接均可解析。`, targetStep: 6 });
  return { checkedPages: htmlFiles.length, errorCount: issues.filter((item) => item.severity !== 'PASS').length, issues };
}

function emptyDraft(message) { return `<div class="empty-state"><strong>Draft is incomplete</strong><p>${escapeHtml(message)}</p></div>`; }

function fallbackImage() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="t d"><title id="t">Image unavailable</title><desc id="d">Draft placeholder; replace before publication.</desc><rect width="1200" height="675" fill="#e8ece8"/><path d="M360 430l120-130 82 82 90-116 188 214H360z" fill="#aeb9b1"/><circle cx="734" cy="224" r="42" fill="#cbd2cc"/><text x="600" y="560" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#48554d">IMAGE REQUIRED BEFORE PUBLICATION</text></svg>`;
}

function favicon(preset) {
  const accent = STYLE_PRESETS[preset]?.[2] || '#34785a';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${accent}"/><path d="M18 18h28v8H27v7h16v8H27v13h-9V18z" fill="white"/></svg>`;
}

function siteJs() {
  return `document.querySelectorAll('.menu-button').forEach((button)=>{button.addEventListener('click',()=>{const nav=document.getElementById(button.getAttribute('aria-controls'));const open=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!open));nav?.classList.toggle('open',!open);});});`;
}

function siteCss(appearance) {
  const palette = STYLE_PRESETS[appearance.preset] || STYLE_PRESETS.Forest;
  const radius = Math.max(0, Math.min(28, Number(appearance.radius) || 0));
  return `:root{--bg:${palette[0]};--ink:${palette[1]};--accent:${palette[2]};--panel:${palette[3]};--muted:color-mix(in srgb,var(--ink) 64%,transparent);--line:color-mix(in srgb,var(--ink) 16%,transparent);--radius:${radius}px;--shadow:${appearance.shadow ? '0 18px 45px color-mix(in srgb,var(--ink) 12%,transparent)' : 'none'};font-family:"Aptos","Segoe UI",sans-serif;color:var(--ink);background:var(--bg)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font-size:17px;line-height:1.7}a{color:inherit;text-underline-offset:.2em}img{display:block;max-width:100%;height:auto;background:var(--line)}.skip{position:fixed;top:8px;left:8px;transform:translateY(-150%);background:var(--ink);color:var(--bg);padding:.7rem 1rem;z-index:99}.skip:focus{transform:none}.draft-banner{padding:.55rem 1rem;background:#7d2f24;color:white;text-align:center;font-weight:800;font-size:.78rem;letter-spacing:.08em}.site-header{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem clamp(1rem,4vw,5rem);border-bottom:1px solid var(--line);position:relative}.brand{display:flex;align-items:center;gap:.65rem;text-decoration:none;font-weight:850;letter-spacing:-.02em}.brand-mark{display:grid;place-items:center;width:38px;height:38px;background:var(--accent);color:white;border-radius:11px;font-size:.72rem}.menu-button{min-width:48px;min-height:44px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--ink);font:inherit}.site-header nav{display:none;position:absolute;left:1rem;right:1rem;top:68px;padding:1rem;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);z-index:9}.site-header nav.open{display:grid}.site-header nav a{padding:.7rem;text-decoration:none}.site-header nav a:focus-visible,.site-header nav a:hover{color:var(--accent)}main{width:min(1180px,calc(100% - 2rem));margin:auto}.hero,.page-intro{padding:clamp(3.5rem,9vw,8rem) 0 clamp(2.5rem,6vw,5rem);max-width:850px}.page-intro.compact{padding-bottom:2rem}.eyebrow,.category-kicker{font-size:.72rem;font-weight:850;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);text-decoration:none}.hero h1,.page-intro h1,.article-heading h1,.policy-page h1,.not-found h1{font-family:Georgia,"Times New Roman",serif;font-size:clamp(2.5rem,8vw,6.6rem);line-height:.96;letter-spacing:-.055em;margin:.5rem 0 1.25rem}.page-intro h1,.policy-page h1,.not-found h1{font-size:clamp(2.4rem,6vw,5rem)}.hero p,.page-intro p,.article-deck{font-size:clamp(1.05rem,2vw,1.35rem);max-width:680px;color:var(--muted)}.category-strip{display:flex;gap:.6rem;overflow:auto;padding:.75rem 0 2rem}.category-chip{display:flex;gap:.65rem;white-space:nowrap;padding:.65rem .9rem;border:1px solid var(--line);border-radius:999px;text-decoration:none}.category-chip span{color:var(--accent);font-weight:800}.content-section{padding:1rem 0 6rem}.section-head{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:1.5rem;border-top:1px solid var(--line);padding-top:1.25rem}.section-head h2,.related h2{font-size:clamp(1.7rem,4vw,2.8rem);line-height:1.1;margin:.3rem 0}.article-grid{display:grid;grid-template-columns:1fr;gap:1rem}.article-card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow);transition:transform .2s ease}.article-card:has(a:hover){transform:translateY(-3px)}.article-card>a{display:block;height:100%;text-decoration:none}.card-media{aspect-ratio:16/9;overflow:hidden}.card-media img{width:100%;height:100%;object-fit:cover;transition:transform .35s ease}.article-card:hover .card-media img{transform:scale(1.03)}.card-body{padding:1.25rem}.card-category,.card-meta{font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}.card-body h3{font-family:Georgia,serif;font-size:1.5rem;line-height:1.15;margin:.55rem 0}.card-body p{color:var(--muted);display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden}.breadcrumb{display:flex;gap:.5rem;padding:1.5rem 0;font-size:.85rem;color:var(--muted)}.article-page{padding-bottom:5rem}.article-heading{max-width:900px;margin:clamp(2rem,6vw,5rem) auto 2rem}.article-heading h1{font-size:clamp(2.5rem,7vw,5.8rem)}.byline{display:flex;flex-wrap:wrap;gap:.65rem 1.5rem;padding:1rem 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-size:.85rem}.article-cover{width:100%;max-height:700px;object-fit:cover;border-radius:var(--radius)}.article-layout{display:grid;gap:2rem;max-width:1000px;margin:clamp(2rem,6vw,5rem) auto}.prose{max-width:72ch}.prose h2{font-family:Georgia,serif;font-size:clamp(1.7rem,4vw,2.4rem);line-height:1.2;margin-top:2.4rem}.prose h3{font-size:1.35rem;margin-top:2rem}.prose p{margin:1.3rem 0}.fact-box{align-self:start;padding:1.25rem;border:1px solid var(--line);border-radius:var(--radius);background:var(--panel)}.fact-box h2{font-size:1.1rem}.fact-box dl div{padding:.6rem 0;border-top:1px solid var(--line)}.fact-box dt{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}.fact-box dd{margin:0}.related{padding:4rem 0;border-top:1px solid var(--line)}.policy-page{max-width:760px;margin:3rem auto 7rem}.policy-page.wide{max-width:1100px}.policy-page h2{font-family:Georgia,serif;font-size:1.9rem;margin-top:2.8rem}.contact-link{display:inline-block;font-size:1.5rem;margin:1.5rem 0}.not-found{text-align:center;max-width:760px;margin:6rem auto}.empty-state,.draft-note{padding:1.5rem;border:2px dashed var(--line);border-radius:var(--radius)}.ad-space{min-height:160px;display:grid;place-items:center;margin:2rem 0;border:1px solid var(--line);background:var(--panel)}.ad-space>span{font-size:.68rem;text-transform:uppercase;letter-spacing:.15em;color:var(--muted)}footer{padding:3rem clamp(1rem,4vw,5rem);border-top:1px solid var(--line);display:grid;gap:2rem}footer nav{display:flex;flex-wrap:wrap;gap:1rem}footer>p{font-size:.8rem;color:var(--muted)}.footer-brand{font-family:Georgia,serif;font-size:1.5rem;font-weight:700}.table-scroll{overflow:auto}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:.75rem;border-bottom:1px solid var(--line);vertical-align:top}.audit-tag{font-size:.65rem;font-weight:850;white-space:nowrap}.blocker,.high{color:#a33222}.pass{color:#287454}.needs-manual-verification,.warning{color:#8b5a16}:focus-visible{outline:3px solid var(--accent);outline-offset:3px}@media(min-width:700px){.article-grid{grid-template-columns:repeat(2,1fr)}.compact-grid{grid-template-columns:repeat(2,1fr)}footer{grid-template-columns:1fr 1fr}.article-layout{grid-template-columns:minmax(0,1fr) 280px}.menu-button{display:none}.site-header nav{display:flex;position:static;padding:0;background:none;border:0}.site-header nav a{padding:.5rem}}@media(min-width:1040px){.article-grid{grid-template-columns:repeat(3,1fr)}.compact-grid{grid-template-columns:repeat(3,1fr)}footer{grid-template-columns:1.2fr 1fr .8fr}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}`;
}
