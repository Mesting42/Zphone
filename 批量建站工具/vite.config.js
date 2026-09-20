import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

function copyDirectoryContents(source, target) {
  mkdirSync(target, { recursive: true });
  readdirSync(source, { withFileTypes: true }).forEach((entry) => {
    const from = resolve(source, entry.name);
    const to = resolve(target, entry.name);
    if (entry.isDirectory()) copyDirectoryContents(from, to);
    else copyFileSync(from, to);
  });
}

// 旧版工作台脚本使用按顺序加载的全局变量，构建时原样复制，避免改变运行语义。
export default defineConfig({
  plugins: [{
    name: 'copy-classic-runtime',
    closeBundle() {
      const source = resolve('js');
      if (!existsSync(source)) return;
      const target = resolve('dist/js');
      mkdirSync(target, { recursive: true });
      copyDirectoryContents(source, target);

      // 保留静态服务器直接打开 dist/index.html 时所需的本地 ZIP 解析器。
      const jszipSource = resolve('node_modules/jszip/dist/jszip.min.js');
      const jszipTarget = resolve('dist/node_modules/jszip/dist/jszip.min.js');
      if (existsSync(jszipSource)) {
        mkdirSync(resolve(jszipTarget, '..'), { recursive: true });
        copyFileSync(jszipSource, jszipTarget);
      }

      const docsSource = resolve('docs');
      if (existsSync(docsSource)) copyDirectoryContents(docsSource, resolve('dist/docs'));

      // 游戏工作流会复用根目录的液态玻璃层；它的 HTML 在 dist 中保持相对路径，
      // 因此发布包也需要保留这一份未打包的共享样式。
      const liquidGlassCssSource = resolve('css/liquid-glass.css');
      const liquidGlassCssTarget = resolve('dist/css/liquid-glass.css');
      if (existsSync(liquidGlassCssSource)) {
        mkdirSync(resolve(liquidGlassCssTarget, '..'), { recursive: true });
        copyFileSync(liquidGlassCssSource, liquidGlassCssTarget);
      }

      // 游戏工作流既要能被普通静态服务器直接访问，也要随生产构建发布。
      // 因此其源码放在项目根目录，而不是只由 Vite 映射的 public/ 目录。
      const gameBuilderSource = resolve('game-builder');
      if (existsSync(gameBuilderSource)) copyDirectoryContents(gameBuilderSource, resolve('dist/game-builder'));
    }
  }]
});
