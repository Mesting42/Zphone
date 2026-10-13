/** Home-only content treatments. The inherited layout owns card rows and ad gaps. */
export const rules = [
  { selector: '.tpl-section-heading', declarations: { 'border-top': '2px solid currentColor', 'border-bottom': '1px solid var(--color-border)', padding: '18px 0', background: 'transparent' } },
  { selector: '.tpl-section-number', declarations: { 'font-family': 'Georgia, serif', 'font-size': '38px', 'font-weight': '400' } },
  { selector: '.tpl-section-kicker', declarations: { 'letter-spacing': '.12em', 'font-size': '10px' } },
  { selector: '.tpl-sections .item-card', declarations: { background: 'transparent', 'border-radius': '0', 'box-shadow': 'none', border: '1px solid var(--color-border)' } },
  { selector: '.tpl-sections .card-title', declarations: { 'font-family': 'Georgia, serif', 'font-size': '25px', 'line-height': '1.22' } },
  { selector: '.tpl-sections .card-body', declarations: { padding: '20px' } },
  { selector: '.tpl-sections .card-image-frame', declarations: { 'border-radius': '0' } },
  { selector: '.tpl-sections .card-title', maxWidth: 720, declarations: { 'font-size': '21px' } },
  { selector: '.tpl-section-number', maxWidth: 720, declarations: { 'font-size': '28px' } }
];
