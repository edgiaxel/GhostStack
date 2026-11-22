import { readFile } from 'node:fs/promises';
import { importProject } from '@ghoststack/project-format';
import { buildFixtureBundle } from '@ghoststack/domain/testing';
import type { ProjectBundle } from '@ghoststack/domain';

export interface SeedArgs {
  readonly gsp?: string;
  readonly demo: boolean;
}

export function parseSeedArgs(argv: readonly string[]): SeedArgs {
  const at = argv.indexOf('--gsp');
  const gsp = at >= 0 ? argv[at + 1] : undefined;
  return { demo: argv.includes('--demo'), ...(gsp === undefined ? {} : { gsp }) };
}

/** Loads the project the bridge starts with. Returns undefined when neither option was given. */
export async function loadSeed(args: SeedArgs): Promise<ProjectBundle | undefined> {
  if (args.gsp !== undefined) {
    const bytes = new Uint8Array(await readFile(args.gsp));
    const imported = await importProject(bytes);
    if (!imported.ok) throw new Error(`The .gsp file was rejected: ${imported.error.reason}`);
    return imported.value;
  }
  return args.demo ? buildFixtureBundle() : undefined;
}
