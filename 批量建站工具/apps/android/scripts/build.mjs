import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';
import { readFile, writeFile, mkdir, cp, readdir, stat } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workbench = resolve(appRoot, '../..');
// Use the shared version for artifact identity instead of a hard-coded filename.
const workbenchVersion = JSON.parse(await readFile(join(workbench, 'package.json'), 'utf8')).version;
const toolchain = process.env.SITEFOUNDRY_TOOLCHAIN || join(workbench, 'coverage/apps-20261013/toolchain');
const sdk = process.env.ANDROID_HOME || join(toolchain, 'android-sdk');
const jdkDirectory = process.env.JAVA_HOME || join(toolchain, 'jdk', (await readdir(join(toolchain, 'jdk'))).find(name => name.startsWith('jdk-')));
const debug = process.argv.includes('--debug');
const env = { ...process.env, JAVA_HOME: jdkDirectory, ANDROID_HOME: sdk, GRADLE_USER_HOME: join(toolchain, 'gradle-cache') };

/** Spawn argument arrays so paths/spaces and signing secrets never become shell text. */
function run(executable, args, cwd = appRoot) {
  const result = spawnSync(executable, args, { cwd, env, stdio: 'inherit', windowsHide: true, shell: executable.endsWith('.bat') || executable.endsWith('.cmd') });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${executable} exited with status ${result.status}`);
}
const root = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: workbench, encoding: 'utf8', windowsHide: true });
if (root.status !== 0 || resolve(root.stdout.trim()) !== resolve(workbench, '..')) throw new Error('Unexpected Git/workspace directory');
await stat(join(workbench, 'dist/index.html'));
run(process.execPath, [join(appRoot, 'native-runtime/prepare-android-runtime.mjs'), '--toolchain', toolchain]);
run(process.execPath, [join(workbench, 'apps/build-runtime/prepare-runtime.mjs')]);
run(process.execPath, [join(appRoot, 'node_modules/@capacitor/cli/bin/capacitor'), 'sync', 'android']);

const assets = join(appRoot, 'project/app/src/main/assets');
// Verify the real copied assets, not only the browser build. Missing worker,
// archive or font files would otherwise appear only when an installed app is offline.
const publicAssets = join(assets, 'public');
async function requireSameAsset(relativePath) {
  const expected = await readFile(join(workbench, 'dist', relativePath));
  const actual = await readFile(join(publicAssets, relativePath));
  if (!expected.equals(actual)) throw new Error('Android asset copy differs: ' + relativePath);
}
for (const relativePath of [
  'index.html', 'game-builder/index.html', 'node_modules/jszip/dist/jszip.min.js',
  'js/vendor/libarchive/libarchive.js', 'js/vendor/libarchive/worker-bundle.js', 'js/vendor/libarchive/libarchive.wasm',
  'fonts/manifest.json',
]) await requireSameAsset(relativePath);
const fontCatalog = JSON.parse(await readFile(join(publicAssets, 'fonts/manifest.json'), 'utf8'));
for (const family of Object.values(fontCatalog.families)) {
  await requireSameAsset('fonts/' + family.css);
  await requireSameAsset('fonts/' + family.license);
  for (const file of family.files) {
    const digest = createHash('sha256').update(await readFile(join(publicAssets, 'fonts', file.path))).digest('hex');
    if (digest !== file.sha256) throw new Error('Android font integrity mismatch: ' + file.path);
  }
}
const runtimeRoot = join(workbench, 'apps/build-runtime');
// Exclude development directories only at the runtime root. npm itself depends
// on vendor/npm/node_modules, which must remain in the offline installation.
await cp(runtimeRoot, join(assets, 'build-runtime'), {
  recursive: true,
  filter: source => !['node_modules', 'tests', 'coverage', '.git'].includes(relative(runtimeRoot, source).split(/[\\/]/)[0]),
});
// Keep same-version rebuilds safe as well as version upgrades: the installed
// runtime refreshes from assets when actual runtime content changes.
const runtimeHash = createHash('sha256');
async function hashRuntime(directory, prefix = '') {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    const name = prefix + entry.name;
    if (entry.isDirectory()) await hashRuntime(path, name + '/');
    else { runtimeHash.update(name); runtimeHash.update(await readFile(path)); }
  }
}
await hashRuntime(join(assets, 'build-runtime'));
await writeFile(join(assets, 'build-runtime-fingerprint.txt'), runtimeHash.digest('hex'));
const config = JSON.parse(await readFile(join(assets, 'capacitor.config.json'), 'utf8'));
config.android.webContentsDebuggingEnabled = debug;
await writeFile(join(assets, 'capacitor.config.json'), JSON.stringify(config, null, 2));
await writeFile(join(appRoot, 'project/local.properties'), `sdk.dir=${sdk.replaceAll('\\', '\\\\').replace(':', '\\:')}\n`);

if (!debug) {
  // A durable key outside the checkout preserves update compatibility across
  // cleans/rebuilds. It is private user data, never an installation artifact.
  const signingRoot = join(process.env.LOCALAPPDATA || process.env.USERPROFILE, 'SiteFoundry/build-signing');
  await mkdir(signingRoot, { recursive: true });
  if (process.platform === 'win32') {
    const identity = spawnSync('powershell.exe', ['-NoProfile', '-Command', '[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value'], { encoding: 'utf8', windowsHide: true });
    const sid = identity.stdout.trim();
    if (!/^S-1-5-[0-9-]+$/.test(sid)) throw new Error('Cannot determine signing key owner');
    const acl = spawnSync('icacls.exe', [signingRoot, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F'], { encoding: 'utf8', windowsHide: true });
    if (acl.status !== 0) throw new Error('Cannot restrict signing key folder access');
  }
  const secretPath = join(signingRoot, 'android-signing.json');
  let signing;
  try { signing = JSON.parse(await readFile(secretPath, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    signing = { keystore: join(signingRoot, 'sitefoundry-release.jks'), password: randomBytes(32).toString('hex'), alias: 'sitefoundry' };
    await writeFile(secretPath, JSON.stringify(signing, null, 2), { mode: 0o600 });
  }
  env.SITEFOUNDRY_ANDROID_KEYSTORE = signing.keystore;
  env.SITEFOUNDRY_ANDROID_KEY_PASSWORD = signing.password;
  try { await stat(signing.keystore); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    run(join(jdkDirectory, 'bin/keytool.exe'), ['-genkeypair', '-keystore', signing.keystore, '-alias', signing.alias, '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000', '-storepass:env', 'SITEFOUNDRY_ANDROID_KEY_PASSWORD', '-keypass:env', 'SITEFOUNDRY_ANDROID_KEY_PASSWORD', '-dname', 'CN=SiteFoundry']);
  }
}
run(join(appRoot, 'project/gradlew.bat'), [':app:assemble' + (debug ? 'Debug' : 'Release'), '--no-daemon', '--console=plain', '-Dhttps.protocols=TLSv1.2', '-Djdk.tls.namedGroups=secp256r1,secp384r1,x25519'], join(appRoot, 'project'));
const variant = debug ? 'debug' : 'release';
const artifact = join(appRoot, `project/app/build/outputs/apk/${variant}/app-${variant}.apk`);
const releaseRoot = join(appRoot, 'release');
await mkdir(releaseRoot, { recursive: true });
await cp(artifact, join(releaseRoot, `SiteFoundry-${workbenchVersion}-android-${variant}.apk`));
console.log(`APK saved in ${releaseRoot}`);
