import { addDays, differenceInCalendarDays } from "date-fns";
import { prisma } from "../lib/prisma.js";
import { cairoDateOnly, cairoWallTimeToUtc, toCairoDateStr, toCairoTimeStr } from "../lib/time.js";
import { recordAudit } from "../lib/auditLog.js";

export class LockedSessionError extends Error {
  constructor() {
    super("This session already has attendance recorded and is locked. Provide overrideNote to edit it.");
    this.name = "LockedSessionError";
  }
}

export function toUtcRange(date: string, startTime: string, endTime: string) {
  return {
    dateOnly: cairoDateOnly(date),
    start: cairoWallTimeToUtc(date, startTime),
    end: cairoWallTimeToUtc(date, endTime),
  };
}

export async function createSession(input: {
  date: string;
  type: string;
  title: string;
  groupName?: string | null;
  startTime: string;
  endTime: string;
  location: string;
  doctorId: string;
}) {
  const { dateOnly, start, end } = toUtcRange(input.date, input.startTime, input.endTime);
  return prisma.session.create({
    data: {
      date: dateOnly,
      type: input.type,
      title: input.title,
      groupName: input.groupName ?? null,
      start,
      end,
      location: input.location,
      doctorId: input.doctorId,
    },
  });
}

export async function updateSession(
  id: string,
  input: {
    date?: string;
    type?: string;
    title?: string;
    groupName?: string | null;
    startTime?: string;
    endTime?: string;
    location?: string;
    doctorId?: string;
    overrideNote?: string;
  },
  managerId: string
) {
  const existing = await prisma.session.findUnique({ where: { id } });
  if (!existing) return null;

  if (existing.locked && !input.overrideNote) {
    throw new LockedSessionError();
  }

  const date = input.date ?? toCairoDateStr(existing.date);
  const startTime = input.startTime ?? toCairoTimeStr(existing.start);
  const endTime = input.endTime ?? toCairoTimeStr(existing.end);
  const needsRecompute = input.date || input.startTime || input.endTime;
  const { dateOnly, start, end } = needsRecompute
    ? toUtcRange(date, startTime, endTime)
    : { dateOnly: existing.date, start: existing.start, end: existing.end };

  const updated = await prisma.session.update({
    where: { id },
    data: {
      date: dateOnly,
      start,
      end,
      type: input.type ?? existing.type,
      title: input.title ?? existing.title,
      groupName: input.groupName !== undefined ? input.groupName : existing.groupName,
      location: input.location ?? existing.location,
      doctorId: input.doctorId ?? existing.doctorId,
    },
  });

  if (existing.locked && input.overrideNote) {
    await recordAudit({
      managerId,
      action: "EDIT_LOCKED_SESSION",
      entity: `Session:${id}`,
      oldValue: existing,
      newValue: updated,
      note: input.overrideNote,
    });
  }

  return updated;
}

export async function deleteSession(id: string, overrideNote: string | undefined, managerId: string) {
  const existing = await prisma.session.findUnique({ where: { id } });
  if (!existing) return null;

  if (existing.locked && !overrideNote) {
    throw new LockedSessionError();
  }

  await prisma.session.delete({ where: { id } });

  if (existing.locked && overrideNote) {
    await recordAudit({
      managerId,
      action: "DELETE_LOCKED_SESSION",
      entity: `Session:${id}`,
      oldValue: existing,
      note: overrideNote,
    });
  }

  return existing;
}

async function shiftSessions(fromDate: string, toDate: string, dayCount: number, managerId: string) {
  const fromDateOnly = cairoDateOnly(fromDate);
  const dayOffset = differenceInCalendarDays(cairoDateOnly(toDate), fromDateOnly);
  const created = [];

  for (let i = 0; i < dayCount; i++) {
    const sourceDate = addDays(fromDateOnly, i);
    const sessions = await prisma.session.findMany({ where: { date: sourceDate } });

    for (const s of sessions) {
      const newStart = addDays(s.start, dayOffset);
      const newEnd = addDays(s.end, dayOffset);
      const newDate = addDays(s.date, dayOffset);
      const copy = await prisma.session.create({
        data: {
          date: newDate,
          type: s.type,
          title: s.title,
          groupName: s.groupName,
          start: newStart,
          end: newEnd,
          location: s.location,
          doctorId: s.doctorId,
        },
      });
      created.push(copy);
    }
  }

  await recordAudit({
    managerId,
    action: "DUPLICATE_SCHEDULE",
    entity: `Schedule:${fromDate}->${toDate}`,
    newValue: { count: created.length },
    note: `Duplicated ${dayCount} day(s) starting ${fromDate} to starting ${toDate}`,
  });

  return created;
}

export async function duplicateDay(fromDate: string, toDate: string, managerId: string) {
  return shiftSessions(fromDate, toDate, 1, managerId);
}

export async function duplicateWeek(fromDate: string, toDate: string, managerId: string) {
  return shiftSessions(fromDate, toDate, 7, managerId);
}
