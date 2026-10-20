import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractProjectZip } from '../../build-runtime/zip.mjs';

// Developer-only reproducible preparation: pin the mobile port and compile a
// regular PIE launcher for every packaged ABI. No runtime downloads occur on
// installed first launch. Keep all SDK/archive material out of the source tree.
const directory = path.dirname(fileURLToPath(import.meta.url));
const application = path.resolve(directory, '../../..');
const toolchainIndex = process.argv.indexOf('--toolchain');
const toolchain = path.resolve(process.env.SITEFOUNDRY_TOOLCHAIN || (toolchainIndex >= 0 && process.argv[toolchainIndex + 1]) || path.join(application, 'coverage/apps-20261013/toolchain'));
const sdk = process.env.ANDROID_HOME || path.join(toolchain, 'android-sdk');
const nodeRoot = path.join(toolchain, 'node-mobile');
const archivePath = path.join(nodeRoot, 'nodejs-mobile-android-24.21.0-0.zip');
const url = 'https://github.com/fogtape/nodejs-mobile/releases/download/v24.21.0-0/nodejs-mobile-android-24.21.0-0.zip';
const sha256 = 'e3cd29a1be03405f11dd5c857af8cd3ad13f84f1409ea648f5328f0bada5bd76';
await fs.mkdir(nodeRoot, { recursive: true });
try { await fs.access(archivePath); }
catch {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Node mobile download failed: ' + response.status);
  await fs.writeFile(archivePath, Buffer.from(await response.arrayBuffer()));
}
const archive = await fs.readFile(archivePath);
if (createHash('sha256').update(archive).digest('hex') !== sha256) throw new Error('Node mobile release digest mismatch');
const extracted = path.join(nodeRoot, 'extracted');
try { await fs.access(path.join(extracted, 'include/node/node.h')); }
catch { await fs.mkdir(extracted, { recursive: true }); await extractProjectZip(archive, extracted); }
const cmake = path.join(sdk, 'cmake/3.22.1/bin/cmake' + (process.platform === 'win32' ? '.exe' : ''));
const ninja = path.join(sdk, 'cmake/3.22.1/bin/ninja' + (process.platform === 'win32' ? '.exe' : ''));
const ndk = path.join(sdk, 'ndk/28.2.13676358');
// The binary archive omits notices. Carry the exact release's Node/dependency
// license and the statically linked Android C++ runtime notices in app assets.
const licensesDirectory = path.join(application, 'apps/build-runtime/vendor/licenses');
await fs.mkdir(licensesDirectory, { recursive: true });
const licenseURL = 'https://raw.githubusercontent.com/fogtape/nodejs-mobile/v24.21.0-0/LICENSE';
const licenseSha256 = 'c373dabed995013e091b1908996a69a1647ef19d400e6c1fd4b7fb06d8bc0f66';
const licensePath = path.join(licensesDirectory, 'Node-mobile-LICENSE.txt');
let licenseBytes;
try { licenseBytes = await fs.readFile(licensePath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!licenseBytes) {
  const response = await fetch(licenseURL);
  if (!response.ok) throw new Error('Node mobile license download failed: ' + response.status);
  licenseBytes = Buffer.from(await response.arrayBuffer());
}
if (createHash('sha256').update(licenseBytes).digest('hex') !== licenseSha256) throw new Error('Node mobile license digest mismatch');
await fs.writeFile(licensePath, licenseBytes);
await fs.copyFile(path.join(ndk, 'toolchains/llvm/prebuilt/windows-x86_64/sysroot/NOTICE'), path.join(licensesDirectory, 'Android-native-runtime-NOTICE.txt'));
const run = (arguments_) => new Promise((resolve, reject) => {
  const child = spawn(cmake, arguments_, { stdio: 'inherit', windowsHide: true });
  child.once('error', reject); child.once('close', (code) => code ? reject(new Error('CMake failed: ' + code)) : resolve());
});
const built = [];
for (const abi of ['arm64-v8a', 'x86_64']) {
  const build = path.join(directory, 'build', abi);
  await run(['-S', directory, '-B', build, '-G', 'Ninja', '-DCMAKE_MAKE_PROGRAM=' + ninja, '-DCMAKE_TOOLCHAIN_FILE=' + path.join(ndk, 'build/cmake/android.toolchain.cmake'), '-DANDROID_ABI=' + abi, '-DANDROID_PLATFORM=android-29', '-DANDROID_STL=c++_static', '-DNODE_MOBILE_ROOT=' + extracted, '-DCMAKE_BUILD_TYPE=Release']);
  await run(['--build', build]);
  const destination = path.join(directory, 'jniLibs', abi);
  await fs.mkdir(destination, { recursive: true });
  for (const name of ['libsitefoundrynode.so', 'libsitefoundryshell.so', 'libnode.so']) {
    const source = name === 'libnode.so' ? path.join(extracted, 'bin', abi, name) : path.join(build, name);
    const bytes = await fs.readFile(source);
    await fs.writeFile(path.join(destination, name), bytes);
    built.push({ abi, name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
}
await fs.writeFile(path.join(directory, 'runtime-provenance.json'), JSON.stringify({ schema: 1, nodeVersion: '24.21.0', mobileVersion: '24.21.0-0', distributionPrerelease: true, sourceURL: url, archiveSha256: sha256, licenseURL, licenseSha256, ndk: '28.2.13676358', cmake: '3.22.1', androidMinAPI: 29, built }, null, 2));
