import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireManager } from "../middleware/auth.js";
import { createDoctorSchema, updateDoctorSchema } from "../validators/doctor.js";
import { recordAudit } from "../lib/auditLog.js";

export const doctorsRouter = Router();
doctorsRouter.use(requireManager);

// List all doctors (manager view: includes inactive ones, for reactivation).
doctorsRouter.get("/", async (req, res) => {
  const includeInactive = req.query.includeInactive === "true";
  const doctors = await prisma.doctor.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { name: "asc" },
  });
  res.json(doctors);
});

doctorsRouter.post("/", async (req, res) => {
  const parsed = createDoctorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message });
  }
  const doctor = await prisma.doctor.create({
    data: { name: parsed.data.name, department: parsed.data.department ?? null },
  });
  await recordAudit({
    managerId: req.session.managerId!,
    action: "CREATE_DOCTOR",
    entity: `Doctor:${doctor.id}`,
    newValue: doctor,
    note: `Added doctor ${doctor.name}`,
  });
  res.status(201).json(doctor);
});

doctorsRouter.patch("/:id", async (req, res) => {
  const parsed = updateDoctorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message });
  }

  const existing = await prisma.doctor.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  const doctor = await prisma.doctor.update({
    where: { id: existing.id },
    data: parsed.data,
  });

  const action =
    parsed.data.active === false ? "DEACTIVATE_DOCTOR" : parsed.data.active === true ? "REACTIVATE_DOCTOR" : "UPDATE_DOCTOR";

  await recordAudit({
    managerId: req.session.managerId!,
    action,
    entity: `Doctor:${doctor.id}`,
    oldValue: existing,
    newValue: doctor,
    note: `Updated doctor ${doctor.name}`,
  });

  res.json(doctor);
});
