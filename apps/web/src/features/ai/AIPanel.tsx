import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Tabs } from '../../components';
import { useServices } from '../../app/services';
import { useSessionStack } from '../../app/useStackSession';
import type { EditorSlotProps } from '../../app/editorContext';
import { BridgePairing } from './bridge';
import { ErrorPanel } from './ErrorPanel';
import { PromptView, scopeOf } from './PromptView';
import { ProposalsList } from './ProposalsList';
import { ProviderBadge } from './ProviderBadge';
import { ReviewView } from './ReviewView';
import { SettingsView } from './SettingsView';
import { ApplyingView, ConsentDialog, PlanningView, ReportView, RevertedView } from './StatusViews';
import { evaluatePlan, getOperationController, useOperation } from './operation';
import type { OperationController, OperationSnapshot } from './operation';
import { providerStore, useProviderState } from './store';
export type AIPanelProps = EditorSlotProps & { onClose(): void };
const HEADING: Record<OperationSnapshot['state']['phase'], string> = {
  idle: 'Ask for a change',
  planning: 'Waiting for a plan',
  review: 'Review the plan',
  applying: 'Applying the plan',
  done: 'Change applied',
  reverted: 'Change reverted',
};
function announce(s: OperationSnapshot['state']): string {
  switch (s.phase) {
    case 'idle':
      return s.notice ?? '';
    case 'planning':
      return 'Asking the provider for a plan.';
    case 'review':
      return `Plan ready for review with ${s.plan.steps.length} steps. Nothing has changed yet.`;
    case 'applying':
      return s.progress?.message ?? 'Applying the plan.';
    case 'done':
      return 'The change was applied. You can revert it.';
    case 'reverted':
      return 'The change was reverted.';
  }
}
function Assistant({
  session,
  cardId,
  controller,
  onOpenSettings,
}: {
  session: EditorSlotProps['session'];
  cardId: string;
  controller: OperationController;
  onOpenSettings(): void;
}): ReactNode {
  const stack = useSessionStack(session);
  const provider = useProviderState();
  const { state, draft, consentPending } = useOperation(controller);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  // Move focus to the new phase heading so keyboard and screen reader users land on the result.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [state.phase]);
  const scope = scopeOf(draft, cardId);
  const review = useMemo(
    () => (state.phase === 'review' ? evaluatePlan(stack, state.plan, new Date().toISOString()) : undefined),
    [state, stack],
  );
  const busy = state.phase === 'planning' || state.phase === 'applying';
  const redact = providerStore.redact;
  return (
    <div className="gs-ai-stack">
      <h3 className="gs-ai-heading" tabIndex={-1} ref={heading}>
        {HEADING[state.phase]}
      </h3>
      <div className="gs-ai-sr" role="status" aria-live="polite" data-testid="ai-live">
        {announce(state)}
      </div>
      {state.phase === 'idle' ? (
        <>
          {state.notice ? <p className="gs-ai-muted">{state.notice}</p> : null}
          {state.error ? (
            <ErrorPanel
              error={state.error}
              redact={redact}
              onRetry={() => void controller.submit(scope)}
              onEditRequest={() => controller.reset()}
              onOpenSettings={onOpenSettings}
              onDismiss={() => controller.reset()}
            />
          ) : null}
          <ProposalsList disabled={busy} onReview={(p) => controller.openProposal(p)} />
          <PromptView
            stack={stack}
            cardId={cardId}
            draft={draft}
            provider={provider}
            busy={busy}
            onDraft={(patch) => controller.setDraft(patch)}
            onSubmit={() => void controller.submit(scope)}
            onOpenSettings={onOpenSettings}
          />
        </>
      ) : null}
      {state.phase === 'planning' ? (
        <PlanningView provider={provider} onCancel={() => controller.cancel()} />
      ) : null}
      {state.phase === 'review' && review ? (
        <ReviewView
          plan={state.plan}
          origin={state.origin}
          evaluation={review}
          applyError={state.applyError}
          notice={state.notice}
          redact={redact}
          onApprove={() => void controller.approve()}
          onReject={() => controller.reject()}
          onRevise={() => controller.revise()}
        />
      ) : null}
      {state.phase === 'applying' ? (
        <ApplyingView progress={state.progress} onCancel={() => controller.cancel()} />
      ) : null}
      {state.phase === 'done' ? (
        <ReportView
          report={state.report}
          revertError={state.revertError}
          redact={redact}
          onRevert={() => controller.revert()}
          onReset={() => controller.reset()}
        />
      ) : null}
      {state.phase === 'reverted' ? <RevertedView onReset={() => controller.reset()} /> : null}
      <ConsentDialog
        open={consentPending}
        provider={provider}
        onConfirm={() => void controller.confirmConsent(scope)}
        onDecline={() => controller.declineConsent()}
      />
    </div>
  );
}
/** The AI assistant: provider settings, prompt, plan review, apply, report and revert. */
export function AIPanel({ session, cardId, onClose }: AIPanelProps): ReactNode {
  const services = useServices();
  const provider = useProviderState();
  const [tab, setTab] = useState<string>(provider.settings ? 'assistant' : 'provider');
  const controller = getOperationController({
    session,
    checkpoints: services.checkpoints,
    providers: providerStore,
  });
  return (
    <div className="gs-ai-panel" data-testid="ai-panel">
      <div className="gs-ai-row" data-testid="ai-provider-line">
        <ProviderBadge state={provider} />
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      <Tabs
        label="AI assistant sections"
        value={tab}
        onChange={setTab}
        tabs={[
          {
            id: 'assistant',
            label: 'Assistant',
            panel: (
              <Assistant
                session={session}
                cardId={cardId}
                controller={controller}
                onOpenSettings={() => setTab('provider')}
              />
            ),
          },
          { id: 'provider', label: 'Provider', panel: <SettingsView /> },
        ]}
      />
      <BridgePairing session={session} />
    </div>
  );
}
