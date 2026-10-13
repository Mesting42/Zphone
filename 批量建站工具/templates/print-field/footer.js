/** 13 The Print Field — masthead/footer; preserve original legal/contact links. */
export {footer as render} from "../../template-system/reference-presentation.js";
export const css = `
:scope .footer {
  border-top: 2px solid var(--color-primary);
  background: var(--color-bg);
}
:scope .ref-footer-masthead {
  letter-spacing: -.055em;
  font-size: clamp(40px, 6vw, 80px);
}
`;
