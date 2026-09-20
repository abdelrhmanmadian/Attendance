import { prisma } from "../lib/prisma.js";
import { toCairoTimeStr } from "../lib/time.js";
import { formatSessionsSummary } from "../lib/attendanceStatusCalc.js";
import { attemptSyncAttendance } from "./syncService.js";

/** Writes an Absent row for every doctor scheduled on this date who never checked in. */
export async function markAbsentDoctorsForDate(dateOnly: Date): Promise<{ marked: number }> {
  const scheduled = await prisma.session.findMany({
    where: { date: dateOnly },
    select: { doctorId: true },
    distinct: ["doctorId"],
  });

  let marked = 0;

  for (const { doctorId } of scheduled) {
    const existing = await prisma.attendance.findUnique({
      where: { doctorId_date: { doctorId, date: dateOnly } },
    });
    if (existing) continue; // already present, late, or previously marked absent

    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) continue;

    const sessions = await prisma.session.findMany({ where: { doctorId, date: dateOnly }, orderBy: { start: "asc" } });
    const sessionsScheduled = formatSessionsSummary(sessions, toCairoTimeStr);

    const created = await prisma.attendance.create({
      data: {
        doctorId,
        doctorName: doctor.name,
        date: dateOnly,
        checkInTime: null,
        status: "ABSENT",
        minutesLate: 0,
        codeUsed: null,
        sessionsScheduled,
        syncedToSheet: false,
      },
    });
    await prisma.session.updateMany({ where: { doctorId, date: dateOnly }, data: { locked: true } });
    attemptSyncAttendance(created.id).catch(() => {});
    marked++;
  }

  return { marked };
}
