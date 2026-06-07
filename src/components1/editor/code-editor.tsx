"use client";

import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { PostgreSQL, sql } from "@codemirror/lang-sql";
import { EditorState } from "@codemirror/state";
import { keymap, lineNumbers, EditorView } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { useEffect, useMemo, useRef, useState } from "react";

type CodeEditorProps = {
  value: string;
  language: string;
  onChange: (value: string) => void;
  minHeight?: number;
};

function languageExtension(language: string) {
  if (language === "python") return python();
  if (language === "java") return java();
  if (language === "cpp" || language === "c") return cpp();
  if (language === "sql") return sql({ dialect: PostgreSQL });
  return javascript({ jsx: true, typescript: language === "typescript" });
}

export function CodeEditor({ value, language, onChange, minHeight = 420 }: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [failed, setFailed] = useState(false);

  const extensions = useMemo(
    () => [
      lineNumbers(),
      keymap.of([indentWithTab]),
      languageExtension(language),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onChange(update.state.doc.toString());
      }),
      EditorView.theme({
        "&": {
          minHeight: `${minHeight}px`,
          height: "100%",
          background: "#0f172a",
          color: "#e2e8f0",
          fontSize: "14px",
        },
        ".cm-scroller": {
          fontFamily: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Consolas, monospace",
          minHeight: `${minHeight}px`,
        },
        ".cm-gutters": {
          background: "#111827",
          color: "#94a3b8",
          borderRightColor: "#263244",
        },
        ".cm-activeLine": { background: "#1e293b" },
        ".cm-activeLineGutter": { background: "#1e293b" },
        ".cm-content": { padding: "14px 0" },
        ".cm-line": { padding: "0 14px" },
      }),
      EditorState.tabSize.of(2),
    ],
    [language, minHeight, onChange],
  );

  useEffect(() => {
    if (!hostRef.current) return;

    try {
      const state = EditorState.create({ doc: value, extensions });
      const view = new EditorView({ state, parent: hostRef.current });
      viewRef.current = view;

      return () => {
        view.destroy();
        viewRef.current = null;
      };
    } catch {
      window.setTimeout(() => setFailed(true), 0);
    }
    // The editor is created once for the current language. Document updates are
    // synchronized by the separate value effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extensions]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  function insertToken(token: string) {
    const view = viewRef.current;
    if (!view) {
      onChange(`${value}${token}`);
      return;
    }

    const range = view.state.selection.main;
    view.dispatch({
      changes: { from: range.from, to: range.to, insert: token },
      selection: { anchor: range.from + token.length },
    });
    view.focus();
  }

  if (failed) {
    return (
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className="h-full min-h-[420px] w-full resize-none bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-100 outline-none"
      />
    );
  }

  return (
    <div className="grid h-full min-h-[420px] grid-rows-[auto_1fr] overflow-hidden rounded-[8px] border border-slate-800 bg-slate-950">
      <div className="flex flex-wrap gap-1 border-b border-slate-800 bg-slate-900 px-2 py-2">
        {["Tab", "()", "[]", "{}", ";", "=>"].map((token) => (
          <button
            key={token}
            type="button"
            onClick={() => insertToken(token === "Tab" ? "  " : token)}
            className="h-8 rounded-[6px] border border-slate-700 px-2 font-mono text-xs text-slate-200 hover:bg-slate-800"
          >
            {token}
          </button>
        ))}
      </div>
      <div ref={hostRef} className="h-full min-h-[420px]" />
    </div>
  );
}
