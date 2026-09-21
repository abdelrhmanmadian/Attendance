import { addDays } from "date-fns";
import { prisma } from "../lib/prisma.js";
import { cairoDateOnly, toCairoDateStr } from "../lib/time.js";

export interface DailyAttendanceReportRow {
  date: string;
  attended: string[]; // doctor names who checked in (present or late)
  absent: string[]; // scheduled doctors with no present/late record that day
}

/** One row per calendar date in [from, to]; days with nobody scheduled are skipped. */
export async function buildDailyAttendanceReport(
  from: string,
  to: string,
  doctorId?: string
): Promise<DailyAttendanceReportRow[]> {
  const fromDate = cairoDateOnly(from);
  const toDate = cairoDateOnly(to);
  const rows: DailyAttendanceReportRow[] = [];

  for (let date = fromDate; date <= toDate; date = addDays(date, 1)) {
    const scheduled = await prisma.session.findMany({
      where: { date, ...(doctorId ? { doctorId } : {}) },
      select: { doctorId: true },
      distinct: ["doctorId"],
    });
    if (scheduled.length === 0) continue;
    const scheduledIds = scheduled.map((s) => s.doctorId);

    const doctors = await prisma.doctor.findMany({
      where: { id: { in: scheduledIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(doctors.map((d) => [d.id, d.name]));

    const attendances = await prisma.attendance.findMany({
      where: { date, doctorId: { in: scheduledIds }, status: { in: ["PRESENT", "LATE"] } },
      select: { doctorId: true },
    });
    const attendedIds = new Set(attendances.map((a) => a.doctorId));

    const attended = [...attendedIds].map((id) => nameById.get(id) ?? "Unknown").sort();
    const absent = scheduledIds
      .filter((id) => !attendedIds.has(id))
      .map((id) => nameById.get(id) ?? "Unknown")
      .sort();

    rows.push({ date: toCairoDateStr(date), attended, absent });
  }

  return rows;
}
