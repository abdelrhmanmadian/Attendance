import { z } from "zod";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm");
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const pdfPatternRowSchema = z
  .object({
    dayOfWeek: z.enum(["Sa", "Su", "Mo", "Tu", "We", "Th"]),
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

export type PdfPatternRowInput = z.infer<typeof pdfPatternRowSchema>;

export const commitPdfImportSchema = z
  .object({
    patterns: z.array(pdfPatternRowSchema).min(1, "At least one pattern row is required"),
    semesterStart: dateStr,
    semesterEnd: dateStr,
  })
  .refine((data) => data.semesterStart <= data.semesterEnd, {
    message: "Semester start must be on or before semester end",
    path: ["semesterEnd"],
  });
