import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const skipped = new Set(['node_modules', '.git', '.next', 'out', 'dist', 'build', '.sitefoundry-build']);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Reuse the exact bounded AST transform used by browser source export. Fonts
// come from the installed app's audited local library; no Google request occurs
// during an offline build, and the user's original imported archive is untouched.
export async function prepareLocalNextFonts({ source, vendorDirectory }) {
  const files = new Map();
  async function scan(relative = '') {
    for (const entry of await fs.readdir(path.join(source, relative), { withFileTypes: true })) {
      if (skipped.has(entry.name)) continue;
      const name = path.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Source fonts must not reference symbolic links');
      if (entry.isDirectory()) await scan(name);
      else if (entry.isFile()) files.set(name, { path: name, bytes: /\.[cm]?[jt]sx?$/.test(name) ? await fs.readFile(path.join(source, name)) : null });
    }
  }
  await scan();
  if (![...files.values()].some((entry) => entry.bytes?.includes(Buffer.from('next/font/google')))) return [];
  const { localizeNextFonts } = await import(pathToFileURL(path.join(vendorDirectory, 'font-converter.mjs')).href);
  const fonts = path.join(vendorDirectory, 'fonts');
  const catalog = JSON.parse(await fs.readFile(path.join(fonts, 'manifest.json'), 'utf8'));
  const originals = new Map(files);
  const conversions = await localizeNextFonts(files, async (name) => {
    const family = catalog.families[name];
    if (!family) throw new Error('本地字体库尚未包含：' + name);
    const assets = [];
    for (const file of [family.css, family.license, ...family.files.map((item) => item.path)]) {
      const bytes = await fs.readFile(path.join(fonts, file));
      const recorded = family.files.find((item) => item.path === file);
      if (recorded && (bytes.length !== recorded.bytes || hash(bytes) !== recorded.sha256)) throw new Error('Bundled font integrity failed: ' + file);
      assets.push({ path: file, bytes });
    }
    return { family: name, css: assets[0].bytes.toString('utf8'), files: assets, license: family.license };
  });
  for (const [name, entry] of files) {
    if (entry === originals.get(name)) continue;
    const target = path.join(source, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, entry.bytes);
  }
  return conversions;
}
