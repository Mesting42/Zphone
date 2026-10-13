/** 13 The Print Field — whole-site typography and reflow. All colors follow the active theme. */
import {shellCSS} from "../../template-system/reference-presentation.js";
export const css = shellCSS + `
:scope {
  --ref-body:system-ui,sans-serif;
  --ref-display:system-ui,sans-serif;
  --ref-title-weight:700;
  --navbar-height:78px;
}
:scope {
  background:
    radial-gradient(
      ellipse at 90% 4%,
      color-mix(in srgb, var(--color-primary) 6%, transparent),
      transparent 30%),
    var(--color-bg);
}
`;
