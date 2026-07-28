/**
 * /review — Human review page for the current month's generated episodes.
 *
 * Loads episodes from /data/output/YYYY-MM.json via an API route,
 * renders them as ReviewCards for GREEN / YELLOW / RED grading.
 */

"use client";

import { useEffect, useState } from "react";
import { ReviewCard } from "../../pipeline/06-review/ReviewCard";
import type { BrightSparkEpisode } from "../../pipeline/05-scriptwriter/index";

type Grade = "GREEN" | "YELLOW" | "RED";

interface GradedEpisode {
  episode: BrightSparkEpisode;
  grade: Grade | null;
}

export default function ReviewPage() {
  const [episodes, setEpisodes] = useState<GradedEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ green: 0, yellow: 0, red: 0, pending: 0 });

  // Default to current month
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/episodes?year=${year}&month=${month}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: BrightSparkEpisode[]) => {
        setEpisodes(data.map((ep) => ({ episode: ep, grade: null })));
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [year, month]);

  useEffect(() => {
    const counts = { green: 0, yellow: 0, red: 0, pending: 0 };
    episodes.forEach(({ grade }) => {
      if (grade === "GREEN") counts.green++;
      else if (grade === "YELLOW") counts.yellow++;
      else if (grade === "RED") counts.red++;
      else counts.pending++;
    });
    setStats(counts);
  }, [episodes]);

  function handleGrade(index: number, grade: Grade, edited?: Partial<BrightSparkEpisode>) {
    setEpisodes((prev) =>
      prev.map((item, i) =>
        i === index
          ? { episode: edited ? { ...item.episode, ...edited } : item.episode, grade }
          : item
      )
    );

    // In production: POST grade + edits to /api/episodes/grade
    fetch("/api/episodes/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: episodes[index].episode.date, grade, edits: edited }),
    }).catch(console.error);
  }

  return (
    <main className="max-w-3xl mx-auto py-10 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Bright Spark — Episode Review</h1>
        <p className="text-sm text-gray-500 mt-1">Grade each episode before publishing. GREEN approved → added to exemplar bank.</p>
      </div>

      {/* Month selector */}
      <div className="flex gap-3 items-center mb-6">
        <select
          className="border border-gray-300 rounded px-3 py-1.5 text-sm"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString("default", { month: "long" })}</option>
          ))}
        </select>
        <input
          type="number"
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-20"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        />
        <span className="text-xs text-gray-400">{episodes.length} episodes</span>
      </div>

      {/* Stats bar */}
      {episodes.length > 0 && (
        <div className="flex gap-4 mb-6 text-sm">
          <span className="text-green-700 font-semibold">✓ {stats.green} GREEN</span>
          <span className="text-yellow-700 font-semibold">~ {stats.yellow} YELLOW</span>
          <span className="text-red-700 font-semibold">✕ {stats.red} RED</span>
          <span className="text-gray-400">{stats.pending} pending</span>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading episodes…</p>}
      {error && <p className="text-red-600 text-sm">Error: {error}</p>}

      {!loading && !error && episodes.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-gray-500 text-sm mb-4">No episodes found for {year}-{String(month).padStart(2, "0")}.</p>
          <p className="text-xs text-gray-400">Run the pipeline first: <code className="bg-gray-100 px-1 py-0.5 rounded">POST /api/pipeline/run</code> with <code className="bg-gray-100 px-1 py-0.5 rounded">{"{ year, month }"}</code></p>
        </div>
      )}

      {episodes.map(({ episode }, index) => (
        <ReviewCard
          key={episode.date}
          episode={episode}
          onGrade={(grade, edited) => handleGrade(index, grade as Grade, edited)}
        />
      ))}
    </main>
  );
}
