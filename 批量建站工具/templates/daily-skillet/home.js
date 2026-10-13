/** 08 The Daily Skillet — distinctive section headings and lead-card composition. */
import {leadCardSelector} from "../../template-system/reference-presentation.js";
export {heading} from "../../template-system/reference-presentation.js";
export const rules=[];
export const css = `
:scope .ref-section-heading {
  border-bottom: 1px solid var(--color-primary);
}
:scope .item-card {
  border-radius: var(--card-radius);
}
${leadCardSelector()} {
  grid-column: 1/-1;
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  align-items: center;
}
${leadCardSelector(' .card-image')} {
  height: 350px;
}
${leadCardSelector(' .card-title')} {
  font-size: clamp(30px, 3.1vw, 43px);
}
:scope .ref-section-index {
  font-family: Georgia, serif;
  font-style: italic;
  font-size: 16px;
}
`;
