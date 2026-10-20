// RAR / 7z 仅在用户选择对应压缩包时才加载；不会执行压缩包内的任何脚本。
// libarchive.js 在 Worker 中解压，解析完成后会释放 Worker。
(function(global) {
    'use strict';

    var promise = null;
    global.GameArchiveRuntime = {
        load: function() {
            if (promise) return promise;
            // Share the pinned local module, Worker and WASM with the editorial
            // workbench. Resolve from the game page, including copied dist HTML.
            var moduleUrl = new URL('../js/vendor/libarchive/libarchive.js', document.baseURI).href;
            var workerUrl = new URL('../js/vendor/libarchive/worker-bundle.js', document.baseURI).href;
            promise = import(/* @vite-ignore */ moduleUrl).then(function(module) {
                module.Archive.init({ workerUrl: workerUrl });
                return module.Archive;
            }).catch(function(error) { promise = null; throw error; });
            return promise;
        }
    };
})(window);
