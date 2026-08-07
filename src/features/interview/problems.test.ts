import { describe, expect, it } from "vitest";
import {
  DEFAULT_INTERVIEW_CONSTRAINTS,
  OPEN_PROBLEMS,
  PROBLEMS,
} from "./problems";

describe("problem bank", () => {
  it("contains the expected curated and opt-in pools", () => {
    expect(PROBLEMS).toHaveLength(150);
    expect(OPEN_PROBLEMS).toHaveLength(30);
  });

  it("has unique IDs and complete interview context", () => {
    const all = [...PROBLEMS, ...OPEN_PROBLEMS];
    expect(new Set(all.map((problem) => problem.id)).size).toBe(all.length);
    for (const problem of all) {
      expect(problem.statement.trim().length).toBeGreaterThan(20);
      expect(problem.constraints.length).toBeGreaterThan(0);
      expect(problem.examples.length).toBeGreaterThan(0);
      expect(problem.starterCode.length).toBeGreaterThan(0);
    }
  });

  it("uses explicit assumption rules when exact platform bounds are withheld", () => {
    expect(DEFAULT_INTERVIEW_CONSTRAINTS).toHaveLength(2);
    expect(PROBLEMS.every((problem) => problem.constraints.length > 0)).toBe(true);
  });
});
