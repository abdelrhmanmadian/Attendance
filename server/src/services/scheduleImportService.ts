import { prisma } from "../lib/prisma.js";
import { toUtcRange } from "./scheduleService.js";
import { todayCairoDateOnly } from "../lib/time.js";
import { recordAudit } from "../lib/auditLog.js";
import type { ImportRow } from "../validators/scheduleImport.js";

export async function commitScheduleImport(rows: ImportRow[], managerId: string) {
  const distinctNames = [...new Set(rows.map((r) => r.doctorName.trim()))];

  const doctorIdByName = new Map<string, string>();
  const createdDoctorNames: string[] = [];

  for (const name of distinctNames) {
    const existing = await prisma.doctor.findFirst({ where: { name } });
    if (existing) {
      doctorIdByName.set(name, existing.id);
    } else {
      const created = await prisma.doctor.create({ data: { name, active: true } });
      doctorIdByName.set(name, created.id);
      createdDoctorNames.push(name);
    }
  }

  const sessionsData = rows.map((row) => {
    const { dateOnly, start, end } = toUtcRange(row.date, row.startTime, row.endTime);
    return {
      date: dateOnly,
      type: row.type,
      title: row.title,
      groupName: row.groupName ?? null,
      start,
      end,
      location: row.location,
      doctorId: doctorIdByName.get(row.doctorName.trim())!,
    };
  });

  const today = todayCairoDateOnly();

  const result = await prisma.$transaction(async (tx) => {
    const deleted = await tx.session.deleteMany({
      where: { date: { gte: today }, locked: false },
    });
    const created = await tx.session.createMany({ data: sessionsData });
    return { deletedCount: deleted.count, createdCount: created.count };
  });

  await recordAudit({
    managerId,
    action: "IMPORT_SCHEDULE",
    entity: "Schedule",
    newValue: { createdSessions: result.createdCount, deletedSessions: result.deletedCount, newDoctors: createdDoctorNames },
    note: `Imported schedule: ${result.createdCount} session(s) created, ${result.deletedCount} future session(s) replaced, ${createdDoctorNames.length} new doctor(s) added`,
  });

  return {
    createdSessions: result.createdCount,
    replacedSessions: result.deletedCount,
    newDoctors: createdDoctorNames,
  };
}
