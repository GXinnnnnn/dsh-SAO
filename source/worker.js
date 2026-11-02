// Dedicated animation thread. The exact native scene implementation is prepended by build.py.
let renderer, canvas, view, epoch = 0, frame = 0, frames = 0, last = 0, maxGap = 0;
function tick(now) {
  const clock = performance.timeOrigin + now;
  if (last) maxGap = Math.max(maxGap, clock - last);
  last = clock; frames++;
  const elapsed = clock - epoch;
  renderer.draw(elapsed - 1000);
  if (elapsed >= 5250) {
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
      if (!renderer) throw Error('Worker WebGL unavailable');
      renderer.draw(-1000); postMessage({ type: 'ready' });
    } else if (data.type === 'start') {
      cancelAnimationFrame(frame); epoch = data.epoch; frames = 0; last = 0; maxGap = 0;
      frame = requestAnimationFrame(tick);
    } else if (data.type === 'resize') Object.assign(view, data.view);
  } catch { renderer?.dispose(); postMessage({ type: 'unsupported' }); close(); }
};
