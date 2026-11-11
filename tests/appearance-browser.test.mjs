// Native Edge regression fixture. Loads the actual appearance/settings/video/liquid sources,
// with only the host services replaced. Uses a disposable origin, never the running DSH GUI.
// Optional: SAO_TEST_PLAYWRIGHT points to an installed Playwright package directory.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
let chromium, dependencyError;
try {
  ({ chromium } = require(process.env.SAO_TEST_PLAYWRIGHT ?? 'C:/DSH/graduation-office/node_modules/.pnpm/playwright@1.64.0/node_modules/playwright'));
} catch (error) { dependencyError = error.message; }
const source = ['better-sidebar.js', 'liquid-glass.js', 'video-wallpaper.js', 'settings-panel.js', 'appearance.js']
  .map(name => fs.readFileSync(new URL('../source/' + name, import.meta.url), 'utf8')).join('\n');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{--dsw-alias-brand-primary:#123456;--dsw-alias-bg-base:#eeeeee;font-family:Arial}
  #frame{display:flex;width:940px;height:600px;position:relative}
  #conversation-column{width:680px;height:600px}
  #right-column{width:260px;height:600px}
  header{height:48px}#right-panel{height:552px}
</style></head><body>
  <div id="frame">
    <div id="conversation-column"><div data-slot="conversation.header"><header>Conversation</header></div><div data-slot="main.conversation"></div></div>
    <div id="right-column"><div data-slot="rightbar"><div data-slot="rightbar.session"><header>Right</header></div><div id="right-panel" data-sidebar-right-panel="push" data-sidebar-right-open></div></div></div>
  </div><div id="settings"></div>
</body></html>`;

function fixture() {
  const key = 'dsh-sao.preferences.v4';
  window.themeCalls = [];
  window.modeEvents = [];
  window.nativeTransitions = [];
  window.activeTheme = 'light';
  window.fixtureEffects = [];
  let panelCleanup = null;
  const listeners = new Set();
  addEventListener('dsh-sao-mode-change', event => modeEvents.push(event.detail.mode));
  // Observe native lifecycle completion; do not substitute transition scheduling.
  const nativeStart = document.startViewTransition?.bind(document);
  window.hasNativeTransitions = !!nativeStart;
  if (nativeStart) document.startViewTransition = (...args) => {
    const transition = nativeStart(...args);
    nativeTransitions.push(transition);
    return transition;
  };
  const effect = fn => { const cleanup = fn(); if (typeof cleanup === 'function') fixtureEffects.push(cleanup); };
  const inspector = { register(definition) { window.inspector = definition; return () => {}; } };
  window.ctx = {
    theme: {
      getTheme: () => ({ preference: activeTheme }),
      setTheme(mode) { themeCalls.push(mode); activeTheme = mode; for (const fn of listeners) fn(); }
    },
    effect,
    get: () => ({}),
    on(event, fn) { if (event === 'theme/change') { listeners.add(fn); fixtureEffects.push(() => listeners.delete(fn)); } },
    slots: { inject: () => {}, register: () => {} },
    inject(dependencies, fn) { fn({ effect, get: name => name === 'cordisInspect' ? inspector : {} }); }
  };
  window.stop = () => {
    panelCleanup?.(); panelCleanup = null;
    for (const cleanup of fixtureEffects.splice(0).reverse()) cleanup();
  };
  window.start = (preferences = {}, theme = 'light') => {
    stop(); activeTheme = theme;
    localStorage.setItem(key, JSON.stringify({ wallpaper: 'none', accent: '#FF0000', surfaceColor: '#ABCDEF', ...preferences }));
    window.api = applySAOAppearance(ctx, {}, []);
    panelCleanup = mountSAOSettings(document.querySelector('#settings'), api);
  };
  window.stored = () => JSON.parse(localStorage.getItem(key));
  window.receiveStorage = patch => {
    const oldValue = localStorage.getItem(key);
    const newValue = JSON.stringify({ ...stored(), ...patch });
    // A separate tab writes storage before the browser delivers this event.
    localStorage.setItem(key, newValue);
    dispatchEvent(new StorageEvent('storage', { key, oldValue, newValue, storageArea: localStorage, url: location.href }));
  };
  window.paint = async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); };
  window.settleTransitions = async () => {
    await Promise.allSettled(nativeTransitions.flatMap(transition => [transition.updateCallbackDone, transition.finished]));
    await paint();
  };
  window.snapshot = () => {
    const css = getComputedStyle(document.body);
    const managed = '[data-sao-material],[data-sao-positioned],[data-sao-surface],[data-sao-zone],[data-sao-core-surface],'
      + '[data-sao-shell],[data-sao-shell-center],[data-sao-shell-sidebar],[data-sao-context],[data-sao-component],'
      + '[data-sao-wall-frame],[data-sao-wall-positioned],[data-sao-wall-column],[data-sao-wall-right],'
      + '[data-sao-browser-only],[data-sao-main-joined],[data-sao-right-joined],[data-sao-right-pane],[data-sao-right-root],[data-sao-browser-pane]';
    return {
      mode: api.get().featureMode,
      accent: css.getPropertyValue('--dsw-alias-brand-primary').trim(),
      surface: css.getPropertyValue('--dsw-alias-bg-base').trim(),
      font: css.fontFamily,
      styles: document.querySelectorAll('style[data-sao-appearance]').length,
      wallpapers: document.querySelectorAll('[data-sao-wallpaper]').length,
      managed: document.querySelectorAll(managed).length,
      liquid: document.querySelectorAll('[data-sao-liquid]').length,
      inlineAlphas: [...document.querySelectorAll('[style]')].filter(el => el.style.getPropertyValue('--sao-surface-alpha') || el.style.getPropertyValue('--sao-component-alpha')).length,
      switching: document.documentElement.hasAttribute('data-sao-switching'),
      tabs: [...document.querySelectorAll('[data-tab]')].filter(el => !el.hidden).map(el => el.dataset.tab),
      selectedTab: document.querySelector('[data-tab][aria-selected="true"]')?.dataset.tab,
      previewHidden: document.querySelector('.sao-preview').hidden,
      inspection: inspector && window.inspector.query('snapshot')
    };
  };
}

function assertSuspended(state) {
  assert.equal(state.mode, 'startup-only');
  assert.equal(state.accent, '#123456', 'external accent remains in force');
  assert.equal(state.surface, '#eeeeee', 'external surface remains in force');
  assert.equal(state.font, 'Arial', 'external font remains in force');
  for (const name of ['styles', 'wallpapers', 'managed', 'liquid', 'inlineAlphas']) assert.equal(state[name], 0, name + ' cleaned');
  assert.equal(state.switching, false);
  assert.deepEqual(state.tabs, ['startup']);
  assert.equal(state.selectedTab, 'startup');
  assert.equal(state.previewHidden, true);
  assert.equal(state.inspection.error, null);
}

test('appearance isolation and async theme/reset races in native Edge', {
  skip: dependencyError ? `optional browser dependency unavailable: ${dependencyError}` : false,
  timeout: 60000
}, async t => {
  const server = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  t.after(() => browser.close());
  async function pageFor(t, preferences = {}, theme = 'light') {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, reducedMotion: 'no-preference' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    t.after(async () => {
      try {
        await page.evaluate(async () => { stop(); await settleTransitions(); });
        assert.deepEqual(errors, [], 'no browser exceptions, unhandled rejections or console errors');
      } finally { await page.close(); }
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.bringToFront();
    await page.addScriptTag({ content: source + '\n(' + fixture.toString() + ')();' });
    assert.equal(await page.evaluate(() => hasNativeTransitions && !document.hidden), true, 'fixture uses a visible native view-transition document');
    await page.evaluate(({ preferences, theme }) => start(preferences, theme), { preferences, theme });
    return page;
  }
  await t.test('initial startup-only preserves external theme and exposes only startup settings', async t => {
    const page = await pageFor(t, { featureMode: 'startup-only' });
    assertSuspended(await page.evaluate(() => snapshot()));
    assert.deepEqual(await page.evaluate(() => modeEvents), ['startup-only']);
    assert.equal(await page.evaluate(() => stored().theme), undefined, 'initialization does not rewrite preferences');
  });
  await t.test('six full/startup cycles restore appearance and completely clean owned material', async t => {
    const page = await pageFor(t, { featureMode: 'startup-only' });
    for (let round = 0; round < 6; round++) {
      const active = await page.evaluate(async () => { api.set({ featureMode: 'all' }); await paint(); return snapshot(); });
      assert.equal(active.styles, 1); assert.equal(active.wallpapers, 1);
      assert.ok(active.managed > 0); assert.ok(active.inspection.passes > 0);
      assert.equal(active.accent.toUpperCase(), '#FF0000'); assert.equal(active.surface.toUpperCase(), '#ABCDEF');
      assert.equal(active.inspection.error, null); assert.equal(active.previewHidden, false);
      assertSuspended(await page.evaluate(async () => { api.set({ featureMode: 'startup-only' }); await paint(); return snapshot(); }));
    }
    assert.deepEqual(await page.evaluate(() => modeEvents), ['startup-only', ...Array.from({ length: 6 }, () => ['all', 'startup-only']).flat()]);
  });
  await t.test('composer metrics use strong theme ink and weight, preserve warnings and restore in startup-only', async t => {
    const page = await pageFor(t, { featureMode: 'all' });
    for (const dark of [false, true]) for (const semantic of [true, false]) {
      const result = await page.evaluate(async ({ dark, semantic }) => {
        api.set({ featureMode: 'all', surfaceColor: null });
        document.body.style.setProperty('--dsw-alias-label-primary', dark ? '#f0f2f5' : '#0f1115');
        document.body.style.setProperty('--dsw-alias-label-tertiary', '#81858c');
        document.body.style.setProperty('--dsw-alias-state-warn-primary', '#b45309');
        const root = document.createElement('section');
        root.innerHTML = `<style>.native-stat,.native-meter{color:var(--dsw-alias-label-tertiary);font:inherit}.native-warning{color:var(--dsw-alias-state-warn-primary)}</style><div data-slot="main.conversation"><div ${semantic ? 'data-composer-dock' : 'class="GRgSLq_dock"'}><div data-slot="conversation.composer.dock"><span class="native-stat">TPS 42.1</span></div><button class="native-meter"><span>43%</span></button><small class="native-warning">High usage</small></div></div><span class="native-stat" data-outside>Unrelated</span>`;
        document.body.append(root);
        const read = () => [...root.querySelectorAll('.native-stat,.native-meter,.native-warning')].map(el => ({ color: getComputedStyle(el).color, weight: getComputedStyle(el).fontWeight, synthesis: getComputedStyle(el).fontSynthesis }));
        const active = read(); api.set({ featureMode: 'startup-only' }); await paint();
        const restored = read(); root.remove(); return { active, restored };
      }, { dark, semantic });
      const ink = dark ? 'rgb(240, 242, 245)' : 'rgb(15, 17, 21)';
      assert.equal(result.active[0].color, ink); assert.equal(result.active[1].color, ink);
      assert.equal(result.active[0].weight, '600'); assert.equal(result.active[1].weight, '600');
      assert.equal(result.active[2].color, 'rgb(180, 83, 9)', 'warning keeps semantic hue');
      assert.equal(result.active[3].color, 'rgb(129, 133, 140)', 'outside text is unchanged');
      assert.equal(result.restored[0].color, 'rgb(129, 133, 140)'); assert.equal(result.restored[1].color, 'rgb(129, 133, 140)');
      assert.equal(result.restored[0].weight, '400'); assert.equal(result.restored[1].weight, '400');
    }
  });
  await t.test('composer stats remain on one fully visible line with scroll access and restore native layout', async t => {
    const page = await pageFor(t, { featureMode: 'startup-only' });
    for (const width of [520, 220, 150]) for (const variant of ['semantic', 'legacy', 'pocket']) {
      const result = await page.evaluate(async ({ width, variant }) => {
        api.set({ featureMode: 'startup-only' });
        const root = document.createElement('section');
        root.innerHTML = `<style>.layout-dock{display:flex;flex-wrap:wrap;justify-content:center;width:100%;height:26px;overflow:hidden}.layout-dock [data-slot]{display:flex;flex-wrap:wrap}.layout-dock .group{display:flex;flex-wrap:wrap;width:130px}.layout-dock .metric{display:inline-flex;flex-shrink:0;font:12px/20px Arial;padding:1px 8px}.layout-dock .hNGZaa_label{overflow:hidden}body[data-pocket-stats="off"] [data-mobile-nav="stats"]{display:none!important}</style><div data-slot="main.conversation" style="width:${width}px"><div class="layout-dock ${variant === 'legacy' ? 'GRgSLq_dock' : ''}" ${variant === 'semantic' ? 'data-composer-dock' : variant === 'pocket' ? 'data-mobile-nav="stats"' : ''}><div data-slot="conversation.composer.dock"><div class="group"><span class="metric hNGZaa_anchor"><span class="hNGZaa_label">128.3 tok/s</span></span><span class="metric hNGZaa_anchor"><span class="hNGZaa_label">Cache hit 96%</span></span></div></div><button class="metric A6Bq1a_trigger">Context 83%</button></div></div>`;
        document.body.append(root); const dock = root.querySelector('.layout-dock');
        const read = () => { const b = dock.getBoundingClientRect(), s = getComputedStyle(dock); return { h:b.height, wrap:s.flexWrap, overflow:s.overflowX }; };
        const before = read(); api.set({ featureMode: 'all' }); await paint();
        const b = dock.getBoundingClientRect(); const metrics = [...root.querySelectorAll('.metric')].map(el => { const r = el.getBoundingClientRect(); return { top:r.top, bottom:r.bottom, center:r.top+r.height/2 }; });
        const active = { ...read(), width:b.width, scrollWidth:dock.scrollWidth, clientWidth:dock.clientWidth, top:b.top, bottom:b.bottom, metrics };
        dock.scrollLeft = dock.scrollWidth; const scrollLeft = dock.scrollLeft;
        if (variant === 'pocket') document.body.setAttribute('data-pocket-stats','off');
        const hidden = variant !== 'pocket' || getComputedStyle(dock).display === 'none'; document.body.removeAttribute('data-pocket-stats');
        api.set({ featureMode: 'startup-only' }); await paint(); const restored = read(); root.remove();
        return { before, active, restored, scrollLeft, hidden };
      }, { width, variant });
      assert.equal(result.active.wrap, 'nowrap'); assert.equal(result.active.overflow, 'auto'); assert.ok(result.active.width <= width + 1);
      const center = result.active.metrics[0].center;
      assert.ok(result.active.metrics.every(m => Math.abs(m.center-center) < 1 && m.top >= result.active.top && m.bottom <= result.active.bottom), 'all metrics share one visible baseline');
      if (width < 250) assert.ok(result.scrollLeft > 0, 'last readout can be reached by scrolling');
      assert.ok(result.hidden, 'pocket opt-out remains authoritative'); assert.deepEqual(result.restored, result.before, 'startup-only restores native wrap and clip behavior');
    }
  });
  await t.test('settings share the all-mode shell while startup-only keeps the local SAO fallback', async t => {
    const page = await pageFor(t, { featureMode: 'startup-only', surfaceColor: null });
    const result = await page.evaluate(async () => {
      const native = document.createElement('style'); native.textContent = '.host-fixture{position:relative;isolation:isolate;width:640px;background:rgb(250,250,250);border-radius:8px}.opaque-host{background:white}.host-fixture::before{background:rgb(250,250,250)}'; document.body.append(native);
      const host = document.createElement('article'); host.className='host-fixture'; host.setAttribute('role','dialog'); host.setAttribute('data-shortcut-modal','settings'); host.innerHTML='<section class="opaque-host"><div data-slot="settings.section"><div></div></div></section>';
      const other = document.createElement('article'); other.className='host-fixture'; other.setAttribute('role','dialog'); other.setAttribute('data-shortcut-modal','settings');
      const generic = document.createElement('article'); generic.className='host-fixture'; generic.setAttribute('role','dialog'); document.body.append(host,other,generic);
      const read = el => { const s=getComputedStyle(el), p=getComputedStyle(el,'::before'); return {background:s.backgroundColor,radius:s.borderRadius,filter:p.backdropFilter,fill:p.backgroundColor,shadow:s.boxShadow}; };
      const before=read(other); host.querySelector('[data-slot] > div').append(document.querySelector('#settings')); await paint();
      const startup=read(host), untouched=read(other);
      api.set({featureMode:'all'}); await paint(); const active=read(host), allCategories=read(other), outsideSettings=read(generic), root=getComputedStyle(document.querySelector('[data-sao-settings]'));
      const content={background:root.backgroundColor,filter:root.backdropFilter,shadow:root.boxShadow}; const liquid=host.querySelectorAll(':scope > [data-sao-liquid]').length;
      api.set({windowOpacity:0}); await paint(); const zero=read(host);
      api.set({featureMode:'startup-only'}); await paint(); document.body.append(document.querySelector('#settings')); await paint(); const released=read(host);
      host.remove();other.remove();generic.remove();native.remove(); return {before,startup,untouched,active,allCategories,outsideSettings,content,liquid,zero,released};
    });
    assert.equal(result.startup.radius,'32px'); assert.equal(result.active.radius,'32px');
    assert.match(result.startup.filter,/blur\(24px\)/); assert.match(result.active.filter,/blur\(24px\)/);
    assert.equal(result.active.background,'rgba(0, 0, 0, 0)'); assert.equal(result.content.background,'rgba(0, 0, 0, 0)');
    assert.equal(result.content.filter,'none');assert.equal(result.content.shadow,'none'); assert.equal(result.liquid,0,'host uses a single CSS backdrop, without a second GPU fill');
    assert.equal(result.zero.filter,'none','window transparency endpoint removes host blur');
    assert.deepEqual(result.allCategories,result.active,'every native category shares the shell without mounting SAO');
    assert.notEqual(result.outsideSettings.radius,'32px','generic dialogs do not receive the settings shell');
    assert.deepEqual(result.untouched,result.before,'startup-only preserves other settings'); assert.deepEqual(result.released,result.before,'leaving SAO in startup-only restores its native frame');
  });
  await t.test('all/startup/all invalidates a queued theme request permanently', async t => {
    const page = await pageFor(t, { featureMode: 'all' });
    const result = await page.evaluate(async () => {
      const task = api.setTheme('dark');
      api.set({ featureMode: 'startup-only' }); api.set({ featureMode: 'all' });
      await task; await settleTransitions();
      return { calls: themeCalls, theme: activeTheme, stored: stored(), transitions: nativeTransitions.length, switching: snapshot().switching };
    });
    assert.equal(result.transitions, 0, 'theme changes never capture the full screen'); assert.deepEqual(result.calls, []);
    assert.equal(result.theme, 'light'); assert.equal(result.stored.theme, 'light'); assert.equal(result.switching, false);
  });
  await t.test('a newer native theme request wins without applying the queued older request', async t => {
    const page = await pageFor(t, { featureMode: 'all' });
    const result = await page.evaluate(async () => {
      await Promise.all([api.setTheme('dark'), api.setTheme('system')]); await settleTransitions();
      return { calls: themeCalls, theme: activeTheme, persisted: stored().theme, transitions: nativeTransitions.length };
    });
    assert.equal(result.transitions, 0, 'rapid theme changes avoid full-screen snapshots'); assert.deepEqual(result.calls, ['system']);
    assert.equal(result.theme, 'system'); assert.equal(result.persisted, 'system');
  });
  await t.test('reset respects the mode selected while its theme request is queued', async t => {
    const page = await pageFor(t, { featureMode: 'all' }, 'dark');
    const result = await page.evaluate(async () => {
      const task = api.reset(); api.set({ featureMode: 'startup-only' });
      await task; await settleTransitions();
      return { state: snapshot(), calls: themeCalls, stored: stored(), transitions: nativeTransitions.length };
    });
    assert.equal(result.transitions, 0, 'reset avoids full-screen snapshots'); assertSuspended(result.state);
    assert.deepEqual(result.calls, []); assert.equal(result.stored.featureMode, 'startup-only');
    assert.equal(result.stored.accent, '#FF0000');
  });
  await t.test('reset does not overwrite newer appearance settings while remaining in all mode', async t => {
    const page = await pageFor(t, { featureMode: 'all' }, 'dark');
    const result = await page.evaluate(async () => {
      const task = api.reset(); api.set({ accent: '#654321', fontFamily: 'Arial' });
      await task; await settleTransitions();
      return { current: api.get(), persisted: stored() };
    });
    assert.equal(result.current.accent, '#654321'); assert.equal(result.persisted.accent, '#654321');
    assert.equal(result.current.fontFamily, 'Arial'); assert.equal(result.persisted.fontFamily, 'Arial');
  });
  await t.test('disposing a pending reset cannot persist over a replacement instance', async t => {
    const page = await pageFor(t, { featureMode: 'all' }, 'dark');
    const result = await page.evaluate(async () => {
      const old = api, task = old.reset();
      start({ featureMode: 'startup-only', accent: '#654321', fontFamily: 'Arial' }, 'dark');
      const before = localStorage.getItem('dsh-sao.preferences.v4');
      await task; await settleTransitions();
      return { state: snapshot(), before, after: localStorage.getItem('dsh-sao.preferences.v4'), calls: themeCalls };
    });
    assertSuspended(result.state); assert.equal(result.after, result.before); assert.deepEqual(result.calls, []);
  });
  await t.test('completed reset announces the restored mode to other plugin features', async t => {
    const page = await pageFor(t, { featureMode: 'startup-only' });
    const result = await page.evaluate(async () => {
      await api.reset(); await paint();
      return { mode: api.get().featureMode, persisted: stored().featureMode, events: modeEvents, state: snapshot() };
    });
    assert.equal(result.mode, 'all'); assert.equal(result.persisted, 'all');
    assert.deepEqual(result.events, ['startup-only', 'all']); assert.equal(result.state.styles, 1);
    assert.equal(result.state.inspection.error, null);
  });
  await t.test('conversation-scoped wallpaper renders the nonzero right backdrop without cross-edge blur', async t => {
    const page = await pageFor(t, { featureMode: 'all', wallpaperScope: 'conversation', rightLinked: false, rightGlass: 'frosted', rightOpacity: .65, rightBlur: 18 });
    const result = await page.evaluate(async () => {
      await paint();
      const backdrop = document.querySelector('[data-sao-right-backdrop]');
      return { state: snapshot(), hidden: backdrop.hidden, filter: getComputedStyle(backdrop).backdropFilter, material: backdrop.getAttribute('data-sao-scene-material'), background: getComputedStyle(backdrop).backgroundColor };
    });
    assert.equal(result.state.inspection.error, null, 'material errors are caught by sync, so check the inspector as well as pageerror');
    assert.ok(result.state.inspection.passes > 0); assert.ok(result.state.inspection.bounds.right.width > 0);
    assert.equal(result.hidden, false); assert.equal(result.material, 'frosted'); assert.equal(result.filter, 'none');
    assert.notEqual(result.background, 'rgba(0, 0, 0, 0)');
  });
  await t.test('storage-delivered mode changes clean and restore the external theme', async t => {
    const page = await pageFor(t, { featureMode: 'all' });
    assertSuspended(await page.evaluate(async () => { receiveStorage({ featureMode: 'startup-only' }); await paint(); return snapshot(); }));
    const restored = await page.evaluate(async () => { receiveStorage({ featureMode: 'all' }); await paint(); return snapshot(); });
    assert.equal(restored.styles, 1); assert.equal(restored.accent.toUpperCase(), '#FF0000');
    assert.equal(restored.inspection.error, null);
    assert.deepEqual(await page.evaluate(() => modeEvents), ['all', 'startup-only', 'all']);
  });
  await t.test('startup root and nested dialogs stay free of appearance material while native portals remain managed', async t => {
    const page = await pageFor(t, { featureMode: 'all', windowGlass: 'liquid', windowOpacity: .65 });
    const result = await page.evaluate(async () => {
      const startup = document.createElement('section'); startup.id = 'sao-startup'; startup.setAttribute('role', 'dialog');
      startup.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:transparent';
      startup.innerHTML = '<canvas width="400" height="240"></canvas><section role="dialog" style="width:240px;height:120px">Startup-owned dialog</section>';
      const portal = document.createElement('section'); portal.setAttribute('role', 'dialog');
      portal.style.cssText = 'position:fixed;left:40px;top:60px;width:320px;height:240px'; portal.textContent = 'Normal native portal';
      document.body.append(startup, portal); await paint();
      const read = el => ({ attributes: [...el.attributes].filter(a => /^data-sao-/.test(a.name)).map(a => a.name),
        background: getComputedStyle(el).backgroundColor, before: getComputedStyle(el, '::before').content,
        liquid: el.querySelectorAll('[data-sao-liquid]').length, canvases: el.querySelectorAll('canvas').length });
      const output = { startup: read(startup), nested: read(startup.querySelector('[role="dialog"]')),
        portal: { zone: portal.getAttribute('data-sao-zone'), material: portal.getAttribute('data-sao-material') }, error: snapshot().inspection.error };
      startup.remove(); portal.remove(); return output;
    });
    assert.deepEqual(result.startup.attributes, [], 'startup root never receives material, surface or zone ownership');
    assert.deepEqual(result.nested.attributes, [], 'startup descendant dialogs are excluded by ancestor identity');
    assert.equal(result.startup.background, 'rgba(0, 0, 0, 0)');
    assert.ok(['none', 'normal'].includes(result.startup.before), 'no appearance pseudo-element obscures alpha holes');
    assert.equal(result.startup.liquid, 0, 'no appearance GPU layer is attached to startup');
    assert.equal(result.startup.canvases, 1, 'only the startup-owned canvas remains');
    assert.equal(result.portal.zone, 'window', 'normal native dialog still participates in appearance');
    assert.equal(result.portal.material, 'liquid'); assert.equal(result.error, null);
  });
  await t.test('reset respects a newer startup-only selection delivered from another tab', async t => {
    const page = await pageFor(t, { featureMode: 'all' }, 'dark');
    const result = await page.evaluate(async () => {
      const task = api.reset(); receiveStorage({ featureMode: 'startup-only' });
      await task; await settleTransitions();
      return { state: snapshot(), persisted: stored().featureMode, calls: themeCalls };
    });
    assertSuspended(result.state); assert.equal(result.persisted, 'startup-only'); assert.deepEqual(result.calls, []);
  });
});
