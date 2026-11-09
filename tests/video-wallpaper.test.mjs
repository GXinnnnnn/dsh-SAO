import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../source/video-wallpaper.js', import.meta.url), 'utf8');
const tick = async () => { for (let n = 0; n < 12; n++) await Promise.resolve(); };
class Events {
  listeners = new Map();
  addEventListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(callback);
  }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  emit(name) { for (const callback of [...(this.listeners.get(name) || [])]) callback({type: name}); }
  count() { return [...this.listeners.values()].reduce((n, set) => n + set.size, 0); }
}
class Style {
  values = {};
  get cssText() { return Object.entries(this.values).map(([key, value]) => `${key}:${value}`).join(';'); }
  set cssText(value) {
    this.values = Object.fromEntries(value.split(';').filter(Boolean).map(part => {
      const i = part.indexOf(':'); return [part.slice(0, i).trim(), part.slice(i + 1).trim()];
    }));
  }
}
for (const key of ['display', 'position', 'inset', 'opacity', 'transform', 'objectFit', 'objectPosition', 'pointerEvents', 'width', 'height']) {
  const css = key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
  Object.defineProperty(Style.prototype, key, {
    get() { return this.values[css] || ''; }, set(value) { this.values[css] = value; },
  });
}
function environment(options = {}) {
  const env = {videos: [], canvases: [], styles: [], created: [], revoked: [], timers: new Map(), observers: [], frameRequests: 0, draws: [], encodes: []};
  const win = new Events(), doc = new Events(), motion = new Events();
  motion.matches = options.reduced || false;
  if (options.legacyMotion) {
    motion.addListener = callback => Events.prototype.addEventListener.call(motion, 'change', callback);
    motion.removeListener = callback => Events.prototype.removeEventListener.call(motion, 'change', callback);
    motion.addEventListener = undefined;
  }
  Object.assign(doc, {defaultView: win, hidden: options.hidden || false, hasFocus: () => options.focused !== false});
  Object.assign(win, {document: doc, matchMedia: () => motion});
  win.MutationObserver = class {
    constructor(callback) { this.callback = callback; env.observers.push(this); }
    observe(target, config) { this.target = target; this.config = config; }
    disconnect() { this.disconnected = true; }
  };
  class Element extends Events {
    style = new Style();
    dataset = {};
    attrs = new Map();
    hidden = false;
    ownerDocument = doc;
    parentNode = null;
    setAttribute(name, value) { this.attrs.set(name, value); }
    getAttribute(name) { return this.attrs.get(name) ?? null; }
    removeAttribute(name) { this.attrs.delete(name); }
    after(element) {
      element.parentNode = this.parentNode;
      this.parentNode.children.splice(this.parentNode.children.indexOf(this) + 1, 0, element);
    }
    remove() {
      this.removed = true;
      if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
      this.parentNode = null;
    }
  }
  class Video extends Element {
    paused = true;
    readyState = 0;
    seeking = false;
    playCalls = 0;
    pauseCalls = 0;
    loadCalls = 0;
    get src() { return this.getAttribute('src') || ''; }
    set src(value) { this.setAttribute('src', value); }
    get currentTime() { return this.time || 0; }
    set currentTime(value) {
      this.time = value;
      env.frameRequests++;
      if (options.frame === false) return;
      queueMicrotask(() => {
        this.readyState = 2;
        this.emit('loadeddata');
      });
    }
    load() {
      this.loadCalls++;
      if (!this.src) { this.readyState = 0; return; }
      if (options.loadError) throw new Error('load failed');
      if (options.probe) queueMicrotask(() => {
        if (options.decodeError) { this.emit('error'); return; }
        Object.assign(this, {videoWidth: 1920, videoHeight: 1080, duration: 30}, options.metadata);
        this.readyState = 1;
        this.emit('loadedmetadata');
      });
    }
    pause() { this.paused = true; this.pauseCalls++; }
    play() {
      this.playCalls++;
      this.paused = false;
      return options.play ? options.play(this) : Promise.resolve();
    }
  }
  doc.createElement = name => {
    if (name === 'style') { const style = new Element(); env.styles.push(style); return style; }
    if (name === 'video') {
      const video = new Video(); env.videos.push(video); return video;
    }
    assert.equal(name, 'canvas');
    const canvas = {
      width: 0, height: 0,
      getContext: () => options.context === false ? null : ({drawImage(video, x, y, width, height) {
        if (options.drawError) throw new Error('draw failed');
        env.draws.push({video, x, y, width, height});
      }}),
      toBlob(callback, type, quality) {
        env.encodes.push({type, quality});
        if (options.encodeError) throw new Error('encode failed');
        if (options.encodeTimeout) return;
        callback(options.nullPoster ? null : new Blob(['poster'], {type: options.posterType || type}));
      },
    };
    env.canvases.push(canvas); return canvas;
  };
  let timerId = 0;
  const context = vm.createContext({
    document: doc, Blob, Error, TypeError, URL: {
      createObjectURL(file) { const url = `blob:probe-${env.created.length}`; env.created.push({file, url}); return url; },
      revokeObjectURL(url) { env.revoked.push(url); },
    },
    setTimeout(callback, delay) { const id = ++timerId; env.timers.set(id, {callback, delay}); return id; },
    clearTimeout(id) { env.timers.delete(id); },
  });
  env.api = vm.runInContext(`${source}\nSAOVideoWallpaper`, context);
  env.image = new Element();
  env.image.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;opacity:1;object-position:35% 65%;transform:scale(1.2)';
  env.image.parentNode = {children: [env.image], appendChild(element) { this.children.push(element); element.parentNode = this; }};
  Object.assign(env, {win, doc, motion});
  env.fireTimeout = () => {
    const next = env.timers.entries().next().value;
    assert.ok(next, 'an outstanding timeout exists');
    const [id, entry] = next;
    assert.equal(entry.delay, 10000);
    env.timers.delete(id); // Native one-shot timers disappear before the callback runs.
    entry.callback();
  };
  return env;
}
function file(type = 'video/mp4', bytes = 32) {
  const blob = new Blob(['video'], {type});
  Object.defineProperty(blob, 'size', {value: bytes});
  return blob;
}
function released(env) {
  assert.deepEqual(env.revoked, env.created.map(entry => entry.url));
  assert.equal(env.timers.size, 0);
  for (const video of env.videos) {
    assert.equal(video.src, '');
    assert.equal(video.count(), 0);
    assert.ok(video.paused);
    assert.ok(video.loadCalls > 0);
  }
  for (const canvas of env.canvases) assert.equal(canvas.width * canvas.height, 0);
}

test('public limits allow 5K, 200 MiB and 30 seconds while preserving bounded posters and timeouts', () => {
  const env = environment();
  assert.deepEqual(JSON.parse(JSON.stringify(env.api.limits)), {
    bytes: 200 * 1024 * 1024, duration: 30, longEdge: 5120, shortEdge: 2880, posterEdge: 1600, timeout: 10000,
  });
  assert.ok(Object.isFrozen(env.api.limits));
});

test('MP4/WebM 5K/4K boundaries, landscape/portrait, and small video produce bounded WebP Blob posters', async () => {
  for (const [type, width, height, expectedWidth, expectedHeight] of [
    ['video/mp4', 5120, 2880, 1600, 900],
    ['video/webm', 2880, 5120, 900, 1600],
    ['video/mp4', 3840, 2160, 1600, 900],
    ['video/webm', 2160, 3840, 900, 1600],
    ['video/mp4', 1920, 1080, 1600, 900],
    ['video/webm', 1080, 1920, 900, 1600],
    ['video/webm', 640, 360, 640, 360],
  ]) {
    const env = environment({probe: true, metadata: {videoWidth: width, videoHeight: height}});
    const result = await env.api.validate(file(type, 200 * 1024 * 1024));
    assert.equal(result.kind, 'video');
    assert.ok(result.poster instanceof Blob);
    assert.equal(result.poster.type, 'image/webp');
    assert.deepEqual(JSON.parse(JSON.stringify(result.meta)), {width, height, duration: 30, bytes: 200 * 1024 * 1024, type});
    assert.equal(env.frameRequests, 1);
    assert.equal(env.draws.length, 1);
    assert.deepEqual([env.draws[0].width, env.draws[0].height], [expectedWidth, expectedHeight]);
    assert.deepEqual(env.encodes, [{type: 'image/webp', quality: 0.82}]);
    released(env);
  }
});

test('unsupported types, non-Blob, empty and oversized files reject before creating a probe URL', async () => {
  for (const [input, code] of [[{}, 'type'], [file('image/png'), 'type'], [file('video/quicktime'), 'type'], [file(''), 'type'], [file('video/mp4', 0), 'bytes'], [file('video/webm', 200 * 1024 * 1024 + 1), 'bytes']]) {
    const env = environment();
    await assert.rejects(env.api.validate(input), {code});
    assert.equal(env.created.length, 0);
    assert.equal(env.videos.length, 0);
  }
});

test('8K, 5K plus one pixel, excessive short edge, duration and malformed metadata reject before frame decode/canvas allocation', async () => {
  for (const [metadata, code] of [
    [{videoWidth: 7680, videoHeight: 4320}, 'resolution'],
    [{videoWidth: 4320, videoHeight: 7680}, 'resolution'],
    [{videoWidth: 2881, videoHeight: 2881}, 'resolution'],
    [{videoWidth: 5121, videoHeight: 2880}, 'resolution'],
    [{videoWidth: 2880, videoHeight: 5121}, 'resolution'],
    [{videoWidth: 5120, videoHeight: 2881}, 'resolution'],
    [{videoWidth: 2881, videoHeight: 5120}, 'resolution'],
    [{duration: 30.001}, 'duration'],
    [{duration: Infinity}, 'metadata'], [{duration: NaN}, 'metadata'], [{duration: 0}, 'metadata'],
    [{videoWidth: 0}, 'metadata'], [{videoHeight: -1}, 'metadata'],
  ]) {
    const env = environment({probe: true, metadata});
    await assert.rejects(env.api.validate(file()), {code});
    assert.equal(env.frameRequests, 0);
    assert.equal(env.canvases.length, 0);
    released(env);
  }
});

test('validation errors describe the 200 MiB, 30-second and 5K limits', async () => {
  const bytesEnv = environment();
  await assert.rejects(bytesEnv.api.validate(file('video/mp4', 200 * 1024 * 1024 + 1)), {code: 'bytes', message: /200 MiB/});
  for (const [metadata, code, message] of [
    [{duration: 30.001}, 'duration', /30 秒/],
    [{videoWidth: 5121, videoHeight: 2880}, 'resolution', /5120.*2880.*5K/],
  ]) {
    const env = environment({probe: true, metadata});
    await assert.rejects(env.api.validate(file()), {code, message});
    released(env);
  }
});

test('metadata and frame timeouts are bounded at 10 seconds and release all resources', async () => {
  for (const [options, code] of [[{}, 'metadata-timeout'], [{probe: true, frame: false}, 'frame-timeout']]) {
    const env = environment(options);
    const promise = env.api.validate(file());
    const rejection = assert.rejects(promise, {code});
    await tick(); env.fireTimeout(); await rejection;
    released(env);
  }
});

test('decode, source load, canvas and encoder failures always revoke probe and unload media', async () => {
  for (const options of [{decodeError: true}, {loadError: true}, {context: false}, {drawError: true}, {encodeError: true}, {nullPoster: true}, {posterType: 'image/png'}]) {
    const env = environment({probe: true, ...options});
    await assert.rejects(env.api.validate(file()));
    released(env);
  }
});

test('poster encoding timeout releases probe and canvas', async () => {
  const env = environment({probe: true, encodeTimeout: true});
  const promise = env.api.validate(file());
  const rejection = assert.rejects(promise, {code: 'poster-timeout'});
  await tick(); env.fireTimeout(); await rejection;
  released(env);
});

test('native sibling defaults and style synchronization preserve crop while ignoring poster hidden', async () => {
  const env = environment();
  env.image.hidden = true;
  const controller = env.api.create(env.image);
  const video = controller.element;
  assert.equal(env.image.parentNode.children[1], video);
  for (const key of ['muted', 'defaultMuted', 'loop', 'playsInline', 'disablePictureInPicture']) assert.equal(video[key], true);
  assert.equal(video.preload, 'metadata');
  assert.equal(video.dataset.saoVideo, '');
  assert.equal(video.getAttribute('aria-hidden'), 'true');
  assert.equal(video.tabIndex, -1);
  assert.equal(video.hidden, true);
  assert.equal(video.style.display, 'none', 'inline display:block must not defeat hidden');
  controller.set({source: 'blob:wallpaper', enabled: true});
  await tick();
  assert.equal(controller.status.state, 'playing');
  assert.equal(video.hidden, false, 'poster img.hidden does not control video eligibility');
  assert.equal(video.style.position, 'absolute');
  assert.equal(video.style.inset, '0');
  assert.equal(video.style.objectPosition, '35% 65%');
  assert.equal(video.style.transform, 'scale(1.2)');
  env.image.style.transform = 'scale(1.5)';
  env.image.style.objectPosition = '10% 20%';
  env.observers[0].callback();
  assert.equal(video.style.transform, 'scale(1.5)');
  assert.equal(video.style.objectPosition, '10% 20%');
  assert.equal(video.playCalls, 1, 'style sync does not restart playback');
  assert.equal(env.image.style.position, '', 'poster styles are unchanged');
  controller.dispose();
});

test('playing hides only poster visibility via a scoped rule and restores its original marker on every fallback/dispose', async () => {
  for (const original of [null, '', 'existing-owner']) {
    const env = environment();
    const attribute = 'data-sao-video-poster';
    if (original !== null) env.image.setAttribute(attribute, original);
    env.image.style.opacity = '.5';
    const originalStyle = env.image.style.cssText;
    const controller = env.api.create(env.image);
    assert.equal(env.image.getAttribute(attribute), original);
    controller.set({source: 'blob:wallpaper', enabled: true}); await tick();
    const owner = env.image.getAttribute(attribute);
    assert.ok(owner && owner !== original);
    assert.equal(env.styles.length, 1);
    assert.equal(env.styles[0].textContent, `[${attribute}="${owner}"]{visibility:hidden!important}`);
    assert.equal(env.image.style.cssText, originalStyle, 'poster visibility never mutates inline styles');
    assert.equal(controller.element.style.opacity, '.5');
    assert.ok(!controller.element.style.cssText.includes('visibility'), 'video cannot inherit the poster hiding rule');
    assert.deepEqual([...env.observers[0].config.attributeFilter], ['style'], 'marker writes cannot cause observer feedback');
    env.win.emit('blur');
    assert.equal(env.image.getAttribute(attribute), original);
    env.win.emit('focus'); await tick();
    assert.equal(env.image.getAttribute(attribute), owner);
    controller.set({quality: 'still'});
    assert.equal(env.image.getAttribute(attribute), original);
    controller.set({quality: 'balanced'}); await tick();
    controller.element.emit('error');
    assert.equal(env.image.getAttribute(attribute), original);
    controller.set({source: 'blob:new'}); await tick();
    assert.equal(env.image.getAttribute(attribute), owner);
    controller.dispose();
    assert.equal(env.image.getAttribute(attribute), original);
    assert.equal(env.image.style.cssText, originalStyle);
    assert.ok(env.styles[0].removed, 'owned stylesheet is removed with its helper');
  }
});

test('still and disabled unload video while balanced reattaches only an eligible source', async () => {
  const env = environment(); const controller = env.api.create(env.image); const video = controller.element;
  controller.set({source: 'blob:wallpaper'});
  assert.equal(video.src, '', 'enabled defaults to false');
  controller.set({enabled: true}); await tick();
  assert.equal(video.src, 'blob:wallpaper');
  controller.set({quality: 'still'});
  assert.equal(video.src, ''); assert.equal(video.hidden, true); assert.ok(video.paused);
  assert.equal(controller.status.reason, 'still');
  controller.set({quality: 'balanced'}); await tick();
  assert.equal(video.src, 'blob:wallpaper'); assert.equal(video.hidden, false);
  controller.set({enabled: false});
  assert.equal(video.src, ''); assert.equal(video.hidden, true);
  controller.set({enabled: true, source: ''});
  assert.equal(video.src, ''); assert.equal(controller.status.reason, 'empty');
  controller.dispose();
});

test('document visibility, window focus and wall opacity compose correctly and do not retry while suspended', async () => {
  const env = environment(); const controller = env.api.create(env.image); const video = controller.element;
  controller.set({source: 'blob:wallpaper', enabled: true}); await tick();
  env.doc.hidden = true; env.doc.emit('visibilitychange');
  assert.ok(video.paused); assert.equal(controller.status.reason, 'hidden');
  env.win.emit('blur');
  env.doc.hidden = false; env.doc.emit('visibilitychange');
  assert.equal(video.playCalls, 1, 'visible document still waits for window focus');
  env.win.emit('focus'); await tick(); assert.equal(video.playCalls, 2);
  env.image.style.opacity = '0'; env.observers[0].callback();
  assert.ok(video.paused); assert.equal(controller.status.reason, 'opacity');
  env.win.emit('focus'); assert.equal(video.playCalls, 2);
  env.image.style.opacity = '.5'; controller.sync(); await tick();
  assert.equal(video.playCalls, 3); assert.equal(video.style.opacity, '.5');
  controller.dispose();
});

test('already hidden or blurred windows do not start media decoding', async () => {
  for (const options of [{hidden: true}, {focused: false}]) {
    const env = environment(options); const controller = env.api.create(env.image);
    controller.set({source: 'blob:wallpaper', enabled: true}); await tick();
    assert.equal(controller.element.playCalls, 0);
    assert.equal(controller.element.src, '');
    controller.dispose();
  }
});

test('reduced motion unloads and resumes correctly, including legacy media-query listeners', async () => {
  for (const legacyMotion of [false, true]) {
    const env = environment({reduced: true, legacyMotion});
    const controller = env.api.create(env.image); const video = controller.element;
    controller.set({source: 'blob:wallpaper', enabled: true});
    assert.equal(video.src, ''); assert.equal(video.playCalls, 0);
    assert.equal(controller.status.reason, 'reduced-motion');
    env.motion.matches = false; env.motion.emit('change'); await tick();
    assert.equal(video.playCalls, 1);
    env.motion.matches = true; env.motion.emit('change');
    assert.equal(video.src, ''); assert.ok(video.paused); assert.equal(video.hidden, true);
    controller.dispose(); assert.equal(env.motion.count(), 0);
  }
});

test('play rejection or synchronous throw latches poster fallback without retrying same source', async () => {
  for (const play of [() => Promise.reject(new Error('NotAllowedError')), () => { throw new Error('NotSupportedError'); }]) {
    const env = environment({play}); const reports = [];
    const controller = env.api.create(env.image, status => reports.push(status)); const video = controller.element;
    controller.set({source: 'blob:bad', enabled: true}); await tick();
    assert.equal(controller.status.state, 'poster'); assert.equal(controller.status.reason, 'error');
    assert.equal(controller.status.fallback, true); assert.ok(controller.status.error);
    assert.equal(video.src, ''); assert.equal(video.hidden, true);
    env.win.emit('focus'); env.doc.emit('visibilitychange'); controller.set({source: 'blob:bad', enabled: true});
    assert.equal(video.playCalls, 1);
    assert.equal(reports.filter(status => status.reason === 'error').length, 1);
    controller.set({source: 'blob:new'}); await tick(); assert.equal(video.playCalls, 2, 'new source clears the latch');
    controller.dispose();
  }
});

test('source load failure falls back without attempting play or retrying', async () => {
  const env = environment({loadError: true});
  const controller = env.api.create(env.image);
  controller.set({source: 'blob:bad', enabled: true});
  assert.equal(controller.status.state, 'poster');
  assert.equal(controller.element.src, '');
  assert.equal(controller.element.playCalls, 0);
  env.win.emit('focus');
  assert.equal(controller.element.playCalls, 0);
  controller.dispose();
});

test('native decode errors and unexpected oversized metadata fall back and unload', async () => {
  for (const event of ['error', 'loadedmetadata']) {
    const env = environment(); const controller = env.api.create(env.image);
    controller.set({source: 'blob:bad', enabled: true}); await tick();
    Object.assign(controller.element, {videoWidth: 7680, videoHeight: 4320, duration: 10});
    controller.element.emit(event);
    assert.equal(controller.status.state, 'poster'); assert.equal(controller.element.src, '');
    env.win.emit('focus'); assert.equal(controller.element.playCalls, 1);
    controller.dispose();
  }
});

test('metadata is available to caller and observer errors cannot break lifecycle', async () => {
  const env = environment(); const controller = env.api.create(env.image, () => { throw new Error('UI callback'); });
  controller.set({source: 'blob:wallpaper', enabled: true}); await tick();
  Object.assign(controller.element, {videoWidth: 1280, videoHeight: 720, duration: 10});
  controller.element.emit('loadedmetadata');
  assert.deepEqual(JSON.parse(JSON.stringify(controller.meta)), {width: 1280, height: 720, duration: 10});
  assert.equal(controller.status.meta, controller.meta);
  controller.dispose();
});

test('pending play aborted by visibility or source switch cannot resurrect an obsolete video', async () => {
  const pending = [];
  const env = environment({play: () => new Promise((resolve, reject) => pending.push({resolve, reject}))});
  const controller = env.api.create(env.image); const video = controller.element;
  controller.set({source: 'blob:first', enabled: true});
  env.win.emit('blur'); pending[0].reject(new Error('AbortError')); await tick();
  assert.equal(controller.status.reason, 'blur'); assert.equal(controller.status.error, null);
  env.win.emit('focus');
  controller.set({source: 'blob:second'});
  pending[1].reject(new Error('obsolete play rejection')); await tick();
  assert.equal(video.src, 'blob:second'); assert.equal(controller.status.error, null);
  pending[2].resolve(); await tick(); assert.equal(controller.status.state, 'playing');
  controller.dispose();
});

test('dispose removes all listeners, observer, element and src, and ignores late play completions', async () => {
  let resolve;
  const env = environment({play: () => new Promise(done => { resolve = done; })});
  const controller = env.api.create(env.image); const video = controller.element;
  controller.set({source: 'blob:wallpaper', enabled: true});
  assert.ok(env.win.count() && env.doc.count() && env.motion.count() && video.count());
  controller.dispose(); controller.dispose(); resolve(); await tick();
  for (const target of [env.win, env.doc, env.motion, video]) assert.equal(target.count(), 0);
  assert.ok(env.observers[0].disconnected); assert.ok(video.removed);
  assert.equal(video.src, ''); assert.ok(video.paused); assert.equal(video.hidden, true);
  assert.equal(controller.status.state, 'disposed');
  controller.set({source: 'blob:later', enabled: true}); controller.sync();
  assert.equal(video.src, ''); assert.equal(video.playCalls, 1);
  assert.equal(env.revoked.length, 0, 'caller retains ownership of source ObjectURLs');
});

test('non-ObjectURL sources are rejected without starting a network or data-URL request', () => {
  const env = environment(); const controller = env.api.create(env.image);
  for (const value of ['https://example.com/video.mp4', 'data:video/mp4;base64,AAAA', '/clip.mp4', null]) {
    assert.throws(() => controller.set({source: value, enabled: true}), TypeError);
    assert.equal(controller.element.src, '');
  }
  controller.dispose();
});
