/* Historical thin Canvas 2D scene, recovered verbatim from the JSON tool write
 * at line 595 of C:/DSH/tmp/sao-v1-history.txt (original client.template.js).
 * Only context/viewport access and the shared draw/dispose adapter are added.
 * Keep the fixed historical field seed; the shared seed argument is unused.
 */
const ThinSAO = (() => {
  function createRenderer(canvas, seed = 1, viewport = null) {
    const context = canvas.getContext('2d');
    if (!context) return null;
    function random(seed) {
      return () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
    }
    // A fixed world-space field: project x/z and y/z, then move the camera forward.
    // Each line has depth, so its length, width and speed grow approaching the viewer.
    function makeField() {
      const rng = random(0x53414f);
      const palette = ['#08a1de', '#1679e8', '#36b99b', '#6bc54a', '#f0b92f', '#ec7145', '#df5085', '#a36cdd'];
      return Array.from({ length: 440 }, () => {
        const angle = rng() * Math.PI * 2;
        const radius = 0.25 + Math.pow(rng(), 0.58) * 4.0;
        return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: rng() * 18,
          length: 0.45 + rng() * 1.5, width: 0.004 + rng() * 0.013, color: palette[Math.floor(rng() * palette.length)] };
      });
    }
    function paint(canvas, seconds, field) {
      const ctx = context;
      if (!ctx) return;
      const width = viewport?.width || canvas.clientWidth || 1280, height = viewport?.height || canvas.clientHeight || 720;
      const dpr = Math.min(viewport?.dpr || globalThis.devicePixelRatio || 1, 2);
      const pw = Math.round(width * dpr), ph = Math.round(height * dpr);
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = seconds < 0.72 ? '#03080d' : '#fbfdff';
      ctx.fillRect(0, 0, width, height);
      if (seconds < 0.72) return;
      const t = seconds - 0.72;
      const camera = 2.0 * t + 2.45 * t * t;
      const focal = Math.min(width, height) * 0.83;
      const cx = width * 0.5, cy = height * 0.5;
      const entry = Math.min(1, t / 0.5);
      const exit = Math.min(1, Math.max(0, (seconds - 4.45) / 0.55));
      for (const star of field) {
        const z = ((star.z - camera) % 18 + 18) % 18 + 0.22;
        const far = z + star.length * (0.35 + Math.min(1, t / 1.2));
        const x0 = cx + star.x / far * focal, y0 = cy + star.y / far * focal;
        const x1 = cx + star.x / z * focal, y1 = cy + star.y / z * focal;
        if (Math.min(x0, x1) > width + 100 || Math.max(x0, x1) < -100 || Math.min(y0, y1) > height + 100 || Math.max(y0, y1) < -100) continue;
        const angle = Math.atan2(star.y, star.x);
        const half = Math.min(28, star.width / z * focal);
        const nx = -Math.sin(angle), ny = Math.cos(angle);
        ctx.globalAlpha = entry * (1 - exit) * Math.min(0.88, (18.3 - z) / 5);
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.moveTo(x0 + nx * half * 0.13, y0 + ny * half * 0.13);
        ctx.lineTo(x1 + nx * half, y1 + ny * half);
        ctx.lineTo(x1 - nx * half, y1 - ny * half);
        ctx.lineTo(x0 - nx * half * 0.13, y0 - ny * half * 0.13);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, focal * 0.26);
      glow.addColorStop(0, '#ffffff'); glow.addColorStop(0.3, '#ffffffd9'); glow.addColorStop(1, '#ffffff00');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
      if (seconds < 1.02) { ctx.globalAlpha = Math.max(0, 1 - (seconds - 0.72) / 0.3); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1; }
    }
    const field = makeField();
    let disposed = false;
    return {
      particleCount: field.length,
      // Shared callers subtract the one-second voice lead-in. Restore the
      // historical total clock so its original .72s opening stays exact.
      draw(elapsedMs) { if (!disposed) paint(canvas, Math.max(0, elapsedMs + 1000) / 1000, field); },
      dispose() { disposed = true; }
    };
  }
  return { createRenderer };
})();
