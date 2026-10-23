/** Locate one article cover without depending on archive or renderer services.
 * Covers may be siblings of <article>, while inline prose images, related
 * thumbnails, logos and ads belong to different regions and stay protected. */
const excluded = 'nav,footer,aside,button,[role="navigation"],.icon,[data-icon],[aria-hidden="true"],[id^="adv"],[id^="div-gpt-ad"],[data-sitefoundry-ad],[data-ad-slot],.ad-slot';
const excludedClass = /(?:^|[-_\s])(?:related|recommend(?:ed|ations)?|breadcrumb|byline|source|author|share|category|logo|avatar|icon)(?:[-_\s]|$)/i;
const coverClass = /(?:^|[-_\s])(?:hero|cover|featured|banner)(?:[-_\s]|$)/i;

function safe(node) {
    if (node.closest(excluded)) return false;
    for (let parent = node; parent; parent = parent.parentElement) if (excludedClass.test(parent.getAttribute('class') || '')) return false;
    return true;
}

function mediaRoot(node) {
    // A responsive source can override img.src. Treat the whole picture as
    // the cover so both its sources and the fallback image get updated.
    return node.matches('img') ? node.closest('picture') || node : node;
}

export function findDetailCover(doc, { title, body, scope, nodes = [] }) {
    const explicit = [...doc.querySelectorAll('[data-content-image],.detail-hero-image,.article-hero img')].find(safe);
    if (explicit) return mediaRoot(explicit);
    const beforeProse = node => !body?.contains(node) || body.contains(title) && !nodes.some(block => block.contains(node));
    // A class is evidence of a cover role, not a license to select an entire
    // article wrapper and overwrite every image inside that wrapper.
    const marked = [...doc.querySelectorAll('img,picture,figure,div,section')].filter(node => safe(node)
        && coverClass.test(node.getAttribute('class') || '') && beforeProse(node)
        && !node.contains(title) && !node.querySelector('h1,article,[role="article"]')
        && (!body || !node.contains(body)));
    if (marked.length) return mediaRoot(marked[0]);
    // Support unclassified images immediately before the article or heading.
    // Work outward through real siblings instead of taking document's first
    // image, which is often a brand logo or an advertisement.
    for (let anchor = title; anchor && !anchor.matches('body,html'); anchor = anchor.parentElement) {
        const sibling = anchor.previousElementSibling;
        if (!sibling || !safe(sibling) || sibling.contains(title)) continue;
        const images = (sibling.matches('img,picture') ? [sibling] : [...sibling.querySelectorAll('img,picture')])
            .filter(node => safe(node) && beforeProse(node));
        const roots = [...new Set(images.map(mediaRoot))];
        if (roots.length === 1) return roots[0];
    }
    // Keep the previously supported loose-article cover after its prose.
    // Dedicated body containers and images inside paragraphs/figures are not
    // fallback cover candidates, so illustration-only articles stay untouched.
    const loose = scope && [...scope.querySelectorAll('img')].find(node => safe(node)
        && beforeProse(node) && !node.closest('p,figure'));
    return loose ? mediaRoot(loose) : null;
}
