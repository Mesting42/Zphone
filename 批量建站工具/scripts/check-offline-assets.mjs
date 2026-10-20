/** Local build gate: verify provisioned assets without making any requests. */
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const catalog = JSON.parse(await readFile('public/fonts/manifest.json', 'utf8'));
let count = 0;
for (const family of Object.values(catalog.families)) {
    await access(resolve('public/fonts', family.license));
    const css = await readFile(resolve('public/fonts', family.css), 'utf8');
    if (/https?:\/\//.test(css)) throw new Error('Remote URL remains in font stylesheet: ' + family.css);
    for (const file of family.files) {
        const bytes = await readFile(resolve('public/fonts', file.path));
        if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error('Font integrity mismatch: ' + file.path);
        count++;
    }
}
for (const file of ['js/offline-font-catalog.js', 'js/vendor/libarchive/libarchive.js', 'js/vendor/libarchive/worker-bundle.js', 'js/vendor/libarchive/libarchive.wasm', 'node_modules/jszip/dist/jszip.min.js']) await access(file);
console.log('Local offline assets verified: ' + Object.keys(catalog.families).length + ' font families, ' + count + ' font files.');
