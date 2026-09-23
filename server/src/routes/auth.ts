import { Router } from "express";
import bcrypt from "bcrypt";
import { sign } from "cookie-signature";
import { prisma } from "../lib/prisma.js";
import { requireManager } from "../middleware/auth.js";
import { loginSchema, changePasswordSchema } from "../validators/auth.js";
import { env } from "../env.js";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../lib/sessionCookie.js";

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
  req.session.save((err) => {
    if (err) {
      console.error("Failed to save session on login:", err);
      return res.status(500).json({ error: "SESSION_ERROR", message: "Could not start session." });
    }
    // express-session's own automatic Set-Cookie (normally fired from a
    // patched res.end once the store write completes) never reaches the
    // client on Vercel's serverless runtime — confirmed via runtime logs
    // showing the store write succeeding but no Set-Cookie header on the
    // response, even with the explicit save() above. Signing and setting
    // the cookie ourselves, in the exact format express-session expects on
    // the way back in, sidesteps that broken hook entirely.
    res.cookie(SESSION_COOKIE_NAME, `s:${sign(req.sessionID, env.SESSION_SECRET)}`, sessionCookieOptions);
    res.json({
      id: manager.id,
      email: manager.email,
      mustChangePassword: manager.mustChangePassword,
    });
  });
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie(SESSION_COOKIE_NAME);
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
