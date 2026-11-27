// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServicesProvider } from '../../../app/services';
import { enqueueProposal } from '../proposals';
import { BridgePairing } from './BridgePairing';
import { addCardPlan, clearQueue, openTestSession } from './testing';
const CODE = 'gs-mcp:41234:abcdefghijklmnopqrstuv';
/** Browser WebSocket stand-in for jsdom. The real transport is covered by the integration and e2e tests. */
class FakeWebSocket {
  static last: FakeWebSocket | undefined;
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeWebSocket.last = this;
  }
  send(d: string): void {
    this.sent.push(d);
  }
  close(): void {
    this.closed = true;
  }
}
beforeEach(() => {
  vi.stubGlobal('WebSocket', FakeWebSocket);
  FakeWebSocket.last = undefined;
});
afterEach(() => {
  cleanup();
  clearQueue();
  vi.unstubAllGlobals();
});
async function mount() {
  const { session } = await openTestSession('Recipes');
  render(
    <ServicesProvider>
      <BridgePairing session={session} />
    </ServicesProvider>,
  );
  return userEvent.setup();
}
describe('BridgePairing', () => {
  it('starts empty with a labelled field and Connect disabled', async () => {
    await mount();
    expect(screen.getByText('No agent connected.')).toBeTruthy();
    expect(screen.getByLabelText('Pairing code')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Connect' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Disconnect' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('names the problem for a malformed code and opens no socket', async () => {
    const user = await mount();
    await user.type(screen.getByLabelText('Pairing code'), 'hello');
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    expect(screen.getByText(/looks like gs-mcp/)).toBeTruthy();
    expect(FakeWebSocket.last).toBeUndefined();
  });
  it('connects, shows the shared Stack and the waiting count, and Disconnect closes the socket', async () => {
    const user = await mount();
    await user.type(screen.getByLabelText('Pairing code'), CODE);
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    const ws = FakeWebSocket.last as FakeWebSocket;
    expect(ws.url).toBe('ws://127.0.0.1:41234/');
    expect(screen.getByText('Connecting to the MCP server.')).toBeTruthy();
    act(() => ws.onmessage?.({ data: JSON.stringify({ t: 'welcome', protocol: 1 }) }));
    expect(screen.getByTestId('bridge-shared').textContent).toContain('Sharing Recipes');
    act(() => {
      enqueueProposal({ plan: addCardPlan(), source: 'mcp' });
    });
    expect(screen.getByTestId('bridge-shared').textContent).toContain('waiting for approval: 1');
    expect((screen.getByLabelText('Pairing code') as HTMLInputElement).value).toBe('');
    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(ws.closed).toBe(true);
    expect(screen.getByText(/can no longer reach/)).toBeTruthy();
  });
  it('shows a failure with the next step when the server refuses', async () => {
    const user = await mount();
    await user.type(screen.getByLabelText('Pairing code'), CODE);
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    act(() => FakeWebSocket.last?.onclose?.({ code: 4401 }));
    expect(screen.getByText(/not accepted/).className).toContain('gs-error');
    expect((screen.getByRole('button', { name: 'Connect' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByLabelText('Pairing code') as HTMLInputElement).value).toBe(CODE);
  });
  it('disconnects when the panel unmounts', async () => {
    const user = await mount();
    await user.type(screen.getByLabelText('Pairing code'), CODE);
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    const ws = FakeWebSocket.last as FakeWebSocket;
    cleanup();
    expect(ws.closed).toBe(true);
  });
});
