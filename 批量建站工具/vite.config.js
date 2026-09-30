import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { createAdTemplateApiMiddleware } from './server/ad-template-store.js';

function copyDirectoryContents(source, target) {
  mkdirSync(target, { recursive: true });
  readdirSync(source, { withFileTypes: true }).forEach((entry) => {
    const from = resolve(source, entry.name);
    const to = resolve(target, entry.name);
    if (entry.isDirectory()) copyDirectoryContents(from, to);
    else copyFileSync(from, to);
  });
}

let projectRoot = process.cwd();
let buildOutputDirectory = resolve(projectRoot, 'dist');
let isProductionBuild = false;

// 旧版工作台脚本使用按顺序加载的全局变量，构建时原样复制，避免改变运行语义。
export default defineConfig({
  plugins: [{
    name: 'copy-classic-runtime',
    configResolved(config) {
      projectRoot = config.root;
      buildOutputDirectory = resolve(config.root, config.build.outDir);
      isProductionBuild = config.command === 'build';
    },
    // Keep custom template writes local to this project in both supported Vite servers.
    configureServer(server) {
      server.middlewares.use(createAdTemplateApiMiddleware(resolve(projectRoot, 'public/ad-templates')));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createAdTemplateApiMiddleware(resolve(projectRoot, 'public/ad-templates')));
    },
    closeBundle() {
      // Dev servers and Vitest also close their plugin containers; they must not create build output.
      if (!isProductionBuild) return;
      const source = resolve(projectRoot, 'js');
      if (!existsSync(source)) return;
      const target = resolve(buildOutputDirectory, 'js');
      mkdirSync(target, { recursive: true });
      copyDirectoryContents(source, target);

      // 保留静态服务器直接打开 dist/index.html 时所需的本地 ZIP 解析器。
      const jszipSource = resolve(projectRoot, 'node_modules/jszip/dist/jszip.min.js');
      const jszipTarget = resolve(buildOutputDirectory, 'node_modules/jszip/dist/jszip.min.js');
      if (existsSync(jszipSource)) {
        mkdirSync(resolve(jszipTarget, '..'), { recursive: true });
        copyFileSync(jszipSource, jszipTarget);
      }

      const docsSource = resolve(projectRoot, 'docs');
      if (existsSync(docsSource)) copyDirectoryContents(docsSource, resolve(buildOutputDirectory, 'docs'));

      // 游戏工作流会复用根目录的液态玻璃层；它的 HTML 在 dist 中保持相对路径，
      // 因此发布包也需要保留这一份未打包的共享样式。
      const liquidGlassCssSource = resolve(projectRoot, 'css/liquid-glass.css');
      const liquidGlassCssTarget = resolve(buildOutputDirectory, 'css/liquid-glass.css');
      if (existsSync(liquidGlassCssSource)) {
        mkdirSync(resolve(liquidGlassCssTarget, '..'), { recursive: true });
        copyFileSync(liquidGlassCssSource, liquidGlassCssTarget);
      }

      // 游戏工作流既要能被普通静态服务器直接访问，也要随生产构建发布。
      // 因此其源码放在项目根目录，而不是只由 Vite 映射的 public/ 目录。
      const gameBuilderSource = resolve(projectRoot, 'game-builder');
      if (existsSync(gameBuilderSource)) copyDirectoryContents(gameBuilderSource, resolve(buildOutputDirectory, 'game-builder'));
    }
  }]
});
