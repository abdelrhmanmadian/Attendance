export function formatSessionsSummary(
  sessions: { type: string; start: Date; title: string }[],
  toCairoTimeStr: (d: Date) => string
): string {
  return sessions
    .slice()
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map((s) => `${s.type} ${toCairoTimeStr(s.start)} ${s.title}`)
    .join("; ");
}
