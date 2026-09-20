import { z } from "zod";

export const updateSettingsSchema = z.object({
  codeLength: z.number().int().min(4).max(12).optional(),
  windowBeforeMin: z.number().int().min(0).max(240).optional(),
  windowAfterMin: z.number().int().min(0).max(240).optional(),
  gracePeriodMin: z.number().int().min(0).max(120).optional(),
});
