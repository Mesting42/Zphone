/** Drive the shipped Windows executable, retaining the browser regression's
 * assertions. Only the driver and download observer differ: native save events
 * resolve after the real writer flushes bytes into an isolated output directory.
 * Reopened exported sites use an ordinary browser, not a replacement workbench.
 */
import { createRequire } from 'node:module';
import { mkdir, copyFile, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { _electron, chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'C:/Users/zyt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

export async function launchWorkbench() {
    const output = resolve(process.env.NATIVE_RUN_OUTPUT);
    const exports = join(output, 'native-saved');
    await mkdir(exports, { recursive: true });
    const env = { ...process.env, SITEFOUNDRY_REGRESSION_PROFILE: join(output, 'profile-' + Date.now()), SITEFOUNDRY_SMOKE_EXPORT_DIR: exports };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.SITEFOUNDRY_SMOKE_REPORT;
    const executablePath = resolve(process.env.SITEFOUNDRY_TEST_EXECUTABLE || 'apps/windows/release/win-unpacked/SiteFoundry.exe');
    const application = await _electron.launch({ executablePath, env, timeout: 60000 });
    const page = await application.firstWindow();
    // firstWindow fires before the host's initial loadURL has necessarily
    // finished. Settle startup before a runner navigates again or adds routes.
    await page.waitForLoadState('load', { timeout: 60000 });
    await page.waitForFunction(() => window.SiteFoundryPlatform?.kind === 'windows' && document.querySelector('#upload-area')?.dataset.uploadReady === 'true', null, { timeout: 60000 });
    const identity = await application.evaluate(({ app }) => ({ executable: process.execPath, packaged: app.isPackaged, userData: app.getPath('userData'), version: app.getVersion() }));
    await writeFile(join(output, 'application-identity.json'), JSON.stringify(identity, null, 2));
    if (!identity.packaged || !identity.userData.startsWith(output)) {
        await application.close();
        throw new Error('Regression requires a packaged EXE and isolated application profile');
    }
    let inspectionBrowser;
    const saved = [], waiters = [], nativeExports = [], downloadListeners = [];
    await page.exposeFunction('__nativeRegressionSaved', name => {
        const path = join(exports, name);
        nativeExports.push({ name, path });
        const download = { suggestedFilename: () => name, saveAs: async target => {
            const file = await stat(path);
            if (!file.size) throw new Error('Native export was empty: ' + path);
            await copyFile(path, target);
        } };
        downloadListeners.forEach(listener => listener(download));
        if (waiters.length) waiters.shift()(download); else if (!downloadListeners.length) saved.push(download);
    });
    await page.addInitScript(() => window.addEventListener('sitefoundry-native-operation', event => {
        if (event.detail.state === 'saved') window.__nativeRegressionSaved(event.detail.name);
    }));
    const originalWait = page.waitForEvent.bind(page);
    const pageView = new Proxy(page, { get(target, key) {
        if (key === 'close') return async () => {};
        if (key === 'on') return (event, listener) => {
            if (event === 'download') downloadListeners.push(listener); else target.on(event, listener);
            return pageView;
        };
        if (key === 'waitForEvent') return (event, options = {}) => {
            if (event !== 'download') return originalWait(event, options);
            if (saved.length) return Promise.resolve(saved.shift());
            return new Promise((accept, reject) => {
                const timeout = setTimeout(() => {
                    const index = waiters.indexOf(done); if (index >= 0) waiters.splice(index, 1);
                    reject(new Error('Native file save did not complete'));
                }, options.timeout || 120000);
                const done = value => { clearTimeout(timeout); accept(value); };
                waiters.push(done);
            });
        };
        const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
    } });
    return {
        application, page: pageView,
        async newPage(options = {}) {
            if (!options.acceptDownloads) {
                inspectionBrowser ||= await chromium.launch({ channel: 'msedge', headless: true });
                return inspectionBrowser.newPage(options);
            }
            if (options.viewport) await page.setViewportSize(options.viewport);
            return pageView;
        },
        async newContext(options = {}) {
            inspectionBrowser ||= await chromium.launch({ channel: 'msedge', headless: true });
            return inspectionBrowser.newContext(options);
        },
        async chooseDirectory(path) {
            // Exercise the product's authorized native directory reader after
            // selecting a real directory, without displaying a system dialog.
            await application.evaluate(({ dialog }, selected) => {
                dialog.showOpenDialog = async () => selected ? { canceled: false, filePaths: [selected] } : { canceled: true, filePaths: [] };
            }, path);
        },
        async close() {
            await page.screenshot({ path: join(output, 'final-window.png'), timeout: 5000 }).catch(() => {});
            await writeFile(join(output, 'native-exports.json'), JSON.stringify(nativeExports, null, 2));
            if (inspectionBrowser) await inspectionBrowser.close();
            // A failed renderer must not hide the original test error forever
            // during cleanup. Terminate only this driver's own process tree.
            let timer;
            await Promise.race([application.close(), new Promise(resolveDone => {
                timer = setTimeout(() => {
                    try { execFileSync('taskkill.exe', ['/PID', String(application.process().pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch {}
                    resolveDone();
                }, 10000);
            })]);
            clearTimeout(timer);
        }
    };
}
