import { Router } from "express";
import { subDays } from "date-fns";
import { env, sheetsConfigured } from "../env.js";
import { todayCairoDateOnly } from "../lib/time.js";
import { markAbsentDoctorsForDate } from "../services/absentJobService.js";
import { retryAllUnsyncedAttendance } from "../services/syncService.js";

export const cronRouter = Router();

// Only reachable on Vercel, by Vercel's own Cron Jobs scheduler — it sends
// this exact header automatically whenever a CRON_SECRET env var is set on
// the project, so this rejects anyone else who finds the URL. On Bonto/Render/
// local dev, CRON_SECRET is never set, so this router 500s harmlessly instead
// of being reachable at all (those hosts use the node-cron jobs in
// jobs/retrySync.ts and jobs/markAbsent.ts instead, started from index.ts).
cronRouter.use((req, res, next) => {
  if (!env.CRON_SECRET) {
    return res.status(500).json({ error: "CRON_NOT_CONFIGURED", message: "CRON_SECRET isn't set." });
  }
  if (req.headers.authorization !== `Bearer ${env.CRON_SECRET}`) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
  next();
});

// Scheduled (see vercel.json) to run once daily at a fixed UTC time chosen
// to always land shortly AFTER 23:59 Cairo time in both DST states (Vercel's
// free-tier cron timing is only guaranteed "within the hour", and firing
// before 23:59 Cairo would wrongly mark someone absent before their last
// session of the day even ends) — which means by the time this actually
// runs, Cairo's calendar date has already rolled over, so the day being
// closed out is "yesterday" from here, not "today".
cronRouter.post("/mark-absent", async (_req, res) => {
  const targetDate = subDays(todayCairoDateOnly(), 1);
  const result = await markAbsentDoctorsForDate(targetDate);
  res.json(result);
});

// Not wired into vercel.json's crons (Vercel's free tier can't run anything
// more often than once/day, so a genuine 5-minute retry loop isn't possible
// there) — kept here so it can be pointed at by an external scheduler (e.g.
// a free service like cron-job.org) if that's ever wanted. Until then, the
// manager dashboard's own "Retry sync now" button is the way this runs.
cronRouter.post("/retry-sync", async (_req, res) => {
  if (!sheetsConfigured) {
    return res.json({ skipped: true, reason: "Sheets not configured" });
  }
  const result = await retryAllUnsyncedAttendance();
  res.json(result);
});
