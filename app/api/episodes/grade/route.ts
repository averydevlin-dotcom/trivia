/**
 * POST /api/episodes/grade
 *
 * Records a human grade for a specific episode date.
 * GREEN episodes are appended to the exemplar bank.
 *
 * Body: { date: string, grade: "GREEN"|"YELLOW"|"RED", edits?: object }
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const EXEMPLARS_PATH = path.join(process.cwd(), "data/exemplars/bank.json");
const OUTPUT_DIR     = path.join(process.cwd(), "data/output");

export async function POST(req: NextRequest) {
  let body: { date: string; grade: string; edits?: Record<string, unknown> };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { date, grade, edits } = body;
  if (!date || !grade) {
    return NextResponse.json({ error: "date and grade are required" }, { status: 400 });
  }

  // Find the episode in the month's output file
  const [year, month] = date.split("-");
  const outFile = path.join(OUTPUT_DIR, `${year}-${month}.json`);

  if (!fs.existsSync(outFile)) {
    return NextResponse.json({ error: "Episode file not found" }, { status: 404 });
  }

  const episodes: Record<string, unknown>[] = JSON.parse(fs.readFileSync(outFile, "utf-8"));
  const epIdx = episodes.findIndex((e) => (e as { date: string }).date === date);
  if (epIdx < 0) {
    return NextResponse.json({ error: "Episode not found for date " + date }, { status: 404 });
  }

  // Apply edits if any
  if (edits) {
    episodes[epIdx] = { ...episodes[epIdx], ...edits };
  }
  episodes[epIdx] = { ...episodes[epIdx], grade };
  fs.writeFileSync(outFile, JSON.stringify(episodes, null, 2), "utf-8");

  // If GREEN, add to exemplar bank
  if (grade === "GREEN") {
    const ep = episodes[epIdx] as {
      category: string; subcategory: string; difficulty: string;
      question: string; answer: string; context: string;
    };
    const exemplars: unknown[] = fs.existsSync(EXEMPLARS_PATH)
      ? JSON.parse(fs.readFileSync(EXEMPLARS_PATH, "utf-8"))
      : [];

    exemplars.push({
      category:    ep.category,
      subcategory: ep.subcategory,
      difficulty:  ep.difficulty,
      question:    ep.question,
      answer:      ep.answer,
      context:     ep.context,
      grade:       "GREEN",
    });
    fs.writeFileSync(EXEMPLARS_PATH, JSON.stringify(exemplars, null, 2), "utf-8");
  }

  return NextResponse.json({ ok: true, grade, date });
}
