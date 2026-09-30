import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
await build({
  stdin: { contents: 'export { DOMParser } from "linkedom/worker";', resolveDir: root, sourcefile: 'source-export-dom.js' },
  bundle: true, platform: 'node', format: 'cjs', target: 'node18', minify: true,
  // Escaped string output preserves DOM serialization without trailing spaces
  // inside generated multiline template literals.
  supported: { 'template-literal': false },
  outfile: join(root, 'js/source-export-dom.cjs'),
  banner: { js: '/* Portable source-export DOM parser. See source-export-dom.LICENSE.txt. */' }
});
const visited = new Set();
const notices = [];
async function collectLicense(name) {
  if (visited.has(name)) return;
  visited.add(name);
  const directory = join(root, 'node_modules', name);
  const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  let license = '';
  for (const filename of ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'LICENSE-MIT']) {
    try { license = await readFile(join(directory, filename), 'utf8'); break; } catch {}
  }
  if (!license && pkg.license === 'ISC' && pkg.author) {
    const author = typeof pkg.author === 'string' ? pkg.author : pkg.author.name;
    license = `ISC License\n\nCopyright (c) ${author}\n\nPermission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.\n\nTHE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.\n`;
  }
  if (!license) throw new Error('Missing third-party license: ' + name);
  notices.push(name + ' ' + pkg.version + '\n' + license.trim().replace(/[ \t]+$/gm, ''));
  for (const dependency of Object.keys(pkg.dependencies || {})) await collectLicense(dependency);
}
await collectLicense('linkedom');
await writeFile(join(root, 'js/source-export-dom.LICENSE.txt'), notices.join('\n\n--------------------\n\n') + '\n');
console.log('Portable DOM parser and third-party notices generated.');
