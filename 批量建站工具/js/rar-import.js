import { ExtractorData } from 'node-unrar-js/esm/js/ExtractorData.js';
import { getUnrar } from 'node-unrar-js/esm/js/unrar.singleton.js';
import unrarWasmUrl from 'node-unrar-js/esm/js/unrar.wasm?url';

async function createBrowserRarExtractor(options) {
    var unrar = await getUnrar(options.wasmBinary ? { wasmBinary: options.wasmBinary } : undefined);
    var extractor = new ExtractorData(unrar, options.data, options.password || '');
    unrar.extractor = extractor;
    return extractor;
}

(function(global) {
    'use strict';

    // libarchive.js 与 worker / WASM 文件一起随工具分发。不要在工作台打开时
    // 下载约 1 MB 的 WASM；仅当用户实际选择 RAR 或 7z 时再初始化。
    // Vite 会将这个模块合并到 assets 目录；运行时仍需从工作台的 js/vendor
    // 读取 WASM 与 worker，因此使用页面基地址而非 import.meta.url。
    var moduleUrl = new URL('js/vendor/libarchive/libarchive.js', document.baseURI).href;
    var workerUrl = new URL('js/vendor/libarchive/worker-bundle.js', document.baseURI).href;
    var archiveRuntimePromise = null;
    var unrarRuntimePromise = null;

    global.loadArchiveRuntime = function() {
        if (!archiveRuntimePromise) {
            archiveRuntimePromise = import(moduleUrl).then(function(module) {
                module.Archive.init({ workerUrl: workerUrl });
                return module.Archive;
            });
            // 为旧调用方保留同一个 Promise，但不在页面初始化阶段创建它。
            global.ArchiveRuntimeReady = archiveRuntimePromise;
        }
        return archiveRuntimePromise;
    };

    // libarchive 对部分 RAR5 / solid RAR 会给出没有错误文本的失败结果。
    // 此回退引擎来自官方 UnRAR C++ 源码的 WebAssembly 编译版，只处理 RAR；7Z 仍由 libarchive 处理。
    global.loadRarFallbackRuntime = function() {
        if (!unrarRuntimePromise) {
            unrarRuntimePromise = fetch(unrarWasmUrl).then(function(response) {
                if (!response.ok) throw new Error('无法加载 RAR5 解析组件（HTTP ' + response.status + '）。');
                return response.arrayBuffer();
            }).then(function(wasmBinary) {
                return {
                    createExtractorFromData: createBrowserRarExtractor,
                    wasmBinary: wasmBinary
                };
            });
        }
        return unrarRuntimePromise;
    };
})(window);
