/** 09 VitalPulse — whole-site typography and reflow. All colors follow the active theme. */
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
      ellipse at 4% 4%,
      color-mix(in srgb, var(--color-primary) 11%, transparent),
      transparent 40%),
    radial-gradient(
      ellipse at 100% 30%,
      color-mix(in srgb, var(--color-primary) 5%, transparent),
      transparent 50%),
    var(--color-bg);
}
`;
