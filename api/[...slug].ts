// Vercel-only entry point. The filename's catch-all ([...slug]) makes Vercel
// route every /api/* request here, passing through the full original path —
// Express's own internal router (mounted in server/src/app.ts) then matches
// that path exactly the same way it would on any other host, so none of the
// actual route/middleware code needs to know it's running on Vercel at all.
//
// This intentionally imports app.ts, not index.ts — index.ts also starts the
// node-cron background jobs and calls app.listen(), neither of which make
// sense inside a serverless function (see server/src/routes/cron.ts for how
// the scheduled jobs run here instead).
export { app as default } from "../server/src/app.js";
