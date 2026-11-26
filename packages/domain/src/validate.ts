import { StackSchema, err, ok, validateElementProperties } from '@ghoststack/shared-contracts';
import type { GhostError, Result, Stack } from '@ghoststack/shared-contracts';
import { walkActions, walkBehaviorExprs } from './behavior-refs';
import type { BehaviorOwner } from './behavior-refs';

const fail = (message: string): Result<never, GhostError> =>
  err({ code: 'PROJECT_VALIDATION_FAILED', message });

/** Cross-entity invariants the schema cannot express. Returns the first violation, if any. */
function checkIntegrity(stack: Stack): string | undefined {
  const ids = Object.keys(stack.cards);
  if (stack.cardOrder.length !== ids.length || stack.cardOrder.some((id) => !(id in stack.cards))) {
    return 'cardOrder must list every card exactly once';
  }
  if (new Set(stack.cardOrder).size !== stack.cardOrder.length) return 'cardOrder contains duplicates';
  if (!(stack.entryCardId in stack.cards)) return 'entryCardId does not reference a card';
  for (const [id, card] of Object.entries(stack.cards)) {
    if (card.cardId !== id) return `Card key ${id} does not match its cardId`;
  }
  for (const [key, asset] of Object.entries(stack.assetRegistry)) {
    if (asset.assetId !== key) return `Asset key ${key} does not match its assetId`;
  }

  const owners: BehaviorOwner[] = [];
  for (const card of Object.values(stack.cards)) {
    const elementIds = new Set<string>();
    for (const el of card.elements) {
      if (elementIds.has(el.elementId)) return `Duplicate element id ${el.elementId} on card ${card.cardId}`;
      elementIds.add(el.elementId);
      const props = validateElementProperties(el.type, el.properties);
      if (!props.ok) return `Element ${el.elementId}: ${props.message}`;
      if (el.assetId !== undefined) {
        if (el.type !== 'image') return `Element ${el.elementId}: only image elements may reference an asset`;
        if (!(el.assetId in stack.assetRegistry)) {
          return `Element ${el.elementId} references unregistered asset ${el.assetId}`;
        }
      }
      const stateKey = el.type === 'input' ? (el.properties['stateKey'] as string | undefined) : undefined;
      if (stateKey !== undefined && !(stateKey in stack.stateSchema)) {
        return `Input ${el.elementId} is bound to unknown state variable ${stateKey}`;
      }
      if (stateKey !== undefined && stack.stateSchema[stateKey]?.type === 'list') {
        return `Input ${el.elementId} cannot be bound to the list variable ${stateKey}`;
      }
      for (const behavior of el.behaviors) owners.push({ card, elementId: el.elementId, behavior });
    }
    for (const behavior of card.behaviors) owners.push({ card, behavior });
  }

  const seen = new Set<string>();
  for (const { card, elementId, behavior } of owners) {
    const owner = `${card.cardId}/${elementId ?? '(card)'}`;
    const uniq = `${owner}#${behavior.behaviorId}`;
    if (seen.has(uniq)) return `Duplicate behavior id ${behavior.behaviorId} on ${owner}`;
    seen.add(uniq);

    if (elementId === undefined && behavior.trigger !== 'card.enter') {
      return `Behavior ${behavior.behaviorId}: a card only supports the card.enter trigger`;
    }
    if (elementId !== undefined) {
      if (behavior.trigger === 'card.enter') {
        return `Behavior ${behavior.behaviorId}: card.enter belongs on a card, not an element`;
      }
      const type = card.elements.find((e) => e.elementId === elementId)?.type;
      if (behavior.trigger === 'element.change' && type !== 'input') {
        return `Behavior ${behavior.behaviorId}: element.change requires an input element`;
      }
    }

    let problem: string | undefined;
    walkActions(behavior.actions, (a) => {
      if (problem) return;
      if (a.type === 'navigate' && !(a.cardId in stack.cards)) {
        problem = `Behavior ${behavior.behaviorId} navigates to unknown card ${a.cardId}`;
      }
      if (a.type === 'setState' && !(a.key in stack.stateSchema)) {
        problem = `Behavior ${behavior.behaviorId} sets unknown state variable ${a.key}`;
      }
      if (a.type === 'setState' && stack.stateSchema[a.key]?.type === 'list') {
        problem = `Behavior ${behavior.behaviorId} sets list ${a.key} with set. Use a list action`;
      }
      if (
        (a.type === 'listAdd' || a.type === 'listRemove' || a.type === 'listSet' || a.type === 'listClear') &&
        stack.stateSchema[a.key]?.type !== 'list'
      ) {
        problem = `Behavior ${behavior.behaviorId} uses ${a.key}, which is not a list variable`;
      }
      if (
        (a.type === 'setText' || a.type === 'show' || a.type === 'hide') &&
        !card.elements.some((e) => e.elementId === a.elementId)
      ) {
        problem = `Behavior ${behavior.behaviorId} targets unknown element ${a.elementId}`;
      }
    });
    walkBehaviorExprs(behavior, (e) => {
      if (problem) return;
      if (e.kind === 'state' && !(e.key in stack.stateSchema)) {
        problem = `Behavior ${behavior.behaviorId} reads unknown state variable ${e.key}`;
      } else if (e.kind === 'state' && stack.stateSchema[e.key]?.type === 'list') {
        problem = `Behavior ${behavior.behaviorId} reads list ${e.key} as a value. Use length, item or join`;
      } else if (
        (e.kind === 'listLength' || e.kind === 'listItem' || e.kind === 'listJoin') &&
        stack.stateSchema[e.key]?.type !== 'list'
      ) {
        problem = `Behavior ${behavior.behaviorId} uses ${e.key}, which is not a list variable`;
      }
    });
    if (problem) return problem;
  }
  return undefined;
}

export function validateStack(value: unknown): Result<Stack, GhostError> {
  const parsed = StackSchema.safeParse(value);
  if (!parsed.success) return fail(parsed.error.message);
  const problem = checkIntegrity(parsed.data);
  return problem ? fail(problem) : ok(parsed.data);
}
