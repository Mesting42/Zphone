/** Keep source exports usable when an npm build runs more than one generator.
 * The finalizer has no project dependencies and never rewrites a site's build
 * command. npm runs it after the project's existing postbuild succeeds. */
const HOOK_PATH = 'scripts/sitefoundry-inject-built-ads.mjs';
const HOOK_MARKER = '// SiteFoundry source advertising build finalizer';
const encode = text => new TextEncoder().encode(text);
const decode = entry => new TextDecoder().decode(entry.bytes || encode(entry.text || ''));

/** Keep generated Node code literal: browser bundlers and test transforms must
 * not replace its imports or introduce helpers unavailable in the export. */
const FINALIZER_SOURCE = String.raw`async function finalizeBuiltAds(projectRoot, preferred) {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const runtime = await fs.readFile(path.join(projectRoot, 'public/js/ad.js'));
    const candidates = [...new Set([preferred, 'dist/client', 'dist', 'build/client', 'build', 'out'].filter(Boolean))];
    let output;
    for (const candidate of candidates) {
        const directory = path.resolve(projectRoot, candidate);
        if (!directory.startsWith(projectRoot + path.sep)) continue;
        if (await fs.stat(path.join(directory, 'index.html')).then(file => file.isFile(), () => false)) { output = directory; break; }
    }
    // Server-rendered Next/TanStack projects serve public/ themselves. They may
    // have no static index; their already-injected root shell remains in charge.
    if (!output) { console.log('[SiteFoundry] No static HTML output; retaining public/js/ad.js for the application server.'); return; }
    const realRoot = await fs.realpath(projectRoot), realOutput = await fs.realpath(output);
    if (!realOutput.startsWith(realRoot + path.sep)) throw new Error('SiteFoundry: static output escapes the project directory.');
    const jsDirectory = path.join(output, 'js');
    if (await fs.lstat(jsDirectory).then(file => file.isSymbolicLink(), () => false)) throw new Error('SiteFoundry: output js directory must not be a symbolic link.');
    await fs.mkdir(jsDirectory, { recursive: true });
    await fs.writeFile(path.join(jsDirectory, 'ad.js'), runtime);
    const utility = /(?:^|\/)(?:about(?:-us)?|contact(?:-us)?|privacy(?:-policy)?|cookie(?:-policy)?|terms(?:-of-(?:service|use))?|legal|faq|404|accessibility|editorial(?:-policy|-standards)?|sources?-methodology|corrections|disclaimer|disclosures|copyright)(?:[/.]|$)/i;
    let pages = 0;
    const documents = [];
    async function visit(directory) {
        for (const item of await fs.readdir(directory, { withFileTypes: true })) {
            // Private snapshots and embedded source files are not publishing
            // routes. Do not traverse symlinks or alter preserved backup HTML.
            if (item.name.startsWith('.') || item.name === 'node_modules' || item.isSymbolicLink()) continue;
            const file = path.join(directory, item.name);
            if (item.isDirectory()) { await visit(file); continue; }
            const relative = path.relative(output, file).split(path.sep).join('/');
            if (!/\.html?$/i.test(relative)) continue;
            let html = await fs.readFile(file, 'utf8');
            documents.push({ file, relative, html });
        }
    }
    await visit(output);
    // A game/visualization iframe is an embedded document, not a second full
    // site page. Preserve it exactly, matching the finished-site page scope.
    const embedded = new Set();
    for (const document of documents) for (const match of document.html.matchAll(/<iframe\b[^>]*\b(?:src|data-src)\s*=\s*(["'])(.*?)\1/gi)) {
        const ref = match[2].split(/[?#]/)[0];
        if (!ref || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(ref)) continue;
        let decoded; try { decoded = decodeURIComponent(ref); } catch { decoded = ref; }
        const target = decoded.startsWith('/') ? path.resolve(output, '.' + decoded) : path.resolve(path.dirname(document.file), decoded);
        embedded.add(target.toLowerCase());
    }
    for (const document of documents) {
            const { file, relative } = document;
            let html = document.html;
            if (utility.test(relative) || embedded.has(file.toLowerCase())) continue;
            if (!/<head\b[^>]*>[\s\S]*?<\/head\s*>/i.test(html) || !/<body\b/i.test(html)
                || /<meta\b(?=[^>]*\bname\s*=\s*["']robots["'])(?=[^>]*\bcontent\s*=\s*["'][^"']*noindex)[^>]*>/i.test(html)) continue;
            html = html.replace(/\s*<script\b[^>]*data-sitefoundry-ad-runtime[^>]*>[\s\S]*?<\/script\s*>/gi, '');
            const src = path.relative(path.dirname(file), path.join(output, 'js/ad.js')).split(path.sep).join('/');
            const gpt = /<script\b[^>]*src\s*=\s*["'][^"']*securepubads\.g\.doubleclick\.net\/tag\/js\/gpt\.js/i.test(html)
                ? '' : '<script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js" crossorigin="anonymous" data-sitefoundry-ad-runtime="gpt"></script>\n';
            const loader = '<script defer src="' + src + '" data-sitefoundry-ad-runtime="loader"></script>\n';
            html = html.replace(/<\/head\s*>/i, gpt + loader + '</head>');
            await fs.writeFile(file, html); pages++;
    }
    if (!pages) throw new Error('SiteFoundry: the static output contains no complete content pages.');
    console.log('[SiteFoundry] Advertising runtime retained in ' + path.relative(projectRoot, output) + '; ' + pages + ' content pages updated.');
}`;

/** Add an idempotent lifecycle hook to the export copy, preserving unrelated
 * package fields, dependencies, build scripts, and existing postbuild actions. */
export function installSourceBuildHook(entries, project) {
    const entry = entries.find(item => item.path === 'package.json');
    if (!entry) return { valid: true, installed: false };
    let pkg;
    try { pkg = JSON.parse(decode(entry)); } catch { return { valid: false, code: 'REACT_BUILD_PACKAGE_INVALID', message: 'package.json 无法解析，不能安装广告构建收尾步骤。' }; }
    if (!pkg.scripts || typeof pkg.scripts.build !== 'string') return { valid: true, installed: false };
    const old = entries.find(item => item.path === HOOK_PATH);
    if (old && !decode(old).startsWith(HOOK_MARKER)) return { valid: false, code: 'REACT_BUILD_HOOK_CONFLICT', message: HOOK_PATH + ' 已存在且不属于本工具，未覆盖该文件。' };
    const root = String(project && project.siteRoot || '').replace(/\\/g, '/');
    const preview = String(project && project.previewEntryPath || '').replace(/\\/g, '/');
    const relative = preview.startsWith(root) ? preview.slice(root.length) : preview;
    const preferred = /^(?!\.\.?\/)(.+)\/index\.html?$/i.exec(relative)?.[1] || '';
    const source = HOOK_MARKER + '\nimport { dirname, resolve } from "node:path";\nimport { fileURLToPath } from "node:url";\n'
        + 'await (' + FINALIZER_SOURCE + ')(resolve(dirname(fileURLToPath(import.meta.url)), ".."), ' + JSON.stringify(preferred) + ');\n';
    if (old) old.bytes = encode(source); else entries.push({ path: HOOK_PATH, bytes: encode(source) });
    const command = 'node ' + HOOK_PATH;
    const postbuild = String(pkg.scripts.postbuild || '');
    if (!postbuild.includes(command)) pkg.scripts.postbuild = postbuild ? postbuild + ' && ' + command : command;
    entry.bytes = encode(JSON.stringify(pkg, null, 2) + '\n');
    return { valid: true, installed: true, path: HOOK_PATH };
}
