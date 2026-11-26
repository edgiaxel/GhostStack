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

  it('matches Ctrl+S and ignores other Ctrl combinations', () => {
    expect(key('s', { ctrlKey: true })).toBe('save');
    expect(key('z', { ctrlKey: true })).toBeUndefined();
    expect(key('v', { ctrlKey: true })).toBeUndefined();
  });

  it('accepts = as zoom in and shifted ? as help', () => {
    expect(key('=')).toBe('zoom-in');
    expect(key('?', { shiftKey: true })).toBe('help');
  });
});
