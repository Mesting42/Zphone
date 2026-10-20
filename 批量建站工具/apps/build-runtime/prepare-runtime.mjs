import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { build } from 'esbuild';

// Explicit developer preparation only: installation/first launch never silently
// downloads runtime tools. npm is shipped with the application for project prep.
const directory = path.dirname(fileURLToPath(import.meta.url));
const version = '10.9.4';
const metadataURL = 'https://registry.npmjs.org/npm/' + version;
const metadata = await (await fetch(metadataURL)).json();
if (metadata.version !== version || !metadata.dist?.integrity) throw new Error('Unexpected npm registry metadata');
const response = await fetch(metadata.dist.tarball);
if (!response.ok) throw new Error('npm download failed: ' + response.status);
const archive = Buffer.from(await response.arrayBuffer());
const [algorithm, expected] = metadata.dist.integrity.split('-');
const actual = createHash(algorithm).update(archive).digest('base64');
if (actual !== expected) throw new Error('npm archive registry integrity mismatch');
const bytes = gunzipSync(archive), target = path.join(directory, 'vendor/npm');
await fs.mkdir(target, { recursive: true });
for (let position = 0; position + 512 <= bytes.length;) {
  const header = bytes.subarray(position, position + 512);
  if (header.every((byte) => byte === 0)) break;
  const name = header.subarray(0, 100).toString().replace(/\0.*$/, '');
  const size = parseInt(header.subarray(124, 136).toString().replace(/\0.*$/, '').trim() || '0', 8);
  const type = header[156];
  const relative = name.replace(/^package\//, '');
  if (!relative || relative.startsWith('/') || relative.split('/').includes('..')) throw new Error('Unsafe npm archive entry');
  if (type === 0 || type === 48) {
    const file = path.join(target, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes.subarray(position + 512, position + 512 + size));
  } else if (type !== 53) throw new Error('Unsupported npm tar entry type: ' + type);
  position += 512 + Math.ceil(size / 512) * 512;
}
const record = {
  schema: 1, name: 'npm', version, metadataURL, sourceURL: metadata.dist.tarball,
  registryIntegrity: metadata.dist.integrity, archiveSha256: createHash('sha256').update(archive).digest('hex'),
  license: 'Artistic-2.0', preparedAt: new Date().toISOString(),
};
await fs.writeFile(path.join(directory, 'vendor/npm-provenance.json'), JSON.stringify(record, null, 2));
const application = path.resolve(directory, '../..');
const bundled = await build({
  entryPoints: [path.join(application, 'js/next-offline-fonts.js')],
  outfile: path.join(directory, 'vendor/font-converter.mjs'), bundle: true,
  platform: 'node', format: 'esm', target: 'node20', metafile: true,
  // Babel's helpers use CommonJS require even in an ESM bundle.
  banner: { js: 'import { createRequire as sitefoundryCreateRequire } from "node:module"; const require = sitefoundryCreateRequire(import.meta.url);' },
  legalComments: 'linked',
});
await fs.cp(path.join(application, 'public/fonts'), path.join(directory, 'vendor/fonts'), { recursive: true });
// Carry the parser/transform dependencies' licenses beside the generated bundle.
const licenses = path.join(directory, 'vendor/font-converter-licenses');
await fs.mkdir(licenses, { recursive: true });
const copied = new Set();
for (const input of Object.keys(bundled.metafile.inputs)) {
  let ancestor = path.dirname(path.resolve(input));
  while (ancestor !== path.dirname(ancestor) && ancestor.includes('node_modules')) {
    try {
      const packageJson = JSON.parse(await fs.readFile(path.join(ancestor, 'package.json'), 'utf8'));
      if (packageJson.name && !copied.has(packageJson.name)) {
        const names = await fs.readdir(ancestor);
        for (const name of names.filter((value) => /^(?:license|copying|notice)(?:\.|$)/i.test(value))) {
          if ((await fs.stat(path.join(ancestor, name))).isFile()) await fs.copyFile(path.join(ancestor, name), path.join(licenses, packageJson.name.replaceAll('/', '-') + '-' + name));
        }
        copied.add(packageJson.name);
      }
      break;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    ancestor = path.dirname(ancestor);
  }
}
console.log(JSON.stringify(record));
