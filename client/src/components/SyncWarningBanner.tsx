import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";

interface SyncStatus {
  sheetsConfigured: boolean;
  unsyncedCount: number;
}

const POLL_MS = 30_000;

export default function SyncWarningBanner() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<SyncStatus>("/sync/status");
      setStatus(res);
    } catch {
      // Silently ignore; this is a non-critical background indicator.
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  async function handleRetry() {
    setRetrying(true);
    try {
      await api.post("/sync/retry-now");
      await load();
    } catch {
      // Banner just stays up; the background job will keep retrying anyway.
    } finally {
      setRetrying(false);
    }
  }

  if (!status || !status.sheetsConfigured || status.unsyncedCount === 0) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-4 py-2 flex items-center justify-between gap-3 text-sm">
      <span>
        {status.unsyncedCount} attendance record{status.unsyncedCount === 1 ? "" : "s"} not yet synced to Google
        Sheets. They're safely saved and will retry automatically.
      </span>
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="rounded border border-amber-400 px-3 py-1 font-medium whitespace-nowrap disabled:opacity-50"
      >
        {retrying ? "Retrying..." : "Retry sync now"}
      </button>
    </div>
  );
}
