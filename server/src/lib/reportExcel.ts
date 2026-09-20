import ExcelJS from "exceljs";
import type { AttendanceReportRow } from "../services/reportService.js";

export async function buildReportWorkbook(rows: AttendanceReportRow[], from: string, to: string): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Attendance ${from} to ${to}`.slice(0, 31));

  sheet.addRow(["Doctor", "Scheduled Days", "Present", "Late", "Absent", "Attendance %"]);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = [
    { width: 32 },
    { width: 16 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 14 },
  ];

  for (const r of rows) {
    sheet.addRow([r.doctorName, r.totalScheduledDays, r.present, r.late, r.absent, r.percentage]);
  }

  return workbook.xlsx.writeBuffer();
}
