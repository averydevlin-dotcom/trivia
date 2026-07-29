import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  const db = supabase();
  let query = db.from("episodes").select("*").order("date", { ascending: true });

  if (year && month) {
    const paddedMonth = month.padStart(2, "0");
    query = query
      .gte("date", `${year}-${paddedMonth}-01`)
      .lte("date", `${year}-${paddedMonth}-31`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const episodes = (data ?? []).map((row) => ({
    date: row.date,
    dayOfWeek: row.day_of_week,
    category: row.category,
    subcategory: row.subcategory,
    difficulty: row.difficulty,
    question: row.question,
    answer: row.answer,
    context: row.context,
    script: (row.script_json as { content: string }[] | null)?.map(t => t.content).join("\n\n") ?? "",
    tracks: row.script_json ?? [],
    tomorrowCategory: row.tomorrow_category,
    grade: row.grade,
    isTimely: row.is_timely,
    timelyNote: row.timely_note,
    isFunDay: row.is_fun_day,
  }));

  return NextResponse.json(episodes);
}
