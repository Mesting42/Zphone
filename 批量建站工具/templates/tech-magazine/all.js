/** List cards remain children of the original grid; middle ads still span a row. */
export const rules = [
  { selector: '#all-articles > .category-title', declarations: { 'font-family': 'Georgia, serif', 'font-size': 'clamp(30px,4vw,48px)', 'font-weight': '400', 'border-top': '2px solid currentColor', padding: '20px 0' } },
  { selector: '#all-articles .item-card', declarations: { 'border-radius': '0', 'box-shadow': 'none', border: '1px solid var(--color-border)', background: 'transparent' } },
  { selector: '#all-articles .card-title', declarations: { 'font-family': 'Georgia, serif', 'font-size': '23px', 'line-height': '1.25' } },
  { selector: '#all-articles .card-body', declarations: { padding: '18px' } },
  { selector: '#all-articles .card-title', maxWidth: 720, declarations: { 'font-size': '20px' } }
];
