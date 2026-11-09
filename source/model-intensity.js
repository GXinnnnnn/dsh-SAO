/*
 * SAO reasoning intensity — independent implementation over DSH's public services.
 * Integration: concatenate this file before the client apply(), then call
 * applySAOModelIntensity(ctx, React). Add slots, sessions, modelDirectories,
 * remote and remote.session to the client's inject array (Cordis caller context).
 * Manifest dsh.client.inject must include:
 * @deepseek-ai/dsh-client-ui-renderer, @deepseek-ai/dsh-client-ui-conversation,
 * @deepseek-ai/dsh-client-ui-model-selection. The latter supplies modelDirectories
 * and depends on @deepseek-ai/dsh-api-session-controller and dsh-api-remotes.
 * React is provided by the caller; no new runtime imports or private settings.
 * Call from the plugin apply body; do not return this helper's disposer to Cordis.
 *
 * Static contract checked against official 0.2.1-rc.5 and liang skin 0.1.12.
 * Only interface facts were used; no liang code, artwork, or styling is copied.
 * The official model picker remains installed, including its effort menu. Disable
 * the old liang skin at integration time to avoid two independently added sliders.
 */
function applySAOModelIntensity(ctx, React) {
  const h = React.createElement;
  const { useCallback, useEffect, useRef, useState, useSyncExternalStore } = React;
  if (!ctx.slots || !ctx.sessions || !ctx.modelDirectories) {
    throw new Error('SAO model intensity requires slots, sessions and modelDirectories');
  }
  let disposed = false;
  const emptySnapshot = Object.freeze({ current: null, groups: [], status: 'idle' });
  const emptyStore = { getSnapshot: () => emptySnapshot, subscribe: () => () => {} };
  const resets = new Set();
  const moveKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);

  const preferencesKey = 'dsh-sao.preferences.v4';
  function readMode() {
    try {
      return JSON.parse(window.localStorage.getItem(preferencesKey))?.featureMode === 'startup-only'
        ? 'startup-only' : 'all';
    } catch { return 'all'; }
  }
  let featureMode = readMode();
  let modeGeneration = 0;
  const modeListeners = new Set();
  const subscribeMode = listener => { modeListeners.add(listener); return () => modeListeners.delete(listener); };
  const getMode = () => featureMode;
  function updateMode(mode) {
    if (disposed || mode === featureMode) return;
    featureMode = mode;
    modeGeneration++;
    for (const listener of modeListeners) listener();
  }

  function describe(snapshot) {
    const selection = snapshot.current;
    const model = snapshot.groups?.find(group => group.id === selection?.provider)
      ?.models.find(item => item.id === selection?.model);
    const reasoning = model?.reasoning;
    const declared = (reasoning?.efforts ?? []).filter(level =>
      typeof level.id === 'string' && typeof level.name === 'string');
    // Official ModelSelect offers an undefined effort (provider default) when
    // the adapter does not advertise defaultEffort. It is a choice, not an error.
    const efforts = declared.length && reasoning.defaultEffort === undefined
      ? [{ id: undefined, name: '服务商默认' }, ...declared] : declared;
    const effective = selection?.reasoningEffort ?? reasoning?.defaultEffort;
    const selectedIndex = efforts.findIndex(level => level.id === effective);
    const defaultIndex = efforts.findIndex(level => level.id === reasoning?.defaultEffort);
    // An old effort may not exist on the new model. Anchor the thumb without
    // pretending this fallback is saved; choosing that same stop must still save.
    const index = selectedIndex >= 0 ? selectedIndex : Math.max(0, defaultIndex);
    // Include the saved effort and catalog shape: changing either invalidates a drag.
    const signature = JSON.stringify([selection?.provider, selection?.model,
      selection?.reasoningEffort, reasoning?.defaultEffort, efforts.map(level => [level.id, level.name])]);
    return { selection, efforts, index, selectedIndex, signature };
  }

  function Intensity({ directory, sessionId, available }) {
    const store = directory?.store ?? emptyStore;
    const subscribe = useCallback(listener => store.subscribe(listener), [store]);
    const getSnapshot = useCallback(() => store.getSnapshot(), [store]);
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    const model = describe(snapshot);
    const [draft, setDraft] = useState(null);
    const [pending, setPending] = useState(false);
    const [failure, setFailure] = useState('');
    const mounted = useRef(false);
    const interaction = useRef(null);
    const operation = useRef(null);
    const input = useRef(null);
    const pointer = useRef(null);
    const id = React.useId();

    useEffect(() => {
      mounted.current = true;
      const reset = () => {
        mounted.current = false;
        interaction.current = null;
        operation.current = null;
        // A captured pointer must not survive plugin disposal or a session change.
        const element = input.current;
        const pointerId = pointer.current;
        pointer.current = null;
        if (element && pointerId !== null && element.hasPointerCapture?.(pointerId)) {
          element.releasePointerCapture(pointerId);
        }
      };
      resets.add(reset);
      return () => { resets.delete(reset); reset(); };
    }, [directory, sessionId]);

    useEffect(() => {
      let active = true;
      if (available && directory && !disposed) {
        Promise.resolve().then(() => {
          if (active && mounted.current && !disposed) return directory.load();
        }).catch(() => {
          if (active && mounted.current && !disposed) setFailure('强度信息加载失败，请重新打开会话重试');
        });
      }
      return () => { active = false; };
    }, [directory, available, sessionId]);

    useEffect(() => {
      interaction.current = null;
      setDraft(null);
      setFailure('');
    }, [directory, sessionId, model.signature]);

    const unsupported = model.efforts.length === 0;
    const disabled = !available || !directory || !model.selection ||
      model.efforts.length < 2 || pending || snapshot.pending != null ||
      !['ready', 'error'].includes(snapshot.status);
    const index = draft ?? Math.max(0, model.index);
    const level = model.efforts[index];

    function cancel() {
      interaction.current = null;
      setDraft(null);
    }
    function begin() {
      if (disabled || disposed || featureMode !== 'all') return false;
      if (interaction.current === null) interaction.current = { signature: model.signature, index: model.index, modeGeneration };
      return true;
    }
    function preview(event) {
      if (!begin()) return;
      const value = Number(event.currentTarget.value);
      if (!Number.isInteger(value) || !model.efforts[value]) return;
      interaction.current.index = value;
      setDraft(value);
    }
    async function commit() {
      const gesture = interaction.current;
      interaction.current = null;
      if (!gesture || disposed || featureMode !== 'all' || !mounted.current || operation.current || disabled) return;
      const liveSnapshot = store.getSnapshot();
      const live = describe(liveSnapshot);
      if (gesture.modeGeneration !== modeGeneration || gesture.signature !== live.signature || liveSnapshot.pending != null ||
          !['ready', 'error'].includes(liveSnapshot.status)) {
        setDraft(null);
        return;
      }
      const target = live.efforts[gesture.index];
      if (!target || live.selectedIndex === gesture.index) { setDraft(null); return; }
      const token = {};
      operation.current = token;
      setPending(true);
      setFailure('');
      try {
        const result = await directory.select({
          provider: live.selection.provider,
          model: live.selection.model,
          ...(target.id === undefined ? {} : { reasoningEffort: target.id })
        });
        if (!result?.ok) throw new Error('selection-rejected');
      } catch {
        // Roll back the local preview only. A compensating RPC could overwrite a
        // newer choice made in the official picker while this request was pending.
        const now = describe(store.getSnapshot());
        if (!disposed && mounted.current && operation.current === token &&
            now.signature === live.signature) {
          setFailure('强度保存失败，已恢复当前档位，请重试');
        }
      } finally {
        if (!disposed && mounted.current && operation.current === token) {
          operation.current = null;
          setPending(false);
          setDraft(null);
        }
      }
    }
    function releaseCapture(event) {
      const element = event.currentTarget;
      const pointerId = pointer.current;
      pointer.current = null;
      if (pointerId !== null && element.hasPointerCapture?.(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
    }

    // The host renders this session slot only for existing sessions. Also guard
    // direct/test rendering and addressed subagent sessions without issuing RPCs.
    if (!sessionId || !available || !directory) return null;
    if (unsupported && !failure) return null;
    const unavailable = unsupported;
    const unmatched = !unsupported && model.selectedIndex < 0 && draft === null;
    const text = pending ? '保存中' : unmatched ? '未匹配' : level?.name ?? '强度不可用';
    return h('div', {
      className: 'sao-model-intensity',
      'data-state': failure ? 'error' : pending ? 'pending' : 'ready',
      'aria-busy': pending,
      title: failure || (unavailable ? '当前模型没有可用的思考强度档位' : unmatched
        ? `当前档位 ${model.selection.reasoningEffort ?? '默认'} 不在模型目录中，滑动可选择新档位；尚未更改模型设置`
        : `思考强度：${level.name}；可用档位：${model.efforts.map(item => item.name).join('、')}`)
    },
    h('span', { className: 'sao-model-intensity__label', 'aria-hidden': true }, '强度'),
    h('span', { className: 'sao-model-intensity__slider' },
    h('input', {
      ref: input, className: 'sao-model-intensity__range', type: 'range',
      min: 0, max: Math.max(0, model.efforts.length - 1), step: 1, value: index,
      disabled: disabled || unsupported,
      'aria-label': '模型思考强度', 'aria-valuetext': text,
      'aria-describedby': `${id}-levels ${id}-status`,
      onPointerDown(event) {
        if (!begin()) return;
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      },
      onInput: preview,
      // onChange covers assistive-technology value changes that have no key event.
      // Pointer/keyboard interactions remain previews until their explicit commit.
      onChange(event) {
        const active = interaction.current !== null;
        preview(event);
        if (!active && pointer.current === null) void commit();
      },
      onPointerUp(event) { releaseCapture(event); void commit(); },
      onPointerCancel(event) { releaseCapture(event); cancel(); },
      onLostPointerCapture() {
        if (pointer.current !== null) { pointer.current = null; cancel(); }
      },
      onKeyDown(event) {
        if (event.key === 'Escape' && interaction.current) {
          event.preventDefault(); event.stopPropagation(); cancel();
        } else if (moveKeys.has(event.key)) begin();
      },
      onKeyUp(event) { if (moveKeys.has(event.key)) void commit(); },
      onBlur(event) { releaseCapture(event); void commit(); }
    }),
    // Decorative marks share the thumb's inset; native datalist marks vary by
    // browser/theme and can introduce an opaque track or black ticks.
    h('span', { className: 'sao-model-intensity__ticks', 'aria-hidden': true },
      model.efforts.map((item, value) => h('i', {
        key: item.id === undefined ? 'provider-default' : `effort:${item.id}`, style: { left: `${model.efforts.length > 1 ? value / (model.efforts.length - 1) * 100 : 50}%` }
      })))),
    h('output', { className: 'sao-model-intensity__value', 'aria-hidden': true, title: text }, text),
    h('span', { id: `${id}-levels`, className: 'sao-model-intensity__sr' },
      model.efforts.length ? `可用档位：${model.efforts.map(item => item.name).join('、')}` : '当前模型不支持强度调整'),
    h('span', {
      id: `${id}-status`, className: failure ? 'sao-model-intensity__error' : 'sao-model-intensity__sr',
      role: failure ? 'alert' : 'status', 'aria-live': failure ? 'assertive' : 'polite'
    }, failure ? [
      h('span', { key: 'short', 'aria-hidden': true }, failure.includes('加载') ? '加载失败' : '保存失败'),
      h('span', { key: 'detail', className: 'sao-model-intensity__sr' }, failure)
    ] : pending ? '正在保存模型思考强度' : ''));
  }

  function Entry(props) {
    const mode = useSyncExternalStore(subscribeMode, getMode, getMode);
    return mode === 'all' ? h(Intensity, { ...props, key: props.sessionId ?? 'no-session' }) : null;
  }

  return ctx.effect(() => {
    const modeChanged = event => {
      const mode = event.detail?.mode;
      if (mode === 'all' || mode === 'startup-only') updateMode(mode);
    };
    const storageChanged = event => {
      if (event.key === preferencesKey || event.key === null) updateMode(readMode());
    };
    window.addEventListener('dsh-sao-mode-change', modeChanged);
    window.addEventListener('storage', storageChanged);
    const removeModeListeners = () => {
      window.removeEventListener('dsh-sao-mode-change', modeChanged);
      window.removeEventListener('storage', storageChanged);
    };
    const style = document.createElement('style');
    style.dataset.saoModelIntensity = '';
    style.textContent = `
.sao-model-intensity{--sao-intensity-color:var(--sao-accent,var(--dsw-alias-state-business-primary,#8bc3e3));position:relative;display:inline-grid;grid-template-columns:24px 92px 52px;align-items:center;justify-content:center;column-gap:5px;flex:0 0 auto;justify-self:center;height:28px;padding:0 4px;margin:0;border:0;border-radius:0;background:transparent;box-shadow:none;color:#000!important;font-family:inherit;font-size:11px;font-weight:400;line-height:1.3;white-space:nowrap;box-sizing:border-box}
.sao-model-intensity__label{font-weight:500;text-align:center;color:#000!important;background:transparent!important;box-shadow:none!important}
.sao-model-intensity__slider{position:relative;display:block;min-width:0;height:28px}
.sao-model-intensity__range{display:block;appearance:none;-webkit-appearance:none;width:100%;min-width:0;height:28px;padding:0;margin:0;border:0;border-radius:0;background:transparent;box-shadow:none;cursor:pointer;accent-color:var(--sao-intensity-color);transition:opacity 150ms ease,outline-color 150ms ease}
.sao-model-intensity__range::-webkit-slider-runnable-track{height:6px;border:0;border-radius:6px;background:linear-gradient(90deg,color-mix(in srgb,var(--sao-intensity-color) 88%,#000),var(--sao-intensity-color) 55%,color-mix(in srgb,var(--sao-intensity-color) 78%,#fff));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--sao-intensity-color) 60%,transparent),inset 0 1px 1px #ffffff40,0 1px 2px #0000001f}
.sao-model-intensity__range::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;box-sizing:border-box;width:14px;height:14px;margin-top:-4px;border:1px solid color-mix(in srgb,var(--sao-intensity-color) 22%,#c2cbd2);border-radius:50%;background:linear-gradient(160deg,#fff 8%,color-mix(in srgb,#fff 94%,var(--sao-intensity-color)) 48%,color-mix(in srgb,#fff 82%,var(--sao-intensity-color)));box-shadow:inset 0 1px 0 #fffffff2,0 1px 3px #00000038;transition:box-shadow 150ms ease,transform 150ms ease}
.sao-model-intensity__range::-moz-range-track{height:6px;border:0;border-radius:6px;background:linear-gradient(90deg,color-mix(in srgb,var(--sao-intensity-color) 88%,#000),var(--sao-intensity-color) 55%,color-mix(in srgb,var(--sao-intensity-color) 78%,#fff));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--sao-intensity-color) 60%,transparent),inset 0 1px 1px #ffffff40,0 1px 2px #0000001f}
.sao-model-intensity__range::-moz-range-thumb{box-sizing:border-box;width:14px;height:14px;border:1px solid color-mix(in srgb,var(--sao-intensity-color) 22%,#c2cbd2);border-radius:50%;background:linear-gradient(160deg,#fff 8%,color-mix(in srgb,#fff 94%,var(--sao-intensity-color)) 48%,color-mix(in srgb,#fff 82%,var(--sao-intensity-color)));box-shadow:inset 0 1px 0 #fffffff2,0 1px 3px #00000038;transition:box-shadow 150ms ease,transform 150ms ease}
.sao-model-intensity__range:enabled:hover::-webkit-slider-thumb{box-shadow:inset 0 1px 0 #fffffff2,0 1px 3px #00000038,0 0 0 2px color-mix(in srgb,var(--sao-intensity-color) 18%,transparent)}
.sao-model-intensity__range:enabled:hover::-moz-range-thumb{box-shadow:inset 0 1px 0 #fffffff2,0 1px 3px #00000038,0 0 0 2px color-mix(in srgb,var(--sao-intensity-color) 18%,transparent)}
.sao-model-intensity__range:enabled:active::-webkit-slider-thumb{transform:scale(1.06)}
.sao-model-intensity__range:enabled:active::-moz-range-thumb{transform:scale(1.06)}
.sao-model-intensity__range:focus-visible{outline:2px solid var(--sao-intensity-color);outline-offset:2px;border-radius:5px}
.sao-model-intensity__range:disabled{cursor:default;opacity:.48}
.sao-model-intensity__ticks{position:absolute;left:7px;right:7px;top:23px;height:2px;pointer-events:none}
.sao-model-intensity__ticks i{position:absolute;top:0;width:2px;height:2px;transform:translateX(-50%);border-radius:50%;background:color-mix(in srgb,var(--sao-intensity-color) 55%,transparent)}
.sao-model-intensity__value{display:block;min-width:0;width:100%;overflow:hidden;text-overflow:ellipsis;text-align:left;font:inherit;color:#000!important;background:transparent!important;box-shadow:none!important}
.sao-model-intensity__error{position:absolute;top:calc(100% - 1px);right:12px;color:var(--dsw-alias-state-error,#c57070);font-size:10px;font-weight:400;line-height:1.2}
.sao-model-intensity__sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
/* Liang adds a fixed-width right-slot rail beside the native picker. Keep that
   adjacency without replacing the picker or reparenting React-owned nodes.
   Trim 12px of trailing value whitespace: the label/track/value move toward
   the picker at every breakpoint without shortening the draggable track.
   Its outlet reserves the rail's complete width as an inseparable leading margin;
   the rail occupies that reservation, anchored to the same local parent. Other
   right-slot plugins can wrap before this pair. Public slot names scope all rules,
   so hiding/unmounting our control restores the host's original layout and ink. */
:where(div):has(> [data-slot="conversation.input.right"] .sao-model-intensity){--sao-intensity-control-width:186px;--sao-intensity-picker-width:138px;position:relative;flex-wrap:wrap;justify-content:flex-end;gap:2px;max-width:calc(100cqw - 58px)}
:where(div):has(> div > [data-slot="conversation.input.right"] .sao-model-intensity){max-width:100%}
:where(div):has(> [data-slot="conversation.input.right"] .sao-model-intensity) .sao-model-intensity{position:absolute;inset-inline-end:calc(var(--sao-intensity-picker-width) + 2px);bottom:0;width:var(--sao-intensity-control-width)}
:where(div):has(> [data-slot="conversation.input.right"] .sao-model-intensity)>[data-slot="conversation.input.right"]>:not(.sao-model-intensity){max-width:100%;min-width:0}
:where(div):has(> [data-slot="conversation.input.right"] .sao-model-intensity)>[data-slot="conversation.input.model"]{display:block!important;flex:0 0 var(--sao-intensity-picker-width);width:var(--sao-intensity-picker-width);min-width:0;height:28px;align-self:flex-end;order:1;margin-inline-start:calc(var(--sao-intensity-control-width) + 2px)}
:where(div):has(> [data-slot="conversation.input.right"] .sao-model-intensity)>[data-slot="conversation.input.model"]>div{width:100%;min-width:0}
:where(div):has(> [data-slot="conversation.input.right"] .sao-model-intensity)>[data-slot="conversation.input.model"]>div>button{box-sizing:border-box;width:100%;max-width:100%;color:#000!important;background:transparent!important;box-shadow:none!important;border-radius:4px;transition:outline-color 150ms ease}
:where(div):has(> [data-slot="conversation.input.right"] .sao-model-intensity)>[data-slot="conversation.input.model"]>div>button *{color:#000!important;background:transparent!important}
:where(div):has(> [data-slot="conversation.input.right"] .sao-model-intensity)>[data-slot="conversation.input.model"]>div>button:focus-visible{outline:2px solid var(--sao-accent,var(--dsw-alias-state-business-primary,#8bc3e3));outline-offset:2px}
@media(prefers-reduced-motion:reduce){
.sao-model-intensity__range,:where(div):has(> [data-slot="conversation.input.right"] .sao-model-intensity)>[data-slot="conversation.input.model"]>div>button{transition:none}
.sao-model-intensity__range::-webkit-slider-thumb{transition:none}
.sao-model-intensity__range::-moz-range-thumb{transition:none}
}
@media(max-width:520px){.sao-model-intensity{grid-template-columns:22px 80px 48px}.sao-model-intensity__error{right:4px}:where(div):has(> [data-slot="conversation.input.right"] .sao-model-intensity){--sao-intensity-control-width:168px}}
@media(max-width:360px){.sao-model-intensity{grid-template-columns:20px 68px 44px;column-gap:4px}:where(div):has(> [data-slot="conversation.input.right"] .sao-model-intensity){--sao-intensity-control-width:148px}}
/* The row is the official inline-size container, including narrow sidebars. */
@container(width<=560px){
.sao-model-intensity{grid-template-columns:22px 80px 48px}
.sao-model-intensity__error{right:4px}
:where(div):has(> [data-slot="conversation.input.right"] .sao-model-intensity){--sao-intensity-control-width:168px;--sao-intensity-picker-width:112px;max-width:calc(100cqw - 50px)}
}
@container(width<=360px){
.sao-model-intensity{grid-template-columns:20px 68px 44px;column-gap:4px}
:where(div):has(> [data-slot="conversation.input.right"] .sao-model-intensity){--sao-intensity-control-width:148px;--sao-intensity-picker-width:72px}
}
@container(width<=280px){
.sao-model-intensity{grid-template-columns:20px 56px 44px;padding-inline:0}
.sao-model-intensity__error{right:0}
:where(div):has(> [data-slot="conversation.input.right"] .sao-model-intensity){--sao-intensity-control-width:128px;--sao-intensity-picker-width:28px}
:where(div):has(> [data-slot="conversation.input.right"] .sao-model-intensity)>[data-slot="conversation.input.model"]{--dsh-composer-model-text-display:none;--dsh-composer-model-icon-display:block}
}
`;
    document.head.append(style);
    let unregister;
    try {
      unregister = ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
        name: 'conversation.input.right', id: 'sao-model-intensity', order: 10,
        inject(sessionId) {
          if (!sessionId || disposed || ctx.sessions.subagentAddress(sessionId) !== undefined) {
            return { sessionId, available: false, directory: null };
          }
          if (typeof ctx.sessions.scope === 'function' && !ctx.sessions.scope(sessionId)) {
            return { sessionId, available: false, directory: null };
          }
          return { sessionId, available: true, directory: ctx.modelDirectories.directoryFor(sessionId) };
        }
      }, Entry));
    } catch (error) {
      removeModeListeners();
      style.remove();
      throw error;
    }
    return () => {
      if (disposed) return;
      disposed = true;
      removeModeListeners();
      modeListeners.clear();
      for (const reset of resets) reset();
      resets.clear();
      if (typeof unregister === 'function') unregister();
      style.remove();
    };
  }, 'SAO model reasoning intensity');
}
