// Real Edge regression: compile an isolated copy with the unmodified Python builder.
// Production engines, worker, scheduling and CSS run unchanged. Wrappers only record calls.
// Run: node --test --test-reporter=junit --test-reporter-destination=C:/SAO/releases/1.0.5/coverage-fade/fixture/regression.xml tests/startup-exit-browser.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
const require = createRequire(import.meta.url);
// Missing browser dependencies are errors: this suite must never pass by skipping WebGL.
const { chromium } = require(process.env.SAO_TEST_PLAYWRIGHT ?? 'C:/DSH/graduation-office/node_modules/.pnpm/playwright@1.64.0/node_modules/playwright');
const repo = fileURLToPath(new URL('..', import.meta.url));
const artifacts = process.env.SAO_EXIT_FIXTURE ?? 'C:/SAO/releases/1.0.5/coverage-fade/fixture';
const inputs = ['build.py', 'renderer.js', 'thin-renderer.js', 'worker.js', 'startup.template.js'];
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const hashes = () => Object.fromEntries(inputs.map(name => [name, sha(fs.readFileSync(path.join(repo, 'source', name)))]));
function buildFixture() {
  const before = hashes(), build = path.join(artifacts, 'build');
  fs.mkdirSync(path.join(build, 'source'), { recursive: true });
  for (const name of inputs) fs.copyFileSync(path.join(repo, 'source', name), path.join(build, 'source', name));
  const result = spawnSync(process.env.SAO_TEST_PYTHON ?? 'python', [path.join(build, 'source/build.py'), '--archive', process.env.SAO_TEST_ARCHIVE ?? path.resolve(repo, '../original/SAO.zip')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.error?.message || result.stdout);
  assert.deepEqual(hashes(), before, 'sources remained stable while the fixture was compiled');
  return { sources: before, startup: sha(fs.readFileSync(path.join(build, 'startup.js'))), builtAt: new Date().toISOString(), builder: result.stdout.trim() };
}

function observe() {
  // Native implementations are retained; no scheduling, coverage, shader or fade is replaced.
  const events = window.events = [], samples = window.samples = [];
  const record = (type, data = {}) => events.push({ type, at: performance.now(), ...data });
  window.fixtureRecord = record;
  const NativeWorker = window.Worker;
  if (!new URLSearchParams(location.search).has('noWorker')) {
    window.Worker = class ObservedWorker extends NativeWorker {
      constructor(...args) {
        super(...args); this.fixtureId = ++window.workerCount;
        record('worker-created', { id: this.fixtureId });
        this.addEventListener('message', event => record('worker-message', { id: this.fixtureId, data: event.data }));
      }
      postMessage(message, ...args) {
        record('worker-send', { id: this.fixtureId, data: { ...message, canvas: !!message.canvas } });
        return super.postMessage(message, ...args);
      }
      terminate() { record('worker-terminated', { id: this.fixtureId }); return super.terminate(); }
    };
  } else window.Worker = undefined; // The supported browser-capability fallback, not a fake worker.
  window.workerCount = 0;
  const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = (...args) => { const url = create(...args); record('blob-created', { url }); return url; };
  URL.revokeObjectURL = url => { record('blob-revoked', { url }); return revoke(url); };
  if (window.AudioContext) {
    const createGain = AudioContext.prototype.createGain, close = AudioContext.prototype.close;
    AudioContext.prototype.createGain = function(...args) {
      const gain = createGain.apply(this, args); record('audio-gain');
      for (const name of ['cancelScheduledValues', 'setValueAtTime', 'linearRampToValueAtTime']) {
        const native = gain.gain[name].bind(gain.gain);
        gain.gain[name] = (...args) => { record('audio-' + name, { args, time: this.currentTime }); return native(...args); };
      }
      return gain;
    };
    AudioContext.prototype.close = function(...args) { record('audio-closed'); return close.apply(this, args); };
  }
  const roots = new WeakMap(); let sequence = 0;
  function sample() {
    const root = document.querySelector('#sao-startup');
    if (!root) return;
    if (!roots.has(root)) { roots.set(root, ++sequence); record('root-added', { scene: sequence }); }
    const css = getComputedStyle(root), canvas = root.querySelector('canvas');
    samples.push({ at: performance.now(), scene: roots.get(root), opacity: +css.opacity, visibility: css.visibility,
      animation: css.animationName, duration: css.animationDuration, easing: css.animationTimingFunction,
      renderer: canvas?.dataset.renderer, width: canvas?.width, height: canvas?.height, focus: document.activeElement?.className });
    if (css.animationName === 'sao-startup-exit' && !root.dataset.fixtureObservedFade) {
      root.dataset.fixtureObservedFade = 'true'; record('css-fade', { scene: roots.get(root), duration: css.animationDuration, easing: css.animationTimingFunction });
    }
  }
  new MutationObserver(records => {
    for (const mutation of records) for (const root of mutation.removedNodes) {
      if (root.id === 'sao-startup') record('root-removed', { scene: roots.get(root), focus: document.activeElement?.id });
    }
    sample();
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
  setInterval(sample, 16);
  document.addEventListener('visibilitychange', () => record('visibility', { state: document.visibilityState }));
  window.replay = (animation = '2', sound = false) => {
    document.querySelector('#underlay-input').focus(); record('replay', { animation, sound });
    const state = window[Symbol.for('dsh.sao.replay.v4')]({ animation, sound, startup: true, volume: 0.65 });
    window.lastState = state; sample(); return state.finished;
  };
  window.trace = () => ({ events, samples, finished: window.lastState?.finished,
    roots: document.querySelectorAll('#sao-startup').length, styles: document.querySelectorAll('style[data-sao-link-start]').length,
    focus: document.activeElement?.id, renderer: document.querySelector('#sao-startup canvas')?.dataset.renderer,
    visibility: document.visibilityState, scriptCount: document.scripts.length, workerCount });
  localStorage.setItem('dsh-sao.preferences.v4', JSON.stringify({ startup: false, sound: false }));
}
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Actual SAO startup exit regression</title>
<style>html,body{margin:0;min-height:100%;background:#143b52;color:#e5f6ff;font:18px system-ui}main{padding:72px;background:linear-gradient(135deg,#143b52,#32705a);min-height:100vh;box-sizing:border-box}input,button{font:inherit;padding:12px;margin:8px}p{max-width:760px}</style></head>
<body><main><h1>Live application underlay</h1><p>The unchanged startup renderer covers this page. Its native CSS dissolve should reveal the color gradient and preserve input focus after cleanup.</p><input id="underlay-input" aria-label="Underlay focus target" value="Focus must return here"><button id="native" onclick="replay('1')">Replay native WebGL</button><button id="thin" onclick="replay('2')">Replay thin Canvas 2D</button></main>
<script>(${observe.toString()})();</script><script src="/build/startup.js"></script></body></html>`;
const message = (trace, type) => trace.events.filter(e => e.type === 'worker-message' && e.data.type === type);
const event = (trace, type) => trace.events.filter(e => e.type === type);
function assertClean(trace, { workers = true } = {}) {
  assert.equal(trace.roots, 0, 'startup root removed');
  assert.equal(trace.styles, 0, 'owned CSS removed with root');
  assert.equal(trace.finished, true, 'scene reports completion');
  assert.equal(trace.focus, 'underlay-input', 'native focus restored to previous input');
  assert.equal(event(trace, 'blob-created').length, event(trace, 'blob-revoked').length, 'every worker URL revoked');
  if (workers) assert.equal(event(trace, 'worker-created').length, event(trace, 'worker-terminated').length, 'every real worker terminated');
}
function assertFade(trace, { earliest = 2400, duration = 800, scene = 1 } = {}) {
  const fade = event(trace, 'css-fade').find(e => e.scene === scene);
  const removed = event(trace, 'root-removed').find(e => e.scene === scene);
  assert.ok(fade, 'actual host CSS fade started'); assert.ok(removed, 'root cleanup observed');
  assert.equal(fade.easing, 'ease-in-out');
  const fadeDuration = parseFloat(fade.duration) * 1000;
  assert.ok(Math.abs(fadeDuration - duration) < 2, `fade duration ${fadeDuration} matches ${duration}`);
  const sampled = trace.samples.filter(s => s.scene === scene), fading = sampled.filter(s => s.animation === 'sao-startup-exit');
  assert.ok(fading.length >= 8, 'multiple real computed-opacity samples cover the dissolve');
  assert.ok(fading.some(s => s.opacity > 0.15 && s.opacity < 0.85), 'underlay is revealed through intermediate opacity');
  for (let i = 1; i < fading.length; i++) assert.ok(fading[i].opacity <= fading[i - 1].opacity + 0.002, 'CSS opacity never rises during fade');
  assert.ok(fading.at(-1).opacity < 0.03, 'root becomes transparent before removal');
  assert.ok(removed.at - fade.at >= duration + 15 && removed.at - fade.at < duration + 500,
    `cleanup follows duration+50 timer, observed ${removed.at - fade.at}ms`);
  const added = event(trace, 'root-added').find(e => e.scene === scene);
  const replay = event(trace, 'replay').filter(e => e.at <= added.at).at(-1);
  const start = event(trace, 'worker-send').find(e => e.data.type === 'start' && e.at >= replay.at && e.at <= fade.at);
  const epoch = start ? start.data.epoch - trace.timeOrigin : replay.at + 40;
  const opening = sampled.filter(s => s.at < epoch + earliest - 60);
  assert.ok(opening.length > 30, 'opening was actually sampled');
  assert.ok(opening.every(s => s.opacity === 1 && s.animation !== 'sao-startup-exit'), 'opening never falsely exits despite initially sparse/blank frames');
  return { fade, removed, fadeDuration, start, epoch };
}

test('adaptive startup exit in real Edge workers, WebGL, Canvas and native CSS', { timeout: 150000 }, async t => {
  fs.mkdirSync(artifacts, { recursive: true });
  const manifest = buildFixture(); fs.writeFileSync(path.join(artifacts, 'source-hashes.json'), JSON.stringify(manifest, null, 2));
  const renderer = fs.readFileSync(path.join(artifacts, 'build/source/renderer.js'), 'utf8') + '\n' + fs.readFileSync(path.join(artifacts, 'build/source/thin-renderer.js'), 'utf8');
  const server = http.createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    const pathname = new URL(request.url, 'http://fixture').pathname;
    if (pathname === '/startup.js' || pathname === '/build/startup.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(fs.readFileSync(path.join(artifacts, 'build/startup.js'))); }
    else if (pathname === '/worker.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(renderer + '\n' + fs.readFileSync(path.join(artifacts, 'build/source/worker.js'), 'utf8')); }
    else if (pathname === '/engines.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(renderer + '\nwindow.saoEngines = { NativeSAO, ThinSAO, SAO_EXIT };'); }
    else if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); }
    else { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  fs.writeFileSync(path.join(artifacts, 'index.html'), html);
  assert.doesNotMatch(renderer, /\b(?:readPixels|getImageData)\s*\(/, 'production meter never reads back GPU or canvas pixels');
  const browser = await chromium.launch({ executablePath: process.env.SAO_TEST_EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'] });
  t.after(() => browser.close());
  const results = { manifest, browser: browser.version(), tests: {} };
  t.after(() => {
    results.finalSources = hashes(); results.sourcesStable = JSON.stringify(results.finalSources) === JSON.stringify(manifest.sources);
    fs.writeFileSync(path.join(artifacts, 'regression-evidence.json'), JSON.stringify(results, null, 2));
    assert.deepEqual(results.finalSources, manifest.sources, 'actual source hashes changed during browser run: rebuild and rerun');
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function pageFor(t, options = {}) {
    const context = await browser.newContext({ viewport: { width: 960, height: 540 }, reducedMotion: options.reducedMotion ?? 'no-preference' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
    t.after(async () => {
      try {
        if (!page.isClosed()) {
          await page.evaluate(() => window[Symbol.for('dsh.sao.startup.v3')]?.stop?.());
          const trace = await page.evaluate(() => ({ ...trace(), timeOrigin: performance.timeOrigin }));
          fs.writeFileSync(path.join(artifacts, options.name + '.json'), JSON.stringify(trace, null, 2));
        }
        assert.deepEqual(errors, [], 'no browser errors or unhandled rejections');
      } finally { await context.close(); }
    });
    await page.goto(base + (options.noWorker ? '/?noWorker' : '/'));
    assert.equal(await page.evaluate(() => document.visibilityState), 'visible');
    return page;
  }
  const trace = page => page.evaluate(() => ({ ...window.trace(), timeOrigin: performance.timeOrigin }));
  async function start(page, animation = '2', sound = false) { await page.evaluate(({ animation, sound }) => replay(animation, sound), { animation, sound }); }
  async function ended(page) { await page.waitForFunction(() => lastState?.finished && !document.querySelector('#sao-startup'), null, { timeout: 8000 }); return trace(page); }
  async function fade(page) { await page.waitForFunction(() => events.some(e => e.type === 'css-fade'), null, { timeout: 6500 }); }

  await t.test('unchanged engine coverage matches actual rendered sparse frames and protects native late tail', async t => {
    const page = await pageFor(t, { name: 'geometry' }); await page.addScriptTag({ url: base + '/engines.js' });
    const metrics = await page.evaluate(() => {
      const { NativeSAO, ThinSAO, SAO_EXIT } = saoEngines, output = { policy: SAO_EXIT, cases: [] };
      for (const [name, engine, seed] of [['native', NativeSAO, 1], ['native', NativeSAO, 12345], ['thin', ThinSAO, 1]]) {
        const canvas = document.createElement('canvas'), view = { width: 960, height: 540, dpr: 1 };
        const renderer = engine.createRenderer(canvas, seed, view);
        if (!renderer) throw Error(name + ' real renderer unavailable');
        const gl = name === 'native' ? canvas.getContext('webgl') : null;
        for (const elapsed of [500, 1800, 2400, 4000, 4400, 4500, 4600, 4700, 4900]) {
          renderer.draw(elapsed - 1000);
          const estimate = renderer.lightCoverage(elapsed - 1000);
          let pixels;
          // Test-only pixel evidence; the unmodified production code never reads GPU pixels.
          if (gl) { pixels = new Uint8Array(canvas.width * canvas.height * 4); gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels); }
          else pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          let covered = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            const max = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]), min = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
            if (pixels[i + 3] > 100 && (max - min > 25 || max < 145) && !(name === 'thin' && max - min < 25)) covered++;
          }
          output.cases.push({ name, seed, elapsed, estimate, actual: covered / (canvas.width * canvas.height) });
        }
        let crossing;
        for (let elapsed = name === 'thin' ? SAO_EXIT.earliest : SAO_EXIT.nativeEarliest; elapsed <= SAO_EXIT.latest; elapsed += SAO_EXIT.interval) {
          const coverage = renderer.lightCoverage(elapsed - 1000);
          if (coverage <= SAO_EXIT.threshold || elapsed >= SAO_EXIT.latest) { crossing = { elapsed, coverage }; break; }
        }
        output[name + seed] = crossing; renderer.dispose();
      }
      // Broad deterministic seed check catches randomized native fields that could
      // become sparse before their dense middle. Reuse one real GPU context.
      const canvas = document.createElement('canvas'); output.nativeSeedSweep = [];
      const seeds = [1, 2, 3, 42, 53, 12345, ...Array.from({ length: 58 }, (_, i) => Math.imul(i + 1, 0x9e3779b9) >>> 0)];
      for (const seed of seeds) {
        const renderer = NativeSAO.createRenderer(canvas, seed, { width: 960, height: 540, dpr: 1 });
        const points = [2400, 2700, 3000, 3300, 3600, 3900].map(elapsed => ({ elapsed, coverage: renderer.lightCoverage(elapsed - 1000) }));
        output.nativeSeedSweep.push({ seed, points }); renderer.dispose();
      }
      return output;
    });
    results.tests.geometry = metrics;
    assert.equal(metrics.policy.nativeEarliest, 3800, 'native eligibility protects its later dense phase');
    const premature = metrics.nativeSeedSweep.flatMap(s => s.points.filter(p => p.elapsed >= metrics.policy.nativeEarliest && p.coverage <= metrics.policy.threshold).map(p => ({ seed: s.seed, ...p })));
    assert.deepEqual(premature, [], 'eligible randomized native fields remain dense before the final tail across 64 seeds');
    for (const seed of [3964193269, 2471588371]) {
      const points = metrics.nativeSeedSweep.find(s => s.seed === seed).points;
      assert.ok(points[0].coverage < .18 && points.some(p => p.coverage > .8), 'known pre-peak sparse seed demonstrates why native needs a separate phase guard');
    }
    assert.deepEqual({ earliest: metrics.policy.earliest, threshold: metrics.policy.threshold, duration: metrics.policy.duration, end: metrics.policy.end, interval: metrics.policy.interval },
      { earliest: 2400, threshold: .18, duration: 800, end: 5250, interval: 100 });
    assert.ok(metrics.policy.latest >= 4700 && metrics.policy.latest < metrics.policy.end, 'latest bound allows a genuinely sparse native tail');
    assert.equal(metrics.thin1.elapsed, 2400);
    const thin = metrics.cases.find(c => c.name === 'thin' && c.elapsed === 2400);
    assert.ok(thin.actual > .015 && thin.actual <= .2, `thin is visibly sparse, actual ${thin.actual}`);
    for (const seed of [1, 12345]) {
      const crossing = metrics['native' + seed]; assert.ok(crossing.elapsed >= 4300, `native seed ${seed} waits for its actual tail: ${crossing.elapsed}`);
      const dense = metrics.cases.find(c => c.name === 'native' && c.seed === seed && c.elapsed === 2400);
      assert.ok(dense.actual > .3 && dense.estimate > .18, 'dense native middle does not qualify for fade');
      for (const frame of metrics.cases.filter(c => c.name === 'native' && c.seed === seed && c.elapsed >= 4400))
        assert.ok(Math.abs(frame.actual - frame.estimate) < .065, `CPU geometry tracks actual GPU occupancy at ${frame.elapsed}: ${frame.actual}/${frame.estimate}`);
    }
    const late = metrics.cases.find(c => c.name === 'native' && c.seed === 12345 && c.elapsed === 4500);
    assert.ok(late.actual > .2 && late.estimate > .18, 'regression seed remains too dense at former 4500ms deadline');
    results.tests.geometry = metrics;
  });

  await t.test('rare native seeds with sparse pre-peak frames do not exit before their later dense phase', async t => {
    const page = await pageFor(t, { name: 'native-rare-seeds' });
    await page.evaluate(() => {
      window.seedTrials = [3964193269, 2471588371].map(seed => {
        const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:480px;height:270px'; document.body.append(canvas);
        const worker = new Worker('/worker.js'), trial = { seed, messages: [], worker };
        worker.onmessage = ({ data }) => {
          trial.messages.push({ ...data, at: performance.now() });
          if (data.type === 'ready') worker.postMessage({ type: 'start', epoch: performance.timeOrigin + performance.now() + 40 });
          if (data.type === 'fade') trial.fade = data;
          if (data.type === 'done') { trial.done = data; worker.terminate(); canvas.remove(); }
          if (data.type === 'unsupported') trial.error = 'real rare-seed renderer unsupported';
        };
        worker.onerror = event => { trial.error = event.message; };
        const offscreen = canvas.transferControlToOffscreen();
        worker.postMessage({ type: 'init', animation: '1', canvas: offscreen, seed, view: { width: 960, height: 540, dpr: 1 } }, [offscreen]);
        return trial;
      });
    });
    await page.waitForFunction(() => seedTrials.every(trial => trial.done || trial.error), null, { timeout: 7500 });
    const trials = await page.evaluate(() => seedTrials.map(({ worker, ...trial }) => trial));
    for (const trial of trials) {
      assert.equal(trial.error, undefined); assert.ok(trial.fade, 'real worker emitted adaptive fade');
      assert.ok(trial.fade.elapsed >= 4300 && trial.fade.elapsed <= 5050, `seed ${trial.seed} passed its formerly premature 2400ms exit: ${trial.fade.elapsed}`);
      assert.ok(trial.fade.coverage <= .18 || trial.fade.elapsed >= 4900);
      assert.ok(Math.abs(trial.fade.duration - Math.min(800, 5250 - trial.fade.elapsed)) < .001);
      assert.ok(trial.done.frames > 100, 'worker rendered through the dense middle');
      assert.equal(trial.messages.filter(message => message.type === 'fade').length, 1);
      const fade = trial.messages.find(message => message.type === 'fade'), done = trial.messages.find(message => message.type === 'done');
      assert.ok(done.at - fade.at >= trial.fade.duration - 60, 'rare seed worker remains alive until fade exitAt');
    }
    results.tests.nativeRareSeeds = trials;
  });

  await t.test('thin real worker exits early after protected opening with monotonic CSS, sound fade and cleanup', async t => {
    const page = await pageFor(t, { name: 'thin-worker' }); await start(page, '2', true);
    await page.waitForFunction(() => samples.some(s => s.at > events.find(e => e.type === 'replay').at + 2100));
    const opening = await trace(page); assert.equal(message(opening, 'fade').length, 0); assert.equal(opening.renderer, 'worker-canvas2d');
    await page.screenshot({ path: path.join(artifacts, 'thin-opening.png') });
    await fade(page); await page.waitForFunction(() => +getComputedStyle(document.querySelector('#sao-startup')).opacity < .65);
    await page.screenshot({ path: path.join(artifacts, 'thin-fade.png') });
    const state = await ended(page), request = message(state, 'fade'); assert.equal(request.length, 1);
    assert.ok(request[0].data.elapsed >= 2400 && request[0].data.elapsed < 2650, JSON.stringify(request[0].data));
    assert.ok(request[0].data.coverage > .01 && request[0].data.coverage <= .18);
    assert.equal(request[0].data.duration, 800); assert.equal(message(state, 'ready').length, 1); assert.equal(message(state, 'done').length, 1);
    const lifecycle = assertFade(state); assertClean(state);
    const done = message(state, 'done')[0];
    assert.ok(done.at - request[0].at >= 730 && done.at - request[0].at < 1100, 'worker stays alive through its fade and closes at exitAt');
    assert.ok(done.data.frames > 60 && done.data.width === 960 && done.data.height === 540, 'real offscreen worker rendered frames');
    const ramp = event(state, 'audio-linearRampToValueAtTime'); assert.equal(ramp.length, 1);
    assert.equal(ramp[0].args[0], 0); assert.ok(Math.abs(ramp[0].args[1] - ramp[0].time - .8) < .03, 'real audio gain ramps to zero over the same 800ms');
    assert.equal(event(state, 'audio-closed').length, 1);
    await page.screenshot({ path: path.join(artifacts, 'thin-cleanup.png') });
    results.tests.thinWorker = { fade: request[0].data, cleanupAfterFade: lifecycle.removed.at - lifecycle.fade.at, frames: done.data.frames };
  });

  await t.test('native WebGL worker keeps dense animation until late sparse coverage and clamps final fade', async t => {
    const page = await pageFor(t, { name: 'native-worker' }); await start(page, '1');
    await page.waitForFunction(() => samples.some(s => s.at > events.find(e => e.type === 'replay').at + 3800));
    const middle = await trace(page); assert.equal(middle.renderer, 'worker-webgl'); assert.equal(message(middle, 'fade').length, 0);
    await page.screenshot({ path: path.join(artifacts, 'native-dense.png') });
    await fade(page); const during = await trace(page), request = message(during, 'fade')[0];
    assert.ok(request.data.elapsed >= 4200 && request.data.elapsed <= results.tests.geometry.policy.latest + 150, JSON.stringify(request.data));
    assert.ok(request.data.coverage <= .18 || request.data.elapsed >= results.tests.geometry.policy.latest);
    assert.ok(Math.abs(request.data.duration - Math.min(800, 5250 - request.data.elapsed)) < .001, 'native late fade respects hard animation end');
    await page.waitForFunction(() => +getComputedStyle(document.querySelector('#sao-startup')).opacity < .7);
    await page.screenshot({ path: path.join(artifacts, 'native-fade.png') });
    const state = await ended(page); const lifecycle = assertFade(state, { earliest: results.tests.geometry.policy.nativeEarliest, duration: request.data.duration }); assertClean(state);
    assert.equal(message(state, 'unsupported').length, 0); assert.equal(message(state, 'done').length, 1);
    assert.ok(message(state, 'done')[0].data.frames > 100, 'real WebGL worker ran throughout native scene');
    results.tests.nativeWorker = { seed: event(state, 'worker-send').find(e => e.data.type === 'init').data.seed, fade: request.data, cleanupAfterFade: lifecycle.removed.at - lifecycle.fade.at };
  });

  for (const animation of ['2', '1']) await t.test(`Worker unavailable uses unchanged ${animation === '2' ? 'Canvas' : 'WebGL'} main-thread coverage and fade policy`, async t => {
    const page = await pageFor(t, { name: 'fallback-' + animation, noWorker: true }); await start(page, animation);
    await fade(page); const during = await trace(page), css = event(during, 'css-fade')[0], replay = event(during, 'replay')[0];
    assert.equal(during.renderer, animation === '2' ? 'canvas2d' : 'webgl'); assert.equal(event(during, 'worker-created').length, 0);
    const elapsed = css.at - replay.at - 40;
    assert.ok(animation === '2' ? elapsed >= 2380 && elapsed < 2700 : elapsed >= 4200 && elapsed <= 5100, `fallback fade elapsed ${elapsed}`);
    const state = await ended(page); const actualDuration = parseFloat(css.duration) * 1000;
    assertFade(state, { earliest: animation === '2' ? 2400 : 3800, duration: actualDuration }); assertClean(state, { workers: false });
    assert.ok(animation === '2' ? actualDuration === 800 : actualDuration <= 800 && actualDuration >= 200);
    results.tests['fallback' + animation] = { elapsed, duration: actualDuration };
  });

  await t.test('click, Escape, focus trap and replay replacement dismiss immediately without stale timers', async t => {
    const page = await pageFor(t, { name: 'interruptions' });
    await start(page, '2'); await page.waitForFunction(() => events.some(e => e.type === 'worker-message' && e.data.type === 'ready'));
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.className), 'sao-skip');
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.className), 'sao-skip');
    const clickAt = await page.evaluate(() => performance.now()); await page.locator('#sao-startup').click({ position: { x: 30, y: 40 } });
    let state = await ended(page); assertClean(state); assert.equal(event(state, 'css-fade').length, 0);
    assert.ok(event(state, 'root-removed')[0].at - clickAt < 400, 'early click never waits for an 800ms fade');
    await start(page, '1'); await page.keyboard.press('Escape'); state = await ended(page); assertClean(state);
    assert.equal(event(state, 'css-fade').length, 0, 'early Escape also removes immediately');
    await start(page, '2'); const before = await page.evaluate(() => lastState.finished);
    assert.equal(before, false);
    // Native replay stops its predecessor synchronously; no second startup script is injected.
    const replacement = await page.evaluate(() => { const old = lastState; replay('1'); return { oldFinished: old.finished, roots: document.querySelectorAll('#sao-startup').length }; });
    assert.deepEqual(replacement, { oldFinished: true, roots: 1 });
    await page.keyboard.press('Escape'); state = await ended(page); assertClean(state); assert.equal(state.scriptCount, 2);
    assert.equal(event(state, 'worker-created').length, 4);
    // Run a natural replay after aborted scenes, through their old finish deadlines.
    await start(page, '2'); await fade(page); state = await ended(page); assertClean(state);
    assert.equal(event(state, 'css-fade').length, 1); assert.equal(message(state, 'fade').length, 1);
    assertFade(state, { scene: 5 }); results.tests.interruptions = { scenes: 5, workers: state.workerCount, clean: true };
  });

  await t.test('Escape during dissolve cancels cleanup timer and a new replay retains a full independent fade', async t => {
    const page = await pageFor(t, { name: 'fade-replay' }); await start(page, '2'); await fade(page);
    await page.keyboard.press('Escape'); let state = await ended(page); assertClean(state);
    await start(page, '2'); await page.waitForFunction(() => events.filter(e => e.type === 'css-fade').length === 2, null, { timeout: 6000 });
    state = await ended(page); assertClean(state); assertFade(state, { scene: 2 });
    assert.equal(message(state, 'fade').length, 2); assert.equal(message(state, 'done').length, 1, 'aborted fade worker cannot finish the new scene');
    results.tests.fadeReplay = { fades: 2, clean: true };
  });

  await t.test('real hidden-tab lifecycle disposes an active worker and defers a hidden replay until visible', async t => {
    // Ordinary Playwright contexts force focus/visibility emulation. Attach to a
    // disposable native Edge with noDefaults to observe genuine browser events.
    const profile = fs.mkdtempSync(path.join(artifacts, 'visibility-profile-'));
    const edge = spawn(process.env.SAO_TEST_EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      ['--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
    let nativeBrowser, page, client; const errors = [];
    t.after(async () => {
      try {
        if (page && !page.isClosed()) {
          await page.evaluate(() => window[Symbol.for('dsh.sao.startup.v3')]?.stop?.());
          fs.writeFileSync(path.join(artifacts, 'visibility.json'), JSON.stringify(await trace(page), null, 2));
        }
        assert.deepEqual(errors, [], 'native lifecycle browser has no errors');
      } finally {
        const exited = new Promise(resolve => edge.once('exit', resolve));
        await client?.send('Browser.close').catch(() => {});
        await nativeBrowser?.close().catch(() => {});
        edge.kill(); await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 1500))]);
        // Only delete this test's uniquely created, verified profile directory.
        assert.ok(path.resolve(profile).startsWith(path.resolve(artifacts) + path.sep + 'visibility-profile-'));
        fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      }
    });
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await new Promise(resolve => setTimeout(resolve, 100));
    assert.ok(fs.existsSync(portFile), 'native Edge exposes its disposable CDP endpoint');
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
    nativeBrowser = await chromium.connectOverCDP('http://127.0.0.1:' + port, { noDefaults: true });
    const context = nativeBrowser.contexts()[0]; page = context.pages()[0];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', item => { if (item.type() === 'error') errors.push(item.text()); });
    client = await context.newCDPSession(page);
    await page.setViewportSize({ width: 960, height: 540 }); await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(base); await page.bringToFront(); await start(page, '2');
    await page.waitForFunction(() => events.some(e => e.type === 'worker-message' && e.data.type === 'ready'));
    const foreground = await context.newPage(); await foreground.bringToFront();
    await page.waitForFunction(() => document.hidden && lastState.finished, null, { polling: 50, timeout: 5000 });
    let state = await trace(page); assertClean(state);
    assert.ok(event(state, 'visibility').some(e => e.state === 'hidden'), 'browser delivered a genuine hidden visibilitychange');
    assert.equal(event(state, 'css-fade').length, 0, 'hiding dismisses immediately');
    await start(page, '2'); state = await trace(page);
    const hiddenReplay = event(state, 'replay').at(-1);
    assert.equal(state.finished, false); assert.equal(state.roots, 1);
    assert.equal(event(state, 'worker-send').filter(e => e.data.type === 'start' && e.at >= hiddenReplay.at).length, 0, 'hidden scene has not started its clock');
    await foreground.close(); await page.bringToFront();
    await page.waitForFunction(at => !document.hidden && events.some(e => e.type === 'worker-send' && e.data.type === 'start' && e.at >= at), hiddenReplay.at, { timeout: 5000 });
    state = await ended(page); assertClean(state); assertFade(state, { scene: 2 });
    assert.equal(message(state, 'fade').length, 1); assert.equal(message(state, 'done').length, 1);
    assert.ok(event(state, 'visibility').some(e => e.state === 'visible'));
    results.tests.visibility = { genuineHiddenEvent: true, hiddenReplayDeferred: true, clean: true };
  });

  await t.test('reduced motion preserves static 900ms path and motion changes dispose an active worker', async t => {
    const page = await pageFor(t, { name: 'reduced-motion', reducedMotion: 'reduce' }); await start(page, '1', true);
    assert.equal(await page.locator('#sao-startup canvas').getAttribute('data-renderer'), 'static');
    assert.equal(await page.locator('.sao-intro').isVisible(), true);
    let state = await ended(page); assertClean(state); assert.equal(event(state, 'worker-created').length, 0); assert.equal(event(state, 'audio-gain').length, 0);
    const duration = event(state, 'root-removed')[0].at - event(state, 'replay')[0].at;
    assert.ok(duration >= 880 && duration < 1300, `static lifetime ${duration}`); assert.equal(event(state, 'css-fade').length, 0);
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await start(page, '2');
    await page.waitForFunction(() => events.some(e => e.type === 'worker-message' && e.data.type === 'ready'));
    await page.emulateMedia({ reducedMotion: 'reduce' }); state = await ended(page); assertClean(state);
    assert.equal(event(state, 'worker-created').length, 1); results.tests.reducedMotion = { duration, changeCleanedWorker: true };
  });
});
