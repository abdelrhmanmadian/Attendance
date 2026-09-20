import { prisma } from "../lib/prisma.js";
import { cairoDateOnly } from "../lib/time.js";

export interface AttendanceReportRow {
  doctorId: string;
  doctorName: string;
  totalScheduledDays: number;
  present: number;
  late: number;
  absent: number;
  percentage: number;
}

export async function buildAttendanceReport(from: string, to: string, doctorId?: string): Promise<AttendanceReportRow[]> {
  const fromDate = cairoDateOnly(from);
  const toDate = cairoDateOnly(to);

  const doctors = await prisma.doctor.findMany({
    where: doctorId ? { id: doctorId } : {},
    orderBy: { name: "asc" },
  });

  const rows: AttendanceReportRow[] = [];

  for (const doctor of doctors) {
    const scheduledDates = await prisma.session.findMany({
      where: { doctorId: doctor.id, date: { gte: fromDate, lte: toDate } },
      select: { date: true },
      distinct: ["date"],
    });
    const totalScheduledDays = scheduledDates.length;
    if (totalScheduledDays === 0) continue;

    const attendances = await prisma.attendance.findMany({
      where: { doctorId: doctor.id, date: { gte: fromDate, lte: toDate } },
    });
    const present = attendances.filter((a) => a.status === "PRESENT").length;
    const late = attendances.filter((a) => a.status === "LATE").length;
    const absent = attendances.filter((a) => a.status === "ABSENT").length;
    const attendedDays = present + late;
    const percentage = Math.round((attendedDays / totalScheduledDays) * 1000) / 10;

    rows.push({ doctorId: doctor.id, doctorName: doctor.name, totalScheduledDays, present, late, absent, percentage });
  }

  return rows;
}
