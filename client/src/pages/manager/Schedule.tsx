import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import ScheduleImportModal from "../../components/ScheduleImportModal";
import PdfScheduleImportModal from "../../components/PdfScheduleImportModal";
import GoogleSheetImportModal from "../../components/GoogleSheetImportModal";

interface Doctor {
  id: string;
  name: string;
  active: boolean;
}

interface SessionRow {
  id: string;
  date: string;
  type: string;
  title: string;
  groupName: string | null;
  start: string;
  end: string;
  location: string;
  doctorId: string;
  locked: boolean;
  doctor: Doctor;
}

interface MergedRow {
  key: string;
  ids: string[];
  type: string;
  title: string;
  groups: string[];
  start: string;
  end: string;
  location: string;
  doctorName: string;
  locked: boolean;
}

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  type: "Lecture",
  title: "",
  groupName: "",
  startTime: "09:00",
  endTime: "10:40",
  location: "",
  doctorId: "",
};

function toCairoHHMM(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit" });
}

// The same real-world class often appears as separate Session rows, one per
// student group sharing it (that's how the source timetable encodes a
// combined lecture). Merge those for display so the manager sees "1AR1,
// 1AR2" once instead of the identical row twice.
function mergeSessionsForDisplay(sessions: SessionRow[]): MergedRow[] {
  const byKey = new Map<string, MergedRow>();
  for (const s of sessions) {
    const key = [s.doctorId, s.start, s.end, s.type, s.title, s.location].join("|");
    const existing = byKey.get(key);
    if (existing) {
      existing.ids.push(s.id);
      if (s.groupName && !existing.groups.includes(s.groupName)) existing.groups.push(s.groupName);
      existing.locked = existing.locked || s.locked;
    } else {
      byKey.set(key, {
        key,
        ids: [s.id],
        type: s.type,
        title: s.title,
        groups: s.groupName ? [s.groupName] : [],
        start: s.start,
        end: s.end,
        location: s.location,
        doctorName: s.doctor.name,
        locked: s.locked,
      });
    }
  }
  return [...byKey.values()].sort((a, b) => a.start.localeCompare(b.start));
}

export default function Schedule() {
  const [selectedDate, setSelectedDate] = useState(emptyForm.date);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingIds, setEditingIds] = useState<string[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [showPdfImport, setShowPdfImport] = useState(false);
  const [showSheetImport, setShowSheetImport] = useState(false);

  async function loadSessions() {
    setLoading(true);
    const list = await api.get<SessionRow[]>(`/sessions?date=${selectedDate}`);
    setSessions(list);
    setLoading(false);
  }

  useEffect(() => {
    api.get<Doctor[]>("/doctors").then(setDoctors);
  }, []);

  useEffect(() => {
    loadSessions();
    cancelEdit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  function startEdit(row: MergedRow) {
    const first = sessions.find((s) => s.id === row.ids[0])!;
    setCreating(false);
    setEditingIds(row.ids);
    setForm({
      date: selectedDate,
      type: row.type,
      title: row.title,
      groupName: row.groups.join(", "),
      startTime: toCairoHHMM(row.start),
      endTime: toCairoHHMM(row.end),
      location: row.location,
      doctorId: first.doctorId,
    });
  }

  function startCreate() {
    setEditingIds(null);
    setCreating(true);
    setForm({ ...emptyForm, date: selectedDate });
  }

  function cancelEdit() {
    setEditingIds(null);
    setCreating(false);
    setForm({ ...emptyForm, date: selectedDate });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingIds && !creating) return;
    setError(null);

    if (creating) {
      try {
        await api.post("/sessions", { ...form, groupName: form.groupName || undefined });
        cancelEdit();
        await loadSessions();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to add session.");
      }
      return;
    }
    if (!editingIds) return;
    // A merged row can represent several underlying sessions (one per
    // student group sharing the same class). Group name is the one field
    // that legitimately differs between them, so only send it through when
    // there's a single underlying session to avoid overwriting every
    // group's distinct name with the joined display string.
    const payload =
      editingIds.length === 1
        ? { ...form, groupName: form.groupName || undefined }
        : { ...form, groupName: undefined };
    try {
      await Promise.all(editingIds.map((id) => api.patch(`/sessions/${id}`, payload)));
      cancelEdit();
      await loadSessions();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const note = window.prompt(
          "This session already has attendance recorded. Enter a note to override and save anyway:"
        );
        if (note) {
          try {
            await Promise.all(editingIds.map((id) => api.patch(`/sessions/${id}`, { ...payload, overrideNote: note })));
            cancelEdit();
            await loadSessions();
            return;
          } catch (err2) {
            setError(err2 instanceof ApiError ? err2.message : "Failed to save.");
            return;
          }
        }
        return;
      }
      setError(err instanceof ApiError ? err.message : "Failed to save session.");
    }
  }

  async function handleDelete(row: MergedRow) {
    const label = row.groups.length > 1 ? `${row.title} (${row.groups.join(", ")})` : row.title;
    if (!window.confirm(`Delete "${label}" for ${row.doctorName}?`)) return;
    try {
      await Promise.all(row.ids.map((id) => api.delete(`/sessions/${id}`, {})));
      await loadSessions();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const note = window.prompt(
          "This session already has attendance recorded. Enter a note to override and delete anyway:"
        );
        if (note) {
          await Promise.all(row.ids.map((id) => api.delete(`/sessions/${id}`, { overrideNote: note })));
          await loadSessions();
        }
        return;
      }
      setError(err instanceof ApiError ? err.message : "Failed to delete session.");
    }
  }

  const mergedRows = mergeSessionsForDisplay(sessions);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Schedule</h1>
        <div className="flex gap-2">
          <button
            onClick={startCreate}
            className="bg-slate-800 text-white rounded px-4 py-2 text-sm font-medium"
          >
            Add Session
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="bg-slate-800 text-white rounded px-4 py-2 text-sm font-medium"
          >
            Change Schedule (Excel)
          </button>
          <button
            onClick={() => setShowPdfImport(true)}
            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Import from PDF
          </button>
          <button
            onClick={() => setShowSheetImport(true)}
            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Import from Google Sheet
          </button>
        </div>
      </div>

      {showImport && (
        <ScheduleImportModal
          onClose={() => setShowImport(false)}
          onImported={() => {
            loadSessions();
          }}
        />
      )}

      {showPdfImport && (
        <PdfScheduleImportModal
          onClose={() => setShowPdfImport(false)}
          onImported={() => {
            loadSessions();
          }}
        />
      )}

      {showSheetImport && (
        <GoogleSheetImportModal
          onClose={() => setShowSheetImport(false)}
          onImported={() => {
            loadSessions();
          }}
        />
      )}

      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2"
        />
      </div>

      {(editingIds || creating) && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <p className="col-span-2 sm:col-span-4 text-sm font-medium text-slate-600">
            {creating ? `New session on ${selectedDate}` : "Edit session"}
          </p>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Course title"
            required
            className="col-span-2 rounded border border-slate-300 px-3 py-2"
          />
          <input
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            placeholder="Type (Lecture/Tutorial/Lab...)"
            required
            className="rounded border border-slate-300 px-3 py-2"
          />
          <input
            value={form.groupName}
            onChange={(e) => setForm({ ...form, groupName: e.target.value })}
            placeholder="Group (optional)"
            disabled={!creating && (editingIds?.length ?? 0) > 1}
            title={
              !creating && (editingIds?.length ?? 0) > 1
                ? "This class covers multiple groups — edit each group's session individually to change its group name."
                : undefined
            }
            className="rounded border border-slate-300 px-3 py-2 disabled:bg-slate-100 disabled:text-slate-400"
          />
          <input
            type="time"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            required
            className="rounded border border-slate-300 px-3 py-2"
          />
          <input
            type="time"
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            required
            className="rounded border border-slate-300 px-3 py-2"
          />
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="Location"
            required
            className="rounded border border-slate-300 px-3 py-2"
          />
          <select
            value={form.doctorId}
            onChange={(e) => setForm({ ...form, doctorId: e.target.value })}
            required
            className="rounded border border-slate-300 px-3 py-2"
          >
            <option value="">Select doctor</option>
            {doctors.filter((d) => d.active).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <div className="col-span-2 sm:col-span-4 flex gap-2">
            <button type="submit" className="bg-slate-800 text-white rounded px-4 py-2 font-medium">
              {creating ? "Add session" : "Save changes"}
            </button>
            <button type="button" onClick={cancelEdit} className="rounded border border-slate-300 px-4 py-2">
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>}

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : (
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Group</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Doctor</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mergedRows.map((row) => (
                <tr key={row.key}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {toCairoHHMM(row.start)}–{toCairoHHMM(row.end)}
                  </td>
                  <td className="px-3 py-2">{row.type}</td>
                  <td className="px-3 py-2">
                    {row.title}
                    {row.locked && <span className="ml-2 text-xs text-amber-600 font-medium">locked</span>}
                  </td>
                  <td className="px-3 py-2">{row.groups.length > 0 ? row.groups.join(", ") : "—"}</td>
                  <td className="px-3 py-2">{row.location}</td>
                  <td className="px-3 py-2">{row.doctorName}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => startEdit(row)} className="text-slate-600 hover:underline mr-3">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(row)} className="text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {mergedRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                    No sessions scheduled for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
