import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import ScheduleImportModal from "../../components/ScheduleImportModal";
import PdfScheduleImportModal from "../../components/PdfScheduleImportModal";

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

export default function Schedule() {
  const [selectedDate, setSelectedDate] = useState(emptyForm.date);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [duplicateTarget, setDuplicateTarget] = useState(selectedDate);
  const [showImport, setShowImport] = useState(false);
  const [showPdfImport, setShowPdfImport] = useState(false);

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
    setForm((f) => ({ ...f, date: selectedDate }));
    setDuplicateTarget(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  function startEdit(s: SessionRow) {
    setEditingId(s.id);
    setForm({
      date: selectedDate,
      type: s.type,
      title: s.title,
      groupName: s.groupName ?? "",
      startTime: toCairoHHMM(s.start),
      endTime: toCairoHHMM(s.end),
      location: s.location,
      doctorId: s.doctorId,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...emptyForm, date: selectedDate });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = { ...form, groupName: form.groupName || undefined };
    try {
      if (editingId) {
        await api.patch(`/sessions/${editingId}`, payload);
      } else {
        await api.post("/sessions", payload);
      }
      cancelEdit();
      await loadSessions();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const note = window.prompt(
          "This session already has attendance recorded. Enter a note to override and save anyway:"
        );
        if (note) {
          try {
            await api.patch(`/sessions/${editingId}`, { ...payload, overrideNote: note });
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

  async function handleDelete(s: SessionRow) {
    if (!window.confirm(`Delete "${s.title}" for ${s.doctor.name}?`)) return;
    try {
      await api.delete(`/sessions/${s.id}`, {});
      await loadSessions();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const note = window.prompt(
          "This session already has attendance recorded. Enter a note to override and delete anyway:"
        );
        if (note) {
          await api.delete(`/sessions/${s.id}`, { overrideNote: note });
          await loadSessions();
        }
        return;
      }
      setError(err instanceof ApiError ? err.message : "Failed to delete session.");
    }
  }

  async function handleDuplicate(mode: "day" | "week") {
    try {
      const result = await api.post<{ createdCount: number }>("/sessions/duplicate", {
        mode,
        fromDate: selectedDate,
        toDate: duplicateTarget,
      });
      alert(`Created ${result.createdCount} session(s).`);
      if (duplicateTarget === selectedDate) await loadSessions();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to duplicate schedule.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Schedule</h1>
        <div className="flex gap-2">
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

      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Duplicate to</label>
            <input
              type="date"
              value={duplicateTarget}
              onChange={(e) => setDuplicateTarget(e.target.value)}
              className="rounded border border-slate-300 px-3 py-2"
            />
          </div>
          <button onClick={() => handleDuplicate("day")} className="rounded border border-slate-300 px-3 py-2 text-sm">
            Duplicate day
          </button>
          <button onClick={() => handleDuplicate("week")} className="rounded border border-slate-300 px-3 py-2 text-sm">
            Duplicate week
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
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
          className="rounded border border-slate-300 px-3 py-2"
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
            {editingId ? "Save changes" : "Add session"}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="rounded border border-slate-300 px-4 py-2">
              Cancel
            </button>
          )}
        </div>
      </form>
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
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {toCairoHHMM(s.start)}–{toCairoHHMM(s.end)}
                  </td>
                  <td className="px-3 py-2">{s.type}</td>
                  <td className="px-3 py-2">
                    {s.title}
                    {s.locked && <span className="ml-2 text-xs text-amber-600 font-medium">locked</span>}
                  </td>
                  <td className="px-3 py-2">{s.groupName ?? "—"}</td>
                  <td className="px-3 py-2">{s.location}</td>
                  <td className="px-3 py-2">{s.doctor.name}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => startEdit(s)} className="text-slate-600 hover:underline mr-3">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(s)} className="text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
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
