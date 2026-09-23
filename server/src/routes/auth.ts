import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { requireManager } from "../middleware/auth.js";
import { loginSchema, changePasswordSchema } from "../validators/auth.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", message: "Email and password are required." });
  }
  const { email, password } = parsed.data;

  const manager = await prisma.manager.findUnique({ where: { email } });
  if (!manager) {
    return res.status(401).json({ error: "INVALID_CREDENTIALS", message: "Incorrect email or password." });
  }

  const ok = await bcrypt.compare(password, manager.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "INVALID_CREDENTIALS", message: "Incorrect email or password." });
  }

  req.session.managerId = manager.id;
  res.on("finish", () => {
    console.log("[diag] login response set-cookie:", res.getHeader("set-cookie"), "sessionID:", req.sessionID);
  });
  res.json({
    id: manager.id,
    email: manager.email,
    mustChangePassword: manager.mustChangePassword,
  });
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("attendance.sid");
    res.status(204).end();
  });
});

authRouter.get("/me", requireManager, async (req, res) => {
  const manager = await prisma.manager.findUnique({ where: { id: req.session.managerId! } });
  if (!manager) {
    return res.status(401).json({ error: "AUTH_REQUIRED" });
  }
  res.json({
    id: manager.id,
    email: manager.email,
    mustChangePassword: manager.mustChangePassword,
  });
});

authRouter.post("/change-password", requireManager, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message });
  }
  const { currentPassword, newPassword } = parsed.data;

  const manager = await prisma.manager.findUnique({ where: { id: req.session.managerId! } });
  if (!manager) {
    return res.status(401).json({ error: "AUTH_REQUIRED" });
  }

  const ok = await bcrypt.compare(currentPassword, manager.passwordHash);
  if (!ok) {
    return res.status(400).json({ error: "WRONG_PASSWORD", message: "Current password is incorrect." });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.manager.update({
    where: { id: manager.id },
    data: { passwordHash, mustChangePassword: false },
  });

  res.status(204).end();
});
