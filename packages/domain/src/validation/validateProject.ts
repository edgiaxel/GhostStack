import { sortErrors } from './order';
import { semanticErrors } from './semantic';
import { structuralErrors } from './structural';
import type { ValidationResult } from './types';

/**
 * Total, pure and deterministic: never throws, never mutates the input, and
 * never recurses into user data, so deeply nested input cannot overflow the stack.
 */
export function validateProject(input: unknown): ValidationResult {
  try {
    // The semantic phase runs even after structural errors so one call reports everything.
    return { errors: sortErrors([...structuralErrors(input), ...semanticErrors(input)]) };
  } catch {
    return {
      errors: [
        {
          code: 'VALIDATOR_INTERNAL_ERROR',
          message: 'The validator failed unexpectedly.',
          path: [],
          details: {},
        },
      ],
    };
  }
}
