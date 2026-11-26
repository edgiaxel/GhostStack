import { describe, expect, it } from 'vitest';
import { SHORTCUTS, matchShortcut } from './shortcuts';

const key = (k: string, extra: Partial<Parameters<typeof matchShortcut>[0]> = {}) =>
  matchShortcut({ key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...extra });

describe('shortcuts', () => {
  it('lists each key combination once', () => {
    const keys = SHORTCUTS.map((s) => s.keys);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(SHORTCUTS.map((s) => s.id)).size).toBe(SHORTCUTS.length);
  });

  it('matches every shell shortcut that is a single key', () => {
    for (const s of SHORTCUTS.filter((x) => x.handledBy === 'shell' && !x.keys.includes('Ctrl'))) {
      const k = s.keys === 'Esc' ? 'Escape' : s.keys;
      expect(key(k), s.label).toBe(s.id);
    }
  });

  it('matches the Ctrl shortcuts and leaves undo, redo and unknown combinations alone', () => {
    expect(key('s', { ctrlKey: true })).toBe('save');
    expect(key('c', { ctrlKey: true })).toBe('copy');
    expect(key('v', { metaKey: true })).toBe('paste');
    expect(key('d', { ctrlKey: true })).toBe('duplicate');
    expect(key('a', { ctrlKey: true })).toBe('select-all');
    expect(key('z', { ctrlKey: true })).toBeUndefined();
    expect(key('Z', { ctrlKey: true, shiftKey: true })).toBeUndefined();
    expect(key('c', { ctrlKey: true, shiftKey: true })).toBeUndefined();
  });

  it('accepts = as zoom in and shifted ? as help', () => {
    expect(key('=')).toBe('zoom-in');
    expect(key('?', { shiftKey: true })).toBe('help');
  });
});
