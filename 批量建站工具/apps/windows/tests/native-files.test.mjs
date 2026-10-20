import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { safeFileName, decodeExportBytes, writeExportAtomic } from '../src/native-files.mjs';

test('Windows export filename blocks traversal and reserved device names', () => {
  assert.equal(safeFileName('../../test.zip'), 'test.zip');
  assert.equal(safeFileName('C:\\folder\\report.zip'), 'report.zip');
  assert.equal(safeFileName('CON.txt'), 'SiteFoundry-CON.txt');
  assert.equal(safeFileName('bad:name?.zip'), 'bad_name_.zip');
});
test('Native transfer preserves ZIP bytes and rejects malformed payloads', () => {
  const expected = Buffer.from([80, 75, 3, 4, 0, 255]);
  assert.deepEqual(decodeExportBytes({ base64: expected.toString('base64') }), expected);
  assert.deepEqual(decodeExportBytes({ bytes: new Uint8Array(expected) }), expected);
  assert.throws(() => decodeExportBytes({ base64: 'not base64!' }));
  assert.throws(() => decodeExportBytes({ bytes: [256] }));
});
test('Native export replaces existing files with all bytes intact', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sitefoundry-export-'));
  const target = join(directory, 'site.zip');
  try {
    await writeExportAtomic(target, Buffer.from('before'));
    const result = await writeExportAtomic(target, Buffer.from('after'));
    assert.equal(result.size, 5);
    assert.equal(await readFile(target, 'utf8'), 'after');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('Failed native rename preserves the destination and removes partial export bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sitefoundry-export-failure-'));
  const target = join(directory, 'existing-directory');
  try {
    await mkdir(target);
    await writeFile(join(target, 'keep.txt'), 'retained');
    await assert.rejects(writeExportAtomic(target, Buffer.from('partial')), /保存文件失败/);
    assert.equal(await readFile(join(target, 'keep.txt'), 'utf8'), 'retained');
    assert.deepEqual(await readdir(directory), ['existing-directory']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
