/** 09 VitalPulse — distinctive section headings and lead-card composition. */
import {leadCardSelector} from "../../template-system/reference-presentation.js";
export {heading} from "../../template-system/reference-presentation.js";
export const rules=[];
export const css = `
:scope .ref-section-heading {
  justify-content: center;
  border: 0;
  text-align: center;
  position: relative;
}
:scope .ref-section-heading .category-title {
  font-weight: 500;
  font-size: clamp(32px, 4vw, 52px);
}
:scope .ref-section-index {
  font-family: Georgia, serif;
  font-size: 15px;
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
${leadCardSelector(' .card-body')} {
  order: -1;
}
${leadCardSelector(' .card-image')} {
  height: 330px;
}
${leadCardSelector(' .card-title')} {
  font-size: clamp(30px, 3.6vw, 48px);
  font-weight: 500;
}
`;
