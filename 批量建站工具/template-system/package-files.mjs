import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateManifest } from './registry.js';

/** Discover packages deterministically; folders beginning with _ are developer starters. */
export async function discoverTemplatePackages(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const packages = [];
  const ids = new Set();
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const folder = resolve(directory, entry.name);
    const manifest = validateManifest(JSON.parse(await readFile(resolve(folder, 'template.json'), 'utf8')));
    if (manifest.id !== entry.name) throw new Error('Template folder and manifest ID must match: ' + entry.name);
    if (ids.has(manifest.id)) throw new Error('Duplicate template ID: ' + manifest.id);
    ids.add(manifest.id);
    // Every source is required at discovery time, so incomplete packages fail the
    // build before the existing generated runtime is replaced.
    const required = ['home.js', 'detail.js', 'all.js', 'thumbnail.svg', 'README.md'];
    if (manifest.schemaVersion === 2) required.push('shell.js','navigation.js','footer.js');
    for (const file of required) {
      await readFile(resolve(folder, file));
    }
    packages.push({ folder, manifest });
  }
  return packages;
}
