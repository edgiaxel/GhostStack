import type { PathSegment, ValidationError } from './types';

function compareText(a: string, b: string): number {
  // Code-unit order on purpose: localeCompare would depend on the runtime locale.
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareSegment(a: PathSegment, b: PathSegment): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'number') return -1;
  if (typeof b === 'number') return 1;
  return compareText(a, b);
}

function comparePath(a: readonly PathSegment[], b: readonly PathSegment[]): number {
  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i += 1) {
    const result = compareSegment(a[i]!, b[i]!);
    if (result !== 0) return result;
  }
  return a.length - b.length;
}

function detailsKey(details: ValidationError['details']): string {
  return Object.keys(details)
    .sort(compareText)
    .map((key) => `${key}=${String(details[key])}`)
    .join('\u0000');
}

export function compareErrors(a: ValidationError, b: ValidationError): number {
  return (
    comparePath(a.path, b.path) ||
    compareText(a.code, b.code) ||
    compareText(a.message, b.message) ||
    compareText(detailsKey(a.details), detailsKey(b.details))
  );
}

export function sortErrors(errors: readonly ValidationError[]): ValidationError[] {
  return [...errors].sort(compareErrors);
}
