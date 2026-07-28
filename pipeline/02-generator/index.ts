/**
 * Stage 02 — GENERATOR (Claude Sonnet)
 *
 * Given a DayPlan from the Planner, generates a trivia Q+A draft
 * calibrated against the exemplar bank.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { DayPlan } from "../01-planner/index";

export interface GeneratedQuestion {
  date: string;
  dayOfWeek: string;
  difficulty: "Easy" | "Medium" | "Hard";
  category: string;
  subcategory: string;
  question: string;
  answer: string;
  context: string;
  fcNote?: string;
  isTimely: boolean;
  timelyNote?: string;
}

const DIFFICULTY_LABEL: Record<number, "Easy" | "Medium" | "Hard"> = {
  1: "Easy",
  2: "Easy",
  3: "Medium",
  4: "Medium",
  5: "Hard",
};

const SYSTEM_PROMPT = `You write trivia questions for Bright Spark, a daily audio alarm product called Bright Spark. Questions air on a morning alarm — the listener hears the question, gets 30 seconds to think, then hears the answer and a short burst of context.

TONE: Matter-of-fact, dry, confident. Like the smartest person at the pub. Not wacky, not AI-bot cheesy. Think QI-era Sandy Toksvig.

THE HOOK RULE
Every question must earn its place. Ask: why would someone be glad they know this? The fact must be genuinely interesting — surprising, counterintuitive, or reframing something the listener thought they understood.

Good hooks:
- The thing is the opposite of what you'd expect (aluminum once rarer than gold)
- Familiar thing has an unfamiliar origin (Caesar salad invented in Mexico)
- Something small reveals something bigger (wet cabbage leaves → Babe Ruth's heat strategy)
- A comparison reframes scale (Oxford older than the Aztec Empire)

Weak hooks: just a specific number, just a surprising location, "did you know X was actually invented by Y" (only works if Y is genuinely surprising)

THE CORE RULE (Jeopardy model)
The clue contains the information that leads to the answer. The listener should be able to reason toward the answer. The answer is the destination. The clue is the map.

ANSWERS THAT WORK: names of people, names of things, places, clean concepts, amounts where the surprise IS the number.

ANSWERS THAT DON'T WORK:
- Multi-sentence phrases (answer must be 1–3 words max)
- Answers that are obvious from the question itself
- The answer is already in the question
- Specific percentages or years that are impossible to guess
- Vague concepts where multiple answers feel equally plausible

WHAT TO AVOID (hard bans):
- Divisive politics, wars, death, disease, anything alarming first thing in the morning
- Religion, religious groups, religious history
- Colonization or forced displacement
- Animals being harmed or killed
- Trick/gotcha questions
- Questions where the answer could be several different things

DIFFICULTY GUIDE:
- Easy (1–2): Most adults have heard of the subject. The surprise is in the angle.
- Medium (3): Requires some knowledge but the clue gives a strong path to the answer.
- Hard (4–5): Genuinely obscure, but the answer feels satisfying and earned, not random.

SUBCATEGORY: A specific, Jeopardy-style label said aloud on air. Not broad ("Music") — narrow ("Classic Rock Songs", "The Human Body"). One notch below the category bucket.

OUTPUT FORMAT (JSON only, no markdown, no explanation):
{
  "subcategory": "...",
  "question": "...",
  "answer": "...",
  "context": "2–4 sentences written for the ear.",
  "fcNote": "optional — only if genuinely uncertain about a fact"
}`;

function buildUserPrompt(plan: DayPlan, exemplars: object[]): string {
  const difficultyLabel = DIFFICULTY_LABEL[plan.difficulty];

  // Pick 3 relevant exemplars (same difficulty or same category if possible)
  const relevant = exemplars.slice(0, 3);

  const exemplarText = relevant
    .map(
      (e: any) =>
        `Example (${e.difficulty}, ${e.subcategory}):\nQ: ${e.question}\nA: ${e.answer}\nContext: ${e.context}`
    )
    .join("\n\n");

  const timelyContext = plan.isTimely
    ? `\nThis question will air on ${plan.date} — ${plan.timelyNote}. The question should feel tied to that occasion without being the most obvious angle.`
    : "";

  return `Generate one trivia question for Bright Spark.

Date: ${plan.date} (${plan.dayOfWeek})
Category: ${plan.category}
Difficulty: ${difficultyLabel} (${plan.difficulty}/5)${timelyContext}

Pick a specific subcategory within "${plan.category}" that has a strong hook. The subcategory must be a plain, descriptive label like "Classic Rock Songs" or "The Human Body" — not generic.

Here are examples of GREEN-graded questions (use these to calibrate tone and quality):

${exemplarText}

Return only valid JSON. No markdown, no explanation.`;
}

export async function generateQuestion(
  plan: DayPlan,
  exemplars: object[],
  apiKey: string
): Promise<GeneratedQuestion> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(plan, exemplars) }],
  });

  const raw = (response.content[0] as { type: string; text: string }).text.trim();

  // Strip any accidental markdown fences
  const cleaned = raw
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  return {
    date: plan.date,
    dayOfWeek: plan.dayOfWeek,
    difficulty: DIFFICULTY_LABEL[plan.difficulty],
    category: plan.category,
    subcategory: parsed.subcategory,
    question: parsed.question,
    answer: parsed.answer,
    context: parsed.context,
    fcNote: parsed.fcNote || undefined,
    isTimely: plan.isTimely,
    timelyNote: plan.timelyNote,
  };
}
