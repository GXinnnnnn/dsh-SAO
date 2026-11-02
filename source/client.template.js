/* SAO Link Start for DSH. Original D3D scene ported to WebGL.
 * Audio bytes are copied unchanged from the user's SAO archive; see SOURCE.md.
 * Generated client.js is self-contained: no CDN, static host route or extra React.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-sao-link-start',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const MEDIA = __SAO_MEDIA__;
    const KEY = 'dsh-sao-link-start.v1';
    const DEFAULTS = { skin: true, startup: true, sound: true, volume: 0.65, voice: 'kirito' };
    const TOKENS = {
      '--dsw-alias-bg-base': { light: '#f2f6f8', dark: '#10191f' },
      '--dsw-alias-bg-layer-1': { light: '#ffffff', dark: '#17232b' },
      '--dsw-alias-bg-layer-2': { light: '#e9f0f3', dark: '#21323b' },
      '--dsw-alias-bg-overlay': { light: '#ffffff', dark: '#1b2932' },
      '--dsw-specific-sidebar-fill': { light: '#e8eff2', dark: '#121f27' },
      '--dsw-alias-border-l1': { light: '#c9d8df', dark: '#354c59' },
      '--dsw-alias-border-l2': { light: '#dde6eb', dark: '#293d48' },
      '--dsw-alias-brand-primary': { light: '#aa5a0a', dark: '#ffb44b' },
      '--dsw-alias-label-primary': { light: '#20323d', dark: '#e5f1f6' },
      '--dsw-alias-label-secondary': { light: '#546d7a', dark: '#adc6d2' }
    };
    const CSS = `
.sao-root{position:absolute;inset:0;pointer-events:none!important;font-family:Inter,"Segoe UI","Microsoft YaHei",sans-serif}
.sao-root *{box-sizing:border-box}
.sao-root button,.sao-root input,.sao-root select{font:inherit}
.sao-root button{cursor:pointer}
.sao-root button:focus-visible,.sao-root input:focus-visible,.sao-root select:focus-visible{outline:3px solid #f0a33b;outline-offset:3px}
.sao-start{position:absolute;inset:0;overflow:hidden;background:transparent;color:#eefaff;pointer-events:auto;isolation:isolate}
.sao-start canvas{position:absolute;inset:0;width:100%;height:100%}
.sao-start .sao-intro{position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:19px;pointer-events:none}
.sao-intro small{font-size:10px;letter-spacing:.42em;color:#83aebd}
.sao-intro strong{font-size:clamp(32px,5vw,76px);letter-spacing:.13em;font-weight:300;text-indent:.13em}
.sao-intro i{height:2px;width:130px;background:#f6b34c;box-shadow:0 0 18px #f6b34c}
.sao-skip{opacity:0;transition:opacity .15s;position:absolute;right:28px;top:24px;border:1px solid #78919e;background:#152430dd;color:#fff;padding:9px 15px;border-radius:3px;font-size:12px!important}
.sao-skip:hover,.sao-skip:focus-visible{opacity:1}
.sao-sound-hint{position:absolute;bottom:32px;left:50%;transform:translateX(-50%);background:#142632ed;color:#fff;border:1px solid #80b9ce;border-radius:3px;padding:11px 18px;max-width:90%;font-size:12px!important}
.sao-tools{--sao-tools-bottom:18px;position:absolute;left:20px;bottom:var(--sao-tools-bottom);display:flex;flex-direction:row-reverse;align-items:flex-end;gap:10px;pointer-events:auto}
.sao-launch{height:38px;width:44px;border:1px solid #8ea9b5;background:#1c303a;color:#f7bc62;box-shadow:0 3px 14px #0002;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px);letter-spacing:.08em;font-size:11px!important;font-weight:700!important}
.sao-panel{width:310px;max-width:calc(100vw - 84px);max-height:calc(100vh - var(--sao-tools-bottom) - 16px);overflow:auto;background:#f5f8fa;color:#233c49;border:1px solid #aec3ce;border-radius:5px;box-shadow:0 12px 45px #07141c35;padding:22px}
.sao-panel header{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.sao-panel header i{width:5px;height:20px;background:#c07616;transform:skew(-16deg)}
.sao-panel h2{font-size:16px;letter-spacing:.08em;margin:0;font-weight:600}
.sao-panel .sao-sub{font-size:11px;color:#637c89;line-height:1.7;margin:0 0 20px}
.sao-panel label{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;font-size:13px;line-height:1.5}
.sao-panel input[type=checkbox]{accent-color:#986017;width:17px;height:17px;margin:0}
.sao-panel input[type=range]{width:130px;accent-color:#986017}
.sao-panel select{max-width:145px;border:1px solid #9fb8c4;background:white;color:#233c49;padding:5px;border-radius:3px;font-size:12px}
.sao-panel .sao-play{width:100%;padding:11px;background:#253d49;border:1px solid #253d49;color:#fff;border-radius:3px;margin-top:15px;font-size:13px;letter-spacing:.06em}
.sao-panel .sao-note{font-size:11px;color:#567280;line-height:1.7;margin:12px 0 0}
.sao-panel footer{margin-top:18px;border-top:1px solid #cfdee6;padding-top:12px;font-size:10px;letter-spacing:.08em;color:#617e8b}
@media(max-width:500px){.sao-tools{--sao-tools-bottom:10px;left:10px;gap:6px}.sao-panel{padding:16px}.sao-skip{right:16px;top:16px}}
@media(prefers-reduced-motion:reduce){.sao-root *{scroll-behavior:auto}}
`;
    function loadPreferences() {
      try {
        const p = JSON.parse(localStorage.getItem(KEY) || '{}');
        const output = { ...DEFAULTS };
        for (const key of ['skin', 'startup', 'sound']) if (typeof p[key] === 'boolean') output[key] = p[key];
        if (typeof p.volume === 'number' && Number.isFinite(p.volume)) output.volume = Math.min(1, Math.max(0, p.volume));
        if (p.voice === 'asuna' || p.voice === 'kirito') output.voice = p.voice;
        return output;
      } catch { return { ...DEFAULTS }; }
    }
    __SAO_RENDERER__
    function createController(ctx) {
      let preferences = loadPreferences();
      const listeners = new Set();
      let revision = 0, skinDisposer = null, disposed = false;
      function updateSkin() {
        if (skinDisposer) { skinDisposer(); skinDisposer = null; }
        if (preferences.skin) skinDisposer = ctx.theme.overrideTokens('sao-link-start', TOKENS);
      }
      updateSkin();
      return {
        get: () => preferences,
        revision: () => revision,
        subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
        update(key, value) {
          if (disposed) return;
          preferences = { ...preferences, [key]: value }; revision++;
          try { localStorage.setItem(KEY, JSON.stringify(preferences)); } catch { /* Session preferences still work. */ }
          if (key === 'skin') updateSkin();
          for (const fn of listeners) fn();
        },
        dispose() { disposed = true; if (skinDisposer) skinDisposer(); listeners.clear(); }
      };
    }
    function Startup({ preferences, run, onFinish, onBlocked, onReplay }) {
      const canvasRef = React.useRef(null), introRef = React.useRef(null), rootRef = React.useRef(null);
      const [blocked, setBlocked] = React.useState(false);
      React.useEffect(() => {
        let done = false, frame = 0, timer = 0;
        const root = rootRef.current, previousFocus = document.activeElement;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
        const minimal = reduced.matches;
        let renderer = null;
        try { if (!minimal) renderer = NativeSAO.createRenderer(canvasRef.current, Date.now() >>> 0); } catch { /* A short static intro is available when the GPU cannot initialize. */ }
        const staticMode = minimal || !renderer;
        if (canvasRef.current) canvasRef.current.dataset.renderer = renderer ? 'webgl' : 'static';
        if (introRef.current) { introRef.current.style.display = staticMode ? 'flex' : 'none'; introRef.current.style.background = '#10191f'; }
        const delay = preferences.voice === 'asuna' ? 950 : 1000;
        const sounds = [];
        const finish = () => { if (!done) onFinish(); };
        const stopSounds = () => { for (const audio of sounds) { audio.pause(); audio.removeAttribute('src'); audio.load(); } };
        function play(src) {
          if (done || !preferences.sound || preferences.volume === 0 || staticMode) return;
          const audio = new Audio(src); audio.volume = preferences.volume; sounds.push(audio);
          audio.play().catch(() => { if (!done) { setBlocked(true); onBlocked(); } });
        }
        function key(event) {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(); }
          // Keep keyboard focus inside the temporary modal, including Shift+Tab.
          if (event.key === 'Tab' && root) {
            const buttons = Array.from(root.querySelectorAll('button:not(:disabled)'));
            if (buttons.length) {
              const first = buttons[0], last = buttons[buttons.length - 1];
              if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
              else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
            }
          }
        }
        const start = performance.now();
        root?.focus({ preventScroll: true });
        document.addEventListener('keydown', key, true);
        const onHidden = () => { if (document.hidden) finish(); };
        const onMotionChange = () => finish();
        document.addEventListener('visibilitychange', onHidden);
        reduced.addEventListener('change', onMotionChange);
        play(MEDIA[preferences.voice]);
        if (!minimal) timer = window.setTimeout(() => play(MEDIA.startup), delay);
        function tick(now) {
          if (done) return;
          const seconds = Math.max(0, (now - start) / 1000);
          const duration = minimal || !renderer ? 0.9 : delay / 1000 + 4.25;
          if (renderer) renderer.draw(seconds * 1000 - delay);
          if (seconds >= duration) { finish(); return; }
          frame = requestAnimationFrame(tick);
        }
        frame = requestAnimationFrame(tick);
        return () => {
          done = true; cancelAnimationFrame(frame); clearTimeout(timer); stopSounds(); renderer?.dispose();
          document.removeEventListener('keydown', key, true);
          document.removeEventListener('visibilitychange', onHidden);
          reduced.removeEventListener('change', onMotionChange);
          if (root?.contains(document.activeElement) && previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
        };
      }, [run]);
      return h('section', { ref: rootRef, className: 'sao-start', tabIndex: -1, role: 'dialog', 'aria-modal': true, 'aria-label': 'Link Start 启动动画' },
        h('canvas', { ref: canvasRef, 'aria-hidden': true }),
        h('div', { ref: introRef, className: 'sao-intro', 'aria-hidden': true }, h('small', null, 'NERVEGEAR / DSH'), h('strong', null, 'LINK START'), h('i')),
        h('button', { type: 'button', className: 'sao-skip', onClick: onFinish }, '跳过 · Esc'),
        blocked && h('button', { type: 'button', className: 'sao-sound-hint', onClick: onReplay }, '浏览器已阻止自动声音 · 点击有声重播'));
    }
    function makeOverlay(controller) {
      return function Overlay() {
        React.useSyncExternalStore(controller.subscribe, controller.revision, controller.revision);
        const p = controller.get();
        const [open, setOpen] = React.useState(false);
        const [run, setRun] = React.useState(() => p.startup ? 1 : 0);
        const [playing, setPlaying] = React.useState(() => p.startup);
        const [blocked, setBlocked] = React.useState(false);
        const panelRef = React.useRef(null), launchRef = React.useRef(null), toolsRef = React.useRef(null);
        // The optional whale widget occupies the same corner above shell.overlay.
        // Keep its hit area intact and place our controls above its actual bounds.
        React.useLayoutEffect(() => {
          if (playing) return;
          let frame = 0;
          const watched = new WeakSet();
          const resize = new ResizeObserver(schedule);
          const mutations = new MutationObserver(schedule);
          function update() {
            frame = 0;
            const tools = toolsRef.current, button = launchRef.current;
            if (!tools || !button) return;
            const height = window.innerHeight, bounds = button.getBoundingClientRect();
            const gap = window.matchMedia('(max-width: 500px)').matches ? 10 : 18;
            let bottom = gap;
            for (const widget of document.querySelectorAll('.dshwv-root')) {
              if (!watched.has(widget)) { watched.add(widget); resize.observe(widget); mutations.observe(widget, { attributes: true, attributeFilter: ['style', 'class'] }); }
              const r = widget.getBoundingClientRect();
              if (r.width > 0 && r.height > 0 && r.right > bounds.left && r.left < bounds.right && r.top < height - gap && r.bottom > height - gap - 38) bottom = Math.max(bottom, height - r.top + 12);
            }
            tools.style.setProperty('--sao-tools-bottom', `${Math.min(bottom, Math.max(gap, height - 60))}px`);
          }
          function schedule() { if (!frame) frame = requestAnimationFrame(update); }
          mutations.observe(document.body, { childList: true, subtree: true });
          window.addEventListener('resize', schedule);
          update();
          return () => { cancelAnimationFrame(frame); mutations.disconnect(); resize.disconnect(); window.removeEventListener('resize', schedule); };
        }, [playing]);
        const finish = React.useCallback(() => setPlaying(false), []);
        const markBlocked = React.useCallback(() => setBlocked(true), []);
        const replay = React.useCallback(() => { setBlocked(false); setOpen(false); setRun(value => value + 1); setPlaying(true); }, []);
        React.useEffect(() => {
          if (!open) return;
          function outside(event) {
            if (!panelRef.current?.contains(event.target) && !launchRef.current?.contains(event.target)) setOpen(false);
          }
          function key(event) { if (event.key === 'Escape') { setOpen(false); launchRef.current?.focus(); } }
          document.addEventListener('pointerdown', outside);
          document.addEventListener('keydown', key);
          return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); };
        }, [open]);
        function check(key, text) {
          return h('label', { key }, h('span', null, text), h('input', { type: 'checkbox', checked: p[key], onChange: event => controller.update(key, event.target.checked) }));
        }
        return h('div', { className: 'sao-root' },
          !playing && h('div', { ref: toolsRef, className: 'sao-tools' },
            open && h('section', { ref: panelRef, className: 'sao-panel', 'aria-label': 'SAO 插件设置' },
              h('header', null, h('i', { 'aria-hidden': true }), h('h2', null, 'LINK START')),
              h('p', { className: 'sao-sub' }, 'SAO 启动动画与界面皮肤'),
              check('skin', 'SAO 界面配色'), check('startup', '打开 DSH 时播放'), check('sound', '原版启动声音'),
              h('label', null, h('span', null, '角色语音'), h('select', { 'aria-label': '角色语音', value: p.voice, onChange: event => controller.update('voice', event.target.value) }, h('option', { value: 'kirito' }, '桐人 · SAO'), h('option', { value: 'asuna' }, '亚丝娜 · SAO'))),
              h('label', null, h('span', null, `音量 ${Math.round(p.volume * 100)}%`), h('input', { type: 'range', 'aria-label': '启动声音音量', min: 0, max: 1, step: 0.05, value: p.volume, onChange: event => controller.update('volume', Number(event.target.value)) })),
              h('button', { type: 'button', className: 'sao-play', onClick: replay }, '▷  重播 Link Start'),
              h('p', { className: 'sao-note', role: 'status' }, blocked ? '浏览器拦截了自动声音。点击重播即可用手势启动；关闭声音后仍可播放动画。' : 'Esc 可随时跳过。系统开启“减少动态效果”时，使用简短静态开场并静音。'),
              h('footer', null, 'ORIGINAL SCENE · WEBGL · 4K')),
            h('button', { ref: launchRef, type: 'button', className: 'sao-launch', 'aria-label': 'Link Start 设置与重播', 'aria-expanded': open, onClick: () => setOpen(value => !value), title: 'Link Start 设置与重播' }, 'SAO')),
          playing && h(Startup, { key: run, preferences: p, run, onFinish: finish, onBlocked: markBlocked, onReplay: replay }));
      };
    }
    return {
      inject: ['slots', 'theme'],
      apply(ctx) {
        const controller = createController(ctx);
        ctx.effect(() => () => controller.dispose(), 'sao preferences and theme');
        ctx.effect(() => { const style = document.createElement('style'); style.dataset.saoLinkStart = '1'; style.textContent = CSS; document.head.appendChild(style); return () => style.remove(); }, 'sao scoped styles');
        const Overlay = makeOverlay(controller);
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'sao-link-start', order: 10 }, Overlay));
      }
    };
  }
});
