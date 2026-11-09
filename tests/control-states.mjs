import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../source/control-states.js', import.meta.url), 'utf8');

function harness(initial, {storageThrows = false, marker = null} = {}) {
  const styles = new Set(), listeners = new Map(), effects = [];
  const attributes = new Map(marker === null ? [] : [['data-sao-controls', marker]]);
  const root = {
    getAttribute: key => attributes.get(key) ?? null,
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: key => attributes.delete(key),
    appendChild(el) { styles.add(el); el.isConnected = true; },
  };
  const doc = {
    documentElement: root,
    head: root,
    createElement() {
      return {
        textContent: '', isConnected: false,
        setAttribute() {},
        remove() { styles.delete(this); this.isConnected = false; },
      };
    },
  };
  let stored = initial === undefined ? null : JSON.stringify(initial);
  const win = {
    document: doc,
    localStorage: {getItem() { if (storageThrows) throw Error('storage denied'); return stored; }},
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
  };
  const ctx = {effect(fn) { effects.push(fn()); }};
  const context = vm.createContext({window: win});
  vm.runInContext(source, context);
  return {
    apply: () => context.applySAOControlStates(ctx),
    event(type, event) { for (const fn of listeners.get(type) || []) fn(event); },
    store(value) { stored = value; },
    styles, root, listeners,
    unload() { effects.splice(0).reverse().forEach(fn => fn()); },
  };
}

test('legacy preferences enable all; ctx.effect unload removes every owned resource', () => {
  const h = harness({accent: '#8CC8F4'});
  h.apply();
  assert.equal(h.styles.size, 1);
  assert.equal(h.root.getAttribute('data-sao-controls'), 'all');
  assert.equal(h.listeners.get('dsh-sao-mode-change').size, 1);
  h.unload();
  assert.equal(h.styles.size, 0);
  assert.equal(h.root.getAttribute('data-sao-controls'), null);
  assert.equal(h.listeners.get('dsh-sao-mode-change').size, 0);
  assert.equal(h.listeners.get('storage').size, 0);
});

test('only all mounts style; event.detail.mode wins without waiting for persistence', () => {
  const h = harness({featureMode: 'startup-only'});
  h.apply();
  assert.equal(h.styles.size, 0);
  h.event('dsh-sao-mode-change', {detail: {mode: 'all'}});
  assert.equal(h.styles.size, 1);
  for (const mode of ['startup-only', 'startup', 'animation', 'off', 'unknown', '']) {
    h.event('dsh-sao-mode-change', {detail: {mode}});
    assert.equal(h.styles.size, 0, mode);
    assert.equal(h.root.getAttribute('data-sao-controls'), null);
    h.event('dsh-sao-mode-change', {detail: {mode: 'all'}});
  }
  h.event('dsh-sao-mode-change', {detail: {unrelated: true}});
  assert.equal(h.styles.size, 1);
  h.unload();
});

test('storage changes and clearing preferences update mode; unrelated keys do not', () => {
  const h = harness({featureMode: 'all'});
  h.apply();
  h.store(JSON.stringify({featureMode: 'off'}));
  h.event('storage', {key: 'other'});
  assert.equal(h.styles.size, 1);
  h.event('storage', {key: 'dsh-sao.preferences.v4'});
  assert.equal(h.styles.size, 0);
  h.store(null);
  h.event('storage', {key: null});
  assert.equal(h.styles.size, 1);
  h.unload();
});

test('malformed or inaccessible legacy storage does not break plugin mounting', () => {
  for (const storageThrows of [false, true]) {
    const h = harness(undefined, {storageThrows});
    h.store('{broken');
    h.apply();
    assert.equal(h.styles.size, 1);
    h.unload();
  }
});

test('repeated application retires previous controller; stale disposers cannot remove new style', () => {
  const h = harness({featureMode: 'all'}, {marker: 'external'});
  const first = h.apply();
  h.apply();
  assert.equal(h.styles.size, 1);
  assert.equal(h.listeners.get('dsh-sao-mode-change').size, 1);
  first.dispose();
  assert.equal(h.styles.size, 1);
  h.unload();
  assert.equal(h.styles.size, 0);
  assert.equal(h.root.getAttribute('data-sao-controls'), 'external');
});
