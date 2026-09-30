import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const guardPath = new URL('../js/dropdown-event-guards.js', import.meta.url);
const guardSource = existsSync(guardPath) ? readFileSync(guardPath, 'utf8') : '';
const mainApp = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const gameApp = readFileSync(new URL('../game-builder/js/app.js', import.meta.url), 'utf8');
const mainHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const gameHtml = readFileSync(new URL('../game-builder/index.html', import.meta.url), 'utf8');

function loadGuards() {
  const context = { window: {} };
  if (guardSource) vm.runInNewContext(guardSource, context);
  return context.window.SiteFoundryDropdownEventGuards;
}

describe('custom dropdown event guards', () => {
  it('keeps scroll events originating in a dropdown menu from closing it', () => {
    const guards = loadGuards();
    expect(guards).toBeDefined();

    const child = { parent: null };
    const menu = { contains: (target) => target === child };
    child.parent = menu;

    expect(guards.isScrollWithinAny({ target: child }, [menu])).toBe(true);
    expect(guards.isScrollWithinAny({ target: { parent: null } }, [menu])).toBe(false);
  });

  it('recognizes scrollbar interactions by menu bounds when the browser targets outside the menu', () => {
    const guards = loadGuards();
    expect(guards).toBeDefined();

    const menu = {
      contains: () => false,
      getBoundingClientRect: () => ({ left: 100, top: 50, right: 280, bottom: 210 })
    };

    expect(guards.isInteractionWithinAny({ target: {}, clientX: 275, clientY: 120 }, [menu])).toBe(true);
    expect(guards.isInteractionWithinAny({ target: {}, clientX: 300, clientY: 120 }, [menu])).toBe(false);
  });

  it('loads the shared guard before both app entry points and wires both custom-select implementations', () => {
    const mainGuardIndex = mainHtml.indexOf('js/dropdown-event-guards.js');
    const mainAppIndex = mainHtml.indexOf('js/app.js');
    const gameGuardIndex = gameHtml.indexOf('../js/dropdown-event-guards.js');
    const gameAppIndex = gameHtml.indexOf('js/app.js');

    expect(mainGuardIndex).toBeGreaterThanOrEqual(0);
    expect(gameGuardIndex).toBeGreaterThanOrEqual(0);
    expect(mainGuardIndex).toBeLessThan(mainAppIndex);
    expect(gameGuardIndex).toBeLessThan(gameAppIndex);
    expect(mainApp).toContain('isScrollWithinAny(event');
    expect(mainApp).toContain('isInteractionWithinAny(event');
    expect(gameApp).toContain('isScrollWithinAny(event');
    expect(gameApp).toContain('isInteractionWithinAny(event');
    expect(mainApp).not.toContain("trigger.addEventListener('blur', closeWhenFocusLeaves)");
    expect(mainApp).not.toContain("menu.addEventListener('focusout', closeWhenFocusLeaves)");
  });
});
