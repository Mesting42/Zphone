/** 04 Field Notes — distinctive section headings and lead-card composition. */
import {leadCardSelector} from "../../template-system/reference-presentation.js";
export {heading} from "../../template-system/reference-presentation.js";
export const rules=[];
export const css = `
:scope .ref-section-heading {
  border-top: 1px solid var(--color-border);
  border-bottom: 0;
  padding-top: 20px;
}
:scope .ref-section-index {
  border: 1px solid var(--color-border);
  padding: 8px;
  border-radius: 50%;
}
:scope .item-card {
  border-radius: var(--card-radius);
  padding: 18px;
}
:scope .card-body {
  padding: 20px 4px 6px;
}
${leadCardSelector()} {
  grid-column: 1/-1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
}
${leadCardSelector(' .card-image-frame')} {
  order: 2;
}
${leadCardSelector(' .card-image')} {
  height: 330px;
}
${leadCardSelector(' .card-title')} {
  font-size: clamp(30px, 3.2vw, 46px);
}
`;
