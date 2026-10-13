/** Style text/media leaves only: the article wrapper can contain paragraph ads. */
export const rules = [
  { selector: '.detail-title', declarations: { 'font-family': 'Georgia, serif', 'font-weight': '400', 'font-size': 'clamp(30px,4vw,52px)', 'line-height': '1.12', 'max-width': '24ch' } },
  { selector: '.detail-meta', declarations: { 'border-radius': '0', 'border-bottom': '1px solid var(--color-border)', background: 'transparent' } },
  { selector: '.detail-content > p', declarations: { 'font-size': '18px', 'line-height': '1.85', 'max-width': '72ch', margin: '0 auto 24px' } },
  { selector: '.detail-content > h2', declarations: { 'font-family': 'Georgia, serif', 'font-weight': '400', 'line-height': '1.25' } },
  { selector: '.detail-content > p', maxWidth: 720, declarations: { 'font-size': '17px', 'line-height': '1.75' } },
  { selector: '.related-title', declarations: { 'font-family': 'Georgia, serif', 'font-weight': '400', 'border-top': '2px solid currentColor', padding: '20px 0 0' } }
];
