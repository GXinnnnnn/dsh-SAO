/* Appearance-only controller. Native DSH settings slot, global accent and disposable shell material.
 * No layout slots, positioning changes to third-party plugins, or blanket div rules.
 */
function applySAOAppearance(ctx, React, builtins) {
  const instanceKey = Symbol.for('dsh.sao.appearance.v4');
  window[instanceKey]?.dispose?.();
  // Retire DOM left by versions that did not expose a disposable controller.
  for (const el of document.querySelectorAll('style[data-sao-appearance],style[data-sao-palette],[data-sao-wallpaper],[data-sao-liquid]')) el.remove();
  const materialAttributes = ['data-sao-material','data-sao-positioned','data-sao-surface','data-sao-zone','data-sao-core-surface','data-sao-backdrop'];
  for (const el of document.querySelectorAll('[data-sao-context]')) el.removeAttribute('data-sao-context');
  for (const el of document.querySelectorAll('[data-sao-component]')) el.removeAttribute('data-sao-component');
  for (const el of document.querySelectorAll('[data-sao-material],[data-sao-core-surface]')) for (const attr of materialAttributes) el.removeAttribute(attr);
  const KEY = 'dsh-sao.preferences.v4';
  const defaults = { featureMode: 'all', videoQuality: 'balanced', startup: true, voice: 'kirito', sound: true, volume: .65, accent: '#8CC8F4', surfaceColor: null, glass: 'liquid', opacity: .80, liquidOpacity: .80, frostOpacity: .50, rightLinked: true, rightGlass: 'liquid', rightOpacity: .70, rightBlur: 0, rightSceneProfiles: {}, contextGlass: 'follow', contextOpacity: .80, contextBlur: 0, contextSceneProfiles: {}, rightLiquidOpacity: .40, rightFrostOpacity: .50, windowOpacity: 1, composerOpacity: .90, componentOpacity: .90, headerOpacity: .80, headerSceneProfiles: {}, rightHeaderOpacity: .80, headerLinked: true, wallpaper: 'builtin-3', wallpaperScope: 'full', wallX: 50, wallY: 50, wallScale: 100, wallOpacity: 1, conversationOpacity: .50, conversationBlur: 0, fontFamily: '方正兰亭圆_准', theme: 'system' };
  const accentDefaults = {light: defaults.accent, dark: defaults.accent};
  defaults.accentProfiles = {...accentDefaults};
  const themeMedia = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const validAccent = value => value === null || typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  const cleanAccent = value => value === null ? null : value.toUpperCase();
  function themeSnapshot() { return ctx.theme.getTheme?.() || {}; }
  function effectiveTheme(preference) {
    const snapshot = themeSnapshot();
    // Native effective state wins in system mode (and during host theme events).
    for (const key of ['effective', 'resolved', 'mode', 'theme', 'colorScheme']) if (['light','dark'].includes(snapshot[key])) return snapshot[key];
    if (typeof snapshot.dark === 'boolean') return snapshot.dark ? 'dark' : 'light';
    const mode = snapshot.preference || preference;
    if (mode === 'light' || mode === 'dark') return mode;
    // This native marker is available on installed DSH versions whose service
    // exposes only the preference. Attribute reads do not force layout.
    if (document.body?.hasAttribute('data-ds-dark-theme')) return ['false','light'].includes(document.body.getAttribute('data-ds-dark-theme')) ? 'light' : 'dark';
    return themeMedia?.matches ? 'dark' : 'light';
  }
  function normalizeAccents(value, legacy) {
    const profiles = {...accentDefaults};
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const name of ['light','dark']) if (Object.hasOwn(value, name) && validAccent(value[name])) profiles[name] = cleanAccent(value[name]);
    } else if (validAccent(legacy)) {
      // Before profiles existed accent applied globally, including explicit null.
      // Seed both modes so upgrading preserves the user's existing appearance.
      profiles.light = profiles.dark = cleanAccent(legacy);
    }
    return profiles;
  }
  const bounded = (v, fallback, min, max) => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
  const rightSceneModes = ['off','frosted','liquid'];
  const rightSceneDefaults = mode => ({opacity: mode === 'liquid' ? .70 : .50, blur: 0});
  const contextMode = p => p.contextGlass === 'follow' ? (p.rightLinked ? p.glass : p.rightGlass) : p.contextGlass;
  const contextSceneDefaults = mode => ({opacity: mode === 'frosted' ? .65 : .80, blur: 0});
  const headerSceneDefaults = mode => ({opacity: mode === 'liquid' ? .80 : .40, blur: 0});
  const windowSurfaceOpacity = p => p.windowOpacity * p.opacity;
  // Requested alpha is absolute against wallpaper. A translucent foreground
  // cannot subtract an opaque underlay: cut only its rounded footprint when
  // necessary. Otherwise retain the continuous scene and compensate one fill.
  function sceneSurfaceLayers(opacity, underlayAlpha, preferContinuous = true) {
    const continuous = preferContinuous && opacity >= underlayAlpha;
    const cardOpacity = continuous ? (underlayAlpha < 1 ? (opacity - underlayAlpha) / (1 - underlayAlpha) : 0) : opacity;
    return {continuous, cardOpacity};
  }
  function contextSceneLayers(p, underlayAlpha) {
    return sceneSurfaceLayers(p.contextOpacity, underlayAlpha, contextMode(p) !== 'off');
  }
  const ownFinite = (value, key) => Object.hasOwn(value, key) && typeof value[key] === 'number' && Number.isFinite(value[key]);
  function rememberRightScene(profiles, mode, opacity, blur, initialFor = rightSceneDefaults) {
    const initial = initialFor(mode);
    // Keep only user overrides so future initial-value corrections still apply.
    if (opacity === initial.opacity && blur === initial.blur) delete profiles[mode];
    else profiles[mode] = {opacity, blur};
  }
  function normalizeRightScenes(value, initialFor = rightSceneDefaults) {
    const profiles = {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return profiles;
    for (const mode of rightSceneModes) {
      if (!Object.hasOwn(value, mode)) continue;
      const scene = value[mode], initial = initialFor(mode);
      if (!scene || typeof scene !== 'object' || Array.isArray(scene) || !ownFinite(scene, 'opacity') && !ownFinite(scene, 'blur')) continue;
      rememberRightScene(profiles, mode, bounded(ownFinite(scene, 'opacity') ? scene.opacity : undefined, initial.opacity, 0, 1), bounded(ownFinite(scene, 'blur') ? scene.blur : undefined, initial.blur, 0, 24), initialFor);
    }
    return profiles;
  }
  function settingDefault(key, current) {
    if (key === 'accent') return accentDefaults[effectiveTheme(current.theme)];
    if (key === 'accentProfiles') return {...accentDefaults};
    if (key === 'opacity') return current.glass === 'frosted' ? defaults.frostOpacity : defaults.liquidOpacity;
    if (key === 'headerOpacity') return headerSceneDefaults(current.glass).opacity;
    if (key === 'rightOpacity') return rightSceneDefaults(current.rightGlass).opacity;
    if (key === 'rightBlur') return rightSceneDefaults(current.rightGlass).blur;
    if (key === 'contextOpacity') return contextSceneDefaults(contextMode(current)).opacity;
    if (key === 'contextBlur') return contextSceneDefaults(contextMode(current)).blur;
    return key.endsWith('SceneProfiles') ? {} : defaults[key];
  }
  function normalize(value) {
    const p = value && typeof value === 'object' ? value : {}, n = { ...defaults };
    if (p.featureMode === 'startup-only') n.featureMode = 'startup-only';
    if (p.videoQuality === 'still') n.videoQuality = 'still';
    for (const k of ['startup','sound','rightLinked','headerLinked']) if (typeof p[k] === 'boolean') n[k] = p[k];
    if (p.voice === 'asuna') n.voice = 'asuna';
    for (const key of ['accent','surfaceColor']) { if (p[key] === null) n[key] = null; else if (typeof p[key] === 'string' && /^#[0-9a-f]{6}$/i.test(p[key])) n[key] = p[key].toUpperCase(); }
    if (['off','frosted','liquid'].includes(p.glass)) n.glass = p.glass;
    if (['off','frosted','liquid'].includes(p.rightGlass)) n.rightGlass = p.rightGlass;
    if (['follow',...rightSceneModes].includes(p.contextGlass)) n.contextGlass = p.contextGlass;
    n.contextSceneProfiles = normalizeRightScenes(p.contextSceneProfiles, contextSceneDefaults);
    const contextScene = n.contextSceneProfiles[contextMode(n)] || contextSceneDefaults(contextMode(n));
    n.contextOpacity = contextScene.opacity; n.contextBlur = contextScene.blur;
    n.rightLiquidOpacity = bounded(p.rightLiquidOpacity, defaults.rightLiquidOpacity, 0, 1); n.rightFrostOpacity = bounded(p.rightFrostOpacity, defaults.rightFrostOpacity, 0, 1);
    n.rightSceneProfiles = normalizeRightScenes(Object.hasOwn(p, 'rightSceneProfiles') ? p.rightSceneProfiles : undefined);
    // Legacy scene values are meaningful only when the right column was independent.
    // The old rightLiquidOpacity/rightFrostOpacity fields describe local surfaces.
    if (!Object.hasOwn(p, 'rightSceneProfiles') && p.rightLinked === false && (ownFinite(p, 'rightOpacity') || ownFinite(p, 'rightBlur'))) {
      const initial = rightSceneDefaults(n.rightGlass);
      rememberRightScene(n.rightSceneProfiles, n.rightGlass, bounded(ownFinite(p, 'rightOpacity') ? p.rightOpacity : undefined, initial.opacity, 0, 1), bounded(ownFinite(p, 'rightBlur') ? p.rightBlur : undefined, initial.blur, 0, 24));
    }
    const rightScene = n.rightSceneProfiles[n.rightGlass] || rightSceneDefaults(n.rightGlass);
    n.rightOpacity = rightScene.opacity; n.rightBlur = rightScene.blur;
    if (['none','custom',...builtins.map(x => x.id)].includes(p.wallpaper)) n.wallpaper = p.wallpaper;
    if (['full','conversation'].includes(p.wallpaperScope)) n.wallpaperScope = p.wallpaperScope;
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
    n.accentProfiles = normalizeAccents(p.accentProfiles, p.accent);
    n.accent = n.accentProfiles[effectiveTheme(n.theme)];
    n.opacity = bounded(p.opacity, n.glass === 'frosted' ? n.frostOpacity : n.liquidOpacity, 0, 1);
    n.headerSceneProfiles = normalizeRightScenes(p.headerSceneProfiles, headerSceneDefaults);
    // Migrate the former .40 initial value; preserve other explicit legacy choices.
    if (!Object.hasOwn(p, 'headerSceneProfiles') && ownFinite(p, 'headerOpacity') && p.headerOpacity !== .40) rememberRightScene(n.headerSceneProfiles, n.glass, bounded(p.headerOpacity, headerSceneDefaults(n.glass).opacity, 0, 1), 0, headerSceneDefaults);
    n.headerOpacity = (n.headerSceneProfiles[n.glass] || headerSceneDefaults(n.glass)).opacity;
    n.rightHeaderOpacity = bounded(p.rightHeaderOpacity, n.headerOpacity, 0, 1);
    n.wallX = bounded(p.wallX, 50, 0, 100); n.wallY = bounded(p.wallY, 50, 0, 100); n.wallScale = bounded(p.wallScale, 100, 100, 250);
    return n;
  }
  function patchPreferences(current, patch) {
    const next = { ...current, ...patch };
    next.accentProfiles = normalizeAccents(next.accentProfiles, current.accent);
    if (Object.hasOwn(patch, 'accent') && validAccent(patch.accent)) next.accentProfiles[effectiveTheme(current.theme)] = cleanAccent(patch.accent);
    const profiles = normalizeRightScenes(next.rightSceneProfiles);
    if (!current.rightLinked && (next.rightLinked !== false || next.rightGlass !== current.rightGlass)) rememberRightScene(profiles, current.rightGlass, current.rightOpacity, current.rightBlur);
    const mode = rightSceneModes.includes(next.rightGlass) ? next.rightGlass : defaults.rightGlass;
    const scene = profiles[mode] || rightSceneDefaults(mode);
    if (ownFinite(patch, 'rightOpacity') || ownFinite(patch, 'rightBlur')) rememberRightScene(profiles, mode, bounded(ownFinite(patch, 'rightOpacity') ? patch.rightOpacity : undefined, scene.opacity, 0, 1), bounded(ownFinite(patch, 'rightBlur') ? patch.rightBlur : undefined, scene.blur, 0, 24));
    next.rightSceneProfiles = profiles;
    const contextProfiles = normalizeRightScenes(next.contextSceneProfiles, contextSceneDefaults);
    const activeContextMode = contextMode(next), contextScene = contextProfiles[activeContextMode] || contextSceneDefaults(activeContextMode);
    if (ownFinite(patch, 'contextOpacity') || ownFinite(patch, 'contextBlur')) rememberRightScene(contextProfiles, activeContextMode, bounded(ownFinite(patch, 'contextOpacity') ? patch.contextOpacity : undefined, contextScene.opacity, 0, 1), bounded(ownFinite(patch, 'contextBlur') ? patch.contextBlur : undefined, contextScene.blur, 0, 24), contextSceneDefaults);
    next.contextSceneProfiles = contextProfiles;
    const headerProfiles = normalizeRightScenes(next.headerSceneProfiles, headerSceneDefaults);
    if (ownFinite(patch, 'headerOpacity')) rememberRightScene(headerProfiles, next.glass, bounded(patch.headerOpacity, headerSceneDefaults(next.glass).opacity, 0, 1), 0, headerSceneDefaults);
    next.headerSceneProfiles = headerProfiles;
    if (patch.headerLinked === false && current.headerLinked && !ownFinite(patch, 'rightHeaderOpacity')) next.rightHeaderOpacity = (headerProfiles[next.glass] || headerSceneDefaults(next.glass)).opacity;
    if (patch.glass && patch.glass !== current.glass && !Object.hasOwn(patch, 'opacity')) next.opacity = patch.glass === 'frosted' ? current.frostOpacity : current.liquidOpacity;
    if (Object.hasOwn(patch, 'opacity')) { if (next.glass === 'frosted') next.frostOpacity = patch.opacity; else next.liquidOpacity = patch.opacity; }
    return normalize(next);
  }
  let preferences; try { preferences = normalize(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { preferences = normalize({}); }
  let disposed = false, notice = '', customURL = null, customPosterURL = null, customKind = 'image', customMeta = null, customName = '', queued = 0, revision = 0, uploadRevision = 0;
  const subscribers = new Set(), panelDisposers = new Set(), touched = new Set(), componentTouched = new Set(), adaptiveObserved = new Set();
  const style = document.createElement('style'); style.dataset.saoAppearance = '4'; document.head.append(style);
  const paletteStyle = document.createElement('style'); paletteStyle.dataset.saoPalette = '';
  const background = document.createElement('div'); background.dataset.saoWallpaper = ''; background.setAttribute('aria-hidden','true');
  background.style.cssText = 'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:-1';
  const wallpaperClip = document.createElement('div'); wallpaperClip.dataset.saoWallpaperClip = ''; background.append(wallpaperClip);
  const image = document.createElement('img'); image.alt = ''; image.draggable = false; image.style.cssText = 'width:100%;height:100%;object-fit:cover;pointer-events:none;display:block'; wallpaperClip.append(image);
  const videoWallpaper = SAOVideoWallpaper.create(image, () => notify());
  const conversationBackdrop = document.createElement('div'); conversationBackdrop.dataset.saoConversationBackdrop = ''; conversationBackdrop.hidden = true; background.append(conversationBackdrop);
  const rightBase = document.createElement('div'); rightBase.dataset.saoWallpaperRightBase = ''; rightBase.hidden = true; background.append(rightBase);
  const rightBackdrop = document.createElement('div'); rightBackdrop.dataset.saoRightBackdrop = ''; rightBackdrop.hidden = true; background.append(rightBackdrop);
  let loadedSource = '', imageReady = false;
  const liquid = createSAOLiquidGlass();
  const baseColor = () => preferences.surfaceColor ? [1,3,5].map(i => parseInt(preferences.surfaceColor.slice(i,i+2),16)/255) : null;
  const sceneColor = () => liquid.sceneColor?.(baseColor()) || [0.906,0.937,0.969];
  // Resolve only our theme base, never page content or wallpaper pixels.
  let themeColorContext;
  function wallpaperBaseColor() {
    themeColorContext ??= document.createElement('canvas').getContext('2d', {willReadFrequently:true});
    if (!themeColorContext) return sceneColor();
    themeColorContext.clearRect(0,0,1,1);
    themeColorContext.fillStyle = getComputedStyle(background).backgroundColor;
    themeColorContext.fillRect(0,0,1,1);
    return [...themeColorContext.getImageData(0,0,1,1).data].slice(0,3).map(v=>v/255);
  }
  const notify = () => { for (const fn of subscribers) fn(); };
  const storageNotice = error => { notice = error ? '无法保存到本机：' + (error.message || String(error)) : '已保存到本机'; notify(); };
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(preferences)); storageNotice(); } catch (error) { storageNotice(error); } }
  const scopes = '[data-slot="main.conversation"], [data-slot="rightbar"], [role="dialog"][data-shortcut-modal="settings"]';
  const layoutTouched = new Set(), shellTouched = new Set();
  let lastStyle = '', lastWallpaperCSS = '';
  const backdropStyles = new WeakMap(), contextTouched = new Set();
  const rightPaneSelector = '[data-sidebar-right-session] div[data-sidebar-right-tab]';
  // Verified core 0.2.1-rc.5 and Desktop 0.2.2-rc.1 have no idle browser-root data attribute.
  // Its source-proven root class covers that state; the public carrier
  // attribute also recognizes iframe/webview states without reading URLs.
  const browserRootSelector = '.bZwPEG_root,[data-sidebar-browser-frame]';
  const rightPanesTouched = new Set(), rightRootsTouched = new Set(), browserPanesTouched = new Set(), rightPanesObserved = new Set();
  let browserCardPaths = [], onlyBrowserRight = false;
  const contextRootSelector = '[data-sidebar-right-session] div[data-sidebar-right-tab] .lc-root';
  // Browser holes are axis-aligned section rectangles. Suppress the entire
  // scene only when their union covers it, not when an empty split has no tab.
  function rightBrowserCoversBounds(box, polygons) {
    if (!box || !(box.width>0 && box.height>0) || !polygons.length) return false;
    const left=box.x, right=box.x+box.width, top=box.y, bottom=box.y+box.height, epsilon=0.5;
    const rects=polygons.filter(points=>points.length>=3 && points.every(point=>point.length===2 && point.every(Number.isFinite))).map(points=>({left:Math.max(left,Math.min(...points.map(p=>p[0]))),right:Math.min(right,Math.max(...points.map(p=>p[0]))),top:Math.max(top,Math.min(...points.map(p=>p[1]))),bottom:Math.min(bottom,Math.max(...points.map(p=>p[1])))})).filter(r=>r.right>r.left && r.bottom>r.top);
    const xs=[...new Set([left,right,...rects.flatMap(r=>[r.left,r.right])])].sort((a,b)=>a-b);
    for (let i=1;i<xs.length;i++) {
      if (xs[i]-xs[i-1]<=epsilon) continue;
      const x=(xs[i]+xs[i-1])/2, spans=rects.filter(r=>r.left<=x && r.right>=x).sort((a,b)=>a.top-b.top);
      let covered=top;
      for (const span of spans) { if (span.top>covered+epsilon) return false; covered=Math.max(covered,span.bottom); }
      if (covered<bottom-epsilon) return false;
    }
    return true;
  }
  function updateRightPanes() {
    const panes = [...document.querySelectorAll(rightPaneSelector)];
    const managed = new Set(), roots = new Set(), browsers = new Set(), observed = new Set();
    browserCardPaths = [];
    for (const pane of panes) {
      const section = pane.closest('[data-dockkit-content]');
      const browser = !!pane.querySelector(browserRootSelector);
      const rect = section?.getBoundingClientRect() || pane.getBoundingClientRect();
      const visible = rect.width>0 && rect.height>0 && !pane.closest('[hidden],[aria-hidden="true"]') && getComputedStyle(pane).visibility!=='hidden';
      observed.add(pane); if (section) observed.add(section);
      if (browser) {
        browsers.add(pane); if (section) browsers.add(section);
        if (visible && rightBounds) {
          const clip={left:rightBounds.x,top:rightBounds.y,right:rightBounds.x+rightBounds.width,bottom:rightBounds.y+rightBounds.height};
          const polygon=clippedCardPolygon({x:rect.x,y:rect.y,width:rect.width,height:rect.height},clip,[[0,0],[0,0],[0,0],[0,0]]);
          if (polygon.length>=3) { browserCardPaths.push(polygon); }
        }
        continue;
      }
      managed.add(pane);
      const pending=[...pane.children];
      while (pending.length) {
        const child=pending.shift();
        if (!(child instanceof HTMLElement) || child.matches('style,script,iframe,canvas,video')) continue;
        if (child.hasAttribute('data-slot') || child.hasAttribute('data-dsh-native-tab-host') || getComputedStyle(child).display==='contents') pending.push(...child.children);
        else roots.add(child);
      }
    }
    for (const [owned,next,attribute] of [[rightPanesTouched,managed,'data-sao-right-pane'],[rightRootsTouched,roots,'data-sao-right-root'],[browserPanesTouched,browsers,'data-sao-browser-pane']]) {
      for (const node of owned) if (!next.has(node)) { node.removeAttribute(attribute); owned.delete(node); }
      for (const node of next) { if (!node.hasAttribute(attribute)) node.setAttribute(attribute,''); owned.add(node); }
    }
    for (const node of rightPanesObserved) if (!observed.has(node)) { resizeObserver?.unobserve(node); rightPanesObserved.delete(node); }
    for (const node of observed) rightPanesObserved.add(node);
    onlyBrowserRight = rightBrowserCoversBounds(rightBounds,browserCardPaths);
  }
  const contextCardSelector = contextRootSelector + ' .lc-card';
  const isContextCard = el => el.matches(contextCardSelector) && !el.parentElement?.closest('.lc-card');
  const contextCardsObserved = new Set(), contextViewportsObserved = new Set();
  let contextCardPaths = [], conversationSurfacePaths = [], rightSurfacePaths = [];
  const materialBorders = css => [css.borderTopWidth,css.borderRightWidth,css.borderBottomWidth,css.borderLeftWidth].map(value => parseFloat(value));
  // Clip rounded card footprints to their visible scroll viewport. The mask
  // remains in the gutters, while each card still paints once over wallpaper.
  function clippedCardPolygon(rect, clip, corners) {
    const {x,y,width:w,height:h} = rect;
    if (!(w>0 && h>0 && clip.right>clip.left && clip.bottom>clip.top) || x+w<=clip.left || x>=clip.right || y+h<=clip.top || y>=clip.bottom) return [];
    const radii = corners.map(pair => pair.map(v => Math.max(0,Number.isFinite(v)?v:0)));
    const scale = Math.min(1,w/Math.max(1,radii[0][0]+radii[1][0]),w/Math.max(1,radii[3][0]+radii[2][0]),h/Math.max(1,radii[0][1]+radii[3][1]),h/Math.max(1,radii[1][1]+radii[2][1]));
    const points = [];
    for (let i=0;i<4;i++) {
      const [rx,ry]=radii[i].map(v=>v*scale), right=i===1||i===2, bottom=i>=2;
      const cx=right?x+w-rx:x+rx, cy=bottom?y+h-ry:y+ry;
      for (let step=0;step<=8;step++) {
        const angle=(180+i*90+step*90/8)*Math.PI/180;
        points.push([cx+rx*Math.cos(angle),cy+ry*Math.sin(angle)]);
      }
    }
    let polygon=points;
    for (const [axis,edge,greater] of [[0,clip.left,true],[0,clip.right,false],[1,clip.top,true],[1,clip.bottom,false]]) {
      const input=polygon; polygon=[];
      if (!input.length) break;
      let previous=input[input.length-1], wasInside=greater?previous[axis]>=edge:previous[axis]<=edge;
      for (const point of input) {
        const inside=greater?point[axis]>=edge:point[axis]<=edge;
        if (inside!==wasInside) {
          const t=(edge-previous[axis])/(point[axis]-previous[axis]);
          polygon.push([previous[0]+(point[0]-previous[0])*t,previous[1]+(point[1]-previous[1])*t]);
        }
        if (inside) polygon.push(point);
        previous=point; wasInside=inside;
      }
    }
    return polygon;
  }
  function updateContextRoots() {
    const active = contextMode(preferences) !== 'off' ? [...document.querySelectorAll(contextRootSelector)].filter(el => { const r=el.getBoundingClientRect(); return r.width>0 && r.height>0 && getComputedStyle(el).visibility!=='hidden'; }) : [];
    for (const el of contextTouched) if (!active.includes(el)) { el.removeAttribute('data-sao-context'); resizeObserver?.unobserve(el); contextTouched.delete(el); }
    const cards=[], viewports=new Set(); contextCardPaths=[];
    for (const root of active) {
      if (!root.hasAttribute('data-sao-context')) root.setAttribute('data-sao-context','');
      contextTouched.add(root);
      const viewport=root.getBoundingClientRect();
      for (const card of root.querySelectorAll('.lc-card')) {
        if (!isContextCard(card) || getComputedStyle(card).visibility!=='visible') continue;
        const r=card.getBoundingClientRect(); if (!(r.width>0 && r.height>0)) continue;
        cards.push(card);
        const clip={left:Math.max(viewport.left,rightBounds?.x??0),top:Math.max(viewport.top,rightBounds?.y??0),right:Math.min(viewport.right,rightBounds?rightBounds.x+rightBounds.width:innerWidth),bottom:Math.min(viewport.bottom,rightBounds?rightBounds.y+rightBounds.height:innerHeight)};
        for (let parent=card.parentElement;parent;parent=parent.parentElement) {
          const css=getComputedStyle(parent), box=parent.getBoundingClientRect();
          if ((/^(auto|scroll|hidden|clip)$/.test(css.overflowX) || /^(auto|scroll|hidden|clip)$/.test(css.overflowY)) && parent!==frameHost && parent!==wallHost && parent!==observedRight && !active.includes(parent)) viewports.add(parent);
          if (/^(auto|scroll|hidden|clip)$/.test(css.overflowX)) { clip.left=Math.max(clip.left,box.left+parent.clientLeft); clip.right=Math.min(clip.right,box.left+parent.clientLeft+parent.clientWidth); }
          if (/^(auto|scroll|hidden|clip)$/.test(css.overflowY)) { clip.top=Math.max(clip.top,box.top+parent.clientTop); clip.bottom=Math.min(clip.bottom,box.top+parent.clientTop+parent.clientHeight); }
          if (parent===frameHost) break;
        }
        const css=getComputedStyle(card), pair=value=>{ const values=value.trim().split(/\s+/); return [values[0],values[1]||values[0]].map((v,i)=>parseFloat(v)*(v.endsWith('%')?(i?r.height:r.width)/100:1)); };
        const polygon=clippedCardPolygon({x:r.x,y:r.y,width:r.width,height:r.height},clip,[css.borderTopLeftRadius,css.borderTopRightRadius,css.borderBottomRightRadius,css.borderBottomLeftRadius].map(pair));
        if (polygon.length>=3) contextCardPaths.push(polygon);
      }
    }
    for (const card of contextCardsObserved) if (!cards.includes(card)) { resizeObserver?.unobserve(card); contextCardsObserved.delete(card); }
    for (const card of cards) contextCardsObserved.add(card);
    for (const viewport of contextViewportsObserved) if (!viewports.has(viewport)) { resizeObserver?.unobserve(viewport); contextViewportsObserved.delete(viewport); }
    for (const viewport of viewports) contextViewportsObserved.add(viewport);
  }
  let conversationBounds = {x:0,y:0,width:innerWidth,height:innerHeight}, rightBounds = null, observedRight = null, rightJoined = false;
  function wallpaperArea(scope, scene, conversation) {
    return {...(scope === 'conversation' ? conversation : scene)};
  }
  let imageBounds = {...conversationBounds};
  // Only a docked, adjacent push column shares the conversation's outer frame.
  function joinedRightScene(main, right, mode) {
    return mode === 'push' && !!main && !!right && main.width>0 && main.height>0 && right.width>0 && right.height>0 && Math.abs(main.x+main.width-right.x)<=8 && Math.abs(main.y-right.y)<=1 && Math.abs(main.height-right.height)<=1;
  }
  const rightScene = () => ({opacity: preferences.rightLinked ? preferences.conversationOpacity : preferences.rightOpacity, blur: preferences.rightLinked ? preferences.conversationBlur : preferences.rightBlur});
  function sceneHoleMask(box, holes) {
    if (!holes.length) return 'none';
    const polygons = holes.map(points => `<polygon points="${points.map(([x,y])=>`${(x-box.x).toFixed(2)},${(y-box.y).toFixed(2)}`).join(' ')}"/>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box.width}" height="${box.height}" viewBox="0 0 ${box.width} ${box.height}"><rect width="100%" height="100%" fill="white"/><g fill="black">${polygons}</g></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }
  // Each column owns one scene mask; liquid context cards layer above it.
  function paintBackdrop(element, box, opacity, blur, radius = '0px', corner = 'round', material = 'off') {
    // A single fill owns the right scene. Frost adds diffusion; liquid adds an
    // edge-only optical canvas so an explicitly blurred center stays blurred.
    let diffusion = opacity === 0 ? 0 : material === 'frosted' ? Math.max(12, blur) : blur;
    element.hidden = !box || opacity === 0 && diffusion === 0 || element === rightBackdrop && onlyBrowserRight;
    if (element === rightBackdrop && element.getAttribute('data-sao-scene-material') !== material) element.setAttribute('data-sao-scene-material',material);
    if (!box) return;
    // Both materials retain the continuous scene when the target permits it.
    // Only clearer cards replace their actual fill footprint; Browser remains native.
    const holes = element === rightBackdrop ? [...browserCardPaths,...rightSurfacePaths,...(!contextSceneLayers(preferences, opacity).continuous ? contextCardPaths : [])] : conversationSurfacePaths;
    const mask = sceneHoleMask(box,holes);
    // The scoped right base is already uniform; blurring across its left edge
    // would sample the neighboring conversation wallpaper back into the pane.
    if (element === rightBackdrop && preferences.wallpaperScope === 'conversation') diffusion = 0;
    const css = `position:absolute;left:${box.x-bounds.x}px;top:${box.y-bounds.y}px;width:${box.width}px;height:${box.height}px;pointer-events:none;border-radius:${element === rightBackdrop ? (rightJoined ? '0 0 16px 0' : '16px 0 16px 16px') : radius + ' 0 0 0'};corner-shape:${corner};isolation:isolate;overflow:hidden;mask-image:${mask};mask-mode:luminance;mask-repeat:no-repeat;mask-size:100% 100%;--sao-edge-strength:${4*opacity*(1-opacity)};background:${element === rightBackdrop && preferences.wallpaperScope === 'conversation' ? `color-mix(in srgb,var(--dsw-alias-bg-base,#f4f6f9) ${opacity*100}%,transparent)` : `rgb(${sceneColor().map(v=>v*255).join(' ')} / ${opacity})`};backdrop-filter:${diffusion ? `blur(${diffusion}px)` : 'none'};-webkit-backdrop-filter:${diffusion ? `blur(${diffusion}px)` : 'none'}`;
    if (backdropStyles.get(element) !== css) { element.style.cssText = css; backdropStyles.set(element,css); }
  }
  const writeStyle = () => { if (style.textContent !== lastStyle) style.textContent = lastStyle; };
  let wallHost = null, frameHost = null, bounds = {x:0,y:0,width:innerWidth,height:innerHeight};
  function boxFor(outlet) {
    let el = outlet;
    while (el && getComputedStyle(el).display === 'contents') el = el.parentElement;
    return el;
  }
  // Resolve topology, not a fixed parent count: MainPanel may add real boxes
  // between the conversation outlet and the center/right shared AppFrame.
  function sceneLayoutRoots(mainChain, rightChain) {
    const index = mainChain.findIndex((node,i) => i>0 && rightChain.includes(node));
    return {frame:mainChain[index>0?index:1] || null,column:mainChain[index>0?index-1:0] || null};
  }
  const ancestors = node => { const chain=[]; for(;node;node=node.parentElement) chain.push(node); return chain; };
  function layoutWallpaper() {
    const outlet = document.querySelector('[data-slot="main.conversation"]');
    const mainBody = boxFor(outlet?.parentElement || outlet);
    const right = boxFor(document.querySelector('[data-slot="rightbar"]')?.parentElement);
    const {column,frame} = sceneLayoutRoots(ancestors(mainBody),ancestors(right));
    let visible = outlet && column && frame && !outlet.closest('[hidden],[aria-hidden="true"],[inert]') && column.getBoundingClientRect().width > 0 && column.getBoundingClientRect().height > 0 && getComputedStyle(column).visibility === 'visible' && getComputedStyle(outlet).visibility === 'visible';
    // display:contents is a valid outlet; a display:none wrapper is not. Its
    // fixed-size outer column can remain measurable while the scene is hidden.
    for (let node = outlet; visible && node && node !== column; node = node.parentElement) if (getComputedStyle(node).display === 'none') visible = false;
    if (!visible) {
      // Native pages can unmount (or retain a hidden) conversation. Forget its
      // geometry and ownership so a later portal cannot revive that old scene.
      background.remove();
      frameHost?.removeAttribute('data-sao-wall-frame'); frameHost?.removeAttribute('data-sao-wall-positioned');
      for (const el of layoutTouched) for (const attr of ['data-sao-wall-column','data-sao-wall-right','data-sao-browser-only','data-sao-main-joined','data-sao-right-joined']) el.removeAttribute(attr);
      for (const el of shellTouched) for (const attr of ['data-sao-shell','data-sao-shell-center','data-sao-shell-sidebar']) el.removeAttribute(attr);
      layoutTouched.clear(); shellTouched.clear();
      if (frameHost) resizeObserver?.disconnect();
      adaptiveObserved.clear(); contextCardsObserved.clear(); contextViewportsObserved.clear(); rightPanesObserved.clear();
      for (const node of contextTouched) node.removeAttribute('data-sao-context'); contextTouched.clear();
      for (const [nodes,attribute] of [[rightPanesTouched,'data-sao-right-pane'],[rightRootsTouched,'data-sao-right-root'],[browserPanesTouched,'data-sao-browser-pane']]) { for (const node of nodes) node.removeAttribute(attribute); nodes.clear(); }
      contextCardPaths = []; browserCardPaths = []; rightSurfacePaths = []; conversationSurfacePaths = []; onlyBrowserRight = false;
      frameHost = wallHost = observedRight = null; rightBounds = null; rightJoined = false;
      conversationBounds = bounds = imageBounds = {x:0,y:0,width:0,height:0};
      conversationBackdrop.hidden = rightBackdrop.hidden = rightBase.hidden = true;
      return;
    }
    const frameChanged = frame !== frameHost;
    if (frameChanged) {
      frameHost?.removeAttribute('data-sao-wall-frame');
      frameHost?.removeAttribute('data-sao-wall-positioned');
      frameHost = frame; frameHost.setAttribute('data-sao-wall-frame','');
      if (getComputedStyle(frameHost).position === 'static') frameHost.setAttribute('data-sao-wall-positioned','');
    }
    const shellMarks = [[frame,'data-sao-shell'],[column,'data-sao-shell-center'],[boxFor(document.querySelector('[data-slot="sidebar"]')?.parentElement),'data-sao-shell-sidebar']];
    for (const node of shellTouched) for (const attr of ['data-sao-shell','data-sao-shell-center','data-sao-shell-sidebar']) if (!shellMarks.some(([el,key])=>el===node&&key===attr)) node.removeAttribute(attr);
    shellTouched.clear();
    for (const [el,attr] of shellMarks) if (el) { if (!el.hasAttribute(attr)) el.setAttribute(attr,''); shellTouched.add(el); }
    const c = column.getBoundingClientRect(), f = frame.getBoundingClientRect();
    // A collapsed 56px tool rail does not crop the wallpaper's full-window cover.
    const x = c.left - f.left <= 64 ? f.left : c.left;
    bounds = {x,y:c.top,width:Math.max(1,f.right-x),height:Math.max(1,c.height)};
    const columnStyle = getComputedStyle(column), radius = columnStyle.borderTopLeftRadius;
    const corner = columnStyle.getPropertyValue('corner-shape') || 'round';
    conversationBounds = {x:c.left,y:c.top,width:c.width,height:c.height};
    const wallCSS = `position:absolute;left:${x-f.left}px;top:${c.top-f.top}px;width:${bounds.width}px;height:${bounds.height}px;overflow:hidden;pointer-events:none;z-index:-1;border-radius:${x === c.left ? radius : '0px'} 0 0 0;corner-shape:${corner}`;
    if (lastWallpaperCSS !== wallCSS) { background.style.cssText = wallCSS; lastWallpaperCSS = wallCSS; }
    imageBounds = wallpaperArea(preferences.wallpaperScope,bounds,conversationBounds);
    wallpaperClip.style.cssText = `position:absolute;left:${imageBounds.x-bounds.x}px;top:${imageBounds.y-bounds.y}px;width:${imageBounds.width}px;height:${imageBounds.height}px;overflow:hidden;pointer-events:none`;
    paintBackdrop(conversationBackdrop, conversationBounds, preferences.conversationOpacity, preferences.conversationBlur, radius, corner);
    if (background.parentElement !== frame) frame.prepend(background);
    if (!column.hasAttribute('data-sao-wall-column')) column.setAttribute('data-sao-wall-column',''); layoutTouched.add(column);
    const r = right?.getBoundingClientRect();
    rightBounds = r && r.width > 0 && r.height > 0 ? {x:r.left,y:r.top,width:r.width,height:r.height} : null;
    rightBase.hidden = preferences.wallpaperScope !== 'conversation' || !rightBounds;
    if (rightBounds) rightBase.style.cssText = `position:absolute;left:${rightBounds.x-bounds.x}px;top:${rightBounds.y-bounds.y}px;width:${rightBounds.width}px;height:${rightBounds.height}px;background:var(--dsw-alias-bg-base,#f4f6f9);pointer-events:none`;
    updateRightPanes();
    updateContextRoots();
    const visibleRightPanel = [...(right?.querySelectorAll('[data-sidebar-right-panel][data-sidebar-right-open]') || [])].find(panel => {
      if (panel.closest('[hidden],[aria-hidden="true"],[inert]') || getComputedStyle(panel).visibility !== 'visible') return false;
      const rect = panel.getBoundingClientRect(); return rect.width>0 && rect.height>0;
    });
    rightJoined = !onlyBrowserRight && joinedRightScene(conversationBounds,rightBounds,visibleRightPanel?.getAttribute('data-sidebar-right-panel'));
    rightBackdrop.toggleAttribute('data-sao-joined-left',rightJoined);
    column.toggleAttribute('data-sao-main-joined',rightJoined);
    right?.toggleAttribute('data-sao-right-joined',rightJoined);
    const scene = rightScene();
    paintBackdrop(rightBackdrop, rightBounds, scene.opacity, scene.blur, '16px', 'round', preferences.rightLinked ? preferences.glass : preferences.rightGlass);
    for (const el of layoutTouched) if (el !== column && el !== right) { el.removeAttribute('data-sao-wall-column'); el.removeAttribute('data-sao-wall-right'); el.removeAttribute('data-sao-main-joined'); el.removeAttribute('data-sao-right-joined'); layoutTouched.delete(el); }
    if (right) { if (onlyBrowserRight) right.setAttribute('data-sao-browser-only',''); else right.removeAttribute('data-sao-browser-only'); if (!right.hasAttribute('data-sao-wall-column')) right.setAttribute('data-sao-wall-column',''); if (!right.hasAttribute('data-sao-wall-right')) right.setAttribute('data-sao-wall-right',''); layoutTouched.add(right); }
    if (frameChanged || wallHost !== column || observedRight !== right) { resizeObserver?.disconnect(); resizeObserver?.observe(column); resizeObserver?.observe(frame); if (right) resizeObserver?.observe(right); wallHost = column; observedRight = right; }
    for (const node of rightPanesObserved) resizeObserver?.observe(node);
    for (const root of contextTouched) resizeObserver?.observe(root);
    for (const card of contextCardsObserved) resizeObserver?.observe(card);
    for (const viewport of contextViewportsObserved) resizeObserver?.observe(viewport);
    for (const host of adaptiveObserved) resizeObserver?.observe(host);
  }
  function sceneSurfacePolygon(el,box) {
    const r=el.getBoundingClientRect(), css=getComputedStyle(el);
    const clip={left:box.x,top:box.y,right:box.x+box.width,bottom:box.y+box.height};
    for(let parent=el.parentElement;parent&&parent!==frameHost;parent=parent.parentElement){
      const style=getComputedStyle(parent), rect=parent.getBoundingClientRect();
      if(/^(auto|scroll|hidden|clip)$/.test(style.overflowX)){clip.left=Math.max(clip.left,rect.left+parent.clientLeft);clip.right=Math.min(clip.right,rect.left+parent.clientLeft+parent.clientWidth);}
      if(/^(auto|scroll|hidden|clip)$/.test(style.overflowY)){clip.top=Math.max(clip.top,rect.top+parent.clientTop);clip.bottom=Math.min(clip.bottom,rect.top+parent.clientTop+parent.clientHeight);}
    }
    const pair=value=>{const values=value.trim().split(/\s+/);return [values[0],values[1]||values[0]].map((v,i)=>parseFloat(v)*(v.endsWith('%')?(i?r.height:r.width)/100:1));};
    return clippedCardPolygon({x:r.x,y:r.y,width:r.width,height:r.height},clip,[css.borderTopLeftRadius,css.borderTopRightRadius,css.borderBottomRightRadius,css.borderBottomLeftRadius].map(pair));
  }
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    if (disposed || !frameHost) return;
    // ResizeObserver runs before paint: keep the mask and optical samples on
    // the same geometry, without another requestAnimationFrame of latency.
    sync();
    liquid.refreshLayout?.({bounds:imageBounds});
  }) : null;
  // Only known core surfaces; SlotOutlet itself uses display:contents.
  const rightHeaderSelector = '[data-rightbar-col] [data-sidebar-right-panel] [data-dockkit-strip]';
  const rightBodySelector = '[data-rightbar-col] [data-sidebar-right-panel] [data-dockkit-host="dock"] > [data-dockkit-content] > div:has(>[data-dockkit-strip]) + div';
  const componentSelector = '[data-changed-files],[data-presented-file],[data-team-panel],[data-testid="todo-panel"],section[data-turn-trigger],[data-menu-material]:has(>ul[aria-label="后台任务"]),[data-menu-material]:has(>ul[aria-label="Background jobs"]),' + saoBetterSidebarSelectors().components;
  const surfaceSelectors = [
    '[data-slot="conversation.header"] > header',
    '[data-slot="rightbar.session"] > *',
    rightHeaderSelector, rightBodySelector, contextCardSelector,
    '[data-rightbar-col] [data-sidebar-right-panel] [data-dockkit-host="dock"] > [data-dockkit-content]:not(:has(>div>[data-dockkit-strip]))',
    '[data-rightbar-col] [data-sidebar-right-panel] [data-dockkit-empty]',
    '[role="dialog"][data-shortcut-modal="settings"]'
  ];
  const excluded = '[data-plugin],[data-pet],[data-whale],[data-slot="sidebar"],[data-slot="shell.sidebar"],iframe,canvas,video';
  const settingsDialogSelector = ':is(dialog,[role="dialog"])[data-shortcut-modal="settings"]';
  const windowSelector = '[data-menu-material],[role="dialog"],[role="alertdialog"],[role="tooltip"],[role="alert"][style*="--dsh-toast-hold"],[data-popover-content]';
  function windowUsesWallpaper(el) {
    if (!background.isConnected || !imageBounds.width || !imageBounds.height) return false;
    const r = el.getBoundingClientRect(), area = imageBounds;
    if (r.left < area.x || r.top < area.y || r.right > area.x + area.width || r.bottom > area.y + area.height) return false;
    // Portals do not inherit scene ownership. Probe the visible backing branch,
    // excluding the portal itself and its layout ancestors. No DOM pixels/text
    // are captured; CSS owns any unknown or occluded backdrop (including modals).
    const inset = Math.min(8, r.width / 4, r.height / 4);
    const points = [[r.left + r.width / 2,r.top + r.height / 2],
      [r.left + inset,r.top + inset],[r.right - inset,r.top + inset],
      [r.left + inset,r.bottom - inset],[r.right - inset,r.bottom - inset]];
    return points.every(([x,y]) => {
      const backing = document.elementsFromPoint(x,y).find(node => node !== el && !el.contains(node) && !node.contains(el));
      return !!backing?.closest('[data-sao-wall-column]') && !backing.closest(windowSelector + ',[data-sao-browser-pane]');
    });
  }
  function chooseSurfaces() {
    const windows = [...document.querySelectorAll(windowSelector)];
    const nodes = [...windows,...document.querySelectorAll(surfaceSelectors.join(','))];
    // Keep the large conversation backdrop clear; glass belongs to its controls.
    const composerAnchors = document.querySelectorAll('[data-slot="conversation.input.attachments"]');
    for (const anchor of composerAnchors) if (anchor.parentElement) nodes.push(anchor.parentElement);
    if (!composerAnchors.length) for (const anchor of document.querySelectorAll('[data-slot="conversation.input.overlay"]')) if (anchor.parentElement) nodes.push(anchor.parentElement);
    const unique = [...new Set(nodes)];
    return unique.filter(el => el instanceof HTMLElement && !el.closest('[hidden],[aria-hidden="true"]') && !el.matches(excluded) && !el.matches(componentSelector) && !el.closest('#sao-startup,[data-whale],[data-pet],[data-sao-browser-pane]') && el.getBoundingClientRect().width > 0 && (windows.includes(el) || getComputedStyle(el).visibility === 'visible') && !(el.matches('[data-sidebar-right-panel], [data-slot="rightbar.session"] > *') && unique.some(inner => inner !== el && el.contains(inner)))).filter((el,index) => windows.includes(el) || index < windows.length + 12);
  }
  function applyTokens() {
    if (preferences.featureMode === 'startup-only') { paletteStyle.remove(); return; }
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
    const css = declarations.length ? `body{${declarations.join(';')}}` : '';
    // Palette edits do not rebuild geometry/material CSS or dispose/reinstall
    // host tokens. CSS variables update their existing consumers directly.
    if (paletteStyle.textContent !== css) paletteStyle.textContent = css;
    if (css && !paletteStyle.isConnected) document.head.append(paletteStyle);
    else if (!css) paletteStyle.remove();
  }
  let modeAnnounced = null, modeGeneration = 0;
  function announceMode() {
    if (modeAnnounced === preferences.featureMode) return;
    modeAnnounced = preferences.featureMode;
    modeGeneration++;
    window.dispatchEvent(new CustomEvent('dsh-sao-mode-change', {detail:{mode:modeAnnounced}}));
  }
  function suspendAppearance() {
    videoWallpaper.set({enabled:false});
    cancelAnimationFrame(queued); queued = 0;
    paletteStyle.remove();
    liquid.update({enabled:false,surfaces:[]});
    style.remove(); background.remove();
    frameHost?.removeAttribute('data-sao-wall-frame'); frameHost?.removeAttribute('data-sao-wall-positioned'); frameHost = null;
    for (const el of layoutTouched) for (const attr of ['data-sao-wall-column','data-sao-wall-right','data-sao-browser-only','data-sao-main-joined','data-sao-right-joined']) el.removeAttribute(attr);
    layoutTouched.clear();
    for (const el of shellTouched) for (const attr of ['data-sao-shell','data-sao-shell-center','data-sao-shell-sidebar']) el.removeAttribute(attr);
    shellTouched.clear();
    for (const el of componentTouched) { el.removeAttribute('data-sao-component'); el.style.removeProperty('--sao-component-alpha'); }
    componentTouched.clear();
    for (const el of contextTouched) el.removeAttribute('data-sao-context'); contextTouched.clear();
    for (const el of touched) { for (const attr of materialAttributes) el.removeAttribute(attr); el.style.removeProperty('--sao-surface-alpha'); }
    touched.clear();
    for (const [nodes,attribute] of [[rightPanesTouched,'data-sao-right-pane'],[rightRootsTouched,'data-sao-right-root'],[browserPanesTouched,'data-sao-browser-pane']]) { for (const el of nodes) el.removeAttribute(attribute); nodes.clear(); }
    resizeObserver?.disconnect(); adaptiveObserved.clear(); contextCardsObserved.clear(); contextViewportsObserved.clear(); rightPanesObserved.clear();
  }
  // A failed material pass must remain observable without taking down settings.
  const runtimeState = {build:'sao-1.0.6',passes:0,error:null};
  function sync() {
    if (disposed) return;
    announceMode();
    if (preferences.featureMode === 'startup-only') { suspendAppearance(); return; }
    if (!style.isConnected) document.head.append(style);
    try { syncAppearance(); runtimeState.passes++; runtimeState.error = null; }
    catch (error) {
      const failure = {name:String(error?.name || 'Error'),message:String(error?.message || error).slice(0,320)};
      if (runtimeState.error?.message !== failure.message) console.error('dsh-SAO material pass failed',error);
      runtimeState.error = failure;
    }
  }
  function syncAppearance() {
    if (disposed) return;
    const p = preferences, source = p.wallpaper === 'custom' ? (customPosterURL || customURL) : builtins.find(x => x.id === p.wallpaper)?.src;
    if (source !== loadedSource) {
      loadedSource = source || ''; imageReady = false;
      if (source) image.src = source; else image.removeAttribute('src');
    }
    background.hidden = false; image.hidden = !source;
    image.style.objectPosition = `${p.wallX}% ${p.wallY}%`; image.style.transform = `scale(${p.wallScale / 100})`;
    image.style.opacity = String(p.wallOpacity);
    videoWallpaper.set({source:customKind === 'video' ? customURL || '' : '',enabled:p.wallpaper === 'custom' && customKind === 'video',quality:p.videoQuality});
    layoutWallpaper();
    background.style.background = 'var(--dsw-alias-bg-base,#f4f6f9)';
    const scopedBase = p.wallpaperScope === 'conversation' ? wallpaperBaseColor() : baseColor();
    const rightGlass = p.rightLinked ? p.glass : p.rightGlass, rightOpacity = rightScene().opacity, rightBlur = rightScene().blur;
    const contextGlass = contextMode(p), contextLayers = contextSceneLayers(p, rightOpacity);
    const headerLayers = sceneSurfaceLayers(p.headerOpacity,p.conversationOpacity), composerLayers = sceneSurfaceLayers(p.composerOpacity,p.conversationOpacity);
    const rightHeaderAlpha = p.headerLinked ? p.headerOpacity : p.rightHeaderOpacity;
    const rightHeaderLayers = sceneSurfaceLayers(rightHeaderAlpha,rightOpacity), rightComposerLayers = sceneSurfaceLayers(p.composerOpacity,rightOpacity);
    const componentMainLayers = sceneSurfaceLayers(p.componentOpacity,p.conversationOpacity), componentRightLayers = sceneSurfaceLayers(p.componentOpacity,rightOpacity);
    const filter = (opacity, blur, frost = false) => opacity > 0 ? (blur || frost ? `blur(${frost ? Math.max(12,blur) : blur}px)` : 'none') : 'none';
    const glass = p.glass !== 'off' || rightGlass !== 'off' || contextGlass !== 'off', alpha = p.opacity, blur = p.conversationBlur, windowAlpha = windowSurfaceOpacity(p);
    const materialBase = 'var(--dsw-alias-bg-base,#f4f6f9)';
    const readoutDock = 'body :is([data-slot="main.conversation"],[data-slot="rightbar"]) :is([data-composer-dock],.GRgSLq_dock,[data-mobile-nav="stats"])';
    lastStyle = `
@font-face{font-family:"SAO Local Rounded";src:local("方正兰亭圆_准"),local("方正兰亭圆_GBK_准"),local("FZLanTingYuan-M-GBK");font-display:swap;font-weight:400}
body{--sao-settings-window-alpha:${windowAlpha};--sao-settings-host-filter:${windowAlpha>0&&glass?'blur(24px) saturate(1.12)':'none'};--sao-font:${JSON.stringify(p.fontFamily === '方正兰亭圆_准' ? 'SAO Local Rounded' : p.fontFamily)},"Microsoft YaHei",system-ui,sans-serif;--dsh-font-family-text:var(--sao-font)!important;--dsw-font-family:var(--sao-font)!important;font-family:var(--sao-font);font-weight:400;font-synthesis:none;--sao-accent:var(--dsw-alias-brand-primary);--dsw-specific-sidebar-fill:color-mix(in srgb,var(--dsw-alias-bg-base) 94%,var(--sao-accent) 6%)!important}
/* Keep the entire dock on one baseline. It owns horizontal scrolling when
   constrained, so neither registered stats nor ContextMeter fall below the seat.
   Do not override display: the host's empty/hidden and pocket opt-out still win. */
${readoutDock}{box-sizing:border-box!important;flex:0 0 auto!important;flex-flow:row nowrap!important;align-items:center!important;justify-content:flex-start!important;gap:6px!important;min-width:0!important;width:max-content;max-width:100%!important;height:auto!important;min-height:28px!important;max-height:none!important;padding:2px 0 4px!important;white-space:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important;overscroll-behavior-x:contain;scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l2) transparent}
:is(${readoutDock}) [data-slot="conversation.composer.dock"]{display:contents!important}
:is(${readoutDock}) :is([data-slot="conversation.composer.dock"]>*,.hNGZaa_anchor,.hNGZaa_pill,.A6Bq1a_root,.A6Bq1a_trigger){flex:0 0 auto!important;min-width:max-content!important;white-space:nowrap!important}
:is(${readoutDock}) [data-slot="conversation.composer.dock"]>:is(div,section){display:inline-flex!important;flex-flow:row nowrap!important;align-items:center!important;gap:6px!important}
:is(${readoutDock}) :where(span,button,output,small){white-space:nowrap!important}
:is(${readoutDock}) .hNGZaa_label{overflow:visible!important;text-overflow:clip!important}
/* Native StatsPills + ContextMeter: strengthen only the composer readouts.
   The exact dock class is a verified fallback for hosts before data-composer-dock. */
:is([data-slot="main.conversation"],[data-slot="rightbar"]) :is([data-composer-dock],.GRgSLq_dock,[data-slot="conversation.composer.dock"]){--sao-readout-ink:var(--dsw-alias-label-primary,#172333);--dsw-alias-label-secondary:var(--sao-readout-ink);--dsw-alias-label-tertiary:var(--sao-readout-ink);--dsw-alias-label-caption:var(--sao-readout-ink);color:var(--sao-readout-ink);font-weight:600;font-synthesis:weight}
:is([data-slot="main.conversation"],[data-slot="rightbar"]) :is([data-composer-dock],.GRgSLq_dock,[data-slot="conversation.composer.dock"]) :where(span,button,output,small){font-weight:600}
[data-sao-shell]{background:var(--dsw-specific-sidebar-fill)!important;--sao-shell-base:color-mix(in srgb,var(--dsw-alias-bg-base) 97%,var(--sao-accent) 3%)}
[data-sao-shell]::before,[data-sao-shell-sidebar],[data-sao-shell-sidebar] > *,[data-slot="statusbar"] > *,[data-slot="bottom"] > *,[data-shell-bottom]{background:var(--dsw-specific-sidebar-fill)!important}
[data-sao-shell-center]{background:var(--sao-shell-base)!important}
[data-sao-shell] :is(button,input,select,textarea){font-weight:400}
[data-sao-shell] :is(h1,h2,h3){font-weight:500}
${scopes.split(',').map(s => `${s.trim()} :is(button,input,select,textarea)`).join(',')}{font-family:var(--sao-font)}
${background.parentElement ? `[data-sao-wall-frame]{isolation:isolate}[data-sao-wall-frame][data-sao-wall-positioned]{position:relative}[data-sao-wall-column]{background:transparent!important}[data-sao-wall-right] :is([data-sidebar-right-panel],[data-dockkit-host="dock"],[data-dockkit-content],[data-dockkit-column],[data-dockkit-empty]),[data-sao-wall-right] [data-dockkit-content] > div,[data-sao-wall-right] [data-slot="rightbar.session"] > *{background:transparent!important}[data-slot="main.conversation"] > [data-phase]{background:transparent!important}[data-slot="main.conversation"] [data-composer-seat]{background:transparent!important}` : '[data-slot="main.conversation"] > [data-phase]{background:var(--sao-shell-base)!important}'}
/* The column supplies one material. Only each tab's own root is cleared;
   nested cards, code/diff colors, file previews and chart semantics remain owned. */
[data-sao-right-pane],[data-sao-right-pane] > [data-slot],[data-sao-right-pane] [data-sao-right-root]{background:transparent!important}
[data-sao-right-pane] :is([data-phase],[data-composer-seat]){background:transparent!important}
/* The internal join is flat. Keep the dock's resize hit area and native
   fullscreen/floating/Browser frame, removing only the visible push seam. */
[data-sao-main-joined]{border-top-right-radius:0!important}
[data-sao-right-joined] [data-sidebar-right-panel="push"] [data-dockkit-host="dock"][data-dockkit-column="0"] > [data-dockkit-content]:not([data-sao-browser-pane]){border-left:0!important;border-top-left-radius:0!important}
/* Browser panes keep their native opaque base and chrome, including in splits. */
[data-sao-browser-only],[data-sao-wall-right] [data-sao-browser-pane]{background:var(--dsw-alias-bg-base,#f4f6f9)!important}
[data-sao-material]{isolation:isolate;corner-shape:round!important;--sao-material-base:color-mix(in srgb,${materialBase} 97%,var(--dsw-alias-brand-primary) 3%);--sao-surface-alpha:${Math.round(alpha*100)}%;--sao-surface-blur:${blur}px;--sao-surface-filter:${filter(alpha,blur)};--sao-frost-filter:${filter(alpha,blur,true)};--sao-optical-strength:${4*alpha*(1-alpha)};border-color:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
[data-sao-zone="right"]{--sao-surface-alpha:${Math.round(rightOpacity*100)}%;--sao-surface-blur:0px;--sao-surface-filter:none}
[data-sao-zone="context"]{--sao-surface-alpha:${contextLayers.cardOpacity*100}%;--sao-surface-filter:${filter(p.contextOpacity,p.contextBlur)};--sao-frost-filter:${filter(p.contextOpacity,p.contextBlur,true)};--sao-optical-strength:${4*p.contextOpacity*(1-p.contextOpacity)}}
[data-sao-zone="composer"]{--sao-surface-alpha:${composerLayers.cardOpacity*100}%;--sao-surface-filter:${filter(p.composerOpacity,blur)};--sao-frost-filter:${filter(p.composerOpacity,blur,true)};--sao-optical-strength:${4*p.composerOpacity*(1-p.composerOpacity)}}
[data-sao-wall-right] [data-sao-zone="composer"]{--sao-surface-alpha:${rightComposerLayers.cardOpacity*100}%;--sao-surface-filter:${filter(p.composerOpacity,rightBlur)};--sao-frost-filter:${filter(p.composerOpacity,rightBlur,true)}}
[data-sao-zone="header"]{--sao-surface-alpha:${headerLayers.cardOpacity*100}%;--sao-surface-filter:${filter(p.headerOpacity,blur)};--sao-frost-filter:${filter(p.headerOpacity,blur,true)};--sao-optical-strength:${4*p.headerOpacity*(1-p.headerOpacity)}}
[data-sao-zone="header-right"]{--sao-surface-alpha:${rightHeaderLayers.cardOpacity*100}%;--sao-surface-filter:${filter(rightHeaderAlpha,rightBlur)};--sao-frost-filter:${filter(rightHeaderAlpha,rightBlur,true)};--sao-optical-strength:${4*rightHeaderAlpha*(1-rightHeaderAlpha)}}
[data-sao-zone="window"]{--sao-surface-alpha:${windowAlpha*100}%;--sao-surface-filter:none;--sao-frost-filter:${filter(windowAlpha,0,true)};--sao-optical-strength:${4*windowAlpha*(1-windowAlpha)};color:var(--dsw-alias-label-primary)!important}
/* Outside a proven wallpaper scene the browser composites the actual page.
   Keep the same fill and edge, without importing a remembered chat texture. */
[data-sao-zone="window"][data-sao-backdrop="page"]{--sao-surface-filter:${filter(windowAlpha,12)}}
body:has([data-menu-material][data-sao-material]) [data-menu-backing],
[data-menu-material][data-sao-material]>div[aria-hidden="true"]{background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;box-shadow:none!important}
[role="tooltip"]{--dsw-alias-tooltip-key-bg:transparent!important;--dsw-alias-tooltip-key-label:var(--dsw-alias-label-primary)!important}
[role="tooltip"] kbd,[role="tooltip"] kbd::before,[role="tooltip"] kbd::after{background:transparent!important;box-shadow:none!important;text-shadow:none!important;color:inherit!important}
[data-sao-component]{--sao-component-alpha:${p.componentOpacity*100}%;background:color-mix(in srgb,${materialBase} var(--sao-component-alpha),transparent)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;--changes-fill:transparent!important;--deliverable-fill:transparent!important;--dsw-alias-bg-layer-2:transparent!important}
section[data-turn-trigger][data-sao-component]{--dsw-alias-turn-trigger-bg:color-mix(in srgb,${materialBase} var(--sao-component-alpha),transparent);--dsw-alias-turn-trigger-bg-hover:color-mix(in srgb,${materialBase} max(0%,calc(var(--sao-component-alpha) - 5%)),transparent)}
section[data-turn-trigger][data-sao-component]:hover{background:var(--dsw-alias-turn-trigger-bg-hover)!important}
/* Context-owned local hooks keep nested controls translucent without
   * touching global theme layers, chart hues or duration contrast halos. */
[data-sao-context]{--lc-canvas:transparent!important;--lc-subpanel-bg:color-mix(in srgb,${materialBase} ${8*Math.min(1,p.contextOpacity/.8)}%,transparent)!important;--lc-control-track:color-mix(in srgb,${materialBase} ${10*Math.min(1,p.contextOpacity/.8)}%,transparent)!important;background:transparent!important}
[data-sao-context] .lc-card .lc-card{background:var(--lc-subpanel-bg)!important;box-shadow:none!important}
[data-sao-context] :is(.lc-stat,.lc-cmd-kpi){background:var(--lc-subpanel-bg)!important}
[data-sao-context] :is(.lc-chart-tip,.lc-tip){background:color-mix(in srgb,${materialBase} 92%,transparent)!important}
/* Share the goal strip's one native menu layer across the ENTIRE task shell. */
section[data-testid="todo-panel"][data-sao-component]{position:relative;isolation:isolate;--dsw-alias-bg-layer-2:inherit!important;background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;border-radius:var(--dsw-radius-md);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-panel);border:0}
section[data-testid="todo-panel"][data-sao-component]::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;background:color-mix(in srgb,${materialBase} var(--sao-component-alpha),transparent);backdrop-filter:${p.componentOpacity>0?'var(--dsw-menu-backdrop-filter)':'none'};-webkit-backdrop-filter:${p.componentOpacity>0?'var(--dsw-menu-backdrop-filter)':'none'}}
[data-team-panel][data-sao-component]{background:transparent!important;--dsw-specific-menu:color-mix(in srgb,${materialBase} var(--sao-component-alpha),transparent)!important}
[data-team-panel][data-sao-component]::before{background:var(--dsw-specific-menu)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
[data-menu-material][data-sao-component]>div[aria-hidden="true"]{background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
[data-menu-material][data-sao-component] [data-terminal]{--dsw-alias-markdown-code-block:transparent!important;background:transparent!important}
[data-sao-material][data-sao-positioned]{position:relative}
[data-sao-surface="floating"]{border-radius:16px!important;box-shadow:0 10px 32px color-mix(in srgb,var(--dsw-alias-label-primary,#16212c) calc(8% * var(--sao-optical-strength)),transparent)!important}
[data-sao-surface="joined"]{border:0!important;border-radius:0!important}
html[data-windows-titlebar] [data-sidebar-right-panel="fullscreen"] [data-dockkit-column="0"] > [data-sao-surface="joined"]{border-top-left-radius:var(--dsh-windows-content-radius,16px)!important}
[data-sao-material]::before{content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;corner-shape:inherit;z-index:-1;background:color-mix(in srgb,var(--sao-material-base,#f4f6f9) var(--sao-surface-alpha),transparent);backdrop-filter:var(--sao-surface-filter,none);-webkit-backdrop-filter:var(--sao-surface-filter,none);border:0;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-label-primary,#16212c) calc(9% * var(--sao-optical-strength)),transparent)}
[data-sao-surface="joined"]::before{box-shadow:none}
${saoSettingsHostCSS(settingsDialogSelector)}
[role="dialog"][data-shortcut-modal="settings"] :is(button[aria-label="关闭"],button[aria-label="Close"]){border-radius:14px;background:color-mix(in srgb,var(--dsw-alias-label-primary,#16212c) 2%,transparent);color:var(--dsw-alias-label-primary);border-color:transparent}
[data-composer-card][data-sao-material] :is([data-input-scroll],[data-input-scroll] > div,[data-composer-input]){border-color:transparent!important;box-shadow:none!important}
[data-rightbar-col]:has([data-sao-material]) [data-sidebar-right-panel]{border-color:transparent!important;box-shadow:none!important;background:transparent!important}
[data-sao-material="liquid"]::before{background:color-mix(in srgb,var(--sao-material-base,#f4f6f9) var(--sao-surface-alpha),transparent)}
/* Unknown/page-backed scenes stay native. A quiet directional rim gives them
   depth without capturing DOM pixels or importing the conversation wallpaper. */
[data-sao-material="liquid"][data-sao-backdrop="page"]::before{box-shadow:inset 0 1px 0 color-mix(in srgb,white calc(42% * var(--sao-optical-strength)),transparent),inset 1px 0 0 color-mix(in srgb,white calc(18% * var(--sao-optical-strength)),transparent),inset 0 -1px 0 color-mix(in srgb,var(--dsw-alias-label-primary,#16212c) calc(15% * var(--sao-optical-strength)),transparent);background:linear-gradient(135deg,color-mix(in srgb,white calc(6% * var(--sao-optical-strength)),transparent),transparent 35%,transparent 70%,color-mix(in srgb,var(--dsw-alias-label-primary,#16212c) calc(2% * var(--sao-optical-strength)),transparent)),color-mix(in srgb,var(--sao-material-base,#f4f6f9) var(--sao-surface-alpha),transparent)}
[data-sao-material]>[data-sao-liquid]{z-index:-1!important;border-radius:inherit;corner-shape:inherit;background:transparent;box-shadow:none;border:0}
/* Keep the readable base; the GPU canvas is a lightweight optical overlay. */
[data-sao-material="liquid"]:has(>[data-sao-liquid]:not([hidden]))::before{backdrop-filter:none;-webkit-backdrop-filter:none}
/* Paint frost on the same border box as its replacement hole. The inset:0
 * pseudo-element starts inside the transparent host border and would leave a
 * clear ring if it owned the fill. Keep it only for the existing inset stroke.
 * No border widths, layout, liquid canvases or requested alpha are changed. */
[data-sao-material="frosted"][data-sao-zone][data-sao-surface]{background:color-mix(in srgb,var(--sao-material-base,#f4f6f9) var(--sao-surface-alpha),transparent)!important;background-clip:border-box!important;backdrop-filter:var(--sao-frost-filter,none)!important;-webkit-backdrop-filter:var(--sao-frost-filter,none)!important}
[data-sao-material="frosted"]::before{background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
[data-sao-right-backdrop] > [data-sao-liquid]{position:absolute;inset:0;z-index:1!important;border-radius:inherit;pointer-events:none}
[data-sao-right-backdrop]::after{content:"";position:absolute;inset:0;z-index:2;border-radius:inherit;pointer-events:none;opacity:var(--sao-edge-strength,0)}
[data-sao-scene-material="liquid"]::after{box-shadow:inset 0 0 0 1px rgb(255 255 255 / .48),inset 2px 2px 5px rgb(255 255 255 / .25),inset -2px -2px 6px rgb(15 35 55 / .14);background:linear-gradient(135deg,rgb(255 255 255 / .14),transparent 22%,transparent 78%,rgb(20 45 70 / .06))}
[data-sao-scene-material="frosted"]::after{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent)}
[data-sao-right-backdrop][data-sao-joined-left][data-sao-scene-material="liquid"]::after{box-shadow:inset 0 1px 0 rgb(255 255 255 / .48),inset -1px 0 0 rgb(255 255 255 / .48),inset 0 -1px 0 rgb(255 255 255 / .48)}
[data-sao-right-backdrop][data-sao-joined-left][data-sao-scene-material="frosted"]::after{box-shadow:inset 0 1px 0 color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent),inset -1px 0 0 color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent),inset 0 -1px 0 color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent)}
[data-sao-scene-material="off"]::after{display:none}
[data-sao-material="liquid"][data-sao-zone][data-sao-surface]{background:transparent!important}
@media(prefers-reduced-motion:reduce){[data-sao-material]{transition:none}}
${saoBetterSidebarCSS(materialBase)}
`;
    writeStyle();
    const isWindow = el => el.matches(windowSelector);
    const isHeader = el => el.matches('[data-slot="conversation.header"] > header');
    const isRightHeader = el => el.matches(rightHeaderSelector);
    const isComposer = el => el.matches('[data-composer-card]') || !!el.querySelector(':scope > [data-slot="conversation.input.attachments"],:scope > [data-slot="conversation.input.overlay"]');
    const isRight = el => !isWindow(el) && !!el.closest('[data-rightbar-col],[data-slot="rightbar"],[data-slot="rightbar.session"]');
    const surfaceMode = el => isContextCard(el) ? contextGlass : isRight(el) ? rightGlass : p.glass;
    // Native settings own one CSS glass shell across every registered category.
    const surfaces = glass ? chooseSurfaces().filter(el => !el.matches(settingsDialogSelector) && surfaceMode(el) !== 'off' && (!isRight(el) || isRightHeader(el) || isComposer(el) || isContextCard(el))) : [];
    const pageBackedWindows = new Set(surfaces.filter(el => isWindow(el) && !el.matches(settingsDialogSelector) && !windowUsesWallpaper(el)));
    // Include orphaned markers from earlier clients, not only nodes owned by this instance.
    let contextShapeChanged = false;
    for (const el of new Set([...touched,...document.querySelectorAll('[data-sao-material]')])) if (!surfaces.includes(el)) { if (isContextCard(el)) contextShapeChanged = true; for (const attr of materialAttributes) el.removeAttribute(attr); el.style.removeProperty('--sao-surface-alpha'); touched.delete(el); }
    for (const el of surfaces) {
      if (!el.hasAttribute('data-sao-material') && getComputedStyle(el).position === 'static') el.setAttribute('data-sao-positioned','');
      if (el.getAttribute('data-sao-material') !== surfaceMode(el)) el.setAttribute('data-sao-material', surfaceMode(el));
      const zone = isContextCard(el) ? 'context' : isWindow(el) ? 'window' : isRightHeader(el) ? 'header-right' : isHeader(el) ? 'header' : isComposer(el) ? 'composer' : isRight(el) ? 'right' : 'conversation'; if (el.getAttribute('data-sao-zone') !== zone) el.setAttribute('data-sao-zone', zone);
      if (pageBackedWindows.has(el)) { if (el.getAttribute('data-sao-backdrop') !== 'page') el.setAttribute('data-sao-backdrop','page'); }
      else if (el.hasAttribute('data-sao-backdrop')) el.removeAttribute('data-sao-backdrop');
      if (zone !== 'conversation' && el.style.getPropertyValue('--sao-surface-alpha')) el.style.removeProperty('--sao-surface-alpha');
      const type = (isHeader(el) || isRightHeader(el) || el.matches(rightBodySelector) || el.matches('[data-dockkit-content],[data-dockkit-empty],[data-sidebar-right-panel]')) ? 'joined' : 'floating'; if (el.getAttribute('data-sao-surface') !== type) { if (isContextCard(el)) contextShapeChanged = true; el.setAttribute('data-sao-surface', type); }
      touched.add(el);
    }
    if (contextShapeChanged) updateContextRoots();
    // Geometry follows native layout; no reparenting or content reads. These
    // adaptive footprints let headers and inputs be clearer than their scene.
    conversationSurfacePaths = []; rightSurfacePaths = [];
    const surfaceLayers = new Map(), adaptiveHosts = new Set();
    for (const el of surfaces) {
      // Portals blend over the actual page below, which may include other
      // cards or a modal scrim. Their alpha is local: never cut a hole in an
      // unrelated scene or change material underneath an overlapping window.
      if (isWindow(el)) continue;
      const right = isRight(el), box = right ? rightBounds : conversationBounds;
      const layers = isContextCard(el) ? contextLayers : isRightHeader(el) ? rightHeaderLayers : isHeader(el) ? headerLayers : isComposer(el) ? (right ? rightComposerLayers : composerLayers) : sceneSurfaceLayers(p.opacity,right ? rightOpacity : p.conversationOpacity);
      if (!layers || !box) continue;
      surfaceLayers.set(el,layers);
      if (el.getAttribute('data-sao-zone') === 'conversation') { const alpha=layers.cardOpacity*100+'%'; if(el.style.getPropertyValue('--sao-surface-alpha')!==alpha) el.style.setProperty('--sao-surface-alpha',alpha); }
      if (layers.continuous || isContextCard(el)) continue;
      adaptiveHosts.add(el);
      const polygon = sceneSurfacePolygon(el,box);
      if (polygon.length>=3) (right ? rightSurfacePaths : conversationSurfacePaths).push(polygon);
    }
    const radius = wallHost ? getComputedStyle(wallHost).borderTopLeftRadius : '0px';
    const components = [...document.querySelectorAll(componentSelector)].filter(el => !el.closest('[data-sao-browser-pane]') && !el.hasAttribute('data-sao-right-root'));
    for (const el of componentTouched) if (!components.includes(el)) { el.removeAttribute('data-sao-component'); el.style.removeProperty('--sao-component-alpha'); componentTouched.delete(el); }
    for (const el of components) { if (!el.hasAttribute('data-sao-component')) el.setAttribute('data-sao-component',''); componentTouched.add(el); }
    for (const el of components) {
      const nestedComponent = el.parentElement?.closest('[data-sao-component]');
      const bottomHost = el.closest('[data-dsh-bottom-panel]'), rect = bottomHost?.getBoundingClientRect(), c = conversationBounds;
      // A graph node may pan beyond its clipping viewport. Scene ownership
      // follows the bottom portal host, while sceneSurfacePolygon clips the node.
      const bottomOnScene = !!rect && rect.width>0 && rect.height>0 && rect.left>=c.x-1 && rect.top>=c.y-1 && rect.right<=c.x+c.width+1 && rect.bottom<=c.y+c.height+1;
      const onScene = !el.closest(windowSelector) && !nestedComponent && (!!el.closest('[data-slot="main.conversation"],[data-sao-wall-right]') || bottomOnScene);
      const right = isRight(el), layers = right ? componentRightLayers : componentMainLayers;
      // One target shared by nested neutral components, without stacking it twice.
      const alpha = `${(nestedComponent ? 0 : onScene ? layers.cardOpacity : p.componentOpacity)*100}%`;
      if(el.style.getPropertyValue('--sao-component-alpha')!==alpha) el.style.setProperty('--sao-component-alpha',alpha);
      if (onScene && !layers.continuous) {
        adaptiveHosts.add(el);
        const box = right ? rightBounds : conversationBounds;
        if (box) { const polygon = sceneSurfacePolygon(el,box); if(polygon.length>=3) (right ? rightSurfacePaths : conversationSurfacePaths).push(polygon); }
      }
    }
    // Track local size changes and clipping viewports, not just column bounds.
    for(const host of [...adaptiveHosts]) for(let parent=host.parentElement;parent&&parent!==frameHost;parent=parent.parentElement){
      const css=getComputedStyle(parent);
      if(/^(auto|scroll|hidden|clip)$/.test(css.overflowX)||/^(auto|scroll|hidden|clip)$/.test(css.overflowY)) adaptiveHosts.add(parent);
    }
    const retainedObservation = host => host===wallHost||host===frameHost||host===observedRight||rightPanesObserved.has(host)||contextTouched.has(host)||contextCardsObserved.has(host)||contextViewportsObserved.has(host);
    for(const host of adaptiveObserved) if(!adaptiveHosts.has(host)){if(!retainedObservation(host)) resizeObserver?.unobserve(host);adaptiveObserved.delete(host);}
    for(const host of adaptiveHosts) if(!adaptiveObserved.has(host)){resizeObserver?.observe(host);adaptiveObserved.add(host);}
    paintBackdrop(conversationBackdrop,conversationBounds,p.conversationOpacity,p.conversationBlur,radius);
    paintBackdrop(rightBackdrop,rightBounds,rightOpacity,rightBlur,'16px','round',rightGlass);
    const isConversationSurface = el => !isRight(el) && !isWindow(el);
    // Nonzero background blur uses the CSS backdrop path rather than a costly or mismatched GPU approximation.
    const liquidSurfaces = surfaces.filter(el => !el.matches(settingsDialogSelector) && !pageBackedWindows.has(el) && surfaceMode(el) === 'liquid' && (isContextCard(el) || !(isRight(el) ? rightBlur > 0 : p.conversationBlur > 0 && isConversationSurface(el))));
    if (rightGlass === 'liquid' && rightBounds && !rightBackdrop.hidden) liquidSurfaces.unshift(rightBackdrop);
    // Card bevels refract the continuous scene rather than sampling untouched
    // wallpaper through it. This prevents a clear ring around a tinted card.
    const surfaceBackgrounds = new Map(liquidSurfaces.filter(el => el !== rightBackdrop && (isConversationSurface(el) || isRight(el) && rightBounds)).map(el => [el,{opacity:surfaceLayers.get(el)?.continuous === false ? 0 : isRight(el) ? rightOpacity : p.conversationOpacity,color:isRight(el) && p.wallpaperScope === 'conversation' ? scopedBase : sceneColor(),bounds:isRight(el) ? rightBounds : conversationBounds}]));
    // Open the two optical edges at the join as well: removing a CSS border
    // alone would leave a refracted vertical bevel between the columns.
    const surfaceOpenEdges = new Map();
    if (rightJoined) for (const host of liquidSurfaces) {
      if (host === rightBackdrop || isRightHeader(host) && host.closest('[data-dockkit-host="dock"][data-dockkit-column="0"]')) surfaceOpenEdges.set(host,{left:true});
      else if (isHeader(host)) surfaceOpenEdges.set(host,{right:true});
    }
    liquid.update({ surfaceOpenEdges, enabled: liquidSurfaces.length > 0, surfaces: liquidSurfaces, edgeOnlySurfaces: new Set([rightBackdrop,...liquidSurfaces.filter(el => isContextCard(el) && (p.contextBlur > 0 || rightBlur > 0 || rightGlass === 'frosted'))]), surfaceOpacities: new Map(liquidSurfaces.map(el => [el, el === rightBackdrop ? rightOpacity : surfaceLayers.has(el) ? surfaceLayers.get(el).cardOpacity : isWindow(el) ? windowAlpha : isRightHeader(el) ? (p.headerLinked?p.headerOpacity:p.rightHeaderOpacity) : isHeader(el) ? p.headerOpacity : isComposer(el) ? p.composerOpacity : isRight(el) ? rightOpacity : p.opacity])), surfaceBackgrounds, baseColor:scopedBase, image: imageReady ? image : null, position: { x: p.wallX, y: p.wallY, scale: p.wallScale }, bounds:imageBounds, clipWallpaper:p.wallpaperScope === 'conversation', wallpaperExclusion:p.wallpaperScope === 'conversation' ? rightBounds : null, wallOpacity: p.wallOpacity, opacity: p.opacity });
  }
  image.onload = () => { imageReady = true; schedule(); };
  image.onerror = () => { imageReady = false; notice = '壁纸载入失败，请重新选择或上传'; notify(); };
  function schedule() { if (!disposed && !document.hidden && !queued) queued = requestAnimationFrame(() => { queued = 0; sync(); }); }
  const structure = '[data-sao-settings],[data-slot],[data-dockkit-content],[data-dockkit-empty],[data-dockkit-strip],[data-sidebar-right-panel],[data-sao-material],' + windowSelector + ',' + componentSelector + ',' + contextRootSelector + ',' + contextCardSelector + ',' + rightPaneSelector + ',' + browserRootSelector;
  const observer = new MutationObserver(records => {
    if (records.some(r => {
      if (r.type === 'attributes' && ['hidden','aria-hidden','inert','style','class'].includes(r.attributeName) && (r.target.matches?.('[data-slot="main.conversation"]') || r.target.querySelector?.('[data-slot="main.conversation"]'))) return true;
      if (r.type === 'attributes') return (!!r.target.closest?.('[data-dsh-native-tab-host],[data-dsh-bottom-panel]') || r.target.matches?.(windowSelector + ',' + contextRootSelector + ',[data-dockkit-content],[data-dockkit-host],[data-sidebar-right-session],[data-sidebar-right-panel],' + rightPaneSelector + ',' + browserRootSelector)) && (!['style','class'].includes(r.attributeName) || !touched.has(r.target));
      return r.type === 'childList' && [...r.addedNodes,...r.removedNodes].some(n => n.nodeType === 1 && !n.matches?.('[data-sao-liquid],[data-sao-wallpaper]') && (r.target.closest?.(rightPaneSelector) || n.matches?.(structure) || n.firstElementChild && n.querySelector?.(structure)));
    })) schedule();
  });
  observer.observe(document.body, {childList:true,subtree:true,attributes:true,attributeFilter:['hidden','aria-hidden','inert','open','data-state','role','style','class','data-sidebar-right-open','data-sidebar-right-panel']});
  const materialKeys = Object.keys(defaults).filter(key => !['startup','voice','sound','volume','accent','accentProfiles','theme'].includes(key));
  const samePreference = (a, b, key) => key.endsWith('SceneProfiles') || key === 'accentProfiles' ? JSON.stringify(a[key]) === JSON.stringify(b[key]) : Object.is(a[key], b[key]);
  const onStorage = event => {
    if (disposed || event.key !== KEY && event.key !== null) return;
    try {
      const previous = preferences;
      const incoming = event.key === null ? {} : JSON.parse(event.newValue || '{}');
      preferences = normalize({...incoming, theme: readThemePreference()});
      revision++; announceMode(); applyTokens();
      if (previous.featureMode !== preferences.featureMode) sync();
      else if (materialKeys.some(key => !samePreference(previous, preferences, key))) schedule();
      notify();
    } catch { /* Ignore malformed external data without replacing current preferences. */ }
  };
  window.addEventListener('storage', onStorage);
  const onContextScroll = event => {
    const target = event.target;
    if (!(target instanceof Element) || target.closest('[data-sao-settings],[data-shortcut-modal="settings"]')) return;
    if (target.closest('[data-sao-wall-column]') || target.closest(contextRootSelector) || [...contextTouched].some(root => target.contains(root))) schedule();
  };
  document.addEventListener('scroll',onContextScroll,{capture:true,passive:true});
  const onVisibility = () => { if (document.hidden) { cancelAnimationFrame(queued); queued = 0; } else schedule(); };
  document.addEventListener('visibilitychange', onVisibility);
  function readThemePreference() { const value = themeSnapshot().preference; return ['system','light','dark'].includes(value) ? value : preferences.theme; }
  preferences.theme = readThemePreference();
  let activeThemeMode = effectiveTheme(preferences.theme), themeRequestRevision = 0;
  preferences.accent = preferences.accentProfiles[activeThemeMode];
  function reconcileTheme() {
    if (disposed) return;
    const mode = effectiveTheme(readThemePreference()), changed = mode !== activeThemeMode;
    const preference = readThemePreference(), preferenceChanged = preference !== preferences.theme;
    activeThemeMode = mode; preferences.theme = preference;
    preferences.accent = preferences.accentProfiles[mode];
    applyTokens();
    // The native theme event and changeTheme share one queued material refresh.
    // Repeated identical events still notify settings but cannot replay geometry.
    if (changed) schedule();
    if (changed || preferenceChanged) notify();
  }
  ctx.on('theme/change', reconcileTheme);
  themeMedia?.addEventListener?.('change', reconcileTheme);
  async function changeTheme(mode, origin, guard = () => true) {
    if (!['system','light','dark'].includes(mode) || disposed || preferences.featureMode === 'startup-only') return;
    const generation = modeGeneration, request = ++themeRequestRevision;
    const isCurrent = () => !disposed && generation === modeGeneration && request === themeRequestRevision && preferences.featureMode === 'all' && guard();
    // A microtask merges rapid requests and preserves cancellation/reset races
    // without capturing or clipping a full-screen view-transition snapshot.
    await Promise.resolve();
    if (!isCurrent() || mode === readThemePreference()) return;
    await ctx.theme.setTheme(mode);
    if (!isCurrent()) return;
    reconcileTheme(); persist();
  }
  function dbRequest(mode, task) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('dsh-sao-wallpapers-v4', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('images');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('images', mode), req = task(tx.objectStore('images'));
        let value; req.onsuccess = () => { value = req.result; }; tx.oncomplete = () => { db.close(); resolve(value); };
        tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || Error('壁纸存储不可用')); };
      };
    });
  }
  function releaseCustom() {
    videoWallpaper.set({source:'',enabled:false});
    if (customURL) URL.revokeObjectURL(customURL);
    if (customPosterURL) URL.revokeObjectURL(customPosterURL);
    customURL = customPosterURL = null; customKind = 'image'; customMeta = null; customName = '';
  }
  function useCustom(value) {
    releaseCustom();
    customKind = value.kind === 'video' ? 'video' : 'image';
    customURL = URL.createObjectURL(value.blob);
    if (customKind === 'video' && value.poster instanceof Blob) customPosterURL = URL.createObjectURL(value.poster);
    customMeta = value.meta || null; customName = value.name || '我的壁纸';
  }
  async function loadCustom() {
    const current = uploadRevision;
    try {
      const value = await dbRequest('readonly', s => s.get('custom'));
      if (disposed || current !== uploadRevision || !(value?.blob instanceof Blob)) return;
      if (value.kind === 'video' && !(value.poster instanceof Blob)) throw Error('视频封面缺失，请重新上传');
      useCustom(value); sync(); notify();
    } catch (error) { if (preferences.wallpaper === 'custom') storageNotice(error); }
  }
  const api = {
    get: () => ({ ...preferences, accentProfiles: {...preferences.accentProfiles}, rightSceneProfiles: normalizeRightScenes(preferences.rightSceneProfiles), contextSceneProfiles: normalizeRightScenes(preferences.contextSceneProfiles, contextSceneDefaults), headerSceneProfiles: normalizeRightScenes(preferences.headerSceneProfiles, headerSceneDefaults) }), status: () => notice,
    getDefault: key => Object.hasOwn(defaults, key) ? settingDefault(key, preferences) : undefined,
    get wallpapers() { return [...builtins, ...(customURL ? [{id:'custom',name:customName,kind:customKind,meta:customMeta,src:customPosterURL || customURL}] : [])]; },
    get videoStatus() { return videoWallpaper.status; },
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
    set(patch) {
      if (disposed) return;
      const normalized = patchPreferences(preferences, patch);
      const changed = Object.keys(defaults).filter(key => !samePreference(preferences, normalized, key));
      if (!changed.length) return;
      const appearanceChanged = changed.some(key => materialKeys.includes(key));
      preferences = normalized; revision++; announceMode();
      if (changed.some(key => ['accent','accentProfiles','surfaceColor','featureMode'].includes(key))) applyTokens();
      persist();
      if (changed.includes('featureMode')) sync(); else if (appearanceChanged) schedule();
      if (patch.startup === false) window[Symbol.for('dsh.sao.startup.v3')]?.stop?.();
    },
    resetSetting(key, origin) {
      if (!Object.hasOwn(defaults, key) || disposed) return;
      if (key === 'theme') return changeTheme(defaults.theme, origin);
      return api.set({[key]: settingDefault(key, preferences)});
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
      const current = ++uploadRevision;
      let record;
      if (['video/mp4','video/webm'].includes(file?.type)) {
        record = {...await SAOVideoWallpaper.validate(file),blob:file,name:file.name};
      } else {
        if (!file || !['image/jpeg','image/png','image/webp','image/avif','image/gif'].includes(file.type)) throw Error('请选择 JPG、PNG、WebP、AVIF、GIF 图片或 MP4、WebM 视频');
        if (file.size > 25*1024*1024) throw Error('图片最大 25 MB');
        const checkURL = URL.createObjectURL(file), candidate = new Image();
        try { candidate.src = checkURL; await candidate.decode(); if (candidate.naturalWidth * candidate.naturalHeight > 40000000) throw Error('图片分辨率请控制在 4000 万像素以内'); } finally { URL.revokeObjectURL(checkURL); }
        record = {kind:'image',blob:file,name:file.name};
      }
      if (disposed || current !== uploadRevision) return;
      await dbRequest('readwrite', s => s.put(record,'custom'));
      if (disposed || current !== uploadRevision) return;
      useCustom(record);
      api.set({wallpaper:'custom',wallX:50,wallY:50,wallScale:100}); sync(); notify();
    },
    async removeUpload() { const current = ++uploadRevision; await dbRequest('readwrite', s => s.delete('custom')); if (disposed || current !== uploadRevision) return; releaseCustom(); if (preferences.wallpaper === 'custom') api.set({wallpaper:'none'}); sync(); notify(); },
    async reset() {
      const current = revision, task = changeTheme(defaults.theme, null, () => current === revision), request = themeRequestRevision;
      await task;
      if (disposed || current !== revision || request !== themeRequestRevision) return;
      preferences = normalize({ ...defaults, accentProfiles: {...accentDefaults}, theme: readThemePreference() });
      activeThemeMode = effectiveTheme(preferences.theme); announceMode(); applyTokens(); persist();
      cancelAnimationFrame(queued); queued = 0; sync();
    }
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
  // Optional read-only inspection on the already connected page. No content,
  // URLs, Browser descendants, local storage or session identifiers are returned.
  ctx.inject(['cordisInspect'], scope => scope.effect(() => scope.get('cordisInspect').register({
    manifest:{id:'SAOAppearance',description:'Read-only SAO material application status on the connected page; counts, geometry and computed surface styles only.',methods:[{name:'snapshot',description:'Read SAO build marker, last material error, layer geometry and bounded right-pane background styles.',inputSchema:{type:'object',properties:{},additionalProperties:false},outputSchema:{type:'object',additionalProperties:true}}]},
    query(method) {
      if(method!=='snapshot') throw Error('Unknown SAO inspection method');
      const measure = el => {
        if(!el) return null;
        const css=getComputedStyle(el), r=el.getBoundingClientRect();
        return {tag:el.tagName.toLowerCase(),markers:[...el.attributes].map(a=>a.name).filter(name=>/^(data-(sao|slot|rightbar|sidebar-right|dockkit|dsh-native))/.test(name)),box:{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)},display:css.display,visibility:css.visibility,background:css.backgroundColor,opacity:css.opacity,position:css.position,zIndex:css.zIndex,overflowX:css.overflowX,overflowY:css.overflowY,material:el.getAttribute('data-sao-material')||el.getAttribute('data-sao-scene-material'),zone:el.getAttribute('data-sao-zone'),borderWidths:materialBorders(css),componentAlpha:css.getPropertyValue('--sao-component-alpha').trim(),surfaceAlpha:css.getPropertyValue('--sao-surface-alpha').trim(),filter:css.backdropFilter,mask:css.maskImage==='none'?'none':'present',before:{background:getComputedStyle(el,'::before').backgroundColor,filter:getComputedStyle(el,'::before').backdropFilter,radius:getComputedStyle(el,'::before').borderTopLeftRadius,exists:!['none','normal'].includes(getComputedStyle(el,'::before').content)}};
      };
      const selectors={headers:'[data-sao-zone="header"]',windows:'[data-sao-zone="window"]',dialogs:'[role="dialog"]',conversationBackdrop:'[data-sao-conversation-backdrop]',main:'[data-slot="main.conversation"]',right:'[data-slot="rightbar"]',columns:'[data-rightbar-col]',panels:'[data-sidebar-right-panel]',panes:rightPaneSelector,context:contextRootSelector,cards:contextCardSelector,frame:'[data-sao-wall-frame]',center:'[data-sao-shell-center]',wallpaper:'[data-sao-wallpaper]',rightBackdrop:'[data-sao-right-backdrop]',wallRight:'[data-sao-wall-right]',managed:'[data-sao-right-root]',better:'[data-dsh-native-tab-host]',betterBottom:'[data-dsh-bottom-panel]',betterComponents:saoBetterSidebarSelectors().components};
      const nodes=Object.fromEntries(Object.entries(selectors).map(([key,selector])=>{const found=[...document.querySelectorAll(selector)];return [key,{count:found.length,samples:found.slice(0,3).map(measure)}];}));
      const chain=selector=>{const result=[];let node=document.querySelector(selector);for(let i=0;node&&i<7;i++,node=node.parentElement)result.push(measure(node));return result;};
      let cssRules=null;try{cssRules=style.sheet?.cssRules.length??null;}catch{}
      const modules=ctx.get('modules'), state=modules?.entries?.state?.getSnapshot?.(), change=modules?.entries?.releaseChange?.getSnapshot?.();
      const release=value=>value?{version:value.version,commit:value.commit}:null;
      const ownIds=['@local/dsh-sao-link-start','@local/dsh-sao-skin','@local/dsh-sao-market'];
      const moduleStatus={pageRelease:release(modules?.manifest?.release),ownRows:(modules?.manifest?.modules||[]).filter(row=>ownIds.includes(row.id)).map(row=>({id:row.id,rev:row.rev})),syncing:state?.syncing??null,failureCount:state?.failures?.length??null,ownFailures:(state?.failures||[]).filter(row=>ownIds.includes(row.id)).map(row=>({id:row.id,message:String(row.message).slice(0,240)})),announcedReleaseChange:change?{page:release(change.page),previous:release(change.previous),host:release(change.host)}:null};
      const betterAdapter = {selectorSupported:CSS.supports('selector(:is('+saoBetterSidebarSelectors().components+'))'),neutralRulePresent:[...(style.sheet?.cssRules||[])].some(rule=>!!rule.style?.getPropertyValue('--sao-bs-neutral-fill'))};
      const scene=rightScene(),context=contextSceneLayers(preferences,scene.opacity);
      const layerPlan={rightMaterial:preferences.rightLinked?preferences.glass:preferences.rightGlass,contextMaterial:contextMode(preferences),rightAlpha:scene.opacity,contextAlpha:preferences.contextOpacity,contextContinuous:context.continuous,contextLocalAlpha:context.cardOpacity,contextReplacementHoles:context.continuous?0:contextCardPaths.length,adaptiveRightHoles:rightSurfacePaths.length,browserHoles:browserCardPaths.length,frostedReplacementBox:'border-box'};
      return {surfaceSettings:{glass:preferences.glass,surfaceAlpha:preferences.opacity,windowAlpha:preferences.windowOpacity,effectiveWindowAlpha:windowSurfaceOpacity(preferences),headerAlpha:preferences.headerOpacity,headerDefault:headerSceneDefaults(preferences.glass).opacity,conversationAlpha:preferences.conversationOpacity},moduleStatus,betterAdapter,layerPlan,build:runtimeState.build,passes:runtimeState.passes,error:runtimeState.error,disposed,hidden:document.hidden,stylesheet:{connected:style.isConnected,rules:cssRules,characters:style.textContent.length},wallpaper:{connected:background.isConnected,imageReady,scope:preferences.wallpaperScope,imageBounds:{...imageBounds},rightThemeBase:!rightBase.hidden},bounds:{scene:bounds,conversation:conversationBounds,right:rightBounds},onlyBrowserRight,rightJoined,nodes,mainAncestors:chain(selectors.main),rightAncestors:chain(selectors.right)};
    }
  }),'dsh-SAO read-only material inspection'));
  applyTokens(); sync(); loadCustom();
  function dispose() {
    if (disposed) return; disposed = true; uploadRevision++;
    cancelAnimationFrame(queued); observer.disconnect(); resizeObserver?.disconnect(); adaptiveObserved.clear(); contextCardsObserved.clear(); contextViewportsObserved.clear(); for (const [nodes,attribute] of [[rightPanesTouched,'data-sao-right-pane'],[rightRootsTouched,'data-sao-right-root'],[browserPanesTouched,'data-sao-browser-pane']]) { for (const node of nodes) node.removeAttribute(attribute); nodes.clear(); } rightPanesObserved.clear(); document.removeEventListener('scroll',onContextScroll,true); window.removeEventListener('storage',onStorage); document.removeEventListener('visibilitychange',onVisibility);
    themeMedia?.removeEventListener?.('change', reconcileTheme);
    frameHost?.removeAttribute('data-sao-wall-frame'); frameHost?.removeAttribute('data-sao-wall-positioned');
    for (const el of layoutTouched) { el.removeAttribute('data-sao-wall-column'); el.removeAttribute('data-sao-wall-right'); el.removeAttribute('data-sao-browser-only'); el.removeAttribute('data-sao-main-joined'); el.removeAttribute('data-sao-right-joined'); } layoutTouched.clear();
    for (const el of shellTouched) for (const attr of ['data-sao-shell','data-sao-shell-center','data-sao-shell-sidebar']) el.removeAttribute(attr); shellTouched.clear();
    for (const el of componentTouched) { el.removeAttribute('data-sao-component'); el.style.removeProperty('--sao-component-alpha'); } componentTouched.clear();
    for (const el of contextTouched) el.removeAttribute('data-sao-context'); contextTouched.clear();
    videoWallpaper.dispose(); liquid.dispose(); paletteStyle.remove(); style.remove(); background.remove(); image.onload = image.onerror = null;
    if (customURL) URL.revokeObjectURL(customURL); if (customPosterURL) URL.revokeObjectURL(customPosterURL); for (const cleanup of panelDisposers) cleanup(); panelDisposers.clear(); subscribers.clear();
    for (const el of touched) { el.style.removeProperty('--sao-surface-alpha'); for (const attr of materialAttributes) el.removeAttribute(attr); } touched.clear();
    window[Symbol.for('dsh.sao.startup.v3')]?.stop?.();
    if (window[instanceKey] === controller) delete window[instanceKey];
  }
  return api;
}
