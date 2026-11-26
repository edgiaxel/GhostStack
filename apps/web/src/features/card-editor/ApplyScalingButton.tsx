import { useState } from 'react';
import type { ReactNode } from 'react';
import type { StackSession } from '@ghoststack/shared-contracts';
import { useSessionStack } from '../../app/useStackSession';

/**
 * Sets scale mode `scale` on every element of the card that does not use it yet. One
 * `coalesceKey` per click makes the whole action a single undo step.
 */
export function ApplyScalingButton({
  session,
  cardId,
  disabled = false,
}: {
  session: StackSession;
  cardId: string;
  disabled?: boolean;
}): ReactNode {
  const stack = useSessionStack(session);
  const [notice, setNotice] = useState<string | undefined>();
  const pending = (stack.cards[cardId]?.elements ?? []).filter((e) => e.layout.scaleMode !== 'scale');
  const apply = (): void => {
    const key = `apply-scaling:${cardId}:${crypto.randomUUID()}`;
    for (const element of pending) {
      const r = session.dispatch(
        {
          type: 'UPDATE_ELEMENT',
          cardId,
          elementId: element.elementId,
          patch: { layout: { scaleMode: 'scale' } },
        },
        { coalesceKey: key },
      );
      if (!r.ok) return setNotice(r.error.message);
    }
    setNotice(undefined);
  };
  return (
    <>
      <button
        type="button"
        className="gs-btn"
        disabled={disabled || pending.length === 0}
        title={
          pending.length === 0
            ? 'Every element on this card already scales.'
            : `Set scaling to "scale" on ${pending.length} element${pending.length === 1 ? '' : 's'}.`
        }
        onClick={apply}
      >
        Apply scaling to all
      </button>
      {notice ? (
        <span className="gs-error" role="alert">
          {notice}
        </span>
      ) : null}
    </>
  );
}
