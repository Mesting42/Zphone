/** 05 PixelWire — reading composition, only rearrange the image/title pair. */
export {detailLead as render} from "../../template-system/reference-presentation.js";
export const rules=[];
export const css = `
:scope .detail-title {
  max-width: 22ch;
}
:scope .ref-article-lead {
  border-bottom: 1px solid var(--color-primary);
  margin-bottom: 24px;
}
:scope .detail-content > h2 {
  border-left: 3px solid var(--color-primary);
  padding-left: 16px;
}
`;
