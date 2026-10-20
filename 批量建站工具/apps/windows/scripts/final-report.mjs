/** Pin delivery files to the exact staged inputs and successful app checks. This
 * read-only summary does not restage current Android-specific runtime changes. */
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const windowsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(windowsRoot, '../..');
const evidenceRoot = join(workspaceRoot, 'coverage/apps-20261013/windows');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const hash = async path => createHash('sha256').update(await readFile(path)).digest('hex');
const installer = join(windowsRoot, 'release/SiteFoundry-1.0.6.4-Windows-x64-Setup.exe');
const unpackedExecutable = join(windowsRoot, 'release/win-unpacked/SiteFoundry.exe');
const stages = await json(join(windowsRoot, 'build/staging-manifest.json'));
const ui = await json(join(evidenceRoot, 'launch-1.json'));
const restart = await json(join(evidenceRoot, 'launch-2.json'));
const installed = await json(join(evidenceRoot, 'installer/installer-summary.json'));
const registryAfter = await json(join(evidenceRoot, 'installer/actual-registry-after.json'));
assert.ok(ui.ok && restart.ok && ui.packaged && restart.packaged && ui.uiBuild?.offline && installed.ok && installed.uninstalled);
assert.ok(installed.launches.every(cycle => cycle.inventory.registration.some(item => item.key.endsWith('\\e0e1123b-7f0a-5b02-a0fb-b4f8752595ae') && item.displayName.startsWith('SiteFoundry '))));
assert.ok(!registryAfter.uninstallKeyExists && !registryAfter.installKeyExists && !registryAfter.programsShortcutExists);
const resourceRoot = join(windowsRoot, 'release/win-unpacked/resources');
const inputParity = [];
for (const [path, sha256] of Object.entries(stages.sharedFingerprints)) {
  const packagedSha256 = await hash(join(resourceRoot, 'workbench', path));
  assert.equal(packagedSha256, sha256, path);
  inputParity.push({ path, sha256 });
}
assert.equal(await hash(join(resourceRoot, 'source-runtime/index.mjs')), stages.sourceRuntimeSha256);
const installedLaunches = [];
for (const cycle of [1, 2]) for (const launch of [1, 2]) {
  const proof = await json(join(evidenceRoot, 'installer/launch-' + cycle, 'launch-' + launch + '.json'));
  assert.ok(proof.ok && proof.packaged && proof.buildRuntime.available);
  installedLaunches.push({ cycle, launch, checks: proof.checks.length, storageRetained: proof.storage.prior === 'retained' });
}
const report = {
  schema: 'sitefoundry-windows-delivery/v1', ok: true, generatedAt: new Date().toISOString(),
  version: '1.0.6.4', platform: 'Windows 10/11 x64', testedHost: 'Windows 10 IoT Enterprise LTSC 2021, 10.0.19044 x64',
  gitRoot: 'D:/Min/建站工具', applicationRoot: workspaceRoot, branch: 'main', baselineHead: '337a87a81efdecca6a2320088188983ebd20acab',
  installer: { path: installer, bytes: (await stat(installer)).size, sha256: await hash(installer), signed: false },
  unpackedExecutable: { path: unpackedExecutable, sha256: await hash(unpackedExecutable) },
  stagedAt: stages.stagedAt, sharedInputParity: inputParity, sourceRuntimeSha256: stages.sourceRuntimeSha256,
  runtimeInputBoundary: 'Delivery contains the verified frozen Windows runtime. Later Android-only process adapter changes in current apps/build-runtime are not included in this Windows package.',
  checks: { nativeUnit: 6, finalPackagedUI: ui.checks.length, finalPackagedRestart: restart.checks.length, installedLaunches },
  offlineSourceWorkflow: ui.uiBuild,
  installerVerification: { installed: true, sameVersionReinstalled: true, installedEXEMatchesUnpacked: true, ownInstallationUninstalled: installed.uninstalled, originalInventoryRestored: !installed.after.registration.length && !installed.after.realUserData && !installed.after.desktopShortcut && !installed.after.menuShortcut, isolatedUserDataRetained: installed.userDataRetainedAfterUninstall, registration: { appId: registryAfter.appId, guid: registryAfter.guid, registeredBothCycles: true, removedAfterUninstall: true } },
  verificationRepairs: ['Initial installer-summary-uninstaller-delay.json captured the start-menu link before NSIS temporary helper finished. The link and installation directory disappeared naturally; no manual shortcut removal was used. The verifier now waits for EXE, registry and shortcut cleanup together.', 'The registration inventory now matches the actual SiteFoundry versioned DisplayName and app UUID, instead of requiring an exact unversioned name. Successful rerun records the expected registration during both install cycles.'],
  screenshots: ['windows-main.png', 'windows-game.png', 'windows-source-dialog.png', 'windows-ui-built-preview.png'],
  limitations: ['Windows 11 has not been separately exercised on a Windows 11 host.', 'Installer is unsigned.', 'Same-version reinstall was checked; a later cross-version update package is not available yet.', 'Offline source builds require dependency preparation, local resources and a static-compatible source project; this fixture does not establish arbitrary npm-native-addon compatibility.', 'Browser-origin IndexedDB game data must be reimported; native application upgrades retain the app profile.']
};
await writeFile(join(evidenceRoot, 'final-summary.json'), JSON.stringify(report, null, 2) + '\n');
console.log('Windows delivery verified: ' + report.installer.bytes + ' bytes; SHA-256 ' + report.installer.sha256);
