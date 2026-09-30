/**
 * Adds a cancellable open timeout around libarchive.js, whose Archive.open()
 * does not expose its Worker until the returned promise resolves.
 */
export function createArchiveWorkerTools(workerUrl, createWorker) {
    let activeWorkerCapture = null;

    function createArchiveWorker() {
        const worker = createWorker(workerUrl, { type: 'module' });
        if (typeof activeWorkerCapture === 'function') activeWorkerCapture(worker);
        return worker;
    }

    function openArchiveWithTimeout(Archive, file, timeoutMs, timeoutMessage) {
        if (!Archive || typeof Archive.open !== 'function') {
            return Promise.reject(new Error('RAR / 7Z 解析组件未提供 Archive.open()。'));
        }

        let duration = Number(timeoutMs);
        if (!Number.isFinite(duration) || duration < 1) duration = 90000;

        return new Promise(function(resolve, reject) {
            let worker = null;
            let timer = 0;
            let settled = false;
            const previousCapture = activeWorkerCapture;

            function removeWorkerListeners() {
                if (!worker || typeof worker.removeEventListener !== 'function') return;
                worker.removeEventListener('error', handleWorkerError);
                worker.removeEventListener('messageerror', handleWorkerError);
            }

            function finishWithError(error) {
                if (settled) return;
                settled = true;
                if (timer) clearTimeout(timer);
                removeWorkerListeners();
                // Archive.open() has not returned a closable archive instance yet.
                if (worker && typeof worker.terminate === 'function') worker.terminate();
                reject(error);
            }

            function handleWorkerError(event) {
                if (event && typeof event.preventDefault === 'function') event.preventDefault();
                const detail = event && (event.message || event.type);
                finishWithError(new Error('压缩包解析 Worker 出错' + (detail ? '：' + detail : '。')));
            }

            function captureWorker(createdWorker) {
                worker = createdWorker;
                if (worker && typeof worker.addEventListener === 'function') {
                    worker.addEventListener('error', handleWorkerError);
                    worker.addEventListener('messageerror', handleWorkerError);
                }
            }

            activeWorkerCapture = captureWorker;
            let opening;
            try {
                opening = Archive.open(file);
            } catch (error) {
                activeWorkerCapture = previousCapture;
                finishWithError(error);
                return;
            }
            activeWorkerCapture = previousCapture;

            timer = setTimeout(function() {
                finishWithError(new Error(timeoutMessage || '打开压缩包超时。'));
            }, duration);

            Promise.resolve(opening).then(function(archive) {
                if (settled) {
                    if (archive && typeof archive.close === 'function') {
                        Promise.resolve(archive.close()).catch(function() {});
                    }
                    return;
                }
                settled = true;
                if (timer) clearTimeout(timer);
                removeWorkerListeners();
                resolve(archive);
            }, finishWithError);
        });
    }

    return {
        createArchiveWorker: createArchiveWorker,
        openArchiveWithTimeout: openArchiveWithTimeout
    };
}
