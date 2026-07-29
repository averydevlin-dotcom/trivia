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
  isFunDay?: boolean;
}

const DL: Record<number, "Easy" | "Medium" | "Hard"> = {
  1: "Easy", 2: "Easy", 3: "Medium", 4: "Medium", 5: "Hard",
};

const SYS = `You write trivia questions for Bright Spark, a daily audio morning alarm.
TONE: Matter-of-fact, dry, confident. Like the smartest person at the pub. Not wacky or AI-bot cheesy.
HOOK RULE: Every question must earn its place. Good hooks: opposite of expected, unfamiliar origin, small reveals big, comparison reframes scale.
CORE RULE (Jeopardy): Clue leads to answer. Listener reasons toward it.
ANSWERS: 1-3 words. Not in question. Not obvious. Not unguessable.
BANNED: politics, wars, death, disease, religion, colonization, animal harm, trick questions.

DIFFICULTY — calibrated for a curious, well-read adult in their 30s, NOT a trivia expert:
Easy: The answer feels obvious the moment they hear it. They think "I knew that." Anchor: knowing the Caesar salad comes from Mexico, not Italy.
Medium: They have to actually think. They might get it, they might not. If they get it, they feel smart. Anchor: knowing Abraham Lincoln was a wrestler.
Hard: They probably won't get it cold — but the answer feels FAIR and satisfying, not random. NOT pub-quiz-champion obscure. Anchor: knowing the marathon distance was set for the British royal family's sightline.

SUBCATEGORY RULE: Pick the LEAST OBVIOUS angle that still works. Avoid category defaults — the first thing anyone would think of. Aim for surprising specificity.
OUTPUT (JSON only, no markdown): {"subcategory":"...","question":"...","answer":"...","context":"2-4 sentences for the ear.","fcNote":"optional"}`;

const FUN_DAY_SYS = `You write trivia questions for Bright Spark, a daily audio morning alarm.
TONE: Matter-of-fact, dry, warm. Like a friend who just learned something delightful.
CORE RULE (Jeopardy): Clue leads to answer. Listener reasons toward it.
ANSWERS: 1-3 words. Not in question. Satisfying to get.
BANNED: politics, wars, death, disease, religion, colonization, animal harm, trick questions.

This is a FUN OBSERVANCE EPISODE. You need to:
1. Pick ONE real observance, anniversary, or cultural moment from the given month — something that actually exists
2. Good picks: national food days, quirky awareness days, famous invention/movie/book anniversaries, birthdays of beloved cultural figures, world record days
3. The pick should make the listener think "wait, is that actually a thing?" — then confirm it is
4. Build a trivia question around a surprising fact connected to that observance
5. NOT grim, not controversial, not obscure — it should feel like a fun discovery

IMPORTANT: In your "context" field, start with "Today is [Observance Name]!" so the host can announce the special day.

Examples of great picks: "National Coffee Day", "the day the first iPhone launched", "Back to the Future Day", "World Emoji Day", "Roald Dahl's birthday", "the day Velcro was invented"

OUTPUT (JSON only): {"subcategory":"[the observance name]","question":"...","answer":"...","context":"Start with 'Today is [Name]!' then 2-3 more sentences. Confirm the observance is real and add a surprising detail.","fcNote":"optional"}`;

export async function generateQuestion(
  plan: DayPlan,
  exemplars: object[],
  apiKey: string,
  avoidSubcategories?: string[],
  retryAttempt?: number
): Promise<GeneratedQuestion> {
  const client = new Anthropic({ apiKey });
  const diff = DL[plan.difficulty];

  if (plan.isFunDay) {
    const monthName = new Date(plan.date + "T00:00:00").toLocaleString("default", { month: "long", year: "numeric" });
    const avoidNote = avoidSubcategories?.length
      ? `\nALREADY USED — pick something different: ${avoidSubcategories.join(", ")}`
      : "";
    const retryNote = retryAttempt && retryAttempt > 1
      ? `\nRETRY ${retryAttempt}: Previous picks failed. Choose a COMPLETELY different observance.`
      : "";
    const prompt = `Generate one Fun Observance trivia question for Bright Spark.\nDate: ${plan.date} (${plan.dayOfWeek})\nMonth: ${monthName}\nDifficulty: ${diff}${avoidNote}${retryNote}\n\nReturn only valid JSON.`;
    const r = await client.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 600, system: FUN_DAY_SYS,
      messages: [{ role: "user", content: prompt }],
    });
    const text = (r.content[0] as { type: string; text: string }).text
      .trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(text);
    return {
      date: plan.date, dayOfWeek: plan.dayOfWeek, difficulty: diff,
      category: "Fun Observance", subcategory: parsed.subcategory,
      question: parsed.question, answer: parsed.answer, context: parsed.context,
      fcNote: parsed.fcNote || undefined, isTimely: plan.isTimely,
      timelyNote: plan.timelyNote, isFunDay: true,
    };
  }

  const catExemplars = exemplars.filter((e: unknown) => (e as { category: string }).category === plan.category);
  const pool = catExemplars.length >= 2 ? catExemplars : exemplars;
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
  const ex = shuffled.map((e: unknown) => {
    const ex = e as { difficulty: string; subcategory: string; question: string; answer: string; context: string };
    return `Example (${ex.difficulty}, ${ex.subcategory}):\nQ: ${ex.question}\nA: ${ex.answer}\nContext: ${ex.context}`;
  }).join("\n\n");

  const timely = plan.isTimely ? `\nAirs on ${plan.date} — ${plan.timelyNote}. Feel tied to the occasion without being obvious.` : "";
  const avoidNote = avoidSubcategories?.length
    ? `\nAVOID THESE SUBCATEGORIES (already used): ${avoidSubcategories.join(", ")}.`
    : "";
  const retryNote = retryAttempt && retryAttempt > 1
    ? `\nRETRY ATTEMPT ${retryAttempt}: Previous attempts failed. Pick a RADICALLY different angle.`
    : "";

  const prompt = `Generate one trivia question for Bright Spark.\nDate: ${plan.date} (${plan.dayOfWeek})\nCategory: ${plan.category}\nDifficulty: ${diff} (${plan.difficulty}/5)${timely}${avoidNote}${retryNote}\n\nGREEN-graded examples:\n\n${ex}\n\nReturn only valid JSON.`;
  const r = await client.messages.create({
    model: "claude-sonnet-4-6", max_tokens: 600, system: SYS,
    messages: [{ role: "user", content: prompt }],
  });
  const text = (r.content[0] as { type: string; text: string }).text
    .trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  const parsed = JSON.parse(text);
  return {
    date: plan.date, dayOfWeek: plan.dayOfWeek, difficulty: diff,
    category: plan.category as string, subcategory: parsed.subcategory,
    question: parsed.question, answer: parsed.answer, context: parsed.context,
    fcNote: parsed.fcNote || undefined, isTimely: plan.isTimely,
    timelyNote: plan.timelyNote, isFunDay: false,
  };
}
