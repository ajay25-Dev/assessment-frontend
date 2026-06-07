"use client";

import { useMemo, useRef } from "react";

type CodeEditorProps = {
  value: string;
  language: string;
  onChange: (value: string) => void;
  minHeight?: number;
};

export function CodeEditor({ value, language, onChange, minHeight = 420 }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbers = useMemo(() => {
    const lineCount = Math.max(1, value.split("\n").length);
    return Array.from({ length: lineCount }, (_, index) => index + 1);
  }, [value]);

  function insertToken(token: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(`${value}${token}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextValue = `${value.slice(0, start)}${token}${value.slice(end)}`;
    onChange(nextValue);

    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab") return;
    event.preventDefault();
    insertToken("  ");
  }

  return (
    <div
      className="grid h-full min-h-0 grid-rows-[auto_1fr] overflow-hidden rounded-[8px] border border-slate-800 bg-slate-950"
      style={{ minHeight }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-3 py-2">
        <div className="flex flex-wrap gap-1">
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
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {language}
        </span>
      </div>

      <div className="grid min-h-0 grid-cols-[48px_1fr] overflow-hidden">
        <pre className="select-none overflow-hidden border-r border-slate-800 bg-slate-900 px-3 py-4 text-right font-mono text-sm leading-6 text-slate-500">
          {lineNumbers.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </pre>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="h-full min-h-0 w-full resize-none overflow-auto bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-100 outline-none"
        />
      </div>
    </div>
  );
}
