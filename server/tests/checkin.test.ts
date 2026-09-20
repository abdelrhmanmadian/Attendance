import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { clearDatabase } from "./testDb.js";
import { performCheckin, CheckinError } from "../src/services/checkinService.js";
import { todayCairoDateOnly } from "../src/lib/time.js";

const today = todayCairoDateOnly();

async function seedDoctorWithSession(name: string) {
  const doctor = await prisma.doctor.create({ data: { name, active: true } });
  const now = new Date();
  await prisma.session.create({
    data: {
      date: today,
      type: "Lecture",
      title: "Test Session",
      start: new Date(now.getTime() - 5 * 60_000),
      end: new Date(now.getTime() + 55 * 60_000),
      location: "Room 1",
      doctorId: doctor.id,
    },
  });
  return doctor;
}

async function seedActiveCode(doctorId: string, code: string) {
  const now = new Date();
  return prisma.code.create({
    data: {
      code,
      doctorId,
      date: today,
      validFrom: new Date(now.getTime() - 15 * 60_000),
      validUntil: new Date(now.getTime() + 15 * 60_000),
      revoked: false,
    },
  });
}

describe("performCheckin", () => {
  beforeEach(async () => {
    await clearDatabase();
    await prisma.settings.create({ data: { id: 1, gracePeriodMin: 10 } });
  });

  it("fails with INVALID_CODE when no code exists for today matching the string", async () => {
    const doctor = await seedDoctorWithSession("Dr. A");
    await expect(performCheckin(doctor.id, "NOSUCHCODE")).rejects.toMatchObject({
      code: "INVALID_CODE",
    } satisfies Partial<CheckinError>);
  });

  it("fails with INVALID_CODE when the code exists but is revoked", async () => {
    const doctor = await seedDoctorWithSession("Dr. A");
    const code = await seedActiveCode(doctor.id, "REVOKED1");
    await prisma.code.update({ where: { id: code.id }, data: { revoked: true } });
    await expect(performCheckin(doctor.id, "REVOKED1")).rejects.toMatchObject({ code: "INVALID_CODE" });
  });

  it("fails with OUTSIDE_WINDOW when the current time is before validFrom", async () => {
    const doctor = await seedDoctorWithSession("Dr. A");
    const now = new Date();
    await prisma.code.create({
      data: {
        code: "TOOEARLY",
        doctorId: doctor.id,
        date: today,
        validFrom: new Date(now.getTime() + 60 * 60_000),
        validUntil: new Date(now.getTime() + 120 * 60_000),
        revoked: false,
      },
    });
    await expect(performCheckin(doctor.id, "TOOEARLY")).rejects.toMatchObject({ code: "OUTSIDE_WINDOW" });
  });

  it("fails with OUTSIDE_WINDOW when the current time is after validUntil", async () => {
    const doctor = await seedDoctorWithSession("Dr. A");
    const now = new Date();
    await prisma.code.create({
      data: {
        code: "TOOLATE1",
        doctorId: doctor.id,
        date: today,
        validFrom: new Date(now.getTime() - 120 * 60_000),
        validUntil: new Date(now.getTime() - 60 * 60_000),
        revoked: false,
      },
    });
    await expect(performCheckin(doctor.id, "TOOLATE1")).rejects.toMatchObject({ code: "OUTSIDE_WINDOW" });
  });

  it("fails with WRONG_DOCTOR when the code belongs to a different doctor", async () => {
    const doctorA = await seedDoctorWithSession("Dr. A");
    const doctorB = await seedDoctorWithSession("Dr. B");
    await seedActiveCode(doctorA.id, "BELONGSA1");
    await expect(performCheckin(doctorB.id, "BELONGSA1")).rejects.toMatchObject({ code: "WRONG_DOCTOR" });
  });

  it("fails with ALREADY_CHECKED_IN on a second check-in for the same doctor and day", async () => {
    const doctor = await seedDoctorWithSession("Dr. A");
    await seedActiveCode(doctor.id, "ONCEONLY1");
    await performCheckin(doctor.id, "ONCEONLY1");

    // Same still-valid code, same doctor, same day: the second attempt must
    // be rejected for already having checked in, not treated as a new visit.
    await expect(performCheckin(doctor.id, "ONCEONLY1")).rejects.toMatchObject({ code: "ALREADY_CHECKED_IN" });
  });

  it("succeeds and writes one Attendance row, locking that doctor's sessions for the day", async () => {
    const doctor = await seedDoctorWithSession("Dr. A");
    await seedActiveCode(doctor.id, "SUCCESS01");

    const { attendance, sessions } = await performCheckin(doctor.id, "SUCCESS01");

    expect(attendance.doctorId).toBe(doctor.id);
    expect(attendance.status).toBe("PRESENT");
    expect(attendance.codeUsed).toBe("SUCCESS01");
    expect(sessions).toHaveLength(1);

    const lockedSession = await prisma.session.findFirst({ where: { doctorId: doctor.id } });
    expect(lockedSession?.locked).toBe(true);
  });

  it("is case-insensitive to code casing handled upstream but exact-matches the stored string", async () => {
    const doctor = await seedDoctorWithSession("Dr. A");
    await seedActiveCode(doctor.id, "ABCDEF12");
    // performCheckin itself does exact matching; the uppercasing happens in the validator layer.
    await expect(performCheckin(doctor.id, "abcdef12")).rejects.toMatchObject({ code: "INVALID_CODE" });
  });
});
