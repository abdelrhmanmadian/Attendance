import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/client";

interface Doctor {
  id: string;
  name: string;
  department: string | null;
  active: boolean;
}

export default function Doctors() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const list = await api.get<Doctor[]>(`/doctors?includeInactive=${showInactive}`);
    setDoctors(list);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/doctors", { name, department: department || undefined });
      setName("");
      setDepartment("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add doctor.");
    }
  }

  async function toggleActive(doctor: Doctor) {
    await api.patch(`/doctors/${doctor.id}`, { active: !doctor.active });
    await load();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Doctors</h1>

      <form onSubmit={handleAdd} className="bg-white border border-slate-200 rounded-lg p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Doctor name"
          required
          className="flex-1 rounded border border-slate-300 px-3 py-2"
        />
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="Department (optional)"
          className="flex-1 rounded border border-slate-300 px-3 py-2"
        />
        <button type="submit" className="bg-slate-800 text-white rounded px-4 py-2 font-medium whitespace-nowrap">
          Add doctor
        </button>
      </form>
      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>}

      <label className="flex items-center gap-2 text-sm text-slate-600 mb-3">
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
        Show deactivated doctors
      </label>

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : (
        <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {doctors.map((d) => (
            <li key={d.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className={`font-medium ${!d.active ? "text-slate-400 line-through" : "text-slate-800"}`}>
                  {d.name}
                </div>
                {d.department && <div className="text-sm text-slate-500">{d.department}</div>}
              </div>
              <button
                onClick={() => toggleActive(d)}
                className={`text-sm font-medium ${d.active ? "text-red-600" : "text-green-600"}`}
              >
                {d.active ? "Deactivate" : "Reactivate"}
              </button>
            </li>
          ))}
          {doctors.length === 0 && <li className="px-4 py-6 text-center text-slate-400">No doctors yet.</li>}
        </ul>
      )}
    </div>
  );
}
