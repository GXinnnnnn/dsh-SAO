// Official Host entry: inject before frontend modules/React are initialized.
import { readFileSync } from 'node:fs';
export function apply(ctx) {
  ctx.on('webserver/index-inject', table => {
    // Same-version file updates must reach the next page without restarting the Host.
    const text = readFileSync(new URL('./startup.js', import.meta.url), 'utf8');
    table.unshift({ kind: 'script', placement: 'head', text });
  });
}
