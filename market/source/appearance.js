/* Appearance-only controller. Native DSH settings slot, global accent and disposable shell material.
 * No layout slots, positioning changes to third-party plugins, or blanket div rules.
 */
function applySAOAppearance(ctx, React, builtins, animationPreviews = []) {
  const instanceKey = Symbol.for('dsh.sao.appearance.v4');
  window[instanceKey]?.dispose?.();
  // Retire DOM left by versions that did not expose a disposable controller.
  for (const el of document.querySelectorAll('style[data-sao-appearance],[data-sao-wallpaper],[data-sao-liquid]')) el.remove();
  const materialAttributes = ['data-sao-material','data-sao-positioned','data-sao-surface','data-sao-zone','data-sao-core-surface'];
  for (const el of document.querySelectorAll('[data-sao-component]')) el.removeAttribute('data-sao-component');
  for (const el of document.querySelectorAll('[data-sao-material],[data-sao-core-surface]')) for (const attr of materialAttributes) el.removeAttribute(attr);
  const KEY = 'dsh-sao.preferences.v4';
  const defaults = { startup: true, animation: '1', voice: 'kirito', sound: true, volume: .65, accent: null, surfaceColor: null, glass: 'liquid', opacity: .40, liquidOpacity: .40, frostOpacity: .50, rightLinked: true, rightGlass: 'liquid', rightOpacity: .50, rightBlur: 0, rightLiquidOpacity: .40, rightFrostOpacity: .50, windowOpacity: 1, composerOpacity: .90, componentOpacity: .90, headerOpacity: .40, rightHeaderOpacity: .40, headerLinked: true, wallpaper: 'none', wallX: 50, wallY: 50, wallScale: 100, wallOpacity: 1, conversationOpacity: .50, conversationBlur: 0, fontFamily: '方正兰亭圆_准', theme: 'system' };
  const bounded = (v, fallback, min, max) => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
  function normalize(value) {
    const p = value && typeof value === 'object' ? value : {}, n = { ...defaults };
    for (const k of ['startup','sound','rightLinked','headerLinked']) if (typeof p[k] === 'boolean') n[k] = p[k];
    if (p.animation === '2') n.animation = '2';
    if (p.voice === 'asuna') n.voice = 'asuna';
    for (const key of ['accent','surfaceColor']) if (typeof p[key] === 'string' && /^#[0-9a-f]{6}$/i.test(p[key])) n[key] = p[key].toUpperCase();
    if (['off','frosted','liquid'].includes(p.glass)) n.glass = p.glass;
    if (['off','frosted','liquid'].includes(p.rightGlass)) n.rightGlass = p.rightGlass;
    n.rightLiquidOpacity = bounded(p.rightLiquidOpacity, defaults.rightLiquidOpacity, 0, 1); n.rightFrostOpacity = bounded(p.rightFrostOpacity, defaults.rightFrostOpacity, 0, 1);
    n.rightOpacity = bounded(p.rightOpacity, defaults.rightOpacity, 0, 1);
    n.rightBlur = bounded(p.rightBlur, defaults.rightBlur, 0, 24);
    if (['none','custom',...builtins.map(x => x.id)].includes(p.wallpaper)) n.wallpaper = p.wallpaper;
    n.volume = bounded(p.volume, .65, 0, 1);
    n.liquidOpacity = bounded(p.liquidOpacity, defaults.liquidOpacity, 0, 1); n.frostOpacity = bounded(p.frostOpacity, defaults.frostOpacity, 0, 1);
    n.wallOpacity = bounded(p.wallOpacity, 1, 0, 1);
    n.windowOpacity = bounded(p.windowOpacity, defaults.windowOpacity, 0, 1);
    n.composerOpacity = bounded(p.composerOpacity, defaults.composerOpacity, 0, 1);
    n.componentOpacity = bounded(p.componentOpacity, defaults.componentOpacity, 0, 1);
    n.conversationOpacity = bounded(p.conversationOpacity, defaults.conversationOpacity, 0, 1);
    n.conversationBlur = bounded(p.conversationBlur, 0, 0, 24);
    if (typeof p.fontFamily === 'string' && p.fontFamily.trim() && p.fontFamily.length <= 160 && !/[\x00-\x1f]/.test(p.fontFamily)) n.fontFamily = p.fontFamily.trim();
    if (['system','light','dark'].includes(p.theme)) n.theme = p.theme;
    n.opacity = bounded(p.opacity, n.glass === 'frosted' ? n.frostOpacity : n.liquidOpacity, 0, 1);
    n.headerOpacity = bounded(p.headerOpacity, n.opacity, 0, 1);
    n.rightHeaderOpacity = bounded(p.rightHeaderOpacity, n.headerOpacity, 0, 1);
    n.wallX = bounded(p.wallX, 50, 0, 100); n.wallY = bounded(p.wallY, 50, 0, 100); n.wallScale = bounded(p.wallScale, 100, 100, 250);
    return n;
  }
  let preferences; try { preferences = normalize(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { preferences = { ...defaults }; }
  let disposed = false, notice = '', tokenDispose = null, customURL = null, customName = '', queued = 0, revision = 0, uploadRevision = 0;
  const subscribers = new Set(), panelDisposers = new Set(), touched = new Set(), componentTouched = new Set();
  const style = document.createElement('style'); style.dataset.saoAppearance = '4'; document.head.append(style);
  const background = document.createElement('div'); background.dataset.saoWallpaper = ''; background.setAttribute('aria-hidden','true');
  background.style.cssText = 'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:-1';
  const image = document.createElement('img'); image.alt = ''; image.draggable = false; image.style.cssText = 'width:100%;height:100%;object-fit:cover;pointer-events:none;display:block'; background.append(image);
  const conversationBackdrop = document.createElement('div'); conversationBackdrop.dataset.saoConversationBackdrop = ''; conversationBackdrop.hidden = true; background.append(conversationBackdrop);
  const rightBackdrop = document.createElement('div'); rightBackdrop.dataset.saoRightBackdrop = ''; rightBackdrop.hidden = true; background.append(rightBackdrop);
  let loadedSource = '', imageReady = false;
  const liquid = createSAOLiquidGlass();
  const baseColor = () => preferences.surfaceColor ? [1,3,5].map(i => parseInt(preferences.surfaceColor.slice(i,i+2),16)/255) : null;
  const sceneColor = () => liquid.sceneColor?.(baseColor()) || [0.906,0.937,0.969];
  const notify = () => { for (const fn of subscribers) fn(); };
  const storageNotice = error => { notice = error ? '无法保存到本机：' + (error.message || String(error)) : '已保存到本机'; notify(); };
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(preferences)); storageNotice(); } catch (error) { storageNotice(error); } }
  const scopes = '[data-slot="main.conversation"], [data-slot="rightbar"], [role="dialog"][data-shortcut-modal="settings"]';
  const layoutTouched = new Set(), shellTouched = new Set();
  let lastStyle = '', lastWallpaperCSS = '';
  const backdropStyles = new WeakMap();
  let conversationBounds = {x:0,y:0,width:innerWidth,height:innerHeight}, rightBounds = null, observedRight = null;
  const rightScene = () => ({opacity: preferences.rightLinked ? preferences.conversationOpacity : preferences.rightOpacity, blur: preferences.rightLinked ? preferences.conversationBlur : preferences.rightBlur});
  // Both columns use exactly the same full-area mask and blur, never two stacked fills.
  function paintBackdrop(element, box, opacity, blur, radius = '0px', corner = 'round') {
    element.hidden = !loadedSource || !box || opacity === 0 && blur === 0;
    if (!box) return;
    const css = `position:absolute;left:${box.x-bounds.x}px;top:${box.y-bounds.y}px;width:${box.width}px;height:${box.height}px;pointer-events:none;border-radius:${radius} 0 0 0;corner-shape:${corner};background:rgb(${sceneColor().map(v=>v*255).join(' ')} / ${opacity});backdrop-filter:${blur ? `blur(${blur}px)` : 'none'};-webkit-backdrop-filter:${blur ? `blur(${blur}px)` : 'none'}`;
    if (backdropStyles.get(element) !== css) { element.style.cssText = css; backdropStyles.set(element,css); }
  }
  const writeStyle = () => { if (style.textContent !== lastStyle) style.textContent = lastStyle; };
  let wallHost = null, frameHost = null, bounds = {x:0,y:0,width:innerWidth,height:innerHeight};
  function boxFor(outlet) {
    let el = outlet;
    while (el && getComputedStyle(el).display === 'contents') el = el.parentElement;
    return el;
  }
  function layoutWallpaper() {
    const outlet = document.querySelector('[data-slot="main.conversation"]');
    const column = boxFor(outlet?.parentElement || outlet);
    const frame = column?.parentElement;
    if (!outlet || !column || !frame) { background.remove(); return; }
    if (frame !== frameHost) {
      frameHost?.removeAttribute('data-sao-wall-frame');
      frameHost?.removeAttribute('data-sao-wall-positioned');
      frameHost = frame; frameHost.setAttribute('data-sao-wall-frame','');
      if (getComputedStyle(frameHost).position === 'static') frameHost.setAttribute('data-sao-wall-positioned','');
    }
    for (const [el, attr] of [[frame,'data-sao-shell'],[column,'data-sao-shell-center'],[boxFor(document.querySelector('[data-slot="sidebar"]')?.parentElement),'data-sao-shell-sidebar']]) if (el && !el.hasAttribute(attr)) { el.setAttribute(attr,''); shellTouched.add(el); }
    const c = column.getBoundingClientRect(), f = frame.getBoundingClientRect();
    // A collapsed 56px tool rail does not crop the wallpaper's full-window cover.
    const x = c.left - f.left <= 64 ? f.left : c.left;
    bounds = {x,y:c.top,width:Math.max(1,f.right-x),height:Math.max(1,c.height)};
    const columnStyle = getComputedStyle(column), radius = columnStyle.borderTopLeftRadius;
    const corner = columnStyle.getPropertyValue('corner-shape') || 'round';
    conversationBounds = {x:c.left,y:c.top,width:c.width,height:c.height};
    const wallCSS = `position:absolute;left:${x-f.left}px;top:${c.top-f.top}px;width:${bounds.width}px;height:${bounds.height}px;overflow:hidden;pointer-events:none;z-index:-1;border-radius:${x === c.left ? radius : '0px'} 0 0 0;corner-shape:${corner}`;
    if (lastWallpaperCSS !== wallCSS) { background.style.cssText = wallCSS; lastWallpaperCSS = wallCSS; }
    paintBackdrop(conversationBackdrop, conversationBounds, preferences.conversationOpacity, preferences.conversationBlur, radius, corner);
    if (background.parentElement !== frame) frame.prepend(background);
    if (!column.hasAttribute('data-sao-wall-column')) column.setAttribute('data-sao-wall-column',''); layoutTouched.add(column);
    const right = boxFor(document.querySelector('[data-slot="rightbar"]')?.parentElement);
    const r = right?.getBoundingClientRect();
    rightBounds = r && r.width > 0 && r.height > 0 ? {x:r.left,y:r.top,width:r.width,height:r.height} : null;
    const scene = rightScene();
    paintBackdrop(rightBackdrop, rightBounds, scene.opacity, scene.blur);
    for (const el of layoutTouched) if (el !== column && el !== right) { el.removeAttribute('data-sao-wall-column'); el.removeAttribute('data-sao-wall-right'); layoutTouched.delete(el); }
    if (right) { if (!right.hasAttribute('data-sao-wall-column')) right.setAttribute('data-sao-wall-column',''); if (!right.hasAttribute('data-sao-wall-right')) right.setAttribute('data-sao-wall-right',''); layoutTouched.add(right); }
    if (wallHost !== column || observedRight !== right) { resizeObserver?.disconnect(); resizeObserver?.observe(column); resizeObserver?.observe(frame); if (right) resizeObserver?.observe(right); wallHost = column; observedRight = right; }
  }
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    if (disposed || !loadedSource) return;
    // ResizeObserver runs before paint: keep the mask and optical samples on
    // the same geometry, without another requestAnimationFrame of latency.
    sync();
    liquid.refreshLayout?.({bounds});
  }) : null;
  // Only known core surfaces; SlotOutlet itself uses display:contents.
  const rightHeaderSelector = '[data-rightbar-col] [data-sidebar-right-panel] [data-dockkit-strip]';
  const rightBodySelector = '[data-rightbar-col] [data-sidebar-right-panel] [data-dockkit-host="dock"] > [data-dockkit-content] > div:has(>[data-dockkit-strip]) + div';
  const componentSelector = '[data-changed-files],[data-presented-file],[data-team-panel],[data-testid="todo-panel"],[data-menu-material]:has(>ul[aria-label="后台任务"]),[data-menu-material]:has(>ul[aria-label="Background jobs"])';
  const surfaceSelectors = [
    '[data-slot="conversation.header"] > header',
    '[data-slot="rightbar.session"] > *',
    rightHeaderSelector, rightBodySelector,
    '[data-rightbar-col] [data-sidebar-right-panel] [data-dockkit-host="dock"] > [data-dockkit-content]:not(:has(>div>[data-dockkit-strip]))',
    '[data-rightbar-col] [data-sidebar-right-panel] [data-dockkit-empty]',
    '[role="dialog"][data-shortcut-modal="settings"]'
  ];
  const excluded = '[data-plugin],[data-pet],[data-whale],[data-slot="sidebar"],[data-slot="shell.sidebar"],iframe,canvas,video';
  const windowSelector = '[data-menu-material],[role="dialog"],[role="alertdialog"],[role="tooltip"],[role="alert"][style*="--dsh-toast-hold"],[data-popover-content]';
  function chooseSurfaces() {
    const windows = [...document.querySelectorAll(windowSelector)];
    const nodes = [...windows,...document.querySelectorAll(surfaceSelectors.join(','))];
    // Keep the large conversation backdrop clear; glass belongs to its controls.
    const composerAnchors = document.querySelectorAll('[data-slot="conversation.input.attachments"]');
    for (const anchor of composerAnchors) if (anchor.parentElement) nodes.push(anchor.parentElement);
    if (!composerAnchors.length) for (const anchor of document.querySelectorAll('[data-slot="conversation.input.overlay"]')) if (anchor.parentElement) nodes.push(anchor.parentElement);
    const unique = [...new Set(nodes)];
    return unique.filter(el => el instanceof HTMLElement && !el.matches(excluded) && !el.matches(componentSelector) && !el.closest('[data-whale],[data-pet]') && el.getBoundingClientRect().width > 0 && (windows.includes(el) || getComputedStyle(el).visibility === 'visible') && !(el.matches('[data-sidebar-right-panel], [data-slot="rightbar.session"] > *') && unique.some(inner => inner !== el && el.contains(inner)))).filter((el,index) => windows.includes(el) || index < windows.length + 12);
  }
  let accentCSS = '';
  function applyTokens() {
    tokenDispose?.(); tokenDispose = null;
    const declarations = [];
    const luminance = hex => {
      const c = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
      return c[0]*.2126+c[1]*.7152+c[2]*.0722;
    };
    if (preferences.accent) {
      const hex = preferences.accent;
      declarations.push(`--dsw-alias-brand-primary:${hex}!important;--dsw-alias-state-business-primary:${hex}!important;--dsw-alias-label-on-brand:${luminance(hex)<.179?'#FFFFFF':'#111827'}!important`);
    }
    if (preferences.surfaceColor) {
      const hex = preferences.surfaceColor, dark = luminance(hex)<.179, lift = '#FFFFFF';
      const primary = dark ? '#FFFFFF' : '#000000';
      declarations.push(`--dsw-alias-bg-base:${hex}!important;--dsw-alias-bg-layer-1:color-mix(in srgb,${hex} 96%,${lift} 4%)!important;--dsw-alias-bg-layer-2:color-mix(in srgb,${hex} 92%,${lift} 8%)!important;--dsw-alias-bg-layer-3:color-mix(in srgb,${hex} 88%,${lift} 12%)!important;--dsw-menu-surface-fill:var(--dsw-alias-bg-layer-1)!important;--dsw-specific-menu:var(--dsw-alias-bg-layer-1)!important;--dsw-alias-settings-card-fill:var(--dsw-alias-bg-layer-2)!important;--dsw-alias-markdown-code-block:var(--dsw-alias-bg-layer-2)!important;--dsw-alias-label-primary:${primary}!important;--dsw-alias-label-secondary:color-mix(in srgb,${primary} 68%,${hex} 32%)!important`);
    }
    accentCSS = declarations.length ? `body{${declarations.join(';')}}` : '';
  }
  function sync() {
    if (disposed) return;
    const p = preferences, source = p.wallpaper === 'custom' ? customURL : builtins.find(x => x.id === p.wallpaper)?.src;
    if (source !== loadedSource) {
      loadedSource = source || ''; imageReady = false;
      if (source) image.src = source; else image.removeAttribute('src');
    }
    background.hidden = !source;
    image.style.objectPosition = `${p.wallX}% ${p.wallY}%`; image.style.transform = `scale(${p.wallScale / 100})`;
    image.style.opacity = String(p.wallOpacity);
    layoutWallpaper();
    if (!source) background.remove();
    background.style.background = 'var(--dsw-alias-bg-base,#f4f6f9)';
    const rightGlass = p.rightLinked ? p.glass : p.rightGlass, rightOpacity = rightScene().opacity, rightBlur = rightScene().blur;
    const glass = p.glass !== 'off' || rightGlass !== 'off', alpha = p.opacity, blur = p.conversationBlur;
    const materialBase = 'var(--dsw-alias-bg-base,#f4f6f9)';
    lastStyle = `${accentCSS}
@font-face{font-family:"SAO Local Rounded";src:local("方正兰亭圆_准"),local("方正兰亭圆_GBK_准"),local("FZLanTingYuan-M-GBK");font-display:swap;font-weight:400}
body{--sao-font:${JSON.stringify(p.fontFamily === '方正兰亭圆_准' ? 'SAO Local Rounded' : p.fontFamily)},"Microsoft YaHei",system-ui,sans-serif;--dsh-font-family-text:var(--sao-font)!important;--dsw-font-family:var(--sao-font)!important;font-family:var(--sao-font);font-weight:400;font-synthesis:none;--sao-accent:var(--dsw-alias-brand-primary);--dsw-specific-sidebar-fill:color-mix(in srgb,var(--dsw-alias-bg-base) 94%,var(--sao-accent) 6%)!important}
[data-sao-shell]{background:var(--dsw-specific-sidebar-fill)!important;--sao-shell-base:color-mix(in srgb,var(--dsw-alias-bg-base) 97%,var(--sao-accent) 3%)}
[data-sao-shell]::before,[data-sao-shell-sidebar],[data-sao-shell-sidebar] > *,[data-slot="statusbar"] > *,[data-slot="bottom"] > *,[data-shell-bottom]{background:var(--dsw-specific-sidebar-fill)!important}
[data-sao-shell-center]{background:var(--sao-shell-base)!important}
[data-sao-shell] :is(button,input,select,textarea){font-weight:400}
[data-sao-shell] :is(h1,h2,h3){font-weight:500}
${scopes.split(',').map(s => `${s.trim()} :is(button,input,select,textarea)`).join(',')}{font-family:var(--sao-font)}
${source ? `[data-sao-wall-frame]{isolation:isolate}[data-sao-wall-frame][data-sao-wall-positioned]{position:relative}[data-sao-wall-column]{background:transparent!important}[data-sao-wall-right] :is([data-sidebar-right-panel],[data-dockkit-host="dock"],[data-dockkit-content],[data-dockkit-column],[data-dockkit-empty]),[data-sao-wall-right] [data-dockkit-content] > div,[data-sao-wall-right] [data-slot="rightbar.session"] > *{background:transparent!important}[data-slot="main.conversation"] > [data-phase]{background:transparent!important}[data-slot="main.conversation"] [data-composer-seat]{background:transparent!important}` : '[data-slot="main.conversation"] > [data-phase]{background:var(--sao-shell-base)!important}'}
[data-sao-material]{isolation:isolate;corner-shape:round!important;--sao-material-base:color-mix(in srgb,${materialBase} 97%,var(--dsw-alias-brand-primary) 3%);--sao-surface-alpha:${Math.round(alpha*100)}%;--sao-surface-blur:${blur}px;--sao-surface-filter:${blur ? `blur(${blur}px) saturate(1.05)` : 'none'};border-color:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
[data-sao-zone="right"]{--sao-surface-alpha:${Math.round(rightOpacity*100)}%;--sao-surface-blur:0px;--sao-surface-filter:none}
[data-sao-zone="composer"]{--sao-surface-alpha:${Math.round(p.composerOpacity*100)}%}
[data-sao-zone="header"]{--sao-surface-alpha:${Math.round(p.headerOpacity*100)}%}
[data-sao-zone="header-right"]{--sao-surface-alpha:${Math.round((p.headerLinked?p.headerOpacity:p.rightHeaderOpacity)*100)}%;--sao-surface-blur:${rightBlur}px;--sao-surface-filter:${rightBlur ? `blur(${rightBlur}px) saturate(1.05)` : 'none'}}
[data-sao-zone="window"]{--sao-surface-alpha:${Math.round(p.windowOpacity*100)}%;--sao-surface-blur:0px;--sao-surface-filter:none;color:var(--dsw-alias-label-primary)!important}
body:has([data-menu-material][data-sao-material]) [data-menu-backing],
[data-menu-material][data-sao-material]>div[aria-hidden="true"]{background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;box-shadow:none!important}
[role="tooltip"]{--dsw-alias-tooltip-key-bg:transparent!important;--dsw-alias-tooltip-key-label:var(--dsw-alias-label-primary)!important}
[role="tooltip"] kbd,[role="tooltip"] kbd::before,[role="tooltip"] kbd::after{background:transparent!important;box-shadow:none!important;text-shadow:none!important;color:inherit!important}
[data-sao-component]{background:color-mix(in srgb,${materialBase} ${Math.round(p.componentOpacity*100)}%,transparent)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;--changes-fill:transparent!important;--deliverable-fill:transparent!important;--dsw-alias-bg-layer-2:transparent!important}
[data-team-panel][data-sao-component]{background:transparent!important;--dsw-specific-menu:color-mix(in srgb,${materialBase} ${Math.round(p.componentOpacity*100)}%,transparent)!important}
[data-team-panel][data-sao-component]::before{background:var(--dsw-specific-menu)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
[data-menu-material][data-sao-component]>div[aria-hidden="true"]{background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
[data-menu-material][data-sao-component] [data-terminal]{--dsw-alias-markdown-code-block:transparent!important;background:transparent!important}
[data-sao-material][data-sao-positioned]{position:relative}
[data-sao-surface="floating"]{border-radius:16px!important;box-shadow:0 10px 32px color-mix(in srgb,var(--dsw-alias-label-primary,#16212c) 8%,transparent)!important}
[data-sao-surface="joined"]{border:0!important;border-radius:0!important}
html[data-windows-titlebar] [data-sidebar-right-panel="fullscreen"] [data-dockkit-column="0"] > [data-sao-surface="joined"]{border-top-left-radius:var(--dsh-windows-content-radius,16px)!important}
[data-sao-material]::before{content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;corner-shape:inherit;z-index:-1;background:color-mix(in srgb,var(--sao-material-base,#f4f6f9) var(--sao-surface-alpha),transparent);backdrop-filter:var(--sao-surface-filter,none);-webkit-backdrop-filter:var(--sao-surface-filter,none);border:0;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-label-primary,#16212c) 9%,transparent)}
[data-sao-surface="joined"]::before{box-shadow:none}
[role="dialog"][data-shortcut-modal="settings"]{--dsw-alias-settings-card-fill:transparent;border-radius:28px!important;border-color:color-mix(in srgb,var(--dsw-alias-label-primary,#16212c) 9%,transparent)!important}
[role="dialog"][data-shortcut-modal="settings"] :is(button[aria-label="关闭"],button[aria-label="Close"]){border-radius:14px;background:color-mix(in srgb,var(--dsw-alias-label-primary,#16212c) 2%,transparent);color:var(--dsw-alias-label-primary);border-color:transparent}
[data-composer-card][data-sao-material] :is([data-input-scroll],[data-input-scroll] > div,[data-composer-input]){border-color:transparent!important;box-shadow:none!important}
[data-rightbar-col]:has([data-sao-material]) [data-sidebar-right-panel]{border-color:transparent!important;box-shadow:none!important;background:transparent!important}
[data-sao-material="liquid"]::before{background:color-mix(in srgb,var(--sao-material-base,#f4f6f9) var(--sao-surface-alpha),transparent)}
[data-sao-material]>[data-sao-liquid]{z-index:-1!important;border-radius:inherit;corner-shape:inherit;background:transparent;box-shadow:none;border:0}
/* Keep the readable base; the GPU canvas is a lightweight optical overlay. */
[data-sao-material="liquid"]:has(>[data-sao-liquid]:not([hidden]))::before{backdrop-filter:none;-webkit-backdrop-filter:none}
[data-sao-material="frosted"]{background:transparent!important}
[data-sao-material="liquid"]{background:transparent!important}
@media(prefers-reduced-motion:reduce){[data-sao-material]{transition:none}}
`;
    writeStyle();
    const isWindow = el => el.matches(windowSelector);
    const isHeader = el => el.matches('[data-slot="conversation.header"] > header');
    const isRightHeader = el => el.matches(rightHeaderSelector);
    const isComposer = el => el.matches('[data-composer-card]') || !!el.querySelector(':scope > [data-slot="conversation.input.attachments"],:scope > [data-slot="conversation.input.overlay"]');
    const isRight = el => !isWindow(el) && !!el.closest('[data-rightbar-col],[data-slot="rightbar"],[data-slot="rightbar.session"]');
    const surfaceMode = el => isRight(el) ? rightGlass : p.glass;
    const surfaces = glass ? chooseSurfaces().filter(el => surfaceMode(el) !== 'off' && (!isRight(el) || isRightHeader(el))) : [];
    // Include orphaned markers from earlier clients, not only nodes owned by this instance.
    for (const el of new Set([...touched,...document.querySelectorAll('[data-sao-material]')])) if (!surfaces.includes(el)) { for (const attr of materialAttributes) el.removeAttribute(attr); touched.delete(el); }
    for (const el of surfaces) {
      if (!el.hasAttribute('data-sao-material') && getComputedStyle(el).position === 'static') el.setAttribute('data-sao-positioned','');
      if (el.getAttribute('data-sao-material') !== surfaceMode(el)) el.setAttribute('data-sao-material', surfaceMode(el));
      const zone = isWindow(el) ? 'window' : isRightHeader(el) ? 'header-right' : isHeader(el) ? 'header' : isComposer(el) ? 'composer' : isRight(el) ? 'right' : 'conversation'; if (el.getAttribute('data-sao-zone') !== zone) el.setAttribute('data-sao-zone', zone);
      const type = (isHeader(el) || isRightHeader(el) || el.matches(rightBodySelector) || el.matches('[data-dockkit-content],[data-dockkit-empty],[data-sidebar-right-panel]')) ? 'joined' : 'floating'; if (el.getAttribute('data-sao-surface') !== type) el.setAttribute('data-sao-surface', type);
      touched.add(el);
    }
    const components = [...document.querySelectorAll(componentSelector)];
    for (const el of componentTouched) if (!components.includes(el)) { el.removeAttribute('data-sao-component'); componentTouched.delete(el); }
    for (const el of components) { if (!el.hasAttribute('data-sao-component')) el.setAttribute('data-sao-component',''); componentTouched.add(el); }
    const isConversationSurface = el => !isRight(el) && !isWindow(el);
    // Nonzero background blur uses the CSS backdrop path rather than a costly or mismatched GPU approximation.
    const liquidSurfaces = surfaces.filter(el => surfaceMode(el) === 'liquid' && !(isRight(el) ? rightBlur > 0 : p.conversationBlur > 0 && isConversationSurface(el)));
    const surfaceBackgrounds = new Map(liquidSurfaces.filter(el => isConversationSurface(el) || isRight(el) && rightBounds).map(el => [el,{opacity:isRight(el) ? rightOpacity : p.conversationOpacity,color:sceneColor(),bounds:isRight(el) ? rightBounds : conversationBounds}]));
    liquid.update({ enabled: liquidSurfaces.length > 0, surfaces: liquidSurfaces, surfaceOpacities: new Map(liquidSurfaces.map(el => [el, isWindow(el) ? p.windowOpacity : isRightHeader(el) ? (p.headerLinked?p.headerOpacity:p.rightHeaderOpacity) : isHeader(el) ? p.headerOpacity : isComposer(el) ? p.composerOpacity : isRight(el) ? rightOpacity : p.opacity])), surfaceBackgrounds, baseColor:baseColor(), image: imageReady ? image : null, position: { x: p.wallX, y: p.wallY, scale: p.wallScale }, bounds, wallOpacity: p.wallOpacity, opacity: p.opacity });
  }
  image.onload = () => { imageReady = true; schedule(); };
  image.onerror = () => { imageReady = false; notice = '壁纸载入失败，请重新选择或上传'; notify(); };
  function schedule() { if (!disposed && !document.hidden && !queued) queued = requestAnimationFrame(() => { queued = 0; sync(); }); }
  const structure = '[data-slot],[data-dockkit-content],[data-dockkit-empty],[data-dockkit-strip],[data-sidebar-right-panel],[data-sao-material],' + windowSelector + ',' + componentSelector;
  const observer = new MutationObserver(records => {
    if (records.some(r => r.type === 'attributes' ? r.target.matches?.(windowSelector) && (!['style','class'].includes(r.attributeName) || !touched.has(r.target)) : r.type === 'childList' && [...r.addedNodes,...r.removedNodes].some(n => n.nodeType === 1 && !n.matches?.('[data-sao-liquid],[data-sao-wallpaper]') && (n.matches?.(structure) || n.firstElementChild && n.querySelector?.(structure))))) schedule();
  });
  observer.observe(document.body, {childList:true,subtree:true,attributes:true,attributeFilter:['hidden','open','data-state','role','style','class']});
  const onStorage = event => { if (event.key === KEY) { try { preferences = normalize(JSON.parse(event.newValue || '{}')); applyTokens(); sync(); notify(); } catch {} } };
  window.addEventListener('storage', onStorage);
  const onVisibility = () => { if (document.hidden) { cancelAnimationFrame(queued); queued = 0; } else schedule(); };
  document.addEventListener('visibilitychange', onVisibility);
  function readThemePreference() { const value = ctx.theme.getTheme?.()?.preference; return ['system','light','dark'].includes(value) ? value : preferences.theme; }
  preferences.theme = readThemePreference();
  ctx.on('theme/change', () => { preferences.theme = readThemePreference(); schedule(); notify(); });
  let themeTransition = null, themeAnimation = null, themeTransitionStyle = null;
  async function changeTheme(mode, origin) {
    if (!['system','light','dark'].includes(mode) || disposed) return;
    const change = () => { ctx.theme.setTheme(mode); preferences.theme = readThemePreference(); persist(); sync(); };
    if (mode === readThemePreference()) return;
    themeTransition?.skipTransition?.(); themeAnimation?.cancel();
    if (!document.startViewTransition || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) { change(); return; }
    const r = (origin?.closest?.('.sao-choice') || origin)?.getBoundingClientRect?.();
    const x = r ? r.left + r.width/2 : innerWidth/2, y = r ? r.top + r.height/2 : innerHeight/2;
    const radius = Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
    const rule = document.createElement('style');
    rule.textContent = '::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}::view-transition-old(root){z-index:1}::view-transition-new(root){z-index:2}[data-sao-switching] *,[data-sao-switching] *::before,[data-sao-switching] *::after{transition:none!important}';
    document.documentElement.setAttribute('data-sao-switching','');
    document.head.append(rule); themeTransitionStyle = rule;
    let changed = false, updateError = null;
    const update = () => { if (!changed && !disposed) { changed = true; try { change(); } catch (error) { updateError = error; throw error; } } };
    let transition;
    const cancelTransition = () => { themeAnimation?.cancel(); transition?.skipTransition?.(); };
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => { if (reducedMotion.matches) cancelTransition(); };
    const onVisibility = () => { if (document.hidden) cancelTransition(); };
    window.addEventListener('resize', cancelTransition); document.addEventListener('visibilitychange', onVisibility); reducedMotion.addEventListener?.('change', onMotion);
    try {
      try { transition = document.startViewTransition(update); } catch (error) { if (updateError) throw updateError; update(); return; }
      themeTransition = transition;
      // Both native lifecycle promises reject when the update callback fails or is skipped.
      // The ready branch below still forwards the service error to the settings control.
      transition.updateCallbackDone?.catch(() => {}); transition.finished?.catch(() => {});
      try { await transition.ready; } catch { if (updateError) throw updateError; update(); return; }
      if (disposed) { transition.skipTransition(); return; }
      themeAnimation = document.documentElement.animate({clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${radius}px at ${x}px ${y}px)`]}, {duration:440,easing:'cubic-bezier(.2,.75,.25,1)',fill:'both',pseudoElement:'::view-transition-new(root)'});
      try { await themeAnimation.finished; } catch { /* Cancellation completes the new palette immediately. */ }
    } finally {
      transition?.skipTransition?.(); rule.remove(); window.removeEventListener('resize',cancelTransition); document.removeEventListener('visibilitychange',onVisibility); reducedMotion.removeEventListener?.('change',onMotion);
      if (themeTransitionStyle === rule) { document.documentElement.removeAttribute('data-sao-switching'); themeTransition = null; themeAnimation = null; themeTransitionStyle = null; }
    }
  }
  function dbRequest(mode, task) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('dsh-sao-wallpapers-v4', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('images');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('images', mode), req = task(tx.objectStore('images'));
        let value; req.onsuccess = () => { value = req.result; }; tx.oncomplete = () => { db.close(); resolve(value); };
        tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || Error('图片存储不可用')); };
      };
    });
  }
  async function loadCustom() {
    const current = uploadRevision;
    try {
      const value = await dbRequest('readonly', s => s.get('custom'));
      if (disposed || current !== uploadRevision || !value?.blob) return;
      if (customURL) URL.revokeObjectURL(customURL);
      customURL = URL.createObjectURL(value.blob); customName = value.name || '我的壁纸'; sync(); notify();
    } catch (error) { if (preferences.wallpaper === 'custom') storageNotice(error); }
  }
  const api = {
    get: () => ({ ...preferences }), status: () => notice,
    get animationPreviews() { return animationPreviews; },
    get wallpapers() { return [...builtins, ...(customURL ? [{id:'custom',name:customName,src:customURL}] : [])]; },
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
    set(patch) {
      if (disposed) return;
      const next = { ...preferences, ...patch };
      if (patch.headerLinked === false && preferences.headerLinked) next.rightHeaderOpacity = preferences.headerOpacity;
      if (patch.rightLinked === false && preferences.rightLinked) {
        next.rightGlass = preferences.glass; next.rightOpacity = preferences.conversationOpacity; next.rightBlur = preferences.conversationBlur;
        next.rightLiquidOpacity = preferences.liquidOpacity; next.rightFrostOpacity = preferences.frostOpacity;
      }
      if (patch.glass && patch.glass !== preferences.glass && !Object.hasOwn(patch, 'opacity')) next.opacity = patch.glass === 'frosted' ? preferences.frostOpacity : preferences.liquidOpacity;
      if (Object.hasOwn(patch, 'opacity')) { if (next.glass === 'frosted') next.frostOpacity = patch.opacity; else next.liquidOpacity = patch.opacity; }
      const normalized = normalize(next);
      if (Object.keys(defaults).every(key => Object.is(preferences[key], normalized[key]))) return;
      preferences = normalized; revision++; if (Object.hasOwn(patch,'accent') || Object.hasOwn(patch,'surfaceColor')) applyTokens(); persist(); schedule();
      if (patch.startup === false) window[Symbol.for('dsh.sao.startup.v3')]?.stop?.();
    },
    resetSetting(key, origin) {
      if (!Object.hasOwn(defaults, key) || disposed) return;
      if (key === 'theme') return changeTheme(defaults.theme, origin);
      if (key === 'opacity') return api.set({opacity: preferences.glass === 'frosted' ? defaults.frostOpacity : defaults.liquidOpacity});
      if (key === 'rightOpacity') return api.set({rightOpacity: defaults.rightOpacity});
      return api.set({[key]: defaults[key]});
    },
    setTheme: changeTheme,
    async localFonts() {
      if (typeof window.queryLocalFonts !== 'function') throw Error('当前环境不支持枚举本地字体，可直接输入已安装字体名称');
      const fonts = await window.queryLocalFonts();
      return [...new Set(fonts.map(font => font.family).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'zh-CN'));
    },
    preview() { window[Symbol.for('dsh.sao.replay.v4')]?.(preferences); },
    async upload(file) {
      if (disposed) return;
      if (!file || !['image/jpeg','image/png','image/webp','image/avif','image/gif'].includes(file.type)) throw Error('请选择 JPG、PNG、WebP、AVIF 或 GIF 图片');
      if (file.size > 25*1024*1024) throw Error('图片最大 25 MB');
      const checkURL = URL.createObjectURL(file), candidate = new Image();
      try { candidate.src = checkURL; await candidate.decode(); if (candidate.naturalWidth * candidate.naturalHeight > 40000000) throw Error('图片分辨率请控制在 4000 万像素以内'); } finally { URL.revokeObjectURL(checkURL); }
      const current = ++uploadRevision;
      await dbRequest('readwrite', s => s.put({blob:file,name:file.name},'custom'));
      if (disposed || current !== uploadRevision) return;
      if (customURL) URL.revokeObjectURL(customURL); customURL = URL.createObjectURL(file); customName = file.name;
      api.set({wallpaper:'custom',wallX:50,wallY:50,wallScale:100});
    },
    async removeUpload() { ++uploadRevision; await dbRequest('readwrite', s => s.delete('custom')); if (customURL) URL.revokeObjectURL(customURL); customURL = null; customName = ''; if (preferences.wallpaper === 'custom') api.set({wallpaper:'none'}); else { sync(); notify(); } },
    async reset() { await changeTheme(defaults.theme); preferences = { ...defaults, theme: readThemePreference() }; applyTokens(); persist(); sync(); }
  };
  function Settings() {
    const ref = React.useRef(null);
    React.useEffect(() => { const cleanup = mountSAOSettings(ref.current, api); panelDisposers.add(cleanup); return () => { panelDisposers.delete(cleanup); cleanup(); }; }, []);
    return React.createElement('div', {ref});
  }
  const controller = { dispose };
  window[instanceKey] = controller;
  ctx.effect(() => dispose, 'dsh-SAO appearance');
  ctx.slots.inject('settings.section', () => ctx.slots.register({name:'settings.section',id:'dsh-sao',order:35,label:()=> 'dsh-SAO'}, Settings));
  applyTokens(); sync(); loadCustom();
  function dispose() {
    if (disposed) return; disposed = true; uploadRevision++;
    cancelAnimationFrame(queued); observer.disconnect(); resizeObserver?.disconnect(); window.removeEventListener('storage',onStorage); document.removeEventListener('visibilitychange',onVisibility);
    themeTransition?.skipTransition?.(); themeAnimation?.cancel(); themeTransitionStyle?.remove();
    frameHost?.removeAttribute('data-sao-wall-frame'); frameHost?.removeAttribute('data-sao-wall-positioned');
    for (const el of layoutTouched) { el.removeAttribute('data-sao-wall-column'); el.removeAttribute('data-sao-wall-right'); } layoutTouched.clear();
    for (const el of shellTouched) for (const attr of ['data-sao-shell','data-sao-shell-center','data-sao-shell-sidebar']) el.removeAttribute(attr); shellTouched.clear();
    for (const el of componentTouched) el.removeAttribute('data-sao-component'); componentTouched.clear();
    tokenDispose?.(); liquid.dispose(); style.remove(); background.remove(); image.onload = image.onerror = null;
    if (customURL) URL.revokeObjectURL(customURL); for (const cleanup of panelDisposers) cleanup(); panelDisposers.clear(); subscribers.clear();
    for (const el of touched) { el.removeAttribute('data-sao-material'); el.removeAttribute('data-sao-positioned'); el.removeAttribute('data-sao-surface'); el.removeAttribute('data-sao-zone'); } touched.clear();
    window[Symbol.for('dsh.sao.startup.v3')]?.stop?.();
    if (window[instanceKey] === controller) delete window[instanceKey];
  }
  return api;
}
