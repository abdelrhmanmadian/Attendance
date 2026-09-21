import { addDays } from "date-fns";
import { prisma } from "../lib/prisma.js";
import { cairoDateOnly, toCairoDateStr } from "../lib/time.js";

export interface DailyAttendanceReportRow {
  date: string;
  present: number;
  absent: number;
  totalScheduled: number;
  percentage: number;
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
    const scheduledDoctors = await prisma.session.findMany({
      where: { date, ...(doctorId ? { doctorId } : {}) },
      select: { doctorId: true },
      distinct: ["doctorId"],
    });
    const totalScheduled = scheduledDoctors.length;
    if (totalScheduled === 0) continue;

    const attendances = await prisma.attendance.findMany({
      where: { date, ...(doctorId ? { doctorId } : {}) },
    });
    // "Present" here means attended in any form (on time or late); the
    // report is meant to answer "who showed up" at a glance, not to
    // distinguish punctuality — that detail is still on the Today page.
    const present = attendances.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
    const absent = attendances.filter((a) => a.status === "ABSENT").length;
    const percentage = Math.round((present / totalScheduled) * 1000) / 10;

    rows.push({ date: toCairoDateStr(date), present, absent, totalScheduled, percentage });
  }

  return rows;
}
