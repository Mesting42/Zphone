import { describe, expect, it } from 'vitest';
import { collectDataDirectory, directoryFileEntries, readDataDirectory } from '../js/data-directory-import.js';

const rows = [{ title: 'Glacier', image: '../assets/cover.webp' }];
function entries(extra = []) {
    return [
        { path: 'Glaciers/content/data.json', getFile: async () => new File([JSON.stringify(rows)], 'data.json') },
        { path: 'Glaciers/assets/cover.webp', getFile: async () => new File(['real-image-bytes'], 'cover.webp') },
        { path: 'Glaciers/other/cover.webp', getFile: async () => new File(['different'], 'cover.webp') },
        ...extra
    ];
}
const options = { parseJson: JSON.parse, normalizeData: data => Array.isArray(data) ? data : [] };

describe('authorized data directory imports', () => {
    it('resolves nested JSON paths against the right image without basename collisions', async () => {
        const result = await readDataDirectory(entries(), options);
        expect(result.data[0].image).toBe('Glaciers/assets/cover.webp');
        expect(await result.localImages[result.data[0].image].text()).toBe('real-image-bytes');
    });
    it('requires explicit selection when multiple usable datasets exist and supports cancellation', async () => {
        const list = entries([{ path: 'Glaciers/another.json', getFile: async () => new File(['[{"title":"Other"}]'], 'another.json') }]);
        const selected = await readDataDirectory(list, { ...options, chooseJson: async candidates => candidates[1].path });
        expect(selected.data[0].title).toBe('Other');
        await expect(readDataDirectory(list, { ...options, chooseJson: async () => null })).rejects.toMatchObject({ name: 'AbortError' });
    });
    it('does not read unrelated or image files when no usable JSON is present', async () => {
        let imageRead = false;
        await expect(readDataDirectory([{ path: 'folder/image.png', getFile: async () => { imageRead = true; } }], options)).rejects.toThrow('没有可用');
        expect(imageRead).toBe(false);
    });
    it('preserves relative names through browser file fallback and lazy native handles', async () => {
        const file = new File(['[]'], 'data.json');
        Object.defineProperty(file, 'webkitRelativePath', { value: 'root/nested/data.json' });
        expect(directoryFileEntries([file])[0].path).toBe('root/nested/data.json');
        let reads = 0;
        const handle = { name: 'root', async *entries() { yield ['data.json', { kind: 'file', getFile: async () => { reads++; return file; } }]; yield ['notes.txt', { kind: 'file', getFile: async () => { throw Error('unrelated'); } }]; } };
        const collected = await collectDataDirectory(handle);
        expect(reads).toBe(0);
        expect(collected.map(item => item.path)).toEqual(['root/data.json']);
        expect(await collected[0].getFile()).toBe(file);
    });
});
