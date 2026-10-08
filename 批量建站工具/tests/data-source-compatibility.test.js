import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = {};
vm.runInNewContext(readFileSync(new URL('../js/batch-ad-builder.js', import.meta.url), 'utf8') + '\nthis.builder = BatchAdBuilder;', context);
const builder = context.builder;
const theme = { fields: ['title', 'content', 'image', 'excerpt', 'id'].map(id => ({ id, label: id })) };

describe('third-party data source compatibility', () => {
  it('finds article data when package metadata is the first JSON in an archive', async () => {
    const entries = [{ path: 'package.json', text: '{"name":"site"}' }, { path: 'nested/articles.json', text: '[{"title":"Story","content":"Text"}]' }];
    expect((await builder.selectDataJson(entries, entry => entry.text)).path).toBe('nested/articles.json');
  });

  it('maps common object-based covers and rich text fields to their scalar leaves', () => {
    const result = builder.prepareSource([{ title: 'Title', image: { url: 'https://example.org/a.webp' }, content: { rendered: '<p>Text</p>' } }], {});
    expect(builder.autoMapFields(theme, builder.collectFields(result.data))).toMatchObject({ title: 'title', image: 'image.url', content: 'content.rendered' });
  });
  it('chooses nested content instead of an unrelated metadata array', () => {
    const row = { headline: 'A title', body: 'Article text' };
    expect(builder.normalizeData({ metadata: ['en'], data: { articles: [row] } })).toEqual([row]);
    expect(builder.autoMapFields(theme, builder.collectFields([row]))).toEqual({ title: 'headline', content: 'body' });
  });

  it('maps nested scalar fields while preserving the original record', () => {
    const result = builder.prepareSource([{ article: { headline: 'Nested title', body: 'Text' }, tags: ['one', 'two'] }], {});
    expect(result.data[0].article.headline).toBe('Nested title');
    expect(result.data[0]['article.headline']).toBe('Nested title');
    expect(builder.autoMapFields(theme, builder.collectFields(result.data))).toEqual({ title: 'article.headline', content: 'article.body' });
  });

  it('names same-basename images independently and preserves remote URLs in a mixed source', () => {
    const first = new Uint8Array([1]), second = new Uint8Array([2]);
    const result = builder.prepareSource([{ image: 'a/1.webp' }, { image: 'b/1.webp' }, { image: 'https://example.org/remote.webp' }], {
      'site/a/1.webp': first, 'site/b/1.webp': second
    });
    expect(result.data[0].image).not.toBe(result.data[1].image);
    expect(result.localImages[result.data[0].image]).toBe(first);
    expect(result.localImages[result.data[1].image]).toBe(second);
    expect(result.data[2].image).toBe('https://example.org/remote.webp');
  });

  it('reports an ambiguous image instead of silently using an unrelated cover', () => {
    expect(() => builder.prepareSource([{ image: '1.webp' }], { 'a/1.webp': {}, 'b/1.webp': {} })).toThrow('图片路径存在歧义');
  });

  it.each([null, '', 42, []])('reports the exact invalid record without losing other data: %j', invalid => {
    expect(() => builder.normalizeData([{ title: 'Valid' }, invalid])).toThrow('第 2 条');
  });

  it('accepts absent optional fields and rejects an empty wrapper', () => {
    expect(builder.normalizeData([{ title: 'Title', content: 'Text' }])).toHaveLength(1);
    expect(builder.normalizeData({ metadata: {} })).toHaveLength(0);
  });
});
