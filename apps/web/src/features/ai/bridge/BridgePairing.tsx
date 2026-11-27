import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { StackSession } from '@ghoststack/shared-contracts';
import { useServices } from '../../../app/services';
import { useSessionStack } from '../../../app/useStackSession';
import { Button, Field } from '../../../components';
import { enqueueProposal, listProposals, subscribeProposals } from '../proposals';
import { connectBridge } from './client';
import type { BridgeConnection, BridgeStatus } from './client';
import { createBridgeHandlers } from './handlers';
import './bridge.css';
export interface BridgePairingProps {
  session: StackSession;
}
/**
 * Pairing section for the AI panel: enter the code an MCP server prints, see who is connected, and
 * disconnect. The connection lives while this component is mounted, so keep the AI panel open while
 * an agent works.
 */
export function BridgePairing({ session }: BridgePairingProps): ReactNode {
  const { checkpoints } = useServices();
  const stack = useSessionStack(session);
  const pending = useSyncExternalStore(subscribeProposals, listProposals).length;
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  const connRef = useRef<BridgeConnection | undefined>(undefined);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<BridgeStatus | undefined>(undefined);
  const disconnect = useCallback((): void => {
    connRef.current?.disconnect();
    connRef.current = undefined;
  }, []);
  useEffect(() => disconnect, [disconnect]);
  const connect = (): void => {
    disconnect();
    const handlers = createBridgeHandlers({
      getSession: () => sessionRef.current,
      checkpoints,
      enqueue: enqueueProposal,
      pendingCount: () => listProposals().length,
      now: () => new Date().toISOString(),
      newId: () => crypto.randomUUID(),
    });
    const r = connectBridge({
      pairingCode: code,
      handlers,
      onStatus: (next) => {
        setStatus(next);
        if (next.state === 'connected') setCode('');
      },
    });
    if (!r.ok) {
      setStatus({ state: 'failed', detail: r.error.message });
      return;
    }
    connRef.current = r.value;
    setStatus(r.value.getStatus());
  };
  const live = status?.state === 'connecting' || status?.state === 'connected';
  return (
    <section className="gs-bridge" aria-labelledby="gs-bridge-title">
      <h3 id="gs-bridge-title" className="gs-panel-title">
        Connect an agent
      </h3>
      <p className="gs-bridge-note">
        Start the GhostStack MCP server from your agent, then enter the pairing code it prints. The agent can
        read this Stack and propose changes. Every proposal waits for your approval.
      </p>
      <form
        className="gs-bridge-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!live && code.trim()) connect();
        }}
      >
        <Field
          label="Pairing code"
          hint="Looks like gs-mcp:41234:..."
          value={code}
          onChange={setCode}
          disabled={live}
          autoComplete="off"
          spellCheck={false}
        />
        <div className="gs-bridge-actions">
          <Button type="submit" variant="primary" disabled={live || code.trim() === ''}>
            Connect
          </Button>
          <Button
            disabled={!live}
            onClick={() => {
              disconnect();
              setStatus({
                state: 'closed',
                detail: 'Disconnected. The agent can no longer reach this Stack.',
              });
            }}
          >
            Disconnect
          </Button>
        </div>
      </form>
      <div role="status" aria-live="polite" data-testid="bridge-status" className="gs-bridge-status">
        {status ? (
          <p className={status.state === 'failed' ? 'gs-error' : undefined} data-state={status.state}>
            {status.detail}
          </p>
        ) : (
          <p className="gs-empty">No agent connected.</p>
        )}
        {status?.state === 'connected' ? (
          <p data-testid="bridge-shared">
            Sharing {stack.title}. Proposals waiting for approval: <strong>{pending}</strong>.
          </p>
        ) : null}
      </div>
    </section>
  );
}
