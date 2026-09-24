import { describe, expect, it } from 'vitest';
import { previewBuildPlan, runVirtualPreviewBuild } from '../js/ad-injection-preview-builder.js';

const encoder = new TextEncoder();
const entry = (path, value) => ({ path, bytes: typeof value === 'string' ? encoder.encode(value) : value });

describe('finished-site source preview builder', () => {
  it('recognizes Node-based static generators without treating Vite source as already built', () => {
    const staticEntries = [
      entry('site/package.json', JSON.stringify({ scripts: { build: 'node scripts/build.mjs' } })),
      entry('site/scripts/build.mjs', 'await Promise.resolve();'),
    ];
    const reactEntries = [
      entry('package.json', JSON.stringify({ scripts: { build: 'vite build' } })),
      entry('src/main.jsx', 'export default null;'),
    ];
    const rootStaticEntries = [
      entry('package.json', JSON.stringify({ scripts: { build: 'node scripts/build.mjs' } })),
      entry('scripts/build.mjs', 'await Promise.resolve();'),
    ];

    expect(previewBuildPlan(staticEntries)).toMatchObject({ projectRoot: 'site/', buildPath: 'site/scripts/build.mjs' });
    expect(previewBuildPlan(rootStaticEntries)).toMatchObject({ projectRoot: '', buildPath: 'scripts/build.mjs' });
    expect(previewBuildPlan(reactEntries)).toBeNull();
  });

  it('runs a self-contained static generator against a virtual file tree and returns only preview output', async () => {
    const entries = [
      entry('approved/package.json', JSON.stringify({ scripts: { build: 'node scripts/build.mjs' } })),
      entry('approved/source/data.js', 'export const title = "Approved Site";'),
      entry('approved/source/assets/cover.png', new Uint8Array([1, 2, 3, 4])),
      entry('approved/scripts/build.mjs', [
        'import { cp, mkdir, writeFile } from "node:fs/promises";',
        'import { dirname, join } from "node:path";',
        'import { fileURLToPath } from "node:url";',
        'import { title } from "../source/data.js";',
        'const root = join(dirname(fileURLToPath(import.meta.url)), "..");',
        'const dist = join(root, "dist");',
        'await mkdir(dist, { recursive: true });',
        'await cp(join(root, "source/assets"), join(dist, "assets"), { recursive: true });',
        'await writeFile(join(dist, "index.html"), `<!doctype html><h1>${title}</h1><img src="assets/cover.png">`, "utf8");',
      ].join('\n')),
    ];

    const plan = previewBuildPlan(entries);
    const result = await runVirtualPreviewBuild({ plan, entries, env: {} });
    const paths = result.entries.map((item) => item.path);
    const html = new TextDecoder().decode(result.entries.find((item) => item.path.endsWith('dist/index.html')).bytes);

    expect(result.entryPath).toBe('approved/dist/index.html');
    expect(paths).toContain('approved/dist/assets/cover.png');
    expect(paths).not.toContain('approved/source/data.js');
    expect(html).toContain('<h1>Approved Site</h1>');
  });

  it('supports sync fs, crypto cache versions, and dynamic local modules used by static generators', async () => {
    const entries = [
      entry('package.json', JSON.stringify({ scripts: { build: 'node scripts/build.mjs' } })),
      entry('data/article.js', 'export default { title: "Healthy Preview" };'),
      entry('src/style.css', 'body { color: green; }'),
      entry('scripts/build.mjs', [
        'import fs from "node:fs";',
        'import path from "node:path";',
        'import crypto from "node:crypto";',
        'import { fileURLToPath, pathToFileURL } from "node:url";',
        'const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));',
        'const article = (await import(pathToFileURL(path.join(root, "data/article.js")).href)).default;',
        'const version = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "src/style.css"))).digest("hex").slice(0, 8);',
        'const dist = path.join(root, "dist");',
        'fs.rmSync(dist, { recursive: true, force: true });',
        'fs.mkdirSync(dist, { recursive: true });',
        'fs.copyFileSync(path.join(root, "src/style.css"), path.join(dist, "style.css"));',
        'fs.writeFileSync(path.join(dist, "index.html"), `<h1>${article.title}</h1><link rel="stylesheet" href="style.css?v=${version}">`);',
      ].join('\n')),
    ];

    const plan = previewBuildPlan(entries);
    const result = await runVirtualPreviewBuild({ plan, entries, env: {} });
    const html = new TextDecoder().decode(result.entries.find((item) => item.path === 'dist/index.html').bytes);

    expect(result.entryPath).toBe('dist/index.html');
    expect(result.entries.map((item) => item.path)).toContain('dist/style.css');
    expect(html).toMatch(/Healthy Preview/);
    expect(html).toMatch(/style\.css\?v=[0-9a-f]{8}/);
  });
});
