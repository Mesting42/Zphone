import {
  countEnglishWords, fnv1a, formatDate, isSafeExternalUrl, jaccard, makeExcerpt, normalizeBaseUrl,
  shingleSet, textFingerprint, toStringList, visibleArticleText, yieldToBrowser
} from './utils.js';
import { REQUIRED_IDENTITY_FIELDS } from '../config.js';

const PLACEHOLDER_PATTERN = /\b(lorem ipsum|tbd|coming soon|placeholder|dummy text)\b|example\.com|pub-0{6,}/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function issue(severity, title, detail, targetStep, extra = {}) {
  return { id: `${severity}-${fnv1a(`${title}|${detail}|${targetStep}`)}`, severity, title, detail, targetStep, ...extra };
}

function normalizedSources(value) {
  if (Array.isArray(value)) {
    return value.map((item) => typeof item === 'object' ? item.url || item.href || '' : item).map(String).filter(Boolean);
  }
  return toStringList(value);
}

function hamming(left, right) {
  if (!left || !right || left.length !== right.length) return Infinity;
  let distance = 0;
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) distance += 1;
  return distance;
}

export async function auditContent(state, onProgress = () => {}) {
  const issues = [];
  const identityMissing = REQUIRED_IDENTITY_FIELDS.filter(([key]) => !String(state.identity[key] || '').trim());
  if (identityMissing.length) {
    issues.push(issue('BLOCKER', '真实站点信息不完整', `缺少：${identityMissing.map(([, label]) => label).join('、')}。`, 0));
  } else {
    issues.push(issue('PASS', '站点身份字段已填写', `已提供 ${REQUIRED_IDENTITY_FIELDS.length} 项递审必填身份字段。`, 0));
  }
  if (!normalizeBaseUrl(state.identity.baseUrl)) issues.push(issue('BLOCKER', '正式域名无效', 'base_url 必须是完整的 HTTPS URL。', 0));
  if (state.identity.contactEmail && !EMAIL_PATTERN.test(state.identity.contactEmail)) issues.push(issue('BLOCKER', '联系邮箱格式无效', '请填写真实可收信的邮箱地址。', 0));
  if (!state.policy.privacyEffectiveDate || !formatDate(state.policy.privacyEffectiveDate)) {
    issues.push(issue('BLOCKER', '隐私政策日期缺失', '必须填写真实的隐私政策生效/更新日期。', 5));
  }
  const publisherId = String(state.policy.publisherId || '').trim();
  if (publisherId && !/^ca-pub-\d{16}$/.test(publisherId)) {
    issues.push(issue('BLOCKER', 'AdSense Publisher ID 格式无效', '应为 ca-pub- 加 16 位数字；不得使用示例或全零 ID。', 5));
  }
  if (state.policy.adsEnabled && !publisherId) issues.push(issue('BLOCKER', '广告版缺少 Publisher ID', '启用广告前必须提供真实 Publisher ID。', 5));
  if (state.policy.adsEnabled && state.policy.adMode === 'manual' && !/^\d+$/.test(String(state.policy.adSlot || ''))) {
    issues.push(issue('BLOCKER', '手动广告位缺少真实 slot', '手动广告模式必须填写纯数字广告位 ID。', 5));
  }
  const regions = String(state.identity.targetRegions || '').toLowerCase();
  const targetsConsentRegions = /eea|europe|eu\b|uk|united kingdom|switzerland|欧洲|欧盟|英国|瑞士/.test(regions);
  if (state.policy.adsEnabled && state.policy.personalizedAds && targetsConsentRegions && !state.confirmations.cmp) {
    issues.push(issue('NEEDS MANUAL VERIFICATION', '需确认 Google 认证 CMP', '面向 EEA、英国或瑞士提供个性化广告时，请人工确认已部署符合当前要求的认证 CMP。', 5));
  }

  const articles = state.articles || [];
  const results = articles.map((article, index) => {
    const content = String(article.content || '');
    const title = String(article.title || '').trim();
    const sources = normalizedSources(article.sources);
    const localImage = article._image;
    const imageValue = String(article.image || '').trim();
    const wordCount = countEnglishWords(content);
    const blockers = [];
    const manual = [];
    const warnings = [];
    if (!title) blockers.push('缺少标题');
    if (!content.trim()) blockers.push('缺少正文');
    if (wordCount <= 800) blockers.push(`正文仅 ${wordCount} 个英文单词（需至少 801）`);
    if (!String(article.category || '').trim()) blockers.push('缺少分类');
    const author = String(article.author || state.identity.defaultAuthor || '').trim();
    if (!author) blockers.push('缺少真实作者或已确认默认作者');
    if (!formatDate(article.published_at)) blockers.push('缺少或无效的真实发布日期');
    if (!String(article.fact_checked_by || '').trim()) blockers.push('缺少真实事实核验者');
    if (!formatDate(article.fact_checked_at)) blockers.push('缺少或无效的事实核验日期');
    if (!String(article.cover_image_source || '').trim()) blockers.push('缺少封面图权属说明');
    if (!imageValue) blockers.push('缺少封面图');
    if (imageValue && !localImage) {
      if (isSafeExternalUrl(imageValue)) manual.push('在线封面未本地化且无法完成内容级验证');
      else blockers.push('封面图未在 ZIP 中找到或 URL 不安全');
    }
    if (localImage && (!localImage.width || !localImage.height)) blockers.push('封面图无法解码或读取尺寸');
    if (localImage && !state.confirmations.imageRights) manual.push('尚未确认封面图片使用权');
    if (!sources.length) blockers.push('缺少事实来源或原始证据');
    if (sources.some((url) => !isSafeExternalUrl(url))) blockers.push('来源包含无效或非 HTTPS URL');
    if (sources.length && !state.confirmations.sourceLinks) manual.push('来源的可访问性与相关性尚未人工确认');
    if (PLACEHOLDER_PATTERN.test(`${title} ${content} ${imageValue}`)) blockers.push('包含占位内容或示例域名');
    if (/<script\b|javascript:|on\w+\s*=/i.test(content)) warnings.push('原始正文含危险 HTML，导出时会被安全转义');
    const visibleText = visibleArticleText(content);
    const visibleWords = visibleText.split(' ').filter(Boolean);
    const vocabularyRatio = new Set(visibleWords).size / Math.max(1, visibleWords.length);
    if (wordCount > 800 && vocabularyRatio < 0.12) blockers.push(`正文词汇重复度异常（唯一词比例 ${(vocabularyRatio * 100).toFixed(1)}%），疑似凑字数或关键词堆砌`);
    const titleTerms = visibleArticleText(title).split(' ').filter((term) => term.length > 3);
    if (titleTerms.length && !titleTerms.some((term) => visibleText.includes(term))) warnings.push('标题与正文的词汇关联较弱，需人工复核主题一致性');
    return {
      index, article, title: title || `第 ${index + 1} 条`, author, sources, wordCount,
      excerpt: String(article.excerpt || '').trim() || makeExcerpt(content),
      fingerprint: textFingerprint(content), shingles: shingleSet(content), blockers, manual, warnings,
      imageHash: localImage?.hash || '', imageFingerprint: localImage?.fingerprint || '',
      imageIdentity: localImage?.hash || normalizeOnlineImage(imageValue), valid: false
    };
  });

  const titleOwners = new Map();
  const bodyOwners = new Map();
  const imageOwners = new Map();
  for (const result of results) {
    const normalizedTitle = visibleArticleText(result.title);
    markDuplicate(titleOwners, normalizedTitle, result, '标题重复');
    markDuplicate(bodyOwners, result.fingerprint, result, '正文完全重复（忽略空白、标点和格式后）');
    markDuplicate(imageOwners, result.imageIdentity, result, '封面图片重复或为改名副本');
  }

  for (let left = 0; left < results.length; left += 1) {
    for (let right = left + 1; right < results.length; right += 1) {
      const a = results[left];
      const b = results[right];
      if (a.fingerprint !== b.fingerprint && a.wordCount > 100 && b.wordCount > 100) {
        const similarity = jaccard(a.shingles, b.shingles);
        if (similarity >= 0.72) {
          const detail = `与“${b.title}”正文五词片段相似度 ${(similarity * 100).toFixed(1)}%`;
          const reverse = `与“${a.title}”正文五词片段相似度 ${(similarity * 100).toFixed(1)}%`;
          a.blockers.push(detail);
          b.blockers.push(reverse);
        }
      }
      if (a.imageHash && b.imageHash && a.imageHash !== b.imageHash && hamming(a.imageFingerprint, b.imageFingerprint) <= 5) {
        const label = `与“${b.title}”封面视觉高度近似`;
        const reverse = `与“${a.title}”封面视觉高度近似`;
        if (!state.confirmations.visualImages) { a.manual.push(label); b.manual.push(reverse); }
      }
    }
    if (left % 8 === 0) {
      onProgress(Math.round(((left + 1) / Math.max(1, results.length)) * 100), `正在比对第 ${left + 1}/${results.length} 篇`);
      await yieldToBrowser();
    }
  }

  for (const result of results) {
    result.valid = !result.blockers.length && !result.manual.length && !result.warnings.length;
    const extra = { targetStep: 3, articleIndex: result.index };
    result.blockers.forEach((detail) => issues.push(issue('BLOCKER', `${result.title}：未通过`, detail, 3, extra)));
    result.manual.forEach((detail) => issues.push(issue('NEEDS MANUAL VERIFICATION', `${result.title}：需人工确认`, detail, 3, extra)));
    result.warnings.forEach((detail) => issues.push(issue('WARNING', `${result.title}：内容风险`, detail, 3, extra)));
  }
  const validCount = results.filter((result) => result.valid).length;
  if (validCount < 35) issues.push(issue('BLOCKER', '有效资讯文章不足 35 篇', `当前 ${validCount}/35，还需 ${35 - validCount} 篇通过全部检查的独立文章。`, 3));
  else issues.push(issue('PASS', '有效文章数量达标', `${validCount} 篇文章通过自动规则与已完成的人工确认。`, 3));
  if (!state.confirmations.externalLinks && results.some((result) => result.sources.length)) {
    issues.push(issue('NEEDS MANUAL VERIFICATION', '外部链接尚未逐项确认', '浏览器受跨域限制，需逐项打开并确认来源链接与页面相关且可访问。', 3));
  }
  const cleanHtmlCount = results.filter((result) => /<script\b|javascript:|on\w+\s*=/i.test(String(result.article.content || ''))).length;
  if (!cleanHtmlCount) issues.push(issue('PASS', '未发现危险 HTML 模式', `检查了 ${results.length} 篇正文；导出仍会统一转义并按安全 Markdown 渲染。`, 3));
  return finalizeAudit(issues, results, identityMissing.length > 0);
}

function markDuplicate(map, key, result, label) {
  if (!key) return;
  if (map.has(key)) {
    const owner = map.get(key);
    owner.blockers.push(`${label}：与“${result.title}”冲突`);
    result.blockers.push(`${label}：与“${owner.title}”冲突`);
  } else map.set(key, result);
}

function normalizeOnlineImage(value) {
  try {
    const url = new URL(String(value));
    url.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach((key) => url.searchParams.delete(key));
    return url.href.toLowerCase();
  } catch {
    return String(value).trim().toLowerCase();
  }
}

export function finalizeAudit(issues, articleResults, missingIdentity = false) {
  const counts = Object.fromEntries(['BLOCKER', 'HIGH', 'WARNING', 'NEEDS MANUAL VERIFICATION', 'PASS'].map((severity) => [severity, issues.filter((item) => item.severity === severity).length]));
  const blocking = counts.BLOCKER + counts.HIGH + counts.WARNING + counts['NEEDS MANUAL VERIFICATION'];
  return {
    generatedAt: new Date().toISOString(), issues, articleResults, counts,
    validCount: articleResults.filter((result) => result.valid).length,
    status: missingIdentity ? 'NOT ASSESSABLE' : blocking ? 'NEEDS WORK' : 'READY FOR MANUAL REVIEW',
    canExportReview: !blocking && articleResults.filter((result) => result.valid).length >= 35
  };
}

export function mergeAuditIssues(audit, additions = []) {
  const issues = [...audit.issues, ...additions];
  return finalizeAudit(issues, audit.articleResults, audit.status === 'NOT ASSESSABLE');
}
