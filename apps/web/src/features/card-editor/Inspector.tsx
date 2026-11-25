import { useState } from 'react';
import type { ReactNode } from 'react';
import { ANCHORS, RENDER_DEFAULTS, SCALE_MODES } from '@ghoststack/shared-contracts';
import type { Element, ElementPatch, ZPlacement } from '@ghoststack/shared-contracts';
import { describeAssetFile } from '../../app/assets';
import { useServices } from '../../app/services';
import { useSessionStack } from '../../app/useStackSession';
import type { EditorSlotProps } from '../../app/editorContext';
import { CheckField, ColorField, NumberField, SelectField, TextField } from './fields';
import './card-editor.css';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

const prop = <T,>(el: Element, key: string, fallback: T): T =>
  (el.properties[key] as T | undefined) ?? fallback;
const ZORDER: { placement: ZPlacement; label: string }[] = [
  { placement: 'front', label: 'Bring to front' },
  { placement: 'forward', label: 'Forward' },
  { placement: 'backward', label: 'Backward' },
  { placement: 'back', label: 'Send to back' },
];

export function CardInspector({ session, cardId, selectedElementId }: EditorSlotProps): ReactNode {
  const stack = useSessionStack(session);
  const { assets } = useServices();
  const [uploadError, setUploadError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const card = stack.cards[cardId];
  const element = card?.elements.find((e) => e.elementId === selectedElementId);
  if (!card) return null;

  if (!element) {
    return (
      <div className="gs-workspace-pane gs-ci">
        <p className="gs-panel-title">Inspector</p>
        <p>
          <strong>{card.title || 'Untitled card'}</strong>
        </p>
        <p className="gs-empty">
          {card.elements.length === 0
            ? 'No elements on this card. Add one from the canvas toolbar.'
            : `${card.elements.length} element(s). Select one on the canvas to edit it.`}
        </p>
      </div>
    );
  }

  const id = element.elementId;
  const patch = (p: ElementPatch, key: string): string | undefined => {
    const r = session.dispatch(
      { type: 'UPDATE_ELEMENT', cardId, elementId: id, patch: p },
      { coalesceKey: `${key}:${id}` },
    );
    return r.ok ? undefined : r.error.message;
  };
  const setProp =
    (name: string) =>
    (value: unknown): string | undefined =>
      patch({ properties: { [name]: value } }, `p:${name}`);
  const clearProp = (name: string) => (): string | undefined =>
    patch({ properties: { [name]: null } }, `p:${name}`);
  const setLayout =
    (name: 'x' | 'y' | 'width' | 'height') =>
    (value: number): string | undefined =>
      patch({ layout: { [name]: value } }, `l:${name}`);
  const z = (placement: ZPlacement): void =>
    void session.dispatch({ type: 'REORDER_ELEMENT', cardId, elementId: id, placement });

  async function upload(file: File): Promise<void> {
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
        ? session.dispatch({ type: 'UPDATE_ELEMENT', cardId, elementId: id, patch: { assetId } })
        : reg;
      if (!set.ok) {
        await assets.delete(stack.stackId, assetId);
        setUploadError(set.error.message);
      }
    } catch (e) {
      await assets.delete(stack.stackId, assetId).catch(() => undefined);
      setUploadError(`Could not store the image: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const color = (name: string, label: string, fallback: string): ReactNode => (
    <ColorField
      label={label}
      value={element.properties[name] as string | undefined}
      fallback={fallback}
      onCommit={setProp(name)}
      onReset={clearProp(name)}
    />
  );
  const fontSize = (
    <NumberField
      label="Font size"
      value={prop(element, 'fontSize', RENDER_DEFAULTS.fontSize)}
      min={8}
      max={200}
      onCommit={setProp('fontSize')}
    />
  );
  const asset = element.assetId ? stack.assetRegistry[element.assetId] : undefined;

  return (
    <div className="gs-workspace-pane gs-ci" aria-label={`${element.name} properties`}>
      <p className="gs-panel-title">Inspector: {element.type}</p>
      <TextField label="Name" value={element.name} onCommit={(v) => patch({ name: v }, 'name')} />

      <div className="gs-ci-section" role="group" aria-label="Position and size">
        <div className="gs-ci-pair">
          <NumberField label="X" value={element.layout.x} onCommit={setLayout('x')} />
          <NumberField label="Y" value={element.layout.y} onCommit={setLayout('y')} />
          <NumberField label="Width" value={element.layout.width} min={0} onCommit={setLayout('width')} />
          <NumberField label="Height" value={element.layout.height} min={0} onCommit={setLayout('height')} />
        </div>
        <SelectField
          label="Anchor"
          value={element.layout.anchor ?? 'top-left'}
          options={ANCHORS.map((a) => ({ value: a, text: a }))}
          onCommit={(v) => patch({ layout: { anchor: v as (typeof ANCHORS)[number] } }, 'anchor')}
        />
        <SelectField
          label="Scaling"
          value={element.layout.scaleMode ?? 'fixed'}
          options={SCALE_MODES.map((m) => ({
            value: m,
            text: { fixed: 'Fixed size', scale: 'Scale proportionally', stretch: 'Stretch' }[m],
          }))}
          onCommit={(v) => patch({ layout: { scaleMode: v as (typeof SCALE_MODES)[number] } }, 'scale')}
        />
      </div>

      <div className="gs-ci-section" role="group" aria-label="Appearance">
        <CheckField
          label="Visible at start"
          checked={element.properties['visible'] !== false}
          onCommit={(v) => setProp('visible')(v)}
        />
        <NumberField
          label="Opacity (0 to 1)"
          value={prop(element, 'opacity', 1)}
          min={0}
          max={1}
          step={0.1}
          onCommit={setProp('opacity')}
        />

        {element.type === 'text' ? (
          <>
            <TextField label="Text" multiline value={prop(element, 'text', '')} onCommit={setProp('text')} />
            {fontSize}
            <SelectField
              label="Weight"
              value={prop(element, 'fontWeight', 'normal')}
              options={[
                { value: 'normal', text: 'Normal' },
                { value: 'bold', text: 'Bold' },
              ]}
              onCommit={setProp('fontWeight')}
            />
            <SelectField
              label="Align"
              value={prop(element, 'align', 'left')}
              options={['left', 'center', 'right'].map((a) => ({ value: a, text: a }))}
              onCommit={setProp('align')}
            />
            {color('color', 'Text color', RENDER_DEFAULTS.textColor)}
          </>
        ) : null}

        {element.type === 'button' ? (
          <>
            <TextField label="Label" value={prop(element, 'text', '')} onCommit={setProp('text')} />
            {fontSize}
            {color('color', 'Text color', RENDER_DEFAULTS.textColor)}
            {color('background', 'Background', RENDER_DEFAULTS.buttonBackground)}
          </>
        ) : null}

        {element.type === 'input' ? (
          <>
            <TextField
              label="Placeholder"
              value={prop(element, 'placeholder', '')}
              onCommit={setProp('placeholder')}
            />
            <TextField
              label="Starting value"
              value={prop(element, 'defaultValue', '')}
              onCommit={setProp('defaultValue')}
            />
            {fontSize}
            <SelectField
              label="Save typed value in variable"
              value={prop(element, 'stateKey', '')}
              options={[
                { value: '', text: 'None' },
                ...Object.keys(stack.stateSchema).map((k) => ({ value: k, text: k })),
              ]}
              onCommit={(v) => (v === '' ? clearProp('stateKey')() : setProp('stateKey')(v))}
            />
          </>
        ) : null}

        {element.type === 'image' ? (
          <>
            <TextField label="Alternative text" value={prop(element, 'alt', '')} onCommit={setProp('alt')} />
            <SelectField
              label="Fit"
              value={prop(element, 'fit', 'contain')}
              options={['contain', 'cover', 'fill'].map((a) => ({ value: a, text: a }))}
              onCommit={setProp('fit')}
            />
            <label className="gs-ci-field">
              <span>Image file (PNG, JPEG, GIF or WebP, up to 5 MB)</span>
              <input
                type="file"
                accept={IMAGE_TYPES.join(',')}
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void upload(file);
                }}
              />
            </label>
            {asset ? <p className="gs-ci-hint">Current file: {asset.relativePath}</p> : null}
            {uploadError ? (
              <p className="gs-error" role="alert">
                {uploadError}
              </p>
            ) : null}
            {element.assetId ? (
              <button type="button" className="gs-btn" onClick={() => void patch({ assetId: null }, 'asset')}>
                Remove image
              </button>
            ) : null}
          </>
        ) : null}

        {element.type === 'shape' ? (
          <>
            <SelectField
              label="Shape"
              value={prop(element, 'shape', 'rect')}
              options={[
                { value: 'rect', text: 'Rectangle' },
                { value: 'ellipse', text: 'Ellipse' },
              ]}
              onCommit={setProp('shape')}
            />
            {color('fill', 'Fill', RENDER_DEFAULTS.shapeFill)}
            {color('stroke', 'Outline', RENDER_DEFAULTS.stroke)}
            <NumberField
              label="Outline width"
              value={prop(element, 'strokeWidth', 0)}
              min={0}
              max={64}
              onCommit={setProp('strokeWidth')}
            />
            <NumberField
              label="Corner radius"
              value={prop(element, 'radius', 0)}
              min={0}
              max={1000}
              onCommit={setProp('radius')}
            />
          </>
        ) : null}

        {element.type === 'line' ? (
          <>
            {color('stroke', 'Color', RENDER_DEFAULTS.stroke)}
            <NumberField
              label="Thickness"
              value={prop(element, 'strokeWidth', RENDER_DEFAULTS.strokeWidth)}
              min={0}
              max={64}
              onCommit={setProp('strokeWidth')}
            />
            <CheckField
              label="Rising (bottom-left to top-right)"
              checked={element.properties['flipY'] === true}
              onCommit={(v) => setProp('flipY')(v)}
            />
          </>
        ) : null}
      </div>

      <div className="gs-ci-section" role="group" aria-label="Arrange">
        <div className="gs-ci-row">
          {ZORDER.map((o) => (
            <button key={o.placement} type="button" className="gs-btn" onClick={() => z(o.placement)}>
              {o.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="gs-btn gs-btn--danger"
          onClick={() => void session.dispatch({ type: 'DELETE_ELEMENT', cardId, elementId: id })}
        >
          Delete element
        </button>
      </div>
    </div>
  );
}
