/**
 * Exercise local domain detection against every article JSON in supplied source roots.
 * This is an input-coverage audit; only the separate labelled corpus runner measures accuracy.
 */
import { basename, join, relative, sep } from 'node:path';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const valueFor = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : '';
};
const roots = [
  { name: 'unused', path: valueFor('--unused') },
  { name: 'used', path: valueFor('--used') }
];
if (roots.some((root) => !root.path)) {
  throw new Error('Usage: node scripts/audit-domain-source-imports.mjs --unused <directory> --used <directory>');
}

function walkJsonFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walkJsonFiles(path) : (/\.json$/i.test(entry.name) ? [path] : []);
  });
}

function articleRows(path) {
  const parsed = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return [];
  return Object.values(parsed).find(Array.isArray) || [];
}

const context = {};
const sourceText = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
vm.runInNewContext(sourceText('../js/template-catalog.js'), context);
vm.runInNewContext(sourceText('../js/data.js') + '\nthis.catalog = DOMAIN_CATALOG;', context);
vm.runInNewContext(sourceText('../js/domain.js'), context);
const supportedDomains = new Set(Object.keys(context.catalog));

const files = roots.flatMap((root) => walkJsonFiles(root.path)
  // A previously exported site's bundled data.json is not an independent source package.
  .filter((path) => !path.split(/[\\/]+/).includes('website'))
  .map((path) => ({ root: root.name, rootPath: root.path, path })));
const results = [];
for (const file of files) {
  const item = { root: file.root, file: relative(file.rootPath, file.path).split(sep).join('/') };
  try {
    const rows = articleRows(file.path);
    const detected = context.DomainEngine.detect(rows, context.catalog, { fileName: basename(file.path) });
    const validDomain = supportedDomains.has(detected.suggestedId);
    results.push({ ...item, rows: rows.length, suggestedId: detected.suggestedId,
      reliable: detected.reliable, confidence: detected.confidence, validDomain,
      needsManualReview: !detected.reliable,
      topCandidates: detected.scores.slice(0, 3).map(({ id, score, evidence }) => ({ id, score, evidence })),
      error: rows.length ? null : 'No article rows found' });
  } catch (error) {
    results.push({ ...item, rows: 0, suggestedId: null, reliable: false, confidence: null,
      validDomain: false, error: error.message });
  }
}

const byRoot = Object.fromEntries(roots.map((root) => {
  const subset = results.filter((item) => item.root === root.name);
  return [root.name, { checkedFiles: subset.length, validDomainSuggestions: subset.filter((item) => item.validDomain).length,
    parseOrClassificationFailures: subset.filter((item) => !item.validDomain).length,
    needsManualReview: subset.filter((item) => item.needsManualReview).length,
    domainCounts: subset.reduce((counts, item) => {
      const id = item.suggestedId || '(none)';
      counts[id] = (counts[id] || 0) + 1;
      return counts;
    }, {}) }];
}));
const outputDirectory = fileURLToPath(new URL('../coverage/', import.meta.url));
mkdirSync(outputDirectory, { recursive: true });
const report = { checkedFiles: results.length, byRoot,
  failures: results.filter((item) => !item.validDomain),
  needsManualReview: results.filter((item) => item.needsManualReview), results };
writeFileSync(join(outputDirectory, 'domain-source-audit.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ checkedFiles: report.checkedFiles, byRoot, failures: report.failures,
  needsManualReview: report.needsManualReview.map(({ root, file, suggestedId, confidence }) => ({ root, file, suggestedId, confidence })),
  reportPath: 'coverage/domain-source-audit.json' }, null, 2));
process.exitCode = report.failures.length ? 1 : 0;
