/**
 * GET /api/episodes?year=2026&month=8
 *
 * Returns the generated episodes for a given month from disk.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const year  = searchParams.get("year")  ?? String(new Date().getFullYear());
  const month = searchParams.get("month") ?? String(new Date().getMonth() + 1);

  const file = path.join(
    process.cwd(),
    "data/output",
    `${year}-${String(month).padStart(2, "0")}.json`
  );

  if (!fs.existsSync(file)) {
    return NextResponse.json([], { status: 200 });
  }

  const data = JSON.parse(fs.readFileSync(file, "utf-8"));
  return NextResponse.json(data);
}
