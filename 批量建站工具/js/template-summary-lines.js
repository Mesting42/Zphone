/** Adapt the ordinary builder's cardExcerptLines setting to uploaded markup.
 * Only explicitly bound card summaries participate; prose, ads and headings
 * never become truncation targets. The runtime is shared by preview/export. */
export const summaryAttribute = 'data-sitefoundry-card-summary';
export function normalizeExcerptLines(value) {
    const text = String(value ?? 'auto');
    return text === 'none' || /^(?:[1-9]|10)$/.test(text) ? text : 'auto';
}

/** Capture the template text before replacement, including empty summaries.
 * Keeping the original text lets the browser recover natural wrapping at the
 * current width when the template supplies no explicit CSS clamp. */
export function markTemplateSummary(node) {
    if (node && !node.hasAttribute(summaryAttribute)) node.setAttribute(summaryAttribute, node.textContent || '');
    return node;
}

export function applyTemplateSummaryLines(entries, options = {}) {
    const mode = normalizeExcerptLines(options.cardExcerptLines), paths = new Set(options.paths || []);
    const dynamic = options.dynamic || null;
    return entries.map(entry => {
        if (!paths.has(entry.path)) return entry;
        const text = typeof entry.text === 'string' ? entry.text : new TextDecoder().decode(entry.bytes || []);
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const rows = dynamic && entry.path === dynamic.path ? dynamic.originals : null;
        if (!doc.querySelector('[' + summaryAttribute + ']') && !rows?.length) return entry;
        doc.querySelectorAll('[data-sitefoundry-summary-runtime]').forEach(node => node.remove());
        const script = doc.createElement('script'); script.setAttribute('data-sitefoundry-summary-runtime', mode);
        script.textContent = '(' + installSummaryLines.toString() + ')(' + JSON.stringify({ mode, originals: rows }).replace(/</g, '\\u003c') + ');';
        doc.head.appendChild(script);
        return { ...entry, text: undefined, bytes: new TextEncoder().encode('<!doctype html>\n' + doc.documentElement.outerHTML) };
    });
}

/** Self-contained: exports require no builder globals, libraries or requests.
 * The same display/clamp/space reservation as ordinary cards is used here,
 * taking each template's actual line-height instead of replacing its font. */
function installSummaryLines(config) {
    function start() {
        if (window.__sitefoundrySummaryLines) window.__sitefoundrySummaryLines.disconnect();
        const attribute = 'data-sitefoundry-card-summary';
        const skipped = 'nav,header,footer,[id^="adv"],[id^="div-gpt-ad"],[data-sitefoundry-ad],.ad-slot,[data-sitefoundry-summary-probe]';
        const properties = ['display', 'overflow', 'white-space', 'text-overflow', '-webkit-box-orient', '-webkit-line-clamp', 'line-clamp', 'min-height', 'max-height', 'height'];
        const records = new Map(); let queued = false, active = true;
        // Width-only observation also handles summaries revealed by filtering
        // or a responsive container, without reacting to our own height clamp.
        const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => {
            for (const entry of entries) {
                const record = records.get(entry.target);
                if (record && record.observedWidth !== entry.contentRect.width) { record.observedWidth = entry.contentRect.width; schedule(); }
            }
        }) : null;
        function set(node, property, value) { node.style.setProperty(property, value, 'important'); }
        function restore(node, record) {
            for (const [property, value, priority] of record.originalStyle) {
                if (value) node.style.setProperty(property, value, priority); else node.style.removeProperty(property);
            }
        }
        function naturalLines(node, original, style) {
            const width = node.getBoundingClientRect().width;
            if (!width) return null;
            const probe = node.cloneNode(false); probe.removeAttribute('id'); probe.removeAttribute(attribute);
            probe.setAttribute('data-sitefoundry-summary-probe', ''); probe.setAttribute('aria-hidden', 'true');
            probe.textContent = original;
            // Copy text metrics so nth-child/ID selectors cannot change the
            // measuring clone's type, width or wrapping when it is inserted.
            for (const property of ['font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'word-spacing', 'text-transform', 'text-indent', 'white-space', 'word-break', 'overflow-wrap', 'text-wrap', 'direction', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right', 'border-top-width', 'border-bottom-width', 'border-left-width', 'border-right-width', 'box-sizing']) probe.style.setProperty(property, style.getPropertyValue(property), 'important');
            for (const [property, value] of Object.entries({ position: 'fixed', left: '-100000px', top: '0', width: width + 'px', 'box-sizing': 'border-box', 'max-width': 'none', 'min-width': '0', 'min-height': '0', height: 'auto', 'max-height': 'none', margin: '0', display: 'block', visibility: 'hidden', '-webkit-line-clamp': 'unset', 'line-clamp': 'unset', transform: 'none', 'pointer-events': 'none', transition: 'none', animation: 'none' })) set(probe, property, value);
            node.parentElement.appendChild(probe);
            const range = document.createRange(); range.selectNodeContents(probe);
            const tops = [];
            for (const rect of range.getClientRects()) if (rect.width > 0 && rect.height > 0 && !tops.some(top => Math.abs(top - rect.top) < 1)) tops.push(rect.top);
            const fontSize = parseFloat(style.fontSize) || 16;
            const lineHeight = parseFloat(style.lineHeight) || (tops.length > 1 ? Math.abs(tops[1] - tops[0]) : probe.getBoundingClientRect().height - parseFloat(style.paddingTop || 0) - parseFloat(style.paddingBottom || 0)) || fontSize * 1.2;
            probe.remove();
            const clamp = parseInt(style.webkitLineClamp || style.getPropertyValue('line-clamp'), 10);
            const maxHeight = parseFloat(style.maxHeight);
            const minHeight = parseFloat(style.minHeight);
            const extraHeight = style.boxSizing === 'border-box' ? ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((sum, key) => sum + (parseFloat(style[key]) || 0), 0) : 0;
            let lines = Math.max(1, tops.length);
            if (Number.isFinite(minHeight) && minHeight > 0) lines = Math.max(lines, Math.round((minHeight - extraHeight) / lineHeight));
            if (clamp > 0) lines = Math.min(lines, clamp);
            if (Number.isFinite(maxHeight) && maxHeight > 0) lines = Math.min(lines, Math.max(1, Math.floor((maxHeight - extraHeight + 0.5) / lineHeight)));
            return { lines, lineHeight, extraHeight };
        }
        function discover() {
            if (config.originals?.length) {
                // Known local JSON renderers insert cards after fetch. Match
                // the original row by its rendered detail ID, not DOM timing.
                for (const card of document.querySelectorAll('.item-card')) {
                    const href = card.getAttribute('href') || '';
                    const id = href.match(/article([^/]+)\.html?(?:[?#]|$)/i)?.[1];
                    const original = config.originals.find(row => row.id === id) || config.originals[0];
                    for (const node of card.querySelectorAll('[data-content-summary],.card-desc,.excerpt,.summary')) if (!node.hasAttribute(attribute)) node.setAttribute(attribute, original.text);
                }
            }
            for (const node of document.querySelectorAll('[' + attribute + ']')) {
                if (node.closest(skipped) || records.has(node)) continue;
                records.set(node, { originalStyle: properties.map(property => [property, node.style.getPropertyValue(property), node.style.getPropertyPriority(property)]), original: node.getAttribute(attribute) });
                if (resize) resize.observe(node);
            }
        }
        function apply() {
            if (!active) return;
            queued = false; discover();
            for (const [node, record] of records) {
                if (!node.isConnected) { records.delete(node); if (resize) resize.unobserve(node); continue; }
                restore(node, record);
                const style = getComputedStyle(node);
                if (style.display === 'none' || !node.getBoundingClientRect().width) continue;
                if (config.mode === 'none') {
                    set(node, 'display', 'block'); set(node, '-webkit-line-clamp', 'unset'); set(node, 'line-clamp', 'unset');
                    set(node, 'overflow', 'visible'); set(node, 'white-space', 'normal'); set(node, 'min-height', '0'); set(node, 'max-height', 'none'); set(node, 'height', 'auto');
                    node.setAttribute('data-sitefoundry-summary-lines', 'none'); continue;
                }
                const measured = naturalLines(node, record.original, style); if (!measured) continue;
                const lines = config.mode === 'auto' ? measured.lines : Number(config.mode);
                const height = measured.lineHeight * lines + measured.extraHeight;
                set(node, 'display', '-webkit-box'); set(node, '-webkit-box-orient', 'vertical'); set(node, '-webkit-line-clamp', String(lines)); set(node, 'line-clamp', String(lines));
                set(node, 'white-space', 'normal'); set(node, 'overflow', 'hidden'); set(node, 'text-overflow', 'ellipsis');
                // Ordinary cards reserve the selected number of lines. In auto
                // mode retain the template's original minimum-height instead.
                if (config.mode !== 'auto') set(node, 'min-height', height + 'px');
                set(node, 'height', 'auto'); set(node, 'max-height', height + 'px');
                node.setAttribute('data-sitefoundry-summary-lines', String(lines));
            }
            document.documentElement.setAttribute('data-sitefoundry-summaries-ready', config.mode);
        }
        function schedule() { if (active && !queued) { queued = true; requestAnimationFrame(apply); } }
        const observer = new MutationObserver(changes => {
            if (changes.some(change => change.type === 'characterData' || [...change.addedNodes].some(node => node.nodeType === 1 && !node.hasAttribute('data-sitefoundry-summary-probe') && !node.closest(skipped)))) schedule();
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        addEventListener('resize', schedule); addEventListener('pageshow', schedule);
        if (document.fonts) { document.fonts.ready.then(schedule); document.fonts.addEventListener('loadingdone', schedule); }
        window.__sitefoundrySummaryLines = { disconnect() {
            active = false; observer.disconnect(); if (resize) resize.disconnect();
            removeEventListener('resize', schedule); removeEventListener('pageshow', schedule);
            if (document.fonts) document.fonts.removeEventListener('loadingdone', schedule);
        } };
        apply();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
}
