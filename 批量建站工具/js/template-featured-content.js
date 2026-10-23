/** Featured content is a second view of the first record, not a category slot.
 * Recognition requires a real template detail route; branding and navigation
 * headings alone are never sufficient evidence for replacing a region. */
import { entryText, resolveLocal } from './template-reuse-content.js';
import { templateCardHref } from './template-reuse-layout.js';

const protectedRegion = 'nav,footer,[id^="adv"],[id^="div-gpt-ad"],.ad-slot,[data-ad-slot]';
const protectedField = protectedRegion + ',.icon,[data-icon],[aria-hidden="true"],.category-title,.section-title,[data-category-title]';
const featuredMarker = /(?:^|[-_\s])(?:hero|featured|spotlight)(?:[-_\s]|$)/i;
export const featuredTitleSelector = '[data-content-title],h1,h2,h3,h4,[class*="title"],[class*="name"]';

/** Field lookups exclude category headings, icons and ad-owned descendants. */
export function featuredField(region, selectors) {
    for (const selector of selectors.split(',')) {
        const node = [...region.querySelectorAll(selector)].find(candidate => !candidate.closest(protectedField));
        if (node) return node;
    }
    return null;
}

/** A single feature can repeat its title in a video caption or overlay. */
export function featuredHeadings(region) {
    return [...region.querySelectorAll('h1,h2,h3,h4,[data-content-title]')].filter(node => !node.closest(protectedField));
}

/** Normalize absolute same-site links as well as archive-relative routes. */
export function templateDetailPath(node, owner, metadata) {
    let href = templateCardHref(node);
    if (/^https?:\/\//i.test(href)) {
        try { const url = new URL(href); if (url.hostname !== metadata.detectedHost) return ''; href = url.pathname; }
        catch { return ''; }
    }
    return resolveLocal(href, owner, metadata.siteRoot).toLowerCase();
}

export function templateFeaturedRegions(doc, owner, metadata, cards) {
    const paths = new Set((metadata.detailPaths || []).map(path => path.toLowerCase()));
    const links = [...doc.querySelectorAll('a[href],[onclick]')].filter(node => !node.closest(protectedRegion) && paths.has(templateDetailPath(node, owner, metadata)));
    const featured = [];
    for (const link of links) {
        let candidate = null;
        for (let node = link; node && !node.matches('body,main,nav,footer'); node = node.parentElement) {
            // A multi-record collection must never be replaced as one feature.
            if (new Set(links.filter(item => node.contains(item)).map(item => templateDetailPath(item, owner, metadata))).size !== 1) break;
            if (node.closest(protectedRegion)) break;
            if (node.querySelector(featuredTitleSelector) && (node.querySelector('h1') || node.hasAttribute('data-content-featured') || featuredMarker.test(node.className || ''))) candidate = node;
        }
        if (candidate && !featured.some(node => node === candidate || node.contains(candidate))) featured.push(candidate);
    }
    // A recognized ordinary card may itself have an h1 without a hero class.
    for (const card of cards) if (card.querySelector('h1') && !card.closest(protectedRegion) && !featured.some(node => node.contains(card))) featured.push(card);
    return featured.filter(node => !featured.some(other => other !== node && other.contains(node)));
}

/** Read only URL-bearing background declarations. Stylesheets remain byte-for-
 * byte intact; a local inline override updates the recognized cover element.
 * This deliberately does not evaluate uploaded scripts or arbitrary CSS. */
function stylesheetCovers(doc, entries, owner, metadata, region) {
    const sheets = [...doc.querySelectorAll('style')].map(node => node.textContent);
    for (const link of doc.querySelectorAll('link[rel="stylesheet"][href]')) {
        const path = resolveLocal(link.getAttribute('href'), owner, metadata.siteRoot);
        const entry = entries.find(item => item.path.toLowerCase() === path.toLowerCase());
        if (entry) sheets.push(entryText(entry));
    }
    const covers = new Map();
    for (const sheet of sheets) for (const match of sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const declaration = [...match[2].matchAll(/(?:^|;)\s*(background(?:-image)?)\s*:\s*([^;]*url\([^;]*)/gi)].at(-1);
        if (!declaration) continue;
        for (const selector of match[1].trim().split(',')) {
            try { for (const node of [region, ...region.querySelectorAll('*')]) if (node.matches(selector.trim()) && !node.closest(protectedField)) covers.set(node, { property: declaration[1], value: declaration[2].replace(/\s*!important\s*$/i, '') }); }
            catch { /* Pseudo-elements and unsupported selectors are not guessed. */ }
        }
    }
    return covers;
}

/** Shared media binding for featured and detail cover regions. Accept either
 * a wrapper or the image itself; retain gradients, icons and advertisements. */
export function fillTemplateCoverMedia(region, item, owner, assets, entries, metadata) {
    const image = item.image ? assets.image(item.image, item.ownerPath, owner) : '';
    for (const node of [...(region.matches('img') ? [region] : []), ...region.querySelectorAll('img')]) {
        if (node.closest(protectedField)) continue;
        for (const attr of ['srcset', 'data-srcset', 'data-src', 'data-original']) node.removeAttribute(attr);
        node.setAttribute('alt', item.title);
        if (image) { node.setAttribute('src', image); node.removeAttribute('hidden'); }
        else { node.removeAttribute('src'); node.hidden = true; }
        for (const source of node.closest('picture')?.querySelectorAll('source') || []) {
            source.removeAttribute('srcset'); source.removeAttribute('data-srcset');
            // A source without srcset lets the fallback img select the cover.
        }
    }
    const covers = stylesheetCovers(region.ownerDocument, entries, owner, metadata, region);
    for (const node of [region, ...region.querySelectorAll('[style]')]) {
        for (const property of ['background', 'background-image']) {
            const value = node.style?.getPropertyValue(property) || '';
            if (!node.closest(protectedField) && /url\(/i.test(value)) covers.set(node, { property, value });
        }
    }
    for (const [node, { property, value }] of covers) node.style.setProperty(property, value.replace(/url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)/gi, image ? 'url(' + JSON.stringify(image) + ')' : 'none'), 'important');
}

// Keep existing featured callers compatible; detail pages share the same
// image/srcset/background behavior instead of growing a second media adapter.
export const fillFeaturedMedia = fillTemplateCoverMedia;
