import { Router } from "express";
import QRCode from "qrcode";
import { prisma } from "../lib/prisma.js";
import { requireManager } from "../middleware/auth.js";
import { cairoDateOnly, todayCairoDateOnly, toCairoDateStr } from "../lib/time.js";
import { env } from "../env.js";
import {
  ensureCodeForDoctorDate,
  regenerateCode,
  revokeCode,
  NoSessionsScheduledError,
} from "../services/codeService.js";
import { dateQuerySchema, generateCodeSchema, generateAllSchema } from "../validators/code.js";

export const codesRouter = Router();
codesRouter.use(requireManager);

function resolveDate(dateStr: string | undefined): Date {
  return dateStr ? cairoDateOnly(dateStr) : todayCairoDateOnly();
}

codesRouter.get("/today", async (req, res) => {
  const parsed = dateQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message });
  }
  const dateOnly = resolveDate(parsed.data.date);

  const sessions = await prisma.session.findMany({
    where: { date: dateOnly },
    include: { doctor: true },
    orderBy: { start: "asc" },
  });

  const doctorMap = new Map<string, { id: string; name: string; sessions: typeof sessions }>();
  for (const s of sessions) {
    if (!doctorMap.has(s.doctorId)) {
      doctorMap.set(s.doctorId, { id: s.doctorId, name: s.doctor.name, sessions: [] });
    }
    doctorMap.get(s.doctorId)!.sessions.push(s);
  }

  const codes = await prisma.code.findMany({ where: { date: dateOnly } });
  const codeByDoctor = new Map(codes.map((c) => [c.doctorId, c]));

  const attendanceCount = await prisma.attendance.count({
    where: { date: dateOnly, status: { in: ["PRESENT", "LATE"] } },
  });

  const doctors = [...doctorMap.values()].map((d) => ({
    doctor: { id: d.id, name: d.name },
    sessions: d.sessions.map((s) => ({
      id: s.id,
      type: s.type,
      title: s.title,
      location: s.location,
      start: s.start,
      end: s.end,
    })),
    code: codeByDoctor.get(d.id) ?? null,
  }));

  res.json({
    date: toCairoDateStr(dateOnly),
    summary: { totalScheduled: doctorMap.size, checkedIn: attendanceCount },
    doctors,
  });
});

codesRouter.post("/generate", async (req, res) => {
  const parsed = generateCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message });
  }
  const dateOnly = resolveDate(parsed.data.date);
  try {
    const code = await ensureCodeForDoctorDate(parsed.data.doctorId, dateOnly, req.session.managerId!);
    res.status(201).json(code);
  } catch (err) {
    if (err instanceof NoSessionsScheduledError) {
      return res.status(400).json({ error: "NO_SESSIONS", message: err.message });
    }
    throw err;
  }
});

codesRouter.post("/generate-all", async (req, res) => {
  const parsed = generateAllSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message });
  }
  const dateOnly = resolveDate(parsed.data.date);

  const sessions = await prisma.session.findMany({ where: { date: dateOnly }, select: { doctorId: true } });
  const doctorIds = [...new Set(sessions.map((s) => s.doctorId))];

  let generated = 0;
  for (const doctorId of doctorIds) {
    const existing = await prisma.code.findUnique({ where: { doctorId_date: { doctorId, date: dateOnly } } });
    if (existing && !existing.revoked) continue;
    await ensureCodeForDoctorDate(doctorId, dateOnly, req.session.managerId!);
    generated++;
  }

  res.status(201).json({ totalScheduled: doctorIds.length, generated });
});

codesRouter.post("/:id/regenerate", async (req, res) => {
  try {
    const updated = await regenerateCode(req.params.id, req.session.managerId!);
    if (!updated) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(updated);
  } catch (err) {
    if (err instanceof NoSessionsScheduledError) {
      return res.status(400).json({ error: "NO_SESSIONS", message: err.message });
    }
    throw err;
  }
});

codesRouter.post("/:id/revoke", async (req, res) => {
  const updated = await revokeCode(req.params.id, req.session.managerId!);
  if (!updated) return res.status(404).json({ error: "NOT_FOUND" });
  res.json(updated);
});

codesRouter.get("/:id/qrcode", async (req, res) => {
  const code = await prisma.code.findUnique({ where: { id: req.params.id } });
  if (!code) return res.status(404).json({ error: "NOT_FOUND" });

  const checkInUrl = `${env.CLIENT_ORIGIN}/?code=${encodeURIComponent(code.code)}`;
  const dataUrl = await QRCode.toDataURL(checkInUrl, { width: 300, margin: 1 });
  res.json({ dataUrl, checkInUrl });
});
