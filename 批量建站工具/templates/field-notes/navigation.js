/** 04 Field Notes — brand lockup and responsive navigation skin. */
export {navigation as render} from "../../template-system/reference-presentation.js";
export const css = `
:scope .navbar .nav-links a {
  font-family: Georgia, serif;
  font-weight: 400;
  font-size: 12px;
  padding: 10px 9px;
}
:scope .navbar .logo {
  font-size: 30px;
}
:scope .navbar .nav-links {
  gap: 2px;
}
:scope .navbar {
  background: color-mix(in srgb, var(--color-bg) 94%, transparent);
}
`;
