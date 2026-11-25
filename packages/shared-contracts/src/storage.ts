import type { Stack } from './project';

export interface StackSummary {
  stackId: string;
  title: string;
  updatedAt: string;
  cardCount: number;
}

/**
 * Storage port. Implemented by `@ghoststack/storage`; UI code depends on this interface only.
 * Methods reject with an Error whose `code` is an `ErrorCode` when persistence or validation fails.
 * `save` validates before writing and replaces the whole Stack atomically.
 */
export interface StackRepository {
  list(): Promise<StackSummary[]>;
  get(stackId: string): Promise<Stack | undefined>;
  save(stack: Stack): Promise<void>;
  delete(stackId: string): Promise<void>;
}
