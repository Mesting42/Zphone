/**
 * Click every ordinary domain/template pair through the real configuration UI.
 * The synthetic article payload stays in memory and all browser output is local.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadBuilder, createState } from './template-fixtures.mjs';
import {expandPicker} from './workbench-browser-helpers.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = (process.env.TEMPLATE_PREVIEW_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '');
const output = resolve(process.env.TEMPLATE_SELECTOR_OUTPUT || 'coverage/template-ui-full');
mkdirSync(output, { recursive: true });

const builder = loadBuilder(false, true);
const domains = Object.keys(builder.domains);
assert.equal(domains.length, 36, 'the UI domain selector must contain every ordinary domain');
const runDomains = process.env.TEMPLATE_SELECTOR_DOMAIN ? domains.filter((domainId) => domainId === process.env.TEMPLATE_SELECTOR_DOMAIN) : domains;
assert.ok(runDomains.length, `Unknown template selector domain: ${process.env.TEMPLATE_SELECTOR_DOMAIN}`);
const results = [];
const failures = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });

async function runDomain(page, domainId) {
  const presets = builder.presets.filter((preset) => preset.domainId === domainId || preset.domainId === '*');
  const expectedCount = 30 + builder.TemplateRegistry.list().filter(item => item.domainId === domainId || item.domainId === '*').length;
  assert.equal(presets.length, expectedCount, `${domainId} must expose legacy templates and registered packages`);
  const state = createState(builder, presets[0]);
  const browserErrors = [];
  page.removeAllListeners('pageerror');
  page.on('pageerror', (error) => browserErrors.push(error.message));

  await page.goto(base + '/index.html', { waitUntil: 'load' });
  // Module initialization can finish after load; upload only once its actual
  // listeners are ready, then wait for parsing before advancing the wizard.
  await page.locator('#upload-area[data-upload-ready="true"]').waitFor();
  await page.locator('#file-input').setInputFiles({
    name: `${domainId}.json`,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(state.data))
  });
  await page.waitForFunction(() => Number(document.getElementById('data-count')?.textContent) === 20);
  await page.locator('#btn-next').click();
  await page.locator('#step-2.active').waitFor();
  await page.locator(`.theme-card[data-theme="${domainId}"]`).click();
  await page.locator('#btn-next').click();
  await page.locator('#btn-next').click();
  await page.locator('.config-tab[data-tab="style"]').click();
  await expandPicker(page,'template-grid');

  const cards = page.locator('#template-grid .template-card');
  assert.equal(await cards.count(), expectedCount, `${domainId} must render all registered template cards`);
  const frame = page.locator('#preview-frame');
  const frameContent = page.frameLocator('#preview-frame');
  const checked = [];

  for (const preset of presets) {
    const selector = `#template-grid .template-card[data-template-id="${preset.id}"]`;
    const card = page.locator(selector);
    assert.equal(await card.count(), 1, `${domainId}/${preset.id} must have one card`);
    assert.equal(await card.getAttribute('data-template-unavailable'), null, `${domainId}/${preset.id} must be selectable`);
    const wasAlreadySelected = await card.evaluate((element) => element.classList.contains('selected'));
    const previousDocument = await frame.evaluate((element) => element.srcdoc);
    await card.click();
    try {
      await page.waitForFunction(({ cardSelector, previous, alreadySelected }) => {
        const selected = document.querySelector(cardSelector);
        const preview = document.getElementById('preview-frame');
        return selected?.classList.contains('selected') && (alreadySelected || preview?.srcdoc !== previous) &&
          preview?.contentDocument?.readyState === 'complete' && preview.contentDocument.body?.querySelector('.item-card');
      }, { cardSelector: selector, previous: previousDocument, alreadySelected: wasAlreadySelected });
    } catch (error) {
      const actual = await frame.evaluate((element, previous) => ({
        selected: [...document.querySelectorAll('.template-card.selected')].map((item) => item.dataset.templateId),
        srcdocLength: element.srcdoc.length,
        srcdocBody: element.srcdoc.match(/<body[^>]*>/i)?.[0] || null,
        srcdocDifferentFromPrevious: element.srcdoc !== previous,
        bodyAttributes: element.contentDocument?.body ? [...element.contentDocument.body.attributes].map((attribute) => [attribute.name, attribute.value]) : [],
        frameLayout: element.contentDocument?.body?.dataset.templateLayout || null,
        frameReadyState: element.contentDocument?.readyState || null
      }), previousDocument).catch((diagnosticError) => ({ diagnosticError: diagnosticError.message }));
      throw new Error(`${domainId}/${preset.id}: preview did not reach ${preset.structure.homeLayout}; actual=${JSON.stringify(actual)}; cause=${error.message}`);
    }
    await frameContent.locator('.item-card').first().waitFor();
    checked.push(preset.id);
  }

  assert.deepEqual(browserErrors, [], `${domainId} template selection must not raise browser errors`);
  return { domainId, templates: checked.length, selectedIds: checked, browserErrors };
}

try {
  const queue = runDomains.slice();
  async function worker() {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    page.setDefaultTimeout(60000);
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(base).origin || url.hostname === 'cdnjs.cloudflare.com') return route.continue();
      return route.fulfill({ status: 200, body: '', contentType: 'text/javascript' });
    });
    while (queue.length) {
      const domainId = queue.shift();
      try {
        const result = await runDomain(page, domainId);
        results.push(result);
        console.log(`Selected all ${result.templates} templates for ${domainId} (${results.length}/${runDomains.length} domains)`);
      } catch (error) {
        const failure = { domainId, error: error.stack || error.message };
        failures.push(failure);
        results.push({ domainId, templates: 0, failure: failure.error });
        console.error(`Template selection failed for ${domainId}: ${error.message}`);
      }
    }
    await page.close();
  }
  // Same-origin workbench tabs can share a renderer. Serial clicks avoid
  // starving another tab while a complete preview is generated synchronously.
  const concurrency = Math.max(1, Number(process.env.TEMPLATE_SELECTOR_WORKERS) || 1);
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
} finally {
  await browser.close();
}

results.sort((a, b) => domains.indexOf(a.domainId) - domains.indexOf(b.domainId));

// Global editorial packages are available in every domain and must also count
// toward the expected selections, matching the UI inventory assertion above.
const expectedForDomain = domainId => builder.presets.filter(preset => preset.domainId === domainId || preset.domainId === '*').length;
const summary = { expectedDomains: runDomains.length, checkedDomains: results.filter(result => result.templates === expectedForDomain(result.domainId)).length,
  expectedTemplateSelections: runDomains.reduce((sum, id) => sum + expectedForDomain(id), 0), checkedTemplateSelections: results.reduce((sum, result) => sum + result.templates, 0),
  failures, results };
writeFileSync(resolve(output, 'selector-results.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, results: summary.results.map(({ domainId, templates, failure }) => ({ domainId, templates, failure })) }, null, 2));
process.exitCode = failures.length || summary.checkedTemplateSelections !== summary.expectedTemplateSelections ? 1 : 0;
