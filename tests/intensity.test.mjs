// Dependency-free regression tests for the real plugin source and public directory contract.
// No DSH connection, model request, profile/config writes, generated bundle or network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../source/model-intensity.js', import.meta.url), 'utf8');
const preferencesKey = 'dsh-sao.preferences.v4';
let active;
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const React = {
  createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
  useState(initial) {
    const r = active, i = r.cursor++;
    r.hooks[i] ??= { value: typeof initial === 'function' ? initial() : initial };
    return [r.hooks[i].value, value => {
      if (r.dead) { r.lateWrites++; return; }
      const next = typeof value === 'function' ? value(r.hooks[i].value) : value;
      if (!Object.is(next, r.hooks[i].value)) { r.hooks[i].value = next; r.dirty = true; }
    }];
  },
  useRef(value) { const r = active, i = r.cursor++; return r.hooks[i] ??= { current: value }; },
  useCallback(fn, deps) {
    const r = active, i = r.cursor++;
    if (!r.hooks[i] || !same(deps, r.hooks[i].deps)) r.hooks[i] = { fn, deps };
    return r.hooks[i].fn;
  },
  useEffect(fn, deps) {
    const r = active, i = r.cursor++;
    if (!r.hooks[i] || !same(deps, r.hooks[i].deps)) {
      const old = r.hooks[i];
      r.hooks[i] = { deps, cleanup: old?.cleanup };
      r.effects.push(() => { r.hooks[i].cleanup?.(); r.hooks[i].cleanup = fn(); });
    }
  },
  useSyncExternalStore(subscribe, getSnapshot) {
    const r = active;
    React.useEffect(() => subscribe(() => { r.dirty = true; }), [subscribe]);
    return getSnapshot();
  },
  useId() { return React.useRef('intensity-test').current; }
};
function walk(tree, type) {
  if (!tree) return null;
  if (tree.type === type) return tree;
  for (const child of (tree.props?.children ?? []).flat(Infinity)) {
    const result = walk(child, type);
    if (result) return result;
  }
  return null;
}
class Renderer {
  constructor(component, props, registry) {
    this.component = component; this.props = props; this.registry = registry;
    registry.push(this);
    this.hooks = []; this.dirty = true; this.dead = false; this.lateWrites = 0;
    this.node = {
      value: '0', capture: null,
      setPointerCapture: id => { this.node.capture = id; },
      hasPointerCapture: id => this.node.capture === id,
      releasePointerCapture: id => {
        if (this.node.capture === id) {
          this.node.capture = null;
          this.input()?.props.onLostPointerCapture?.();
        }
      }
    };
    this.flush();
  }
  flush() {
    if (this.dead) return this.tree;
    let limit = 30;
    while (this.dirty) {
      assert.ok(limit--, 'no render loop');
      this.dirty = false; this.cursor = 0; this.effects = []; active = this;
      const raw = this.component(this.props);
      if (typeof raw?.type === 'function') {
        if (this.child && (this.child.component !== raw.type || this.child.props.key !== raw.props.key)) {
          this.child.unmount(); this.child = null;
        }
        if (!this.child) this.child = new Renderer(raw.type, raw.props, this.registry);
        else { this.child.props = raw.props; this.child.dirty = true; }
        this.tree = this.child.flush();
      } else {
        this.child?.unmount(); this.child = null; this.tree = raw;
        const input = this.input();
        if (input) { input.props.ref.current = this.node; this.node.value = String(input.props.value); }
      }
      for (const effect of this.effects) effect();
    }
    if (this.child) this.tree = this.child.flush();
    return this.tree;
  }
  input() { return walk(this.tree, 'input'); }
  get element() { return this.input()?.props.ref.current ?? this.node; }
  event(name, value, extra = {}) {
    this.flush();
    const props = this.input()?.props;
    assert.ok(props, 'range is mounted');
    if (value !== undefined) this.element.value = String(value);
    props[name]?.({ currentTarget: this.element, pointerId: 1, key: '', preventDefault() {}, stopPropagation() {}, ...extra });
    this.flush();
  }
  unmount() {
    if (this.dead) return;
    for (const hook of this.hooks) hook?.cleanup?.();
    this.child?.unmount(); this.dead = true;
  }
}
function snapshot(options = {}) {
  return {
    current: { provider: 'provider-a', model: 'reasoner', reasoningEffort: 'medium' },
    groups: [{ id: 'provider-a', models: [{ id: 'reasoner', reasoning: {
      defaultEffort: 'medium', efforts: [
        { id: 'low', name: '轻量' }, { id: 'medium', name: '均衡' }, { id: 'high', name: '深入' }
      ]
    } }] }], pending: null, status: 'ready', ...options
  };
}
function noDefault(effort) {
  const state = snapshot({ current: { provider: 'provider-a', model: 'reasoner', ...(effort === undefined ? {} : { reasoningEffort: effort }) } });
  delete state.groups[0].models[0].reasoning.defaultEffort;
  return state;
}
const tick = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
function setup(t, initial = snapshot(), options = {}) {
  const renderers = [], directories = new Map(), calls = [], listeners = new Map();
  let registered, unregistered = 0, styles = 0, loads = 0, resolutions = 0, storageWrites = 0;
  let storage = options.preferences ?? null;
  let select;
  const window = {
    localStorage: {
      getItem(key) { assert.equal(key, preferencesKey); if (options.storageBlocked) throw Error('blocked'); return storage; },
      setItem() { storageWrites++; }
    },
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); }
  };
  function dispatch(type, properties = {}) { for (const fn of [...(listeners.get(type) ?? [])]) fn({ type, ...properties }); }
  function makeDirectory(id) {
    let state = initial;
    const subscribers = new Set();
    const directory = {
      store: { getSnapshot: () => state, subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); } },
      set(next) { state = next; for (const fn of [...subscribers]) fn(); },
      get state() { return state; }, get subscribers() { return subscribers.size; },
      async load() { loads++; if (options.loadFailure) throw Error('offline'); return state; },
      select(selection) {
        calls.push({ sessionId: id, selection: JSON.parse(JSON.stringify(selection)) });
        if (select) return select(selection, directory);
        directory.set({ ...state, current: selection, pending: null, status: 'ready' });
        return Promise.resolve({ ok: true });
      }
    };
    directories.set(id, directory); return directory;
  }
  const ctx = {
    sessions: { subagentAddress: id => id === 'child' ? {} : undefined, scope: id => id === 'gone' ? undefined : {} },
    modelDirectories: { directoryFor(id) { resolutions++; return directories.get(id) ?? makeDirectory(id); } },
    slots: { inject: (name, fn) => fn(), register(options, component) { registered = { options, component }; return () => { unregistered++; }; } },
    effect: fn => fn()
  };
  const sandbox = { window, document: {
    head: { append() { styles++; } }, createElement: () => ({ dataset: {}, remove() { styles--; } })
  } };
  vm.createContext(sandbox);
  vm.runInContext(source + '\nthis.apply = applySAOModelIntensity;', sandbox);
  const dispose = sandbox.apply(ctx, React);
  const roots = [];
  t.after(async () => {
    for (const r of roots) r.unmount();
    dispose(); await tick();
    assert.equal(styles, 0, 'style removed');
    assert.equal(unregistered, 1, 'slot unregistered exactly once');
    assert.ok([...listeners.values()].every(set => set.size === 0), 'window listeners released');
    assert.ok([...directories.values()].every(d => d.subscribers === 0), 'store subscriptions released');
    assert.equal(renderers.reduce((sum, r) => sum + r.lateWrites, 0), 0, 'no late state writes');
    assert.equal(storageWrites, 0, 'preferences never written');
  });
  return {
    calls, directories, dispose, dispatch,
    mount(id = 'session-a') { const r = new Renderer(registered.component, registered.options.inject(id), renderers); roots.push(r); return r; },
    switchSession(r, id) { r.props = registered.options.inject(id); r.dirty = true; r.flush(); },
    mode(mode, flush = true) { dispatch('dsh-sao-mode-change', { detail: { mode } }); if (flush) for (const r of roots) r.flush(); },
    storage(value, key = preferencesKey) { storage = value; dispatch('storage', { key }); for (const r of roots) r.flush(); },
    setSelect(fn) { select = fn; },
    get directory() { return directories.get('session-a'); },
    get loads() { return loads; }, get resolutions() { return resolutions; }
  };
}
function keyboard(r, value, key = 'End') {
  r.event('onKeyDown', undefined, { key }); r.event('onInput', value); r.event('onKeyUp', undefined, { key });
}

test('advertised default is usable without saving anything on mount/load', async t => {
  const state = snapshot({ current: { provider: 'provider-a', model: 'reasoner' } });
  const x = setup(t, state), r = x.mount(); await tick(); r.flush();
  assert.equal(r.input().props.disabled, false); assert.equal(r.input().props.value, 1);
  assert.equal(r.input().props['aria-valuetext'], '均衡'); assert.equal(x.loads, 1); assert.equal(x.calls.length, 0);
});
test('absent adapter default exposes official provider-default stop and supports first keyboard choice', async t => {
  const x = setup(t, noDefault()), r = x.mount(); await tick(); r.flush();
  assert.equal(r.input().props.disabled, false); assert.equal(r.input().props.value, 0);
  assert.equal(r.input().props.max, 3); assert.equal(r.input().props['aria-valuetext'], '服务商默认');
  assert.equal(x.calls.length, 0); keyboard(r, 1, 'ArrowRight'); await tick(); r.flush();
  assert.deepEqual(x.calls[0], { sessionId: 'session-a', selection: { provider: 'provider-a', model: 'reasoner', reasoningEffort: 'low' } });
});
test('user can explicitly return to provider default using an omitted effort', async t => {
  const x = setup(t, noDefault('high')), r = x.mount(); keyboard(r, 0, 'Home'); await tick(); r.flush();
  assert.deepEqual(x.calls[0].selection, { provider: 'provider-a', model: 'reasoner' });
  assert.equal(r.input().props['aria-valuetext'], '服务商默认');
});
test('obsolete effort is usable and choosing fallback thumb position commits, with no automatic repair', async t => {
  const x = setup(t, snapshot({ current: { provider: 'provider-a', model: 'reasoner', reasoningEffort: 'old-model-effort' } })), r = x.mount();
  await tick(); r.flush(); assert.equal(x.calls.length, 0);
  assert.equal(r.input().props.disabled, false); assert.equal(r.input().props.value, 1);
  assert.equal(r.input().props['aria-valuetext'], '未匹配'); assert.match(r.tree.props.title, /old-model-effort/);
  keyboard(r, 1, 'ArrowDown'); await tick(); r.flush();
  assert.equal(x.calls.length, 1); assert.equal(x.calls[0].selection.reasoningEffort, 'medium');
});
test('obsolete effort with no advertised default can select provider default at its fallback stop', async t => {
  const x = setup(t, noDefault('obsolete')), r = x.mount(); assert.equal(x.calls.length, 0);
  assert.equal(r.input().props.disabled, false); keyboard(r, 0, 'Home'); await tick(); r.flush();
  assert.deepEqual(x.calls[0].selection, { provider: 'provider-a', model: 'reasoner' });
});
test('switch to another model lacking default needs no native picker preparation', async t => {
  const x = setup(t), r = x.mount();
  const next = noDefault(); next.current.model = 'new-model'; next.groups[0].models[0].id = 'new-model';
  x.directory.set(next); r.flush(); assert.equal(x.calls.length, 0); assert.equal(r.input().props.disabled, false);
  keyboard(r, 3); await tick(); r.flush();
  assert.deepEqual(x.calls[0].selection, { provider: 'provider-a', model: 'new-model', reasoningEffort: 'high' });
});
test('100 pointer previews produce one release save and preserve capture safety', async t => {
  const x = setup(t, noDefault()), r = x.mount(); r.event('onPointerDown');
  for (let i = 0; i < 100; i++) r.event('onInput', i % 4);
  r.event('onInput', 3); assert.equal(x.calls.length, 0); const node = r.element;
  r.event('onPointerUp'); r.event('onBlur'); await tick(); r.flush();
  assert.equal(x.calls.length, 1); assert.equal(x.calls[0].selection.reasoningEffort, 'high'); assert.equal(node.capture, null);
});
test('keyboard repeats, Home/End, blur and assistive onChange keep explicit commit semantics', async t => {
  const x = setup(t), r = x.mount(); r.event('onKeyDown', undefined, { key: 'End' });
  for (let i = 0; i < 10; i++) r.event('onInput', 2);
  assert.equal(x.calls.length, 0); r.event('onKeyUp', undefined, { key: 'End' }); await tick(); r.flush();
  keyboard(r, 0, 'Home'); await tick(); r.flush();
  r.event('onKeyDown', undefined, { key: 'ArrowUp' }); r.event('onInput', 1); r.event('onBlur'); await tick(); r.flush();
  r.event('onChange', 2); await tick(); r.flush();
  assert.deepEqual(x.calls.map(c => c.selection.reasoningEffort), ['high', 'low', 'medium', 'high']);
});
test('Escape, pointercancel and lost capture discard drafts without saving', async t => {
  const x = setup(t), r = x.mount();
  r.event('onKeyDown', undefined, { key: 'ArrowRight' }); r.event('onInput', 2);
  r.event('onKeyDown', undefined, { key: 'Escape' }); r.event('onKeyUp', undefined, { key: 'ArrowRight' });
  r.event('onPointerDown'); r.event('onInput', 0); r.event('onPointerCancel');
  r.event('onPointerDown'); r.event('onInput', 2); r.event('onLostPointerCapture'); r.event('onPointerUp');
  assert.equal(x.calls.length, 0); assert.equal(r.input().props.value, 1);
});
test('unchanged valid choice creates no redundant save', t => {
  const x = setup(t), r = x.mount(); keyboard(r, 1, 'Home'); assert.equal(x.calls.length, 0);
});
test('native picker or catalog changes invalidate an active drag', t => {
  const x = setup(t), r = x.mount();
  r.event('onPointerDown'); r.event('onInput', 2);
  x.directory.set(snapshot({ current: { provider: 'provider-a', model: 'reasoner', reasoningEffort: 'low' } }));
  r.flush(); r.event('onPointerUp'); assert.equal(x.calls.length, 0); assert.equal(r.input().props.value, 0);
  r.event('onPointerDown'); r.event('onInput', 2);
  const next = snapshot(); next.groups[0].models[0].reasoning.efforts[2].id = 'replacement';
  x.directory.set(next); r.event('onPointerUp'); assert.equal(x.calls.length, 0);
});
test('model change before React rerender is checked against live store', t => {
  const x = setup(t), r = x.mount(); r.event('onPointerDown'); r.event('onInput', 2);
  const release = r.input().props.onPointerUp, node = r.element;
  x.directory.set(snapshot({ current: { provider: 'provider-a', model: 'other' } }));
  release({ currentTarget: node }); assert.equal(x.calls.length, 0); r.flush(); assert.equal(r.tree, null);
});
test('loading, selecting, idle and shared pending remain disabled', t => {
  const x = setup(t), r = x.mount();
  for (const state of [snapshot({ status: 'idle' }), snapshot({ status: 'loading' }), snapshot({ status: 'selecting' }), snapshot({ pending: {} })]) {
    x.directory.set(state); r.flush(); assert.equal(r.input().props.disabled, true); keyboard(r, 2);
  }
  assert.equal(x.calls.length, 0);
});
test('unsupported hidden, single advertised/default level disabled, unavailable sessions avoid directory resolution', async t => {
  const state = snapshot(); delete state.groups[0].models[0].reasoning;
  const x = setup(t, state), r = x.mount(); assert.equal(r.tree, null);
  const one = snapshot(); one.groups[0].models[0].reasoning.efforts = [{ id: 'medium', name: '仅此档' }];
  x.directory.set(one); r.flush(); assert.equal(r.input().props.disabled, true);
  for (const id of [undefined, 'gone', 'child']) { const other = x.mount(id === undefined ? '' : id); assert.equal(other.tree, null); }
  await tick(); assert.equal(x.resolutions, 1); assert.equal(x.calls.length, 0);
});
for (const kind of ['rejected', 'thrown', 'synchronous throw']) {
  test(`${kind} save rolls local preview back with accessible error, without compensation RPC`, async t => {
    const x = setup(t, noDefault()), r = x.mount();
    x.setSelect(() => { if (kind === 'synchronous throw') throw Error('offline'); return kind === 'thrown' ? Promise.reject(Error('offline')) : Promise.resolve({ ok: false }); });
    keyboard(r, 3); await tick(); r.flush();
    assert.equal(r.input().props.value, 0); assert.equal(r.tree.props['data-state'], 'error');
    assert.equal(walk(r.tree, 'span').type, 'span'); assert.match(JSON.stringify(r.tree), /已恢复当前档位/);
    assert.match(JSON.stringify(r.tree), /"role":"alert"/); assert.equal(x.calls.length, 1);
  });
}
test('pending prevents duplicated pointer, keyboard and blur requests', async t => {
  const x = setup(t), r = x.mount(); let finish;
  x.setSelect(() => new Promise(resolve => { finish = resolve; })); keyboard(r, 2);
  assert.equal(r.input().props.disabled, true); keyboard(r, 0, 'Home'); r.event('onBlur'); assert.equal(x.calls.length, 1);
  finish({ ok: false }); await tick(); r.flush(); assert.equal(r.input().props.disabled, false);
});
test('late rejected save cannot overwrite a newer official picker value or show its stale error', async t => {
  const x = setup(t), r = x.mount(); let reject;
  x.setSelect(() => new Promise((resolve, fail) => { reject = fail; })); keyboard(r, 2);
  x.directory.set(snapshot({ current: { provider: 'provider-a', model: 'reasoner', reasoningEffort: 'low' } })); r.flush();
  reject(Error('offline')); await tick(); r.flush();
  assert.equal(r.input().props.value, 0); assert.equal(r.tree.props['data-state'], 'ready'); assert.equal(x.calls.length, 1);
});
test('load errors are caught and announced', async t => {
  const x = setup(t, snapshot(), { loadFailure: true }), r = x.mount(); await tick(); r.flush();
  assert.equal(r.tree.props['data-state'], 'error'); assert.match(JSON.stringify(r.tree), /加载失败/); assert.equal(x.calls.length, 0);
});
test('startup-only preference hides at first render with no load or selection', async t => {
  const x = setup(t, noDefault(), { preferences: JSON.stringify({ featureMode: 'startup-only' }) }), r = x.mount();
  await tick(); assert.equal(r.tree, null); assert.equal(x.loads, 0); assert.equal(x.calls.length, 0);
  x.mode('all'); await tick(); r.flush(); assert.equal(r.input().props.disabled, false); assert.equal(x.loads, 1);
});
test('mode event unmounts and releases drag; restoring all does not save old draft', async t => {
  const x = setup(t), r = x.mount(); r.event('onPointerDown'); r.event('onInput', 2); const node = r.element;
  x.mode('startup-only'); assert.equal(r.tree, null); assert.equal(node.capture, null); assert.equal(x.directory.subscribers, 0);
  x.mode('all'); await tick(); r.flush(); assert.equal(r.input().props.value, 1); assert.equal(x.calls.length, 0);
});
test('synchronous mode change blocks a stale pointerup before rerender, including a quick return to all', t => {
  const x = setup(t), r = x.mount(); r.event('onPointerDown'); r.event('onInput', 2);
  const release = r.input().props.onPointerUp, node = r.element;
  x.mode('startup-only', false); release({ currentTarget: node }); assert.equal(x.calls.length, 0);
  x.mode('all'); r.event('onPointerDown'); r.event('onInput', 2);
  const again = r.input().props.onPointerUp;
  x.mode('startup-only', false); x.mode('all', false); again({ currentTarget: r.element });
  assert.equal(x.calls.length, 0);
});
test('mode change during pending failure ignores late settlement after unmount', async t => {
  const x = setup(t), r = x.mount(); let finish;
  x.setSelect(() => new Promise(resolve => { finish = resolve; })); keyboard(r, 2);
  x.mode('startup-only'); finish({ ok: false }); await tick(); r.flush(); assert.equal(r.tree, null);
  x.mode('all'); await tick(); r.flush(); assert.equal(r.tree.props['data-state'], 'ready'); assert.equal(x.calls.length, 1);
});
test('storage preference changes control visibility; unrelated or invalid events do not hide', t => {
  const x = setup(t), r = x.mount(); x.mode('invalid'); assert.ok(r.input());
  x.storage(JSON.stringify({ featureMode: 'startup-only' }), 'other-key'); assert.ok(r.input());
  x.storage(JSON.stringify({ featureMode: 'startup-only' })); assert.equal(r.tree, null);
  x.storage(null, null); assert.ok(r.input());
});
for (const options of [{ preferences: '{bad JSON' }, { storageBlocked: true }, { preferences: JSON.stringify({ featureMode: 'future-mode' }) }]) {
  test(`unreadable or unknown preference defaults to all: ${JSON.stringify(options)}`, t => {
    const x = setup(t, snapshot(), options), r = x.mount(); assert.ok(r.input()); assert.equal(x.calls.length, 0);
  });
}
test('session switch unsubscribes and ignores previous session failure', async t => {
  const x = setup(t), r = x.mount(); let finish;
  x.setSelect(() => new Promise(resolve => { finish = resolve; })); keyboard(r, 2);
  x.switchSession(r, 'session-b'); assert.equal(x.directory.subscribers, 0);
  finish({ ok: false }); await tick(); r.flush(); assert.equal(r.tree.props['data-state'], 'ready');
  assert.equal(x.directories.get('session-b').subscribers, 1); assert.equal(x.calls.length, 1);
});
test('dispose during captured drag releases it and ignores stale handlers', async t => {
  const x = setup(t), r = x.mount(); r.event('onPointerDown'); r.event('onInput', 2);
  const release = r.input().props.onPointerUp, node = r.element;
  x.dispose(); assert.equal(node.capture, null); release({ currentTarget: node }); await tick(); assert.equal(x.calls.length, 0);
});
test('dispose before load microtask avoids loading; pending response after dispose cannot update state', async t => {
  const x = setup(t), r = x.mount(); x.dispose(); r.unmount(); await tick(); assert.equal(x.loads, 0);
  const y = setup(t), pending = y.mount(); let finish;
  y.setSelect(() => new Promise(resolve => { finish = resolve; })); keyboard(pending, 2);
  y.dispose(); pending.unmount(); finish({ ok: false }); await tick(); assert.equal(y.calls.length, 1);
});
