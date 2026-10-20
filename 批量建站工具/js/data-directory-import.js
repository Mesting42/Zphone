/**
 * Directory data adapter. It reads only the chosen JSON and supported images;
 * callers retain ownership of UI, field mapping and the shared generator.
 * Native SAF/File System Access handles remain lazy until a file is needed.
 */
const IMAGE_EXTENSION = /\.(?:jpe?g|png|gif|webp|svg|avif)$/i;

export async function collectDataDirectory(handle) {
    const entries = [];
    async function visit(directory, prefix) {
        for await (const [name, child] of directory.entries()) {
            const path = prefix + name;
            if (child.kind === 'directory') await visit(child, path + '/');
            else if (/\.json$/i.test(path) || IMAGE_EXTENSION.test(path)) {
                entries.push({ path, getFile: () => child.getFile() });
            }
        }
    }
    await visit(handle, String(handle.name || '数据源') + '/');
    return entries;
}

export function directoryFileEntries(files) {
    return Array.from(files || []).map(file => ({
        path: String(file.webkitRelativePath || file.name).replace(/\\/g, '/'),
        getFile: async () => file
    }));
}

/** Resolve references relative to the selected JSON before basename fallback.
 * This disambiguates content/data.json + ../assets/cover.webp without merging
 * different images that happen to share the same filename.
 */
function resolveImageReferences(rows, jsonPath, imagePaths) {
    const paths = new Set(imagePaths);
    const parent = jsonPath.split('/').slice(0, -1);
    function resolve(value) {
        if (typeof value !== 'string' || /^(?:[a-z]+:|\/\/)/i.test(value)) return value;
        const clean = value.replace(/\\/g, '/').split(/[?#]/)[0];
        if (!IMAGE_EXTENSION.test(clean)) return value;
        const segments = parent.slice();
        for (const part of clean.split('/')) {
            if (part === '..') segments.pop();
            else if (part && part !== '.') segments.push(part);
        }
        const relative = segments.join('/');
        if (paths.has(relative)) return relative;
        return value;
    }
    function visit(value) {
        if (Array.isArray(value)) return value.map(visit);
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, visit(child)]));
        return resolve(value);
    }
    return rows.map(visit);
}

export async function readDataDirectory(entries, options) {
    const list = Array.from(entries || []);
    const report = options.onProgress || (() => {});
    const candidates = [];
    let firstError;
    report(0.05, '正在检查文件夹中的 JSON 数据源');
    for (const entry of list.filter(item => /\.json$/i.test(item.path))) {
        try {
            const file = await entry.getFile();
            const data = options.normalizeData(options.parseJson(await file.text()));
            if (data.length) candidates.push({ ...entry, data });
        } catch (error) { firstError ||= error; }
    }
    if (!candidates.length) throw new Error('文件夹中没有可用的 JSON 数据列表。' + (firstError ? firstError.message : ''));
    const selectedPath = candidates.length === 1 ? candidates[0].path : await options.chooseJson(candidates);
    if (!selectedPath) throw Object.assign(new Error('已取消数据源选择。'), { name: 'AbortError' });
    const selected = candidates.find(item => item.path === selectedPath);
    if (!selected) throw new Error('所选 JSON 不属于本次授权文件夹。');
    const images = list.filter(item => IMAGE_EXTENSION.test(item.path));
    const localImages = {};
    for (let index = 0; index < images.length; index++) {
        localImages[images[index].path] = await images[index].getFile();
        report(0.3 + 0.65 * (index + 1) / images.length, '正在读取图片 ' + (index + 1) + '/' + images.length);
    }
    report(1, '文件夹数据和图片读取完成');
    return { data: resolveImageReferences(selected.data, selected.path, images.map(item => item.path)), localImages,
        entryPath: selected.path, name: selected.path.split('/')[0] || '数据源文件夹' };
}
