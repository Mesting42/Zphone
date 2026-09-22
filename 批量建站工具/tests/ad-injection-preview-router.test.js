import { describe, expect, it } from 'vitest';
import {
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

  it('maps only known utility pages to toolbar tabs and treats arbitrary content as detail', () => {
    expect(previewPageTypeForEntry('dist/client/index.html', 'dist/client/')).toBe('home');
    expect(previewPageTypeForEntry('dist/client/about/index.html', 'dist/client/')).toBe('about');
    expect(previewPageTypeForEntry('dist/client/tools/swr/index.html', 'dist/client/')).toBe('detail');
    expect(previewPageTypeForEntry('dist/client/blog/how-antennas-work/index.html', 'dist/client/')).toBe('detail');
    expect(previewPageTypeForEntry('dist/client/games/space-runner/index.html', 'dist/client/')).toBe('detail');
  });
});
