/** 08 The Daily Skillet — whole-site typography and reflow. All colors follow the active theme. */
import {shellCSS} from "../../template-system/reference-presentation.js";
export const css = shellCSS + `
:scope {
  --ref-body:Georgia,"Times New Roman",serif;
  --ref-display:Georgia,"Times New Roman",serif;
  --ref-title-weight:500;
  --navbar-height:78px;
}
:scope {
  background:
    radial-gradient(
      ellipse at 0% 5%,
      color-mix(in srgb, var(--color-primary) 9%, transparent),
      transparent 35%),
    radial-gradient(
      ellipse at 100% 25%,
      color-mix(in srgb, var(--color-primary) 7%, transparent),
      transparent 45%),
    var(--color-bg);
}
`;
