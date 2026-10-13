/** 07 EVWired — masthead/footer; preserve original legal/contact links. */
export {footer as render} from "../../template-system/reference-presentation.js";
export const css = `
:scope .footer {
  background: var(--color-bg);
}
:scope .ref-footer-masthead {
  font-family: monospace;
  font-size: 38px;
  color: var(--color-primary);
}
`;
