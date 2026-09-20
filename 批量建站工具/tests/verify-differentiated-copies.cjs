const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const sharedBuilder = fs.readFileSync(path.resolve(projectRoot, '../shared/differentiated-builder.js'), 'utf8');
const primaryBuilder = fs.readFileSync(path.join(projectRoot, 'js/differentiated-builder.js'), 'utf8');
const gameBuilder = fs.readFileSync(path.join(projectRoot, 'game-builder/js/differentiated-builder.js'), 'utf8');
const gameApp = fs.readFileSync(path.join(projectRoot, 'game-builder/js/app.js'), 'utf8');
const gameIndex = fs.readFileSync(path.join(projectRoot, 'game-builder/index.html'), 'utf8');

assert.equal(primaryBuilder, sharedBuilder, '主工具必须使用共享的差异化建站引擎。');
assert.equal(gameBuilder, sharedBuilder, '已迁移游戏工具必须使用共享的差异化建站引擎。');
assert.match(gameApp, /REQUIRED_DIFFERENTIATED_BUILDER_VERSION\s*=\s*'20260914-template-library-13'/);
assert.match(gameApp, /DifferentiatedBuilder\.BUILD_VERSION\s*!==\s*REQUIRED_DIFFERENTIATED_BUILDER_VERSION/);
assert.match(gameIndex, /js\/differentiated-builder\.js\?v=/);
assert.match(gameIndex, /js\/app\.js\?v=/);

console.log('Differentiated builder copies verified.');
