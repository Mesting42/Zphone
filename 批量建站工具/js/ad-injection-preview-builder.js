const TEXT_DECODER = new TextDecoder('utf-8');

function normalizePreviewPath(value) {
    const parts = String(value || '').replace(/\\/g, '/').split('/');
    const normalized = [];
    parts.forEach(function(part) {
        if (!part || part === '.') return;
        if (part === '..') normalized.pop();
        else normalized.push(part);
    });
    return normalized.join('/');
}

function entryText(entry) {
    if (!entry) return '';
    if (typeof entry.text === 'string') return entry.text;
    if (typeof entry.content === 'string') return entry.content;
    return entry.bytes ? TEXT_DECODER.decode(entry.bytes) : '';
}

export function previewBuildPlan(entries) {
    const packages = (entries || []).filter(function(entry) {
        return /(?:^|\/)package\.json$/i.test(normalizePreviewPath(entry.path));
    }).sort(function(a, b) {
        return normalizePreviewPath(a.path).split('/').length - normalizePreviewPath(b.path).split('/').length;
    });

    for (const entry of packages) {
        let packageData;
        try { packageData = JSON.parse(entryText(entry)); } catch (error) { continue; }
        const buildCommand = String(packageData && packageData.scripts && packageData.scripts.build || '').trim();
        const match = buildCommand.match(/(?:^|&&\s*)node\s+(?:--[^\s]+\s+)*["']?([^"'\s]+\.(?:mjs|cjs|js))["']?/i);
        if (!match) continue;
        const packagePath = normalizePreviewPath(entry.path);
        const projectRoot = packagePath.replace(/package\.json$/i, '');
        const buildPath = normalizePreviewPath(projectRoot + match[1]);
        if (!(entries || []).some(function(candidate) { return normalizePreviewPath(candidate.path).toLowerCase() === buildPath.toLowerCase(); })) continue;
        return { projectRoot: projectRoot, buildPath: buildPath, buildCommand: buildCommand };
    }
    return null;
}

// This function is intentionally self-contained because the browser wrapper runs
// it inside a unique-origin, network-disabled iframe. Uploaded build scripts can
// read only their own virtual file tree and cannot reach the tool page.
export async function runVirtualPreviewBuild(payload) {
    const decoder = new TextDecoder('utf-8');
    const encoder = new TextEncoder();

    function normalize(value) {
        const input = String(value || '').replace(/\\/g, '/');
        const absolute = input.charAt(0) === '/';
        const parts = [];
        input.split('/').forEach(function(part) {
            if (!part || part === '.') return;
            if (part === '..') parts.pop();
            else parts.push(part);
        });
        return (absolute ? '/' : '') + parts.join('/');
    }
    function absolute(value) {
        const normalized = normalize(value);
        return normalized.charAt(0) === '/' ? normalized : '/' + normalized;
    }
    function dirname(value) {
        const path = absolute(value).replace(/\/$/, '');
        const index = path.lastIndexOf('/');
        return index <= 0 ? '/' : path.slice(0, index);
    }
    function basename(value) {
        return absolute(value).replace(/\/$/, '').split('/').pop() || '';
    }
    function join() {
        return absolute(Array.from(arguments).filter(Boolean).join('/'));
    }
    function resolvePath() {
        const values = Array.from(arguments).filter(function(value) { return value !== undefined && value !== null && value !== ''; });
        let result = '/';
        values.forEach(function(value) {
            const text = String(value).replace(/\\/g, '/');
            result = text.charAt(0) === '/' ? text : result.replace(/\/$/, '') + '/' + text;
        });
        return absolute(result);
    }
    function extension(value) {
        const name = basename(value);
        const index = name.lastIndexOf('.');
        return index > 0 ? name.slice(index) : '';
    }
    function relative(from, to) {
        const left = absolute(from).split('/').filter(Boolean);
        const right = absolute(to).split('/').filter(Boolean);
        while (left.length && right.length && left[0] === right[0]) { left.shift(); right.shift(); }
        return left.map(function() { return '..'; }).concat(right).join('/');
    }

    const rootPrefix = normalize(payload.plan && payload.plan.projectRoot || '');
    const outputPrefix = rootPrefix ? rootPrefix.replace(/\/$/, '') + '/' : '';
    const files = new Map();
    (payload.entries || []).forEach(function(entry) {
        const fullPath = normalize(entry.path);
        if (rootPrefix && fullPath.indexOf(rootPrefix) !== 0) return;
        const localPath = fullPath.slice(rootPrefix.length);
        const bytes = entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes || []);
        files.set(absolute(localPath), bytes);
    });

    function bytesOf(value) {
        if (value instanceof Uint8Array) return value;
        if (value instanceof ArrayBuffer) return new Uint8Array(value);
        if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        return encoder.encode(String(value == null ? '' : value));
    }
    function readText(path) {
        const bytes = files.get(absolute(path));
        if (!bytes) throw new Error('预览构建缺少文件：' + path);
        return decoder.decode(bytes);
    }
    function isTextEncoding(options) {
        return typeof options === 'string' || !!(options && options.encoding);
    }

    const fsPromises = {
        async mkdir() {},
        async rm(path) {
            const target = absolute(path).replace(/\/$/, '');
            Array.from(files.keys()).forEach(function(key) {
                if (key === target || key.indexOf(target + '/') === 0) files.delete(key);
            });
        },
        async readFile(path, options) {
            const bytes = files.get(absolute(path));
            if (!bytes) throw new Error('预览构建缺少文件：' + path);
            return isTextEncoding(options) ? decoder.decode(bytes) : bytes.slice();
        },
        async writeFile(path, value) {
            files.set(absolute(path), bytesOf(value).slice());
        },
        async copyFile(from, to) {
            const bytes = files.get(absolute(from));
            if (!bytes) throw new Error('预览构建缺少文件：' + from);
            files.set(absolute(to), bytes.slice());
        },
        async cp(from, to) {
            const source = absolute(from).replace(/\/$/, '');
            const target = absolute(to).replace(/\/$/, '');
            const matches = Array.from(files.entries()).filter(function(pair) {
                return pair[0] === source || pair[0].indexOf(source + '/') === 0;
            });
            if (!matches.length) throw new Error('预览构建缺少目录：' + from);
            matches.forEach(function(pair) {
                files.set(target + pair[0].slice(source.length), pair[1].slice());
            });
        },
        async readdir(path, options) {
            const directory = absolute(path).replace(/\/$/, '');
            const children = new Map();
            Array.from(files.keys()).forEach(function(key) {
                if (key.indexOf(directory + '/') !== 0) return;
                const rest = key.slice(directory.length + 1);
                const name = rest.split('/')[0];
                if (!name) return;
                children.set(name, rest.indexOf('/') !== -1);
            });
            const names = Array.from(children.keys()).sort();
            if (!(options && options.withFileTypes)) return names;
            return names.map(function(name) {
                const directoryEntry = children.get(name);
                return { name: name, isDirectory: function() { return directoryEntry; }, isFile: function() { return !directoryEntry; } };
            });
        },
        async access(path) {
            const target = absolute(path).replace(/\/$/, '');
            if (!files.has(target) && !Array.from(files.keys()).some(function(key) { return key.indexOf(target + '/') === 0; })) throw new Error('ENOENT: ' + path);
        },
        async stat(path) {
            const target = absolute(path).replace(/\/$/, '');
            const file = files.get(target);
            const directoryEntry = !file && Array.from(files.keys()).some(function(key) { return key.indexOf(target + '/') === 0; });
            if (!file && !directoryEntry) throw new Error('ENOENT: ' + path);
            return { size: file ? file.byteLength : 0, isDirectory: function() { return directoryEntry; }, isFile: function() { return !!file; } };
        }
    };
    function removeSync(path) {
        const target = absolute(path).replace(/\/$/, '');
        Array.from(files.keys()).forEach(function(key) {
            if (key === target || key.indexOf(target + '/') === 0) files.delete(key);
        });
    }
    function copySync(from, to) {
        const source = absolute(from).replace(/\/$/, '');
        const target = absolute(to).replace(/\/$/, '');
        const matches = Array.from(files.entries()).filter(function(pair) {
            return pair[0] === source || pair[0].indexOf(source + '/') === 0;
        });
        if (!matches.length) throw new Error('预览构建缺少文件或目录：' + from);
        matches.forEach(function(pair) { files.set(target + pair[0].slice(source.length), pair[1].slice()); });
    }
    function listSync(path, options) {
        const directory = absolute(path).replace(/\/$/, '');
        const children = new Map();
        Array.from(files.keys()).forEach(function(key) {
            if (key.indexOf(directory + '/') !== 0) return;
            const rest = key.slice(directory.length + 1);
            const name = rest.split('/')[0];
            if (name) children.set(name, rest.indexOf('/') !== -1);
        });
        const names = Array.from(children.keys()).sort();
        if (!(options && options.withFileTypes)) return names;
        return names.map(function(name) {
            const directoryEntry = children.get(name);
            return { name: name, isDirectory: function() { return directoryEntry; }, isFile: function() { return !directoryEntry; } };
        });
    }
    function statSync(path) {
        const target = absolute(path).replace(/\/$/, '');
        const file = files.get(target);
        const directoryEntry = !file && Array.from(files.keys()).some(function(key) { return key.indexOf(target + '/') === 0; });
        if (!file && !directoryEntry) throw new Error('ENOENT: ' + path);
        return { size: file ? file.byteLength : 0, isDirectory: function() { return directoryEntry; }, isFile: function() { return !!file; } };
    }
    const fsApi = {
        promises: fsPromises,
        constants: { F_OK: 0, R_OK: 4, W_OK: 2 },
        existsSync: function(path) {
            const target = absolute(path).replace(/\/$/, '');
            return files.has(target) || Array.from(files.keys()).some(function(key) { return key.indexOf(target + '/') === 0; });
        },
        mkdirSync: function() {},
        rmSync: removeSync,
        unlinkSync: function(path) { files.delete(absolute(path)); },
        readFileSync: function(path, options) {
            const bytes = files.get(absolute(path));
            if (!bytes) throw new Error('预览构建缺少文件：' + path);
            return isTextEncoding(options) ? decoder.decode(bytes) : bytes.slice();
        },
        writeFileSync: function(path, value) { files.set(absolute(path), bytesOf(value).slice()); },
        copyFileSync: function(from, to) {
            const bytes = files.get(absolute(from));
            if (!bytes) throw new Error('预览构建缺少文件：' + from);
            files.set(absolute(to), bytes.slice());
        },
        cpSync: copySync,
        readdirSync: listSync,
        statSync: statSync
    };
    let previewRandomCounter = 0;
    // These hashes are used only for cache-busting filenames inside the
    // isolated preview. They deliberately avoid exposing host crypto APIs.
    const cryptoApi = {
        createHash: function(algorithm) {
            let hash = 2166136261;
            let length = 0;
            const api = {
                update: function(value) {
                    const bytes = bytesOf(value);
                    length += bytes.byteLength;
                    for (let index = 0; index < bytes.byteLength; index++) {
                        hash ^= bytes[index];
                        hash = Math.imul(hash, 16777619) >>> 0;
                    }
                    return api;
                },
                digest: function(encodingName) {
                    const requestedLength = /md5/i.test(algorithm) ? 32 : /sha1/i.test(algorithm) ? 40 : 64;
                    const seed = (hash >>> 0).toString(16).padStart(8, '0') + (length >>> 0).toString(16).padStart(8, '0');
                    const hex = seed.repeat(Math.ceil(requestedLength / seed.length)).slice(0, requestedLength);
                    return encodingName ? hex : encoder.encode(hex);
                }
            };
            return api;
        },
        randomUUID: function() {
            previewRandomCounter += 1;
            const tail = previewRandomCounter.toString(16).padStart(12, '0');
            return '00000000-0000-4000-8000-' + tail;
        },
        randomBytes: function(size) {
            const bytes = new Uint8Array(Number(size) || 0);
            for (let index = 0; index < bytes.length; index++) bytes[index] = (index * 31 + previewRandomCounter) & 255;
            return bytes;
        }
    };
    const pathApi = {
        sep: '/', delimiter: ':', join: join, resolve: resolvePath, dirname: dirname, basename: basename, extname: extension, relative: relative,
        normalize: absolute,
        parse: function(value) { const dir = dirname(value); const base = basename(value); const ext = extension(value); return { root: '/', dir: dir, base: base, ext: ext, name: ext ? base.slice(0, -ext.length) : base }; }
    };
    pathApi.posix = pathApi;
    const urlApi = {
        fileURLToPath: function(value) {
            const text = String(value || '');
            return text.indexOf('file:') === 0 ? decodeURIComponent(text.replace(/^file:\/\//, '')) : text;
        },
        pathToFileURL: function(value) { return { href: 'file://' + absolute(value), toString: function() { return this.href; } }; }
    };
    const processApi = { env: Object.assign({}, payload.env || {}), exitCode: 0, cwd: function() { return '/'; }, platform: 'browser', execPath: '/node', argv: ['/node'] };
    const moduleCache = new Map();
    let importCounter = 0;

    function resolveModule(specifier, fromPath) {
        specifier = String(specifier || '');
        if (/^file:\/\//i.test(specifier)) specifier = decodeURIComponent(specifier.replace(/^file:\/\//i, ''));
        if (/^(?:node:)?fs(?:\/promises)?$/.test(specifier) || specifier === 'node:path' || specifier === 'path' || specifier === 'node:url' || specifier === 'url' || specifier === 'node:crypto' || specifier === 'crypto' || specifier === 'node:process' || specifier === 'process' || specifier === 'prettier') return specifier;
        if (!/^\.?\.?\//.test(specifier) && specifier.charAt(0) !== '/') throw new Error('预览构建暂不支持依赖：' + specifier);
        const base = specifier.charAt(0) === '/' ? absolute(specifier) : join(dirname(fromPath), specifier);
        const candidates = [base, base + '.js', base + '.mjs', base + '.cjs', base + '.json', join(base, 'index.js'), join(base, 'index.mjs')];
        return candidates.find(function(candidate) { return files.has(candidate); }) || base;
    }
    function namedBinding(value) {
        return String(value || '').trim().replace(/\s+as\s+/g, ': ');
    }
    function importStatement(clause, specifier) {
        const request = JSON.stringify(specifier);
        const value = clause.trim();
        if (value.charAt(0) === '{') return 'const ' + namedBinding(value) + ' = await __import(' + request + ', __filename);';
        if (/^\*\s+as\s+/.test(value)) return 'const ' + value.replace(/^\*\s+as\s+/, '') + ' = await __import(' + request + ', __filename);';
        const comma = value.indexOf(',');
        if (comma !== -1) {
            importCounter += 1;
            const temporary = '__previewImport' + importCounter;
            const first = value.slice(0, comma).trim();
            const rest = value.slice(comma + 1).trim();
            return 'const ' + temporary + ' = await __import(' + request + ', __filename); const ' + first + ' = ' + temporary + '.default; const ' + namedBinding(rest) + ' = ' + temporary + ';';
        }
        return 'const ' + value + ' = (await __import(' + request + ', __filename)).default;';
    }
    function transformModule(source, filename, isBuildEntry) {
        const exportedNames = [];
        let transformed = String(source || '').replace(/\bimport\.meta\.url\b/g, JSON.stringify(filename));
        transformed = transformed.replace(/^\s*import\s+(.+?)\s+from\s+(['"])([^'"]+)\2\s*;?\s*$/gm, function(match, clause, quote, specifier) {
            return importStatement(clause, specifier);
        });
        transformed = transformed.replace(/^\s*import\s+(['"])([^'"]+)\1\s*;?\s*$/gm, function(match, quote, specifier) {
            return 'await __import(' + JSON.stringify(specifier) + ', __filename);';
        });
        transformed = transformed.replace(/\bimport\s*\(/g, '__import(');
        transformed = transformed.replace(/\bexport\s+(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g, '$1 $2 = exports.$2 =');
        transformed = transformed.replace(/\bexport\s+async\s+function\s+([A-Za-z_$][\w$]*)/g, function(match, name) { exportedNames.push(name); return 'async function ' + name; });
        transformed = transformed.replace(/\bexport\s+function\s+([A-Za-z_$][\w$]*)/g, function(match, name) { exportedNames.push(name); return 'function ' + name; });
        transformed = transformed.replace(/\bexport\s+class\s+([A-Za-z_$][\w$]*)/g, function(match, name) { exportedNames.push(name); return 'class ' + name; });
        transformed = transformed.replace(/\bexport\s+default\s+/g, 'exports.default = ');
        transformed = transformed.replace(/\bexport\s*\{([^}]+)\}\s*;?/g, function(match, list) {
            return list.split(',').map(function(item) {
                const parts = item.trim().split(/\s+as\s+/);
                return 'exports.' + (parts[1] || parts[0]) + ' = ' + parts[0] + ';';
            }).join('\n');
        });
        if (isBuildEntry && !/(^|\n)\s*await\s+main\s*\(/.test(transformed)) {
            transformed = transformed.replace(/(^|\n)(\s*)main\(\)\.catch\(/, '$1$2await main().catch(');
            transformed = transformed.replace(/(^|\n)(\s*)main\(\)\s*;\s*$/m, '$1$2await main();');
        }
        if (exportedNames.length) transformed += '\n' + Array.from(new Set(exportedNames)).map(function(name) { return 'exports.' + name + ' = ' + name + ';'; }).join('\n');
        return transformed;
    }
    async function importModule(specifier, fromPath) {
        const resolved = resolveModule(specifier, fromPath || '/');
        if (resolved === 'node:fs/promises' || resolved === 'fs/promises') return Object.assign({ default: fsPromises }, fsPromises);
        if (resolved === 'node:fs' || resolved === 'fs') return Object.assign({ default: fsApi }, fsApi);
        if (resolved === 'node:path' || resolved === 'path') return Object.assign({ default: pathApi }, pathApi);
        if (resolved === 'node:url' || resolved === 'url') return Object.assign({ default: urlApi }, urlApi);
        if (resolved === 'node:crypto' || resolved === 'crypto') return Object.assign({ default: cryptoApi }, cryptoApi);
        if (resolved === 'node:process' || resolved === 'process') return Object.assign({ default: processApi }, processApi);
        if (resolved === 'prettier') return { default: { format: async function(value) { return value; } }, format: async function(value) { return value; } };
        if (moduleCache.has(resolved)) return moduleCache.get(resolved).exports;
        if (/\.json$/i.test(resolved)) {
            const parsed = JSON.parse(readText(resolved));
            const jsonModule = { exports: Object.assign({ default: parsed }, parsed) };
            moduleCache.set(resolved, jsonModule);
            return jsonModule.exports;
        }
        const module = { exports: {} };
        moduleCache.set(resolved, module);
        const source = transformModule(readText(resolved), resolved, resolved === absolute(payload.plan.buildPath.slice(rootPrefix.length)));
        const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
        const execute = new AsyncFunction('exports', 'module', '__import', '__filename', '__dirname', 'process', source + '\n//# sourceURL=sitefoundry-preview:' + resolved);
        await execute(module.exports, module, importModule, resolved, dirname(resolved), processApi);
        return module.exports;
    }

    const localBuildPath = absolute(normalize(payload.plan.buildPath).slice(rootPrefix.length));
    await importModule(localBuildPath, '/');
    if (processApi.exitCode) throw new Error('站点构建脚本返回错误状态 ' + processApi.exitCode + '。');

    const outputCandidates = ['/dist/', '/build/', '/out/', '/output/', '/export/', '/www/', '/_site/', '/public/', '/.output/public/', '/.vercel/output/static/'];
    const outputRoot = outputCandidates.find(function(candidate) { return files.has(candidate + 'index.html'); });
    if (!outputRoot) throw new Error('构建脚本已执行，但没有生成 dist、build、out、public 或其他可预览入口。');
    let omittedCount = 0;
    const outputEntries = [];
    Array.from(files.entries()).forEach(function(pair) {
        if (pair[0].indexOf(outputRoot) !== 0) return;
        const relativePath = pair[0].slice(1);
        // Embedded games are separate documents and cannot be rendered through a
        // srcdoc asset URL. Keeping them would multiply preview memory without
        // improving the host site's home/article preview.
        if (/(?:^|\/)vendor-games\//i.test(relativePath) || /\.(?:zip|rar|7z|pdf|map)$/i.test(relativePath)) {
            omittedCount += 1;
            return;
        }
        outputEntries.push({ path: outputPrefix + relativePath, bytes: pair[1] });
    });
    return {
        entries: outputEntries,
        entryPath: outputPrefix + outputRoot.slice(1) + 'index.html',
        outputRoot: outputPrefix + outputRoot.slice(1),
        omittedCount: omittedCount
    };
}

function safeBuilderEntries(entries, plan) {
    const root = normalizePreviewPath(plan.projectRoot || '');
    return (entries || []).filter(function(entry) {
        const path = normalizePreviewPath(entry.path);
        if (root && path.indexOf(root) !== 0) return false;
        const relative = path.slice(root.length);
        return !/(?:^|\/)(?:node_modules|\.git|\.tmp[^/]*|coverage)(?:\/|$)/i.test(relative);
    }).map(function(entry) {
        return { path: normalizePreviewPath(entry.path), bytes: entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes || []) };
    });
}

export async function buildPreviewSite(entries, options) {
    const plan = previewBuildPlan(entries);
    if (!plan) throw new Error('该源码包没有可在浏览器隔离环境中执行的 Node 静态生成脚本。');
    const payload = { plan: plan, entries: safeBuilderEntries(entries, plan), env: options && options.env || {} };
    if (typeof document === 'undefined' || !document.createElement) return runVirtualPreviewBuild(payload);

    return new Promise(function(resolve, reject) {
        const token = 'preview-build-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        const frame = document.createElement('iframe');
        frame.hidden = true;
        frame.setAttribute('sandbox', 'allow-scripts');
        const runnerSource = runVirtualPreviewBuild.toString();
        let settled = false;
        const timer = setTimeout(function() { finish(new Error('浏览器内预览构建超时。')); }, 90000);
        function finish(error, result) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            window.removeEventListener('message', onMessage);
            frame.remove();
            if (error) reject(error); else resolve(result);
        }
        function onMessage(event) {
            if (event.source !== frame.contentWindow || !event.data || event.data.token !== token) return;
            if (event.data.type === 'sitefoundry-preview-builder-ready') {
                frame.contentWindow.postMessage({ type: 'sitefoundry-preview-builder-run', token: token, payload: payload }, '*');
            } else if (event.data.type === 'sitefoundry-preview-builder-success') finish(null, event.data.result);
            else if (event.data.type === 'sitefoundry-preview-builder-error') finish(new Error(event.data.message || '浏览器内预览构建失败。'));
        }
        window.addEventListener('message', onMessage);
        frame.srcdoc = '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\'; connect-src \'none\'"><script>const runVirtualPreviewBuild=' + runnerSource + ';addEventListener("message",async function(event){if(event.source!==parent||!event.data||event.data.type!=="sitefoundry-preview-builder-run")return;const token=event.data.token;try{const result=await runVirtualPreviewBuild(event.data.payload);parent.postMessage({type:"sitefoundry-preview-builder-success",token:token,result:result},"*")}catch(error){parent.postMessage({type:"sitefoundry-preview-builder-error",token:token,message:error&&error.message?error.message:String(error)},"*")}});parent.postMessage({type:"sitefoundry-preview-builder-ready",token:' + JSON.stringify(token) + '},"*");<\/script>';
        document.body.appendChild(frame);
    });
}
