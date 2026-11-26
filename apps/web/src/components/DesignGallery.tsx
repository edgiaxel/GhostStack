import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Button,
  Dialog,
  EmptyState,
  ICON_NAMES,
  Icon,
  IconButton,
  Kbd,
  Menu,
  NumberField,
  Panel,
  Select,
  Field,
  Swatch,
  Tabs,
  Toolbar,
  Tooltip,
  useToast,
} from './index';
import './gallery.css';

function Row({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <Panel title={title}>
      <div className="gs-gallery-row">{children}</div>
    </Panel>
  );
}

/** Route `/design`: every kit component in every state, driven by live local state only. */
export function DesignGallery(): ReactNode {
  const toast = useToast();
  const [text, setText] = useState('');
  const [num, setNum] = useState(24);
  const [choice, setChoice] = useState('card');
  const [open, setOpen] = useState(false);
  const [swatch, setSwatch] = useState('--gs-accent');
  const [last, setLast] = useState('none');
  return (
    <div className="gs-gallery">
      <h1 className="gs-gallery-title">Design system</h1>
      <p className="gs-gallery-lede">Components in every state. Theme and accent come from the top bar.</p>
      <Row title="Button">
        <Button>Default</Button>
        <Button variant="primary">Primary</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="ghost">Ghost</Button>
        <Button icon="plus">With icon</Button>
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
      </Row>
      <Row title="Icon button">
        <IconButton icon="undo" label="Undo" />
        <IconButton icon="redo" label="Redo" />
        <IconButton icon="trash" label="Delete" variant="danger" />
        <IconButton icon="settings" label="Settings disabled" disabled />
      </Row>
      <Row title="Icons">
        {ICON_NAMES.map((n) => (
          <span key={n} className="gs-gallery-icon">
            <Icon name={n} />
            <span>{n}</span>
          </span>
        ))}
      </Row>
      <Row title="Fields">
        <div className="gs-gallery-col">
          <Field label="Card title" value={text} onChange={setText} hint="Shown in the navigator." />
          <Field label="With error" value="" onChange={() => undefined} error="Enter a name for the card." />
          <NumberField label="Width" unit="px" value={num} onChange={setNum} min={0} max={500} />
          <Select
            label="Layout"
            value={choice}
            onChange={setChoice}
            options={[
              { value: 'card', label: 'Card' },
              { value: 'list', label: 'List' },
              { value: 'locked', label: 'Locked', disabled: true },
            ]}
          />
          <Field label="Disabled" value="Read only" onChange={() => undefined} disabled />
        </div>
      </Row>
      <Row title="Tabs">
        <Tabs
          label="Gallery tabs"
          tabs={[
            { id: 'a', label: 'Blocks', panel: <p>Blocks panel</p> },
            { id: 'b', label: 'Script', panel: <p>Script panel</p> },
            { id: 'c', label: 'Locked', panel: <p>Never shown</p>, disabled: true },
          ]}
        />
      </Row>
      <Row title="Menu, dialog, tooltip">
        <Menu
          label="Actions"
          items={[
            { id: 'copy', label: 'Duplicate', icon: 'copy', onSelect: () => setLast('Duplicate') },
            { id: 'off', label: 'Unavailable', disabled: true, onSelect: () => undefined },
            { id: 'del', label: 'Delete', icon: 'trash', danger: true, onSelect: () => setLast('Delete') },
          ]}
        />
        <span>
          Last menu choice: <strong>{last}</strong>
        </span>
        <Button onClick={() => setOpen(true)}>Open dialog</Button>
        <Tooltip text="Opens the settings">
          <Button icon="settings">Hover or focus me</Button>
        </Tooltip>
      </Row>
      <Dialog
        open={open}
        title="Delete this card?"
        onClose={() => setOpen(false)}
        actions={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => setOpen(false)}>
              Delete card
            </Button>
          </>
        }
      >
        <p>Its elements and behaviors are removed. You can undo this.</p>
      </Dialog>
      <Row title="Panel and toolbar">
        <Toolbar label="Gallery toolbar">
          <IconButton icon="undo" label="Undo toolbar" />
          <IconButton icon="redo" label="Redo toolbar" />
          <Button icon="play">Preview</Button>
          <Kbd>Ctrl</Kbd>
          <Kbd>Z</Kbd>
        </Toolbar>
      </Row>
      <Row title="Swatch">
        {['--gs-accent', '--gs-accent-2', '--gs-success', '--gs-warning', '--gs-info', '--gs-danger'].map(
          (v) => (
            <Swatch
              key={v}
              color={`var(${v})`}
              label={v.replace('--gs-', '')}
              selected={swatch === v}
              onSelect={() => setSwatch(v)}
            />
          ),
        )}
        <Swatch color="var(--gs-panel-2)" label="disabled swatch" disabled />
      </Row>
      <Row title="Toast">
        {(['info', 'success', 'warning', 'error'] as const).map((kind) => (
          <Button key={kind} onClick={() => toast.push({ kind, message: `This is a ${kind} message.` })}>
            Show {kind}
          </Button>
        ))}
      </Row>
      <Row title="Empty and error states">
        <EmptyState title="No cards yet" action={<Button variant="primary">Add a card</Button>}>
          Add a card to start building this stack.
        </EmptyState>
        <EmptyState tone="error" title="Could not load assets" action={<Button>Try again</Button>}>
          The browser blocked storage access. Allow site data, then try again.
        </EmptyState>
      </Row>
    </div>
  );
}
