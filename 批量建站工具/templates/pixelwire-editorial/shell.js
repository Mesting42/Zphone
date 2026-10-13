/** 05 PixelWire — whole-site typography and reflow. All colors follow the active theme. */
import {shellCSS} from "../../template-system/reference-presentation.js";
export const css = shellCSS + `
:scope {
  --ref-body:system-ui,sans-serif;
  --ref-display:system-ui,sans-serif;
  --ref-title-weight:750;
  --navbar-height:78px;
}
:scope {
  background:
    radial-gradient(
      ellipse at 8% 5%,
      color-mix(in srgb, var(--color-primary) 12%, transparent),
      transparent 35%),
    var(--color-bg);
}
`;
