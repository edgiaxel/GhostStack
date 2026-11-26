import { applyCommand } from '@ghoststack/domain';
import type { Element, ProjectCommand, StackSession } from '@ghoststack/shared-contracts';
import { alignBoxes, distributeBoxes, moveBox, round1 } from './geometry';
import type { Align, Axis, Box, IdBox } from './geometry';
import { markPasted, readClipboard } from './clipboard';

export type ActionResult = { ok: true; elementIds: string[] } | { ok: false; message: string };
const done = (elementIds: string[] = []): ActionResult => ({ ok: true, elementIds });
const fail = (message: string): ActionResult => ({ ok: false, message });

/** One key per gesture: every command sent with it is one undo step. */
export const gestureKey = (name: string): string => `${name}:${crypto.randomUUID()}`;

/**
 * Sends the commands as one undo step. They are applied to a copy first, so either all of them
 * apply or none does.
 */
export function dispatchAll(session: StackSession, commands: ProjectCommand[], key: string): ActionResult {
  if (commands.length === 0) return done();
  let probe = session.getStack();
  const now = new Date().toISOString();
  for (const command of commands) {
    const r = applyCommand(probe, command, now);
    if (!r.ok) return fail(r.error.message);
    probe = r.value;
  }
  for (const command of commands) {
    const r = session.dispatch(command, { coalesceKey: key });
    if (!r.ok) return fail(r.error.message);
  }
  return done();
}

const elementsOf = (session: StackSession, cardId: string, ids: string[]): Element[] => {
  const card = session.getStack().cards[cardId];
  if (!card) return [];
  const wanted = new Set(ids);
  return card.elements.filter((e) => wanted.has(e.elementId));
};
const boxOf = (e: Element): Box => ({
  x: e.layout.x,
  y: e.layout.y,
  width: e.layout.width,
  height: e.layout.height,
});
const idBoxes = (elements: Element[]): IdBox[] => elements.map((e) => ({ id: e.elementId, box: boxOf(e) }));

const layoutCommands = (
  cardId: string,
  positions: Record<string, Partial<Pick<Box, 'x' | 'y'>>>,
): ProjectCommand[] =>
  Object.entries(positions).map(([elementId, layout]) => ({
    type: 'UPDATE_ELEMENT',
    cardId,
    elementId,
    patch: { layout },
  }));

export function moveElements(
  session: StackSession,
  cardId: string,
  ids: string[],
  dx: number,
  dy: number,
  key: string = gestureKey('nudge'),
): ActionResult {
  const positions: Record<string, { x: number; y: number }> = {};
  for (const e of elementsOf(session, cardId, ids)) positions[e.elementId] = moveBox(boxOf(e), dx, dy);
  return dispatchAll(session, layoutCommands(cardId, positions), key);
}

export function deleteElements(session: StackSession, cardId: string, ids: string[]): ActionResult {
  const commands = elementsOf(session, cardId, ids).map<ProjectCommand>((e) => ({
    type: 'DELETE_ELEMENT',
    cardId,
    elementId: e.elementId,
  }));
  return dispatchAll(session, commands, gestureKey('delete'));
}

export function alignElements(
  session: StackSession,
  cardId: string,
  ids: string[],
  mode: Align,
): ActionResult {
  const els = elementsOf(session, cardId, ids);
  if (els.length < 2) return fail('Select at least two elements to align them.');
  return dispatchAll(session, layoutCommands(cardId, alignBoxes(idBoxes(els), mode)), gestureKey('align'));
}

export function distributeElements(
  session: StackSession,
  cardId: string,
  ids: string[],
  axis: Axis,
): ActionResult {
  const els = elementsOf(session, cardId, ids);
  if (els.length < 3) return fail('Select at least three elements to distribute them.');
  return dispatchAll(
    session,
    layoutCommands(cardId, distributeBoxes(idBoxes(els), axis)),
    gestureKey('distribute'),
  );
}

export const COPY_OFFSET = 16;
const freshId = (type: string, taken: Set<string>): string => {
  let id = `${type}-${crypto.randomUUID().slice(0, 8)}`;
  while (taken.has(id)) id = `${type}-${crypto.randomUUID().slice(0, 8)}`;
  taken.add(id);
  return id;
};

/**
 * Copies of `source`, back to front, with new ids, shifted by `offset`, without behaviors (their
 * targets belong to the originals). A name already used on the card gets " copy".
 */
export function cloneElements(
  source: Element[],
  existing: Element[],
  offset: number,
  newId: (type: string, taken: Set<string>) => string = freshId,
): Element[] {
  const taken = new Set(existing.map((e) => e.elementId));
  const names = new Set(existing.map((e) => e.name));
  return [...source]
    .sort((a, b) => a.layout.zIndex - b.layout.zIndex)
    .map((e) => {
      const copy = structuredClone(e);
      copy.elementId = newId(e.type, taken);
      copy.behaviors = [];
      copy.layout = { ...copy.layout, x: round1(copy.layout.x + offset), y: round1(copy.layout.y + offset) };
      if (names.has(copy.name)) copy.name = `${copy.name} copy`;
      return copy;
    });
}

function addCopies(session: StackSession, cardId: string, copies: Element[], key: string): ActionResult {
  const commands = copies.map<ProjectCommand>((element) => ({ type: 'ADD_ELEMENT', cardId, element }));
  const r = dispatchAll(session, commands, key);
  return r.ok ? done(copies.map((c) => c.elementId)) : r;
}

export function duplicateElements(session: StackSession, cardId: string, ids: string[]): ActionResult {
  const card = session.getStack().cards[cardId];
  const source = elementsOf(session, cardId, ids);
  if (!card || source.length === 0) return fail('Select an element to duplicate.');
  return addCopies(
    session,
    cardId,
    cloneElements(source, card.elements, COPY_OFFSET),
    gestureKey('duplicate'),
  );
}

/** Pastes the clipboard onto `cardId`, which may be another card. One undo step. */
export function pasteElements(session: StackSession, cardId: string): ActionResult {
  const clip = readClipboard();
  const stack = session.getStack();
  const card = stack.cards[cardId];
  if (!clip) return fail('The clipboard is empty. Copy an element first.');
  if (!card) return fail('That card no longer exists.');
  if (clip.stackId !== stack.stackId && clip.elements.some((e) => e.assetId !== undefined)) {
    return fail('Images cannot be pasted into another stack. Add the image to this stack first.');
  }
  const copies = cloneElements(clip.elements, card.elements, COPY_OFFSET * (clip.pastes + 1));
  const r = addCopies(session, cardId, copies, gestureKey('paste'));
  if (r.ok) markPasted();
  return r;
}
