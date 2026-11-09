/* Native compositor video wallpaper. Embed this plain-source const before appearance.
 * The caller owns the source ObjectURL and the always-present poster <img>; GL
 * should continue sampling that static image, never this video or a frame loop.
 * A helper-owned stylesheet hides only the poster's visibility while playing,
 * avoiding double opacity composition without changing its inline style or src.
 *
 * validate(file) -> {kind:'video', poster:Blob, meta:{width,height,duration,bytes,type}}
 * create(img, onStatus?) -> {element, set({source,enabled,quality}), sync(), dispose(), status, meta}
 * set accepts partial updates; enabled means full mode + custom video wallpaper.
 * quality defaults to balanced; still and reduced motion unload the video source.
 * Call sync after changing image styles (a style MutationObserver also does this).
 * Playback failure is latched until source changes; there is no automatic retry.
 * onStatus receives {state,reason,fallback,error,meta}; callback errors are isolated.
 *
 * Browser lifecycle references (consulted 2026-11-09):
 * https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
 * https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preload
 * https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loadeddata_event
 * https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play
 * https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/load
 * https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static
 */
const SAOVideoWallpaper = (() => {
  'use strict';
  const limits = Object.freeze({bytes: 200 * 1024 * 1024, duration: 30, longEdge: 5120, shortEdge: 2880, posterEdge: 1600, timeout: 10000});
  const failure = (code, message) => Object.assign(new Error(message), {code});
  function unload(video) {
    // load() aborts pending media work and releases the old resource. A bare
    // src='' would resolve to the document URL, so remove the attribute instead.
    try { video.pause(); } catch (_) {}
    video.removeAttribute('src');
    try { video.load(); } catch (_) {}
  }
  function metadata(video) {
    const width = video.videoWidth, height = video.videoHeight, duration = video.duration;
    if (![width, height, duration].every(n => Number.isFinite(n) && n > 0)) {
      throw failure('metadata', '无法读取有效的视频尺寸或时长。');
    }
    if (duration > limits.duration) throw failure('duration', '视频最长为 30 秒。');
    if (Math.max(width, height) > limits.longEdge || Math.min(width, height) > limits.shortEdge) {
      throw failure('resolution', '视频长边不能超过 5120，短边不能超过 2880（支持横竖屏，最高 5K）。');
    }
    return {width, height, duration};
  }
  function waitForMedia(video, events, ready, start, code) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        for (const event of events) video.removeEventListener(event, check);
        video.removeEventListener('error', onError);
        error ? reject(error) : resolve();
      };
      const check = () => { if (ready()) finish(); };
      const onError = () => finish(failure('decode', '浏览器无法解码此 MP4/WebM 视频。'));
      const timer = setTimeout(() => finish(failure(code, code === 'metadata-timeout' ? '视频元数据加载超时（10 秒）。' : '视频首帧加载超时（10 秒）。')), limits.timeout);
      for (const event of events) video.addEventListener(event, check);
      video.addEventListener('error', onError);
      try { start(); check(); } catch (error) { finish(error); }
    });
  }
  async function validate(file) {
    if (!(file instanceof Blob) || !['video/mp4', 'video/webm'].includes(file.type)) {
      throw failure('type', '请选择 MP4 或 WebM 视频。');
    }
    if (!file.size || file.size > limits.bytes) throw failure('bytes', '视频不能为空，且不能超过 200 MiB。');
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    let url = '', canvas = null;
    try {
      url = URL.createObjectURL(file);
      await waitForMedia(video, ['loadedmetadata'], () => video.readyState >= 1, () => {
        video.src = url;
        video.load();
      }, 'metadata-timeout');
      // Validate before requesting a decoded poster frame or allocating canvas.
      const meta = {...metadata(video), bytes: file.size, type: file.type};
      await waitForMedia(video, ['loadeddata', 'seeked'], () => video.readyState >= 2 && !video.seeking, () => {
        video.preload = 'auto';
        // A small seek requests a frame even on engines that suspended after metadata.
        video.currentTime = Math.min(0.01, meta.duration / 2);
      }, 'frame-timeout');
      // Recheck in case the decoder revised dimensions after initial metadata.
      Object.assign(meta, metadata(video));
      canvas = document.createElement('canvas');
      const scale = Math.min(1, limits.posterEdge / Math.max(meta.width, meta.height));
      canvas.width = Math.max(1, Math.round(meta.width * scale));
      canvas.height = Math.max(1, Math.round(meta.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw failure('canvas', '无法生成视频静态封面。');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const poster = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(failure('poster-timeout', '视频封面生成超时。')), limits.timeout);
        try {
          canvas.toBlob(blob => {
            clearTimeout(timer);
            if (blob?.size && blob.type === 'image/webp') resolve(blob);
            else reject(failure('poster', '浏览器无法生成 WebP 视频封面。'));
          }, 'image/webp', 0.82);
        } catch (error) { clearTimeout(timer); reject(error); }
      });
      return {kind: 'video', poster, meta};
    } finally {
      try {
        unload(video);
        if (canvas) { canvas.width = 0; canvas.height = 0; }
      } finally {
        if (url) URL.revokeObjectURL(url);
      }
    }
  }
  let nextPosterOwner = 0;
  function create(imageElement, onStatus) {
    const doc = imageElement?.ownerDocument;
    const win = doc?.defaultView;
    if (!win || !imageElement.parentNode) throw new TypeError('需要已挂载的壁纸图片元素。');
    const video = doc.createElement('video');
    video.dataset.saoVideo = '';
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.disablePictureInPicture = true;
    video.disableRemotePlayback = true;
    video.preload = 'metadata';
    video.setAttribute('aria-hidden', 'true');
    video.setAttribute('playsinline', '');
    video.setAttribute('disablepictureinpicture', '');
    video.tabIndex = -1;
    imageElement.after(video);
    // Visibility keeps the poster decoded and available to canvas/GL. A scoped
    // attribute rule avoids mutating the inline styles copied onto the video,
    // and cannot feed back into the style-only MutationObserver below.
    const posterAttribute = 'data-sao-video-poster';
    const originalPosterOwner = imageElement.getAttribute(posterAttribute);
    let posterOwner;
    do { posterOwner = `sao-video-${++nextPosterOwner}`; } while (posterOwner === originalPosterOwner);
    const posterStyle = doc.createElement('style');
    posterStyle.dataset.saoVideoPosterStyle = '';
    posterStyle.textContent = `[${posterAttribute}="${posterOwner}"]{visibility:hidden!important}`;
    // Keep the rule in the image's own tree, including a possible shadow root.
    imageElement.parentNode.appendChild(posterStyle);
    const hidePoster = hidden => {
      if (hidden) {
        if (imageElement.getAttribute(posterAttribute) !== posterOwner) imageElement.setAttribute(posterAttribute, posterOwner);
      } else if (imageElement.getAttribute(posterAttribute) === posterOwner) {
        if (originalPosterOwner === null) imageElement.removeAttribute(posterAttribute);
        else imageElement.setAttribute(posterAttribute, originalPosterOwner);
      }
    };
    let source = '', enabled = false, quality = 'balanced', disposed = false;
    let focused = typeof doc.hasFocus !== 'function' || doc.hasFocus();
    let attached = '', pending = false, generation = 0, error = null, meta = null;
    let status = Object.freeze({state: 'idle', reason: 'disabled', fallback: true, error: null, meta: null});
    const removers = [];
    const motion = win.matchMedia?.('(prefers-reduced-motion: reduce)');
    const listen = (target, event, handler) => {
      target.addEventListener(event, handler);
      removers.push(() => target.removeEventListener(event, handler));
    };
    const notify = (state, reason) => {
      if (status.state === state && status.reason === reason && status.error === error && status.meta === meta) return;
      status = Object.freeze({state, reason, fallback: state !== 'playing', error, meta});
      try { onStatus?.(status); } catch (_) {}
    };
    const show = visible => {
      hidePoster(visible);
      video.hidden = !visible;
      // img uses inline display:block, which would override the UA [hidden] rule.
      video.style.display = visible ? imageElement.style.display : 'none';
    };
    const detach = () => {
      generation++;
      pending = false;
      attached = '';
      show(false);
      unload(video);
    };
    const stop = reason => {
      generation++;
      pending = false;
      video.pause();
      show(false);
      notify(source && enabled ? 'paused' : 'idle', reason);
    };
    const fail = reason => {
      error = reason instanceof Error ? reason : failure('playback', '视频播放失败，已显示静态封面。');
      detach();
      notify('poster', 'error');
    };
    function sync() {
      if (disposed) return status;
      // The sibling img is a flow element inside an absolutely positioned clip.
      // Copy its crop/scale/opacity, then overlay in that same clip and layer.
      video.style.cssText = imageElement.style.cssText;
      video.style.position = 'absolute';
      video.style.inset = '0';
      video.style.pointerEvents = 'none';
      show(status.state === 'playing');
      if (!enabled || !source || quality === 'still' || motion?.matches || error) {
        if (attached) detach();
        show(false);
        const reason = error ? 'error' : !enabled ? 'disabled' : !source ? 'empty' : quality === 'still' ? 'still' : 'reduced-motion';
        notify(error || (enabled && source) ? 'poster' : 'idle', reason);
        return status;
      }
      const opacity = imageElement.style.opacity;
      const reason = doc.hidden ? 'hidden' : !focused ? 'blur' : opacity !== '' && Number(opacity) <= 0 ? 'opacity' : '';
      if (reason) { stop(reason); return status; }
      if (!attached) {
        try {
          attached = source;
          video.src = source;
          // Leave preload=metadata; play() requests only what playback needs.
          video.load();
        } catch (reason) { fail(reason); return status; }
        if (!attached || error) return status;
      }
      if (pending || (!video.paused && status.state === 'playing')) return status;
      const token = ++generation;
      pending = true;
      show(false);
      notify('loading', 'play');
      try {
        Promise.resolve(video.play()).then(() => {
          if (disposed || token !== generation) return;
          pending = false;
          show(true);
          notify('playing', 'play');
        }, reason => {
          if (!disposed && token === generation) fail(reason);
        });
      } catch (reason) { if (token === generation) fail(reason); }
      return status;
    }
    listen(doc, 'visibilitychange', sync);
    listen(win, 'blur', () => { focused = false; sync(); });
    listen(win, 'focus', () => { focused = true; sync(); });
    listen(video, 'error', () => { if (!disposed && attached) fail(failure('decode', '视频解码失败，已显示静态封面。')); });
    listen(video, 'loadedmetadata', () => {
      if (disposed || !attached) return;
      try { meta = Object.freeze(metadata(video)); } catch (reason) { fail(reason); return; }
      notify(status.state, status.reason);
    });
    if (motion?.addEventListener) listen(motion, 'change', sync);
    else if (motion?.addListener) {
      motion.addListener(sync);
      removers.push(() => motion.removeListener(sync));
    }
    const observer = win.MutationObserver ? new win.MutationObserver(sync) : null;
    observer?.observe(imageElement, {attributes: true, attributeFilter: ['style']});
    function set(options = {}) {
      if (disposed) return status;
      if (Object.hasOwn(options, 'source')) {
        if (typeof options.source !== 'string' || (options.source && !options.source.startsWith('blob:'))) {
          throw new TypeError('视频 source 必须是 ObjectURL 或空字符串。');
        }
        if (source !== options.source) {
          detach();
          source = options.source;
          error = null;
          meta = null;
        }
      }
      if (Object.hasOwn(options, 'enabled')) enabled = options.enabled === true;
      if (Object.hasOwn(options, 'quality')) quality = options.quality === 'still' ? 'still' : 'balanced';
      return sync();
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      observer?.disconnect();
      for (const remove of removers) remove();
      detach();
      source = '';
      meta = null;
      video.remove();
      posterStyle.remove();
      notify('disposed', 'disposed');
    }
    sync();
    return {element: video, set, sync, dispose, get status() { return status; }, get meta() { return meta; }};
  }
  return {validate, create, limits};
})();
