export const CONFIG_VERSION = 1;

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function escapeXml(value = '') {
  return escapeHtml(value);
}

export function safeJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e');
}

export function normalizeBaseUrl(value = '') {
  try {
    const url = new URL(String(value).trim());
    if (url.protocol !== 'https:') return '';
    url.hash = '';
    url.search = '';
    return url.href.endsWith('/') ? url.href : `${url.href}/`;
  } catch {
    return '';
  }
}

export function isSafeExternalUrl(value = '') {
  try {
    const url = new URL(String(value).trim());
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isSafeContactUrl(value = '') {
  try {
    const url = new URL(String(value).trim());
    return ['https:', 'mailto:', 'tel:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function slugify(value = '', fallback = 'item') {
  const source = String(value).normalize('NFKD').toLowerCase();
  const slug = source
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 72)
    .replace(/-+$/g, '');
  return slug || fallback;
}

export function uniqueSlugs(items, key = 'slug', titleKey = 'title') {
  const used = new Set();
  return items.map((item, index) => {
    const base = slugify(item[key] || item[titleKey], `article-${index + 1}`);
    let next = base;
    let suffix = 2;
    while (used.has(next)) next = `${base}-${suffix++}`;
    used.add(next);
    return { ...item, slug: next };
  });
}

export function normalizeText(value = '') {
  return String(value)
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[`*_>#~\[\](){}|]/g, ' ')
    .replace(/[^a-z0-9'\-\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function visibleArticleText(value = '') {
  return normalizeText(
    String(value)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/^#{1,6}\s+.*$/gm, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  );
}

export function countEnglishWords(value = '') {
  const text = visibleArticleText(value);
  return text.match(/[a-z]+(?:['’-][a-z]+)*/gi)?.length || 0;
}

export function fnv1a(value = '') {
  let hash = 0x811c9dc5;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export async function sha256(data) {
  const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function textFingerprint(value = '') {
  return fnv1a(visibleArticleText(value).replace(/[\s\p{P}]/gu, ''));
}

export function shingleSet(value = '', size = 5) {
  const words = visibleArticleText(value).split(' ').filter(Boolean);
  const shingles = new Set();
  for (let index = 0; index <= words.length - size; index += 1) {
    shingles.add(words.slice(index, index + size).join(' '));
  }
  return shingles;
}

export function jaccard(left, right) {
  if (!left.size && !right.size) return 1;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

export function formatDate(value = '') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return '';
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? '' : String(value);
}

export function toStringList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value || '').split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

export function makeExcerpt(value = '', max = 165) {
  const text = visibleArticleText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

export function safeMarkdown(markdown = '') {
  const escaped = escapeHtml(String(markdown).replace(/\r\n/g, '\n'));
  const blocks = escaped.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  let lastHeading = 1;
  return blocks.map((block) => {
    const heading = block.match(/^(#{1,6})\s+([\s\S]+)$/);
    if (heading) {
      const requested = Math.max(2, heading[1].length);
      const level = Math.min(requested, lastHeading + 1, 3);
      lastHeading = level;
      return `<h${level}>${inlineMarkdown(heading[2])}</h${level}>`;
    }
    const lines = block.split('\n');
    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      return `<ul>${lines.map((line) => `<li>${inlineMarkdown(line.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
    }
    if (lines.every((line) => /^\d+\.\s+/.test(line))) {
      return `<ol>${lines.map((line) => `<li>${inlineMarkdown(line.replace(/^\d+\.\s+/, ''))}</li>`).join('')}</ol>`;
    }
    return `<p>${inlineMarkdown(lines.join(' '))}</p>`;
  }).join('\n');
}

function inlineMarkdown(value) {
  return value
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function debounce(fn, wait = 180) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function yieldToBrowser() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
