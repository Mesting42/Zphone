/** 07 EVWired — archive cards; the generator still inserts full-row ad gaps. */
export const rules=[];
export const css = `
:scope #all-articles .item-card {
  border-radius: var(--card-radius);
}
:scope #all-articles .card-body {
  border-top: 1px solid var(--color-primary);
}
:scope #all-articles .card-title {
  font-weight: 500;
}
:scope #all-articles > .category-title {
  font-weight: 500;
  font-size: 42px;
}
`;
