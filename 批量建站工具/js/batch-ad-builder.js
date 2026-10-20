/*
 * 批量建站广告编排器。
 *
 * 两种接入方式共用同一个导出入口：
 * 1. code：每个站点绑定一份独占广告 TXT；
 * 2. reserve：先输出广告容器与空配置 ad.js，运营拿到代码后只需填写 ID。
 *
 * 站点生成仍完全复用单站 Generator，避免批量流程维护第二套页面和广告模板。
 */
const BatchAdBuilder = (function() {
    'use strict';

    const REQUIRED_FIELDS = ['bannerPath1', 'bannerPath2', 'bannerPath3'];
    const AD_PATH_FIELDS = ['bannerPath1', 'bannerPath2', 'bannerPath3', 'bannerPath4', 'interstitialPath', 'anchorPath'];
    const PLACEHOLDER_DOMAIN = 'your-domain.com';
    const HOST_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

    function issue(message, code) {
        return { message: message, code: code || 'BATCH_AD_INVALID' };
    }

    function normalizeData(data) {
        // Prefer conventional content keys over unrelated metadata arrays. The
        // depth limit also prevents malformed wrappers from blocking the UI.
        const preferred = ['articles', 'items', 'records', 'results', 'games', 'posts', 'data', 'list'];
        function find(value, depth) {
            if (Array.isArray(value)) return value;
            if (!value || typeof value !== 'object' || depth > 6) return null;
            const keys = preferred.filter(function(key) { return Object.hasOwn(value, key); })
                .concat(Object.keys(value).filter(function(key) { return preferred.indexOf(key) < 0; }));
            for (const key of keys) {
                const result = find(value[key], depth + 1);
                if (result && result.some(function(row) { return row && typeof row === 'object' && !Array.isArray(row); })) return result;
            }
            return null;
        }
        const rows = find(data, 0) || [];
        const invalid = rows.findIndex(function(row) { return !row || typeof row !== 'object' || Array.isArray(row); });
        if (invalid >= 0) throw new Error('数据源第 ' + (invalid + 1) + ' 条不是有效对象。请修正该条记录后重新上传；其余记录不会被静默丢弃。');
        return rows;
    }

    // Flatten scalar leaves without guessing how arrays of tags should render.
    // The original nested object is retained for integrations using raw data.
    function flattenRecords(data) {
        return normalizeData(data).map(function(row) {
            const copy = Object.assign({}, row);
            function visit(value, prefix, depth) {
                if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 4) return;
                Object.keys(value).forEach(function(key) {
                    const field = prefix ? prefix + '.' + key : key;
                    if (value[key] && typeof value[key] === 'object' && !Array.isArray(value[key])) visit(value[key], field, depth + 1);
                    else if (!Object.hasOwn(copy, field)) copy[field] = value[key];
                });
            }
            visit(row, '', 0);
            return copy;
        });
    }

    function prepareSource(data, images) {
        const rows = flattenRecords(data);
        const source = images || {};
        const keys = Object.keys(source);
        const output = {};
        const names = {};
        keys.forEach(function(key, index) {
            const base = key.replace(/\\/g, '/').split('/').pop();
            // Prefixing each archive asset avoids collisions between a/1.webp
            // and b/1.webp, while keeping generated URLs readable and portable.
            const name = index + '-' + base;
            names[key] = name;
            output['images/' + name] = source[key];
        });
        function resolve(value) {
            if (typeof value !== 'string' || /^(?:https?:|data:|blob:|\/\/)/i.test(value)) return value;
            const path = value.replace(/\\/g, '/').replace(/^\.\//, '').split(/[?#]/)[0];
            if (!/\.(?:png|jpe?g|webp|gif|svg|avif)$/i.test(path)) return value;
            const matches = keys.filter(function(key) {
                const normalized = key.replace(/\\/g, '/');
                return normalized === path || normalized.endsWith('/' + path);
            });
            const candidates = matches.length ? matches : keys.filter(function(key) { return key.replace(/\\/g, '/').split('/').pop() === path.split('/').pop(); });
            if (candidates.length > 1) throw new Error('图片路径存在歧义：' + value + '。请在 JSON 中填写完整相对路径。');
            return candidates.length === 1 ? 'images/' + names[candidates[0]] : value;
        }
        return { data: rows.map(function(row) {
            const copy = Object.assign({}, row);
            Object.keys(copy).forEach(function(key) { copy[key] = resolve(copy[key]); });
            return copy;
        }), localImages: output };
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

    async function selectDataJson(entries, readText) {
        const candidates = Array.from(entries || []).filter(function(entry) { return /\.json$/i.test(entry.path); });
        candidates.sort(function(a, b) {
            function priority(entry) {
                return /(?:^|\/)(?:data|articles?|posts?|games?|items?|records?)(?:[_-][^/]*)?\.json$/i.test(entry.path) ? 0 : 1;
            }
            return priority(a) - priority(b) || a.path.localeCompare(b.path);
        });
        let firstError;
        for (const entry of candidates) {
            try {
                const parsed = JSON.parse(String(await readText(entry)).replace(/^\uFEFF/, ''));
                if (normalizeData(parsed).length) return entry;
            } catch (error) { if (!firstError) firstError = error; }
        }
        throw new Error(firstError ? '未找到可用的数据列表：' + firstError.message : '压缩包中未找到包含对象列表的 JSON 数据文件。');
    }

    function autoMapFields(theme, fields) {
        const mapping = {};
        const aliases = {
            title: ['headline', 'name', '标题', 'article_title'], content: ['body', 'text', '正文', 'article_content', 'description'],
            image: ['cover', 'thumbnail', 'thumb', 'picture', 'image_url', 'cover_url', '封面'],
            excerpt: ['summary', 'abstract', '简介'], category: ['section', 'topic', '分类'],
            published_at: ['date', 'publish_date', 'created_at'], source_url: ['source', 'url', 'link'],
            id: ['identifier', 'post_id', 'article_id'], author: ['writer', '作者'], date: ['published_at', 'publish_date', 'created_at', '日期']
        };
        if (!theme || !Array.isArray(theme.fields)) return mapping;
        theme.fields.forEach(function(field) {
            const match = (fields || []).find(function(candidate) {
                const source = String(candidate.name || '').toLowerCase();
                return candidate.type !== 'object' && (source === String(field.id || '').toLowerCase() || source === String(field.label || '').toLowerCase());
            });
            const alias = !match && (fields || []).find(function(candidate) {
                const leaf = String(candidate.name || '').toLowerCase().split('.').pop();
                const nestedImage = field.id === 'image' && /(?:^|\.)(?:image|cover|thumbnail)\.(?:url|src)$/i.test(candidate.name);
                const nestedBody = field.id === 'content' && /(?:^|\.)(?:content|body)\.rendered$/i.test(candidate.name);
                return candidate.type !== 'object' && (nestedImage || nestedBody || (aliases[field.id] || []).indexOf(leaf) >= 0 || leaf === field.id);
            });
            if (match || alias) mapping[field.id] = (match || alias).name;
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

    function normalizeAdMode(value) {
        return value === 'reserve' ? 'reserve' : 'code';
    }

    function normalizeDomainInput(value) {
        const raw = String(value || '').trim();
        const normalized = raw.toLowerCase().replace(/\.$/, '');
        const valid = !!normalized && normalized.length <= 253 && HOST_PATTERN.test(normalized);
        return {
            raw: raw,
            normalized: valid ? normalized : '',
            valid: valid,
            effective: valid ? normalized : PLACEHOLDER_DOMAIN,
            placeholder: !valid,
            warning: !raw ? '未填写域名，将使用占位域名 ' + PLACEHOLDER_DOMAIN + '。' : (!valid ? '域名格式无法识别，将使用占位域名 ' + PLACEHOLDER_DOMAIN + '。' : '')
        };
    }

    function normalizeReserveSettings(settings) {
        const source = settings || {};
        return {
            placementMode: source.placementMode === 'fixed' ? 'fixed' : 'manual',
            adJsVersion: String(source.adJsVersion || 'v1.0.2.1'),
            adPlacements: typeof AdMigration !== 'undefined' ? AdMigration.normalizePagePlacements(source.adPlacements || {}) : clone(source.adPlacements || {})
        };
    }

    function resolveReserveSettings(batch, site) {
        const source = site && site.reserveOverrideEnabled && site.reserveSettings
            ? site.reserveSettings
            : (batch && batch.reserveDefaults);
        return normalizeReserveSettings(source);
    }

    function normalizeCodePlacementSettings(settings) {
        const source = settings || {};
        const placementMode = source.placementMode === 'manual' ? 'manual' : 'fixed';
        const suppliedPlacements = source.adPlacements;
        const hasPlacementMap = suppliedPlacements && typeof suppliedPlacements === 'object' && !Array.isArray(suppliedPlacements);
        return {
            placementMode: placementMode,
            // 兼容旧会话：手动模式尚无位置表时从自动位置开始；显式空对象仍代表用户移除全部广告位。
            adPlacements: hasPlacementMap
                ? (typeof AdMigration !== 'undefined' ? AdMigration.normalizePagePlacements(suppliedPlacements) : clone(suppliedPlacements))
                : (placementMode === 'manual' && typeof AdMigration !== 'undefined' ? AdMigration.fixedPlacements() : null)
        };
    }

    function resolveCodePlacementSettings(batch, site) {
        const source = site && site.codePlacementOverrideEnabled && site.codePlacementSettings
            ? site.codePlacementSettings
            : (batch && batch.codePlacementDefaults);
        return normalizeCodePlacementSettings(source);
    }

    function countReservedPlacements(settings, includeAllArticles) {
        // 关闭列表页时，其保存的位置不计入实际导出数量，也不能单独满足预留要求。
        const includeAll = includeAllArticles !== false;
        if (settings && settings.placementMode === 'fixed') return includeAll ? 9 : 6;
        const placements = settings && settings.adPlacements || {};
        return Object.keys(placements).reduce(function(total, adId) {
            const pages = placements[adId] || {};
            return total + (pages.home ? 1 : 0) + (pages.detail ? 1 : 0) + (includeAll && pages.all ? 1 : 0);
        }, 0);
    }

    function collectTemplateErrors(sourceSites) {
        const templateUsage = {};
        const errors = [];
        sourceSites.forEach(function(site) {
            // Legacy sites assemble options rather than occupying a blueprint.
            if (site && site.config && site.config.editorialTemplateVersion === 'legacy') return;
            const templateId = String(site && site.config && site.config.templateId || '').trim();
            if (templateId) (templateUsage[templateId] = templateUsage[templateId] || []).push(site);
        });
        Object.keys(templateUsage).forEach(function(templateId) {
            if (templateUsage[templateId].length > 1) {
                errors.push(issue('检测到重复模板：' + templateUsage[templateId].map(function(site) { return site.fileName || site.id; }).join('、') + '。同一领域的批量站点必须使用不同模板。', 'BATCH_TEMPLATE_REUSED'));
            }
        });
        return { errors: errors, templateUsage: templateUsage };
    }

    function validateCodeAssignments(sourceSites, sourceCodes) {
        const codeById = {};
        const usage = {};
        const errors = [];
        const assignments = [];

        sourceCodes.forEach(function(code) {
            if (!code || !code.id) return;
            codeById[code.id] = code;
        });
        sourceSites.forEach(function(site) {
            const code = codeById[site && site.codeId] || null;
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
        const templateReport = collectTemplateErrors(sourceSites);
        Array.prototype.push.apply(errors, templateReport.errors);

        return { valid: errors.length === 0, mode: 'code', errors: errors, warnings: [], assignments: assignments, codeUsage: usage, templateUsage: templateReport.templateUsage };
    }

    function validateReserveAssignments(sourceSites, batch) {
        const errors = [];
        const warnings = [];
        const domains = {};
        const assignments = sourceSites.map(function(site) {
            const domain = normalizeDomainInput(site && site.adDomain);
            const settings = resolveReserveSettings(batch, site);
            if (!countReservedPlacements(settings, !(site && site.config && site.config.allArticlesEnabled === false))) {
                errors.push(issue('站点“' + String(site && site.fileName || '未命名数据源') + '”尚未放置广告位。', 'BATCH_RESERVE_PLACEMENT_REQUIRED'));
            }
            if (domain.valid) {
                (domains[domain.normalized] = domains[domain.normalized] || []).push(site);
            } else if (domain.warning) {
                warnings.push(issue('站点“' + String(site && site.fileName || '未命名数据源') + '”：' + domain.warning, 'BATCH_DOMAIN_PLACEHOLDER'));
            }
            return { site: site, code: null, domain: domain, reserveSettings: settings };
        });
        Object.keys(domains).forEach(function(host) {
            if (domains[host].length > 1) {
                errors.push(issue('域名 ' + host + ' 被多个站点重复使用。请修改为唯一域名后再导出。', 'BATCH_DOMAIN_DUPLICATE'));
            }
        });
        const templateReport = collectTemplateErrors(sourceSites);
        Array.prototype.push.apply(errors, templateReport.errors);
        return { valid: errors.length === 0, mode: 'reserve', errors: errors, warnings: warnings, assignments: assignments, domainUsage: domains, templateUsage: templateReport.templateUsage };
    }

    function validateAssignments(sites, codes, options) {
        const sourceSites = Array.from(sites || []);
        const sourceCodes = Array.from(codes || []);
        const batch = options && typeof options === 'object' ? options : {};
        return normalizeAdMode(batch.adMode) === 'reserve'
            ? validateReserveAssignments(sourceSites, batch)
            : validateCodeAssignments(sourceSites, sourceCodes);
    }

    function countContainer(html, id) {
        const escaped = String(id || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const matches = String(html || '').match(new RegExp('id=["\']' + escaped + '["\']', 'gi'));
        return matches ? matches.length : 0;
    }

    function validateReservedPage(html, pageType, settings) {
        const errors = [];
        const label = pageType === 'home' ? '首页' : pageType === 'all' ? '全部文章页' : '详情页';
        const expectedScript = pageType === 'detail' ? '../js/ad.js' : 'js/ad.js';
        const gptCount = (String(html || '').match(/securepubads\.g\.doubleclick\.net\/tag\/js\/gpt\.js/gi) || []).length;
        const adScriptCount = (String(html || '').match(new RegExp(expectedScript.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
        if (gptCount !== 1) errors.push(issue(label + ' GPT 脚本数量为 ' + gptCount + '，应为 1。', 'BATCH_RESERVE_GPT_INVALID'));
        if (adScriptCount !== 1) errors.push(issue(label + ' ad.js 引用数量为 ' + adScriptCount + '，应为 1。', 'BATCH_RESERVE_RUNTIME_REF_INVALID'));
        const placements = settings && settings.placementMode === 'fixed' && typeof AdMigration !== 'undefined'
            ? AdMigration.fixedPlacements()
            : (typeof AdMigration !== 'undefined' ? AdMigration.normalizePagePlacements(settings && settings.adPlacements || {}) : settings && settings.adPlacements || {});
        ['adv1', 'adv2', 'adv3'].forEach(function(adId, index) {
            const expected = placements[adId] && placements[adId][pageType] ? 1 : 0;
            const actual = countContainer(html, 'div-gpt-ad-banner' + (index + 1));
            if (actual !== expected) {
                errors.push(issue(label + ' banner' + (index + 1) + ' 容器数量为 ' + actual + '，应为 ' + expected + '。', 'BATCH_RESERVE_CONTAINER_INVALID'));
            }
        });
        return errors;
    }

    function validateGeneratedSiteFiles(files, code, options) {
        const errors = [];
        const fileMap = files || {};
        const root = String(options && options.siteRoot || 'website').replace(/\/+$/, '') + '/';
        const home = fileMap[root + 'index.html'];
        const details = Object.keys(fileMap).filter(function(path) { return path.indexOf(root + 'details/') === 0 && /\.html?$/i.test(path); }).sort().map(function(path) { return fileMap[path]; });
        const listing = fileMap[root + 'all-articles.html'];
        const adJs = fileMap[root + 'js/ad.js'];
        if (!home) errors.push(issue('导出包缺少首页 index.html。', 'BATCH_AD_HOME_MISSING'));
        if (!details.length) errors.push(issue('导出包缺少详情页，无法确认详情页广告运行时。', 'BATCH_AD_DETAIL_MISSING'));
        if (!adJs) errors.push(issue('导出包缺少 js/ad.js。', 'BATCH_AD_RUNTIME_MISSING'));
        const reserve = options && options.mode === 'reserve';
        if (home && details.length) {
            if (reserve) {
                validateReservedPage(home, 'home', options.settings).forEach(function(error) { errors.push(error); });
                details.forEach(function(html, index) {
                    validateReservedPage(html, 'detail', options.settings).forEach(function(error) {
                        errors.push(issue('详情页 #' + (index + 1) + '：' + error.message, error.code));
                    });
                });
                if (listing) validateReservedPage(listing, 'all', options.settings).forEach(function(error) { errors.push(error); });
            } else if (typeof AdMigration !== 'undefined') {
                const placements = options && options.placements || AdMigration.fixedPlacements();
                const report = AdMigration.validateGeneratedPages(home, details, placements);
                report.errors.forEach(function(error) { errors.push(issue(error.message, error.code)); });
                if (listing) AdMigration.validateGeneratedPage(listing, 'all', placements).forEach(function(error) { errors.push(issue(error.message, error.code)); });
            }
        }
        if (adJs && !reserve) {
            const config = (code && code.config) || {};
            REQUIRED_FIELDS.forEach(function(key) {
                if (config[key] && String(adJs).indexOf(String(config[key])) === -1) {
                    errors.push(issue('生成的 js/ad.js 未包含 ' + key + ' 对应的广告单元。', 'BATCH_AD_RUNTIME_PATH_MISSING'));
                }
            });
        } else if (adJs && reserve) {
            // 预留模式必须保持脚本模板完整但 ID 为空，确保运营后续只改 ad.js 即可启用。
            const inspected = typeof AdMigration !== 'undefined' && typeof AdMigration.inspectAdCodeText === 'function'
                ? AdMigration.inspectAdCodeText(String(adJs), 'ad.js')
                : null;
            const discovered = inspected && inspected.config || {};
            const hasConfiguredId = AD_PATH_FIELDS.concat(['analyticsID']).some(function(key) {
                return !!String(discovered[key] || '').trim();
            }) || /["']\/\d{3,}\/[^"']+["']/.test(String(adJs)) || /["']G-[A-Z0-9]+["']/i.test(String(adJs));
            if (hasConfiguredId) errors.push(issue('预留模式生成的 js/ad.js 含有非空广告或统计 ID。', 'BATCH_RESERVE_RUNTIME_NOT_EMPTY'));
        }
        return { valid: errors.length === 0, errors: errors, detailCount: details.length };
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value || {}));
    }

    function createSiteState(appState, site, code, batch) {
        // 批量预览允许每个站点独立选择模板和样式；导出必须采用该站点的配置，
        // 而不是导出瞬间停留在界面上的另一个站点配置。
        const config = clone(site && site.config ? site.config : appState.config);
        const reserve = normalizeAdMode(batch && batch.adMode) === 'reserve';
        const domain = reserve ? normalizeDomainInput(site && site.adDomain) : null;
        const settings = reserve ? resolveReserveSettings(batch, site) : null;
        const codePlacementSettings = reserve ? null : resolveCodePlacementSettings(batch, site);
        const host = reserve ? domain.effective : String(code && code.detectedHost || '').trim().toLowerCase();
        // 每份广告代码指向独立域名；导出的联系邮箱也随站点变化，避免一批站共享默认地址。
        if (host) config.contactEmail = 'contact@' + host;
        // 批量站点同样提供完整内容列表，沿用各站显式开关，默认开启。
        config.allArticlesEnabled = config.allArticlesEnabled !== false;
        config.adPaths = reserve ? {} : clone(code && code.config);
        config.adPlacements = reserve ? clone(settings.adPlacements) : (typeof AdMigration !== 'undefined' ? AdMigration.fixedPlacements() : {});
        config.adCodePlacements = reserve || codePlacementSettings.adPlacements === null
            ? null
            : clone(codePlacementSettings.adPlacements);
        return Object.assign({}, appState, {
            siteBuildMode: 'normal',
            normalAdMode: reserve ? 'reserve' : 'code',
            reservePlacementMode: reserve ? settings.placementMode : appState.reservePlacementMode,
            directAdPlacementMode: reserve ? 'fixed' : codePlacementSettings.placementMode,
            adJsVersion: reserve ? settings.adJsVersion : appState.adJsVersion,
            // 批量站点可来自不同领域；导出时必须使用该站自己的领域，不能沿用
            // 当前界面停留站点的 selectedTheme，否则会导致字段与模板被错误解释。
            selectedTheme: site.themeId || appState.selectedTheme,
            data: site.data,
            jsonFields: site.jsonFields || collectFields(site.data),
            fieldMapping: clone(site.fieldMapping),
            isLocalImages: !!site.isLocalImages,
            localImages: site.localImages || {},
            adCodeMigration: reserve ? null : code,
            // 每个批量站点只与自己的最后预览比较，不能继承当前界面停留站点的签名。
            _lastPreviewSignature: site.previewSignature || '',
            config: config
        });
    }

    async function readZipTextFiles(blob, JSZipImpl) {
        // 将 Blob 先转为 ArrayBuffer，既避开跨 Realm 的 Blob 类型判断差异，
        // 也保证批量导出在浏览器内嵌环境中能稳定重新读取刚生成的 ZIP。
        const archive = blob && typeof blob.arrayBuffer === 'function' ? await blob.arrayBuffer() : blob;
        // Fresh generator archives are already readable by JSZip. Inspect those
        // entries directly instead of compressing and immediately decompressing.
        const zip = archive && archive.files && typeof archive.file === 'function'
            ? archive : await JSZipImpl.loadAsync(archive);
        const result = {};
        const paths = Object.keys(zip.files).filter(function(path) { return !zip.files[path].dir; });
        await Promise.all(paths.map(async function(path) {
            if (/\.(?:html?|css|mjs|cjs|js|jsx|ts|tsx)$/i.test(path) || /(?:^|\/)(?:data|manifest|ad-policy|site|config)\.json$/i.test(path)) {
                result[path] = await zip.files[path].async('text');
            }
        }));
        return { zip: zip, textFiles: result, paths: paths };
    }

    async function exportBatch(appState, onProgress, JSZipImpl) {
        const batch = appState && appState.batchAdBuild || {};
        const validation = validateAssignments(batch.sites, batch.codes, batch);
        if (!validation.valid) throw new Error(validation.errors.map(function(error) { return error.message; }).join(' '));
        if (!JSZipImpl || typeof JSZipImpl.loadAsync !== 'function' || typeof Generator === 'undefined' || typeof ArchiveNaming === 'undefined') {
            throw new Error('批量导出组件未加载。请刷新页面后重试。');
        }
        const reports = [];
        const preflightReports = [];
        const runtimeFailures = [];
        const siteArchives = [];
        const usedFileNames = Object.create(null);
        const count = validation.assignments.length;
        if (!count) throw new Error('没有可导出的批量站点。');

        for (let index = 0; index < count; index++) {
            const assignment = validation.assignments[index];
            const label = assignment.site.fileName || ('site-' + (index + 1));
            onProgress(Math.round(index / count * 85), '正在生成并验证 ' + label + '（' + (index + 1) + '/' + count + '）…');
            const siteState = createSiteState(appState, assignment.site, assignment.code, batch);
            const fallbackName = label.replace(/\.[^.]+$/, '') || ('site-' + (index + 1));
            const exportHost = validation.mode === 'reserve' ? assignment.domain.effective : assignment.code.detectedHost;
            const fileName = ArchiveNaming.uniqueZipFileName(exportHost, fallbackName, usedFileNames);
            const siteFolderName = ArchiveNaming.siteZipDescriptor(exportHost, fallbackName).siteFolderName;
            const directArchive = typeof Generator.createWebsiteArchive === 'function';
            const generateSite = directArchive ? Generator.createWebsiteArchive : Generator.exportWebsite;
            const siteBlob = await generateSite(siteState, function(percent) {
                onProgress(Math.min(90, Math.round((index + percent / 100) / count * 85)), '正在生成 ' + label + '（' + (index + 1) + '/' + count + '）…');
            }, directArchive ? { siteFolderName: siteFolderName } : undefined);
            const inspected = await readZipTextFiles(siteBlob, JSZipImpl);
            const preflight = typeof SiteExportPreflight !== 'undefined'
                ? SiteExportPreflight.inspectEntries(inspected.textFiles, { paths: inspected.paths, siteName: label })
                : { valid: false, siteName: label, pageCount: 0, localReferenceCount: 0, fileCount: inspected.paths.length, errors: [{ message: '导出前全站体检组件未加载。' }], warnings: [] };
            preflightReports.push(preflight);
            const runtime = validateGeneratedSiteFiles(inspected.textFiles, assignment.code, {
                siteRoot: directArchive ? siteFolderName : 'website',
                mode: validation.mode,
                settings: assignment.reserveSettings || null,
                placements: Generator.buildConfig(siteState).adPlacements
            });
            if (!runtime.valid) {
                runtimeFailures.push('站点“' + label + '”运行时广告检查未通过：' + runtime.errors.map(function(error) { return error.message; }).join(' '));
            }
            const siteZip = directArchive ? inspected.zip : new JSZipImpl();
            if (!directArchive) {
                const siteFolder = siteZip.folder(siteFolderName);
                for (const path of inspected.paths) {
                    const relative = path.replace(/^website\//, '');
                    if (!relative || relative === path && path.indexOf('/') === -1) continue;
                    siteFolder.file(relative, await inspected.zip.files[path].async('uint8array'));
                }
            }
            siteArchives.push({ zip: siteZip, siteFolderName: siteFolderName, fileName: fileName, dataSource: label, adHost: exportHost || '' });
            reports.push({
                fileName: fileName,
                dataSource: label,
                mode: validation.mode,
                adCodeFile: assignment.code && assignment.code.fileName || '',
                adHost: exportHost || '',
                domainPlaceholder: !!(assignment.domain && assignment.domain.placeholder),
                reserveScope: validation.mode === 'reserve' ? (assignment.site.reserveOverrideEnabled ? 'site' : 'global') : '',
                adJsVersion: assignment.reserveSettings && assignment.reserveSettings.adJsVersion || siteState.adJsVersion,
                detailPages: runtime.detailCount,
                valid: runtime.valid && preflight.valid,
                preflight: preflight
            });
        }

        const preflightReport = typeof SiteExportPreflight !== 'undefined'
            ? SiteExportPreflight.combine(preflightReports)
            : { valid: false, siteCount: preflightReports.length, pageCount: 0, localReferenceCount: 0, fileCount: 0, errors: [{ message: '导出前全站体检组件未加载。' }], warnings: [], sites: preflightReports };
        if (!preflightReport.valid) {
            if (typeof SiteExportPreflight !== 'undefined') throw SiteExportPreflight.createBlockingError(preflightReport);
            throw new Error(preflightReport.errors.map(function(error) { return error.message; }).join(' '));
        }
        if (runtimeFailures.length) {
            const error = new Error(runtimeFailures.join('\n'));
            error.preflightReport = preflightReport;
            throw error;
        }

        onProgress(85, '所有站点广告运行时检查通过，正在分别打包域名 ZIP…');
        const downloads = [];
        const generatedAt = new Date().toISOString();
        for (let index = 0; index < siteArchives.length; index++) {
            const siteArchive = siteArchives[index];
            // 每个站点独立成包；保留原有机器可读报告，但报告只包含该站点的数据。
            siteArchive.zip.folder(siteArchive.siteFolderName).file('BATCH_AD_EXPORT_REPORT.json', JSON.stringify({
                schema: 'sitefoundry-batch-ad-export/v2',
                generatedAt: generatedAt,
                mode: validation.mode,
                rule: validation.mode === 'reserve'
                    ? 'Each site exports reserved advertisement containers and an empty ad.js. Valid domains must be unique; missing or invalid domains use your-domain.com.'
                    : 'Each site has one validated, non-reused advertisement code. Home, detail and all-articles pages were validated after generation.',
                preflight: reports[index].preflight,
                sites: [reports[index]]
            }, null, 2) + '\n');
            const pack = typeof ArchiveExport !== 'undefined' ? ArchiveExport.generate : function(archive, options, progress) { return archive.generateAsync(options, progress); };
            const blob = await pack(siteArchive.zip, { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }, function(metadata) {
                const fraction = (index + metadata.percent / 100) / siteArchives.length;
                onProgress(85 + Math.round(fraction * 15), '正在压缩 ' + siteArchive.fileName + '（' + (index + 1) + '/' + siteArchives.length + '）…');
            });
            downloads.push({ blob: blob, fileName: siteArchive.fileName, dataSource: siteArchive.dataSource, adHost: siteArchive.adHost });
        }
        onProgress(100, '批量站点已分别打包完成');
        return { downloads: downloads, reports: reports, preflightReport: preflightReport };
    }

    return {
        normalizeData: normalizeData,
        prepareSource: prepareSource,
        selectDataJson: selectDataJson,
        collectFields: collectFields,
        autoMapFields: autoMapFields,
        codeUnitSignature: codeUnitSignature,
        normalizeAdMode: normalizeAdMode,
        normalizeDomainInput: normalizeDomainInput,
        normalizeReserveSettings: normalizeReserveSettings,
        resolveReserveSettings: resolveReserveSettings,
        normalizeCodePlacementSettings: normalizeCodePlacementSettings,
        resolveCodePlacementSettings: resolveCodePlacementSettings,
        countReservedPlacements: countReservedPlacements,
        placeholderDomain: PLACEHOLDER_DOMAIN,
        validateAssignments: validateAssignments,
        validateGeneratedSiteFiles: validateGeneratedSiteFiles,
        createSiteState: createSiteState,
        exportBatch: exportBatch
    };
})();
