import "express-async-errors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { env } from "./env.js";
import { authRouter } from "./routes/auth.js";
import { doctorsRouter } from "./routes/doctors.js";
import { sessionsRouter } from "./routes/sessions.js";
import { scheduleImportRouter } from "./routes/scheduleImport.js";
import { codesRouter } from "./routes/codes.js";
import { publicCheckinRouter } from "./routes/publicCheckin.js";
import { syncRouter } from "./routes/sync.js";
import { attendanceRouter } from "./routes/attendance.js";
import { reportsRouter } from "./routes/reports.js";
import { auditLogRouter } from "./routes/auditLog.js";
import { jobsRouter } from "./routes/jobs.js";
import { settingsRouter } from "./routes/settings.js";
import { cronRouter } from "./routes/cron.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "./lib/sessionCookie.js";

// Set by Vercel automatically at build and runtime — never set on Bonto,
// Render, or local dev. Used to skip the static-file serving below, since
// on Vercel the client build is served by their own static hosting/CDN
// instead (faster, and doesn't burn function-invocation time on assets).
const onVercel = process.env.VERCEL === "1";

export const app = express();

// Render (and most PaaS hosts) put the app behind a reverse proxy that
// terminates HTTPS; without this, Express sees plain HTTP and the
// `cookie.secure` check below would silently drop the session cookie.
// Vercel's runtime does this transparently and doesn't need it.
if (env.NODE_ENV === "production" && !onVercel) {
  app.set("trust proxy", 1);
}

app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(
  session({
    name: SESSION_COOKIE_NAME,
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    // The default in-memory store leaks memory and forgets every session on
    // restart — fine for local dev, not for a public deploy that can redeploy
    // or spin down at any time. Reuse the same Postgres database for it there.
    store:
      env.NODE_ENV === "production"
        ? new (connectPgSimple(session))({
            conString: env.DATABASE_URL,
            createTableIfMissing: true,
          })
        : undefined,
    cookie: sessionCookieOptions,
  })
);

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/doctors", doctorsRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/schedule-import", scheduleImportRouter);
app.use("/api/codes", codesRouter);
app.use("/api/public", publicCheckinRouter);
app.use("/api/sync", syncRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/audit-log", auditLogRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/cron", cronRouter);

// In production this one service also serves the built client (same origin,
// so no CORS/cookie cross-site headaches) — in dev the client runs on its
// own Vite server instead and proxies /api here. On Vercel, static hosting
// covers this instead (see the onVercel comment above).
if (env.NODE_ENV === "production" && !onVercel) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(here, "../../client/dist");
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use(errorHandler);
