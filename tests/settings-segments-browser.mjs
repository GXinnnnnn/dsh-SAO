// Isolated settings view contract tests. No installed profile, builds or dependencies.
// The controllable API fixture below covers settings UI state branches, not media decode
// or the appearance implementation. settings-style-browser.mjs retains real appearance
// integration and strict AA contrast tests.
// Run: node --test tests/settings-segments-browser.mjs
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
const source = fs.readFileSync(new URL('../source/settings-panel.js', import.meta.url), 'utf8');
const reportDir = process.env.SAO_SEGMENT_RESULTS || path.join(os.tmpdir(), 'sao-settings-segments-verification');
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;padding:8px;background:#eef1f6;font-family:system-ui;--dsw-alias-label-primary:#20252c;--dsw-alias-label-secondary:#535e6d;--dsw-alias-bg-base:#fcfdff;--dsw-alias-bg-layer-1:#f4f6f9;--dsw-alias-border-l2:#d9e0e8;--dsw-alias-brand-primary:#8cc8f4;--dsw-alias-label-on-brand:#182b40}
body[data-ds-dark-theme]{color-scheme:dark;background:#131923;--dsw-alias-label-primary:#edf1f6;--dsw-alias-label-secondary:#adb8c8;--dsw-alias-bg-base:#191e27;--dsw-alias-bg-layer-1:#242b37;--dsw-alias-border-l2:#3c4657}
</style></head><body><main id="settings"></main></body></html>`;
function fixture() {
  const storageKey = 'sao.segment-test.preferences';
  const defaults = { featureMode: 'all', videoQuality: 'balanced', startup: true, voice: 'kirito', sound: true, volume: .65, theme: 'system', fontFamily: 'system-ui', accent: '#8CC8F4', surfaceColor: null, windowOpacity: 1, composerOpacity: .9, componentOpacity: .9, conversationOpacity: .5, conversationBlur: 0, glass: 'liquid', opacity: .8, headerOpacity: .8, rightLinked: true, rightGlass: 'liquid', rightOpacity: .7, rightBlur: 0, contextGlass: 'follow', contextOpacity: .8, contextBlur: 0, headerLinked: true, rightHeaderOpacity: .8, wallpaper: 'builtin-3', wallpaperScope: 'full', wallOpacity: 1, wallX: 50, wallY: 50, wallScale: 100 };
  const builtin = [1, 2, 3].map(n => ({ id: 'builtin-' + n, name: '内置图片 ' + n, kind: 'image', src: '/fixture.png' }));
  const customImage = { id: 'custom', name: '自定义图片', kind: 'image', src: '/fixture.png' };
  const customVideo = { id: 'custom', name: '自定义视频', kind: 'video', src: '/fixture.png', meta: { width: 3840, height: 2160, duration: 5, bytes: 16 } };
  window.fixtureAssets = { builtin, customImage, customVideo };
  let cleanup, listeners, walls, uploadPending;
  window.fixtureVisible = element => !!element && !element.closest('[hidden]') && getComputedStyle(element).visibility === 'visible' && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
  const rect = element => {
    if (!element) return null;
    const r = element.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  };
  // Count observable DOM work, rather than wall-clock time. Probes are opt-in
  // and stop before assertions read geometry, so test inspection is excluded.
  let cacheProbe = null;
  const nativeRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (...args) {
    if (cacheProbe && this.closest('[data-sao-settings]')) {
      cacheProbe.rectReads++;
      if (this.closest('.sao-preview')) cacheProbe.previewRectReads++;
    }
    return nativeRect.apply(this, args);
  };
  for (const property of ['offsetLeft', 'offsetTop', 'offsetWidth', 'offsetHeight']) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, property);
    Object.defineProperty(HTMLElement.prototype, property, { ...descriptor, get() {
      if (cacheProbe && this.closest('[data-sao-settings]')) cacheProbe.offsetReads++;
      return descriptor.get.call(this);
    } });
  }
  const nativeSetProperty = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (property, value, priority) {
    const element = cacheProbe?.owners.get(this);
    if (element) {
      cacheProbe.styleWrites++;
      if (element.closest('.sao-preview')) cacheProbe.previewWrites.push({ element: element.className, property, value });
    }
    return nativeSetProperty.call(this, property, value, priority);
  };
  window.beginCacheProbe = () => {
    const owners = new WeakMap();
    for (const element of document.querySelectorAll('[data-sao-settings],[data-sao-settings] *')) owners.set(element.style, element);
    cacheProbe = { owners, rectReads: 0, previewRectReads: 0, offsetReads: 0, styleWrites: 0, previewWrites: [] };
  };
  window.endCacheProbe = () => {
    const { owners, ...result } = cacheProbe; cacheProbe = null; return result;
  };
  window.previewMaskSnapshot = () => {
    const targets = [document.querySelector('.sao-scene-conversation'), document.querySelector('.sao-mini-surface')];
    const children = [[document.querySelector('.sao-mini')], [...document.querySelectorAll('.sao-mini-title,.sao-mini-composer,.sao-mini-component')]];
    return targets.map((target, index) => {
      const bounds = target.getBoundingClientRect(), mask = target.style.getPropertyValue('mask-image');
      const encoded = mask.match(/data:image\/svg\+xml,([^"']*)/)?.[1];
      const svg = encoded ? new DOMParser().parseFromString(decodeURIComponent(encoded), 'image/svg+xml') : null;
      const holes = [...(svg?.querySelectorAll('rect[fill="black"]') || [])].map(hole => Object.fromEntries(['x', 'y', 'width', 'height', 'rx'].map(key => [key, Number(hole.getAttribute(key))])));
      const expected = children[index].map(element => {
        const r = element.getBoundingClientRect(), radius = parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
        return { x: r.x - bounds.x, y: r.y - bounds.y, width: r.width, height: r.height, rx: Math.min(radius, r.width / 2, r.height / 2) };
      });
      return { target: target.className, mask, holes, expected, bounds: rect(target) };
    });
  };
  window.animationCalls = [];
  const nativeAnimate = Element.prototype.animate;
  Element.prototype.animate = function (frames, options) {
    if (this.matches('[data-sao-segment-thumb]')) animationCalls.push({ frames, options, rect: rect(this), group: this.closest('[data-sao-segment]')?.querySelector('input[data-pref]')?.dataset.pref || 'tabs' });
    return nativeAnimate.call(this, frames, options);
  };
  window.paint = async (count = 3) => { for (let i = 0; i < count; i++) await new Promise(requestAnimationFrame); };
  window.finishSegments = async () => {
    await paint();
    for (const thumb of document.querySelectorAll('[data-sao-segment-thumb]')) {
      for (const animation of thumb.getAnimations()) {
        if (animation.playState === 'running' || animation.playState === 'paused') animation.finish();
      }
    }
    await paint();
  };
  window.groupFor = key => key === 'tabs' ? document.querySelector('.sao-tabs') : document.querySelector('input[data-pref="' + key + '"]')?.closest('[data-sao-segment]');
  window.segmentSnapshot = key => {
    const group = groupFor(key);
    if (!group) return null;
    const selected = key === 'tabs' ? group.querySelector('[role="tab"][aria-selected="true"]') : group.querySelector('input:checked')?.closest('label');
    const thumb = group.querySelector('[data-sao-segment-thumb]');
    const labels = [...group.querySelectorAll('label.sao-choice,[role="tab"]')].filter(fixtureVisible);
    return { key, group: rect(group), selected: rect(selected), thumb: rect(thumb), count: group.querySelectorAll('[data-sao-segment-thumb]').length,
      hidden: thumb?.getAttribute('aria-hidden'), selectedValue: selected?.querySelector('input')?.value || selected?.dataset.tab,
      options: labels.map(label => ({ tag: label.tagName, ...rect(label) })),
      radioCount: group.querySelectorAll('input[type="radio"][data-pref]').length,
      checkedCount: group.querySelectorAll('input[type="radio"]:checked').length,
      running: thumb?.getAnimations().filter(a => a.playState === 'running' || a.playState === 'paused').length || 0 };
  };
  window.videoSnapshot = () => {
    const field = document.querySelector('[data-video-settings]');
    return { exists: !!field, hidden: field?.hidden, visible: fixtureVisible(field),
      quality: api.get().videoQuality, wallpaper: api.get().wallpaper, walls: (Array.isArray(walls) ? walls : []).map(w => ({ id: w.id, kind: w.kind })),
      fileDisabled: document.querySelector('input[type="file"]').disabled,
      status: document.querySelector('[data-status]').textContent, error: document.querySelector('[data-status]').dataset.error,
      fieldStatus: field?.querySelector('[data-video-status]')?.textContent };
  };
  window.closeSettings = () => { cleanup?.(); cleanup = null; };
  window.reopenSettings = () => { closeSettings(); cleanup = mountSAOSettings(document.querySelector('#settings'), api); };
  window.start = (options = {}) => {
    closeSettings();
    listeners = new Set(); walls = [...builtin, ...(options.custom ? [options.custom === 'video' ? customVideo : customImage] : [])]; uploadPending = null;
    localStorage.setItem(storageKey, JSON.stringify({ ...defaults, ...options.prefs }));
    const emit = () => { for (const fn of listeners) fn(); };
    const get = () => ({ ...defaults, ...JSON.parse(localStorage.getItem(storageKey) || '{}') });
    const write = patch => { localStorage.setItem(storageKey, JSON.stringify({ ...get(), ...patch })); emit(); };
    window.api = {
      get, set: write, getDefault: key => defaults[key],
      setTheme(mode) { document.body.toggleAttribute('data-ds-dark-theme', mode === 'dark'); write({ theme: mode }); },
      get wallpapers() { return walls; },
      subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      resetSetting(key) { write({ [key]: defaults[key] }); },
      reset() { localStorage.setItem(storageKey, JSON.stringify(defaults)); emit(); },
      localFonts: async () => [], preview: async () => {}, status: () => '已保存', videoStatus: { state: 'paused', reason: 'still' },
      upload(file) { return new Promise((resolve, reject) => { uploadPending = { resolve, reject, file }; }); },
      removeUpload() { walls = [...builtin]; write({ wallpaper: 'builtin-3' }); }
    };
    window.fixtureNotify = emit;
    window.fixtureSetVideoStatus = value => { api.videoStatus = value; emit(); };
    window.fixtureSetWalls = items => { walls = items; emit(); };
    window.resolveUpload = (success = true) => {
      if (!uploadPending) throw new Error('No pending fixture upload');
      const pending = uploadPending; uploadPending = null;
      if (!success) { pending.reject(new Error('模拟上传失败')); return; }
      walls = [...builtin, pending.file.type.startsWith('video/') ? customVideo : customImage];
      write({ wallpaper: 'custom' }); pending.resolve();
    };
    document.body.toggleAttribute('data-ds-dark-theme', options.theme === 'dark');
    animationCalls.length = 0; reopenSettings();
  };
}
function assertAligned(snapshot, message) {
  assert.ok(snapshot?.group?.width > 0 && snapshot.thumb?.width > 0, message + ': group and thumb visible');
  assert.equal(snapshot.count, 1, message + ': exactly one thumb');
  assert.equal(snapshot.hidden, 'true', message + ': decorative thumb');
  assert.ok(Math.abs(snapshot.thumb.x - snapshot.selected.x) <= 1.1, message + ': horizontal alignment ' + JSON.stringify(snapshot));
  assert.ok(Math.abs(snapshot.thumb.y - snapshot.selected.y) <= 1.1, message + ': vertical alignment');
  assert.ok(Math.abs(snapshot.thumb.width - snapshot.selected.width) <= 1.1, message + ': selected width');
  assert.ok(Math.abs(snapshot.thumb.height - snapshot.selected.height) <= 1.1, message + ': selected height');
}
function assertMasksAligned(snapshots, message) {
  assert.equal(snapshots.length, 2, message + ': conversation and surface masks');
  for (const snapshot of snapshots) {
    assert.equal(snapshot.holes.length, snapshot.expected.length, message + ': all sample holes in ' + snapshot.target);
    const byPosition = (a, b) => a.y - b.y || a.x - b.x;
    const holes = [...snapshot.holes].sort(byPosition), expected = [...snapshot.expected].sort(byPosition);
    for (let i = 0; i < expected.length; i++) for (const key of ['x', 'y', 'width', 'height', 'rx']) {
      assert.ok(Math.abs(holes[i][key] - expected[i][key]) <= .2, message + ': current ' + key + ' for hole ' + i + ' in ' + snapshot.target + ' ' + JSON.stringify(snapshot));
    }
  }
}
const choose = (page, key, value) => page.locator('input[data-pref="' + key + '"][value="' + value + '"]').locator('..').click();
const tab = async (page, name) => { await page.locator('[data-tab="' + name + '"]').click(); await page.evaluate(() => finishSegments()); };
async function videoState(page, expected, message) {
  const state = await page.evaluate(() => videoSnapshot());
  assert.equal(state.exists, true, message + ': video fieldset exists');
  assert.equal(state.visible, expected, message + ': visibility ' + JSON.stringify(state));
  assert.equal(state.hidden, !expected, message + ': hidden property');
  return state;
}

test('settings segments preserve native interaction, motion continuity and conditional video controls', { skip: dependencyError || false, timeout: 120000 }, async t => {
  const server = http.createServer((request, response) => {
    if (request.url.split('?')[0] === '/fixture.png') { response.setHeader('Content-Type', 'image/png'); response.end(image); return; }
    response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = await new Promise(resolve => { const socket = net.createServer(); socket.listen(0, '127.0.0.1', () => { const port = socket.address().port; socket.close(() => resolve(port)); }); });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sao-settings-segments-edge-'));
  const edge = spawn(process.env.SAO_TEST_EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless', '--no-first-run', '--mute-audio', '--remote-debugging-port=' + port, '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
  t.after(() => edge.kill());
  let endpoint;
  for (let i = 0; i < 60; i++) { try { endpoint = (await (await fetch('http://127.0.0.1:' + port + '/json/version')).json()).webSocketDebuggerUrl; break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); } }
  assert.ok(endpoint, 'owned Edge CDP endpoint available');
  const browser = await chromium.connectOverCDP(endpoint);
  t.after(async () => { try { await (await browser.newBrowserCDPSession()).send('Browser.close'); } catch {} });
  const context = await browser.newContext({ viewport: { width: 800, height: 900 }, reducedMotion: 'no-preference' });
  const page = await context.newPage(), errors = [], results = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.addScriptTag({ content: source + '\n(' + fixture.toString() + ')();' });
  fs.mkdirSync(reportDir, { recursive: true });
  const scenario = async (name, fn) => t.test(name, async () => {
    try { await fn(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, error: error.message }); throw error; }
  });

  await scenario('native-only startup removes style choices and thumbnails while preserving voice order', async () => {
    await page.evaluate(() => start()); await page.evaluate(() => finishSegments());
    assert.equal(await page.locator('[data-pref="animation"]').count(), 0);
    assert.equal(await page.locator('[data-animation-preview]').count(), 0);
    const order = await page.locator('[data-panel="startup"] [data-pref]').evaluateAll(inputs => inputs.map(input => input.dataset.pref).filter((key, index, keys) => key !== keys[index - 1]));
    assert.deepEqual(order, ['featureMode', 'startup', 'voice', 'sound', 'volume']);
    assert.deepEqual(await page.locator('[data-pref="voice"]').evaluateAll(inputs => inputs.map(input => input.value)), ['kirito', 'asuna']);
  });

  await scenario('native radios retain labels, arrow navigation and exactly one sequential tab stop', async () => {
    await page.evaluate(() => start()); await page.evaluate(() => finishSegments());
    const semantics = await page.locator('[data-pref="voice"]').evaluateAll(inputs => inputs.map(input => ({ type: input.type, name: input.name, label: input.labels?.length, tag: input.parentElement.tagName, hidden: input.hidden, ariaHidden: input.getAttribute('aria-hidden'), opacity: getComputedStyle(input).opacity, pseudo: getComputedStyle(input, '::after').content, display: getComputedStyle(input).display, visibility: getComputedStyle(input).visibility })));
    assert.equal(semantics.length, 2); assert.equal(new Set(semantics.map(s => s.name)).size, 1);
    assert.ok(semantics.every(s => s.type === 'radio' && s.name && s.label === 1 && s.tag === 'LABEL' && !s.hidden && s.ariaHidden !== 'true' && s.opacity === '0' && ['none', 'normal'].includes(s.pseudo) && s.display !== 'none' && s.visibility !== 'hidden'), 'native radios are accessible but visually unmarked');
    await page.evaluate(() => {
      const group = groupFor('voice');
      for (const [id, placement] of [['before-voice', 'beforebegin'], ['after-voice', 'afterend']]) { const button = document.createElement('button'); button.id = id; button.textContent = id; group.insertAdjacentElement(placement, button); }
    });
    await page.locator('#before-voice').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.value), 'kirito');
    await page.keyboard.press('ArrowRight'); await page.evaluate(() => finishSegments());
    assert.equal(await page.evaluate(() => api.get().voice), 'asuna');
    assert.equal(await page.evaluate(() => document.activeElement.value), 'asuna');
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'after-voice');
    await page.keyboard.press('Shift+Tab'); assert.equal(await page.evaluate(() => document.activeElement.value), 'asuna');
    await page.keyboard.press('ArrowLeft'); assert.equal(await page.evaluate(() => api.get().voice), 'kirito');
    await page.keyboard.press('Shift+Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'before-voice');
    await page.locator('[data-pref="voice"]:checked').focus(); await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(() => api.get().voice), 'asuna', 'native radio wraparound');
    await page.evaluate(() => finishSegments()); assertAligned(await page.evaluate(() => segmentSnapshot('voice')), 'keyboard selection');
  });

  await scenario('preference persistence survives remount and per-field/global reset', async () => {
    await page.evaluate(() => start()); await choose(page, 'voice', 'asuna');
    await page.evaluate(() => { reopenSettings(); }); await page.evaluate(() => finishSegments());
    assert.equal(await page.locator('[data-pref="voice"][value="asuna"]').isChecked(), true);
    assertAligned(await page.evaluate(() => segmentSnapshot('voice')), 'persisted voice');
    await page.locator('[data-reset-setting="voice"]').click(); await page.evaluate(() => finishSegments());
    assert.equal(await page.locator('[data-pref="voice"][value="kirito"]').isChecked(), true);
    assertAligned(await page.evaluate(() => segmentSnapshot('voice')), 'per-field reset');
    await choose(page, 'voice', 'asuna'); await page.locator('[data-action="reset"]').click(); await page.evaluate(() => finishSegments());
    assert.equal(await page.evaluate(() => api.get().voice), 'kirito');
    assertAligned(await page.evaluate(() => segmentSnapshot('voice')), 'global reset');
    await tab(page, 'appearance'); await choose(page, 'theme', 'dark');
    await page.waitForFunction(() => !document.querySelector('[data-pref="theme"]').disabled);
    await page.evaluate(() => reopenSettings()); await tab(page, 'appearance');
    assert.equal(await page.locator('[data-pref="theme"][value="dark"]').isChecked(), true);
    assertAligned(await page.evaluate(() => segmentSnapshot('theme')), 'persisted theme');
  });

  await scenario('220ms translation stays within its endpoints and interruptions continue from the current visual position', async () => {
    await page.evaluate(() => start({ prefs: { voice: 'kirito' } })); await page.evaluate(() => finishSegments());
    const motion = await page.evaluate(async () => {
      const group = groupFor('voice'), thumb = group.querySelector('[data-sao-segment-thumb]');
      const bounds = () => { const r = thumb.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
      const inspect = async animation => {
        const timing = animation.effect.getTiming(), frames = animation.effect.getKeyframes(), samples = [];
        animation.pause();
        for (const progress of [0, .12, .3, .5, .75, .9, .999]) {
          animation.currentTime = Number(timing.duration) * progress; await paint(1);
          const matrix = new DOMMatrixReadOnly(getComputedStyle(thumb).transform);
          samples.push({ progress, ...bounds(), scaleX: matrix.a, scaleY: matrix.d, skewX: matrix.c, skewY: matrix.b });
        }
        // Leave a partly completed visual position for the reverse selection.
        animation.currentTime = Number(timing.duration) * .3; await paint(1);
        return { timing, frames, samples };
      };
      const first = bounds(); group.querySelector('[value="asuna"]').closest('label').click(); await paint(1);
      const animation = thumb.getAnimations().find(a => a.playState === 'running');
      if (!animation) return { first, missingAnimation: true, calls: animationCalls };
      const forward = await inspect(animation), intermediate = bounds();
      group.querySelector('[value="kirito"]').closest('label').click();
      const immediate = bounds(); await paint(1);
      const afterFrame = bounds(), reverseAnimation = thumb.getAnimations().find(a => a.playState === 'running');
      const reverse = reverseAnimation ? await inspect(reverseAnimation) : null, rapid = [];
      for (const value of ['asuna', 'kirito', 'asuna', 'kirito', 'asuna', 'kirito']) {
        const current = thumb.getAnimations().find(a => a.playState === 'running' || a.playState === 'paused');
        if (current) { current.pause(); current.currentTime = Number(current.effect.getTiming().duration) * .38; await paint(1); }
        const from = bounds(); group.querySelector('[value="' + value + '"]').closest('label').click();
        rapid.push({ value, from, immediate: bounds(), running: thumb.getAnimations().filter(a => a.playState === 'running' || a.playState === 'paused').length });
      }
      await finishSegments();
      return { first, forward, intermediate, immediate, afterFrame, reverse, rapid, final: segmentSnapshot('voice'), calls: animationCalls.length };
    });
    fs.writeFileSync(path.join(reportDir, 'motion-results.json'), JSON.stringify(motion, null, 2));
    assert.equal(motion.missingAnimation, undefined, 'normal selection animates a shared thumb');
    assert.ok(motion.reverse, 'reversing an in-flight selection replaces the motion');
    for (const [direction, animation] of [['forward', motion.forward], ['reverse', motion.reverse]]) {
      assert.equal(animation.timing.duration, 220, direction + ': selection motion lasts 220ms');
      assert.equal(animation.timing.easing.replace(/\s/g, ''), 'cubic-bezier(0.4,0,0.2,1)', direction + ': ease-in-out curve');
      assert.equal(animation.frames.length, 2, direction + ': only start and destination keyframes');
      assert.ok(animation.frames.every(frame => /^translate3d\([^)]*\)$/.test(frame.transform)), direction + ': transforms contain translation only, with no scale or overshoot keyframe');
      const start = animation.samples[0], end = animation.samples.at(-1), low = Math.min(start.x, end.x), high = Math.max(start.x, end.x), sign = Math.sign(end.x - start.x);
      assert.ok(Math.abs(end.x - start.x) > 1, direction + ': motion covers a nonzero distance');
      for (let i = 0; i < animation.samples.length; i++) {
        const sample = animation.samples[i];
        assert.ok(sample.x >= low - .2 && sample.x <= high + .2, direction + ': no overshoot at ' + sample.progress);
        assert.ok(Math.abs(sample.width - start.width) <= .2 && Math.abs(sample.height - start.height) <= .2, direction + ': thumb never stretches');
        assert.ok(Math.abs(sample.y - start.y) <= .2, direction + ': horizontal motion keeps its baseline');
        assert.equal(sample.scaleX, 1); assert.equal(sample.scaleY, 1); assert.equal(sample.skewX, 0); assert.equal(sample.skewY, 0);
        if (i) assert.ok((sample.x - animation.samples[i - 1].x) * sign >= -.2, direction + ': travel is monotonic');
      }
    }
    assert.ok(motion.intermediate.x > motion.first.x + 1, 'thumb travels through an intermediate visual position');
    assert.ok(motion.intermediate.x < motion.first.x + motion.first.width - 1, 'intermediate position precedes the target');
    assert.ok(Math.abs(motion.immediate.x - motion.intermediate.x) <= 2, 'interruption does not snap back to the previous target');
    assert.ok(Math.abs(motion.afterFrame.x - motion.intermediate.x) < motion.first.width * .7, 'replacement motion continues from the current position');
    assert.equal(motion.rapid.length, 6, 'exercise repeated quick direction changes');
    for (const interruption of motion.rapid) {
      assert.ok(Math.abs(interruption.immediate.x - interruption.from.x) <= 2, 'rapid ' + interruption.value + ' selection starts from the current visual position');
      assert.equal(interruption.running, 1, 'rapid selection replaces rather than queues motion');
    }
    assert.equal(motion.final.selectedValue, 'kirito'); assertAligned(motion.final, 'interrupted final position');
    assert.equal(motion.final.running, 0, 'no stale thumb animations remain');
  });

  await scenario('resize and hide/reveal initialize at the selected item without zero-origin flights', async () => {
    await page.evaluate(() => start({ prefs: { voice: 'asuna', theme: 'dark', rightLinked: false, rightGlass: 'frosted' } })); await page.evaluate(() => finishSegments());
    assertAligned(await page.evaluate(() => segmentSnapshot('voice')), 'nonfirst initial voice');
    await page.evaluate(() => { animationCalls.length = 0; });
    await page.setViewportSize({ width: 375, height: 900 }); await page.evaluate(() => paint(4));
    assertAligned(await page.evaluate(() => segmentSnapshot('voice')), 'resized selected voice');
    assert.equal(await page.evaluate(() => animationCalls.length), 0, 'resize remeasures without an entrance animation');
    await tab(page, 'appearance'); assertAligned(await page.evaluate(() => segmentSnapshot('theme')), 'initially hidden theme');
    await page.locator('[data-pref="rightLinked"]').check(); await page.evaluate(() => paint());
    await page.evaluate(() => { animationCalls.length = 0; });
    await page.locator('[data-pref="rightLinked"]').uncheck(); await page.evaluate(() => paint(4));
    assertAligned(await page.evaluate(() => segmentSnapshot('rightGlass')), 'reappearing right controls');
    assert.equal(await page.evaluate(() => animationCalls.filter(c => c.group === 'rightGlass').length), 0, 'newly revealed thumb is placed directly at the selected item');
    await page.evaluate(() => { document.querySelector('#settings').hidden = true; }); await page.setViewportSize({ width: 800, height: 900 });
    await page.evaluate(() => { animationCalls.length = 0; document.querySelector('#settings').hidden = false; }); await page.evaluate(() => paint(4));
    assertAligned(await page.evaluate(() => segmentSnapshot('theme')), 'whole view reappearing after resize');
    assert.equal(await page.evaluate(() => animationCalls.length), 0, 'whole-view reveal has no zero-origin animation');
  });

  await scenario('reduced motion creates no WAAPI thumb animations', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => start()); await page.evaluate(() => paint());
    await choose(page, 'voice', 'asuna'); await tab(page, 'appearance'); await choose(page, 'glass', 'frosted');
    await choose(page, 'contextGlass', 'off'); await page.evaluate(() => paint());
    assert.equal(await page.evaluate(() => animationCalls.length), 0, 'reduced motion never calls Element.animate for thumbs');
    for (const key of ['tabs', 'glass', 'contextGlass']) assertAligned(await page.evaluate(key => segmentSnapshot(key), key), 'reduced-motion ' + key);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });

  await scenario('light/dark 375/800 layouts have one-row equal-width segments and semantic wallpaper image choices', async () => {
    for (const theme of ['light', 'dark']) for (const width of [375, 800]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(theme => start({ theme, custom: 'video', prefs: { rightLinked: false, wallpaper: 'custom' } }), theme);
      for (const name of ['startup', 'appearance', 'wallpaper']) {
        await tab(page, name);
        const layout = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, groups: [...document.querySelectorAll('[data-sao-segment]')].filter(fixtureVisible).map(group => {
          const key = group.querySelector('[data-pref]')?.dataset.pref || 'tabs';
          return segmentSnapshot(key);
        }) }));
        assert.ok(layout.doc <= width, theme + '/' + width + '/' + name + ': no page overflow');
        assert.ok(layout.groups.length >= 2, 'top tabs and text groups have shared segments');
        for (const group of layout.groups) {
          assertAligned(group, theme + '/' + width + '/' + name + '/' + group.key);
          assert.ok(Math.max(...group.options.map(o => o.width)) - Math.min(...group.options.map(o => o.width)) <= 1, 'equal option widths');
          assert.ok(Math.max(...group.options.map(o => o.y)) - Math.min(...group.options.map(o => o.y)) <= 1, 'one option row');
          assert.ok(group.options.every(o => o.x >= group.group.x - 1 && o.x + o.width <= group.group.x + group.group.width + 1), 'options stay inside shared frame');
        }
        if (name === 'wallpaper') {
          const cards = await page.locator('[data-wall-grid] input[type="radio"]').evaluateAll(inputs => inputs.map(input => ({ label: input.labels?.length, name: input.name, hidden: input.getAttribute('aria-hidden'), segment: !!input.closest('[data-sao-segment]'), checked: input.checked })));
          assert.ok(cards.length >= 5 && cards.every(c => c.label === 1 && c.name && c.hidden !== 'true' && !c.segment), 'wallpaper cards retain their own native radio image-choice semantics');
          assert.equal(cards.filter(c => c.checked).length, 1);
        }
        await page.evaluate(() => scrollTo(0, 0));
        await page.locator('[data-sao-settings]').screenshot({ path: path.join(reportDir, theme + '-' + width + '-' + name + '.png') });
      }
    }
  });

  await scenario('video settings stay hidden with no video, an image, a missing selected item or a stored unselected video', async () => {
    for (const options of [{ prefs: { wallpaper: 'none' } }, { custom: 'image', prefs: { wallpaper: 'custom' } }, { prefs: { wallpaper: 'custom' } }, { custom: 'video', prefs: { wallpaper: 'builtin-3' } }]) {
      await page.evaluate(options => start(options), options); await tab(page, 'wallpaper');
      await videoState(page, false, JSON.stringify(options));
    }
    await page.evaluate(() => fixtureSetWalls(null)); await videoState(page, false, 'non-array/missing wallpaper collection');
  });

  await scenario('current video remains configurable when paused, static or transparent and hides on image selection', async () => {
    await page.evaluate(() => start({ custom: 'video', prefs: { wallpaper: 'custom' } })); await tab(page, 'wallpaper');
    await videoState(page, true, 'current video');
    await choose(page, 'videoQuality', 'still'); await page.evaluate(() => finishSegments());
    assert.equal((await videoState(page, true, 'static power-saving video')).quality, 'still');
    await page.evaluate(() => api.set({ wallOpacity: 0 })); await videoState(page, true, 'transparent current video');
    await page.locator('[data-wall-grid] input[value="builtin-1"]').locator('..').click();
    await videoState(page, false, 'builtin image selected');
    await page.locator('[data-wall-grid] input[value="custom"]').locator('..').click(); await page.evaluate(() => finishSegments());
    await videoState(page, true, 'video selected again');
    assertAligned(await page.evaluate(() => segmentSnapshot('videoQuality')), 'reappearing video preference');
    await page.locator('[data-action="remove-upload"]').click(); await page.evaluate(() => paint());
    const state = await videoState(page, false, 'custom video deleted'); assert.equal(state.wallpaper, 'builtin-3');
  });

  await scenario('asynchronous video upload exposes controls only after success and restores disabled input', async () => {
    await page.evaluate(() => start()); await tab(page, 'wallpaper');
    await page.locator('input[type="file"]').setInputFiles({ name: 'loop.webm', mimeType: 'video/webm', buffer: Buffer.from('controlled-ui-fixture') });
    const pending = await videoState(page, false, 'pending upload'); assert.equal(pending.fileDisabled, true);
    await page.evaluate(() => resolveUpload(true)); await page.waitForFunction(() => !document.querySelector('input[type="file"]').disabled);
    const success = await videoState(page, true, 'successful upload'); assert.equal(success.wallpaper, 'custom'); assert.equal(success.error, 'false');
    await page.evaluate(() => finishSegments()); assertAligned(await page.evaluate(() => segmentSnapshot('videoQuality')), 'newly available video settings');
    assert.equal(await page.locator('input[type="file"]').inputValue(), '', 'file selection cleared after success');
    await tab(page, 'startup'); await tab(page, 'wallpaper'); await videoState(page, true, 'video tab re-entry');
    await page.evaluate(() => reopenSettings()); await tab(page, 'wallpaper');
    await videoState(page, true, 'settings remount with persisted current video');
    assertAligned(await page.evaluate(() => segmentSnapshot('videoQuality')), 'remounted video controls');
  });

  await scenario('failed upload preserves the previous selected wallpaper and cannot expose stale video controls', async () => {
    for (const options of [{}, { custom: 'video', prefs: { wallpaper: 'custom', videoQuality: 'still' } }]) {
      await page.evaluate(options => start(options), options); await tab(page, 'wallpaper');
      const before = await page.evaluate(() => api.get());
      await page.locator('input[type="file"]').setInputFiles({ name: 'broken.mp4', mimeType: 'video/mp4', buffer: Buffer.from('fixture-failure') });
      await page.evaluate(() => resolveUpload(false)); await page.waitForFunction(() => !document.querySelector('input[type="file"]').disabled);
      const state = await videoState(page, options.custom === 'video', 'failed upload');
      assert.equal(state.wallpaper, before.wallpaper); assert.equal(state.quality, before.videoQuality); assert.equal(state.error, 'true');
      assert.match(state.status, /失败/); assert.equal(await page.locator('input[type="file"]').inputValue(), '');
    }
  });

  await scenario('retained inactive panels stay outside native keyboard and pointer interaction', async () => {
    await page.setViewportSize({ width: 800, height: 900 }); await page.evaluate(() => start({ custom: 'video', prefs: { wallpaper: 'custom' } }));
    for (const name of ['startup', 'appearance', 'wallpaper']) {
      await tab(page, name);
      const hidden = await page.evaluate(() => [...document.querySelectorAll('[data-panel][hidden]')].map(panel => {
        const control = panel.querySelector('input,button'), before = document.activeElement;
        control.focus(); const focused = document.activeElement === control;
        const r = control.getBoundingClientRect(), hit = document.elementFromPoint(Math.max(0, Math.min(innerWidth - 1, r.x + r.width / 2)), Math.max(0, Math.min(innerHeight - 1, r.y + r.height / 2)));
        if (before?.isConnected) before.focus();
        return { name: panel.dataset.panel, focused, pointerHit: !!hit && panel.contains(hit), visibility: getComputedStyle(panel).visibility, pointerEvents: getComputedStyle(panel).pointerEvents, contentVisibility: getComputedStyle(panel).contentVisibility };
      }));
      assert.equal(hidden.length, 2, 'exactly the inactive categories remain hidden');
      assert.ok(hidden.every(panel => !panel.focused && !panel.pointerHit && panel.visibility === 'hidden' && panel.pointerEvents === 'none'), 'retained hidden controls cannot receive native focus or pointer hits: ' + JSON.stringify(hidden));
      await page.locator('[data-tab="' + name + '"]').focus();
      let reachedReset = false, activeControls = 0;
      for (let i = 0; i < 120; i++) {
        await page.keyboard.press('Tab');
        const focus = await page.evaluate(() => ({ hidden: !!document.activeElement.closest('[hidden]'), category: document.activeElement.closest('[data-panel]')?.dataset.panel, reset: document.activeElement.dataset.action === 'reset' }));
        assert.equal(focus.hidden, false, 'Tab never enters a retained hidden category');
        if (focus.category) { assert.equal(focus.category, name, 'Tab only enters the active category'); activeControls++; }
        if (focus.reset) { reachedReset = true; break; }
      }
      assert.ok(activeControls > 0 && reachedReset, name + ': native keyboard traverses active controls and reaches the global footer');
    }
  });

  await scenario('repeated same-size category returns place selected thumbs before interaction without entrance flights', async () => {
    const reveals = [];
    for (const width of [375, 800]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => start({ custom: 'video', prefs: { voice: 'asuna', theme: 'dark', rightLinked: false, rightGlass: 'frosted', wallpaper: 'custom', wallpaperScope: 'conversation', videoQuality: 'still' } }));
      await page.evaluate(() => finishSegments());
      for (let repeat = 0; repeat < 3; repeat++) for (const name of ['appearance', 'wallpaper', 'startup']) {
        const record = await page.evaluate(async name => {
          animationCalls.length = 0; document.querySelector('[data-tab="' + name + '"]').click();
          // Native ResizeObserver must place a newly rendered cached-size group
          // by the next two paint opportunities, without a synthetic resize.
          await paint(2);
          const keys = name === 'startup' ? ['voice'] : name === 'appearance' ? ['theme', 'rightGlass'] : ['wallpaperScope', 'videoQuality'];
          return { name, groups: keys.map(segmentSnapshot), calls: animationCalls.filter(call => call.group !== 'tabs') };
        }, name);
        reveals.push({ width, repeat, ...record });
        fs.writeFileSync(path.join(reportDir, 'retained-panel-reveal-results.json'), JSON.stringify(reveals, null, 2));
        for (const snapshot of record.groups) assertAligned(snapshot, width + '/' + repeat + '/' + name + '/' + snapshot.key);
        assert.deepEqual(record.calls, [], 'returning to same-size category positions hidden group thumbs without replaying an entrance animation');
        await page.evaluate(() => finishSegments());
      }
    }
    fs.writeFileSync(path.join(reportDir, 'retained-panel-reveal-results.json'), JSON.stringify(reveals, null, 2));
  });

  await scenario('status-only notifications update video messages without replaying preference or preview work', async () => {
    await page.setViewportSize({ width: 800, height: 900 });
    await page.evaluate(() => start({ custom: 'video', prefs: { wallpaper: 'custom' } })); await tab(page, 'wallpaper');
    const before = await page.evaluate(() => JSON.stringify(api.get()));
    const statuses = [
      [{ state: 'playing', reason: '' }, '正在静音循环播放'],
      [{ state: 'paused', reason: 'still' }, '静态省电：视频源已卸载'],
      [{ state: 'paused', reason: 'reduced-motion' }, '减少动态效果：显示静态封面'],
      [{ state: 'paused', reason: 'error' }, '视频播放失败，正在显示静态封面。'],
      [{ state: 'paused', reason: 'blur' }, '已暂停：显示静态封面']
    ];
    const statusWork = [];
    for (const [status, expected] of statuses) {
      const work = await page.evaluate(async status => { beginCacheProbe(); fixtureSetVideoStatus(status); await paint(); return endCacheProbe(); }, status);
      assert.equal(await page.locator('[data-video-status]').textContent(), expected, 'playback notification remains live with identical preference signature');
      assert.equal(await page.evaluate(() => JSON.stringify(api.get())), before, 'playback status did not change preferences');
      assert.equal(work.previewRectReads, 0, 'status-only notification does not measure preview');
      assert.deepEqual(work.previewWrites, [], 'status-only notification does not paint preview');
      assert.equal(work.offsetReads, 0, 'status-only notification does not remeasure segments');
      statusWork.push({ status, expected, work });
    }
    fs.writeFileSync(path.join(reportDir, 'status-notification-work.json'), JSON.stringify(statusWork, null, 2));
    await page.evaluate(() => { api.videoStatus.state = 'playing'; api.videoStatus.reason = ''; fixtureNotify(); });
    assert.equal(await page.locator('[data-video-status]').textContent(), '正在静音循环播放', 'in-place status update is not hidden by a reference cache');
  });

  await scenario('same-id resource hydration and in-place poster updates refresh wallpaper UI with unchanged preferences', async () => {
    await page.evaluate(() => start({ prefs: { wallpaper: 'custom' } })); await tab(page, 'wallpaper');
    const before = await page.evaluate(() => JSON.stringify(api.get()));
    await videoState(page, false, 'custom asset not hydrated');
    await page.evaluate(() => {
      window.hydratedAsset = { id: 'custom', name: '延迟加载图片', kind: 'image', src: '/fixture.png?poster=image', meta: { width: 640, height: 360 } };
      fixtureSetWalls([...fixtureAssets.builtin, hydratedAsset]);
    });
    await page.evaluate(() => paint());
    assert.equal(await page.locator('.sao-scene-wall img').getAttribute('src'), '/fixture.png?poster=image', 'late image asset reaches the preview');
    assert.match(await page.locator('[data-wall-grid] input[value="custom"]').locator('..').textContent(), /延迟加载图片/);
    await videoState(page, false, 'hydrated custom image');
    await page.evaluate(() => {
      Object.assign(hydratedAsset, { kind: 'video', name: '延迟加载视频', src: '/fixture.png?poster=video', meta: { width: 3840, height: 2160, duration: 8 } });
      fixtureNotify();
    });
    await page.evaluate(() => paint());
    await videoState(page, true, 'same id hydrated as video');
    assert.equal(await page.locator('.sao-scene-wall img').getAttribute('src'), '/fixture.png?poster=video', 'video poster replacement reaches preview');
    assert.equal(await page.locator('[data-preview-wall]').textContent(), '延迟加载视频', 'same asset object name refreshes preview label');
    assert.equal(await page.locator('[data-wall-grid] input[value="custom"]').locator('..').locator('img').getAttribute('src'), '/fixture.png?poster=video', 'same-id card poster refreshes');
    await page.evaluate(() => { hydratedAsset.src = '/fixture.png?poster=regenerated'; hydratedAsset.meta = { width: 5120, height: 2880, duration: 10 }; fixtureNotify(); });
    assert.equal(await page.locator('.sao-scene-wall img').getAttribute('src'), '/fixture.png?poster=regenerated', 'metadata and poster refresh without preference changes');
    await page.evaluate(() => { fixtureSetWalls([...fixtureAssets.builtin]); });
    await videoState(page, false, 'resource removed while custom preference persists');
    assert.equal(await page.locator('.sao-scene-wall img').isHidden(), true, 'removing hydrated resource clears preview');
    assert.equal(await page.evaluate(() => JSON.stringify(api.get())), before, 'all hydration notifications leave preference signature unchanged');
  });

  await scenario('preview masks remeasure on resize and font metrics but remain untouched by voice selection', async () => {
    await page.setViewportSize({ width: 800, height: 900 });
    await page.evaluate(() => start()); await page.evaluate(() => finishSegments());
    assertMasksAligned(await page.evaluate(() => previewMaskSnapshot()), 'initial masks');
    const voiceWork = await page.evaluate(async () => {
      beginCacheProbe(); groupFor('voice').querySelector('[value="asuna"]').closest('label').click(); await finishSegments(); return endCacheProbe();
    });
    assert.equal(voiceWork.previewRectReads, 0, 'voice selection reuses preview geometry');
    assert.deepEqual(voiceWork.previewWrites, [], 'voice selection does not rewrite preview surfaces or masks');
    assert.equal(voiceWork.offsetReads, 0, 'voice selection reuses settled segment geometry');
    const before = await page.evaluate(() => previewMaskSnapshot());
    await page.setViewportSize({ width: 375, height: 900 }); await page.evaluate(() => paint(5));
    const resized = await page.evaluate(() => previewMaskSnapshot()); assertMasksAligned(resized, 'resized masks');
    assert.notEqual(resized[0].bounds.width, before[0].bounds.width, 'test changes actual preview geometry');
    await page.evaluate(() => { document.querySelector('.sao-mini-title').style.fontSize = '26px'; });
    await page.evaluate(() => paint(5));
    const fontChanged = await page.evaluate(() => previewMaskSnapshot()); assertMasksAligned(fontChanged, 'changed text metrics');
    assert.ok(fontChanged[1].expected[0].height > resized[1].expected[0].height + 1, 'test changes effective sample text dimensions');
    // A width change after selecting a new font must invalidate the same caches.
    await page.evaluate(() => api.set({ fontFamily: 'monospace' })); await page.evaluate(() => paint(5));
    assertMasksAligned(await page.evaluate(() => previewMaskSnapshot()), 'font family preference');
    fs.writeFileSync(path.join(reportDir, 'cache-work-results.json'), JSON.stringify({ voiceWork, before, resized, fontChanged }, null, 2));
  });

  await scenario('native local settings scroll reuses preview masks and hidden/revealed previews stay aligned', async () => {
    await page.setViewportSize({ width: 800, height: 900 });
    await page.evaluate(() => {
      start();
      document.querySelector('#settings').style.cssText = 'height:320px;overflow:auto';
    });
    try {
      await page.evaluate(() => finishSegments()); await page.evaluate(() => paint(5));
      const before = await page.evaluate(() => previewMaskSnapshot()); assertMasksAligned(before, 'local scroll initial masks');
      const scrollWork = await page.evaluate(async () => {
        const container = document.querySelector('#settings'), events = [];
        const capture = event => { if (event.target === container) events.push({ trusted: event.isTrusted, phase: event.eventPhase, top: container.scrollTop }); };
        document.addEventListener('scroll', capture, { capture: true });
        const max = container.scrollHeight - container.clientHeight;
        beginCacheProbe();
        try {
          for (const fraction of [.2, .6, 1, .4, 0]) {
            container.scrollTo({ top: Math.round(max * fraction), behavior: 'instant' });
            await paint(3);
          }
          return { max, events, work: endCacheProbe() };
        } finally { document.removeEventListener('scroll', capture, { capture: true }); }
      });
      fs.writeFileSync(path.join(reportDir, 'local-scroll-work.json'), JSON.stringify({ before, ...scrollWork }, null, 2));
      assert.ok(scrollWork.max > 320, 'fixture creates a genuinely scrollable local settings host');
      assert.equal(scrollWork.events.length, 5, 'each native scroll reaches the capture listener without dispatching an artificial event');
      assert.ok(scrollWork.events.every(event => event.trusted && event.phase === 1), 'events are trusted browser scrolls captured from the local host');
      assert.ok(scrollWork.events.some(event => event.top > 320), 'the content visibly moves through the local viewport');
      assert.equal(scrollWork.work.previewRectReads, 0, 'scrolling the settings host does not read preview geometry');
      assert.deepEqual(scrollWork.work.previewWrites.filter(write => /^(?:-webkit-)?mask/.test(write.property)), [], 'scrolling the settings host never rewrites preview masks');
      const after = await page.evaluate(() => previewMaskSnapshot()); assertMasksAligned(after, 'local scroll final masks');
      assert.deepEqual(after.map(snapshot => snapshot.mask), before.map(snapshot => snapshot.mask), 'whole-preview movement leaves relative mask geometry unchanged');
      // Hiding the entire sample still needs real invalidation when its containing
      // width changes. Native scrolling must not be required to refresh it.
      await page.evaluate(() => api.set({ featureMode: 'startup-only' })); await page.evaluate(() => paint(3));
      assert.equal(await page.locator('.sao-preview').isHidden(), true, 'startup-only hides the sample after local scrolling');
      await page.setViewportSize({ width: 375, height: 900 }); await page.evaluate(() => paint(3));
      await page.evaluate(() => api.set({ featureMode: 'all' })); await page.evaluate(() => paint(5));
      assert.equal(await page.locator('.sao-preview').isVisible(), true, 'all-features reveals the sample after hidden resizing');
      const revealed = await page.evaluate(() => previewMaskSnapshot()); assertMasksAligned(revealed, 'revealed resized sample after local scroll');
      assert.notEqual(revealed[0].bounds.width, before[0].bounds.width, 'hidden resize changes the actual sample geometry');
      assertAligned(await page.evaluate(() => segmentSnapshot('voice')), 'native scroll then hidden resize/reveal');
      fs.writeFileSync(path.join(reportDir, 'local-scroll-work.json'), JSON.stringify({ before, after, revealed, ...scrollWork }, null, 2));
    } finally {
      await page.evaluate(() => { document.querySelector('#settings').style.cssText = ''; });
      await page.evaluate(() => paint(3));
    }
  });

  await scenario('relative sample layout changes update holes even when all observed box sizes stay equal', async () => {
    await page.setViewportSize({ width: 800, height: 900 }); await page.evaluate(() => start()); await page.evaluate(() => finishSegments());
    const before = await page.evaluate(() => previewMaskSnapshot());
    await page.evaluate(() => {
      document.querySelector('.sao-mini-component').style.marginTop = '16px';
      document.querySelector('.sao-mini-composer').style.marginTop = '10px';
      fixtureNotify();
    });
    await page.evaluate(() => paint(5));
    const after = await page.evaluate(() => previewMaskSnapshot());
    assert.equal(after[0].expected[0].height, before[0].expected[0].height, 'outer sample retains its dimensions');
    for (let i = 0; i < after[1].expected.length; i++) {
      assert.equal(after[1].expected[i].width, before[1].expected[i].width, 'child width unchanged');
      assert.equal(after[1].expected[i].height, before[1].expected[i].height, 'child height unchanged');
    }
    assert.ok(Math.abs(after[1].expected[1].y - before[1].expected[1].y) >= 5, 'component moves relative to its masked surface');
    fs.writeFileSync(path.join(reportDir, 'relative-preview-layout.json'), JSON.stringify({ before, after }, null, 2));
    assertMasksAligned(after, 'relative positions changed without resize');
  });

  await scenario('reselecting a category avoids layout work while Home/End preserve keyboard focus', async () => {
    await page.setViewportSize({ width: 800, height: 900 }); await page.evaluate(() => start()); await page.evaluate(() => finishSegments());
    const work = await page.evaluate(async () => {
      beginCacheProbe(); document.querySelector('[data-tab="startup"]').click(); await paint(); return endCacheProbe();
    });
    assert.equal(work.rectReads, 0, 'already selected category does not read geometry');
    assert.equal(work.offsetReads, 0, 'already selected category does not remeasure segments');
    assert.equal(work.styleWrites, 0, 'already selected category does not repaint styles');
    await page.locator('[data-pref="voice"]:checked').focus();
    await page.locator('[data-tab="startup"]').dispatchEvent('keydown', { key: 'Home' });
    assert.equal(await page.evaluate(() => document.activeElement.dataset.tab), 'startup', 'Home still focuses already selected first category');
    await page.keyboard.press('End'); await page.evaluate(() => finishSegments());
    assert.equal(await page.evaluate(() => document.activeElement.dataset.tab), 'wallpaper', 'End selects and focuses final category');
    await page.locator('input[type="file"]').focus();
    await page.locator('[data-tab="wallpaper"]').dispatchEvent('keydown', { key: 'End' });
    assert.equal(await page.evaluate(() => document.activeElement.dataset.tab), 'wallpaper', 'End still focuses already selected last category');
    fs.writeFileSync(path.join(reportDir, 'reselected-tab-work.json'), JSON.stringify(work, null, 2));
  });

  await page.evaluate(() => closeSettings());
  assert.deepEqual(errors, [], 'no browser exceptions or unhandled animation/upload rejections');
  fs.writeFileSync(path.join(reportDir, 'results.json'), JSON.stringify({ scenarios: results, errors }, null, 2));
  console.log('Settings segment scenarios: ' + results.filter(result => result.passed).length + '/' + results.length + ' passed; includes native semantics/keyboard, persistence/reset, interrupted WAAPI motion, resize/reveal, reduced motion, 12 theme/width/tab layouts, video availability/upload/re-entry and live status/resource notifications, preview mask invalidation, trusted local scroll cache reuse, cached DOM work and repeated-tab focus; evidence: ' + reportDir);
});
