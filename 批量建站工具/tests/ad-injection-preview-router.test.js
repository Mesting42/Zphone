import { describe, expect, it } from 'vitest';
import {
  availablePreviewContentTypes,
  isPreviewInternalHref,
  isPreviewDetailEntry,
  previewContentTypeForEntry,
  previewPageTypeForEntry,
  resolvePreviewHtmlEntry,
} from '../js/ad-injection-preview-router.js';

const entries = [
  'dist/client/index.html',
  'dist/client/tools/index.html',
  'dist/client/tools/swr/index.html',
  'dist/client/blog/index.html',
  'dist/client/blog/how-antennas-work/index.html',
  'dist/client/games/index.html',
  'dist/client/games/space-runner/index.html',
  'dist/client/about/index.html',
  'dist/client/contact.html',
].map((path) => ({ path }));

describe('finished-site preview routing', () => {
  it('recognizes flat detail files inside content folders without selecting list indexes', () => {
    expect(isPreviewDetailEntry('upload/details/article1.html', 'upload/')).toBe(true);
    expect(isPreviewDetailEntry('upload/articles/field-record.htm', 'upload/')).toBe(true);
    expect(isPreviewDetailEntry('upload/games/space-runner.html', 'upload/')).toBe(true);
    expect(isPreviewDetailEntry('upload/details/index.html', 'upload/')).toBe(false);
    expect(isPreviewDetailEntry('upload/articles/index.htm', 'upload/')).toBe(false);
  });
  it.each([
    ['/tools', 'dist/client/index.html', 'dist/client/tools/index.html'],
    ['/tools/swr?unit=metric#result', 'dist/client/index.html', 'dist/client/tools/swr/index.html'],
    ['/blog/how-antennas-work', 'dist/client/index.html', 'dist/client/blog/how-antennas-work/index.html'],
    ['/games/space-runner', 'dist/client/index.html', 'dist/client/games/space-runner/index.html'],
    ['space-runner', 'dist/client/games/index.html', 'dist/client/games/space-runner/index.html'],
    ['/contact', 'dist/client/index.html', 'dist/client/contact.html'],
  ])('resolves %s without assuming a tools, editorial, or games vertical', (href, fromPath, expectedPath) => {
    expect(resolvePreviewHtmlEntry(entries, href, fromPath, 'dist/client/')?.path).toBe(expectedPath);
  });

  it('keeps hash links in the current document and rejects missing archive routes', () => {
    expect(resolvePreviewHtmlEntry(entries, '#popular', 'dist/client/index.html', 'dist/client/')).toBeNull();
    expect(resolvePreviewHtmlEntry(entries, '/missing-page', 'dist/client/index.html', 'dist/client/')).toBeNull();
  });

  it('routes same-site absolute URLs and rejects lookalike external routes', () => {
    const hosts = ['pocket-parlor.example'];
    expect(isPreviewInternalHref('/games/', hosts)).toBe(true);
    expect(isPreviewInternalHref('https://www.pocket-parlor.example/games/', hosts)).toBe(true);
    expect(isPreviewInternalHref('https://external.example/games/', hosts)).toBe(false);
    expect(resolvePreviewHtmlEntry(
      entries,
      'https://pocket-parlor.example/games/space-runner/',
      'dist/client/index.html',
      'dist/client/',
      hosts
    )?.path).toBe('dist/client/games/space-runner/index.html');
    expect(resolvePreviewHtmlEntry(
      entries,
      'https://external.example/games/space-runner/',
      'dist/client/index.html',
      'dist/client/',
      hosts
    )).toBeNull();
  });

  it('maps only known utility pages to toolbar tabs and treats arbitrary content as detail', () => {
    expect(previewPageTypeForEntry('dist/client/index.html', 'dist/client/')).toBe('home');
    expect(previewPageTypeForEntry('dist/client/about/index.html', 'dist/client/')).toBe('about');
    expect(previewPageTypeForEntry('dist/client/tools/swr/index.html', 'dist/client/')).toBe('detail');
    expect(previewPageTypeForEntry('dist/client/blog/how-antennas-work/index.html', 'dist/client/')).toBe('detail');
    expect(previewPageTypeForEntry('dist/client/games/space-runner/index.html', 'dist/client/')).toBe('detail');
  });

  it('selects concrete game pages as details without treating the games index as one', () => {
    expect(isPreviewDetailEntry('dist/client/games/space-runner/index.html', 'dist/client/')).toBe(true);
    expect(isPreviewDetailEntry('dist/client/games/index.html', 'dist/client/')).toBe(false);
    expect(isPreviewDetailEntry('dist/client/blog/how-antennas-work/index.html', 'dist/client/')).toBe(true);
  });

  it('keeps article, tool and game detail placement scopes independent', () => {
    expect(previewContentTypeForEntry('dist/client/blog/how-antennas-work/index.html', 'dist/client/')).toBe('article');
    expect(previewContentTypeForEntry('dist/client/tools/swr/index.html', 'dist/client/')).toBe('tool');
    expect(previewContentTypeForEntry('dist/client/games/space-runner/index.html', 'dist/client/')).toBe('game');
    expect(previewContentTypeForEntry('dist/client/index.html', 'dist/client/')).toBe('home');
  });

  it('shows placement tabs only for concrete detail pages', () => {
    const listingOnly = [
      { path: 'index.html' },
      { path: 'tools/index.html' },
      { path: 'games/index.html' },
      { path: 'templates/blog-article.html' },
      { path: '_dist/orb-gallery.html' },
    ];
    expect(availablePreviewContentTypes(listingOnly, '')).toEqual({});
    expect(availablePreviewContentTypes([
      ...listingOnly,
      { path: 'tools/orbit-weight/index.html' },
      { path: 'articles/field-notes.html' },
    ], '')).toEqual({ tool: true, article: true });
  });
});
