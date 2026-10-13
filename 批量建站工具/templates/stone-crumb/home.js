/** 06 Stone & Crumb — distinctive section headings and lead-card composition. */
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
  grid-template-columns: 1.15fr 1fr;
  align-items: center;
}
${leadCardSelector(' .card-image')} {
  height: 380px;
}
${leadCardSelector(' .card-title')} {
  font-size: clamp(32px, 3.4vw, 46px);
}
:scope .card-body {
  padding: 28px;
}
`;
