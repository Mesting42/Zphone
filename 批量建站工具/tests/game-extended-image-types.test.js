import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/** FileReader is a browser transport; use real Blob bytes/type in this Node
 * fixture. The full browser acceptance separately decodes the actual covers. */
class BlobDataReader {
    readAsDataURL(blob) {
        blob.arrayBuffer().then(bytes => {
            this.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(bytes).toString('base64');
            this.onload();
        }).catch(error => { this.error = error; this.onerror(); });
    }
}

describe('extended game archive image types', () => {
    it.each([
        ['rar', 'cover.PNG', 'image/png'],
        ['7z', 'cover.jpg', 'image/jpeg'],
        ['rar', 'cover.jfif', 'image/jpeg'],
        ['7z', 'cover.webp', 'image/webp'],
        ['rar', 'cover.svg', 'image/svg+xml']
    ])('retains bytes and emits a previewable MIME for %s / %s', async (extension, filename, mime) => {
        const bytes = new Uint8Array([0, 255, 137, 80, 78, 71, 13, 10]);
        const records = [{ title: 'Game', url: 'https://example.test/game', thumb: 'images/' + filename }];
        let closed = 0;
        const archive = { async extractFiles() {}, async getFilesArray() { return [
            { path: '', file: new File([JSON.stringify(records)], 'games.json', { type: 'application/json' }) },
            { path: 'images/', file: new File([bytes], filename, { type: 'application/octet-stream' }) }
        ]; }, close() { closed++; } };
        const context = { Blob, File, FileReader: BlobDataReader, GameArchiveRuntime: { async load() { return { async open() { return archive; } }; } } };
        vm.runInNewContext(readFileSync(new URL('../game-builder/js/game-zip-import.js', import.meta.url), 'utf8') + ';this.importer=GameZipImport;', context);
        const result = await context.importer.importExtendedArchive({ name: 'catalog.' + extension }, rows => rows);
        expect(result.recordCount).toBe(1); expect(closed).toBe(1);
        const url = result.localImageDataUrls[filename]; expect(url.startsWith('data:' + mime + ';base64,')).toBe(true);
        expect(Buffer.from(url.split(',')[1], 'base64')).toEqual(Buffer.from(bytes));
        expect(result.payload[0].thumb).toBe('images/' + filename);
    });
});
