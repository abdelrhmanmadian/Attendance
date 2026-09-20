import { z } from "zod";

export const createDoctorSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  department: z.string().trim().optional().nullable(),
});

export const updateDoctorSchema = z.object({
  name: z.string().trim().min(1).optional(),
  department: z.string().trim().optional().nullable(),
  active: z.boolean().optional(),
});
