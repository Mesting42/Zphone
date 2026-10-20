import { spawn } from 'node:child_process';
import { access, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const executable = process.env.SITEFOUNDRY_SMOKE_EXECUTABLE || join(appRoot, 'release/win-unpacked/SiteFoundry.exe');
const evidence = process.env.SITEFOUNDRY_SMOKE_OUTPUT_DIR || resolve(appRoot, '../../coverage/apps-20261013/windows');
await access(executable);
await mkdir(evidence, { recursive: true });
const importDirectory = join(evidence, 'directory-input');
await mkdir(join(importDirectory, 'assets'), { recursive: true });
await writeFile(join(importDirectory, 'index.html'), '<!doctype html><title>Native directory</title>');
await writeFile(join(importDirectory, 'assets/style.css'), 'body{color:#246fdf}');
let buildProof;
try { buildProof = JSON.parse(await readFile(resolve(appRoot, '../../coverage/apps-20261013/windows-build/next-offline-build.json'), 'utf8')); } catch {}
let sourceZip = '';
if (process.argv.includes('--ui-build')) {
  const sourceDirectory = resolve(appRoot, '../../coverage/offline-fixes-20261013/offline/finished-source-build');
  const sourceStage = join(evidence, 'source-input');
  await cp(sourceDirectory, sourceStage, { recursive: true, filter: path => !path.split(/[\\/]/).some(segment => ['node_modules', '.next', 'out', '.git'].includes(segment)) });
  sourceZip = join(evidence, 'PixelWire-Next-UI.zip');
  const { createArtifactZip } = await import('../../build-runtime/zip.mjs');
  await createArtifactZip(sourceStage, sourceZip);
}
for (let attempt = 1; attempt <= 2; attempt += 1) {
  const reportPath = join(evidence, `launch-${attempt}.json`);
  const result = await new Promise((complete, fail) => {
    const child = spawn(executable, [], {
      cwd: dirname(executable), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env, SITEFOUNDRY_SMOKE_REPORT: reportPath,
        SITEFOUNDRY_SMOKE_EXPORT_DIR: join(evidence, 'native-exports'),
        SITEFOUNDRY_SMOKE_DATA_DIR: buildProof?.ok ? resolve(appRoot, '../../coverage/apps-20261013/windows-build/profile') : join(evidence, 'profile'),
        SITEFOUNDRY_SMOKE_TASK_ID: buildProof?.ok ? buildProof.build.id : '',
        SITEFOUNDRY_SMOKE_IMPORT_DIR: importDirectory,
        SITEFOUNDRY_SMOKE_EXPECT_PERSISTENCE: attempt === 2 ? '1' : '0',
        SITEFOUNDRY_SMOKE_SOURCE_ZIP: sourceZip,
        SITEFOUNDRY_SMOKE_UI_BUILD: sourceZip && attempt === 1 ? '1' : '0'
      }
    });
    let output = '';
    child.stdout.on('data', bytes => output += bytes);
    child.stderr.on('data', bytes => output += bytes);
    child.once('error', fail);
    child.once('exit', code => complete({ code, output }));
    const timeout = setTimeout(() => { child.kill(); fail(new Error('Packaged Windows app did not finish its smoke checks within the bounded task time.')); }, sourceZip ? 600000 : 120000);
    child.once('exit', () => clearTimeout(timeout));
  });
  if (result.code !== 0) throw new Error('Windows launch failed: ' + result.output + '\n' + await readFile(reportPath, 'utf8').catch(() => '(no report)'));
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  if (!report.ok) throw new Error('Windows smoke failed: ' + report.error);
  console.log(`Windows packaged launch ${attempt}: ${report.checks.length} checks passed; ${report.title}`);
}
