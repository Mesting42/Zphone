/** 08 The Daily Skillet — reading composition, only rearrange the image/title pair. */
export {detailLead as render} from "../../template-system/reference-presentation.js";
export const rules=[];
export const css = `
:scope .detail-title {
  font-weight: 500;
}
:scope .detail-hero-image {
  border-radius: 24px;
}
:scope .detail-content > p {
  font-family: Georgia, serif;
}
:scope .detail-content > h2 {
  font-weight: 500;
}
`;
