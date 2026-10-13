/** 08 The Daily Skillet — brand lockup and responsive navigation skin. */
export {navigation as render} from "../../template-system/reference-presentation.js";
export const css = `
:scope .navbar {
  top: 12px;
  width: calc(100% - 48px);
  margin: 12px auto;
  border: 1px solid var(--color-border);
  border-radius: 28px;
  box-shadow: 0 10px 35px color-mix(in srgb, var(--color-text) 8%, transparent);
}
:scope .navbar .nav-links {
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 5px;
  background: var(--color-bg-secondary);
}
:scope .navbar .nav-links a {
  border-radius: 999px;
}
:scope .navbar .nav-links a[aria-current=page] {
  background: var(--color-text);
  color: var(--color-bg);
}
:scope .navbar.nav-collapsed .nav-links {
  border-radius: 20px;
}
`;
