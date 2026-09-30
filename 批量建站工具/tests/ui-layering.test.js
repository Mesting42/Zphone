import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const css = readFileSync(new URL('../css/tool.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const data = ['template-catalog.js', 'template-layouts.js', 'navbar-layout.js', 'data.js'].map((name) => readFileSync(new URL('../js/' + name, import.meta.url), 'utf8')).join('\n');

describe('configuration floating controls', () => {
  it('portals open category menus out of the scrollable config panel', () => {
    expect(css).toMatch(/\.cat-icon-menu\.is-portal-open\s*\{[\s\S]*?position:\s*fixed[\s\S]*?z-index:\s*20000/);
    expect(app).toContain('function moveCategoryPickerMenuToPortal(picker)');
    expect(app).toContain('document.body.appendChild(menu)');
    expect(app).toContain('function restoreCategoryPickerMenu(picker)');
  });

  it('replaces Emoji that render as missing-glyph squares on Windows', () => {
    expect(data).toContain('function getWindowsSafeEmoji');
    const context = {};
    vm.runInNewContext(data + '\nthis.__all = ALL_CATEGORY_EMOJI_ICONS; this.__pools = DOMAIN_CATEGORY_EMOJI_POOLS; this.__safe = getWindowsSafeEmoji;', context);
    expect(context.__safe('⚕️')).toBe('🩺');
    expect(context.__all).not.toContain('⚕️');
    Object.values(context.__pools).forEach((pool) => expect(pool).not.toContain('⚕️'));
  });
});
