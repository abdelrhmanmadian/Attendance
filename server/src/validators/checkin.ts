import { z } from "zod";

export const checkinSchema = z.object({
  doctorId: z.string().min(1),
  doctorName: z.string().trim().min(1),
  code: z
    .string()
    .trim()
    .min(1)
    .transform((s) => s.toUpperCase()),
});
