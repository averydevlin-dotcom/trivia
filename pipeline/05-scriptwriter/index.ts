import Anthropic from "@anthropic-ai/sdk";
import type { GeneratedQuestion } from "../02-generator/index";

export const CATEGORIES = [
  "Pop Culture + The Arts",
  "Sports",
  "Health + Wellness",
  "Food + Drink",
  "Money",
  "Fun Science",
  "Things You Forgot In School",
  "News That Won't Make You Sad",
] as const;

export interface BrightSparkEpisode {
  date: string;
  dayOfWeek: string;
  category: string;
  subcategory: string;
  difficulty: string;
  question: string;
  answer: string;
  context?: string;
  script: string;
  tracks: EpisodeTrack[];
  tomorrowCategory?: string;
  isFunDay?: boolean;
}

export interface EpisodeTrack {
  trackId: number;
  label: string;
  content: string;
  isMusicCue?: boolean;
}

const SYS = `You write scripts for Bright Spark, a daily audio morning trivia alarm.
TONE: Warm, matter-of-fact, dry, confident. No exclamation marks. No "Wow!", "Amazing!" ever. Think Sandy Toksvig on QI.
TRACK STRUCTURE (all 12):
1. Welcome + tagline: "Good morning. This is Bright Spark." + one-line episode tagline.
2. Date: "It's [weekday], [Month] [ordinal]."
3. Category: "Today's category is [Category]." For Fun Observance, announce the observance: "Today is [Observance Name]!"
4. Contextual tease: 1-2 sentences, no answer spoilers.
5. Question ask 1: "Here's today's question." + question verbatim.
6. Question ask 2: "Here it is again." + question verbatim.
7. Thinking break: EXACTLY "[MUSIC_CUE: THINKING_BREAK_30S]" only.
8. Answer reveal: "The answer is [Answer]."
9. Context + personality beat: 2-4 sentences, end with dry kicker.
10. Sign-off: "That's Bright Spark for [weekday]."
11. Tomorrow tease: "Tomorrow we're looking at [next category]."
12. Goodbye: "See you then."
OUTPUT (JSON only): {"tracks":[{"trackId":1,"label":"Welcome + Tagline","content":"..."},...]} Track 7 must have "isMusicCue":true.`;

export async function writeEpisode(q: GeneratedQuestion, apiKey: string, tomorrowCategory?: string): Promise<BrightSparkEpisode> {
  const client = new Anthropic({ apiKey });
  const prompt = `Write the full Bright Spark episode.\nDate: ${q.date}\nDay: ${q.dayOfWeek}\nCategory: ${q.category}${q.isFunDay ? " (Fun Observance Day)" : ""}\nSubcategory/Observance: ${q.subcategory}\nDifficulty: ${q.difficulty}\nQuestion: ${q.question}\nAnswer: ${q.answer}\nContext: ${q.context}\n${q.isTimely ? `Timely: ${q.timelyNote}` : ""}\nTomorrow: ${tomorrowCategory ?? "(any Bright Spark category)"}\nJSON only.`;
  const r = await client.messages.create({
    model: "claude-sonnet-4-6", max_tokens: 1200, system: SYS,
    messages: [{ role: "user", content: prompt }],
  });
  const text = (r.content[0] as { type: string; text: string }).text
    .trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  const parsed = JSON.parse(text) as { tracks: EpisodeTrack[] };
  return {
    date: q.date, dayOfWeek: q.dayOfWeek, category: q.category,
    subcategory: q.subcategory, difficulty: q.difficulty,
    question: q.question, answer: q.answer, context: q.context,
    script: parsed.tracks.map(t => t.content).join("\n\n"),
    tracks: parsed.tracks, tomorrowCategory, isFunDay: q.isFunDay,
  };
}
