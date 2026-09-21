# Doctor Attendance System

Two managers maintain a schedule of lectures and tutorials. Each day the system
generates one check-in code per doctor who teaches that day. Doctors have no
accounts — they open a public page, pick their name, enter the code, and their
attendance is recorded and pushed to a Google Sheet.

## Stack

- **Server**: Node.js + Express + TypeScript, PostgreSQL via Prisma
- **Client**: React + Vite + Tailwind (mobile-first)
- **Sheets sync**: googleapis (Sheets API v4) with a service account
- **Jobs**: node-cron (Sheets retry every 5 min, end-of-day absent job at 23:59 Cairo time)
- **Timezone**: all timestamps stored in UTC, computed and displayed in `Africa/Cairo` time throughout

## Setup

You need a PostgreSQL database for local development. The easiest way is the provided
docker-compose file (requires [Docker](https://docs.docker.com/get-docker/)):

```bash
docker compose up -d
```

This starts Postgres on `localhost:5432` and creates both the dev database (`attendance`) and
the test database (`attendance_test`) the first time it runs. If you'd rather use an existing
Postgres install, just point `DATABASE_URL` (below) at it instead — nothing else needs Docker.

```bash
npm install
cp .env.example .env
```

Edit `.env` (see [Environment variables](#environment-variables) below), then also copy it into
`server/.env` — the server process reads its env file relative to its own working directory:

```bash
cp .env server/.env
```

Run the database migration and seed script:

```bash
npm run prisma:migrate
npm run prisma:seed
```

Start both the server (port 4000) and client (port 5173) together:

```bash
npm run dev
```

Open `http://localhost:5173` for the public check-in page, or `http://localhost:5173/login`
for the manager dashboard.

### Seeded logins

The seed script creates two manager accounts from `.env`:

| Field | Value |
|---|---|
| Email | `MANAGER1_EMAIL` / `MANAGER2_EMAIL` in `.env` (defaults: `manager1@example.com`, `manager2@example.com`) |
| Password | `MANAGER1_TEMP_PASSWORD` / `MANAGER2_TEMP_PASSWORD` in `.env` (default: `ChangeMe123!`) |

Both accounts are forced to set a new password on first login. It also seeds 10 doctors and
one week of sample lectures/tutorials so there's data to explore immediately.

### Running tests

```bash
npm test
```

Tests run against a separate `attendance_test` Postgres database (created automatically by
`docker compose up -d`, or create it yourself with `createdb attendance_test` if not using
Docker), reset fresh on every run — they never touch your dev database. Covers the 4 check-in
validation failure cases in order, the Present/Late boundary calculation, and validity-window
recomputation after schedule edits (add a session, edit a session's time, delete a session, and
confirm a revoked code is left alone).

## Environment variables

See `.env.example` for the full list with inline comments. The important ones:

- `SESSION_SECRET` — long random string signing the manager session cookie. Generate one with
  `openssl rand -hex 32`.
- `DATABASE_URL` — PostgreSQL connection string, e.g.
  `postgresql://attendance:attendance@localhost:5432/attendance` (matches `docker-compose.yml`).
- `CLIENT_ORIGIN` — the public URL doctors' check-in QR codes should point to. Only matters in
  production (see [Deploying to Render](#deploying-to-render)); the default is fine for local dev.
- `MANAGER1_EMAIL` / `MANAGER1_TEMP_PASSWORD` / `MANAGER2_EMAIL` / `MANAGER2_TEMP_PASSWORD` —
  only used by the seed script.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` / `GOOGLE_SHEET_ID` —
  leave these blank to run without Sheets sync (see below).

## Google Sheets setup

Sheets sync is entirely optional for local development — leave the `GOOGLE_*` variables blank
and the app runs normally, just marking every attendance row `syncedToSheet: false` forever
(harmlessly; nothing crashes, no errors are shown to doctors or managers, and the background
retry job just no-ops on every tick). To turn it on:

1. **Create a Google Cloud project** at [console.cloud.google.com](https://console.cloud.google.com)
   (or reuse an existing one).
2. **Enable the Google Sheets API**: APIs & Services → Library → search "Google Sheets API" → Enable.
3. **Create a service account**: APIs & Services → Credentials → Create Credentials → Service
   Account. Give it any name (e.g. "attendance-sync"). No project-level role is needed.
4. **Create a key for the service account**: open the service account → Keys → Add Key → Create
   new key → JSON. This downloads a JSON file containing `client_email` and `private_key`.
5. **Create (or pick) a Google Sheet** to sync into, and copy its ID from the URL:
   `https://docs.google.com/spreadsheets/d/<THIS-PART-IS-THE-ID>/edit`.
6. **Share the sheet** with the service account's email (the `client_email` field from the JSON
   key), giving it **Editor** access — otherwise it can't create tabs or write rows.
7. **Fill in `.env`** (and `server/.env`):
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` = the `client_email` value
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` = the `private_key` value, kept as one line with
     literal `\n` sequences (the way it appears in the downloaded JSON) — the app un-escapes
     them at runtime
   - `GOOGLE_SHEET_ID` = the sheet ID from step 5

Once configured, restart the server. The app creates one tab per month (named `YYYY-MM`)
automatically the first time it needs to write to it, with a header row and a warning-only
protected range over columns A–L (so accidental edits show a warning but aren't hard-blocked).
Columns M onward are never touched — that space is free for managers' own notes.

Sync is one-way (app → Sheet) and DB-first: the database write always happens, and a doctor's
check-in confirmation never waits on or fails because of the Sheets push. If a push fails, the
row stays marked unsynced and a background job retries every 5 minutes; the manager dashboard
also shows a warning banner with a "Retry sync now" button whenever there's a backlog.

## Deploying to Render

The app is set up to run as a single [Render](https://render.com) web service that serves both
the API and the built React frontend from one URL, backed by Render's free managed PostgreSQL —
no separate frontend host or persistent-disk plan needed.

1. **Push this repo to GitHub** (if it isn't already).
2. **In the Render dashboard**, click **New → Blueprint**, connect the repo, and Render will
   read `render.yaml` at the repo root automatically. It provisions:
   - a free PostgreSQL database (`attendance-db`)
   - a free web service (`doctor-attendance`) that builds the client + server, runs
     `prisma migrate deploy` against that database, and starts the server
3. **Fill in the environment variables** Render prompts for (marked `sync: false` in
   `render.yaml`, so it asks rather than guessing):
   - `MANAGER1_EMAIL` / `MANAGER1_TEMP_PASSWORD` / `MANAGER2_EMAIL` / `MANAGER2_TEMP_PASSWORD` —
     the two manager accounts you'll actually log in with.
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` / `GOOGLE_SHEET_ID` —
     leave blank to skip Sheets sync (see above).
   - Leave `CLIENT_ORIGIN` blank for now — Render doesn't know the service's URL until after
     the first deploy.
4. **Deploy.** Render gives you a URL like `https://doctor-attendance.onrender.com` — that's
   your public site. Open `/` for the check-in page or `/login` for the manager dashboard.
5. **Set `CLIENT_ORIGIN`** to that exact URL in the service's Environment tab and save (Render
   restarts the service automatically). This is what makes the QR codes on the Today page point
   doctors' phones at the right place instead of `localhost`.
6. **Seed the manager accounts and sample data** once, from your own machine, by pointing at the
   live database — copy the `DATABASE_URL` Render generated (Environment tab → `attendance-db` →
   Connect → External Connection String) into `server/.env` temporarily, then run
   `npm run prisma:seed`. Put your real `MANAGER1_TEMP_PASSWORD` / `MANAGER2_TEMP_PASSWORD` in
   there too — those are the passwords you'll actually log in with. Restore `server/.env` back
   to your local database URL afterwards.

A few things worth knowing about the free tier: the web service spins down after 15 minutes of
no traffic and takes ~30-60 seconds to wake back up on the next request (fine for occasional
use by two managers and doctors checking in a few times a day; not fine if you need instant
responses around the clock — upgrade to a paid instance to remove the spin-down). The free
Postgres database is retained but Render deletes free databases that go unused for 90 days, so
don't leave it completely idle for months at a time.

If you'd rather use a different host (Railway, Fly.io, a VPS, etc.), the same pieces apply
anywhere: a Postgres database, `NODE_ENV=production`, `npm run build` then `npm start`, and
`CLIENT_ORIGIN` set to wherever the app is actually reachable.

## Schedule import

There are two ways to build the schedule:

1. **Excel import** — Schedule page → "Change Schedule (Excel)" → download the template,
   fill it in, upload it. Every row is validated before anything is saved (see format below);
   if any row is invalid, the whole file is rejected with per-row error messages, and nothing
   is imported. On confirm, it **replaces every not-yet-happened session** — sessions already
   in the past, or that already have attendance recorded (locked), are never touched. Doctor
   names not already in the system are created automatically.
2. **PDF import** — Schedule page → "Import from PDF". Built specifically for weekly timetable
   PDFs like the ones generated by aSc Timetables (one page per class group, a Sat–Thu ×
   6-time-slot grid). It reads the PDF's actual text positions to reconstruct the grid,
   splits co-taught cells ("Dr. X / Eng. Y") into one row per instructor, and detects sessions
   that visually span multiple time-slot columns. Because this kind of text-position parsing
   can't be pixel-perfect, results always go through an **editable preview** — every field is
   editable inline and rows can be removed — before you pick a semester date range and confirm.
   Each weekly row then repeats on its weekday for every week in that range, feeding into the
   same replace-future-schedule commit as the Excel path.

The Schedule page itself is view/edit-existing only (click "Edit" on a row to correct it, with
a required note if it's already locked) — there's no manual "add a session from scratch" form,
since day-to-day schedule changes come from re-importing an updated Excel/PDF file. When the
same class is shared by multiple student groups, the source timetable encodes it as one row per
group; the Schedule page merges those into a single display row (e.g. "1AR1, 1AR2") and edits
or deletes them together, since they represent one real-world class.

### Excel template format

Columns, in order: **Date** (`YYYY-MM-DD`) · **Type** (free text — "Lecture", "Tutorial", "Lab",
anything your curriculum uses) · **Title** · **Group** (optional, e.g. "1AR1") · **Start Time**
(`HH:mm`) · **End Time** (`HH:mm`) · **Location** · **Doctor Name**.

Use the "Download template" button on the import screen to get a pre-filled example in exactly
this format.

## End-of-day absent job

At 23:59 Cairo time every day, a background job writes an `ABSENT` row for every doctor who had
at least one session scheduled that day and never checked in. It skips anyone who already has an
attendance record for the day (present, late, or already marked absent), so it's safe to run more
than once. Managers can also trigger it manually (e.g. to backfill a day it was missed for) from
the Settings/Today area via `POST /api/jobs/mark-absent`.

## Manager dashboard

- **Today** — every doctor scheduled today, their sessions, their code (generate / regenerate /
  revoke / display large-and-projector-friendly with a QR code), and their current attendance
  status with an Override action.
- **Schedule** — view/edit-existing list per day, Excel/PDF import.
- **Doctors** — add, rename, deactivate/reactivate. Deactivated doctors disappear from the
  check-in dropdown and new scheduling but keep all history; nothing is ever hard-deleted.
- **Reports** — date-range attendance summary, one row per date listing the doctors who attended
  and the doctors who were absent by name (days with nobody scheduled are skipped), exportable to
  Excel.
- **Audit Log** — searchable record of every manual override, reset, and locked-session edit.
- **Settings** — code length, validity-window offsets, grace period.

## Manual correction is the only way attendance changes

Once a doctor's session has attendance recorded, it's locked: editing or deleting it (or
correcting the attendance status itself) requires an explicit note, which gets written to the
audit log along with who made the change. There's no other path to editing historical attendance.

## Project structure

```
server/
  prisma/           schema + migrations + seed script
  src/
    routes/         Express route handlers (thin — validate, call a service, respond)
    services/       business logic (schedule, codes, check-in, sync, reports, ...)
    lib/            stateless helpers (time/timezone, code generation, Sheets client, PDF parser)
    validators/     Zod schemas, one per route group
    jobs/           node-cron jobs (Sheets retry, end-of-day absent)
    middleware/      auth guard, error handler
  tests/            vitest unit tests + test-DB helpers
client/
  src/
    pages/          route-level components (manager/* for the dashboard, top-level for public pages)
    components/      shared UI pieces (modals, dropdowns, banners)
    hooks/          auth context
    api/            fetch wrapper
```

## Known limitations

- The PDF importer is geometry-based (reads text x/y coordinates), not AI-based. It handles the
  aSc Timetables layout well but any cell where two different rows' text visually overlap near a
  row boundary can occasionally get merged — always covered by the editable preview.
- Google Sheets integration is implemented against the documented API surface but hasn't been
  exercised against a live spreadsheet in this environment (no credentials available for
  automated testing) — the no-op/error-handling paths and the row-values-building logic are
  covered directly.
