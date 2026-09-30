/*
 * 在后台线程中读取 ZIP 目录并解压源码文件。
 * JSZip 不提供目录解析百分比，因此该阶段由主线程显示持续动画；解压阶段报告真实进度。
 */
(function(scope) {
    'use strict';

    const jszipUrl = new URL('../node_modules/jszip/dist/jszip.min.js', scope.location.href).href;
    scope.importScripts(jszipUrl);
    if (!scope.JSZip || typeof scope.JSZip.loadAsync !== 'function') {
        throw new Error('ZIP 解析组件未能在后台线程加载。');
    }

    function isSafePath(value) {
        const path = String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '').replace(/\/{2,}/g, '/');
        return !!path && path.indexOf('\0') === -1 && !/^__MACOSX(?:\/|$)/i.test(path) && !path.split('/').some(function(part) { return part === '..'; });
    }

    function report(message, percent) {
        scope.postMessage({ type: 'progress', message: message, percent: percent });
    }

    async function readZip(buffer) {
        report('正在后台解析 ZIP 目录…', null);
        const zip = await scope.JSZip.loadAsync(buffer);
        const paths = Object.keys(zip.files).filter(function(path) {
            return !zip.files[path].dir && isSafePath(path);
        });
        report('ZIP 目录读取完成：共 ' + paths.length + ' 个源码文件。', 12);
        if (!paths.length) {
            report('ZIP 文件提取完成：没有可读取的普通文件。', 96);
            return [];
        }

        const weights = paths.map(function(path) {
            const rawSize = zip.files[path] && zip.files[path]._data && Number(zip.files[path]._data.uncompressedSize);
            return Number.isFinite(rawSize) && rawSize > 0 ? rawSize : 1;
        });
        const totalWeight = weights.reduce(function(sum, weight) { return sum + weight; }, 0);
        const extractionProgress = paths.map(function() { return 0; });
        let lastProgress = 12;

        function reportExtraction(path, index, complete) {
            if (complete) extractionProgress[index] = 1;
            const weightedProgress = extractionProgress.reduce(function(sum, progress, progressIndex) {
                return sum + weights[progressIndex] * progress;
            }, 0);
            const nextProgress = Math.max(lastProgress, 12 + 84 * weightedProgress / totalWeight);
            if (complete || nextProgress - lastProgress >= 0.35) {
                lastProgress = nextProgress;
                report('正在解压源码文件：' + path, nextProgress);
            }
        }

        const entries = await Promise.all(paths.map(async function(path, index) {
            const bytes = await zip.files[path].async('uint8array', function(metadata) {
                const percent = Number(metadata && metadata.percent);
                if (!Number.isFinite(percent)) return;
                extractionProgress[index] = Math.max(extractionProgress[index], Math.max(0, Math.min(100, percent)) / 100);
                reportExtraction(path, index, false);
            });
            reportExtraction(path, index, true);
            const buffer = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
                ? bytes.buffer
                : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
            return { path: path, buffer: buffer };
        }));

        report('ZIP 文件提取完成：共 ' + entries.length + ' 个源码文件。', 96);
        return entries;
    }

    scope.onmessage = function(event) {
        const message = event && event.data || {};
        if (message.type !== 'read') return;
        readZip(message.buffer).then(function(entries) {
            const transferables = entries.map(function(entry) { return entry.buffer; });
            scope.postMessage({ type: 'complete', entries: entries }, transferables);
        }).catch(function(error) {
            scope.postMessage({ type: 'error', message: String(error && error.message || error || 'ZIP 解析失败。') });
        });
    };

    scope.postMessage({ type: 'ready' });
})(self);
