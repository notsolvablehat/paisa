/**
 * All money in the app is an integer number of paise.
 * Users type whole rupees; we convert at the boundary.
 */
export const PAISE_PER_RUPEE = 100;

/** Largest amount a user may enter: ₹9,99,99,999 (8 digits, matches the input). */
export const MAX_RUPEES = 99_999_999;
export const MAX_PAISE = MAX_RUPEES * PAISE_PER_RUPEE;

export function rupeesToPaise(rupees: number): number {
  if (!Number.isSafeInteger(rupees)) throw new RangeError("Rupees must be a whole number");
  return rupees * PAISE_PER_RUPEE;
}

/** Whole rupees, rounded half away from zero. */
export function paiseToRupees(paise: number): number {
  const sign = paise < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(paise) / PAISE_PER_RUPEE);
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** 1234567 paise → "12,346" */
export function formatNumber(paise: number): string {
  return inr.format(paiseToRupees(paise));
}

const inr2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1234500 paise → "₹12,345"; 1234550 → "₹12,345.50"; negatives → "−₹…" */
export function formatINR(paise: number): string {
  const abs = Math.abs(paise);
  const body = abs % 100 === 0 ? inr.format(abs / 100) : inr2.format(abs / 100);
  return (paise < 0 ? "−₹" : "₹") + body;
}

/** 2_430_000 paise → "₹24.3k" */
export function formatK(paise: number): string {
  return "₹" + (paiseToRupees(paise) / 1000).toFixed(1) + "k";
}

/** Parse what the user typed ("12,500" / "12500") into whole rupees, or null. */
export function parseRupees(input: string): number | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isSafeInteger(n) || n > MAX_RUPEES) return null;
  return n;
}

/**
 * Parse a typed amount ("₹12,500.5", "12500") into paise without float maths.
 * Returns null for empty / invalid / over-limit input. At most 2 decimals.
 */
export function parseToPaise(input: string): number | null {
  const clean = input.replace(/[₹,\s]/g, "");
  const m = /^(\d+)(?:\.(\d{0,2}))?$/.exec(clean);
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = Number((m[2] ?? "").padEnd(2, "0"));
  const p = whole * PAISE_PER_RUPEE + frac;
  return Number.isSafeInteger(p) && p <= MAX_PAISE ? p : null;
}

/** Paise → plain editable text: 1250050 → "12500.50", 1250000 → "12500". */
export function paiseToInput(paise: number): string {
  const r = Math.floor(Math.abs(paise) / 100), f = Math.abs(paise) % 100;
  return (paise < 0 ? "-" : "") + r + (f ? "." + String(f).padStart(2, "0") : "");
}
