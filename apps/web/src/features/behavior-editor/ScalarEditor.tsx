import { useState } from 'react';
import type { ReactNode } from 'react';
import type { StateValue } from '@ghoststack/shared-contracts';

/** Edits one text, number or true / false value. Used by expressions and list items. */
export function ScalarEditor({
  value,
  onChange,
  label,
  typing,
}: {
  value: StateValue;
  onChange: (v: StateValue) => void;
  label: string;
  /** Called before a change that comes from typing, so it joins one undo step. */
  typing?: () => void;
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
            typing?.();
            if (type === 'string') return onChange(text);
            if (text.trim() !== '' && Number.isFinite(Number(text))) onChange(Number(text));
          }}
        />
      )}
    </span>
  );
}
