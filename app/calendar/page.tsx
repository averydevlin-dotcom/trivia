"use client";
import { useEffect, useState, useCallback } from "react";

interface DayRow {
  date: string;
  dayOfWeek: string;
  category: string;
  subcategory: string;
  difficulty: string;
  grade: string | null;
  isTimely: boolean;
  timelyNote?: string;
  isFunDay: boolean;
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runLog, setRunLog] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/episodes?year=${year}&month=${month}`)
      .then(r => r.json())
      .then((data: DayRow[]) => { setRows(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const stats = rows.reduce(
    (a, r) => {
      if (r.grade === "GREEN") a.green++;
      else if (r.grade === "YELLOW") a.yellow++;
      else if (r.grade === "RED") a.red++;
      else a.pending++;
      if (r.isFunDay) a.fun++;
      return a;
    },
    { green: 0, yellow: 0, red: 0, pending: 0, fun: 0 }
  );

  async function runPipeline() {
    setRunning(true);
    setRunLog([]);
    const daysInMonth = new Date(year, month, 0).getDate();
    const allDates: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = new Date(year, month - 1, d).toISOString().split("T")[0];
      if (!rows.find(r => r.date === ds && r.grade)) allDates.push(ds);
    }

    const CHUNK = 7;
    let prevQuestions: { subcategory: string; question: string; answer: string }[] = [];

    for (let i = 0; i < allDates.length; i += CHUNK) {
      const chunk = allDates.slice(i, i + CHUNK);
      setRunLog(prev => [...prev, `Running ${chunk[0]} → ${chunk[chunk.length - 1]}…`]);
      try {
        const res = await fetch("/api/pipeline/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year, month, dates: chunk, prevQuestions }),
        });
        const data = await res.json();
        setRunLog(prev => [...prev, `  ✓ ${data.generated ?? 0} generated, ${data.failed ?? 0} skipped`]);
        if (data.questions) prevQuestions = [...prevQuestions, ...data.questions];
      } catch (err) {
        setRunLog(prev => [...prev, `  ✗ Error: ${String(err)}`]);
      }
    }
    setRunning(false);
    load();
  }

  function handleExport() {
    setExporting(true);
    const url = `/api/export?year=${year}&month=${month}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `bright-spark-${year}-${String(month).padStart(2, "0")}.html`;
    a.click();
    setTimeout(() => setExporting(false), 1500);
  }

  const approvedCount = stats.green + stats.yellow;

  return (
    <main className="max-w-5xl mx-auto py-10 px-4">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bright Spark — Content Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">Plan, run, and review your monthly episode schedule.</p>
        </div>
        <a href="/review" className="text-sm text-indigo-600 hover:text-indigo-800">→ Review episodes</a>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center mb-6">
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
        <button
          className="px-4 py-1.5 rounded text-sm font-medium bg-gray-900 hover:bg-gray-700 text-white disabled:opacity-50"
          onClick={runPipeline} disabled={running}
        >{running ? "Running…" : "▶ Run pipeline"}</button>
        {approvedCount > 0 && (
          <button
            className="px-4 py-1.5 rounded text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 flex items-center gap-1.5"
            onClick={handleExport} disabled={exporting}
          >
            {exporting ? "Preparing…" : "↓ Export to Google Docs"}
          </button>
        )}
      </div>

      {/* Stats */}
      {rows.length > 0 && (
        <div className="flex gap-4 mb-6 text-sm flex-wrap">
          <span className="text-green-700 font-semibold">✓ {stats.green} GREEN</span>
          <span className="text-yellow-700 font-semibold">~ {stats.yellow} YELLOW</span>
          <span className="text-red-700 font-semibold">✕ {stats.red} RED</span>
          <span className="text-gray-400">{stats.pending} pending</span>
          {stats.fun > 0 && <span className="text-purple-600 font-semibold">🎉 {stats.fun} fun observance</span>}
        </div>
      )}

      {/* Run log */}
      {runLog.length > 0 && (
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Pipeline log</p>
          {runLog.map((line, i) => (
            <p key={i} className={`text-xs font-mono ${line.includes("✗") ? "text-red-600" : "text-gray-600"}`}>{line}</p>
          ))}
          {running && <p className="text-xs text-gray-400 mt-1 animate-pulse">Processing…</p>}
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading…</p>}

      {/* Legend */}
      {rows.length > 0 && (
        <div className="flex gap-4 mb-3 text-xs text-gray-400 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-purple-200 inline-block"></span> Fun Observance Day</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-100 inline-block"></span> Timely peg</span>
        </div>
      )}

      {/* Calendar table */}
      {!loading && rows.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left w-28">Date</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Subcategory</th>
                <th className="px-4 py-3 text-center w-20">Diff</th>
                <th className="px-4 py-3 text-center w-20">Grade</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const isFun = row.isFunDay;
                const isTimely = row.isTimely && !isFun;
                const rowBg = isFun
                  ? "bg-purple-50 hover:bg-purple-100"
                  : isTimely
                  ? "bg-amber-50 hover:bg-amber-100"
                  : idx % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50/50 hover:bg-gray-100";

                return (
                  <tr key={row.date} className={`border-b border-gray-100 last:border-0 transition-colors ${rowBg}`}>
                    <td className="px-4 py-2.5">
                      <div className="font-mono text-xs text-gray-500">{row.date.slice(5)}</div>
                      <div className="text-xs text-gray-400">{row.dayOfWeek.slice(0, 3)}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      {isFun ? (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
                            🎉 Fun Observance Day
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-800">{row.category}</span>
                          {isTimely && (
                            <span className="text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                              📅 {row.timelyNote}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {row.subcategory || <span className="text-gray-300 italic">not generated</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        row.difficulty === "Easy" ? "bg-green-100 text-green-700" :
                        row.difficulty === "Medium" ? "bg-yellow-100 text-yellow-700" :
                        row.difficulty === "Hard" ? "bg-red-100 text-red-700" : "text-gray-300"
                      }`}>{row.difficulty || "—"}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {row.grade === "GREEN" && <span className="text-green-600 font-bold text-xs">✓ GREEN</span>}
                      {row.grade === "YELLOW" && <span className="text-yellow-600 font-bold text-xs">~ YELLOW</span>}
                      {row.grade === "RED" && <span className="text-red-600 font-bold text-xs">✕ RED</span>}
                      {!row.grade && row.subcategory && <span className="text-gray-300 text-xs">pending</span>}
                      {!row.grade && !row.subcategory && <span className="text-gray-200 text-xs">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-gray-500 text-sm mb-3">No episodes generated yet for this month.</p>
          <button
            className="px-4 py-2 rounded text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50"
            onClick={runPipeline} disabled={running}
          >{running ? "Running…" : "▶ Run pipeline now"}</button>
        </div>
      )}
    </main>
  );
}
