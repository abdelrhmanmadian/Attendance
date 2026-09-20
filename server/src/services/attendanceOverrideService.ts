import { prisma } from "../lib/prisma.js";
import { cairoDateOnly, toCairoTimeStr } from "../lib/time.js";
import { formatSessionsSummary } from "../lib/attendanceStatusCalc.js";
import { recordAudit } from "../lib/auditLog.js";
import type { AttendanceStatus } from "../lib/attendanceStatus.js";

export class DoctorNotFoundError extends Error {
  constructor() {
    super("Doctor not found.");
    this.name = "DoctorNotFoundError";
  }
}

export async function overrideAttendance(params: {
  doctorId: string;
  date: string;
  status: AttendanceStatus;
  minutesLate?: number;
  note: string;
  managerId: string;
}) {
  const doctor = await prisma.doctor.findUnique({ where: { id: params.doctorId } });
  if (!doctor) throw new DoctorNotFoundError();

  const dateOnly = cairoDateOnly(params.date);
  const sessions = await prisma.session.findMany({
    where: { doctorId: params.doctorId, date: dateOnly },
    orderBy: { start: "asc" },
  });
  const sessionsScheduled = formatSessionsSummary(sessions, toCairoTimeStr);

  const existing = await prisma.attendance.findUnique({
    where: { doctorId_date: { doctorId: params.doctorId, date: dateOnly } },
  });

  const minutesLate = params.status === "LATE" ? params.minutesLate ?? 0 : 0;

  const data = {
    doctorName: doctor.name,
    status: params.status,
    minutesLate,
    sessionsScheduled,
    syncedToSheet: false,
    lastSyncError: null,
  };

  const updated = existing
    ? await prisma.attendance.update({ where: { id: existing.id }, data })
    : await prisma.attendance.create({
        data: {
          doctorId: params.doctorId,
          date: dateOnly,
          checkInTime: null,
          codeUsed: null,
          ...data,
        },
      });

  if (sessions.length > 0) {
    await prisma.session.updateMany({ where: { doctorId: params.doctorId, date: dateOnly }, data: { locked: true } });
  }

  await recordAudit({
    managerId: params.managerId,
    action: "MANUAL_OVERRIDE",
    entity: `Attendance:${updated.id}`,
    oldValue: existing,
    newValue: updated,
    note: params.note,
  });

  return updated;
}

export async function resetAttendance(attendanceId: string, note: string, managerId: string) {
  const existing = await prisma.attendance.findUnique({ where: { id: attendanceId } });
  if (!existing) return null;

  await prisma.attendance.delete({ where: { id: attendanceId } });

  await recordAudit({
    managerId,
    action: "RESET_ATTENDANCE",
    entity: `Attendance:${attendanceId}`,
    oldValue: existing,
    note,
  });

  return existing;
}
