import { useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";

interface AuditEntry {
  id: string;
  managerId: string;
  managerEmail: string;
  action: string;
  entity: string;
  oldValue: string | null;
  newValue: string | null;
  note: string;
  createdAt: string;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Cairo" });
}

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      const res = await api.get<AuditEntry[]>(`/audit-log?${params.toString()}`);
      setEntries(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load audit log.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Audit Log</h1>

      <div className="flex gap-2 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Search by note, action, or entity..."
          className="flex-1 rounded border border-slate-300 px-3 py-2"
        />
        <button onClick={load} className="bg-slate-800 text-white rounded px-4 py-2 text-sm font-medium">
          Search
        </button>
      </div>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>}

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {entries.map((e) => (
            <div key={e.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-semibold text-slate-800">{e.action}</span>
                  <span className="text-sm text-slate-500 ml-2">{e.entity}</span>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">{formatDateTime(e.createdAt)}</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">{e.note}</p>
              <p className="text-xs text-slate-400 mt-1">by {e.managerEmail}</p>
              {(e.oldValue || e.newValue) && (
                <button
                  onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                  className="text-xs text-slate-500 underline mt-1"
                >
                  {expanded === e.id ? "Hide details" : "Show details"}
                </button>
              )}
              {expanded === e.id && (
                <pre className="text-xs bg-slate-50 rounded p-2 mt-2 overflow-x-auto">
                  {e.oldValue && `old: ${e.oldValue}\n`}
                  {e.newValue && `new: ${e.newValue}`}
                </pre>
              )}
            </div>
          ))}
          {entries.length === 0 && <div className="p-8 text-center text-slate-400">No audit log entries found.</div>}
        </div>
      )}
    </div>
  );
}
