import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAdTemplateApiMiddleware } from '../server/ad-template-store.js';

const API_PATH = '/__sitefoundry/ad-templates';
let storeDirectory;

function sendRequest(middleware, pathname, method, body) {
  return new Promise((resolve, reject) => {
    const request = new EventEmitter();
    const response = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      end(value) {
        resolve({
          statusCode: this.statusCode,
          headers: this.headers,
          body: value ? JSON.parse(value) : null
        });
      }
    };
    request.method = method;
    request.url = API_PATH + pathname;
    request.headers = {
      host: '127.0.0.1:5173',
      origin: 'http://127.0.0.1:5173',
      ...(method === 'POST' ? { 'content-type': 'application/json' } : {})
    };
    request.socket = { remoteAddress: '127.0.0.1' };

    if (method === 'POST') {
      const originalOn = request.on.bind(request);
      let bodySent = false;
      request.on = function (eventName, listener) {
        const result = originalOn(eventName, listener);
        if (!bodySent && request.listenerCount('data') && request.listenerCount('end')) {
          bodySent = true;
          queueMicrotask(() => {
            request.emit('data', Buffer.from(JSON.stringify(body)));
            request.emit('end');
          });
        }
        return result;
      };
    }

    middleware(request, response, () => reject(new Error('The request was not handled by the ad template API.')));
  });
}

beforeEach(async () => {
  storeDirectory = await mkdtemp(join(tmpdir(), 'sitefoundry-ad-templates-'));
});

afterEach(async () => {
  if (storeDirectory) await rm(storeDirectory, { recursive: true, force: true });
  storeDirectory = '';
});

describe('ad template default API', () => {
  it('persists a built-in default across a fresh catalog request and rejects unknown versions', async () => {
    const middleware = createAdTemplateApiMiddleware(storeDirectory);
    const updated = await sendRequest(middleware, '/default', 'POST', { version: 'initial' });

    expect(updated.statusCode).toBe(200);
    expect(updated.body.manifest.defaultVersion).toBe('initial');

    const reopened = await sendRequest(createAdTemplateApiMiddleware(storeDirectory), '', 'GET');
    expect(reopened.body.manifest.defaultVersion).toBe('initial');

    const unknown = await sendRequest(middleware, '/default', 'POST', { version: 'v9.9.9' });
    expect(unknown.statusCode).toBe(404);
    const persisted = JSON.parse(await readFile(join(storeDirectory, 'manifest.json'), 'utf8'));
    expect(persisted.defaultVersion).toBe('initial');
  });

  it('accepts an installed custom version and keeps new uploads as the new default', async () => {
    await mkdir(join(storeDirectory, 'custom'), { recursive: true });
    await writeFile(join(storeDirectory, 'manifest.json'), JSON.stringify({
      schema: 'sitefoundry-ad-templates/v1',
      defaultVersion: 'v1.0.2.1',
      templates: [{ version: 'v9.8.7', file: 'custom/v9.8.7.json' }]
    }));
    await writeFile(join(storeDirectory, 'custom', 'v9.8.7.json'), JSON.stringify({
      version: 'v9.8.7', source: 'const slot = "";', fields: {}, ranges: {}
    }));

    const middleware = createAdTemplateApiMiddleware(storeDirectory);
    const customDefault = await sendRequest(middleware, '/default', 'POST', { version: 'v9.8.7' });
    expect(customDefault.statusCode).toBe(200);
    expect(customDefault.body.manifest.defaultVersion).toBe('v9.8.7');

    const source = [
      'const slot1 = "";', 'const slot2 = "";', 'const slot3 = "";',
      'const intSlot = "";', 'const anchorSlot = "";', 'const gaId = "";'
    ].join('\n');
    const uploaded = await sendRequest(middleware, '/save', 'POST', {
      version: 'v1.0.3',
      source,
      fields: {
        bannerPath1: 'slot1', bannerPath2: 'slot2', bannerPath3: 'slot3', bannerPath4: '',
        interstitialPath: 'intSlot', anchorPath: 'anchorSlot', analyticsID: 'gaId'
      }
    });

    expect(uploaded.statusCode).toBe(201);
    expect(uploaded.body.manifest.defaultVersion).toBe('v1.0.3');
  });
});
