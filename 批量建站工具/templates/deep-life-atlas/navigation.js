/** 12 The Deep Life Atlas — brand lockup and responsive navigation skin. */
export {navigation as render} from "../../template-system/reference-presentation.js";
export const css = `
:scope .navbar {
  top: 12px;
  width: calc(100% - 48px);
  margin: 12px auto;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  box-shadow: 0 10px 30px color-mix(in srgb, var(--color-primary) 12%, transparent);
  background: color-mix(in srgb, var(--color-bg) 90%, transparent);
}
:scope .navbar .nav-links a {
  border-radius: 999px;
}
:scope .navbar .nav-links a[aria-current=page] {
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
}
:scope .navbar .nav-links li:last-child a {
  border: 1px solid var(--color-border);
  border-radius: 999px;
}
:scope .navbar .logo {
  font-size: 22px;
}
:scope .navbar.nav-collapsed .nav-links {
  border-radius: 20px;
}
`;
