import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createBuildManager } from './index.mjs';
import { createArtifactZip, extractProjectZip, safeArchivePath } from './zip.mjs';

// Explicit targeted acceptance runner. Source is copied by the manager; existing
// project/evidence inputs are never changed. Run with a fresh evidence directory.
const [sourceDirectory, evidenceDirectory, existingProjectId] = process.argv.slice(2);
if (!sourceDirectory || !evidenceDirectory) throw new Error('Usage: verify-runtime.mjs <source fixture> <new evidence directory>');
await fs.mkdir(evidenceDirectory, { recursive: true });
const traceFile = path.join(evidenceDirectory, 'events.jsonl');
const manager = createBuildManager({ dataDirectory: evidenceDirectory, onEvent: (event) => {
  void fs.appendFile(traceFile, JSON.stringify(event) + '\n');
}});
assert.throws(() => safeArchivePath('../escape'), /parent-directory/);
assert.throws(() => safeArchivePath('C:\\escape'), /Invalid archive/);
const project = existingProjectId ? await manager.inspectProject({ projectId: existingProjectId }) : await manager.importProject({ name: 'PixelWire offline source', sourceDirectory });
if (!existingProjectId) assert.equal(project.prepared, false);
const waitTask = async (task) => {
  for (;;) {
    const state = await manager.taskStatus({ taskId: task.id });
    if (['succeeded', 'failed', 'cancelled', 'interrupted'].includes(state.state)) {
      if (state.state !== 'succeeded') throw new Error(JSON.stringify(state));
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
};
const prepared = existingProjectId && project.prepared ? { project, id: 'previous-online-preparation' } : await waitTask(await manager.prepareProject({ projectId: project.id, online: true }));
assert.equal(prepared.project.prepared, true);
const built = await waitTask(await manager.startBuild({ projectId: project.id, offline: true }));
const artifact = await manager.exportArtifact({ taskId: built.id, encoding: 'path' });
const reopened = path.join(evidenceDirectory, 'reopened', built.id);
await fs.mkdir(reopened, { recursive: true });
await extractProjectZip(await fs.readFile(artifact.artifactPath), reopened);
assert.match(await fs.readFile(path.join(reopened, 'index.html'), 'utf8'), /PixelWire/);
assert.ok((await fs.stat(artifact.artifactPath)).size > 0);

// Readiness must be revoked by a missing/modified dependency, not retained by a
// stale prepared flag. Alter only this copied test project and restore its bytes.
const dependency = path.join(evidenceDirectory, 'source-builds/projects', project.id, 'source/node_modules/next/package.json');
const original = await fs.readFile(dependency);
await fs.writeFile(dependency, Buffer.concat([original, Buffer.from('\n')]));
const damaged = await manager.inspectProject({ projectId: project.id });
assert.equal(damaged.prepared, false);
assert.equal(damaged.preparationReasons[0].code, 'DEPENDENCY_DAMAGED');
await fs.writeFile(dependency, original);
const summary = { schema: 2, runtime: { node: process.versions.node, platform: process.platform, arch: process.arch }, project: { ...project, prepared: prepared.project.prepared, preparedAt: prepared.project.preparedAt, preparationReasons: prepared.project.preparationReasons }, preparedTask: prepared.id, fontConversions: prepared.fontConversions || [], buildTask: built.id, offline: built.offline, artifact: { ...artifact, files: built.artifact.files }, checks: { pathTraversalRejected: true, actualNextBuild: true, staticArtifactReopened: true, damagedDependencyRejected: true }, completedAt: new Date().toISOString() };
await fs.writeFile(path.join(evidenceDirectory, existingProjectId ? 'result-' + built.id + '.json' : 'result.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
