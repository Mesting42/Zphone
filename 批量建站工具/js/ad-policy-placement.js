/** 广告策略放置器的展示与编辑规则。这里只处理纯数据，不读取或修改应用状态。 */
const LABELS = {
    'after-navbar': '导航栏下方', 'after-hero': '主视觉之后',
    'content-top': '内容区顶部', 'content-middle': '内容中段', 'content-bottom': '内容区底部',
    'after-section-0': '第一个分类后', 'after-section-1': '第二个分类后',
    'after-section-2': '第三个分类后', 'footer-top': '页脚上方',
    'detail-before-content': '正文前', 'detail-middle': '正文中部',
    'detail-after-content': '正文中部', 'detail-before-related': '相关推荐前',
    'detail-after-related': '相关推荐后'
};

export function policyPlacementLabel(position) {
    const original = /^original-banner([123])$/.exec(position || '');
    if (original) return '原站位置 ' + original[1];
    if (/^custom-after-/.test(position || '')) return '自定义内容位置';
    return LABELS[position] || '未放置';
}

/** 常用位置只给出语义名称；是否能安全放置由共享导出核心判断。 */
export function commonPolicyPlacements(page) {
    const positions = page === 'home'
        ? ['after-navbar', 'content-top', 'after-section-0', 'after-section-1', 'after-section-2', 'content-middle', 'content-bottom', 'footer-top']
        : page === 'detail'
            ? ['after-navbar', 'detail-before-content', 'detail-middle', 'detail-after-related', 'footer-top']
            : page === 'all' ? ['after-navbar', 'content-top', 'content-middle', 'content-bottom', 'footer-top'] : [];
    return positions.map(position => ({ position, label: policyPlacementLabel(position) }));
}

/** 返回独立副本。取消编辑无需回滚；只有点击候选位或移除时才提交当前页面的值。 */
export function editPolicyPlacement(source, page, index, position) {
    const policy = JSON.parse(JSON.stringify(source));
    const slots = policy.slots && policy.slots[page];
    const slot = slots && slots[index];
    if (!slot) return null;
    if (position == null) {
        // 移除仅关闭当前页面的容器，保留位置供下一次重新放置或恢复使用。
        slot.unit = 'off';
        return policy;
    }
    if (slots.some((other, otherIndex) => otherIndex !== index && other.unit !== 'off' && other.position === position)) return null;
    slot.position = position;
    if (slot.unit === 'off') {
        const used = slots.map(other => other.unit);
        slot.unit = ['banner1', 'banner2', 'banner3'].find(unit => !used.includes(unit)) || 'off';
    }
    return policy;
}
