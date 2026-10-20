/** Template reuse alone may retarget a site to a newly supplied ad domain.
 * Detailed policy / quick-update workflows retain their existing strict pairing. */
import { quickUpdatePolicy } from './ad-quick-update.js?v=20261009-quick-ad-2';
import { entryText, textEntry } from './template-reuse-content.js';

export function templateOriginalPolicy(site, engine) {
    try { return quickUpdatePolicy(site, true, engine); }
    catch (error) {
        const runtime = entryText(site.entries.find(entry => entry.path === site.metadata.adPath));
        // One older shipped template expresses the same default through a helper.
        // Recognize that exact helper shape; arbitrary JS gates are not evaluated.
        if (!/\badPolicy\s*=\s*null\s*;/.test(runtime) || !/kind\s*===\s*['"]interstitial['"]\s*\?\s*isIndex\s*:\s*true/.test(runtime)) throw error;
        const policy = engine.createPolicy('restore-original', { pageIsolation: true });
        for (const [page, paths] of Object.entries({ home: [site.metadata.homePath], detail: site.metadata.detailPaths, all: site.metadata.listingPaths || [] })) {
            const documents = paths.map(path => new DOMParser().parseFromString(entryText(site.entries.find(entry => entry.path === path)), 'text/html'));
            policy.slots[page].forEach((slot, index) => { if (documents.length && !documents.some(doc => doc.getElementById('div-gpt-ad-banner' + (index + 1)))) slot.unit = 'off'; });
        }
        return engine.normalizePolicy(policy);
    }
}

export function siteForReplacementCode(site, code) {
    if (!code) return site;
    return { ...site, name: code.detectedHost || site.name, metadata: { ...site.metadata, detectedHost: code.detectedHost || site.metadata.detectedHost } };
}

/** Retarget first-party navigation and SEO URLs, never email/contact/legal prose. */
export function retargetTemplateHost(site, host) {
    const originalHost = site.metadata.detectedHost;
    if (!host || host === originalHost) return site;
    const rewrite = value => {
        if (!/^https?:\/\//i.test(value)) return value;
        try { const url = new URL(value); if (url.hostname.toLowerCase() === originalHost.toLowerCase()) { url.hostname = host; return url.href; } } catch { /* Leave non-URLs unchanged. */ }
        return value;
    };
    const entries = site.entries.map(entry => {
        if (!/\.html?$/i.test(entry.path)) return entry;
        const doc = new DOMParser().parseFromString(entryText(entry), 'text/html');
        let changed = false;
        doc.querySelectorAll('[href],meta[content]').forEach(node => {
            for (const name of ['href', 'content']) {
                const value = node.getAttribute(name); if (!value) continue;
                const next = rewrite(value); if (next !== value) { node.setAttribute(name, next); changed = true; }
            }
        });
        // Public-page body copy remains intact even when its navigation origin changes.
        return changed ? textEntry(entry.path, '<!doctype html>\n' + doc.documentElement.outerHTML) : entry;
    });
    return { ...site, entries, name: host, metadata: { ...site.metadata, detectedHost: host } };
}
