import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadGenerator(base) {
  const context = { window: {} };
  const source = (name) => readFileSync(new URL('../' + base + '/js/' + name, import.meta.url), 'utf8');
  vm.runInNewContext(source('ad.js'), context);
  vm.runInNewContext(source('generator.js') + '\nthis.generator = Generator;', context);
  return context;
}

describe.each(['.', 'game-builder'])('%s ad.js template selection', (base) => {
  it('defaults to v1.0.1 and retains the homepage interstitial triggers', () => {
    const { generator } = loadGenerator(base);
    const output = generator.generateSelectedAdJs({ bannerPath1: '/123/banner-1' });
    expect(output).toContain('ad.js v1.0.1');
    expect(output).toContain('const adUnitBanner1 = "/123/banner-1";');
    expect(output).toContain('interstitialSlot.setConfig({');
    expect(output).toContain('continueReading: true');
    expect(() => new Function(output)).not.toThrow();
  });

  it('exports v1.0.0 without the interstitial trigger configuration', () => {
    const { generator } = loadGenerator(base);
    const output = generator.generateSelectedAdJs({ interstitialPath: '/123/int' }, 'v1.0.0');
    expect(output).toContain('ad.js v1.0.0');
    expect(output).toContain('const adUnitInterstitial = "/123/int";');
    expect(output).toContain('googletag.setConfig({');
    expect(output).not.toContain('interstitialSlot.setConfig({');
    expect(() => new Function(output)).not.toThrow();
  });

  it('exports the original uploaded script with populated legacy variables', () => {
    const { generator, window } = loadGenerator(base);
    const output = generator.generateSelectedAdJs({
      bannerPath1: '/123/banner-1', bannerPath4: '/123/banner-4',
      interstitialPath: '/123/int', analyticsID: 'G-TEST'
    }, 'initial');
    expect(output.replace(/^const (bannerPath1|bannerPath4|interstitialPath|analyticsID) = .*;$/gm, 'const $1 = "";')).toBe(window.AD_JS_SOURCE);
    expect(output).toContain('const bannerPath4 = "/123/banner-4";');
    expect(output).toContain('new IntersectionObserver(');
    expect(output).toContain("window.addEventListener('load'");
    expect(output).not.toContain('adUnitBanner1');
    expect(() => new Function(output)).not.toThrow();
  });
});
