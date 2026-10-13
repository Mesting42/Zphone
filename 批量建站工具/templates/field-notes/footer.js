/** 04 Field Notes — masthead/footer; preserve original legal/contact links. */
export {footer as render} from "../../template-system/reference-presentation.js";
export const css = `
:scope .ref-footer-masthead {
  font-size: clamp(44px, 6vw, 86px);
  font-weight: 400;
}
:scope .footer {
  background: transparent;
}
:scope .footer-section h3 {
  font-weight: 400;
}
`;
