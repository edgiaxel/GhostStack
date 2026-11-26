import { useState } from 'react';
import type { ReactNode } from 'react';
import { applyCommand } from '@ghoststack/domain';
import { ANCHORS, RENDER_DEFAULTS, SCALE_MODES } from '@ghoststack/shared-contracts';
import type {
  Anchor,
  Element,
  ElementPatch,
  ProjectCommand,
  ScaleMode,
  Stack,
  StackSession,
  ZPlacement,
} from '@ghoststack/shared-contracts';
import { Button, EmptyState, Tabs } from '../../components';
import { describeAssetFile } from '../../app/assets';
import { gestureKey } from './canvas-actions';
import { useServices } from '../../app/services';
import { useSessionStack } from '../../app/useStackSession';
import type { EditorSlotProps } from '../../app/editorContext';
import { CheckField, ColorField, NumField, SelectField, TextArea, TextField } from './fields';
import type { Commit } from './fields';
import { PinPicker, ResponsivePreview, ScaleDiagram } from './inspector-extras';
import { MIXED, describeBehavior, sharedValue, withHint } from './inspector-model';
import type { Shared } from './inspector-model';
import './card-editor.css';
import './inspector.css';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export interface CardInspectorProps extends EditorSlotProps {
  /** Every selected element. When it holds several ids the inspector edits them together. */
  selectedIds?: string[];
  /** Supplied by the shell. The "Edit behaviors" button renders only when it is set. */
  onOpenBehavior?: () => void;
}

type TabId = 'content' | 'layout' | 'appearance' | 'behavior';

const ZORDER: { placement: ZPlacement; label: string }[] = [
  { placement: 'front', label: 'Bring to front' },
  { placement: 'forward', label: 'Forward' },
  { placement: 'backward', label: 'Backward' },
  { placement: 'back', label: 'Send to back' },
];

const ASSET_REMOVE = 'Remove image';

export function CardInspector({
  session,
  cardId,
  selectedElementId,
  selectedIds,
  onOpenBehavior,
}: CardInspectorProps): ReactNode {
  const stack = useSessionStack(session);
  const [tab, setTab] = useState<TabId>('content');
  const card = stack.cards[cardId];
  if (!card) return null;
  const wanted = selectedIds ?? (selectedElementId === undefined ? [] : [selectedElementId]);
  const picked = card.elements.filter((e) => wanted.includes(e.elementId));
  if (picked.length === 0) return <CardSection session={session} stack={stack} cardId={cardId} />;
  return (
    <ElementInspector
      session={session}
      stack={stack}
      cardId={cardId}
      elements={picked}
      tab={tab}
      onTab={setTab}
      onOpenBehavior={onOpenBehavior}
    />
  );
}

const messageOf = (r: { ok: true } | { ok: false; error: { message: string } }): string | undefined =>
  r.ok ? undefined : r.error.message;

function CardSection({
  session,
  stack,
  cardId,
}: {
  session: StackSession;
  stack: Stack;
  cardId: string;
}): ReactNode {
  const card = stack.cards[cardId];
  if (!card) return null;
  const send = (command: ProjectCommand, key: string): string | undefined =>
    messageOf(session.dispatch(command, { coalesceKey: key }));
  const frame = stack.viewportDefaults;
  return (
    <div className="gs-workspace-pane gs-ci" aria-label="Card properties">
      <p className="gs-panel-title">Inspector: card</p>
      <TextField
        label="Title"
        value={card.title}
        onCommit={(title) => send({ type: 'RENAME_CARD', cardId, title }, `card-title:${cardId}`)}
      />
      <ColorField
        label="Background"
        value={card.background}
        fallback={RENDER_DEFAULTS.cardBackground}
        onCommit={(background) =>
          send({ type: 'SET_CARD_BACKGROUND', cardId, background }, `card-bg:${cardId}`)
        }
        onReset={() => send({ type: 'SET_CARD_BACKGROUND', cardId, background: null }, `card-bg:${cardId}`)}
      />
      <div className="gs-ci-section" role="group" aria-label="Reference frame">
        <p className="gs-ci-hint">
          The reference frame is the size you design in. Other screens scale from it. Elements keep their
          coordinates.
        </p>
        <div className="gs-ci-pair">
          <NumField
            label="Frame width"
            value={frame.width}
            min={120}
            max={8000}
            unit="px"
            onCommit={(width) => send({ type: 'SET_VIEWPORT', width, height: frame.height }, 'frame-w')}
          />
          <NumField
            label="Frame height"
            value={frame.height}
            min={120}
            max={8000}
            unit="px"
            onCommit={(height) => send({ type: 'SET_VIEWPORT', width: frame.width, height }, 'frame-h')}
          />
        </div>
      </div>
      <p className="gs-empty">
        {card.elements.length === 0
          ? 'No elements on this card. Add one from the canvas toolbar.'
          : `${card.elements.length} element(s). Select one on the canvas to edit it.`}
      </p>
    </div>
  );
}

/**
 * Edits one or more elements. Shared values show as they are; values that differ show "Mixed" and a
 * change is applied to every selected element. The slot passes one element today.
 */
export function ElementInspector({
  session,
  stack,
  cardId,
  elements,
  tab,
  onTab,
  onOpenBehavior,
}: {
  session: StackSession;
  stack: Stack;
  cardId: string;
  elements: Element[];
  tab: TabId;
  onTab: (tab: TabId) => void;
  onOpenBehavior?: (() => void) | undefined;
}): ReactNode {
  const { assets } = useServices();
  const [uploadError, setUploadError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const first = elements[0];
  if (!first) return null;
  const single = elements.length === 1;
  const type = sharedValue(elements.map((e) => e.type));
  const now = (): string => new Date().toISOString();

  /** Applies one command per element. With several elements a dry run first keeps it all-or-nothing. */
  const run = (build: (e: Element) => ProjectCommand, key: string): string | undefined => {
    if (elements.length > 1) {
      let probe = stack;
      for (const e of elements) {
        const r = applyCommand(probe, build(e), now());
        if (!r.ok) return r.error.message;
        probe = r.value;
      }
    }
    for (const e of elements) {
      const r = session.dispatch(build(e), {
        coalesceKey: `${key}:${elements.map((x) => x.elementId).join(',')}`,
      });
      if (!r.ok) return r.error.message;
    }
    return undefined;
  };
  const patch = (p: ElementPatch, key: string): string | undefined =>
    run((e) => ({ type: 'UPDATE_ELEMENT', cardId, elementId: e.elementId, patch: p }), key);

  const prop = <T,>(name: string, fallback: T): Shared<T> =>
    sharedValue(elements.map((e) => (e.properties[name] as T | undefined) ?? fallback));
  const setProp =
    <T,>(name: string): Commit<T> =>
    (value) =>
      patch({ properties: { [name]: value } }, `p:${name}`);
  const clearProp = (name: string) => (): string | undefined =>
    patch({ properties: { [name]: null } }, `p:${name}`);
  const layoutOf = <K extends 'x' | 'y' | 'width' | 'height'>(k: K): Shared<number> =>
    sharedValue(elements.map((e) => e.layout[k]));
  const setLayout =
    (name: 'x' | 'y' | 'width' | 'height'): Commit<number> =>
    (value) =>
      patch({ layout: { [name]: value } }, `l:${name}`);

  const color = (name: string, label: string, fallback: string): ReactNode => (
    <ColorField
      label={label}
      value={sharedValue(elements.map((e) => e.properties[name] as string | undefined))}
      fallback={fallback}
      onCommit={setProp<string>(name)}
      onReset={clearProp(name)}
    />
  );
  const fontSize = (
    <NumField
      label="Font size"
      value={prop('fontSize', RENDER_DEFAULTS.fontSize)}
      min={8}
      max={200}
      unit="px"
      onCommit={setProp<number>('fontSize')}
    />
  );

  async function upload(file: File): Promise<void> {
    if (!first || !single) return;
    setUploadError(undefined);
    if (!IMAGE_TYPES.includes(file.type)) return setUploadError('Choose a PNG, JPEG, GIF or WebP image.');
    if (file.size > MAX_IMAGE_BYTES)
      return setUploadError('That image is larger than 5 MB. Choose a smaller file.');
    setBusy(true);
    const assetId = crypto.randomUUID();
    try {
      const { asset, bytes } = await describeAssetFile(file, assetId);
      await assets.put(stack.stackId, asset, bytes);
      const reg = session.dispatch({ type: 'REGISTER_ASSET', asset });
      const set = reg.ok
        ? session.dispatch({ type: 'UPDATE_ELEMENT', cardId, elementId: first.elementId, patch: { assetId } })
        : reg;
      if (!set.ok) {
        await assets.delete(stack.stackId, assetId);
        setUploadError(withHint('image', set.error.message));
      }
    } catch (e) {
      await assets.delete(stack.stackId, assetId).catch(() => undefined);
      setUploadError(`Could not store the image: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const asset = single && first.assetId ? stack.assetRegistry[first.assetId] : undefined;

  const content = (
    <div className="gs-ci-stack">
      {single ? (
        <TextField label="Name" value={first.name} onCommit={(v) => patch({ name: v }, 'name')} />
      ) : null}
      {type === 'text' ? (
        <TextArea label="Text" value={prop('text', '')} onCommit={setProp<string>('text')} />
      ) : null}
      {type === 'button' ? (
        <TextField label="Label" value={prop('text', '')} onCommit={setProp<string>('text')} />
      ) : null}
      {type === 'input' ? (
        <>
          <TextField
            label="Placeholder"
            value={prop('placeholder', '')}
            onCommit={setProp<string>('placeholder')}
          />
          <TextField
            label="Starting value"
            value={prop('defaultValue', '')}
            onCommit={setProp<string>('defaultValue')}
          />
          <SelectField
            label="Save typed value in variable"
            value={prop('stateKey', '')}
            options={[
              { value: '', text: 'None' },
              ...Object.keys(stack.stateSchema).map((k) => ({ value: k, text: k })),
            ]}
            hint={
              Object.keys(stack.stateSchema).length === 0
                ? 'No variables yet. Add one in the Behavior panel.'
                : undefined
            }
            onCommit={(v) => (v === '' ? clearProp('stateKey')() : setProp<string>('stateKey')(v))}
          />
        </>
      ) : null}
      {type === 'image' ? (
        <>
          <TextField label="Alternative text" value={prop('alt', '')} onCommit={setProp<string>('alt')} />
          {single ? (
            <>
              <label className="gs-kit-field">
                <span className="gs-kit-label">Image file (PNG, JPEG, GIF or WebP, up to 5 MB)</span>
                <input
                  type="file"
                  className="gs-ci-file"
                  accept={IMAGE_TYPES.join(',')}
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void upload(file);
                  }}
                />
              </label>
              {busy ? <p className="gs-ci-hint">Storing the image...</p> : null}
              {asset ? <p className="gs-ci-hint">Current file: {asset.relativePath}</p> : null}
              {uploadError ? (
                <p className="gs-error" role="alert">
                  {uploadError}
                </p>
              ) : null}
              {first.assetId ? (
                <Button type="button" onClick={() => void patch({ assetId: null }, 'asset')}>
                  {ASSET_REMOVE}
                </Button>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
      {type === 'shape' || type === 'line' ? (
        <p className="gs-ci-hint">This element has no text or file. Edit its look in Appearance.</p>
      ) : null}
    </div>
  );

  const layout = (
    <div className="gs-ci-stack">
      <div className="gs-ci-section" role="group" aria-label="Geometry">
        <div className="gs-ci-pair">
          <NumField label="X" value={layoutOf('x')} unit="px" onCommit={setLayout('x')} />
          <NumField label="Y" value={layoutOf('y')} unit="px" onCommit={setLayout('y')} />
          <NumField label="Width" value={layoutOf('width')} min={0} unit="px" onCommit={setLayout('width')} />
          <NumField
            label="Height"
            value={layoutOf('height')}
            min={0}
            unit="px"
            onCommit={setLayout('height')}
          />
        </div>
      </div>
      <div className="gs-ci-section" role="group" aria-label="Responsive behavior">
        <SelectField
          label="Anchor"
          value={sharedValue(elements.map((e) => e.layout.anchor ?? 'top-left'))}
          options={ANCHORS.map((a) => ({ value: a, text: a }))}
          onCommit={(v) => patch({ layout: { anchor: v as Anchor } }, 'anchor')}
        />
        <PinPicker
          value={sharedValue(elements.map((e) => e.layout.anchor ?? 'top-left'))}
          onPick={(a) => void patch({ layout: { anchor: a } }, 'anchor')}
        />
        <SelectField
          label="Scaling"
          value={sharedValue(elements.map((e) => e.layout.scaleMode ?? 'fixed'))}
          options={SCALE_MODES.map((m) => ({
            value: m,
            text: { fixed: 'Fixed size', scale: 'Scale proportionally', stretch: 'Stretch' }[m],
          }))}
          onCommit={(v) => patch({ layout: { scaleMode: v as ScaleMode } }, 'scale')}
        />
        <ScaleDiagram mode={sharedValue(elements.map((e) => e.layout.scaleMode ?? 'fixed'))} />
        {single ? <ResponsivePreview layout={first.layout} design={stack.viewportDefaults} /> : null}
      </div>
      <div className="gs-ci-section" role="group" aria-label="Arrange">
        <div className="gs-ci-row">
          {ZORDER.map((o) => (
            <Button
              key={o.placement}
              type="button"
              onClick={() =>
                void run(
                  (e) => ({
                    type: 'REORDER_ELEMENT',
                    cardId,
                    elementId: e.elementId,
                    placement: o.placement,
                  }),
                  `z:${o.placement}`,
                )
              }
            >
              {o.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );

  const appearance = (
    <div className="gs-ci-stack">
      <CheckField
        label="Visible at start"
        checked={sharedValue(elements.map((e) => e.properties['visible'] !== false))}
        onCommit={setProp<boolean>('visible')}
      />
      <NumField
        label="Opacity (0 to 1)"
        value={prop('opacity', 1)}
        min={0}
        max={1}
        step={0.1}
        onCommit={setProp<number>('opacity')}
      />
      {type === 'text' ? (
        <>
          {fontSize}
          <SelectField
            label="Weight"
            value={prop('fontWeight', 'normal')}
            options={[
              { value: 'normal', text: 'Normal' },
              { value: 'bold', text: 'Bold' },
            ]}
            onCommit={setProp<string>('fontWeight')}
          />
          <SelectField
            label="Align"
            value={prop('align', 'left')}
            options={['left', 'center', 'right'].map((a) => ({ value: a, text: a }))}
            onCommit={setProp<string>('align')}
          />
          {color('color', 'Text color', RENDER_DEFAULTS.textColor)}
        </>
      ) : null}
      {type === 'button' ? (
        <>
          {fontSize}
          {color('color', 'Text color', RENDER_DEFAULTS.textColor)}
          {color('background', 'Background', RENDER_DEFAULTS.buttonBackground)}
        </>
      ) : null}
      {type === 'input' ? fontSize : null}
      {type === 'image' ? (
        <SelectField
          label="Fit"
          value={prop('fit', 'contain')}
          options={['contain', 'cover', 'fill'].map((a) => ({ value: a, text: a }))}
          onCommit={setProp<string>('fit')}
        />
      ) : null}
      {type === 'shape' ? (
        <>
          <SelectField
            label="Shape"
            value={prop('shape', 'rect')}
            options={[
              { value: 'rect', text: 'Rectangle' },
              { value: 'ellipse', text: 'Ellipse' },
            ]}
            onCommit={setProp<string>('shape')}
          />
          {color('fill', 'Fill', RENDER_DEFAULTS.shapeFill)}
          {color('stroke', 'Outline', RENDER_DEFAULTS.stroke)}
          <NumField
            label="Outline width"
            value={prop('strokeWidth', 0)}
            min={0}
            max={64}
            unit="px"
            onCommit={setProp<number>('strokeWidth')}
          />
          <NumField
            label="Corner radius"
            value={prop('radius', 0)}
            min={0}
            max={1000}
            unit="px"
            onCommit={setProp<number>('radius')}
          />
        </>
      ) : null}
      {type === 'line' ? (
        <>
          {color('stroke', 'Color', RENDER_DEFAULTS.stroke)}
          <NumField
            label="Thickness"
            value={prop('strokeWidth', RENDER_DEFAULTS.strokeWidth)}
            min={0}
            max={64}
            unit="px"
            onCommit={setProp<number>('strokeWidth')}
          />
          <CheckField
            label="Rising (bottom-left to top-right)"
            checked={sharedValue(elements.map((e) => e.properties['flipY'] === true))}
            onCommit={setProp<boolean>('flipY')}
          />
        </>
      ) : null}
      {type === MIXED ? (
        <p className="gs-ci-hint">Elements of different types share only the properties above.</p>
      ) : null}
    </div>
  );

  const behavior = (
    <div className="gs-ci-stack">
      {!single ? (
        <EmptyState title="Select one element to see its behaviors." tone="empty" />
      ) : first.behaviors.length === 0 ? (
        <EmptyState
          title="No behaviors on this element."
          tone="empty"
          {...(onOpenBehavior ? { action: <Button onClick={onOpenBehavior}>Edit behaviors</Button> } : {})}
        />
      ) : (
        <>
          <ul className="gs-ci-behaviors">
            {first.behaviors.map((b) => (
              <li key={b.behaviorId}>{describeBehavior(b, stack)}</li>
            ))}
          </ul>
          {onOpenBehavior ? <Button onClick={onOpenBehavior}>Edit behaviors</Button> : null}
        </>
      )}
    </div>
  );

  return (
    <div
      className="gs-workspace-pane gs-ci"
      aria-label={single ? `${first.name} properties` : `${elements.length} elements properties`}
    >
      <p className="gs-panel-title">Inspector: {type === MIXED ? `${elements.length} elements` : type}</p>
      <Tabs
        label="Inspector sections"
        value={tab}
        onChange={(id) => onTab(id as TabId)}
        tabs={[
          { id: 'content', label: 'Content', panel: content },
          { id: 'layout', label: 'Layout', panel: layout },
          { id: 'appearance', label: 'Appearance', panel: appearance },
          { id: 'behavior', label: 'Behavior', panel: behavior },
        ]}
      />
      <Button
        type="button"
        variant="danger"
        onClick={() => {
          const delKey = gestureKey('delete');
          for (const e of elements)
            void session.dispatch(
              { type: 'DELETE_ELEMENT', cardId, elementId: e.elementId },
              { coalesceKey: delKey },
            );
        }}
      >
        {single ? 'Delete element' : `Delete ${elements.length} elements`}
      </Button>
    </div>
  );
}
