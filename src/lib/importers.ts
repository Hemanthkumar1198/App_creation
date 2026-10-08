/**
 * Import pipeline: file → raw table (string cells) → column mapping → normalised,
 * validated records with duplicate detection. Nothing is saved until the user confirms.
 */
import type { Loan, PaymentMethod, Transaction, TxType } from '../types';
import { addMonths, monthsBetween, todayISO } from './dates';
import { round2 } from './finance';
import { uid } from './format';
import { PAYMENT_METHODS } from './categories';
import { suggestRepaymentSplit } from './loans';

export interface RawTable {
  name: string;
  rows: string[][];
}

/* ------------------------------------------------------------------ CSV */

export function parseCSV(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const delim = [',', ';', '\t', '|'].map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((x) => x.trim().replace(/^'(?=[=+\-@])/, '')));
}

/* ----------------------------------------------------------------- XLSX */

export async function parseXlsx(file: File): Promise<RawTable[]> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const tables: RawTable[] = [];
  wb.eachSheet((ws) => {
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const out: string[] = [];
      for (let c = 1; c <= row.cellCount; c++) out.push(cellText(row.getCell(c).value));
      rows.push(out);
    });
    if (rows.length) tables.push({ name: ws.name, rows });
  });
  return tables;
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return isoFromUTCDate(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'string') return v.trim();
  const o = v as { result?: unknown; text?: string; richText?: { text: string }[]; hyperlink?: string };
  if (o.result !== undefined) return cellText(o.result);
  if (o.richText) return o.richText.map((r) => r.text).join('').trim();
  if (o.text !== undefined) return String(o.text).trim();
  return String(v);
}

function isoFromUTCDate(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ PDF */

interface PdfItem {
  str: string;
  x: number;
  y: number;
  w: number;
}

/**
 * Extracts table-like text from a PDF: text items are grouped into lines by their
 * vertical position, then split into columns aligned to the header line.
 */
export async function parsePdf(file: File): Promise<RawTable[]> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lines: PdfItem[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items: PdfItem[] = [];
    for (const it of content.items as { str: string; transform: number[]; width: number }[]) {
      if (!it.str || !it.str.trim()) continue;
      items.push({ str: it.str.trim(), x: it.transform[4], y: it.transform[5], w: it.width });
    }
    lines.push(...groupLines(items));
  }
  if (!lines.length) return [];
  return [{ name: 'PDF', rows: alignColumns(lines) }];
}

export function groupLines(items: PdfItem[]): PdfItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PdfItem[][] = [];
  for (const it of sorted) {
    const line = lines.find((l) => Math.abs(l[0].y - it.y) <= 3);
    if (line) line.push(it);
    else lines.push([it]);
  }
  for (const l of lines) l.sort((a, b) => a.x - b.x);
  // Merge adjacent fragments that belong to the same word/phrase.
  return lines.map((l) => {
    const merged: PdfItem[] = [];
    for (const it of l) {
      const prev = merged[merged.length - 1];
      if (prev && it.x - (prev.x + prev.w) < 4) {
        prev.str += (it.x - (prev.x + prev.w) > 1 ? ' ' : '') + it.str;
        prev.w = it.x + it.w - prev.x;
      } else merged.push({ ...it });
    }
    return merged;
  });
}

export function alignColumns(lines: PdfItem[][]): string[][] {
  // Anchor columns on the line that looks most like a header (or has the most cells).
  let anchor = lines[0];
  let best = -1;
  for (const l of lines.slice(0, 60)) {
    const score = headerScore(l.map((i) => i.str)) * 10 + l.length;
    if (score > best) {
      best = score;
      anchor = l;
    }
  }
  const cols = anchor.map((i) => ({ left: i.x, right: i.x + i.w }));
  return lines.map((l) => {
    const out = Array(cols.length).fill('') as string[];
    for (const it of l) {
      const center = it.x + it.w / 2;
      // Pick the column whose span is closest to the item's centre (handles left- and right-aligned values).
      let idx = 0;
      let dist = Infinity;
      cols.forEach((c, i) => {
        const d = center < c.left ? c.left - center : center > c.right ? center - c.right : 0;
        if (d < dist) {
          dist = d;
          idx = i;
        }
      });
      out[idx] = out[idx] ? `${out[idx]} ${it.str}` : it.str;
    }
    return out;
  });
}

/* -------------------------------------------------------- field mapping */

export type ImportTarget = 'transactions' | 'loans' | 'note' | 'plan';

export type TxField = 'date' | 'description' | 'amount' | 'debit' | 'credit' | 'type' | 'category' | 'paymentMethod' | 'notes';
export type LoanField = 'borrower' | 'phone' | 'principal' | 'startDate' | 'dueDate' | 'interestRate' | 'repaid' | 'notes';

export const TX_FIELDS: { key: TxField; label: string; hint?: string }[] = [
  { key: 'date', label: 'Transaction date *' },
  { key: 'description', label: 'Description' },
  { key: 'amount', label: 'Amount', hint: 'or use Debit / Credit columns' },
  { key: 'debit', label: 'Debit / Withdrawal (money out)' },
  { key: 'credit', label: 'Credit / Deposit (money in)' },
  { key: 'type', label: 'Type (Income / Expense, Cr / Dr)' },
  { key: 'category', label: 'Category' },
  { key: 'paymentMethod', label: 'Payment method' },
  { key: 'notes', label: 'Notes' },
];

export const LOAN_FIELDS: { key: LoanField; label: string }[] = [
  { key: 'borrower', label: 'Borrower / Person *' },
  { key: 'phone', label: 'Mobile number' },
  { key: 'principal', label: 'Amount lent *' },
  { key: 'startDate', label: 'Date lent *' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'interestRate', label: 'Interest rate (%)' },
  { key: 'repaid', label: 'Amount repaid so far' },
  { key: 'notes', label: 'Notes' },
];

const SYNONYMS: Record<string, string[]> = {
  date: ['date', 'txn date', 'transaction date', 'value date', 'posting date', 'tran date', 'dt', 'entry date'],
  description: ['description', 'narration', 'particulars', 'details', 'remarks', 'remark', 'title', 'item', 'purpose', 'transaction details', 'desc'],
  amount: ['amount', 'amt', 'amount inr', 'amount rs', 'value', 'total', 'inr', 'rs', 'transaction amount'],
  debit: ['debit', 'withdrawal', 'withdrawals', 'withdrawal amt', 'dr', 'debit amount', 'paid out', 'money out', 'out', 'spent', 'expense amount', 'cash out'],
  credit: ['credit', 'deposit', 'deposits', 'deposit amt', 'cr', 'credit amount', 'paid in', 'money in', 'in', 'received', 'cash in'],
  type: ['type', 'txn type', 'transaction type', 'cr dr', 'dr cr', 'income expense', 'in out', 'kind', 'direction'],
  category: ['category', 'head', 'tag', 'group', 'expense category', 'expense type'],
  paymentMethod: ['payment method', 'mode', 'method', 'payment mode', 'paid via', 'payment', 'via', 'channel'],
  notes: ['notes', 'note', 'comment', 'comments', 'memo'],
  borrower: ['borrower', 'borrower name', 'name', 'person', 'party', 'party name', 'given to', 'lent to', 'to', 'customer', 'remark', 'remarks', 'description', 'narration', 'particulars', 'details'],
  phone: ['phone', 'mobile', 'contact', 'phone number', 'mobile number', 'mobile no', 'phone no'],
  principal: ['amount lent', 'principal', 'loan amount', 'lent', 'given', 'amount given', 'cash out', 'money out', 'paid out', 'amount'],
  startDate: ['date lent', 'start date', 'loan date', 'given on', 'lent on', 'date given', 'date'],
  dueDate: ['due date', 'due', 'return date', 'repay by', 'due on'],
  interestRate: ['interest rate', 'interest', 'rate', 'roi', 'interest %', 'rate %'],
  repaid: ['repaid', 'amount repaid', 'paid back', 'returned', 'received', 'paid', 'cash in', 'money in'],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();

function matchScore(header: string, field: string): number {
  const h = norm(header);
  if (!h) return 0;
  const syns = SYNONYMS[field] ?? [];
  if (syns.includes(h)) return 3;
  if (syns.some((s) => s.length > 2 && (h.startsWith(s + ' ') || h.endsWith(' ' + s) || h.includes(` ${s} `)))) return 2;
  if (syns.some((s) => s.length > 3 && h.includes(s))) return 1;
  return 0;
}

export function headerScore(cells: string[]): number {
  const fields = Object.keys(SYNONYMS);
  return cells.filter((c) => fields.some((f) => matchScore(c, f) >= 2)).length;
}

/** Index of the most header-like row within the first 30 rows. */
export function detectHeaderRow(rows: string[][]): number {
  let best = 0;
  let bestScore = 0;
  rows.slice(0, 30).forEach((r, i) => {
    const s = headerScore(r);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  });
  return best;
}

export function autoMap<F extends string>(headers: string[], fields: F[]): Partial<Record<F, number>> {
  const map: Partial<Record<F, number>> = {};
  const used = new Set<number>();
  // Highest-confidence matches first so e.g. "Amount lent" wins over a generic "Amount".
  const candidates: { f: F; i: number; s: number }[] = [];
  fields.forEach((f) => headers.forEach((h, i) => candidates.push({ f, i, s: matchScore(h, f) })));
  candidates
    .filter((c) => c.s > 0)
    .sort((a, b) => b.s - a.s)
    .forEach(({ f, i }) => {
      if (map[f] === undefined && !used.has(i)) {
        map[f] = i;
        used.add(i);
      }
    });
  return map;
}

/** Words in a file or sheet name that mean "money lent on interest". */
const LOAN_NAME = /loan|lent|lend|borrow|intrest|interest|intres|udhar|udhaar|baki|chit|given money/i;

export function guessTarget(table: RawTable, headerRow: number, fileName = ''): ImportTarget {
  const name = `${table.name} ${fileName}`.toLowerCase();
  if (LOAN_NAME.test(name) && !/repayment|outstanding/.test(name)) return 'loans';
  const h = table.rows[headerRow] ?? [];
  // Strong loan-only columns (a generic "Remark"/"Cash In" isn't enough on its own).
  const loanish = h.filter((c) => ['dueDate', 'interestRate'].some((f) => matchScore(c, f) >= 2) || /borrower|lent to|given to/i.test(c)).length;
  return loanish >= 1 ? 'loans' : 'transactions';
}

/**
 * Pulls a person's name out of a free-text remark such as
 * "Sati mavIntrestes recieved dec 18 2025" → "Sati mav",
 * "Devraj shetty (vivek) 09 jun in google pay" → "Devraj shetty".
 */
export function cleanBorrowerName(raw: string): string {
  const text = raw.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
  const stop = /^(intrest|intrestes|interest|interests|int|recieved|received|recived|reciev|given|gave|sent|paid|for|on|in|at|to|by|via|from|gpay|google|phonepe|paytm|upi|cash|amount|rs|inr|jan|feb|mar|apr|may|jun|june|jul|july|aug|sep|sept|oct|nov|dec|january|february|march|april|august|september|october|november|december|total|mine|around|loan|and|&)$/i;
  const out: string[] = [];
  for (const w of text.split(' ')) {
    if (!w) continue;
    if (/[\d(₹]/.test(w) || stop.test(w.replace(/[.,:;-]+$/, ''))) break;
    out.push(w.replace(/[.,:;-]+$/, ''));
    if (out.length === 3) break;
  }
  const name = out.join(' ').trim();
  return (name || text).slice(0, 80);
}

/** Default type suggested by the sheet name (our own exports use one sheet per section). */
export function typeFromSheetName(name: string): TxType | null {
  const n = name.toLowerCase();
  if (/income|credit|receipt/.test(n)) return 'income';
  if (/expense|debit|spend|investment/.test(n)) return 'expense';
  return null;
}

/* ------------------------------------------------------------ parsing */

export function parseAmount(raw: string): { value: number; negative: boolean; crdr: 'cr' | 'dr' | null } | null {
  if (raw === undefined || raw === null) return null;
  let s = String(raw).trim();
  if (!s || s === '-' || s === '—') return null;
  let crdr: 'cr' | 'dr' | null = null;
  const m = s.match(/\b(cr|dr)\.?$/i);
  if (m) {
    crdr = m[1].toLowerCase() as 'cr' | 'dr';
    s = s.slice(0, m.index).trim();
  }
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/₹|rs\.?|inr/gi, '').replace(/[,\s]/g, '');
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) s = s.slice(1);
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return { value: round2(parseFloat(s)), negative, crdr };
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

function valid(y: number, m: number, d: number): string | null {
  if (y < 100) y += y < 70 ? 2000 : 1900;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1950 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Parses most date styles; ambiguous numeric dates use `order` (Indian default: day first). */
export function parseDateLoose(raw: string, order: 'dmy' | 'mdy' = 'dmy'): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  // Excel serial date number
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const n = Math.floor(parseFloat(s));
    if (n > 20000 && n < 80000) return isoFromUTCDate(new Date(Date.UTC(1899, 11, 30) + n * 86400000));
  }
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.\s](\d{1,2})[-/.\s](\d{2,4})\b/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const y = +m[3];
    if (a > 12) return valid(y, b, a);
    if (b > 12) return valid(y, a, b);
    return order === 'dmy' ? valid(y, b, a) : valid(y, a, b);
  }
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[-\s/.,]*([a-z]{3,9})[-\s/.,]*(\d{2,4})/i);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo) return valid(+m[3], mo, +m[1]);
  }
  m = s.match(/^([a-z]{3,9})[-\s.]+(\d{1,2})(?:st|nd|rd|th)?,?[-\s.]+(\d{2,4})/i);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return valid(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);
  return null;
}

const CATEGORY_RULES: [RegExp, string][] = [
  [/salary|payroll|stipend/i, 'Salary'],
  [/freelanc|consult|project fee/i, 'Freelance'],
  [/business|sales|shop income/i, 'Business'],
  [/refund|cashback|reversal/i, 'Refund'],
  [/petrol|diesel|fuel|hpcl|bpcl|indian oil|iocl|shell/i, 'Petrol/Fuel'],
  [/rent\b|house rent|landlord/i, 'Rent'],
  [/swiggy|zomato|food|grocer|restaurant|cafe|bigbasket|blinkit|zepto|dmart|milk|vegetable|dinner|lunch|breakfast/i, 'Food'],
  [/amazon|flipkart|myntra|ajio|meesho|shopping|cloth|mall|nykaa/i, 'Shopping'],
  [/uber|ola|rapido|irctc|train|flight|bus|metro|travel|makemytrip|redbus|cab|taxi|toll|fastag/i, 'Travel'],
  [/utilit|wifi|wi-fi|internet/i, 'Bills'],
  [/electric|bescom|water bill|gas bill|broadband|wifi|recharge|airtel|jio|vodafone|\bvi\b|dth|bill|emi|insurance|lic/i, 'Bills'],
  [/movie|netflix|prime video|hotstar|spotify|bookmyshow|entertain|game/i, 'Entertainment'],
  [/medical|pharma|hospital|clinic|doctor|apollo|medplus|medicine|health/i, 'Medical'],
  [/\bsip\b|mutual fund|zerodha|groww|stock|share|invest|\bfd\b|\brd\b|ppf|nps|gold/i, 'Investment'],
  [/gift/i, 'Gift'],
  [/personal|salon|grooming|gym/i, 'Personal'],
];

export function guessCategory(categoryCell: string, description: string, known: string[]): string {
  const c = categoryCell.trim();
  const exact = known.find((k) => k.toLowerCase() === c.toLowerCase());
  if (exact) return exact;
  for (const [re, cat] of CATEGORY_RULES) if (re.test(c) || re.test(description)) return cat;
  return 'Other';
}

export function guessPaymentMethod(cell: string, description: string): PaymentMethod {
  const s = `${cell} ${description}`;
  const exact = PAYMENT_METHODS.find((m) => m.toLowerCase() === cell.trim().toLowerCase());
  if (exact) return exact;
  if (/upi|gpay|google pay|phonepe|paytm|bhim/i.test(s)) return 'UPI';
  if (/neft|imps|rtgs|bank transfer|net ?banking|nach|ecs/i.test(s)) return 'Bank Transfer';
  if (/credit card|\bcc\b/i.test(s)) return 'Credit Card';
  if (/debit card|\bpos\b|card/i.test(s)) return 'Debit Card';
  if (/cheque|chq|check/i.test(s)) return 'Cheque';
  if (/cash|atm/i.test(s)) return 'Cash';
  return 'Other';
}

export function parseTypeCell(s: string): TxType | null {
  const v = norm(s);
  if (!v) return null;
  if (/^(income|credit|cr|deposit|in|cash in|received|receipt|inflow|\+)$/.test(v) || /\b(income|credit|deposit|received)\b/.test(v)) return 'income';
  if (/^(expense|debit|dr|withdrawal|out|cash out|paid|spent|outflow|payment|\-)$/.test(v) || /\b(expense|debit|withdrawal|spent)\b/.test(v)) return 'expense';
  return null;
}

/* ------------------------------------------------------------ records */

export type RowStatus = 'ok' | 'duplicate' | 'error';

export interface TxDraft {
  row: number;
  date: string;
  type: TxType;
  amount: number;
  category: string;
  description: string;
  paymentMethod: PaymentMethod;
  notes: string;
  status: RowStatus;
  issues: string[];
}

export interface TxOptions {
  dateOrder: 'dmy' | 'mdy';
  defaultType: TxType;
  knownCategories: string[];
}

export function buildTxDrafts(rows: string[][], map: Partial<Record<TxField, number>>, opts: TxOptions): TxDraft[] {
  const get = (r: string[], f: TxField) => (map[f] !== undefined ? (r[map[f]!] ?? '').toString().trim() : '');
  const out: TxDraft[] = [];
  rows.forEach((r, idx) => {
    if (r.every((c) => !String(c ?? '').trim())) return;
    const issues: string[] = [];
    const dateRaw = get(r, 'date');
    const description = get(r, 'description');
    // Skip summary/total lines and repeated headers commonly found in statements.
    if (/^(total|opening balance|closing balance|grand total|balance b\/f|balance c\/f)/i.test(description || dateRaw)) return;
    if (headerScore(r) >= 2) return;

    const date = parseDateLoose(dateRaw, opts.dateOrder);
    let type: TxType | null = parseTypeCell(get(r, 'type'));
    let amount: number | null = null;

    const debit = parseAmount(get(r, 'debit'));
    const credit = parseAmount(get(r, 'credit'));
    if (debit && debit.value > 0) {
      amount = debit.value;
      type = type ?? 'expense';
    } else if (credit && credit.value > 0) {
      amount = credit.value;
      type = type ?? 'income';
    } else {
      const a = parseAmount(get(r, 'amount'));
      if (a) {
        amount = a.value;
        if (!type) type = a.crdr === 'cr' ? 'income' : a.crdr === 'dr' ? 'expense' : a.negative ? 'expense' : opts.defaultType;
      }
    }

    if (!date) issues.push(dateRaw ? `Unrecognised date "${dateRaw}"` : 'Missing date');
    if (amount === null) issues.push('Missing or invalid amount');
    else if (amount <= 0) issues.push('Amount must be greater than 0');
    if (!date && amount === null && !description) return; // blank-ish line

    const t: TxType = type ?? opts.defaultType;
    out.push({
      row: idx,
      date: date ?? '',
      type: t,
      amount: amount ?? 0,
      category: guessCategory(get(r, 'category'), description, opts.knownCategories),
      description: description.slice(0, 200),
      paymentMethod: guessPaymentMethod(get(r, 'paymentMethod'), description),
      notes: get(r, 'notes').slice(0, 1000),
      status: issues.length ? 'error' : 'ok',
      issues,
    });
  });
  return out;
}

const txKey = (t: { date: string; type: string; amount: number; description: string }) => `${t.date}|${t.type}|${t.amount.toFixed(2)}|${norm(t.description)}`;

/** Flags rows that already exist in the app or appear twice in the file. */
export function markTxDuplicates(drafts: TxDraft[], existing: Transaction[]): TxDraft[] {
  const seen = new Set(existing.filter((t) => !t.deletedAt).map(txKey));
  return drafts.map((d) => {
    if (d.status === 'error') return d;
    const k = txKey(d);
    if (seen.has(k)) return { ...d, status: 'duplicate', issues: ['Looks like a duplicate of an existing entry'] };
    seen.add(k);
    return d;
  });
}

export function validateTxDraft(d: TxDraft): TxDraft {
  const issues: string[] = [];
  if (!d.date || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) issues.push('Invalid date');
  if (!(d.amount > 0) || d.amount > 1e11) issues.push('Invalid amount');
  if (issues.length) return { ...d, status: 'error', issues };
  return d.status === 'error' ? { ...d, status: 'ok', issues: [] } : d;
}

export function draftsToTransactions(drafts: TxDraft[]): Transaction[] {
  const now = new Date().toISOString();
  return drafts.map((d) => ({
    id: uid(),
    type: d.type,
    amount: round2(d.amount),
    date: d.date,
    category: d.category,
    description: d.description || d.category,
    paymentMethod: d.paymentMethod,
    notes: d.notes,
    createdAt: now,
    updatedAt: now,
  }));
}

export interface LoanDraft {
  row: number;
  borrowerName: string;
  phone: string;
  principal: number;
  startDate: string;
  dueDate: string;
  interestRate: number;
  repaid: number;
  notes: string;
  status: RowStatus;
  issues: string[];
}

export interface LoanImportOptions {
  /** Interest rate used when the file has none (0 = no interest). */
  defaultRate?: number;
  /** Months after the date lent used as due date when the file has none. */
  termMonths?: number;
}

export function buildLoanDrafts(rows: string[][], map: Partial<Record<LoanField, number>>, dateOrder: 'dmy' | 'mdy', opts: LoanImportOptions = {}): LoanDraft[] {
  const term = opts.termMonths && opts.termMonths > 0 ? Math.round(opts.termMonths) : 12;
  const get = (r: string[], f: LoanField) => (map[f] !== undefined ? (r[map[f]!] ?? '').toString().trim() : '');
  const out: LoanDraft[] = [];
  rows.forEach((r, idx) => {
    if (r.every((c) => !String(c ?? '').trim())) return;
    if (headerScore(r) >= 2) return;
    const rawName = get(r, 'borrower');
    if (/^(total|grand total|opening balance|closing balance)$/i.test(rawName)) return;
    const name = rawName ? cleanBorrowerName(rawName) : '';
    const principal = parseAmount(get(r, 'principal'))?.value ?? null;
    if (!name && principal === null) return;
    const start = parseDateLoose(get(r, 'startDate'), dateOrder);
    const dueParsed = parseDateLoose(get(r, 'dueDate'), dateOrder);
    const rate = parseAmount(get(r, 'interestRate').replace('%', ''))?.value ?? opts.defaultRate ?? 0;
    const repaid = parseAmount(get(r, 'repaid'))?.value ?? 0;
    const issues: string[] = [];
    if (!name) issues.push('Missing borrower name');
    if (!(principal && principal > 0)) issues.push(repaid > 0 ? 'Money received, not lent: add it as a repayment on the person\'s record' : 'Missing or invalid amount lent');
    if (!start) issues.push(get(r, 'startDate') ? `Unrecognised date "${get(r, 'startDate')}"` : 'Missing date lent');
    const due = dueParsed ?? (start ? addMonths(start, term) : '');
    if (start && due && due <= start) issues.push('Due date must be after the date lent');
    out.push({
      row: idx,
      borrowerName: name.slice(0, 80),
      phone: get(r, 'phone').replace(/[^\d+\s-]/g, '').slice(0, 20),
      principal: principal ?? 0,
      startDate: start ?? '',
      dueDate: due,
      interestRate: rate,
      repaid,
      notes: [rawName && rawName !== name ? rawName : '', get(r, 'notes')]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 1000),
      status: issues.length ? 'error' : 'ok',
      issues,
    });
  });
  return out;
}

export function validateLoanDraft(d: LoanDraft): LoanDraft {
  const issues: string[] = [];
  if (!d.borrowerName.trim()) issues.push('Missing borrower name');
  if (!(d.principal > 0)) issues.push('Invalid amount lent');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.startDate)) issues.push('Invalid date lent');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dueDate) || d.dueDate <= d.startDate) issues.push('Due date must be after the date lent');
  if (d.repaid < 0) issues.push('Repaid cannot be negative');
  if (issues.length) return { ...d, status: 'error', issues };
  return d.status === 'error' ? { ...d, status: 'ok', issues: [] } : d;
}

const loanKey = (l: { borrowerName: string; principal: number; startDate: string }) => `${norm(l.borrowerName)}|${l.principal.toFixed(2)}|${l.startDate}`;

export function markLoanDuplicates(drafts: LoanDraft[], existing: Loan[]): LoanDraft[] {
  const seen = new Set(existing.filter((l) => !l.deletedAt).map(loanKey));
  return drafts.map((d) => {
    if (d.status === 'error') return d;
    const k = loanKey(d);
    if (seen.has(k)) return { ...d, status: 'duplicate', issues: ['Looks like a duplicate of an existing loan'] };
    seen.add(k);
    return d;
  });
}

export function draftsToLoans(drafts: LoanDraft[], rateUnit: 'monthly' | 'yearly'): Loan[] {
  const now = new Date().toISOString();
  return drafts.map((d) => {
    const loan: Loan = {
      id: uid(),
      borrowerName: d.borrowerName.trim(),
      phone: d.phone,
      principal: round2(d.principal),
      startDate: d.startDate,
      interestRate: d.interestRate,
      interestType: rateUnit,
      interestMethod: 'simple',
      compounding: 'monthly',
      dueDate: d.dueDate,
      durationMonths: round2(monthsBetween(d.startDate, d.dueDate)),
      paymentFrequency: 'one-time',
      notes: d.notes,
      repayments: [],
      createdAt: now,
      updatedAt: now,
    };
    if (d.repaid > 0) {
      // Record what was already repaid as a single repayment (interest first, capped at the outstanding amount).
      const date = d.dueDate < todayISO() ? d.dueDate : todayISO() < d.startDate ? d.startDate : todayISO();
      const split = suggestRepaymentSplit(loan, d.repaid, date);
      const amount = Math.min(d.repaid, split.outstanding);
      const s = suggestRepaymentSplit(loan, amount, date);
      loan.repayments.push({
        id: uid(),
        amount: round2(amount),
        date,
        paymentMethod: 'Other',
        principalPortion: s.principalPortion,
        interestPortion: s.interestPortion,
        notes: 'Imported repayment total',
        createdAt: now,
      });
    }
    return loan;
  });
}

/** A friendly default name from the entries' dates, e.g. "Apr 2026" or "Jan–Mar 2026". */
export function suggestNameFromDates(dates: string[], fallback: string): string {
  const ms = [...new Set(dates.filter(Boolean).map((d) => d.slice(0, 7)))].sort();
  if (!ms.length) return fallback;
  const label = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleString('en-IN', { month: 'short' });
  const first = ms[0];
  const last = ms[ms.length - 1];
  if (first === last) return `${label(first)} ${first.slice(0, 4)}`;
  return first.slice(0, 4) === last.slice(0, 4) ? `${label(first)}–${label(last)} ${last.slice(0, 4)}` : `${label(first)} ${first.slice(0, 4)} – ${label(last)} ${last.slice(0, 4)}`;
}
