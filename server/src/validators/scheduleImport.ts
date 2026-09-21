import { z } from "zod";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm");
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const importRowSchema = z
  .object({
    date: dateStr,
    type: z.string().trim().min(1),
    title: z.string().trim().min(1),
    groupName: z.string().trim().optional().nullable(),
    startTime: hhmm,
    endTime: hhmm,
    location: z.string().trim().min(1),
    doctorName: z.string().trim().min(1),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "Start time must be before end time",
    path: ["endTime"],
  });

export type ImportRow = z.infer<typeof importRowSchema>;

export const commitImportSchema = z.object({
  rows: z.array(importRowSchema).min(1, "At least one row is required"),
});

export const sheetImportRequestSchema = z.object({
  url: z.string().trim().min(1, "Paste a Google Sheet link or ID"),
  sheetName: z.string().trim().optional(),
});
