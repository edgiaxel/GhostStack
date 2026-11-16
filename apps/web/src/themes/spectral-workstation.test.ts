import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import themeCss from './spectral-workstation.css?raw';

function readProperty(name: string): string {
  const match = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(themeCss);
  if (match === null) {
    throw new Error(`Custom property ${name} not found in theme CSS.`);
  }
  return match[1]!;
}

describe('contrastRatio', () => {
  it('returns 21 for black on white in either order', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });

  it('returns 1 for identical colors', () => {
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('matches the WCAG reference for #777777 on white', () => {
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('rejects malformed colors', () => {
    expect(() => contrastRatio('red', '#ffffff')).toThrow();
  });
});

describe('Spectral Workstation theme', () => {
  it('defines the Requirement 14.1 values', () => {
    expect(readProperty('--gs-color-base').toLowerCase()).toBe('#111017');
    expect(readProperty('--gs-color-panel').toLowerCase()).toBe('#191724');
    expect(readProperty('--gs-color-text').toLowerCase()).toBe('#f4f3f8');
    expect(readProperty('--gs-color-accent-primary').toLowerCase()).toBe('#ff6b2b');
    expect(readProperty('--gs-color-accent-secondary').toLowerCase()).toBe('#9d6bff');
  });

  it('keeps text contrast on base and panel at 4.5:1 or higher', () => {
    const text = readProperty('--gs-color-text');
    expect(contrastRatio(text, readProperty('--gs-color-base'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(text, readProperty('--gs-color-panel'))).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the focus ring at 3:1 or higher against base and panel', () => {
    const ring = readProperty('--gs-color-accent-primary');
    expect(contrastRatio(ring, readProperty('--gs-color-base'))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(ring, readProperty('--gs-color-panel'))).toBeGreaterThanOrEqual(3);
  });

  it('scopes every selector to .gs-editor', () => {
    const withoutComments = themeCss.replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = [...withoutComments.matchAll(/([^{}]+)\{/g)].flatMap((m) =>
      m[1]!.split(',').map((s) => s.trim()),
    );
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      expect(selector.startsWith('.gs-editor')).toBe(true);
    }
  });

  it('names no other theme', () => {
    expect(themeCss).not.toContain('Studio Paper');
    expect(themeCss).not.toContain('Midnight Terminal');
  });

  it('contains no external URL', () => {
    expect(themeCss).not.toMatch(/https?:\/\//i);
  });

  it('declares a :focus-visible rule', () => {
    expect(themeCss).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid/);
  });

  it('does not hide horizontal overflow', () => {
    expect(themeCss).not.toMatch(/overflow-x\s*:\s*hidden/);
  });

  it('applies Inter to UI text and JetBrains Mono to code', () => {
    expect(themeCss).toMatch(/--gs-font-ui:\s*'Inter'/);
    expect(themeCss).toMatch(/--gs-font-mono:\s*'JetBrains Mono'/);
  });
});
