export const ATTENDANCE_STATUSES = ["PRESENT", "LATE", "ABSENT"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
