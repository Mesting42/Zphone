/**
 * 导出配置摘要的纯展示模块。
 * 调用方提供已有配置与统计结果；本模块不判断导出资格，
 * 不读取应用状态，也不参与文件生成、广告校验或下载。
 */
function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** 统一转义用户配置和数据源内容，长值由 CSS 自动换行。 */
function renderItem(item) {
    return '<div class="summary-item"><dt class="label">' + escapeHtml(item[0]) +
        '</dt><dd class="value">' + escapeHtml(item[1]) + '</dd></div>';
}

/** metrics/groups 只描述显示顺序，避免界面分组与业务规则互相依赖。 */
export function renderExportConfiguration({ title, themeName, metrics, groups }) {
    return '<header class="export-summary-heading"><div><span class="export-eyebrow">配置摘要</span>' +
        '<h3 class="export-site-title">' + escapeHtml(title) + '</h3></div>' +
        '<span class="export-theme-badge">' + escapeHtml(themeName) + '</span></header>' +
        '<dl class="export-key-metrics">' + metrics.map(function(metric) {
            return '<div><dt>' + escapeHtml(metric[0]) + '</dt><dd>' + escapeHtml(metric[1]) + '</dd></div>';
        }).join('') + '</dl>' +
        '<div class="export-summary-groups">' + groups.map(function(group) {
            return '<section class="export-summary-group' + (group.wide ? ' is-wide' : '') + '">' +
                '<h4>' + escapeHtml(group.title) + '</h4><dl class="summary-grid">' +
                group.items.map(renderItem).join('') + '</dl></section>';
        }).join('') + '</div>';
}

/** 资讯、工具和游戏差异化流程共用排版，继续使用业务层的审计计数。 */
export function renderDifferentiatedExportConfiguration(config, counts) {
    var games = config.type === 'games';
    return renderExportConfiguration({
        title: config.siteTitle,
        themeName: '差异化精品建站',
        metrics: [[games ? '游戏数量' : '数据条数', config.items.length], ['阻断项', counts.blockers], ['提示项', counts.warnings]],
        groups: [
            { title: '站点信息', items: [
                ['站点类型', games ? '游戏站' : config.type === 'editorial' ? '资讯站' : '工具站'],
                ['独立领域', config.vertical], ['正式域名', config.baseUrl || '尚未填写'],
                ['联系邮箱', config.contactEmail || '尚未填写']
            ] },
            { title: '设计配置', items: [
                ['建站方式', '差异化精品建站'], ['设计家族', config.design.name],
                ['设计指纹', config.designFingerprint]
            ] }
        ]
    });
}
