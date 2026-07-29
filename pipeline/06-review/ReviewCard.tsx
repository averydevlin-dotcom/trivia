"use client";
import { useState } from "react";
import type { BrightSparkEpisode, EpisodeTrack } from "../05-scriptwriter/index";

type Grade = "GREEN" | "YELLOW" | "RED" | null;

export interface ReviewCardProps {
  episode: BrightSparkEpisode & { grade?: string; isFunDay?: boolean };
  onGrade: (grade: "GREEN" | "YELLOW", edited?: Partial<BrightSparkEpisode>) => void;
  onReject: (reason?: string) => void;
  onRegenerate?: () => void;
  onScriptUpdate?: (tracks: EpisodeTrack[]) => void;
  regenerating?: boolean;
  onUngrade?: () => void;
}

export function ReviewCard({
  episode, onGrade, onReject, onRegenerate, onScriptUpdate, regenerating, onUngrade,
}: ReviewCardProps) {
  const savedGrade = episode.grade as Grade | undefined;
  const [grade, setGrade] = useState<Grade>(savedGrade ?? null);

  // Q&A editing (YELLOW flow)
  const [editingQA, setEditingQA] = useState(false);
  const [editedQ, setEditedQ] = useState(episode.question);
  const [editedA, setEditedA] = useState(episode.answer);

  // Script editing
  const [editingScript, setEditingScript] = useState(false);
  const [editedTracks, setEditedTracks] = useState<EpisodeTrack[]>(episode.tracks ?? []);
  const [savingScript, setSavingScript] = useState(false);

  // RED reason
  const [rejectReason, setRejectReason] = useState("");
  const [rejectConfirmed, setRejectConfirmed] = useState(grade === "RED");

  const isFunDay = !!(episode as { isFunDay?: boolean }).isFunDay;

  const borderColor =
    grade === "GREEN" ? "border-green-500" :
    grade === "YELLOW" ? "border-yellow-500" :
    grade === "RED" ? "border-red-500" :
    isFunDay ? "border-purple-200" : "border-gray-200";

  const bgColor =
    grade === "GREEN" ? "bg-green-50" :
    grade === "YELLOW" ? "bg-yellow-50" :
    grade === "RED" ? "bg-red-50" :
    "bg-white";

  function handleUndo() {
    setGrade(null);
    setRejectConfirmed(false);
    if (onUngrade) onUngrade();
  }

  async function handleSaveScript() {
    setSavingScript(true);
    if (onScriptUpdate) onScriptUpdate(editedTracks);
    setEditingScript(false);
    setSavingScript(false);
  }

  return (
    <div className={`rounded-xl border-2 p-6 mb-6 ${borderColor} ${bgColor}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs text-gray-400 font-mono">{episode.date} · {episode.dayOfWeek}</span>
          <h2 className="text-base font-semibold text-gray-900 mt-0.5">
            {isFunDay && (
              <span className="inline-flex items-center gap-1 mr-2 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                🎉 Fun Observance Day
              </span>
            )}
            {!isFunDay && episode.category} — <span className="text-gray-400 font-normal">{episode.subcategory}</span>
            {isFunDay && <span className="text-gray-400 font-normal">{episode.subcategory}</span>}
          </h2>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded ml-2 flex-shrink-0 ${
          episode.difficulty === "Easy" ? "bg-green-100 text-green-700" :
          episode.difficulty === "Medium" ? "bg-yellow-100 text-yellow-700" :
          "bg-red-100 text-red-700"
        }`}>{episode.difficulty}</span>
      </div>

      {/* Q&A (editable in YELLOW mode) */}
      {editingQA ? (
        <div className="space-y-2 mb-4">
          <textarea
            className="w-full border rounded p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
            rows={3} value={editedQ} onChange={e => setEditedQ(e.target.value)}
          />
          <input
            className="w-full border rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            value={editedA} onChange={e => setEditedA(e.target.value)}
          />
        </div>
      ) : (
        <div className="mb-4 space-y-1">
          <p className="text-sm text-gray-700">
            <span className="text-xs text-gray-400 uppercase font-semibold mr-1">Q</span>{editedQ}
          </p>
          <p className="text-sm text-gray-700">
            <span className="text-xs text-gray-400 uppercase font-semibold mr-1">A</span>
            <strong>{editedA}</strong>
          </p>
        </div>
      )}

      {/* Full script (collapsible, editable) */}
      {!editingScript ? (
        <details className="mb-4">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none flex items-center gap-2">
            Full script ({editedTracks.length} tracks)
            {!grade && onScriptUpdate && (
              <button
                className="ml-auto text-xs text-indigo-500 hover:text-indigo-700 underline"
                onClick={e => { e.preventDefault(); setEditingScript(true); }}
              >Edit script</button>
            )}
          </summary>
          <div className="mt-2 space-y-1.5">
            {editedTracks.map(t => (
              <div key={t.trackId} className="text-xs">
                <span className="font-semibold text-gray-400 mr-1">{t.trackId}. {t.label}:</span>
                {t.isMusicCue
                  ? <em className="text-gray-400">{t.content}</em>
                  : <span className="text-gray-600">{t.content}</span>
                }
              </div>
            ))}
          </div>
        </details>
      ) : (
        <div className="mb-4 border border-indigo-200 rounded-lg p-4 bg-indigo-50">
          <p className="text-xs font-semibold text-indigo-600 mb-3">Editing script — modify any track below</p>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {editedTracks.map((t, idx) => (
              <div key={t.trackId}>
                <label className="text-xs font-semibold text-gray-500 block mb-0.5">
                  {t.trackId}. {t.label}
                </label>
                {t.isMusicCue ? (
                  <p className="text-xs text-gray-400 italic">{t.content}</p>
                ) : (
                  <textarea
                    className="w-full border rounded p-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    rows={2}
                    value={t.content}
                    onChange={e => {
                      const updated = [...editedTracks];
                      updated[idx] = { ...t, content: e.target.value };
                      setEditedTracks(updated);
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              className="px-3 py-1.5 rounded text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
              onClick={handleSaveScript} disabled={savingScript}
            >{savingScript ? "Saving…" : "Save script"}</button>
            <button
              className="px-3 py-1.5 rounded text-sm font-medium bg-gray-200 text-gray-700"
              onClick={() => { setEditedTracks(episode.tracks); setEditingScript(false); }}
            >Cancel</button>
          </div>
        </div>
      )}

      {/* Grade buttons */}
      {!grade && !editingQA && (
        <div className="flex gap-2 flex-wrap">
          <button
            className="px-3 py-1.5 rounded text-sm font-medium bg-green-600 hover:bg-green-700 text-white"
            onClick={() => { setGrade("GREEN"); onGrade("GREEN"); }}
          >✓ GREEN</button>
          <button
            className="px-3 py-1.5 rounded text-sm font-medium bg-yellow-500 hover:bg-yellow-600 text-white"
            onClick={() => { setGrade("YELLOW"); setEditingQA(true); }}
          >~ YELLOW — edit</button>
          <button
            className="px-3 py-1.5 rounded text-sm font-medium bg-red-600 hover:bg-red-700 text-white"
            onClick={() => setGrade("RED")}
          >✕ RED</button>
        </div>
      )}

      {/* YELLOW save/cancel */}
      {grade === "YELLOW" && editingQA && (
        <div className="flex gap-2 mt-2">
          <button
            className="px-3 py-1.5 rounded text-sm font-medium bg-yellow-500 text-white"
            onClick={() => { setEditingQA(false); onGrade("YELLOW", { question: editedQ, answer: editedA }); }}
          >Save + approve</button>
          <button
            className="px-3 py-1.5 rounded text-sm font-medium bg-gray-200 text-gray-700"
            onClick={() => { setEditingQA(false); setGrade(null); }}
          >Cancel</button>
        </div>
      )}
      {grade === "YELLOW" && !editingQA && (
        <div className="flex items-center gap-3 mt-2">
          <p className="text-sm font-semibold text-yellow-700">~ Edited & approved</p>
          <button className="text-xs text-gray-400 hover:text-gray-600 underline" onClick={handleUndo}>Undo</button>
        </div>
      )}

      {/* RED — reason input + confirm */}
      {grade === "RED" && !rejectConfirmed && (
        <div className="mt-2 space-y-2">
          <textarea
            className="w-full border border-red-200 rounded p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
            rows={2}
            placeholder="Why reject? (optional — helps train the generator)"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 rounded text-sm font-medium bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { setRejectConfirmed(true); onReject(rejectReason || undefined); }}
            >Confirm reject</button>
            <button
              className="px-3 py-1.5 rounded text-sm font-medium bg-gray-200 text-gray-700"
              onClick={() => setGrade(null)}
            >Cancel</button>
          </div>
        </div>
      )}
      {grade === "RED" && rejectConfirmed && (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-red-700 font-semibold">✕ Rejected{rejectReason ? ` — "${rejectReason}"` : ""}</p>
          <div className="flex gap-2">
            {regenerating ? (
              <span className="text-sm text-gray-500">Regenerating…</span>
            ) : onRegenerate && (
              <button
                className="px-3 py-1.5 rounded text-sm font-medium bg-gray-800 hover:bg-gray-700 text-white"
                onClick={onRegenerate}
              >↺ Regenerate for this date</button>
            )}
            <button
              className="px-3 py-1.5 rounded text-sm font-medium bg-gray-200 text-gray-700"
              onClick={handleUndo}
            >Undo</button>
          </div>
        </div>
      )}

      {/* GREEN confirmed */}
      {grade === "GREEN" && (
        <div className="flex items-center gap-3 mt-2">
          <p className="text-sm font-semibold text-green-700">✓ Approved — added to exemplar bank</p>
          <button className="text-xs text-gray-400 hover:text-gray-600 underline" onClick={handleUndo}>Undo</button>
        </div>
      )}
    </div>
  );
}
