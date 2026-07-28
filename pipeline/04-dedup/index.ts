/**
 * Stage 04 — DIVERSITY / DEDUP CHECK (rules-based)
 *
 * Two checks:
 *   1. Subcategory cap: max 2 questions with the same subcategory per month
 *   2. Simple keyword overlap: blocks questions that are too similar to recent ones
 *      (no embedding API needed — keyword jaccard similarity is good enough for trivia)
 */

import type { GeneratedQuestion } from "../02-generator/index";

export interface DedupResult {
  pass: boolean;
  reason?: string;
}

/** Load past month's approved questions from history (for cross-month dedup) */
export function loadHistory(historyPath: string): GeneratedQuestion[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    if (!fs.existsSync(historyPath)) return [];
    const raw = fs.readFileSync(historyPath, "utf-8");
    return JSON.parse(raw) as GeneratedQuestion[];
  } catch {
    return [];
  }
}

/**
 * Normalise text to a set of meaningful words (strip stop words, lowercase).
 */
function keywordSet(text: string): Set<string> {
  const stopWords = new Set([
    "a","an","the","is","it","in","on","of","to","and","or","was","were","be",
    "been","has","have","had","for","at","by","this","that","with","from","as",
    "but","not","are","its","what","which","who","how","when","where","why",
  ]);
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w))
  );
}

/** Jaccard similarity between two keyword sets */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Main dedup check.
 * @param candidate     The newly generated question
 * @param monthSoFar    Questions already approved this month (in memory)
 * @param recentHistory Questions from recent past months (from disk)
 */
export function checkDedup(
  candidate: GeneratedQuestion,
  monthSoFar: GeneratedQuestion[],
  recentHistory: GeneratedQuestion[] = []
): DedupResult {
  const allPast = [...monthSoFar, ...recentHistory];

  // 1. Subcategory cap — max 2 per month
  const subcatCount = monthSoFar.filter(
    (q) => q.subcategory.toLowerCase() === candidate.subcategory.toLowerCase()
  ).length;
  if (subcatCount >= 2) {
    return {
      pass: false,
      reason: `Subcategory "${candidate.subcategory}" already used ${subcatCount} times this month (max 2)`,
    };
  }

  // 2. Keyword similarity — flag if > 40% overlap with any recent question
  const candidateKeywords = keywordSet(candidate.question + " " + candidate.answer);
  for (const past of allPast) {
    const pastKeywords = keywordSet(past.question + " " + past.answer);
    const sim = jaccardSimilarity(candidateKeywords, pastKeywords);
    if (sim > 0.4) {
      return {
        pass: false,
        reason: `Too similar to existing question (${Math.round(sim * 100)}% keyword overlap): "${past.question.slice(0, 60)}..."`,
      };
    }
  }

  // 3. Exact answer match — block same answer within same month
  const lcAnswer = candidate.answer.toLowerCase().trim();
  const duplicateAnswer = monthSoFar.find(
    (q) => q.answer.toLowerCase().trim() === lcAnswer
  );
  if (duplicateAnswer) {
    return {
      pass: false,
      reason: `Answer "${candidate.answer}" already used this month`,
    };
  }

  return { pass: true };
}
