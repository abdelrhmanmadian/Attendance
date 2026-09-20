import { Router } from "express";
import { requireManager } from "../middleware/auth.js";
import { reportQuerySchema } from "../validators/attendance.js";
import { buildAttendanceReport } from "../services/reportService.js";
import { buildReportWorkbook } from "../lib/reportExcel.js";

export const reportsRouter = Router();
reportsRouter.use(requireManager);

reportsRouter.get("/attendance", async (req, res) => {
  const parsed = reportQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message });
  }
  const rows = await buildAttendanceReport(parsed.data.from, parsed.data.to, parsed.data.doctorId);
  res.json(rows);
});

reportsRouter.get("/attendance/export", async (req, res) => {
  const parsed = reportQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message });
  }
  const rows = await buildAttendanceReport(parsed.data.from, parsed.data.to, parsed.data.doctorId);
  const buffer = await buildReportWorkbook(rows, parsed.data.from, parsed.data.to);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="attendance-report-${parsed.data.from}-to-${parsed.data.to}.xlsx"`
  );
  res.send(Buffer.from(buffer));
});
