/** 06 Stone & Crumb — reading composition, only rearrange the image/title pair. */
export {detailLead as render} from "../../template-system/reference-presentation.js";
export const rules=[];
export const css = `
:scope .detail-title {
  max-width: 26ch;
  text-align: center;
  margin-left: auto;
  margin-right: auto;
}
:scope .detail-hero-image {
  border-radius: 28px;
}
:scope .detail-content > h2 {
  color: var(--color-primary);
}
`;
