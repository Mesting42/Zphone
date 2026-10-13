/** 12 The Deep Life Atlas — distinctive section headings and lead-card composition. */
import {leadCardSelector} from "../../template-system/reference-presentation.js";
export {heading} from "../../template-system/reference-presentation.js";
export const rules=[];
export const css = `
:scope .ref-section-heading {
  border: 0;
}
:scope .ref-section-index {
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--color-bg-secondary);
}
:scope .item-card {
  border-radius: var(--card-radius);
}
${leadCardSelector()} {
  grid-column: 1/-1;
  display: grid;
  grid-template-columns: 1fr 1.1fr;
  align-items: center;
  background: var(--color-bg-secondary);
}
${leadCardSelector(' .card-image-frame')} {
  order: 2;
}
${leadCardSelector(' .card-image')} {
  height: 370px;
}
${leadCardSelector(' .card-title')} {
  font-size: clamp(32px, 3.8vw, 52px);
}
${leadCardSelector(' .card-body')} {
  padding: 32px;
}
`;
