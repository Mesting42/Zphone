/**
 * 广告策略的快速更新模式。只编排已有解析、模板和位置恢复 API，
 * 不保存 UI 状态，也不修改上传站点或 TXT，供预览与实际导出共同调用。
 */
export const QUICK_AD_VERSION = 'v1.0.2.1';
const pages = ['home', 'detail', 'all'];
const fields = ['bannerPath1', 'bannerPath2', 'bannerPath3', 'interstitialPath', 'anchorPath'];
const text = entry => typeof entry?.text === 'string' ? entry.text : new TextDecoder().decode(entry?.bytes || new Uint8Array());
const problem = message => ({ message, code: 'QUICK_AD_UPDATE_INVALID' });
const hostOf = value => String(value || '').toLowerCase();

function pagePaths(metadata, page) {
    return page === 'home' ? [metadata.homePath] : page === 'detail' ? metadata.detailPaths : metadata.listingPaths || [];
}

// 排除脚本示例与禁用注释，依据真实 DOM 判断某一文件的横幅是否开启。
function activeMarkup(source) {
    return source.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<!--[\s\S]*?-->/gi, '');
}
function hasBanner(source, index) {
    return new RegExp('\\bid\\s*=\\s*["\']div-gpt-ad-banner' + (index + 1) + '["\']', 'i').test(activeMarkup(source));
}

function savedPolicy(site) {
    const entry = site.entries.find(item => item.path === site.metadata.siteRoot + 'ad-policy.json');
    try { return JSON.parse(text(entry)).policy || null; } catch { return null; }
}

/** Read only the known generated runtime gates; never execute uploaded JavaScript. */
function readOutOfPageGate(source, name, fallback) {
    const key = name === 'interstitial' ? '(?:adUnitInterstitial|interstitialPath)' : '(?:adUnitAnchor|anchorPath)';
    const declaration = source.match(new RegExp('^\\s*(?:const|let|var)\\s+' + key + '\\s*=\\s*(["\'])([^"\']*)\\1', 'm'));
    if (declaration && !declaration[2]) return { home: false, detail: false, all: false };
    const gate = source.match(new RegExp('if\\s*\\(\\s*' + key + '\\s*&&\\s*\\(isIndex\\s*\\?\\s*(true|false)\\s*:\\s*(?:document\\.documentElement\\.getAttribute\\(["\']data-sitefoundry-ad-page["\']\\)\\s*===\\s*["\']all["\']\\s*\\?\\s*(true|false)\\s*:\\s*)?(true|false)'));
    if (gate) return { home: gate[1] === 'true', detail: gate[3] === 'true', all: (gate[2] || gate[3]) === 'true' };
    if (new RegExp('if\\s*\\(\\s*isIndex\\s*&&\\s*' + key + '\\s*\\)').test(source)) return { home: true, detail: false, all: false };
    if (new RegExp('if\\s*\\(\\s*' + key + '\\s*\\)').test(source)) return { home: true, detail: true, all: true };
    if (fallback) return fallback;
    throw new Error('无法可靠识别原站' + (name === 'interstitial' ? '插屏' : '锚点') + '开关，请使用详细策略确认配置。');
}

export function quickUpdatePolicy(site, preserveSwitches, engine) {
    const policy = engine.createPolicy('restore-original', { pageIsolation: true });
    if (!preserveSwitches) return policy; // 最新模板：插屏仅首页，横幅与锚点按模板开启。
    const saved = savedPolicy(site);
    const runtime = text(site.entries.find(entry => entry.path === site.metadata.adPath));
    pages.forEach(page => {
        const sources = pagePaths(site.metadata, page).map(path => text(site.entries.find(entry => entry.path === path)));
        const savedSlots = saved?.slots?.[page] || (page === 'all' && saved?.version < 2 ? saved.slots.detail : null);
        policy.slots[page].forEach((slot, index) => {
            if (savedSlots?.[index]) slot.unit = savedSlots[index].unit;
            else if (sources.length && !sources.some(source => hasBanner(source, index))) slot.unit = 'off';
        });
    });
    ['interstitial', 'anchor'].forEach(name => {
        const savedGate = saved?.outOfPage?.[name];
        const gate = readOutOfPageGate(runtime, name, savedGate);
        pages.forEach(page => { policy.outOfPage[name][page] = !!(gate[page] ?? gate.detail); });
    });
    return engine.normalizePolicy(policy);
}

/** Strict domain pairing, including a single site: a wrong TXT is never silently accepted. */
export function planQuickAdUpdate(sites, codes, options = {}) {
    const targets = options.scope === 'batch' ? sites : sites.filter(site => site.id === (options.siteId || sites[0]?.id));
    const mappings = targets.map(site => {
        const host = hostOf(site.metadata?.detectedHost);
        const candidates = codes.filter(code => hostOf(code.detectedHost) === host && host);
        const errors = [...(site.metadata?.errors || [])];
        if (!site.metadata?.adJsVersion) errors.push(problem('无法可靠识别原站 ad.js 模板。'));
        if (!host) errors.push(problem('原站广告域名无法识别，不能自动匹配 TXT。'));
        if (candidates.length !== 1) errors.push(problem(candidates.length ? '同域名有多份 TXT，请只保留一份后重新选择。' : '请上传与 ' + (host || '该站') + ' 匹配的新广告 TXT。'));
        const code = candidates.length === 1 ? candidates[0] : null;
        if (code && !code.valid) errors.push(...code.errors);
        if (targets.filter(other => hostOf(other.metadata?.detectedHost) === host).length > 1) errors.push(problem('存在相同广告域名的多个站点，请改为单个处理或移除重复站点。'));
        return { site, code, host, valid: errors.length === 0, errors };
    });
    return { mappings, validCount: mappings.filter(item => item.valid).length };
}

// 已开启的页面保留原广告 DOM；只补回确实缺失的广告。脚本查询参数用于部署后更新缓存。
function retainOriginalPage(entry, page, cacheKey) {
    let html = text(entry);
    if (page) html = html.replace(/<html\b([^>]*)>/i, (_, attrs) => '<html' + attrs.replace(/\sdata-sitefoundry-ad-page=["'][^"']*["']/gi, '') + ' data-sitefoundry-ad-page="' + page + '">');
    html = html.replace(/(<script\b[^>]*\bsrc\s*=\s*)(["'])([^"']+)(\2)/gi, (match, start, quote, url) => {
        const path = url.split(/[?#]/)[0];
        if (!/(?:^|\/)js\/ad\.js$/i.test(path) || /^(?:https?:)?\/\//i.test(path)) return match;
        return start + quote + path + '?v=quick-ad-' + cacheKey + quote;
    });
    return { path: entry.path, bytes: new TextEncoder().encode(html) };
}

/** The same result drives the placeholder preview and final exported files. */
export function prepareQuickAdUpdate(site, code, options, engine) {
    const errors = planQuickAdUpdate([site], [code].filter(Boolean), { siteId: site.id }).mappings[0]?.errors || [];
    if (errors.length) return { valid: false, errors };
    try {
        const policy = quickUpdatePolicy(site, options?.preserveSwitches, engine);
        const config = { ...code.config, analyticsID: code.config.analyticsID || site.metadata.embeddedConfig.analyticsID || '' };
        const result = engine.preparePolicySite(site, policy, {
            adJsVersionMode: QUICK_AD_VERSION,
            preserveOriginalPlacements: true,
            codeOverride: { ...code, config }
        });
        if (!result.valid) return result;
        // 内容指纹让再次更换单元、GA 或开关后的部署使用新 URL，避免缓存旧 ad.js。
        let fingerprint = 2166136261;
        for (const char of text(result.entries.find(entry => entry.path === site.metadata.adPath))) fingerprint = Math.imul(fingerprint ^ char.charCodeAt(0), 16777619);
        const cacheKey = (fingerprint >>> 0).toString(16);
        const original = new Map(site.entries.map(entry => [entry.path, entry]));
        result.entries = result.entries.map(entry => {
            const source = original.get(entry.path);
            if (!source) return entry;
            const page = pages.find(type => pagePaths(site.metadata, type).includes(entry.path));
            if (page) return retainOriginalPage(options?.preserveSwitches || [0, 1, 2].every(index => hasBanner(text(source), index)) ? source : entry, page, cacheKey);
            // 法律页与其他非目标文件必须逐字节保留；快速更新只触及首页、
            // 游戏列表、游戏详情页和 js/ad.js，避免给 about/privacy 等页面
            // 追加缓存参数而造成无关内容变化。
            return entry;
        });
        result.updatedConfig = config;
        result.gaSource = code.config.analyticsID ? '新 TXT' : config.analyticsID ? '原站' : '未配置';
        result.warnings = [...(result.warnings || []), ...(code.warnings || []).filter(item => item.code !== 'OPTIONAL_GA_MISSING' || !config.analyticsID)];
        return result;
    } catch (error) { return { valid: false, errors: [problem(error.message)] }; }
}

export async function applyQuickAdUpdate(sites, codes, options, engine, onProgress = () => {}) {
    const plan = planQuickAdUpdate(sites, codes, options);
    const outputs = [], results = [];
    for (const [index, mapping] of plan.mappings.entries()) {
        onProgress(Math.round(index / plan.mappings.length * 80), '正在更新 ' + mapping.site.name + '…');
        const result = mapping.valid ? prepareQuickAdUpdate(mapping.site, mapping.code, options, engine) : mapping;
        const summary = { valid: result.valid, siteName: mapping.site.name, host: mapping.host,
            sourceAdJsVersion: mapping.site.metadata.adJsVersion, adJsVersion: QUICK_AD_VERSION,
            changedPages: result.changedPages?.length || 0, errors: result.errors || [], warnings: result.warnings || [] };
        if (result.valid) {
            outputs.push({ name: mapping.host, entries: result.entries, originalEntries: mapping.site.entries, policy: result.policy });
            summary.gaSource = result.gaSource;
            summary.updatedConfig = result.updatedConfig;
        }
        results.push(summary);
    }
    if (!outputs.length) { const error = new Error('没有站点通过快速更新校验，请检查 TXT 匹配结果。'); error.results = results; throw error; }
    const report = results.map(item => item.siteName + '：' + (item.valid
        ? item.sourceAdJsVersion + ' → ' + QUICK_AD_VERSION + '；GA 来源：' + item.gaSource + '\n' + fields.map(key => key + ' = ' + item.updatedConfig[key]).join('\n')
        : item.errors.map(error => error.message).join('；'))).join('\n\n');
    onProgress(100, '广告更新完成');
    return { folderName: '广告快速更新-' + new Date().toISOString().replace(/[:.]/g, '-'), reportName: '广告快速更新报告.txt', sites: outputs, results, report };
}
