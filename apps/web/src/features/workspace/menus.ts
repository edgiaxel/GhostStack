import type { ElementType, ViewportPresetId, ZPlacement } from '@ghoststack/shared-contracts';
import { shortcutKeys } from './shortcuts';
import type { ShortcutId } from './shortcuts';
import type { PanelId } from './layoutPrefs';

export interface MenuEntry {
  id: string;
  label: string;
  onSelect: () => void;
  /** Shown at the right of the item. */
  shortcut?: string;
  disabled?: boolean;
  /** Renders as a radio item. */
  checked?: boolean;
}
export type MenuItemDef = MenuEntry | 'separator';
export interface MenuDef {
  id: string;
  label: string;
  items: MenuItemDef[];
}

/** Everything a menu item can do. The workspace supplies real implementations; menus add no logic of their own. */
export interface MenuActions {
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  /** False when the viewport is not the design size, where elements cannot change. */
  canEdit: boolean;
  busy: boolean;
  viewport: ViewportPresetId;
  viewports: { id: ViewportPresetId; label: string }[];
  panelCollapsed: (id: PanelId) => boolean;
  undo: () => void;
  redo: () => void;
  save: () => void;
  deleteSelected: () => void;
  deselect: () => void;
  insert: (type: ElementType) => void;
  addCard: () => void;
  reorder: (placement: ZPlacement) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomFit: () => void;
  zoomActual: () => void;
  setViewport: (id: ViewportPresetId) => void;
  togglePanel: (id: PanelId) => void;
  resetLayout: () => void;
  openLibrary: () => void;
  preview: () => void;
  exportGsp: () => void;
  exportWeb: () => void;
  showShortcuts: () => void;
}

const INSERT: { type: ElementType; label: string; shortcut: ShortcutId }[] = [
  { type: 'text', label: 'Text', shortcut: 'tool-text' },
  { type: 'button', label: 'Button', shortcut: 'tool-button' },
  { type: 'input', label: 'Input', shortcut: 'tool-input' },
  { type: 'image', label: 'Image', shortcut: 'tool-image' },
  { type: 'shape', label: 'Shape', shortcut: 'tool-shape' },
  { type: 'line', label: 'Line', shortcut: 'tool-line' },
];
const PANELS: { id: PanelId; label: string }[] = [
  { id: 'navigator', label: 'navigator' },
  { id: 'inspector', label: 'inspector' },
  { id: 'drawer', label: 'console' },
];

export function buildMenus(a: MenuActions): MenuDef[] {
  const selected = a.hasSelection && a.canEdit;
  return [
    {
      id: 'file',
      label: 'File',
      items: [
        { id: 'save', label: 'Save now', shortcut: shortcutKeys('save'), onSelect: a.save },
        'separator',
        { id: 'preview', label: 'Preview', disabled: a.busy, onSelect: a.preview },
        { id: 'export-gsp', label: 'Export .gsp', disabled: a.busy, onSelect: a.exportGsp },
        { id: 'export-web', label: 'Export web app', disabled: a.busy, onSelect: a.exportWeb },
        'separator',
        { id: 'library', label: 'Back to library', onSelect: a.openLibrary },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        { id: 'undo', label: 'Undo', shortcut: shortcutKeys('undo'), disabled: !a.canUndo, onSelect: a.undo },
        { id: 'redo', label: 'Redo', shortcut: shortcutKeys('redo'), disabled: !a.canRedo, onSelect: a.redo },
        'separator',
        {
          id: 'delete',
          label: 'Delete element',
          shortcut: shortcutKeys('delete'),
          disabled: !selected,
          onSelect: a.deleteSelected,
        },
        {
          id: 'deselect',
          label: 'Clear selection',
          shortcut: shortcutKeys('deselect'),
          disabled: !a.hasSelection,
          onSelect: a.deselect,
        },
      ],
    },
    {
      id: 'insert',
      label: 'Insert',
      items: [
        ...INSERT.map<MenuEntry>((i) => ({
          id: `insert-${i.type}`,
          label: i.label,
          shortcut: shortcutKeys(i.shortcut),
          disabled: !a.canEdit,
          onSelect: () => a.insert(i.type),
        })),
        'separator',
        { id: 'insert-card', label: 'Card', onSelect: a.addCard },
      ],
    },
    {
      id: 'arrange',
      label: 'Arrange',
      items: [
        { id: 'front', label: 'Bring to front', disabled: !selected, onSelect: () => a.reorder('front') },
        { id: 'forward', label: 'Bring forward', disabled: !selected, onSelect: () => a.reorder('forward') },
        {
          id: 'backward',
          label: 'Send backward',
          disabled: !selected,
          onSelect: () => a.reorder('backward'),
        },
        { id: 'back', label: 'Send to back', disabled: !selected, onSelect: () => a.reorder('back') },
      ],
    },
    {
      id: 'view',
      label: 'View',
      items: [
        { id: 'zoom-in', label: 'Zoom in', shortcut: shortcutKeys('zoom-in'), onSelect: a.zoomIn },
        { id: 'zoom-out', label: 'Zoom out', shortcut: shortcutKeys('zoom-out'), onSelect: a.zoomOut },
        { id: 'zoom-fit', label: 'Fit to window', shortcut: shortcutKeys('zoom-fit'), onSelect: a.zoomFit },
        {
          id: 'zoom-actual',
          label: 'Actual size',
          shortcut: shortcutKeys('zoom-actual'),
          onSelect: a.zoomActual,
        },
        'separator',
        ...a.viewports.map<MenuEntry>((v) => ({
          id: `viewport-${v.id}`,
          label: `${v.label} viewport`,
          checked: a.viewport === v.id,
          onSelect: () => a.setViewport(v.id),
        })),
        'separator',
        ...PANELS.map<MenuEntry>((p) => ({
          id: `panel-${p.id}`,
          label: `${a.panelCollapsed(p.id) ? 'Show' : 'Hide'} ${p.label}`,
          onSelect: () => a.togglePanel(p.id),
        })),
        { id: 'reset-layout', label: 'Reset panel sizes', onSelect: a.resetLayout },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        {
          id: 'shortcuts',
          label: 'Keyboard shortcuts',
          shortcut: shortcutKeys('help'),
          onSelect: a.showShortcuts,
        },
      ],
    },
  ];
}
