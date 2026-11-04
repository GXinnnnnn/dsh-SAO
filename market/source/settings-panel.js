/* Standalone settings view. Bundled inside the SAO client factory. */
function mountSAOSettings(container, api) {
  'use strict';
  const doc = container.ownerDocument;
  const uid = 'sao-settings-' + Math.random().toString(36).slice(2, 10);
  const defaults = { startup: true, animation: '1', voice: 'kirito', sound: true, volume: 0.65, theme: 'system', fontFamily: '方正兰亭圆_准', accent: '#8CC8F4', surfaceColor: null, windowOpacity: 1, composerOpacity: 0.90, componentOpacity: 0.90, conversationOpacity: 0.50, conversationBlur: 0, glass: 'liquid', opacity: 0.40, headerOpacity: 0.40, rightLinked: true, rightGlass: 'liquid', rightOpacity: 0.70, rightBlur: 0, contextGlass: 'follow', contextOpacity: .80, contextBlur: 0, headerLinked: true, rightHeaderOpacity: 0.40, wallpaper: 'builtin-3', wallOpacity: 1, wallX: 50, wallY: 50, wallScale: 100 };
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
[data-sao-settings]{--sao-ink:var(--dsw-alias-label-primary,CanvasText);--sao-muted:var(--dsw-alias-label-secondary,GrayText);--sao-base:var(--dsw-alias-bg-base,Canvas);--sao-surface:color-mix(in srgb,var(--sao-ink) 3%,transparent);--sao-line:color-mix(in srgb,var(--sao-ink) 9%,transparent);--sao-radius-surface:22px;--sao-radius-control:14px;--sao-accent:var(--dsw-alias-brand-primary,Highlight);--sao-on-accent:var(--dsw-alias-label-on-brand,HighlightText);--sao-soft:color-mix(in srgb,var(--sao-accent) 8%,transparent);--sao-mark:var(--sao-accent);--sao-selected-line:color-mix(in srgb,var(--sao-accent) 65%,transparent);--sao-track:var(--sao-accent);--sao-mark-edge:color-mix(in srgb,var(--sao-on-accent) 55%,transparent);--sao-focus:color-mix(in srgb,var(--sao-accent) 35%,var(--sao-ink));color:var(--sao-ink);background:transparent;font:400 14px/1.6 var(--sao-font,system-ui),-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;padding:24px;box-sizing:border-box;min-width:0;max-width:1100px;margin-inline:auto;isolation:isolate}
[data-sao-settings] *,[data-sao-settings] *::before,[data-sao-settings] *::after{box-sizing:border-box}
[data-sao-settings] [hidden]{display:none!important}
[data-sao-settings] h2,[data-sao-settings] h3,[data-sao-settings] p{margin:0}
[data-sao-settings] button,[data-sao-settings] input,[data-sao-settings] select{font:inherit;color:inherit}
[data-sao-settings] button,[data-sao-settings] label,[data-sao-settings] input[type=range]{touch-action:manipulation}
[data-sao-settings] button{cursor:pointer}
[data-sao-settings] button:disabled,[data-sao-settings] input:disabled{cursor:wait;opacity:.58}
[data-sao-settings] [data-pref=rightHeaderOpacity]:disabled{cursor:not-allowed}
[data-sao-settings] :is(button,input,select,canvas):focus-visible{outline:3px solid var(--sao-focus);outline-offset:3px;box-shadow:0 0 0 2px var(--sao-base)}
[data-sao-settings] .sao-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:22px}
[data-sao-settings] h2{font-size:23px;line-height:1.4;font-weight:500}
[data-sao-settings] .sao-tabs{display:flex;gap:6px;border-bottom:1px solid var(--sao-line);margin-bottom:24px}
[data-sao-settings] .sao-tab{position:relative;min-height:46px;padding:9px 18px;border:1px solid transparent;border-radius:var(--sao-radius-control);background:transparent;color:var(--sao-muted);font-weight:400}
[data-sao-settings] .sao-tab:hover{background:var(--sao-soft);color:var(--sao-ink)}
[data-sao-settings] .sao-tab[aria-selected=true]{color:var(--sao-ink);background:var(--sao-soft);border-color:var(--sao-selected-line)}
[data-sao-settings] .sao-tab[aria-selected=true]::after{content:"";position:absolute;bottom:3px;left:calc(50% - 2px);width:4px;height:4px;border-radius:50%;background:var(--sao-mark)}
[data-sao-settings] .sao-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(210px,260px);gap:28px;align-items:start}
[data-sao-settings] .sao-main{min-width:0;container-type:inline-size;container-name:sao-settings-main}
[data-sao-settings] .sao-section-head{margin-bottom:20px}
[data-sao-settings] h3{font-size:16px;font-weight:500}
[data-sao-settings] .sao-row{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px 16px;padding:15px 0;border-bottom:1px solid var(--sao-line)}
[data-sao-settings] .sao-row:first-of-type{padding-top:0}
[data-sao-settings] .sao-row-copy{min-width:0;flex:1 1 160px}
[data-sao-settings] .sao-row-controls{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px;margin-inline-start:auto}
[data-sao-settings] .sao-field-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 12px;width:100%}
[data-sao-settings] .sao-reset{flex:0 0 auto;min-height:36px;margin-inline-start:auto;padding:6px 8px;border:1px solid transparent;border-radius:var(--sao-radius-control);background:transparent;color:var(--sao-muted);font-size:12px;font-weight:400;white-space:nowrap}
[data-sao-settings] .sao-reset:hover{background:var(--sao-soft);color:var(--sao-ink)}
[data-sao-settings] .sao-right-settings{margin-top:24px}
[data-sao-settings] .sao-row-title{display:block;font-weight:400}
[data-sao-settings] .sao-hint{display:block;color:var(--sao-muted);font-size:12px;line-height:1.6;margin-top:3px}
[data-sao-settings] .sao-switch{position:relative;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;min-width:48px;min-height:44px}
[data-sao-settings] .sao-switch input{position:absolute;opacity:0;width:44px;height:28px;margin:0;cursor:pointer}
[data-sao-settings] .sao-switch-track{width:44px;height:26px;border-radius:999px;corner-shape:round!important;background:var(--sao-line);pointer-events:none;position:relative;border:1px solid var(--sao-line);transition:background .15s,border-color .15s}
[data-sao-settings] .sao-switch-track::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;corner-shape:round!important;background:var(--sao-muted);transition:transform .15s,background .15s}
[data-sao-settings] .sao-switch input:checked + span{background:var(--sao-soft);border-color:var(--sao-selected-line)}
[data-sao-settings] .sao-switch input:checked + span::after{transform:translateX(18px);background:var(--sao-mark);box-shadow:0 0 0 1px var(--sao-mark-edge)}
[data-sao-settings] .sao-switch input:focus-visible + span{outline:3px solid var(--sao-focus);outline-offset:4px;box-shadow:0 0 0 3px var(--sao-base)}
[data-sao-settings] fieldset{border:0;padding:0;margin:22px 0;min-width:0}
[data-sao-settings] legend{padding:0;margin-bottom:10px;font-weight:400;width:100%;max-width:100%}
[data-sao-settings] .sao-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
[data-sao-settings] .sao-choice{position:relative;min-width:0;cursor:pointer}
[data-sao-settings] .sao-choice > input{position:absolute;appearance:none;width:18px;height:18px;top:14px;left:12px;margin:0;border:1px solid var(--sao-muted);border-radius:50%;background:var(--sao-surface);z-index:1;cursor:pointer}
[data-sao-settings] .sao-choice > input:checked{background:var(--sao-mark);border-color:var(--sao-mark);box-shadow:inset 0 0 0 4px var(--sao-base),0 0 0 1px var(--sao-mark-edge)}
[data-sao-settings] .sao-choice > span{display:block;min-height:68px;border:1px solid var(--sao-line);border-radius:var(--sao-radius-surface);background:var(--sao-surface);padding:11px 10px 11px 38px;font-size:13px}
[data-sao-settings] .sao-choice input:checked + span{border-color:var(--sao-selected-line);background:var(--sao-soft);color:var(--sao-ink)}
[data-sao-settings] .sao-choice:hover > span{border-color:var(--sao-selected-line)}
[data-sao-settings] .sao-choice input:focus-visible + span{outline:3px solid var(--sao-focus);outline-offset:3px;box-shadow:0 0 0 2px var(--sao-base)}
[data-sao-settings] .sao-choice strong{display:block;font-weight:400}
[data-sao-settings] .sao-choice small{display:block;font-size:11px;color:var(--sao-muted);margin-top:3px}
[data-sao-settings] .sao-choice input:checked + span small{color:inherit}
[data-sao-settings] .sao-animation-choices .sao-choice > span{padding:11px 10px;min-height:68px}
[data-sao-settings] .sao-animation-choices strong,[data-sao-settings] .sao-animation-choices small{padding-left:28px}
[data-sao-settings] .sao-animation-preview{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;margin-top:10px;border-radius:var(--sao-radius-control);corner-shape:round!important;border:1px solid var(--sao-line)}
[data-sao-settings] .sao-compact-choices{display:flex;flex-wrap:wrap;gap:8px}
[data-sao-settings] .sao-compact-choices .sao-choice{flex:1 1 120px}
[data-sao-settings] .sao-compact-choices .sao-choice > span{display:flex;align-items:center;gap:6px;height:40px;min-height:40px;padding:8px 12px 8px 36px;border-radius:999px;corner-shape:round!important;line-height:22px;white-space:nowrap}
[data-sao-settings] .sao-compact-choices .sao-choice > input{top:11px;left:12px}
[data-sao-settings] .sao-compact-choices .sao-choice strong{overflow:hidden;text-overflow:ellipsis}
[data-sao-settings] .sao-switch-track,[data-sao-settings] .sao-choice > input,[data-sao-settings] .sao-tab::after{corner-shape:round!important}
[data-sao-settings] .sao-btn{min-height:44px;border:1px solid var(--sao-line);border-radius:var(--sao-radius-control);background:var(--sao-surface);color:var(--sao-ink);padding:8px 14px;font-weight:400;font-size:13px;transition:background .15s,border-color .15s}
[data-sao-settings] .sao-btn:hover{background:var(--sao-soft);border-color:var(--sao-selected-line)}
[data-sao-settings] .sao-btn-primary{background:var(--sao-soft);color:var(--sao-ink);border-color:var(--sao-selected-line)}
[data-sao-settings] .sao-btn-primary:hover{background:color-mix(in srgb,var(--sao-accent) 12%,transparent)}
[data-sao-settings] .sao-actions{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:20px}
[data-sao-settings] .sao-font-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:8px 0}
[data-sao-settings] .sao-font-row input{flex:1 1 180px;min-width:0;min-height:44px;padding:8px 10px;border:1px solid var(--sao-line);border-radius:var(--sao-radius-control);background:var(--sao-surface)}
[data-sao-settings] .sao-theme-choices{grid-template-columns:repeat(3,minmax(0,1fr))}
[data-sao-settings] .sao-theme-choices .sao-choice > span{min-height:48px}
[data-sao-settings] .sao-range-row{display:grid;grid-template-columns:minmax(0,9em) minmax(80px,1fr) 4ch max-content;grid-template-areas:"label slider value reset";align-items:center;gap:0 10px;margin-top:8px;padding:4px 10px;border:1px solid var(--sao-line);border-radius:8px;background:var(--sao-surface)}
[data-sao-settings] .sao-range-row > label{grid-area:label;min-width:0;font-size:13px;line-height:1.5;overflow-wrap:anywhere}
[data-sao-settings] .sao-range-row > input[type=range]{grid-area:slider;min-width:0;min-height:44px}
[data-sao-settings] .sao-range-row > output{grid-area:value;justify-self:end;text-align:right;font-variant-numeric:tabular-nums}
[data-sao-settings] .sao-range-row > .sao-reset{grid-area:reset;min-height:44px;margin-inline-start:0;border-radius:6px}
[data-sao-settings] output{font:12px ui-monospace,monospace;color:var(--sao-muted);white-space:nowrap}
[data-sao-settings] input[type=range]{width:100%;min-height:32px;accent-color:var(--sao-accent);cursor:pointer;margin:0}
[data-sao-settings] input[type=range][data-pref]{appearance:none;background:transparent}
[data-sao-settings] input[type=range][data-pref]::-webkit-slider-runnable-track{height:6px;border:1px solid var(--sao-line);border-radius:var(--sao-radius-control);background:linear-gradient(to right,var(--sao-track) var(--range-progress,0%),var(--sao-line) var(--range-progress,0%))}
[data-sao-settings] input[type=range][data-pref]::-webkit-slider-thumb{appearance:none;width:18px;height:18px;margin-top:-7px;border:3px solid var(--sao-base);border-radius:50%;background:var(--sao-mark);box-shadow:0 0 0 1px var(--sao-mark-edge)}
[data-sao-settings] input[type=range][data-pref]::-moz-range-track{height:6px;border:1px solid var(--sao-line);border-radius:var(--sao-radius-control);background:linear-gradient(to right,var(--sao-track) var(--range-progress,0%),var(--sao-line) var(--range-progress,0%))}
[data-sao-settings] input[type=range][data-pref]::-moz-range-thumb{width:14px;height:14px;border:3px solid var(--sao-base);border-radius:50%;background:var(--sao-mark);box-shadow:0 0 0 1px var(--sao-mark-edge)}
[data-sao-settings] .sao-swatches{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
[data-sao-settings] .sao-swatch{position:relative;display:inline-flex;min-width:44px;min-height:44px;justify-content:center;align-items:center;cursor:pointer}
[data-sao-settings] .sao-swatch input{position:absolute;opacity:0;width:38px;height:38px;margin:0;cursor:pointer}
[data-sao-settings] .sao-swatch-face{width:32px;height:32px;background:var(--swatch);border:1px solid var(--sao-line);border-radius:50%;position:relative;pointer-events:none;box-shadow:inset 0 0 0 3px #ffffff80}
[data-sao-settings] .sao-swatch input:checked + span{outline:2px solid var(--sao-accent);outline-offset:3px}
[data-sao-settings] .sao-swatch input:checked + span::after{content:"✓";position:absolute;inset:3px;display:grid;place-items:center;color:var(--sao-on-accent);background:var(--sao-accent);border:1px solid var(--sao-on-accent);border-radius:50%;font-size:14px}
[data-sao-settings] .sao-swatch input:focus-visible + span{outline:3px solid var(--sao-focus);outline-offset:4px;box-shadow:0 0 0 3px var(--sao-base)}
[data-sao-settings] .sao-follow .sao-swatch-face{background:linear-gradient(135deg,var(--sao-base) 50%,var(--dsw-alias-brand-primary,Highlight) 50%)}
[data-sao-settings] .sao-rainbow{width:44px;height:44px;min-height:44px;border:1px solid var(--sao-line);border-radius:50%;background:var(--sao-surface);display:grid;place-items:center;padding:5px}
[data-sao-settings] .sao-rainbow::before{content:"";width:30px;height:30px;border-radius:50%;background:conic-gradient(#ef4444,#eacb37,#59b95c,#48bdc7,#6376d8,#ca62c7,#ef4444);box-shadow:inset 0 0 0 3px #ffffff80}
[data-sao-settings] .sao-rainbow[aria-expanded=true]{outline:2px solid var(--sao-accent);outline-offset:2px}
[data-sao-settings] .sao-current-color{margin-top:10px;font-size:12px;color:var(--sao-muted)}
[data-sao-settings] .sao-picker{padding:16px;border:1px solid var(--sao-line);border-radius:var(--sao-radius-surface);background:var(--sao-surface);margin-top:14px;max-width:400px}
[data-sao-settings] .sao-picker-grid{display:grid;grid-template-columns:minmax(0,1fr) 42px;gap:14px;align-items:stretch}
[data-sao-settings] .sao-spectrum-wrap{position:relative;aspect-ratio:1;min-width:0}
[data-sao-settings] .sao-spectrum{width:100%;height:100%;display:block;border:1px solid var(--sao-line);border-radius:var(--sao-radius-control);touch-action:none;cursor:crosshair}
[data-sao-settings] .sao-color-marker{position:absolute;width:14px;height:14px;border:2px solid #fff;outline:1px solid #000;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}
[data-sao-settings] .sao-brightness{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0}
[data-sao-settings] .sao-brightness-track{position:relative;flex:1;width:32px;min-height:130px;border-radius:var(--sao-radius-control);overflow:hidden;border:1px solid var(--sao-line);background:linear-gradient(to top,#000,#fff)}
[data-sao-settings] .sao-brightness input{position:absolute;inset:0;writing-mode:vertical-lr;direction:rtl;width:100%;height:100%;margin:0;appearance:none;background:transparent;border:0;accent-color:var(--sao-accent);touch-action:none}
[data-sao-settings] .sao-brightness input::-webkit-slider-thumb{appearance:none;width:30px;height:8px;background:var(--sao-accent);border:2px solid var(--sao-on-accent);box-shadow:0 0 0 1px var(--sao-ink);border-radius:2px;cursor:ns-resize}
[data-sao-settings] .sao-brightness input::-moz-range-thumb{width:28px;height:6px;background:var(--sao-accent);border:2px solid var(--sao-on-accent);box-shadow:0 0 0 1px var(--sao-ink);border-radius:2px}
[data-sao-settings] .sao-brightness label{font-size:11px;color:var(--sao-muted)}
[data-sao-settings] .sao-brightness-track:focus-within{outline:3px solid var(--sao-focus);outline-offset:3px}
[data-sao-settings] .sao-hex-row{display:flex;gap:12px;align-items:center;margin-top:14px}
[data-sao-settings] .sao-hex-row label{font-size:12px;font-weight:400}
[data-sao-settings] .sao-hex-row input{min-width:0;width:100%;height:42px;border:1px solid var(--sao-line);border-radius:var(--sao-radius-control);background:var(--sao-surface);padding:8px 10px;font-family:ui-monospace,monospace;text-transform:uppercase}
[data-sao-settings] .sao-hex-row input[aria-invalid=true]{border-color:var(--sao-ink)}
[data-sao-settings] .sao-error{font-size:12px;color:var(--sao-ink);margin-top:7px}
[data-sao-settings] .sao-glass-choices{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
[data-sao-settings] .sao-glass-choices .sao-choice > span{padding:36px 8px 10px;min-height:90px;text-align:center}
[data-sao-settings] .sao-glass-choices .sao-choice > input{left:calc(50% - 9px);top:12px}
[data-sao-settings] .sao-wall-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
[data-sao-settings] .sao-wall .sao-choice > span{padding:0;overflow:hidden}
[data-sao-settings] .sao-wall .sao-choice > input{top:auto;bottom:15px;left:12px}
[data-sao-settings] .sao-wall-art{display:block;aspect-ratio:16/9;background:var(--sao-surface);position:relative;overflow:hidden}
[data-sao-settings] .sao-wall-art img{display:block;width:100%;height:100%;object-fit:cover;position:absolute;inset:0}
[data-sao-settings] .sao-wall-art::after{content:"";position:absolute;inset:0;border-bottom:1px solid var(--sao-line);pointer-events:none}
[data-sao-settings] .sao-wall-name{display:block;padding:11px 8px 11px 38px;font-size:12px;font-weight:400;overflow-wrap:anywhere}
[data-sao-settings] .sao-none-art{background:repeating-conic-gradient(var(--sao-line) 0% 25%,var(--sao-base) 0% 50%) 50%/16px 16px;display:grid;place-items:center;color:var(--sao-muted);font-size:12px}
[data-sao-settings] .sao-upload{margin-top:20px;border:1px dashed var(--sao-line);border-radius:var(--sao-radius-surface);padding:16px;background:var(--sao-surface)}
[data-sao-settings] .sao-upload label{display:block;font-size:13px;font-weight:400;margin-bottom:8px}
[data-sao-settings] input[type=file]{max-width:100%;font-size:12px;min-height:40px}
[data-sao-settings] input[type=file]::file-selector-button{font:inherit;min-height:36px;margin-right:8px;background:var(--sao-soft);border:1px solid var(--sao-selected-line);border-radius:var(--sao-radius-control);padding:6px 10px;color:var(--sao-ink);cursor:pointer}
[data-sao-settings] .sao-fit{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:24px;padding:12px 0;border-bottom:1px solid var(--sao-line);font-size:13px}
[data-sao-settings] .sao-fit span:last-child{border:1px solid var(--sao-line);padding:3px 10px;border-radius:var(--sao-radius-control);background:var(--sao-surface);color:var(--sao-muted);font-size:12px}
[data-sao-settings] .sao-preview{padding:16px;border:1px solid var(--sao-line);border-radius:var(--sao-radius-surface);background:var(--sao-surface);min-width:0}
[data-sao-settings] .sao-preview-label{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;font-size:12px;font-weight:500}
[data-sao-settings] .sao-live{font:10px ui-monospace,monospace;color:var(--sao-muted)}
[data-sao-settings] .sao-live::before{content:"";display:inline-block;width:5px;height:5px;background:var(--sao-accent);border-radius:50%;margin-right:5px;vertical-align:2px}
[data-sao-settings] .sao-scene{position:relative;height:228px;border-radius:var(--sao-radius-control);overflow:hidden;background:var(--sao-surface);border:1px solid var(--sao-line);isolation:isolate;display:flex;align-items:center;justify-content:center;padding:18px}
[data-sao-settings] .sao-scene-wall{position:absolute;inset:0;overflow:hidden;z-index:-1}
[data-sao-settings] .sao-scene-wall img{width:100%;height:100%;object-fit:cover;transform-origin:center;display:block}
[data-sao-settings] .sao-scene-conversation{position:absolute;inset:0;z-index:-1;pointer-events:none}
[data-sao-settings] .sao-mini{width:100%;max-width:220px;border:1px solid var(--sao-line);border-radius:var(--sao-radius-surface);box-shadow:0 8px 28px color-mix(in srgb,var(--sao-ink) 8%,transparent);padding:15px;position:relative;overflow:hidden}
[data-sao-settings] .sao-mini[data-glass=liquid]::before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(135deg,#ffffff1f,transparent 52%,#ffffff08);border-radius:inherit}
[data-sao-settings] .sao-mini-title{display:flex;align-items:center;gap:7px;padding:2px 6px;border-radius:var(--sao-radius-control);font-size:12px;font-weight:500;position:relative}
[data-sao-settings] .sao-mini-mark{width:9px;height:9px;border-radius:2px;transform:rotate(45deg);background:var(--sao-mark);flex-shrink:0}
[data-sao-settings] .sao-mini-component{margin-top:10px;padding:6px 8px;border:1px solid var(--sao-line);border-radius:var(--sao-radius-control);position:relative}
[data-sao-settings] .sao-mini-line{height:5px;border-radius:var(--sao-radius-control);background:color-mix(in srgb,var(--sao-ink) 18%,transparent);width:86%}
[data-sao-settings] .sao-mini-line + .sao-mini-line{width:65%;margin-top:7px}
[data-sao-settings] .sao-mini-composer{height:27px;border:1px solid var(--sao-selected-line);border-radius:var(--sao-radius-control);margin-top:16px;padding-inline:10px;display:grid;align-items:center;font-size:10px;font-weight:400;color:var(--sao-muted);position:relative}
[data-sao-settings] .sao-preview-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
[data-sao-settings] .sao-preview-meta span{font-size:10px;border:1px solid var(--sao-line);border-radius:var(--sao-radius-control);padding:2px 6px;color:var(--sao-muted);background:var(--sao-surface)}
[data-sao-settings] .sao-preview-note{margin-top:10px;font-size:11px;color:var(--sao-muted)}
[data-sao-settings] .sao-footer{border-top:1px solid var(--sao-line);padding-top:17px;margin-top:26px;display:flex;align-items:center;justify-content:space-between;gap:12px}
[data-sao-settings] .sao-status{font-size:12px;color:var(--sao-muted);overflow-wrap:anywhere}
[data-sao-settings] .sao-status[data-error=true]{color:var(--sao-ink)}
[data-sao-settings] .sao-footer .sao-btn{font-weight:400;font-size:12px;flex-shrink:0}
@container sao-settings (max-width:700px){[data-sao-settings] .sao-layout{grid-template-columns:minmax(0,1fr)}[data-sao-settings] .sao-preview{max-width:none}[data-sao-settings] .sao-scene{height:180px}[data-sao-settings] .sao-mini{max-width:230px}}
@container sao-settings (max-width:400px){[data-sao-settings] .sao-theme-choices{grid-template-columns:minmax(0,1fr)}}
@container sao-settings-main (max-width:480px){[data-sao-settings] .sao-range-row{grid-template-columns:minmax(0,1fr) 4ch max-content;grid-template-areas:"label label reset" "slider slider value";column-gap:8px}}
[data-sao-settings]{container-type:inline-size;container-name:sao-settings}
@media(max-width:720px){[data-sao-settings]{padding:18px 16px}[data-sao-settings] .sao-layout{grid-template-columns:minmax(0,1fr);gap:24px}[data-sao-settings] .sao-scene{height:180px}[data-sao-settings] .sao-tab{flex:1;padding-inline:10px}[data-sao-settings] .sao-head{margin-bottom:16px}}
@media(prefers-reduced-motion:reduce){[data-sao-settings] *,[data-sao-settings] *::before,[data-sao-settings] *::after{transition:none!important;animation:none!important}}
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
  ${toggle('startup', '启动时播放动画', '打开 DSH 时，自动播放 Link Start。')}
  <fieldset>${fieldLegend('animation', '动画样式')}<div class="sao-choices sao-animation-choices">${choice('animation', '1', '动画 1', '还原光束')}${choice('animation', '2', '动画 2', '纤细光束')}</div></fieldset>
  <fieldset>${fieldLegend('voice', 'Link Start 语音')}<div class="sao-choices sao-compact-choices">${choice('voice', 'kirito', '桐人', '')}${choice('voice', 'asuna', '亚丝娜', '')}</div></fieldset>
  ${toggle('sound', '播放声音', '启动音效与角色语音。')}
  ${range('volume', '音量', 0, 100, '%')}
  <div class="sao-actions"><button class="sao-btn sao-btn-primary" data-action="preview" type="button">预览启动动画</button></div>
</section>
<section role="tabpanel" id="${id('panel-appearance')}" aria-labelledby="${id('tab-appearance')}" data-panel="appearance" hidden>
  <div class="sao-section-head"><h3>外观</h3></div>
  <fieldset>${fieldLegend('theme', '明暗模式')}<div class="sao-choices sao-theme-choices">${choice('theme', 'system', '跟随系统', '')}${choice('theme', 'light', '浅色', '')}${choice('theme', 'dark', '深色', '')}</div></fieldset>
  <div class="sao-font"><div class="sao-field-head"><label class="sao-row-title" for="${id('fontFamily')}">字体</label>${resetSetting('fontFamily', '字体')}</div><div class="sao-font-row"><input id="${id('fontFamily')}" type="text" data-pref="fontFamily" list="${id('local-fonts')}" autocomplete="off" spellcheck="false" placeholder="方正兰亭圆_准" aria-describedby="${id('font-help')} ${id('font-status')}"><button class="sao-btn" type="button" data-action="local-fonts">读取本地字体</button></div><datalist id="${id('local-fonts')}"></datalist><p class="sao-hint" id="${id('font-help')}">可手填本地字体族名称；读取列表需要字体访问权限。</p><p class="sao-hint" id="${id('font-status')}" role="status" aria-live="polite"></p></div>
  <fieldset>${fieldLegend('accent', '主题色')}<div class="sao-swatches" data-swatches role="radiogroup" aria-label="预设主题色"></div><p class="sao-current-color" data-color-label></p>
    <div class="sao-picker" id="${id('picker')}" hidden>
      <div class="sao-picker-grid"><div class="sao-spectrum-wrap"><canvas class="sao-spectrum" width="256" height="256" tabindex="0" role="slider" aria-label="色相与饱和度" aria-valuemin="0" aria-valuemax="360" aria-valuenow="0" aria-describedby="${id('spectrum-help')}"></canvas><span class="sao-color-marker" aria-hidden="true"></span></div><div class="sao-brightness"><div class="sao-brightness-track"><input type="range" id="${id('brightness')}" min="0" max="100" step="1" value="100" aria-label="颜色明度" aria-orientation="vertical"></div><label for="${id('brightness')}">明度</label><output data-brightness-output>100%</output></div></div>
      <p class="sao-hint" id="${id('spectrum-help')}">横向选色相，纵向选饱和度。方向键微调，Shift 加速；右侧调整明度。</p>
      <div class="sao-hex-row"><label for="${id('hex')}">HEX</label><input id="${id('hex')}" type="text" inputmode="text" spellcheck="false" autocomplete="off" maxlength="7" aria-describedby="${id('hex-help')} ${id('hex-error')}" placeholder="#RRGGBB"></div><p class="sao-hint" id="${id('hex-help')}">输入完整六位色值，包含 #，例如 #000000 或 #FFFFFF。</p><p class="sao-error" id="${id('hex-error')}" role="status" aria-live="polite" hidden></p>
    </div>
  </fieldset>
  <fieldset data-surface-colors>${fieldLegend('surfaceColor', '界面底色')}<div class="sao-swatches" data-surface-swatches role="radiogroup" aria-label="界面底色预设"></div><p class="sao-current-color" data-surface-label></p><div data-surface-picker></div></fieldset>
  ${range('windowOpacity', '全局窗口透明度', 0, 100, '%')}
  ${range('composerOpacity', '输入框透明度', 0, 100, '%')}
  ${range('componentOpacity', '内容组件透明度', 0, 100, '%')}
  <fieldset aria-describedby="${id('conversation-help')}"><legend>会话背景</legend><p class="sao-hint" id="${id('conversation-help')}">整面背景遮罩，独立于局部玻璃。右栏默认同步此处的透明度与模糊。</p>
    ${range('conversationOpacity', '会话背景透明度', 0, 100, '%')}
    ${range('conversationBlur', '会话背景模糊', 0, 24, 'px')}
  </fieldset>
  <fieldset>${fieldLegend('glass', '会话玻璃效果')}<div class="sao-choices sao-glass-choices">${choice('glass', 'off', '关闭', '清晰原色')}${choice('glass', 'frosted', '磨砂玻璃', '柔和模糊')}${choice('glass', 'liquid', '液态玻璃', '通透折光')}</div></fieldset>
  ${range('opacity', '表面透明度', 0, 100, '%')}
  ${range('headerOpacity', '会话顶栏透明度', 0, 100, '%')}
  <div class="sao-right-settings">
    ${toggle('rightLinked', '右栏跟随会话', '同步会话的整面背景透明度、模糊和玻璃效果；关闭后按材质记忆独立参数。')}
    <div data-right-controls hidden>
      <fieldset>${fieldLegend('rightGlass', '右栏玻璃效果')}<div class="sao-choices sao-glass-choices">${choice('rightGlass', 'off', '关闭', '清晰原色')}${choice('rightGlass', 'frosted', '磨砂玻璃', '柔和模糊')}${choice('rightGlass', 'liquid', '液态玻璃', '通透折光')}</div></fieldset>
      ${range('rightOpacity', '右栏背景透明度', 0, 100, '%')}
      ${range('rightBlur', '右栏背景模糊', 0, 24, 'px')}
    </div>
    <fieldset>${fieldLegend('contextGlass', '上下文界面')}<p class="sao-hint">仅作用于右栏上下文卡片。每种材质单独记忆；液态初始透明度 20%、模糊 0px，磨砂初始透明度 35%。</p>
      <div class="sao-choices">${choice('contextGlass', 'follow', '跟随右栏', '')}${choice('contextGlass', 'frosted', '磨砂玻璃', '')}${choice('contextGlass', 'liquid', '液态玻璃', '')}${choice('contextGlass', 'off', '原始外观', '')}</div>
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
  <div class="sao-upload"><label for="${id('upload')}">上传自定义壁纸</label><input id="${id('upload')}" type="file" accept="image/*" aria-describedby="${id('upload-help')}"><p class="sao-hint" id="${id('upload-help')}">选择图片后自动保存并应用，建议使用横向图片。</p><button class="sao-btn" data-action="remove-upload" type="button" hidden>删除自定义壁纸</button></div>
  <div class="sao-fit"><span>适应方式</span><span>填充 · 默认</span></div>
  ${range('wallOpacity', '壁纸不透明度', 0, 100, '%')}
  ${range('wallX', '水平位置', 0, 100, '%')}
  ${range('wallY', '垂直位置', 0, 100, '%')}
  ${range('wallScale', '画面大小', 100, 250, '%')}
  <div class="sao-actions"><button class="sao-btn" type="button" data-action="reset-transform">重置位置与大小</button></div>
</section>
</div><aside class="sao-preview" aria-label="外观实时预览"><div class="sao-preview-label"><span>效果预览</span><span class="sao-live">实时</span></div><div class="sao-scene"><div class="sao-scene-wall" aria-hidden="true"><img alt="" hidden></div><div class="sao-scene-conversation" aria-hidden="true"></div><div class="sao-mini" data-glass="off"><div class="sao-mini-title"><span class="sao-mini-mark" aria-hidden="true"></span><span>Link Start</span></div><div class="sao-mini-component" role="img" aria-label="内容组件背景预览"><div class="sao-mini-line"></div><div class="sao-mini-line"></div></div><div class="sao-mini-composer">输入消息…</div></div></div><div class="sao-preview-meta"><span data-preview-glass></span><span data-preview-opacity></span><span data-preview-wall></span><span data-preview-wall-opacity></span></div><p class="sao-preview-note">所有设置即时生效。</p></aside></div>
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
  function announce(text, error) {
    if (disposed) return;
    status.textContent = text; status.dataset.error = error ? 'true' : 'false';
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
  function ensureAnimationPreviews() {
    const available = typeof api.animationPreviews === 'function' ? api.animationPreviews() : api.animationPreviews;
    for (const input of controls.filter(control => control.dataset.pref === 'animation')) {
      const content = input.nextElementSibling;
      const item = (Array.isArray(available) ? available : []).find(preview => preview && String(preview.id) === input.value);
      let image = content.querySelector('[data-animation-preview]');
      if (!item || typeof item.src !== 'string' || !item.src) { if (image) image.remove(); continue; }
      if (!image) { image = doc.createElement('img'); image.className = 'sao-animation-preview'; image.dataset.animationPreview = input.value; image.alt = '动画 ' + input.value + ' 预览'; image.decoding = 'async'; content.appendChild(image); }
      if (image.getAttribute('src') !== item.src) image.src = item.src;
    }
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
    if (custom) root.style.setProperty('--sao-accent', custom);
    else root.style.removeProperty('--sao-accent');
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
      root.style.setProperty('--sao-on-accent', light > .179 ? '#000000' : '#FFFFFF');
    } else root.style.removeProperty('--sao-on-accent');
    find('[data-color-label]').textContent = custom ? '当前主题色 ' + custom : '跟随 DSH 主题色';
    if (accent && accent !== latestColor) {
      latestColor = accent; hsvFromHex(accent);
      if (!hexDirty && doc.activeElement !== hex) hex.value = accent;
      if (colorExpanded) drawColor();
    }
  }
  function sync() {
    if (disposed) return;
    surfacePicker.sync(); ensureAnimationPreviews();
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
    root.style.fontFamily = '"' + family.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '",system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif';
    const conversation = find('.sao-scene-conversation');
    conversation.style.background = 'color-mix(in srgb,var(--sao-base) ' + Math.round(Math.max(0, Math.min(1, Number(prefs.conversationOpacity))) * 100) + '%,transparent)';
    const conversationBlur = Math.max(0, Math.min(24, Number(prefs.conversationBlur)));
    const blurFilter = conversationBlur > 0 ? 'blur(' + conversationBlur + 'px)' : 'none';
    conversation.style.backdropFilter = blurFilter;
    conversation.style.webkitBackdropFilter = conversation.style.backdropFilter;
    const mini = find('.sao-mini');
    mini.dataset.glass = prefs.glass;
    mini.style.background = 'color-mix(in srgb,var(--sao-base) ' + Math.round(Math.max(0, Math.min(1, Number(prefs.opacity))) * 100) + '%,transparent)';
    mini.style.backdropFilter = prefs.glass === 'off' ? 'none' : blurFilter;
    mini.style.webkitBackdropFilter = mini.style.backdropFilter;
    find('.sao-mini-title').style.background = 'color-mix(in srgb,var(--sao-base) ' + Math.round(Math.max(0, Math.min(1, Number(prefs.headerOpacity))) * 100) + '%,transparent)';
    find('.sao-mini-composer').style.background = 'color-mix(in srgb,var(--sao-base) ' + Math.round(Math.max(0, Math.min(1, Number(prefs.composerOpacity))) * 100) + '%,transparent)';
    find('.sao-mini-component').style.background = 'color-mix(in srgb,var(--sao-base) ' + Math.round(Math.max(0, Math.min(1, Number(prefs.componentOpacity))) * 100) + '%,transparent)';
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
    find('[data-preview-wall-opacity]').textContent = '背景 ' + Math.round(prefs.wallOpacity * 100) + '%';
  }
  const tabs = all('[data-tab]');
  function selectTab(tab, focus) {
    for (const button of tabs) {
      const selected = button === tab; button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
    }
    for (const section of all('[data-panel]')) section.hidden = section.dataset.panel !== tab.dataset.tab;
    if (focus) tab.focus();
  }
  for (const tab of tabs) {
    on(tab, 'click', () => selectTab(tab, false));
    on(tab, 'keydown', event => {
      let next;
      const current = tabs.indexOf(tab);
      if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (current + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); selectTab(tabs[next], true); }
    });
  }
  const themeControls = controls.filter(input => input.dataset.pref === 'theme');
  for (const input of controls) {
    on(input, input.type === 'range' ? 'input' : 'change', event => {
      const key = input.dataset.pref;
      if (input.type === 'radio' && !input.checked) return;
      if (key === 'theme') {
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
  on(previewButton, 'click', () => run(() => api.preview(), '正在预览', previewButton));
  on(find('[data-action="reset-transform"]'), 'click', () => apply({ wallX: 50, wallY: 50, wallScale: 100 }));
  const upload = find('#' + id('upload'));
  on(upload, 'change', () => {
    const file = upload.files && upload.files[0];
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) { announce('请选择图片文件后重试。', true); upload.value = ''; return; }
    run(async () => { await api.upload(file); await api.set({ wallpaper: 'custom' }); }, '正在保存壁纸', upload).then(() => { if (!disposed) upload.value = ''; });
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
    surfacePicker.cleanup();
    if (activePointer !== null && canvas.hasPointerCapture(activePointer)) canvas.releasePointerCapture(activePointer);
    for (const remove of removers) remove();
    root.remove();
  };
}
