/** Standalone production HTTP server. Bundled with its parser at build time;
 * startup needs an installed Node.js runtime and never runs npm or downloads. */
import { createServer } from 'node:http';
import { readFile, stat, mkdir, cp, access } from 'node:fs/promises';
import { resolve, extname, sep, join } from 'node:path';
import { homedir } from 'node:os';
import { createAdTemplateApiMiddleware } from './ad-template-store.js';
import { offlineFontHeaders } from './offline-assets.js';

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.zip': 'application/zip' };

export async function createOfflineServer(rootDirectory, dataDirectory) {
    const root = resolve(rootDirectory);
    const store = join(dataDirectory || process.env.SITEFOUNDRY_DATA_DIR || join(homedir(), '.sitefoundry'), 'ad-templates');
    // Seed packaged templates once. Runtime writes live outside dist, so a later
    // production rebuild or replacement cannot silently erase user templates.
    await mkdir(store, { recursive: true });
    try { await access(join(store, 'manifest.json')); }
    catch { await cp(join(root, 'ad-templates'), store, { recursive: true, force: false, errorOnExist: false }); }
    const templates = createAdTemplateApiMiddleware(store);
    async function serve(request, response) {
        try {
            if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
            const url = new URL(request.url, 'http://127.0.0.1');
            const path = resolve(root, '.' + decodeURIComponent(url.pathname));
            if (path !== root && !path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
            const info = await stat(path);
            if (info.isDirectory() && !url.pathname.endsWith('/')) {
                response.writeHead(302, { Location: url.pathname + '/' + url.search }).end(); return;
            }
            const file = info.isDirectory() ? join(path, 'index.html') : path;
            const bytes = await readFile(file);
            response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Content-Length': bytes.length, 'Cache-Control': 'no-cache' });
            response.end(request.method === 'HEAD' ? undefined : bytes);
        } catch (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 500).end(); }
    }
    return createServer((request, response) => offlineFontHeaders(request, response, () => templates(request, response, () => { void serve(request, response); })));
}
