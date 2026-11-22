import { ElementSchema, createCard, defaultDeps, err, ok } from '@ghoststack/domain';
import type { Card, Element, FactoryDeps, Project, Result } from '@ghoststack/domain';
import type { AIIssue } from './errors';
import type { AIPlan, PatchCommand } from './plan';

export interface CreatedIds {
  /** Plan ref to the generated card identifier. */
  readonly cards: Readonly<Record<string, string>>;
  /** Plan ref to the generated element identifier. */
  readonly elements: Readonly<Record<string, string>>;
}

export interface CommandReport {
  readonly index: number;
  readonly command: PatchCommand['command'];
  readonly summary: string;
}

export interface PatchOutcome {
  readonly project: Project;
  readonly created: CreatedIds;
  readonly reports: readonly CommandReport[];
}

export interface PatchFailure extends AIIssue {
  /** Index of the command that failed. The input project is never changed. */
  readonly commandIndex: number;
}

export interface ApplyOptions {
  readonly deps?: Partial<FactoryDeps>;
  /** Called before each command. A throw aborts the whole application (used for fault injection). */
  readonly beforeCommand?: (index: number) => void;
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const own = (object: object, key: string): boolean => Object.hasOwn(object, key);

class Abort extends Error {
  constructor(readonly failure: PatchFailure) {
    super(failure.message);
  }
}

const fail = (
  commandIndex: number,
  code: PatchFailure['code'],
  message: string,
  field?: string,
): never => {
  throw new Abort({
    code,
    message,
    path: field === undefined ? ['commands', commandIndex] : ['commands', commandIndex, field],
    commandIndex,
  });
};

/**
 * Applies a validated plan to a deep copy. Pure with respect to the input: the original project is
 * never mutated, and any failure discards the copy so nothing is partially applied.
 */
export function applyPlan(
  project: Project,
  plan: AIPlan,
  options: ApplyOptions = {},
): Result<PatchOutcome, PatchFailure> {
  const deps: FactoryDeps = { ...defaultDeps, ...options.deps };
  const draft: Project = structuredClone(project);
  const cardRefs: Record<string, string> = Object.create(null) as Record<string, string>;
  const elementRefs: Record<string, string> = Object.create(null) as Record<string, string>;
  const reports: CommandReport[] = [];

  const resolveCard = (index: number, target: string): Card => {
    const id = own(cardRefs, target) ? (cardRefs[target] as string) : target;
    if (!own(draft.cards, id))
      fail(index, 'INVALID_PATCH_COMMAND', 'Target card not found.', 'cardId');
    return draft.cards[id] as Card;
  };
  const resolveElementIndex = (index: number, card: Card, target: string): number => {
    const id = own(elementRefs, target) ? (elementRefs[target] as string) : target;
    const at = card.elements.findIndex((element) => element.elementId === id);
    if (at < 0) fail(index, 'INVALID_PATCH_COMMAND', 'Target element not found.', 'elementId');
    return at;
  };

  try {
    plan.commands.forEach((command, index) => {
      options.beforeCommand?.(index);
      let summary: string;
      switch (command.command) {
        case 'ADD_CARD': {
          const created = createCard(command.title, deps);
          if (!created.ok) fail(index, 'INVALID_PATCH_COMMAND', created.error.message, 'title');
          const card = (created as { value: Card }).value;
          draft.cards[card.cardId] = card;
          draft.cardOrder.push(card.cardId);
          if (command.ref !== undefined) cardRefs[command.ref] = card.cardId;
          summary = 'Added a card.';
          break;
        }
        case 'DELETE_CARD': {
          const card = resolveCard(index, command.cardId);
          if (draft.cardOrder.length <= 1) {
            fail(index, 'INVALID_PATCH_COMMAND', 'The last card cannot be deleted.', 'cardId');
          }
          delete draft.cards[card.cardId];
          draft.cardOrder = draft.cardOrder.filter((id) => id !== card.cardId);
          if (draft.entryCardId === card.cardId) {
            draft.entryCardId = draft.cardOrder[0] as string;
          }
          summary = 'Deleted a card.';
          break;
        }
        case 'ADD_ELEMENT': {
          const card = resolveCard(index, command.cardId);
          const elementId = deps.newId('elm');
          const parsed = ElementSchema.safeParse({ ...command.element, elementId });
          if (!parsed.success) fail(index, 'INVALID_PATCH_COMMAND', 'Invalid element.', 'element');
          card.elements.push(parsed.data as Element);
          if (command.ref !== undefined) elementRefs[command.ref] = elementId;
          summary = `Added a ${command.element.type} element.`;
          break;
        }
        case 'UPDATE_ELEMENT': {
          const card = resolveCard(index, command.cardId);
          const at = resolveElementIndex(index, card, command.elementId);
          const current = card.elements[at] as Element;
          const merged = {
            ...current,
            name: command.changes.name ?? current.name,
            layout: { ...current.layout, ...command.changes.layout },
            properties: { ...current.properties, ...command.changes.properties },
          };
          const parsed = ElementSchema.safeParse(merged);
          if (!parsed.success)
            fail(index, 'INVALID_PATCH_COMMAND', 'Invalid element change.', 'changes');
          card.elements[at] = parsed.data as Element;
          summary = 'Updated an element.';
          break;
        }
        case 'DELETE_ELEMENT': {
          const card = resolveCard(index, command.cardId);
          const at = resolveElementIndex(index, card, command.elementId);
          card.elements.splice(at, 1);
          summary = 'Deleted an element.';
          break;
        }
        case 'UPDATE_STATE_SCHEMA': {
          const removes = command.remove ?? [];
          const sets = Object.entries(command.set ?? {});
          for (const key of [...removes, ...sets.map(([k]) => k)]) {
            if (FORBIDDEN_KEYS.has(key))
              fail(index, 'INVALID_PATCH_COMMAND', 'Reserved key.', 'set');
          }
          for (const key of removes) {
            if (!own(draft.stateSchema, key)) {
              fail(index, 'INVALID_PATCH_COMMAND', 'State key not found.', 'remove');
            }
            if (command.set !== undefined && own(command.set, key)) {
              fail(index, 'INVALID_PATCH_COMMAND', 'State key is both set and removed.', 'remove');
            }
            delete draft.stateSchema[key];
          }
          for (const [key, entry] of sets) draft.stateSchema[key] = entry;
          summary = 'Updated the state schema.';
          break;
        }
        case 'UPDATE_BEHAVIOR':
          return fail(
            index,
            'UNSUPPORTED_COMMAND',
            'Behavior changes are not supported before the behavior runtime exists.',
          );
      }
      reports.push({ index, command: command.command, summary });
    });
  } catch (error) {
    if (error instanceof Abort) return err(error.failure);
    // Hook or unexpected failure: still discard the copy and report it as a failed operation.
    return err({
      code: 'TRANSACTION_FAILED',
      message: 'Applying the plan failed unexpectedly.',
      path: ['commands'],
      commandIndex: -1,
    });
  }

  draft.updatedAt = deps.clock();
  return ok({
    project: draft,
    created: { cards: { ...cardRefs }, elements: { ...elementRefs } },
    reports,
  });
}
