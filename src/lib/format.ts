const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const inrFixed = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

/** ₹1,00,000 (Indian digit grouping). Shows paise only when present. */
export function formatINR(value: number, opts: { paise?: boolean } = {}): string {
  const v = Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
  // Whole rupees stay compact (₹56,000); any paise are always shown as 2 digits (₹2,14,145.50).
  return (opts.paise || !Number.isInteger(v) ? inrFixed : inr).format(v);
}

/** Compact Indian notation: ₹1.2K, ₹3.45L, ₹1.1Cr */
export function formatINRCompact(value: number): string {
  const v = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (v >= 1e7) return `${sign}₹${trim(v / 1e7)}Cr`;
  if (v >= 1e5) return `${sign}₹${trim(v / 1e5)}L`;
  if (v >= 1e3) return `${sign}₹${trim(v / 1e3)}K`;
  return `${sign}₹${trim(v)}`;
}

function trim(n: number): string {
  return n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2).replace(/\.?0+$/, '');
}

export function formatNumber(value: number): string {
  return num.format(value);
}

/** Plain text money for PDFs (standard PDF fonts lack the ₹ glyph). */
export function formatRs(value: number): string {
  return `Rs. ${inrFixed.format(value).replace('₹', '').trim()}`;
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
