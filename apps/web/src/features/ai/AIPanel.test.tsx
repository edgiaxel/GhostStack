// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StackSession } from '@ghoststack/shared-contracts';
import { ServicesProvider } from '../../app/services';
import { AIPanel, AIStatusChip } from './index';
import { dismissProposal, enqueueProposal, listProposals } from './proposals';
import { providerStore } from './store';
import { addCardPlan, brokenPlan, openRealSession } from './testing';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  localStorage.clear();
  providerStore.clearKey();
  providerStore.saveSettings({ kind: 'demo' });
  for (const p of listProposals()) dismissProposal(p.id);
});
async function mount(): Promise<{ session: StackSession; onClose: () => void }> {
  const { session } = await openRealSession();
  const onClose = vi.fn();
  const slot = {
    session,
    cardId: 'c1',
    selectedElementId: undefined,
    onSelectElement: () => undefined,
    viewport: 'desktop' as const,
    onViewportChange: () => undefined,
  };
  render(
    <ServicesProvider>
      <AIStatusChip {...slot} onOpen={() => undefined} />
      <AIPanel {...slot} onClose={onClose} />
    </ServicesProvider>,
  );
  return { session, onClose };
}
describe('status chip and settings', () => {
  it('shows the provider, locality and state', async () => {
    await mount();
    const chip = screen.getByRole('button', { name: /^AI:/ });
    expect(chip.textContent).toContain('Demo (offline)');
    expect(chip.textContent).toContain('Local');
    expect(chip.textContent).toContain('not tested');
    await userEvent.click(screen.getByRole('tab', { name: 'Provider' }));
    await userEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    await waitFor(() => expect(chip.textContent).toContain('ready'));
  });
  it('holds the key in a password field and never writes it to storage', async () => {
    await mount();
    await userEvent.click(screen.getByRole('tab', { name: 'Provider' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Provider' }), 'openai-compatible');
    const key = screen.getByLabelText('API key');
    expect(key.getAttribute('type')).toBe('password');
    await userEvent.type(screen.getByLabelText('Base URL'), 'https://api.example.test/v1');
    await userEvent.type(screen.getByLabelText('Model'), 'gpt-test');
    await userEvent.type(key, 'sk-component-SECRET');
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(screen.getByLabelText('API key')).toHaveProperty('value', '');
    expect(JSON.stringify({ ...localStorage })).not.toContain('sk-component-SECRET');
    expect(document.body.textContent).not.toContain('sk-component-SECRET');
    expect(screen.getByRole('button', { name: /^AI:/ }).textContent).toContain('Remote');
    await userEvent.click(screen.getByRole('button', { name: 'Clear key from memory' }));
    expect(providerStore.getState().hasKey).toBe(false);
  });
  it('explains invalid settings next to the field and saves nothing', async () => {
    await mount();
    await userEvent.click(screen.getByRole('tab', { name: 'Provider' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Provider' }), 'openai-compatible');
    await userEvent.type(screen.getByLabelText('Base URL'), 'http://example.test/v1');
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(screen.getByText(/Use https for a remote address/)).toBeTruthy();
    expect(screen.getByText('Enter the model name to use.')).toBeTruthy();
    expect(screen.getByText(/Enter an API key/)).toBeTruthy();
    expect(providerStore.getState().settings).toEqual({ kind: 'demo' });
  });
});
describe('assistant', () => {
  it('runs the demo journey through the real session', async () => {
    const { session } = await mount();
    await userEvent.type(screen.getByLabelText('Describe the change'), 'add a quiz question about space');
    expect(screen.getByTestId('ai-context').textContent).toContain('Nothing leaves it');
    await userEvent.click(screen.getByRole('button', { name: 'Ask for a plan' }));
    const review = await screen.findByTestId('ai-review');
    expect(within(review).getByRole('heading', { name: 'Quiz question' })).toBeTruthy();
    expect(session.getStack().cardOrder).toHaveLength(1);
    await userEvent.click(within(review).getByRole('button', { name: 'Approve and apply' }));
    expect(await screen.findByTestId('ai-report')).toBeTruthy();
    expect(session.getStack().cardOrder).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'Revert AI change' }));
    expect(await screen.findByTestId('ai-reverted')).toBeTruthy();
    expect(session.getStack().cardOrder).toHaveLength(1);
  });
  it('shows a next action for a request the demo provider cannot handle', async () => {
    await mount();
    await userEvent.type(screen.getByLabelText('Describe the change'), 'write a poem');
    await userEvent.click(screen.getByRole('button', { name: 'Ask for a plan' }));
    const alert = await screen.findByTestId('ai-error');
    expect(alert.getAttribute('data-code')).toBe('INVALID_AI_PLAN');
    expect(alert.textContent).toContain('Rewrite the request');
    await userEvent.click(within(alert).getByRole('button', { name: 'Edit the request' }));
    expect(screen.getByLabelText('Describe the change')).toHaveProperty('value', 'write a poem');
  });
  it('disables Ask until a request is typed', async () => {
    await mount();
    expect(screen.getByRole('button', { name: 'Ask for a plan' })).toHaveProperty('disabled', true);
  });
  it('asks for consent before a remote send and sends nothing when declined', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('no network in tests')));
    vi.stubGlobal('fetch', fetchSpy);
    providerStore.saveSettings(
      { kind: 'openai-compatible', baseUrl: 'https://api.example.test/v1', model: 'gpt-test' },
      'sk-consent-SECRET',
    );
    await mount();
    await userEvent.type(screen.getByLabelText('Describe the change'), 'add a card');
    expect(screen.getByTestId('ai-context').textContent).toContain('remote server');
    await userEvent.click(screen.getByRole('button', { name: 'Ask for a plan' }));
    const consent = await screen.findByTestId('ai-consent');
    expect(consent.textContent).toContain('Images and other asset files are not sent');
    expect(consent.textContent).toContain('Card titles and element counts');
    expect(fetchSpy).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Do not send' }));
    expect(screen.queryByTestId('ai-consent')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Ask for a plan' }));
    await userEvent.click(await screen.findByRole('button', { name: /^Send to / }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const alert = await screen.findByTestId('ai-error');
    expect(alert.getAttribute('data-code')).toBe('PROVIDER_UNAVAILABLE');
    expect(document.body.textContent).not.toContain('sk-consent-SECRET');
  });
});
describe('proposal queue', () => {
  it('lists proposals and applies one only after Approve', async () => {
    const { session } = await mount();
    enqueueProposal({ plan: addCardPlan('agent-card', 'Agent card'), source: 'mcp' });
    const item = await screen.findByTestId('ai-proposal');
    expect(item.textContent).toContain('External agent');
    await userEvent.click(within(item).getByRole('button', { name: /^Review/ }));
    const review = await screen.findByTestId('ai-review');
    expect(review.textContent).toContain('Proposed by an external agent. Nothing has changed yet.');
    expect(within(review).queryByRole('button', { name: 'Revise request' })).toBeNull();
    expect(session.getStack().cardOrder).toHaveLength(1);
    await userEvent.click(within(review).getByRole('button', { name: 'Approve and apply' }));
    await screen.findByTestId('ai-report');
    expect(session.getStack().cardOrder).toHaveLength(2);
    expect(listProposals()).toHaveLength(0);
  });
  it('blocks Approve for a proposal that does not apply and marks the failing step', async () => {
    const { session } = await mount();
    enqueueProposal({ plan: brokenPlan(), source: 'file' });
    await userEvent.click(await screen.findByRole('button', { name: /^Review/ }));
    const review = await screen.findByTestId('ai-review');
    const approve = within(review).getByRole('button', { name: 'Approve and apply' });
    expect(approve).toHaveProperty('disabled', true);
    const steps = within(review).getAllByTestId('ai-step');
    expect(steps.map((s) => s.getAttribute('data-state')).sort()).toEqual(['failed', 'ok']);
    expect(review.textContent).toContain('Does not apply');
    expect(review.querySelector('details[open]')).toBeNull();
    expect(session.getStack().cardOrder).toHaveLength(1);
    await userEvent.click(within(review).getByRole('button', { name: 'Reject' }));
    expect(listProposals()).toHaveLength(0);
  });
  it('dismisses a proposal without opening it', async () => {
    await mount();
    enqueueProposal({ plan: addCardPlan(), source: 'mcp' });
    await userEvent.click(await screen.findByRole('button', { name: /^Dismiss/ }));
    expect(screen.queryByTestId('ai-proposal')).toBeNull();
  });
});
