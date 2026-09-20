import { useState } from "react";
import { api, ApiError } from "../api/client";

interface Props {
  doctorId: string;
  doctorName: string;
  date: string;
  currentStatus?: "PRESENT" | "LATE" | "ABSENT";
  onClose: () => void;
  onSaved: () => void;
}

export default function OverrideModal({ doctorId, doctorName, date, currentStatus, onClose, onSaved }: Props) {
  const [status, setStatus] = useState<"PRESENT" | "LATE" | "ABSENT">(currentStatus ?? "PRESENT");
  const [minutesLate, setMinutesLate] = useState(0);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!note.trim()) {
      setError("A note is required to explain this correction.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/attendance/override", {
        doctorId,
        date,
        status,
        minutesLate: status === "LATE" ? minutesLate : undefined,
        note,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save override.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-1">Override attendance</h2>
        <p className="text-sm text-slate-500 mb-4">
          {doctorName} — {date}
        </p>

        <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="w-full mb-4 rounded border border-slate-300 px-3 py-2"
        >
          <option value="PRESENT">Present</option>
          <option value="LATE">Late</option>
          <option value="ABSENT">Absent</option>
        </select>

        {status === "LATE" && (
          <>
            <label className="block text-sm font-medium text-slate-700 mb-1">Minutes late</label>
            <input
              type="number"
              min={0}
              value={minutesLate}
              onChange={(e) => setMinutesLate(Number(e.target.value))}
              className="w-full mb-4 rounded border border-slate-300 px-3 py-2"
            />
          </>
        )}

        <label className="block text-sm font-medium text-slate-700 mb-1">Note (required)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Why is this being corrected?"
          className="w-full mb-4 rounded border border-slate-300 px-3 py-2"
        />

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>}

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 bg-slate-800 text-white rounded py-2 font-medium disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save override"}
          </button>
          <button onClick={onClose} className="rounded border border-slate-300 px-4 py-2">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
