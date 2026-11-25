import { describe, expect, it } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { FORMAT_VERSION, type Stack } from '@ghoststack/shared-contracts';
import { exportGsp, importGsp, sha256Hex } from './index';

const png = new Uint8Array([137, 80, 78, 71, 0, 1, 2, 3, 255]);
const svg = strToU8('<svg xmlns="http://www.w3.org/2000/svg"/>');

function fixture(): { stack: Stack; assets: Record<string, Uint8Array> } {
  const card = (cardId: string, title: string, assetId?: string) => ({
    cardId,
    title,
    behaviors: [],
    elements: [
      {
        elementId: `${cardId}-e1`,
        type: assetId ? ('image' as const) : ('text' as const),
        name: 'e',
        properties: { text: 'héllo' },
        layout: { x: 1, y: 2, width: 3, height: 4, zIndex: 0 },
        behaviors: [],
        ...(assetId ? { assetId } : {}),
      },
    ],
  });
  const stack: Stack = {
    stackId: 's1',
    title: 'Test stack',
    formatVersion: FORMAT_VERSION,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    entryCardId: 'c2',
    cardOrder: ['c3', 'c2', 'c1'],
    stateSchema: { score: { type: 'number' } },
    cards: { c1: card('c1', 'One', 'a1'), c2: card('c2', 'Two'), c3: card('c3', 'Three', 'a2') },
    assetRegistry: {
      a1: {
        assetId: 'a1',
        relativePath: 'img/a1.png',
        mimeType: 'image/png',
        byteSize: png.length,
        checksum: sha256Hex(png),
      },
      a2: {
        assetId: 'a2',
        relativePath: 'a2.svg',
        mimeType: 'image/svg+xml',
        byteSize: svg.length,
        checksum: sha256Hex(svg),
      },
    },
    viewportDefaults: { width: 800, height: 600 },
  };
  return { stack, assets: { a1: png, a2: svg } };
}

/** Unpack an exported archive, let a test alter it, repack. */
function rebuild(bytes: Uint8Array, edit: (files: Zippable) => void): Uint8Array {
  const files: Zippable = { ...unzipSync(bytes) };
  edit(files);
  return zipSync(files);
}
const json = (bytes: Uint8Array, name: string) =>
  JSON.parse(strFromU8(unzipSync(bytes)[name]!)) as Record<string, unknown>;

function exported(): Uint8Array {
  const { stack, assets } = fixture();
  const r = exportGsp(stack, assets);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}
function failure(bytes: Uint8Array) {
  const r = importGsp(bytes);
  if (r.ok) throw new Error('expected import to fail');
  return r.error;
}

describe('sha256Hex', () => {
  it('matches known vectors', () => {
    expect(sha256Hex(new Uint8Array())).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(sha256Hex(strToU8('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(sha256Hex(strToU8('a'.repeat(1000)))).toBe(
      '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3',
    );
  });
});

describe('gsp round trip', () => {
  it('preserves stack, card ids, card order and asset bytes', () => {
    const { stack, assets } = fixture();
    const r = importGsp(exported());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.stack).toEqual(stack);
    expect(r.value.stack.cardOrder).toEqual(['c3', 'c2', 'c1']);
    expect(r.value.assets).toEqual(assets);
  });

  it('writes the documented layout with a hex sha-256 manifest', () => {
    const files = unzipSync(exported());
    expect(Object.keys(files).sort()).toEqual([
      'assets/a2.svg',
      'assets/img/a1.png',
      'cards/c1.json',
      'cards/c2.json',
      'cards/c3.json',
      'manifest.json',
      'stack.json',
    ]);
    const m = json(exported(), 'manifest.json') as { formatVersion: number; assets: { checksum: string }[] };
    expect(m.formatVersion).toBe(FORMAT_VERSION);
    expect(m.assets.map((a) => a.checksum)).toContain(sha256Hex(png));
    expect(json(exported(), 'stack.json')).not.toHaveProperty('cards');
  });

  it('round-trips a stack without assets', () => {
    const { stack } = fixture();
    const bare: Stack = {
      ...stack,
      cardOrder: ['c2'],
      entryCardId: 'c2',
      cards: { c2: stack.cards.c2! },
      assetRegistry: {},
    };
    const exp = exportGsp(bare);
    expect(exp.ok).toBe(true);
    if (!exp.ok) return;
    const imp = importGsp(exp.value);
    expect(imp.ok && imp.value.stack).toEqual(bare);
  });
});

describe('export failures', () => {
  it('returns ASSET_MISSING when bytes are not supplied', () => {
    const { stack } = fixture();
    const r = exportGsp(stack, {});
    expect(!r.ok && r.error.code).toBe('ASSET_MISSING');
  });

  it('rejects bytes that disagree with the registered checksum', () => {
    const { stack, assets } = fixture();
    const r = exportGsp(stack, { ...assets, a1: new Uint8Array(png.length) });
    expect(!r.ok && r.error.code).toBe('PROJECT_EXPORT_FAILED');
  });

  it('rejects dangling card references and unsafe asset paths', () => {
    const { stack, assets } = fixture();
    const dangling = exportGsp({ ...stack, entryCardId: 'nope' }, assets);
    expect(!dangling.ok && dangling.error.code).toBe('PROJECT_EXPORT_FAILED');
    const evil = { ...stack, assetRegistry: { ...stack.assetRegistry } };
    evil.assetRegistry.a1 = { ...evil.assetRegistry.a1!, relativePath: '../x.png' };
    const r = exportGsp(evil, assets);
    expect(!r.ok && r.error.code).toBe('PROJECT_EXPORT_FAILED');
  });
});

describe('import rejects bad input', () => {
  it('rejects non-zip input and empty input', () => {
    expect(failure(strToU8('hello, not a zip')).code).toBe('PROJECT_IMPORT_FAILED');
    expect(failure(new Uint8Array()).code).toBe('PROJECT_IMPORT_FAILED');
  });

  it('rejects truncated archives', () => {
    const bytes = exported();
    expect(failure(bytes.slice(0, Math.floor(bytes.length / 2))).code).toBe('PROJECT_IMPORT_FAILED');
  });

  it('rejects a corrupted asset checksum', () => {
    const bytes = rebuild(exported(), (f) => {
      f['assets/img/a1.png'] = new Uint8Array(png.length).fill(7);
    });
    expect(failure(bytes).message).toMatch(/checksum/);
  });

  it('rejects a wrong byteSize', () => {
    const bytes = rebuild(exported(), (f) => {
      f['assets/img/a1.png'] = png.slice(0, 3);
    });
    expect(failure(bytes).message).toMatch(/byteSize/);
  });

  it('rejects an unsupported formatVersion', () => {
    const bytes = rebuild(exported(), (f) => {
      f['manifest.json'] = strToU8(
        JSON.stringify({ ...json(exported(), 'manifest.json'), formatVersion: 99 }),
      );
    });
    expect(failure(bytes).message).toMatch(/formatVersion/);
  });

  it.each(['../evil.txt', '/abs.txt', 'assets\\win.txt', 'assets/../../x', 'a/./b'])(
    'rejects entry name %s',
    (name) => {
      const bytes = rebuild(exported(), (f) => {
        f[name] = strToU8('x');
      });
      expect(failure(bytes).code).toBe('PROJECT_IMPORT_FAILED');
    },
  );

  it('rejects unlisted files', () => {
    const bytes = rebuild(exported(), (f) => {
      f['assets/extra.bin'] = strToU8('x');
    });
    expect(failure(bytes).message).toMatch(/Unexpected file/);
  });

  it('returns ASSET_MISSING when a registered asset file is absent', () => {
    const bytes = rebuild(exported(), (f) => {
      delete f['assets/a2.svg'];
    });
    expect(failure(bytes).code).toBe('ASSET_MISSING');
  });

  it('rejects a missing card file and a card that fails the schema', () => {
    const noCard = rebuild(exported(), (f) => {
      delete f['cards/c1.json'];
    });
    expect(failure(noCard).code).toBe('PROJECT_IMPORT_FAILED');
    const badCard = rebuild(exported(), (f) => {
      f['cards/c1.json'] = strToU8('{"cardId":"c1"}');
    });
    expect(failure(badCard).code).toBe('PROJECT_IMPORT_FAILED');
  });

  it('rejects an entryCardId that is not a card', () => {
    const bytes = rebuild(exported(), (f) => {
      f['stack.json'] = strToU8(JSON.stringify({ ...json(exported(), 'stack.json'), entryCardId: 'ghost' }));
    });
    expect(failure(bytes).message).toMatch(/entryCardId/);
  });

  it('rejects cardOrder that disagrees with the manifest', () => {
    const bytes = rebuild(exported(), (f) => {
      f['stack.json'] = strToU8(
        JSON.stringify({ ...json(exported(), 'stack.json'), cardOrder: ['c1', 'c2', 'c3'] }),
      );
    });
    expect(failure(bytes).code).toBe('PROJECT_IMPORT_FAILED');
  });

  it('rejects an archive without a manifest', () => {
    const bytes = rebuild(exported(), (f) => {
      delete f['manifest.json'];
    });
    expect(failure(bytes).message).toMatch(/manifest/);
  });
});
