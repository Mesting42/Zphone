import { describe, expect, it } from 'vitest';
import { previewResourceUrl, previewResourceMime } from '../js/preview-resource-url.js';

describe('isolated preview resource bytes', () => {
    const decoded = url => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    it('preserves non-ASCII source without changing script or style contents', () => {
        const source = '/* 中文 🐚 */ const title = "café";';
        expect(decoded(previewResourceUrl(source, 'text/javascript')).toString('utf8')).toBe(source);
    });
    it('encodes large binary assets without exceeding browser call argument limits', () => {
        const image = Uint8Array.from({ length: 1024 * 1024 }, (_, index) => index % 256);
        expect(decoded(previewResourceUrl(image, 'image/png'))).toEqual(Buffer.from(image));
    });
    it('uses only the requested typed-array view, retaining non-zero byte offsets', () => {
        const backing = Uint8Array.from([99, 1, 2, 3, 98]);
        expect([...decoded(previewResourceUrl(backing.subarray(1, 4), 'font/woff'))]).toEqual([1, 2, 3]);
    });
    it.each([['font.woff', 'font/woff'], ['font.woff2', 'font/woff2'], ['local.mjs?v=1', 'text/javascript'], ['data.json', 'application/json']])('declares %s using its original content type', (path, type) => {
        expect(previewResourceMime(path)).toBe(type);
    });
});
