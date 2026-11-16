import { describe, expect, it } from 'vitest';
import { ID_PATTERNS, generateId, type IdPrefix } from './ids';

const PREFIXES: readonly IdPrefix[] = ['stk', 'crd', 'elm', 'ast'];

describe('generateId', () => {
  it.each(PREFIXES)('matches the %s pattern', (prefix) => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateId(prefix)).toMatch(ID_PATTERNS[prefix]);
    }
  });

  it('does not match the pattern of another prefix', () => {
    expect(generateId('stk')).not.toMatch(ID_PATTERNS.crd);
  });

  it('produces no duplicates in 1,000 generations', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      seen.add(generateId('elm'));
    }
    expect(seen.size).toBe(1000);
  });
});
