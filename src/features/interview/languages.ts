/** Editor languages. `id` is the Monaco language id. TypeScript uses each
 *  problem's typed starter; other languages get a bare, directly-runnable
 *  starter generated from it (see `starterFor`), falling back to `stub`. */
export type Language = { id: string; label: string; stub: string };

export const LANGUAGES: Language[] = [
  { id: "typescript", label: "TypeScript", stub: "" },
  { id: "python", label: "Python", stub: "# Write your solution here\n" },
  { id: "javascript", label: "JavaScript", stub: "// Write your solution here\n" },
  {
    id: "java",
    label: "Java",
    stub: "class Main {\n    public static void main(String[] args) {\n\n    }\n}\n",
  },
  { id: "cpp", label: "C++", stub: "int main() {\n\n}\n" },
  {
    id: "csharp",
    label: "C#",
    stub: "using System;\n\npublic class Program {\n    public static void Main() {\n\n    }\n}\n",
  },
  { id: "go", label: "Go", stub: "package main\n\nfunc main() {\n\n}\n" },
  { id: "rust", label: "Rust", stub: "fn main() {\n\n}\n" },
];

export const DEFAULT_LANGUAGE = "typescript";

export function languageLabel(langId: string): string {
  return LANGUAGES.find((l) => l.id === langId)?.label ?? langId;
}

// ---------------------------------------------------------------------------
// Per-language starter generation (bare + runnable)
//
// Each problem ships a single TypeScript starter. For the other languages we
// parse the signature — function/method name, typed params, return type — and
// render a starter the candidate can Run directly (no hidden judge, no
// `class Solution` wrapper to instantiate). The function sits at top level
// (typed where the language requires it; untyped for Python/JS) with a
// placeholder body that still compiles (`throw`/`panic`/`todo!()`), the minimal
// entry point the language needs (`func main`, `int main`, etc.), and a
// commented sample call. Design problems (MinStack, …) render the class itself
// plus an entry point. Unparseable signatures fall back to `stub`.
//
// Note: custom node types (ListNode/TreeNode/…) are referenced by the signature
// but their definitions are not emitted.
// ---------------------------------------------------------------------------

type ParsedType = {
  base: "int" | "string" | "bool" | "void" | "custom";
  custom?: string;
  arrayDepth: number;
  nullable: boolean;
};

type Param = { name: string; type: ParsedType };
type Fn = { name: string; params: Param[]; ret: ParsedType };
type Klass = { name: string; ctor: Param[]; methods: Fn[] };

/** Split a comma list at top level, respecting <>, [], () nesting. */
function splitTopLevel(raw: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of raw) {
    if (ch === "<" || ch === "[" || ch === "(") depth++;
    else if (ch === ">" || ch === "]" || ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur);
  return out;
}

function parseType(raw: string): ParsedType {
  let t = raw.trim();
  let nullable = false;
  const stripNull = () => {
    t = t
      .replace(/\|\s*null/g, () => {
        nullable = true;
        return "";
      })
      .replace(/\|\s*undefined/g, () => {
        nullable = true;
        return "";
      })
      .trim();
  };
  stripNull();

  let arrayDepth = 0;
  for (;;) {
    const am = t.match(/^Array<(.+)>$/);
    if (am) {
      t = am[1].trim();
      arrayDepth++;
      continue;
    }
    if (t.endsWith("[]")) {
      t = t.slice(0, -2).trim();
      arrayDepth++;
      continue;
    }
    break;
  }
  stripNull();

  switch (t) {
    case "number":
      return { base: "int", arrayDepth, nullable };
    case "string":
      return { base: "string", arrayDepth, nullable };
    case "boolean":
      return { base: "bool", arrayDepth, nullable };
    case "void":
      return { base: "void", arrayDepth, nullable };
    default:
      return { base: "custom", custom: t, arrayDepth, nullable };
  }
}

function parseParamList(raw: string): Param[] {
  return splitTopLevel(raw)
    .map((p) => {
      const i = p.indexOf(":");
      return i === -1
        ? { name: p.trim(), type: parseType("number") }
        : { name: p.slice(0, i).trim(), type: parseType(p.slice(i + 1)) };
    })
    .filter((p) => p.name);
}

function parseFunctions(src: string): Fn[] {
  const re = /function\s+(\w+)\s*\(([^)]*)\)\s*:\s*([^{]+)\{/g;
  const fns: Fn[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    fns.push({ name: m[1], params: parseParamList(m[2]), ret: parseType(m[3]) });
  }
  return fns;
}

function parseClass(src: string): Klass | null {
  const nameM = src.match(/class\s+(\w+)\s*\{/);
  if (!nameM) return null;
  const ctorM = src.match(/constructor\s*\(([^)]*)\)/);
  const ctor = ctorM ? parseParamList(ctorM[1]) : [];
  // Methods carry a return-type annotation (`name(params): type {`); the
  // constructor has none, so this naturally skips it.
  const re = /(\w+)\s*\(([^)]*)\)\s*:\s*([^{;]+)\{/g;
  const methods: Fn[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    methods.push({ name: m[1], params: parseParamList(m[2]), ret: parseType(m[3]) });
  }
  return { name: nameM[1], ctor, methods };
}

// --- helpers ---
const pascal = (n: string) => n.charAt(0).toUpperCase() + n.slice(1);
const snake = (n: string) =>
  n.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
const names = (ps: Param[]) => ps.map((p) => p.name).join(", ");
const wrap = (s: string, depth: number, open: string, close: string) => {
  for (let i = 0; i < depth; i++) s = `${open}${s}${close}`;
  return s;
};
const isVoid = (t: ParsedType) => t.base === "void";

// --- per-language type rendering ---
function tsType(t: ParsedType): string {
  const s = { int: "number", string: "string", bool: "boolean", void: "void", custom: t.custom ?? "unknown" }[t.base];
  return s + "[]".repeat(t.arrayDepth) + (t.nullable && t.base === "custom" ? " | null" : "");
}
function javaType(t: ParsedType): string {
  const s = { int: "int", string: "String", bool: "boolean", void: "void", custom: t.custom ?? "Object" }[t.base];
  return s + "[]".repeat(t.arrayDepth);
}
function cppType(t: ParsedType, param: boolean): string {
  let s = { int: "int", string: "string", bool: "bool", void: "void", custom: `${t.custom ?? "auto"}*` }[t.base];
  s = wrap(s, t.arrayDepth, "vector<", ">");
  return param && t.arrayDepth > 0 ? `${s}&` : s;
}
function csType(t: ParsedType): string {
  const s = { int: "int", string: "string", bool: "bool", void: "void", custom: t.custom ?? "object" }[t.base];
  return s + "[]".repeat(t.arrayDepth);
}
function goType(t: ParsedType): string {
  const s = { int: "int", string: "string", bool: "bool", void: "", custom: `*${t.custom ?? ""}` }[t.base];
  return "[]".repeat(t.arrayDepth) + s;
}
function rustType(t: ParsedType): string {
  let s = { int: "i32", string: "String", bool: "bool", void: "()", custom: t.custom ?? "" }[t.base];
  if (t.base === "custom") s = t.nullable ? `Option<Box<${t.custom}>>` : `Box<${t.custom}>`;
  return wrap(s, t.arrayDepth, "Vec<", ">");
}

type LangSpec = {
  functions: (fns: Fn[]) => string;
  design: (c: Klass) => string;
};

const SPECS: Record<string, LangSpec> = {
  python: {
    functions: (fns) => {
      const body = fns
        .map((fn) => `def ${fn.name}(${names(fn.params)}):\n    pass`)
        .join("\n\n\n");
      return `${body}\n\n\n# print(${fns[0].name}(...))\n`;
    },
    design: (c) => {
      const init = `    def __init__(${["self", ...c.ctor.map((p) => p.name)].join(", ")}):\n        pass`;
      const ms = c.methods.map(
        (m) => `    def ${m.name}(${["self", ...m.params.map((p) => p.name)].join(", ")}):\n        pass`,
      );
      return `class ${c.name}:\n${[init, ...ms].join("\n\n")}\n`;
    },
  },
  javascript: {
    functions: (fns) => {
      const body = fns
        .map((fn) => `var ${fn.name} = function(${names(fn.params)}) {\n    \n};`)
        .join("\n\n");
      return `${body}\n\n// console.log(${fns[0].name}(...));\n`;
    },
    design: (c) => {
      const cons = `var ${c.name} = function(${names(c.ctor)}) {\n    \n};`;
      const ms = c.methods.map(
        (m) => `${c.name}.prototype.${m.name} = function(${names(m.params)}) {\n    \n};`,
      );
      return [cons, ...ms].join("\n\n") + "\n";
    },
  },
  typescript: {
    functions: (fns) => {
      const body = fns
        .map((fn) => {
          const ps = fn.params.map((p) => `${p.name}: ${tsType(p.type)}`).join(", ");
          const b = isVoid(fn.ret) ? "  \n" : `  throw new Error("Not implemented");\n`;
          return `function ${fn.name}(${ps}): ${tsType(fn.ret)} {\n${b}}`;
        })
        .join("\n\n");
      return `${body}\n\n// console.log(${fns[0].name}(...));\n`;
    },
    design: (c) => {
      const init = `  constructor(${c.ctor.map((p) => `${p.name}: ${tsType(p.type)}`).join(", ")}) {\n    \n  }`;
      const ms = c.methods.map((m) => {
        const ps = m.params.map((p) => `${p.name}: ${tsType(p.type)}`).join(", ");
        const b = isVoid(m.ret) ? "    \n" : `    throw new Error("Not implemented");\n`;
        return `  ${m.name}(${ps}): ${tsType(m.ret)} {\n${b}  }`;
      });
      return `class ${c.name} {\n${[init, ...ms].join("\n\n")}\n}\n`;
    },
  },
  java: {
    functions: (fns) => {
      const body = fns
        .map((fn) => {
          const ps = fn.params.map((p) => `${javaType(p.type)} ${p.name}`).join(", ");
          const b = isVoid(fn.ret) ? "        \n" : "        throw new UnsupportedOperationException();\n";
          return `    static ${javaType(fn.ret)} ${fn.name}(${ps}) {\n${b}    }`;
        })
        .join("\n\n");
      return `class Main {\n${body}\n\n    public static void main(String[] args) {\n        \n    }\n}\n`;
    },
    design: (c) => {
      const init = `    public ${c.name}(${c.ctor.map((p) => `${javaType(p.type)} ${p.name}`).join(", ")}) {\n        \n    }`;
      const ms = c.methods.map((m) => {
        const ps = m.params.map((p) => `${javaType(p.type)} ${p.name}`).join(", ");
        const b = isVoid(m.ret) ? "        \n" : "        throw new UnsupportedOperationException();\n";
        return `    public ${javaType(m.ret)} ${m.name}(${ps}) {\n${b}    }`;
      });
      return `class ${c.name} {\n${[init, ...ms].join("\n\n")}\n}\n\nclass Main {\n    public static void main(String[] args) {\n        \n    }\n}\n`;
    },
  },
  csharp: {
    functions: (fns) => {
      const body = fns
        .map((fn) => {
          const ps = fn.params.map((p) => `${csType(p.type)} ${p.name}`).join(", ");
          const b = isVoid(fn.ret) ? "        \n" : "        throw new NotImplementedException();\n";
          return `    static ${csType(fn.ret)} ${pascal(fn.name)}(${ps}) {\n${b}    }`;
        })
        .join("\n\n");
      return `using System;\n\npublic class Program {\n${body}\n\n    public static void Main() {\n        \n    }\n}\n`;
    },
    design: (c) => {
      const init = `    public ${c.name}(${c.ctor.map((p) => `${csType(p.type)} ${p.name}`).join(", ")}) {\n        \n    }`;
      const ms = c.methods.map((m) => {
        const ps = m.params.map((p) => `${csType(p.type)} ${p.name}`).join(", ");
        const b = isVoid(m.ret) ? "        \n" : "        throw new NotImplementedException();\n";
        return `    public ${csType(m.ret)} ${pascal(m.name)}(${ps}) {\n${b}    }`;
      });
      return `using System;\n\npublic class ${c.name} {\n${[init, ...ms].join("\n\n")}\n}\n\npublic class Program {\n    public static void Main() {\n        \n    }\n}\n`;
    },
  },
  cpp: {
    functions: (fns) => {
      const body = fns
        .map((fn) => {
          const ps = fn.params.map((p) => `${cppType(p.type, true)} ${p.name}`).join(", ");
          return `${cppType(fn.ret, false)} ${fn.name}(${ps}) {\n    \n}`;
        })
        .join("\n\n");
      return `#include <bits/stdc++.h>\nusing namespace std;\n\n${body}\n\nint main() {\n    \n}\n`;
    },
    design: (c) => {
      const init = `    ${c.name}(${c.ctor.map((p) => `${cppType(p.type, true)} ${p.name}`).join(", ")}) {\n        \n    }`;
      const ms = c.methods.map((m) => {
        const ps = m.params.map((p) => `${cppType(p.type, true)} ${p.name}`).join(", ");
        return `    ${cppType(m.ret, false)} ${m.name}(${ps}) {\n        \n    }`;
      });
      return `#include <bits/stdc++.h>\nusing namespace std;\n\nclass ${c.name} {\npublic:\n${[init, ...ms].join("\n\n")}\n};\n\nint main() {\n    \n}\n`;
    },
  },
  go: {
    functions: (fns) => {
      const body = fns
        .map((fn) => {
          const ps = fn.params.map((p) => `${p.name} ${goType(p.type)}`).join(", ");
          const ret = isVoid(fn.ret) ? "" : ` ${goType(fn.ret)}`;
          const b = isVoid(fn.ret) ? "    \n" : `    panic("Not implemented")\n`;
          return `func ${fn.name}(${ps})${ret} {\n${b}}`;
        })
        .join("\n\n");
      return `package main\n\n${body}\n\nfunc main() {\n    \n}\n`;
    },
    design: (c) => {
      const cons = `func Constructor(${c.ctor.map((p) => `${p.name} ${goType(p.type)}`).join(", ")}) ${c.name} {\n    panic("Not implemented")\n}`;
      const ms = c.methods.map((m) => {
        const ps = m.params.map((p) => `${p.name} ${goType(p.type)}`).join(", ");
        const ret = isVoid(m.ret) ? "" : ` ${goType(m.ret)}`;
        const b = isVoid(m.ret) ? "    \n" : `    panic("Not implemented")\n`;
        return `func (this *${c.name}) ${pascal(m.name)}(${ps})${ret} {\n${b}}`;
      });
      return `package main\n\ntype ${c.name} struct {\n    \n}\n\n${[cons, ...ms].join("\n\n")}\n\nfunc main() {\n    \n}\n`;
    },
  },
  rust: {
    functions: (fns) => {
      const body = fns
        .map((fn) => {
          const ps = fn.params.map((p) => `${snake(p.name)}: ${rustType(p.type)}`).join(", ");
          const ret = isVoid(fn.ret) ? "" : ` -> ${rustType(fn.ret)}`;
          return `fn ${snake(fn.name)}(${ps})${ret} {\n    todo!()\n}`;
        })
        .join("\n\n");
      return `${body}\n\nfn main() {\n    \n}\n`;
    },
    design: (c) => {
      const init = `    fn new(${c.ctor.map((p) => `${snake(p.name)}: ${rustType(p.type)}`).join(", ")}) -> Self {\n        todo!()\n    }`;
      const ms = c.methods.map((m) => {
        const ps = ["&self", ...m.params.map((p) => `${snake(p.name)}: ${rustType(p.type)}`)].join(", ");
        const ret = isVoid(m.ret) ? "" : ` -> ${rustType(m.ret)}`;
        return `    fn ${snake(m.name)}(${ps})${ret} {\n        todo!()\n    }`;
      });
      return `struct ${c.name} {\n\n}\n\nimpl ${c.name} {\n${[init, ...ms].join("\n\n")}\n}\n\nfn main() {\n    \n}\n`;
    },
  },
};

function buildStarter(spec: LangSpec, ts: string): string | null {
  // A `function` declaration means it's function-style; render those and ignore
  // helper type-defs (ListNode, TreeNode, …) that may precede them.
  if (/\bfunction\s+\w+\s*\(/.test(ts)) {
    const fns = parseFunctions(ts);
    return fns.length ? spec.functions(fns) : null;
  }
  const cls = parseClass(ts);
  return cls && cls.methods.length ? spec.design(cls) : null;
}

/** Starter content for a language: the problem's typed starter for TypeScript,
 *  otherwise a bare, directly-runnable starter derived from it (generic stub if
 *  the signature can't be parsed). */
export function starterFor(langId: string, typescriptStarter: string): string {
  if (langId === "typescript") return typescriptStarter;
  const stub = LANGUAGES.find((l) => l.id === langId)?.stub ?? "";
  const spec = SPECS[langId];
  if (!spec) return stub;
  return buildStarter(spec, typescriptStarter) ?? stub;
}
