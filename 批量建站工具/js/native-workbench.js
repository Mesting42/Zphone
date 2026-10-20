/** Native tools are a view over platform services; they never modify generator
 * state. Projects and build tasks belong to the persistent native build store. */
export async function initializeNativeWorkbench(platform) {
    if (!platform.isNative() || document.querySelector('.native-app-toolbar')) return;
    let info;
    try { info = await platform.ready; }
    catch (error) {
        const warning = document.createElement('p');
        warning.className = 'native-app-error';
        warning.setAttribute('role', 'alert');
        warning.textContent = '应用系统接口初始化失败：' + error.message;
        document.body.prepend(warning);
        return;
    }
    const toolbar = document.createElement('section');
    toolbar.className = 'native-app-toolbar';
    toolbar.setAttribute('aria-label', '应用文件与源码工程');
    toolbar.innerHTML = '<span class="native-app-label">' + (info.platform === 'android' ? '安卓应用' : 'Windows 应用') + '</span>' +
        '<div class="native-app-actions"><button type="button" data-native-directory>选择导出目录</button><button type="button" data-native-projects>源码工程</button></div>' +
        '<p class="native-operation-status" role="status" aria-live="polite" aria-atomic="true">文件通过系统保存，项目与模板保留在本机。</p>';
    const wrapper = document.querySelector('.main-wrapper');
    if (wrapper) wrapper.before(toolbar); else document.body.prepend(toolbar);
    const operationStatus = toolbar.querySelector('.native-operation-status');
    const directoryButton = toolbar.querySelector('[data-native-directory]');
    directoryButton.addEventListener('click', async () => {
        directoryButton.disabled = true;
        try {
            const result = await platform.chooseExportDirectory();
            if (!result.cancelled) {
                directoryButton.textContent = '更换导出目录';
                operationStatus.textContent = '已选择导出目录。后续导出将保存到这个目录。';
            }
        } catch (error) { operationStatus.textContent = '选择目录失败：' + error.message; }
        finally { directoryButton.disabled = false; }
    });
    window.addEventListener('sitefoundry-native-operation', event => {
        const detail = event.detail || {};
        if (detail.state === 'saving') operationStatus.textContent = '正在保存 ' + detail.name + '：' + detail.progress + '%';
        if (detail.state === 'saved') operationStatus.textContent = '已保存 ' + detail.name + '。';
        if (detail.state === 'reading') operationStatus.textContent = '正在读取目录：' + detail.progress + '%';
        if (detail.state === 'cancelled') operationStatus.textContent = '已取消保存，文件未导出。';
        if (detail.state === 'error') operationStatus.textContent = detail.message || '系统文件操作失败，请重试。';
    });

    const dialog = document.createElement('dialog');
    dialog.className = 'native-project-dialog';
    dialog.setAttribute('aria-labelledby', 'native-project-title');
    dialog.innerHTML = '<div class="native-project-heading"><div><p>本机工程</p><h2 id="native-project-title">源码准备与构建</h2></div><button type="button" data-project-close aria-label="关闭源码工程窗口">关闭</button></div>' +
        '<p class="native-project-intro">导入完整 React / Next 源码 ZIP，也可导入本工具已加入广告的源码包。首次联网准备依赖，准备完成后可在本机断网构建。</p>' +
        '<div class="native-project-picker"><label for="native-project-select">已导入工程</label><select id="native-project-select"><option value="">暂无工程</option></select><button type="button" data-project-import>导入源码 ZIP</button></div>' +
        '<p class="native-project-readiness" data-project-readiness>选择工程后检查离线资源。</p>' +
        '<div class="native-project-buttons"><button type="button" data-project-prepare>准备离线依赖</button><button type="button" data-project-build>离线构建</button><button type="button" data-project-cancel disabled>取消任务</button></div>' +
        '<p class="native-project-status" data-project-status role="status" aria-live="polite" aria-atomic="true">尚未开始构建。</p>' +
        '<progress class="native-project-progress" data-project-progress hidden aria-label="当前任务正在运行"></progress>' +
        '<label class="native-project-log-label" for="native-project-log">任务日志</label><textarea id="native-project-log" class="native-project-log" rows="10" readonly spellcheck="false"></textarea>' +
        '<div class="native-project-results"><button type="button" data-project-preview disabled>预览成品</button><button type="button" data-project-export disabled>导出成品 ZIP</button></div>';
    document.body.appendChild(dialog);
    const select = dialog.querySelector('select');
    const status = dialog.querySelector('[data-project-status]');
    const readiness = dialog.querySelector('[data-project-readiness]');
    const log = dialog.querySelector('textarea');
    const progress = dialog.querySelector('progress');
    const actions = Object.fromEntries(['import', 'prepare', 'build', 'cancel', 'preview', 'export'].map(name => [name, dialog.querySelector('[data-project-' + name + ']')]));
    let activeTask = null;
    let resultTask = null;
    let prepared = false;
    let importing = false;
    let starting = false;
    let polling = null;
    let inspectionVersion = 0;
    const trigger = toolbar.querySelector('[data-native-projects]');

    function updateActions() {
        const busy = !!activeTask || starting;
        actions.import.disabled = importing || busy;
        select.disabled = importing || busy;
        actions.prepare.disabled = !select.value || busy || importing;
        actions.build.disabled = !select.value || !prepared || busy || importing;
        actions.cancel.disabled = !busy;
        actions.preview.disabled = !resultTask || busy;
        actions.export.disabled = !resultTask || busy;
        progress.hidden = !busy && !importing;
        dialog.setAttribute('aria-busy', busy || importing ? 'true' : 'false');
    }

    function errorText(error) { return error && error.message || String(error || '未知错误'); }
    async function inspect() {
        const version = ++inspectionVersion;
        const projectId = select.value;
        prepared = false;
        if (!select.value) { readiness.textContent = '先导入完整源码 ZIP。'; updateActions(); return; }
        readiness.textContent = '正在检查项目依赖和本机构建资源…';
        updateActions();
        try {
            const project = await platform.inspectProject({ projectId });
            if (version !== inspectionVersion || projectId !== select.value) return;
            prepared = project.prepared === true;
            readiness.textContent = prepared ? '离线依赖检查通过，可以在本机构建。' : '尚未准备好离线依赖，请在有网时准备。';
            if (!prepared && project.preparationReasons && project.preparationReasons.length) {
                readiness.textContent += ' ' + project.preparationReasons.map(reason => errorText(reason)).join('；');
            }
            const previous = project.latestTask;
            if (!activeTask && !starting && previous) {
                if (previous.state === 'queued' || previous.state === 'running') {
                    activeTask = previous;
                    if (polling) window.clearTimeout(polling);
                    polling = window.setTimeout(poll, 0);
                } else if (previous.operation === 'build' && previous.state === 'succeeded') {
                    resultTask = previous.taskId || previous.id;
                } else if (previous.state === 'interrupted') {
                    status.textContent = '上次任务因应用退出而中断，可以重新开始。';
                }
            }
        } catch (error) { if (version === inspectionVersion) readiness.textContent = '项目检查失败：' + errorText(error); }
        updateActions();
    }

    async function refreshProjects(preferredId) {
        const result = await platform.listProjects({});
        const projects = Array.isArray(result) ? result : result.projects || [];
        const previous = preferredId || select.value;
        select.innerHTML = '';
        if (!projects.length) select.add(new Option('暂无已导入工程', ''));
        projects.forEach(project => select.add(new Option(project.name || project.projectName || project.id, project.projectId || project.id)));
        if (projects.some(project => (project.projectId || project.id) === previous)) select.value = previous;
        await inspect();
    }

    async function poll() {
        if (!activeTask) return;
        try {
            const task = await platform.taskStatus({ taskId: activeTask.taskId || activeTask.id });
            const entries = task.logs || [];
            const isAtBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 24;
            log.value = entries.slice(-240).map(entry => typeof entry === 'string' ? entry : entry.message || entry.text || JSON.stringify(entry)).join('\n').slice(-40000);
            if (isAtBottom) log.scrollTop = log.scrollHeight;
            if (task.state === 'succeeded' || task.state === 'failed' || task.state === 'cancelled' || task.state === 'interrupted') {
                const wasBuild = activeTask.operation === 'build';
                if (task.state === 'succeeded') {
                    status.textContent = wasBuild ? '构建完成，可以预览或导出网站。' : '依赖准备完成，正在核对离线资源。';
                    if (wasBuild) resultTask = task.taskId || task.id;
                } else status.textContent = task.state === 'cancelled' ? '任务已取消，原始工程仍保留。'
                    : task.state === 'interrupted' ? '上次任务因应用退出而中断，可以重新开始。' : '任务失败：' + errorText(task.error);
                activeTask = null;
                await inspect();
                updateActions();
                return;
            }
            status.textContent = (activeTask.operation === 'prepare' ? '正在准备工程依赖' : '正在本机离线构建') + (task.message ? '：' + task.message : '…');
        } catch (error) { status.textContent = '读取任务状态失败，将继续重试：' + errorText(error); }
        polling = window.setTimeout(poll, dialog.open ? 1000 : 3000);
    }

    trigger.addEventListener('click', async () => {
        if (!dialog.open) dialog.showModal();
        dialog.querySelector('[data-project-close]').focus();
        try { await refreshProjects(); }
        catch (error) { status.textContent = '读取本机工程失败：' + errorText(error); }
    });
    dialog.querySelector('[data-project-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => trigger.focus());
    platform.onBack = () => {
        // JSON selection and other workbench confirmations use an accessible
        // overlay rather than <dialog>. Treat Back as Cancel before deciding
        // whether the activity should navigate or exit.
        const notice = document.getElementById('notice-overlay');
        if (notice && !notice.hidden) {
            notice.querySelector('#notice-close')?.click();
            return true;
        }
        if (dialog.open) { dialog.close(); return true; }
        const existing = document.querySelector('dialog[open]');
        if (existing) { existing.close(); return true; }
        return false;
    };
    select.addEventListener('change', () => { resultTask = null; inspect(); });
    actions.import.addEventListener('click', async () => {
        importing = true;
        updateActions();
        status.textContent = '请选择完整源码 ZIP…';
        try {
            const result = await platform.importProject({ pick: true });
            if (!result || result.cancelled) { status.textContent = '已取消导入。'; return; }
            resultTask = null;
            await refreshProjects(result.projectId || result.id || result.project && result.project.id);
            status.textContent = '工程已导入，源文件保存在本机项目目录。';
        } catch (error) { status.textContent = '工程导入失败：' + errorText(error); }
        finally { importing = false; updateActions(); }
    });
    for (const operation of ['prepare', 'build']) {
        actions[operation].addEventListener('click', async () => {
            if (starting || activeTask) return;
            starting = true;
            updateActions();
            resultTask = null;
            status.textContent = operation === 'prepare' ? '正在开始依赖准备…' : '正在开始离线构建…';
            try {
                activeTask = await platform[operation === 'prepare' ? 'prepareProject' : 'startBuild']({ projectId: select.value, online: operation === 'prepare', offline: operation === 'build' });
                starting = false;
                updateActions();
                if (polling) window.clearTimeout(polling);
                await poll();
            } catch (error) { activeTask = null; starting = false; status.textContent = '任务未能开始：' + errorText(error); updateActions(); }
        });
    }
    actions.cancel.addEventListener('click', async () => {
        if (!activeTask) return;
        try { await platform.cancelTask({ taskId: activeTask.taskId || activeTask.id }); status.textContent = '已请求取消，正在等待构建进程退出…'; }
        catch (error) { status.textContent = '取消失败：' + errorText(error); }
    });
    actions.preview.addEventListener('click', async () => {
        try { await platform.previewArtifact({ taskId: resultTask }); }
        catch (error) { status.textContent = '预览失败：' + errorText(error); }
    });
    actions.export.addEventListener('click', async () => {
        actions.export.disabled = true;
        try {
            const result = await platform.exportArtifact({ taskId: resultTask });
            if (!result) throw new Error('系统没有返回成品保存结果。');
            if (result.cancelled) { status.textContent = '已取消成品保存。'; return; }
            if (result.base64) {
                const text = atob(result.base64);
                const bytes = Uint8Array.from(text, character => character.charCodeAt(0));
                const saved = await platform.saveExport(new Blob([bytes], { type: result.mimeType || 'application/zip' }), result.name || 'website.zip');
                if (saved.cancelled) { status.textContent = '已取消成品保存。'; return; }
            } else if (result.saved !== true) throw new Error('成品文件尚未确认保存，请重试。');
            status.textContent = '成品 ZIP 已保存。';
        } catch (error) { status.textContent = '成品导出失败：' + errorText(error); }
        finally { updateActions(); }
    });
    updateActions();
}
