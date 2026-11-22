import { buildFixtureBundle } from '@ghoststack/domain/testing';
import { describe, expect, it } from 'vitest';
import { MAX_DETAIL_CHARS, MAX_PENDING_PROPOSALS, createBridgeCore } from './core';

const addCard = (title: string) => ({
  planVersion: 1,
  planId: `plan-${title}`,
  requestSummary: `add ${title}`,
  commands: [{ command: 'ADD_CARD', title }],
});

const seeded = () => {
  let n = 0;
  const core = createBridgeCore({
    clock: () => '2030-01-01T00:00:00.000Z',
    newId: (prefix) => `${prefix}_${(n += 1)}`,
  });
  const bundle = buildFixtureBundle();
  core.publishProject(bundle);
  return { core, bundle };
};

describe('snapshot', () => {
  it('reports that nothing was published yet', () => {
    const core = createBridgeCore();
    const read = core.readProject();
    expect(!read.ok && read.error.message).toContain('No project');
    expect(core.validateSnapshot().ok).toBe(false);
    expect(core.createCheckpoint('x').ok).toBe(false);
    expect(core.submitProposal(addCard('a'), 'test').ok).toBe(false);
  });

  it('stores a copy and hands out copies', () => {
    const { core, bundle } = seeded();
    const first = core.readProject();
    if (!first.ok) throw new Error('read');
    first.value.bundle.stack.title = 'tampered by caller';
    const second = core.readProject();
    expect(second.ok && second.value.bundle.stack.title).toBe(bundle.stack.title);
    expect(bundle.stack.title).not.toBe('tampered by caller');
  });

  it('bumps the revision on every publish', () => {
    const { core, bundle } = seeded();
    expect(core.publishProject(bundle).revision).toBe(2);
  });
});

describe('submitProposal', () => {
  it('queues a valid plan as pending without changing the project', () => {
    const { core, bundle } = seeded();
    const result = core.submitProposal(addCard('New'), 'kiro');
    expect(result.ok && result.value.status).toBe('pending');
    expect(result.ok && result.value.review.newCardCount).toBe(1);
    expect(core.listProposals('pending')).toHaveLength(1);
    const read = core.readProject();
    expect(read.ok && read.value.bundle).toEqual(bundle);
  });

  it.each([
    ['a non-object', 'hello'],
    ['an unknown command', { ...addCard('x'), commands: [{ command: 'RUN_SHELL' }] }],
    ['an empty command list', { ...addCard('x'), commands: [] }],
  ])('rejects %s with located issues and does not queue it', (_name, input) => {
    const { core } = seeded();
    const result = core.submitProposal(input, 'kiro');
    expect(!result.ok && result.error.issues[0]?.code).toBe('INVALID_AI_PLAN');
    expect(core.listProposals()).toHaveLength(0);
  });

  it('rejects a plan that cannot be applied to the current project', () => {
    const { core } = seeded();
    const result = core.submitProposal(
      { ...addCard('x'), commands: [{ command: 'DELETE_CARD', cardId: 'crd_missing' }] },
      'kiro',
    );
    expect(!result.ok && result.error.issues[0]?.message).toContain('Command 0 cannot be applied');
    expect(core.listProposals()).toHaveLength(0);
  });

  it('rejects a plan whose result would be an invalid project', () => {
    const { core } = seeded();
    const entry = core.readProject();
    if (!entry.ok) throw new Error('read');
    const result = core.submitProposal(
      {
        ...addCard('x'),
        commands: [
          {
            command: 'ADD_ELEMENT',
            cardId: entry.value.bundle.stack.entryCardId,
            element: {
              type: 'image',
              name: 'Pic',
              layout: { x: 0, y: 0, width: 1, height: 1 },
              properties: { assetId: 'ast_00000000-0000-4000-8000-ffffffffffff', alt: '' },
            },
          },
        ],
      },
      'kiro',
    );
    expect(!result.ok && result.error.issues[0]?.code).toBe('PROJECT_VALIDATION_FAILED');
    expect(core.listProposals()).toHaveLength(0);
  });

  it('caps the number of waiting proposals', () => {
    const { core } = seeded();
    for (let i = 0; i < MAX_PENDING_PROPOSALS; i += 1) {
      expect(core.submitProposal(addCard(`c${i}`), 'kiro').ok).toBe(true);
    }
    const over = core.submitProposal(addCard('one-too-many'), 'kiro');
    expect(!over.ok && over.error.issues[0]?.message).toContain('Too many');
  });

  it('does not let a returned proposal change the queue', () => {
    const { core } = seeded();
    const result = core.submitProposal(addCard('A'), 'kiro');
    if (!result.ok) throw new Error('submit');
    (result.value.plan as { planId: string }).planId = 'tampered';
    expect(core.getProposal(result.value.proposalId)?.plan.planId).toBe('plan-A');
  });
});

describe('decideProposal', () => {
  it('allows only valid transitions, once', () => {
    const { core } = seeded();
    const submitted = core.submitProposal(addCard('A'), 'kiro');
    if (!submitted.ok) throw new Error('submit');
    const id = submitted.value.proposalId;
    expect(core.decideProposal(id, 'applied').ok).toBe(false);
    expect(core.decideProposal(id, 'approved').ok).toBe(true);
    expect(core.decideProposal(id, 'rejected').ok).toBe(false);
    expect(core.decideProposal(id, 'applied').ok).toBe(true);
    expect(core.decideProposal(id, 'failed').ok).toBe(false);
    expect(core.getProposal(id)?.status).toBe('applied');
  });

  it('rejects an unknown proposal and frees queue space when decided', () => {
    const { core } = seeded();
    expect(core.decideProposal('prp_nope', 'approved').ok).toBe(false);
    for (let i = 0; i < MAX_PENDING_PROPOSALS; i += 1) core.submitProposal(addCard(`c${i}`), 'k');
    const [first] = core.listProposals('pending');
    core.decideProposal(first?.proposalId ?? '', 'rejected');
    expect(core.submitProposal(addCard('fits-now'), 'k').ok).toBe(true);
  });
});

describe('validateSnapshot and checkpoints', () => {
  it('reports a valid project', () => {
    const { core } = seeded();
    const result = core.validateSnapshot();
    expect(result.ok && result.value).toEqual({ valid: true, errors: [] });
  });

  it('reports problems by code and location, with messages free of project values', () => {
    const { core, bundle } = seeded();
    const marker = 'unique-marker-value-9d3f';
    core.publishProject({ ...bundle, stack: { ...bundle.stack, entryCardId: marker } });
    const result = core.validateSnapshot();
    expect(result.ok && result.value.valid).toBe(false);
    if (!result.ok) throw new Error('validate');
    const codes = result.value.errors.map((e) => e.code);
    expect(codes).toContain('ENTRY_CARD_NOT_FOUND');
    // Identifiers appear in details by contract, but never in the human-readable parts.
    expect(Object.keys(result.value.errors[0] ?? {}).sort()).toEqual(['code', 'details', 'path']);
  });

  it('caps long identifiers in details so a damaged project cannot flood an agent', () => {
    const { core, bundle } = seeded();
    const huge = 'x'.repeat(5000);
    core.publishProject({ ...bundle, stack: { ...bundle.stack, entryCardId: huge } });
    const result = core.validateSnapshot();
    if (!result.ok) throw new Error('validate');
    const text = JSON.stringify(result.value);
    expect(text).not.toContain('x'.repeat(MAX_DETAIL_CHARS + 1));
    expect(text.length).toBeLessThan(2000);
  });

  it('creates a checkpoint copy without changing the project or exposing the bundle', () => {
    const { core, bundle } = seeded();
    const made = core.createCheckpoint('before agent');
    expect(made.ok && Object.keys(made.value).sort()).toEqual([
      'checkpointId',
      'createdAt',
      'label',
      'stackId',
    ]);
    expect(core.listCheckpoints()).toHaveLength(1);
    const read = core.readProject();
    expect(read.ok && read.value.bundle).toEqual(bundle);
  });
});
