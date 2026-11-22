import { readFile, rename, writeFile } from 'node:fs/promises';
import { importProject } from '@ghoststack/project-format';
import { buildFixtureBundle } from '@ghoststack/domain/testing';
import type { ProjectBundle } from '@ghoststack/domain';
import type { Proposal } from './core';

export interface SeedArgs {
  readonly gsp?: string;
  /** Where the stdio fallback writes pending proposals for the editor to import. */
  readonly proposalsOut?: string;
  readonly demo: boolean;
}

export function parseSeedArgs(argv: readonly string[]): SeedArgs {
  const at = argv.indexOf('--gsp');
  const gsp = at >= 0 ? argv[at + 1] : undefined;
  const outAt = argv.indexOf('--proposals-out');
  const proposalsOut = outAt >= 0 ? argv[outAt + 1] : undefined;
  return {
    demo: argv.includes('--demo'),
    ...(gsp === undefined ? {} : { gsp }),
    ...(proposalsOut === undefined ? {} : { proposalsOut }),
  };
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

export const PROPOSALS_FILE_VERSION = 1;

/**
 * Writes pending proposals as plain JSON (plans only, no project data) so the editor can import them
 * through the same plan review and approval path. Written to a temp file and renamed, so a reader
 * never sees a half-written file. The file is private to the current user.
 */
export async function writeProposalsFile(
  path: string,
  pending: readonly Proposal[],
): Promise<void> {
  const body = {
    fileVersion: PROPOSALS_FILE_VERSION,
    proposals: pending.map(({ proposalId, source, submittedAt, plan }) => ({
      proposalId,
      source,
      submittedAt,
      plan,
    })),
  };
  const temp = `${path}.tmp`;
  await writeFile(temp, JSON.stringify(body, null, 2), { mode: 0o600 });
  await rename(temp, path);
}
