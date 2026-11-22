export { AI_ERROR_CODES } from './errors';
export type { AIErrorCode, AIIssue, IssuePath } from './errors';
export {
  AIPlanSchema,
  AI_PLAN_VERSION,
  MAX_PLAN_COMMANDS,
  NewElementSchema,
  PatchCommandSchema,
  parseAIPlan,
} from './plan';
export type { AIPlan, NewElement, PatchCommand, PlanParseResult } from './plan';
export { applyPlan } from './patch';
export type { ApplyOptions, CommandReport, CreatedIds, PatchFailure, PatchOutcome } from './patch';
export {
  createMemoryCheckpointStore,
  createRepositoryCheckpointStore,
  parseCheckpointRecord,
} from './checkpoints';
export type { CheckpointRecord, CheckpointStatus, CheckpointStore } from './checkpoints';
export { CrashSignal, approvePlan, createTransactionManager } from './transaction';
export type {
  ApprovedPlan,
  OperationReport,
  TransactionDeps,
  TransactionError,
  TransactionHooks,
  TransactionManager,
  TransactionStage,
} from './transaction';
export { createDemoAdapter } from './demo';
export {
  MAX_PROVIDER_TEXT_CHARS,
  buildProjectContext,
  parsePlanText,
  requestPlan,
} from './provider';
export type {
  AIProviderAdapter,
  ConnectionInfo,
  GenerateOptions,
  PrivacyPolicy,
  ProjectContext,
  ProviderCapabilities,
} from './provider';
export { reviewPlan } from './review';
export type { PlanReview } from './review';
