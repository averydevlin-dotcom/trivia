import type { GeneratedQuestion } from "../02-generator/index";

export interface DedupResult {
  pass: boolean;
  reason?: string;
}

type QSummary = { subcategory: string; question: string; answer: string };

function keywords(text: string): Set<string> {
  const stop = new Set(["a","an","the","is","it","in","on","of","to","and","or","was","were","be","been","has","have","had","for","at","by","this","that","with","from","as","but","not","are","its","what","which","who","how","when","where","why"]);
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 2 && !stop.has(w))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const inter = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : inter.size / union.size;
}

export function checkDedup(candidate: GeneratedQuestion, allSoFar: QSummary[]): DedupResult {
  const subcatCount = allSoFar.filter(q => q.subcategory.toLowerCase() === candidate.subcategory.toLowerCase()).length;
  if (subcatCount >= 3) return { pass: false, reason: `Subcategory "${candidate.subcategory}" used ${subcatCount}× already` };

  const ck = keywords(candidate.question + " " + candidate.answer);
  for (const past of allSoFar) {
    if (jaccard(ck, keywords(past.question + " " + past.answer)) > 0.55) {
      return { pass: false, reason: "Too similar to an existing question" };
    }
  }

  const lcA = candidate.answer.toLowerCase().trim();
  if (allSoFar.find(q => q.answer.toLowerCase().trim() === lcA)) {
    return { pass: false, reason: "Answer already used" };
  }

  return { pass: true };
}

// Keep legacy export for CLI runner
export function loadHistory(): QSummary[] { return []; }
