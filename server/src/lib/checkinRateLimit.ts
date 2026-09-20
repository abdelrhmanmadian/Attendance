import { prisma } from "./prisma.js";

const IP_RATE_LIMIT = 5; // attempts per minute
const IP_RATE_WINDOW_MS = 60_000;

const DOCTOR_RATE_LIMIT = 10; // attempts per hour
const DOCTOR_RATE_WINDOW_MS = 60 * 60_000;

const LOCKOUT_THRESHOLD = 10; // consecutive failures
const LOCKOUT_DURATION_MS = 15 * 60_000;

export async function isIpLockedOut(ip: string): Promise<boolean> {
  const recent = await prisma.checkInAttempt.findMany({
    where: { ip },
    orderBy: { createdAt: "desc" },
    take: LOCKOUT_THRESHOLD,
  });
  if (recent.length < LOCKOUT_THRESHOLD) return false;
  const allFailures = recent.every((a) => a.result !== "SUCCESS");
  if (!allFailures) return false;
  const mostRecentFailureAt = recent[0].createdAt.getTime();
  return Date.now() - mostRecentFailureAt < LOCKOUT_DURATION_MS;
}

export async function isIpRateLimited(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - IP_RATE_WINDOW_MS);
  const count = await prisma.checkInAttempt.count({ where: { ip, createdAt: { gte: since } } });
  return count >= IP_RATE_LIMIT;
}

export async function isDoctorRateLimited(doctorName: string): Promise<boolean> {
  const since = new Date(Date.now() - DOCTOR_RATE_WINDOW_MS);
  const count = await prisma.checkInAttempt.count({ where: { doctorName, createdAt: { gte: since } } });
  return count >= DOCTOR_RATE_LIMIT;
}

export async function logAttempt(params: {
  ip: string;
  doctorName?: string | null;
  codeTried?: string | null;
  result: string;
}) {
  await prisma.checkInAttempt.create({
    data: {
      ip: params.ip,
      doctorName: params.doctorName ?? null,
      codeTried: params.codeTried ?? null,
      result: params.result,
    },
  });
}
