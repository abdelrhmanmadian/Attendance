import { describe, it, expect } from "vitest";
import { computeAttendanceStatus } from "../src/lib/attendanceStatusCalc.js";

describe("computeAttendanceStatus", () => {
  const sessionStart = new Date("2026-09-20T06:00:00.000Z"); // 08:00 Cairo
  const gracePeriodMin = 10;

  it("marks Present when checking in exactly at session start", () => {
    const result = computeAttendanceStatus(sessionStart, sessionStart, gracePeriodMin);
    expect(result.status).toBe("PRESENT");
    expect(result.minutesLate).toBe(0);
  });

  it("marks Present when checking in within the grace period", () => {
    const checkIn = new Date(sessionStart.getTime() + 5 * 60_000);
    const result = computeAttendanceStatus(sessionStart, checkIn, gracePeriodMin);
    expect(result.status).toBe("PRESENT");
    expect(result.minutesLate).toBe(0);
  });

  it("marks Present at exactly the grace deadline (inclusive boundary)", () => {
    const checkIn = new Date(sessionStart.getTime() + gracePeriodMin * 60_000);
    const result = computeAttendanceStatus(sessionStart, checkIn, gracePeriodMin);
    expect(result.status).toBe("PRESENT");
    expect(result.minutesLate).toBe(0);
  });

  it("marks Late one second past the grace deadline", () => {
    const checkIn = new Date(sessionStart.getTime() + gracePeriodMin * 60_000 + 1000);
    const result = computeAttendanceStatus(sessionStart, checkIn, gracePeriodMin);
    expect(result.status).toBe("LATE");
    expect(result.minutesLate).toBe(gracePeriodMin);
  });

  it("computes minutesLate from the session start, not the grace deadline", () => {
    const checkIn = new Date(sessionStart.getTime() + 45 * 60_000);
    const result = computeAttendanceStatus(sessionStart, checkIn, gracePeriodMin);
    expect(result.status).toBe("LATE");
    expect(result.minutesLate).toBe(45);
  });

  it("marks Present when the check-in is before the session start (early arrival)", () => {
    const checkIn = new Date(sessionStart.getTime() - 10 * 60_000);
    const result = computeAttendanceStatus(sessionStart, checkIn, gracePeriodMin);
    expect(result.status).toBe("PRESENT");
    expect(result.minutesLate).toBe(0);
  });
});
