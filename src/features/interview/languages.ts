/** Editor languages. `id` is the Monaco language id. TypeScript uses each
 *  problem's typed starter; other languages get a minimal stub. */
export type Language = { id: string; label: string; stub: string };

export const LANGUAGES: Language[] = [
  { id: "typescript", label: "TypeScript", stub: "" },
  { id: "python", label: "Python", stub: "# Write your solution here\n" },
  { id: "javascript", label: "JavaScript", stub: "// Write your solution here\n" },
  {
    id: "java",
    label: "Java",
    stub: "class Solution {\n    // Write your solution here\n}\n",
  },
  { id: "cpp", label: "C++", stub: "// Write your solution here\n" },
  {
    id: "csharp",
    label: "C#",
    stub: "public class Solution {\n    // Write your solution here\n}\n",
  },
  { id: "go", label: "Go", stub: "// Write your solution here\n" },
  { id: "rust", label: "Rust", stub: "// Write your solution here\n" },
];

export const DEFAULT_LANGUAGE = "typescript";

/** Starter content for a language: the problem's typed starter for TypeScript,
 *  otherwise the language's stub. */
export function starterFor(langId: string, typescriptStarter: string): string {
  if (langId === "typescript") return typescriptStarter;
  return LANGUAGES.find((l) => l.id === langId)?.stub ?? "";
}

export function languageLabel(langId: string): string {
  return LANGUAGES.find((l) => l.id === langId)?.label ?? langId;
}
