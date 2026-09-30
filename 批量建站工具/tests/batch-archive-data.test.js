import { describe, expect, it } from 'vitest';
import { batchRarStageProgress, readBatchRarEntries } from '../js/batch-archive-data.js';

describe('batch RAR archive data adapter', () => {
    it('keeps progress monotonic when switching from libarchive to the RAR5 fallback', () => {
        const stages = [
            '正在打开 RAR / 7Z 压缩包…',
            '内置解析器不兼容，正在切换 RAR5 / solid RAR 解析器…',
            '正在读取 RAR5 文件清单，并自动跳过 node_modules…',
            '正在列出压缩包目录，并自动跳过 node_modules…',
            '目录读取完成：共 16 个文件，正在提取 16 个源码文件…',
            '正在提取源码文件：8 / 16…',
            '正在提取源码文件：16 / 16…',
            '正在提取并整理 RAR5 源码文件：8 / 16…',
            '正在提取并整理 RAR5 源码文件：16 / 16…'
        ];
        let latestProgress = 0;
        const progress = stages.map((stage) => {
            latestProgress = batchRarStageProgress(stage, latestProgress);
            return latestProgress;
        });

        expect(progress).toEqual([0.22, 0.3, 0.38, 0.42, 0.54, 0.62, 0.69, 0.69, 0.69]);
        expect(progress.every((value, index) => index === 0 || value >= progress[index - 1])).toBe(true);
    });

    it('decodes JSON and retains image files as local blobs', async () => {
        const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
        const reports = [];
        const result = await readBatchRarEntries({ name: 'medical-source.rar' }, [
            { path: 'source/articles.json', bytes: new TextEncoder().encode('[{"title":"FDA update"}]') },
            { path: 'source/images/cover.png', bytes: imageBytes },
            { path: 'source/readme.txt', bytes: new TextEncoder().encode('ignored by the batch adapter') }
        ], {
            parseUploadedJson: JSON.parse,
            normalizeData: (data) => data,
            onProgress: (...args) => reports.push(args)
        });

        expect(result.data).toEqual([{ title: 'FDA update' }]);
        expect(Object.keys(result.localImages)).toEqual(['source/images/cover.png']);
        expect(new Uint8Array(await result.localImages['source/images/cover.png'].arrayBuffer())).toEqual(imageBytes);
        expect(reports).toEqual([[0.72, '正在读取压缩包内 JSON']]);
    });

    it('returns an actionable error when the RAR contains no JSON file', async () => {
        await expect(readBatchRarEntries({ name: 'missing-data.rar' }, [
            { path: 'images/cover.png', bytes: new Uint8Array([1]) }
        ], { parseUploadedJson: JSON.parse, normalizeData: (data) => data }))
            .rejects.toThrow('missing-data.rar 中没有找到 JSON 数据文件。');
    });

    it('rejects a JSON payload that is not an object list', async () => {
        await expect(readBatchRarEntries({ name: 'invalid-data.rar' }, [
            { path: 'data.json', bytes: new TextEncoder().encode('{"records":[]}') }
        ], { parseUploadedJson: JSON.parse, normalizeData: () => [] }))
            .rejects.toThrow('invalid-data.rar 不是包含对象列表的有效数据源。');
    });
});
