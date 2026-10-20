import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { analyzeTemplate, prepareTemplate, normalizeVersion, MAX_SOURCE_BYTES, BUILT_IN_VERSIONS } from '../js/ad-template-analysis.js';

// The Vite dev/preview server persists user templates under public/ so builds
// carry them with the tool package; this API deliberately accepts loopback requests only.
const API_PATH = '/__sitefoundry/ad-templates';
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
        const template = prepareTemplate(body);
        const { version, file } = template;
        const current = await readCatalog(storeDirectory);
        if (current.manifest.templates.some(item => item.version === version)) {
          fail('版本 ' + version + ' 已存在，请使用不同的版本号，避免覆盖现有模板。', 409);
        }
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
