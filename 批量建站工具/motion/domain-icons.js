/** Single artwork adapter used by the workbench and generated-site runtime.
 * The catalog's emoji/Logo/category choices are independent. */
import artwork from './domain-icons.json';
import provenance from './icons-provenance.json';

const records = new Map(provenance.icons.map(icon => [icon.id, icon]));
const cache = new Map();
const licenseURLs = {
  'IconPark': 'https://www.apache.org/licenses/LICENSE-2.0',
  'Noto Emoji': 'https://www.apache.org/licenses/LICENSE-2.0',
  'OpenMoji': 'https://creativecommons.org/licenses/by-sa/4.0/',
  'Twemoji': 'https://creativecommons.org/licenses/by/4.0/',
  'DiceBear Adventurer': 'https://creativecommons.org/licenses/by/4.0/'
};
const authors = {
  'IconPark': 'ByteDance', 'Noto Emoji': 'Google',
  'OpenMoji': 'HfG Schwäbisch Gmünd', 'Twemoji': 'Twitter and contributors',
  'DiceBear Adventurer': 'Lisa Wischofsky'
};
const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

/** Cache one isolated SVG URL per domain; repeated cards reuse its decode.
 * Unknown domains from older saved projects receive general-news artwork. */
function get(domain) {
  const id = records.has(domain) ? domain : 'general';
  if (!cache.has(id)) {
    const svg = artwork[id];
    // Adobe exports may declare namespace entities in a legacy external DTD.
    // Resolve those literal namespace declarations and omit the XML prolog in
    // image URLs, so the browser never needs a DTD. Preserve raw SVG for ZIPs.
    const namespaces = Object.fromEntries([...svg.matchAll(/<!ENTITY\s+(ns_\w+)\s+"([^"]+)">/g)].map(match => [match[1],match[2]]));
    const imageSVG = svg.slice(svg.indexOf('<svg')).replace(/&(ns_\w+);/g, (entity,key) => namespaces[key] || entity);
    cache.set(id, Object.freeze({id, svg, src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(imageSVG), record: records.get(id)}));
  }
  return cache.get(id);
}
function imageHTML(domain) {
  const icon = get(domain);
  return '<img data-domain-icon="' + icon.id + '" src="' + escape(icon.src) + '" width="32" height="32" alt="" aria-hidden="true" decoding="async">';
}
/** Attribution stays with the surface using the artwork. Full license texts and
 * the exact original SVG are also written into each exported ZIP. */
function attributionHTML(domain) {
  const icon = get(domain).record;
  const label = typeof icon.license === 'string' ? icon.license.replace(/ \(.+\)$/, '') : icon.license.name;
  return '<span data-domain-icon-credits>Icon: <a href="' + escape(icon.source) + '" target="_blank" rel="noopener noreferrer">' + escape(icon.library) + '</a> by ' + escape(authors[icon.library]) +
    ' · <a href="' + licenseURLs[icon.library] + '" target="_blank" rel="noopener noreferrer">' + escape(label) + '</a></span>';
}
function workbenchCreditsHTML() {
  const representatives = [...new Set(provenance.icons.map(icon => icon.library))].map(library => provenance.icons.find(icon => icon.library === library));
  return '领域图标来源：' + representatives.map(icon => attributionHTML(icon.id)).join('；');
}
export const DomainIcons = Object.freeze({get, imageHTML, attributionHTML, workbenchCreditsHTML});
