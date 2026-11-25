import { describe, expect, it } from 'vitest';
import { matchPath } from './router';

describe('matchPath', () => {
  it('extracts params', () => {
    expect(matchPath('/stack/:stackId/card/:cardId', '/stack/a/card/b')).toEqual({
      params: { stackId: 'a', cardId: 'b' },
    });
  });
  it('rejects different shapes', () => {
    expect(matchPath('/stack/:stackId', '/library')).toBeUndefined();
    expect(matchPath('/stack/:stackId', '/stack/a/card/b')).toBeUndefined();
  });
});
