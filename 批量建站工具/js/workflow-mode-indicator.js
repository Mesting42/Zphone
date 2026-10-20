(function attachWorkflowModeIndicator(global) {
    'use strict';

    // Keep the workflow names in one presentation-only map shared by both builders.
    var MAIN_WORKFLOW_LABELS = Object.freeze({
        normal: '普通建站',
        'game-builder': '游戏建站',
        'ad-migration': '广告移植建站',
        'ad-template-reuse': '广告模板复用',
        'ad-injection': '成品站加广告',
        'batch-ad-build': '批量建站加广告',
        'ad-restoration': '批量广告策略',
        differentiated: '差异化精品建站'
    });
    var GAME_WORKFLOW_LABELS = Object.freeze({
        normal: '游戏建站 · 普通建站',
        'ad-migration': '游戏建站 · 广告移植建站',
        differentiated: '游戏建站 · 差异化精品建站'
    });

    /** Return the visible workflow name for the selected builder and mode. */
    function getLabel(mode, surface) {
        var modeKey = typeof mode === 'string' ? mode : '';
        var labels = surface === 'game' ? GAME_WORKFLOW_LABELS : MAIN_WORKFLOW_LABELS;
        return labels[modeKey] || (surface === 'game' ? '游戏建站 · 当前模式' : '当前工作流');
    }

    /** Update the stable live region without coupling the label to workflow behavior. */
    function sync(target, mode, surface) {
        if (!target) return '';

        var label = getLabel(mode, surface);
        target.textContent = label;
        if (target.dataset) target.dataset.workflowMode = typeof mode === 'string' ? mode : '';
        return label;
    }

    global.WorkflowModeIndicator = Object.freeze({
        getLabel: getLabel,
        sync: sync
    });
})(window);
