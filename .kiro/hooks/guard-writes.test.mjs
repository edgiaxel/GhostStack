import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const script = fileURLToPath(new URL('./guard-writes.mjs', import.meta.url));
const ROOT = 'C:/work/GhostStack';
const WORKTREE = 'C:/work/GhostStack/.worktrees/card-editor';

/** Runs the hook the way Kiro does: event JSON on stdin, exit code and stderr as the result. */
function run(event, env = {}) {
  const r = spawnSync(process.execPath, [script], {
    input: JSON.stringify(event),
    encoding: 'utf8',
    env: { ...process.env, GS_ROLE: '', GS_EVIDENCE: 'off', ...env },
  });
  return { code: r.status, stderr: r.stderr };
}
const write = (cwd, path, text, tool = 'fs_write') => ({
  hook_event_name: 'PreToolUse',
  cwd,
  tool_name: tool,
  tool_input: tool === 'str_replace' ? { path, oldStr: 'a', newStr: text } : { path, text },
});

describe('guard-writes', () => {
  it('allows ordinary source edits', () => {
    assert.equal(run(write(ROOT, 'apps/web/src/features/card-editor/CardCanvas.tsx', 'export const a = 1;')).code, 0);
  });

  it('blocks credentials anywhere', () => {
    const r = run(write(ROOT, 'notes.txt', 'token = ghp_abcdefghijklmnopqrstuvwxyz0123456789'));
    assert.equal(r.code, 2);
    assert.match(r.stderr, /credential/);
    assert.equal(run(write(ROOT, 'a.txt', '-----BEGIN RSA PRIVATE KEY-----\nxx')).code, 2);
  });

  it('blocks listing .kiro in .gitignore but allows other entries', () => {
    assert.equal(run(write(ROOT, '.gitignore', 'dist/\n.kiro/\n')).code, 2);
    assert.equal(run(write(ROOT, '.gitignore', 'dist/\nnode_modules/\n.kiro-cache-not-this-one\n')).code, 0);
    assert.equal(run(write(ROOT, '.gitignore', 'dist/\n', 'str_replace')).code, 0);
  });

  it('blocks eval and new Function in source but not evaluate() or tests', () => {
    assert.equal(run(write(ROOT, 'packages/behavior/src/x.ts', 'const v = eval(src);')).code, 2);
    assert.equal(run(write(ROOT, 'apps/web/src/a.tsx', 'const f = new Function("return 1");')).code, 2);
    assert.equal(run(write(ROOT, 'packages/behavior/src/x.ts', 'export function evaluate(e) { return page.evaluate(e); }')).code, 0);
    assert.equal(run(write(ROOT, 'packages/behavior/src/x.test.ts', "expect(src).not.toContain('eval(')")).code, 0);
  });

  it('lets the orchestrator edit central files but stops a worktree agent', () => {
    assert.equal(run(write(ROOT, 'packages/shared-contracts/src/behavior.ts', 'x')).code, 0);
    const blocked = run(write(WORKTREE, 'packages/shared-contracts/src/behavior.ts', 'x'));
    assert.equal(blocked.code, 2);
    assert.match(blocked.stderr, /central file/);
    assert.equal(run(write(WORKTREE, 'package.json', '{}')).code, 2);
    assert.equal(run(write(WORKTREE, 'apps/web/src/themes/tokens.css', 'x')).code, 2);
    assert.equal(run(write(WORKTREE, 'docs/UI_CONTRACT.md', 'x')).code, 2);
  });

  it('keeps a worktree agent inside its own folders and its handoff', () => {
    assert.equal(run(write(WORKTREE, 'apps/web/src/features/card-editor/index.tsx', 'x')).code, 0);
    assert.equal(run(write(WORKTREE, 'docs/handoffs/m2/card-editor-handoff.md', 'x')).code, 0);
    assert.equal(run(write(WORKTREE, 'tests/e2e/m2-card-editor.spec.ts', 'x')).code, 0);
  });

  it('honors GS_ROLE=worktree for non-standard worktree locations', () => {
    assert.equal(run(write('C:/elsewhere/ghoststack', 'package.json', '{}'), { GS_ROLE: 'worktree' }).code, 2);
  });

  it('logs a block for the evidence report without storing the blocked content', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gs-evidence-'));
    const log = join(dir, 'hooks.jsonl');
    // Built at run time so this file does not itself trip the credential guard.
    const secret = `ghp_${'a1B2'.repeat(9)}`;
    const event = { ...write(ROOT, 'notes.txt', `token = ${secret}`), session_id: 'sess-1' };
    assert.equal(run(event, { GS_EVIDENCE: 'on', GS_EVIDENCE_LOG: log }).code, 2);
    const raw = readFileSync(log, 'utf8');
    const entry = JSON.parse(raw.trim());
    assert.equal(entry.hook, 'guard-writes');
    assert.equal(entry.outcome, 'blocked');
    assert.equal(entry.rule, 'credential');
    assert.equal(entry.target, 'notes.txt');
    assert.equal(entry.session, 'sess-1');
    assert.ok(!raw.includes(secret), 'the secret must never be written to the evidence log');
    // An allowed write logs nothing.
    run(write(ROOT, 'apps/web/src/a.ts', 'export const a = 1;'), { GS_EVIDENCE: 'on', GS_EVIDENCE_LOG: log });
    assert.equal(readFileSync(log, 'utf8').trim().split('\n').length, 1);
    rmSync(dir, { recursive: true, force: true });
  });

  it('fails open on malformed input and on events without a path', () => {
    const r = spawnSync(process.execPath, [script], { input: 'not json', encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.equal(run({ cwd: ROOT, tool_name: 'fs_write', tool_input: {} }).code, 0);
  });
});
