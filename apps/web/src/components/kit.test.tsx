// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Button,
  Dialog,
  EmptyState,
  Field,
  Icon,
  IconButton,
  Kbd,
  Menu,
  NumberField,
  Panel,
  Select,
  Swatch,
  Tabs,
  ToastProvider,
  Toolbar,
  Tooltip,
  useToast,
  ICON_NAMES,
} from './index';

afterEach(cleanup);

describe('Button and IconButton', () => {
  it('is a real button, defaults to type=button and fires onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const b = screen.getByRole('button', { name: 'Save' });
    expect(b.getAttribute('type')).toBe('button');
    await userEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it('blocks clicks and reports busy while loading or disabled', async () => {
    const onClick = vi.fn();
    render(
      <>
        <Button loading onClick={onClick}>
          Busy
        </Button>
        <Button disabled onClick={onClick}>
          Off
        </Button>
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Busy' }));
    await userEvent.click(screen.getByRole('button', { name: 'Off' }));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Busy' }).getAttribute('aria-busy')).toBe('true');
  });
  it('IconButton is named by its label and hides the icon from assistive tech', () => {
    render(<IconButton icon="trash" label="Delete card" />);
    const b = screen.getByRole('button', { name: 'Delete card' });
    expect(b.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Icon', () => {
  it('renders every named icon as an svg path', () => {
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />);
      expect(container.querySelector('svg path')?.getAttribute('d')).toBeTruthy();
      unmount();
    }
  });
});

describe('Field, NumberField, Select', () => {
  it('Field links label, hint and error to the input', async () => {
    function Host() {
      const [v, setV] = useState('');
      return <Field label="Title" hint="Shown in the list" error="Required" value={v} onChange={setV} />;
    }
    render(<Host />);
    const input = screen.getByLabelText('Title');
    await userEvent.type(input, 'abc');
    expect((input as HTMLInputElement).value).toBe('abc');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const described = input.getAttribute('aria-describedby')!.split(' ');
    expect(described).toHaveLength(2);
    expect(document.getElementById(described[1]!)?.textContent).toBe('Required');
  });
  it('NumberField commits valid numbers and reports invalid ones without committing', async () => {
    const onChange = vi.fn();
    function Host() {
      const [v, setV] = useState(10);
      return (
        <NumberField
          label="Width"
          unit="px"
          value={v}
          min={0}
          max={100}
          onChange={(n) => {
            onChange(n);
            setV(n);
          }}
        />
      );
    }
    render(<Host />);
    const input = screen.getByLabelText('Width (px)') as HTMLInputElement;
    await userEvent.clear(input);
    expect(screen.getByText('Enter a number.')).toBeTruthy();
    await userEvent.type(input, '250');
    expect(onChange).not.toHaveBeenCalledWith(250);
    expect(screen.getByText('Must be at most 100.')).toBeTruthy();
    await userEvent.clear(input);
    await userEvent.type(input, '42');
    expect(onChange).toHaveBeenLastCalledWith(42);
  });
  it('Select reports the chosen value', async () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Layout"
        value="a"
        onChange={onChange}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText('Layout'), 'b');
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('Tabs', () => {
  it('selects with arrow keys, Home and End and keeps one tab in the tab order', async () => {
    render(
      <Tabs
        label="Editor"
        tabs={[
          { id: 'a', label: 'Blocks', panel: <p>one</p> },
          { id: 'b', label: 'Script', panel: <p>two</p> },
          { id: 'c', label: 'Off', panel: <p>three</p>, disabled: true },
        ]}
      />,
    );
    const first = screen.getByRole('tab', { name: 'Blocks' });
    first.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Script' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toBe('two');
    expect(first.getAttribute('tabindex')).toBe('-1');
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Blocks' }).getAttribute('aria-selected')).toBe('true');
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Script' }).getAttribute('aria-selected')).toBe('true');
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('tabpanel').textContent).toBe('one');
  });
});

describe('Menu', () => {
  it('opens with the keyboard, skips disabled items, selects, and returns focus on Escape', async () => {
    const pick = vi.fn();
    const never = vi.fn();
    render(
      <Menu
        label="Actions"
        items={[
          { id: 'a', label: 'Duplicate', onSelect: pick },
          { id: 'b', label: 'Locked', onSelect: never, disabled: true },
          { id: 'c', label: 'Delete', onSelect: pick },
        ]}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Actions' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Duplicate' }));
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Delete' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(pick).toHaveBeenCalledTimes(1);
    expect(never).not.toHaveBeenCalled();
  });
});

describe('Dialog', () => {
  it('shows a named dialog and calls onClose from the close button', async () => {
    const onClose = vi.fn();
    render(
      <Dialog open title="Delete card" onClose={onClose} actions={<Button>Confirm</Button>}>
        <p>Body text</p>
      </Dialog>,
    );
    const d = screen.getByRole('dialog', { name: 'Delete card' });
    expect(within(d).getByText('Body text')).toBeTruthy();
    await userEvent.click(within(d).getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('renders no content while closed', () => {
    render(
      <Dialog open={false} title="Hidden" onClose={() => undefined}>
        <p>Secret</p>
      </Dialog>,
    );
    expect(screen.queryByText('Secret')).toBeNull();
  });
});

describe('Tooltip', () => {
  it('shows on focus and hides on Escape; the target keeps its own name', async () => {
    render(
      <Tooltip text="Opens settings">
        <Button>Settings</Button>
      </Tooltip>,
    );
    const b = screen.getByRole('button', { name: 'Settings' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    await userEvent.tab();
    expect(document.activeElement).toBe(b);
    expect(screen.getByRole('tooltip').textContent).toBe('Opens settings');
    expect(b.getAttribute('aria-describedby')).toBe(screen.getByRole('tooltip').id);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('Panel and Toolbar', () => {
  it('Panel is a labelled region', () => {
    render(
      <Panel title="Layers">
        <p>x</p>
      </Panel>,
    );
    expect(screen.getByRole('region', { name: 'Layers' })).toBeTruthy();
  });
  it('Toolbar moves focus with arrow keys and wraps', async () => {
    render(
      <Toolbar label="Actions">
        <Button>One</Button>
        <Button>Two</Button>
      </Toolbar>,
    );
    screen.getByRole('button', { name: 'One' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Two' }));
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'One' }));
  });
});

describe('Toast', () => {
  function Host() {
    const t = useToast();
    return (
      <>
        <Button onClick={() => t.push({ kind: 'success', message: 'Saved.' })}>ok</Button>
        <Button onClick={() => t.push({ kind: 'error', message: 'Failed.' })}>bad</Button>
      </>
    );
  }
  it('announces messages, dismisses on request, and keeps errors as alerts', async () => {
    render(
      <ToastProvider>
        <Host />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'ok' }));
    expect(screen.getByRole('status').textContent).toContain('Saved.');
    await userEvent.click(screen.getByRole('button', { name: 'bad' }));
    expect(screen.getByRole('alert').textContent).toContain('Failed.');
    const dismiss = screen.getAllByRole('button', { name: 'Dismiss notification' });
    await userEvent.click(dismiss[0]!);
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('closes non-error toasts after the duration and keeps errors', () => {
    vi.useFakeTimers();
    try {
      render(
        <ToastProvider duration={1000}>
          <Host />
        </ToastProvider>,
      );
      for (const n of ['ok', 'bad']) {
        act(() => screen.getByRole('button', { name: n }).click());
      }
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.getByRole('alert').textContent).toContain('Failed.');
    } finally {
      vi.useRealTimers();
    }
  });
  it('throws a clear error without a provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Host />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});

describe('EmptyState, Swatch, Kbd', () => {
  it('EmptyState error tone is an alert with the next step', () => {
    render(
      <EmptyState tone="error" title="Could not load" action={<Button>Retry</Button>}>
        Storage is blocked.
      </EmptyState>,
    );
    expect(screen.getByRole('alert').textContent).toContain('Storage is blocked.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
  it('Swatch is a named toggle', async () => {
    const onSelect = vi.fn();
    render(<Swatch color="#ff0000" label="Red" selected onSelect={onSelect} />);
    const b = screen.getByRole('button', { name: 'Red' });
    expect(b.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(b);
    expect(onSelect).toHaveBeenCalled();
  });
  it('Kbd renders a kbd element', () => {
    render(<Kbd>Ctrl</Kbd>);
    expect(screen.getByText('Ctrl').tagName).toBe('KBD');
  });
});
