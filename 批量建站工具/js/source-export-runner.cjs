'use strict';

// This file is exported inside .sitefoundry-ads. It uses bundled code only,
// so the uploaded project does not acquire a new npm dependency.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DOMParser } = require('./dom.cjs');

function run() {
  const projectRoot = path.resolve(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  if (manifest.schema !== 'sitefoundry-source-ads/v1') throw new Error('无法识别源码广告配置。');
  const outputRoot = path.resolve(projectRoot, manifest.deploymentRoot);
  if (outputRoot === projectRoot || !outputRoot.startsWith(projectRoot + path.sep)) throw new Error('广告构建输出目录必须位于当前工程内部。');
  const realRoot = fs.realpathSync(projectRoot);
  const realOutput = fs.realpathSync(outputRoot);
  if (!realOutput.startsWith(realRoot + path.sep)) throw new Error('构建输出目录链接到了工程之外。');
  const original = new Map();
  function collect(directory, prefix = '') {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix + item.name;
      const filename = path.join(directory, item.name);
      if (item.isSymbolicLink()) throw new Error('广告注入不支持输出目录中的符号链接：' + relative);
      if (item.isDirectory()) collect(filename, relative + '/');
      else if (item.isFile()) original.set(relative, fs.readFileSync(filename));
    }
  }
  collect(outputRoot);
  const runtimeSource = fs.readFileSync(path.join(__dirname, 'ad.js'), 'utf8');
  const context = {
    TextEncoder, TextDecoder, Uint8Array, DOMParser, window: {},
    Generator: { generateAdJs: () => runtimeSource, generateSelectedAdJs: () => runtimeSource }
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, 'planner.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(__dirname, 'restoration.js'), 'utf8') + '\nthis.ads = AdRestoration;', context
  );
  const entries = [...original].map(([filename, bytes]) => ({ path: filename, bytes: new Uint8Array(bytes) }));
  const result = context.ads.injectAdsIntoSiteEntries(entries, manifest.config, manifest.siteName, manifest.policy, manifest.settings);
  if (!result.valid) throw new Error(result.errors.map(error => error.message).join('\n'));
  const verification = manifest.settings.mode === 'fixed'
    ? context.ads.verifyFixedInjectedOutput(result.entries, result.project, manifest.config, manifest.settings, result.changedPages || [])
    : context.ads.verifyInjectedOutput(result.entries, result.project, manifest.config, manifest.policy, result.changedPages || [], manifest.settings);
  if (!verification.valid) throw new Error(verification.errors.map(error => error.message).join('\n'));
  // Validate the whole batch before changing any generated file.
  for (const entry of result.entries) {
    const target = path.resolve(outputRoot, entry.path);
    if (!target.startsWith(outputRoot + path.sep)) throw new Error('广告注入文件路径越过了输出目录。');
  }
  for (const entry of result.entries) {
    const bytes = Buffer.from(entry.bytes);
    if (original.has(entry.path) && original.get(entry.path).equals(bytes)) continue;
    const target = path.resolve(outputRoot, entry.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  console.log('[SiteFoundry Ads] 已向 ' + manifest.deploymentRoot + ' 注入广告，核验 ' + verification.checkedPages.length + ' 个页面。');
  const warnings = (result.warnings || []).filter(warning => warning.code !== 'RESTORE_AD_JS_CREATE');
  if (warnings.length) console.log(warnings.map(warning => warning.message).join('\n'));
}

try { run(); } catch (error) {
  console.error('[SiteFoundry Ads] 广告注入失败：' + error.message);
  process.exitCode = 1;
}
