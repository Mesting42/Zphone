/*
 * 导出前站点完整性检查。
 * 只读取最终输出的文件路径与文本，不改写用户上传内容或导出文件。
 */
(function(root, factory) {
    'use strict';
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.SiteExportPreflight = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    const TEXT_FILE = /\.(?:html?|css|mjs|cjs|js|jsx|ts|tsx|json)$/i;
    const HTML_FILE = /\.html?$/i;
    const STYLE_FILE = /\.css$/i;
    const SCRIPT_FILE = /\.(?:mjs|cjs|js|jsx|ts|tsx)$/i;
    const JSON_FILE = /\.json$/i;
    const STATIC_EXTENSION = /\.[a-z0-9]{1,12}$/i;
    const FRAMEWORK_ENTRY = /^(?:(?:src\/)?(?:main|index)\.(?:mjs|cjs|js|jsx|ts|tsx)|(?:src\/)?app\/page\.(?:js|jsx|ts|tsx)|app\/page\.(?:js|jsx|ts|tsx)|pages\/index\.(?:js|jsx|ts|tsx))$/i;
    const RESOURCE_ATTRIBUTES = {
        script: ['src'], img: ['src'], source: ['src'], video: ['src', 'poster'], audio: ['src'],
        iframe: ['src'], embed: ['src'], object: ['data'], track: ['src'], input: ['src']
    };

    function shouldReadText(path) {
        if (!TEXT_FILE.test(path)) return false;
        if (path.split('/').some(function(part) { return part.toLowerCase() === 'node_modules' || part === '.git'; })) return false;
        return !JSON_FILE.test(path) || /(?:^|\/)(?:data|manifest|ad-policy|site|config)\.json$/i.test(path);
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function(character) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
        });
    }

    function normalizeArchivePath(value) {
        return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/{2,}/g, '/');
    }

    function decodeText(value) {
        if (typeof value === 'string') return value;
        if (value instanceof ArrayBuffer) return new TextDecoder().decode(value);
        if (ArrayBuffer.isView(value)) return new TextDecoder().decode(value);
        if (Array.isArray(value)) return new TextDecoder().decode(new Uint8Array(value));
        return '';
    }

    function toFileMap(entries, explicitPaths) {
        const files = Object.create(null);
        const paths = new Set((explicitPaths || []).map(normalizeArchivePath).filter(Boolean));
        if (Array.isArray(entries)) {
            entries.forEach(function(entry) {
                if (!entry || !entry.path) return;
                const path = normalizeArchivePath(entry.path);
                if (!path) return;
                paths.add(path);
                if (shouldReadText(path) && entry.text != null) files[path] = decodeText(entry.text);
                else if (shouldReadText(path) && entry.bytes != null) files[path] = decodeText(entry.bytes);
            });
        } else if (entries && typeof entries === 'object') {
            Object.keys(entries).forEach(function(rawPath) {
                const path = normalizeArchivePath(rawPath);
                if (!path) return;
                paths.add(path);
                const value = entries[rawPath];
                if (shouldReadText(path) && value != null) files[path] = decodeText(value);
            });
        }
        return { files: files, paths: Array.from(paths).sort() };
    }

    function decodeEntities(value) {
        return String(value || '').replace(/&(?:amp|quot|apos|#39|#x27|#x2f|#47);/gi, function(entity) {
            const key = entity.toLowerCase();
            if (key === '&amp;') return '&';
            if (key === '&quot;') return '"';
            if (key === '&apos;' || key === '&#39;' || key === '&#x27;') return "'";
            return '/';
        });
    }

    function isExternalReference(value) {
        const url = String(value || '').trim();
        return !url || url.charAt(0) === '#' || url.charAt(0) === '?' || /^\/\//.test(url)
            || /^(?:[a-z][a-z0-9+.-]*:|about:|blob:)/i.test(url)
            || /^(?:var\(|\$\{|\{\{|<)/.test(url);
    }

    function splitUrl(value) {
        const decoded = decodeEntities(value).trim();
        const queryAt = decoded.search(/[?#]/);
        return queryAt < 0 ? decoded : decoded.slice(0, queryAt);
    }

    function pathParts(value) {
        const result = [];
        String(value || '').split('/').forEach(function(part) {
            if (!part || part === '.') return;
            if (part === '..') {
                if (result.length) result.pop();
                else result.push('..');
                return;
            }
            result.push(part);
        });
        return result;
    }

    function resolveReference(sourcePath, siteRoot, rawUrl) {
        const url = splitUrl(rawUrl);
        if (isExternalReference(rawUrl) || !url) return { ignored: true };
        let decoded;
        try { decoded = decodeURIComponent(url); }
        catch (error) { return { invalid: '网址包含无效的百分号编码。', value: url }; }
        decoded = decoded.replace(/\\/g, '/');
        if (/^[a-z]:\//i.test(decoded) || decoded.charAt(0) === '\0') return { ignored: true };

        const root = pathParts(siteRoot).filter(function(part) { return part !== '..'; });
        const base = decoded.charAt(0) === '/' ? root.slice() : pathParts(sourcePath).slice(0, -1);
        const combined = base.concat(decoded.replace(/^\/+/, '').split('/'));
        const resolved = [];
        let escapedRoot = false;
        combined.forEach(function(part) {
            if (!part || part === '.') return;
            if (part === '..') {
                if (resolved.length > root.length) resolved.pop();
                else escapedRoot = true;
                return;
            }
            resolved.push(part);
        });
        const rootMatches = root.every(function(part, index) { return resolved[index] === part; });
        if (escapedRoot || !rootMatches) return { invalid: '本地路径越过了站点根目录。', value: rawUrl };
        let target = resolved.join('/');
        const directoryLike = /\/$/.test(decoded);
        if (directoryLike) target = target.replace(/\/$/, '') + '/index.html';
        return { path: target, directoryLike: directoryLike, value: rawUrl };
    }

    function readAttributes(tagText) {
        const attrs = Object.create(null);
        const attrPattern = /([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
        let match;
        while ((match = attrPattern.exec(tagText))) {
            attrs[match[1].toLowerCase()] = match[2] != null ? match[2] : (match[3] != null ? match[3] : (match[4] || ''));
        }
        return attrs;
    }

    function collectHtmlReferences(path, html) {
        const refs = [];
        const cleanHtml = String(html || '').replace(/<!--[\s\S]*?-->/g, '');
        const styleBlocks = [];
        let styleMatch;
        const stylePattern = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
        while ((styleMatch = stylePattern.exec(cleanHtml))) styleBlocks.push(styleMatch[1]);
        let baseHref = '';
        const baseTag = cleanHtml.match(/<base\b[^>]*>/i);
        if (baseTag) baseHref = readAttributes(baseTag[0]).href || '';

        const tagHtml = cleanHtml
            .replace(/<script\b([^>]*)>[\s\S]*?<\/script\s*>/gi, '<script$1></script>')
            .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
        const tagPattern = /<([a-z][a-z0-9:-]*)\b[^>]*>/gi;
        let match;
        while ((match = tagPattern.exec(tagHtml))) {
            const tagName = match[1].toLowerCase();
            const tag = match[0];
            const attrs = readAttributes(tag);
            const attrsToCheck = RESOURCE_ATTRIBUTES[tagName] || [];
            attrsToCheck.forEach(function(attribute) {
                if (attrs[attribute]) refs.push({ url: attrs[attribute], kind: 'resource', source: path });
            });
            if (tagName === 'link' && attrs.href) {
                const rel = String(attrs.rel || '').toLowerCase();
                if (/(?:stylesheet|icon|preload|modulepreload|manifest|apple-touch-icon|mask-icon)/.test(rel)
                    || STATIC_EXTENSION.test(splitUrl(attrs.href))) {
                    refs.push({ url: attrs.href, kind: 'resource', source: path });
                }
            }
            if ((tagName === 'a' || tagName === 'area') && attrs.href && /\.[a-z0-9]{1,12}(?:[?#]|$)/i.test(attrs.href)) {
                refs.push({ url: attrs.href, kind: 'page', source: path });
            }
            if (tagName === 'form' && attrs.action && /\.html?(?:[?#]|$)/i.test(attrs.action)) {
                refs.push({ url: attrs.action, kind: 'page', source: path });
            }
            if ((tagName === 'image' || tagName === 'use') && (attrs.href || attrs['xlink:href'])) {
                const svgReference = attrs.href || attrs['xlink:href'];
                if (/\.[a-z0-9]{1,12}(?:[?#]|$)/i.test(svgReference)) refs.push({ url: svgReference, kind: 'resource', source: path });
            }
            if (attrs.srcset) {
                const srcsetPattern = /(?:^|,\s*)(data:[^\s]+|[^,\s]+)(?:\s+\d+(?:\.\d+)?[wx])?/gi;
                let srcsetMatch;
                while ((srcsetMatch = srcsetPattern.exec(attrs.srcset))) refs.push({ url: srcsetMatch[1], kind: 'resource', source: path });
            }
            if (attrs.style) collectCssReferences(path, attrs.style).forEach(function(ref) { refs.push(ref); });
        }

        styleBlocks.forEach(function(style) { collectCssReferences(path, style).forEach(function(ref) { refs.push(ref); }); });
        return { refs: refs, baseHref: baseHref };
    }

    function collectCssReferences(path, css) {
        const refs = [];
        let match;
        const urlPattern = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
        while ((match = urlPattern.exec(String(css || '')))) {
            if (match[2]) refs.push({ url: match[2], kind: 'resource', source: path });
        }
        const importPattern = /@import\s+(['"])(.*?)\1/gi;
        while ((match = importPattern.exec(String(css || '')))) refs.push({ url: match[2], kind: 'resource', source: path });
        return refs;
    }

    function collectScriptReferences(path, script) {
        const refs = [];
        const patterns = [
            /(?:\bimport\s+(?:[^'";]*?\s+from\s+)?|\bexport\s+[^'";]*?\s+from\s+|\bimport\s*\(|\brequire\s*\()\s*['"]([^'"]+)['"]/g,
            /\bfetch\s*\(\s*['"]([^'"]+)['"]/g
        ];
        patterns.forEach(function(pattern, index) {
            let match;
            while ((match = pattern.exec(String(script || '')))) {
                const url = match[1];
                if (/^(?:\.\.?\/|\/)/.test(url) || (index === 1 && /\.(?:json|xml|txt|csv|html?)(?:[?#]|$)/i.test(url))) {
                    refs.push({ url: url, kind: 'resource', source: path, module: index === 0, documentRelative: index === 1 });
                }
            }
        });
        return refs;
    }

    function collectJsonAssetReferences(path, source) {
        let parsed;
        try { parsed = JSON.parse(source); }
        catch (error) {
            return { error: error };
        }
        const refs = [];
        const assetKey = /(?:image|cover|thumb|poster|avatar|logo|icon|media|asset|background|screenshot|banner|audio|video|file)(?:url|src|path)?/i;
        const isAdManifest = /(?:^|\/)(?:ad-policy|ad-injection)\.json$/i.test(path)
            || /^sitefoundry-ad-(?:policy|injection)\//i.test(String(parsed && parsed.schema || ''));
        const visit = function(value) {
            if (!value || typeof value !== 'object') return;
            Object.keys(value).forEach(function(key) {
                const child = value[key];
                // SiteFoundry 清单中的 adPaths 是 Google Ad Manager 广告单元标识，
                // 例如 /23333087986/example.com-banner1，并不是站点根目录下的文件。
                // 仅跳过该结构化字段，清单中的图片等真实资源仍继续参与体检。
                if (isAdManifest && key === 'adPaths') return;
                const fileUrlKey = /^(?:url|href|src)$/i.test(key) && /\.[a-z0-9]{2,12}(?:[?#]|$)/i.test(child || '');
                if (typeof child === 'string' && (assetKey.test(key) || fileUrlKey) && /(?:\/|\.[a-z0-9]{2,12}(?:[?#]|$))/i.test(child)) {
                    refs.push({ url: child, kind: 'resource', source: path });
                } else if (child && typeof child === 'object') visit(child);
            });
        };
        visit(parsed);
        return { refs: refs };
    }

    function findSiteRoot(path, indexRoots) {
        const matches = indexRoots.filter(function(root) { return !root || path.indexOf(root + '/') === 0 || path === root + '/index.html'; });
        // 子目录里的 index.html 可能是游戏或文章页面，不代表另一个站点根目录。
        // 选择当前页面路径下最外层的入口，才能正确解析 ../ 指向站点公共资源的引用。
        matches.sort(function(left, right) { return left.length - right.length; });
        return matches.length ? matches[0] : (indexRoots.length ? indexRoots[0] : '');
    }

    function hasPath(pathSet, target) {
        if (pathSet.has(target)) return true;
        if (target.endsWith('/index.html') && pathSet.has(target.slice(0, -10))) return true;
        return false;
    }

    function moduleCandidates(target) {
        if (STATIC_EXTENSION.test(target)) return [target];
        return [target, target + '.js', target + '.jsx', target + '.ts', target + '.tsx', target + '.json', target + '.css', target.replace(/\/$/, '') + '/index.js', target.replace(/\/$/, '') + '/index.ts', target.replace(/\/$/, '') + '/index.jsx', target.replace(/\/$/, '') + '/index.tsx'];
    }

    function inspectEntries(entries, options) {
        options = options || {};
        const fileMap = toFileMap(entries, options.paths);
        const paths = fileMap.paths;
        const pathSet = new Set(paths);
        const textFiles = fileMap.files;
        const errors = [];
        const warnings = [];
        const htmlPaths = paths.filter(function(path) { return HTML_FILE.test(path) && Object.prototype.hasOwnProperty.call(textFiles, path); });
        const indexPaths = paths.filter(function(path) { return shouldReadText(path) && /(?:^|\/)index\.html?$/i.test(path); });
        const indexRoots = indexPaths.map(function(path) {
            const slash = path.lastIndexOf('/');
            return slash < 0 ? '' : path.slice(0, slash);
        });
        const hasPackage = pathSet.has('package.json') || paths.some(function(path) { return /\/package\.json$/i.test(path); });
        const hasSourceEntry = paths.some(function(path) {
            const sourcePath = path.replace(/^.*?\/(?:src|app|pages)\//i, function(match) { return match.slice(match.lastIndexOf('/') + 1); });
            return FRAMEWORK_ENTRY.test(path) || FRAMEWORK_ENTRY.test(sourcePath);
        });
        const hasEntrypoint = indexPaths.length > 0 || (hasPackage && hasSourceEntry);
        if (!hasEntrypoint) {
            errors.push({ code: 'EXPORT_ENTRYPOINT_MISSING', path: '', message: '未找到 index.html 或可识别的 React 源码入口。' });
        }
        indexPaths.forEach(function(path) {
            if (!Object.prototype.hasOwnProperty.call(textFiles, path)) {
                errors.push({ code: 'EXPORT_ENTRYPOINT_UNREADABLE', path: path, message: '无法读取入口页面 ' + path + '。' });
            } else if (!String(textFiles[path] || '').trim()) {
                errors.push({ code: 'EXPORT_ENTRYPOINT_EMPTY', path: path, message: '入口页面 ' + path + ' 内容为空。' });
            }
        });

        paths.forEach(function(path) {
            if (/^(?:\/|[a-z]:\/)/i.test(path) || path.split('/').some(function(part) { return part === '..'; })) {
                errors.push({ code: 'EXPORT_UNSAFE_ARCHIVE_PATH', path: path, message: '导出文件路径包含站点根目录之外的路径。' });
            }
        });

        let localReferenceCount = 0;
        const seenErrors = new Set();
        const checkReferences = function(sourcePath, refs, siteRoot, externalBase) {
            refs.forEach(function(ref) {
                if (externalBase && String(ref.url || '').charAt(0) !== '/') return;
                const resolved = resolveReference(sourcePath, siteRoot, ref.url);
                if (resolved.ignored) return;
                localReferenceCount++;
                const key = [sourcePath, ref.url, resolved.invalid || resolved.path].join('|');
                if (resolved.invalid) {
                    if (!seenErrors.has(key)) {
                        seenErrors.add(key);
                        errors.push({ code: 'EXPORT_REFERENCE_PATH_INVALID', path: sourcePath, reference: ref.url, message: sourcePath + ' 中的本地引用“' + ref.url + '”无效：' + resolved.invalid });
                    }
                    return;
                }
                let exists = hasPath(pathSet, resolved.path);
                if (!exists && ref.module) exists = moduleCandidates(resolved.path).some(function(candidate) { return pathSet.has(candidate); });
                if (!exists && ref.kind === 'page' && !STATIC_EXTENSION.test(resolved.path)) return;
                if (!exists && !resolved.directoryLike && !STATIC_EXTENSION.test(resolved.path) && ref.kind !== 'resource') return;
                if (!exists && !seenErrors.has(key)) {
                    seenErrors.add(key);
                    errors.push({ code: 'EXPORT_REFERENCE_MISSING', path: sourcePath, reference: ref.url, message: sourcePath + ' 引用的本地文件不存在：' + ref.url });
                }
            });
        };

        paths.forEach(function(path) {
            const source = textFiles[path];
            if (typeof source !== 'string' || !shouldReadText(path)) return;
            const siteRoot = findSiteRoot(path, indexRoots);
            if (HTML_FILE.test(path)) {
                const parsed = collectHtmlReferences(path, source);
                let base = siteRoot;
                let referenceSource = path;
                let externalBase = false;
                if (parsed.baseHref) {
                    if (/^(?:\/\/|[a-z][a-z0-9+.-]*:)/i.test(parsed.baseHref.trim())) externalBase = true;
                    else {
                        const resolvedBase = resolveReference(path, siteRoot, parsed.baseHref);
                        if (!resolvedBase.ignored && !resolvedBase.invalid) {
                            referenceSource = resolvedBase.path.replace(/\/index\.html?$/i, '') + '/index.html';
                        }
                    }
                }
                checkReferences(referenceSource, parsed.refs, base, externalBase);
            }
            if (STYLE_FILE.test(path)) checkReferences(path, collectCssReferences(path, source), siteRoot);
            if (SCRIPT_FILE.test(path)) {
                const refs = collectScriptReferences(path, source);
                refs.forEach(function(ref) {
                    const referenceSource = ref.documentRelative ? (siteRoot ? siteRoot + '/index.html' : 'index.html') : path;
                    checkReferences(referenceSource, [ref], siteRoot);
                });
            }
            if (JSON_FILE.test(path)) {
                const parsedJson = collectJsonAssetReferences(path, source);
                if (parsedJson.error) {
                    errors.push({ code: 'EXPORT_JSON_INVALID', path: path, message: path + ' 不是有效的 JSON：' + parsedJson.error.message });
                } else checkReferences(path, parsedJson.refs, siteRoot);
            }
        });

        const report = {
            valid: errors.length === 0,
            siteName: String(options.siteName || ''),
            entrypoint: indexPaths.length ? 'HTML' : (hasPackage && hasSourceEntry ? 'React 源码' : ''),
            pageCount: htmlPaths.length,
            localReferenceCount: localReferenceCount,
            fileCount: paths.length,
            errors: errors,
            warnings: warnings
        };
        return report;
    }

    async function inspectBlob(blob, JSZipImpl, options) {
        if (!JSZipImpl || typeof JSZipImpl.loadAsync !== 'function') throw new Error('ZIP 读取组件未加载，无法完成导出前体检。');
        const archiveData = blob && typeof blob.arrayBuffer === 'function' ? await blob.arrayBuffer() : blob;
        const zip = await JSZipImpl.loadAsync(archiveData);
        const paths = Object.keys(zip.files).filter(function(path) { return !zip.files[path].dir; });
        const files = Object.create(null);
        await Promise.all(paths.filter(shouldReadText).map(async function(path) {
            files[path] = await zip.files[path].async('text');
        }));
        return inspectEntries(files, Object.assign({}, options || {}, { paths: paths }));
    }

    function inspectSites(sites) {
        const reports = Array.from(sites || []).map(function(site) {
            const entries = (site && site.entries || []).map(function(entry) {
                return { path: entry.path, bytes: entry.bytes };
            });
            return inspectEntries(entries, { siteName: site && site.name || '未命名站点' });
        });
        return combine(reports);
    }

    function combine(reports) {
        const sites = Array.from(reports || []);
        const errors = [];
        let pageCount = 0;
        let localReferenceCount = 0;
        let fileCount = 0;
        sites.forEach(function(report) {
            pageCount += report.pageCount || 0;
            localReferenceCount += report.localReferenceCount || 0;
            fileCount += report.fileCount || 0;
            (report.errors || []).forEach(function(error) {
                errors.push(Object.assign({ siteName: report.siteName || '' }, error));
            });
        });
        if (!sites.length) errors.push({ code: 'EXPORT_NO_SITES', siteName: '', message: '没有可进行导出前体检的站点。' });
        return {
            valid: errors.length === 0,
            siteCount: sites.length,
            pageCount: pageCount,
            localReferenceCount: localReferenceCount,
            fileCount: fileCount,
            errors: errors,
            warnings: sites.flatMap(function(report) { return report.warnings || []; }),
            sites: sites
        };
    }

    function createBlockingError(report) {
        const detail = (report && report.errors || []).slice(0, 8).map(function(error) { return error.message; }).join('；');
        const suffix = (report && report.errors || []).length > 8 ? '；另有 ' + (report.errors.length - 8) + ' 项' : '';
        const error = new Error('导出前体检未通过，已阻止导出。请修复以下问题后重试：' + (detail || '站点完整性校验失败。') + suffix);
        error.code = 'EXPORT_PREFLIGHT_FAILED';
        error.preflightReport = report;
        return error;
    }

    function assertValid(report) {
        if (!report || !report.valid) throw createBlockingError(report || { errors: [{ message: '未收到体检结果。' }] });
        return report;
    }

    function renderReport(report) {
        if (!report) return '';
        const valid = !!report.valid;
        const countLabel = report.siteCount != null
            ? (report.siteCount + ' 个站点 · ' + report.pageCount + ' 个页面 · ' + report.localReferenceCount + ' 个本地引用')
            : (report.pageCount + ' 个页面 · ' + report.localReferenceCount + ' 个本地引用 · ' + report.fileCount + ' 个文件');
        const title = valid ? '导出前全站体检通过' : '导出前全站体检未通过';
        let html = '<section class="export-preflight ' + (valid ? 'is-success' : 'is-error') + '" data-export-preflight role="' + (valid ? 'status' : 'alert') + '" aria-live="polite">';
        html += '<h4>' + title + '</h4><p class="export-preflight-summary">' + escapeHtml(countLabel) + '</p>';
        if (!valid && report.errors && report.errors.length) {
            html += '<p class="export-preflight-blocked">导出已阻止。请修复问题后重新导出。</p><ul>' + report.errors.map(function(error) {
                const sitePrefix = error.siteName ? '<strong>' + escapeHtml(error.siteName) + '</strong>：' : '';
                return '<li>' + sitePrefix + escapeHtml(error.message) + '</li>';
            }).join('') + '</ul>';
        }
        if (report.warnings && report.warnings.length) {
            html += '<ul class="export-preflight-warnings">' + report.warnings.map(function(warning) { return '<li>' + escapeHtml(warning.message || warning) + '</li>'; }).join('') + '</ul>';
        }
        return html + '</section>';
    }

    function renderInto(target, report) {
        if (!target || !report) return;
        if (typeof target === 'string' && typeof document !== 'undefined') target = document.querySelector(target);
        if (!target || !target.insertAdjacentHTML) return;
        const old = target.querySelectorAll('[data-export-preflight]');
        Array.prototype.forEach.call(old, function(item) { item.remove(); });
        target.insertAdjacentHTML('beforeend', renderReport(report));
    }

    return {
        inspectEntries: inspectEntries,
        inspectBlob: inspectBlob,
        inspectSites: inspectSites,
        combine: combine,
        assertValid: assertValid,
        createBlockingError: createBlockingError,
        renderReport: renderReport,
        renderInto: renderInto
    };
});
