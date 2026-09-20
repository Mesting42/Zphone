import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const builder = readFileSync(new URL('../js/batch-ad-builder.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/tool.css', import.meta.url), 'utf8');

describe('batch ad upload formats', () => {
  it('offers RAR and 7Z alongside JSON and ZIP in the batch file selector', () => {
    expect(html).toMatch(/id="batch-data-input"[^>]*\.rar[^>]*\.7z/);
  });

  it('routes RAR and 7Z through the existing local archive runtime and retains assets', () => {
    expect(app).toContain("ext === 'rar' || ext === '7z'");
    expect(app).toContain('ensureArchiveRuntime()');
    expect(app).toContain('archive.getFilesArray()');
    expect(app).toContain('localImages[');
  });

  it('keeps a local image map and independent configuration for the active preview site', () => {
    expect(html).toContain('id="batch-preview-site-tabs"');
    expect(app).toContain('function syncBatchActiveSiteToApp()');
    expect(app).toContain('appState.localImages = site.localImages || {}');
    expect(app).toContain('site.config = cloneBatchConfig(appState.config)');
    expect(app).toContain('function switchBatchPreviewSite(index, shouldFocus)');
  });

  it('exposes a labeled preview site switcher and prevents duplicate template selection', () => {
    expect(html).toContain('id="preview-site-switcher"');
    expect(html).toContain('站点');
    expect(app).toContain('function getBatchTemplateOwner(templateId, exceptSite)');
    expect(builder).toContain('BATCH_TEMPLATE_REUSED');
    expect(app).toContain('data-template-unavailable="true"');
  });

  it('keeps domain recognition independent for every batch data source', () => {
    expect(html).toContain('id="batch-domain-site-tabs"');
    expect(app).toContain('function renderBatchDomainSiteTabs()');
    expect(app).toContain('function switchBatchDomainSite(index, shouldFocus)');
    expect(app).toContain('site.domainDetection = DomainEngine.detect(site.data, DOMAIN_CATALOG');
    expect(app).toContain('site.themeId = themeId;');
    expect(builder).toContain('selectedTheme: site.themeId || appState.selectedTheme');
  });

  it('uses the full field-mapping width and gives imported data rows a consistent readable surface', () => {
    expect(css).toContain('.batch-field-mapping { grid-column:1 / -1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));');
    expect(css).toContain('.batch-ad-data-item { background:#f8fcff; }');
    expect(css).toContain('.batch-ad-data-item strong,.batch-ad-code-item strong { overflow:hidden;color:#244e6b;');
  });

  it('balances the seven workflow cards into four cards followed by three full-width peers', () => {
    expect(css).toContain('@media (min-width: 1280px)');
    expect(css).toContain('.build-mode-options { grid-template-columns: repeat(12, minmax(0, 1fr)); }');
    expect(css).toContain('.build-mode-card:nth-child(5),');
    expect(css).toContain('.build-mode-card:nth-child(7) { grid-column: span 4; }');
  });

  it('keeps batch item numbers high-contrast against their blue badges', () => {
    expect(css).toContain('.batch-ad-step,.batch-ad-item-index { display:grid;width:32px;height:32px;');
    expect(css).toContain('background:#0b6fa8;color:#fff !important;');
  });
});
