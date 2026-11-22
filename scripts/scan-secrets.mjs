// Fails when a tracked or untracked (non-ignored) file contains key-like material.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PATTERNS = [
  { name: 'OpenRouter key', re: /sk-or-[A-Za-z0-9_-]{8,}/ },
  { name: 'OpenAI-style key', re: /sk-[A-Za-z0-9]{20,}/ },
  { name: 'GitHub token', re: /gh[opsu]_[A-Za-z0-9]{20,}/ },
  { name: 'Private key block', re: /BEGIN [A-Z ]*PRIVATE KEY/ },
];
const SKIP = new Set(['package-lock.json']);

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter((f) => f && !SKIP.has(f));

let findings = 0;
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (text.includes('\u0000')) continue;
  for (const { name, re } of PATTERNS) {
    if (re.test(text)) {
      findings += 1;
      console.error(`${file}: possible ${name}`);
    }
  }
}
if (findings > 0) {
  console.error(`Secret scan failed: ${findings} finding(s). Values are not printed.`);
  process.exit(1);
}
console.log(`Secret scan passed (${files.length} files).`);
