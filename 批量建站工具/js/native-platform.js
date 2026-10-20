/**
 * Native host boundary shared by the two workbenches.
 * Generators continue producing ordinary Blobs and files. Only this adapter
 * knows Electron/Capacitor method names, transfer chunks and document URIs.
 */
(function (global) {
    'use strict';
    if (global.top !== global.self) return;

    // Android 10 devices may retain an older WebView. These small language
    // fallbacks are also used by copied classic scripts outside Vite's bundle.
    if (!Object.hasOwn) Object.hasOwn = function (value, key) { return Object.prototype.hasOwnProperty.call(value, key); };
    if (!Array.prototype.at) Object.defineProperty(Array.prototype, 'at', { value: function (index) { index = Number(index) || 0; return this[index < 0 ? this.length + index : index]; }, configurable: true, writable: true });
    if (!String.prototype.replaceAll) Object.defineProperty(String.prototype, 'replaceAll', { value: function (search, replacement) { return search instanceof RegExp ? this.replace(search, replacement) : this.split(String(search)).join(replacement); }, configurable: true, writable: true });

    var desktop = global.SiteFoundryNative;
    var capacitor = global.Capacitor;
    var android = capacitor && capacitor.Plugins && capacitor.Plugins.SiteFoundryNative;
    var nativeKind = desktop ? 'windows' : android ? 'android' : 'browser';
    var host = desktop || android;
    var info = { platform: nativeKind, capabilities: {} };
    var directory = null;
    var exportQueue = Promise.resolve();
    var templateAnalysis;
    var resolveAnalysis;
    var analysisReady = new Promise(function (resolve) { resolveAnalysis = resolve; });
    var CHUNK_BYTES = 512 * 1024;

    function announce(state, detail) {
        global.dispatchEvent(new CustomEvent('sitefoundry-native-operation', { detail: Object.assign({ state: state }, detail || {}) }));
    }

    function requireHost(method) {
        if (!host || typeof host[method] !== 'function') throw new Error('当前应用尚未提供此系统功能：' + method);
        return host[method].bind(host);
    }

    var ready = host
        ? Promise.resolve().then(function () {
            return (host.getPlatformInfo || host.capabilities).call(host);
        }).then(function (value) {
            info = Object.assign({}, info, value || {}, { platform: nativeKind });
            directory = info.exportDirectory || (info.exportDirectoryUri || info.directoryUri ? { directoryUri: info.exportDirectoryUri || info.directoryUri } : null);
            global.document.documentElement.dataset.sitefoundryPlatform = nativeKind;
            return info;
        })
        : Promise.resolve(info);
    // Keep startup errors observable without generating an unhandled rejection
    // while the existing workbench initializes its independent browser features.
    ready.catch(function (error) { announce('error', { message: error.message }); });

    function encodeBase64(bytes) {
        var text = '';
        for (var start = 0; start < bytes.length; start += 8192) {
            text += String.fromCharCode.apply(null, bytes.subarray(start, start + 8192));
        }
        return global.btoa(text);
    }

    function decodeBase64(value) {
        var text = global.atob(value || '');
        var bytes = new Uint8Array(text.length);
        for (var i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
        return bytes;
    }

    async function saveNative(blob, name, destination) {
        await ready;
        var beginName = nativeKind === 'android' ? 'beginExport' : 'startFile';
        var appendName = nativeKind === 'android' ? 'appendExport' : 'appendFile';
        var finishName = nativeKind === 'android' ? 'finishExport' : 'finishFile';
        var cancelName = nativeKind === 'android' ? 'cancelExport' : 'cancelFile';
        var started;
        announce('saving', { name: name, bytes: blob.size, progress: 0 });
        try {
            var target = destination || directory;
            started = await requireHost(beginName)({ name: name, mime: blob.type, mimeType: blob.type, size: blob.size,
                relativePath: target && target.relativePath,
                directoryUri: target && target.directoryUri, directoryToken: target && (target.directoryToken || target.token) });
            if (started && started.cancelled) { announce('cancelled', { name: name }); return started; }
            var id = started && (started.transferId || started.id || started.token);
            if (!id) throw new Error('系统未返回文件保存任务，文件尚未保存。');
            for (var offset = 0; offset < blob.size; offset += CHUNK_BYTES) {
                var chunk = new Uint8Array(await blob.slice(offset, offset + CHUNK_BYTES).arrayBuffer());
                var encoded = encodeBase64(chunk);
                await requireHost(appendName)({ id: id, transferId: id, token: id, base64: encoded, dataBase64: encoded });
                announce('saving', { name: name, bytes: blob.size, progress: Math.min(100, Math.round((offset + chunk.length) / Math.max(1, blob.size) * 100)) });
            }
            var result = await requireHost(finishName)({ id: id, transferId: id, token: id });
            announce(result && result.cancelled ? 'cancelled' : 'saved', { name: name });
            return result || { saved: true, name: name };
        } catch (error) {
            if (started && typeof host[cancelName] === 'function') {
                await host[cancelName]({ id: started.transferId || started.id || started.token,
                    transferId: started.transferId || started.id || started.token, token: started.transferId || started.id || started.token }).catch(function () {});
            }
            announce('error', { name: name, message: error.message });
            throw error;
        }
    }

    function saveExport(blob, name, destination) {
        if (nativeKind === 'browser') {
            if (typeof global.saveAs !== 'function') return Promise.reject(new Error('下载组件尚未准备好，请稍后重试。'));
            global.saveAs(blob, name);
            return Promise.resolve({ saved: true, name: name, browser: true });
        }
        // Multiple-site exports open one document picker at a time and resolve
        // only after bytes have actually been flushed by the native host.
        var task = exportQueue.catch(function () {}).then(function () { return saveNative(blob, name, destination); });
        exportQueue = task;
        return task;
    }

    async function chooseExportDirectory() {
        await ready;
        var result = await requireHost(nativeKind === 'android' ? 'selectExportDirectory' : 'selectDirectory')({});
        if (!result || result.cancelled) return { cancelled: true };
        directory = result;
        return result;
    }

    async function requestTemplate(url, options) {
        if (nativeKind !== 'android') throw new Error('原生模板存储只供安卓适配层使用。');
        await ready;
        var pathname = new URL(url, global.location.href).pathname;
        var body = options && options.body ? JSON.parse(options.body) : undefined;
        if (/\/analyze$/.test(pathname)) return (await analysisReady).analyzeTemplate(String(body && body.source || ''));
        if (/\/save$/.test(pathname)) {
            body = Object.assign({}, body, { template: (await analysisReady).prepareTemplate(body) });
        }
        var result = await requireHost('templateRequest')({ method: options && options.method || 'GET', path: pathname, body: body });
        var payload = result && result.body !== undefined ? result.body : result;
        if (typeof payload === 'string') payload = JSON.parse(payload);
        if ((result && result.status >= 400) || (payload && payload.error)) throw new Error(payload && payload.error || '模板存储操作失败。');
        return payload;
    }

    async function readNativeFile(item) {
        var parts = [];
        var offset = 0;
        while (offset < item.size) {
            var content = await requireHost('readImportFile')({ uri: item.uri, offset: offset, length: CHUNK_BYTES });
            var bytes = decodeBase64(content.dataBase64 || content.base64);
            if (!bytes.length) throw new Error('目录文件读取提前结束：' + item.name);
            parts.push(bytes);
            offset += bytes.length;
        }
        var file = new File(parts, item.name, { type: item.type || '', lastModified: item.lastModified || Date.now() });
        Object.defineProperty(file, 'webkitRelativePath', { value: item.path || item.name });
        return file;
    }

    function safeSegment(value) {
        var name = String(value || '');
        if (!name || name === '.' || name === '..' || /[\\/\x00]/.test(name)) throw new Error('目录或文件名称无效。');
        return name;
    }

    function writableDirectory(selection, prefix, name) {
        return {
            kind: 'directory', name: name,
            getDirectoryHandle: async function (child) { child = safeSegment(child); return writableDirectory(selection, prefix + child + '/', child); },
            getFileHandle: async function (child) {
                child = safeSegment(child);
                return { kind: 'file', name: child, createWritable: async function () {
                    var parts = [];
                    var closed = false;
                    return {
                        write: async function (value) { if (closed) throw new Error('文件写入已经结束。'); parts.push(value); },
                        close: async function () {
                            if (closed) return;
                            closed = true;
                            var result = await saveExport(new Blob(parts), child, Object.assign({}, selection, { relativePath: prefix + child }));
                            if (result.cancelled) throw Object.assign(new Error('已取消目录文件写入。'), { name: 'AbortError' });
                            parts = [];
                        },
                        abort: async function () { closed = true; parts = []; }
                    };
                } };
            }
        };
    }

    function readableDirectory(selection) {
        var rootName = selection.name || selection.directoryName || '所选目录';
        var root = { name: rootName, kind: 'directory', children: new Map() };
        (selection.files || []).forEach(function (item) {
            var segments = String(item.path || item.name).replace(/\\/g, '/').split('/').filter(Boolean);
            if (segments[0] === rootName) segments.shift();
            var current = root;
            segments.forEach(function (segment, index) {
                safeSegment(segment);
                if (index === segments.length - 1) {
                    current.children.set(segment, { kind: 'file', name: segment, getFile: function () { return readNativeFile(item); } });
                } else {
                    if (!current.children.has(segment)) current.children.set(segment, { kind: 'directory', name: segment, children: new Map() });
                    current = current.children.get(segment);
                }
            });
        });
        function bind(node) {
            if (node.kind === 'directory') {
                node.entries = async function* () { for (var pair of node.children.entries()) yield pair; };
                node.children.forEach(bind);
            }
        }
        bind(root);
        return root;
    }

    async function pickNativeDirectory(options) {
        await ready;
        var readOnly = options && options.mode === 'read';
        var selection = await requireHost(readOnly ? 'selectImportDirectory' : nativeKind === 'android' ? 'selectExportDirectory' : 'selectDirectory')({});
        if (!selection || selection.cancelled) throw Object.assign(new Error('已取消目录选择。'), { name: 'AbortError' });
        return readOnly ? readableDirectory(selection) : writableDirectory(selection, '', selection.name || '导出目录');
    }

    async function readDirectoryIntoInput(input) {
        var selected = await requireHost('selectImportDirectory')({});
        if (!selected || selected.cancelled) return;
        var files = selected.files || [];
        var transfer = new DataTransfer();
        for (var index = 0; index < files.length; index++) {
            var item = files[index];
            transfer.items.add(await readNativeFile(item));
            announce('reading', { name: item.name, progress: Math.round((index + 1) / Math.max(1, files.length) * 100) });
        }
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (nativeKind !== 'browser' && typeof host.selectImportDirectory === 'function') {
        // Match the File System Access surface already used by folder workflows;
        // native SAF authorizes a tree, and every child remains inside that tree.
        global.showDirectoryPicker = pickNativeDirectory;
    }
    if (nativeKind === 'android') {
        global.document.addEventListener('click', function (event) {
            var input = event.target;
            if (!input || input.tagName !== 'INPUT' || !input.hasAttribute('webkitdirectory')) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            if (input.dataset.nativeReading === 'true') return;
            input.dataset.nativeReading = 'true';
            readDirectoryIntoInput(input).catch(function (error) {
                announce('error', { message: error.message });
            }).finally(function () { delete input.dataset.nativeReading; });
        }, true);
    }

    var api = {
        ready: ready, isNative: function () { return nativeKind !== 'browser'; },
        kind: nativeKind, getInfo: function () { return info; },
        saveExport: saveExport, chooseExportDirectory: chooseExportDirectory,
        requestTemplate: requestTemplate,
        registerTemplateAnalysis: function (analysis) { templateAnalysis = analysis; resolveAnalysis(analysis); },
        handleBack: function () { return typeof api.onBack === 'function' && api.onBack(); }
    };
    ['importProject', 'listProjects', 'inspectProject', 'prepareProject', 'startBuild', 'taskStatus', 'cancelTask', 'previewArtifact', 'exportArtifact'].forEach(function (method) {
        api[method] = async function (options) { await ready; return requireHost(method)(options || {}); };
    });
    global.SiteFoundryPlatform = api;
})(typeof globalThis === 'object' ? globalThis : this);
