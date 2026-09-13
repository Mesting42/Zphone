import './styles.css';
import { createDefaultState, FIELD_DEFINITIONS, STYLE_PRESETS, TOPICS } from './config.js';
import { auditContent, mergeAuditIssues } from './core/audit.js';
import { importDataFile, mapRows } from './core/importer.js';
import { buildSite, siteToZip } from './core/generator.js';
import { CONFIG_VERSION, debounce, downloadBlob, escapeHtml } from './core/utils.js';

const STEPS = [
  ['站点身份', '确认真实运营信息'], ['上传数据', 'JSON、ZIP 与图片'], ['字段匹配', '建立内容数据模型'],
  ['质量检查', '内容、来源与封面'], ['结构样式', '布局与视觉预设'], ['SEO 与广告', '政策和导出模式'],
  ['审计导出', '预览、门禁与 ZIP']
];
const SEVERITY_LABELS = { BLOCKER: '阻断', HIGH: '高风险', WARNING: '警告', 'NEEDS MANUAL VERIFICATION': '需人工确认', PASS: '通过' };
let state = createDefaultState();
let progress = null;
let previewUrls = [];
let renderToken = 0;
const root = document.querySelector('#app');

render();
window.addEventListener('beforeunload', (event) => {
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = '';
});

function render() {
  root.innerHTML = `
    <header class="app-header">
      <div class="app-brand"><span class="app-monogram">SF</span><div><strong>SiteFoundry</strong><span>批量建站工作台</span></div></div>
      <div class="header-status"><span class="privacy-pill"><i></i>本地处理，不上传</span><button class="icon-button" data-action="theme" type="button" aria-label="切换明暗主题">◐</button></div>
    </header>
    <div class="step-progress" aria-label="总进度"><span style="width:${((state.currentStep + 1) / STEPS.length) * 100}%"></span></div>
    <div class="workspace">
      <aside class="step-sidebar" aria-label="建站步骤">
        <p class="side-label">工作流 · ${String(state.currentStep + 1).padStart(2, '0')} / 07</p>
        <nav>${STEPS.map(stepButton).join('')}</nav>
        <div class="local-note"><span aria-hidden="true">⌁</span><p><strong>数据留在设备中</strong><br>文件解析、审计和打包均在当前浏览器完成。</p></div>
      </aside>
      <main class="form-panel" id="workspace-main">
        ${stepHeader()}
        <div class="step-body">${renderStep()}</div>
        <div class="step-actions">
          <button class="button secondary" type="button" data-action="previous" ${state.currentStep === 0 ? 'disabled' : ''}>← 上一步</button>
          ${state.currentStep < 6 ? '<button class="button primary" type="button" data-action="next">保存并继续 →</button>' : '<button class="button primary" type="button" data-action="audit">重新运行完整审计</button>'}
        </div>
      </main>
      <aside class="preview-panel">${previewShell()}</aside>
    </div>
    ${progress ? progressOverlay() : ''}
    <div id="toast-region" aria-live="polite" aria-atomic="true"></div>`;
  bindEvents();
  schedulePreview();
}

function stepButton([title, subtitle], index) {
  const current = state.currentStep === index;
  const complete = state.completedSteps.includes(index);
  const status = current ? '当前' : complete ? '已完成' : '待配置';
  return `<button type="button" class="step-button ${current ? 'current' : ''} ${complete ? 'complete' : ''}" data-step="${index}" ${index > Math.max(state.currentStep + 1, ...state.completedSteps.map((item) => item + 1)) ? 'disabled' : ''}>
    <span class="step-number">${complete ? '✓' : String(index + 1).padStart(2, '0')}</span><span><strong>${title}</strong><small>${subtitle}</small></span><em>${status}</em>
  </button>`;
}

function stepHeader() {
  const [title, subtitle] = STEPS[state.currentStep];
  return `<div class="step-heading"><div><p class="kicker">STEP ${String(state.currentStep + 1).padStart(2, '0')}</p><h1>${title}</h1><p>${subtitle}</p></div><span class="step-state ${state.completedSteps.includes(state.currentStep) ? 'done' : ''}">${state.completedSteps.includes(state.currentStep) ? '已保存' : '配置中'}</span></div>`;
}

function renderStep() {
  return [identityStep, uploadStep, mappingStep, qualityStep, appearanceStep, policyStep, exportStep][state.currentStep]();
}

function identityStep() {
  const topicCards = Object.entries(TOPICS).map(([key, topic]) => `<label class="topic-card ${state.topic === key ? 'selected' : ''}"><input type="radio" name="topic" value="${key}" data-path="topic" ${state.topic === key ? 'checked' : ''}><span class="topic-icon">${topic.icon}</span><span><strong>${topic.label}</strong><small>${topic.english}</small></span><i></i></label>`).join('');
  return `<section class="form-section"><div class="section-title"><div><span>01</span><h2>选择内容主题</h2></div><p>主题只提供结构起点，实际内容必须独立且真实。</p></div><div class="topic-grid">${topicCards}</div></section>
  <section class="form-section"><div class="section-title"><div><span>02</span><h2>真实站点身份</h2></div><p>带 * 的字段会参与递审导出门禁，工具不会替你编造。</p></div>
  <div class="form-grid two">${textField('identity.siteName', '真实站点名称 *', '例如：Northfield Tech Journal')}${textField('identity.tagline', '准确标语 *', '一句话说明读者能获得什么')}${textArea('identity.description', '站点描述 *', '覆盖主题、目标读者和内容范围', true)}${textField('identity.baseUrl', '正式 HTTPS 域名 *', 'https://your-domain.com/')}${textField('identity.publisherName', '真实运营者 *', '个人、团队或组织真实名称')}${textField('identity.contactEmail', '真实联系邮箱 *', 'editor@your-domain.com', 'email')}${textField('identity.copyrightOwner', '版权主体 *', '真实版权所有者')}${textField('identity.defaultAuthor', '真实默认作者 *', '仅在确由此人创作或审核时填写')}${textArea('identity.editorialProcess', '编辑与事实核验流程 *', '说明如何研究、创作、核查、更新和纠错', true)}${textArea('identity.contentOrigin', '内容来源说明 *', '原创、人工编辑、AI 辅助等真实方式', true)}${textField('identity.targetRegions', '目标地区 *', '例如：United States, Canada')}${textField('identity.phone', '电话（可选）', '未提供时不会展示', 'tel')}</div></section>`;
}

function uploadStep() {
  const d = state.data;
  const stats = d.rows.length ? `<div class="metric-row"><article><span>数据条数</span><strong>${d.rows.length}</strong></article><article><span>字段数量</span><strong>${d.fields.length}</strong></article><article><span>本地图片</span><strong>${d.images.length}</strong></article><article><span>导入提醒</span><strong>${d.warnings.length}</strong></article></div>` : '';
  const fields = d.fields.length ? `<div class="table-wrap"><table><thead><tr><th>字段名</th><th>类型</th><th>空值率</th></tr></thead><tbody>${d.fields.map((field) => `<tr><td><code>${escapeHtml(field.name)}</code></td><td>${escapeHtml(field.type)}</td><td>${field.emptyRate}%</td></tr>`).join('')}</tbody></table></div>` : '';
  const preview = d.preview.length ? `<details><summary>查看前三条原始数据</summary><pre>${escapeHtml(JSON.stringify(d.preview, null, 2))}</pre></details>` : '';
  const warnings = d.warnings.length ? `<div class="notice warning"><strong>发现 ${d.warnings.length} 项导入提醒</strong><ul>${d.warnings.slice(0, 8).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : '';
  return `<section class="form-section"><div class="section-title"><div><span>01</span><h2>导入文章与图片</h2></div><p>支持 JSON 数组、articles/data 包裹对象，或含一个 JSON 和 images/ 的 ZIP。</p></div>
  <label class="dropzone" for="data-file"><span class="upload-icon">↥</span><strong>${d.fileName ? escapeHtml(d.fileName) : '选择 JSON 或 ZIP 文件'}</strong><small>文件仅在浏览器内解析 · ZIP 会检查路径穿越与 CRC</small><input id="data-file" type="file" accept=".json,.zip,application/json,application/zip"></label>${stats}${warnings}${fields}${preview}</section>
  <section class="form-section"><div class="section-title"><div><span>02</span><h2>权利与完整性</h2></div><p>确认必须由拥有相关信息的人主动完成。</p></div>${confirmBox('confirmations.imageRights', '我确认上传的全部图片由本站拥有或已取得合法授权', '此确认会写入本次审计上下文，但不会伪造授权证明。')}</section>`;
}

function mappingStep() {
  if (!state.data.fields.length) return emptyPanel('尚未导入数据', '返回上一步导入 JSON 或 ZIP，字段列表随后会显示在这里。', 1);
  const options = `<option value="">不映射 / 隐藏</option>${state.data.fields.map((field) => `<option value="${escapeHtml(field.name)}">${escapeHtml(field.name)} · ${escapeHtml(field.type)}</option>`).join('')}`;
  return `<section class="form-section"><div class="section-title"><div><span>01</span><h2>字段映射</h2></div><p>只渲染真实存在且已映射的字段；可选字段留空时完全隐藏。</p></div><div class="mapping-list">${FIELD_DEFINITIONS.map(([key, label, required]) => `<label><span><strong>${label}${required ? ' *' : ''}</strong><code>${key}</code></span><select data-mapping="${key}">${options.replace(`value="${escapeHtml(state.mapping[key] || '')}"`, `value="${escapeHtml(state.mapping[key] || '')}" selected`)}</select></label>`).join('')}</div><div class="notice info"><strong>映射后的结果</strong><p>当前可生成 ${state.articles.length} 条文章记录；下一步会逐篇计算最终可见英文单词数、正文指纹和封面唯一性。</p></div></section>`;
}

function qualityStep() {
  if (!state.articles.length) return emptyPanel('没有可检查的文章', '先导入数据并完成字段映射。', 1);
  const audit = state.audit;
  const confirmation = `<div class="confirm-grid">${confirmBox('confirmations.sourceLinks', '我已核对每篇文章的来源与正文主张相关', '自动规则只能验证 URL 格式。')}${confirmBox('confirmations.externalLinks', '我已逐项打开并确认所有外链可访问', '纯浏览器无法绕过跨域限制读取所有状态码。')}${confirmBox('confirmations.visualImages', '我已人工复核被标记为视觉近似的图片', '仅在实际逐张比较后确认。')}</div>`;
  if (!audit) return `<section class="form-section"><div class="section-title"><div><span>01</span><h2>真实性人工确认</h2></div><p>先完成可确认项，再运行自动检查。</p></div>${confirmation}<button class="button primary wide-button" type="button" data-action="audit">运行内容质量检查</button></section>`;
  const rows = audit.articleResults.map((result) => `<tr class="${result.valid ? 'valid-row' : 'invalid-row'}"><td>${result.index + 1}</td><td><strong>${escapeHtml(result.title)}</strong><small>${result.valid ? '有效文章' : [...result.blockers, ...result.manual, ...result.warnings][0] || '待检查'}</small></td><td>${result.wordCount}</td><td>${result.imageHash ? `<code title="${result.imageHash}">${result.imageHash.slice(0, 10)}…</code>` : '—'}</td><td><span class="row-status ${result.valid ? 'pass' : 'fail'}">${result.valid ? '通过' : '排除'}</span></td></tr>`).join('');
  return `<section class="form-section"><div class="section-title"><div><span>01</span><h2>真实性人工确认</h2></div><p>确认项变化后需要重新运行审计。</p></div>${confirmation}</section>${auditSummary(audit)}<section class="form-section"><div class="section-title"><div><span>02</span><h2>逐篇检查结果</h2></div><p>单词数仅统计清洗后的 article 正文；800 词及以下不会计入。</p></div><div class="table-wrap article-results"><table><thead><tr><th>#</th><th>文章</th><th>英文词数</th><th>图片哈希</th><th>结果</th></tr></thead><tbody>${rows}</tbody></table></div><button class="button secondary" type="button" data-action="audit">重新检查</button></section>`;
}

function appearanceStep() {
  const presets = Object.entries(STYLE_PRESETS).map(([name, colors]) => `<label class="preset-card ${state.appearance.preset === name ? 'selected' : ''}"><input type="radio" name="preset" data-path="appearance.preset" value="${name}" ${state.appearance.preset === name ? 'checked' : ''}><span class="swatches">${colors.slice(0, 3).map((color) => `<i style="background:${color}"></i>`).join('')}</span><strong>${name}</strong></label>`).join('');
  return `<section class="form-section"><div class="section-title"><div><span>01</span><h2>视觉预设</h2></div><p>12 套预设均包含可见焦点、响应式布局与减少动画支持。</p></div><div class="preset-grid">${presets}</div></section>
  <section class="form-section"><div class="section-title"><div><span>02</span><h2>结构与节奏</h2></div></div><div class="form-grid two">
  ${selectField('appearance.navLayout', '导航布局', [['regular','常规'],['center','居中'],['left','左对齐']])}${selectField('appearance.footerLayout', 'Footer 版式', [['detailed','详细'],['minimal','简约']])}
  ${selectField('appearance.homeLinkStyle', '返回首页方式', [['breadcrumb','面包屑'],['button','按钮'],['text','文字链接']])}${selectField('appearance.sort', '内容排序', [['date','发布日期'],['source','数据顺序'],['title','标题'],['shuffle','固定种子洗牌']])}
  ${selectField('appearance.columns', '卡片列数', [['responsive','响应式'],['2','固定 2 列'],['3','固定 3 列'],['4','固定 4 列']])}
  <label class="field full"><span>分类顺序（逗号分隔，空分类自动隐藏）</span><input type="text" data-categories value="${escapeHtml(state.appearance.categories.join(', '))}"></label>
  ${numberField('appearance.cardsPerCategory', '每类卡片数', 3, 12)}${numberField('appearance.relatedCount', '相关推荐数', 2, 8)}${rangeField('appearance.radius', '卡片圆角', 0, 28)}${selectField('appearance.density', '内容密度', [['comfortable','舒适'],['compact','紧凑'],['airy','宽松']])}
  ${toggleField('appearance.hero', '显示克制型 Hero')}${toggleField('appearance.shadow', '卡片阴影')}${toggleField('appearance.animation', '轻量入场动画')}</div></section>`;
}

function policyStep() {
  const p = state.policy;
  return `<section class="form-section"><div class="section-title"><div><span>01</span><h2>SEO 与政策页面</h2></div><p>Canonical、sitemap、robots、JSON-LD 与四个信任页面将自动生成。</p></div><div class="form-grid two">${textField('policy.privacyEffectiveDate', '隐私政策生效/更新日期 *', 'YYYY-MM-DD', 'date')}${textField('policy.adsenseVerification', 'AdSense 站点验证值（可选）', '真实账号值；不会生成示例 ID')}${toggleField('policy.analyticsEnabled', '本站实际启用了分析服务')}${textField('policy.formEndpoint', '真实表单端点（可选）', '当前版本未验证端点时不生成表单')}</div><div class="notice info"><strong>法律边界</strong><p>生成的政策文本是可编辑起点，不构成法律意见；部署前应按经营者所在地、受众和实际脚本复核。</p></div></section>
  <section class="form-section"><div class="section-title"><div><span>02</span><h2>过审后广告配置</h2></div><p>递审版不会输出广告位。只有显式启用且真实配置完整，广告版才加载一次脚本。</p></div><div class="form-grid two">${toggleField('policy.adsEnabled', '启用过审后广告版')}${textField('policy.publisherId', '真实 Publisher ID', 'ca-pub-1234567890123456')}${selectField('policy.adMode', '广告模式', [['auto','Auto ads'],['manual','手动响应式广告位']])}${textField('policy.adSlot', '手动广告位 Slot', '仅手动模式需要')}${toggleField('policy.personalizedAds', '计划提供个性化广告')}${textArea('policy.adsTxt', '真实 ads.txt 记录', 'google.com, pub-xxxxxxxxxxxxxxxx, DIRECT, f08c47fec0942fa0', true)}</div>${confirmBox('confirmations.cmp', '如适用，我已确认使用当前 Google 认证且符合要求的 CMP', '仅在目标地区和个性化广告配置触发时参与门禁。')}</section>`;
}

function exportStep() {
  const audit = state.audit;
  const summary = audit ? auditSummary(audit) : `<div class="notice warning"><strong>尚未运行完整审计</strong><p>递审版与广告版暂不可导出。</p></div>`;
  return `${summary}<section class="form-section"><div class="section-title"><div><span>01</span><h2>配置摘要</h2></div><p>最终 ZIP 包含静态 HTML、资源、sitemap、robots、404 和 HTML/JSON 审计报告。</p></div><div class="export-summary"><div><span>站点</span><strong>${escapeHtml(state.identity.siteName || '未填写')}</strong></div><div><span>主题</span><strong>${escapeHtml(TOPICS[state.topic].label)}</strong></div><div><span>导入数据</span><strong>${state.articles.length} 篇</strong></div><div><span>有效文章</span><strong>${audit?.validCount || 0} / 35+</strong></div><div><span>视觉风格</span><strong>${escapeHtml(state.appearance.preset)}</strong></div><div><span>审计状态</span><strong>${escapeHtml(audit?.status || 'NOT ASSESSABLE')}</strong></div></div></section>
  <section class="form-section"><div class="section-title"><div><span>02</span><h2>导出版本</h2></div><p>所有版本都会重新构建并检查内部链接。</p></div><div class="export-cards">
  ${exportCard('draft','草稿版','允许缺失项，页面带醒目的 DRAFT 标识；用于本地校对。',true)}
  ${exportCard('review','递审版','不含广告位；仅在全部门禁和人工确认完成后开放。',Boolean(audit?.canExportReview))}
  ${exportCard('ads','过审后广告版','仅在递审门禁通过且真实广告配置完整时开放。',Boolean(audit?.canExportReview && state.policy.adsEnabled && /^ca-pub-\d{16}$/.test(state.policy.publisherId)))}
  </div><div class="config-actions"><button class="text-button" type="button" data-action="config-export">导出生成器配置</button><label class="text-button file-button">导入生成器配置<input type="file" id="config-file" accept="application/json,.json"></label></div></section>${audit ? issueList(audit) : ''}`;
}

function auditSummary(audit) {
  const statusClass = audit.status === 'READY FOR MANUAL REVIEW' ? 'ready' : audit.status === 'NEEDS WORK' ? 'work' : 'unknown';
  return `<section class="audit-hero ${statusClass}"><div><p class="kicker">本地审计结论</p><h2>${escapeHtml(audit.status)}</h2><p>${audit.status === 'READY FOR MANUAL REVIEW' ? '自动检查范围内未发现阻塞项，仍需站长进行最终人工复核。' : audit.status === 'NEEDS WORK' ? '仍有内容、配置或人工确认项需要处理。' : '关键真实信息缺失，当前无法评估。'}</p></div><div class="audit-meter"><strong>${audit.validCount}</strong><span>/ 35 有效文章</span></div><div class="severity-row">${Object.entries(audit.counts).map(([level, count]) => `<span class="severity ${severityClass(level)}"><b>${count}</b>${SEVERITY_LABELS[level]}</span>`).join('')}</div></section>`;
}

function issueList(audit) {
  const actionable = audit.issues.filter((item) => item.severity !== 'PASS');
  return `<section class="form-section"><div class="section-title"><div><span>03</span><h2>需要处理的项目</h2></div><p>点击问题可定位到对应步骤。</p></div><div class="issue-list">${actionable.length ? actionable.slice(0, 60).map((item) => `<button type="button" data-locate="${item.targetStep}" class="issue-item"><span class="severity ${severityClass(item.severity)}">${SEVERITY_LABELS[item.severity]}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></span><i>→</i></button>`).join('') : '<div class="notice success"><strong>没有待处理项</strong><p>请继续进行最终人工复核和上线后可达性检查。</p></div>'}</div></section>`;
}

function exportCard(mode, title, text, enabled) {
  return `<article class="export-card ${enabled ? '' : 'locked'}"><span class="export-icon">${mode === 'draft' ? 'D' : mode === 'review' ? 'R' : 'A'}</span><h3>${title}</h3><p>${text}</p><button class="button ${enabled ? 'primary' : 'secondary'}" type="button" data-export="${mode}" ${enabled ? '' : 'disabled'}>${enabled ? `导出 ${title} ZIP` : '门禁尚未通过'}</button></article>`;
}

function previewShell() {
  const articleOptions = state.articles.map((article, index) => `<option value="article:${index}" ${state.preview.page === `article:${index}` ? 'selected' : ''}>文章 · ${escapeHtml(article.title || `第 ${index + 1} 条`)}</option>`).join('');
  return `<div class="preview-heading"><div><p class="side-label">实时安全预览</p><h2>${escapeHtml(state.identity.siteName || '未命名站点')}</h2></div><span id="preview-state">更新中</span></div><div class="preview-tools"><select id="preview-page" aria-label="预览页面"><option value="home">首页</option><option value="category">分类页</option>${articleOptions}<option value="about">About</option><option value="contact">Contact</option><option value="privacy">Privacy</option><option value="terms">Terms</option><option value="404">404</option></select><div class="viewport-tabs" aria-label="预览尺寸">${[['mobile','手机'],['tablet','平板'],['desktop','桌面']].map(([key,label]) => `<button data-viewport="${key}" type="button" class="${state.preview.viewport === key ? 'active' : ''}" aria-label="${label}">${key === 'mobile' ? '▯' : key === 'tablet' ? '▭' : '▱'}</button>`).join('')}</div></div><div class="preview-stage ${state.preview.viewport}"><iframe id="site-preview" title="生成网站预览" sandbox="allow-scripts"></iframe></div><p class="preview-footnote">预览在隔离 iframe 中渲染；草稿占位图不会计入递审有效文章。</p>`;
}

function bindEvents() {
  root.querySelectorAll('[data-step]').forEach((button) => button.addEventListener('click', () => { state.currentStep = Number(button.dataset.step); render(); }));
  root.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => handleAction(button.dataset.action)));
  root.querySelectorAll('[data-export]').forEach((button) => button.addEventListener('click', () => exportSite(button.dataset.export)));
  root.querySelectorAll('[data-locate]').forEach((button) => button.addEventListener('click', () => { state.currentStep = Number(button.dataset.locate); render(); }));
  root.querySelectorAll('[data-path]').forEach((input) => {
    const handler = () => {
      const value = input.type === 'checkbox' ? input.checked : input.type === 'number' || input.type === 'range' ? Number(input.value) : input.value;
      setPath(input.dataset.path, value);
      if (input.dataset.path === 'topic') state.appearance.categories = [...TOPICS[value].categories];
      invalidateAudit();
      if (input.type === 'radio' || input.type === 'checkbox' || input.tagName === 'SELECT') render();
      else debouncedPreview();
    };
    input.addEventListener(input.type === 'text' || input.tagName === 'TEXTAREA' || input.type === 'email' || input.type === 'tel' ? 'input' : 'change', handler);
  });
  root.querySelectorAll('[data-mapping]').forEach((select) => select.addEventListener('change', () => {
    state.mapping[select.dataset.mapping] = select.value;
    state.articles = mapRows(state.data.rows, state.mapping, state.data.images);
    invalidateAudit(); render();
  }));
  root.querySelector('[data-categories]')?.addEventListener('change', (event) => {
    state.appearance.categories = event.target.value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 8);
    invalidateAudit(); state.dirty = true; render();
  });
  root.querySelector('#data-file')?.addEventListener('change', (event) => importContentFile(event.target.files[0]));
  root.querySelector('#config-file')?.addEventListener('change', (event) => importConfig(event.target.files[0]));
  root.querySelector('#preview-page')?.addEventListener('change', (event) => { state.preview.page = event.target.value; schedulePreview(); });
  root.querySelectorAll('[data-viewport]').forEach((button) => button.addEventListener('click', () => { state.preview.viewport = button.dataset.viewport; root.querySelector('.preview-stage').className = `preview-stage ${state.preview.viewport}`; root.querySelectorAll('[data-viewport]').forEach((item) => item.classList.toggle('active', item === button)); }));
}

async function handleAction(action) {
  if (action === 'next') {
    if (!state.completedSteps.includes(state.currentStep)) state.completedSteps.push(state.currentStep);
    state.currentStep = Math.min(6, state.currentStep + 1); state.dirty = true; render(); return;
  }
  if (action === 'previous') { state.currentStep = Math.max(0, state.currentStep - 1); render(); return; }
  if (action === 'theme') {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next; localStorage.setItem('sitefoundry-theme', next); return;
  }
  if (action === 'audit') { await runAudit(); return; }
  if (action === 'config-export') { exportConfig(); }
}

async function importContentFile(file) {
  if (!file) return;
  setProgress(3, '正在读取文件', file.name);
  try {
    const imported = await importDataFile(file, (percent, label) => setProgress(percent, label, file.name));
    state.data = imported;
    const fieldNames = new Set(imported.fields.map((field) => field.name));
    for (const [target] of FIELD_DEFINITIONS) if (!fieldNames.has(state.mapping[target])) state.mapping[target] = fieldNames.has(target) ? target : '';
    state.articles = mapRows(imported.rows, state.mapping, imported.images);
    state.audit = null; state.dirty = true;
    setProgress(100, '导入完成', `${imported.rows.length} 条数据 · ${imported.images.length} 张图片`);
    setTimeout(() => { progress = null; render(); toast('数据已安全导入'); }, 350);
  } catch (error) {
    progress = null; render(); toast(error.message, 'error');
  }
}

async function runAudit() {
  setProgress(2, '正在检查站点配置', '开始构建质量证据');
  try {
    let audit = await auditContent(state, (percent, label) => setProgress(Math.min(75, 8 + percent * .67), label, '正在比对文章与图片'));
    const probe = await buildSite(state, 'draft', audit);
    audit = mergeAuditIssues(audit, probe.linkAudit.issues.filter((item) => item.severity !== 'PASS' || probe.linkAudit.errorCount === 0));
    state.audit = audit;
    state.completedSteps = [...new Set([...state.completedSteps, 3])];
    setProgress(100, '审计完成', `${audit.validCount} 篇有效文章 · ${audit.counts.BLOCKER} 个阻断项`);
    setTimeout(() => { progress = null; render(); toast('完整审计已更新'); }, 450);
  } catch (error) {
    progress = null; render(); toast(`审计失败：${error.message}`, 'error');
  }
}

async function exportSite(mode) {
  if (mode !== 'draft' && !state.audit?.canExportReview) { toast('递审门禁尚未通过', 'error'); return; }
  setProgress(4, '正在生成静态网站', `${modeLabel(mode)} · 所有内容在本地处理`);
  try {
    const site = await buildSite(state, mode, state.audit);
    if (mode !== 'draft' && site.linkAudit.errorCount) throw new Error(`生成后发现 ${site.linkAudit.errorCount} 个链接或页面结构错误。`);
    const blob = await siteToZip(site, (percent, label) => setProgress(percent, label, `${site.files.size} 个静态文件`));
    const slug = (state.identity.siteName || 'sitefoundry-export').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sitefoundry-export';
    downloadBlob(blob, `${slug}-${mode}-${new Date().toISOString().slice(0, 10)}.zip`);
    state.dirty = false;
    setProgress(100, 'ZIP 已生成', `${site.articles.length} 篇文章 · ${site.linkAudit.checkedPages} 个 HTML 页面`);
    setTimeout(() => { progress = null; render(); toast('ZIP 已下载，可解压后部署到静态服务器'); }, 500);
  } catch (error) { progress = null; render(); toast(`导出失败：${error.message}`, 'error'); }
}

function exportConfig() {
  const payload = {
    version: CONFIG_VERSION, exportedAt: new Date().toISOString(), topic: state.topic, identity: state.identity,
    mapping: state.mapping, appearance: state.appearance, policy: state.policy
  };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), 'sitefoundry-config.json');
  toast('配置已导出；文章与图片不会写入配置文件');
}

async function importConfig(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (!payload || typeof payload !== 'object') throw new Error('配置文件格式无效。');
    if (payload.version > CONFIG_VERSION) throw new Error(`配置版本 ${payload.version} 高于当前支持版本 ${CONFIG_VERSION}。`);
    state = {
      ...state, topic: TOPICS[payload.topic] ? payload.topic : state.topic,
      identity: { ...state.identity, ...payload.identity }, mapping: { ...state.mapping, ...payload.mapping },
      appearance: { ...state.appearance, ...payload.appearance }, policy: { ...state.policy, ...payload.policy },
      confirmations: createDefaultState().confirmations, audit: null, dirty: true
    };
    state.articles = mapRows(state.data.rows, state.mapping, state.data.images);
    render(); toast('配置已导入；权利、来源和 CMP 需要重新确认');
  } catch (error) { toast(`配置导入失败：${error.message}`, 'error'); }
}

const debouncedPreview = debounce(schedulePreview, 220);
async function schedulePreview() {
  const token = ++renderToken;
  const iframe = root.querySelector('#site-preview');
  if (!iframe) return;
  try {
    const audit = state.audit || await auditContent({ ...state, confirmations: { ...state.confirmations, externalLinks: true } });
    const site = await buildSite(state, 'draft', audit);
    if (token !== renderToken || !root.querySelector('#site-preview')) return;
    let path = 'index.html';
    if (state.preview.page === 'category') path = site.categories[0] ? `category/${site.categories[0].slug}/index.html` : 'index.html';
    else if (state.preview.page.startsWith('article:')) {
      const index = Number(state.preview.page.split(':')[1]); path = site.articles[index] ? `articles/${site.articles[index].slug}/index.html` : 'index.html';
    } else if (['about','contact','privacy','terms'].includes(state.preview.page)) path = `${state.preview.page}/index.html`;
    else if (state.preview.page === '404') path = '404.html';
    let html = String(site.files.get(path) || site.files.get('index.html'));
    html = html.replace('<link rel="stylesheet" href="/assets/css/style.css">', `<style>${site.files.get('assets/css/style.css')}</style>`);
    previewUrls.forEach(URL.revokeObjectURL); previewUrls = [];
    for (const image of state.data.images || []) {
      const url = URL.createObjectURL(new Blob([image.bytes], { type: image.mime })); previewUrls.push(url);
      html = html.replaceAll(`/${image.outputPath}`, url);
    }
    const fallbackUrl = URL.createObjectURL(new Blob([site.files.get('assets/images/image-unavailable.svg')], { type: 'image/svg+xml' }));
    previewUrls.push(fallbackUrl); html = html.replaceAll('/assets/images/image-unavailable.svg', fallbackUrl);
    iframe.srcdoc = html;
    const status = root.querySelector('#preview-state'); if (status) status.textContent = '已同步';
  } catch (error) {
    iframe.srcdoc = `<p style="font:16px sans-serif;padding:24px">预览构建失败：${escapeHtml(error.message)}</p>`;
  }
}

function setPath(path, value) {
  const parts = path.split('.'); let target = state;
  while (parts.length > 1) target = target[parts.shift()];
  target[parts[0]] = value; state.dirty = true;
}

function getPath(path) { return path.split('.').reduce((value, key) => value?.[key], state); }
function invalidateAudit() { state.audit = null; }

function textField(path, label, placeholder = '', type = 'text') {
  return `<label class="field"><span>${label}</span><input type="${type}" data-path="${path}" value="${escapeHtml(getPath(path) || '')}" placeholder="${escapeHtml(placeholder)}" ${label.includes('*') ? 'required' : ''}></label>`;
}
function textArea(path, label, placeholder = '', full = false) {
  return `<label class="field ${full ? 'full' : ''}"><span>${label}</span><textarea data-path="${path}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(getPath(path) || '')}</textarea></label>`;
}
function selectField(path, label, options) {
  return `<label class="field"><span>${label}</span><select data-path="${path}">${options.map(([value, text]) => `<option value="${value}" ${getPath(path) === value ? 'selected' : ''}>${text}</option>`).join('')}</select></label>`;
}
function numberField(path, label, min, max) { return `<label class="field"><span>${label}</span><input type="number" min="${min}" max="${max}" data-path="${path}" value="${getPath(path)}"></label>`; }
function rangeField(path, label, min, max) { return `<label class="field"><span>${label} <b>${getPath(path)}px</b></span><input type="range" min="${min}" max="${max}" data-path="${path}" value="${getPath(path)}"></label>`; }
function toggleField(path, label) { return `<label class="toggle-field"><input type="checkbox" data-path="${path}" ${getPath(path) ? 'checked' : ''}><span></span><strong>${label}</strong></label>`; }
function confirmBox(path, title, text) { return `<label class="confirm-box ${getPath(path) ? 'checked' : ''}"><input type="checkbox" data-path="${path}" ${getPath(path) ? 'checked' : ''}><span class="checkmark">✓</span><span><strong>${title}</strong><small>${text}</small></span></label>`; }

function emptyPanel(title, text, step) { return `<div class="empty-panel"><span>○</span><h2>${title}</h2><p>${text}</p><button class="button primary" type="button" data-locate="${step}">前往对应步骤</button></div>`; }
function severityClass(level) { return level.toLowerCase().replaceAll(' ', '-'); }
function modeLabel(mode) { return ({ draft: '草稿版', review: '递审版', ads: '广告版' })[mode]; }
function progressOverlay() { return `<div class="progress-overlay" role="dialog" aria-modal="true" aria-label="处理中"><div class="progress-card"><span class="progress-orbit"></span><p class="kicker">LOCAL PROCESS</p><h2>${escapeHtml(progress.label)}</h2><p>${escapeHtml(progress.detail)}</p><div class="progress-track"><i style="width:${progress.percent}%"></i></div><strong>${progress.percent}%</strong></div></div>`; }
function setProgress(percent, label, detail) { progress = { percent: Math.max(0, Math.min(100, Math.round(percent))), label, detail }; render(); }
function toast(message, type = 'success') {
  let region = root.querySelector('#toast-region');
  if (!region) { region = document.createElement('div'); region.id = 'toast-region'; region.setAttribute('aria-live', 'polite'); document.body.append(region); }
  const item = document.createElement('div'); item.className = `toast ${type}`; item.textContent = message; region.append(item); setTimeout(() => item.remove(), 4500);
}

const savedTheme = localStorage.getItem('sitefoundry-theme');
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
