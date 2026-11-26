// Fails when the initial bundle or the standalone player grows past its budget. Run after `npm run build`.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BUDGETS = [
  { label: 'initial entry chunk', dir: 'apps/web/dist/assets', match: /^index-.*\.js$/, maxKb: 350 },
  { label: 'standalone player', dir: 'apps/web/public', match: /^player\.standalone\.js$/, maxKb: 140 },
];

let failed = false;
for (const { label, dir, match, maxKb } of BUDGETS) {
  const files = readdirSync(dir).filter((f) => match.test(f));
  if (files.length === 0) {
    console.error(`FAIL ${label}: no file in ${dir}. Run npm run build first.`);
    failed = true;
    continue;
  }
  for (const f of files) {
    const kb = statSync(join(dir, f)).size / 1024;
    const ok = kb <= maxKb;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${f} ${kb.toFixed(1)} kB (budget ${maxKb} kB)`);
    if (!ok) failed = true;
  }
}
process.exit(failed ? 1 : 0);
