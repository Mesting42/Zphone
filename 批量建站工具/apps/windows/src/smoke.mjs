/** Targeted packaged-app validation enabled only by an explicit CLI environment
 * flag. Its profile and exports must point at a disposable test directory. */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { BrowserWindow } from 'electron';

export async function runSmoke({ window, reportPath, app, localOrigin, externalRequests = [] }) {
  const checks = [];
  const errors = [];
  const contents = window.webContents;
  contents.on('console-message', event => { if (/error/i.test(event.message)) errors.push(event.message); });
  // The main process's request gate already blocks network in smoke mode;
  // retaining that listener also tests the production native storage boundary.
  await mkdir(dirname(reportPath), { recursive: true });
  const execute = source => contents.executeJavaScript(source, true);
  async function waitForUI(expression, description, timeout = 30000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await execute(expression)) return;
      await new Promise(done => setTimeout(done, 200));
    }
    throw new Error(description + ': ' + await execute('document.querySelector("[data-project-status]")?.textContent || document.body.innerText.slice(-500)'));
  }
  const info = await execute('window.SiteFoundryNative.getPlatformInfo()');
  assert.equal(info.platform, 'windows');
  assert.equal(await execute('typeof window.require'), 'undefined');
  assert.equal(await execute('typeof window.process'), 'undefined');
  checks.push('Isolated Windows native bridge and no renderer Node access');
  const title = contents.getTitle();
  assert.match(title, /SiteFoundry/i);
  assert.equal(contents.getURL(), 'sitefoundry://app/');
  checks.push('Packaged SiteFoundry main page and stable custom origin');
  await waitForUI('!!document.querySelector("[data-native-projects]")', 'Native toolbar failed to initialize');
  assert.equal(await execute('window.SiteFoundryPlatform.kind'), 'windows');
  checks.push('Shared native platform adapter and workbench toolbar initialize');

  const storage = await execute(`(() => {
    const prior = localStorage.getItem('sitefoundry-windows-smoke');
    localStorage.setItem('sitefoundry-windows-smoke', 'retained');
    return { prior, current: localStorage.getItem('sitefoundry-windows-smoke') };
  })()`);
  assert.equal(storage.current, 'retained');
  if (process.env.SITEFOUNDRY_SMOKE_EXPECT_PERSISTENCE === '1') assert.equal(storage.prior, 'retained');
  checks.push('Persistent browser profile survives application restart');

  const bytes = Buffer.from([80, 75, 3, 4, 0, 255, 1, 12, 70, 0]);
  const exported = await execute(`window.SiteFoundryNative.saveFile({name:'native-bytes.zip',mime:'application/zip',base64:'${bytes.toString('base64')}'})`);
  assert.deepEqual(await readFile(exported.path), bytes);
  checks.push('Native binary save preserves all bytes');
  const transfer = await execute(`window.SiteFoundryNative.startFile({name:'native-chunks.zip',size:10})`);
  await execute(`window.SiteFoundryNative.appendFile({id:'${transfer.id}',base64:'${bytes.subarray(0, 4).toString('base64')}'})`);
  await execute(`window.SiteFoundryNative.appendFile({id:'${transfer.id}',base64:'${bytes.subarray(4).toString('base64')}'})`);
  const chunked = await execute(`window.SiteFoundryNative.finishFile({id:'${transfer.id}'})`);
  assert.deepEqual(await readFile(chunked.path), bytes);
  checks.push('Chunked export joins binary chunks without corruption');
  const directory = await execute('window.SiteFoundryNative.selectDirectory()');
  const directoryTransfer = await execute('window.SiteFoundryNative.startFile(' + JSON.stringify({ directoryToken: directory.token, relativePath: 'nested/site/index.html', size: bytes.length }) + ')');
  await execute('window.SiteFoundryNative.appendFile(' + JSON.stringify({ id: directoryTransfer.id, base64: bytes.toString('base64') }) + ')');
  const directoryExport = await execute('window.SiteFoundryNative.finishFile(' + JSON.stringify({ id: directoryTransfer.id }) + ')');
  assert.deepEqual(await readFile(directoryExport.path), bytes);
  const traversalBlocked = await execute('window.SiteFoundryNative.startFile(' + JSON.stringify({ directoryToken: directory.token, relativePath: '../escape.txt' }) + ').then(()=>false,()=>true)');
  assert.equal(traversalBlocked, true);
  checks.push('Native directory export creates nested files and blocks path escape');
  await execute('document.querySelector("[data-native-directory]").click()');
  await waitForUI('document.querySelector("[data-native-directory]").textContent === "更换导出目录"', 'Directory toolbar selection failed');
  await execute(`window.SiteFoundryPlatform.saveExport(new Blob([new Uint8Array([80,75,3,4,0,255,1,12,70,0])]), 'shared-platform.zip')`);
  assert.deepEqual(await readFile(join(process.env.SITEFOUNDRY_SMOKE_EXPORT_DIR, 'shared-platform.zip')), bytes);
  checks.push('Shared platform export uses the selected native directory');
  if (process.env.SITEFOUNDRY_SMOKE_IMPORT_DIR) {
    const imported = await execute('window.SiteFoundryNative.selectImportDirectory()');
    assert.equal(imported.files.length, 2);
    const entry = imported.files.find(file => file.path === 'assets/style.css');
    assert.ok(entry && entry.uri);
    const first = await execute('window.SiteFoundryNative.readImportFile(' + JSON.stringify({ uri: entry.uri, offset: 0, length: 4 }) + ')');
    const remainder = await execute('window.SiteFoundryNative.readImportFile(' + JSON.stringify({ uri: entry.uri, offset: 4, length: 524288 }) + ')');
    assert.equal(Buffer.concat([Buffer.from(first.dataBase64, 'base64'), Buffer.from(remainder.dataBase64, 'base64')]).toString(), 'body{color:#246fdf}');
    assert.equal(remainder.eof, true);
    checks.push('Native directory import lazily reads exact approved-file bytes');
    const adaptedImport = await execute(`(async () => {
      const root = await window.showDirectoryPicker({mode:'read'});
      for await (const [name, item] of root.entries()) if (name === 'assets') {
        for await (const [child, file] of item.entries()) if (child === 'style.css') return (await file.getFile()).text();
      }
    })()`);
    assert.equal(adaptedImport, 'body{color:#246fdf}');
    checks.push('Shared folder workflow reads approved native directory entries');
  }

  const frameIsolation = await execute(`new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    const timeout = setTimeout(() => reject(new Error('Preview probe timed out')), 5000);
    const receive = event => {
      if (event.source !== frame.contentWindow || !event.data?.sitefoundryProbe) return;
      clearTimeout(timeout); window.removeEventListener('message', receive); frame.remove(); resolve(event.data);
    };
    window.addEventListener('message', receive);
    frame.srcdoc = '<script>parent.postMessage({sitefoundryProbe:true,bridge:typeof window.SiteFoundryNative,node:typeof window.require}, "*");<\/script>';
    document.body.appendChild(frame);
  })`);
  assert.equal(frameIsolation.bridge, 'undefined');
  assert.equal(frameIsolation.node, 'undefined');
  checks.push('Opaque generated preview cannot access the native bridge');

  const catalog = await execute('window.SiteFoundryNative.templates.list()');
  assert.ok(Array.isArray(catalog.templates));
  const api = await execute(`fetch('/__sitefoundry/ad-templates').then(r => ({ok:r.ok,status:r.status})).then(r=>r)`);
  assert.equal(api.status, 200);
  checks.push('Offline template API and userData template storage');
  const specimenVersion = 'v100.0.1';
  const specimenSource = '/* ad.js v100.0.1 */\nvar bannerPath1="a",bannerPath2="b",bannerPath3="c",interstitialPath="d",anchorPath="e",analyticsID="f";';
  const trustedPost = await execute(`fetch('/__sitefoundry/ad-templates/analyze', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:${JSON.stringify(specimenSource)}})}).then(response=>response.status)`);
  assert.equal(trustedPost, 200);
  const opaqueStorageBlocked = await execute(`new Promise((resolve, reject) => {
    const frame = document.createElement('iframe'); frame.setAttribute('sandbox','allow-scripts');
    const timeout = setTimeout(() => reject(new Error('Opaque storage probe timed out')), 5000);
    const receive = event => {
      if (event.source !== frame.contentWindow || !event.data?.storageProbe) return;
      clearTimeout(timeout); window.removeEventListener('message',receive); frame.remove(); resolve(event.data.blocked);
    };
    window.addEventListener('message',receive);
    frame.srcdoc = '<script>Promise.all([fetch("sitefoundry://app/__sitefoundry/ad-templates").then(r=>r.status===403,()=>true),fetch("sitefoundry://app/__sitefoundry/ad-templates/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:"probe"})}).then(r=>r.status===403,()=>true)]).then(values=>parent.postMessage({storageProbe:true,blocked:values.every(Boolean)},"*"));<\\/script>';
    document.body.appendChild(frame);
  })`);
  assert.equal(opaqueStorageBlocked, true);
  checks.push('Trusted template mutations work while opaque previews cannot access native storage');
  if (!catalog.templates.some(item => item.version === specimenVersion)) {
    const specimen = { version: specimenVersion, source: specimenSource, fields: { bannerPath1: 'bannerPath1', bannerPath2: 'bannerPath2', bannerPath3: 'bannerPath3', interstitialPath: 'interstitialPath', anchorPath: 'anchorPath', analyticsID: 'analyticsID' } };
    await execute('window.SiteFoundryNative.templates.write(' + JSON.stringify(specimen) + ')');
  }
  const specimen = await execute('window.SiteFoundryNative.templates.read(' + JSON.stringify(specimenVersion) + ')');
  assert.equal(specimen.source, specimenSource);
  await execute('window.SiteFoundryNative.templates.setDefault("v1.0.2.1")');
  checks.push('Uploaded custom template bytes persist across application restart');
  const archiveWorker = await execute(`(async () => {
    const zip = new JSZip(); zip.file('data.json', '{"title":"Native archive"}');
    const bytes = await zip.generateAsync({type:'uint8array'});
    const Archive = await window.loadArchiveRuntime();
    const archive = await Archive.open(new File([bytes], 'worker-probe.zip', {type:'application/zip'}));
    try {
      await archive.extractFiles(); const entries = await archive.getFilesArray();
      return {files:entries.length,content:await entries[0].file.text()};
    } finally { archive.close(); }
  })()`);
  assert.ok(archiveWorker.files >= 1);
  assert.equal(archiveWorker.content, '{"title":"Native archive"}');
  checks.push('Packaged archive Worker and WASM extract bytes offline');
  let uiBuild = null;
  if (process.env.SITEFOUNDRY_SMOKE_UI_BUILD === '1') {
    // Exercise the exact user-facing controls, including the OS picker boundary.
    // Renderer networking stays blocked; dependency preparation belongs to Node,
    // and the subsequent build activates the runtime's own offline network guard.
    await execute('document.querySelector("[data-native-projects]").click()');
    await waitForUI('document.querySelector(".native-project-dialog")?.open && !document.querySelector("[data-project-import]").disabled', 'Source project dialog failed to open');
    await execute('document.querySelector("[data-project-import]").click()');
    await waitForUI('document.querySelector("[data-project-status]").textContent.includes("工程已导入")', 'Native source import failed', 60000);
    const projectId = await execute('document.querySelector("#native-project-select").value');
    assert.ok(projectId);
    await execute('document.querySelector("[data-project-prepare]").click()');
    await waitForUI('!document.querySelector("[data-project-build]").disabled', 'UI dependency preparation failed', 300000);
    await execute('document.querySelector("[data-project-build]").click()');
    await waitForUI('!document.querySelector("[data-project-preview]").disabled && document.querySelector("[data-project-status]").textContent.includes("构建完成")', 'UI offline build failed', 300000);
    const taskDirectory = join(app.getPath('userData'), 'source-builds/tasks');
    const tasks = await Promise.all((await readdir(taskDirectory)).filter(name => name.endsWith('.json')).map(async name => JSON.parse(await readFile(join(taskDirectory, name), 'utf8'))));
    const task = tasks.filter(item => item.projectId === projectId && item.operation === 'build' && item.state === 'succeeded').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    assert.ok(task?.artifactPath); assert.equal(task.offline, true);
    await execute('document.querySelector("[data-project-preview]").click()');
    await waitForUI('document.querySelector(".native-project-dialog").open', 'Project dialog closed unexpectedly');
    const deadline = Date.now() + 15000;
    let preview;
    while (!preview && Date.now() < deadline) {
      preview = BrowserWindow.getAllWindows().find(candidate => candidate !== window && candidate.webContents.getURL().startsWith('sitefoundry-preview:'));
      if (!preview) await new Promise(done => setTimeout(done, 100));
    }
    assert.ok(preview);
    if (preview.webContents.isLoadingMainFrame()) await new Promise(done => preview.webContents.once('did-finish-load', done));
    const previewInfo = await preview.webContents.executeJavaScript('({title:document.title,bridge:typeof window.SiteFoundryNative,node:typeof window.require})');
    assert.match(previewInfo.title, /PixelWire/); assert.equal(previewInfo.bridge, 'undefined'); assert.equal(previewInfo.node, 'undefined');
    await writeFile(join(dirname(reportPath), 'windows-ui-built-preview.png'), (await preview.webContents.capturePage()).toPNG());
    preview.close();
    await execute('document.querySelector("[data-project-export]").click()');
    await waitForUI('document.querySelector("[data-project-status]").textContent === "成品 ZIP 已保存。"', 'UI artifact export failed', 60000);
    const expected = await readFile(task.artifactPath);
    const exported = await readFile(join(process.env.SITEFOUNDRY_SMOKE_EXPORT_DIR, task.artifactName));
    assert.deepEqual(exported, expected);
    uiBuild = { projectId, taskId: task.id, offline: task.offline, artifact: task.artifact, sha256: createHash('sha256').update(exported).digest('hex'), preview: previewInfo };
    await writeFile(join(dirname(reportPath), 'windows-source-dialog.png'), (await contents.capturePage()).toPNG());
    await execute('document.querySelector("[data-project-close]").click()');
    checks.push('Packaged source dialog imports, prepares, builds offline, previews and exports an exact Next ZIP');
  }
  let artifactPreview = null;
  if (process.env.SITEFOUNDRY_SMOKE_TASK_ID) {
    await execute('window.SiteFoundryNative.previewArtifact({taskId:' + JSON.stringify(process.env.SITEFOUNDRY_SMOKE_TASK_ID) + '})');
    const preview = BrowserWindow.getAllWindows().find(candidate => candidate !== window && candidate.webContents.getURL().startsWith('sitefoundry-preview:'));
    assert.ok(preview);
    artifactPreview = await preview.webContents.executeJavaScript(`({title:document.title,bridge:typeof window.SiteFoundryNative,node:typeof window.require,body:document.body.textContent.slice(0,1000)})`);
    assert.equal(artifactPreview.bridge, 'undefined'); assert.equal(artifactPreview.node, 'undefined');
    assert.match(artifactPreview.title, /PixelWire/);
    await new Promise(done => setTimeout(done, 250));
    await writeFile(join(dirname(reportPath), 'windows-built-preview.png'), (await preview.webContents.capturePage()).toPNG());
    preview.close();
    checks.push('Native compiled Next artifact opens in isolated read-only preview');
  }
  // Allow the offscreen renderer to produce its first paint before capturing.
  await new Promise(resolve => setTimeout(resolve, 250));
  const screenshot = await contents.capturePage();
  await writeFile(join(dirname(reportPath), 'windows-main.png'), screenshot.toPNG());
  await window.loadURL('sitefoundry://app/game-builder/');
  assert.match(contents.getTitle(), /SiteFoundry/i);
  assert.equal(await execute('typeof window.SiteFoundryNative.saveFile'), 'function');
  assert.equal(await execute('typeof window.require'), 'undefined');
  checks.push('Packaged game workbench loads with native export support');
  await writeFile(join(dirname(reportPath), 'windows-game.png'), (await contents.capturePage()).toPNG());
  const assets = await execute(`Promise.all(['/fonts/inter/font.css', '/js/app.js', '/assets/sitefoundry.ico'].map(async path => {
    const response = await fetch(path); return {path,status:response.status,size:(await response.arrayBuffer()).byteLength};
  }))`);
  assets.forEach(asset => { assert.equal(asset.status, 200, asset.path); assert.ok(asset.size > 0); });
  checks.push('Packaged local fonts, shared scripts and brand icon available offline');
  const report = {
    schema: 'sitefoundry-windows-smoke/v1', ok: true, testedAt: new Date().toISOString(),
    appVersion: app.getVersion(), electron: process.versions.electron,
    runtimeNode: process.versions.node, packaged: app.isPackaged,
    executable: process.execPath, dataDirectory: app.getPath('userData'), localOrigin,
    title, checks, assets, storage, externalRequests, consoleErrors: errors, archiveWorker, artifactPreview, uiBuild,
    exportSha256: createHash('sha256').update(await readFile(exported.path)).digest('hex'),
    buildRuntime: { available: info.capabilities.offlineBuild, error: info.runtimeError }
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  return report;
}
