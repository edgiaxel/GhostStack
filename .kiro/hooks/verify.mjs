// Stop hook. After the agent finishes a turn that changed source files, run the type check and
// report failures back to the agent. Silent when nothing relevant changed or everything passes.
// Registered by .kiro/hooks/typecheck-on-stop.json.
import { spawnSync } from 'node:child_process';
import { record } from './evidence.mjs';

const status = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
const touchesSource = status.status === 0 && /^\s*\S+\s+(apps|packages|tests)\//m.test(status.stdout);
if (!touchesSource) process.exit(0);

const run = spawnSync('npm', ['run', 'typecheck'], { encoding: 'utf8', shell: true });
if (run.status === 0) {
  record({ hook: 'typecheck-on-stop', outcome: 'passed' });
  process.exit(0);
}

const tail = `${run.stdout}\n${run.stderr}`
  .split('\n')
  .filter((l) => /error TS|error|Error/.test(l))
  .slice(0, 25)
  .join('\n');
record({ hook: 'typecheck-on-stop', outcome: 'failed', errors: tail.split('\n').filter(Boolean).length });
process.stderr.write(`npm run typecheck failed. Fix these before reporting the task as done:\n${tail || '(no error lines captured; run the command to see the output)'}\n`);
process.exit(1);
