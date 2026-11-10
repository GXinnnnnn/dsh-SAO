/* SAO control states. Plain source: concatenate inside the client factory and call
 * applySAOControlStates(ctx) once. No React, token service, DOM observer or timers.
 *
 * Independently implemented after studying Aqua's separate card/control glass
 * recipes and Kimino's progressive hover fills + inset light/depth edges:
 * https://github.com/WYH66666666/DSH-Transparent-UI-Plugin/blob/main/src/client/aqua.module.css
 * https://github.com/niiang/dsh-kimino-theme/blob/main/bundle/client.js
 * No external code, artwork, fixed palette or layout is copied.
 *
 * Native fallbacks verified against the installed DSH frontend's Pill, Switch
 * and Menu CSS/JS (index-BgUyXZcc.js / index-lh_YM6sT.css). Pill.active and
 * Menu.selected currently have no corresponding ARIA state. Exact class names
 * below deliberately fail closed if DSH recompiles them; semantic paths survive.
 */
function applySAOControlStates(ctx) {
  'use strict';
  const win = window, doc = win.document;
  const instanceKey = Symbol.for('dsh.sao.control-states.v1');
  win[instanceKey]?.dispose?.();

  const preferenceKey = 'dsh-sao.preferences.v4';
  const marker = 'data-sao-controls';
  const root = doc.documentElement;
  const previousMarker = root.getAttribute(marker);
  const style = doc.createElement('style');
  style.setAttribute('data-sao-control-states', '');
  let disposed = false, enabled = false;

  // Exclude the control AND any semantic disabled/danger/inert ancestor. Keep
  // unknown data-disabled/data-danger values conservative; explicit false is OK.
  // Native menus, SAO settings and every non-conversation tab keep their owner
  // styles, even when an ARIA/data-state button fallback would otherwise match.
  const blocked = ':is(:disabled,[aria-disabled="true"],[data-disabled]:not([data-disabled="false"]),[inert],[data-danger]:not([data-danger="false"]),[data-variant="danger"],[data-variant="destructive"],[data-variant="error"],[data-tone="danger"],[data-tone="error"],[data-status="error"],[data-state="error"],[data-state="failed"],[aria-invalid="true"],[class*="_danger_"],[class*="_destructive_"],[role="menu"],[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[data-sao-settings],[role="tab"]:not([data-slot="conversation.header"] [data-conversation-tabs]>[role="tab"]))';
  const safe = `:not(${blocked}):not(:is(${blocked} *))`;
  const scope = `html[${marker}="all"]`;
  const nativePill = 'button._pill_rs966_1._interactive_rs966_16';
  const nativeSwitch = 'button._switch_1ik0f_5[role="switch"]';
  const candidates = `:is(${nativePill},[role="switch"],[role="checkbox"],[role="radio"],[role="tab"],[role="option"],button[aria-pressed],[role="button"][aria-pressed],button[aria-selected],button[aria-checked],button[data-state],button[data-on],button[data-off],[role="button"][data-state],[role="button"][data-on],[role="button"][data-off])`;
  // Conversation tabs have their own lighter recipe below. Do not stack the
  // generic selected bottom edge under a circular one-pixel outline.
  const control = `${scope} ${candidates}${safe}:not([data-conversation-tabs]>[role="tab"])`;
  // An explicit false ARIA state must win over an obsolete native active class.
  const selected = ':is([aria-checked="true"],[aria-checked="mixed"],[aria-selected="true"],[aria-pressed="true"],[aria-pressed="mixed"],[aria-current="page"],[aria-current="true"],[data-state="checked"],[data-state="indeterminate"],[data-state="selected"],[data-state="pressed"],[data-state="active"],[data-state="on"],[data-on]:not([data-on="false"]):not([data-state="off"]):not([data-off]:not([data-off="false"])),._pill_rs966_1._active_rs966_26:not([aria-checked="false"]):not([aria-pressed="false"]):not([aria-selected="false"]))';
  const off = ':is([aria-checked="false"],[data-state="unchecked"],[data-state="off"],[data-off]:not([data-off="false"]),[data-on="false"])';
  const nativeTrack = `${scope} ${nativeSwitch}${safe}`;
  // Match generic selection specificity before narrowing to the native compact
  // switch, otherwise its selected bottom-edge recipe wins over track styling.
  const nativeOn = `${control}${selected}:is(${nativeSwitch})[aria-checked="true"]`;
  const input = `${scope} input:is([type="checkbox"],[type="radio"])${safe}`;
  // Official ConversationRoot owns this row, populated from conversation.view:
  // chat (ui-chat), trajectory (ui-trajectory), context/fleet (dsh-context),
  // stats (experimental-client-ui-stats). The stable seam is present in both
  // official source and the authenticated GUI; no label/hashed-class matching.
  const conversationTabs = `${scope} [data-slot="conversation.header"] [data-conversation-tabs][role="tablist"]`;
  const conversationTabBox = `${conversationTabs}>button[role="tab"]`;
  const conversationControl = `${conversationTabBox}${safe}`;
  // The slot wrapper is display:contents in the real host. Space the actual
  // ConversationRoot row, so pills cannot hang below its header paint box.
  const conversationRow = `${scope} [data-slot="conversation.header"] header div:has(>[data-conversation-tabs][role="tablist"])`;
  const material = `${scope} [data-sao-material]:is([data-sao-material="liquid"],[data-sao-material="frosted"]):not([data-sao-surface="joined"])${safe}::before`;

  style.textContent = `
${scope}{
  --sao-control-ink:var(--dsw-alias-label-primary,CanvasText);
  --sao-control-accent:var(--dsw-alias-brand-primary,Highlight);
  --sao-control-edge:color-mix(in srgb,var(--sao-control-accent) 65%,var(--sao-control-ink));
  --sao-control-rest:color-mix(in srgb,var(--sao-control-ink) 5%,transparent);
  --sao-control-hover:color-mix(in srgb,var(--sao-control-ink) 11%,transparent);
  --sao-control-down:color-mix(in srgb,var(--sao-control-ink) 19%,transparent);
  /* Temper arbitrary user accents against the scheme's base before layering;
     bright orange/white must not wash out dark-mode text during a press. */
  --sao-control-tint:color-mix(in srgb,var(--sao-control-accent) 50%,var(--dsw-alias-bg-base,Canvas));
  --sao-control-selected:color-mix(in srgb,var(--sao-control-tint) 23%,var(--sao-control-rest));
  --sao-control-selected-hover:color-mix(in srgb,var(--sao-control-tint) 32%,var(--sao-control-hover));
  --sao-control-selected-down:color-mix(in srgb,var(--sao-control-tint) 42%,var(--sao-control-down));
  --sao-control-stroke:color-mix(in srgb,var(--sao-control-ink) 20%,transparent);
  --sao-switch-stroke:color-mix(in srgb,var(--sao-control-ink) 12%,var(--sao-control-accent) 8%);
  --sao-switch-thumb:color-mix(in srgb,var(--sao-control-ink) 65%,var(--dsw-alias-bg-base,Canvas));
  --sao-control-sheen:color-mix(in srgb,white 35%,transparent);
  --sao-control-focus:var(--dsw-focus-ring-color,var(--sao-control-edge));
}
/* Inset strokes add no dimensions. Host checkmarks, thumbs and tab indicators
   remain in place; selected also gains a bottom edge, not color alone. */
${control}{
  background-color:var(--sao-control-rest)!important;
  color:var(--sao-control-ink)!important;
  box-shadow:inset 0 0 0 1px var(--sao-control-stroke),inset 0 1px 0 var(--sao-control-sheen)!important;
}
${control}${off}{background-color:color-mix(in srgb,var(--sao-control-ink) 9%,transparent)!important}
${control}${selected}{
  background-color:var(--sao-control-selected)!important;
  box-shadow:inset 0 0 0 1px var(--sao-control-edge),inset 0 -2px 0 var(--sao-control-edge),inset 0 1px 0 var(--sao-control-sheen)!important;
}
@media(hover:hover){
  ${control}:hover{background-color:var(--sao-control-hover)!important}
  ${control}${selected}:hover{background-color:var(--sao-control-selected-hover)!important}
}
${control}:active{background-color:var(--sao-control-down)!important}
${control}${selected}:active{background-color:var(--sao-control-selected-down)!important}
/* Keep native compact switch dimensions, off paint and thumb translation.
   Selected tracks get one concentric stroke, with no lower strip or sheen.
   A role=switch wrapping a label is intentionally not treated as a tiny track. */
/* Resolve the current page accent here: root aliases predate the SAO palette. */
${nativeTrack}{
  --sao-switch-selected:color-mix(in srgb,var(--dsw-alias-brand-primary,Highlight) 92%,black);
  --sao-switch-selected-hover:color-mix(in srgb,var(--dsw-alias-brand-primary,Highlight) 94%,black);
  --sao-switch-selected-down:color-mix(in srgb,var(--dsw-alias-brand-primary,Highlight) 90%,black);
}
${nativeTrack}${off}{background-color:color-mix(in srgb,var(--sao-control-ink) 25%,var(--dsw-alias-bg-base,Canvas))!important}
${nativeOn}{background-color:var(--sao-switch-selected)!important;box-shadow:inset 0 0 0 1px var(--sao-switch-stroke)!important}
${nativeOn}>._thumb_1ik0f_33{background-color:var(--sao-switch-thumb)!important}
@media(hover:hover){
  ${nativeTrack}${off}:hover{background-color:color-mix(in srgb,var(--sao-control-ink) 32%,var(--dsw-alias-bg-base,Canvas))!important}
  ${nativeOn}:hover{background-color:var(--sao-switch-selected-hover)!important}
}
${nativeTrack}${off}:active{background-color:color-mix(in srgb,var(--sao-control-ink) 39%,var(--dsw-alias-bg-base,Canvas))!important}
${nativeOn}:active{background-color:var(--sao-switch-selected-down)!important}
${input}{accent-color:var(--sao-control-edge)}
/* Never suppress the host keyboard ring; menu items that only had a focus fill
   receive the same visible ring as switches and inputs. */
${control}:focus-visible,${conversationControl}:focus-visible,${input}:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--sao-control-focus)!important;outline-offset:2px!important}
/* Compact pills stay inside the actual header row. Its six-pixel lower
   padding plus the tablist's three-pixel inset separate pills from the header
   edge. The display:contents slot itself cannot provide that spacing. */
${conversationRow}{align-items:center!important;margin-top:6px!important;padding-top:0!important;padding-bottom:6px!important}
${conversationTabs}{box-sizing:border-box!important;align-self:center;align-items:center!important;flex-wrap:nowrap!important;gap:6px!important;width:fit-content!important;min-width:max-content!important;max-width:none!important;height:auto!important;min-height:30px!important;flex:0 0 auto!important;padding:3px!important;margin:0!important;border-radius:999px!important;corner-shape:round!important}
${conversationTabBox}{box-sizing:border-box!important;flex:0 0 auto!important;width:auto!important;height:auto!important;min-height:24px!important;margin:0!important;padding:3px 9px!important;line-height:18px!important;border-radius:999px!important;corner-shape:round!important}
/* The header owns the glass scene; these pills only add a trace of tint.
   Use one concentric stroke with no directional shadow or bottom highlight. */
${conversationTabs}${safe}{
  background:transparent!important;
  box-shadow:none!important;
  --sao-view-base:var(--dsw-alias-bg-base,Canvas);
  --sao-view-selected:color-mix(in srgb,var(--sao-control-accent) 8%,var(--sao-view-base) 5%);
  --sao-view-selected-hover:color-mix(in srgb,var(--sao-control-accent) 12%,var(--sao-view-base) 6%);
  --sao-view-selected-down:color-mix(in srgb,var(--sao-control-accent) 16%,var(--sao-view-base) 8%);
  --sao-view-stroke:color-mix(in srgb,var(--sao-control-ink) 8%,var(--sao-control-accent) 6%);
}
${conversationControl}{background:color-mix(in srgb,var(--sao-control-ink) 1.5%,transparent)!important;color:var(--sao-control-ink)!important;border:0!important;box-shadow:none!important;transition:background-color .15s,color .15s}
${conversationControl}${selected}{background:var(--sao-view-selected)!important;box-shadow:inset 0 0 0 1px var(--sao-view-stroke)!important}
@media(hover:hover){
  ${conversationControl}:hover{background:color-mix(in srgb,var(--sao-control-accent) 3%,var(--sao-view-base) 7%)!important}
  ${conversationControl}${selected}:hover{background:var(--sao-view-selected-hover)!important}
}
${conversationControl}:active{background:color-mix(in srgb,var(--sao-control-accent) 5%,var(--sao-view-base) 10%)!important}
${conversationControl}${selected}:active{background:var(--sao-view-selected-down)!important}
/* The host underline must not add a second lower edge to the circular stroke. */
${conversationTabBox}::after{display:none!important;background-color:transparent!important}
@media(prefers-reduced-motion:reduce){${conversationControl}{transition:none!important}}
/* Existing material fill/blur/opacity stay under appearance.js ownership.
   The two edge lights scale down to zero at fully clear/opaque surfaces. */
${material}{box-shadow:inset 0 1px 0 color-mix(in srgb,white calc(32% * var(--sao-optical-strength,1)),transparent),inset 0 -1px 0 color-mix(in srgb,var(--sao-control-ink) calc(18% * var(--sao-optical-strength,1)),transparent),inset 0 0 0 1px color-mix(in srgb,var(--sao-control-ink) calc(10% * var(--sao-optical-strength,1)),transparent)!important}
@media(forced-colors:active){
  ${control},${conversationControl}{background:Canvas!important;color:CanvasText!important;box-shadow:none!important;outline:1px solid ButtonText!important;outline-offset:-1px!important}
  ${control}${selected},${conversationControl}${selected}{background:Highlight!important;color:HighlightText!important;outline:2px solid Highlight!important}
  ${nativeOn},${nativeOn}:hover,${nativeOn}:active{background:Highlight!important;color:HighlightText!important;box-shadow:none!important;outline:2px solid Highlight!important}
  ${nativeTrack}${off}{background-color:Canvas!important}
  ${nativeOn}>._thumb_1ik0f_33{background-color:HighlightText!important}
  ${control}:focus-visible,${conversationControl}:focus-visible,${input}:focus-visible{outline:2px solid Highlight!important;outline-offset:2px!important}
  ${material}{box-shadow:none!important}
  ${conversationTabs}${safe}{background-color:Canvas!important;box-shadow:none!important}
}
`;

  function readMode() {
    try {
      const prefs = JSON.parse(win.localStorage.getItem(preferenceKey) || 'null');
      // The existing installation predates featureMode; its default is all.
      // Unknown explicit values fail closed until the mode owner normalizes them.
      return prefs?.featureMode == null ? 'all' : prefs.featureMode;
    } catch { return 'all'; }
  }
  function setMode(mode) {
    if (disposed) return;
    enabled = mode === 'all';
    if (enabled) {
      root.setAttribute(marker, 'all');
      if (!style.isConnected) (doc.head || root).appendChild(style);
    } else {
      style.remove();
      if (root.getAttribute(marker) === 'all') {
        if (previousMarker === null) root.removeAttribute(marker);
        else root.setAttribute(marker, previousMarker);
      }
    }
  }
  function modeChange(event) {
    // detail.mode is authoritative even before the mode owner persists storage.
    if (typeof event.detail?.mode === 'string') setMode(event.detail.mode);
  }
  function storageChange(event) {
    if (event.key === preferenceKey || event.key === null) setMode(readMode());
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    style.remove();
    if (enabled && root.getAttribute(marker) === 'all') {
      if (previousMarker === null) root.removeAttribute(marker);
      else root.setAttribute(marker, previousMarker);
    }
    win.removeEventListener('dsh-sao-mode-change', modeChange);
    win.removeEventListener('storage', storageChange);
    if (win[instanceKey] === controller) delete win[instanceKey];
  }
  const controller = {dispose};
  win[instanceKey] = controller;
  ctx.effect(() => {
    win.addEventListener('dsh-sao-mode-change', modeChange);
    win.addEventListener('storage', storageChange);
    setMode(readMode());
    return dispose;
  }, 'dsh-SAO control states');
  return controller;
}
