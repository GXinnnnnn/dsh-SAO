// Real React/Edge regression fixture. All directory/RPC data is local; never visits DSH.
// Optional dependency roots can be supplied for another workspace:
// SAO_TEST_REACT_ROOT (contains react/ and react-dom/), SAO_TEST_PLAYWRIGHT (package directory).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
let chromium, react, reactDOM, dependencyError;
try {
  const reactRoot = process.env.SAO_TEST_REACT_ROOT ?? 'C:/DSH/dsh-skin-market-submit-sparse/node_modules';
  const playwright = process.env.SAO_TEST_PLAYWRIGHT ?? 'C:/DSH/graduation-office/node_modules/.pnpm/playwright@1.64.0/node_modules/playwright';
  ({ chromium } = require(playwright));
  react = fs.readFileSync(path.join(reactRoot, 'react/umd/react.development.js'), 'utf8');
  reactDOM = fs.readFileSync(path.join(reactRoot, 'react-dom/umd/react-dom.development.js'), 'utf8');
} catch (error) { dependencyError = error.message; }
const source = fs.readFileSync(new URL('../source/model-intensity.js', import.meta.url), 'utf8');
function fixture() {
  window.calls = []; window.loads = 0; window.mode = 'ok'; window.finish = null;
  window.fixtureState = (effort, defaultEffort) => ({
    current: { provider: 'fixture', model: 'reasoner', ...(effort === undefined ? {} : { reasoningEffort: effort }) },
    groups: [{ id: 'fixture', models: [{ id: 'reasoner', reasoning: {
      ...(defaultEffort === undefined ? {} : { defaultEffort }),
      efforts: [{ id: 'low', name: '轻量' }, { id: 'medium', name: '均衡' }, { id: 'high', name: '深入' }]
    } }] }], pending: null, status: 'ready'
  });
  let state, subscribers = new Set();
  window.directory = {
    store: { getSnapshot: () => state, subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); } },
    get subscribers() { return subscribers.size; },
    set(next) { state = next; for (const fn of subscribers) fn(); },
    async load() { loads++; return state; },
    async select(selection) {
      calls.push(selection);
      if (mode === 'pending') return new Promise(resolve => { finish = resolve; });
      if (mode === 'reject') return { ok: false };
      directory.set({ ...state, current: selection }); return { ok: true };
    }
  };
  window.ctx = {
    sessions: { scope: () => ({}), subagentAddress: () => undefined },
    modelDirectories: { directoryFor: () => directory },
    slots: { inject: (name, fn) => fn(), register(options, component) { window.slot = { options, component }; return () => {}; } },
    effect: fn => fn()
  };
  window.start = (initial, preferences) => {
    if (preferences) localStorage.setItem('dsh-sao.preferences.v4', JSON.stringify(preferences));
    state = initial;
    window.dispose = applySAOModelIntensity(ctx, React);
    window.root = ReactDOM.createRoot(document.getElementById('mount'));
    root.render(React.createElement(slot.component, slot.options.inject('fixture-session')));
  };
  window.switchMode = mode => dispatchEvent(new CustomEvent('dsh-sao-mode-change', { detail: { mode } }));
}

test('real React 18 + native Edge range interactions', { skip: dependencyError ? `optional browser dependencies unavailable: ${dependencyError}` : false }, async t => {
  const server = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end('<!doctype html><meta charset="utf-8"><div id="mount"></div><button id="outside">Outside</button>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  t.after(() => browser.close());
  async function pageFor(t, { effort, defaultEffort, featureMode } = {}) {
    const page = await browser.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    for (const content of [react, reactDOM, source, `(${fixture.toString()})();`]) await page.addScriptTag({ content });
    await page.evaluate(({ effort, defaultEffort, featureMode }) => start(fixtureState(effort, defaultEffort), { featureMode }), { effort, defaultEffort, featureMode });
    if (featureMode !== 'startup-only') await page.getByRole('slider').waitFor();
    t.after(async () => {
      await page.evaluate(() => { dispose(); root.unmount(); });
      assert.deepEqual(errors, [], 'no browser exceptions, rejected promises or React warnings');
      assert.equal(await page.evaluate(() => directory.subscribers), 0);
      await page.close();
    });
    return { page, range: page.getByRole('slider', { name: '模型思考强度' }) };
  }
  await t.test('unset default is usable immediately, native ArrowRight saves only on keyup', async t => {
    const { page, range } = await pageFor(t);
    assert.equal(await range.isEnabled(), true);
    assert.equal(await range.getAttribute('aria-valuetext'), '服务商默认');
    assert.equal(await page.evaluate(() => calls.length), 0);
    await range.focus(); await page.keyboard.down('ArrowRight');
    assert.equal(await page.evaluate(() => calls.length), 0); await page.keyboard.up('ArrowRight');
    assert.deepEqual(await page.evaluate(() => calls), [{ provider: 'fixture', model: 'reasoner', reasoningEffort: 'low' }]);
  });
  await t.test('stale effort stays enabled and actual pointer choice at fallback saves advertised default', async t => {
    const { page, range } = await pageFor(t, { effort: 'obsolete', defaultEffort: 'medium' });
    assert.equal(await range.isEnabled(), true); assert.equal(await range.inputValue(), '1');
    assert.equal(await range.getAttribute('aria-valuetext'), '未匹配'); assert.equal(await page.evaluate(() => calls.length), 0);
    await range.click();
    assert.deepEqual(await page.evaluate(() => calls), [{ provider: 'fixture', model: 'reasoner', reasoningEffort: 'medium' }]);
  });
  await t.test('native drag previews without writes and releases capture with one save', async t => {
    const { page, range } = await pageFor(t); const box = await range.boundingBox();
    await page.mouse.move(box.x + 7, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width - 6, box.y + box.height / 2, { steps: 20 });
    assert.equal(await page.evaluate(() => calls.length), 0);
    await page.mouse.up(); assert.equal(await page.evaluate(() => calls.length), 1);
    assert.equal(await page.evaluate(() => calls[0].reasoningEffort), 'high');
  });
  await t.test('native Escape cancels; native blur commits once', async t => {
    const { page, range } = await pageFor(t, { effort: 'medium', defaultEffort: 'medium' });
    await range.focus(); await page.keyboard.down('ArrowRight'); await page.keyboard.press('Escape'); await page.keyboard.up('ArrowRight');
    assert.equal(await page.evaluate(() => calls.length), 0); assert.equal(await range.inputValue(), '1');
    await page.keyboard.down('ArrowLeft'); await page.locator('#outside').focus(); await page.keyboard.up('ArrowLeft');
    assert.equal(await page.evaluate(() => calls.length), 1); assert.equal(await page.evaluate(() => calls[0].reasoningEffort), 'low');
  });
  await t.test('native Home returns to provider default with effort omitted', async t => {
    const { page, range } = await pageFor(t, { effort: 'high' }); await range.press('Home');
    assert.deepEqual(await page.evaluate(() => calls), [{ provider: 'fixture', model: 'reasoner' }]);
    assert.equal(await range.getAttribute('aria-valuetext'), '服务商默认');
  });
  await t.test('switching model during native drag prevents stale write and next drag works', async t => {
    const { page, range } = await pageFor(t, { effort: 'medium', defaultEffort: 'medium' }); const box = await range.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width - 6, box.y + box.height / 2);
    await page.evaluate(() => { const next = fixtureState(); next.current.model = 'next'; next.groups[0].models[0].id = 'next'; directory.set(next); });
    await page.mouse.up(); assert.equal(await page.evaluate(() => calls.length), 0);
    await range.press('End'); assert.deepEqual(await page.evaluate(() => calls), [{ provider: 'fixture', model: 'next', reasoningEffort: 'high' }]);
  });
  await t.test('startup-only initial mode hides slider; window mode events restore and unmount it', async t => {
    const { page, range } = await pageFor(t, { featureMode: 'startup-only' });
    assert.equal(await range.count(), 0); assert.equal(await page.evaluate(() => loads), 0);
    await page.evaluate(() => switchMode('all')); await range.waitFor(); assert.equal(await range.isEnabled(), true);
    await range.focus(); await page.keyboard.down('ArrowRight');
    await page.evaluate(() => switchMode('startup-only')); await range.waitFor({ state: 'detached' }); await page.keyboard.up('ArrowRight');
    assert.equal(await page.evaluate(() => directory.subscribers), 0); assert.equal(await page.evaluate(() => calls.length), 0);
    await page.evaluate(() => switchMode('all')); await range.waitFor(); assert.equal(await range.inputValue(), '0');
  });
  await t.test('rejected selection has visible accessible error and restores provider default', async t => {
    const { page, range } = await pageFor(t); await page.evaluate(() => { mode = 'reject'; }); await range.press('End');
    await page.getByRole('alert').waitFor(); assert.equal(await range.inputValue(), '0');
    assert.match(await page.getByRole('alert').textContent(), /已恢复当前档位/); assert.equal(await page.evaluate(() => calls.length), 1);
  });
  await t.test('pending selection hidden by mode switch safely ignores late failure', async t => {
    const { page, range } = await pageFor(t); await page.evaluate(() => { mode = 'pending'; }); await range.press('End');
    assert.equal(await range.isDisabled(), true);
    await page.evaluate(() => switchMode('startup-only')); await range.waitFor({ state: 'detached' });
    await page.evaluate(() => { finish({ ok: false }); switchMode('all'); }); await range.waitFor();
    assert.equal(await page.getByRole('alert').count(), 0); assert.equal(await range.inputValue(), '0'); assert.equal(await page.evaluate(() => calls.length), 1);
  });
});
