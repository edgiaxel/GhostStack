import type { ReactNode } from 'react';

export interface SwatchProps {
  /** Any CSS color, usually a hex value or a `var(--gs-*)` token. */
  color: string;
  label: string;
  selected?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
}
/** Color choice. A toggle button; the label is the accessible name. */
export function Swatch({ color, label, selected = false, onSelect, disabled }: SwatchProps): ReactNode {
  return (
    <button
      type="button"
      className="gs-kit-swatch"
      aria-label={label}
      aria-pressed={selected}
      title={label}
      disabled={disabled}
      onClick={onSelect}
    >
      <span className="gs-kit-swatchfill" style={{ background: color }} />
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }): ReactNode {
  return <kbd className="gs-kit-kbd">{children}</kbd>;
}
