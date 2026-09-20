import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { addDays, setHours, setMinutes, startOfWeek } from "date-fns";

const prisma = new PrismaClient();

const DOCTOR_NAMES = [
  "Dr. Ramy Badawy",
  "Dr. Mohamed Gameel",
  "Dr. Hend Elsharkawy",
  "Dr. Moataz Hegazy",
  "Dr. Manal Mostafa",
  "Dr. Mohamed Abdelsalam",
  "Dr. Tarek Ghonemy",
  "Dr. Fatema Abdelrahman",
  "Dr. Sara Al-Saadani",
  "Dr. Mai Abdelrahman Farag",
];

async function seedManagers() {
  const managers = [
    { email: process.env.MANAGER1_EMAIL, password: process.env.MANAGER1_TEMP_PASSWORD },
    { email: process.env.MANAGER2_EMAIL, password: process.env.MANAGER2_TEMP_PASSWORD },
  ];

  for (const m of managers) {
    if (!m.email || !m.password) {
      console.warn("Skipping manager seed: MANAGER*_EMAIL / MANAGER*_TEMP_PASSWORD not set in .env");
      continue;
    }
    const passwordHash = await bcrypt.hash(m.password, 12);
    await prisma.manager.upsert({
      where: { email: m.email },
      update: {},
      create: { email: m.email, passwordHash, mustChangePassword: true },
    });
    console.log(`Seeded manager: ${m.email}`);
  }
}

async function seedDoctors() {
  const doctors = [];
  for (const name of DOCTOR_NAMES) {
    const existing = await prisma.doctor.findFirst({ where: { name } });
    const doctor =
      existing ?? (await prisma.doctor.create({ data: { name, department: "Architecture", active: true } }));
    doctors.push(doctor);
  }
  return doctors;
}

async function seedSchedule(doctors: { id: string; name: string }[]) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 6 }); // Saturday
  const sessionTypes = ["Lecture", "Tutorial"];

  for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
    const date = addDays(weekStart, dayOffset);
    const doctorsToday = doctors.slice(0, 6);

    for (let i = 0; i < doctorsToday.length; i++) {
      const doctor = doctorsToday[i];
      const startHour = 8 + (i % 4) * 2;
      const start = setMinutes(setHours(date, startHour), 30);
      const end = setMinutes(setHours(date, startHour + 1), 40);
      const type = sessionTypes[i % sessionTypes.length];

      await prisma.session.create({
        data: {
          date,
          type,
          title: `Course ${i + 100} - ${type}`,
          groupName: `1AR${(i % 3) + 1}`,
          start,
          end,
          location: `A ${200 + i}`,
          doctorId: doctor.id,
        },
      });
    }
  }
}

async function main() {
  await seedManagers();
  const doctors = await seedDoctors();
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  const existingSessions = await prisma.session.count();
  if (existingSessions === 0) {
    await seedSchedule(doctors);
  }
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
