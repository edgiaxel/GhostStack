import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { applyCommand, createStack } from '@ghoststack/domain';
import type { ProjectCommand, Stack } from '@ghoststack/shared-contracts';
import { exportWebApp, jsonForScript, sha256Hex } from './index';

const T = '2026-11-26T00:00:00.000Z';
const bytes = new Uint8Array([1, 2, 3]);

function build(title: string, commands: ProjectCommand[] = []): Stack {
  let s = { ...createStack({ stackId: 's', cardId: 'c1', title, now: T }) };
  for (const c of commands) {
    const r = applyCommand(s, c, T);
    if (!r.ok) throw new Error(r.error.message);
    s = r.value;
  }
  return s;
}

const withAssets = (title = 'Quiz'): Stack =>
  build(title, [
    {
      type: 'REGISTER_ASSET',
      asset: {
        assetId: 'a1',
        relativePath: 'a1-dot.png',
        mimeType: 'image/png',
        byteSize: 3,
        checksum: sha256Hex(bytes),
      },
    },
    {
      type: 'REGISTER_ASSET',
      asset: {
        assetId: 'a2',
        relativePath: 'a2-gone.png',
        mimeType: 'image/png',
        byteSize: 3,
        checksum: 'x',
      },
    },
  ]);

describe('exportWebApp', () => {
  it('produces a standalone zip with the page, player and available assets', () => {
    const r = exportWebApp(withAssets(), { a1: bytes }, 'window.GhostStackPlayer={}');
    if (!r.ok) throw new Error(r.error.message);
    const files = unzipSync(r.value.bytes);
    expect(Object.keys(files).sort()).toEqual(['assets/a1-dot.png', 'index.html', 'player.js']);
    expect(strFromU8(files['player.js']!)).toBe('window.GhostStackPlayer={}');
    expect(r.value.missingAssets).toEqual(['a2-gone.png']);
    const html = strFromU8(files['index.html']!);
    expect(html).toContain('<script src="player.js"></script>');
    expect(html).toContain('#app{width:100vw;height:100vh}');
    expect(html).toContain('background:#e5e7eb');
    const json = /<script type="application\/json" id="gs-stack">(.*)<\/script>/.exec(html)![1]!;
    expect(JSON.parse(json)).toEqual(withAssets());
  });

  it('contains no editor, storage or secret references', () => {
    const r = exportWebApp(withAssets(), { a1: bytes }, 'x');
    if (!r.ok) throw new Error('export');
    const html = strFromU8(unzipSync(r.value.bytes)['index.html']!);
    for (const word of ['indexedDB', 'ghoststack', '.kiro', 'apiKey', 'localhost'])
      expect(html.toLowerCase()).not.toContain(word.toLowerCase());
  });

  it('escapes hostile titles and text so the page cannot be broken out of', () => {
    const hostile = '</script><script>alert(1)</script>';
    const stack = build(hostile, [
      {
        type: 'ADD_ELEMENT',
        cardId: 'c1',
        element: {
          elementId: 'e',
          type: 'text',
          name: 'e',
          properties: { text: hostile },
          layout: { x: 0, y: 0, width: 1, height: 1, zIndex: 0 },
          behaviors: [],
        },
      },
    ]);
    const r = exportWebApp(stack, {}, 'x');
    if (!r.ok) throw new Error('export');
    const html = strFromU8(unzipSync(r.value.bytes)['index.html']!);
    expect(html.match(/<script/g)).toHaveLength(2);
    expect(html).toContain('<title>&lt;/script&gt;');
    expect(jsonForScript({ a: '<\u2028' })).toBe('{"a":"\\u003c\\u2028"}');
  });

  it('rejects inconsistent Stacks, unsafe asset paths and an empty player', () => {
    const bad: Stack = { ...build('x'), entryCardId: 'ghost' };
    expect(exportWebApp(bad, {}, 'x')).toMatchObject({ ok: false, error: { code: 'PROJECT_EXPORT_FAILED' } });
    expect(exportWebApp(build('x'), {}, '  ').ok).toBe(false);
    const unsafe = {
      ...build('x'),
      assetRegistry: {
        a: { assetId: 'a', relativePath: '../evil', mimeType: 'x', byteSize: 1, checksum: 'x' },
      },
    } as Stack;
    expect(exportWebApp(unsafe, {}, 'x').ok).toBe(false);
  });
});
