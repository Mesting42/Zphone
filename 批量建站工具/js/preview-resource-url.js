/**
 * 预览资源使用自包含地址：父页创建的 Blob URL 无法被不透明源 sandbox
 * 读取。这里仅编码内存副本，不修改上传条目，也不改变导出的相对路径。
 */
export function previewResourceUrl(value, mime) {
    const bytes = typeof value === 'string' ? new TextEncoder().encode(value)
        : ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
            : new Uint8Array(value || []);
    let binary = '';
    // 大图片、字体不能一次展开全部字节，否则会超过浏览器的参数数量限制。
    for (let offset = 0; offset < bytes.length; offset += 32768) {
        binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + 32768));
    }
    return 'data:' + mime + ';base64,' + btoa(binary);
}

/** 按原文件类型声明 MIME，使样式导入、模块脚本和字体仍按原方式解析。 */
export function previewResourceMime(path) {
    const extension = String(path || '').split(/[?#]/)[0].toLowerCase().split('.').pop();
    return {
        html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', cjs: 'text/javascript',
        json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg',
        jpeg: 'image/jpeg', jfif: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', ico: 'image/x-icon',
        woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
        mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav'
    }[extension] || 'application/octet-stream';
}
