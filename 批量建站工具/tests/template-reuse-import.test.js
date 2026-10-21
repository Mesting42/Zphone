import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import vm from 'node:vm';
import JSZip from 'jszip';
import { DOMParser } from 'linkedom';
import { readTemplateReuseContent } from '../js/template-reuse-import.js';

globalThis.DOMParser = DOMParser;
const encode = text => new TextEncoder().encode(text);
const article = { title: 'New content', content: 'Full new body', image: 'images/cover.webp' };
const entries = [
    { path: 'source/articles.json', bytes: encode(JSON.stringify([article])) },
    { path: 'source/images/cover.webp', bytes: new Uint8Array([1, 2, 3]) },
    { path: 'source/details/a.html', bytes: encode('<h1>Static title</h1><div class="detail-content"><p>Static full body</p></div>') }
];
const file = (name, bytes = new Uint8Array()) => { const value = new Blob([bytes]); Object.defineProperty(value, 'name', { value: name }); return value; };

function archiveEngine() {
    const context = { TextEncoder, TextDecoder, Uint8Array, Blob, Response, DecompressionStream, JSZip, window: {} };
    vm.runInNewContext(readFileSync(new URL('../js/ad-restoration.js', import.meta.url), 'utf8') + ';this.engine=AdRestoration;', context);
    return context.engine;
}

/** Build a standard ustar test file; the browser matrix separately uses bsdtar
 * and WinRAR to produce independent real archives from the user's test copies. */
function tar(files) {
    const chunks = [];
    for (const item of files) {
        const header = Buffer.alloc(512);
        header.write(item.path, 0, 100);
        header.write('0000644\0', 100); header.write('0000000\0', 108); header.write('0000000\0', 116);
        header.write(item.bytes.length.toString(8).padStart(11, '0') + '\0', 124);
        header.write('00000000000\0', 136); header.fill(32, 148, 156); header[156] = 48;
        header.write('ustar\0', 257); header.write('00', 263);
        const checksum = header.reduce((sum, byte) => sum + byte, 0);
        header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148);
        chunks.push(header, Buffer.from(item.bytes), Buffer.alloc((512 - item.bytes.length % 512) % 512));
    }
    return Buffer.concat([...chunks, Buffer.alloc(1024)]);
}

describe('template reuse content archive contract', () => {
    it('imports a direct JSON file without starting an archive runtime', async () => {
        const result = await readTemplateReuseContent(file('ARTICLES.JSON', JSON.stringify([article])), 'content');
        expect(result.items[0].title).toBe(article.title);
        expect(result.assets).toEqual([]);
    });
    for (const extension of ['zip', 'rar', '7z', 'tar', 'tar.gz', 'tgz']) {
        for (const kind of ['content', 'static']) it(`routes ${kind} .${extension} through the shared reader and retains image paths`, async () => {
            const selected = file('content.' + extension.toUpperCase());
            const calls = [], progress = [];
            const result = await readTemplateReuseContent(selected, kind, {
                readArchive: async (input, onStage) => { calls.push(input); onStage('Extracted'); return entries; },
                onStage: stage => progress.push(stage)
            });
            expect(calls).toEqual([selected]); expect(progress).toEqual(['Extracted']);
            expect(result.items[0].title).toBe(kind === 'static' ? 'Static title' : article.title);
            expect(result.assets[0].path).toBe('source/images/cover.webp');
        });
    }
    it('reads an actual ZIP through the exported common decoder', async () => {
        const zip = new JSZip(); entries.forEach(entry => zip.file(entry.path, entry.bytes));
        const result = await readTemplateReuseContent(file('content.zip', await zip.generateAsync({ type: 'uint8array' })), 'content', { readArchive: archiveEngine().readArchiveEntries });
        expect(result.items[0].ownerPath).toBe('source/articles.json');
        expect(Array.from(result.assets[0].bytes)).toEqual([1, 2, 3]);
    });
    for (const extension of ['tar', 'tar.gz', 'tgz']) it(`extracts real ${extension} bytes and static detail content`, async () => {
        const bytes = tar(entries), input = extension === 'tar' ? bytes : gzipSync(bytes);
        const result = await readTemplateReuseContent(file('site.' + extension, input), 'static', { readArchive: archiveEngine().readArchiveEntries });
        expect(result.items).toHaveLength(1); expect(result.items[0].body).toContain('Static full body');
        expect(Array.from(result.assets[0].bytes)).toEqual([1, 2, 3]);
    });
    it('rejects unsupported, empty and corrupt archives without reporting success', async () => {
        await expect(readTemplateReuseContent(file('file.exe'), 'content', { readArchive: async () => entries })).rejects.toThrow(/支持 ZIP/);
        await expect(readTemplateReuseContent(file('empty.tar'), 'content', { readArchive: async () => [] })).rejects.toThrow(/没有可读取/);
        await expect(readTemplateReuseContent(file('broken.zip', 'bad'), 'content', { readArchive: archiveEngine().readArchiveEntries })).rejects.toThrow();
    });
    it('surfaces decoder failures and can import a subsequent valid file', async () => {
        await expect(readTemplateReuseContent(file('bad.rar'), 'content', { readArchive: async () => { throw new Error('RAR 文件损坏'); } })).rejects.toThrow('RAR 文件损坏');
        expect((await readTemplateReuseContent(file('good.7z'), 'content', { readArchive: async () => entries })).items).toHaveLength(1);
    });
    it('offers all supported archive extensions in both actual file inputs', () => {
        const doc = new DOMParser().parseFromString(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), 'text/html');
        for (const id of ['template-reuse-content-input', 'template-reuse-site-input']) {
            const accept = doc.getElementById(id).getAttribute('accept').split(',');
            for (const extension of ['.zip', '.rar', '.7z', '.tar', '.tar.gz', '.tgz']) expect(accept).toContain(extension);
        }
        expect(doc.getElementById('template-reuse-content-input').getAttribute('accept')).toContain('.json');
    });
});
