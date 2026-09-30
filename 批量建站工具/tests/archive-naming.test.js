import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = {};
const source = readFileSync(new URL('../js/archive-naming.js', import.meta.url), 'utf8');
vm.runInNewContext(source, context);

describe('site archive naming and layout', () => {
  it('uses a recognized ad host for both the ZIP filename and site directory', () => {
    const descriptor = context.ArchiveNaming.siteZipDescriptor(' WDG923B.VIBORY.PRO ', 'site-website.zip');

    expect(descriptor.fileName).toBe('wdg923b.vibory.pro.zip');
    expect(descriptor.siteFolderName).toBe('wdg923b.vibory.pro');
  });

  it('keeps the existing fallback name and website folder when no valid ad host exists', () => {
    const descriptor = context.ArchiveNaming.siteZipDescriptor('not a host', 'science-site-website.zip');

    expect(descriptor.fileName).toBe('science-site-website.zip');
    expect(descriptor.siteFolderName).toBe('website');
  });
});
