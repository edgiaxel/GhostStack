import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { applyCommand, createStack } from '@ghoststack/domain';
import { ELEMENT_DEFAULTS } from '@ghoststack/shared-contracts';
import type { ProjectCommand, Stack } from '@ghoststack/shared-contracts';
import { exportGsp, importGsp, pruneOrphanAssets, referencedAssetIds, sha256Hex } from './index';

const T = '2026-11-26T00:00:00.000Z';
const bytes = new Uint8Array([9, 8, 7]);
const asset = (assetId: string): ProjectCommand => ({
  type: 'REGISTER_ASSET',
  asset: {
    assetId,
    relativePath: `${assetId}.png`,
    mimeType: 'image/png',
    byteSize: bytes.length,
    checksum: sha256Hex(bytes),
  },
});

function build(commands: ProjectCommand[]): Stack {
  let s = createStack({ stackId: 's', cardId: 'c1', title: 'T', now: T });
  for (const c of commands) {
    const r = applyCommand(s, c, T);
    if (!r.ok) throw new Error(r.error.message);
    s = r.value;
  }
  return s;
}

const image = (assetId: string): ProjectCommand => ({
  type: 'ADD_ELEMENT',
  cardId: 'c1',
  element: {
    elementId: `img-${assetId}`,
    type: 'image',
    name: assetId,
    properties: { ...ELEMENT_DEFAULTS.image.properties },
    layout: { x: 0, y: 0, width: 10, height: 10, zIndex: 0 },
    assetId,
    behaviors: [],
  },
});

describe('orphan assets', () => {
  it('pruneOrphanAssets keeps only referenced assets and never changes its input', () => {
    const s = build([asset('used'), asset('orphan'), image('used')]);
    const before = JSON.stringify(s);
    const pruned = pruneOrphanAssets(s);
    expect(Object.keys(pruned.assetRegistry)).toEqual(['used']);
    expect([...referencedAssetIds(s)]).toEqual(['used']);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('returns the same object when nothing is orphaned', () => {
    const s = build([asset('used'), image('used')]);
    expect(pruneOrphanAssets(s)).toBe(s);
  });

  it('exportGsp leaves an orphan out, even when its bytes are supplied, and does not need them', () => {
    const s = build([asset('used'), asset('orphan'), image('used')]);
    const out = exportGsp(s, { used: bytes, orphan: bytes });
    if (!out.ok) throw new Error(out.error.message);
    expect(Object.keys(unzipSync(out.value)).filter((n) => n.startsWith('assets/'))).toEqual([
      'assets/used.png',
    ]);
    const back = importGsp(out.value);
    if (!back.ok) throw new Error(back.error.message);
    expect(Object.keys(back.value.stack.assetRegistry)).toEqual(['used']);
    expect(exportGsp(s, { used: bytes }).ok).toBe(true);
  });
});
