/** 07 EVWired — distinctive section headings and lead-card composition. */
import {leadCardSelector} from "../../template-system/reference-presentation.js";
export {heading} from "../../template-system/reference-presentation.js";
export const rules=[];
export const css = `
:scope .ref-section-heading .category-title {
  font-weight: 500;
}
:scope .ref-section-index {
  color: var(--color-primary);
  font-family: monospace;
}
:scope .item-card {
  border-radius: var(--card-radius);
}
${leadCardSelector()} {
  grid-column: 1/-1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
}
${leadCardSelector(' .card-image')} {
  height: 360px;
}
${leadCardSelector(' .card-title')} {
  font-size: clamp(30px, 3.6vw, 48px);
  font-weight: 500;
}
:scope .card-title {
  font-weight: 500;
}
`;
