import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const DAY_LABELS = ["Sa", "Su", "Mo", "Tu", "We", "Th"] as const;
export type DayLabel = (typeof DAY_LABELS)[number];

const DEFAULT_SLOT_TIMES: [string, string][] = [
  ["08:30", "10:10"],
  ["10:30", "12:10"],
  ["12:30", "14:10"],
  ["14:30", "16:10"],
  ["16:30", "18:10"],
  ["18:30", "20:10"],
];

const NOISE_STRINGS = new Set(["AASTMT", "aSc Timetables", "", " "]);

export interface PdfPatternRow {
  dayOfWeek: DayLabel;
  type: string;
  title: string;
  groupName: string;
  startTime: string;
  endTime: string;
  location: string;
  doctorName: string;
}

export interface ParsedPdfSchedule {
  patterns: PdfPatternRow[];
  warnings: string[];
}

interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

function to24h(timeLabel: string): string {
  // Normalizes "8:30" -> "08:30"
  const [h, m] = timeLabel.split(":");
  return `${h.padStart(2, "0")}:${m}`;
}

function classifyType(title: string, location: string): string {
  const haystack = `${title} ${location}`.toLowerCase();
  if (haystack.includes("lab")) return "Lab";
  if (haystack.includes("studio")) return "Studio";
  if (haystack.includes("tutorial")) return "Tutorial";
  return "Lecture";
}

async function extractPageItems(page: pdfjsLib.PDFPageProxy): Promise<TextItem[]> {
  const content = await page.getTextContent();
  const items: TextItem[] = [];
  for (const raw of content.items as { str: string; transform: number[]; width: number }[]) {
    const str = raw.str.trim();
    if (!str || NOISE_STRINGS.has(str) || str.startsWith("Timetable generated")) continue;
    items.push({ str, x: raw.transform[4], y: raw.transform[5], width: raw.width });
  }
  return items;
}

function buildBoundaries(centers: number[]): number[] {
  // midpoints between consecutive sorted centers; caller adds +/-Infinity ends
  const sorted = [...centers].sort((a, b) => a - b);
  const bounds: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    bounds.push((sorted[i] + sorted[i + 1]) / 2);
  }
  return bounds;
}

function indexInBands(value: number, sortedCenters: number[], boundsAscending: number[]): number {
  // boundsAscending has length sortedCenters.length - 1, splitting ascending-sorted bands.
  // sortedCenters correspond to ascending order too.
  for (let i = 0; i < boundsAscending.length; i++) {
    if (value < boundsAscending[i]) return i;
  }
  return sortedCenters.length - 1;
}

function parsePage(items: TextItem[], pageIndex: number, warnings: string[]): PdfPatternRow[] {
  const dayHeaderItems = items.filter((it) => (DAY_LABELS as readonly string[]).includes(it.str) && it.x < 90);
  const slotHeaderItems = items.filter((it) => /^[1-6]$/.test(it.str) && it.width < 15 && it.y > 495);
  const timeLabelItems = items
    .filter((it) => /^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/.test(it.str))
    .sort((a, b) => a.x - b.x);

  if (dayHeaderItems.length !== 6 || slotHeaderItems.length !== 6) {
    warnings.push(
      `Page ${pageIndex}: expected 6 day rows and 6 time-slot columns, found ${dayHeaderItems.length} day label(s) and ${slotHeaderItems.length} slot header(s). Skipping this page.`
    );
    return [];
  }

  const groupTitleItem = items.find((it) => it.y > 545 && it.x > 90);
  const groupName = groupTitleItem?.str ?? `Group (page ${pageIndex})`;

  // Rows: sort day headers descending by y (top of page = highest y = Saturday, first row).
  const dayRowsSortedDesc = [...dayHeaderItems].sort((a, b) => b.y - a.y);
  const dayYsAscending = [...dayRowsSortedDesc].reverse().map((it) => it.y); // ascending y = reverse of desc
  const rowBounds = buildBoundaries(dayYsAscending);

  // Columns: sort slot headers ascending by x (slot 1 leftmost).
  const slotsSortedAsc = [...slotHeaderItems].sort((a, b) => a.x - b.x);
  const slotXsAscending = slotsSortedAsc.map((it) => it.x);
  const colBounds = buildBoundaries(slotXsAscending);
  const colWidths = slotXsAscending.map((x, i) =>
    i < slotXsAscending.length - 1 ? slotXsAscending[i + 1] - x : slotXsAscending[i] - slotXsAscending[i - 1]
  );

  const slotTimes: [string, string][] =
    timeLabelItems.length === 6
      ? timeLabelItems.map((it): [string, string] => {
          const [s, e] = it.str.split("-").map((s) => to24h(s.trim()));
          return [s, e];
        })
      : DEFAULT_SLOT_TIMES;

  const headerYMax = Math.max(...slotHeaderItems.map((it) => it.y));
  const contentItems = items.filter(
    (it) =>
      it !== groupTitleItem &&
      !dayHeaderItems.includes(it) &&
      !slotHeaderItems.includes(it) &&
      !timeLabelItems.includes(it) &&
      it.y < headerYMax
  );

  // dayYsAscending[i] corresponds to which day label? dayRowsSortedDesc is descending;
  // reversed gives ascending order matching dayYsAscending, so build a parallel day list.
  const dayLabelsAscendingY = [...dayRowsSortedDesc].reverse().map((it) => it.str as DayLabel);

  type Cluster = { lines: TextItem[]; endColIndex: number };
  const clusters = new Map<string, Cluster>();

  for (const item of contentItems) {
    const rowIdx = indexInBands(item.y, dayYsAscending, rowBounds);
    const colIdx = indexInBands(item.x, slotXsAscending, colBounds);
    const key = `${rowIdx}:${colIdx}`;
    const rightX = item.x + item.width;

    let cluster = clusters.get(key);
    if (!cluster) {
      cluster = { lines: [], endColIndex: colIdx };
      clusters.set(key, cluster);
    }
    cluster.lines.push(item);

    // Extend endColIndex if this line's right edge substantially overlaps later columns.
    for (let c = colIdx + 1; c < slotXsAscending.length; c++) {
      const bandLeft = colBounds[c - 1];
      const bandWidth = colWidths[c];
      const overlap = rightX - bandLeft;
      if (overlap > 0.35 * bandWidth) {
        cluster.endColIndex = Math.max(cluster.endColIndex, c);
      }
    }
  }

  const patterns: PdfPatternRow[] = [];

  for (const [key, cluster] of clusters) {
    const [rowIdxStr, colIdxStr] = key.split(":");
    const rowIdx = Number(rowIdxStr);
    const colIdx = Number(colIdxStr);
    const dayOfWeek = dayLabelsAscendingY[rowIdx];

    const lines = [...cluster.lines].sort((a, b) => b.y - a.y).map((l) => l.str);
    if (lines.length < 2) {
      warnings.push(`Page ${pageIndex} (${groupName}, ${dayOfWeek}): couldn't read a cell with too little text (${lines.join(" / ")}). Skipped.`);
      continue;
    }

    let instructorLine: string | null = null;
    let titleLines: string[];
    const roomLine = lines[lines.length - 1];

    if (/^(Dr\.|Eng\.|Prof\.)\s/i.test(lines[0])) {
      instructorLine = lines[0];
      let titleStart = 1;
      // A long co-taught line (e.g. "Dr. X / Eng. Y") can wrap across two PDF
      // lines, splitting right after the second title with the name still to
      // come — merge it back before treating the rest as the course title.
      if (/\/\s*(Dr|Eng|Prof)\.?$/i.test(instructorLine) && lines.length > 2) {
        instructorLine = `${instructorLine} ${lines[1]}`;
        titleStart = 2;
      }
      titleLines = lines.slice(titleStart, -1);
    } else {
      titleLines = lines.slice(0, -1);
    }

    if (titleLines.length === 0) {
      warnings.push(`Page ${pageIndex} (${groupName}, ${dayOfWeek}): couldn't separate title/room in "${lines.join(" / ")}". Skipped.`);
      continue;
    }
    if (!instructorLine) {
      warnings.push(`Page ${pageIndex} (${groupName}, ${dayOfWeek}, "${titleLines.join(" ")}"): no instructor name detected. Skipped — add manually if needed.`);
      continue;
    }

    const title = titleLines.join(" ").replace(/\s+/g, " ").trim();
    const location = roomLine.trim();
    const startTime = slotTimes[colIdx]?.[0] ?? DEFAULT_SLOT_TIMES[colIdx][0];
    const endTime = slotTimes[cluster.endColIndex]?.[1] ?? DEFAULT_SLOT_TIMES[cluster.endColIndex][1];
    const type = classifyType(title, location);

    const doctorNames = instructorLine
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const doctorName of doctorNames) {
      patterns.push({ dayOfWeek, type, title, groupName, startTime, endTime, location, doctorName });
    }
  }

  return patterns;
}

export async function parsePdfSchedule(buffer: Buffer): Promise<ParsedPdfSchedule> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const warnings: string[] = [];
  const patterns: PdfPatternRow[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const items = await extractPageItems(page);
    patterns.push(...parsePage(items, pageNum, warnings));
  }

  return { patterns, warnings };
}
