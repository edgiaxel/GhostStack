/** Small pure helpers shared inside ai-core. All of them work on JSON-like data. */

/** Deep copy of JSON-like data. `structuredClone` is not available under the ES2022-only lib. */
export function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => clone(v)) as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = clone(v);
    return out as T;
  }
  return value;
}

/** Structural equality for JSON-like data. Key order does not matter; `undefined` keys count as absent. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  const ea = Object.entries(a).filter(([, v]) => v !== undefined);
  const eb = Object.entries(b).filter(([, v]) => v !== undefined);
  if (ea.length !== eb.length) return false;
  const rb = b as Record<string, unknown>;
  return ea.every(([k, v]) => Object.prototype.hasOwnProperty.call(rb, k) && deepEqual(v, rb[k]));
}

/** UTF-8 byte length of a string without TextEncoder (not in the ES2022 lib). */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

/** JSON text with object keys sorted at every level: a fixed key order for any value. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}
