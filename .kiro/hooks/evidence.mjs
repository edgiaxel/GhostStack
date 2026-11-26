// Shared by the hook scripts. Appends one JSON line per notable hook event to
// .kiro/evidence/hooks-<folder>.jsonl, which `npm run evidence` turns into docs/KIRO-EVIDENCE.md.
// Entries hold the hook name, outcome, rule and target path only. Never file content or secrets.
// GS_EVIDENCE=off disables logging (the tests use it). GS_EVIDENCE_LOG overrides the file path.
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export function record(entry) {
  if (process.env.GS_EVIDENCE === 'off') return;
  try {
    const file =
      process.env.GS_EVIDENCE_LOG ?? path.join('.kiro', 'evidence', `hooks-${path.basename(process.cwd())}.jsonl`);
    mkdirSync(path.dirname(file), { recursive: true });
    appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
  } catch {
    // Evidence is a convenience. It must never break or slow a hook.
  }
}
