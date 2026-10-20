/**
 * Explicit provisioning step, run only while preparing a release with internet.
 * Normal dev/build/start commands never download fonts. Preserve every requested
 * style, weight and Unicode subset, plus the upstream redistribution license.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve('public/fonts');
const requests = new Map();
const presets = {};
const hash = value => createHash('sha256').update(value).digest('hex');
const slug = name => name.toLowerCase().replace(/[^a-z0-9]/g, '');
function add(clause) {
    const family = clause.split(':')[0].replace(/\+/g, ' ');
    if (!requests.has(family)) requests.set(family, new Set());
    requests.get(family).add(clause.replace(/\+/g, ' '));
    return family;
}
const data = await readFile('js/data.js', 'utf8');
for (const match of data.matchAll(/\{ id: '([^']+)'[^\n]*?google: '([^']+)'/g)) {
    presets[match[1]] = [add(match[2])];
}
const differentiated = await readFile('js/differentiated-builder.js', 'utf8');
for (const match of differentiated.matchAll(/url: '(https:\/\/fonts\.googleapis\.com\/[^']+)'/g)) {
    new URL(match[1]).searchParams.getAll('family').forEach(add);
}
// Game font choices currently share the same families; include their exact
// requested weights too, so an export never relies on browser-synthesized faces.
const game = await readFile('game-builder/js/generator.js', 'utf8');
const gameMap = game.match(/const googleFontsMap = \{([\s\S]*?)\n        \};/);
if (gameMap) for (const match of gameMap[1].matchAll(/'([^']+)': '([^']+)'/g)) add(match[2]);

const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
async function download(url, optional = false) {
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': userAgent } });
            if (optional && response.status === 404) return null;
            if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + url);
            return Buffer.from(await response.arrayBuffer());
        } catch (error) {
            if (attempt === 4) throw error;
            await new Promise(done => setTimeout(done, 500 * (attempt + 1)));
        }
    }
}
await mkdir(root, { recursive: true });
const families = {};
// Serial families and bounded requests avoid rate spikes and make progress clear.
for (const [name, clauses] of [...requests].sort(([a], [b]) => a.localeCompare(b))) {
    const id = slug(name);
    const directory = resolve(root, id);
    await mkdir(directory, { recursive: true });
    const faces = new Set();
    const files = new Map();
    const sources = [];
    for (const clause of clauses) {
        const cssUrl = 'https://fonts.googleapis.com/css2?' + new URLSearchParams({ family: clause, display: 'swap' });
        sources.push(cssUrl);
        const css = (await download(cssUrl)).toString('utf8');
        for (const match of css.matchAll(/@font-face\s*\{[^}]+\}/g)) faces.add(match[0]);
    }
    if (!faces.size) throw new Error('No font faces returned: ' + name);
    let css = [...faces].join('\n\n') + '\n';
    for (const match of [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)]) {
        const url = match[1];
        const filename = hash(url).slice(0, 20) + (url.endsWith('.woff2') ? '.woff2' : '.ttf');
        if (!files.has(filename)) {
            const bytes = await download(url);
            if (!['wOF2', '\x00\x01\x00\x00', 'OTTO'].includes(bytes.subarray(0, 4).toString('latin1'))) throw new Error('Invalid font response: ' + url);
            await writeFile(resolve(directory, filename), bytes);
            files.set(filename, { path: id + '/' + filename, bytes: bytes.length, sha256: hash(bytes), source: url });
        }
        css = css.split(url).join(filename);
    }
    let license = null;
    let licenseUrl;
    for (const category of ['ofl', 'apache']) {
        for (const filename of ['OFL.txt', 'LICENSE.txt']) {
            licenseUrl = 'https://raw.githubusercontent.com/google/fonts/main/' + category + '/' + id + '/' + filename;
            license = await download(licenseUrl, true);
            if (license) break;
        }
        if (license) break;
    }
    if (!license) throw new Error('Missing upstream license: ' + name);
    await writeFile(resolve(directory, 'font.css'), css);
    await writeFile(resolve(directory, 'LICENSE.txt'), license);
    families[name] = { id, css: id + '/font.css', files: [...files.values()], license: id + '/LICENSE.txt', licenseSource: licenseUrl, cssSources: sources };
    console.log('Vendored ' + name + ': ' + files.size + ' files');
}
const catalog = { schema: 1, presets, families };
await writeFile(resolve(root, 'manifest.json'), JSON.stringify(catalog, null, 2) + '\n');
await writeFile('js/offline-font-catalog.js', '/** Generated by scripts/vendor-offline-fonts.mjs; do not edit by hand. */\nglobalThis.OfflineFontCatalog = ' + JSON.stringify(catalog) + ';\n');
console.log('Offline font catalog ready: ' + Object.keys(families).length + ' families.');
