import { describe, expect, it } from 'vitest';
import { loadBuilder, createState } from './template-fixtures.mjs';

describe.each([false, true])('preview/export placement parity (game: %s)', game => {
  const builder = loadBuilder(game);
  it.each([1, 2, 15])('renders each banner exactly once with %i paragraphs', async paragraphs => {
    const state = createState(builder);
    state.data = state.data.slice(0, 2).map(row => ({ ...row, content: Array.from({ length: paragraphs }, (_, i) => `Paragraph ${i + 1} contains enough meaningful article text to exercise the middle boundary.`).join('\n\n') }));
    const preview = builder.generator.generatePreviewHtml(state, 'detail', 0);
    await builder.generator.exportWebsite(state, () => {});
    const exported = builder.files()['website/details/article1.html'];
    for (const html of [preview, exported]) {
      for (const n of [1, 2, 3]) expect((html.match(new RegExp('id="div-gpt-ad-banner' + n + '"', 'g')) || []).length).toBe(1);
      expect(html.indexOf('id="adv3"')).toBeLessThan(html.indexOf('<footer'));
    }
  });
});
