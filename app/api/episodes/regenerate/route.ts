import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildMonthPlan } from "../../../../pipeline/01-planner/index";
import { runBatch } from "../../../../pipeline/run";

export const maxDuration = 60;

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const { date } = await req.json() as { date: string };
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const [yearStr, monthStr] = date.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);

  const plan = buildMonthPlan(year, month);
  const dayPlan = plan.find(d => d.date === date);
  if (!dayPlan) return NextResponse.json({ error: "Date not in plan" }, { status: 404 });

  const db = supabase();

  // All-time dedup: confirmed episodes + rejected
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

  // Prev questions for dedup (all confirmed this month)
  const { data: monthEps } = await db
    .from("episodes")
    .select("subcategory, question, answer")
    .gte("date", `${yearStr}-${monthStr.padStart(2, "0")}-01`)
    .lte("date", `${yearStr}-${monthStr.padStart(2, "0")}-31`)
    .in("grade", ["GREEN", "YELLOW"]);

  const result = await runBatch(
    [dayPlan],
    (monthEps ?? []).map(e => ({ subcategory: e.subcategory, question: e.question, answer: e.answer })),
    apiKey, undefined, recentByCategory
  );

  if (result.episodes.length === 0) {
    return NextResponse.json({ error: "Generation failed", skipped: result.skipped }, { status: 500 });
  }

  const ep = result.episodes[0];
  const tomorrowPlan = plan.find(d => d.date > date);

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
    is_timely: dayPlan.isTimely,
    timely_note: dayPlan.timelyNote ?? null,
    is_fun_day: ep.isFunDay ?? false,
    grade: null,
  }, { onConflict: "date" });

  return NextResponse.json({
    ok: true,
    episode: {
      date: ep.date,
      dayOfWeek: ep.dayOfWeek,
      category: ep.category,
      subcategory: ep.subcategory,
      difficulty: ep.difficulty,
      question: ep.question,
      answer: ep.answer,
      context: ep.context,
      script: ep.tracks.map(t => t.content).join("\n\n"),
      tracks: ep.tracks,
      isFunDay: ep.isFunDay,
      grade: null,
    },
  });
}
