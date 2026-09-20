import { Router } from "express";
import multer from "multer";
import { requireManager } from "../middleware/auth.js";
import { buildTemplateWorkbook, parseScheduleWorkbook } from "../lib/scheduleExcel.js";
import { commitImportSchema } from "../validators/scheduleImport.js";
import { commitScheduleImport } from "../services/scheduleImportService.js";

export const scheduleImportRouter = Router();
scheduleImportRouter.use(requireManager);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const okTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (okTypes.includes(file.mimetype) || file.originalname.toLowerCase().endsWith(".xlsx")) {
      cb(null, true);
    } else {
      cb(new Error("Only .xlsx files are supported"));
    }
  },
});

scheduleImportRouter.get("/template", async (_req, res) => {
  const buffer = await buildTemplateWorkbook();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="schedule-import-template.xlsx"');
  res.send(Buffer.from(buffer));
});

scheduleImportRouter.post("/preview", (req, res, next) => {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      return res.status(400).json({ error: "UPLOAD_ERROR", message });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "NO_FILE", message: "No file uploaded." });
  }
  const { rows, errors } = await parseScheduleWorkbook(req.file.buffer);
  res.json({
    valid: errors.length === 0,
    rowCount: rows.length,
    rows: errors.length === 0 ? rows : [],
    errors,
  });
});

scheduleImportRouter.post("/commit", async (req, res) => {
  const parsed = commitImportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message });
  }
  const result = await commitScheduleImport(parsed.data.rows, req.session.managerId!);
  res.status(201).json(result);
});
