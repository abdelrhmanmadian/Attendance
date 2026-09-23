import type { Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    managerId?: string;
  }
}

export function requireManager(req: Request, res: Response, next: NextFunction) {
  console.log(
    "[diag] auth check — cookie header:",
    req.headers.cookie,
    "sessionID:",
    req.sessionID,
    "managerId:",
    req.session.managerId
  );
  if (!req.session.managerId) {
    return res.status(401).json({ error: "AUTH_REQUIRED", message: "Please log in." });
  }
  next();
}
