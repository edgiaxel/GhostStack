import { RENDER_DEFAULTS, resolveFontScale, resolveLayout } from '@ghoststack/shared-contracts';
import type {
  BehaviorRuntime,
  Card,
  CreateRuntime,
  Element,
  RuntimeSnapshot,
  Size,
  Stack,
} from '@ghoststack/shared-contracts';

export interface PlayerOptions {
  container: HTMLElement;
  stack: Stack;
  /** Returns a URL for the asset bytes, or undefined when the asset is missing (renders the fallback). */
  resolveAssetUrl(assetId: string): string | undefined;
  createRuntime: CreateRuntime;
  /** Starting card. Defaults to the entry card. */
  startCardId?: string;
  /** Runtime issues are reported here as well as shown in preview. */
  onError?(message: string): void;
}

export interface PlayerHandle {
  /** Restarts from the start card with fresh runtime state. */
  restart(): void;
  destroy(): void;
}

const COLOR = /^(#[0-9a-fA-F]{3,8}|transparent)$/;
const SVG = 'http://www.w3.org/2000/svg';

const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
/** Colors reach `style` only after this check, whatever the Stack contained. */
const color = (v: unknown, fallback: string): string =>
  typeof v === 'string' && COLOR.test(v) ? v : fallback;

interface Node {
  element: Element;
  root: HTMLElement;
  /** Updates text-bearing content from runtime state. */
  setText?(text: string): void;
}

/**
 * Renders a Stack as a running application. Preview and the standalone export both call this,
 * so they cannot interpret a Stack differently. All content is set through DOM APIs
 * (`textContent`, `style.setProperty`), never as HTML.
 */
export function mountPlayer(options: PlayerOptions): PlayerHandle {
  const { container, stack, createRuntime } = options;
  const doc = container.ownerDocument;
  const design = stack.viewportDefaults;
  let runtime: BehaviorRuntime;
  let nodes: Node[] = [];
  let currentCard = '';
  let reported = 0;
  let destroyed = false;

  const stage = doc.createElement('div');
  stage.setAttribute('data-gs-stage', '');
  stage.style.cssText = `position:relative;width:100%;height:100%;overflow:hidden;background:${RENDER_DEFAULTS.cardBackground}`;
  container.replaceChildren(stage);

  const viewSize = (): Size => ({
    width: stage.clientWidth > 0 ? stage.clientWidth : design.width,
    height: stage.clientHeight > 0 ? stage.clientHeight : design.height,
  });

  function fallback(text: string, label: string): HTMLElement {
    const box = doc.createElement('div');
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', label);
    box.setAttribute('data-gs-fallback', '');
    box.style.cssText =
      'width:100%;height:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:center;text-align:center;padding:4px;border:1px dashed #6b7280;background:#f3f4f6;color:#374151;font:13px sans-serif';
    box.textContent = text;
    return box;
  }

  function create(element: Element): Node {
    const p = element.properties;
    const root = doc.createElement('div');
    root.style.position = 'absolute';
    root.style.boxSizing = 'border-box';
    const opacity = num(p['opacity'], 1);
    if (opacity !== 1) root.style.opacity = String(opacity);
    const node: Node = { element, root };
    const font = (el: HTMLElement): void => {
      el.style.fontSize = `${num(p['fontSize'], RENDER_DEFAULTS.fontSize)}px`;
      el.style.fontFamily = 'system-ui, sans-serif';
    };
    switch (element.type) {
      case 'text': {
        const t = doc.createElement('div');
        font(t);
        t.style.cssText += `;width:100%;height:100%;white-space:pre-wrap;overflow-wrap:anywhere;overflow:hidden;font-weight:${p['fontWeight'] === 'bold' ? 700 : 400};text-align:${['left', 'center', 'right'].includes(str(p['align'], 'left')) ? str(p['align'], 'left') : 'left'};color:${color(p['color'], RENDER_DEFAULTS.textColor)}`;
        t.textContent = str(p['text'], '');
        root.append(t);
        node.setText = (text) => void (t.textContent = text);
        break;
      }
      case 'button': {
        const b = doc.createElement('button');
        b.type = 'button';
        font(b);
        b.style.cssText += `;width:100%;height:100%;cursor:pointer;font-weight:600;border:1px solid rgba(0,0,0,.2);border-radius:6px;overflow:hidden;color:${color(p['color'], RENDER_DEFAULTS.textColor)};background:${color(p['background'], RENDER_DEFAULTS.buttonBackground)}`;
        b.textContent = str(p['text'], '');
        b.addEventListener('click', () => step({ type: 'element.click', elementId: element.elementId }));
        root.append(b);
        node.setText = (text) => void (b.textContent = text);
        break;
      }
      case 'input': {
        const i = doc.createElement('input');
        i.type = 'text';
        font(i);
        i.setAttribute('aria-label', element.name || 'Input');
        i.placeholder = str(p['placeholder'], '');
        i.value = str(p['defaultValue'], '');
        i.style.cssText += `;width:100%;height:100%;box-sizing:border-box;padding:0 8px;border:1px solid ${RENDER_DEFAULTS.inputBorder};border-radius:4px;background:${RENDER_DEFAULTS.inputBackground};color:${RENDER_DEFAULTS.textColor}`;
        i.addEventListener('input', () =>
          step({ type: 'element.change', elementId: element.elementId, value: i.value }),
        );
        root.append(i);
        break;
      }
      case 'image': {
        const alt = str(p['alt'], '');
        const url = element.assetId === undefined ? undefined : options.resolveAssetUrl(element.assetId);
        if (url === undefined) {
          root.append(fallback(`Image file missing${alt ? `: ${alt}` : ''}`, alt || 'Image file missing'));
          break;
        }
        const img = doc.createElement('img');
        img.alt = alt;
        img.draggable = false;
        img.style.cssText = `width:100%;height:100%;object-fit:${['contain', 'cover', 'fill'].includes(str(p['fit'], 'contain')) ? str(p['fit'], 'contain') : 'contain'}`;
        img.addEventListener('error', () =>
          root.replaceChildren(
            fallback(`Image file missing${alt ? `: ${alt}` : ''}`, alt || 'Image file missing'),
          ),
        );
        img.src = url;
        root.append(img);
        break;
      }
      case 'shape': {
        const s = doc.createElement('div');
        s.style.cssText = `width:100%;height:100%;box-sizing:border-box;background:${color(p['fill'], RENDER_DEFAULTS.shapeFill)};border:${num(p['strokeWidth'], 0)}px solid ${color(p['stroke'], RENDER_DEFAULTS.stroke)};border-radius:${p['shape'] === 'ellipse' ? '50%' : `${num(p['radius'], 0)}px`}`;
        root.append(s);
        break;
      }
      case 'line': {
        const svg = doc.createElementNS(SVG, 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('overflow', 'visible');
        const w = Math.max(element.layout.width, 1);
        const h = Math.max(element.layout.height, 1);
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        const line = doc.createElementNS(SVG, 'line');
        const flip = p['flipY'] === true;
        line.setAttribute('x1', '0');
        line.setAttribute('y1', String(flip ? h : 0));
        line.setAttribute('x2', String(w));
        line.setAttribute('y2', String(flip ? 0 : h));
        line.setAttribute('stroke', color(p['stroke'], RENDER_DEFAULTS.stroke));
        line.setAttribute('stroke-width', String(num(p['strokeWidth'], RENDER_DEFAULTS.strokeWidth)));
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.append(line);
        root.append(svg);
        break;
      }
    }
    return node;
  }

  function place(): void {
    const view = viewSize();
    for (const { element, root } of nodes) {
      const rect = resolveLayout(element.layout, design, view);
      root.style.left = `${rect.x}px`;
      root.style.top = `${rect.y}px`;
      root.style.width = `${rect.width}px`;
      root.style.height = `${rect.height}px`;
      const scale = resolveFontScale(element.layout, rect);
      const inner = root.firstElementChild as HTMLElement | null;
      if (inner && scale !== 1 && ['text', 'button', 'input'].includes(element.type)) {
        inner.style.fontSize = `${num(element.properties['fontSize'], RENDER_DEFAULTS.fontSize) * scale}px`;
      } else if (inner && ['text', 'button', 'input'].includes(element.type)) {
        inner.style.fontSize = `${num(element.properties['fontSize'], RENDER_DEFAULTS.fontSize)}px`;
      }
    }
  }

  function build(card: Card | undefined): void {
    const ordered = [...(card?.elements ?? [])]
      .map((e, i) => ({ e, i }))
      .sort((a, b) => a.e.layout.zIndex - b.e.layout.zIndex || a.i - b.i)
      .map(({ e }) => e);
    nodes = ordered.map(create);
    stage.replaceChildren(...nodes.map((n) => n.root));
    place();
  }

  function render(snap: RuntimeSnapshot): void {
    if (snap.cardId !== currentCard) {
      currentCard = snap.cardId;
      build(stack.cards[snap.cardId]);
    }
    for (const n of nodes) {
      const s = snap.elements[n.element.elementId];
      n.root.style.display = s && !s.visible ? 'none' : '';
      if (s?.text !== undefined) n.setText?.(s.text);
    }
    for (const issue of snap.errors.slice(reported)) options.onError?.(issue.message);
    reported = snap.errors.length;
  }

  function step(event: Parameters<BehaviorRuntime['dispatch']>[0]): void {
    if (!destroyed) render(runtime.dispatch(event));
  }

  function start(): void {
    runtime = createRuntime(
      stack,
      options.startCardId === undefined ? undefined : { startCardId: options.startCardId },
    );
    currentCard = '';
    reported = 0;
    render(runtime.start());
  }

  start();

  let observer: ResizeObserver | undefined;
  const onWindow = (): void => place();
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => place());
    observer.observe(stage);
  } else {
    doc.defaultView?.addEventListener('resize', onWindow);
  }

  return {
    restart: start,
    destroy() {
      destroyed = true;
      observer?.disconnect();
      doc.defaultView?.removeEventListener('resize', onWindow);
      container.replaceChildren();
    },
  };
}
