// PreToolUse guard for file writes. Registered by .kiro/hooks/guard-writes.json.
// Input: the hook event as JSON on stdin ({ cwd, tool_name, tool_input }).
// Exit 0 allows the write. Exit 2 blocks it and sends stderr to the agent.
// Every block is also logged by evidence.mjs. Test: node --test .kiro/hooks
import path from 'node:path';
import { record } from './evidence.mjs';

/** Mirror of docs/UI_CONTRACT.md section 1. Update both together. Paths are relative to the workspace root. */
const CENTRAL = [
  /^package\.json$/,
  /^package-lock\.json$/,
  /^tsconfig[^/]*\.json$/,
  /^eslint\.config\.js$/,
  /^vitest\.config\.ts$/,
  /^playwright\.config\.ts$/,
  /^\.prettierrc\.json$/,
  /^apps\/web\/(package|tsconfig)\.json$/,
  /^apps\/web\/vite\.config\.ts$/,
  /^packages\/[^/]+\/(package|tsconfig)\.json$/,
  /^apps\/web\/src\/(App|main)\.tsx$/,
  /^apps\/web\/src\/app\//,
  /^apps\/web\/src\/themes\//,
  /^packages\/shared-contracts\//,
  /^docs\/(?!handoffs\/)/,
];

const SECRETS = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bghp_[A-Za-z0-9]{30,}\b/,
  /\bsk-[A-Za-z0-9_-]{32,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/,
];

const CODE_FILE = /^(apps|packages)\/.*\.(ts|tsx|js|jsx|mjs)$/;
const TEST_FILE = /\.(test|spec)\./;
const GENERATED_CODE = [/\beval\s*\(/, /\bnew\s+Function\s*\(/];

/** Returns `{ rule, reason }` when the write must be blocked, otherwise undefined. */
export function check(event) {
  const input = event?.tool_input ?? {};
  const target = input.path ?? input.targetFile ?? input.file_path;
  if (typeof target !== 'string' || target.length === 0) return undefined;

  const root = typeof event.cwd === 'string' && event.cwd ? event.cwd : process.cwd();
  const rel = path.relative(root, path.resolve(root, target)).split(path.sep).join('/');
  const content = [input.text, input.newStr, input.content].filter((v) => typeof v === 'string').join('\n');

  const secret = SECRETS.find((re) => re.test(content));
  if (secret) {
    return {
      rule: 'credential',
      reason: `Blocked: the new content looks like a credential (${secret.source.slice(0, 24)}...). Secrets must never be written to the repository (AGENTS.md rule 7). Use an environment variable.`,
    };
  }

  if (rel === '.gitignore' && /^\s*\/?\.kiro(\/|\s|$)/m.test(content)) {
    return {
      rule: 'gitignore-kiro',
      reason:
        'Blocked: .kiro/ must never be listed in .gitignore. The hackathon requires it to be committed (AGENTS.md rule 8).',
    };
  }

  if (CODE_FILE.test(rel) && !TEST_FILE.test(rel) && GENERATED_CODE.some((re) => re.test(content))) {
    return {
      rule: 'generated-code',
      reason:
        'Blocked: eval() and new Function() are not allowed. Behavior runs only through the constrained AST runtime (AGENTS.md rule 9).',
    };
  }

  const inWorktree = /(^|[\\/])\.worktrees[\\/]/.test(root) || process.env.GS_ROLE === 'worktree';
  if (inWorktree && !rel.startsWith('..') && CENTRAL.some((re) => re.test(rel))) {
    return {
      rule: 'central-file',
      reason: `Blocked: ${rel} is a central file (docs/UI_CONTRACT.md section 1). Worktrees must not edit it. Describe the change in your HANDOFF.md under "contract changes requested" and let the orchestrator apply it.`,
    };
  }
  return undefined;
}

/** Target path relative to the workspace root, for the evidence log. */
function relativeTarget(event) {
  const input = event?.tool_input ?? {};
  const target = input.path ?? input.targetFile ?? input.file_path;
  if (typeof target !== 'string') return undefined;
  const root = typeof event.cwd === 'string' && event.cwd ? event.cwd : process.cwd();
  return path.relative(root, path.resolve(root, target)).split(path.sep).join('/');
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return; // A guard must not break the session because of a malformed event.
  }
  const verdict = check(event);
  if (verdict) {
    record({
      hook: 'guard-writes',
      outcome: 'blocked',
      rule: verdict.rule,
      tool: event.tool_name,
      target: relativeTarget(event),
      session: event.session_id,
    });
    process.stderr.write(`${verdict.reason}\n`);
    process.exit(2);
  }
}

if (process.argv[1]?.endsWith('guard-writes.mjs')) {
  await main();
}
