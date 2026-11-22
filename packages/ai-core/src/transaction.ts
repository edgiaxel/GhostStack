import { defaultDeps, err, ok, validateProject } from '@ghoststack/domain';
import type { FactoryDeps, ProjectBundle, Result } from '@ghoststack/domain';
import type { StoragePort } from '@ghoststack/storage';
import { createMemoryCheckpointStore } from './checkpoints';
import type { CheckpointRecord, CheckpointStore } from './checkpoints';
import type { AIIssue } from './errors';
import { applyPlan } from './patch';
import type { CommandReport } from './patch';
import type { AIPlan } from './plan';

declare const approvedBrand: unique symbol;
/** A plan the creator approved. Execution requires one; create it only from the approval UI. */
export interface ApprovedPlan {
  readonly plan: AIPlan;
  readonly approvedAt: string;
  readonly [approvedBrand]: true;
}
export const approvePlan = (plan: AIPlan, clock: () => string): ApprovedPlan =>
  ({ plan, approvedAt: clock() }) as ApprovedPlan;

export type TransactionStage =
  'load' | 'checkpoint' | 'apply' | 'validate' | 'commit' | 'finalize' | 'rollback';

export interface TransactionError extends AIIssue {
  readonly stage: TransactionStage;
  readonly commandIndex?: number;
  readonly validationErrorCount?: number;
}

/** Thrown by a hook to simulate the process dying. The manager deliberately does not catch it. */
export class CrashSignal extends Error {
  constructor(readonly stage: TransactionStage) {
    super(`simulated crash at ${stage}`);
  }
}

export interface TransactionHooks {
  /** May throw to inject a failure. Throw `CrashSignal` to simulate a crash. */
  readonly beforeStep?: (stage: TransactionStage) => void;
  readonly beforeCommand?: (index: number) => void;
}

export interface OperationReport {
  readonly operationId: string;
  readonly planId: string;
  readonly stackId: string;
  readonly committedAt: string;
  readonly commands: readonly CommandReport[];
}

export interface TransactionDeps {
  readonly storage: StoragePort;
  readonly checkpoints?: CheckpointStore;
  readonly deps?: Partial<FactoryDeps>;
  readonly newOperationId?: () => string;
}

const randomOperationId = (): string => {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `op_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
};

const txError = (
  stage: TransactionStage,
  code: AIIssue['code'],
  message: string,
  extra: Partial<TransactionError> = {},
): TransactionError => ({ stage, code, message, path: [], ...extra });

export function createTransactionManager(config: TransactionDeps) {
  const { storage } = config;
  const checkpoints = config.checkpoints ?? createMemoryCheckpointStore();
  const deps: FactoryDeps = { ...defaultDeps, ...config.deps };
  const newOperationId = config.newOperationId ?? randomOperationId;

  /** Runs one step. Hook and unexpected failures become a failed operation, except a simulated crash. */
  async function guard<T>(
    stage: TransactionStage,
    hooks: TransactionHooks | undefined,
    run: () => Promise<Result<T, TransactionError>> | Result<T, TransactionError>,
  ): Promise<Result<T, TransactionError>> {
    try {
      hooks?.beforeStep?.(stage);
      return await run();
    } catch (error) {
      if (error instanceof CrashSignal) throw error;
      return err(txError(stage, 'TRANSACTION_FAILED', `The ${stage} step failed unexpectedly.`));
    }
  }

  const put = async (stage: TransactionStage, record: CheckpointRecord) => {
    const stored = await checkpoints.put(record);
    return stored.ok
      ? ok<void>(undefined)
      : err(txError(stage, 'CHECKPOINT_FAILED', stored.error.message));
  };

  const markFailed = async (record: CheckpointRecord): Promise<void> => {
    // Best effort: a lost status update is repaired by `recover`.
    await checkpoints.put({ ...record, status: 'failed' });
  };

  return {
    checkpoints,

    /** A named recovery snapshot of the current project, outside any AI operation. */
    async createManualCheckpoint(
      stackId: string,
      label: string,
    ): Promise<Result<CheckpointRecord, TransactionError>> {
      const loaded = await storage.loadProject(stackId);
      if (!loaded.ok) return err(txError('load', 'CHECKPOINT_FAILED', loaded.error.message));
      const record: CheckpointRecord = {
        checkpointId: newOperationId(),
        stackId,
        label,
        status: 'manual',
        createdAt: deps.clock(),
        bundle: loaded.value,
      };
      const stored = await put('checkpoint', record);
      return stored.ok ? ok(record) : stored;
    },

    /**
     * Snapshot, apply to an isolated copy, validate, then commit atomically. Any failure before the
     * commit leaves the stored project untouched, and the commit itself is a single storage write.
     */
    async execute(
      stackId: string,
      approved: ApprovedPlan,
      hooks?: TransactionHooks,
    ): Promise<Result<OperationReport, TransactionError>> {
      const { plan } = approved;
      const loaded = await guard('load', hooks, async () => {
        const result = await storage.loadProject(stackId);
        return result.ok
          ? ok(result.value)
          : err(txError('load', 'TRANSACTION_FAILED', result.error.message));
      });
      if (!loaded.ok) return loaded;
      const before: ProjectBundle = loaded.value;

      const operationId = newOperationId();
      const pending: CheckpointRecord = {
        checkpointId: operationId,
        stackId,
        label: plan.requestSummary,
        planId: plan.planId,
        status: 'pending',
        createdAt: deps.clock(),
        bundle: before,
      };
      const saved = await guard('checkpoint', hooks, () => put('checkpoint', pending));
      if (!saved.ok) return saved;

      const applied = await guard('apply', hooks, () => {
        const result = applyPlan(before.stack, plan, {
          deps,
          ...(hooks?.beforeCommand ? { beforeCommand: hooks.beforeCommand } : {}),
        });
        return result.ok
          ? ok(result.value)
          : err(
              txError('apply', result.error.code, result.error.message, {
                commandIndex: result.error.commandIndex,
              }),
            );
      });
      if (!applied.ok) {
        await markFailed(pending);
        return applied;
      }

      const validated = await guard('validate', hooks, () => {
        const { errors } = validateProject(applied.value.project);
        return errors.length === 0
          ? ok<void>(undefined)
          : err(
              txError(
                'validate',
                'PROJECT_VALIDATION_FAILED',
                'The result is not a valid project.',
                {
                  validationErrorCount: errors.length,
                },
              ),
            );
      });
      if (!validated.ok) {
        await markFailed(pending);
        return validated;
      }

      // Persist the expected result before committing so recovery can tell whether a commit landed.
      const expected: CheckpointRecord = {
        ...pending,
        expectedUpdatedAt: applied.value.project.updatedAt,
      };
      const armed = await guard('checkpoint', hooks, () => put('checkpoint', expected));
      if (!armed.ok) {
        await markFailed(pending);
        return armed;
      }

      const committed = await guard('commit', hooks, async () => {
        const result = await storage.saveProject({
          stack: applied.value.project,
          assets: before.assets,
        });
        return result.ok
          ? ok<void>(undefined)
          : err(txError('commit', 'TRANSACTION_FAILED', result.error.message));
      });
      if (!committed.ok) {
        await markFailed(pending);
        return committed;
      }

      const finalized = await guard('finalize', hooks, () =>
        put('finalize', { ...expected, status: 'committed' }),
      );
      // The project is already committed. A lost status update is repaired by `recover`.
      void finalized;

      return ok({
        operationId,
        planId: plan.planId,
        stackId,
        committedAt: applied.value.project.updatedAt,
        commands: applied.value.reports,
      });
    },

    /**
     * Restores the pre-operation project. Refuses when the project changed after the commit, so
     * later edits are never silently discarded.
     */
    async rollback(operationId: string): Promise<Result<void, TransactionError>> {
      const found = await checkpoints.get(operationId);
      if (!found.ok) return err(txError('rollback', 'CHECKPOINT_FAILED', found.error.message));
      const record = found.value;
      if (record.status !== 'committed') {
        return err(
          txError(
            'rollback',
            'TRANSACTION_FAILED',
            `Operation is ${record.status}, not committed.`,
          ),
        );
      }
      const current = await storage.loadProject(record.stackId);
      if (!current.ok) return err(txError('rollback', 'TRANSACTION_FAILED', current.error.message));
      if (current.value.stack.updatedAt !== record.expectedUpdatedAt) {
        return err(
          txError('rollback', 'ROLLBACK_CONFLICT', 'The project changed after the operation.'),
        );
      }
      const restored = await storage.saveProject(record.bundle);
      if (!restored.ok)
        return err(txError('rollback', 'TRANSACTION_FAILED', restored.error.message));
      const marked = await checkpoints.put({ ...record, status: 'rolled-back' });
      return marked.ok
        ? ok<void>(undefined)
        : err(txError('rollback', 'CHECKPOINT_FAILED', marked.error.message));
    },

    /** After a restart: settles operations left `pending` by a crash. Returns how many were settled. */
    async recover(stackId: string): Promise<Result<number, TransactionError>> {
      const listed = await checkpoints.list(stackId);
      if (!listed.ok) return err(txError('load', 'CHECKPOINT_FAILED', listed.error.message));
      const current = await storage.loadProject(stackId);
      if (!current.ok) return err(txError('load', 'TRANSACTION_FAILED', current.error.message));
      let settled = 0;
      for (const record of listed.value) {
        if (record.status !== 'pending') continue;
        const landed =
          record.expectedUpdatedAt !== undefined &&
          current.value.stack.updatedAt === record.expectedUpdatedAt;
        const stored = await checkpoints.put({
          ...record,
          status: landed ? 'committed' : 'failed',
        });
        if (!stored.ok) return err(txError('load', 'CHECKPOINT_FAILED', stored.error.message));
        settled += 1;
      }
      return ok(settled);
    },
  };
}

export type TransactionManager = ReturnType<typeof createTransactionManager>;
