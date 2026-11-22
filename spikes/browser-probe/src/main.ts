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

document
  .getElementById('run-providers')
  ?.addEventListener('click', () => void checkProviders().then(show));
document.getElementById('run-idb-1')?.addEventListener('click', () => void idbPhase1().then(show));
document.getElementById('run-idb-2')?.addEventListener('click', () => void idbPhase2().then(show));

// Hooks for the automated run. They return results only, never the key.
(window as unknown as { probe: object }).probe = { checkProviders, idbPhase1, idbPhase2 };
