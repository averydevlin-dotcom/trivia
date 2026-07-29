import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const { date, reason } = await req.json() as { date: string; reason?: string };
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const db = supabase();

  // Get the episode
  const { data: ep, error: epErr } = await db
    .from("episodes").select("*").eq("date", date).single();
  if (epErr || !ep) return NextResponse.json({ error: "Episode not found" }, { status: 404 });

  // Save to rejected_questions (best-effort, table may not exist yet)
  await db.from("rejected_questions").insert({
    date: ep.date,
    category: ep.category,
    subcategory: ep.subcategory,
    question: ep.question,
    answer: ep.answer,
    reason: reason ?? null,
  });

  // Mark episode RED
  await db.from("episodes").update({ grade: "RED" }).eq("date", date);

  return NextResponse.json({ ok: true });
}
