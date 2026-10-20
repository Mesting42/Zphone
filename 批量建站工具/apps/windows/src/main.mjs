/** Windows application entry. Chromium renders the existing workbench, while
 * privileged operations remain here and only accept the trusted main frame. */
import { app, BrowserWindow, dialog, ipcMain, Menu, protocol, session } from 'electron';
import { access, appendFile, mkdir, open, readFile, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { safeFileName, decodeExportBytes, writeExportAtomic } from './native-files.mjs';
import { createOfflineServer } from '../build/offline-server.mjs';
import { prepareTemplate } from '../build/ad-template-analysis.mjs';
import { migrateLegacyTemplates } from './template-migration.mjs';
import { WORKBENCH_CONTENT_SECURITY_POLICY } from './content-security-policy.mjs';

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const applicationRoot = resolve(sourceDirectory, '..');
const workbenchVersion = JSON.parse(await readFile(join(applicationRoot, 'package.json'), 'utf8')).sitefoundryVersion || app.getVersion();
const resources = app.isPackaged ? process.resourcesPath : join(applicationRoot, 'build');
const workbenchRoot = app.isPackaged ? join(resources, 'workbench') : join(resources, 'workbench');
const runtimeRoot = app.isPackaged ? join(resources, 'source-runtime') : join(resources, 'source-runtime');
const nodeRoot = join(resources, 'node-runtime');
const APP_ORIGIN = 'sitefoundry://app';
const trustedPaths = new Set(['/', '/index.html', '/game-builder/', '/game-builder/index.html']);
const pendingExports = new Map();
const selectedDirectories = new Map();
const importFileTokens = new Map();
const previewWindows = new Set();
const offlineRequests = [];
const smokeReportPath = process.env.SITEFOUNDRY_SMOKE_REPORT;
// External Electron regression controls the real packaged app through CDP.
// Its opt-in profile bypasses the user's live installation/storage and does
// not run the built-in smoke sequence or change any generator behavior.
const regressionProfile = process.env.SITEFOUNDRY_REGRESSION_PROFILE;
const automationMode = Boolean(smokeReportPath || regressionProfile);
let mainWindow;
let localServer;
let localOrigin;
let buildManager;
let runtimeError;
let shutdownComplete = false;
let shutdownPromise;
let templateMigration;

app.setName('SiteFoundry');
app.setAppUserModelId('com.sitefoundry.workbench');
app.setPath('userData', join(app.getPath('appData'), 'SiteFoundry'));
// Tests use an isolated profile; ordinary installs always retain the same appData
// directory, including templates, browser storage and prepared build projects.
if (smokeReportPath && process.env.SITEFOUNDRY_SMOKE_DATA_DIR) app.setPath('userData', resolve(process.env.SITEFOUNDRY_SMOKE_DATA_DIR));
if (regressionProfile) app.setPath('userData', resolve(regressionProfile));
if (automationMode) app.disableHardwareAcceleration();
protocol.registerSchemesAsPrivileged([{ scheme: 'sitefoundry', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true,
  stream: true, codeCache: true
} }, { scheme: 'sitefoundry-preview', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true
} }]);

async function openArtifactPreview(payload) {
  if (!buildManager || typeof buildManager.describeArtifact !== 'function') throw new Error('本机构建预览尚未准备完成。');
  const artifact = await buildManager.describeArtifact({ taskId: payload?.taskId });
  const root = await realpath(artifact.rootDirectory);
  const nonce = randomUUID();
  const partition = 'sitefoundry-preview-' + nonce;
  const previewSession = session.fromPartition(partition);
  if (smokeReportPath) previewSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, respond) => respond({ cancel: true }));
  const origin = 'sitefoundry-preview://' + nonce;
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };
  previewSession.protocol.handle('sitefoundry-preview', async request => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== nonce || !['GET', 'HEAD'].includes(request.method)) return new Response('Read-only preview.', { status: 403 });
      let target = resolve(root, '.' + decodeURIComponent(url.pathname));
      if (target !== root && !target.startsWith(root + sep)) return new Response('Invalid path.', { status: 403 });
      const info = await stat(target);
      if (info.isDirectory()) target = join(target, 'index.html');
      target = await realpath(target);
      if (!target.startsWith(root + sep)) return new Response('Invalid path.', { status: 403 });
      const bytes = await readFile(target);
      return new Response(request.method === 'HEAD' ? null : bytes, { headers: {
        'Content-Type': mime[extname(target)] || 'application/octet-stream',
        'Content-Length': String(bytes.length), 'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:; style-src 'self' 'unsafe-inline' https:; object-src 'none'; base-uri 'self'"
      } });
    } catch (error) { return new Response(error.code === 'ENOENT' ? 'Not found.' : 'Preview unavailable.', { status: error.code === 'ENOENT' ? 404 : 500 }); }
  });
  const preview = new BrowserWindow({
    width: 1280, height: 900, title: artifact.name + ' — SiteFoundry 预览',
    icon: join(workbenchRoot, 'assets/sitefoundry.ico'), show: !automationMode,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true,
      webSecurity: true, nodeIntegrationInSubFrames: false, partition, offscreen: automationMode }
  });
  previewWindows.add(preview);
  previewSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  previewSession.setPermissionCheckHandler(() => false);
  preview.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  preview.webContents.on('will-navigate', (event, url) => {
    try { const value = new URL(url); if (value.protocol !== 'sitefoundry-preview:' || value.hostname !== nonce) event.preventDefault(); }
    catch { event.preventDefault(); }
  });
  preview.webContents.on('will-attach-webview', event => event.preventDefault());
  preview.on('closed', () => { previewWindows.delete(preview); previewSession.protocol.unhandle('sitefoundry-preview'); });
  await preview.loadURL(origin + '/' + (artifact.entryPath || 'index.html').replace(/^\/+/, ''));
  return { opened: true, name: artifact.name };
}

function isTrustedDocument(url) {
  try { const parsed = new URL(url); return parsed.protocol === 'sitefoundry:' && parsed.hostname === 'app' && trustedPaths.has(parsed.pathname); }
  catch { return false; }
}

function assertTrustedSender(event) {
  // senderFrame===mainFrame is necessary: an opaque srcdoc/blob preview must
  // never invoke a native operation even if it reuses a workbench URL.
  if (!mainWindow || event.sender !== mainWindow.webContents
    || event.senderFrame !== mainWindow.webContents.mainFrame
    || !isTrustedDocument(event.senderFrame.url)) throw new Error('此页面不能调用本机文件或构建功能。');
}

async function templateRequest(path = '', method = 'GET', body) {
  const response = await fetch(localOrigin + '/__sitefoundry/ad-templates' + path, {
    method, headers: { 'Content-Type': 'application/json', Origin: localOrigin },
    body: body ? JSON.stringify(body) : undefined
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || '模板请求失败。');
  return value;
}

async function loadBuildManager() {
  try {
    const entry = join(runtimeRoot, 'index.mjs');
    await access(entry);
    const nodeExecutable = join(nodeRoot, 'node.exe');
    await access(nodeExecutable);
    const { createBuildManager } = await import(pathToFileURL(entry).href);
    buildManager = await createBuildManager({
      dataDirectory: app.getPath('userData'), nodeExecutable,
      nodeEnv: { PATH: nodeRoot + ';' + (process.env.PATH || process.env.Path || '') },
      npmCli: join(runtimeRoot, 'vendor/npm/bin/npm-cli.js')
    });
  } catch (error) { runtimeError = error.message; }
}

async function platformInfo() {
  return {
    platform: 'windows', appVersion: workbenchVersion,
    minimumOS: 'Windows 10 x64', runtime: { electron: process.versions.electron, node: process.versions.node },
    dataDirectory: app.getPath('userData'),
    capabilities: {
      nativeFiles: true, nativeSave: true, chunkedSave: true,
      nativeDirectory: true, persistentTemplates: true,
      offline: true, offlineBuild: !!buildManager, localBuild: !!buildManager
    }, runtimeError: runtimeError || null, templateMigration
  };
}

async function chooseSavePath(name) {
  if (automationMode && process.env.SITEFOUNDRY_SMOKE_EXPORT_DIR) {
    const directory = resolve(process.env.SITEFOUNDRY_SMOKE_EXPORT_DIR);
    await mkdir(directory, { recursive: true });
    return join(directory, safeFileName(name));
  }
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存 SiteFoundry 导出文件', defaultPath: safeFileName(name),
    properties: ['createDirectory', 'showOverwriteConfirmation'],
    filters: name.endsWith('.zip') ? [{ name: 'ZIP 压缩包', extensions: ['zip'] }] : undefined
  });
  return result.canceled ? null : result.filePath;
}

/** Await cancellation/persistence before Chromium exits. Only the manager's own
 * process trees and this session's incomplete export files are touched. */
async function shutdownApplication() {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    if (typeof buildManager?.dispose === 'function') await buildManager.dispose();
    await Promise.allSettled([...pendingExports.values()].map(entry => rm(entry.temporary, { force: true })));
    pendingExports.clear();
    localServer?.close();
    shutdownComplete = true;
  })();
  return shutdownPromise;
}

async function startFile(payload = {}) {
  let filePath;
  if (payload.directoryToken) {
    const directory = selectedDirectories.get(payload.directoryToken);
    if (!directory) throw new Error('导出目录授权已失效，请重新选择目录。');
    const path = String(payload.relativePath || payload.name || '');
    const segments = path.replaceAll('\\', '/').split('/');
    if (!path || /^(?:[a-z]:|[/\\])/i.test(path) || segments.some(segment =>
      !segment || segment === '.' || segment === '..' || /[<>:"|?*\u0000-\u001f]/.test(segment)
      || /[. ]$/.test(segment) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(segment))) throw new Error('导出文件的相对路径无效。');
    filePath = resolve(directory, ...segments);
    if (!filePath.startsWith(directory + sep)) throw new Error('导出文件超出已选择的目录。');
    // Verify each existing ancestor before creating missing subdirectories, so
    // an existing symlink/junction cannot redirect writes outside authorization.
    let ancestor = directory;
    for (const segment of segments.slice(0, -1)) {
      ancestor = join(ancestor, segment);
      try {
        const actual = await realpath(ancestor);
        if (actual !== directory && !actual.startsWith(directory + sep)) throw new Error('导出目录包含指向外部目录的链接。');
      } catch (error) { if (error.code === 'ENOENT') await mkdir(ancestor); else throw error; }
    }
  } else filePath = await chooseSavePath(safeFileName(payload.name));
  if (!filePath) return { cancelled: true };
  const id = randomUUID();
  const temporary = filePath + '.sitefoundry-' + id + '.tmp';
  await writeFile(temporary, Buffer.alloc(0));
  pendingExports.set(id, { filePath, temporary, size: 0, expectedSize: Number(payload.size) || null });
  return { id, transferId: id, cancelled: false };
}

async function appendFileChunk(payload) {
  const entry = pendingExports.get(payload?.id || payload?.transferId);
  if (!entry) throw new Error('导出任务不存在或已结束。');
  const bytes = decodeExportBytes(payload);
  if (bytes.length > 4 * 1024 * 1024) throw new Error('导出分块不能超过 4 MB。');
  if (entry.size + bytes.length > 1024 * 1024 * 1024) throw new Error('单个导出文件不能超过 1 GB。');
  await appendFile(entry.temporary, bytes);
  entry.size += bytes.length;
  return { id: payload.id || payload.transferId, size: entry.size };
}

async function finishFile(payload) {
  const id = payload?.id || payload?.transferId;
  const entry = pendingExports.get(id);
  if (!entry) throw new Error('导出任务不存在或已结束。');
  if (entry.expectedSize !== null && entry.expectedSize !== entry.size) throw new Error('导出文件不完整，请重新导出。');
  await rename(entry.temporary, entry.filePath);
  pendingExports.delete(id);
  return { cancelled: false, name: safeFileName(entry.filePath), path: entry.filePath, size: entry.size };
}

async function invokeOperation(operation, payload) {
  if (operation === 'capabilities' || operation === 'getPlatformInfo') return platformInfo();
  if (operation === 'saveFile') {
    const bytes = decodeExportBytes(payload);
    const path = await chooseSavePath(safeFileName(payload.name));
    return path ? writeExportAtomic(path, bytes) : { cancelled: true };
  }
  if (operation === 'startFile') return startFile(payload);
  if (operation === 'appendFile') return appendFileChunk(payload);
  if (operation === 'finishFile') return finishFile(payload);
  if (operation === 'cancelFile') {
    const id = payload?.id || payload?.transferId;
    const entry = pendingExports.get(id);
    if (entry) { pendingExports.delete(id); await rm(entry.temporary, { force: true }); }
    return { cancelled: true };
  }
  if (operation === 'selectDirectory') {
    const result = automationMode && process.env.SITEFOUNDRY_SMOKE_EXPORT_DIR
      ? { canceled: false, filePaths: [resolve(process.env.SITEFOUNDRY_SMOKE_EXPORT_DIR)] }
      : await dialog.showOpenDialog(mainWindow, { title: '选择项目导出目录', properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled) return { cancelled: true };
    const token = randomUUID(); selectedDirectories.set(token, await realpath(result.filePaths[0]));
    return { cancelled: false, token, name: safeFileName(result.filePaths[0]) };
  }
  if (operation === 'selectImportDirectory') {
    const result = automationMode && process.env.SITEFOUNDRY_SMOKE_IMPORT_DIR
      ? { canceled: false, filePaths: [resolve(process.env.SITEFOUNDRY_SMOKE_IMPORT_DIR)] }
      : await dialog.showOpenDialog(mainWindow, { title: '选择网站或批量网站目录', properties: ['openDirectory'] });
    if (result.canceled) return { cancelled: true, files: [] };
    const root = await realpath(result.filePaths[0]);
    const files = [];
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.zip': 'application/zip' };
    async function collect(directory, path = '') {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue;
        const child = join(directory, entry.name);
        const relativePath = path ? path + '/' + entry.name : entry.name;
        if (entry.isDirectory()) await collect(child, relativePath);
        else if (entry.isFile()) {
          if (files.length >= 100000) throw new Error('目录文件超过 100,000 个，请选择更小的网站目录。');
          const info = await stat(child);
          const uri = 'sitefoundry-file:' + randomUUID();
          importFileTokens.set(uri, { path: child, root });
          files.push({ name: entry.name, path: relativePath, uri, size: info.size, type: types[extname(child)] || 'application/octet-stream', lastModified: info.mtimeMs });
        }
      }
    }
    await collect(root);
    return { cancelled: false, name: safeFileName(root), files };
  }
  if (operation === 'readImportFile') {
    const granted = importFileTokens.get(payload?.uri);
    if (!granted) throw new Error('文件授权已失效，请重新选择目录。');
    const path = await realpath(granted.path);
    if (!path.startsWith(granted.root + sep)) throw new Error('导入文件超出已选择的目录。');
    const offset = Number(payload.offset || 0), length = Number(payload.length || 524288);
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length < 1 || length > 524288) throw new Error('文件分块参数无效。');
    const handle = await open(path, 'r');
    try {
      const info = await handle.stat();
      const bytes = Buffer.alloc(Math.min(length, Math.max(0, info.size - offset)));
      const read = await handle.read(bytes, 0, bytes.length, offset);
      return { dataBase64: bytes.subarray(0, read.bytesRead).toString('base64'), eof: offset + read.bytesRead >= info.size, size: info.size };
    } finally { await handle.close(); }
  }
  if (operation === 'importFiles') {
    const extensions = Array.isArray(payload?.extensions) ? payload.extensions.filter(value => /^[a-z0-9]{1,12}$/i.test(value)) : [];
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择导入文件', properties: payload?.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: extensions.length ? [{ name: '支持的文件', extensions }] : undefined
    });
    if (result.canceled) return { cancelled: true, files: [] };
    const files = [];
    for (const path of result.filePaths) {
      const info = await stat(path);
      if (info.size > 1024 * 1024 * 1024) throw new Error('单个导入文件不能超过 1 GB。');
      files.push({ name: safeFileName(path), size: info.size, base64: (await readFile(path)).toString('base64') });
    }
    return { cancelled: false, files };
  }
  if (operation === 'templates.list') return templateRequest();
  if (operation === 'templates.read') {
    const catalog = await templateRequest();
    return catalog.templates.find(template => template.version === payload?.version) || null;
  }
  if (operation === 'templates.analyze') return templateRequest('/analyze', 'POST', payload);
  if (operation === 'templates.write') return templateRequest('/save', 'POST', payload);
  if (operation === 'templates.default') return templateRequest('/default', 'POST', payload);
  if (operation === 'templates.delete') throw new Error('广告模板删除尚未开放，请保留历史版本。');
  const buildOperations = new Set(['importProject', 'listProjects', 'inspectProject', 'prepareProject', 'startBuild', 'taskStatus', 'cancelTask', 'exportArtifact']);
  if (operation === 'previewArtifact' || operation === 'openBuildPreview') return openArtifactPreview(payload);
  const aliases = { buildProject: 'startBuild', buildStatus: 'taskStatus', cancelBuild: 'cancelTask' };
  const buildOperation = aliases[operation] || operation;
  if (buildOperations.has(buildOperation)) {
    if (!buildManager) throw new Error('本机构建运行时未准备完成：' + (runtimeError || '请更新应用。'));
    // Arbitrary filesystem paths must never arrive from the renderer. The
    // build manager owns its project directories and receives archive bytes.
    if (payload?.sourceDirectory || payload?.archivePath) throw new Error('请选择源码 ZIP 文件，不能直接访问本机路径。');
    if (buildOperation === 'importProject' && payload?.pick) {
      const result = automationMode && process.env.SITEFOUNDRY_SMOKE_SOURCE_ZIP
        ? { canceled: false, filePaths: [resolve(process.env.SITEFOUNDRY_SMOKE_SOURCE_ZIP)] }
        : await dialog.showOpenDialog(mainWindow, {
        title: '导入 React / Next 源码 ZIP', properties: ['openFile'],
        filters: [{ name: '源码 ZIP 压缩包', extensions: ['zip'] }]
      });
      if (result.canceled) return { cancelled: true };
      return buildManager.importProject({ name: safeFileName(result.filePaths[0]), archivePath: result.filePaths[0] });
    }
    if (buildOperation === 'exportArtifact') {
      const artifact = await buildManager.exportArtifact({ ...payload, encoding: 'path' });
      const path = await chooseSavePath(safeFileName(artifact.name || artifact.artifactName));
      if (!path) return { cancelled: true };
      const bytes = artifact.artifactPath ? await readFile(artifact.artifactPath) : decodeExportBytes(artifact);
      return { ...await writeExportAtomic(path, bytes), saved: true };
    }
    const method = buildManager[buildOperation];
    if (typeof method !== 'function') throw new Error('当前运行时不支持此构建操作。');
    return method.call(buildManager, payload);
  }
  throw new Error('未知的本机操作。');
}

async function registerLocalProtocol() {
  templateMigration = await migrateLegacyTemplates({
    legacyStore: automationMode ? join(app.getPath('userData'), 'legacy-browser-templates') : join(homedir(), '.sitefoundry/ad-templates'),
    dataDirectory: app.getPath('userData'), validateTemplate: prepareTemplate
  });
  localServer = await createOfflineServer(workbenchRoot, app.getPath('userData'));
  await new Promise((ready, fail) => { localServer.once('error', fail); localServer.listen(0, '127.0.0.1', ready); });
  localOrigin = 'http://127.0.0.1:' + localServer.address().port;
  const workbenchSession = session.fromPartition('persist:sitefoundry-workbench');
  workbenchSession.webRequest.onBeforeRequest({ urls: ['sitefoundry://app/__sitefoundry/*', 'http://*/*', 'https://*/*'] }, (details, respond) => {
    if (details.url.startsWith(APP_ORIGIN + '/__sitefoundry/')) {
      // Custom-scheme fetch requests can omit Origin. Use Chromium's actual
      // requesting frame identity rather than a renderer-controlled referrer.
      const trusted = mainWindow && details.webContentsId === mainWindow.webContents.id
        && details.frame === mainWindow.webContents.mainFrame && isTrustedDocument(details.frame?.url);
      respond({ cancel: !trusted });
      return;
    }
    if (smokeReportPath) { offlineRequests.push(details.url); respond({ cancel: true }); }
    else respond({ cancel: false });
  });
  workbenchSession.protocol.handle('sitefoundry', async request => {
    const url = new URL(request.url);
    if (url.hostname !== 'app') return new Response('Invalid application host.', { status: 403 });
    if (url.pathname.startsWith('/__sitefoundry/')) {
      // Retain an additional origin check before translating to loopback. The
      // webRequest frame gate above also covers requests omitting this header.
      const origin = request.headers.get('origin');
      if (origin && origin !== APP_ORIGIN) {
        return new Response('This document cannot access application storage.', { status: 403 });
      }
    }
    const headers = new Headers(request.headers);
    headers.delete('host'); headers.set('Origin', localOrigin);
    const response = await fetch(localOrigin + url.pathname + url.search, {
      method: request.method, headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : Buffer.from(await request.arrayBuffer()),
      redirect: 'manual'
    });
    const outgoing = new Headers(response.headers);
    if (outgoing.has('location')) outgoing.set('location', APP_ORIGIN + outgoing.get('location'));
    // Inline scripts/styles are present in the existing workbench; origins and
    // frame permissions still stay restricted. No network dependency at boot.
    outgoing.set('Content-Security-Policy', WORKBENCH_CONTENT_SECURITY_POLICY);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: outgoing });
  });
}

async function createMainWindow() {
  const window = new BrowserWindow({
    width: 1440, height: 960, minWidth: 820, minHeight: 600,
    title: 'SiteFoundry', icon: join(workbenchRoot, 'assets/sitefoundry.ico'),
    show: false, backgroundColor: '#edf4fa',
    webPreferences: {
      preload: join(sourceDirectory, 'preload.cjs'), nodeIntegration: false,
      contextIsolation: true, sandbox: true, webSecurity: true,
      nodeIntegrationInSubFrames: false, nodeIntegrationInWorker: false,
      offscreen: automationMode,
      partition: 'persist:sitefoundry-workbench'
    }
  });
  mainWindow = window;
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, respond) => respond(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (!isTrustedDocument(url)) event.preventDefault(); });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.on('closed', () => { if (mainWindow === window) mainWindow = null; });
  window.once('ready-to-show', () => { if (!automationMode) window.show(); });
  await window.loadURL(APP_ORIGIN + '/');
  if (!automationMode && templateMigration?.message) {
    void dialog.showMessageBox(window, {
      type: 'warning', title: 'SiteFoundry 广告模板导入',
      message: templateMigration.message,
      detail: '浏览器版模板目录：' + join(homedir(), '.sitefoundry/ad-templates'),
      buttons: ['知道了'], defaultId: 0
    });
  }
  if (smokeReportPath) {
    const { runSmoke } = await import('./smoke.mjs');
    try { await runSmoke({ window, reportPath: smokeReportPath, app, localOrigin, externalRequests: offlineRequests }); app.quit(); }
    catch (error) {
      await mkdir(dirname(smokeReportPath), { recursive: true });
      await writeFile(smokeReportPath, JSON.stringify({ ok: false, error: error.stack }, null, 2));
      await shutdownApplication().catch(() => {});
      app.exit(1);
    }
  }
}

if (!automationMode && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } });
  app.whenReady().then(async () => {
    await registerLocalProtocol();
    await loadBuildManager();
    ipcMain.handle('sitefoundry:native', async (event, operation, payload) => { assertTrustedSender(event); return invokeOperation(operation, payload); });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: '文件', submenu: [{ label: '资讯工作台', click: () => mainWindow?.loadURL(APP_ORIGIN + '/') }, { label: '游戏工作台', click: () => mainWindow?.loadURL(APP_ORIGIN + '/game-builder/') }, { type: 'separator' }, { role: 'quit', label: '退出' }] },
      { label: '编辑', submenu: [{ role: 'undo', label: '撤销' }, { role: 'redo', label: '重做' }, { type: 'separator' }, { role: 'cut', label: '剪切' }, { role: 'copy', label: '复制' }, { role: 'paste', label: '粘贴' }, { role: 'selectAll', label: '全选' }] },
      { label: '视图', submenu: [{ role: 'resetZoom', label: '实际大小' }, { role: 'zoomIn', label: '放大' }, { role: 'zoomOut', label: '缩小' }, { role: 'togglefullscreen', label: '全屏' }] }
    ]));
    await createMainWindow();
  }).catch(async error => { console.error(error); dialog.showErrorBox('SiteFoundry 启动失败', error.message); app.exit(1); });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', event => {
    if (shutdownComplete) return;
    event.preventDefault();
    void shutdownApplication().catch(error => {
      console.error('SiteFoundry shutdown:', error);
      shutdownComplete = true;
    }).finally(() => app.quit());
  });
}
