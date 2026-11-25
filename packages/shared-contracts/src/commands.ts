import type { Result, GhostError } from './errors';
import type { Behavior, StateVariable } from './behavior';
import type { Asset, Element, Layout, Stack } from './project';

/**
 * Domain command contract (ARCHITECTURE 7.1 and 7.5). Every Stack change goes through
 * `applyCommand` in `@ghoststack/domain`.
 */
export type ProjectCommand =
  | { type: 'RENAME_STACK'; title: string }
  | { type: 'ADD_CARD'; cardId: string; title: string; index?: number }
  | { type: 'RENAME_CARD'; cardId: string; title: string }
  | { type: 'DUPLICATE_CARD'; cardId: string; newCardId: string }
  | { type: 'REORDER_CARDS'; cardOrder: string[] }
  /** Also removes `navigate` actions that target the deleted Card. Use `findCardReferences` to warn first. */
  | { type: 'DELETE_CARD'; cardId: string }
  /** `element.layout.zIndex` is ignored: the new element is placed on top. */
  | { type: 'ADD_ELEMENT'; cardId: string; element: Element }
  | { type: 'UPDATE_ELEMENT'; cardId: string; elementId: string; patch: ElementPatch }
  /** Also removes behaviors and actions that target the element. */
  | { type: 'DELETE_ELEMENT'; cardId: string; elementId: string }
  /** Renumbers zIndex to 0..n-1 after moving the element. */
  | { type: 'REORDER_ELEMENT'; cardId: string; elementId: string; placement: ZPlacement }
  /** Replaces the whole behavior list of an Element (when `elementId` is set) or of the Card. */
  | { type: 'UPDATE_BEHAVIOR'; cardId: string; elementId?: string; behaviors: Behavior[] }
  /** Replaces the schema. Rejected while a behavior or input still references a removed key. */
  | { type: 'UPDATE_STATE_SCHEMA'; stateSchema: Record<string, StateVariable> }
  /** Registers metadata only. The bytes go through `AssetRepository.put`. */
  | { type: 'REGISTER_ASSET'; asset: Asset };

export type ZPlacement = 'front' | 'back' | 'forward' | 'backward';

/**
 * `properties` is shallow-merged into the existing properties. A property set to `null` is removed.
 * `assetId: null` clears the reference.
 */
export interface ElementPatch {
  name?: string;
  properties?: Record<string, unknown>;
  layout?: Partial<Omit<Layout, 'zIndex'>>;
  assetId?: string | null;
}

/** Signature `@ghoststack/domain` must export as `applyCommand`. `now` is ISO 8601. */
export type ApplyCommand = (stack: Stack, command: ProjectCommand, now: string) => Result<Stack, GhostError>;
