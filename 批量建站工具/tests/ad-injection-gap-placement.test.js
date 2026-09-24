import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const start = app.indexOf('    function mountAdInjectionPlacementOverlay(');
const end = app.indexOf('\n    function addAdInjectionPlacementMarkers(', start);
const mountSource = app.slice(start, end);

class Element {
  constructor(tagName, rect = { left: 0, right: 0, top: 0, bottom: 0 }) {
    this.tagName = tagName.toUpperCase();
    this.nodeType = 1;
    this.rect = rect;
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.style = {};
    this.parentElement = null;
    this.hidden = false;
  }
  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  setAttribute(key, value) { this.attributes[key] = value; }
  getAttribute(key) { return this.attributes[key] || null; }
  hasAttribute(key) { return Object.hasOwn(this.attributes, key); }
  getBoundingClientRect() { return { ...this.rect, width: this.rect.right - this.rect.left, height: this.rect.bottom - this.rect.top }; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  contains(target) { return this === target || this.children.some((child) => child.contains(target)); }
}

function previewWithBottomWhitespace() {
  const html = new Element('html', { left: 0, right: 1000, top: 0, bottom: 700 });
  const body = html.appendChild(new Element('body', { left: 0, right: 1000, top: 0, bottom: 700 }));
  const main = body.appendChild(new Element('main', { left: 0, right: 1000, top: 0, bottom: 700 }));
  const section = main.appendChild(new Element('section', { left: 100, right: 900, top: 0, bottom: 500 }));
  const grid = section.appendChild(new Element('div', { left: 100, right: 900, top: 0, bottom: 200 }));
  const listeners = {};
  const messages = [];
  const doc = {
    documentElement: html,
    body,
    readyState: 'complete',
    createElement: (tag) => new Element(tag),
    querySelector: (selector) => {
      if (selector === 'main') return main;
      const id = selector.match(/^\[data-sitefoundry-placement-anchor="(\d+)"\]$/)?.[1];
      return id ? [grid].find((node) => node.getAttribute('data-sitefoundry-placement-anchor') === id) || null : null;
    },
    getElementById: (id) => body.children.find((node) => node.id === id) || null,
    elementsFromPoint: () => [section, main, body],
    addEventListener: (type, listener) => { listeners[type] = listener; }
  };
  const outer = { document: doc, Map, Array, JSON };
  vm.runInNewContext(mountSource + '\nthis.mount = mountAdInjectionPlacementOverlay;', outer);
  outer.mount(doc, 'home', [{ position: 'custom-after-0-0', target: grid, next: null, label: '自定义位置 · 放在此处', kind: 'custom', relation: 'after' }]);
  const runtime = body.children.find((node) => node.tagName === 'SCRIPT').textContent;
  vm.runInNewContext(runtime, {
    document: doc,
    window: { innerWidth: 1000, parent: { postMessage: (message) => messages.push(message) } },
    requestAnimationFrame: (callback) => callback(),
    addEventListener: () => {},
    MutationObserver: class { observe() {} },
    setTimeout: () => {}
  });
  const overlay = body.children.find((node) => node.id === 'sitefoundry-ad-placement-overlay');
  const button = overlay.children.find((node) => node.className === 'sitefoundry-injection-marker sitefoundry-injection-custom-marker');
  return { listeners, messages, button };
}

describe('finished-site manual ad placement', () => {
  it('uses the entire vertical whitespace after a sole content block as a clickable target', () => {
    const { listeners, messages, button } = previewWithBottomWhitespace();
    listeners.pointermove({ clientX: 500, clientY: 300 });
    expect(button.hidden).toBe(false);
    expect(button.style.display).toBe('flex');
    expect(button.style.top).toBe('200px');
    expect(button.style.height).toBe('300px');
    button.listeners.click({ preventDefault() {}, stopPropagation() {} });
    expect(messages).toEqual([{ type: 'ad-injection-place', position: 'custom-after-0-0', page: 'home' }]);
    listeners.pointermove({ clientX: 500, clientY: 100 });
    expect(button.hidden).toBe(true);
    expect(button.style.display).toBe('none');
  });
});
