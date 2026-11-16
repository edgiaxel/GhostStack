// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  collectPrecachePaths,
  computeBuildHash,
  isPrecacheCandidate,
  renderServiceWorker,
} from './precacheServiceWorkerPlugin';

const bytes = (text: string) => new TextEncoder().encode(text);

describe('collectPrecachePaths', () => {
  it('keeps the shell files sorted and drops the worker and source maps', () => {
    const paths = collectPrecachePaths([
      'sw.js',
      'index.html',
      'assets/index-abc.js.map',
      'assets/index-abc.js',
      'favicon.svg',
      'assets/inter-latin-400-normal-x.woff2',
    ]);
    expect(paths).toEqual([
      'assets/index-abc.js',
      'assets/inter-latin-400-normal-x.woff2',
      'favicon.svg',
      'index.html',
    ]);
  });

  it('does not exclude a nested file that is merely named like the worker', () => {
    expect(isPrecacheCandidate('assets/sw.js')).toBe(true);
  });
});

describe('computeBuildHash', () => {
  const files = [
    { path: 'index.html', content: bytes('<html>') },
    { path: 'assets/a.js', content: bytes('a') },
  ];

  it('is stable and independent of input order', () => {
    expect(computeBuildHash(files)).toBe(computeBuildHash([...files].reverse()));
    expect(computeBuildHash(files)).toMatch(/^[0-9a-f]{16}$/);
  });

  it('changes when one byte of content changes', () => {
    const changed = [files[0]!, { path: 'assets/a.js', content: bytes('b') }];
    expect(computeBuildHash(changed)).not.toBe(computeBuildHash(files));
  });

  it('changes when a path changes', () => {
    const renamed = [files[0]!, { path: 'assets/b.js', content: bytes('a') }];
    expect(computeBuildHash(renamed)).not.toBe(computeBuildHash(files));
  });
});

describe('renderServiceWorker', () => {
  it('prepends the build id and file list as JSON string literals', () => {
    const output = renderServiceWorker('// body', 'abc123', ['index.html', 'a"b.js']);
    expect(output).toBe(
      'const GS_BUILD = "abc123";\nconst GS_PRECACHE = ["index.html","a\\"b.js"];\n// body',
    );
  });
});
