/** Prepare self-contained resources without changing the shared dist output.
 * Run the shared production build first; only this app's staging tree is replaced. */
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from '../../../node_modules/esbuild/lib/main.js';
import { Resvg } from '@resvg/resvg-js';
import { prepareWindowsNode } from './prepare-node-runtime.mjs';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workbenchRoot = resolve(appRoot, '../..');
const staging = join(appRoot, 'build');
await stat(join(workbenchRoot, 'dist/index.html'));
await mkdir(staging, { recursive: true });
await prepareWindowsNode(staging);
// The resolved deletion target is a dedicated child of apps/windows/build.
const stagedWorkbench = join(staging, 'workbench');
if (!stagedWorkbench.startsWith(staging + '/')) {
  // path separators differ on Windows; resolve a second containment check.
  if (dirname(stagedWorkbench) !== staging) throw new Error('Invalid Windows staging directory.');
}
await rm(stagedWorkbench, { recursive: true, force: true });
await cp(join(workbenchRoot, 'dist'), stagedWorkbench, { recursive: true });
// Windows executable resources require a 256 px icon. Rasterize the existing
// brand vector; ICO stores this PNG directly, retaining the approved mark.
const iconSvg = await readFile(join(workbenchRoot, 'assets/sitefoundry-icon.svg'), 'utf8');
const iconPng = new Resvg(iconSvg, { fitTo: { mode: 'width', value: 256 } }).render().asPng();
const iconHeader = Buffer.alloc(22);
iconHeader.writeUInt16LE(1, 2); iconHeader.writeUInt16LE(1, 4);
iconHeader.writeUInt16LE(1, 10); iconHeader.writeUInt16LE(32, 12);
iconHeader.writeUInt32LE(iconPng.length, 14); iconHeader.writeUInt32LE(22, 18);
await writeFile(join(staging, 'sitefoundry.ico'), Buffer.concat([iconHeader, iconPng]));
await build({
  entryPoints: [join(workbenchRoot, 'server/offline-server.js')],
  outfile: join(staging, 'offline-server.mjs'), bundle: true,
  platform: 'node', format: 'esm', target: 'node22'
});
await build({ entryPoints: [join(workbenchRoot, 'js/ad-template-analysis.js')],
  outfile: join(staging, 'ad-template-analysis.mjs'), bundle: true,
  platform: 'node', format: 'esm', target: 'node22' });
// A source-runtime resource directory always exists, including when the runtime
// has not yet been prepared. The runtime adapter reports unavailable clearly.
const runtimeTarget = join(staging, 'source-runtime');
if (dirname(runtimeTarget) !== staging) throw new Error('Invalid Windows runtime staging directory.');
await rm(runtimeTarget, { recursive: true, force: true });
await mkdir(runtimeTarget, { recursive: true });
const runtimeSource = join(workbenchRoot, 'apps/build-runtime');
try {
  await stat(runtimeSource);
  await cp(runtimeSource, runtimeTarget, { recursive: true, filter: source => {
    const path = relative(runtimeSource, source).replaceAll('\\', '/');
    // npm's own vendor/npm/node_modules is part of the shipped runtime. Only
    // a developer install at the runtime root and test evidence are excluded.
    return !['node_modules', 'test-results', 'tests'].some(directory => path === directory || path.startsWith(directory + '/'));
  } });
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const workbench = JSON.parse(await readFile(join(workbenchRoot, 'package.json'), 'utf8'));
const metadataPath = join(appRoot, 'package.json');
const desktop = JSON.parse(await readFile(metadataPath, 'utf8'));
// Keep normal SemVer intact and also accept legacy four-part display versions.
// electron-builder requires SemVer; Windows file metadata accepts four parts.
desktop.version = workbench.version.replace(/^(\d+\.\d+\.\d+)\.(\d+)$/, '$1-$2');
desktop.sitefoundryVersion = workbench.version;
desktop.build.buildVersion = workbench.version;
desktop.build.win.artifactName = `SiteFoundry-${workbench.version}-Windows-x64-Setup.\${ext}`;
await writeFile(metadataPath, JSON.stringify(desktop, null, 2) + '\n');
const sharedFingerprints = {};
for (const path of ['index.html', 'game-builder/index.html', 'js/native-platform.js', 'js/native-workbench.js', 'css/native-app.css']) {
  try { sharedFingerprints[path] = createHash('sha256').update(await readFile(join(stagedWorkbench, path))).digest('hex'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
await writeFile(join(staging, 'staging-manifest.json'), JSON.stringify({
  schema: 'sitefoundry-windows-stage/v1', version: workbench.version,
  stagedAt: new Date().toISOString(), workbenchRoot,
  minimumWindows: 'Windows 10 x64', dataDirectory: '%APPDATA%/SiteFoundry',
  sharedBuildRequired: true, sharedFingerprints,
  sourceRuntimeSha256: createHash('sha256').update(await readFile(join(runtimeTarget, 'index.mjs'))).digest('hex')
}, null, 2) + '\n');
console.log('Windows resources staged from ' + workbenchRoot + '/dist');
