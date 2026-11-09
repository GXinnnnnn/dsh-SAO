// Optional native Edge smoke test; no npm packages. Set SAO_TEST_VIDEO to a
// finite MP4/WebM fixture, or SAO_TEST_FFMPEG to generate a temporary fixture
// (SAO_TEST_FORMAT=mp4|webm, default webm; SAO_TEST_SIZE=3840x2160 or
// 5120x2880 exercises 4K/5K decode and poster downscaling; default 320x180).
// SAO_TEST_BROWSER overrides Edge. Generated media has one frame.
// No fixture is copied into the repository.
import assert from 'node:assert/strict';
import {access, mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import test from 'node:test';

const edge = process.env.SAO_TEST_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const fixture = process.env.SAO_TEST_VIDEO;
const ffmpeg = process.env.SAO_TEST_FFMPEG;
const format = process.env.SAO_TEST_FORMAT === 'mp4' ? 'mp4' : 'webm';
const size = process.env.SAO_TEST_SIZE || '320x180';
if (!/^\d+x\d+$/.test(size)) throw new Error('SAO_TEST_SIZE must be WIDTHxHEIGHT');
const [fixtureWidth, fixtureHeight] = size.split('x').map(Number);
const available = Boolean(fixture || ffmpeg) && await Promise.all([access(edge), access(fixture || ffmpeg)]).then(() => true, () => false);
const source = await readFile(new URL('../source/video-wallpaper.js', import.meta.url), 'utf8');

test('native Edge decodes a poster and plays, suspends, unloads and disposes its sibling video', {skip: available ? false : 'Set SAO_TEST_VIDEO or SAO_TEST_FFMPEG and install Edge', timeout: 40000}, async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'sao-video-browser-'));
  let fixturePath = fixture;
  if (!fixturePath) {
    fixturePath = path.join(profile, `fixture.${format}`);
    const codecOptions = format === 'mp4' ? ['-c:v', 'libx264', '-preset', 'ultrafast'] : ['-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8'];
    const encoder = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=0x4080e0:size=${size}:rate=1`, '-t', '0.1', '-an', ...codecOptions, '-threads', '2', '-pix_fmt', 'yuv420p', fixturePath], {stdio: ['ignore', 'ignore', 'inherit']});
    await new Promise((resolve, reject) => {
      encoder.once('error', reject);
      encoder.once('exit', code => code === 0 ? resolve() : reject(new Error(`Fixture encoder exited: ${code}`)));
    });
  }
  const browser = spawn(edge, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], {stdio: ['ignore', 'ignore', 'pipe']});
  let socket;
  const requests = new Map();
  let next = 0;
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('Edge DevTools startup timeout')), 15000);
      browser.once('error', error => { clearTimeout(timeout); reject(error); });
      browser.once('exit', code => { clearTimeout(timeout); reject(new Error(`Edge exited: ${code}`)); });
      browser.stderr.on('data', chunk => {
        output += chunk;
        const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) { clearTimeout(timeout); resolve(match[1]); }
      });
    });
    const origin = new URL(endpoint); origin.protocol = 'http:'; origin.pathname = '/json/list';
    const pages = await fetch(origin).then(response => response.json());
    const page = pages.find(target => target.type === 'page');
    assert.ok(page, 'headless page exists');
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, {once: true});
      socket.addEventListener('error', reject, {once: true});
    });
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      const pending = requests.get(message.id);
      if (!pending) return;
      requests.delete(message.id);
      message.error ? pending.reject(new Error(JSON.stringify(message.error))) : pending.resolve(message.result);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++next; requests.set(id, {resolve, reject}); socket.send(JSON.stringify({id, method, params}));
    });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    await send('Emulation.setFocusEmulationEnabled', {enabled: true});
    await evaluate(source + '\nglobalThis.videoWallpaperForTest = SAOVideoWallpaper; document.body.innerHTML = \'<input type="file">\'; true;');
    const {root} = await send('DOM.getDocument');
    const {nodeId} = await send('DOM.querySelector', {nodeId: root.nodeId, selector: 'input'});
    await send('DOM.setFileInputFiles', {nodeId, files: [path.resolve(fixturePath)]});
    const result = await evaluate(`(async () => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const file = document.querySelector('input').files[0];
      globalThis.fixtureForPixelTest = file;
      const validated = await videoWallpaperForTest.validate(file);
      const bitmap = await createImageBitmap(validated.poster);
      const poster = {type: validated.poster.type, width: bitmap.width, height: bitmap.height}; bitmap.close();
      document.body.innerHTML = '<div style="position:relative;width:320px;height:180px"><img alt=""></div>';
      const image = document.querySelector('img');
      image.style.cssText = 'width:100%;height:100%;object-fit:cover;object-position:25% 75%;transform:scale(1.1);opacity:1;display:block';
      const posterUrl = URL.createObjectURL(validated.poster); image.src = posterUrl;
      const url = URL.createObjectURL(file);
      const statuses = [];
      const controller = videoWallpaperForTest.create(image, status => statuses.push({state: status.state, reason: status.reason}));
      controller.set({source: url, enabled: true});
      window.dispatchEvent(new Event('focus'));
      for (let i = 0; i < 50 && controller.status.state !== 'playing'; i++) await sleep(50);
      if (controller.status.state !== 'playing') throw new Error('Playback did not start: ' + JSON.stringify(controller.status));
      const video = controller.element;
      const playing = {paused: video.paused, hidden: video.hidden, sibling: image.nextElementSibling === video, display: getComputedStyle(video).display, transform: video.style.transform, objectPosition: video.style.objectPosition};
      image.style.opacity = '0'; await sleep(20);
      const opacity = {paused: video.paused, hidden: video.hidden, reason: controller.status.reason};
      image.style.opacity = '1'; controller.set({quality: 'still'}); await sleep(20);
      const still = {paused: video.paused, hidden: video.hidden, src: video.getAttribute('src'), networkState: video.networkState, display: getComputedStyle(video).display};
      controller.dispose();
      const disposed = {connected: video.isConnected, src: video.getAttribute('src'), state: controller.status.state};
      URL.revokeObjectURL(url); URL.revokeObjectURL(posterUrl);
      return {meta: validated.meta, poster, playing, opacity, still, disposed, statuses};
    })()`);
    assert.equal(result.poster.type, 'image/webp');
    assert.ok(result.poster.width > 0 && result.poster.height > 0);
    assert.ok(Math.max(result.poster.width, result.poster.height) <= 1600);
    assert.ok(Math.max(result.meta.width, result.meta.height) <= 5120);
    assert.ok(Math.min(result.meta.width, result.meta.height) <= 2880);
    assert.ok(result.meta.duration > 0 && result.meta.duration <= 30);
    assert.ok(result.meta.bytes <= 200 * 1024 * 1024);
    if (!fixture) assert.deepEqual([result.meta.width, result.meta.height], [fixtureWidth, fixtureHeight]);
    const scale = Math.min(1, 1600 / Math.max(result.meta.width, result.meta.height));
    assert.deepEqual([result.poster.width, result.poster.height], [Math.round(result.meta.width * scale), Math.round(result.meta.height * scale)]);
    assert.deepEqual(result.playing, {paused: false, hidden: false, sibling: true, display: 'block', transform: 'scale(1.1)', objectPosition: '25% 75%'});
    assert.deepEqual(result.opacity, {paused: true, hidden: true, reason: 'opacity'});
    assert.deepEqual(result.still, {paused: true, hidden: true, src: null, networkState: 0, display: 'none'});
    assert.deepEqual(result.disposed, {connected: false, src: null, state: 'disposed'});
    const pixelSetup = await evaluate(`(async () => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      document.documentElement.style.background = 'black';
      document.body.style.cssText = 'margin:0;background:black';
      document.body.innerHTML = '<div style="position:relative;width:320px;height:180px"><img alt=""></div>';
      const image = document.querySelector('img');
      image.style.cssText = 'width:100%;height:100%;display:block;object-fit:fill;opacity:.5';
      image.setAttribute('data-sao-video-poster', 'original-owner');
      const validated = await videoWallpaperForTest.validate(fixtureForPixelTest);
      const posterUrl = URL.createObjectURL(validated.poster); image.src = posterUrl; await image.decode();
      const source = URL.createObjectURL(fixtureForPixelTest);
      let mutations = 0;
      const audit = new MutationObserver(records => { mutations += records.length; });
      audit.observe(image, {attributes: true, attributeFilter: ['style']});
      const originalStyle = image.style.cssText;
      const controller = videoWallpaperForTest.create(image);
      controller.set({source, enabled: true}); window.dispatchEvent(new Event('focus'));
      for (let i = 0; i < 50 && controller.status.state !== 'playing'; i++) await sleep(50);
      if (controller.status.state !== 'playing') throw new Error('Pixel-test playback failed');
      for (let i = 0; i < 20; i++) controller.sync();
      controller.element.pause(); // Freeze the decoded frame for screenshot comparison.
      await sleep(80);
      const sample = document.createElement('canvas'); sample.width = 320; sample.height = 180;
      const ctx = sample.getContext('2d'); ctx.drawImage(controller.element, 0, 0, 320, 180);
      const sourcePixel = [...ctx.getImageData(160, 90, 1, 1).data];
      ctx.clearRect(0, 0, 320, 180); ctx.drawImage(image, 0, 0, 320, 180);
      const posterPixel = [...ctx.getImageData(160, 90, 1, 1).data];
      globalThis.pixelScene = {image, controller, audit, source, posterUrl, originalStyle};
      return {sourcePixel, posterPixel, posterVisibility: getComputedStyle(image).visibility,
        videoVisibility: getComputedStyle(controller.element).visibility, videoOpacity: getComputedStyle(controller.element).opacity,
        inlineUnchanged: originalStyle === image.style.cssText, mutations};
    })()`);
    const sampleScreenshot = async () => {
      const screenshot = await send('Page.captureScreenshot', {format: 'png', clip: {x: 159, y: 89, width: 3, height: 3, scale: 1}});
      return evaluate(`(async () => {
        const bytes = Uint8Array.from(atob(${JSON.stringify(screenshot.data)}), char => char.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], {type: 'image/png'}));
        const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close();
        return [...ctx.getImageData(1, 1, 1, 1).data];
      })()`);
    };
    const screenshotPixel = await sampleScreenshot();
    // Compare two compositor screenshots of the same frozen frame. Drawing a
    // YUV video into canvas can apply a slightly different color conversion.
    await evaluate(`(async () => { pixelScene.controller.element.style.opacity = '1'; await new Promise(resolve => setTimeout(resolve, 40)); })()`);
    const opaquePixel = await sampleScreenshot();
    const restored = await evaluate(`(() => {
      const {image, controller, audit, source, posterUrl, originalStyle} = pixelScene;
      controller.set({quality: 'still'});
      const stillVisibility = getComputedStyle(image).visibility;
      controller.dispose(); audit.disconnect();
      URL.revokeObjectURL(source); URL.revokeObjectURL(posterUrl);
      return {stillVisibility, disposedVisibility: getComputedStyle(image).visibility,
        marker: image.getAttribute('data-sao-video-poster'), inlineUnchanged: originalStyle === image.style.cssText,
        styleNodes: document.querySelectorAll('style[data-sao-video-poster-style]').length};
    })()`);
    assert.equal(pixelSetup.posterVisibility, 'hidden');
    assert.equal(pixelSetup.videoVisibility, 'visible');
    assert.equal(pixelSetup.videoOpacity, '0.5');
    assert.ok(pixelSetup.posterPixel[3] === 255, 'visually hidden poster remains readable by canvas/GL');
    assert.ok(pixelSetup.inlineUnchanged); assert.equal(pixelSetup.mutations, 0, 'playing/sync cause zero poster style mutations');
    for (let channel = 0; channel < 3; channel++) {
      assert.ok(Math.abs(screenshotPixel[channel] - opaquePixel[channel] * 0.5) <= 2,
        `channel ${channel}: screenshot ${screenshotPixel}, opaque ${opaquePixel}; expected one 0.5-opacity layer`);
    }
    assert.deepEqual(restored, {stillVisibility: 'visible', disposedVisibility: 'visible', marker: 'original-owner', inlineUnchanged: true, styleNodes: 0});
    console.log('Native media evidence:', JSON.stringify({meta: result.meta, poster: result.poster, halfOpacity: {source: pixelSetup.sourcePixel, opaqueScreenshot: opaquePixel, halfScreenshot: screenshotPixel}}));
  } finally {
    socket?.close();
    if (browser.exitCode === null) browser.kill();
    // Only remove the mkdtemp directory owned by this test.
    assert.ok(profile.startsWith(path.join(tmpdir(), 'sao-video-browser-')));
    await rm(profile, {recursive: true, force: true, maxRetries: 10, retryDelay: 100}).catch(() => {});
  }
});
