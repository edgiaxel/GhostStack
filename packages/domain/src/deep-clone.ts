/** Deep copy of plain JSON-like data. `structuredClone` is unavailable without the DOM lib. */
export function deepClone<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => deepClone(v)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deepClone(v)])) as T;
  }
  return value;
}
