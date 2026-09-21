import { env, googleCredentialsConfigured } from "../env.js";
import { importRowSchema, type ImportRow } from "../validators/scheduleImport.js";
import type { ParsedImport } from "./scheduleExcel.js";
import { readSheetValues } from "./sheets.js";

// Google Sheets shares Excel's serial date system for backward compatibility:
// day 0 is December 30, 1899. Requesting UNFORMATTED_VALUE gives us this raw
// number regardless of the sheet's display format/locale, so parsing doesn't
// depend on whether a manager's spreadsheet shows "2026-09-27" or "9/27/2026".
const SHEETS_EPOCH_MS = Date.UTC(1899, 11, 30);

function serialToDate(serial: number): Date {
  return new Date(SHEETS_EPOCH_MS + serial * 86_400_000);
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    const date = serialToDate(value);
    // A time-only cell's serial value is a fraction of a day, so it lands
    // near the epoch itself — same year check the Excel importer uses.
    return date.getUTCFullYear() < 1901
      ? date.toISOString().slice(11, 16) // HH:mm
      : date.toISOString().slice(0, 10); // YYYY-MM-DD
  }
  return String(value).trim();
}

export function extractSpreadsheetId(urlOrId: string): string {
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : urlOrId.trim();
}

/**
 * Same 8-column layout as the Excel template (Date, Type, Title, Group,
 * Start Time, End Time, Location, Doctor Name), read from a Google Sheet
 * the service account has been shared Viewer access to.
 */
export async function parseScheduleFromGoogleSheet(urlOrId: string, sheetName?: string): Promise<ParsedImport> {
  if (!googleCredentialsConfigured) {
    return {
      rows: [],
      errors: [
        {
          row: 0,
          message:
            "Google Sheets isn't configured on this server — set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY first.",
        },
      ],
    };
  }

  const spreadsheetId = extractSpreadsheetId(urlOrId);
  const range = sheetName ? `${sheetName}!A:H` : "A:H";

  let values: unknown[][];
  try {
    values = await readSheetValues(spreadsheetId, range);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read the sheet.";
    return {
      rows: [],
      errors: [
        {
          row: 0,
          message: `Couldn't read that sheet: ${message}. Make sure it's shared with ${env.GOOGLE_SERVICE_ACCOUNT_EMAIL} (Viewer access is enough), and that the link/ID is correct.`,
        },
      ],
    };
  }

  const rows: ImportRow[] = [];
  const errors: { row: number; message: string }[] = [];

  values.forEach((rowValues, index) => {
    if (index === 0) return; // header row
    const isEmpty = rowValues.slice(0, 8).every((v) => v === null || v === undefined || String(v).trim() === "");
    if (isEmpty) return;

    const raw = {
      date: cellToString(rowValues[0]),
      type: cellToString(rowValues[1]),
      title: cellToString(rowValues[2]),
      groupName: cellToString(rowValues[3]) || undefined,
      startTime: cellToString(rowValues[4]),
      endTime: cellToString(rowValues[5]),
      location: cellToString(rowValues[6]),
      doctorName: cellToString(rowValues[7]),
    };

    const parsed = importRowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row: index + 1, message: parsed.error.issues.map((i) => i.message).join("; ") });
    } else {
      rows.push(parsed.data);
    }
  });

  if (values.length === 0) {
    errors.push({ row: 0, message: "That sheet (or tab) is empty." });
  }

  return { rows, errors };
}
