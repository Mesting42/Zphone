import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
const traverse = traverseModule.default || traverseModule;
const encoder = new TextEncoder(), decoder = new TextDecoder();
const directory = '.sitefoundry-fonts/';

/** Deliberately bounded AST conversion. Unknown families, dynamic options and
 * unsupported subsets fail with a concrete message; never silently substitute
 * a different font or announce that an unconverted project is offline-ready. */
function literal(node) {
  if (t.isStringLiteral(node) || t.isBooleanLiteral(node) || t.isNumericLiteral(node)) return node.value;
  if (t.isArrayExpression(node)) return node.elements.map(literal);
  throw new Error('离线字体转换要求使用静态字体选项。');
}
function relative(from, to) {
  const parts = from.split('/'); parts.pop(); const target = to.split('/');
  while (parts.length && target.length && parts[0] === target[0]) { parts.shift(); target.shift(); }
  return (parts.length ? '../'.repeat(parts.length) : './') + target.join('/');
}
function latinFaces(assets, options) {
  const faces = new Map();
  for (const match of assets.css.matchAll(/@font-face\s*\{([^}]+)\}/g)) {
    const block = match[1];
    // The bundled Google CSS has independently subsetted WOFF2 files. Next's
    // local API cannot express unicode-range; only its Latin face is eligible.
    if (!/unicode-range\s*:\s*U\+0000-00FF/i.test(block)) continue;
    const filename = /url\(([^)]+)\)/.exec(block)?.[1].replace(/["']/g, '');
    const style = /font-style:\s*([^;]+)/.exec(block)?.[1].trim() || 'normal';
    const weight = /font-weight:\s*([^;]+)/.exec(block)?.[1].trim() || '400';
    if (!filename) continue;
    const path = assets.license.split('/').slice(0, -1).join('/') + '/' + filename;
    if (!assets.files.some(file => file.path === path)) throw new Error('本地字体 CSS 引用了未打包文件：' + path);
    const key = path + ':' + style;
    const face = faces.get(key) || { path, style, weights: new Set() };
    face.weights.add(Number(weight)); faces.set(key, face);
  }
  const requestedStyles = [].concat(options.style || 'normal');
  const requestedWeights = options.weight ? [].concat(options.weight).map(Number) : null;
  const result = [];
  for (const face of faces.values()) {
    if (!requestedStyles.includes(face.style)) continue;
    const weights = [...face.weights].sort((a,b) => a-b);
    const selected = requestedWeights || weights;
    if (selected.some(weight => !weights.includes(weight))) continue;
    result.push({ path: face.path, style: face.style, weight: selected.length === 1 ? String(selected[0]) : selected[0] + ' ' + selected.at(-1) });
  }
  if (!result.length || requestedStyles.some(style => !result.some(face => face.style === style))) throw new Error('本地字体未覆盖请求的样式或字重：' + assets.family);
  return result;
}

export async function localizeNextFonts(files, loadFamily = name => {
  if (!globalThis.OfflineFonts?.familyAssets) throw new Error('本地字体模块未就绪，请刷新工具。');
  return globalThis.OfflineFonts.familyAssets(name);
}) {
  const converted = [], assetCache = new Map();
  const load = name => {
    if (!assetCache.has(name)) assetCache.set(name, loadFamily(name));
    return assetCache.get(name);
  };
  const plans = [];
  for (const entry of files.values()) {
    if (!/\.[cm]?[jt]sx?$/.test(entry.path) || /^(?:out|dist|build|node_modules|\.next)\//.test(entry.path)) continue;
    const source = decoder.decode(entry.bytes);
    if (!source.includes('next/font/google')) continue;
    const ast = parse(source, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript'] });
    const imports = [];
    traverse(ast, { ImportDeclaration(path) { if (path.node.source.value === 'next/font/google') imports.push(path); } });
    if (!imports.length) throw new Error('不支持的 Google 字体加载方式：' + entry.path);
    const edits = [];
    for (const declaration of imports) {
      const local = declaration.scope.generateUidIdentifier('sitefoundryLocalFont').name;
      for (const specifier of declaration.node.specifiers) {
        if (!t.isImportSpecifier(specifier)) throw new Error('不支持的 Google 字体导入方式：' + entry.path);
        const family = (specifier.imported.name || specifier.imported.value).replaceAll('_', ' ');
        const binding = declaration.scope.getBinding(specifier.local.name);
        for (const reference of binding.referencePaths) {
          const call = reference.parentPath.node;
          if (!t.isCallExpression(call) || call.callee !== reference.node || call.arguments.length !== 1 || !t.isObjectExpression(call.arguments[0])) throw new Error('不支持的字体调用：' + family + '（' + entry.path + '）');
          const options = {}, preserved = [];
          for (const property of call.arguments[0].properties) {
            if (!t.isObjectProperty(property) || property.computed) throw new Error('不支持的动态字体选项：' + entry.path);
            const key = property.key.name || property.key.value;
            options[key] = literal(property.value);
            if (!['subsets', 'weight', 'style', 'adjustFontFallback'].includes(key)) {
              if (!['variable', 'display', 'fallback', 'preload'].includes(key)) throw new Error('不支持的字体选项：' + key);
              preserved.push(source.slice(property.start, property.end));
            }
          }
          if (options.subsets && options.subsets.some(subset => subset !== 'latin')) throw new Error('当前离线源码字体转换仅支持 latin 字符子集：' + family);
          const assets = await load(family), faces = latinFaces(assets, options);
          const src = faces.map(face => ({ path: relative(entry.path, directory + face.path), style: face.style, weight: face.weight }));
          // Next's font SWC transform requires identifier property keys, even
          // though quoted JSON keys are otherwise valid JavaScript. Serialize
          // trusted keys as identifiers and keep all path values JSON-escaped.
          const srcCode = '[' + src.map(face => '{ path: ' + JSON.stringify(face.path) + ', style: ' + JSON.stringify(face.style) + ', weight: ' + JSON.stringify(face.weight) + ' }').join(', ') + ']';
          if (options.adjustFontFallback !== undefined) preserved.push('adjustFontFallback: ' + JSON.stringify(options.adjustFontFallback === true ? 'Arial' : options.adjustFontFallback));
          edits.push({ start: call.start, end: call.end, value: local + '({ src: ' + srcCode + (preserved.length ? ', ' + preserved.join(', ') : '') + ' })' });
          converted.push({ source: entry.path, family, originalImport: specifier.local.name, subsets: ['latin'], faces: src });
        }
      }
      edits.push({ start: declaration.node.start, end: declaration.node.end, value: 'import ' + local + ' from "next/font/local";' });
    }
    let transformed = source;
    for (const edit of edits.sort((a,b) => b.start-a.start)) transformed = transformed.slice(0,edit.start) + edit.value + transformed.slice(edit.end);
    plans.push({ path: entry.path, bytes: encoder.encode(transformed) });
  }
  if (!converted.length) return [];
  // Validate collisions before applying any edit. The caller owns an export
  // copy, but a pre-existing user directory still must not be overwritten.
  if ([...files.keys()].some(path => path.startsWith(directory))) throw new Error('源码已有 .sitefoundry-fonts 目录；请确认来源或重命名后再导出。');
  for (const [name, pending] of assetCache) {
    const assets = await pending;
    for (const file of assets.files) plans.push({ path: directory + file.path, bytes: file.bytes });
    // Next copies public/ into its static output. Keep the font license in that
    // deployable output as well as beside the editable source font binaries.
    const license = assets.files.find(file => file.path === assets.license);
    if (!license) throw new Error('本地字体许可证缺失：' + name);
    const publicLicense = 'public/sitefoundry-fonts/' + assets.license;
    if (files.has(publicLicense)) throw new Error('源码已有字体许可证文件：' + publicLicense);
    plans.push({ path: publicLicense, bytes: license.bytes });
  }
  plans.push({ path: directory + 'manifest.json', bytes: encoder.encode(JSON.stringify({ schema: 'sitefoundry-next-offline-fonts/v1', conversions: converted, note: 'Fonts are bundled locally. Project dependencies must already be installed for an offline build.' }, null, 2)) });
  for (const entry of plans) files.set(entry.path, entry);
  return converted;
}
