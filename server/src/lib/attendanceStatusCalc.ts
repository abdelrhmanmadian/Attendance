import type { AttendanceStatus } from "./attendanceStatus.js";

export function computeAttendanceStatus(
  firstSessionStart: Date,
  checkInTime: Date,
  gracePeriodMin: number
): { status: AttendanceStatus; minutesLate: number } {
  const graceDeadline = new Date(firstSessionStart.getTime() + gracePeriodMin * 60_000);
  if (checkInTime.getTime() <= graceDeadline.getTime()) {
    return { status: "PRESENT", minutesLate: 0 };
  }
  const minutesLate = Math.round((checkInTime.getTime() - firstSessionStart.getTime()) / 60_000);
  return { status: "LATE", minutesLate };
}

export function formatSessionsSummary(
  sessions: { type: string; start: Date; title: string }[],
  toCairoTimeStr: (d: Date) => string
): string {
  return sessions
    .slice()
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map((s) => `${s.type} ${toCairoTimeStr(s.start)} ${s.title}`)
    .join("; ");
}
