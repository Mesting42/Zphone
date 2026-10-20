/** Verify the exact Node executable shipped with Windows, using an isolated
 * project copy and a PATH that contains no developer Node installation. */
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidence = resolve(appRoot, '../../coverage/apps-20261013/windows-build');
const executable = join(appRoot, 'build/node-runtime/node.exe');
if (process.argv[2] !== '--worker') {
  await mkdir(evidence, { recursive: true });
  const code = await new Promise((done, fail) => {
    const child = spawn(executable, [fileURLToPath(import.meta.url), '--worker'], {
      cwd: appRoot, windowsHide: true, stdio: 'inherit',
      env: { ...process.env, PATH: dirname(executable) + ';' + join(process.env.SystemRoot || 'C:/Windows', 'System32') }
    });
    child.once('error', fail); child.once('exit', done);
  });
  process.exitCode = code;
} else {
  const { createBuildManager } = await import('../../build-runtime/index.mjs');
  const manager = createBuildManager({
    dataDirectory: join(evidence, 'profile'), nodeExecutable: executable,
    nodeEnv: { PATH: process.env.PATH }, npmCli: resolve(appRoot, '../build-runtime/vendor/npm/bin/npm-cli.js')
  });
  async function waitTask(initial) {
    let task = initial, previous = '';
    const started = Date.now();
    while (!['succeeded', 'failed', 'cancelled', 'interrupted'].includes(task.state)) {
      if (Date.now() - started > 600000) throw new Error('Windows source task exceeded 10 minutes.');
      const status = task.operation + ' ' + task.state + ' ' + (task.logs.at(-1)?.message || '').trim().slice(-160);
      if (status !== previous) { console.log(status); previous = status; }
      await new Promise(done => setTimeout(done, 1000));
      task = await manager.taskStatus({ taskId: task.id });
    }
    if (task.state !== 'succeeded') throw new Error(JSON.stringify(task.error) + '\n' + task.logs.map(item => item.message).join('\n').slice(-8000));
    return task;
  }
  let report = { schema: 'sitefoundry-windows-native-build/v1', startedAt: new Date().toISOString(), node: process.versions.node, nodeExecutable: executable, PATH: process.env.PATH, ok: false };
  try {
    const project = await manager.importProject({ name: 'PixelWire-Next-Windows', sourceDirectory: resolve(appRoot, '../../coverage/offline-fixes-20261013/offline/finished-source-build') });
    report.project = project;
    report.prepare = await waitTask(await manager.prepareProject({ projectId: project.id, online: true }));
    report.build = await waitTask(await manager.startBuild({ projectId: project.id, offline: true }));
    report.artifact = await manager.exportArtifact({ taskId: report.build.id, encoding: 'path' });
    report.preview = await manager.describeArtifact({ taskId: report.build.id });
    report.indexContainsTitle = (await readFile(join(report.preview.rootDirectory, report.preview.entryPath), 'utf8')).includes('PixelWire');
    if (!report.indexContainsTitle) throw new Error('Built index is missing the expected website identity.');
    report.ok = true;
    console.log('Windows bundled Node Next offline build passed: ' + report.build.artifact.files + ' files.');
  } catch (error) { report.error = error.stack; process.exitCode = 1; console.error(error); }
  report.finishedAt = new Date().toISOString();
  await writeFile(join(evidence, 'next-offline-build.json'), JSON.stringify(report, null, 2) + '\n');
}
