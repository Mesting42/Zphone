import JSZip from 'jszip';
import { fnv1a, sha256, slugify } from './utils.js';

const IMAGE_PATTERN = /\.(jpe?g|png|gif|webp|avif|svg)$/i;

export function parseJsonPayload(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text).replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(`JSON 无法解析：${error.message}`);
  }
  const rows = Array.isArray(parsed) ? parsed : parsed?.articles ?? parsed?.data;
  if (!Array.isArray(rows)) throw new Error('JSON 顶层必须是数组，或包含 articles/data 数组。');
  if (!rows.every((row) => row && typeof row === 'object' && !Array.isArray(row))) {
    throw new Error('每条文章记录都必须是对象。');
  }
  return rows;
}

export function summarizeRows(rows) {
  const fields = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return fields.map((name) => {
    const values = rows.map((row) => row[name]);
    const populated = values.filter((value) => value !== undefined && value !== null && value !== '');
    const types = [...new Set(populated.map((value) => Array.isArray(value) ? 'array' : typeof value))];
    return { name, type: types.join(' / ') || 'empty', emptyRate: rows.length ? Math.round((1 - populated.length / rows.length) * 100) : 0 };
  });
}

export function inspectRows(rows) {
  const warnings = [];
  const ids = new Set();
  rows.forEach((row, index) => {
    if (row.id !== undefined) {
      const id = String(row.id);
      if (ids.has(id)) warnings.push(`第 ${index + 1} 条记录的 ID “${id}” 重复。`);
      ids.add(id);
    }
    for (const [key, value] of Object.entries(row)) {
      const text = String(value ?? '');
      if (text.length > 250000) warnings.push(`第 ${index + 1} 条的 ${key} 异常长（${text.length} 字符）。`);
      if (/<script\b|javascript:|onerror\s*=|onload\s*=/i.test(text)) warnings.push(`第 ${index + 1} 条的 ${key} 含危险 HTML，将被转义。`);
    }
  });
  return warnings;
}

export async function importDataFile(file, onProgress = () => {}) {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.json')) {
    const rows = parseJsonPayload(await file.text());
    return makeImportResult(file.name, rows, [], inspectRows(rows));
  }
  if (!lower.endsWith('.zip')) throw new Error('仅支持 .json 或 .zip 文件。');
  const zipInput = typeof file.arrayBuffer === 'function' ? await file.arrayBuffer() : file;
  const zip = await JSZip.loadAsync(zipInput, { checkCRC32: true, createFolders: false });
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const unsafe = entries.find((entry) => isUnsafeZipPath(entry.name));
  if (unsafe) throw new Error(`ZIP 包含不安全路径：${unsafe.name}`);
  const jsonEntries = entries.filter((entry) => entry.name.toLowerCase().endsWith('.json'));
  if (jsonEntries.length !== 1) throw new Error(`ZIP 中必须恰好有一个 JSON 文件，当前找到 ${jsonEntries.length} 个。`);
  const rows = parseJsonPayload(await jsonEntries[0].async('string'));
  const imageEntries = entries.filter((entry) => IMAGE_PATTERN.test(entry.name));
  const images = [];
  const usedNames = new Set();
  for (let index = 0; index < imageEntries.length; index += 1) {
    const entry = imageEntries[index];
    const bytes = await entry.async('uint8array');
    const ext = entry.name.split('.').pop().toLowerCase();
    if (ext === 'svg' && /<script\b|<foreignObject\b|\bon\w+\s*=|(?:href|src)\s*=\s*["']\s*(?:javascript:|https?:)/i.test(new TextDecoder().decode(bytes))) {
      throw new Error(`SVG 包含脚本、事件处理器或远程资源，已拒绝：${entry.name}`);
    }
    const basename = entry.name.split('/').pop().replace(/\.[^.]+$/, '');
    const outputName = uniqueName(`${slugify(basename, 'cover')}.${ext}`, usedNames);
    const dimensions = await readImageDimensions(bytes, ext);
    const fingerprint = await visualFingerprint(bytes, ext);
    images.push({
      originalPath: entry.name,
      outputPath: `assets/images/${outputName}`,
      bytes,
      hash: await sha256(bytes),
      fingerprint,
      width: dimensions.width,
      height: dimensions.height,
      mime: mimeFor(ext)
    });
    onProgress(Math.round(((index + 1) / Math.max(1, imageEntries.length)) * 100), `正在分析图片 ${index + 1}/${imageEntries.length}`);
  }
  const warnings = inspectRows(rows);
  if (!imageEntries.length) warnings.push('ZIP 中未找到图片；缺图文章不能进入递审版。');
  return makeImportResult(file.name, rows, images, warnings);
}

function makeImportResult(fileName, rows, images, warnings) {
  return { fileName, rows, images, warnings, fields: summarizeRows(rows), preview: rows.slice(0, 3) };
}

function isUnsafeZipPath(path) {
  return path.startsWith('/') || path.startsWith('\\') || /^[a-z]:/i.test(path) || path.split(/[\\/]/).includes('..');
}

function uniqueName(name, used) {
  const dot = name.lastIndexOf('.');
  const base = name.slice(0, dot);
  const ext = name.slice(dot);
  let candidate = name;
  let suffix = 2;
  while (used.has(candidate)) candidate = `${base}-${suffix++}${ext}`;
  used.add(candidate);
  return candidate;
}

function mimeFor(ext) {
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml' })[ext] || 'application/octet-stream';
}

async function readImageDimensions(bytes, ext) {
  if (ext === 'svg') {
    const text = new TextDecoder().decode(bytes);
    const viewBox = text.match(/viewBox=["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/i);
    const width = text.match(/width=["']([\d.]+)/i)?.[1];
    const height = text.match(/height=["']([\d.]+)/i)?.[1];
    return { width: Number(width || viewBox?.[1]) || 1200, height: Number(height || viewBox?.[2]) || 675 };
  }
  if (typeof createImageBitmap !== 'function') return { width: 1200, height: 675 };
  try {
    const bitmap = await createImageBitmap(new Blob([bytes], { type: mimeFor(ext) }));
    const result = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return result;
  } catch {
    return { width: 0, height: 0 };
  }
}

async function visualFingerprint(bytes, ext) {
  if (ext === 'svg' || typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') return '';
  try {
    const bitmap = await createImageBitmap(new Blob([bytes], { type: mimeFor(ext) }));
    const canvas = new OffscreenCanvas(8, 8);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, 8, 8);
    bitmap.close();
    const data = context.getImageData(0, 0, 8, 8).data;
    const luminance = [];
    for (let index = 0; index < data.length; index += 4) luminance.push(data[index] * .299 + data[index + 1] * .587 + data[index + 2] * .114);
    const average = luminance.reduce((sum, item) => sum + item, 0) / luminance.length;
    return luminance.map((item) => item >= average ? '1' : '0').join('');
  } catch {
    return fnv1a(bytes.slice(0, 512).join(','));
  }
}

export function mapRows(rows, mapping, images = []) {
  const imageLookup = new Map();
  images.forEach((image) => {
    imageLookup.set(image.originalPath.replaceAll('\\', '/').toLowerCase(), image);
    imageLookup.set(image.originalPath.split(/[\\/]/).pop().toLowerCase(), image);
  });
  return rows.map((row, index) => {
    const article = { _row: index + 1 };
    for (const [target, source] of Object.entries(mapping)) article[target] = source ? row[source] ?? '' : '';
    const imageValue = String(article.image || '').replaceAll('\\', '/');
    article._image = imageLookup.get(imageValue.toLowerCase()) || imageLookup.get(imageValue.split('/').pop().toLowerCase()) || null;
    return article;
  });
}
