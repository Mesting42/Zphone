(function(global) {
    'use strict';

    // libarchive.js 与 worker / WASM 文件一起随工具分发。不要在工作台打开时
    // 下载约 1 MB 的 WASM；仅当用户实际选择 RAR 或 7z 时再初始化。
    // Vite 会将这个模块合并到 assets 目录；运行时仍需从工作台的 js/vendor
    // 读取 WASM 与 worker，因此使用页面基地址而非 import.meta.url。
    var moduleUrl = new URL('js/vendor/libarchive/libarchive.js', document.baseURI).href;
    var workerUrl = new URL('js/vendor/libarchive/worker-bundle.js', document.baseURI).href;
    var archiveRuntimePromise = null;

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
})(window);
