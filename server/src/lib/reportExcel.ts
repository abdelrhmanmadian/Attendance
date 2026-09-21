import ExcelJS from "exceljs";
import type { DailyAttendanceReportRow } from "../services/reportService.js";

export async function buildReportWorkbook(rows: DailyAttendanceReportRow[], from: string, to: string): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Attendance ${from} to ${to}`.slice(0, 31));

  sheet.addRow(["Date", "Present", "Absent", "Attendance %"]);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = [{ width: 14 }, { width: 10 }, { width: 10 }, { width: 14 }];

  for (const r of rows) {
    sheet.addRow([r.date, r.present, r.absent, r.percentage]);
  }

  return workbook.xlsx.writeBuffer();
}
