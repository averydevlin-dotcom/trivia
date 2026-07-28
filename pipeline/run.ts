/**
 * PIPELINE ORCHESTRATOR
 *
 * Chains all 6 stages for a full monthly batch.
 *
 * Usage (from repo root):
 *   npx ts-node pipeline/run.ts --year 2026 --month 8
 *
 * Or from a Next.js API route (see app/api/pipeline/run/route.ts).
 *
 * Environment variable required:
 *   ANTHROPIC_API_KEY
 */

import { buildMonthPlan, formatPlan, CATEGORIES } from "./01-planner/index";
import { generateQuestion } from "./02-generator/index";
import { runGuardrail, localWordCountCheck } from "./03-guardrail/index";
import { checkDedup, loadHistory } from "./04-dedup/index";
import { writeEpisode } from "./05-scriptwriter/index";
import type { GeneratedQuestion } from "./02-generator/index";
import type { BrightSparkEpisode } from "./05-scriptwriter/index";

import fs from "fs";
import path from "path";

const EXEMPLARS_PATH = path.join(__dirname, "../data/exemplars/bank.json");
const HISTORY_DIR    = path.join(__dirname, "../data/history");
const OUTPUT_DIR     = path.join(__dirname, "../data/output");

const MAX_RETRIES = 3; // per question, before giving up

export interface RunResult {
  year: number;
  month: number;
  generated: number;
  failed: number;
  episodes: BrightSparkEpisode[];
  skipped: { date: string; reason: string }[];
}

export async function runMonthBatch(
  year: number,
  month: number,
  apiKey: string,
  verbose = false
): Promise<RunResult> {
  const log = verbose ? console.log : () => {};

  // Load exemplars (for generator calibration)
  const exemplars = JSON.parse(fs.readFileSync(EXEMPLARS_PATH, "utf-8"));

  // Load last 60 days of history for dedup
  const historyFile = path.join(HISTORY_DIR, "recent.json");
  const recentHistory = loadHistory(historyFile);

  // Build month plan
  const plan = buildMonthPlan(year, month);
  log("=== MONTH PLAN ===\n" + formatPlan(plan));

  const episodes: BrightSparkEpisode[] = [];
  const skipped: { date: string; reason: string }[] = [];
  const monthSoFar: GeneratedQuestion[] = [];

  for (let i = 0; i < plan.length; i++) {
    const dayPlan = plan[i];
    log(`\n[${dayPlan.date}] ${dayPlan.dayOfWeek} | diff=${dayPlan.difficulty} | ${dayPlan.category}`);

    let question: GeneratedQuestion | null = null;
    let lastFailReason = "";

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      log(`  Attempt ${attempt}/${MAX_RETRIES} — generating...`);

      try {
        // Stage 2 — Generate
        const draft = await generateQuestion(dayPlan, exemplars, apiKey);

        // Stage 3 — Guardrail (local check first, then Haiku)
        const localCheck = localWordCountCheck(draft);
        if (localCheck && !localCheck.pass) {
          log(`  ✗ Local check failed: ${localCheck.reason}`);
          lastFailReason = localCheck.reason ?? "local check failed";
          continue;
        }
        const guardrail = await runGuardrail(draft, apiKey);
        if (!guardrail.pass) {
          log(`  ✗ Guardrail failed: ${guardrail.reason}`);
          lastFailReason = guardrail.reason ?? "guardrail failed";
          continue;
        }
        if (guardrail.flags?.length) {
          log(`  ⚠ Guardrail flags: ${guardrail.flags.join(", ")}`);
        }

        // Stage 4 — Dedup
        const dedup = checkDedup(draft, monthSoFar, recentHistory);
        if (!dedup.pass) {
          log(`  ✗ Dedup failed: ${dedup.reason}`);
          lastFailReason = dedup.reason ?? "dedup failed";
          continue;
        }

        // Question passed all checks
        question = draft;
        break;

      } catch (err) {
        log(`  ✗ Error on attempt ${attempt}: ${(err as Error).message}`);
        lastFailReason = (err as Error).message;
      }
    }

    if (!question) {
      log(`  ⚠ SKIPPED ${dayPlan.date} after ${MAX_RETRIES} attempts: ${lastFailReason}`);
      skipped.push({ date: dayPlan.date, reason: lastFailReason });
      continue;
    }

    // Stage 5 — Script Writer
    const tomorrowCategory = plan[i + 1]?.category ?? CATEGORIES[0];
    const episode = await writeEpisode(question, apiKey, tomorrowCategory);
    episodes.push(episode);
    monthSoFar.push(question);

    log(`  ✓ ${dayPlan.date} → Q: "${question.question.slice(0, 60)}..."`);

    // Small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 300));
  }

  // Save output
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outFile = path.join(OUTPUT_DIR, `${year}-${String(month).padStart(2, "0")}.json`);
  fs.writeFileSync(outFile, JSON.stringify(episodes, null, 2), "utf-8");
  log(`\n=== DONE: ${episodes.length} episodes saved to ${outFile} ===`);

  // Append approved questions to history
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
  const updatedHistory = [...recentHistory, ...monthSoFar].slice(-90); // keep last 90 days
  fs.writeFileSync(historyFile, JSON.stringify(updatedHistory, null, 2), "utf-8");

  return {
    year,
    month,
    generated: episodes.length,
    failed: skipped.length,
    episodes,
    skipped,
  };
}

// CLI entrypoint
if (require.main === module) {
  const args = process.argv.slice(2);
  const yearIdx = args.indexOf("--year");
  const monthIdx = args.indexOf("--month");

  const year  = yearIdx  >= 0 ? parseInt(args[yearIdx  + 1]) : new Date().getFullYear();
  const month = monthIdx >= 0 ? parseInt(args[monthIdx + 1]) : new Date().getMonth() + 1;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Error: ANTHROPIC_API_KEY environment variable not set.");
    process.exit(1);
  }

  runMonthBatch(year, month, apiKey, true)
    .then((result) => {
      console.log(`\nResult: ${result.generated} generated, ${result.failed} failed`);
    })
    .catch((err) => {
      console.error("Pipeline failed:", err);
      process.exit(1);
    });
}
