/** Rewrite CSS resource references through the owning preview's archive resolver.
 * Keep media/layer/supports clauses intact; unresolved or external references
 * remain subject to the preview's existing security policy.
 */
export function rewritePreviewCss(source, fromPath, resolveUrl) {
    return String(source || '').replace(/url\(\s*(?:(['"])(.*?)\1|([^)'"\s]+))\s*\)/gi, (match, quote, quoted, unquoted) => {
        const reference = quote ? quoted : unquoted;
        const url = resolveUrl(reference, fromPath);
        return url ? 'url("' + url + '")' : match;
    }).replace(/(@import\s+)(['"])([^'"]+)\2/gi, (match, prefix, quote, reference) => {
        const url = resolveUrl(reference, fromPath);
        return url ? prefix + '"' + url + '"' : match;
    });
}
