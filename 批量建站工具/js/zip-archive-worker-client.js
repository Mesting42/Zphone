/*
 * ZIP 源码读取的 Worker 客户端。
 * 保持压缩包目录解析和逐文件解压在后台线程，避免大 ZIP 阻塞进度动画与页面交互。
 */
(function(global) {
    'use strict';

    function makeWorkerUrl() {
        const baseUri = global.document && global.document.baseURI;
        if (!baseUri || typeof URL !== 'function') return '';
        return new URL('js/zip-archive-worker.js', baseUri).href;
    }

    function toArrayBuffer(value) {
        if (value instanceof ArrayBuffer) return value;
        if (ArrayBuffer.isView(value)) {
            return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
        }
        return null;
    }

    function read(arrayBuffer, onProgress) {
        const WorkerConstructor = global.Worker;
        const workerUrl = makeWorkerUrl();
        const transferable = toArrayBuffer(arrayBuffer);
        if (typeof WorkerConstructor !== 'function' || !workerUrl || !transferable) return Promise.resolve(null);

        let worker;
        try {
            worker = new WorkerConstructor(workerUrl);
        } catch (error) {
            return Promise.resolve(null);
        }

        return new Promise(function(resolve, reject) {
            let ready = false;
            let settled = false;

            function finish(callback, value) {
                if (settled) return;
                settled = true;
                worker.onmessage = null;
                worker.onerror = null;
                worker.onmessageerror = null;
                worker.terminate();
                callback(value);
            }

            worker.onmessage = function(event) {
                const message = event && event.data || {};
                if (message.type === 'ready') {
                    if (ready) return;
                    ready = true;
                    try {
                        worker.postMessage({ type: 'read', buffer: transferable }, [transferable]);
                    } catch (error) {
                        const unavailable = new Error('无法向 ZIP 后台解析器传递压缩包数据。');
                        unavailable.code = 'ZIP_WORKER_UNAVAILABLE';
                        finish(reject, unavailable);
                    }
                    return;
                }
                if (message.type === 'progress') {
                    if (typeof onProgress === 'function') onProgress(message.message, message.percent);
                    return;
                }
                if (message.type === 'complete') {
                    const entries = (message.entries || []).map(function(entry) {
                        return { path: entry.path, bytes: new Uint8Array(entry.buffer) };
                    });
                    finish(resolve, entries);
                    return;
                }
                if (message.type === 'error') {
                    finish(reject, new Error(message.message || 'ZIP 后台解析失败。'));
                }
            };

            worker.onerror = function() {
                const error = new Error(ready ? 'ZIP 后台解析 Worker 已意外停止。' : 'ZIP 后台解析器无法启动。');
                if (!ready) error.code = 'ZIP_WORKER_UNAVAILABLE';
                finish(reject, error);
            };
            worker.onmessageerror = function() {
                finish(reject, new Error('ZIP 后台解析器返回了无法读取的数据。'));
            };
        });
    }

    global.ZipArchiveWorkerClient = { read: read };
})(typeof globalThis === 'object' ? globalThis : this);
