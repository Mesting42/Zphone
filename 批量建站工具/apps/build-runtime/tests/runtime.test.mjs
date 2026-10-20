import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createBuildManager } from '../index.mjs';
import { safeArchivePath, createArtifactZip, extractProjectZip } from '../zip.mjs';
import { prepareLocalNextFonts } from '../local-fonts.mjs';
import { createAndroidShellInitialization } from '../android-adapters.mjs';

const application = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const evidence = path.join(application, 'coverage/apps-20261013/runtime-targeted-' + new Date().toISOString().replace(/[:.]/g, '-'));
await fs.mkdir(evidence, { recursive: true });
const source = path.join(evidence, 'fixture');
await fs.mkdir(source);
const packageJson = { name: 'sitefoundry-runtime-fixture', version: '1.0.0', private: true, scripts: { build: 'node build.cjs' } };
await fs.writeFile(path.join(source, 'package.json'), JSON.stringify(packageJson));
await fs.writeFile(path.join(source, 'package-lock.json'), JSON.stringify({ name: packageJson.name, version: '1.0.0', lockfileVersion: 3, packages: { '': packageJson } }));
await fs.writeFile(path.join(source, 'content.txt'), 'first website');
await fs.writeFile(path.join(source, 'build.cjs'), `
const fs = require('node:fs');
if (fs.existsSync('hang.txt')) { setInterval(() => {}, 1000); }
else if (!fs.existsSync('no-output.txt')) { fs.mkdirSync('dist', {recursive:true}); fs.writeFileSync('dist/index.html', fs.readFileSync('content.txt')); }
console.log('fixture build script ran');
`);
const manager = createBuildManager({ dataDirectory: path.join(evidence, 'profile') });
const project = await manager.importProject({ sourceDirectory: source });
const privateSource = path.join(evidence, 'profile/source-builds/projects', project.id, 'source');
async function wait(task, expected = 'succeeded') {
  const deadline = Date.now() + 30000;
  while (!['succeeded', 'failed', 'cancelled', 'interrupted'].includes(task.state)) {
    assert.ok(Date.now() < deadline, 'Task completed within 30 seconds');
    await new Promise((resolve) => setTimeout(resolve, 100));
    task = await manager.taskStatus({ taskId: task.id });
  }
  assert.equal(task.state, expected, JSON.stringify(task.error));
  return task;
}

test('portable ZIP rejects normalized Windows escapes and corrupt CRC', async () => {
  for (const name of ['../escape', '.. /escape', 'folder./escape', 'x:y', 'NUL.txt', 'C:\\escape', '/escape', 'a/../b']) assert.throws(() => safeArchivePath(name));
  assert.equal(safeArchivePath('./one//two.txt'), 'one/two.txt');
  const archive = path.join(evidence, 'fixture.zip');
  await createArtifactZip(source, archive);
  const buffer = await fs.readFile(archive);
  const nameBytes = buffer.readUInt16LE(26), extraBytes = buffer.readUInt16LE(28);
  buffer[30 + nameBytes + extraBytes] ^= 1;
  await assert.rejects(extractProjectZip(buffer, path.join(evidence, 'corrupt-extraction')), /checksum/);
});

test('offline guard reaches ESM exports, DNS, UDP and inherited Node workers', async () => {
  const guard = path.join(application, 'apps/build-runtime/network-guard.cjs');
  const script = `
    import assert from 'node:assert/strict';
    import { get } from 'node:https';
    import { lookup } from 'node:dns';
    import { createSocket } from 'node:dgram';
    import { execFileSync } from 'node:child_process';
    assert.throws(() => get('https://example.com'), { code: 'OFFLINE_NETWORK_BLOCKED' });
    assert.throws(() => lookup('example.com', () => {}), { code: 'OFFLINE_NETWORK_BLOCKED' });
    const udp = createSocket('udp4');
    assert.throws(() => udp.send(Buffer.from('x'), 53, '8.8.8.8'), { code: 'OFFLINE_NETWORK_BLOCKED' });
    udp.close();
    execFileSync(process.execPath, ['-e', "try { require('node:https').get('https://example.com'); process.exit(2); } catch (error) { if(error.code !== 'OFFLINE_NETWORK_BLOCKED') process.exit(3); }"], {stdio:'pipe'});
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '--require=' + JSON.stringify(guard) }, windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
});

test('native manager persists readiness, task state and immutable artifacts', async () => {
  const prepared = await wait(await manager.prepareProject({ projectId: project.id, online: true }));
  assert.equal(prepared.project.prepared, true);
  const first = await wait(await manager.startBuild({ projectId: project.id, offline: true }));
  const firstPreview = await manager.describeArtifact({ taskId: first.id });
  assert.equal(await fs.readFile(path.join(firstPreview.rootDirectory, 'index.html'), 'utf8'), 'first website');
  await fs.writeFile(path.join(privateSource, 'content.txt'), 'second website');
  const second = await wait(await manager.startBuild({ projectId: project.id, offline: true }));
  assert.equal(await fs.readFile(path.join(firstPreview.rootDirectory, 'index.html'), 'utf8'), 'first website');
  const reopened = createBuildManager({ dataDirectory: path.join(evidence, 'profile') });
  const restored = await reopened.inspectProject({ projectId: project.id });
  assert.equal(restored.latestTask.id, second.id);
  assert.equal(restored.latestTask.state, 'succeeded');
  assert.equal(restored.latestTask.project, undefined);
  await fs.mkdir(path.join(privateSource, 'node_modules'), { recursive: true });
  await fs.writeFile(path.join(privateSource, 'node_modules/injected.js'), 'changed dependency set');
  const damaged = await manager.inspectProject({ projectId: project.id });
  assert.equal(damaged.prepared, false);
  assert.equal(damaged.preparationReasons[0].code, 'DEPENDENCY_SET_CHANGED');
  await fs.unlink(path.join(privateSource, 'node_modules/injected.js'));
  await fs.writeFile(path.join(privateSource, 'no-output.txt'), 'skip');
  const noOutput = await wait(await manager.startBuild({ projectId: project.id, offline: true }), 'failed');
  assert.equal(noOutput.error.code, 'STATIC_ARTIFACT_REQUIRED');
  await fs.unlink(path.join(privateSource, 'no-output.txt'));
  await fs.writeFile(path.join(privateSource, 'hang.txt'), 'hang');
  const hanging = await manager.startBuild({ projectId: project.id, offline: true });
  await new Promise((resolve) => setTimeout(resolve, 600));
  await manager.cancelTask({ taskId: hanging.id });
  await wait(hanging, 'cancelled');
  await manager.dispose();
  await reopened.dispose();
  assert.equal(await fs.readFile(path.join(source, 'content.txt'), 'utf8'), 'first website');
});

test('raw Next font imports convert locally with licenses before build', async () => {
  const fontSource = path.join(evidence, 'font-fixture');
  await fs.mkdir(path.join(fontSource, 'app'), { recursive: true });
  const original = 'import { Inter } from "next/font/google"; const inter = Inter({ subsets: ["latin"], weight: ["400", "700"] }); export default inter;';
  await fs.writeFile(path.join(fontSource, 'app/layout.tsx'), original);
  const conversions = await prepareLocalNextFonts({ source: fontSource, vendorDirectory: path.join(application, 'apps/build-runtime/vendor') });
  assert.equal(conversions[0].family, 'Inter');
  assert.match(await fs.readFile(path.join(fontSource, 'app/layout.tsx'), 'utf8'), /next\/font\/local/);
  assert.ok((await fs.stat(path.join(fontSource, 'public/sitefoundry-fonts/inter/LICENSE.txt'))).size > 0);
  assert.deepEqual(await prepareLocalNextFonts({ source: fontSource, vendorDirectory: path.join(application, 'apps/build-runtime/vendor') }), []);
});

test('Android process adapter preserves spawned Node bins and async APIs', async () => {
  const binaries = path.join(evidence, 'android-adapter/node_modules/.bin');
  await fs.mkdir(binaries, { recursive: true });
  const binary = path.join(binaries, 'cross-env');
  await fs.writeFile(binary, '#!/usr/bin/env node\nprocess.stdout.write(process.argv[2]);\n');
  const adapter = path.join(application, 'apps/build-runtime/android-process-adapter.cjs');
  const code = `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import { spawnSync, execFile, execFileSync } from 'node:child_process';
    import { promisify } from 'node:util';
    const require = createRequire(import.meta.url);
    require(${JSON.stringify(adapter)}).installAndroidProcessAdapter();
    const binary = ${JSON.stringify(binary)};
    assert.equal(spawnSync(binary, ['spawn'], {encoding:'utf8'}).stdout, 'spawn');
    assert.equal(execFileSync(binary, ['sync'], {encoding:'utf8'}), 'sync');
    const asynchronous = promisify(execFile)(binary, ['async']);
    assert.ok(asynchronous.child);
    assert.equal((await asynchronous).stdout, 'async');
    await new Promise((done, fail) => execFile(binary, ['callback'], (error, stdout) => { if(error)fail(error); else { assert.equal(stdout,'callback'); done(); } }));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  const initialization = path.join(evidence, 'android-adapter/init.sh');
  await createAndroidShellInitialization({ file: initialization, cwd: path.join(evidence, 'android-adapter'), nodeExecutable: process.execPath, npmCli: 'npm-cli.js' });
  assert.match(await fs.readFile(initialization, 'utf8'), /cross-env\(\)/);
});

test.after(async () => {
  await fs.writeFile(path.join(evidence, 'scope.json'), JSON.stringify({ schema: 1, node: process.versions.node, platform: process.platform, evidence, scope: 'Targeted runtime checks; no Android build acceptance is implied', completedAt: new Date().toISOString() }, null, 2));
  console.log('Runtime evidence: ' + evidence);
});
