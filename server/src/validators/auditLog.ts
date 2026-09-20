import { z } from "zod";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const listAuditLogQuerySchema = z.object({
  search: z.string().trim().optional(),
  action: z.string().trim().optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
});
