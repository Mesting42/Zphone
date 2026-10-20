import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createArtifactZip, extractProjectZip, walkFiles } from './zip.mjs';
import { createAndroidShellInitialization, prepareAndroidCompilers } from './android-adapters.mjs';
import { prepareLocalNextFonts } from './local-fonts.mjs';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const skippedDirectories = new Set(['node_modules', '.next', 'out', 'dist', '.git', '.sitefoundry-build']);
const terminalStates = new Set(['succeeded', 'failed', 'cancelled', 'interrupted']);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const exists = async (file) => { try { await fs.access(file); return true; } catch { return false; } };

function runtimeError(code, message) { const error = new Error(message); error.code = code; return error; }
function requireId(id) {
  if (!/^[a-f\d-]{36}$/i.test(String(id))) throw runtimeError('INVALID_ID', 'Invalid project or task identifier');
  return id;
}
async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = file + '.' + randomUUID() + '.tmp';
  await fs.writeFile(temporary, JSON.stringify(value, null, 2));
  await fs.rename(temporary, file);
}
async function sourceCopy(from, to, depth = 0) {
  await fs.mkdir(to, { recursive: true });
  for (const entry of await fs.readdir(from, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', '.sitefoundry-build'].includes(entry.name) || depth === 0 && skippedDirectories.has(entry.name)) continue;
    const input = path.join(from, entry.name), output = path.join(to, entry.name);
    if (entry.isSymbolicLink()) throw runtimeError('SYMLINK_SOURCE', 'Source projects must not contain symbolic links');
    if (entry.isDirectory()) await sourceCopy(input, output, depth + 1);
    else if (entry.isFile()) await fs.copyFile(input, output);
  }
}
async function findProjectRoot(root, depth = 0) {
  if (await exists(path.join(root, 'package.json'))) return root;
  if (depth > 3) throw runtimeError('PACKAGE_NOT_FOUND', 'ZIP must contain a package.json at its root or within one project folder');
  const directories = (await fs.readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory() && entry.name !== '__MACOSX');
  if (directories.length !== 1) throw runtimeError('PACKAGE_NOT_FOUND', 'Choose a ZIP containing one source project');
  return findProjectRoot(path.join(root, directories[0].name), depth + 1);
}
async function dependencyIdentity(root, runtime) {
  const packageBytes = await fs.readFile(path.join(root, 'package.json'));
  const lockFile = 'package-lock.json';
  if (!await exists(path.join(root, lockFile))) throw runtimeError('LOCK_REQUIRED', 'A package-lock.json is required to prepare repeatable offline dependencies');
  const lockBytes = await fs.readFile(path.join(root, lockFile));
  return { packageHash: digest(packageBytes), lockHash: digest(lockBytes), dependencyHash: digest(Buffer.concat([packageBytes, lockBytes])), platform: runtime.platform, arch: runtime.arch, nodeMajor: Number(runtime.node.split('.')[0]), nodeModulesABI: runtime.modules };
}

// Factory owns all storage and tasks. The bridge owns OS dialogs and tokens; the
// renderer never receives general filesystem access or a shell execution API.
export function createBuildManager({ dataDirectory, nodeExecutable = process.execPath, nodeEnv = {}, npmCli = path.join(moduleDirectory, 'vendor/npm/bin/npm-cli.js'), onEvent = () => {} } = {}) {
  if (!dataDirectory) throw runtimeError('DATA_DIRECTORY_REQUIRED', 'A native application data directory is required');
  const root = path.resolve(dataDirectory, 'source-builds'), projectsRoot = path.join(root, 'projects'), tasksRoot = path.join(root, 'tasks');
  const tasks = new Map(), children = new Map(), pendingLogs = new Map(), cancellationTimers = new Map();
  let runtimePromise;
  const projectFolder = (id) => path.join(projectsRoot, requireId(id));
  const taskFile = (id) => path.join(tasksRoot, requireId(id) + '.json');
  const baseEnv = () => ({ ...process.env, ...nodeEnv, ...(process.platform === 'android' ? { CIRCLE_NODE_TOTAL: '2' } : {}), SITEFOUNDRY_NPM_CLI: npmCli, NEXT_TELEMETRY_DISABLED: '1', NEXT_IGNORE_INCORRECT_LOCKFILE: '1', npm_config_cache: path.join(root, 'npm-cache'), npm_config_audit: 'false', npm_config_fund: 'false', npm_config_engine_strict: 'true', npm_config_update_notifier: 'false' });
  // Electron's embedded Node and the independently packaged build executable can
  // differ. Identify the executable that actually installs/builds dependencies.
  function runtimeIdentity() {
    if (!runtimePromise) runtimePromise = new Promise((resolve, reject) => {
      const child = spawn(nodeExecutable, ['-p', 'JSON.stringify({platform:process.platform,arch:process.arch,node:process.versions.node,modules:process.versions.modules})'], { env: baseEnv(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      let output = '', diagnostics = '';
      const timeout = setTimeout(() => { child.kill(); reject(runtimeError('RUNTIME_PROBE_TIMEOUT', 'Packaged build runtime did not respond')); }, 15000);
      child.stdout.on('data', (chunk) => { output += chunk; });
      child.stderr.on('data', (chunk) => { diagnostics += chunk; });
      child.once('error', (error) => { clearTimeout(timeout); reject(error); });
      child.once('close', (code) => {
        clearTimeout(timeout);
        try {
          if (code !== 0) throw runtimeError('RUNTIME_UNAVAILABLE', 'Packaged build runtime failed: ' + diagnostics.slice(-1000));
          resolve(JSON.parse(output));
        } catch (error) { reject(error); }
      });
    });
    return runtimePromise;
  }
  const snapshot = (task) => JSON.parse(JSON.stringify(task));
  async function saveTask(task) { task.updatedAt = new Date().toISOString(); await writeJson(taskFile(task.id), task); onEvent(snapshot(task)); }
  async function log(task, message, stream = 'info') {
    if (!String(message).trim()) return;
    const item = { timestamp: new Date().toISOString(), stream, message: String(message).slice(0, 16000) };
    task.logs.push(item);
    if (task.logs.length > 400) task.logs.splice(0, task.logs.length - 400);
    // Preserve process output order and drain it before marking a task complete.
    // A close event can otherwise overtake pending asynchronous appendFile calls.
    const pending = (pendingLogs.get(task.id) || Promise.resolve()).then(async () => {
      await fs.appendFile(path.join(tasksRoot, task.id + '.log'), item.timestamp + ' [' + stream + '] ' + item.message + '\n');
      onEvent({ ...snapshot(task), event: 'log', log: item });
    });
    pendingLogs.set(task.id, pending);
    await pending;
  }
  async function runProcess(task, arguments_, cwd, extraEnv = {}) {
    if (task.cancelRequested) throw runtimeError('CANCELLED', 'Task cancelled');
    const environment = { ...baseEnv(), ...extraEnv };
    if (process.platform === 'android') {
      const shell = path.join(path.dirname(nodeExecutable), 'libsitefoundryshell.so');
      if (!await exists(shell)) throw runtimeError('ANDROID_SHELL_MISSING', 'The packaged Android npm shell adapter is missing');
      const initialization = path.join(tasksRoot, task.id + '-shell.sh');
      await createAndroidShellInitialization({ file: initialization, cwd, nodeExecutable, npmCli });
      environment.npm_config_script_shell = shell;
      environment.SITEFOUNDRY_SHELL_INIT = initialization;
      environment.SITEFOUNDRY_ANDROID_SHELL = shell;
      environment.NODE_OPTIONS = [environment.NODE_OPTIONS || '', '--require=' + JSON.stringify(path.join(moduleDirectory, 'android-process-adapter.cjs'))].filter(Boolean).join(' ');
    }
    await log(task, 'Starting ' + arguments_.map((value) => path.basename(value)).join(' '));
    return new Promise((resolve, reject) => {
      const child = spawn(nodeExecutable, arguments_, { cwd, env: environment, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, detached: process.platform !== 'win32' });
      children.set(task.id, child);
      let logFailure;
      const appendOutput = (chunk, stream) => { log(task, chunk.toString(), stream).catch((error) => { logFailure = error; }); };
      child.stdout.on('data', (chunk) => { appendOutput(chunk, 'stdout'); });
      child.stderr.on('data', (chunk) => { appendOutput(chunk, 'stderr'); });
      child.once('error', reject);
      child.once('close', async (code, signal) => {
        children.delete(task.id);
        clearTimeout(cancellationTimers.get(task.id)); cancellationTimers.delete(task.id);
        try { await pendingLogs.get(task.id); } catch (error) { logFailure = error; }
        if (task.cancelRequested) reject(runtimeError('CANCELLED', 'Task cancelled'));
        else if (logFailure) reject(logFailure);
        else if (code !== 0) reject(runtimeError('BUILD_PROCESS_FAILED', 'Process exited with ' + (signal || code)));
        else resolve({ code });
      });
    });
  }
  async function loadProject(id) { return json(path.join(projectFolder(id), 'project.json')); }
  async function inspectProject({ projectId }) {
    const project = await loadProject(projectId), source = path.join(projectFolder(projectId), 'source');
    project.prepared = false; project.preparationReasons = [];
    try {
      const identity = await dependencyIdentity(source, await runtimeIdentity());
      Object.assign(project, { dependencyHash: identity.dependencyHash });
      const manifest = await json(path.join(projectFolder(projectId), 'prepared.json'));
      if (![1, 2].includes(manifest.schema) || !Array.isArray(manifest.files)) throw runtimeError('MANIFEST_INVALID', 'Prepared dependency manifest is invalid; prepare again');
      if (Object.keys(identity).some((key) => identity[key] !== manifest.identity[key])) throw runtimeError('DEPENDENCIES_CHANGED', 'Project dependencies or device runtime changed; prepare again');
      const actualFiles = await preparedFilePaths(source);
      const recordedFiles = manifest.files.map((entry) => entry.path);
      const actualPaths = new Set(actualFiles);
      if (recordedFiles.length !== actualPaths.size || recordedFiles.some((file) => !actualPaths.has(file))) throw runtimeError('DEPENDENCY_SET_CHANGED', 'Installed dependency files were added or removed; prepare again');
      // Check actual bytes, not just an npm cache directory or a previous success.
      for (const entry of manifest.files) {
        const actual = await fs.readFile(path.join(source, entry.path));
        if (actual.length !== entry.bytes || digest(actual) !== entry.sha256) throw runtimeError('DEPENDENCY_DAMAGED', 'Prepared dependency is missing or changed: ' + entry.path);
      }
      project.prepared = true; project.preparedAt = manifest.preparedAt;
    } catch (error) { project.preparationReasons.push({ code: error.code || 'NOT_PREPARED', message: error.message }); }
    // Existing project/list bridges can restore task state after navigation or
    // application restart without exposing a general task-file browsing API.
    try {
      const savedTasks = await fs.readdir(tasksRoot);
      let latest;
      for (const file of savedTasks.filter((name) => /^[a-f\d-]{36}\.json$/i.test(name))) {
        const task = await taskStatus({ taskId: file.slice(0, -5) });
        if (task.projectId === projectId && (!latest || task.createdAt > latest.createdAt)) latest = task;
      }
      if (latest) {
        // The preparation task itself contains a project snapshot. Omitting it
        // prevents recursively nesting project.latestTask.project on each read.
        const { project: _projectSnapshot, ...summary } = latest;
        project.latestTask = summary;
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return project;
  }
  async function listProjects() {
    await fs.mkdir(projectsRoot, { recursive: true });
    const result = [];
    for (const entry of await fs.readdir(projectsRoot, { withFileTypes: true })) {
      if (entry.isDirectory() && /^[a-f\d-]{36}$/i.test(entry.name)) {
        try { result.push(await inspectProject({ projectId: entry.name })); } catch { /* Ignore incomplete interrupted imports, never report them ready. */ }
      }
    }
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async function importProject({ name, archivePath, archiveBase64, sourceDirectory } = {}) {
    const id = randomUUID(), folder = projectFolder(id), stage = path.join(folder, 'import');
    await fs.mkdir(stage, { recursive: true });
    try {
      if (sourceDirectory) await sourceCopy(sourceDirectory, stage);
      else {
        const bytes = archivePath ? await fs.readFile(archivePath) : Buffer.from(archiveBase64 || '', 'base64');
        if (bytes.length > 536870912) throw runtimeError('ARCHIVE_TOO_LARGE', 'Source ZIP exceeds the 512 MiB import limit');
        await extractProjectZip(bytes, stage);
      }
      const located = await findProjectRoot(stage), source = path.join(folder, 'source');
      await fs.rename(located, source);
      const packageJson = await json(path.join(source, 'package.json'));
      if (!packageJson.scripts?.build) throw runtimeError('BUILD_SCRIPT_REQUIRED', 'Source package.json must provide a build script');
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      const framework = deps.next ? 'next' : deps.vite ? 'vite' : 'npm';
      const project = { id, projectId: id, name: String(name || packageJson.name || 'Imported source').slice(0, 100), framework, createdAt: new Date().toISOString(), prepared: false };
      await writeJson(path.join(folder, 'project.json'), project);
      return inspectProject({ projectId: id });
    } catch (error) { throw error; }
  }
  async function newTask(projectId, operation, action) {
    await loadProject(projectId);
    await fs.mkdir(tasksRoot, { recursive: true });
    if ([...tasks.values()].some((task) => !terminalStates.has(task.state))) throw runtimeError('BUILD_BUSY', 'Wait for or cancel the current task');
    const id = randomUUID(), task = { id, taskId: id, projectId, operation, state: 'queued', logs: [], createdAt: new Date().toISOString() };
    tasks.set(id, task); await saveTask(task);
    setImmediate(async () => {
      task.state = 'running'; await saveTask(task);
      try { await action(task); task.state = task.cancelRequested ? 'cancelled' : 'succeeded'; }
      catch (error) { task.state = error.code === 'CANCELLED' ? 'cancelled' : 'failed'; task.error = { code: error.code || 'TASK_FAILED', message: error.message }; await log(task, error.message, 'error'); }
      await saveTask(task);
    });
    return snapshot(task);
  }
  async function prepareProject({ projectId, online = false } = {}) {
    if (!online) throw runtimeError('ONLINE_PREPARATION_REQUIRED', 'First preparation requires a network connection; offline builds use the prepared project');
    if (!await exists(npmCli)) throw runtimeError('NPM_RUNTIME_MISSING', 'The packaged npm runtime is missing');
    return newTask(projectId, 'prepare', async (task) => {
      const project = await loadProject(projectId), folder = projectFolder(projectId), source = path.join(folder, 'source');
      const identity = await dependencyIdentity(source, await runtimeIdentity());
      await fs.rm(path.join(folder, 'prepared.json'), { force: true });
      if (project.framework === 'next') {
        task.fontConversions = await prepareLocalNextFonts({ source, vendorDirectory: path.join(moduleDirectory, 'vendor') });
        if (task.fontConversions.length) await log(task, 'Prepared local fonts: ' + task.fontConversions.map((item) => item.family).join(', '));
      }
      const android = process.platform === 'android';
      await runProcess(task, [npmCli, 'ci', '--no-audit', '--no-fund', ...(android ? ['--ignore-scripts'] : [])], source);
      if (android) {
        task.compilerAdapters = await prepareAndroidCompilers({ source, tools: path.join(folder, 'android-compiler'), npmCli, run: (args) => runProcess(task, args, source) });
      }
      if (project.framework === 'next') {
        const version = (await json(path.join(source, 'node_modules/next/package.json'))).version;
        const tools = path.join(folder, 'compiler');
        await fs.mkdir(tools, { recursive: true });
        await writeJson(path.join(tools, 'package.json'), { private: true, name: 'sitefoundry-project-compiler', version: '1.0.0' });
        // Download the exact compiler package while online, then copy only the
        // platform-independent WASM package beside this project's Next package.
        await runProcess(task, [npmCli, 'install', '--prefix', tools, '--ignore-scripts', '--no-audit', '--no-fund', '--save-exact', '@next/swc-wasm-nodejs@' + version], source);
        const compiler = path.join(source, 'node_modules/@next/swc-wasm-nodejs');
        await fs.mkdir(path.dirname(compiler), { recursive: true });
        await fs.cp(path.join(tools, 'node_modules/@next/swc-wasm-nodejs'), compiler, { recursive: true });
      }
      if (android) {
        // All compilers, including Next SWC, must exist before lifecycle hooks.
        // npm rebuild executes real installed hooks rather than silently dropping
        // custom install work through a permanent ignore-scripts flag.
        await runProcess(task, [npmCli, 'rebuild', '--no-audit', '--no-fund'], source);
        for (const hook of ['preinstall', 'install', 'postinstall', 'prepare']) await runProcess(task, [npmCli, 'run', hook, '--if-present'], source);
      }
      const files = [];
      for (const file of await preparedFilePaths(source)) {
        const bytes = await fs.readFile(path.join(source, file));
        files.push({ path: file, bytes: bytes.length, sha256: digest(bytes) });
      }
      await writeJson(path.join(folder, 'prepared.json'), { schema: 2, identity, preparedAt: new Date().toISOString(), files });
      task.project = await inspectProject({ projectId });
      if (!task.project.prepared) throw runtimeError('PREPARATION_CHECK_FAILED', 'Dependency integrity check did not pass');
      await log(task, 'Prepared ' + files.length + ' dependency files for ' + process.platform + '/' + process.arch);
    });
  }
  async function startBuild({ projectId, offline = true } = {}) {
    const project = await inspectProject({ projectId });
    if (!project.prepared) throw runtimeError('PROJECT_NOT_PREPARED', project.preparationReasons[0]?.message || 'Prepare this project before building offline');
    return newTask(projectId, 'build', async (task) => {
      const source = path.join(projectFolder(projectId), 'source');
      const guard = path.join(moduleDirectory, 'network-guard.cjs');
      const options = [nodeEnv.NODE_OPTIONS || '', offline ? '--require=' + JSON.stringify(guard) : ''].filter(Boolean).join(' ');
      const candidates = project.framework === 'next' ? ['out'] : ['dist', 'build', 'out'];
      // These are owned imported copies. Remove previous generated output so a
      // successful no-op script cannot export an older website as a new build.
      for (const candidate of candidates) await fs.rm(path.join(source, candidate), { recursive: true, force: true });
      // Use webpack/SWC WASM for current static Next projects. Unsupported future
      // compiler APIs produce an explicit failure; they never become source-only
      // successful artifacts. The original project configuration is kept intact.
      await runProcess(task, [path.join(moduleDirectory, 'build-entry.cjs'), source, project.framework], source, { NODE_OPTIONS: options, NEXT_TEST_WASM: '1', NEXT_TEST_WASM_DIR: project.framework === 'next' ? path.join(source, 'node_modules/@next/swc-wasm-nodejs') : '' });
      let output;
      for (const candidate of candidates) if (await exists(path.join(source, candidate, 'index.html'))) { output = path.join(source, candidate); break; }
      if (!output) throw runtimeError('STATIC_ARTIFACT_REQUIRED', 'Build succeeded but no static deployable output exists. Configure this project for static export');
      const artifact = path.join(tasksRoot, task.id + '.zip');
      task.artifact = await createArtifactZip(output, artifact);
      // Preview an immutable per-task output, matching that task's exported ZIP.
      // A later build may replace source/out while an earlier preview is open.
      const previewRoot = path.join(tasksRoot, task.id + '-output');
      await fs.cp(output, previewRoot, { recursive: true });
      task.artifactPath = artifact; task.artifactRoot = previewRoot; task.artifactName = project.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 80) + '-built.zip';
      task.offline = offline;
      await log(task, 'Created deployable ZIP: ' + task.artifact.files + ' files');
    });
  }
  async function taskStatus({ taskId }) {
    const task = tasks.get(requireId(taskId));
    if (task) return snapshot(task);
    const saved = await json(taskFile(taskId));
    if (!terminalStates.has(saved.state)) { saved.state = 'interrupted'; saved.error = { code: 'APP_RESTARTED', message: 'Application restarted during this task; start it again' }; }
    return saved;
  }
  async function cancelTask({ taskId }) {
    const task = tasks.get(requireId(taskId));
    if (!task) return taskStatus({ taskId });
    if (terminalStates.has(task.state)) return snapshot(task);
    task.cancelRequested = true;
    const child = children.get(taskId);
    if (child?.pid) {
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else {
        try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
        // A child that ignores SIGTERM must not leave the workbench permanently
        // busy after Cancel. Target this task's process group only.
        const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }, 5000);
        timer.unref(); cancellationTimers.set(taskId, timer);
      }
    }
    await saveTask(task); return snapshot(task);
  }
  async function exportArtifact({ taskId, encoding = 'base64' }) {
    const task = await taskStatus({ taskId });
    if (task.state !== 'succeeded' || !task.artifactPath) throw runtimeError('ARTIFACT_NOT_READY', 'No successful built artifact is available');
    const result = { name: task.artifactName, mimeType: 'application/zip', artifactPath: task.artifactPath, bytes: (await fs.stat(task.artifactPath)).size };
    if (encoding !== 'path') result.base64 = (await fs.readFile(task.artifactPath)).toString('base64');
    return result;
  }
  async function describeArtifact({ taskId }) {
    const task = await taskStatus({ taskId });
    if (task.state !== 'succeeded' || !task.artifactRoot) throw runtimeError('ARTIFACT_NOT_READY', 'No successful built artifact is available');
    return { name: task.artifactName, rootDirectory: task.artifactRoot, entryPath: 'index.html' };
  }
  async function dispose() {
    const active = [...tasks.values()].filter((task) => !terminalStates.has(task.state));
    for (const task of active) await cancelTask({ taskId: task.id });
    // Native teardown waits briefly for process-tree termination and persistence.
    // It does not kill unrelated Node processes or discard project/dependency data.
    const deadline = Date.now() + 10000;
    while (active.some((task) => !terminalStates.has(task.state)) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
    for (const task of active) {
      if (!terminalStates.has(task.state)) {
        const child = children.get(task.id);
        if (child?.pid && process.platform !== 'win32') { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }
        task.state = 'interrupted'; task.error = { code: 'APPLICATION_CLOSED', message: 'Application closed during this task; start it again' };
        await saveTask(task);
      }
    }
  }
  return { importProject, listProjects, inspectProject, prepareProject, startBuild, taskStatus, cancelTask, exportArtifact, describeArtifact, dispose };
}

async function preparedFilePaths(source) {
  const dependencyRoot = path.join(source, 'node_modules');
  const files = await exists(dependencyRoot) ? (await walkDependencyFiles(dependencyRoot)).map((file) => path.posix.join('node_modules', file)) : [];
  for (const directory of ['.sitefoundry-fonts', 'public/sitefoundry-fonts']) {
    if (await exists(path.join(source, directory))) for (const file of await walkFiles(path.join(source, directory))) files.push(path.posix.join(directory, file));
  }
  return files;
}

// Include npm's generated command wrappers and followed in-project symlinks in
// the byte manifest too. Readiness must not overlook a changed build executable.
async function walkDependencyFiles(root, relative = '') {
  const result = [];
  for (const entry of (await fs.readdir(path.join(root, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.posix.join(relative.replaceAll('\\', '/'), entry.name);
    if (entry.isDirectory()) result.push(...await walkDependencyFiles(root, file));
    else if (entry.isFile()) result.push(file);
    else if (entry.isSymbolicLink()) {
      const resolved = await fs.realpath(path.join(root, file));
      if (!resolved.startsWith(path.resolve(root) + path.sep)) throw runtimeError('DEPENDENCY_LINK_OUTSIDE_PROJECT', 'Installed dependency points outside this project: ' + file);
      if ((await fs.stat(resolved)).isFile()) result.push(file);
      else throw runtimeError('DEPENDENCY_DIRECTORY_LINK_UNSUPPORTED', 'Linked workspace dependency must be bundled into the source ZIP: ' + file);
    }
  }
  return result;
}

