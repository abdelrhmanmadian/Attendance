import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/env.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/env.js")>();
  return { ...actual, googleCredentialsConfigured: true };
});

vi.mock("../src/lib/sheets.js", () => ({
  readSheetValues: vi.fn(),
}));

import { readSheetValues } from "../src/lib/sheets.js";
import { parseScheduleFromGoogleSheet, extractSpreadsheetId } from "../src/lib/scheduleSheet.js";

const HEADER = ["Date", "Type", "Title", "Group", "Start Time", "End Time", "Location", "Doctor Name"];

describe("extractSpreadsheetId", () => {
  it("extracts the ID from a full Google Sheets URL", () => {
    expect(extractSpreadsheetId("https://docs.google.com/spreadsheets/d/abc123XYZ/edit#gid=0")).toBe("abc123XYZ");
  });

  it("passes through a bare ID unchanged", () => {
    expect(extractSpreadsheetId("  abc123XYZ  ")).toBe("abc123XYZ");
  });
});

describe("parseScheduleFromGoogleSheet", () => {
  beforeEach(() => {
    vi.mocked(readSheetValues).mockReset();
  });

  it("parses plain-text rows", async () => {
    vi.mocked(readSheetValues).mockResolvedValue([
      HEADER,
      ["2026-09-27", "Lecture", "EBA1103 Physics I", "1AR1", "08:30", "10:10", "A 306", "Dr. Manal Mostafa"],
    ]);

    const result = await parseScheduleFromGoogleSheet("sheet-id");

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        date: "2026-09-27",
        type: "Lecture",
        title: "EBA1103 Physics I",
        groupName: "1AR1",
        startTime: "08:30",
        endTime: "10:10",
        location: "A 306",
        doctorName: "Dr. Manal Mostafa",
      },
    ]);
  });

  it("converts Sheets' auto-detected date/time serial numbers to YYYY-MM-DD / HH:mm", async () => {
    // Google Sheets serial dates share Excel's 1899-12-30 epoch: 46292 is
    // 2026-09-27, and 0.354166... is the time-only fraction for 08:30.
    vi.mocked(readSheetValues).mockResolvedValue([
      HEADER,
      [46292, "Lecture", "EBA1103 Physics I", "1AR1", 0.3541666666666667, 0.4236111111111111, "A 306", "Dr. Manal Mostafa"],
    ]);

    const result = await parseScheduleFromGoogleSheet("sheet-id");

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      date: "2026-09-27",
      startTime: "08:30",
      endTime: "10:10",
    });
  });

  it("skips a fully blank row instead of reporting it as an error", async () => {
    vi.mocked(readSheetValues).mockResolvedValue([
      HEADER,
      ["2026-09-27", "Lecture", "EBA1103 Physics I", "1AR1", "08:30", "10:10", "A 306", "Dr. Manal Mostafa"],
      ["", "", "", "", "", "", "", ""],
    ]);

    const result = await parseScheduleFromGoogleSheet("sheet-id");

    expect(result.rows).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });

  it("reports a per-row validation error without failing the whole import", async () => {
    vi.mocked(readSheetValues).mockResolvedValue([
      HEADER,
      ["not-a-date", "Lecture", "EBA1103 Physics I", "1AR1", "08:30", "10:10", "A 306", "Dr. Manal Mostafa"],
    ]);

    const result = await parseScheduleFromGoogleSheet("sheet-id");

    expect(result.rows).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(2);
  });

  it("surfaces a clear error if the API call fails (e.g. not shared with the service account)", async () => {
    vi.mocked(readSheetValues).mockRejectedValue(new Error("The caller does not have permission"));

    const result = await parseScheduleFromGoogleSheet("sheet-id");

    expect(result.rows).toEqual([]);
    expect(result.errors[0].message).toContain("Couldn't read that sheet");
  });
});
