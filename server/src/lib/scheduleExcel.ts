import ExcelJS from "exceljs";
import { importRowSchema, type ImportRow } from "../validators/scheduleImport.js";

export const TEMPLATE_HEADERS = [
  "Date (YYYY-MM-DD)",
  "Type",
  "Title",
  "Group (optional)",
  "Start Time (HH:mm)",
  "End Time (HH:mm)",
  "Location",
  "Doctor Name",
] as const;

export async function buildTemplateWorkbook(): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Schedule");

  sheet.addRow([...TEMPLATE_HEADERS]);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = TEMPLATE_HEADERS.map((header) => ({
    header,
    width: Math.max(18, header.length + 2),
  }));

  sheet.addRow(["2026-09-27", "Lecture", "EBA1103 Physics I", "1AR1", "08:30", "10:10", "A 306", "Dr. Manal Mostafa"]);
  sheet.addRow(["2026-09-27", "Tutorial", "ECE1101 Programming", "1AR1", "10:30", "12:10", "A 109 - PC", "Dr. Tarek Ghonemy"]);

  return workbook.xlsx.writeBuffer();
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    // Excel time-only cells serialize as a Date on/near the 1899/1900 epoch;
    // a real calendar date will never land in that year.
    return value.getUTCFullYear() < 1901
      ? value.toISOString().slice(11, 16) // time-only cell -> HH:mm
      : value.toISOString().slice(0, 10); // date cell -> YYYY-MM-DD
  }
  if (typeof value === "object" && "text" in value) {
    return String((value as { text: unknown }).text ?? "").trim();
  }
  return String(value).trim();
}

export interface ParsedImport {
  rows: ImportRow[];
  errors: { row: number; message: string }[];
}

export async function parseScheduleWorkbook(buffer: Buffer): Promise<ParsedImport> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { rows: [], errors: [{ row: 0, message: "The file has no worksheet." }] };
  }

  const rows: ImportRow[] = [];
  const errors: { row: number; message: string }[] = [];

  sheet.eachRow((excelRow, rowNumber) => {
    if (rowNumber === 1) return; // header
    const values = excelRow.values as ExcelJS.CellValue[]; // 1-indexed, [0] unused
    const isEmpty = values.slice(1, 9).every((v) => v === null || v === undefined || String(v).trim() === "");
    if (isEmpty) return;

    const raw = {
      date: cellToString(values[1]),
      type: cellToString(values[2]),
      title: cellToString(values[3]),
      groupName: cellToString(values[4]) || undefined,
      startTime: cellToString(values[5]),
      endTime: cellToString(values[6]),
      location: cellToString(values[7]),
      doctorName: cellToString(values[8]),
    };

    const parsed = importRowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row: rowNumber, message: parsed.error.issues.map((i) => i.message).join("; ") });
    } else {
      rows.push(parsed.data);
    }
  });

  return { rows, errors };
}
