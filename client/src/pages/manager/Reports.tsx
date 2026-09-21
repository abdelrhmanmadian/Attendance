import { useState } from "react";
import { api, ApiError } from "../../api/client";

interface ReportRow {
  date: string;
  attended: string[];
  absent: string[];
}

function defaultRange() {
  const to = new Date().toISOString().slice(0, 10);
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

export default function Reports() {
  const [{ from, to }, setRange] = useState(defaultRange());
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ReportRow[]>(`/reports/attendance?from=${from}&to=${to}`);
      setRows(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load report.");
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    window.open(`/api/reports/attendance/export?from=${from}&to=${to}`, "_blank");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Reports</h1>

      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            className="rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className="rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <button onClick={handleGenerate} disabled={loading} className="bg-slate-800 text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50">
          {loading ? "Loading..." : "Generate report"}
        </button>
        {rows && rows.length > 0 && (
          <button onClick={handleExport} className="rounded border border-slate-300 px-4 py-2 text-sm font-medium">
            Export to Excel
          </button>
        )}
      </div>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>}

      {rows && (
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2 whitespace-nowrap">Date</th>
                <th className="px-3 py-2">Attended</th>
                <th className="px-3 py-2">Absent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.date}>
                  <td className="px-3 py-2 font-medium align-top whitespace-nowrap">{r.date}</td>
                  <td className="px-3 py-2 text-green-700">{r.attended.length > 0 ? r.attended.join(", ") : "—"}</td>
                  <td className="px-3 py-2 text-red-600">{r.absent.length > 0 ? r.absent.join(", ") : "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-slate-400">
                    No scheduled sessions in this range.
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
