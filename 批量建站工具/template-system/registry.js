/**
 * Independent template packages extend content presentation only.
 * Existing presets/layouts remain authoritative; advertising stays in Generator.
 * This module is usable in Node tests and bundled as a classic browser script.
 */
import { categoryGridAttributes, categoryLayoutSettings } from './category-layout.js';

const STRUCTURE_KEYS = new Set(['cardColumns', 'footerStyle', 'metaLayout', 'detailLayout', 'backLinkStyle']);
const STYLE_KEYS = new Set(['selectedStyle', 'fontStyle', 'navbarStyle', 'logoStyle', 'cardBorder', 'cardRadius', 'cardHover', 'cardImageHeight', 'contentMaxWidth', 'gridGap', 'cardSpacing', 'detailImgStyle', 'animationEnter', 'transitionSpeed', 'categoryTitleStyle', 'categoryTitleAlign', 'cardViewMode']);
const MANIFEST_KEYS = new Set(['schemaVersion', 'id', 'name', 'version', 'domainId', 'description', 'icon', 'baseLayout', 'structure', 'style', 'palette', 'reference']);
const PAGES = ['home', 'detail', 'all'];

function assert(condition, message) {
  if (!condition) throw new Error('Template package: ' + message);
}

function freezeTree(value) {
  Object.values(value).forEach(child => { if (child && typeof child === 'object') freezeTree(child); });
  return Object.freeze(value);
}

/** Reject unknown configuration fields instead of copying advertising/state into a preset. */
export function validateManifest(value) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'manifest must be an object');
  Object.keys(value).forEach(key => assert(MANIFEST_KEYS.has(key), 'unsupported manifest field ' + key));
  assert(value.schemaVersion === 1 || value.schemaVersion === 2, 'unsupported schemaVersion');
  if (value.schemaVersion === 2) assert(value.palette && value.reference, 'v2 requires a palette and reference');
  if (value.schemaVersion === 1) assert(!value.palette && !value.reference, 'v1 packages only support content styles');
  if (value.palette) {
    assert(value.schemaVersion === 2, 'palette requires v2');
    const keys = ['bg','secondary','surface','primary','text','muted','border','card','hover'];
    assert(keys.every(key => /^#[0-9a-f]{6}$/i.test(value.palette[key] || '')), 'palette requires nine hex colors');
    assert(Object.keys(value.palette).every(key => keys.includes(key)), 'unknown palette field');
  }
  if (value.reference) assert(typeof value.reference === 'string' && !/[<>\x00-\x1f]/.test(value.reference), 'invalid reference');
  assert(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value.id || ''), 'invalid id');
  assert(/^\d+\.\d+\.\d+$/.test(value.version || ''), 'version must be major.minor.patch');
  ['name', 'description', 'domainId', 'baseLayout'].forEach(key => {
    assert(typeof value[key] === 'string' && value[key].trim(), key + ' is required');
    assert(!/[<>"\x00-\x1f]/.test(value[key]), key + ' must be plain text');
  });
  if (value.icon !== undefined) assert(typeof value.icon === 'string' && !/[<>"\x00-\x1f]/.test(value.icon), 'icon must be plain text');
  ['structure', 'style'].forEach(key => {
    const settings = value[key] || {};
    assert(settings && typeof settings === 'object' && !Array.isArray(settings), key + ' must be an object');
    Object.entries(settings).forEach(([field, setting]) => {
      assert((key === 'structure' ? STRUCTURE_KEYS : STYLE_KEYS).has(field), 'unsupported ' + key + ' field ' + field);
      assert(typeof setting === 'string' && setting.length <= 200, field + ' must be a short string');
    });
  });
  return JSON.parse(JSON.stringify(value));
}

/**
 * Each page module declares CSS for known content elements, not arbitrary HTML.
 * The central scope prevents rules leaking into other templates. Selectors are
 * deliberately limited in v1: advertising ancestors and containers are excluded.
 */
const CONTENT_SELECTORS = new Set([
  '.tpl-section-heading', '.tpl-section-number', '.tpl-section-kicker',
  '.tpl-section-heading .category-title', '.tpl-sections .item-card',
  '.tpl-sections .card-body', '.tpl-sections .card-title', '.tpl-sections .card-desc',
  '.tpl-sections .card-image', '.tpl-sections .card-image-frame',
  '.detail-title', '.detail-meta', '.detail-content > p', '.detail-content > h2',
  '.detail-content > h3', '.detail-hero-image', '.related-title', '.related-card',
  '#all-articles > .category-title', '#all-articles .item-card',
  '#all-articles .card-body', '#all-articles .card-title', '#all-articles .card-image'
]);
const CONTENT_PROPERTIES = new Set([
  'background', 'color', 'border', 'border-top', 'border-bottom', 'border-radius',
  'box-shadow', 'padding', 'margin', 'margin-bottom', 'margin-top',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
  'text-transform', 'max-width', 'width', 'height', 'object-fit'
]);

export function renderContentStyles(manifest, pages) {
  const scope = 'body[data-template-package="' + manifest.id + '"] ';
  let output = '\n/* Independent template: ' + manifest.id + '@' + manifest.version + ' */\n';
  PAGES.forEach(page => {
    const rules = pages[page].rules;
    assert(Array.isArray(rules), page + '.rules must be an array');
    rules.forEach(rule => {
      assert(CONTENT_SELECTORS.has(rule.selector), 'unsupported content selector ' + rule.selector);
      assert(rule.declarations && typeof rule.declarations === 'object', 'missing declarations');
      const declarations = Object.entries(rule.declarations).map(([property, value]) => {
        assert(CONTENT_PROPERTIES.has(property), 'unsupported content property ' + property);
        assert(typeof value === 'string' && !/[{};<>]|url\s*\(|expression\s*\(|@import/i.test(value), 'invalid CSS value');
        return property + ':' + value;
      }).join(';');
      let css = scope + rule.selector + '{' + declarations + '}';
      if (rule.maxWidth !== undefined) {
        assert(Number.isInteger(rule.maxWidth) && rule.maxWidth >= 320 && rule.maxWidth <= 2000, 'invalid breakpoint');
        css = '@media(max-width:' + rule.maxWidth + 'px){' + css + '}';
      }
      output += css + '\n';
    });
  });
  return output;
}

export function createTemplateRegistry() {
  const packages = new Map();
  let installed = false;
  let fonts = [];
  return Object.freeze({
    register(definition) {
      assert(!installed, 'register packages before installing the adapter');
      const manifest = validateManifest(definition.manifest);
      assert(!packages.has(manifest.id), 'duplicate id ' + manifest.id);
      assert(definition.pages && PAGES.every(page => definition.pages[page]), 'home/detail/all page modules are required');
      const css = renderContentStyles(manifest, definition.pages);
      // V2 source modules are trusted repository code, never uploaded third-party
      // scripts. All CSS selectors must explicitly opt into this package scope.
      const presentation = definition.presentation || {};
      if (manifest.schemaVersion === 2) assert(['shell','navigation','footer'].every(part => presentation[part]), 'v2 requires shell/navigation/footer modules');
      const sources = manifest.schemaVersion === 2 ? [presentation.shell, ...PAGES.map(page => definition.pages[page]), presentation.navigation, presentation.footer].filter(Boolean) : [];
      const presentationCSS = sources.map(module => {
        const source = module.css || '';
        assert(!/@import|url\s*\(|expression\s*\(|#adv\d|ad-container|iframe|canvas|@keyframes/i.test(source), 'protected or external presentation CSS');
        for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
          assert(match[1].split(',').every(selector => selector.trim().startsWith(':scope')), 'presentation selectors must start with :scope');
        }
        return source.replaceAll(':scope', 'body[data-template-package="' + manifest.id + '"]');
      }).join('\n');
      const record = Object.freeze({ manifest: freezeTree(manifest), css, presentationCSS, presentation,
        pages: definition.pages, thumbnail: definition.thumbnail });
      packages.set(manifest.id, record);
      return record;
    },
    list() { return Array.from(packages.values(), record => JSON.parse(JSON.stringify(record.manifest))); },
    get(id) { return packages.get(id) || null; },
    /** Configuration has already been snapshotted by Generator; rendering is pure. */
    active(config) {
      const record = packages.get(config?.templateId);
      return record && config?.structure?.homeLayout === 'package-' + record.manifest.id ? record : null;
    },
    /** Both preview and static export ask for attributes after data allocation.
     * Legacy templates keep their original markup and ignore stored preferences. */
    categoryAttributes(config, category, renderedCount) {
      return this.active(config)?.manifest.schemaVersion === 2 ? categoryGridAttributes(category, renderedCount) : '';
    },
    categorySettings(category) { return categoryLayoutSettings(category); },
    presentationCSS(config) {
      const record = this.active(config);
      if (!record?.presentationCSS) return '';
      const columns = Number(config.structure.cardColumns);
      const validColumns = [1,2,3,4].includes(columns) ? columns : Number(record.manifest.structure.cardColumns);
      const scope = 'body[data-template-package="' + record.manifest.id + '"]';
      const defaults = record.manifest.style, style = config.style;
      let overrides = '';
      // Preserve the package's default typography/composition, while respecting
      // explicit operator micro-adjustments after the package is selected.
      if (style.fontStyle !== defaults.fontStyle) {
        const font = fonts.find(font => font.id === style.fontStyle);
        if (font) overrides += scope + '{--ref-body:' + font.family + ';--ref-display:' + font.family + '}' + scope + ' .navbar .nav-links a{font-family:var(--ref-body)!important}';
      }
      if (style.cardSpacing !== defaults.cardSpacing) overrides += scope + ' .item-card .card-body{padding:var(--card-spacing)!important}';
      if (style.cardRadius !== defaults.cardRadius) overrides += scope + ' .item-card{border-radius:var(--card-radius)!important}';
      if (style.cardImageHeight !== defaults.cardImageHeight) overrides += scope + ' .item-card .card-image{height:var(--card-image-height)!important}';
      const borders = { none: 'border:0;box-shadow:none', thin: 'border:1px solid var(--color-border);box-shadow:none', rounded: 'border:1px solid var(--color-border);box-shadow:0 2px 8px rgba(0,0,0,.2)', shadow: 'border:0;box-shadow:0 4px 16px rgba(0,0,0,.25)', double: 'border:3px double var(--color-border)', dashed: 'border:2px dashed var(--color-border)', thick: 'border:3px solid var(--color-border)' };
      if (style.cardBorder !== defaults.cardBorder && borders[style.cardBorder]) overrides += scope + ' .item-card{' + borders[style.cardBorder].split(';').join('!important;') + '!important}';
      return record.presentationCSS + '\n' + scope + '{--ref-columns:' + validColumns + ';--ref-lead-span:' + Math.min(validColumns,2) + '}' + overrides;
    },
    present(part, config, legacy) {
      const record = this.active(config);
      return record?.manifest.schemaVersion === 2 && typeof record.presentation[part]?.render === 'function'
        ? record.presentation[part].render(legacy, config) : legacy;
    },
    documentHTML(html, config) {
      const record = this.active(config);
      return record?.manifest.schemaVersion === 2 && record.pages.detail.render ? record.pages.detail.render(html, config) : html;
    },
    /**
     * Validate the entire transaction before appending anything. Legacy objects
     * keep their IDs and order, and all non-package rendering delegates verbatim.
     */
    install({ root, catalog, presets, palettes = [], fontPresets = [] }) {
      assert(!installed, 'adapter already installed');
      const originalCatalog = root.TemplateCatalog;
      const originalLayouts = root.TemplateLayouts;
      assert(originalCatalog && originalLayouts && Array.isArray(presets), 'legacy runtime must load first');
      const additions = Array.from(packages.values()).map(record => {
        const m = record.manifest;
        assert((m.schemaVersion === 2 && m.domainId === '*') || (catalog[m.domainId] && Array.isArray(catalog[m.domainId].blueprints)), 'unknown domain ' + m.domainId);
        assert(!presets.some(p => p.id === m.id), 'preset collision ' + m.id);
        const baseLayout = originalCatalog.getLayout(m.baseLayout);
        assert(baseLayout, 'unknown base layout ' + m.baseLayout);
        const layoutId = 'package-' + m.id;
        assert(!originalCatalog.getLayout(layoutId), 'layout collision ' + layoutId);
        return { record, layout: Object.freeze({ ...baseLayout, id: layoutId }), preset: {
          id: m.id, domainId: m.domainId, name: m.name, description: m.description,
          icon: m.icon || '▤', packageVersion: m.version,
          structure: { ...(m.structure || {}), homeLayout: layoutId, templateDomain: m.domainId },
          style: { ...(m.style || {}) }
        } };
      });
      const byLayout = new Map(additions.map(item => [item.layout.id, item]));
      // The active package must match both template ID and selected content layout.
      // Switching to a legacy template therefore removes package styles immediately.
      function active(config) {
        const item = byLayout.get(config && config.structure && config.structure.homeLayout);
        return item && config.templateId === item.record.manifest.id ? item.record : null;
      }
      root.TemplateCatalog = Object.freeze({ ...originalCatalog,
        getLayout(id) { return byLayout.get(id)?.layout || originalCatalog.getLayout(id); }
      });
      root.TemplateLayouts = Object.freeze({ ...originalLayouts,
        bodyAttributes(config) {
          const record = active(config);
          return originalLayouts.bodyAttributes(config) + (record ? ' data-template-package="' + record.manifest.id + '"' : '');
        },
        css(config) {
          const record = active(config);
          if (record?.manifest.schemaVersion === 2) return '';
          return originalLayouts.css(config) + (record ? record.css : '');
        },
        categoryHeader(config, category, index) {
          const record = active(config);
          return record?.pages.home.heading ? record.pages.home.heading(config, category, index) : originalLayouts.categoryHeader(config, category, index);
        },
        thumbnail(id) { return byLayout.get(id)?.record.thumbnail || originalLayouts.thumbnail(id); }
      });
      additions.forEach(({ preset }) => {
        presets.push(preset);
        const domains = preset.domainId === '*' ? Object.keys(catalog) : [preset.domainId];
        domains.forEach(id => catalog[id].blueprints.push(preset.id));
        const palette = packages.get(preset.id).manifest.palette;
        if (palette) {
          const fields = { bg: '--color-bg', secondary: '--color-bg-secondary', surface: '--color-surface', primary: '--color-primary', text: '--color-text', muted: '--color-text-secondary', border: '--color-border', card: '--color-card-bg', hover: '--color-card-hover' };
          const vars = Object.fromEntries(Object.entries(fields).map(([key, name]) => [name, palette[key]]));
          vars['--navbar-bg'] = palette.bg;
          vars['--color-primary-rgb'] = [1,3,5].map(i => parseInt(palette.primary.slice(i,i+2),16)).join(',');
          palettes.push({ id: 'reference-' + preset.id, name: preset.name + '配色', vars, previewBg: 'linear-gradient(135deg,' + palette.bg + ',' + palette.primary + ')' });
        }
      });
      fonts = fontPresets;
      installed = true;
      return additions.map(item => item.preset);
    }
  });
}
