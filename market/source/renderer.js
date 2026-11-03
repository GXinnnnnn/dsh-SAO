/* Port of the user's SAO Utils NERvGear.dll D3D9 startup scene.
 * Source RVAs, constants and reference captures are recorded in SOURCE.md.
 * Positions, capsule topology, baked vertex colors and camera law follow native.
 */
const NativeSAO = (() => {
  const F = Math.fround;
  const PALETTE = [0xc01a1c, 0x19cd16, 0x20d5ce, 0xd41ed5, 0xcccd19, 0x646464, 0x050505];
  function makeField(seed = 1) {
    let state = seed >>> 0;
    const rand = () => { state = (Math.imul(state, 214013) + 2531011) >>> 0; return (state >>> 16) & 32767; };
    const jitterXY = [-.05, -.025, 0, .025, .05].map(F), jitterZ = [-1.5, -.5, 0, .5, 1.5];
    const sine = [], cosine = [], particles = [];
    let angle = 0;
    for (let i = 0; i < 30; i++, angle += 0.20943951606750488) { sine.push(F(Math.sin(angle))); cosine.push(F(Math.cos(angle))); }
    let threshold = F(.1), layerZ = 0;
    for (let layer = 0; layer < 9; layer++) {
      let radius = F(.4);
      for (let ring = 0; ring < 4; ring++, radius = F(radius + F(.3))) {
        for (let i = 0; i < 30; i++) {
          if (rand() >= F(threshold * 32767)) continue;
          const jitter = jitterXY[rand() % 5], xBase = F(radius * sine[i]);
          const x = F(xBase + jitter), y = F(F(radius * cosine[i]) + jitter);
          const z = F(F(xBase + layerZ) + jitterZ[rand() % 5]);
          const color = PALETTE[rand() % 7], length = [3, 8, 16][rand() % 3];
          particles.push({ x, y, z, color, length });
        }
      }
      layerZ = F(layerZ + 10);
      threshold = layer === 4 ? F(.5) : layer < 4 ? F(threshold + F(.2)) : F(threshold / 5);
    }
    return particles;
  }
  function capsule(length) {
    const points = [], radius = F(.05), pi = F(Math.PI);
    let latitude = 0;
    for (let ring = 0; ring < 6; ring++, latitude = F(latitude + 36)) {
      const beta = F(F(latitude * pi) / 180), z = F(F(F(Math.cos(beta)) * radius) + (latitude < 90 ? length / 2 : -length / 2));
      const r = F(F(Math.sin(beta)) * radius);
      for (let i = 0; i < 12; i++) {
        const theta = F(F(F(i * 30) * pi) / 180);
        points.push([F(F(Math.cos(theta)) * r), F(F(Math.sin(theta)) * r), z]);
      }
    }
    return points;
  }
  function makeMesh(particles) {
    const templates = new Map([3, 8, 16].map(n => [n, capsule(n)]));
    const vertices = [], indices = [];
    for (const p of particles) {
      const offset = vertices.length / 7;
      for (const [x, y, z] of templates.get(p.length)) {
        const shade = Math.trunc(F(F(y * 1124.75) + F(240.28749084472656)));
        const channels = [p.color >>> 16, (p.color >>> 8) & 255, p.color & 255].map(c => ((c * 255 * shade) >>> 16) & 255);
        vertices.push(F(x + p.x), F(y + p.y), F(z + p.z), ...channels.map(c => c / 255), 1);
      }
      for (let ring = 0; ring < 5; ring++) for (let side = 0; side < 12; side++) {
        const a = offset + ring * 12 + side, b = offset + ring * 12 + (side + 1) % 12;
        const c = a + 12, d = b + 12;
        indices.push(a, b, c, b, d, c);
      }
    }
    return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices), particleCount: particles.length };
  }
  function createRenderer(canvas, seed = 1, viewport = null) {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
    if (!gl) return null;
    const resources = [];
    function shader(type, text) {
      const s = gl.createShader(type); resources.push(['shader', s]); gl.shaderSource(s, text); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    const program = gl.createProgram(); resources.push(['program', program]);
    gl.attachShader(program, shader(gl.VERTEX_SHADER, `attribute vec3 position;attribute vec4 color;uniform float camera;uniform float aspect;uniform float background;varying vec4 vColor;
void main(){float z=position.z-camera;float f=2.414213487;gl_Position=vec4(position.x*f/aspect,position.y*f,1.002002002*z-.2002002002,z);vColor=color;}`));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `precision mediump float;varying vec4 vColor;uniform float opacity;void main(){gl_FragColor=vec4(vColor.rgb*opacity,vColor.a*opacity);}`));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const position = gl.getAttribLocation(program, 'position'), color = gl.getAttribLocation(program, 'color');
    const camera = gl.getUniformLocation(program, 'camera'), aspect = gl.getUniformLocation(program, 'aspect'), opacity = gl.getUniformLocation(program, 'opacity');
    function buffer(target, data) { const b = gl.createBuffer(); resources.push(['buffer', b]); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW); return b; }
    const mesh = makeMesh(makeField(seed));
    const vertices = buffer(gl.ARRAY_BUFFER, mesh.vertices), indices = buffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indices);
    // Native background: five vertices, center white and corner RGB 204.
    const bg = buffer(gl.ARRAY_BUFFER, new Float32Array([0,0,0,1,1,1,1, -1,-1,0,.8,.8,.8,1, -1,1,0,.8,.8,.8,1, 1,1,0,.8,.8,.8,1, 1,-1,0,.8,.8,.8,1, -1,-1,0,.8,.8,.8,1]));
    function bind(b) { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,3,gl.FLOAT,false,28,0); gl.enableVertexAttribArray(color); gl.vertexAttribPointer(color,4,gl.FLOAT,false,28,12); }
    let disposed = false;
    return {
      particleCount: mesh.particleCount,
      draw(elapsedMs) {
        if (disposed || gl.isContextLost()) return;
        const width = viewport?.width || canvas.clientWidth || 1280, height = viewport?.height || canvas.clientHeight || 720;
        const dpr = Math.min(viewport?.dpr || globalThis.devicePixelRatio || 1, 2, Math.sqrt(3840*2160*2/(width*height)));
        const pw = Math.round(width*dpr), ph = Math.round(height*dpr);
        if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
        gl.viewport(0,0,pw,ph); gl.clearColor(0,0,0,0); gl.clearDepth(1); gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        if (elapsedMs < 0 || elapsedMs >= 4250) return;
        gl.useProgram(program); gl.uniform1f(aspect,width/height); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.CULL_FACE);
        const cameraZ = F(F(F(elapsedMs) / 35) - 40);
        const fade = Math.max(0,Math.min(1,cameraZ < -20 ? (cameraZ+40)/20 : cameraZ > 50 ? (60-cameraZ)/10 : 1));
        gl.disable(gl.DEPTH_TEST); gl.depthMask(false); bind(bg); gl.uniform1f(camera,-2*Math.min(width,height)/Math.max(width,height)); gl.uniform1f(opacity,Math.trunc(fade*255)/255); gl.drawArrays(gl.TRIANGLE_FAN,0,6);
        gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true); bind(vertices); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices); gl.uniform1f(camera,cameraZ); gl.uniform1f(opacity,1); gl.drawElements(gl.TRIANGLES,mesh.indices.length,gl.UNSIGNED_SHORT,0);
      },
      dispose() { if (disposed) return; disposed = true; for (const [kind, value] of resources) { if (kind === 'buffer') gl.deleteBuffer(value); else if (kind === 'shader') gl.deleteShader(value); else gl.deleteProgram(value); } }
    };
  }
  return { makeField, makeMesh, createRenderer };
})();
