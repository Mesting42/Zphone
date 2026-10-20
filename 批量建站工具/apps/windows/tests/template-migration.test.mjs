import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { migrateLegacyTemplates } from '../src/template-migration.mjs';
import { prepareTemplate } from '../../../js/ad-template-analysis.js';

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'sitefoundry-template-migration-'));
  const legacyStore = join(directory, 'legacy'), dataDirectory = join(directory, 'native');
  await mkdir(join(legacyStore, 'custom'), { recursive: true });
  const template = { version: 'v100.0.2', source: '/* v100.0.2 */\nvar bannerPath1="a",bannerPath2="b",bannerPath3="c",interstitialPath="d",anchorPath="e",analyticsID="f";', fields: { bannerPath1: 'bannerPath1', bannerPath2: 'bannerPath2', bannerPath3: 'bannerPath3', interstitialPath: 'interstitialPath', anchorPath: 'anchorPath', analyticsID: 'analyticsID' }, ranges: { bannerPath1: { start: 0, end: 999 } } };
  const manifest = { schema: 'sitefoundry-ad-templates/v1', defaultVersion: template.version, templates: [{ version: template.version, file: 'custom/' + template.version + '.json' }] };
  await writeFile(join(legacyStore, 'manifest.json'), JSON.stringify(manifest));
  await writeFile(join(legacyStore, manifest.templates[0].file), JSON.stringify(template));
  return { directory, legacyStore, dataDirectory, template, manifest };
}

test('First app start migrates browser templates, reparses source ranges and preserves original bytes', async () => {
  const value = await fixture();
  try {
    const original = await readFile(join(value.legacyStore, 'manifest.json'));
    const result = await migrateLegacyTemplates({ ...value, validateTemplate: prepareTemplate });
    assert.equal(result.state, 'migrated'); assert.equal(result.count, 1);
    const migrated = JSON.parse(await readFile(join(value.dataDirectory, 'ad-templates', value.manifest.templates[0].file), 'utf8'));
    assert.equal(migrated.source, value.template.source);
    assert.notDeepEqual(migrated.ranges, value.template.ranges);
    assert.deepEqual(await readFile(join(value.legacyStore, 'manifest.json')), original);
    const second = await migrateLegacyTemplates({ ...value, validateTemplate: () => { throw new Error('must not overwrite'); } });
    assert.equal(second.state, 'native-store-exists');
  } finally { await rm(value.directory, { recursive: true, force: true }); }
});

test('Invalid legacy traversal and JavaScript fail closed without changing native or legacy stores', async () => {
  const value = await fixture();
  try {
    value.manifest.templates[0].file = '../escape.json';
    await writeFile(join(value.legacyStore, 'manifest.json'), JSON.stringify(value.manifest));
    const result = await migrateLegacyTemplates({ ...value, validateTemplate: prepareTemplate });
    assert.equal(result.state, 'legacy-invalid');
    assert.deepEqual(await readdir(value.dataDirectory).catch(() => []), []);
    value.manifest.templates[0].file = 'custom/v100.0.2.json';
    await writeFile(join(value.legacyStore, 'manifest.json'), JSON.stringify(value.manifest));
    await writeFile(join(value.legacyStore, value.manifest.templates[0].file), JSON.stringify({ ...value.template, source: 'var invalid = ;' }));
    const invalid = await migrateLegacyTemplates({ ...value, validateTemplate: prepareTemplate });
    assert.equal(invalid.state, 'legacy-invalid');
    assert.deepEqual(await readdir(value.dataDirectory).catch(() => []), []);
  } finally { await rm(value.directory, { recursive: true, force: true }); }
});
