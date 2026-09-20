import { useState } from "react";
import { ApiError } from "../api/client";

interface ImportRow {
  date: string;
  type: string;
  title: string;
  groupName?: string | null;
  startTime: string;
  endTime: string;
  location: string;
  doctorName: string;
}

interface PreviewResponse {
  valid: boolean;
  rowCount: number;
  rows: ImportRow[];
  errors: { row: number; message: string }[];
}

interface CommitResponse {
  createdSessions: number;
  replacedSessions: number;
  newDoctors: string[];
}

export default function ScheduleImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<CommitResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPreview(null);
    setResult(null);
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/schedule-import/preview", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.message ?? "Preview failed", data.error);
      setPreview(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to read file.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!preview?.valid) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/schedule-import/commit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview.rows }),
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
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-800">Change Schedule</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">
            &times;
          </button>
        </div>

        {result ? (
          <div>
            <p className="text-green-700 bg-green-50 rounded p-3 mb-4">
              Import complete: {result.createdSessions} session(s) created, {result.replacedSessions} future
              session(s) replaced
              {result.newDoctors.length > 0 && (
                <>, {result.newDoctors.length} new doctor(s) added ({result.newDoctors.join(", ")})</>
              )}
              .
            </p>
            <button onClick={onClose} className="bg-slate-800 text-white rounded px-4 py-2 font-medium">
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-4">
              Uploading a new file <strong>replaces every not-yet-happened session</strong>. Sessions already in
              the past, or that already have attendance recorded, are never touched.
            </p>

            <div className="flex flex-wrap gap-3 mb-4">
              <a
                href="/api/schedule-import/template"
                className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Download template
              </a>
              <label className="rounded bg-slate-800 text-white px-4 py-2 text-sm font-medium cursor-pointer">
                Choose file (.xlsx)
                <input type="file" accept=".xlsx" onChange={handleFileChange} className="hidden" />
              </label>
            </div>

            {busy && <p className="text-slate-500 text-sm mb-4">Working...</p>}
            {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>}

            {preview && !preview.valid && (
              <div className="mb-4">
                <p className="text-sm font-medium text-red-700 mb-2">
                  {preview.errors.length} row(s) have errors. Fix them and re-upload — nothing has been imported.
                </p>
                <ul className="text-sm text-red-600 bg-red-50 rounded p-3 max-h-48 overflow-y-auto">
                  {preview.errors.map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview && preview.valid && (
              <div className="mb-4">
                <p className="text-sm font-medium text-green-700 mb-2">
                  {preview.rowCount} row(s) look good. Review below, then confirm to import.
                </p>
                <div className="overflow-x-auto border border-slate-200 rounded max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left">Date</th>
                        <th className="px-2 py-1 text-left">Type</th>
                        <th className="px-2 py-1 text-left">Title</th>
                        <th className="px-2 py-1 text-left">Time</th>
                        <th className="px-2 py-1 text-left">Doctor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.rows.map((r, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1">{r.date}</td>
                          <td className="px-2 py-1">{r.type}</td>
                          <td className="px-2 py-1">{r.title}</td>
                          <td className="px-2 py-1">
                            {r.startTime}–{r.endTime}
                          </td>
                          <td className="px-2 py-1">{r.doctorName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={handleConfirm}
                  disabled={busy}
                  className="mt-4 bg-green-700 text-white rounded px-4 py-2 font-medium disabled:opacity-50"
                >
                  Confirm import
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
