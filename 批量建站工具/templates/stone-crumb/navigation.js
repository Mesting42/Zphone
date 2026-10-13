/** 06 Stone & Crumb — brand lockup and responsive navigation skin. */
export {navigation as render} from "../../template-system/reference-presentation.js";
export const css = `
:scope .navbar {
  background: var(--color-surface);
  border-radius: 0 0 24px 24px;
  border-bottom: 0;
}
:scope .navbar .nav-links {
  padding: 5px;
  border: 1px solid var(--color-border);
  border-radius: 22px;
  background: var(--color-bg-secondary);
}
:scope .navbar .nav-links a {
  border-radius: 14px;
}
:scope .navbar .nav-links a[aria-current=page] {
  background: var(--color-primary);
  color: var(--color-bg);
}
:scope .navbar .logo {
  font-weight: 750;
}
`;
