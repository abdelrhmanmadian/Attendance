import { fromZonedTime, toZonedTime, format } from "date-fns-tz";

export const CAIRO_TZ = "Africa/Cairo";

/** Cairo calendar date (YYYY-MM-DD) -> UTC Date at that day's midnight in Cairo. */
export function cairoDateOnly(cairoDateStr: string): Date {
  return fromZonedTime(`${cairoDateStr}T00:00:00`, CAIRO_TZ);
}

/** Cairo local wall-clock date+time -> UTC instant. */
export function cairoWallTimeToUtc(cairoDateStr: string, hhmm: string): Date {
  return fromZonedTime(`${cairoDateStr}T${hhmm}:00`, CAIRO_TZ);
}

/** UTC instant -> Cairo calendar date string (YYYY-MM-DD). */
export function toCairoDateStr(utcDate: Date): string {
  return format(toZonedTime(utcDate, CAIRO_TZ), "yyyy-MM-dd", { timeZone: CAIRO_TZ });
}

/** UTC instant -> Cairo wall-clock HH:mm for display. */
export function toCairoTimeStr(utcDate: Date): string {
  return format(toZonedTime(utcDate, CAIRO_TZ), "HH:mm", { timeZone: CAIRO_TZ });
}

/** Today's Cairo calendar date as a UTC-midnight Date, for DB date columns. */
export function todayCairoDateOnly(): Date {
  return cairoDateOnly(toCairoDateStr(new Date()));
}
