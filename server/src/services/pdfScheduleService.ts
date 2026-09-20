import { addDays } from "date-fns";
import type { ImportRow } from "../validators/scheduleImport.js";
import type { PdfPatternRowInput } from "../validators/pdfImport.js";

const DOW_TO_DAY: Record<PdfPatternRowInput["dayOfWeek"], number> = {
  Su: 0,
  Mo: 1,
  Tu: 2,
  We: 3,
  Th: 4,
  Sa: 6,
};

// Calendar-date-only arithmetic (which weekday is this, add N days) never
// needs to go through a Cairo-timezone conversion — "2026-11-07" is a
// Saturday in every timezone. Keeping this as plain UTC-midnight of the
// literal Y-M-D avoids the off-by-one that comes from mixing it with
// cairoDateOnly()'s "UTC instant of Cairo midnight" (whose UTC calendar day
// is a day behind Cairo's for part of the day).
function parseCalendarDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function firstOccurrenceOnOrAfter(from: Date, targetDay: number): Date {
  const diff = (targetDay - from.getUTCDay() + 7) % 7;
  return addDays(from, diff);
}

export function expandPatternsToRows(
  patterns: PdfPatternRowInput[],
  semesterStart: string,
  semesterEnd: string
): ImportRow[] {
  const start = parseCalendarDate(semesterStart);
  const end = parseCalendarDate(semesterEnd);
  const rows: ImportRow[] = [];

  for (const pattern of patterns) {
    const targetDay = DOW_TO_DAY[pattern.dayOfWeek];
    let current = firstOccurrenceOnOrAfter(start, targetDay);
    while (current <= end) {
      rows.push({
        date: formatCalendarDate(current),
        type: pattern.type,
        title: pattern.title,
        groupName: pattern.groupName ?? undefined,
        startTime: pattern.startTime,
        endTime: pattern.endTime,
        location: pattern.location,
        doctorName: pattern.doctorName,
      });
      current = addDays(current, 7);
    }
  }

  return rows;
}
