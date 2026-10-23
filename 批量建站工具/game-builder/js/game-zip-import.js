/*
 * 本地游戏数据 ZIP 导入
 * 仅处理 JSON 与其引用的图片；不会执行压缩包中的任何脚本或 HTML。
 */
const GameZipImport = (function() {
    'use strict';

    const IMAGE_MIME_TYPES = {
        '.avif': 'image/avif', '.gif': 'image/gif', '.jfif': 'image/jpeg',
        '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png',
        '.svg': 'image/svg+xml', '.webp': 'image/webp'
    };

    function normalizeArchivePath(value) {
        return String(value || '').replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+/g, '/');
    }

    function isSafeRelativeAsset(value) {
        const path = normalizeArchivePath(value);
        if (!path || path.startsWith('/') || path.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(path)) return false;
        return !path.split('/').some(function(segment) { return !segment || segment === '.' || segment === '..'; });
    }

    function filenameFromPath(value) {
        const parts = normalizeArchivePath(value).split('/');
        return parts[parts.length - 1] || '';
    }

    function imageMimeType(path) {
        const match = String(path || '').toLowerCase().match(/(\.[a-z0-9]+)$/);
        return match && IMAGE_MIME_TYPES[match[1]] ? IMAGE_MIME_TYPES[match[1]] : 'application/octet-stream';
    }

    function jsonPriority(path) {
        const filename = filenameFromPath(path).toLowerCase();
        if (filename === 'gamesdata.json') return 0;
        if (filename === 'games.json') return 1;
        if (filename === 'data.json') return 2;
        return 3;
    }

    function archivePathIndex(zip) {
        const index = {};
        Object.keys(zip.files).forEach(function(path) {
            const entry = zip.files[path];
            if (!entry || entry.dir) return;
            const normalized = normalizeArchivePath(path);
            if (normalized) index[normalized.toLowerCase()] = path;
        });
        return index;
    }

    function findImagePath(relativeAsset, jsonPath, index) {
        const asset = normalizeArchivePath(relativeAsset);
        const jsonDir = normalizeArchivePath(jsonPath).split('/').slice(0, -1).join('/');
        const exactCandidates = [
            jsonDir ? normalizeArchivePath(jsonDir + '/' + asset) : asset,
            asset
        ];
        for (let i = 0; i < exactCandidates.length; i++) {
            const found = index[exactCandidates[i].toLowerCase()];
            if (found) return found;
        }

        const suffix = '/' + asset.toLowerCase();
        const matches = Object.keys(index).filter(function(path) {
            return path === asset.toLowerCase() || path.endsWith(suffix);
        });
        return matches.length === 1 ? index[matches[0]] : '';
    }

    async function importArchive(file, normalizeRecords) {
        if (!file || !/\.zip$/i.test(String(file.name || ''))) {
            throw new Error('请选择包含 JSON 与图片的 ZIP 压缩包。');
        }
        if (typeof JSZip === 'undefined') {
            throw new Error('ZIP 解析组件未加载，请刷新页面后重试。');
        }
        if (typeof normalizeRecords !== 'function') {
            throw new Error('游戏数据校验器不可用。');
        }

        const zip = await JSZip.loadAsync(file);
        const index = archivePathIndex(zip);
        const jsonPaths = Object.keys(index).filter(function(path) { return /\.json$/i.test(path); })
            .map(function(path) { return index[path]; })
            .sort(function(a, b) { return jsonPriority(a) - jsonPriority(b) || a.localeCompare(b); });
        if (!jsonPaths.length) {
            throw new Error('ZIP 中没有找到 JSON 文件。请将 gamesData.json 与 images 文件夹一同压缩。');
        }

        let chosen = null;
        const invalidJsonFiles = [];
        for (let i = 0; i < jsonPaths.length; i++) {
            const jsonPath = jsonPaths[i];
            try {
                const payload = JSON.parse(await zip.files[jsonPath].async('text'));
                const records = normalizeRecords(payload);
                if (records.length) {
                    chosen = { jsonPath: jsonPath, payload: payload, records: records };
                    break;
                }
                invalidJsonFiles.push(filenameFromPath(jsonPath) + '（没有有效游戏记录）');
            } catch (_) {
                invalidJsonFiles.push(filenameFromPath(jsonPath) + '（JSON 格式无效）');
            }
        }
        if (!chosen) {
            throw new Error('未找到可导入的游戏 JSON。' + (invalidJsonFiles.length ? '已检查：' + invalidJsonFiles.join('、') : ''));
        }

        const localImageDataUrls = {};
        const seenAssets = {};
        const outputNames = {};
        const missingImages = [];
        const duplicateNames = [];
        for (let i = 0; i < chosen.records.length; i++) {
            const thumb = String(chosen.records[i].thumb || '').trim();
            if (!thumb || /^https?:\/\//i.test(thumb)) continue;
            if (!isSafeRelativeAsset(thumb)) {
                missingImages.push(thumb || '未命名图片路径');
                continue;
            }
            const normalizedThumb = normalizeArchivePath(thumb);
            if (seenAssets[normalizedThumb]) continue;
            seenAssets[normalizedThumb] = true;

            const archivePath = findImagePath(normalizedThumb, chosen.jsonPath, index);
            if (!archivePath) {
                missingImages.push(normalizedThumb);
                continue;
            }
            const outputName = filenameFromPath(normalizedThumb);
            if (outputNames[outputName] && outputNames[outputName] !== normalizedThumb) {
                duplicateNames.push(outputName);
                continue;
            }
            outputNames[outputName] = normalizedThumb;
            const entry = zip.files[archivePath];
            const base64 = await entry.async('base64');
            localImageDataUrls[outputName] = 'data:' + imageMimeType(outputName) + ';base64,' + base64;
        }

        if (missingImages.length) {
            throw new Error('ZIP 中缺少 ' + missingImages.length + ' 张引用图片：' + missingImages.slice(0, 3).join('、') + (missingImages.length > 3 ? ' 等' : ''));
        }
        if (duplicateNames.length) {
            throw new Error('ZIP 中有不同路径的同名图片，导出时会冲突：' + duplicateNames.slice(0, 3).join('、'));
        }

        return {
            payload: chosen.payload,
            jsonPath: chosen.jsonPath,
            recordCount: chosen.records.length,
            localImageDataUrls: localImageDataUrls
        };
    }

    function readFileAsDataUrl(file, path) {
        return new Promise(function(resolve, reject) {
            const reader = new FileReader();
            reader.onload = function() {
                // Archive workers often return untyped Files. Opaque preview
                // frames require image data URLs rather than parent Blob URLs,
                // so use the same extension-based MIME contract as ZIP import.
                resolve(String(reader.result || '').replace(/^data:[^;,]*/i, 'data:' + imageMimeType(path || file.name)));
            };
            reader.onerror = function() { reject(reader.error || new Error('图片读取失败')); };
            reader.readAsDataURL(file);
        });
    }

    // RAR / 7z 解析使用同一套 JSON 与图片校验规则；只提取数据和图片，不读取压缩包中的脚本或 HTML。
    async function importExtendedArchive(file, normalizeRecords) {
        if (!file || !/\.(?:rar|7z)$/i.test(String(file.name || ''))) {
            throw new Error('请选择 RAR 或 7z 压缩包。');
        }
        if (!globalThis.GameArchiveRuntime || typeof globalThis.GameArchiveRuntime.load !== 'function') {
            throw new Error('RAR / 7z 解析组件未加载，请刷新页面后重试。');
        }
        if (typeof normalizeRecords !== 'function') throw new Error('游戏数据校验器不可用。');

        const Archive = await globalThis.GameArchiveRuntime.load();
        const archive = await Archive.open(file);
        let entries;
        try {
            await archive.extractFiles();
            entries = await archive.getFilesArray();
        } finally {
            archive.close();
        }
        const files = (entries || []).map(function(entry) {
            const path = normalizeArchivePath(String(entry.path || '') + String(entry.file && entry.file.name || ''));
            return { path: path, file: entry.file };
        }).filter(function(entry) { return entry.path && entry.file; });
        const index = {};
        files.forEach(function(entry) { index[entry.path.toLowerCase()] = entry; });
        const jsonPaths = Object.keys(index).filter(function(path) { return /\.json$/i.test(path); })
            .map(function(path) { return index[path].path; })
            .sort(function(a, b) { return jsonPriority(a) - jsonPriority(b) || a.localeCompare(b); });
        if (!jsonPaths.length) throw new Error('压缩包中没有找到 JSON 文件。请将 gamesData.json 与 images 文件夹一同压缩。');

        let chosen = null;
        for (let i = 0; i < jsonPaths.length; i++) {
            const jsonPath = jsonPaths[i];
            try {
                const payload = JSON.parse(await index[jsonPath.toLowerCase()].file.text());
                const records = normalizeRecords(payload);
                if (records.length) { chosen = { jsonPath: jsonPath, payload: payload, records: records }; break; }
            } catch (_) { /* 尝试下一份 JSON */ }
        }
        if (!chosen) throw new Error('未找到可导入的游戏 JSON。请检查字段是否包含标题、游戏地址和图片地址。');

        const localImageDataUrls = {};
        const seenAssets = {};
        const outputNames = {};
        const missingImages = [];
        for (let i = 0; i < chosen.records.length; i++) {
            const thumb = String(chosen.records[i].thumb || '').trim();
            if (!thumb || /^https?:\/\//i.test(thumb)) continue;
            if (!isSafeRelativeAsset(thumb)) { missingImages.push(thumb || '未命名图片路径'); continue; }
            const normalizedThumb = normalizeArchivePath(thumb);
            if (seenAssets[normalizedThumb]) continue;
            seenAssets[normalizedThumb] = true;
            const archivePath = findImagePath(normalizedThumb, chosen.jsonPath, Object.fromEntries(Object.keys(index).map(function(path) { return [path, index[path].path]; })));
            const entry = archivePath && index[archivePath.toLowerCase()];
            if (!entry) { missingImages.push(normalizedThumb); continue; }
            const outputName = filenameFromPath(normalizedThumb);
            if (outputNames[outputName] && outputNames[outputName] !== normalizedThumb) throw new Error('压缩包中有不同路径的同名图片，导出时会冲突：' + outputName);
            outputNames[outputName] = normalizedThumb;
            localImageDataUrls[outputName] = await readFileAsDataUrl(entry.file, outputName);
        }
        if (missingImages.length) throw new Error('压缩包中缺少 ' + missingImages.length + ' 张引用图片：' + missingImages.slice(0, 3).join('、') + (missingImages.length > 3 ? ' 等' : ''));
        return { payload: chosen.payload, jsonPath: chosen.jsonPath, recordCount: chosen.records.length, localImageDataUrls: localImageDataUrls };
    }

    return { importArchive: importArchive, importExtendedArchive: importExtendedArchive };
})();
