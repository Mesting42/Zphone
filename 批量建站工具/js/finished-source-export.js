import restorationSource from './ad-restoration.js?raw';
import plannerSource from './finished-site-ads.js?raw';
import runnerSource from './source-export-runner.cjs?raw';
import domSource from './source-export-dom.cjs?raw';
import domLicense from './source-export-dom.LICENSE.txt?raw';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const directory = '.sitefoundry-ads/';
const hook = 'node ' + directory + 'inject.cjs';

function normalized(value) { return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, ''); }
function bytes(entry) { return entry.bytes || encoder.encode(entry.text || entry.content || ''); }
function text(entry) { return decoder.decode(bytes(entry)); }

export function createFinishedSourceExport({ sourceEntries, injectedEntries, deploymentRoot, config, policy, settings, siteName, project }) {
  const originals = Array.from(sourceEntries || []);
  if (!originals.length) throw new Error('原源码文件不可用，请重新上传完整源码压缩包。');
  const root = normalized(deploymentRoot || '').replace(/\/?$/, '/').replace(/^\/$/, '');
  if (root.split('/').includes('..')) throw new Error('源码中的构建输出目录无效。');
  const files = new Map(originals.map(entry => [normalized(entry.path), { path: normalized(entry.path), bytes: bytes(entry) }]));
  const react = project && project.kind === 'react-source';
  for (const entry of injectedEntries || []) {
    const filename = (react ? '' : root) + normalized(entry.path);
    files.set(filename, { path: filename, bytes: bytes(entry) });
  }
  let buildCommand = project && project.buildCommand || '';
  let buildHook = '';
  if (!react && !root && files.has('package.json')) {
    const pkg = JSON.parse(text(files.get('package.json')));
    if (pkg.scripts && pkg.scripts.build) throw new Error('该工程的构建输出位于源码根目录，无法安全自动注入；请将构建输出设为 dist 等独立目录，或选择静态站点副本。');
  }
  if (!react && root && files.has('package.json')) {
    const pkg = JSON.parse(text(files.get('package.json')));
    if (!pkg.scripts || !pkg.scripts.build) throw new Error('源码工程没有 scripts.build，无法保证重新构建后保留广告。');
    const existing = files.get(directory + 'config.json');
    let previous;
    if (existing) {
      try { previous = JSON.parse(text(existing)); } catch {}
      if (!previous || previous.schema !== 'sitefoundry-source-ads/v1') throw new Error('源码已有同名广告辅助目录，请先重命名 .sitefoundry-ads。');
    } else if ([...files.keys()].some(filename => filename.startsWith(directory))) {
      throw new Error('源码已有同名目录 .sitefoundry-ads，请先重命名该目录。');
    }
    const previousPostbuild = previous && pkg.scripts.postbuild === previous.installedPostbuild
      ? previous.originalPostbuild : String(pkg.scripts.postbuild || '');
    const installedPostbuild = previousPostbuild ? previousPostbuild + ' && ' + hook : hook;
    pkg.scripts.postbuild = installedPostbuild;
    const runtime = files.get(root + 'js/ad.js');
    if (!runtime) throw new Error('源码导出缺少已生成的广告脚本。');
    const manifest = {
      schema: 'sitefoundry-source-ads/v1', siteName, deploymentRoot: root.replace(/\/$/, ''),
      config, policy, settings: { mode: settings.mode, version: settings.version, policy },
      originalPostbuild: previousPostbuild, installedPostbuild
    };
    const added = {
      'config.json': JSON.stringify(manifest, null, 2) + '\n', 'inject.cjs': runnerSource,
      'restoration.js': restorationSource, 'planner.js': plannerSource, 'dom.cjs': domSource,
      'source-export-dom.LICENSE.txt': domLicense, 'ad.js': text(runtime)
    };
    files.set('package.json', { path: 'package.json', bytes: encoder.encode(JSON.stringify(pkg, null, 2) + '\n') });
    for (const [filename, content] of Object.entries(added)) files.set(directory + filename, { path: directory + filename, bytes: encoder.encode(content) });
    buildCommand = 'npm run build';
    buildHook = directory + 'inject.cjs';
  } else if (!react && root && originals.some(entry => /(?:^|\/)(?:src|scripts)\//i.test(entry.path))) {
    throw new Error('未识别到可自动接入广告的构建命令，请上传包含 package.json 和 scripts.build 的完整工程，或选择静态站点副本。');
  }
  const instructionPath = '广告源码使用说明.txt';
  if (!files.has(instructionPath)) {
    const instructions = [
      '本目录是加入广告后的源码副本，原上传文件保持不变。',
      '广告版本：' + settings.version,
      react ? '请按原工程说明安装依赖并执行生产构建，广告组件和 public/js/ad.js 已加入源码。'
        : buildHook ? '运行 npm run build 后会自动向 ' + root + ' 重新加入广告；部署该输出目录中的内容。'
          : '本工程是直接编写 HTML 的静态站点，广告已加入页面和 js/ad.js，可继续修改页面并部署。',
      buildHook ? '广告路径和位置策略保存于 ' + directory + 'config.json；注入脚本已自带所需代码，无需新增 npm 依赖。' : '',
      'ZIP 内的原工程文件均已保留；修改源码后请重新核验页面和广告位。'
    ].filter(Boolean).join('\r\n') + '\r\n';
    files.set(instructionPath, { path: instructionPath, bytes: encoder.encode(instructions) });
  }
  for (const entry of originals) if (!files.has(normalized(entry.path))) throw new Error('源码导出丢失原文件：' + entry.path);
  return {
    entries: [...files.values()], runtimePath: react ? 'public/js/ad.js' : root + 'js/ad.js',
    buildCommand, buildHook, exportScope: react ? '已注入广告的完整 React 源码（需要在项目环境构建）' : '已注入广告的完整原源码'
  };
}
