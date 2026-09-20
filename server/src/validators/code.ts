import { z } from "zod";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const dateQuerySchema = z.object({
  date: dateStr.optional(),
});

export const generateCodeSchema = z.object({
  doctorId: z.string().min(1),
  date: dateStr.optional(),
});

export const generateAllSchema = z.object({
  date: dateStr.optional(),
});
