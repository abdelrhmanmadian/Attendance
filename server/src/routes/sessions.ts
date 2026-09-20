import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireManager } from "../middleware/auth.js";
import {
  createSessionSchema,
  updateSessionSchema,
  deleteSessionSchema,
  duplicateScheduleSchema,
  listSessionsQuerySchema,
} from "../validators/session.js";
import { cairoDateOnly } from "../lib/time.js";
import { createSession, updateSession, deleteSession, duplicateDay, duplicateWeek, LockedSessionError } from "../services/scheduleService.js";
import { recordAudit } from "../lib/auditLog.js";

export const sessionsRouter = Router();
sessionsRouter.use(requireManager);

sessionsRouter.get("/", async (req, res) => {
  const parsed = listSessionsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message });
  }
  const { date, from, to, doctorId, type, groupName } = parsed.data;

  const where: Record<string, unknown> = {};
  if (date) where.date = cairoDateOnly(date);
  if (from || to) {
    where.date = {
      ...(from ? { gte: cairoDateOnly(from) } : {}),
      ...(to ? { lte: cairoDateOnly(to) } : {}),
    };
  }
  if (doctorId) where.doctorId = doctorId;
  if (type) where.type = type;
  if (groupName) where.groupName = groupName;

  const sessions = await prisma.session.findMany({
    where,
    include: { doctor: true },
    orderBy: [{ date: "asc" }, { start: "asc" }],
  });
  res.json(sessions);
});

sessionsRouter.post("/", async (req, res) => {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message });
  }
  const session = await createSession(parsed.data);
  await recordAudit({
    managerId: req.session.managerId!,
    action: "CREATE_SESSION",
    entity: `Session:${session.id}`,
    newValue: session,
    note: `Added session ${session.title} on ${parsed.data.date}`,
  });
  res.status(201).json(session);
});

sessionsRouter.patch("/:id", async (req, res) => {
  const parsed = updateSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message });
  }
  try {
    const updated = await updateSession(req.params.id, parsed.data, req.session.managerId!);
    if (!updated) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(updated);
  } catch (err) {
    if (err instanceof LockedSessionError) {
      return res.status(409).json({ error: "SESSION_LOCKED", message: err.message });
    }
    throw err;
  }
});

sessionsRouter.delete("/:id", async (req, res) => {
  const parsed = deleteSessionSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message });
  }
  try {
    const deleted = await deleteSession(req.params.id, parsed.data.overrideNote, req.session.managerId!);
    if (!deleted) return res.status(404).json({ error: "NOT_FOUND" });
    res.status(204).end();
  } catch (err) {
    if (err instanceof LockedSessionError) {
      return res.status(409).json({ error: "SESSION_LOCKED", message: err.message });
    }
    throw err;
  }
});

sessionsRouter.post("/duplicate", async (req, res) => {
  const parsed = duplicateScheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message });
  }
  const { mode, fromDate, toDate } = parsed.data;
  const created =
    mode === "day"
      ? await duplicateDay(fromDate, toDate, req.session.managerId!)
      : await duplicateWeek(fromDate, toDate, req.session.managerId!);
  res.status(201).json({ createdCount: created.length });
});
