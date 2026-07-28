/**
 * Stage 03 — GUARDRAIL CLASSIFIER (Claude Haiku)
 *
 * Checks a generated question against:
 *   1. Banned topic list (politics, war, death, religion, colonization, animal harm, disease)
 *   2. Difficulty tag match (does the question feel like the assigned difficulty?)
 *   3. Word count (question ≤ 35 words, answer ≤ 5 words)
 *   4. Answer quality (not already in the question, not obvious, not a vague concept)
 *
 * Returns { pass: true } or { pass: false, reason: "..." }
 * Caller should retry stage 2 on failure.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { GeneratedQuestion } from "../02-generator/index";

export interface GuardrailResult {
  pass: boolean;
  reason?: string;
  flags?: string[];
}

const SYSTEM_PROMPT = `You are a strict quality-control classifier for a morning trivia alarm show. Your only job is to check whether a trivia question passes all the rules below. Respond with JSON only.

BANNED TOPICS — auto-fail if the question touches any of these:
- Divisive politics or political figures
- Wars, battles, military conflicts
- Death, disease, illness, pandemics
- Religion, religious groups, religious history
- Colonization or forced displacement
- Animal harm, killing, or distress
- Radiation, weapons, dangerous substances
- Anything alarming or upsetting first thing in the morning

ANSWER QUALITY — auto-fail if:
- The answer is already stated in the question text
- The answer is longer than 5 words
- The answer is a vague concept where multiple things feel equally correct
- The answer is genuinely unguessable from the clue

DIFFICULTY CHECK — flag (not auto-fail) if the question feels mismatched:
- Easy should be approachable for most adults
- Medium requires some knowledge but clue gives a strong path
- Hard is obscure but satisfying when revealed

WORD COUNT — flag if the question is over 40 words

Respond with this exact JSON:
{
  "pass": true or false,
  "reason": "brief reason if failed",
  "flags": ["optional list of warnings even if pass=true"]
}`;

function buildCheckPrompt(q: GeneratedQuestion): string {
  return `Check this trivia question:

Category: ${q.category}
Subcategory: ${q.subcategory}
Difficulty: ${q.difficulty}
Question: ${q.question}
Answer: ${q.answer}
Context: ${q.context}

Does it pass all the rules? Return JSON only.`;
}

export async function runGuardrail(
  question: GeneratedQuestion,
  apiKey: string
): Promise<GuardrailResult> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildCheckPrompt(question) }],
  });

  const raw = (response.content[0] as { type: string; text: string }).text.trim();
  const cleaned = raw
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  return JSON.parse(cleaned) as GuardrailResult;
}

/**
 * Also runs a basic local word-count check before calling the API,
 * saving a Haiku call if the question is clearly over-length.
 */
export function localWordCountCheck(q: GeneratedQuestion): GuardrailResult | null {
  const wordCount = q.question.split(/\s+/).length;
  const answerWordCount = q.answer.split(/\s+/).length;

  if (wordCount > 50) {
    return { pass: false, reason: `Question too long: ${wordCount} words (max 50)` };
  }
  if (answerWordCount > 5) {
    return { pass: false, reason: `Answer too long: ${answerWordCount} words (max 5)` };
  }
  return null; // passes local check, proceed to Haiku
}
