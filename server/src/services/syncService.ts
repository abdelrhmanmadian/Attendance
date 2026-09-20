import { prisma } from "../lib/prisma.js";
import { syncAttendanceRowToSheet } from "../lib/sheets.js";

export async function attemptSyncAttendance(attendanceId: string): Promise<boolean> {
  const attendance = await prisma.attendance.findUnique({ where: { id: attendanceId } });
  if (!attendance || attendance.syncedToSheet) return attendance?.syncedToSheet ?? false;

  const sessions = await prisma.session.findMany({
    where: { doctorId: attendance.doctorId, date: attendance.date },
  });

  try {
    const wrote = await syncAttendanceRowToSheet({
      date: attendance.date,
      doctorName: attendance.doctorName,
      status: attendance.status,
      checkInTime: attendance.checkInTime,
      minutesLate: attendance.minutesLate,
      codeUsed: attendance.codeUsed,
      sessions: sessions.map((s) => ({
        type: s.type,
        title: s.title,
        start: s.start,
        end: s.end,
        location: s.location,
      })),
    });
    if (!wrote) return false; // Sheets not configured: not attempted, not an error.
    await prisma.attendance.update({
      where: { id: attendanceId },
      data: { syncedToSheet: true, lastSyncError: null },
    });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.attendance.update({
      where: { id: attendanceId },
      data: { syncAttempts: { increment: 1 }, lastSyncError: message },
    });
    return false;
  }
}

export async function retryAllUnsyncedAttendance(): Promise<{ attempted: number; succeeded: number }> {
  const unsynced = await prisma.attendance.findMany({ where: { syncedToSheet: false }, select: { id: true } });
  let succeeded = 0;
  for (const { id } of unsynced) {
    if (await attemptSyncAttendance(id)) succeeded++;
  }
  return { attempted: unsynced.length, succeeded };
}
