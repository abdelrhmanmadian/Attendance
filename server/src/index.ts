import "express-async-errors";
import express from "express";
import cors from "cors";
import session from "express-session";
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
import { errorHandler } from "./middleware/errorHandler.js";
import { startRetrySyncJob } from "./jobs/retrySync.js";
import { startMarkAbsentJob } from "./jobs/markAbsent.js";

const app = express();

app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(
  session({
    name: "attendance.sid",
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 12 * 60 * 60 * 1000, // 12 hours
    },
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

app.use(errorHandler);

startRetrySyncJob();
startMarkAbsentJob();

app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
});
