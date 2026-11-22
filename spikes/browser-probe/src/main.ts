import {
  adoptSeededEditorToken,
  bridgeApprove,
  bridgeListProposals,
  bridgeNegative,
  bridgePublish,
  bridgeRollback,
  setEditorToken,
} from './bridge';
import { adoptSeededKey, checkProviders, idbPhase1, idbPhase2, setKey } from './checks';
import type { CheckResult } from './checks';

const out = document.getElementById('out') as HTMLPreElement;
const keyInput = document.getElementById('key') as HTMLInputElement;
(document.getElementById('origin') as HTMLElement).textContent = location.origin;

const show = (results: CheckResult[]): CheckResult[] => {
  out.textContent = JSON.stringify(results, null, 2);
  return results;
};

keyInput.addEventListener('input', () => {
  setKey(keyInput.value);
});
if (adoptSeededKey()) keyInput.placeholder = 'key loaded into memory';
const editorInput = document.getElementById('editor-token') as HTMLInputElement;
editorInput.addEventListener('input', () => {
  setEditorToken(editorInput.value);
});
if (adoptSeededEditorToken()) editorInput.placeholder = 'editor token loaded into memory';

document
  .getElementById('run-providers')
  ?.addEventListener('click', () => void checkProviders().then(show));
document.getElementById('run-idb-1')?.addEventListener('click', () => void idbPhase1().then(show));
document.getElementById('run-idb-2')?.addEventListener('click', () => void idbPhase2().then(show));

let lastOperationId = '';
const button = (id: string, run: () => Promise<CheckResult[]>) =>
  document.getElementById(id)?.addEventListener('click', () => void run().then(show));
button('bridge-publish', bridgePublish);
button('bridge-list', async () => (await bridgeListProposals()).results);
button('bridge-approve', async () => {
  const { proposals } = await bridgeListProposals();
  const pending = proposals.find((p) => p.status === 'pending');
  if (pending === undefined)
    return [{ name: 'bridge: approve', ok: false, detail: 'no pending proposal' }];
  const results = await bridgeApprove(pending.proposalId);
  lastOperationId =
    /operation (op_[0-9a-f]+)/.exec(results.map((r) => r.detail).join(' '))?.[1] ?? '';
  return results;
});
button('bridge-rollback', async () =>
  lastOperationId === ''
    ? [{ name: 'bridge: rollback', ok: false, detail: 'no applied operation in this page session' }]
    : bridgeRollback(lastOperationId),
);

// Hooks for the automated run. They return results only, never the key.
(window as unknown as { probe: object }).probe = {
  checkProviders,
  idbPhase1,
  idbPhase2,
  bridgePublish,
  bridgeNegative,
  bridgeListProposals,
  bridgeApprove,
  bridgeRollback,
};
