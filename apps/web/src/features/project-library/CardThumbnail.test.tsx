// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { createStack } from '@ghoststack/domain';
import { CardThumbnail } from './CardThumbnail';

const base = () => createStack({ stackId: 's', cardId: 'c', title: 'T', now: '2026-01-01T00:00:00.000Z' });

afterEach(cleanup);

describe('CardThumbnail', () => {
  it('renders a blank frame for an unloaded Stack', () => {
    const { container } = render(<CardThumbnail stack={undefined} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('draws elements, shows only the first text line, and shows images without bytes', () => {
    const stack = base();
    stack.cards.c!.elements = [
      {
        elementId: 'e1',
        type: 'text',
        name: 'T',
        properties: { text: 'first\nsecond' },
        layout: { x: 0, y: 0, width: 100, height: 30, zIndex: 0 },
        behaviors: [],
      },
      {
        elementId: 'e2',
        type: 'image',
        name: 'I',
        properties: { alt: '' },
        assetId: 'missing',
        layout: { x: 0, y: 40, width: 100, height: 60, zIndex: 1 },
        behaviors: [],
      },
    ];
    const { container } = render(<CardThumbnail stack={stack} />);
    expect(container.textContent).toBe('first');
    expect(container.querySelectorAll('rect').length).toBe(2);
  });

  it('does not throw on unusable colors, NaN layout or a missing card', () => {
    const stack = base();
    stack.cards.c!.elements = [
      {
        elementId: 'e1',
        type: 'shape',
        name: 'S',
        properties: { shape: 'rect', fill: 'url(javascript:1)' },
        layout: { x: Number.NaN, y: 0, width: 10, height: 10, zIndex: 0 },
        behaviors: [],
      },
    ];
    expect(() => render(<CardThumbnail stack={stack} />)).not.toThrow();
    expect(() => render(<CardThumbnail stack={stack} cardId="nope" />)).not.toThrow();
  });
});
