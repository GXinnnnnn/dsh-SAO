// Real settings + appearance APIs in the existing minimal ctx fixture, isolated
// from the user's GUI. Owned headless Edge/CDP; no account/session access.
// Run: node --test tests/settings-style-browser.mjs
// Optional: SAO_TEST_PLAYWRIGHT and SAO_SETTINGS_SCREENSHOTS override local paths.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
let chromium, dependencyError;
try { ({ chromium } = require(process.env.SAO_TEST_PLAYWRIGHT ?? 'C:/DSH/graduation-office/node_modules/.pnpm/playwright@1.64.0/node_modules/playwright')); }
catch (error) { dependencyError = error.message; }
const source = ['better-sidebar.js', 'liquid-glass.js', 'video-wallpaper.js', 'settings-panel.js', 'appearance.js', 'control-states.js']
  .map(name => fs.readFileSync(new URL('../source/' + name, import.meta.url), 'utf8')).join('\n');
const screenshotDir = process.env.SAO_SETTINGS_SCREENSHOTS || path.join(os.tmpdir(), 'sao-settings-tint-verification');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;font-family:system-ui;background-color:var(--dsw-alias-bg-base);background-image:linear-gradient(color-mix(in srgb,var(--dsw-alias-bg-base) 55%,transparent),color-mix(in srgb,var(--dsw-alias-bg-base) 55%,transparent)),url(/assets/wallpapers/1.webp);background-size:cover;background-position:center;background-attachment:fixed;color:var(--dsw-alias-label-primary)}
#settings{padding:16px}@media(max-width:720px){#settings{padding:8px}}
body{--dsw-alias-label-primary:#20252c;--dsw-alias-label-secondary:#535e6d;--dsw-alias-bg-base:#fcfdff;--dsw-alias-bg-layer-1:#f4f6f9;--dsw-alias-border-l2:#d9e0e8;--dsw-alias-brand-primary:#8cc8f4;--dsw-alias-label-on-brand:#182b40}
body[data-ds-dark-theme]{color-scheme:dark;--dsw-alias-label-primary:#edf1f6;--dsw-alias-label-secondary:#adb8c8;--dsw-alias-bg-base:#191e27;--dsw-alias-bg-layer-1:#242b37;--dsw-alias-border-l2:#3c4657;--dsw-alias-label-on-brand:#182b40}
</style></head><body><main id="settings"></main></body></html>`;
function fixture() {
  let activeTheme = 'light', panelCleanup;
  const listeners = new Set(), effects = [];
  const effect = fn => { const cleanup = fn(); if (typeof cleanup === 'function') effects.push(cleanup); };
  const ctx = {
    theme: {
      getTheme: () => ({ preference: activeTheme }),
      setTheme(mode) {
        activeTheme = mode;
        document.body.toggleAttribute('data-ds-dark-theme', mode === 'dark');
        for (const fn of listeners) fn();
      }
    },
    effect, get: () => ({}),
    on(event, fn) { if (event === 'theme/change') { listeners.add(fn); effects.push(() => listeners.delete(fn)); } },
    slots: { inject() {}, register() {} },
    inject(dependencies, fn) { fn({ effect, get: () => ({ register: () => () => {} }) }); }
  };
  window.start = (theme = 'light') => {
    window.stop(); window.hostMode(false); ctx.theme.setTheme(theme);
    localStorage.setItem('dsh-sao.preferences.v4', JSON.stringify({ featureMode: 'all', startup: false, wallpaper: 'none', accent: '#8CC8F4', surfaceColor: null, fontFamily: 'system-ui', theme }));
    const assets = Array.from({ length: 3 }, (_, i) => ({ id: 'builtin-' + (i + 1), name: '壁纸 ' + (i + 1), src: '/assets/wallpapers/' + (i + 1) + '.webp' }));
    window.api = applySAOAppearance(ctx, {}, assets, [{ id: '1', src: '/assets/animation-previews/native.webp' }, { id: '2', src: '/assets/animation-previews/thin.webp' }]);
    applySAOControlStates(ctx);
    panelCleanup = mountSAOSettings(document.querySelector('#settings'), api);
  };
  window.hostMode = enabled => {
    const main = document.querySelector('#settings'), old = document.querySelector('#settings-host');
    if (!enabled) { if (old) { document.body.appendChild(main); old.remove(); } return; }
    if (old) return;
    const host = document.createElement('div'); host.id = 'settings-host';
    host.setAttribute('role', 'dialog'); host.setAttribute('data-shortcut-modal', 'settings');
    host.style.cssText = 'position:relative;max-width:1100px;margin:16px auto';
    document.body.appendChild(host); host.appendChild(main);
  };
  window.stop = () => { panelCleanup?.(); panelCleanup = null; for (const cleanup of effects.splice(0).reverse()) cleanup(); };
  window.paint = async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); };
  window.measure = () => {
    const root = document.querySelector('[data-sao-settings]');
    const visible = e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
    const rgba = color => { context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]; };
    const style = (e, pseudo = null) => {
      const s = getComputedStyle(e, pseudo), borderColor = rgba(s.borderTopColor);
      return { background: s.backgroundColor, rgba: rgba(s.backgroundColor), alpha: rgba(s.backgroundColor)[3] / 255, radius: parseFloat(s.borderTopLeftRadius), border: s.borderTopWidth, borderColor, borderChroma: Math.max(...borderColor.slice(0, 3)) - Math.min(...borderColor.slice(0, 3)), shadow: s.boxShadow, outline: s.outlineWidth, backdrop: s.backdropFilter, color: s.color };
    };
    const blend = (front, back) => front.slice(0, 3).map((v, i) => v * front[3] / 255 + back[i] * (1 - front[3] / 255));
    const luminance = values => values.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    // Test both luminance extremes beneath the fixture's actual 55% theme veil.
    // Then composite every real translucent ancestor rather than treating glass as opaque.
    const base = rgba(getComputedStyle(root).getPropertyValue('--sao-base'));
    const contrast = e => {
      const ancestors = []; for (let node = e; node && node !== root.parentElement; node = node.parentElement) ancestors.unshift(node);
      const foreground = luminance(rgba(getComputedStyle(e).color).slice(0, 3));
      return Math.min(...[0, 255].map(extreme => {
        let background = base.slice(0, 3).map(v => v * .55 + extreme * .45);
        const host = document.querySelector('#settings-host');
        if (host) background = blend(rgba(getComputedStyle(host, '::before').backgroundColor), background);
        for (const node of ancestors) background = blend(rgba(getComputedStyle(node).backgroundColor), background);
        const light = luminance(background);
        return (Math.max(foreground, light) + .05) / (Math.min(foreground, light) + .05);
      }));
    };
    const bounds = root.getBoundingClientRect();
    return {
      width: innerWidth, docWidth: document.documentElement.scrollWidth, root: style(root),
      host: document.querySelector('#settings-host') ? style(document.querySelector('#settings-host'), '::before') : null,
      hostFrame: document.querySelector('#settings-host') ? style(document.querySelector('#settings-host')) : null,
      tintTargets: Object.fromEntries(['fieldset', '.sao-preview', '.sao-font', '.sao-upload', '.sao-btn', '.sao-font-row input'].map(selector => [selector, style(root.querySelector(selector))])),
      overflowing: [...root.querySelectorAll('*')].filter(visible).filter(e => { const b = e.getBoundingClientRect(); return b.left < bounds.left - 1 || b.right > bounds.right + 1; }).map(e => e.className || e.tagName),
      tabs: [...root.querySelectorAll('.sao-tab')].map(e => ({ selected: e.getAttribute('aria-selected'), ...style(e) })),
      groups: [...root.querySelectorAll('fieldset,.sao-font,.sao-upload,.sao-preview')].filter(visible).map(style),
      rows: [...root.querySelectorAll('.sao-row,.sao-range-row,.sao-mode-tabs')].filter(visible).map(style),
      selectedChoices: [...root.querySelectorAll('.sao-choice > input:checked + span')].filter(visible).map(style),
      choiceMarks: [...root.querySelectorAll('.sao-choice > input')].filter(visible).map(e => ({ width: e.getBoundingClientRect().width, shadow: getComputedStyle(e).boxShadow })),
      swatches: [...root.querySelectorAll('.sao-swatch input:checked + span')].filter(visible).map(e => ({ ...style(e), markWidth: parseFloat(getComputedStyle(e, '::after').width), outlineStyle: getComputedStyle(e).outlineStyle })),
      controls: [...root.querySelectorAll('.sao-btn,.sao-font-row input,.sao-hex-row input')].filter(visible).map(style),
      textContrast: [...root.querySelectorAll('.sao-hint,.sao-reset,.sao-current-color,.sao-preview-note,.sao-live,.sao-choice small,output')].filter(visible).map(contrast),
      images: root.querySelectorAll('[data-animation-preview]').length,
      preview: visible(root.querySelector('.sao-preview'))
    };
  };
}

test('glass settings stay translucent and operable in both themes and narrow panels', { skip: dependencyError || false, timeout: 90000 }, async t => {
  const server = http.createServer((request, response) => {
    if (request.url.startsWith('/assets/')) {
      const asset = new URL('..' + request.url, import.meta.url);
      if (!/\/assets\/(wallpapers\/[1-3]|animation-previews\/(native|thin))\.webp$/.test(asset.pathname)) { response.writeHead(404).end(); return; }
      response.setHeader('Content-Type', 'image/webp'); response.end(fs.readFileSync(asset)); return;
    }
    response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = await new Promise(resolve => { const socket = net.createServer(); socket.listen(0, '127.0.0.1', () => { const port = socket.address().port; socket.close(() => resolve(port)); }); });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sao-settings-edge-'));
  const edge = spawn(process.env.SAO_TEST_EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless', '--no-first-run', '--mute-audio', '--remote-debugging-port=' + port, '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
  t.after(() => edge.kill());
  let endpoint;
  for (let i = 0; i < 60; i++) { try { endpoint = (await (await fetch('http://127.0.0.1:' + port + '/json/version')).json()).webSocketDebuggerUrl; break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); } }
  assert.ok(endpoint, 'owned Edge CDP endpoint available');
  const browser = await chromium.connectOverCDP(endpoint);
  t.after(async () => { try { await (await browser.newBrowserCDPSession()).send('Browser.close'); } catch {} });
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage(), errors = [], results = [], tintResults = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.addScriptTag({ content: source + '\n(' + fixture.toString() + ')();' });
  fs.mkdirSync(screenshotDir, { recursive: true });
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => start(theme), theme);
    for (const width of [1100, 760, 430, 375]) {
      await page.setViewportSize({ width, height: 900 });
      for (const tab of ['startup', 'appearance', 'wallpaper']) {
        await page.locator('[data-tab="' + tab + '"]').click(); await page.evaluate(() => paint());
        const result = await page.evaluate(() => measure());
        assert.ok(Math.min(...result.textContrast) >= 4.5, theme + ' extreme backdrop helper text meets AA: ' + Math.min(...result.textContrast));
        result.extremeBackdropContrast = result.textContrast;
        results.push({ theme, tab, ...result });
        assert.ok(result.docWidth <= width, theme + '/' + tab + '/' + width + ' document fits');
        assert.deepEqual(result.overflowing, [], theme + '/' + tab + '/' + width + ' controls fit');
        assert.ok(result.root.alpha >= .46 && result.root.alpha <= .58, 'shell uses translucent theme fill');
        assert.equal(result.root.radius, 28, 'shell has a large rounded frame');
        assert.match(result.root.backdrop, /blur\(24px\)/, 'shell diffuses the backdrop');
        assert.ok(result.groups.every(s => s.alpha >= .10 && s.alpha <= .15 && s.radius === 22 && s.border === '1px' && s.borderChroma < 24), 'groups are light glass with neutral hairlines and 22px corners');
        assert.ok(result.rows.every(s => s.alpha === 0 && s.border === '0px' && s.shadow === 'none'), 'rows do not introduce additional cards');
        assert.ok(result.tabs.every(s => s.border === '0px' && s.radius === 999), 'tabs use quiet pills without enclosing frames');
        assert.ok(result.selectedChoices.every(s => s.alpha < .25 && s.border === '1px' && s.borderChroma < 24), 'selected choices have subtle fill and neutral borders');
        assert.ok(result.choiceMarks.every(s => s.width <= 12 && s.shadow === 'none'), 'choice marks remain small without double rings');
        assert.ok(result.swatches.every(s => s.outlineStyle === 'none' && s.shadow === 'none' && s.markWidth <= 14), 'swatches use a small check rather than colored rings: ' + JSON.stringify(result.swatches));
        assert.ok(result.controls.every(s => s.radius >= 16 && s.alpha < .25 && s.borderChroma < 24), 'controls have rounded translucent neutral surfaces');
        assert.ok(result.tabs.filter(s => s.selected === 'false').every(s => s.alpha === 0 && s.shadow === 'none'), 'inactive tabs stay transparent');
        assert.ok(Math.min(...result.textContrast) >= 4.5, theme + '/' + tab + ' supporting text meets AA: ' + Math.min(...result.textContrast));
        assert.equal(result.preview, true); assert.equal(result.images, 2, 'animation screenshots retained');
        if (width === 1100 || width === 375) {
          await page.evaluate(() => scrollTo(0, 0));
          const root = await page.locator('[data-sao-settings]').boundingBox();
          await page.screenshot({ path: path.join(screenshotDir, theme + '-' + tab + '-' + width + '.png'), clip: { x: root.x, y: root.y, width: root.width, height: Math.min(root.height, 860) } });
        }
      }
    }
    await page.locator('[data-tab="appearance"]').click();
    const live = await page.evaluate(async () => {
      const before = document.querySelector('[data-preview-opacity]').textContent;
      const range = document.querySelector('[data-pref="opacity"]'); range.value = '63'; range.dispatchEvent(new Event('input', { bubbles: true })); await paint();
      return { before, after: document.querySelector('[data-preview-opacity]').textContent, value: api.get().opacity };
    });
    assert.notEqual(live.before, live.after); assert.equal(live.value, .37, 'range persists and updates real preview');
    await page.locator('[data-reset-setting="opacity"]').click();
    assert.equal(await page.evaluate(() => api.get().opacity), .8, 'per-field reset remains usable');
    await page.locator('[data-pref="rightLinked"]').uncheck();
    assert.equal(await page.locator('[data-right-controls]').isVisible(), true, 'independent controls remain reachable');
    await page.locator('[data-tab="startup"]').click();
    await page.locator('[data-pref="featureMode"][value="startup-only"]').check();
    assert.equal(await page.locator('.sao-preview').isVisible(), false);
    await page.locator('[data-pref="featureMode"][value="all"]').check();
    assert.equal(await page.locator('.sao-preview').isVisible(), true);
    await page.locator('[data-tab="startup"]').focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('[data-tab="appearance"]').getAttribute('aria-selected'), 'true', 'keyboard tab navigation retained');
    assert.ok(await page.locator('[data-tab="appearance"]').evaluate(e => parseFloat(getComputedStyle(e).outlineWidth) >= 2), 'keyboard focus remains visible');
  }
  // Keep one mounted settings component while changing the real persisted accent.
  // Exercise both the standalone root and the exact host selector/pseudo-element.
  for (const theme of ['light', 'dark']) {
    for (const hosted of [false, true]) {
      await page.setViewportSize({ width: 1100, height: 900 });
      await page.evaluate(({ theme, hosted }) => { start(theme); hostMode(hosted); }, { theme, hosted });
      await page.locator('[data-tab="appearance"]').click();
      const variants = [];
      for (const [name, accent] of [['blue', '#8CC8F4'], ['orange', '#D29A34'], ['green', '#3C8D83']]) {
        await page.evaluate(async accent => { api.set({ accent }); await paint(); }, accent);
        const result = await page.evaluate(() => measure());
        assert.ok(Math.min(...result.textContrast) >= 4.5, theme + ' extreme backdrop helper text meets AA: ' + Math.min(...result.textContrast));
        result.extremeBackdropContrast = result.textContrast;
        variants.push(result); tintResults.push({ theme, hosted, name, accent, ...result });
        assert.ok(Math.min(...result.textContrast) >= 4.5, theme + '/' + name + '/' + hosted + ' helper text meets AA: ' + Math.min(...result.textContrast));
        assert.ok(result.groups.every(s => s.borderChroma < 24 && s.border === '1px'), 'tint does not color or thicken the neutral border');
        if (hosted) {
          assert.equal(result.root.alpha, 0, 'host owns the only outer glass fill');
          assert.equal(result.root.backdrop, 'none', 'host avoids stacked blur');
          assert.equal(result.hostFrame.radius, 32, 'host keeps the large frame');
          assert.ok(Math.abs(result.host.alpha - .48) < .01, 'host keeps 48% alpha');
        }
        if (name === 'blue') {
          await page.evaluate(() => scrollTo(0, 0));
          const element = page.locator(hosted ? '#settings-host' : '[data-sao-settings]');
          const bounds = await element.boundingBox();
          await page.screenshot({ path: path.join(screenshotDir, theme + (hosted ? '-host' : '-standalone') + '-blue-1100.png'), clip: { x: bounds.x, y: bounds.y, width: bounds.width, height: Math.min(bounds.height, 860) } });
        }
      }
      const first = variants[0];
      for (const key of Object.keys(first.tintTargets)) {
        assert.equal(new Set(variants.map(r => r.tintTargets[key].background)).size, 3, key + ' follows blue/orange/green');
        assert.equal(new Set(variants.map(r => r.tintTargets[key].alpha)).size, 1, key + ' tint preserves alpha');
      }
      const shell = hosted ? 'host' : 'root';
      assert.equal(new Set(variants.map(r => r[shell].background)).size, 3, shell + ' follows accent');
      assert.equal(new Set(variants.map(r => r[shell].alpha)).size, 1, shell + ' alpha stays unchanged');
      assert.deepEqual(variants.map(r => r.root.color), [first.root.color, first.root.color, first.root.color], 'text color is unchanged by tint');
    }
  }
  await page.evaluate(() => stop()); assert.deepEqual(errors, [], 'no browser exceptions');
  fs.writeFileSync(path.join(screenshotDir, 'results.json'), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(screenshotDir, 'tint-results.json'), JSON.stringify(tintResults, null, 2));
  console.log('Verified 24 theme/tab/width combinations and 12 blue/orange/green tint variants across both themes and host modes, unchanged alpha/neutral hairlines, strict two-extreme-backdrop AA helper text, controls and preview; screenshots: ' + screenshotDir);
});
