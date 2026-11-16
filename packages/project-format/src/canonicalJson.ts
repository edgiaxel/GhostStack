function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) sorted[key] = canonicalize(source[key]);
    return sorted;
  }
  return value;
}

// Default sort() compares UTF-16 code units, which is the order the format requires.
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}
