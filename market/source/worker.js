// Dedicated animation thread. The native renderer is prepended by build.py.
let renderer, canvas, view, epoch = 0, frame = 0, frames = 0, last = 0, maxGap = 0;
let lastCoverage = 0, exitAt = SAO_EXIT.end, fading = false, exitEarliest = SAO_EXIT.nativeEarliest;
function tick(now) {
  const clock = performance.timeOrigin + now;
  if (last) maxGap = Math.max(maxGap, clock - last);
  last = clock; frames++;
  const elapsed = clock - epoch;
  renderer.draw(elapsed - 1000, saoStartupBackgroundOpacity(elapsed));
  if (!fading && elapsed >= exitEarliest && elapsed - lastCoverage >= SAO_EXIT.interval) {
    lastCoverage = elapsed;
    const coverage = renderer.lightCoverage(elapsed - 1000);
    if (coverage <= SAO_EXIT.threshold || elapsed >= SAO_EXIT.latest) {
      fading = true;
      const duration = Math.max(0, Math.min(SAO_EXIT.duration, SAO_EXIT.end - elapsed));
      exitAt = elapsed + duration;
      postMessage({ type: 'fade', duration, coverage, elapsed });
    }
  }
  if (elapsed >= exitAt) {
    renderer.dispose();
    postMessage({ type: 'done', frames, maxGap, width: canvas.width, height: canvas.height });
    close(); return;
  }
  frame = requestAnimationFrame(tick);
}
onmessage = ({ data }) => {
  try {
    if (data.type === 'init') {
      canvas = data.canvas; view = data.view;
      renderer = NativeSAO.createRenderer(canvas, data.seed, view);
      if (!renderer) throw Error('Worker renderer unavailable');
      renderer.draw(-1000); postMessage({ type: 'ready' });
    } else if (data.type === 'start') {
      cancelAnimationFrame(frame); epoch = data.epoch; frames = 0; last = 0; maxGap = 0;
      lastCoverage = 0; exitAt = SAO_EXIT.end; fading = false;
      frame = requestAnimationFrame(tick);
    } else if (data.type === 'resize') Object.assign(view, data.view);
  } catch { renderer?.dispose(); postMessage({ type: 'unsupported' }); close(); }
};
