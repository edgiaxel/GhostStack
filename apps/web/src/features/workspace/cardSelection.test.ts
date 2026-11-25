import { describe, expect, it } from 'vitest';
import { moveCardInOrder, nextSelectionAfterDelete, resolveSelectedCardId } from './cardSelection';

const card = { cardId: '', title: '', elements: [], behaviors: [] };
const stack = {
  entryCardId: 'a',
  cardOrder: ['a', 'b', 'c'],
  cards: { a: card, b: card, c: card },
};

describe('resolveSelectedCardId', () => {
  it('uses the requested card when it exists', () => {
    expect(resolveSelectedCardId(stack, 'b')).toBe('b');
  });
  it('falls back to the entry card for a missing or absent id', () => {
    expect(resolveSelectedCardId(stack, 'gone')).toBe('a');
    expect(resolveSelectedCardId(stack, undefined)).toBe('a');
  });
  it('falls back to the first card when the entry card is invalid', () => {
    expect(resolveSelectedCardId({ ...stack, entryCardId: 'zzz' }, 'gone')).toBe('a');
  });
  it('returns undefined for a stack with no cards', () => {
    expect(resolveSelectedCardId({ entryCardId: 'a', cardOrder: [], cards: {} }, undefined)).toBeUndefined();
  });
});

describe('moveCardInOrder', () => {
  it('moves up and down without mutating the input', () => {
    const order = ['a', 'b', 'c'];
    expect(moveCardInOrder(order, 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveCardInOrder(order, 'b', 1)).toEqual(['a', 'c', 'b']);
    expect(order).toEqual(['a', 'b', 'c']);
  });
  it('returns undefined at the edges and for unknown ids', () => {
    expect(moveCardInOrder(['a', 'b'], 'a', -1)).toBeUndefined();
    expect(moveCardInOrder(['a', 'b'], 'b', 1)).toBeUndefined();
    expect(moveCardInOrder(['a', 'b'], 'x', 1)).toBeUndefined();
  });
});

describe('nextSelectionAfterDelete', () => {
  it('prefers the next neighbour, then the previous', () => {
    expect(nextSelectionAfterDelete(['a', 'b', 'c'], 'b')).toBe('c');
    expect(nextSelectionAfterDelete(['a', 'b', 'c'], 'c')).toBe('b');
    expect(nextSelectionAfterDelete(['a'], 'a')).toBeUndefined();
  });
});
