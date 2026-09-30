/**
 * Local accuracy gate for the user's labelled domain-source folders.
 *
 * Usage:
 * node scripts/evaluate-domain-corpus.mjs --unused "D:\\...\\未用数据源" --used "D:\\...\\已用数据源"
 *
 * Directory names supply only the expected label. The detector receives the
 * parsed JSON plus its filename, mirroring an upload without leaking paths.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import vm from 'node:vm';

const args = process.argv.slice(2);
const valueFor = (flag) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : '';
};
const unusedRoot = valueFor('--unused');
const usedRoot = valueFor('--used');

if (!unusedRoot || !usedRoot) {
    throw new Error('Usage: node scripts/evaluate-domain-corpus.mjs --unused <directory> --used <directory>');
}

function walkJsonFiles(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? walkJsonFiles(path) : (/\.json$/i.test(entry.name) ? [path] : []);
    });
}

function expectedUnused(path) {
    const normalized = path.replaceAll('\\', '/');
    if (normalized.includes('/科技-金融-医疗/金融/')) return 'finance';
    if (normalized.includes('/科技-金融-医疗/科技/')) return 'tech';
    if (normalized.includes('/科技-金融-医疗/医疗/')) return 'health';
    if (normalized.includes('/绿色科技/')) return 'energy';
    if (normalized.includes('/体育足球/')) return 'sports';
    if (normalized.includes('/影视/')) return 'entertainment';
    return null;
}

function expectedUsed(path) {
    const normalized = path.replaceAll('\\', '/');
    if (normalized.includes('/宠物-已用-')) return 'pets';
    // These source topics now have their own supported domains rather than science fallbacks.
    if (normalized.includes('/恐龙领域-已用-')) return 'naturalhistory';
    if (normalized.includes('/深海生物探索-已用-')) return 'marinescience';
    if (normalized.includes('/太空与天文-已用-')) return 'science';
    // This package is filed under 美食 but its articles are explicitly health and nutrition.
    if (normalized.includes('/美食-已用-')) return 'health';
    if (normalized.includes('/世界历史灯塔-已用-') || normalized.includes('/世界著名城堡-已用-') || normalized.includes('/世界著名桥梁-已用-')) return 'history';
    if (normalized.includes('/仙人掌与多肉植物园艺-已用-')) return 'agriculture';
    if (normalized.includes('/GLP1减重与心血管新药-已用-')) return 'health';
    if (normalized.includes('/GPT6与AI产业动态-已用-') || normalized.includes('/科技-已用-')) return 'tech';
    if (normalized.includes('/汽车出行-已用-')) return 'automotive';
    return null;
}

function rowsFrom(path) {
    const parsed = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
    return Array.isArray(parsed) ? parsed : (Object.values(parsed).find(Array.isArray) || []);
}

const context = {};
// data.js extends the domain catalogue during initialization, so load its dependency first.
vm.runInNewContext(readFileSync(new URL('../js/template-catalog.js', import.meta.url), 'utf8'), context);
vm.runInNewContext(readFileSync(new URL('../js/data.js', import.meta.url), 'utf8') + '\nthis.catalog = DOMAIN_CATALOG;', context);
vm.runInNewContext(readFileSync(new URL('../js/domain.js', import.meta.url), 'utf8'), context);

function evaluate(root, labelFor) {
    return walkJsonFiles(root).map((path) => ({ path, expected: labelFor(path) })).filter((item) => item.expected).map((item) => {
        const result = context.DomainEngine.detect(rowsFrom(item.path), context.catalog, { fileName: basename(item.path) });
        return { expected: item.expected, actual: result.suggestedId, reliable: result.reliable, path: item.path };
    });
}

function report(name, records) {
    const correct = records.filter((record) => record.actual === record.expected);
    const accuracy = records.length ? Number((correct.length / records.length * 100).toFixed(1)) : 0;
    console.log(`${name}: ${correct.length}/${records.length} correct (${accuracy}%)`);
    records.filter((record) => record.actual !== record.expected).forEach((record) => {
        console.log(`  expected=${record.expected} actual=${record.actual} ${record.path}`);
    });
    return accuracy;
}

const unusedAccuracy = report('Development corpus', evaluate(unusedRoot, expectedUnused));
const validationAccuracy = report('Independent validation corpus', evaluate(usedRoot, expectedUsed));
if (unusedAccuracy < 90 || validationAccuracy < 90) process.exitCode = 1;
