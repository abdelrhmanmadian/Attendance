import cron from "node-cron";
import { todayCairoDateOnly } from "../lib/time.js";
import { markAbsentDoctorsForDate } from "../services/absentJobService.js";

export function startMarkAbsentJob() {
  // 23:59 Cairo time, every day.
  cron.schedule(
    "59 23 * * *",
    async () => {
      try {
        const today = todayCairoDateOnly();
        const result = await markAbsentDoctorsForDate(today);
        if (result.marked > 0) {
          console.log(`[markAbsent] marked ${result.marked} doctor(s) absent for today`);
        }
      } catch (err) {
        console.error("[markAbsent] unexpected error", err);
      }
    },
    { timezone: "Africa/Cairo" }
  );
}
