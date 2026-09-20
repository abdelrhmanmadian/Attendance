import { useState } from "react";
import { ApiError } from "../api/client";

interface PatternRow {
  dayOfWeek: "Sa" | "Su" | "Mo" | "Tu" | "We" | "Th";
  type: string;
  title: string;
  groupName?: string | null;
  startTime: string;
  endTime: string;
  location: string;
  doctorName: string;
}

interface PreviewResponse {
  patterns: PatternRow[];
  warnings: string[];
  patternCount: number;
}

interface CommitResponse {
  createdSessions: number;
  replacedSessions: number;
  newDoctors: string[];
}

const DAY_LABELS: Record<PatternRow["dayOfWeek"], string> = {
  Sa: "Saturday",
  Su: "Sunday",
  Mo: "Monday",
  Tu: "Tuesday",
  We: "Wednesday",
  Th: "Thursday",
};

function defaultSemesterDates() {
  const today = new Date();
  const start = today.toISOString().slice(0, 10);
  const end = new Date(today.getTime() + 15 * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { start, end };
}

export default function PdfScheduleImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [patterns, setPatterns] = useState<PatternRow[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [result, setResult] = useState<CommitResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [{ start, end }, setSemester] = useState(defaultSemesterDates());

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPatterns(null);
    setResult(null);
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/schedule-import/pdf/preview", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.message ?? "Preview failed", data.error);
      const preview: PreviewResponse = data;
      setPatterns(preview.patterns);
      setWarnings(preview.warnings);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to read PDF.");
    } finally {
      setBusy(false);
    }
  }

  function updateRow(index: number, field: keyof PatternRow, value: string) {
    if (!patterns) return;
    const next = [...patterns];
    next[index] = { ...next[index], [field]: value };
    setPatterns(next);
  }

  function removeRow(index: number) {
    if (!patterns) return;
    setPatterns(patterns.filter((_, i) => i !== index));
  }

  async function handleConfirm() {
    if (!patterns || patterns.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/schedule-import/pdf/commit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patterns, semesterStart: start, semesterEnd: end }),
      });
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.message ?? "Import failed", data.error);
      setResult(data);
      onImported();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to import schedule.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-5xl max-h-[92vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-800">Import Schedule from PDF Timetable</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">
            &times;
          </button>
        </div>

        {result ? (
          <div>
            <p className="text-green-700 bg-green-50 rounded p-3 mb-4">
              Import complete: {result.createdSessions} session(s) created across the semester date range,{" "}
              {result.replacedSessions} future session(s) replaced
              {result.newDoctors.length > 0 && <>, {result.newDoctors.length} new doctor(s) added</>}.
            </p>
            <button onClick={onClose} className="bg-slate-800 text-white rounded px-4 py-2 font-medium">
              Done
            </button>
          </div>
        ) : !patterns ? (
          <>
            <p className="text-sm text-slate-500 mb-4">
              Upload a weekly timetable PDF (like the university's aSc Timetables export). The layout is read
              automatically, but text-position parsing of a PDF grid isn't perfect — you'll get a chance to
              review and fix every row below before anything is saved.
            </p>
            <label className="rounded bg-slate-800 text-white px-4 py-2 text-sm font-medium cursor-pointer inline-block">
              Choose PDF file
              <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
            </label>
            {busy && <p className="text-slate-500 text-sm mt-4">Reading PDF...</p>}
            {error && <div className="mt-4 text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Semester start</label>
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setSemester((s) => ({ ...s, start: e.target.value }))}
                  className="rounded border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Semester end</label>
                <input
                  type="date"
                  value={end}
                  onChange={(e) => setSemester((s) => ({ ...s, end: e.target.value }))}
                  className="rounded border border-slate-300 px-3 py-2"
                />
              </div>
              <p className="text-xs text-slate-500 max-w-xs">
                Each weekly row below will repeat on its weekday for every week in this range.
              </p>
            </div>

            {warnings.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-amber-700 mb-1">
                  {warnings.length} cell(s) couldn't be read automatically and were skipped:
                </p>
                <ul className="text-xs text-amber-700 bg-amber-50 rounded p-3 max-h-32 overflow-y-auto">
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-sm font-medium text-slate-700 mb-2">
              {patterns.length} weekly session(s) detected. Review and edit before importing:
            </p>
            <div className="overflow-x-auto border border-slate-200 rounded max-h-96 overflow-y-auto mb-4">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left">Day</th>
                    <th className="px-2 py-1 text-left">Type</th>
                    <th className="px-2 py-1 text-left">Title</th>
                    <th className="px-2 py-1 text-left">Group</th>
                    <th className="px-2 py-1 text-left">Start</th>
                    <th className="px-2 py-1 text-left">End</th>
                    <th className="px-2 py-1 text-left">Location</th>
                    <th className="px-2 py-1 text-left">Doctor</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {patterns.map((p, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1 whitespace-nowrap">{DAY_LABELS[p.dayOfWeek]}</td>
                      <td className="px-1 py-1">
                        <input value={p.type} onChange={(e) => updateRow(i, "type", e.target.value)} className="w-20 border border-slate-200 rounded px-1 py-0.5" />
                      </td>
                      <td className="px-1 py-1">
                        <input value={p.title} onChange={(e) => updateRow(i, "title", e.target.value)} className="w-48 border border-slate-200 rounded px-1 py-0.5" />
                      </td>
                      <td className="px-1 py-1">
                        <input value={p.groupName ?? ""} onChange={(e) => updateRow(i, "groupName", e.target.value)} className="w-16 border border-slate-200 rounded px-1 py-0.5" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="time" value={p.startTime} onChange={(e) => updateRow(i, "startTime", e.target.value)} className="border border-slate-200 rounded px-1 py-0.5" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="time" value={p.endTime} onChange={(e) => updateRow(i, "endTime", e.target.value)} className="border border-slate-200 rounded px-1 py-0.5" />
                      </td>
                      <td className="px-1 py-1">
                        <input value={p.location} onChange={(e) => updateRow(i, "location", e.target.value)} className="w-24 border border-slate-200 rounded px-1 py-0.5" />
                      </td>
                      <td className="px-1 py-1">
                        <input value={p.doctorName} onChange={(e) => updateRow(i, "doctorName", e.target.value)} className="w-40 border border-slate-200 rounded px-1 py-0.5" />
                      </td>
                      <td className="px-1 py-1">
                        <button onClick={() => removeRow(i)} className="text-red-600" title="Remove row">
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                  {patterns.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-2 py-4 text-center text-slate-400">
                        No rows left. Nothing will be imported.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>}

            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                disabled={busy || patterns.length === 0}
                className="bg-green-700 text-white rounded px-4 py-2 font-medium disabled:opacity-50"
              >
                {busy ? "Importing..." : `Confirm import (${patterns.length} weekly session(s))`}
              </button>
              <button onClick={() => setPatterns(null)} className="rounded border border-slate-300 px-4 py-2">
                Start over
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
