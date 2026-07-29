import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildMonthPlan } from "../../../../pipeline/01-planner/index";
import { generateQuestion } from "../../../../pipeline/02-generator/index";
import { runGuardrail, localWordCountCheck } from "../../../../pipeline/03-guardrail/index";
import { checkDedup } from "../../../../pipeline/04-dedup/index";
import exemplarData from "../../../../data/exemplars/bank.json";

export const maxDuration = 60;

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const { date, maxAttempts = 8 } = await req.json() as { date: string; maxAttempts?: number };
  const apiKey = process.env.ANTHROPIC_API_KEY!;

  const [yearStr, monthStr] = date.split("-");
  const plan = buildMonthPlan(parseInt(yearStr), parseInt(monthStr));
  const dayPlan = plan.find(d => d.date === date);
  if (!dayPlan) return NextResponse.json({ error: "Date not in plan" }, { status: 404 });

  const db = supabase();
  const [{ data: allEps }, { data: rejected }] = await Promise.all([
    db.from("episodes").select("category, subcategory, question, answer").in("grade", ["GREEN", "YELLOW"]),
    db.from("rejected_questions").select("category, subcategory"),
  ]);

  const avoid: string[] = [
    ...(allEps ?? []).filter(e => e.category === dayPlan.category).map(e => e.subcategory),
    ...(rejected ?? []).filter(r => r.category === dayPlan.category).map(r => r.subcategory),
  ];

  const exemplars = exemplarData as object[];
  const attempts = [];
  const rejectedSubs: string[] = [];

  for (let a = 1; a <= maxAttempts; a++) {
    const avoidList = [...avoid, ...rejectedSubs];
    let draft, failStage = null, failReason = null;
    try {
      draft = await generateQuestion(dayPlan, exemplars, apiKey, avoidList.length ? avoidList : undefined, a);
      const local = localWordCountCheck(draft);
      if (local && !local.pass) { failStage = "local"; failReason = local.reason; rejectedSubs.push(draft.subcategory); }
      else {
        const guard = await runGuardrail(draft, apiKey);
        if (!guard.pass) { failStage = "guardrail"; failReason = guard.reason; rejectedSubs.push(draft.subcategory); }
        else {
          const dedup = checkDedup(draft, []);
          if (!dedup.pass) { failStage = "dedup"; failReason = dedup.reason; rejectedSubs.push(draft.subcategory); }
        }
      }
    } catch (err) { failStage = "error"; failReason = (err as Error).message; }

    attempts.push({
      attempt: a,
      subcategory: draft?.subcategory ?? null,
      question: draft?.question ?? null,
      answer: draft?.answer ?? null,
      fail_stage: failStage,
      reason: failReason,
    });
    if (!failStage) break;
  }

  return NextResponse.json({
    date, category: dayPlan.category, isFunDay: dayPlan.isFunDay, attempts,
  });
}
