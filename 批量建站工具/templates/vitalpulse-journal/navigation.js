/** 09 VitalPulse — brand lockup and responsive navigation skin. */
export {navigation as render} from "../../template-system/reference-presentation.js";
export const css = `
:scope .navbar .nav-links {
  margin-inline: 0;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 5px;
  background: var(--color-bg-secondary);
}
:scope .navbar .nav-links a {
  font-family: Georgia, serif;
  font-size: 14px;
  border-radius: 999px;
}
:scope .navbar .nav-links a[aria-current=page] {
  background: var(--color-surface);
  color: var(--color-primary);
  border: 1px solid var(--color-border);
}
:scope .ref-brand small {
  display: none;
}
:scope .navbar .logo {
  font-size: 27px;
}
`;
