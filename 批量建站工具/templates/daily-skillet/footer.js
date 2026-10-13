/** 08 The Daily Skillet — masthead/footer; preserve original legal/contact links. */
export {footer as render} from "../../template-system/reference-presentation.js";
export const css = `
:scope .ref-footer-masthead {
  font-size: clamp(44px, 6vw, 88px);
  font-weight: 500;
}
:scope .footer {
  background: transparent;
}
`;
