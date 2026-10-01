/**
 * Small, timezone-safe date helpers. All dates in the app are stored as
 * local calendar dates in ISO form (YYYY-MM-DD) so a ₹ entry made at 11pm
 * never drifts to the next/previous day.
 */

const MS_PER_DAY = 86_400_000;

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Adds calendar months, clamping to the end of shorter months (31 Jan + 1m = 28/29 Feb). */
export function addMonths(iso: string, months: number): string {
  const d = parseDate(iso);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const clamped = Math.min(day, daysInMonth(target.getFullYear(), target.getMonth()));
  target.setDate(clamped);
  return toISODate(target);
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Whole days from a to b (b - a). DST-safe because both are local midnights rounded. */
export function diffDays(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / MS_PER_DAY);
}

/**
 * Elapsed time in months between two dates, including a fractional part.
 * Whole calendar months are counted first (01 Oct → 01 Jan = exactly 3),
 * and the remaining days are divided by the length of the following month span.
 * Returns 0 when end <= start.
 */
export function monthsBetween(start: string, end: string): number {
  if (end <= start) return 0;
  let whole = 0;
  // Advance month by month from the start anchor (always from start to avoid clamp drift).
  while (addMonths(start, whole + 1) <= end) whole++;
  const anchor = addMonths(start, whole);
  const next = addMonths(start, whole + 1);
  const span = diffDays(anchor, next);
  const rest = diffDays(anchor, end);
  return whole + (span > 0 ? rest / span : 0);
}

export function yearsBetween(start: string, end: string): number {
  return monthsBetween(start, end) / 12;
}

export function minDate(a: string, b: string): string {
  return a < b ? a : b;
}

export function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}

export function startOfMonth(iso: string): string {
  return iso.slice(0, 7) + '-01';
}

export function endOfMonth(iso: string): string {
  const d = parseDate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Monday-based week start. */
export function startOfWeek(iso: string): string {
  const d = parseDate(iso);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return toISODate(d);
}

export function startOfYear(iso: string): string {
  return iso.slice(0, 4) + '-01-01';
}

export function endOfYear(iso: string): string {
  return iso.slice(0, 4) + '-12-31';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = parseDate(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateShort(iso: string): string {
  const d = parseDate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** dd/mm/yyyy — the format most Indian users type and read. */
export function formatDateNumeric(iso: string): string {
  const d = parseDate(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function formatMonth(isoOrYm: string): string {
  const [y, m] = isoOrYm.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function formatMonthShort(isoOrYm: string): string {
  const [y, m] = isoOrYm.split('-').map(Number);
  return `${MONTHS[m - 1]} '${String(y).slice(2)}`;
}

export function relativeDays(iso: string, today = todayISO()): string {
  const n = diffDays(today, iso);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}
