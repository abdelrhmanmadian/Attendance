import { prisma } from "../lib/prisma.js";
import { getSettings } from "../lib/settings.js";
import { todayCairoDateOnly, toCairoTimeStr } from "../lib/time.js";
import { computeAttendanceStatus, formatSessionsSummary } from "../lib/attendanceStatusCalc.js";

export type CheckinFailureCode =
  | "DOCTOR_NOT_FOUND"
  | "INVALID_CODE"
  | "OUTSIDE_WINDOW"
  | "WRONG_DOCTOR"
  | "ALREADY_CHECKED_IN";

export class CheckinError extends Error {
  code: CheckinFailureCode;
  constructor(code: CheckinFailureCode, message: string) {
    super(message);
    this.code = code;
  }
}

export async function performCheckin(doctorId: string, codeStr: string) {
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor || !doctor.active) {
    throw new CheckinError("DOCTOR_NOT_FOUND", "Doctor not found.");
  }

  const today = todayCairoDateOnly();

  // 1. A code exists for today and is not revoked.
  const code = await prisma.code.findFirst({ where: { code: codeStr, date: today } });
  if (!code || code.revoked) {
    throw new CheckinError("INVALID_CODE", "This code isn't valid for today. Please check the code and try again.");
  }

  // 2. Current time is inside the code's validity window.
  const now = new Date();
  if (now < code.validFrom || now > code.validUntil) {
    throw new CheckinError("OUTSIDE_WINDOW", "This code isn't active right now. Check-in is only allowed shortly before and after your scheduled sessions.");
  }

  // 3. The code belongs to THIS doctor.
  if (code.doctorId !== doctorId) {
    throw new CheckinError("WRONG_DOCTOR", "This code doesn't belong to the selected doctor.");
  }

  // 4. This doctor has not already checked in today.
  const existingAttendance = await prisma.attendance.findUnique({
    where: { doctorId_date: { doctorId, date: today } },
  });
  if (existingAttendance) {
    throw new CheckinError("ALREADY_CHECKED_IN", "You've already checked in today.");
  }

  const sessions = await prisma.session.findMany({ where: { doctorId, date: today }, orderBy: { start: "asc" } });
  const settings = await getSettings();
  const firstSession = sessions[0];
  const { status, minutesLate } = computeAttendanceStatus(firstSession.start, now, settings.gracePeriodMin);
  const sessionsScheduled = formatSessionsSummary(sessions, toCairoTimeStr);

  const attendance = await prisma.$transaction(async (tx) => {
    const created = await tx.attendance.create({
      data: {
        doctorId,
        doctorName: doctor.name,
        date: today,
        checkInTime: now,
        status,
        minutesLate,
        codeUsed: code.code,
        sessionsScheduled,
        syncedToSheet: false,
      },
    });
    await tx.session.updateMany({ where: { doctorId, date: today }, data: { locked: true } });
    return created;
  });

  return { attendance, doctor, sessions };
}
