/** 04 Field Notes — whole-site typography and reflow. All colors follow the active theme. */
import {shellCSS} from "../../template-system/reference-presentation.js";
export const css = shellCSS + `
:scope {
  --ref-body:Georgia,"Times New Roman",serif;
  --ref-display:Georgia,"Times New Roman",serif;
  --ref-title-weight:400;
  --navbar-height:78px;
}
:scope {
  background:
    radial-gradient(
      ellipse at 70% 12%,
      color-mix(in srgb, var(--color-primary) 5%, transparent),
      transparent 55%),
    var(--color-bg);
}
`;
