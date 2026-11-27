import { useId, useMemo } from 'react';
import type { ReactNode } from 'react';
import { buildContext } from '@ghoststack/ai-core';
import type { ContextScope, Stack } from '@ghoststack/shared-contracts';
import { Button, Select } from '../../components';
import type { OperationDraft } from './operation';
import type { ProviderState } from './store';
export function scopeOf(draft: OperationDraft, cardId: string): ContextScope {
  return draft.scopeKind === 'stack' ? { kind: 'stack' } : { kind: 'card', cardId };
}
export interface PromptViewProps {
  stack: Stack;
  cardId: string;
  draft: OperationDraft;
  provider: ProviderState;
  busy: boolean;
  onDraft(patch: Partial<OperationDraft>): void;
  onSubmit(): void;
  onOpenSettings(): void;
}
/** Where the request goes, in words. */
export function destinationText(provider: ProviderState): string {
  const d = provider.description;
  if (!d) return 'No provider is configured.';
  if (d.kind === 'demo') return 'Built-in demo provider on this computer. Nothing leaves it.';
  const where = d.baseUrl ? ` at ${d.baseUrl}` : '';
  return d.locality === 'local'
    ? `${d.label}${where}, on this computer.`
    : `${d.label}${where}. This is a remote server: the data below travels over the network.`;
}
/** Prompt box, scope selector and the exact context that will be sent. */
export function PromptView({
  stack,
  cardId,
  draft,
  provider,
  busy,
  onDraft,
  onSubmit,
  onOpenSettings,
}: PromptViewProps): ReactNode {
  const promptId = useId();
  const scope = scopeOf(draft, cardId);
  const context = useMemo(() => buildContext(stack, scope), [stack, draft.scopeKind, cardId]); // eslint-disable-line react-hooks/exhaustive-deps
  const card = stack.cards[cardId];
  const ready = provider.settings !== undefined && provider.description !== undefined;
  const empty = draft.prompt.trim() === '';
  return (
    <form
      className="gs-ai-stack"
      aria-label="Ask for a change"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !empty && !busy) onSubmit();
      }}
    >
      <div className="gs-kit-field">
        <label htmlFor={promptId} className="gs-kit-label">
          Describe the change
        </label>
        <textarea
          id={promptId}
          className="gs-input"
          value={draft.prompt}
          maxLength={4000}
          placeholder="For example: add a quiz question about space with three answers"
          onChange={(e) => onDraft({ prompt: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && ready && !empty && !busy) {
              e.preventDefault();
              onSubmit();
            }
          }}
        />
        <span className="gs-kit-hint">
          Press Ctrl+Enter to send. You review every change before it is applied.
        </span>
      </div>
      <Select
        label="Scope"
        value={draft.scopeKind}
        onChange={(v) => onDraft({ scopeKind: v === 'stack' ? 'stack' : 'card' })}
        options={[
          { value: 'card', label: `Selected card: ${card?.title ?? 'none'}` },
          { value: 'stack', label: 'Whole project' },
        ]}
      />
      <section className="gs-ai-card" aria-label="What will be sent" data-testid="ai-context">
        <h4>What will be sent</h4>
        <p className="gs-ai-muted">{destinationText(provider)}</p>
        {context.ok ? (
          <>
            <ul className="gs-ai-list">
              <li>Your request.</li>
              <li>Project title and the state variables.</li>
              <li>
                {context.value.cards.length} {context.value.cards.length === 1 ? 'card' : 'cards'} with titles
                and element counts.
              </li>
              <li>
                Full element detail for{' '}
                {draft.scopeKind === 'card' ? 'the selected card' : 'the cards that fit'}.
              </li>
            </ul>
            <p className="gs-ai-muted">
              About {context.value.charCount} characters
              {context.value.truncated ? ', shortened to fit the size limit' : ''}. Images and other asset
              files are never sent.
            </p>
            <details className="gs-ai-details">
              <summary>Show the exact data</summary>
              <pre className="gs-ai-code" tabIndex={0} aria-label="Exact data that will be sent">
                {JSON.stringify(context.value, null, 2)}
              </pre>
            </details>
          </>
        ) : (
          <p className="gs-error" role="alert">
            The context could not be prepared. Pick another scope or edit the project.
          </p>
        )}
      </section>
      <div className="gs-ai-actions">
        <Button type="submit" variant="primary" disabled={!ready || empty || busy || !context.ok}>
          Ask for a plan
        </Button>
        {!ready ? <Button onClick={onOpenSettings}>Open provider settings</Button> : null}
      </div>
    </form>
  );
}
