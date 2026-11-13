/* Standalone settings view. Bundled inside the SAO client factory. */
// Product preview backgrounds are partitioned into disjoint regions. Each region
// paints its requested absolute alpha, independently of the surrounding scene.
function saoPreviewSurface(opacity, blur, material) {
  const alpha = Math.max(0, Math.min(1, Number(opacity) || 0));
  const requestedBlur = Math.max(0, Math.min(24, Number(blur) || 0));
  const diffusion = alpha === 0 ? 0 : material === 'frosted' ? Math.max(12, requestedBlur) : requestedBlur;
  return {alpha, filter: diffusion > 0 ? 'blur(' + diffusion + 'px)' : 'none', strength: 4 * alpha * (1 - alpha)};
}
function saoPreviewHoleMask(box, holes) {
  if (!(box.width > 0 && box.height > 0) || !holes.length) return 'none';
  const rects = holes.filter(h => h.width > 0 && h.height > 0).map(h => {
    const radius = Math.max(0, Math.min(Number(h.radius) || 0, h.width / 2, h.height / 2));
    return '<rect x="' + (h.left - box.left) + '" y="' + (h.top - box.top) + '" width="' + h.width + '" height="' + h.height + '" rx="' + radius + '" fill="black"/>';
  }).join('');
  if (!rects) return 'none';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + box.width + '" height="' + box.height + '" viewBox="0 0 ' + box.width + ' ' + box.height + '"><rect width="100%" height="100%" fill="white"/>' + rects + '</svg>';
  return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
}
// One native settings shell shared by every category; the local mount also
// supplies it in startup-only/standalone mode without enabling global appearance.
function saoSettingsHostCSS(host) {
  return `
${host}{--sao-settings-host-base:color-mix(in srgb,var(--dsw-alias-bg-base,Canvas) 86%,var(--dsw-alias-brand-primary,Highlight) 14%);--sao-settings-ink:var(--dsw-alias-label-primary,CanvasText);--sao-settings-line:color-mix(in srgb,var(--sao-settings-ink) 12%,transparent);--sao-settings-card:color-mix(in srgb,var(--sao-settings-host-base) 12%,transparent);--sao-settings-hover:color-mix(in srgb,var(--sao-settings-host-base) 22%,transparent);--sao-settings-selected:color-mix(in srgb,var(--dsw-alias-brand-primary,Highlight) 10%,color-mix(in srgb,var(--sao-settings-ink) 5%,transparent));--dsw-alias-settings-card-fill:var(--sao-settings-card);--dsw-alias-bg-layer-1:var(--sao-settings-card);--dsw-alias-bg-layer-2:var(--sao-settings-card);--dsw-alias-bg-layer-3:var(--sao-settings-card);--dsw-alias-bg-module-platform:var(--sao-settings-card);--dsw-alias-label-secondary:color-mix(in srgb,var(--sao-settings-ink) 88%,var(--dsw-alias-bg-base,Canvas));--dsw-alias-label-tertiary:var(--dsw-alias-label-secondary);--dsw-alias-border-l1:var(--sao-settings-line);--dsw-alias-border-l2:var(--sao-settings-line);color:var(--sao-settings-ink);isolation:isolate;border:0!important;border-radius:32px!important;corner-shape:round!important;background:transparent!important;box-shadow:0 24px 72px rgb(8 15 28 / .22),inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-label-primary,CanvasText) 9%,transparent)!important}
${host}::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;corner-shape:round;background:linear-gradient(135deg,rgb(255 255 255 / .12),transparent 30%,transparent 75%,rgb(255 255 255 / .04)),color-mix(in srgb,var(--sao-settings-host-base) calc(60% * var(--sao-settings-window-alpha,.8)),transparent)!important;backdrop-filter:var(--sao-settings-host-filter,blur(24px) saturate(1.12))!important;-webkit-backdrop-filter:var(--sao-settings-host-filter,blur(24px) saturate(1.12))!important;box-shadow:inset 0 1px 0 rgb(255 255 255 / .48),inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-label-primary,CanvasText) 8%,transparent)!important}
${host}>:is(div,main,section):has([data-slot="settings.section"],[data-sao-settings]),
${host} [data-slot="settings.section"],
${host} [data-slot="settings.section"]>:is(div,main,section,article){background:transparent!important;box-shadow:none!important}
${host}>nav{background:transparent!important;border-color:var(--sao-settings-line)}
${host}>nav button{border-radius:14px;corner-shape:round!important;color:var(--sao-settings-ink)}
${host}>nav button:hover{background:var(--sao-settings-hover)}
${host}>nav button[aria-current="true"]{background:var(--sao-settings-selected)!important;box-shadow:inset 0 0 0 1px var(--sao-settings-line);font-weight:600}
${host}>nav button:focus-visible{outline:2px solid color-mix(in srgb,var(--sao-settings-ink) 65%,var(--dsw-alias-bg-base,Canvas));outline-offset:-3px}
/* These verified native/plugin card roots use an opaque base instead of the
   settings layer tokens. Preserve their content, semantic borders and controls. */
${host} [data-slot="settings.section"] :is(.Wsg8iW_card,._2vuxea_group,.vr-ia-plugin-card,.VqXecW_installedSkeletonCard){background:var(--sao-settings-card)!important;border-radius:22px;corner-shape:round!important}
${host} [data-slot="settings.section"] .Wsg8iW_card.Wsg8iW_cardActive{background:var(--sao-settings-selected)!important}
/* The sticky market search must still mask scrolling content beneath it. */
${host} [data-slot="settings.section"] .nUhMVa_stickyHead,
${host} [data-slot="settings.section"] .nUhMVa_stickyHead::before{background:var(--sao-settings-host-base)!important}
`;
}
function mountSAOSettings(container, api) {
  'use strict';
  const doc = container.ownerDocument;
  const uid = 'sao-settings-' + Math.random().toString(36).slice(2, 10);
  const defaults = { featureMode: 'all', videoQuality: 'balanced', startup: true, voice: 'kirito', sound: true, volume: 0.65, theme: 'system', fontFamily: '方正兰亭圆_准', accent: '#8CC8F4', surfaceColor: null, windowOpacity: 1, composerOpacity: 0.90, componentOpacity: 0.90, conversationOpacity: 0.50, conversationBlur: 0, glass: 'liquid', opacity: 0.80, headerOpacity: 0.80, rightLinked: true, rightGlass: 'liquid', rightOpacity: 0.70, rightBlur: 0, contextGlass: 'follow', contextOpacity: .80, contextBlur: 0, headerLinked: true, rightHeaderOpacity: 0.80, wallpaper: 'builtin-3', wallpaperScope: 'full', wallOpacity: 1, wallX: 50, wallY: 50, wallScale: 100 };
  let prefs = Object.assign({}, defaults, api.get());
  let disposed = false, unsubscribe = null, pending = 0, operation = 0;
  let hue = 0, saturation = 0.8, brightness = 1, colorExpanded = false, hexDirty = false;
  let latestColor = undefined, activePointer = null, drawnBrightness = -1;
  const removers = [];
  const root = doc.createElement('div');
  root.setAttribute('data-sao-settings', '');
  root.setAttribute('lang', 'zh-CN');
  const style = doc.createElement('style');
  style.textContent = `
[data-sao-settings]{--sao-ink:var(--dsw-alias-label-primary,CanvasText);--sao-base:var(--dsw-alias-bg-base,Canvas);--sao-glass-base:color-mix(in srgb,var(--sao-base) 86%,var(--sao-accent) 14%);--sao-muted:color-mix(in srgb,var(--sao-ink) 88%,var(--sao-base));--sao-surface:color-mix(in srgb,var(--sao-glass-base) 14%,transparent);--sao-line:color-mix(in srgb,var(--sao-ink) 12%,transparent);--sao-edge:color-mix(in srgb,var(--sao-base) 48%,var(--sao-ink) 16%);--sao-glint:color-mix(in srgb,var(--sao-base) 55%,var(--sao-ink) 7%);--sao-radius-surface:22px;--sao-radius-control:16px;--sao-accent:var(--dsw-alias-brand-primary,Highlight);--sao-on-accent:var(--dsw-alias-label-on-brand,HighlightText);--sao-soft:color-mix(in srgb,var(--sao-accent) 9%,var(--sao-glass-base) 10%);--sao-hover:color-mix(in srgb,var(--sao-glass-base) 22%,transparent);--sao-pressed:color-mix(in srgb,var(--sao-ink) 8%,var(--sao-glass-base) 16%);--sao-active-ink:var(--sao-ink);--sao-mark:color-mix(in srgb,var(--sao-accent) 65%,var(--sao-ink));--sao-selected-line:var(--sao-line);--sao-track:color-mix(in srgb,var(--sao-accent) 60%,var(--sao-ink) 15%);--sao-mark-edge:var(--sao-line);--sao-focus:color-mix(in srgb,var(--sao-ink) 65%,var(--sao-base));color:var(--sao-ink);background:color-mix(in srgb,var(--sao-glass-base) 54%,transparent);border:1px solid var(--sao-edge);border-radius:28px;backdrop-filter:blur(24px) saturate(145%);-webkit-backdrop-filter:blur(24px) saturate(145%);box-shadow:inset 0 1px 0 var(--sao-glint),0 18px 52px color-mix(in srgb,var(--sao-ink) 10%,transparent);font:400 14px/1.6 var(--sao-font,system-ui),-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;padding:24px;box-sizing:border-box;min-width:0;max-width:1100px;margin-inline:auto;isolation:isolate}
[data-sao-settings] *,[data-sao-settings] *::before,[data-sao-settings] *::after{box-sizing:border-box}
[data-sao-settings] [hidden]{display:none!important}
[data-sao-settings] h2,[data-sao-settings] h3,[data-sao-settings] p{margin:0}
[data-sao-settings] button,[data-sao-settings] input,[data-sao-settings] select{font:inherit;color:inherit}
[data-sao-settings] button,[data-sao-settings] label,[data-sao-settings] input[type=range]{touch-action:manipulation}
[data-sao-settings] button{cursor:pointer}
[data-sao-settings] button:disabled,[data-sao-settings] input:disabled{cursor:wait;opacity:.58}
[data-sao-settings] [data-pref=rightHeaderOpacity]:disabled{cursor:not-allowed}
[data-sao-settings] :is(button,input,select,canvas):focus-visible{outline:2px solid var(--sao-focus);outline-offset:3px}
[data-sao-settings] .sao-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:22px}
[data-sao-settings] h2{font-size:22px;line-height:1.4;font-weight:600}
[data-sao-settings] .sao-tabs{margin-bottom:28px}
[data-sao-settings] .sao-tab{position:relative;z-index:1;min-width:0;min-height:44px;padding:9px 10px;border:0;border-radius:14px;background:transparent;box-shadow:none;color:var(--sao-muted);font-weight:500;transition:color .15s}
[data-sao-settings] .sao-tab:hover{background:var(--sao-hover);color:var(--sao-ink)}
[data-sao-settings] .sao-tab:active{background:var(--sao-pressed)}
[data-sao-settings] .sao-tab[aria-selected=true]{color:var(--sao-active-ink);background:transparent;font-weight:600;box-shadow:none}
[data-sao-settings] .sao-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(210px,260px);gap:28px;align-items:start}
[data-sao-settings] .sao-main{position:relative;min-width:0;container-type:inline-size;container-name:sao-settings-main}
/* Retain inactive panel layout caches without exposing or reserving their content. */
[data-sao-settings] [data-panel][hidden]{display:block!important;content-visibility:hidden;position:absolute;left:0;top:0;width:100%;height:0;overflow:hidden;visibility:hidden;pointer-events:none}
[data-sao-settings] .sao-section-head{margin-bottom:20px;padding:0;border:0}
[data-sao-settings] h3{font-size:16px;font-weight:600}
[data-sao-settings] .sao-row{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px 16px;padding:12px 0;border:0;background:transparent;box-shadow:none}
[data-sao-settings] .sao-row:first-of-type{padding-top:0}
[data-sao-settings] .sao-row-copy{min-width:0;flex:1 1 160px}
[data-sao-settings] .sao-row-controls{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px;margin-inline-start:auto}
[data-sao-settings] .sao-field-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 12px;width:100%}
[data-sao-settings] .sao-reset{flex:0 0 auto;min-height:36px;margin-inline-start:auto;padding:6px 8px;border:1px solid transparent;border-radius:var(--sao-radius-control);background:transparent;color:var(--sao-muted);font-size:12px;font-weight:400;white-space:nowrap}
[data-sao-settings] .sao-reset:hover{background:var(--sao-hover);color:var(--sao-active-ink)}
[data-sao-settings] :is(.sao-btn,.sao-reset):active:not(:disabled){background:var(--sao-pressed)}
[data-sao-settings] .sao-right-settings{margin-top:24px}
[data-sao-settings] .sao-row-title{display:block;font-weight:500}
[data-sao-settings] .sao-hint{display:block;color:var(--sao-muted);font-size:12px;line-height:1.6;margin-top:3px}
[data-sao-settings] .sao-switch{position:relative;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;min-width:48px;min-height:44px}
[data-sao-settings] .sao-switch input{position:absolute;opacity:0;width:44px;height:28px;margin:0;cursor:pointer}
[data-sao-settings] .sao-switch-track{width:44px;height:26px;border-radius:999px;corner-shape:round!important;background:color-mix(in srgb,var(--sao-ink) 30%,var(--sao-base));pointer-events:none;position:relative;border:1px solid transparent;transition:background .15s,border-color .15s}
[data-sao-settings] .sao-switch-track::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;corner-shape:round!important;background:var(--sao-base);transition:transform .15s,background .15s}
[data-sao-settings] .sao-switch input:checked + span{background:color-mix(in srgb,var(--sao-accent) 92%,black);border-color:var(--sao-mark)}
[data-sao-settings] .sao-switch input:checked + span::after{transform:translateX(18px);background:var(--sao-base)}
[data-sao-settings] .sao-switch input:focus-visible + span{outline:2px solid var(--sao-focus);outline-offset:4px}
[data-sao-settings] fieldset{border:1px solid var(--sao-line);border-radius:var(--sao-radius-surface);background:color-mix(in srgb,var(--sao-glass-base) 12%,transparent);box-shadow:inset 0 1px 0 var(--sao-glint);padding:16px;margin:20px 0;min-width:0}
[data-sao-settings] legend{float:left;padding:0;margin-bottom:12px;font-weight:600;width:100%;max-width:100%}
/* One glass shell, quiet grouped surfaces and neutral hairlines. The host may own the outer shell. */
[data-sao-settings] fieldset > legend + *{clear:both}
[data-sao-settings] fieldset::after{content:"";display:table;clear:both}
[data-sao-settings] .sao-font{padding:16px;border:1px solid var(--sao-line);border-radius:var(--sao-radius-surface);background:color-mix(in srgb,var(--sao-glass-base) 12%,transparent);box-shadow:inset 0 1px 0 var(--sao-glint)}
[data-sao-settings] .sao-feature-mode{margin:0 0 24px}
[data-sao-settings] :is(.sao-choices,.sao-mode-tabs,.sao-tabs){position:relative;display:grid;grid-template-columns:repeat(var(--sao-segment-count,2),minmax(0,1fr));align-items:stretch;gap:4px;width:100%;padding:5px;border:1px solid var(--sao-line);border-radius:20px;corner-shape:round!important;background:color-mix(in srgb,var(--sao-glass-base) 14%,transparent);box-shadow:inset 0 1px 0 var(--sao-glint);isolation:isolate}
[data-sao-settings] [data-sao-segment-thumb]{position:absolute;top:0;left:0;z-index:0;pointer-events:none;border-radius:14px;corner-shape:round!important;background:color-mix(in srgb,var(--sao-accent) 10%,color-mix(in srgb,var(--sao-ink) 5%,transparent));box-shadow:inset 0 0 0 1px var(--sao-line),inset 0 1px 0 var(--sao-glint);transform-origin:center}
[data-sao-settings] .sao-choice{position:relative;min-width:0;cursor:pointer}
[data-sao-settings] .sao-choice > input{position:absolute;appearance:none;inset:0;width:100%;height:100%;margin:0;opacity:0;border:0;background:transparent;box-shadow:none;z-index:2;cursor:pointer}
[data-sao-settings] .sao-choice > span{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:44px;border:0;border-radius:14px;background:transparent;box-shadow:none;padding:10px 8px;text-align:center;font-size:13px;line-height:1.5;overflow-wrap:anywhere;transition:background-color .15s,color .15s}
[data-sao-settings] [data-sao-segment] > .sao-choice{z-index:1}
[data-sao-settings] .sao-choice input:checked + span{color:var(--sao-ink)}
[data-sao-settings] .sao-choice input:checked + span strong{font-weight:600}
[data-sao-settings] .sao-choice:hover > span{background:var(--sao-hover)}
[data-sao-settings] .sao-choice:active > span{background:var(--sao-pressed)}
[data-sao-settings] [data-sao-segment] > .sao-choice input:checked + span,[data-sao-settings] .sao-tab[aria-selected=true]:hover,[data-sao-settings] .sao-tab[aria-selected=true]:active{background:transparent}
[data-sao-settings] .sao-choice input:focus-visible + span{outline:2px solid var(--sao-focus);outline-offset:-2px}
[data-sao-settings] .sao-choice strong{display:block;font-weight:500}
[data-sao-settings] .sao-choice small{display:block;font-size:12px;color:var(--sao-muted);margin-top:3px}
[data-sao-settings] .sao-choice input:checked + span small{color:inherit}
[data-sao-settings] .sao-switch-track{corner-shape:round!important}
[data-sao-settings] .sao-btn{min-height:44px;border:1px solid var(--sao-line);border-radius:var(--sao-radius-control);background:var(--sao-surface);color:var(--sao-ink);padding:8px 14px;font-weight:400;font-size:13px;box-shadow:inset 0 1px 0 var(--sao-glint);transition:background .15s,border-color .15s}
[data-sao-settings] .sao-btn:hover{background:var(--sao-hover);border-color:var(--sao-line)}
[data-sao-settings] .sao-btn-primary{background:var(--sao-soft);color:var(--sao-ink);border-color:var(--sao-line)}
[data-sao-settings] .sao-btn-primary:hover{background:var(--sao-hover)}
[data-sao-settings] .sao-actions{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:20px}
[data-sao-settings] .sao-startup-actions{column-gap:16px}
[data-sao-settings] .sao-skip-note{font-size:11px;line-height:1.5;color:var(--sao-muted);white-space:nowrap}
[data-sao-settings] .sao-font-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:8px 0}
[data-sao-settings] .sao-font-row input{flex:1 1 180px;min-width:0;min-height:44px;padding:8px 10px;border:1px solid var(--sao-line);border-radius:var(--sao-radius-control);background:var(--sao-surface)}
[data-sao-settings] .sao-range-row{display:grid;grid-template-columns:minmax(0,9em) minmax(80px,1fr) 4ch max-content;grid-template-areas:"label slider value reset";align-items:center;gap:0 10px;margin-top:8px;padding:4px 0;border:0;border-radius:0;background:transparent;box-shadow:none}
[data-sao-settings] .sao-range-row > label{grid-area:label;min-width:0;font-size:13px;line-height:1.5;overflow-wrap:anywhere}
[data-sao-settings] .sao-range-row > input[type=range]{grid-area:slider;min-width:0;min-height:44px}
[data-sao-settings] .sao-range-row > output{grid-area:value;justify-self:end;text-align:right;font-variant-numeric:tabular-nums;color:var(--sao-ink)}
[data-sao-settings] .sao-range-row > .sao-reset{grid-area:reset;min-height:44px;margin-inline-start:0;border-radius:var(--sao-radius-control)}
[data-sao-settings] output{font:12px ui-monospace,monospace;color:var(--sao-muted);white-space:nowrap}
[data-sao-settings] input[type=range]{width:100%;min-height:32px;accent-color:var(--sao-accent);cursor:pointer;margin:0}
[data-sao-settings] input[type=range][data-pref]{appearance:none;background:transparent}
[data-sao-settings] input[type=range][data-pref]::-webkit-slider-runnable-track{height:6px;border:1px solid var(--sao-line);border-radius:var(--sao-radius-control);background:linear-gradient(to right,var(--sao-track) var(--range-progress,0%),var(--sao-line) var(--range-progress,0%))}
[data-sao-settings] input[type=range][data-pref]::-webkit-slider-thumb{appearance:none;width:16px;height:16px;margin-top:-6px;border:1px solid var(--sao-line);border-radius:50%;background:color-mix(in srgb,var(--sao-base) 88%,var(--sao-ink));box-shadow:0 1px 4px color-mix(in srgb,var(--sao-ink) 18%,transparent)}
[data-sao-settings] input[type=range][data-pref]::-moz-range-track{height:6px;border:1px solid var(--sao-line);border-radius:var(--sao-radius-control);background:linear-gradient(to right,var(--sao-track) var(--range-progress,0%),var(--sao-line) var(--range-progress,0%))}
[data-sao-settings] input[type=range][data-pref]::-moz-range-thumb{width:14px;height:14px;border:1px solid var(--sao-line);border-radius:50%;background:color-mix(in srgb,var(--sao-base) 88%,var(--sao-ink));box-shadow:0 1px 4px color-mix(in srgb,var(--sao-ink) 18%,transparent)}
[data-sao-settings] .sao-swatches{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
[data-sao-settings] .sao-swatch{position:relative;display:inline-flex;min-width:44px;min-height:44px;justify-content:center;align-items:center;cursor:pointer}
[data-sao-settings] .sao-swatch input{position:absolute;opacity:0;width:38px;height:38px;margin:0;cursor:pointer}
[data-sao-settings] .sao-swatch-face{width:30px;height:30px;background:var(--swatch);border:1px solid var(--sao-line);border-radius:50%;position:relative;pointer-events:none;box-shadow:none}
[data-sao-settings] .sao-swatch input:checked + span{outline:none}
[data-sao-settings] .sao-swatch input:checked + span::after{content:"✓";position:absolute;right:-3px;bottom:-2px;width:14px;height:14px;display:grid;place-items:center;color:var(--sao-base);background:var(--sao-ink);border:1px solid color-mix(in srgb,var(--sao-base) 70%,transparent);border-radius:50%;font-size:10px;line-height:1}
[data-sao-settings] .sao-swatch input:focus-visible + span{outline:2px solid var(--sao-focus);outline-offset:4px}
[data-sao-settings] .sao-follow .sao-swatch-face{background:linear-gradient(135deg,var(--sao-base) 50%,var(--dsw-alias-brand-primary,Highlight) 50%)}
[data-sao-settings] .sao-rainbow{width:44px;height:44px;min-height:44px;border:1px solid var(--sao-line);border-radius:50%;background:var(--sao-surface);display:grid;place-items:center;padding:5px}
[data-sao-settings] .sao-rainbow::before{content:"";width:30px;height:30px;border-radius:50%;background:conic-gradient(#ef4444,#eacb37,#59b95c,#48bdc7,#6376d8,#ca62c7,#ef4444);box-shadow:none}
[data-sao-settings] .sao-rainbow[aria-expanded=true]{box-shadow:inset 0 0 0 1px var(--sao-ink);outline:none}
[data-sao-settings] .sao-current-color{margin-top:10px;font-size:12px;color:var(--sao-muted)}
[data-sao-settings] .sao-picker{padding:16px 0 0;border:0;border-top:1px solid var(--sao-line);border-radius:0;background:transparent;margin-top:14px;max-width:400px}
[data-sao-settings] .sao-picker-grid{display:grid;grid-template-columns:minmax(0,1fr) 42px;gap:14px;align-items:stretch}
[data-sao-settings] .sao-spectrum-wrap{position:relative;aspect-ratio:1;min-width:0}
[data-sao-settings] .sao-spectrum{width:100%;height:100%;display:block;border:1px solid var(--sao-line);border-radius:var(--sao-radius-control);touch-action:none;cursor:crosshair}
[data-sao-settings] .sao-color-marker{position:absolute;width:14px;height:14px;border:2px solid #fff;outline:1px solid #000;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}
[data-sao-settings] .sao-brightness{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0}
[data-sao-settings] .sao-brightness-track{position:relative;flex:1;width:32px;min-height:130px;border-radius:var(--sao-radius-control);overflow:hidden;border:1px solid var(--sao-line);background:linear-gradient(to top,#000,#fff)}
[data-sao-settings] .sao-brightness input{position:absolute;inset:0;writing-mode:vertical-lr;direction:rtl;width:100%;height:100%;margin:0;appearance:none;background:transparent;border:0;accent-color:var(--sao-accent);touch-action:none}
[data-sao-settings] .sao-brightness input::-webkit-slider-thumb{appearance:none;width:30px;height:8px;background:var(--sao-accent);border:2px solid var(--sao-on-accent);box-shadow:0 0 0 1px var(--sao-ink);border-radius:2px;cursor:ns-resize}
[data-sao-settings] .sao-brightness input::-moz-range-thumb{width:28px;height:6px;background:var(--sao-accent);border:2px solid var(--sao-on-accent);box-shadow:0 0 0 1px var(--sao-ink);border-radius:2px}
[data-sao-settings] .sao-brightness label{font-size:12px;color:var(--sao-muted)}
[data-sao-settings] .sao-brightness-track:focus-within{outline:3px solid var(--sao-focus);outline-offset:3px}
[data-sao-settings] .sao-hex-row{display:flex;gap:12px;align-items:center;margin-top:14px}
[data-sao-settings] .sao-hex-row label{font-size:12px;font-weight:400}
[data-sao-settings] .sao-hex-row input{min-width:0;width:100%;height:42px;border:1px solid var(--sao-line);border-radius:var(--sao-radius-control);background:var(--sao-surface);padding:8px 10px;font-family:ui-monospace,monospace;text-transform:uppercase}
[data-sao-settings] .sao-hex-row input[aria-invalid=true]{border-color:var(--sao-ink)}
[data-sao-settings] .sao-error{font-size:12px;color:var(--sao-ink);margin-top:7px}
[data-sao-settings] .sao-wall-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
[data-sao-settings] .sao-wall .sao-choice > span{display:block;padding:0;overflow:hidden;border:1px solid var(--sao-line)}
[data-sao-settings] .sao-wall .sao-choice input:checked + span{background:var(--sao-soft);box-shadow:inset 0 0 0 2px var(--sao-mark)}
[data-sao-settings] .sao-wall-art{display:block;aspect-ratio:16/9;background:var(--sao-surface);position:relative;overflow:hidden}
[data-sao-settings] .sao-wall-art img{display:block;width:100%;height:100%;object-fit:cover;position:absolute;inset:0}
[data-sao-settings] .sao-wall-art::after{content:"";position:absolute;inset:0;border-bottom:1px solid var(--sao-line);pointer-events:none}
[data-sao-settings] .sao-wall-name{display:block;padding:11px 8px;font-size:12px;font-weight:400;overflow-wrap:anywhere}
[data-sao-settings] .sao-none-art{background:repeating-conic-gradient(var(--sao-line) 0% 25%,var(--sao-base) 0% 50%) 50%/16px 16px;display:grid;place-items:center;color:var(--sao-muted);font-size:12px}
[data-sao-settings] .sao-upload{margin-top:20px;border:1px solid var(--sao-line);border-radius:var(--sao-radius-surface);padding:16px;background:color-mix(in srgb,var(--sao-glass-base) 12%,transparent);box-shadow:inset 0 1px 0 var(--sao-glint)}
[data-sao-settings] .sao-upload label{display:block;font-size:13px;font-weight:400;margin-bottom:8px}
[data-sao-settings] input[type=file]{max-width:100%;font-size:12px;min-height:40px}
[data-sao-settings] input[type=file]::file-selector-button{font:inherit;min-height:36px;margin-right:8px;background:var(--sao-soft);border:1px solid var(--sao-selected-line);border-radius:var(--sao-radius-control);padding:6px 10px;color:var(--sao-ink);cursor:pointer}
[data-sao-settings] .sao-fit{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:24px;padding:12px 0;border-bottom:1px solid var(--sao-line);font-size:13px}
[data-sao-settings] .sao-fit span:last-child{color:var(--sao-muted);font-size:12px}
[data-sao-settings] .sao-preview{padding:16px;border:1px solid var(--sao-line);border-radius:var(--sao-radius-surface);background:color-mix(in srgb,var(--sao-glass-base) 14%,transparent);box-shadow:inset 0 1px 0 var(--sao-glint);min-width:0}
[data-sao-settings] .sao-preview-label{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;font-size:12px;font-weight:500}
[data-sao-settings] .sao-live{font:12px ui-monospace,monospace;color:var(--sao-muted)}
[data-sao-settings] .sao-live::before{content:"";display:inline-block;width:5px;height:5px;background:var(--sao-accent);border-radius:50%;margin-right:5px;vertical-align:2px}
[data-sao-settings] .sao-scene{position:relative;height:228px;border-radius:var(--sao-radius-control);overflow:hidden;background:var(--sao-surface);border:1px solid var(--sao-line);isolation:isolate;display:flex;align-items:center;justify-content:center;padding:18px}
[data-sao-settings] .sao-scene-wall{position:absolute;inset:0;overflow:hidden;z-index:-1}
[data-sao-settings] .sao-scene-wall img{width:100%;height:100%;object-fit:cover;transform-origin:center;display:block}
[data-sao-settings] .sao-scene-conversation{position:absolute;inset:0;z-index:-1;pointer-events:none}
[data-sao-settings] .sao-mini{width:100%;max-width:220px;border:1px solid var(--sao-line);border-radius:var(--sao-radius-surface);box-shadow:0 8px 28px color-mix(in srgb,var(--sao-ink) 8%,transparent);padding:15px;position:relative;overflow:hidden;isolation:isolate}
[data-sao-settings] .sao-mini-surface{position:absolute;inset:0;z-index:-1;border-radius:inherit;pointer-events:none}
[data-sao-settings] .sao-mini[data-glass=liquid] .sao-mini-surface::before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(135deg,#ffffff1f,transparent 52%,#ffffff08);border-radius:inherit;opacity:var(--sao-preview-strength,0)}
[data-sao-settings] .sao-mini-title{display:flex;align-items:center;gap:7px;padding:2px 6px;border-radius:var(--sao-radius-control);font-size:12px;font-weight:500;position:relative}
[data-sao-settings] .sao-mini-mark{width:9px;height:9px;border-radius:2px;transform:rotate(45deg);background:var(--sao-mark);flex-shrink:0}
[data-sao-settings] .sao-mini-component{margin-top:10px;padding:6px 8px;border:1px solid var(--sao-line);border-radius:var(--sao-radius-control);position:relative}
[data-sao-settings] .sao-mini-line{height:5px;border-radius:var(--sao-radius-control);background:color-mix(in srgb,var(--sao-ink) 18%,transparent);width:86%}
[data-sao-settings] .sao-mini-line + .sao-mini-line{width:65%;margin-top:7px}
[data-sao-settings] .sao-mini-composer{height:27px;border:1px solid var(--sao-selected-line);border-radius:var(--sao-radius-control);margin-top:16px;padding-inline:10px;display:grid;align-items:center;font-size:10px;font-weight:400;color:var(--sao-muted);position:relative}
[data-sao-settings] .sao-preview-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
[data-sao-settings] .sao-preview-meta span{font-size:12px;color:var(--sao-muted);background:transparent}
[data-sao-settings] .sao-preview-note{margin-top:10px;font-size:12px;color:var(--sao-muted)}
[data-sao-settings] .sao-footer{border-top:1px solid var(--sao-line);padding-top:17px;margin-top:26px;display:flex;align-items:center;justify-content:space-between;gap:12px}
[data-sao-settings] .sao-status{font-size:12px;color:var(--sao-muted);overflow-wrap:anywhere}
[data-sao-settings] .sao-status[data-error=true]{color:var(--sao-ink)}
[data-sao-settings] .sao-footer .sao-btn{font-weight:400;font-size:12px;flex-shrink:0}
@container sao-settings (max-width:700px){[data-sao-settings] .sao-layout{grid-template-columns:minmax(0,1fr)}[data-sao-settings] .sao-preview{max-width:none}[data-sao-settings] .sao-scene{height:180px}[data-sao-settings] .sao-mini{max-width:230px}}
@container sao-settings-main (max-width:360px){[data-sao-settings] [data-sao-segment] .sao-choice > span{padding-inline:5px;font-size:12px}[data-sao-settings] .sao-choice small{font-size:12px}}
@container sao-settings-main (max-width:480px){[data-sao-settings] .sao-range-row{grid-template-columns:minmax(0,1fr) 4ch max-content;grid-template-areas:"label label reset" "slider slider value";column-gap:8px}}
[data-sao-settings]{container-type:inline-size;container-name:sao-settings}
@media(max-width:720px){[data-sao-settings]{padding:18px 16px}[data-sao-settings] .sao-layout{grid-template-columns:minmax(0,1fr);gap:24px}[data-sao-settings] .sao-scene{height:180px}[data-sao-settings] .sao-tab{flex:1;padding-inline:10px}[data-sao-settings] .sao-head{margin-bottom:16px}}
@media(prefers-reduced-motion:reduce){[data-sao-settings] *,[data-sao-settings] *::before,[data-sao-settings] *::after{transition:none!important;animation:none!important}}
/* Standalone/startup-only fallback; full appearance installs the same shell
   before any settings category has been opened. */
${saoSettingsHostCSS(':is(dialog,[role="dialog"])[data-shortcut-modal="settings"]:has([data-sao-settings])')}
:is(dialog,[role="dialog"])[data-shortcut-modal="settings"] [data-sao-settings]{background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;padding:8px 0 24px!important;margin:0!important}
:is(dialog,[role="dialog"])[data-shortcut-modal="settings"] [data-sao-settings] :is(fieldset,.sao-preview){backdrop-filter:none!important;-webkit-backdrop-filter:none!important}

`;
  root.appendChild(style);
  const view = doc.createElement('div');
  root.appendChild(view);
  const colorProbe = doc.createElement('span');
  colorProbe.hidden = true;
  colorProbe.setAttribute('aria-hidden', 'true');
  colorProbe.style.color = 'var(--sao-accent)';
  root.appendChild(colorProbe);
  function id(name) { return uid + '-' + name; }
  function resetSetting(name, label) {
    return `<button class="sao-reset" type="button" data-reset-setting="${name}" aria-label="恢复${label}默认">恢复默认</button>`;
  }
  function fieldLegend(name, label) {
    return `<legend><span class="sao-field-head"><span>${label}</span>${resetSetting(name, label)}</span></legend>`;
  }
  function range(name, label, min, max, unit) {
    return `<div class="sao-range-row"><label for="${id(name)}">${label}</label><input id="${id(name)}" data-pref="${name}" type="range" min="${min}" max="${max}" step="1"><output for="${id(name)}" data-output="${name}" data-unit="${unit}"></output>${resetSetting(name, label)}</div>`;
  }
  function toggle(name, label, hint) {
    return `<div class="sao-row"><div class="sao-row-copy"><label class="sao-row-title" for="${id(name)}">${label}</label><span class="sao-hint" id="${id(name)}-help">${hint}</span></div><div class="sao-row-controls"><label class="sao-switch"><input id="${id(name)}" type="checkbox" data-pref="${name}" aria-describedby="${id(name)}-help"><span class="sao-switch-track" aria-hidden="true"></span></label>${resetSetting(name, label)}</div></div>`;
  }
  function choice(name, value, title, detail) {
    return `<label class="sao-choice"><input type="radio" name="${id(name)}" data-pref="${name}" value="${value}"><span><strong>${title}</strong>${detail ? `<small>${detail}</small>` : ''}</span></label>`;
  }
  view.innerHTML = `
<header class="sao-head"><h2>SAO 设置</h2></header>
<div class="sao-tabs" role="tablist" aria-label="设置分类">
  <button class="sao-tab" type="button" role="tab" data-tab="startup" id="${id('tab-startup')}" aria-controls="${id('panel-startup')}" aria-selected="true">启动</button>
  <button class="sao-tab" type="button" role="tab" data-tab="appearance" id="${id('tab-appearance')}" aria-controls="${id('panel-appearance')}" aria-selected="false" tabindex="-1">外观</button>
  <button class="sao-tab" type="button" role="tab" data-tab="wallpaper" id="${id('tab-wallpaper')}" aria-controls="${id('panel-wallpaper')}" aria-selected="false" tabindex="-1">壁纸</button>
</div>
<div class="sao-layout"><div class="sao-main">
<section role="tabpanel" id="${id('panel-startup')}" aria-labelledby="${id('tab-startup')}" data-panel="startup">
  <div class="sao-section-head"><h3>启动</h3></div>
  <fieldset class="sao-feature-mode"><legend>功能模式</legend><div class="sao-mode-tabs" role="radiogroup" aria-label="功能模式">${choice('featureMode', 'all', '全部功能', '')}${choice('featureMode', 'startup-only', '仅限启动动画', '')}</div><p class="sao-hint">仅限启动动画时，保留当前其他主题的配色、字体和界面效果。</p></fieldset>
  ${toggle('startup', '启动时播放动画', '打开 DSH 时，自动播放 Link Start。')}
  <fieldset>${fieldLegend('voice', 'Link Start 语音')}<div class="sao-choices sao-compact-choices">${choice('voice', 'kirito', '桐人', '')}${choice('voice', 'asuna', '亚丝娜', '')}</div></fieldset>
  ${toggle('sound', '播放声音', '启动音效与角色语音。')}
  ${range('volume', '音量', 0, 100, '%')}
  <div class="sao-actions sao-startup-actions"><button class="sao-btn sao-btn-primary" data-action="preview" type="button" aria-describedby="${id('skip-note')}">预览启动动画</button><span class="sao-skip-note" id="${id('skip-note')}">点击任意地方跳过</span></div>
</section>
<section role="tabpanel" id="${id('panel-appearance')}" aria-labelledby="${id('tab-appearance')}" data-panel="appearance" hidden>
  <div class="sao-section-head"><h3>外观</h3></div>
  <fieldset>${fieldLegend('theme', '明暗模式')}<div class="sao-choices sao-theme-choices">${choice('theme', 'system', '跟随系统', '')}${choice('theme', 'light', '浅色', '')}${choice('theme', 'dark', '深色', '')}</div></fieldset>
  <div class="sao-font"><div class="sao-field-head"><label class="sao-row-title" for="${id('fontFamily')}">字体</label>${resetSetting('fontFamily', '字体')}</div><div class="sao-font-row"><input id="${id('fontFamily')}" type="text" data-pref="fontFamily" list="${id('local-fonts')}" autocomplete="off" spellcheck="false" placeholder="方正兰亭圆_准" aria-describedby="${id('font-help')} ${id('font-status')}"><button class="sao-btn" type="button" data-action="local-fonts">读取本地字体</button></div><datalist id="${id('local-fonts')}"></datalist><p class="sao-hint" id="${id('font-help')}">可手填本地字体族名称；读取列表需要字体访问权限。</p><p class="sao-hint" id="${id('font-status')}" role="status" aria-live="polite"></p></div>
  <fieldset>${fieldLegend('accent', '主题色')}<div class="sao-swatches" data-swatches role="radiogroup" aria-label="预设主题色"></div><p class="sao-current-color" data-color-label></p><p class="sao-hint">明亮与深色模式分别记忆主题色。</p>
    <div class="sao-picker" id="${id('picker')}" hidden>
      <div class="sao-picker-grid"><div class="sao-spectrum-wrap"><canvas class="sao-spectrum" width="256" height="256" tabindex="0" role="slider" aria-label="色相与饱和度" aria-valuemin="0" aria-valuemax="360" aria-valuenow="0" aria-describedby="${id('spectrum-help')}"></canvas><span class="sao-color-marker" aria-hidden="true"></span></div><div class="sao-brightness"><div class="sao-brightness-track"><input type="range" id="${id('brightness')}" min="0" max="100" step="1" value="100" aria-label="颜色明度" aria-orientation="vertical"></div><label for="${id('brightness')}">明度</label><output data-brightness-output>100%</output></div></div>
      <p class="sao-hint" id="${id('spectrum-help')}">横向选色相，纵向选饱和度。方向键微调，Shift 加速；右侧调整明度。</p>
      <div class="sao-hex-row"><label for="${id('hex')}">HEX</label><input id="${id('hex')}" type="text" inputmode="text" spellcheck="false" autocomplete="off" maxlength="7" aria-describedby="${id('hex-help')} ${id('hex-error')}" placeholder="#RRGGBB"></div><p class="sao-hint" id="${id('hex-help')}">输入完整六位色值，包含 #，例如 #000000 或 #FFFFFF。</p><p class="sao-error" id="${id('hex-error')}" role="status" aria-live="polite" hidden></p>
    </div>
  </fieldset>
  <fieldset data-surface-colors>${fieldLegend('surfaceColor', '界面底色')}<div class="sao-swatches" data-surface-swatches role="radiogroup" aria-label="界面底色预设"></div><p class="sao-current-color" data-surface-label></p><div data-surface-picker></div></fieldset>
  <p class="sao-hint">透明度：0% 完全不透明，100% 完全透明；透明端点关闭材质模糊与折光。会话背景、顶栏、输入框和内容组件独立调节。</p>
  ${range('windowOpacity', '全局窗口透明度', 0, 100, '%')}
  ${range('composerOpacity', '输入框透明度', 0, 100, '%')}
  ${range('componentOpacity', '内容组件透明度', 0, 100, '%')}
  <fieldset aria-describedby="${id('conversation-help')}"><legend>会话背景</legend><p class="sao-hint" id="${id('conversation-help')}">整面背景遮罩，独立于局部玻璃。右栏默认同步此处的透明度与模糊。</p>
    ${range('conversationOpacity', '会话背景透明度', 0, 100, '%')}
    ${range('conversationBlur', '会话背景模糊', 0, 24, 'px')}
  </fieldset>
  <fieldset>${fieldLegend('glass', '会话玻璃效果')}<div class="sao-choices sao-glass-choices">${choice('glass', 'off', '关闭', '清晰原色')}${choice('glass', 'frosted', '磨砂玻璃', '柔和模糊')}${choice('glass', 'liquid', '液态玻璃', '通透折光')}</div></fieldset>
  ${range('opacity', '表面透明度', 0, 100, '%')}
  <p class="sao-hint">表面透明度控制对话框、菜单及浮层背景；全局窗口透明度在此基础上继续减淡。顶栏、输入框和内容组件使用各自滑杆。液态会话顶栏初始透明度 20%，按材质单独记忆。</p>
  ${range('headerOpacity', '会话顶栏透明度', 0, 100, '%')}
  <div class="sao-right-settings">
    ${toggle('rightLinked', '右栏跟随会话', '同步会话背景的透明度、模糊和玻璃效果；关闭后显示右栏独立滑杆。上下文卡片和顶栏在下方单独调节。')}
    <div data-right-controls hidden>
      <fieldset>${fieldLegend('rightGlass', '右栏玻璃效果')}<div class="sao-choices sao-glass-choices">${choice('rightGlass', 'off', '关闭', '清晰原色')}${choice('rightGlass', 'frosted', '磨砂玻璃', '柔和模糊')}${choice('rightGlass', 'liquid', '液态玻璃', '通透折光')}</div></fieldset>
      ${range('rightOpacity', '右栏背景透明度', 0, 100, '%')}
      ${range('rightBlur', '右栏背景模糊', 0, 24, 'px')}
    </div>
    <fieldset>${fieldLegend('contextGlass', '上下文界面')}<p class="sao-hint">独立控制右栏上下文卡片，可比右栏背景更透明。每种材质单独记忆；液态初始透明度 20%、模糊 0px，磨砂初始透明度 35%。</p>
      <div class="sao-choices sao-compact-choices">${choice('contextGlass', 'follow', '跟随右栏', '')}${choice('contextGlass', 'frosted', '磨砂玻璃', '')}${choice('contextGlass', 'liquid', '液态玻璃', '')}${choice('contextGlass', 'off', '原始外观', '')}</div>
      ${range('contextOpacity', '上下文透明度', 0, 100, '%')}
      ${range('contextBlur', '上下文背景模糊', 0, 24, 'px')}
    </fieldset>
    ${toggle('headerLinked', '右栏顶栏跟随会话顶栏', '关闭后可单独设置右栏顶栏透明度。')}
    ${range('rightHeaderOpacity', '右栏顶栏透明度', 0, 100, '%')}
  </div>
</section>
<section role="tabpanel" id="${id('panel-wallpaper')}" aria-labelledby="${id('tab-wallpaper')}" data-panel="wallpaper" hidden>
  <div class="sao-section-head"><h3>壁纸</h3></div>
  <fieldset class="sao-wall">${fieldLegend('wallpaper', '壁纸')}<div class="sao-wall-grid" data-wall-grid></div></fieldset>
  <div class="sao-upload"><label for="${id('upload')}">上传自定义壁纸</label><input id="${id('upload')}" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm" aria-describedby="${id('upload-help')}"><p class="sao-hint" id="${id('upload-help')}">图片 ≤25 MB；MP4／WebM ≤200 MiB、30 秒，支持 4K／5K，长边 ≤5120、短边 ≤2880。自动保存到本机浏览器。</p><button class="sao-btn" data-action="remove-upload" type="button" hidden>删除自定义壁纸</button></div>
  <fieldset data-video-settings hidden>${fieldLegend('videoQuality', '视频播放')}<div class="sao-choices">${choice('videoQuality', 'balanced', '自动循环', '失焦或后台时暂停')}${choice('videoQuality', 'still', '静态省电', '仅显示视频封面')}</div><p class="sao-hint">原生静音循环；建议使用 24–30fps 的短循环。后台、失焦或壁纸不透明度为 0 时暂停；减少动态效果时仅显示封面并卸载视频源。玻璃折射使用缩小封面。</p><p class="sao-hint" data-video-status role="status" aria-live="polite"></p></fieldset>
  <fieldset aria-describedby="${id('wallpaper-scope-help')}">${fieldLegend('wallpaperScope', '壁纸显示范围')}<div class="sao-choices">${choice('wallpaperScope', 'full', '全界面', '覆盖会话与右侧栏')}${choice('wallpaperScope', 'conversation', '仅限会话', '会话填充 · 右栏纯色')}</div><p class="sao-hint" id="${id('wallpaper-scope-help')}">默认全界面，保留当前效果。仅限会话时，壁纸在会话区域居中填充，可继续调整位置与大小；右侧栏使用软件当前主题的界面底色，不显示壁纸。</p></fieldset>
  <div class="sao-fit"><span>适应方式</span><span>填充 · 默认</span></div>
  ${range('wallOpacity', '壁纸不透明度', 0, 100, '%')}
  ${range('wallX', '水平位置', 0, 100, '%')}
  ${range('wallY', '垂直位置', 0, 100, '%')}
  ${range('wallScale', '画面大小', 100, 250, '%')}
  <div class="sao-actions"><button class="sao-btn" type="button" data-action="reset-transform">重置位置与大小</button></div>
</section>
</div><aside class="sao-preview" aria-label="外观实时预览"><div class="sao-preview-label"><span>会话效果预览</span><span class="sao-live">实时</span></div><div class="sao-scene"><div class="sao-scene-wall" aria-hidden="true"><img alt="" hidden></div><div class="sao-scene-conversation" aria-hidden="true"></div><div class="sao-mini" data-glass="off"><div class="sao-mini-surface" aria-hidden="true"></div><div class="sao-mini-title"><span class="sao-mini-mark" aria-hidden="true"></span><span>Link Start</span></div><div class="sao-mini-component" role="img" aria-label="内容组件背景预览"><div class="sao-mini-line"></div><div class="sao-mini-line"></div></div><div class="sao-mini-composer">输入消息…</div></div></div><div class="sao-preview-meta"><span data-preview-glass></span><span data-preview-opacity></span><span data-preview-wall></span><span data-preview-wall-opacity></span></div><p class="sao-preview-note">所有设置即时生效。</p></aside></div>
<footer class="sao-footer"><p class="sao-status" role="status" aria-live="polite" aria-atomic="true" data-status></p><button class="sao-btn" type="button" data-action="reset">恢复默认设置</button></footer>`;
  container.appendChild(root);
  const find = selector => root.querySelector(selector);
  const all = selector => Array.from(root.querySelectorAll(selector));
  const controls = all('[data-pref]');
  const status = find('[data-status]'), hex = find('#' + id('hex'));
  const hexError = find('#' + id('hex-error'));
  const canvas = find('canvas'), marker = find('.sao-color-marker');
  const colorCanvas = doc.createElement('canvas');
  colorCanvas.width = colorCanvas.height = 1;
  const colorContext = colorCanvas.getContext('2d', { willReadFrequently: true });
  const brightnessInput = find('#' + id('brightness'));
  const picker = find('.sao-picker');
  const fontInput = find('#' + id('fontFamily'));
  const fontStatus = find('#' + id('font-status'));
  const presetColors = [
    [null, '跟随 DSH'], ['#D29A34', '琥珀金'], ['#3C8D83', '青碧'], ['#8CC8F4', '晴空蓝'], ['#8B6BB1', '紫藤'], ['#C76C78', '蔷薇'], ['#3B4252', '石墨']
  ];
  const swatches = find('[data-swatches]');
  const presetInputs = [];
  for (const [value, name] of presetColors) {
    const label = doc.createElement('label');
    label.className = 'sao-swatch' + (value === null ? ' sao-follow' : '');
    label.title = value === null ? '跟随 DSH 主题' : name + ' ' + value;
    const input = doc.createElement('input');
    input.type = 'radio'; input.name = id('accent'); input.value = value || 'default';
    input.setAttribute('aria-label', label.title);
    const face = doc.createElement('span'); face.className = 'sao-swatch-face'; face.setAttribute('aria-hidden', 'true');
    if (value) face.style.setProperty('--swatch', value);
    label.append(input, face); swatches.appendChild(label); presetInputs.push({ input, value });
  }
  const rainbow = doc.createElement('button');
  rainbow.className = 'sao-rainbow'; rainbow.type = 'button'; rainbow.title = '自定义主题色';
  rainbow.setAttribute('aria-label', '展开自定义颜色选择器'); rainbow.setAttribute('aria-expanded', 'false'); rainbow.setAttribute('aria-controls', id('picker'));
  swatches.appendChild(rainbow);
  const wallCards = new Map();
  function on(target, event, fn, options) {
    target.addEventListener(event, fn, options);
    removers.push(() => target.removeEventListener(event, fn, options));
  }
  // Native radio groups keep keyboard/form semantics; one shared surface moves
  // beneath their labels. The final position never depends on animation events.
  const reducedSegments = doc.defaultView.matchMedia('(prefers-reduced-motion: reduce)');
  const segmentGroups = all('.sao-choices,.sao-mode-tabs,.sao-tabs').map(group => {
    const items = Array.from(group.children);
    const key = group.querySelector('[data-pref]')?.dataset.pref || 'settings-tabs';
    group.dataset.saoSegment = key;
    if (key !== 'settings-tabs') {
      group.setAttribute('role', 'radiogroup');
      const field = group.closest('fieldset');
      group.setAttribute('aria-label', (field?.querySelector('.sao-field-head > span') || field?.querySelector('legend'))?.textContent.trim() || key);
    }
    const thumb = doc.createElement('span');
    thumb.setAttribute('data-sao-segment-thumb', ''); thumb.setAttribute('aria-hidden', 'true'); thumb.hidden = true;
    group.appendChild(thumb);
    return {group, items, options: items.map(item => ({item, input: item.querySelector('input')})), thumb, count: -1, geometry: null, selected: null, box: null, motion: null};
  });
  let segmentMeasureFrame = 0;
  function syncSegments(animate = true, measure = true) {
    if (disposed) return;
    let needsMeasurement = false;
    // Geometry changes on resize/reveal, not on every selection or save callback.
    // Avoid even identical custom-property writes: they invalidate inherited style.
    for (const state of segmentGroups) {
      const count = state.items.filter(item => !item.hidden).length;
      if (state.count !== count) { state.count = count; state.geometry = null; state.group.style.setProperty('--sao-segment-count', String(count)); }
    }
    const measurements = segmentGroups.map(state => {
      const selected = state.options.find(({item, input}) => input ? input.checked : item.getAttribute('aria-selected') === 'true')?.item;
      if (!selected || state.group.closest('[hidden]')) return {state, selected, box: null};
      if (!state.geometry) {
        if (!measure) { needsMeasurement = true; return {state, selected, box: null}; }
        state.geometry = new Map(state.items.map(item => [item, {x: item.offsetLeft, y: item.offsetTop, width: item.offsetWidth, height: item.offsetHeight}]));
      }
      const box = state.geometry.get(selected);
      return {state, selected, box: box?.width > 0 && box.height > 0 ? box : null,
        transform: state.motion && state.selected !== selected ? doc.defaultView.getComputedStyle(state.thumb).transform : null};
    });
    for (const {state, selected, box, transform} of measurements) {
      const {thumb} = state, previous = state.box;
      if (!box) {
        state.motion?.cancel(); state.motion = null; state.box = null; state.selected = null; if (!thumb.hidden) thumb.hidden = true;
        continue;
      }
      if (previous && state.selected === selected && Object.keys(box).every(key => Math.abs(box[key] - previous[key]) < .1)) continue;
      const move = animate && previous && state.selected !== selected && !reducedSegments.matches && typeof thumb.animate === 'function';
      let fromX = previous?.x || 0, fromY = previous?.y || 0;
      if (transform && transform !== 'none' && doc.defaultView.DOMMatrixReadOnly) {
        const current = new doc.defaultView.DOMMatrixReadOnly(transform); fromX = current.m41; fromY = current.m42;
      }
      state.motion?.cancel(); state.motion = null;
      const final = 'translate3d(' + box.x + 'px,' + box.y + 'px,0)';
      thumb.hidden = false; thumb.style.width = box.width + 'px'; thumb.style.height = box.height + 'px'; thumb.style.transform = final;
      state.box = box; state.selected = selected;
      if (move) {
        // Translation only: keep the selected surface on the compositor, with
        // no stretch/overshoot or size animation during repeated selections.
        const motion = thumb.animate([
          {transform: 'translate3d(' + fromX + 'px,' + fromY + 'px,0)', offset: 0},
          {transform: final, offset: 1}
        ], {duration: 220, easing: 'cubic-bezier(.4,0,.2,1)'});
        state.motion = motion;
        motion.onfinish = () => { if (state.motion === motion) state.motion = null; };
      }
    }
    if (needsMeasurement && !segmentMeasureFrame) segmentMeasureFrame = doc.defaultView.requestAnimationFrame(() => { segmentMeasureFrame = 0; syncSegments(false); });
  }
  on(reducedSegments, 'change', () => {
    for (const state of segmentGroups) { state.motion?.cancel(); state.motion = null; }
    syncSegments(false);
  });
  const segmentOwners = new WeakMap();
  const segmentResizeObserver = typeof doc.defaultView.ResizeObserver === 'function' ? new doc.defaultView.ResizeObserver(entries => {
    for (const entry of entries) { const state = segmentOwners.get(entry.target); if (state) state.geometry = null; }
    syncSegments(false);
  }) : null;
  for (const state of segmentGroups) for (const element of [state.group, ...state.items]) { segmentOwners.set(element, state); segmentResizeObserver?.observe(element); }
  on(doc.defaultView, 'resize', () => { for (const state of segmentGroups) state.geometry = null; syncSegments(false); });
  function announce(text, error) {
    if (disposed) return;
    if (status.textContent !== text) status.textContent = text;
    const flag = error ? 'true' : 'false'; if (status.dataset.error !== flag) status.dataset.error = flag;
  }
  function readStatus() {
    try { return typeof api.status === 'function' ? api.status() : ''; } catch (_) { return ''; }
  }
  function saved() { announce(readStatus() || '已保存 · 所有更改即时生效', false); }
  function readPrefs() { return Object.assign({}, defaults, api.get()); }
  function messageFor(error) { return error && error.message ? error.message : String(error || '请重试'); }
  async function run(action, label, button) {
    const ticket = ++operation;
    pending++;
    if (button) button.disabled = true;
    announce(label + '…', false);
    try {
      await action();
      if (disposed) return;
      prefs = readPrefs(); sync();
      if (ticket === operation) saved();
    } catch (error) {
      if (!disposed) {
        prefs = readPrefs(); sync();
        announce(label + '失败：' + messageFor(error), true);
      }
    } finally {
      pending--;
      if (!disposed && button) button.disabled = false;
    }
  }
  function apply(patch) {
    if (disposed) return;
    prefs = Object.assign({}, prefs, patch);
    sync();
    return run(() => api.set(patch), '正在保存');
  }
  function rgbFromHSV(h, s, v) {
    const f = n => { const k = (n + h / 60) % 6; return Math.round(255 * v * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)))); };
    return [f(5), f(3), f(1)];
  }
  function hexFromHSV() { return '#' + rgbFromHSV(hue, saturation, brightness).map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase(); }
  function hsvFromHex(value) {
    const rgb = [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16) / 255);
    const max = Math.max(...rgb), min = Math.min(...rgb), d = max - min;
    if (d) {
      const index = rgb.indexOf(max);
      hue = ((index === 0 ? (rgb[1] - rgb[2]) / d : index === 1 ? (rgb[2] - rgb[0]) / d + 2 : (rgb[0] - rgb[1]) / d + 4) * 60 + 360) % 360;
    }
    saturation = max ? d / max : saturation;
    brightness = max;
  }
  function drawColor() {
    const ctx = canvas.getContext('2d');
    if (ctx && drawnBrightness !== brightness) {
      drawnBrightness = brightness;
      const size = canvas.width, data = ctx.createImageData(size, size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const pixel = (y * size + x) * 4;
        const rgb = rgbFromHSV(x / (size - 1) * 360, 1 - y / (size - 1), brightness);
        data.data[pixel] = rgb[0]; data.data[pixel + 1] = rgb[1]; data.data[pixel + 2] = rgb[2]; data.data[pixel + 3] = 255;
      }
      ctx.putImageData(data, 0, 0);
    }
    marker.style.left = (hue / 360 * 100) + '%'; marker.style.top = ((1 - saturation) * 100) + '%';
    canvas.setAttribute('aria-valuenow', String(Math.round(hue)));
    canvas.setAttribute('aria-valuetext', `色相 ${Math.round(hue)} 度，饱和度 ${Math.round(saturation * 100)}%，明度 ${Math.round(brightness * 100)}%，${hexFromHSV()}`);
    brightnessInput.value = String(Math.round(brightness * 100));
    find('[data-brightness-output]').textContent = Math.round(brightness * 100) + '%';
    find('.sao-brightness-track').style.background = 'linear-gradient(to top,#000,rgb(' + rgbFromHSV(hue, saturation, 1).join(',') + '))';
  }
  function clearHexError() { hexError.hidden = true; hexError.textContent = ''; hex.removeAttribute('aria-invalid'); }
  function colorChanged() {
    hexDirty = false; clearHexError();
    const value = hexFromHSV(); latestColor = value; hex.value = value;
    drawColor(); apply({ accent: value });
  }
  function validateHex(showError) {
    const value = hex.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      clearHexError(); hexDirty = false;
      const exact = value.toUpperCase(); hsvFromHex(exact); latestColor = exact;
      drawColor();
      if (prefs.accent !== exact) apply({ accent: exact });
      return true;
    }
    if (showError) {
      hex.setAttribute('aria-invalid', 'true'); hexError.textContent = '请输入 # 加六位十六进制色值（0–9、A–F），例如 #12ABEF。'; hexError.hidden = false;
    }
    return false;
  }
  function wallpapers() { return Array.isArray(api.wallpapers) ? api.wallpapers : []; }
  function ensureWallCards() {
    const available = wallpapers();
    const items = [{ id: 'none', name: '无壁纸', src: '' }];
    const seen = new Set(['none']);
    for (const item of available) {
      if (item && typeof item.id === 'string' && item.id.startsWith('builtin-') && !seen.has(item.id)) {
        items.push(item); seen.add(item.id);
      }
    }
    const custom = available.find(w => w.id === 'custom');
    if (custom || prefs.wallpaper === 'custom') items.push(custom || { id: 'custom', name: '自定义壁纸', src: '' });
    for (const item of items) {
      let card = wallCards.get(item.id);
      if (!card) {
        const label = doc.createElement('label'); label.className = 'sao-choice';
        const input = doc.createElement('input'); input.type = 'radio'; input.name = id('wallpaper'); input.value = item.id;
        const content = doc.createElement('span');
        const art = doc.createElement('span'); art.className = 'sao-wall-art' + (item.id === 'none' ? ' sao-none-art' : '');
        if (item.id === 'none') art.textContent = '无壁纸';
        const image = doc.createElement('img'); image.alt = ''; image.loading = 'lazy'; image.hidden = true;
        art.appendChild(image);
        const title = doc.createElement('span'); title.className = 'sao-wall-name';
        content.append(art, title); label.append(input, content); find('[data-wall-grid]').appendChild(label);
        card = { label, input, image, title }; wallCards.set(item.id, card);
        on(input, 'change', () => { if (input.checked) apply({ wallpaper: input.value }); });
      }
      card.label.hidden = false; card.input.checked = prefs.wallpaper === item.id;
      card.title.textContent = item.name || (item.id === 'custom' ? '自定义壁纸' : item.id);
      if (item.src) { if (card.image.getAttribute('src') !== item.src) card.image.src = item.src; card.image.hidden = false; }
      else { card.image.hidden = true; card.image.removeAttribute('src'); }
    }
    const activeIds = new Set(items.map(item => item.id));
    for (const [key, card] of wallCards) card.label.hidden = !activeIds.has(key);
    find('[data-action="remove-upload"]').hidden = !custom && prefs.wallpaper !== 'custom';
  }
  function syncAccent() {
    const custom = /^#[\da-f]{6}$/i.test(prefs.accent || '') ? prefs.accent.toUpperCase() : null;
    paintStyle(root, '--sao-accent', custom);
    // Resolve inherited DSH colors through CSS, including rgb(), oklch() and variable aliases.
    let accent = custom;
    if (!accent && colorContext && doc.defaultView) {
      colorContext.clearRect(0, 0, 1, 1);
      colorContext.fillStyle = doc.defaultView.getComputedStyle(colorProbe).color;
      colorContext.fillRect(0, 0, 1, 1);
      accent = '#' + Array.from(colorContext.getImageData(0, 0, 1, 1).data).slice(0, 3).map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
    }
    if (accent) {
      const rgb = [1, 3, 5].map(i => parseInt(accent.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4));
      const light = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
      paintStyle(root, '--sao-on-accent', light > .179 ? '#000000' : '#FFFFFF');
    } else paintStyle(root, '--sao-on-accent', null);
    find('[data-color-label]').textContent = custom ? '当前主题色 ' + custom : '跟随 DSH 主题色';
    if (accent && accent !== latestColor) {
      latestColor = accent; hsvFromHex(accent);
      if (!hexDirty && doc.activeElement !== hex) hex.value = accent;
      if (colorExpanded) drawColor();
    }
  }
  const previewNodes = {panel: find('.sao-preview'), conversation: find('.sao-scene-conversation'), mini: find('.sao-mini'), surface: find('.sao-mini-surface'),
    children: [['.sao-mini-title', 'headerOpacity'], ['.sao-mini-composer', 'composerOpacity'], ['.sao-mini-component', 'componentOpacity']].map(([selector, key]) => ({element: find(selector), key}))};
  const paintStyles = new WeakMap();
  let previewNeedsGeometry = true;
  function paintStyle(element, property, value) {
    let previous = paintStyles.get(element);
    if (!previous) { previous = new Map(); paintStyles.set(element, previous); }
    if (previous.get(property) === value) return;
    previous.set(property, value);
    if (value === null) element.style.removeProperty(property); else element.style.setProperty(property, value);
  }
  // Observe only this settings component; never inspect conversation contents.
  function syncPreview(resized = false) {
    if (disposed) return;
    if (resized) previewNeedsGeometry = true;
    const {panel, conversation, mini, surface, children} = previewNodes;
    if (panel.hidden) { previewNeedsGeometry = true; return; }
    const paint = (element, opacity) => {
      const value = saoPreviewSurface(opacity, prefs.conversationBlur, prefs.glass);
      paintStyle(element, 'background', 'color-mix(in srgb,var(--sao-base) ' + value.alpha * 100 + '%,transparent)');
      paintStyle(element, 'backdrop-filter', value.filter); paintStyle(element, '-webkit-backdrop-filter', value.filter);
      return value;
    };
    paint(conversation, prefs.conversationOpacity);
    const value = paint(surface, prefs.opacity * prefs.windowOpacity);
    if (mini.dataset.glass !== prefs.glass) mini.dataset.glass = prefs.glass;
    paintStyle(surface, '--sao-preview-strength', String(value.strength));
    paintStyle(mini, 'box-shadow', '0 8px 28px color-mix(in srgb,var(--sao-ink) ' + 8 * value.strength + '%,transparent)');
    for (const {element, key} of children) paint(element, prefs[key]);
    if (!previewNeedsGeometry) return;
    previewNeedsGeometry = false;
    // Read every box before writing either mask, so one preview update cannot
    // force a separate style/layout pass for each nested sample.
    const roundedBox = element => {
      const box = element.getBoundingClientRect();
      return {left:box.left, top:box.top, width:box.width, height:box.height, radius:parseFloat(doc.defaultView.getComputedStyle(element).borderTopLeftRadius) || 0};
    };
    const conversationBox = conversation.getBoundingClientRect(), surfaceBox = surface.getBoundingClientRect();
    const miniBox = roundedBox(mini), childBoxes = children.map(({element}) => roundedBox(element));
    const mask = (element, box, holes) => {
      const image = saoPreviewHoleMask(box, holes);
      for (const property of ['mask-image', '-webkit-mask-image']) paintStyle(element, property, image);
      for (const [property, value] of [['mask-mode','luminance'], ['mask-size','100% 100%'], ['mask-repeat','no-repeat'], ['-webkit-mask-size','100% 100%'], ['-webkit-mask-repeat','no-repeat']]) paintStyle(element, property, value);
    };
    // Remove both ancestor fills below each sample, rather than stacking raw alpha.
    mask(conversation, conversationBox, [miniBox]); mask(surface, surfaceBox, childBoxes);
  }
  const startupKeys = new Set(['startup', 'voice', 'sound', 'volume']);
  const paletteKeys = new Set(['accent', 'accentProfiles', 'theme']);
  let syncedPreferences = '', syncedTheme = '', syncedWalls = [], syncedAppearancePreferences = '', syncedMaterialPreferences = '';
  function syncVideoSettings(available) {
    const activeWall = available.find(item => item.id === prefs.wallpaper), videoSettings = find('[data-video-settings]');
    const show = activeWall?.kind === 'video';
    if (!show && videoSettings.contains(doc.activeElement)) find('#' + id('upload')).focus();
    if (videoSettings.hidden === show) videoSettings.hidden = !show;
    const vs = api.videoStatus;
    const message = vs?.reason === 'error' ? '视频播放失败，正在显示静态封面。' : vs?.state === 'playing' ? '正在静音循环播放' : vs?.reason === 'still' ? '静态省电：视频源已卸载' : vs?.reason === 'reduced-motion' ? '减少动态效果：显示静态封面' : vs?.state === 'paused' ? '已暂停：显示静态封面' : '';
    const status = find('[data-video-status]'); if (status.textContent !== message) status.textContent = message;
  }
  function sync() {
    if (disposed) return;
    const available = wallpapers();
    // Notifications can change playback/hydrated assets without changing prefs.
    // Keep these lightweight updates, but don't replay the entire form for the
    // optimistic write, synchronous storage notification and promise completion.
    syncVideoSettings(available);
    const signature = JSON.stringify(prefs);
    const theme = [doc.body?.getAttribute('data-ds-dark-theme'), doc.documentElement.getAttribute('data-theme'), doc.documentElement.getAttribute('class')].join('|');
    const wallKeys = ['id', 'name', 'src', 'kind', 'meta'];
    const sameWalls = available.length === syncedWalls.length && available.every((wall, index) => wallKeys.every(key => wall[key] === syncedWalls[index][key]));
    if (signature === syncedPreferences && theme === syncedTheme && sameWalls) return;
    const appearanceSignature = JSON.stringify(prefs, (key, value) => startupKeys.has(key) ? undefined : value);
    const startupChange = appearanceSignature === syncedAppearancePreferences && theme === syncedTheme && sameWalls;
    const materialSignature = JSON.stringify(prefs, (key, value) => paletteKeys.has(key) ? undefined : value);
    const paletteChange = materialSignature === syncedMaterialPreferences && sameWalls;
    const themeChanged = theme !== syncedTheme;
    syncedPreferences = signature; syncedTheme = theme; syncedAppearancePreferences = appearanceSignature; syncedMaterialPreferences = materialSignature;
    syncedWalls = available.map(wall => Object.fromEntries(wallKeys.map(key => [key, wall[key]])));
    if (startupChange) {
      for (const input of controls) {
        const key = input.dataset.pref;
        if (!startupKeys.has(key)) continue;
        if (input.type === 'checkbox') input.checked = !!prefs[key];
        else if (input.type === 'radio') input.checked = String(prefs[key]) === input.value;
        else { input.value = String(Math.round(prefs[key] * 100)); paintStyle(input, '--range-progress', input.value + '%'); }
      }
      const volume = find('[data-pref="volume"]'), disabled = !prefs.sound;
      if (volume.disabled !== disabled) volume.disabled = disabled;
      if (volume.getAttribute('aria-disabled') !== String(disabled)) volume.setAttribute('aria-disabled', String(disabled));
      const output = find('[data-output="volume"]'), value = Math.round(prefs.volume * 100) + (output.dataset.unit || '%');
      if (output.textContent !== value) output.textContent = value;
      syncSegments(); return;
    }
    if (paletteChange) {
      // Palette changes do not alter wallpaper, opacity, masks or form layout.
      // Updating those again only makes the whole settings page repaint twice.
      for (const input of themeControls) input.checked = prefs.theme === input.value;
      for (const item of presetInputs) item.input.checked = item.value === prefs.accent;
      syncAccent();
      if (themeChanged) surfacePicker.sync();
      syncSegments(); return;
    }
    const startupOnly = prefs.featureMode === 'startup-only';
    for (const tab of all('[data-tab]')) tab.hidden = startupOnly && tab.dataset.tab !== 'startup';
    if (startupOnly && find('[data-tab="startup"]').getAttribute('aria-selected') !== 'true') selectTab(find('[data-tab="startup"]'));
    find('.sao-preview').hidden = startupOnly;
    surfacePicker.sync();
    for (const input of controls) {
      const key = input.dataset.pref;
      const value = key === 'rightHeaderOpacity' && prefs.headerLinked ? prefs.headerOpacity : prefs[key];
      if (input.type === 'checkbox') input.checked = !!value;
      else if (input.type === 'radio') input.checked = String(value) === input.value;
      else if (key !== 'fontFamily' || doc.activeElement !== input) input.value = String(key === 'opacity' || key === 'rightOpacity' || key === 'contextOpacity' || key === 'windowOpacity' || key === 'composerOpacity' || key === 'componentOpacity' || key === 'headerOpacity' || key === 'rightHeaderOpacity' || key === 'conversationOpacity' ? Math.round((1 - Number(value)) * 100) : key === 'volume' || key === 'wallOpacity' ? Math.round(Number(value) * 100) : value);
      if (input.type === 'range') input.style.setProperty('--range-progress', ((Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100) + '%');
    }
    for (const output of all('[data-output]')) {
      const key = output.dataset.output;
      const value = key === 'rightHeaderOpacity' && prefs.headerLinked ? prefs.headerOpacity : prefs[key];
      output.textContent = (key === 'opacity' || key === 'rightOpacity' || key === 'contextOpacity' || key === 'windowOpacity' || key === 'composerOpacity' || key === 'componentOpacity' || key === 'headerOpacity' || key === 'rightHeaderOpacity' || key === 'conversationOpacity' ? Math.round((1 - Number(value)) * 100) : key === 'volume' || key === 'wallOpacity' ? Math.round(value * 100) : value) + (output.dataset.unit || '%');
    }
    find('[data-right-controls]').hidden = !!prefs.rightLinked;
    const materialNames = {off: '无玻璃', frosted: '磨砂玻璃', liquid: '液态玻璃'};
    const rightMaterial = materialNames[prefs.rightGlass] || '液态玻璃';
    const contextMode = prefs.contextGlass === 'follow' ? (prefs.rightLinked ? prefs.glass : prefs.rightGlass) : prefs.contextGlass;
    const contextMaterial = materialNames[contextMode] || '液态玻璃';
    for (const key of ['rightOpacity', 'rightBlur', 'contextOpacity', 'contextBlur']) {
      const initial = typeof api.getDefault === 'function' ? api.getDefault(key) : key === 'rightOpacity' ? prefs.rightGlass === 'liquid' ? .70 : .50 : key === 'contextOpacity' ? contextMode === 'frosted' ? .65 : .80 : 0;
      const value = key.endsWith('Opacity') ? Math.round((1 - initial) * 100) + '%' : initial + 'px';
      const label = key === 'contextOpacity' ? '上下文透明度' : key === 'contextBlur' ? '上下文背景模糊' : key === 'rightOpacity' ? '右栏背景透明度' : '右栏背景模糊';
      const reset = find('[data-reset-setting="' + key + '"]');
      const material = key.startsWith('context') ? contextMaterial : rightMaterial;
      reset.title = '恢复' + material + '默认：' + value;
      reset.setAttribute('aria-label', '恢复' + material + label + '默认（' + value + '）');
    }
    const rightHeader = find('[data-pref="rightHeaderOpacity"]');
    rightHeader.disabled = !!prefs.headerLinked; rightHeader.setAttribute('aria-disabled', String(!!prefs.headerLinked));
    const volume = find('[data-pref="volume"]');
    volume.disabled = !prefs.sound; volume.setAttribute('aria-disabled', String(!prefs.sound));
    for (const item of presetInputs) item.input.checked = item.value === prefs.accent;
    syncAccent();
    ensureWallCards();
    const requestedFamily = String(prefs.fontFamily || defaults.fontFamily).trim();
    const family = requestedFamily === '方正兰亭圆_准' ? 'SAO Local Rounded' : requestedFamily;
    paintStyle(root, 'font-family', startupOnly ? 'inherit' : '"' + family.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '",system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif');
    syncPreview();
    const wall = wallpapers().find(item => item.id === prefs.wallpaper);
    const previewImage = find('.sao-scene-wall img');
    find('.sao-scene-wall').style.opacity = String(Math.max(0, Math.min(1, Number(prefs.wallOpacity))));
    if (wall && wall.src && prefs.wallpaper !== 'none') {
      if (previewImage.getAttribute('src') !== wall.src) previewImage.src = wall.src;
      previewImage.hidden = false;
      previewImage.style.objectPosition = prefs.wallX + '% ' + prefs.wallY + '%';
      previewImage.style.transform = 'scale(' + prefs.wallScale / 100 + ')';
      previewImage.style.transformOrigin = '50% 50%';
    } else { previewImage.hidden = true; previewImage.removeAttribute('src'); }
    find('[data-preview-glass]').textContent = { off: '无玻璃', frosted: '磨砂玻璃', liquid: '液态玻璃' }[prefs.glass] || '无玻璃';
    find('[data-preview-opacity]').textContent = '透明度 ' + Math.round((1 - Number(prefs.opacity)) * 100) + '%';
    find('[data-preview-wall]').textContent = prefs.wallpaper === 'none' ? '无壁纸' : wall ? wall.name || '已选壁纸' : '已选壁纸';
    find('[data-preview-wall-opacity]').textContent = '背景 ' + Math.round(prefs.wallOpacity * 100) + '% · ' + (prefs.wallpaperScope === 'conversation' ? '仅限会话' : '全界面');
    syncSegments();
  }
  const tabs = all('[data-tab]');
  function selectTab(tab, focus) {
    if (tab.getAttribute('aria-selected') === 'true') { if (focus) tab.focus(); return; }
    for (const button of tabs) {
      const selected = button === tab;
      if (button.getAttribute('aria-selected') !== String(selected)) { button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1; }
    }
    // Start the cached navigation motion before changing panel layout. Newly
    // revealed groups are measured by ResizeObserver after the browser's own
    // layout, before paint, rather than forcing it inside the click handler.
    syncSegments();
    for (const section of all('[data-panel]')) { const hidden = section.dataset.panel !== tab.dataset.tab; if (section.hidden !== hidden) section.hidden = hidden; }
    // Retained equal-size content may not emit a resize notification on reveal.
    // Restore cached thumbs now; only missing geometry needs a measured frame.
    syncSegments(false, !segmentResizeObserver);
    if (focus) tab.focus();
  }
  for (const tab of tabs) {
    on(tab, 'click', () => selectTab(tab, false));
    on(tab, 'keydown', event => {
      let next;
      const visibleTabs = tabs.filter(item => !item.hidden);
      const current = visibleTabs.indexOf(tab);
      if (event.key === 'ArrowRight') next = (current + 1) % visibleTabs.length;
      if (event.key === 'ArrowLeft') next = (current + visibleTabs.length - 1) % visibleTabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = visibleTabs.length - 1;
      if (next !== undefined) { event.preventDefault(); selectTab(visibleTabs[next], true); }
    });
  }
  const themeControls = controls.filter(input => input.dataset.pref === 'theme');
  for (const input of controls) {
    on(input, input.type === 'range' ? 'input' : 'change', event => {
      const key = input.dataset.pref;
      if (input.type === 'radio' && !input.checked) return;
      if (key === 'theme') {
        syncSegments();
        const mode = input.value, trigger = event.currentTarget;
        for (const control of themeControls) control.disabled = true;
        run(() => api.setTheme(mode, trigger), '正在切换明暗模式').finally(() => {
          if (!disposed) for (const control of themeControls) control.disabled = false;
        });
        return;
      }
      const value = input.type === 'checkbox' ? input.checked : input.type === 'range' ? key === 'opacity' || key === 'rightOpacity' || key === 'contextOpacity' || key === 'windowOpacity' || key === 'composerOpacity' || key === 'componentOpacity' || key === 'headerOpacity' || key === 'rightHeaderOpacity' || key === 'conversationOpacity' ? 1 - Number(input.value) / 100 : Number(input.value) / (key === 'volume' || key === 'wallOpacity' ? 100 : 1) : key === 'fontFamily' ? input.value.trim() || defaults.fontFamily : input.value;
      if (key === 'fontFamily') fontInput.value = value;
      apply({ [key]: value });
    });
  }
  on(fontInput, 'keydown', event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); fontInput.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true })); } });
  const fontsButton = find('[data-action="local-fonts"]');
  on(fontsButton, 'click', () => run(async () => {
    fontStatus.textContent = '正在读取本地字体…';
    try {
      const result = await api.localFonts();
      if (disposed) return;
      const families = Array.from(new Set((Array.isArray(result) ? result : []).map(item => typeof item === 'string' ? item : item && item.family).filter(item => typeof item === 'string' && item.trim()).map(item => item.trim()))).sort((a, b) => a.localeCompare(b, 'zh-CN'));
      const list = find('#' + id('local-fonts'));
      list.replaceChildren();
      for (const family of families) { const option = doc.createElement('option'); option.value = family; list.appendChild(option); }
      fontStatus.className = 'sao-hint';
      fontStatus.textContent = families.length ? '已读取 ' + families.length + ' 个本地字体，可输入名称搜索。' : '未读取到字体，可继续手填字体族名称。';
    } catch (error) {
      if (!disposed) { fontStatus.className = 'sao-error'; fontStatus.textContent = '读取失败：' + messageFor(error) + '。仍可手填字体族名称。'; }
      throw error;
    }
  }, '正在读取本地字体', fontsButton));
  for (const { input, value } of presetInputs) on(input, 'change', () => {
    if (!input.checked) return;
    hexDirty = false; clearHexError(); hex.blur();
    apply({ accent: value });
  });
  on(rainbow, 'click', () => {
    colorExpanded = !colorExpanded; picker.hidden = !colorExpanded;
    rainbow.setAttribute('aria-expanded', String(colorExpanded));
    rainbow.setAttribute('aria-label', colorExpanded ? '收起自定义颜色选择器' : '展开自定义颜色选择器');
    if (colorExpanded) drawColor();
  });
  on(hex, 'input', () => { hexDirty = true; validateHex(false); });
  on(hex, 'blur', () => { if (validateHex(true)) hex.value = hex.value.trim().toUpperCase(); });
  on(hex, 'keydown', event => { if (event.key === 'Enter') { event.preventDefault(); if (validateHex(true)) hex.value = hex.value.trim().toUpperCase(); } });
  on(brightnessInput, 'input', () => { brightness = Number(brightnessInput.value) / 100; colorChanged(); });
  function pointColor(event) {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    hue = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * 360;
    saturation = 1 - Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    colorChanged();
  }
  on(canvas, 'pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault(); canvas.focus(); activePointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId); pointColor(event);
  });
  on(canvas, 'pointermove', event => { if (activePointer === event.pointerId) pointColor(event); });
  function releasePointer(event) {
    if (activePointer !== event.pointerId) return;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    activePointer = null;
  }
  on(canvas, 'pointerup', releasePointer); on(canvas, 'pointercancel', releasePointer);
  on(canvas, 'lostpointercapture', () => { activePointer = null; });
  on(canvas, 'keydown', event => {
    const step = event.shiftKey ? 10 : 1;
    if (event.key === 'ArrowRight') hue = Math.min(360, hue + step);
    else if (event.key === 'ArrowLeft') hue = Math.max(0, hue - step);
    else if (event.key === 'ArrowUp') saturation = Math.min(1, saturation + step / 100);
    else if (event.key === 'ArrowDown') saturation = Math.max(0, saturation - step / 100);
    else if (event.key === 'Home') hue = 0;
    else if (event.key === 'End') hue = 360;
    else return;
    event.preventDefault(); colorChanged();
  });
  function createSurfacePicker() {
    const scope = find('[data-surface-colors]'), swatches = scope.querySelector('[data-surface-swatches]');
    const panel = picker.cloneNode(true);
    for (const element of [panel, ...panel.querySelectorAll('*')]) for (const attr of ['id', 'for', 'aria-controls', 'aria-labelledby', 'aria-describedby']) {
      if (element.hasAttribute(attr)) element.setAttribute(attr, element.getAttribute(attr).split(uid + '-').join(uid + '-surface-'));
    }
    panel.hidden = true; scope.querySelector('[data-surface-picker]').appendChild(panel);
    const spectrum = panel.querySelector('canvas'), marker = panel.querySelector('.sao-color-marker');
    const hex = panel.querySelector('.sao-hex-row input'), error = panel.querySelector('.sao-error'), brightnessInput = panel.querySelector('.sao-brightness input');
    hex.setAttribute('data-surface-hex', ''); spectrum.setAttribute('aria-label', '界面底色色相与饱和度'); brightnessInput.setAttribute('aria-label', '界面底色明度');
    const probe = doc.createElement('span'); probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;color:var(--sao-base)'; scope.appendChild(probe);
    const presets = [[null, '当前界面底色'], ['#F3F1EB', '柔白'], ['#F1EDE5', '暖砂'], ['#EAF0F3', '雾蓝'], ['#EAF0EA', '雾绿'], ['#EEEAF3', '淡紫'], ['#F3EAED', '浅粉']];
    const inputs = [];
    for (const [value, name] of presets) {
      const label = doc.createElement('label'); label.className = 'sao-swatch'; label.title = value ? name + ' ' + value : '默认 · 当前界面底色';
      const input = doc.createElement('input'); input.type = 'radio'; input.name = id('surfaceColor'); input.value = value || 'default'; input.setAttribute('aria-label', label.title);
      const face = doc.createElement('span'); face.className = 'sao-swatch-face'; face.setAttribute('aria-hidden', 'true'); face.style.setProperty('--swatch', value || 'var(--sao-base)');
      label.append(input, face); swatches.appendChild(label); inputs.push({ input, value });
      on(input, 'change', () => { if (input.checked) { reset(); apply({ surfaceColor: value }); } });
    }
    const button = doc.createElement('button'); button.type = 'button'; button.className = 'sao-rainbow'; button.title = '自定义界面底色'; button.setAttribute('aria-controls', panel.id); button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-label', '展开自定义界面底色'); swatches.appendChild(button);
    let h = 0, s = 0, v = 1, latest = '', dirty = false, expanded = false, drawn = -1, pointer = null;
    const asHex = () => '#' + rgbFromHSV(h, s, v).map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase();
    function clearError() { error.hidden = true; error.textContent = ''; hex.removeAttribute('aria-invalid'); }
    function reset() { dirty = false; hex.value = latest; clearError(); hex.blur(); }
    function fromHex(value) {
      const rgb = [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16) / 255), max = Math.max(...rgb), min = Math.min(...rgb), delta = max - min;
      if (delta) { const i = rgb.indexOf(max); h = ((i === 0 ? (rgb[1] - rgb[2]) / delta : i === 1 ? (rgb[2] - rgb[0]) / delta + 2 : (rgb[0] - rgb[1]) / delta + 4) * 60 + 360) % 360; }
      s = max ? delta / max : s; v = max;
    }
    function draw() {
      const ctx = spectrum.getContext('2d');
      if (ctx && drawn !== v) {
        drawn = v; const size = spectrum.width, data = ctx.createImageData(size, size);
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const at = (y * size + x) * 4, rgb = rgbFromHSV(x / (size - 1) * 360, 1 - y / (size - 1), v); data.data.set([...rgb, 255], at); }
        ctx.putImageData(data, 0, 0);
      }
      marker.style.left = (h / 360 * 100) + '%'; marker.style.top = ((1 - s) * 100) + '%';
      spectrum.setAttribute('aria-valuenow', String(Math.round(h))); spectrum.setAttribute('aria-valuetext', `色相 ${Math.round(h)} 度，饱和度 ${Math.round(s * 100)}%，明度 ${Math.round(v * 100)}%，${asHex()}`);
      brightnessInput.value = String(Math.round(v * 100)); panel.querySelector('[data-brightness-output]').textContent = Math.round(v * 100) + '%'; panel.querySelector('.sao-brightness-track').style.background = 'linear-gradient(to top,#000,rgb(' + rgbFromHSV(h, s, 1).join(',') + '))';
    }
    function changed() { dirty = false; clearError(); const value = asHex(); latest = value; hex.value = value; draw(); apply({ surfaceColor: value }); }
    function validate(showError) {
      const value = hex.value.trim();
      if (/^#[\da-f]{6}$/i.test(value)) { const exact = value.toUpperCase(); dirty = false; clearError(); fromHex(exact); latest = exact; draw(); if (prefs.surfaceColor !== exact) apply({ surfaceColor: exact }); return true; }
      if (showError) { hex.setAttribute('aria-invalid', 'true'); error.textContent = '请输入 # 加六位十六进制色值（0–9、A–F），例如 #EAF0F3。'; error.hidden = false; }
      return false;
    }
    on(button, 'click', () => { expanded = !expanded; panel.hidden = !expanded; button.setAttribute('aria-expanded', String(expanded)); button.setAttribute('aria-label', expanded ? '收起自定义界面底色' : '展开自定义界面底色'); if (expanded) draw(); });
    on(hex, 'input', () => { dirty = true; validate(false); }); on(hex, 'blur', () => { if (validate(true)) hex.value = hex.value.trim().toUpperCase(); });
    on(hex, 'keydown', event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); if (validate(true)) hex.value = hex.value.trim().toUpperCase(); } });
    on(brightnessInput, 'input', () => { v = Number(brightnessInput.value) / 100; changed(); });
    function point(event) { const b = spectrum.getBoundingClientRect(); if (!b.width || !b.height) return; h = Math.max(0, Math.min(1, (event.clientX - b.left) / b.width)) * 360; s = 1 - Math.max(0, Math.min(1, (event.clientY - b.top) / b.height)); changed(); }
    on(spectrum, 'pointerdown', event => { if (event.button !== 0) return; event.preventDefault(); spectrum.focus(); pointer = event.pointerId; spectrum.setPointerCapture(pointer); point(event); });
    on(spectrum, 'pointermove', event => { if (pointer === event.pointerId) point(event); });
    function release(event) { if (pointer !== event.pointerId) return; if (spectrum.hasPointerCapture(pointer)) spectrum.releasePointerCapture(pointer); pointer = null; }
    on(spectrum, 'pointerup', release); on(spectrum, 'pointercancel', release); on(spectrum, 'lostpointercapture', () => { pointer = null; });
    on(spectrum, 'keydown', event => {
      const step = event.shiftKey ? 10 : 1;
      if (event.key === 'ArrowRight') h = Math.min(360, h + step); else if (event.key === 'ArrowLeft') h = Math.max(0, h - step); else if (event.key === 'ArrowUp') s = Math.min(1, s + step / 100); else if (event.key === 'ArrowDown') s = Math.max(0, s - step / 100); else if (event.key === 'Home') h = 0; else if (event.key === 'End') h = 360; else return;
      event.preventDefault(); changed();
    });
    return {
      reset,
      cleanup() { if (pointer !== null && spectrum.hasPointerCapture(pointer)) spectrum.releasePointerCapture(pointer); },
      sync() {
        const custom = /^#[\da-f]{6}$/i.test(prefs.surfaceColor || '') ? prefs.surfaceColor.toUpperCase() : null;
        for (const item of inputs) item.input.checked = item.value === custom;
        scope.querySelector('[data-surface-label]').textContent = custom ? '当前界面底色 ' + custom : '默认 · 当前界面底色';
        let value = custom;
        if (!value && colorContext && doc.defaultView) { colorContext.clearRect(0, 0, 1, 1); colorContext.fillStyle = doc.defaultView.getComputedStyle(probe).color; colorContext.fillRect(0, 0, 1, 1); value = '#' + Array.from(colorContext.getImageData(0, 0, 1, 1).data).slice(0, 3).map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase(); }
        if (value && value !== latest) { latest = value; fromHex(value); if (!dirty && doc.activeElement !== hex) hex.value = value; if (expanded) draw(); }
      }
    };
  }
  const surfacePicker = createSurfacePicker();
  const previewButton = find('[data-action="preview"]');
  // The modal overlay already blocks repeat clicks. Keep the trigger focusable
  // so the startup scene can restore focus after its dissolve or immediate skip.
  on(previewButton, 'click', () => run(() => api.preview(), '正在预览'));
  on(find('[data-action="reset-transform"]'), 'click', () => apply({ wallX: 50, wallY: 50, wallScale: 100 }));
  const upload = find('#' + id('upload'));
  on(upload, 'change', () => {
    const file = upload.files && upload.files[0];
    if (!file) return;
    if (file.type && !file.type.startsWith('image/') && !['video/mp4','video/webm'].includes(file.type)) { announce('请选择图片、MP4 或 WebM 后重试。', true); upload.value = ''; return; }
    run(async () => { await api.upload(file); }, '正在保存壁纸', upload).then(() => { if (!disposed) upload.value = ''; });
  });
  const removeButton = find('[data-action="remove-upload"]');
  on(removeButton, 'click', () => run(() => api.removeUpload(), '正在删除自定义壁纸', removeButton));
  for (const button of all('[data-reset-setting]')) on(button, 'click', () => {
    const key = button.dataset.resetSetting;
    if (key === 'accent') { hexDirty = false; clearHexError(); hex.blur(); }
    if (key === 'surfaceColor') surfacePicker.reset();
    if (key === 'fontFamily') { fontInput.blur(); fontStatus.textContent = ''; }
    if (key === 'theme') for (const control of themeControls) control.disabled = true;
    const action = run(() => api.resetSetting(key), '正在' + button.getAttribute('aria-label'), button);
    if (key === 'theme') action.finally(() => {
      if (!disposed) for (const control of themeControls) control.disabled = false;
    });
  });
  const resetButton = find('[data-action="reset"]');
  on(resetButton, 'click', () => {
    hexDirty = false; clearHexError(); surfacePicker.reset();
    run(() => api.reset(), '正在恢复默认设置', resetButton);
  });
  const previewResizeObserver = typeof doc.defaultView.ResizeObserver === 'function' ? new doc.defaultView.ResizeObserver(() => syncPreview(true)) : null;
  for (const el of [find('.sao-scene'), find('.sao-mini'), ...all('.sao-mini-title,.sao-mini-component,.sao-mini-composer')]) previewResizeObserver?.observe(el);
  // ResizeObserver cannot see equal-size boxes whose relative positions change.
  // Watch local layout styles/classes too, ignoring our own optical paint writes.
  const previewPaintProperties = new Set(['background', 'backdrop-filter', '-webkit-backdrop-filter', 'box-shadow', '--sao-preview-strength', 'mask-image', '-webkit-mask-image', 'mask-mode', 'mask-size', 'mask-repeat', '-webkit-mask-size', '-webkit-mask-repeat']);
  const previewLayoutStyles = new WeakMap();
  const layoutStyle = element => Array.from(element.style).filter(name => !previewPaintProperties.has(name) && !/^(?:background-|(?:-webkit-)?mask-)/.test(name)).map(name => name + ':' + element.style.getPropertyValue(name)).join(';');
  for (const element of [previewNodes.panel, ...previewNodes.panel.querySelectorAll('*')]) previewLayoutStyles.set(element, layoutStyle(element));
  const previewLayoutObserver = typeof doc.defaultView.MutationObserver === 'function' ? new doc.defaultView.MutationObserver(records => {
    if (disposed) return;
    let changed = false;
    for (const record of records) {
      if (record.type === 'childList') { if ([...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1)) changed = true; continue; }
      if (record.attributeName !== 'style') { changed = true; continue; }
      const value = layoutStyle(record.target);
      if (previewLayoutStyles.get(record.target) !== value) { previewLayoutStyles.set(record.target, value); changed = true; }
    }
    if (changed) syncPreview(true);
  }) : null;
  previewLayoutObserver?.observe(previewNodes.panel, {subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class']});
  sync(); saved();
  if (typeof api.subscribe === 'function') unsubscribe = api.subscribe(() => {
    if (disposed) return;
    prefs = readPrefs(); sync();
    if (!pending) saved();
  });
  return function cleanup() {
    if (disposed) return;
    disposed = true;
    if (typeof unsubscribe === 'function') unsubscribe();
    previewResizeObserver?.disconnect();
    previewLayoutObserver?.disconnect();
    segmentResizeObserver?.disconnect();
    doc.defaultView.cancelAnimationFrame(segmentMeasureFrame);
    for (const state of segmentGroups) state.motion?.cancel();
    surfacePicker.cleanup();
    if (activePointer !== null && canvas.hasPointerCapture(activePointer)) canvas.releasePointerCapture(activePointer);
    for (const remove of removers) remove();
    root.remove();
  };
}
