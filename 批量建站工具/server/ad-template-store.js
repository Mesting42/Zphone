import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from '@babel/parser';

// The Vite dev/preview server persists user templates under public/ so builds
// carry them with the tool package; this API deliberately accepts loopback requests only.
const API_PATH = '/__sitefoundry/ad-templates';
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

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Length', Buffer.byteLength(body));
  response.end(body);
}

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function isLoopback(address) {
  return address === '::1' || address === '127.0.0.1' || address === '::ffff:127.0.0.1'
    || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(address || '');
}

function assertLocalRequest(request) {
  if (!isLoopback(request.socket && request.socket.remoteAddress)) {
    fail('模板只能从运行工具的本机浏览器保存。', 403);
  }
  const origin = request.headers.origin;
  if (origin) {
    let originHost = '';
    try { originHost = new URL(origin).host; } catch { fail('请求来源无效。', 403); }
    if (!originHost || originHost !== request.headers.host) fail('请求来源与本地工具地址不一致。', 403);
  }
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let byteLength = 0;
    const chunks = [];
    request.on('data', chunk => {
      byteLength += chunk.length;
      if (byteLength > MAX_SOURCE_BYTES + 64 * 1024) {
        const error = new Error('上传内容超过 1 MB，请压缩或精简 ad.js 模板后重试。');
        error.status = 413;
        reject(error);
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(Object.assign(new Error('上传数据格式无效。'), { status: 400 })); }
    });
    request.on('error', reject);
  });
}

function readTemplateAst(source) {
  if (typeof source !== 'string' || !source.trim()) fail('请选择有内容的 ad.js 模板文件。');
  if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) fail('ad.js 模板不能超过 1 MB。', 413);
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

function normalizeManifest(value) {
  if (!value || value.schema !== 'sitefoundry-ad-templates/v1' || !Array.isArray(value.templates)) {
    return { schema: 'sitefoundry-ad-templates/v1', defaultVersion: 'v1.0.2.1', templates: [] };
  }
  const templates = value.templates.filter(item => item && normalizeVersion(item.version) === item.version
    && typeof item.file === 'string' && /^custom\/[A-Za-z0-9.-]+\.json$/.test(item.file));
  const defaultVersion = templates.some(item => item.version === value.defaultVersion)
    || BUILT_IN_VERSIONS.has(value.defaultVersion) ? value.defaultVersion : 'v1.0.2.1';
  return { schema: 'sitefoundry-ad-templates/v1', defaultVersion, templates };
}

async function readManifest(storeDirectory) {
  try {
    const value = JSON.parse(await readFile(join(storeDirectory, 'manifest.json'), 'utf8'));
    return normalizeManifest(value);
  } catch (error) {
    if (error.code === 'ENOENT') return normalizeManifest(null);
    throw error;
  }
}

async function readCatalog(storeDirectory) {
  const manifest = await readManifest(storeDirectory);
  const templates = [];
  for (const entry of manifest.templates) {
    try {
      const template = JSON.parse(await readFile(join(storeDirectory, entry.file), 'utf8'));
      if (template.version === entry.version && typeof template.source === 'string') templates.push(template);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return { manifest, templates };
}

async function writeJsonAtomic(path, value) {
  // Replace the manifest atomically so a restart cannot observe a partial write.
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, path);
}

function errorResponse(response, error) {
  sendJson(response, error.status || 500, { error: error.message || '模板保存失败。' });
}

export function createAdTemplateApiMiddleware(storeDirectory) {
  return function adTemplateApiMiddleware(request, response, next) {
    let pathname = '';
    try { pathname = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`).pathname; }
    catch { return next(); }
    if (pathname !== API_PATH && !pathname.startsWith(`${API_PATH}/`)) return next();

    (async () => {
      try {
        assertLocalRequest(request);
        await mkdir(join(storeDirectory, 'custom'), { recursive: true });
        if (request.method === 'GET' && pathname === API_PATH) {
          sendJson(response, 200, await readCatalog(storeDirectory));
          return;
        }
        if (request.method !== 'POST') {
          response.setHeader('Allow', pathname === API_PATH ? 'GET, POST' : 'POST');
          sendJson(response, 405, { error: '该模板接口不支持此请求方式。' });
          return;
        }
        if (request.headers['content-type'] && !request.headers['content-type'].toLowerCase().includes('application/json')) {
          fail('模板接口只接收 JSON 上传内容。', 415);
        }
        const body = await readJsonBody(request);
        if (pathname !== `${API_PATH}/analyze`
          && pathname !== `${API_PATH}/save`
          && pathname !== `${API_PATH}/default`) {
          sendJson(response, 404, { error: '模板接口不存在。' });
          return;
        }

        if (pathname === `${API_PATH}/default`) {
          // A default-only request changes the durable selection, not the uploaded template contents.
          const version = String(body && body.version || '').trim();
          const current = await readCatalog(storeDirectory);
          const isKnownVersion = BUILT_IN_VERSIONS.has(version)
            || current.templates.some(template => template.version === version);
          if (!isKnownVersion) fail(`版本 ${version || '(空)'} 不存在，无法设为默认版本。`, 404);

          const manifest = normalizeManifest({ ...current.manifest, defaultVersion: version });
          await writeJsonAtomic(join(storeDirectory, 'manifest.json'), manifest);
          sendJson(response, 200, { manifest });
          return;
        }

        const source = String(body && body.source || '');
        const analysis = analyzeTemplate(source);
        if (pathname === `${API_PATH}/analyze`) {
          sendJson(response, 200, analysis);
          return;
        }
        const requestedVersion = String(body && body.version || '').trim();
        const version = requestedVersion ? normalizeVersion(requestedVersion) : analysis.version;
        if (requestedVersion && !version) fail('版本号格式无效，请填写类似 v1.0.3 的版本号。');
        if (!version) fail('请输入版本号，例如 v1.0.3。');
        if (BUILT_IN_VERSIONS.has(version)) fail(`版本 ${version} 已内置，请使用新的版本号。`);
        const current = await readCatalog(storeDirectory);
        if (current.manifest.templates.some(template => template.version === version)) {
          fail(`版本 ${version} 已存在，请使用不同的版本号，避免覆盖现有模板。`, 409);
        }
        const declarations = new Map(getDeclarations(readTemplateAst(source)).map(declaration => [declaration.name, declaration]));
        const fields = validateMappings(body && body.fields, declarations);
        const ranges = {};
        ALL_FIELDS.forEach(field => {
          if (fields[field]) {
            const declaration = declarations.get(fields[field]);
            ranges[field] = { start: declaration.start, end: declaration.end };
          }
        });
        const file = `custom/${version}.json`;
        const template = { version, source, fields, ranges, file };
        await writeJsonAtomic(join(storeDirectory, file), template);
        const manifest = normalizeManifest({
          ...current.manifest,
          defaultVersion: version,
          templates: [...current.manifest.templates, { version, file }]
        });
        await writeJsonAtomic(join(storeDirectory, 'manifest.json'), manifest);
        sendJson(response, 201, { manifest, template });
      } catch (error) {
        errorResponse(response, error);
      }
    })();
  };
}
