import { useEffect, useState, type FormEvent } from "react";
import DoctorSearchDropdown from "../components/DoctorSearchDropdown";
import { ApiError } from "../api/client";

interface Doctor {
  id: string;
  name: string;
}

interface SessionInfo {
  type: string;
  title: string;
  location: string;
  start: string;
  end: string;
}

interface CheckinResult {
  doctorName: string;
  checkInTime: string;
  status: "PRESENT" | "LATE" | "ABSENT";
  sessions: SessionInfo[];
}

export default function CheckIn() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selected, setSelected] = useState<Doctor | null>(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);

  useEffect(() => {
    fetch("/api/public/doctors")
      .then((r) => r.json())
      .then(setDoctors)
      .catch(() => setError("Couldn't load the doctor list. Please refresh."));

    const params = new URLSearchParams(window.location.search);
    const prefillCode = params.get("code");
    if (prefillCode) setCode(prefillCode.toUpperCase());
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selected) {
      setError("Please select your name from the list.");
      return;
    }
    if (!code.trim()) {
      setError("Please enter your code.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId: selected.id, doctorName: selected.name, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.message ?? "Check-in failed", data.error);
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const isLate = result.status === "LATE";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-slate-50">
        <div className="w-full max-w-sm text-center">
          <div className={`text-5xl mb-4 ${isLate ? "text-amber-500" : "text-green-600"}`}>
            {isLate ? "⏰" : "✅"}
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">{result.doctorName}</h1>
          <p className={`text-lg font-semibold mb-4 ${isLate ? "text-amber-600" : "text-green-700"}`}>
            {isLate ? "Checked in — Late" : "Checked in — Present"}
          </p>
          <p className="text-slate-500 mb-6">
            {new Date(result.checkInTime).toLocaleTimeString("en-GB", {
              timeZone: "Africa/Cairo",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            (Cairo time)
          </p>
          <div className="text-left bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-500 mb-2">Today's sessions</p>
            <ul className="text-sm text-slate-700 space-y-1">
              {result.sessions.map((s, i) => (
                <li key={i}>
                  {s.type} {s.start}–{s.end} {s.title} ({s.location})
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-slate-50">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-8 text-slate-800">Attendance Check-In</h1>

        <div className="mb-4">
          <DoctorSearchDropdown doctors={doctors} selected={selected} onSelect={setSelected} />
        </div>

        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter your code"
          autoComplete="off"
          autoCapitalize="characters"
          className="w-full rounded-lg border border-slate-300 px-4 py-4 text-lg tracking-widest font-mono mb-4"
        />

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-slate-800 text-white rounded-lg py-4 text-lg font-semibold disabled:opacity-50"
        >
          {submitting ? "Checking in..." : "Check In"}
        </button>
      </form>
    </div>
  );
}
