import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import ProjectorCodeView from "../../components/ProjectorCodeView";

interface Session {
  id: string;
  type: string;
  title: string;
  location: string;
  start: string;
  end: string;
}

interface Code {
  id: string;
  code: string;
  validFrom: string;
  validUntil: string;
  revoked: boolean;
}

interface DoctorRow {
  doctor: { id: string; name: string };
  sessions: Session[];
  code: Code | null;
}

interface TodayResponse {
  date: string;
  summary: { totalScheduled: number; checkedIn: number };
  doctors: DoctorRow[];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit" });
}

const REFRESH_MS = 20_000;

export default function Today() {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyDoctorId, setBusyDoctorId] = useState<string | null>(null);
  const [projectorRow, setProjectorRow] = useState<DoctorRow | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<TodayResponse>("/codes/today");
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load today's schedule.");
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  async function handleGenerate(doctorId: string) {
    setBusyDoctorId(doctorId);
    setError(null);
    try {
      await api.post("/codes/generate", { doctorId });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate code.");
    } finally {
      setBusyDoctorId(null);
    }
  }

  async function handleGenerateAll() {
    setBusyDoctorId("__all__");
    setError(null);
    try {
      await api.post("/codes/generate-all", {});
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate codes.");
    } finally {
      setBusyDoctorId(null);
    }
  }

  async function handleRegenerate(codeId: string, doctorId: string) {
    setBusyDoctorId(doctorId);
    setError(null);
    try {
      await api.post(`/codes/${codeId}/regenerate`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to regenerate code.");
    } finally {
      setBusyDoctorId(null);
    }
  }

  async function handleRevoke(codeId: string, doctorId: string) {
    if (!window.confirm("Revoke this code? The doctor will no longer be able to check in with it.")) return;
    setBusyDoctorId(doctorId);
    setError(null);
    try {
      await api.post(`/codes/${codeId}/revoke`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to revoke code.");
    } finally {
      setBusyDoctorId(null);
    }
  }

  if (!data) {
    return <div className="p-8 text-center text-slate-500">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-slate-800">Today</h1>
        <button
          onClick={handleGenerateAll}
          disabled={busyDoctorId === "__all__"}
          className="bg-slate-800 text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Generate all for today
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-6">{data.date} (Cairo time) — auto-refreshes every 20s</p>

      <div className="flex gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-lg px-6 py-4">
          <div className="text-3xl font-bold text-slate-800">
            {data.summary.checkedIn} / {data.summary.totalScheduled}
          </div>
          <div className="text-sm text-slate-500">checked in</div>
        </div>
      </div>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
        {data.doctors.map((row) => (
          <div key={row.doctor.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
            <div>
              <div className="font-semibold text-slate-800">{row.doctor.name}</div>
              <ul className="text-sm text-slate-500">
                {row.sessions.map((s) => (
                  <li key={s.id}>
                    {s.type} {formatTime(s.start)}–{formatTime(s.end)} {s.title} ({s.location})
                  </li>
                ))}
              </ul>
              {row.code && (
                <div className="text-sm mt-1">
                  <span className={row.code.revoked ? "text-red-500 line-through" : "font-mono font-bold text-slate-700"}>
                    {row.code.code}
                  </span>
                  {row.code.revoked && <span className="text-red-500 text-xs ml-2">revoked</span>}
                  {!row.code.revoked && (
                    <span className="text-xs text-slate-400 ml-2">
                      valid {formatTime(row.code.validFrom)}–{formatTime(row.code.validUntil)}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {!row.code || row.code.revoked ? (
                <button
                  onClick={() => handleGenerate(row.doctor.id)}
                  disabled={busyDoctorId === row.doctor.id}
                  className="bg-slate-800 text-white rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                >
                  Generate
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setProjectorRow(row)}
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm"
                  >
                    Display
                  </button>
                  <button
                    onClick={() => handleRegenerate(row.code!.id, row.doctor.id)}
                    disabled={busyDoctorId === row.doctor.id}
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Regenerate
                  </button>
                  <button
                    onClick={() => handleRevoke(row.code!.id, row.doctor.id)}
                    disabled={busyDoctorId === row.doctor.id}
                    className="text-red-600 text-sm px-2 disabled:opacity-50"
                  >
                    Revoke
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {data.doctors.length === 0 && (
          <div className="p-8 text-center text-slate-400">No doctors scheduled today.</div>
        )}
      </div>

      {projectorRow && projectorRow.code && (
        <ProjectorCodeView
          doctorName={projectorRow.doctor.name}
          codeId={projectorRow.code.id}
          code={projectorRow.code.code}
          validFrom={projectorRow.code.validFrom}
          validUntil={projectorRow.code.validUntil}
          onClose={() => setProjectorRow(null)}
        />
      )}
    </div>
  );
}
