import type { CookieOptions } from "express";
import { env } from "../env.js";

export const SESSION_COOKIE_NAME = "attendance.sid";

export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 12 * 60 * 60 * 1000, // 12 hours
  path: "/",
};
