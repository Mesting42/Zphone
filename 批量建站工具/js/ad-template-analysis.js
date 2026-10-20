/** Shared ad-template AST analysis. This module is platform independent;
 * uploaded scripts are parsed as data and are never evaluated by the tool. */
import { parse } from '@babel/parser';
const MAX_SOURCE_BYTES = 1024 * 1024;
const BUILT_IN_VERSIONS = new Set(['initial', 'v1.0.0', 'v1.0.1', 'v1.0.2', 'v1.0.2.1']);
const REQUIRED_FIELDS = ['bannerPath1', 'bannerPath2', 'bannerPath3', 'interstitialPath', 'anchorPath', 'analyticsID'];
const ALL_FIELDS = [
  'bannerPath1', 'bannerPath2', 'bannerPath3', 'bannerPath4',
  'interstitialPath', 'anchorPath', 'analyticsID'
];

const FIELD_ALIASES = {
  bannerPath1: ['bannerPath1', 'adUnitBanner1', 'banner1Path', 'banner1AdUnit', 'adPathBanner1'],
  bannerPath2: ['bannerPath2', 'adUnitBanner2', 'banner2Path', 'banner2AdUnit', 'adPathBanner2'],
  bannerPath3: ['bannerPath3', 'adUnitBanner3', 'banner3Path', 'banner3AdUnit', 'adPathBanner3'],
  bannerPath4: ['bannerPath4', 'adUnitBanner4', 'banner4Path', 'banner4AdUnit', 'adPathBanner4'],
  interstitialPath: ['interstitialPath', 'adUnitInterstitial', 'interstitialAdPath', 'adInterstitialPath', 'adUnitInt', 'intAdUnitPath'],
  anchorPath: ['anchorPath', 'adUnitAnchor', 'anchorAdPath', 'adAnchorPath', 'adUnitAnc', 'ancAdUnitPath'],
  analyticsID: ['analyticsID', 'gaMeasurementId', 'googleAnalyticsId', 'googleAnalyticsID', 'gaId', 'measurementId']
};


function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function readTemplateAst(source) {
  if (typeof source !== 'string' || !source.trim()) fail('请选择有内容的 ad.js 模板文件。');
  if (new TextEncoder().encode(source).byteLength > MAX_SOURCE_BYTES) fail('ad.js 模板不能超过 1 MB。', 413);
  try {
    return parse(source, { sourceType: 'unambiguous', allowReturnOutsideFunction: true });
  } catch (error) {
    const location = error.loc ? `（第 ${error.loc.line} 行，第 ${error.loc.column + 1} 列）` : '';
    fail(`ad.js 语法检查未通过${location}：${error.message}`);
  }
}

function getDeclarations(ast) {
  // Only top-level string assignments are candidates, so generated IDs replace
  // a single literal without executing or rewriting uploaded template code.
  const declarations = [];
  ast.program.body.forEach(node => {
    if (node.type !== 'VariableDeclaration') return;
    node.declarations.forEach(declaration => {
      const initializer = declaration.init;
      const isStringValue = initializer && (
        initializer.type === 'StringLiteral'
        || (initializer.type === 'TemplateLiteral' && initializer.expressions.length === 0)
      );
      if (declaration.id.type === 'Identifier' && isStringValue) {
        declarations.push({ name: declaration.id.name, start: initializer.start, end: initializer.end });
      }
    });
  });
  const counts = new Map();
  declarations.forEach(({ name }) => counts.set(name, (counts.get(name) || 0) + 1));
  return declarations.filter(({ name }) => counts.get(name) === 1);
}

function normalizeVersion(value) {
  const match = String(value || '').trim().match(/^v?(\d+(?:\.\d+){2,3}(?:-[0-9A-Za-z.-]+)?)$/i);
  return match ? `v${match[1]}` : '';
}

function detectVersion(ast) {
  const comments = (ast.comments || []).map(comment => comment.value).join('\n');
  const match = comments.match(/ad\s*\.\s*js[^\r\n]*?\bv?(\d+(?:\.\d+){2,3}(?:-[0-9A-Za-z.-]+)?)/i)
    || comments.match(/\bv(\d+(?:\.\d+){2,3}(?:-[0-9A-Za-z.-]+)?)\b/i);
  return match ? normalizeVersion(match[1]) : '';
}

function normalizedName(value) {
  return String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function analyzeTemplate(source) {
  const ast = readTemplateAst(source);
  const variables = getDeclarations(ast).map(({ name }) => name).sort((left, right) => left.localeCompare(right));
  const variableSet = new Set(variables);
  const fields = {};
  Object.entries(FIELD_ALIASES).forEach(([field, aliases]) => {
    const priorities = new Map(aliases.map((alias, index) => [normalizedName(alias), index]));
    fields[field] = variables
      .filter(name => priorities.has(normalizedName(name)))
      .sort((left, right) => priorities.get(normalizedName(left)) - priorities.get(normalizedName(right)))[0] || '';
  });
  return {
    version: detectVersion(ast),
    fields,
    variables,
    requiredFields: REQUIRED_FIELDS,
    declaredFieldCount: Object.keys(fields).filter(field => variableSet.has(fields[field])).length
  };
}

function validateMappings(value, variables) {
  const mapping = {};
  const used = new Set();
  ALL_FIELDS.forEach(field => {
    const name = String(value && value[field] || '').trim();
    mapping[field] = name;
    if (!name) {
      if (REQUIRED_FIELDS.includes(field)) fail(`${field} 必须对应到模板中的字符串变量。`);
      return;
    }
    if (!variables.has(name)) fail(`${name} 不是模板中可替换的顶层字符串变量。`);
    if (used.has(name)) fail(`变量 ${name} 被重复映射，请为每个广告 ID 选择不同的变量。`);
    used.add(name);
  });
  return mapping;
}


/** Validate the template without filesystem access or executing its source.
 * The browser and local server deliberately use the same Babel parser and
 * source ranges; native Android storage only persists this normalized value. */
function prepareTemplate(body) {
  const source = String(body && body.source || '');
  const analysis = analyzeTemplate(source);
  const requestedVersion = String(body && body.version || '').trim();
  const version = requestedVersion ? normalizeVersion(requestedVersion) : analysis.version;
  if (requestedVersion && !version) fail('版本号格式无效，请填写类似 v1.0.3 的版本号。');
  if (!version) fail('请输入版本号，例如 v1.0.3。');
  if (BUILT_IN_VERSIONS.has(version)) fail('版本 ' + version + ' 已内置，请使用新的版本号。');
  const declarations = new Map(getDeclarations(readTemplateAst(source)).map(declaration => [declaration.name, declaration]));
  const fields = validateMappings(body && body.fields, declarations);
  const ranges = {};
  ALL_FIELDS.forEach(field => {
    if (fields[field]) {
      const declaration = declarations.get(fields[field]);
      ranges[field] = { start: declaration.start, end: declaration.end };
    }
  });
  return { version, source, fields, ranges, file: 'custom/' + version + '.json' };
}

export { analyzeTemplate, prepareTemplate, normalizeVersion, MAX_SOURCE_BYTES, BUILT_IN_VERSIONS };
