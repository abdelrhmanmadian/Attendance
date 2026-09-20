import { prisma } from "./prisma.js";

export async function recordAudit(params: {
  managerId: string;
  action: string;
  entity: string;
  oldValue?: unknown;
  newValue?: unknown;
  note: string;
}) {
  await prisma.auditLog.create({
    data: {
      managerId: params.managerId,
      action: params.action,
      entity: params.entity,
      oldValue: params.oldValue !== undefined ? JSON.stringify(params.oldValue) : null,
      newValue: params.newValue !== undefined ? JSON.stringify(params.newValue) : null,
      note: params.note,
    },
  });
}
