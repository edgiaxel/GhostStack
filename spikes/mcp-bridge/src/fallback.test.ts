import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { approvePlan, createTransactionManager, parseAIPlan } from '@ghoststack/ai-core';
import { buildFixtureBundle } from '@ghoststack/domain/testing';
import { serializeProject } from '@ghoststack/project-format';
import { createMemoryStorage } from '@ghoststack/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBridgeCore } from './core';
import { PROPOSALS_FILE_VERSION, loadSeed, parseSeedArgs, writeProposalsFile } from './seed';

let dir = '';
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'gs-fallback-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('seed arguments', () => {
  it('parses --demo, --gsp and --proposals-out', () => {
    expect(parseSeedArgs(['--demo'])).toEqual({ demo: true });
    expect(parseSeedArgs(['--gsp', 'a.gsp', '--proposals-out', 'out.json'])).toEqual({
      demo: false,
      gsp: 'a.gsp',
      proposalsOut: 'out.json',
    });
    expect(parseSeedArgs([])).toEqual({ demo: false });
  });

  it('seeds nothing when no option is given', async () => {
    expect(await loadSeed({ demo: false })).toBeUndefined();
  });
});

describe('loading a project from a .gsp archive', () => {
  it('imports a real archive back into the same project, assets included', async () => {
    const original = buildFixtureBundle();
    const exported = await serializeProject(original);
    if (!exported.ok) throw new Error('export');
    const path = join(dir, 'project.gsp');
    await writeFile(path, exported.value);
    const seeded = await loadSeed({ demo: false, gsp: path });
    expect(seeded).toEqual(original);
  });

  it.each([
    ['not a zip', new Uint8Array([1, 2, 3, 4])],
    ['empty', new Uint8Array(0)],
  ])('refuses a %s file with a reason and no project', async (_name, bytes) => {
    const path = join(dir, 'bad.gsp');
    await writeFile(path, bytes);
    await expect(loadSeed({ demo: false, gsp: path })).rejects.toThrow(/rejected/);
  });

  it('refuses a corrupted archive', async () => {
    const exported = await serializeProject(buildFixtureBundle());
    if (!exported.ok) throw new Error('export');
    const damaged = new Uint8Array(exported.value);
    damaged[Math.floor(damaged.length / 2)] = (damaged[Math.floor(damaged.length / 2)] ?? 0) ^ 0xff;
    const path = join(dir, 'damaged.gsp');
    await writeFile(path, damaged);
    await expect(loadSeed({ demo: false, gsp: path })).rejects.toThrow();
  });
});

describe('proposals file (the fallback return path)', () => {
  const plan = {
    planVersion: 1,
    planId: 'fallback-plan',
    requestSummary: 'agent proposal over stdio',
    commands: [{ command: 'ADD_CARD', title: 'From stdio agent' }],
  };

  it('is written when a proposal is queued, privately, with plans only', async () => {
    const path = join(dir, 'proposals.json');
    const core = createBridgeCore({
      onProposalQueued: (pending) => void writeProposalsFile(path, pending),
    });
    core.publishProject(buildFixtureBundle());
    expect(core.submitProposal(plan, 'stdio-client').ok).toBe(true);
    await new Promise((r) => setTimeout(r, 50));

    const text = await readFile(path, 'utf8');
    const file = JSON.parse(text) as { fileVersion: number; proposals: { plan: unknown }[] };
    expect(file.fileVersion).toBe(PROPOSALS_FILE_VERSION);
    expect(file.proposals).toHaveLength(1);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    // Plans only: nothing from the project itself is written.
    expect(text).not.toContain('Fixture stack');
    expect(text).not.toContain('sha256');
  });

  it('can be imported by the editor through the normal review and approval path', async () => {
    const path = join(dir, 'proposals.json');
    const bundle = buildFixtureBundle();
    const core = createBridgeCore({
      onProposalQueued: (pending) => void writeProposalsFile(path, pending),
    });
    core.publishProject(bundle);
    core.submitProposal(plan, 'stdio-client');
    await new Promise((r) => setTimeout(r, 50));

    // Editor side: read the file as untrusted input, validate, approve, execute, roll back.
    const file = JSON.parse(await readFile(path, 'utf8')) as { proposals: { plan: unknown }[] };
    const parsed = parseAIPlan(file.proposals[0]?.plan);
    if (!parsed.ok) throw new Error('the imported plan did not validate');
    const storage = createMemoryStorage();
    await storage.saveProject(bundle);
    const manager = createTransactionManager({ storage });
    const executed = await manager.execute(
      bundle.stack.stackId,
      approvePlan(parsed.plan, () => new Date().toISOString()),
    );
    expect(executed.ok).toBe(true);
    const after = await storage.loadProject(bundle.stack.stackId);
    expect(after.ok && after.value.stack.cardOrder.length).toBe(bundle.stack.cardOrder.length + 1);
    if (executed.ok) expect((await manager.rollback(executed.value.operationId)).ok).toBe(true);
    const restored = await storage.loadProject(bundle.stack.stackId);
    expect(restored.ok && restored.value).toEqual(bundle);
  });

  it('does not call the writer for a rejected proposal', () => {
    let calls = 0;
    const core = createBridgeCore({ onProposalQueued: () => (calls += 1) });
    core.publishProject(buildFixtureBundle());
    expect(core.submitProposal({ not: 'a plan' }, 'x').ok).toBe(false);
    expect(calls).toBe(0);
  });
});
