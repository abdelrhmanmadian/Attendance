import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { clearDatabase } from "./testDb.js";
import { createSession, updateSession, deleteSession } from "../src/services/scheduleService.js";
import { ensureCodeForDoctorDate } from "../src/services/codeService.js";
import { cairoDateOnly, cairoWallTimeToUtc, toCairoDateStr } from "../src/lib/time.js";

const todayStr = toCairoDateStr(new Date());
const today = cairoDateOnly(todayStr);

describe("code window recomputation after schedule edits", () => {
  let doctorId: string;
  let managerId: string;

  beforeEach(async () => {
    await clearDatabase();
    await prisma.settings.create({ data: { id: 1, windowBeforeMin: 15, windowAfterMin: 15, gracePeriodMin: 10 } });
    const doctor = await prisma.doctor.create({ data: { name: "Dr. Window Test", active: true } });
    doctorId = doctor.id;
    const manager = await prisma.manager.create({
      data: { email: "windowtest@example.com", passwordHash: "x", mustChangePassword: false },
    });
    managerId = manager.id;
  });

  it("extends validUntil when a later session is added, keeping the code string unchanged", async () => {
    await createSession({
      date: todayStr,
      type: "Lecture",
      title: "Morning Session",
      startTime: "09:00",
      endTime: "10:00",
      location: "Room 1",
      doctorId,
    });

    const code = await ensureCodeForDoctorDate(doctorId, today, managerId);
    expect(code.validFrom).toEqual(cairoWallTimeToUtc(todayStr, "08:45"));
    expect(code.validUntil).toEqual(cairoWallTimeToUtc(todayStr, "10:15"));

    await createSession({
      date: todayStr,
      type: "Tutorial",
      title: "Afternoon Session",
      startTime: "14:00",
      endTime: "15:00",
      location: "Room 2",
      doctorId,
    });

    const refreshed = await prisma.code.findUnique({ where: { id: code.id } });
    expect(refreshed?.code).toBe(code.code); // string unchanged
    expect(refreshed?.validFrom).toEqual(cairoWallTimeToUtc(todayStr, "08:45")); // start unchanged
    expect(refreshed?.validUntil).toEqual(cairoWallTimeToUtc(todayStr, "15:15")); // end extended
  });

  it("shrinks the window when a session's time is edited earlier", async () => {
    const session = await createSession({
      date: todayStr,
      type: "Lecture",
      title: "Session",
      startTime: "09:00",
      endTime: "12:00",
      location: "Room 1",
      doctorId,
    });

    const code = await ensureCodeForDoctorDate(doctorId, today, managerId);
    expect(code.validUntil).toEqual(cairoWallTimeToUtc(todayStr, "12:15"));

    await updateSession(session.id, { endTime: "10:00" }, managerId);

    const refreshed = await prisma.code.findUnique({ where: { id: code.id } });
    expect(refreshed?.code).toBe(code.code);
    expect(refreshed?.validUntil).toEqual(cairoWallTimeToUtc(todayStr, "10:15"));
  });

  it("recomputes based on remaining sessions when one of several is deleted", async () => {
    await createSession({
      date: todayStr,
      type: "Lecture",
      title: "Early",
      startTime: "08:00",
      endTime: "09:00",
      location: "R1",
      doctorId,
    });
    const laterSession = await createSession({
      date: todayStr,
      type: "Tutorial",
      title: "Later",
      startTime: "16:00",
      endTime: "17:00",
      location: "R2",
      doctorId,
    });

    const code = await ensureCodeForDoctorDate(doctorId, today, managerId);
    expect(code.validUntil).toEqual(cairoWallTimeToUtc(todayStr, "17:15"));

    await deleteSession(laterSession.id, undefined, managerId);

    const refreshed = await prisma.code.findUnique({ where: { id: code.id } });
    expect(refreshed?.code).toBe(code.code);
    expect(refreshed?.validUntil).toEqual(cairoWallTimeToUtc(todayStr, "09:15"));
  });

  it("leaves a revoked code untouched even if the schedule changes", async () => {
    await createSession({
      date: todayStr,
      type: "Lecture",
      title: "Session",
      startTime: "09:00",
      endTime: "10:00",
      location: "R1",
      doctorId,
    });
    const code = await ensureCodeForDoctorDate(doctorId, today, managerId);
    await prisma.code.update({ where: { id: code.id }, data: { revoked: true } });

    await createSession({
      date: todayStr,
      type: "Tutorial",
      title: "New Session",
      startTime: "14:00",
      endTime: "15:00",
      location: "R2",
      doctorId,
    });

    const refreshed = await prisma.code.findUnique({ where: { id: code.id } });
    expect(refreshed?.revoked).toBe(true);
    expect(refreshed?.validUntil).toEqual(cairoWallTimeToUtc(todayStr, "10:15")); // unchanged
  });
});
