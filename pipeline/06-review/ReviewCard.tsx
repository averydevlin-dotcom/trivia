/**
 * Stage 06 — HUMAN REVIEW UI (React component)
 *
 * Renders a single BrightSparkEpisode for GREEN / YELLOW / RED grading.
 * GREEN questions are added to the exemplar bank.
 * YELLOW questions can be edited before approval.
 * RED questions are discarded (and fed back as negative examples, optionally).
 *
 * Usage: drop this into your Next.js app/review/ page.
 */

"use client";

import { useState } from "react";
import type { BrightSparkEpisode } from "../05-scriptwriter/index";

type Grade = "GREEN" | "YELLOW" | "RED" | null;

interface ReviewCardProps {
  episode: BrightSparkEpisode;
  onGrade: (grade: Grade, edited?: Partial<BrightSparkEpisode>) => void;
}

const GRADE_STYLES: Record<NonNullable<Grade>, string> = {
  GREEN:  "bg-green-100 border-green-500 text-green-800",
  YELLOW: "bg-yellow-100 border-yellow-500 text-yellow-800",
  RED:    "bg-red-100 border-red-500 text-red-800",
};

const GRADE_BUTTONS: { grade: NonNullable<Grade>; label: string; className: string }[] = [
  { grade: "GREEN",  label: "✓ GREEN — Approve",    className: "bg-green-600 hover:bg-green-700 text-white" },
  { grade: "YELLOW", label: "~ YELLOW — Edit first", className: "bg-yellow-500 hover:bg-yellow-600 text-white" },
  { grade: "RED",    label: "✕ RED — Reject",        className: "bg-red-600 hover:bg-red-700 text-white" },
];

export function ReviewCard({ episode, onGrade }: ReviewCardProps) {
  const [grade, setGrade] = useState<Grade>(null);
  const [editing, setEditing] = useState(false);
  const [editedQuestion, setEditedQuestion] = useState(episode.question);
  const [editedAnswer, setEditedAnswer] = useState(episode.answer);
  const [editedContext, setEditedContext] = useState(episode.tracks.find(t => t.trackId === 9)?.content ?? "");
  const [rejectNote, setRejectNote] = useState("");

  function handleGradeClick(g: NonNullable<Grade>) {
    if (g === "YELLOW") {
      setEditing(true);
      setGrade("YELLOW");
    } else if (g === "RED") {
      setGrade("RED");
    } else {
      setGrade("GREEN");
      onGrade("GREEN");
    }
  }

  function handleApproveEdited() {
    onGrade("YELLOW", {
      question: editedQuestion,
      answer: editedAnswer,
    });
  }

  function handleReject() {
    onGrade("RED", undefined);
  }

  return (
    <div className={`rounded-xl border-2 p-6 mb-6 transition-all ${grade ? GRADE_STYLES[grade] : "bg-white border-gray-200"}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">{episode.date} · {episode.dayOfWeek}</span>
          <h2 className="text-lg font-semibold text-gray-900 mt-0.5">
            {episode.category} — <span className="text-gray-500">{episode.subcategory}</span>
          </h2>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded ${
          episode.difficulty === "Easy" ? "bg-green-100 text-green-700" :
          episode.difficulty === "Medium" ? "bg-yellow-100 text-yellow-700" :
          "bg-red-100 text-red-700"
        }`}>{episode.difficulty}</span>
      </div>

      {/* Q+A */}
      {editing ? (
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Question</label>
            <textarea
              className="w-full border border-gray-300 rounded p-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
              rows={3}
              value={editedQuestion}
              onChange={e => setEditedQuestion(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Answer</label>
            <input
              className="w-full border border-gray-300 rounded p-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              value={editedAnswer}
              onChange={e => setEditedAnswer(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Context beat (track 9)</label>
            <textarea
              className="w-full border border-gray-300 rounded p-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
              rows={3}
              value={editedContext}
              onChange={e => setEditedContext(e.target.value)}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-gray-500 text-xs uppercase">Q: </span>
            {episode.question}
          </p>
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-gray-500 text-xs uppercase">A: </span>
            <strong>{episode.answer}</strong>
          </p>
        </div>
      )}

      {/* Full script accordion */}
      <details className="mb-5">
        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
          Show full episode script ({episode.tracks.length} tracks)
        </summary>
        <div className="mt-3 space-y-2">
          {episode.tracks.map(track => (
            <div key={track.trackId} className="text-xs">
              <span className="font-semibold text-gray-400 mr-2">{track.trackId}. {track.label}</span>
              {track.isMusicCue
                ? <span className="italic text-gray-400">{track.content}</span>
                : <span className="text-gray-700">{track.content}</span>
              }
            </div>
          ))}
        </div>
      </details>

      {/* Grade buttons or confirmation */}
      {!grade && (
        <div className="flex gap-2 flex-wrap">
          {GRADE_BUTTONS.map(({ grade: g, label, className }) => (
            <button
              key={g}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${className}`}
              onClick={() => handleGradeClick(g)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {grade === "YELLOW" && editing && (
        <div className="flex gap-2 mt-3">
          <button
            className="px-4 py-2 rounded text-sm font-medium bg-yellow-500 hover:bg-yellow-600 text-white"
            onClick={handleApproveEdited}
          >
            Save edits + approve
          </button>
          <button
            className="px-4 py-2 rounded text-sm font-medium bg-gray-200 hover:bg-gray-300 text-gray-700"
            onClick={() => { setEditing(false); setGrade(null); }}
          >
            Cancel
          </button>
        </div>
      )}

      {grade === "RED" && (
        <div className="mt-3">
          <input
            className="w-full border border-red-300 rounded p-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400 mb-2"
            placeholder="Optional: why rejected? (helps retrain the generator)"
            value={rejectNote}
            onChange={e => setRejectNote(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className="px-4 py-2 rounded text-sm font-medium bg-red-600 hover:bg-red-700 text-white"
              onClick={handleReject}
            >
              Confirm reject
            </button>
            <button
              className="px-4 py-2 rounded text-sm font-medium bg-gray-200 hover:bg-gray-300 text-gray-700"
              onClick={() => setGrade(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {grade === "GREEN" && (
        <p className="text-sm font-semibold text-green-700 mt-2">✓ Approved and added to exemplar bank</p>
      )}
    </div>
  );
}
