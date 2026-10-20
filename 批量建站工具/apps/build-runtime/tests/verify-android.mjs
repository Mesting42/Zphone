import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createBuildManager } from '../index.mjs';
import { extractProjectZip } from '../zip.mjs';

// Android-only diagnostic CLI. Instrumentation can use the same manager methods
// via NativeRuntimeClient instead. Run `prepare` while online, disable networking
// from the host/device controls, then run `offline` in the same app-owned folder.
// This helper never labels its Node guard as a physical airplane-mode check.
const [operation, evidenceDirectory, archivePath] = process.argv.slice(2);
assert.equal(process.platform, 'android', 'This acceptance runner must execute the packaged Android Node runtime');
assert.ok(['prepare', 'offline'].includes(operation) && evidenceDirectory, 'Usage: verify-android.mjs prepare|offline <app-private evidence directory> [fixture ZIP]');
await fs.mkdir(evidenceDirectory, { recursive: true });
const manager = createBuildManager({ dataDirectory: path.join(evidenceDirectory, 'profile') });
const runtime = { node: process.versions.node, arch: process.arch, platform: process.platform, executable: process.execPath, uid: process.getuid?.() };
const prepareFile = path.join(evidenceDirectory, 'prepare.json');
async function wait(task) {
  const deadline = Date.now() + 2700000;
  let latest = '';
  for (;;) {
    task = await manager.taskStatus({ taskId: task.id });
    const progress = task.state + ':' + (task.logs.at(-1)?.message || '').trim().slice(-300);
    if (progress !== latest) { console.log(JSON.stringify({ taskId: task.id, operation: task.operation, progress })); latest = progress; }
    if (['succeeded', 'failed', 'cancelled', 'interrupted'].includes(task.state)) {
      assert.equal(task.state, 'succeeded', JSON.stringify(task.error) + '\n' + task.logs.map((item) => item.message).join('\n').slice(-12000));
      return task;
    }
    assert.ok(Date.now() < deadline, 'Android task exceeded 45 minutes');
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
let report = { schema: 1, runtime, operation, startedAt: new Date().toISOString(), ok: false };
try {
  if (operation === 'prepare') {
    assert.ok(archivePath, 'Preparation requires the raw fixture ZIP');
    const project = await manager.importProject({ name: 'Android raw Next acceptance', archivePath });
    report.project = project;
    report.task = await wait(await manager.prepareProject({ projectId: project.id, online: true }));
    assert.equal(report.task.project.prepared, true);
    assert.ok(report.task.fontConversions.length > 0, 'Raw Google font converted to local asset');
    report.ok = true;
  } else {
    const preparation = JSON.parse(await fs.readFile(prepareFile, 'utf8'));
    assert.equal(preparation.ok, true);
    const project = await manager.inspectProject({ projectId: preparation.project.id });
    assert.equal(project.prepared, true, JSON.stringify(project.preparationReasons));
    report.project = project;
    report.task = await wait(await manager.startBuild({ projectId: project.id, offline: true }));
    report.artifact = await manager.exportArtifact({ taskId: report.task.id, encoding: 'path' });
    report.preview = await manager.describeArtifact({ taskId: report.task.id });
    const reopened = path.join(evidenceDirectory, 'reopened', report.task.id);
    await fs.mkdir(reopened, { recursive: true });
    await extractProjectZip(await fs.readFile(report.artifact.artifactPath), reopened);
    assert.match(await fs.readFile(path.join(reopened, 'index.html'), 'utf8'), /PixelWire Android offline acceptance/);
    assert.ok((await fs.stat(path.join(reopened, 'local-check.svg'))).size > 0);
    report.networkEvidence = 'Node HTTP/TLS/TCP/DNS/UDP/fetch guard enabled; attach host airplane/wifi/data state separately';
    report.ok = true;
  }
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  await manager.dispose();
  report.finishedAt = new Date().toISOString();
  const file = operation === 'prepare' ? prepareFile : path.join(evidenceDirectory, 'offline-' + (report.task?.id || Date.now()) + '.json');
  await fs.writeFile(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ reportPath: file, ok: report.ok, error: report.error }));
}
