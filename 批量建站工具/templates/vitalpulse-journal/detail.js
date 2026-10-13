/** 09 VitalPulse — reading composition, only rearrange the image/title pair. */
export {detailLead as render} from "../../template-system/reference-presentation.js";
export const rules=[];
export const css = `
:scope .detail-title {
  text-align: center;
  max-width: 24ch;
  margin-left: auto;
  margin-right: auto;
  font-weight: 500;
}
:scope .detail-content > p {
  font-family: Georgia, serif;
  font-size: 19px;
}
:scope .detail-content > h2 {
  font-weight: 500;
  color: var(--color-primary);
}
`;
