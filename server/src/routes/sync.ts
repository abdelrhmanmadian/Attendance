import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireManager } from "../middleware/auth.js";
import { retryAllUnsyncedAttendance } from "../services/syncService.js";
import { sheetsConfigured } from "../env.js";

export const syncRouter = Router();
syncRouter.use(requireManager);

syncRouter.get("/status", async (_req, res) => {
  const unsyncedCount = await prisma.attendance.count({ where: { syncedToSheet: false } });
  res.json({ sheetsConfigured, unsyncedCount });
});

syncRouter.post("/retry-now", async (_req, res) => {
  if (!sheetsConfigured) {
    return res.status(400).json({
      error: "SHEETS_NOT_CONFIGURED",
      message: "Google Sheets sync isn't configured for this deployment.",
    });
  }
  const result = await retryAllUnsyncedAttendance();
  res.json(result);
});
