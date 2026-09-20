import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireManager } from "../middleware/auth.js";
import { cairoDateOnly } from "../lib/time.js";
import { listAuditLogQuerySchema } from "../validators/auditLog.js";

export const auditLogRouter = Router();
auditLogRouter.use(requireManager);

auditLogRouter.get("/", async (req, res) => {
  const parsed = listAuditLogQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message });
  }
  const { search, action, from, to, limit } = parsed.data;

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: cairoDateOnly(from) } : {}),
      ...(to ? { lte: cairoDateOnly(to) } : {}),
    };
  }
  if (search) {
    where.OR = [
      { note: { contains: search } },
      { entity: { contains: search } },
      { action: { contains: search } },
    ];
  }

  const entries = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const managerIds = [...new Set(entries.map((e) => e.managerId))];
  const managers = await prisma.manager.findMany({ where: { id: { in: managerIds } }, select: { id: true, email: true } });
  const emailById = new Map(managers.map((m) => [m.id, m.email]));

  res.json(
    entries.map((e) => ({
      ...e,
      managerEmail: emailById.get(e.managerId) ?? "unknown",
    }))
  );
});
