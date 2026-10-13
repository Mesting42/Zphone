/** 13 The Print Field — brand lockup and responsive navigation skin. */
export {navigation as render} from "../../template-system/reference-presentation.js";
export const css = `
:scope .navbar {
  height: 82px;
  border-top: 2px solid var(--color-primary);
  border-bottom: 1px solid var(--color-primary);
}
:scope .navbar .nav-links a {
  font-size: 10px;
  letter-spacing: .09em;
  text-transform: uppercase;
}
:scope .navbar .nav-links li:last-child a {
  border: 1px solid var(--color-primary);
  background: var(--color-surface);
  box-shadow: 3px 3px 0 var(--color-primary);
  border-radius: 2px;
  margin-left: 12px;
}
:scope .navbar .logo {
  font-size: 21px;
}
:scope .ref-brand small {
  font-size: 8px;
  letter-spacing: .12em;
  text-transform: uppercase;
}
`;
