(function(global) {
    'use strict';

    // libarchive.js 与 worker / WASM 文件一起随工具分发；只有导入 RAR 或 7z 时才加载。
    var scriptUrl = import.meta.url;
    var moduleUrl = new URL('./vendor/libarchive/libarchive.js', scriptUrl).href;
    var workerUrl = new URL('./vendor/libarchive/worker-bundle.js', scriptUrl).href;

    global.ArchiveRuntimeReady = import(moduleUrl).then(function(module) {
        module.Archive.init({ workerUrl: workerUrl });
        return module.Archive;
    });
})(window);
