import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, grade, edits } = body as {
    date: string;
    grade: string;
    edits?: { question?: string; answer?: string };
  };

  if (!date || !grade) {
    return NextResponse.json({ error: "date and grade required" }, { status: 400 });
  }

  const db = supabase();
  const updateData: Record<string, unknown> = { grade };
  if (edits?.question) updateData.question = edits.question;
  if (edits?.answer) updateData.answer = edits.answer;

  const { error } = await db.from("episodes").update(updateData).eq("date", date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // GREEN → add to exemplar bank in Supabase exemplars table
  if (grade === "GREEN") {
    const { data: ep } = await db.from("episodes").select("*").eq("date", date).single();
    if (ep) {
      await db.from("exemplars").upsert({
        category: ep.category,
        subcategory: ep.subcategory,
        difficulty: ep.difficulty,
        question: edits?.question ?? ep.question,
        answer: edits?.answer ?? ep.answer,
        context: ep.context,
        grade: "GREEN",
      });
    }
  }

  return NextResponse.json({ ok: true });
}
