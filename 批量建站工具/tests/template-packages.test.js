import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseHTML } from 'linkedom';
import { createTemplateRegistry, validateManifest } from '../template-system/registry.js';
import { discoverTemplatePackages } from '../template-system/package-files.mjs';
import { createTemplate } from '../scripts/create-template.mjs';
import { loadBuilder, createState } from './template-fixtures.mjs';
import * as home from '../templates/tech-magazine/home.js';
import * as detail from '../templates/tech-magazine/detail.js';
import * as all from '../templates/tech-magazine/all.js';

const manifest = JSON.parse(await readFile(new URL('../templates/tech-magazine/template.json', import.meta.url), 'utf8'));
const definition = { manifest, pages: { home, detail, all }, thumbnail: '<svg></svg>' };

describe('independent template contract', () => {
  it.each([
    { ...manifest, id: '../escape' }, { ...manifest, schemaVersion: 2 },
    { ...manifest, name: '<img onerror=alert(1)>' },
    { ...manifest, adPaths: { bannerPath1: '/123/wrong' } },
    { ...manifest, structure: { adPlacements: 'footer-top' } },
    { ...manifest, style: { originalPlacements: 'anything' } }
  ])('rejects incompatible or advertising fields before installation', invalid => {
    expect(() => validateManifest(invalid)).toThrow();
  });

  it('rejects duplicate registrations and freezes validated settings', () => {
    const registry = createTemplateRegistry();
    registry.register(definition);
    expect(() => registry.register(definition)).toThrow(/duplicate/);
    expect(() => { registry.get(manifest.id).manifest.style.selectedStyle = 'changed'; }).toThrow();
    const listing = registry.list();
    listing[0].name = 'changed';
    expect(registry.get(manifest.id).manifest.name).toBe(manifest.name);
  });

  it.each(['#adv1', '.detail-content', '.items-grid', 'body'])('rejects styles for advertising or layout ancestors (%s)', selector => {
    const registry = createTemplateRegistry();
    expect(() => registry.register({ ...definition, pages: { ...definition.pages, home: {
      rules: [{ selector, declarations: { color: 'red' } }]
    } } })).toThrow(/selector/);
  });

  it('rejects clipping/transform and external CSS values', () => {
    for (const declarations of [{ overflow: 'hidden' }, { transform: 'scale(.5)' }, { background: 'url(https://example.com/a.png)' }]) {
      expect(() => createTemplateRegistry().register({ ...definition, pages: { ...definition.pages,
        home: { rules: [{ selector: '.tpl-sections .item-card', declarations }] }
      } })).toThrow();
    }
  });

  it('validates the whole catalog transaction before appending presets', () => {
    const builder = loadBuilder();
    const registry = createTemplateRegistry();
    registry.register(definition);
    registry.register({ ...definition, manifest: { ...manifest, id: 'bad-domain', domainId: 'missing' } });
    const presetCount = builder.presets.length;
    const blueprintCount = builder.domains.tech.blueprints.length;
    const originalLayouts = builder.TemplateLayouts;
    expect(() => registry.install({ root: builder, catalog: builder.domains, presets: builder.presets })).toThrow(/domain/);
    expect(builder.presets).toHaveLength(presetCount);
    expect(builder.domains.tech.blueprints).toHaveLength(blueprintCount);
    expect(builder.TemplateLayouts).toBe(originalLayouts);
  });
});

describe('real generator integration', () => {
  it('appends packages while preserving legacy defaults/order and the v1 domain boundary', () => {
    const legacy = loadBuilder();
    const updated = loadBuilder(false, true);
    expect(updated.presets.slice(0, legacy.presets.length)).toEqual(legacy.presets);
    expect(updated.presets.filter(p => p.id === manifest.id)).toHaveLength(1);
    expect(updated.domains.tech.blueprints.slice(0, legacy.domains.tech.blueprints.length)).toEqual(legacy.domains.tech.blueprints);
    expect(updated.domains.tech.blueprints).toContain(manifest.id);
    expect(updated.domains.general.blueprints).not.toContain(manifest.id);
    expect(updated.domains.general.blueprints.slice(0, legacy.domains.general.blueprints.length)).toEqual(legacy.domains.general.blueprints);
    expect(loadBuilder(true).presets).toHaveLength(30);
  });

  it.each(['none', 'code', 'manual', 'fixed', 'migration'])('keeps complete legacy exports and previews identical (%s)', async mode => {
    const legacy = loadBuilder(false, false, true);
    const updated = loadBuilder(false, true, true);
    for (const domainId of ['tech', 'general', 'environment']) {
      const preset = legacy.presets.find(preset => preset.domainId === domainId);
      const before = createState(legacy, preset, mode);
      const after = createState(updated, preset, mode);
      for (const page of ['home', 'detail', 'all']) {
        expect(updated.generator.generatePreviewHtml(after, page, 0)).toBe(legacy.generator.generatePreviewHtml(before, page, 0));
      }
      await legacy.generator.exportWebsite(before, () => {});
      await updated.generator.exportWebsite(after, () => {});
      // Binary Blobs are not compared by object identity; generated text files are.
      const textFiles = builder => Object.fromEntries(Object.entries(builder.files()).filter(([, value]) => typeof value === 'string'));
      expect(textFiles(updated)).toEqual(textFiles(legacy));
    }
  });

  it.each(['code', 'manual', 'fixed', 'migration'])('uses the same ad runtime, containers and configuration in the new template (%s)', async mode => {
    const builder = loadBuilder(false, true);
    const legacyPreset = builder.presets.find(p => p.domainId === 'tech');
    const packagePreset = builder.presets.find(p => p.id === manifest.id);
    const baseline = createState(builder, legacyPreset, mode);
    const state = createState(builder, packagePreset, mode);
    const paths = ['index.html', 'details/article1.html', 'all-articles.html'];
    await builder.generator.exportWebsite(baseline, () => {});
    const originalFiles = { ...builder.files() };
    await builder.generator.exportWebsite(state, () => {});
    const files = builder.files();
    expect(files['website/js/ad.js']).toBe(originalFiles['website/js/ad.js']);
    expect(builder.generator.buildConfig(state).adPaths).toEqual(builder.generator.buildConfig(baseline).adPaths);
    expect(builder.generator.buildConfig(state).adPlacements).toEqual(builder.generator.buildConfig(baseline).adPlacements);
    const adNodes = html => {
      const { document } = parseHTML(html);
      return [...document.querySelectorAll('#adv1,#adv2,#adv3')].map(node => node.outerHTML);
    };
    for (const path of paths) {
      expect(files['website/' + path]).toContain('data-template-package="tech-magazine"');
      expect(adNodes(files['website/' + path])).toEqual(adNodes(originalFiles['website/' + path]));
    }
    for (const page of ['home', 'detail', 'all']) expect(builder.generator.generatePreviewHtml(state, page, 0)).toContain('data-template-package="tech-magazine"');
    expect(files['website/css/style.css']).toContain('Independent template: tech-magazine@1.0.0');
    // Adapter and package metadata are build-tool concerns, not deployment scripts.
    expect(Object.keys(files).some(path => /template-packages|template-system/.test(path))).toBe(false);
  });
});

describe('template scaffold and discovery', () => {
  it('creates all required files, auto-discovers the package, and refuses overwrite', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sitefoundry-template-test-'));
    try {
      const folder = await createTemplate({ directory, id: 'field-journal', name: '田野日志', domainId: 'environment' });
      expect((await readdir(folder)).sort()).toEqual(['README.md', 'all.js', 'detail.js', 'home.js', 'template.json', 'thumbnail.svg']);
      const original = await readFile(join(folder, 'template.json'), 'utf8');
      expect((await discoverTemplatePackages(directory))[0].manifest.domainId).toBe('environment');
      await expect(createTemplate({ directory, id: 'field-journal', name: '覆盖' })).rejects.toThrow();
      expect(await readFile(join(folder, 'template.json'), 'utf8')).toBe(original);
      await writeFile(join(folder, 'all.js'), 'export const rules = [];');
      // Validation is deliberately strict for incomplete package directories.
      await rm(join(folder, 'detail.js'));
      await expect(discoverTemplatePackages(directory)).rejects.toThrow();
    } finally {
      // This is only the test's freshly allocated temporary directory.
      await rm(directory, { recursive: true, force: true });
    }
  });
});
