import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ActionNode, Behavior, ElementType, Expr, StateValue } from '@ghoststack/shared-contracts';
import {
  ACTION_LABELS,
  OPERATORS,
  TRIGGER_LABELS,
  allowedTriggers,
  defaultAction,
  defaultExpr,
  lit,
  moveItem,
  removeAt,
  replaceAt,
} from './model';
import type { EditorContext } from './model';

const KIND_LABELS = {
  literal: 'Value',
  state: 'Variable',
  not: 'Not',
  binary: 'Compare / calculate',
} as const;

function LiteralEditor({
  value,
  onChange,
  ctx,
  label,
}: {
  value: StateValue;
  onChange: (v: StateValue) => void;
  ctx: EditorContext;
  label: string;
}): ReactNode {
  const [draft, setDraft] = useState<string | undefined>();
  const type = typeof value;
  const retype = (next: string): void => {
    setDraft(undefined);
    onChange(next === 'number' ? 0 : next === 'boolean' ? true : '');
  };
  return (
    <span className="gs-beh-inline">
      <select
        className="gs-input"
        aria-label={`${label} type`}
        value={type}
        onChange={(e) => retype(e.target.value)}
      >
        <option value="string">text</option>
        <option value="number">number</option>
        <option value="boolean">true / false</option>
      </select>
      {type === 'boolean' ? (
        <select
          className="gs-input"
          aria-label={label}
          value={String(value)}
          onChange={(e) => onChange(e.target.value === 'true')}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <input
          className="gs-input"
          aria-label={label}
          inputMode={type === 'number' ? 'decimal' : undefined}
          value={draft ?? String(value)}
          onBlur={() => setDraft(undefined)}
          onChange={(e) => {
            const text = e.target.value;
            setDraft(text);
            ctx.typing();
            if (type === 'string') return onChange(text);
            if (text.trim() !== '' && Number.isFinite(Number(text))) onChange(Number(text));
          }}
        />
      )}
    </span>
  );
}

export function ExprEditor({
  value,
  onChange,
  ctx,
  label,
}: {
  value: Expr;
  onChange: (e: Expr) => void;
  ctx: EditorContext;
  label: string;
}): ReactNode {
  const kinds: Expr['kind'][] =
    ctx.stateKeys.length > 0 ? ['literal', 'state', 'not', 'binary'] : ['literal', 'not', 'binary'];
  return (
    <span className="gs-beh-expr">
      <select
        className="gs-input"
        aria-label={`${label} kind`}
        value={value.kind}
        onChange={(e) => onChange(defaultExpr(e.target.value as Expr['kind'], ctx.stateKeys, value))}
      >
        {(kinds.includes(value.kind) ? kinds : [value.kind, ...kinds]).map((k) => (
          <option key={k} value={k}>
            {KIND_LABELS[k]}
          </option>
        ))}
      </select>
      {value.kind === 'literal' ? (
        <LiteralEditor value={value.value} ctx={ctx} label={label} onChange={(v) => onChange(lit(v))} />
      ) : null}
      {value.kind === 'state' ? (
        <select
          className="gs-input"
          aria-label={`${label} variable`}
          value={value.key}
          onChange={(e) => onChange({ kind: 'state', key: e.target.value })}
        >
          {ctx.stateKeys.includes(value.key) ? null : (
            <option value={value.key}>{value.key || '(none)'}</option>
          )}
          {ctx.stateKeys.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      ) : null}
      {value.kind === 'not' ? (
        <span className="gs-beh-nested">
          <ExprEditor
            value={value.arg}
            ctx={ctx}
            label={`${label} operand`}
            onChange={(arg) => onChange({ kind: 'not', arg })}
          />
        </span>
      ) : null}
      {value.kind === 'binary' ? (
        <span className="gs-beh-nested">
          <ExprEditor
            value={value.left}
            ctx={ctx}
            label={`${label} left`}
            onChange={(left) => onChange({ ...value, left })}
          />
          <select
            className="gs-input"
            aria-label={`${label} operator`}
            value={value.op}
            onChange={(e) => onChange({ ...value, op: e.target.value as typeof value.op })}
          >
            {OPERATORS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          <ExprEditor
            value={value.right}
            ctx={ctx}
            label={`${label} right`}
            onChange={(right) => onChange({ ...value, right })}
          />
        </span>
      ) : null}
    </span>
  );
}

function Pick({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; text: string }[];
  onChange: (v: string) => void;
}): ReactNode {
  return (
    <select className="gs-input" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.some((o) => o.id === value) ? null : (
        <option value={value}>{value ? `${value} (missing)` : '(choose)'}</option>
      )}
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.text}
        </option>
      ))}
    </select>
  );
}

function ActionEditor({
  action,
  onChange,
  ctx,
  label,
}: {
  action: ActionNode;
  onChange: (a: ActionNode) => void;
  ctx: EditorContext;
  label: string;
}): ReactNode {
  const textEls = ctx.elements.filter((e) => e.type === 'text' || e.type === 'button');
  const elOptions = (list: { id: string; name: string }[]): { id: string; text: string }[] =>
    list.map((e) => ({ id: e.id, text: e.name || e.id }));
  switch (action.type) {
    case 'navigate':
      return (
        <Pick
          label={`${label} card`}
          value={action.cardId}
          options={ctx.cards.map((c) => ({ id: c.id, text: c.title || c.id }))}
          onChange={(cardId) => onChange({ ...action, cardId })}
        />
      );
    case 'setState':
      return (
        <>
          <Pick
            label={`${label} variable`}
            value={action.key}
            options={ctx.stateKeys.map((k) => ({ id: k, text: k }))}
            onChange={(key) => onChange({ ...action, key })}
          />
          <span>=</span>
          <ExprEditor
            value={action.value}
            ctx={ctx}
            label={`${label} value`}
            onChange={(value) => onChange({ ...action, value })}
          />
        </>
      );
    case 'setText':
      return (
        <>
          <Pick
            label={`${label} element`}
            value={action.elementId}
            options={elOptions(textEls)}
            onChange={(elementId) => onChange({ ...action, elementId })}
          />
          <span>=</span>
          <ExprEditor
            value={action.value}
            ctx={ctx}
            label={`${label} text`}
            onChange={(value) => onChange({ ...action, value })}
          />
        </>
      );
    case 'show':
    case 'hide':
      return (
        <Pick
          label={`${label} element`}
          value={action.elementId}
          options={elOptions(ctx.elements)}
          onChange={(elementId) => onChange({ ...action, elementId })}
        />
      );
    case 'if':
      return (
        <span className="gs-beh-if">
          <ExprEditor
            value={action.condition}
            ctx={ctx}
            label={`${label} condition`}
            onChange={(condition) => onChange({ ...action, condition })}
          />
          <div className="gs-beh-branch">
            <p className="gs-panel-title">Then</p>
            <ActionList
              actions={action.then}
              ctx={ctx}
              label={`${label} then`}
              onChange={(then) => onChange({ ...action, then })}
            />
          </div>
          <div className="gs-beh-branch">
            <p className="gs-panel-title">Else</p>
            <ActionList
              actions={action.else}
              ctx={ctx}
              label={`${label} else`}
              onChange={(els) => onChange({ ...action, else: els })}
            />
          </div>
        </span>
      );
  }
}

export function ActionList({
  actions,
  onChange,
  ctx,
  label,
}: {
  actions: ActionNode[];
  onChange: (a: ActionNode[]) => void;
  ctx: EditorContext;
  label: string;
}): ReactNode {
  return (
    <div className="gs-beh-actions">
      {actions.length === 0 ? <p className="gs-beh-hint">No actions yet. Add one below.</p> : null}
      {actions.map((a, i) => {
        const name = `${label} action ${i + 1}`;
        return (
          <div key={i} className="gs-beh-row">
            <strong>{ACTION_LABELS[a.type]}</strong>
            <ActionEditor
              action={a}
              ctx={ctx}
              label={name}
              onChange={(next) => onChange(replaceAt(actions, i, next))}
            />
            <span className="gs-beh-tools">
              <button
                type="button"
                className="gs-btn"
                aria-label={`Move ${name} up`}
                disabled={i === 0}
                onClick={() => onChange(moveItem(actions, i, -1))}
              >
                Up
              </button>
              <button
                type="button"
                className="gs-btn"
                aria-label={`Move ${name} down`}
                disabled={i === actions.length - 1}
                onClick={() => onChange(moveItem(actions, i, 1))}
              >
                Down
              </button>
              <button
                type="button"
                className="gs-btn gs-btn--danger"
                aria-label={`Remove ${name}`}
                onClick={() => onChange(removeAt(actions, i))}
              >
                Remove
              </button>
            </span>
          </div>
        );
      })}
      <select
        className="gs-input"
        aria-label={`Add action to ${label}`}
        value=""
        onChange={(e) => {
          if (e.target.value)
            onChange([...actions, defaultAction(e.target.value as ActionNode['type'], ctx)]);
        }}
      >
        <option value="">Add action…</option>
        {(Object.keys(ACTION_LABELS) as ActionNode['type'][]).map((t) => (
          <option key={t} value={t}>
            {ACTION_LABELS[t]}
          </option>
        ))}
      </select>
    </div>
  );
}

export function BehaviorBlocks({
  behaviors,
  ownerType,
  ctx,
  onChange,
  newId,
}: {
  behaviors: Behavior[];
  ownerType: ElementType | 'card';
  ctx: EditorContext;
  onChange: (next: Behavior[]) => void;
  newId: () => string;
}): ReactNode {
  const triggers = allowedTriggers(ownerType);
  return (
    <div className="gs-beh-blocks">
      {behaviors.length === 0 ? (
        <p className="gs-empty">
          No behaviors yet. Add one to make this {ownerType === 'card' ? 'card' : 'element'} do something.
        </p>
      ) : null}
      {behaviors.map((b, i) => {
        const name = `Behavior ${i + 1}`;
        const set = (patch: Partial<Behavior>): void => onChange(replaceAt(behaviors, i, { ...b, ...patch }));
        return (
          <section key={b.behaviorId} className="gs-beh-block" aria-label={name}>
            <div className="gs-beh-head">
              <select
                className="gs-input"
                aria-label={`${name} trigger`}
                value={b.trigger}
                onChange={(e) => set({ trigger: e.target.value as Behavior['trigger'] })}
              >
                {(triggers.includes(b.trigger) ? triggers : [b.trigger, ...triggers]).map((t) => (
                  <option key={t} value={t}>
                    {TRIGGER_LABELS[t]}
                  </option>
                ))}
              </select>
              <label>
                <input
                  type="checkbox"
                  checked={b.enabled}
                  onChange={(e) => set({ enabled: e.target.checked })}
                />{' '}
                Enabled
              </label>
              <span className="gs-beh-tools">
                <button
                  type="button"
                  className="gs-btn"
                  aria-label={`Move ${name} up`}
                  disabled={i === 0}
                  onClick={() => onChange(moveItem(behaviors, i, -1))}
                >
                  Up
                </button>
                <button
                  type="button"
                  className="gs-btn"
                  aria-label={`Move ${name} down`}
                  disabled={i === behaviors.length - 1}
                  onClick={() => onChange(moveItem(behaviors, i, 1))}
                >
                  Down
                </button>
                <button
                  type="button"
                  className="gs-btn gs-btn--danger"
                  aria-label={`Remove ${name}`}
                  onClick={() => onChange(removeAt(behaviors, i))}
                >
                  Remove
                </button>
              </span>
            </div>
            <div className="gs-beh-conds">
              <p className="gs-panel-title">Only when all are true</p>
              {b.conditions.map((c, ci) => (
                <div key={ci} className="gs-beh-row">
                  <ExprEditor
                    value={c}
                    ctx={ctx}
                    label={`${name} condition ${ci + 1}`}
                    onChange={(next) => set({ conditions: replaceAt(b.conditions, ci, next) })}
                  />
                  <button
                    type="button"
                    className="gs-btn gs-btn--danger"
                    aria-label={`Remove ${name} condition ${ci + 1}`}
                    onClick={() => set({ conditions: removeAt(b.conditions, ci) })}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="gs-btn"
                onClick={() => set({ conditions: [...b.conditions, lit(true)] })}
                aria-label={`Add condition to ${name}`}
              >
                Add condition
              </button>
            </div>
            <p className="gs-panel-title">Do this</p>
            <ActionList actions={b.actions} ctx={ctx} label={name} onChange={(actions) => set({ actions })} />
          </section>
        );
      })}
      <button
        type="button"
        className="gs-btn gs-btn--primary"
        onClick={() =>
          onChange([
            ...behaviors,
            {
              behaviorId: newId(),
              trigger: triggers[0] as Behavior['trigger'],
              conditions: [],
              actions: [],
              enabled: true,
            },
          ])
        }
      >
        Add behavior
      </button>
    </div>
  );
}
