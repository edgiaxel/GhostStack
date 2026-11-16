import { describe, expect, it } from 'vitest';
import { err, ok, type Result } from './result';

describe('Result', () => {
  it('ok wraps a value', () => {
    expect(ok(3)).toEqual({ ok: true, value: 3 });
  });

  it('err wraps an error', () => {
    expect(err('bad')).toEqual({ ok: false, error: 'bad' });
  });

  it('narrows on the ok flag', () => {
    const make = (): Result<number, string> => ok(1);
    const result = make();
    expect(result.ok ? result.value : result.error).toBe(1);
  });
});
