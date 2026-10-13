/** 05 PixelWire — brand lockup and responsive navigation skin. */
export {navigation as render} from "../../template-system/reference-presentation.js";
export const css = `
:scope .navbar .nav-links {
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 4px;
}
:scope .navbar .nav-links a {
  border-radius: 999px;
}
:scope .navbar .logo {
  letter-spacing: -.07em;
  font-size: 26px;
}
:scope .ref-brand strong::after {
  content: "◆";
  font-size: 11px;
  color: var(--color-primary);
}
:scope .ref-brand small {
  display: none;
}
`;
