import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { analyzeTemplate, prepareTemplate } from '../js/ad-template-analysis.js';

const adapterSource = readFileSync(new URL('../js/native-platform.js', import.meta.url), 'utf8');
const archiveSource = readFileSync(new URL('../js/archive-export.js', import.meta.url), 'utf8');

function load(host, options = {}) {
    const events = [];
    const context = {
        Blob, File, Uint8Array, ArrayBuffer, URL, CustomEvent, Event,
        btoa: value => Buffer.from(value, 'binary').toString('base64'),
        atob: value => Buffer.from(value, 'base64').toString('binary'),
        location: { href: 'https://localhost/index.html' },
        document: { documentElement: { dataset: {} }, addEventListener() {} },
        dispatchEvent: event => events.push(event.detail),
        saveAs: options.saveAs || (() => {}),
    };
    context.self = context;
    context.top = options.frame ? {} : context;
    if (options.android) context.Capacitor = { Plugins: { SiteFoundryNative: host } };
    else context.SiteFoundryNative = host;
    vm.createContext(context);
    vm.runInContext(adapterSource, context);
    vm.runInContext(archiveSource, context);
    return { context, api: context.SiteFoundryPlatform, events };
}

function writer(overrides = {}) {
    const buffers = [];
    const calls = [];
    return {
        buffers, calls,
        getPlatformInfo: async () => ({ platform: 'windows' }),
        startFile: async options => { calls.push(options); return { transferId: 'file-1' }; },
        appendFile: async options => { buffers.push(Buffer.from(options.base64, 'base64')); },
        finishFile: async () => ({ saved: true }),
        cancelFile: async () => { calls.push({ cancelled: true }); },
        ...overrides,
    };
}

describe('native workbench boundary', () => {
    it('preserves browser downloads and refuses to initialize inside a preview frame', async () => {
        const calls = [];
        const browser = load(null, { saveAs: (blob, name) => calls.push({ blob, name }) });
        await browser.context.ArchiveExport.save(new Blob(['browser']), 'site.zip');
        expect(calls[0].name).toBe('site.zip');
        expect(browser.api.kind).toBe('browser');
        expect(load(writer(), { frame: true }).api).toBeUndefined();
    });

    it('saves large binary exports in bounded chunks without changing bytes', async () => {
        const host = writer();
        const { api, events } = load(host);
        const bytes = Uint8Array.from({ length: 1024 * 1024 + 19 }, (_, index) => index % 251);
        await api.saveExport(new Blob([bytes]), '图像.zip');
        expect(host.buffers.map(buffer => buffer.length)).toEqual([524288, 524288, 19]);
        expect(createHash('sha256').update(Buffer.concat(host.buffers)).digest('hex'))
            .toBe(createHash('sha256').update(bytes).digest('hex'));
        expect(events.at(-1).state).toBe('saved');
    });

    it('does not announce success on picker cancellation or writer failure and can retry', async () => {
        const cancelled = load(writer({ startFile: async () => ({ cancelled: true }) }));
        await expect(cancelled.context.ArchiveExport.save(new Blob(['x']), 'site.zip')).rejects.toMatchObject({ name: 'AbortError' });
        expect(cancelled.events.some(event => event.state === 'saved')).toBe(false);
        let failOnce = true;
        const host = writer({ appendFile: async () => { if (failOnce) { failOnce = false; throw new Error('disk full'); } } });
        const failed = load(host);
        await expect(failed.api.saveExport(new Blob(['a']), 'a.zip')).rejects.toThrow('disk full');
        expect(host.calls.at(-1)).toEqual({ cancelled: true });
        await expect(failed.api.saveExport(new Blob(['b']), 'b.zip')).resolves.toMatchObject({ saved: true });
    });

    it('retains folder structure through native directory handles and rejects traversal', async () => {
        const host = writer({ selectDirectory: async () => ({ token: 'directory-1', name: 'sites' }), selectImportDirectory: async () => ({ files: [] }) });
        const { context } = load(host);
        const root = await context.showDirectoryPicker({ mode: 'readwrite' });
        const folder = await root.getDirectoryHandle('domain.example');
        const subfolder = await folder.getDirectoryHandle('js');
        const output = await (await subfolder.getFileHandle('ad.js')).createWritable();
        await output.write('广告字节');
        await output.close();
        expect(host.calls[0]).toMatchObject({ directoryToken: 'directory-1', relativePath: 'domain.example/js/ad.js' });
        expect(Buffer.concat(host.buffers).toString('utf8')).toBe('广告字节');
        await expect(root.getDirectoryHandle('../outside')).rejects.toThrow('名称无效');
    });

    it('reads authorized directory files lazily with their relative names', async () => {
        const calls = [];
        const host = writer({
            selectImportDirectory: async () => ({ name: 'sites', files: [{ name: 'index.html', path: 'site/index.html', uri: 'file-token', size: 4 }] }),
            readImportFile: async args => { calls.push(args); return { dataBase64: Buffer.from('site').toString('base64') }; },
        });
        const { context } = load(host);
        const root = await context.showDirectoryPicker({ mode: 'read' });
        expect(calls.length).toBe(0);
        const folders = [];
        for await (const entry of root.entries()) folders.push(entry);
        const children = [];
        for await (const entry of folders[0][1].entries()) children.push(entry);
        expect(await (await children[0][1].getFile()).text()).toBe('site');
        expect(calls[0].uri).toBe('file-token');
    });

    it('uses the shared AST validator before Android template storage', async () => {
        const calls = [];
        const host = { getPlatformInfo: async () => ({ platform: 'android' }), templateRequest: async args => { calls.push(args); return { template: args.body.template }; } };
        const { api } = load(host, { android: true });
        api.registerTemplateAnalysis({ analyzeTemplate, prepareTemplate });
        const fields = { bannerPath1: 'bannerPath1', bannerPath2: 'bannerPath2', bannerPath3: 'bannerPath3', interstitialPath: 'interstitialPath', anchorPath: 'anchorPath', analyticsID: 'analyticsID' };
        const source = Object.keys(fields).map(name => 'var ' + name + ' = "original";').join('\n');
        const result = await api.requestTemplate('/__sitefoundry/ad-templates/save', { method: 'POST', body: JSON.stringify({ version: 'v9.1.2', source, fields }) });
        expect(result.template.file).toBe('custom/v9.1.2.json');
        expect(result.template.ranges.bannerPath1.start).toBeGreaterThan(0);
        expect(calls.length).toBe(1);
        await expect(api.requestTemplate('/__sitefoundry/ad-templates/save', { method: 'POST', body: JSON.stringify({ version: '../escape', source, fields }) })).rejects.toThrow('版本号格式无效');
        expect(calls.length).toBe(1);
    });

    it('restores an Android SAF directory and streams an export to that authorized tree', async () => {
        const calls = [];
        const chunks = [];
        const host = {
            getPlatformInfo: async () => ({ platform: 'android', exportDirectoryUri: 'content://authorized-tree' }),
            beginExport: async args => { calls.push(args); return { token: 'saf-export' }; },
            appendExport: async args => { expect(args.token).toBe('saf-export'); chunks.push(Buffer.from(args.dataBase64, 'base64')); },
            finishExport: async args => ({ saved: args.token === 'saf-export' }),
            cancelExport: async () => ({}),
        };
        const { api } = load(host, { android: true });
        await api.saveExport(new Blob(['android bytes'], { type: 'application/zip' }), 'website.zip');
        expect(calls[0]).toMatchObject({ directoryUri: 'content://authorized-tree', name: 'website.zip', mimeType: 'application/zip', size: 13 });
        expect(Buffer.concat(chunks).toString()).toBe('android bytes');
    });
});
