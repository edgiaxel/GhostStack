import { describe, expect, it } from 'vitest';

describe('test environment', () => {
  it('has no DOM globals', () => {
    const scope = globalThis as { window?: unknown; document?: unknown };
    expect(scope.window).toBeUndefined();
    expect(scope.document).toBeUndefined();
  });
});
