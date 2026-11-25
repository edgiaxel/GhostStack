import type { StackSession, ViewportPresetId } from '@ghoststack/shared-contracts';

/**
 * Props every workspace slot component receives from `WorkspacePage` (card editor, inspector,
 * behavior editor, history controls). Slots read the Stack through `useSessionStack(session)` and
 * change it only through `session.dispatch`.
 */
export interface EditorSlotProps {
  session: StackSession;
  /** Card being edited. Always exists in the current Stack. */
  cardId: string;
  /**
   * Selected element on `cardId`, shared by canvas, inspector and behavior editor. May point at an
   * element that undo or delete just removed: treat an unknown id as "nothing selected".
   */
  selectedElementId: string | undefined;
  onSelectElement(elementId: string | undefined): void;
  viewport: ViewportPresetId;
  onViewportChange(viewport: ViewportPresetId): void;
}
