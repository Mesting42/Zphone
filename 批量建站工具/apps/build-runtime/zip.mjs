import fs from 'node:fs/promises';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

// Keep archive handling independent of the UI and platform bridge. Reject links,
// duplicate paths and expansion bombs before writing any entry into app storage.
export function safeArchivePath(name) {
  const normalized = String(name).replaceAll('\\', '/');
  if (!normalized || normalized.includes('\0') || normalized.startsWith('/') || /^[a-z]:/i.test(normalized)) throw new Error('Invalid archive path');
  if (normalized.split('/').some((part) => part === '..')) throw new Error('Archive contains a parent-directory path');
  const parts = normalized.split('/').filter((part) => part && part !== '.');
  // Use one portable namespace for Windows and Android. Windows normalizes a
  // trailing dot/space and interprets colons as alternate streams; accepting
  // those names would bypass a textual parent-directory/duplicate-path check.
  if (!parts.length || parts.some((part) => /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error('Invalid archive path');
  return parts.join('/') + (normalized.endsWith('/') ? '/' : '');
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export async function extractProjectZip(buffer, destination, { maxFiles = 50000, maxBytes = 1073741824 } = {}) {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0 || buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6) || end + 22 + buffer.readUInt16LE(end + 20) !== buffer.length) throw new Error('Unsupported or damaged ZIP');
  const count = buffer.readUInt16LE(end + 10);
  if (buffer.readUInt16LE(end + 8) !== count) throw new Error('Unsupported multipart ZIP');
  if (count === 65535 || count > maxFiles) throw new Error('ZIP64 or excessive file count is unsupported');
  let cursor = buffer.readUInt32LE(end + 16), totalBytes = 0;
  const directoryEnd = cursor + buffer.readUInt32LE(end + 12);
  if (directoryEnd !== end) throw new Error('Damaged ZIP directory size');
  const entries = [], names = new Set();
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Damaged ZIP directory');
    const flags = buffer.readUInt16LE(cursor + 8), method = buffer.readUInt16LE(cursor + 10);
    const packed = buffer.readUInt32LE(cursor + 20), size = buffer.readUInt32LE(cursor + 24);
    const nameBytes = buffer.readUInt16LE(cursor + 28), extraBytes = buffer.readUInt16LE(cursor + 30), commentBytes = buffer.readUInt16LE(cursor + 32);
    if (cursor + 46 + nameBytes + extraBytes + commentBytes > directoryEnd) throw new Error('Truncated ZIP directory');
    const external = buffer.readUInt32LE(cursor + 38), offset = buffer.readUInt32LE(cursor + 42);
    const name = safeArchivePath(buffer.subarray(cursor + 46, cursor + 46 + nameBytes).toString('utf8'));
    if ((external >>> 16 & 0xf000) === 0xa000) throw new Error('ZIP symbolic links are unsupported');
    if (flags & 1 || ![0, 8].includes(method)) throw new Error('Encrypted or unsupported ZIP compression');
    if (names.has(name.toLowerCase())) throw new Error('Duplicate ZIP path: ' + name);
    names.add(name.toLowerCase());
    totalBytes += size;
    if (totalBytes > maxBytes) throw new Error('ZIP exceeds the 1 GiB expanded import limit');
    if (!name.endsWith('/') && !name.split('/').some((part) => ['node_modules', '.next', '.git', '.sitefoundry-build'].includes(part))) {
      entries.push({ name, method, packed, size, offset, crc: buffer.readUInt32LE(cursor + 16) });
    }
    cursor += 46 + nameBytes + extraBytes + commentBytes;
  }
  if (cursor !== directoryEnd) throw new Error('Damaged ZIP directory entry count');
  for (const entry of entries) {
    if (entry.offset + 30 > buffer.length || buffer.readUInt32LE(entry.offset) !== 0x04034b50) throw new Error('Damaged ZIP entry');
    const start = entry.offset + 30 + buffer.readUInt16LE(entry.offset + 26) + buffer.readUInt16LE(entry.offset + 28);
    if (start + entry.packed > buffer.length) throw new Error('Truncated ZIP entry');
    const packed = buffer.subarray(start, start + entry.packed);
    const content = entry.method === 8 ? inflateRawSync(packed, { maxOutputLength: Math.max(1, entry.size) }) : packed;
    if (content.length !== entry.size || crc32(content) !== entry.crc) throw new Error('ZIP checksum mismatch: ' + entry.name);
    const target = path.join(destination, entry.name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, { flag: 'wx' });
  }
  return { files: entries.length, expandedBytes: totalBytes };
}

export async function walkFiles(directory, relative = '') {
  const files = [];
  for (const entry of (await fs.readdir(path.join(directory, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = path.posix.join(relative.replaceAll('\\', '/'), entry.name);
    if (entry.isSymbolicLink()) throw new Error('Symbolic links cannot be exported');
    if (entry.isDirectory()) files.push(...await walkFiles(directory, name));
    else if (entry.isFile()) files.push(name);
  }
  return files;
}

// Stored ZIP entries avoid a second large compressed copy of the complete artifact
// in memory. Bytes stream to the destination, with only its directory in memory.
export async function createArtifactZip(directory, destination) {
  const files = await walkFiles(directory);
  if (files.length >= 65535) throw new Error('Artifact requires ZIP64; export is not supported');
  const handle = await fs.open(destination, 'w'), central = [];
  let offset = 0;
  try {
    for (const relative of files) {
      const bytes = await fs.readFile(path.join(directory, relative)), name = Buffer.from(relative);
      if (bytes.length > 0xffffffff || offset > 0xffffffff) throw new Error('Artifact exceeds ZIP32 limit');
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6);
      local.writeUInt32LE(crc32(bytes), 14); local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(name.length, 26);
      const header = Buffer.alloc(46);
      header.writeUInt32LE(0x02014b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(20, 6); header.writeUInt16LE(0x800, 8);
      header.writeUInt32LE(crc32(bytes), 16); header.writeUInt32LE(bytes.length, 20); header.writeUInt32LE(bytes.length, 24);
      header.writeUInt16LE(name.length, 28); header.writeUInt32LE(offset, 42);
      central.push(header, name);
      await handle.write(local); await handle.write(name); await handle.write(bytes);
      offset += local.length + name.length + bytes.length;
    }
    const index = Buffer.concat(central), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(index.length, 12); end.writeUInt32LE(offset, 16);
    await handle.write(index); await handle.write(end);
  } finally { await handle.close(); }
  return { files: files.length, bytes: offset + central.reduce((sum, chunk) => sum + chunk.length, 0) + 22 };
}
