/** 12 The Deep Life Atlas — reading composition, only rearrange the image/title pair. */
export {detailLead as render} from "../../template-system/reference-presentation.js";
export const rules=[];
export const css = `
:scope .ref-article-lead {
  display: grid;
  grid-template-columns: 1fr 1.1fr;
  gap: 36px;
  align-items: center;
}
:scope .detail-hero-image {
  aspect-ratio: 1.25;
  border-radius: 28px;
}
:scope .detail-content > h2 {
  color: var(--color-primary);
}
`;
