/** Preserve the uploaded layout as the authority. Content adapters may change
 * fields and append overflow, never rename or rebuild a category heading. */
import { cardSelector, resolveLocal } from './template-reuse-content.js';

/** Recognize only literal navigation handlers; never evaluate uploaded JS.
 * Hero tiles commonly use this instead of an anchor around their content. */
export function templateCardHref(card) {
    const link = card.matches('a[href]') ? card : card.querySelector('a[href]');
    if (link) return link.getAttribute('href') || '';
    return String(card.getAttribute('onclick') || '').match(/^\s*(?:window\.)?location(?:\.href)?\s*=\s*(['"])([^'"]+)\1\s*;?\s*$/)?.[2] || '';
}

export function setTemplateCardHref(card, href) {
    const old = templateCardHref(card);
    if (card.matches('a[href]')) card.setAttribute('href', href);
    card.querySelectorAll('a[href]').forEach(link => { if (link.getAttribute('href') === old) link.setAttribute('href', href); });
    if (!card.matches('a[href]') && !card.querySelector('a[href]') && old) card.setAttribute('onclick', 'window.location.href=' + JSON.stringify(href));
}

/** Keep every original section capacity. Extra records belong at the tail,
 * so an ad after the first section still follows the same number of cards. */
export function retainCategoryAllocation(categories, itemCount) {
    if (!categories.length || categories.some(category => !Number.isInteger(category.count) || category.count < 0)) {
        throw new Error('无法可靠识别模板分类的卡片数量，不能在保持布局的前提下复用。');
    }
    const output = categories.map(category => ({ ...category }));
    const capacity = output.reduce((sum, category) => sum + category.count, 0);
    if (itemCount > capacity) output[output.length - 1].count += itemCount - capacity;
    return output;
}

/** Recognize static cards by real detail links as well as known class names.
 * Category headers, icon sprites and navigation are never cloned as cards. */
export function templateListingCards(doc, owner, metadata) {
    const known = [...doc.querySelectorAll(cardSelector)].filter(node => !node.parentElement?.closest(cardSelector));
    const paths = new Set((metadata.detailPaths || []).map(path => path.toLowerCase()));
    const routeOf = link => {
        let href = templateCardHref(link);
        if (/^https?:\/\//i.test(href)) {
            try { const url = new URL(href); if (url.hostname !== metadata.detectedHost) return ''; href = url.pathname; } catch { return ''; }
        }
        return resolveLocal(href, owner, metadata.siteRoot).toLowerCase();
    };
    const links = [...doc.querySelectorAll('a[href],[onclick]')].filter(link => !link.closest('nav,header,footer') && paths.has(routeOf(link)));
    for (const link of links) {
        if (known.some(card => card === link || card.contains(link))) continue;
        let card = link;
        // An image-only link can sit next to its title inside an article/li.
        // Stop as soon as a single-item content container is identified.
        while (!card.querySelector('h1,h2,h3,h4,[data-content-title],[class*="title"],[class*="name"]')) {
            const parent = card.parentElement;
            if (!parent || /^(MAIN|BODY|SECTION)$/.test(parent.tagName)
                || new Set(links.filter(item => parent.contains(item)).map(routeOf)).size !== 1) { card = null; break; }
            card = parent;
        }
        let wrapper = card;
        while (wrapper && !/^(MAIN|BODY|SECTION)$/.test(wrapper.tagName)) {
            if (new Set(links.filter(item => wrapper.contains(item)).map(routeOf)).size !== 1) break;
            if (wrapper.matches('article,li,[data-content-card]')
                || /(?:^|[-_\s])(?:card|tile|entry|teaser|item|post)(?:[-_\s]|$)/i.test(wrapper.getAttribute('class') || '')) { card = wrapper; break; }
            wrapper = wrapper.parentElement;
        }
        if (card && !known.some(node => node === card || node.contains(card))) known.push(card);
    }
    // A document walk gives the same slot order in the browser and archive DOM
    // parsers, including cards nested at different depths in separate sections.
    const order = new Map([...doc.querySelectorAll('*')].map((node, index) => [node, index]));
    return known.sort((a, b) => order.get(a) - order.get(b));
}

/** Replace only content text, retaining icon elements, inline wrappers and
 * decorative prefixes. Never flatten SVG, image or aria-hidden icon markup. */
export function setTemplateText(node, value) {
    if (!node) return;
    const leaves = [];
    function visit(parent) {
        for (const child of parent.childNodes) {
            if (child.nodeType === 3 && /[\p{L}\p{N}]/u.test(child.textContent)) leaves.push(child);
            else if (child.nodeType === 1 && !child.matches('svg,img,i,script,style,[aria-hidden="true"],.icon,.badge,[data-icon]')) visit(child);
        }
    }
    visit(node);
    if (!leaves.length) { node.appendChild(node.ownerDocument.createTextNode(String(value || ''))); return; }
    const prefix = leaves[0].textContent.match(/^[^\p{L}\p{N}]*/u)?.[0] || '';
    leaves[0].textContent = prefix + String(value || '');
    leaves.slice(1).forEach(leaf => { leaf.textContent = ''; });
}
