import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validateManifest } from '../template-system/registry.js';

/**
 * Create a complete package in a new directory. The caller supplies the root so
 * tests can exercise real filesystem behavior without adding test templates to
 * the user's catalog. Existing directories are never merged or overwritten.
 */
export async function createTemplate({ directory, id, name, domainId = 'tech', baseLayout = 'portal-topic-matrix' }) {
  const manifest = validateManifest({
    schemaVersion: 1, id, name, version: '1.0.0', domainId,
    description: name + ' · 独立资讯模板', icon: '▤', baseLayout,
    structure: { cardColumns: '3', detailLayout: 'single' },
    style: { selectedStyle: 'minimal', fontStyle: 'clean', cardBorder: 'thin', cardRadius: '0', cardViewMode: 'card', animationEnter: 'none' }
  });
  const folder = resolve(directory, manifest.id);
  const files = {
    'template.json': JSON.stringify(manifest, null, 2) + '\n',
    'home.js': '/** Home content only; keep the inherited grid and advertising gaps. */\nexport const rules = [\n  { selector: ".tpl-sections .card-title", declarations: { "line-height": "1.3" } }\n];\n',
    'detail.js': '/** Paragraph leaves only; the article wrapper may contain advertising. */\nexport const rules = [\n  { selector: ".detail-content > p", declarations: { "line-height": "1.8" } }\n];\n',
    'all.js': '/** List content only; advertising still spans the original grid row. */\nexport const rules = [\n  { selector: "#all-articles .card-title", declarations: { "line-height": "1.3" } }\n];\n',
    'thumbnail.svg': '<svg class="template-wireframe" viewBox="0 0 160 100" fill="currentColor" aria-hidden="true"><path d="M8 10h144v4H8zM8 28h60v4H8zM8 44h44v40H8zM58 44h44v40H58zM108 44h44v40h-44z" opacity=".4"/></svg>\n',
    'README.md': '# ' + manifest.name + '\n\n生成命令已建立首页、详情页、列表页样式与配置。先查看 docs/template-packages.md，再修改本目录。\n\n广告逻辑由现有生成器负责；模板不得添加广告配置或容器。修改后运行 npm run templates:build。\n'
  };
  await mkdir(directory, { recursive: true });
  await mkdir(folder); // EEXIST is intentional: never replace a developer's work.
  for (const [filename, contents] of Object.entries(files)) {
    await writeFile(resolve(folder, filename), contents, { encoding: 'utf8', flag: 'wx' });
  }
  return folder;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2 || args.includes('--help')) {
    console.log('Usage: npm run template:new -- <id> "模板名称" [--domain tech] [--base-layout portal-topic-matrix]');
    return;
  }
  const [id, name, ...options] = args;
  const settings = {};
  for (let index = 0; index < options.length; index += 2) {
    const key = options[index];
    if (!['--domain', '--base-layout'].includes(key) || !options[index + 1]) throw new Error('Unknown or incomplete option: ' + key);
    settings[key] = options[index + 1];
  }
  const appRoot = fileURLToPath(new URL('../', import.meta.url));
  const folder = await createTemplate({ directory: resolve(appRoot, 'templates'), id, name,
    domainId: settings['--domain'] || 'tech', baseLayout: settings['--base-layout'] || 'portal-topic-matrix' });
  console.log('Created template package: ' + folder);
  const result = spawnSync(process.execPath, [resolve(appRoot, 'scripts/build-template-packages.mjs')], { cwd: appRoot, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Package created but registration failed. Fix the package, then run npm run templates:build.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
