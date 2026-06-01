"use client";

import dynamic from "next/dynamic";

// Monaco touches `window`, so it must not render on the server.
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-neutral-500">
      Loading editor…
    </div>
  ),
});

type CodeEditorProps = {
  value: string;
  language?: string;
  onChange: (value: string) => void;
};

export function CodeEditor({
  value,
  language = "typescript",
  onChange,
}: CodeEditorProps) {
  return (
    <MonacoEditor
      height="100%"
      language={language}
      theme="vs-dark"
      value={value}
      onChange={(next) => onChange(next ?? "")}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        scrollBeyondLastLine: false,
        tabSize: 2,
        automaticLayout: true,
      }}
    />
  );
}
