import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { build } from 'esbuild';
import { createAdTemplateApiMiddleware } from './server/ad-template-store.js';
import { offlineFontHeaders } from './server/offline-assets.js';

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
  // Android 10 remains supported with a WebView that offers the scoped native
  // message bridge. Transform modern syntax instead of requiring new Android.
  build: { target: 'chrome85' },
  test: {
    // Only maintained tests belong to the suite. Recoverable source snapshots
    // under coverage must not be discovered and executed as a second test tree.
    include: ['tests/**/*.{test,spec}.?(c|m)[jt]s?(x)']
  },
  server: {
    watch: {
      // 回归导出的 HTML 和源码构建产物不属于工作台源码。监听这些证据
      // 会触发全页刷新并清空已上传数据，因此统一排除 coverage 目录。
      ignored: ['**/coverage/**']
    }
  },
  plugins: [{
    name: 'copy-classic-runtime',
    configResolved(config) {
      projectRoot = config.root;
      buildOutputDirectory = resolve(config.root, config.build.outDir);
      isProductionBuild = config.command === 'build';
    },
    // Keep custom template writes local to this project in both supported Vite servers.
    configureServer(server) {
      server.middlewares.use(offlineFontHeaders);
      server.middlewares.use(createAdTemplateApiMiddleware(resolve(projectRoot, 'public/ad-templates')));
    },
    configurePreviewServer(server) {
      server.middlewares.use(offlineFontHeaders);
      server.middlewares.use(createAdTemplateApiMiddleware(resolve(projectRoot, 'public/ad-templates')));
    },
    async closeBundle() {
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

      // Copied game HTML retains relative paths to shared workbench styles. Keep
      // originals alongside Vite's bundled CSS so static production works.
      // 游戏端导出页也引用共用导出样式，随经典 HTML 一并保留原路径。
      for (const stylesheet of ['liquid-glass.css', 'config-disclosures.css', 'export-page.css', 'workbench-brand.css', 'offline-status.css', 'native-app.css']) {
        const sourceStylesheet = resolve(projectRoot, 'css', stylesheet);
        const targetStylesheet = resolve(buildOutputDirectory, 'css', stylesheet);
        if (existsSync(sourceStylesheet)) {
          mkdirSync(resolve(targetStylesheet, '..'), { recursive: true });
          copyFileSync(sourceStylesheet, targetStylesheet);
        }
      }

      // The game workbench is copied as classic HTML, so its relative brand
      // references need the original filenames alongside Vite's hashed assets.
      // Copy only workbench identity files, keeping unrelated source assets out.
      for (const brandAsset of ['sitefoundry-logo.svg', 'sitefoundry-icon.svg', 'sitefoundry-icon-32.png', 'sitefoundry.ico', 'sitefoundry-apple-touch.png']) {
        const sourceBrandAsset = resolve(projectRoot, 'assets', brandAsset);
        const targetBrandAsset = resolve(buildOutputDirectory, 'assets', brandAsset);
        if (existsSync(sourceBrandAsset)) {
          mkdirSync(resolve(targetBrandAsset, '..'), { recursive: true });
          copyFileSync(sourceBrandAsset, targetBrandAsset);
        }
      }

      // 游戏工作流既要能被普通静态服务器直接访问，也要随生产构建发布。
      // 因此其源码放在项目根目录，而不是只由 Vite 映射的 public/ 目录。
      const gameBuilderSource = resolve(projectRoot, 'game-builder');
      if (existsSync(gameBuilderSource)) copyDirectoryContents(gameBuilderSource, resolve(buildOutputDirectory, 'game-builder'));

      // Copied game HTML needs a browser-ready entry, because unlike the main
      // Vite HTML it cannot resolve the shared Babel parser's bare npm import.
      await build({ entryPoints: [resolve(projectRoot, 'js/native-app-init.js')], outfile: resolve(buildOutputDirectory, 'js/native-app-init.js'), bundle: true, platform: 'browser', format: 'esm', target: 'chrome85' });

      // Ship the local template API with the static UI. Bundle its parser now,
      // so the offline distribution needs neither node_modules nor npm install.
      await build({ entryPoints: [resolve(projectRoot, 'server/offline-entry.mjs')], outfile: resolve(buildOutputDirectory, 'sitefoundry-server.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node20' });
      copyFileSync(resolve(projectRoot, 'scripts/start-sitefoundry.cmd'), resolve(buildOutputDirectory, 'start-sitefoundry.cmd'));
    }
  }]
});
