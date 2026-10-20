/** Native export validation shared by IPC and tests. The renderer never supplies
 * an absolute save path: it supplies a filename and bytes, and Windows asks where. */
import { basename } from 'node:path';
import { rename, rm, writeFile } from 'node:fs/promises';

const MAX_EXPORT_BYTES = 1024 * 1024 * 1024;

export function safeFileName(value) {
  let name = basename(String(value || 'SiteFoundry-export.zip').replaceAll('\\', '/'))
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/, '');
  if (!name || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name)) name = 'SiteFoundry-' + (name || 'export.zip');
  return name.slice(0, 180);
}

export function decodeExportBytes(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('缺少导出文件。');
  let bytes;
  if (payload.bytes instanceof ArrayBuffer) bytes = Buffer.from(payload.bytes);
  else if (ArrayBuffer.isView(payload.bytes)) bytes = Buffer.from(payload.bytes.buffer, payload.bytes.byteOffset, payload.bytes.byteLength);
  else if (Array.isArray(payload.bytes)) {
    if (payload.bytes.length > MAX_EXPORT_BYTES || payload.bytes.some(value => !Number.isInteger(value) || value < 0 || value > 255)) throw new Error('导出字节格式无效。');
    bytes = Buffer.from(payload.bytes);
  } else if (typeof payload.base64 === 'string') {
    if (payload.base64.length > Math.ceil(MAX_EXPORT_BYTES * 4 / 3) + 4) throw new Error('单个导出文件不能超过 1 GB。');
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload.base64)) throw new Error('导出文件的 Base64 数据无效。');
    bytes = Buffer.from(payload.base64, 'base64');
  } else throw new Error('导出文件缺少二进制数据。');
  if (bytes.length > MAX_EXPORT_BYTES) throw new Error('单个导出文件不能超过 1 GB。');
  return bytes;
}

export async function writeExportAtomic(filePath, bytes) {
  const temporary = filePath + '.sitefoundry-' + process.pid + '-' + Date.now() + '.tmp';
  // Save to a sibling first; a failed write cannot truncate an existing export.
  try { await writeFile(temporary, bytes); await rename(temporary, filePath); }
  catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw new Error('保存文件失败：' + error.message);
  }
  return { cancelled: false, name: safeFileName(filePath), path: filePath, size: bytes.length };
}
