/** 13 The Print Field — distinctive section headings and lead-card composition. */
import {leadCardSelector} from "../../template-system/reference-presentation.js";
export {heading} from "../../template-system/reference-presentation.js";
export const rules=[];
export const css = `
:scope .ref-section-heading {
  border-top: 1px solid var(--color-primary);
  border-bottom: 0;
  padding-top: 20px;
}
:scope .ref-section-index {
  background: var(--color-bg-secondary);
  padding: 8px 10px;
  border: 1px solid var(--color-primary);
  border-radius: 3px;
  box-shadow: 2px 2px 0 var(--color-primary);
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
${leadCardSelector(' .card-title')} {
  font-size: clamp(30px, 3.3vw, 44px);
}
${leadCardSelector(' .card-image')} {
  height: 340px;
}
:scope .card-body {
  padding: 24px;
}
`;
