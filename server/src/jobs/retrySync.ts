import cron from "node-cron";
import { retryAllUnsyncedAttendance } from "../services/syncService.js";
import { sheetsConfigured } from "../env.js";

export function startRetrySyncJob() {
  // Every 5 minutes, per spec. No-ops quickly if Sheets isn't configured.
  cron.schedule("*/5 * * * *", async () => {
    if (!sheetsConfigured) return;
    try {
      const result = await retryAllUnsyncedAttendance();
      if (result.attempted > 0) {
        console.log(`[retrySync] attempted ${result.attempted}, succeeded ${result.succeeded}`);
      }
    } catch (err) {
      console.error("[retrySync] unexpected error", err);
    }
  });
}
