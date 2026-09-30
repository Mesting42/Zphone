import { describe, expect, it } from 'vitest';
import { createArchiveWorkerTools } from '../js/archive-worker-tools.js';

class FakeWorker {
    constructor() {
        this.listeners = new Map();
        this.terminated = false;
    }

    addEventListener(type, listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(listener);
    }

    removeEventListener(type, listener) {
        this.listeners.get(type)?.delete(listener);
    }

    terminate() {
        this.terminated = true;
    }

    emit(type, event = {}) {
        Array.from(this.listeners.get(type) || []).forEach((listener) => listener(event));
    }
}

function createWorkerRig() {
    let worker = null;
    const tools = createArchiveWorkerTools('/worker.js', () => {
        worker = new FakeWorker();
        return worker;
    });
    return {
        tools,
        get worker() { return worker; }
    };
}

describe('libarchive worker timeout wrapper', () => {
    it('terminates a worker when Archive.open never settles', async () => {
        const rig = createWorkerRig();
        const Archive = {
            open: () => {
                rig.tools.createArchiveWorker();
                return new Promise(() => {});
            }
        };

        await expect(rig.tools.openArchiveWithTimeout(Archive, { name: 'stuck.rar' }, 5, 'RAR 打开超时'))
            .rejects.toThrow('RAR 打开超时');
        expect(rig.worker?.terminated).toBe(true);
    });

    it('turns Worker errors into a rejected open and releases that Worker', async () => {
        const rig = createWorkerRig();
        const Archive = {
            open: () => {
                rig.tools.createArchiveWorker();
                return new Promise(() => {});
            }
        };
        const pending = rig.tools.openArchiveWithTimeout(Archive, { name: 'worker-error.rar' }, 1000, 'unused timeout');
        rig.worker.emit('error', { message: 'WASM 初始化失败' });

        await expect(pending).rejects.toThrow('压缩包解析 Worker 出错：WASM 初始化失败');
        expect(rig.worker.terminated).toBe(true);
    });

    it('leaves a successfully opened Worker alive for the archive caller to close', async () => {
        const rig = createWorkerRig();
        const archive = { close: () => { rig.worker.terminate(); } };
        const Archive = {
            open: () => {
                rig.tools.createArchiveWorker();
                return Promise.resolve(archive);
            }
        };

        const opened = await rig.tools.openArchiveWithTimeout(Archive, { name: 'valid.rar' }, 1000, 'unused timeout');

        expect(opened).toBe(archive);
        expect(rig.worker.terminated).toBe(false);
        await opened.close();
        expect(rig.worker.terminated).toBe(true);
    });
});
