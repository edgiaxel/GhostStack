import { useId, useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

interface FieldChrome {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
}
function describedBy(id: string, c: FieldChrome): string | undefined {
  const ids = [c.hint && `${id}-hint`, c.error && `${id}-err`].filter(Boolean).join(' ');
  return ids || undefined;
}
function Chrome({ id, c, children }: { id: string; c: FieldChrome; children: ReactNode }): ReactNode {
  return (
    <div className="gs-kit-field">
      <label htmlFor={id} className="gs-kit-label">
        {c.label}
      </label>
      {children}
      {c.hint ? (
        <span id={`${id}-hint`} className="gs-kit-hint">
          {c.hint}
        </span>
      ) : null}
      {c.error ? (
        <span id={`${id}-err`} className="gs-error gs-kit-errtext">
          {c.error}
        </span>
      ) : null}
    </div>
  );
}

export interface FieldProps
  extends FieldChrome, Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
}
/** Labelled text input. */
export function Field({ label, hint, error, value, onChange, className, ...rest }: FieldProps): ReactNode {
  const id = useId();
  return (
    <Chrome id={id} c={{ label, hint, error }}>
      <input
        {...rest}
        id={id}
        className={['gs-input', className].filter(Boolean).join(' ')}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, { label, hint, error })}
        onChange={(e) => onChange(e.target.value)}
      />
    </Chrome>
  );
}

export interface NumberFieldProps extends FieldChrome {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
}
/** Numeric input. Keeps what the user types, commits only valid in-range numbers, reports the rest inline. */
export function NumberField({
  label,
  hint,
  error,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  disabled,
}: NumberFieldProps): ReactNode {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? String(value);
  let problem = error;
  if (!problem && draft !== null) {
    const n = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(n)) problem = 'Enter a number.';
    else if (min !== undefined && n < min) problem = `Must be at least ${min}.`;
    else if (max !== undefined && n > max) problem = `Must be at most ${max}.`;
  }
  const c = { label: unit ? `${label} (${unit})` : label, hint, error: problem };
  return (
    <Chrome id={id} c={c}>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        className="gs-input"
        value={text}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-invalid={problem ? true : undefined}
        aria-describedby={describedBy(id, c)}
        onChange={(e) => {
          const raw = e.target.value;
          const n = Number(raw);
          const ok =
            raw.trim() !== '' &&
            Number.isFinite(n) &&
            (min === undefined || n >= min) &&
            (max === undefined || n <= max);
          if (ok) {
            setDraft(null);
            onChange(n);
          } else setDraft(raw);
        }}
        onBlur={() => setDraft(null)}
      />
    </Chrome>
  );
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}
export interface SelectProps extends FieldChrome {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}
export function Select({ label, hint, error, value, options, onChange, disabled }: SelectProps): ReactNode {
  const id = useId();
  return (
    <Chrome id={id} c={{ label, hint, error }}>
      <select
        id={id}
        className="gs-input"
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, { label, hint, error })}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </Chrome>
  );
}
