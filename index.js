// Official Host entry: inject before frontend modules/React are initialized.
import { readFileSync } from 'node:fs';
export function apply(ctx) {
  const text = readFileSync(new URL('./startup.js', import.meta.url), 'utf8');
  ctx.on('webserver/index-inject', table => {
    table.unshift({ kind: 'script', placement: 'head', text });
  });
}
