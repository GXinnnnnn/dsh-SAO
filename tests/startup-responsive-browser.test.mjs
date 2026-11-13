// Native WebGL geometry/alpha and actual browser resize regression; no product mocks.
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
const artifacts = process.env.SAO_RESPONSIVE_FIXTURE ?? 'C:/SAO/releases/1.0.6/native-only/verification/responsive';
const baseline = process.env.SAO_ALPHA_BASELINE_SOURCE ?? 'C:/SAO/releases/1.0.5/coverage-fade/fixture/build/source';
const inputs = ['build.py', 'renderer.js', 'worker.js', 'startup.template.js'];
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const hashes = () => Object.fromEntries(inputs.map(name => [name, sha(fs.readFileSync(path.join(repo, 'source', name)))]));
function readFrame(canvas) {
  const gl = canvas.getContext('webgl'), width = canvas.width, height = canvas.height;
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let holes = 0, ink = 0, left = 0, right = 0, partial = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3], x = i / 4 % width;
    if (alpha === 0) holes++;
    else if (alpha < 255) partial++;
    if (alpha > 100 && (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) - Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) > 25 || Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) < 145)) {
      ink++; if (x < width / 4) left++; if (x >= width * .75) right++;
    }
  }
  return { width, height, holes: holes / (width * height), partial: partial / (width * height), ink: ink / (width * height), left: left / (width * height / 4), right: right / (width * height / 4), glError: gl.getError() };
}
function workerObservation() {
  const create = NativeSAO.createRenderer, send = self.postMessage.bind(self);
  NativeSAO.createRenderer = function(canvas, ...args) {
    const renderer = create.call(this, canvas, ...args);
    if (!renderer) return renderer;
    const draw = renderer.draw; let lastWidth = -1, lastHeight = -1;
    renderer.draw = function(...values) {
      const result = draw.apply(this, values);
      if (canvas.width !== lastWidth || canvas.height !== lastHeight) {
        lastWidth = canvas.width; lastHeight = canvas.height;
        send({ type: 'responsive-frame', elapsed: values[0], ...readFrame(canvas) });
      }
      return result;
    };
    return renderer;
  };
}
function observation(suffix) {
  localStorage.setItem('dsh-sao.preferences.v4', JSON.stringify({ startup: false, sound: false, animation: '2' }));
  window.responsiveEvents = []; window.activeWorkers = 0; window.liveTicks = 0;
  setInterval(() => { document.querySelector('output').textContent = ++liveTicks; }, 50);
  if (new URLSearchParams(location.search).has('noWorker')) window.Worker = undefined;
  else {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(...args) { super(...args); activeWorkers++; this.addEventListener('message', ({ data }) => responsiveEvents.push({ type: 'message', data })); }
      postMessage(data, ...args) { responsiveEvents.push({ type: 'send', data: { ...data, canvas: !!data.canvas } }); return super.postMessage(data, ...args); }
      terminate() { activeWorkers--; return super.terminate(); }
    };
    const createURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => createURL(new Blob([blob, suffix], { type: blob.type }));
  }
}
const suffix = '\n' + readFrame.toString() + '\n(' + workerObservation.toString() + ')();';
const html = `<!doctype html><meta charset="utf-8"><title>Native responsive startup</title><style>html,body{margin:0;width:100%;height:100%;background:#18785d}input{margin:20px}</style><input id="focus" value="live app"><output></output><script>${readFrame.toString()}\n(${observation.toString()})(${JSON.stringify(suffix)})</script><script src="/startup.js"></script>`;

test('native startup preserves recovered pixels and covers real responsive viewports', { timeout: 90000 }, async t => {
  fs.mkdirSync(path.join(artifacts, 'build/source'), { recursive: true });
  const frozen = hashes();
  for (const name of inputs) fs.copyFileSync(path.join(repo, 'source', name), path.join(artifacts, 'build/source', name));
  const built = spawnSync(process.env.SAO_TEST_PYTHON ?? 'python', [path.join(artifacts, 'build/source/build.py'), '--archive', process.env.SAO_TEST_ARCHIVE ?? path.resolve(repo, '../original/SAO.zip')], { encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr || built.error?.message || built.stdout);
  const engines = fs.readFileSync(path.join(artifacts, 'build/source/renderer.js'), 'utf8');
  const original = fs.readFileSync(path.join(baseline, 'renderer.js'), 'utf8');
  const evidence = { sources: frozen, baseline: sha(original), startup: sha(fs.readFileSync(path.join(artifacts, 'build/startup.js'))), builder: built.stdout.trim(), tests: {} };
  t.after(() => { evidence.finalSources = hashes(); fs.writeFileSync(path.join(artifacts, 'responsive-evidence.json'), JSON.stringify(evidence, null, 2)); assert.deepEqual(evidence.finalSources, frozen); });
  const server = http.createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.url === '/startup.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(fs.readFileSync(path.join(artifacts, 'build/startup.js'))); }
    else if (request.url === '/engines.js') { response.setHeader('Content-Type', 'text/javascript'); response.end('window.current = (() => {\n' + engines + '\nreturn {NativeSAO,saoStartupProjection};})();\nwindow.original = (() => {\n' + original + '\nreturn NativeSAO;})();'); }
    else if (request.url === '/favicon.ico') { response.writeHead(204); response.end(); }
    else { response.setHeader('Content-Type', 'text/html;charset=utf-8'); response.end(html); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.SAO_TEST_EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  t.after(() => browser.close()); evidence.browser = browser.version();
  await t.test('16:9, portrait and small-width bytes remain exact; ultrawide GPU and CPU share cover', async () => {
    const page = await browser.newPage();
    try {
      await page.goto(base); await page.addScriptTag({ url: base + '/engines.js' });
      const matrix = await page.evaluate(() => {
        const out = { unchanged: [], frames: [], cover: [] }, canvas = document.createElement('canvas'), oldCanvas = document.createElement('canvas');
        const pixels = target => { const gl = target.getContext('webgl'), data = new Uint8Array(target.width * target.height * 4); gl.readPixels(0, 0, target.width, target.height, gl.RGBA, gl.UNSIGNED_BYTE, data); return data; };
        for (const seed of [1, 12345]) for (const [width, height, dpr] of [[640, 360, 1], [360, 640, 1], [280, 180, 1], [360, 640, 2], [896, 384, 1], [1280, 360, 1], [896, 384, 2], [480, 270, 3]]) {
          const view = { width, height, dpr }, renderer = current.NativeSAO.createRenderer(canvas, seed, view);
          if (!renderer) throw Error('real native WebGL unavailable');
          if (width / height <= 16 / 9) {
            const legacy = original.createRenderer(oldCanvas, seed, { ...view });
            for (const total of [1500, 2400, 3600, 4400, 4800]) {
              renderer.draw(total - 1000); legacy.draw(total - 1000);
              const a = pixels(canvas), b = pixels(oldCanvas); let different = 0;
              for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) different++;
              out.unchanged.push({ seed, ...view, total, different });
            }
            legacy.dispose();
          }
          for (const total of [4400, 4600, 4800]) {
            renderer.draw(total - 1000, 0);
            out.frames.push({ seed, requestedWidth: width, requestedHeight: height, dpr, total, focal: current.saoStartupProjection(width, height), estimate: renderer.lightCoverage(total - 1000), ...readFrame(canvas) });
          }
          if (width / height > 16 / 9 && dpr === 1) {
            renderer.draw(1400, 0); const cover = readFrame(canvas);
            // Same recovered 16:9 scene at identical horizontal scale, cropped vertically.
            const referenceHeight = width * 9 / 16, reference = current.NativeSAO.createRenderer(oldCanvas, seed, { width, height: referenceHeight, dpr: 1 });
            reference.draw(1400, 0);
            const a = pixels(canvas), b = pixels(oldCanvas), offset = (referenceHeight - height) / 2;
            let differingPixels = 0, max = 0;
            for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
              let differs = false;
              for (let channel = 0; channel < 4; channel++) { const diff = Math.abs(a[(y * width + x) * 4 + channel] - b[((y + offset) * width + x) * 4 + channel]); max = Math.max(max, diff); if (diff > 1) differs = true; }
              if (differs) differingPixels++;
            }
            out.cover.push({ seed, ...view, differingFraction: differingPixels / (width * height), max, ...cover }); reference.dispose();
          }
          renderer.dispose();
        }
        return out;
      });
      evidence.tests.matrix = matrix;
      for (const entry of matrix.unchanged) assert.equal(entry.different, 0, `native recovered bytes ${JSON.stringify(entry)}`);
      for (const frame of matrix.frames) {
        assert.equal(frame.glError, 0);
        const effectiveDpr = Math.min(frame.dpr, 2, Math.sqrt(3840 * 2160 * 2 / (frame.requestedWidth * frame.requestedHeight)));
        assert.equal(frame.width, Math.round(frame.requestedWidth * effectiveDpr));
        assert.equal(frame.height, Math.round(frame.requestedHeight * effectiveDpr));
        assert.ok(frame.holes > .2 && frame.ink > 0, `real transparent gaps and intact streaks ${JSON.stringify(frame)}`);
        assert.ok(Math.abs(frame.estimate - frame.ink) < .065, `CPU mask tracks actual GPU occupancy ${JSON.stringify(frame)}`);
        assert.ok(Math.abs(frame.focal - 2.414213487 * Math.max(1, frame.width / frame.height / (16 / 9))) < 1e-6);
      }
      for (const frame of matrix.cover) {
        assert.ok(frame.differingFraction < .002, `wide view preserves proportional cover geometry ${JSON.stringify(frame)}`);
        assert.ok(frame.left > .02 && frame.right > .02, 'ultrawide field reaches both outer quarters');
      }
      for (const viewport of [{ width: 896, height: 384 }, { width: 1280, height: 360 }]) {
        await page.setViewportSize(viewport);
        await page.evaluate(view => {
          const canvas = document.createElement('canvas'); canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%'; document.body.append(canvas);
          window.captureRenderer = current.NativeSAO.createRenderer(canvas, 12345, { ...view, dpr: 1 });
          captureRenderer.draw(1400, 0);
        }, viewport);
        await page.screenshot({ path: path.join(artifacts, `native-cover-${viewport.width}x${viewport.height}.png`) });
        await page.evaluate(() => { captureRenderer.dispose(); document.querySelector('canvas').remove(); });
      }
    } finally { await page.close(); }
  });
  for (const noWorker of [false, true]) for (const dpr of [1, 2]) await t.test(`${noWorker ? 'main' : 'worker'} real root/viewport resize at DPR ${dpr}`, async () => {
    const context = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: dpr, reducedMotion: 'no-preference' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(base + (noWorker ? '/?noWorker' : '/'));
      await page.locator('#focus').focus();
      await page.evaluate(() => { window.state = window[Symbol.for('dsh.sao.replay.v4')]({ animation: '2', sound: false }); });
      assert.equal(await page.locator('#sao-startup').getAttribute('data-animation'), '1');
      assert.equal(await page.locator('#sao-startup canvas').getAttribute('data-renderer'), noWorker ? 'webgl' : 'worker-webgl');
      const frames = [];
      async function backing(width, height) {
        const expected = { width: width * dpr, height: height * dpr };
        await page.waitForFunction(({ expected, noWorker }) => {
          if (noWorker) { const canvas = document.querySelector('#sao-startup canvas'); return canvas?.width === expected.width && canvas?.height === expected.height; }
          return responsiveEvents.some(event => event.type === 'message' && event.data.type === 'responsive-frame' && event.data.width === expected.width && event.data.height === expected.height);
        }, { expected, noWorker });
        const frame = await page.evaluate(({ expected, noWorker }) => noWorker ? readFrame(document.querySelector('#sao-startup canvas')) : responsiveEvents.findLast(event => event.type === 'message' && event.data.type === 'responsive-frame' && event.data.width === expected.width && event.data.height === expected.height).data, { expected, noWorker });
        assert.equal(frame.glError, 0); frames.push({ root: { width, height }, dpr, ...frame });
      }
      await backing(960, 540);
      for (const viewport of [{ width: 1280, height: 360 }, { width: 360, height: 640 }, { width: 280, height: 180 }]) { await page.setViewportSize(viewport); await backing(viewport.width, viewport.height); }
      // A genuine root-only layout change fires ResizeObserver without window.resize.
      await page.evaluate(() => { document.querySelector('#sao-startup').style.width = '333px'; document.querySelector('#sao-startup').style.height = '444px'; });
      await backing(333, 444);
      await page.screenshot({ path: path.join(artifacts, `${noWorker ? 'main' : 'worker'}-dpr${dpr}-root-resize.png`) });
      const before = await page.evaluate(() => ({ ticks: liveTicks, resizes: responsiveEvents.filter(event => event.type === 'send' && event.data.type === 'resize').map(event => event.data.view) }));
      assert.ok(before.ticks > 0, 'application updates throughout responsive startup');
      if (!noWorker) assert.ok(before.resizes.some(view => view.width === 333 && view.height === 444), 'worker receives actual root bounds');
      await page.evaluate(() => state.stop());
      assert.equal(await page.locator('#sao-startup').count(), 0); assert.equal(await page.evaluate(() => activeWorkers), 0);
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'focus');
      const sends = await page.evaluate(() => responsiveEvents.length);
      await page.setViewportSize({ width: 800, height: 450 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.evaluate(() => responsiveEvents.length), sends, 'resize listeners are removed after finish');
      assert.deepEqual(errors, []);
      evidence.tests[`${noWorker ? 'main' : 'worker'}Dpr${dpr}`] = { frames, before, cleaned: true };
    } finally { await context.close(); }
  });
});
