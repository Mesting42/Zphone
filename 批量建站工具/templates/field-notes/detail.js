/** 04 Field Notes — reading composition, only rearrange the image/title pair. */
export {detailLead as render} from "../../template-system/reference-presentation.js";
export const rules=[];
export const css = `
:scope .ref-article-lead {
  display: grid;
  grid-template-columns: .95fr 1.05fr;
  gap: 36px;
  align-items: center;
}
:scope .detail-title {
  font-weight: 400;
}
:scope .detail-content > p {
  font-family: Georgia, serif;
}
:scope .detail-hero-image {
  aspect-ratio: 1.25;
}
`;
