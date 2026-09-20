import { z } from "zod";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm");
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const createSessionSchema = z
  .object({
    date: dateStr,
    type: z.string().trim().min(1),
    title: z.string().trim().min(1),
    groupName: z.string().trim().optional().nullable(),
    startTime: hhmm,
    endTime: hhmm,
    location: z.string().trim().min(1),
    doctorId: z.string().min(1),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "startTime must be before endTime",
    path: ["endTime"],
  });

export const updateSessionSchema = z
  .object({
    date: dateStr.optional(),
    type: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).optional(),
    groupName: z.string().trim().optional().nullable(),
    startTime: hhmm.optional(),
    endTime: hhmm.optional(),
    location: z.string().trim().min(1).optional(),
    doctorId: z.string().min(1).optional(),
    overrideNote: z.string().trim().min(1).optional(),
  })
  .refine((data) => !data.startTime || !data.endTime || data.startTime < data.endTime, {
    message: "startTime must be before endTime",
    path: ["endTime"],
  });

export const deleteSessionSchema = z.object({
  overrideNote: z.string().trim().min(1).optional(),
});

export const duplicateScheduleSchema = z
  .object({
    mode: z.enum(["day", "week"]),
    fromDate: dateStr,
    toDate: dateStr,
  })
  .refine((data) => data.fromDate !== data.toDate, {
    message: "toDate must differ from fromDate",
    path: ["toDate"],
  });

export const listSessionsQuerySchema = z.object({
  date: dateStr.optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
  doctorId: z.string().optional(),
  type: z.string().optional(),
  groupName: z.string().optional(),
});
