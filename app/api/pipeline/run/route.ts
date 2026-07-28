/**
 * POST /api/pipeline/run
 *
 * Trigger a full monthly batch via HTTP.
 * Body: { year: number, month: number }
 * Returns: RunResult JSON
 *
 * Requires ANTHROPIC_API_KEY set in Vercel environment variables.
 */

import { NextRequest, NextResponse } from "next/server";
import { runMonthBatch } from "../../../../pipeline/run";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  let year: number;
  let month: number;

  try {
    const body = await req.json();
    year  = body.year  ?? new Date().getFullYear();
    month = body.month ?? new Date().getMonth() + 1;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (month < 1 || month > 12) {
    return NextResponse.json({ error: "month must be 1–12" }, { status: 400 });
  }

  try {
    const result = await runMonthBatch(year, month, apiKey, false);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[pipeline/run] error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
