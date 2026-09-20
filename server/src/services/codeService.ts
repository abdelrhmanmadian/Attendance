import { prisma } from "../lib/prisma.js";
import { getSettings } from "../lib/settings.js";
import { randomCode } from "../lib/codeGenerator.js";
import { recordAudit } from "../lib/auditLog.js";

export class NoSessionsScheduledError extends Error {
  constructor() {
    super("This doctor has no sessions scheduled on this date.");
    this.name = "NoSessionsScheduledError";
  }
}

export async function computeWindowForDoctorDate(
  doctorId: string,
  dateOnly: Date
): Promise<{ validFrom: Date; validUntil: Date } | null> {
  const sessions = await prisma.session.findMany({ where: { doctorId, date: dateOnly } });
  if (sessions.length === 0) return null;

  const settings = await getSettings();
  const earliestStart = new Date(Math.min(...sessions.map((s) => s.start.getTime())));
  const latestEnd = new Date(Math.max(...sessions.map((s) => s.end.getTime())));

  return {
    validFrom: new Date(earliestStart.getTime() - settings.windowBeforeMin * 60_000),
    validUntil: new Date(latestEnd.getTime() + settings.windowAfterMin * 60_000),
  };
}

/** Called after any schedule mutation so an already-generated code's window stays in sync. */
export async function recomputeWindowIfCodeExists(doctorId: string, dateOnly: Date) {
  const code = await prisma.code.findUnique({ where: { doctorId_date: { doctorId, date: dateOnly } } });
  if (!code || code.revoked) return;

  const window = await computeWindowForDoctorDate(doctorId, dateOnly);
  if (!window) return; // last session removed; leave the existing code for a manager to explicitly revoke

  await prisma.code.update({
    where: { id: code.id },
    data: { validFrom: window.validFrom, validUntil: window.validUntil },
  });
}

async function generateUniqueCodeForDate(dateOnly: Date, length: number): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = randomCode(length);
    const clash = await prisma.code.findFirst({ where: { date: dateOnly, code: candidate, revoked: false } });
    if (!clash) return candidate;
  }
  throw new Error("Could not generate a unique code after multiple attempts.");
}

/** Idempotent: returns the existing active code untouched, or creates/revives one. */
export async function ensureCodeForDoctorDate(doctorId: string, dateOnly: Date, managerId: string) {
  const existing = await prisma.code.findUnique({ where: { doctorId_date: { doctorId, date: dateOnly } } });
  if (existing && !existing.revoked) return existing;

  const window = await computeWindowForDoctorDate(doctorId, dateOnly);
  if (!window) throw new NoSessionsScheduledError();

  const settings = await getSettings();
  const codeStr = await generateUniqueCodeForDate(dateOnly, settings.codeLength);

  if (existing) {
    const updated = await prisma.code.update({
      where: { id: existing.id },
      data: { code: codeStr, validFrom: window.validFrom, validUntil: window.validUntil, revoked: false },
    });
    await recordAudit({
      managerId,
      action: "GENERATE_CODE",
      entity: `Code:${updated.id}`,
      oldValue: { revoked: existing.revoked },
      newValue: { revoked: false },
      note: `Generated a new code for a previously revoked doctor/date`,
    });
    return updated;
  }

  const created = await prisma.code.create({
    data: { doctorId, date: dateOnly, code: codeStr, validFrom: window.validFrom, validUntil: window.validUntil },
  });
  await recordAudit({
    managerId,
    action: "GENERATE_CODE",
    entity: `Code:${created.id}`,
    newValue: { doctorId, date: dateOnly },
    note: `Generated code for doctor`,
  });
  return created;
}

export async function regenerateCode(codeId: string, managerId: string) {
  const existing = await prisma.code.findUnique({ where: { id: codeId } });
  if (!existing) return null;

  const window = await computeWindowForDoctorDate(existing.doctorId, existing.date);
  if (!window) throw new NoSessionsScheduledError();

  const settings = await getSettings();
  const codeStr = await generateUniqueCodeForDate(existing.date, settings.codeLength);

  const updated = await prisma.code.update({
    where: { id: codeId },
    data: { code: codeStr, validFrom: window.validFrom, validUntil: window.validUntil, revoked: false },
  });

  await recordAudit({
    managerId,
    action: "REGENERATE_CODE",
    entity: `Code:${codeId}`,
    note: `Regenerated code (old string invalidated)`,
  });

  return updated;
}

export async function revokeCode(codeId: string, managerId: string) {
  const existing = await prisma.code.findUnique({ where: { id: codeId } });
  if (!existing) return null;

  const updated = await prisma.code.update({ where: { id: codeId }, data: { revoked: true } });

  await recordAudit({
    managerId,
    action: "REVOKE_CODE",
    entity: `Code:${codeId}`,
    note: `Revoked code`,
  });

  return updated;
}
