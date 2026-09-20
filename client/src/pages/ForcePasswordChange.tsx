import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../hooks/useAuth";

export default function ForcePasswordChange() {
  const { manager, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (manager && !manager.mustChangePassword) {
    navigate("/manager/today");
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      await refresh();
      navigate("/manager/today");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-slate-50">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h1 className="text-xl font-bold text-center mb-2 text-slate-800">Set a new password</h1>
        <p className="text-sm text-slate-500 text-center mb-6">
          This is your first login. Choose a new password before continuing.
        </p>

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>}

        <label className="block text-sm font-medium text-slate-700 mb-1">Current (temporary) password</label>
        <input
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full mb-4 rounded border border-slate-300 px-3 py-2 text-base"
        />

        <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
        <input
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full mb-4 rounded border border-slate-300 px-3 py-2 text-base"
        />

        <label className="block text-sm font-medium text-slate-700 mb-1">Confirm new password</label>
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full mb-6 rounded border border-slate-300 px-3 py-2 text-base"
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-slate-800 text-white rounded py-2 font-medium disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Set password"}
        </button>
        <button type="button" onClick={logout} className="w-full mt-3 text-sm text-slate-500 hover:underline">
          Log out
        </button>
      </form>
    </div>
  );
}
