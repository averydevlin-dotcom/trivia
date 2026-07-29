import Anthropic from "@anthropic-ai/sdk";
import type { GeneratedQuestion } from "../02-generator/index";

export interface GuardrailResult {
  pass: boolean;
  reason?: string;
  flags?: string[];
}

const SYS = `Quality-control classifier for a morning trivia alarm. JSON only.
BANNED (auto-fail): divisive politics, wars, death/disease, religion, colonization, animal harm, anything alarming in the morning.
ANSWER FAIL: answer in question, answer >5 words, vague/multiple-correct, unguessable.
FLAG (not fail): difficulty mismatch, question >40 words.
{"pass":true,"reason":"brief if failed","flags":[]}`;

export async function runGuardrail(q: GeneratedQuestion, apiKey: string): Promise<GuardrailResult> {
  const client = new Anthropic({ apiKey });
  const r = await client.messages.create({
    model: "claude-haiku-4-5-20251001", max_tokens: 200, system: SYS,
    messages: [{
      role: "user",
      content: `Check:\nQ: ${q.question}\nA: ${q.answer}\nDifficulty: ${q.difficulty}\nCategory: ${q.category}\nJSON only.`,
    }],
  });
  const text = (r.content[0] as { type: string; text: string }).text
    .trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  return JSON.parse(text) as GuardrailResult;
}

export function localWordCountCheck(q: GeneratedQuestion): GuardrailResult | null {
  if (q.question.split(/\s+/).length > 50) return { pass: false, reason: "Question too long" };
  if (q.answer.split(/\s+/).length > 5) return { pass: false, reason: "Answer too long" };
  return null;
}
