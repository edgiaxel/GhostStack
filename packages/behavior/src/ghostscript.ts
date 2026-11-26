import { BehaviorSchema, BINARY_OPS } from '@ghoststack/shared-contracts';
import type { ActionNode, BinaryOp, Behavior, Expr, StateValue, Trigger } from '@ghoststack/shared-contracts';

export interface GhostScriptIssue {
  /** 1-based */
  line: number;
  /** 1-based */
  column: number;
  message: string;
}

export type GhostScriptParseResult =
  { ok: true; behaviors: Behavior[] } | { ok: false; issues: GhostScriptIssue[] };

/** A Card or Element the script may refer to by name. */
export interface GhostScriptRef {
  id: string;
  name: string;
}

/**
 * Names the script may use in place of ids. A quoted reference is read as an id when one matches,
 * otherwise as a name when exactly one entry has it. The stored AST always holds ids.
 */
export interface GhostScriptRefs {
  cards?: readonly GhostScriptRef[];
  /** Elements of the Card that owns the behaviors. */
  elements?: readonly GhostScriptRef[];
}

interface Resolver {
  resolve(text: string): string;
  display(id: string): string;
}

function makeResolver(list: readonly GhostScriptRef[] | undefined): Resolver {
  const items = list ?? [];
  const resolve = (text: string): string => {
    if (items.some((r) => r.id === text)) return text;
    const named = items.filter((r) => r.name === text);
    return named.length === 1 ? (named[0] as GhostScriptRef).id : text;
  };
  // A name is written only when reading it back gives the same id.
  const display = (id: string): string => {
    const ref = items.find((r) => r.id === id);
    return ref && ref.name !== '' && resolve(ref.name) === id ? ref.name : id;
  };
  return { resolve, display };
}

export const KEYWORDS = [
  'behavior',
  'on',
  'disabled',
  'when',
  'go',
  'set',
  'text',
  'show',
  'hide',
  'if',
  'else',
  'and',
  'or',
  'not',
  'true',
  'false',
  'next',
  'previous',
  'card',
  'list',
  'add',
  'remove',
  'clear',
  'at',
  'length',
  'item',
  'join',
] as const;
export const TRIGGER_NAMES = ['card.enter', 'element.click', 'element.change'] as const;

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED = new Set<string>(KEYWORDS);

/* Printer */

const PREC: Record<BinaryOp, number> = {
  or: 1,
  and: 2,
  '==': 3,
  '!=': 3,
  '<': 3,
  '<=': 3,
  '>': 3,
  '>=': 3,
  '+': 4,
  '-': 4,
  '*': 5,
  '/': 5,
  '%': 5,
};

const str = (s: string): string => JSON.stringify(s);

function key(k: string): string {
  return IDENT.test(k) && !RESERVED.has(k) ? k : `@${str(k)}`;
}

function lit(v: StateValue): string {
  return typeof v === 'string' ? str(v) : String(v);
}

function printExpr(e: Expr, parentPrec = 0, isRight = false): string {
  switch (e.kind) {
    case 'literal':
      return lit(e.value);
    case 'state':
      return key(e.key);
    case 'not': {
      const inner = printExpr(e.arg, 6);
      return `not ${inner}`;
    }
    case 'listLength':
      return `length(${key(e.key)})`;
    case 'listItem':
      return `item(${key(e.key)}, ${printExpr(e.index)})`;
    case 'listJoin':
      return `join(${key(e.key)}, ${str(e.separator)})`;
    case 'binary': {
      const p = PREC[e.op];
      const text = `${printExpr(e.left, p, false)} ${e.op} ${printExpr(e.right, p, true)}`;
      return p < parentPrec || (p === parentPrec && isRight) ? `(${text})` : text;
    }
  }
}

interface Printers {
  card: Resolver;
  element: Resolver;
}

function printActions(actions: readonly ActionNode[], indent: string, refs: Printers): string[] {
  const out: string[] = [];
  for (const a of actions) {
    switch (a.type) {
      case 'navigate':
        out.push(`${indent}go ${str(refs.card.display(a.cardId))}`);
        break;
      case 'setState':
        out.push(`${indent}set ${key(a.key)} = ${printExpr(a.value)}`);
        break;
      case 'setText':
        out.push(`${indent}text ${str(refs.element.display(a.elementId))} = ${printExpr(a.value)}`);
        break;
      case 'show':
      case 'hide':
        out.push(`${indent}${a.type} ${str(refs.element.display(a.elementId))}`);
        break;
      case 'nextCard':
        out.push(`${indent}next card`);
        break;
      case 'prevCard':
        out.push(`${indent}previous card`);
        break;
      case 'listAdd':
        out.push(`${indent}list add ${key(a.key)} = ${printExpr(a.value)}`);
        break;
      case 'listRemove':
        out.push(`${indent}list remove ${key(a.key)} at ${printExpr(a.index)}`);
        break;
      case 'listSet':
        out.push(`${indent}list set ${key(a.key)} at ${printExpr(a.index)} = ${printExpr(a.value)}`);
        break;
      case 'listClear':
        out.push(`${indent}list clear ${key(a.key)}`);
        break;
      case 'if':
        out.push(`${indent}if ${printExpr(a.condition)} {`);
        out.push(...printActions(a.then, `${indent}  `, refs));
        out.push(a.else.length > 0 ? `${indent}} else {` : `${indent}}`);
        if (a.else.length > 0) {
          out.push(...printActions(a.else, `${indent}  `, refs));
          out.push(`${indent}}`);
        }
        break;
    }
  }
  return out;
}

/**
 * Canonical text for behaviors. With `refs`, cards and elements are written by name where the name
 * is unique. `parseGhostScript(printGhostScript(x, refs), refs)` equals `x`.
 */
export function printGhostScript(behaviors: readonly Behavior[], refs: GhostScriptRefs = {}): string {
  const printers: Printers = { card: makeResolver(refs.cards), element: makeResolver(refs.elements) };
  const blocks = behaviors.map((b) => {
    const head = `behavior ${str(b.behaviorId)} on ${b.trigger}${b.enabled ? '' : ' disabled'} {`;
    const body = [
      ...b.conditions.map((c) => `  when ${printExpr(c)}`),
      ...printActions(b.actions, '  ', printers),
    ];
    return [head, ...body, '}'].join('\n');
  });
  return blocks.length > 0 ? `${blocks.join('\n\n')}\n` : '';
}

/* Lexer */

type Tok =
  | { t: 'word'; v: string; line: number; col: number }
  | { t: 'num'; v: number; line: number; col: number }
  | { t: 'str'; v: string; line: number; col: number }
  | { t: 'op'; v: string; line: number; col: number }
  | { t: 'eof'; v: ''; line: number; col: number };

class ParseError extends Error {
  constructor(
    message: string,
    readonly line: number,
    readonly col: number,
  ) {
    super(message);
  }
}

const OPS = ['<=', '>=', '==', '!=', '<', '>', '+', '-', '*', '/', '%', '=', '{', '}', '(', ')', '@', ','];

function lex(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const adv = (n: number): void => {
    for (let k = 0; k < n; k++) {
      if (src[i] === '\n') {
        line++;
        col = 1;
      } else col++;
      i++;
    }
  };
  while (i < src.length) {
    const c = src[i] as string;
    if (/\s/.test(c)) {
      adv(1);
      continue;
    }
    if (src.startsWith('//', i)) {
      while (i < src.length && src[i] !== '\n') adv(1);
      continue;
    }
    const at = { line, col };
    if (c === '"') {
      const m = /^"(?:\\.|[^"\\\n])*"/.exec(src.slice(i));
      if (!m) throw new ParseError('Unterminated string', at.line, at.col);
      let v: string;
      try {
        v = JSON.parse(m[0]) as string;
      } catch {
        throw new ParseError('Invalid escape in string', at.line, at.col);
      }
      toks.push({ t: 'str', v, ...at });
      adv(m[0].length);
      continue;
    }
    const num = /^(?:\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(src.slice(i));
    if (num) {
      toks.push({ t: 'num', v: Number(num[0]), ...at });
      adv(num[0].length);
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i));
    if (word) {
      toks.push({ t: 'word', v: word[0], ...at });
      adv(word[0].length);
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new ParseError(`Unexpected character "${c}"`, at.line, at.col);
    toks.push({ t: 'op', v: op, ...at });
    adv(op.length);
  }
  toks.push({ t: 'eof', v: '', line, col });
  return toks;
}

/* Parser */

const EXPR_STOP = new Set<string>([
  'go',
  'set',
  'text',
  'show',
  'hide',
  'if',
  'else',
  'when',
  'behavior',
  'next',
  'previous',
  'list',
]);

class Parser {
  private p = 0;
  readonly behaviorLines: number[] = [];
  private readonly card: Resolver;
  private readonly element: Resolver;
  constructor(
    private readonly toks: Tok[],
    refs: GhostScriptRefs,
  ) {
    this.card = makeResolver(refs.cards);
    this.element = makeResolver(refs.elements);
  }

  private get cur(): Tok {
    return this.toks[this.p] as Tok;
  }
  private fail(message: string, tok: Tok = this.cur): never {
    throw new ParseError(message, tok.line, tok.col);
  }
  private isOp(v: string): boolean {
    return this.cur.t === 'op' && this.cur.v === v;
  }
  private isWord(v: string): boolean {
    return this.cur.t === 'word' && this.cur.v === v;
  }
  private expectOp(v: string): void {
    if (!this.isOp(v)) this.fail(`Expected "${v}"`);
    this.p++;
  }
  private expectWord(v: string): void {
    if (!this.isWord(v)) this.fail(`Expected "${v}"`);
    this.p++;
  }
  private expectString(what: string): string {
    const t = this.cur;
    if (t.t !== 'str') this.fail(`Expected ${what} in quotes`);
    this.p++;
    return (t as Extract<Tok, { t: 'str' }>).v;
  }

  parseAll(): Behavior[] {
    const out: Behavior[] = [];
    while (this.cur.t !== 'eof') out.push(this.behavior());
    return out;
  }

  private behavior(): Behavior {
    if (!this.isWord('behavior')) this.fail('Expected "behavior"');
    this.behaviorLines.push(this.cur.line);
    this.p++;
    const behaviorId = this.expectString('the behavior id');
    if (!this.isWord('on')) this.fail('Expected "on" and a trigger');
    this.p++;
    const tt = this.cur;
    if (tt.t !== 'word' || !(TRIGGER_NAMES as readonly string[]).includes(tt.v)) {
      this.fail(`Unknown trigger. Use ${TRIGGER_NAMES.join(', ')}`);
    }
    this.p++;
    const trigger = (tt as Extract<Tok, { t: 'word' }>).v as Trigger;
    let enabled = true;
    if (this.isWord('disabled')) {
      enabled = false;
      this.p++;
    }
    this.expectOp('{');
    const conditions: Expr[] = [];
    while (this.isWord('when')) {
      this.p++;
      conditions.push(this.expr());
    }
    const actions = this.actions();
    this.expectOp('}');
    return { behaviorId, trigger, conditions, actions, enabled };
  }

  private actions(): ActionNode[] {
    const out: ActionNode[] = [];
    for (;;) {
      const t = this.cur;
      if (t.t === 'op' && t.v === '}') return out;
      if (t.t !== 'word') this.fail('Expected an action or "}"');
      const w = (t as Extract<Tok, { t: 'word' }>).v;
      this.p++;
      switch (w) {
        case 'go':
          out.push({ type: 'navigate', cardId: this.card.resolve(this.expectString('the card name or id')) });
          break;
        case 'set': {
          const k = this.stateKey();
          this.expectOp('=');
          out.push({ type: 'setState', key: k, value: this.expr() });
          break;
        }
        case 'text': {
          const elementId = this.element.resolve(this.expectString('the element name or id'));
          this.expectOp('=');
          out.push({ type: 'setText', elementId, value: this.expr() });
          break;
        }
        case 'show':
        case 'hide':
          out.push({
            type: w,
            elementId: this.element.resolve(this.expectString('the element name or id')),
          });
          break;
        case 'next':
          this.expectWord('card');
          out.push({ type: 'nextCard' });
          break;
        case 'previous':
          this.expectWord('card');
          out.push({ type: 'prevCard' });
          break;
        case 'list':
          out.push(this.listAction());
          break;
        case 'if': {
          const condition = this.expr();
          this.expectOp('{');
          const then = this.actions();
          this.expectOp('}');
          let els: ActionNode[] = [];
          if (this.isWord('else')) {
            this.p++;
            this.expectOp('{');
            els = this.actions();
            this.expectOp('}');
          }
          out.push({ type: 'if', condition, then, else: els });
          break;
        }
        default:
          this.p--;
          this.fail(
            `Unknown action "${w}". Use go, set, text, show, hide, if, next card, previous card or list`,
          );
      }
    }
  }

  private listAction(): ActionNode {
    const t = this.cur;
    const verb = t.t === 'word' ? t.v : '';
    if (!['add', 'remove', 'set', 'clear'].includes(verb))
      this.fail('Expected add, remove, set or clear after "list"');
    this.p++;
    const listKey = this.stateKey();
    switch (verb) {
      case 'add':
        this.expectOp('=');
        return { type: 'listAdd', key: listKey, value: this.expr() };
      case 'remove':
        this.expectWord('at');
        return { type: 'listRemove', key: listKey, index: this.expr() };
      case 'set': {
        this.expectWord('at');
        const index = this.expr();
        this.expectOp('=');
        return { type: 'listSet', key: listKey, index, value: this.expr() };
      }
      default:
        return { type: 'listClear', key: listKey };
    }
  }

  private stateKey(): string {
    if (this.isOp('@')) {
      this.p++;
      return this.expectString('the state name');
    }
    const t = this.cur;
    if (t.t !== 'word' || !IDENT.test(t.v) || RESERVED.has(t.v)) this.fail('Expected a state variable name');
    this.p++;
    return (t as Extract<Tok, { t: 'word' }>).v;
  }

  private listExpr(fn: 'length' | 'item' | 'join'): Expr {
    this.p++; // function name
    this.expectOp('(');
    const listKey = this.stateKey();
    let result: Expr;
    if (fn === 'length') {
      result = { kind: 'listLength', key: listKey };
    } else if (fn === 'item') {
      this.expectOp(',');
      result = { kind: 'listItem', key: listKey, index: this.expr() };
    } else {
      this.expectOp(',');
      result = { kind: 'listJoin', key: listKey, separator: this.expectString('the separator') };
    }
    this.expectOp(')');
    return result;
  }

  expr(min = 1): Expr {
    let left = this.unary();
    for (;;) {
      const t = this.cur;
      const op = t.t === 'op' || (t.t === 'word' && (t.v === 'and' || t.v === 'or')) ? t.v : undefined;
      if (op === undefined || !(BINARY_OPS as readonly string[]).includes(op)) return left;
      const prec = PREC[op as BinaryOp];
      if (prec < min) return left;
      this.p++;
      const right = this.expr(prec + 1);
      left = { kind: 'binary', op: op as BinaryOp, left, right };
    }
  }

  private unary(): Expr {
    if (this.isWord('not')) {
      this.p++;
      return { kind: 'not', arg: this.unary() };
    }
    return this.primary();
  }

  private primary(): Expr {
    const t = this.cur;
    if (t.t === 'num') {
      this.p++;
      return { kind: 'literal', value: t.v };
    }
    if (t.t === 'str') {
      this.p++;
      return { kind: 'literal', value: t.v };
    }
    if (t.t === 'op' && t.v === '-' && this.toks[this.p + 1]?.t === 'num') {
      this.p += 2;
      return { kind: 'literal', value: -(this.toks[this.p - 1] as Extract<Tok, { t: 'num' }>).v };
    }
    if (t.t === 'op' && t.v === '(') {
      this.p++;
      const e = this.expr();
      this.expectOp(')');
      return e;
    }
    if (t.t === 'op' && t.v === '@') {
      this.p++;
      return { kind: 'state', key: this.expectString('the state name') };
    }
    if (t.t === 'word') {
      if (t.v === 'true' || t.v === 'false') {
        this.p++;
        return { kind: 'literal', value: t.v === 'true' };
      }
      const next = this.toks[this.p + 1];
      if ((t.v === 'length' || t.v === 'item' || t.v === 'join') && next?.t === 'op' && next.v === '(') {
        return this.listExpr(t.v);
      }
      if (IDENT.test(t.v) && !RESERVED.has(t.v) && !EXPR_STOP.has(t.v)) {
        this.p++;
        return { kind: 'state', key: t.v };
      }
    }
    return this.fail(
      t.t === 'eof' ? 'Unexpected end of script' : `Unexpected "${String(t.v)}" in expression`,
    );
  }
}

/**
 * Parses GhostScript into the canonical AST. Never throws. Reports the first error with line and
 * column. `refs` lets the script name cards and elements; the result holds ids.
 */
export function parseGhostScript(source: string, refs: GhostScriptRefs = {}): GhostScriptParseResult {
  try {
    const parser = new Parser(lex(source), refs);
    const behaviors = parser.parseAll();
    const checked = BehaviorSchema.array().safeParse(behaviors);
    if (!checked.success) {
      const first = checked.error.issues[0];
      const index = typeof first?.path[0] === 'number' ? first.path[0] : 0;
      return {
        ok: false,
        issues: [
          {
            line: parser.behaviorLines[index] ?? 1,
            column: 1,
            message: first?.message ?? 'Invalid behavior',
          },
        ],
      };
    }
    return { ok: true, behaviors: checked.data };
  } catch (e) {
    if (e instanceof ParseError)
      return { ok: false, issues: [{ line: e.line, column: e.col, message: e.message }] };
    throw e;
  }
}

/* Domain error mapping */

const SUBJECTS: RegExp[] = [
  /navigates to unknown card (.+)$/,
  /sets unknown state variable (.+)$/,
  /sets list (.+) with set\./,
  /targets unknown element (.+)$/,
  /reads unknown state variable (.+)$/,
  /reads list (.+) as a value/,
  /uses (.+), which is not a list variable/,
];

/**
 * Maps a domain rejection message (from `validateStack`) to a position in `source`: the line that
 * mentions the offending id or variable inside the named behavior, else that behavior's header.
 * Returns line 1 when the message names no behavior in the script.
 */
export function locateDomainIssue(source: string, message: string): { line: number; column: number } {
  const lines = source.split('\n');
  const headers: { line: number; id: string }[] = [];
  lines.forEach((text, i) => {
    const m = /^\s*behavior\s+("(?:\\.|[^"\\])*")/.exec(text);
    if (!m) return;
    try {
      headers.push({ line: i, id: JSON.parse(m[1] as string) as string });
    } catch {
      /* the parser reports a broken header */
    }
  });
  const dup = /^Duplicate behavior id (.+) on /.exec(message);
  const prefix = (id: string): string => `Behavior ${id}`;
  const matches = headers.filter((h) =>
    dup
      ? h.id === dup[1]
      : message.startsWith(prefix(h.id)) && /^[ :]/.test(message.slice(prefix(h.id).length)),
  );
  const chosen = dup ? matches[matches.length - 1] : matches.sort((a, b) => b.id.length - a.id.length)[0];
  if (!chosen) return { line: 1, column: 1 };
  const nextHeader = headers.find((h) => h.line > chosen.line);
  const hit = { ...chosen, end: nextHeader ? nextHeader.line : lines.length };
  const rest = message.slice(prefix(chosen.id).length);
  let subject: string | undefined;
  for (const re of SUBJECTS) {
    const m = re.exec(rest);
    if (m) {
      subject = m[1];
      break;
    }
  }
  if (subject !== undefined) {
    const quoted = JSON.stringify(subject);
    for (let i = hit.line + 1; i < hit.end; i++) {
      const text = lines[i] as string;
      const q = text.indexOf(quoted);
      if (q >= 0) return { line: i + 1, column: q + 1 };
      const w = new RegExp(
        `(^|[^A-Za-z0-9_])${subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_])`,
      ).exec(text);
      if (w) return { line: i + 1, column: w.index + w[1]!.length + 1 };
    }
  }
  const onTrigger = /\bon\s+/.exec(lines[hit.line] as string);
  const triggerIssue = /trigger|card\.enter|element\.change/.test(rest);
  return { line: hit.line + 1, column: triggerIssue && onTrigger ? onTrigger.index + 1 : 1 };
}
