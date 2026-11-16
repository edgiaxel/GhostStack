import { describe, expect, it, vi } from 'vitest';
import { createCard, createStack, defaultDeps } from './factories';
import type { IdPrefix } from './ids';
import { ID_PATTERNS } from './ids';
import { StackSchema } from './schemas';

const FIXED_TIME = '2026-11-15T10:00:00.000Z';
const fixedDeps = () => ({
  clock: () => FIXED_TIME,
  newId: (prefix: IdPrefix) => `${prefix}_fixed`,
});

function stackOf(title: string) {
  const result = createStack(title, fixedDeps());
  if (!result.ok) throw new Error('expected ok');
  return result.value;
}

describe('createStack', () => {
  it('creates a Stack with one initial card', () => {
    const stack = stackOf('My Stack');
    expect(stack.title).toBe('My Stack');
    expect(stack.cardOrder).toEqual([stack.entryCardId]);
    expect(Object.keys(stack.cards)).toEqual([stack.entryCardId]);
    expect(stack.cards[stack.entryCardId]?.title).toBe('Card 1');
    expect(stack.createdAt).toBe(FIXED_TIME);
    expect(stack.updatedAt).toBe(FIXED_TIME);
    expect(stack.viewportDefaults).toEqual({ width: 1280, height: 720 });
  });

  it('trims the title', () => {
    expect(stackOf('  \t Quiz \n').title).toBe('Quiz');
  });

  it('rejects an empty title', () => {
    const result = createStack('', fixedDeps());
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_TITLE', reason: 'empty' } });
    expect(result).not.toHaveProperty('value');
  });

  it('rejects a whitespace-only title', () => {
    const result = createStack(' \t\n\u00a0\u2003 ', fixedDeps());
    expect(result).toMatchObject({ ok: false, error: { reason: 'empty' } });
  });

  it('accepts 100 code points and rejects 101', () => {
    expect(createStack('a'.repeat(100), fixedDeps()).ok).toBe(true);
    const result = createStack('a'.repeat(101), fixedDeps());
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'INVALID_TITLE', reason: 'too-long' },
    });
  });

  it('counts astral characters as one code point', () => {
    const hundred = '😀'.repeat(100);
    expect(createStack(hundred, fixedDeps()).ok).toBe(true);
    expect(createStack('😀'.repeat(101), fixedDeps())).toMatchObject({
      ok: false,
      error: { reason: 'too-long' },
    });
  });

  it('measures length after trimming', () => {
    expect(createStack(` ${'a'.repeat(100)} `, fixedDeps()).ok).toBe(true);
  });

  it('calls the clock once and ids in stack then card order', () => {
    const clock = vi.fn(() => FIXED_TIME);
    const newId = vi.fn((prefix: IdPrefix) => `${prefix}_x`);
    createStack('T', { clock, newId });
    expect(clock).toHaveBeenCalledTimes(1);
    expect(newId.mock.calls.map((call) => call[0])).toEqual(['stk', 'crd']);
  });

  it('calls neither clock nor newId for an invalid title', () => {
    const clock = vi.fn(() => FIXED_TIME);
    const newId = vi.fn((prefix: IdPrefix) => `${prefix}_x`);
    createStack('   ', { clock, newId });
    expect(clock).not.toHaveBeenCalled();
    expect(newId).not.toHaveBeenCalled();
  });

  it('gives deeply equal output for the same injected clock and ids', () => {
    expect(stackOf('Same')).toEqual(stackOf('Same'));
  });

  it('survives a JSON round trip unchanged', () => {
    const stack = stackOf('Round trip');
    expect(JSON.parse(JSON.stringify(stack))).toEqual(stack);
  });

  it('passes StackSchema with default dependencies and generates valid ids', () => {
    const result = createStack('Real deps');
    if (!result.ok) throw new Error('expected ok');
    expect(StackSchema.safeParse(result.value).success).toBe(true);
    expect(result.value.stackId).toMatch(ID_PATTERNS.stk);
    expect(result.value.entryCardId).toMatch(ID_PATTERNS.crd);
  });

  it('exposes default dependencies', () => {
    expect(typeof defaultDeps.clock).toBe('function');
    expect(typeof defaultDeps.newId).toBe('function');
  });
});

describe('createCard', () => {
  it('creates an empty card with a trimmed title and a crd id', () => {
    const result = createCard('  Intro ');
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.title).toBe('Intro');
    expect(result.value.elements).toEqual([]);
    expect(result.value.cardId).toMatch(ID_PATTERNS.crd);
  });

  it('rejects empty and over-long titles', () => {
    expect(createCard(' ')).toMatchObject({ ok: false, error: { reason: 'empty' } });
    expect(createCard('b'.repeat(101))).toMatchObject({ ok: false, error: { reason: 'too-long' } });
  });
});
