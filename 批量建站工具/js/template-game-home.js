/** Homepage-only game allocation. The featured game owns the first record;
 * ordinary homepage slots receive the rest in source order. Other listing
 * pages and detail routes always retain the complete catalog. */
import { entryText, textEntry, resolveLocal, relativePath } from './template-reuse-content.js';
import { retainCategoryAllocation } from './template-reuse-layout.js';
import { templateFeaturedRegions } from './template-featured-content.js';
const rendererMarker = '/* sitefoundry-game-home-renderer */';

export function isFeaturedGameHomepage(path, metadata, routes, featured) {
    return path === metadata.homePath && featured.length > 0 && routes.length > 0 && routes.every(route => !!route.item.game);
}

/** Known JSON renderers share their data and script with the all-games page.
 * Give only the homepage private copies instead of removing a record from
 * shared JSON or filtering DOM cards after category/ad placement has run. */
export function installGameHomepageRenderer(entries, renderer, metadata, routes) {
    if (!renderer || !routes.every(route => !!route.item.game)) return entries;
    const home = entries.find(entry => entry.path === metadata.homePath);
    if (!home) return entries;
    const doc = new DOMParser().parseFromString(entryText(home), 'text/html');
    // Static featured nodes have already been rebound to the first route.
    const featured = templateFeaturedRegions(doc, metadata.homePath, { ...metadata, detailPaths: routes.map(route => route.path) }, []);
    if (!isFeaturedGameHomepage(home.path, metadata, routes, featured)) return entries;
    const scripts = [...doc.querySelectorAll('script[src]')].filter(node => {
        const path = resolveLocal(node.getAttribute('src'), home.path, metadata.siteRoot);
        if (path === renderer.path) return true;
        // An exported site can itself be uploaded as the next template. Its
        // prior homepage copy must be rebound rather than left on old data.
        const previous = entries.find(entry => entry.path === path);
        return previous && entryText(previous).startsWith(rendererMarker);
    });
    if (!scripts.length) return entries;
    const data = entries.find(entry => entry.path === renderer.dataPath);
    if (!data) return entries;
    const dataLiteral = renderer.source.match(/\bdataFile\s*:\s*(['"])([^'"]+)\1/)?.[0];
    if (!dataLiteral) return entries;
    const used = new Set(entries.map(entry => entry.path.toLowerCase()));
    function unused(path) {
        const extension = path.match(/\.[^/.]+$/)?.[0] || '';
        const base = extension ? path.slice(0, -extension.length) : path;
        let serial = 0, candidate;
        do { candidate = base + '-sitefoundry-home' + (serial++ ? '-' + serial : '') + extension; } while (used.has(candidate.toLowerCase()));
        used.add(candidate.toLowerCase()); return candidate;
    }
    const scriptPath = unused(renderer.path), dataPath = unused(renderer.dataPath);
    const homeRows = JSON.parse(entryText(data)).slice(1);
    const categories = retainCategoryAllocation(renderer.categories, homeRows.length);
    const source = renderer.source.replace(renderer.categoriesLiteral, JSON.stringify(categories))
        .replace(dataLiteral, 'dataFile:' + JSON.stringify(relativePath(home.path, dataPath)));
    scripts.forEach(node => node.setAttribute('src', relativePath(home.path, scriptPath)));
    return entries.map(entry => entry === home ? textEntry(home.path, '<!doctype html>\n' + doc.documentElement.outerHTML) : entry)
        .concat(textEntry(scriptPath, rendererMarker + '\n' + source), textEntry(dataPath, JSON.stringify(homeRows, null, 2)));
}
