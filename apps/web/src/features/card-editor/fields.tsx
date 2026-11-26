import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Field, IconButton, NumberField as KitNumberField, Select, Swatch } from '../../components';
import { MIXED, withHint } from './inspector-model';
import type { Shared } from './inspector-model';
import './inspector.css';

/** Returns an error message when the value was rejected, undefined when it was applied. */
export type Commit<T> = (value: T) => string | undefined;

const MIXED_TEXT = 'Mixed';

function useCommitError(label: string): {
  error: string | undefined;
  run: <T>(commit: Commit<T>, value: T) => void;
  clear: () => void;
} {
  const [error, setError] = useState<string | undefined>();
  return {
    error,
    run: (commit, value) => {
      const message = commit(value);
      setError(message === undefined ? undefined : withHint(label, message));
    },
    clear: () => setError(undefined),
  };
}

export function TextField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: Shared<string>;
  onCommit: Commit<string>;
}): ReactNode {
  const [draft, setDraft] = useState<string | undefined>();
  const e = useCommitError(label);
  return (
    <Field
      label={label}
      value={draft ?? (value === MIXED ? '' : value)}
      placeholder={value === MIXED ? MIXED_TEXT : undefined}
      error={e.error}
      onBlur={() => {
        setDraft(undefined);
        e.clear();
      }}
      onChange={(v) => {
        setDraft(v);
        e.run(onCommit, v);
      }}
    />
  );
}

export function TextArea({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: Shared<string>;
  onCommit: Commit<string>;
}): ReactNode {
  const id = useId();
  const [draft, setDraft] = useState<string | undefined>();
  const e = useCommitError(label);
  return (
    <div className="gs-kit-field">
      <label htmlFor={id} className="gs-kit-label">
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        className="gs-input"
        value={draft ?? (value === MIXED ? '' : value)}
        placeholder={value === MIXED ? MIXED_TEXT : undefined}
        aria-invalid={e.error ? true : undefined}
        onBlur={() => {
          setDraft(undefined);
          e.clear();
        }}
        onChange={(ev) => {
          setDraft(ev.target.value);
          e.run(onCommit, ev.target.value);
        }}
      />
      {e.error ? <span className="gs-error gs-kit-errtext">{e.error}</span> : null}
    </div>
  );
}

export function NumField({
  label,
  value,
  onCommit,
  min,
  max,
  step = 1,
  unit,
  hint,
}: {
  label: string;
  value: Shared<number>;
  onCommit: Commit<number>;
  min?: number | undefined;
  max?: number | undefined;
  step?: number;
  unit?: string;
  hint?: string | undefined;
}): ReactNode {
  const e = useCommitError(label);
  const id = useId();
  const clamp = (n: number): number => {
    const lo = min ?? -Infinity;
    const hi = max ?? Infinity;
    return Math.min(hi, Math.max(lo, Math.round(n * 1000) / 1000));
  };
  const bump = (dir: 1 | -1): void => {
    const base = value === MIXED ? 0 : value;
    e.run(onCommit, clamp(base + dir * step));
  };
  return (
    <div className="gs-ci-num">
      <div className="gs-ci-num-main">
        {value === MIXED ? (
          <div className="gs-kit-field">
            <label htmlFor={id} className="gs-kit-label">
              {label}
            </label>
            <input
              id={id}
              type="number"
              className="gs-input"
              placeholder={MIXED_TEXT}
              min={min}
              max={max}
              step={step}
              onChange={(ev) => {
                const n = Number(ev.target.value);
                if (ev.target.value.trim() !== '' && Number.isFinite(n)) e.run(onCommit, n);
              }}
            />
            {e.error ? <span className="gs-error gs-kit-errtext">{e.error}</span> : null}
          </div>
        ) : (
          <KitNumberField
            label={label}
            value={value}
            step={step}
            {...(min !== undefined ? { min } : {})}
            {...(max !== undefined ? { max } : {})}
            {...(hint ? { hint } : {})}
            {...(e.error ? { error: e.error } : {})}
            onChange={(n) => e.run(onCommit, n)}
          />
        )}
      </div>
      <div className="gs-ci-num-side">
        <Button
          aria-label={`Decrease ${label}`}
          title={`Decrease ${label}`}
          className="gs-kit-iconbtn"
          onClick={() => bump(-1)}
        >
          {'\u2212'}
        </Button>
        <IconButton icon="plus" label={`Increase ${label}`} onClick={() => bump(1)} />
        {unit ? (
          <span className="gs-ci-unit" aria-hidden="true">
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function SelectField({
  label,
  value,
  options,
  onCommit,
  hint,
}: {
  label: string;
  value: Shared<string>;
  options: { value: string; text: string }[];
  onCommit: Commit<string>;
  hint?: string | undefined;
}): ReactNode {
  const e = useCommitError(label);
  const list = [
    ...(value === MIXED ? [{ value: '\u0000mixed', label: MIXED_TEXT, disabled: true }] : []),
    ...(value !== MIXED && !options.some((o) => o.value === value) ? [{ value, label: value }] : []),
    ...options.map((o) => ({ value: o.value, label: o.text })),
  ];
  return (
    <Select
      label={label}
      value={value === MIXED ? '\u0000mixed' : value}
      options={list}
      hint={hint}
      error={e.error}
      onChange={(v) => e.run(onCommit, v)}
    />
  );
}

export function CheckField({
  label,
  checked,
  onCommit,
}: {
  label: string;
  checked: Shared<boolean>;
  onCommit: Commit<boolean>;
}): ReactNode {
  const e = useCommitError(label);
  return (
    <div className="gs-ci-check">
      <label className="gs-ci-check-label">
        <input
          type="checkbox"
          checked={checked === true}
          ref={(el) => {
            if (el) el.indeterminate = checked === MIXED;
          }}
          onChange={(ev) => e.run(onCommit, ev.target.checked)}
        />
        <span>{label}</span>
        {checked === MIXED ? <span className="gs-ci-mixed"> (mixed)</span> : null}
      </label>
      {e.error ? <span className="gs-error gs-kit-errtext">{e.error}</span> : null}
    </div>
  );
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const TOKEN_SWATCHES: { token: string; label: string }[] = [
  { token: '--gs-accent', label: 'Accent' },
  { token: '--gs-accent-2', label: 'Secondary accent' },
  { token: '--gs-text', label: 'Text' },
  { token: '--gs-bg', label: 'Background' },
  { token: '--gs-danger', label: 'Danger' },
  { token: '--gs-success', label: 'Success' },
  { token: '--gs-warning', label: 'Warning' },
  { token: '--gs-info', label: 'Info' },
];
const FIXED_SWATCHES = [
  { color: '#000000', label: 'Black' },
  { color: '#ffffff', label: 'White' },
  { color: 'transparent', label: 'Transparent' },
];

/** Swatches resolved to hex from the current theme tokens, plus black, white and transparent. */
export function colorChoices(): { color: string; label: string }[] {
  const out: { color: string; label: string }[] = [];
  if (typeof document !== 'undefined') {
    const style = getComputedStyle(document.documentElement);
    for (const t of TOKEN_SWATCHES) {
      const v = style.getPropertyValue(t.token).trim();
      if (HEX6.test(v)) out.push({ color: v.toLowerCase(), label: t.label });
    }
  }
  return [...out, ...FIXED_SWATCHES];
}

export function ColorField({
  label,
  value,
  fallback,
  onCommit,
  onReset,
}: {
  label: string;
  value: Shared<string | undefined>;
  fallback: string;
  onCommit: Commit<string>;
  onReset: () => string | undefined;
}): ReactNode {
  const id = useId();
  const [draft, setDraft] = useState<string | undefined>();
  const e = useCommitError(label);
  const mixed = value === MIXED;
  const shown = draft ?? (mixed ? '' : (value ?? fallback));
  return (
    <div className="gs-kit-field gs-ci-colorfield" role="group" aria-label={`${label} options`}>
      <label htmlFor={id} className="gs-kit-label">
        {label}
      </label>
      <div className="gs-ci-swatches">
        {colorChoices().map((c) => (
          <Swatch
            key={c.label}
            color={c.color}
            label={`${label}: ${c.label}`}
            selected={!mixed && shown.toLowerCase() === c.color}
            onSelect={() => {
              setDraft(undefined);
              e.run(onCommit, c.color);
            }}
          />
        ))}
      </div>
      <div className="gs-ci-color">
        <input
          id={id}
          className="gs-input"
          value={shown}
          placeholder={mixed ? MIXED_TEXT : undefined}
          aria-invalid={e.error ? true : undefined}
          onBlur={() => {
            setDraft(undefined);
            e.clear();
          }}
          onChange={(ev) => {
            setDraft(ev.target.value);
            e.run(onCommit, ev.target.value);
          }}
        />
        <input
          type="color"
          aria-label={`${label} picker`}
          value={HEX6.test(shown) ? shown : '#000000'}
          onChange={(ev) => {
            setDraft(undefined);
            e.run(onCommit, ev.target.value);
          }}
        />
        {value === MIXED || value !== undefined ? (
          <Button
            type="button"
            onClick={() => {
              setDraft(undefined);
              const message = onReset();
              if (message !== undefined) e.run(() => message, undefined);
              else e.clear();
            }}
          >
            Default
          </Button>
        ) : null}
      </div>
      {e.error ? (
        <span className="gs-error gs-kit-errtext" role="alert">
          {e.error}
        </span>
      ) : null}
    </div>
  );
}
