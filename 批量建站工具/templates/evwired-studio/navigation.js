/** 07 EVWired — brand lockup and responsive navigation skin. */
export {navigation as render} from "../../template-system/reference-presentation.js";
export const css = `
:scope .navbar .nav-links {
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-bg-secondary);
}
:scope .navbar .nav-links a {
  border-radius: 999px;
  font-weight: 450;
  font-size: 13px;
}
:scope .navbar .nav-links a[aria-current=page] {
  border: 1px solid var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
}
:scope .ref-brand small {
  display: none;
}
:scope .navbar .logo {
  font-size: 24px;
  font-weight: 500;
}
`;
