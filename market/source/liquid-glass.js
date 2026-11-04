/*
 * SAO wallpaper liquid optics. Plain source: embed createSAOLiquidGlass in the
 * client factory. CSS owns backdrop blur, host positioning/clipping and the
 * z-index:1 foreground. This module only adds/removes its own inert canvases.
 * The only sampled content is the explicitly supplied, origin-clean wallpaper;
 * there is no DOM capture, chat sampling, network fetch or animation loop.
 *
 * Rounded-distance lens and shared-renderer design adapted from ACG-album:
 * https://github.com/GXinnnnnn/ACG-album (src/ui/liquid-glass.js)
 * MIT License
 * Copyright (c) 2026 友利奈绪的胖次 (GXinnnnnn)
 * https://github.com/GXinnnnnn
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
function createSAOLiquidGlass() {
  'use strict';
  const win = window, doc = win.document;
  const hosts = new Map(), surfaceOpacities = new Map(), surfaceBackgrounds = new Map(), edgeOnlySurfaces = new Set(), listeners = [];
  const clamp = (value, low, high, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(high, Math.max(low, n)) : fallback;
  };
  let disposed = false, enabled = false, opacity = 0.82, wallOpacity = 1;
  let position = { x: 50, y: 50, scale: 100 }, image = null, wallpaperBounds = null;
  let frame = 0, timer = 0, lastDraw = -Infinity;
  let shared = null, gl = null, program = null, texture = null, vao = null;
  let attempted = false, ready = false, lost = false, textureDirty = true;
  let sourceKey = '', sourceBaseKey = '', sampledImage = null, sampledKey = '', sample = null;
  let baseColor = null;
  let sourceWidth = 1, sourceHeight = 1, dark = false;
  let textureVersion = 0, textureHasImage = false;
  const uniforms = Object.create(null);
  const vertex = `#version 300 es
  precision highp float;
  out vec2 uv;
  void main() {
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    uv = p;
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;
  const fragment = `#version 300 es
  precision highp float;
  uniform sampler2D wallpaper;
  uniform vec2 size;
  uniform vec2 origin;
  uniform vec4 photo;
  uniform vec4 radiiX;
  uniform vec4 radiiY;
  uniform vec2 pixelSize;
  uniform vec2 bevel;
  uniform float opacity;
   uniform float edgeOnly;
  uniform float wallOpacity;
  uniform float dark;
  uniform float sceneOpacity;
  uniform vec3 sceneColor;
  uniform vec4 sceneBounds;
  uniform vec3 proxyColor;
  in vec2 uv;
  out vec4 color;
  float ellipseDistance(vec2 p, vec2 radius) {
    vec2 q = p / max(radius, vec2(0.0001));
    float k0 = length(q), k1 = length(q / max(radius, vec2(0.0001)));
    // Exact ellipse contour with a local distance approximation for AA/normals.
    return k1 > 0.0001 ? k0 * (k0 - 1.0) / k1 : -min(radius.x, radius.y);
  }
  float shape(vec2 p) {
    vec2 local = p + size * 0.5;
    // CSS permits a corner radius larger than half a side. Select its actual
    // corner region rather than a quadrant through the rectangle's center.
    if (local.x < radiiX.x && local.y < radiiY.x)
      return ellipseDistance(local - vec2(radiiX.x, radiiY.x), vec2(radiiX.x, radiiY.x));
    if (local.x > size.x - radiiX.y && local.y < radiiY.y)
      return ellipseDistance(local - vec2(size.x - radiiX.y, radiiY.y), vec2(radiiX.y, radiiY.y));
    if (local.x > size.x - radiiX.z && local.y > size.y - radiiY.z)
      return ellipseDistance(local - size + vec2(radiiX.z, radiiY.z), vec2(radiiX.z, radiiY.z));
    if (local.x < radiiX.w && local.y > size.y - radiiY.w)
      return ellipseDistance(local - vec2(radiiX.w, size.y - radiiY.w), vec2(radiiX.w, radiiY.w));
    vec2 q = abs(p) - size * 0.5;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  }
  vec3 sampleScene(vec2 screen) {
    vec2 coord = clamp((screen - photo.xy) / photo.zw, 0.0, 1.0);
    vec4 pixel = texture(wallpaper, vec2(coord.x, 1.0 - coord.y));
    vec3 proxy = proxyColor;
    // The texture is premultiplied so transparent source pixels interpolate
    // without dark fringes; compose the same CSS image opacity over the base.
    vec3 scene = proxy * (1.0 - pixel.a * wallOpacity) + pixel.rgb * wallOpacity;
    // Overlay bounds are in screen coordinates, including the refracted sample.
    // A neighboring surface can sample outside the conversation without tinting it.
    bool inside = all(greaterThanEqual(screen, sceneBounds.xy)) &&
      all(lessThan(screen, sceneBounds.xy + sceneBounds.zw));
    return mix(scene, sceneColor, inside ? sceneOpacity : 0.0);
  }
  void main() {
    vec2 local = vec2(uv.x, 1.0 - uv.y) * size;
    vec2 p = local - size * 0.5;
    float d = shape(p);
    // Derivatives and finite differences use actual backing-pixel footprints,
    // including surfaces downscaled to respect the shared renderer's budget.
    float footprint = max(pixelSize.x, pixelSize.y);
    float aa = 0.5 * max(fwidth(d), footprint);
    float mask = 1.0 - smoothstep(-aa, aa, d);
    if (mask < 0.001) discard;
    vec2 stepSize = pixelSize * 0.5;
    vec2 gradient = vec2((shape(p + vec2(stepSize.x, 0.0)) - shape(p - vec2(stepSize.x, 0.0))) / pixelSize.x,
                         (shape(p + vec2(0.0, stepSize.y)) - shape(p - vec2(0.0, stepSize.y))) / pixelSize.y);
    vec2 outward = gradient / max(length(gradient), 0.0001);
    float depth = max(0.0, -d);
    float edge = 1.0 - smoothstep(0.0, bevel.x, depth);
    float shoulder = 1.0 - smoothstep(0.0, bevel.y, depth);
    vec2 lens = p / max(size * 0.5, vec2(1.0));
    // Snell refraction through a curved, finite-thickness dielectric bevel.
    // All displacements affect wallpaper samples only; foreground DOM is intact.
    vec3 normal = normalize(vec3(outward * (edge * 0.95 + shoulder * 0.20)
                                + lens * 0.08, 1.0));
    vec3 ray = refract(vec3(0.0, 0.0, -1.0), normal, 1.0 / 1.45);
    float thickness = 24.0 + min(size.x, size.y) * 0.07;
    // Ease displacement into the boundary so adjoining surfaces do not expose
    // a hard strip of unrelated wallpaper at their seams.
    float edgeFade = smoothstep(0.0, max(2.0, footprint * 2.0), depth);
    vec2 bend = ray.xy / max(0.25, -ray.z) * min(thickness, 52.0) * edgeFade;
    vec2 screen = origin + local + bend;
    vec3 refracted = sampleScene(screen);
    vec2 light = normalize(vec2(-0.65, -0.8));
    float fresnel = pow(edge, 1.8);
    float rim = pow(max(dot(outward, light), 0.0), 3.0) * fresnel * edgeFade;
    float shadow = pow(max(dot(outward, -light), 0.0), 3.0) * edge * edgeFade;
    // Resolve a narrow inner reflection at the real backing-pixel footprint.
    // The paired bright crest and shaded far edge make thickness visible without
    // blurring the wallpaper or adding another texture sample/animation pass.
    float crestWidth = max(1.1, footprint * 0.9);
    float crestDepth = max(1.8, footprint * 1.2);
    float crest = exp(-pow((depth - crestDepth) / crestWidth, 2.0)) * edgeFade;
    vec3 bodyNormal = normalize(vec3(lens * 0.40, 1.0));
    float sheen = pow(max(dot(bodyNormal, normalize(vec3(light * 0.50, 1.0))), 0.0), 24.0);
    vec3 tint = mix(vec3(0.93, 0.96, 1.0), vec3(0.12, 0.17, 0.23), dark);
    vec3 optical = mix(refracted, tint, 0.035) * (1.0 - shadow * 0.18)
      + vec3(rim * 0.64 + crest * 0.26 + sheen * 0.045);
    // CSS supplies the requested material backing. Optical accents disappear
    // at both fully transparent and fully opaque endpoints instead of exposing
    // the wallpaper again through a supposedly opaque window.
    float alpha = mask * opacity * (1.0 - opacity) *
      (0.38 + shoulder * 0.32 + fresnel * edgeFade * 0.95 + crest * 0.80 + rim * 0.18 + sheen * 0.10);
    // A scene backdrop already supplies its one and only central fill/blur.
    // Restrict this overlay to the bevel; never paint a sharp center over it.
    alpha *= mix(1.0, shoulder, edgeOnly);
    // Match the premultiplied drawing buffer used by GL -> 2D presentation.
    color = vec4(clamp(optical, 0.0, 1.0) * alpha, alpha);
  }`;

  function on(target, type, callback, options) {
    target.addEventListener(type, callback, options);
    listeners.push(() => target.removeEventListener(type, callback, options));
  }
  function cancel() {
    if (frame) win.cancelAnimationFrame(frame);
    if (timer) win.clearTimeout(timer);
    frame = timer = 0;
  }
  function hasOpacity() {
    for (const host of hosts.keys()) if ((surfaceOpacities.get(host) ?? opacity) > 0) return true;
    return false;
  }
  function active() {
    return !disposed && enabled && hasOpacity() && !doc.hidden && hosts.size > 0;
  }
  function schedule(priority = false) {
    if (!active() || !ready) return;
    // Geometry changes must not wait behind a scroll throttle.
    if (priority === true && timer) { win.clearTimeout(timer); timer = 0; }
    if (frame || timer) return;
    if (priority === true) { frame = win.requestAnimationFrame(paint); return; }
    // Coalesce scroll bursts to <=30Hz; never schedule from paint itself.
    const wait = Math.max(0, 34 - (win.performance.now() - lastDraw));
    if (wait > 0) {
      timer = win.setTimeout(() => {
        timer = 0;
        if (active() && ready) frame = win.requestAnimationFrame(paint);
      }, wait);
    } else frame = win.requestAnimationFrame(paint);
  }
  function hide() {
    for (const entry of hosts.values()) entry.canvas.hidden = true;
  }
  function releaseGPU() {
    if (gl && !lost) {
      if (texture) gl.deleteTexture(texture);
      if (vao) gl.deleteVertexArray(vao);
      if (program) gl.deleteProgram(program);
    }
    texture = vao = program = null;
    ready = false;
  }
  function initialize() {
    if (disposed) return false;
    attempted = true;
    try {
      if (!shared) {
        shared = doc.createElement('canvas');
        // Stable shared backing; the scissored viewport shades <=180000 pixels.
        shared.width = shared.height = 1024;
        on(shared, 'webglcontextlost', (event) => {
          event.preventDefault();
          lost = true;
          ready = false;
          cancel();
          hide();
        });
        on(shared, 'webglcontextrestored', () => {
          lost = false;
          texture = vao = program = null;
          if (initialize()) schedule();
        });
      }
      gl = shared.getContext('webgl2', {
        alpha: true, premultipliedAlpha: true, antialias: false,
        depth: false, stencil: false, preserveDrawingBuffer: false,
        powerPreference: 'low-power'
      });
      if (!gl || gl.isContextLost()) return false;
      const shaders = [];
      try {
        for (const [type, text] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
          const shader = gl.createShader(type);
          if (!shader) throw new Error('Liquid shader unavailable');
          shaders.push(shader);
          gl.shaderSource(shader, text);
          gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader) || 'Liquid shader compilation failed');
          }
        }
        program = gl.createProgram();
        if (!program) throw new Error('Liquid program unavailable');
        for (const shader of shaders) gl.attachShader(program, shader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          throw new Error(gl.getProgramInfoLog(program) || 'Liquid shader link failed');
        }
      } finally {
        for (const shader of shaders) gl.deleteShader(shader);
      }
      gl.useProgram(program);
      vao = gl.createVertexArray();
      texture = gl.createTexture();
      if (!vao || !texture) throw new Error('Liquid resources unavailable');
      gl.bindVertexArray(vao);
      for (const name of ['wallpaper', 'size', 'origin', 'photo', 'radiiX', 'radiiY', 'pixelSize', 'bevel', 'opacity', 'edgeOnly', 'wallOpacity', 'dark', 'sceneOpacity', 'sceneColor', 'sceneBounds', 'proxyColor']) {
        uniforms[name] = gl.getUniformLocation(program, name);
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(uniforms.wallpaper, 0);
      textureDirty = true;
      ready = true;
      return true;
    } catch (_) {
      releaseGPU();
      hide();
      return false;
    }
  }
  function imageKey() {
    return image ? [image.currentSrc || image.src || '', image.naturalWidth, image.naturalHeight, image.complete].join('|') : '';
  }
  function safeSample() {
    const key = imageKey();
    if (sampledImage === image && sampledKey === key) return sample;
    sampledImage = image;
    sampledKey = key;
    sample = null;
    if (!image || !image.complete || !image.naturalWidth || !image.naturalHeight) return null;
    try {
      const url = new URL(image.currentSrc || image.src, doc.baseURI);
      const local = (url.protocol === 'data:' && /^data:image\//i.test(url.href)) ||
        url.protocol === 'blob:' || url.origin === win.location.origin;
      if (!local) return null;
      const canvas = doc.createElement('canvas');
      const ratio = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight),
        Math.sqrt(2000000 / (image.naturalWidth * image.naturalHeight)));
      canvas.width = Math.max(1, Math.floor(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.floor(image.naturalHeight * ratio));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return null;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      // Validate origin cleanliness once per source. Tainted images never reach GL.
      context.getImageData(0, 0, 1, 1);
      sample = canvas;
      return sample;
    } catch (_) {
      return null;
    }
  }
  function themeDark() {
    const root = doc.documentElement;
    const declared = root.getAttribute('data-theme') || root.getAttribute('data-color-mode');
    if (declared === 'dark' || declared === 'light') return declared === 'dark';
    if (root.classList.contains('dark') || doc.body?.classList.contains('dark')) return true;
    const scheme = win.getComputedStyle(root).colorScheme;
    if (scheme === 'dark' || scheme === 'light') return scheme === 'dark';
    return !!media?.matches;
  }
  function backgroundColor(isDark) {
    return isDark ? [0.082, 0.106, 0.141] : [0.906, 0.937, 0.969];
  }
  function normalizedColor(value) {
    return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)
      ? value.map(n => clamp(n, 0, 1, 0)) : null;
  }
  // A candidate previews the next CSS base before update; null selects native.
  // Always return a fresh array so callers cannot mutate the stored override.
  function sceneColor(base = baseColor) {
    return normalizedColor(base) || backgroundColor(themeDark());
  }
  function upload() {
    const nextDark = themeDark(), key = imageKey();
    const proxy = baseColor || backgroundColor(nextDark), baseKey = proxy.join('|');
    // Uploaded images depend on source only. Theme/base changes are uniforms;
    // only the tiny fallback texture depends on the effective base RGB itself.
    if (key !== sourceKey || (baseKey !== sourceBaseKey && !textureHasImage)) textureDirty = true;
    dark = nextDark;
    sourceKey = key;
    sourceBaseKey = baseKey;
    if (!textureDirty) return true;
    const picture = safeSample();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    if (picture) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, picture);
      // Use original dimensions to avoid sample rounding changing cover alignment.
      sourceWidth = image.naturalWidth;
      sourceHeight = image.naturalHeight;
    } else {
      const rgb = [...proxy.map(n => Math.round(n * 255)), 255];
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgb));
      sourceWidth = sourceHeight = 1;
    }
    textureHasImage = !!picture;
    textureDirty = false;
    // Monotonic across context restores: no surface can reuse old GPU output.
    textureVersion++;
    return !gl.isContextLost();
  }
  function remove(host) {
    const entry = hosts.get(host);
    if (!entry) return;
    resizeObserver?.unobserve(host);
    entry.canvas.remove();
    hosts.delete(host);
    surfaceOpacities.delete(host);
    surfaceBackgrounds.delete(host);
    edgeOnlySurfaces.delete(host);
  }
  function prune() {
    for (const host of hosts.keys()) if (!host.isConnected) remove(host);
    if (!hosts.size) cancel();
  }
  function add(host) {
    if (hosts.has(host)) return;
    const canvas = doc.createElement('canvas');
    canvas.setAttribute('data-sao-liquid', '');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('role', 'presentation');
    canvas.setAttribute('inert', '');
    canvas.tabIndex = -1;
    canvas.hidden = true;
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;border-radius:inherit;user-select:none;contain:strict;';
    const context = canvas.getContext('2d');
    if (!context) return;
    host.appendChild(canvas);
    hosts.set(host, { canvas, context });
    resizeObserver?.observe(host);
  }
  function radius(value, width, height) {
    const parts = String(value).trim().split(/\s+/);
    const read = (part, extent) => {
      const n = parseFloat(part);
      return Number.isFinite(n) ? Math.max(0, part.endsWith('%') ? n * extent / 100 : n) : 0;
    };
    const x = read(parts[0], width), y = read(parts[1] || parts[0], height);
    // CSS treats a corner as square when either radius axis is zero.
    return x > 0 && y > 0 ? [x, y] : [0, 0];
  }
  function paint() {
    frame = 0;
    if (!active() || !ready) return;
    lastDraw = win.performance.now();
    prune();
    const viewWidth = Math.max(1, win.innerWidth), viewHeight = Math.max(1, win.innerHeight);
    const rows = [], toHide = [];
    // Restore measurable canvases in one write phase before any geometry reads.
    for (const [host, entry] of hosts) {
      if ((surfaceOpacities.get(host) ?? opacity) === 0) continue;
      if (entry.canvas.parentElement !== host) host.appendChild(entry.canvas);
      if (entry.canvas.hidden) entry.canvas.hidden = false;
    }
    // Read all geometry before changing backing sizes or presenting layers.
    for (const [host, entry] of hosts) {
      const surfaceOpacity = surfaceOpacities.get(host) ?? opacity;
      if (surfaceOpacity === 0) { toHide.push(entry); continue; }
      const bounds = host.getBoundingClientRect(), style = win.getComputedStyle(host);
      if (bounds.width < 2 || bounds.height < 2 || bounds.right <= 0 || bounds.bottom <= 0 ||
          bounds.left >= viewWidth || bounds.top >= viewHeight || !host.getClientRects().length ||
          style.visibility !== 'visible' || Number(style.opacity) === 0) {
        toHide.push(entry);
        continue;
      }
      // Measure the actual padding-box canvas; borders need not equal the host box.
      const rect = entry.canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) { toHide.push(entry); continue; }
      const corners = [style.borderTopLeftRadius, style.borderTopRightRadius,
        style.borderBottomRightRadius, style.borderBottomLeftRadius].map(value => radius(value, rect.width, rect.height));
      // Apply CSS's single overlap factor to both axes of every corner.
      const fit = Math.min(1, rect.width / Math.max(1, corners[0][0] + corners[1][0]),
        rect.height / Math.max(1, corners[1][1] + corners[2][1]),
        rect.width / Math.max(1, corners[2][0] + corners[3][0]),
        rect.height / Math.max(1, corners[3][1] + corners[0][1]));
      rows.push({ entry, rect, surfaceOpacity, edgeOnly: Number(edgeOnlySurfaces.has(host)), background: surfaceBackgrounds.get(host),
        corners: corners.map(pair => pair.map(n => n * fit)) });
    }
    for (const entry of toHide) if (!entry.canvas.hidden) entry.canvas.hidden = true;
    if (!rows.length) return;
    try {
      if (!upload()) { hide(); return; }
      // Equivalent to an inset:0 img within the wallpaper bounds (viewport by default),
      // with object-fit:cover; object-position:x% y%; scale about the area's center.
      // Keep photo's origin in screen coordinates for each surface's screen samples.
      const area = wallpaperBounds || { x: 0, y: 0, width: viewWidth, height: viewHeight };
      const cover = Math.max(area.width / sourceWidth, area.height / sourceHeight);
      const baseWidth = sourceWidth * cover, baseHeight = sourceHeight * cover;
      const zoom = position.scale / 100;
      const photoWidth = baseWidth * zoom, photoHeight = baseHeight * zoom;
      const left = area.x + area.width / 2 + ((area.width - baseWidth) * position.x / 100 - area.width / 2) * zoom;
      const top = area.y + area.height / 2 + ((area.height - baseHeight) * position.y / 100 - area.height / 2) * zoom;
      const pending = [], proxyColor = baseColor || backgroundColor(dark);
      for (const row of rows) {
        const { entry, rect, corners, surfaceOpacity, edgeOnly, background } = row;
        const sceneOpacity = background?.opacity ?? 0;
        const sceneColor = background?.color || proxyColor;
        const sceneBounds = background?.bounds || [0, 0, 0, 0];
        const scale = Math.min(1.5, win.devicePixelRatio || 1,
          Math.sqrt(180000 / (rect.width * rect.height)), 1024 / Math.max(rect.width, rect.height));
        const width = Math.max(1, Math.floor(rect.width * scale));
        const height = Math.max(1, Math.floor(rect.height * scale));
        // These are every input affecting the rendered pixels. Chat scrolling
        // or an identical update need not redraw/copy a stationary surface.
        const key = [textureVersion, dark, wallOpacity, left, top, photoWidth, photoHeight,
          surfaceOpacity, edgeOnly, ...proxyColor, sceneOpacity, ...sceneColor, ...sceneBounds,
          rect.left, rect.top, rect.width, rect.height, width, height, ...corners.flat()];
        if (entry.canvas.width === width && entry.canvas.height === height && entry.renderKey &&
            key.every((value, index) => value === entry.renderKey[index])) continue;
        pending.push({ ...row, width, height, key, sceneOpacity, sceneColor, sceneBounds });
      }
      if (!pending.length) return;
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.disable(gl.BLEND);
      gl.enable(gl.SCISSOR_TEST);
      gl.uniform4f(uniforms.photo, left, top, photoWidth, photoHeight);
      gl.uniform1f(uniforms.wallOpacity, wallOpacity);
      gl.uniform1f(uniforms.dark, Number(dark));
      gl.uniform3f(uniforms.proxyColor, ...proxyColor);
      for (const { entry, rect, corners, surfaceOpacity, edgeOnly, width, height, key,
        sceneOpacity, sceneColor, sceneBounds } of pending) {
        gl.uniform1f(uniforms.opacity, surfaceOpacity);
        gl.uniform1f(uniforms.edgeOnly, edgeOnly);
        gl.uniform1f(uniforms.sceneOpacity, sceneOpacity);
        gl.uniform3f(uniforms.sceneColor, ...sceneColor);
        gl.uniform4f(uniforms.sceneBounds, ...sceneBounds);
        gl.viewport(0, 0, width, height);
        gl.scissor(0, 0, width, height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(uniforms.size, rect.width, rect.height);
        gl.uniform2f(uniforms.origin, rect.left, rect.top);
        gl.uniform2f(uniforms.pixelSize, rect.width / width, rect.height / height);
        gl.uniform4f(uniforms.radiiX, corners[0][0], corners[1][0], corners[2][0], corners[3][0]);
        gl.uniform4f(uniforms.radiiY, corners[0][1], corners[1][1], corners[2][1], corners[3][1]);
        const half = Math.min(rect.width, rect.height) * 0.5;
        gl.uniform2f(uniforms.bevel, Math.max(1, Math.min(22, half * 0.55)),
          Math.max(1, Math.min(76, half * 0.85)));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (entry.canvas.width !== width) entry.canvas.width = width;
        if (entry.canvas.height !== height) entry.canvas.height = height;
        entry.context.clearRect(0, 0, width, height);
        entry.context.drawImage(shared, 0, 1024 - height, width, height, 0, 0, width, height);
        entry.renderKey = key;
        entry.canvas.hidden = false;
      }
    } catch (_) {
      releaseGPU();
      hide();
    }
  }

  const resizeObserver = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(() => schedule(true)) : null;
  const mutationObserver = typeof win.MutationObserver === 'function' ? new win.MutationObserver((records) => {
    if (disposed || !hosts.size) return;
    prune();
    let changed = false;
    for (const [host, entry] of hosts) {
      if (entry.canvas.parentElement !== host) changed = true;
      for (const record of records) {
        // Ignore our own backing/style changes, and never read text mutations.
        if (record.type === 'attributes' && record.target !== entry.canvas &&
            (record.target === host || record.target.contains?.(host))) changed = true;
      }
    }
    if (changed) schedule();
  }) : null;
  mutationObserver?.observe(doc.documentElement, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'data-theme', 'data-color-mode']
  });
  const media = typeof win.matchMedia === 'function' ? win.matchMedia('(prefers-color-scheme: dark)') : null;
  if (media?.addEventListener) on(media, 'change', schedule);
  on(win, 'resize', schedule, { passive: true });
  on(doc, 'scroll', schedule, { capture: true, passive: true });
  on(doc, 'visibilitychange', () => { if (doc.hidden) cancel(); else schedule(); });
  if (win.visualViewport) {
    on(win.visualViewport, 'resize', schedule, { passive: true });
    on(win.visualViewport, 'scroll', schedule, { passive: true });
  }
  function imageChanged() {
    sampledKey = '';
    textureDirty = true;
    schedule();
  }
  function update(options = {}) {
    if (disposed) return false;
    if ('enabled' in options) enabled = !!options.enabled;
    if ('opacity' in options) opacity = clamp(options.opacity, 0, 1, 0.82);
    if ('wallOpacity' in options) wallOpacity = clamp(options.wallOpacity, 0, 1, 1);
    if ('baseColor' in options) baseColor = normalizedColor(options.baseColor);
    if ('bounds' in options) {
      const next = options.bounds;
      const x = Number(next?.x), y = Number(next?.y);
      const width = Number(next?.width), height = Number(next?.height);
      wallpaperBounds = [x, y, width, height].every(Number.isFinite) && width > 0 && height > 0
        ? { x, y, width, height } : null;
    }
    if (options.position) position = {
      x: clamp(options.position.x, 0, 100, 50),
      y: clamp(options.position.y, 0, 100, 50),
      scale: clamp(options.position.scale, 100, 250, 100)
    };
    if ('image' in options) {
      const next = options.image instanceof win.HTMLImageElement ? options.image : null;
      if (next !== image) {
        image?.removeEventListener('load', imageChanged);
        image?.removeEventListener('error', imageChanged);
        image = next;
        image?.addEventListener('load', imageChanged);
        image?.addEventListener('error', imageChanged);
        sampledImage = null;
        sampledKey = '';
        sample = null;
        textureDirty = true;
      }
    }
    if ('surfaces' in options) {
      const allowed = new Set();
      if (Array.isArray(options.surfaces)) {
        for (const host of options.surfaces) {
          if (allowed.size >= 12) break;
          if (host instanceof win.HTMLElement && host.ownerDocument === doc && host.isConnected &&
              !/^(CANVAS|IMG|INPUT|BR|HR|META|LINK|SOURCE|VIDEO|AUDIO|IFRAME|TEXTAREA|SELECT)$/.test(host.tagName)) allowed.add(host);
        }
      }
      for (const host of hosts.keys()) if (!allowed.has(host)) remove(host);
      if (enabled) for (const host of allowed) add(host);
    }
    // Each update supplies a fresh optional override map; omitted hosts use
    // the global material opacity, and callers cannot mutate our stored values.
    surfaceOpacities.clear();
    if (options.surfaceOpacities instanceof Map) {
      for (const [host, value] of options.surfaceOpacities) {
        if (hosts.has(host) && Number.isFinite(value)) surfaceOpacities.set(host, clamp(value, 0, 1, 0));
      }
    }
    edgeOnlySurfaces.clear();
    if (options.edgeOnlySurfaces instanceof Set) for (const host of options.edgeOnlySurfaces) if (hosts.has(host)) edgeOnlySurfaces.add(host);
    // Background overlays are optional per-update snapshots, like opacity maps.
    // Invalid bounds cannot apply an accidental viewport-wide mask.
    surfaceBackgrounds.clear();
    if (options.surfaceBackgrounds instanceof Map) {
      for (const [host, value] of options.surfaceBackgrounds) {
        if (!hosts.has(host) || !value) continue;
        const bounds = value.bounds;
        const box = [bounds?.x, bounds?.y, bounds?.width, bounds?.height];
        const amount = clamp(value.opacity, 0, 1, 0);
        if (!amount || !box.every(Number.isFinite) || box[2] <= 0 || box[3] <= 0) continue;
        const color = Array.isArray(value.color) && value.color.length === 3 && value.color.every(Number.isFinite)
          ? value.color.map(n => clamp(n, 0, 1, 0)) : null;
        surfaceBackgrounds.set(host, { opacity: amount, color, bounds: box });
      }
    }
    prune();
    if (!enabled) {
      cancel();
      for (const host of hosts.keys()) remove(host);
      return false;
    }
    if (!hasOpacity()) { cancel(); hide(); return ready && !lost; }
    if (hosts.size && !attempted) initialize();
    if (ready) schedule(); else hide();
    return ready && !lost;
  }
  function refreshLayout(next = {}) {
    if (disposed) return;
    const area = next.bounds, mask = next.backgroundBounds;
    if (area && [area.x,area.y,area.width,area.height].every(Number.isFinite) && area.width > 0 && area.height > 0) wallpaperBounds = { ...area };
    if (mask && [mask.x,mask.y,mask.width,mask.height].every(Number.isFinite) && mask.width > 0 && mask.height > 0) {
      for (const background of surfaceBackgrounds.values()) background.bounds = [mask.x,mask.y,mask.width,mask.height];
    }
    // The layout observer runs before presentation. Match this layout now,
    // cancelling the obsolete throttled draw rather than adding a second loop.
    cancel();
    if (active() && ready) paint();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancel();
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();
    for (const removeListener of listeners) removeListener();
    image?.removeEventListener('load', imageChanged);
    image?.removeEventListener('error', imageChanged);
    for (const host of hosts.keys()) remove(host);
    surfaceOpacities.clear();
    surfaceBackgrounds.clear();
    edgeOnlySurfaces.clear();
    releaseGPU();
    if (gl && !lost) gl.getExtension('WEBGL_lose_context')?.loseContext();
    if (shared) shared.width = shared.height = 1;
    image = sample = sampledImage = shared = gl = null;
  }
  on(win, 'pagehide', dispose);
  return { update, refreshLayout, dispose, sceneColor };
}
