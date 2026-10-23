import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { installSourceBuildHook } from '../js/react-source-build-hook.js';
import { injectReactSource } from '../js/react-source-ad-injector.js';

const encoder = new TextEncoder(), decoder = new TextDecoder();
const entry = (path, text) => ({ path, bytes: encoder.encode(text) });
const text = (entries, path) => decoder.decode(entries.find(e => e.path === path).bytes);
const html = '<!doctype html><html><head><title>Build fixture</title></head><body><main>Source content</main><footer>Footer</footer></body></html>';
const hookPath = 'scripts/sitefoundry-inject-built-ads.mjs';

/** Execute the actual exported lifecycle, rather than asserting the hook's
 * implementation text. Every fixture is retained under coverage as evidence. */
async function materialize(entries) {
    const parent = resolve('coverage/source-build-hook-tests'); await mkdir(parent, { recursive: true });
    const directory = await mkdtemp(join(parent, 'case-'));
    for (const file of entries) { const target = join(directory, file.path); await mkdir(resolve(target, '..'), { recursive: true }); await writeFile(target, file.bytes); }
    return directory;
}
function build(directory) {
    const npm = process.env.npm_execpath;
    if (!npm) throw new Error('Run these tests through npm/npx so npm_execpath identifies the real lifecycle runner.');
    return execFileSync(process.execPath, [npm, 'run', 'build'], { cwd: directory, encoding: 'utf8', timeout: 15000 });
}

describe('exported React build advertising retention', () => {
    it('repairs a multistage build after its existing postbuild, without changing build commands or dependencies', async () => {
        const pkg = { scripts: { build: 'node build.mjs', postbuild: 'node original-postbuild.cjs' }, dependencies: { react: '19.0.0' } };
        const entries = [entry('package.json', JSON.stringify(pkg)), entry('public/js/ad.js', 'window.fixtureAdvertising=true;'),
            entry('build.mjs', `import fs from 'node:fs/promises';await fs.mkdir('dist/articles/guide',{recursive:true});await fs.mkdir('dist/privacy',{recursive:true});await fs.mkdir('dist/.site-build/backups',{recursive:true});await fs.writeFile('dist/index.html',${JSON.stringify(html)});await fs.writeFile('dist/articles/guide/index.html',${JSON.stringify(html)});await fs.writeFile('dist/privacy/index.html',${JSON.stringify(html)});await fs.writeFile('dist/.site-build/backups/index.html',${JSON.stringify(html)});`),
            entry('original-postbuild.cjs', "require('node:fs').writeFileSync('original-postbuild-ran.txt','yes');")];
        expect(installSourceBuildHook(entries, { previewEntryPath: 'dist/index.html' }).valid).toBe(true);
        const changed = JSON.parse(text(entries, 'package.json')); expect(changed.scripts.build).toBe(pkg.scripts.build); expect(changed.dependencies).toEqual(pkg.dependencies);
        const directory = await materialize(entries); build(directory);
        expect(await readFile(join(directory, 'original-postbuild-ran.txt'), 'utf8')).toBe('yes');
        expect(await readFile(join(directory, 'dist/js/ad.js'), 'utf8')).toBe('window.fixtureAdvertising=true;');
        expect(await readFile(join(directory, 'dist/index.html'), 'utf8')).toContain('src="js/ad.js"');
        expect(await readFile(join(directory, 'dist/articles/guide/index.html'), 'utf8')).toContain('src="../../js/ad.js"');
        expect(await readFile(join(directory, 'dist/privacy/index.html'), 'utf8')).toBe(html);
        expect(await readFile(join(directory, 'dist/.site-build/backups/index.html'), 'utf8')).toBe(html);
        build(directory); expect((await readFile(join(directory, 'dist/index.html'), 'utf8')).match(/data-sitefoundry-ad-runtime="loader"/g)).toHaveLength(1);
    });

    it('honors a custom output and leaves embedded visualization documents unchanged', async () => {
        const embedded = html.replace('Source content', 'Embedded scene');
        const entries = [entry('package.json', JSON.stringify({ scripts: { build: 'node build.mjs' } })), entry('public/js/ad.js', 'window.runtime=true;'),
            entry('build.mjs', `import fs from 'node:fs/promises';await fs.mkdir('artifacts/site',{recursive:true});await fs.writeFile('artifacts/site/index.html',${JSON.stringify(html.replace('</main>', '<iframe data-src="scene.html"></iframe></main>'))});await fs.writeFile('artifacts/site/scene.html',${JSON.stringify(embedded)});`)];
        expect(installSourceBuildHook(entries, { siteRoot: 'wrapped/', previewEntryPath: 'wrapped/artifacts/site/index.html' }).valid).toBe(true);
        const directory = await materialize(entries); build(directory);
        expect(await readFile(join(directory, 'artifacts/site/js/ad.js'), 'utf8')).toBe('window.runtime=true;');
        expect(await readFile(join(directory, 'artifacts/site/scene.html'), 'utf8')).toBe(embedded);
    });

    it('keeps lifecycle installation idempotent and refuses to overwrite a user script', () => {
        const entries = [entry('package.json', JSON.stringify({ scripts: { build: 'vite build', postbuild: 'node user-task.mjs' } }))];
        expect(installSourceBuildHook(entries, {}).valid).toBe(true); expect(installSourceBuildHook(entries, {}).valid).toBe(true);
        expect(JSON.parse(text(entries, 'package.json')).scripts.postbuild).toBe('node user-task.mjs && node ' + hookPath);
        expect(entries.filter(e => e.path === hookPath)).toHaveLength(1);
        const conflicting = [entry('package.json', JSON.stringify({ scripts: { build: 'vite build' } })), entry(hookPath, 'user-owned code')];
        expect(installSourceBuildHook(conflicting, {})).toMatchObject({ valid: false, code: 'REACT_BUILD_HOOK_CONFLICT' });
        expect(text(conflicting, hookPath)).toBe('user-owned code');
    });

    it('does not require a static output for server-rendered applications', async () => {
        const entries = [entry('package.json', JSON.stringify({ scripts: { build: 'node -e "0"' } })), entry('public/js/ad.js', 'server public runtime')];
        installSourceBuildHook(entries, {}); const directory = await materialize(entries);
        expect(build(directory)).toContain('retaining public/js/ad.js');
    });

    it('includes the finalizer in an actual wrapped React source export', () => {
        const result = injectReactSource([entry('site/package.json', JSON.stringify({ scripts: { build: 'node scripts/build.mjs' } })), entry('site/index.html', html)],
            { framework: 'React / Vite 源码工程', siteRoot: 'site/', entryPath: 'site/index.html', previewEntryPath: 'site/dist/index.html' },
            { bannerPath1: '/123/example-banner1' }, {}, 'wrapped', 'window.ads=true;', { mode: 'fixed', version: 'v1.0.2.1' });
        expect(result.valid).toBe(true); expect(result.changedScripts).toContain(hookPath);
        expect(JSON.parse(text(result.entries, 'ad-injection.json')).sourceBuildHook).toBe(hookPath);
        expect(JSON.parse(text(result.entries, 'package.json')).scripts.postbuild).toBe('node ' + hookPath);
    });
});
