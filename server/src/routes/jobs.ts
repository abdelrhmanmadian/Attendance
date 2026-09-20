import { Router } from "express";
import { requireManager } from "../middleware/auth.js";
import { cairoDateOnly, todayCairoDateOnly } from "../lib/time.js";
import { markAbsentDoctorsForDate } from "../services/absentJobService.js";
import { markAbsentQuerySchema } from "../validators/jobs.js";

export const jobsRouter = Router();
jobsRouter.use(requireManager);

// Manual trigger: lets a manager backfill a day the automatic 23:59 job
// missed (or run it early for testing), rather than waiting for the cron.
jobsRouter.post("/mark-absent", async (req, res) => {
  const parsed = markAbsentQuerySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message });
  }
  const dateOnly = parsed.data.date ? cairoDateOnly(parsed.data.date) : todayCairoDateOnly();
  const result = await markAbsentDoctorsForDate(dateOnly);
  res.json(result);
});
