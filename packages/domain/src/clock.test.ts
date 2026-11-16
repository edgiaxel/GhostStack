import { describe, expect, it } from 'vitest';
import { ISO_TIMESTAMP, defaultClock } from './clock';

describe('defaultClock', () => {
  it('returns an ISO 8601 UTC timestamp with milliseconds', () => {
    expect(defaultClock()).toMatch(ISO_TIMESTAMP);
  });

  it('rejects timestamps without the Z suffix', () => {
    expect(ISO_TIMESTAMP.test('2026-11-15T10:00:00.000+01:00')).toBe(false);
  });
});
