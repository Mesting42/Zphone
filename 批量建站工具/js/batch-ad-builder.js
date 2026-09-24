/*
 * 批量新建站 + 独占广告代码。
 * 这个模块只使用已经通过单站流程验证的 Generator 与 AdMigration：
 * 每个数据源仍然独立生成，外层 ZIP 只负责汇总，避免出现另一套广告模板。
 */
const BatchAdBuilder = (function() {
    'use strict';

    const REQUIRED_FIELDS = ['bannerPath1', 'bannerPath2', 'bannerPath3'];
    const AD_PATH_FIELDS = ['bannerPath1', 'bannerPath2', 'bannerPath3', 'bannerPath4', 'interstitialPath', 'anchorPath'];

    function issue(message, code) {
        return { message: message, code: code || 'BATCH_AD_INVALID' };
    }

    function normalizeData(data) {
        if (Array.isArray(data)) return data;
        if (data && typeof data === 'object') {
            const list = Object.keys(data).map(function(key) { return data[key]; }).find(Array.isArray);
            if (list) return list;
        }
        return [];
    }

    function collectFields(data) {
        const fields = {};
        normalizeData(data).forEach(function(item) {
            if (!item || typeof item !== 'object') return;
            Object.keys(item).forEach(function(key) {
                if (!fields[key]) fields[key] = typeof item[key];
            });
        });
        return Object.keys(fields).map(function(name) { return { name: name, type: fields[name] }; });
    }

    function autoMapFields(theme, fields) {
        const mapping = {};
        if (!theme || !Array.isArray(theme.fields)) return mapping;
        theme.fields.forEach(function(field) {
            const match = (fields || []).find(function(candidate) {
                const source = String(candidate.name || '').toLowerCase();
                return source === String(field.id || '').toLowerCase() || source === String(field.label || '').toLowerCase();
            });
            if (match) mapping[field.id] = match.name;
        });
        return mapping;
    }

    function codeUnitSignature(code) {
        const config = (code && code.config) || {};
        return AD_PATH_FIELDS.map(function(key) { return String(config[key] || '').trim(); }).join('|');
    }

    function codeHasRequiredSlots(code) {
        const config = (code && code.config) || {};
        return REQUIRED_FIELDS.every(function(key) { return !!config[key]; });
    }

    function validateAssignments(sites, codes) {
        const sourceSites = Array.from(sites || []);
        const sourceCodes = Array.from(codes || []);
        const codeById = {};
        const usage = {};
        const templateUsage = {};
        const errors = [];
        const assignments = [];

        sourceCodes.forEach(function(code) {
            if (!code || !code.id) return;
            codeById[code.id] = code;
        });
        sourceSites.forEach(function(site) {
            const code = codeById[site && site.codeId] || null;
            const templateId = String(site && site.config && site.config.templateId || '').trim();
            if (templateId) (templateUsage[templateId] = templateUsage[templateId] || []).push(site);
            if (!code) {
                errors.push(issue('站点“' + String(site && site.fileName || '未命名数据源') + '”尚未指定广告代码。', 'BATCH_AD_CODE_REQUIRED'));
            } else {
                usage[code.id] = (usage[code.id] || 0) + 1;
                if (!code.valid || !codeHasRequiredSlots(code)) {
                    errors.push(issue('广告代码“' + String(code.fileName || code.id) + '”未通过 banner1/2/3 完整性校验。', 'BATCH_AD_CODE_INVALID'));
                }
            }
            assignments.push({ site: site, code: code });
        });

        sourceCodes.forEach(function(code) {
            if (!code || !code.id) return;
            if (!usage[code.id]) errors.push(issue('广告代码“' + String(code.fileName || code.id) + '”没有分配给任何站点。', 'BATCH_AD_CODE_UNASSIGNED'));
            if (usage[code.id] > 1) errors.push(issue('广告代码“' + String(code.fileName || code.id) + '”被分配给多个站点。', 'BATCH_AD_CODE_REUSED'));
        });

        const signatures = {};
        const hosts = {};
        sourceCodes.filter(function(code) { return code && code.valid; }).forEach(function(code) {
            const signature = codeUnitSignature(code);
            const host = String(code.detectedHost || '').trim().toLowerCase();
            if (signature) {
                (signatures[signature] = signatures[signature] || []).push(code);
            }
            if (host) (hosts[host] = hosts[host] || []).push(code);
        });
        Object.keys(signatures).forEach(function(signature) {
            if (signatures[signature].length > 1) {
                errors.push(issue('检测到重复广告单元：' + signatures[signature].map(function(code) { return code.fileName || code.id; }).join('、') + '。每个站点必须使用独立广告代码。', 'BATCH_AD_UNIT_DUPLICATE'));
            }
        });
        Object.keys(hosts).forEach(function(host) {
            if (hosts[host].length > 1) {
                errors.push(issue('检测到多个广告代码指向同一子域名 ' + host + '。请为每个站点保留唯一代码。', 'BATCH_AD_HOST_DUPLICATE'));
            }
        });
        Object.keys(templateUsage).forEach(function(templateId) {
            if (templateUsage[templateId].length > 1) {
                errors.push(issue('检测到重复模板：' + templateUsage[templateId].map(function(site) { return site.fileName || site.id; }).join('、') + '。同一领域的批量站点必须使用不同模板。', 'BATCH_TEMPLATE_REUSED'));
            }
        });

        return { valid: errors.length === 0, errors: errors, assignments: assignments, codeUsage: usage, templateUsage: templateUsage };
    }

    function validateGeneratedSiteFiles(files, code) {
        const errors = [];
        const fileMap = files || {};
        const home = fileMap['website/index.html'];
        const details = Object.keys(fileMap).filter(function(path) { return /^website\/details\/.*\.html?$/i.test(path); }).sort().map(function(path) { return fileMap[path]; });
        const adJs = fileMap['website/js/ad.js'];
        if (!home) errors.push(issue('导出包缺少首页 index.html。', 'BATCH_AD_HOME_MISSING'));
        if (!details.length) errors.push(issue('导出包缺少详情页，无法确认详情页广告运行时。', 'BATCH_AD_DETAIL_MISSING'));
        if (!adJs) errors.push(issue('导出包缺少 js/ad.js。', 'BATCH_AD_RUNTIME_MISSING'));
        if (home && details.length && typeof AdMigration !== 'undefined') {
            const report = AdMigration.validateGeneratedPages(home, details);
            report.errors.forEach(function(error) { errors.push(issue(error.message, error.code)); });
        }
        if (adJs) {
            const config = (code && code.config) || {};
            REQUIRED_FIELDS.forEach(function(key) {
                if (config[key] && String(adJs).indexOf(String(config[key])) === -1) {
                    errors.push(issue('生成的 js/ad.js 未包含 ' + key + ' 对应的广告单元。', 'BATCH_AD_RUNTIME_PATH_MISSING'));
                }
            });
        }
        return { valid: errors.length === 0, errors: errors, detailCount: details.length };
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value || {}));
    }

    function safeFolderName(value, fallback, used) {
        let base = String(value || fallback || 'website').replace(/\.[^.]+$/, '').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || fallback || 'website';
        let result = base;
        let index = 2;
        while (used[result]) result = base + '-' + index++;
        used[result] = true;
        return result;
    }

    function createSiteState(appState, site, code) {
        // 批量预览允许每个站点独立选择模板和样式；导出必须采用该站点的配置，
        // 而不是导出瞬间停留在界面上的另一个站点配置。
        const config = clone(site && site.config ? site.config : appState.config);
        const host = String(code.detectedHost || '').trim().toLowerCase();
        // 每份广告代码指向独立域名；导出的联系邮箱也随站点变化，避免一批站共享默认地址。
        if (host) config.contactEmail = 'contact@' + host;
        // “全部文章”是普通单站工作流的开关；批量建站加广告暂不改变导出页面集合。
        config.allArticlesEnabled = false;
        config.adPaths = clone(code.config);
        config.adPlacements = typeof AdMigration !== 'undefined' ? AdMigration.fixedPlacements() : {};
        return Object.assign({}, appState, {
            siteBuildMode: 'normal',
            // 批量站点可来自不同领域；导出时必须使用该站自己的领域，不能沿用
            // 当前界面停留站点的 selectedTheme，否则会导致字段与模板被错误解释。
            selectedTheme: site.themeId || appState.selectedTheme,
            data: site.data,
            jsonFields: site.jsonFields || collectFields(site.data),
            fieldMapping: clone(site.fieldMapping),
            isLocalImages: !!site.isLocalImages,
            localImages: site.localImages || {},
            adCodeMigration: code,
            config: config
        });
    }

    async function readZipTextFiles(blob, JSZipImpl) {
        // 将 Blob 先转为 ArrayBuffer，既避开跨 Realm 的 Blob 类型判断差异，
        // 也保证批量导出在浏览器内嵌环境中能稳定重新读取刚生成的 ZIP。
        const archive = blob && typeof blob.arrayBuffer === 'function' ? await blob.arrayBuffer() : blob;
        const zip = await JSZipImpl.loadAsync(archive);
        const result = {};
        const paths = Object.keys(zip.files).filter(function(path) { return !zip.files[path].dir; });
        await Promise.all(paths.map(async function(path) {
            if (/\.(?:html?|js)$/i.test(path)) result[path] = await zip.files[path].async('text');
        }));
        return { zip: zip, textFiles: result, paths: paths };
    }

    async function exportBatch(appState, onProgress, JSZipImpl) {
        const batch = appState && appState.batchAdBuild || {};
        const validation = validateAssignments(batch.sites, batch.codes);
        if (!validation.valid) throw new Error(validation.errors.map(function(error) { return error.message; }).join(' '));
        if (!JSZipImpl || typeof JSZipImpl.loadAsync !== 'function' || typeof Generator === 'undefined') {
            throw new Error('批量导出组件未加载。请刷新页面后重试。');
        }
        const outer = new JSZipImpl();
        const reports = [];
        const usedFolders = {};
        const count = validation.assignments.length;

        for (let index = 0; index < count; index++) {
            const assignment = validation.assignments[index];
            const label = assignment.site.fileName || ('site-' + (index + 1));
            onProgress(Math.round(index / count * 85), '正在生成并验证 ' + label + '（' + (index + 1) + '/' + count + '）…');
            const siteState = createSiteState(appState, assignment.site, assignment.code);
            const siteBlob = await Generator.exportWebsite(siteState, function(percent) {
                onProgress(Math.min(90, Math.round((index + percent / 100) / count * 85)), '正在生成 ' + label + '（' + (index + 1) + '/' + count + '）…');
            });
            const inspected = await readZipTextFiles(siteBlob, JSZipImpl);
            const runtime = validateGeneratedSiteFiles(inspected.textFiles, assignment.code);
            if (!runtime.valid) {
                throw new Error('站点“' + label + '”运行时广告检查未通过：' + runtime.errors.map(function(error) { return error.message; }).join(' '));
            }
            const folderName = safeFolderName(assignment.code.detectedHost || label, 'site-' + (index + 1), usedFolders);
            const folder = outer.folder(folderName);
            for (const path of inspected.paths) {
                const relative = path.replace(/^website\//, '');
                if (!relative || relative === path && path.indexOf('/') === -1) continue;
                folder.file(relative, await inspected.zip.files[path].async('uint8array'));
            }
            reports.push({ folder: folderName, dataSource: label, adCodeFile: assignment.code.fileName || '', adHost: assignment.code.detectedHost || '', detailPages: runtime.detailCount, valid: true });
        }

        outer.file('BATCH_AD_EXPORT_REPORT.json', JSON.stringify({
            schema: 'sitefoundry-batch-ad-export/v1',
            generatedAt: new Date().toISOString(),
            rule: 'Each site has one validated, non-reused advertisement code. Home and detail pages were validated after generation.',
            sites: reports
        }, null, 2) + '\n');
        onProgress(93, '所有站点广告运行时检查通过，正在打包总 ZIP…');
        const blob = await outer.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }, function(metadata) {
            onProgress(93 + Math.round(metadata.percent * 0.07), '正在压缩批量站点…');
        });
        onProgress(100, '批量站点导出完成');
        return { blob: blob, reports: reports };
    }

    return {
        normalizeData: normalizeData,
        collectFields: collectFields,
        autoMapFields: autoMapFields,
        codeUnitSignature: codeUnitSignature,
        validateAssignments: validateAssignments,
        validateGeneratedSiteFiles: validateGeneratedSiteFiles,
        createSiteState: createSiteState,
        exportBatch: exportBatch
    };
})();
