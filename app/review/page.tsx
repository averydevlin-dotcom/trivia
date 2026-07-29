"use client";
import { useEffect, useState, useCallback } from "react";
import { ReviewCard } from "../../pipeline/06-review/ReviewCard";
import type { BrightSparkEpisode, EpisodeTrack } from "../../pipeline/05-scriptwriter/index";

type Grade = "GREEN" | "YELLOW" | "RED" | null;
type GradedEpisode = BrightSparkEpisode & { grade: Grade; isFunDay?: boolean };

export default function ReviewPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [episodes, setEpisodes] = useState<GradedEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regeneratingDates, setRegeneratingDates] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/episodes?year=${year}&month=${month}`)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((data: GradedEpisode[]) => { setEpisodes(data); setLoading(false); })
      .catch(err => { setError(String(err)); setLoading(false); });
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const stats = episodes.reduce(
    (acc, ep) => {
      if (ep.grade === "GREEN") acc.green++;
      else if (ep.grade === "YELLOW") acc.yellow++;
      else if (ep.grade === "RED") acc.red++;
      else acc.pending++;
      return acc;
    },
    { green: 0, yellow: 0, red: 0, pending: 0 }
  );

  function updateEpisode(date: string, patch: Partial<GradedEpisode>) {
    setEpisodes(prev => prev.map(ep => ep.date === date ? { ...ep, ...patch } : ep));
  }

  function handleGrade(date: string, grade: "GREEN" | "YELLOW", edited?: Partial<BrightSparkEpisode>) {
    updateEpisode(date, { grade, ...(edited ?? {}) });
    fetch("/api/episodes/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, grade, edits: edited }),
    }).catch(console.error);
  }

  function handleReject(date: string, reason?: string) {
    updateEpisode(date, { grade: "RED" });
    fetch("/api/episodes/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, reason }),
    }).catch(console.error);
  }

  function handleUngrade(date: string) {
    updateEpisode(date, { grade: null });
    fetch("/api/episodes/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, grade: null }),
    }).catch(console.error);
  }

  async function handleRegenerate(date: string) {
    setRegeneratingDates(prev => new Set([...prev, date]));
    try {
      const res = await fetch("/api/episodes/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const data = await res.json();
      if (data.ok && data.episode) {
        updateEpisode(date, { ...data.episode, grade: null });
      } else {
        alert("Regeneration failed: " + (data.error ?? "Unknown error"));
      }
    } catch (err) {
      alert("Regeneration error: " + String(err));
    } finally {
      setRegeneratingDates(prev => { const s = new Set(prev); s.delete(date); return s; });
    }
  }

  async function handleScriptUpdate(date: string, tracks: EpisodeTrack[]) {
    const newScript = tracks.map(t => t.content).join("\n\n");
    updateEpisode(date, { tracks, script: newScript });
    await fetch("/api/episodes/script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, tracks }),
    }).catch(console.error);
  }

  return (
    <main className="max-w-3xl mx-auto py-10 px-4">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bright Spark — Review</h1>
          <p className="text-sm text-gray-500 mt-1">Grade each episode. GREEN → exemplar bank.</p>
        </div>
        <a href="/calendar" className="text-sm text-indigo-600 hover:text-indigo-800">→ Calendar</a>
      </div>

      {/* Month selector */}
      <div className="flex gap-3 items-center mb-6">
        <select
          className="border border-gray-300 rounded px-3 py-1.5 text-sm"
          value={month} onChange={e => setMonth(Number(e.target.value))}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString("default", { month: "long" })}</option>
          ))}
        </select>
        <input
          type="number"
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-20"
          value={year} onChange={e => setYear(Number(e.target.value))}
        />
        <span className="text-xs text-gray-400">{episodes.length} episodes</span>
      </div>

      {/* Stats */}
      {episodes.length > 0 && (
        <div className="flex gap-4 mb-6 text-sm flex-wrap">
          <span className="text-green-700 font-semibold">✓ {stats.green} GREEN</span>
          <span className="text-yellow-700 font-semibold">~ {stats.yellow} YELLOW</span>
          <span className="text-red-700 font-semibold">✕ {stats.red} RED</span>
          <span className="text-gray-400">{stats.pending} pending</span>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading…</p>}
      {error && <p className="text-red-600 text-sm">Error: {error}</p>}

      {!loading && !error && episodes.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-gray-500 text-sm mb-2">No episodes for {year}-{String(month).padStart(2, "0")}.</p>
          <a href="/calendar" className="text-indigo-600 text-sm hover:underline">Go to Calendar to run the pipeline →</a>
        </div>
      )}

      {episodes.map(ep => (
        <ReviewCard
          key={ep.date}
          episode={ep}
          onGrade={(grade, edited) => handleGrade(ep.date, grade, edited)}
          onReject={reason => handleReject(ep.date, reason)}
          onRegenerate={() => handleRegenerate(ep.date)}
          onScriptUpdate={tracks => handleScriptUpdate(ep.date, tracks)}
          regenerating={regeneratingDates.has(ep.date)}
          onUngrade={() => handleUngrade(ep.date)}
        />
      ))}
    </main>
  );
}
