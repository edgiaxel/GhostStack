// SessionStart hook. Prints a short briefing that Kiro adds to the agent's context, so a fresh
// session starts from the repository's real state instead of a pasted summary.
// Registered by .kiro/hooks/session-brief.json. Output stays under about 1,500 characters.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { record } from './evidence.mjs';

const git = (...args) => {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : '';
};

/** First paragraph under "### Current issue" in docs/MILESTONE.md. */
function currentFocus() {
  if (!existsSync('docs/MILESTONE.md')) return '';
  const text = readFileSync('docs/MILESTONE.md', 'utf8');
  const start = text.indexOf('### Current issue');
  if (start < 0) return '';
  const body = text.slice(start + '### Current issue'.length);
  const end = body.search(/\n### /);
  return (end < 0 ? body : body.slice(0, end)).trim().split(/\n\s*\n/)[0] ?? '';
}

const branch = git('rev-parse', '--abbrev-ref', 'HEAD') || 'unknown';
const changed = git('status', '--porcelain').split('\n').filter(Boolean).length;
const inWorktree = /[\\/]\.worktrees[\\/]/.test(process.cwd());
const commits = git('log', '--oneline', '-3').split('\n').filter(Boolean);
const focus = currentFocus();

const lines = [
  'GhostStack session brief',
  `Branch: ${branch}${inWorktree ? ' (worktree: central files are read-only, see docs/UI_CONTRACT.md section 1)' : ''}. Uncommitted files: ${changed}.`,
  commits.length ? `Latest commits: ${commits.join(' | ')}` : '',
  focus ? `Current focus (docs/MILESTONE.md section 5): ${focus.replace(/\s+/g, ' ')}` : '',
  'Read first: HANDOFF.md, docs/AUDIT-M2.md, docs/UI_CONTRACT.md. Specs for each chunk live in .kiro/specs/.',
  'Rules: real data only (no mocks), change Stacks through session.dispatch, report only commands you actually ran.',
].filter(Boolean);

record({ hook: 'session-brief', outcome: 'ran', branch, uncommitted: changed, worktree: inWorktree });
process.stdout.write(`${lines.join('\n')}\n`);
