"use client";

import dynamic from "next/dynamic";
import type { Monaco } from "@monaco-editor/react";

// Monaco touches `window`, so it must not render on the server.
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-neutral-500">
      Loading editor…
    </div>
  ),
});

/** vs-dark, re-tinted to sit flush on the app's neutral-950 background. */
function defineLoopTheme(monaco: Monaco) {
  monaco.editor.defineTheme("loop-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#0a0a0a",
      "editor.lineHighlightBackground": "#17171780",
      "editorGutter.background": "#0a0a0a",
      "editorLineNumber.foreground": "#3f3f46",
      "editorLineNumber.activeForeground": "#a1a1aa",
      "editorIndentGuide.background1": "#1c1c1f",
      "editorIndentGuide.activeBackground1": "#33333a",
      "editorWidget.background": "#131316",
      "editorWidget.border": "#27272a",
      "editorSuggestWidget.background": "#131316",
      "editorSuggestWidget.selectedBackground": "#1d4ed830",
      "scrollbarSlider.background": "#27272a66",
      "scrollbarSlider.hoverBackground": "#3f3f4699",
      "scrollbar.shadow": "#00000000",
      "editorOverviewRuler.border": "#00000000",
      "focusBorder": "#00000000",
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
      theme="loop-dark"
      beforeMount={defineLoopTheme}
      value={value}
      onChange={(next) => onChange(next ?? "")}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineHeight: 22,
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
        fontLigatures: true,
      }}
    />
  );
}
