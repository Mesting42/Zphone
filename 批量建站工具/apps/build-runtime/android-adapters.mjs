import fs from 'node:fs/promises';
import path from 'node:path';

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const exists = async (file) => { try { await fs.access(file); return true; } catch { return false; } };
const quote = (value) => "'" + String(value).replaceAll("'", "'\\''") + "'";

// Node workers can run packaged code, but Android forbids executing an esbuild
// binary downloaded to app data. Exact-version official WASM variants provide
// the same compiler API without replacing the user's source package/lock.
export async function prepareAndroidCompilers({ source, tools, npmCli, run }) {
  const needed = [];
  const esbuildRoot = path.join(source, 'node_modules/esbuild');
  const rollupRoot = path.join(source, 'node_modules/rollup');
  if (await exists(path.join(esbuildRoot, 'package.json'))) needed.push('esbuild-wasm@' + (await readJson(path.join(esbuildRoot, 'package.json'))).version);
  if (await exists(path.join(rollupRoot, 'package.json'))) needed.push('@rollup/wasm-node@' + (await readJson(path.join(rollupRoot, 'package.json'))).version);
  if (!needed.length) return [];
  await fs.mkdir(tools, { recursive: true });
  if (!await exists(path.join(tools, 'package.json'))) await fs.writeFile(path.join(tools, 'package.json'), JSON.stringify({ private: true, name: 'sitefoundry-android-compiler', version: '1.0.0' }));
  await run([npmCli, 'install', '--prefix', tools, '--ignore-scripts', '--no-audit', '--no-fund', '--save-exact', ...needed]);
  if (needed.some((name) => name.startsWith('esbuild-wasm@'))) {
    await fs.cp(path.join(tools, 'node_modules/esbuild-wasm'), esbuildRoot, { recursive: true });
  }
  if (needed.some((name) => name.startsWith('@rollup/wasm-node@'))) {
    const wasmRoot = path.join(source, 'node_modules/@rollup/wasm-node');
    await fs.mkdir(path.dirname(wasmRoot), { recursive: true });
    await fs.cp(path.join(tools, 'node_modules/@rollup/wasm-node'), wasmRoot, { recursive: true });
    // Rollup's own official WASM distribution uses this bridge file. The rest of
    // the installed Rollup release remains exact-version original JavaScript.
    await fs.copyFile(path.join(wasmRoot, 'dist/native.js'), path.join(rollupRoot, 'dist/native.js'));
    await fs.cp(path.join(wasmRoot, 'dist/wasm-node'), path.join(rollupRoot, 'dist/wasm-node'), { recursive: true });
  }
  return needed;
}

export async function createAndroidShellInitialization({ file, cwd, nodeExecutable, npmCli }) {
  const lines = [
    'node() { ' + quote(nodeExecutable) + ' "$@"; }',
    'npm() { ' + quote(nodeExecutable) + ' ' + quote(npmCli) + ' "$@"; }',
  ];
  const bins = path.join(cwd, 'node_modules/.bin');
  if (await exists(bins)) {
    for (const name of await fs.readdir(bins)) {
      // Android's mksh accepts hyphenated function names (cross-env/ts-node),
      // while punctuation that could inject shell syntax remains excluded.
      if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name) || name === 'node' || name === 'npm') continue;
      const target = await fs.realpath(path.join(bins, name));
      const content = await fs.readFile(target);
      if (/^#!.*\bnode\b/.test(content.subarray(0, 200).toString())) lines.push(name + '() { ' + quote(nodeExecutable) + ' ' + quote(target) + ' "$@"; }');
    }
  }
  await fs.writeFile(file, lines.join('\n') + '\n');
}
