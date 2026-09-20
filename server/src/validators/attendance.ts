import { z } from "zod";
import { ATTENDANCE_STATUSES } from "../lib/attendanceStatus.js";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const overrideAttendanceSchema = z
  .object({
    doctorId: z.string().min(1),
    date: dateStr,
    status: z.enum(ATTENDANCE_STATUSES),
    minutesLate: z.number().int().min(0).optional(),
    note: z.string().trim().min(1, "A note is required for every manual override"),
  })
  .refine((data) => data.status !== "LATE" || data.minutesLate !== undefined, {
    message: "minutesLate is required when marking a doctor Late",
    path: ["minutesLate"],
  });

export const resetAttendanceSchema = z.object({
  note: z.string().trim().min(1, "A note is required to reset an attendance record"),
});

export const listAttendanceQuerySchema = z.object({
  date: dateStr.optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
  doctorId: z.string().optional(),
});

export const reportQuerySchema = z.object({
  from: dateStr,
  to: dateStr,
  doctorId: z.string().optional(),
});
