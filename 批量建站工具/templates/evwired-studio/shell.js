/** 07 EVWired — whole-site typography and reflow. All colors follow the active theme. */
import {shellCSS} from "../../template-system/reference-presentation.js";
export const css = shellCSS + `
:scope {
  --ref-body:"Segoe UI",Arial,sans-serif;
  --ref-display:"Segoe UI",Arial,sans-serif;
  --ref-title-weight:550;
  --navbar-height:78px;
}
:scope {
  background:
    radial-gradient(
      ellipse at 100% 10%,
      color-mix(in srgb, var(--color-primary) 7%, transparent),
      transparent 30%),
    var(--color-bg);
}
`;
