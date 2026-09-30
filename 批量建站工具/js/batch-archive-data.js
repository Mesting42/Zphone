const IMAGE_FILE_EXTENSION = /\.(?:jpg|jpeg|png|gif|webp|svg)$/i;

/**
 * Maps parser stages to monotonic per-file progress for the batch import UI.
 * The shared RAR reader reports text stages; this adapter keeps the UI moving
 * when it switches from libarchive to the RAR5 fallback parser.
 */
export function batchRarStageProgress(stage, previousProgress = 0) {
    const text = String(stage || '');
    const extraction = text.match(/正在提取(?:并整理 RAR5 )?源码文件：\s*(\d+)\s*\/\s*(\d+)/);
    let progress = 0.22;
    if (/正在读取 RAR5 文件清单/.test(text)) progress = 0.38;
    else if (/切换 RAR5/.test(text)) progress = 0.3;
    else if (/正在列出压缩包目录/.test(text)) progress = 0.42;
    else if (/目录读取完成/.test(text)) progress = 0.54;
    if (extraction) {
        progress = 0.55 + (0.14 * Math.min(1, Number(extraction[1]) / Math.max(1, Number(extraction[2]))));
    }
    const previous = Number(previousProgress);
    return Number(Math.max(Number.isFinite(previous) ? previous : 0, progress).toFixed(3));
}

/**
 * Converts safe path/byte entries returned by AdRestoration into the batch
 * builder's JSON and local-image inputs without depending on parser internals.
 */
export async function readBatchRarEntries(file, entries, options = {}) {
    const fileName = String(file && file.name || 'RAR 文件');
    const list = Array.from(entries || []);
    const jsonEntry = list.find(function(entry) { return /\.json$/i.test(String(entry && entry.path || '')); });
    if (!jsonEntry) throw new Error(fileName + ' 中没有找到 JSON 数据文件。');
    if (typeof options.parseUploadedJson !== 'function' || typeof options.normalizeData !== 'function') {
        throw new Error('RAR 数据转换组件未加载，请刷新页面后重试。');
    }

    if (typeof options.onProgress === 'function') options.onProgress(0.72, '正在读取压缩包内 JSON');
    const jsonText = await new Blob([jsonEntry.bytes], { type: 'application/json' }).text();
    const data = options.normalizeData(options.parseUploadedJson(jsonText));
    if (!Array.isArray(data) || !data.length) {
        throw new Error(fileName + ' 不是包含对象列表的有效数据源。');
    }

    const localImages = {};
    list.filter(function(entry) { return IMAGE_FILE_EXTENSION.test(String(entry && entry.path || '')); })
        .forEach(function(entry) {
            const path = String(entry.path || '').replace(/\\/g, '/');
            localImages[path] = new Blob([entry.bytes], { type: 'application/octet-stream' });
        });
    return { data: data, localImages: localImages };
}
