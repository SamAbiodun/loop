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

function cleanQuestion(q) {
  // Keep the prose up to the first example / IO section; collapse whitespace.
  const cut = q.split(/-----|Example|\bInput\b\s*[:\n]/)[0];
  return cut.replace(/\s+/g, " ").trim();
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
    const question = cleanQuestion(String(row.question || ""));
    // APPS interview problems are mostly stdin/stdout with no starter code;
    // filter on a read-aloud-friendly length and supply a blank stub.
    if (question.length < 60 || question.length > 900) continue;
    picked.push({
      id: `open-${row.problem_id}`,
      title: titleFrom(String(row.question), row.problem_id),
      difficulty: "Medium",
      category: "Open Dataset (APPS · interview)",
      statement: question,
      constraints: [],
      targetComplexity: "—",
      starterCode: starter || "// Write your solution here.\n",
      source: "open",
    });
    if (picked.length >= WANT) break;
  }
}

writeFileSync(OUT, JSON.stringify(picked, null, 2) + "\n");
console.log(`wrote ${picked.length} open problems to ${OUT.pathname}`);
