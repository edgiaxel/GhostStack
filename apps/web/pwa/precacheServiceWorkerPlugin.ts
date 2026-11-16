import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, posix, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

export const SERVICE_WORKER_FILE = 'sw.js';

// Source maps and the worker itself are not part of the shell.
export function isPrecacheCandidate(path: string): boolean {
  return path !== SERVICE_WORKER_FILE && !path.endsWith('.map');
}

export function collectPrecachePaths(allPaths: readonly string[]): string[] {
  return allPaths.filter(isPrecacheCandidate).sort();
}

export function computeBuildHash(files: readonly { path: string; content: Uint8Array }[]): string {
  const hash = createHash('sha256');
  for (const file of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    hash.update(file.path);
    hash.update('\0');
    hash.update(file.content);
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 16);
}

export function renderServiceWorker(
  template: string,
  build: string,
  precache: readonly string[],
): string {
  return `const GS_BUILD = ${JSON.stringify(build)};\nconst GS_PRECACHE = ${JSON.stringify(precache)};\n${template}`;
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

export function precacheServiceWorker(): Plugin {
  let root = '';
  let outDir = '';
  return {
    name: 'ghoststack-precache-service-worker',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
    },
    // Runs after Vite has written the bundle and copied public/, so the list covers the whole shell.
    writeBundle() {
      const paths = collectPrecachePaths(
        listFiles(outDir).map((file) => relative(outDir, file).split(sep).join(posix.sep)),
      );
      const files = paths.map((path) => ({ path, content: readFileSync(join(outDir, path)) }));
      const template = readFileSync(resolve(root, 'pwa', SERVICE_WORKER_FILE), 'utf8');
      writeFileSync(
        join(outDir, SERVICE_WORKER_FILE),
        renderServiceWorker(template, computeBuildHash(files), paths),
      );
    },
  };
}
