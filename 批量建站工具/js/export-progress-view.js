/**
 * 导出进度的共用展示层。调用方负责执行任务和判断结果；
 * 此处只同步可见性、百分比和状态，不触发导出或改变门禁。
 */
export function updateWorkflowExportProgress(prefix, percent, message, state) {
    var container = document.getElementById(prefix);
    // 普通导出沿用原有 progress-* ID，专用流程使用各自前缀。
    var childPrefix = prefix === 'export-progress' ? 'progress' : prefix;
    var fill = document.getElementById(childPrefix + '-fill');
    var value = document.getElementById(childPrefix + '-value');
    var text = document.getElementById(childPrefix + '-text');
    // 仅更新阶段说明时传 null，保留上一次百分比，避免错误态回退至 0%。
    var numeric = percent == null ? NaN : Number(percent);
    var safePercent = Number.isFinite(numeric)
        ? Math.max(0, Math.min(100, Math.round(numeric)))
        : Number(container && container.dataset.progress) || 0;
    if (container) {
        container.hidden = false;
        container.dataset.state = state || 'loading';
        container.dataset.progress = String(safePercent);
    }
    if (fill) fill.style.width = safePercent + '%';
    if (value) value.textContent = safePercent + '%';
    if (text) text.textContent = message;
}

/** 模式切换只更新标签，保留已经初始化的果冻装饰和事件。 */
export function setWorkflowExportButtonLabel(id, text) {
    var button = document.getElementById(id);
    if (!button) return;
    if (window.SiteFoundryJellyButton) window.SiteFoundryJellyButton.setLabel(button, text);
    else button.textContent = text;
}
