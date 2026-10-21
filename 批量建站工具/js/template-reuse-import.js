/** Content-source adapter for template reuse.
 * Archive decoding stays in AdRestoration so RAR5 fallback, 7Z workers, ZIP
 * progress and TAR handling behave like the other established workflows. */
import { parseContentJson, extractStaticSiteContent } from './template-reuse.js';
import { normalizePath } from './template-reuse-content.js';

const ARCHIVE_EXTENSION = /\.(?:zip|rar|7z|tar|tar\.gz|tgz)$/i;
const IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

/** Dependency injection keeps the content adapter independent of classic globals
 * and makes the same import contract testable without mounting the workbench. */
export async function readTemplateReuseContent(file, kind, options = {}) {
    const name = String(file?.name || '');
    if (/\.json$/i.test(name) && kind !== 'static') {
        return { items: parseContentJson(await file.text()), assets: [], kind: 'JSON 内容' };
    }
    if (!ARCHIVE_EXTENSION.test(name)) {
        throw new Error('内容压缩包支持 ZIP、RAR、7Z、TAR、TAR.GZ/TGZ；JSON 内容也可直接选择 .json 文件。');
    }
    if (typeof options.readArchive !== 'function') throw new Error('本地归档解析组件尚未加载，请刷新页面后重试。');

    const rawEntries = await options.readArchive(file, options.onStage);
    const entries = rawEntries.map(entry => ({ ...entry, path: normalizePath(entry.path) }))
        .filter(entry => entry.path && !/(?:^|\/)(?:__MACOSX|\.git|node_modules)(?:\/|$)/i.test(entry.path));
    if (!entries.length) throw new Error('压缩包中没有可读取的内容文件。');
    const assets = entries.filter(entry => IMAGE_EXTENSION.test(entry.path));
    // The explicit static-site source always reads detail pages, even when that
    // site also contains a package.json or a runtime data.json.
    if (kind === 'static') return { items: extractStaticSiteContent(entries), assets, kind: '静态网站内容' };
    const jsonEntry = entries.find(entry => /(?:^|\/)(?:articles|content|data)?[^/]*\.json$/i.test(entry.path));
    if (!jsonEntry) return { items: extractStaticSiteContent(entries), assets, kind: '静态网站内容' };
    return {
        items: parseContentJson(new TextDecoder().decode(jsonEntry.bytes), { ownerPath: jsonEntry.path }),
        assets,
        kind: 'JSON/图片内容包'
    };
}
