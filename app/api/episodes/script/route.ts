import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { EpisodeTrack } from "../../../../pipeline/05-scriptwriter/index";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const { date, tracks } = await req.json() as { date: string; tracks: EpisodeTrack[] };
  if (!date || !tracks) return NextResponse.json({ error: "date and tracks required" }, { status: 400 });

  const db = supabase();
  const { error } = await db
    .from("episodes")
    .update({ script_json: tracks })
    .eq("date", date);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
