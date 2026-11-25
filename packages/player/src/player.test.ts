// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyCommand, createStack } from '@ghoststack/domain';
import { createRuntime } from '@ghoststack/behavior';
import type { Behavior, Element, ProjectCommand, Stack } from '@ghoststack/shared-contracts';
import { mountPlayer } from './index';
import type { PlayerHandle } from './index';
import { assetUrl } from './standalone';

const T = '2026-11-26T00:00:00.000Z';
let handle: PlayerHandle | undefined;
afterEach(() => {
  handle?.destroy();
  handle = undefined;
});

function build(commands: ProjectCommand[]): Stack {
  let s = createStack({ stackId: 's', cardId: 'c1', title: 'S', now: T });
  for (const c of commands) {
    const r = applyCommand(s, c, T);
    if (!r.ok) throw new Error(`${c.type}: ${r.error.message}`);
    s = r.value;
  }
  return s;
}
const el = (
  id: string,
  type: Element['type'],
  properties: Record<string, unknown>,
  extra: Partial<Element> = {},
): ProjectCommand => ({
  type: 'ADD_ELEMENT',
  cardId: 'c1',
  element: {
    elementId: id,
    type,
    name: id,
    properties,
    layout: { x: 10, y: 20, width: 100, height: 40, zIndex: 0 },
    behaviors: [],
    ...extra,
  },
});
const click = (
  id: string,
  actions: Behavior['actions'],
  conditions: Behavior['conditions'] = [],
): Behavior => ({
  behaviorId: id,
  trigger: 'element.click',
  conditions,
  actions,
  enabled: true,
});

function mount(
  stack: Stack,
  resolve: (id: string) => string | undefined = () => undefined,
  onError?: (m: string) => void,
) {
  const container = document.body.appendChild(document.createElement('div'));
  handle = mountPlayer({
    container,
    stack,
    createRuntime,
    resolveAssetUrl: resolve,
    ...(onError ? { onError } : {}),
  });
  return container;
}

describe('mountPlayer', () => {
  it('renders every element type with its content and layout', () => {
    const stack = build([
      el('t', 'text', { text: 'Hello', fontWeight: 'bold', color: '#112233' }),
      el('b', 'button', { text: 'Go' }),
      el('i', 'input', { placeholder: 'Name', defaultValue: 'Ann' }),
      el('s', 'shape', { shape: 'ellipse', fill: '#ff0000' }),
      el('l', 'line', { flipY: true }),
      el('m', 'image', { alt: 'Pic' }),
    ]);
    const c = mount(stack);
    expect(c.textContent).toContain('Hello');
    expect(c.querySelector('button')?.textContent).toBe('Go');
    expect((c.querySelector('input') as HTMLInputElement).value).toBe('Ann');
    expect(c.querySelector('svg line')).toBeTruthy();
    expect(c.querySelector('[data-gs-fallback]')?.textContent).toBe('Image file missing: Pic');
    const first = c.querySelector('[data-gs-stage]')!.firstElementChild as HTMLElement;
    expect(first.style.left).toBe('10px');
    expect(first.style.top).toBe('20px');
  });

  it('keeps text as text and drops unsafe colors', () => {
    const stack = build([el('t', 'text', { text: '<img src=x onerror=alert(1)>' })]);
    const c = mount(stack);
    expect(c.querySelector('img')).toBeNull();
    expect(c.textContent).toContain('<img src=x onerror=alert(1)>');
    const hostile = {
      ...stack,
      cards: {
        c1: {
          ...stack.cards['c1']!,
          elements: [
            {
              ...stack.cards['c1']!.elements[0]!,
              properties: { text: 'x', color: 'red;background:url(//evil)' },
            },
          ],
        },
      },
    } as Stack;
    handle?.destroy();
    const c2 = mount(hostile);
    expect((c2.querySelector('[data-gs-stage] div div') as HTMLElement).style.cssText).not.toContain('evil');
  });

  it('runs behaviors through the shared runtime: clicks, state, branching and card changes', () => {
    const stack = build([
      { type: 'UPDATE_STATE_SCHEMA', stateSchema: { n: { type: 'number', initial: 0 } } },
      { type: 'ADD_CARD', cardId: 'c2', title: 'Two' },
      el('l', 'text', { text: 'zero' }),
      el(
        'b',
        'button',
        { text: 'Add' },
        {
          behaviors: [
            click('inc', [
              {
                type: 'setState',
                key: 'n',
                value: {
                  kind: 'binary',
                  op: '+',
                  left: { kind: 'state', key: 'n' },
                  right: { kind: 'literal', value: 1 },
                },
              },
            ]),
            click('show', [{ type: 'setText', elementId: 'l', value: { kind: 'state', key: 'n' } }]),
            click(
              'go',
              [{ type: 'navigate', cardId: 'c2' }],
              [
                {
                  kind: 'binary',
                  op: '>=',
                  left: { kind: 'state', key: 'n' },
                  right: { kind: 'literal', value: 2 },
                },
              ],
            ),
          ],
        },
      ),
      {
        type: 'ADD_ELEMENT',
        cardId: 'c2',
        element: {
          elementId: 'z',
          type: 'text',
          name: 'z',
          properties: { text: 'Second card' },
          layout: { x: 0, y: 0, width: 50, height: 20, zIndex: 0 },
          behaviors: [],
        },
      },
    ]);
    const c = mount(stack);
    const button = c.querySelector('button') as HTMLButtonElement;
    button.click();
    expect(c.textContent).toContain('1');
    button.click();
    expect(c.textContent).toContain('Second card');
    expect(c.querySelector('button')).toBeNull();
    handle!.restart();
    expect(c.textContent).toContain('zero');
  });

  it('writes typed input to state without losing focus and reports runtime issues', () => {
    const stack = build([
      { type: 'UPDATE_STATE_SCHEMA', stateSchema: { age: { type: 'number', initial: 0 } } },
      el('l', 'text', { text: '-' }),
      el(
        'i',
        'input',
        { stateKey: 'age' },
        {
          behaviors: [
            {
              behaviorId: 'c',
              trigger: 'element.change',
              conditions: [],
              actions: [{ type: 'setText', elementId: 'l', value: { kind: 'state', key: 'age' } }],
              enabled: true,
            },
          ],
        },
      ),
    ]);
    const onError = vi.fn();
    const c = mount(stack, () => undefined, onError);
    const input = c.querySelector('input') as HTMLInputElement;
    input.value = '42';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(c.textContent).toContain('42');
    expect(c.querySelector('input')).toBe(input);
    input.value = 'abc';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('not a valid number'));
  });

  it('uses the asset URL when present and the fallback when the file fails to load', () => {
    const stack = build([
      {
        type: 'REGISTER_ASSET',
        asset: {
          assetId: 'a1',
          relativePath: 'a1-dot.png',
          mimeType: 'image/png',
          byteSize: 1,
          checksum: 'x',
        },
      },
      el('m', 'image', { alt: 'Dot' }, { assetId: 'a1' }),
    ]);
    const c = mount(stack, (id) => (id === 'a1' ? 'blob:fake' : undefined));
    const img = c.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('blob:fake');
    img.dispatchEvent(new Event('error'));
    expect(c.querySelector('[data-gs-fallback]')).toBeTruthy();
  });

  it('relayouts when the stage size changes, following anchors and font scale', () => {
    const stack = build([
      el(
        't',
        'text',
        { text: 'A', fontSize: 20 },
        {
          layout: {
            x: 1000,
            y: 500,
            width: 200,
            height: 100,
            zIndex: 0,
            anchor: 'bottom-right',
            scaleMode: 'scale',
          },
        },
      ),
    ]);
    const c = mount(stack);
    const stage = c.querySelector('[data-gs-stage]') as HTMLElement;
    Object.defineProperty(stage, 'clientWidth', { configurable: true, value: 640 });
    Object.defineProperty(stage, 'clientHeight', { configurable: true, value: 360 });
    window.dispatchEvent(new Event('resize'));
    const node = stage.firstElementChild as HTMLElement;
    expect(node.style.width).toBe('100px');
    expect(node.style.left).toBe(`${640 - (1280 - 1200) * 0.5 - 100}px`);
    expect((node.firstElementChild as HTMLElement).style.fontSize).toBe('10px');
  });

  it('builds relative, encoded asset URLs for the standalone page', () => {
    expect(assetUrl('a b/ç#.png')).toBe('assets/a%20b/%C3%A7%23.png');
  });
});
