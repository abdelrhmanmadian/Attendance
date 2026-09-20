import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireManager } from "../middleware/auth.js";
import { getSettings } from "../lib/settings.js";
import { recordAudit } from "../lib/auditLog.js";
import { updateSettingsSchema } from "../validators/settings.js";

export const settingsRouter = Router();
settingsRouter.use(requireManager);

settingsRouter.get("/", async (_req, res) => {
  const settings = await getSettings();
  res.json(settings);
});

settingsRouter.patch("/", async (req, res) => {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message });
  }
  const existing = await getSettings();
  const updated = await prisma.settings.update({ where: { id: 1 }, data: parsed.data });

  await recordAudit({
    managerId: req.session.managerId!,
    action: "UPDATE_SETTINGS",
    entity: "Settings",
    oldValue: existing,
    newValue: updated,
    note: "Updated code/window/grace settings",
  });

  res.json(updated);
});
