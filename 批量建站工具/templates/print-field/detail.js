/** 13 The Print Field — reading composition, only rearrange the image/title pair. */
export {detailLead as render} from "../../template-system/reference-presentation.js";
export const rules=[];
export const css = `
:scope .detail-title {
  max-width: 23ch;
  font-size: clamp(36px, 5.2vw, 72px);
}
:scope .detail-hero-image {
  border-radius: 18px;
}
:scope .detail-content > h2 {
  border-top: 1px solid var(--color-border);
  padding-top: 20px;
}
:scope .detail-content > p {
  line-height: 1.85;
}
`;
