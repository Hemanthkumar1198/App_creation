/** Normalises Indian numbers to E.164 (+91XXXXXXXXXX); accepts other +country numbers as-is. */
export function toE164(input: string): string | null {
  const s = input.replace(/[\s()-]/g, '');
  if (/^\+\d{8,15}$/.test(s)) return s;
  const digits = s.replace(/^0+/, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}
