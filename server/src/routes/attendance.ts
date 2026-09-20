import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireManager } from "../middleware/auth.js";
import { cairoDateOnly } from "../lib/time.js";
import {
  overrideAttendanceSchema,
  resetAttendanceSchema,
  listAttendanceQuerySchema,
} from "../validators/attendance.js";
import { overrideAttendance, resetAttendance, DoctorNotFoundError } from "../services/attendanceOverrideService.js";
import { attemptSyncAttendance } from "../services/syncService.js";

export const attendanceRouter = Router();
attendanceRouter.use(requireManager);

attendanceRouter.get("/", async (req, res) => {
  const parsed = listAttendanceQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message });
  }
  const { date, from, to, doctorId } = parsed.data;

  const where: Record<string, unknown> = {};
  if (date) where.date = cairoDateOnly(date);
  if (from || to) {
    where.date = {
      ...(from ? { gte: cairoDateOnly(from) } : {}),
      ...(to ? { lte: cairoDateOnly(to) } : {}),
    };
  }
  if (doctorId) where.doctorId = doctorId;

  const attendance = await prisma.attendance.findMany({ where, orderBy: [{ date: "desc" }] });
  res.json(attendance);
});

attendanceRouter.post("/override", async (req, res) => {
  const parsed = overrideAttendanceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message });
  }
  try {
    const updated = await overrideAttendance({ ...parsed.data, managerId: req.session.managerId! });
    attemptSyncAttendance(updated.id).catch(() => {});
    res.status(200).json(updated);
  } catch (err) {
    if (err instanceof DoctorNotFoundError) {
      return res.status(404).json({ error: "DOCTOR_NOT_FOUND", message: err.message });
    }
    throw err;
  }
});

attendanceRouter.post("/:id/reset", async (req, res) => {
  const parsed = resetAttendanceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message });
  }
  const deleted = await resetAttendance(req.params.id, parsed.data.note, req.session.managerId!);
  if (!deleted) return res.status(404).json({ error: "NOT_FOUND" });
  res.status(204).end();
});
