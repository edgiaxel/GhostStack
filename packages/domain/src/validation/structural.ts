import { StackSchema } from '../schemas';
import type { PathSegment, ValidationError } from './types';

function toPath(path: readonly PropertyKey[]): PathSegment[] {
  return path.map((segment) => (typeof segment === 'number' ? segment : String(segment)));
}

// Zod 4 issues carry no input value, so absent versus wrong type is read from the input.
function isAbsent(input: unknown, path: readonly PathSegment[]): boolean {
  if (path.length === 0) return false;
  let current: unknown = input;
  for (const segment of path.slice(0, -1)) {
    if (typeof current !== 'object' || current === null) return false;
    if (!Object.hasOwn(current, segment)) return false;
    current = (current as Record<PathSegment, unknown>)[segment];
  }
  if (typeof current !== 'object' || current === null) return false;
  const last = path[path.length - 1]!;
  return (
    !Object.hasOwn(current, last) || (current as Record<PathSegment, unknown>)[last] === undefined
  );
}

// Card titles are measured in code points by the semantic phase; the schema counts UTF-16 units.
function isCardTitleLength(code: string, path: readonly PathSegment[]): boolean {
  return code === 'too_big' && path.length === 3 && path[0] === 'cards' && path[2] === 'title';
}

export function structuralErrors(input: unknown): ValidationError[] {
  const parsed = StackSchema.safeParse(input);
  if (parsed.success) return [];

  const errors: ValidationError[] = [];
  for (const issue of parsed.error.issues) {
    const path = toPath(issue.path);

    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        errors.push({
          code: 'UNKNOWN_FIELD',
          message: 'Field is not part of the project format.',
          path: [...path, key],
          details: {},
        });
      }
    } else if (issue.code === 'invalid_type') {
      const absent = isAbsent(input, path);
      errors.push({
        code: absent ? 'MISSING_FIELD' : 'INVALID_TYPE',
        message: absent
          ? 'Required field is missing.'
          : `Field has the wrong type, expected ${issue.expected}.`,
        path,
        details: {},
      });
    } else if (
      (issue.code === 'invalid_union' || issue.code === 'invalid_value') &&
      isAbsent(input, path)
    ) {
      errors.push({
        code: 'MISSING_FIELD',
        message: 'Required field is missing.',
        path,
        details: {},
      });
    } else if (!isCardTitleLength(issue.code, path)) {
      errors.push({
        code: 'INVALID_VALUE',
        message: 'Field value is not permitted.',
        path,
        details: {},
      });
    }
  }
  return errors;
}
