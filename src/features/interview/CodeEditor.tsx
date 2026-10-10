"use client";

import dynamic from "next/dynamic";
import type { Monaco } from "@monaco-editor/react";
import { commit } from "@/app/fonts";

// Monaco touches `window`, so it must not render on the server.
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-xs uppercase tracking-widest text-ink-subtle">
      Loading editor…
    </div>
  ),
});

/** Greyscale syntax theme, flush with the night background. Weight and
 *  brightness do the work colour used to: keywords sit one step down from
 *  identifiers, functions are the brightest, comments are dim and italic. */
function defineLoopTheme(monaco: Monaco) {
  monaco.editor.defineTheme("loop-night", {
    base: "vs-dark",
    inherit: false,
    rules: [
      { token: "", foreground: "e6e8ec" },
      { token: "keyword", foreground: "c5c9d1", fontStyle: "bold" },
      { token: "type", foreground: "c5c9d1" },
      { token: "type.identifier", foreground: "c5c9d1" },
      { token: "identifier", foreground: "e6e8ec" },
      { token: "string", foreground: "9aa0ab" },
      { token: "number", foreground: "c5c9d1" },
      { token: "comment", foreground: "848a97", fontStyle: "italic" },
      { token: "delimiter", foreground: "9aa0ab" },
      { token: "operator", foreground: "9aa0ab" },
      { token: "tag", foreground: "c5c9d1" },
      { token: "attribute.name", foreground: "9aa0ab" },
      { token: "attribute.value", foreground: "9aa0ab" },
    ],
    colors: {
      "editor.background": "#0b0d12",
      "editor.foreground": "#e6e8ec",
      "editor.lineHighlightBackground": "#181b21",
      "editor.selectionBackground": "#2a2e36",
      "editor.inactiveSelectionBackground": "#181b21",
      "editorCursor.foreground": "#f7f8fa",
      "editorGutter.background": "#0b0d12",
      "editorLineNumber.foreground": "#454952",
      "editorLineNumber.activeForeground": "#9aa0ab",
      "editorIndentGuide.background1": "#181b21",
      "editorIndentGuide.activeBackground1": "#2a2e36",
      "editorWidget.background": "#181b21",
      "editorWidget.border": "#2a2e36",
      "editorSuggestWidget.background": "#181b21",
      "editorSuggestWidget.selectedBackground": "#2a2e36",
      "editorSuggestWidget.foreground": "#e6e8ec",
      "editorBracketMatch.background": "#2a2e36",
      "editorBracketMatch.border": "#454952",
      // Bracket-pair colourisation stays on for nesting depth, in grey steps.
      "editorBracketHighlight.foreground1": "#e6e8ec",
      "editorBracketHighlight.foreground2": "#9aa0ab",
      "editorBracketHighlight.foreground3": "#c5c9d1",
      "editorBracketHighlight.foreground4": "#848a97",
      "editorBracketHighlight.foreground5": "#e6e8ec",
      "editorBracketHighlight.foreground6": "#9aa0ab",
      "editorBracketHighlight.unexpectedBracket.foreground": "#f7f8fa",
      // Diagnostics: brightness, not hue. Errors are the brightest squiggle.
      "editorError.foreground": "#f7f8fa",
      "editorWarning.foreground": "#c5c9d1",
      "editorInfo.foreground": "#9aa0ab",
      "editorHint.foreground": "#848a97",
      "scrollbarSlider.background": "#2a2e3699",
      "scrollbarSlider.hoverBackground": "#454952aa",
      "scrollbar.shadow": "#00000000",
      "editorOverviewRuler.border": "#00000000",
      focusBorder: "#00000000",
    },
  });
}

type CodeEditorProps = {
  value: string;
  language?: string;
  /** Unique per buffer (problem + language). Giving each buffer its own Monaco
   *  model keeps undo history, cursor, and scroll position per language —
   *  without it, undo after a language switch restores the other language's
   *  code into the current buffer. */
  path?: string;
  onChange: (value: string) => void;
};

export function CodeEditor({
  value,
  language = "typescript",
  path,
  onChange,
}: CodeEditorProps) {
  return (
    <MonacoEditor
      height="100%"
      language={language}
      path={path}
      theme="loop-night"
      beforeMount={defineLoopTheme}
      // next/font renames the family, so Monaco must receive the resolved
      // stack; remeasure once the file has loaded or the caret drifts on the
      // fallback's metrics.
      onMount={(_editor, monaco) => {
        document.fonts.ready.then(() => monaco.editor.remeasureFonts());
      }}
      value={value}
      onChange={(next) => onChange(next ?? "")}
      options={{
        minimap: { enabled: false },
        fontFamily: commit.style.fontFamily,
        fontSize: 14,
        lineHeight: 22,
        fontLigatures: false,
        scrollBeyondLastLine: false,
        tabSize: 2,
        automaticLayout: true,
        padding: { top: 14, bottom: 10 },
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        smoothScrolling: true,
        renderLineHighlight: "line",
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        guides: { indentation: true },
      }}
    />
  );
}
