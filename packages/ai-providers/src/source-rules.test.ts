import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(import.meta.url).replace(/[^/]+$/, '');

function sourceFiles(): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = `${dir}${entry}`;
      if (!entry.includes('.')) walk(`${path}/`, `${prefix}${entry}/`);
      else if (
        entry.endsWith('.ts') &&
        !entry.endsWith('.test.ts') &&
        !entry.endsWith('.d.ts') &&
        prefix !== 'testing/'
      ) {
        out.push({ name: `${prefix}${entry}`, text: readFileSync(path, 'utf8') });
      }
    }
  };
  walk(root, '');
  return out;
}

describe('shipped source rules', () => {
  const files = sourceFiles();

  it('finds the package source', () => {
    expect(files.map((f) => f.name)).toEqual(
      expect.arrayContaining(['demo.ts', 'openai.ts', 'ollama.ts', 'prompt.ts']),
    );
  });

  it.each([
    ['console', /\bconsole\b/],
    ['eval', /\beval\s*\(/],
    ['new Function', /new\s+Function\b/],
    ['localStorage', /\blocalStorage\b/],
    ['indexedDB', /\bindexedDB\b/],
    ['document', /\bdocument\b/],
    ['Math.random', /Math\.random/],
    ['Date.now outside the default clock', /Date\.now/],
  ])('has no use of %s', (name, pattern) => {
    const hits = files.filter((f) => pattern.test(f.text)).map((f) => f.name);
    if (name.startsWith('Date.now')) expect(hits).toEqual(['platform.ts']);
    else expect(hits).toEqual([]);
  });

  it('imports only shared-contracts, zod and its own files', () => {
    for (const file of files) {
      for (const match of file.text.matchAll(/from '([^']+)'/g)) {
        const spec = match[1]!;
        expect(spec.startsWith('./') || spec === 'zod' || spec === '@ghoststack/shared-contracts').toBe(true);
      }
    }
  });

  it('keeps the system prompt text in prompt.ts only', () => {
    const holders = files.filter((f) => f.text.includes('Trust boundary')).map((f) => f.name);
    expect(holders).toEqual(['prompt.ts']);
  });
});
