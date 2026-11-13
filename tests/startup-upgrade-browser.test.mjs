// Same-version upgrade regression, using actual archived/current startup and real Edge engines.
// Only isolated fixtures/evidence are written. The user's reported persistent white screen
// was not reproduced by the separate real-GUI investigation; these tests reproduce a closure bug.
// Run: node --test tests/startup-upgrade-browser.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SAO_TEST_PLAYWRIGHT ?? 'C:/DSH/graduation-office/node_modules/.pnpm/playwright@1.64.0/node_modules/playwright');
const repo = fileURLToPath(new URL('..', import.meta.url));
const artifacts = process.env.SAO_UPGRADE_FIXTURE ?? 'C:/SAO/releases/1.0.6/native-only/verification/upgrade';
const archive = process.env.SAO_UPGRADE_OLD_ARCHIVE ?? 'C:/SAO/backups/1.0.5-before-alpha-background/accepted.zip';
const unfixed = process.env.SAO_UPGRADE_UNFIXED ?? 'C:/SAO/releases/1.0.5/startup-white-repair/inspection/served-index-startup-0.js';
const inputs = ['build.py', 'renderer.js', 'worker.js', 'startup.template.js'];
const appearanceInputs = ['better-sidebar.js', 'liquid-glass.js', 'video-wallpaper.js', 'settings-panel.js', 'appearance.js'];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hashes = () => Object.fromEntries([...inputs.map(name => ['source/' + name, path.join(repo, 'source', name)]), ['index.js', path.join(repo, 'index.js')]].map(([name, file]) => [name, sha(fs.readFileSync(file))]));
function fixture() {
  fs.mkdirSync(artifacts, { recursive: true });
  const baseline = path.join(artifacts, 'baseline'); fs.mkdirSync(baseline, { recursive: true });
  // Select the archived root module, never reconstruct or patch its renderer/startup.
  const extract = spawnSync(process.env.SAO_TEST_PYTHON ?? 'python', ['-c',
    'import zipfile,pathlib,sys; z=zipfile.ZipFile(sys.argv[1]); out=pathlib.Path(sys.argv[2]); members=[n for n in z.namelist() if n.endswith("/startup.js") and "/market/" not in n]; assert len(members)==1,members; root=members[0][:-len("startup.js")]; (out/"coverage-startup.js").write_bytes(z.read(root+"startup.js")); (out/"unfixed-index.mjs").write_bytes(z.read(root+"index.js")); names=["better-sidebar.js","liquid-glass.js","video-wallpaper.js","settings-panel.js","appearance.js"]; [(out/("old-"+name)).write_bytes(z.read(root+"source/"+name)) for name in names]', archive, baseline], { encoding: 'utf8' });
  assert.equal(extract.status, 0, extract.stderr || extract.error?.message);
  const old = fs.readFileSync(path.join(baseline, 'coverage-startup.js'), 'utf8');
  const before = fs.readFileSync(unfixed, 'utf8'); fs.writeFileSync(path.join(baseline, 'unfixed-alpha-startup.js'), before);
  assert.ok(before.includes('.sao-backdrop'), 'unfixed alpha fixture contains the intended alpha implementation');
  assert.ok(old.includes("if (typeof window[replayKey] === 'function') return;"), 'actual archive has the unconditional replay guard');
  const sources = hashes(), build = path.join(artifacts, 'build');
  fs.mkdirSync(path.join(build, 'source'), { recursive: true });
  for (const name of inputs) fs.copyFileSync(path.join(repo, 'source', name), path.join(build, 'source', name));
  const compiled = spawnSync(process.env.SAO_TEST_PYTHON ?? 'python', [path.join(build, 'source/build.py'), '--archive', process.env.SAO_TEST_ARCHIVE ?? path.resolve(repo, '../original/SAO.zip')], { encoding: 'utf8' });
  assert.equal(compiled.status, 0, compiled.stderr || compiled.error?.message || compiled.stdout);
  assert.deepEqual(hashes(), sources, 'source freeze held during isolated build');
  const current = fs.readFileSync(path.join(build, 'startup.js'), 'utf8');
  const archivedAppearance = Object.fromEntries(appearanceInputs.map(name => [name, sha(fs.readFileSync(path.join(baseline, 'old-' + name)))]));
  const manifest = { archive, oldStartupSha256: sha(old), unfixedAlphaSha256: sha(before), currentStartupSha256: sha(current), archivedAppearance, sources, builtAt: new Date().toISOString(), builder: compiled.stdout.trim() };
  fs.writeFileSync(path.join(artifacts, 'upgrade-source-hashes.json'), JSON.stringify(manifest, null, 2));
  return { old, before, current, manifest };
}
// Readback is observation only. Production draws, scheduling, coverage and shaders remain intact.
function alphaFrame(canvas, animation) {
  let rgba;
  const gl = canvas.getContext('webgl'); rgba = new Uint8Array(canvas.width * canvas.height * 4); gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
  let holes = 0, partial = 0, ink = 0, minAlpha = 255;
  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = rgba[i + 3]; minAlpha = Math.min(minAlpha, alpha);
    if (!alpha) holes++; else if (alpha < 255) partial++;
    if (alpha > 100 && (Math.max(rgba[i], rgba[i + 1], rgba[i + 2]) - Math.min(rgba[i], rgba[i + 1], rgba[i + 2]) > 25 || Math.max(rgba[i], rgba[i + 1], rgba[i + 2]) < 145)) ink++;
  }
  const pixels = canvas.width * canvas.height;
  const holePoints = [];
  for (let y = 180; y < canvas.height - 40; y += 40) for (let x = 20; x < canvas.width - 40; x += 40) {
    const row = canvas.height - 1 - y;
    if (rgba[(row * canvas.width + x) * 4 + 3] <= minAlpha + 1) holePoints.push(y * canvas.width + x);
  }
  return { width: canvas.width, height: canvas.height, minAlpha, holes: holes / pixels, partial: partial / pixels, ink: ink / pixels, holePoints };
}
function workerObserve() {
  const send = self.postMessage.bind(self);
  for (const [animation, engine] of [['1', NativeSAO]]) {
    const create = engine.createRenderer;
    engine.createRenderer = function(canvas, ...args) {
      const renderer = create.call(this, canvas, ...args); if (!renderer) return renderer;
      const draw = renderer.draw; let last = -Infinity;
      renderer.draw = function(...args) {
        const result = draw.apply(this, args), elapsed = args[0] + 1000;
        if (elapsed >= 1400 && elapsed - last >= 120) { last = elapsed; send({ type: 'upgrade-alpha', animation, elapsed, backgroundOpacity: args[1], ...alphaFrame(canvas, animation) }); }
        return result;
      };
      return renderer;
    };
  }
}
function observe(suffix) {
  window.upgradeEvents = []; window.upgradeSamples = [];
  const record = (type, details = {}) => upgradeEvents.push({ type, at: performance.now(), ...details });
  const replayKey = Symbol.for('dsh.sao.replay.v4'); let replay;
  Object.defineProperty(window, replayKey, { configurable: true, get() { return replay; }, set(value) { replay = value; record('replay-assigned', { implementation: value?.implementation ?? null }); } });
  const NativeWorker = window.Worker; let workerSequence = 0;
  window.Worker = class extends NativeWorker {
    constructor(...args) { super(...args); this.upgradeId = ++workerSequence; record('worker-created', { id: this.upgradeId }); this.addEventListener('message', ({ data }) => record('worker-message', { id: this.upgradeId, data })); }
    terminate() { record('worker-terminated', { id: this.upgradeId }); return super.terminate(); }
  };
  const createURL = URL.createObjectURL.bind(URL), revokeURL = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = blob => { const url = createURL(new Blob([blob, suffix], { type: blob.type })); record('blob-created', { url }); return url; };
  URL.revokeObjectURL = url => { record('blob-revoked', { url }); return revokeURL(url); };
  new MutationObserver(records => {
    for (const recordValue of records) {
      for (const node of recordValue.addedNodes) if (node.id === 'sao-startup') record('root-added', { backdrop: !!node.querySelector('.sao-backdrop') });
      for (const node of recordValue.removedNodes) if (node.id === 'sao-startup') record('root-removed');
    }
  }).observe(document, { childList: true, subtree: true });
  setInterval(() => {
    const root = document.querySelector('#sao-startup'); if (!root) return;
    const backdrop = root.querySelector('.sao-backdrop'), canvas = root.querySelector('canvas');
    upgradeSamples.push({ at: performance.now(), rootOpacity: +getComputedStyle(root).opacity, backdropOpacity: backdrop ? +getComputedStyle(backdrop).opacity : null, renderer: canvas?.dataset.renderer, implementation: root.dataset.implementation ?? null });
  }, 50);
  const auto = new URLSearchParams(location.search).has('auto');
  localStorage.setItem('dsh-sao.preferences.v4', JSON.stringify({ startup: auto, sound: false, animation: new URLSearchParams(location.search).get('animation') || '1' }));
  window.rememberOld = () => { window.oldReplay = window[replayKey]; window.oldState = window[Symbol.for('dsh.sao.startup.v3')]; window.oldRoot = document.querySelector('#sao-startup'); };
  window.preview = animation => { window.previewState = window[replayKey]({ startup: true, sound: false, animation }); };
  window.snapshot = () => ({ events: upgradeEvents, samples: upgradeSamples, roots: document.querySelectorAll('#sao-startup').length, styles: document.querySelectorAll('style[data-sao-link-start]').length, marker: window[replayKey]?.implementation ?? null, replayRetained: window[replayKey] === window.oldReplay, oldFinished: window.oldState?.finished, finished: window[Symbol.for('dsh.sao.startup.v3')]?.finished, backdrop: !!document.querySelector('#sao-startup .sao-backdrop') });
}
function archivedAppearanceHarness() {
  // Host services only; the archived controller, CSS generation and real liquid GPU engine are unchanged.
  const effects = [], effect = fn => { const dispose = fn(); if (typeof dispose === 'function') effects.push(dispose); };
  const ctx = { effect, get: () => ({}), theme: { getTheme: () => ({ preference: 'light', effective: 'light' }), setTheme() {} }, on() {}, slots: { inject() {}, register() {} }, inject(deps, callback) { callback({ effect, get: () => ({ register() { return () => {}; } }) }); } };
  const key = 'dsh-sao.preferences.v4', stored = JSON.parse(localStorage.getItem(key));
  localStorage.setItem(key, JSON.stringify({ ...stored, featureMode: 'all', wallpaper: 'builtin-1', wallpaperScope: 'full', glass: 'liquid', surfaceColor: '#DDEEFF', windowOpacity: .8, opacity: .8, fontFamily: 'Arial' }));
  window.oldAppearanceAPI = applySAOAppearance(ctx, {}, [{ id: 'builtin-1', src: '/wallpaper.svg' }]);
  window.disposeOldAppearance = () => { for (const dispose of effects.splice(0).reverse()) dispose(); };
  window.startupStyle = () => {
    const root = document.querySelector('#sao-startup'), css = getComputedStyle(root), before = getComputedStyle(root, '::before'), after = getComputedStyle(root, '::after'), liquid = root.querySelector(':scope > [data-sao-liquid]');
    return { material: root.getAttribute('data-sao-material'), zone: root.getAttribute('data-sao-zone'), rootBackground: css.backgroundColor, rootFilter: css.backdropFilter, rootShadow: css.boxShadow, before: { content: before.content, display: before.display, background: before.backgroundColor, filter: before.backdropFilter }, after: { content: after.content, display: after.display }, liquid: liquid ? { display: getComputedStyle(liquid).display, width: liquid.width, height: liquid.height } : null };
  };
}
const suffix = '\n' + alphaFrame.toString() + '\n(' + workerObserve.toString() + ')();';
const count = (trace, type) => trace.events.filter(e => e.type === type).length;
async function hostReadback(entry, directory, old, current) {
  fs.mkdirSync(directory, { recursive: true });
  const target = path.join(directory, 'index.mjs'), sibling = path.join(directory, 'startup.js');
  fs.writeFileSync(target, entry); fs.writeFileSync(sibling, old);
  let handler; const module = await import(pathToFileURL(target).href + '?isolation=' + crypto.randomUUID());
  module.apply({ on(name, callback) { assert.equal(name, 'webserver/index-inject'); handler = callback; } });
  assert.equal(typeof handler, 'function');
  const first = []; handler(first);
  fs.writeFileSync(sibling, current); const second = []; handler(second);
  return { firstSha256: sha(first[0].text), secondSha256: sha(second[0].text), beforeSha256: sha(old), currentSha256: sha(current), kind: second[0].kind, placement: second[0].placement };
}

test('same-version startup upgrade replaces stale closures without replaying autostart', { timeout: 90000 }, async t => {
  const { old, before, current, manifest } = fixture();
  const evidence = { limitation: 'The actual user persistent-white condition was not reproduced. These isolated tests reproduce and verify a concrete mixed-startup upgrade defect.', manifest, tests: {} };
  t.after(() => { evidence.finalSources = hashes(); fs.writeFileSync(path.join(artifacts, 'upgrade-regression-evidence.json'), JSON.stringify(evidence, null, 2)); assert.deepEqual(evidence.finalSources, manifest.sources, 'frozen product sources remain unchanged'); });
  const html = script => `<!doctype html><html><head><meta charset="utf-8"><title>Actual mixed-startup upgrade fixture</title><style>html,body{margin:0;width:100%;height:100%;font:16px system-ui}body{background:repeating-conic-gradient(#0475e8 0 25%,#f77100 0 50%) 0 0/80px 80px}main{padding:28px;color:white}input{font:inherit}</style></head><body><main><h1>Live upgrade test underlay</h1><input id="underlay" value="Isolated synthetic test"></main><script>(${observe.toString()})(${JSON.stringify(suffix)});</script><script src="${script}"></script></body></html>`;
  const oldAppearance = appearanceInputs.map(name => fs.readFileSync(path.join(artifacts, 'baseline', 'old-' + name), 'utf8')).join('\n') + '\n(' + archivedAppearanceHarness.toString() + ')();';
  const server = http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store'); const name = new URL(req.url, 'http://fixture').pathname;
    if (['/old.js', '/before.js', '/current.js'].includes(name)) { res.setHeader('Content-Type', 'text/javascript'); res.end(name === '/old.js' ? old : name === '/before.js' ? before : current); }
    else if (name === '/old-appearance.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(oldAppearance); }
    else if (name === '/wallpaper.svg') { res.setHeader('Content-Type', 'image/svg+xml'); res.end('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><path fill="#0475e8" d="M0 0h800v500H0z"/><path fill="#f77100" d="M0 0h400v250H0zM400 250h400v250H400z"/></svg>'); }
    else if (name === '/favicon.ico') { res.writeHead(204); res.end(); }
    else { res.setHeader('Content-Type', 'text/html;charset=utf-8'); res.end(html(name === '/fresh' ? '/current.js' : name === '/before-fresh' ? '/before.js' : '/old.js')); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await chromium.launch({ executablePath: process.env.SAO_TEST_EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  t.after(() => browser.close()); evidence.browser = browser.version(); const base = `http://127.0.0.1:${server.address().port}`;
  async function pageFor(t, name, route = '/') {
    const context = await browser.newContext({ viewport: { width: 800, height: 500 }, reducedMotion: 'no-preference' }), page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    t.after(async () => {
      try { if (!page.isClosed()) { await page.evaluate(() => window[Symbol.for('dsh.sao.startup.v3')]?.stop?.()); const trace = await page.evaluate(() => snapshot()); fs.writeFileSync(path.join(artifacts, name + '.json'), JSON.stringify({ errors, ...trace }, null, 2)); } assert.deepEqual(errors, [], 'no errors in real browser/worker'); }
      finally { await context.close(); }
    });
    await page.goto(base + route); await page.evaluate(() => rememberOld()); return page;
  }
  await t.test('actual archived HEAD pins the unfixed alpha client to the older replay closure', async t => {
    const page = await pageFor(t, 'before-fix'); await page.addScriptTag({ url: base + '/before.js' });
    await page.evaluate(() => preview('1')); const trace = await page.evaluate(() => snapshot()); evidence.tests.beforeFix = trace;
    assert.equal(trace.replayRetained, true, 'unfixed current client leaves actual old function installed');
    assert.equal(trace.marker, null); assert.equal(count(trace, 'replay-assigned'), 1);
    assert.equal(trace.backdrop, false, 'old renderer still runs: current .sao-backdrop was never installed');
  });
  await t.test('archived host entry keeps its apply-time startup text after a sibling update', async () => {
    const trace = await hostReadback(fs.readFileSync(path.join(artifacts, 'baseline/unfixed-index.mjs'), 'utf8'), path.join(artifacts, 'host-before'), old, current);
    evidence.tests.hostBefore = trace; assert.equal(trace.firstSha256, trace.beforeSha256); assert.equal(trace.secondSha256, trace.beforeSha256); assert.notEqual(trace.secondSha256, trace.currentSha256);
  });
  for (const animation of ['1', '2']) await t.test('finished old HEAD hands preview ' + animation + ' to current real-alpha worker', async t => {
    const page = await pageFor(t, 'upgraded-preview-' + animation); await page.addScriptTag({ url: base + '/current.js' });
    let trace = await page.evaluate(() => snapshot());
    assert.equal(trace.replayRetained, false, 'new closure replaces old HEAD closure'); assert.match(trace.marker, /^[0-9a-f]{64}$/, 'new function has a content implementation identity');
    assert.equal(count(trace, 'replay-assigned'), 2); assert.equal(trace.roots, 0, 'handoff does not autostart a second scene');
    const descriptor = await page.evaluate(() => { const d = Object.getOwnPropertyDescriptor(window[Symbol.for('dsh.sao.replay.v4')], 'implementation'); return { writable: d.writable, configurable: d.configurable }; });
    assert.equal(descriptor.writable, false, 'implementation identity cannot be reassigned');
    await page.evaluate(animation => { window.currentReplay = window[Symbol.for('dsh.sao.replay.v4')]; preview(animation); window.currentState = window[Symbol.for('dsh.sao.startup.v3')]; window.currentRoot = document.querySelector('#sao-startup'); }, animation);
    await page.addScriptTag({ url: base + '/current.js' });
    const duplicate = await page.evaluate(() => ({ sameFunction: currentReplay === window[Symbol.for('dsh.sao.replay.v4')], sameState: currentState === window[Symbol.for('dsh.sao.startup.v3')], sameRoot: currentRoot === document.querySelector('#sao-startup'), ...snapshot() }));
    assert.equal(duplicate.sameFunction, true); assert.equal(duplicate.sameState, true); assert.equal(duplicate.sameRoot, true); assert.equal(duplicate.roots, 1); assert.equal(count(duplicate, 'replay-assigned'), 2, 'same implementation never reassigns replay'); assert.equal(duplicate.backdrop, true);
    const start = 3000, latestProtected = 3750;
    await page.waitForFunction(({ start, latestProtected }) => upgradeEvents.some(e => e.type === 'worker-message' && e.data.type === 'upgrade-alpha' && e.data.elapsed > start + 180 && e.data.elapsed < latestProtected && e.data.minAlpha < 245 && e.data.ink > .001), { start, latestProtected }, { timeout: 6500 });
    await page.waitForFunction(() => previewState.finished && !document.querySelector('#sao-startup'), null, { timeout: 7000 });
    trace = await page.evaluate(() => snapshot()); const frames = trace.events.filter(e => e.type === 'worker-message' && e.data.type === 'upgrade-alpha').map(e => e.data);
    const protectedSamples = trace.samples.filter(s => s.backdropOpacity > .05 && s.backdropOpacity < .95 && s.rootOpacity === 1);
    assert.ok(protectedSamples.length >= 2, 'separate DOM backdrop actually fades while root opacity stays one');
    assert.ok(trace.samples.some(s => s.renderer === 'worker-webgl'), 'requested real renderer ran, without fallback');
    assert.ok(trace.samples.every(s => s.implementation === trace.marker), 'scene DOM uses current implementation');
    assert.ok(frames.some(f => f.elapsed >= start + 1200 && f.holes > .03 && f.ink > .001), 'late actual RGBA buffer has transparent holes and visible foreground');
    assert.equal(count(trace, 'worker-created'), 1); assert.equal(count(trace, 'worker-terminated'), 1); assert.equal(count(trace, 'blob-created'), count(trace, 'blob-revoked'));
    assert.equal(trace.roots, 0); assert.equal(trace.styles, 0); assert.equal(trace.finished, true);
    await page.screenshot({ path: path.join(artifacts, 'upgraded-preview-' + animation + '-finished.png') }); evidence.tests['preview' + animation] = { descriptor, duplicate, trace, frames };
  });
  await t.test('actual archived appearance controller paints the unprotected alpha startup dialog', async t => {
    const page = await pageFor(t, 'old-appearance-before', '/before-fresh'); await page.addScriptTag({ url: base + '/old-appearance.js' }); await page.evaluate(() => preview('1'));
    await page.waitForFunction(() => !!document.querySelector('#sao-startup[data-sao-material]'), null, { timeout: 2500 });
    const style = await page.evaluate(() => startupStyle()); evidence.tests.oldAppearanceBefore = style;
    assert.equal(style.zone, 'window'); assert.equal(style.material, 'liquid');
    assert.ok(style.before.content !== 'none' && style.before.display !== 'none' || style.rootBackground !== 'rgba(0, 0, 0, 0)' || style.liquid && style.liquid.display !== 'none', 'real old controller contributes an extra backing layer before protection');
    await page.evaluate(() => { window[Symbol.for('dsh.sao.startup.v3')]?.stop?.(); disposeOldAppearance(); });
  });
  await t.test('current HEAD owns its backing layers even with the actual old appearance controller', async t => {
    const page = await pageFor(t, 'old-appearance-after', '/fresh'); await page.addScriptTag({ url: base + '/old-appearance.js' }); await page.evaluate(() => preview('1'));
    await page.waitForFunction(() => !!document.querySelector('#sao-startup[data-sao-material]'), null, { timeout: 2500 });
    const style = await page.evaluate(() => startupStyle());
    assert.equal(style.zone, 'window', 'old controller genuinely selected the startup dialog'); assert.equal(style.material, 'liquid');
    assert.equal(style.rootBackground, 'rgba(0, 0, 0, 0)'); assert.equal(style.rootFilter, 'none'); assert.equal(style.rootShadow, 'none');
    assert.deepEqual([style.before.content, style.before.display, style.after.content, style.after.display], ['none', 'none', 'none', 'none']);
    if (style.liquid) assert.equal(style.liquid.display, 'none', 'old controller cannot show its real liquid canvas over startup');
    await page.waitForFunction(() => upgradeEvents.some(e => e.type === 'worker-message' && e.data.type === 'upgrade-alpha' && e.data.elapsed >= 3340 && e.data.minAlpha < 245 && e.data.ink > .001), null, { timeout: 6500 });
    const started = await page.evaluate(() => performance.now());
    const png = await page.screenshot({ path: path.join(artifacts, 'old-appearance-protected-alpha.png') });
    const composed = await page.evaluate(async ({ base64, started }) => {
      const ended = performance.now(), image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const probes = upgradeEvents.filter(e => e.type === 'worker-message' && e.data.type === 'upgrade-alpha');
      const nearest = probes.reduce((a, b) => Math.abs(a.at - (started + ended) / 2) < Math.abs(b.at - (started + ended) / 2) ? a : b), holes = new Set(nearest.data.holePoints);
      let matchingUnderlay = 0;
      for (const point of holes) { const x = point % canvas.width, y = Math.floor(point / canvas.width), i = point * 4; const orange = x < 400 && y < 250 || x >= 400 && y >= 250; if ((rgba[i] - rgba[i + 2]) * (orange ? 1 : -1) > 2) matchingUnderlay++; }
      return { started, ended, sampleAt: nearest.at, minAlpha: nearest.data.minAlpha, matchingUnderlay, measuredHolePoints: holes.size, rootOpacity: +getComputedStyle(document.querySelector('#sao-startup')).opacity, style: startupStyle() };
    }, { base64: png.toString('base64'), started });
    assert.ok(composed.matchingUnderlay >= 2, 'actual measured canvas holes reveal the old controller wallpaper palette');
    assert.equal(composed.rootOpacity, 1, 'wallpaper is visible before the whole-root exit');
    await page.waitForFunction(() => previewState.finished && !document.querySelector('#sao-startup'), null, { timeout: 7000 });
    const trace = await page.evaluate(() => snapshot()); evidence.tests.oldAppearanceAfter = { style, composed, trace }; await page.evaluate(() => disposeOldAppearance());
  });
  await t.test('upgrading an active archived autostart stops its worker and does not replay automatically', async t => {
    const page = await pageFor(t, 'active-handoff', '/?auto');
    await page.waitForFunction(() => upgradeEvents.some(e => e.type === 'worker-message' && e.data.type === 'ready'), null, { timeout: 2500 });
    await page.addScriptTag({ url: base + '/current.js' }); let trace = await page.evaluate(() => snapshot());
    assert.equal(trace.replayRetained, false); assert.equal(trace.oldFinished, true); assert.equal(trace.roots, 0); assert.equal(trace.styles, 0); assert.equal(count(trace, 'root-added'), 1); assert.equal(count(trace, 'root-removed'), 1);
    assert.equal(count(trace, 'worker-created'), 1); assert.equal(count(trace, 'worker-terminated'), 1); assert.equal(count(trace, 'blob-created'), count(trace, 'blob-revoked'));
    await page.addScriptTag({ url: base + '/current.js' }); trace = await page.evaluate(() => snapshot()); assert.equal(count(trace, 'replay-assigned'), 2); assert.equal(trace.roots, 0, 'same-source duplicate also leaves handoff idle');
    await page.evaluate(() => preview('2')); assert.equal(await page.evaluate(() => !!document.querySelector('.sao-backdrop')), true, 'explicit preview after handoff uses new scene');
    await page.evaluate(() => previewState.stop()); trace = await page.evaluate(() => snapshot()); assert.equal(count(trace, 'worker-created'), 2); assert.equal(count(trace, 'worker-terminated'), 2); assert.equal(trace.roots, 0); evidence.tests.activeHandoff = trace;
  });
  await t.test('fresh current HEAD still autostarts once and duplicate current source leaves it intact', async t => {
    const page = await pageFor(t, 'fresh-autostart', '/fresh?auto'); const initial = await page.evaluate(() => snapshot());
    assert.match(initial.marker, /^[0-9a-f]{64}$/); assert.equal(initial.roots, 1); assert.equal(initial.backdrop, true); assert.equal(count(initial, 'replay-assigned'), 1);
    await page.addScriptTag({ url: base + '/current.js' }); const trace = await page.evaluate(() => ({ sameRoot: oldRoot === document.querySelector('#sao-startup'), ...snapshot() }));
    assert.equal(trace.replayRetained, true); assert.equal(trace.sameRoot, true); assert.equal(count(trace, 'root-added'), 1); assert.equal(count(trace, 'replay-assigned'), 1); evidence.tests.freshAutostart = trace;
  });
  await t.test('stored legacy animation 2 autostarts native WebGL once without stale thin engine', async t => {
    const page = await pageFor(t, 'legacy-stored-autostart', '/fresh?auto&animation=2');
    await page.waitForFunction(() => upgradeSamples.some(s => s.renderer === 'worker-webgl'), null, { timeout: 3000 });
    await page.addScriptTag({ url: base + '/current.js' });
    let trace = await page.evaluate(() => snapshot());
    assert.equal(count(trace, 'root-added'), 1); assert.equal(count(trace, 'replay-assigned'), 1);
    assert.equal(trace.roots, 1); assert.equal(trace.backdrop, true);
    assert.ok(trace.samples.every(s => !s.renderer || s.renderer === 'worker-webgl'), 'legacy preference never selects Canvas2D');
    await page.waitForFunction(() => snapshot().finished && !document.querySelector('#sao-startup'), null, { timeout: 7000 });
    trace = await page.evaluate(() => snapshot());
    const frames = trace.events.filter(e => e.type === 'worker-message' && e.data.type === 'upgrade-alpha').map(e => e.data);
    assert.ok(frames.some(f => f.elapsed >= 4200 && f.holes > .03 && f.ink > .001), 'legacy autostart retains native alpha foreground');
    assert.equal(count(trace, 'worker-created'), 1); assert.equal(count(trace, 'worker-terminated'), 1);
    assert.equal(count(trace, 'blob-created'), count(trace, 'blob-revoked')); assert.equal(trace.roots, 0); assert.equal(trace.styles, 0);
    evidence.tests.legacyStoredAutostart = trace;
  });
  await t.test('current host injection reads the changed sibling startup for each index request', async () => {
    const trace = await hostReadback(fs.readFileSync(path.join(repo, 'index.js'), 'utf8'), path.join(artifacts, 'host-after'), old, current);
    evidence.tests.hostAfter = trace; assert.equal(trace.firstSha256, trace.beforeSha256); assert.equal(trace.secondSha256, trace.currentSha256); assert.equal(trace.kind, 'script'); assert.equal(trace.placement, 'head');
  });
});
