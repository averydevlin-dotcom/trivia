import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildMonthPlan } from "../../../../pipeline/01-planner/index";
import { runBatch } from "../../../../pipeline/run";

export const maxDuration = 300;

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const body = await req.json();
  const { year, month, dates, prevQuestions } = body as {
    year: number;
    month: number;
    dates?: string[];
    prevQuestions?: { subcategory: string; question: string; answer: string }[];
  };

  if (!year || !month) return NextResponse.json({ error: "year and month required" }, { status: 400 });

  const db = supabase();

  // All-time dedup: ALL confirmed episodes + rejected questions
  const [{ data: allEps }, { data: rejected }] = await Promise.all([
    db.from("episodes").select("category, subcategory, question, answer").in("grade", ["GREEN", "YELLOW"]),
    db.from("rejected_questions").select("category, subcategory"),
  ]);

  const recentByCategory: Record<string, string[]> = {};
  (allEps ?? []).forEach(ep => {
    if (!recentByCategory[ep.category]) recentByCategory[ep.category] = [];
    recentByCategory[ep.category].push(ep.subcategory);
  });
  (rejected ?? []).forEach(r => {
    if (!recentByCategory[r.category]) recentByCategory[r.category] = [];
    if (!recentByCategory[r.category].includes(r.subcategory)) {
      recentByCategory[r.category].push(r.subcategory);
    }
  });

  const plan = buildMonthPlan(year, month);
  const batch = dates ? plan.filter(d => dates.includes(d.date)) : plan;

  const result = await runBatch(batch, prevQuestions ?? [], apiKey, undefined, recentByCategory);

  // Save all episodes to Supabase
  for (const ep of result.episodes) {
    const dayPlan = plan.find(d => d.date === ep.date);
    const tomorrowPlan = plan.find(d => d.date > ep.date);
    await db.from("episodes").upsert({
      date: ep.date,
      day_of_week: ep.dayOfWeek,
      category: ep.category,
      subcategory: ep.subcategory,
      difficulty: ep.difficulty,
      question: ep.question,
      answer: ep.answer,
      context: ep.context ?? "",
      script_json: ep.tracks,
      tomorrow_category: tomorrowPlan?.category ?? null,
      is_timely: dayPlan?.isTimely ?? false,
      timely_note: dayPlan?.timelyNote ?? null,
      is_fun_day: ep.isFunDay ?? false,
      grade: null,
    }, { onConflict: "date" });
  }

  return NextResponse.json({
    ok: true,
    generated: result.episodes.length,
    failed: result.failed,
    skipped: result.skipped,
    questions: result.questions,
    episodes: result.episodes.map(ep => ({
      date: ep.date,
      category: ep.category,
      subcategory: ep.subcategory,
      isFunDay: ep.isFunDay,
    })),
  });
}
