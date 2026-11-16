import { describe, expect, it } from 'vitest';
import { canonicalJson } from './canonicalJson';

describe('canonicalJson', () => {
  it('sorts keys at every level and emits no whitespace', () => {
    const value = { b: 1, a: { d: [{ z: 1, y: 2 }], c: null } };
    expect(canonicalJson(value)).toBe('{"a":{"c":null,"d":[{"y":2,"z":1}]},"b":1}');
  });

  it('keeps array order and sorts by UTF-16 code unit', () => {
    expect(canonicalJson({ b: [3, 1, 2], B: 0, '\u00e9': 1, z: 2 })).toBe(
      '{"B":0,"b":[3,1,2],"z":2,"\u00e9":1}',
    );
  });

  it('gives equal output for different insertion orders', () => {
    expect(canonicalJson({ a: 1, b: { x: 1, y: 2 } })).toBe(
      canonicalJson({ b: { y: 2, x: 1 }, a: 1 }),
    );
  });
});
