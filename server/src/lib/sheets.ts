import { google, sheets_v4 } from "googleapis";
import { env, sheetsConfigured } from "../env.js";
import { toCairoDateStr, toCairoTimeStr, CAIRO_TZ } from "./time.js";

const SHEET_COLUMNS = [
  "Date",
  "Day",
  "Doctor",
  "Sessions today",
  "First session start",
  "Last session end",
  "Location(s)",
  "Status",
  "Check-in time",
  "Minutes late",
  "Code used",
  "Last updated",
] as const;

let cachedClient: sheets_v4.Sheets | null = null;

function getClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;
  const auth = new google.auth.JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

export interface AttendanceRowInput {
  date: Date;
  doctorName: string;
  status: string;
  checkInTime: Date | null;
  minutesLate: number;
  codeUsed: string | null;
  sessions: { type: string; title: string; start: Date; end: Date; location: string }[];
}

export function buildRowValues(input: AttendanceRowInput): string[] {
  const dateStr = toCairoDateStr(input.date);
  const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: CAIRO_TZ }).format(input.date);
  const sortedSessions = [...input.sessions].sort((a, b) => a.start.getTime() - b.start.getTime());
  const sessionsSummary = sortedSessions.map((s) => `${s.type} ${toCairoTimeStr(s.start)} ${s.title}`).join("; ");
  const firstStart = sortedSessions[0] ? toCairoTimeStr(sortedSessions[0].start) : "";
  const lastEnd = sortedSessions.length
    ? toCairoTimeStr(sortedSessions.reduce((a, b) => (a.end > b.end ? a : b)).end)
    : "";
  const locations = [...new Set(sortedSessions.map((s) => s.location))].join(", ");

  return [
    dateStr,
    dayName,
    input.doctorName,
    sessionsSummary,
    firstStart,
    lastEnd,
    locations,
    input.status,
    input.checkInTime ? toCairoTimeStr(input.checkInTime) : "",
    input.status === "ABSENT" ? "" : String(input.minutesLate),
    input.codeUsed ?? "",
    new Date().toISOString(),
  ];
}

function monthTabName(date: Date): string {
  return toCairoDateStr(date).slice(0, 7); // YYYY-MM
}

async function getSpreadsheetMeta(sheets: sheets_v4.Sheets) {
  const res = await sheets.spreadsheets.get({ spreadsheetId: env.GOOGLE_SHEET_ID });
  return res.data;
}

async function ensureMonthTab(sheets: sheets_v4.Sheets, tabName: string): Promise<number> {
  const meta = await getSpreadsheetMeta(sheets);
  const existing = meta.sheets?.find((s) => s.properties?.title === tabName);
  if (existing?.properties?.sheetId != null) {
    return existing.properties.sheetId;
  }

  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title: tabName } } }],
    },
  });
  const newSheetId = addRes.data.replies?.[0]?.addSheet?.properties?.sheetId;
  if (newSheetId == null) throw new Error("Failed to create month tab");

  await sheets.spreadsheets.values.update({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: `${tabName}!A1:L1`,
    valueInputOption: "RAW",
    requestBody: { values: [[...SHEET_COLUMNS]] },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    requestBody: {
      requests: [
        {
          addProtectedRange: {
            protectedRange: {
              range: { sheetId: newSheetId, startColumnIndex: 0, endColumnIndex: 12 },
              description:
                "Managed by the Attendance app. Editing columns A-L directly may be overwritten by the next sync.",
              warningOnly: true,
            },
          },
        },
      ],
    },
  });

  return newSheetId;
}

async function findRowIndex(sheets: sheets_v4.Sheets, tabName: string, dateStr: string, doctorName: string): Promise<number | null> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: `${tabName}!A2:C`,
  });
  const rows = res.data.values ?? [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === dateStr && rows[i][2] === doctorName) {
      return i + 2; // 1-indexed, +1 for header row
    }
  }
  return null;
}

/**
 * Reads raw cell values from an arbitrary spreadsheet the service account
 * has at least Viewer access to (unlike the rest of this file, which only
 * ever touches the one configured GOOGLE_SHEET_ID). Values come back
 * unformatted — numbers for anything Sheets auto-detected as a date/time,
 * exactly like Excel's serial dates — so the caller decides how to read them.
 */
export async function readSheetValues(spreadsheetId: string, range: string): Promise<unknown[][]> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return res.data.values ?? [];
}

/**
 * Writes (or updates) one attendance row. Throws on failure; caller decides
 * how to record that. Returns false without attempting anything if Sheets
 * isn't configured — distinct from success, so callers never mark a row
 * "synced" for a write that never happened.
 */
export async function syncAttendanceRowToSheet(input: AttendanceRowInput): Promise<boolean> {
  if (!sheetsConfigured) return false;

  const sheets = getClient();
  const tabName = monthTabName(input.date);
  await ensureMonthTab(sheets, tabName);

  const values = buildRowValues(input);
  const dateStr = values[0];
  const existingRow = await findRowIndex(sheets, tabName, dateStr, input.doctorName);

  if (existingRow) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: env.GOOGLE_SHEET_ID,
      range: `${tabName}!A${existingRow}:L${existingRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [values] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: env.GOOGLE_SHEET_ID,
      range: `${tabName}!A:L`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values] },
    });
  }

  return true;
}
