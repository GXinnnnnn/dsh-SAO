// Actual appearance/settings/liquid sources in native Edge on a disposable origin.
// Native topology/classes come from settings-shell/shell-inventory.json, not CSS under test.
// No installed plugin, live GUI, build or private account data is used.
// Optional: SAO_TEST_PLAYWRIGHT, SAO_TEST_BROWSER, SAO_SETTINGS_SHELL_EVIDENCE.
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
const evidenceRoot = process.env.SAO_SETTINGS_SHELL_EVIDENCE || 'C:/SAO/releases/1.0.5/settings-shell/fixture';
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:100%;height:100%;font:14px Arial;color:var(--dsw-alias-label-primary)}
body{--dsw-alias-bg-base:#f5f7fa;--dsw-alias-bg-layer-1:#fff;--dsw-alias-bg-layer-2:#fff;--dsw-alias-bg-layer-3:#fff;--dsw-alias-label-primary:#0f1115;--dsw-alias-label-secondary:#535e6d;--dsw-alias-brand-primary:#8cc8f4;--dsw-alias-label-on-brand:#182b40;--dsw-alias-state-warn-primary:#b45309;--dsw-alias-markdown-code-block:#e8eaf2;background:repeating-linear-gradient(105deg,#075985 0 60px,#c084fc 60px 120px,#fb923c 120px 180px)}
body[data-ds-dark-theme]{color-scheme:dark;--dsw-alias-bg-base:#191e27;--dsw-alias-label-primary:#edf1f6;--dsw-alias-label-secondary:#adb8c8;--dsw-alias-state-warn-primary:#fbbf24;--dsw-alias-markdown-code-block:#172033}
.AnXs9G_panel{position:fixed;left:80px;top:50px;width:1000px;height:700px;box-sizing:border-box;margin:0;padding:0;display:grid;grid-template-columns:188px 1fr;grid-template-rows:54px 1fr;border:1px solid #8090a0;border-radius:8px;isolation:isolate;overflow:hidden;background:rgb(250,250,250)}
.AnXs9G_panel::before{content:"";position:absolute;inset:0;z-index:-1;background:var(--dsw-alias-bg-layer-1);backdrop-filter:blur(12px);border-radius:inherit}
.AnXs9G_navTitle{grid-column:1;grid-row:1;padding:18px}.AnXs9G_nav{grid-column:1;grid-row:2;padding:8px;overflow:auto}
.AnXs9G_navCell{display:block;width:100%;min-height:44px;text-align:left;padding:10px;border:1px solid transparent;border-radius:8px;background:transparent;color:inherit;font:inherit}
.AnXs9G_navCell[aria-current=true]{background:#ddd;color:var(--dsw-alias-label-primary)}
.AnXs9G_options{grid-column:2;grid-row:1/3;padding:24px;overflow:auto;background:#fff}
[data-slot="settings.section"]{display:contents}.AnXs9G_options>[data-slot]>:is(div,section){min-height:100%;background:white}
.native-heading{margin:0 0 24px;font-size:23px}.native-card{margin:0 0 20px;list-style:none;padding:20px;border:1px solid #9ba4b133;border-radius:14px;background:var(--dsw-alias-bg-layer-1)}
.Wsg8iW_card{background:var(--dsw-alias-settings-card-fill,transparent)}.Wsg8iW_card.Wsg8iW_cardActive{background:var(--dsw-alias-bg-module-platform,#e6e8ec)}.vr-ia-plugin-card,._2vuxea_group{background:var(--dsw-alias-bg-layer-3)}.VqXecW_installedSkeletonCard,._wrap_14sgc_1.VqXecW_homeSearch{background:var(--dsw-alias-bg-layer-1)}
.native-card label{display:block;margin-bottom:12px}.native-card input,.native-card textarea{font:inherit;color:inherit;padding:8px;border:1px solid #9ba4b1;border-radius:8px;background:var(--dsw-alias-bg-layer-2)}
.native-secondary{color:var(--dsw-alias-label-secondary)}.native-warning{color:var(--dsw-alias-state-warn-primary);background:#b453091a}.native-code{color:#7c3aed;background:var(--dsw-alias-markdown-code-block);padding:12px}
button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid var(--dsw-alias-brand-primary);outline-offset:2px}.native-spacer{height:900px}.mobile-inner{padding:20px}.native-qr{width:100px;height:100px;background:#fff;color:#000}
.nUhMVa_stickyHead{position:sticky;top:0;z-index:1;min-height:70px;background:var(--dsw-alias-bg-base)}.nUhMVa_stickyHead::before{content:"";position:absolute;inset:0;z-index:-1;background:var(--dsw-alias-bg-base)}
#generic,#account{position:fixed;left:1110px;top:100px;width:150px;height:100px;border-radius:11px;background:#eee}#account{top:240px;border-radius:13px}
</style></head><body><div id="native-host" class="AnXs9G_panel" role="dialog" data-shortcut-modal="settings" aria-label="Settings"><div class="AnXs9G_navTitle">Settings</div><nav class="AnXs9G_nav" aria-label="Settings categories"><div class="AnXs9G_navList"></div></nav><div class="AnXs9G_options"><div data-slot="settings.section"></div></div></div><div id="generic" role="dialog" aria-label="Unrelated dialog"></div><div id="account" role="menu" data-menu-material aria-label="Account menu"></div></body></html>`;

function fixture() {
  const effects = [], listeners = new Set(), nativeRAF = requestAnimationFrame.bind(window);
  let activeTheme = 'light', panelCleanup, inspection;
  window.work = { draws: 0, updates: 0, previewGeometry: 0 };
  const draw = WebGL2RenderingContext.prototype.drawArrays;
  WebGL2RenderingContext.prototype.drawArrays = function (...args) { work.draws++; return draw.apply(this, args); };
  const createLiquid = createSAOLiquidGlass;
  createSAOLiquidGlass = function (...args) {
    const liquid = createLiquid(...args), update = liquid.update;
    liquid.update = function (...options) { work.updates++; return update.apply(this, options); };
    return liquid;
  };
  const rect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (...args) { if (this.closest('.sao-preview')) work.previewGeometry++; return rect.apply(this, args); };
  const effect = fn => { const cleanup = fn(); if (typeof cleanup === 'function') effects.push(cleanup); };
  const ctx = {
    effect, get: () => ({}),
    theme: { getTheme: () => ({ preference: activeTheme, effective: activeTheme }), setTheme(theme) { activeTheme = theme; document.body.toggleAttribute('data-ds-dark-theme', theme === 'dark'); for (const fn of listeners) fn(); } },
    on(event, fn) { if (event === 'theme/change') { listeners.add(fn); effects.push(() => listeners.delete(fn)); } },
    slots: { inject() {}, register() {} },
    inject(dependencies, fn) { fn({ effect, get: () => ({ register(definition) { inspection = definition; return () => {}; } }) }); }
  };
  window.paint = async (frames = 6) => { for (let i = 0; i < frames; i++) await new Promise(nativeRAF); };
  window.stop = () => { panelCleanup?.(); panelCleanup = null; for (const cleanup of effects.splice(0).reverse()) cleanup(); };
  window.start = (preferences = {}, theme = 'light') => {
    stop(); ctx.theme.setTheme(theme);
    localStorage.setItem('dsh-sao.preferences.v4', JSON.stringify({ featureMode: 'all', wallpaper: 'none', glass: 'liquid', opacity: .8, windowOpacity: 1, accent: '#8CC8F4', surfaceColor: null, fontFamily: 'Arial', theme, ...preferences }));
    window.api = applySAOAppearance(ctx, {}, []);
  };
  window.materialSnapshot = () => inspection.query('snapshot');
  const categories = ['General', 'Agents', 'Skins', 'Plugins', 'Sidebar', 'Vision', 'Mobile', 'SAO'];
  const nav = document.querySelector('.AnXs9G_navList');
  for (const name of categories) { const button = document.createElement('button'); button.className = 'AnXs9G_navCell'; button.textContent = name; button.onclick = () => showCategory(name); nav.append(button); }
  window.showCategory = name => {
    panelCleanup?.(); panelCleanup = null;
    for (const button of nav.children) button.setAttribute('aria-current', String(button.textContent === name));
    const outlet = document.querySelector('[data-slot="settings.section"]'); outlet.replaceChildren();
    const root = document.createElement(name === 'Sidebar' ? 'section' : 'div'); outlet.append(root);
    if (name === 'SAO') { panelCleanup = mountSAOSettings(root, api); return; }
    const card = name === 'Agents' ? 'li class="native-card Wsg8iW_card Wsg8iW_cardActive"' : name === 'Vision' ? 'li class="native-card vr-ia-plugin-card"' : name === 'Skins' ? 'article class="native-card VqXecW_installedSkeletonCard"' : name === 'Sidebar' ? 'div class="native-card _2vuxea_group"' : 'div class="native-card"';
    root.innerHTML = `<h2 class="native-heading">${name}</h2>${name === 'Skins' ? '<span class="_wrap_14sgc_1 VqXecW_homeSearch native-card">Search skins</span>' : ''}<${card}><label>Native name <input aria-label="Native name" value="Editable"></label><label><input type="checkbox" aria-label="Native enabled"> Enabled</label><p class="native-secondary">Native supporting text</p><p class="native-warning">Warning keeps its semantic color</p><pre class="native-code">const meaning = true;</pre><textarea aria-label="Native module field" style="background:var(--dsw-alias-bg-module-platform,#e6e8ec)">Native field</textarea></${card.split(' ')[0]}><div class="native-spacer"></div><button id="last-control">Last native control</button>`;
    if (name === 'Plugins') {
      const header = document.createElement('header'); header.className = 'nUhMVa_stickyHead'; header.innerHTML = '<strong>Plugin market</strong><br><span class="_wrap_14sgc_1 nUhMVa_searchInput">Search plugins</span>'; root.prepend(header);
    }
    if (name === 'Mobile') {
      root.style.background = 'var(--dsw-alias-bg-layer-1)';
      const inner = document.createElement('div'); inner.className = 'mobile-inner'; inner.style.background = 'var(--dsw-alias-bg-layer-2,#f3f4f6)';
      inner.append(...root.childNodes); root.append(inner);
      const qr = document.createElement('div'); qr.className = 'native-qr'; qr.textContent = 'QR'; inner.prepend(qr);
    }
    document.querySelector('.AnXs9G_options').scrollTop = 0;
  };
  window.styleOf = (element, pseudo = null) => {
    const css = getComputedStyle(element, pseudo), canvas = document.createElement('canvas'), context = canvas.getContext('2d');
    const rgba = value => { context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]; };
    return { background: css.backgroundColor, rgba: rgba(css.backgroundColor), image: css.backgroundImage, radius: css.borderTopLeftRadius, filter: css.backdropFilter, shadow: css.boxShadow, color: css.color, ink: rgba(css.color), outlineWidth: css.outlineWidth, outlineStyle: css.outlineStyle };
  };
  window.shellSnapshot = () => {
    const host = document.querySelector('#native-host');
    return { host: styleOf(host), before: styleOf(host, '::before'), liquid: host.querySelectorAll('[data-sao-liquid]').length, material: host.getAttribute('data-sao-material'), page: host.getAttribute('data-sao-backdrop') };
  };
  window.contentSnapshot = () => {
    const outlet = document.querySelector('[data-slot="settings.section"]'), root = outlet.firstElementChild;
    return { options: styleOf(outlet.parentElement), root: styleOf(root), nested: root.querySelector('.mobile-inner') ? styleOf(root.querySelector('.mobile-inner')) : null, qr: root.querySelector('.native-qr') ? styleOf(root.querySelector('.native-qr')) : null, sticky: root.querySelector('.nUhMVa_stickyHead') ? styleOf(root.querySelector('.nUhMVa_stickyHead')) : null, stickyBefore: root.querySelector('.nUhMVa_stickyHead') ? styleOf(root.querySelector('.nUhMVa_stickyHead'), '::before') : null, cards: [...root.querySelectorAll('.native-card')].map(el => styleOf(el)), field: styleOf(root.querySelector('textarea')), secondary: styleOf(root.querySelector('.native-secondary')), warning: styleOf(root.querySelector('.native-warning')), code: styleOf(root.querySelector('.native-code')), current: styleOf(nav.querySelector('[aria-current=true]')), other: styleOf(nav.querySelector('[aria-current=false]')) };
  };
  window.counters = () => ({ ...work, passes: materialSnapshot().passes });
  window.readScreenshot = async base64 => {
    const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0);
    return [...context.getImageData(0, 0, canvas.width, canvas.height).data];
  };
  showCategory('General');
}
function assertShell(state, { blur = true } = {}) {
  assert.equal(state.host.radius, '32px'); assert.equal(state.host.rgba[3], 0);
  if (blur) assert.match(state.before.filter, /blur\(24px\)/); else assert.equal(state.before.filter, 'none');
  assert.ok(state.before.rgba[3] > 0 && state.before.rgba[3] < 255, 'one translucent host tint');
  assert.equal(state.liquid, 0, 'settings host and native cards own no GPU canvas');
  assert.equal(state.material, null, 'dedicated shell remains outside generic materials'); assert.equal(state.page, null);
}
function pixelMean(data) { return [0, 1, 2].map(c => data.filter((_, i) => i % 4 === c).reduce((sum, v) => sum + v, 0) / (data.length / 4)); }
function pixelDifference(a, b) { return a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length; }

test('native settings categories retain the accepted SAO soft glass shell', { skip: dependencyError || false, timeout: 90000 }, async t => {
  const server = http.createServer((request, response) => { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await chromium.launch({ ...(process.env.SAO_TEST_BROWSER ? { executablePath: process.env.SAO_TEST_BROWSER } : { channel: 'msedge' }), headless: true });
  t.after(() => browser.close());
  const evidenceDir = path.join(evidenceRoot, new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(evidenceDir, { recursive: true });
  const results = [];
  t.after(() => fs.writeFileSync(path.join(evidenceDir, 'results.json'), JSON.stringify(results, null, 2)));
  async function pageFor(t, preferences = {}, theme = 'light', tag = 'div', defer = false) {
    const page = await browser.newPage({ viewport: { width: 1300, height: 820 }, reducedMotion: 'reduce' }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    t.after(async () => { try { await page.evaluate(() => stop()); assert.deepEqual(errors, [], 'no browser exceptions or caught material errors'); } finally { await page.close(); } });
    await page.goto(`http://127.0.0.1:${server.address().port}`); await page.bringToFront();
    if (tag === 'dialog') await page.evaluate(() => { const old = document.querySelector('#native-host'), dialog = document.createElement('dialog'); for (const attr of old.attributes) if (attr.name !== 'role') dialog.setAttribute(attr.name, attr.value); dialog.open = true; dialog.append(...old.childNodes); old.replaceWith(dialog); });
    await page.addScriptTag({ content: source + '\n(' + fixture.toString() + ')();' });
    if (!defer) { await page.evaluate(({ preferences, theme }) => start(preferences, theme), { preferences, theme }); await page.evaluate(() => paint()); }
    return page;
  }
  async function pixels(page, name) {
    // Empty strip above category content: sees shell paint without glyph or card pixels.
    const image = await page.screenshot({ path: path.join(evidenceDir, name + '.png'), clip: { x: 600, y: 54, width: 120, height: 14 } });
    return page.evaluate(base64 => readScreenshot(base64), image.toString('base64'));
  }
  await t.test('div role and native dialog are styled before SAO ever mounts and survive its unmount', async t => {
    for (const tag of ['div', 'dialog']) {
      const page = await pageFor(t, {}, 'light', tag);
      assert.equal(await page.locator('[data-sao-settings]').count(), 0);
      const first = await page.evaluate(() => shellSnapshot()); assertShell(first);
      const before = await pixels(page, tag + '-never-opened');
      await page.getByRole('button', { name: 'SAO', exact: true }).click(); await page.evaluate(() => paint());
      const mounted = await page.evaluate(() => shellSnapshot()); assertShell(mounted); assert.deepEqual(mounted, first);
      const content = await page.evaluate(() => { const root = document.querySelector('[data-sao-settings]'); return { root: styleOf(root), preview: styleOf(root.querySelector('.sao-preview')) }; });
      assert.equal(content.root.rgba[3], 0); assert.equal(content.root.filter, 'none'); assert.equal(content.root.shadow, 'none'); assert.equal(content.preview.filter, 'none');
      await page.getByRole('button', { name: 'Agents', exact: true }).click(); await page.evaluate(() => paint());
      const after = await page.evaluate(() => shellSnapshot()); assert.deepEqual(after, first);
      assert.equal(await page.locator('[data-sao-settings]').count(), 0);
      const unmounted = await pixels(page, tag + '-after-unmount'); assert.equal(pixelDifference(before, unmounted), 0, 'the same shell pixels survive category replacement');
      results.push({ case: 'lifecycle', tag, first, mounted, after, pixels: pixelMean(before) });
    }
  });
  await t.test('light and dark arbitrary accents and custom surfaces repaint the same native shell', async t => {
    const page = await pageFor(t); const cases = [];
    for (const [theme, accent, surfaceColor] of [['light', '#D14D83', null], ['dark', '#27D5B0', null], ['light', '#6719D8', '#F1E4D8'], ['dark', '#E2B943', '#172C31']]) {
      await page.evaluate(async ({ theme, accent, surfaceColor }) => { await api.setTheme(theme); api.set({ accent, surfaceColor }); await paint(); }, { theme, accent, surfaceColor });
      const first = await page.evaluate(() => shellSnapshot()); assertShell(first);
      const nativePixels = await pixels(page, 'theme-' + cases.length + '-native');
      await page.screenshot({ path: path.join(evidenceDir, 'theme-' + cases.length + '-full.png') });
      await page.getByRole('button', { name: 'SAO', exact: true }).click(); await page.evaluate(() => paint());
      assert.deepEqual(await page.evaluate(() => shellSnapshot()), first);
      assert.equal(pixelDifference(nativePixels, await pixels(page, 'theme-' + cases.length + '-sao')), 0);
      await page.getByRole('button', { name: 'General', exact: true }).click(); await page.evaluate(() => paint());
      cases.push({ theme, accent, surfaceColor, first, pixels: pixelMean(nativePixels) });
    }
    for (let i = 1; i < cases.length; i++) assert.ok(cases[i].pixels.some((value, c) => Math.abs(value - cases[i - 1].pixels[c]) > 3), 'theme, accent and custom surface changes reach actual pixels');
    results.push({ case: 'theme-surface-paint', cases });
  });
  await t.test('liquid, frosted and off preserve the shell, and zero window opacity removes its blur', async t => {
    const page = await pageFor(t), baseline = await page.evaluate(() => shellSnapshot());
    for (const glass of ['frosted', 'off', 'liquid']) {
      await page.evaluate(async glass => { api.set({ glass, opacity: .8 }); await paint(); }, glass);
      const state = await page.evaluate(() => shellSnapshot()); assertShell(state, { blur: glass !== 'off' });
      const expected = structuredClone(baseline); if (glass === 'off') expected.before.filter = 'none';
      assert.deepEqual(state, expected, glass + ' preserves shell tint and shape while respecting the blur choice');
      await page.getByRole('button', { name: 'SAO', exact: true }).click(); await page.evaluate(() => paint());
      assert.deepEqual(await page.evaluate(() => shellSnapshot()), state, glass + ' matches the local SAO shell');
      await page.getByRole('button', { name: 'General', exact: true }).click(); await page.evaluate(() => paint());
      assert.deepEqual(await page.evaluate(() => shellSnapshot()), state, glass + ' persists after unmount');
    }
    await page.evaluate(async () => { api.set({ windowOpacity: 0 }); await paint(); });
    const zero = await page.evaluate(() => shellSnapshot()); assert.equal(zero.before.filter, 'none'); assert.equal(zero.before.rgba[3], 0); assert.equal(zero.liquid, 0);
    await page.evaluate(async () => { api.set({ windowOpacity: 1 }); await paint(); }); assert.deepEqual(await page.evaluate(() => shellSnapshot()), baseline);
    results.push({ case: 'materials-and-zero', baseline, zero });
  });
  await t.test('startup-only preserves other native settings, local SAO fallback releases, dispose restores native CSS', async t => {
    const page = await pageFor(t, {}, 'light', 'div', true);
    const original = await page.evaluate(() => ({ shell: shellSnapshot(), content: contentSnapshot(), generic: styleOf(document.querySelector('#generic')), account: styleOf(document.querySelector('#account')) }));
    await page.evaluate(async () => { start({ featureMode: 'startup-only' }); await paint(); });
    assert.deepEqual(await page.evaluate(() => shellSnapshot()), original.shell); assert.deepEqual(await page.evaluate(() => contentSnapshot()), original.content);
    await page.getByRole('button', { name: 'SAO', exact: true }).click(); await page.evaluate(() => paint()); assertShell(await page.evaluate(() => shellSnapshot()));
    await page.getByRole('button', { name: 'General', exact: true }).click(); await page.evaluate(() => paint()); assert.deepEqual(await page.evaluate(() => shellSnapshot()), original.shell);
    await page.evaluate(async () => { api.set({ featureMode: 'all' }); await paint(); }); assertShell(await page.evaluate(() => shellSnapshot()));
    const controls = await page.evaluate(() => ({ generic: styleOf(document.querySelector('#generic')), account: styleOf(document.querySelector('#account')) }));
    assert.notEqual(controls.generic.radius, '32px'); assert.notEqual(controls.account.radius, '32px');
    assert.doesNotMatch(controls.generic.filter, /24px/); assert.doesNotMatch(controls.account.filter, /24px/);
    await page.evaluate(async () => { stop(); await paint(); });
    assert.deepEqual(await page.evaluate(() => ({ shell: shellSnapshot(), content: contentSnapshot(), generic: styleOf(document.querySelector('#generic')), account: styleOf(document.querySelector('#account')) })), original, 'dispose restores the native host, roots, cards, navigation and unrelated surfaces');
    results.push({ case: 'startup-and-dispose', original, controls });
  });
  await t.test('native category roots are clear, neutral cards lightly tinted, semantic warning and code unchanged', async t => {
    const page = await pageFor(t, {}, 'light', 'div', true); const cases = [];
    for (const theme of ['light', 'dark']) {
      for (const name of ['General', 'Agents', 'Skins', 'Plugins', 'Sidebar', 'Vision', 'Mobile']) {
        await page.evaluate(async ({ name, theme }) => { stop(); document.body.toggleAttribute('data-ds-dark-theme', theme === 'dark'); showCategory(name); await paint(); }, { name, theme });
        const before = await page.evaluate(() => contentSnapshot());
        await page.evaluate(async theme => { start({}, theme); await paint(); }, theme);
        const active = await page.evaluate(() => contentSnapshot());
        assert.equal(active.options.rgba[3], 0, name + ' options transparent'); assert.equal(active.root.rgba[3], 0, name + ' category root transparent');
        if (active.nested) { assert.ok(active.nested.rgba[3] > 0 && active.nested.rgba[3] < 128, 'nested mobile panel follows the translucent layer token'); assert.deepEqual(active.qr, before.qr, 'QR keeps its opaque scanning surface'); }
        for (const card of active.cards) { assert.ok(card.rgba[3] > 0 && card.rgba[3] < 128, name + ' card is a light translucent tint'); assert.equal(card.filter, 'none', 'no per-card blur'); }
        assert.ok(active.field.rgba[3] > 0 && active.field.rgba[3] < 128, name + ' native module field receives a light theme tint'); assert.equal(active.field.filter, 'none');
        assert.deepEqual(active.warning, before.warning, name + ' warning keeps semantic paint'); assert.deepEqual(active.code, before.code, name + ' code keeps semantic paint');
        assert.ok(active.current.rgba[3] > 0 && active.current.rgba[3] < 128, 'selected category has a light tint'); assert.notDeepEqual(active.current.rgba, active.other.rgba, 'selected category remains visible');
        const shell = await page.evaluate(() => shellSnapshot()); assertShell(shell);
        if (active.sticky) {
          for (const layer of [active.sticky, active.stickyBefore]) {
            assert.equal(layer.rgba[3], 255, 'sticky header keeps an opaque scroll mask'); assert.equal(layer.filter, 'none', 'sticky header adds no blur');
            for (let c = 0; c < 3; c++) assert.ok(Math.abs(layer.rgba[c] - shell.before.rgba[c]) <= 3, 'sticky mask follows the host tint instead of native white');
          }
          const header = page.locator('.nUhMVa_stickyHead');
          const sample = async suffix => {
            const box = await header.boundingBox();
            const png = await page.screenshot({ path: path.join(evidenceDir, theme + '-plugins-mask-' + suffix + '.png'), clip: { x: Math.floor(box.x + box.width - 70), y: Math.ceil(box.y + 12), width: 32, height: 16 } });
            return page.evaluate(base64 => readScreenshot(base64), png.toString('base64'));
          };
          const maskBefore = await sample('before'), workBefore = await page.evaluate(() => counters());
          await page.locator('.AnXs9G_options').evaluate(el => { el.scrollTop = 300; }); await page.evaluate(() => paint());
          assert.ok(await page.locator('.AnXs9G_options').evaluate(el => el.scrollTop) > 0);
          assert.equal(pixelDifference(maskBefore, await sample('after')), 0, 'scrolling content cannot bleed through the opaque sticky mask');
          assert.deepEqual(await page.evaluate(() => counters()), workBefore, 'sticky header scroll adds no material/GPU work');
        }
        if (name === 'Agents' || name === 'Mobile' || name === 'Plugins') await page.screenshot({ path: path.join(evidenceDir, theme + '-' + name.toLowerCase() + '-content.png') });
        cases.push({ theme, name, before, active });
      }
    }
    results.push({ case: 'native-category-content', cases });
  });
  await t.test('native keyboard, focus and editing survive category changes without material or GPU work', async t => {
    for (const theme of ['light', 'dark']) {
    const page = await pageFor(t, {}, theme);
    const name = page.getByRole('textbox', { name: 'Native name', exact: true });
    await name.focus(); await page.keyboard.press('Control+A'); await page.keyboard.type('Keyboard value'); assert.equal(await name.inputValue(), 'Keyboard value');
    await page.keyboard.press('Tab'); const enabled = page.getByRole('checkbox', { name: 'Native enabled' }); assert.equal(await enabled.evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Space'); assert.equal(await enabled.isChecked(), true);
    const focus = await enabled.evaluate(el => ({ visible: el.matches(':focus-visible'), width: getComputedStyle(el).outlineWidth, style: getComputedStyle(el).outlineStyle }));
    assert.equal(focus.visible, true); assert.ok(parseFloat(focus.width) >= 2); assert.equal(focus.style, 'solid');
    const baseline = await page.evaluate(() => counters());
    for (let i = 0; i < 18; i++) {
      const button = page.getByRole('button', { name: ['Agents', 'Vision', 'General'][i % 3], exact: true });
      await button.focus(); await page.keyboard.press('Enter');
      await page.locator('.AnXs9G_options').hover(); await page.mouse.wheel(0, 440); await page.evaluate(() => paint(2));
    }
    await page.evaluate(() => paint()); const after = await page.evaluate(() => counters());
    assert.deepEqual(after, baseline, 'native category replacement and scroll add zero liquid updates, draws, preview reads or material passes after initial settle');
    assert.ok(await page.locator('.AnXs9G_options').evaluate(el => el.scrollTop) > 0, 'native scroll really moved');
    await page.getByRole('button', { name: 'SAO', exact: true }).click(); await page.evaluate(() => paint());
    const previewBaseline = await page.evaluate(() => counters());
    await page.locator('.AnXs9G_options').hover(); await page.mouse.wheel(0, 500); await page.evaluate(() => paint());
    assert.deepEqual(await page.evaluate(() => counters()), previewBaseline, 'local SAO preview adds no material or GPU work on native host scroll');
    results.push({ case: 'keyboard-scroll-cost', theme, focus, baseline, after, previewBaseline });
    }
  });
});
