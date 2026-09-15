(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.DifferentiatedBuilder = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    var SCHEMA_VERSION = 1;
    var BUILD_VERSION = '20260914-template-library-13';
    var SITE_TYPES = ['editorial', 'tools', 'games'];
    var MIN_EDITORIAL_ITEMS = 40;
    var MAX_EDITORIAL_ITEMS = 50;
    var MIN_EDITORIAL_WORDS = 600;
    var MIN_TOOL_ITEMS = 25;
    var GOOGLE_OPT_OUT_URL = 'https://myadcenter.google.com/personalizationoff';
    var GOOGLE_PARTNER_URL = 'https://policies.google.com/technologies/partner-sites';
    var PLACEHOLDER_HOSTS = ['example.com', 'your-domain.com', 'localhost', '127.0.0.1'];

    var DESIGN_FAMILIES = {
        editorial: [
            { id: 'magazine-front', name: 'Magazine Front', layout: 'lead-grid', tone: 'ink-coral', direction: 'editorial-command' },
            { id: 'quiet-monograph', name: 'Quiet Monograph', layout: 'rail-index', tone: 'paper-olive', direction: 'quiet-reading' },
            { id: 'field-notebook', name: 'Field Notebook', layout: 'banded-list', tone: 'canvas-forest', direction: 'field-notes' },
            { id: 'museum-catalog', name: 'Museum Catalog', layout: 'catalog-grid', tone: 'stone-wine', direction: 'collection-system' },
            { id: 'technical-dossier', name: 'Technical Dossier', layout: 'split-feature', tone: 'slate-cyan', direction: 'technical-record' },
            { id: 'visual-journal', name: 'Visual Journal', layout: 'mosaic', tone: 'cream-cobalt', direction: 'visual-flow' },
            { id: 'swiss-index', name: 'Swiss Index', layout: 'swiss-index', tone: 'paper-blue', direction: 'swiss-grid' },
            { id: 'daily-broadsheet', name: 'Daily Broadsheet', layout: 'broadsheet', tone: 'stone-wine', direction: 'newsroom' },
            { id: 'archive-timeline', name: 'Archive Timeline', layout: 'timeline-ledger', tone: 'paper-olive', direction: 'chronological-archive' },
            { id: 'cinematic-report', name: 'Cinematic Report', layout: 'cinematic-strip', tone: 'ink-coral', direction: 'cinematic-story' },
            { id: 'soft-showcase', name: 'Soft Showcase', layout: 'soft-showcase', tone: 'cream-cobalt', direction: 'soft-structural' },
            { id: 'industrial-board', name: 'Industrial Catalog', layout: 'industrial-board', tone: 'paper-blue', direction: 'industrial-catalog' }
        ],
        tools: [
            { id: 'utility-workspace', name: 'Utility Workspace', layout: 'split-feature', tone: 'paper-blue', direction: 'technical-record' },
            { id: 'lab-manual', name: 'Lab Manual', layout: 'banded-list', tone: 'canvas-orange', direction: 'field-notes' },
            { id: 'system-console', name: 'System Console', layout: 'rail-index', tone: 'slate-cyan', direction: 'quiet-reading' },
            { id: 'reference-index', name: 'Reference Index', layout: 'catalog-grid', tone: 'paper-olive', direction: 'collection-system' },
            { id: 'scientific-instrument', name: 'Scientific Instrument', layout: 'lead-grid', tone: 'ink-lime', direction: 'editorial-command' },
            { id: 'civic-service', name: 'Civic Service', layout: 'mosaic', tone: 'cream-cobalt', direction: 'visual-flow' },
            { id: 'standards-grid', name: 'Standards Grid', layout: 'swiss-index', tone: 'paper-blue', direction: 'swiss-grid' },
            { id: 'release-bulletin', name: 'Release Bulletin', layout: 'broadsheet', tone: 'canvas-orange', direction: 'newsroom' },
            { id: 'procedure-ledger', name: 'Procedure Ledger', layout: 'timeline-ledger', tone: 'paper-olive', direction: 'chronological-archive' },
            { id: 'guided-demo', name: 'Guided Demo', layout: 'cinematic-strip', tone: 'ink-lime', direction: 'cinematic-story' },
            { id: 'friendly-suite', name: 'Friendly Suite', layout: 'soft-showcase', tone: 'cream-cobalt', direction: 'soft-structural' },
            { id: 'operations-board', name: 'Operations Catalog', layout: 'industrial-board', tone: 'paper-blue', direction: 'industrial-catalog' }
        ],
        games: [
            { id: 'arcade-terminal', name: 'Arcade Terminal', layout: 'mosaic', tone: 'ink-lime', direction: 'visual-flow' },
            { id: 'console-shelf', name: 'Console Shelf', layout: 'catalog-grid', tone: 'slate-cyan', direction: 'collection-system' },
            { id: 'game-magazine', name: 'Game Magazine', layout: 'lead-grid', tone: 'ink-coral', direction: 'editorial-command' },
            { id: 'mission-control', name: 'Mission Control', layout: 'split-feature', tone: 'paper-blue', direction: 'technical-record' },
            { id: 'cozy-parlor', name: 'Cozy Parlor', layout: 'banded-list', tone: 'canvas-orange', direction: 'field-notes' },
            { id: 'poster-gallery', name: 'Poster Gallery', layout: 'rail-index', tone: 'stone-wine', direction: 'quiet-reading' },
            { id: 'scoreboard-grid', name: 'Scoreboard Grid', layout: 'swiss-index', tone: 'paper-blue', direction: 'swiss-grid' },
            { id: 'launch-edition', name: 'Launch Edition', layout: 'broadsheet', tone: 'ink-coral', direction: 'newsroom' },
            { id: 'campaign-log', name: 'Campaign Log', layout: 'timeline-ledger', tone: 'paper-olive', direction: 'chronological-archive' },
            { id: 'trailer-reel', name: 'Trailer Reel', layout: 'cinematic-strip', tone: 'ink-lime', direction: 'cinematic-story' },
            { id: 'indie-lounge', name: 'Indie Lounge', layout: 'soft-showcase', tone: 'cream-cobalt', direction: 'soft-structural' },
            { id: 'tournament-board', name: 'Tournament Catalog', layout: 'industrial-board', tone: 'paper-blue', direction: 'industrial-catalog' }
        ]
    };

    // The normal builder already recognizes these verticals.  Keeping the same
    // identifiers here makes the differentiated flow use the recognition result
    // instead of treating every upload as a generic editorial site.
    var DOMAIN_PROFILES = {
        tech: { name: 'Technology', label: '科技资讯', keywords: ['technology', 'software', 'hardware', 'ai', 'cybersecurity'] },
        game: { name: 'Gaming', label: '游戏资讯', keywords: ['game', 'gaming', 'developer', 'publisher', 'platform'] },
        food: { name: 'Food & Cooking', label: '美食餐饮', keywords: ['recipe', 'cooking', 'restaurant', 'ingredient', 'food'] },
        anime: { name: 'Anime & Manga', label: '动漫二次元', keywords: ['anime', 'manga', 'episode', 'studio', 'character'] },
        finance: { name: 'Finance & Business', label: '财经商业', keywords: ['finance', 'stock', 'market', 'investment', 'earnings'] },
        health: { name: 'Health & Wellness', label: '健康医疗', keywords: ['health', 'medical', 'wellness', 'clinical', 'fitness'] },
        travel: { name: 'Travel', label: '旅游出行', keywords: ['travel', 'hotel', 'destination', 'itinerary', 'tourism'] },
        sports: { name: 'Sports', label: '体育赛事', keywords: ['sport', 'match', 'league', 'athlete', 'team'] },
        automotive: { name: 'Automotive', label: '汽车出行', keywords: ['car', 'automotive', 'vehicle', 'engine', 'driving'] },
        education: { name: 'Education', label: '教育学习', keywords: ['education', 'course', 'student', 'learning', 'school'] },
        fashion: { name: 'Fashion & Beauty', label: '时尚美妆', keywords: ['fashion', 'beauty', 'style', 'skincare', 'wear'] },
        home: { name: 'Home & Living', label: '家居生活', keywords: ['home', 'interior', 'garden', 'living', 'decor'] },
        general: { name: 'General Interest', label: '通用资讯', keywords: ['general', 'news', 'guide', 'reference'] },
        entertainment: { name: 'Entertainment', label: '娱乐资讯', keywords: ['entertainment', 'celebrity', 'show', 'culture', 'release'] },
        film: { name: 'Film', label: '影视电影', keywords: ['film', 'cinema', 'director', 'movie', 'screen'] },
        music: { name: 'Music', label: '音乐音频', keywords: ['music', 'album', 'artist', 'song', 'streaming'] },
        books: { name: 'Books & Reading', label: '图书阅读', keywords: ['book', 'author', 'reading', 'novel', 'publisher'] },
        science: { name: 'Science', label: '科学探索', keywords: ['science', 'research', 'study', 'laboratory', 'discovery'] },
        environment: { name: 'Environment', label: '环境生态', keywords: ['environment', 'climate', 'ecology', 'sustainability', 'nature'] },
        politics: { name: 'Politics & Public Affairs', label: '政治时政', keywords: ['politics', 'policy', 'government', 'election', 'public'] },
        legal: { name: 'Legal', label: '法律法规', keywords: ['legal', 'law', 'court', 'regulation', 'jurisdiction'] },
        realestate: { name: 'Real Estate', label: '房产置业', keywords: ['real estate', 'property', 'housing', 'mortgage', 'rental'] },
        career: { name: 'Career', label: '职业发展', keywords: ['career', 'job', 'workplace', 'resume', 'hiring'] },
        marketing: { name: 'Marketing', label: '市场营销', keywords: ['marketing', 'brand', 'campaign', 'audience', 'seo'] },
        ecommerce: { name: 'E-commerce', label: '电商零售', keywords: ['ecommerce', 'retail', 'product', 'shop', 'commerce'] },
        pets: { name: 'Pets & Animals', label: '宠物动物', keywords: ['pet', 'pets', 'dog', 'cat', 'animal', 'breed'] },
        parenting: { name: 'Parenting', label: '亲子育儿', keywords: ['parenting', 'baby', 'child', 'family', 'parent'] },
        outdoors: { name: 'Outdoors', label: '户外探索', keywords: ['outdoor', 'hiking', 'camping', 'trail', 'adventure'] },
        photography: { name: 'Photography', label: '摄影影像', keywords: ['photography', 'camera', 'lens', 'photo', 'aperture'] },
        history: { name: 'History', label: '历史人文', keywords: ['history', 'historic', 'archive', 'heritage', 'century'] },
        agriculture: { name: 'Agriculture', label: '农业农产', keywords: ['agriculture', 'farm', 'crop', 'soil', 'harvest'] },
        energy: { name: 'Energy', label: '能源产业', keywords: ['energy', 'solar', 'electricity', 'renewable', 'power'] }
    };
    var DOMAIN_ALIASES = { games: 'game', gaming: 'game', technology: 'tech', petsanimals: 'pets', realestate: 'realestate', 'real-estate': 'realestate' };
    var DOMAIN_COMPOSITION_MODES = {
        tech: 'signal', finance: 'signal', politics: 'signal', legal: 'signal', marketing: 'signal', ecommerce: 'signal', energy: 'signal', automotive: 'signal',
        science: 'field', environment: 'field', pets: 'field', outdoors: 'field', agriculture: 'field', health: 'field',
        food: 'culture', travel: 'culture', fashion: 'culture', home: 'culture', parenting: 'culture', books: 'culture',
        game: 'spectacle', anime: 'spectacle', entertainment: 'spectacle', film: 'spectacle', music: 'spectacle', sports: 'spectacle', photography: 'spectacle',
        education: 'reference', general: 'reference', history: 'reference', realestate: 'reference', career: 'reference'
    };

    function normalizeDomainId(value) {
        var id = String(value == null ? '' : value).toLowerCase().trim().replace(/\s+/g, '').replace(/_/g, '-');
        id = DOMAIN_ALIASES[id] || id;
        return DOMAIN_PROFILES[id] ? id : '';
    }

    function inferDomainId(items, type, hints) {
        if (type === 'games') return 'game';
        var text = String(hints || '') + ' ' + (items || []).slice(0, 16).map(function (item) {
            return [item.title, item.category, item.summary, item.content].join(' ');
        }).join(' ');
        text = text.toLowerCase();
        var bestId = '';
        var bestScore = 0;
        Object.keys(DOMAIN_PROFILES).forEach(function (id) {
            var score = DOMAIN_PROFILES[id].keywords.reduce(function (total, keyword) {
                return total + (text.indexOf(keyword) !== -1 ? 1 : 0);
            }, 0);
            if (score > bestScore) { bestScore = score; bestId = id; }
        });
        return bestScore ? bestId : 'general';
    }

    // Twelve complete layout systems are exposed for every recognized vertical.
    // IDs and recommendation order are domain-scoped; the layout name continues
    // to describe the actual structure so operators can compare it across domains.
    function getDesignFamilies(type, domainId) {
        var baseFamilies = DESIGN_FAMILIES[type] || DESIGN_FAMILIES.editorial;
        var profile = DOMAIN_PROFILES[normalizeDomainId(domainId)];
        if (!profile) return baseFamilies.map(function (family) { return Object.assign({}, family); });
        var offset = parseInt(stableHash(profile.name).slice(-4), 16) % baseFamilies.length;
        return baseFamilies.map(function (unused, index) {
            var source = baseFamilies[(offset + index) % baseFamilies.length];
            return {
                id: normalizeDomainId(domainId) + '-blueprint-' + String(index + 1).padStart(2, '0'),
                name: profile.name + ' · ' + source.name,
                layout: source.layout,
                tone: source.tone,
                direction: source.direction,
                domainMode: DOMAIN_COMPOSITION_MODES[normalizeDomainId(domainId)] || 'reference',
                domainId: normalizeDomainId(domainId),
                domainLabel: profile.label,
                blueprintIndex: index + 1
            };
        });
    }

    // A site package may request either setting, but both also have a deterministic
    // automatic choice.  This keeps a new upload visually independent even when its
    // publisher has not supplied a design.json yet.
    var TYPOGRAPHY_PAIRS = [
        { id: 'editorial', name: 'Editorial Serif', body: '"Source Sans 3",Arial,sans-serif', display: '"Libre Baskerville",Georgia,serif', url: 'https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Source+Sans+3:wght@400;600;700&display=swap' },
        { id: 'humanist', name: 'Humanist Reading', body: '"Noto Sans",Arial,sans-serif', display: 'Lora,Georgia,serif', url: 'https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=Noto+Sans:wght@400;600;700&display=swap' },
        { id: 'technical', name: 'Technical Grotesk', body: '"IBM Plex Sans",Arial,sans-serif', display: '"IBM Plex Mono","Courier New",monospace', url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans:wght@400;600;700&display=swap' },
        { id: 'display', name: 'Display Contrast', body: 'Manrope,Arial,sans-serif', display: '"DM Serif Display",Georgia,serif', url: 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Manrope:wght@400;600;700&display=swap' },
        { id: 'warm', name: 'Warm Literary', body: '"Work Sans",Arial,sans-serif', display: 'Fraunces,Georgia,serif', url: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Work+Sans:wght@400;600;700&display=swap' },
        { id: 'news', name: 'Compact News', body: '"Public Sans",Arial,sans-serif', display: 'Newsreader,Georgia,serif', url: 'https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,600;6..72,700&family=Public+Sans:wght@400;600;700&display=swap' }
    ];

    var BRAND_MARKS = [
        { id: 'orbit', name: 'Orbit', glyph: '◉' }, { id: 'spark', name: 'Spark', glyph: '✦' },
        { id: 'compass', name: 'Compass', glyph: '⌘' }, { id: 'arch', name: 'Arch', glyph: '◒' },
        { id: 'tile', name: 'Tile', glyph: '▣' }, { id: 'wave', name: 'Wave', glyph: '⌁' }
    ];
    var TONE_OPTIONS = ['auto', 'ink-coral', 'paper-olive', 'canvas-forest', 'stone-wine', 'slate-cyan', 'cream-cobalt', 'paper-blue', 'canvas-orange', 'ink-lime'];
    var HOME_INTRO_OPTIONS = ['full', 'compact', 'hidden'];
    var SUMMARY_OPTIONS = ['standard', 'brief', 'hidden'];
    var DENSITY_OPTIONS = ['compact', 'comfortable', 'spacious'];
    var HOVER_OPTIONS = ['lift', 'image-zoom', 'none', 'float', 'scale', 'flip', 'glow', 'bounce', 'tilt', 'border-glow', 'slide-up', 'color-reveal', 'title-underline', 'accent-line'];
    var RADIUS_OPTIONS = ['auto', '0', '2px', '4px', '8px', '12px', '16px', '18px', '24px', '28px', 'right-round'];
    var GRID_GAP_OPTIONS = ['auto', 'compact', 'regular', 'relaxed', '5px', '10px', '20px', '30px', '40px'];
    var CARD_COLUMNS_OPTIONS = ['template', 'auto', '1', '2', '3', '4'];
    var CATEGORY_CARD_COLUMNS_OPTIONS = ['inherit', 'template', 'auto', '1', '2', '3', '4'];
    var CARD_VIEW_OPTIONS = ['auto', 'card', 'list', 'compact'];
    var CARD_BORDER_OPTIONS = ['auto', 'rounded', 'shadow', 'thin', 'double', 'dashed', 'thick', 'none'];
    var CARD_SPACING_OPTIONS = ['auto', '8px', '12px', '20px', '30px', '40px'];
    var EXCERPT_OPTIONS = ['auto', '2', '3', '4', 'none'];
    var CARD_IMAGE_HEIGHT_OPTIONS = ['auto', '120px', '150px', '180px', '220px', '260px'];
    var CARD_HEIGHT_OPTIONS = ['template', 'auto', '320px', '400px', '480px', '560px', '640px'];
    var COVER_FIT_OPTIONS = ['smart', 'template', 'cover', 'contain', 'top', 'bottom'];
    var CONTENT_WIDTH_OPTIONS = ['auto', '900px', '1000px', '1100px', '1200px', '1400px', 'full'];
    var META_BG_OPTIONS = ['auto', 'dark', 'light', 'primary', 'bordered', 'transparent'];
    var DETAIL_IMAGE_OPTIONS = ['auto', 'fullwidth', 'centered', 'float-left', 'float-right', 'banner'];
    var CATEGORY_TITLE_STYLE_OPTIONS = ['auto', 'single', 'none', 'double', 'dotted', 'gradient', 'left-accent'];
    var CATEGORY_TITLE_ALIGN_OPTIONS = ['auto', 'left', 'center'];
    var HERO_STYLE_OPTIONS = ['auto', 'gradient', 'solid', 'minimal', 'pattern'];
    var DETAIL_LAYOUT_OPTIONS = ['auto', 'single', 'sidebar'];
    var FONT_STYLE_OPTIONS = ['auto', 'sans-serif', 'serif', 'mono', 'rounded', 'condensed', 'elegant', 'modern', 'tech', 'handwritten', 'chinese-serif', 'chinese-kai', 'chinese-hei'];

    var TOOL_OPERATIONS = [
        'word-count', 'character-count', 'line-count', 'slugify', 'lowercase', 'uppercase',
        'title-case', 'sentence-case', 'reverse-text', 'sort-lines', 'dedupe-lines', 'trim-lines',
        'remove-empty-lines', 'find-replace', 'json-format', 'json-minify', 'json-validate',
        'csv-to-json', 'base64-encode', 'base64-decode', 'url-encode', 'url-decode',
        'html-escape', 'html-unescape', 'timestamp-to-date', 'date-to-timestamp',
        'percent-change', 'percentage-of', 'ratio-simplify', 'temperature', 'length', 'weight',
        'bytes', 'pace'
    ];

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function stripMarkup(value) {
        return String(value == null ? '' : value)
            .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/[`*_>#\[\]()~-]/g, ' ')
            .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gi, ' ')
            .replace(/\s+/g, ' ').trim();
    }

    function countEnglishWords(value) {
        var matches = stripMarkup(value).match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g);
        return matches ? matches.length : 0;
    }

    function slugify(value, fallback) {
        var slug = String(value == null ? '' : value).toLowerCase()
            .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
            .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
        return slug || String(fallback || 'item').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    }

    function stableHash(value) {
        var text = String(value == null ? '' : value);
        var hash = 2166136261;
        for (var i = 0; i < text.length; i += 1) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }

    function safeUrl(value, allowRelative) {
        var text = String(value == null ? '' : value).trim();
        if (!text) return '';
        if (allowRelative && /^(?:\.\.\/|\.\/|\/)?[a-z0-9][a-z0-9._\/-]*$/i.test(text) && !text.includes('..')) return text;
        try {
            var url = new URL(text);
            return url.protocol === 'https:' ? url.href : '';
        } catch (error) {
            return '';
        }
    }

    function isPlaceholderUrl(value) {
        try {
            var host = new URL(String(value || '')).hostname.toLowerCase();
            return PLACEHOLDER_HOSTS.some(function (placeholder) { return host === placeholder || host.endsWith('.' + placeholder); });
        } catch (error) {
            return true;
        }
    }

    function normalizeAssetPath(value) {
        var path = String(value == null ? '' : value).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
        var parts = path.split('/');
        if (!path || path.includes('\u0000') || path.includes(':') || parts.some(function (part) { return part === '..'; })) return '';
        return parts.filter(function (part) { return part && part !== '.'; }).join('/');
    }

    function firstValue(item, aliases, fallback) {
        for (var i = 0; i < aliases.length; i += 1) {
            var value = item && item[aliases[i]];
            if (value !== undefined && value !== null && String(value).trim() !== '') return value;
        }
        return fallback;
    }

    function toArray(value) {
        if (Array.isArray(value)) return value;
        if (value == null || value === '') return [];
        return [value];
    }

    function normalizeSources(value) {
        return toArray(value).map(function (source) {
            if (typeof source === 'string') return { title: source, publisher: '', url: safeUrl(source, false), type: '' };
            source = source || {};
            return {
                title: String(firstValue(source, ['title', 'page_title', 'name'], '')).trim(),
                publisher: String(firstValue(source, ['publisher', 'organization', 'site'], '')).trim(),
                url: safeUrl(firstValue(source, ['url', 'source_url', 'link'], ''), false),
                type: String(firstValue(source, ['source_type', 'type'], '')).trim(),
                accessed: String(firstValue(source, ['accessed', 'access_date'], '')).trim()
            };
        }).filter(function (source) { return source.url; });
    }

    function topicLabels(value) {
        var values = Array.isArray(value) ? value : [value];
        var labels = [];
        values.forEach(function (entry) {
            if (entry == null) return;
            String(entry).split(/[,;|/]+/).forEach(function (part) {
                var label = part.replace(/\s+/g, ' ').trim();
                if (label && label.length <= 48 && !labels.some(function (saved) { return saved.toLowerCase() === label.toLowerCase(); })) labels.push(label);
            });
        });
        return labels;
    }

    function itemTopicLabels(item) {
        var labels = [];
        ['category', 'section', 'topic', 'genre', 'tags', 'keywords', 'labels', 'subjects', 'themes'].forEach(function (key) {
            topicLabels(item && item[key]).forEach(function (label) {
                if (!labels.some(function (saved) { return saved.toLowerCase() === label.toLowerCase(); })) labels.push(label);
            });
        });
        return labels;
    }

    function isGenericTopic(value) {
        return ['general', 'other', 'others', 'misc', 'miscellaneous', 'uncategorized', 'all', 'default', 'unknown'].indexOf(String(value || '').trim().toLowerCase()) !== -1;
    }

    function topicToken(value) {
        var token = String(value || '').toLowerCase().replace(/[^a-z]/g, '');
        if (/ies$/.test(token) && token.length > 6) token = token.slice(0, -3) + 'y';
        else if (/(?:ches|shes|xes|zes)$/.test(token)) token = token.slice(0, -2);
        else if (/s$/.test(token) && !/(?:ss|us|is|ous|ness)$/.test(token)) token = token.slice(0, -1);
        return token;
    }

    function titleCaseTopic(value) {
        return String(value || '').replace(/\b[a-z]/g, function (letter) { return letter.toUpperCase(); });
    }

    function applyDetectedCategories(items) {
        var sourceCounts = {};
        items.forEach(function (item) {
            (item.topicLabels || []).forEach(function (label) {
                if (!isGenericTopic(label)) sourceCounts[label.toLowerCase()] = (sourceCounts[label.toLowerCase()] || 0) + 1;
            });
        });
        var sourceTopics = Object.keys(sourceCounts);
        if (sourceTopics.length >= 2) {
            items.forEach(function (item) {
                var label = (item.topicLabels || []).find(function (candidate) { return !isGenericTopic(candidate); });
                if (label) {
                    item.category = label;
                    item.categorySlug = slugify(label, 'general');
                }
            });
            return;
        }

        var stopWords = new Set(('about after again against also among another article articles because before being beyond browser content coverage defined description detail details each entry field first from game games guide guides have into its latest more most new only overview practical reader readers reference review site that their them these they this those through tool tools using what when where which with your').split(' '));
        var documents = {};
        var itemTokens = [];
        items.forEach(function (item) {
            var seen = {};
            var tokens = (String(item.title || '') + ' ' + String(item.summary || '')).toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [];
            tokens.forEach(function (word) {
                var token = topicToken(word);
                if (token.length < 4 || stopWords.has(token)) return;
                seen[token] = (seen[token] || 0) + 1;
            });
            Object.keys(seen).forEach(function (token) { documents[token] = (documents[token] || 0) + 1; });
            itemTokens.push(seen);
        });
        var itemCount = Math.max(items.length, 1);
        var candidates = Object.keys(documents).filter(function (token) {
            return documents[token] < Math.max(2, Math.ceil(itemCount * .86));
        }).sort(function (left, right) {
            return documents[right] - documents[left] || left.localeCompare(right);
        }).slice(0, 4);
        if (candidates.length < 2) return;
        items.forEach(function (item, index) {
            var chosen = candidates.filter(function (token) { return itemTokens[index][token]; }).sort(function (left, right) {
                return itemTokens[index][right] - itemTokens[index][left] || documents[right] - documents[left] || left.localeCompare(right);
            })[0];
            if (chosen) {
                item.category = titleCaseTopic(chosen);
                item.categorySlug = slugify(chosen, 'general');
            }
        });
    }

    function normalizeItem(item, index, type) {
        item = item || {};
        var title = String(firstValue(item, ['title', 'name', 'headline', 'tool_name', 'game_name'], '')).trim();
        var summary = String(firstValue(item, ['summary', 'excerpt', 'description', 'standfirst', 'short_description'], '')).trim();
        var content = String(firstValue(item, ['content', 'body', 'article', 'long_description', 'guide', 'description'], '')).trim();
        var suppliedTopics = itemTopicLabels(item);
        var category = suppliedTopics[0] || 'General';
        var cover = normalizeAssetPath(firstValue(item, ['cover', 'cover_image', 'image', 'image_path', 'thumb', 'thumbnail'], ''));
        var result = {
            raw: item,
            index: index,
            id: String(firstValue(item, ['id', 'slug'], index + 1)),
            title: title,
            slug: slugify(firstValue(item, ['slug'], title), type + '-' + (index + 1)),
            summary: summary || stripMarkup(content).slice(0, 180),
            content: content,
            category: category,
            categorySlug: slugify(category, 'general'),
            topicLabels: suppliedTopics,
            cover: cover,
            imageAlt: String(firstValue(item, ['image_alt', 'alt', 'cover_alt'], title ? title + ' cover' : '')).trim(),
            sources: normalizeSources(firstValue(item, ['sources', 'references', 'citations'], []))
        };

        if (type === 'editorial') {
            result.author = String(firstValue(item, ['author', 'byline', 'editorial_attribution'], '')).trim();
            result.published = String(firstValue(item, ['published', 'published_at', 'date'], '')).trim();
            result.updated = String(firstValue(item, ['updated', 'updated_at', 'modified'], '')).trim();
            result.factChecked = String(firstValue(item, ['fact_checked', 'fact_checked_at', 'fact_checked_by'], '')).trim();
            result.writingAssistance = String(firstValue(item, ['writing_assistance'], '')).trim();
        } else if (type === 'tools') {
            var implementation = item.implementation && typeof item.implementation === 'object' ? item.implementation : {};
            result.operation = String(firstValue(implementation, ['operation'], firstValue(item, ['operation', 'tool_operation'], ''))).trim().toLowerCase();
            var suppliedOptions = firstValue(implementation, ['options'], firstValue(item, ['options'], firstValue(item.example || {}, ['options'], {})));
            result.options = suppliedOptions && typeof suppliedOptions === 'object' && !Array.isArray(suppliedOptions) ? suppliedOptions : {};
            result.exampleInput = firstValue(item, ['example_input', 'sample_input'], firstValue(item.example || {}, ['input'], ''));
            result.exampleOutput = firstValue(item, ['example_output', 'sample_output'], firstValue(item.example || {}, ['output'], ''));
            result.instructions = String(firstValue(item, ['instructions', 'usage', 'how_to_use'], '')).trim();
            result.limitations = String(firstValue(item, ['limitations', 'limits', 'notes'], '')).trim();
        } else if (type === 'games') {
            result.playUrl = safeUrl(firstValue(item, ['play_url', 'url', 'game_url', 'store_url'], ''), false);
            result.localEntry = normalizeAssetPath(firstValue(item, ['local_entry', 'game_file', 'file'], ''));
            result.controls = String(firstValue(item, ['controls', 'how_to_play', 'instructions'], '')).trim();
            result.tips = toArray(firstValue(item, ['tips', 'strategy_tips'], [])).map(String);
            result.license = String(firstValue(item, ['license', 'license_name'], '')).trim();
            result.sourceUrl = safeUrl(firstValue(item, ['source_url', 'repository', 'repo'], ''), false);
            result.provider = String(firstValue(item, ['provider', 'author', 'publisher'], '')).trim();
        }
        return result;
    }

    function extractData(payload, preferredType) {
        if (Array.isArray(payload)) return payload;
        if (!payload || typeof payload !== 'object') return [];
        var type = SITE_TYPES.indexOf(preferredType) !== -1 ? preferredType : '';
        var keys = type === 'editorial'
            ? ['articles', 'items', 'data']
            : type === 'tools'
                ? ['tools', 'items', 'data']
                : ['games', 'items', 'data'];
        var containers = [payload, payload.content || {}, payload.data || {}];
        for (var c = 0; c < containers.length; c += 1) {
            for (var k = 0; k < keys.length; k += 1) {
                if (Array.isArray(containers[c][keys[k]])) return containers[c][keys[k]];
            }
        }
        var values = Object.keys(payload).map(function (key) { return payload[key]; });
        return values.find(Array.isArray) || [];
    }

    function detectSiteType(payload, preferredType) {
        var manifest = payload && payload.manifest ? payload.manifest : payload || {};
        var value = String(firstValue(manifest, ['site_type', 'type'], firstValue(manifest.site || {}, ['type', 'site_type'], preferredType || ''))).toLowerCase();
        if (value === 'information' || value === 'news' || value === 'articles') value = 'editorial';
        if (value === 'tool' || value === 'utility') value = 'tools';
        if (value === 'game') value = 'games';
        return SITE_TYPES.indexOf(value) !== -1 ? value : (SITE_TYPES.indexOf(preferredType) !== -1 ? preferredType : 'editorial');
    }

    function importJsonData(payload, preferredType) {
        var type = detectSiteType(payload, preferredType);
        var manifest = payload && payload.manifest ? payload.manifest : {};
        var data = extractData(payload, type);
        return {
            siteType: type,
            data: data,
            packageData: {
                manifest: manifest,
                design: payload && payload.design ? payload.design : {},
                legal: payload && payload.legal ? payload.legal : {},
                provenance: payload && payload.provenance ? payload.provenance : {},
                designReferences: payload && payload.design_references ? payload.design_references : {}
            },
            localImages: {}, packageAssets: {}, localGameFiles: {}
        };
    }

    function getZipCtor(options) {
        if (options && options.JSZip) return options.JSZip;
        if (typeof JSZip !== 'undefined') return JSZip;
        return null;
    }

    async function importZip(file, preferredType, options) {
        var Zip = getZipCtor(options);
        if (!Zip) throw new Error('ZIP 解析组件未加载。');
        var onProgress = options && typeof options.onProgress === 'function' ? options.onProgress : function () {};
        onProgress(12, '正在解压 ZIP 数据包…');
        var zip = await Zip.loadAsync(file);
        var archiveFiles = zip && zip.files && typeof zip.files === 'object' ? zip.files : null;
        if (!archiveFiles) throw new Error('ZIP 解析结果不完整。请刷新页面后重新选择该压缩包。');
        var entries = Object.keys(archiveFiles).filter(function (path) { return !archiveFiles[path].dir; }).map(function (sourcePath) {
            return { sourcePath: sourcePath, path: normalizeAssetPath(sourcePath) };
        });
        if (entries.some(function (entry) { return !entry.path; })) throw new Error('压缩包包含不安全的文件路径。');
        onProgress(32, '压缩包已解压，正在检查文件结构…');
        var entryByPath = {};
        entries.forEach(function (entry) {
            if (entryByPath[entry.path]) throw new Error('压缩包包含规范化后重复的文件路径：' + entry.path);
            entryByPath[entry.path] = entry;
        });
        var safePaths = entries.map(function (entry) { return entry.path; });

        var jsonPaths = safePaths.filter(function (path) { return /\.json$/i.test(path); });
        var parsed = {};
        for (var i = 0; i < jsonPaths.length; i += 1) {
            onProgress(34 + Math.round((i + 1) / Math.max(1, jsonPaths.length) * 26), '正在解析 JSON 文件 (' + (i + 1) + '/' + jsonPaths.length + ')…');
            try { parsed[jsonPaths[i]] = JSON.parse(await zip.files[entryByPath[jsonPaths[i]].sourcePath].async('string')); }
            catch (error) { throw new Error('JSON 解析失败（' + jsonPaths[i] + '）：' + error.message); }
        }
        function named(name) {
            var path = jsonPaths.find(function (candidate) { return candidate.toLowerCase().split('/').pop() === name; });
            return path ? parsed[path] : {};
        }
        var manifest = named('manifest.json');
        var type = detectSiteType({ manifest: manifest }, preferredType);
        var records = [];
        var targetPattern = type === 'editorial' ? /(?:^|\/)content\/articles(?:\/|\.json$)/i
            : type === 'tools' ? /(?:^|\/)content\/tools(?:\/|\.json$)/i
                : /(?:^|\/)content\/games(?:\/|\.json$)/i;
        jsonPaths.filter(function (path) { return targetPattern.test(path); }).forEach(function (path) {
            var chunk = extractData(parsed[path], type);
            if (chunk.length) records = records.concat(chunk);
            else if (parsed[path] && typeof parsed[path] === 'object' && !Array.isArray(parsed[path])) records.push(parsed[path]);
        });
        if (!records.length) {
            for (var j = 0; j < jsonPaths.length; j += 1) {
                if (/manifest|design|legal|provenance|reference/i.test(jsonPaths[j])) continue;
                var fallback = extractData(parsed[jsonPaths[j]], type);
                if (fallback.length) { records = fallback; break; }
            }
        }
        if (!records.length) throw new Error('压缩包中没有找到 ' + type + ' 数据列表。');
        onProgress(64, '正在整理内容与素材清单…');

        var localImages = {};
        var packageAssets = {};
        var localGameFiles = {};
        var assetPaths = safePaths.filter(function (path) { return !/\.json$/i.test(path); });
        for (var a = 0; a < assetPaths.length; a += 1) {
            onProgress(64 + Math.round((a + 1) / Math.max(1, assetPaths.length) * 32), '正在读取素材 (' + (a + 1) + '/' + assetPaths.length + ')…');
            var assetPath = assetPaths[a];
            var sourceEntry = entryByPath[assetPath];
            var blob = await zip.files[sourceEntry.sourcePath].async('blob');
            packageAssets[assetPath] = blob;
            if (/\.(?:avif|gif|jfif|jpe?g|png|svg|webp)$/i.test(assetPath)) localImages[assetPath] = blob;
            if (/\.(?:html?)$/i.test(assetPath) && /(?:^|\/)games?\//i.test(assetPath)) localGameFiles[assetPath] = await zip.files[sourceEntry.sourcePath].async('string');
        }
        // Differentiated exports keep their editable visual choices in the
        // internal design-settings ledger.  Accept it as a fallback so a
        // draft can be imported again without silently losing page templates.
        var importedDesign = named('design.json');
        if (!importedDesign || !Object.keys(importedDesign).length) importedDesign = named('design-settings.json');
        onProgress(96, '内容与素材已读取，正在应用站点配置…');
        return {
            siteType: type,
            data: records,
            packageData: {
                manifest: manifest,
                design: importedDesign,
                legal: named('legal.json'),
                provenance: named('content-provenance.json'),
                designReferences: named('design-references.json')
            },
            localImages: localImages,
            packageAssets: packageAssets,
            localGameFiles: localGameFiles
        };
    }

    function inferVertical(items, fallback) {
        if (String(fallback || '').trim()) return String(fallback).trim();
        var counts = {};
        items.forEach(function (item) {
            var category = String(item.category || '').trim();
            if (category) counts[category] = (counts[category] || 0) + 1;
        });
        var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
        var stopWords = new Set(('about after again against also among animal animals article articles because before being between bones could coverage described discovered during each early family field first forelimbs formation fossil fossils found from genus group guide guides have information into known large largest length limbs lived meter meters metre metres million modern more most named other over period reader readers recovered reference remains resources roughly should site skeleton skull small species specimen than that their them then there these they this those through tonnes under using very were what when where which while whose will with within world would year years your').split(' '));
        var documentCounts = {};
        var totalCounts = {};
        var headingCounts = {};
        items.slice(0, 50).forEach(function (item) {
            var heading = [item.title, item.category].join(' ').toLowerCase();
            var sample = [heading, item.summary, stripMarkup(item.content).slice(0, 1600)].join(' ').toLowerCase();
            var seen = {};
            var seenInHeading = {};
            (sample.match(/[a-z][a-z'-]{3,}/g) || []).forEach(function (token) {
                token = token.replace(/^[-']+|[-']+$/g, '').replace(/'s$/, '');
                if (token.length < 5 || stopWords.has(token)) return;
                if (/ies$/.test(token) && token.length > 6) token = token.slice(0, -3) + 'y';
                else if (/(?:ches|shes|xes|zes)$/.test(token)) token = token.slice(0, -2);
                else if (/s$/.test(token) && !/(?:ss|us|is|ous|ness)$/.test(token)) token = token.slice(0, -1);
                if (token.length < 5 || stopWords.has(token)) return;
                totalCounts[token] = (totalCounts[token] || 0) + 1;
                seen[token] = true;
            });
            (heading.match(/[a-z][a-z'-]{3,}/g) || []).forEach(function (token) {
                token = token.replace(/^[-']+|[-']+$/g, '').replace(/'s$/, '');
                if (token.length < 5 || stopWords.has(token)) return;
                if (/ies$/.test(token) && token.length > 6) token = token.slice(0, -3) + 'y';
                else if (/(?:ches|shes|xes|zes)$/.test(token)) token = token.slice(0, -2);
                else if (/s$/.test(token) && !/(?:ss|us|is|ous|ness)$/.test(token)) token = token.slice(0, -1);
                if (token.length >= 5 && !stopWords.has(token)) seenInHeading[token] = true;
            });
            Object.keys(seen).forEach(function (token) { documentCounts[token] = (documentCounts[token] || 0) + 1; });
            Object.keys(seenInHeading).forEach(function (token) { headingCounts[token] = (headingCounts[token] || 0) + 1; });
        });
        var minimumDocuments = Math.max(2, Math.ceil(Math.min(items.length, 50) * .2));
        var candidates = Object.keys(documentCounts).filter(function (token) {
            return documentCounts[token] >= minimumDocuments;
        }).sort(function (a, b) {
            return (documentCounts[b] * 20 + (headingCounts[b] || 0) * 12 + Math.min(totalCounts[b], 100)) - (documentCounts[a] * 20 + (headingCounts[a] || 0) * 12 + Math.min(totalCounts[a], 100));
        });
        if (candidates.length) return candidates[0].replace(/\b[a-z]/g, function (letter) { return letter.toUpperCase(); }) + ' Reference';
        return String(top || 'Independent reference').trim();
    }

    function readHistory(historyKey) {
        try {
            var value = localStorage.getItem('differentiated-design-history-v1');
            var parsed = value ? JSON.parse(value) : {};
            return Array.isArray(parsed[historyKey]) ? parsed[historyKey] : [];
        } catch (error) { return []; }
    }

    function chooseDesign(type, requested, seed, domainId) {
        var families = getDesignFamilies(type, domainId);
        var exact = families.find(function (family) { return family.id === requested; });
        if (exact) return exact;
        var historyKey = type + ':' + (normalizeDomainId(domainId) || 'base');
        var history = typeof localStorage !== 'undefined' ? readHistory(historyKey) : [];
        var unused = families.filter(function (family) { return history.indexOf(family.id) === -1; });
        var pool = unused.length ? unused : families;
        var index = parseInt(stableHash(seed).slice(-6), 16) % pool.length;
        return pool[index];
    }

    function chooseFrom(items, requested, seed) {
        var exact = items.find(function (item) { return item.id === requested; });
        if (exact) return exact;
        return items[parseInt(stableHash(seed).slice(-6), 16) % items.length];
    }

    function chooseValue(value, allowed, fallback) {
        value = String(value == null ? '' : value).trim();
        return allowed.indexOf(value) !== -1 ? value : fallback;
    }

    function chooseList(value, allowed, fallback) {
        var source = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(',') : []);
        var selected = [];
        source.forEach(function (item) {
            item = String(item == null ? '' : item).trim();
            if (allowed.indexOf(item) !== -1 && selected.indexOf(item) === -1) selected.push(item);
        });
        return Array.isArray(value) ? selected : (selected.length ? selected : (fallback || []).slice());
    }

    function rememberDesign(config) {
        if (typeof localStorage === 'undefined') return;
        try {
            var key = 'differentiated-design-history-v1';
            var parsed = JSON.parse(localStorage.getItem(key) || '{}');
            var historyKey = config.type + ':' + ((config.domain && config.domain.id) || 'base');
            var list = Array.isArray(parsed[historyKey]) ? parsed[historyKey] : [];
            parsed[historyKey] = [config.design.id].concat(list.filter(function (id) { return id !== config.design.id; })).slice(0, 12);
            localStorage.setItem(key, JSON.stringify(parsed));
        } catch (error) { /* storage is optional */ }
    }

    function resolveAsset(assets, requested) {
        var path = normalizeAssetPath(requested);
        if (!path) return '';
        if (assets[path]) return path;
        var base = path.split('/').pop().toLowerCase();
        return Object.keys(assets).find(function (candidate) { return candidate.split('/').pop().toLowerCase() === base; }) || '';
    }

    function buildConfig(appState, options) {
        appState = appState || {};
        options = options || {};
        var state = appState.differentiated || {};
        var packageData = appState.differentiatedPackage || {};
        var manifest = packageData.manifest || {};
        var manifestSite = manifest.site || {};
        var type = detectSiteType({ manifest: manifest }, options.siteType || state.siteType || 'editorial');
        var items = (appState.data || []).map(function (item, index) { return normalizeItem(item, index, type); });
        applyDetectedCategories(items);
        var vertical = String(options.vertical || state.vertical || firstValue(manifestSite, ['vertical', 'topic', 'niche'], '') || firstValue(manifest, ['vertical'], '')).trim();
        vertical = inferVertical(items, vertical);
        var siteTitle = String(options.siteTitle || state.siteTitle || firstValue(manifestSite, ['name', 'title'], '') || firstValue(manifest, ['site_name'], '') || vertical).trim();
        var audience = String(options.audience || state.audience || firstValue(manifestSite, ['audience'], '') || 'Readers seeking a focused, practical reference').trim();
        var scope = String(options.scope || state.scope || firstValue(manifestSite, ['scope', 'description'], '') || ('Independent English-language coverage of ' + vertical + '.')).trim();
        var suppliedBaseUrl = String(options.baseUrl || state.baseUrl || firstValue(manifestSite, ['base_url', 'url'], '') || '').replace(/\/+$/, '');
        var baseUrl = safeUrl(suppliedBaseUrl, false).replace(/\/+$/, '');
        var contactEmail = String(options.contactEmail || state.contactEmail || firstValue(packageData.legal || {}, ['contact_email', 'email'], '')).trim();
        var manifestDomain = firstValue(manifestSite, ['domain_id', 'domain', 'theme'], '') || firstValue(manifest, ['domain_id', 'domain', 'theme'], '');
        var domainId = normalizeDomainId(options.domainId || state.domainId || appState.selectedTheme || firstValue(packageData.design || {}, ['domain_id', 'domain'], '') || manifestDomain);
        if (!domainId) domainId = inferDomainId(items, type, vertical);
        var domainProfile = DOMAIN_PROFILES[domainId] || DOMAIN_PROFILES.general;
        var requestedDesign = options.designFamily || state.designFamily || firstValue(packageData.design || {}, ['family', 'design_family'], 'auto');
        var seed = String(options.seed || state.seed || firstValue(packageData.design || {}, ['seed'], '') || [type, vertical].concat(items.map(function (item) { return item.title; })).join('|'));
        var design = Object.assign({}, chooseDesign(type, requestedDesign, seed, domainId));
        var typography = chooseFrom(TYPOGRAPHY_PAIRS, options.typography || state.typography || firstValue(packageData.design || {}, ['typography', 'font_pair'], 'auto'), seed + '|type');
        var brandMark = chooseFrom(BRAND_MARKS, options.brandMark || state.brandMark || firstValue(packageData.design || {}, ['brand_mark', 'logo_mark'], 'auto'), seed + '|mark');
        var logoIcon = String(options.logoIcon || state.logoIcon || firstValue(packageData.design || {}, ['logo_icon'], '') || '').trim().slice(0, 12);
        if (logoIcon) brandMark = Object.assign({}, brandMark, { glyph: logoIcon });
        var cardAlignment = (options.cardAlignment || state.cardAlignment) === 'aligned' ? 'aligned' : 'compact';
        var tone = chooseValue(options.tone || state.tone || firstValue(packageData.design || {}, ['tone', 'color_tone'], 'auto'), TONE_OPTIONS, 'auto');
        if (tone !== 'auto') design.tone = tone;
        var homeIntro = chooseValue(options.homeIntro || state.homeIntro || firstValue(packageData.design || {}, ['home_intro', 'hero_style'], 'compact'), HOME_INTRO_OPTIONS, 'compact');
        var summaryMode = chooseValue(options.summaryMode || state.summaryMode || firstValue(packageData.design || {}, ['summary_mode', 'card_summary'], 'standard'), SUMMARY_OPTIONS, 'standard');
        var contentDensity = chooseValue(options.contentDensity || state.contentDensity || firstValue(packageData.design || {}, ['content_density', 'density'], 'comfortable'), DENSITY_OPTIONS, 'comfortable');
        var cardHover = chooseValue(options.cardHover || state.cardHover || firstValue(packageData.design || {}, ['card_hover', 'hover_effect'], 'lift'), HOVER_OPTIONS, 'lift');
        var cardRadius = chooseValue(options.cardRadius || state.cardRadius || firstValue(packageData.design || {}, ['card_radius', 'radius'], 'auto'), RADIUS_OPTIONS, 'auto');
        // Every item below has an `auto` value.  That is important: a template
        // remains art-directed until the user explicitly picks a control, at
        // which point the generated terminal override is the final authority.
        var cardColumns = chooseValue(options.cardColumns || state.cardColumns || firstValue(packageData.design || {}, ['card_columns'], 'template'), CARD_COLUMNS_OPTIONS, 'template');
        var categoryCardColumns = chooseValue(options.categoryCardColumns || state.categoryCardColumns || firstValue(packageData.design || {}, ['category_card_columns'], 'inherit'), CATEGORY_CARD_COLUMNS_OPTIONS, 'inherit');
        var cardViewMode = chooseValue(options.cardViewMode || state.cardViewMode || firstValue(packageData.design || {}, ['card_view_mode'], 'auto'), CARD_VIEW_OPTIONS, 'auto');
        var cardBorder = chooseValue(options.cardBorder || state.cardBorder || firstValue(packageData.design || {}, ['card_border'], 'auto'), CARD_BORDER_OPTIONS, 'auto');
        var cardSpacing = chooseValue(options.cardSpacing || state.cardSpacing || firstValue(packageData.design || {}, ['card_spacing'], 'auto'), CARD_SPACING_OPTIONS, 'auto');
        var cardExcerptLines = chooseValue(options.cardExcerptLines || state.cardExcerptLines || firstValue(packageData.design || {}, ['card_excerpt_lines'], 'auto'), EXCERPT_OPTIONS, 'auto');
        var cardImageHeight = chooseValue(options.cardImageHeight || state.cardImageHeight || firstValue(packageData.design || {}, ['card_image_height'], 'auto'), CARD_IMAGE_HEIGHT_OPTIONS, 'auto');
        var cardHeight = chooseValue(options.cardHeight || state.cardHeight || firstValue(packageData.design || {}, ['card_height'], 'template'), CARD_HEIGHT_OPTIONS, 'template');
        var coverFit = chooseValue(options.coverFit || state.coverFit || firstValue(packageData.design || {}, ['cover_fit'], 'smart'), COVER_FIT_OPTIONS, 'smart');
        var contentMaxWidth = chooseValue(options.contentMaxWidth || state.contentMaxWidth || firstValue(packageData.design || {}, ['content_max_width'], 'auto'), CONTENT_WIDTH_OPTIONS, 'auto');
        var metaBg = chooseValue(options.metaBg || state.metaBg || firstValue(packageData.design || {}, ['meta_bg'], 'auto'), META_BG_OPTIONS, 'auto');
        var detailImgStyle = chooseValue(options.detailImgStyle || state.detailImgStyle || firstValue(packageData.design || {}, ['detail_img_style'], 'auto'), DETAIL_IMAGE_OPTIONS, 'auto');
        var categoryTitleStyle = chooseValue(options.categoryTitleStyle || state.categoryTitleStyle || firstValue(packageData.design || {}, ['category_title_style'], 'auto'), CATEGORY_TITLE_STYLE_OPTIONS, 'auto');
        var categoryTitleAlign = chooseValue(options.categoryTitleAlign || state.categoryTitleAlign || firstValue(packageData.design || {}, ['category_title_align'], 'auto'), CATEGORY_TITLE_ALIGN_OPTIONS, 'auto');
        var heroStyle = chooseValue(options.heroStyle || state.heroStyle || firstValue(packageData.design || {}, ['hero_style'], 'auto'), HERO_STYLE_OPTIONS, 'auto');
        var detailLayout = chooseValue(options.detailLayout || state.detailLayout || firstValue(packageData.design || {}, ['detail_layout'], 'auto'), DETAIL_LAYOUT_OPTIONS, 'auto');
        var fontStyle = chooseValue(options.fontStyle || state.fontStyle || firstValue(packageData.design || {}, ['font_style'], 'auto'), FONT_STYLE_OPTIONS, 'auto');
        // These controls intentionally mirror the proven ordinary-site controls,
        // while still keeping the differentiated builder's data-led layouts.
        var navStyle = chooseValue(options.navStyle || state.navStyle || firstValue(packageData.design || {}, ['nav_style', 'navbar_style'], 'glass'), ['glass', 'underline', 'accent', 'minimal', 'normal', 'transparent', 'dark-fixed', 'side-drawer', 'bottom-fixed'], 'glass');
        var navHeight = chooseValue(options.navHeight || state.navHeight || firstValue(packageData.design || {}, ['nav_height', 'navbar_height'], 'regular'), ['compact', 'regular', 'roomy', '40px', '50px', '60px', '70px', '80px'], 'regular');
        var navLayout = chooseValue(options.navLayout || state.navLayout || firstValue(packageData.design || {}, ['nav_layout', 'navbar_layout'], 'split'), ['split', 'centered', 'left'], 'split');
        var logoStyle = chooseValue(options.logoStyle || state.logoStyle || firstValue(packageData.design || {}, ['logo_style'], 'mark-text'), ['mark-text', 'mark', 'boxed', 'text'], 'mark-text');
        var backLinkStyle = chooseValue(options.backLinkStyle || state.backLinkStyle || firstValue(packageData.design || {}, ['back_link_style'], 'arrow'), ['arrow', 'button', 'crumb'], 'arrow');
        var buttonStyle = chooseValue(options.buttonStyle || state.buttonStyle || firstValue(packageData.design || {}, ['button_style'], 'solid'), ['solid', 'outline', 'pill', 'gradient', 'rounded', 'square', '3d', 'ghost'], 'solid');
        var buttonSize = chooseValue(options.buttonSize || state.buttonSize || firstValue(packageData.design || {}, ['button_size', 'btn_size'], 'auto'), ['auto', 'xsmall', 'small', 'medium', 'large', 'xlarge'], 'auto');
        var gridGap = chooseValue(options.gridGap || state.gridGap || firstValue(packageData.design || {}, ['grid_gap'], 'regular'), GRID_GAP_OPTIONS, 'regular');
        var animationEnter = chooseValue(options.animationEnter || state.animationEnter || firstValue(packageData.design || {}, ['animation_enter'], 'fade'), ['none', 'fade', 'rise', 'fadeIn', 'slideUp', 'zoomIn', 'slideLeft', 'slideRight', 'rotateIn', 'flipIn'], 'fade');
        var transitionSpeed = chooseValue(options.transitionSpeed || state.transitionSpeed || firstValue(packageData.design || {}, ['transition_speed'], 'normal'), ['fast', 'normal', 'slow', '0.1s', '0.2s', '0.3s', '0.5s', '0.8s'], 'normal');
        var suppliedPalette = options.themePalette || state.themePalette || {};
        var themePalette = {};
        if (suppliedPalette && typeof suppliedPalette === 'object') {
            [['paper', '--color-bg'], ['surface', '--color-card-bg'], ['ink', '--color-text'], ['muted', '--color-text-secondary'], ['accent', '--color-primary'], ['accent2', '--color-primary-light'], ['line', '--color-border']].forEach(function (pair) {
                var value = String(suppliedPalette[pair[1]] || suppliedPalette[pair[0]] || '').trim();
                if (/^[#(),.%\-\w\s]+$/.test(value) && value.length <= 100) themePalette[pair[0]] = value;
            });
            [
                ['surface-hover', '--color-card-hover', '--color-surface'],
                ['nav-surface', '--color-nav-bg', '--navbar-bg'],
                ['footer-surface', '--color-footer-bg'],
                ['on-accent', '--color-btn-text']
            ].forEach(function (pair) {
                var value = '';
                for (var pairIndex = 1; pairIndex < pair.length; pairIndex += 1) {
                    value = String(suppliedPalette[pair[pairIndex]] || '').trim();
                    if (value) break;
                }
                if (/^[#(),.%\\\\-\\\\w\\\\s]+$/.test(value) && value.length <= 100) themePalette[pair[0]] = value;
            });
        }
        var themePreset = String(options.themePreset || state.themePreset || firstValue(packageData.design || {}, ['theme_preset', 'selected_style'], 'auto') || 'auto').trim().slice(0, 80);
        var featuredCard = (options.featuredCard || state.featuredCard || firstValue(packageData.design || {}, ['featured_card'], 'highlight')) === 'standard' ? 'standard' : 'highlight';
        var requestedCategoryLimit = Number(options.navCategoryLimit || state.navCategoryLimit || firstValue(packageData.design || {}, ['nav_category_limit', 'category_limit'], 4));
        var navCategoryLimit = [2, 3, 4, 5, 6].indexOf(requestedCategoryLimit) !== -1 ? requestedCategoryLimit : 4;
        var suppliedHomeCategoryLayout = options.homeCategoryLayout;
        if (suppliedHomeCategoryLayout === undefined) suppliedHomeCategoryLayout = state.homeCategoryLayout;
        if (suppliedHomeCategoryLayout === undefined) suppliedHomeCategoryLayout = firstValue(packageData.design || {}, ['home_category_layout', 'group_home_categories'], false);
        var homeCategoryLayout = suppliedHomeCategoryLayout === true || suppliedHomeCategoryLayout === 1 || suppliedHomeCategoryLayout === '1' || suppliedHomeCategoryLayout === 'true';
        var requestedHomeCategoryLimit = Number(options.homeCategoryLimit || state.homeCategoryLimit || firstValue(packageData.design || {}, ['home_category_limit'], 4));
        var homeCategoryLimit = [2, 3, 4, 5, 6].indexOf(requestedHomeCategoryLimit) !== -1 ? requestedHomeCategoryLimit : 4;
        // Reuse the ordinary builder's page controls without changing the
        // differentiated site's data-derived routes or content quality rules.
        var contactLayout = chooseValue(options.contactLayout || state.contactLayout || firstValue(packageData.design || {}, ['contact_layout', 'contact_template'], 'split'), ['direct', 'form', 'split'], 'split');
        var contactFields = chooseList(options.contactFields || state.contactFields || firstValue(packageData.design || {}, ['contact_fields'], []), ['name', 'email', 'subject', 'message'], ['name', 'email', 'subject', 'message']);
        var footerStyle = chooseValue(options.footerStyle || state.footerStyle || firstValue(packageData.design || {}, ['footer_style'], 'simple'), ['simple', 'detailed'], 'simple');
        var footerLinks = chooseList(options.footerLinks || state.footerLinks || firstValue(packageData.design || {}, ['footer_links'], []), ['privacy', 'terms', 'contact', 'about'], ['privacy', 'terms', 'contact', 'about']);
        var assets = Object.assign({}, appState.packageAssets || {}, appState.localImages || {});
        var outputAssets = {};
        var assetBySource = {};
        items.forEach(function (item) {
            var matched = resolveAsset(assets, item.cover);
            if (!matched) return;
            var extensionMatch = matched.match(/\.(avif|gif|jfif|jpe?g|png|svg|webp)$/i);
            var output = 'assets/images/' + item.slug + '-cover.' + (extensionMatch ? extensionMatch[1].toLowerCase().replace('jpeg', 'jpg').replace('jfif', 'jpg') : 'webp');
            outputAssets[output] = assets[matched];
            assetBySource[matched] = output;
            item.coverOutput = output;
            item.coverSource = matched;
        });
        var localGameFiles = Object.assign({}, appState.localGameFiles || {});
        var gameOutputAssets = {};
        Object.keys(assets).forEach(function (path) {
            if (/\.(?:html?)$/i.test(path) && /(?:^|\/)games?\//i.test(path)) localGameFiles[path] = assets[path];
            var gamePath = path.match(/(?:^|\/)(games\/[^?#]+)$/i);
            if (gamePath) gameOutputAssets[gamePath[1]] = assets[path];
        });
        var categories = [];
        items.forEach(function (item) {
            var existing = categories.find(function (category) { return category.slug === item.categorySlug; });
            if (existing) existing.count += 1;
            else categories.push({ name: item.category, slug: item.categorySlug, count: 1 });
        });
        categories.sort(function (left, right) { return right.count - left.count || left.name.localeCompare(right.name); });
        // Keep the source-derived routes and record counts intact, but allow the
        // configuration panel to give each detected category a clearer label and
        // an icon.  Matching by immutable slug means a rename cannot break an
        // exported section URL or disconnect its records.
        var categoryOverrides = Array.isArray(state.categoryOverrides) ? state.categoryOverrides : [];
        var categoryOverridesBySlug = {};
        categoryOverrides.forEach(function (override) {
            if (!override || typeof override !== 'object') return;
            var slug = String(override.slug || '').trim();
            if (!slug) return;
            categoryOverridesBySlug[slug] = {
                name: stripMarkup(override.name || '').slice(0, 64),
                icon: String(override.icon || '').trim().slice(0, 12),
                homeCount: Number(override.homeCount)
            };
        });
        categories = categories.map(function (category) {
            var override = categoryOverridesBySlug[category.slug];
            var sourceCount = Math.max(1, Number(category.count) || 1);
            var requestedHomeCount = Number(override && override.homeCount);
            return Object.assign({}, category, {
                name: (override && override.name) || category.name,
                icon: (override && override.icon) || '',
                homeCount: requestedHomeCount >= 1 ? Math.min(sourceCount, Math.floor(requestedHomeCount)) : Math.min(6, sourceCount)
            });
        });
        var fingerprint = [type, domainId, design.id, design.layout, design.direction || '', design.domainMode || '', design.tone, homeIntro, summaryMode, contentDensity, stableHash(seed)].join(':');
        return {
            schemaVersion: SCHEMA_VERSION,
            type: type,
            items: items,
            siteTitle: siteTitle,
            vertical: vertical,
            audience: audience,
            scope: scope,
            domain: { id: domainId, name: domainProfile.name, label: domainProfile.label },
            baseUrl: baseUrl,
            contactEmail: contactEmail,
            categories: categories,
            design: design,
            typography: typography,
            brandMark: brandMark,
            logoIcon: logoIcon,
            cardAlignment: cardAlignment,
            tone: tone,
            homeIntro: homeIntro,
            summaryMode: summaryMode,
            contentDensity: contentDensity,
            cardHover: cardHover,
            cardRadius: cardRadius,
            cardColumns: cardColumns,
            categoryCardColumns: categoryCardColumns,
            cardViewMode: cardViewMode,
            cardBorder: cardBorder,
            cardSpacing: cardSpacing,
            cardExcerptLines: cardExcerptLines,
            cardImageHeight: cardImageHeight,
            cardHeight: cardHeight,
            coverFit: coverFit,
            contentMaxWidth: contentMaxWidth,
            metaBg: metaBg,
            detailImgStyle: detailImgStyle,
            categoryTitleStyle: categoryTitleStyle,
            categoryTitleAlign: categoryTitleAlign,
            heroStyle: heroStyle,
            detailLayout: detailLayout,
            fontStyle: fontStyle,
            navStyle: navStyle,
            navHeight: navHeight,
            navLayout: navLayout,
            logoStyle: logoStyle,
            backLinkStyle: backLinkStyle,
            buttonStyle: buttonStyle,
            buttonSize: buttonSize,
            gridGap: gridGap,
            animationEnter: animationEnter,
            transitionSpeed: transitionSpeed,
            themePreset: themePreset,
            themePalette: themePalette,
            featuredCard: featuredCard,
            navCategoryLimit: navCategoryLimit,
            homeCategoryLayout: homeCategoryLayout,
            homeCategoryLimit: homeCategoryLimit,
            contactLayout: contactLayout,
            contactFields: contactFields,
            footerStyle: footerStyle,
            footerLinks: footerLinks,
            seed: seed,
            designFingerprint: fingerprint,
            exportVariant: options.variant || state.exportVariant || 'draft',
            assets: assets,
            outputAssets: outputAssets,
            assetBySource: assetBySource,
            localGameFiles: localGameFiles,
            gameOutputAssets: gameOutputAssets,
            packageData: packageData,
            adCode: appState.adCodeMigration && appState.adCodeMigration.valid ? appState.adCodeMigration : null
        };
    }

    function issue(severity, code, message, item) {
        return { severity: severity, code: code, message: message, item: item || '' };
    }

    function englishRatio(value) {
        var text = stripMarkup(value);
        if (!text) return 1;
        var letters = (text.match(/[A-Za-z]/g) || []).length;
        var nonLatin = (text.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
        return letters / Math.max(1, letters + nonLatin * 2);
    }

    function isHighRisk(config) {
        return /(?:medical|health|disease|treatment|legal|law|tax|invest|finance|loan|insurance|emergency|safety)/i.test(config.vertical + ' ' + config.scope);
    }

    async function binaryHash(blob) {
        if (!blob) return '';
        try {
            var buffer = blob.arrayBuffer ? await blob.arrayBuffer() : blob;
            if (typeof crypto !== 'undefined' && crypto.subtle) {
                var digest = await crypto.subtle.digest('SHA-256', buffer);
                return Array.from(new Uint8Array(digest)).map(function (value) { return value.toString(16).padStart(2, '0'); }).join('');
            }
            var bytes = new Uint8Array(buffer);
            var sample = '';
            var stride = Math.max(1, Math.floor(bytes.length / 2048));
            for (var i = 0; i < bytes.length; i += stride) sample += String.fromCharCode(bytes[i]);
            return stableHash(bytes.length + ':' + sample);
        } catch (error) { return ''; }
    }

    async function auditConfig(config) {
        var issues = [];
        var errors = [];
        var warnings = [];
        function add(severity, code, message, item) {
            var finding = issue(severity, code, message, item);
            issues.push(finding);
            (severity === 'BLOCKER' ? errors : warnings).push(finding);
        }
        if (!config.items.length) add('BLOCKER', 'CONTENT_EMPTY', 'No content records were found.');
        if (!config.siteTitle) add('BLOCKER', 'SITE_TITLE_REQUIRED', 'A truthful English site title is required.');
        if (!config.vertical) add('BLOCKER', 'VERTICAL_REQUIRED', 'Define one coherent vertical for this upload.');
        if (englishRatio(config.siteTitle + ' ' + config.vertical + ' ' + config.scope) < 0.92) add('BLOCKER', 'ENGLISH_UI_REQUIRED', 'Published site identity and scope must be English-only.');
        if (!safeUrl(config.baseUrl, false) || isPlaceholderUrl(config.baseUrl)) add('BLOCKER', 'BASE_URL_REQUIRED', 'Review exports require the final canonical HTTPS base URL.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.contactEmail) || /your-domain|example\./i.test(config.contactEmail)) add('BLOCKER', 'CONTACT_REQUIRED', 'Provide a verified publisher-owned contact email.');
        var slugs = {};
        config.items.forEach(function (item) {
            if (!item.title) add('BLOCKER', 'TITLE_REQUIRED', 'Every record needs an English title.', '#' + (item.index + 1));
            if (englishRatio(item.title + ' ' + item.summary + ' ' + item.content) < 0.92) add('BLOCKER', 'ENGLISH_CONTENT_REQUIRED', 'Published content must be English-only.', item.title || '#' + (item.index + 1));
            if (slugs[item.slug]) add('BLOCKER', 'SLUG_DUPLICATE', 'Duplicate lowercase URL slug: ' + item.slug, item.title);
            slugs[item.slug] = true;
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)) add('BLOCKER', 'SLUG_INVALID', 'URL slugs must use lowercase ASCII words separated by hyphens.', item.title);
        });

        if (config.type === 'editorial') {
            if (config.items.length < MIN_EDITORIAL_ITEMS) add('BLOCKER', 'ARTICLE_COUNT', 'Editorial review exports require at least 40 distinct articles; found ' + config.items.length + '.');
            if (config.items.length > MAX_EDITORIAL_ITEMS) add('WARNING', 'ARTICLE_COUNT_ABOVE_RECOMMENDED', 'This package contains ' + config.items.length + ' articles; 40–50 is the recommended review range, so confirm navigation and per-article quality before publishing.');
            var coverPaths = {};
            var imageHashes = {};
            var openingFingerprints = {};
            var closingFingerprints = {};
            for (var e = 0; e < config.items.length; e += 1) {
                var article = config.items[e];
                var words = countEnglishWords(article.content);
                article.wordCount = words;
                if (words < MIN_EDITORIAL_WORDS) add('BLOCKER', 'ARTICLE_TOO_SHORT', 'Article body has ' + words + ' English words; at least ' + MIN_EDITORIAL_WORDS + ' are required.', article.title);
                if (!article.summary || countEnglishWords(article.summary) < 12) add('BLOCKER', 'STANDFIRST_REQUIRED', 'Add a specific standfirst or summary.', article.title);
                if (!article.author) add('BLOCKER', 'ATTRIBUTION_REQUIRED', 'Add truthful editorial attribution; do not invent a person.', article.title);
                if (!article.published) add('BLOCKER', 'PUBLISHED_DATE_REQUIRED', 'Add the real publication date.', article.title);
                if (!article.factChecked) add('BLOCKER', 'FACT_CHECK_REQUIRED', 'Record the real fact-check date or reviewer supplied by the publisher.', article.title);
                var requiredSources = isHighRisk(config) ? 2 : 1;
                if (article.sources.length < requiredSources) add('BLOCKER', 'SOURCES_REQUIRED', 'Add at least ' + requiredSources + ' working authoritative source link' + (requiredSources > 1 ? 's' : '') + '.', article.title);
                if (!article.coverOutput) add('BLOCKER', 'LOCAL_COVER_REQUIRED', 'A unique locally stored cover image is required.', article.title);
                if (!article.imageAlt) add('BLOCKER', 'IMAGE_ALT_REQUIRED', 'Add contextual English alternative text for the cover.', article.title);
                if (article.coverSource) {
                    if (coverPaths[article.coverSource]) add('BLOCKER', 'COVER_PATH_REUSED', 'The same source cover path is used by more than one article.', article.title);
                    coverPaths[article.coverSource] = article.title;
                    var hash = await binaryHash(config.assets[article.coverSource]);
                    article.coverHash = hash;
                    if (hash && imageHashes[hash]) add('BLOCKER', 'COVER_BYTES_REUSED', 'The same underlying cover file is reused by another article.', article.title);
                    if (hash) imageHashes[hash] = article.title;
                }
                var plain = stripMarkup(article.content).toLowerCase();
                var opening = stableHash(plain.slice(0, 420));
                var closing = stableHash(plain.slice(-420));
                if (openingFingerprints[opening]) add('BLOCKER', 'OPENING_DUPLICATE', 'This article repeats another article’s opening structure.', article.title);
                if (closingFingerprints[closing]) add('BLOCKER', 'ENDING_DUPLICATE', 'This article repeats another article’s closing structure.', article.title);
                openingFingerprints[opening] = article.title;
                closingFingerprints[closing] = article.title;
            }
        } else if (config.type === 'tools') {
            if (config.items.length < MIN_TOOL_ITEMS) add('BLOCKER', 'TOOL_COUNT', 'Tool review exports require at least 25 working tools; found ' + config.items.length + '.');
            config.items.forEach(function (tool) {
                if (TOOL_OPERATIONS.indexOf(tool.operation) === -1) add('BLOCKER', 'TOOL_IMPLEMENTATION_UNSUPPORTED', 'Use a supported built-in operation so the tool can be tested and run locally.', tool.title);
                if (tool.exampleInput === '' || tool.exampleInput == null || tool.exampleOutput === '' || tool.exampleOutput == null) add('BLOCKER', 'TOOL_EXAMPLE_REQUIRED', 'Provide example input and expected output.', tool.title);
                if (TOOL_OPERATIONS.indexOf(tool.operation) !== -1 && tool.exampleInput !== '' && tool.exampleInput != null && tool.exampleOutput !== '' && tool.exampleOutput != null) {
                    try {
                        var actualExample = executeToolOperation(tool.operation, tool.exampleInput, tool.options);
                        var normalizedActual = String(actualExample).replace(/\r\n/g, '\n').trim();
                        var normalizedExpected = String(tool.exampleOutput).replace(/\r\n/g, '\n').trim();
                        if (normalizedActual !== normalizedExpected) add('BLOCKER', 'TOOL_EXAMPLE_MISMATCH', 'The supplied example output does not match the real browser-side result.', tool.title);
                    } catch (error) {
                        add('BLOCKER', 'TOOL_EXAMPLE_FAILED', 'The supplied example cannot run: ' + error.message, tool.title);
                    }
                }
                if (countEnglishWords(tool.instructions) < 8) add('BLOCKER', 'TOOL_GUIDE_REQUIRED', 'Provide tool-specific usage guidance.', tool.title);
                if (countEnglishWords(tool.limitations) < 5) add('BLOCKER', 'TOOL_LIMITS_REQUIRED', 'Explain assumptions or limitations.', tool.title);
            });
        } else {
            config.items.forEach(function (game) {
                var localMatch = resolveAsset(config.localGameFiles, game.localEntry);
                game.localEntrySource = localMatch;
                var preservedGamePath = localMatch ? localMatch.match(/(?:^|\/)(games\/[^?#]+)$/i) : null;
                game.localEntryOutput = preservedGamePath ? preservedGamePath[1] : '';
                if (!game.playUrl && !localMatch) add('BLOCKER', 'GAME_NOT_PLAYABLE', 'Provide an HTTPS play URL or a local HTML game entry.', game.title);
                if (!game.controls) add('BLOCKER', 'GAME_CONTROLS_REQUIRED', 'Describe the real controls and how to play.', game.title);
                if (!game.license || (!game.sourceUrl && !game.provider)) add('BLOCKER', 'GAME_RIGHTS_REQUIRED', 'Record the game source/provider and license or usage basis.', game.title);
                if (!game.coverOutput) add('BLOCKER', 'GAME_COVER_REQUIRED', 'Provide a local game cover or screenshot.', game.title);
            });
        }
        if (config.exportVariant === 'ad-ready' && !config.adCode) add('BLOCKER', 'AD_CODE_REQUIRED', 'The advertising export requires a validated ad-code TXT import.');
        if (typeof localStorage !== 'undefined' && readHistory(config.type + ':' + ((config.domain && config.domain.id) || 'base')).indexOf(config.design.id) !== -1) add('WARNING', 'DESIGN_FAMILY_REUSED', 'This design family has been used before; the seed still changes its content rhythm.');
        if (!config.packageData.designReferences || !Array.isArray(config.packageData.designReferences.references)) add('WARNING', 'DESIGN_LEDGER_MISSING', 'No design-reference ledger was supplied; export will record an empty internal-design ledger.');
        return {
            schema_version: 1,
            generated_at: new Date().toISOString(),
            site_type: config.type,
            export_variant: config.exportVariant,
            domain_blueprint: { id: config.design.id, domain_id: config.domain.id, domain: config.domain.name },
            verdict: errors.length ? (config.exportVariant === 'draft' ? 'DRAFT WITH BLOCKERS' : 'BLOCKED') : 'READY FOR HUMAN REVIEW',
            counts: { records: config.items.length, blockers: errors.length, warnings: warnings.length },
            design_fingerprint: config.designFingerprint,
            issues: issues,
            limitations: [
                'Automated checks do not prove factual accuracy, originality, rights ownership, policy compliance, ranking, or AdSense approval.',
                'A human publisher must re-open sources, fact-check claims, verify rights, and review the deployed site before monetization.'
            ]
        };
    }

    async function audit(appState, options) {
        var config = buildConfig(appState, options);
        var report = await auditConfig(config);
        return { config: config, report: report };
    }

    function renderAuditSummary(report) {
        var tone = report.counts.blockers ? 'invalid' : '';
        var top = report.issues.slice(0, 12).map(function (finding) {
            return '<li><strong>' + escapeHtml(finding.severity) + '</strong> · ' + escapeHtml(finding.message) + (finding.item ? ' <span>— ' + escapeHtml(finding.item) + '</span>' : '') + '</li>';
        }).join('');
        return '<section class="migration-validation quality-gate ' + tone + '"><h5>差异化精品建站质量门禁：' + escapeHtml(report.verdict) + '</h5>' +
            '<p>' + report.counts.records + ' 条内容 · ' + report.counts.blockers + ' 个阻断项 · ' + report.counts.warnings + ' 个提醒</p>' +
            (top ? '<ul>' + top + '</ul>' : '<p>自动硬门禁已通过，仍需人工核验事实、来源、版权、部署与广告政策。</p>') + '</section>';
    }

    function sanitizeRichHtml(value) {
        var allowed = { p: true, h2: true, h3: true, h4: true, ul: true, ol: true, li: true, blockquote: true, table: true, thead: true, tbody: true, tr: true, th: true, td: true, strong: true, em: true, b: true, i: true, a: true, code: true, pre: true, br: true, hr: true };
        var dangerous = /<(script|style|iframe|object|embed|form|button|input|select|textarea|meta|link|base|svg|math|canvas)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
        var cleaned = String(value == null ? '' : value).replace(/<!--[\s\S]*?-->/g, '').replace(dangerous, '');
        return cleaned.replace(/<[^>]*>/g, function (tag) {
            var closing = tag.match(/^<\s*\/\s*([a-z0-9]+)\s*>$/i);
            if (closing) return allowed[closing[1].toLowerCase()] ? '</' + closing[1].toLowerCase() + '>' : '';
            var opening = tag.match(/^<\s*([a-z0-9]+)\b/i);
            if (!opening) return '';
            var name = opening[1].toLowerCase();
            if (!allowed[name]) return '';
            if (name === 'br' || name === 'hr') return '<' + name + '>';
            if (name !== 'a') return '<' + name + '>';
            var hrefMatch = tag.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
            var href = hrefMatch ? (hrefMatch[1] || hrefMatch[2] || hrefMatch[3] || '') : '';
            var safeHref = /^#[a-z][a-z0-9_-]*$/i.test(href) ? href : safeUrl(href, true);
            return safeHref ? '<a href="' + escapeHtml(safeHref) + '" rel="noopener noreferrer">' : '<a>';
        });
    }

    function markdownToHtml(value) {
        var text = String(value == null ? '' : value).replace(/\r\n/g, '\n');
        if (/<(?:p|h2|h3|ul|ol|blockquote|table)\b/i.test(text)) {
            return sanitizeRichHtml(text);
        }
        var escaped = escapeHtml(text);
        var blocks = escaped.split(/\n{2,}/).map(function (block) {
            var trimmed = block.trim();
            if (!trimmed) return '';
            if (/^###\s+/.test(trimmed)) return '<h3>' + trimmed.replace(/^###\s+/, '') + '</h3>';
            if (/^##\s+/.test(trimmed)) return '<h2>' + trimmed.replace(/^##\s+/, '') + '</h2>';
            var lines = trimmed.split('\n');
            if (lines.every(function (line) { return /^[-*]\s+/.test(line); })) return '<ul>' + lines.map(function (line) { return '<li>' + line.replace(/^[-*]\s+/, '') + '</li>'; }).join('') + '</ul>';
            return '<p>' + trimmed.replace(/\n/g, '<br>') + '</p>';
        }).join('');
        return blocks.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
    }

    function canonical(config, path) {
        return config.baseUrl ? config.baseUrl + '/' + String(path || '').replace(/^\/+/, '') : '';
    }

    function prefixFor(path) {
        var clean = String(path || '').replace(/^\/+|\/+$/g, '');
        if (!clean) return '';
        var depth = clean.split('/').length - (/\.html$/i.test(clean) ? 1 : 0);
        return '../'.repeat(depth);
    }

    function pageHead(config, page) {
        var title = page.title + (page.title === config.siteTitle ? '' : ' — ' + config.siteTitle);
        var description = stripMarkup(page.description || config.scope).slice(0, 158);
        var canonicalUrl = canonical(config, page.path);
        var image = page.image ? canonical(config, page.image) : '';
        var structured = page.structured ? '<script type="application/ld+json">' + JSON.stringify(page.structured).replace(/</g, '\\u003c') + '</script>' : '';
        return '<!doctype html><html lang="en" data-layout="' + escapeHtml(config.design.layout) + '" data-direction="' + escapeHtml(config.design.direction || '') + '" data-domain-mode="' + escapeHtml(config.design.domainMode || 'reference') + '" data-tone="' + escapeHtml(config.design.tone) + '"><head>' +
            '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
            '<title>' + escapeHtml(title) + '</title><meta name="description" content="' + escapeHtml(description) + '">' +
            (canonicalUrl ? '<link rel="canonical" href="' + escapeHtml(canonicalUrl) + '">' : '') +
            '<meta property="og:title" content="' + escapeHtml(title) + '"><meta property="og:description" content="' + escapeHtml(description) + '"><meta property="og:type" content="' + (page.kind === 'article' ? 'article' : 'website') + '">' +
            (image ? '<meta property="og:image" content="' + escapeHtml(image) + '">' : '') +
            '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="' + escapeHtml(config.typography.url) + '">' +
            '<link rel="stylesheet" href="' + prefixFor(page.path) + 'assets/site.css">' + structured + '</head>';
    }

    function nav(config, path) {
        var prefix = prefixFor(path);
        var categoryLinks = config.categories.slice(0, config.navCategoryLimit || 4).map(function (category) {
            var categoryPath = 'sections/' + category.slug + '/index.html';
            return '<a href="' + prefix + categoryPath + '"' + (path === categoryPath ? ' aria-current="page"' : '') + '>' + escapeHtml(category.name) + '</a>';
        }).join('');
        var logoText = '<span class="brand-text">' + escapeHtml(config.siteTitle) + '</span>';
        var logoMark = '<span class="brand-mark mark-' + escapeHtml(config.brandMark.id) + '" aria-hidden="true">' + escapeHtml(config.brandMark.glyph) + '</span>';
        var logo = config.logoStyle === 'mark' ? logoMark : config.logoStyle === 'text' ? logoText : logoMark + logoText;
        return '<a class="skip-link" href="#main">Skip to content</a><header class="site-header nav-layout-' + escapeHtml(config.navLayout || 'split') + ' nav-style-' + escapeHtml(config.navStyle || 'glass') + ' nav-height-' + escapeHtml(config.navHeight || 'regular') + '"><a class="brand brand-' + escapeHtml(config.logoStyle || 'mark-text') + '" href="' + prefix + 'index.html" aria-label="' + escapeHtml(config.siteTitle) + ' home">' + logo + '</a><button class="nav-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="site-nav">Menu</button><nav id="site-nav" aria-label="Primary"><a href="' + prefix + 'index.html"' + (!path ? ' aria-current="page"' : '') + '>Home</a>' + categoryLinks + '</nav></header>';
    }

    function footer(config, path) {
        var prefix = prefixFor(path);
        var destinations = {
            privacy: { path: 'privacy/index.html', label: 'Privacy Policy' },
            terms: { path: 'terms/index.html', label: 'Terms of Use' },
            contact: { path: 'contact/index.html', label: 'Contact' },
            about: { path: 'about/index.html', label: 'About' }
        };
        var links = (config.footerLinks || []).filter(function (key) { return destinations[key]; }).map(function (key) {
            return '<a href="' + prefix + destinations[key].path + '">' + destinations[key].label + '</a>';
        }).join('');
        var detail = config.footerStyle === 'detailed'
            ? '<p class="footer-contact">Questions or corrections: ' + (config.contactEmail ? '<a href="mailto:' + escapeHtml(config.contactEmail) + '">' + escapeHtml(config.contactEmail) + '</a>' : 'add a verified publisher contact before deployment') + '</p>'
            : '';
        return '<footer class="site-footer site-footer-' + escapeHtml(config.footerStyle || 'simple') + '"><div><p><strong>' + escapeHtml(config.siteTitle) + '</strong></p>' + (config.footerStyle === 'detailed' ? '<p>' + escapeHtml(config.scope) + '</p>' : '') + '</div><nav aria-label="Site information">' + links + '<a href="' + prefix + 'editorial-standards/index.html">Editorial standards</a></nav>' + detail + '<p>© <span data-current-year></span> ' + escapeHtml(config.siteTitle) + '</p></footer><script src="' + prefix + 'assets/site.js" defer></script>';
    }

    function adBlock(config, slot) {
        if (config.exportVariant !== 'ad-ready' || !config.adCode) return '';
        return '<aside class="ad-region" aria-label="Advertisement"><span>Advertisement</span><div id="div-gpt-ad-banner' + slot + '"></div></aside>';
    }

    function shell(config, page, body) {
        var pageType = !page.path ? 'home' : page.path.indexOf('sections/') === 0 ? 'section' : 'utility';
        return pageHead(config, page) + '<body data-page-type="' + pageType + '" data-home-intro="' + escapeHtml(config.homeIntro || 'compact') + '" data-density="' + escapeHtml(config.contentDensity || 'comfortable') + '" data-card-radius="' + escapeHtml(config.cardRadius || 'auto') + '">' + nav(config, page.path) + '<main id="main">' + body + '</main>' + footer(config, page.path) + '</body></html>';
    }

    function coverMarkup(config, item, prefix, eager) {
        if (!item.coverOutput) return '<div class="cover-missing" aria-hidden="true">' + escapeHtml(config.vertical.slice(0, 2).toUpperCase()) + '</div>';
        return '<img src="' + prefix + item.coverOutput + '" alt="' + escapeHtml(item.imageAlt) + '" width="1280" height="720" loading="' + (eager ? 'eager' : 'lazy') + '" decoding="async" data-cover-fit="' + escapeHtml(config.coverFit || 'smart') + '">';
    }

    function itemPath(config, item) {
        return (config.type === 'editorial' ? 'articles/' : config.type === 'tools' ? 'tools/' : 'games/') + item.slug + '/index.html';
    }

    function card(config, item, featured, prefix) {
        prefix = prefix || '';
        var summary = config.summaryMode === 'hidden' ? '' : '<p>' + escapeHtml(item.summary) + '</p>';
        return '<a class="content-card' + (featured ? ' featured' : '') + '" href="' + prefix + itemPath(config, item) + '"><figure>' + coverMarkup(config, item, prefix, featured) + '</figure><div class="card-copy"><span class="eyebrow">' + escapeHtml(item.category) + '</span><h2>' + escapeHtml(item.title) + '</h2>' + summary + '<span class="card-action">' + (config.type === 'editorial' ? 'Read the article' : config.type === 'tools' ? 'Open the tool' : 'View game details') + ' <span aria-hidden="true">→</span></span></div></a>';
    }

    function homePage(config) {
        var cards = config.items.map(function (item, index) { return card(config, item, config.featuredCard === 'highlight' && index === 0); }).join('');
        var counts = config.type === 'editorial' ? config.items.length + ' articles loaded' : config.type === 'tools' ? config.items.length + ' tool records loaded' : config.items.length + ' game records loaded';
        var intro = config.homeIntro === 'hidden' ? '' : '<section class="publication-intro"><p class="kicker">' + escapeHtml(config.vertical) + '</p><h1>' + escapeHtml(config.siteTitle) + '</h1><p class="dek">' + escapeHtml(config.scope) + '</p><div class="edition-meta"><span>' + escapeHtml(counts) + '</span><span>For ' + escapeHtml(config.audience) + '</span><span>Design: ' + escapeHtml(config.design.name) + '</span></div></section>';
        var groupedSections = '';
        if (config.homeCategoryLayout) {
            groupedSections = config.categories.slice(0, config.homeCategoryLimit || 4).map(function(category) {
                var selected = config.items.filter(function(item) { return item.categorySlug === category.slug; }).slice(0, Math.max(1, Number(category.homeCount) || 1));
                if (!selected.length) return '';
                var categoryCards = selected.map(function(item) { return card(config, item, false); }).join('');
                var categoryLabel = (category.icon ? category.icon + ' ' : '') + category.name;
                var moreLink = selected.length < category.count ? '<a class="home-category-more" href="sections/' + escapeHtml(category.slug) + '/index.html">View all <span aria-hidden="true">→</span></a>' : '';
                return '<section class="home-category-section" data-home-category="' + escapeHtml(category.slug) + '" aria-labelledby="home-category-' + escapeHtml(category.slug) + '"><header class="home-category-heading"><div><p class="kicker">Section</p><h2 id="home-category-' + escapeHtml(category.slug) + '">' + escapeHtml(categoryLabel) + '</h2></div>' + moreLink + '</header><div class="content-grid home-category-grid" aria-label="' + escapeHtml(category.name) + ' content">' + categoryCards + '</div></section>';
            }).join('');
        }
        var content = groupedSections ? '<div class="home-category-sections">' + groupedSections + '</div>' : '<section class="content-grid" aria-label="Latest content">' + cards + '</section>';
        var body = intro + adBlock(config, 1) + content + adBlock(config, 2);
        return shell(config, { title: config.siteTitle, description: config.scope, path: '', kind: 'website' }, body);
    }

    function sourcesMarkup(item) {
        if (!item.sources.length) return '';
        return '<section class="sources"><h2>Sources</h2><ol>' + item.sources.map(function (source) {
            return '<li><a href="' + escapeHtml(source.url) + '" rel="noopener noreferrer">' + escapeHtml(source.title || source.publisher || source.url) + '</a>' + (source.publisher ? ' — ' + escapeHtml(source.publisher) : '') + '</li>';
        }).join('') + '</ol></section>';
    }

    function articlePage(config, item) {
        var path = itemPath(config, item);
        var prefix = prefixFor(path);
        var structured = config.baseUrl ? {
            '@context': 'https://schema.org', '@type': 'Article', headline: item.title,
            description: item.summary, datePublished: item.published || undefined,
            dateModified: item.updated || item.published || undefined,
            author: item.author ? { '@type': 'Organization', name: item.author } : undefined,
            image: item.coverOutput ? canonical(config, item.coverOutput) : undefined,
            mainEntityOfPage: canonical(config, path)
        } : null;
        var body = '<a class="back-link back-link-' + escapeHtml(config.backLinkStyle || 'arrow') + '" href="' + prefix + 'index.html">← Back to Home</a><article class="article"><header><p class="kicker">' + escapeHtml(item.category) + '</p><h1>' + escapeHtml(item.title) + '</h1><p class="standfirst">' + escapeHtml(item.summary) + '</p><div class="byline"><span>' + escapeHtml(item.author || 'Publisher editorial desk') + '</span>' + (item.published ? '<time datetime="' + escapeHtml(item.published) + '">Published ' + escapeHtml(item.published) + '</time>' : '') + (item.updated ? '<time datetime="' + escapeHtml(item.updated) + '">Updated ' + escapeHtml(item.updated) + '</time>' : '') + '</div></header><figure class="article-cover">' + coverMarkup(config, item, prefix, true) + '</figure><div class="article-body">' + markdownToHtml(item.content) + '</div>' + adBlock(config, 3) + sourcesMarkup(item) + '</article>';
        return shell(config, { title: item.title, description: item.summary, path: path, kind: 'article', image: item.coverOutput, structured: structured }, body);
    }

    function toolPage(config, item) {
        var path = itemPath(config, item);
        var prefix = prefixFor(path);
        var optionValue = Object.keys(item.options || {}).length ? JSON.stringify(item.options) : '';
        var optionExample = optionValue ? '<div><dt>Options</dt><dd><code>' + escapeHtml(optionValue) + '</code></dd></div>' : '';
        var body = '<a class="back-link back-link-' + escapeHtml(config.backLinkStyle || 'arrow') + '" href="' + prefix + 'index.html">← Back to Home</a><article class="tool-detail"><header><p class="kicker">' + escapeHtml(item.category) + '</p><h1>' + escapeHtml(item.title) + '</h1><p class="standfirst">' + escapeHtml(item.summary) + '</p></header><section class="tool-workbench" data-tool-operation="' + escapeHtml(item.operation) + '"><form><label for="tool-input">Input</label><textarea id="tool-input" name="input" rows="8" spellcheck="false">' + escapeHtml(item.exampleInput) + '</textarea><label for="tool-options">Options (optional JSON)</label><input id="tool-options" name="options" type="text" inputmode="text" value="' + escapeHtml(optionValue) + '" placeholder="{}"><div class="tool-actions"><button type="submit">Run tool</button><button type="reset">Reset</button></div></form><section class="tool-result" aria-live="polite" aria-atomic="true"><h2>Result</h2><pre data-tool-output>' + escapeHtml(item.exampleOutput) + '</pre></section></section><section class="tool-guide"><h2>How to use it</h2>' + markdownToHtml(item.instructions) + '<h2>Example</h2><dl><div><dt>Input</dt><dd><code>' + escapeHtml(item.exampleInput) + '</code></dd></div>' + optionExample + '<div><dt>Expected output</dt><dd><code>' + escapeHtml(item.exampleOutput) + '</code></dd></div></dl><h2>Assumptions and limitations</h2>' + markdownToHtml(item.limitations) + '</section>' + adBlock(config, 3) + sourcesMarkup(item) + '</article>';
        return shell(config, { title: item.title, description: item.summary, path: path, kind: 'website' }, body);
    }

    function gamePage(config, item) {
        var path = itemPath(config, item);
        var prefix = prefixFor(path);
        var playHref = item.localEntryOutput ? prefix + item.localEntryOutput : item.playUrl;
        var external = !item.localEntryOutput;
        var body = '<a class="back-link back-link-' + escapeHtml(config.backLinkStyle || 'arrow') + '" href="' + prefix + 'index.html">← Back to Home</a><article class="game-detail"><header><p class="kicker">' + escapeHtml(item.category) + '</p><h1>' + escapeHtml(item.title) + '</h1><p class="standfirst">' + escapeHtml(item.summary) + '</p></header><figure class="article-cover">' + coverMarkup(config, item, prefix, true) + '</figure><section class="game-launch"><h2>Play</h2><p>This link opens the real game ' + (external ? 'on the named external provider.' : 'from the local static package.') + '</p><a class="play-button" href="' + escapeHtml(playHref) + '"' + (external ? ' target="_blank" rel="noopener noreferrer"' : '') + '>Play ' + escapeHtml(item.title) + '</a></section><section class="game-guide"><h2>How to play</h2><p>' + escapeHtml(item.controls) + '</p>' + (item.tips.length ? '<h2>Tips</h2><ul>' + item.tips.map(function (tip) { return '<li>' + escapeHtml(tip) + '</li>'; }).join('') + '</ul>' : '') + '<h2>Source and usage</h2><p>' + escapeHtml(item.provider || 'Source publisher') + ' · ' + escapeHtml(item.license || 'Usage basis not supplied') + (item.sourceUrl ? ' · <a href="' + escapeHtml(item.sourceUrl) + '" rel="noopener noreferrer">Source record</a>' : '') + '</p></section>' + adBlock(config, 3) + '</article>';
        return shell(config, { title: item.title, description: item.summary, path: path, kind: 'website', image: item.coverOutput }, body);
    }

    function sectionPage(config, category) {
        var path = 'sections/' + category.slug + '/index.html';
        var prefix = prefixFor(path);
        var subset = config.items.filter(function (item) { return item.categorySlug === category.slug; });
        var cards = subset.map(function (item) { return card(config, item, false, prefix); }).join('');
        var body = '<a class="back-link back-link-' + escapeHtml(config.backLinkStyle || 'arrow') + '" href="' + prefix + 'index.html">← Back to Home</a><header class="section-heading"><p class="kicker">Section</p><h1>' + escapeHtml(category.name) + '</h1><p>' + subset.length + ' focused entries from ' + escapeHtml(config.siteTitle) + '.</p></header><section class="content-grid">' + cards + '</section>';
        return shell(config, { title: category.name, description: category.name + ' resources from ' + config.siteTitle, path: path, kind: 'website' }, body);
    }

    function standardPage(config, key) {
        var path = key + '/index.html';
        var prefix = prefixFor(path);
        var title = { about: 'About', contact: 'Contact', privacy: 'Privacy Policy', terms: 'Terms of Use', 'editorial-standards': 'Editorial Standards' }[key];
        var contactReference = config.contactEmail
            ? '<a href="mailto:' + escapeHtml(config.contactEmail) + '">' + escapeHtml(config.contactEmail) + '</a>'
            : 'the verified contact method that must be added before deployment';
        var content = '';
        if (key === 'about') content = '<p>' + escapeHtml(config.siteTitle) + ' is an independent English-language ' + escapeHtml(config.type) + ' publication focused on ' + escapeHtml(config.vertical) + '.</p><h2>Audience and scope</h2><p>It is created for ' + escapeHtml(config.audience) + '. ' + escapeHtml(config.scope) + '</p><h2>How this site is produced</h2><p>Each published record is supplied by the publisher, checked against the site’s quality report, and reviewed before deployment. Automation may assist production, but it does not replace factual, rights, or editorial review.</p>';
        if (key === 'contact') {
            var fieldLabels = { name: 'Name', email: 'Email', subject: 'Subject', message: 'Message' };
            var formFields = (config.contactFields || []).map(function (field) {
                if (!fieldLabels[field]) return '';
                if (field === 'message') return '<label for="contact-message">Message<textarea id="contact-message" name="message" rows="7" required></textarea></label>';
                return '<label for="contact-' + field + '">' + fieldLabels[field] + '<input id="contact-' + field + '" name="' + field + '" type="' + (field === 'email' ? 'email' : 'text') + '"' + (field === 'email' ? ' required' : '') + '></label>';
            }).join('');
            var directContact = config.contactEmail
                ? '<div class="contact-method"><p class="kicker">Publisher contact</p><h2>Send an email</h2><p>Questions, corrections, rights requests, and privacy inquiries are welcome at <a href="mailto:' + escapeHtml(config.contactEmail) + '">' + escapeHtml(config.contactEmail) + '</a>.</p><a class="contact-email-link" href="mailto:' + escapeHtml(config.contactEmail) + '">Email the publisher</a></div>'
                : '<div class="contact-method"><p class="kicker">Publisher contact</p><h2>Contact method required</h2><p>This draft does not yet contain a verified publisher contact method and must not be deployed until one is supplied.</p></div>';
            var form = config.contactEmail && config.contactLayout !== 'direct' && formFields
                ? '<form class="contact-form" action="mailto:' + escapeHtml(config.contactEmail) + '" method="post" enctype="text/plain"><p class="kicker">Email draft</p><h2>Write your message</h2>' + formFields + '<button type="submit">Open email draft</button><p class="form-note">This static form opens your email app. Nothing is sent until you review and send the email there.</p></form>'
                : '';
            content = '<div class="contact-page contact-layout-' + escapeHtml(config.contactLayout || 'split') + '">' + directContact + form + '</div>';
        }
        if (key === 'privacy') content = '<p>This policy describes the features in this exported site. The site itself does not require an account. Interactive utilities run in the browser unless a tool page explicitly identifies an external provider.</p><h2>Server logs and contact</h2><p>The hosting provider may process standard request information such as IP address, requested URL, browser details, and timestamps. If you email the publisher, the publisher receives the information you choose to send.</p><h2>Advertising and Google</h2><p>' + (config.exportVariant === 'ad-ready' ? 'This export includes publisher-supplied Google advertising configuration. Google and its partners may use cookies or other identifiers to deliver, measure, and personalize advertising in accordance with their policies.' : 'This export does not include advertising code. If advertising is enabled later, this policy must be reviewed against the deployed implementation before launch.') + '</p><ul><li><a href="' + GOOGLE_OPT_OUT_URL + '">Turn off personalized ads in My Ad Center</a></li><li><a href="' + GOOGLE_PARTNER_URL + '">How Google uses information from sites or apps that use its services</a></li></ul><h2>Your choices</h2><p>You can use browser controls to manage cookies and contact the publisher through ' + contactReference + ' about site-specific privacy questions.</p>';
        if (key === 'terms') content = '<p>Use this site for lawful personal reference. Do not interfere with its operation, misrepresent its content, or reuse protected text, artwork, game code, or tool implementations without the relevant permission.</p><h2>Content and tools</h2><p>Information is provided for general educational purposes. Tools can contain assumptions and rounding rules described on their pages. External games and links remain subject to their providers’ terms and availability.</p><h2>No guarantee</h2><p>The publisher works to keep content useful and accurate but does not promise uninterrupted availability or suitability for every purpose. Use ' + contactReference + ' for a correction or rights request.</p>';
        if (key === 'editorial-standards') content = '<p>Every item should serve a distinct reader need, use accurate English, and disclose meaningful sources, assumptions, limitations, rights, and update information.</p><h2>Evidence and corrections</h2><p>Source links must be opened and checked before publication. Numerical, time-sensitive, safety-related, or contested claims need stronger corroboration. Corrections should be substantive and should not silently rewrite dates.</p><h2>Automation</h2><p>Automated generation and auditing are production aids only. A human publisher remains responsible for factual review, originality, licensing, privacy accuracy, and the final deployed experience.</p>';
        var body = '<a class="back-link back-link-' + escapeHtml(config.backLinkStyle || 'arrow') + '" href="' + prefix + 'index.html">← Back to Home</a><article class="standard-page standard-page-' + escapeHtml(key) + '"><p class="kicker">' + escapeHtml(config.siteTitle) + '</p><h1>' + title + '</h1>' + content + '</article>';
        return shell(config, { title: title, description: title + ' for ' + config.siteTitle, path: path, kind: 'website' }, body);
    }

    function notFoundPage(config) {
        var path = '404/index.html';
        var prefix = prefixFor(path);
        return shell(config, { title: 'Page not found', description: 'The requested page could not be found.', path: path, kind: 'website' }, '<section class="empty-state"><p class="kicker">404</p><h1>Page not found</h1><p>The address may be outdated or incomplete.</p><a class="play-button" href="' + prefix + 'index.html">Back to Home</a></section>');
    }

    function paletteCss() {
        return ':root{--paper:#f4f0e7;--surface:#fffdf8;--ink:#16202a;--muted:#5d6872;--accent:#c84b31;--accent2:#244f8f;--line:#cfc7b8;--shadow:0 18px 50px rgba(27,35,42,.1);--radius:18px;--measure:72ch}html[data-tone="ink-coral"]{--paper:#f3eee6;--surface:#fffaf3;--ink:#1b2028;--muted:#65707a;--accent:#c84b31;--accent2:#7a3044;--line:#d5c7b7}html[data-tone="paper-olive"]{--paper:#f2f0e4;--accent:#66733d;--accent2:#303b26}html[data-tone="canvas-forest"]{--paper:#e8e3d5;--surface:#f7f2e6;--accent:#275844;--accent2:#8c542d}html[data-tone="stone-wine"]{--paper:#ebe8e2;--surface:#f8f6f1;--accent:#793b4a;--accent2:#384050}html[data-tone="slate-cyan"]{--paper:#101820;--surface:#17242e;--ink:#eef9f6;--muted:#a8bbb8;--accent:#62d2bd;--accent2:#f0bc5d;--line:#35505b;--shadow:0 20px 60px rgba(0,0,0,.25)}html[data-tone="cream-cobalt"]{--paper:#f4ecd9;--surface:#fff9e9;--accent:#234fa2;--accent2:#d3562f}html[data-tone="paper-blue"]{--paper:#edf3f7;--surface:#fff;--accent:#1769aa;--accent2:#20344e}html[data-tone="canvas-orange"]{--paper:#f0e9dc;--surface:#fffaf1;--accent:#a74624;--accent2:#304a45}html[data-tone="ink-lime"]{--paper:#111513;--surface:#1a211e;--ink:#f5ffe7;--muted:#b7c8ad;--accent:#b8f34a;--accent2:#55b9ff;--line:#3b463e;--shadow:0 20px 60px rgba(0,0,0,.28)}';
    }

    // Each layout is a complete editorial system, not a colour preset.  The
    // rules are deliberately appended after the configurable component CSS so
    // legacy grid spans cannot create empty tracks in a generated home page.
    function layoutSystemCss() {
        return [
            '@media(min-width:681px){',
            'html[data-layout] .content-card,html[data-layout] .content-card.featured,html[data-layout] .content-card:nth-child(n){grid-column:auto;grid-row:auto;min-width:0;height:auto;align-self:stretch;overflow:hidden;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);box-shadow:var(--shadow)}',
            'html[data-layout] .content-card figure,html[data-layout] .content-card.featured figure{width:100%;height:auto;min-height:0;max-height:none;margin:0;border:0;border-radius:0;background:color-mix(in srgb,var(--accent) 12%,var(--surface));box-shadow:none}',
            'html[data-layout] .content-card img,html[data-layout] .content-card.featured img{display:block;width:100%;height:100%;min-height:0;object-fit:cover}',
            'html[data-layout] .content-card .card-copy{width:100%;min-width:0;min-height:0;border:0;border-radius:0;background:transparent;box-shadow:none}',

            /* Magazine front: a photographic cover story followed by flexible columns. */
            'html[data-layout="lead-grid"] .site-header{border-bottom:3px solid var(--accent)}',
            'html[data-layout="lead-grid"] .publication-intro{grid-template-columns:minmax(0,1.2fr) minmax(260px,.8fr);padding:24px 0;border-top:6px solid var(--ink);border-bottom:1px solid var(--line)}',
            'html[data-layout="lead-grid"] .publication-intro h1{max-width:10ch;font-size:clamp(3rem,7vw,6.5rem);line-height:.92}',
            'html[data-layout="lead-grid"] .content-grid{display:flex;flex-wrap:wrap;align-items:stretch;gap:var(--diff-gap)}',
            'html[data-layout="lead-grid"] .content-card,html[data-layout="lead-grid"] .content-card.featured,html[data-layout="lead-grid"] .content-card:nth-child(n){display:flex;flex:1 1 290px;border-radius:0;box-shadow:none;border-top:5px solid var(--accent)}',
            'html[data-layout="lead-grid"] .content-card.featured{position:relative;display:block;flex:1 0 100%;height:auto;min-height:0;border:0;border-radius:0;background:var(--ink)}',
            'html[data-layout="lead-grid"] .content-card.featured figure{height:auto;min-height:0;aspect-ratio:21/9}',
            'html[data-layout="lead-grid"] .content-card.featured figure:after{content:"";position:absolute;inset:32% 0 0;background:linear-gradient(transparent,color-mix(in srgb,var(--ink) 92%,transparent))}',
            'html[data-layout="lead-grid"] .content-card:not(.featured) figure{aspect-ratio:16/10}',
            'html[data-layout="lead-grid"] .content-card.featured .card-copy{position:absolute;left:0;right:0;bottom:0;width:min(760px,78%);padding:clamp(24px,5vw,60px);color:#fff;text-shadow:0 1px 12px rgba(0,0,0,.3)}',
            'html[data-layout="lead-grid"] .content-card.featured .eyebrow,html[data-layout="lead-grid"] .content-card.featured .card-action{color:#fff}',
            'html[data-layout="lead-grid"] .content-card:not(.featured) .card-copy{flex:1}',
            'html[data-layout="lead-grid"] .content-card h2{font-size:clamp(1.35rem,2vw,2rem)}',

            /* Quiet monograph: a restrained, numbered reading index. */
            'html[data-layout="rail-index"] main{max-width:1180px}',
            'html[data-layout="rail-index"] .site-header{border-bottom:1px solid var(--ink);box-shadow:none}',
            'html[data-layout="rail-index"] .publication-intro{grid-template-columns:minmax(160px,.35fr) minmax(0,1fr);align-items:start;padding:clamp(24px,4vw,48px) 0;border-bottom:1px solid var(--ink)}',
            'html[data-layout="rail-index"] .publication-intro .kicker{grid-column:1}',
            'html[data-layout="rail-index"] .publication-intro h1{grid-column:2;font-size:clamp(2.8rem,7vw,6.4rem);font-weight:500;line-height:.98}',
            'html[data-layout="rail-index"] .publication-intro .dek,html[data-layout="rail-index"] .publication-intro .edition-meta{grid-column:2}',
            'html[data-layout="rail-index"] .content-grid{display:grid;grid-template-columns:1fr;gap:0;border-top:2px solid var(--ink);counter-reset:monograph}',
            'html[data-layout="rail-index"] .content-card,html[data-layout="rail-index"] .content-card.featured,html[data-layout="rail-index"] .content-card:nth-child(n){display:grid;grid-template-columns:minmax(180px,28%) minmax(0,1fr);align-items:center;padding:clamp(18px,3vw,30px) 0;border-width:0 0 1px;border-radius:0;background:transparent;box-shadow:none;counter-increment:monograph}',
            'html[data-layout="rail-index"] .content-card figure{aspect-ratio:4/3}',
            'html[data-layout="rail-index"] .content-card .card-copy{position:relative;padding:8px clamp(22px,5vw,64px)}',
            'html[data-layout="rail-index"] .content-card .card-copy:before{content:counter(monograph,decimal-leading-zero);position:absolute;top:10px;right:0;color:var(--line);font:500 clamp(2.2rem,5vw,5rem)/1 var(--font-display)}',
            'html[data-layout="rail-index"] .content-card h2{max-width:18ch;font-size:clamp(1.55rem,3vw,2.75rem);font-weight:500}',
            'html[data-layout="rail-index"] .card-action{margin-top:8px;text-decoration:underline}',

            /* Field notebook: paired specimen sheets with one shared geometry. */
            'html[data-layout="banded-list"] body{background-image:linear-gradient(color-mix(in srgb,var(--line) 35%,transparent) 1px,transparent 1px);background-size:100% 32px}',
            'html[data-layout="banded-list"] .site-header{border-bottom:1px dashed var(--accent)}',
            'html[data-layout="banded-list"] .publication-intro{padding:clamp(24px,4vw,48px);border:1px dashed var(--line);background:var(--surface);box-shadow:8px 8px 0 color-mix(in srgb,var(--accent) 20%,transparent)}',
            'html[data-layout="banded-list"] .publication-intro h1{font-size:clamp(2.8rem,7vw,6.2rem)}',
            'html[data-layout="banded-list"] .content-grid{display:flex;flex-wrap:wrap;align-items:stretch;gap:var(--diff-gap)}',
            'html[data-layout="banded-list"] .content-card,html[data-layout="banded-list"] .content-card.featured,html[data-layout="banded-list"] .content-card:nth-child(n){display:flex;flex:1 1 calc(50% - var(--diff-gap));min-width:min(100%,340px);border-style:dashed;border-radius:calc(var(--radius) * .35);box-shadow:6px 6px 0 color-mix(in srgb,var(--ink) 10%,transparent)}',
            'html[data-layout="banded-list"] .content-card figure{aspect-ratio:3/2;border-bottom:1px dashed var(--line)}',
            'html[data-layout="banded-list"] .content-card .card-copy{flex:1}',
            'html[data-layout="banded-list"] .content-card .eyebrow,html[data-layout="banded-list"] .card-action{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}',
            'html[data-layout="banded-list"] .content-card:last-child:nth-child(odd){display:grid;flex-basis:100%;grid-template-columns:minmax(280px,.8fr) minmax(0,1.2fr)}',
            'html[data-layout="banded-list"] .content-card:last-child:nth-child(odd) figure{height:100%;aspect-ratio:auto;border-right:1px dashed var(--line);border-bottom:0}',

            /* Museum catalog: dense accession tiles with strict square modules. */
            'html[data-layout="catalog-grid"] .site-header{border-top:8px solid var(--ink);border-bottom:2px solid var(--ink);box-shadow:none}',
            'html[data-layout="catalog-grid"] .brand,html[data-layout="catalog-grid"] .site-header nav{font-family:var(--font-body);text-transform:uppercase;letter-spacing:.08em}',
            'html[data-layout="catalog-grid"] .publication-intro{grid-template-columns:1fr 1fr;padding-bottom:24px;border-bottom:2px solid var(--ink)}',
            'html[data-layout="catalog-grid"] .publication-intro h1{font-size:clamp(2.6rem,6vw,5.8rem);text-transform:uppercase;letter-spacing:-.035em}',
            'html[data-layout="catalog-grid"] .content-grid{display:flex;flex-wrap:wrap;align-items:stretch;gap:1px;padding:1px;background:var(--ink);counter-reset:catalog}',
            'html[data-layout="catalog-grid"] .content-card,html[data-layout="catalog-grid"] .content-card.featured,html[data-layout="catalog-grid"] .content-card:nth-child(n){display:flex;flex:1 1 calc(25% - 1px);min-width:220px;max-width:none;padding:14px;border:0;border-radius:0;background:var(--surface);box-shadow:none;counter-increment:catalog}',
            'html[data-layout="catalog-grid"] .content-card figure{aspect-ratio:1;border:1px solid var(--line)}',
            'html[data-layout="catalog-grid"] .content-card .card-copy{flex:1;padding:16px 2px 4px}',
            'html[data-layout="catalog-grid"] .content-card .card-copy:before{content:"Accession " counter(catalog,decimal-leading-zero);display:block;margin-bottom:12px;color:var(--accent);font:800 .66rem/1 var(--font-body);letter-spacing:.16em;text-transform:uppercase}',
            'html[data-layout="catalog-grid"] .content-card h2{font-size:clamp(1.05rem,1.55vw,1.4rem);font-family:var(--font-body);line-height:1.2;letter-spacing:-.01em}',
            'html[data-layout="catalog-grid"] .content-card p{font-size:.9rem}',
            'html[data-layout="catalog-grid"] .content-card:last-child:nth-child(4n+1){display:grid;flex-basis:100%;grid-template-columns:minmax(260px,32%) minmax(0,68%)}',
            'html[data-layout="catalog-grid"] .content-card:last-child:nth-child(4n+1) figure{height:100%;aspect-ratio:auto}',

            /* Technical dossier: paired horizontal records, never row-spanning. */
            'html[data-layout="split-feature"] .site-header{border-bottom:0;background:var(--ink);color:var(--paper)}',
            'html[data-layout="split-feature"] .publication-intro{padding:clamp(26px,5vw,58px);border-left:10px solid var(--accent);background:color-mix(in srgb,var(--ink) 7%,var(--surface))}',
            'html[data-layout="split-feature"] .publication-intro h1{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:clamp(2.6rem,6vw,5.6rem);line-height:1;text-transform:uppercase}',
            'html[data-layout="split-feature"] .content-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:stretch;gap:var(--diff-gap);counter-reset:dossier}',
            'html[data-layout="split-feature"] .content-card,html[data-layout="split-feature"] .content-card.featured,html[data-layout="split-feature"] .content-card:nth-child(n){display:grid;grid-template-columns:minmax(130px,38%) minmax(0,62%);height:100%;border-radius:0;box-shadow:none;counter-increment:dossier}',
            'html[data-layout="split-feature"] .content-card figure{height:100%;min-height:230px;aspect-ratio:auto;border-right:1px solid var(--line)}',
            'html[data-layout="split-feature"] .content-card .card-copy{padding:clamp(16px,2.5vw,28px)}',
            'html[data-layout="split-feature"] .content-card .card-copy:before{content:"FILE / " counter(dossier,decimal-leading-zero);display:block;margin-bottom:14px;color:var(--accent);font:800 .67rem/1 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.12em}',
            'html[data-layout="split-feature"] .content-card h2{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:clamp(1.1rem,1.7vw,1.55rem);line-height:1.2}',
            'html[data-layout="split-feature"] .content-card:last-child:nth-child(odd){grid-column:1/-1;grid-template-columns:minmax(240px,28%) minmax(0,72%)}',

            /* Visual journal: image-led natural-flow columns, with no shared rows. */
            'html[data-layout="mosaic"] .site-header{border-bottom:0;box-shadow:none}',
            'html[data-layout="mosaic"] .publication-intro{display:block;max-width:980px;margin-left:auto;margin-right:auto;text-align:center}',
            'html[data-layout="mosaic"] .publication-intro h1{margin:.12em auto;font-size:clamp(3.4rem,9vw,8.4rem);font-style:italic;line-height:.88}',
            'html[data-layout="mosaic"] .publication-intro .dek{margin:22px auto}',
            'html[data-layout="mosaic"] .edition-meta{justify-content:center}',
            'html[data-layout="mosaic"] .content-grid{display:block;column-count:3;column-gap:var(--diff-gap)}',
            'html[data-layout="mosaic"] .content-card,html[data-layout="mosaic"] .content-card.featured,html[data-layout="mosaic"] .content-card:nth-child(n){display:inline-flex;width:100%;margin:0 0 var(--diff-gap);break-inside:avoid-column;border:0;border-radius:0;background:transparent;box-shadow:none}',
            'html[data-layout="mosaic"] .content-card figure{aspect-ratio:auto}',
            'html[data-layout="mosaic"] .content-card:nth-child(3n+1) figure{aspect-ratio:4/5}',
            'html[data-layout="mosaic"] .content-card:nth-child(3n+2) figure{aspect-ratio:1}',
            'html[data-layout="mosaic"] .content-card:nth-child(3n) figure{aspect-ratio:3/2}',
            'html[data-layout="mosaic"] .content-card .card-copy{padding:16px 0 8px;border-bottom:1px solid var(--ink)}',
            'html[data-layout="mosaic"] .content-card h2{font-size:clamp(1.25rem,2vw,1.85rem)}',
            'html[data-layout="mosaic"] .content-card p{display:none}',

            /* Swiss index: rectilinear twelve-column composition and typographic hierarchy. */
            'html[data-layout="swiss-index"] main{max-width:1380px}',
            'html[data-layout="swiss-index"] .site-header{border-top:10px solid var(--accent);border-bottom:1px solid var(--ink);border-radius:0;box-shadow:none}',
            'html[data-layout="swiss-index"] .brand,html[data-layout="swiss-index"] .site-header nav,html[data-layout="swiss-index"] .publication-intro{font-family:var(--font-body)}',
            'html[data-layout="swiss-index"] .publication-intro{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:var(--diff-gap);align-items:end;padding:clamp(26px,5vw,64px) 0;border-bottom:6px solid var(--ink)}',
            'html[data-layout="swiss-index"] .publication-intro .kicker{grid-column:1/4;align-self:start}',
            'html[data-layout="swiss-index"] .publication-intro h1{grid-column:1/9;font-family:var(--font-body);font-size:clamp(3.2rem,8vw,8rem);font-weight:800;line-height:.84;letter-spacing:-.075em}',
            'html[data-layout="swiss-index"] .publication-intro .dek{grid-column:9/13;max-width:30ch;font-size:1.1rem}',
            'html[data-layout="swiss-index"] .publication-intro .edition-meta{grid-column:1/13}',
            'html[data-layout="swiss-index"] .content-grid{display:flex;flex-wrap:wrap;align-items:stretch;gap:1px;padding:1px;background:var(--ink);counter-reset:swiss}',
            'html[data-layout="swiss-index"] .content-card,html[data-layout="swiss-index"] .content-card.featured,html[data-layout="swiss-index"] .content-card:nth-child(n){display:grid;grid-template-columns:minmax(150px,42%) minmax(0,58%);flex:1 1 calc(50% - 1px);min-width:360px;border:0;border-radius:0;background:var(--surface);box-shadow:none;counter-increment:swiss}',
            'html[data-layout="swiss-index"] .content-card figure{height:100%;min-height:240px;aspect-ratio:auto}',
            'html[data-layout="swiss-index"] .content-card .card-copy{padding:clamp(18px,3vw,34px)}',
            'html[data-layout="swiss-index"] .content-card .card-copy:before{content:counter(swiss,decimal-leading-zero) " /";display:block;margin-bottom:18px;color:var(--accent);font:800 .72rem/1 var(--font-body);letter-spacing:.16em}',
            'html[data-layout="swiss-index"] .content-card h2{font-family:var(--font-body);font-size:clamp(1.25rem,2vw,2rem);font-weight:750;line-height:1.05;letter-spacing:-.035em}',
            'html[data-layout="swiss-index"] .content-card:last-child:nth-child(odd){flex-basis:100%;grid-template-columns:minmax(260px,32%) minmax(0,68%)}',

            /* Broadsheet: dense newsroom columns and a masthead-led introduction. */
            'html[data-layout="broadsheet"] main{max-width:1440px}',
            'html[data-layout="broadsheet"] .site-header{display:grid;grid-template-columns:1fr auto 1fr;border-top:1px solid var(--ink);border-bottom:4px double var(--ink);border-radius:0;box-shadow:none}',
            'html[data-layout="broadsheet"] .brand{grid-column:2;font-size:clamp(1.5rem,3vw,2.6rem)}',
            'html[data-layout="broadsheet"] .site-header nav{grid-column:1/-1;justify-content:center;border-top:1px solid var(--line)}',
            'html[data-layout="broadsheet"] .publication-intro{display:block;padding:clamp(24px,4vw,44px) 0;text-align:center;border-bottom:4px double var(--ink)}',
            'html[data-layout="broadsheet"] .publication-intro h1{margin:.08em auto;font-size:clamp(3.2rem,8vw,7.2rem);line-height:.9}',
            'html[data-layout="broadsheet"] .publication-intro .dek{margin:18px auto;max-width:62ch}',
            'html[data-layout="broadsheet"] .edition-meta{justify-content:center}',
            'html[data-layout="broadsheet"] .content-grid{display:flex;flex-wrap:wrap;align-items:stretch;gap:0;border-top:1px solid var(--ink);border-left:1px solid var(--ink)}',
            'html[data-layout="broadsheet"] .content-card,html[data-layout="broadsheet"] .content-card.featured,html[data-layout="broadsheet"] .content-card:nth-child(n){display:flex;flex:1 1 31%;min-width:280px;padding:clamp(14px,2vw,24px);border-width:0 1px 1px 0;border-color:var(--ink);border-radius:0;background:transparent;box-shadow:none}',
            'html[data-layout="broadsheet"] .content-card figure{aspect-ratio:3/2;filter:saturate(.75) contrast(1.04)}',
            'html[data-layout="broadsheet"] .content-card .card-copy{flex:1;padding:18px 0 4px}',
            'html[data-layout="broadsheet"] .content-card h2{font-size:clamp(1.3rem,2.1vw,2.1rem);line-height:1.05}',
            'html[data-layout="broadsheet"] .content-card:last-child:nth-child(3n+1){display:grid;flex-basis:100%;grid-template-columns:minmax(260px,40%) minmax(0,60%)}',
            'html[data-layout="broadsheet"] .content-card:last-child:nth-child(3n+1) .card-copy{padding:clamp(22px,4vw,52px)}',

            /* Timeline ledger: chronological records with a visible reading spine. */
            'html[data-layout="timeline-ledger"] main{max-width:1180px}',
            'html[data-layout="timeline-ledger"] .site-header{border-bottom:1px solid var(--accent);box-shadow:none}',
            'html[data-layout="timeline-ledger"] .publication-intro{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,.55fr);padding:clamp(28px,5vw,64px) 0;border-bottom:1px solid var(--ink)}',
            'html[data-layout="timeline-ledger"] .publication-intro h1{font-size:clamp(3rem,7vw,6.5rem);font-weight:500}',
            'html[data-layout="timeline-ledger"] .publication-intro .dek{align-self:end}',
            'html[data-layout="timeline-ledger"] .content-grid{display:grid;grid-template-columns:1fr;gap:0;counter-reset:ledger;border-left:2px solid var(--accent)}',
            'html[data-layout="timeline-ledger"] .content-card,html[data-layout="timeline-ledger"] .content-card.featured,html[data-layout="timeline-ledger"] .content-card:nth-child(n){position:relative;display:grid;grid-template-columns:86px minmax(200px,30%) minmax(0,1fr);align-items:center;padding:clamp(20px,3vw,34px) 0;border-width:0 0 1px;border-radius:0;background:transparent;box-shadow:none;counter-increment:ledger}',
            'html[data-layout="timeline-ledger"] .content-card:before{content:counter(ledger,decimal-leading-zero);align-self:start;padding:10px 14px;color:var(--accent);font:800 .72rem/1 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.12em}',
            'html[data-layout="timeline-ledger"] .content-card:after{content:"";position:absolute;left:-7px;top:31px;width:12px;height:12px;border:2px solid var(--accent);border-radius:50%;background:var(--paper)}',
            'html[data-layout="timeline-ledger"] .content-card figure{aspect-ratio:16/10}',
            'html[data-layout="timeline-ledger"] .content-card .card-copy{padding:8px clamp(22px,5vw,58px)}',
            'html[data-layout="timeline-ledger"] .content-card h2{font-size:clamp(1.45rem,3vw,2.65rem);font-weight:500}',

            /* Cinematic strip: full-width visual chapters with alternating direction. */
            'html[data-layout="cinematic-strip"] main{max-width:1480px}',
            'html[data-layout="cinematic-strip"] .site-header{border-bottom:0;background:var(--ink);color:var(--paper);box-shadow:none}',
            'html[data-layout="cinematic-strip"] .publication-intro{display:block;padding:clamp(34px,7vw,88px) 0;text-align:center;border-bottom:1px solid var(--line)}',
            'html[data-layout="cinematic-strip"] .publication-intro h1{margin:.1em auto;max-width:12ch;font-size:clamp(3.4rem,9vw,8rem);font-style:italic;line-height:.88}',
            'html[data-layout="cinematic-strip"] .publication-intro .dek{margin:22px auto;max-width:60ch}',
            'html[data-layout="cinematic-strip"] .edition-meta{justify-content:center}',
            'html[data-layout="cinematic-strip"] .content-grid{display:flex;flex-direction:column;gap:clamp(20px,4vw,52px)}',
            'html[data-layout="cinematic-strip"] .content-card,html[data-layout="cinematic-strip"] .content-card.featured,html[data-layout="cinematic-strip"] .content-card:nth-child(n){position:relative;display:block;border:0;border-radius:0;background:var(--ink);box-shadow:none}',
            'html[data-layout="cinematic-strip"] .content-card figure{height:auto;aspect-ratio:21/9}',
            'html[data-layout="cinematic-strip"] .content-card figure:after{content:"";position:absolute;inset:22% 0 0;background:linear-gradient(transparent,color-mix(in srgb,var(--ink) 94%,transparent))}',
            'html[data-layout="cinematic-strip"] .content-card .card-copy{position:absolute;left:0;right:auto;bottom:0;width:min(720px,68%);padding:clamp(24px,5vw,60px);color:#fff;text-shadow:0 1px 12px rgba(0,0,0,.35)}',
            'html[data-layout="cinematic-strip"] .content-card:nth-child(even) .card-copy{left:auto;right:0;text-align:right}',
            'html[data-layout="cinematic-strip"] .content-card .eyebrow,html[data-layout="cinematic-strip"] .content-card .card-action{color:#fff}',
            'html[data-layout="cinematic-strip"] .content-card h2{font-size:clamp(1.7rem,3.4vw,3.4rem);line-height:1}',

            /* Soft showcase: calm editorial objects with consistent two-up geometry. */
            'html[data-layout="soft-showcase"] body{background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 7%,var(--paper)),var(--paper) 42%,color-mix(in srgb,var(--accent2) 6%,var(--paper)))}',
            'html[data-layout="soft-showcase"] .site-header{margin-top:18px;border:1px solid color-mix(in srgb,var(--line) 70%,transparent);border-radius:22px;background:color-mix(in srgb,var(--surface) 88%,transparent);box-shadow:0 18px 55px color-mix(in srgb,var(--ink) 8%,transparent);backdrop-filter:blur(16px)}',
            'html[data-layout="soft-showcase"] .publication-intro{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.7fr);padding:clamp(34px,6vw,76px);border:1px solid color-mix(in srgb,var(--line) 65%,transparent);border-radius:32px;background:color-mix(in srgb,var(--surface) 82%,transparent);box-shadow:0 26px 80px color-mix(in srgb,var(--ink) 8%,transparent)}',
            'html[data-layout="soft-showcase"] .publication-intro h1{font-size:clamp(3rem,7vw,6.5rem);line-height:.95}',
            'html[data-layout="soft-showcase"] .publication-intro .dek{align-self:center}',
            'html[data-layout="soft-showcase"] .content-grid{display:flex;flex-wrap:wrap;align-items:stretch;gap:clamp(20px,3vw,36px)}',
            'html[data-layout="soft-showcase"] .content-card,html[data-layout="soft-showcase"] .content-card.featured,html[data-layout="soft-showcase"] .content-card:nth-child(n){display:flex;flex:1 1 calc(50% - 36px);min-width:340px;border:1px solid color-mix(in srgb,var(--line) 72%,transparent);border-radius:clamp(18px,var(--radius),30px);background:color-mix(in srgb,var(--surface) 90%,transparent);box-shadow:0 20px 58px color-mix(in srgb,var(--ink) 9%,transparent)}',
            'html[data-layout="soft-showcase"] .content-card figure{aspect-ratio:16/10}',
            'html[data-layout="soft-showcase"] .content-card .card-copy{flex:1;padding:clamp(22px,3vw,36px)}',
            'html[data-layout="soft-showcase"] .content-card h2{font-size:clamp(1.45rem,2.3vw,2.35rem)}',
            'html[data-layout="soft-showcase"] .content-card:last-child:nth-child(odd){display:grid;flex-basis:100%;grid-template-columns:minmax(280px,.8fr) minmax(0,1.2fr)}',
            'html[data-layout="soft-showcase"] .content-card:last-child:nth-child(odd) figure{height:100%;aspect-ratio:auto}',

            /* Industrial catalog: a quiet, high-density reference system instead of a terminal screen. */
            'html[data-layout="industrial-board"] body{background:var(--paper)}',
            'html[data-layout="industrial-board"] .site-header{border-width:0 0 1px;border-radius:0;background:color-mix(in srgb,var(--surface) 90%,var(--paper));box-shadow:none}',
            'html[data-layout="industrial-board"] .brand,html[data-layout="industrial-board"] .site-header nav{font-family:var(--font-body);letter-spacing:.01em}',
            'html[data-layout="industrial-board"] .publication-intro{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(240px,.65fr);gap:clamp(24px,5vw,72px);align-items:end;padding:clamp(34px,6vw,76px) 0;border-bottom:1px solid var(--ink);background:transparent;box-shadow:none}',
            'html[data-layout="industrial-board"] .publication-intro h1{max-width:10ch;font-size:clamp(3rem,7vw,6.4rem);font-weight:500;line-height:.94;letter-spacing:-.035em}',
            'html[data-layout="industrial-board"] .publication-intro .dek{align-self:end;max-width:38ch;font-size:clamp(1rem,1.4vw,1.25rem);line-height:1.6}',
            'html[data-layout="industrial-board"] .publication-intro .edition-meta{grid-column:2}',
            'html[data-layout="industrial-board"] .content-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:stretch;gap:clamp(16px,2.2vw,30px);padding:clamp(24px,4vw,48px) 0;background:transparent}',
            'html[data-layout="industrial-board"] .content-card,html[data-layout="industrial-board"] .content-card.featured,html[data-layout="industrial-board"] .content-card:nth-child(n){display:flex;min-width:0;padding:0;border:1px solid color-mix(in srgb,var(--line) 86%,transparent);border-radius:12px;background:var(--surface);box-shadow:0 8px 24px color-mix(in srgb,var(--ink) 6%,transparent)}',
            'html[data-layout="industrial-board"] .content-card figure{aspect-ratio:16/10;border:0;border-bottom:1px solid var(--line)}',
            'html[data-layout="industrial-board"] .content-card .card-copy{flex:1;padding:clamp(18px,2vw,26px)}',
            'html[data-layout="industrial-board"] .content-card h2{font-family:var(--font-display);font-size:clamp(1.25rem,1.75vw,1.72rem);font-weight:500;line-height:1.16;letter-spacing:-.02em}',
            'html[data-layout="industrial-board"] .content-card .eyebrow{color:var(--accent);font-family:var(--font-body);font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}',

            /* Domain composition modes alter information density and reading priority across the same layout. */
            'html[data-domain-mode="signal"] .publication-intro .edition-meta{order:-1}',
            'html[data-domain-mode="signal"] .content-card p{display:-webkit-box;-webkit-line-clamp:2}',
            'html[data-domain-mode="signal"] .card-action{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;text-transform:uppercase;letter-spacing:.06em}',
            'html[data-domain-mode="field"] .content-card .eyebrow{padding-bottom:8px;border-bottom:1px dashed var(--line)}',
            'html[data-domain-mode="field"] .content-card p{display:-webkit-box;-webkit-line-clamp:4}',
            'html[data-domain-mode="culture"] .content-card h2{font-style:italic;font-weight:500}',
            'html[data-domain-mode="culture"] .content-card .card-action{text-decoration:underline}',
            'html[data-domain-mode="spectacle"] .content-card p{display:none}',
            'html[data-domain-mode="spectacle"] .content-card h2{font-size:clamp(1.45rem,2.7vw,2.75rem)}',
            'html[data-domain-mode="reference"] .content-card p{display:-webkit-box;-webkit-line-clamp:3}',
            'html[data-domain-mode="reference"] .card-action{margin-top:12px}',
            '}',

            '@media(min-width:681px) and (max-width:1100px){',
            'html[data-layout="lead-grid"] .content-card:not(.featured){flex-basis:calc(50% - var(--diff-gap))}',
            'html[data-layout="catalog-grid"] .content-card,html[data-layout="catalog-grid"] .content-card.featured,html[data-layout="catalog-grid"] .content-card:nth-child(n){flex-basis:calc(50% - 1px);min-width:0}',
            'html[data-layout="split-feature"] .content-grid{grid-template-columns:1fr}',
            'html[data-layout="split-feature"] .content-card:last-child:nth-child(odd){grid-column:auto}',
            'html[data-layout="mosaic"] .content-grid{column-count:2}',
            'html[data-layout="swiss-index"] .content-card,html[data-layout="swiss-index"] .content-card.featured,html[data-layout="swiss-index"] .content-card:nth-child(n){min-width:300px}',
            'html[data-layout="broadsheet"] .content-card,html[data-layout="broadsheet"] .content-card.featured,html[data-layout="broadsheet"] .content-card:nth-child(n){flex-basis:46%}',
            'html[data-layout="timeline-ledger"] .content-card,html[data-layout="timeline-ledger"] .content-card.featured,html[data-layout="timeline-ledger"] .content-card:nth-child(n){grid-template-columns:72px minmax(190px,36%) minmax(0,1fr)}',
            'html[data-layout="lead-grid"] .content-card:last-child:nth-child(even),html[data-layout="catalog-grid"] .content-card:last-child:nth-child(odd),html[data-layout="broadsheet"] .content-card:last-child:nth-child(odd),html[data-layout="soft-showcase"] .content-card:last-child:nth-child(odd),html[data-layout="swiss-index"] .content-card:last-child:nth-child(odd){display:grid;flex-basis:100%;grid-template-columns:minmax(240px,38%) minmax(0,62%)}',
            'html[data-layout="lead-grid"] .content-card:last-child:nth-child(even) figure,html[data-layout="catalog-grid"] .content-card:last-child:nth-child(odd) figure,html[data-layout="broadsheet"] .content-card:last-child:nth-child(odd) figure,html[data-layout="soft-showcase"] .content-card:last-child:nth-child(odd) figure,html[data-layout="swiss-index"] .content-card:last-child:nth-child(odd) figure{height:100%;aspect-ratio:auto}',
            'html[data-layout="industrial-board"] .content-grid{grid-template-columns:repeat(2,minmax(0,1fr))}',
            '}',

            '@media(max-width:680px){',
            'html[data-layout] .content-grid{display:grid;grid-template-columns:1fr;column-count:auto;gap:18px;padding:0;background:transparent}',
            'html[data-layout] .content-card,html[data-layout] .content-card.featured,html[data-layout] .content-card:nth-child(n){display:flex;width:auto;height:auto;margin:0;grid-column:auto;grid-row:auto;flex-direction:column;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);box-shadow:none}',
            'html[data-layout] .content-card figure,html[data-layout] .content-card.featured figure,html[data-layout] .content-card:nth-child(n) figure{width:100%;height:auto;min-height:0;aspect-ratio:16/10;border:0;border-bottom:1px solid var(--line)}',
            'html[data-layout] .content-card .card-copy{padding:20px}',
            'html[data-layout="rail-index"] .publication-intro,html[data-layout="catalog-grid"] .publication-intro,html[data-layout="swiss-index"] .publication-intro,html[data-layout="timeline-ledger"] .publication-intro,html[data-layout="cinematic-strip"] .publication-intro,html[data-layout="soft-showcase"] .publication-intro,html[data-layout="industrial-board"] .publication-intro{display:block;padding:24px 0}',
            'html[data-layout="rail-index"] .publication-intro h1,html[data-layout="catalog-grid"] .publication-intro h1,html[data-layout="swiss-index"] .publication-intro h1{font-size:clamp(2.5rem,14vw,4.4rem)}',
            'html[data-layout="rail-index"] .content-card .card-copy:before{font-size:2.4rem}',
            'html[data-layout="banded-list"] .content-card,html[data-layout="banded-list"] .content-card:nth-child(n){border-style:dashed;border-radius:calc(var(--radius) * .35)}',
            'html[data-layout="catalog-grid"] .content-card,html[data-layout="catalog-grid"] .content-card:nth-child(n){padding:12px;border-radius:0}',
            'html[data-layout="catalog-grid"] .content-card figure{aspect-ratio:1;border:1px solid var(--line)}',
            'html[data-layout="split-feature"] .content-card,html[data-layout="split-feature"] .content-card:nth-child(n){border-radius:0}',
            'html[data-layout="mosaic"] .content-card,html[data-layout="mosaic"] .content-card:nth-child(n){border:0;border-radius:0;background:transparent}',
            'html[data-layout="mosaic"] .content-card .card-copy{padding:14px 0;border-bottom:1px solid var(--ink)}',
            'html[data-layout="mosaic"] .content-card p{display:none}',
            'html[data-layout="lead-grid"] .content-card.featured{display:flex;background:var(--surface)}',
            'html[data-layout="lead-grid"] .content-card.featured figure:after{display:none}',
            'html[data-layout="lead-grid"] .content-card.featured .card-copy{position:relative;inset:auto;width:100%;color:var(--ink);text-shadow:none}',
            'html[data-layout="lead-grid"] .content-card.featured .eyebrow,html[data-layout="lead-grid"] .content-card.featured .card-action{color:var(--accent)}',
            'html[data-layout="swiss-index"] .content-card .card-copy:before,html[data-layout="timeline-ledger"] .content-card:before,html[data-layout="timeline-ledger"] .content-card:after{display:none}',
            'html[data-layout="broadsheet"] .site-header{display:flex}',
            'html[data-layout="cinematic-strip"] .content-card:nth-child(even) figure,html[data-layout="cinematic-strip"] .content-card:nth-child(even) .card-copy{grid-column:auto;grid-row:auto}',
            'html[data-layout="soft-showcase"] .site-header{margin-top:0;border-radius:0}',
            'html[data-layout="soft-showcase"] .content-card,html[data-layout="soft-showcase"] .content-card:nth-child(n){border-radius:clamp(16px,var(--radius),24px)}',
            '}',
            'body[data-home-intro="compact"] .publication-intro{min-height:0;padding-top:18px;padding-bottom:18px}',
            'body[data-home-intro="compact"] .publication-intro h1{font-size:clamp(2.25rem,6vw,3.6rem);line-height:.95}',
            '@media(prefers-reduced-motion:reduce){html[data-layout="banded-list"] .content-card,html[data-layout="soft-showcase"] .content-card{box-shadow:none}}'
        ].join('');
    }

    function generateCss(config) {
        config = Object.assign({
            homeIntro: 'compact', cardColumns: 'template', categoryCardColumns: 'inherit', cardViewMode: 'auto',
            cardBorder: 'auto', cardSpacing: 'auto', cardExcerptLines: 'auto', cardImageHeight: 'auto', cardHeight: 'template',
            coverFit: 'smart', contentMaxWidth: 'auto', metaBg: 'auto', detailImgStyle: 'auto', categoryTitleStyle: 'auto',
            categoryTitleAlign: 'auto', heroStyle: 'auto', detailLayout: 'auto', fontStyle: 'auto', navStyle: 'glass',
            buttonStyle: 'solid', buttonSize: 'auto', gridGap: 'regular', backLinkStyle: 'arrow', animationEnter: 'fade',
            transitionSpeed: 'normal'
        }, config || {});
        config.typography = config.typography || TYPOGRAPHY_PAIRS[0];
        var density = chooseValue(config.contentDensity, DENSITY_OPTIONS, 'comfortable');
        var radius = chooseValue(config.cardRadius, RADIUS_OPTIONS, 'auto');
        var hover = chooseValue(config.cardHover, HOVER_OPTIONS, 'lift');
        var summaryMode = chooseValue(config.summaryMode, SUMMARY_OPTIONS, 'standard');
        var densityTokens = {
            compact: { gap: '16px', padding: '18px', intro: '34px' },
            comfortable: { gap: 'clamp(18px,3vw,34px)', padding: 'clamp(18px,3vw,30px)', intro: '48px' },
            spacious: { gap: 'clamp(28px,4vw,52px)', padding: 'clamp(24px,4vw,38px)', intro: '68px' }
        }[density];
        var resolvedRadius = radius === 'auto' || radius === 'right-round' ? '18px' : radius;
        // Layout families may use deliberately square editorial modules when
        // radius is automatic.  A value explicitly chosen in the settings UI
        // is an accessibility/personalisation preference and must win over
        // those family-level art-direction rules.
        var cardRadiusValue = radius === 'right-round' ? '0 var(--radius) var(--radius) 0' : 'var(--radius)';
        var cardRadiusOverrideCss = radius === 'auto' ? ''
            : 'html[data-layout] body[data-card-radius]:not([data-card-radius="auto"]) .content-card,html[data-layout] body[data-card-radius]:not([data-card-radius="auto"]) .content-card.featured,html[data-layout] body[data-card-radius]:not([data-card-radius="auto"]) .content-card:nth-child(n){border-radius:' + cardRadiusValue + '!important;overflow:hidden}html[data-layout] body[data-card-radius]:not([data-card-radius="auto"]) .content-card figure{overflow:hidden}html[data-layout="mosaic"] body[data-card-radius]:not([data-card-radius="auto"]) .content-card figure{border-radius:' + cardRadiusValue + '!important}';
        var hoverCss = hover === 'none'
            ? '.content-card,.content-card:hover{transform:none}.content-card:hover{box-shadow:var(--shadow)}'
            : hover === 'image-zoom'
                ? '.content-card figure img{transition:transform .24s ease}.content-card:hover{transform:none}.content-card:hover figure img{transform:scale(1.045)}'
                : hover === 'scale' || hover === 'bounce'
                    ? '.content-card:hover{transform:translateY(-2px) scale(1.018)}'
                    : hover === 'tilt'
                        ? '.content-card:hover{transform:translateY(-3px) rotate(-.55deg)}'
                        : hover === 'flip'
                            ? '.content-card:hover{transform:perspective(900px) rotateY(-2deg)}'
                            : hover === 'glow' || hover === 'border-glow'
                                ? '.content-card:hover{transform:translateY(-2px);box-shadow:0 0 0 2px var(--accent),0 16px 34px color-mix(in srgb,var(--accent) 24%,transparent)}'
                                : hover === 'slide-up'
                                    ? '.content-card:hover{transform:translateY(-8px)}'
                                    : hover === 'color-reveal'
                                        ? '.content-card:hover{background:color-mix(in srgb,var(--accent) 8%,var(--surface))}'
                                        : hover === 'title-underline'
                                            ? '.content-card:hover .card-copy h2{text-decoration:underline;text-decoration-color:var(--accent);text-underline-offset:.18em}'
                                            : hover === 'accent-line'
                                                ? '.content-card:hover{box-shadow:inset 0 4px 0 var(--accent),var(--shadow)}'
                                                : '.content-card:hover{transform:translateY(-4px)}';
        var css = paletteCss() + '\n' +
            '*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.65}a{color:inherit;text-underline-offset:.2em}a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid var(--accent);outline-offset:3px}.skip-link{position:fixed;left:12px;top:-80px;z-index:30;padding:10px 14px;background:var(--surface);border:2px solid var(--accent)}.skip-link:focus{top:12px}.site-header{position:relative;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:28px;max-width:1440px;margin:auto;padding:18px clamp(18px,4vw,64px);border-bottom:1px solid var(--line)}.brand{display:flex;align-items:center;gap:10px;font-family:Georgia,serif;font-size:clamp(1.15rem,2vw,1.65rem);font-weight:800;text-decoration:none}.brand span{color:var(--accent)}.site-header nav{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px 20px}.site-header nav a{text-decoration:none;font-size:.88rem;font-weight:700}.nav-toggle{display:none;min-width:44px;min-height:44px;border:1px solid var(--line);background:var(--surface);color:var(--ink)}main{max-width:1440px;min-height:60vh;margin:auto;padding:clamp(34px,6vw,84px) clamp(18px,4vw,64px)}.publication-intro{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(240px,.8fr);gap:28px 8vw;align-items:end;margin-bottom:48px}.publication-intro .kicker{grid-column:1/-1}.publication-intro h1{margin:0;font:800 clamp(3rem,9vw,8rem)/.88 Georgia,serif;letter-spacing:-.055em}.dek{max-width:58ch;margin:0;font-size:clamp(1.05rem,2vw,1.35rem)}.kicker,.eyebrow{margin:0 0 10px;color:var(--accent);font-size:.74rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.edition-meta{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px}.edition-meta span{padding:6px 10px;border:1px solid var(--line);font-size:.75rem;font-weight:700}.content-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:clamp(18px,3vw,34px)}.content-card{grid-column:span 4;display:flex;min-width:0;flex-direction:column;overflow:hidden;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);box-shadow:var(--shadow);text-decoration:none;transition:transform .2s ease,box-shadow .2s ease}.content-card:hover{transform:translateY(-4px)}.content-card.featured{grid-column:span 8;display:grid;grid-template-columns:1.2fr .8fr}.content-card figure{min-height:210px;margin:0;overflow:hidden;background:color-mix(in srgb,var(--accent) 15%,var(--surface))}.content-card img{display:block;width:100%;height:100%;min-height:210px;object-fit:cover}.cover-missing{display:grid;min-height:210px;place-items:center;font:700 3rem Georgia,serif;color:var(--accent)}.card-copy{display:flex;flex:1;flex-direction:column;padding:clamp(18px,3vw,30px)}.card-copy h2{margin:0 0 12px;font:700 clamp(1.35rem,2.2vw,2.3rem)/1.05 Georgia,serif;letter-spacing:-.025em}.card-copy p{color:var(--muted)}.card-action{margin-top:auto;padding-top:16px;color:var(--accent);font-weight:800}.back-link{display:inline-flex;min-height:44px;align-items:center;margin-bottom:28px;font-weight:800}.article,.tool-detail,.game-detail,.standard-page{max-width:1100px;margin:auto}.article>header,.tool-detail>header,.game-detail>header{max-width:900px}.article h1,.tool-detail h1,.game-detail h1,.standard-page h1,.section-heading h1,.empty-state h1{margin:.1em 0;font:800 clamp(2.7rem,7vw,6.8rem)/.94 Georgia,serif;letter-spacing:-.045em}.standfirst{max-width:65ch;color:var(--muted);font-size:clamp(1.1rem,2vw,1.4rem)}.byline{display:flex;flex-wrap:wrap;gap:8px 20px;padding:18px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-size:.82rem;font-weight:700}.article-cover{margin:38px 0}.article-cover img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;border-radius:var(--radius)}.article-body,.sources,.tool-guide,.game-guide,.standard-page{max-width:var(--measure);font-family:Georgia,serif;font-size:1.08rem}.article-body h2,.article-body h3,.tool-guide h2,.game-guide h2,.standard-page h2,.sources h2{margin-top:2.2em;line-height:1.15}.article-body p{margin:1.15em 0}.sources{margin-top:50px;padding-top:24px;border-top:2px solid var(--ink)}.sources a{overflow-wrap:anywhere}.tool-workbench{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:36px 0;padding:clamp(20px,4vw,42px);border:2px solid var(--ink);background:var(--surface);box-shadow:8px 8px 0 var(--accent)}.tool-workbench form{display:grid;gap:10px}.tool-workbench label{font-weight:800}.tool-workbench textarea,.tool-workbench input{width:100%;padding:13px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font:inherit}.tool-actions{display:flex;gap:10px}.tool-actions button,.play-button{display:inline-flex;min-height:44px;align-items:center;justify-content:center;padding:10px 18px;border:1px solid var(--ink);background:var(--accent);color:var(--paper);font-weight:900;text-decoration:none;cursor:pointer}.tool-actions button[type="reset"]{background:transparent;color:var(--ink)}.tool-result pre{min-height:180px;margin:0;padding:16px;overflow:auto;border:1px solid var(--line);background:var(--paper);white-space:pre-wrap}.tool-guide dl div{padding:14px 0;border-bottom:1px solid var(--line)}.tool-guide dt{font-weight:800}.game-launch{margin:38px 0;padding:28px;border-left:8px solid var(--accent);background:var(--surface)}.play-button{color:#fff}.ad-region{clear:both;margin:46px auto;padding:18px;border:1px solid var(--line);text-align:center}.ad-region>span{display:block;margin-bottom:10px;color:var(--muted);font-size:.68rem;letter-spacing:.12em;text-transform:uppercase}.section-heading{margin-bottom:36px}.standard-page,.empty-state{padding:clamp(24px,5vw,64px);border:1px solid var(--line);background:var(--surface)}.site-footer{display:grid;grid-template-columns:1.2fr 1fr auto;gap:28px;align-items:start;padding:42px clamp(18px,4vw,64px);border-top:1px solid var(--line);font-size:.82rem}.site-footer nav{display:grid;gap:8px}.site-footer p{margin:0}html[data-layout="rail-index"] .content-grid{grid-template-columns:1fr}html[data-layout="rail-index"] .content-card,html[data-layout="rail-index"] .content-card.featured{display:grid;grid-column:auto;grid-template-columns:220px 1fr;border-width:0 0 1px;border-radius:0;box-shadow:none}html[data-layout="rail-index"] .content-card figure,html[data-layout="rail-index"] .content-card img{min-height:160px}html[data-layout="banded-list"] .content-grid{grid-template-columns:repeat(2,minmax(0,1fr));align-items:stretch}html[data-layout="banded-list"] .content-card:nth-child(n),html[data-layout="banded-list"] .content-card.featured{display:flex;grid-column:auto}html[data-layout="banded-list"] .content-card figure{aspect-ratio:16/10}html[data-layout="banded-list"] .content-card:last-child:nth-child(odd){display:grid;grid-column:1/-1;grid-template-columns:minmax(260px,.85fr) minmax(0,1.15fr)}html[data-layout="banded-list"] .content-card:last-child:nth-child(odd) figure{height:100%;aspect-ratio:auto}html[data-layout="catalog-grid"] .content-card{border-radius:0;box-shadow:none}html[data-layout="catalog-grid"] .content-card.featured{grid-column:span 4;display:flex}html[data-layout="split-feature"] .content-grid{grid-template-columns:repeat(2,minmax(0,1fr))}html[data-layout="split-feature"] .content-card,html[data-layout="split-feature"] .content-card.featured{grid-column:auto}html[data-layout="split-feature"] .content-card:nth-child(3n+1){grid-row:span 2}html[data-layout="mosaic"] .content-card:nth-child(5n+1){grid-column:span 7}html[data-layout="mosaic"] .content-card:nth-child(5n+2){grid-column:span 5}html[data-layout="mosaic"] .content-card:nth-child(5n+3),html[data-layout="mosaic"] .content-card:nth-child(5n+4),html[data-layout="mosaic"] .content-card:nth-child(5n+5){grid-column:span 4}@media(max-width:900px){.publication-intro{grid-template-columns:1fr}.publication-intro .kicker,.edition-meta{grid-column:auto}.content-card,.content-card.featured,html[data-layout="mosaic"] .content-card:nth-child(n){grid-column:span 6;display:flex}html[data-layout="banded-list"] .content-card:nth-child(n){grid-column:auto}html[data-layout="banded-list"] .content-card:last-child:nth-child(odd){display:grid;grid-column:1/-1}.tool-workbench{grid-template-columns:1fr}.site-footer{grid-template-columns:1fr 1fr}}@media(max-width:680px){.site-header{align-items:flex-start}.nav-toggle{display:block}.site-header nav{position:absolute;top:70px;left:18px;right:18px;display:none;padding:16px;border:1px solid var(--line);background:var(--surface);box-shadow:var(--shadow)}.site-header nav.is-open{display:grid}.content-grid,html[data-layout="split-feature"] .content-grid{grid-template-columns:1fr}.content-card,.content-card.featured,html[data-layout="rail-index"] .content-card,html[data-layout="rail-index"] .content-card.featured,html[data-layout="banded-list"] .content-card:nth-child(n),html[data-layout="mosaic"] .content-card:nth-child(n){display:flex;grid-column:auto;grid-template-columns:1fr}.publication-intro h1{font-size:clamp(2.7rem,17vw,5rem)}.article h1,.tool-detail h1,.game-detail h1,.standard-page h1,.section-heading h1{font-size:clamp(2.3rem,13vw,4rem)}.site-footer{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.content-card{transition:none}.content-card:hover{transform:none}}';
        // A CSS grid row is as tall as its tallest card.  Letting compact cards
        // shrink independently exposed the page background below shorter cards.
        // The default therefore fills each row; the action remains bottom-pinned
        // in the card copy so the extra room never turns into a detached gap.
        var cardSizing = config.cardAlignment === 'aligned'
            ? '.content-grid{align-items:start}.content-card{align-self:start;height:auto}'
            : '.content-grid{align-items:stretch}.content-card{align-self:stretch;height:100%}';
        css += ':root{--font-body:' + config.typography.body + ';--font-display:' + config.typography.display + '}body{font-family:var(--font-body)}.brand,.publication-intro h1,.card-copy h2,.cover-missing,.article h1,.tool-detail h1,.game-detail h1,.standard-page h1,.section-heading h1,.empty-state h1{font-family:var(--font-display)}.brand-mark{display:inline-grid;flex:0 0 1.72em;width:1.72em;height:1.72em;place-items:center;border:2px solid currentColor;font-family:var(--font-body);font-size:.72em;line-height:1}.mark-orbit{border-radius:50%}.mark-spark{transform:rotate(45deg);border-radius:4px}.mark-compass{border-radius:50% 50% 8px 8px}.mark-arch{border-radius:1em 1em 0 0}.mark-tile{border-radius:0}.mark-wave{border-style:dashed;border-radius:50%}' + cardSizing + '.content-card:not(.featured) figure{height:auto;min-height:0;aspect-ratio:16/10}.content-card:not(.featured) img{height:100%;min-height:0}.content-card.featured{align-items:stretch}.content-card.featured figure{height:100%;min-height:0;max-height:520px;aspect-ratio:auto}.content-card.featured img{height:100%;min-height:0}.card-copy{min-width:0}.card-copy p{display:-webkit-box;overflow:hidden;margin:12px 0 0;-webkit-box-orient:vertical;-webkit-line-clamp:4}.card-action{margin-top:18px;padding-top:0}html[data-layout="lead-grid"] .content-card.featured{align-self:start}html[data-layout="lead-grid"] .content-card.featured figure{max-height:none}html[data-layout="lead-grid"] .content-card.featured .card-copy{justify-content:center}html[data-layout="rail-index"] .content-card,html[data-layout="rail-index"] .content-card.featured{grid-template-columns:minmax(180px,28%) minmax(0,1fr);align-items:stretch}html[data-layout="rail-index"] .content-card figure{height:100%;min-height:180px;min-width:0}html[data-layout="rail-index"] .content-card img{height:100%;min-height:180px;object-fit:cover}html[data-layout="banded-list"] .content-card.featured figure{height:auto;min-height:0;max-height:none;aspect-ratio:16/10}';
        css += '.content-card,.content-card figure,.card-copy{min-width:0}.content-card figure{width:100%;overflow:hidden}.content-card img{width:100%;max-width:100%;object-fit:cover}.card-copy{position:relative;z-index:1;overflow:hidden}.card-copy h2{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:3}.card-copy p{overflow-wrap:anywhere}html[data-layout="lead-grid"] .content-grid{grid-template-columns:repeat(12,minmax(0,1fr))}html[data-layout="lead-grid"] .content-card.featured{grid-column:1/-1;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);align-self:stretch}html[data-layout="lead-grid"] .content-card.featured figure{min-height:clamp(280px,30vw,460px);height:100%;aspect-ratio:auto}html[data-layout="lead-grid"] .content-card:not(.featured){grid-column:span 4}html[data-layout="rail-index"] .content-grid{grid-template-columns:1fr;gap:20px}html[data-layout="rail-index"] .content-card,html[data-layout="rail-index"] .content-card.featured{display:grid;grid-column:auto;grid-template-columns:minmax(220px,30%) minmax(0,1fr);grid-template-rows:1fr;align-items:stretch;overflow:hidden}html[data-layout="rail-index"] .content-card figure{grid-column:1;grid-row:1;width:100%;height:100%;min-height:190px;aspect-ratio:auto}html[data-layout="rail-index"] .content-card img{width:100%;height:100%;min-height:190px;object-fit:cover}html[data-layout="rail-index"] .content-card .card-copy{grid-column:2;grid-row:1;width:100%;min-width:0;background:var(--surface)}html[data-layout="split-feature"] .content-grid{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}html[data-layout="split-feature"] .content-card,html[data-layout="split-feature"] .content-card.featured{grid-column:auto;grid-row:auto}html[data-layout="mosaic"] .content-grid{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}html[data-layout="mosaic"] .content-card,html[data-layout="mosaic"] .content-card:nth-child(n){grid-column:auto;grid-row:auto}html[data-layout="mosaic"] .content-card.featured{display:grid;grid-column:1/-1;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr)}';
        css += '@media(max-width:900px){html[data-layout="lead-grid"] .content-card.featured,html[data-layout="mosaic"] .content-card.featured{grid-template-columns:1fr 1fr}html[data-layout="lead-grid"] .content-card:not(.featured){grid-column:span 6}}@media(max-width:680px){html[data-layout="banded-list"] .content-grid{grid-template-columns:1fr}.content-card.featured figure{height:auto;min-height:0;max-height:none;aspect-ratio:16/10}html[data-layout="lead-grid"] .content-card.featured,html[data-layout="mosaic"] .content-card.featured,html[data-layout="rail-index"] .content-card,html[data-layout="rail-index"] .content-card.featured{display:flex;grid-template-columns:1fr}html[data-layout="lead-grid"] .content-card:not(.featured){grid-column:auto}html[data-layout="rail-index"] .content-card figure{height:auto;min-height:0;aspect-ratio:16/10}html[data-layout="rail-index"] .content-card img{height:100%;min-height:0}html[data-layout="rail-index"] .content-card .card-copy{width:auto}}';
        var stableGridCss = config.cardAlignment === 'aligned' ? '' : '.content-grid{align-items:stretch}.content-card{align-self:stretch;height:100%}.content-card .card-copy{min-height:0}.content-card:not(.featured) figure{aspect-ratio:16/10}.content-card:not(.featured) img{height:100%;object-fit:cover}';
        var gridGap = { compact: '14px', regular: densityTokens.gap, relaxed: 'clamp(28px,4vw,52px)' }[config.gridGap] || (config.gridGap === 'auto' ? densityTokens.gap : config.gridGap || densityTokens.gap);
        var transition = { fast: '.14s', normal: '.24s', slow: '.42s' }[config.transitionSpeed] || config.transitionSpeed || '.24s';
        var navHeight = { compact: '56px', regular: '68px', roomy: '82px' }[config.navHeight] || config.navHeight || '68px';
        var paletteOverrides = Object.keys(config.themePalette || {}).map(function(key) { return '--' + key + ':' + config.themePalette[key]; }).join(';');
        var paletteScopeCss = paletteOverrides ? 'html[data-tone]{' + paletteOverrides + '}' : '';
        var enterCss = config.animationEnter === 'none' ? '' : config.animationEnter === 'rise' || config.animationEnter === 'slideUp'
            ? 'main,.site-footer{animation:diff-rise ' + transition + ' ease both}@keyframes diff-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}'
            : config.animationEnter === 'zoomIn'
                ? 'main,.site-footer{animation:diff-zoom ' + transition + ' ease both}@keyframes diff-zoom{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}'
                : config.animationEnter === 'slideLeft' || config.animationEnter === 'slideRight'
                    ? 'main,.site-footer{animation:diff-slide ' + transition + ' ease both}@keyframes diff-slide{from{opacity:0;transform:translateX(' + (config.animationEnter === 'slideLeft' ? '-18px' : '18px') + ')}to{opacity:1;transform:none}}'
                    : 'main,.site-footer{animation:diff-fade ' + transition + ' ease both}@keyframes diff-fade{from{opacity:0}to{opacity:1}}';
        var componentCss = ':root{--radius:' + resolvedRadius + ';--diff-gap:' + gridGap + ';--diff-card-padding:' + densityTokens.padding + ';--diff-transition:' + transition + ';--diff-nav-height:' + navHeight + (paletteOverrides ? ';' + paletteOverrides : '') + '}.content-grid{gap:var(--diff-gap)}.card-copy{padding:var(--diff-card-padding)}.publication-intro{margin-bottom:' + densityTokens.intro + '}body[data-home-intro="compact"] .publication-intro{grid-template-columns:1fr;gap:12px;margin-bottom:28px}body[data-home-intro="compact"] .publication-intro .kicker,body[data-home-intro="compact"] .publication-intro .edition-meta{grid-column:auto}body[data-home-intro="compact"] .publication-intro h1{font-size:clamp(2.25rem,5vw,4.5rem);letter-spacing:-.04em}.card-copy p{-webkit-line-clamp:' + (summaryMode === 'brief' ? '2' : '4') + '}.article-body,.article .sources{width:min(100%,var(--measure));margin-left:auto;margin-right:auto}' + stableGridCss + hoverCss + '.site-header{position:sticky;top:0;z-index:100;max-width:none;min-height:var(--diff-nav-height);padding-top:0;padding-bottom:0;background:color-mix(in srgb,var(--paper) 90%,transparent);backdrop-filter:blur(14px) saturate(1.12);-webkit-backdrop-filter:blur(14px) saturate(1.12);transition:background var(--diff-transition) ease,box-shadow var(--diff-transition) ease}.site-header.nav-style-glass{box-shadow:0 6px 20px color-mix(in srgb,var(--ink) 11%,transparent)}.site-header.nav-style-minimal{box-shadow:none}.site-header.nav-layout-left{justify-content:flex-start}.site-header.nav-layout-left nav{margin-left:18px}.site-header.nav-layout-centered nav{margin-left:auto;margin-right:auto}.site-header.nav-style-underline nav a{padding:8px 0;border-bottom:2px solid transparent}.site-header.nav-style-underline nav a[aria-current="page"],.site-header.nav-style-underline nav a:hover{border-bottom-color:var(--accent)}.site-header.nav-style-accent nav a[aria-current="page"],.site-header.nav-style-accent nav a:hover{padding:7px 10px;background:var(--accent);color:var(--paper);border-radius:999px}.brand{min-height:44px}.brand-mark{transition:transform var(--diff-transition) ease}.brand:hover .brand-mark{transform:rotate(-8deg)}.brand-mark.mark-spark{transform:rotate(45deg)}.brand:hover .brand-mark.mark-spark{transform:rotate(37deg)}.brand-boxed{padding:6px 10px;border:1px solid var(--accent);border-radius:var(--radius)}.back-link-button,.back-link-crumb{padding:9px 13px;border:1px solid var(--line);border-radius:var(--radius);text-decoration:none}.back-link-button{background:var(--accent);color:var(--paper);border-color:var(--accent)}.back-link-crumb{font-size:.86rem}.tool-actions button,.play-button{border-radius:' + (config.buttonStyle === 'pill' ? '999px' : config.buttonStyle === 'outline' ? 'var(--radius)' : '0') + '}.tool-actions button[type="submit"],.play-button{' + (config.buttonStyle === 'outline' ? 'background:transparent;color:var(--accent);border-color:var(--accent)' : '') + '}' + enterCss;
        componentCss += '.contact-page{display:grid;gap:var(--diff-gap);margin-top:28px}.contact-layout-split{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}.contact-layout-form{max-width:760px;margin-left:auto;margin-right:auto}.contact-layout-form .contact-method{padding:0;border:0;background:transparent}.contact-layout-direct{max-width:760px;margin-left:auto;margin-right:auto}.contact-method,.contact-form{min-width:0;padding:clamp(20px,4vw,38px);border:1px solid var(--line);border-radius:var(--radius);background:var(--paper)}.contact-method h2,.contact-form h2{margin:.1em 0 .55em;font:800 clamp(1.55rem,3vw,2.35rem)/1.05 var(--font-display)}.contact-method p,.contact-form p{max-width:58ch}.contact-email-link,.contact-form button{display:inline-flex;min-height:44px;align-items:center;justify-content:center;margin-top:8px;padding:10px 16px;border:1px solid var(--accent);border-radius:' + (config.buttonStyle === 'pill' ? '999px' : 'var(--radius)') + ';background:' + (config.buttonStyle === 'outline' ? 'transparent' : 'var(--accent)') + ';color:' + (config.buttonStyle === 'outline' ? 'var(--accent)' : 'var(--paper)') + ';font:800 .95rem var(--font-body);text-decoration:none;cursor:pointer}.contact-form{display:grid;gap:16px}.contact-form label{display:grid;gap:7px;font-weight:800}.contact-form input,.contact-form textarea{width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:calc(var(--radius) * .55);background:var(--surface);color:var(--ink);font:inherit;resize:vertical}.contact-form button{justify-self:start}.form-note{margin:0;color:var(--muted);font-size:.82rem}.site-footer{grid-template-columns:minmax(0,1.15fr) minmax(150px,.7fr) minmax(180px,.8fr) auto}.site-footer nav{align-content:start}.site-footer .footer-contact{max-width:32ch}.site-footer-simple .footer-contact{display:none}@media(max-width:900px){.contact-layout-split{grid-template-columns:1fr}.site-footer{grid-template-columns:1fr 1fr}}@media(max-width:680px){.contact-method,.contact-form{padding:22px}.site-footer{grid-template-columns:1fr}}';
        componentCss += paletteScopeCss + '.site-header{background:var(--nav-surface,color-mix(in srgb,var(--paper) 90%,transparent))}.content-card:hover{background:var(--surface-hover,var(--surface))}.site-footer{background:var(--footer-surface,var(--paper))}.tool-actions button[type="submit"],.play-button,.back-link-button,.site-header.nav-style-accent nav a[aria-current="page"],.site-header.nav-style-accent nav a:hover{color:var(--on-accent,#fff)}.contact-email-link,.contact-form button{color:' + (config.buttonStyle === 'outline' ? 'var(--accent)' : 'var(--on-accent,#fff)') + '}';
        // These overrides deliberately come last: design-family rules above use
        // more specific selectors, and must not keep a desktop grid on a phone.
        var responsiveCss = '@media (min-width:681px) and (max-width:900px){html[data-layout] .content-grid{grid-template-columns:repeat(2,minmax(0,1fr))}html[data-layout] .content-card,html[data-layout] .content-card.featured,html[data-layout] .content-card:nth-child(n){display:flex;grid-column:auto;grid-row:auto;grid-template-columns:1fr;height:auto;align-self:auto}}@media (max-width:680px){.site-header{gap:12px;padding-left:16px;padding-right:16px}.site-header.nav-layout-left,.site-header.nav-layout-centered{justify-content:space-between}.brand{min-width:0;max-width:calc(100% - 60px);font-size:clamp(1rem,5vw,1.25rem);overflow:hidden}.brand-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nav-toggle{display:inline-flex;flex:0 0 44px;align-items:center;justify-content:center;border-radius:10px;cursor:pointer}.site-header nav,.site-header.nav-layout-left nav,.site-header.nav-layout-centered nav{position:absolute;top:calc(100% + 8px);left:12px;right:12px;z-index:120;display:none;max-height:calc(100vh - var(--diff-nav-height) - 24px);margin:0;padding:8px;overflow-y:auto;border:1px solid var(--line);border-radius:12px;background:var(--surface);box-shadow:0 18px 38px color-mix(in srgb,var(--ink) 22%,transparent);grid-template-columns:1fr;gap:2px}.site-header nav.is-open{display:grid}.site-header nav a,.site-header.nav-style-underline nav a,.site-header.nav-style-accent nav a{display:flex;align-items:center;min-height:44px;padding:9px 12px;border:0;border-radius:8px;font-size:.95rem}.site-header nav a[aria-current="page"],.site-header nav a:hover{background:color-mix(in srgb,var(--accent) 14%,var(--surface));color:var(--accent)}html[data-layout] .content-grid{grid-template-columns:1fr}html[data-layout] .content-card,html[data-layout] .content-card.featured,html[data-layout] .content-card:nth-child(n){display:flex;grid-column:auto;grid-row:auto;grid-template-columns:1fr;height:auto;align-self:auto}html[data-layout] .content-card figure,html[data-layout] .content-card.featured figure{width:100%;height:auto;min-height:0;max-height:none;aspect-ratio:16/10}html[data-layout] .content-card img,html[data-layout] .content-card.featured img{height:100%;min-height:0;object-fit:cover}html[data-layout] .content-card .card-copy{width:100%;min-height:0}.content-card{transition-duration:var(--diff-transition)}.back-link{margin-bottom:20px}.site-footer{gap:22px}}@media(prefers-reduced-motion:reduce){main,.site-footer{animation:none!important}.site-header,.brand-mark,.content-card{transition:none!important}}';
        // The preview's tablet frame is intentionally treated like a compact device.
        // This prevents a wrapped desktop nav and keeps the header controls centered.
        var tabletResponsiveCss =
          '@media(max-width:900px){' +
            '.site-header{align-items:center;gap:12px;padding-left:16px;padding-right:16px}' +
            '.site-header.nav-layout-left,.site-header.nav-layout-centered{justify-content:space-between}' +
            '.site-header .brand,.site-header .nav-toggle{align-self:center}' +
            '.brand{min-width:0;max-width:calc(100% - 60px);font-size:clamp(1rem,4vw,1.25rem);overflow:hidden}' +
            '.brand-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
            '.nav-toggle{display:inline-flex;flex:0 0 44px;align-items:center;justify-content:center;border-radius:10px;cursor:pointer}' +
            '.site-header nav,.site-header.nav-layout-left nav,.site-header.nav-layout-centered nav{position:absolute;top:calc(100% + 8px);left:12px;right:12px;z-index:120;display:none;max-height:calc(100vh - var(--diff-nav-height) - 24px);margin:0;padding:8px;overflow-y:auto;border:1px solid var(--line);border-radius:12px;background:var(--surface);box-shadow:0 18px 38px color-mix(in srgb,var(--ink) 22%,transparent);grid-template-columns:1fr;gap:2px}' +
            '.site-header nav.is-open{display:grid}' +
            '.site-header nav a,.site-header.nav-style-underline nav a,.site-header.nav-style-accent nav a{display:flex;align-items:center;min-height:44px;padding:9px 12px;border:0;border-radius:8px;font-size:.95rem}' +
            '.site-header nav a[aria-current="page"],.site-header nav a:hover{background:color-mix(in srgb,var(--accent) 14%,var(--surface));color:var(--accent)}' +
          '}' +
          '@media(min-width:681px) and (max-width:900px){' +
            'html[data-layout] .content-grid{grid-template-columns:repeat(2,minmax(0,1fr));align-items:stretch;grid-auto-rows:auto}' +
            'html[data-layout] .content-card,html[data-layout] .content-card.featured,html[data-layout] .content-card:nth-child(n){height:100%;align-self:stretch}' +
            'html[data-layout] .content-card .card-copy{flex:1}' +
          '}';
        // Keep this terminal layer last.  It is deliberately separated from
        // layoutSystemCss() so a template cannot silently undo a user choice.
        var manualOverrideCss = '';
        if (config.homeCategoryLayout) {
            manualOverrideCss += '.home-category-sections{display:grid;gap:clamp(38px,6vw,76px)}.home-category-section{min-width:0}.home-category-heading{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid var(--line)}.home-category-heading .kicker{margin:0 0 5px;color:var(--accent);font-size:.72rem;font-weight:800;text-transform:uppercase}.home-category-heading h2{margin:0;color:var(--ink);font:800 clamp(1.55rem,3vw,2.4rem)/1 var(--font-display)}.home-category-more{display:inline-flex;align-items:center;gap:7px;flex:0 0 auto;color:var(--accent);font-size:.85rem;font-weight:800;text-decoration:none}.home-category-more:hover{text-decoration:underline;text-underline-offset:4px}.home-category-grid{margin:0}@media(max-width:680px){.home-category-sections{gap:42px}.home-category-heading{align-items:start;flex-direction:column;gap:10px;margin-bottom:14px}.home-category-heading h2{font-size:clamp(1.45rem,8vw,2rem)}}';
        }
        // A differentiated site starts as an index, not an advertising-style
        // splash page.  Keep the information block compact even when a family
        // contains a cinematic masthead rule earlier in the stylesheet.
        if (config.homeIntro === 'compact') {
            manualOverrideCss += 'html[data-layout] body[data-home-intro="compact"] .publication-intro{display:grid!important;grid-template-columns:minmax(0,1.2fr) minmax(220px,.8fr)!important;gap:12px 32px!important;min-height:0!important;margin-bottom:28px!important;padding:clamp(18px,3vw,32px) 0!important;background:transparent!important}html[data-layout] body[data-home-intro="compact"] .publication-intro .kicker,html[data-layout] body[data-home-intro="compact"] .publication-intro .edition-meta{grid-column:1/-1!important}html[data-layout] body[data-home-intro="compact"] .publication-intro h1{max-width:12ch!important;font-size:clamp(2.25rem,5vw,4.5rem)!important;line-height:.92!important;letter-spacing:-.045em!important}html[data-layout] body[data-home-intro="compact"] .publication-intro .dek{font-size:clamp(1rem,1.6vw,1.2rem)!important}@media(max-width:680px){html[data-layout] body[data-home-intro="compact"] .publication-intro{grid-template-columns:1fr!important;padding:20px 0!important}html[data-layout] body[data-home-intro="compact"] .publication-intro h1{font-size:clamp(2.15rem,12vw,3.6rem)!important}}';
        }
        function normalizedCardGrid(pageType, selectedColumns) {
            var userGridColumns = selectedColumns === 'auto' ? 'repeat(auto-fill,minmax(280px,1fr))' : 'repeat(' + selectedColumns + ',minmax(0,1fr))';
            var scope = 'html[data-layout] body[data-page-type="' + pageType + '"]';
            // Fixed columns are a deliberate request for the ordinary builder's
            // predictable reading grid. Normalize image ratio, copy density,
            // and text visibility instead of leaving a cinematic template with
            // only its column count changed.
            var standardSummaryCss = config.summaryMode === 'hidden'
                ? scope + ' .content-card .card-copy p{display:none!important}'
                : scope + ' .content-card .card-copy p{display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:' + (config.cardExcerptLines === 'auto' ? '3' : config.cardExcerptLines === 'none' ? 'unset' : config.cardExcerptLines) + '!important;overflow:hidden!important;color:var(--muted)!important}';
            return '@media(min-width:681px){' + scope + ' .content-grid{display:grid!important;grid-template-columns:' + userGridColumns + '!important;column-count:auto!important;grid-auto-rows:auto!important;align-items:stretch!important}' + scope + ' .content-card,' + scope + ' .content-card.featured,' + scope + ' .content-card:nth-child(n){display:flex!important;flex:none!important;flex-direction:column!important;width:auto!important;min-width:0!important;max-width:none!important;height:100%!important;grid-column:auto!important;grid-row:auto!important;overflow:hidden!important;background:var(--surface)!important}' + scope + ' .content-card figure,' + scope + ' .content-card.featured figure{display:block!important;grid-column:auto!important;grid-row:auto!important;width:100%!important;height:auto!important;min-height:0!important;aspect-ratio:16/10!important;margin:0!important;overflow:hidden!important}' + scope + ' .content-card figure img{display:block!important;width:100%!important;height:100%!important;min-height:0!important;object-fit:cover!important}' + scope + ' .content-card .card-copy{display:flex!important;flex:1!important;flex-direction:column!important;width:100%!important;min-height:0!important;padding:20px!important;background:var(--surface)!important;color:var(--ink)!important}' + scope + ' .content-card .eyebrow{display:block!important;color:var(--accent)!important}' + scope + ' .content-card .card-copy h2{display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:3!important;overflow:hidden!important;color:var(--ink)!important}' + scope + ' .content-card .card-action{display:block!important;margin-top:auto!important;color:var(--accent)!important}' + standardSummaryCss + '}';
        }
        var homeCardColumns = config.cardColumns || 'template';
        var categoryCardColumns = config.categoryCardColumns || 'inherit';
        if (homeCardColumns !== 'template') manualOverrideCss += normalizedCardGrid('home', homeCardColumns);
        var effectiveCategoryColumns = categoryCardColumns === 'inherit' ? homeCardColumns : categoryCardColumns;
        if (effectiveCategoryColumns !== 'template') manualOverrideCss += normalizedCardGrid('section', effectiveCategoryColumns);
        if (config.cardViewMode === 'list') {
            manualOverrideCss += '@media(min-width:681px){html[data-layout] .content-grid{grid-template-columns:1fr!important}html[data-layout] .content-card,html[data-layout] .content-card.featured{display:grid!important;grid-template-columns:minmax(220px,34%) minmax(0,1fr)!important}html[data-layout] .content-card figure{height:100%!important;min-height:190px!important;aspect-ratio:auto!important}html[data-layout] .content-card .card-copy{padding:clamp(18px,3vw,30px)!important}}';
        } else if (config.cardViewMode === 'compact') {
            manualOverrideCss += '@media(min-width:681px){html[data-layout] .content-grid{grid-template-columns:repeat(auto-fit,minmax(190px,1fr))!important}html[data-layout] .content-card figure{aspect-ratio:1!important;min-height:0!important}html[data-layout] .content-card .card-copy{padding:14px!important}}';
        }
        if (config.cardBorder !== 'auto') {
            var borderRule = { rounded: 'border:1px solid var(--line)!important;box-shadow:0 2px 8px color-mix(in srgb,var(--ink) 16%,transparent)!important', shadow: 'border:0!important;box-shadow:0 8px 22px color-mix(in srgb,var(--ink) 22%,transparent)!important', thin: 'border:1px solid var(--line)!important;box-shadow:none!important', double: 'border:3px double var(--line)!important;box-shadow:none!important', dashed: 'border:1px dashed var(--line)!important;box-shadow:none!important', thick: 'border:3px solid var(--line)!important;box-shadow:none!important', none: 'border:0!important;box-shadow:none!important' }[config.cardBorder];
            manualOverrideCss += 'html[data-layout] .content-card,html[data-layout] .content-card.featured,html[data-layout] .content-card:nth-child(n){' + borderRule + '}';
        }
        if (config.cardSpacing !== 'auto') manualOverrideCss += 'html[data-layout] .content-card .card-copy{padding:' + config.cardSpacing + '!important}';
        if (config.cardExcerptLines !== 'auto') manualOverrideCss += 'html[data-layout] .content-card .card-copy p{-webkit-line-clamp:' + (config.cardExcerptLines === 'none' ? 'unset' : config.cardExcerptLines) + '!important}';
        if (config.cardImageHeight !== 'auto') manualOverrideCss += 'html[data-layout] .content-card figure{height:' + config.cardImageHeight + '!important;min-height:' + config.cardImageHeight + '!important;aspect-ratio:auto!important}html[data-layout] .content-card img{height:100%!important;min-height:0!important}';
        var selectedCoverFit = config.coverFit || 'smart';
        if (selectedCoverFit !== 'template') {
            var coverRule = {
                smart: 'object-fit:cover!important;object-position:center!important',
                cover: 'object-fit:cover!important;object-position:center!important',
                contain: 'object-fit:contain!important;object-position:center!important',
                top: 'object-fit:cover!important;object-position:center top!important',
                bottom: 'object-fit:cover!important;object-position:center bottom!important'
            }[selectedCoverFit];
            manualOverrideCss += 'html[data-layout] body[data-page-type] .content-card figure{background:color-mix(in srgb,var(--surface) 88%,var(--paper))!important}html[data-layout] body[data-page-type] .content-card figure img{' + coverRule + '}';
            if (selectedCoverFit === 'smart') manualOverrideCss += 'html[data-layout] body[data-page-type] .content-card figure.has-portrait-cover{position:relative!important;isolation:isolate!important;overflow:hidden!important;background:color-mix(in srgb,var(--surface) 82%,var(--paper))!important}html[data-layout] body[data-page-type] .content-card figure.has-portrait-cover img.cover-backdrop{display:block!important;position:absolute!important;inset:-18px!important;width:calc(100% + 36px)!important;height:calc(100% + 36px)!important;min-width:0!important;min-height:0!important;object-fit:cover!important;object-position:center!important;filter:blur(18px) saturate(.72) brightness(.68)!important;transform:scale(1.08)!important;opacity:.82!important;z-index:0!important;pointer-events:none!important}html[data-layout] body[data-page-type] .content-card figure.has-portrait-cover img.is-portrait-cover{position:relative!important;z-index:1!important;object-fit:contain!important;object-position:center!important}';
        }
        var selectedCardHeight = config.cardHeight || 'template';
        if (selectedCardHeight !== 'template') {
            var cardHeightRule = selectedCardHeight === 'auto'
                ? 'height:auto!important;min-height:0!important;max-height:none!important;align-self:start!important'
                : 'height:' + selectedCardHeight + '!important;min-height:' + selectedCardHeight + '!important;max-height:' + selectedCardHeight + '!important';
            manualOverrideCss += 'html[data-layout] .content-card,html[data-layout] .content-card.featured,html[data-layout] .content-card:nth-child(n){' + cardHeightRule + '}html[data-layout] .content-card .card-copy{overflow:hidden!important}';
        }
        if (config.contentMaxWidth !== 'auto') manualOverrideCss += 'main,.site-header,.site-footer{max-width:' + (config.contentMaxWidth === 'full' ? 'none' : config.contentMaxWidth) + '!important}';
        if (config.metaBg !== 'auto') {
            var metaRule = { dark: 'var(--surface)', light: 'color-mix(in srgb,var(--paper) 72%,var(--surface))', primary: 'color-mix(in srgb,var(--accent) 12%,var(--surface))', bordered: 'transparent', transparent: 'transparent' }[config.metaBg];
            manualOverrideCss += '.byline{background:' + metaRule + '!important' + (config.metaBg === 'bordered' ? ';border:1px solid var(--line)!important' : '') + '}';
        }
        if (config.detailImgStyle !== 'auto') {
            var detailImageRule = { fullwidth: 'max-width:none;margin-left:0;margin-right:0;display:block', centered: 'max-width:80%;margin-left:auto;margin-right:auto;display:block', 'float-left': 'float:left;max-width:50%;margin-right:24px;margin-bottom:12px', 'float-right': 'float:right;max-width:50%;margin-left:24px;margin-bottom:12px', banner: 'width:100%;max-height:260px;object-fit:cover' }[config.detailImgStyle];
            manualOverrideCss += '.article-cover img{' + detailImageRule + '!important}';
        }
        if (config.categoryTitleStyle !== 'auto') {
            var headingRule = { single: 'border-bottom:2px solid var(--accent);padding-bottom:10px', none: 'border-bottom:0;padding-bottom:0', double: 'border-bottom:4px double var(--accent);padding-bottom:10px', dotted: 'border-bottom:2px dotted var(--accent);padding-bottom:10px', gradient: 'border-bottom:3px solid var(--accent);border-image:linear-gradient(90deg,var(--accent),transparent) 1;padding-bottom:10px', 'left-accent': 'border-bottom:0;border-left:4px solid var(--accent);padding:0 0 0 12px' }[config.categoryTitleStyle];
            manualOverrideCss += '.section-heading h1{' + headingRule + '!important}';
        }
        if (config.categoryTitleAlign !== 'auto') manualOverrideCss += '.section-heading{text-align:' + config.categoryTitleAlign + '!important}.section-heading h1{display:inline-block}';
        if (config.heroStyle !== 'auto') {
            var heroRule = { gradient: 'linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 25%,var(--paper)))', solid: 'var(--surface)', minimal: 'transparent', pattern: 'repeating-linear-gradient(45deg,color-mix(in srgb,var(--accent) 9%,var(--paper)),color-mix(in srgb,var(--accent) 9%,var(--paper)) 10px,var(--paper) 10px,var(--paper) 20px)' }[config.heroStyle];
            manualOverrideCss += '.publication-intro{padding:clamp(20px,4vw,44px)!important;background:' + heroRule + '!important' + (config.heroStyle === 'minimal' ? ';border-bottom:1px solid var(--line)' : '') + '}';
        }
        if (config.detailLayout === 'sidebar') manualOverrideCss += '@media(min-width:900px){.article,.tool-detail,.game-detail{max-width:1400px!important;display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:42px}.article>header,.article>.article-cover,.article>.article-body,.article>.sources{grid-column:1}}';
        if (config.fontStyle !== 'auto') {
            var fontRule = { 'sans-serif': 'Arial,sans-serif', serif: 'Georgia,serif', mono: '"IBM Plex Mono","Courier New",monospace', rounded: 'Nunito,Arial,sans-serif', condensed: '"Arial Narrow",Arial,sans-serif', elegant: 'Lora,Georgia,serif', modern: 'Manrope,Arial,sans-serif', tech: '"IBM Plex Sans",Arial,sans-serif', handwritten: 'cursive', 'chinese-serif': '"Noto Serif SC",serif', 'chinese-kai': 'KaiTi,STKaiti,serif', 'chinese-hei': 'Microsoft YaHei,Arial,sans-serif' }[config.fontStyle];
            manualOverrideCss += 'body{font-family:' + fontRule + '!important}.brand,.publication-intro h1,.card-copy h2,.article h1,.section-heading h1{font-family:' + fontRule + '!important}';
        }
        if (config.navStyle === 'transparent') manualOverrideCss += '.site-header{background:transparent!important;backdrop-filter:none!important;box-shadow:none!important}';
        if (config.navStyle === 'dark-fixed') manualOverrideCss += '.site-header{position:sticky!important;background:var(--ink)!important;color:var(--paper)!important}.site-header .brand span,.site-header nav a{color:inherit!important}';
        if (config.navStyle === 'bottom-fixed') manualOverrideCss += '@media(min-width:681px){.site-header{position:fixed!important;top:auto!important;bottom:0;left:0;right:0;z-index:120}main{padding-bottom:140px!important}}';
        if (config.navStyle === 'side-drawer') manualOverrideCss += '@media(min-width:1000px){.site-header{position:fixed!important;top:0;bottom:0;left:0;width:230px;flex-direction:column;align-items:flex-start;padding:28px 20px;justify-content:flex-start}.site-header nav{display:grid;justify-content:stretch;width:100%;gap:4px}.site-header nav a{padding:9px 0}main,.site-footer{margin-left:230px!important}}';
        if (config.buttonSize !== 'auto') {
            var buttonSizeRule = { xsmall: '.72rem;padding:6px 10px;min-height:30px', small: '.82rem;padding:8px 13px;min-height:36px', medium: '.95rem;padding:10px 16px;min-height:44px', large: '1.05rem;padding:12px 20px;min-height:50px', xlarge: '1.15rem;padding:15px 26px;min-height:58px' }[config.buttonSize];
            manualOverrideCss += '.tool-actions button,.play-button,.contact-form button,.contact-email-link{' + buttonSizeRule + '!important}';
        }
        if (config.buttonStyle === 'gradient') manualOverrideCss += '.tool-actions button[type="submit"],.play-button,.contact-form button,.contact-email-link{background:linear-gradient(135deg,var(--accent),var(--accent2))!important;color:var(--paper)!important}';
        if (config.buttonStyle === 'square') manualOverrideCss += '.tool-actions button,.play-button,.contact-form button,.contact-email-link{border-radius:0!important}';
        if (config.buttonStyle === 'rounded') manualOverrideCss += '.tool-actions button,.play-button,.contact-form button,.contact-email-link{border-radius:10px!important}';
        if (config.buttonStyle === '3d') manualOverrideCss += '.tool-actions button[type="submit"],.play-button,.contact-form button,.contact-email-link{box-shadow:0 4px 0 color-mix(in srgb,var(--accent) 55%,#000)!important;transform:translateY(-2px)}';
        if (config.buttonStyle === 'ghost') manualOverrideCss += '.tool-actions button[type="submit"],.play-button,.contact-form button,.contact-email-link{background:transparent!important;color:var(--accent)!important;border-color:var(--accent)!important}';
        css += componentCss + responsiveCss + tabletResponsiveCss + layoutSystemCss() + manualOverrideCss + cardRadiusOverrideCss;
        return css
            .replace('html[data-layout="split-feature"] .content-card:nth-child(3n+1){grid-row:span 2}', 'html[data-layout="split-feature"] .content-card:nth-child(3n+1){grid-row:auto}')
            .replace('.content-card:nth-child(3n+1{grid-row:span 2}', '.content-card:nth-child(3n+1){grid-row:auto}');
    }

    function generateWaitingPreviewHtml(siteType) {
        var labels = { editorial: 'editorial', tools: 'utility', games: 'game' };
        var label = labels[siteType] || 'site';
        return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Source package required</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f4f0e7;color:#16202a;font:16px/1.6 system-ui,sans-serif}.notice{max-width:620px;padding:clamp(28px,7vw,64px);border:1px solid #cfc7b8;background:#fffdf8;box-shadow:10px 10px 0 #c84b31}.kicker{margin:0 0 12px;color:#c84b31;font-size:.75rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase}h1{margin:0 0 18px;font:800 clamp(2.25rem,8vw,5rem)/.95 Georgia,serif;letter-spacing:-.04em}p{margin:0;max-width:46ch}</style></head><body><main class="notice"><p class="kicker">Independent build</p><h1>Upload this site’s source package.</h1><p>The ' + label + ' preview is intentionally empty so content and design choices from a previous batch cannot be inherited by mistake.</p></main></body></html>';
    }

    function executeToolOperation(operation, input, options) {
        input = String(input == null ? '' : input);
        options = options && typeof options === 'object' ? options : {};
        function numberList(value) { return String(value).split(/[\s,;]+/).filter(Boolean).map(Number); }
        function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a || 1; }
        function utf8ToBase64(value) { return btoa(unescape(encodeURIComponent(value))); }
        function base64ToUtf8(value) { return decodeURIComponent(escape(atob(value.trim()))); }
        switch (operation) {
            case 'word-count': return String((input.trim().match(/\S+/g) || []).length);
            case 'character-count': return String(input.length);
            case 'line-count': return String(input === '' ? 0 : input.split(/\r?\n/).length);
            case 'slugify': return input.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
            case 'lowercase': return input.toLowerCase();
            case 'uppercase': return input.toUpperCase();
            case 'title-case': return input.toLowerCase().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
            case 'sentence-case': return input.toLowerCase().replace(/(^|[.!?]\s+)([a-z])/g, function (_, a, b) { return a + b.toUpperCase(); });
            case 'reverse-text': return Array.from(input).reverse().join('');
            case 'sort-lines': return input.split(/\r?\n/).sort(function (a, b) { return a.localeCompare(b); }).join('\n');
            case 'dedupe-lines': return Array.from(new Set(input.split(/\r?\n/))).join('\n');
            case 'trim-lines': return input.split(/\r?\n/).map(function (line) { return line.trim(); }).join('\n');
            case 'remove-empty-lines': return input.split(/\r?\n/).filter(function (line) { return line.trim(); }).join('\n');
            case 'find-replace': return input.split(String(options.find || '')).join(String(options.replace || ''));
            case 'json-format': return JSON.stringify(JSON.parse(input), null, Number(options.spaces || 2));
            case 'json-minify': return JSON.stringify(JSON.parse(input));
            case 'json-validate': JSON.parse(input); return 'Valid JSON';
            case 'csv-to-json': {
                var rows = input.trim().split(/\r?\n/).map(function (row) { return row.split(',').map(function (cell) { return cell.trim(); }); });
                var headers = rows.shift() || [];
                return JSON.stringify(rows.map(function (row) { return headers.reduce(function (obj, header, index) { obj[header] = row[index] || ''; return obj; }, {}); }), null, 2);
            }
            case 'base64-encode': return utf8ToBase64(input);
            case 'base64-decode': return base64ToUtf8(input);
            case 'url-encode': return encodeURIComponent(input);
            case 'url-decode': return decodeURIComponent(input);
            case 'html-escape': return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            case 'html-unescape': return input.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
            case 'timestamp-to-date': { var timestamp = Number(input.trim()); if (timestamp < 1e12) timestamp *= 1000; return new Date(timestamp).toISOString(); }
            case 'date-to-timestamp': { var time = Date.parse(input.trim()); if (!Number.isFinite(time)) throw new Error('Enter a valid date.'); return String(Math.floor(time / 1000)); }
            case 'percent-change': { var pc = numberList(input); if (pc.length < 2 || pc[0] === 0) throw new Error('Enter old and new values, separated by a comma.'); return (((pc[1] - pc[0]) / Math.abs(pc[0])) * 100).toFixed(Number(options.decimals || 2)) + '%'; }
            case 'percentage-of': { var po = numberList(input); if (po.length < 2) throw new Error('Enter percentage and total, separated by a comma.'); return String((po[0] / 100) * po[1]); }
            case 'ratio-simplify': { var ratio = numberList(input); if (ratio.length < 2) throw new Error('Enter two numbers.'); var divisor = gcd(ratio[0], ratio[1]); return (ratio[0] / divisor) + ':' + (ratio[1] / divisor); }
            case 'temperature': { var temp = Number(input); var from = String(options.from || 'c').toLowerCase(); var to = String(options.to || 'f').toLowerCase(); var c = from === 'f' ? (temp - 32) * 5 / 9 : from === 'k' ? temp - 273.15 : temp; return String(to === 'f' ? c * 9 / 5 + 32 : to === 'k' ? c + 273.15 : c); }
            case 'length': { var length = Number(input); var lengthUnits = { m: 1, km: 1000, cm: .01, mm: .001, in: .0254, ft: .3048, yd: .9144, mi: 1609.344 }; var lf = String(options.from || 'm'), lt = String(options.to || 'ft'); if (!lengthUnits[lf] || !lengthUnits[lt]) throw new Error('Unsupported unit.'); return String(length * lengthUnits[lf] / lengthUnits[lt]); }
            case 'weight': { var weight = Number(input); var weightUnits = { kg: 1, g: .001, lb: .45359237, oz: .028349523125 }; var wf = String(options.from || 'kg'), wt = String(options.to || 'lb'); if (!weightUnits[wf] || !weightUnits[wt]) throw new Error('Unsupported unit.'); return String(weight * weightUnits[wf] / weightUnits[wt]); }
            case 'bytes': { var bytes = Number(input); var byteUnits = { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, kib: 1024, mib: 1048576, gib: 1073741824 }; var bf = String(options.from || 'b').toLowerCase(), bt = String(options.to || 'mb').toLowerCase(); if (!byteUnits[bf] || !byteUnits[bt]) throw new Error('Unsupported unit.'); return String(bytes * byteUnits[bf] / byteUnits[bt]); }
            case 'pace': { var pace = numberList(input); if (pace.length < 2 || pace[1] <= 0) throw new Error('Enter duration in minutes and distance.'); var minutes = pace[0] / pace[1]; return Math.floor(minutes) + ':' + String(Math.round((minutes % 1) * 60)).padStart(2, '0') + ' per unit'; }
            default: throw new Error('Unsupported tool operation.');
        }
    }

    function generateRuntimeJs(config) {
        var toolFn = executeToolOperation.toString();
        var adJs = '';
        var smartCoverJs = config.coverFit === 'smart'
            ? 'document.querySelectorAll(".content-card img[data-cover-fit=\\"smart\\"]").forEach(function(image){function protectPortrait(){if(!image.naturalWidth||!image.naturalHeight)return;var portrait=image.naturalHeight>image.naturalWidth*1.08;image.classList.toggle("is-portrait-cover",portrait);var figure=image.closest("figure");if(!figure)return;figure.classList.toggle("has-portrait-cover",portrait);var backdrop=figure.querySelector("img.cover-backdrop");if(portrait&&!backdrop){backdrop=image.cloneNode(false);backdrop.className="cover-backdrop";backdrop.alt="";backdrop.setAttribute("aria-hidden","true");backdrop.loading="eager";backdrop.decoding="async";figure.insertBefore(backdrop,image);}else if(!portrait&&backdrop){backdrop.remove();}}if(image.complete)protectPortrait();else image.addEventListener("load",protectPortrait,{once:true});});'
            : '';
        if (config.exportVariant === 'ad-ready' && config.adCode) {
            var paths = config.adCode.config || {};
            adJs = 'window.googletag=window.googletag||{cmd:[]};var g=document.createElement("script");g.async=true;g.src="https://securepubads.g.doubleclick.net/tag/js/gpt.js";document.head.appendChild(g);googletag.cmd.push(function(){' + [1, 2, 3].map(function (slot) {
                var path = String(paths['bannerPath' + slot] || '');
                return path ? 'if(document.getElementById("div-gpt-ad-banner' + slot + '")){googletag.defineSlot(' + JSON.stringify(path) + ',[[300,250],[728,90]],"div-gpt-ad-banner' + slot + '").addService(googletag.pubads());}' : '';
            }).join('') + 'googletag.pubads().enableSingleRequest();googletag.enableServices();' + [1, 2, 3].map(function (slot) { return 'if(document.getElementById("div-gpt-ad-banner' + slot + '"))googletag.display("div-gpt-ad-banner' + slot + '");'; }).join('') + '});';
        }
        return '(function(){"use strict";document.querySelectorAll("[data-current-year]").forEach(function(node){node.textContent=String(new Date().getFullYear());});var toggle=document.querySelector(".nav-toggle"),nav=document.getElementById("site-nav");function closeNavigation(returnFocus){if(!toggle||!nav)return;toggle.setAttribute("aria-expanded","false");toggle.setAttribute("aria-label","Open menu");nav.classList.remove("is-open");if(returnFocus)toggle.focus();}function setNavigation(open){if(!toggle||!nav)return;toggle.setAttribute("aria-expanded",open?"true":"false");toggle.setAttribute("aria-label",open?"Close menu":"Open menu");nav.classList.toggle("is-open",open);}if(toggle&&nav){toggle.addEventListener("click",function(){setNavigation(toggle.getAttribute("aria-expanded")!=="true");});nav.querySelectorAll("a").forEach(function(link){link.addEventListener("click",function(){closeNavigation(false);});});document.addEventListener("keydown",function(event){if(event.key==="Escape"&&toggle.getAttribute("aria-expanded")==="true")closeNavigation(true);});window.addEventListener("resize",function(){if(window.innerWidth>680)closeNavigation(false);});}' + smartCoverJs + 'var executeToolOperation=' + toolFn + ';document.querySelectorAll("[data-tool-operation]").forEach(function(workbench){var form=workbench.querySelector("form"),output=workbench.querySelector("[data-tool-output]");if(!form||!output)return;form.addEventListener("submit",function(event){event.preventDefault();try{var options={};var optionsValue=form.elements.options.value.trim();if(optionsValue)options=JSON.parse(optionsValue);output.textContent=executeToolOperation(workbench.dataset.toolOperation,form.elements.input.value,options);}catch(error){output.textContent="Error: "+error.message;}});form.addEventListener("reset",function(){setTimeout(function(){output.textContent="";},0);});});' + adJs + '})();';
    }

    function generatePreviewNavigationJs(config) {
        var itemRoutes = {};
        var sectionRoutes = {};
        config.items.forEach(function (item, index) { itemRoutes[itemPath(config, item)] = index; });
        config.categories.forEach(function (category) { sectionRoutes['sections/' + category.slug + '/index.html'] = category.slug; });
        var pageRoutes = {
            '': 'home',
            'index.html': 'home',
            'about/index.html': 'about',
            'contact/index.html': 'contact',
            'privacy/index.html': 'privacy',
            'terms/index.html': 'terms',
            'editorial-standards/index.html': 'editorial-standards'
        };
        return '(function(){"use strict";var itemRoutes=' + JSON.stringify(itemRoutes) + ',sectionRoutes=' + JSON.stringify(sectionRoutes) + ',pageRoutes=' + JSON.stringify(pageRoutes) + ';document.addEventListener("click",function(event){if(event.defaultPrevented||event.button!==0)return;var anchor=event.target.closest&&event.target.closest("a[href]");if(!anchor||anchor.hasAttribute("download"))return;var href=anchor.getAttribute("href")||"";var colon=href.indexOf(":");if(!href||href.charAt(0)==="#"||href.slice(0,2)==="//"||(colon>0&&href.slice(0,colon).indexOf("/")===-1))return;var path=href.split("#")[0].split("?")[0];while(path.indexOf("../")===0)path=path.slice(3);if(path.indexOf("./")===0)path=path.slice(2);while(path.charAt(0)==="/")path=path.slice(1);var message=null;if(Object.prototype.hasOwnProperty.call(itemRoutes,path))message={type:"preview-nav",page:"detail",itemIndex:itemRoutes[path]};else if(Object.prototype.hasOwnProperty.call(sectionRoutes,path))message={type:"preview-nav",page:"section",categorySlug:sectionRoutes[path]};else if(Object.prototype.hasOwnProperty.call(pageRoutes,path))message={type:"preview-nav",page:pageRoutes[path]};if(!message)return;event.preventDefault();window.parent.postMessage(message,"*");});})();';
    }

    function createSitemap(config) {
        var baseUrl = config.baseUrl || 'https://draft.invalid';
        var paths = [''].concat(config.categories.map(function (category) { return 'sections/' + category.slug + '/'; }))
            .concat(config.items.map(function (item) { return itemPath(config, item).replace(/index\.html$/, ''); }))
            .concat(['about/', 'contact/', 'privacy/', 'terms/', 'editorial-standards/']);
        var draftNote = config.baseUrl ? '' : '<!-- DRAFT ONLY: replace https://draft.invalid with the final HTTPS domain before requesting indexing. -->\n';
        return '<?xml version="1.0" encoding="UTF-8"?>\n' + draftNote + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + paths.map(function (path) {
            return '  <url><loc>' + escapeHtml(baseUrl + '/' + String(path || '').replace(/^\/+/, '')) + '</loc></url>';
        }).join('\n') + '\n</urlset>';
    }

    function provenanceLedger(config) {
        if (config.packageData.provenance && Array.isArray(config.packageData.provenance.articles)) return config.packageData.provenance;
        return {
            schema_version: 1,
            site: { name: config.siteTitle, base_url: config.baseUrl, language: 'en' },
            articles: config.type === 'editorial' ? config.items.map(function (item) {
                return {
                    path: itemPath(config, item), title: item.title,
                    article_creation: String(firstValue(item.raw, ['article_creation'], 'unspecified-needs-publisher-review')),
                    writing_assistance: item.writingAssistance || 'unspecified-needs-publisher-review',
                    fact_checked: item.factChecked,
                    sources: item.sources,
                    cover: { path: item.coverOutput || '', origin: String(firstValue(item.raw, ['cover_origin'], 'unspecified-needs-publisher-review')), source_url: firstValue(item.raw, ['cover_source_url'], null), license: firstValue(item.raw, ['cover_license'], null), creator: firstValue(item.raw, ['cover_creator'], '') }
                };
            }) : []
        };
    }

    function designLedger(config) {
        var supplied = config.packageData.designReferences;
        if (supplied && Array.isArray(supplied.references)) return supplied;
        return { schema_version: 1, domain_blueprint: { id: config.design.id, domain_id: config.domain.id, domain: config.domain.name }, visual_direction: config.design.name + ' for ' + config.vertical, original_adaptation_confirmed: true, references: [], note: 'Generated from the internal composition system; no external design code or assets were recorded.' };
    }

    async function exportWebsite(appState, onProgress, options) {
        onProgress = typeof onProgress === 'function' ? onProgress : function () {};
        var outcome = await audit(appState, options);
        var config = outcome.config;
        var report = outcome.report;
        if (config.exportVariant !== 'draft' && report.counts.blockers) throw new Error('质量门禁未通过：' + report.counts.blockers + ' 个阻断项。请先查看导出摘要。');
        var Zip = getZipCtor(options);
        if (!Zip) throw new Error('ZIP 导出组件未加载。');
        var zip = new Zip();
        var site = zip.folder('website');
        onProgress(8, '正在生成差异化设计系统…');
        site.file('assets/site.css', generateCss(config));
        site.file('assets/site.js', generateRuntimeJs(config));
        site.file('index.html', homePage(config));
        onProgress(22, '正在生成分类与信任页面…');
        config.categories.forEach(function (category) { site.file('sections/' + category.slug + '/index.html', sectionPage(config, category)); });
        ['about', 'contact', 'privacy', 'terms', 'editorial-standards'].forEach(function (key) { site.file(key + '/index.html', standardPage(config, key)); });
        site.file('404/index.html', notFoundPage(config));
        for (var i = 0; i < config.items.length; i += 1) {
            var item = config.items[i];
            var html = config.type === 'editorial' ? articlePage(config, item) : config.type === 'tools' ? toolPage(config, item) : gamePage(config, item);
            site.file(itemPath(config, item), html);
            if (i % 5 === 0 || i === config.items.length - 1) {
                onProgress(25 + Math.round((i + 1) / Math.max(1, config.items.length) * 42), '正在生成内容页 (' + (i + 1) + '/' + config.items.length + ')…');
                await new Promise(function (resolve) { setTimeout(resolve, 0); });
            }
        }
        onProgress(70, '正在复制唯一封面与本地资源…');
        Object.keys(config.outputAssets).forEach(function (path) { site.file(path, config.outputAssets[path]); });
        if (config.type === 'games') {
            config.items.forEach(function (item) {
                if (item.localEntrySource && item.localEntryOutput) site.file(item.localEntryOutput, config.localGameFiles[item.localEntrySource]);
            });
            Object.keys(config.gameOutputAssets).filter(function (path) { return !/\.json$/i.test(path); }).forEach(function (path) { site.file(path, config.gameOutputAssets[path]); });
        }
        site.file('robots.txt', config.baseUrl ? 'User-agent: *\nAllow: /\nSitemap: ' + canonical(config, 'sitemap.xml') + '\n' : 'User-agent: *\nDisallow: /\n# Draft export: add the final HTTPS base URL before deployment.\nSitemap: https://draft.invalid/sitemap.xml\n');
        site.file('sitemap.xml', createSitemap(config));
        site.file('site-audit-report.json', JSON.stringify(report, null, 2));
        site.file('.editorial/content-provenance.json', JSON.stringify(provenanceLedger(config), null, 2));
        site.file('.editorial/design-references.json', JSON.stringify(designLedger(config), null, 2));
        site.file('.editorial/design-settings.json', JSON.stringify({
            schema_version: 1,
            site_title: config.siteTitle,
            domain: config.domain,
            design_family: config.design.id,
            typography: config.typography.id,
            brand_mark: config.brandMark.id,
            logo_icon: config.logoIcon,
            logo_style: config.logoStyle,
            nav_layout: config.navLayout,
            nav_style: config.navStyle,
            nav_height: config.navHeight,
            nav_category_limit: config.navCategoryLimit,
            contact_layout: config.contactLayout,
            contact_fields: config.contactFields,
            footer_style: config.footerStyle,
            footer_links: config.footerLinks,
            tone: config.tone,
            theme_preset: config.themePreset,
            content_density: config.contentDensity,
            grid_gap: config.gridGap,
            card_alignment: config.cardAlignment,
            card_radius: config.cardRadius,
            card_hover: config.cardHover,
            button_style: config.buttonStyle,
            back_link_style: config.backLinkStyle,
            animation_enter: config.animationEnter,
            transition_speed: config.transitionSpeed
        }, null, 2));
        site.file('README.txt', [
            config.siteTitle, '', 'Static export variant: ' + config.exportVariant,
            'Site type: ' + config.type, 'Vertical: ' + config.vertical, 'Recognized domain: ' + config.domain.name + ' (' + config.domain.id + ')',
            'Design family: ' + config.design.name, 'Design fingerprint: ' + config.designFingerprint,
            '', 'Serve the website directory with any static HTTP server.',
            'Review site-audit-report.json and .editorial records before deployment.',
            'Automated checks do not guarantee factual accuracy, Search ranking, or AdSense approval.'
        ].join('\n'));
        onProgress(88, '正在写入质量与来源记录…');
        var blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }, function (metadata) {
            onProgress(88 + Math.round(metadata.percent * .12), '正在压缩静态网站…');
        });
        rememberDesign(config);
        onProgress(100, '导出完成！');
        return blob;
    }

    function generatePreviewHtml(appState, pageType, options) {
        options = options || {};
        var config = buildConfig(appState, Object.assign({}, options, { variant: 'draft' }));
        if (!config.items.length) return '<!doctype html><html lang="en"><body><p>No content loaded.</p></body></html>';
        var requestedIndex = Number(options.itemIndex);
        var itemIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < config.items.length ? requestedIndex : 0;
        var selectedItem = config.items[itemIndex];
        var selectedSection = config.categories.find(function (category) { return category.slug === String(options.categorySlug || ''); }) || config.categories[0];
        var html = pageType === 'detail'
            ? (config.type === 'editorial' ? articlePage(config, selectedItem) : config.type === 'tools' ? toolPage(config, selectedItem) : gamePage(config, selectedItem))
            : (pageType === 'section' && selectedSection ? sectionPage(config, selectedSection) : (['about', 'contact', 'privacy', 'terms', 'editorial-standards'].indexOf(pageType) !== -1 ? standardPage(config, pageType) : homePage(config)));
        html = html.replace(/<link rel="stylesheet" href="[^"]*assets\/site\.css">/, '<style>' + generateCss(config) + '</style>');
        html = html.replace(/<script src="[^"]*assets\/site\.js" defer><\/script>/, '<script>' + generateRuntimeJs(config).replace(/<\/script/gi, '<\\/script') + '<\/script>');
        html = html.replace('</body>', '<script>' + generatePreviewNavigationJs(config).replace(/<\/script/gi, '<\\/script') + '<\/script></body>');
        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
            Object.keys(config.outputAssets).forEach(function (path) {
                var sourcePath = Object.keys(config.assetBySource || {}).find(function (candidate) { return config.assetBySource[candidate] === path; }) || '';
                var previewDataUrl = String((appState.localImageDataUrls || {})[sourcePath] || '');
                if (/^data:image\//i.test(previewDataUrl)) {
                    var escapedDataPath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    html = html.replace(new RegExp('src="(?:\\.\\.\\/)*' + escapedDataPath + '"', 'g'), 'src="' + escapeHtml(previewDataUrl) + '"');
                    return;
                }
                var objectUrl = URL.createObjectURL(config.outputAssets[path]);
                if (Array.isArray(appState._previewBlobUrls)) appState._previewBlobUrls.push(objectUrl);
                var escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                html = html.replace(new RegExp('src="(?:\\.\\.\\/)*' + escapedPath + '"', 'g'), 'src="' + escapeHtml(objectUrl) + '"');
            });
        }
        return html;
    }

    return {
        BUILD_VERSION: BUILD_VERSION,
        SCHEMA_VERSION: SCHEMA_VERSION,
        SITE_TYPES: SITE_TYPES.slice(),
        DESIGN_FAMILIES: DESIGN_FAMILIES,
        DOMAIN_PROFILES: DOMAIN_PROFILES,
        DOMAIN_COMPOSITION_MODES: DOMAIN_COMPOSITION_MODES,
        getDesignFamilies: getDesignFamilies,
        TYPOGRAPHY_PAIRS: TYPOGRAPHY_PAIRS,
        BRAND_MARKS: BRAND_MARKS,
        TOOL_OPERATIONS: TOOL_OPERATIONS.slice(),
        MIN_EDITORIAL_ITEMS: MIN_EDITORIAL_ITEMS,
        MAX_EDITORIAL_ITEMS: MAX_EDITORIAL_ITEMS,
        MIN_EDITORIAL_WORDS: MIN_EDITORIAL_WORDS,
        MIN_TOOL_ITEMS: MIN_TOOL_ITEMS,
        GOOGLE_OPT_OUT_URL: GOOGLE_OPT_OUT_URL,
        GOOGLE_PARTNER_URL: GOOGLE_PARTNER_URL,
        escapeHtml: escapeHtml,
        stripMarkup: stripMarkup,
        countEnglishWords: countEnglishWords,
        slugify: slugify,
        safeUrl: safeUrl,
        stableHash: stableHash,
        normalizeItem: normalizeItem,
        extractData: extractData,
        detectSiteType: detectSiteType,
        importJsonData: importJsonData,
        importZip: importZip,
        buildConfig: buildConfig,
        auditConfig: auditConfig,
        audit: audit,
        renderAuditSummary: renderAuditSummary,
        executeToolOperation: executeToolOperation,
        generateCss: generateCss,
        generateRuntimeJs: generateRuntimeJs,
        generateWaitingPreviewHtml: generateWaitingPreviewHtml,
        generatePreviewHtml: generatePreviewHtml,
        exportWebsite: exportWebsite
    };
});
