// Real Edge alpha regression. Production source/build output is never rewritten.
// Run only after source freeze, with SAO_EXIT_FIXTURE pointing at alpha-background/fixture.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SAO_TEST_PLAYWRIGHT ?? 'C:/DSH/graduation-office/node_modules/.pnpm/playwright@1.64.0/node_modules/playwright');
const repo = fileURLToPath(new URL('..', import.meta.url));
const artifacts = process.env.SAO_EXIT_FIXTURE ?? 'C:/SAO/releases/1.0.5/alpha-background/fixture';
const baseline = process.env.SAO_ALPHA_BASELINE_SOURCE ?? 'C:/SAO/releases/1.0.5/coverage-fade/fixture/build/source';
const inputs = ['build.py', 'renderer.js', 'thin-renderer.js', 'worker.js', 'startup.template.js'];
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const hashes = () => Object.fromEntries(inputs.map(name => [name, sha(fs.readFileSync(path.join(repo, 'source', name)))]));
function buildFixture() {
  const sources = hashes(), build = path.join(artifacts, 'build');
  fs.mkdirSync(path.join(build, 'source'), { recursive: true });
  for (const name of inputs) fs.copyFileSync(path.join(repo, 'source', name), path.join(build, 'source', name));
  const result = spawnSync(process.env.SAO_TEST_PYTHON ?? 'python', [path.join(build, 'source/build.py'), '--archive', process.env.SAO_TEST_ARCHIVE ?? path.resolve(repo, '../original/SAO.zip')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.error?.message || result.stdout);
  assert.deepEqual(hashes(), sources, 'source freeze held while the original builder compiled the fixture');
  const oldSources = Object.fromEntries(['renderer.js', 'thin-renderer.js'].map(name => [name, sha(fs.readFileSync(path.join(baseline, name)))]));
  return { sources, baseline: oldSources, startup: sha(fs.readFileSync(path.join(build, 'startup.js'))), builder: result.stdout.trim(), builtAt: new Date().toISOString() };
}
// Shared test-only reader. Returned values describe actual RGBA buffers, including
// the fraction of genuine holes and fully opaque colored/black foreground pixels.
function readFrame(canvas, kind) {
  const width = canvas.width, height = canvas.height;
  let pixels;
  if (kind === '1') {
    const gl = canvas.getContext('webgl');
    pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  } else pixels = canvas.getContext('2d').getImageData(0, 0, width, height).data;
  let transparent = 0, partial = 0, opaque = 0, ink = 0, minAlpha = 255, alphaSum = 0;
  const histogram = new Uint32Array(256);
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3], max = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]), min = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
    minAlpha = Math.min(minAlpha, alpha); alphaSum += alpha; histogram[alpha]++;
    if (alpha === 0) transparent++; else if (alpha < 255) partial++; else opaque++;
    if (alpha > 100 && (max - min > 25 || max < 145)) ink++;
  }
  let p05Alpha = 0, cumulative = 0;
  while (p05Alpha < 255 && (cumulative += histogram[p05Alpha]) < width * height * .05) p05Alpha++;
  const count = width * height, holePoints = [];
  for (let y = 180; y < height - 40; y += 40) for (let x = 20; x < width - 40; x += 40) {
    const row = kind === '1' ? height - 1 - y : y;
    if (pixels[(row * width + x) * 4 + 3] <= minAlpha + 1) holePoints.push(y * width + x);
  }
  return { width, height, minAlpha, p05Alpha, meanAlpha: alphaSum / count, transparent: transparent / count, partial: partial / count, opaque: opaque / count, ink: ink / count, holePoints };
}
function workerObserver() {
  const nativePost = self.postMessage.bind(self);
  for (const [animation, engine] of [['1', NativeSAO], ['2', ThinSAO]]) {
    const create = engine.createRenderer;
    engine.createRenderer = function(canvas, ...args) {
      const renderer = create.call(this, canvas, ...args);
      if (!renderer) return renderer;
      const draw = renderer.draw; let last = -Infinity;
      renderer.draw = function(...args) {
        const result = draw.apply(this, args), elapsed = args[0] + 1000;
        if (elapsed >= 1400 && elapsed - last >= 100) {
          last = elapsed;
          nativePost({ type: 'alpha-probe', elapsed, backgroundOpacity: args[1], animation, ...readFrame(canvas, animation) });
        }
        return result;
      };
      return renderer;
    };
  }
}
function observe(workerSuffix) {
  window.alphaEvents = []; window.alphaSamples = []; window.liveTicks = 0;
  const record = (type, data = {}) => alphaEvents.push({ type, at: performance.now(), ...data });
  const NativeWorker = window.Worker;
  if (new URLSearchParams(location.search).has('noWorker')) window.Worker = undefined;
  else window.Worker = class extends NativeWorker {
    constructor(...args) {
      super(...args); record('worker-created');
      this.addEventListener('message', ({ data }) => record('worker-message', { data }));
    }
    postMessage(data, ...args) { if (data.type === 'start') epoch = data.epoch; record('worker-send', { data: { ...data, canvas: !!data.canvas } }); return super.postMessage(data, ...args); }
    terminate() { record('worker-terminated'); return super.terminate(); }
  };
  // Append observation after the verbatim real worker source. Its onmessage,
  // requestAnimationFrame, renderers and draw calls all remain native and active.
  const createURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = blob => createURL(new Blob([blob, workerSuffix], { type: blob.type }));
  let epoch = 0, lastSample = -Infinity;
  const nativeRAF = window.requestAnimationFrame.bind(window);
  function sample(now) {
    const root = document.querySelector('#sao-startup'), canvas = root?.querySelector('canvas');
    if (!root || !canvas || now - lastSample < 80) return;
    lastSample = now;
    const background = root.querySelector('.sao-backdrop'), css = getComputedStyle(root), backdrop = background && getComputedStyle(background);
    const elapsed = performance.timeOrigin + now - epoch;
    const sample = { at: now, elapsed, rootOpacity: +css.opacity, rootBackground: css.backgroundColor, rootAnimation: css.animationName,
      backdropOpacity: backdrop ? +backdrop.opacity : null, backdropBackground: backdrop?.backgroundColor,
      renderer: canvas.dataset.renderer, width: canvas.width, height: canvas.height, liveTicks };
    if (canvas.dataset.renderer === 'webgl' || canvas.dataset.renderer === 'canvas2d') sample.buffer = readFrame(canvas, canvas.dataset.renderer === 'webgl' ? '1' : '2');
    alphaSamples.push(sample);
  }
  window.requestAnimationFrame = callback => nativeRAF(now => { callback(now); sample(now); });
  setInterval(() => sample(performance.now()), 80);
  // Independent app code loads and updates beneath the overlay, on its own clock.
  setTimeout(() => {
    document.querySelector('main').innerHTML = '<h1 id="app-state">Live application loaded</h1><output id="app-ticks"></output><input id="underlay-input" value="App is interactive after startup">';
    record('app-loaded', { rootPresent: !!document.querySelector('#sao-startup') });
    setInterval(() => { document.querySelector('#app-ticks').textContent = 'Live DOM update ' + ++liveTicks; }, 60);
  }, 120);
  window.setUnderlay = phase => { document.body.dataset.phase = phase; document.querySelector('#app-state').textContent = 'Live application phase ' + phase; record('app-update', { phase, rootOpacity: +getComputedStyle(document.querySelector('#sao-startup')).opacity }); };
  window.replayAlpha = animation => {
    record('replay', { animation });
    window.alphaState = window[Symbol.for('dsh.sao.replay.v4')]({ startup: true, sound: false, animation });
    // The main renderer is created synchronously before production start() sets
    // its epoch. Observing before replay includes WebGL compilation in elapsed.
    // Workers retain the exact start-message epoch observed in postMessage above.
    if (new URLSearchParams(location.search).has('noWorker')) epoch = performance.timeOrigin + performance.now() + 40;
    return true;
  };
  localStorage.setItem('dsh-sao.preferences.v4', JSON.stringify({ startup: false, sound: false }));
}
const suffix = '\n' + readFrame.toString() + '\n(' + workerObserver.toString() + ')();';
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Real startup alpha and live app</title><style>
html,body{margin:0;width:100%;height:100%;font:16px system-ui}body{--a:#006aff;--b:#ff6a00;background:conic-gradient(var(--a) 25%,var(--b) 0 50%,var(--a) 0 75%,var(--b) 0) 0 0/80px 80px}body[data-phase="1"]{--a:#00ff44;--b:#aaff00}main{padding:28px;color:#fff}h1,output,input{position:relative;z-index:0}output{display:block}
</style></head><body data-phase="0"><main></main><script>${readFrame.toString()}\n(${observe.toString()})(${JSON.stringify(suffix)});</script><script src="/startup.js"></script></body></html>`;

// Decode the actual browser-composited screenshot with the browser's own PNG
// decoder. This reads a detached test canvas, never a production runtime path.
async function screenshotMetrics(page, name) {
  const started = await page.evaluate(() => performance.now());
  const png = await page.screenshot({ path: path.join(artifacts, name + '.png') });
  const ended = await page.evaluate(() => performance.now());
  return page.evaluate(async ({ base64, started, ended }) => {
    const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let tint = 0, pixels = 0, redBlue = 0, green = 0;
    // Bottom-left avoids the app heading, startup skip text and central glow.
    for (let y = 300; y < Math.min(460, canvas.height); y += 2) for (let x = 20; x < 300; x += 2) {
      const i = (y * canvas.width + x) * 4;
      if (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 8) tint++;
      redBlue += data[i] + data[i + 2]; green += data[i + 1]; pixels++;
    }
    const grid = [];
    for (let y = 180; y < canvas.height - 40; y += 40) for (let x = 20; x < canvas.width - 40; x += 40) {
      const i = (y * canvas.width + x) * 4;
      grid.push({ point: y * canvas.width + x, rgb: Array.from(data.slice(i, i + 3)), checkerSign: (Math.floor(x / 40) + Math.floor(y / 40)) % 2 === 0 ? 1 : -1 });
    }
    return { started, ended, grid, tintedFraction: tint / pixels, meanRedBlue: redBlue / pixels, meanGreen: green / pixels,
      rootOpacity: +getComputedStyle(document.querySelector('#sao-startup')).opacity, ticks: liveTicks };
  }, { base64: png.toString('base64'), started, ended });
}

test('startup background becomes real alpha independently of foreground exit', { timeout: 110000 }, async t => {
  fs.mkdirSync(artifacts, { recursive: true });
  const manifest = buildFixture(); fs.writeFileSync(path.join(artifacts, 'alpha-source-hashes.json'), JSON.stringify(manifest, null, 2));
  const source = name => fs.readFileSync(path.join(artifacts, 'build/source', name), 'utf8');
  const engines = source('renderer.js') + '\n' + source('thin-renderer.js');
  const oldEngines = fs.readFileSync(path.join(baseline, 'renderer.js'), 'utf8') + '\n' + fs.readFileSync(path.join(baseline, 'thin-renderer.js'), 'utf8');
  assert.doesNotMatch(engines + source('worker.js') + source('startup.template.js'), /\b(?:readPixels|getImageData)\s*\(/, 'runtime has no readback');
  const server = http.createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    const pathname = new URL(request.url, 'http://fixture').pathname;
    if (pathname === '/startup.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(fs.readFileSync(path.join(artifacts, 'build/startup.js'))); }
    else if (pathname === '/engines.js') { response.setHeader('Content-Type', 'text/javascript'); response.end('window.saoEngines = (() => {\n' + engines + '\nreturn { NativeSAO, ThinSAO, SAO_EXIT, saoStartupBackgroundOpacity };})();\nwindow.saoBaseline = (() => {\n' + oldEngines + '\nreturn { NativeSAO, ThinSAO };})();'); }
    else if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); }
    else { response.setHeader('Content-Type', 'text/html;charset=utf-8'); response.end(html); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  fs.writeFileSync(path.join(artifacts, 'alpha-index.html'), html);
  const browser = await chromium.launch({ executablePath: process.env.SAO_TEST_EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  t.after(() => browser.close());
  const evidence = { manifest, browser: browser.version(), tests: {} };
  t.after(() => {
    evidence.finalSources = hashes(); fs.writeFileSync(path.join(artifacts, 'alpha-regression-evidence.json'), JSON.stringify(evidence, null, 2));
    assert.deepEqual(evidence.finalSources, manifest.sources, 'source freeze held throughout real browser verification');
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function pageFor(t, name, noWorker = false) {
    const context = await browser.newContext({ viewport: { width: 960, height: 540 }, reducedMotion: 'no-preference' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
    t.after(async () => {
      try {
        if (!page.isClosed()) {
          await page.evaluate(() => window[Symbol.for('dsh.sao.startup.v3')]?.stop?.());
          fs.writeFileSync(path.join(artifacts, name + '-alpha.json'), JSON.stringify(await page.evaluate(() => ({ events: alphaEvents, samples: alphaSamples, liveTicks })), null, 2));
        }
        assert.deepEqual(errors, [], 'real browser reports no errors');
      } finally { await context.close(); }
    });
    await page.goto(base + (noWorker ? '/?noWorker' : '/'));
    return page;
  }

  await t.test('native RGBA/default pixels and thin streak color survive background-only alpha and resize', async t => {
    const page = await pageFor(t, 'buffers'); await page.addScriptTag({ url: base + '/engines.js' });
    const frames = await page.evaluate(() => {
      const output = { policy: [], originals: [], alpha: [], resize: [] };
      for (const [animation, start] of [['1', 3000], ['2', 1600]]) {
        const opacity = saoEngines.saoStartupBackgroundOpacity;
        output.policy.push({ animation, start, before: opacity(start - 1, animation), first: opacity(start, animation), midpoint: opacity(start + 600, animation), last: opacity(start + 1200, animation), after: opacity(start + 1500, animation),
          samples: Array.from({ length: 25 }, (_, i) => opacity(start + i * 50, animation)) });
      }
      const read = (canvas, animation) => {
        if (animation === '2') return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        const gl = canvas.getContext('webgl'), data = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data); return data;
      };
      const different = (a, b) => { let count = 0, max = 0, first; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d) { count++; if (!first) { const pixel = i - i % 4; first = { pixel, a: Array.from(a.slice(pixel, pixel + 4)), b: Array.from(b.slice(pixel, pixel + 4)) }; } } max = Math.max(max, d); } return { count, max, first }; };
      for (const [animation, name, seed] of [['1', 'NativeSAO', 1], ['1', 'NativeSAO', 12345], ['2', 'ThinSAO', 1]]) {
        const canvas = document.createElement('canvas'), oldCanvas = document.createElement('canvas');
        const view = { width: 640, height: 360, dpr: 1 };
        const renderer = saoEngines[name].createRenderer(canvas, seed, view), original = saoBaseline[name].createRenderer(oldCanvas, seed, { ...view });
        if (!renderer || !original) throw Error('real ' + name + ' renderer unavailable');
        for (const total of [0, 1000, 1500, 2200, 3000, 3600, 4400, 4800]) {
          renderer.draw(total - 1000); const defaults = read(canvas, animation);
          original.draw(total - 1000); const old = read(oldCanvas, animation);
          renderer.draw(total - 1000, 1); const explicit = read(canvas, animation);
          // Equal readback counts keep Edge's adaptive Canvas GPU/CPU selection
          // identical on both real contexts; unequal reads can change raster RGB.
          original.draw(total - 1000); const oldExplicit = read(oldCanvas, animation);
          output.originals.push({ animation, seed, total, defaultVsOne: different(defaults, explicit), defaultVsOriginal: different(defaults, old), explicitVsOriginal: different(explicit, oldExplicit) });
        }
        for (const total of animation === '1' ? [3400, 3600, 4400] : [2200, 2800, 3600]) {
          renderer.draw(total - 1000, 1); const opaque = read(canvas, animation), originalBackgroundAlpha = readFrame(canvas, animation).p05Alpha;
          renderer.draw(total - 1000, 0); const clear = read(canvas, animation), summary = readFrame(canvas, animation);
          let solidInk = 0, alteredSolidInk = 0, compositedInk = 0, compositionError = 0, translucentInk = 0, whiteHoles = 0;
          for (let i = 0; i < clear.length; i += 4) {
            const a = clear[i + 3], max = Math.max(clear[i], clear[i + 1], clear[i + 2]), min = Math.min(clear[i], clear[i + 1], clear[i + 2]);
            if (!a && opaque[i + 3] > 0) whiteHoles++;
            if (a === 255 && (max - min > 25 || max < 145)) {
              solidInk++; if (opaque.slice(i, i + 4).some((c, j) => c !== clear[i + j])) alteredSolidInk++;
            }
            // Thin foreground has original intrinsic alpha (<= .88). Away from
            // the white glow, compositing it over the historical background must
            // reconstruct the unchanged original RGB within byte rounding.
            const pixel = i / 4, x = pixel % canvas.width, y = Math.floor(pixel / canvas.width);
            const outsideGlow = Math.hypot(x - canvas.width / 2, y - canvas.height / 2) > Math.min(view.width, view.height) * .83 * .26 + 3;
            if (animation === '2' && outsideGlow && a >= 150 && max - min > 25) {
              translucentInk++; let maxError = 0;
              for (let c = 0; c < 3; c++) maxError = Math.max(maxError, Math.abs(opaque[i + c] - (clear[i + c] * a / 255 + [251, 253, 255][c] * (1 - a / 255))));
              if (maxError <= 3) compositedInk++; compositionError = Math.max(compositionError, maxError);
            }
          }
          renderer.draw(total - 1000, .5); const half = readFrame(canvas, animation);
          output.alpha.push({ animation, seed, total, ...summary, originalBackgroundAlpha, solidInk, alteredSolidInk, whiteHoles, translucentInk, compositedInk, compositionError, half });
        }
        view.width = 720; view.height = 400;
        renderer.draw(2600, 0); const resized = readFrame(canvas, animation);
        renderer.draw(2600, .35); const resizedPartial = readFrame(canvas, animation);
        output.resize.push({ animation, seed, clear: resized, partial: resizedPartial });
        renderer.dispose(); original.dispose();
      }
      return output;
    });
    evidence.tests.buffers = frames;
    for (const policy of frames.policy) {
      assert.deepEqual([policy.before, policy.first, policy.midpoint, policy.last, policy.after], [1, 1, .5, 0, 0]);
      for (let i = 0; i < policy.samples.length; i++) {
        const p = i / 24, expected = 1 - p * p * (3 - 2 * p);
        assert.ok(Math.abs(policy.samples[i] - expected) < 1e-12, 'shared policy is the specified 1200ms smoothstep');
      }
    }
    for (const frame of frames.originals) {
      assert.equal(frame.defaultVsOne.count, 0, JSON.stringify(frame));
      assert.equal(frame.defaultVsOriginal.count, 0, 'default=1 preserves actual pre-alpha pixels: ' + JSON.stringify(frame));
      assert.equal(frame.explicitVsOriginal.count, 0, 'explicit=1 also preserves original pixels under equal browser readback history');
    }
    for (const frame of frames.alpha) {
      assert.ok(frame.transparent > .015 && frame.whiteHoles > 1000, 'white background and glow become actual empty RGBA pixels: ' + JSON.stringify(frame));
      assert.ok(frame.ink > .01, 'visible foreground ink remains in transparent frame');
      if (frame.animation === '1') {
        assert.equal(frame.alteredSolidInk, 0, 'fully covered native colored/black streak RGB and alpha stay byte exact');
        assert.ok(frame.solidInk > 1000, 'native foreground comparison covers real fully opaque streak pixels');
      }
      else {
        assert.ok(frame.translucentInk > 100, 'thin comparison covers its intrinsically translucent streak interiors');
        assert.ok(frame.compositedInk / frame.translucentInk > .99, 'original thin ink reconstructed without foreground dimming');
      }
      assert.ok(Math.abs(frame.half.p05Alpha - frame.originalBackgroundAlpha / 2) <= 2, 'half background alpha retains the original native camera fade without an opaque matte');
    }
    for (const resize of frames.resize) {
      assert.deepEqual([resize.clear.width, resize.clear.height], [720, 400]);
      assert.equal(resize.clear.p05Alpha, 0, 'resize does not restore opaque background');
      assert.ok(resize.partial.p05Alpha >= 87 && resize.partial.p05Alpha <= 91, 'resize preserves requested partial alpha');
    }
  });

  for (const noWorker of [false, true]) for (const animation of ['1', '2']) {
    const name = (noWorker ? 'main' : 'worker') + '-' + (animation === '1' ? 'native' : 'thin');
    await t.test(name + ' reveals a concurrently updating checker app while root opacity stays one', async t => {
      const page = await pageFor(t, name, noWorker), target = animation === '1' ? 3340 : 2020;
      await page.evaluate(animation => replayAlpha(animation), animation);
      await page.waitForFunction(target => alphaSamples.some(s => s.elapsed >= target && s.rootOpacity === 1), target, { timeout: 6500 });
      const before = await screenshotMetrics(page, name + '-live-before');
      await page.evaluate(() => setUnderlay('1'));
      const after = await screenshotMetrics(page, name + '-live-after');
      assert.equal(before.rootOpacity, 1, 'first screenshot composed with fully opaque root');
      assert.equal(after.rootOpacity, 1, 'live DOM update was visible before any whole-overlay opacity fade');
      assert.ok(before.ticks >= 15 && after.ticks >= before.ticks, 'independently loaded app continues updating under startup');
      assert.ok(before.tintedFraction > .05 && after.tintedFraction > .05, 'colored application is visible through background holes');
      const during = await page.evaluate(() => ({ events: alphaEvents, samples: alphaSamples }));
      const holeEvidence = (shot, phase) => {
        const observations = noWorker ? during.samples.filter(s => s.buffer).map(s => ({ at: s.at, ...s.buffer })) : during.events.filter(e => e.type === 'worker-message' && e.data.type === 'alpha-probe').map(e => ({ at: e.at, ...e.data }));
        const nearest = observations.reduce((a, b) => Math.abs(a.at - (shot.started + shot.ended) / 2) < Math.abs(b.at - (shot.started + shot.ended) / 2) ? a : b);
        const holes = new Set(nearest.holePoints);
        const matches = shot.grid.filter(p => holes.has(p.point) && (phase === 0 ? (p.rgb[0] - p.rgb[2]) * p.checkerSign > 2 : p.rgb[1] - (p.rgb[0] + p.rgb[2]) / 2 > 3));
        return { sampledHoles: holes.size, matchingComposedHoles: matches.length, sampleAt: nearest.at };
      };
      before.holes = holeEvidence(before, 0); after.holes = holeEvidence(after, 1);
      assert.ok(before.holes.matchingComposedHoles >= 2, 'real measured canvas holes reveal the initial colored checker: ' + JSON.stringify(before.holes));
      assert.ok(after.holes.matchingComposedHoles >= 2, 'real measured canvas holes reveal the changed live DOM palette: ' + JSON.stringify(after.holes));
      const appLoad = during.events.find(e => e.type === 'app-loaded'); assert.equal(appLoad.rootPresent, true, 'real app code loaded concurrently beneath active startup');
      const expectedRenderer = (noWorker ? '' : 'worker-') + (animation === '1' ? 'webgl' : 'canvas2d');
      assert.ok(during.samples.some(s => s.renderer === expectedRenderer), 'requested real browser rendering path ran');
      const eligible = during.samples.filter(s => s.elapsed >= (animation === '1' ? 3100 : 1700) && s.elapsed < (animation === '1' ? 3750 : 2350));
      assert.ok(eligible.length >= 3 && eligible.every(s => s.rootOpacity === 1), 'root remains fully opaque throughout protected background-only phase');
      assert.ok(eligible.some(s => s.backdropOpacity > .05 && s.backdropOpacity < .95), 'separate white DOM backdrop fades on the shared clock');
      for (const sample of eligible) {
        const p = Math.max(0, Math.min(1, (sample.elapsed - (animation === '1' ? 3000 : 1600)) / 1200));
        assert.ok(Math.abs(sample.backdropOpacity - (1 - p * p * (3 - 2 * p))) < .06, 'computed DOM backdrop follows the renderer smoothstep clock');
      }
      assert.ok(eligible.every(s => s.rootBackground === 'rgba(0, 0, 0, 0)'), 'root itself carries no white matte');
      assert.ok(eligible.every(s => s.backdropBackground === 'rgb(255, 255, 255)'), 'white opening belongs to a separate DOM underlay');
      const probes = noWorker ? during.samples.filter(s => s.buffer).map(s => ({ elapsed: s.elapsed, ...s.buffer })) : during.events.filter(e => e.type === 'worker-message' && e.data.type === 'alpha-probe').map(e => e.data);
      const partial = probes.filter(p => p.elapsed > (animation === '1' ? 3200 : 1800) && p.elapsed < (animation === '1' ? 3750 : 2350));
      assert.ok(partial.some(p => p.p05Alpha > 0 && p.p05Alpha < 240 && p.ink > .005), 'actual canvas background alpha falls while streaks remain');
      if (!noWorker) for (const probe of partial) {
        const p = Math.max(0, Math.min(1, (probe.elapsed - (animation === '1' ? 3000 : 1600)) / 1200));
        assert.ok(Math.abs(probe.backgroundOpacity - (1 - p * p * (3 - 2 * p))) < 1e-10, 'real worker draw receives the exact shared policy value');
      }
      // Resize the live renderer as the background is becoming transparent. A
      // newly allocated frame must not flash its historical opaque white fill.
      await page.setViewportSize({ width: 860, height: 480 });
      await page.waitForFunction(() => alphaSamples.some(s => s.width === 860 && s.height === 480), null, { timeout: 2500 });
      await page.waitForFunction(() => alphaState.finished && !document.querySelector('#sao-startup'), null, { timeout: 7000 });
      const complete = await page.evaluate(() => ({ events: alphaEvents, samples: alphaSamples, finished: alphaState.finished }));
      const resized = noWorker ? complete.samples.filter(s => s.buffer?.width === 860).map(s => ({ elapsed: s.elapsed, ...s.buffer })) : complete.events.filter(e => e.type === 'worker-message' && e.data.type === 'alpha-probe' && e.data.width === 860).map(e => e.data);
      assert.ok(resized.length >= 3, 'multiple real resized alpha buffers were sampled');
      const zeroAt = animation === '1' ? 4200 : 2800;
      assert.ok(resized.some(p => p.elapsed >= zeroAt && p.transparent > .05 && p.ink > .001), 'late resized canvas retains genuine holes and visible foreground');
      for (const probe of resized) {
        const p = Math.max(0, Math.min(1, (probe.elapsed - (noWorker ? 40 : 0) - (animation === '1' ? 3000 : 1600)) / 1200));
        assert.ok(probe.minAlpha <= Math.ceil((1 - p * p * (3 - 2 * p)) * 255) + 3, 'resized background never flashes opaque');
      }
      assert.equal(complete.finished, true);
      if (!noWorker) {
        assert.equal(complete.events.filter(e => e.type === 'worker-created').length, 1);
        assert.equal(complete.events.filter(e => e.type === 'worker-terminated').length, 1);
        assert.equal(complete.events.filter(e => e.type === 'worker-message' && e.data.type === 'unsupported').length, 0, 'real worker never silently falls back');
      }
      evidence.tests[name] = { before, after, probes, resized, appLoad, renderer: expectedRenderer };
    });
  }
});
