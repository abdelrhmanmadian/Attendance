import { prisma } from "../src/lib/prisma.js";

export async function clearDatabase() {
  await prisma.checkInAttempt.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.code.deleteMany();
  await prisma.session.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.manager.deleteMany();
  await prisma.settings.deleteMany();
}
