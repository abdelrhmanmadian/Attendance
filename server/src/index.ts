import { app } from "./app.js";
import { env } from "./env.js";
import { startRetrySyncJob } from "./jobs/retrySync.js";
import { startMarkAbsentJob } from "./jobs/markAbsent.js";

// Only for hosts that run this as a persistent process (Bonto, Render, local
// dev) — Vercel never imports this file, it imports app.ts directly through
// api/[...slug].ts instead, since a serverless function can't run background
// cron jobs (see server/src/routes/cron.ts for how those run there instead).
startRetrySyncJob();
startMarkAbsentJob();

app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
});
