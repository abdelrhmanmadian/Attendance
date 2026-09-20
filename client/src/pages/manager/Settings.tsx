import { useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";

interface SettingsData {
  codeLength: number;
  windowBeforeMin: number;
  windowAfterMin: number;
  gracePeriodMin: number;
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<SettingsData>("/settings").then(setSettings);
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api.patch<SettingsData>("/settings", settings);
      setSettings(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return <div className="p-8 text-center text-slate-500">Loading...</div>;
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Settings</h1>

      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Code length</label>
          <input
            type="number"
            min={4}
            max={12}
            value={settings.codeLength}
            onChange={(e) => setSettings({ ...settings, codeLength: Number(e.target.value) })}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
          <p className="text-xs text-slate-400 mt-1">Number of characters in a generated check-in code.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Window before first session (minutes)</label>
          <input
            type="number"
            min={0}
            max={240}
            value={settings.windowBeforeMin}
            onChange={(e) => setSettings({ ...settings, windowBeforeMin: Number(e.target.value) })}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Window after last session (minutes)</label>
          <input
            type="number"
            min={0}
            max={240}
            value={settings.windowAfterMin}
            onChange={(e) => setSettings({ ...settings, windowAfterMin: Number(e.target.value) })}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Grace period (minutes)</label>
          <input
            type="number"
            min={0}
            max={120}
            value={settings.gracePeriodMin}
            onChange={(e) => setSettings({ ...settings, gracePeriodMin: Number(e.target.value) })}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
          <p className="text-xs text-slate-400 mt-1">
            A doctor checking in at or before (first session start + this many minutes) is marked Present.
          </p>
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>}
        {saved && <div className="text-sm text-green-700 bg-green-50 rounded p-2">Settings saved.</div>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-slate-800 text-white rounded px-4 py-2 font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save settings"}
        </button>
      </div>

      <p className="text-xs text-slate-400 mt-4">
        Changes apply to newly generated codes immediately. An already-generated code's window is only
        recomputed if that doctor's schedule is edited afterward — it won't shift on its own just because
        settings changed.
      </p>
    </div>
  );
}
