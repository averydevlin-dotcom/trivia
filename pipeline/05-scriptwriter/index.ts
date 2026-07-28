/**
 * Stage 05 — SCRIPT WRITER (Claude Sonnet)
 *
 * Takes a finalized GeneratedQuestion and writes a full Bright Spark episode
 * following the exact track structure below.
 *
 * BRIGHT SPARK TRACK STRUCTURE:
 *  1. Welcome + tagline           ("Good morning. This is Bright Spark…")
 *  2. Today's date                ("It's [weekday], [Month] [day].")
 *  3. Category reveal             ("Today's category is [Category].")
 *  4. Contextual tease            (1–2 sentences warming up the topic area)
 *  5. Question — ask 1           (state the question once)
 *  6. Question — ask 2           ("Here it is again…" + repeat question)
 *  7. [MUSIC_CUE: THINKING_BREAK] (30-second thinking music; placeholder in script)
 *  8. Answer reveal               ("The answer is [Answer].")
 *  9. Context + personality beat  (2–4 sentences; ends with a dry, confident kicker)
 * 10. Sign-off                    ("That's Bright Spark for [weekday].")
 * 11. Tomorrow's category tease   ("Tomorrow we're looking at [next category].")
 * 12. Goodbye                     ("See you then.")
 *
 * The script is returned as a plain-text string ready for TTS.
 * JSON is also returned for storage and review.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { GeneratedQuestion } from "../02-generator/index";

export interface BrightSparkEpisode {
  date: string;
  dayOfWeek: string;
  category: string;
  subcategory: string;
  difficulty: string;
  question: string;
  answer: string;
  script: string;           // Full TTS-ready script
  tracks: EpisodeTrack[];   // Structured breakdown per track
  tomorrowCategory?: string;
}

export interface EpisodeTrack {
  trackId: number;
  label: string;
  content: string;   // Spoken text (empty string for music cues)
  isMusicCue?: boolean;
}

const SYSTEM_PROMPT = `You write scripts for Bright Spark, a daily audio morning trivia alarm. Your job is to take a trivia question and write the full episode script, track by track.

TONE: Warm but matter-of-fact. Dry, confident. Like the smartest person at the pub explaining something to a friend. No exclamation marks. No "Wow!", "Amazing!", "That's fascinating!" — ever. No AI-bot cheesiness. No rhetorical questions to the listener. Never say "I" (the host has no persona, just a voice). Think Sandy Toksvig hosting QI.

TRACK STRUCTURE (write all 12 tracks):
  1. Welcome + tagline: Short opening. "Good morning. This is Bright Spark." Then one-line tagline that introduces the episode's vibe — NOT the answer.
  2. Date: "It's [full weekday], [Month] [ordinal day]." (e.g., "It's Tuesday, July 28th.")
  3. Category: "Today's category is [Category]." Simple. Clean.
  4. Contextual tease: 1–2 sentences warming up the topic area. Does NOT give away the question or answer. Creates mild anticipation.
  5. Question — ask 1: State the question exactly as provided, preceded by nothing except perhaps "Here's today's question." Keep it matter-of-fact.
  6. Question — ask 2: "Here it is again." Then repeat the exact question verbatim.
  7. Thinking break cue: Exactly this text: "[MUSIC_CUE: THINKING_BREAK_30S]" — no other words.
  8. Answer reveal: "The answer is [Answer]." Simple, clean, no buildup.
  9. Context + personality beat: 2–4 sentences of context from the question. End with a dry kicker — a short observation that earns a small smile. Not a joke. Not a pun. Just something that lands.
  10. Sign-off: "That's Bright Spark for [weekday]."
  11. Tomorrow's category tease: "Tomorrow we're looking at [next category]." (Use the provided tomorrow category, or write a generic one if not provided.)
  12. Goodbye: "See you then." That's it. Nothing else.

OUTPUT FORMAT (JSON only, no markdown):
{
  "tracks": [
    { "trackId": 1, "label": "Welcome + Tagline", "content": "..." },
    { "trackId": 2, "label": "Date", "content": "..." },
    { "trackId": 3, "label": "Category", "content": "..." },
    { "trackId": 4, "label": "Contextual Tease", "content": "..." },
    { "trackId": 5, "label": "Question — Ask 1", "content": "..." },
    { "trackId": 6, "label": "Question — Ask 2", "content": "..." },
    { "trackId": 7, "label": "Thinking Break", "content": "[MUSIC_CUE: THINKING_BREAK_30S]", "isMusicCue": true },
    { "trackId": 8, "label": "Answer Reveal", "content": "..." },
    { "trackId": 9, "label": "Context + Personality Beat", "content": "..." },
    { "trackId": 10, "label": "Sign-off", "content": "..." },
    { "trackId": 11, "label": "Tomorrow Tease", "content": "..." },
    { "trackId": 12, "label": "Goodbye", "content": "..." }
  ]
}`;

function buildScriptPrompt(q: GeneratedQuestion, tomorrowCategory?: string): string {
  const tomorrowLine = tomorrowCategory
    ? `Tomorrow's category: ${tomorrowCategory}`
    : "Tomorrow's category: (pick any from the standard Bright Spark categories)";

  return `Write the full Bright Spark episode script for this question:

Date: ${q.date}
Day: ${q.dayOfWeek}
Category: ${q.category}
Subcategory: ${q.subcategory}
Difficulty: ${q.difficulty}
Question: ${q.question}
Answer: ${q.answer}
Context notes: ${q.context}
${q.isTimely ? `Timely note: ${q.timelyNote}` : ""}
${tomorrowLine}

Return only valid JSON. No markdown. No explanation.`;
}

/** Stitch all track content together into a single TTS-ready script */
function assembleFull(tracks: EpisodeTrack[]): string {
  return tracks
    .map((t) => t.content)
    .join("\n\n");
}

export async function writeEpisode(
  question: GeneratedQuestion,
  apiKey: string,
  tomorrowCategory?: string
): Promise<BrightSparkEpisode> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildScriptPrompt(question, tomorrowCategory) }],
  });

  const raw = (response.content[0] as { type: string; text: string }).text.trim();
  const cleaned = raw
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as { tracks: EpisodeTrack[] };
  const script = assembleFull(parsed.tracks);

  return {
    date: question.date,
    dayOfWeek: question.dayOfWeek,
    category: question.category,
    subcategory: question.subcategory,
    difficulty: question.difficulty,
    question: question.question,
    answer: question.answer,
    script,
    tracks: parsed.tracks,
    tomorrowCategory,
  };
}
