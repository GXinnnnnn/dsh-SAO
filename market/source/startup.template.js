/* Early, dependency-free startup face injected by the DSH Host.
 * Own DOM only; bounded shared preferences and no permanent UI.
 */
(() => {
  const key = Symbol.for('dsh.sao.startup.v3'), replayKey = Symbol.for('dsh.sao.replay.v4');
  const implementation = '__SAO_IMPLEMENTATION__';
  const previousReplay = window[replayKey], previousStartup = window[key];
  if (typeof previousReplay === 'function' && previousReplay.implementation === implementation) return;
  const DEFAULTS = { startup: true, animation: '1', voice: 'kirito', sound: true, volume: 0.65 };
  function preferences(overrides) {
    const output = { ...DEFAULTS };
    function apply(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return;
      for (const name of ['startup', 'sound']) if (typeof value[name] === 'boolean') output[name] = value[name];
      if (value.animation === '1' || value.animation === '2') output.animation = value.animation;
      if (value.voice === 'kirito' || value.voice === 'asuna') output.voice = value.voice;
      if (typeof value.volume === 'number' && Number.isFinite(value.volume)) output.volume = Math.min(1, Math.max(0, value.volume));
    }
    try {
      const raw = localStorage.getItem('dsh-sao.preferences.v4');
      if (raw && raw.length <= 4096) apply(JSON.parse(raw));
    } catch { /* A blocked store or malformed JSON uses defaults. */ }
    try { apply(overrides); } catch { /* Ignore malformed preview overrides. */ }
    return output;
  }
  const MEDIA = __SAO_MEDIA__;
  const WORKER = __SAO_WORKER__;
  __SAO_RENDERER__
  function createScene(settings) {
    window[key]?.stop?.();
    const root = document.createElement('section');
    root.id = 'sao-startup'; root.className = 'sao-start'; root.tabIndex = -1;
    root.dataset.animation = settings.animation;
    root.dataset.implementation = implementation;
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Link Start 启动动画');
    const style = document.createElement('style'); style.dataset.saoLinkStart = '4';
    style.textContent = `
#sao-startup{position:fixed!important;inset:0!important;z-index:2147483647!important;overflow:hidden;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;pointer-events:auto;isolation:isolate;font-family:"Segoe UI","Microsoft YaHei",sans-serif}
/* Own every backing layer, including while an older client still marks dialogs as glass. */
#sao-startup::before,#sao-startup::after{content:none!important;display:none!important}
#sao-startup>[data-sao-liquid]{display:none!important}
#sao-startup .sao-backdrop{position:absolute;inset:0;background:#fff;pointer-events:none}
#sao-startup canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
#sao-startup .sao-intro{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:#10191f;color:#eefaff;font-size:clamp(32px,5vw,76px);letter-spacing:.13em;font-weight:300;pointer-events:none}
#sao-startup button{font:12px "Segoe UI","Microsoft YaHei",sans-serif;cursor:pointer;box-sizing:border-box}
#sao-startup button:focus-visible{outline:3px solid #f0a33b;outline-offset:3px}
#sao-startup .sao-skip{opacity:.9;position:absolute;right:max(24px,env(safe-area-inset-right));bottom:max(20px,env(safe-area-inset-bottom));border:0;background:transparent;color:#475569;padding:0;border-radius:0;box-shadow:none;font-size:11px;line-height:1.5}
#sao-startup canvas[data-renderer="static"]~.sao-skip{color:#dce9f2}
#sao-startup .sao-skip:hover,#sao-startup .sao-skip:focus-visible{opacity:1}
#sao-startup .sao-sound-hint{position:absolute;bottom:28px;left:50%;transform:translateX(-50%);max-width:90%;background:#142632ed;color:#fff;border:1px solid #80b9ce;border-radius:3px;padding:11px 18px}
@keyframes sao-startup-exit{to{opacity:0}}
@keyframes sao-startup-backdrop{to{opacity:0}}
`;
    const backdrop = document.createElement('div'); backdrop.className = 'sao-backdrop'; backdrop.setAttribute('aria-hidden', 'true');
    let canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true');
    const intro = document.createElement('div'); intro.className = 'sao-intro'; intro.textContent = 'LINK START'; intro.setAttribute('aria-hidden', 'true');
    const skip = document.createElement('button'); skip.type = 'button'; skip.className = 'sao-skip'; skip.textContent = '点击任意地方跳过'; skip.setAttribute('aria-keyshortcuts', 'Escape');
    const hint = document.createElement('button'); hint.type = 'button'; hint.className = 'sao-sound-hint'; hint.textContent = '浏览器已阻止自动声音 · 点击任意位置跳过'; hint.hidden = true;
    const previousFocus = document.activeElement, motion = matchMedia('(prefers-reduced-motion: reduce)');
    let done = false, worker = null, workerURL = null, renderer = null, frame = 0, timer = 0, epoch = 0, sound = null;
    let initTimer = 0, mode = 'static', exitStarted = false, lastCoverage = 0;
    const view = { width: innerWidth, height: innerHeight, dpr: devicePixelRatio || 1 };
    const engine = settings.animation === '2' ? ThinSAO : NativeSAO;
    const exitEarliest = settings.animation === '2' ? SAO_EXIT.earliest : SAO_EXIT.nativeEarliest;
    const state = { stop: finish, finished: false };
    window[key] = state;
    function finish() {
      if (done) return; done = true;
      cancelAnimationFrame(frame); clearTimeout(timer); clearTimeout(initTimer);
      worker?.terminate(); worker = null;
      if (workerURL) { URL.revokeObjectURL(workerURL); workerURL = null; }
      renderer?.dispose(); renderer = null; sound?.dispose(); sound = null;
      document.removeEventListener('keydown', onKey, true); document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize); window.removeEventListener('pagehide', finish); motion.removeEventListener('change', finish);
      if (root.contains(document.activeElement) && previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
      root.remove(); state.finished = true;
      if (window[key] === state) window[key] = { finished: true };
    }
    function fadeOut(duration) {
      if (done || exitStarted) return;
      exitStarted = true;
      root.style.animation = `sao-startup-exit ${duration}ms ease-in-out forwards`;
      sound?.fade(duration);
      clearTimeout(timer);
      timer = setTimeout(finish, duration + 50);
    }
    function onKey(event) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(); }
      if (event.key === 'Tab') {
        const last = hint.hidden ? skip : hint;
        if (event.shiftKey && (document.activeElement === skip || !root.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { event.preventDefault(); skip.focus(); }
      }
    }
    function onVisibility() { if (!document.hidden && !epoch) start(); else if (document.hidden && epoch) finish(); }
    function onResize() {
      Object.assign(view, { width: innerWidth, height: innerHeight, dpr: devicePixelRatio || 1 });
      if (worker) worker.postMessage({ type: 'resize', view });
    }
    root.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); finish(); }, true);
    document.addEventListener('keydown', onKey, true); document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', onResize); motion.addEventListener('change', finish);
    window.addEventListener('pagehide', finish, { once: true });
    // Bounded independently of interface readiness. A failed host must not trap the page.
    timer = setTimeout(finish, 60000);
    function prepareSound() {
      if (!settings.sound || settings.volume === 0) return null;
      const AudioEngine = window.AudioContext || window.webkitAudioContext;
      if (!AudioEngine) return null;
      const context = new AudioEngine(), gain = context.createGain(); gain.gain.value = settings.volume; gain.connect(context.destination);
      let sources = [], closed = false;
      const dispose = () => { if (closed) return; closed = true; for (const node of sources) { try { node.stop(); } catch {} node.disconnect(); } gain.disconnect(); context.close().catch(() => {}); };
      sound = { dispose };
      try {
        // Original assets are verified PCM16 WAVs. Decode synchronously so both
        // sounds can be scheduled before the frontend's next heavy script runs.
        const buffers = [settings.voice, 'startup'].map(name => {
          const raw = atob(MEDIA[name].split(',')[1]), bytes = Uint8Array.from(raw, ch => ch.charCodeAt(0)), data = new DataView(bytes.buffer);
          let format = 0, channels = 0, rate = 0, bits = 0, offset = 0, size = 0;
          for (let pos = 12; pos + 8 <= bytes.length;) {
            const tag = String.fromCharCode(...bytes.subarray(pos, pos + 4)), length = data.getUint32(pos + 4, true);
            if (tag === 'fmt ') { format = data.getUint16(pos + 8, true); channels = data.getUint16(pos + 10, true); rate = data.getUint32(pos + 12, true); bits = data.getUint16(pos + 22, true); }
            if (tag === 'data') { offset = pos + 8; size = length; }
            pos += 8 + length + (length & 1);
          }
          if (format !== 1 || bits !== 16 || !channels || !rate || !offset || offset + size > bytes.length) throw Error('Unsupported WAV');
          const count = Math.floor(size / (channels * 2)), buffer = context.createBuffer(channels, count, rate);
          for (let channel = 0; channel < channels; channel++) { const out = buffer.getChannelData(channel); for (let i = 0; i < count; i++) out[i] = data.getInt16(offset + (i * channels + channel) * 2, true) / 32768; }
          return buffer;
        });
        if (done || closed) { dispose(); return null; }
        return {
          dispose,
          fade(milliseconds) {
            if (closed) return;
            const now = context.currentTime;
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(gain.gain.value, now);
            gain.gain.linearRampToValueAtTime(0, now + milliseconds / 1000);
          },
          start() {
            if (closed) return;
            for (const node of sources) { try { node.stop(); } catch {} node.disconnect(); } sources = [];
            context.resume().catch(() => { if (!done) hint.hidden = false; });
            hint.hidden = context.state === 'running';
            const start = context.currentTime + 0.04;
            buffers.forEach((buffer, index) => { const node = context.createBufferSource(); node.buffer = buffer; node.connect(gain); node.start(start + (index ? 1 : 0)); sources.push(node); });
          }
        };
      } catch { dispose(); return null; }
    }
    function fallback() {
      worker?.terminate(); worker = null;
      if (workerURL) { URL.revokeObjectURL(workerURL); workerURL = null; }
      const replacement = document.createElement('canvas'); replacement.setAttribute('aria-hidden', 'true'); canvas.replaceWith(replacement); canvas = replacement;
      try { renderer = engine.createRenderer(canvas, Date.now() >>> 0, view); } catch {}
      return renderer ? (settings.animation === '2' ? 'canvas2d' : 'webgl') : 'static';
    }
    function prepareRenderer() {
      if (motion.matches) return 'static';
      if (!canvas.transferControlToOffscreen || !window.Worker) return fallback();
      function recover() {
        if (done || !worker) return;
        clearTimeout(initTimer); mode = fallback(); canvas.dataset.renderer = mode;
        if (epoch) {
          cancelAnimationFrame(frame);
          if (!exitStarted) clearTimeout(timer);
          if (renderer) { frame = requestAnimationFrame(tick); if (!exitStarted) timer = setTimeout(finish, 6500); }
          else if (!exitStarted) { sound?.dispose(); sound = null; hint.hidden = true; intro.style.display = 'flex'; timer = setTimeout(finish, 900); }
        }
      }
      try {
        workerURL = URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' })); worker = new Worker(workerURL);
        worker.onmessage = ({ data }) => {
          if (done) return;
          if (data.type === 'ready') { clearTimeout(initTimer); if (workerURL) URL.revokeObjectURL(workerURL); workerURL = null; }
          else if (data.type === 'fade') fadeOut(data.duration);
          else if (data.type === 'done') { if (!exitStarted) finish(); }
          else if (data.type === 'unsupported') recover();
        };
        worker.onerror = event => { event.preventDefault(); recover(); };
        const offscreen = canvas.transferControlToOffscreen(); worker.postMessage({ type: 'init', canvas: offscreen, view, seed: Date.now() >>> 0, animation: settings.animation }, [offscreen]);
        initTimer = setTimeout(recover, 3000);
        return settings.animation === '2' ? 'worker-canvas2d' : 'worker-webgl';
      } catch { clearTimeout(initTimer); return fallback(); }
    }
    function tick(now) {
      if (done) return;
      const elapsed = performance.timeOrigin + now - epoch;
      renderer.draw(elapsed - 1000, saoStartupBackgroundOpacity(elapsed, settings.animation));
      if (!exitStarted && elapsed >= exitEarliest && elapsed - lastCoverage >= SAO_EXIT.interval) {
        lastCoverage = elapsed;
        const coverage = renderer.lightCoverage(elapsed - 1000);
        if (coverage <= SAO_EXIT.threshold || elapsed >= SAO_EXIT.latest)
          fadeOut(Math.max(0, Math.min(SAO_EXIT.duration, SAO_EXIT.end - elapsed)));
      }
      if (elapsed >= SAO_EXIT.end) { if (!exitStarted) finish(); return; }
      frame = requestAnimationFrame(tick);
    }
    function start() {
      if (done || document.hidden) return;
      epoch = performance.timeOrigin + performance.now() + 40;
      clearTimeout(timer); cancelAnimationFrame(frame);
      root.style.animation = 'none'; void root.offsetWidth;
      if (mode === 'static') { intro.style.display = 'flex'; timer = setTimeout(finish, 900); return; }
      const backgroundStart = settings.animation === '2' ? SAO_EXIT.backgroundStart : SAO_EXIT.nativeBackgroundStart;
      // x(t)=t and y(t)=smoothstep: matches the renderers' real alpha exactly.
      // The 40ms lead-in shares the worker epoch; loading the host never waits.
      backdrop.style.animation = `sao-startup-backdrop ${SAO_EXIT.backgroundDuration}ms cubic-bezier(.333333,0,.666667,1) ${backgroundStart + 40}ms forwards`;
      // Each renderer requests the final streak dissolve when its visible streaks are sparse.
      // The opening is protected by SAO_EXIT.earliest; no GPU pixels are read back.
      exitStarted = false; lastCoverage = 0;
      sound?.start();
      if (worker) worker.postMessage({ type: 'start', epoch });
      else frame = requestAnimationFrame(tick);
      timer = setTimeout(finish, 6500);
    }
    // Any click dismisses the scene, including the muted autoplay hint.
    // Queue the worker and both sounds before returning to the host. No promise
    // or module-system barrier delays the DSH frontend loading behind this root.
    try {
      root.append(style, backdrop, canvas, intro, skip, hint); document.documentElement.appendChild(root);
      root.focus({ preventScroll: true });
      mode = prepareRenderer(); canvas.dataset.renderer = mode;
      sound = mode === 'static' ? null : prepareSound(); start();
    } catch { finish(); }
    return state;
  }
  // Replace stale same-version closures, but keep duplicate injection idempotent.
  const replay = overrides => createScene(preferences(overrides));
  Object.defineProperty(replay, 'implementation', { value: implementation });
  window[replayKey] = replay;
  if (previousStartup || typeof previousReplay === 'function') {
    previousStartup?.stop?.();
    return; // A client update must not replay the automatic startup over a live page.
  }
  const settings = preferences();
  if (!settings.startup) { window[key] = { finished: true }; return; }
  createScene(settings);
})();
