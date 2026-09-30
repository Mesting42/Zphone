// RAR / 7z 仅在用户选择对应压缩包时才加载；不会执行压缩包内的任何脚本。
// libarchive.js 在 Worker 中解压，解析完成后会释放 Worker。
(function(global) {
    'use strict';

    var promise = null;
    global.GameArchiveRuntime = {
        load: function() {
            if (promise) return promise;
            var moduleUrl = 'https://cdn.jsdelivr.net/npm/libarchive.js@2.0.2/dist/libarchive.js';
            var workerUrl = 'https://cdn.jsdelivr.net/npm/libarchive.js@2.0.2/dist/worker-bundle.js';
            // 远程解压依赖按需加载；入口以 module 加载，兼容 Vite 的导入处理。
            promise = import(/* @vite-ignore */ moduleUrl).then(function(module) {
                module.Archive.init({ workerUrl: workerUrl });
                return module.Archive;
            });
            return promise;
        }
    };
})(window);
