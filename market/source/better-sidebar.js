/* Optional SAO adapter for dsh-better-sidebar 0.24.1.
 *
 * Merge saoBetterSidebarSelectors().components into appearance's componentSelector,
 * and append saoBetterSidebarCSS(materialBase) AFTER its generic component CSS.
 * The existing marking loop owns data-sao-component / --sao-component-alpha.
 * transparent is also exposed for structural-root classification; this helper
 * already emits its background rule, so callers need not emit that rule twice.
 *
 * Data attributes are preferred. CSS-module names below are exact 0.24.1
 * fallbacks, not substring matches or promises about a later package version.
 * Floating detail windows and Browser panes keep their separate material.
 */
function saoBetterSidebarSelectors() {
  const scope = ':is([data-dsh-native-tab-host],[data-dsh-bottom-panel])';
  const outsideWindows = ':not(:where([data-floating-window],[data-floating-window] *,[data-sao-browser-pane],[data-sao-browser-pane] *))';
  const inside = selector => `${scope} ${selector}${outsideWindows}`;
  return {
    components: [
      inside(':is([data-graph-node][data-depth],.d2hvtW_node)'),
      inside(':is([data-team-board],.d2hvtW_teamBoard)'),
      inside('.d2hvtW_jobsDrawer'),
      inside('[data-graph-controls]'),
      inside('.nArs4W_tabBar'),
      inside('.nArs4W_paneCard'),
      '[role="dialog"][data-shortcut-modal="settings"] ._2vuxea_section > ._2vuxea_group' + outsideWindows
    ].join(','),
    transparent: [
      `${scope}${outsideWindows}`,
      inside(':is([data-dsh-pane],.nArs4W_pane)'),
      inside('.bdiHEa_root')
    ].join(',')
  };
}

function saoBetterSidebarCSS(materialBase) {
  const { components, transparent } = saoBetterSidebarSelectors();
  const base = materialBase || 'var(--dsw-alias-bg-base,#f4f6f9)';
  const scope = ':is([data-dsh-native-tab-host],[data-dsh-bottom-panel])';
  const node = `${scope} :is([data-graph-node][data-depth],.d2hvtW_node)[data-sao-component]:not(:where([data-floating-window] *,[data-sao-browser-pane] *))`;
  const workflow = `${node}:is(:has([data-card-kind="workflow"]),.d2hvtW_nodeWorkflow)`;
  const entry = `${scope} .nArs4W_paneCard[data-sao-component]:not(:where([data-floating-window] *,[data-sao-browser-pane] *))`;
  const hover = 'var(--dsw-alias-interactive-bg-hover)';
  const workflowTint = 'color-mix(in srgb,var(--dsw-alias-state-business-primary) 6%,transparent)';
  return `
/* One neutral fill per component, no new positioning or pseudo-elements.
 * At --sao-component-alpha:0% the neutral layer contributes no paint; at 100%
 * it is opaque. Semantic tints, hover fills and disabled/settled opacity retain
 * their own meaning at both endpoints. Scene compensation stays in appearance.
 */
${transparent}{background:transparent!important}
:is(${components})[data-sao-component]{
  --sao-bs-neutral-fill:color-mix(in srgb,${base} var(--sao-component-alpha,100%),transparent);
  /* Undo ONLY the generic component rule's inherited layer-2 reset. Otherwise
   * settings switches/icon chips lose their native token inside a marked group.
   * No token is changed on body, a whole pane or third-party semantic controls.
   */
  --dsw-alias-bg-layer-2:inherit!important;
  background:var(--sao-bs-neutral-fill)!important;
}
/* The outer graph node supplies the only neutral base. Its identity segment
 * keeps the package's --card-tint depth ramp as an accent-only overlay. The
 * direct-child/data-kind shape is verified alongside the exact class fallback.
 */
${node} > :is(span:has(> span > [data-card-kind]),.d2hvtW_cardTop){
  background:color-mix(in srgb,var(--dsw-alias-state-business-primary) var(--card-tint,6%),transparent)!important;
}
${node} > :is([data-card-bar],.d2hvtW_cardBar){background-color:transparent!important}
/* Background images layer semantic feedback over the single neutral color.
 * Never touch borders, opacity, sizes, transforms or running-bar ::after.
 */
${node}:hover{background-image:linear-gradient(${hover},${hover})!important}
${workflow}{background-image:linear-gradient(${workflowTint},${workflowTint})!important}
${workflow}:hover{background-image:linear-gradient(${hover},${hover}),linear-gradient(${workflowTint},${workflowTint})!important}
${entry}:hover:not(:disabled){background-image:linear-gradient(${hover},${hover})!important}
/* Settings mark only the group, not .card/.cardOn; active fills, hover, focus,
 * switches and inputs remain native. Jobs rows/armed kill controls, editor,
 * terminal, diff, media and floating-window content are never component targets.
 * Changes sticky headers intentionally retain their opaque reading surface.
 */
`;
}
