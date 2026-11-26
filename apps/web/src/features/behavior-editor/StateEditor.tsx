import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ListValue, StateValue, StateVariable } from '@ghoststack/shared-contracts';
import { ScalarEditor } from './ScalarEditor';

type Schema = Record<string, StateVariable>;
const initialFor = (type: StateVariable['type']): StateValue | ListValue =>
  type === 'number' ? 0 : type === 'boolean' ? false : type === 'list' ? [] : '';
const MAX_ITEMS = 1000;

function InitialInput({
  variable,
  label,
  onChange,
}: {
  variable: StateVariable;
  label: string;
  onChange: (v: StateValue) => void;
}): ReactNode {
  const [draft, setDraft] = useState<string | undefined>();
  if (variable.type === 'boolean') {
    return (
      <select
        className="gs-input"
        aria-label={label}
        value={String(variable.initial)}
        onChange={(e) => onChange(e.target.value === 'true')}
      >
        <option value="false">false</option>
        <option value="true">true</option>
      </select>
    );
  }
  return (
    <input
      className="gs-input"
      aria-label={label}
      value={draft ?? String(variable.initial)}
      onBlur={() => setDraft(undefined)}
      onChange={(e) => {
        setDraft(e.target.value);
        if (variable.type === 'string') onChange(e.target.value);
        else if (e.target.value.trim() !== '' && Number.isFinite(Number(e.target.value)))
          onChange(Number(e.target.value));
      }}
    />
  );
}

/** The starting items of a list variable: add, edit and remove. */
function ListItems({
  name,
  items,
  onChange,
}: {
  name: string;
  items: ListValue;
  onChange: (next: ListValue) => void;
}): ReactNode {
  return (
    <div className="gs-beh-list-items" role="group" aria-label={`${name} starting items`}>
      {items.length === 0 ? <p className="gs-beh-hint">Starts empty.</p> : null}
      {items.map((item, i) => (
        <div key={i} className="gs-beh-row">
          <span>{i}</span>
          <ScalarEditor
            value={item}
            label={`${name} item ${i}`}
            onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))}
          />
          <button
            type="button"
            className="gs-btn gs-btn--danger"
            aria-label={`Remove ${name} item ${i}`}
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="gs-btn"
        aria-label={`Add item to ${name}`}
        disabled={items.length >= MAX_ITEMS}
        onClick={() => onChange([...items, ''])}
      >
        Add item
      </button>
      {items.length >= MAX_ITEMS ? (
        <span className="gs-error">A list holds at most {MAX_ITEMS} items.</span>
      ) : null}
    </div>
  );
}

/** Declares the application state variables behaviors can read and write. */
export function StateEditor({
  schema,
  onChange,
}: {
  schema: Schema;
  onChange: (next: Schema) => void;
}): ReactNode {
  const [name, setName] = useState('');
  const [type, setType] = useState<StateVariable['type']>('number');
  const trimmed = name.trim();
  const taken = trimmed in schema;
  return (
    <div className="gs-beh-blocks">
      {Object.keys(schema).length === 0 ? (
        <p className="gs-empty">No variables yet. Add one to remember a score, a name or a flag.</p>
      ) : null}
      {Object.entries(schema).map(([key, variable]) => (
        <div key={key} className="gs-beh-row">
          <strong>{key}</strong>
          <select
            className="gs-input"
            aria-label={`${key} type`}
            value={variable.type}
            onChange={(e) => {
              const t = e.target.value as StateVariable['type'];
              onChange({ ...schema, [key]: { type: t, initial: initialFor(t) } });
            }}
          >
            <option value="number">number</option>
            <option value="string">text</option>
            <option value="boolean">true / false</option>
            <option value="list">list</option>
          </select>
          {variable.type === 'list' ? null : (
            <InitialInput
              variable={variable}
              label={`${key} starting value`}
              onChange={(initial) => onChange({ ...schema, [key]: { ...variable, initial } })}
            />
          )}
          <button
            type="button"
            className="gs-btn gs-btn--danger"
            aria-label={`Delete variable ${key}`}
            onClick={() => {
              const { [key]: _gone, ...rest } = schema;
              void _gone;
              onChange(rest);
            }}
          >
            Delete
          </button>
          {variable.type === 'list' && Array.isArray(variable.initial) ? (
            <ListItems
              name={key}
              items={variable.initial}
              onChange={(initial) => onChange({ ...schema, [key]: { type: 'list', initial } })}
            />
          ) : null}
        </div>
      ))}
      <form
        className="gs-beh-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!trimmed || taken) return;
          onChange({ ...schema, [trimmed]: { type, initial: initialFor(type) } });
          setName('');
        }}
      >
        <label>
          <span className="gs-panel-title">New variable</span>
          <input className="gs-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <select
          className="gs-input"
          aria-label="New variable type"
          value={type}
          onChange={(e) => setType(e.target.value as StateVariable['type'])}
        >
          <option value="number">number</option>
          <option value="string">text</option>
          <option value="boolean">true / false</option>
          <option value="list">list</option>
        </select>
        <button type="submit" className="gs-btn gs-btn--primary" disabled={!trimmed || taken}>
          Add variable
        </button>
        {taken ? <span className="gs-error">A variable named "{trimmed}" already exists.</span> : null}
      </form>
    </div>
  );
}
