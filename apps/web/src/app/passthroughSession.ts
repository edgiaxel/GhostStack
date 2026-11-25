import { applyCommand } from '@ghoststack/domain';
import { err, ok } from '@ghoststack/shared-contracts';
import type {
  DispatchOptions,
  GhostError,
  ProjectCommand,
  Result,
  SessionStatus,
  Stack,
  StackRepository,
  StackSession,
  StackSessionFactory,
} from '@ghoststack/shared-contracts';

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * Orchestrator placeholder for `StackSessionFactory`: validates through `applyCommand` and saves
 * every change immediately. No debounce, undo, redo or recovery. The `history` worktree replaces
 * it with the real implementation in `features/history`.
 */
export function createPassthroughSessionFactory(stacks: StackRepository): StackSessionFactory {
  return {
    async open(stackId): Promise<Result<StackSession, GhostError>> {
      let loaded: Stack | undefined;
      try {
        loaded = await stacks.get(stackId);
      } catch (e) {
        return err({ code: 'STORAGE_FAILED', message: message(e) });
      }
      if (!loaded) return err({ code: 'STACK_NOT_FOUND', message: `Stack not found: ${stackId}` });

      let stack: Stack = loaded;
      let status: SessionStatus = { saveState: 'saved', canUndo: false, canRedo: false };
      let pending: Promise<void> = Promise.resolve();
      const listeners = new Set<() => void>();
      const emit = (): void => listeners.forEach((l) => l());
      const setStatus = (next: Partial<SessionStatus>): void => {
        const { error: _previous, ...rest } = status;
        void _previous;
        status = { ...rest, ...next };
        emit();
      };

      const save = (snapshot: Stack): void => {
        setStatus({ saveState: 'saving' });
        pending = pending
          .then(() => stacks.save(snapshot))
          .then(
            () => {
              if (stack === snapshot) setStatus({ saveState: 'saved' });
            },
            (e: unknown) => setStatus({ saveState: 'error', error: message(e) }),
          );
      };

      const session: StackSession = {
        stackId,
        getStack: () => stack,
        getStatus: () => status,
        subscribe(listener) {
          listeners.add(listener);
          return () => void listeners.delete(listener);
        },
        dispatch(command: ProjectCommand, _options?: DispatchOptions) {
          void _options;
          const result = applyCommand(stack, command, new Date().toISOString());
          if (!result.ok) return result;
          stack = result.value;
          save(stack);
          return ok(stack);
        },
        undo: () => false,
        redo: () => false,
        flush: () => pending,
        dispose() {
          listeners.clear();
        },
      };
      return ok(session);
    },
  };
}
