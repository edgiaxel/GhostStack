import { useState } from 'react';
import type { ReactNode } from 'react';

/** Returns an error message when the value was rejected, undefined when it was applied. */
export type Commit<T> = (value: T) => string | undefined;

function Shell({
  label,
  error,
  children,
}: {
  label: string;
  error: string | undefined;
  children: ReactNode;
}): ReactNode {
  return (
    <label className="gs-ci-field">
      <span>{label}</span>
      {children}
      {error ? (
        <span className="gs-error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function TextField({
  label,
  value,
  onCommit,
  multiline = false,
}: {
  label: string;
  value: string;
  onCommit: Commit<string>;
  multiline?: boolean;
}): ReactNode {
  const [draft, setDraft] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const props = {
    className: 'gs-input',
    'aria-label': label,
    value: draft ?? value,
    onBlur: () => {
      setDraft(undefined);
      setError(undefined);
    },
    onChange: (e: { target: { value: string } }) => {
      setDraft(e.target.value);
      setError(onCommit(e.target.value));
    },
  };
  return (
    <Shell label={label} error={error}>
      {multiline ? <textarea rows={3} {...props} /> : <input {...props} />}
    </Shell>
  );
}

export function NumberField({
  label,
  value,
  onCommit,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onCommit: Commit<number>;
  min?: number;
  max?: number;
  step?: number;
}): ReactNode {
  const [draft, setDraft] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  return (
    <Shell label={label} error={error}>
      <input
        className="gs-input"
        aria-label={label}
        type="number"
        inputMode="decimal"
        value={draft ?? String(value)}
        min={min}
        max={max}
        step={step}
        onBlur={() => {
          setDraft(undefined);
          setError(undefined);
        }}
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          const n = Number(text);
          if (text.trim() === '' || !Number.isFinite(n)) return setError('Enter a number.');
          setError(onCommit(n));
        }}
      />
    </Shell>
  );
}

export function SelectField({
  label,
  value,
  options,
  onCommit,
}: {
  label: string;
  value: string;
  options: { value: string; text: string }[];
  onCommit: Commit<string>;
}): ReactNode {
  const [error, setError] = useState<string | undefined>();
  return (
    <Shell label={label} error={error}>
      <select
        className="gs-input"
        aria-label={label}
        value={value}
        onChange={(e) => setError(onCommit(e.target.value))}
      >
        {options.some((o) => o.value === value) ? null : <option value={value}>{value}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.text}
          </option>
        ))}
      </select>
    </Shell>
  );
}

export function CheckField({
  label,
  checked,
  onCommit,
}: {
  label: string;
  checked: boolean;
  onCommit: Commit<boolean>;
}): ReactNode {
  const [error, setError] = useState<string | undefined>();
  return (
    <label className="gs-ci-field">
      <span>
        <input
          type="checkbox"
          aria-label={label}
          checked={checked}
          onChange={(e) => setError(onCommit(e.target.checked))}
        />{' '}
        {label}
      </span>
      {error ? (
        <span className="gs-error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;

export function ColorField({
  label,
  value,
  fallback,
  onCommit,
  onReset,
}: {
  label: string;
  value: string | undefined;
  fallback: string;
  onCommit: Commit<string>;
  onReset: () => string | undefined;
}): ReactNode {
  const [draft, setDraft] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const shown = draft ?? value ?? fallback;
  return (
    <div className="gs-ci-field">
      <span>{label}</span>
      <div className="gs-ci-color">
        <input
          className="gs-input"
          aria-label={label}
          value={shown}
          onBlur={() => {
            setDraft(undefined);
            setError(undefined);
          }}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(onCommit(e.target.value));
          }}
        />
        <input
          type="color"
          aria-label={`${label} picker`}
          value={HEX6.test(shown) ? shown : '#000000'}
          onChange={(e) => setError(onCommit(e.target.value))}
        />
        {value !== undefined ? (
          <button type="button" className="gs-btn" onClick={() => setError(onReset())}>
            Default
          </button>
        ) : null}
      </div>
      {error ? (
        <span className="gs-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
