import { act } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Root } from 'react-dom/client';
import { createTestServices } from '../test/fakes';
import { startApp } from './startApp';

describe('startApp', () => {
  let root: Root | undefined;

  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    document.body.replaceChildren();
  });

  it('renders the library with preferences applied after the first render', () => {
    const container = document.createElement('div');
    document.body.append(container);
    act(() => {
      root = startApp(container, createTestServices());
    });
    const editor = container.querySelector<HTMLElement>('.gs-editor');
    expect(editor?.style.getPropertyValue('--gs-nav-width')).toBe('240px');
    expect(container).toHaveTextContent('Project Library');
  });
});
