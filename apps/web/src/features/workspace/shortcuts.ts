/** Every keyboard shortcut of the editor. One table drives key handling, menu hints and the shortcut sheet. */
export type ShortcutGroup = 'Editing' | 'Tools' | 'View' | 'Canvas' | 'Help';
export type ShortcutId =
  | 'undo'
  | 'redo'
  | 'save'
  | 'copy'
  | 'paste'
  | 'duplicate'
  | 'select-all'
  | 'delete'
  | 'deselect'
  | 'tool-select'
  | 'tool-hand'
  | 'tool-text'
  | 'tool-button'
  | 'tool-input'
  | 'tool-image'
  | 'tool-shape'
  | 'tool-line'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-fit'
  | 'zoom-actual'
  | 'help'
  | 'ai'
  | 'canvas-move'
  | 'canvas-move-far'
  | 'canvas-resize'
  | 'canvas-select-add'
  | 'canvas-marquee'
  | 'canvas-edit-text'
  | 'canvas-no-snap'
  | 'canvas-pan'
  | 'canvas-wheel';
export interface Shortcut {
  id: ShortcutId;
  group: ShortcutGroup;
  label: string;
  /** Text shown to the creator. */
  keys: string;
  /** Who handles the key. `shell` is matched by `matchShortcut`; the others are documented here only. */
  handledBy: 'shell' | 'history' | 'canvas';
}
export const SHORTCUTS: Shortcut[] = [
  { id: 'undo', group: 'Editing', label: 'Undo', keys: 'Ctrl+Z', handledBy: 'history' },
  { id: 'redo', group: 'Editing', label: 'Redo', keys: 'Ctrl+Shift+Z', handledBy: 'history' },
  { id: 'save', group: 'Editing', label: 'Save now', keys: 'Ctrl+S', handledBy: 'shell' },
  { id: 'copy', group: 'Editing', label: 'Copy selected elements', keys: 'Ctrl+C', handledBy: 'shell' },
  { id: 'paste', group: 'Editing', label: 'Paste elements', keys: 'Ctrl+V', handledBy: 'shell' },
  {
    id: 'duplicate',
    group: 'Editing',
    label: 'Duplicate selected elements',
    keys: 'Ctrl+D',
    handledBy: 'shell',
  },
  { id: 'select-all', group: 'Editing', label: 'Select all elements', keys: 'Ctrl+A', handledBy: 'shell' },
  { id: 'delete', group: 'Editing', label: 'Delete selected elements', keys: 'Delete', handledBy: 'shell' },
  { id: 'deselect', group: 'Editing', label: 'Clear selection', keys: 'Esc', handledBy: 'shell' },
  { id: 'tool-select', group: 'Tools', label: 'Select tool', keys: 'V', handledBy: 'shell' },
  { id: 'tool-hand', group: 'Tools', label: 'Hand tool (pan)', keys: 'H', handledBy: 'shell' },
  { id: 'tool-text', group: 'Tools', label: 'Add text', keys: 'T', handledBy: 'shell' },
  { id: 'tool-button', group: 'Tools', label: 'Add button', keys: 'B', handledBy: 'shell' },
  { id: 'tool-input', group: 'Tools', label: 'Add input', keys: 'N', handledBy: 'shell' },
  { id: 'tool-image', group: 'Tools', label: 'Add image', keys: 'P', handledBy: 'shell' },
  { id: 'tool-shape', group: 'Tools', label: 'Add shape', keys: 'S', handledBy: 'shell' },
  { id: 'tool-line', group: 'Tools', label: 'Add line', keys: 'L', handledBy: 'shell' },
  { id: 'zoom-in', group: 'View', label: 'Zoom in', keys: '+', handledBy: 'shell' },
  { id: 'zoom-out', group: 'View', label: 'Zoom out', keys: '-', handledBy: 'shell' },
  { id: 'zoom-fit', group: 'View', label: 'Fit to window', keys: '0', handledBy: 'shell' },
  { id: 'zoom-actual', group: 'View', label: 'Actual size (100%)', keys: '1', handledBy: 'shell' },
  {
    id: 'canvas-move',
    group: 'Canvas',
    label: 'Move selected elements by 1',
    keys: 'Arrow keys',
    handledBy: 'canvas',
  },
  {
    id: 'canvas-move-far',
    group: 'Canvas',
    label: 'Move selected elements by 10',
    keys: 'Shift+Arrow keys',
    handledBy: 'canvas',
  },
  {
    id: 'canvas-resize',
    group: 'Canvas',
    label: 'Resize selected element',
    keys: 'Alt+Arrow keys',
    handledBy: 'canvas',
  },
  {
    id: 'canvas-select-add',
    group: 'Canvas',
    label: 'Add or remove an element from the selection',
    keys: 'Shift+Click',
    handledBy: 'canvas',
  },
  {
    id: 'canvas-marquee',
    group: 'Canvas',
    label: 'Select by dragging a rectangle',
    keys: 'Drag on empty canvas',
    handledBy: 'canvas',
  },
  {
    id: 'canvas-edit-text',
    group: 'Canvas',
    label: 'Edit text of a text or button element',
    keys: 'F2',
    handledBy: 'canvas',
  },
  {
    id: 'canvas-no-snap',
    group: 'Canvas',
    label: 'Move without snapping',
    keys: 'Alt+Drag',
    handledBy: 'canvas',
  },
  { id: 'canvas-pan', group: 'Canvas', label: 'Pan the canvas', keys: 'Space+Drag', handledBy: 'canvas' },
  {
    id: 'canvas-wheel',
    group: 'Canvas',
    label: 'Zoom at the pointer',
    keys: 'Ctrl+Wheel',
    handledBy: 'canvas',
  },
  { id: 'ai', group: 'View', label: 'Show or hide the AI assistant', keys: 'A', handledBy: 'shell' },
  { id: 'help', group: 'Help', label: 'Show keyboard shortcuts', keys: '?', handledBy: 'shell' },
];
export const shortcutKeys = (id: ShortcutId): string => SHORTCUTS.find((s) => s.id === id)?.keys ?? '';
type KeyEventLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>;
const PLAIN: Record<string, ShortcutId> = {
  v: 'tool-select',
  h: 'tool-hand',
  t: 'tool-text',
  b: 'tool-button',
  n: 'tool-input',
  p: 'tool-image',
  s: 'tool-shape',
  l: 'tool-line',
  '+': 'zoom-in',
  '=': 'zoom-in',
  '-': 'zoom-out',
  '0': 'zoom-fit',
  '1': 'zoom-actual',
  a: 'ai',
  '?': 'help',
  Delete: 'delete',
  Escape: 'deselect',
};
const CTRL: Record<string, ShortcutId> = {
  s: 'save',
  c: 'copy',
  v: 'paste',
  d: 'duplicate',
  a: 'select-all',
};
/** Maps a key event to a shell shortcut, or undefined. Undo and redo belong to the history controls. */
export function matchShortcut(e: KeyEventLike): ShortcutId | undefined {
  if ((e.ctrlKey || e.metaKey) && !e.altKey) return e.shiftKey ? undefined : CTRL[e.key.toLowerCase()];
  if (e.ctrlKey || e.metaKey || e.altKey) return undefined;
  return PLAIN[e.key.length === 1 ? e.key.toLowerCase() : e.key];
}
