import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { autocompletion } from '@codemirror/autocomplete';
import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { setDiagnostics } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { tags } from '@lezer/highlight';
import { KEYWORDS, TRIGGER_NAMES } from '@ghoststack/behavior';
import type { GhostScriptIssue } from '@ghoststack/behavior';
import { indentWithTab } from '@codemirror/commands';

const WORDS = new Set<string>([...KEYWORDS, ...TRIGGER_NAMES]);

const language = StreamLanguage.define<null>({
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match(/^"(?:\\.|[^"\\])*"?/)) return 'string';
    if (stream.match(/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/)) return 'number';
    if (stream.match(/^[A-Za-z_][\w.]*/)) return WORDS.has(stream.current()) ? 'keyword' : 'variableName';
    stream.next();
    return 'operator';
  },
});

const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--gs-accent-2)', fontWeight: '600' },
  { tag: tags.string, color: 'var(--gs-text)', fontStyle: 'italic' },
  { tag: tags.number, color: 'var(--gs-text)' },
  { tag: tags.comment, color: 'var(--gs-text-dim)' },
  { tag: tags.variableName, color: 'var(--gs-text)' },
]);

const theme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--gs-bg)',
    color: 'var(--gs-text)',
    border: '1px solid var(--gs-border)',
    borderRadius: '8px',
  },
  '&.cm-focused': { outline: '2px solid var(--gs-accent-2)' },
  '.cm-content': {
    caretColor: 'var(--gs-text)',
    fontFamily: 'ui-monospace, Consolas, monospace',
    fontSize: '13px',
  },
  '.cm-gutters': { backgroundColor: 'var(--gs-panel)', color: 'var(--gs-text-dim)', border: 'none' },
  '.cm-tooltip': {
    backgroundColor: 'var(--gs-panel)',
    color: 'var(--gs-text)',
    border: '1px solid var(--gs-border)',
  },
});

export interface ScriptEditorProps {
  value: string;
  onChange: (text: string) => void;
  diagnostics: GhostScriptIssue[];
  words: { label: string; detail: string }[];
  /** Accessible name of the editing area. */
  label: string;
}

/** CodeMirror 6 editor for GhostScript with highlighting, autocomplete and live diagnostics. */
export function ScriptEditor({ value, onChange, diagnostics, words, label }: ScriptEditorProps): ReactNode {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const wordsRef = useRef(words);

  useEffect(() => {
    onChangeRef.current = onChange;
    wordsRef.current = words;
  });

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          language,
          syntaxHighlighting(highlight),
          theme,
          EditorView.contentAttributes.of({ 'aria-label': label }),
          autocompletion({
            override: [
              (ctx) => {
                const w = ctx.matchBefore(/[\w."]*/);
                if (!w || (w.from === w.to && !ctx.explicit)) return null;
                return {
                  from: w.from,
                  options: wordsRef.current.map((o) => ({ label: o.label, detail: o.detail })),
                };
              },
            ],
          }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // The editor is created once; later value changes sync in the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = view.current;
    if (!v || v.hasFocus || v.state.doc.toString() === value) return;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const doc = v.state.doc;
    v.dispatch(
      setDiagnostics(
        v.state,
        diagnostics.map((d) => {
          const line = doc.line(Math.min(Math.max(d.line, 1), doc.lines));
          const from = Math.min(line.from + Math.max(d.column - 1, 0), line.to);
          return {
            from,
            to: Math.min(from + 1, doc.length) > from ? Math.min(from + 1, doc.length) : from,
            severity: 'error' as const,
            message: d.message,
          };
        }),
      ),
    );
  }, [diagnostics, value]);

  return <div ref={host} className="gs-beh-script" />;
}
