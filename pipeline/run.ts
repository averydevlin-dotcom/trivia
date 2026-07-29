import { generateQuestion } from "./02-generator/index";
import { runGuardrail, localWordCountCheck } from "./03-guardrail/index";
import { checkDedup } from "./04-dedup/index";
import { writeEpisode, CATEGORIES } from "./05-scriptwriter/index";
import type { DayPlan, DayCategory } from "./01-planner/index";
import type { BrightSparkEpisode } from "./05-scriptwriter/index";
import exemplarData from "../data/exemplars/bank.json";

const MAX_RETRIES = 5;

type QSummary = { subcategory: string; question: string; answer: string };

export interface BatchResult {
  episodes: BrightSparkEpisode[];
  failed: number;
  questions: QSummary[];
  skipped: { date: string; reason: string }[];
}

export async function runBatch(
  batch: DayPlan[],
  prevQuestions: QSummary[],
  apiKey: string,
  exemplarOverride?: object[],
  recentSubcategoriesByCategory?: Record<string, string[]>
): Promise<BatchResult> {
  const exemplars = exemplarOverride ?? (exemplarData as object[]);
  const episodes: BrightSparkEpisode[] = [];
  const skipped: { date: string; reason: string }[] = [];
  const batchQuestions: QSummary[] = [];
  const allSoFar = () => [...prevQuestions, ...batchQuestions];

  for (let i = 0; i < batch.length; i++) {
    const dayPlan = batch[i];
    let question = null;
    let lastFail = "max retries exceeded";
    const rejectedSubcategories: string[] = [];
    const categoryRecent = recentSubcategoriesByCategory?.[dayPlan.category] ?? [];

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const avoidList = [...categoryRecent, ...rejectedSubcategories];
      try {
        const draft = await generateQuestion(
          dayPlan, exemplars, apiKey,
          avoidList.length > 0 ? avoidList : undefined,
          attempt
        );
        const local = localWordCountCheck(draft);
        if (local && !local.pass) {
          lastFail = local.reason ?? "local check";
          rejectedSubcategories.push(draft.subcategory);
          continue;
        }
        const guardrail = await runGuardrail(draft, apiKey);
        if (!guardrail.pass) {
          lastFail = guardrail.reason ?? "guardrail";
          rejectedSubcategories.push(draft.subcategory);
          continue;
        }
        const dedup = checkDedup(draft, allSoFar());
        if (!dedup.pass) {
          lastFail = dedup.reason ?? "dedup";
          rejectedSubcategories.push(draft.subcategory);
          continue;
        }
        question = draft;
        break;
      } catch (err) {
        lastFail = (err as Error).message;
      }
    }

    if (!question) {
      skipped.push({ date: dayPlan.date, reason: lastFail });
      continue;
    }

    const tomorrowCategory: DayCategory = batch[i + 1]?.category ?? CATEGORIES[0];
    const episode = await writeEpisode(question, apiKey, tomorrowCategory as string);
    episodes.push(episode);
    batchQuestions.push({
      subcategory: question.subcategory,
      question: question.question,
      answer: question.answer,
    });
  }

  return { episodes, failed: skipped.length, questions: batchQuestions, skipped };
}
