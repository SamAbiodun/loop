// Fetches a slice of the open APPS dataset (interview split) from the
// HuggingFace datasets-server and writes a cleaned JSON the app can opt into.
// Run: node scripts/build-problems.mjs
import { writeFileSync } from "node:fs";

const DATASET = "codeparrot/apps";
const OUT = new URL(
  "../src/features/interview/problems.open.json",
  import.meta.url,
);
const WANT = 30;

function cleanText(value) {
  return value
    .replace(/\$+/g, "")
    .replace(/\\leq?/g, "≤")
    .replace(/\\geq?/g, "≥")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanQuestion(q) {
  // Candidate-facing statement only. Examples, IO boilerplate and constraints
  // are extracted into structured fields below.
  const cut = q.split(/-----|\bExamples?\b\s*[:\n]|\bInput\b\s*[:\n]|\bConstraints?\b\s*[:\n]/i)[0];
  return cleanText(cut);
}

function extractExamples(question) {
  const examples = [];
  const examplesMarker = question.search(/-{3,}\s*Examples?\s*-{3,}/i);
  const source = examplesMarker >= 0 ? question.slice(examplesMarker) : question;
  const re = /\bInput\b\s*:?\s*([\s\S]*?)\bOutput\b\s*:?\s*([\s\S]*?)(?=\bInput\b\s*:?|\bExamples?\b\s*:?|\bNote\b\s*:?|\bConstraints?\b\s*:?|$)/gi;
  let match;
  while ((match = re.exec(source)) && examples.length < 3) {
    const input = cleanText(match[1].replace(/^-{3,}|-{3,}$/g, "")).slice(0, 400);
    const output = cleanText(match[2].replace(/^-{3,}|-{3,}$/g, "")).slice(0, 400);
    if (input && output) examples.push({ input, output });
  }
  return examples;
}

function extractConstraints(question) {
  const match = question.match(
    /\bConstraints?\b\s*:?\s*([\s\S]*?)(?=\bInput\b\s*:?|\bOutput\b\s*:?|\bExamples?\b\s*:?|\bNote\b\s*:?|$)/i,
  );
  const source =
    match?.[1] ??
    question.match(
      /\bInput\b\s*[-:]*\s*([\s\S]*?)(?=\bOutput\b\s*[-:]*)/i,
    )?.[1] ??
    "";
  if (!source) return [];
  return source
    .split(/\n|•|(?<=\.)\s+(?=[A-Za-z0-9$])/)
    .map((item) => cleanText(item.replace(/^[-*]\s*/, "")))
    .filter((item) => item.length >= 3 && !/^-+$/.test(item))
    .slice(0, 8);
}

function titleFrom(q, id) {
  const first = cleanQuestion(q).split(/[.!?]/)[0].trim();
  if (first.length >= 8 && first.length <= 70) return first;
  return `Community Problem #${id}`;
}

async function fetchPage(offset, length) {
  const url =
    `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(DATASET)}` +
    `&config=interview&split=test&offset=${offset}&length=${length}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HF ${res.status} at offset ${offset}`);
  return (await res.json()).rows.map((r) => r.row);
}

const picked = [];
for (let offset = 0; offset < 600 && picked.length < WANT; offset += 100) {
  const rows = await fetchPage(offset, 100);
  for (const row of rows) {
    const starter = String(row.starter_code || "").trim();
    const rawQuestion = String(row.question || "");
    const question = cleanQuestion(rawQuestion);
    // APPS interview problems are mostly stdin/stdout with no starter code;
    // filter on a read-aloud-friendly length and supply a blank stub.
    if (question.length < 60 || question.length > 900) continue;
    picked.push({
      id: `open-${row.problem_id}`,
      title: titleFrom(String(row.question), row.problem_id),
      difficulty: "Medium",
      category: "Open Dataset (APPS · interview)",
      statement: question,
      constraints: extractConstraints(rawQuestion),
      targetComplexity: "—",
      starterCode: starter || "// Write your solution here.\n",
      examples: extractExamples(rawQuestion),
      source: "open",
    });
    if (picked.length >= WANT) break;
  }
}

writeFileSync(OUT, JSON.stringify(picked, null, 2) + "\n");
console.log(`wrote ${picked.length} open problems to ${OUT.pathname}`);
