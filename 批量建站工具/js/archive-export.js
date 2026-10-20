/**
 * Shared ZIP output policy. Text keeps DEFLATE level 6; formats which already
 * compress their contents are stored verbatim instead of being compressed twice.
 * This module only controls packaging and never edits paths or file contents.
 */
(function(global) {
    'use strict';
    var compressedMedia = /\.(?:jpe?g|png|gif|webp|avif|woff2|mp3|mp4|webm|ogg|zip|rar|7z|gz)$/i;

    function generate(zip, options, onUpdate) {
        Object.keys(zip.files || {}).forEach(function(path) {
            var file = zip.files[path];
            // An explicit per-file policy belongs to the original caller.
            if (file && !file.dir && compressedMedia.test(path) && file.options && !file.options.compression) {
                file.options.compression = 'STORE';
            }
        });
        return zip.generateAsync(options, onUpdate);
    }

    function bytes(value) {
        // ArrayBuffer.isView also recognizes values from another realm. Keep a
        // byte view rather than expanding every byte into a boxed JS number.
        if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        return new Uint8Array(value || []);
    }

    /** Resolve only after the native writer has finished. Callers can therefore
     * keep their progress/error state accurate when a user cancels the picker. */
    async function save(blob, fileName) {
        var result;
        if (global.SiteFoundryPlatform) result = await global.SiteFoundryPlatform.saveExport(blob, fileName);
        else if (typeof global.saveAs === 'function') { global.saveAs(blob, fileName); result = { browser: true }; }
        else throw new Error('文件保存组件尚未加载。');
        if (result && result.cancelled) throw Object.assign(new Error('已取消保存，文件尚未导出。'), { name: 'AbortError' });
        return result;
    }

    global.ArchiveExport = { generate: generate, bytes: bytes, save: save };
})(typeof globalThis === 'object' ? globalThis : this);
