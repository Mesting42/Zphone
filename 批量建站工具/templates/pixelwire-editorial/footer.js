/** 05 PixelWire — masthead/footer; preserve original legal/contact links. */
export {footer as render} from "../../template-system/reference-presentation.js";
export const css = `
:scope .footer {
  border-top: 2px solid var(--color-primary);
}
:scope .ref-footer-masthead {
  font-family: monospace;
  color: var(--color-primary);
  font-size: 40px;
}
`;
