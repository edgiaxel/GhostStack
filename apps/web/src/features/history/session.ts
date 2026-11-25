import { applyCommand, validateStack } from '@ghoststack/domain';
import { err, ok } from '@ghoststack/shared-contracts';
import type {
  CheckpointRepository,
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

export interface SessionDeps {
  stacks: StackRepository;
  checkpoints: CheckpointRepository;
  /** Quiet period before an edit is written to the Stack store. Default 600 ms. */
  debounceMs?: number;
  /** ISO 8601 clock. Default `new Date().toISOString()`. */
  now?: () => string;
}

export const MAX_UNDO = 100;
export const recoveryId = (stackId: string): string => `recovery:${stackId}`;

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * Editing session with validated dispatch, coalesced undo and redo, debounced autosave and
 * crash recovery. All IndexedDB writes run through one queue so they never overlap.
 */
export function createStackSessionFactory(deps: SessionDeps): StackSessionFactory {
  const debounceMs = deps.debounceMs ?? 600;
  const now = deps.now ?? ((): string => new Date().toISOString());

  return {
    async open(stackId): Promise<Result<StackSession, GhostError>> {
      let saved: Stack | undefined;
      try {
        saved = await deps.stacks.get(stackId);
      } catch (e) {
        return err({ code: 'STORAGE_FAILED', message: message(e) });
      }
      if (!saved) return err({ code: 'STACK_NOT_FOUND', message: `Stack not found: ${stackId}` });

      let stack: Stack = saved;
      let recovered = false;
      try {
        const cp = await deps.checkpoints.get(recoveryId(stackId));
        if (cp && cp.stack.updatedAt > saved.updatedAt) {
          const valid = validateStack(cp.stack);
          if (valid.ok) {
            stack = valid.value;
            recovered = true;
          }
        }
      } catch {
        // An unreadable recovery checkpoint must not block opening the saved Stack.
      }

      let undoStack: Stack[] = [];
      let redoStack: Stack[] = [];
      let lastKey: string | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let io: Promise<void> = Promise.resolve();
      let disposed = false;
      const listeners = new Set<() => void>();

      let status: SessionStatus = {
        saveState: recovered ? 'dirty' : 'saved',
        canUndo: false,
        canRedo: false,
      };
      if (recovered) status = { ...status, recovered: true };

      const setStatus = (
        patch: Partial<Omit<SessionStatus, 'error'>> & { error?: string | undefined },
      ): void => {
        const { error: _e, ...rest } = status;
        void _e;
        const next: SessionStatus = {
          ...rest,
          canUndo: undoStack.length > 0,
          canRedo: redoStack.length > 0,
          ...patch,
        } as SessionStatus;
        if (patch.error === undefined) delete next.error;
        status = next;
        listeners.forEach((l) => l());
      };

      const queue = (task: () => Promise<void>): Promise<void> => {
        io = io.then(task, task);
        return io;
      };

      const writeRecovery = (snapshot: Stack): void => {
        void queue(async () => {
          try {
            await deps.checkpoints.put({
              checkpointId: recoveryId(stackId),
              stackId,
              label: 'Recovery',
              kind: 'recovery',
              createdAt: now(),
              stack: snapshot,
            });
          } catch {
            // Best effort: the debounced save is the durable path.
          }
        });
      };

      const save = (): Promise<void> => {
        if (timer !== undefined) clearTimeout(timer);
        timer = undefined;
        const snapshot = stack;
        setStatus({ saveState: 'saving' });
        return queue(async () => {
          try {
            await deps.stacks.save(snapshot);
          } catch (e) {
            setStatus({ saveState: 'error', error: message(e) });
            return;
          }
          if (stack === snapshot) {
            try {
              await deps.checkpoints.delete(recoveryId(stackId));
            } catch {
              // A stale recovery checkpoint is ignored on open because it is not newer.
            }
            setStatus({ saveState: 'saved' });
          } else {
            setStatus({ saveState: 'dirty' });
          }
        });
      };

      const changed = (): void => {
        setStatus({ saveState: 'dirty' });
        writeRecovery(stack);
        if (timer !== undefined) clearTimeout(timer);
        timer = setTimeout(() => void save(), debounceMs);
      };

      const push = (previous: Stack): void => {
        undoStack.push(previous);
        if (undoStack.length > MAX_UNDO) undoStack = undoStack.slice(undoStack.length - MAX_UNDO);
        redoStack = [];
      };

      const session: StackSession = {
        stackId,
        getStack: () => stack,
        getStatus: () => status,
        subscribe(listener) {
          listeners.add(listener);
          return () => void listeners.delete(listener);
        },
        dispatch(command: ProjectCommand, options?: DispatchOptions) {
          const result = applyCommand(stack, command, now());
          if (!result.ok) return result;
          const key = options?.coalesceKey;
          const merge = key !== undefined && key === lastKey && undoStack.length > 0;
          if (!merge) push(stack);
          else redoStack = [];
          lastKey = key;
          stack = result.value;
          changed();
          return ok(stack);
        },
        restore(snapshot) {
          if (snapshot.stackId !== stackId) {
            return err({ code: 'INVALID_PATCH_COMMAND', message: 'Snapshot belongs to a different Stack' });
          }
          const valid = validateStack({ ...snapshot, updatedAt: now() });
          if (!valid.ok) return valid;
          push(stack);
          lastKey = undefined;
          stack = valid.value;
          changed();
          return ok(stack);
        },
        undo() {
          const previous = undoStack.pop();
          if (!previous) return false;
          redoStack.push(stack);
          stack = { ...previous, updatedAt: now() };
          lastKey = undefined;
          changed();
          return true;
        },
        redo() {
          const next = redoStack.pop();
          if (!next) return false;
          undoStack.push(stack);
          stack = { ...next, updatedAt: now() };
          lastKey = undefined;
          changed();
          return true;
        },
        async flush() {
          if (disposed) return io;
          if (status.saveState === 'dirty' || status.saveState === 'error') await save();
          await io;
        },
        dispose() {
          disposed = true;
          if (timer !== undefined) clearTimeout(timer);
          timer = undefined;
          listeners.clear();
        },
      };

      if (recovered) {
        // Persist the recovered Stack right away so the next open starts from durable data.
        void save();
      }
      return ok(session);
    },
  };
}
