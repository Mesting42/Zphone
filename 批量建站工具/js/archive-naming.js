/*
 * Shared ZIP filename helpers for browser exports.
 * A recognized advertising host names both the ZIP and its top-level site
 * directory; otherwise callers can provide the existing workflow-specific
 * filename and the site keeps its default `website` directory.
 */
(function(root) {
    'use strict';

    const HOST_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

    function normalizeHost(value) {
        const host = String(value || '').trim().toLowerCase().replace(/\.$/, '');
        return HOST_PATTERN.test(host) ? host : '';
    }

    function fallbackZipFileName(value) {
        const leaf = String(value || 'website.zip').replace(/\\/g, '/').split('/').pop();
        const stem = leaf.replace(/\.zip$/i, '').trim()
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/[. ]+$/g, '');
        return (stem || 'website') + '.zip';
    }

    // Keep the archive name and its top-level site directory tied to the same
    // validated host so exports remain easy to identify after extraction.
    function siteZipDescriptor(host, fallbackName) {
        const normalizedHost = normalizeHost(host);
        return {
            fileName: normalizedHost ? normalizedHost + '.zip' : fallbackZipFileName(fallbackName),
            siteFolderName: normalizedHost || 'website'
        };
    }

    function zipFileName(host, fallbackName) {
        return siteZipDescriptor(host, fallbackName).fileName;
    }

    function uniqueZipFileName(host, fallbackName, usedNames) {
        const used = usedNames || Object.create(null);
        const firstName = zipFileName(host, fallbackName);
        const stem = firstName.replace(/\.zip$/i, '');
        let candidate = firstName;
        let suffix = 2;
        while (used[candidate.toLowerCase()]) candidate = stem + '-' + suffix++ + '.zip';
        used[candidate.toLowerCase()] = true;
        return candidate;
    }

    root.ArchiveNaming = Object.freeze({
        normalizeHost: normalizeHost,
        siteZipDescriptor: siteZipDescriptor,
        zipFileName: zipFileName,
        uniqueZipFileName: uniqueZipFileName
    });
})(typeof window !== 'undefined' ? window : globalThis);
