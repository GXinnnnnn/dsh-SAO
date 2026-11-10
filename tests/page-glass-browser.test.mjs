// Real appearance/settings/video/liquid sources, disposable origin, native Edge.
// No live DSH connection, source substitutions, private content or production assets.
// Run: node --test tests/page-glass-browser.test.mjs
// Optional: SAO_TEST_PLAYWRIGHT and SAO_PAGE_GLASS_EVIDENCE override local paths.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
let chromium, dependencyError;
try { ({ chromium } = require(process.env.SAO_TEST_PLAYWRIGHT ?? 'C:/DSH/graduation-office/node_modules/.pnpm/playwright@1.64.0/node_modules/playwright')); }
catch (error) { dependencyError = error.message; }
const source = ['better-sidebar.js', 'liquid-glass.js', 'video-wallpaper.js', 'settings-panel.js', 'appearance.js']
  .map(name => fs.readFileSync(new URL('../source/' + name, import.meta.url), 'utf8')).join('\n');
const evidenceDir = process.env.SAO_PAGE_GLASS_EVIDENCE || 'C:/SAO/releases/1.0.5/page-glass/fixture';
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:100%;height:100%;font-family:Arial;background:#fff}
body{--dsw-alias-bg-base:#f4f6f9;--dsw-alias-label-primary:#16212c;--dsw-alias-label-secondary:#535e6d;--dsw-alias-brand-primary:#8cc8f4;--dsw-alias-bg-layer-1:#f4f6f9;--dsw-alias-border-l2:#d9e0e8}
body[data-ds-dark-theme]{color-scheme:dark;--dsw-alias-bg-base:#191e27;--dsw-alias-label-primary:#edf1f6;--dsw-alias-label-secondary:#adb8c8}
#frame{position:relative;display:flex;width:960px;height:640px}
#conversation-column{width:700px;height:640px}#right-column{width:260px;height:640px}
header{height:48px}[data-slot="main.conversation"]{height:592px}
#right-panel{height:592px}.native-page{position:absolute;inset:0;background:#fff}
#toast{position:fixed;left:180px;top:200px;width:280px;height:120px;z-index:40;border-radius:16px;background:#fff}
#settings{position:fixed;left:980px;top:16px;width:300px;height:300px;overflow:auto}
#settings-host{position:fixed;left:980px;top:16px;width:300px;height:300px;overflow:auto}
</style></head><body><div id="frame">
<div id="conversation-column"><div data-slot="conversation.header"><header></header></div><div id="main" data-slot="main.conversation"></div></div>
<div id="right-column" data-rightbar-col><div data-slot="rightbar"><div data-slot="rightbar.session"><header></header></div><div id="right-panel" data-sidebar-right-panel="push" data-sidebar-right-open></div></div></div>
</div><div id="toast" role="alert" style="--dsh-toast-hold:1" aria-label="Synthetic fixture notification"></div><div id="settings"></div></body></html>`;

function fixture() {
  const effects = [], listeners = new Set(), nativeRAF = requestAnimationFrame.bind(window);
  let activeTheme = 'light', panelCleanup, inspection;
  window.retainedMain = null;
  window.initialToast = document.querySelector('#toast');
  window.work = { draws: 0, frames: 0, geometry: 0, masks: 0 }; window.nativeGPU = null;
  const nativeDraw = WebGL2RenderingContext.prototype.drawArrays;
  WebGL2RenderingContext.prototype.drawArrays = function (...args) {
    if (!nativeGPU) { const debug = this.getExtension('WEBGL_debug_renderer_info'); window.nativeGPU = { version: this.getParameter(this.VERSION), renderer: this.getParameter(debug?.UNMASKED_RENDERER_WEBGL || this.RENDERER) }; }
    work.draws++; return nativeDraw.apply(this, args);
  };
  window.requestAnimationFrame = callback => { work.frames++; return nativeRAF(callback); };
  const nativeRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (...args) {
    if (this.matches('[data-sao-liquid],.sao-preview,.sao-preview *') || this.querySelector(':scope > [data-sao-liquid]')) work.geometry++;
    return nativeRect.apply(this, args);
  };
  const nativeProperty = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (property, ...args) {
    if (/^(?:-webkit-)?mask/.test(property)) work.masks++;
    return nativeProperty.call(this, property, ...args);
  };
  const effect = fn => { const cleanup = fn(); if (typeof cleanup === 'function') effects.push(cleanup); };
  const ctx = {
    effect, get: () => ({}),
    theme: {
      getTheme: () => ({ preference: activeTheme, effective: activeTheme }),
      setTheme(theme) { activeTheme = theme; document.body.toggleAttribute('data-ds-dark-theme', theme === 'dark'); for (const fn of listeners) fn(); }
    },
    on(event, fn) { if (event === 'theme/change') { listeners.add(fn); effects.push(() => listeners.delete(fn)); } },
    slots: { inject() {}, register() {} },
    inject(dependencies, fn) { fn({ effect, get: () => ({ register(definition) { inspection = definition; return () => {}; } }) }); }
  };
  window.paint = async (frames = 4) => { for (let i = 0; i < frames; i++) await new Promise(nativeRAF); };
  window.stop = () => { panelCleanup?.(); panelCleanup = null; for (const cleanup of effects.splice(0).reverse()) cleanup(); };
  window.start = (preferences = {}, theme = 'light') => {
    stop(); ctx.theme.setTheme(theme);
    localStorage.setItem('dsh-sao.preferences.v4', JSON.stringify({ wallpaper: 'builtin-1', glass: 'liquid', opacity: .6, windowOpacity: .5, conversationOpacity: .25, rightLinked: false, rightGlass: 'off', accent: '#8CC8F4', surfaceColor: null, fontFamily: 'Arial', theme, ...preferences }));
    window.api = applySAOAppearance(ctx, {}, [{ id: 'builtin-1', src: '/wallpaper-red.svg' }, { id: 'builtin-2', src: '/wallpaper-blue.svg' }]);
    panelCleanup = mountSAOSettings(document.querySelector('#settings'), api);
  };
  window.scene = mode => {
    const column = document.querySelector('#conversation-column'), main = document.querySelector('#main');
    if (mode === 'removed') {
      window.retainedMain = main; main.remove();
      const page = document.createElement('div'); page.id = 'white-page'; page.className = 'native-page'; column.append(page);
    } else if (mode === 'hidden') main.hidden = true;
    else if (mode === 'visible') { document.querySelector('#white-page')?.remove(); if (retainedMain && !retainedMain.isConnected) column.append(retainedMain); (main || retainedMain).hidden = false; }
  };
  window.materialSnapshot = () => inspection.query('snapshot');
  window.snapshot = (selector = '#toast') => {
    const el = document.querySelector(selector), canvas = el.querySelector(':scope > [data-sao-liquid]'), css = getComputedStyle(el), before = getComputedStyle(el, '::before');
    let ink = null;
    if (canvas && canvas.width && canvas.height) {
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let nonzero = 0; const sums = [0, 0, 0];
      for (let i = 0; i < data.length; i += 4) if (data[i + 3]) { nonzero++; for (let c = 0; c < 3; c++) sums[c] += data[i + c]; }
      ink = { nonzero, width: canvas.width, height: canvas.height, rgb: sums.map(value => value / Math.max(1, nonzero)) };
    }
    const { build, passes, error, wallpaper, bounds } = materialSnapshot();
    return { material: el.getAttribute('data-sao-material'), page: el.getAttribute('data-sao-backdrop'), zone: el.getAttribute('data-sao-zone'), filter: before.backdropFilter, hostFilter: css.backdropFilter, fill: before.backgroundColor, color: css.color, alpha: css.getPropertyValue('--sao-surface-alpha').trim(), canvas: !!canvas, visibleCanvas: !!canvas && !canvas.hidden, ink, gpu: nativeGPU, inspection: { build, passes, error, wallpaper, bounds }, work: { ...work } };
  };
  window.readScreenshot = async base64 => {
    const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0);
    const data = [...context.getImageData(0, 0, canvas.width, canvas.height).data];
    return { width: canvas.width, height: canvas.height, data };
  };
}

function assertPage(state) {
  assert.equal(state.material, 'liquid'); assert.equal(state.zone, 'window');
  assert.equal(state.page, 'page'); assert.equal(state.canvas, false, 'page-backed window owns no GPU canvas');
  assert.equal(state.filter, 'blur(12px)', 'native CSS blurs the actual backing page');
  assert.equal(state.inspection.error, null); assert.equal(state.inspection.build, 'sao-1.0.5');
}
function assertGPU(state) {
  assert.equal(state.page, null); assert.equal(state.material, 'liquid');
  assert.equal(state.visibleCanvas, true, 'conversation has a painted real optical canvas');
  assert.ok(state.ink?.nonzero > 1000, 'native GPU output reaches the visible canvas');
  assert.ok(state.work.draws > 0, 'native WebGL drawArrays executed');
  assert.equal(state.inspection.wallpaper.imageReady, true); assert.equal(state.inspection.error, null);
}
function comparePixels(a, b) {
  assert.equal(a.data.length, b.data.length);
  let maximum = 0, total = 0, changed = 0;
  for (let i = 0; i < a.data.length; i++) { const difference = Math.abs(a.data[i] - b.data[i]); maximum = Math.max(maximum, difference); total += difference; if (difference) changed++; }
  return { maximum, mean: total / a.data.length, changed };
}
function meanRGB(pixels) {
  const sum = [0, 0, 0]; for (let i = 0; i < pixels.data.length; i += 4) for (let c = 0; c < 3; c++) sum[c] += pixels.data[i + c];
  return sum.map(value => value / (pixels.data.length / 4));
}

test('page-backed windows use actual page pixels without losing conversation optics', { skip: dependencyError || false, timeout: 90000 }, async t => {
  const server = http.createServer((request, response) => {
    if (/^\/wallpaper-(red|blue)\.svg$/.test(request.url)) {
      const red = request.url.includes('red');
      response.setHeader('Content-Type', 'image/svg+xml');
      response.end(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640"><rect width="960" height="640" fill="${red ? '#e71c42' : '#086fe8'}"/><path d="M0 0L960 640M-240 0L720 640M240 0L1200 640" stroke="${red ? '#ffbd28' : '#20e8c4'}" stroke-width="80"/></svg>`); return;
    }
    response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  t.after(() => browser.close());
  fs.mkdirSync(evidenceDir, { recursive: true });
  const results = [];
  t.after(() => fs.writeFileSync(path.join(evidenceDir, 'page-glass-results.json'), JSON.stringify(results, null, 2)));
  async function pageFor(t, preferences = {}, theme = 'light') {
    const page = await browser.newPage({ viewport: { width: 1320, height: 740 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    t.after(async () => { try { await page.evaluate(() => stop()); assert.deepEqual(errors, [], 'fixture has no browser errors'); } finally { await page.close(); } });
    await page.goto(`http://127.0.0.1:${server.address().port}`); await page.bringToFront();
    await page.addScriptTag({ content: source + '\n(' + fixture.toString() + ')();' });
    await page.evaluate(({ preferences, theme }) => start(preferences, theme), { preferences, theme });
    await page.waitForFunction(() => materialSnapshot().wallpaper.imageReady);
    await page.evaluate(() => paint(8));
    return page;
  }
  async function capture(page, name, clip = { x: 176, y: 196, width: 288, height: 128 }) {
    const buffer = await page.screenshot({ path: path.join(evidenceDir, name + '.png'), clip });
    return page.evaluate(base64 => readScreenshot(base64), buffer.toString('base64'));
  }
  async function centerPixels(page) {
    const buffer = await page.screenshot({ clip: { x: 220, y: 248, width: 200, height: 40 } });
    return page.evaluate(base64 => readScreenshot(base64), buffer.toString('base64'));
  }
  await t.test('removed conversation forgets old geometry; retained portal returns to current wallpaper GPU', async t => {
    const page = await pageFor(t);
    const conversation = await page.evaluate(() => snapshot()); assertGPU(conversation);
    const conversationPixels = await centerPixels(page); await capture(page, 'conversation-red');
    await page.evaluate(async () => { scene('removed'); await paint(8); });
    const white = await page.evaluate(() => snapshot()); assertPage(white);
    assert.equal(white.inspection.wallpaper.connected, false); assert.deepEqual(white.inspection.wallpaper.imageBounds, { x: 0, y: 0, width: 0, height: 0 });
    assert.equal(await page.locator('[data-sao-wall-frame],[data-sao-wall-column],[data-sao-shell]').count(), 0, 'previous scene markers are removed');
    const whitePixels = await centerPixels(page); await capture(page, 'page-white-red-wallpaper');
    await page.evaluate(async () => { api.set({ wallpaper: 'builtin-2' }); await paint(8); });
    await page.waitForFunction(() => materialSnapshot().wallpaper.imageReady);
    const changedWhite = await page.evaluate(() => snapshot()); assertPage(changedWhite);
    const whiteDifference = comparePixels(whitePixels, await centerPixels(page));
    assert.equal(whiteDifference.maximum, 0, 'white page native screenshot does not import changed conversation wallpaper');
    await capture(page, 'page-white-blue-wallpaper');
    const whiteRGB = meanRGB(whitePixels); assert.ok(whiteRGB.every(value => value > 245), 'white page remains near-white through translucent theme fill');
    await page.evaluate(async () => { scene('visible'); await paint(8); });
    await page.waitForFunction(() => snapshot().visibleCanvas);
    const returned = await page.evaluate(() => snapshot()); assertGPU(returned);
    assert.equal(await page.evaluate(() => document.querySelector('#toast') === initialToast), true, 'the identical portal DOM node survives both route changes');
    assert.ok(Math.abs(conversation.ink.rgb[0] - returned.ink.rgb[0]) > 40, 'GPU canvas itself replaces its red source with current blue source');
    const returnDifference = comparePixels(conversationPixels, await centerPixels(page));
    assert.ok(returnDifference.mean > 15, 'same portal now samples the new blue wallpaper rather than cached red');
    await capture(page, 'conversation-return-blue');
    results.push({ case: 'removed-and-return', conversation, white, changedWhite, returned, whiteDifference, whiteRGB, returnDifference });
  });
  await t.test('retained hidden or styled conversation invalidates and restores without preference changes', async t => {
    const page = await pageFor(t); assertGPU(await page.evaluate(() => snapshot()));
    await page.evaluate(async () => { const wrapper = document.createElement('section'); wrapper.id = 'scene-wrapper'; const main = document.querySelector('#main'); main.before(wrapper); wrapper.append(main); await paint(8); });
    const cases = []; results.push({ case: 'hidden-conversation', cases });
    for (const kind of ['outlet-hidden', 'wrapper-hidden', 'wrapper-aria', 'wrapper-inert', 'wrapper-visibility', 'wrapper-display']) {
      await page.evaluate(async kind => {
        const node = document.querySelector(kind === 'outlet-hidden' ? '#main' : '#scene-wrapper');
        if (kind.endsWith('hidden')) node.hidden = true;
        else if (kind === 'wrapper-aria') node.setAttribute('aria-hidden', 'true');
        else if (kind === 'wrapper-inert') node.inert = true;
        else node.style.setProperty(kind === 'wrapper-visibility' ? 'visibility' : 'display', kind === 'wrapper-visibility' ? 'hidden' : 'none');
        await paint(8);
      }, kind);
      const hidden = await page.evaluate(() => snapshot()); cases.push({ kind, hidden }); assertPage(hidden);
      assert.equal(hidden.inspection.wallpaper.connected, false); assert.equal(hidden.inspection.wallpaper.imageBounds.width, 0);
      await page.evaluate(async () => { for (const node of [document.querySelector('#main'), document.querySelector('#scene-wrapper')]) { node.hidden = false; node.inert = false; node.removeAttribute('aria-hidden'); node.removeAttribute('style'); } await paint(8); });
      assertGPU(await page.evaluate(() => snapshot()));
    }
    await page.evaluate(async () => { document.querySelector('#main').style.display = 'contents'; document.querySelector('#scene-wrapper').style.display = 'contents'; await paint(8); });
    const contents = await page.evaluate(() => snapshot()); assertGPU(contents);
    cases.push({ kind: 'display-contents-positive-control', contents });
  });
  await t.test('occluding dialog, browser pane, partial scene boundary and scoped right use CSS', async t => {
    const page = await pageFor(t); assertGPU(await page.evaluate(() => snapshot()));
    const cases = [];
    for (const kind of ['dialog', 'corner-dialog', 'sao-dialog', 'browser', 'boundary', 'scoped-right']) {
      await page.evaluate(async kind => {
        document.querySelector('#occluder')?.remove();
        const toast = document.querySelector('#toast'); toast.style.left = '180px'; toast.style.top = '200px'; toast.style.width = '280px';
        if (document.querySelector('#settings-host')) { document.body.append(document.querySelector('#settings')); document.querySelector('#settings-host').remove(); }
        api.set({ wallpaperScope: 'full' });
        if (kind === 'dialog' || kind === 'corner-dialog' || kind === 'sao-dialog') {
          const backing = document.createElement('div'); backing.id = kind === 'sao-dialog' ? 'settings-host' : 'occluder';
          backing.setAttribute('role', 'dialog');
          backing.style.cssText = kind === 'corner-dialog' ? 'position:fixed;left:180px;top:200px;width:24px;height:24px;z-index:20;background:white' : 'position:fixed;left:100px;top:120px;width:500px;height:300px;z-index:20;background:white;overflow:hidden';
          if (kind === 'sao-dialog') { backing.setAttribute('data-shortcut-modal', 'settings'); backing.append(document.querySelector('#settings')); }
          document.querySelector('#conversation-column').append(backing);
        } else if (kind === 'browser') {
          // Native Browser topology; appearance assigns all its own SAO markers.
          const section = document.createElement('section'); section.id = 'occluder'; section.setAttribute('data-dockkit-content', '');
          section.style.cssText = 'position:absolute;left:700px;top:48px;width:260px;height:592px';
          section.innerHTML = '<div data-sidebar-right-session style="height:100%"><div data-sidebar-right-tab="browser" style="height:100%"><div class="bZwPEG_root" style="height:100%;background:white"></div></div></div>';
          document.querySelector('#right-panel').append(section); toast.style.left = '710px'; toast.style.width = '230px';
        } else if (kind === 'boundary') toast.style.left = '850px';
        else { toast.style.left = '710px'; toast.style.width = '230px'; api.set({ wallpaperScope: 'conversation' }); }
        await paint(8);
      }, kind);
      const state = await page.evaluate(() => snapshot()); cases.push({ kind, state }); assertPage(state);
      if (kind === 'browser') assert.equal(await page.locator('#occluder[data-sao-browser-pane]').count(), 1, 'real appearance classifier recognizes the native Browser topology');
      if (kind === 'sao-dialog') {
        assert.equal(await page.locator('#settings-host > [data-sao-liquid]').count(), 0, 'SAO settings preserve their single native CSS glass frame');
        assert.equal(await page.locator('#settings-host').getAttribute('data-sao-backdrop'), null, 'SAO settings keep their dedicated classification');
      }
    }
    results.push({ case: 'backing-classification', cases });
  });
  await t.test('dark and custom theme surface pixels remain correct over native page', async t => {
    const cases = [];
    for (const [name, theme, surfaceColor] of [['dark', 'dark', null], ['custom', 'light', '#19A85B']]) {
      const page = await pageFor(t, { surfaceColor }, theme);
      await page.evaluate(async () => { scene('removed'); await paint(8); });
      const state = await page.evaluate(() => snapshot()); assertPage(state);
      assert.equal(state.alpha, '30%');
      const rgb = meanRGB(await centerPixels(page));
      // .6 material x .5 window = .3 local alpha; the actual backing is white.
      const base = surfaceColor ? [25, 168, 91] : [25, 30, 39], accent = [140, 200, 244];
      const expected = base.map((value, i) => (value * .97 + accent[i] * .03) * .3 + 255 * .7);
      assert.ok(rgb.every((value, i) => Math.abs(value - expected[i]) <= 3), name + ' screenshot matches theme fill composed on white: ' + JSON.stringify({ rgb, expected }));
      await capture(page, 'page-white-' + name); cases.push({ name, state, rgb, expected });
    }
    results.push({ case: 'theme-pixels', cases });
  });
  await t.test('zero alpha, frost, off, startup-only and disposal release page material', async t => {
    const page = await pageFor(t);
    await page.evaluate(async () => { scene('removed'); await paint(8); }); assertPage(await page.evaluate(() => snapshot()));
    const states = [];
    for (const [name, patch] of [['zero', { windowOpacity: 0 }], ['frosted', { windowOpacity: .5, glass: 'frosted', opacity: .6 }], ['off', { glass: 'off' }], ['liquid', { glass: 'liquid', opacity: .6 }], ['startup', { featureMode: 'startup-only' }], ['resumed', { featureMode: 'all' }]]) {
      const state = await page.evaluate(async patch => { api.set(patch); await paint(8); return snapshot(); }, patch); states.push({ name, state });
      assert.equal(state.canvas, false);
      if (name === 'zero') {
        assert.equal(state.filter, 'none'); assert.equal(state.hostFilter, 'none'); assert.equal(state.alpha, '0%');
        assert.deepEqual(meanRGB(await centerPixels(page)), [255, 255, 255], 'zero alpha native pixels equal the untouched white page');
      }
      if (name === 'frosted') { assert.equal(state.material, 'frosted'); assert.equal(state.hostFilter, 'blur(12px)'); }
      if (name === 'off' || name === 'startup') { assert.equal(state.material, null); assert.equal(state.page, null); }
      if (name === 'liquid' || name === 'resumed') assertPage(state);
    }
    await page.evaluate(async () => { stop(); await paint(8); });
    const leftovers = await page.locator('[data-sao-material],[data-sao-backdrop],[data-sao-liquid],[data-sao-wallpaper],style[data-sao-appearance],style[data-sao-palette]').count();
    results.push({ case: 'mode-and-disposal', states, leftovers }); assert.equal(leftovers, 0, 'dispose removes every owned material/backdrop marker and canvas');
  });
  await t.test('native settings scrolling adds no material work; idle scene has no animation loop', async t => {
    const page = await pageFor(t); assertGPU(await page.evaluate(() => snapshot()));
    const runs = [];
    for (const hosted of [false, true]) {
      await page.evaluate(async hosted => {
        const settings = document.querySelector('#settings');
        if (hosted) { const host = document.createElement('section'); host.id = 'settings-host'; host.setAttribute('role', 'dialog'); host.setAttribute('data-shortcut-modal', 'settings'); document.body.append(host); host.append(settings); settings.style.cssText = 'position:static;width:auto;height:auto;overflow:visible'; }
        await paint(10);
      }, hosted);
      const result = await page.evaluate(async hosted => {
        const container = document.querySelector(hosted ? '#settings-host' : '#settings'), events = [];
        const capture = event => { if (event.target === container) events.push({ trusted: event.isTrusted, phase: event.eventPhase }); };
        document.addEventListener('scroll', capture, { capture: true });
        const max = container.scrollHeight - container.clientHeight, beforePasses = materialSnapshot().passes, before = { ...work };
        try {
          for (const fraction of [.2, .6, 1, .4, 0]) { container.scrollTo({ top: Math.round(max * fraction), behavior: 'instant' }); await paint(4); }
          const after = { ...work }, passes = materialSnapshot().passes - beforePasses;
          const idleBefore = { ...work }; await paint(12); const idleAfter = { ...work };
          return { hosted, max, events, before, after, passes, idleBefore, idleAfter, error: materialSnapshot().error };
        } finally { document.removeEventListener('scroll', capture, true); }
      }, hosted);
      runs.push(result); assert.ok(result.max > 300); assert.equal(result.events.length, 5);
      assert.ok(result.events.every(event => event.trusted && event.phase === 1));
      assert.equal(result.passes, 0, 'native local settings scroll does not run material sync');
      assert.deepEqual(result.after, result.before, 'settings scroll adds no GPU draw, geometry read, mask write or frame request');
      assert.deepEqual(result.idleAfter, result.idleBefore, 'static materials have no animation loop'); assert.equal(result.error, null);
    }
    const positive = await page.evaluate(async () => {
      const scroll = document.createElement('section'); scroll.id = 'optical-scroll';
      scroll.style.cssText = 'position:fixed;left:180px;top:380px;width:280px;height:120px;overflow:auto';
      scroll.innerHTML = '<div style="height:700px"><div id="scroll-tooltip" role="tooltip" style="width:240px;height:100px"></div></div>';
      document.body.append(scroll); await paint(10);
      const before = { ...work }; scroll.scrollTo({ top: 20, behavior: 'instant' }); await paint(8);
      return { before, after: { ...work }, surface: snapshot('#scroll-tooltip') };
    });
    assertGPU(positive.surface);
    assert.ok(positive.after.geometry > positive.before.geometry && positive.after.draws > positive.before.draws, 'native scroll of a real optical ancestor still remeasures and redraws');
    results.push({ case: 'performance', runs, positive });
  });
});
