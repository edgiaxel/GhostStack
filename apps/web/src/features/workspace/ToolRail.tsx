import type { ReactNode } from 'react';
import type { ElementType } from '@ghoststack/shared-contracts';
import { shortcutKeys } from './shortcuts';
import type { ShortcutId } from './shortcuts';

export type Tool = 'select' | 'hand';

const PATHS: Record<string, string> = {
  select: 'M5 3l14 8-6 2 4 7-3 1.5-4-7-5 4z',
  hand: 'M8 12V5.5a1.5 1.5 0 013 0V11m0-5.5a1.5 1.5 0 013 0V11m0-4a1.5 1.5 0 013 0v8a6 6 0 01-6 6h-1a6 6 0 01-5-3l-3-5a1.5 1.5 0 012.5-1.5L8 15',
  text: 'M5 6V4h14v2M12 4v16M9 20h6',
  button: 'M3 8h18v8H3zM8 12h8',
  input: 'M3 8h18v8H3zM7 11v2',
  image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5v.01',
  shape: 'M4 4h10v10H4zM14 10a5 5 0 105 5',
  line: 'M5 19L19 5',
};

function ToolIcon({ name }: { name: string }): ReactNode {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

const ELEMENT_TOOLS: { type: ElementType; label: string; shortcut: ShortcutId }[] = [
  { type: 'text', label: 'Add text', shortcut: 'tool-text' },
  { type: 'button', label: 'Add button', shortcut: 'tool-button' },
  { type: 'input', label: 'Add input', shortcut: 'tool-input' },
  { type: 'image', label: 'Add image', shortcut: 'tool-image' },
  { type: 'shape', label: 'Add shape', shortcut: 'tool-shape' },
  { type: 'line', label: 'Add line', shortcut: 'tool-line' },
];

export interface ToolRailProps {
  tool: Tool;
  onTool: (tool: Tool) => void;
  onInsert: (type: ElementType) => void;
  /** False when elements cannot be added (viewport is not the design size). */
  canInsert: boolean;
}

/** Vertical tool rail. Select and Hand are modes; the element tools each add one element and return to Select. */
export function ToolRail({ tool, onTool, onInsert, canInsert }: ToolRailProps): ReactNode {
  const cls = 'gs-btn gs-kit-btn gs-kit-btn--ghost gs-kit-iconbtn gs-ws-tool';
  return (
    <div role="toolbar" aria-orientation="vertical" aria-label="Tools" className="gs-ws-rail">
      <button
        type="button"
        className={cls}
        aria-label="Select tool"
        aria-pressed={tool === 'select'}
        title={`Select (${shortcutKeys('tool-select')})`}
        onClick={() => onTool('select')}
      >
        <ToolIcon name="select" />
      </button>
      <button
        type="button"
        className={cls}
        aria-label="Hand tool"
        aria-pressed={tool === 'hand'}
        title={`Hand, drag to pan (${shortcutKeys('tool-hand')})`}
        onClick={() => onTool('hand')}
      >
        <ToolIcon name="hand" />
      </button>
      <hr className="gs-ws-railsep" />
      {ELEMENT_TOOLS.map((t) => (
        <button
          key={t.type}
          type="button"
          className={cls}
          aria-label={t.label}
          disabled={!canInsert}
          title={`${t.label} (${shortcutKeys(t.shortcut)})`}
          onClick={() => onInsert(t.type)}
        >
          <ToolIcon name={t.type} />
        </button>
      ))}
    </div>
  );
}
