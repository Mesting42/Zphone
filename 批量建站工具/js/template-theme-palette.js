/** Template-independent color adaptation. Only selected palettes install this
 * runtime; the original-color path returns the original entries byte for byte.
 * Computed colors let arbitrary selectors, inline styles and dynamic cards use
 * one policy without rewriting their layout, typography or uploaded CSS. */
export function applyThemePalette(entries, palette, options = {}) {
    if (!palette) return { entries, applied: false, warnings: [] };
    const vars = Object.fromEntries(Object.entries(palette.vars || palette).filter(([key, value]) =>
        /^--(?:color-[\w-]+|navbar-bg)$/.test(key) && !/[;{}<>]/.test(String(value))));
    if (!Object.keys(vars).length) throw new Error('主题配色没有有效的颜色变量。');
    const id = String(options.id || palette.id || 'palette').replace(/[^\w-]/g, '');
    const paths = options.paths && new Set(options.paths);
    return { applied: true, warnings: [], entries: entries.map(entry => {
        // Embedded games and other bundled documents own their own colors.
        if (!/\.html?$/i.test(entry.path) || paths && !paths.has(entry.path)) return entry;
        const text = typeof entry.text === 'string' ? entry.text : new TextDecoder().decode(entry.bytes || []);
        const doc = new DOMParser().parseFromString(text, 'text/html');
        doc.querySelectorAll('[data-sitefoundry-template-theme],[data-sitefoundry-template-theme-runtime]').forEach(node => node.remove());
        const style = doc.createElement('style');
        style.setAttribute('data-sitefoundry-template-theme', id);
        // Namespaced values never overwrite an uploaded CSS variable that may
        // serve several roles. Resolve actual foreground/background pairs below.
        style.textContent = ':root{' + Object.entries(vars).map(([key, value]) => '--sf-theme-' + key.slice(2) + ':' + value).join(';') + '}';
        doc.head.appendChild(style);
        const script = doc.createElement('script');script.setAttribute('data-sitefoundry-template-theme-runtime', id);
        script.textContent = '(' + installTemplatePalette.toString() + ')(' + JSON.stringify(vars).replace(/</g, '\\u003c') + ');';
        doc.head.appendChild(script);
        const bytes = new TextEncoder().encode('<!doctype html>\n' + doc.documentElement.outerHTML);
        // Drop stale text too: all consumers must see the same themed document.
        return { ...entry, text: undefined, bytes };
    }) };
}

/** Self-contained export/preview runtime. No workbench globals, network calls,
 * storage, HTML content changes or layout properties are involved. Keep this
 * function dependency-free because its source is embedded in each site page. */
function installTemplatePalette(vars) {
    function start() {
        if (window.__sitefoundryPalette) window.__sitefoundryPalette.disconnect();
        var records = new WeakMap(), skipped = 'script,style,link,meta,template,svg,svg *,canvas,iframe,video,img,picture,source,[data-icon],.icon,[aria-hidden="true"],[id^="adv"],[id^="div-gpt-ad"],[data-sitefoundry-ad],[data-sitefoundry-preview-ad],[data-sitefoundry-runtime-ad],.sf-policy-place';
        var probe = document.createElement('span');probe.hidden = true;document.body.appendChild(probe);
        function rgba(value) {
            var numbers = String(value).match(/[\d.]+/g);
            return numbers && numbers.length >= 3 ? [Number(numbers[0]), Number(numbers[1]), Number(numbers[2]), numbers[3] == null ? 1 : Number(numbers[3])] : [0, 0, 0, 0];
        }
        function color(value, fallback) {
            probe.style.color = '';probe.style.color = value || fallback;
            return rgba(getComputedStyle(probe).color);
        }
        var theme = {
            bg: color(vars['--color-bg'], '#ffffff'), card: color(vars['--color-card-bg'] || vars['--color-bg-secondary'], '#ffffff'),
            text: color(vars['--color-text'], '#212529'), secondary: color(vars['--color-text-secondary'] || vars['--color-text'], '#555555'),
            primary: color(vars['--color-primary'], '#333333'), border: color(vars['--color-border'], '#cccccc'),
            nav: color(vars['--navbar-bg'] || vars['--color-bg'], '#ffffff')
        };
        probe.remove();
        function css(c) { return 'rgba(' + c.join(',') + ')'; }
        function blend(front, back) { var a = front[3];return [0, 1, 2].map(function(i) { return front[i] * a + back[i] * (1 - a); }).concat(1); }
        function luminance(c) { return c.slice(0, 3).map(function(v) { v /= 255;return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce(function(sum, v, i) { return sum + v * [0.2126, 0.7152, 0.0722][i]; }, 0); }
        function ratio(a, b) { var x = luminance(a), y = luminance(b);return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
        function readable(wanted, background, opacity) {
            var candidates = [wanted, theme.text, theme.primary, [0, 0, 0, 1], [255, 255, 255, 1]], best = candidates[0], score = 0;
            for (var i = 0; i < candidates.length; i++) {
                var visible = candidates[i].slice();visible[3] *= opacity;
                var contrast = ratio(blend(visible, background), background);
                if (contrast >= 4.5) return candidates[i];
                if (contrast > score) { best = candidates[i];score = contrast; }
            }
            return best;
        }
        function neutral(c) { return Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) < 42; }
        function read(node) {
            if (records.has(node)) return records.get(node);
            var s = getComputedStyle(node), c = rgba(s.color), bg = rgba(s.backgroundColor);
            var record = { color: c, bg: bg, image: s.backgroundImage, opacity: Number(s.opacity),
                border: ['Top', 'Right', 'Bottom', 'Left'].map(function(side) { return { side: side, color: rgba(s['border' + side + 'Color']), style: s['border' + side + 'Style'] }; }),
                surface: /(?:^|[-_\s])(?:card|tile|panel|surface|entry|teaser|item)(?:[-_\s]|$)/i.test(node.getAttribute('class') || '') || node.matches('article,nav,header,footer,input,select,textarea'),
                accent: node.matches('button,[role="button"]') || /(?:^|[-_\s])(?:badge|tag|pill|chip|cta|btn|button)(?:[-_\s]|$)/i.test(node.getAttribute('class') || ''),
                secondary: /(?:^|[-_\s])(?:summary|desc|description|excerpt|meta|muted|caption|date|source)(?:[-_\s]|$)/i.test(node.getAttribute('class') || '') || node.matches('p,small,time'),
                paint: bg, effective: theme.bg, media: false, inheritedOpacity: 1 };
            records.set(node, record);return record;
        }
        function apply() {
            var nodes = [document.body].concat(Array.from(document.body.querySelectorAll('*')).filter(function(node) { return !node.closest(skipped); }));
            // Snapshot before writes. Avoid one style/layout read per mutation,
            // and retain source colors when later cards are inserted dynamically.
            nodes.forEach(read);
            nodes.forEach(function(node) {
                var r = records.get(node), parent = node.parentElement && records.get(node.parentElement);
                r.media = /url\(|gradient\(/i.test(r.image) || !!(parent && parent.media && r.bg[3] < 0.85);
                r.inheritedOpacity = r.opacity * (parent ? parent.inheritedOpacity : 1);
                r.paint = r.bg;
                if (node === document.body) r.paint = theme.bg;
                else if (!r.media && r.bg[3] > 0) {
                    var target = node.matches('nav,.navbar,[role="navigation"]') ? theme.nav
                        : r.accent ? theme.primary : r.surface || neutral(r.bg) ? theme.card : theme.primary;
                    r.paint = target.slice();r.paint[3] *= r.bg[3];
                }
                // Transparent surfaces inherit their real parent; photographic
                // gradients retain their original foreground/background pair.
                var base = parent ? parent.effective : theme.bg;
                r.effective = r.media && /url\(|gradient\(/i.test(r.image) ? [18, 18, 22, 1] : blend(r.paint, base);
                if (r.paint !== r.bg) node.style.setProperty('background-color', css(r.paint), 'important');
                r.border.forEach(function(border) { if (border.style !== 'none' && border.color[3] > 0 && !r.media) node.style.setProperty('border-' + border.side.toLowerCase() + '-color', css(theme.border), 'important'); });
            });
            nodes.forEach(function(node) {
                var r = records.get(node);
                // A photograph cannot be measured from its CSS color. Preserve
                // its source ink instead of guessing whether its pixels are dark.
                if (r.media) { node.style.setProperty('color', css(r.color), 'important');return; }
                // Color also belongs on structural parents so native text and
                // later descendants inherit a safe value. No icon fill is edited.
                var wanted = r.media ? r.color : r.accent && r.bg[3] >= 0.85 ? theme.text
                    : r.secondary ? theme.secondary : !neutral(r.color) && node.matches('a,h1,h2,h3,h4,h5,h6') ? theme.primary : theme.text;
                // Zero-opacity reveal/animation containers are not visible yet;
                // never rewrite their animation or opacity to fake a contrast pass.
                var opacity = r.inheritedOpacity > 0.05 ? r.inheritedOpacity : 1;
                node.style.setProperty('color', css(readable(wanted, r.effective, opacity)), 'important');
            });
        }
        apply();
        var queued = false, observer = new MutationObserver(function(changes) {
            // Ignore our own styles; only newly rendered content or text needs
            // another pass. Uploaded renderers and ad insertion remain independent.
            if (queued || !changes.some(function(change) { return change.type === 'characterData' || Array.from(change.addedNodes).some(function(n) { return n.nodeType === 1 && !n.matches(skipped) && !n.closest(skipped); }); })) return;
            queued = true;requestAnimationFrame(function() { queued = false;apply(); });
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        window.__sitefoundryPalette = { disconnect: function() { observer.disconnect(); } };
        document.documentElement.setAttribute('data-sitefoundry-palette-ready', '');
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
}
