/** 07 EVWired — reading composition, only rearrange the image/title pair. */
export {detailLead as render} from "../../template-system/reference-presentation.js";
export const rules=[];
export const css = `
:scope .ref-article-lead {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 36px;
  align-items: center;
}
:scope .detail-title {
  font-weight: 500;
}
:scope .detail-hero-image {
  aspect-ratio: 1.2;
}
:scope .detail-content > h2 {
  font-weight: 500;
}
`;
