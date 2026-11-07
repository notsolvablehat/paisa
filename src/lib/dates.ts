/**
 * Calendar helpers. We work with plain "YYYY-MM-DD" / "YYYY-MM" strings so
 * there is never any timezone drift between server, DB and browser.
 */

export const APP_TZ = process.env.NEXT_PUBLIC_APP_TZ || "Asia/Kolkata";

export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export type YMD = { y: number; m: number; d: number }; // m is 1-12

/** Today's date in the app timezone, as YYYY-MM-DD. */
export function todayISO(now: Date = new Date(), tz: string = APP_TZ): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    now,
  );
}

export function parseISO(iso: string): YMD {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d: d ?? 1 };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toISO({ y, m, d }: YMD): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function monthKey(y: number, m: number): string {
  return `${y}-${pad(m)}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Shift a YYYY-MM by n months. */
export function addMonths(month: string, n: number): string {
  const { y, m } = parseISO(month);
  const idx = y * 12 + (m - 1) + n;
  return monthKey(Math.floor(idx / 12), (idx % 12) + 1);
}

/** Shift a date by n months, clamping the day (31 Jan + 1 → 28/29 Feb). */
export function addMonthsToDate(iso: string, n: number): string {
  const { y, m, d } = parseISO(iso);
  const next = parseISO(addMonths(monthKey(y, m), n));
  return toISO({ y: next.y, m: next.m, d: Math.min(d, daysInMonth(next.y, next.m)) });
}

export function monthRange(month: string): { start: string; end: string; days: number } {
  const { y, m } = parseISO(month);
  const days = daysInMonth(y, m);
  return { start: toISO({ y, m, d: 1 }), end: toISO({ y, m, d: days }), days };
}

/** Whole days from a to b (b − a). */
export function diffDays(a: string, b: string): number {
  const A = parseISO(a), B = parseISO(b);
  return Math.round((Date.UTC(B.y, B.m - 1, B.d) - Date.UTC(A.y, A.m - 1, A.d)) / 86_400_000);
}

export function addDays(iso: string, n: number): string {
  const { y, m, d } = parseISO(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return toISO({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() });
}

/** "11 Nov" */
export function dayMonth(iso: string): string {
  const { m, d } = parseISO(iso);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

/** "Wednesday, 11 November" */
export function longDay(iso: string): string {
  const { y, m, d } = parseISO(iso);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[wd]}, ${d} ${MONTHS_LONG[m - 1]}`;
}

/** "November 2026" / "Nov 2026" */
export function monthLabel(month: string, short = false): string {
  const { y, m } = parseISO(month);
  return `${(short ? MONTHS_SHORT : MONTHS_LONG)[m - 1]} ${y}`;
}

/** ISO date ⇄ local Date at midnight, for date-picker components (no timezone drift). */
export function isoToLocalDate(iso: string): Date {
  const { y, m, d } = parseISO(iso);
  return new Date(y, m - 1, d);
}
export function localDateToISO(dt: Date): string {
  return toISO({ y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() });
}
