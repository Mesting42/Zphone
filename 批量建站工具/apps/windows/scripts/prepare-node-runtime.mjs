/** Vendor the official Windows Node executable used by npm subprocesses. The
 * Electron renderer stays isolated; end users never install global Node/npm. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export async function prepareWindowsNode(staging) {
  const version = '24.21.0';
  const directory = join(staging, 'node-runtime');
  const origin = 'https://nodejs.org/dist/v' + version;
  const executable = join(directory, 'node.exe');
  await mkdir(directory, { recursive: true });
  const expected = 'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  try {
    if (hash(await readFile(executable)) === expected) return directory;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const checksumsResponse = await fetch(origin + '/SHASUMS256.txt');
  if (!checksumsResponse.ok) throw new Error('Cannot retrieve official Node checksums.');
  const checksums = await checksumsResponse.text();
  const verified = checksums.split('\n').find(line => line.endsWith('win-x64/node.exe'))?.split(/\s+/)[0];
  if (verified !== expected) throw new Error('The pinned Node runtime does not match official release checksums.');
  const response = await fetch(origin + '/win-x64/node.exe');
  if (!response.ok) throw new Error('Cannot download the Windows Node runtime.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (hash(bytes) !== expected) throw new Error('Windows Node runtime checksum failed.');
  const licenseResponse = await fetch('https://raw.githubusercontent.com/nodejs/node/v' + version + '/LICENSE');
  if (!licenseResponse.ok) throw new Error('Cannot retrieve the Node license.');
  await writeFile(executable, bytes);
  await writeFile(join(directory, 'LICENSE.txt'), await licenseResponse.text());
  await writeFile(join(directory, 'SHASUMS256.txt'), checksums);
  await writeFile(join(directory, 'provenance.json'), JSON.stringify({
    version, platform: 'win-x64', source: origin + '/win-x64/node.exe',
    checksums: origin + '/SHASUMS256.txt', sha256: expected,
    fetchedAt: new Date().toISOString(), bytes: bytes.length
  }, null, 2) + '\n');
  console.log('Vendored verified Windows Node ' + version + ' (' + bytes.length + ' bytes).');
  return directory;
}
