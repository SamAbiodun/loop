import { describe, expect, it } from "vitest";
import { LANGUAGES, starterFor } from "./languages";
import { PROBLEMS } from "./problems";

const COMPILED_LANGUAGES = ["java", "cpp", "csharp", "go", "rust"];
const HELPERS = ["ListNode", "TreeNode", "RNode", "GraphNode"];

describe("language starters", () => {
  it("generates a non-empty starter for every problem and language", () => {
    for (const problem of PROBLEMS) {
      for (const language of LANGUAGES) {
        expect(starterFor(language.id, problem.starterCode).trim()).not.toBe("");
      }
    }
  });

  it("emits custom node definitions for compiled languages", () => {
    for (const problem of PROBLEMS) {
      const required = HELPERS.filter((name) =>
        problem.starterCode.includes(`class ${name}`),
      );
      for (const language of COMPILED_LANGUAGES) {
        const starter = starterFor(language, problem.starterCode);
        for (const helper of required) {
          const declaration =
            language === "cpp"
              ? `struct ${helper}`
              : language === "go"
                ? `type ${helper} struct`
                : language === "rust"
                  ? `struct ${helper}`
                  : `class ${helper}`;
          expect(starter, `${problem.id}/${language}`).toContain(declaration);
        }
      }
    }
  });
});
