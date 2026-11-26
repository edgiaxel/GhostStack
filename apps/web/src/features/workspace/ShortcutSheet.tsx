import type { ReactNode } from 'react';
import { Dialog, Kbd } from '../../components';
import { SHORTCUTS } from './shortcuts';
import type { ShortcutGroup } from './shortcuts';

const GROUPS: ShortcutGroup[] = ['Editing', 'Tools', 'View', 'Canvas', 'Help'];

/** Lists every shortcut from the shared table, grouped. */
export function ShortcutSheet({ open, onClose }: { open: boolean; onClose: () => void }): ReactNode {
  return (
    <Dialog
      open={open}
      title="Keyboard shortcuts"
      onClose={onClose}
      actions={
        <button type="button" className="gs-btn gs-btn--primary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="gs-ws-sheet">
        {GROUPS.map((g) => (
          <section key={g} aria-label={g}>
            <h3 className="gs-panel-title">{g}</h3>
            <dl className="gs-ws-keys">
              {SHORTCUTS.filter((s) => s.group === g).map((s) => (
                <div key={s.id}>
                  <dt>{s.label}</dt>
                  <dd>
                    <Kbd>{s.keys}</Kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <p className="gs-ws-keyhint">
          Letter and number shortcuts work when no text field has focus. A stack holds cards, and a card holds
          elements.
        </p>
      </div>
    </Dialog>
  );
}
