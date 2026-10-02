/**
 * Exports. Personal finance and lending are always exported as separate sections:
 * Daily Expenses · Income · Investments · Loans · Loan Repayments · Outstanding Loans.
 */
import type { CalcNote, Loan, Plan, Transaction } from '../types';
import { computePlan, noteTotals } from './plans';
import { formatDate, formatDateNumeric, todayISO } from './dates';
import { round2 } from './finance';
import { formatRs } from './format';
import { computeLoan, describeRate, STATUS_LABEL } from './loans';
import { inRange, live } from './reports';

type Cell = string | number;
export interface Section {
  title: string;
  columns: { header: string; money?: boolean; width?: number }[];
  rows: Cell[][];
  total?: number;
}

function download(filename: string, content: BlobPart, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v);
  // Prevent CSV/formula injection when the file is opened in Excel.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCSV(rows: (Cell | undefined)[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** CSV with a UTF-8 BOM so Excel shows ₹ and names correctly. */
export function downloadCSV(filename: string, rows: (Cell | undefined)[][]) {
  download(filename, '﻿' + toCSV(rows), 'text/csv;charset=utf-8');
}

export function downloadJSON(filename: string, data: unknown) {
  download(filename, JSON.stringify(data, null, 2), 'application/json');
}

/* ---------------------------------------------------------------- sections */

const TX_COLS = [
  { header: 'Date', width: 12 },
  { header: 'Category', width: 14 },
  { header: 'Description', width: 30 },
  { header: 'Amount (INR)', money: true, width: 14 },
  { header: 'Payment Method', width: 14 },
  { header: 'Notes', width: 30 },
];

function txSection(title: string, txs: Transaction[]): Section {
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
  return {
    title,
    columns: TX_COLS,
    rows: sorted.map((t) => [formatDateNumeric(t.date), t.category, t.description, round2(t.amount), t.paymentMethod, t.notes]),
    total: round2(sorted.reduce((a, t) => a + t.amount, 0)),
  };
}

export interface ExportRange {
  start?: string;
  end?: string;
  label: string;
}

export function buildSections(allTxs: Transaction[], allLoans: Loan[], range: ExportRange, notes: CalcNote[] = [], plans: Plan[] = []): Section[] {
  const start = range.start ?? '0000-01-01';
  const end = range.end ?? '9999-12-31';
  const asOf = end < todayISO() ? end : todayISO();
  const txs = live(allTxs).filter((t) => inRange(t.date, start, end));
  const loans = live(allLoans);
  const loansInRange = loans.filter((l) => inRange(l.startDate, start, end));
  const summaries = loans.map((l) => ({ l, s: computeLoan(l, asOf) }));

  const expenses = txs.filter((t) => t.type === 'expense' && t.category !== 'Investment');
  const investments = txs.filter((t) => t.type === 'expense' && t.category === 'Investment');
  const income = txs.filter((t) => t.type === 'income');

  const reps = loans
    .flatMap((l) => l.repayments.filter((r) => inRange(r.date, start, end)).map((r) => ({ l, r })))
    .sort((a, b) => a.r.date.localeCompare(b.r.date));

  return [
    txSection('Daily Expenses', expenses),
    txSection('Income', income),
    txSection('Investments', investments),
    {
      title: 'Loans (Money Lent)',
      columns: [
        { header: 'Borrower', width: 18 },
        { header: 'Phone', width: 13 },
        { header: 'Amount Lent', money: true, width: 13 },
        { header: 'Date Lent', width: 12 },
        { header: 'Due Date', width: 12 },
        { header: 'Interest', width: 22 },
        { header: 'Interest Amount', money: true, width: 14 },
        { header: 'Total Due', money: true, width: 13 },
        { header: 'Repaid', money: true, width: 12 },
        { header: 'Remaining', money: true, width: 13 },
        { header: 'Status', width: 14 },
        { header: 'Notes', width: 26 },
      ],
      rows: summaries
        .filter(({ l }) => loansInRange.includes(l) || range.start === undefined)
        .map(({ l, s }) => [
          l.borrowerName, l.phone, s.principal, formatDateNumeric(l.startDate), formatDateNumeric(l.dueDate), describeRate(l).replace('₹', 'Rs.'),
          s.interestAccrued, s.totalAmountDue, s.amountRepaid, s.totalOutstanding, STATUS_LABEL[s.status], l.notes,
        ]),
      total: round2(loansInRange.reduce((a, l) => a + l.principal, 0)),
    },
    {
      title: 'Loan Repayments',
      columns: [
        { header: 'Date', width: 12 },
        { header: 'Borrower', width: 18 },
        { header: 'Amount', money: true, width: 12 },
        { header: 'Principal', money: true, width: 12 },
        { header: 'Interest', money: true, width: 12 },
        { header: 'Payment Method', width: 14 },
        { header: 'Notes', width: 26 },
      ],
      rows: reps.map(({ l, r }) => [formatDateNumeric(r.date), l.borrowerName, r.amount, r.principalPortion, r.interestPortion, r.paymentMethod, r.notes]),
      total: round2(reps.reduce((a, x) => a + x.r.amount, 0)),
    },
    {
      title: 'Outstanding Loans',
      columns: [
        { header: 'Borrower', width: 18 },
        { header: 'Phone', width: 13 },
        { header: 'Remaining Principal', money: true, width: 16 },
        { header: 'Remaining Interest', money: true, width: 16 },
        { header: 'Total Outstanding', money: true, width: 16 },
        { header: 'Next Due', width: 12 },
        { header: 'Status', width: 14 },
      ],
      rows: summaries
        .filter(({ s }) => s.totalOutstanding > 0)
        .map(({ l, s }) => [l.borrowerName, l.phone, s.remainingPrincipal, s.remainingInterest, s.totalOutstanding, s.nextDueDate ? formatDateNumeric(s.nextDueDate) : '', STATUS_LABEL[s.status]]),
      total: round2(summaries.reduce((a, x) => a + x.s.totalOutstanding, 0)),
    },
    {
      title: 'Calculation Notes',
      columns: [
        { header: 'Calculation', width: 22 },
        { header: 'Date', width: 12 },
        { header: 'Type', width: 10 },
        { header: 'For', width: 26 },
        { header: 'Amount', money: true, width: 13 },
        { header: 'Notes', width: 26 },
      ],
      rows: notes
        .filter((n) => !n.deletedAt)
        .flatMap((n) => [
          ...[...n.entries]
            .filter((e) => inRange(e.date, start, end))
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((e) => [n.name, formatDateNumeric(e.date), e.type === 'in' ? 'Received' : 'Spent', e.description, e.amount, e.notes] as Cell[]),
          [n.name, '', 'TOTAL', `Spent ${noteTotals(n).spent.toFixed(2)} · Received ${noteTotals(n).received.toFixed(2)}`, noteTotals(n).net, 'Net (received − spent)'] as Cell[],
        ]),
    },
    {
      title: 'Investments & Insurance',
      columns: [
        { header: 'Name', width: 24 },
        { header: 'Type', width: 16 },
        { header: 'Provider', width: 16 },
        { header: 'Instalment', money: true, width: 13 },
        { header: 'Frequency', width: 12 },
        { header: 'Paid in period', money: true, width: 14 },
        { header: 'Total paid', money: true, width: 13 },
        { header: 'Next due', width: 12 },
        { header: 'Policy / folio', width: 16 },
      ],
      rows: plans
        .filter((p) => !p.deletedAt)
        .map((p) => {
          const s = computePlan(p);
          const inPeriod = round2(p.payments.filter((x) => inRange(x.date, start, end)).reduce((a, x) => a + x.amount, 0));
          return [p.name, p.kind, p.provider, p.amount, p.frequency, inPeriod, s.totalPaid, s.nextDueDate ? formatDateNumeric(s.nextDueDate) : '', p.policyNumber] as Cell[];
        }),
      total: round2(plans.filter((p) => !p.deletedAt).reduce((a, p) => a + p.payments.filter((x) => inRange(x.date, start, end)).reduce((b, x) => b + x.amount, 0), 0)),
    },
  ];
}

function summaryRows(sections: Section[]): [string, number][] {
  const get = (t: string) => sections.find((s) => s.title === t)?.total ?? 0;
  const income = get('Income');
  const exp = get('Daily Expenses');
  const inv = get('Investments');
  return [
    ['Income', income],
    ['Daily expenses', exp],
    ['Investments', inv],
    ['Net savings (income − expenses − investments)', round2(income - exp - inv)],
    ['Money lent (in period)', get('Loans (Money Lent)')],
    ['Loan repayments received', get('Loan Repayments')],
    ['Outstanding loans', get('Outstanding Loans')],
    ['Paid to investments & insurance', get('Investments & Insurance')],
  ];
}

/* ---------------------------------------------------------------- formats */

export function exportSectionsCSV(sections: Section[], range: ExportRange, filename: string) {
  const rows: Cell[][] = [['Paisa Ledger export', range.label], ['Generated', formatDate(todayISO())], [], ['SUMMARY', 'Amount (INR)'], ...summaryRows(sections).map(([k, v]) => [k, v.toFixed(2)])];
  for (const s of sections) {
    rows.push([], [s.title.toUpperCase()], s.columns.map((c) => c.header));
    for (const r of s.rows) rows.push(r.map((v, i) => (s.columns[i]?.money && typeof v === 'number' ? v.toFixed(2) : v)));
    if (!s.rows.length) rows.push(['(none)']);
  }
  downloadCSV(filename, rows);
}

/** Real .xlsx workbook: a Summary sheet plus one sheet per section. ExcelJS is lazy-loaded. */
export async function exportSectionsExcel(sections: Section[], range: ExportRange, filename: string) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Paisa Ledger';
  wb.created = new Date();
  const money = '₹#,##,##0.00';
  const header = (row: import('exceljs').Row) => {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6128F4' } }));
  };

  const sum = wb.addWorksheet('Summary');
  sum.columns = [{ width: 46 }, { width: 18 }];
  sum.addRow(['Paisa Ledger', range.label]).font = { bold: true, size: 14 };
  sum.addRow(['Generated', formatDate(todayISO())]);
  sum.addRow([]);
  header(sum.addRow(['Summary', 'Amount (INR)']));
  for (const [k, v] of summaryRows(sections)) {
    const r = sum.addRow([k, v]);
    r.getCell(2).numFmt = money;
  }

  for (const s of sections) {
    const ws = wb.addWorksheet(s.title.replace(/[\\/?*[\]:]/g, '').slice(0, 31));
    ws.columns = s.columns.map((c) => ({ width: c.width ?? 14 }));
    header(ws.addRow(s.columns.map((c) => c.header)));
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    for (const r of s.rows) {
      const row = ws.addRow(r);
      s.columns.forEach((c, i) => c.money && (row.getCell(i + 1).numFmt = money));
    }
    if (s.total !== undefined && s.rows.length) {
      const moneyIdx = s.columns.findIndex((c) => c.money);
      const totalRow = Array(s.columns.length).fill('');
      totalRow[0] = 'Total';
      if (moneyIdx >= 0) totalRow[moneyIdx] = s.title === 'Outstanding Loans' ? '' : s.total;
      const r = ws.addRow(totalRow);
      r.font = { bold: true };
      if (moneyIdx >= 0) r.getCell(moneyIdx + 1).numFmt = money;
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  download(filename, buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/** Standard PDF fonts cannot render ₹ — swap it for 'Rs.'. */
const pdfText = (v: Cell) => (typeof v === 'string' ? v.replace(/₹/g, 'Rs.') : v);

export async function exportSectionsPDF(sections: Section[], range: ExportRange, filename: string, extra?: { categories?: { category: string; amount: number; share: number }[] }) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableMod.default;
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(97, 40, 244);
  doc.rect(0, 0, W, 70, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Paisa Ledger', 36, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(String(pdfText(range.label)), 36, 56);
  doc.text(`Generated ${formatDate(todayISO())}`, W - 36, 56, { align: 'right' });

  type WithLast = { lastAutoTable?: { finalY: number } };
  let y = 92;
  const next = () => ((doc as unknown as WithLast).lastAutoTable?.finalY ?? y) + 26;
  const brand: [number, number, number] = [97, 40, 244];

  autoTable(doc, {
    startY: y,
    head: [['Summary', 'Amount']],
    body: summaryRows(sections).map(([k, v]) => [k, formatRs(v)]),
    theme: 'striped',
    headStyles: { fillColor: brand },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 36, right: 36 },
    tableWidth: 360,
  });

  if (extra?.categories?.length) {
    autoTable(doc, {
      startY: next(),
      head: [['Expense category', 'Amount', 'Share']],
      body: extra.categories.map((c) => [c.category, formatRs(c.amount), `${c.share.toFixed(1)}%`]),
      theme: 'striped',
      headStyles: { fillColor: [225, 29, 72] },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      margin: { left: 36, right: 36 },
      tableWidth: 360,
    });
  }

  const colors: Record<string, [number, number, number]> = {
    'Daily Expenses': [225, 29, 72],
    Income: [5, 150, 105],
    Investments: [97, 40, 244],
    'Loans (Money Lent)': [124, 58, 237],
    'Loan Repayments': [5, 150, 105],
    'Outstanding Loans': [124, 58, 237],
    'Calculation Notes': [234, 88, 12],
    'Investments & Insurance': [5, 150, 105],
  };
  for (const s of sections) {
    y = next();
    if (y > doc.internal.pageSize.getHeight() - 90) {
      doc.addPage();
      y = 40;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 30);
    doc.text(s.title, 36, y);
    autoTable(doc, {
      startY: y + 8,
      head: [s.columns.map((c) => c.header)],
      body: s.rows.length ? s.rows.map((r) => r.map((v, i) => (s.columns[i]?.money && typeof v === 'number' ? formatRs(v) : pdfText(v)))) : [[{ content: 'No records', colSpan: s.columns.length }]],
      theme: 'striped',
      headStyles: { fillColor: colors[s.title] ?? brand },
      styles: { fontSize: 8 },
      columnStyles: Object.fromEntries(s.columns.map((c, i) => [i, c.money ? { halign: 'right' } : {}])),
      margin: { left: 36, right: 36 },
    });
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 150);
    doc.text(`Page ${i} of ${pages}`, W - 36, doc.internal.pageSize.getHeight() - 18, { align: 'right' });
  }
  doc.save(filename);
}

export type ExportFormat = 'xlsx' | 'csv' | 'pdf';

export async function exportData(
  format: ExportFormat,
  txs: Transaction[],
  loans: Loan[],
  range: ExportRange,
  extra?: { categories?: { category: string; amount: number; share: number }[]; notes?: CalcNote[]; plans?: Plan[] },
) {
  const sections = buildSections(txs, loans, range, extra?.notes, extra?.plans);
  const base = `paisa-ledger-${range.label.replace(/[^\w]+/g, '-').toLowerCase()}`;
  if (format === 'xlsx') return exportSectionsExcel(sections, range, `${base}.xlsx`);
  if (format === 'csv') return exportSectionsCSV(sections, range, `${base}.csv`);
  return exportSectionsPDF(sections, range, `${base}.pdf`, extra);
}

/* Simple single-list CSVs used by page-level "Export" buttons. */
export function transactionsRows(txs: Transaction[]) {
  return [
    ['Date', 'Type', 'Category', 'Description', 'Amount (INR)', 'Payment Method', 'Notes'],
    ...live(txs)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t) => [formatDateNumeric(t.date), t.type === 'income' ? 'Income' : 'Expense', t.category, t.description, t.amount.toFixed(2), t.paymentMethod, t.notes]),
  ];
}

export function loansRows(loans: Loan[]) {
  return [
    ['Borrower', 'Phone', 'Amount Lent', 'Date Lent', 'Due Date', 'Rate', 'Interest Amount', 'Total Due', 'Repaid', 'Remaining', 'Status', 'Notes'],
    ...live(loans).map((l) => {
      const s = computeLoan(l);
      return [l.borrowerName, l.phone, s.principal.toFixed(2), formatDateNumeric(l.startDate), formatDateNumeric(l.dueDate), describeRate(l).replace('₹', 'Rs.'), s.interestAccrued.toFixed(2), s.totalAmountDue.toFixed(2), s.amountRepaid.toFixed(2), s.totalOutstanding.toFixed(2), STATUS_LABEL[s.status], l.notes];
    }),
  ];
}
