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
    case 'binary': {
      const p = PREC[e.op];
      const text = `${printExpr(e.left, p, false)} ${e.op} ${printExpr(e.right, p, true)}`;
      return p < parentPrec || (p === parentPrec && isRight) ? `(${text})` : text;
    }
  }
}

function printActions(actions: readonly ActionNode[], indent: string): string[] {
  const out: string[] = [];
  for (const a of actions) {
    switch (a.type) {
      case 'navigate':
        out.push(`${indent}go ${str(a.cardId)}`);
        break;
      case 'setState':
        out.push(`${indent}set ${key(a.key)} = ${printExpr(a.value)}`);
        break;
      case 'setText':
        out.push(`${indent}text ${str(a.elementId)} = ${printExpr(a.value)}`);
        break;
      case 'show':
      case 'hide':
        out.push(`${indent}${a.type} ${str(a.elementId)}`);
        break;
      case 'if':
        out.push(`${indent}if ${printExpr(a.condition)} {`);
        out.push(...printActions(a.then, `${indent}  `));
        out.push(a.else.length > 0 ? `${indent}} else {` : `${indent}}`);
        if (a.else.length > 0) {
          out.push(...printActions(a.else, `${indent}  `));
          out.push(`${indent}}`);
        }
        break;
    }
  }
  return out;
}

/** Canonical text for behaviors. `parseGhostScript(printGhostScript(x))` equals `x`. */
export function printGhostScript(behaviors: readonly Behavior[]): string {
  const blocks = behaviors.map((b) => {
    const head = `behavior ${str(b.behaviorId)} on ${b.trigger}${b.enabled ? '' : ' disabled'} {`;
    const body = [...b.conditions.map((c) => `  when ${printExpr(c)}`), ...printActions(b.actions, '  ')];
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

const OPS = ['<=', '>=', '==', '!=', '<', '>', '+', '-', '*', '/', '%', '=', '{', '}', '(', ')', '@'];

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

const EXPR_STOP = new Set<string>(['go', 'set', 'text', 'show', 'hide', 'if', 'else', 'when', 'behavior']);

class Parser {
  private p = 0;
  constructor(private readonly toks: Tok[]) {}

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
          out.push({ type: 'navigate', cardId: this.expectString('the card id') });
          break;
        case 'set': {
          const k = this.stateKey();
          this.expectOp('=');
          out.push({ type: 'setState', key: k, value: this.expr() });
          break;
        }
        case 'text': {
          const elementId = this.expectString('the element id');
          this.expectOp('=');
          out.push({ type: 'setText', elementId, value: this.expr() });
          break;
        }
        case 'show':
        case 'hide':
          out.push({ type: w, elementId: this.expectString('the element id') });
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
          this.fail(`Unknown action "${w}". Use go, set, text, show, hide or if`);
      }
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

/** Parses GhostScript into the canonical AST. Never throws. Reports the first error with line and column. */
export function parseGhostScript(source: string): GhostScriptParseResult {
  try {
    const behaviors = new Parser(lex(source)).parseAll();
    const checked = BehaviorSchema.array().safeParse(behaviors);
    if (!checked.success) {
      return {
        ok: false,
        issues: [{ line: 1, column: 1, message: checked.error.issues[0]?.message ?? 'Invalid behavior' }],
      };
    }
    return { ok: true, behaviors: checked.data };
  } catch (e) {
    if (e instanceof ParseError)
      return { ok: false, issues: [{ line: e.line, column: e.col, message: e.message }] };
    throw e;
  }
}
