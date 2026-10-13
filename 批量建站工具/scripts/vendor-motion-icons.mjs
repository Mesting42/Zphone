/** Offline packer for reviewed artwork. Refresh SVG and provenance together;
 * normal builds never fetch a moving branch or depend on review artifacts. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../motion/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('icons-provenance.json', root), 'utf8'));
const icons = {};
const notices = ['SiteFoundry domain icons - approved 2026-10-13\nArtwork is distributed under its own license, separately from generated website code.\nSVG artwork is unchanged; sizing is applied by CSS.\n'];
for (const icon of manifest.icons) {
  const bytes = await readFile(new URL(icon.file, root));
  if (createHash('sha256').update(bytes).digest('hex') !== icon.sha256) throw new Error('Artwork hash mismatch: ' + icon.id);
  const svg = bytes.toString('utf8');
  // External resource references and executable SVG are forbidden. Internal
  // gradient/clip references are safe in the isolated <img> document.
  if (!/<svg\b/.test(svg) ||
      /<script\b|<foreignObject\b|\son\w+\s*=|(?:href|xlink:href)\s*=\s*["'](?!#)|url\(\s*["']?(?!#)/i.test(svg)) {
    throw new Error('Unsafe SVG: ' + icon.id);
  }
  if (icons[icon.id]) throw new Error('Duplicate domain: ' + icon.id);
  icons[icon.id] = svg;
  const license = typeof icon.license === 'string' ? icon.license : icon.license.name;
  notices.push(icon.id + ': ' + icon.library + (icon.creator ? ' by ' + icon.creator : '') + ' - ' + license + '\nSource: ' + icon.source + '\nSHA-256: ' + icon.sha256 + '\n');
}
if (Object.keys(icons).length !== 36) throw new Error('Exactly 36 approved domains are required');
for (const file of ['LICENSE-iconpark.txt', 'LICENSE-noto.txt', 'LICENSE-openmoji.txt', 'LICENSE-twemoji.txt', 'ANIME-ATTRIBUTION.txt']) {
  notices.push('\n===== ' + file + ' =====\n' + await readFile(new URL('icons/licenses/' + file, root), 'utf8'));
}
// Avoid unnecessary watcher invalidation when local artwork did not change.
for (const [name, text] of [['domain-icons.json', JSON.stringify(icons, null, 2) + '\n'], ['ICONS-LICENSE.txt', notices.join('\n') + '\n']]) {
  let previous = ''; try { previous = await readFile(new URL(name, root), 'utf8'); } catch {}
  if (previous !== text) await writeFile(new URL(name, root), text);
}
console.log('Packed 36 approved local color SVGs.');
