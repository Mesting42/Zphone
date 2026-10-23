/** Locate editable article regions without turning the surrounding template
 * into content. The same plan drives inspection, extraction and replacement. */
import { findDetailCover } from './template-cover-regions.js';
export const titleSelector = '[data-content-title],.detail-title,.article-title,.post-title,h1';
export const bodySelector = '[data-content-body],.detail-content,.article-content,.post-content,.article-body,.entry-content,[itemprop="articleBody"]';
const adSelector = '[id^="adv"],[id^="div-gpt-ad-banner"],[data-sitefoundry-ad]';
const chromeSelector = 'nav,header,footer,aside,button,[role="navigation"],time';
const chromeClass = /(?:^|[-_\s])(?:related|recommend(?:ed|ations)?|breadcrumb|byline|source|author|share|category)(?:[-_\s]|$)/i;
function hasChromeClass(node, pattern = chromeClass) {
    for (let parent = node; parent; parent = parent.parentElement) if (pattern.test(parent.getAttribute('class') || '')) return true;
    return false;
}
const first = (root, selectors) => selectors.split(',').map(selector => root.querySelector(selector)).find(Boolean);

export function findDetailRegions(doc) {
    const title = first(doc, titleSelector);
    if (!title) return null;
    const candidates = bodySelector.split(',').flatMap(selector => [...doc.querySelectorAll(selector)]);
    // A known class can label the entire article, including its heading and
    // ads. Prefer a dedicated body; otherwise resolve its loose prose safely.
    const explicit = candidates.find(node => !node.contains(title));
    let scope = title.closest('article,[role="article"]') || candidates.find(node => node.contains(title));
    if (!scope) {
        const main = title.closest('main,[role="main"]');
        // A card index or multi-article landing page is not a detail body.
        if (main && main.querySelectorAll('h1').length === 1 && !main.querySelector('article,[role="article"]')) scope = main;
    }
    if (!explicit && (!scope || scope.querySelectorAll('h1').length !== 1 || scope.querySelector('article,[role="article"]'))) return null;
    const nodes = explicit ? [] : [...scope.querySelectorAll('p,h2,h3,h4,h5,h6,ul,ol,blockquote,pre,table,dl')].filter(node => {
        if (node === title || node.contains(title) || node.closest(adSelector + ',' + chromeSelector) || hasChromeClass(node) || node.querySelector(adSelector)) return false;
        return !node.parentElement?.closest('p,ul,ol,blockquote,pre,table,dl') && node.textContent.trim();
    });
    if (!explicit && !nodes.length) return null;
    const cover = findDetailCover(doc, { title, body: explicit || scope, scope, nodes });
    const image = cover?.matches('img') ? cover : cover?.querySelector('img');
    const actions = scope ? [...scope.querySelectorAll('a[href]')].filter(link =>
        !link.closest(adSelector + ',nav') && !hasChromeClass(link, /(?:^|[-_\s])related(?:[-_\s]|$)/i)
        && /^(?:read|view|visit|open|learn|play)\b.*\b(?:source|original|more|game)\b/i.test(link.textContent.trim())) : [];
    return { title, body: explicit || scope, nodes, cover, image, actions, mode: explicit ? 'container' : 'blocks' };
}

/** Extract only prose. Ad containers and template chrome never become new
 * article text when an uploaded static site is used as the content source. */
export function detailBodyHtml(region) {
    if (region.mode === 'blocks') return region.nodes.map(node => node.outerHTML).join('\n');
    const copy = region.body.cloneNode(true);
    copy.querySelectorAll(adSelector).forEach(node => node.remove());
    return copy.innerHTML;
}

/** Preserve original ad siblings and wrapper hierarchy. For loose article
 * blocks, each existing block remains an insertion anchor; overflow stays at
 * the last prose anchor, before the template's trailing image/ad/footer. */
export function replaceDetailBody(region, html) {
    if (region.mode === 'container') {
        const retained = [...region.body.querySelectorAll(adSelector)].filter(node => !node.parentElement?.closest(adSelector))
            .map(node => ({ node: node.cloneNode(true), index: [...region.body.children].indexOf(node) }));
        if (region.cover && region.cover !== region.body && region.body.contains(region.cover)) {
            // An explicitly marked cover may live inside a dedicated body.
            // Retain that media region before replacing prose, so its actual
            // node still receives the same source cover as an external image.
            let wrapper = region.cover;
            while (wrapper.parentElement !== region.body && wrapper.parentElement
                && !wrapper.parentElement.querySelector('p,h1,h2,h3,ul,ol,blockquote,pre,table')
                && !wrapper.parentElement.querySelector(adSelector)) wrapper = wrapper.parentElement;
            let anchor = wrapper;
            while (anchor.parentElement && anchor.parentElement !== region.body) anchor = anchor.parentElement;
            retained.push({ node: wrapper, index: [...region.body.children].indexOf(anchor) });
        }
        region.body.innerHTML = html;
        retained.sort((a, b) => a.index - b.index).forEach(({ node, index }) => region.body.insertBefore(node, region.body.children[Math.max(0, index)] || null));
        return region.body.firstChild;
    }
    const fragment = new DOMParser().parseFromString('<html><body>' + html + '</body></html>', 'text/html');
    const blocks = [...fragment.body.childNodes];
    let cursor = 0, firstContent = null;
    region.nodes.forEach((anchor, index) => {
        const count = index === region.nodes.length - 1 ? blocks.length - cursor : Math.min(1, blocks.length - cursor);
        for (let n = 0; n < count; n++) {
            let node = blocks[cursor++].cloneNode(true);
            // Paragraph typography is part of the template. Keep its classes
            // on paragraph replacements without nesting block HTML inside <p>.
            if (anchor.tagName === 'P' && node.nodeType === 1 && node.tagName === 'P') {
                const paragraph = anchor.cloneNode(false); paragraph.removeAttribute('id'); paragraph.innerHTML = node.innerHTML; node = paragraph;
            }
            anchor.parentNode.insertBefore(node, anchor);
            if (!firstContent) firstContent = node;
        }
        anchor.remove();
    });
    return firstContent;
}
