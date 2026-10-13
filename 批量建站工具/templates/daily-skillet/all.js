/** 08 The Daily Skillet — archive cards; the generator still inserts full-row ad gaps. */
export const rules=[];
export const css = `
:scope #all-articles .item-card {
  border-radius: var(--card-radius);
  background: var(--color-surface);
}
:scope #all-articles .card-body {
  padding: 22px;
}
:scope #all-articles > .category-title {
  font-family: Georgia, serif;
  font-weight: 500;
  font-size: 42px;
}
`;
