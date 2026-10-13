/** 05 PixelWire — distinctive section headings and lead-card composition. */
import {leadCardSelector} from "../../template-system/reference-presentation.js";
export {heading} from "../../template-system/reference-presentation.js";
export const rules=[];
export const css = `
:scope .ref-section-heading {
  border-bottom: 2px solid var(--color-primary);
}
:scope .ref-section-heading .category-title {
  font-size: clamp(28px, 3vw, 44px);
}
:scope .ref-section-index {
  font-family: monospace;
  letter-spacing: .16em;
}
${leadCardSelector()} {
  grid-column: 1/-1;
}
${leadCardSelector(' .card-image')} {
  height: 350px;
}
${leadCardSelector(' .card-title')} {
  font-size: clamp(28px, 3vw, 42px);
}
:scope .card-body {
  border-top: 2px solid var(--color-border);
}
`;
