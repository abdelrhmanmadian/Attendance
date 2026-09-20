import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { toCairoTimeStr } from "../lib/time.js";
import { checkinSchema } from "../validators/checkin.js";
import { performCheckin, CheckinError } from "../services/checkinService.js";
import { isIpLockedOut, isIpRateLimited, isDoctorRateLimited, logAttempt } from "../lib/checkinRateLimit.js";

export const publicCheckinRouter = Router();

// The only unauthenticated route surface: exposes nothing beyond active
// doctor names, and never returns a code string.
publicCheckinRouter.get("/doctors", async (_req, res) => {
  const doctors = await prisma.doctor.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  res.json(doctors);
});

publicCheckinRouter.post("/checkin", async (req, res) => {
  const ip = req.ip ?? "unknown";

  const lockedOut = await isIpLockedOut(ip);
  if (lockedOut) {
    await logAttempt({ ip, result: "LOCKED_OUT" });
    return res.status(429).json({
      error: "LOCKED_OUT",
      message: "Too many failed attempts. Please try again in 15 minutes.",
    });
  }

  const ipRateLimited = await isIpRateLimited(ip);
  if (ipRateLimited) {
    await logAttempt({ ip, result: "IP_RATE_LIMITED" });
    return res.status(429).json({ error: "RATE_LIMITED", message: "Too many attempts. Please wait a moment and try again." });
  }

  const parsed = checkinSchema.safeParse(req.body);
  if (!parsed.success) {
    await logAttempt({ ip, result: "INVALID_INPUT" });
    return res.status(400).json({ error: "INVALID_INPUT", message: "Please select your name and enter your code." });
  }
  const { doctorId, doctorName, code } = parsed.data;

  const doctorRateLimited = await isDoctorRateLimited(doctorName);
  if (doctorRateLimited) {
    await logAttempt({ ip, doctorName, codeTried: code, result: "DOCTOR_RATE_LIMITED" });
    return res.status(429).json({ error: "RATE_LIMITED", message: "Too many attempts for this doctor. Please wait and try again later." });
  }

  try {
    const { attendance, sessions } = await performCheckin(doctorId, code);
    await logAttempt({ ip, doctorName, codeTried: code, result: "SUCCESS" });
    res.json({
      doctorName: attendance.doctorName,
      checkInTime: attendance.checkInTime,
      status: attendance.status,
      sessions: sessions.map((s) => ({
        type: s.type,
        title: s.title,
        location: s.location,
        start: toCairoTimeStr(s.start),
        end: toCairoTimeStr(s.end),
      })),
    });
  } catch (err) {
    if (err instanceof CheckinError) {
      await logAttempt({ ip, doctorName, codeTried: code, result: err.code });
      return res.status(400).json({ error: err.code, message: err.message });
    }
    throw err;
  }
});
