/** 12 The Deep Life Atlas — masthead/footer; preserve original legal/contact links. */
export {footer as render} from "../../template-system/reference-presentation.js";
export const css = `
:scope .footer {
  background: var(--color-bg-secondary);
  border-radius: 28px 28px 0 0;
}
:scope .ref-footer-masthead {
  font-size: clamp(36px, 5vw, 64px);
}
`;
